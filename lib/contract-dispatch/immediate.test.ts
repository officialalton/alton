import { beforeEach, describe, expect, it, vi } from "vitest";

const afterMock = vi.fn();
vi.mock("next/server", () => ({ after: (fn: () => unknown) => afterMock(fn) }));

const enabledState = vi.hoisted(() => ({ value: true }));
const processMock = vi.fn();
vi.mock("./dispatcher", () => ({
  isContractAutoDispatchEnabled: async () => enabledState.value,
  processContractDispatchQueue: (...a: unknown[]) => processMock(...a),
}));

const ADMIN = { from: vi.fn() };
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => ADMIN }));

import { runContractDispatchNow, scheduleContractDispatch } from "./immediate";

beforeEach(() => {
  vi.clearAllMocks();
  enabledState.value = true;
  afterMock.mockImplementation((fn: () => unknown) => void fn());
  processMock.mockResolvedValue({ enabled: true, processed: 1, sent: 1, failed: 0 });
});
describe("scheduleContractDispatch", () => {
  it("비활성이면 워커(발송)를 호출하지 않는다(fail-closed)", async () => {
    enabledState.value = false;
    scheduleContractDispatch({ childIds: ["c1"] });
    await new Promise((r) => setTimeout(r, 10));
    expect(processMock).not.toHaveBeenCalled();
  });

  it("활성이면 after()로 미루고 그 자녀 범위로 워커를 돌린다", async () => {
    scheduleContractDispatch({ childIds: ["c1", "c1", "c2"] });
    expect(afterMock).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(processMock).toHaveBeenCalledWith(ADMIN, { childIds: ["c1", "c2"] }));
  });

  it("요청 컨텍스트 밖(after가 throw)이면 fire-and-forget으로 돌리고 throw하지 않는다", async () => {
    afterMock.mockImplementation(() => {
      throw new Error("outside request scope");
    });
    expect(() => scheduleContractDispatch({ childIds: ["c1"] })).not.toThrow();
    await vi.waitFor(() => expect(processMock).toHaveBeenCalledTimes(1));
  });
});

describe("runContractDispatchNow", () => {
  it("워커 오류를 삼키고 로그만 남긴다", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    processMock.mockRejectedValue(new Error("db down"));
    await expect(runContractDispatchNow({ childIds: ["c1"] })).resolves.toBeUndefined();
    expect(err).toHaveBeenCalledWith(expect.stringContaining("contract_dispatch_immediate_failed"));
    err.mockRestore();
  });

  it("자녀를 찾지 못하면 워커를 돌리지 않는다", async () => {
    ADMIN.from.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { child_id: null } }) }) }),
    });
    await runContractDispatchNow({ consultationId: "x" });
    expect(processMock).not.toHaveBeenCalled();
  });

  it("상담/세션 id에서 child_id를 해석한다", async () => {
    ADMIN.from.mockImplementation((t: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            t === "consultations"
              ? { data: { child_id: "cc" } }
              : { data: { subject_enrollment: { child_id: "cs" } } },
        }),
      }),
    }));
    await runContractDispatchNow({ consultationId: "x", sessionId: "s" });
    expect(processMock).toHaveBeenCalledWith(ADMIN, { childIds: ["cs", "cc"] });
  });
});
