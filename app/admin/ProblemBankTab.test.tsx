import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProblemBankTab from "./ProblemBankTab";
import type { AdminSubject } from "./subject-data";

vi.mock("./problem-bank-actions", () => ({
  listBankProblemsAction: (...a: unknown[]) => listBankProblemsAction(...a),
  loadProblemVersionsAction: (...a: unknown[]) => loadProblemVersionsAction(...a),
  createBankProblemAction: (...a: unknown[]) => createBankProblemAction(...a),
  createDraftVersionAction: (...a: unknown[]) => createDraftVersionAction(...a),
  submitVersionForReviewAction: (...a: unknown[]) => submitVersionForReviewAction(...a),
  publishVersionAction: (...a: unknown[]) => publishVersionAction(...a),
  setProblemArchivedAction: (...a: unknown[]) => setProblemArchivedAction(...a),
  generateBankProblemsAction: (...a: unknown[]) => generateBankProblemsAction(...a),
}));

const listBankProblemsAction = vi.fn();
const loadProblemVersionsAction = vi.fn();
const createBankProblemAction = vi.fn();
const createDraftVersionAction = vi.fn();
const submitVersionForReviewAction = vi.fn();
const publishVersionAction = vi.fn();
const setProblemArchivedAction = vi.fn();
const generateBankProblemsAction = vi.fn();

const subjects: AdminSubject[] = [
  { subjectId: "sub1", subjectName: "SAT Math", units: [] },
  { subjectId: "sub9", subjectName: "보관 과목", units: [], archivedAt: "2026-09-11T00:00:00Z" },
];

const problem = {
  id: "p1",
  format: "mc",
  passage: "판별식이 0일 때",
  skillType: "판별식",
  difficulty: "medium",
  subjectId: "sub1",
  subjectName: "SAT Math",
  archived: false,
  workState: "draft" as const,
  keywords: [{ id: "kw1", label: "이차방정식" }],
  updatedAt: "2026-09-12T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  listBankProblemsAction.mockResolvedValue([problem]);
  loadProblemVersionsAction.mockResolvedValue([
    { id: "v1", versionNo: 1, status: "draft", passage: "판별식이 0일 때", options: null, correctIndex: null, explanation: null, difficulty: "medium", createdAt: "", publishedAt: null },
  ]);
  createBankProblemAction.mockResolvedValue({ ok: true, value: "p2" });
  createDraftVersionAction.mockResolvedValue({ ok: true, value: "v2" });
  submitVersionForReviewAction.mockResolvedValue({ ok: true });
  publishVersionAction.mockResolvedValue({ ok: true });
  setProblemArchivedAction.mockResolvedValue({ ok: true });
  generateBankProblemsAction.mockResolvedValue({ ok: true, value: 3 });
});

describe("ProblemBankTab — 독립 진입점", () => {
  it("과목·상태·형식·검색으로 좁힐 수 있다", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    await waitFor(() => expect(screen.getByText("판별식이 0일 때")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("과목"), { target: { value: "sub1" } });
    await waitFor(() =>
      expect(listBankProblemsAction).toHaveBeenCalledWith(expect.objectContaining({ subjectId: "sub1" }))
    );

    fireEvent.change(screen.getByLabelText("상태"), { target: { value: "in_review" } });
    await waitFor(() =>
      expect(listBankProblemsAction).toHaveBeenCalledWith(expect.objectContaining({ workState: "in_review" }))
    );

    fireEvent.change(screen.getByLabelText("문제 검색"), { target: { value: "판별" } });
    await waitFor(() =>
      expect(listBankProblemsAction).toHaveBeenCalledWith(expect.objectContaining({ query: "판별" }))
    );
  });

  it("보관 과목은 새 문제 대상으로 고를 수 없다", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    await waitFor(() => expect(screen.getByLabelText("새 문제 과목")).toBeInTheDocument());
    const select = screen.getByLabelText("새 문제 과목");
    expect(select.querySelectorAll("option")).toHaveLength(2); // 안내 + SAT Math
    expect(screen.queryByRole("option", { name: "보관 과목" })).not.toBeInTheDocument();
  });

  it("현재와 보관됨을 섞지 않고, 기본 진입은 현재다", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    await waitFor(() => expect(listBankProblemsAction).toHaveBeenCalledWith({}));

    fireEvent.click(screen.getByText("보관됨"));
    await waitFor(() =>
      expect(listBankProblemsAction).toHaveBeenCalledWith(expect.objectContaining({ archived: true }))
    );
  });
});

