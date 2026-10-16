import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdminMock, rpcMock } = vi.hoisted(() => ({ requireAdminMock: vi.fn(), rpcMock: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/contract-dispatch/dispatcher", () => ({
  dispatchOneContractJob: vi.fn(),
  isContractAutoDispatchEnabled: vi.fn(),
  processContractDispatchQueue: vi.fn(),
}));
vi.mock("@/lib/select-in-chunks", () => ({ selectInChunks: vi.fn() }));

import { setContractAutoDispatchEnabledAction } from "./contract-dispatch-actions";

describe("setContractAutoDispatchEnabledAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({ supabase: { rpc: rpcMock } });
    rpcMock.mockResolvedValue({ error: null });
  });
  it("관리자 아니면 거부하고 RPC를 부르지 않는다", async () => {
    requireAdminMock.mockRejectedValue(new Error("관리자만 사용할 수 있습니다."));
    await expect(setContractAutoDispatchEnabledAction(true)).rejects.toThrow("관리자만");
    expect(rpcMock).not.toHaveBeenCalled();
  });
  it("RPC로 설정을 바꾼다", async () => {
    await setContractAutoDispatchEnabledAction(false);
    expect(rpcMock).toHaveBeenCalledWith("set_contract_auto_dispatch_enabled", { p_enabled: false });
  });
  it("RPC 오류는 throw", async () => {
    rpcMock.mockResolvedValue({ error: { message: "nope" } });
    await expect(setContractAutoDispatchEnabledAction(true)).rejects.toThrow("nope");
  });
});
