import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ConsultationKanbanBoard from "./ConsultationKanbanBoard";
import { sendTrialOnboardingNoticeAction, sendRegularContractOneClickAction } from "./trial-onboarding-actions";
import { recordConsultationOutcome } from "./consultation-scheduling-actions";

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

const findDuplicateConsultationCandidatesMock = vi.fn().mockResolvedValue([]);
vi.mock("./consultation-actions", () => ({
  createNewContractVersionForResend: vi.fn(),
  findDuplicateConsultationCandidates: (params: unknown) => findDuplicateConsultationCandidatesMock(params),
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
    childCards: [] as { consultationId: string; childName: string | null }[],
  };
}

describe("ConsultationKanbanBoard — 과목·선생님 배정 클릭 UI(2026-09-05 사용자 지시 1·2번)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findDuplicateConsultationCandidatesMock.mockResolvedValue([]);
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
    findDuplicateConsultationCandidatesMock.mockResolvedValue([]);
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

  // 2026-09-06(제품 오너 지적) — 가족(부모) 카드가 이미 학생별 자녀 카드로
  // 분기됐으면 빈 온보딩 발송 폼을 다시 보여주지 않는다.
  it("자녀 카드가 이미 생성돼 있으면 온보딩 발송 폼 대신 안내와 이동 링크만 보여준다", async () => {
    getConsultationCardDetailActionMock.mockResolvedValue(
      detailWithoutAccountLinked({
        childCards: [{ consultationId: "child-c1", childName: "첫째" }],
      })
    );

    render(<ConsultationKanbanBoard subjects={subjects} teacherCandidatesBySubject={teacherCandidatesBySubject} />);

    fireEvent.click(await screen.findByText("김민지"));
    await screen.findByTestId("consultation-card-detail");

    expect(screen.queryByText("체험 온보딩 안내 발송")).not.toBeInTheDocument();
    expect(screen.getByText("자녀 1명 온보딩 진행 중/완료됨")).toBeInTheDocument();
    expect(screen.getByText("→ 첫째 카드로 이동")).toBeInTheDocument();
  });

  // 2026-09-06(관리자 온보딩 발송 폼 통합) — 카드 상세 진입점에서도
  // TrialOnboardingPanel.tsx와 동일하게 "학생 추가"로 N명(3명)을 입력해 가족당
  // 온보딩 안내 1건만 발송되는지 확인한다. 두 진입점이 같은
  // sendTrialOnboardingNoticeAction()을 호출한다는 것도 이 단언으로 함께 고정된다.
  it("학생 추가로 3명을 입력하면 sendTrialOnboardingNoticeAction이 학생 3명 배열로 1번만 호출된다", async () => {
    getConsultationCardDetailActionMock.mockResolvedValue(detailWithoutAccountLinked());
    (sendTrialOnboardingNoticeAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "sent",
      sentAt: "2026-09-06T00:00:00Z",
    });

    render(<ConsultationKanbanBoard subjects={subjects} teacherCandidatesBySubject={teacherCandidatesBySubject} />);

    fireEvent.click(await screen.findByText("김민지"));
    await screen.findByTestId("consultation-card-detail");

    fireEvent.change(screen.getByPlaceholderText("학생 이름"), { target: { value: "첫째" } });
    fireEvent.change(screen.getByPlaceholderText("학생 이메일"), { target: { value: "first@example.com" } });

    fireEvent.click(screen.getByText("+ 학생 추가"));
    fireEvent.click(screen.getByText("+ 학생 추가"));

    const names = screen.getAllByPlaceholderText("학생 이름");
    const emails = screen.getAllByPlaceholderText("학생 이메일");
    expect(names).toHaveLength(3);
    fireEvent.change(names[1], { target: { value: "둘째" } });
    fireEvent.change(emails[1], { target: { value: "second@example.com" } });
    fireEvent.change(names[2], { target: { value: "셋째" } });
    fireEvent.change(emails[2], { target: { value: "third@example.com" } });

    fireEvent.click(screen.getByText("체험 온보딩 안내 발송"));

    await waitFor(() => expect(sendTrialOnboardingNoticeAction).toHaveBeenCalledTimes(1));
    expect(sendTrialOnboardingNoticeAction).toHaveBeenCalledWith(
      expect.objectContaining({
        consultationId: "c1",
        students: [
          expect.objectContaining({ name: "첫째", email: "first@example.com" }),
          expect.objectContaining({ name: "둘째", email: "second@example.com" }),
          expect.objectContaining({ name: "셋째", email: "third@example.com" }),
        ],
      })
    );
  });
});

