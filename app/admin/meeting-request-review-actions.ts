"use server";

// 2026-09-18(상담 마일스톤 2단계) — 관리자용 "상담 리뷰"(meeting_request_reviews)
// draft/finalize/edit + 미팅록(Drive) 열람 권한 부여 서버 액션. 스키마·RPC(
// save_meeting_request_review_draft/finalize_meeting_request_review/
// admin_edit_meeting_request_review, meeting_request_review_drive_access)는
// migration 20261409000000_r12_1_consult_calendar_and_review.sql에 이미 있다
// — 이 파일은 그 RPC를 호출하는 admin 화면 쪽 얇은 레이어만 추가한다.
//
// RPC는 SECURITY DEFINER + is_admin() 자체 검사라 requireAdmin()이 돌려주는
// "인증된 관리자 세션" supabase 클라이언트로 호출해야 한다(auth.uid()가 필요) —
// createAdminClient()(서비스 롤, auth.uid() 없음)로 부르면 is_admin() 검사가
// 실패한다. 조회(select)는 service-role(createAdminClient)을 그대로 쓴다(다른
// admin 액션과 동일 패턴).

import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { getDriveApiAccessToken } from "@/lib/google-workspace-auth";
import { grantSmartNotesReaderPermission } from "@/lib/drive-session-tasks";

export type MeetingRequestReviewForAdmin = {
  reviewId: string | null;
  status: "draft" | "final" | "none";
  draftText: string | null;
  finalText: string | null;
  finalizedAt: string | null;
  adminEditedAt: string | null;
  driveAccess: { driveFileId: string; status: "pending" | "granted" | "failed"; lastError: string | null } | null;
};

export type MeetingRequestReviewEdit = {
  id: string;
  previousFinalText: string | null;
  editedAt: string;
  editedByName: string | null;
};

async function loadReviewRow(meetingRequestId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("meeting_request_reviews")
    .select("id, status, draft_text, final_text, finalized_at, admin_edited_at")
    .eq("meeting_request_id", meetingRequestId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getMeetingRequestReviewForAdmin(
  meetingRequestId: string
): Promise<MeetingRequestReviewForAdmin> {
  await requireAdmin();
  const admin = createAdminClient();
  const review = await loadReviewRow(meetingRequestId);
  if (!review) {
    return { reviewId: null, status: "none", draftText: null, finalText: null, finalizedAt: null, adminEditedAt: null, driveAccess: null };
  }
  const { data: access } = await admin
    .from("meeting_request_review_drive_access")
    .select("drive_file_id, status, last_error")
    .eq("meeting_request_review_id", review.id)
    .maybeSingle();
  return {
    reviewId: review.id,
    status: review.status,
    draftText: review.draft_text,
    finalText: review.final_text,
    finalizedAt: review.finalized_at,
    adminEditedAt: review.admin_edited_at,
    driveAccess: access
      ? { driveFileId: access.drive_file_id, status: access.status, lastError: access.last_error }
      : null,
  };
}

export async function listMeetingRequestReviewEditsForAdmin(
  meetingRequestId: string
): Promise<MeetingRequestReviewEdit[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const review = await loadReviewRow(meetingRequestId);
  if (!review) return [];
  const { data, error } = await admin
    .from("meeting_request_review_edits")
    .select("id, previous_final_text, edited_at, editor:profiles!meeting_request_review_edits_edited_by_fkey(name)")
    .eq("meeting_request_review_id", review.id)
    .order("edited_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const editorRel = r.editor as { name?: string } | { name?: string }[] | null;
    const editor = Array.isArray(editorRel) ? editorRel[0] : editorRel;
    return {
      id: r.id,
      previousFinalText: r.previous_final_text,
      editedAt: r.edited_at,
      editedByName: editor?.name ?? null,
    };
  });
}

export async function saveMeetingRequestReviewDraftAction(
  meetingRequestId: string,
  draftText: string
): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("save_meeting_request_review_draft", {
    p_meeting_request_id: meetingRequestId,
    p_draft_text: draftText,
  });
  if (error) throw new Error(error.message);
}

export async function finalizeMeetingRequestReviewAction(
  meetingRequestId: string,
  finalText: string
): Promise<void> {
  const { supabase } = await requireAdmin();
  if (!finalText.trim()) throw new Error("확정할 리뷰 내용을 입력해주세요.");
  const { error } = await supabase.rpc("finalize_meeting_request_review", {
    p_meeting_request_id: meetingRequestId,
    p_final_text: finalText,
  });
  if (error) throw new Error(error.message);
}

