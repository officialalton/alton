// 검토 도구 출력 정규화. 모델이 가끔 기준 객체 대신 '<parameter name="pass">true' 같은 문자열을 내놓는다(2026-10-08 S1c 에서 50건 중 22건, 런1~2 에서도 13~18%).
// 이 문자열을 객체로 읽지 못하면 모든 기준이 '불통과'로 처리돼 정상 문항이 반려된다. 판정 기준이 아니라 파싱만 바로잡는다.
const CRITERIA = ["scope_skill", "key_scoring", "stimulus_expression", "distractor_explanation", "exam_suitability"] as const;
export type Criterion = { pass: boolean; notes: string };
export function parseCriterion(v: unknown): Criterion | null {
  if (v && typeof v === "object" && typeof (v as { pass?: unknown }).pass === "boolean") return v as Criterion;
  if (typeof v === "string") { const m = v.match(/pass["']?\s*>?\s*[:=]?\s*(true|false)/i); if (m) return { pass: m[1].toLowerCase() === "true", notes: "" }; }
  return null;
}
/** 반환: 정규화된 검토. 판독 불가능한 기준이 하나라도 있으면 malformed 로 표시(불통과로 암묵 처리하지 않는다). */
export function normalizeReview(r: Record<string, unknown> | null): { review: Record<string, unknown> | null; malformed: string[]; repaired: string[] } {
  if (!r) return { review: null, malformed: ["no_review"], repaired: [] };
  const out: Record<string, unknown> = { ...r }; const malformed: string[] = []; const repaired: string[] = [];
  for (const k of CRITERIA) { const c = parseCriterion(r[k]); if (!c) malformed.push(k); else { out[k] = c; if (typeof r[k] === "string") repaired.push(k); } }
  return { review: out, malformed, repaired };
}