describe("2026-09-06: 상담 카드·상세에 상담 시각 노출", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findDuplicateConsultationCandidatesMock.mockResolvedValue([]);
  });

  it("확정 시각(scheduled_at)이 있으면 카드와 상세 모두에 노출된다", async () => {
    listKanbanBoardActionMock.mockResolvedValue([
      { ...cardRow(), starts_at: "2026-09-10T01:00:00Z", scheduled_at: "2026-09-10T01:00:00Z" },
    ]);
    getConsultationCardDetailActionMock.mockResolvedValue({
      ...cardDetail(),
      consultation: {
        ...cardDetail().consultation,
        starts_at: "2026-09-10T01:00:00Z",
        scheduled_at: "2026-09-10T01:00:00Z",
      },
    });

    render(<ConsultationKanbanBoard subjects={subjects} teacherCandidatesBySubject={teacherCandidatesBySubject} />);

    await waitFor(() => expect(screen.getByText(/🗓/)).toBeInTheDocument());

    fireEvent.click(await screen.findByText("김민지"));
    await screen.findByTestId("consultation-card-detail");
    expect(screen.getByText(/확정 시각/)).toBeInTheDocument();
  });

  it("아직 확정 전(starts_at만 있음)이면 '희망 시각'으로 노출된다", async () => {
    listKanbanBoardActionMock.mockResolvedValue([
      { ...cardRow(), starts_at: "2026-09-10T01:00:00Z", scheduled_at: null },
    ]);
    getConsultationCardDetailActionMock.mockResolvedValue({
      ...cardDetail(),
      consultation: { ...cardDetail().consultation, starts_at: "2026-09-10T01:00:00Z", scheduled_at: null },
    });

    render(<ConsultationKanbanBoard subjects={subjects} teacherCandidatesBySubject={teacherCandidatesBySubject} />);

    fireEvent.click(await screen.findByText("김민지"));
    await screen.findByTestId("consultation-card-detail");
    expect(screen.getByText(/희망 시각/)).toBeInTheDocument();
  });

  it("2026-09-06: 관리자 검토 요약(admin_review_summary)이 있으면 카드와 상세 모두에 노출된다", async () => {
    listKanbanBoardActionMock.mockResolvedValue([{ ...cardRow(), admin_review_summary: "성실하고 목표 명확함" }]);
    getConsultationCardDetailActionMock.mockResolvedValue({
      ...cardDetail(),
      consultation: { ...cardDetail().consultation, admin_review_summary: "성실하고 목표 명확함" },
    });

    render(<ConsultationKanbanBoard subjects={subjects} teacherCandidatesBySubject={teacherCandidatesBySubject} />);

    await waitFor(() => expect(screen.getByText(/성실하고 목표 명확함/)).toBeInTheDocument());

    fireEvent.click(await screen.findByText("김민지"));
    await screen.findByTestId("consultation-card-detail");
    expect(screen.getByText(/상담 리뷰:/)).toBeInTheDocument();
  });

  it("2026-09-06: 같은 이메일로 과거 상담 이력(재상담 후보)이 있으면 상세 패널에 참고용으로만 노출된다(자동 병합 없음)", async () => {
    listKanbanBoardActionMock.mockResolvedValue([cardRow()]);
    getConsultationCardDetailActionMock.mockResolvedValue(cardDetail());
    findDuplicateConsultationCandidatesMock.mockResolvedValue([
      {
        id: "old-c1",
        contact_name: "김민지",
        contact_email: "minji@example.com",
        status: "completed",
        outcome: "no_trial",
        admin_review_summary: "예전 상담 — 예산 문제로 보류",
        scheduled_at: "2026-01-10T00:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
      },
    ]);

    render(<ConsultationKanbanBoard subjects={subjects} teacherCandidatesBySubject={teacherCandidatesBySubject} />);

    fireEvent.click(await screen.findByText("김민지"));
    await screen.findByTestId("consultation-card-detail");

    await waitFor(() =>
      expect(findDuplicateConsultationCandidatesMock).toHaveBeenCalledWith({
        email: "minji@example.com",
        excludeConsultationId: "c1",
      })
    );
    await waitFor(() => expect(screen.getByText(/재상담 후보/)).toBeInTheDocument());
    expect(screen.getByText(/예전 상담 — 예산 문제로 보류/)).toBeInTheDocument();
  });
});

