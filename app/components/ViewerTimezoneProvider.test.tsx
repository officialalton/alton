import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ViewerTimezoneProvider, useViewerTimezone } from "./ViewerTimezoneProvider";
import { DISPLAY_TIMEZONE } from "@/lib/format-datetime";
import CreditsTab from "@/app/student/CreditsTab";
import ConsentTab from "@/app/parent/ConsentTab";
import { vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/student/credits-actions", () => ({ requestParentPayment: vi.fn() }));
vi.mock("@/app/parent/consent-actions", () => ({ consentForChild: vi.fn() }));

function Probe() {
  return <span data-testid="tz">{useViewerTimezone()}</span>;
}

// 2026-09-29T15:04Z = 서울 9/30 00:04, 로스앤젤레스 9/29 08:04 — 날짜가 갈리는 순간.
const INSTANT = "2026-09-29T15:04:00.000Z";

describe("ViewerTimezoneProvider / useViewerTimezone", () => {
  it("Provider 밖에서는 DISPLAY_TIMEZONE으로 폴백한다", () => {
    render(<Probe />);
    expect(screen.getByTestId("tz")).toHaveTextContent(DISPLAY_TIMEZONE);
  });

  it("Provider가 준 시간대를 그대로 돌려준다", () => {
    render(
      <ViewerTimezoneProvider timezone="America/Los_Angeles">
        <Probe />
      </ViewerTimezoneProvider>
    );
    expect(screen.getByTestId("tz")).toHaveTextContent("America/Los_Angeles");
  });

  it("null/빈 값이면 DISPLAY_TIMEZONE으로 폴백한다", () => {
    render(
      <ViewerTimezoneProvider timezone={null}>
        <Probe />
      </ViewerTimezoneProvider>
    );
    expect(screen.getByTestId("tz")).toHaveTextContent(DISPLAY_TIMEZONE);
  });

  it("중첩되면 가장 가까운 Provider가 이긴다", () => {
    render(
      <ViewerTimezoneProvider timezone="Asia/Seoul">
        <ViewerTimezoneProvider timezone="America/New_York">
          <Probe />
        </ViewerTimezoneProvider>
      </ViewerTimezoneProvider>
    );
    expect(screen.getByTestId("tz")).toHaveTextContent("America/New_York");
  });
});

describe("같은 화면을 두 시간대로 렌더 — 서로 다르지만 각각 일관된 출력", () => {
  const credits = { balance: 0, guardianName: null, regularRemaining: 3, regularNearestExpiry: INSTANT, trialEntitlement: null };
  const child = {
    studentId: "c1",
    name: "지훈",
    isUnder13: true,
    dobKnown: true,
    hasValidConsent: true,
    latestConsent: { id: "x", policyVersionTitle: "정책 v1", consentedAt: INSTANT, revokedAt: null },
  };

  it("학생 CreditsTab: LA는 9월 29일, 서울은 9월 30일", () => {
    const la = render(
      <ViewerTimezoneProvider timezone="America/Los_Angeles">
        <CreditsTab data={credits} />
      </ViewerTimezoneProvider>
    );
    expect(la.container.textContent).toContain("2026년 9월 29일");
    la.unmount();
    const seoul = render(
      <ViewerTimezoneProvider timezone="Asia/Seoul">
        <CreditsTab data={credits} />
      </ViewerTimezoneProvider>
    );
    expect(seoul.container.textContent).toContain("2026년 9월 30일");
    expect(seoul.container.textContent).not.toContain("2026년 9월 29일");
  });

  it("학부모 ConsentTab: LA와 서울의 날짜가 갈린다", () => {
    const render1 = (tz: string) =>
      render(
        <ViewerTimezoneProvider timezone={tz}>
          <ConsentTab {...{ children: [child], activePolicy: null }} />
        </ViewerTimezoneProvider>
      );
    const la = render1("America/Los_Angeles");
    expect(la.container.textContent).toContain("2026. 9. 29.");
    la.unmount();
    const seoul = render1("Asia/Seoul");
    expect(seoul.container.textContent).toContain("2026. 9. 30.");
  });
});
