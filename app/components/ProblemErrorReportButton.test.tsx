import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProblemErrorReportButton from "./ProblemErrorReportButton";

const submit = vi.fn();
vi.mock("@/lib/problem-error-reports/actions", () => ({
  submitProblemErrorReportAction: (...a: unknown[]) => submit(...a),
}));

const ctx = { source: "mock_exam", attemptId: "a1", setItemId: "i1" } as const;
beforeEach(() => submit.mockReset());

const open = () => fireEvent.click(screen.getByRole("button", { name: "문제 오류 신고" }));

describe("ProblemErrorReportButton", () => {
  it("학생 UI 에는 해설 오류 유형이 없고 선생님 UI 에는 있다", () => {
    const { unmount } = render(<ProblemErrorReportButton context={ctx} role="student" />);
    open();
    expect(screen.getAllByRole("radio").map((r) => (r.closest("label") as HTMLElement).textContent)).toEqual([
      expect.stringContaining("정답 오류"),
      expect.stringContaining("문제 자체 오류"),
      expect.stringContaining("기타"),
    ]);
    expect(screen.queryByText("해설 오류")).toBeNull();
    unmount();
    render(<ProblemErrorReportButton context={ctx} role="teacher" />);
    open();
    expect(screen.getByText("해설 오류")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
  });

  it("유형을 고르기 전에는 보낼 수 없고, 기타는 메모가 필수다", () => {
    render(<ProblemErrorReportButton context={ctx} role="student" />);
    open();
    const send = screen.getByRole("button", { name: "신고하기" });
    expect(send).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/기타/));
    expect(send).toBeDisabled();
    expect(screen.getByText("메모 (필수)")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/메모/), { target: { value: "표가 깨져요" } });
    expect(send).toBeEnabled();
  });

  it("접수되면 안내 문구를 보이고 버튼은 '신고함 · 검토 중'으로 바뀐다", async () => {
    submit.mockResolvedValue({ ok: true, value: { duplicate: false } });
    render(<ProblemErrorReportButton context={ctx} role="student" />);
    open();
    fireEvent.click(screen.getByLabelText(/정답 오류/));
    fireEvent.click(screen.getByRole("button", { name: "신고하기" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("신고가 접수됐어요"));
    expect(submit).toHaveBeenCalledWith({ context: ctx, reportType: "wrong_key", memo: null });
    expect(screen.getByRole("button", { name: "신고함 · 검토 중" })).toBeInTheDocument();
  });

  it("이미 신고한 문항은 중복 안내, 서버 오류는 그 자리에서 보여준다", async () => {
    submit.mockResolvedValueOnce({ ok: true, value: { duplicate: true } });
    const { unmount } = render(<ProblemErrorReportButton context={ctx} role="teacher" />);
    open();
    fireEvent.click(screen.getByLabelText(/해설 오류/));
    fireEvent.click(screen.getByRole("button", { name: "신고하기" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("이미 신고한 문항"));
    unmount();
    submit.mockResolvedValueOnce({ ok: false, error: "문항을 찾을 수 없습니다." });
    render(<ProblemErrorReportButton context={ctx} role="student" />);
    open();
    fireEvent.click(screen.getByLabelText(/문제 자체 오류/));
    fireEvent.click(screen.getByRole("button", { name: "신고하기" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("문항을 찾을 수 없습니다."));
  });

  it("Esc 로 닫히고 포커스가 버튼으로 돌아온다(키보드 동작)", () => {
    render(<ProblemErrorReportButton context={ctx} role="student" />);
    open();
    const form = screen.getByRole("form", { name: "문제 오류 신고" });
    fireEvent.keyDown(form, { key: "Escape" });
    expect(screen.queryByRole("form", { name: "문제 오류 신고" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "문제 오류 신고" }));
  });

  it("이미 신고한 문항은 진행 상태 문구로 시작한다", () => {
    render(<ProblemErrorReportButton context={ctx} role="student" initialStatus="not_error" />);
    expect(screen.getByRole("button", { name: /오류가 아닌 것으로 판단/ })).toBeInTheDocument();
  });
});
