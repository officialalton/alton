import { describe, expect, it } from "vitest";
import { countWords, effectiveRange, judgeWordCount } from "./passage-words";

const text = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

describe("지문 단어 수 강제", () => {
  it("규격 60~220 경계: 59·221 은 범위 밖, 60·220 은 통과", () => {
    const r = effectiveRange();
    expect(r).toEqual({ min: 60, max: 220 });
    expect(judgeWordCount(text(59), r, 1).action).toBe("reject");
    expect(judgeWordCount(text(221), r, 1).action).toBe("reject");
    expect(judgeWordCount(text(60), r).action).toBe("ok");
    expect(judgeWordCount(text(220), r).action).toBe("ok");
  });
  it("레시피 범위는 규격 안으로 좁혀지고, 규격 밖 값은 잘린다", () => {
    expect(effectiveRange({ min: 110, max: 170 })).toEqual({ min: 110, max: 170 });
    expect(effectiveRange({ min: 10, max: 400 })).toEqual({ min: 60, max: 220 });
    expect(() => effectiveRange({ min: 300, max: 400 })).toThrow();
  });
  it("첫 시도에서 벗어나면 재요청 지시(실제 단어 수 포함), 재요청 뒤에도 벗어나면 탈락", () => {
    const r = { min: 110, max: 170 };
    const v = judgeWordCount(text(230), r, 0);
    expect(v.action).toBe("retry");
    if (v.action === "retry") { expect(v.instruction).toContain("230"); expect(v.instruction).toContain("110~170"); }
    expect(judgeWordCount(text(230), r, 1).action).toBe("reject");
    expect(judgeWordCount(text(90), r, 0).action).toBe("retry");
  });
  it("<u> 태그와 시의 줄바꿈은 단어 수에 영향 없음", () => {
    expect(countWords("a <u>b c</u>\nd")).toBe(4);
  });
});
