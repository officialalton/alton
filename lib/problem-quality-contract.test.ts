import { describe, expect, it } from "vitest";
import { checkQualityContract, contractCoverageGaps, QUALITY_CONTRACTS } from "./problem-quality-contract";
import { judgeReview, normalizeSprAnswer, type IndependentReview } from "./problem-generation/review";

const wic = {
  skillCode: "words_in_context", examSystem: "sat_rw", format: "mc",
  stimulus: "The committee's report was ______ in its treatment of the evidence: it addressed every objection raised during the hearings.",
  question: "Which choice completes the text with the most logical and precise word or phrase?",
  options: ["thorough", "cursory", "ambiguous", "reluctant"], correctIndex: 0, answers: null, statements: null, explanation: "x", figure: null,
};

describe("유형별 문제 품질 계약", () => {
  it("세부 기술 30개 전부 계약이 있다", () => {
    expect(contractCoverageGaps()).toEqual([]);
    expect(Object.keys(QUALITY_CONTRACTS)).toHaveLength(30);
  });
  it("Words in Context 빈칸형 정상 통과, 질문 없음·선택지 3개·정답 자리 밖은 연결 실패", () => {
    expect(checkQualityContract(wic).ok).toBe(true);
    expect(checkQualityContract({ ...wic, question: null }).issues.map((i) => i.code)).toContain("contract_target");
    expect(checkQualityContract({ ...wic, options: ["a", "b", "c"], correctIndex: 0 }).issues.map((i) => i.code)).toContain("contract_format");
    expect(checkQualityContract({ ...wic, correctIndex: 7 }).issues.map((i) => i.code)).toContain("contract_format");
  });
  it("인용 단어형: 대상 단어가 지문에 두 번이면 표시 위치가 모호 → 실패", () => {
    const q = { ...wic, stimulus: "Her prose is austere. Critics called the austere style a virtue.", question: 'As used in the text, what does the word "austere" most nearly mean?', options: ["plain", "rich", "loud", "warm"] };
    expect(checkQualityContract(q).issues.map((i) => i.code)).toContain("contract_display");
    expect(checkQualityContract({ ...q, stimulus: "Her prose is austere. Critics called the style a virtue." }).ok).toBe(true);
  });
  it("Rhetorical Synthesis: 정답이 메모 정보를 쓰지 않으면 정답 근거 끊김", () => {
    const rs = {
      ...wic, skillCode: "rhetorical_synthesis",
      stimulus: "While researching a topic, a student has taken the following notes:\n- Voyager 1 launched in 1977.\n- It entered interstellar space in 2012.\n- It still transmits data using a 22-watt radio.",
      question: "The student wants to emphasize how long Voyager 1 has operated. Which choice most effectively uses relevant information from the notes to accomplish this goal?",
      options: ["Launched in 1977, Voyager 1 is still transmitting data decades later.", "The moon is bright tonight over the harbor.", "Many probes exist.", "Radios are useful tools."], correctIndex: 0,
    };
    expect(checkQualityContract(rs).ok).toBe(true);
    expect(checkQualityContract({ ...rs, correctIndex: 1 }).issues.map((i) => i.code)).toContain("contract_answer");
  });
  it("정량 근거: 정답 선택지 수치가 자료에 없으면 근거 끊김, 자료 없으면 evidence", () => {
    const quant = {
      ...wic, skillCode: "command_of_evidence_quant",
      stimulus: "The table shows bird species recorded in three plots in 2010 and 2020. Ecologists claim diversity rose most where grazing was removed (Plot A).",
      question: "Which choice most effectively uses data from the table to complete the statement?",
      options: ["Plot A rose from 12 to 18 species.", "Plot B rose from 9 to 10 species.", "Plot C fell from 15 to 14 species.", "All plots recorded 20 species in 2020."], correctIndex: 0,
      figure: { type: "data", kind: "table", title: "Bird Species Recorded", columns: ["Plot", "2010", "2020"], rows: [["A", 12, 18], ["B", 9, 10], ["C", 15, 14]] },
    };
    expect(checkQualityContract(quant).ok).toBe(true);
    expect(checkQualityContract({ ...quant, correctIndex: 3 }).issues.map((i) => i.code)).toContain("contract_answer");
    expect(checkQualityContract({ ...quant, figure: null }).issues.some((i) => i.code === "contract_evidence" || i.code === "contract_rw_data")).toBe(true);
  });
  it("Math 도형: 지문의 점이 도형에 없으면 참조 끊김", () => {
    const geo = {
      ...wic, skillCode: "lines_angles_triangles", examSystem: "sat_math",
      stimulus: "In the figure, lines m and n are parallel and line k is a transversal that meets m at point A and n at point B.",
      question: "What is the value of x?", options: ["52", "128", "62", "38"], correctIndex: 0,
      figure: { type: "parallel_transversal", parallel: ["m", "n"], transversals: [{ id: "k" }], points: [{ id: "A", on: ["m", "k"] }], angles: [{ at: ["m", "k"], region: "SE", label: "128°" }, { at: ["n", "k"], region: "NE", label: "x°" }], notToScale: true },
    };
    expect(checkQualityContract(geo).issues.map((i) => i.code)).toContain("contract_ref_missing");
    expect(checkQualityContract({ ...geo, figure: { ...geo.figure, points: [...geo.figure.points, { id: "B", on: ["n", "k"] }] } }).ok).toBe(true);
  });
  it("SPR: 정답 집합 없으면 형식 실패", () => {
    const spr = { ...wic, skillCode: "linear_equations_one_var", examSystem: "sat_math", format: "spr", stimulus: "If $2x + 3 = 11$.", question: "What is the value of $x$?", options: null, correctIndex: null, answers: ["4"] };
    expect(checkQualityContract(spr).ok).toBe(true);
    expect(checkQualityContract({ ...spr, answers: [] }).issues.map((i) => i.code)).toContain("contract_format");
  });
});

