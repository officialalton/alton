// 실제 작품(공유 영역) 기반 AP English Literature 세트의 순수 함수(2026-10-15). 지문은 출처 등록부의 저장 텍스트에서 코드가 고정한다 — 모델은 지문을 쓰지 않고
// 확정된 텍스트에서 스킬·문항·정답 근거·오답 근거를 설계한다. 근거 구절의 줄·연·문단 위치는 코드가 계산한다(모델은 줄 번호를 쓰지 않는다).
import { REAL_TEXT_MARKER } from "../ap-exam/stimulus-display";
import { PASSAGE_FENCE, countedLines, flatWithBreaks, locateQuote, rangeText } from "../ap-exam/passage-lines";
import { itemViolations, proseStanzas, resolveItem, type LtItemRaw, type LtOptionRaw, type LtSetRaw } from "./englit-gates";
import { parseStoredText, type SourceEntry } from "./englit-sources";

export type RealOption = LtOptionRaw & { evidence_quote: string; evidence_kind: "text" | "absence" };
export type RealItemRaw = Omit<LtItemRaw, "options"> & { options: RealOption[] };
export const groupOfEntry = (e: Pick<SourceEntry, "genre">): "poetry" | "short" | "longer" => (e.genre === "poetry" ? "poetry" : e.genre === "drama" ? "longer" : "short");

/** 학생 화면에 보이는 머리글(저자·연도·번역자·발췌 여부). 표지(REAL_TEXT_MARKER)는 realDisplay 가 붙인다. */
export function realHeadnote(e: SourceEntry): string {
  const by = e.translator ? `${e.author}, translated by ${e.translator}` : e.author;
  const kind = e.form === "poem" ? "poem" : e.form === "drama" ? "scene from a play" : "passage from a short story";
  return `The following ${kind} is by ${by} (${e.year_first_published}).${e.excerpt.whole_work ? "" : " This is an excerpt."}`;
}
export function realStanzas(e: SourceEntry, storedText: string): string[][] {
  const units = parseStoredText(storedText, e.form);
  return e.form === "poem" ? units : proseStanzas(units.map((u) => u[0]));
}
export function realSet(e: SourceEntry, storedText: string, items: LtSetRaw["items"] = []): LtSetRaw {
  return { group: groupOfEntry(e), form: e.form === "poem" ? "poem" : e.form === "drama" ? "drama" : "prose", title: e.title, headnote: realHeadnote(e), blueprint: { devices: [] }, provenance: { kind: "public_domain", author_alias: e.author, year_alias: e.year_first_published, note: `${e.repository} ${e.url}` }, stanzas: realStanzas(e, storedText), items };
}
/** 학생 화면용 지문 문자열: 표지 + 제목 + 저자 + 머리글 + 줄 번호 펜스. */
export function realDisplay(set: Pick<LtSetRaw, "title" | "headnote" | "stanzas"> & { provenance: { author_alias: string } }, e: SourceEntry): string {
  const credit = [`by ${set.provenance.author_alias}${e.translator ? `, translated by ${e.translator}` : ""}`, set.headnote?.trim() ?? ""].filter(Boolean).join("\n");
  return [realAttribution(e), set.title.trim(), credit, "", "```" + PASSAGE_FENCE, ...flatWithBreaks(set.stanzas), "```"].join("\n");
}
/** 저장소 안내("Gutenberg eBook #…")를 뺀 짧은 판본 표기. */
export const shortEdition = (e: Pick<SourceEntry, "edition">): string => e.edition.split(/,? (?:as in )?Gutenberg eBook/)[0].replace(/\.$/, "").trim();
/** 지문 맨 윗줄(2026-10-15 Stage 1): "Public-domain source text — <저자>, <작품>, <판본>". 표지 문구(REAL_TEXT_MARKER)로 시작해 영어 지문으로 인식된다. */
export const realAttribution = (e: Pick<SourceEntry, "author" | "title" | "edition">): string => `${REAL_TEXT_MARKER} — ${e.author}, ${e.title}, ${shortEdition(e)}`;
/** 줄 번호(세는 줄 기준 1부터) → 연(시) 또는 문단(산문) 번호(1부터). */
export function unitOfLine(stanzas: string[][], line: number): number {
  let n = 0; for (let i = 0; i < stanzas.length; i++) { n += stanzas[i].filter((l) => l.trim() !== "").length; if (line <= n) return i + 1; } return stanzas.length;
}
export type Located = { quote: string; from: number; to: number; ref: string; unit: string };
export function locate(set: Pick<LtSetRaw, "stanzas" | "form">, quote: string): Located | { error: string } {
  const r = locateQuote(set.stanzas, quote); if (!r.ok) return { error: r.reason };
  const unit = set.form === "poem" ? "stanza" : "paragraph"; const a = unitOfLine(set.stanzas, r.from), b = unitOfLine(set.stanzas, r.to);
  return { quote, from: r.from, to: r.to, ref: rangeText(r.from, r.to), unit: a === b ? `${unit} ${a}` : `${unit}s ${a}-${b}` };
}
export type ResolvedEvidence = { key: Located | null; distractors: { index: number; label: string; why: string; kind: "text" | "absence"; located: Located | null }[]; violations: string[] };
/** 정답 근거는 지문 인용 필수(코드가 위치 계산), 오답은 반박 인용 또는 '지문에 없음'(absence) 중 하나를 명시해야 한다. */
export function resolveEvidence(set: Pick<LtSetRaw, "stanzas" | "form">, it: RealItemRaw): ResolvedEvidence {
  const violations: string[] = []; let key: Located | null = null; const distractors: ResolvedEvidence["distractors"] = [];
  it.options.forEach((o, i) => {
    if (o.is_key) { const l = o.evidence_quote?.trim() ? locate(set, o.evidence_quote) : { error: "missing" }; if ("error" in l) violations.push(`key_evidence_${l.error}`); else key = l; return; }
    const kind = o.evidence_kind === "absence" ? "absence" : "text"; let located: Located | null = null;
    if (kind === "text") { const l = o.evidence_quote?.trim() ? locate(set, o.evidence_quote) : { error: "missing" }; if ("error" in l) violations.push(`distractor_${i}_evidence_${l.error}`); else located = l; }
    else if (o.evidence_quote?.trim()) violations.push(`distractor_${i}_absence_with_quote`);
    distractors.push({ index: i, label: o.label, why: o.why, kind, located });
  });
  if (distractors.filter((d) => d.kind === "text").length < 2) violations.push("fewer_than_2_distractors_with_text_evidence");
  return { key, distractors, violations };
}
export function realItemViolations(set: LtSetRaw, it: RealItemRaw): string[] {
  const base: LtItemRaw = { ...it, options: it.options.map((o) => ({ text: o.text, is_key: o.is_key, label: o.label, why: o.why })) };
  return [...itemViolations(set, base), ...resolveEvidence(set, it).violations];
}
export const toBase = (it: RealItemRaw): LtItemRaw => ({ ...it, options: it.options.map((o) => ({ text: o.text, is_key: o.is_key, label: o.label, why: o.why })) });
export const resolveRealItem = (set: LtSetRaw, it: RealItemRaw) => resolveItem(set, toBase(it));
export { countedLines };
