// 표준 렌더링 엔진 — 줄기-잎 그림(stem_leaf): 줄기 열 + 오름차순 잎 + 범례(Key).
// 값 = 줄기 × stemUnit + 잎 × (stemUnit / 10). stemUnit 10 이면 "3 | 4 = 34", 1 이면 "3 | 4 = 3.4".
// 잎은 각 줄기 안에서 작은 수부터 정렬되어 있어야 하고(SAT 관례), 줄기는 비는 줄 없이 이어진다(빈 줄기는 잎이 없는 줄로 그린다).

import { dedupe, esc, f, FONT, labelWidth, Sheet, type FigureIssue } from "./_layout";

export type StemLeafSpec = {
  type: "stem_leaf";
  title?: string;
  stems: { stem: number; leaves: number[] }[];
  /** 줄기 한 칸의 크기: 10(정수 값) 또는 1(소수 첫째 자리). */
  stemUnit: 10 | 1;
  /** 값의 단위(Key 뒤에 붙임). 예: "minutes". */
  unit?: string;
};

const isInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);
export const slValue = (spec: Pick<StemLeafSpec, "stemUnit">, stem: number, leaf: number) => Math.round((stem * spec.stemUnit + (leaf * spec.stemUnit) / 10) * 1e6) / 1e6;
/** 모든 값(오름차순). */
export function stemLeafValues(spec: StemLeafSpec): number[] {
  return spec.stems.flatMap((s) => s.leaves.map((l) => slValue(spec, s.stem, l))).sort((a, b) => a - b);
}
/** Key 문구 — 첫 잎이 있는 줄기에서 만든다. */
export function slKey(spec: StemLeafSpec): string {
  const s = spec.stems.find((x) => x.leaves.length) ?? spec.stems[0];
  const l = s.leaves[0] ?? 0;
  return `Key: ${s.stem} | ${l} = ${slValue(spec, s.stem, l)}${spec.unit ? ` ${spec.unit}` : ""}`;
}

export function validateStemLeaf(input: unknown): { ok: true; spec: StemLeafSpec } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "그림 데이터가 객체가 아닙니다." };
  const s = input as Record<string, unknown>;
  if (s.type !== "stem_leaf") return { ok: false, error: "type 이 stem_leaf 가 아닙니다." };
  if (s.stemUnit !== 10 && s.stemUnit !== 1) return { ok: false, error: "stem_leaf 의 stemUnit 은 10 또는 1 입니다." };
  if (s.title !== undefined && (typeof s.title !== "string" || !s.title.trim() || s.title.length > 70)) return { ok: false, error: "title 은 70자 이내 문자열입니다." };
  if (s.unit !== undefined && (typeof s.unit !== "string" || !s.unit.trim() || s.unit.length > 24)) return { ok: false, error: "unit 은 24자 이내 문자열입니다." };
  if (!Array.isArray(s.stems) || s.stems.length < 2 || s.stems.length > 12) return { ok: false, error: "stem_leaf 는 stems 2~12줄이 필요합니다." };
  let prev: number | null = null; let total = 0;
  for (const r of s.stems as Record<string, unknown>[]) {
    if (!r || !isInt(r.stem) || r.stem < 0) return { ok: false, error: "stems[].stem 은 0 이상의 정수입니다." };
    if (prev !== null && r.stem !== prev + 1) return { ok: false, error: "stem_leaf 의 줄기는 빈 줄 없이 1 씩 커지며 이어져야 합니다." };
    prev = r.stem;
    if (!Array.isArray(r.leaves) || r.leaves.length > 16 || !r.leaves.every((l) => isInt(l) && l >= 0 && l <= 9)) return { ok: false, error: "stems[].leaves 는 0~9 정수 16개 이하입니다." };
    for (let i = 1; i < r.leaves.length; i++) if ((r.leaves as number[])[i] < (r.leaves as number[])[i - 1]) return { ok: false, error: "잎은 각 줄기 안에서 오름차순이어야 합니다." };
    total += r.leaves.length;
  }
  if (total < 4 || total > 60) return { ok: false, error: "stem_leaf 의 값은 4~60개입니다." };
  return { ok: true, spec: s as unknown as StemLeafSpec };
}

