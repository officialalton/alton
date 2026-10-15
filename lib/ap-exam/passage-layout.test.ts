import { describe, expect, it } from "vitest";
import { numberPassage, parsePassage, rewriteLineRefs, rowOfWord, rowStartsFromTops, isWrappedProse } from "./passage-layout";
import { flatWithBreaks, lineNumberLabels, locateQuote, wrapParagraph } from "./passage-lines";

const P1 = "The inspector arrived on a wet Tuesday with a leather satchel, a folding rule, and the polite impatience of a man who had examined forty schools before breakfast and expected the forty-first to disappoint him in some new and instructive way.";
const P2 = "Nobody in the schoolroom moved. Hetty, who was seven and had never learned when to be quiet, asked him whether he had come all the way from the city only to count the slates, and the whole room held its breath until he laughed.";
const stanzas = [wrapParagraph(P1), wrapParagraph(P2)];
const lines = flatWithBreaks(stanzas);
/** 단어 폭 근사로 화면 행을 만드는 시뮬레이터(측정 대신 테스트에서만 사용): maxChars 자마다 접는다. */
function simulateRows(words: string[], maxChars: number, firstIndent = 4): number[] {
  const starts = [0]; let cur = firstIndent;
  words.forEach((w, i) => { const add = (cur > 0 && i !== starts[starts.length - 1] ? 1 : 0) + w.length; if (cur + add > maxChars && i !== starts[starts.length - 1]) { starts.push(i); cur = w.length; } else cur += add; });
  return starts;
}

describe("parsePassage", () => {
  it("restores wrapped prose into paragraphs with legacy line anchors that match lineNumberLabels counting", () => {
    const b = parsePassage(lines);
    const prose = b.filter((x) => x.kind === "prose");
    expect(prose).toHaveLength(2);
    const legacyCount = lines.filter((l) => l.trim()).length;
    const last = prose[1]; if (last.kind !== "prose") throw new Error();
    expect(last.legacyFirst - 1 + last.legacyStarts.length).toBe(legacyCount);
    expect(prose[0].kind === "prose" && prose[0].words.join(" ")).toBe(P1);
  });
  it("does not treat verse (original lines, no 4-space first-line indent) as prose", () => {
    expect(parsePassage(["Because I could not stop for Death", "He kindly stopped for me", "", "We slowly drove"]).every((b) => b.kind !== "prose")).toBe(true);
    expect(isWrappedProse(["    short", "x"])).toBe(false);
  });
});

describe("numberPassage / rewriteLineRefs", () => {
  const blocks = parsePassage(lines);
  const legacyLabels = lineNumberLabels(lines);
  it("with legacy rows reproduces the stored numbering and leaves refs untouched", () => {
    const n = numberPassage(blocks, blocks.map(() => null));
    const flat = n.rows.flatMap((r) => r).filter((v) => v % 5 === 0);
    expect(flat).toEqual(legacyLabels.filter((v): v is number => v !== null));
    expect(rewriteLineRefs("lines 7-9 and line 3", n.legacy)).toBe("lines 7-9 and line 3");
  });
  it("narrow viewport: every counted row is numbered consecutively and refs follow the quote's words", () => {
    const layout = blocks.map((b) => (b.kind === "prose" ? simulateRows(b.words, 30) : null));
    const n = numberPassage(blocks, layout);
    expect(n.total).toBeGreaterThan(lines.filter((l) => l.trim()).length);
    // 인용 구절의 옛 줄 범위 → 화면 번호: 구절 첫 단어가 놓인 행 번호와 일치해야 한다
    const q = "asked him whether he had come all the way from the city";
    const loc = locateQuote(stanzas, q); if (!loc.ok) throw new Error("quote");
    const p2 = blocks[2]; if (p2.kind !== "prose") throw new Error();
    const base = n.rows[0].length; // 문단 1 행 수
    // 앵커 = 옛 줄의 첫 단어 / 끝 단어가 놓인 화면 행(인용 구절을 모두 덮는다)
    const lineIdx = (l: number) => l - p2.legacyFirst; const endWord = (k: number) => (k + 1 < p2.legacyStarts.length ? p2.legacyStarts[k + 1] : p2.words.length) - 1;
    const from = base + rowOfWord(layout[2]!, p2.legacyStarts[lineIdx(loc.from)]) + 1; const to = base + rowOfWord(layout[2]!, endWord(lineIdx(loc.to))) + 1;
    expect(rewriteLineRefs(`(lines ${loc.from}-${loc.to})`, n.legacy)).toBe(from === to ? `(line ${from})` : `(lines ${from}-${to})`);
    // 구절의 첫 단어가 놓인 행은 반드시 범위 안에 있다
    const qWord = p2.words.join(" ").split(q)[0].split(" ").filter(Boolean).length; const qRow = base + rowOfWord(layout[2]!, qWord) + 1;
    expect(qRow).toBeGreaterThanOrEqual(from); expect(qRow).toBeLessThanOrEqual(to);
    expect(from).toBeGreaterThan(loc.from); // 좁은 화면에서는 번호가 실제로 달라진다
  });
  it("collapses a range onto one row into 'line N' and handles lists, case and out-of-range numbers", () => {
    const legacy = [{ from: 1, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 2 }, { from: 3, to: 3 }];
    expect(rewriteLineRefs("(lines 1-1)", legacy)).toBe("(line 1)");
    expect(rewriteLineRefs("Lines 3-4", legacy)).toBe("Lines 2-3");
    expect(rewriteLineRefs("lines 2 and 4", legacy)).toBe("lines 1-2 and 3");
    expect(rewriteLineRefs("line 2", legacy)).toBe("lines 1-2");
    expect(rewriteLineRefs("lines 3–4", legacy)).toBe("lines 2–3");
    expect(rewriteLineRefs("line 99", legacy)).toBe("line 99");
    expect(rewriteLineRefs("the baseline 2 value, outline 3", legacy)).toBe("the baseline 2 value, outline 3");
  });
});

describe("rowStartsFromTops", () => {
  it("groups words by line top with tolerance", () => {
    expect(rowStartsFromTops([0, 0.5, 1, 24, 24.2, 48])).toEqual([0, 3, 5]);
  });
});
