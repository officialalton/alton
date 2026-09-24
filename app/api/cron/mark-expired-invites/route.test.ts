import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Section 2(2026-09-24) — 초대 만료 크론 진입점의 접근 통제.
// fail-closed: CRON_SECRET이 없으면 아무것도 하지 않는다(다른 크론과 동일 규칙).

const { rpcMock, createAdminClientMock } = vi.hoisted(() => {
  const rpcMock = vi.fn();
  return { rpcMock, createAdminClientMock: vi.fn(() => ({ rpc: rpcMock })) };
});
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: createAdminClientMock }));

import { GET } from "./route";

const ORIGINAL_SECRET = process.env.CRON_SECRET;

beforeEach(() => {
  vi.clearAllMocks();
  rpcMock.mockResolvedValue({ data: 3, error: null });
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
    await expect(res.json()).resolves.toMatchObject({ ok: true, expiredCount: 3 });
    expect(rpcMock).toHaveBeenCalledWith("mark_expired_invites");
  });

  it("RPC가 실패해도 예외를 흘리지 않고 500과 사유를 돌려준다", async () => {
    process.env.CRON_SECRET = "s3cret";
    rpcMock.mockResolvedValue({ data: null, error: { message: "permission denied" } });
    const res = await GET(request({ authorization: "Bearer s3cret" }));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: "permission denied" });
  });
});
