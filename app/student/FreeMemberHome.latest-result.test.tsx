import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import FreeMemberHome from "./FreeMemberHome";
import { completedScoreText } from "@/lib/mock-exam/open-list";
import type { MockExamAttemptSummary } from "@/lib/mock-exam/attempt-data";

vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("@/app/components/PageFrame", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

const base = { examSetId: "e", examSetName: "Practice Test 1", difficultyTier: "x", studentId: "s", studentName: null, assignedByName: null, dueAt: null, startBy: null, startedAt: null, submittedAt: null, gradedAt: "2026-10-01", entryCount: 1 } as const;
const sat = (extra: Partial<MockExamAttemptSummary> = {}) => ({ ...base, id: "a1", status: "graded", totalCount: 98, correctCount: 27, examProgram: "sat", ...extra }) as MockExamAttemptSummary;
const est = { rw: { low: 300, high: 360 }, math: { low: 320, high: 380 }, total: { low: 620, high: 740 }, modelVersion: "v1-adaptive" };
const home = (attempts: MockExamAttemptSummary[]) =>
  render(<FreeMemberHome studentName="A" overview={{ catalog: [], attempts }} weaknesses={[]} gradedAttemptCount={attempts.length} onSelectTab={() => {}} />);

describe("FreeMemberHome latest result", () => {
  it("shows the score range with caveat and correct count", () => {
    home([sat({ scoreRange: { estimate: est, insufficient: false } })]);
    const t = screen.getByTestId("free-home-latest-result").textContent;
    expect(t).toContain("620–740");
    expect(t).toContain("R&W 300–360");
    expect(t).toContain("Math 320–380");
    expect(t).toContain("Internal estimate — accuracy not verified");
    expect(t).toContain("27/98 correct");
  });
  it("shows insufficient-responses text", () => {
    home([sat({ scoreRange: { estimate: null, insufficient: true } })]);
    const t = screen.getByTestId("free-home-latest-result").textContent;
    expect(t).toContain("Not enough responses to estimate a score range.");
    expect(t).not.toContain("620");
  });
  it("keeps MC-count text for AP", () => {
    home([sat({ examProgram: "ap", apSubject: null, apLabel: "mc_practice", totalCount: 55, correctCount: 40 })]);
    const t = screen.getByTestId("free-home-latest-result").textContent;
    expect(t).toContain("40/55 multiple-choice correct");
    expect(t).not.toContain("estimate");
  });
  it("shows empty state with no attempt", () => {
    home([]);
    expect(screen.getByTestId("free-home-latest-result").textContent).toContain("No graded attempts yet");
  });
  it("completed-list text carries the range for SAT only", () => {
    const a = sat();
    expect(completedScoreText(a)).toBe(" · 27/98 correct");
    expect(completedScoreText({ ...a, scoreRange: { estimate: est, insufficient: false } })).toBe(" · 620–740 (est.) · 27/98 correct");
  });
});
