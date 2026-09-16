import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomeworkTab from "./HomeworkTab";
import type { HomeworkBatch } from "@/lib/homework-batch-data";

// 2026-09-16(제품 오너 2차 정정) — 과제는 수업(세션)과 무관하다. 세션뷰의 과제 탭은 학생 포털·
// 교사 포털 "과제 내역"과 같은 화면(HomeworkBatchPanel)을 그대로 보여준다.

const batch: HomeworkBatch = {
  id: "b1", teacherId: "t1", teacherName: "김선생", studentId: "stu", label: "9월 16일 과제", subjectId: null, subjectName: null, createdAt: "2026-09-16T00:00:00Z",
  items: [{
    problemId: "p1", position: 1, format: "mc", passage: "지문", question: "값은?", options: ["1", "2", "3", "4"],
    correctIndex: 0, answers: null, explanation: "해설", statements: null, figure: null,
    response: null, submittedAt: null, autoCorrect: null, graded: false, gradedAt: null, grade: null, gradeComment: null,
  }],
};

describe("HomeworkTab — 배치 단위 과제(2026-09-16, 세션과 무관)", () => {
  it("교사 실제 역할이면 채점 모드(HomeworkBatchPanel viewerRole=teacher)로 보여준다", () => {
    render(<HomeworkTab studentId="stu" initialItems={[]} viewerRole="teacher" realViewerRole="teacher" homeworkBatches={[batch]} />);
    expect(screen.getByRole("tab", { name: /9월 16일 과제/ })).toBeInTheDocument();
    expect(screen.getByText("학생 답")).toBeInTheDocument(); // 교사 채점 화면 전용 라벨
  });

  it("학생 역할이면 응시 화면으로 보여준다", () => {
    render(<HomeworkTab studentId="stu" initialItems={[]} viewerRole="student" realViewerRole="student" homeworkBatches={[batch]} />);
    expect(screen.getByText("답 제출")).toBeInTheDocument();
  });

  it("배치가 없으면 안내만 보인다", () => {
    render(<HomeworkTab studentId="stu" initialItems={[]} viewerRole="student" realViewerRole="student" homeworkBatches={[]} />);
    expect(screen.getByText(/아직 발급된 과제가 없습니다/)).toBeInTheDocument();
  });

  it("레거시 과제 기록은 읽기 전용으로만 보인다", () => {
    render(
      <HomeworkTab
        studentId="stu"
        initialItems={[{ id: "l1", title: "옛 과제", description: "설명", studentAnswer: "내 답" }]}
        viewerRole="student"
        realViewerRole="student"
        homeworkBatches={[]}
      />
    );
    expect(screen.getByText("옛 과제")).toBeInTheDocument();
    expect(screen.getByText("내 답")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
