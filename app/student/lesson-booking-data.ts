import type { SupabaseClient } from "@supabase/supabase-js";
import { loadStudentSubjectEnrollments } from "./enrollment-data";
import { resolveUserTimezone } from "@/lib/timezone";

// R6 6/N — 정규수업 예약 화면 데이터 로더(읽기 전용). subject_enrollments/
// teacher_assignments 조회는 기존 R5 로더(loadStudentSubjectEnrollments)를 그대로
// 재사용한다(RLS가 이미 본인/보호자/배정된 선생님/관리자로 범위를 제한).

export type BookableSubjectEnrollment = {
  subjectEnrollmentId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
};

export type UpcomingBooking = {
  reservationId: string;
  sessionId: string;
  subjectName: string;
  teacherName: string;
  startsAt: string;
  endsAt: string;
  googleMeetLink: string | null;
  googleSyncStatus: string;
};

export type LessonBookingData = {
  bookableEnrollments: BookableSubjectEnrollment[];
  upcomingBookings: UpcomingBooking[];
  regularLessonTypeId: string | null;
  lessonDurationMinutes: number;
  timezone: string;
};

export async function loadLessonBookingData(
  supabase: SupabaseClient,
  childId: string
): Promise<LessonBookingData> {
  const enrollments = await loadStudentSubjectEnrollments(supabase, childId);
  const bookableEnrollments: BookableSubjectEnrollment[] = enrollments
    .filter((e) => e.status === "active" && e.currentTeacher)
    .map((e) => ({
      subjectEnrollmentId: e.id,
      subjectName: e.subjectName,
      teacherId: e.currentTeacher!.teacherId,
      teacherName: e.currentTeacher!.teacherName,
    }));

  const { data: lessonType } = await supabase
    .from("lesson_types")
    .select("id, duration_minutes")
    .eq("code", "regular")
    .maybeSingle();

  const enrollmentIds = enrollments.map((e) => e.id);
  let upcomingBookings: UpcomingBooking[] = [];
  if (enrollmentIds.length > 0) {
    const { data: sessions } = await supabase
      .from("sessions")
      .select(
        "id, subject_enrollment_id, reservation:reservations!sessions_reservation_id_fkey(id, starts_at, ends_at, status, google_meet_link, google_sync_status), teacher:profiles!sessions_teacher_id_fkey(name), subject_enrollment:subject_enrollments!sessions_subject_enrollment_id_fkey(subject:subjects(name))"
      )
      .in("subject_enrollment_id", enrollmentIds)
      .order("created_at", { ascending: true });

    upcomingBookings = (sessions ?? [])
      .map((s): UpcomingBooking | null => {
        const reservation = Array.isArray(s.reservation) ? s.reservation[0] : s.reservation;
        const teacher = Array.isArray(s.teacher) ? s.teacher[0] : s.teacher;
        const subjectEnrollment = Array.isArray(s.subject_enrollment) ? s.subject_enrollment[0] : s.subject_enrollment;
        const subject = subjectEnrollment ? (Array.isArray(subjectEnrollment.subject) ? subjectEnrollment.subject[0] : subjectEnrollment.subject) : null;
        if (!reservation || reservation.status !== "confirmed") return null;
        return {
          reservationId: reservation.id as string,
          sessionId: s.id as string,
          subjectName: (subject as { name?: string } | null)?.name ?? "",
          teacherName: (teacher as { name?: string } | null)?.name ?? "",
          startsAt: reservation.starts_at as string,
          endsAt: reservation.ends_at as string,
          googleMeetLink: (reservation.google_meet_link as string | null) ?? null,
          googleSyncStatus: reservation.google_sync_status as string,
        };
      })
      .filter((b): b is UpcomingBooking => b !== null)
      .filter((b) => new Date(b.startsAt) > new Date())
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }

  const { data: profile } = await supabase.from("profiles").select("timezone").eq("id", childId).maybeSingle();
  const { data: householdLink } = await supabase
    .from("household_members")
    .select("household:households(default_timezone)")
    .eq("profile_id", childId)
    .maybeSingle();
  const household = householdLink ? (Array.isArray(householdLink.household) ? householdLink.household[0] : householdLink.household) : null;

  return {
    bookableEnrollments,
    upcomingBookings,
    regularLessonTypeId: (lessonType?.id as string) ?? null,
    lessonDurationMinutes: (lessonType?.duration_minutes as number) ?? 120,
    timezone: resolveUserTimezone({
      profileTimezone: (profile?.timezone as string) ?? null,
      householdDefaultTimezone: (household as { default_timezone?: string } | null)?.default_timezone ?? null,
    }),
  };
}
