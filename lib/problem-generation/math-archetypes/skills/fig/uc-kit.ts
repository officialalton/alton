// 단위원(UC) 계열 자료 원형 공용 장면 키트 — 삼각비(trig_ratio.UC.P)·라디안(unit_circle_radian.UC.P/C) 조합 파일이 함께 쓴다.
// 규칙: 점의 좌표·각의 라디안 값은 그림의 라벨에만 있고 지문은 "the unit circle shown" 으로 가리킨다. 그림은 점의 참 위치(points[].angle, 비인쇄)대로 그려진다(엔진 규칙, G8 가 라벨과 위치를 대조).
// verification_js 는 FIGURE.points[].label / FIGURE.arcs[].label 만 읽어 다시 계산한다(라벨이 바뀌면 단위원 위 점이 아니거나 답이 달라져 변조가 검출된다).
import { GenFail } from "../../types";
import type { Rng } from "../../rng";
import { gcd } from "../../rng";

export const MN = "−";
export type Rat = [number, number];
export const rat = (n: number, d: number): Rat => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return [n / g, d / g]; };
/** 그림 라벨용(진짜 빼기 기호 −). */
export const ratLab = (r: Rat) => `${r[0] < 0 ? MN : ""}${Math.abs(r[0])}${r[1] === 1 ? "" : `/${r[1]}`}`;
/** 선지·식용(ASCII 빼기). */
export const ratTxt = (r: Rat) => `${r[0] < 0 ? "-" : ""}${Math.abs(r[0])}${r[1] === 1 ? "" : `/${r[1]}`}`;
export const ratVal = (r: Rat) => r[0] / r[1];
export const addR = (a: Rat, b: Rat): Rat => rat(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
export const subR = (a: Rat, b: Rat): Rat => rat(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
export const mulR = (a: Rat, b: Rat): Rat => rat(a[0] * b[0], a[1] * b[1]);
export const divR = (a: Rat, b: Rat): Rat => rat(a[0] * b[1], a[1] * b[0]);

// ───────────────────────── 유리 좌표 점 ─────────────────────────
const TRIPLES: [number, number, number][] = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]];
export type UcRat = { x: Rat; y: Rat; angle: number; q: 1 | 2 | 3 | 4 };
const quad = (x: number, y: number): 1 | 2 | 3 | 4 => (x > 0 ? (y > 0 ? 1 : 4) : (y > 0 ? 2 : 3));
export const angOf = (x: number, y: number) => { const a = (Math.atan2(y, x) * 180) / Math.PI; return Math.round((a < 0 ? a + 360 : a) * 100) / 100; };
export function makeRatPoint(rng: Rng, o: { q?: 1 | 2 | 3 | 4; not?: UcRat; triple?: number } = {}): UcRat {
  for (let tr = 0; tr < 200; tr++) {
    const [a, b, c] = TRIPLES[o.triple ?? rng.int(0, TRIPLES.length - 1)]; const swap = rng.chance(0.5); const q = o.q ?? rng.int(1, 4) as 1 | 2 | 3 | 4;
    const sx = q === 1 || q === 4 ? 1 : -1, sy = q === 1 || q === 2 ? 1 : -1; const xn = (swap ? b : a) * sx, yn = (swap ? a : b) * sy;
    const p: UcRat = { x: rat(xn, c), y: rat(yn, c), angle: angOf(xn / c, yn / c), q };
    if (o.not && Math.abs(o.not.angle - p.angle) < 12) continue;
    return p;
  }
  throw new GenFail("유리 좌표 점 표집 실패");
}
export const ratLabel = (p: UcRat, mask?: "x" | "y" | "both") => `(${mask === "x" || mask === "both" ? "a" : ratLab(p.x)}, ${mask === "y" || mask === "both" ? "b" : ratLab(p.y)})`;

