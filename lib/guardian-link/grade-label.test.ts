import { describe, expect, it } from "vitest";
import { formatGradeLabel, plainName } from "./grade-label";

describe("formatGradeLabel", () => {
  it.each([["11th grade", "Grade 11"], ["11", "Grade 11"], ["Grade 11", "Grade 11"], ["11학년", "Grade 11"], ["9th Grade", "Grade 9"], ["Freshman", "Freshman"]])("%s -> %s", (i, o) => {
    expect(formatGradeLabel(i)).toBe(o);
  });
  it("빈 값은 null", () => {
    expect(formatGradeLabel("")).toBeNull();
    expect(formatGradeLabel(null)).toBeNull();
  });
});
describe("plainName", () => {
  it("마크다운 기호 제거", () => expect(plainName("*UAT*")).toBe("UAT"));
});
