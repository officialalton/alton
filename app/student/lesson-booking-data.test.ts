import { describe, expect, it, vi } from "vitest";
import { loadLessonBookingData } from "./lesson-booking-data";

const REGULAR_TYPE = { id: "lt-regular", code: "regular", duration_minutes: 120 };
const TRIAL_TYPE = { id: "lt-trial", code: "trial", duration_minutes: 60 };

function makeSupabase(params: {
  enrollments: Array<{ id: string; subject_id: string; status: string; subject: { name: string } }>;
  assignments: Array<{
    id: string;
    subject_enrollment_id: string;
    teacher_id: string;
    status: string;
    effective_from: string;
    effective_until: string | null;
    reason: string | null;
    teacher: { name: string };
  }>;
  hasTrialGrant: boolean;
  sessions?: unknown[];
  reviews?: Array<{ trial_session_id: string; status: string }>;
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === "subject_enrollments") {
        return {
          select: () => ({
            eq: () => ({ order: () => Promise.resolve({ data: params.enrollments }) }),
          }),
        };
      }
      if (table === "teacher_assignments") {
        return {
          select: () => ({
            in: () => ({ order: () => Promise.resolve({ data: params.assignments }) }),
          }),
        };
      }
      if (table === "lesson_types") {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: [REGULAR_TYPE, TRIAL_TYPE] }),
          }),
        };
      }
      if (table === "entitlement_grants") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gt: () => ({
                  maybeSingle: () =>
                    Promise.resolve({ data: params.hasTrialGrant ? { id: "grant1" } : null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "sessions") {
        return { select: () => ({ in: () => ({ order: () => Promise.resolve({ data: params.sessions ?? [] }) }) }) };
      }
      if (table === "lesson_reviews") {
        return { select: () => ({ in: () => Promise.resolve({ data: params.reviews ?? [] }) }) };
      }
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) };
      }
      if (table === "household_members") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

