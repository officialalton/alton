import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LandingView from "./LandingView";
import { resolveLandingDestinations } from "@/lib/landing/cta";
import { FOOTER_LINKS } from "@/lib/landing/copy";
import type { LandingAvailability } from "@/lib/landing/practice-test-count";

vi.mock("./consult-actions", () => ({ submitHomepageConsultRequest: vi.fn() }));
const dest = resolveLandingDestinations({ kind: "anonymous" });
const card = () => screen.queryByRole("region", { name: "Practice test availability" });

describe("LandingView", () => {
  it("헤드라인은 숫자 없는 고정 문구, CTA·푸터 링크를 렌더한다", () => {
    render(<LandingView dest={dest} />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toContain("Free SAT & AP Practice Tests.");
    expect(h1.textContent).toContain("Turn Every Mistake Into Progress.");
    expect(h1.textContent).not.toMatch(/\d/);
    expect(screen.getAllByText("Start Practicing for Free")[0].closest("a")).toHaveAttribute("href", "/signup/student");
    for (const l of FOOTER_LINKS) expect(document.querySelector(`footer a[href="${l.href}"]`)).not.toBeNull();
  });

  it("조회 실패(빈 데이터)면 가용성 카드 없이 정적 히어로", () => {
    render(<LandingView dest={dest} availability={{ sat: 0, ap: [] }} />);
    expect(card()).toBeNull();
    expect(screen.queryByText(/Coming soon/)).toBeNull();
  });

  it("SAT 13 + AP Calculus AB 4세트/풀 1개를 보인다. 헤드라인에는 숫자를 넣지 않는다", () => {
    const a: LandingAvailability = { sat: 13, ap: [{ subject: "ap_calculus_ab", label: "AP Calculus AB", sets: 4, fullExams: 1 }] };
    render(<LandingView dest={dest} availability={a} />);
    const c = within(card()!);
    expect(c.getByText("13")).toBeInTheDocument();
    expect(c.getByText("AP Calculus AB")).toBeInTheDocument();
    expect(c.getByText("4 sets · 1 full practice exam")).toBeInTheDocument();
    expect(c.getByText("New tests are added regularly.")).toBeInTheDocument();
    expect(c.getByText("We're building toward 10+ full practice exams per AP subject.")).toBeInTheDocument();
    const coming = c.getByText("Coming soon").parentElement!.textContent!;
    expect(coming).not.toContain("AP Calculus AB");
    expect(coming).toContain("AP Calculus BC");
    expect(screen.getByRole("heading", { level: 1 }).textContent).not.toContain("13");
  });

  it("AP 가 없으면 SAT 와 Coming soon 목록만(AP 가용 항목 없음)", () => {
    render(<LandingView dest={dest} availability={{ sat: 13, ap: [] }} />);
    const c = within(card()!);
    expect(c.getByText("13")).toBeInTheDocument();
    expect(c.queryByText(/ sets?\b/)).toBeNull();
    expect(c.getByText("Coming soon").parentElement!.textContent).toContain("AP Calculus AB");
  });

  it("풀 시험이 없으면 세트 수만 표시한다", () => {
    render(<LandingView dest={dest} availability={{ sat: 0, ap: [{ subject: "ap_biology", label: "AP Biology", sets: 1, fullExams: 0 }] }} />);
    expect(screen.getByText("1 set")).toBeInTheDocument();
  });
});
