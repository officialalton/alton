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
  lessonTypeId: string;
  lessonDurationMinutes: number;
  isTrial: boolean;
};

export type UpcomingBooking = {
  reservationId: string;
  sessionId: string;
  // 선택 필드로 둔 이유: 기존 테스트 픽스처(여러 파일)가 이 필드 없이
  // UpcomingBooking을 직접 만들어 쓰고 있어, 실제 로더(loadLessonBookingData)
  // 는 항상 채우되 타입은 하위 호환을 위해 optional로 둔다.
  subjectEnrollmentId?: string;
  subjectName: string;
  teacherName: string;
  startsAt: string;
  endsAt: string;
  googleMeetLink: string | null;
  googleSyncStatus: string;
};

export type PastSessionForReport = {
  sessionId: string;
  subjectName: string;
  teacherName: string;
  startsAt: string;
  // v3 재매칭 후 예약 결함 수정(2026-09-11) — 체험 수업이 완료 판정됐지만
  // 리뷰가 아직 확정(final)되지 않았으면 true. 리뷰 여부와 무관하게 이
  // 세션은 이미 "지난 수업"으로 분류되고("예정 수업"·"수업 시작" 대상에서
  // 빠짐), 이 플래그로 "리뷰 작성 필요"만 표시한다(제품 오너 지시).
  needsReview: boolean;
};

// v3 재매칭 후 예약 결함 수정(2026-09-11, 2차 보완) — 최초 구현은 "같은
// 과목에 종료 이력이 있으면 정규 계약 대기"로 일괄 추정했는데, 종료 이력은
// 계약 상태·체험권 사용 여부의 신뢰할 수 있는 대리 지표가 아니라는 지적을
// 받았다. 실제 계약·체험권 사용 이력(entitlement_grants/entitlement_ledger)과
// 기존 활성화 판정 경로(subject_enrollment_activation_ready, R5/M4)를 그대로
// 재사용해 실제 차단 사유를 구분한다 — 상태를 추정하지 않는다.
export type PendingActivationReason =
  | "contract_pending" // subject_enrollment_activation_ready() = false(기본계약 미활성)
  | "no_entitlement" // 계약은 active인데 사용 가능한 정규 수업권이 없음(체험도 이미 소진)
  | "activation_pending"; // 계약도 active, 정규 수업권도 있음 — 시스템/관리자의 수강 활성화(planned→active) 처리만 남음(정규 예약 조건 자체는 이미 충족)
export type PendingActivationSubject = {
  subjectEnrollmentId: string;
  subjectName: string;
  teacherName: string;
  reason: PendingActivationReason;
};

export type LessonBookingData = {
  bookableEnrollments: BookableSubjectEnrollment[];
  pendingActivationSubjects?: PendingActivationSubject[];
  upcomingBookings: UpcomingBooking[];
  pastSessionsForReport: PastSessionForReport[];
  timezone: string;
};

function unwrapOne<T>(rel: unknown): T | null {
  return (Array.isArray(rel) ? rel[0] : rel) as T | null;
}

// entitlement_grants→entitlement_products→entitlement_types→lesson_types 조인
// 결과에서 실제 수업 유형 코드('trial'|'regular')만 뽑아낸다.
function extractLessonTypeCode(entitlementProduct: unknown): string | null {
  const product = unwrapOne<{ entitlement_type?: unknown }>(entitlementProduct);
  const type = unwrapOne<{ lesson_type?: unknown }>(product?.entitlement_type);
  const lessonType = unwrapOne<{ code?: string }>(type?.lesson_type);
  return lessonType?.code ?? null;
}