describe("loadLessonBookingData — 체험 학생도 정규수업과 동일하게 직접 예약 가능해야 한다", () => {
  it("정규(active) 수강은 그대로 regular 수업권으로 예약 가능하다", async () => {
    const supabase = makeSupabase({
      enrollments: [{ id: "e1", subject_id: "sub1", status: "active", subject: { name: "SAT Math" } }],
      assignments: [
        {
          id: "a1",
          subject_enrollment_id: "e1",
          teacher_id: "t1",
          status: "active",
          effective_from: "2026-01-01",
          effective_until: null,
          reason: null,
          teacher: { name: "김선생" },
        },
      ],
      hasTrialGrant: false,
    });

    const result = await loadLessonBookingData(supabase as never, "child1");
    expect(result.bookableEnrollments).toEqual([
      {
        subjectEnrollmentId: "e1",
        subjectName: "SAT Math",
        teacherId: "t1",
        teacherName: "김선생",
        lessonTypeId: "lt-regular",
        lessonDurationMinutes: 120,
        isTrial: false,
      },
    ]);
  });

  it("체험(planned) 수강도 선생님이 배정되고 체험수업권이 지급됐으면 학생이 직접 예약할 수 있다", async () => {
    const supabase = makeSupabase({
      enrollments: [{ id: "e2", subject_id: "sub1", status: "planned", subject: { name: "AP Calculus AB" } }],
      assignments: [
        {
          id: "a2",
          subject_enrollment_id: "e2",
          teacher_id: "t2",
          status: "active",
          effective_from: "2026-01-01",
          effective_until: null,
          reason: null,
          teacher: { name: "장선생" },
        },
      ],
      hasTrialGrant: true,
    });

    const result = await loadLessonBookingData(supabase as never, "child2");
    expect(result.bookableEnrollments).toEqual([
      {
        subjectEnrollmentId: "e2",
        subjectName: "AP Calculus AB",
        teacherId: "t2",
        teacherName: "장선생",
        lessonTypeId: "lt-trial",
        lessonDurationMinutes: 60,
        isTrial: true,
      },
    ]);
  });

  it("체험(planned) 수강은 체험수업권이 아직 지급되지 않았어도 예약 후보에는 넣는다(잔여량 검증은 예약 확정 시 hold_entitlement()가 최종 강제, 2026-09-09 UAT 지적)", async () => {
    const supabase = makeSupabase({
      enrollments: [{ id: "e3", subject_id: "sub1", status: "planned", subject: { name: "AP Calculus AB" } }],
      assignments: [
        {
          id: "a3",
          subject_enrollment_id: "e3",
          teacher_id: "t3",
          status: "active",
          effective_from: "2026-01-01",
          effective_until: null,
          reason: null,
          teacher: { name: "이선생" },
        },
      ],
      hasTrialGrant: false,
    });

    const result = await loadLessonBookingData(supabase as never, "child3");
    expect(result.bookableEnrollments).toEqual([
      {
        subjectEnrollmentId: "e3",
        subjectName: "AP Calculus AB",
        teacherId: "t3",
        teacherName: "이선생",
        lessonTypeId: "lt-trial",
        lessonDurationMinutes: 60,
        isTrial: true,
      },
    ]);
  });

  it("선생님 배정이 없으면 상태와 무관하게 예약 후보가 아니다", async () => {
    const supabase = makeSupabase({
      enrollments: [{ id: "e4", subject_id: "sub1", status: "active", subject: { name: "SAT Math" } }],
      assignments: [],
      hasTrialGrant: true,
    });

    const result = await loadLessonBookingData(supabase as never, "child4");
    expect(result.bookableEnrollments).toEqual([]);
  });

  // v3 재매칭 후 예약 결함 수정(2026-09-11, Preview UAT 지적) — 같은 과목으로
  // 이미 종료(terminated)된 수강 이력이 있는 채로 재매칭된 planned 건은 "새
  // 체험 기회"가 아니다. 체험 후보로 보여주지 않고 "정규 계약 대기"로
  // 분리한다(재매칭만으로 체험 기회가 새로 생기면 안 된다는 정책).
  it("같은 과목에 종료된 수강 이력이 있는 재매칭 건은 체험 후보에서 빠지고 정규 계약 대기로 분류된다", async () => {
    const supabase = makeSupabase({
      enrollments: [
        { id: "e-old", subject_id: "sub1", status: "terminated", subject: { name: "SAT Math" } },
        { id: "e-new", subject_id: "sub1", status: "planned", subject: { name: "SAT Math" } },
      ],
      assignments: [
        {
          id: "a-new",
          subject_enrollment_id: "e-new",
          teacher_id: "t1",
          status: "active",
          effective_from: "2026-01-01",
          effective_until: null,
          reason: null,
          teacher: { name: "박선생" },
        },
      ],
      hasTrialGrant: false,
    });

    const result = await loadLessonBookingData(supabase as never, "child5");
    expect(result.bookableEnrollments).toEqual([]);
    expect(result.pendingActivationSubjects).toEqual([
      { subjectEnrollmentId: "e-new", subjectName: "SAT Math", teacherName: "박선생" },
    ]);
  });

  it("종료 이력이 없는 진짜 첫 체험 건은 그대로 체험 후보로 남는다", async () => {
    const supabase = makeSupabase({
      enrollments: [{ id: "e-first", subject_id: "sub1", status: "planned", subject: { name: "SAT Math" } }],
      assignments: [
        {
          id: "a-first",
          subject_enrollment_id: "e-first",
          teacher_id: "t1",
          status: "active",
          effective_from: "2026-01-01",
          effective_until: null,
          reason: null,
          teacher: { name: "박선생" },
        },
      ],
      hasTrialGrant: false,
    });

    const result = await loadLessonBookingData(supabase as never, "child6");
    expect(result.bookableEnrollments.map((b) => b.subjectEnrollmentId)).toEqual(["e-first"]);
    expect(result.pendingActivationSubjects).toEqual([]);
  });
});

// 2026-09-06 — 선생님이 조기 종료(finalize_lesson_session)로 완료 처리한 세션이
// 아직 시작 시각이 안 지났어도 학생 쪽 "지난 수업"으로 넘어가야 한다(제품 오너 지적).
// 체험 수업은 선생님 포털과 동일하게 리뷰 확정 전까지는 "예정 수업"에 남는다.
function makeSessionRow(params: {
  id: string;
  startsAt: string;
  endsAt: string;
  finalStatus: string;
  isTrial?: boolean;
  reservationStatus?: string;
}) {
  return {
    id: params.id,
    subject_enrollment_id: "e1",
    final_status: params.finalStatus,
    lesson_type: params.isTrial ? { code: "trial" } : { code: "regular" },
    reservation: {
      id: `res-${params.id}`,
      starts_at: params.startsAt,
      ends_at: params.endsAt,
      status: params.reservationStatus ?? "confirmed",
      google_meet_link: null,
      google_sync_status: "synced",
    },
    teacher: { name: "김선생" },
    subject_enrollment: { subject: { name: "SAT Math" } },
  };
}

