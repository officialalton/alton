import { consultantSemiMonthlyAmount, daysInMonth } from "./fee";

/**
 * 계약서 기준 정산 금액 "제안"(1단계 — 자동 입력·자동 지급 아님). 서명된 컨설턴트 계약의 월 보수로
 * 입력된 정산 기간의 금액을 계산해 관리자가 수기 입력한 금액과 비교하는 데만 쓴다.
 * 표준 반월 기간(1~15일, 16일~말일)이나 그 달 전체만 제안하고, 그 밖의 기간은 제안하지 않는다.
 * 금액 단위: 계약서의 월 보수는 최소 화폐 단위(KRW 원, USD 센트)이고, 이 함수는 화면 입력과 같은 "주 단위(원/달러)"로 돌려준다.
 */
export type ContractFee = { monthlyFeeMinor: number; currency: "KRW" | "USD"; startDate: string | null; endDate?: string | null };

export type PeriodSuggestion =
  | { ok: true; amountMajor: number; currency: "KRW" | "USD"; basis: string }
  | { ok: false; reason: string };

const toMajor = (minor: number, currency: "KRW" | "USD") => (currency === "KRW" ? minor : minor / 100);

export function suggestConsultantPeriodAmount(fee: ContractFee, periodStart: string, periodEnd: string): PeriodSuggestion {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd) || periodEnd < periodStart) {
    return { ok: false, reason: "정산 기간을 입력하면 계약 기준 금액을 제안합니다." };
  }
  const month = periodStart.slice(0, 7);
  if (periodEnd.slice(0, 7) !== month) return { ok: false, reason: "한 달 안의 반월 기간(1~15일 또는 16일~말일)일 때만 제안합니다." };
  const dim = daysInMonth(month);
  const s = Number(periodStart.slice(8, 10));
  const e = Number(periodEnd.slice(8, 10));
  const calc = consultantSemiMonthlyAmount(fee.monthlyFeeMinor, month, fee.startDate, fee.endDate ?? null);
  if (s === 1 && e === 15) return { ok: true, amountMajor: toMajor(calc.firstHalf, fee.currency), currency: fee.currency, basis: `${month} 1~15일분(월 보수 × 15/${dim})` };
  if (s === 16 && e === dim) return { ok: true, amountMajor: toMajor(calc.secondHalf, fee.currency), currency: fee.currency, basis: `${month} 16일~말일분(월 보수 − 1~15일분)` };
  if (s === 1 && e === dim) return { ok: true, amountMajor: toMajor(calc.total, fee.currency), currency: fee.currency, basis: `${month} 한 달분` };
  return { ok: false, reason: "표준 반월 기간(1~15일, 16일~말일) 또는 한 달 전체일 때만 제안합니다." };
}

/** 수기 입력 금액·통화가 제안과 다르면 경고 문구(차단 아님). 같으면 null. */
export function compareManualWithSuggestion(
  suggestion: PeriodSuggestion,
  manual: { amountMajor: number | null; currency: string }
): string | null {
  if (!suggestion.ok) return null;
  const warnings: string[] = [];
  if (manual.currency !== suggestion.currency) warnings.push(`입력한 통화(${manual.currency})가 계약 통화(${suggestion.currency})와 다릅니다.`);
  if (manual.amountMajor !== null && Number.isFinite(manual.amountMajor) && Math.abs(manual.amountMajor - suggestion.amountMajor) > 0.005) {
    warnings.push(`입력한 금액이 계약 기준 제안 금액(${new Intl.NumberFormat("en-US").format(suggestion.amountMajor)} ${suggestion.currency})과 다릅니다.`);
  }
  return warnings.length ? warnings.join(" ") : null;
}

/**
 * 같은 컨설턴트·같은 달 반월(또는 겹치는 날짜)의 정산 기간이 이미 있는지 확인한다(이중 계상 방지, 차단 아님).
 * 기존 기간과 하루라도 겹치면 경고 문구를 돌려준다.
 */
export function findOverlappingPeriods<T extends { periodStart: string; periodEnd: string }>(existing: T[], periodStart: string, periodEnd: string): T[] {
  if (!periodStart || !periodEnd || periodEnd < periodStart) return [];
  return existing.filter((p) => p.periodStart <= periodEnd && p.periodEnd >= periodStart);
}

export function overlapWarning(overlaps: { periodStart: string; periodEnd: string }[]): string | null {
  if (overlaps.length === 0) return null;
  const list = overlaps.map((p) => `${p.periodStart}~${p.periodEnd}`).join(", ");
  return `같은 기간과 겹치는 정산이 이미 등록되어 있습니다(${list}). 이중 지급이 아닌지 확인하세요.`;
}

/** 자동 채움으로 만든 정산 기간 메모(감사용): "from contract <계약 id>, <근거>". */
export function contractAutoFillNote(agreementId: string, basis: string): string {
  return `from contract ${agreementId}, ${basis}`;
}
