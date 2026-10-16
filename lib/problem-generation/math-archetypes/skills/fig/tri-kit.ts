// 삼각형(TR) 계열 자료 원형 공용 장면 키트 — 1 단계 이후 도형(G7) 조합 파일들이 함께 쓴다.
// 규칙: 수치(각·변)는 그림의 라벨에만 있고 지문은 "triangle ABC shown" 으로 가리킨다. 그림은 각의 참값(angles[].value)·직각변 길이(sides[].label)대로 그려진다(엔진 규칙).
// verification_js 는 FIGURE.angles[].label / FIGURE.sides[].label 만 읽어 다시 계산한다.
import { GenFail } from "../../types";
import type { Rng } from "../../rng";

export const VNAMES = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("");
/** 서로 다른 꼭짓점 이름 3개(알파벳 순). */
export const pickNames = (rng: Rng): [string, string, string] => { const s = rng.shuffle([...VNAMES]).slice(0, 3).sort(); return [s[0], s[1], s[2]]; };
export type Tri3 = [string, string, string];

/** 각 라벨: a x + b 도(°) — (2x + 10)°, x°, 3x°, (x - 5)°. */
export function exprLabel(a: number, b: number): string {
  const ax = a === 1 ? "x" : `${a}x`;
  if (b === 0) return `${ax}°`;
  return `(${ax}${b > 0 ? "+" : "-"}${Math.abs(b)})°`;
}
/** 각 라벨 파싱 JS(숫자·x 식): 반환 {a, b}. 형식이 아니면 던진다. */
export const ANG_PARSE_JS = "const parseAng=(l)=>{ const t=String(l).replace(/[°\\s()]/g,'').replace(/−/g,'-'); let m=/^(\\d*)x([+-]\\d+)?$/.exec(t); if (m) return {a:m[1]===''?1:Number(m[1]), b:m[2]?Number(m[2]):0}; m=/^(\\d+(?:\\.\\d+)?)$/.exec(t); if (m) return {a:0, b:Number(m[1])}; throw new Error('각 라벨 형식 오류: '+l); };\n";
/** FIGURE(삼각형)에서 세 각 식 E[i]={a,b}(꼭짓점 순서 vertices), x(합 180° 로 푼 값), 각 크기 deg[i] 를 읽는 JS. 직각·두 번째 삼각형은 다루지 않는다. */
export const ANG_JS = `${ANG_PARSE_JS}const V=FIGURE.vertices; const A=FIGURE.angles||[]; if (A.length!==3) throw new Error('세 각 라벨 필요'); const E=V.map(v=>{ const a=A.find(q=>q.at===v); if (!a) throw new Error('각 라벨 없음'); return parseAng(a.label); }); const sa=E.reduce((s,e)=>s+e.a,0), sb=E.reduce((s,e)=>s+e.b,0); const x=sa===0?NaN:(180-sb)/sa; if (sa!==0 && !Number.isFinite(x)) throw new Error('x 오류'); const deg=E.map(e=>e.a*x+e.b); if (sa===0 && Math.abs(sb-180)>1e-9) throw new Error('세 각의 합이 180° 가 아님'); if (deg.some(d=>!(d>0&&d<180))) throw new Error('각이 0~180 밖');\n`;

