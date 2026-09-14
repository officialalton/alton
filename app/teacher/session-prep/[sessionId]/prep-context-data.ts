import type { SupabaseClient } from "@supabase/supabase-js";

// P2/P3 — 예정 수업에서 들어오는 준비 화면의 문맥.
//
// **준비 화면은 회차 준비 하나로 통일한다.** 예전에는 수업에서 들어가면 별도
// "세션 준비"(session_prepared_selections 기반)가 열려, 회차 목록에는
// "연결됨"으로 보이는데 수업 쪽에서는 회차를 다시 고르라고 하는 어긋남이
// 있었다. 원인은 데이터 전달이 아니라 준비 화면이 두 벌이었던 것이다.
//
// 이제 이 로더는 그 수업에 **연결된 회차**를 찾아 돌려주고, 화면은 그 회차의
// 준비를 연다. 연결된 회차가 없으면 그 사실을 그대로 알려준다.
export type SessionPrepContext = {
  sessionId: string;
  subjectEnrollmentId: string;
  subjectId: string;
  studentName: string;
  subjectName: string;
  startsAt: string | null;
  endsAt: string | null;
  /** 이미 시작·종료돼 내용이 고정된 수업인지. */
  frozen: boolean;
  /** 이 수업에 연결된 기본 회차. 없으면 null — 화면이 안내한다. */
  linkedUnitId: string | null;
  linkedUnitTitle: string | null;
};

export async function loadSessionPrepContext(
  supabase: SupabaseClient,
  sessionId: string
): Promise<SessionPrepContext | null> {
  // RLS가 실제 방어선이다. 담당이 아닌 선생님은 이 select가 0건을 돌려준다.
  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id, subject_enrollment_id, final_status, reservation:reservations!sessions_reservation_id_fkey(starts_at, ends_at), subject_enrollment:subject_enrollments!sessions_subject_enrollment_id_fkey(subject_id, subject:subjects(name), child:profiles!subject_enrollments_child_id_fkey(name))"
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

  // 이 수업이 다루는 기본 회차. 연결은 회차 준비 화면에서 만든다.
  const { data: link } = await supabase
    .from("session_curriculum_units")
    .select("overlay_unit_id")
    .eq("session_id", sessionId)
    .eq("role", "primary")
    .maybeSingle();

  let linkedUnitTitle: string | null = null;
  const linkedUnitId = (link?.overlay_unit_id as string | undefined) ?? null;
  if (linkedUnitId) {
    const { data: unit } = await supabase
      .from("curriculum_overlay_units")
      .select("unit_title")
      .eq("id", linkedUnitId)
      .maybeSingle();
    linkedUnitTitle = (unit?.unit_title as string | undefined) ?? null;
  }

  return {
    sessionId: data.id as string,
    subjectEnrollmentId: data.subject_enrollment_id as string,
    subjectId: enrollment.subject_id,
    studentName: child?.name ?? "",
    subjectName: subject?.name ?? "",
    startsAt: reservation?.starts_at ?? null,
    endsAt: reservation?.ends_at ?? null,
    frozen: data.final_status !== "scheduled",
    linkedUnitId,
    linkedUnitTitle,
  };
}
