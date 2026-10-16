// right_triangles_trigonometry — hard 원형 12개(세부 패턴 3 × 연산자 4) + easy 2 + medium 3 원형. 그림 없이 서술만으로 성립.
import { GenFail, type Archetype } from "../types";
import { facts, frac, lin, spin, withParams } from "../text";
import { gcd } from "../rng";
import { asLevel, withBind, type LArch } from "../levels-d";
import { W, NAMES3, NEUTRAL_CTX as GEO_CTX, fin as finish, art, SING } from "./d-kit";
import type { Rng } from "../rng";

const SKILL = "right_triangles_trigonometry";
const PRIM: [number, number, number][] = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [12, 35, 37], [9, 40, 41]];
const isSq = (n: number) => { const r = Math.round(Math.sqrt(n)); return r * r === n; };
/** 정수 직각삼각형 (a<b<c). maxC 이하. */
function triple(rng: Rng, maxC: number): [number, number, number] {
  const t = rng.pick(PRIM); const k = rng.int(1, Math.max(1, Math.floor(maxC / t[2]))); const r: [number, number, number] = [t[0] * k, t[1] * k, t[2] * k];
  if (r[2] > maxC) throw new GenFail("x"); return r;
}
const DATA_CTX_SAFE = ["", "", "A surveyor is measuring heights. ", "A student practices indirect measurement. ", "An engineer checks a structure's height. ", "A scout estimates how tall an object is. ", "A park ranger is mapping landmarks. "];
const ctx = (rng: Rng) => GEO_CTX[rng.int(0, GEO_CTX.length - 1)];
const RIGHT = (A: string, B: string, C: string) => [`Triangle ${A}${B}${C} has a right angle at ${B}.`, `In right triangle ${A}${B}${C}, the right angle is at vertex ${B}.`, `Angle ${B} of triangle ${A}${B}${C} measures 90 degrees.`];

