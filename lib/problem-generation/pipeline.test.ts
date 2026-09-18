import { describe, expect, it, vi, beforeEach } from "vitest";

// 2026-09-16 — 코드 검토(docs/2026-09-16-sat-math-generation-code-review-and-proposal.md)에서
// 지목한 결함(A: 검사한 문항과 저장 문항 분리, B: 필수 검사 미실행이 통과로 처리, C: 해설을 따라
// 정답을 자동 변경, G: 오답 수정 후 전체 재검증 누락)을 실제 AI 호출 없이 모의 응답으로 재현·검증한다.
// Math 한정 변경이므로 examSystem: "sat_math"를 쓴다(R&W 기존 동작은 이 테스트의 대상이 아니다).

const generateSectionProblemsCore = vi.fn();
const regenerateProblemCore = vi.fn();
const generateFigureForProblemCore = vi.fn();
const repairOneDistractorCore = vi.fn();
const repairFieldsCore = vi.fn();
const resolveAnswerFromExplanationCore = vi.fn();
vi.mock("./core", () => ({
  generateSectionProblemsCore: (...a: unknown[]) => generateSectionProblemsCore(...a),
  regenerateProblemCore: (...a: unknown[]) => regenerateProblemCore(...a),
  generateFigureForProblemCore: (...a: unknown[]) => generateFigureForProblemCore(...a),
  repairOneDistractorCore: (...a: unknown[]) => repairOneDistractorCore(...a),
  repairFieldsCore: (...a: unknown[]) => repairFieldsCore(...a),
  resolveAnswerFromExplanationCore: (...a: unknown[]) => resolveAnswerFromExplanationCore(...a),
}));

const reviewProblemIndependently = vi.fn();
vi.mock("./review", async () => {
  const actual = await vi.importActual<typeof import("./review")>("./review");
  return { ...actual, reviewProblemIndependently: (...a: unknown[]) => reviewProblemIndependently(...a) };
});

const checkQualityContract = vi.fn();
vi.mock("@/lib/problem-quality-contract", () => ({ checkQualityContract: (...a: unknown[]) => checkQualityContract(...a) }));

vi.mock("@/lib/problem-material-need", () => ({
  judgeMaterialNeed: () => ({ level: "none", kind: null, geometry: [] }),
  materialBlocker: () => null,
}));

function baseProblem(overrides: Record<string, unknown> = {}) {
  return {
    format: "mc", figure: null, passage: "지문", stimulus: "지문", question: "값은?", needsFigure: false,
    options: ["1", "2", "3", "4"], correctIndex: 0, answers: null, statements: null, explanation: "해설",
    difficulty: "medium", distractorRationales: [], difficultyRationale: "", design: null,
    ...overrides,
  };
}

const goodReview = {
  pickedIndex: 0, pickedAnswer: null, agrees: true, confidence: "high" as const,
  distractors: [
    { index: 1, plausibleBecause: "x", matches: "x", whyWrong: "x", kind: "other" as const, obvious: false },
    { index: 2, plausibleBecause: "x", matches: "x", whyWrong: "x", kind: "other" as const, obvious: false },
    { index: 3, plausibleBecause: "x", matches: "x", whyWrong: "x", kind: "other" as const, obvious: false },
  ],
  estimatedDifficulty: "medium" as const, difficultyReasons: [], flags: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  checkQualityContract.mockReturnValue({ ok: true, issues: [], contract: null });
  reviewProblemIndependently.mockResolvedValue(goodReview);
  resolveAnswerFromExplanationCore.mockResolvedValue({ ok: true, concludedIndex: 0, confidence: "high", cleanExplanation: "해설" });
});

const mathParams = {
  subjectName: "SAT Math", skillType: "linear_functions", skillCode: "linear_functions", examSystem: "sat_math",
  difficulty: "medium" as const, format: "mc" as const, count: 1,
};

