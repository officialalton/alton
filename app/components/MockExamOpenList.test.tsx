import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MockExamOpenList from "./MockExamOpenList";
import { buildMockExamListRows } from "@/lib/mock-exam/open-list";
import type { MockExamAttemptSummary, MockExamCatalogRow } from "@/lib/mock-exam/attempt-data";

const cat: MockExamCatalogRow = { examSetId: "s1", setGroupId: "g1", name: "SAT Practice Test 1", description: null, difficultyTier: "standard", format: "mst", publishedAt: null, attemptId: "a2", attemptStatus: "graded" };
const att = (id: string, no: number, status: MockExamAttemptSummary["status"], correct: number | null): MockExamAttemptSummary => ({
  id, examSetId: "s1", examSetName: "SAT Practice Test 1", difficultyTier: "standard", studentId: "u", studentName: null, status, assignedByName: null, dueAt: null, startBy: null,
  startedAt: null, submittedAt: null, gradedAt: null, totalCount: 98, correctCount: correct, entryCount: 0, attemptNo: no, attemptTotal: 2, setGroupId: "g1",
});

describe("MockExamOpenList — 재응시", () => {
  const rows = buildMockExamListRows([cat], [att("a1", 1, "graded", 50), att("a2", 2, "graded", 70)]);

  it("최신 회차 점수를 기본으로 보이고 Retake 가 시작을 호출한다", () => {
    const onStart = vi.fn();
    render(<MockExamOpenList rows={rows} readOnly={false} onStart={onStart} onOpenResult={vi.fn()} />);
    expect(screen.getByText(/Attempt 2 · Completed · 70\/98 correct/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retake" }));
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ examSetId: "s1" }));
  });

  it("All attempts 에 회차별 결과 보기가 있고 각각 해당 응시 id 를 연다", () => {
    const onOpen = vi.fn();
    render(<MockExamOpenList rows={rows} readOnly={false} onStart={vi.fn()} onOpenResult={onOpen} />);
    const list = screen.getAllByTestId("attempt-row");
    expect(list).toHaveLength(2);
    fireEvent.click(within(list[1]).getByRole("button", { name: "View results" }));
    expect(onOpen).toHaveBeenCalledWith("a1");
  });

  it("보호자(읽기 전용)는 Retake·Continue 가 없고 회차별 결과 링크만 본다", () => {
    render(<MockExamOpenList rows={rows} readOnly resultHref={(id) => `/parent/x/${id}`} />);
    expect(screen.queryByRole("button", { name: "Retake" })).toBeNull();
    expect(screen.getAllByRole("link", { name: "View results" }).map((l) => l.getAttribute("href"))).toEqual(["/parent/x/a2", "/parent/x/a1"]);
  });

  it("진행 중인 재응시는 Continue Attempt 2 로 이어간다", () => {
    const r = buildMockExamListRows([{ ...cat, attemptId: "a2", attemptStatus: "in_progress" }], [att("a1", 1, "graded", 50), att("a2", 2, "in_progress", null)]);
    render(<MockExamOpenList rows={r} readOnly={false} onStart={vi.fn()} onOpenResult={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Continue Attempt 2" })).toHaveAttribute("href", "/student/mock-exam/a2");
  });
});

import { AP_LAYOUTS } from "@/lib/ap-exam/layouts";
describe("MockExamOpenList — AB 부분 연습 세트 제목·배지·안내", () => {
  const ap = (id: string, name: string, label: "mc_practice" | "frq_practice", keys: string[]): MockExamCatalogRow => ({
    examSetId: id, setGroupId: `g-${id}`, name, description: null, difficultyTier: "standard", format: "ap_fixed" as never, publishedAt: null, attemptId: null, attemptStatus: null,
    examProgram: "ap", apSubject: "ap_calculus_ab", apLabel: label, apSections: AP_LAYOUTS.ap_calculus_ab.filter((x) => keys.includes(x.key)),
  });
  const rows = buildMockExamListRows([
    ap("n", "AP Calculus AB — Non-Calculator Practice", "mc_practice", ["ap_mc_a"]),
    ap("c", "AP Calculus AB — Calculator Practice", "mc_practice", ["ap_mc_b"]),
    ap("f", "AP Calculus AB — Free-Response Practice", "frq_practice", ["ap_frq_a", "ap_frq_b"]),
  ], []);
  it("제목 그대로, 배지는 파트 배지, 시작 전 안내에 파트·계산기·문항 수·시간이 있다", () => {
    render(<MockExamOpenList rows={rows} readOnly={false} onStart={vi.fn()} onOpenResult={vi.fn()} />);
    for (const t of ["AP Calculus AB — Non-Calculator Practice", "AP Calculus AB — Calculator Practice", "AP Calculus AB — Free-Response Practice"]) expect(screen.getByText(t)).toBeInTheDocument();
    expect(screen.getAllByTestId("ap-label").map((e) => e.textContent).sort()).toEqual(["Calculator Practice", "Free-Response Practice", "Non-Calculator Practice"]);
    const g = screen.getAllByTestId("ap-guidance").map((e) => e.textContent).join("\n");
    expect(g).toContain("Section I, Part A: 29 multiple-choice questions in 62 minutes. No calculator is allowed.");
    expect(g).toContain("Section I, Part B: 13 multiple-choice questions in 38 minutes. A graphing calculator is required.");
    expect(g).toContain("Part A (2 questions, 30 min): calculator allowed. Part B (4 questions, 60 min): no calculator.");
    expect(screen.queryByText("Full Practice Exam")).toBeNull();
    expect(screen.queryByText("AP Multiple-Choice Practice")).toBeNull();
  });
});
