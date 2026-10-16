import { describe, expect, it } from "vitest";
import { exactKey, findNearDuplicate, shingles } from "./dup-rule";
const sh = (s: string) => shingles(s);
describe("findNearDuplicate", () => {
  const stem = "A tutor charges a flat fee of 20 dollars plus 15 dollars per hour for lessons in total";
  const pool = [{ problemId: "p1", sh: sh(stem), group: "arch-A" }];
  it("다른 원형·그룹 없음이면 0.6 이상 유사 시 거절", () => {
    expect(findNearDuplicate(sh(stem.replace("20", "30")), "arch-B", pool)?.problemId).toBe("p1");
    expect(findNearDuplicate(sh(stem), null, pool)?.problemId).toBe("p1");
  });
  it("같은 원형 인스턴스는 근접 중복에서 제외", () => { expect(findNearDuplicate(sh(stem.replace("20", "30")), "arch-A", pool)).toBeUndefined(); });
  it("다르면 통과", () => { expect(findNearDuplicate(sh("Which of the following is equivalent to the expression shown below here"), "arch-B", pool)).toBeUndefined(); });
});
describe("exactKey", () => {
  it("값이 다르면 다른 문제, 공백만 다르면 같은 문제", () => {
    expect(exactKey("x 5", "q", ["a"])).not.toBe(exactKey("x 6", "q", ["a"]));
    expect(exactKey("x  5", "Q", ["a"])).toBe(exactKey("x 5", "q", ["a"]));
  });
});
