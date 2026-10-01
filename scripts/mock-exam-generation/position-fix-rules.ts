// 선택지 순서 교정용 결정론 규칙(2026-10-01) — 순수 함수, API·DB 없음.
// 해설의 선택지 참조는 세 종류다: 글자(A~D), 한국어 서수(첫/두/세/네 번째 선택지), 영어 서수(first/second/third/fourth choice·option).
// 규칙이 확신하지 못하는 표현(문장 첫머리의 'A + 소문자 단어' 가 관사인지 참조인지 모호, '마지막 선택지' 등)은 uncertain 으로 돌려주고 호출자는 그 문항을 섞지 않는다.
import { quotedMask } from "./shuffle-adopted";

export const LETTERS = "ABCD";
const KO_ORD = ["첫", "두", "세", "네"];
const EN_ORD = ["first", "second", "third", "fourth"];
const KO_ORD_RE = /(첫|두|세|네)(\s?)번째(\s?)(?=선택지|보기|항목|답)/g;
const EN_ORD_RE = /\b(first|second|third|fourth)(\s+)(choices?|options?|answers?)\b/gi;
const UNCERTAIN_RE = /(마지막|last|final)\s*(선택지|보기|choice|option|answer)|(위|앞|이전)\s*(선택지|보기)|(previous|preceding|above)\s+(choice|option)/i;
// 'A' 바로 뒤에 올 수 있는 기능어·동사(관사 뒤에는 올 수 없는 단어)
const AFTER_A = new Set(["is", "was", "are", "were", "be", "and", "or", "but", "nor", "the", "as", "to", "with", "in", "on", "of", "for", "by", "at", "from", "that", "which", "because", "since", "while", "not", "also", "only", "never", "cannot", "can", "will", "may", "might", "should", "must", "would", "could", "did", "does", "do", "has", "have", "had", "correctly", "incorrectly", "fails", "states", "says", "provides", "gives", "shows", "presents", "describes", "mentions", "suggests", "uses", "makes", "misrepresents", "overstates", "understates", "reverses", "confuses", "ignores", "contradicts", "focuses", "introduces", "refers", "offers", "creates", "captures", "supports", "weakens", "strengthens", "repeats", "restates", "treats", "raises", "adds", "places", "lists", "addresses", "explains", "relies", "identifies", "reflects", "implies", "claims", "argues", "concludes", "misreads", "distorts", "exaggerates", "omits", "lacks", "includes", "fits", "works", "matches", "means", "conveys", "indicates", "illustrates", "demonstrates", "emphasizes", "highlights", "attributes", "assumes", "applies", "requires", "involves", "contains", "reverses", "answers", "completes", "connects", "links", "joins", "separates", "splits", "combines", "uses", "keeps", "gets", "takes", "turns", "leaves", "needs", "wants", "tries", "seems", "appears", "looks", "sounds", "feels", "becomes"]);

export type RefTok = { kind: "letter" | "ordKo" | "ordEn" | "index"; index: number; len: number; idx: number; raw: string };
export type Analysis = { toks: RefTok[]; uncertain: string[] };

const sentenceStart = (s: string, i: number): boolean => {
  let j = i - 1;
  while (j >= 0 && (s[j] === " " || s[j] === "\t")) j--;
  return j < 0 || s[j] === "." || s[j] === "!" || s[j] === "?" || s[j] === "\n" || s[j] === "。";
};

