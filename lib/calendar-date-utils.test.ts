import { describe, expect, it } from "vitest";
import { dateKeyInTimezone, buildMonthGrid, buildWeekGrid } from "./calendar-date-utils";

describe("dateKeyInTimezone", () => {
  it("UTC 자정 근처 시각도 timezone 기준으로 올바른 날짜를 반환한다(America/Los_Angeles, 전날로 넘어가는 경우)", () => {
    expect(dateKeyInTimezone("2026-10-02T06:00:00.000Z", "America/Los_Angeles")).toBe("2026-10-01");
  });

  it("Asia/Seoul 기준으로는 같은 순간이 다음날일 수 있다", () => {
    expect(dateKeyInTimezone("2026-10-01T20:00:00.000Z", "Asia/Seoul")).toBe("2026-10-02");
  });
});

describe("buildMonthGrid", () => {
  it("42칸(6주)을 생성하고 일요일부터 시작한다", () => {
    const grid = buildMonthGrid(2026, 9); // 2026년 10월
    expect(grid).toHaveLength(42);
    expect(grid[0].dateKey <= "2026-10-01").toBe(true);
  });

  it("현재 월의 날짜에는 inCurrentMonth:true를 표시한다", () => {
    const grid = buildMonthGrid(2026, 9);
    const oct1 = grid.find((c) => c.dateKey === "2026-10-01");
    expect(oct1?.inCurrentMonth).toBe(true);
    const firstCell = grid[0];
    if (firstCell.dateKey !== "2026-10-01") {
      expect(firstCell.inCurrentMonth).toBe(false);
    }
  });

  it("이전/다음 달로 넘어가는 칸도 올바른 날짜 키를 만든다(연도 경계 포함)", () => {
    const grid = buildMonthGrid(2026, 0); // 2026년 1월 — 이전 달은 2025년 12월
    expect(grid[0].dateKey.startsWith("2025-12") || grid[0].dateKey.startsWith("2026-01")).toBe(true);
  });
});

describe("buildWeekGrid", () => {
  it("7칸을 생성하고 주어진 날짜가 포함된 주(일요일 시작)를 만든다", () => {
    const grid = buildWeekGrid("2026-10-07"); // 수요일
    expect(grid).toHaveLength(7);
    expect(grid.map((c) => c.dateKey)).toContain("2026-10-07");
    expect(grid[0].dateKey).toBe("2026-10-04"); // 일요일
  });
});

describe("dateKeysCoveredByInterval", () => {
  it("하루 안에 끝나는 구간은 날짜 키 1개를 반환한다", async () => {
    const { dateKeysCoveredByInterval } = await import("./calendar-date-utils");
    expect(dateKeysCoveredByInterval("2026-10-01T19:00:00Z", "2026-10-01T20:00:00Z", "America/Los_Angeles")).toEqual(["2026-10-01"]);
  });

  it("자정을 넘나드는 구간은 두 날짜를 모두 포함한다", async () => {
    const { dateKeysCoveredByInterval } = await import("./calendar-date-utils");
    const keys = dateKeysCoveredByInterval("2026-10-01T23:00:00Z", "2026-10-02T01:00:00Z", "America/Los_Angeles");
    expect(keys).toEqual(["2026-10-01"]);
  });
});
