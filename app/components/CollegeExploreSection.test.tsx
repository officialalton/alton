import { describe, it, expect } from "vitest";
import { pickForYear } from "./CollegeExploreSection";

// College Explore UI 개편(2026-09-23) — 상세 화면 전체가 공유하는 단일 "지원 연도"
// 선택 로직. 선택 연도에 데이터가 없으면 더 가까운 연도로 대체하고, 어떤 연도가
// 실제로 쓰였는지(effectiveYear)를 반환해 화면이 "통계 기준 연도"를 명시할 수 있게 한다.
describe("pickForYear", () => {
  type Row = { year: number; label: string };
  const getYear = (r: Row) => r.year;

  it("데이터가 없으면 null을 반환한다", () => {
    expect(pickForYear<Row>([], getYear, 2027)).toBeNull();
  });

  it("선택 연도에 정확히 일치하는 데이터가 있으면 그대로 반환한다", () => {
    const rows: Row[] = [
      { year: 2027, label: "a" },
      { year: 2026, label: "b" },
    ];
    const result = pickForYear(rows, getYear, 2027);
    expect(result?.year).toBe(2027);
    expect(result?.items).toEqual([{ year: 2027, label: "a" }]);
  });

  it("선택 연도 데이터가 없으면 그보다 이전인 가장 최근 연도로 대체한다", () => {
    const rows: Row[] = [
      { year: 2025, label: "old" },
      { year: 2024, label: "older" },
    ];
    const result = pickForYear(rows, getYear, 2027);
    expect(result?.year).toBe(2025);
    expect(result?.items).toEqual([{ year: 2025, label: "old" }]);
  });

  it("선택 연도보다 이전 데이터가 전혀 없으면 가장 이른 미래 연도로 대체한다", () => {
    const rows: Row[] = [{ year: 2030, label: "future" }];
    const result = pickForYear(rows, getYear, 2020);
    expect(result?.year).toBe(2030);
  });

  it("다른 연도의 값을 같은 연도인 것처럼 섞지 않는다(한 연도의 항목만 반환)", () => {
    const rows: Row[] = [
      { year: 2027, label: "a1" },
      { year: 2027, label: "a2" },
      { year: 2026, label: "b1" },
    ];
    const result = pickForYear(rows, getYear, 2027);
    expect(result?.items.every((r) => r.year === 2027)).toBe(true);
    expect(result?.items).toHaveLength(2);
  });
});
