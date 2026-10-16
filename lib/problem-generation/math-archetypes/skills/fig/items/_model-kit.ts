// 산점도 모형 선택(model_choice) 공용 장면 — 점 5개(x = 0..4)가 정확히 일차·이차(위/아래로 볼록)·지수(증가/감소) 관계를 따른다.
// 분류는 정확한 규칙: 이차 차분이 일정하고 0 이 아니면 이차, 1차 차분이 일정하면 일차, 연속한 값의 비가 일정하면 지수. 값은 눈금 간격 S 의 절반(u = S/2)의 정수배라 눈금선 사이를 읽을 수 있다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { SE_TOPICS } from "../../../figure-kit";
import type { SeTopic } from "../../../figure-topics";

export type MType = "lin_up" | "lin_down" | "quad_up" | "quad_down" | "exp_growth" | "exp_decay";
export const MTYPES: MType[] = ["lin_up", "lin_down", "quad_up", "quad_down", "exp_growth", "exp_decay"];
export type MFig = { type: "data"; kind: "scatter"; xTitle: string; yTitle: string; points: [number, number][]; yMin: number; yMax: number; yStep: number };
export const MODEL_TOPICS: SeTopic[] = SE_TOPICS.filter((t) => !/ of | per /.test(t.xu) && t.xa !== t.ya);
const at = (a: string, u: string) => `${a} (${u})`;
/** yMax 를 생략하면 점의 최댓값 위 한 칸까지(단독 그림), 선택지 그림은 모두 같은 yMax 를 넘긴다. */
export const mFig = (t: SeTopic, S: number, pts: [number, number][], yMax?: number): MFig => ({ type: "data", kind: "scatter", xTitle: at(t.xa, t.xu), yTitle: at(t.ya, t.yu), points: pts, yMin: 0, yMax: yMax ?? (Math.ceil(Math.max(...pts.map((p) => p[1])) / S) + 1) * S, yStep: S });
/** u 의 정수배 y(1~16 u). 유형별 모수: lin(c, e) · quad(h, k, c0) · exp(없음). */
export type MParams = { type: MType; ys: number[] } & { e?: number; c?: number; h?: number; k?: number; c0?: number };
export function genYs(rng: Rng, type: MType, u: number): MParams {
  for (let tr = 0; tr < 200; tr++) {
    const xs = [0, 1, 2, 3, 4]; let ys: number[]; let extra: Partial<MParams> = {};
    if (type === "lin_up" || type === "lin_down") { const e = rng.int(1, 3) * (type === "lin_up" ? 1 : -1); const c = rng.int(1, 16); ys = xs.map((x) => c + e * x); extra = { e, c }; }
    else if (type === "quad_up" || type === "quad_down") { const h = rng.int(1, 3), k = rng.int(1, 2), c0 = rng.int(1, 16); ys = xs.map((x) => (type === "quad_up" ? c0 + k * (x - h) ** 2 : c0 - k * (x - h) ** 2)); extra = { h, k, c0 }; }
    else { ys = xs.map((x) => (type === "exp_growth" ? 2 ** x : 2 ** (4 - x))); }
    if (ys.some((y) => y < 1 || y > 16 || !Number.isInteger(y))) continue;
    if ((type === "quad_up" || type === "quad_down") && new Set(ys).size < 3) continue;
    return { type, ys: ys.map((y) => y * u), ...extra };
  }
  throw new GenFail("모형 표집 실패");
}
export const ptsOf = (ys: number[]): [number, number][] => ys.map((y, x) => [x, y]);
/** FIGURE 점에서 모형 분류 label 과 다음 값 예측·핵심 모수를 계산하는 JS 조각. 반환 변수: label, ys, d(1차 차분), d2, nextAny(label 에 맞는 x=5 의 y), par(label 별 핵심 모수: 기울기·꼭짓점 x·비). */
export const MODEL_JS = `const pts = (FIGURE.points || []).slice().sort((a, b) => a[0] - b[0]); if (pts.length !== 5) throw new Error('점 5개 아님'); const ys = pts.map((p) => p[1]); if (pts.some((p, i) => p[0] !== i) || ys.some((y) => typeof y !== 'number' || y <= 0)) throw new Error('x 또는 y 오류');
const d = ys.slice(1).map((y, i) => y - ys[i]), d2 = d.slice(1).map((v, i) => v - d[i]); const eq = (a) => a.every((v) => Math.abs(v - a[0]) < 1e-9); const rr = ys.slice(1).map((y, i) => y / ys[i]);
let label, nextAny, par; if (eq(d2) && Math.abs(d2[0]) > 1e-9) { label = d2[0] > 0 ? 'quad_up' : 'quad_down'; nextAny = ys[4] + d[3] + d2[0]; const ex = ys.indexOf(label === 'quad_up' ? Math.min(...ys) : Math.max(...ys)); const h = (label === 'quad_up' ? d : d.map((v) => -v)).findIndex((v) => v > 0); par = h < 0 ? 4 : h; } else if (eq(d) && Math.abs(d[0]) > 1e-9) { label = d[0] > 0 ? 'lin_up' : 'lin_down'; nextAny = ys[4] + d[0]; par = d[0]; } else if (eq(rr) && Math.abs(rr[0] - 1) > 1e-9) { label = rr[0] > 1 ? 'exp_growth' : 'exp_decay'; nextAny = ys[4] * rr[0]; par = rr[0]; } else throw new Error('모형 분류 실패');\n`;
export const LABEL_TEXT: Record<MType, string> = { lin_up: "A linear function with a positive slope", lin_down: "A linear function with a negative slope", quad_up: "A quadratic function whose graph opens upward", quad_down: "A quadratic function whose graph opens downward", exp_growth: "An exponential growth function", exp_decay: "An exponential decay function" };
export const classify = (ys: number[]): MType | null => {
  const d = ys.slice(1).map((y, i) => y - ys[i]), d2 = d.slice(1).map((v, i) => v - d[i]); const eq = (a: number[]) => a.every((v) => Math.abs(v - a[0]) < 1e-9); const rr = ys.slice(1).map((y, i) => y / ys[i]);
  if (eq(d2) && Math.abs(d2[0]) > 1e-9) return d2[0] > 0 ? "quad_up" : "quad_down"; if (eq(d) && Math.abs(d[0]) > 1e-9) return d[0] > 0 ? "lin_up" : "lin_down"; if (eq(rr) && Math.abs(rr[0] - 1) > 1e-9) return rr[0] > 1 ? "exp_growth" : "exp_decay"; return null;
};