export type ExprTri = { v: Tri3; a: [number, number, number]; b: [number, number, number]; x: number; deg: [number, number, number]; fig: { type: "triangle"; vertices: Tri3; kind?: string; angles: { at: string; label: string; value: number }[]; sides?: unknown[] } };
/** 세 각이 x 의 일차식인 삼각형: 계수 a_i(1~4), 상수 b_i, 합이 180° — 모든 각 15~150°, x 는 정수. */
export function makeExprTri(rng: Rng, o: { ratio?: boolean; xMin?: number; xMax?: number } = {}): ExprTri {
  for (let tr = 0; tr < 400; tr++) {
    const v = pickNames(rng); const x = rng.int(o.xMin ?? 8, o.xMax ?? 30);
    const a: [number, number, number] = o.ratio ? (rng.pick([[2, 3, 4], [3, 4, 5], [2, 3, 5], [4, 5, 6], [5, 6, 7], [3, 5, 7]] as [number, number, number][])) : [rng.int(1, 4), rng.int(1, 4), rng.int(1, 4)];
    const sa = a[0] + a[1] + a[2];
    if (o.ratio) { if (180 % sa !== 0) continue; const k = 180 / sa; const b: [number, number, number] = [0, 0, 0]; const deg = a.map((q) => q * k) as [number, number, number]; if (deg.some((d) => d < 40 || d > 90)) continue; const perm = rng.shuffle([0, 1, 2]); const aa = perm.map((i) => a[i]) as [number, number, number]; const dd = perm.map((i) => deg[i]) as [number, number, number]; return mk(v, aa, b, k, dd); }
    // 오른쪽 아래 꼭짓점의 각 라벨은 도형 밖으로 나가 꼭짓점 이름과 겹치기 쉬우므로 상수항 없이 ax° 로 짧게 둔다.
    const b2 = rng.int(-20, 40); const b1 = 180 - sa * x - b2; const b: [number, number, number] = [b1, b2, 0];
    const deg = a.map((q, i) => q * x + b[i]) as [number, number, number]; if (deg.some((d) => d < 42 || d > 88) || b.some((q) => Math.abs(q) > 90)) continue;
    if (new Set(deg).size < 3) continue; return mk(v, a, b, x, deg);
  }
  throw new GenFail("식 삼각형 표집 실패");
}
function mk(v: Tri3, a: [number, number, number], b: [number, number, number], x: number, deg: [number, number, number]): ExprTri {
  return { v, a, b, x, deg, fig: { type: "triangle", vertices: v, angles: v.map((n, i) => ({ at: n, label: exprLabel(a[i], b[i]), value: deg[i] })) } };
}
const LEAD = ["", "", "A student draws a triangle for a geometry assignment. ", "An architect sketches a triangular roof truss. ", "A surveyor records the corners of a triangular lot. ", "A designer plans a triangular logo. ", "A teacher posts the triangle below on the board. ", "A game developer models a triangular ramp. ", "A map maker marks a triangular park. "];
export const triIntro = (rng: Rng, v: Tri3, extra = "") => rng.pick(LEAD) + rng.pick([
  `In triangle $${v.join("")}$ shown, the measures of the angles are given in degrees.${extra}`,
  `The figure shows triangle $${v.join("")}$. The angle measures are labeled in degrees.${extra}`,
  `Triangle $${v.join("")}$ is shown with its three angle measures, in degrees.${extra}`,
  `For triangle $${v.join("")}$ shown, each angle is labeled with its measure in degrees.${extra}`,
  `Each of the three angles of triangle $${v.join("")}$ in the figure is labeled with a degree measure.${extra}`,
  `The three interior angles of triangle $${v.join("")}$ are labeled in the figure shown.${extra}`,
  `Triangle $${v.join("")}$ is drawn in the figure, and its interior angles carry the degree measures shown.${extra}`,
  `Look at triangle $${v.join("")}$ in the figure: every interior angle has its measure marked in degrees.${extra}`,
]);
export const angRead = (t: ExprTri): [string, string] => [`그림에서 세 각의 라벨을 읽는다: ${t.v.map((n, i) => `∠${n} = ${exprLabel(t.a[i], t.b[i])}`).join(", ")}.`, "Read the three angle labels."];
export const sumStep = (t: ExprTri): [string, string] => { const sa = t.a[0] + t.a[1] + t.a[2], sb = t.b[0] + t.b[1] + t.b[2]; return [`내각의 합 180°: ${sa}x ${sb < 0 ? "-" : "+"} ${Math.abs(sb)} = 180 에서 x = ${t.x} 이다.`, "The angles add to 180°; solve for x."]; };