export async function editFinalizedMeetingRequestReviewAction(
  meetingRequestId: string,
  finalText: string
): Promise<void> {
  const { supabase } = await requireAdmin();
  if (!finalText.trim()) throw new Error("수정할 리뷰 내용을 입력해주세요.");
  const { error } = await supabase.rpc("admin_edit_meeting_request_review", {
    p_meeting_request_id: meetingRequestId,
    p_final_text: finalText,
  });
  if (error) throw new Error(error.message);
}

// 2026-09-18 — 미팅록(Drive 문서) 링크를 첨부하고, 그 household의 보호자
// 계정에 실제로 reader 권한을 부여한다(Gate C 패턴 재사용 — 세션 Smart Notes와
// 동일한 grantSmartNotesReaderPermission 헬퍼). 권한 부여가 실제로 성공(granted)
// 확인되기 전까지는 링크를 노출하지 않는다(getGuardianMeetingRequestReview가
// status='granted'만 반환) — 여기서는 그 상태를 만드는 쪽만 담당한다.
//
// DRIVE_ARTIFACTS_ALLOW_REAL_WRITES 게이트를 다른 Drive 쓰기(lib/drive-session-tasks.ts)
// 와 동일하게 재사용한다 — 새 플래그를 만들지 않는다. 게이트가 꺼져 있으면 행을
// pending으로 만들어두고 명시적으로 실패시킨다("조용히 성공한 척"하지 않는다).
export async function attachAndGrantMeetingReviewDriveAccess(params: {
  meetingRequestId: string;
  driveFileId: string;
}): Promise<{ status: "granted" | "failed" | "pending" }> {
  await requireAdmin();
  const admin = createAdminClient();

  const review = await loadReviewRow(params.meetingRequestId);
  if (!review) throw new Error("먼저 리뷰를 작성/확정해야 미팅록을 연결할 수 있습니다.");

  const { error: upsertError } = await admin
    .from("meeting_request_review_drive_access")
    .upsert(
      { meeting_request_review_id: review.id, drive_file_id: params.driveFileId, status: "pending" },
      { onConflict: "meeting_request_review_id" }
    );
  if (upsertError) throw new Error(upsertError.message);

  if (process.env.DRIVE_ARTIFACTS_ALLOW_REAL_WRITES !== "true") {
    throw new Error(
      "not implemented: DRIVE_ARTIFACTS_ALLOW_REAL_WRITES=true가 아니면 실제 Drive 권한 부여를 하지 않습니다(행은 pending으로 저장됨)."
    );
  }

  const { data: mrRow, error: mrError } = await admin
    .from("meeting_requests")
    .select("household:households(guardian:profiles!households_primary_guardian_id_fkey(email))")
    .eq("id", params.meetingRequestId)
    .single();
  if (mrError) throw new Error(mrError.message);
  const householdRel = mrRow.household as
    | { guardian?: { email?: string } | { email?: string }[] }
    | { guardian?: { email?: string } | { email?: string }[] }[]
    | null;
  const household = Array.isArray(householdRel) ? householdRel[0] : householdRel;
  const guardianRel = household?.guardian;
  const guardian = Array.isArray(guardianRel) ? guardianRel[0] : guardianRel;
  const guardianEmail = guardian?.email;
  if (!guardianEmail) {
    await admin
      .from("meeting_request_review_drive_access")
      .update({ status: "failed", last_error: "보호자 이메일을 찾을 수 없습니다.", updated_at: new Date().toISOString() })
      .eq("meeting_request_review_id", review.id);
    throw new Error("보호자 이메일을 찾을 수 없어 권한을 부여하지 못했습니다.");
  }

  try {
    const token = await getDriveApiAccessToken();
    await grantSmartNotesReaderPermission(token, params.driveFileId, guardianEmail);
    await admin
      .from("meeting_request_review_drive_access")
      .update({ status: "granted", last_error: null, updated_at: new Date().toISOString() })
      .eq("meeting_request_review_id", review.id);
    return { status: "granted" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const { data: current } = await admin
      .from("meeting_request_review_drive_access")
      .select("retry_count")
      .eq("meeting_request_review_id", review.id)
      .maybeSingle();
    await admin
      .from("meeting_request_review_drive_access")
      .update({
        status: "failed",
        last_error: message.slice(0, 500),
        retry_count: (current?.retry_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("meeting_request_review_id", review.id);
    throw new Error(`Drive 권한 부여 실패: ${message}`);
  }
}
