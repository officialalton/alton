// 표준 렌더링 엔진 — 원그래프(pie): 각 부채꼴의 중심각이 amount / 전체 에 정확히 비례하고(12시 방향에서 시계 방향), 바깥에 "이름 (값)" 라벨이 붙는다.
// format: percent(값 = 퍼센트, 합 100) · degrees(값 = 중심각, 합 360) · amount(값 = 개수·양, 합 자유). 값이 안 보이는 부채꼴은 shown:false(이름만).
// 슬라이스 값 필드 이름은 일부러 amount — 자료 변조 도구(tamperFigure)가 수치 필드로 인식한다.

import { dedupe, esc, f, FONT, labelWidth, Sheet, type FigureIssue } from "./_layout";

export type PieSpec = {
  type: "pie";
  title?: string;
  slices: { label: string; amount: number; shown?: boolean }[];
  format: "percent" | "degrees" | "amount";
  /** format=amount 일 때 라벨 값 뒤에 붙는 단위(짧게). */
  unit?: string;
};

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
export const PIE = { W: 440, H: 290, R: 82 } as const;
export const PIE_COLORS = ["#1B6FB0", "#C8102E", "#0f7b4a", "#d99a00", "#6a4c93", "#6b7280"];

export function validatePie(input: unknown): { ok: true; spec: PieSpec } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "그림 데이터가 객체가 아닙니다." };
  const s = input as Record<string, unknown>;
  if (s.type !== "pie") return { ok: false, error: "type 이 pie 가 아닙니다." };
  if (!["percent", "degrees", "amount"].includes(String(s.format))) return { ok: false, error: "pie 의 format 은 percent|degrees|amount 입니다." };
  if (s.title !== undefined && (typeof s.title !== "string" || !s.title.trim() || s.title.length > 70)) return { ok: false, error: "title 은 70자 이내 문자열입니다." };
  if (s.unit !== undefined && (typeof s.unit !== "string" || !s.unit.trim() || s.unit.length > 12)) return { ok: false, error: "unit 은 12자 이내 문자열입니다." };
  if (!Array.isArray(s.slices) || s.slices.length < 2 || s.slices.length > 6) return { ok: false, error: "pie 는 slices 2~6개가 필요합니다." };
  for (const sl of s.slices as Record<string, unknown>[]) {
    if (!sl || typeof sl.label !== "string" || !sl.label.trim() || sl.label.length > 28) return { ok: false, error: "slices[].label 은 28자 이내 이름입니다." };
    if (!isNum(sl.amount) || sl.amount <= 0) return { ok: false, error: "slices[].amount 는 0 보다 큰 숫자입니다." };
  }
  const labels = (s.slices as { label: string }[]).map((x) => x.label.trim().toLowerCase());
  if (new Set(labels).size !== labels.length) return { ok: false, error: "pie 의 slices 이름이 중복됩니다." };
  const total = (s.slices as { amount: number }[]).reduce((a, b) => a + b.amount, 0);
  if (s.format === "percent" && Math.abs(total - 100) > 1e-9) return { ok: false, error: `format=percent 이면 amount 의 합이 100 이어야 합니다(현재 ${total}).` };
  if (s.format === "degrees" && Math.abs(total - 360) > 1e-9) return { ok: false, error: `format=degrees 이면 amount 의 합이 360 이어야 합니다(현재 ${total}).` };
  return { ok: true, spec: s as unknown as PieSpec };
}

const fmtNum = (n: number) => (Math.abs(n) >= 1000 ? new Intl.NumberFormat("en-US").format(n) : f(n));
/** 부채꼴 라벨 글. */
export function pieLabelText(spec: PieSpec, i: number): string {
  const sl = spec.slices[i];
  if (sl.shown === false) return sl.label;
  const v = spec.format === "percent" ? `${fmtNum(sl.amount)}%` : spec.format === "degrees" ? `${fmtNum(sl.amount)}°` : `${fmtNum(sl.amount)}${spec.unit ? ` ${spec.unit}` : ""}`;
  return `${sl.label} (${v})`;
}

export function renderPie(spec: PieSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  const issues: FigureIssue[] = [];
  const { W, R } = PIE; const titleH = spec.title ? 22 : 0;
  const H = PIE.H + titleH;
  const cx = W / 2, cy = 142 + titleH;
  const sheet = new Sheet(W, H);
  if (spec.title) sheet.text(W / 2, 14, spec.title, { size: spec.title.length > 40 ? 11 : 14, anchor: "middle" });
  const total = spec.slices.reduce((a, b) => a + b.amount, 0);
  let acc = 0;
  spec.slices.forEach((sl, i) => {
    const a1 = (acc / total) * 2 * Math.PI, a2 = ((acc + sl.amount) / total) * 2 * Math.PI; acc += sl.amount;
    const p = (a: number): [number, number] => [cx + R * Math.sin(a), cy - R * Math.cos(a)];
    const [x1, y1] = p(a1), [x2, y2] = p(a2);
    const large = a2 - a1 > Math.PI ? 1 : 0;
    sheet.raw(`<path d="M ${f(cx)} ${f(cy)} L ${f(x1)} ${f(y1)} A ${R} ${R} 0 ${large} 1 ${f(x2)} ${f(y2)} Z" fill="${PIE_COLORS[i % PIE_COLORS.length]}" stroke="#fff" stroke-width="2" data-slice="${i}"/>`);
    sheet.registerSegment([cx, cy], [x1, y1]);
    // 라벨: 부채꼴 가운데 방향 바깥에 놓는다(중심에서 멀어지는 쪽으로 라벨 상자의 반만큼 더 민다).
    const mid = (a1 + a2) / 2, dx = Math.sin(mid), dy = -Math.cos(mid);
    const text = pieLabelText(spec, i); const w = labelWidth(text, 13), h = 15;
    const lx = cx + (R + 9) * dx + dx * (w / 2), ly = cy + (R + 9) * dy + dy * (h / 2 + 2);
    sheet.label(lx, ly, text, "부채꼴 라벨", { size: 13 });
  });
  sheet.raw(`<circle cx="${f(cx)}" cy="${f(cy)}" r="${R}" fill="none" stroke="#111" stroke-width="1.2"/>`);
  const alt = `${spec.title ? spec.title + " — " : ""}원그래프: ${spec.slices.map((_, i) => pieLabelText(spec, i)).join(", ")}.`;
  void esc;
  return { svg: sheet.svg(alt), alt, issues: dedupe([...issues, ...sheet.uniqueIssues()]) };
}

export function lintPieAgainstText(spec: PieSpec, passage: string): FigureIssue[] {
  const issues: FigureIssue[] = [];
  const text = passage.replace(/\$/g, "");
  // 따옴표로 부른 이름은 부채꼴 이름에 있어야 한다.
  for (const m of text.matchAll(/["“]([^"”]{1,28})["”]/g)) {
    const q = m[1].trim().toLowerCase(); if (q.split(/\s+/).length > 6) continue;
    if (!spec.slices.some((s) => s.label.toLowerCase().includes(q) || q.includes(s.label.toLowerCase()))) issues.push({ code: "ref_missing", message: `지문의 "${m[1]}" 에 해당하는 부채꼴이 없습니다.` });
  }
  if (/\b(northeast|northwest|southeast|southwest|region)\b/i.test(text)) issues.push({ code: "wording", message: "지문에 배치 용어(region 등)가 있습니다." });
  return issues;
}
