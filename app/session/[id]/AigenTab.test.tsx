import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AigenTab from "./AigenTab";
import * as aigenActions from "./aigen-actions";

vi.mock("./aigen-actions", () => ({
  generateProblems: vi.fn(),
  finalizeProblemsToHomework: vi.fn(),
}));

const draft = {
  format: "mc" as const,
  passage: "다음 중 이차방정식의 해가 아닌 것은?",
  options: ["1", "2", "3", "4"],
  correctIndex: 2,
  explanation: "정답은 3입니다.",
  skillType: "개념 문제",
  difficulty: "medium" as const,
};

describe("AigenTab", () => {
  it("단원/문제 유형을 채우지 않으면 생성하기가 비활성화된다", () => {
    render(
      <AigenTab
        sessionId="s1"
        subjectId="sub1"
        subjectName="SAT Math"
        unitOptions={["이차방정식 단원"]}
        onFinalized={vi.fn()}
      />
    );
    expect(screen.getByText("생성하기")).toBeDisabled();
  });

  it("조건을 채우고 생성하면 초안 카드가 뜨고, 확정하면 onFinalized가 호출된다", async () => {
    vi.mocked(aigenActions.generateProblems).mockResolvedValue([draft]);
    vi.mocked(aigenActions.finalizeProblemsToHomework).mockResolvedValue([
      { id: "hw1", title: "개념 문제 (객관식)", description: draft.passage },
    ]);
    const onFinalized = vi.fn();

    render(
      <AigenTab
        sessionId="s1"
        subjectId="sub1"
        subjectName="SAT Math"
        unitOptions={["이차방정식 단원"]}
        onFinalized={onFinalized}
      />
    );

    fireEvent.change(
      screen.getByPlaceholderText("예: 개념 문제, 응용 문제, Words in Context"),
      { target: { value: "개념 문제" } }
    );
    fireEvent.click(screen.getByText("생성하기"));

    await waitFor(() =>
      expect(screen.getByText("초안 1")).toBeInTheDocument()
    );
    expect(screen.getByDisplayValue(draft.passage)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /과제로 확정/ }));

    await waitFor(() =>
      expect(aigenActions.finalizeProblemsToHomework).toHaveBeenCalledWith(
        "s1",
        "sub1",
        [draft]
      )
    );
    await waitFor(() => expect(onFinalized).toHaveBeenCalled());
  });

  it("초안 삭제 버튼을 누르면 카드가 사라진다", async () => {
    vi.mocked(aigenActions.generateProblems).mockResolvedValue([draft]);

    render(
      <AigenTab
        sessionId="s1"
        subjectId="sub1"
        subjectName="SAT Math"
        unitOptions={["이차방정식 단원"]}
        onFinalized={vi.fn()}
      />
    );

    fireEvent.change(
      screen.getByPlaceholderText("예: 개념 문제, 응용 문제, Words in Context"),
      { target: { value: "개념 문제" } }
    );
    fireEvent.click(screen.getByText("생성하기"));
    await waitFor(() =>
      expect(screen.getByText("초안 1")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByText("삭제"));
    expect(screen.queryByText("초안 1")).not.toBeInTheDocument();
  });
});
