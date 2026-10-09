// 표준 렌더링 엔진 — 도수다각형·누적도수곡선·누적 막대가 공유하는 축 조판 도구(data.ts 의 비공개 축 도구와 같은 규칙: 격자 #d1d5db, 축 #111, 눈금 숫자는 끝 맞춤).
import { f, FONT, labelWidth, type Sheet } from "./_layout";

export type Frame = { x0: number; y0: number; x1: number; y1: number };
export const COLORS = ["#111", "#C8102E", "#1B6FB0", "#0f7b4a"];
export const fmtTick = (n: number) => (Math.abs(n) >= 1000 ? new Intl.NumberFormat("en-US").format(n) : f(n));

/** 세로축(값) — 범위·눈금·격자·숫자·제목. 값 → 화면 y 함수를 돌려준다. */
export function drawYAxis(sheet: Sheet, fr: Frame, min: number, max: number, step: number, title?: string): (v: number) => number {
  const sy = (v: number) => fr.y1 - ((v - min) / (max - min)) * (fr.y1 - fr.y0);
  let widest = 0;
  for (let v = min; v <= max + 1e-9; v += step) {
    const r = Math.round(v * 1e6) / 1e6; const y = sy(r);
    sheet.raw(`<line x1="${f(fr.x0)}" y1="${f(y)}" x2="${f(fr.x1)}" y2="${f(y)}" stroke="#d1d5db" stroke-width="0.8"/>`);
    sheet.raw(`<text x="${f(fr.x0 - 6)}" y="${f(y + 4)}" font-family="${FONT}" font-size="12" text-anchor="end" fill="#111">${fmtTick(r)}</text>`);
    widest = Math.max(widest, labelWidth(fmtTick(r), 12) - 6);
  }
  sheet.raw(`<line x1="${f(fr.x0)}" y1="${f(fr.y0)}" x2="${f(fr.x0)}" y2="${f(fr.y1)}" stroke="#111" stroke-width="1.6"/>`);
  sheet.raw(`<line x1="${f(fr.x0)}" y1="${f(fr.y1)}" x2="${f(fr.x1)}" y2="${f(fr.y1)}" stroke="#111" stroke-width="1.6"/>`);
  sheet.registerSegment([fr.x0, fr.y0], [fr.x0, fr.y1]);
  sheet.registerSegment([fr.x0, fr.y1], [fr.x1, fr.y1]);
  if (title) sheet.raw(`<text transform="translate(${f(Math.max(12, fr.x0 - 6 - widest - 8))} ${f((fr.y0 + fr.y1) / 2)}) rotate(-90)" font-family="${FONT}" font-size="12.5" text-anchor="middle" data-axis-title="y" fill="#111">${title.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`);
  return sy;
}

export function drawXTitle(sheet: Sheet, fr: Frame, H: number, title: string, rotated = false) {
  const y = rotated ? H - 8 : Math.min(H - 8, fr.y1 + 33);
  sheet.raw(`<text x="${f((fr.x0 + fr.x1) / 2)}" y="${f(y)}" font-family="${FONT}" font-size="12.5" text-anchor="middle" data-axis-title="x" fill="#111">${title.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`);
}

export function niceStep(range: number, target = 6): number {
  const raw = range / target;
  const pow = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const cands = [1, 2, 2.5, 5, 10].map((m) => m * pow);
  return cands.find((c) => c >= raw) ?? cands[cands.length - 1];
}
