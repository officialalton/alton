// 기하(TR·PT·PG·CI·CM·SO·CG) 자료 원형 공용 도구 — 조합 파일(items/<조합ID>.ts)이 함께 쓴다.
// 규칙: 수치(각·변·반지름)는 그림의 라벨에만 있고 지문은 "the figure shown" 으로 가리킨다. verification_js 는 FIGURE 의 라벨만 읽어 다시 계산한다.
// 렌더 가드: 만든 인스턴스를 앱과 같은 경로(checkFigure + 렌더 구조 검사)로 확인해 라벨 겹침·잘림이 있으면 GenFail 로 다시 뽑는다.
import { GenFail, type Instance } from "../../types";
import type { Rng } from "../../rng";
import type { Draft } from "../../text";
import { checkFigure } from "../../../../problem-figures/check";
import { checkInstanceFigureQa } from "../../figure-qa";
import { gInst } from "./graph-kit";

export const VN = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("");
/** 서로 다른 점 이름 n 개(알파벳 순). */
export const pickN = (rng: Rng, n: number): string[] => rng.shuffle([...VN]).slice(0, n).sort();
export const RAD = Math.PI / 180;
export const deg = (r: number) => r / RAD;
export const round1 = (n: number) => Math.round(n * 10) / 10;
export const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
export const isInt = Number.isInteger;

/** 변 길이 세 개(a=v1v2 밑변, b=v0v2, c=v0v1)에서 꼭짓점 v0·v1·v2 의 각(도, 0.1 단위). */
export function anglesFromSides(s01: number, s12: number, s02: number): [number, number, number] {
  const A = (opp: number, p: number, q: number) => deg(Math.acos((p * p + q * q - opp * opp) / (2 * p * q)));
  const a0 = A(s12, s01, s02), a1 = A(s02, s01, s12);
  return [round1(a0), round1(a1), round1(180 - a0 - a1)];
}
/** 안전: 도형을 그리는 데 적당한 삼각형인가(가장 작은 각 ≥ minA, 가장 큰 각 ≤ maxA). */
export function shapeOk(s01: number, s12: number, s02: number, minA = 28, maxA = 112): boolean {
  if (!(s01 + s12 > s02 && s12 + s02 > s01 && s01 + s02 > s12)) return false;
  const a = anglesFromSides(s01, s12, s02); return Math.min(...a) >= minA && Math.max(...a) <= maxA;
}

/** 렌더 가드: 앱 렌더 검사(checkFigure)와 렌더 구조 검사(figure-qa)에 걸리면 GenFail — 같은 시드에서 다음 난수로 다시 뽑는다. */
export function guard(inst: Instance, why = "도형 렌더 검사 실패"): Instance {
  const text = `${inst.stimulus}\n${inst.question}\n${inst.options.join("\n")}`;
  const c = checkFigure(inst.figure, text, inst.options, inst.correctIndex);
  if (!c.ok) throw new GenFail(`${why}: ${c.issues[0]?.message.slice(0, 80)}`);
  const q = checkInstanceFigureQa(inst);
  if (q.length) throw new GenFail(`${why}(qa): ${q[0].message.slice(0, 80)}`);
  return inst;
}
/** gInst(숫자 정답·음수 오답 제외) + 렌더 가드. */
export function geoInst(rng: Rng, d: Draft, fig: unknown): Instance { return guard(gInst(rng, d, fig)); }

export const LEAD_GEO = ["", "", "A student draws the figure shown for a geometry assignment. ", "A teacher posts the figure shown on the board. ", "An architect sketches the diagram shown. ", "A designer plans the layout shown. ", "A surveyor records the diagram shown. ", "A student copies the figure shown from a practice set. ", "A map maker marks the figure shown. "];
/** 지문 첫머리 장식(빈 문자열 포함) — 독립 변형 수를 늘린다. */
export const lead = (rng: Rng, xs: readonly string[] = LEAD_GEO) => rng.pick(xs);
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** 숫자 라벨 파싱 JS(정수·소수) — NaN 이면 미지수. */
export const NUM_JS = "const num=(s)=>{ const t=String(s).replace(/[°\\s]/g,''); return /^\\d+(?:\\.\\d+)?$/.test(t)?Number(t):NaN; };\n";

// ── 합동 두 삼각형: 둘째 삼각형의 배치(위·왼쪽 아래·오른쪽 아래에 오는 꼭짓점)가 달라도 같은 크기로 보이게 하는 second.scale ──
// 삼각형 렌더러(templates/triangle.ts)는 각 삼각형을 가로폭(경계 상자)이 1 인 단위 틀로 그린 뒤 틀 크기에 맞춘다. 그 규칙을 그대로 따라 두 삼각형의 화면 길이/실제 길이가 같아지는 scale 을 찾는다.
const T2_W = 580, T2_PADX = 58, T2_GAP = 84, T2_H = 270, T2_PADTOP = 46, T2_PADBOT = 40;
const PAIR_IDX = (i: number, j: number) => (i + j === 1 ? 0 : i + j === 3 ? 1 : 2);
/** s=[v0v1, v1v2, v0v2] 변과 ang 각을 가진 삼각형을 pos=[위, 왼쪽, 오른쪽] 대응으로 놓았을 때의 (경계 상자 폭, 높이/폭). */
function frameOf(s: number[], ang: number[], pos: number[]): { W: number; y: number } {
  const [c0, c1, c2] = pos; const base = s[PAIR_IDX(c1, c2)], adj = s[PAIR_IDX(c0, c1)]; const a = ang[c1] * RAD;
  const ax = adj * Math.cos(a), ay = adj * Math.sin(a); const W = Math.max(base, ax) - Math.min(0, ax);
  return { W, y: ay / W };
}
export function congScale(s: number[], ang: number[], pos: number[]): number {
  const f1 = frameOf(s, ang, [0, 1, 2]), f2 = frameOf(s, ang, pos); const wAvail = T2_W - T2_PADX * 2 - T2_GAP, hAvail = T2_H - T2_PADTOP - T2_PADBOT;
  const diff = (r: number) => { const m = Math.max(1, r); const sc1 = 1 / m, sc2 = r / m; const tot = sc1 + sc2; const w = (sc: number) => (wAvail * sc) / tot; return Math.min(w(sc2), (hAvail * sc2) / Math.max(f2.y, 0.7)) / f2.W - Math.min(w(sc1), (hAvail * sc1) / Math.max(f1.y, 0.7)) / f1.W; };
  let lo = 0.4, hi = 1.6; if (diff(lo) > 0 || diff(hi) < 0) throw new GenFail("합동 배치 크기 보정 불가");
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (diff(mid) < 0) lo = mid; else hi = mid; }
  return Math.round(((lo + hi) / 2) * 100) / 100;
}