export async function loadLessonBookingData(
  supabase: SupabaseClient,
  childId: string
): Promise<LessonBookingData> {
  const enrollments = await loadStudentSubjectEnrollments(supabase, childId);

  const { data: lessonTypeRows } = await supabase
    .from("lesson_types")
    .select("id, code, duration_minutes")
    .in("code", ["regular", "trial"]);
  const regularType = (lessonTypeRows ?? []).find((t) => t.code === "regular") as
    | { id: string; duration_minutes: number }
    | undefined;
  const trialType = (lessonTypeRows ?? []).find((t) => t.code === "trial") as
    | { id: string; duration_minutes: number }
    | undefined;

  // 실제 체험/정규 수업권 잔량(child 단위 — 체험수업권은 상담 1건당 1개,
  // subject_enrollment가 아니라 학생 본인에게 귀속된다. M2,
  // 20261012000000_m2_trial_entitlement.sql). RLS가 이미 본인/보호자로
  // 범위를 제한하므로 추가 소유권 검증 없이 그대로 조회한다.
  const { data: grantRows } = await supabase
    .from("entitlement_grants")
    .select(
      "id, entitlement_product:entitlement_products(entitlement_type:entitlement_types(lesson_type:lesson_types(code)))"
    )
    .eq("child_id", childId)
    .gt("expires_at", new Date().toISOString());
  const grantIds = (grantRows ?? []).map((g) => g.id as string);
  const { data: ledgerRows } = grantIds.length
    ? await supabase.from("entitlement_ledger").select("grant_id, amount").in("grant_id", grantIds)
    : { data: [] as { grant_id: string; amount: number }[] };
  const remainingByGrant = new Map<string, number>();
  for (const l of ledgerRows ?? []) {
    remainingByGrant.set(l.grant_id, (remainingByGrant.get(l.grant_id) ?? 0) + (l.amount as number));
  }
  let trialRemaining = 0;
  let regularRemaining = 0;
  for (const g of grantRows ?? []) {
    const code = extractLessonTypeCode(g.entitlement_product);
    const remaining = remainingByGrant.get(g.id as string) ?? 0;
    if (code === "trial") trialRemaining += remaining;
    else if (code === "regular") regularRemaining += remaining;
  }

  const enrollmentIds = enrollments.map((e) => e.id);
  let upcomingBookings: UpcomingBooking[] = [];
  let pastSessionsForReport: PastSessionForReport[] = [];
  if (enrollmentIds.length > 0) {
    const { data: sessions } = await supabase
      .from("sessions")
      .select(
        "id, subject_enrollment_id, final_status, lesson_type:lesson_types(code), reservation:reservations!sessions_reservation_id_fkey(id, starts_at, ends_at, status, google_meet_link, google_sync_status), teacher:profiles!sessions_teacher_id_fkey(name), subject_enrollment:subject_enrollments!sessions_subject_enrollment_id_fkey(subject:subjects(name))"
      )
      .in("subject_enrollment_id", enrollmentIds)
      .order("created_at", { ascending: true });

    type BookingRow = {
      reservationId: string | null;
      sessionId: string;
      subjectEnrollmentId: string;
      subjectName: string;
      teacherName: string;
      startsAt: string;
      endsAt: string;
      status: string;
      googleMeetLink: string | null;
      googleSyncStatus: string;
      finalStatus: string;
      isTrial: boolean;
    };

    const rows = (sessions ?? [])
      .map((s): BookingRow | null => {
        const reservation = unwrapOne<{
          id: string;
          starts_at: string;
          ends_at: string;
          status: string;
          google_meet_link: string | null;
          google_sync_status: string;
        }>(s.reservation);
        const teacher = unwrapOne<{ name?: string }>(s.teacher);
        const subjectEnrollment = unwrapOne<{ subject?: unknown }>(s.subject_enrollment);
        const subject = unwrapOne<{ name?: string }>(subjectEnrollment?.subject);
        const lessonType = unwrapOne<{ code?: string }>(s.lesson_type);
        if (!reservation) return null;
        return {
          reservationId: reservation.id,
          sessionId: s.id as string,
          subjectEnrollmentId: s.subject_enrollment_id as string,
          subjectName: subject?.name ?? "",
          teacherName: teacher?.name ?? "",
          startsAt: reservation.starts_at,
          endsAt: reservation.ends_at,
          status: reservation.status,
          googleMeetLink: reservation.google_meet_link,
          googleSyncStatus: reservation.google_sync_status,
          finalStatus: s.final_status as string,
          isTrial: lessonType?.code === "trial",
        };
      })
      .filter((r): r is BookingRow => r !== null);

    // 체험 수업의 확정 리뷰 상태 — "지난 수업" 분류 자체에는 더 이상 쓰지
    // 않는다(아래 isPastSession 참고, 2026-09-11 2차 보완). 리뷰 미확정
    // 여부만 표시용(needsReview)으로 남긴다.
    const trialSessionIds = rows.filter((r) => r.isTrial).map((r) => r.sessionId);
    const { data: reviews } = trialSessionIds.length
      ? await supabase.from("lesson_reviews").select("trial_session_id, status").in("trial_session_id", trialSessionIds)
      : { data: [] as { trial_session_id: string; status: string }[] };
    const reviewStatusBySession = new Map((reviews ?? []).map((r) => [r.trial_session_id, r.status]));

    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60_000);

    // 예정/지난 판정(2026-09-06 정리, 2026-09-11 2차 보완) — (1) 시작 시각이
    // 지났거나 (2) 세션이 이미 최종판정됐으면(final_status가 scheduled/live가
    // 아니면) "지난 수업"으로 분류한다. 예전에는 체험 수업이면 리뷰가
    // 확정(final)되기 전까지 이 판정과 무관하게 계속 "예정 수업"에 남겨뒀다
    // — 완료된 체험 수업이 리뷰만 안 끝났다는 이유로 "수업 시작" 버튼과 함께
    // 예정 수업 목록에 계속 남는 표시 결함의 원인이었다(제품 오너 지시로
    // 제거). 리뷰 필요 여부는 이제 needsReview 플래그로만 별도 표시한다.
    function isPastSession(r: BookingRow): boolean {
      const timeEnded = new Date(r.startsAt) <= now;
      const finalized = r.finalStatus !== "scheduled" && r.finalStatus !== "live";
      return timeEnded || finalized;
    }
    function needsReview(r: BookingRow): boolean {
      return r.isTrial && r.finalStatus === "completed" && reviewStatusBySession.get(r.sessionId) !== "final";
    }

    upcomingBookings = rows
      .filter((r) => r.status === "confirmed" && !isPastSession(r))
      .map((r) => ({
        reservationId: r.reservationId as string,
        sessionId: r.sessionId,
        subjectEnrollmentId: r.subjectEnrollmentId,
        subjectName: r.subjectName,
        teacherName: r.teacherName,
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        googleMeetLink: r.googleMeetLink,
        googleSyncStatus: r.googleSyncStatus,
      }))
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

    // 지각·노쇼 신고 대상 — 최근 14일 이내 지난 수업으로 넘어간 세션(취소된 예약 제외,
    // 신고할 "일어난 수업"이 아니므로). 최종 판정·수업권 소진은 R7 범위 — 여기서는 신고
    // 대상 목록만 노출한다.
    pastSessionsForReport = rows
      .filter((r) => r.status === "confirmed" && isPastSession(r) && new Date(r.startsAt) >= fourteenDaysAgo)
      .map((r) => ({
        sessionId: r.sessionId,
        subjectName: r.subjectName,
        teacherName: r.teacherName,
        startsAt: r.startsAt,
        needsReview: needsReview(r),
      }))
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  }

  // 2026-09-09(UAT 지적): 체험수업권 지급 여부로 후보 목록 자체를 숨기면,
  // "선생님 배정이 필요합니다" 문구가 실제로는 "체험수업권 지급 대기 중"인
  // 경우까지 오인시킨다. 수업권 잔여량 검증은 어차피 예약 확정 시
  // hold_entitlement()가 최종 강제하므로("사용 가능한 수업권이 없습니다"),
  // 여기서는 실제 잔량·계약 상태를 안내에만 쓰고 최종 부족 여부는 예약
  // 시도 시점의 에러로도 안내한다.
  //
  // 2026-09-11(2차 보완) — 'planned' 건을 체험 후보로 볼지는 이제 실제
  // 체험수업권 잔량(child 단위, 위에서 계산한 trialRemaining)으로 판단한다.
  // 이미 이 수강 건으로 예약해둔 체험(아직 hold 상태 — 소진 전)까지 후보
  // 목록에서 빼면 "이미 예약하셨습니다" 안내 자체가 안 뜨게 되므로,
  // upcomingBookings에 이 수강 건의 예약이 있으면 잔량이 0이어도 그대로
  // 후보로 남긴다(화면은 기존처럼 "이미 예약하셨습니다"로 안내).
  const bookableEnrollments: BookableSubjectEnrollment[] = [];
  const pendingActivationSubjects: PendingActivationSubject[] = [];
  for (const e of enrollments) {
    if (!e.currentTeacher) continue;
    if (e.status === "active" && regularType) {
      bookableEnrollments.push({
        subjectEnrollmentId: e.id,
        subjectName: e.subjectName,
        teacherId: e.currentTeacher.teacherId,
        teacherName: e.currentTeacher.teacherName,
        lessonTypeId: regularType.id,
        lessonDurationMinutes: regularType.duration_minutes,
        isTrial: false,
      });
    } else if (e.status === "planned" && trialType) {
      const hasUpcomingTrialForThisEnrollment = upcomingBookings.some(
        (b) => b.subjectEnrollmentId === e.id
      );
      if (trialRemaining > 0 || hasUpcomingTrialForThisEnrollment) {
        bookableEnrollments.push({
          subjectEnrollmentId: e.id,
          subjectName: e.subjectName,
          teacherId: e.currentTeacher.teacherId,
          teacherName: e.currentTeacher.teacherName,
          lessonTypeId: trialType.id,
          lessonDurationMinutes: trialType.duration_minutes,
          isTrial: true,
        });
      } else {
        // 체험수업권이 없다(한 번도 지급된 적 없거나 이미 소진) — 실제
        // 계약 활성화 판정(subject_enrollment_activation_ready, R5/M4가
        // 이미 쓰는 유일한 판정 경로)을 그대로 재사용해 진짜 원인을
        // 구분한다: 계약이 아직 active가 아니면 "정규 계약 대기", 계약은
        // active인데 정규 수업권도 없으면 "사용 가능한 수업권 없음".
        const { data: activationReady } = await supabase.rpc("subject_enrollment_activation_ready", {
          p_subject_enrollment_id: e.id,
        });
        // 계약도 active, 정규 수업권도 있으면 정규 예약 조건 자체는 이미
        // 충족된 상태다 — "수업권 없음"으로 잘못 안내하지 않는다. 이 상태는
        // subject_enrollments.status가 아직 'planned'→'active'로 전환만
        // 안 된 것뿐이라(자동 전환 트리거 없음, 관리자 활성화 대기) 정규
        // 후보로 즉시 넣지는 않되(상태 전이 없이 예약을 열면 다른 화면의
        // 'active' 전제와 어긋날 수 있음), 원인은 정확히 구분해 안내한다.
        const reason: PendingActivationReason = !activationReady
          ? "contract_pending"
          : regularRemaining > 0
            ? "activation_pending"
            : "no_entitlement";
        pendingActivationSubjects.push({
          subjectEnrollmentId: e.id,
          subjectName: e.subjectName,
          teacherName: e.currentTeacher.teacherName,
          reason,
        });
      }
    }
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
    pendingActivationSubjects,
    upcomingBookings,
    pastSessionsForReport,
    timezone: resolveUserTimezone({
      profileTimezone: (profile?.timezone as string) ?? null,
      householdDefaultTimezone: (household as { default_timezone?: string } | null)?.default_timezone ?? null,
    }),
  };
}
