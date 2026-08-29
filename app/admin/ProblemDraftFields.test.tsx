import { render, screen, fireEvent } from "@testing-library/react";
import { within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProblemDraftFields from "./ProblemDraftFields";
import type { DocProblem } from "./curriculum-doc-data";

const mcDraft: Omit<DocProblem, "id"> = {
  format: "mc",
  passage: "지문",
  options: ["A", "B", "C", "D", "E"],
  correctIndex: 0,
  explanation: "해설",
  difficulty: "medium",
};

const essayDraft: Omit<DocProblem, "id"> = {
  format: "essay",
  passage: "서술형 지문",
  options: null,
  correctIndex: null,
  explanation: "모범답안 내용",
  difficulty: "medium",
};

const mathDraft: Omit<DocProblem, "id"> = {
  format: "math",
  passage: "수학 지문",
  options: null,
  correctIndex: null,
  explanation: "모범풀이",
  difficulty: "medium",
};

describe("ProblemDraftFields", () => {
  it("객관식은 선택지 5개 입력과 정답 라디오를 보여준다", () => {
    render(<ProblemDraftFields draft={mcDraft} onChange={vi.fn()} />);
    expect(screen.getAllByPlaceholderText(/선택지/)).toHaveLength(5);
    expect(screen.getAllByRole("radio")).toHaveLength(5);
  });

  it("객관식 선택지를 수정하면 onChange가 호출된다", () => {
    const onChange = vi.fn();
    render(<ProblemDraftFields draft={mcDraft} onChange={onChange} />);
    fireEvent.change(screen.getAllByPlaceholderText(/선택지/)[1], {
      target: { value: "B 수정" },
    });
    expect(onChange).toHaveBeenCalledWith({
      options: ["A", "B 수정", "C", "D", "E"],
    });
  });

  it("서술형은 선택지 UI 없이 모범답안 입력만 보여준다", () => {
    render(<ProblemDraftFields draft={essayDraft} onChange={vi.fn()} />);
    expect(screen.queryByPlaceholderText(/선택지/)).not.toBeInTheDocument();
    expect(screen.getByText("모범답안")).toBeInTheDocument();
  });

  it("수학 화이트보드형은 LaTeX 삽입 버튼과 안내 문구를 보여준다", () => {
    render(<ProblemDraftFields draft={mathDraft} onChange={vi.fn()} />);
    expect(screen.getAllByText("위첨자")).toHaveLength(2);
    expect(screen.getAllByText("분수")).toHaveLength(2);
    expect(screen.getAllByText("근호")).toHaveLength(2);
    expect(
      screen.getByText("학생은 세션뷰의 화이트보드에서 직접 풀이를 작성합니다.")
    ).toBeInTheDocument();
  });

  it("groupId가 다르면 라디오 그룹 name이 서로 달라 카드 간 충돌이 없다", () => {
    const { container } = render(
      <div>
        <div data-testid="card-0">
          <ProblemDraftFields draft={mcDraft} onChange={vi.fn()} groupId={0} />
        </div>
        <div data-testid="card-1">
          <ProblemDraftFields draft={mcDraft} onChange={vi.fn()} groupId={1} />
        </div>
      </div>
    );
    const radios0 = within(screen.getByTestId("card-0")).getAllByRole("radio") as HTMLInputElement[];
    const radios1 = within(screen.getByTestId("card-1")).getAllByRole("radio") as HTMLInputElement[];
    expect(radios0[0].name).not.toBe(radios1[0].name);
    void container;
  });
});
