import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TeacherShell from "./TeacherShell";
import type { TeacherDashboardData } from "./dashboard-data";
import type { RosterStudent } from "./roster-data";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/app/login/actions", () => ({
  logout: vi.fn(),
}));

const dashboard: TeacherDashboardData = {
  teacherName: "박서연",
  status: "active",
  upcoming: [],
  past: [],
  calendarByDay: {},
  calendarYear: 2026,
  calendarMonth: 7,
};

const roster: RosterStudent[] = [
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
        source: "legacy",
        curriculumSourceLabel: null,
      },
    ],
  },
];

const baseProps = {
  dashboard,
  roster,
  mySubjects: [],
  curricula: [],
  memosByEnrollment: {},
  reviews: {},
  studentFeedback: {},
  reviewedSessionIds: [],
  currentAssignments: [],
  pastAssignments: [],
  availabilityRules: [],
  availabilityExceptions: [],
  availabilityTimezone: "America/Los_Angeles",
  lessonSchedule: [],
  materialsSubjects: [],
};

describe("TeacherShell", () => {
  it("2026-09-10(UI/UX 정리 1차): 사이드바 항목을 보여주고, 기본 탭은 홈이다('배정'은 '담당 학생'으로, 미구현 '정산'은 숨김)", () => {
    render(<TeacherShell {...baseProps} />);
    ["홈", "담당 학생", "수업", "가능시간", "커리큘럼", "교재"].forEach((label) =>
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    );
    expect(screen.queryByText("학생")).toBeNull();
    expect(screen.queryByText("수업 일정")).toBeNull();
    expect(screen.queryByText("정산")).toBeNull();
    expect(screen.queryByText("배정")).toBeNull();
    expect(screen.getByText("박서연 선생님, 안녕하세요")).toBeInTheDocument();
  });

  it("수업 탭을 누르면 딱 두 개의 서브탭('예정 수업'/'지난 수업')만 보이고, 지난 수업 서브탭에는 레거시 지각·노쇼 신고 기능이 흡수되어 있다", () => {
    render(<TeacherShell {...baseProps} />);
    fireEvent.click(screen.getAllByText("수업")[0]);
    expect(screen.getByText("예정 수업")).toBeInTheDocument();
    expect(screen.getByText("지난 수업")).toBeInTheDocument();
    expect(screen.getByText("예정 수업 목록")).toBeInTheDocument();
    expect(screen.queryByText("지난 수업 기록·신고")).toBeNull();
    expect(screen.queryByText("예정/지난 수업")).toBeNull();

    fireEvent.click(screen.getByText("지난 수업"));
    expect(screen.getByText("지난 수업이 없습니다.")).toBeInTheDocument();
  });

  it("담당 학생 탭에서 학년/연락처가 보이고, C-1(2026-09-10) 이후 '커리큘럼 보기'는 없고 '운영 커리큘럼 관리'만으로 이동한다(M4 골든패스 #6/#7)", () => {
    const currentAssignments = [
      {
        assignmentId: "ta1",
        subjectEnrollmentId: "se1",
        studentId: "st1",
        studentName: "지훈",
        studentGrade: "11학년",
        studentPhone: "010-0000-0000",
        subjectId: "sub1",
        subjectName: "SAT Math",
        status: "active" as const,
        effectiveFrom: "2026-08-01T00:00:00Z",
        effectiveUntil: null,
        hasLegacyCurriculum: true,
      },
    ];
    render(<TeacherShell {...baseProps} currentAssignments={currentAssignments} />);
    fireEvent.click(screen.getAllByText("담당 학생")[0]);
    expect(screen.getByText("11학년")).toBeInTheDocument();
    expect(screen.queryByText("커리큘럼 보기")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("운영 커리큘럼 관리"));
    expect(screen.getByText("지훈 학생 · SAT Math")).toBeInTheDocument();
  });

  it("2026-09-09(UAT 지적): '교재' 탭에서 담당 과목의 공개된 교재를 볼 수 있다", () => {
    render(
      <TeacherShell
        {...baseProps}
        materialsSubjects={[
          { subjectId: "sub1", subjectName: "SAT Math", docs: [{ id: "doc1", title: "이차방정식 개념", unitTitle: "2회차" }] },
        ]}
      />
    );
    fireEvent.click(screen.getByText("교재"));
    expect(screen.getByText("SAT Math")).toBeInTheDocument();
    expect(screen.getByText(/이차방정식 개념/)).toBeInTheDocument();
  });

  it("계정 메뉴를 열면 로그아웃 버튼이 보인다", () => {
    render(<TeacherShell {...baseProps} />);
    fireEvent.click(screen.getByText("박서연 선생님 ▾"));
    expect(screen.getByText("로그아웃")).toBeInTheDocument();
  });
});
