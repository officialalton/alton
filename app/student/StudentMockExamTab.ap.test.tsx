import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/mock-exam/attempt-actions", () => ({ startMockExamAction: vi.fn() }));
vi.mock("./mock-exam-tab-actions", () => ({ loadMyMockExamOverviewAction: vi.fn(), loadMockExamAttemptDetailAction: vi.fn() }));
vi.mock("./mock-exam/[attemptId]/MockExamResultView", () => ({ default: () => <div>SAT result</div> }));
vi.mock("./mock-exam/[attemptId]/ApExamResultView", () => ({ default: () => <div>AP result</div> }));

import StudentMockExamTab from "./StudentMockExamTab";
import { buildMockExamListRows, pickNextPracticeTest } from "@/lib/mock-exam/open-list";
import type { MockExamOverview } from "@/lib/mock-exam/attempt-data";
import { AP_LAYOUTS } from "@/lib/ap-exam/layouts";

const overview: MockExamOverview = {
  catalog: [
    { examSetId: "sat1", setGroupId: "g1", name: "SAT Practice Test 1", description: null, difficultyTier: "standard", format: "fixed", publishedAt: null, attemptId: null, attemptStatus: null },
    { examSetId: "ap1", setGroupId: "g2", name: "AP Calculus AB Full Practice 1", description: null, difficultyTier: "standard", format: "ap_fixed" as never, publishedAt: null, attemptId: null, attemptStatus: null, examProgram: "ap", apSubject: "ap_calculus_ab", apLabel: "full_practice", apSections: AP_LAYOUTS.ap_calculus_ab },
    { examSetId: "ap2", setGroupId: "g3", name: "AP Biology MC Practice 1", description: null, difficultyTier: "standard", format: "ap_fixed" as never, publishedAt: null, attemptId: null, attemptStatus: null, examProgram: "ap", apSubject: "ap_biology", apLabel: "mc_practice", apSections: AP_LAYOUTS.ap_biology.filter((x) => x.kind === "mc") },
  ],
  attempts: [],
};

afterEach(cleanup);
describe("Practice Tests: SAT / AP 분리", () => {
  it("기본은 SAT 목록, AP 전환 시 AP 세트만 과목·라벨 배지와 함께 보인다", () => {
    render(<StudentMockExamTab initialOverview={overview} />);
    expect(screen.getByText("SAT Practice Test 1")).toBeInTheDocument();
    expect(screen.queryByText("AP Calculus AB Full Practice 1")).toBeNull();
    fireEvent.click(screen.getByTestId("program-ap"));
    expect(screen.queryByText("SAT Practice Test 1")).toBeNull();
    expect(screen.getByText("AP Calculus AB Full Practice 1")).toBeInTheDocument();
    const labels = screen.getAllByTestId("ap-label").map((e) => e.textContent);
    expect([...labels].sort()).toEqual(["AP Multiple-Choice Practice", "Full Practice Exam"]);
  });
  it("AP 세트가 없으면 전환 UI 가 없다(기존 SAT 화면 그대로)", () => {
    render(<StudentMockExamTab initialOverview={{ catalog: [overview.catalog[0]], attempts: [] }} />);
    expect(screen.queryByTestId("program-ap")).toBeNull();
  });
  it("홈 'Next Practice Test' 는 AP 세트를 고르지 않는다", () => {
    const rows = buildMockExamListRows([overview.catalog[1], overview.catalog[0]], []);
    expect(pickNextPracticeTest(rows)?.examSetId).toBe("sat1");
    expect(pickNextPracticeTest(buildMockExamListRows([overview.catalog[1]], []))).toBeNull();
  });
});
