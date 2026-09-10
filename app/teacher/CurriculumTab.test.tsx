import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CurriculumTab from "./CurriculumTab";
import type { RosterStudent } from "./roster-data";
import type { TeacherCurriculumData } from "./curriculum-data";
import { loadStudentCurriculumPanelData } from "./student-curriculum-actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("./mysubjects-actions", () => ({
  createMyTemplate: vi.fn(),
  addTemplateUnit: vi.fn(),
  updateTemplateUnit: vi.fn(),
  removeTemplateUnit: vi.fn(),
  moveTemplateUnit: vi.fn(),
}));

vi.mock("@/app/student/memo-actions", () => ({
  addMemo: vi.fn(),
}));

// R9 Task 3 UI 배선 — 운영 커리큘럼 화면은 loadStudentCurriculumPanelData()
// (서버 액션, requireAssignedTeacherOrAdmin으로 인가)로만 데이터를 가져온다.
vi.mock("./student-curriculum-actions", () => ({
  loadStudentCurriculumPanelData: vi.fn(),
  ensureActiveOverlay: vi.fn(),
  addCanonicalUnit: vi.fn(),
  createSupplementUnit: vi.fn(),
  excludeUnit: vi.fn(),
  moveUnit: vi.fn(),
  setUnitStatus: vi.fn(),
}));

const students: RosterStudent[] = [
  {
    studentId: "st1",
    studentName: "지훈",
    grade: null,
    subjects: [
      {
        enrollmentId: "e1",
        subjectId: "sub1",
        subjectName: "SAT Math",
        currentSession: 8,
        totalSessions: 12,
        source: "legacy",
      },
    ],
  },
];

const curricula: TeacherCurriculumData[] = [
  {
    enrollmentId: "e1",
    subjectId: "sub1",
    subjectName: "SAT Math",
    teacherName: "박서연",
    totalSessions: 12,
    currentSession: 8,
    studentId: "st1",
    studentName: "지훈",
    units: [
      {
        position: 1,
        unitTitle: "함수의 기초",
        note: null,
        teacherComment: null,
        status: "done",
        sessionId: "s1",
        scheduledAt: "2026-07-01T05:00:00.000Z",
      },
    ],
  },
];

const baseProps = {
  mySubjects: [],
  students,
  curricula,
  memosByEnrollment: {},
  reviews: {},
  studentFeedback: {},
  jumpTo: null,
  onJumpConsumed: vi.fn(),
  operatingCurriculumJumpTo: null,
  onOperatingCurriculumJumpConsumed: vi.fn(),
};