// ───────────────────────── 직각삼각형 ─────────────────────────
export const TRIPLES: [number, number, number][] = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 12, 15], [6, 8, 10], [10, 24, 26], [12, 16, 20], [15, 20, 25], [9, 40, 41], [12, 35, 37], [16, 30, 34], [18, 24, 30], [21, 28, 35]];
export type RTri = { v: Tri3; legs: [number, number]; hyp: number; /** 그림의 변 라벨(밑변·세로변·빗변 순) */ labels: [string, string, string]; fig: { type: "triangle"; vertices: Tri3; kind: "right"; rightAngleAt: string; horizontal: [string, string]; sides: { between: [string, string]; label?: string }[]; angles?: { at: string; label?: string; arc?: boolean; value: number }[] } };
/** 직각삼각형: v[0] 직각(왼쪽 아래), v[1] 밑변의 오른쪽 끝, v[2] 위. unknown 변은 라벨 'x'(빗변·밑변·세로변). 피타고라스 수에 배수를 곱해 변이 정수. */
export function makeRight(rng: Rng, o: { unknown?: "hyp" | "base" | "height" | "none"; swap?: boolean; maxSide?: number; /** v1 의 각(밑변과 빗변 사이)이 이 각도 이상·(90 − 이 각도) 이하 — 너무 납작하면 θ 라벨이 꼭짓점 이름과 겹친다 */ angleMin?: number } = {}): RTri {
  for (let tr = 0; tr < 200; tr++) {
    const [a0, b0, c0] = rng.pick(TRIPLES); const k = rng.pick([1, 1, 1, 2]); const [a, b, c] = [a0 * k, b0 * k, c0 * k]; if (c > (o.maxSide ?? 60)) continue;
    const legs: [number, number] = rng.chance(0.5) || o.swap === false ? [a, b] : [b, a]; if (o.angleMin !== undefined) { const th = Math.atan2(legs[1], legs[0]) * 180 / Math.PI; if (th < o.angleMin || th > 90 - o.angleMin) continue; } const nm = pickNames(rng); const v: Tri3 = [nm[0], nm[1], nm[2]]; const u = o.unknown ?? "none";
    const labels: [string, string, string] = [u === "base" ? "x" : String(legs[0]), u === "height" ? "x" : String(legs[1]), u === "hyp" ? "x" : String(c)];
    // 한 직각변이 x 이면 엔진이 두 직각변의 비율을 알 수 없어 기본 4:3 으로 그린다 — 밑변의 오른쪽 끝 각의 참값(value, 호 없이 인쇄하지 않음)을 주어 그림이 참값과 맞게 한다.
    const fig = { type: "triangle" as const, vertices: v, kind: "right" as const, rightAngleAt: v[0], horizontal: [v[0], v[1]] as [string, string], sides: [{ between: [v[0], v[1]] as [string, string], label: labels[0] }, { between: [v[0], v[2]] as [string, string], label: labels[1] }, { between: [v[1], v[2]] as [string, string], label: labels[2] }], ...(u === "base" || u === "height" ? { angles: [{ at: v[1], arc: false, value: Math.round(Math.atan2(legs[1], legs[0]) * 1800 / Math.PI) / 10 }] } : {}) };
    return { v, legs, hyp: c, labels, fig };
  }
  throw new GenFail("직각삼각형 표집 실패");
}
/** FIGURE(직각삼각형)에서 변 라벨을 읽는 JS: B(밑변)·H(세로변)·C(빗변)는 숫자 또는 NaN(미지수 x). 숫자인 변은 피타고라스 관계를 어기면 던진다. */
export const RT_JS = "const sd=FIGURE.sides||[]; if (sd.length!==3) throw new Error('세 변 라벨 필요'); const num=(s)=>/^\\d+(?:\\.\\d+)?$/.test(String(s))?Number(s):NaN; let B=num(sd[0].label), H=num(sd[1].label), C=num(sd[2].label); const nn=[B,H,C].filter(Number.isNaN).length; if (nn===0 && Math.abs(B*B+H*H-C*C)>1e-9) throw new Error('피타고라스 관계 위반'); if (nn>1) throw new Error('미지수 둘 이상'); if (Number.isNaN(C)) C=Math.sqrt(B*B+H*H); else if (Number.isNaN(B)) B=Math.sqrt(C*C-H*H); else if (Number.isNaN(H)) H=Math.sqrt(C*C-B*B); if (![B,H,C].every(v=>v>0&&Number.isFinite(v))) throw new Error('변 길이 오류');\n";
export const rtIntro = (rng: Rng, t: { v: Tri3 }, extra = "") => rng.pick(LEAD) + rng.pick([
  `Right triangle $${t.v.join("")}$ is shown, with the right angle at $${t.v[0]}$.${extra}`,
  `In the figure, triangle $${t.v.join("")}$ has a right angle at $${t.v[0]}$. Some side lengths are labeled.${extra}`,
  `The figure shows right triangle $${t.v.join("")}$ with its right angle at vertex $${t.v[0]}$.${extra}`,
  `Triangle $${t.v.join("")}$ in the figure is a right triangle, and the right angle is at $${t.v[0]}$.${extra}`,
  `A right triangle $${t.v.join("")}$ is drawn in the figure shown with the right angle at $${t.v[0]}$; side lengths are marked.${extra}`,
]);
export const rtRead = (t: RTri): [string, string] => [`그림에서 변 라벨을 읽는다: ${t.v[0]}${t.v[1]} = ${t.labels[0]}, ${t.v[0]}${t.v[2]} = ${t.labels[1]}, ${t.v[1]}${t.v[2]} = ${t.labels[2]}.`, "Read the labeled side lengths."];

