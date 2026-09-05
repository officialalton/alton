import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import TrialOnboardingPanel from "./TrialOnboardingPanel";
import {
  listTrialOnboardingCandidatesAction,
  listRegularConversionCandidatesAction,
  getTrialOnboardingPipelineAction,
  confirmTrialIntentAction,
  sendRegularContractOneClickAction,
} from "./trial-onboarding-actions";
import { retryTrialEntitlementGrant } from "./consultation-scheduling-actions";

vi.mock("./trial-onboarding-actions", () => ({
  listTrialOnboardingCandidatesAction: vi.fn(),
  listRegularConversionCandidatesAction: vi.fn(),
  getTrialOnboardingPipelineAction: vi.fn(),
  confirmTrialIntentAction: vi.fn(),
  createTrialOnboardingLinkAction: vi.fn(),
  planTrialSubjectAndAssignTeacherAction: vi.fn(),
  sendRegularContractOneClickAction: vi.fn(),
}));

vi.mock("./consultation-scheduling-actions", () => ({
  retryTrialEntitlementGrant: vi.fn(),
}));

const baseCandidate = {
  consultationId: "c1",
  contactName: "김학부모",
  contactEmail: "parent@example.com",
  trialIntentConfirmedAt: null,
  childId: null,
  linkStatus: "none" as const,
};

function stepList(doneKeys: string[]) {
  const all = [
    "trial_intent",
    "account_linked",
    "assignment",
    "trial_consent",
    "trial_entitlement",
    "trial_booking",
    "smart_notes",
    "review",
    "regular_intent",
    "contract_sent",
    "signed",
    "purchase",
    "subject_active",
  ];
  const labels: Record<string, string> = {
    trial_intent: "체험 희망 확정",
    account_linked: "보호자·학생 계정 연결",
    assignment: "과목·선생님 배정",
    trial_consent: "체험 Smart Notes 동의",
    trial_entitlement: "체험수업권 지급",
    trial_booking: "체험 예약",
    smart_notes: "Smart Notes 연결",
    review: "선생님 리뷰 확정",
    regular_intent: "정규 진행 희망",
    contract_sent: "계약 발송",
    signed: "보호자 서명",
    purchase: "정규상품 구매",
    subject_active: "과목 활성화",
  };
  return all.map((key) => ({ key, done: doneKeys.includes(key), label: labels[key] }));
}