// ───────────────────────── 특수각 점 ─────────────────────────
/** 기준각(1사분면) 30·45·60° 의 정확한 값. 부호는 사분면이 정한다. */
export const REF: Record<30 | 45 | 60, { sin: string; cos: string; tan: string; sinV: number; cosV: number; tanV: number }> = {
  30: { sin: "1/2", cos: "√3/2", tan: "√3/3", sinV: 0.5, cosV: Math.sqrt(3) / 2, tanV: Math.sqrt(3) / 3 },
  45: { sin: "√2/2", cos: "√2/2", tan: "1", sinV: Math.SQRT1_2, cosV: Math.SQRT1_2, tanV: 1 },
  60: { sin: "√3/2", cos: "1/2", tan: "√3", sinV: Math.sqrt(3) / 2, cosV: 0.5, tanV: Math.sqrt(3) },
};
export const SPECIAL_ANGLES = [30, 45, 60, 120, 135, 150, 210, 225, 240, 300, 315, 330];
export type Fn = "sin" | "cos" | "tan";
export const refOf = (d: number): 30 | 45 | 60 => { const r = d % 90; const q = Math.floor(d / 90); const ref = q % 2 === 0 ? r : 90 - r; return ref as 30 | 45 | 60; };
export const quadOfAngle = (d: number): 1 | 2 | 3 | 4 => (d < 90 ? 1 : d < 180 ? 2 : d < 270 ? 3 : 4);
export const signOf = (d: number, fn: Fn): 1 | -1 => { const q = quadOfAngle(d); if (fn === "sin") return q <= 2 ? 1 : -1; if (fn === "cos") return q === 1 || q === 4 ? 1 : -1; return q === 1 || q === 3 ? 1 : -1; };
/** 특수각 d(도)에서 fn 값의 정확한 문자열(라벨용 MN 빼기, 식용 ASCII). */
export function spec(d: number, fn: Fn, ascii = false): string { const s = REF[refOf(d)][fn]; const neg = signOf(d, fn) < 0; return `${neg ? (ascii ? "-" : MN) : ""}${ascii ? s.replace(/√(\d)/g, "\\sqrt{$1}") : s}`; }
export const specVal = (d: number, fn: Fn) => signOf(d, fn) * REF[refOf(d)][`${fn}V` as "sinV" | "cosV" | "tanV"];
export const specLabel = (d: number) => `(${spec(d, "cos")}, ${spec(d, "sin")})`;
/** d 도 → 라디안 라벨 "5π/6". */
export function radLabel(d: number): string { const g = gcd(d, 180); const n = d / g, q = 180 / g; return `${n === 1 ? "" : n}π${q === 1 ? "" : `/${q}`}`; }
/** 선지용 라디안(수식): "\frac{5\pi}{6}". */
export function radTex(d: number): string { const g = gcd(d, 180); const n = d / g, q = 180 / g; return q === 1 ? `${n === 1 ? "" : n}\\pi` : `\\frac{${n === 1 ? "" : n}\\pi}{${q}}`; }
/** 선지용 라디안(수식 기호로 감쌈). */
export const radOpt = (d: number) => `$${radTex(d)}$`;
/** 라디안 지문용(인라인 수식 안): "\\frac{5\\pi}{6}". */
export const radIn = (d: number) => radTex(d);