export function renderStemLeaf(spec: StemLeafSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  const issues: FigureIssue[] = [];
  const rowH = 24, titleH = spec.title ? 24 : 0;
  const key = slKey(spec);
  const stemW = Math.max(...spec.stems.map((s) => labelWidth(String(s.stem), 15)));
  const maxLeaves = Math.max(...spec.stems.map((s) => s.leaves.length));
  const leafStep = 15;
  const divX = 36 + stemW + 10;
  const W = Math.max(230, Math.min(440, Math.round(Math.max(divX + 18 + maxLeaves * leafStep + 16, labelWidth(key, 13) + 40))));
  const top = 14 + titleH;
  const H = top + 30 + spec.stems.length * rowH + 40;
  const sheet = new Sheet(W, H);
  if (spec.title) sheet.text(W / 2, 14, spec.title, { size: spec.title.length > 40 ? 11 : 14, anchor: "middle" });
  sheet.raw(`<text x="${f(divX - 10)}" y="${f(top + 12)}" font-family="${FONT}" font-size="13" font-weight="700" text-anchor="end" fill="#111">Stem</text>`);
  sheet.raw(`<text x="${f(divX + 12)}" y="${f(top + 12)}" font-family="${FONT}" font-size="13" font-weight="700" text-anchor="start" fill="#111">Leaf</text>`);
  const y0 = top + 22;
  sheet.raw(`<line x1="${f(divX - 36 - stemW)}" y1="${f(y0)}" x2="${f(W - 12)}" y2="${f(y0)}" stroke="#111" stroke-width="1.2"/>`);
  sheet.raw(`<line x1="${f(divX)}" y1="${f(top)}" x2="${f(divX)}" y2="${f(y0 + spec.stems.length * rowH)}" stroke="#111" stroke-width="1.8"/>`);
  spec.stems.forEach((s, i) => {
    const y = y0 + rowH * i + 17;
    sheet.raw(`<text x="${f(divX - 10)}" y="${f(y)}" font-family="${FONT}" font-size="15" text-anchor="end" fill="#111" data-sl="stem">${s.stem}</text>`);
    if (s.leaves.length) sheet.raw(`<text y="${f(y)}" font-family="${FONT}" font-size="15" text-anchor="middle" fill="#111" data-sl="leaf">${s.leaves.map((l, k) => `<tspan x="${f(divX + 18 + k * leafStep)}">${l}</tspan>`).join("")}</text>`);
  });
  const ky = y0 + spec.stems.length * rowH + 26;
  sheet.raw(`<text x="${f(divX - 36 - stemW + 4)}" y="${f(ky)}" font-family="${FONT}" font-size="13" font-style="italic" text-anchor="start" fill="#111" data-sl="key">${esc(key)}</text>`);
  if (ky + 8 > H) issues.push({ code: "clipped", message: "줄기-잎 그림의 Key 가 그림 밖으로 나갑니다." });
  const alt = `${spec.title ? spec.title + " — " : ""}줄기-잎 그림(${key}). ${spec.stems.map((s) => `${s.stem} | ${s.leaves.join(" ") || "(잎 없음)"}`).join("; ")}.`;
  return { svg: sheet.svg(alt), alt, issues: dedupe([...issues, ...sheet.uniqueIssues()]) };
}

export function lintStemLeafAgainstText(_spec: StemLeafSpec, passage: string): FigureIssue[] {
  const issues: FigureIssue[] = [];
  if (/\b(northeast|northwest|southeast|southwest|region)\b/i.test(passage)) issues.push({ code: "wording", message: "지문에 배치 용어(region 등)가 있습니다." });
  return issues;
}