const INDEX_RE = /(?:인덱스|index)\s*(\d)/gi;
// 숫자로 위치를 가리키는 표현 — 0기반·1기반이 섞여 있어 규칙이 믿지 못한다(인덱스 N 은 0기반으로 명시돼 치환).
const NUMERIC_POS_RE = /(?:정답(?:은|:|는)?\s*\d\s?번)|(?:선택지|보기|옵션|option|choice)\s*\d(?:\s*[·,과와및]\s*\d)*(?![\d%.])|\d\s?번\s?(?:선택지|보기|항목)|(?:^|[\s(])\d\s?번(?:이다|이|은|는)/i;
const EXTRA_LETTER_RE = /(?:choice|option|선택지|보기)\s*[E-H](?![A-Za-z])/i;

// ── 글자 토큰 분류(보수 정책): 고신뢰 참조 / 고신뢰 관사·고유 라벨 / 그 밖(unknown → 문항 생략) ──
const TOKEN_RE = /(?<![A-Za-z0-9$_\-\\])([A-H])(?![A-Za-z0-9_\-]|['’](?!s\b))/g;
const REF_BEFORE = /(?:choices?|options?|answers?|letters?|statements?|선택지|보기|정답은?|정답:|makes?|made|making|choose|choosing|chose|select\w*|pick\w*|\(|\/|(?:^|[\s,;(])(?:and|or|nor|vs\.?|than|through|neither|either|both|to|that|is|are|was|were|be|of))\s*$/i;
const REF_AFTER = /^(?:[)\]:;!?]|[.,](?:\s|$)|['’]s\b|\s*[는은가이를을의도만와과로에께]|\s*번|\s+(?:is|are|was|were|and|or|but|nor|correct|incorrect|wrong|right|also|only|does|did|has|can|will|would|cannot|should|merely|simply|clearly|instead|here|alone|as)\b|\s*$)/i;
const NONREF_BEFORE = /(?:Plan|Vitamin|Type|Group|Class|Grade|Phase|Step|Model|Table|Figure|Region|Zone|Hepatitis|Factor|Level|Tier|Category|Form|Part|Section|Unit|Panel|Set|Line|Point|Case|Team|Condition|Treatment|Plot|Site|Batch|Trial|Sample|Stage|Paper|Study|Experiment|Scenario|Method|Program|Product|Brand|Company|Option\s?\d)\s+$/;
function classifyToken(t: string, i: number, letter: string): "ref" | "article" | "nonref" | "unknown" {
  const before = t.slice(Math.max(0, i - 22), i), after = t.slice(i + 1, i + 40);
  if (NONREF_BEFORE.test(before)) return "nonref";
  if (letter >= "E") return REF_BEFORE.test(before) && /choice|option|선택지|보기|answer/i.test(before) ? "ref" : "unknown";
  if (REF_BEFORE.test(before)) return "ref";
  if (REF_AFTER.test(after)) return "ref";
  const start = sentenceStart(t, i);
  const next = /^\s+([A-Za-z0-9$%(][A-Za-z0-9'’-]*)/.exec(after)?.[1] ?? "";
  if (letter !== "A") return start ? "ref" : "unknown";
  if (/^[0-9$(]/.test(next)) return "article";
  if (/^[a-z]/.test(next)) {
    if (AFTER_A.has(next.toLowerCase()) || /ly$/.test(next) || (/s$/.test(next) && !/(ss|us)$/.test(next))) return start ? "ref" : "unknown";
    return "article";
  }
  return "unknown";
}
const MATH_RE = /\$[^$\n]*\$/g;

export function analyze(s: string): Analysis {
  const toks: RefTok[] = []; const uncertain: string[] = [];
  if (!s) return { toks, uncertain };
  const t = s.replace(/\\n/g, "  "); // 문자 그대로의 '\n' 잔재도 줄바꿈으로 본다(같은 길이라 위치 보존)
  const mask = quotedMask(t);
  for (const m of t.matchAll(MATH_RE)) for (let k = m.index!; k < m.index! + m[0].length; k++) mask[k] = true;
  if (((t.match(/"/g) ?? []).length) % 2 === 1) uncertain.push("따옴표 짝 불일치 — 인용 구간 판정 불가");
  for (const m of t.matchAll(TOKEN_RE)) {
    const i = m.index!; if (mask[i]) continue;
    const c = classifyToken(t, i, m[1]);
    if (c === "ref") toks.push({ kind: "letter", index: i, len: 1, idx: LETTERS.indexOf(m[1]), raw: m[1] });
    else if (c === "unknown") uncertain.push(`알 수 없는 글자 토큰 '${m[1]}' — …${t.slice(Math.max(0, i - 12), i + 14).replace(/\s+/g, " ")}…`);
  }
  for (const m of t.matchAll(KO_ORD_RE)) if (!mask[m.index!]) toks.push({ kind: "ordKo", index: m.index!, len: m[0].length, idx: KO_ORD.indexOf(m[1]), raw: m[0] });
  for (const m of t.matchAll(EN_ORD_RE)) if (!mask[m.index!]) toks.push({ kind: "ordEn", index: m.index!, len: m[1].length, idx: EN_ORD.indexOf(m[1].toLowerCase()), raw: m[1] });
  for (const m of t.matchAll(INDEX_RE)) if (!mask[m.index!]) { const d = m.index! + m[0].length - 1; toks.push({ kind: "index", index: d, len: 1, idx: Number(m[1]), raw: m[1] }); }
  if (UNCERTAIN_RE.test(t)) uncertain.push("상대 위치 표현(마지막·이전·위 선택지)");
  if (NUMERIC_POS_RE.test(t.replace(INDEX_RE, "인덱스#"))) uncertain.push("숫자 위치 지칭(0기반·1기반 혼재 — 'N번', '선택지 N·M')");
  if (EXTRA_LETTER_RE.test(t)) uncertain.push("존재하지 않는 선택지 글자(E 이상) 언급");
  toks.sort((a, b) => a.index - b.index);
  return { toks, uncertain };
}

/** perm[newIndex]=oldIndex 일 때 옛 위치 → 새 위치. */
export const newPosOf = (perm: number[], oldIdx: number) => perm.indexOf(oldIdx);

const caseLike = (from: string, to: string) => (from[0] === from[0].toUpperCase() && /[A-Za-z]/.test(from[0]) ? to[0].toUpperCase() + to.slice(1) : to);

export function remapAll(s: string, perm: number[]): { text: string; uncertain: string[]; changed: number } {
  const a = analyze(s); let out = s;
  for (const t of [...a.toks].reverse()) {
    const np = newPosOf(perm, t.idx);
    let rep: string;
    if (t.kind === "letter") rep = LETTERS[np];
    else if (t.kind === "index") rep = String(np);
    else if (t.kind === "ordKo") rep = t.raw.replace(/^(첫|두|세|네)/, KO_ORD[np]);
    else rep = caseLike(t.raw, EN_ORD[np]);
    out = out.slice(0, t.index) + rep + out.slice(t.index + t.len);
  }
  return { text: out, uncertain: a.uncertain, changed: a.toks.length };
}

/** 해설이 '정답'으로 지목하는 위치(0~3) 목록. */
export function statedCorrect(s: string): number[] {
  const out: number[] = [];
  if (!s) return out;
  const L = (x: string) => LETTERS.indexOf(x);
  for (const re of [/정답(?:은|:|는)?\s*(?:선택지\s*)?([A-D])(?![A-Za-z0-9])/g, /(?:correct answer is|answer is|correct choice is|correct option is)\s+(?:choice\s+|option\s+)?([A-D])(?![A-Za-z0-9])/gi, /making\s+([A-D])\s+(?:the\s+)?correct/gi, /(?:choice|option)\s+([A-D])\s+is\s+correct/gi, /(?<![A-Za-z0-9])([A-D])(?:번|는|가)?\s*(?:이|가)?\s*정답/g])
    for (const m of s.matchAll(re)) out.push(L(m[1].toUpperCase()));
  for (const m of s.matchAll(/정답[^.\n]{0,12}인덱스\s*(\d)/g)) out.push(Number(m[1]));
  for (const m of s.matchAll(/정답은\s*(첫|두|세|네)\s?번째/g)) out.push(KO_ORD.indexOf(m[1]));
  for (const m of s.matchAll(/(첫|두|세|네)\s?번째\s?(?:선택지|보기)(?:가|이)?\s*정답/g)) out.push(KO_ORD.indexOf(m[1]));
  for (const m of s.matchAll(/(first|second|third|fourth)\s+(?:option|choice)\s+as\s+correct/gi)) out.push(EN_ORD.indexOf(m[1].toLowerCase()));
  return out;
}

export type AuditInput = {
  options: string[]; origIndex: number; newIndex: number; perm: number[];
  before: { options: string[]; explanation: string; explanationEn: string | null };
  after: { options: string[]; correctIndex: number; explanation: string; explanationEn: string | null };
};
const strip = (s: string | null) => { if (!s) return ""; const a = analyze(s); let o = s; for (const t of [...a.toks].reverse()) o = o.slice(0, t.index) + "·" + o.slice(t.index + t.len); return o; };

/** 정적 감사: 실패 사유 목록(비어 있으면 통과). 순열 보존·정답 내용 동일성·참조 서열 사상·서수 잔존·정답 지목·비참조 본문 불변. */
export function staticAudit(e: AuditInput): string[] {
  const f: string[] = [];
  const { perm, before, after } = e;
  if (!(perm.length === 4 && [...perm].sort().join() === "0,1,2,3")) f.push("perm 이 순열이 아님");
  else {
    if (!perm.every((old, n) => after.options[n] === before.options[old])) f.push("선택지가 기존의 순열이 아님");
    if (after.options[after.correctIndex] !== before.options[e.origIndex]) f.push("정답 선택지 내용이 달라짐");
    if (perm[after.correctIndex] !== e.origIndex || after.correctIndex !== e.newIndex) f.push("정답 위치 불일치");
  }
  for (const [name, b, a] of [["ko", before.explanation, after.explanation], ["en", before.explanationEn, after.explanationEn]] as const) {
    if (b === null && a === null) continue;
    const ab = analyze(b ?? ""), aa = analyze(a ?? "");
    if (ab.uncertain.length) f.push(`${name}: 불확실 — ${ab.uncertain[0]}`);
    if (aa.uncertain.length) f.push(`${name}: 새 해설에서 불확실 — ${aa.uncertain[0]}`);
    if (ab.toks.length !== aa.toks.length) f.push(`${name}: 참조 개수 변화 ${ab.toks.length}→${aa.toks.length}`);
    else ab.toks.forEach((t, i) => { const x = aa.toks[i]; if (x.kind !== t.kind || x.idx !== newPosOf(perm, t.idx)) f.push(`${name}: 참조 ${i + 1}번이 새 순서와 어긋남(${t.raw}→${x.raw})`); });
    if (strip(b) !== strip(a)) f.push(`${name}: 참조 외 본문이 달라짐`);
    const sb = statedCorrect(b ?? ""), sa = statedCorrect(a ?? "");
    if (sb.some((x) => x !== e.origIndex)) f.push(`${name}: 원 해설의 정답 지목이 원 정답과 다름(기존 결함)`);
    // 새 정답을 오답처럼 서술하는 문장(정답·correct 언급 없이 오답·틀림 서술)
    for (const sent of (a ?? "").split(/(?<=[.!?。])\s+|\n+|\\n/)) {
      const toks = analyze(sent).toks.filter((t) => t.kind === "letter" && t.idx === e.newIndex);
      if (toks.length && /(오답|틀린|틀리|잘못|incorrect|wrong|fails?\b)/i.test(sent) && !/(정답|correct(?!ly)|맞)/i.test(sent)) f.push(`${name}: 새 정답을 오답처럼 서술(${sent.slice(0, 40)})`);
    }
    if (sa.some((x) => x !== e.newIndex)) f.push(`${name}: 새 해설의 정답 지목이 새 정답 위치와 다름`);
  }
  return f;
}