describe("ProblemBankTab — 자동 공개는 없다", () => {
  it("AI로 만들어도 초안으로만 들어간다고 알려준다", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    await waitFor(() => expect(screen.getByLabelText("새 문제 과목")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("새 문제 과목"), { target: { value: "sub1" } });
    fireEvent.change(screen.getByLabelText("주제"), { target: { value: "판별식" } });
    fireEvent.click(screen.getByText("AI로 만들기"));

    await waitFor(() =>
      expect(screen.getByText(/3개를 초안으로 만들었습니다. 검수 후 공개하세요./)).toBeInTheDocument()
    );
    // 생성 경로에 공개가 섞여 있지 않다.
    expect(publishVersionAction).not.toHaveBeenCalled();
  });

  it("초안에는 검수 요청만, 공개 버튼은 없다", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    await waitFor(() => expect(screen.getByText("판별식이 0일 때")).toBeInTheDocument());
    fireEvent.click(screen.getByText("판별식이 0일 때"));

    await waitFor(() => expect(screen.getByText("검수 요청")).toBeInTheDocument());
    expect(screen.queryByText("공개")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("검수 요청"));
    await waitFor(() => expect(submitVersionForReviewAction).toHaveBeenCalledWith("v1"));
  });

  it("검수 중인 버전에만 공개 버튼이 나온다", async () => {
    loadProblemVersionsAction.mockResolvedValue([
      { id: "v1", versionNo: 1, status: "in_review", passage: "x", options: null, correctIndex: null, explanation: null, difficulty: null, createdAt: "", publishedAt: null },
    ]);
    render(<ProblemBankTab subjects={subjects} />);
    await waitFor(() => expect(screen.getByText("판별식이 0일 때")).toBeInTheDocument());
    fireEvent.click(screen.getByText("판별식이 0일 때"));

    await waitFor(() => expect(screen.getByText("공개")).toBeInTheDocument());
    expect(screen.queryByText("검수 요청")).not.toBeInTheDocument();
  });

  it("객관식 정답 번호는 화면의 1부터를 0부터로 바꿔 저장한다", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    await waitFor(() => expect(screen.getByText("판별식이 0일 때")).toBeInTheDocument());
    fireEvent.click(screen.getByText("판별식이 0일 때"));
    await waitFor(() => expect(screen.getByLabelText("지문")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("지문"), { target: { value: "새 지문" } });
    fireEvent.change(screen.getByLabelText("선택지"), { target: { value: "가|나|다" } });
    fireEvent.change(screen.getByLabelText("정답 번호"), { target: { value: "2" } });
    fireEvent.click(screen.getByText("초안 저장"));

    await waitFor(() =>
      expect(createDraftVersionAction).toHaveBeenCalledWith(
        expect.objectContaining({ correctIndex: 1, options: ["가", "나", "다"] })
      )
    );
  });

  it("보관은 삭제가 아니라고 알려준다", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    await waitFor(() => expect(screen.getByText("보관")).toBeInTheDocument());
    fireEvent.click(screen.getByText("보관"));
    await waitFor(() =>
      expect(screen.getByText(/보관했습니다. 과거 기록은 그대로 남습니다./)).toBeInTheDocument()
    );
  });

  it("실패 사유를 화면에 보여준다", async () => {
    submitVersionForReviewAction.mockResolvedValue({ ok: false, error: "검수 요청에 실패했습니다." });
    render(<ProblemBankTab subjects={subjects} />);
    await waitFor(() => expect(screen.getByText("판별식이 0일 때")).toBeInTheDocument());
    fireEvent.click(screen.getByText("판별식이 0일 때"));
    await waitFor(() => expect(screen.getByText("검수 요청")).toBeInTheDocument());

    fireEvent.click(screen.getByText("검수 요청"));
    await waitFor(() => expect(screen.getByText("검수 요청에 실패했습니다.")).toBeInTheDocument());
  });
});
