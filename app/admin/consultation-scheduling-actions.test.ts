import { describe, expect, it, vi } from "vitest";

// M2 — retryTrialEntitlementGrant()의 얇은 서버 액션 래퍼만 검증한다(실제 지급 로직·
// idempotency·정규/체험 오사용 방지는 supabase/migrations/20261012000000_m2_trial_entitlement.sql의
// SQL 함수 책임이고, 그 계약은 로컬 dev DB에 대한 psql 실측으로 검증했다 — 실행 로그
// docs/2026-09-03-m2-migration-execution-log.md 참고). 여기서는 requireAdmin() 게이트 +
// RPC 호출 경계만 회귀 대상으로 삼는다.

const rpcMock = vi.fn();

const scheduleDispatchMock = vi.fn();
vi.mock("@/lib/contract-dispatch/immediate", () => ({
  scheduleContractDispatch: (...a: unknown[]) => scheduleDispatchMock(...a),
}));

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ supabase: { rpc: rpcMock }, actorUserId: "admin1" }),
  requireAdminOrConsultant: vi.fn().mockResolvedValue({ supabase: { rpc: rpcMock }, actorUserId: "admin1", role: "admin" }),
  requireAdminOrCapability: vi.fn().mockResolvedValue({ supabase: { rpc: rpcMock }, actorUserId: "admin1" }),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: vi.fn(() => ({ rpc: rpcMock, from: vi.fn() })),
}));

vi.mock("@/lib/consultation/calendar-sync", () => ({
  syncOneConsultationCalendarEvent: vi.fn(),
  cancelSyncedConsultationCalendarEvent: vi.fn(),
  processPendingConsultationCalendarSyncs: vi.fn(),
  adminForceResyncConsultationCalendar: vi.fn(),
  reprocessUnlinkedSmartNotesEvents: vi.fn(),
}));

vi.mock("@/lib/consultation/notifications", () => ({
  sendConsultationRejectionEmail: vi.fn(),
}));

describe("retryTrialEntitlementGrant", () => {
  it("관리자 인증을 거쳐 admin_retry_trial_entitlement_grant RPC를 호출한다", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    const { retryTrialEntitlementGrant } = await import("./consultation-scheduling-actions");

    await retryTrialEntitlementGrant("consult-1");

    expect(rpcMock).toHaveBeenCalledWith("admin_retry_trial_entitlement_grant", {
      p_consultation_id: "consult-1",
    });
  });

  it("RPC 에러를 그대로 던진다(친화적 메시지로 감싸지 않음 — 관리자 전용 재처리 버튼)", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "상담 신청을 찾을 수 없습니다: x" } });
    const { retryTrialEntitlementGrant } = await import("./consultation-scheduling-actions");

    await expect(retryTrialEntitlementGrant("missing")).rejects.toThrow("상담 신청을 찾을 수 없습니다: x");
  });
});

