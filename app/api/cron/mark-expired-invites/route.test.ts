import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Section 2(2026-09-24) — 초대 만료 크론 진입점의 접근 통제.
// fail-closed: CRON_SECRET이 없으면 아무것도 하지 않는다(다른 크론과 동일 규칙).

const { rpcMock, createAdminClientMock } = vi.hoisted(() => {
  const rpcMock = vi.fn();
  return { rpcMock, createAdminClientMock: vi.fn(() => ({ rpc: rpcMock })) };
});
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: createAdminClientMock }));
// 2026-10-05 무료 회원 S4 — 같은 크론에 붙은 보호자 초대 단계는 별도 유닛(lib/guardian-link/cron.test.ts)에서 검증한다.
const guardianStepMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/guardian-link/cron", () => ({ runGuardianLinkDailyStep: guardianStepMock }));

import { GET } from "./route";

const ORIGINAL_SECRET = process.env.CRON_SECRET;

beforeEach(() => {
  vi.clearAllMocks();
  rpcMock.mockResolvedValue({ data: 3, error: null });
  guardianStepMock.mockResolvedValue({ expiredCount: 1, remindersSent: 0, remindersFailed: 0 });
});
afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL_SECRET;
});

function request(headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/api/cron/mark-expired-invites", { headers });
}

describe("GET /api/cron/mark-expired-invites", () => {
  it("CRON_SECRET이 없으면 비활성 상태로 거부한다(만료 처리하지 않는다)", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(request());
    expect(res.status).toBe(503);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("토큰이 틀리면 거부한다", async () => {
    process.env.CRON_SECRET = "s3cret";
    const res = await GET(request({ authorization: "Bearer wrong" }));
    expect(res.status).toBe(401);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("올바른 토큰이면 mark_expired_invites()를 service_role로 호출한다", async () => {
    process.env.CRON_SECRET = "s3cret";
    const res = await GET(request({ authorization: "Bearer s3cret" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, expiredCount: 3, guardianLink: { expiredCount: 1 } });
    expect(rpcMock).toHaveBeenCalledWith("mark_expired_invites");
    expect(guardianStepMock).toHaveBeenCalledWith(expect.objectContaining({ rpc: rpcMock }), "https://example.com");
  });

  it("RPC가 실패해도 예외를 흘리지 않고 500과 사유를 돌려준다", async () => {
    process.env.CRON_SECRET = "s3cret";
    rpcMock.mockResolvedValue({ data: null, error: { message: "permission denied" } });
    const res = await GET(request({ authorization: "Bearer s3cret" }));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: "permission denied" });
    expect(guardianStepMock).not.toHaveBeenCalled();
  });
});
