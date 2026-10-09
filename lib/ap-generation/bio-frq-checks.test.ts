import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { gateBioFrq } from "./bio-frq-checks";
const PY = process.env.AP_PY ?? "/private/tmp/claude-501/-Users-jangjiman-Developer-ALTON/d05b2ffe-5d6e-4058-a909-5e3b8827cbe2/scratchpad/apvenv/bin/python";
const gen = (a: string, seed: number) => JSON.parse(execFileSync(PY, ["-B", "registry.py", "batch", a, "1", String(seed)], { cwd: "scripts/ap-generation/archetypes", encoding: "utf-8" }))[0];
const topics = new Set(["8.1", "3.2", "3.5"]);
const ok = (() => { try { execFileSync(PY, ["--version"]); return true; } catch { return false; } })(); const d = ok ? describe : describe.skip;
d("Bio FRQ 무료 결정적 검사", () => {
  it("정상 번들 두 원형은 결함 0", () => { for (const a of ["frq_bio_investigation", "frq_bio_data_short"]) for (const s of [1300, 1301, 1302]) expect(gateBioFrq(gen(a, s), { topics }).map((x) => x.code)).toEqual([]); });
  it("존재하지 않는 토픽·중복 표시·Ph·문구 일치 루브릭·모순된 허용 답을 잡는다", () => {
    const p = gen("frq_bio_data_short", 1300); p.parts[0].topic_codes = ["3.7"]; p.stimulus.data.columns[0] = "Ph"; p.parts[0].rubric_rows[0].meaning_based = false; p.parts[0].rubric_rows[0].required_elements = ["peaks"];
    p.parts[0].rubric_rows[0].alt_solutions = ["the rate rises then falls"]; if (!/peak/.test(JSON.stringify(p.facts))) p.stimulus.data.rows = p.stimulus.data.rows.map((r: string[]) => r);
    const codes = gateBioFrq(p, { topics }).map((x) => x.code); expect(codes).toEqual(expect.arrayContaining(["nonexistent_topic", "ph_miscased", "rubric_not_meaning_based", "rubric_element_is_phrase"]));
  });
  it("대조군: (control) 중복 표시·(control) 없음·근거 없음", () => {
    const p = gen("frq_bio_investigation", 1300); const lab = p.stimulus.data.rows[0][0]; p.stimulus.data.rows[0][0] = lab.replace(" (control)", "") + " (control) (control)";
    expect(gateBioFrq(p, { topics }).map((x) => x.code)).toEqual(expect.arrayContaining(["duplicated_display_text"]));
    const q = gen("frq_bio_investigation", 1300); q.stimulus.data.rows.forEach((r: string[]) => (r[0] = r[0].replace(" (control)", ""))); delete q.blueprint.experiment.control_rationale;
    expect(gateBioFrq(q, { topics }).map((x) => x.code)).toEqual(expect.arrayContaining(["control_group_not_unique", "control_rationale_missing"]));
  });
});

import { gateMicroFrq } from "./micro-frq-checks";
d("Micro FRQ 무료 결정적 검사", () => {
  const mt = new Set(["4.2", "4.5"]); const ms = new Set(["2.C", "2.B", "3.A", "3.B", "3.C"]);
  it("정상 번들 두 원형은 결함 0", () => { for (const a of ["frq_micro_monopoly", "frq_micro_game"]) for (const s of [1300, 1301, 1302, 1303]) expect(gateMicroFrq(gen(a, s), { topics: mt, skills: ms }).map((x) => x.code)).toEqual([]); });
  it("설명 요구인데 추론 행 없음·계산기 허용인데 계산 없음·문구 일치 루브릭을 잡는다", () => {
    const p = gen("frq_micro_game", 1300); p.calculator = "allowed"; p.parts[1].prompt = "Identify the Nash equilibrium and explain why neither firm would deviate."; p.parts[1].rubric_rows[0].required_elements = ["pair"]; p.parts[1].rubric_rows[0].criterion = "States the pair";
    const codes = gateMicroFrq(p, { topics: mt, skills: ms }).map((x) => x.code); expect(codes).toEqual(expect.arrayContaining(["explain_prompt_without_reasoning_row", "calculator_allowed_without_calculation", "rubric_element_is_phrase"]));
  });
});

