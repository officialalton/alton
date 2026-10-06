// 산점도 이상치(outlier) 장면 — 거의 직선인 점 9개 + 추세선에서 멀리 떨어진 점 하나. 추세선은 이상치를 포함한 점 전체의 최소제곱선(그림에 그려짐).
// 자료 JS 는 FIGURE.points·fitLine 에서 이상치(추세선에서 가장 먼 점)를 찾아 이상치를 뺀 최소제곱선과 비교한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { SE_TOPICS, ols, pearson } from "../../../figure-kit";
import type { SeTopic } from "../../../figure-topics";

export type OutScene = { topic: SeTopic; S: number; base: [number, number][]; out: [number, number]; all: [number, number][]; fit10: { slope: number; intercept: number }; fit9: { slope: number; intercept: number }; yMax: number; fig: ScatterFig };
export type ScatterFig = { type: "data"; kind: "scatter"; xTitle: string; yTitle: string; points: [number, number][]; fitLine: { slope: number; intercept: number }; yMin: number; yMax: number; yStep: number };
const at = (a: string, u: string) => `${a} (${u})`;
export const LIN_TOPICS = SE_TOPICS.filter((t) => !/ of | per /.test(t.xu) && t.xa !== t.ya);
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;
export const fitOf = (pts: [number, number][]) => { const f = ols(pts); return { slope: r4(f.slope), intercept: r4(f.intercept) }; };
export const scFig = (t: SeTopic, pts: [number, number][], fit: { slope: number; intercept: number }, S: number, yMax: number): ScatterFig => ({ type: "data", kind: "scatter", xTitle: at(t.xa, t.xu), yTitle: at(t.ya, t.yu), points: pts, fitLine: fit, yMin: 0, yMax, yStep: S });
/** outX: 이상치의 x(10 = 오른쪽 끝, 5 = 가운데). dir: +1 추세 위·-1 아래. 기울기·절편·r 이 이상치를 빼면 뚜렷하게 달라지도록 거절 표집. */
export function outScene(rng: Rng, o: { outX?: number; dir?: 1 | -1; topic?: SeTopic; strong?: boolean } = {}): OutScene {
  const outX = o.outX ?? 10;
  for (let tr = 0; tr < 300; tr++) {
    const topic = o.topic ?? rng.pick(LIN_TOPICS); const S = rng.pick([10, 20, 25]); const m = (rng.int(1, 4) * S) / 10 * (rng.chance(0.25) ? -1 : 1); const b0 = S * rng.int(m < 0 ? 5 : 1, m < 0 ? 7 : 3);
    const xs = Array.from({ length: 10 }, (_, i) => i + 1).filter((x) => x !== outX); const base: [number, number][] = xs.map((x) => [x, Math.round(b0 + m * x + rng.int(-3, 3) * (S / 10))]);
    const dir = o.dir ?? (rng.chance(0.5) ? 1 : -1); const off = rng.int(3, 5) * S / 1; const oy = Math.round(b0 + m * outX + dir * off); if (oy < S / 2 || base.some((p) => p[1] < S / 2)) continue;
    const out: [number, number] = [outX, oy]; const all = [...base, out].sort((a, b) => a[0] - b[0]); const fit10 = fitOf(all), fit9 = fitOf(base);
    const top = Math.max(...all.map((p) => p[1]), fit10.slope * 10 + fit10.intercept, fit10.intercept); const yMax = (Math.floor(top / S) + 1) * S; if (yMax / S > 10 || yMax / S < 4) continue;
    const res = (p: [number, number]) => Math.abs(p[1] - (fit10.slope * p[0] + fit10.intercept)); const rs = base.map(res); if (res(out) < 2.2 * Math.max(...rs)) continue;
    const r10 = Math.abs(pearson(all)), r9 = Math.abs(pearson(base)); if (r9 - r10 < 0.1) continue;
    if (Math.abs(fit10.slope - fit9.slope) < 0.18 * Math.abs(fit9.slope) + 0.05) continue; if (Math.abs(fit10.intercept - fit9.intercept) < 0.12 * S) continue;
    if (fit10.slope * fit9.slope <= 0 || Math.abs(m) < 0.2 * S / 10) continue;
    return { topic, S, base, out, all, fit10, fit9, yMax, fig: scFig(topic, all, fit10, S, yMax) };
  }
  throw new GenFail("이상치 산점도 장면 표집 실패");
}
/** FIGURE(산점도)에서 이상치(추세선에서 가장 먼 점)·이상치를 뺀 점·두 최소제곱선(전체 f10, 이상치 제외 f9)·r10·r9 를 계산한다. */
export const OUT_JS = `const pts = FIGURE.points, fl = FIGURE.fitLine; if (!pts || pts.length < 6 || !fl) throw new Error('자료 없음'); const resd = (p) => Math.abs(p[1] - (fl.slope * p[0] + fl.intercept)); let oi = 0; pts.forEach((p, i) => { if (resd(p) > resd(pts[oi])) oi = i; }); const rest = pts.filter((_, i) => i !== oi); const sorted = rest.map(resd).sort((a, b) => b - a); if (resd(pts[oi]) < 2 * sorted[0]) throw new Error('뚜렷한 이상치 없음');
const ols = (a) => { const n = a.length, mx = a.reduce((s, p) => s + p[0], 0) / n, my = a.reduce((s, p) => s + p[1], 0) / n; let sxy = 0, sxx = 0, syy = 0; for (const p of a) { sxy += (p[0] - mx) * (p[1] - my); sxx += (p[0] - mx) ** 2; syy += (p[1] - my) ** 2; } const m = sxy / sxx; return { m, b: my - m * mx, r: sxy / Math.sqrt(sxx * syy) }; };
const f10 = ols(pts), f9 = ols(rest); if (Math.abs(f10.m - fl.slope) > 0.02 || Math.abs(f10.b - fl.intercept) > 0.2) throw new Error('그려진 추세선이 전체 최소제곱선이 아님');\n`;
