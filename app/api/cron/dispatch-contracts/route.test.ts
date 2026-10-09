import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock, sendMock } = vi.hoisted(() => ({ rpcMock: vi.fn(), sendMock: vi.fn() }));
const { settingState } = vi.hoisted(() => ({ settingState: { enabled: true as boolean | "error" } }));
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({
    rpc: rpcMock,
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            settingState.enabled === "error"
              ? { data: null, error: { message: "db down" } }
              : { data: { auto_dispatch_enabled: settingState.enabled }, error: null },
        }),
      }),
    }),
  }),
}));
vi.mock("@/lib/regular-contract-send", () => ({
  sendRegularContractForSubjectEnrollment: (...a: unknown[]) => sendMock(...a),
}));

import { GET } from "./route";

const SECRET = process.env.CRON_SECRET;
const FLAG = process.env.CONTRACT_AUTO_DISPATCH_ENABLED;
const req = (h: Record<string, string> = {}) => new Request("https://x.test/api/cron/dispatch-contracts", { headers: h });

beforeEach(() => {
  vi.clearAllMocks();
  settingState.enabled = true;
  vi.spyOn(console, "error").mockImplementation(() => {});
  rpcMock.mockResolvedValue({ data: [], error: null });
});
afterEach(() => {
  if (SECRET === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = SECRET;
  if (FLAG === undefined) delete process.env.CONTRACT_AUTO_DISPATCH_ENABLED;
  else process.env.CONTRACT_AUTO_DISPATCH_ENABLED = FLAG;
});

describe("GET /api/cron/dispatch-contracts", () => {
  it("CRON_SECRET이 없으면 503", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(req())).status).toBe(503);
    expect(rpcMock).not.toHaveBeenCalled();
  });
  it("토큰이 틀리면 401", async () => {
    process.env.CRON_SECRET = "s";
    expect((await GET(req({ authorization: "Bearer no" }))).status).toBe(401);
  });
  it("관리자 설정이 꺼져 있으면 큐를 claim하지도 발송하지도 않는다", async () => {
    process.env.CRON_SECRET = "s";
    settingState.enabled = false;
    const res = await GET(req({ authorization: "Bearer s" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, enabled: false, processed: 0 });
    expect(rpcMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });
  it("설정 조회 실패면 fail-safe로 비활성", async () => {
    process.env.CRON_SECRET = "s";
    settingState.enabled = "error";
    const res = await GET(req({ authorization: "Bearer s" }));
    await expect(res.json()).resolves.toMatchObject({ enabled: false });
    expect(rpcMock).not.toHaveBeenCalled();
  });
  it("env가 'false'(비상 정지)면 설정이 켜져 있어도 처리하지 않는다", async () => {
    process.env.CRON_SECRET = "s";
    process.env.CONTRACT_AUTO_DISPATCH_ENABLED = "false";
    const res = await GET(req({ authorization: "Bearer s" }));
    await expect(res.json()).resolves.toMatchObject({ enabled: false });
    expect(rpcMock).not.toHaveBeenCalled();
  });
  it("설정이 켜져 있으면(env 없음) claim RPC로 큐를 처리한다", async () => {
    process.env.CRON_SECRET = "s";
    delete process.env.CONTRACT_AUTO_DISPATCH_ENABLED;
    const res = await GET(req({ authorization: "Bearer s" }));
    await expect(res.json()).resolves.toMatchObject({ ok: true, enabled: true, processed: 0 });
    expect(rpcMock).toHaveBeenCalledWith("claim_contract_dispatch_jobs", { p_limit: 50 });
  });
});
