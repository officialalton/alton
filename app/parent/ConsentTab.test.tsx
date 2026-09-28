import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConsentTab from "./ConsentTab";
import type { ChildConsentStatus, ConsentPolicyOption } from "./consent-data";

// 2026-09-28(초기 고객 절차 단순화) — 체험 Smart Notes 동의 섹션과 "정규 진행
// 희망" 섹션 테스트를 제거했다(해당 기능 자체가 ConsentTab.tsx에서 제거됨).
// 13세 미만 보호자 동의 테스트만 남긴다.

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

const consentForChildMock = vi.fn();
vi.mock("./consent-actions", () => ({
  consentForChild: (...args: unknown[]) => consentForChildMock(...args),
}));

const activePolicy: ConsentPolicyOption = {
  id: "policy1",
  version: "v1",
  title: "ALTON 개인정보 처리방침 v1",
  documentUrl: "https://example.com/policy-v1",
};

describe("ConsentTab", () => {
  it("13세 미만 자녀가 없으면 안내 문구만 보여준다", () => {
    render(<ConsentTab activePolicy={activePolicy}>{[]}</ConsentTab>);
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
    render(<ConsentTab activePolicy={activePolicy}>{children}</ConsentTab>);

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
    render(<ConsentTab activePolicy={activePolicy}>{children}</ConsentTab>);
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
      <ConsentTab activePolicy={{ ...activePolicy, documentUrl: null }}>
        {children}
      </ConsentTab>
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
    render(<ConsentTab activePolicy={activePolicy}>{children}</ConsentTab>);
    expect(screen.queryByText("동의 철회")).not.toBeInTheDocument();
    const doneButton = screen.getByRole("button", { name: "동의 완료" });
    expect(doneButton).toBeDisabled();
    expect(screen.getByText(`${activePolicy.title} 원문 보기`)).toBeInTheDocument();
  });

  it("Smart Notes는 가족계약 조항이라는 안내 문구를 보여주고, 회차별 ON/OFF 컨트롤은 없다", () => {
    const children: ChildConsentStatus[] = [
      { studentId: "student2", name: "이서아", isUnder13: false, dobKnown: true, hasValidConsent: true, latestConsent: null },
    ];
    render(<ConsentTab activePolicy={activePolicy}>{children}</ConsentTab>);
    expect(screen.getByTestId("smart-notes-contract-notice")).toBeInTheDocument();
    expect(screen.queryByText(/사용 중 · 끄기/)).not.toBeInTheDocument();
    expect(screen.queryByText(/사용 안 함 · 켜기/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("ai-notes-card-student2")).not.toBeInTheDocument();
  });
});
