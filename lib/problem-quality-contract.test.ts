import { describe, expect, it } from "vitest";
import { checkQualityContract, contractCoverageGaps, QUALITY_CONTRACTS } from "./problem-quality-contract";
import { classifyReviewIssues, judgeReview, normalizeSprAnswer, type IndependentReview } from "./problem-generation/review";

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
  it("정량 근거: 정답이 자료에 근거하면 통과, 자료 없으면 evidence 실패", () => {
    const quant = {
      ...wic, skillCode: "command_of_evidence_quant",
      stimulus: "The table shows bird species recorded in three plots in 2010 and 2020. Ecologists claim diversity rose most where grazing was removed (Plot A).",
      question: "Which choice most effectively uses data from the table to complete the statement?",
      options: ["Plot A rose from 12 to 18 species.", "Plot B rose from 9 to 10 species.", "Plot C fell from 15 to 14 species.", "All plots recorded 20 species in 2020."], correctIndex: 0,
      figure: { type: "data", kind: "table", title: "Bird Species Recorded", columns: ["Plot", "2010", "2020"], rows: [["A", 12, 18], ["B", 9, 10], ["C", 15, 14]] },
    };
    expect(checkQualityContract(quant).ok).toBe(true);
    // 2026-09-18(hard 재검증) — 정답 수치가 자료에 있는지 정확히 검증하는 일(파생 통계·차이값 포함)은
    // 여기(checkQualityContract)가 아니라 pipeline.ts가 이어서 돌리는 전용 검증기
    // (quant-evidence-check.ts의 checkQuantEvidenceFields)의 책임이다 — 예전엔 여기서도 훨씬 좁은
    // 버전(정확한 셀 값 하나만 인정, 파생값·차이값 모름)을 중복으로 돌려서, 전용 검증기라면 정당하게
    // 인정했을 정답(예: 두 값의 차이)까지 여기서 먼저 오탐 거부했다. 그 회귀 재현·수정은
    // quant-evidence-check.test.ts에 있다.
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
  it("정답 불일치는 실패; 보통은 무관 2개 또는 전부 명백일 때만 실패; 어려움은 무관·명백 하나도 불허; 어려움인데 easy 실패", () => {
    expect(judgeReview({ ...base, agrees: false, pickedIndex: 2 }, "medium", "mc")[0]).toMatch(/독립 검사는 C\)/);
    const oneIrrelevant = { ...base, distractors: [{ ...base.distractors[0], kind: "irrelevant" as const }, base.distractors[1], base.distractors[2]] };
    expect(judgeReview(oneIrrelevant, "medium", "mc")).toEqual([]);
    expect(judgeReview(oneIrrelevant, "hard", "mc")[0]).toMatch(/어려움 문제인데.*무관/);
    const twoIrrelevant = { ...base, distractors: [{ ...base.distractors[0], kind: "irrelevant" as const }, { ...base.distractors[1], kind: "irrelevant" as const }, base.distractors[2]] };
    expect(judgeReview(twoIrrelevant, "medium", "mc")[0]).toMatch(/무관/);
    const allObvious = { ...base, distractors: base.distractors.map((d) => ({ ...d, obvious: true })) };
    expect(judgeReview(allObvious, "medium", "mc")[0]).toMatch(/모두 너무 명백/);
    const twoObvious = { ...base, distractors: base.distractors.map((d, i) => ({ ...d, obvious: i < 2 })) };
    expect(judgeReview(twoObvious, "medium", "mc")).toEqual([]);
    expect(judgeReview({ ...base, distractors: [{ ...base.distractors[0], obvious: true }, base.distractors[1], base.distractors[2]] }, "hard", "mc")[0]).toMatch(/어려움 문제인데.*명백/);
    expect(judgeReview({ ...base, estimatedDifficulty: "easy" }, "hard", "mc")[0]).toMatch(/추정 난이도가 easy/);
  });
  it("SPR 정답 정규화 — 7/2 와 3.5, 1,200 과 1200", () => {
    expect(normalizeSprAnswer("7/2")).toBe(normalizeSprAnswer("3.5"));
    expect(normalizeSprAnswer("1,200")).toBe("1200");
    expect(normalizeSprAnswer(" 0.50 ")).toBe("0.5");
  });
});