d("Bio FRQ 무료 검사 추가(2026-10-09)", () => {
  it("표 자료에 그래프/오차 막대 표현을 잡는다(공통 규칙)", () => {
    const p = gen("frq_bio_data_short", 1300); p.parts[2].prompt = "Using the error bars, identify the pair.";
    expect(gateBioFrq(p, { topics }).map((x) => x.code)).toContain("prompt_mentions_graph_for_table");
  });
});

d("Bio 데이터형: ±2SE 표기 일치·개념 필수(2026-10-09)", () => {
  it("정상 번들은 통과", () => { for (const sd of [1700, 1701, 1702, 1703, 1704, 1705]) expect(gateBioFrq(gen("frq_bio_data_short", sd), { topics }).map((x) => x.code)).toEqual([]); });
  it("머리글 ±2SE 누락·단위 불일치·표시값 불일치를 잡는다", () => {
    const a = gen("frq_bio_data_short", 1700); a.stimulus.data.columns[1] = "Mean (units)"; expect(gateBioFrq(a, { topics }).map((x) => x.code)).toContain("se_header_missing");
    const b = gen("frq_bio_data_short", 1700); b.stimulus.data.columns[1] = "Mean (liters) ± 2SE"; expect(gateBioFrq(b, { topics }).map((x) => x.code)).toContain("se_header_unit_mismatch");
    const c = gen("frq_bio_data_short", 1700); c.stimulus.data.rows[0][1] = c.stimulus.data.rows[0][1].replace(/± .*/, "± 9.99"); expect(gateBioFrq(c, { topics }).map((x) => x.code)).toContain("se_value_mismatch");
  });
});

import { bioDataShortDesignChecks } from "./archetype-checks/bio-data-short";
d("(b) 원형 내부 설계 조건: 데이터형 평가 목적 분리", () => {
  it("정상 번들은 통과하고 전역 게이트(공통 규칙)도 통과한다", () => { for (const sd of [1800, 1801, 1802, 1803, 1804]) { const p = gen("frq_bio_data_short", sd); expect(bioDataShortDesignChecks(p).map((x) => x.code)).toEqual([]); expect(gateBioFrq(p, { topics }).map((x) => x.code)).toEqual([]); } });
  it("개념 키워드를 개념이 필요 없는 파트에 넣으면 걸린다(키워드 채우기 금지)", () => { const p = gen("frq_bio_data_short", 1800); p.parts[1].prompt += " Consider the enzyme structure."; expect(bioDataShortDesignChecks(p).map((x) => x.code)).toContain("archetype_design:data_short:concept_keyword_stuffing"); });
  it("개념 파트가 기제를 채점하지 않거나 목적이 겹치면 걸린다", () => { const p = gen("frq_bio_data_short", 1800); p.parts[3].rubric_rows[0].required_elements = ["a short answer here"]; p.parts[2].purpose = "table_interpretation"; const c = bioDataShortDesignChecks(p).map((x) => x.code); expect(c).toEqual(expect.arrayContaining(["archetype_design:data_short:concept_part_not_scored", "archetype_design:data_short:purpose_not_distinct"])); });
  it("expected_values 는 구조화 필드이고 루브릭 문장은 수치 출처가 아니다", () => { const p = gen("frq_bio_data_short", 1800); expect(p.expected_values.length).toBeGreaterThan(0); for (const e of p.expected_values) expect(typeof e.value).toBe("number"); expect(JSON.stringify(p.parts.flatMap((x: { rubric_rows: { required_elements: string[] }[] }) => x.rubric_rows.flatMap((r) => r.required_elements)))).not.toMatch(/\d\.\d/); });
});
