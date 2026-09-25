import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LandingCtaLink from "./LandingCtaLink";
import * as analytics from "@/lib/analytics/track";

vi.mock("@/lib/analytics/track", () => ({
  trackEvent: vi.fn(),
}));

describe("LandingCtaLink", () => {
  it("클릭하면 landing_cta_clicked를 cta_name/section과 함께 발생시킨다", () => {
    render(
      <LandingCtaLink href="#consult" ctaName="consult_signup" section="header">
        상담 신청
      </LandingCtaLink>
    );
    fireEvent.click(screen.getByText("상담 신청"));
    expect(analytics.trackEvent).toHaveBeenCalledWith("landing_cta_clicked", {
      cta_name: "consult_signup",
      section: "header",
    });
  });
});
