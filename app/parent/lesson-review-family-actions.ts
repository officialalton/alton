"use server";

// 2026-09-17(제품 오너 피드백) — getTrialLessonReviewForFamily(trial-conversion-actions.ts)는
// "정규 진행 희망" 흐름 전용으로 의도적으로 체험 1건만 다룬다(그 흐름은 원래
// 체험 전용이라 그대로 둔다). 이 파일은 학생/보호자가 지난 수업(체험+정규 전부)
// 상세에서 확정된 수업 리뷰 + 미팅록을 보는 일반 화면을 위한 것 — 완료된 수업
// 전체를 대상으로 한다(체험으로 제한하지 않음).
//
// 미팅록 "링크"는 session_smart_notes.drive_file_id(20261388000000, household
// RLS로 이미 열람 가능)로 만들지만, 실제 Google Drive reader 권한 부여는
// session_drive_tasks 큐가 비동기 처리하므로 그 작업이 succeeded일 때만 링크를
// 보여준다(그렇지 않으면 클릭 시 "권한 없음"). 첫 상담(consultations)은 이
// 대상이 아니다 — sessions 테이블 기반이라 애초에 조회되지 않는다.
//
// 2026-09-17(보안 재검토) — session_drive_tasks는 RLS가 켜져 있고 학생·보호자용
// 정책이 전혀 없다(20261393000000, service_role 전용 내부 큐 — payload/last_error에
// 내부 처리 상세가 있어 의도적으로 전면 차단). 그래서 상태 조회는 테이블을 직접
// select하지 않고 SECURITY DEFINER 함수(get_smart_notes_reader_grant_statuses,
// 20261412000000)로만 한다 — 이 함수는 status 컬럼만 반환해 payload/last_error가
// 나갈 경로 자체가 없다.

import { requireUser } from "@/lib/auth";

export type FamilyLessonReview = {
  reviewId: string;
  sessionId: string;
  lessonType: "trial" | "regular";
  finalText: string;
  aiSummary: string | null;
  finalizedAt: string;
  categoryNotes: { key: string; label: string; note: string }[];
  meetingRecordLink: string | null;
};

export async function getLessonReviewsForFamily(subjectEnrollmentId: string): Promise<FamilyLessonReview[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("get_lesson_reviews_for_family", {
    p_subject_enrollment_id: subjectEnrollmentId,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as {
    review_id: string;
    lesson_type: "trial" | "regular";
    session_id: string;
    final_text: string;
    ai_summary: string | null;
    finalized_at: string;
    category_key: string | null;
    category_label: string | null;
    category_note: string | null;
  }[];
  if (rows.length === 0) return [];

  const reviewIds = Array.from(new Set(rows.map((r) => r.review_id)));
  const sessionIds = Array.from(new Set(rows.map((r) => r.session_id)));

  const [{ data: smartNotes }, { data: grantStatuses, error: grantStatusError }] = await Promise.all([
    supabase.from("session_smart_notes").select("session_id, drive_file_id").in("session_id", sessionIds),
    supabase.rpc("get_smart_notes_reader_grant_statuses", { p_session_ids: sessionIds }),
  ]);
  if (grantStatusError) throw new Error(grantStatusError.message);
  const driveFileIdBySession = new Map((smartNotes ?? []).map((s) => [s.session_id as string, s.drive_file_id as string]));
  const typedGrantStatuses = (grantStatuses ?? []) as { session_id: string; status: string }[];
  const grantedSessionIds = new Set(
    typedGrantStatuses.filter((g) => g.status === "succeeded").map((g) => g.session_id)
  );

  return reviewIds
    .map((reviewId) => {
      const rowsForReview = rows.filter((r) => r.review_id === reviewId);
      const first = rowsForReview[0];
      const driveFileId = driveFileIdBySession.get(first.session_id);
      return {
        reviewId: first.review_id,
        sessionId: first.session_id,
        lessonType: first.lesson_type,
        finalText: first.final_text,
        aiSummary: first.ai_summary,
        finalizedAt: first.finalized_at,
        categoryNotes: rowsForReview
          .filter((r) => r.category_key && r.category_note)
          .map((r) => ({ key: r.category_key as string, label: r.category_label as string, note: r.category_note as string })),
        meetingRecordLink:
          driveFileId && grantedSessionIds.has(first.session_id)
            ? `https://drive.google.com/file/d/${driveFileId}/view`
            : null,
      };
    })
    .sort((a, b) => (a.finalizedAt < b.finalizedAt ? 1 : -1));
}
