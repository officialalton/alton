import { describe, expect, it } from "vitest";
import { compareManualWithSuggestion, contractAutoFillNote, findOverlappingPeriods, overlapWarning, suggestConsultantPeriodAmount } from "./suggestion";

const KRW = { monthlyFeeMinor: 3_100_000, currency: "KRW" as const, startDate: null };
const USD = { monthlyFeeMinor: 300_000, currency: "USD" as const, startDate: null };

describe("suggestConsultantPeriodAmount", () => {
  it("1~15일분 = 월 보수 × 15/일수, 16일~말일분 = 나머지(합이 월 보수와 같다)", () => {
    const a = suggestConsultantPeriodAmount(KRW, "2026-10-01", "2026-10-15");
    const b = suggestConsultantPeriodAmount(KRW, "2026-10-16", "2026-10-31");
    expect(a).toMatchObject({ ok: true, amountMajor: 1_500_000, currency: "KRW" });
    expect(b).toMatchObject({ ok: true, amountMajor: 1_600_000 });
    if (a.ok && b.ok) expect(a.amountMajor + b.amountMajor).toBe(3_100_000);
  });

  it("2월(평년·윤년) 말일 경계와 USD는 달러 단위로 돌려준다", () => {
    const feb = suggestConsultantPeriodAmount(KRW, "2026-02-16", "2026-02-28");
    const feb1 = suggestConsultantPeriodAmount(KRW, "2026-02-01", "2026-02-15");
    expect(feb.ok && feb1.ok && feb.amountMajor + feb1.amountMajor).toBe(3_100_000);
    expect(suggestConsultantPeriodAmount(KRW, "2028-02-16", "2028-02-29")).toMatchObject({ ok: true });
    expect(suggestConsultantPeriodAmount(USD, "2026-10-01", "2026-10-15")).toMatchObject({ ok: true, amountMajor: 1451.61, currency: "USD" });
  });

  it("계약 시작일이 기간 중간이면 일할로 제안한다", () => {
    const r = suggestConsultantPeriodAmount({ ...KRW, startDate: "2026-10-10" }, "2026-10-01", "2026-10-15");
    expect(r).toMatchObject({ ok: true });
    if (r.ok) expect(r.amountMajor).toBeLessThan(1_500_000);
  });

  it("한 달 전체는 월 보수, 표준 기간이 아니거나 달을 넘으면 제안하지 않는다", () => {
    expect(suggestConsultantPeriodAmount(KRW, "2026-10-01", "2026-10-31")).toMatchObject({ ok: true, amountMajor: 3_100_000 });
    expect(suggestConsultantPeriodAmount(KRW, "2026-10-05", "2026-10-20")).toMatchObject({ ok: false });
    expect(suggestConsultantPeriodAmount(KRW, "2026-10-16", "2026-11-15")).toMatchObject({ ok: false });
    expect(suggestConsultantPeriodAmount(KRW, "", "")).toMatchObject({ ok: false });
  });
});

describe("compareManualWithSuggestion", () => {
  const s = suggestConsultantPeriodAmount(KRW, "2026-10-01", "2026-10-15");
  it("같으면 경고 없음", () => {
    expect(compareManualWithSuggestion(s, { amountMajor: 1_500_000, currency: "KRW" })).toBeNull();
  });
  it("금액이 다르면 경고, 통화가 다르면 통화 경고(둘 다면 둘 다)", () => {
    expect(compareManualWithSuggestion(s, { amountMajor: 1_000_000, currency: "KRW" })).toMatch(/금액/);
    expect(compareManualWithSuggestion(s, { amountMajor: 1_500_000, currency: "USD" })).toMatch(/통화/);
    expect(compareManualWithSuggestion(s, { amountMajor: 1, currency: "USD" })).toMatch(/통화.*금액/);
  });
  it("금액 미입력이면 금액 경고를 하지 않고, 제안 없음이면 항상 null", () => {
    expect(compareManualWithSuggestion(s, { amountMajor: null, currency: "KRW" })).toBeNull();
    expect(compareManualWithSuggestion({ ok: false, reason: "x" }, { amountMajor: 5, currency: "KRW" })).toBeNull();
  });
});