describe("CurriculumTab", () => {
  it("기본 서브탭은 내 과목이다", () => {
    render(<CurriculumTab {...baseProps} />);
    expect(screen.getByText("담당 중인 과목이 없습니다.")).toBeInTheDocument();
  });

  it("학생별 서브탭에서 학생을 고르면 그 학생의 과목이 보인다", () => {
    render(<CurriculumTab {...baseProps} />);
    fireEvent.click(screen.getByText("학생별"));
    expect(screen.getByText("SAT Math")).toBeInTheDocument();
    expect(screen.getByText("8/12회차")).toBeInTheDocument();
  });

  it("과목을 클릭하면 커리큘럼 상세로 이동한다", () => {
    render(<CurriculumTab {...baseProps} />);
    fireEvent.click(screen.getByText("학생별"));
    fireEvent.click(screen.getByText("SAT Math"));
    expect(screen.getByText("완료")).toBeInTheDocument();
  });

  it("2026-09-09 UAT 정정 — v3(teacher_assignments+subject_enrollments) 전용 배정 학생도 학생별 탭에서 빈 화면이 아니라 운영 커리큘럼으로 진입한다", async () => {
    (loadStudentCurriculumPanelData as ReturnType<typeof vi.fn>).mockResolvedValue({
      initial: { overlayId: "ov-v3", units: [] },
      library: { units: [], publishedDocs: [] },
    });

    const v3OnlyStudents: RosterStudent[] = [
      {
        studentId: "st2",
        studentName: "민지",
        grade: null,
        subjects: [
          {
            enrollmentId: "se-v3-1", // 실제로는 subject_enrollments.id
            subjectId: "sub2",
            subjectName: "SAT English",
            currentSession: 0,
            totalSessions: 0,
            source: "v3",
          },
        ],
      },
    ];

    render(
      <CurriculumTab {...baseProps} students={v3OnlyStudents} curricula={[]} />
    );
    fireEvent.click(screen.getByText("학생별"));

    // 레거시 curricula가 비어 있어도(v3 전용 배정) "아직 배정된 커리큘럼이
    // 없습니다"가 아니라 실제 과목이 보여야 한다 — 회귀 시 이 지점에서 실패.
    expect(
      screen.queryByText("아직 배정된 커리큘럼이 없습니다.")
    ).not.toBeInTheDocument();
    expect(screen.getByText("SAT English")).toBeInTheDocument();
    expect(screen.getByText("운영 커리큘럼")).toBeInTheDocument();

    fireEvent.click(screen.getByText("SAT English"));

    // 레거시 {type:"curriculum"} 빈 화면(data 없으면 null 렌더)이 아니라
    // v3 운영 커리큘럼 화면(loadStudentCurriculumPanelData 경유)으로 가야 한다.
    expect(loadStudentCurriculumPanelData).toHaveBeenCalledWith("se-v3-1", "sub2");
    await waitFor(() =>
      expect(screen.getByText("학생 운영 커리큘럼")).toBeInTheDocument()
    );
  });

  it("jumpTo가 주어지면 바로 해당 학생/과목의 커리큘럼으로 진입한다", () => {
    render(
      <CurriculumTab
        {...baseProps}
        jumpTo={{ studentId: "st1", subjectId: "sub1" }}
      />
    );
    expect(screen.getByText("완료")).toBeInTheDocument();
    expect(baseProps.onJumpConsumed).toHaveBeenCalled();
  });

  it("R9 Task 3 UI 배선 — operatingCurriculumJumpTo가 주어지면 담당 학생의 운영 커리큘럼 화면으로 바로 진입한다", async () => {
    (loadStudentCurriculumPanelData as ReturnType<typeof vi.fn>).mockResolvedValue({
      initial: { overlayId: "ov1", units: [] },
      library: { units: [], publishedDocs: [] },
    });
    const onOperatingCurriculumJumpConsumed = vi.fn();

    render(
      <CurriculumTab
        {...baseProps}
        operatingCurriculumJumpTo={{ subjectEnrollmentId: "se1", subjectId: "sub1", studentName: "지훈", subjectName: "SAT Math" }}
        onOperatingCurriculumJumpConsumed={onOperatingCurriculumJumpConsumed}
      />
    );

    expect(loadStudentCurriculumPanelData).toHaveBeenCalledWith("se1", "sub1");
    expect(onOperatingCurriculumJumpConsumed).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("학생 운영 커리큘럼")).toBeInTheDocument());
  });

  it("R9 Task 3 UI 배선 — 담당이 아닌 학생의 운영 커리큘럼으로 진입을 시도하면 로더가 에러를 보여준다(원본 데이터 노출 없음)", async () => {
    (loadStudentCurriculumPanelData as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("담당 학생의 커리큘럼만 조정할 수 있습니다.")
    );

    render(
      <CurriculumTab
        {...baseProps}
        operatingCurriculumJumpTo={{ subjectEnrollmentId: "se-not-mine", subjectId: "sub1", studentName: "지훈", subjectName: "SAT Math" }}
      />
    );

    await waitFor(() =>
      expect(screen.getByText("담당 학생의 커리큘럼만 조정할 수 있습니다.")).toBeInTheDocument()
    );
    expect(screen.queryByText("학생 운영 커리큘럼")).toBeNull();
  });
});
