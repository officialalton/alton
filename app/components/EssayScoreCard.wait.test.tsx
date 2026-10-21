import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EssayScoreView } from "@/lib/essay-grading/view";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import EssayScoreCard from "./EssayScoreCard";

const row = (over: Partial<EssayScoreView>): EssayScoreView => ({ setItemId: "i", partLabel: "a", status: "failed", scores: null, rationale: null, lastError: null, nextRetryAt: null, ...over });
afterEach(() => cleanup());
const future = new Date(Date.now() + 3 * 3600_000).toISOString();
const past = new Date(Date.now() - 3600_000).toISOString();

describe("EssayScoreCard — waiting and missing reference answers", () => {
  it("daily cap before reset: explains the wait with the UTC time, no retry button, never 'try again tomorrow'", () => {
    render(<EssayScoreCard score={row({ lastError: "daily_cap", nextRetryAt: future })} onRetry={() => {}} />);
    expect(screen.getByTestId("essay-score-waiting")).toHaveTextContent("daily AI scoring limit was reached");
    expect(screen.getByTestId("essay-score-waiting")).toHaveTextContent("UTC");
    expect(screen.queryByRole("button")).toBeNull();
    expect(document.body.textContent).not.toMatch(/tomorrow/i);
  });
  it("after the reset time the Retry button (the real path) appears", () => {
    render(<EssayScoreCard score={row({ lastError: "monthly_budget", nextRetryAt: past })} onRetry={() => {}} />);
    expect(screen.getByTestId("essay-score-waiting")).toHaveTextContent("monthly AI scoring capacity");
    expect(screen.getByRole("button", { name: "Retry now" })).toBeInTheDocument();
  });
  it("read-only viewers (parent/admin) see the reason but no button", () => {
    render(<EssayScoreCard score={row({ lastError: "daily_cap", nextRetryAt: past })} readOnly />);
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("missing reference answers: explicit reason, not 'Scoring in progress'", () => {
    render(<EssayScoreCard score={row({ lastError: "no_reference_answers" })} onRetry={() => {}} />);
    expect(screen.getByTestId("essay-score-no-anchors")).toHaveTextContent("no reference answers are available");
    expect(screen.queryByText(/Scoring in progress/)).toBeNull();
  });
  it("ordinary failure never promises an automatic retry", () => {
    render(<EssayScoreCard score={row({ lastError: "grader_error" })} readOnly />);
    expect(document.body.textContent).not.toMatch(/automatically/i);
  });
});
