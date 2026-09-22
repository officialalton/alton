import katex from "katex";

// P2/P3 5단계 — 교재·문제 본문의 수식을 읽을 수 있게 렌더링한다.
//
// 지문에 섞여 들어오는 수식은 LaTeX 표기($...$ 인라인, $$...$$ 블록)를 쓴다.
// 지금까지는 그냥 문자열로 노출돼 "$\\frac{1}{2}$"가 그대로 보였다.
//
// KaTeX는 네트워크 없이 동작하고 서버에서도 문자열로 렌더링할 수 있어, 학생이
// 수업 중 오프라인에 가까운 상태여도 수식이 깨지지 않는다.

export type ContentPart =
  | { kind: "text"; value: string }
  /** __밑줄__ — Text Structure 문항의 '밑줄 친 문장'(2026-09-14 ⑤). */
  | { kind: "underline"; value: string }
  /** ______ 빈칸 — RW 빈칸 문항의 대상(2026-09-14 RW 구조화 블록). 학생 화면에서 밑줄 칸으로 그린다. */
  | { kind: "blank" }
  | { kind: "math"; html: string; display: boolean }
  | { kind: "math-error"; source: string };

const TOKEN = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|__([^_\n][^\n]*?)__|(_{3,})/g;

/**
 * 본문을 "글"과 "수식" 조각으로 나눈다. 수식이 하나도 없으면 글 한 조각만
 * 돌려주므로, 수식을 쓰지 않는 교재는 지금과 똑같이 렌더링된다.
 *
 * 깨진 수식은 조용히 버리지 않고 원문을 그대로 보여준다 — 학생 화면에서 내용이
 * 사라지는 것이 가장 나쁘고, 교사가 오타를 발견할 수 있어야 한다.
 */
export function splitLearningContent(source: string): ContentPart[] {
  const parts: ContentPart[] = [];
  let lastIndex = 0;
  TOKEN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = TOKEN.exec(source)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ kind: "text", value: source.slice(lastIndex, match.index) });
    }
    if (match[3] !== undefined) {
      parts.push({ kind: "underline", value: match[3] });
      lastIndex = match.index + match[0].length;
      continue;
    }
    if (match[4] !== undefined) {
      parts.push({ kind: "blank" });
      lastIndex = match.index + match[0].length;
      continue;
    }
    const display = match[1] !== undefined;
    const expression = (match[1] ?? match[2] ?? "").trim();
    try {
      parts.push({
        kind: "math",
        display,
        html: katex.renderToString(expression, {
          displayMode: display,
          throwOnError: true,
          output: "html",
        }),
      });
    } catch {
      parts.push({ kind: "math-error", source: match[0] });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < source.length) {
    parts.push({ kind: "text", value: source.slice(lastIndex) });
  }
  if (parts.length === 0) parts.push({ kind: "text", value: source });
  return parts;
}

/** 본문에 수식이 섞여 있는지 — 스타일시트를 붙일지 판단할 때 쓴다. */
export function hasMath(source: string): boolean {
  TOKEN.lastIndex = 0;
  return TOKEN.test(source);
}


// -------------------------------------------------------------------------
// 표 블록 (2026-09-14 문제 템플릿 ②) — 마크다운 파이프 표를 표로 그린다.
//
// SAT Math·RW 문항의 자극 상당수가 표다(x, f(x) / 데이터 집합 / 연구 결과). 별도 스키마 없이 본문에
// | x | f(x) |
// |---|------|
// | 0 | 17   |
// 처럼 쓰면 표가 된다. 표가 아닌 줄은 그대로 글(수식 포함) 조각으로 간다.
// -------------------------------------------------------------------------

export type ContentBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "table"; header: string[]; rows: string[][] }
  /** '- ' 로 시작하는 연속 줄 — Rhetorical Synthesis 의 메모 목록 등(2026-09-14 ⑤). */
  | { kind: "list"; items: string[] };

const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const EMBEDDED_SEP = /\|\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|/;

function splitCells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((c) => c.trim());
}

/**
 * 2026-09-21(UAT 지적) — 문제 데이터 생성 과정 어딘가에서 줄바꿈이 사라져, 마크다운
 * 표 전체가 "| x | y | |---|---| | 4 | -18 | ..." 처럼 한 줄에 눌려 붙은 채로
 * 들어오는 사례가 있었다(원인은 생성 파이프라인 쪽이라 이번엔 화면 쪽에서 방어한다 —
 * 데이터를 일일이 찾아 고치는 대신, 렌더러가 이 모양을 알아보고 되살린다).
 * 헤더 열 개수를 표 구분자(|---|...) 앞부분에서 세운 뒤, 그 개수만큼 셀을 묶고
 * 행 사이의 빈 경계 칸(연속된 "||")을 건너뛰며 원래 행들로 되돌린다.
 */
function unflattenTableLine(line: string): string[] | null {
  if (!TABLE_ROW.test(line) || TABLE_SEP.test(line)) return null;
  const sepMatch = line.match(EMBEDDED_SEP);
  if (!sepMatch || sepMatch.index === undefined) return null;
  const headerPart = line.slice(0, sepMatch.index).trim();
  if (!TABLE_ROW.test(headerPart)) return null;
  const colCount = splitCells(headerPart).length;
  if (colCount < 1) return null;

  const cells = line.split("|");
  const inner = cells.slice(1, -1); // 시작·끝의 빈 문자열(줄 앞뒤 파이프) 제외
  const rows: string[][] = [];
  let idx = 0;
  while (idx < inner.length) {
    const rowCells = inner.slice(idx, idx + colCount);
    if (rowCells.length < colCount) return null; // 형태가 안 맞으면 되살리기 포기(원문 그대로 둔다)
    rows.push(rowCells.map((c) => c.trim()));
    idx += colCount;
    if (idx < inner.length && inner[idx].trim() === "") idx += 1;
  }
  if (rows.length < 2) return null;
  return rows.map((r) => `|${r.join("|")}|`);
}

export function splitLearningBlocks(source: string): ContentBlock[] {
  const rawLines = source.replace(/\r\n/g, "\n").split("\n");
  const lines = rawLines.flatMap((line) => unflattenTableLine(line) ?? [line]);
  const blocks: ContentBlock[] = [];
  let buffer: string[] = [];
  const flush = () => {
    if (buffer.length) {
      blocks.push({ kind: "paragraph", text: buffer.join("\n") });
      buffer = [];
    }
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // 표: 헤더 줄 + 구분 줄(---)로 시작하는 연속된 파이프 줄.
    if (TABLE_ROW.test(line) && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      flush();
      const header = splitCells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && TABLE_ROW.test(lines[i]) && !TABLE_SEP.test(lines[i])) {
        rows.push(splitCells(lines[i]));
        i += 1;
      }
      blocks.push({ kind: "table", header, rows });
      continue;
    }
    if (/^\s*[-•]\s+/.test(line)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^\s*[-•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-•]\s+/, ""));
        i += 1;
      }
      blocks.push({ kind: "list", items });
      continue;
    }
    buffer.push(line);
    i += 1;
  }
  flush();
  if (blocks.length === 0) blocks.push({ kind: "paragraph", text: source });
  return blocks;
}
