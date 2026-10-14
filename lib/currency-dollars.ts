// 통화 기호 `$` 이스케이프(2026-10-14 라운드 4). 본문 렌더러(lib/render-learning-content.ts)는 "$3 each … $55"처럼 맨 `$` 두 개 사이를 수식으로 읽지 않도록
// looksLikeCurrencyPair 휴리스틱으로 구제하지만, 그 휴리스틱에 기대는 문장은 수정 도구·게시 검사(`$` 짝 맞춤)와 어긋난다. 저장 문안에서는 금액의 `$` 를 `\$` 로 쓴다
// (생성 규칙과 같은 표기 — 렌더러는 `\$` 를 글자 "$" 로 그린다). 이 함수는 휴리스틱이 통화로 읽는 `$` 와 짝 없이 남은 `$숫자` 만 `\$` 로 바꾼다. 진짜 수식($x$, $3x+1$, $$…$$)·코드는 건드리지 않으며 멱등이다.
import { looksLikeCurrencyPair } from "./render-learning-content";

const TOK = /\\\$|\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
const CODE_SEG = /(```[\s\S]*?```|`[^`\n]+`)/;

function escapePlain(text: string, force: boolean): { out: string; changed: boolean } {
  const marks = new Set<number>();
  const consumed: [number, number][] = [];
  let pairFired = false;
  TOK.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOK.exec(text)) !== null) {
    if (m[0] === "\\$") continue;
    if (m[2] !== undefined && looksLikeCurrencyPair(m[2], text.slice(m.index + m[0].length, m.index + m[0].length + 1))) {
      marks.add(m.index); pairFired = true;
      TOK.lastIndex = m.index + 1;
      continue;
    }
    consumed.push([m.index, m.index + m[0].length]);
  }
  // 짝이 없어 글자로 남은 `$숫자`(수식 구간·이스케이프 밖)
  const inside = (i: number) => consumed.some(([a, b]) => i >= a && i < b);
  const loose: number[] = [];
  for (const x of text.matchAll(/(?<!\\)\$(?=\d)/g)) { const i = x.index!; if (!marks.has(i) && !inside(i) && text[i - 1] !== "$" && text[i + 1] !== "$") loose.push(i); }
  // 금액이 한 문장에 둘 이상이거나 휴리스틱이 작동한 문장만 바꾼다(문항 하나에 맨 `$60` 한 개는 짝이 될 수 없어 이미 안전).
  if (!force && !pairFired && marks.size + loose.length < 2) return { out: text, changed: false };
  for (const i of loose) marks.add(i);
  if (!marks.size) return { out: text, changed: false };
  let out = ""; for (let i = 0; i < text.length; i++) out += marks.has(i) ? "\\$" : text[i];
  return { out, changed: true };
}

/** force: 맨 `$숫자` 가 하나뿐이어도 바꾼다(새로 만드는 지문·해설용 — 게시 검사의 `$` 짝 맞춤이 홀수를 허용하지 않는다). */
export function escapeCurrencyDollars(text: string, opts: { force?: boolean } = {}): string {
  if (!text || !text.includes("$")) return text;
  return text.split(CODE_SEG).map((seg, i) => (i % 2 === 1 ? seg : escapePlain(seg, !!opts.force).out)).join("");
}

/** 이 문안에서 escapeCurrencyDollars 가 바꿀 `$` 가 있는가(스캔용). */
export function hasUnescapedCurrency(text: string | null | undefined): boolean {
  return !!text && escapeCurrencyDollars(text) !== text;
}
