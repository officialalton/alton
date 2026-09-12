import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConsentTab from "./ConsentTab";
import type { ChildConsentStatus, ConsentPolicyOption, TrialSmartNotesConsentStatus } from "./consent-data";
import type { ChildSubjectEnrollments } from "./enrollment-data";
import { confirmRegularProgressIntent, hasConfirmedRegularProgressIntent } from "./trial-conversion-actions";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

const consentForChildMock = vi.fn();
const consentToTrialSmartNotesMock = vi.fn();
vi.mock("./consent-actions", () => ({
  consentForChild: (...args: unknown[]) => consentForChildMock(...args),
  consentToTrialSmartNotes: (...args: unknown[]) => consentToTrialSmartNotesMock(...args),
}));

vi.mock("./trial-conversion-actions", () => ({
  confirmRegularProgressIntent: vi.fn(),
  hasConfirmedRegularProgressIntent: vi.fn(),
}));

const activePolicy: ConsentPolicyOption = {
  id: "policy1",
  version: "v1",
  title: "ALTON 개인정보 처리방침 v1",
  documentUrl: "https://example.com/policy-v1",
};

describe("ConsentTab", () => {
  it("13세 미만 자녀가 없으면 안내 문구만 보여준다", () => {
    render(<ConsentTab children={[]} activePolicy={activePolicy} trialSmartNotesChildren={[]} />);
    expect(
      screen.getByText("동의가 필요한 만 13세 미만 자녀가 없습니다.")
    ).toBeInTheDocument();
  });

  it("동의가 필요한 자녀에게 동의 버튼을 보여주고, 클릭하면 consentForChild를 호출한다", async () => {
    consentForChildMock.mockResolvedValue(undefined);
    const children: ChildConsentStatus[] = [
      {
        studentId: "student1",
        name: "지훈",
        isUnder13: true,
        dobKnown: true,
        hasValidConsent: false,
        latestConsent: null,
      },
    ];
    render(<ConsentTab children={children} activePolicy={activePolicy} trialSmartNotesChildren={[]} />);

    expect(screen.getByText("동의 필요")).toBeInTheDocument();
    fireEvent.click(screen.getByText(`${activePolicy.title} 원문 보기`));
    const modal = screen.getByTestId("consent-document-modal");
    expect(modal).toHaveTextContent(activePolicy.title);
    expect(modal.querySelector("iframe")).toHaveAttribute("src", activePolicy.documentUrl);
    fireEvent.click(screen.getByText("닫기"));
    expect(screen.queryByTestId("consent-document-modal")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(`${activePolicy.title}에 동의`));

    await waitFor(() => {
      expect(consentForChildMock).toHaveBeenCalledWith("student1", "policy1");
      expect(refreshMock).toHaveBeenCalled();
    });
  });

  it("생년월일이 아직 입력되지 않은 자녀는 is_under_13이 true여도 동의 카드를 띄우지 않는다(계정 생성 직후 P0 회귀 방지)", () => {
    const children: ChildConsentStatus[] = [
      { studentId: "student1", name: "테스트 자녀 4", isUnder13: true, dobKnown: false, hasValidConsent: false, latestConsent: null },
      { studentId: "student2", name: "테스트 자녀 5", isUnder13: true, dobKnown: false, hasValidConsent: false, latestConsent: null },
    ];
    render(<ConsentTab children={children} activePolicy={activePolicy} trialSmartNotesChildren={[]} />);
    expect(
      screen.getByText("동의가 필요한 만 13세 미만 자녀가 없습니다.")
    ).toBeInTheDocument();
    expect(screen.queryByTestId("consent-card-student1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("consent-card-student2")).not.toBeInTheDocument();
  });

  it("정책 원문 링크가 없으면 팝업에 '원문 준비 중입니다'를 보여준다", () => {
    const children: ChildConsentStatus[] = [
      {
        studentId: "student1",
        name: "지훈",
        isUnder13: true,
        dobKnown: true,
        hasValidConsent: false,
        latestConsent: null,
      },
    ];
    render(
      <ConsentTab
        children={children}
        activePolicy={{ ...activePolicy, documentUrl: null }}
        trialSmartNotesChildren={[]}
      />
    );

    fireEvent.click(screen.getByText(`${activePolicy.title} 원문 보기`));
    const modal = screen.getByTestId("consent-document-modal");
    expect(modal).toHaveTextContent("원문 준비 중입니다.");
    expect(modal.querySelector("iframe")).not.toBeInTheDocument();
  });

  it("동의가 유효한 자녀는 철회 버튼 대신 클릭 불가한 '동의 완료' 버튼을 보여준다", () => {
    const children: ChildConsentStatus[] = [
      {
        studentId: "student1",
        name: "지훈",
        isUnder13: true,
        dobKnown: true,
        hasValidConsent: true,
        latestConsent: {
          id: "consent1",
          policyVersionTitle: "ALTON 개인정보 처리방침 v1",
          consentedAt: "2026-08-01T00:00:00Z",
          revokedAt: null,
        },
      },
    ];
    render(<ConsentTab children={children} activePolicy={activePolicy} trialSmartNotesChildren={[]} />);
    expect(screen.queryByText("동의 철회")).not.toBeInTheDocument();
    const doneButton = screen.getByRole("button", { name: "동의 완료" });
    expect(doneButton).toBeDisabled();
    expect(screen.getByText(`${activePolicy.title} 원문 보기`)).toBeInTheDocument();
  });

  it("Smart Notes는 가족계약 조항이라는 안내 문구를 보여주고, 회차별 ON/OFF 컨트롤은 없다", () => {
    const children: ChildConsentStatus[] = [
      { studentId: "student2", name: "이서아", isUnder13: false, dobKnown: true, hasValidConsent: true, latestConsent: null },
    ];
    render(<ConsentTab children={children} activePolicy={activePolicy} trialSmartNotesChildren={[]} />);
    expect(screen.getByTestId("smart-notes-contract-notice")).toBeInTheDocument();
    expect(screen.queryByText(/사용 중 · 끄기/)).not.toBeInTheDocument();
    expect(screen.queryByText(/사용 안 함 · 켜기/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("ai-notes-card-student2")).not.toBeInTheDocument();
  });

  it("체험 Smart Notes 동의가 필요한 자녀를 보여주고, 클릭하면 consentToTrialSmartNotes를 호출한다", async () => {
    consentToTrialSmartNotesMock.mockResolvedValue(undefined);
    const trialSmartNotesChildren: TrialSmartNotesConsentStatus[] = [
      { studentId: "student3", name: "장유안", hasConsented: false },
    ];
    render(
      <ConsentTab
        children={[]}
        activePolicy={activePolicy}
        trialSmartNotesChildren={trialSmartNotesChildren}
      />
    );

    expect(screen.getByTestId("trial-smart-notes-consent-card-student3")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Smart Notes 이용 원문 보기"));
    const modal = screen.getByTestId("consent-document-modal");
    expect(modal).toHaveTextContent("Smart Notes 이용약관");
    expect(modal.querySelector("iframe")).toHaveAttribute("src", activePolicy.documentUrl);
    fireEvent.click(screen.getByText("닫기"));

    fireEvent.click(screen.getByText("체험 Smart Notes 사용에 동의"));

    await waitFor(() => {
      expect(consentToTrialSmartNotesMock).toHaveBeenCalledWith("student3", "v1");
      expect(refreshMock).toHaveBeenCalled();
    });
  });

  it("이미 동의한 자녀는 동의 버튼 대신 클릭 불가한 '동의 완료' 버튼만 보여준다", () => {
    const trialSmartNotesChildren: TrialSmartNotesConsentStatus[] = [
      { studentId: "student3", name: "장유안", hasConsented: true },
    ];
    render(
      <ConsentTab
        children={[]}
        activePolicy={activePolicy}
        trialSmartNotesChildren={trialSmartNotesChildren}
      />
    );

    const card = screen.getByTestId("trial-smart-notes-consent-card-student3");
    expect(card).toHaveTextContent("동의 완료");
    expect(screen.queryByText("체험 Smart Notes 사용에 동의")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "동의 완료" })).toBeDisabled();
  });

  it("체험 Smart Notes 동의가 필요한 자녀가 없으면 섹션 자체를 보여주지 않는다", () => {
    render(<ConsentTab children={[]} activePolicy={activePolicy} trialSmartNotesChildren={[]} />);
    expect(screen.queryByText("체험 Smart Notes 동의")).not.toBeInTheDocument();
  });

  it("정책 원문 링크가 없으면 팝업에 '준비 중'을 보여준다(체험 Smart Notes 카드)", () => {
    const trialSmartNotesChildren: TrialSmartNotesConsentStatus[] = [
      { studentId: "student3", name: "장유안", hasConsented: false },
    ];
    render(
      <ConsentTab
        children={[]}
        activePolicy={{ ...activePolicy, documentUrl: null }}
        trialSmartNotesChildren={trialSmartNotesChildren}
      />
    );
    fireEvent.click(screen.getByText("Smart Notes 이용 원문 보기"));
    expect(screen.getByTestId("consent-document-modal")).toHaveTextContent("원문 준비 중입니다.");
  });
});

describe("ConsentTab — 정규 진행 희망 섹션(2026-09-10, P0-5)", () => {
  const childrenSubjectEnrollments: ChildSubjectEnrollments[] = [
    {
      childId: "s1",
      childName: "지훈",
      enrollments: [{ id: "se1", subjectName: "SAT Math" } as never],
    },
  ];

  it("정규 진행 희망 대상 과목이 없으면 섹션을 보여주지 않는다", () => {
    render(<ConsentTab children={[]} activePolicy={activePolicy} trialSmartNotesChildren={[]} />);
    expect(screen.queryByTestId("regular-intent-section")).not.toBeInTheDocument();
  });

  it("정규 진행 희망 대상 과목이 있으면 체험 리뷰 상태와 무관하게 바로 선택 버튼을 보여준다", async () => {
    (hasConfirmedRegularProgressIntent as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    render(
      <ConsentTab
        children={[]}
        activePolicy={activePolicy}
        trialSmartNotesChildren={[]}
        childrenSubjectEnrollments={childrenSubjectEnrollments}
        progressedTrialEnrollmentIds={["se1"]}
      />
    );

    expect(screen.getByTestId("regular-intent-section")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "정규 진행 희망합니다" })).toBeInTheDocument();
  });

  it("focusSubjectEnrollmentId로 지정된 항목이 강조 표시된다", async () => {
    (hasConfirmedRegularProgressIntent as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    render(
      <ConsentTab
        children={[]}
        activePolicy={activePolicy}
        trialSmartNotesChildren={[]}
        childrenSubjectEnrollments={childrenSubjectEnrollments}
        progressedTrialEnrollmentIds={["se1"]}
        focusSubjectEnrollmentId="se1"
      />
    );

    const row = await screen.findByTestId("regular-intent-row-se1");
    expect(row.className).toContain("ring-2");
  });

  it("이미 정규 진행 희망을 접수한 과목은 버튼 대신 접수 완료 문구를 보여주고 재요청하지 않는다", async () => {
    (hasConfirmedRegularProgressIntent as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    render(
      <ConsentTab
        children={[]}
        activePolicy={activePolicy}
        trialSmartNotesChildren={[]}
        childrenSubjectEnrollments={childrenSubjectEnrollments}
        progressedTrialEnrollmentIds={["se1"]}
      />
    );

    expect(await screen.findByText(/접수 완료/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "정규 진행 희망합니다" })).not.toBeInTheDocument();
    expect(confirmRegularProgressIntent).not.toHaveBeenCalled();
  });
});
