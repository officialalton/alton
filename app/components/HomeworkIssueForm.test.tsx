// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import HomeworkIssueForm from "./HomeworkIssueForm";

vi.mock("@/app/teacher/homework-direct-client-data", () => ({ loadStudentHomeworkCreatePanelAction: vi.fn() }));
vi.mock("@/lib/homework-batch-actions", () => ({ issueHomeworkBatchAction: vi.fn() }));

describe("HomeworkIssueForm — 키워드 도메인 그룹", () => {
  it("도메인 제목 아래 키워드별 수량 입력이 묶인다(영문 표기)", () => {
    render(
      <HomeworkIssueForm
        studentId="s1"
        initialKeywords={{
          studentId: "s1",
          keywords: [
            { id: "k1", label: "Linear equations", domainCode: "algebra" },
            { id: "k2", label: "Circles", domainCode: "geometry_trig" },
            { id: "k3", label: "Legacy" },
          ],
        }}
      />
    );
    expect(screen.getByText("Algebra")).toBeInTheDocument();
    expect(screen.getByText("Geometry and Trigonometry")).toBeInTheDocument();
    expect(screen.getByText("Other")).toBeInTheDocument();
    expect(screen.getByLabelText("Circles count")).toBeInTheDocument();
  });
});
