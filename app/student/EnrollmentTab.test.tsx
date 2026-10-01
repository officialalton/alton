import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import EnrollmentTab from "./EnrollmentTab";
import { getLessonReviewsForFamily } from "@/app/parent/lesson-review-family-actions";
import { loadMyCurriculumOverlay } from "./curriculum-overlay-actions";
import type { SubjectEnrollmentView } from "./enrollment-data";

vi.mock("@/app/parent/lesson-review-family-actions", () => ({
  getLessonReviewsForFamily: vi.fn(),
}));

vi.mock("./curriculum-overlay-actions", () => ({
  loadMyCurriculumOverlay: vi.fn(),
}));

const enrollment: SubjectEnrollmentView = {
  id: "se1",
  subjectId: "sub1",
  subjectName: "SAT Math",
  status: "active",
  currentTeacher: { id: "a1", teacherId: "t1", teacherName: "박서연 선생님", status: "active", effectiveFrom: "2026-08-01T00:00:00Z", effectiveUntil: null, reason: null },
  upcomingTeacherChange: null,
  history: [],
};

// 2026-09-17(제품 오너 피드백) — 체험 수업으로 제한하지 않는다: 완료된 모든
// 수업(체험+정규)의 확정 리뷰를 보여준다. 학생/보호자 공용 화면에는 계약·구매·
// 정규 진행 희망 버튼 같은 보호자 전용 행동은 절대 섞여 보이지 않아야 한다
// (그건 app/parent/TrialConversionPanel.tsx만의 역할).
describe("EnrollmentTab — 확정 수업 리뷰 표시(학생/보호자 공용, 체험+정규)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("확정된 리뷰가 없으면 리뷰 버튼 자체를 보여주지 않는다", async () => {
    (getLessonReviewsForFamily as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    render(<EnrollmentTab enrollments={[enrollment]} />);
    await waitFor(() => expect(getLessonReviewsForFamily).toHaveBeenCalledWith("se1"));
    expect(screen.queryByText(/수업 리뷰 보기/)).toBeNull();
    expect(screen.queryByText(/수업 리뷰 \(선생님 확정\)/)).toBeNull();
  });

  it("확정된 리뷰만 버튼을 눌러야 보여주고, 카테고리별 의견 + 정규 진행 희망 같은 보호자 전용 버튼은 없다", async () => {
    (getLessonReviewsForFamily as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        reviewId: "r1",
        sessionId: "s1",
        lessonType: "trial",
        finalText: "기초 개념 이해도 우수",
        aiSummary: null,
        finalizedAt: "2026-09-03T00:00:00Z",
        categoryNotes: [{ key: "comprehension", label: "이해도", note: "빠른 습득력" }],
        meetingRecordLink: null,
      },
    ]);
    render(<EnrollmentTab enrollments={[enrollment]} />);

    const toggle = await screen.findByText("수업 리뷰 보기 (1)");
    expect(screen.queryByText("기초 개념 이해도 우수")).toBeNull();
    fireEvent.click(toggle);

    expect(await screen.findByText("기초 개념 이해도 우수")).toBeInTheDocument();
    expect(screen.getByText("체험 수업 리뷰 (선생님 확정)")).toBeInTheDocument();
    expect(screen.getByText("빠른 습득력")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "정규 진행 희망합니다" })).toBeNull();
  });

  it("완료된 정규 수업 리뷰도 체험과 함께 목록으로 보여준다(최신순)", async () => {
    (getLessonReviewsForFamily as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        reviewId: "r2",
        sessionId: "s2",
        lessonType: "regular",
        finalText: "정규 2회차 종합 의견",
        aiSummary: null,
        finalizedAt: "2026-09-10T00:00:00Z",
        categoryNotes: [],
        meetingRecordLink: null,
      },
      {
        reviewId: "r1",
        sessionId: "s1",
        lessonType: "trial",
        finalText: "체험 종합 의견",
        aiSummary: null,
        finalizedAt: "2026-09-03T00:00:00Z",
        categoryNotes: [],
        meetingRecordLink: null,
      },
    ]);
    render(<EnrollmentTab enrollments={[enrollment]} />);

    fireEvent.click(await screen.findByText("수업 리뷰 보기 (2)"));

    expect(await screen.findByText("정규 수업 리뷰 (선생님 확정)")).toBeInTheDocument();
    expect(screen.getByText("체험 수업 리뷰 (선생님 확정)")).toBeInTheDocument();
    expect(screen.getByText("정규 2회차 종합 의견")).toBeInTheDocument();
    expect(screen.getByText("체험 종합 의견")).toBeInTheDocument();
  });

  it("확정된 리뷰에 미팅록 요약(ai_summary)이 있으면 함께 보여준다", async () => {
    (getLessonReviewsForFamily as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        reviewId: "r1",
        sessionId: "s1",
        lessonType: "trial",
        finalText: "기초 개념 이해도 우수",
        aiSummary: "오늘 수업에서는 이차함수 개념을 다뤘습니다.",
        finalizedAt: "2026-09-03T00:00:00Z",
        categoryNotes: [],
        meetingRecordLink: null,
      },
    ]);
    render(<EnrollmentTab enrollments={[enrollment]} />);

    fireEvent.click(await screen.findByText("수업 리뷰 보기 (1)"));

    expect(await screen.findByText("미팅록 요약")).toBeInTheDocument();
    expect(screen.getByText("오늘 수업에서는 이차함수 개념을 다뤘습니다.")).toBeInTheDocument();
  });

  it("확정된 리뷰가 있어도 미팅록이 없으면 빈 상태 문구만 보여준다", async () => {
    (getLessonReviewsForFamily as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        reviewId: "r1",
        sessionId: "s1",
        lessonType: "trial",
        finalText: "기초 개념 이해도 우수",
        aiSummary: null,
        finalizedAt: "2026-09-03T00:00:00Z",
        categoryNotes: [],
        meetingRecordLink: null,
      },
    ]);
    render(<EnrollmentTab enrollments={[enrollment]} />);

    fireEvent.click(await screen.findByText("수업 리뷰 보기 (1)"));

    expect(await screen.findByText("등록된 미팅록이 없습니다.")).toBeInTheDocument();
    expect(screen.queryByText("미팅록 원본 보기(열람 전용)")).toBeNull();
  });

  it("실제 Drive 권한이 부여된 세션은 '미팅록 원본 보기' 링크를 보여준다", async () => {
    (getLessonReviewsForFamily as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        reviewId: "r1",
        sessionId: "s1",
        lessonType: "regular",
        finalText: "정규 종합 의견",
        aiSummary: null,
        finalizedAt: "2026-09-03T00:00:00Z",
        categoryNotes: [],
        meetingRecordLink: "https://drive.google.com/file/d/abc123/view",
      },
    ]);
    render(<EnrollmentTab enrollments={[enrollment]} />);

    fireEvent.click(await screen.findByText("수업 리뷰 보기 (1)"));

    const link = await screen.findByText("미팅록 원본 보기(열람 전용)");
    expect(link.closest("a")).toHaveAttribute("href", "https://drive.google.com/file/d/abc123/view");
  });
});

