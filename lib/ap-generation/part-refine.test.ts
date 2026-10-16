import { describe, expect, it } from "vitest";
import { bundleReferenceChecks, bundleStatus, checkPartRefinement, refineParts } from "./part-refine";
import type { FrqPack } from "./gates";
const row = (id: string, pts: number) => ({ row_id: id, points: pts, criterion: "criterion text here", required_elements: ["an element description that is long enough"] });
const pack = { archetype: "x", template: "t", topic: "3.2", skill: "4.B", calculator: "allowed", title: "T", stimulus: { kind: "table", description: "Rates at pH 7 and 37 °C", data: { rows: [["pH 7", "18.0 ± 1.20", "8"], ["37 °C", "16.4 ± 2.1", "8"]] } }, total_points: 3, est_minutes: 8, facts: ["means=[18.0, 16.4]"], expected_values: [{ part: "B", quantity: "percent change", value: -8.9, unit: "%", tolerance: 0.1 }],
  parts: [{ label: "A", prompt: "Describe the rate at pH 7 using values from the table.", points: 1, response_mode: "explain", skill_codes: ["4.B"], model_answer: "m", rubric_rows: [row("A1", 1)] }, { label: "B", prompt: "Calculate the percent change from 18.0 to 16.4. Show your work.", points: 1, response_mode: "calculate", skill_codes: ["5.A"], model_answer: "m", rubric_rows: [row("B1", 1)] }, { label: "C", prompt: "Using your answer to part (b), state whether the rate decreased.", points: 1, response_mode: "explain", skill_codes: ["5.B"], model_answer: "m", rubric_rows: [row("C1", 1)] }] } as unknown as FrqPack;
describe("파트 단위 문장 다듬기(무료)", () => {
  it("수치·수식이 보존되고 동사가 유지되면 채택, 새 수가 들어가면 거부", () => {
    expect(checkPartRefinement(pack, pack.parts[0], "Describe the rate at pH 7, supporting your description with values from the table.")).toEqual([]);
    expect(checkPartRefinement(pack, pack.parts[1], "Calculate the percent change from 18.0 to 99.9.")).toEqual(expect.arrayContaining([expect.stringMatching(/new_number_99.9|polished_stem_new_number/)]));
    expect(checkPartRefinement(pack, pack.parts[1], "The values are 18.0 and 16.4 for these levels.")).toContain("calculation_verb_lost");
  });
  it("통과한 파트만 채택하고 나머지는 원문 유지(mixed)", () => {
    const r = refineParts(pack, { A: "Describe the rate at pH 7, supporting it with values from the table.", B: "Calculate the percent change from 18.0 to 99.9.", C: undefined });
    expect(r.adopted).toEqual(["A"]); expect(r.wording).toBe("mixed"); expect(r.pack.parts[1].prompt).toBe(pack.parts[1].prompt); expect(r.rejected.map((x) => x.label).sort()).toEqual(["B", "C"]);
  });
  it("번들 일관성 검사: 없는 파트 참조·뒤 파트 참조·자료에 없는 조건·표/그래프 불일치", () => {
    const bad = JSON.parse(JSON.stringify(pack)) as FrqPack; bad.parts[0].prompt = "Use part (c) and part (z) at pH 9 in the graph."; bad.parts[1].prompt = "Look at the graph and calculate."; 
    const c = bundleReferenceChecks(bad); expect(c).toEqual(expect.arrayContaining(["part_A_references_later_part_c", "part_A_references_missing_part_z", "part_A_condition_not_in_stimulus_pH9", "part_B_mentions_graph_but_stimulus_is_table"]));
    expect(bundleReferenceChecks(pack)).toEqual([]);
  });
  it("번들 일관성이 깨지는 정제는 전부 되돌린다", () => {
    const r = refineParts(pack, { A: "Describe the rate at pH 7 using part (c) values from the table.", B: pack.parts[1].prompt, C: pack.parts[2].prompt }); expect(r.adopted).toEqual([]); expect(r.wording).toBe("template"); expect(r.pack.parts[0].prompt).toBe(pack.parts[0].prompt); expect(r.bundleIssues).toContain("part_A_references_later_part_c");
  });
  it("일부 파트 통과만으로 번들을 validated 로 표시하지 않는다", () => {
    expect(bundleStatus({ partsPass: { A: true, B: true, C: false }, bundleChecksPass: true, fullBundleReviewPassed: true })).toBe("not_validated");
    expect(bundleStatus({ partsPass: { A: true, B: true, C: true }, bundleChecksPass: true, fullBundleReviewPassed: null })).toBe("not_validated");
    expect(bundleStatus({ partsPass: { A: true, B: true, C: true }, bundleChecksPass: false, fullBundleReviewPassed: true })).toBe("not_validated");
    expect(bundleStatus({ partsPass: { A: true, B: true, C: true }, bundleChecksPass: true, fullBundleReviewPassed: true })).toBe("validated");
  });
});
