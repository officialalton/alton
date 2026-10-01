import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock, sendMock } = vi.hoisted(() => ({ rpcMock: vi.fn(), sendMock: vi.fn() }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => ({ rpc: rpcMock }) }));
vi.mock("@/lib/regular-contract-send", () => ({
  sendRegularContractForSubjectEnrollment: (...a: unknown[]) => sendMock(...a),
}));

import { GET } from "./route";

const SECRET = process.env.CRON_SECRET;
const FLAG = process.env.CONTRACT_AUTO_DISPATCH_ENABLED;
const req = (h: Record<string, string> = {}) => new Request("https://x.test/api/cron/dispatch-contracts", { headers: h });

beforeEach(() => {
  vi.clearAllMocks();
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
  it("발송 플래그가 꺼져 있으면 큐를 claim하지도 발송하지도 않는다", async () => {
    process.env.CRON_SECRET = "s";
    delete process.env.CONTRACT_AUTO_DISPATCH_ENABLED;
    const res = await GET(req({ authorization: "Bearer s" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, enabled: false, processed: 0 });
    expect(rpcMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });
  it("플래그가 켜져 있으면 claim RPC로 큐를 처리한다", async () => {
    process.env.CRON_SECRET = "s";
    process.env.CONTRACT_AUTO_DISPATCH_ENABLED = "true";
    const res = await GET(req({ authorization: "Bearer s" }));
    await expect(res.json()).resolves.toMatchObject({ ok: true, enabled: true, processed: 0 });
    expect(rpcMock).toHaveBeenCalledWith("claim_contract_dispatch_jobs", { p_limit: 50 });
  });
});
