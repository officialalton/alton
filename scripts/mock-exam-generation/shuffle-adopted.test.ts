import { describe, it, expect } from "vitest";
import { letterRefs, remapExplanation, reorder } from "./shuffle-adopted";

describe("선택지 섞기·해설 글자 치환", () => {
  it("정답을 목표 위치로 옮기고 나머지는 원래 상대 순서를 유지", () => {
    const r = reorder(["w", "x", "y", "z"], 0, 2);
    expect(r.options).toEqual(["x", "y", "w", "z"]);
    expect(r.perm).toEqual([1, 2, 0, 3]);
    expect(reorder(["w", "x", "y", "z"], 3, 0).options).toEqual(["z", "w", "x", "y"]);
  });
  it("해설의 글자 참조만 치환(따옴표 안 인용·영어 관사·소유격 제외)", () => {
    const map = { A: "C", B: "A", C: "B", D: "D" };
    const s = '정답 A: 앞 문장이 "A single boat drifted"라고 말한다. B(Nevertheless,)는 대조, C) 는 예시, D는 인과. 그래서 A가 맞다.';
    const out = remapExplanation(s, map);
    expect(out).toContain("정답 C:");
    expect(out).toContain('"A single boat drifted"');
    expect(out).toContain("A(Nevertheless,)");
    expect(out).toContain("B) 는 예시");
    expect(out).toContain("D는 인과");
    expect(out).toContain("그래서 C가 맞다");
  });
  it("영어 관사형 A 와 단어 속 글자는 참조가 아니다", () => {
    expect(letterRefs("A study of birds and B-cells in the ABC plan").map((r) => r.letter)).toEqual(["B"].slice(0, 0));
    expect(letterRefs("선택지 B와 C 를 비교").map((r) => r.letter)).toEqual(["B", "C"]);
  });
});