// ───────────────────────── 검증 JS ─────────────────────────
/** FIGURE(unit_circle)에서 좌표 라벨 → [x, y](문자 라벨 a·b 는 NaN) 와 각 라벨 → 도(°). */
export const UC_JS = `const pn=(t)=>{ const m=String(t).replace(/−/g,'-').replace(/\\s+/g,'').match(/^(-?)(\\d*)(?:√(\\d+))?(?:\\/(\\d+))?$/); if(!m||(m[2]===''&&m[3]===undefined)) return NaN; return (m[1]==='-'?-1:1)*(m[2]===''?1:Number(m[2]))*(m[3]===undefined?1:Math.sqrt(Number(m[3])))/(m[4]===undefined?1:Number(m[4])); };
const pc=(lab)=>{ const m=String(lab).replace(/−/g,'-').match(/^\\(\\s*([^,]+?)\\s*,\\s*([^)]+?)\\s*\\)$/); if(!m) throw new Error('좌표 라벨 형식 오류'); return [pn(m[1]),pn(m[2])]; };
const pa=(lab)=>{ const s=String(lab).replace(/−/g,'-').replace(/\\s+/g,''); let m=/^(\\d+(?:\\.\\d+)?)°$/.exec(s); if (m) return Number(m[1]); m=/^(\\d*)π(?:\\/(\\d+))?$/.exec(s); if (!m) throw new Error('각 라벨 형식 오류: '+lab); return (m[1]===''?1:Number(m[1]))*180/(m[2]===undefined?1:Number(m[2])); };
if (!FIGURE||FIGURE.type!=='unit_circle') throw new Error('단위원 자료 필요');
const PT=FIGURE.points; const RADN=(a)=>a*Math.PI/180;
const pt=(i)=>{ const q=PT[i]; if(!q||!q.label) throw new Error('점 라벨 필요'); let [x,y]=pc(q.label); const a=RADN(q.angle); if (Number.isNaN(x)&&Number.isNaN(y)) throw new Error('좌표 둘 다 미지수'); if (Number.isNaN(x)) x=(Math.cos(a)<0?-1:1)*Math.sqrt(Math.max(0,1-y*y)); if (Number.isNaN(y)) y=(Math.sin(a)<0?-1:1)*Math.sqrt(Math.max(0,1-x*x)); if (Math.abs(x*x+y*y-1)>1e-9) throw new Error('단위원 위의 점이 아님'); if (Math.cos(a)*x<-1e-9||Math.sin(a)*y<-1e-9) throw new Error('좌표 부호가 그림의 사분면과 다름'); return {x,y,q:q}; };
`;
/** 각 d(도)의 sin·cos·tan 계산 JS 헬퍼. */
export const TRIG_JS = "const T=(d,f)=>{ const a=d*Math.PI/180; const v=f==='sin'?Math.sin(a):f==='cos'?Math.cos(a):Math.sin(a)/Math.cos(a); return Math.abs(v)<1e-12?0:v; };\n";

// ───────────────────────── 지문 장면(이름·기호·문장 틀) ─────────────────────────
export type Sym = { tex: string; ch: string };
export const ANGLE_SYMS: Sym[] = [{ tex: "\\theta", ch: "θ" }, { tex: "\\alpha", ch: "α" }, { tex: "\\beta", ch: "β" }, { tex: "\\varphi", ch: "φ" }];
export const PT_NAMES = ["P", "Q", "R", "S", "T", "A", "B", "C", "M", "N"];
export type UcCtx = { p: string; q: string; a: Sym; b: Sym };
/** 점 이름 둘·각 기호 둘을 서로 다르게 뽑는다 — 지문 변형(독립 변형 수)을 늘린다. */
export function ucCtx(rng: Rng, o: { choiceLetters?: boolean } = {}): UcCtx {
  // 선택지형은 그림 캡션이 A~D 라 점 이름으로 A~D 를 쓰지 않는다.
  const n = rng.shuffle(o.choiceLetters ? PT_NAMES.filter((x) => !"ABCD".includes(x)) : PT_NAMES).slice(0, 2); const s = rng.shuffle(ANGLE_SYMS).slice(0, 2);
  return { p: n[0], q: n[1], a: s[0], b: s[1] };
}
export const UC_LEADS = [
  "", "",
  "A student sketches a circle for a trigonometry assignment. ", "A teacher posts a diagram on the board before the lesson. ", "A tutor draws a figure to review the unit circle with a class. ",
  "An engineer models a rotating arm with a point moving on a circle of radius 1. ", "A game designer places a character on a circular track of radius 1. ", "A textbook illustrates standard position angles with the figure below. ",
  "During a review session, students study the diagram shown. ", "A physics class tracks a point moving around a circle of radius 1. ", "A robotics club programs a sensor arm that sweeps around a circle. ",
  "A math circle poster shows the diagram below. ", "In a lab handout about periodic motion, the following circle appears. ", "A coding class animates a dot that moves along the circle shown. ",
];

