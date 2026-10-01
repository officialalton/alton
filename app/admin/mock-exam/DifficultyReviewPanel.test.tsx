import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DifficultyReviewPanel from "./DifficultyReviewPanel";

const list = vi.fn();
const detail = vi.fn();
const review = vi.fn();
vi.mock("../difficulty-review-actions", () => ({
  listDifficultyReviewAction: (...a: unknown[]) => list(...a),
  getDifficultyReviewDetailAction: (...a: unknown[]) => detail(...a),
  reviewDifficultyAction: (...a: unknown[]) => review(...a),
}));

const row = (id: string, over: Record<string, unknown> = {}) => ({
  problemId: id, versionId: `v-${id}`, satDomain: "rw_craft_structure", skillCode: "words_in_context", format: "mc", createdVia: "ai_generated",
  difficulty: "hard", state: "provisional", publishedAt: "2026-09-30T00:00:00Z", confirmedAt: null, snippet: `문항 ${id} 본문`, responses: 0, correctPct: null, setsNeedReplacement: 0, ...over,
});
const page = (rows: unknown[], over: Record<string, unknown> = {}) => ({ ok: true, data: { summary: { provisional: 2, confirmed: 1, changed: 3 }, total: rows.length, rows, ...over } });
const detailData = (over: Record<string, unknown> = {}) => ({
  ok: true,
  data: {
    problemId: "p1", versionId: "v-p1", format: "mc", satDomain: "rw_craft_structure", skillCode: "words_in_context", createdVia: "ai_generated", difficulty: "hard", difficultyStatus: "provisional",
    passage: "지문 본문", question: "질문?", options: ["가", "나", "다", "라"], correctIndex: 1, answers: null, explanation: "해설", hasFigure: false,
    judge: { hardJudge: { model: "claude-fable-5-1", effort: "low", fit: true, correctOk: true, complianceOk: true, which: ["multi_step_logical_inference"], note: "추가 사고 메모" }, advisory: { model: "claude-opus-5-5", fit: false, note: "반대 의견" }, recipeId: "r1", recipeCheck: { compliance: { met: 3, minMet: 2, of: 4, ok: true } }, hardBasis: "recipe", generationStatus: "provisional_ai", generatedBy: "claude-opus-5-5", estimatedDifficulty: null, difficultyReasons: null },
    stats: { responses: 12, correct: 6, correctPct: 50 }, history: [], sets: [], ...over,
  },
});

beforeEach(() => {
  list.mockReset(); detail.mockReset(); review.mockReset();
});

