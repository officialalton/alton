import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pool = vi.fn();
const apSubjects = vi.fn(async () => [] as { subject: string; stock: number; converted: number }[]);
const apPool = vi.fn();
vi.mock("../mock-exam-actions", () => ({
  getMockExamPoolSummaryAction: () => pool(),
  listMockExamApPoolSubjectsAction: () => apSubjects(),
  getMockExamApPoolAction: (s: string) => apPool(s),
  assembleMockExamSet: vi.fn(), archiveMockExamSetAction: vi.fn(), getMockExamSetContentAction: vi.fn(),
  getMockExamSetItems: vi.fn(), listMockExamSets: vi.fn(async () => []), publishMockExamSet: vi.fn(),
  listAllMockExamAttemptsAction: vi.fn(async () => []),
}));

import MockExamSetsPanel from "./MockExamSetsPanel";

const row = (o: object) => ({ satDomain: "algebra", skillCode: null, mockExam: 0, both: 0, general: 0, assignedPublished: 0, assignedDraft: 0, ...o });

describe("MockExamSetsPanel 문항 풀 탭", () => {
  beforeEach(() => { pool.mockReset(); apPool.mockReset(); apSubjects.mockReset(); apSubjects.mockResolvedValue([]); });
  afterEach(cleanup);

  it("생성 탭에는 풀 블록이 없고, 문항 풀 서브탭이 생성 다음에 있다", () => {
    render(<MockExamSetsPanel initialSets={[]} />);
    const tabs = screen.getAllByRole("button").map((b) => b.textContent);
    expect(tabs.slice(0, 2)).toEqual(["생성", "문항 풀"]);
    expect(screen.queryByTestId("mock-pool-summary")).toBeNull();
    expect(pool).not.toHaveBeenCalled();
  });

  it("배정·남음 열과 합계 행을 보여준다", async () => {
    pool.mockResolvedValue([
      row({ skillCode: "linear_equations_one_var", mockExam: 10, both: 2, assignedPublished: 5, assignedDraft: 3, general: 4 }),
      row({ satDomain: "geometry_trig", skillCode: "circles", mockExam: 6, assignedPublished: 6 }),
    ]);
    render(<MockExamSetsPanel initialSets={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "문항 풀" }));
    await waitFor(() => expect(screen.getByTestId("mock-pool-header")).toBeTruthy());
    expect(screen.getByTestId("mock-pool-header").textContent).toBe("풀 18 · 배정 14 · 남음 4 · 일반용(제외) 4");
    const total = within(screen.getByTestId("mock-pool-total")).getAllByRole("cell").map((c) => c.textContent);
    expect(total).toEqual(["합계", "18", "11", "3", "4", "4"]);
    expect(screen.getByText("(기존 2)")).toBeTruthy();
  });

  it("빈 상태", async () => {
    pool.mockResolvedValue([]);
    render(<MockExamSetsPanel initialSets={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "문항 풀" }));
    await waitFor(() => expect(screen.getByText("공개된 문항이 없습니다.")).toBeTruthy());
  });
});

const apData = {
  subject: "ap_calculus_ab",
  topics: [{ unit: "5", keyword_code: "5.3", kind: "mc", topic_label: "Candidates Test", stock: 8, candidate: 3, mock_exam: 4, lesson: 1, review_env: 4, launch: 0, assigned_published: 1, assigned_draft: 1 }],
  bySkill: [{ key: "1", stock: 8, mock_exam: 4, lesson: 1 }],
  byStructure: [{ key: "standalone", stock: 8, mock_exam: 4, lesson: 1 }],
  byCalculator: [{ key: "required", stock: 2, mock_exam: 1, lesson: 0 }],
  purposes: [{ kind: "mc", purpose: "mock_exam", target: 10, converted: 4, inReviewEnv: 4, launched: 0, shortfall: 6, unallocatedReady: 2 }],
  shortfalls: [{ dimension: "unit", kind: "mc", unitCode: "5", skillCategory: null, keywordCode: null, calculatorUse: null, representation: null, target: 6, achieved: 4, shortfall: 2 }],
  totals: { stock: 8, mockExam: 4, lesson: 1, assignedPublished: 1, assignedDraft: 1 },
};