describe("TrialOnboardingPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("체험 희망 미확정 상태에서는 '체험 진행 확정' 버튼만 보이고, 클릭하면 다음 단계 버튼으로 바뀐다", async () => {
    (listTrialOnboardingCandidatesAction as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([baseCandidate])
      .mockResolvedValueOnce([{ ...baseCandidate, trialIntentConfirmedAt: "2026-09-03T00:00:00Z" }]);
    (listRegularConversionCandidatesAction as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getTrialOnboardingPipelineAction as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ consultationId: "c1", subjectEnrollmentId: null, steps: stepList([]) })
      .mockResolvedValueOnce({ consultationId: "c1", subjectEnrollmentId: null, steps: stepList(["trial_intent"]) });
    (confirmTrialIntentAction as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    render(<TrialOnboardingPanel />);

    const confirmButton = await screen.findByRole("button", { name: "체험 진행 확정" });
    expect(screen.queryByRole("button", { name: "체험 온보딩 안내 발송" })).toBeNull();

    fireEvent.click(confirmButton);

    await waitFor(() => expect(screen.getByRole("button", { name: "체험 온보딩 안내 발송" })).toBeInTheDocument());
    expect(confirmTrialIntentAction).toHaveBeenCalledWith("c1");
  });

  it("각 단계의 완료/다음 행동을 순서대로 보여준다(체크 표시 + '다음 관리자 행동' 안내)", async () => {
    (listTrialOnboardingCandidatesAction as ReturnType<typeof vi.fn>).mockResolvedValue([
      { ...baseCandidate, trialIntentConfirmedAt: "2026-09-03T00:00:00Z", childId: "child1", linkStatus: "redeemed" },
    ]);
    (listRegularConversionCandidatesAction as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getTrialOnboardingPipelineAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      consultationId: "c1",
      subjectEnrollmentId: null,
      steps: stepList(["trial_intent", "account_linked"]),
    });

    render(<TrialOnboardingPanel />);

    await screen.findByText("과목·선생님 배정");
    expect(screen.getByText("← 다음 관리자 행동")).toBeInTheDocument();
    expect(screen.getAllByText("완료").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "과목 수강 + 선생님 배정" })).toBeInTheDocument();
  });

  it("보호자 이메일/이름을 확인할 수 없으면 계약 발송 버튼이 차단되고 사유가 보인다", async () => {
    (listTrialOnboardingCandidatesAction as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (listRegularConversionCandidatesAction as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        subjectEnrollmentId: "se1",
        childId: "child1",
        childName: "학생",
        subjectName: "SAT Math",
        guardianEmail: null,
        guardianName: null,
        contractStatus: "draft",
      },
    ]);

    render(<TrialOnboardingPanel />);

    const sendButton = await screen.findByRole("button", { name: "정규 계약 발송" });
    expect(sendButton).toBeDisabled();
    expect(screen.getByText(/발송 차단/)).toBeInTheDocument();
  });

  it("계약 발송은 확인 단계를 거치고, 실패 시 재처리 안내를 보여준다(중복 발송 없음)", async () => {
    (listTrialOnboardingCandidatesAction as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (listRegularConversionCandidatesAction as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        subjectEnrollmentId: "se1",
        childId: "child1",
        childName: "학생",
        subjectName: "SAT Math",
        guardianEmail: "g@example.com",
        guardianName: "학부모",
        contractStatus: "draft",
      },
    ]);
    (sendRegularContractOneClickAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "failed",
      contractVersionId: "v1",
      error: "DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS=true가 아니면 실제 DocuSign API를 호출하지 않습니다.",
    });

    render(<TrialOnboardingPanel />);

    fireEvent.click(await screen.findByRole("button", { name: "정규 계약 발송" }));
    expect(await screen.findByText(/회사 선서명과 DocuSign 발송이 한 번에/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "확인 — 선서명 + 발송 실행" }));

    await screen.findByText(/발송 실패 — 관리자 조치 필요/);
    expect(sendRegularContractOneClickAction).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });

  it("체험수업권 지급이 실패했으면 사유와 재시도 버튼을 보여주고, 클릭하면 재시도 후 파이프라인을 새로 불러온다", async () => {
    (listTrialOnboardingCandidatesAction as ReturnType<typeof vi.fn>).mockResolvedValue([
      { ...baseCandidate, trialIntentConfirmedAt: "2026-09-03T00:00:00Z", childId: "child1", linkStatus: "redeemed" },
    ]);
    (listRegularConversionCandidatesAction as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getTrialOnboardingPipelineAction as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        consultationId: "c1",
        subjectEnrollmentId: "se1",
        trialEntitlementGrantStatus: "failed",
        trialEntitlementGrantError: "연결된 학생 계정이 없어 체험수업권을 지급할 수 없습니다.",
        steps: stepList(["trial_intent", "account_linked", "assignment", "trial_consent"]),
      })
      .mockResolvedValueOnce({
        consultationId: "c1",
        subjectEnrollmentId: "se1",
        trialEntitlementGrantStatus: "granted",
        trialEntitlementGrantError: null,
        steps: stepList(["trial_intent", "account_linked", "assignment", "trial_consent", "trial_entitlement"]),
      });
    (retryTrialEntitlementGrant as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    render(<TrialOnboardingPanel />);

    await screen.findByText(/체험수업권 지급에 실패했습니다: 연결된 학생 계정이 없어/);
    fireEvent.click(screen.getByRole("button", { name: "체험수업권 지급 재시도" }));

    await waitFor(() => expect(retryTrialEntitlementGrant).toHaveBeenCalledWith("c1"));
    await waitFor(() => expect(getTrialOnboardingPipelineAction).toHaveBeenCalledTimes(2));
  });
});