// v3 커리큘럼 열람 결함 수정(2026-09-11) — 이 탭(subject_enrollments 기준)에
// 뜨는 모든 과목이 v3이므로 진입 버튼을 항상 노출한다. 같은 컴포넌트를 자녀별로
// 재사용하는 학부모 포털(app/parent/EnrollmentTab.tsx)에도 그대로 적용된다.
describe("EnrollmentTab — 커리큘럼 보기 진입(v3 읽기 전용)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("과목 카드에서 '커리큘럼 보기'를 누르면 해당 과목의 읽기 전용 커리큘럼으로 전환되고, 뒤로가기로 목록에 복귀한다", async () => {
    (getLessonReviewsForFamily as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (loadMyCurriculumOverlay as ReturnType<typeof vi.fn>).mockResolvedValue({
      overlayId: "overlay1",
      units: [
        {
          id: "u1",
          sourceUnitId: "src1",
          position: 1,
          unitTitle: "이차방정식",
          note: null,
          status: "not_started",
          statusChangedAt: null,
          keywordIds: [],
          materialDocIds: [],
        },
      ],
    });

    render(<EnrollmentTab enrollments={[enrollment]} />);
    fireEvent.click(await screen.findByText("커리큘럼 보기 →"));

    expect(loadMyCurriculumOverlay).toHaveBeenCalledWith("se1");
    expect((await screen.findAllByText("이차방정식", { exact: false })).length).toBeGreaterThan(0);
    expect(screen.queryByText("커리큘럼 보기 →")).toBeNull();

    fireEvent.click(screen.getByText("← 뒤로"));
    expect(await screen.findByText("커리큘럼 보기 →")).toBeInTheDocument();
  });
});