describe("DifficultyReviewPanel", () => {
  it("요약 카드(잠정·확인됨·변경됨)와 잠정 기본 필터 목록을 보여준다", async () => {
    list.mockResolvedValue(page([row("p1"), row("p2")]));
    render(<DifficultyReviewPanel />);
    expect(screen.getByTestId("difficulty-loading")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByTestId("difficulty-row")).toHaveLength(2));
    expect(screen.getByTestId("summary-provisional")).toHaveTextContent("2");
    expect(screen.getByTestId("summary-confirmed")).toHaveTextContent("1");
    expect(screen.getByTestId("summary-changed")).toHaveTextContent("3");
    expect(list.mock.calls[0][0]).toMatchObject({ status: "provisional", pageSize: 20, page: 0 });
  });

  it("빈 상태·오류 상태(다시 시도)", async () => {
    list.mockResolvedValueOnce(page([], { total: 0 }));
    const { unmount } = render(<DifficultyReviewPanel />);
    await waitFor(() => expect(screen.getByTestId("difficulty-empty")).toHaveTextContent("점검할 잠정 hard 문항이 없습니다."));
    unmount();
    list.mockResolvedValueOnce({ ok: false, error: "난이도 점검 목록을 불러오지 못했습니다." }).mockResolvedValueOnce(page([row("p1")]));
    render(<DifficultyReviewPanel />);
    await waitFor(() => expect(screen.getByTestId("difficulty-error")).toHaveTextContent("불러오지 못했습니다"));
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(screen.getAllByTestId("difficulty-row")).toHaveLength(1));
  });

  it("상세: AI 판정 근거·참고 의견·응답 통계를 보여주고, 기록이 없으면 '근거 기록 없음'", async () => {
    list.mockResolvedValue(page([row("p1")]));
    detail.mockResolvedValueOnce(detailData());
    render(<DifficultyReviewPanel />);
    await waitFor(() => screen.getByTestId("difficulty-row"));
    fireEvent.click(screen.getByRole("button", { name: "상세" }));
    await waitFor(() => expect(screen.getByTestId("judge-hard 검수")).toHaveTextContent("claude-fable-5-1"));
    expect(screen.getByTestId("judge-hard 검수")).toHaveTextContent("추가 사고 메모");
    expect(screen.getByTestId("judge-참고 의견")).toHaveTextContent("반대 의견");
    expect(screen.getByTestId("recipe-compliance")).toHaveTextContent("3/4");
    expect(screen.getByTestId("difficulty-stats")).toHaveTextContent("응답 12건 · 정답률 50%");
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    detail.mockResolvedValueOnce(detailData({ judge: { hardJudge: null, advisory: null, recipeId: null, recipeCheck: null, hardBasis: null, generationStatus: null, generatedBy: null, estimatedDifficulty: null, difficultyReasons: null }, stats: { responses: 0, correct: 0, correctPct: null } }));
    fireEvent.click(screen.getByRole("button", { name: "상세" }));
    await waitFor(() => expect(screen.getByTestId("basis-empty")).toHaveTextContent("근거 기록 없음"));
    expect(screen.getByTestId("difficulty-stats")).toHaveTextContent("아직 응답이 없습니다");
  });

  it("상세의 수식은 원문($…$)이 아니라 수식으로 그려진다", async () => {
    list.mockResolvedValue(page([row("p1")]));
    detail.mockResolvedValue(detailData({ passage: "그래프 $y = x^2 + 6$ 은", question: "$x$ 좌표는?", options: ["$-2$", "$2$", "$4$", "$10$"], explanation: "해설 $x^2 - 4x + 4 = 0$" }));
    render(<DifficultyReviewPanel />);
    await waitFor(() => screen.getByTestId("difficulty-row"));
    fireEvent.click(screen.getByRole("button", { name: "상세" }));
    await waitFor(() => screen.getByTestId("difficulty-detail"));
    const box = screen.getByTestId("difficulty-detail");
    expect(box.querySelectorAll(".katex").length).toBeGreaterThanOrEqual(5);
    expect(box.textContent).not.toContain("$y = x^2 + 6$");
  });

  it("단건 확인(hard 유지)은 사유 없이 가능, 변경은 사유가 없으면 호출하지 않는다", async () => {
    list.mockResolvedValue(page([row("p1")]));
    detail.mockResolvedValue(detailData());
    review.mockResolvedValue({ ok: true, confirmed: 1, changed: 0, skipped: 0, needsSetReplacement: [] });
    render(<DifficultyReviewPanel />);
    await waitFor(() => screen.getByTestId("difficulty-row"));
    fireEvent.click(screen.getByRole("button", { name: "상세" }));
    await waitFor(() => screen.getByTestId("difficulty-detail"));
    fireEvent.click(screen.getByRole("button", { name: "medium으로 변경" }));
    expect(review).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("사유 메모");
    fireEvent.click(screen.getByRole("button", { name: "난이도 확인(hard 유지)" }));
    await waitFor(() => expect(review).toHaveBeenCalledWith({ problemIds: ["p1"], to: "hard", reason: undefined }));
    await waitFor(() => expect(screen.getByTestId("difficulty-notice")).toHaveTextContent("확인 1건"));
    expect(list.mock.calls.length).toBeGreaterThanOrEqual(2); // 저장 뒤 목록·요약 재조회
  });

  it("일괄 선택 후 변경: 사유를 보내고, 세트 교체 필요 안내를 표시한다", async () => {
    list.mockResolvedValue(page([row("p1"), row("p2")]));
    review.mockResolvedValue({ ok: true, confirmed: 0, changed: 2, skipped: 0, needsSetReplacement: ["p1"] });
    render(<DifficultyReviewPanel />);
    await waitFor(() => screen.getAllByTestId("difficulty-row"));
    fireEvent.click(screen.getByLabelText("이 페이지 전체 선택"));
    const bulk = await screen.findByTestId("difficulty-bulk");
    expect(bulk).toHaveTextContent("2개 선택됨");
    fireEvent.change(within(bulk).getByLabelText("일괄 사유 메모"), { target: { value: "표본 재검토" } });
    fireEvent.click(within(bulk).getByRole("button", { name: "easy로 변경" }));
    await waitFor(() => expect(review).toHaveBeenCalledWith({ problemIds: ["p1", "p2"], to: "easy", reason: "표본 재검토" }));
    await waitFor(() => expect(screen.getByTestId("difficulty-notice")).toHaveTextContent("세트 교체 필요 1건"));
    expect(screen.queryByTestId("difficulty-bulk")).not.toBeInTheDocument();
  });

  it("서버 오류는 한국어 메시지로 표시하고 선택을 유지한다", async () => {
    list.mockResolvedValue(page([row("p1")]));
    review.mockResolvedValue({ ok: false, error: "공개된 문항만 난이도를 점검할 수 있습니다." });
    render(<DifficultyReviewPanel />);
    await waitFor(() => screen.getByTestId("difficulty-row"));
    fireEvent.click(screen.getByLabelText("이 페이지 전체 선택"));
    const bulk = await screen.findByTestId("difficulty-bulk");
    fireEvent.click(within(bulk).getByRole("button", { name: "난이도 확인(hard 유지)" }));
    await waitFor(() => expect(screen.getByTestId("difficulty-notice")).toHaveTextContent("공개된 문항만"));
    expect(screen.getByTestId("difficulty-bulk")).toBeInTheDocument();
  });

  it("세트 교체 필요 배지·확인됨 행은 hard 확인 버튼이 비활성, 필터 변경은 서버 조회로 위임", async () => {
    list.mockResolvedValue(page([row("p1", { state: "confirmed", setsNeedReplacement: 2 })]));
    render(<DifficultyReviewPanel />);
    await waitFor(() => screen.getByTestId("difficulty-row"));
    expect(screen.getByText("세트 교체 필요 2")).toBeInTheDocument();
    detail.mockResolvedValue(detailData());
    fireEvent.click(screen.getByRole("button", { name: "상세" }));
    expect(await screen.findByRole("button", { name: "난이도 확인(hard 유지)" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("영역"), { target: { value: "rw_craft_structure" } });
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ satDomain: "rw_craft_structure", page: 0 })));
  });
});