describe("Bug A/B(2026-09-17) — 빈칸 완성형 축자 복제·transitions 선택지 비대칭", () => {
  const fss = {
    ...wic, skillCode: "form_structure_sense",
    stimulus:
      "Sylvia Earle has spent decades studying the ocean's ecosystems firsthand as a research diver and expedition leader. ______ Her decades of fieldwork have made her one of the most respected marine biologists alive today.",
    question: "Which choice completes the text so that it conforms to the conventions of Standard English?",
    options: [
      "Earle possesses a firsthand understanding of marine ecosystems that few scientists can claim.",
      "Earle possess a firsthand understanding of marine ecosystems that few scientists can claim.",
      "Earle, possesses a firsthand understanding of marine ecosystems that few scientists can claim.",
      "Earle possessing a firsthand understanding of marine ecosystems that few scientists can claim.",
    ],
    correctIndex: 0,
  };
  it("정답 선택지가 지문과 6단어 이상 그대로 겹치면(Sylvia Earle 사례) 축자 복제로 거부", () => {
    const stimulusWithEcho =
      "Sylvia Earle possesses a firsthand understanding of marine ecosystems that few scientists can claim. She has spent decades studying the ocean's ecosystems firsthand as a research diver. ______ Her decades of fieldwork have made her one of the most respected marine biologists alive today.";
    const codes = checkQualityContract({ ...fss, stimulus: stimulusWithEcho }).issues.map((i) => i.code);
    expect(codes).toContain("contract_option_echo");
  });
  it("선택지가 지문과 겹치지 않는 독립 문장이면 정상 통과(오탐 없음)", () => {
    expect(checkQualityContract(fss).ok).toBe(true);
  });
  it("실측(2026-09-18, 25문항 배치)에서 나온 오탐 패턴 — 평범한 연결구(6~7단어) 겹침은 통과해야 한다", () => {
    // 실제 파이프라인 배치에서 걸렸던 사례를 축소 재현: "in the early years of the" 처럼 내용이
    // 아니라 흔한 시간 표현을 6단어 그대로 공유하는 것만으로는 축자 복제가 아니다(문장 전체 복사가 아님).
    const inf = {
      ...wic, skillCode: "inferences",
      stimulus:
        "Historians note that in the early years of the tulip trade, transactions relied heavily on personal trust between merchants. ______ formal contracts became common only after repeated disputes over unpaid deliveries.",
      question: "Which choice most logically completes the text?",
      options: [
        "By contrast, buyers in the early years of the market rarely needed written agreements at all.",
        "Consequently, tulip prices fell sharply within a single growing season.",
        "Meanwhile, unrelated trade routes to the east expanded rapidly.",
        "Nevertheless, most merchants preferred to trade in silver rather than tulips.",
      ],
      correctIndex: 0,
    };
    expect(checkQualityContract(inf).issues.map((i) => i.code)).not.toContain("contract_option_echo");
  });
  it("Rhetorical Synthesis 는 노트 고유명사를 정답이 인용해도 축자 복제 검사 대상이 아니다(오탐 방지)", () => {
    const rs = {
      ...wic, skillCode: "rhetorical_synthesis",
      stimulus: "While researching a topic, a student has taken the following notes:\n- Voyager 1 launched in 1977.\n- It entered interstellar space in 2012.\n- It still transmits data using a 22-watt radio.",
      question: "The student wants to emphasize how long Voyager 1 has operated. Which choice most effectively uses relevant information from the notes to accomplish this goal?",
      options: ["Launched in 1977, Voyager 1 is still transmitting data decades later.", "The moon is bright tonight over the harbor.", "Many probes exist.", "Radios are useful tools."], correctIndex: 0,
    };
    expect(checkQualityContract(rs).issues.map((i) => i.code)).not.toContain("contract_option_echo");
  });

  const transitions = {
    ...wic, skillCode: "transitions",
    stimulus:
      "A city council studied ridership data for three years before proposing a new subway line. Commuter surveys showed strong demand along the corridor. ______ the council voted to approve funding for the project.",
    question: "Which choice completes the text with the most logical transition?",
    options: ["Similarly,", "For instance,", "Given these findings,", "Nevertheless,"],
    correctIndex: 2,
  };
  it("정답만 지시어+명사로 구체적 내용을 지칭하면(subway 사례) 구조 비대칭으로 거부", () => {
    const codes = checkQualityContract(transitions).issues.map((i) => i.code);
    expect(codes).toContain("contract_transition_parallel");
  });
  it("4개 선택지가 모두 표준 전환어면 정상 통과", () => {
    const parallel = { ...transitions, options: ["Similarly,", "For instance,", "Consequently,", "Nevertheless,"] };
    expect(checkQualityContract(parallel).ok).toBe(true);
  });
});

describe("오답 부분 수정 대상 분류(2026-09-15)", () => {
  const base: IndependentReview = {
    pickedIndex: 0, pickedAnswer: null, agrees: true, confidence: "high", estimatedDifficulty: "medium", difficultyReasons: [], flags: [],
    distractors: [
      { index: 1, plausibleBecause: "a", matches: "b", whyWrong: "c", kind: "partial", obvious: false },
      { index: 2, plausibleBecause: "a", matches: "b", whyWrong: "c", kind: "scope", obvious: false },
      { index: 3, plausibleBecause: "a", matches: "b", whyWrong: "c", kind: "relation_distortion", obvious: false },
    ],
  };
  it("정답 불일치는 구조적 문제 — 부분 수정 대상이 아니다", () => {
    const issues = classifyReviewIssues({ ...base, agrees: false, pickedIndex: 2 }, "medium", "mc");
    expect(issues.hasStructuralIssue).toBe(true);
    expect(issues.distractorTargets).toEqual([]);
  });
  it("보통 난이도에서 오답 하나만 명백하면 통과(구조 문제 없음, 대상도 없음)", () => {
    const issues = classifyReviewIssues({ ...base, distractors: [{ ...base.distractors[0], obvious: true }, base.distractors[1], base.distractors[2]] }, "medium", "mc");
    expect(issues.reasons).toEqual([]);
    expect(issues.hasStructuralIssue).toBe(false);
  });
  it("어려움에서 오답 하나가 무관하면 구조 문제 없이 그 자리만 부분 수정 대상", () => {
    const issues = classifyReviewIssues({ ...base, distractors: [{ ...base.distractors[0], kind: "irrelevant" }, base.distractors[1], base.distractors[2]] }, "hard", "mc");
    expect(issues.hasStructuralIssue).toBe(false);
    expect(issues.distractorTargets.map((t) => t.index)).toEqual([1]);
    expect(issues.reasons.length).toBeGreaterThan(0);
  });
  it("정답 불일치와 오답 문제가 함께 있으면 구조 문제로 분류(부분 수정으로 끝내지 않음)", () => {
    const issues = classifyReviewIssues({ ...base, agrees: false, distractors: [{ ...base.distractors[0], kind: "irrelevant" }, base.distractors[1], base.distractors[2]] }, "hard", "mc");
    expect(issues.hasStructuralIssue).toBe(true);
  });
});
