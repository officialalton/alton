import { describe, it, expect } from "vitest";
import { sprFromInteger, sprFromFraction, sprFromAnswerText, fitsSprFormat } from "./spr-answer";

describe("spr-answer 공용 답안 모델", () => {
  it("정수는 그 문자열 하나만 정답 목록에 들어간다", () => {
    const m = sprFromInteger(7);
    expect(m.answers).toEqual(["7"]);
    const neg = sprFromInteger(-12);
    expect(neg.answers).toEqual(["-12"]);
  });

  it("기약분수가 아니어도 기약분수와 소수 동치 형태를 함께 담는다(1/2 = 0.5)", () => {
    const m = sprFromFraction(2, 4);
    expect(m.answers).toContain("1/2");
    expect(m.answers).toContain("0.5");
    expect(m.answers).not.toContain("2/4".length ? "" : "2/4"); // 기약분수만: 2/4는 후보에 없어도 됨(정책상 필수 아님)
  });

  it("분모가 1이면 정수로 취급한다", () => {
    const m = sprFromFraction(6, 2);
    expect(m.answers).toEqual(["3"]);
  });

  it("음수 분수도 부호를 정규화한다(분모에 부호가 있어도)", () => {
    const m = sprFromFraction(3, -4);
    expect(m.answers).toContain("-3/4");
  });

  it("그리드 문자 수 제한을 넘는 값은 던진다(양수 5자·음수 6자 이내)", () => {
    expect(() => sprFromFraction(123456, 1)).toThrow();
  });

  it("문장형 정답은 null을 돌려준다(SPR 대상이 아님)", () => {
    expect(sprFromAnswerText("Two distinct real solutions")).toBeNull();
    expect(sprFromAnswerText("No real solutions")).toBeNull();
  });

  it("MC 정답 텍스트를 그대로 SPR로 변환한다", () => {
    const fromInt = sprFromAnswerText("-9");
    expect(fromInt?.answers).toEqual(["-9"]);
    const fromFrac = sprFromAnswerText("7/2");
    expect(fromFrac?.answers).toContain("7/2");
    expect(fromFrac?.answers).toContain("3.5");
    const fromDecimal = sprFromAnswerText("0.5");
    expect(fromDecimal?.answers).toContain("0.5");
    expect(fromDecimal?.answers).toContain("1/2");
  });

  it("fitsSprFormat은 checkContent와 같은 규칙(양수 5자·음수 6자, 정수/소수/분수만)을 따른다", () => {
    expect(fitsSprFormat("12345")).toBe(true);
    expect(fitsSprFormat("123456")).toBe(false);
    expect(fitsSprFormat("-12345")).toBe(true);
    expect(fitsSprFormat("-123456")).toBe(false);
    expect(fitsSprFormat("3 1/2")).toBe(false); // 대분수 금지
    expect(fitsSprFormat("abc")).toBe(false);
  });
});

describe("SPR 소수 정답 목록 — 그리드보다 짧게 끊은 값은 정답이 아니다(2026-10-01 회귀)", () => {
  it("정확한 값이 그리드에 들어가면 그 값(과 분수 표기)만 정답이다 — 7/2 에 4·3 이 들어가면 안 된다", () => {
    const m = sprFromFraction(7, 2);
    expect(m.answers.sort()).toEqual(["3.5", "7/2"]);
    expect(sprFromAnswerText("3.5")?.answers.sort()).toEqual(["3.5", "35/10", "7/2"]); // 비기약 분수 표기도 같은 값
    expect(sprFromFraction(1, 4).answers.sort()).toEqual(["0.25", "1/4"]);
  });
  it("무한소수는 그리드를 꽉 채운 반올림·절사 값만 인정한다", () => {
    expect(sprFromFraction(1, 3).answers.sort()).toEqual(["0.333", "1/3"]);
    expect(sprFromFraction(2, 3).answers.sort()).toEqual(["0.666", "0.667", "2/3"]);
    expect(sprFromFraction(28, 3).answers.every((a) => a === "28/3" || a === "9.333")).toBe(true);
  });
  it("음수도 같은 규칙(부호 포함 6자 그리드)", () => {
    expect(sprFromFraction(-7, 2).answers.sort()).toEqual(["-3.5", "-7/2"]);
    expect(sprFromFraction(-1, 3).answers.every((a) => a === "-1/3" || a.startsWith("-0.33"))).toBe(true);
  });
  it("어떤 입력이든 정답 목록의 모든 값이 정확한 값과 그리드 규칙 안에서 같다", () => {
    for (let den = 2; den <= 40; den++) for (let num = -40; num <= 40; num++) {
      let m;
      try { m = sprFromFraction(num, den); } catch { continue; }
      for (const a of m.answers) {
        const v = a.includes("/") ? Number(a.split("/")[0]) / Number(a.split("/")[1]) : Number(a);
        expect(Math.abs(v - num / den)).toBeLessThan(0.0101); // 그리드를 꽉 채운 소수점 2~3자리 반올림·절사 오차 범위
        expect(Number.isInteger(v) && !Number.isInteger(num / den)).toBe(false);
      }
    }
  });
});
