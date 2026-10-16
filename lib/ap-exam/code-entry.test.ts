import { describe, expect, it } from "vitest";
import { applyCodeKey, CODE_INDENT, CODE_FIELD_ATTRS } from "./code-entry";

const key = (value: string, selStart: number, selEnd: number, k: string, extra: { shiftKey?: boolean; escapeArmed?: boolean } = {}) => applyCodeKey({ value, selStart, selEnd, key: k, ...extra });

describe("applyCodeKey — 코드 답안 입력", () => {
  it("Tab 은 커서 위치에 공백 4칸", () => {
    expect(key("ab", 1, 1, "Tab")).toEqual({ value: "a" + CODE_INDENT + "b", selStart: 5, selEnd: 5 });
  });
  it("선택 영역이 있으면 그 글자를 공백으로 바꾼다(한 줄 안)", () => {
    expect(key("abcd", 1, 3, "Tab")).toEqual({ value: "a" + CODE_INDENT + "d", selStart: 5, selEnd: 5 });
  });
  it("여러 줄을 선택하고 Tab 이면 줄마다 들여쓰고 Shift+Tab 이면 내어쓴다", () => {
    const v = "a\nb\nc";
    const ind = key(v, 0, 5, "Tab")!;
    expect(ind.value).toBe(`${CODE_INDENT}a\n${CODE_INDENT}b\n${CODE_INDENT}c`);
    const back = key(ind.value, ind.selStart, ind.selEnd, "Tab", { shiftKey: true })!;
    expect(back.value).toBe(v);
  });
  it("Shift+Tab 은 한 줄에서도 앞 공백을 최대 4칸 지운다", () => {
    expect(key("      x", 6, 6, "Tab", { shiftKey: true })!.value).toBe("  x");
    expect(key("x", 0, 0, "Tab", { shiftKey: true })!.value).toBe("x");
  });
  it("Escape 뒤의 Tab 은 브라우저 기본(포커스 이동)에 맡긴다", () => {
    expect(key("ab", 1, 1, "Tab", { escapeArmed: true })).toBeNull();
  });
  it("Enter 는 이전 줄 들여쓰기를 이어 가고, `{` 로 끝나면 한 단계 더", () => {
    expect(key("    x = 1;", 10, 10, "Enter")).toEqual({ value: "    x = 1;\n    ", selStart: 15, selEnd: 15 });
    expect(key("for (;;) {", 10, 10, "Enter")).toEqual({ value: "for (;;) {\n" + CODE_INDENT, selStart: 15, selEnd: 15 });
  });
  it("Enter 는 커서 뒤의 글을 새 줄로 내린다", () => {
    expect(key("ab", 1, 1, "Enter")).toEqual({ value: "a\nb", selStart: 2, selEnd: 2 });
  });
  it("그 밖의 키와 Shift+Enter 는 건드리지 않는다", () => {
    expect(key("ab", 1, 1, "a")).toBeNull();
    expect(key("ab", 1, 1, "Enter", { shiftKey: true })).toBeNull();
  });
  it("입력 칸 속성: 맞춤법·자동 고침·자동 대문자 끔, 줄 바꿈 없음", () => {
    expect(CODE_FIELD_ATTRS).toEqual({ spellCheck: false, autoCapitalize: "off", autoCorrect: "off", autoComplete: "off", wrap: "off" });
  });
});
