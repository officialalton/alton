import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StudentShell from "./StudentShell";
import type { DashboardData } from "./dashboard-data";
import type { RoadmapData } from "@/lib/roadmap/types";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/app/login/actions", () => ({
  logout: vi.fn(),
}));

vi.mock("@/app/session/[id]/vocab-actions", () => ({
  removeVocabWord: vi.fn(),
}));

vi.mock("@/app/session/[id]/problemlog-actions", () => ({
  toggleSaveAttempt: vi.fn(),
  retryMcAttempt: vi.fn(),
  retryEssayAttempt: vi.fn(),
  retryMathAttempt: vi.fn(),
  saveTeacherPick: vi.fn(),
  removeTeacherPick: vi.fn(),
}));

vi.mock("./memo-actions", () => ({
  addMemo: vi.fn(),
}));

vi.mock("./review-actions", () => ({
  submitStudentFeedback: vi.fn(),
}));

vi.mock("@/app/session/[id]/homework-actions", () => ({
  saveHomeworkAnswer: vi.fn(),
}));

vi.mock("./credits-actions", () => ({
  requestParentPayment: vi.fn(),
}));

vi.mock("./chat-actions", () => ({
  sendChatMessage: vi.fn(),
}));

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({
      on: function on() {
        return this;
      },
      subscribe: function subscribe() {
        return this;
      },
    }),
    removeChannel: vi.fn(),
  }),
}));

const dashboard: DashboardData = {
  studentName: "지훈",
  upcoming: [],
  calendarByDay: {},
  calendarYear: 2026,
  calendarMonth: 7,
  attendanceRate: null,
};

const roadmap: RoadmapData = {
  studentId: "student-1",
  studentName: "지훈",
  grade: null,
  schoolName: null,
  gpa: null,
  gpaScale: null,
  classRank: null,
  classSize: null,
  academicProfile: {
    graduationYear: null,
    curriculumType: null,
    currentSubjects: [],
    honorsCount: null,
    apCount: null,
    collegeCoursesCount: null,
    ibHlCount: null,
    ibSlCount: null,
    schoolApIbOfferedCount: null,
  },
  testRecords: [],
  apExams: [],
  demographics: {
    homeCountry: null,
    zipCode: null,
    residencyStatus: null,
    gender: null,
    raceEthnicity: null,
    financialAidIntent: null,
    maxAnnualBudget: null,
    householdIncomeRange: null,
    firstGeneration: null,
    legacySchools: [],
    religiousAffiliation: null,
    recruitedAthlete: null,
    specialSchoolInterests: [],
  },
  collegeInterests: {
    intendedMajors: [],
    careerInterests: [],
    targetCountries: [],
    targetCollegeTypes: [],
    targetColleges: [],
    targetApplicationTiming: null,
  },
  activities: [],
  awards: [],
  prepItems: [],
  milestones: [],
  latestMonthlyReview: null,
  completeness: { filledSections: 0, totalSections: 5 },
};

const lessonsProps = {
  roadmap,
  upcoming: [],
  past: [],
  curricula: [],
  memosByEnrollment: {},
  reviews: {},
  myFeedback: {},
  bookableEnrollments: [],
  studentId: "student-1",
  homeworkBatches: [],
  materialsLibraryTree: [],
  myVocabWords: [],
  vocabLibraryBooks: [],
  vocabQuizzes: [],
  vocabFolders: [],
  credits: { balance: 0, guardianName: null, regularRemaining: 0, regularNearestExpiry: null, trialEntitlement: null },
  stats: { attendanceRate: null, satisfactionAvg: null, bySubject: [] },
  teacherList: [],
  teacherProfiles: {},
  teacherSessionHistory: {},
  chatThreads: {},
  subjectEnrollments: [],
  lessonBooking: {
    bookableEnrollments: [],
    upcomingBookings: [],
    pastSessionsForReport: [],
    regularLessonTypeId: null,
    lessonDurationMinutes: 120,
    timezone: "America/Los_Angeles",
  },
};

