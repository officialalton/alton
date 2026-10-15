// AP English Literature 실제 작품 출처 등록부(2026-10-15 오너 정책: 재사용 권리가 확인된 실제 작품 보강). 순수 함수 — 파일 I/O 는 호출자가 한다.
// 원칙: 텍스트는 권위 있는 저장소의 원문에서 코드로 잘라낸다(기억에서 옮기지 않는다). 등록부에는 제목·저자·연도/판본·저장소·URL·재사용 근거·발췌 경계·변경 사항·sha256 을 남긴다.
import { createHash } from "node:crypto";

export type SourceGenre = "poetry" | "short_fiction" | "drama";
export type SourceEntry = {
  id: string; title: string; author: string; translator?: string; genre: SourceGenre; form: "poem" | "prose" | "drama";
  year_first_published: number; edition: string; period: string; region: string; perspective: string;
  repository: string; url: string; retrieved: string; raw_sha256: string; raw_bytes: number; raw_line_range: [number, number];
  reuse_basis: string; excerpt: { unit: "line" | "paragraph" | "speech"; from: number; to: number; whole_work: boolean; note: string };
  modifications: string[]; text_file: string; text_sha256: string; word_count: number; counted_line_count: number; unit_count: number;
};
export type Registry = { schema: "englit-sources-1"; created: string; policy: string; entries: SourceEntry[] };

export const sha256 = (s: string | Buffer): string => createHash("sha256").update(s).digest("hex");

/** Gutenberg 의 `_italic_` 표기를 벗긴다(변경 사항으로 기록). */
export const stripUnderscoreItalics = (s: string): string => s.replace(/_([^_\n]+)_/g, "$1");

/** 시: 원문 줄 범위(1-기준, 포함)를 잘라 연 배열로. runover = 앞줄에 이어 붙일 원문 줄 번호(저장소가 긴 줄을 접어 둔 것). 들여쓰기는 제거한다. */
export function extractPoem(rawLines: string[], from: number, to: number, runover: number[] = [], keepIndent = false): { stanzas: string[][]; merged: number } {
  const stanzas: string[][] = []; let cur: string[] = []; let merged = 0; const ro = new Set(runover);
  const indentOf = (l: string) => (l.replace(/\r$/, "").match(/^ */) ?? [""])[0].length;
  const base = Math.min(...Array.from({ length: to - from + 1 }, (_, i) => rawLines[from - 1 + i] ?? "").filter((l, i) => l.trim() !== "" && !ro.has(from + i)).map(indentOf));
  for (let n = from; n <= to; n++) {
    const raw = (rawLines[n - 1] ?? "").replace(/\r$/, ""); const t = raw.trim();
    if (t === "") { if (cur.length) { stanzas.push(cur); cur = []; } continue; }
    if (ro.has(n)) { if (!cur.length) throw new Error(`runover line ${n} has no previous line`); cur[cur.length - 1] = `${cur[cur.length - 1]} ${t}`; merged++; continue; }
    cur.push(keepIndent ? `${" ".repeat(Math.max(0, indentOf(raw) - base))}${t}` : t);
  }
  if (cur.length) stanzas.push(cur); return { stanzas, merged };
}
/** 산문: 원문 줄 범위를 빈 줄 기준 문단으로(접힌 줄은 공백 하나로 합친다). */
export function extractParagraphs(rawLines: string[], from: number, to: number): string[] {
  const out: string[] = []; let cur: string[] = [];
  for (let n = from; n <= to; n++) { const t = (rawLines[n - 1] ?? "").replace(/\r$/, "").trim(); if (t === "") { if (cur.length) { out.push(cur.join(" ")); cur = []; } } else cur.push(t); }
  if (cur.length) out.push(cur.join(" ")); return out;
}
/** 희곡: 화자 이름만 있는 줄 + 대사 → "NAME. text" 한 문단. */
export function extractDrama(rawLines: string[], from: number, to: number): string[] {
  const groups: string[][] = []; let cur: string[] = [];
  for (let n = from; n <= to; n++) { const t = (rawLines[n - 1] ?? "").trim(); if (!t) { if (cur.length) { groups.push(cur); cur = []; } } else cur.push(t); }
  if (cur.length) groups.push(cur);
  return groups.map((g) => (/^[A-Z][A-Z .]{1,24}\.?$/.test(g[0]) && g.length > 1 ? `${g[0].replace(/\.$/, "")}. ${g.slice(1).join(" ")}` : g.join(" ")));
}
/** 저장 형식: 시 = 줄마다 한 줄, 연 사이 빈 줄 / 산문·희곡 = 문단마다 한 줄, 문단 사이 빈 줄. */
export const serializeText = (units: string[][] | string[]): string => (Array.isArray(units[0]) ? (units as string[][]).map((s) => s.join("\n")).join("\n\n") : (units as string[]).join("\n\n")) + "\n";
export function parseStoredText(text: string, form: "poem" | "prose" | "drama"): string[][] {
  const blocks = text.replace(/\n+$/g, "").split(/\n{2,}/).map((b) => b.split("\n").filter((l) => l.trim() !== ""));
  return form === "poem" ? blocks : blocks.map((b) => [b.join(" ")]);
}
export const wordCount = (s: string): number => (s.match(/\S+/g) ?? []).length;

const MAX_PD_YEAR = 1928; // 미국: 1929 이전 발행 = 공유 영역(2026-10 기준 1930년 이후 발행작은 별도 확인 없이 쓰지 않는다)
export function validateEntry(e: SourceEntry, storedText: string): string[] {
  const v: string[] = [];
  if (sha256(storedText) !== e.text_sha256) v.push("text_sha256_mismatch");
  if (!/^[0-9a-f]{64}$/.test(e.raw_sha256)) v.push("raw_sha256_invalid");
  if (e.year_first_published > MAX_PD_YEAR) v.push("published_after_1928_needs_explicit_pd_statement");
  if (!/^https:\/\/(www\.)?(gutenberg\.org|en\.wikisource\.org|wikisource\.org|www\.loc\.gov|loc\.gov|archive\.org)\//.test(e.url)) v.push("url_not_authorized_repository");
  if (!e.reuse_basis.trim()) v.push("reuse_basis_missing");
  if (!e.edition.trim() || !e.modifications) v.push("edition_or_modifications_missing");
  const units = parseStoredText(storedText, e.form); const lineCount = units.flat().length;
  if (e.form === "poem" && lineCount !== e.counted_line_count) v.push(`line_count_${lineCount}_vs_${e.counted_line_count}`);
  if (e.form !== "poem" && units.length !== e.unit_count) v.push(`paragraph_count_${units.length}_vs_${e.unit_count}`);
  if (wordCount(storedText) !== e.word_count) v.push("word_count_mismatch");
  if (/_/.test(storedText)) v.push("underscore_markup_left");
  return v;
}
