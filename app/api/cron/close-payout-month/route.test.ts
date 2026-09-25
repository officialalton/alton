import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// P4-2(2차) — 자동 마감 크론 진입점의 접근 통제.
// fail-closed: CRON_SECRET이 없으면 아무것도 하지 않는다(스케줄 등록과 실제
// 활성화를 분리). 이 라우트는 정산 묶음 생성까지만 하고 승인·송금은 하지 않는다.

const { closePreviousMonthMock } = vi.hoisted(() => ({ closePreviousMonthMock: vi.fn() }));
vi.mock("@/lib/payout/close-payout-month", () => ({ closePreviousMonth: closePreviousMonthMock }));

import { GET } from "./route";

const ORIGINAL_SECRET = process.env.CRON_SECRET;
const ORIGINAL_ENABLED = process.env.PAYOUT_CRON_ENABLED;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PAYOUT_CRON_ENABLED = "true";
  closePreviousMonthMock.mockResolvedValue({ periodStart: "2026-08-01", periodEnd: "2026-08-31", batches: [] });
});
afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL_SECRET;
  if (ORIGINAL_ENABLED === undefined) delete process.env.PAYOUT_CRON_ENABLED;
  else process.env.PAYOUT_CRON_ENABLED = ORIGINAL_ENABLED;
});

function request(headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/api/cron/close-payout-month", { headers });
}

describe("GET /api/cron/close-payout-month", () => {
  it("CRON_SECRET이 없으면 비활성 상태로 거부한다(마감을 실행하지 않는다)", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(request());
    expect(res.status).toBe(503);
    expect(closePreviousMonthMock).not.toHaveBeenCalled();
  });

  it("토큰이 틀리면 거부한다", async () => {
    process.env.CRON_SECRET = "s3cret";
    const res = await GET(request({ authorization: "Bearer wrong" }));
    expect(res.status).toBe(401);
    expect(closePreviousMonthMock).not.toHaveBeenCalled();
  });

  it("올바른 토큰이면 직전 달을 마감한다", async () => {
    process.env.CRON_SECRET = "s3cret";
    const res = await GET(request({ authorization: "Bearer s3cret" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, periodStart: "2026-08-01" });
    expect(closePreviousMonthMock).toHaveBeenCalledTimes(1);
  });

  it("마감이 실패해도 예외를 흘리지 않고 500과 사유를 돌려준다", async () => {
    process.env.CRON_SECRET = "s3cret";
    closePreviousMonthMock.mockRejectedValue(new Error("lock timeout"));
    const res = await GET(request({ authorization: "Bearer s3cret" }));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: "lock timeout" });
  });

  it("PAYOUT_CRON_ENABLED가 true가 아니면 CRON_SECRET이 맞아도 실행하지 않는다(정산 크론만 별도로 끌 수 있음)", async () => {
    process.env.CRON_SECRET = "s3cret";
    delete process.env.PAYOUT_CRON_ENABLED;
    const res = await GET(request({ authorization: "Bearer s3cret" }));
    expect(res.status).toBe(503);
    expect(closePreviousMonthMock).not.toHaveBeenCalled();
  });
});