// ───────────────────────── 이등변삼각형(밑각) ─────────────────────────
export type IsoTri = { v: Tri3; apex: { a: number; b: number }; base: { a: number; b: number }; x: number; apexDeg: number; baseDeg: number; fig: { type: "triangle"; vertices: Tri3; kind: "isosceles"; sides: { between: [string, string]; tick: 1 }[]; angles: { at: string; label?: string; arc?: boolean; value: number }[] } };
const mkIso = (v: Tri3, apex: { a: number; b: number }, base: { a: number; b: number }, x: number, labelApex: string, labelBase: string): IsoTri => {
  const apexDeg = apex.a * x + apex.b, baseDeg = base.a * x + base.b;
  return { v, apex, base, x, apexDeg, baseDeg, fig: { type: "triangle", vertices: v, kind: "isosceles", sides: [{ between: [v[0], v[1]], tick: 1 }, { between: [v[0], v[2]], tick: 1 }], angles: [{ at: v[0], label: labelApex, value: apexDeg }, { at: v[1], label: labelBase, value: baseDeg }] } };
};
/** 이등변삼각형(AB = AC, 꼭지각 v[0], 밑각 v[1]=v[2]): 꼭지각 = (a x + b)°, 밑각 = (c x + d)° 이고 꼭지각 + 2 × 밑각 = 180°. ratio: 꼭지각 x°, 밑각 k x°. */
export function makeIso(rng: Rng, o: { ratio?: boolean } = {}): IsoTri {
  const nm = pickNames(rng); const v: Tri3 = [nm[0], nm[1], nm[2]];
  for (let tr = 0; tr < 400; tr++) {
    if (o.ratio) { const k = rng.pick([2, 4]); const x = 180 / (1 + 2 * k); return mkIso(v, { a: 1, b: 0 }, { a: k, b: 0 }, x, "x°", `${k}x°`); }
    const x = rng.int(8, 30), a = rng.int(1, 2), c = rng.int(1, 2), b = rng.int(-20, 40); const d2 = 180 - b - (a + 2 * c) * x; if (d2 % 2 !== 0) continue; const d = d2 / 2;
    const apexDeg = a * x + b, baseDeg = c * x + d; if (apexDeg < 36 || apexDeg > 80 || baseDeg < 50 || baseDeg > 72 || Math.abs(b) > 60 || Math.abs(d) > 60 || apexDeg === baseDeg) continue;
    return mkIso(v, { a, b }, { a: c, b: d }, x, exprLabel(a, b), exprLabel(c, d));
  }
  throw new GenFail("이등변삼각형 표집 실패");
}
/** FIGURE(이등변삼각형)에서 꼭지각 식 PA, 밑각 식 PB(꼭지각 라벨은 vertices[0], 밑각 라벨은 vertices[1])와 x·각 크기를 읽는 JS. */
export const ISO_JS = `${ANG_PARSE_JS}const V=FIGURE.vertices; const AN=FIGURE.angles||[]; const ap=AN.find(q=>q.at===V[0]), bs=AN.find(q=>q.at===V[1]||q.at===V[2]); if (!ap||!bs) throw new Error('꼭지각·밑각 라벨 필요'); const PA=parseAng(ap.label), PB=parseAng(bs.label); const sa=PA.a+2*PB.a, sb=PA.b+2*PB.b; if (sa===0&&Math.abs(sb-180)>1e-9) throw new Error('각의 합이 180° 가 아님'); const x=sa===0?NaN:(180-sb)/sa; const apexD=PA.a*x+PA.b, baseD=PB.a*x+PB.b; if (!(apexD>0&&baseD>0&&Math.abs(apexD+2*baseD-180)<1e-9)) throw new Error('이등변삼각형 각 오류');\n`;
export const isoIntro = (rng: Rng, v: Tri3, extra = "") => rng.pick(LEAD) + rng.pick([
  `In the figure shown, $${v[0]}${v[1]} = ${v[0]}${v[2]}$ in triangle $${v.join("")}$, and some angle measures are labeled in degrees.${extra}`,
  `Triangle $${v.join("")}$ is isosceles with $${v[0]}${v[1]} = ${v[0]}${v[2]}$, as the tick marks in the figure show. Angle measures are labeled in degrees.${extra}`,
  `The figure shows isosceles triangle $${v.join("")}$ in which sides $${v[0]}${v[1]}$ and $${v[0]}${v[2]}$ are equal. Two of its angle measures are labeled in degrees.${extra}`,
  `In the figure, the two marked sides $${v[0]}${v[1]}$ and $${v[0]}${v[2]}$ of triangle $${v.join("")}$ are congruent, and some angles are labeled in degrees.${extra}`,
]);
export const isoRead = (t: IsoTri, la: string, lb: string): [string, string] => [`그림에서 AB = AC(눈금)이므로 밑각이 같다. 꼭지각 ${t.v[0]} = ${la}, 밑각 ${t.v[1]} = ${lb} 이다.`, "Equal sides give equal base angles; read the labels."];

