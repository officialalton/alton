import type { SupabaseClient } from "@supabase/supabase-js";

// R6 11/N — 선생님이 본인의 정규수업(v3 sessions/reservations, Calendar/Meet 연동 대상)을
// 조회하는 화면의 데이터 로더. `app/teacher/dashboard-data.ts`(레거시 `legacy_sessions`
// 기반 세션뷰/과제 기능)와는 완전히 별개 — 그 파일은 R6 자체 예약과 무관하다.

export type TeacherLessonScheduleItem = {
  reservationId: string;
  sessionId: string;
  studentName: string;
  subjectName: string;
  startsAt: string;
  endsAt: string;
  status: string;
  googleMeetLink: string | null;
  googleSyncStatus: string;
  externalChangeStatus: string;
  isTrial: boolean;
  smartNotesDriveFileId: string | null;
};

export async function loadTeacherLessonSchedule(
  supabase: SupabaseClient,
  teacherId: string
): Promise<TeacherLessonScheduleItem[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id, teacher_id, smart_notes_drive_file_id, lesson_type:lesson_types(code), reservation:reservations!sessions_reservation_id_fkey(id, starts_at, ends_at, status, google_meet_link, google_sync_status, external_change_status), subject_enrollment:subject_enrollments!sessions_subject_enrollment_id_fkey(subject:subjects(name), child:profiles!subject_enrollments_child_id_fkey(name))"
    )
    .eq("teacher_id", teacherId)
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);

  function one<T>(rel: T | T[] | null | undefined): T | null {
    return Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null);
  }

  return (data ?? [])
    .map((row): TeacherLessonScheduleItem | null => {
      const reservation = one(row.reservation as unknown) as {
        id?: string;
        starts_at?: string;
        ends_at?: string;
        status?: string;
        google_meet_link?: string | null;
        google_sync_status?: string;
        external_change_status?: string;
      } | null;
      const subjectEnrollment = one(row.subject_enrollment as unknown) as { subject?: unknown; child?: unknown } | null;
      const subject = one(subjectEnrollment?.subject as unknown) as { name?: string } | null;
      const child = one(subjectEnrollment?.child as unknown) as { name?: string } | null;
      const lessonType = one(row.lesson_type as unknown) as { code?: string } | null;
      if (!reservation?.id || reservation.status !== "confirmed") return null;
      return {
        reservationId: reservation.id,
        sessionId: row.id as string,
        studentName: child?.name ?? "",
        subjectName: subject?.name ?? "",
        startsAt: reservation.starts_at as string,
        endsAt: reservation.ends_at as string,
        status: reservation.status,
        googleMeetLink: reservation.google_meet_link ?? null,
        googleSyncStatus: reservation.google_sync_status ?? "pending",
        externalChangeStatus: reservation.external_change_status ?? "none",
        isTrial: lessonType?.code === "trial",
        smartNotesDriveFileId: (row.smart_notes_drive_file_id as string | null) ?? null,
      };
    })
    .filter((item): item is TeacherLessonScheduleItem => item !== null)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}
