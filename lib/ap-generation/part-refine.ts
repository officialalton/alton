// FRQ 번들의 파트 단위 문장 다듬기(무료, LLM 없음): 바뀐 파트의 수치·자료·키·루브릭 구조를 다시 검사한 뒤 번들 수준의 참조·조건 일관성을 재검사한다.
// 원칙: 일부 파트가 통과했다고 번들을 검증됨으로 표시하지 않는다 — 번들 전체 통과만 인정한다(`bundleStatus`).
import { wordingPreserves, type FrqPack } from "./gates";

type Part = FrqPack["parts"][number];
export type PartRefineResult = { pack: FrqPack; adopted: string[]; rejected: { label: string; reasons: string[] }[]; bundleIssues: string[]; wording: "llm" | "mixed" | "template" };
const CALC_VERB = /\b(calculate|compute|find|determine|what is|evaluate)\b/i; const EXPLAIN_VERB = /\b(explain|justify|describe|identify|state|use|support|determine|give|show|write|name)\b/i;
const numbersOf = (s: string) => (s.replace(/[−–]/g, "-").match(/-?\d+(?:\.\d+)?/g) ?? []).map((x) => x.replace(/^-/, ""));

/** 한 파트의 새 프롬프트를 채택할 수 있는지(수치·수식 보존, 응답 방식과 동사 일치, 기대값·루브릭·키·점수 불변). */
export function checkPartRefinement(pack: FrqPack, part: Part, newPrompt: string): string[] {
  const r: string[] = []; r.push(...wordingPreserves(part.prompt, newPrompt));
  if (part.response_mode === "calculate" && !CALC_VERB.test(newPrompt)) r.push("calculation_verb_lost");
  if (part.response_mode !== "calculate" && !EXPLAIN_VERB.test(newPrompt)) r.push("task_verb_lost");
  // 기대값(구조화 필드)에 있는 값이 프롬프트에 다른 값으로 바뀌어 나타나면 안 된다: 프롬프트의 수는 원문·자료·기대값에서만 와야 한다
  const allowed = new Set<string>([...numbersOf(part.prompt), ...numbersOf(JSON.stringify(pack.stimulus)), ...(pack.expected_values ?? []).flatMap((e) => numbersOf(String(e.value))), ...(pack.facts ?? []).flatMap((f) => numbersOf(String(f)))]);
  for (const n of numbersOf(newPrompt)) if (!allowed.has(n) && !["1", "2", "3"].includes(n)) r.push(`new_number_${n}`);
  if (/\bgraph\b|error bars?/i.test(newPrompt) && pack.stimulus?.kind === "table") r.push("prompt_mentions_graph_for_table");
  return [...new Set(r)];
}
/** 번들 수준 일관성: 파트 간 참조, 공유 자료, 조건(수준 이름·값)이 자료와 맞는지. */
export function bundleReferenceChecks(pack: FrqPack): string[] {
  const out: string[] = []; const labels = new Set(pack.parts.map((p) => p.label.toLowerCase())); const order = pack.parts.map((p) => p.label.toLowerCase());
  const stimText = JSON.stringify(pack.stimulus ?? {}).toLowerCase();
  pack.parts.forEach((p, idx) => {
    for (const m of p.prompt.matchAll(/\bpart\s*\(?([a-z])\)?/gi)) { const ref = m[1].toLowerCase(); if (!labels.has(ref)) out.push(`part_${p.label}_references_missing_part_${ref}`); else if (order.indexOf(ref) > idx) out.push(`part_${p.label}_references_later_part_${ref}`); }
    for (const m of p.prompt.matchAll(/\bpH\s*\d+(?:\.\d+)?|\b\d+(?:\.\d+)?\s*°C\b|\b\d+(?:\.\d+)?\s*(?:mM|%)\b/g)) { if (!stimText.includes(m[0].toLowerCase().replace(/\s+/g, " ")) && !stimText.includes(m[0].toLowerCase().replace(/\s+/g, ""))) out.push(`part_${p.label}_condition_not_in_stimulus_${m[0].replace(/\s+/g, "")}`); }
    if (/\b(the|this)\s+table\b/i.test(p.prompt) && pack.stimulus?.kind && !["table", "payoff_matrix"].includes(pack.stimulus.kind)) out.push(`part_${p.label}_mentions_table_but_stimulus_is_${pack.stimulus.kind}`);
    if (/\b(the|this)\s+graph\b/i.test(p.prompt) && pack.stimulus?.kind && pack.stimulus.kind !== "graph") out.push(`part_${p.label}_mentions_graph_but_stimulus_is_${pack.stimulus.kind}`);
  });
  for (const e of pack.expected_values ?? []) if (!labels.has(e.part.toLowerCase())) out.push(`expected_value_part_missing_${e.part}`);
  return [...new Set(out)];
}
/** 파트별 채택: 통과한 파트만 새 프롬프트를 쓰고 나머지는 원문을 유지한 뒤 번들 일관성을 다시 본다. */
export function refineParts(pack: FrqPack, prompts: Record<string, string | undefined>): PartRefineResult {
  const next: FrqPack = JSON.parse(JSON.stringify(pack)); const adopted: string[] = []; const rejected: PartRefineResult["rejected"] = [];
  for (const pt of next.parts) { const np = prompts[pt.label]; if (typeof np !== "string") { rejected.push({ label: pt.label, reasons: ["no_refined_prompt"] }); continue; } const reasons = checkPartRefinement(pack, pt, np); if (reasons.length) rejected.push({ label: pt.label, reasons }); else { pt.prompt = np; adopted.push(pt.label); } }
  const bundleIssues = bundleReferenceChecks(next);
  if (bundleIssues.length && adopted.length) { // 번들 일관성이 깨지면 이번 정제를 전부 되돌린다(원문 유지)
    return { pack, adopted: [], rejected: [...rejected, ...adopted.map((l) => ({ label: l, reasons: ["bundle_consistency_failed"] }))], bundleIssues, wording: "template" };
  }
  return { pack: next, adopted, rejected, bundleIssues, wording: adopted.length === pack.parts.length ? "llm" : adopted.length ? "mixed" : "template" };
}
/** 번들 검증 상태: 파트 통과·번들 검사·번들 전체 검토가 모두 통과해야 validated. 일부 파트 통과만으로는 절대 validated 가 아니다. */
export function bundleStatus(x: { partsPass: Record<string, boolean>; bundleChecksPass: boolean; fullBundleReviewPassed: boolean | null }): "validated" | "not_validated" {
  return x.fullBundleReviewPassed === true && x.bundleChecksPass && Object.values(x.partsPass).length > 0 && Object.values(x.partsPass).every(Boolean) ? "validated" : "not_validated";
}
