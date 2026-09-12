import { beforeEach, describe, expect, it, vi } from "vitest";

// 계획 문서(2026-09-09-codebase-review-and-performance-diagnosis.md) 4절 P0:
// startMyLessonSession/finalizeMyLessonSession/resolveMyLessonLateness는 정산에
// 직결되는 세션 상태 전이(mark_lesson_session_started/finalize_lesson_session/
// resolve_teacher_lateness RPC 호출)를 감싸는 서버 액션인데 테스트가 전혀 없었다.
// 이 RPC들 자체의 상태머신(정상 전이·잘못된 상태 거부)은 이미
// lib/booking/session-final-judgment.integration.test.ts,
// lib/booking/session-late-and-disruption.integration.test.ts 등에서 DB 레벨로
// 두텁게 검증되므로, 이 파일은 그 위에 얹힌 액션 레이어 — "본인 세션인지
// 재확인" 권한 게이트와 RPC 에러를 예외 없이 {ok:false}로 변환하는 계약을
// app/student/booking-actions.test.ts와 동일한 mock 패턴으로 검증한다.

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({ user: { id: "teacher1" }, supabase: {} }),
}));

const sessionMaybeSingleMock = vi.fn();
const rpcMock = vi.fn();
const adminFromMock = vi.fn((table: string) => {
  if (table === "sessions") {
    return { select: () => ({ eq: () => ({ maybeSingle: sessionMaybeSingleMock }) }) };
  }
  throw new Error(`unexpected admin table ${table}`);
});
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: adminFromMock, rpc: rpcMock }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  sessionMaybeSingleMock.mockResolvedValue({ data: { teacher_id: "teacher1" } });
  rpcMock.mockResolvedValue({ error: null });
});

describe("startMyLessonSession", () => {
  it("본인 세션이면 mark_lesson_session_started를 호출하고 ok:true를 반환한다(정상 경로)", async () => {
    const { startMyLessonSession } = await import("./lesson-schedule-actions");
    const result = await startMyLessonSession("s1");
    expect(result).toEqual({ ok: true });
    expect(rpcMock).toHaveBeenCalledWith("mark_lesson_session_started", {
      p_session_id: "s1",
      p_actor_id: "teacher1",
    });
  });

  it("본인 세션이 아니면 RPC를 호출하지 않고 거부한다(권한 거부)", async () => {
    sessionMaybeSingleMock.mockResolvedValue({ data: { teacher_id: "other-teacher" } });
    const { startMyLessonSession } = await import("./lesson-schedule-actions");
    const result = await startMyLessonSession("s1");
    expect(result).toEqual({ ok: false, error: "본인 수업만 시작할 수 있습니다." });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("세션이 존재하지 않으면 RPC를 호출하지 않고 거부한다", async () => {
    sessionMaybeSingleMock.mockResolvedValue({ data: null });
    const { startMyLessonSession } = await import("./lesson-schedule-actions");
    const result = await startMyLessonSession("missing");
    expect(result).toEqual({ ok: false, error: "본인 수업만 시작할 수 있습니다." });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("RPC가 잘못된 상태 전이를 거부하면 예외를 던지지 않고 ok:false로 변환한다(잘못된 상태)", async () => {
    rpcMock.mockResolvedValue({ error: { message: "scheduled 상태의 세션만 시작할 수 있습니다. 현재 상태: live" } });
    const { startMyLessonSession } = await import("./lesson-schedule-actions");
    const result = await startMyLessonSession("s1");
    expect(result).toEqual({ ok: false, error: "scheduled 상태의 세션만 시작할 수 있습니다. 현재 상태: live" });
  });
});

describe("finalizeMyLessonSession", () => {
  it("본인 세션이면 finalize_lesson_session을 필요한 파라미터와 함께 호출한다(정상 경로)", async () => {
    const { finalizeMyLessonSession } = await import("./lesson-schedule-actions");
    const result = await finalizeMyLessonSession({
      sessionId: "s1",
      outcome: "completed",
      reason: "정상 종료",
    });
    expect(result).toEqual({ ok: true });
    expect(rpcMock).toHaveBeenCalledWith("finalize_lesson_session", {
      p_session_id: "s1",
      p_outcome: "completed",
      p_actor_id: "teacher1",
      p_reason: "정상 종료",
      p_teacher_fault_provided_minutes: null,
      p_early_end_reason: null,
    });
  });

  it("본인 세션이 아니면 RPC를 호출하지 않고 거부한다(권한 거부)", async () => {
    sessionMaybeSingleMock.mockResolvedValue({ data: { teacher_id: "other-teacher" } });
    const { finalizeMyLessonSession } = await import("./lesson-schedule-actions");
    const result = await finalizeMyLessonSession({ sessionId: "s1", outcome: "completed", reason: "종료" });
    expect(result).toEqual({ ok: false, error: "본인 수업만 종료할 수 있습니다." });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("RPC가 잘못된 상태 전이를 거부하면 ok:false로 변환한다(잘못된 상태)", async () => {
    rpcMock.mockResolvedValue({ error: { message: "이미 종료된 세션입니다." } });
    const { finalizeMyLessonSession } = await import("./lesson-schedule-actions");
    const result = await finalizeMyLessonSession({ sessionId: "s1", outcome: "student_no_show", reason: "노쇼" });
    expect(result).toEqual({ ok: false, error: "이미 종료된 세션입니다." });
  });
});

describe("resolveMyLessonLateness", () => {
  it("본인 세션이면 resolve_teacher_lateness를 필요한 파라미터와 함께 호출한다(정상 경로)", async () => {
    const { resolveMyLessonLateness } = await import("./lesson-schedule-actions");
    const result = await resolveMyLessonLateness({
      sessionId: "s1",
      lateMinutes: 10,
      agreedExtendMinutes: 10,
      reason: "지각 합의 연장",
    });
    expect(result).toEqual({ ok: true });
    expect(rpcMock).toHaveBeenCalledWith("resolve_teacher_lateness", {
      p_session_id: "s1",
      p_late_minutes: 10,
      p_agreed_extend_minutes: 10,
      p_actor_id: "teacher1",
      p_reason: "지각 합의 연장",
    });
  });

  it("본인 세션이 아니면 RPC를 호출하지 않고 거부한다(권한 거부)", async () => {
    sessionMaybeSingleMock.mockResolvedValue({ data: { teacher_id: "other-teacher" } });
    const { resolveMyLessonLateness } = await import("./lesson-schedule-actions");
    const result = await resolveMyLessonLateness({
      sessionId: "s1",
      lateMinutes: 10,
      agreedExtendMinutes: 10,
      reason: "지각 합의 연장",
    });
    expect(result).toEqual({ ok: false, error: "본인 수업만 연장할 수 있습니다." });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("RPC가 잘못된 상태(이미 live가 아닌 세션 등)를 거부하면 ok:false로 변환한다(잘못된 상태)", async () => {
    rpcMock.mockResolvedValue({ error: { message: "live 상태의 세션만 지각 처리를 연장할 수 있습니다." } });
    const { resolveMyLessonLateness } = await import("./lesson-schedule-actions");
    const result = await resolveMyLessonLateness({
      sessionId: "s1",
      lateMinutes: 10,
      agreedExtendMinutes: 10,
      reason: "지각 합의 연장",
    });
    expect(result).toEqual({ ok: false, error: "live 상태의 세션만 지각 처리를 연장할 수 있습니다." });
  });
});
