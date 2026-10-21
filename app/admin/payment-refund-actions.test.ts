import { beforeEach, describe, expect, it, vi } from "vitest";

const requireMock = vi.fn();
vi.mock("@/lib/admin-auth", () => ({ requireAdminOrCapability: (...a: unknown[]) => requireMock(...a) }));

const rpcMock = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => ({ rpc: rpcMock }) }));

const loadMock = vi.fn();
vi.mock("./payment-refund-data", () => ({ loadPaymentRefundBoard: (...a: unknown[]) => loadMock(...a) }));

import { listPaymentRefundBoard, resolvePaymentRefund, resolvePaymentWebhookIssue } from "./payment-refund-actions";

beforeEach(() => {
  vi.clearAllMocks();
  requireMock.mockResolvedValue({ actorUserId: "admin1" });
  rpcMock.mockResolvedValue({ data: { ok: true }, error: null });
});

describe("payment-refund-actions", () => {
  it("모든 액션은 관리자/manage_payments 권한 검사를 먼저 한다(거부되면 DB 호출 없음)", async () => {
    requireMock.mockRejectedValue(new Error("forbidden"));
    await expect(listPaymentRefundBoard()).rejects.toThrow("forbidden");
    await expect(resolvePaymentRefund({ refundId: "r", action: "revoke", note: "x" })).rejects.toThrow("forbidden");
    await expect(resolvePaymentWebhookIssue({ issueId: "i", note: "x" })).rejects.toThrow("forbidden");
    expect(rpcMock).not.toHaveBeenCalled();
    expect(loadMock).not.toHaveBeenCalled();
    expect(requireMock).toHaveBeenCalledWith("manage_payments");
  });

  it("수동 회수는 DB RPC 로 처리자·사유를 넘긴다(기존 refund_entitlement 재사용은 RPC 내부)", async () => {
    await resolvePaymentRefund({ refundId: "r1", action: "revoke", note: "  확인  " });
    expect(rpcMock).toHaveBeenCalledWith("resolve_payment_refund", {
      p_refund_id: "r1",
      p_admin: "admin1",
      p_action: "revoke",
      p_note: "확인",
    });
  });

  it("사유가 비어 있으면 RPC 를 호출하지 않는다", async () => {
    await expect(resolvePaymentRefund({ refundId: "r1", action: "dismiss", note: "  " })).rejects.toThrow("사유");
    await expect(resolvePaymentWebhookIssue({ issueId: "i", note: "" })).rejects.toThrow("사유");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("이미 처리된 기록은 친화적 메시지로 거부된다(중복 처리 방지)", async () => {
    rpcMock.mockResolvedValue({ data: { ok: false, reason: "already_handled" }, error: null });
    await expect(resolvePaymentRefund({ refundId: "r1", action: "revoke", note: "x" })).rejects.toThrow("이미 처리된");
  });

  it("구매 미연결 환불의 회수 시도는 거부 메시지", async () => {
    rpcMock.mockResolvedValue({ data: { ok: false, reason: "no_purchase" }, error: null });
    await expect(resolvePaymentRefund({ refundId: "r1", action: "revoke", note: "x" })).rejects.toThrow("확인 완료");
  });

  it("DB 오류(미래 예약으로 중단 등)는 그대로 전달한다", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "미래 예약이 있어 환불을 진행할 수 없습니다." } });
    await expect(resolvePaymentRefund({ refundId: "r1", action: "revoke", note: "x" })).rejects.toThrow("미래 예약");
  });

  it("웹훅 이상 해결은 처리자와 사유를 남긴다", async () => {
    await resolvePaymentWebhookIssue({ issueId: "i1", note: "재전송 완료" });
    expect(rpcMock).toHaveBeenCalledWith("resolve_payment_webhook_issue", {
      p_issue_id: "i1",
      p_admin: "admin1",
      p_note: "재전송 완료",
    });
  });
});
