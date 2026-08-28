import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StatsTab from "./StatsTab";
import type { StatsData } from "./stats-data";

describe("StatsTab", () => {
  it("데이터가 없으면 대시로 보여준다", () => {
    render(
      <StatsTab
        data={{ attendanceRate: null, satisfactionAvg: null, bySubject: [] }}
      />
    );
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.getByText("아직 집계할 수업 기록이 없습니다.")).toBeInTheDocument();
  });

  it("참여율/만족도/과목별 참여율을 보여준다", () => {
    const data: StatsData = {
      attendanceRate: 92,
      satisfactionAvg: 4.5,
      bySubject: [{ subjectName: "SAT Math", pct: 100 }],
    };
    render(<StatsTab data={data} />);
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText("4.5 / 5")).toBeInTheDocument();
    expect(screen.getByText("SAT Math")).toBeInTheDocument();
  });
});
