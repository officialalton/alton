import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConsentTab from "./ConsentTab";
import type { ChildConsentStatus, ConsentPolicyOption } from "./consent-data";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

const consentForChildMock = vi.fn();
const revokeChildConsentMock = vi.fn();
vi.mock("./consent-actions", () => ({
  consentForChild: (...args: unknown[]) => consentForChildMock(...args),
  revokeChildConsent: (...args: unknown[]) => revokeChildConsentMock(...args),
}));

const activePolicy: ConsentPolicyOption = {
  id: "policy1",
  version: "v1",
  title: "ALTON 개인정보 처리방침 v1",
  documentUrl: "https://example.com/policy-v1",
};

describe("ConsentTab", () => {
  it("13세 미만 자녀가 없으면 안내 문구만 보여준다", () => {
    render(<ConsentTab children={[]} activePolicy={activePolicy} />);
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
        hasValidConsent: false,
        latestConsent: null,
      },
    ];
    render(<ConsentTab children={children} activePolicy={activePolicy} />);

    expect(screen.getByText("동의 필요")).toBeInTheDocument();
    const link = screen.getByText(`${activePolicy.title} 원문 보기`);
    expect(link.closest("a")).toHaveAttribute("href", activePolicy.documentUrl);
    fireEvent.click(screen.getByText(`${activePolicy.title}에 동의`));

    await waitFor(() => {
      expect(consentForChildMock).toHaveBeenCalledWith("student1", "policy1");
      expect(refreshMock).toHaveBeenCalled();
    });
  });

  it("정책 원문 링크가 없으면 '원문 준비 중'을 보여준다", () => {
    const children: ChildConsentStatus[] = [
      {
        studentId: "student1",
        name: "지훈",
        isUnder13: true,
        hasValidConsent: false,
        latestConsent: null,
      },
    ];
    render(
      <ConsentTab
        children={children}
        activePolicy={{ ...activePolicy, documentUrl: null }}
      />
    );

    expect(screen.getByText(`${activePolicy.title} 원문 준비 중`)).toBeInTheDocument();
  });

  it("동의가 유효한 자녀는 철회 버튼을 보여준다", () => {
    const children: ChildConsentStatus[] = [
      {
        studentId: "student1",
        name: "지훈",
        isUnder13: true,
        hasValidConsent: true,
        latestConsent: {
          id: "consent1",
          policyVersionTitle: "ALTON 개인정보 처리방침 v1",
          consentedAt: "2026-08-01T00:00:00Z",
          revokedAt: null,
        },
      },
    ];
    render(<ConsentTab children={children} activePolicy={activePolicy} />);
    expect(screen.getByText("동의 완료")).toBeInTheDocument();
    expect(screen.getByText("동의 철회")).toBeInTheDocument();
  });

  it("Smart Notes는 가족계약 조항이라는 안내 문구를 보여주고, 회차별 ON/OFF 컨트롤은 없다", () => {
    const children: ChildConsentStatus[] = [
      { studentId: "student2", name: "이서아", isUnder13: false, hasValidConsent: true, latestConsent: null },
    ];
    render(<ConsentTab children={children} activePolicy={activePolicy} />);
    expect(screen.getByTestId("smart-notes-contract-notice")).toBeInTheDocument();
    expect(screen.queryByText(/사용 중 · 끄기/)).not.toBeInTheDocument();
    expect(screen.queryByText(/사용 안 함 · 켜기/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("ai-notes-card-student2")).not.toBeInTheDocument();
  });
});
