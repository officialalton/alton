import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ConsultationKanbanBoard from "./ConsultationKanbanBoard";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

const listKanbanBoardActionMock = vi.fn();
const getConsultationCardDetailActionMock = vi.fn();
const planTrialSubjectAndAssignTeacherActionMock = vi.fn();

vi.mock("./consultation-kanban-actions", () => ({
  listKanbanBoardAction: () => listKanbanBoardActionMock(),
  getConsultationCardDetailAction: (id: string) => getConsultationCardDetailActionMock(id),
  getClosureDraftAction: vi.fn(),
  closeConsultationAction: vi.fn(),
}));

vi.mock("./consultation-kanban-constants", () => ({
  KANBAN_STAGE_ORDER: ["requested", "scheduled", "trial_requested", "trial_scheduled", "contract_sent"],
  KANBAN_STAGE_LABEL: {
    requested: "상담 신청",
    scheduled: "상담 일정 확정",
    trial_requested: "체험 신청",
    trial_scheduled: "체험 일정 확정",
    contract_sent: "계약",
  },
  CLOSURE_TYPE_LABEL: {
    no_trial: "체험 없이 종료",
    trial_no_convert: "체험 후 종료",
    regular_in_progress: "정규 진행 중 종료",
    contract_signed: "정규 계약 날인",
  },
}));

vi.mock("./consultation-scheduling-actions", () => ({
  acceptConsultationRequest: vi.fn(),
  rejectConsultationRequest: vi.fn(),
  recordConsultationOutcome: vi.fn(),
  retryTrialEntitlementGrant: vi.fn(),
}));

vi.mock("./trial-onboarding-actions", () => ({
  sendTrialOnboardingNoticeAction: vi.fn(),
  sendRegularContractOneClickAction: vi.fn(),
  confirmTrialIntentAction: vi.fn(),
  planTrialSubjectAndAssignTeacherAction: (params: unknown) => planTrialSubjectAndAssignTeacherActionMock(params),
}));

vi.mock("./consultation-actions", () => ({
  createNewContractVersionForResend: vi.fn(),
}));

vi.mock("./LessonReviewAdminEditor", () => ({
  default: () => null,
}));

const subjects = [
  { subjectId: "subj-math", subjectName: "수학", units: [] },
  { subjectId: "subj-eng", subjectName: "영어", units: [] },
];

const teacherCandidatesBySubject = {
  "subj-math": [{ id: "teacher-1", name: "김선생" }],
  "subj-eng": [{ id: "teacher-2", name: "이선생" }],
};

function cardRow() {
  return {
    id: "c1",
    contact_name: "김민지",
    contact_email: "minji@example.com",
    contact_phone: null,
    student_grade: "10학년",
    status: "completed",
    outcome: "trial_recommended",
    stage: "trial_requested" as const,
  };
}

function cardDetail() {
  return {
    consultation: {
      id: "c1",
      contact_name: "김민지",
      contact_email: "minji@example.com",
      contact_phone: null,
      student_grade: "10학년",
      status: "completed",
      outcome: "trial_recommended",
      child_id: "child1",
      trial_intent_confirmed_at: "2026-09-01T00:00:00Z",
    },
    pipeline: {
      consultationId: "c1",
      subjectEnrollmentId: null,
      trialEntitlementGrantStatus: null,
      trialEntitlementGrantError: null,
      steps: [
        { key: "account_linked", done: true, label: "보호자·학생 계정 연결" },
        { key: "assignment", done: false, label: "과목·선생님 배정" },
      ],
    },
    childName: "김학생",
    guardianEmail: "minji@example.com",
    guardianName: "김민지",
    contractId: null,
    contractStatus: null,
    latestContractVersionHasEnvelope: false,
    noticeDeliveryStatus: null as "pending" | "sent" | "failed" | null,
    noticeSendError: null as string | null,
    noticeSentAt: null as string | null,
  };
}