// (2026-09-06 제품 오너 지시) "정규 계약" 발송 실패 배너가 뜬 뒤 회사 승인자
// 직함을 입력하고 재시도해도 관리자에게 아무 피드백이 없어 "재시도 버튼이
// 고장난 것"처럼 보인다는 보고 — 실제 원인은 sendRegularContractOneClickAction이
// 실패를 throw가 아니라 { status: "failed", error } 값으로 반환하는데,
// ContractSendForm의 onClick 핸들러가 그 반환값을 그냥 버리고 있었던 것
// (버그). Preview 환경에서는 DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS 게이트로
// 실제 DocuSign 호출이 항상 막혀 있으므로 이 자체는 버그가 아니지만, 그
// 사실이 화면에 전혀 드러나지 않는 건 버그였다 — 이제 결과를 확인해 화면에
// 표시한다.
describe("ConsultationKanbanBoard — 정규 계약 발송 실패 피드백(2026-09-06 버그 수정)", () => {
  function contractCardDetail() {
    return {
      consultation: {
        id: "c1",
        contact_name: "세온장",
        contact_email: "seonjang@example.com",
        contact_phone: null,
        student_grade: "10학년",
        status: "completed",
        outcome: "regular_recommended",
        child_id: "child1",
        trial_intent_confirmed_at: "2026-09-01T00:00:00Z",
      },
      pipeline: {
        consultationId: "c1",
        subjectEnrollmentId: "se1",
        trialEntitlementGrantStatus: null,
        trialEntitlementGrantError: null,
        steps: [
          { key: "account_linked", done: true, label: "보호자·학생 계정 연결" },
          { key: "assignment", done: true, label: "과목·선생님 배정" },
        ],
      },
      childName: "세온장",
      guardianEmail: "guardian@example.com",
      guardianName: "보호자",
      contractId: "contract1",
      contractStatus: "draft",
      latestContractVersionHasEnvelope: false,
      noticeDeliveryStatus: null as "pending" | "sent" | "failed" | null,
      noticeSendError: null as string | null,
      noticeSentAt: null as string | null,
      childCards: [] as { consultationId: string; childName: string | null }[],
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    findDuplicateConsultationCandidatesMock.mockResolvedValue([]);
    listKanbanBoardActionMock.mockResolvedValue([
      {
        id: "c1",
        contact_name: "세온장",
        contact_email: "seonjang@example.com",
        contact_phone: null,
        student_grade: "10학년",
        status: "completed",
        outcome: "regular_recommended",
        stage: "contract_sent" as const,
      },
    ]);
    getConsultationCardDetailActionMock.mockResolvedValue(contractCardDetail());
  });

  // 2026-09-06(제품 오너 지적) — 회사 승인자 직함 입력란이 매번 빈 값으로
  // 시작해 관리자가 매번 다시 입력해야 했다. 기본값을 고정한다(수정 가능은 유지).
  it("회사 승인자 직함 입력란은 'CEO, Do Kyung Kim'으로 기본값이 채워져 있다", async () => {
    render(<ConsultationKanbanBoard subjects={subjects} teacherCandidatesBySubject={teacherCandidatesBySubject} />);

    fireEvent.click(await screen.findByText("세온장"));
    await screen.findByTestId("consultation-card-detail");

    expect(screen.getByPlaceholderText("회사 승인자 직함(필수)")).toHaveValue("CEO, Do Kyung Kim");
  });

  it("Preview DocuSign 게이트로 실패하면 재시도 시 '환경 제약' 메시지를 화면에 보여준다(무피드백 버그 수정)", async () => {
    (sendRegularContractOneClickAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "failed",
      contractVersionId: "cv1",
      error: "DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS=true가 아니면 실제 DocuSign API를 호출하지 않습니다.",
    });

    render(<ConsultationKanbanBoard subjects={subjects} teacherCandidatesBySubject={teacherCandidatesBySubject} />);

    fireEvent.click(await screen.findByText("세온장"));
    await screen.findByTestId("consultation-card-detail");

    fireEvent.change(screen.getByPlaceholderText("회사 승인자 직함(필수)"), {
      target: { value: "대표이사" },
    });
    fireEvent.click(screen.getByText("회사 승인 및 계약 발송"));

    await waitFor(() =>
      expect(sendRegularContractOneClickAction).toHaveBeenCalledWith(
        expect.objectContaining({ childId: "child1", subjectEnrollmentId: "se1", approverTitle: "대표이사" })
      )
    );
    await waitFor(() =>
      expect(screen.getByText(/Preview 환경에서는 실제 DocuSign 발송이 비활성화되어 있습니다/)).toBeInTheDocument()
    );
  });

  it("다른 사유(실제 API 오류)로 실패하면 그 오류 메시지를 그대로 화면에 보여준다", async () => {
    (sendRegularContractOneClickAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "failed",
      contractVersionId: "cv1",
      error: "DocuSign 봉투 생성 실패: 500 Internal Server Error",
    });

    render(<ConsultationKanbanBoard subjects={subjects} teacherCandidatesBySubject={teacherCandidatesBySubject} />);

    fireEvent.click(await screen.findByText("세온장"));
    await screen.findByTestId("consultation-card-detail");

    fireEvent.change(screen.getByPlaceholderText("회사 승인자 직함(필수)"), {
      target: { value: "대표이사" },
    });
    fireEvent.click(screen.getByText("회사 승인 및 계약 발송"));

    await waitFor(() =>
      expect(screen.getByText(/발송 실패: DocuSign 봉투 생성 실패/)).toBeInTheDocument()
    );
  });

  // 2026-09-06(제품 오너 지적 — 기본값 고정) 이후: 직함 입력란은 이제
  // "CEO, Do Kyung Kim" 기본값으로 채워져 있어 버튼이 처음부터 활성화돼
  // 있다. 비워지면 다시 비활성화되고, 값을 입력하면 활성화됨을 확인한다.
  it("회사 승인자 직함은 기본값이 있어 버튼이 처음부터 활성화되며, 비우면 비활성화·입력하면 다시 활성화된다", async () => {
    render(<ConsultationKanbanBoard subjects={subjects} teacherCandidatesBySubject={teacherCandidatesBySubject} />);

    fireEvent.click(await screen.findByText("세온장"));
    await screen.findByTestId("consultation-card-detail");

    const button = screen.getByText("회사 승인 및 계약 발송") as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    fireEvent.change(screen.getByPlaceholderText("회사 승인자 직함(필수)"), {
      target: { value: "" },
    });
    expect(button.disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText("회사 승인자 직함(필수)"), {
      target: { value: "대표이사" },
    });
    expect(button.disabled).toBe(false);
  });
});