// v3 종료된 수강 담당 교사 표시 결함 수정(2026-09-11) — 매칭 종료로 활성
// 배정이 없어진 것과 "애초에 배정된 적 없음"을 구분해서 보여준다.
describe("EnrollmentTab — 종료된 수강의 담당 교사 표시", () => {
  beforeEach(() => vi.clearAllMocks());

  it("활성 매칭이 없어도 이 수강 건 자체의 종료 이력이 있으면 '마지막 담당 선생님'으로 보여준다", async () => {
    (getLessonReviewsForFamily as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const terminated: SubjectEnrollmentView = {
      id: "se-terminated",
      subjectId: "sub1",
      subjectName: "SAT Math",
      status: "terminated",
      currentTeacher: null,
      upcomingTeacherChange: null,
      history: [
        {
          id: "a1",
          teacherId: "t1",
          teacherName: "박서연 선생님",
          status: "ended",
          effectiveFrom: "2026-08-01T00:00:00Z",
          effectiveUntil: "2026-09-01T00:00:00Z",
          reason: "매칭 종료",
        },
      ],
    };
    render(<EnrollmentTab enrollments={[terminated]} />);
    fireEvent.click(screen.getByText("수강 종료"));
    expect(await screen.findByText(/마지막 담당 선생님/)).toBeInTheDocument();
    expect(screen.getByText("박서연 선생님")).toBeInTheDocument();
    expect(screen.queryByText("배정 전")).toBeNull();
  });

  it("종료 이력조차 없으면(정말 배정된 적 없음) '배정 전'을 그대로 보여준다", async () => {
    (getLessonReviewsForFamily as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const neverAssigned: SubjectEnrollmentView = {
      id: "se-new",
      subjectId: "sub2",
      subjectName: "AP Bio",
      status: "planned",
      currentTeacher: null,
      upcomingTeacherChange: null,
      history: [],
    };
    render(<EnrollmentTab enrollments={[neverAssigned]} />);
    expect(await screen.findByText("배정 전")).toBeInTheDocument();
    expect(screen.queryByText(/마지막 담당 선생님/)).toBeNull();
  });
});

// 2026-09-18(UI 폴리싱) — 상단 큰 제목 제거 + "수강중"/"수강 종료" 서브탭 분리.
describe("EnrollmentTab — 수강중/수강 종료 서브탭(2026-09-18)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getLessonReviewsForFamily as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  const active: SubjectEnrollmentView = { ...enrollment, id: "se-active", status: "active" };
  const ended: SubjectEnrollmentView = { ...enrollment, id: "se-ended", subjectName: "AP Physics", status: "completed" };

  it("상단에 '수강 과목' 같은 큰 제목을 더 이상 렌더링하지 않는다", () => {
    render(<EnrollmentTab enrollments={[active]} />);
    expect(screen.queryByText("수강 과목")).toBeNull();
  });

  it("기본 서브탭('수강중')에는 active/planned/paused만 보이고 종료된 과목은 숨는다", async () => {
    render(<EnrollmentTab enrollments={[active, ended]} />);
    expect(await screen.findByText("SAT Math")).toBeInTheDocument();
    expect(screen.queryByText("AP Physics")).toBeNull();
  });

  it("'수강 종료' 서브탭을 누르면 completed/terminated만 보인다", async () => {
    render(<EnrollmentTab enrollments={[active, ended]} />);
    fireEvent.click(screen.getByText("수강 종료"));
    expect(await screen.findByText("AP Physics")).toBeInTheDocument();
    expect(screen.queryByText("SAT Math")).toBeNull();
  });

  it("childName을 넘기면(학부모 포털, 자녀 2명 이상) 카드 안에 소속 자녀가 표시된다", async () => {
    render(<EnrollmentTab enrollments={[active]} childName="지훈" />);
    expect(await screen.findByText("지훈")).toBeInTheDocument();
  });

  it("childName을 넘기지 않으면(학생 포털 등) 소속 자녀 표시가 없다", async () => {
    render(<EnrollmentTab enrollments={[active]} />);
    await screen.findByText("SAT Math");
    expect(screen.queryByText("지훈")).toBeNull();
  });
});
