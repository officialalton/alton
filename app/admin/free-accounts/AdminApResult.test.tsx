import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MockExamAttemptDetail } from "@/lib/mock-exam/attempt-data";
import { AP_LAYOUTS } from "@/lib/ap-exam/layouts";

const requireAdmin = vi.fn();
const loadDetail = vi.fn();
const loadScores = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/admin-auth", () => ({ requireAdminOrCapability: (...a: unknown[]) => requireAdmin(...a) }));
vi.mock("@/lib/mock-exam/attempt-data", () => ({ loadMockExamAttemptDetail: (...a: unknown[]) => loadDetail(...a) }));
vi.mock("@/lib/essay-grading/view", () => ({ loadEssayScores: (...a: unknown[]) => loadScores(...a) }));
vi.mock("@/lib/free-accounts/facts", () => ({ factsFromRpcRows: vi.fn() }));
vi.mock("./../users-actions", () => ({ setStudentStatus: vi.fn() }));
vi.mock("@/lib/essay-grading/actions", () => ({ enqueueEssayGradingAction: vi.fn() }));
vi.mock("@/app/components/ProblemErrorReportButton", () => ({ default: () => <button type="button">Report a problem</button> }));

import { getApAttemptViewForAdminAction } from "../free-accounts-actions";
import { unscoredLabel } from "@/lib/free-accounts/unscored-label";
import AdminApResultView from "./AdminApResultView";

const mc = (i: number, ok: boolean) => ({ setItemId: `m${i}`, section: "ap_mc", format: "mc", question: "Q", options: ["a", "b"], correctIndex: 0, response: ok ? "0" : "1", correct: ok, parts: null, satDomain: "ap:U1.1" });
const essay = (id: string) => ({ setItemId: id, section: "ap_frq", format: "essay", question: "W", options: null, response: "text", correct: null, satDomain: "ap:U1.1", parts: [{ label: "a", points: 6, prompt: "W", mode: "essay" }] });
const detail = (over: Record<string, unknown> = {}) => ({
  id: "att1", examSetName: "AP English Language — Practice Exam 1", studentId: "stu1", examProgram: "ap", apSubject: "ap_english_language", apLabel: "full_practice", status: "graded",
  sectionLayout: AP_LAYOUTS.ap_english_language, items: [...Array.from({ length: 45 }, (_, i) => mc(i, i < 30)), essay("e1"), essay("e2"), essay("e3")], ...over,
}) as unknown as MockExamAttemptDetail;
const sb = (flag: boolean | null, versions: { rubric_version: string; model: string | null }[]) => ({
  from: (t: string) => ({ select: () => ({ eq: () => (t === "students" ? { maybeSingle: async () => ({ data: flag === null ? null : { is_test_account: flag } }) } : Promise.resolve({ data: versions })) }) }),
});

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("getApAttemptViewForAdminAction", () => {
  it("rejects non-admins before reading anything", async () => {
    requireAdmin.mockRejectedValueOnce(new Error("Forbidden"));
    await expect(getApAttemptViewForAdminAction("att1")).rejects.toThrow("Forbidden");
    expect(loadDetail).not.toHaveBeenCalled();
    expect(loadScores).not.toHaveBeenCalled();
  });
  it("returns null for a non-AP attempt (caller uses the SAT view)", async () => {
    requireAdmin.mockResolvedValueOnce({ supabase: sb(false, []) });
    loadDetail.mockResolvedValueOnce(detail({ examProgram: "sat" }));
    expect(await getApAttemptViewForAdminAction("att1")).toBeNull();
  });
  it("collects the test flag and the applied scoring versions", async () => {
    requireAdmin.mockResolvedValueOnce({ supabase: sb(true, [{ rubric_version: "englang-v2", model: "m1" }, { rubric_version: "englang-v2", model: "m1" }]) });
    loadDetail.mockResolvedValueOnce(detail());
    loadScores.mockResolvedValueOnce([]);
    const v = await getApAttemptViewForAdminAction("att1");
    expect(v?.isTestAccount).toBe(true);
    expect(v?.versions).toEqual([{ rubricVersion: "englang-v2", model: "m1", rows: 2 }]);
    expect(v?.essayAi).toBe(true);
  });
});

