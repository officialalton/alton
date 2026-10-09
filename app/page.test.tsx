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
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Free SAT Practice Tests.");
  });

  it("게시 수가 있으면 숫자와 '계속 추가' 문구를 보인다", () => {
    render(<LandingView dest={resolveLandingDestinations({ kind: "anonymous" })} practiceTestCount={13} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("13 Free SAT Practice Tests.");
    expect(screen.getByText("New tests are added regularly.")).toBeInTheDocument();
  });

  it("AP 세트가 있으면 SAT 숫자와 별도로 알린다(SAT 제목에 AP 를 섞지 않는다)", () => {
    render(<LandingView dest={resolveLandingDestinations({ kind: "anonymous" })} practiceTestCount={13} apPracticeSetCount={4} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("13 Free SAT Practice Tests.");
    expect(screen.getByRole("heading", { level: 1 }).textContent).not.toContain("17");
    expect(screen.getByText("Plus 4 AP practice sets. New tests are added regularly.")).toBeInTheDocument();
  });

  it("헤드라인·CTA·푸터 링크 렌더(계속)", () => {
    render(<LandingView dest={resolveLandingDestinations({ kind: "anonymous" })} />);
    expect(screen.getAllByText("Start Practicing for Free")[0].closest("a")).toHaveAttribute("href", "/signup/student");
    expect(screen.getAllByText("Explore Premium Tutoring")[0].closest("a")).toHaveAttribute("href", "/premium-tutoring");
    for (const l of FOOTER_LINKS) expect(document.querySelector(`footer a[href="${l.href}"]`)).not.toBeNull();
  });
});
