import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// P4-2 — 자동 송금 크론의 접근 통제. 월 마감 크론과 같은 fail-closed 규칙이다.
// 게이트가 닫혔을 때 아무것도 하지 않는 것은 runAutoPayoutDispatch()의 책임이고
// (통합 테스트가 담당), 여기서는 진입 통제만 본다.

const { runMock } = vi.hoisted(() => ({ runMock: vi.fn() }));
vi.mock("@/lib/payout/auto-dispatch", () => ({ runAutoPayoutDispatch: runMock }));

import { GET } from "./route";

const ORIGINAL = process.env.CRON_SECRET;

beforeEach(() => {
  vi.clearAllMocks();
  runMock.mockResolvedValue({
    dueOn: "2026-10-10",
    eligibleCount: 2,
    dispatchedCount: 0,
    skippedGateClosedCount: 2,
    skippedGlobalOff: false,
  });
});
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL;
});

function request(headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/api/cron/dispatch-approved-payouts", { headers });
}

describe("GET /api/cron/dispatch-approved-payouts", () => {
  it("CRON_SECRET이 없으면 실행하지 않는다", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(request());
    expect(res.status).toBe(503);
    expect(runMock).not.toHaveBeenCalled();
  });

  it("토큰이 틀리면 거부한다", async () => {
    process.env.CRON_SECRET = "s3cret";
    const res = await GET(request({ authorization: "Bearer wrong" }));
    expect(res.status).toBe(401);
    expect(runMock).not.toHaveBeenCalled();
  });

  it("올바른 토큰이면 실행하고 결과(건너뛴 사유 포함)를 돌려준다", async () => {
    process.env.CRON_SECRET = "s3cret";
    const res = await GET(request({ authorization: "Bearer s3cret" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      eligibleCount: 2,
      dispatchedCount: 0,
      skippedGateClosedCount: 2,
    });
  });

  it("실패해도 예외를 흘리지 않는다", async () => {
    process.env.CRON_SECRET = "s3cret";
    runMock.mockRejectedValue(new Error("boom"));
    const res = await GET(request({ authorization: "Bearer s3cret" }));
    expect(res.status).toBe(500);
  });
});