// ───────────────────────── 정확한 값(a√k / d) ─────────────────────────
/** 부호·계수·근호(1·2·3)·분모로 쓰는 정확한 수 — 특수각 삼각비와 그 곱·합을 선지 문자열로 낸다. */
export type Ex = { s: 1 | -1; c: number; k: 1 | 2 | 3; d: number };
const exNorm = (e: Ex): Ex => { const g = gcd(e.c, e.d); return { ...e, c: e.c / g, d: e.d / g }; };
const EXREF: Record<30 | 45 | 60, Record<Fn, Ex>> = {
  30: { sin: { s: 1, c: 1, k: 1, d: 2 }, cos: { s: 1, c: 1, k: 3, d: 2 }, tan: { s: 1, c: 1, k: 3, d: 3 } },
  45: { sin: { s: 1, c: 1, k: 2, d: 2 }, cos: { s: 1, c: 1, k: 2, d: 2 }, tan: { s: 1, c: 1, k: 1, d: 1 } },
  60: { sin: { s: 1, c: 1, k: 3, d: 2 }, cos: { s: 1, c: 1, k: 1, d: 2 }, tan: { s: 1, c: 1, k: 3, d: 1 } },
};
export const exOf = (deg: number, fn: Fn): Ex => ({ ...EXREF[refOf(deg)][fn], s: signOf(deg, fn) });
export const exVal = (e: Ex) => (e.s * e.c * Math.sqrt(e.k)) / e.d;
export const exNeg = (e: Ex): Ex => ({ ...e, s: (e.s * -1) as 1 | -1 });
export const exAbs = (e: Ex): Ex => ({ ...e, s: 1 });
export function exMul(a: Ex, b: Ex): Ex {
  let k: 1 | 2 | 3, c = a.c * b.c;
  if (a.k === 1) k = b.k; else if (b.k === 1) k = a.k; else if (a.k === b.k) { k = 1; c *= a.k; } else throw new GenFail("근호 곱 미지원");
  return exNorm({ s: (a.s * b.s) as 1 | -1, c, k, d: a.d * b.d });
}
export function exAdd(a: Ex, b: Ex): Ex {
  if (a.k !== b.k || a.d !== b.d) throw new GenFail("합 미지원");
  const t = a.s * a.c + b.s * b.c; return exNorm({ s: t < 0 ? -1 : 1, c: Math.abs(t), k: a.k, d: a.d });
}
export const exInv = (e: Ex): Ex => { if (e.k === 1) return exNorm({ s: e.s, c: e.d, k: 1, d: e.c }); return exNorm({ s: e.s, c: e.d, k: e.k, d: e.c * e.k }); };
/** 선지 문자열(ASCII 빼기, \\sqrt). */
export function exTxt(e: Ex): string {
  if (e.c === 0) return "0";
  const num = e.k > 1 ? `${e.c === 1 ? "" : e.c}\\sqrt{${e.k}}` : String(e.c);
  const body = `${e.s < 0 ? "-" : ""}${num}${e.d > 1 ? `/${e.d}` : ""}`;
  return body.includes("\\") ? `$${body}$` : body;
}
/** 같은 반사각 계열(d, 180−d, 180+d, 360−d). */
export const familyOf = (d: number): number[] => { const r = refOf(d); return [r, 180 - r, 180 + r, 360 - r]; };

/** 좌표·값 라벨 파서만(FIGURE 없이 쓰는 선택지형 predicate 용). */
export const PN_JS = "const pn=(t)=>{ const m=String(t).replace(/−/g,'-').replace(/\\s+/g,'').match(/^(-?)(\\d*)(?:√(\\d+))?(?:\\/(\\d+))?$/); if(!m||(m[2]===''&&m[3]===undefined)) return NaN; return (m[1]==='-'?-1:1)*(m[2]===''?1:Number(m[2]))*(m[3]===undefined?1:Math.sqrt(Number(m[3])))/(m[4]===undefined?1:Number(m[4])); };\n";
export const NORM_JS = "const n360=(x)=>((x%360)+360)%360;\n";