describe("runGenerationPipeline — 2026-09-16 코드 검토 수정(Math 한정)", () => {
  it("A: 계약 실패 → 재생성 후 통과하면, 저장 후보는 재생성된 최종 문항이다(원본이 아니다)", async () => {
    const { runGenerationPipeline } = await import("./pipeline");
    const original = baseProblem({ question: "원본 질문" });
    generateSectionProblemsCore.mockResolvedValue([original]);
    checkQualityContract
      .mockReturnValueOnce({ ok: false, issues: [{ code: "contract_target", message: "질문 대상 불명확" }], contract: null })
      .mockReturnValue({ ok: true, issues: [], contract: null });
    regenerateProblemCore.mockResolvedValue(baseProblem({ question: "재생성된 질문" }));

    const result = await runGenerationPipeline(mathParams);

    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0].problem.question).toBe("재생성된 질문");
  });

  it("B: 독립 검사가 예외로 실행되지 못하면 통과시키지 않는다", async () => {
    const { runGenerationPipeline } = await import("./pipeline");
    generateSectionProblemsCore.mockResolvedValue([baseProblem()]);
    reviewProblemIndependently.mockRejectedValue(new Error("타임아웃"));
    regenerateProblemCore.mockResolvedValue(baseProblem());

    const result = await runGenerationPipeline(mathParams);

    expect(result.accepted).toHaveLength(0);
    expect(result.failures.some((f) => f.stage === "review")).toBe(true);
  });

  it("C: 해설이 다른 선택지를 뒷받침해도 정답 키를 자동으로 바꾸지 않고 구조적 실패로 처리한다", async () => {
    const { runGenerationPipeline } = await import("./pipeline");
    generateSectionProblemsCore.mockResolvedValue([baseProblem({ correctIndex: 0 })]);
    resolveAnswerFromExplanationCore.mockResolvedValue({ ok: true, concludedIndex: 2, confidence: "high", cleanExplanation: "해설" });
    regenerateProblemCore.mockResolvedValue(baseProblem({ correctIndex: 0 }));

    const result = await runGenerationPipeline(mathParams);

    expect(result.accepted.every((a) => a.problem.correctIndex === 0)).toBe(true);
    expect(result.accepted).toHaveLength(0);
    expect(result.failures.some((f) => f.reason.includes("자동으로 바꾸지 않습니다"))).toBe(true);
  });

  it("G: 오답 자리 수정 뒤 계약이 깨지면(Math) 그대로 통과시키지 않고, 다시 만든 후보가 깨끗해야만 통과한다", async () => {
    const { runGenerationPipeline } = await import("./pipeline");
    generateSectionProblemsCore.mockResolvedValue([baseProblem()]);
    // 모든 시도(최초 + 재생성)에서 같은 오답 품질 문제가 재현된다고 가정 — repair가 "고친 오답"으로
    // 바꾸면 그 특정 문구가 계약을 깨는 것으로 모의한다(호출 순서가 아니라 실제 내용 기준 판정).
    const badReview = { ...goodReview, distractors: [{ ...goodReview.distractors[0], obvious: true, kind: "irrelevant" as const }, goodReview.distractors[1], goodReview.distractors[2]] };
    reviewProblemIndependently.mockResolvedValue(badReview);
    repairOneDistractorCore.mockResolvedValue({ ok: true, text: "고친 오답" });
    checkQualityContract.mockImplementation((input: { options?: string[] | null }) =>
      input.options?.includes("고친 오답")
        ? { ok: false, issues: [{ code: "contract_answer", message: "선택지 형식 붕괴" }], contract: null }
        : { ok: true, issues: [], contract: null }
    );
    regenerateProblemCore.mockResolvedValue(baseProblem());

    const result = await runGenerationPipeline({ ...mathParams, difficulty: "hard" });

    // maxDepth(2)까지 재생성해도 매번 같은 오답 문제가 재현되니 결국 저장되지 않아야 한다.
    expect(result.accepted).toHaveLength(0);
    expect(result.failures.some((f) => f.reason.includes("오답 수정 후 계약 실패"))).toBe(true);
  });

  // 2026-09-18(제품 오너 지시) — 생성 자체가 빈/파싱불가 응답으로 실패하면(예외 메시지가 "AI 응답에
  // 문제가 없습니다"/"AI 응답을 처리할 수 없습니다") 딱 1회만 그대로 재시도한다. 품질 검증 실패(위
  // A/B/C/G 테스트들이 다루는 계약·독립검사·오답보정)는 이 재시도와 무관하게 기존 재생성 상한만 쓴다
  // — 실제 API 호출 없이 mock 예외로 재현한다.
  it("생성 예외(빈 응답)가 1회 재시도로 해소되면 정상 채택되고, emptyResponses에 retried=true·resolved=true로 기록된다", async () => {
    const { runGenerationPipeline } = await import("./pipeline");
    generateSectionProblemsCore
      .mockRejectedValueOnce(new Error("AI 응답에 문제가 없습니다."))
      .mockResolvedValueOnce([baseProblem()]);

    const result = await runGenerationPipeline(mathParams);

    expect(generateSectionProblemsCore).toHaveBeenCalledTimes(2);
    expect(result.accepted).toHaveLength(1);
    expect(result.stats.emptyResponses).toHaveLength(1);
    expect(result.stats.emptyResponses[0]).toMatchObject({ retried: true, resolved: true });
  });

  it("생성 예외(빈 응답)가 재시도 1회에도 그대로면 그 슬롯은 실패로 끝난다(더 재시도하지 않는다)", async () => {
    const { runGenerationPipeline } = await import("./pipeline");
    // 매번 같은 빈 응답 예외 — accepted=0 이면 파이프라인의 기존 부족분 보충(refill) 로직이 generate()를
    // 다시 부를 수 있으므로(내 변경과 무관한 기존 동작), 전체 호출 수를 고정값으로 단정하지 않는다.
    // 대신 "이 재시도 로직 자체가 1회를 넘겨 반복하지 않는가"를 호출 횟수가 항상 짝수(최초+재시도 쌍)인
    // 것으로 확인하고, 기록된 모든 emptyResponses 항목이 재시도했지만 끝내 해소되지 못했음을 검사한다.
    generateSectionProblemsCore.mockRejectedValue(new Error("AI 응답을 처리할 수 없습니다."));

    const result = await runGenerationPipeline(mathParams);

    expect(result.accepted).toHaveLength(0);
    expect(result.stats.emptyResponses.length).toBeGreaterThan(0);
    expect(result.stats.emptyResponses.every((e) => e.retried && !e.resolved)).toBe(true);
    // 항목 하나당 정확히 2번(최초+재시도 1회) 호출되고 그 이상 물러나지 않는다.
    expect(generateSectionProblemsCore.mock.calls.length).toBe(result.stats.emptyResponses.length * 2);
  });

  it("빈 응답이 아닌 다른 생성 예외는 재시도하지 않는다(범위를 벗어난 실패에는 재시도 예산을 안 준다)", async () => {
    const { runGenerationPipeline } = await import("./pipeline");
    generateSectionProblemsCore.mockRejectedValue(new Error("네트워크 타임아웃"));

    const result = await runGenerationPipeline(mathParams);

    expect(result.accepted).toHaveLength(0);
    expect(result.stats.emptyResponses.length).toBeGreaterThan(0);
    expect(result.stats.emptyResponses.every((e) => !e.retried && !e.resolved)).toBe(true);
    // 범위 밖 예외는 재시도 안 하므로, 기존 refill 로직이 몇 번을 부르든 호출 수와 emptyResponses
    // 건수가 1:1이어야 한다(내 재시도가 끼어들지 않았다는 뜻).
    expect(generateSectionProblemsCore.mock.calls.length).toBe(result.stats.emptyResponses.length);
  });
});
