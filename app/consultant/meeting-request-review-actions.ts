"use server";

// 2026-09-24(사용자 지시 — "상담 리뷰는 담당 컨설턴트가 당연히 작성해야지") —
// admin/meeting-request-review-actions.ts와 같은 RPC(save_meeting_request_review_draft/
// finalize_meeting_request_review/admin_edit_meeting_request_review)를 담당
// 컨설턴트 세션으로 호출하는 얇은 레이어. RPC는 20261900000005부터
// is_admin() 또는 meeting_requests.consultant_id=auth.uid()를 허용한다.
// 세션 클라이언트로 호출해야 auth.uid()가 채워진다(admin 클라이언트는
// service_role이라 두 조건 다 실패한다).
//
// 미팅록(Drive) 링크 연결·권한 부여는 이번 범위 밖(관리자 전용으로 유지) —
// 사용자 지시는 "리뷰 작성 주체"만 바꾸는 것이었다.

import { requireUser } from "@/lib/auth";

export type MeetingRequestReviewForConsultant = {
  reviewId: string | null;
  status: "draft" | "final" | "none";
  draftText: string | null;
  finalText: string | null;
  finalizedAt: string | null;
  adminEditedAt: string | null;
};

export type MeetingRequestReviewEditForConsultant = {
  id: string;
  previousFinalText: string | null;
  editedAt: string;
  editedByName: string | null;
};

async function requireAssignedConsultant(supabaseClient: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, meetingRequestId: string) {
  const { data, error } = await supabaseClient
    .from("meeting_requests")
    .select("id")
    .eq("id", meetingRequestId)
    .eq("consultant_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("담당 컨설턴트가 아닙니다.");
}

async function requireConsultant() {
  const { user, profile, supabase } = await requireUser();
  if (profile?.role !== "consultant") throw new Error("컨설턴트만 접근할 수 있습니다.");
  return { userId: user.id, supabase };
}

async function loadReviewRow(supabaseClient: Awaited<ReturnType<typeof requireUser>>["supabase"], meetingRequestId: string) {
  const { data, error } = await supabaseClient
    .from("meeting_request_reviews")
    .select("id, status, draft_text, final_text, finalized_at, admin_edited_at")
    .eq("meeting_request_id", meetingRequestId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getMeetingRequestReviewForConsultant(
  meetingRequestId: string
): Promise<MeetingRequestReviewForConsultant> {
  const { userId, supabase } = await requireConsultant();
  await requireAssignedConsultant(supabase, userId, meetingRequestId);
  const review = await loadReviewRow(supabase, meetingRequestId);
  if (!review) {
    return { reviewId: null, status: "none", draftText: null, finalText: null, finalizedAt: null, adminEditedAt: null };
  }
  return {
    reviewId: review.id,
    status: review.status,
    draftText: review.draft_text,
    finalText: review.final_text,
    finalizedAt: review.finalized_at,
    adminEditedAt: review.admin_edited_at,
  };
}

export async function listMeetingRequestReviewEditsForConsultant(
  meetingRequestId: string
): Promise<MeetingRequestReviewEditForConsultant[]> {
  const { userId, supabase } = await requireConsultant();
  await requireAssignedConsultant(supabase, userId, meetingRequestId);
  const review = await loadReviewRow(supabase, meetingRequestId);
  if (!review) return [];
  const { data, error } = await supabase
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

export async function saveMyMeetingRequestReviewDraftAction(meetingRequestId: string, draftText: string): Promise<void> {
  const { userId, supabase } = await requireConsultant();
  await requireAssignedConsultant(supabase, userId, meetingRequestId);
  const { error } = await supabase.rpc("save_meeting_request_review_draft", {
    p_meeting_request_id: meetingRequestId,
    p_draft_text: draftText,
  });
  if (error) throw new Error(error.message);
}

export async function finalizeMyMeetingRequestReviewAction(meetingRequestId: string, finalText: string): Promise<void> {
  const { userId, supabase } = await requireConsultant();
  await requireAssignedConsultant(supabase, userId, meetingRequestId);
  if (!finalText.trim()) throw new Error("확정할 리뷰 내용을 입력해주세요.");
  const { error } = await supabase.rpc("finalize_meeting_request_review", {
    p_meeting_request_id: meetingRequestId,
    p_final_text: finalText,
  });
  if (error) throw new Error(error.message);
}

export async function editMyFinalizedMeetingRequestReviewAction(meetingRequestId: string, finalText: string): Promise<void> {
  const { userId, supabase } = await requireConsultant();
  await requireAssignedConsultant(supabase, userId, meetingRequestId);
  if (!finalText.trim()) throw new Error("수정할 리뷰 내용을 입력해주세요.");
  const { error } = await supabase.rpc("admin_edit_meeting_request_review", {
    p_meeting_request_id: meetingRequestId,
    p_final_text: finalText,
  });
  if (error) throw new Error(error.message);
}