describe("StudentShell", () => {
  it("사이드바 10개 항목을 보여주고, 기본 탭은 홈이다", () => {
    render(
      <StudentShell
        studentName="지훈"
        dashboard={dashboard}
        problemHistory={[]}
        {...lessonsProps}
      />
    );
    ["홈", "수강 과목", "수업", "선생님", "과제", "문제", "단어장", "교재", "수업권", "통계"].forEach(
      (label) => expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    );
    expect(screen.queryByText("레슨")).toBeNull();
    expect(screen.queryByText("예약")).toBeNull();
    expect(screen.getByText(/지훈의 학습 현황/)).toBeInTheDocument();
  });

  it("선생님 탭을 누르면 TeacherTab이 렌더링된다", () => {
    render(
      <StudentShell
        studentName="지훈"
        dashboard={dashboard}
        problemHistory={[]}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getByText("선생님"));
    expect(screen.getByText("매칭된 선생님이 없습니다.")).toBeInTheDocument();
  });

  it("수업권 탭을 누르면 CreditsTab이 렌더링된다", () => {
    render(
      <StudentShell
        studentName="지훈"
        dashboard={dashboard}
        problemHistory={[]}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getByText("수업권"));
    expect(screen.getByText("장 보유")).toBeInTheDocument();
  });

  it("단어장 탭을 누르면 VocabLibraryTab이 렌더링된다", () => {
    render(
      <StudentShell
        studentName="지훈"
        dashboard={dashboard}
        problemHistory={[]}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getByText("단어장"));
    expect(
      screen.getByText("아직 추가한 단어가 없어요. '+ 단어 추가'를 눌러보세요.")
    ).toBeInTheDocument();
  });

  it("문제 탭을 누르면 문제 기록(v3)이 렌더링된다", () => {
    render(
      <StudentShell
        studentName="지훈"
        dashboard={dashboard}
        problemHistory={[]}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getByText("문제"));
    expect(screen.getByText("조건에 맞는 문제 기록이 없습니다.")).toBeInTheDocument();
  });

  it("수업 탭을 누르면 ClassesTab이 렌더링되고, 딱 두 개의 서브탭('예정 수업'/'지난 수업')만 보인다(레거시 '레슨'/'예약' 탭 제거)", () => {
    render(
      <StudentShell
        studentName="지훈"
        dashboard={dashboard}
        problemHistory={[]}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getAllByText("수업")[0]);
    expect(screen.getByText("예정 수업")).toBeInTheDocument();
    expect(screen.getByText("지난 수업")).toBeInTheDocument();
    expect(
      screen.getByText("아직 선생님 배정이 완료되지 않았어요. 배정이 끝나면 이 화면에서 바로 예약할 수 있어요.")
    ).toBeInTheDocument();
  });

  it("과제 탭을 누르면 StudentHomeworkTab이 렌더링된다", () => {
    render(
      <StudentShell
        studentName="지훈"
        dashboard={dashboard}
        problemHistory={[]}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getAllByText("과제")[0]);
    expect(
      screen.getByText(/아직 발급된 과제가 없습니다/)
    ).toBeInTheDocument();
  });

  it("교재 탭을 누르면 MaterialsLibraryTab이 렌더링된다", () => {
    render(
      <StudentShell
        studentName="지훈"
        dashboard={dashboard}
        problemHistory={[]}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getAllByText("교재")[0]);
    expect(
      screen.getByText("아직 배정된 교재가 없어요. 담당 선생님이 곧 준비해드릴 예정이에요.")
    ).toBeInTheDocument();
  });

  it("통계 탭을 누르면 StatsTab이 렌더링된다", () => {
    render(
      <StudentShell
        studentName="지훈"
        dashboard={dashboard}
        problemHistory={[]}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getByText("통계"));
    expect(screen.getByText("과목별 참여율")).toBeInTheDocument();
  });

  it("계정 메뉴를 열면 로그아웃 버튼이 보인다", () => {
    render(
      <StudentShell
        studentName="지훈"
        dashboard={dashboard}
        problemHistory={[]}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getByText("지훈 학생님 ▾"));
    expect(screen.getByText("로그아웃")).toBeInTheDocument();
  });

  // 2026-09-18(고정형 모의고사 V1 내비 연결) — /student/mock-exam은 StudentShell
  // 탭이 아니라 독립 라우트라, 사이드바 클릭 시 router.push로 그 라우트로
  // 이동해야 한다.
  it("사이드바 '모의고사'를 누르면 /student/mock-exam으로 이동한다", () => {
    pushMock.mockClear();
    render(
      <StudentShell
        studentName="지훈"
        dashboard={dashboard}
        problemHistory={[]}
        {...lessonsProps}
      />
    );
    fireEvent.click(screen.getByText("모의고사"));
    expect(pushMock).toHaveBeenCalledWith("/student/mock-exam");
  });
});
