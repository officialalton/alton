import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import VocabTab from "./VocabTab";
import * as vocabActions from "./vocab-actions";

vi.mock("./vocab-actions", () => ({
  removeVocabWord: vi.fn().mockResolvedValue(undefined),
}));

const words = [
  {
    id: "v1",
    word: "complicate",
    definition: "복잡하게 만들다",
    example: "The new evidence complicates our understanding.",
    similarWords: ["confuse", "muddle", "entangle"],
    createdAt: "2026-08-01T00:00:00.000Z",
  },
];

describe("VocabTab", () => {
  it("단어가 없으면 안내 문구를 보여준다", () => {
    render(<VocabTab initialWords={[]} isTeacher={false} canManage={true} studentName="지훈" />);
    expect(screen.getByText(/아직 저장한 단어가 없습니다/)).toBeInTheDocument();
  });

  it("단어가 있으면 뜻/예문/비슷한 단어를 보여준다", () => {
    render(
      <VocabTab initialWords={words} isTeacher={false} canManage={true} studentName="지훈" />
    );
    expect(screen.getByText("complicate")).toBeInTheDocument();
    expect(screen.getByText("복잡하게 만들다")).toBeInTheDocument();
    expect(screen.getByText("confuse")).toBeInTheDocument();
  });

  it("선생님 뷰에서는 제목이 'OO 학생의 단어장'으로 바뀐다", () => {
    render(
      <VocabTab initialWords={words} isTeacher={true} canManage={false} studentName="지훈" />
    );
    expect(
      screen.getByRole("heading", { name: "지훈 학생의 단어장" })
    ).toBeInTheDocument();
  });

  it("canManage가 false면 삭제 버튼이 보이지 않는다 (RLS상 선생님은 삭제 불가)", () => {
    render(
      <VocabTab initialWords={words} isTeacher={true} canManage={false} studentName="지훈" />
    );
    expect(screen.queryByText("삭제")).not.toBeInTheDocument();
  });

  it("삭제를 누르면 목록에서 사라지고 서버 액션을 호출한다", async () => {
    render(
      <VocabTab initialWords={words} isTeacher={false} canManage={true} studentName="지훈" />
    );
    fireEvent.click(screen.getByText("삭제"));
    await waitFor(() =>
      expect(screen.queryByText("complicate")).not.toBeInTheDocument()
    );
    expect(vocabActions.removeVocabWord).toHaveBeenCalledWith("v1");
  });
});