// ───────────────────────── 30-60-90 삼각형 ─────────────────────────
export type STri = { v: Tri3; a: number; fig: { type: "triangle"; vertices: Tri3; kind: "right"; rightAngleAt: string; horizontal: [string, string]; sides: { between: [string, string]; label?: string }[]; angles: { at: string; label?: string; arc?: boolean; value: number }[] } };
/**
 * 30°-60°-90° 삼각형: v[0] 직각, v[1] 의 각이 30°(값 a 는 30° 의 대변 = v[0]v[2] = 짧은 변), 빗변 = 2a.
 * show: 그림에 숫자로 라벨할 변 — "short"(짧은 변 a)·"hyp"(빗변 2a)·"none". 나머지 변 라벨은 없고 빗변·짧은 변 중 묻는 쪽은 x.
 */
export function makeSpecial(rng: Rng, o: { show: "short" | "hyp"; ask: "short" | "hyp"; max?: number }): STri {
  const nm = pickNames(rng); const v: Tri3 = [nm[0], nm[1], nm[2]]; const a = rng.int(2, o.max ?? 24);
  const sides = [{ between: [v[0], v[2]] as [string, string], label: o.show === "short" ? String(a) : o.ask === "short" ? "x" : undefined }, { between: [v[1], v[2]] as [string, string], label: o.show === "hyp" ? String(2 * a) : o.ask === "hyp" ? "x" : undefined }].filter((q) => q.label !== undefined);
  return { v, a, fig: { type: "triangle", vertices: v, kind: "right", rightAngleAt: v[0], horizontal: [v[0], v[1]], sides, angles: [{ at: v[1], label: "30°", value: 30 }, { at: v[2], label: "60°", value: 60 }] } };
}
export const spRead = (t: STri, what: string): [string, string] => [`그림에서 30°-60°-90° 삼각형이고 ${what} 이다. 짧은 변(30° 의 대변) : 빗변 = 1 : 2 이다.`, "A 30-60-90 triangle: the side opposite 30° is half the hypotenuse."];
export const SP_JS = "const sd=FIGURE.sides||[]; const num=(q)=>/^\\d+(?:\\.\\d+)?$/.test(String(q))?Number(q):NaN; const AN=FIGURE.angles||[]; if (!(AN.some(q=>q.value===30)&&AN.some(q=>q.value===60))) throw new Error('30-60-90 필요'); const sh=sd.find(q=>q.between.join('')===FIGURE.vertices[0]+FIGURE.vertices[2]), hy=sd.find(q=>q.between.join('')===FIGURE.vertices[1]+FIGURE.vertices[2]); let SHORT=sh?num(sh.label):NaN, HYP=hy?num(hy.label):NaN; if (Number.isNaN(SHORT)&&Number.isNaN(HYP)) throw new Error('변 라벨 필요'); if (Number.isNaN(HYP)) HYP=2*SHORT; else if (Number.isNaN(SHORT)) SHORT=HYP/2; if (Math.abs(HYP-2*SHORT)>1e-9) throw new Error('30-60-90 관계 위반');\n";
