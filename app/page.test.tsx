import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LandingView from "./LandingView";
import { resolveLandingDestinations } from "@/lib/landing/cta";
import { FOOTER_LINKS } from "@/lib/landing/copy";

vi.mock("./consult-actions", () => ({ submitHomepageConsultRequest: vi.fn() }));

describe("LandingView", () => {
  it("헤드라인·CTA·푸터 링크를 렌더한다", () => {
    render(<LandingView dest={resolveLandingDestinations({ kind: "anonymous" })} />);
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("50 Free SAT & AP Practice Tests.");
    expect(screen.getAllByText("Start Practicing for Free")[0].closest("a")).toHaveAttribute("href", "/signup/student");
    expect(screen.getAllByText("Explore Premium Tutoring")[0].closest("a")).toHaveAttribute("href", "/premium-tutoring");
    for (const l of FOOTER_LINKS) expect(document.querySelector(`footer a[href="${l.href}"]`)).not.toBeNull();
  });
});
