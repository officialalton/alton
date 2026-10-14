import { describe, expect, it } from "vitest";
import { planConversion, bankGateIssues } from "./convert";
import { gateCandidate, type ApCandidateLike } from "../ap-figures/gate";
import { frqPassageDisplay, frqReferenceText, frqTaskText, type ElFrqPayload } from "../ap-generation/englang-frq";

// AP English Language 후보 → 문제은행 변환(2026-10-14): 지문 묶음(MC)은 set_intro 를 지문으로, 에세이 FRQ 는 소스 묶음(set_intro)+차트 그림+루브릭/샘플 참고 답안.
const DISPLAY = "ALTON original passage\nThe Warm Room\n\n¶1 The harbor library opened in 1931 with one stubborn stove. It cost five dollars a week to heat.\n\n¶2 By the time the stove failed, the shelves had doubled.";
const opt = (text: string, why: string) => ({ text, why, value: null, label: "x" });
const mcItem = (stem: string, key: number) => ({ topic: "U5.4", skill: "7.A", stem, key_index: key, explanation_en: `The correct answer is X.\n"Y" is incorrect: because.`, options: [opt("show a quiet gesture", "r"), opt("suggest the writer ignored complaints", "r"), opt("argue that libraries need more furniture", "r"), opt("mock the grumblers for being afraid", "r")] });
const mcCand = (): ApCandidateLike => ({ candidateKey: "ap_english_language-r01-k0", apSubjectCode: "ap_english_language", kind: "mc", payload: { archetype: "el_reading_r01", topic: "U5.4", skill: "7.A", calculator: "na", set_intro: DISPLAY, items: [mcItem("In paragraph 2, the writer primarily wants to", 0), mcItem("Which choice best describes paragraph 1?", 2), mcItem("The word stubborn in paragraph 1 suggests", 3), mcItem("The shelves doubling in paragraph 2 serves to", 1)] }, keywordCode: "U5.4", difficultyProvisional: "exam_prep" } as unknown as ApCandidateLike);

describe("AP English 묶음 MC 변환", () => {
  it("렌더 게이트 통과(그림 없음) + 문항 4건이 같은 지문을 공유", () => {
    const g = gateCandidate(mcCand()); expect(g.status).not.toBe("fail"); expect(g.stimKind).toBe("none");
    const p = planConversion(mcCand()); expect(p.ok).toBe(true);
    if (p.ok) { expect(p.items.length).toBe(4); expect(new Set(p.items.map((i) => i.passage)).size).toBe(1); expect(p.items[0].passage).toBe(DISPLAY); expect(p.items.map((i) => i.correctIndex)).toEqual([0, 2, 3, 1]); expect(p.items.every((i) => bankGateIssues(i).length === 0)).toBe(true); expect(p.items[0].topic).toBe("U5.4"); }
  });
});

describe("AP English 에세이 FRQ 변환", () => {
  const fig = { chart: "bar", title: "Library budget share", categories: ["2019", "2020", "2021"], series: [{ name: "Share", values: [3, 2, 4] }], yTitle: "Percent of town budget" };
  const el = { schema_version: "el-frq-1", task_type: "synthesis", template: "q1", title: "Libraries", prompt: { scenario: "A fictional town debates its library budget.", task: "Write an essay that synthesizes at least three sources.", requirements: ["Defend a position"] }, sources: [{ id: "A", kind: "text", title: "T", attribution: "Fictional, 2019", body: "Body of source A.", provenance: { kind: "original", author_alias: "A", year_alias: 2019 } }, { id: "F", kind: "visual", title: "Budget", attribution: "Fictional Office, 2022", figure: { ...fig, description: "Bar chart of budget share." }, provenance: { kind: "original", author_alias: "B", year_alias: 2022 } }], rubric: { total_points: 6, rows: [{ row_id: "A", name: "Thesis", max: 1, descriptors: { "0": "none", "1": "yes" }, task_specific: "A position." }, { row_id: "B", name: "Evidence and commentary", max: 4, descriptors: { "0": "a", "1": "b", "2": "c", "3": "d", "4": "e" }, task_specific: "Evidence." }, { row_id: "C", name: "Sophistication", max: 1, descriptors: { "0": "no", "1": "yes" }, task_specific: "Complexity." }], scoring_notes: [] }, expected_features: { common_pitfalls: [] }, samples: [{ tier: "high", target_total: 6, essay: "A strong essay.", word_count: 3, rubric_scores: { A: 1, B: 4, C: 1, total: 6 }, annotations: [{ quote: "strong essay", comment: "clear claim", row_id: "A" }] }], blueprint: {}, provenance: { kind: "original", note: "x" } } as unknown as ElFrqPayload;
  const cand = (): ApCandidateLike => ({
    candidateKey: "ap_english_language-f01-k0", apSubjectCode: "ap_english_language", kind: "frq_bundle",
    payload: { archetype: "elfrq_f01", template: "q1", topic: "U9.3", skill: "4.B", calculator: "na", title: el.title, set_intro: frqPassageDisplay(el), stimulus: { kind: "stat_chart", description: "Bar chart of budget share.", data: { chart: "bar", title: fig.title, data: { categories: fig.categories, series: fig.series, yTitle: fig.yTitle } } },
      parts: [{ label: "A", prompt: frqTaskText(el), points: 6, response_mode: "essay", skill_codes: ["4.B"], model_answer: "A strong essay.", rubric_rows: [{ row_id: "A", points: 1, criterion: "A position." }] }], reference_text: frqReferenceText(el), el_frq: el },
    keywordCode: "U9.3", difficultyProvisional: "exam_prep",
  } as unknown as ApCandidateLike);
  it("소스 묶음이 지문, 차트가 그림, 파트 모드는 essay, 참고 답안에 루브릭·샘플이 실린다", () => {
    const g = gateCandidate(cand()); expect(g.status).toBe("pass"); expect(g.stimKind).toBe("stat_chart");
    const p = planConversion(cand()); expect(p.ok).toBe(true);
    if (p.ok) {
      const it = p.items[0]; expect(it.format).toBe("essay"); expect(it.passage).toContain("Source A"); expect(it.figure).toBeTruthy();
      expect((it.statements as { mode: string; points: number }[])[0]).toMatchObject({ mode: "essay", points: 6 });
      expect(it.explanationEn).toContain("ALTON practice rubric, not official College Board scoring"); expect(it.explanationEn).toContain("Sample response, high score (6/6");
      expect(bankGateIssues(it)).toEqual([]);
    }
  });
});
