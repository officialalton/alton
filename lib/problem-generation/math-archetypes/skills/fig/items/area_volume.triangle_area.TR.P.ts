// area_volume.triangle_area.TR.P — 삼각형 그림의 밑변·높이(수선) 라벨에서 넓이·높이·미지수를 구한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { NUM_JS, geoInst, lead, pickN, round1, deg } from "../geo-kit";
import { TRIPLES, type Tri3 } from "../tri-kit";
import type { Rng } from "../../../rng";

const PARSE_LIN_JS = "const lin=(l)=>{ const t=String(l).replace(/\\s/g,'').replace(/−/g,'-'); let m=/^(\\d*)x([+-]\\d+)?$/.exec(t); if (m) return {a:m[1]===''?1:Number(m[1]), b:m[2]?Number(m[2]):0}; m=/^(\\d+(?:\\.\\d+)?)$/.exec(t); if (m) return {a:0,b:Number(m[1])}; throw new Error('라벨 형식 오류: '+l); };\n";
/** 삼각형 FIGURE 의 밑변(vertices[1]vertices[2]) 라벨·수선 라벨을 읽는다(첫 삼각형만): BASE, ALT 는 라벨 문자열. */
const TA_JS = `${NUM_JS}${PARSE_LIN_JS}const V=FIGURE.vertices; const sl=(T,a,b)=>{ const s=(T.sides||[]).find(q=>(q.between[0]===a&&q.between[1]===b)||(q.between[0]===b&&q.between[1]===a)); return s?s.label:undefined; }; const BASE=sl(FIGURE,V[1],V[2]), ALT=FIGURE.altitude&&FIGURE.altitude.label;\n`;

type Spec = { v: string[]; foot: string; p: number; q: number; h: number };
/** 높이 h 의 꼭대기 A 에서 밑변 BC 에 내린 수선의 발 D(BD = p, DC = q) — 두 밑각(B·C)의 참값을 value 로 주어 그림이 실제 비율대로 그려지게 한다. */
function areaBody(t: Spec, l: { base?: string; alt?: string; ab?: string; ac?: string }) {
  const [A, B, C] = t.v;
  // 밑변·높이가 둘 다 숫자 라벨이면 렌더러가 비율만 지켜 그리며 발을 밑변의 40% 지점에 둔다 — 값(value)도 그 배치로 준다.
  const num = (s?: string) => (s && /^\d+(?:\.\d+)?$/.test(s) ? Number(s) : null);
  const bw = num(l.base), hw = num(l.alt); const pp = bw !== null && hw !== null ? 0.4 * bw : t.p, qq = bw !== null && hw !== null ? 0.6 * bw : t.q, hh = bw !== null && hw !== null ? hw : t.h;
  return {
    vertices: t.v as Tri3, kind: "scalene",
    sides: [...(l.base ? [{ between: [B, C] as [string, string], label: l.base }] : []), ...(l.ab ? [{ between: [A, B] as [string, string], label: l.ab }] : []), ...(l.ac ? [{ between: [A, C] as [string, string], label: l.ac }] : [])],
    angles: [{ at: B, arc: false, value: round1(deg(Math.atan2(hh, pp))) }, { at: C, arc: false, value: round1(deg(Math.atan2(hh, qq))) }],
    altitude: { from: A, foot: t.foot, ...(l.alt ? { label: l.alt } : {}) },
  };
}
const names = (rng: Rng, p: number, q: number, h: number): Spec => { const n = rng.shuffle(pickN(rng, 4)); return { v: n.slice(0, 3).sort(), foot: n[3], p, q, h }; };
const S1 = (t: Spec) => [`The figure shows triangle $${t.v.join("")}$ with the altitude from $${t.v[0]}$ drawn to the base $${t.v[1]}${t.v[2]}$.`, `Triangle $${t.v.join("")}$ is shown with its altitude $${t.v[0]}${t.foot}$ to side $${t.v[1]}${t.v[2]}$.`, `In the figure shown, $${t.v[0]}${t.foot}$ is the altitude of triangle $${t.v.join("")}$ to side $${t.v[1]}${t.v[2]}$.`, `A sketch of triangle $${t.v.join("")}$ and its altitude from $${t.v[0]}$ is shown.`, `The diagram shown gives the base and the height of triangle $${t.v.join("")}$.`, `Consider triangle $${t.v.join("")}$ in the figure shown, where $${t.v[0]}${t.foot}$ is perpendicular to $${t.v[1]}${t.v[2]}$.`];
const S2 = ["The lengths are in the same unit.", "All lengths shown are in centimeters.", "Lengths are given in the same unit.", "The measurements are in meters.", ""];
const intro = (rng: Rng, t: Spec, extra = "") => `${lead(rng)}${rng.pick(S1(t))} ${rng.pick(S2)}${extra}`.replace(/\s+$/, "").replace(/ {2,}/g, " ");
const unitOf = (stim: string) => (/centimeters/.test(stim) ? "square centimeters" : /meters/.test(stim) ? "square meters" : "square units");
const rd = (t: Spec, b: string, h: string): [string, string] => [`그림에서 밑변 ${t.v[1]}${t.v[2]} = ${b}, 높이 ${t.v[0]}${t.foot} = ${h} 를 읽는다.`, "Read the base and the height from the figure."];

