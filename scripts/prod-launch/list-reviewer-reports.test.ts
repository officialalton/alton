import { describe, expect, it } from "vitest";
import { COLUMNS, csvCell, toCsv } from "./list-reviewer-reports";

describe("list-reviewer-reports CSV", () => {
  it("쉼표·따옴표·줄바꿈을 안전하게 이스케이프한다", () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe("line1 line2");
    expect(csvCell(null)).toBe("");
    expect(csvCell(0)).toBe("0");
  });
  it("헤더와 행 순서가 컬럼 정의를 따른다", () => {
    const csv = toCsv([{ set_name: "SAT Practice Test 1", memo: "wrong, key" }], COLUMNS);
    const [head, row] = csv.trim().split("\n");
    expect(head.split(",")).toEqual(COLUMNS);
    expect(row).toContain('"wrong, key"');
  });
});
