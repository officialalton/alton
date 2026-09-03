import { describe, expect, it, vi } from "vitest";

// M2 — retryTrialEntitlementGrant()의 얇은 서버 액션 래퍼만 검증한다(실제 지급 로직·
// idempotency·정규/체험 오사용 방지는 supabase/migrations/20261012000000_m2_trial_entitlement.sql의
// SQL 함수 책임이고, 그 계약은 로컬 dev DB에 대한 psql 실측으로 검증했다 — 실행 로그
// docs/2026-09-03-m2-migration-execution-log.md 참고). 여기서는 requireAdmin() 게이트 +
// RPC 호출 경계만 회귀 대상으로 삼는다.

const rpcMock = vi.fn();

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ supabase: { rpc: rpcMock }, actorUserId: "admin1" }),
  requireAdminOrCapability: vi.fn().mockResolvedValue({ supabase: { rpc: rpcMock }, actorUserId: "admin1" }),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: vi.fn(() => ({ rpc: rpcMock, from: vi.fn() })),
}));

vi.mock("@/lib/consultation/calendar-sync", () => ({
  syncOneConsultationCalendarEvent: vi.fn(),
  cancelSyncedConsultationCalendarEvent: vi.fn(),
  processPendingConsultationCalendarSyncs: vi.fn(),
  retrySmartNotesConfigForConsultation: vi.fn(),
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
});
