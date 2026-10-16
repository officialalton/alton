import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ParentEnrollmentTab from "./EnrollmentTab";
import type { ChildSubjectEnrollments } from "./enrollment-data";
import type { SubjectEnrollmentView } from "@/app/student/enrollment-data";

vi.mock("@/app/parent/lesson-review-family-actions", () => ({
  getLessonReviewsForFamily: vi.fn().mockResolvedValue([]),
}));

const enrollment: SubjectEnrollmentView = {
  id: "se1",
  subjectId: "sub1",
  subjectName: "SAT Math",
  status: "active",
  currentTeacher: null,
  upcomingTeacherChange: null,
  history: [],
};

// 2026-09-18(UI 폴리싱) — 자녀별 상단 이름 행을 제거하고, 자녀가 둘 이상일
// 때만 카드 안에 소속 자녀를 표시한다(정보 손실 없이 "위에 떠 있는" 표시만 제거).
describe("ParentEnrollmentTab", () => {
  it("자녀가 1명이면 별도 자녀 표시가 없다", async () => {
    const data: ChildSubjectEnrollments[] = [
      { childId: "s1", childName: "지훈", enrollments: [enrollment] },
    ];
    render(<ParentEnrollmentTab childrenEnrollments={data} />);
    await screen.findByText("SAT Math");
    expect(screen.queryByText("지훈")).toBeNull();
  });

  it("자녀가 2명 이상이면 상단 이름 행 없이 각 과목 카드 안에 소속 자녀가 표시된다", async () => {
    const data: ChildSubjectEnrollments[] = [
      { childId: "s1", childName: "지훈", enrollments: [enrollment] },
      { childId: "s2", childName: "이서아", enrollments: [{ ...enrollment, id: "se2", subjectName: "AP Bio" }] },
    ];
    render(<ParentEnrollmentTab childrenEnrollments={data} />);
    expect(await screen.findByText("지훈")).toBeInTheDocument();
    expect(await screen.findByText("이서아")).toBeInTheDocument();
  });
});
