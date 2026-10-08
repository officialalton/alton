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

/** 모델이 도구 호출을 필드별 여러 블록으로 쪼개 내보내는 경우(2026-10-09 관찰: 첫 블록에 scope_skill 만, 이어서 key_scoring … summary 가 각각 별도 블록)를 한 객체로 복원한다.
 *  블록 순서는 도구 스키마의 속성 순서와 같다: [scope_skill(+notes)], key_scoring, stimulus_expression, distractor_explanation, exam_suitability, instant_reject{items}, matches_reference_pattern{value}, resembles_known_exam_item{value}, summary{summary|value}.
 *  각 블록의 모양이 기대와 맞을 때만 복원하고, 맞지 않으면 null(= malformed 로 남긴다). */
export function recoverFromBlocks(blocks: unknown[]): Record<string, unknown> | null {
  if (blocks.length < 9) return null; const b = blocks as Record<string, unknown>[];
  if (!b.every((x) => x && typeof x === "object")) return null;
  const first = parseCriterion(b[0].scope_skill); if (!first) return null;
  const crit = (x: Record<string, unknown>) => { const p = typeof x.pass === "string" ? (x.pass.toLowerCase() === "true") : x.pass; if (typeof p !== "boolean") return null; return { pass: p, notes: typeof x.notes === "string" ? x.notes : "" }; };
  const names = ["key_scoring", "stimulus_expression", "distractor_explanation", "exam_suitability"]; const out: Record<string, unknown> = { scope_skill: { pass: first.pass, notes: typeof b[0].notes === "string" ? b[0].notes : "" } };
  for (let i = 0; i < 4; i++) { const c = crit(b[1 + i]); if (!c) return null; out[names[i]] = c; }
  const ir = b[5].items; out.instant_reject = Array.isArray(ir) ? ir : typeof ir === "string" ? (() => { try { const v = JSON.parse(ir); return Array.isArray(v) ? v : null; } catch { return null; } })() : null; if (out.instant_reject === null) return null;
  const bool = (x: Record<string, unknown>) => (x.value === true || x.value === "true" ? true : x.value === false || x.value === "false" ? false : null);
  const m = bool(b[6]), r = bool(b[7]); if (m === null || r === null) return null; out.matches_reference_pattern = m; out.resembles_known_exam_item = r;
  const sm = b[8].summary ?? b[8].value; if (typeof sm !== "string") return null; out.summary = sm; return out;
}