// 2026-09-07 — "정규 진행 권장" 선택 후 "기록"을 누르면 "Minified React error #441"이
// 그대로 렌더링되던 문제 조사. recordConsultationOutcome()을 { ok, error } 반환으로
// 바꿨으므로(consultation-scheduling-actions.ts), OutcomeForm이 실패 시 예외를 던지지
// 않고 화면에 에러 문구를 그대로 표시하는지(마스킹 재발 방지) 회귀 검증한다.
describe("ConsultationKanbanBoard — OutcomeForm 상담 결과 기록(2026-09-07 #441 마스킹 재발 방지)", () => {
  function scheduledCardRow() {
    return {
      id: "c-outcome",
      contact_name: "박서준",
      contact_email: "seojun@example.com",
      contact_phone: null,
      student_grade: "9학년",
      status: "scheduled",
      outcome: null,
      stage: "scheduled" as const,
    };
  }

  function scheduledCardDetail() {
    return {
      consultation: {
        id: "c-outcome",
        contact_name: "박서준",
        contact_email: "seojun@example.com",
        contact_phone: null,
        student_grade: "9학년",
        status: "scheduled",
        outcome: null,
        child_id: null,
        trial_intent_confirmed_at: null,
      },
      pipeline: null,
      childName: null,
      guardianEmail: "seojun@example.com",
      guardianName: "박서준",
      contractId: null,
      contractStatus: null,
      latestContractVersionHasEnvelope: false,
      noticeDeliveryStatus: null as "pending" | "sent" | "failed" | null,
      noticeSendError: null as string | null,
      noticeSentAt: null as string | null,
      childCards: [] as { consultationId: string; childName: string | null }[],
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    findDuplicateConsultationCandidatesMock.mockResolvedValue([]);
    listKanbanBoardActionMock.mockResolvedValue([scheduledCardRow()]);
    getConsultationCardDetailActionMock.mockResolvedValue(scheduledCardDetail());
  });

  it("recordConsultationOutcome이 { ok: false, error }를 반환하면(outcome=regular_recommended) 예외 없이 에러 문구를 그대로 보여준다", async () => {
    vi.mocked(recordConsultationOutcome).mockResolvedValueOnce({
      ok: false,
      error: "동의 확인이 완료되지 않아 상담 결과를 기록할 수 없습니다.",
    });

    render(<ConsultationKanbanBoard subjects={subjects} teacherCandidatesBySubject={teacherCandidatesBySubject} />);

    fireEvent.click(await screen.findByText("박서준"));
    await screen.findByTestId("consultation-card-detail");

    fireEvent.change(screen.getByPlaceholderText("관리자 검토 요약(필수)"), {
      target: { value: "정규 진행 권장 요약" },
    });
    fireEvent.change(screen.getByDisplayValue("체험 진행 권장"), {
      target: { value: "regular_recommended" },
    });
    fireEvent.click(screen.getByText("기록"));

    await waitFor(() =>
      expect(screen.getByText("동의 확인이 완료되지 않아 상담 결과를 기록할 수 없습니다.")).toBeInTheDocument()
    );
    // "Minified React error"로 마스킹되지 않고, 컴포넌트가 항상 던지는 일반화된
    // 메시지도 아니라 실제 서버 에러 메시지 그대로가 표시돼야 한다.
    expect(screen.queryByText(/Minified React error/)).not.toBeInTheDocument();

    expect(recordConsultationOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ consultationId: "c-outcome", outcome: "regular_recommended", adminReviewSummary: "정규 진행 권장 요약" })
    );
  });

  it("recordConsultationOutcome이 { ok: true }를 반환하면(outcome=regular_recommended) 정상 진행되고 에러가 표시되지 않는다", async () => {
    vi.mocked(recordConsultationOutcome).mockResolvedValueOnce({ ok: true });

    render(<ConsultationKanbanBoard subjects={subjects} teacherCandidatesBySubject={teacherCandidatesBySubject} />);

    fireEvent.click(await screen.findByText("박서준"));
    await screen.findByTestId("consultation-card-detail");

    fireEvent.change(screen.getByPlaceholderText("관리자 검토 요약(필수)"), {
      target: { value: "정규 진행 권장 요약" },
    });
    fireEvent.change(screen.getByDisplayValue("체험 진행 권장"), {
      target: { value: "regular_recommended" },
    });
    fireEvent.click(screen.getByText("기록"));

    await waitFor(() => expect(recordConsultationOutcome).toHaveBeenCalled());
    expect(screen.queryByText(/Minified React error/)).not.toBeInTheDocument();
  });
});
