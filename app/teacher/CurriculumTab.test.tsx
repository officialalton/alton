import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CurriculumTab from "./CurriculumTab";
import type { RosterStudent } from "./roster-data";
import type { TeacherCurriculumData } from "./curriculum-data";
import { loadStudentCurriculumPanelData } from "./student-curriculum-actions";
import { loadLegacyCurriculumDetail, loadReviewDetail } from "./legacy-curriculum-actions";

// 2026-09-11(제품 오너 UAT — 첫 진입 지연 재지적) — 레거시 커리큘럼 상세는
// 이제 이 화면을 열 때만 legacy-curriculum-actions.ts로 온디맨드 조회한다
// (예전엔 curricula/memosByEnrollment/reviews/studentFeedback을 부모가
// 미리 다 가져와 props로 내려줬다).
vi.mock("./legacy-curriculum-actions", () => ({
  loadLegacyCurriculumDetail: vi.fn(),
  loadReviewDetail: vi.fn(),
}));

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
        curriculumSourceLabel: null,
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

  it("과목을 클릭하면 커리큘럼 상세로 이동한다(온디맨드 조회)", async () => {
    (loadLegacyCurriculumDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
      curriculum: curricula[0],
      memos: [],
    });
    render(<CurriculumTab {...baseProps} />);
    fireEvent.click(screen.getByText("학생별"));
    fireEvent.click(screen.getByText("SAT Math"));
    expect(loadLegacyCurriculumDetail).toHaveBeenCalledWith("e1");
    await waitFor(() => expect(screen.getByText("완료")).toBeInTheDocument());
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
            curriculumSourceLabel: null,
          },
        ],
      },
    ];

    render(
      <CurriculumTab {...baseProps} students={v3OnlyStudents} />
    );
    fireEvent.click(screen.getByText("학생별"));

    // 레거시 curricula가 비어 있어도(v3 전용 배정) "아직 배정된 커리큘럼이
    // 없습니다"가 아니라 실제 과목이 보여야 한다 — 회귀 시 이 지점에서 실패.
    expect(
      screen.queryByText("아직 배정된 커리큘럼이 없습니다.")
    ).not.toBeInTheDocument();
    expect(screen.getByText("SAT English")).toBeInTheDocument();
    // C-1(2026-09-10) — 단순 "운영 커리큘럼" 표기·"0/0회차" 대신
    // curriculum_overlay_units 기준 진도 문구를 보여준다.
    expect(screen.getByText("진도 미시작 · 회차 0개")).toBeInTheDocument();

    fireEvent.click(screen.getByText("SAT English"));

    // 레거시 {type:"curriculum"} 빈 화면(data 없으면 null 렌더)이 아니라
    // v3 운영 커리큘럼 화면(loadStudentCurriculumPanelData 경유)으로 가야 한다.
    expect(loadStudentCurriculumPanelData).toHaveBeenCalledWith("se-v3-1", "sub2");
    await waitFor(() =>
      expect(screen.getByText("학생 운영 커리큘럼")).toBeInTheDocument()
    );
  });

  it("jumpTo가 주어지면 바로 해당 학생/enrollment의 커리큘럼으로 진입한다", async () => {
    (loadLegacyCurriculumDetail as ReturnType<typeof vi.fn>).mockResolvedValue({
      curriculum: curricula[0],
      memos: [],
    });
    render(
      <CurriculumTab
        {...baseProps}
        jumpTo={{ studentId: "st1", enrollmentId: "e1" }}
      />
    );
    await waitFor(() => expect(screen.getByText("완료")).toBeInTheDocument());
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

  // 2026-09-11(제품 오너 지적 — 캐시 정확성) — "운영 커리큘럼 관리"↔"세션
  // 준비"를 오갈 때 체감 속도를 위해 부모 캐시로 즉시 렌더하되, 서버 재검증
  // (requireAssignedTeacherOrAdmin 재실행 포함)은 매번 실제로 일어나야 한다
  // — 캐시가 있다고 서버 호출 자체를 건너뛰면 (1) 이전 방문 중 저장한 편집
  // 내용이 반영 안 된 오래된 화면을 보여줄 수 있고, (2) 선생님 변경·매칭
  // 종료 후에도 권한 재검증 없이 화면이 그대로 열릴 수 있다.
  it("운영 커리큘럼↔세션 준비를 오가도 매번 서버에서 다시 검증·조회한다(캐시로 요청을 건너뛰지 않음)", async () => {
    const mockFn = loadStudentCurriculumPanelData as ReturnType<typeof vi.fn>;
    mockFn.mockClear();
    mockFn.mockResolvedValue({
      initial: { overlayId: "ov1", units: [] },
      library: { units: [], publishedDocs: [], keywords: [] },
    });

    render(
      <CurriculumTab
        {...baseProps}
        operatingCurriculumJumpTo={{ subjectEnrollmentId: "se1", subjectId: "sub1", studentName: "지훈", subjectName: "SAT Math" }}
      />
    );
    await waitFor(() => expect(screen.getByText("학생 운영 커리큘럼")).toBeInTheDocument());
    expect(mockFn).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("세션 준비 하기 →"));
    await waitFor(() => expect(screen.getByText("세션 준비")).toBeInTheDocument());
    // 부모 캐시가 있어 화면은 바로 뜨지만, 서버 재검증 호출은 여전히 나가야 한다.
    expect(mockFn).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByText("← 뒤로"));
    await waitFor(() => expect(screen.getByText("학생 운영 커리큘럼")).toBeInTheDocument());
    expect(mockFn).toHaveBeenCalledTimes(3);
    expect(mockFn).toHaveBeenNthCalledWith(3, "se1", "sub1");
  });
});
