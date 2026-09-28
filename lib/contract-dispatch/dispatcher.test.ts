import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 2026-09-28 — 초기 고객 절차 단순화 4단계: 계약 자동 발송 dispatcher의
// 안전장치(기본 비활성)를 검증한다. 실제 DocuSign 호출(sendRegularContractForSubjectEnrollment)
// 은 모킹해서, CONTRACT_AUTO_DISPATCH_ENABLED가 없거나 "true"가 아니면
// 절대 호출되지 않는지가 핵심이다.

const sendRegularContractMock = vi.fn();
vi.mock("@/lib/regular-contract-send", () => ({
  sendRegularContractForSubjectEnrollment: (...args: unknown[]) => sendRegularContractMock(...args),
}));

const ORIGINAL_ENV = process.env.CONTRACT_AUTO_DISPATCH_ENABLED;

function fakeAdmin(overrides: Record<string, unknown> = {}) {
  const updateEqMock = vi.fn().mockResolvedValue({ error: null });
  return {
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: updateEqMock })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { attempt_count: 0 }, error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          limit: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) })),
        })),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    })),
    auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: null } }) } },
    ...overrides,
  };
}

describe("isContractAutoDispatchEnabled / dispatchOneContractJob — 기본 비활성 안전장치", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CONTRACT_AUTO_DISPATCH_ENABLED;
  });
  afterEach(() => {
    if (ORIGINAL_ENV === undefined) delete process.env.CONTRACT_AUTO_DISPATCH_ENABLED;
    else process.env.CONTRACT_AUTO_DISPATCH_ENABLED = ORIGINAL_ENV;
  });

  it("환경변수가 없으면 isContractAutoDispatchEnabled()는 false다", async () => {
    const { isContractAutoDispatchEnabled } = await import("./dispatcher");
    expect(isContractAutoDispatchEnabled()).toBe(false);
  });

  it("환경변수가 'true'가 아닌 값(예: '1', 'TRUE')이어도 비활성으로 취급한다", async () => {
    process.env.CONTRACT_AUTO_DISPATCH_ENABLED = "1";
    const { isContractAutoDispatchEnabled } = await import("./dispatcher");
    expect(isContractAutoDispatchEnabled()).toBe(false);

    process.env.CONTRACT_AUTO_DISPATCH_ENABLED = "TRUE";
    vi.resetModules();
    const { isContractAutoDispatchEnabled: reloaded } = await import("./dispatcher");
    expect(reloaded()).toBe(false);
  });

  it("비활성 상태에서 dispatchOneContractJob()은 sendRegularContractForSubjectEnrollment를 절대 호출하지 않는다", async () => {
    const { dispatchOneContractJob } = await import("./dispatcher");
    const admin = fakeAdmin();
    const result = await dispatchOneContractJob(admin as never, {
      id: "job-1",
      child_id: "child-1",
      subject_enrollment_id: "se-1",
    });

    expect(result).toEqual({ outcome: "disabled" });
    expect(sendRegularContractMock).not.toHaveBeenCalled();
    // 상태 업데이트조차 시도하지 않는다 — 큐 행은 'queued' 그대로 남는다.
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("비활성 상태에서 processContractDispatchQueue()는 큐를 조회하지도 않고 즉시 반환한다", async () => {
    const { processContractDispatchQueue } = await import("./dispatcher");
    const admin = fakeAdmin();
    const result = await processContractDispatchQueue(admin as never);

    expect(result).toEqual({ enabled: false, processed: 0, sent: 0, failed: 0 });
    expect(sendRegularContractMock).not.toHaveBeenCalled();
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("환경변수가 정확히 'true'면 활성 상태로 판정한다(실제 발송 여부는 이 테스트의 관심사 아님)", async () => {
    process.env.CONTRACT_AUTO_DISPATCH_ENABLED = "true";
    vi.resetModules();
    const { isContractAutoDispatchEnabled } = await import("./dispatcher");
    expect(isContractAutoDispatchEnabled()).toBe(true);
  });
});
