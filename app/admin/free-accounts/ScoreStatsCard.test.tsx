// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ScoreStatsCard from "./ScoreStatsCard";
import type { AttemptFacts } from "@/lib/mock-exam/score-aggregate";

vi.mock("@/lib/mock-exam/score-estimate", async (orig) => ({ ...(await orig<typeof import("@/lib/mock-exam/score-estimate")>()) }));

const sec = (total: number, correct: number | null) => ({ total, correct, complete: correct !== null, route: "higher" as const, answered: total });
const f = (id: string, over: Partial<AttemptFacts> = {}): AttemptFacts => ({
  attemptId: id, examName: "S", track: "sat", apSubject: null, format: "mst", status: "graded", startedAt: null,
  gradedAt: `2026-10-0${id}T00:00:00Z`, attemptSeq: 1, sections: { rw: sec(54, 40), math: sec(44, 30) }, ...over,
});

describe("ScoreStatsCard", () => {
  it("응시가 없으면 빈 상태·AP 빈 상태·고지 문구", () => {
    render(<ScoreStatsCard facts={[]} />);
    expect(screen.getByText("No scored attempts yet")).toBeTruthy();
    expect(screen.getByText("No AP tests available yet")).toBeTruthy();
    expect(screen.getByText(/not an official SAT/)).toBeTruthy();
  });
  it("표본 수·최고·평균 표시와 지표 전환, 고정형은 제외 안내", () => {
    render(<ScoreStatsCard facts={[f("1"), f("2"), f("3", { format: "fixed" })]} />);
    expect(screen.getByText("avg of 2 attempts")).toBeTruthy();
    expect(screen.getByText(/1 fixed-format attempt has no score estimate/)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Math" }));
    expect(screen.getByText("Attempts counted").nextSibling?.textContent).toBe("2");
  });
});