describe("문항 풀 — 과목 전환기", () => {
  beforeEach(() => { pool.mockReset(); apPool.mockReset(); apSubjects.mockReset(); });
  afterEach(cleanup);

  it("기본은 SAT 이고 AP 과목 버튼은 재고가 있는 과목만 나온다(AP 데이터는 선택 전 불러오지 않음)", async () => {
    pool.mockResolvedValue([row({ skillCode: "circles", mockExam: 2 })]);
    apSubjects.mockResolvedValue([{ subject: "ap_calculus_ab", stock: 8, converted: 4 }, { subject: "ap_biology", stock: 3, converted: 0 }]);
    render(<MockExamSetsPanel initialSets={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "문항 풀" }));
    await waitFor(() => expect(screen.getByTestId("mock-pool-header")).toBeTruthy());
    const names = within(screen.getByTestId("pool-program-switcher")).getAllByRole("button").map((b) => b.textContent);
    await waitFor(() => expect(within(screen.getByTestId("pool-program-switcher")).getAllByRole("button").map((b) => b.textContent)).toEqual(["SAT", "AP Calculus AB", "AP Biology"]));
    expect(names[0]).toBe("SAT");
    expect(apPool).not.toHaveBeenCalled();
  });

  it("AP 과목을 고르면 그 과목 풀(단원·토픽·스킬·구조·계산기·용도)을 RPC 한 번으로 보여주고 SAT 표는 숨긴다", async () => {
    pool.mockResolvedValue([row({ skillCode: "circles", mockExam: 2 })]);
    apSubjects.mockResolvedValue([{ subject: "ap_calculus_ab", stock: 8, converted: 4 }]);
    apPool.mockResolvedValue(apData);
    render(<MockExamSetsPanel initialSets={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "문항 풀" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "AP Calculus AB" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "AP Calculus AB" }));
    await waitFor(() => expect(screen.getByTestId("ap-pool-header")).toBeTruthy());
    expect(apPool).toHaveBeenCalledTimes(1);
    expect(apPool).toHaveBeenCalledWith("ap_calculus_ab");
    expect(screen.getByTestId("ap-pool-header").textContent).toBe("AP Calculus AB · 재고 8 · 모의고사용 4 · 수업·과제용 1 · 배정 2 · 남음 2");
    expect(screen.getByTestId("ap-pool-topics").textContent).toContain("5.3 · Candidates Test");
    expect(screen.getByTestId("ap-pool-breakdown").textContent).toContain("그래핑 계산기 필수");
    expect(screen.getByTestId("ap-pool-purposes").textContent).toContain("모의고사용");
    expect(screen.getByTestId("ap-pool-shortfalls").textContent).toContain("4/6");
    expect(screen.queryByTestId("mock-pool-summary")).toBeNull();
    // SAT 로 돌아가면 기존 표
    fireEvent.click(screen.getByRole("button", { name: "SAT" }));
    await waitFor(() => expect(screen.getByTestId("mock-pool-summary")).toBeTruthy());
  });

  it("AP 풀 불러오기 실패를 표시한다", async () => {
    apSubjects.mockResolvedValue([{ subject: "ap_biology", stock: 3, converted: 0 }]);
    apPool.mockRejectedValue(new Error("x"));
    pool.mockResolvedValue([]);
    render(<MockExamSetsPanel initialSets={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "문항 풀" }));
    await waitFor(() => screen.getByRole("button", { name: "AP Biology" }));
    fireEvent.click(screen.getByRole("button", { name: "AP Biology" }));
    await waitFor(() => expect(screen.getByText("AP 문항 풀 현황을 불러오지 못했습니다.")).toBeTruthy());
  });
});

const baseSet = { setGroupId: "g", versionNo: 1, difficultyTier: "standard" as const, format: "fixed" as const, readinessStatus: "not_applicable" as const, readinessReport: null, rwCount: 0, mathCount: 0, createdAt: "2026-10-01T00:00:00Z", publishedAt: null, accessTier: "tutoring" as const };
const layoutA = { sections: [{ key: "ap_mc_a", kind: "mc" as const, label: "Section I, Part A: Multiple Choice (no calculator)", minutes: 62, count: 29, calculator: "not_allowed" }] };

describe("세트 목록 — AP 인식", () => {
  afterEach(cleanup);
  const sets = [
    { ...baseSet, id: "s1", setGroupId: "g1", name: "SAT Practice Test 1", status: "published" as const, rwCount: 54, mathCount: 44, createdAt: "2026-10-02T00:00:00Z" },
    { ...baseSet, id: "s2", setGroupId: "g1", name: "SAT Practice Test 1", versionNo: 2, status: "published" as const, rwCount: 54, mathCount: 44, createdAt: "2026-10-03T00:00:00Z" },
    { ...baseSet, id: "s3", setGroupId: "g2", name: "Test Set 1", status: "draft" as const },
    { ...baseSet, id: "s4", setGroupId: "g3", name: "AP Calculus AB — Non-Calculator Practice", status: "draft" as const, examProgram: "ap" as const, apSubject: "ap_calculus_ab", apLabel: "mc_practice" as const, sectionLayout: layoutA, itemTotal: 12, sectionCounts: { ap_mc_a: 12 }, format: "ap_fixed" as never },
  ];
  it("AP 행은 R&W/Math 0 대신 AP 라벨·섹션 구성·문항 수를 보이고 SAT 행은 그대로다", () => {
    render(<MockExamSetsPanel initialSets={sets} />);
    const rows = screen.getAllByTestId("set-row");
    expect(rows).toHaveLength(4);
    const ap = rows.find((r) => r.textContent?.includes("Non-Calculator Practice") && r.getAttribute("data-status") === "draft" && r.textContent?.includes("AP Calculus AB ·"))!;
    expect(within(ap).getByTestId("ap-set-label").textContent).toBe("AP Calculus AB · Non-Calculator Practice");
    expect(within(ap).getByTestId("ap-set-structure").textContent).toContain("문항 12/29");
    expect(within(ap).getByTestId("ap-set-structure").textContent).toContain("62분 · 계산기 불가");
    const sat = rows.find((r) => r.textContent?.includes("v2"))!;
    expect(sat.textContent).toContain("5444");
    expect(sat.textContent).toContain("v2 · 최신");
    expect(rows.find((r) => r.textContent?.includes("v1 · 이전"))).toBeTruthy();
  });
  it("프로그램 필터와 초안 구분·정렬", () => {
    render(<MockExamSetsPanel initialSets={sets} />);
    fireEvent.click(within(screen.getByTestId("set-program-filter")).getByRole("button", { name: /AP Calculus AB/ }));
    expect(screen.getAllByTestId("set-row")).toHaveLength(1);
    fireEvent.click(within(screen.getByTestId("set-program-filter")).getByRole("button", { name: /^전체/ }));
    fireEvent.change(screen.getByLabelText("정렬"), { target: { value: "status" } });
    const satRows = within(screen.getByTestId("set-list")).getAllByTestId("set-row").filter((r) => !r.textContent?.includes("Non-Calculator"));
    expect(satRows.map((r) => r.getAttribute("data-status"))).toEqual(["published", "published", "draft"]);
    expect(satRows[2].className).toContain("text-grey-500");
  });
});
