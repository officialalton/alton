import { describe, expect, it } from "vitest";
import {
  addHighlight, findHighlightAt, highlightMatches, offsetsToRange, parseAnnotations, rangeToOffsets, removeHighlight, setNote, NOTE_MAX,
} from "./annotation-anchor";

function root(html: string): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

describe("오프셋 앵커링", () => {
  it("여러 요소에 걸친 Range 를 오프셋으로 바꾸고 다시 같은 구간을 복원한다", () => {
    const el = root("<p>Hello <b>big</b> world</p><p>Second line</p>");
    const text = el.textContent!;
    const start = text.indexOf("big");
    const end = text.indexOf("Second") + 3;
    const range = offsetsToRange(el, start, end)!;
    expect(range.toString()).toBe(text.slice(start, end));
    expect(rangeToOffsets(el, range)).toEqual({ start, end });
  });

  it("같은 텍스트로 다시 렌더해도 복원되고, 텍스트가 달라지면 일치 검사가 실패한다", () => {
    const a = root("<p>The quick brown fox</p>");
    const h = addHighlight([], a.textContent!, 4, 9);
    const b = root("<div><span>The quick</span> brown fox</div>");
    expect(highlightMatches(b.textContent!, h[0])).toBe(true);
    expect(offsetsToRange(b, h[0].start, h[0].end)!.toString()).toBe("quick");
    expect(highlightMatches("A different passage", h[0])).toBe(false);
  });

  it("범위를 벗어난 오프셋은 null", () => {
    expect(offsetsToRange(root("<p>abc</p>"), 5, 9)).toBeNull();
    expect(offsetsToRange(root("<p>abc</p>"), 2, 2)).toBeNull();
  });
});

describe("하이라이트 목록 조작", () => {
  const text = "0123456789abcdefghij";
  it("겹치는 구간은 합치고 먼저 있던 메모를 유지한다", () => {
    let l = addHighlight([], text, 2, 6);
    l = setNote(l, l[0].id, "  my   note ");
    l = addHighlight(l, text, 5, 10);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ start: 2, end: 10, text: "23456789", note: "my note" });
  });
  it("메모는 한 줄·최대 길이로 다듬고 빈 메모는 삭제한다", () => {
    let l = addHighlight([], text, 0, 3);
    l = setNote(l, l[0].id, "x".repeat(300));
    expect(l[0].note).toHaveLength(NOTE_MAX);
    l = setNote(l, l[0].id, "   ");
    expect(l[0].note).toBeUndefined();
  });
  it("위치 조회·하이라이트 제거", () => {
    const l = addHighlight(addHighlight([], text, 0, 3), text, 8, 12);
    expect(findHighlightAt(l, 9)?.start).toBe(8);
    expect(findHighlightAt(l, 5)).toBeNull();
    expect(removeHighlight(l, l[0].id)).toHaveLength(1);
  });
  it("서버 값 방어 파싱: 깨진 항목·범위 밖 소거 번호는 버린다", () => {
    const a = parseAnnotations({ highlights: [{ id: "a", start: 1, end: 3, text: "ab", note: "n" }, { id: "b", start: 5, end: 2 }, "x"], eliminated: [2, 2, 9, "1", 0] });
    expect(a.highlights).toHaveLength(1);
    expect(a.eliminated).toEqual([0, 2]);
    expect(parseAnnotations(null)).toEqual({ highlights: [], eliminated: [] });
  });
});