/** 밑변 b, 높이 h 인 삼각형 스펙: 발 위치 p(왼쪽 조각)는 b 의 25~65%. */
function plain(rng: Rng, o: { bMin?: number; bMax?: number; hMin?: number; hMax?: number } = {}): { t: Spec; b: number; h: number } {
  for (let tr = 0; tr < 200; tr++) {
    const b = rng.int(o.bMin ?? 6, o.bMax ?? 24), h = rng.int(o.hMin ?? 4, o.hMax ?? 16); const p = Math.round(b * (0.3 + 0.35 * rng.next()));
    if (p < 2 || b - p < 2 || h / b > 1.1 || b / h > 3.2) continue; return { t: names(rng, p, b - p, h), b, h };
  }
  throw new GenFail("삼각형 표집 실패");
}

export const ITEM = defineItem({
  prefix: "av", itemId: "area_volume.triangle_area.TR.P",
  hard: [
    {
      op: "inverse", structure: "삼각형의 넓이가 지문에 주어지고 밑변이 그림에 라벨일 때 넓이 공식을 거꾸로 써서 높이를 구함", extra: "넓이 = ½ × 밑변 × 높이 에서 높이 = 2 × 넓이 ÷ 밑변 으로 역산(½ 를 빠뜨리면 높이가 절반이 되는 함정) — medium 은 넓이 계산",
      concepts: ["삼각형의 넓이", "역산", "방정식"],
      gen(rng) {
        const { t, b, h } = plain(rng, { bMin: 8, hMin: 5 }); const area = (b * h) / 2; if (!Number.isInteger(area)) throw new GenFail("정수 넓이");
        const fig = { type: "triangle", ...areaBody(t, { base: String(b), alt: "h" }) };
        const stim = intro(rng, t, ` The area of triangle $${t.v.join("")}$ is ${area} square units.`);
        return geoInst(rng, {
          stimulus: stim, question: rng.pick([`What is the value of $h$, the height of the triangle?`, `What is the length of the altitude, labeled $h$?`, `The altitude of the triangle is labeled $h$. What is its length?`]), correct: h,
          wrongs: [W(h * 2, "formula_misuse", "½ 를 곱하지 않고 넓이 ÷ 밑변 으로 구했다."), W(Math.round(h / 2), "formula_misuse", "½ 를 두 번 적용했다."), W(area - b, "formula_misuse", "넓이에서 밑변을 뺐다."), W(b, "partial", "밑변을 답했다."), W(h + 2, "other", "계산 중 어긋났다.")],
          verificationJs: figJs({ area }, fig, `${TA_JS}const b=num(BASE); if (!Number.isFinite(b)||ALT!=='h') throw new Error('라벨 형식'); return 2*P.area/b;`),
          trace: [[`그림에서 밑변 ${t.v[1]}${t.v[2]} = ${b}, 높이는 h 이고 넓이는 ${area} 이다.`, "Read the base; the area is given."], [`삼각형의 넓이는 ½ × 밑변 × 높이 이다.`, "Area of a triangle = ½ × base × height."], [`${area} = ½ × ${b} × h 이다.`, "Substitute the known values."], [`h = 2 × ${area} ÷ ${b} = ${h} 이다.`, "Solve for h."], [`따라서 ${h} 이다.`, "State the height."]], variant: "height_from_area",
        }, fig);
      },
    },
    {
      op: "chain2", structure: "직각삼각형의 빗변과 한 직각변이 그림에 라벨일 때 피타고라스 정리로 다른 직각변을 구한 뒤 넓이를 구함", extra: "빗변을 직각변으로 오인하지 않고 피타고라스로 빠진 직각변을 구한 뒤 ½ 공식에 대입하는 2단계 — medium 은 두 직각변으로 넓이",
      concepts: ["삼각형의 넓이", "피타고라스 정리"],
      gen(rng) {
        const [a0, b0, c0] = rng.pick(TRIPLES.filter((q) => q[2] <= 41)); const [p, q] = rng.chance(0.5) ? [a0, b0] : [b0, a0]; const nm = pickN(rng, 3); const showBase = rng.chance(0.5);
        const fig = { type: "triangle", vertices: nm as Tri3, kind: "right", rightAngleAt: nm[0], horizontal: [nm[0], nm[1]] as [string, string], sides: [{ between: showBase ? [nm[0], nm[1]] : [nm[0], nm[2]], label: String(showBase ? p : q) }, { between: [nm[1], nm[2]], label: String(c0) }], angles: [{ at: nm[1], arc: false, value: round1(deg(Math.atan2(q, p))) }] };
        const area = (p * q) / 2;
        return geoInst(rng, {
          stimulus: `${lead(rng)}${rng.pick([`The figure shows right triangle $${nm.join("")}$ with the right angle at $${nm[0]}$.`, `Right triangle $${nm.join("")}$ is shown, and its right angle is at vertex $${nm[0]}$.`, `In the figure shown, triangle $${nm.join("")}$ is a right triangle with a right angle at $${nm[0]}$.`])} ${rng.pick(["Two of its side lengths are labeled.", "The lengths of two sides are marked in the same unit.", "Two side lengths are given in the figure."])}`, question: rng.pick([`What is the area of the triangle, in square units?`, `What is the area of triangle $${nm.join("")}$?`, `How many square units is the area of the triangle?`]), correct: area,
          wrongs: [W(((showBase ? p : q) * c0) / 2, "formula_misuse", "빗변을 직각변으로 보고 넓이를 구했다."), W(p * q, "formula_misuse", "½ 를 곱하지 않았다."), W((p + q) / 2, "formula_misuse", "두 직각변의 합의 절반을 답했다."), W(area + 6, "other", "계산 중 어긋났다.")],
          verificationJs: figJs({}, fig, `${NUM_JS}const sd=FIGURE.sides; if (sd.length!==2) throw new Error('두 변 라벨 필요'); const L=sd.map(s=>num(s.label)); const hyp=Math.max(...L), leg=Math.min(...L); if (!(hyp>leg)) throw new Error('빗변 오류'); const other=Math.sqrt(hyp*hyp-leg*leg); return Math.round(leg*other/2*1e6)/1e6;`),
          trace: [[`그림에서 직각삼각형의 두 변 ${showBase ? p : q} 과 ${c0} 을 읽는다. ${c0} 은 직각 맞은편이므로 빗변이다.`, "Read the labels; the longer side is the hypotenuse."], [`다른 직각변은 √(${c0}² - ${showBase ? p : q}²) = ${showBase ? q : p} 이다.`, "Pythagorean theorem for the missing leg."], [`두 직각변은 ${p}, ${q} 이다.`, "The two legs."], [`넓이 = ½ × ${p} × ${q} = ${area} 이다.`, "Area = ½ × leg × leg."], [`따라서 ${area} 이다.`, "State the area."]], variant: "right_triangle_area_via_pythagoras",
        }, fig);
      },
    },
    {
      op: "repr_shift", structure: "삼각형의 밑변이 x 의 일차식 라벨이고 높이가 숫자 라벨, 넓이가 지문에 주어질 때 넓이 공식을 방정식으로 옮겨 x 를 구함", extra: "넓이 공식을 일차방정식으로 번역해 x 를 풀어야 함(밑변 식 전체가 아니라 x 만 답해야 함) — medium 은 밑변 숫자로 넓이",
      concepts: ["삼각형의 넓이", "일차방정식", "식의 번역"],
      gen(rng) {
        const k = rng.int(1, 8), x = rng.int(2, 12); const b = x + k; if (b < 8) throw new GenFail("밑변 작음"); const hLo = Math.ceil(b / 3 / 2), hHi = Math.floor((b * 1.1) / 2); if (hHi < hLo) throw new GenFail("비율"); const h = rng.int(hLo, hHi) * 2; const area = (b * h) / 2; const p = Math.max(2, Math.round(b * 0.45)); if (b - p < 2) throw new GenFail("비율");
        const t = names(rng, p, b - p, h); const fig = { type: "triangle", ...areaBody(t, { base: `x + ${k}`, alt: String(h) }) };
        return geoInst(rng, {
          stimulus: intro(rng, t, ` The area of triangle $${t.v.join("")}$ is ${area} square units, and $x$ is a positive number.`), question: rng.pick([`What is the value of $x$?`, `In the figure shown, what is the value of $x$?`]), correct: x,
          wrongs: [W(b, "step_missing", "밑변의 길이를 답했다."), W(Math.round((2 * area) / h) + k, "sign_error", "상수항을 더했다."), W(Math.round(area / h) - k, "formula_misuse", "½ 를 두 번 적용했다."), W(x + 2, "other", "계산 중 어긋났다."), W(Math.round(area / h), "formula_misuse", "½ 를 두 번 적용하고 상수항을 무시했다.")],
          verificationJs: figJs({ area }, fig, `${TA_JS}const e=lin(BASE); const h=num(ALT); if (e.a!==1||!Number.isFinite(h)) throw new Error('라벨 형식'); return 2*P.area/h-e.b;`),
          trace: [[`그림에서 밑변 ${t.v[1]}${t.v[2]} = x + ${k}, 높이 ${t.v[0]}${t.foot} = ${h} 이다.`, "Read the base expression and the height."], [`넓이 = ½ × 밑변 × 높이 이므로 ${area} = ½ × (x + ${k}) × ${h} 이다.`, "Set up the area equation."], [`x + ${k} = 2 × ${area} ÷ ${h} = ${b} 이다.`, "Isolate the base."], [`x = ${b} - ${k} = ${x} 이다.`, "Solve for x."], [`따라서 ${x} 이다.`, "State x."]], variant: "x_from_area_equation",
        }, fig);
      },
    },
    {
      op: "compare_scenarios", structure: "두 삼각형의 밑변과 높이가 각각 라벨일 때 두 넓이의 차를 구함", extra: "각 삼각형의 넓이를 따로 구해 큰 쪽에서 작은 쪽을 빼는 비교 — 밑변끼리·높이끼리만 비교하는 함정, medium 은 한 삼각형의 넓이",
      concepts: ["삼각형의 넓이", "비교"],
      gen(rng) {
        const a = plain(rng, { bMin: 6, bMax: 20 }), c = plain(rng, { bMin: 6, bMax: 20 }); const A1 = (a.b * a.h) / 2, A2 = (c.b * c.h) / 2; if (A1 === A2) throw new GenFail("같은 넓이");
        const t1 = a.t, t2 = c.t; const used = new Set([...t1.v, t1.foot]); const nm = rng.shuffle(pickN(rng, 8).filter((n) => !used.has(n))).slice(0, 4); if (nm.length < 4) throw new GenFail("이름 부족");
        const s2: Spec = { v: nm.slice(0, 3).sort(), foot: nm[3], p: c.t.p, q: c.t.q, h: c.h };
        const fig = { type: "triangle", notToScale: true, ...areaBody(t1, { base: String(a.b), alt: String(a.h) }), second: { ...areaBody(s2, { base: String(c.b), alt: String(c.h) }), scale: 1 } };
        const d = Math.abs(A1 - A2);
        return geoInst(rng, {
          stimulus: `${lead(rng)}${rng.pick([`The figure shows triangles $${t1.v.join("")}$ and $${s2.v.join("")}$, each with its altitude drawn to the base.`, `Two triangles, $${t1.v.join("")}$ and $${s2.v.join("")}$, are shown with their bases and heights labeled.`, `In the figure shown, the base and the height of each of the triangles $${t1.v.join("")}$ and $${s2.v.join("")}$ are labeled.`])} ${rng.pick(S2.slice(0, 4))}`.trim(), question: rng.pick([`What is the positive difference between the areas of the two triangles?`, `By how many square units do the areas of the two triangles differ?`, `What is the difference between the larger area and the smaller area?`]), correct: d,
          wrongs: [W(A1 + A2, "formula_misuse", "두 넓이의 합을 답했다."), W(Math.abs(a.b - c.b) * Math.abs(a.h - c.h) / 2, "formula_misuse", "밑변의 차와 높이의 차로 구했다."), W(Math.max(A1, A2), "partial", "넓이가 큰 쪽만 답했다."), W(d + 4, "other", "계산 중 어긋났다.")],
          verificationJs: figJs({}, fig, `${NUM_JS}const ar=(T)=>{ const sd=(T.sides||[]).find(s=>s.between.includes(T.vertices[1])&&s.between.includes(T.vertices[2])); const b=num(sd.label), h=num(T.altitude.label); if(!Number.isFinite(b)||!Number.isFinite(h)) throw new Error('라벨 형식'); return b*h/2; }; return Math.abs(ar(FIGURE)-ar(FIGURE.second));`),
          trace: [[`첫 삼각형: 밑변 ${a.b}, 높이 ${a.h}. 둘째 삼각형: 밑변 ${c.b}, 높이 ${c.h}.`, "Read both bases and heights."], [`첫 삼각형의 넓이 = ½ × ${a.b} × ${a.h} = ${A1} 이다.`, "Area of the first triangle."], [`둘째 삼각형의 넓이 = ½ × ${c.b} × ${c.h} = ${A2} 이다.`, "Area of the second triangle."], [`차 = |${A1} - ${A2}| = ${d} 이다.`, "Subtract the smaller from the larger."], [`따라서 ${d} 이다.`, "State the difference."]], variant: "area_difference_two_triangles",
        }, fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "area_from_base_height", structure: "삼각형 그림의 밑변과 높이(수선) 라벨로 넓이를 구함", extra: "easy: ½ × 밑변 × 높이 한 번 적용", concepts: ["삼각형의 넓이"],
      gen(rng) {
        const { t, b, h } = plain(rng); const area = (b * h) / 2; const fig = { type: "triangle", ...areaBody(t, { base: String(b), alt: String(h) }) };
        const stim = intro(rng, t);
        return geoInst(rng, { stimulus: stim, question: rng.pick([`What is the area of triangle $${t.v.join("")}$?`, `What is the area of the triangle, in square units?`, `How many square units is the area of the triangle shown?`]), correct: area, wrongs: [W(b * h, "formula_misuse", "½ 를 곱하지 않았다."), W(b + h, "formula_misuse", "밑변과 높이를 더했다."), W(Math.round((b + h) / 2), "formula_misuse", "합의 절반을 답했다."), W(area + 4, "other", "계산 중 어긋났다.")], verificationJs: figJs({}, fig, `${TA_JS}const b=num(BASE), h=num(ALT); if(!Number.isFinite(b)||!Number.isFinite(h)) throw new Error('라벨 형식'); return b*h/2;`), trace: [rd(t, String(b), String(h)), [`넓이 = ½ × ${b} × ${h} = ${area} 이다.`, "Area = ½ × base × height."]], variant: "area_base_height",
        }, fig);
      },
    },
    {
      lv: "medium", name: "area_cost", structure: "삼각형 그림의 밑변·높이로 넓이를 구한 뒤 단위 넓이당 가격을 곱해 비용을 구함", extra: "medium: 넓이를 먼저 구하고(½ 공식) 단가를 곱하는 2단계", concepts: ["삼각형의 넓이", "단가 곱하기"],
      gen(rng) {
        const { t, b, h } = plain(rng); const area = (b * h) / 2; const rate = rng.int(2, 9); const item = rng.pick([["a triangular sail", "fabric", "The fabric costs"], ["a triangular garden bed", "sod", "The sod costs"], ["a triangular banner", "cloth", "The cloth costs"], ["a triangular patio", "paving", "The paving costs"]]);
        const fig = { type: "triangle", ...areaBody(t, { base: String(b), alt: String(h) }) };
        return geoInst(rng, { stimulus: `${lead(rng)}${rng.pick(S1(t))} The triangle represents ${item[0]}, with all lengths in feet. ${item[2]} ${rate} dollars per square foot.`, question: rng.pick([`What is the total cost of the ${item[1]} needed to cover the triangle, in dollars?`, `What is the cost, in dollars, to cover the entire triangle with ${item[1]}?`]), correct: area * rate, wrongs: [W(area, "step_missing", "단가를 곱하지 않았다."), W(b * h * rate, "formula_misuse", "½ 를 곱하지 않았다."), W((b + h) * rate, "formula_misuse", "밑변과 높이를 더해 단가를 곱했다."), W(area * rate + rate, "other", "계산 중 어긋났다.")], fmt: (v) => `${v}`, verificationJs: figJs({ rate }, fig, `${TA_JS}const b=num(BASE), h=num(ALT); if(!Number.isFinite(b)||!Number.isFinite(h)) throw new Error('라벨 형식'); return b*h/2*P.rate;`), trace: [rd(t, String(b), String(h)), [`넓이 = ½ × ${b} × ${h} = ${area} 제곱피트 이다.`, "Area = ½ × base × height."], [`비용 = ${area} × ${rate} = ${area * rate} 달러 이다.`, "Multiply by the cost per square foot."]], variant: "triangle_cost",
        }, fig);
      },
    },
  ],
});
