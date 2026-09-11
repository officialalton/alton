import { describe, expect, it, vi } from "vitest";
import { loadLessonBookingData } from "./lesson-booking-data";

const REGULAR_TYPE = { id: "lt-regular", code: "regular", duration_minutes: 120 };
const TRIAL_TYPE = { id: "lt-trial", code: "trial", duration_minutes: 60 };

type GrantRow = { id: string; lessonTypeCode: "trial" | "regular"; remaining: number };

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
  grants?: GrantRow[];
  activationReadyByEnrollmentId?: Record<string, boolean>;
  sessions?: unknown[];
  reviews?: Array<{ trial_session_id: string; status: string }>;
}) {
  const grants = params.grants ?? [];
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
              gt: () =>
                Promise.resolve({
                  data: grants.map((g) => ({
                    id: g.id,
                    entitlement_product: {
                      entitlement_type: { lesson_type: { code: g.lessonTypeCode } },
                    },
                  })),
                }),
            }),
          }),
        };
      }
      if (table === "entitlement_ledger") {
        return {
          select: () => ({
            in: () =>
              Promise.resolve({
                data: grants.map((g) => ({ grant_id: g.id, amount: g.remaining })),
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
    rpc: vi.fn((fn: string, args: { p_subject_enrollment_id: string }) => {
      if (fn === "subject_enrollment_activation_ready") {
        return Promise.resolve({
          data: params.activationReadyByEnrollmentId?.[args.p_subject_enrollment_id] ?? false,
        });
      }
      throw new Error(`unexpected rpc ${fn}`);
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
    expect(result.pendingActivationSubjects).toEqual([]);
  });

  it("체험(planned) 수강은 실제 체험수업권 잔량이 있으면 학생이 직접 예약할 수 있다", async () => {
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
      grants: [{ id: "g1", lessonTypeCode: "trial", remaining: 1 }],
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
    expect(result.pendingActivationSubjects).toEqual([]);
  });

  it("선생님 배정이 없으면 상태와 무관하게 예약 후보가 아니다", async () => {
    const supabase = makeSupabase({
      enrollments: [{ id: "e4", subject_id: "sub1", status: "active", subject: { name: "SAT Math" } }],
      assignments: [],
    });

    const result = await loadLessonBookingData(supabase as never, "child4");
    expect(result.bookableEnrollments).toEqual([]);
  });
});

// v3 재매칭 후 예약 결함 수정(2026-09-11, 2차 보완) — 체험/정규 후보 판정과
// "정규 계약 대기" 안내는 종료 이력 같은 대리 지표가 아니라 실제 체험수업권
// 잔량(entitlement_grants/entitlement_ledger)과 기존 활성화 판정 경로
// (subject_enrollment_activation_ready, R5/M4)만 근거로 삼는다.
describe("loadLessonBookingData — 재매칭 건의 실제 차단 사유 판정(2026-09-11 2차 보완)", () => {
  const planned = [{ id: "e-new", subject_id: "sub1", status: "planned" as const, subject: { name: "SAT Math" } }];
  const assignments = [
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
  ];

  it("체험수업권이 소진됐고 계약도 아직 active가 아니면 '정규 계약 대기'로 분류한다", async () => {
    const supabase = makeSupabase({
      enrollments: planned,
      assignments,
      grants: [{ id: "g-used", lessonTypeCode: "trial", remaining: 0 }],
      activationReadyByEnrollmentId: { "e-new": false },
    });

    const result = await loadLessonBookingData(supabase as never, "child5");
    expect(result.bookableEnrollments).toEqual([]);
    expect(result.pendingActivationSubjects).toEqual([
      { subjectEnrollmentId: "e-new", subjectName: "SAT Math", teacherName: "박선생", reason: "contract_pending" },
    ]);
  });

  it("계약은 active인데 정규 수업권이 없으면 '수업권 없음'으로 분류한다(체험도 이미 소진)", async () => {
    const supabase = makeSupabase({
      enrollments: planned,
      assignments,
      grants: [{ id: "g-used", lessonTypeCode: "trial", remaining: 0 }],
      activationReadyByEnrollmentId: { "e-new": true },
    });

    const result = await loadLessonBookingData(supabase as never, "child6");
    expect(result.bookableEnrollments).toEqual([]);
    expect(result.pendingActivationSubjects).toEqual([
      { subjectEnrollmentId: "e-new", subjectName: "SAT Math", teacherName: "박선생", reason: "no_entitlement" },
    ]);
  });

  it("계약도 active이고 정규 수업권도 있으면 '활성화 처리 대기'로 구분한다(수업권 없음으로 잘못 안내하지 않음)", async () => {
    const supabase = makeSupabase({
      enrollments: planned,
      assignments,
      grants: [
        { id: "g-used", lessonTypeCode: "trial", remaining: 0 },
        { id: "g-regular", lessonTypeCode: "regular", remaining: 5 },
      ],
      activationReadyByEnrollmentId: { "e-new": true },
    });

    const result = await loadLessonBookingData(supabase as never, "child7");
    expect(result.bookableEnrollments).toEqual([]);
    expect(result.pendingActivationSubjects).toEqual([
      { subjectEnrollmentId: "e-new", subjectName: "SAT Math", teacherName: "박선생", reason: "activation_pending" },
    ]);
  });

  it("재매칭 건이라도 체험수업권이 아직 남아있으면(미사용) 정상적으로 체험 후보로 남는다 — 종료 이력만으로 체험 기회를 없애지 않는다", async () => {
    const supabase = makeSupabase({
      enrollments: [
        { id: "e-old", subject_id: "sub1", status: "terminated", subject: { name: "SAT Math" } },
        ...planned,
      ],
      assignments,
      grants: [{ id: "g-unused", lessonTypeCode: "trial", remaining: 1 }],
    });

    const result = await loadLessonBookingData(supabase as never, "child8");
    expect(result.bookableEnrollments.map((b) => b.subjectEnrollmentId)).toEqual(["e-new"]);
    expect(result.pendingActivationSubjects).toEqual([]);
  });

  it("체험수업권을 지급받은 적이 없어도(잔량 0) 이 수강 건에 이미 예약해둔(hold 상태) 체험이 있으면 후보로 남아 '이미 예약함' 안내를 이어갈 수 있다", async () => {
    const futureStart = new Date(Date.now() + 3600_000).toISOString();
    const futureEnd = new Date(Date.now() + 7200_000).toISOString();
    const supabase = makeSupabase({
      enrollments: planned,
      assignments,
      grants: [{ id: "g-held", lessonTypeCode: "trial", remaining: 0 }], // hold로 잔량 0
      sessions: [
        {
          id: "s1",
          subject_enrollment_id: "e-new",
          final_status: "scheduled",
          lesson_type: { code: "trial" },
          reservation: {
            id: "res-s1",
            starts_at: futureStart,
            ends_at: futureEnd,
            status: "confirmed",
            google_meet_link: null,
            google_sync_status: "synced",
          },
          teacher: { name: "박선생" },
          subject_enrollment: { subject: { name: "SAT Math" } },
        },
      ],
    });

    const result = await loadLessonBookingData(supabase as never, "child9");
    expect(result.bookableEnrollments.map((b) => b.subjectEnrollmentId)).toEqual(["e-new"]);
    expect(result.pendingActivationSubjects).toEqual([]);
  });
});

// 2026-09-06 — 선생님이 조기 종료(finalize_lesson_session)로 완료 처리한 세션이
// 아직 시작 시각이 안 지났어도 학생 쪽 "지난 수업"으로 넘어가야 한다(제품 오너 지적).
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

describe("loadLessonBookingData — 예정/지난 판정(final_status 반영, 2026-09-06, 2026-09-11 2차 보완)", () => {
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
      sessions: [makeSessionRow({ id: "s1", startsAt: futureStart, endsAt: futureEnd, finalStatus: "scheduled" })],
    });

    const result = await loadLessonBookingData(supabase as never, "child1");
    expect(result.upcomingBookings.map((r) => r.sessionId)).toEqual(["s1"]);
    expect(result.pastSessionsForReport).toEqual([]);
  });

  // 2026-09-11(2차 보완, 제품 오너 지시) — 완료된 수업은 리뷰 작성 여부와
  // 무관하게 "지난 수업"으로 분류한다. 예전에는 체험 수업이면 리뷰 확정
  // 전까지 "예정 수업"·"수업 시작" 대상에 계속 남겨뒀다 — 리뷰가 필요하면
  // needsReview 플래그로만 표시한다.
  it("체험 수업이 completed로 최종판정되면 리뷰가 아직 확정 전이어도 '지난 수업'으로 분류하고 needsReview=true로 표시한다", async () => {
    const futureStart = new Date(Date.now() + 3600_000).toISOString();
    const futureEnd = new Date(Date.now() + 7200_000).toISOString();
    const trialEnrollments = [{ id: "e1", subject_id: "sub1", status: "planned" as const, subject: { name: "AP Calculus AB" } }];
    const supabase = makeSupabase({
      enrollments: trialEnrollments,
      assignments,
      grants: [{ id: "g1", lessonTypeCode: "trial", remaining: 1 }],
      sessions: [makeSessionRow({ id: "s1", startsAt: futureStart, endsAt: futureEnd, finalStatus: "completed", isTrial: true })],
      reviews: [{ trial_session_id: "s1", status: "draft" }],
    });

    const result = await loadLessonBookingData(supabase as never, "child1");
    expect(result.upcomingBookings).toEqual([]);
    expect(result.pastSessionsForReport).toEqual([
      { sessionId: "s1", subjectName: "SAT Math", teacherName: "김선생", startsAt: futureStart, needsReview: true },
    ]);
  });

  it("체험 수업이 completed + 리뷰 final이면 needsReview=false로 '지난 수업'에 있다", async () => {
    const futureStart = new Date(Date.now() + 3600_000).toISOString();
    const futureEnd = new Date(Date.now() + 7200_000).toISOString();
    const trialEnrollments = [{ id: "e1", subject_id: "sub1", status: "planned" as const, subject: { name: "AP Calculus AB" } }];
    const supabase = makeSupabase({
      enrollments: trialEnrollments,
      assignments,
      grants: [{ id: "g1", lessonTypeCode: "trial", remaining: 1 }],
      sessions: [makeSessionRow({ id: "s1", startsAt: futureStart, endsAt: futureEnd, finalStatus: "completed", isTrial: true })],
      reviews: [{ trial_session_id: "s1", status: "final" }],
    });

    const result = await loadLessonBookingData(supabase as never, "child1");
    expect(result.upcomingBookings).toEqual([]);
    expect(result.pastSessionsForReport).toEqual([
      { sessionId: "s1", subjectName: "SAT Math", teacherName: "김선생", startsAt: futureStart, needsReview: false },
    ]);
  });

  it("체험 수업이 completed가 아닌 다른 최종판정(예: student_cancelled)이면 needsReview=false로 '지난 수업'으로 넘어간다", async () => {
    const futureStart = new Date(Date.now() + 3600_000).toISOString();
    const futureEnd = new Date(Date.now() + 7200_000).toISOString();
    const trialEnrollments = [{ id: "e1", subject_id: "sub1", status: "planned" as const, subject: { name: "AP Calculus AB" } }];
    const supabase = makeSupabase({
      enrollments: trialEnrollments,
      assignments,
      grants: [{ id: "g1", lessonTypeCode: "trial", remaining: 1 }],
      sessions: [
        makeSessionRow({ id: "s1", startsAt: futureStart, endsAt: futureEnd, finalStatus: "student_cancelled", isTrial: true }),
      ],
      reviews: [],
    });

    const result = await loadLessonBookingData(supabase as never, "child1");
    expect(result.upcomingBookings).toEqual([]);
    expect(result.pastSessionsForReport).toEqual([
      { sessionId: "s1", subjectName: "SAT Math", teacherName: "김선생", startsAt: futureStart, needsReview: false },
    ]);
  });
});