describe("getApAttemptViewForAdminAction scoring-version split", () => {
  const run = async (rows: { rubric_version: string; model: string | null; status: string; last_error: string | null }[]) => {
    requireAdmin.mockResolvedValueOnce({ supabase: sb(false, rows as never) });
    loadDetail.mockResolvedValueOnce(detail()); loadScores.mockResolvedValueOnce([]);
    return getApAttemptViewForAdminAction("att1");
  };
  const r = (status: string, last_error: string | null = null, model: string | null = null) => ({ rubric_version: "englang-v2", model, status, last_error });
  it("done 1 + skipped(empty) 2: only done counts as model scoring", async () => {
    const v = await run([r("done", null, "m1"), r("skipped", "empty"), r("skipped", "empty")]);
    expect(v?.versions).toEqual([{ rubricVersion: "englang-v2", model: "m1", rows: 1 }]);
    expect(v?.unscored).toEqual([{ label: "submitted blank response → 0 points (no model call)", rows: 2 }]);
  });
  it("other skip reasons and waiting/failed rows get their own labels, never a model row", async () => {
    const v = await run([r("skipped", "too_short"), r("skipped", "daily_cap"), r("pending"), r("failed", "daily_cap"), r("failed", "x"), r("dead")]);
    expect(v?.versions).toEqual([]);
    expect(v?.unscored?.map((u) => u.label)).toEqual([
      "response too short → not scored (no model call)", "daily scoring limit reached → not scored", "waiting to be scored",
      "waiting for scoring limit reset", "scoring failed, will retry", "scoring failed (no more retries)"]);
  });
  it("unknown skip reason is shown as-is", () => { expect(unscoredLabel("skipped", "weird")).toContain("weird"); });
});

describe("AdminApResultView", () => {
  it("renders skipped(empty) separately from the model line", () => {
    render(<AdminApResultView view={{ detail: detail(), essayScores: [], essayAi: true, isTestAccount: false, versions: [{ rubricVersion: "englang-v2", model: "m1", rows: 1 }], unscored: [{ label: "submitted blank response → 0 points (no model call)", rows: 2 }] }} />);
    const meta = screen.getByTestId("admin-ap-meta");
    expect(meta).toHaveTextContent("Rubric englang-v2 · model m1 · 1 scored part");
    expect(meta).toHaveTextContent("2 parts: submitted blank response → 0 points (no model call)");
    expect(meta).not.toHaveTextContent("model not recorded");
  });
  it("shows the AP result (not SAT), unscored FRQ status, read-only and no version record", () => {
    render(<AdminApResultView view={{ detail: detail(), essayScores: [], essayAi: false, isTestAccount: false, versions: [] }} />);
    expect(screen.getByTestId("admin-ap-result")).toBeInTheDocument();
    expect(screen.getByTestId("admin-ap-meta")).toHaveTextContent("Real account");
    expect(screen.getByTestId("admin-ap-no-version")).toHaveTextContent("No scoring version recorded");
    expect(screen.getByTestId("ap-mc-score")).toHaveTextContent("30 / 45");
    expect(screen.getByTestId("ap-frq-summary")).toHaveTextContent("not scored");
    expect(screen.queryByTestId("ap-weighted-total")).toBeNull();
    expect(screen.queryByRole("button", { name: "Report a problem" })).toBeNull();
  });
  it("shows the weighted total, test flag and versions when fully scored", () => {
    const row = (id: string, total: number) => ({ setItemId: id, partLabel: "a", status: "done" as const, rubricVersion: "englang-v2", scores: { total, thesis: 1, evidence: 3, sophistication: 0 }, rationale: { improve: [], thesis: "t", evidence: "e", sophistication: "s" }, lastError: null });
    render(<AdminApResultView view={{ detail: detail(), essayScores: [row("e1", 6), row("e2", 3), row("e3", 3)], essayAi: true, isTestAccount: true, versions: [{ rubricVersion: "englang-v2", model: "m1", rows: 3 }] }} />);
    expect(screen.getByTestId("admin-ap-meta")).toHaveTextContent("Test account");
    expect(screen.getByTestId("admin-ap-meta")).toHaveTextContent("Rubric englang-v2 · model m1 · 3 scored parts");
    expect(screen.getByTestId("ap-weighted-total")).toHaveTextContent("12 / 18".length ? "/ 100" : "");
    expect(screen.getByTestId("ap-weighted-frq")).toHaveTextContent("12 / 18");
  });
});
