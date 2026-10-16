// AP Psychology FRQ 무료 결정적 설계 검사(LLM 호출 없음). 공식 구조(CED Fall 2025 p.147–149·채점 지침 p.168–176)와 자료 일관성을 코드로 본다.
// AAQ: 파트 A–F(1/1/1/1/1/2) · 7점 · 25분 · 논문 요약(소개·참가자·절차·윤리·결과) + 결과 표. EBQ: 파트 A–E(1/1/2/1/2) · 7점 · 45분 · 출처 3개(Source 1-3) + 요약 표.
// 모범 답안·루브릭 행의 숫자는 지문 또는 표에 있어야 한다(없는 수치를 지어내지 않는다).
type Json = Record<string, unknown>;
export type PsychFrqIssue = { code: string };
const nums = (s: string) => (s.match(/\d+(?:,\d{3})*(?:\.\d+)?/g) ?? []).map((x) => x.replace(/,/g, ""));
const AAQ_POINTS: Record<string, number> = { A: 1, B: 1, C: 1, D: 1, E: 1, F: 2 };
const EBQ_POINTS: Record<string, number> = { A: 1, B: 1, C: 2, D: 1, E: 2 };

export function gatePsychFrq(p: Json): PsychFrqIssue[] {
  const out: string[] = [];
  const template = String(p.template ?? ""); const intro = String(p.set_intro ?? ""); const parts = (Array.isArray(p.parts) ? p.parts : []) as { label: string; points: number; prompt: string; model_answer: string; rubric_rows: { row_id: string; points: number; criterion: string; required_elements: string[]; requires_row_id?: string | null }[] }[];
  if (template !== "aaq" && template !== "ebq") return [{ code: "psych_template_unknown" }];
  const want = template === "aaq" ? AAQ_POINTS : EBQ_POINTS;
  if (p.total_points !== 7) out.push("psych_total_not_7");
  if (parts.map((x) => x.label).join("") !== Object.keys(want).join("")) out.push("psych_part_labels");
  for (const x of parts) { if (want[x.label] !== x.points) out.push(`psych_part_${x.label}_points`); if (x.rubric_rows.length !== x.points) out.push(`psych_part_${x.label}_rows_not_points`); }
  if (!/^ALTON original source/.test(intro)) out.push("psych_intro_not_labeled_original");
  if (template === "aaq") {
    for (const h of ["Introduction", "Participants", "Procedure", "Ethical procedures", "Results"]) if (!intro.includes(h)) out.push(`psych_aaq_missing_section_${h.replace(/\s+/g, "_").toLowerCase()}`);
    if (p.est_minutes !== 25) out.push("psych_aaq_minutes_not_25");
  } else {
    for (const n of [1, 2, 3]) if (!intro.includes(`Source ${n}:`)) out.push(`psych_ebq_missing_source_${n}`);
    if (p.est_minutes !== 45) out.push("psych_ebq_minutes_not_45");
    if (!/Propose a specific and defensible claim/.test(parts[0]?.prompt ?? "")) out.push("psych_ebq_claim_prompt");
    if (!/Cite|cite/.test(parts[1]?.prompt ?? "") || !/different source/.test(parts[3]?.prompt ?? "")) out.push("psych_ebq_citation_prompts");
    if (!/different psychological/.test(parts[4]?.prompt ?? "")) out.push("psych_ebq_different_concept_prompt");
  }
  // 두 번째 행은 첫 행을 필요로 한다(설명·적용 2점 파트)
  for (const x of parts) if (x.rubric_rows.length === 2 && x.points === 2 && x.rubric_rows[1].requires_row_id !== x.rubric_rows[0].row_id && x.label !== "F") out.push(`psych_part_${x.label}_second_row_requires_first`);
  // 숫자 일관성: 모범 답안의 숫자는 지문·표에 있다
  const stim = JSON.stringify((p.stimulus as Json | undefined) ?? {}); const have = new Set(nums(intro + " " + stim));
  for (const x of parts) {
    const ans = x.model_answer.replace(/^ALTON reference answer[^.]*\.\s*/, "");
    for (const n of nums(ans)) if (!have.has(n) && !["1", "2", "3", "4", "5"].includes(n)) { const derived = new Set<string>(); for (const a of have) for (const b of have) if (!isNaN(Number(a)) && !isNaN(Number(b))) { derived.add(String(+(Number(a) - Number(b)).toFixed(2))); derived.add(String(+(Number(b) - Number(a)).toFixed(2))); } if (!derived.has(n)) out.push(`psych_part_${x.label}_number_${n}_not_in_source`); }
  }
  // 학생에게 보이는 문장에 정답 노출 금지: 파트 프롬프트에 모범 답안 전체 문장이 들어 있지 않다
  for (const x of parts) { const ans = x.model_answer.replace(/^ALTON reference answer[^.]*\.\s*/, "").slice(0, 60); if (ans.length > 30 && x.prompt.includes(ans)) out.push(`psych_part_${x.label}_prompt_leaks_answer`); }
  return [...new Set(out)].map((code) => ({ code }));
}
