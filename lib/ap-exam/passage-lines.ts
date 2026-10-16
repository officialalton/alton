// 줄 번호가 있는 문학 지문(AP English Literature)의 공용 줄 모델. 생성기·게이트·풀이기 프롬프트·학생 화면이 모두 같은 번호를 쓴다.
// 규칙(실제 시험 관행): 빈 줄(연·문단 사이)은 줄로 세지 않는다. 번호는 세는 줄 기준 5·10·15… 에만 표시한다. 산문은 코드가 고정 폭으로 접어(wrapParagraph) 줄을 만든다 —
// 모델은 줄 번호를 추측하지 않고 지문 안 구절(ref)만 인용하며, 번호는 코드가 계산한다.
export const PROSE_WRAP_WIDTH = 56;
export const PASSAGE_FENCE = "passage";

/** 문단 하나를 폭 `width` 자 이내의 줄로 접는다(단어 단위). 첫 줄은 들여쓰기 4칸(문단 표시). */
export function wrapParagraph(text: string, width = PROSE_WRAP_WIDTH): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean); const lines: string[] = []; let cur = "    ";
  for (const w of words) {
    const next = cur.trim() ? `${cur} ${w}` : `${cur}${w}`;
    if (next.length > width && cur.trim()) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur.trim()) lines.push(cur);
  return lines;
}
export type LitPassageShape = { form: "poem" | "prose" | "drama"; stanzas: string[][] };
/** 번호가 붙는 줄(빈 줄 제외)의 목록. 번호는 1부터. */
export const countedLines = (stanzas: string[][]): string[] => stanzas.flat().filter((l) => l.trim() !== "");
/** 연·문단 사이에 빈 줄을 둔 평평한 줄 배열(화면용 `passage` 펜스 본문). */
export const flatWithBreaks = (stanzas: string[][]): string[] => stanzas.flatMap((s, i) => (i === 0 ? s : ["", ...s]));
/** 줄 배열(빈 줄 포함) → 줄마다 번호 표시(5의 배수만, 나머지·빈 줄은 null). */
export function lineNumberLabels(lines: string[]): (number | null)[] { let n = 0; return lines.map((l) => (l.trim() === "" ? null : (n += 1) % 5 === 0 ? n : null)); }
/** 지문 문자열(학생 화면용): 첫 줄 표지 + 제목 + 펜스 블록. 학생 화면(LearningText)이 `passage` 펜스를 줄 번호 블록으로 그린다. */
export function litPassageDisplay(p: { title: string; attribution?: string; stanzas: string[][] }): string {
  return ["ALTON original passage", p.title.trim(), ...(p.attribution ? [p.attribution.trim()] : []), "", "```" + PASSAGE_FENCE, ...flatWithBreaks(p.stanzas), "```"].join("\n");
}
/** 풀이기·검토기용 텍스트(번호는 5줄마다, 학생 화면과 같은 규칙). */
export function litPassageForModels(p: { title: string; stanzas: string[][] }): string {
  const lines = flatWithBreaks(p.stanzas); const lab = lineNumberLabels(lines);
  return `${p.title.trim()}\n\n` + lines.map((l, i) => (l.trim() === "" ? "" : `${lab[i] !== null ? String(lab[i]).padStart(3) : "   "}  ${l}`)).join("\n");
}
// ── 구절(ref) → 줄 번호 ────────────────────────────────────────────
const tok = (t: string): string[] => t.toLowerCase().replace(/[‘’‛]/g, "'").replace(/[“”„]/g, '"').replace(/—|–/g, " ").replace(/\.\.\.|…/g, " ").replace(/\//g, " ").replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(Boolean);
const stripAp = (w: string) => w.replace(/^'+|'+$/g, "");
export type WordAt = { w: string; line: number };
export function wordsWithLines(stanzas: string[][]): WordAt[] { const out: WordAt[] = []; countedLines(stanzas).forEach((l, i) => { for (const w of tok(l)) out.push({ w: stripAp(w), line: i + 1 }); }); return out; }
/** 인용 구절이 지문에서 차지하는 줄 범위. 없으면 not_found, 여럿이면 ambiguous. */
export function locateQuote(stanzas: string[][], quote: string): { ok: true; from: number; to: number } | { ok: false; reason: "not_found" | "ambiguous" | "too_short" } {
  const q = tok(quote).map(stripAp).filter(Boolean); if (q.length < 2) return { ok: false, reason: "too_short" };
  const words = wordsWithLines(stanzas); const hits: number[] = [];
  for (let i = 0; i + q.length <= words.length; i++) { let ok = true; for (let j = 0; j < q.length; j++) if (words[i + j].w !== q[j]) { ok = false; break; } if (ok) hits.push(i); }
  if (!hits.length) return { ok: false, reason: "not_found" }; if (hits.length > 1) return { ok: false, reason: "ambiguous" };
  return { ok: true, from: words[hits[0]].line, to: words[hits[0] + q.length - 1].line };
}
export const rangeText = (from: number, to: number): string => (from === to ? `line ${from}` : `lines ${from}-${to}`);
