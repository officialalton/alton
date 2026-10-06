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