export const RT_HARD: Archetype[] = [
  // ───────── pythagorean_hypotenuse ─────────
  {
    id: "rt.pythagorean_hypotenuse.inverse", skill: SKILL, kind: "pythagorean_hypotenuse", operator: "inverse",
    structure: "직각삼각형의 빗변과 둘레가 주어질 때 두 다리의 합과 피타고라스 관계를 연립해 긴 다리(또는 넓이)를 역산",
    extraThinking: "빗변·둘레에서 두 다리의 합 s 를 구하고 a² + b² = c² 와 연립해 곱·차를 끌어내는 역산(다리를 직접 모르는 상태) — medium 은 두 다리로 빗변 계산",
    concepts: ["피타고라스 정리", "둘레 조건", "연립(합·곱) 역산"], mediumSteps: 2,
    generate(rng) {
      const [a, b, c] = triple(rng, 90); const s = a + b; const per = a + b + c; const ask = rng.int(0, 1); const [A, B, C] = rng.pick(NAMES3);
      const area = (a * b) / 2; const correct = ask === 0 ? b : area;
      const stimulus = ctx(rng) + facts(rng, [RIGHT(A, B, C), [`Its hypotenuse is ${c} units long and its perimeter is ${per} units.`, `The hypotenuse measures ${c} units, and the perimeter of the triangle is ${per} units.`, `The perimeter is ${per} units, and the side opposite the right angle is ${c} units long.`]]);
      return withBind(finish(rng, {
        stimulus, question: spin(rng, ask === 0 ? `[[What is the length, in units, of the longer leg?|Find the length of the longer leg, in units.]]` : `[[What is the area of the triangle, in square units?|Find the area of the triangle, in square units.]]`),
        correct, wrongs: ask === 0 ? [W(a, "other", "짧은 다리를 답했다."), W(s / 2, "formula_misuse", "두 다리가 같다고 보고 합을 반으로 나눴다."), W(s, "step_missing", "두 다리의 합을 답했다."), W(b + 1, "other", "계산 중 1 어긋났다."), W(b - 1, "other", "계산 중 1 어긋났다.")] : [W(a * b, "step_missing", "넓이에서 1/2 를 곱하지 않았다."), W(s * s / 2, "formula_misuse", "합의 제곱을 반으로 나눴다."), W(((a + b) * c) / 2, "formula_misuse", "빗변을 높이로 보고 넓이를 계산했다."), W(area + a, "other", "계산 중 어긋났다."), W(Math.abs(area - 10), "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ c, per, ask }, "let out=null;\nfor(let a=1;a<P.c;a++){ const b=P.per-P.c-a; if(b>=a && a*a+b*b===P.c*P.c){ out=(P.ask===0)?b:a*b/2; } }\nif(out===null) throw new Error('해 없음');\nreturn out;"),
        trace: [
          [`두 다리를 a, b 라 하면 a + b = 둘레 - 빗변 = ${per} - ${c} = ${s} 이다.`, "Find the sum of the legs."],
          [`피타고라스 정리: a² + b² = ${c}² = ${c * c} 이다.`, "Write the Pythagorean relation."],
          [`(a + b)² = a² + b² + 2ab 이므로 ${s * s} = ${c * c} + 2ab 이고 ab = ${(s * s - c * c) / 2} 이다.`, "Combine to get the product."],
          [`a, b 는 t² - ${s}t + ${a * b} = 0 의 두 근이므로 ${a} 와 ${b} 이다.`, "Recover the legs as roots."],
          [ask === 0 ? `긴 다리는 ${b} 이다.` : `넓이 = ab/2 = ${area} 이다.`, "Select the requested quantity."],
        ],
        variant: ask === 0 ? "perimeter_leg" : "perimeter_area",
      }), [{ noun: ["hypotenuse", "opposite the right angle"], value: c }, { noun: "perimeter", value: per }]);
    },
  },
  {
    id: "rt.pythagorean_hypotenuse.compose_kind", skill: SKILL, kind: "pythagorean_hypotenuse", operator: "compose_kind",
    structure: "직사각형의 대각선을 피타고라스로 구한 뒤 그 길이를 한 변(정사각형)·지름(원)으로 삼는 도형의 둘레를 계산",
    extraThinking: "직사각형 대각선 → 다른 도형의 치수라는 서로 다른 두 도형 개념의 연결과 최종 공식(정사각형 둘레·원둘레) 선택 — medium 은 두 다리로 빗변만 계산",
    concepts: ["피타고라스 정리", "직사각형의 대각선", "정사각형·원의 둘레"], mediumSteps: 2,
    generate(rng) {
      const [a, b, c] = triple(rng, 90); const mode = rng.int(0, 1); const w = rng.chance(0.5) ? [a, b] : [b, a];
      const correct = mode === 0 ? 4 * c : c; const fmt = (v: number) => (mode === 0 ? String(v) : `$${v}\\pi$`);
      const shape = mode === 0 ? [`A square has a side length equal to the length of a diagonal of the rectangle.`, `A square is drawn whose side is exactly as long as the rectangle's diagonal.`, `The side of a square equals the diagonal of the rectangle.`] : [`A circle has a diameter equal to the length of a diagonal of the rectangle.`, `A circle is drawn whose diameter is exactly as long as the rectangle's diagonal.`, `The diameter of a circle equals the diagonal of the rectangle.`];
      const stimulus = ctx(rng) + facts(rng, [[`A rectangle has side lengths ${w[0]} and ${w[1]}.`, `The sides of a rectangle measure ${w[0]} and ${w[1]}.`, `A rectangular field is ${w[0]} by ${w[1]}.`, `One wall of a gym is a rectangle that is ${w[0]} feet long and ${w[1]} feet high.`, `A rectangular banner has a width of ${w[0]} and a height of ${w[1]}.`, `A rectangle with sides ${w[0]} and ${w[1]} is cut from a sheet of metal.`], shape]);
      return withBind(finish(rng, {
        stimulus, fmt, question: mode === 0 ? spin(rng, `[[What is the perimeter of the square?|Find the perimeter of the square.]]`) : spin(rng, `[[What is the circumference of the circle? (Express the answer in terms of $\\pi$.)|Find the circumference of the circle in terms of $\\pi$.]]`),
        correct, wrongs: [W(mode === 0 ? c : 1 * (a + b), "step_missing", mode === 0 ? "대각선(한 변)만 구하고 둘레를 계산하지 않았다." : "지름이 아니라 두 변의 합을 답했다."), W(mode === 0 ? 2 * (a + b) : 2 * c, "formula_misuse", mode === 0 ? "직사각형의 둘레를 답했다." : "반지름이 아니라 지름 2배를 곱했다."), W(mode === 0 ? 4 * (a + b) : a + b + c, "formula_misuse", "대각선 대신 두 변의 합을 한 변으로 썼다."), W(mode === 0 ? c * c : (c * c) / 4, "formula_misuse", "둘레가 아니라 넓이 공식을 썼다."), W(mode === 0 ? 4 * c + 4 : c + 2, "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ a: w[0], b: w[1], mode }, "const d=Math.hypot(P.a,P.b);\nreturn P.mode===0?4*d:d;"),
        trace: [
          [`직사각형의 대각선은 두 변을 다리로 하는 직각삼각형의 빗변이다.`, "Treat the diagonal as the hypotenuse."],
          [`피타고라스 정리: d² = ${w[0]}² + ${w[1]}² = ${w[0] ** 2 + w[1] ** 2} 이다.`, "Apply the Pythagorean theorem."],
          [`d = ${c} 이다.`, "Take the square root."],
          [mode === 0 ? `정사각형의 한 변이 ${c} 이다.` : `원의 지름이 ${c} 이다.`, "Transfer the length to the second figure."],
          [mode === 0 ? `둘레 = 4 × ${c} = ${4 * c} 이다.` : `원둘레 = π × 지름 = ${c}π 이다.`, "Apply the perimeter formula."],
        ],
        variant: mode === 0 ? "square_on_diagonal" : "circle_on_diagonal",
      }), [{ noun: "rectang", value: w[0] }]);
    },
  },
  {
    id: "rt.pythagorean_hypotenuse.chain2", skill: SKILL, kind: "pythagorean_hypotenuse", operator: "chain2",
    structure: "첫 직각삼각형의 빗변 AC 를 구하고 그 AC 를 다리로 하는 둘째 직각삼각형 ACD 의 빗변 AD 를 구함",
    extraThinking: "앞 삼각형의 빗변이 뒤 삼각형의 다리가 되는 2단계 피타고라스 연쇄 — medium 은 직각삼각형 하나",
    concepts: ["피타고라스 정리", "빗변→다리 재사용", "두 삼각형 연결"], mediumSteps: 2,
    generate(rng) {
      const [a, b, c] = triple(rng, 40); const cand: [number, number][] = []; for (let e = 2; e <= 60; e++) { const f2 = c * c + e * e; if (isSq(f2)) cand.push([e, Math.round(Math.sqrt(f2))]); }
      if (!cand.length) throw new GenFail("x"); const [e, f] = rng.pick(cand); const [A, B, C] = rng.pick(NAMES3); const D = rng.pick(["D", "E", "F", "G"].filter((n) => ![A, B, C].includes(n)));
      const stimulus = ctx(rng) + facts(rng, [[`In triangle ${A}${B}${C}, angle ${B} is a right angle, ${A}${B} = ${a}, and ${B}${C} = ${b}.`, `Triangle ${A}${B}${C} has a right angle at ${B}, with legs ${A}${B} = ${a} and ${B}${C} = ${b}.`], [`Point ${D} is placed so that angle ${A}${C}${D} is a right angle and ${C}${D} = ${e}.`, `A second right angle is formed at ${C}: angle ${A}${C}${D} measures 90 degrees, and ${C}${D} = ${e}.`, `A point ${D} satisfies ${C}${D} = ${e} and angle ${A}${C}${D} = 90 degrees.`]]);
      return withBind(finish(rng, {
        stimulus, question: spin(rng, `[[What is the length of ${A}${D}?|Find the length of segment ${A}${D}.|How long is ${A}${D}?]]`),
        correct: f, wrongs: [W(c, "step_missing", "첫 삼각형의 빗변에서 멈췄다."), W(a + b + e, "formula_misuse", "세 선분의 길이를 더했다."), W(Math.sqrt(a * a + b * b + e) || 0, "formula_misuse", "마지막 제곱을 빠뜨렸다."), W(Math.round(Math.sqrt(a * a + e * e)), "geometry_misapplied", "AB 와 CD 를 다리로 잘못 짝지었다."), W(Math.round(Math.sqrt(b * b + e * e)), "geometry_misapplied", "BC 와 CD 를 다리로 잘못 짝지었다."), W(f + 1, "other", "계산 중 1 어긋났다.")],
        verificationJs: withParams({ a, b, e }, "const ac=Math.hypot(P.a,P.b);\nreturn Math.round(Math.hypot(ac,P.e)*1e6)/1e6;"),
        trace: [
          [`삼각형 ${A}${B}${C} 는 ${B}에서 직각이므로 ${A}${C}² = ${a}² + ${b}² = ${a * a + b * b} 이다.`, "Apply Pythagoras in the first triangle."],
          [`${A}${C} = ${c} 이다.`, "Take the square root."],
          [`삼각형 ${A}${C}${D} 는 ${C}에서 직각이고 다리는 ${A}${C} = ${c}, ${C}${D} = ${e} 이다.`, "Identify the second right triangle."],
          [`${A}${D}² = ${c}² + ${e}² = ${c * c + e * e} 이다.`, "Apply Pythagoras again."],
          [`${A}${D} = ${f} 이다.`, "Take the square root."],
        ],
        variant: "two_right_triangles",
      }), [{ noun: `${A}${B}`, value: a }, { noun: `${C}${D}`, value: e }]);
    },
  },
  {
    id: "rt.pythagorean_hypotenuse.unit_ratio", skill: SKILL, kind: "pythagorean_hypotenuse", operator: "unit_ratio",
    structure: "두 다리가 서로 다른 단위(m·cm, ft·in 등)로 주어졌을 때 같은 단위로 통일해 빗변을 구하고 묻는 단위로 환산",
    extraThinking: "단위를 통일한 뒤에만 피타고라스를 적용할 수 있다는 점과 답의 단위 환산(큰/작은 단위 선택) — medium 은 같은 단위의 두 다리",
    concepts: ["피타고라스 정리", "단위 환산", "빗변의 단위 결정"], mediumSteps: 2,
    generate(rng) {
      const [u1, u2, f] = rng.pick([["meters", "centimeters", 100], ["feet", "inches", 12], ["yards", "feet", 3], ["centimeters", "millimeters", 10]] as const);
      const [a, b, c] = triple(rng, 25); const l1 = a, l2 = b * f; if (l2 > 999 || c * f > 999) throw new GenFail("x"); const ask = rng.int(0, 1);
      const [A, B, C] = rng.pick(NAMES3); const correct = ask === 0 ? c : c * f;
      const stimulus = ctx(rng) + facts(rng, [RIGHT(A, B, C).map((s) => s), [`One leg is ${l1} ${u1} long and the other leg is ${l2} ${u2} long.`, `The legs measure ${l1} ${u1} and ${l2} ${u2}.`, `Leg ${A}${B} is ${l1} ${u1}, and leg ${B}${C} is ${l2} ${u2}.`]].map((g, i) => (i === 0 ? [g[rng.int(0, 2)]] : g)));
      return withBind(finish(rng, {
        stimulus, question: spin(rng, `[[What is the length of the hypotenuse, in ${ask === 0 ? u1 : u2}?|Find the hypotenuse of the triangle, in ${ask === 0 ? u1 : u2}.]]`),
        correct, wrongs: [W(Math.round(Math.sqrt(l1 * l1 + l2 * l2)), "unit_error", "단위를 통일하지 않고 숫자를 그대로 제곱해 더했다."), W(ask === 0 ? c * f : c, "unit_error", "묻는 단위가 아닌 다른 단위로 답했다."), W(ask === 0 ? l1 + b : l2 + a * f, "formula_misuse", "빗변이 아니라 다리의 합을 답했다."), W(correct + f, "other", "계산 중 어긋났다."), W(ask === 0 ? (c * f) / f / f : c * f * f, "unit_error", "환산 방향(곱/나눔)을 거꾸로 적용했다.")],
        verificationJs: withParams({ a: l1, b: l2, ask }, `const F=${f};\nconst L1=P.a*F, L2=P.b; const h=Math.hypot(L1,L2);\nreturn Math.round((P.ask===0?h/F:h)*1e6)/1e6;`),
        trace: [
          [`단위를 통일한다: ${l1} ${u1} = ${l1 * f} ${u2} 이다.`, "Convert to a common unit."],
          [`피타고라스 정리: h² = ${l1 * f}² + ${l2}² 이다.`, "Apply the Pythagorean theorem."],
          [`h² = ${(l1 * f) ** 2 + l2 ** 2} 이므로 h = ${c * f} ${u2} 이다.`, "Evaluate the hypotenuse."],
          [`묻는 단위로 환산한다: ${ask === 0 ? `${c * f} ${u2} = ${c} ${u1}` : `${c * f} ${u2}`} 이다.`, "Convert to the requested unit."],
          [`답은 ${correct} 이다.`, "Answer."],
        ],
        variant: "mixed_units",
      }), [{ noun: "leg", value: l1 }]);
    },
  },
  // ───────── pythagorean_leg ─────────
  {
    id: "rt.pythagorean_leg.inverse", skill: SKILL, kind: "pythagorean_leg", operator: "inverse",
    structure: "빗변과 넓이가 주어졌을 때 (a+b)² = c² + 4T 로 두 다리의 합을 구하고 둘레(또는 짧은 다리)를 역산",
    extraThinking: "다리를 모르는 상태에서 넓이와 빗변만으로 합·차를 거꾸로 구성(곱 ab = 2T 와 a² + b² = c² 결합) — medium 은 빗변과 한 다리로 다른 다리 계산",
    concepts: ["피타고라스 정리", "직각삼각형의 넓이", "합·곱 관계 역산"], mediumSteps: 2,
    generate(rng) {
      const [a, b, c] = triple(rng, 90); const T = (a * b) / 2; if (!Number.isInteger(T) || T > 999) throw new GenFail("x"); const ask = rng.int(0, 1); const [A, B, C] = rng.pick(NAMES3);
      const correct = ask === 0 ? a + b + c : a;
      const stimulus = ctx(rng) + facts(rng, [RIGHT(A, B, C), [`Its hypotenuse is ${c} units and its area is ${T} square units.`, `The area of the triangle is ${T} square units, and its hypotenuse measures ${c} units.`]]);
      return withBind(finish(rng, {
        stimulus, question: spin(rng, ask === 0 ? `[[What is the perimeter of the triangle, in units?|Find the perimeter, in units.]]` : `[[What is the length of the shorter leg, in units?|Find the shorter leg of the triangle, in units.]]`),
        correct, wrongs: ask === 0 ? [W(a + b, "step_missing", "빗변을 더하지 않고 두 다리의 합만 답했다."), W(c + T, "formula_misuse", "넓이를 길이처럼 더했다."), W(b + c, "step_missing", "짧은 다리를 빠뜨렸다."), W(a + b + c + 2, "other", "계산 중 어긋났다."), W(2 * c + 2 * Math.sqrt(T) || 0, "formula_misuse", "다리가 같다고 가정했다.")] : [W(b, "other", "긴 다리를 답했다."), W(T / c, "formula_misuse", "넓이를 빗변으로 나눠 높이로 봤다."), W(2 * T / c, "formula_misuse", "빗변을 밑변으로 한 높이를 답했다."), W(a + 1, "other", "계산 중 1 어긋났다."), W(Math.abs(a - 1), "other", "계산 중 1 어긋났다.")],
        verificationJs: withParams({ c, T, ask }, "let out=null;\nfor(let a=1;a<P.c;a++) for(let b=a;b<P.c;b++){ if(a*a+b*b===P.c*P.c && a*b===2*P.T){ out=(P.ask===0)?a+b+P.c:a; } }\nif(out===null) throw new Error('해 없음');\nreturn out;"),
        trace: [
          [`두 다리를 a, b 라 하면 ab/2 = ${T} 이므로 ab = ${2 * T} 이다.`, "Use the area to get the product of the legs."],
          [`피타고라스 정리: a² + b² = ${c}² = ${c * c} 이다.`, "Write the Pythagorean relation."],
          [`(a + b)² = ${c * c} + 2 × ${2 * T} = ${c * c + 4 * T} 이므로 a + b = ${a + b} 이다.`, "Find the sum of the legs."],
          [`(b - a)² = ${c * c} - ${4 * T} = ${c * c - 4 * T} 이므로 b - a = ${b - a} 이다.`, "Find the difference of the legs."],
          [`따라서 a = ${a}, b = ${b} 이다.`, "Solve for the legs."],
          [ask === 0 ? `둘레 = ${a} + ${b} + ${c} = ${a + b + c} 이다.` : `짧은 다리는 ${a} 이다.`, "Give the requested value."],
        ],
        variant: ask === 0 ? "area_hyp_perimeter" : "area_hyp_leg",
      }), [{ noun: ["hypotenuse"], value: c }, { noun: "area", value: T }]);
    },
  },
  {
    id: "rt.pythagorean_leg.chain2", skill: SKILL, kind: "pythagorean_leg", operator: "chain2",
    structure: "길이가 고정된 사다리가 벽에 기대어 있을 때 발끝을 당긴 뒤 두 높이를 각각 피타고라스로 구해 미끄러진 거리를 구함",
    extraThinking: "같은 빗변에서 다리를 두 번 구하고 두 결과의 차(미끄러진 거리)를 구하는 2회 연쇄 — medium 은 한 번의 다리 계산",
    concepts: ["피타고라스 정리(다리)", "두 상황 비교", "차이 계산"], mediumSteps: 2,
    generate(rng) {
      const L = rng.pick([10, 13, 15, 17, 20, 25, 26, 29, 30, 34, 35, 37, 39, 40]); const xs: number[] = []; for (let x = 1; x < L; x++) if (isSq(L * L - x * x)) xs.push(x);
      if (xs.length < 2) throw new GenFail("x"); const i = rng.int(0, xs.length - 2); const x1 = xs[i], x2 = xs[rng.int(i + 1, xs.length - 1)]; const k = x2 - x1; const h1 = Math.round(Math.sqrt(L * L - x1 * x1)), h2 = Math.round(Math.sqrt(L * L - x2 * x2)); const slide = h1 - h2;
      if (slide <= 0 || k > 40) throw new GenFail("x");
      const [obj, wall, unit] = rng.pick([["ladder", "vertical wall", "feet"], ["rod", "vertical fence", "feet"], ["pole", "vertical wall", "meters"], ["plank", "vertical shelf", "inches"], ["beam", "vertical post", "feet"]]);
      const stimulus = GEO_CTX[rng.int(0, GEO_CTX.length - 1)] + facts(rng, [[`A ${obj} ${L} ${unit} long leans against a ${wall}, with its base ${x1} ${unit} from the ${wall.split(" ")[1]}.`, `${art(L).replace("a", "A").replace("an", "An")} ${L}-${SING[unit]} ${obj} rests against a ${wall}. The bottom of the ${obj} is ${x1} ${unit} away from the ${wall.split(" ")[1]}.`, `The bottom of a ${obj} that is ${L} ${unit} long is placed ${x1} ${unit} from a ${wall}, and the top touches the ${wall.split(" ")[1]}.`], [`The base is then pulled ${k} ${unit} farther from the ${wall.split(" ")[1]}, and the top slides down the ${wall.split(" ")[1]}.`, `Then the bottom is moved ${k} ${unit} farther away, so the top slides down.`, `After the base is dragged ${k} ${unit} farther out, the top slips lower along the ${wall.split(" ")[1]}.`]]);
      return withBind(finish(rng, {
        stimulus, question: spin(rng, `[[How far, in ${unit}, does the top of the ${obj} slide down?|By how many ${unit} does the top of the ${obj} move down the ${wall.split(" ")[1]}?|What is the vertical distance, in ${unit}, that the top slides?]]`),
        correct: slide, wrongs: [W(k, "other", "당긴 거리를 그대로 답했다."), W(h1, "step_missing", "처음 높이만 구했다."), W(h2, "step_missing", "나중 높이만 구했다."), W(h1 + h2, "sign_error", "두 높이의 차가 아니라 합을 답했다."), W(L - h2, "formula_misuse", "사다리 길이에서 나중 높이를 뺐다."), W(slide + 1, "other", "계산 중 1 어긋났다.")],
        verificationJs: withParams({ L, x1, k }, "const h=(x)=>Math.sqrt(P.L*P.L-x*x);\nreturn Math.round((h(P.x1)-h(P.x1+P.k))*1e6)/1e6;"),
        trace: [
          [`처음 높이 h₁ = √(${L}² - ${x1}²) = ${h1} 이다.`, "Find the first height."],
          [`밑이 ${k} 만큼 멀어지면 벽에서 ${x1 + k} 만큼 떨어진다.`, "Update the base distance."],
          [`나중 높이 h₂ = √(${L}² - ${x2}²) = ${h2} 이다.`, "Find the second height."],
          [`미끄러진 거리 = h₁ - h₂ = ${h1} - ${h2} 이다.`, "Subtract the heights."],
          [`답은 ${slide} 이다.`, "Answer."],
        ],
        variant: "slide_down",
      }), [{ noun: obj, value: L }, { noun: ["base", "bottom"], value: x1 }]);
    },
  },
  {
    id: "rt.pythagorean_leg.constraint_select", skill: SKILL, kind: "pythagorean_leg", operator: "constraint_select",
    structure: "한 다리가 n 이고 모든 변이 정수이며 빗변이 H 이하인 직각삼각형의 개수를 (c-b)(c+b) = n² 의 같은 홀짝 약수쌍으로 셈",
    extraThinking: "c² - b² = n² 을 (c-b)(c+b) 인수분해로 바꿔 홀짝이 같은 약수쌍만 인정하고 빗변 상한과 경계 포함 여부를 추적 — medium 은 빗변과 한 다리로 다른 다리 계산",
    concepts: ["피타고라스 정리", "인수분해와 약수쌍", "정수 해 개수 세기"], mediumSteps: 2,
    generate(rng) {
      const n = rng.pick([12, 15, 16, 20, 21, 24, 28, 30, 32, 35, 36, 40, 45, 48]); const sols: [number, number][] = []; for (let b = 1; b <= 3 * n * n; b++) { const c2 = n * n + b * b; if (isSq(c2) && b !== n) sols.push([b, Math.round(Math.sqrt(c2))]); if (sols.length >= 12) break; }
      sols.sort((x, y) => x[1] - y[1]); if (sols.length < 3) throw new GenFail("x"); const idx = rng.int(1, Math.min(sols.length - 1, 6)); const H = sols[idx][1]; const correct = sols.filter((s) => s[1] <= H).length;
      const lt = sols.filter((s) => s[1] < H).length; if (correct < 2 || correct > 8 || lt === correct || H > 300) throw new GenFail("x");
      const all = (() => { let c = 0; for (let d = 1; d * d < n * n; d++) if ((n * n) % d === 0 && ((n * n) / d - d) > 0) c++; return c; })();
      const stimulus = ctx(rng) + facts(rng, [[`Consider right triangles in which every side length is a positive integer and one leg has length ${n}.`, `A right triangle has integer side lengths, and one of its legs is ${n} units long.`, `Look at all right triangles whose three side lengths are positive integers and that have a leg of length ${n}.`], [`The hypotenuse is at most ${H}.`, `Each hypotenuse is no longer than ${H}.`, `Only triangles with hypotenuse ${H} or less are allowed.`], [`Triangles with the same three side lengths count once.`, `Two triangles are the same if their side lengths match.`]]);
      return withBind(finish(rng, {
        stimulus, question: spin(rng, `[[How many different such triangles are there?|How many triangles satisfy all of these conditions?|Find the number of triangles that meet the conditions.]]`),
        correct, wrongs: [W(lt, "condition_ignored", "'이하'를 '미만'으로 읽어 경계(빗변 = H)를 뺐다."), W(all > 0 ? all : correct + 2, "condition_ignored", "홀짝이 같은 약수쌍만 인정하는 조건과 빗변 상한을 무시하고 약수쌍을 모두 셌다."), W(correct + 1, "step_missing", "경계값을 하나 더 센다."), W(correct - 1, "step_missing", "경계값을 하나 뺀다."), W(2 * correct, "formula_misuse", "두 다리를 바꾼 삼각형을 서로 다른 것으로 중복해 센다.")],
        verificationJs: withParams({ n, H }, "let c=0;\nfor(let b=1;b<=P.H;b++){ const c2=P.n*P.n+b*b; const h=Math.round(Math.sqrt(c2)); if(h*h===c2 && h<=P.H && b!==P.n) c++; }\nreturn c;"),
        trace: [
          [`다른 다리를 b, 빗변을 c 라 하면 c² - b² = ${n}² = ${n * n} 이다.`, "Set up c² - b² = n²."],
          [`인수분해하면 (c - b)(c + b) = ${n * n} 이다.`, "Factor the difference of squares."],
          [`c - b = d, c + b = e (d < e, d·e = ${n * n}) 이고 b = (e - d)/2 가 정수이려면 d, e 의 홀짝이 같아야 한다.`, "Keep only factor pairs with equal parity."],
          [`각 쌍에서 c = (d + e)/2 를 구하고 c ≤ ${H} 인 것만 남긴다.`, "Apply the hypotenuse bound."],
          [`b = ${n} 인 경우(이등변)는 정수 해가 없음을 확인한다.`, "Check the excluded case."],
          [`조건을 만족하는 삼각형은 ${correct} 개이다.`, "Count."],
        ],
        variant: "integer_triangles_with_leg",
      }), [{ noun: "leg", value: n }, { noun: "hypotenuse", value: H }]);
    },
  },
  {
    id: "rt.pythagorean_leg.repr_shift", skill: SKILL, kind: "pythagorean_leg", operator: "repr_shift",
    structure: "'두 다리의 차' 또는 '빗변이 긴 다리보다 e 크다'는 문장을 이차·일차 방정식으로 번역해 변의 길이를 구함",
    extraThinking: "문장 관계를 변수식(x, x + d)으로 번역해 피타고라스 식에 대입하고 이차방정식을 풀어 양의 근을 고름 — medium 은 두 변의 숫자를 직접 대입",
    concepts: ["피타고라스 정리", "문장→방정식", "이차(일차)방정식 풀이"], mediumSteps: 2,
    generate(rng) {
      const mode = rng.int(0, 1); const [A, B, C] = rng.pick(NAMES3);
      if (mode === 0) {
        const [a, b, c] = triple(rng, 70); const d = b - a; if (d < 1 || a < 3) throw new GenFail("x"); const ask = rng.int(0, 1); const correct = ask === 0 ? a : a + b + c;
        const stimulus = ctx(rng) + facts(rng, [RIGHT(A, B, C), [`The longer leg is ${d} units longer than the shorter leg, and the hypotenuse is ${c} units long.`, `One leg exceeds the other by ${d} units, and the hypotenuse measures ${c} units.`, `The two legs differ in length by ${d} units, and the side opposite the right angle is ${c} units.`]]);
        return withBind(finish(rng, {
          stimulus, question: spin(rng, ask === 0 ? `[[What is the length of the shorter leg, in units?|Find the shorter leg, in units.]]` : `[[What is the perimeter of the triangle, in units?|Find the perimeter, in units.]]`),
          correct, wrongs: [W(ask === 0 ? b : a + b, "other", ask === 0 ? "긴 다리를 답했다." : "빗변을 더하지 않았다."), W(ask === 0 ? c - d : 2 * c, "formula_misuse", "다리의 차를 빗변에서 바로 뺐다."), W(ask === 0 ? Math.round(c / Math.SQRT2) : a + b + c - d, "formula_misuse", "두 다리가 같다고 가정했다."), W(correct + 1, "other", "계산 중 1 어긋났다."), W(Math.abs(correct - 2), "other", "계산 중 2 어긋났다.")],
          verificationJs: withParams({ d, c, ask }, "let out=null;\nfor(let x=1;x<P.c;x++){ if(x*x+(x+P.d)*(x+P.d)===P.c*P.c){ out=(P.ask===0)?x:2*x+P.d+P.c; } }\nif(out===null) throw new Error('해 없음');\nreturn out;"),
          trace: [
            [`짧은 다리를 x 라 하면 긴 다리는 x + ${d} 이다.`, "Define the legs."],
            [`피타고라스 정리: x² + (x + ${d})² = ${c}² 이다.`, "Substitute into the Pythagorean relation."],
            [`전개하면 2x² + ${2 * d}x + ${d * d} = ${c * c} 이다.`, "Expand."],
            [`정리하면 x² + ${d}x - ${(c * c - d * d) / 2} = 0 이다.`, "Reduce to a monic quadratic."],
            [`인수분해하면 (x - ${a})(x + ${a + d}) = 0 이므로 양의 근 x = ${a} 이다.`, "Solve and keep the positive root."],
            [ask === 0 ? `짧은 다리는 ${a} 이다.` : `둘레 = ${a} + ${b} + ${c} = ${a + b + c} 이다.`, "Give the requested value."],
          ],
          variant: "legs_differ",
        }), [{ noun: ["hypotenuse", "opposite the right angle"], value: c }, { noun: ["longer leg", "one leg", "legs"], value: d }]);
      }
      const [a, b, c] = triple(rng, 90); const e = c - b; if (e < 1 || e > 12) throw new GenFail("x"); const correct = c;
      const stimulus = ctx(rng) + facts(rng, [RIGHT(A, B, C), [`One leg is ${a} units long, and the hypotenuse is ${e} unit${e === 1 ? "" : "s"} longer than the other leg.`, `The hypotenuse exceeds the unknown leg by ${e}, and the known leg is ${a} units.`, `A leg of ${a} units is given; the hypotenuse is ${e} more than the remaining leg.`]]);
      return withBind(finish(rng, {
        stimulus, question: spin(rng, `[[What is the length of the hypotenuse, in units?|Find the hypotenuse, in units.]]`),
        correct, wrongs: [W(b, "other", "미지의 다리를 답했다."), W(a + e, "formula_misuse", "주어진 다리에 차를 그대로 더했다."), W(Math.round(Math.sqrt(a * a + e * e)), "formula_misuse", "차 e 를 다른 다리로 착각했다."), W(b - e, "sign_error", "빗변에서 e 를 뺐다."), W(c + 1, "other", "계산 중 1 어긋났다.")],
        verificationJs: withParams({ a, e }, "let out=null;\nfor(let y=1;y<2000;y++){ if(P.a*P.a+y*y===(y+P.e)*(y+P.e)) out=y+P.e; }\nif(out===null) throw new Error('해 없음');\nreturn out;"),
        trace: [
          [`다른 다리를 y 라 하면 빗변은 y + ${e} 이다.`, "Define the unknown leg and the hypotenuse."],
          [`피타고라스 정리: ${a}² + y² = (y + ${e})² 이다.`, "Substitute."],
          [`y² 이 양변에서 소거되어 ${a * a} = ${2 * e}y + ${e * e} 이다.`, "Cancel the quadratic term."],
          [`y = (${a * a} - ${e * e}) / ${2 * e} = ${b} 이다.`, "Solve the linear equation."],
          [`빗변 = ${b} + ${e} = ${c} 이다.`, "Compute the hypotenuse."],
        ],
        variant: "hyp_exceeds_leg",
      }), [{ noun: "leg", value: a }]);
    },
  },
  // ───────── trig_ratio ─────────
  {
    id: "rt.trig_ratio.inverse", skill: SKILL, kind: "trig_ratio", operator: "inverse",
    structure: "sin A = p/q 와 A 의 대변 길이가 주어졌을 때 빗변을 거꾸로 구한 뒤 피타고라스로 다른 변(또는 둘레)을 구함",
    extraThinking: "삼각비 값에서 변의 길이를 역산(비 → 실제 길이 배율)한 뒤 피타고라스로 나머지 변을 구하는 다단계 — medium 은 두 변으로 삼각비 계산",
    concepts: ["사인의 정의", "비례 배율", "피타고라스 정리"], mediumSteps: 2,
    generate(rng) {
      const t = rng.pick(PRIM); const k = rng.int(1, 6); const opp = t[0] * k, adj = t[1] * k, hyp = t[2] * k; const sw = rng.chance(0.5); const [p, q] = sw ? [t[1], t[2]] : [t[0], t[2]];
      const o = sw ? adj : opp, a2 = sw ? opp : adj; const ask = rng.int(0, 1); if (hyp > 150) throw new GenFail("x"); const [A, B, C] = rng.pick(NAMES3); const correct = ask === 0 ? a2 : o + a2 + hyp;
      const stimulus = ctx(rng) + facts(rng, [[`In right triangle ${A}${B}${C}, the right angle is at ${C}, and $\\sin ${A} = \\frac{${p}}{${q}}$.`, `Triangle ${A}${B}${C} has a right angle at ${C}, and the sine of angle ${A} is $\\frac{${p}}{${q}}$.`, `Angle ${C} of triangle ${A}${B}${C} is a right angle. It is known that $\\sin ${A} = \\frac{${p}}{${q}}$.`], [`The side opposite angle ${A} has length ${o}.`, `Side ${B}${C}, which lies opposite angle ${A}, is ${o} units long.`]]);
      return withBind(finish(rng, {
        stimulus, question: spin(rng, ask === 0 ? `[[What is the length of side ${A}${C}?|Find the length of ${A}${C}.]]` : `[[What is the perimeter of triangle ${A}${B}${C}?|Find the perimeter of the triangle.]]`),
        correct, wrongs: ask === 0 ? [W(hyp, "other", "빗변을 답했다."), W(o, "other", "대변을 그대로 답했다."), W((o * p) / q || 1, "formula_misuse", "비를 거꾸로 곱했다."), W(Math.round(Math.sqrt(hyp * hyp + o * o)), "formula_misuse", "빗변과 대변을 다리로 착각했다."), W(a2 + 1, "other", "계산 중 1 어긋났다.")] : [W(o + hyp, "step_missing", "한 변을 빠뜨렸다."), W(2 * hyp, "formula_misuse", "빗변의 2배를 답했다."), W(o + a2, "step_missing", "빗변을 더하지 않았다."), W(correct + 2, "other", "계산 중 2 어긋났다."), W(o + 2 * hyp, "formula_misuse", "빗변을 두 번 더했다.")],
        verificationJs: withParams({ p, q, o, ask }, "let out=null;\nfor(let h=1;h<400;h++){ if(h*P.p===P.o*P.q){ const adj=Math.sqrt(h*h-P.o*P.o); if(Number.isInteger(adj)) out=(P.ask===0)?adj:P.o+adj+h; } }\nif(out===null) throw new Error('해 없음');\nreturn out;"),
        trace: [
          [`사인 = 대변/빗변 이므로 ${o}/빗변 = ${p}/${q} 이다.`, "Write sine as opposite over hypotenuse."],
          [`빗변 = ${o} × ${q}/${p} = ${hyp} 이다.`, "Solve for the hypotenuse."],
          [`피타고라스 정리: ${A}${C}² = ${hyp}² - ${o}² = ${hyp * hyp - o * o} 이다.`, "Apply Pythagoras for the remaining leg."],
          [`${A}${C} = ${a2} 이다.`, "Take the square root."],
          [ask === 0 ? `답은 ${a2} 이다.` : `둘레 = ${o} + ${a2} + ${hyp} = ${o + a2 + hyp} 이다.`, "Give the requested value."],
        ],
        variant: ask === 0 ? "sine_to_side" : "sine_to_perimeter",
      }), [{ noun: [`sin ${A}`, `sine of angle ${A}`], value: `\\frac{${p}}{${q}}` }]);
    },
  },
  {
    id: "rt.trig_ratio.compose_kind", skill: SKILL, kind: "trig_ratio", operator: "compose_kind",
    structure: "빗변과 sin A = p/q 로 두 다리를 구하고(삼각비 + 피타고라스) 넓이를 계산",
    extraThinking: "삼각비로 한 다리를 구하고 피타고라스로 다른 다리를 구해 넓이 공식과 합성(세 개념 연결) — medium 은 두 변으로 삼각비 값만 계산",
    concepts: ["사인의 정의", "피타고라스 정리", "직각삼각형의 넓이"], mediumSteps: 2,
    generate(rng) {
      const t = rng.pick(PRIM); const k = rng.int(1, 6); const a = t[0] * k, b = t[1] * k, c = t[2] * k; if (c > 130) throw new GenFail("x"); const use = rng.int(0, 1); const [p, q] = use === 0 ? [t[0], t[2]] : [t[1], t[2]]; const area = (a * b) / 2; const [A, B, C] = rng.pick(NAMES3);
      const stimulus = ctx(rng) + facts(rng, [[`In right triangle ${A}${B}${C}, the right angle is at ${C}, and the hypotenuse ${A}${B} is ${c} units long.`, `Triangle ${A}${B}${C} is right-angled at ${C}, with hypotenuse ${A}${B} = ${c}.`], [`The sine of angle ${A} is $\\frac{${p}}{${q}}$.`, `It is given that $\\sin ${A} = \\frac{${p}}{${q}}$.`]]);
      return withBind(finish(rng, {
        stimulus, question: spin(rng, `[[What is the area of the triangle, in square units?|Find the area of triangle ${A}${B}${C}, in square units.]]`),
        correct: area, wrongs: [W(a * b, "step_missing", "넓이에서 1/2 를 곱하지 않았다."), W((c * (use === 0 ? a : b)) / 2, "formula_misuse", "빗변과 한 다리를 밑변·높이로 썼다."), W(Math.round((c * c * p) / q / 2), "formula_misuse", "다리 대신 빗변의 제곱을 썼다."), W(area + c, "other", "계산 중 어긋났다."), W(Math.abs(area - c), "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ c, p, q }, "let out=null;\nfor(let x=1;x<P.c;x++){ if(x*P.q===P.c*P.p){ const y=Math.sqrt(P.c*P.c-x*x); if(Number.isInteger(y)) out=x*y/2; } }\nif(out===null) throw new Error('해 없음');\nreturn out;"),
        trace: [
          [`sin ${A} = ${B}${C}/${A}${B} 이므로 ${B}${C} = ${c} × ${p}/${q} = ${use === 0 ? a : b} 이다.`, "Find the side opposite A from the sine."],
          [`피타고라스 정리: ${A}${C}² = ${c}² - ${use === 0 ? a : b}² = ${c * c - (use === 0 ? a : b) ** 2} 이다.`, "Find the other leg."],
          [`${A}${C} = ${use === 0 ? b : a} 이다.`, "Take the square root."],
          [`두 다리가 밑변과 높이이므로 넓이 = (1/2) × ${a} × ${b} 이다.`, "Use the legs as base and height."],
          [`넓이 = ${area} 이다.`, "Compute."],
        ],
        variant: "sine_to_area",
      }), [{ noun: "hypotenuse", value: c }]);
    },
  },
  {
    id: "rt.trig_ratio.chain2", skill: SKILL, kind: "trig_ratio", operator: "chain2",
    structure: "한 지점에서 탑 꼭대기를 본 고도각의 탄젠트와, d 만큼 가까이 간 지점의 탄젠트 두 값으로 두 거리를 미지수로 세워 탑의 높이를 구함",
    extraThinking: "두 관측점의 tan 을 각각 거리 식으로 세우고 같은 높이로 연결해 거리·높이를 연쇄로 구함(2단계 연립) — medium 은 한 번의 tan 로 높이 계산",
    concepts: ["탄젠트의 정의", "두 관측점 연립", "분수 방정식"], mediumSteps: 2,
    generate(rng) {
      const h = rng.int(6, 60), x2 = rng.int(3, 40), x1 = x2 + rng.int(2, 30); const g1 = gcd(h, x1), g2 = gcd(h, x2); const [p1, q1] = [h / g1, x1 / g1], [p2, q2] = [h / g2, x2 / g2]; const d = x1 - x2;
      if (p1 === p2 && q1 === q2) throw new GenFail("x"); if (Math.max(p1, q1, p2, q2) > 60 || x1 > 90) throw new GenFail("x");
      const [obj, unit] = rng.pick([["tower", "meters"], ["cliff", "meters"], ["building", "feet"], ["flagpole", "feet"], ["lighthouse", "meters"]]);
      const stimulus = DATA_CTX_SAFE[rng.int(0, DATA_CTX_SAFE.length - 1)] + facts(rng, [[`From a point on level ground, the tangent of the angle of elevation to the top of a ${obj} is $\\frac{${p1}}{${q1}}$.`, `An observer on flat ground sees the top of a ${obj} at an angle of elevation whose tangent is $\\frac{${p1}}{${q1}}$.`, `Standing on level ground, a person looks up at the top of a ${obj}; the tangent of the angle of elevation is $\\frac{${p1}}{${q1}}$.`, `The angle of elevation from a spot on flat ground to the top of a ${obj} has tangent $\\frac{${p1}}{${q1}}$.`], [`After walking ${d} ${unit} straight toward the ${obj}, the tangent of the angle of elevation is $\\frac{${p2}}{${q2}}$.`, `Moving ${d} ${unit} closer along a straight line, the observer finds the tangent of the new angle of elevation to be $\\frac{${p2}}{${q2}}$.`, `The person then walks ${d} ${unit} directly toward the ${obj}; now the tangent of the angle of elevation to the top is $\\frac{${p2}}{${q2}}$.`, `A step of ${d} ${unit} toward the base of the ${obj} changes the tangent of the elevation angle to $\\frac{${p2}}{${q2}}$.`]]);
      return withBind(finish(rng, {
        stimulus, question: spin(rng, `[[What is the height of the ${obj}, in ${unit}?|How tall is the ${obj}, in ${unit}?|Find the height of the ${obj}, in ${unit}.|What is the vertical height of the top of the ${obj} above the ground, in ${unit}?|The ${obj} is how many ${unit} tall?]]`),
        correct: h, wrongs: [W(x2, "other", "나중 거리를 답했다."), W(x1, "other", "처음 거리를 답했다."), W(d, "other", "걸은 거리를 답했다."), W(Math.round((d * p1) / q1) || 1, "formula_misuse", "걸은 거리에 첫 tan 만 곱했다."), W(h + d, "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ p1, q1, p2, q2, d }, "let out=null;\nfor(let x2=1;x2<400;x2++){ const x1=x2+P.d; if(x1*P.p1*P.q2===x2*P.p2*P.q1){ out=x2*P.p2/P.q2; } }\nif(out===null) throw new Error('해 없음');\nreturn out;"),
        trace: [
          [`처음 거리를 x + ${d}, 나중 거리를 x 라 하면 높이 h 는 h = (x + ${d})·${p1}/${q1} 이다.`, "Express the height from the first point."],
          [`나중 지점에서는 h = x·${p2}/${q2} 이다.`, "Express the height from the second point."],
          [`두 식을 같게 놓으면 (x + ${d})·${p1}/${q1} = x·${p2}/${q2} 이다.`, "Equate the two heights."],
          [`분수를 정리해 x 를 풀면 x = ${x2} 이다.`, "Solve for x."],
          [`h = ${x2} × ${p2}/${q2} = ${h} 이다.`, "Compute the height."],
        ],
        variant: "two_elevation_angles",
      }), [{ noun: "tangent", value: `\\frac{${p1}}{${q1}}` }].concat([]));
    },
  },
  {
    id: "rt.trig_ratio.repr_shift", skill: SKILL, kind: "trig_ratio", operator: "repr_shift",
    structure: "경사로의 기울기(오름:수평 = p:q)와 수평 거리가 주어지면 오름 높이를 구한 뒤 피타고라스로 경사로 표면의 길이를 구함",
    extraThinking: "'기울기 = tan' 이라는 문장을 비례식으로 번역하고 (수평, 오름)을 다리로 하는 직각삼각형을 세워 빗변을 구하는 모델링 — medium 은 두 다리가 직접 주어짐",
    concepts: ["기울기와 탄젠트", "비례식", "피타고라스 정리"], mediumSteps: 2,
    generate(rng) {
      const t = rng.pick(PRIM); const k = rng.int(1, 8); const flip = rng.chance(0.5); const [rise, run] = flip ? [t[1], t[0]] : [t[0], t[1]]; const R = run * k, H = rise * k, L = t[2] * k; if (L > 200 || R > 200) throw new GenFail("x");
      const [thing, unit] = rng.pick([["ramp", "feet"], ["wheelchair ramp", "feet"], ["road", "meters"], ["roof", "feet"], ["ski slope", "meters"]]);
      const ask = rng.int(0, 1); const correct = ask === 0 ? L : H;
      const stimulus = ctx(rng) + facts(rng, [[`A ${thing} rises ${rise} ${unit} for every ${run} ${unit} of horizontal distance.`, `The slope of a ${thing} is ${rise} to ${run}: it rises ${rise} ${unit} over each ${run} ${unit} of horizontal run.`, `A ${thing} climbs ${rise} ${unit} vertically for each ${run} ${unit} traveled horizontally.`], [`Its total horizontal run is ${R} ${unit}.`, `The ${thing} covers a horizontal distance of ${R} ${unit}.`, `Measured along the ground, the ${thing} spans ${R} ${unit}.`]]);
      return withBind(finish(rng, {
        stimulus, question: spin(rng, ask === 0 ? `[[What is the length of the ${thing} along its surface, in ${unit}?|How long is the sloped surface of the ${thing}, in ${unit}?]]` : `[[What is the total vertical rise of the ${thing}, in ${unit}?|By how many ${unit} does the ${thing} rise in total?]]`),
        correct, wrongs: ask === 0 ? [W(R + H, "formula_misuse", "수평과 오름의 합을 답했다."), W(H, "step_missing", "오름만 구하고 멈췄다."), W(R, "other", "수평 거리를 그대로 답했다."), W(Math.round(Math.sqrt(R * R - H * H)) || 1, "sign_error", "피타고라스에서 제곱을 더하지 않고 뺐다."), W(L + k, "other", "계산 중 어긋났다.")] : [W(Math.round((R * run) / rise), "formula_misuse", "기울기를 거꾸로 곱했다."), W(L, "other", "표면 길이를 답했다."), W(R - rise * 1, "formula_misuse", "수평에서 기울기 분자를 뺐다."), W(H + k, "other", "계산 중 어긋났다."), W(Math.abs(H - k), "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ rise, run, R, ask }, "const H=P.R*P.rise/P.run; const L=Math.hypot(H,P.R);\nreturn Math.round((P.ask===0?L:H)*1e6)/1e6;"),
        trace: [
          [`기울기 = 오름/수평 = ${rise}/${run} 이므로 오름 = ${R} × ${rise}/${run} 이다.`, "Translate the slope into a proportion."],
          [`오름 = ${H} 이다.`, "Compute the rise."],
          [`수평 ${R} 과 오름 ${H} 는 직각삼각형의 두 다리이다.`, "Treat run and rise as legs."],
          [`표면 길이² = ${R}² + ${H}² = ${R * R + H * H} 이다.`, "Apply Pythagoras."],
          [ask === 0 ? `표면 길이 = ${L} 이다.` : `묻는 오름은 ${H} 이다.`, "Give the requested value."],
        ],
        variant: ask === 0 ? "slope_to_length" : "slope_to_rise",
      }), [{ noun: ["horizontal", "run", "along the ground"], value: R }]);
    },
  },
];
// 위 chain 에서 쓰는 보조 변수(k)가 없는 분기 방지용 — 아래 상수는 오답 후보에서 임의 어긋남에만 쓰인다.
const k = 3;

// ───────── easy / medium ─────────
type Sc = { s: (a: number, b: number, A: string, B: string, C: string) => string; q: (A: string, C: string) => string[] };
const triSc: Sc[] = [
  { s: (a, b, A, B, C) => `In right triangle ${A}${B}${C}, the right angle is at ${B}, ${A}${B} = ${a}, and ${B}${C} = ${b}.`, q: (A, C) => [`What is the length of ${A}${C}?`, `Find the length of the hypotenuse.`, `How long is side ${A}${C}?`] },
  { s: (a, b) => `A rectangular door frame is ${a} feet wide and ${b} feet tall, and a brace is placed along the diagonal.`, q: () => [`How long is the brace, in feet?`, `What is the length of the diagonal brace, in feet?`] },
  { s: (a, b) => `A ladder leans against a vertical wall. Its base is ${a} feet from the wall, and its top touches the wall ${b} feet above the ground.`, q: () => [`How long is the ladder, in feet?`, `What is the length of the ladder, in feet?`] },
  { s: (a, b) => `A hiker walks ${a} miles due east and then ${b} miles due north.`, q: () => [`How far, in miles, is the hiker from the starting point?`, `What is the straight-line distance, in miles, from the start to the finish?`] },
  { s: (a, b) => `A rectangular screen is ${a} inches wide and ${b} inches tall.`, q: () => [`What is the length of the screen's diagonal, in inches?`, `How long is the diagonal of the screen, in inches?`] },
  { s: (a, b) => `A kite string runs from the ground to a kite that is ${b} meters above the ground and ${a} meters horizontally from the person flying it.`, q: () => [`How long is the kite string, in meters?`, `What is the length of the string, in meters?`] },
  { s: (a, b) => `A rectangular park measures ${a} meters by ${b} meters.`, q: () => [`How long is a straight path across the park from one corner to the opposite corner, in meters?`, `What is the length of the diagonal of the park, in meters?`] },
  { s: (a, b) => `A ramp rises ${b} feet over a horizontal distance of ${a} feet.`, q: () => [`How long is the sloped surface of the ramp, in feet?`, `What is the length of the ramp along its surface, in feet?`] },
  { s: (a, b) => `A zip line is anchored at a point on the ground ${a} meters from the base of a pole that is ${b} meters tall and runs to the top of the pole.`, q: () => [`How long is the zip line, in meters?`, `What is the length of the zip line, in meters?`] },
  { s: (a, b) => `Two streets meet at a right angle. A shortcut path connects points ${a} blocks and ${b} blocks from the corner.`, q: () => [`How long is the shortcut, in blocks?`, `What is the length of the shortcut path, in blocks?`] },
];
export const RT_LEVELS: LArch[] = [
  {
    id: "rt.pythagorean_hypotenuse.easy_triple", skill: SKILL, kind: "pythagorean_hypotenuse", operator: "repr_shift", level: "easy",
    structure: "두 다리로 빗변을 구한다(피타고라스 수)", extraThinking: "easy: 피타고라스 정리 한 번", concepts: ["피타고라스 정리", "제곱근"], mediumSteps: 2,
    generate(rng) {
      const [a0, b0, c] = triple(rng, 60); const [a, b] = rng.chance(0.5) ? [a0, b0] : [b0, a0]; const [A, B, C] = rng.pick(NAMES3); const sc = rng.pick(triSc); const stim = sc.s(a, b, A, B, C);
      const q = rng.pick(sc.q(A, C));
      return withBind(finish(rng, {
        stimulus: stim, question: q, correct: c, wrongs: [W(a + b, "formula_misuse", "제곱근을 취하지 않고 두 길이의 합을 답했다."), W(a * a + b * b, "step_missing", "제곱합에서 제곱근을 취하지 않았다."), W(Math.abs(b - a), "formula_misuse", "차를 구했다."), W(c + 1, "other", "계산 중 1 어긋났다."), W(Math.round((a + b) / 2), "formula_misuse", "평균을 구했다.")],
        verificationJs: withParams({ a, b }, "return Math.round(Math.hypot(P.a,P.b)*1e6)/1e6;"),
        trace: [["두 변이 직각을 이루므로 피타고라스 정리를 쓴다.", "Use the Pythagorean theorem."], [`c² = ${a}² + ${b}² = ${a * a + b * b} 이다.`, "Square and add."], [`c = ${c} 이다.`, "Take the square root."]],
        variant: "legs_to_hyp",
      }), [{ noun: "", value: a }].slice(1));
    },
  },
  {
    id: "rt.pythagorean_leg.easy_missing_leg", skill: SKILL, kind: "pythagorean_leg", operator: "repr_shift", level: "easy",
    structure: "빗변과 한 다리로 다른 다리를 구한다", extraThinking: "easy: 피타고라스 정리 한 번(다리 방향)", concepts: ["피타고라스 정리", "제곱근"], mediumSteps: 2,
    generate(rng) {
      const [a, b, c] = triple(rng, 60); const [known, ask] = rng.chance(0.5) ? [a, b] : [b, a]; const [A, B, C] = rng.pick(NAMES3);
      const stim = rng.pick([
        `In right triangle ${A}${B}${C}, the right angle is at ${B}. The hypotenuse ${A}${C} is ${c} units long, and leg ${A}${B} is ${known} units long.`,
        `A ladder ${c} feet long leans against a vertical wall with its base ${known} feet from the wall.`,
        `${art(c).replace("a", "A").replace("an", "An")} ${c}-meter support wire runs from the top of a vertical pole to a point ${known} meters from the pole's base on level ground.`,
        `The diagonal of a rectangular screen is ${c} inches, and one side of the screen is ${known} inches.`,
        `A rectangular field has a diagonal of ${c} meters and one side of ${known} meters.`,
        `A ramp is ${c} feet long and covers a horizontal distance of ${known} feet.`,
        `A ship sails ${c} kilometers in a straight line while moving ${known} kilometers east of its starting point.`,
        `A rectangle has a diagonal of length ${c} and a side of length ${known}.`,
        `A drone flies ${c} meters in a straight line to reach a point directly above a spot ${known} meters from where it started on the ground.`,
        `A television has a diagonal of ${c} inches and a width of ${known} inches.`,
        `A guy wire of length ${c} feet is attached to a pole and anchored ${known} feet from its base.`,
        `A bridge cable is ${c} meters long and its horizontal reach is ${known} meters.`,
      ]);
      const q = stim.startsWith("In right") ? `What is the length of ${B}${C}?` : rng.pick([`What is the length of the missing side, in the same unit?`, `Find the length of the other side.`, `How long is the remaining side?`]);
      return withBind(finish(rng, {
        stimulus: stim, question: q, correct: ask, wrongs: [W(c - known, "formula_misuse", "빗변에서 다리를 그냥 뺐다."), W(Math.round(Math.sqrt(c * c + known * known)), "sign_error", "제곱을 빼지 않고 더했다."), W(c * c - known * known, "step_missing", "제곱차에서 제곱근을 취하지 않았다."), W(ask + 1, "other", "계산 중 1 어긋났다."), W(known, "other", "주어진 다리를 그대로 답했다.")],
        verificationJs: withParams({ c, known }, "return Math.round(Math.sqrt(P.c*P.c-P.known*P.known)*1e6)/1e6;"),
        trace: [["빗변이 주어졌으므로 다른 다리는 a² = c² - b² 로 구한다.", "Use a² = c² - b²."], [`a² = ${c}² - ${known}² = ${c * c - known * known} 이다.`, "Subtract the squares."], [`a = ${ask} 이다.`, "Take the square root."]],
        variant: "hyp_leg_to_leg",
      }), [{ noun: "hypotenuse", value: c }, { noun: "diagonal", value: c }].filter(() => false));
    },
  },
  {
    id: "rt.pythagorean_hypotenuse.med_perimeter", skill: SKILL, kind: "pythagorean_hypotenuse", operator: "chain2", level: "medium",
    structure: "두 다리로 빗변을 구한 뒤 세 변을 더해 둘레를 구한다", extraThinking: "medium: 피타고라스 + 둘레 합산(2단계)", concepts: ["피타고라스 정리", "둘레"], mediumSteps: 2,
    generate(rng) {
      const [a0, b0, c] = triple(rng, 80); const [a, b] = rng.chance(0.5) ? [a0, b0] : [b0, a0]; const per = a + b + c; const sc = rng.pick(triSc); const [A, B, C] = rng.pick(NAMES3);
      const stim = sc.s(a, b, A, B, C) + rng.pick([` Consider the right triangle formed by the two given lengths and the direct segment.`, ` The two given lengths and the direct segment form a right triangle.`, ` Imagine a path that follows all three sides of the right triangle formed.`]);
      const q = rng.pick([`What is the perimeter of the right triangle formed (the sum of all three sides), in the same unit?`, `Find the perimeter of the right triangle formed, in the same unit.`, `What is the total length of all three sides of the right triangle?`]);
      return withBind(finish(rng, {
        stimulus: stim, question: q, correct: per, wrongs: [W(a + b, "step_missing", "빗변을 더하지 않았다."), W(c, "step_missing", "빗변만 답했다."), W(2 * (a + b), "formula_misuse", "직사각형의 둘레로 계산했다."), W(per + 1, "other", "계산 중 1 어긋났다."), W(a + b + a * a + b * b, "formula_misuse", "제곱합을 더했다.")],
        verificationJs: withParams({ a, b }, "return Math.round((P.a+P.b+Math.hypot(P.a,P.b))*1e6)/1e6;"),
        trace: [["빗변을 피타고라스 정리로 구한다.", "Find the hypotenuse."], [`c = √(${a}² + ${b}²) = ${c} 이다.`, "Compute it."], [`둘레 = ${a} + ${b} + ${c} = ${per} 이다.`, "Add the three sides."]],
        variant: "hyp_then_perimeter",
      }), []);
    },
  },
  {
    id: "rt.pythagorean_leg.med_area", skill: SKILL, kind: "pythagorean_leg", operator: "chain2", level: "medium",
    structure: "빗변과 한 다리로 다른 다리를 구한 뒤 넓이를 계산한다", extraThinking: "medium: 피타고라스(다리) + 넓이(2단계)", concepts: ["피타고라스 정리", "직각삼각형의 넓이"], mediumSteps: 2,
    generate(rng) {
      const [a, b, c] = triple(rng, 90); const [known, other] = rng.chance(0.5) ? [a, b] : [b, a]; const area = (a * b) / 2; if (!Number.isInteger(area)) throw new GenFail("x"); const [A, B, C] = rng.pick(NAMES3);
      const stim = GEO_CTX[rng.int(0, GEO_CTX.length - 1)] + rng.pick([`Right triangle ${A}${B}${C} has its right angle at ${B}, hypotenuse ${A}${C} = ${c}, and ${A}${B} = ${known}.`, `A triangular garden has a right angle at one corner. The longest side is ${c} meters and one of the other sides is ${known} meters.`, `A right triangle has a hypotenuse of ${c} centimeters and one leg of ${known} centimeters.`, `A triangular sail is a right triangle whose longest edge is ${c} feet and whose shorter edge next to the right angle is ${known} feet.`.replace("shorter", "known"), `A piece of cardboard is cut into a right triangle with ${art(c)} ${c}-inch hypotenuse and ${art(known)} ${known}-inch leg.`, `A farmer fences a right-triangular plot whose longest fence is ${c} meters and one of the shorter fences is ${known} meters.`, `On graph paper, a right triangle has a hypotenuse of ${c} units and a vertical leg of ${known} units.`, `A roof gable is a right triangle with a slanted edge of ${c} feet and a vertical edge of ${known} feet.`, `A tile is a right triangle: its longest side is ${c} cm and one side next to the right angle is ${known} cm.`]);
      const q = rng.pick([`What is the area of the triangle, in square units?`, `Find the area of the triangle, in square units.`, `How large is the area of this right triangle, in square units?`]);
      return withBind(finish(rng, {
        stimulus: stim, question: q, correct: area, wrongs: [W(known * c / 2, "formula_misuse", "빗변과 다리를 밑변·높이로 썼다."), W(other, "step_missing", "다른 다리만 구하고 넓이를 구하지 않았다."), W(known * other, "step_missing", "넓이에서 1/2 를 곱하지 않았다."), W(area + known, "other", "계산 중 어긋났다."), W(Math.abs(area - other), "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ c, known }, "const o=Math.sqrt(P.c*P.c-P.known*P.known);\nreturn Math.round(P.known*o/2*1e6)/1e6;"),
        trace: [["빗변과 한 다리로 다른 다리를 구한다.", "Find the missing leg."], [`다른 다리 = √(${c}² - ${known}²) = ${other} 이다.`, "Compute it."], [`넓이 = ${known} × ${other} ÷ 2 = ${area} 이다.`, "Use the two legs for the area."]],
        variant: "leg_then_area",
      }), []);
    },
  },
  {
    id: "rt.trig_ratio.med_ratio", skill: SKILL, kind: "trig_ratio", operator: "repr_shift", level: "medium",
    structure: "두 다리로 빗변을 구한 뒤 사인·코사인·탄젠트 값을 기약분수로 구한다", extraThinking: "medium: 삼각비 정의 + 피타고라스(빗변 계산) + 약분", concepts: ["삼각비 정의", "피타고라스 정리", "분수 약분"], mediumSteps: 2,
    generate(rng) {
      const t = rng.pick(PRIM); const k2 = rng.int(1, 4); const a = t[0] * k2, b = t[1] * k2, c = t[2] * k2; const kind = rng.pick(["sin", "cos", "tan"] as const); const at = rng.pick(["A", "B"] as const); const [A, B, C] = rng.pick(NAMES3);
      const opp = at === "A" ? b : a, adj = at === "A" ? a : b; const [n, d] = kind === "sin" ? [opp, c] : kind === "cos" ? [adj, c] : [opp, adj]; const tgt = at === "A" ? A : B;
      const stim = GEO_CTX[rng.int(0, GEO_CTX.length - 1)] + rng.pick([`In right triangle ${A}${B}${C}, the right angle is at ${C}, ${B}${C} = ${b}, and ${A}${C} = ${a}.`, `A right triangle ${A}${B}${C} (right angle at ${C}) has the leg ${A}${C} equal to ${a} and the leg ${B}${C} equal to ${b}.`, `Consider triangle ${A}${B}${C} with a 90-degree angle at ${C}. Its legs are ${A}${C} = ${a} and ${B}${C} = ${b}.`, `Triangle ${A}${B}${C} has a right angle at ${C}. The legs are ${A}${C} = ${a} and ${B}${C} = ${b}.`, `Right triangle ${A}${B}${C} is right-angled at ${C}, with legs of lengths ${a} (${A}${C}) and ${b} (${B}${C}).`]);
      const wr = (nn: number, dd: number, reason: string) => ({ text: frac(nn, dd), kind: "formula_misuse" as const, reason });
      return withBind(finish(rng, {
        stimulus: stim, question: rng.pick([`What is the value of $\\${kind} ${tgt}$?`, `Find $\\${kind} ${tgt}$ as a fraction in lowest terms.`, `Which fraction in lowest terms equals $\\${kind} ${tgt}$?`, `Determine $\\${kind} ${tgt}$.`]), range: [0, 100000], correctText: frac(n, d),
        wrongTexts: [wr(d, n, "비를 거꾸로 썼다(역수)."), wr(kind === "tan" ? opp : adj, c, "대변/인접변을 바꿔 답했다."), wr(kind === "tan" ? opp : opp, adj + c, "빗변을 인접변에 더했다."), wr(kind === "sin" ? adj : opp, kind === "tan" ? c : adj, "정의를 바꿔 계산했다."), wr(n, d + 1, "분모를 잘못 계산했다.")].filter((w) => w.text !== frac(n, d)),
        verificationJs: withParams({ a, b, ask: kind === "sin" ? 0 : kind === "cos" ? 1 : 2, at: at === "A" ? 0 : 1 }, "const c=Math.hypot(P.a,P.b); const opp=P.at===0?P.b:P.a, adj=P.at===0?P.a:P.b; return P.ask===0?opp/c:P.ask===1?adj/c:opp/adj;"),
        trace: [["빗변을 구한다: c = √(a² + b²).", "Find the hypotenuse."], [`c = ${c} 이다.`, "Compute."], [`각 ${tgt} 의 대변은 ${opp}, 인접변은 ${adj} 이다.`, "Identify the opposite and adjacent sides."], [`${kind} ${tgt} = ${n}/${d} = ${frac(n, d)} 이다.`, "Form and reduce the ratio."]],
        variant: kind,
      }), []);
    },
  },
];
export const RT_ALL: LArch[] = [...RT_HARD.map((a) => asLevel(a)), ...RT_LEVELS];
void lin;