describe("loadLessonBookingData — 예정/지난 판정(final_status 반영, 2026-09-06)", () => {
  const enrollments = [{ id: "e1", subject_id: "sub1", status: "active" as const, subject: { name: "SAT Math" } }];
  const assignments = [
    {
      id: "a1",
      subject_enrollment_id: "e1",
      teacher_id: "t1",
      status: "active",
      effective_from: "2026-01-01",
      effective_until: null,
      reason: null,
      teacher: { name: "김선생" },
    },
  ];

  it("시작 시각이 미래여도 final_status가 completed로 최종판정됐으면 '지난 수업'으로 분류한다", async () => {
    const futureStart = new Date(Date.now() + 3600_000).toISOString();
    const futureEnd = new Date(Date.now() + 7200_000).toISOString();
    const supabase = makeSupabase({
      enrollments,
      assignments,
      hasTrialGrant: false,
      sessions: [makeSessionRow({ id: "s1", startsAt: futureStart, endsAt: futureEnd, finalStatus: "completed" })],
    });

    const result = await loadLessonBookingData(supabase as never, "child1");
    expect(result.upcomingBookings).toEqual([]);
    expect(result.pastSessionsForReport.map((r) => r.sessionId)).toEqual(["s1"]);
  });

  it("아직 final_status가 scheduled/live이고 시작 시각도 안 지났으면 '예정 수업'에 남는다", async () => {
    const futureStart = new Date(Date.now() + 3600_000).toISOString();
    const futureEnd = new Date(Date.now() + 7200_000).toISOString();
    const supabase = makeSupabase({
      enrollments,
      assignments,
      hasTrialGrant: false,
      sessions: [makeSessionRow({ id: "s1", startsAt: futureStart, endsAt: futureEnd, finalStatus: "scheduled" })],
    });

    const result = await loadLessonBookingData(supabase as never, "child1");
    expect(result.upcomingBookings.map((r) => r.sessionId)).toEqual(["s1"]);
    expect(result.pastSessionsForReport).toEqual([]);
  });

  it("체험 수업은 completed로 최종판정돼도 리뷰가 확정(final)되기 전까지는 '예정 수업'에 남는다(선생님 포털과 일관)", async () => {
    const futureStart = new Date(Date.now() + 3600_000).toISOString();
    const futureEnd = new Date(Date.now() + 7200_000).toISOString();
    const trialEnrollments = [{ id: "e1", subject_id: "sub1", status: "planned" as const, subject: { name: "AP Calculus AB" } }];
    const supabase = makeSupabase({
      enrollments: trialEnrollments,
      assignments,
      hasTrialGrant: true,
      sessions: [makeSessionRow({ id: "s1", startsAt: futureStart, endsAt: futureEnd, finalStatus: "completed", isTrial: true })],
      reviews: [{ trial_session_id: "s1", status: "draft" }],
    });

    const result = await loadLessonBookingData(supabase as never, "child1");
    expect(result.upcomingBookings.map((r) => r.sessionId)).toEqual(["s1"]);
    expect(result.pastSessionsForReport).toEqual([]);
  });

  it("체험 수업이 completed + 리뷰 final이면 '지난 수업'으로 넘어간다", async () => {
    const futureStart = new Date(Date.now() + 3600_000).toISOString();
    const futureEnd = new Date(Date.now() + 7200_000).toISOString();
    const trialEnrollments = [{ id: "e1", subject_id: "sub1", status: "planned" as const, subject: { name: "AP Calculus AB" } }];
    const supabase = makeSupabase({
      enrollments: trialEnrollments,
      assignments,
      hasTrialGrant: true,
      sessions: [makeSessionRow({ id: "s1", startsAt: futureStart, endsAt: futureEnd, finalStatus: "completed", isTrial: true })],
      reviews: [{ trial_session_id: "s1", status: "final" }],
    });

    const result = await loadLessonBookingData(supabase as never, "child1");
    expect(result.upcomingBookings).toEqual([]);
    expect(result.pastSessionsForReport.map((r) => r.sessionId)).toEqual(["s1"]);
  });

  // v3 재매칭 후 예약 결함 수정(2026-09-11, Preview UAT 지적) — 리뷰 확정 대기는
  // "완료(completed)돼서 리뷰가 필요한" 체험 수업에만 적용된다. 취소·노쇼 등
  // 다른 최종 판정은 리뷰 대상이 아니므로, 리뷰 미확정을 이유로 계속 "예정
  // 수업"·"수업 시작" 대상에 남아있으면 안 된다.
  it("체험 수업이 completed가 아닌 다른 최종판정(예: student_cancelled)이면 리뷰가 없어도 '지난 수업'으로 넘어간다", async () => {
    const futureStart = new Date(Date.now() + 3600_000).toISOString();
    const futureEnd = new Date(Date.now() + 7200_000).toISOString();
    const trialEnrollments = [{ id: "e1", subject_id: "sub1", status: "planned" as const, subject: { name: "AP Calculus AB" } }];
    const supabase = makeSupabase({
      enrollments: trialEnrollments,
      assignments,
      hasTrialGrant: true,
      sessions: [
        makeSessionRow({ id: "s1", startsAt: futureStart, endsAt: futureEnd, finalStatus: "student_cancelled", isTrial: true }),
      ],
      reviews: [],
    });

    const result = await loadLessonBookingData(supabase as never, "child1");
    expect(result.upcomingBookings).toEqual([]);
    expect(result.pastSessionsForReport.map((r) => r.sessionId)).toEqual(["s1"]);
  });
});
