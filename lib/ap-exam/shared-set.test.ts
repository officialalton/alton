import { describe, expect, it } from "vitest";
import { sharedSetHeading, sharedSetRange } from "./shared-set";

const p = (t: string | null) => ({ passage: t });
describe("sharedSetRange", () => {
  const items = [p(null), p("X"), p(" X  "), p("X"), p("Y"), p("Z"), p("Z")];
  it("같은 자료가 연속한 문항을 묶고 표시 번호는 1-based", () => {
    expect(sharedSetRange(items, 2)).toEqual({ start: 2, end: 4, key: "2-4" });
    expect(sharedSetRange(items, 1)?.key).toBe("2-4");
    expect(sharedSetRange(items, 6)).toEqual({ start: 6, end: 7, key: "6-7" });
  });
  it("단독 자료·빈 자료는 세트가 아니다", () => {
    expect(sharedSetRange(items, 0)).toBeNull();
    expect(sharedSetRange(items, 4)).toBeNull();
  });
  it("머리말 문구", () => { expect(sharedSetHeading({ start: 13, end: 15, key: "13-15" })).toBe("Questions 13–15 refer to the following information."); });
});