describe("recordConsultationOutcome", () => {
  it("outcome=trial_recommended를 그대로 RPC에 전달한다(지급은 서버 함수 내부에서 연쇄 처리)", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    const { recordConsultationOutcome } = await import("./consultation-scheduling-actions");

    await recordConsultationOutcome({
      consultationId: "consult-1",
      outcome: "trial_recommended",
      notes: "메모",
      adminReviewSummary: "요약",
    });

    expect(rpcMock).toHaveBeenCalledWith("admin_record_consultation_outcome", {
      p_consultation_id: "consult-1",
      p_outcome: "trial_recommended",
      p_notes: "메모",
      p_admin_review_summary: "요약",
    });
  });

  // 2026-09-07 — "정규 진행 권장" 선택 시 "Minified React error #441" 마스킹 재현
  // 조사 중, RPC 에러를 그대로 throw하던 것이 이 프로젝트 전역 규칙(workspace-actions.ts,
  // trial-onboarding-actions.ts, lesson-schedule-actions.ts와 동일)에서 벗어나 있음을
  // 확인하고 { ok, error } 반환으로 통일했다. outcome 값과 무관하게 RPC 에러가
  // 예외로 전파되지 않고 항상 { ok: false, error } 형태로 돌아오는지 검증한다.
  it("RPC 에러를 던지지 않고 { ok: false, error } 형태로 반환한다(outcome=regular_recommended)", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "동의 확인이 완료되지 않아 상담 결과를 기록할 수 없습니다." } });
    const { recordConsultationOutcome } = await import("./consultation-scheduling-actions");

    const result = await recordConsultationOutcome({
      consultationId: "consult-2",
      outcome: "regular_recommended",
      notes: "",
      adminReviewSummary: "정규 진행 권장 요약",
    });

    expect(result).toEqual({
      ok: false,
      error: "동의 확인이 완료되지 않아 상담 결과를 기록할 수 없습니다.",
    });
  });

  it("성공 시 { ok: true }를 반환한다(outcome=regular_recommended)", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    const { recordConsultationOutcome } = await import("./consultation-scheduling-actions");

    const result = await recordConsultationOutcome({
      consultationId: "consult-3",
      outcome: "regular_recommended",
      notes: "",
      adminReviewSummary: "정규 진행 권장 요약",
    });

    expect(result).toEqual({ ok: true });
  });

  it("requireAdmin()이 throw해도(비관리자) 예외를 전파하지 않고 { ok: false, error }로 반환한다", async () => {
    const { requireAdminOrConsultant } = await import("@/lib/admin-auth");
    vi.mocked(requireAdminOrConsultant).mockRejectedValueOnce(new Error("관리자 또는 담당 컨설턴트만 사용할 수 있습니다."));
    const { recordConsultationOutcome } = await import("./consultation-scheduling-actions");

    const result = await recordConsultationOutcome({
      consultationId: "consult-4",
      outcome: "regular_recommended",
      notes: "",
      adminReviewSummary: "요약",
    });

    expect(result).toEqual({ ok: false, error: "관리자 또는 담당 컨설턴트만 사용할 수 있습니다." });
  });
});

describe("recordConsultationOutcome — 계약 즉시 발송 훅", () => {
  const base = { consultationId: "consult-9", notes: "", adminReviewSummary: "" };
  it("regular_recommended 성공 후 상담 기준으로 즉시 발송을 예약한다", async () => {
    scheduleDispatchMock.mockClear();
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    const { recordConsultationOutcome } = await import("./consultation-scheduling-actions");
    const r = await recordConsultationOutcome({ ...base, outcome: "regular_recommended" });
    expect(r).toEqual({ ok: true });
    expect(scheduleDispatchMock).toHaveBeenCalledWith({ consultationId: "consult-9" });
  });
  it("다른 outcome이나 RPC 실패에서는 예약하지 않는다", async () => {
    scheduleDispatchMock.mockClear();
    const { recordConsultationOutcome } = await import("./consultation-scheduling-actions");
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    await recordConsultationOutcome({ ...base, outcome: "on_hold" });
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "x" } });
    const r = await recordConsultationOutcome({ ...base, outcome: "regular_recommended" });
    expect(r.ok).toBe(false);
    expect(scheduleDispatchMock).not.toHaveBeenCalled();
  });
});

describe("rejectConsultationRequest — 확정된 상담을 거절하면 Google 일정도 바로 지운다", () => {
  it("RPC 성공 뒤 cancelSyncedConsultationCalendarEvent 를 호출하고 거절 메일을 보낸다", async () => {
    const { cancelSyncedConsultationCalendarEvent } = await import("@/lib/consultation/calendar-sync");
    const { sendConsultationRejectionEmail } = await import("@/lib/consultation/notifications");
    vi.mocked(cancelSyncedConsultationCalendarEvent).mockClear();
    rpcMock.mockResolvedValueOnce({ data: { contact_name: "김", contact_email: "k@example.com" }, error: null });
    const { rejectConsultationRequest } = await import("./consultation-scheduling-actions");
    await rejectConsultationRequest("consult-r1", "사유");
    expect(cancelSyncedConsultationCalendarEvent).toHaveBeenCalledWith("consult-r1");
    expect(sendConsultationRejectionEmail).toHaveBeenCalled();
  });

  it("Calendar 정리가 실패해도 거절 자체는 성공한다", async () => {
    const { cancelSyncedConsultationCalendarEvent } = await import("@/lib/consultation/calendar-sync");
    vi.mocked(cancelSyncedConsultationCalendarEvent).mockRejectedValueOnce(new Error("google down"));
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    const { rejectConsultationRequest } = await import("./consultation-scheduling-actions");
    await expect(rejectConsultationRequest("consult-r2", "사유")).resolves.toBeUndefined();
  });
});
