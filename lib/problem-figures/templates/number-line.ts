// 표준 렌더링 엔진 — 수직선(number_line): 점·구간·반직선(부등식 해집합, 그럴듯한 구간)을 균일한 눈금 위에 그린다.
// 눈금은 axisMin 부터 step 간격으로 일정하고, 항목은 눈금 위에 굵은 선분(구간·반직선)과 점(속이 찬 점 = 포함, 빈 점 = 불포함)으로 놓인다.
// 항목 좌표 이름은 일부러 at / lo / hi 다 — 자료 변조 도구(tamperFigure)가 수치 필드로 인식하고, 축 범위(axisMin/axisMax)는 건드리지 않는다.

import { dedupe, esc, f, FONT, labelWidth, Sheet, type FigureIssue } from "./_layout";

export type NumberLineItem =
  | { kind: "point"; at: number; open?: boolean; label?: string }
  | { kind: "interval"; lo: number; hi: number; loOpen?: boolean; hiOpen?: boolean }
  | { kind: "ray"; at: number; dir: "left" | "right"; open?: boolean };

export type NumberLineSpec = {
  type: "number_line";
  axisMin: number;
  axisMax: number;
  /** 눈금 간격(모든 눈금은 이 간격으로 균일). */
  step: number;
  /** 숫자는 이 눈금 개수마다 하나씩 쓴다(기본: 겹치지 않게 자동). */
  labelEvery?: number;
  items: NumberLineItem[];
  title?: string;
  /** 축 끝 옆의 변수 이름(예: x). */
  varName?: string;
};

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const W = 440;
const X_MIN = 56, X_MAX = W - 56;
export const NL = { W, X_MIN, X_MAX, DOT_R: 5.5, SEG_W: 4.5 } as const;

export function numberLineTicks(spec: Pick<NumberLineSpec, "axisMin" | "axisMax" | "step">): number[] {
  const out: number[] = [];
  const n = Math.round((spec.axisMax - spec.axisMin) / spec.step);
  for (let i = 0; i <= n; i++) out.push(Math.round((spec.axisMin + i * spec.step) * 1e6) / 1e6);
  return out;
}

export function validateNumberLine(input: unknown): { ok: true; spec: NumberLineSpec } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "그림 데이터가 객체가 아닙니다." };
  const s = input as Record<string, unknown>;
  if (s.type !== "number_line") return { ok: false, error: "type 이 number_line 이 아닙니다." };
  if (!isNum(s.axisMin) || !isNum(s.axisMax) || s.axisMin >= s.axisMax) return { ok: false, error: "number_line 은 axisMin < axisMax 숫자가 필요합니다." };
  if (!isNum(s.step) || s.step <= 0) return { ok: false, error: "number_line 의 step 은 0 보다 큰 숫자입니다." };
  const n = (s.axisMax - s.axisMin) / s.step;
  if (Math.abs(n - Math.round(n)) > 1e-9) return { ok: false, error: "number_line 의 (axisMax − axisMin) 은 step 의 정수배여야 합니다(눈금이 균일해야 함)." };
  if (n < 2 || n > 40) return { ok: false, error: "number_line 의 눈금은 3~41개여야 합니다." };
  if (s.labelEvery !== undefined && (!Number.isInteger(s.labelEvery) || (s.labelEvery as number) < 1)) return { ok: false, error: "labelEvery 는 1 이상의 정수입니다." };
  if (s.title !== undefined && (typeof s.title !== "string" || !s.title.trim() || s.title.length > 70)) return { ok: false, error: "title 은 70자 이내 문자열입니다." };
  if (s.varName !== undefined && (typeof s.varName !== "string" || !s.varName.trim() || s.varName.length > 4)) return { ok: false, error: "varName 은 4자 이내 문자열입니다." };
  if (!Array.isArray(s.items) || s.items.length < 1 || s.items.length > 4) return { ok: false, error: "number_line 은 items 1~4개가 필요합니다." };
  const inR = (v: unknown): v is number => isNum(v) && v >= (s.axisMin as number) - 1e-9 && v <= (s.axisMax as number) + 1e-9;
  for (const it of s.items as Record<string, unknown>[]) {
    if (!it || typeof it !== "object") return { ok: false, error: "items 항목이 객체가 아닙니다." };
    if (it.kind === "point") {
      if (!inR(it.at)) return { ok: false, error: "point 의 at 은 축 범위 안의 숫자입니다." };
      if (it.label !== undefined && (typeof it.label !== "string" || !it.label.trim() || it.label.length > 16)) return { ok: false, error: "point.label 은 16자 이내 문자열입니다." };
    } else if (it.kind === "interval") {
      if (!inR(it.lo) || !inR(it.hi) || it.lo >= it.hi) return { ok: false, error: "interval 은 축 범위 안의 lo < hi 숫자가 필요합니다." };
    } else if (it.kind === "ray") {
      if (!inR(it.at) || (it.dir !== "left" && it.dir !== "right")) return { ok: false, error: "ray 는 축 범위 안의 at 과 dir('left'|'right') 가 필요합니다." };
    } else return { ok: false, error: `알 수 없는 number_line 항목 kind: ${String(it.kind)}` };
  }
  return { ok: true, spec: s as unknown as NumberLineSpec };
}

const sx = (spec: NumberLineSpec, v: number) => X_MIN + ((v - spec.axisMin) / (spec.axisMax - spec.axisMin)) * (X_MAX - X_MIN);

