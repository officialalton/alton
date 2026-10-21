import { resolveRubric } from "./rubric";
// 비용·상한. 단가는 가정값(환경변수로 덮어쓴다) — 실제 단가는 Anthropic 가격표로 확인 후 설정할 것.
export const flagEnabled = (): boolean => process.env.AI_ESSAY_GRADING_ENABLED === "true";
const num = (v: string | undefined, d: number) => { const n = Number(v); return v && Number.isFinite(n) && n >= 0 ? n : d; };

export type Limits = {
  maxInputTokensPerEssay: number; maxOutputTokensPerEssay: number;
  perAttemptEssays: number; perAccountDailyEssays: number; monthlyBudgetUsd: number;
  usdPerMInput: number; usdPerMOutput: number;
};
/** rubricId 를 주면 그 루브릭의 응시당 상한·입력 한도 기본값을 쓴다(영어 3건 · U.S. History 6건). 환경변수는 영어 AI_ESSAY_PER_ATTEMPT_CAP · History AI_ESSAY_PER_ATTEMPT_CAP_USH. */
export const limits = (rubricId?: string | null): Limits => {
  const def = resolveRubric(rubricId, "leq") ?? resolveRubric(undefined)!;
  return {
  maxInputTokensPerEssay: num(process.env.AI_ESSAY_MAX_INPUT_TOKENS, def.maxInputTokens ?? 12_000),
  maxOutputTokensPerEssay: num(process.env.AI_ESSAY_MAX_OUTPUT_TOKENS, 1_500),
  perAttemptEssays: num(process.env[def.perAttemptEnv], def.perAttemptDefault),
  perAccountDailyEssays: num(process.env.AI_ESSAY_DAILY_CAP, def.perAttemptDefault * 2),
  monthlyBudgetUsd: num(process.env.AI_ESSAY_MONTHLY_BUDGET_USD, 25),
  usdPerMInput: num(process.env.AI_ESSAY_USD_PER_M_INPUT, 3),
  usdPerMOutput: num(process.env.AI_ESSAY_USD_PER_M_OUTPUT, 15),
  };
};

export const estimateInputTokens = (chars: number): number => Math.ceil(chars / 3.6); // 보수적(영어 약 4자/토큰)
export const costUsd = (inTok: number, outTok: number, l: Limits = limits()): number =>
  Math.round(((inTok * l.usdPerMInput + outTok * l.usdPerMOutput) / 1_000_000) * 100_000) / 100_000;

export type Usage = { attemptEssays: number; accountEssaysToday: number; monthSpendUsd: number };
export type CapDecision = { ok: true } | { ok: false; reason: "attempt_cap" | "daily_cap" | "monthly_budget" | "input_too_large" };
/** 호출 전 상한 검사(순수). 예상 비용(두 번 호출)이 월 예산을 넘기는 경우도 막는다. */
export function checkCaps(u: Usage, inputChars: number, l: Limits = limits()): CapDecision {
  if (estimateInputTokens(inputChars) > l.maxInputTokensPerEssay) return { ok: false, reason: "input_too_large" };
  if (u.attemptEssays >= l.perAttemptEssays) return { ok: false, reason: "attempt_cap" };
  if (u.accountEssaysToday >= l.perAccountDailyEssays) return { ok: false, reason: "daily_cap" };
  const worst = 4 * costUsd(l.maxInputTokensPerEssay, l.maxOutputTokensPerEssay, l);
  if (u.monthSpendUsd + worst > l.monthlyBudgetUsd) return { ok: false, reason: "monthly_budget" };
  return { ok: true };
}
