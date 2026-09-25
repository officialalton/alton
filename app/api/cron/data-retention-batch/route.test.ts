import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// R12(Section 2, 2026-09-24) — 보존기간 자동 배치 크론 진입점의 접근 통제.
// fail-closed: CRON_SECRET이 없으면 아무것도 하지 않고, RETENTION_BATCH_ENABLED가
// true가 아니면 CRON_SECRET이 맞아도 실행하지 않는다(스케줄 등록과 실제
// 활성화를 분리 — close-payout-month와 동일 패턴).

const { rpcMock, createAdminClientMock } = vi.hoisted(() => {
  const rpcMock = vi.fn();
  return { rpcMock, createAdminClientMock: vi.fn(() => ({ rpc: rpcMock })) };
});
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: createAdminClientMock }));

import { GET } from "./route";

const ORIGINAL_SECRET = process.env.CRON_SECRET;
const ORIGINAL_ENABLED = process.env.RETENTION_BATCH_ENABLED;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RETENTION_BATCH_ENABLED = "true";
  rpcMock.mockResolvedValue({ data: { notifications: 3, consultRequests: 1, accessLogs: 2, errors: [] }, error: null });
});
afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL_SECRET;
  if (ORIGINAL_ENABLED === undefined) delete process.env.RETENTION_BATCH_ENABLED;
  else process.env.RETENTION_BATCH_ENABLED = ORIGINAL_ENABLED;
});

function request(headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/api/cron/data-retention-batch", { headers });
}

describe("GET /api/cron/data-retention-batch", () => {
  it("CRON_SECRET이 없으면 비활성 상태로 거부한다(배치를 실행하지 않는다)", async () => {
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

  it("RETENTION_BATCH_ENABLED가 true가 아니면 CRON_SECRET이 맞아도 실행하지 않는다", async () => {
    process.env.CRON_SECRET = "s3cret";
    delete process.env.RETENTION_BATCH_ENABLED;
    const res = await GET(request({ authorization: "Bearer s3cret" }));
    expect(res.status).toBe(503);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("올바른 토큰과 활성화 플래그가 모두 있으면 run_data_retention_batch()를 실행한다", async () => {
    process.env.CRON_SECRET = "s3cret";
    const res = await GET(request({ authorization: "Bearer s3cret" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      result: { notifications: 3, consultRequests: 1, accessLogs: 2, errors: [] },
    });
    expect(rpcMock).toHaveBeenCalledWith("run_data_retention_batch", { p_limit: 500, p_dry_run: false });
  });

  it("배치가 실패해도 예외를 흘리지 않고 500과 사유를 돌려준다", async () => {
    process.env.CRON_SECRET = "s3cret";
    rpcMock.mockResolvedValue({ data: null, error: { message: "permission denied" } });
    const res = await GET(request({ authorization: "Bearer s3cret" }));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: "permission denied" });
  });
});