export function renderNumberLine(spec: NumberLineSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  const issues: FigureIssue[] = [];
  const titleH = spec.title ? 22 : 0;
  const hasLabel = spec.items.some((i) => i.kind === "point" && i.label);
  const axisY = 34 + titleH + (hasLabel ? 12 : 0);
  const H = axisY + 40;
  const sheet = new Sheet(W, H);
  if (spec.title) sheet.text(W / 2, 14, spec.title, { size: spec.title.length > 40 ? 11 : 14, anchor: "middle" });
  const ticks = numberLineTicks(spec);
  // 축(양 끝 화살표) — 선분으로 등록해 라벨 충돌을 본다.
  sheet.raw(`<line x1="26" y1="${f(axisY)}" x2="${W - 26}" y2="${f(axisY)}" stroke="#111" stroke-width="1.6"/>`);
  sheet.raw(`<polygon points="14,${f(axisY)} 26,${f(axisY - 5)} 26,${f(axisY + 5)}" fill="#111"/><polygon points="${W - 14},${f(axisY)} ${W - 26},${f(axisY - 5)} ${W - 26},${f(axisY + 5)}" fill="#111"/>`);
  sheet.registerSegment([26, axisY], [W - 26, axisY]);
  // 숫자: 이웃한 숫자 사이가 넉넉하도록 labelEvery 를 정한다(지정이 있으면 그대로).
  const widest = Math.max(...ticks.map((t) => labelWidth(String(t), 12)));
  const slot = (X_MAX - X_MIN) / (ticks.length - 1);
  const auto = Math.max(1, Math.ceil((widest + 6) / slot));
  const every = spec.labelEvery ?? auto;
  if (slot * every < widest + 2) issues.push({ code: "label_collision", message: "수직선의 눈금 숫자가 서로 겹칩니다 — labelEvery 를 키우거나 눈금을 줄이세요." });
  ticks.forEach((t, i) => {
    const x = sx(spec, t);
    sheet.raw(`<line x1="${f(x)}" y1="${f(axisY - 5)}" x2="${f(x)}" y2="${f(axisY + 5)}" stroke="#111" stroke-width="1.4"/>`);
    if (i % every === 0) sheet.raw(`<text x="${f(x)}" y="${f(axisY + 24)}" font-family="${FONT}" font-size="12" text-anchor="middle" fill="#111">${esc(String(t))}</text>`);
  });
  if (spec.varName) sheet.raw(`<text x="${W - 12}" y="${f(axisY - 12)}" font-family="${FONT}" font-size="13" font-style="italic" text-anchor="end" fill="#111">${esc(spec.varName)}</text>`);
  // 항목: 굵은 선분 먼저, 점은 그 위에.
  const dots: string[] = [];
  const dot = (v: number, open: boolean) => dots.push(`<circle cx="${f(sx(spec, v))}" cy="${f(axisY)}" r="${NL.DOT_R}" fill="${open ? "#fff" : "#111"}" stroke="#111" stroke-width="2" data-nl="${open ? "open" : "closed"}"/>`);
  const seg = (a: number, b: number) => sheet.raw(`<line x1="${f(a)}" y1="${f(axisY)}" x2="${f(b)}" y2="${f(axisY)}" stroke="#111" stroke-width="${NL.SEG_W}" stroke-linecap="butt" data-nl="segment"/>`);
  const desc: string[] = [];
  for (const it of spec.items) {
    if (it.kind === "interval") { seg(sx(spec, it.lo), sx(spec, it.hi)); dot(it.lo, !!it.loOpen); dot(it.hi, !!it.hiOpen); desc.push(`${it.lo}${it.loOpen ? "(빈 점)" : "(찬 점)"}부터 ${it.hi}${it.hiOpen ? "(빈 점)" : "(찬 점)"}까지 굵은 선`); }
    else if (it.kind === "ray") { seg(sx(spec, it.at), it.dir === "right" ? W - 26 : 26); dot(it.at, !!it.open); desc.push(`${it.at}${it.open ? "(빈 점)" : "(찬 점)"}에서 ${it.dir === "right" ? "오른쪽" : "왼쪽"}으로 화살표 방향 굵은 선`); }
    else { dot(it.at, !!it.open); desc.push(`${it.at}에 ${it.open ? "빈" : "찬"} 점${it.label ? ` '${it.label}'` : ""}`); }
  }
  sheet.raw(dots.join(""));
  for (const it of spec.items) if (it.kind === "point" && it.label) sheet.label(sx(spec, it.at), axisY - 20, it.label, "점 이름", { size: 14, italic: true });
  const alt = `${spec.title ? spec.title + " — " : ""}수직선(${ticks[0]}~${ticks[ticks.length - 1]}, 눈금 간격 ${spec.step}): ${desc.join("; ")}.`;
  return { svg: sheet.svg(alt), alt, issues: dedupe([...issues, ...sheet.uniqueIssues()]) };
}

/** 지문 참조 검사 — 수직선은 값이 자료에만 있어야 한다는 규칙은 생성기가 지키고, 여기서는 배치 용어만 본다. */
export function lintNumberLineAgainstText(_spec: NumberLineSpec, passage: string): FigureIssue[] {
  const issues: FigureIssue[] = [];
  if (/\b(northeast|northwest|southeast|southwest|region)\b/i.test(passage)) issues.push({ code: "wording", message: "지문에 배치 용어(region 등)가 있습니다." });
  return issues;
}