describe("ConsultationKanbanBoard — 과목·선생님 배정 클릭 UI(2026-09-05 사용자 지시 1·2번)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listKanbanBoardActionMock.mockResolvedValue([cardRow()]);
    getConsultationCardDetailActionMock.mockResolvedValue(cardDetail());
    planTrialSubjectAndAssignTeacherActionMock.mockResolvedValue({
      subjectEnrollmentId: "se1",
      teacherAssignmentId: "ta1",
      activationWarning: null,
    });
  });

  it("과목 수강 계획이 아직 없으면 과목 클릭 → 선생님 클릭 폼을 보여주고, raw UUID 입력 폼은 없다", async () => {
    render(
      <ConsultationKanbanBoard subjects={subjects} teacherCandidatesBySubject={teacherCandidatesBySubject} />
    );

    fireEvent.click(await screen.findByText("김민지"));
    await screen.findByTestId("consultation-card-detail");

    expect(screen.getByTestId("subject-teacher-assign-form")).toBeInTheDocument();
    expect(screen.getByTestId("assign-subject-subj-math")).toBeInTheDocument();
    expect(screen.getByTestId("assign-subject-subj-eng")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("과목 ID")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("선생님 ID")).not.toBeInTheDocument();
  });

  it("과목을 클릭하면 그 과목을 가르칠 수 있는 선생님 목록만 보여준다", async () => {
    render(
      <ConsultationKanbanBoard subjects={subjects} teacherCandidatesBySubject={teacherCandidatesBySubject} />
    );

    fireEvent.click(await screen.findByText("김민지"));
    await screen.findByTestId("consultation-card-detail");
    fireEvent.click(screen.getByTestId("assign-subject-subj-math"));

    expect(screen.getByTestId("assign-teacher-teacher-1")).toBeInTheDocument();
    expect(screen.queryByTestId("assign-teacher-teacher-2")).not.toBeInTheDocument();
  });

  it("선생님을 클릭하면 planTrialSubjectAndAssignTeacherAction을 childId·subjectId·teacherId로 호출한다", async () => {
    render(
      <ConsultationKanbanBoard subjects={subjects} teacherCandidatesBySubject={teacherCandidatesBySubject} />
    );

    fireEvent.click(await screen.findByText("김민지"));
    await screen.findByTestId("consultation-card-detail");
    fireEvent.click(screen.getByTestId("assign-subject-subj-math"));
    fireEvent.click(screen.getByTestId("assign-teacher-teacher-1"));

    await waitFor(() =>
      expect(planTrialSubjectAndAssignTeacherActionMock).toHaveBeenCalledWith(
        expect.objectContaining({ childId: "child1", subjectId: "subj-math", teacherId: "teacher-1" })
      )
    );
  });

  it("과목 수강 계획이 이미 있으면(subjectEnrollmentId 존재) 배정 폼을 보여주지 않는다", async () => {
    getConsultationCardDetailActionMock.mockResolvedValue({
      ...cardDetail(),
      pipeline: { ...cardDetail().pipeline, subjectEnrollmentId: "se-existing" },
    });

    render(
      <ConsultationKanbanBoard subjects={subjects} teacherCandidatesBySubject={teacherCandidatesBySubject} />
    );

    fireEvent.click(await screen.findByText("김민지"));
    await screen.findByTestId("consultation-card-detail");

    expect(screen.queryByTestId("subject-teacher-assign-form")).not.toBeInTheDocument();
  });
});

describe("ConsultationKanbanBoard — 체험 온보딩 안내 발송 폼(2026-09-05 보완)", () => {
  function detailWithoutAccountLinked(overrides: Partial<ReturnType<typeof cardDetail>> = {}) {
    return {
      ...cardDetail(),
      pipeline: {
        ...cardDetail().pipeline,
        steps: [
          { key: "account_linked", done: false, label: "보호자·학생 계정 연결" },
          { key: "assignment", done: false, label: "과목·선생님 배정" },
        ],
      },
      noticeDeliveryStatus: null,
      noticeSendError: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    listKanbanBoardActionMock.mockResolvedValue([cardRow()]);
  });

  it("학생 이름·이메일 등 필수값이 비어 있으면 발송 버튼이 비활성화된다", async () => {
    getConsultationCardDetailActionMock.mockResolvedValue(detailWithoutAccountLinked());

    render(<ConsultationKanbanBoard subjects={subjects} teacherCandidatesBySubject={teacherCandidatesBySubject} />);

    fireEvent.click(await screen.findByText("김민지"));
    await screen.findByTestId("consultation-card-detail");

    const sendButton = screen.getByText("체험 온보딩 안내 발송");
    // 보호자 이름·이메일은 기본값이 채워지지만 학생 이름·이메일은 비어있다.
    expect(sendButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("학생 이름"), { target: { value: "김학생" } });
    fireEvent.change(screen.getByPlaceholderText("학생 이메일"), { target: { value: "student@example.com" } });

    expect(sendButton).not.toBeDisabled();
  });

  it("이전 발송이 실패 상태로 남아있으면 카드 상세에 실패 배너를 노출한다", async () => {
    getConsultationCardDetailActionMock.mockResolvedValue(
      detailWithoutAccountLinked({ noticeDeliveryStatus: "failed", noticeSendError: "SMTP 연결 실패" })
    );

    render(<ConsultationKanbanBoard subjects={subjects} teacherCandidatesBySubject={teacherCandidatesBySubject} />);

    fireEvent.click(await screen.findByText("김민지"));
    await screen.findByTestId("consultation-card-detail");

    expect(screen.getByTestId("trial-notice-failed")).toHaveTextContent("SMTP 연결 실패");
  });
});
