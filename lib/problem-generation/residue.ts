// 생성 잔재 검사(2026-10-01) — 해설·본문·선택지에 생성 도구 마크업이나 내부 메모가 섞여 학생 화면에 노출되는 것을 막는다.
// 허용 태그: 밑줄·서식(<u> <b> <i> <em> <strong> <sub> <sup> <br>). 그 밖의 태그형 문자열(</explanation>, <parameter name=…>, </passage>, </note> 등)과 내부 메모 문구는 잔재.
const ALLOWED_TAGS = new Set(["u", "b", "i", "em", "strong", "sub", "sup", "br"]);
const TAG_RE = /<\/?([A-Za-z_][A-Za-z0-9_\-]*)(?:\s[^<>]{0,120})?\/?>/g;
const MEMO_RES: [string, RegExp][] = [
  ["내부 설계 필드명", /hard_design|design_rationale|distractorErrorTypes|answerRationale|evidenceSpan/],
  ["작성 메모(필요 없으므로 …)", /필요\s*없으므로/],
  ["도구 호출 흔적", /antml|function_calls|<!\[CDATA\[|\bparameter name=/],
  ["TODO/메모 표식", /\b(?:TODO|FIXME|XXX)\b|\[(?:메모|NOTE|TBD)[^\]]*\]/],
];
import { findHangulInStem } from "../problem-text-guards";

export type Residue = { field: string; match: string; kind: string };
export type CheckableProblem = { passage?: string | null; stimulus?: string | null; question?: string | null; options?: string[] | null; explanation?: string | null; explanationEn?: string | null; statements?: string[] | null };

export function residueInText(text: string | null | undefined): { match: string; kind: string }[] {
  const out: { match: string; kind: string }[] = [];
  if (!text) return out;
  for (const m of text.matchAll(TAG_RE)) if (!ALLOWED_TAGS.has(m[1].toLowerCase())) out.push({ match: m[0].slice(0, 60), kind: "허용되지 않은 태그" });
  for (const [kind, re] of MEMO_RES) { const m = re.exec(text); if (m) out.push({ match: m[0].slice(0, 60), kind }); }
  return out;
}
export function findResidue(p: CheckableProblem): Residue[] {
  const out: Residue[] = [];
  const add = (field: string, t: string | null | undefined) => { for (const r of residueInText(t)) out.push({ field, ...r }); };
  add("passage", p.passage); add("stimulus", p.stimulus); add("question", p.question);
  (p.options ?? []).forEach((o, i) => add(`options[${i}]`, o));
  (p.statements ?? []).forEach((o, i) => add(`statements[${i}]`, o));
  add("explanation", p.explanation); add("explanationEn", p.explanationEn);
  // 2026-10-02 UAT C1 — 영어 시험 문항의 지문·질문·선택지·진술에 한글이 있으면 거부(해설은 한국어 허용).
  for (const field of findHangulInStem(p)) out.push({ field, match: (fieldText(p, field) ?? "").slice(0, 60), kind: "영어 문항 본문에 한글" });
  return out;
}

function fieldText(p: CheckableProblem, field: string): string | null | undefined {
  const m = /^(options|statements)\[(\d+)\]$/.exec(field);
  if (m) return (p[m[1] as "options" | "statements"] ?? [])[Number(m[2])];
  return p[field as "passage" | "stimulus" | "question"];
}
