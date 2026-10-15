// 반응형 줄 번호(2026-10-15): ```passage 펜스는 산문을 코드가 56자로 접은 줄(PROSE_WRAP_WIDTH)로 저장한다. 좁은 화면에서는 그 줄이 다시 접혀 5줄 간격이 7~10행처럼 보인다.
// 이 모듈은 저장된 내용을 바꾸지 않고, (1) 접힌 줄을 문단(단어 배열)으로 복원하고 (2) 화면이 실제로 접은 행 목록을 받아 번호를 다시 매기며
// (3) 문항·해설 속 'lines 7-9' 같은 옛 줄 번호를 단어 앵커를 통해 지금 화면의 번호로 바꾼다. 순수 함수만 있다(DOM 측정은 LearningText 가 한다).
import { PROSE_WRAP_WIDTH } from "./passage-lines";

export type PassageBlockModel =
  | { kind: "blank" }
  | { kind: "poem"; line: string; legacyNo: number }
  /** 산문 문단: words = 문단의 단어, legacyStarts[k] = 옛(56자) 줄 k+1 의 첫 단어 위치, legacyFirst = 첫 옛 줄 번호 */
  | { kind: "prose"; words: string[]; legacyStarts: number[]; legacyFirst: number };

/** 연속된 비어 있지 않은 줄 묶음이 코드가 접은 산문 문단인지: 첫 줄 4칸 들여쓰기, 나머지는 들여쓰기 없음, 모든 줄 ≤56자, 마지막 줄 말고는 36자 이상(탐욕 접기의 결과 모양). */
export function isWrappedProse(group: string[], width = PROSE_WRAP_WIDTH): boolean {
  if (!group.length || !/^ {4}\S/.test(group[0])) return false;
  for (let i = 0; i < group.length; i++) {
    const l = group[i];
    if (i > 0 && /^\s/.test(l)) return false;
    if (l.length > width) return false;
    if (i < group.length - 1 && l.trimEnd().length < 36) return false;
  }
  return true;
}

export function parsePassage(lines: string[]): PassageBlockModel[] {
  const out: PassageBlockModel[] = []; let legacy = 0; let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() === "") { out.push({ kind: "blank" }); i++; continue; }
    let j = i; while (j < lines.length && lines[j].trim() !== "") j++;
    const group = lines.slice(i, j);
    if (isWrappedProse(group)) {
      const words: string[] = []; const starts: number[] = [];
      for (const l of group) { starts.push(words.length); words.push(...l.trim().split(/\s+/).filter(Boolean)); }
      out.push({ kind: "prose", words, legacyStarts: starts, legacyFirst: legacy + 1 }); legacy += group.length;
    } else for (const l of group) { legacy += 1; out.push({ kind: "poem", line: l, legacyNo: legacy }); }
    i = j;
  }
  return out;
}

/** 단어 위치 → 행 번호(0부터): rowStarts 는 각 행의 첫 단어 위치(오름차순, 첫 값 0). */
export function rowOfWord(rowStarts: number[], w: number): number {
  let r = 0; for (let k = 0; k < rowStarts.length; k++) { if (rowStarts[k] <= w) r = k; else break; } return r;
}

/** 단어 상단 좌표(px, 단어 순서) → 행 시작 단어 위치. 같은 행의 단어는 상단이 거의 같다(허용 오차 tol px). */
export function rowStartsFromTops(tops: number[], tol = 4): number[] {
  const starts: number[] = []; let last = -Infinity;
  tops.forEach((t, i) => { if (i === 0 || t - last > tol) { starts.push(i); last = t; } });
  return starts;
}

export type LayoutRows = Array<number[] | null>; // 블록마다: 산문이면 행 시작 단어 위치, 그 밖은 null
export type Numbering = {
  /** 블록별 화면 행 번호(1부터, 세는 줄). blank 는 []. 시는 [n], 산문은 행마다 하나 */
  rows: number[][];
  total: number;
  /** 옛 줄 번호(1부터) → 화면 번호 범위 */
  legacy: Array<{ from: number; to: number }>;
};

/** 측정한 행으로 화면 번호를 매기고, 옛 줄 번호를 화면 번호로 옮기는 표를 만든다. 산문 행 정보가 null 이면 옛 줄(56자)을 그대로 행으로 본다. */
export function numberPassage(blocks: PassageBlockModel[], layout: LayoutRows): Numbering {
  let n = 0; const rows: number[][] = []; const legacy: Array<{ from: number; to: number }> = [];
  blocks.forEach((b, bi) => {
    if (b.kind === "blank") { rows.push([]); return; }
    if (b.kind === "poem") { n += 1; rows.push([n]); legacy[b.legacyNo - 1] = { from: n, to: n }; return; }
    const rs = layout[bi] ?? b.legacyStarts; const base = n; const mine: number[] = [];
    for (let k = 0; k < rs.length; k++) mine.push(base + k + 1);
    n += rs.length; rows.push(mine);
    b.legacyStarts.forEach((s, k) => {
      const e = (k + 1 < b.legacyStarts.length ? b.legacyStarts[k + 1] : b.words.length) - 1;
      legacy[b.legacyFirst - 1 + k] = { from: base + rowOfWord(rs, s) + 1, to: base + rowOfWord(rs, Math.max(s, e)) + 1 };
    });
  });
  return { rows, total: n, legacy };
}

/** 5줄마다만 번호를 보이는 규칙(lineNumberLabels 와 같음). */
export const showsNumber = (n: number): boolean => n % 5 === 0;

// ── 본문 속 줄 참조 다시 쓰기 ──────────────────────────────────────
// 'line 15', 'lines 30-31', 'lines 7 and 9', 'lines 3, 5-6' 형태. 줄 번호가 지문의 옛 줄 수를 넘으면 건드리지 않는다.
const REF = /\b(lines?)(\s+)(\d{1,3}(?:\s*[-–—]\s*\d{1,3})?(?:\s*(?:,|and|&)\s*\d{1,3}(?:\s*[-–—]\s*\d{1,3})?)*)(?![\d])/gi;
const ITEM = /(\d{1,3})(?:(\s*[-–—]\s*)(\d{1,3}))?/g;
export function rewriteLineRefs(text: string, legacy: Array<{ from: number; to: number }>): string {
  if (!legacy.length || !/line/i.test(text)) return text;
  return text.replace(REF, (whole, kw: string, sp: string, body: string) => {
    let ok = true; let count = 0; let ranged = false;
    const newBody = body.replace(ITEM, (_m, a: string, dash: string | undefined, b: string | undefined) => {
      const x = legacy[Number(a) - 1]; const y = b ? legacy[Number(b) - 1] : x;
      if (!x || !y) { ok = false; return _m; }
      count += 1; const from = x.from, to = y.to;
      if (from === to) return String(from);
      ranged = true; return `${from}${dash ?? "-"}${to}`;
    });
    if (!ok) return whole;
    const plural = count > 1 || ranged;
    const word = plural ? "lines" : "line";
    return `${kw[0] === "L" ? word[0].toUpperCase() + word.slice(1) : word}${sp}${newBody}`;
  });
}
