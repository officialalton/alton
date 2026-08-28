import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RosterTab from "./RosterTab";
import type { RosterStudent } from "./roster-data";

const students: RosterStudent[] = [
  {
    studentId: "st1",
    studentName: "지훈",
    grade: "11학년",
    subjects: [
      {
        enrollmentId: "e1",
        subjectId: "sub1",
        subjectName: "SAT Math",
        currentSession: 8,
        totalSessions: 12,
      },
      {
        enrollmentId: "e2",
        subjectId: "sub2",
        subjectName: "AP Statistics",
        currentSession: 1,
        totalSessions: 12,
      },
    ],
  },
];

describe("RosterTab", () => {
  it("학생과 과목별 진행 회차를 보여준다", () => {
    render(<RosterTab students={students} onOpenCurriculum={vi.fn()} />);
    expect(screen.getByText("지훈")).toBeInTheDocument();
    expect(screen.getByText(/SAT Math · 8\/12회차/)).toBeInTheDocument();
    expect(screen.getByText(/AP Statistics · 1\/12회차/)).toBeInTheDocument();
  });

  it("과목 칩을 클릭하면 studentId/subjectId와 함께 콜백이 호출된다", () => {
    const onOpenCurriculum = vi.fn();
    render(<RosterTab students={students} onOpenCurriculum={onOpenCurriculum} />);
    fireEvent.click(screen.getByText(/SAT Math · 8\/12회차/));
    expect(onOpenCurriculum).toHaveBeenCalledWith("st1", "sub1");
  });

  it("담당 학생이 없으면 안내 문구를 보여준다", () => {
    render(<RosterTab students={[]} onOpenCurriculum={vi.fn()} />);
    expect(screen.getByText("담당 중인 학생이 없습니다.")).toBeInTheDocument();
  });
});