describe("계약 기준 자동 채움 — 계산 규칙", () => {
  const FEE = (monthlyFeeMinor: number, over: object = {}) => ({ monthlyFeeMinor, currency: "KRW" as const, startDate: null, ...over });
  const amt = (r: ReturnType<typeof suggestConsultantPeriodAmount>) => (r.ok ? r.amountMajor : NaN);

  it("반올림 나머지는 달의 마지막(후반) 지급에 붙는다 — 평년 2월과 윤년 2월 모두 합이 월 보수와 같다", () => {
    const f = FEE(1_000_000);
    expect(amt(suggestConsultantPeriodAmount(f, "2026-02-01", "2026-02-15"))).toBe(535_714);
    expect(amt(suggestConsultantPeriodAmount(f, "2026-02-16", "2026-02-28"))).toBe(464_286);
    expect(amt(suggestConsultantPeriodAmount(f, "2028-02-01", "2028-02-15"))).toBe(517_241);
    expect(amt(suggestConsultantPeriodAmount(f, "2028-02-16", "2028-02-29"))).toBe(482_759);
  });

  it("시작 월 일할: 10/10 시작이면 1~15일분은 6일치, 16일~말일분은 16일치", () => {
    const f = FEE(3_100_000, { startDate: "2026-10-10" });
    expect(amt(suggestConsultantPeriodAmount(f, "2026-10-01", "2026-10-15"))).toBe(600_000);
    expect(amt(suggestConsultantPeriodAmount(f, "2026-10-16", "2026-10-31"))).toBe(1_600_000);
    expect(amt(suggestConsultantPeriodAmount(f, "2026-10-01", "2026-10-31"))).toBe(2_200_000);
  });

  it("종료 월 일할: 10/20 종료면 16일~말일분은 5일치, 종료 이후 달은 0", () => {
    const f = FEE(3_100_000, { endDate: "2026-10-20" });
    expect(amt(suggestConsultantPeriodAmount(f, "2026-10-01", "2026-10-15"))).toBe(1_500_000);
    expect(amt(suggestConsultantPeriodAmount(f, "2026-10-16", "2026-10-31"))).toBe(500_000);
    expect(amt(suggestConsultantPeriodAmount(f, "2026-11-01", "2026-11-15"))).toBe(0);
  });

  it("USD는 센트 계산 후 달러로: 윤년 2월 합이 월 보수와 같다", () => {
    const f = { monthlyFeeMinor: 300_000, currency: "USD" as const, startDate: null };
    const a = amt(suggestConsultantPeriodAmount(f, "2028-02-01", "2028-02-15"));
    const b = amt(suggestConsultantPeriodAmount(f, "2028-02-16", "2028-02-29"));
    expect(a).toBe(1551.72);
    expect(Math.round((a + b) * 100)).toBe(300_000);
  });

  it("메모 형식과 이중 계상 경고", () => {
    expect(contractAutoFillNote("agr-1", "2026-10 1~15일분(월 보수 × 15/31)")).toBe("from contract agr-1, 2026-10 1~15일분(월 보수 × 15/31)");
    const existing = [{ periodStart: "2026-10-01", periodEnd: "2026-10-15" }, { periodStart: "2026-09-16", periodEnd: "2026-09-30" }];
    expect(findOverlappingPeriods(existing, "2026-10-01", "2026-10-15")).toHaveLength(1);
    expect(findOverlappingPeriods(existing, "2026-10-16", "2026-10-31")).toHaveLength(0);
    expect(findOverlappingPeriods(existing, "2026-10-10", "2026-10-31")).toHaveLength(1); // 하루라도 겹치면
    expect(overlapWarning(findOverlappingPeriods(existing, "2026-10-01", "2026-10-15"))).toMatch(/이중 지급/);
    expect(overlapWarning([])).toBeNull();
  });
});
