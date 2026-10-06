import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 2026-09-28 — 초기 고객 절차 단순화 4단계: 계약 자동 발송 dispatcher의
// 안전장치(기본 비활성)를 검증한다. 실제 DocuSign 호출(sendRegularContractForSubjectEnrollment)
// 은 모킹해서, CONTRACT_AUTO_DISPATCH_ENABLED가 없거나 "true"가 아니면
// 절대 호출되지 않는지가 핵심이다.

const sendRegularContractMock = vi.fn();
vi.mock("@/lib/regular-contract-send", () => ({
  CONTRACT_SEND_IN_PROGRESS_ERROR: "같은 자녀의 다른 계약 발송이 진행 중입니다. 잠시 후 다시 시도해 주세요.",
  sendRegularContractForSubjectEnrollment: (...args: unknown[]) => sendRegularContractMock(...args),
}));

const ORIGINAL_ENV = process.env.CONTRACT_AUTO_DISPATCH_ENABLED;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

function settingAdmin(result: { data?: unknown; error?: { message: string } | null } | "throw") {
  const maybeSingle = vi.fn(async () => {
    if (result === "throw") throw new Error("boom");
    return { data: result.data ?? null, error: result.error ?? null };
  });
  const from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }));
  return { from, auth: { admin: { getUserById: vi.fn() } } };
}

describe("isContractAutoDispatchEnabled — DB 설정 + env 비상 정지 + fail-safe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CONTRACT_AUTO_DISPATCH_ENABLED;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (ORIGINAL_ENV === undefined) delete process.env.CONTRACT_AUTO_DISPATCH_ENABLED;
    else process.env.CONTRACT_AUTO_DISPATCH_ENABLED = ORIGINAL_ENV;
  });

  it("DB 설정이 켜짐이면 env가 없어도 true", async () => {
    const { isContractAutoDispatchEnabled } = await import("./dispatcher");
    expect(await isContractAutoDispatchEnabled(settingAdmin({ data: { auto_dispatch_enabled: true } }) as never)).toBe(true);
  });
  it("DB 설정이 꺼짐이면 false", async () => {
    const { isContractAutoDispatchEnabled } = await import("./dispatcher");
    expect(await isContractAutoDispatchEnabled(settingAdmin({ data: { auto_dispatch_enabled: false } }) as never)).toBe(false);
  });
  it("env가 정확히 'false'면 DB가 켜짐이어도 false(DB는 읽지도 않는다)", async () => {
    process.env.CONTRACT_AUTO_DISPATCH_ENABLED = "false";
    const { isContractAutoDispatchEnabled } = await import("./dispatcher");
    const admin = settingAdmin({ data: { auto_dispatch_enabled: true } });
    expect(await isContractAutoDispatchEnabled(admin as never)).toBe(false);
    expect(admin.from).not.toHaveBeenCalled();
  });
  it("env가 'true'여도 DB가 꺼짐이면 false(env는 켜는 힘이 없다)", async () => {
    process.env.CONTRACT_AUTO_DISPATCH_ENABLED = "true";
    const { isContractAutoDispatchEnabled } = await import("./dispatcher");
    expect(await isContractAutoDispatchEnabled(settingAdmin({ data: { auto_dispatch_enabled: false } }) as never)).toBe(false);
  });
  it("DB 조회 오류·예외·행 없음이면 비활성 + 로그", async () => {
    const { isContractAutoDispatchEnabled } = await import("./dispatcher");
    expect(await isContractAutoDispatchEnabled(settingAdmin({ error: { message: "x" } }) as never)).toBe(false);
    expect(await isContractAutoDispatchEnabled(settingAdmin("throw") as never)).toBe(false);
    expect(await isContractAutoDispatchEnabled(settingAdmin({ data: null }) as never)).toBe(false);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("contract_dispatch_setting_read_failed"));
  });
});

describe("비활성이면 DocuSign 발송 함수는 절대 호출되지 않는다", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CONTRACT_AUTO_DISPATCH_ENABLED;
  });
  it("dispatchOneContractJob → disabled, 상태 업데이트 없음", async () => {
    const { dispatchOneContractJob } = await import("./dispatcher");
    const admin = settingAdmin({ data: { auto_dispatch_enabled: false } });
    const result = await dispatchOneContractJob(admin as never, { id: "j", child_id: "c", subject_enrollment_id: "s" });
    expect(result).toEqual({ outcome: "disabled" });
    expect(sendRegularContractMock).not.toHaveBeenCalled();
    expect(admin.from).toHaveBeenCalledTimes(1); // 설정 조회만
  });
  it("processContractDispatchQueue → 큐 조회·claim 없이 반환", async () => {
    const { processContractDispatchQueue } = await import("./dispatcher");
    const admin = { ...settingAdmin({ data: { auto_dispatch_enabled: false } }), rpc: vi.fn() };
    expect(await processContractDispatchQueue(admin as never)).toEqual({ enabled: false, processed: 0, sent: 0, failed: 0 });
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(sendRegularContractMock).not.toHaveBeenCalled();
  });
});
