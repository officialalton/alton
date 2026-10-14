import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EssayScoreCard from "./EssayScoreCard";
import type { EssayScoreView } from "@/lib/essay-grading/view";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(cleanup);

const base: EssayScoreView = { setItemId: "i", partLabel: "a", status: "done", lastError: null,
  scores: { thesis: 1, evidence: 3, sophistication: 0, total: 4 }, rationale: { thesis: "Clear claim.", evidence: "Specific details.", sophistication: "Little nuance.", improve: ["Explain more."] } };

describe("EssayScoreCard", () => {
  it("renders nothing without a row", () => { const { container } = render(<EssayScoreCard score={null} />); expect(container).toBeEmptyDOMElement(); });
  it("done: label, rows, total, improve, disclaimer", () => {
    render(<EssayScoreCard score={base} />);
    expect(screen.getByText(/AI estimated score \(internal estimate — not an official AP score\)/)).toBeTruthy();
    expect(screen.getByTestId("essay-score-total").textContent).toMatch(/4\s*\/ 6/);
    expect(screen.getByTestId("essay-row-evidence").textContent).toMatch(/3\/4/);
    expect(screen.getByTestId("essay-improve")).toBeTruthy();
    expect(screen.getByText(/not equivalent to an official AP/)).toBeTruthy();
    expect(screen.queryByTestId("essay-disagreement")).toBeNull();
  });
  it("disagreement note", () => { render(<EssayScoreCard score={{ ...base, scores: { ...base.scores!, disagreement: true } }} />); expect(screen.getByTestId("essay-disagreement")).toBeTruthy(); });
  it("pending is a polite status and polls via refresh", () => {
    vi.useFakeTimers(); render(<EssayScoreCard score={{ ...base, status: "pending", scores: null, rationale: null }} />);
    expect(screen.getByRole("status").textContent).toMatch(/in progress/); vi.advanceTimersByTime(6100); expect(refresh).toHaveBeenCalled(); vi.useRealTimers();
  });
  it("failed shows Retry for students only", () => {
    const onRetry = vi.fn(); const f = { ...base, status: "failed" as const, scores: null, rationale: null };
    const { rerender } = render(<EssayScoreCard score={f} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: /retry now/i })); expect(onRetry).toHaveBeenCalledOnce();
    rerender(<EssayScoreCard score={f} readOnly onRetry={onRetry} />); expect(screen.queryByRole("button")).toBeNull();
  });
  it("dead and skipped explain without a score", () => {
    const { rerender } = render(<EssayScoreCard score={{ ...base, status: "dead", scores: null, rationale: null }} />);
    expect(screen.getByTestId("essay-score-dead")).toBeTruthy();
    rerender(<EssayScoreCard score={{ ...base, status: "skipped", lastError: "too_short", scores: null, rationale: null }} />);
    expect(screen.getByText(/too short/)).toBeTruthy();
  });
});
