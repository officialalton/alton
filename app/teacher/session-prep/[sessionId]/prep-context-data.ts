import type { SupabaseClient } from "@supabase/supabase-js";

// P2/P3 2단계 — "예약 전 회차 준비 화면"이 실제 예정 수업 하나를 가리키도록
// 하는 조회. 지금까지 세션 준비(SessionPrepPanel)는 운영 커리큘럼 화면에서만
// 열려서 sessionId가 항상 null이었고(= 임시보관함에만 쌓임), 실제 수업에
// 고정할 수 없었다. 이 로더가 그 두 번째 진입 경로의 문맥을 만든다.
//
// 내부 ID는 화면에 노출하지 않는다 — 여기서 돌려주는 식별 정보는 사람이 읽는
// 학생 이름·과목명·수업 일시뿐이고, id들은 서버 호출에만 쓰인다.
export type SessionPrepContext = {
  sessionId: string;
  subjectEnrollmentId: string;
  subjectId: string;
  studentName: string;
  subjectName: string;
  startsAt: string | null;
  endsAt: string | null;
  /** 이미 고정된 수업인지 — 화면은 읽기 전용 안내로 바뀐다. */
  pinned: boolean;
};

export async function loadSessionPrepContext(
  supabase: SupabaseClient,
  sessionId: string
): Promise<SessionPrepContext | null> {
  // RLS가 실제 방어선이다. 담당이 아닌 선생님은 이 select가 0건을 돌려준다.
  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id, subject_enrollment_id, reservation:reservations!sessions_reservation_id_fkey(starts_at, ends_at), subject_enrollment:subject_enrollments!sessions_subject_enrollment_id_fkey(subject_id, subject:subjects(name), child:profiles!subject_enrollments_child_id_fkey(name))"
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  function one<T>(rel: T | T[] | null | undefined): T | null {
    return Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null);
  }
  const reservation = one(data.reservation as unknown) as
    | { starts_at?: string; ends_at?: string }
    | null;
  const enrollment = one(data.subject_enrollment as unknown) as
    | { subject_id?: string; subject?: unknown; child?: unknown }
    | null;
  const subject = one(enrollment?.subject as unknown) as { name?: string } | null;
  const child = one(enrollment?.child as unknown) as { name?: string } | null;
  if (!enrollment?.subject_id) return null;

  const { data: selection } = await supabase
    .from("session_prepared_selections")
    .select("status")
    .eq("session_id", sessionId)
    .neq("status", "archived")
    .maybeSingle();

  return {
    sessionId: data.id as string,
    subjectEnrollmentId: data.subject_enrollment_id as string,
    subjectId: enrollment.subject_id,
    studentName: child?.name ?? "",
    subjectName: subject?.name ?? "",
    startsAt: reservation?.starts_at ?? null,
    endsAt: reservation?.ends_at ?? null,
    pinned: selection?.status === "pinned",
  };
}
