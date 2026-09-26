import { describe, expect, it } from "vitest";

// R10 Task C (2026-09-07) — 이 라우트는 레거시 teacher_payouts 생성 크론을
// 비활성화한 no-op이다(v3 payout_batches로 대체, vercel.json cron 항목도 제거됨).
// 어떤 요청이 와도 아무것도 쓰지 않고 410을 반환하는지만 확인한다.
describe("GET /api/cron/generate-payouts (deprecated no-op)", () => {
  it("항상 410을 반환하고 아무 것도 실행하지 않는다", async () => {
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});
