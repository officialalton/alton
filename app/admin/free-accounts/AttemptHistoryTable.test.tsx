import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { factsFromRpcRows, type FactsRpcRow } from "@/lib/free-accounts/facts";

const apAction = vi.fn();
const satAction = vi.fn();
vi.mock("../free-accounts-actions", () => ({ getApAttemptViewForAdminAction: (...a: unknown[]) => apAction(...a), getAttemptDetailForAdminAction: (...a: unknown[]) => satAction(...a) }));
vi.mock("./AdminApResultView", () => ({ default: () => <div>AP result view</div> }));
vi.mock("@/app/student/mock-exam/[attemptId]/MockExamResultView", () => ({ default: () => <div>SAT result view</div> }));

import AttemptHistoryTable from "./AttemptHistoryTable";

const row = (over: Partial<FactsRpcRow> = {}): FactsRpcRow => ({
  attempt_id: "a1", exam_name: "AP English Language — Practice Exam 1", exam_track: "ap", ap_subject: "ap_english_language", difficulty_tier: "standard", format: "ap_fixed",
  status: "graded", started_at: "2026-10-19T00:00:00Z", submitted_at: "2026-10-19T01:00:00Z", graded_at: "2026-10-19T02:00:00Z", attempt_seq: 1, score_adjusted: false,
  rw_total: 0, rw_correct: 0, rw_complete: false, rw_route: null, math_total: 0, math_correct: 0, math_complete: false, math_route: null, mc_total: 45, mc_correct: 0, ...over,
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("AttemptHistoryTable", () => {
  it("AP: shows MC correct/total and the not-estimated note, opens the AP view only", async () => {
    apAction.mockResolvedValueOnce({ detail: {} });
    render(<AttemptHistoryTable rows={factsFromRpcRows([row()])} />);
    expect(screen.getByText(/0\/45 correct/)).toBeTruthy();
    expect(screen.getByText(/AP scores \(1–5\) are not estimated/)).toBeTruthy();
    fireEvent.click(screen.getByText("View result"));
    await waitFor(() => expect(screen.getByText("AP result view")).toBeTruthy());
    expect(satAction).not.toHaveBeenCalled();
  });
  it("falls back to the AP view when the list row says SAT but the detail is AP", async () => {
    satAction.mockResolvedValueOnce({ examProgram: "ap" });
    apAction.mockResolvedValueOnce({ detail: {} });
    render(<AttemptHistoryTable rows={factsFromRpcRows([row({ exam_track: "sat", ap_subject: null, format: "fixed" })])} />);
    fireEvent.click(screen.getByText("View result"));
    await waitFor(() => expect(screen.getByText("AP result view")).toBeTruthy());
    expect(screen.queryByText("SAT result view")).toBeNull();
  });
  it("SAT regression: still opens the SAT result view with the fixed-format summary", async () => {
    satAction.mockResolvedValueOnce({ examProgram: "sat" });
    render(<AttemptHistoryTable rows={factsFromRpcRows([row({ exam_track: "sat", ap_subject: null, format: "fixed", rw_total: 27, rw_correct: 20, math_total: 22, math_correct: 10, mc_total: 0, mc_correct: null })])} />);
    expect(screen.getByText(/30\/49 correct/)).toBeTruthy();
    fireEvent.click(screen.getByText("View result"));
    await waitFor(() => expect(screen.getByText("SAT result view")).toBeTruthy());
    expect(apAction).not.toHaveBeenCalled();
  });
});
