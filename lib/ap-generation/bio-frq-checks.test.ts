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
  it("표 자료에 그래프/오차 막대 표현, 토픽 개념 앵커 누락을 잡는다", () => {
    const p = gen("frq_bio_data_short", 1300); p.parts[2].prompt = "Using the error bars, identify the pair."; p.stimulus.description = "Mean rate for three levels"; p.title = "Data analysis"; p.parts.forEach((x: { prompt: string }) => (x.prompt = x.prompt.replace(/enzyme/gi, "")));
    const codes = gateBioFrq(p, { topics }).map((x) => x.code); expect(codes).toEqual(expect.arrayContaining(["prompt_mentions_graph_for_table", "topic_concept_anchor_missing"]));
  });
});