describe("독립 품질 검사 판정", () => {
  const base: IndependentReview = {
    pickedIndex: 0, pickedAnswer: null, agrees: true, confidence: "high", estimatedDifficulty: "medium", difficultyReasons: [], flags: [],
    distractors: [
      { index: 1, plausibleBecause: "a", matches: "b", whyWrong: "c", kind: "partial", obvious: false },
      { index: 2, plausibleBecause: "a", matches: "b", whyWrong: "c", kind: "scope", obvious: false },
      { index: 3, plausibleBecause: "a", matches: "b", whyWrong: "c", kind: "relation_distortion", obvious: false },
    ],
  };
  it("정답 일치·오답 정상이면 통과", () => {
    expect(judgeReview(base, "medium", "mc")).toEqual([]);
  });
  it("정답 불일치, 무관 오답, 명백한 오답 2개, 어려움인데 easy 는 실패 사유", () => {
    expect(judgeReview({ ...base, agrees: false, pickedIndex: 2 }, "medium", "mc")[0]).toMatch(/독립 검사는 C\)/);
    expect(judgeReview({ ...base, distractors: [{ ...base.distractors[0], kind: "irrelevant" }, base.distractors[1], base.distractors[2]] }, "medium", "mc")[0]).toMatch(/무관/);
    expect(judgeReview({ ...base, distractors: base.distractors.map((d, i) => ({ ...d, obvious: i < 2 })) }, "medium", "mc")[0]).toMatch(/너무 명백/);
    expect(judgeReview({ ...base, distractors: [{ ...base.distractors[0], obvious: true }, base.distractors[1], base.distractors[2]] }, "hard", "mc")[0]).toMatch(/어려움 문제인데/);
    expect(judgeReview({ ...base, estimatedDifficulty: "easy" }, "hard", "mc")[0]).toMatch(/추정 난이도가 easy/);
    // 보통 난이도에서 명백한 오답 1개는 허용(정보 기록만).
    expect(judgeReview({ ...base, distractors: [{ ...base.distractors[0], obvious: true }, base.distractors[1], base.distractors[2]] }, "medium", "mc")).toEqual([]);
  });
  it("SPR 정답 정규화 — 7/2 와 3.5, 1,200 과 1200", () => {
    expect(normalizeSprAnswer("7/2")).toBe(normalizeSprAnswer("3.5"));
    expect(normalizeSprAnswer("1,200")).toBe("1200");
    expect(normalizeSprAnswer(" 0.50 ")).toBe("0.5");
  });
});
