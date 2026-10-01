// circles hard 원형 28개(세부 패턴 7 × 연산자 4) + easy/medium 원형(lite). 그림 없이 서술·식만으로 성립하는 문항.
import { GenFail, type Archetype } from "../types";
import { finish, spin, withParams, M, lin, shifted } from "../text";
import { paraArch, sem, withOpen, OPEN_GEO, piOpt, piDiff, forbidExcept } from "../c-kit";
import type { LiteArchetype } from "../c-lite";
import type { DistractorKind } from "../../review";

const SKILL = "circles";
const W = (v: number, kind: DistractorKind, reason: string) => ({ v, kind, reason });
const UNITS = ["meters", "feet", "centimeters", "inches", "yards"] as const;
const SING: Record<string, string> = { meters: "meter", feet: "foot", centimeters: "centimeter", inches: "inch", yards: "yard" };
const sq = (u: string) => `square ${u}`;
const ROUND = [["fountain", "A circular fountain"], ["pond", "A circular pond"], ["rug", "A circular rug"], ["running track", "A circular running track"], ["plaza", "A circular plaza"], ["stage", "A circular stage"], ["garden", "A circular garden"], ["pool", "A circular pool"], ["roundabout", "A circular roundabout"], ["carousel platform", "A circular carousel platform"], ["dance floor", "A circular dance floor"], ["gazebo floor", "A circular gazebo floor"], ["lawn", "A circular lawn"], ["skating rink", "A circular skating rink"], ["trampoline", "A circular trampoline"], ["drum head", "A circular drum head"], ["coaster", "A circular coaster"], ["table", "A circular table"], ["clock face", "A circular clock face"], ["helipad", "A circular helipad"], ["cake stand", "A circular cake stand"], ["fire pit", "A circular fire pit"], ["sandbox", "A circular sandbox"], ["reflecting pool", "A circular reflecting pool"], ["amphitheater floor", "A circular amphitheater floor"], ["flower bed", "A circular flower bed"], ["water feature", "A circular water feature"], ["game board", "A circular game board"], ["observation deck", "A circular observation deck"], ["mosaic", "A circular mosaic"]] as const;
const WHEELS = [["bicycle wheel", "A bicycle wheel"], ["cart wheel", "A cart wheel"], ["paint roller", "A paint roller"], ["wheelbarrow wheel", "A wheelbarrow wheel"], ["scooter wheel", "A scooter wheel"], ["large gear", "A large gear"], ["skateboard wheel", "A skateboard wheel"], ["tractor wheel", "A tractor wheel"], ["roller skate wheel", "A roller skate wheel"], ["wagon wheel", "A wagon wheel"], ["office chair wheel", "An office chair wheel"], ["toy car wheel", "A toy car wheel"], ["lawn mower wheel", "A lawn mower wheel"], ["stroller wheel", "A stroller wheel"], ["shopping cart wheel", "A shopping cart wheel"]] as const;
const PYTH = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15], [12, 16, 20], [7, 24, 25], [15, 20, 25]] as const;
const PI_DEGREES: [number, string][] = [[60, "60"], [90, "90"], [120, "120"], [45, "45"], [72, "72"], [150, "150"], [30, "30"], [135, "135"], [40, "40"], [80, "80"]];
const term2 = (c: number, v: string) => (c === 0 ? "" : ` ${c > 0 ? "+" : "-"} ${Math.abs(c) === 1 ? "" : Math.abs(c)}${v}`);

export const CI_ARCHETYPES: Archetype[] = ([
  // ───────────── circumference_radius ─────────────
  {
    id: "ci.circumference_radius.inverse", skill: SKILL, kind: "circumference_radius", operator: "inverse",
    structure: "첫 원의 둘레 Cπ 에서 반지름 C/2 를 구하고, 반지름이 k 작은 둘째 원의 넓이 π(C/2−k)² 를 구함",
    extraThinking: "둘레에서 반지름을 역산하고 다른 원의 넓이(다른 양)로 다시 계산 — medium 은 반지름으로 둘레 계산",
    concepts: ["원의 둘레", "반지름 역산", "원의 넓이"], mediumSteps: 1,
    generate(rng) {
      const r = rng.int(5, 20), k = rng.int(2, r - 2); const C = 2 * r, r2 = r - k; const [nm, who] = rng.pick(ROUND); const u = rng.pick(UNITS); const coef = r2 * r2;
      const stimulus = spin(rng, `${who} has a circumference of $${C}\\pi$ ${u}. A second circle has a radius that is ${k} ${u} less than the radius of the ${nm}.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the area of the second circle, in ${sq(u)}, in terms of π?|Find the area of the second circle, in ${sq(u)}, in terms of π.|How many ${sq(u)} does the second circle cover, in terms of π?]]`), correct: coef, fmt: piOpt,
        wrongs: [W(r * r, "step_missing", "첫 번째 원의 넓이를 답했다."), W(r2 * 2, "geometry_misapplied", "둘레 계수를 답했다."), W(r * r - k * k, "formula_misuse", "넓이를 r² − k² 로 계산했다."), W(4 * r2 * r2, "geometry_misapplied", "반지름 대신 지름을 제곱했다."), W(C - k, "step_missing", "둘레에서 k 만 뺐다.")],
        verificationJs: withParams({ C, k }, "const out=[];\nfor(let r=1;r<=200;r++){ if(2*r===P.C){ const r2=r-P.k; if(r2<=0) throw new Error('반지름이 양수 아님'); out.push(r2*r2); } }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          ["원의 둘레는 2πr 이다.", "Circumference formula."],
          [`2πr = ${C}π 이므로 r = ${r} 이다.`, "Recover the first radius."],
          [`둘째 원의 반지름은 ${r} − ${k} = ${r2} 이다.`, "Radius of the second circle."],
          ["넓이는 πr² 이다.", "Area formula."],
          [`π × ${r2}² = ${coef}π 이다.`, "Compute the area."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: C, words: ["circumference"] }, { v: k, words: ["less", "radius", "shorter", "minus"] }], { words: ["area", "cover"], forbid: forbidExcept("area") });
    },
  },
  {
    id: "ci.circumference_radius.unit_ratio", skill: SKILL, kind: "circumference_radius", operator: "unit_ratio",
    structure: "반지름 r cm 인 바퀴가 n 바퀴 구를 때 이동 거리 2πr·n cm 를 m 단위로 환산해 π 계수로 나타냄",
    extraThinking: "원둘레와 회전 수의 곱에 길이 단위 환산(cm→m)을 결합 — medium 은 반지름으로 둘레 계산",
    concepts: ["원의 둘레", "회전 수와 이동 거리", "길이 단위 환산"], mediumSteps: 1,
    generate(rng) {
      const r = rng.pick([10, 20, 25, 30, 40, 50, 15, 5]), n = rng.int(2, 25); const coef = (2 * r * n) / 100; if (!Number.isInteger(coef) || coef < 1 || coef > 300 || r === n) throw new GenFail("x");
      const [nm, who] = rng.pick(WHEELS);
      const stimulus = spin(rng, `${who} has a radius of ${r} centimeters. It rolls along a straight path without slipping and makes exactly ${n} complete [[rotations|turns|revolutions]].`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[How many meters does the ${nm} travel, in terms of π?|What distance, in meters, does the ${nm} travel? Give the answer in terms of π.|Find the distance traveled, in meters, in terms of π.]]`), correct: coef, fmt: piOpt,
        wrongs: [W(coef * 100, "unit_error", "cm 를 m 로 환산하지 않았다."), W(coef / 2, "formula_misuse", "둘레를 πr 로 계산했다(2 를 빼먹음)."), W(coef * 2, "geometry_misapplied", "반지름 대신 지름을 사용해 2πd 로 계산했다."), W(coef / n, "step_missing", "한 바퀴의 거리만 구했다."), W((r * r * n) / 100, "geometry_misapplied", "둘레 대신 넓이 공식을 사용했다.")],
        verificationJs: withParams({ r, n }, "let cm=0; for(let i=0;i<P.n;i++) cm+=2*P.r;\nif(cm%100!==0) throw new Error('정수 아님'); return cm/100;"),
        trace: [
          [`한 바퀴의 이동 거리는 둘레 2π × ${r} = ${2 * r}π cm 이다.`, "One rotation equals the circumference."],
          [`${n} 바퀴이므로 ${2 * r}π × ${n} = ${2 * r * n}π cm 이다.`, "Multiply by the number of rotations."],
          ["1 m = 100 cm 이므로 100 으로 나눈다.", "Convert centimeters to meters."],
          [`${2 * r * n}π ÷ 100 = ${coef}π m 이다.`, "Distance in meters."],
          [`이동 거리는 ${coef}π 미터이다.`, "Answer."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: r, words: ["radius"] }, { v: n, words: ["rotations", "turns", "revolutions", "complete"] }], { words: ["meters", "distance", "travel"], forbid: forbidExcept() });
    },
  },
  {
    id: "ci.circumference_radius.compose_kind", skill: SKILL, kind: "circumference_radius", operator: "compose_kind",
    structure: "반지름 r 인 원이 정사각형에 내접할 때 정사각형 넓이 (2r)² 에서 원의 넓이 πr² 를 뺀 영역의 넓이 4r² − πr²",
    extraThinking: "원과 정사각형의 관계(변=지름)를 이용해 두 넓이를 합성해 차를 구함 — medium 은 반지름으로 둘레 계산",
    concepts: ["원의 넓이", "내접(변=지름)", "정사각형 넓이"], mediumSteps: 1,
    generate(rng) {
      const r = rng.int(2, 14); const sqA = 4 * r * r, cA = r * r; const [nm, who] = rng.pick([["tile", "A square tile"], ["window", "A square window"], ["coaster", "A square coaster"], ["sign", "A square sign"], ["panel", "A square wall panel"], ["cake box", "A square cake box"]]); const u = rng.pick(UNITS);
      const whoL = who[0].toLowerCase() + who.slice(1);
      const stimulus = spin(rng, `[[${who} has a circle drawn inside it. The circle has a radius of ${r} ${u} and touches all four sides of the square.|A circle with a radius of ${r} ${u} is drawn inside ${whoL} so that it touches all four sides of the square.|Inside ${whoL}, a circle of radius ${r} ${u} is drawn tangent to every side of the square.]]`);
      const wrongs: { text: string; kind: DistractorKind; reason: string }[] = [
        { text: piDiff(sqA, 2 * cA), kind: "formula_misuse", reason: "원의 넓이를 2πr² 로 계산했다." }, { text: piDiff(r * r, cA), kind: "geometry_misapplied", reason: "정사각형의 변을 반지름으로 착각했다." },
        { text: piDiff(2 * sqA, cA), kind: "geometry_misapplied", reason: "정사각형의 한 변을 4r 로 계산했다(변 = 지름이 아님)." }, { text: piDiff(sqA, 4 * cA), kind: "geometry_misapplied", reason: "반지름 대신 지름으로 원의 넓이를 계산했다." }, { text: piOpt(cA), kind: "step_missing", reason: "원의 넓이만 답했다." },
      ];
      return sem(finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the area of the region inside the square but outside the circle, in ${sq(u)}?|Find the area of the part of the square that is not covered by the circle, in ${sq(u)}.|How many ${sq(u)} of the square lie outside the circle?|Determine the area, in ${sq(u)}, of the square that remains uncovered by the circle.]]`), correctText: piDiff(sqA, cA), wrongTexts: wrongs, evalAt: {},
        verificationJs: withParams({ r }, "const side=2*P.r; const square=side*side; const circleCoef=P.r*P.r; return square-circleCoef;"),
        trace: [
          [`원이 정사각형의 네 변에 닿으므로 정사각형의 한 변은 원의 지름 ${2 * r} 이다.`, "The side of the square equals the diameter."],
          [`정사각형의 넓이는 ${2 * r}² = ${sqA} 이다.`, "Area of the square."],
          [`원의 넓이는 π × ${r}² = ${cA}π 이다.`, "Area of the circle."],
          ["구하는 영역은 정사각형에서 원을 뺀 부분이다.", "The region is the difference."],
          [`넓이 = ${sqA} − ${cA}π 이다.`, "Answer."],
        ],
        variant: "frame",
      }), [{ v: r, words: ["radius"] }], { words: ["area", "outside"], forbid: [] });
    },
  },
  {
    id: "ci.circumference_radius.compare_scenarios", skill: SKILL, kind: "circumference_radius", operator: "compare_scenarios",
    structure: "반지름으로 주어진 원 A 와 지름으로 주어진 원 B 의 둘레를 각각 구해(2πr, πd) 차를 비교",
    extraThinking: "한쪽은 반지름, 다른 쪽은 지름으로 주어진 두 원의 둘레를 같은 공식으로 맞춰 비교 — medium 은 반지름으로 둘레 계산",
    concepts: ["원의 둘레", "지름·반지름 변환", "두 값의 차"], mediumSteps: 1,
    generate(rng) {
      const rA = rng.int(5, 25), dB = rng.int(4, 2 * rA - 2); if (2 * rA === dB || rA === dB) throw new GenFail("x"); const coef = 2 * rA - dB; const [x, y] = rng.pick([["Fountain A", "Fountain B"], ["Track A", "Track B"], ["Pool A", "Pool B"], ["Rug A", "Rug B"], ["Plaza A", "Plaza B"]]); const u = rng.pick(UNITS);
      const stimulus = spin(rng, `${x} is a circle with a radius of ${rA} ${u}. ${y} is a circle with a diameter of ${dB} ${u}.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[How many ${u} greater is the circumference of ${x} than the circumference of ${y}, in terms of π?|By how many ${u} does the circumference of ${x} exceed that of ${y}? Give the answer in terms of π.|What is the difference, in ${u}, between the circumference of ${x} and the circumference of ${y}, in terms of π?]]`), correct: coef, fmt: piOpt,
        wrongs: [W(Math.abs(rA - dB) * 2, "geometry_misapplied", "B 의 지름을 반지름으로 착각해 2πr 로 계산했다."), W(Math.abs(rA - dB), "formula_misuse", "A 의 둘레를 πr 로 계산했다."), W(2 * (2 * rA - dB), "formula_misuse", "차이를 두 배로 계산했다."), W((rA * rA) - (dB * dB) / 4, "geometry_misapplied", "넓이의 차를 구했다."), W(2 * rA + dB, "sign_error", "두 둘레를 더했다.")],
        verificationJs: withParams({ rA, dB }, "const cA=2*P.rA; const cB=P.dB; return cA-cB;"),
        trace: [
          [`${x} 의 둘레는 2π × ${rA} = ${2 * rA}π 이다.`, "Circumference of A."],
          [`${y} 는 지름이 ${dB} 이므로 둘레는 π × ${dB} = ${dB}π 이다.`, "Circumference of B uses the diameter."],
          ["두 둘레 모두 π 의 계수로 비교할 수 있다.", "Compare coefficients."],
          [`차이는 ${2 * rA}π − ${dB}π 이다.`, "Subtract."],
          [`따라서 ${coef}π 이다.`, "Answer."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: rA, words: ["radius"] }, { v: dB, words: ["diameter"] }], { words: ["circumference"], forbid: forbidExcept("circumference") });
    },
  },
  // ───────────── circumference_diameter ─────────────
  {
    id: "ci.circumference_diameter.inverse", skill: SKILL, kind: "circumference_diameter", operator: "inverse",
    structure: "연못의 둘레 Cπ 에서 지름 C(반지름 C/2)를 구하고 폭 w 인 길이 연못을 둘러싼 바깥 가장자리의 둘레 π(C+2w) 를 구함",
    extraThinking: "둘레에서 지름을 역산하고 동심원(폭 w)의 바깥 둘레를 다시 계산 — medium 은 지름으로 둘레 계산",
    concepts: ["원의 둘레", "지름·반지름 역산", "동심원(폭)"], mediumSteps: 2,
    generate(rng) {
      const C = rng.pick([20, 24, 30, 36, 40, 48, 50, 60, 16, 18]), w = rng.int(2, 8); if (C === w || C === 2 * w) throw new GenFail("x"); const coef = C + 2 * w; const [nm, who] = rng.pick([["pond", "A circular pond"], ["fountain", "A circular fountain"], ["pool", "A circular swimming pool"], ["flower bed", "A circular flower bed"], ["skating rink", "A circular skating rink"]]); const u = rng.pick(UNITS);
      const stimulus = spin(rng, `${who} has a circumference of $${C}\\pi$ ${u}. A path of uniform width ${w} ${u} goes all the way around the ${nm}.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the circumference of the outer edge of the path, in ${u}, in terms of π?|Find the circumference of the outer edge of the path, in terms of π.|How long is the outer edge of the path, in ${u}, in terms of π?]]`), correct: coef, fmt: piOpt,
        wrongs: [W(C + w, "formula_misuse", "폭을 한 번만 더했다(지름에는 양쪽 폭이 더해짐)."), W(C + 4 * w, "formula_misuse", "폭을 네 번 더했다."), W(C + w * 2 * 2, "other", "계산 실수."), W(2 * (C + w), "geometry_misapplied", "지름을 반지름처럼 취급했다."), W(C + w * w, "other", "계산 실수.")],
        verificationJs: withParams({ C, w }, "const out=[];\nfor(let d=1;d<=300;d++){ if(d===P.C){ const outer=d+2*P.w; out.push(outer); } }\nreturn out[0];"),
        trace: [
          [`둘레 πd = ${C}π 이므로 지름 d = ${C} 이다.`, "Diameter from circumference."],
          [`반지름은 ${C} ÷ 2 = ${C / 2} 이다.`, "Radius."],
          [`길의 바깥 가장자리의 반지름은 ${C / 2} + ${w} = ${C / 2 + w} 이다.`, "Outer radius."],
          [`바깥 지름은 ${C + 2 * w} 이다.`, "Outer diameter."],
          [`바깥 둘레는 π × ${C + 2 * w} = ${coef}π 이다.`, "Outer circumference."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: C, words: ["circumference"] }, { v: w, words: ["width"] }], { words: ["circumference", "outer edge"], forbid: forbidExcept("circumference") });
    },
  },
  {
    id: "ci.circumference_diameter.unit_ratio", skill: SKILL, kind: "circumference_diameter", operator: "unit_ratio",
    structure: "지름 d cm 인 바퀴가 분당 R 번 회전할 때 분당 이동 거리 πdR cm 를 m 단위로 환산해 π 계수로 나타냄",
    extraThinking: "원둘레·회전 속도(번/분)에 단위 환산(cm→m)을 결합한 비율 계산 — medium 은 지름으로 둘레 계산",
    concepts: ["원의 둘레", "회전 속도(비율)", "길이 단위 환산"], mediumSteps: 2,
    generate(rng) {
      const d = rng.pick([20, 25, 40, 50, 60, 30, 45, 80]), R = rng.int(2, 30); const coef = (d * R) / 100; if (!Number.isInteger(coef) || coef < 1 || coef > 300 || d === R) throw new GenFail("x");
      const [nm, who] = rng.pick([["wheel", "A delivery cart wheel"], ["roller", "A conveyor roller"], ["drum", "A rotating drum"], ["tire", "A bicycle tire"], ["pulley", "A pulley"]]);
      const stimulus = spin(rng, `[[${who} has a diameter of ${d} centimeters. It rotates at a constant rate of ${R} complete rotations per minute, and its edge moves along a belt without slipping.|The diameter of ${who.charAt(0).toLowerCase() + who.slice(1)} is ${d} centimeters. It makes ${R} complete turns every minute, and a belt along its edge never slips.|${who} with a diameter of ${d} centimeters spins at a steady ${R} complete revolutions per minute while its edge drives a belt that does not slip.]]`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[How many meters does a point on the edge of the ${nm} travel in one minute, in terms of π?|In one minute, how many meters does the edge of the ${nm} move, in terms of π?|What distance, in meters per minute, does the edge move? Give the answer in terms of π.]]`), correct: coef, fmt: piOpt,
        wrongs: [W(coef * 100, "unit_error", "cm 를 m 로 환산하지 않았다."), W(coef * 2, "geometry_misapplied", "지름을 반지름처럼 보고 2πd 로 계산했다."), W(coef / R, "step_missing", "한 바퀴의 이동 거리만 구했다."), W(coef / 2, "formula_misuse", "둘레를 πd/2 로 계산했다."), W((d * d * R) / 400, "geometry_misapplied", "둘레 대신 넓이 계수를 계산했다.")],
        verificationJs: withParams({ d, R }, "let cm=0; for(let i=0;i<P.R;i++) cm+=P.d;\nif(cm%100!==0) throw new Error('정수 아님'); return cm/100;"),
        trace: [
          [`한 바퀴에 이동하는 거리는 둘레 π × ${d} = ${d}π cm 이다.`, "One rotation equals the circumference."],
          [`분당 ${R} 바퀴이므로 ${d}π × ${R} = ${d * R}π cm 이다.`, "Multiply by the rotation rate."],
          ["1 m = 100 cm 이다.", "Recall the unit relation."],
          [`${d * R}π ÷ 100 = ${coef}π m 이다.`, "Convert to meters."],
          [`분당 ${coef}π 미터를 이동한다.`, "Answer."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: d, words: ["diameter"] }, { v: R, words: ["rotations", "turns", "revolutions", "complete"] }], { words: ["meters", "distance", "travel", "move"], forbid: forbidExcept() });
    },
  },
  {
    id: "ci.circumference_diameter.chain2", skill: SKILL, kind: "circumference_diameter", operator: "chain2",
    structure: "정사각형의 둘레 P 에서 한 변 P/4 를 구하고 내접원의 지름이 그 변과 같음을 이용해 둘레 π·P/4 를 구함",
    extraThinking: "앞 결과(정사각형의 한 변)가 뒤 단계의 지름이 되는 2단계 연쇄 — medium 은 지름으로 둘레 계산",
    concepts: ["정사각형 둘레", "내접원의 지름", "원의 둘레"], mediumSteps: 2,
    generate(rng) {
      const s = rng.int(3, 24), P = 4 * s; const [nm, who] = rng.pick([["coaster", "A square coaster"], ["tabletop", "A square tabletop"], ["floor tile", "A square floor tile"], ["picture frame", "A square picture frame"], ["sandbox", "A square sandbox"]]); const u = rng.pick(UNITS);
      const stimulus = spin(rng, `[[${who} has a perimeter of ${P} ${u}. The largest possible circle is cut from it, and the circle touches all four sides of the square.|The perimeter of ${who.charAt(0).toLowerCase() + who.slice(1)} is ${P} ${u}. A circle as large as possible is cut out of it, and this circle touches all four sides.|From ${who.charAt(0).toLowerCase() + who.slice(1)} with a perimeter of ${P} ${u}, the biggest circle that fits is cut out, tangent to each of the four sides.]]`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the circumference of the circle, in ${u}, in terms of π?|Find the circumference of the circle, in ${u}, in terms of π.|How long is the circle's circumference, in ${u}? Give the answer in terms of π.]]`), correct: s, fmt: piOpt,
        wrongs: [W(P, "geometry_misapplied", "정사각형의 둘레를 π 계수로 답했다."), W(2 * s, "geometry_misapplied", "한 변을 반지름으로 착각해 2πr 로 계산했다."), W(s / 2, "formula_misuse", "지름을 반으로 나눠 πr 로 계산했다."), W(s * s, "geometry_misapplied", "원의 넓이 계수를 답했다."), W(P / 2, "step_missing", "정사각형 한 변을 구하지 않고 반둘레를 사용했다.")],
        verificationJs: withParams({ P }, "const side=P.P/4; const diameter=side; return diameter;"),
        trace: [
          [`정사각형의 네 변은 같으므로 한 변은 ${P} ÷ 4 = ${s} 이다.`, "Side of the square."],
          ["원이 마주 보는 두 변에 닿으므로 원의 지름은 정사각형의 한 변과 같다.", "The diameter equals the side."],
          [`지름 d = ${s} 이다.`, "Diameter."],
          ["원의 둘레는 πd 이다.", "Circumference formula."],
          [`둘레 = π × ${s} = ${s}π 이다.`, "Answer."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: P, words: ["perimeter"] }], { words: ["circumference"], forbid: forbidExcept("circumference") });
    },
  },
  {
    id: "ci.circumference_diameter.compare_scenarios", skill: SKILL, kind: "circumference_diameter", operator: "compare_scenarios",
    structure: "벨트로 연결된 두 톱니바퀴(지름 dA, dB)의 가장자리가 같은 거리를 움직일 때 A 가 n 바퀴 돌면 B 가 도는 바퀴 수 n·dA/dB",
    extraThinking: "두 원의 둘레 비교와 이동 거리 보존으로 회전 수를 구함(π 가 약분됨) — medium 은 지름으로 둘레 계산",
    concepts: ["원의 둘레", "이동 거리 보존", "비율(회전 수)"], mediumSteps: 2,
    generate(rng) {
      const dA = rng.pick([12, 16, 18, 20, 24, 30, 36, 40]), dB = rng.pick([6, 8, 9, 10, 12, 15, 18, 20, 4, 5]), n = rng.int(2, 20); if (dA <= dB || (n * dA) % dB !== 0) throw new GenFail("x"); const ans = (n * dA) / dB; if (ans > 200 || n === dA || n === dB || ans === n) throw new GenFail("x");
      const [A, B] = rng.pick([["Gear A", "Gear B"], ["Pulley A", "Pulley B"], ["Wheel A", "Wheel B"], ["Cog A", "Cog B"]]);
      const stimulus = spin(rng, `[[${A} has a diameter of ${dA} centimeters and ${B} has a diameter of ${dB} centimeters.|The diameter of ${A} is ${dA} centimeters, while the diameter of ${B} is ${dB} centimeters.|Two round parts, ${A} and ${B}, have diameters of ${dA} centimeters and ${dB} centimeters, respectively.]] [[The two are connected by a belt that does not slip, so points on their edges always move the same distance.|A belt that never slips joins them, so their edges always travel equal distances.|Because a non-slipping belt links them, a point on either edge moves the same distance as a point on the other.]] [[${A} makes ${n} complete turns.|${A} is turned through exactly ${n} complete turns.|In some time, ${A} completes ${n} full turns.]]`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[How many complete turns does ${B} make?|How many complete turns does ${B} make in that time?|Find the number of complete turns made by ${B}.]]`), correct: ans,
        wrongs: [W((n * dB) / dA, "formula_misuse", "비를 거꾸로(작은 바퀴가 덜 돈다고) 적용했다."), W(n, "step_missing", "두 바퀴가 같은 횟수로 돈다고 보았다."), W((n * dA * dA) / (dB * dB), "geometry_misapplied", "지름비의 제곱(넓이비)을 사용했다."), W(n * dA, "step_missing", "이동 거리(π 제외)를 회전 수로 답했다."), W(n + (dA - dB), "other", "지름의 차이를 더했다.")],
        verificationJs: withParams({ dA, dB, n }, "const dist=P.n*P.dA; if(dist%P.dB!==0) throw new Error('정수 아님'); return dist/P.dB;"),
        trace: [
          [`${A} 의 둘레는 π × ${dA} = ${dA}π 이다.`, "Circumference of A."],
          [`${n} 바퀴 동안 가장자리가 움직인 거리는 ${n} × ${dA}π = ${n * dA}π 이다.`, "Distance moved."],
          [`${B} 의 둘레는 π × ${dB} = ${dB}π 이다.`, "Circumference of B."],
          ["벨트가 미끄러지지 않으므로 두 가장자리가 움직인 거리는 같다.", "The distances are equal."],
          [`${B} 의 회전 수는 ${n * dA}π ÷ ${dB}π = ${ans} 이다.`, "Divide the distance by B's circumference."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: dA, words: ["diameter", "diameters"] }, { v: dB, words: ["diameter", "diameters"] }, { v: n, words: ["turns", "makes", "complete"] }], { words: ["turns"], forbid: forbidExcept() });
    },
  },
  // ───────────── arc_length ─────────────
  {
    id: "ci.arc_length.inverse", skill: SKILL, kind: "arc_length", operator: "inverse",
    structure: "호의 길이 Lπ 와 중심각 θ 로부터 호가 원둘레의 θ/360 임을 이용해 원둘레 → 지름을 역산",
    extraThinking: "호의 길이에서 거꾸로 원의 크기(지름)를 복원 — medium 은 반지름·중심각으로 호의 길이 계산",
    concepts: ["호의 길이", "중심각의 비율", "원둘레·지름 역산"], mediumSteps: 1,
    generate(rng) {
      const [th] = rng.pick(PI_DEGREES), r = rng.int(3, 30); const L = (th * r) / 180; if (!Number.isInteger(L) || L < 2 || L === r || L === th) throw new GenFail("x"); const d = 2 * r; const [nm, who] = rng.pick(ROUND); const u = rng.pick(UNITS);
      const stimulus = spin(rng, `${who} has an arc AB whose length is $${L}\\pi$ ${u}. The arc corresponds to a central angle of ${th} degrees.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the diameter of the ${nm}, in ${u}?|Find the diameter of the ${nm}, in ${u}.|How long is the diameter of the ${nm}, in ${u}?]]`), correct: d,
        wrongs: [W(r, "other", "반지름을 답했다."), W(2 * d, "formula_misuse", "비를 거꾸로(θ/360 대신 360/θ 배의 반)로 적용했다."), W(L * 360, "step_missing", "중심각으로 나누지 않았다."), W((L * 180) / (th / 2), "other", "계산 실수."), W(L * 2, "formula_misuse", "호의 길이의 두 배를 지름으로 답했다.")],
        verificationJs: withParams({ L, th }, "const out=[];\nfor(let r=1;r<=300;r++){ if(P.th*r===180*P.L) out.push(2*r); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`호의 길이는 원둘레의 ${th}/360 이다.`, "The arc is a fraction of the circumference."],
          [`${L}π = (${th}/360) × (원둘레) 이다.`, "Set up."],
          [`원둘레 = ${L}π ÷ (${th}/360) = ${d}π 이다.`, "Solve for the circumference."],
          ["원둘레는 πd 이므로 지름은 π 를 약분해 구한다.", "Diameter from circumference."],
          [`지름 = ${d} 이다.`, "Answer."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: L, words: ["arc", "length"] }, { v: th, words: ["angle", "degrees"] }], { words: ["diameter"], forbid: forbidExcept("diameter") });
    },
  },
  {
    id: "ci.arc_length.chain2", skill: SKILL, kind: "arc_length", operator: "chain2",
    structure: "작은 호의 중심각 θ 로부터 큰 호의 중심각 360−θ 를 구하고 (360−θ)/360 × 2πr 로 큰 호의 길이를 계산",
    extraThinking: "앞 단계(보각 360−θ)가 뒤 단계의 중심각이 되는 연쇄 — medium 은 반지름·중심각으로 호의 길이 계산",
    concepts: ["호의 길이", "보각(360°−θ)", "원둘레의 비율"], mediumSteps: 1,
    generate(rng) {
      const [th] = rng.pick(PI_DEGREES), r = rng.int(3, 24); const big = 360 - th; const coef = (big * r) / 180; if (!Number.isInteger(coef) || coef > 300 || r === th) throw new GenFail("x"); const [nm, who] = rng.pick(ROUND); const u = rng.pick(UNITS);
      const stimulus = spin(rng, `${who} has a radius of ${r} ${u}. The minor arc AB corresponds to a central angle of ${th} degrees.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the length of the major arc AB, in ${u}, in terms of π?|Find the length of the major arc AB, in ${u}, in terms of π.|How long is the major arc AB, in ${u}? Give the answer in terms of π.]]`), correct: coef, fmt: piOpt,
        wrongs: [W((th * r) / 180, "step_missing", "작은 호의 길이를 답했다."), W(2 * r, "step_missing", "원둘레를 답했다."), W((big * r) / 360, "formula_misuse", "호의 길이를 πr·(각/360) 으로 계산했다(2 를 빼먹음)."), W((big * big) / 360 * r / r, "other", "계산 실수."), W(((th + 180) * r) / 180, "other", "보각을 잘못 계산했다.")],
        verificationJs: withParams({ r, th }, "let arc=0; for(let a=0;a<360-P.th;a++) arc+=2*P.r/360;\nreturn Math.round(arc*1e6)/1e6;"),
        trace: [
          [`큰 호의 중심각은 360° − ${th}° = ${big}° 이다.`, "Major arc angle."],
          [`큰 호는 원둘레의 ${big}/360 이다.`, "Fraction of the circle."],
          [`원둘레는 2π × ${r} = ${2 * r}π 이다.`, "Circumference."],
          [`호의 길이 = (${big}/360) × ${2 * r}π 이다.`, "Multiply."],
          [`따라서 ${coef}π 이다.`, "Answer."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: r, words: ["radius"] }, { v: th, words: ["angle", "degrees"] }], { words: ["major arc"], forbid: forbidExcept("arc", "length") });
    },
  },
  {
    id: "ci.arc_length.unit_ratio", skill: SKILL, kind: "arc_length", operator: "unit_ratio",
    structure: "분침의 길이 r 인 시계에서 m 분 동안 끝이 그리는 호의 길이 2πr·(m/60) (분 → 각도(6°/분) → 원둘레의 비율)",
    extraThinking: "시간(분)을 각도·원둘레의 비율로 환산하는 단위·비율 결합 — medium 은 반지름·중심각으로 호의 길이 계산",
    concepts: ["호의 길이", "시간→각도 환산", "원둘레의 비율"], mediumSteps: 1,
    generate(rng) {
      const r = rng.pick([6, 9, 10, 12, 15, 18, 20, 24, 30]), m = rng.pick([10, 15, 20, 25, 30, 35, 40, 45, 50, 5]); const coef = (r * m) / 30; if (!Number.isInteger(coef) || coef < 1 || r === m) throw new GenFail("x");
      const [nm, who] = rng.pick([["wall clock", "The minute hand of a wall clock"], ["station clock", "The minute hand of a station clock"], ["clock tower", "The minute hand of a clock tower"], ["kitchen timer", "The minute hand of a round kitchen clock"], ["school clock", "The minute hand of a school clock"]]);
      const stimulus = spin(rng, `${who} is ${r} centimeters long. [[The hand moves smoothly and turns through 360 degrees every 60 minutes.|It sweeps out a full 360-degree turn once every 60 minutes, moving at a steady pace.|At a steady rate, the hand completes one whole turn, 360 degrees, in 60 minutes.]]`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[How many centimeters does the tip of the minute hand travel in ${m} minutes, in terms of π?|In ${m} minutes, how far does the tip of the minute hand move, in centimeters, in terms of π?|Find the distance traveled by the tip of the minute hand in ${m} minutes, in centimeters, in terms of π.]]`), correct: coef, fmt: piOpt,
        wrongs: [W(coef * 2, "geometry_misapplied", "분침의 길이를 지름으로 착각했다."), W(coef / 2, "formula_misuse", "둘레를 πr 로 계산했다."), W((r * m) / 60, "formula_misuse", "비율 m/60 에 πr 을 곱했다."), W(2 * r, "step_missing", "한 바퀴(60분)의 거리를 답했다."), W((r * r * m) / 360, "geometry_misapplied", "호의 길이 대신 부채꼴 넓이로 계산했다.")],
        verificationJs: withParams({ r, m }, "let deg=0; for(let t=0;t<P.m;t++) deg+=6;\nconst arc=2*P.r*deg/360; return Math.round(arc*1e6)/1e6;"),
        trace: [
          ["분침은 60분에 360° 를 돌므로 1분에 6° 돈다.", "Degrees per minute."],
          [`${m}분 동안 도는 각은 ${6 * m}° 이다.`, "Angle swept."],
          [`호는 원둘레의 ${6 * m}/360 이다.`, "Fraction of the circle."],
          [`원둘레는 2π × ${r} = ${2 * r}π 이다(분침의 길이가 반지름).`, "The hand length is the radius."],
          [`호의 길이 = (${6 * m}/360) × ${2 * r}π = ${coef}π 이다.`, "Arc length."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: r, words: ["hand", "long"] }, { v: m, words: ["minutes"] }], { words: ["travel", "move", "distance"], forbid: forbidExcept() });
    },
  },
  {
    id: "ci.arc_length.repr_shift", skill: SKILL, kind: "arc_length", operator: "repr_shift",
    structure: "지름 d 인 피자를 n 조각으로 똑같이 자를 때 k 조각 가장자리(호)의 길이 π d k / n (그림을 식으로 옮기기)",
    extraThinking: "도형(조각 수)을 중심각 360°/n 과 호의 길이 식으로 번역 — medium 은 반지름·중심각으로 호의 길이 계산",
    concepts: ["호의 길이", "등분(중심각 360°/n)", "지름·반지름 변환"], mediumSteps: 1,
    generate(rng) {
      const d = rng.pick([12, 14, 16, 18, 20, 24, 30]), n = rng.pick([4, 6, 8, 10, 12]), k = rng.int(2, n - 1); const coef = (d * k) / n; if (!Number.isInteger(coef) || coef < 2 || d === n || k === d || coef === d) throw new GenFail("x");
      const [who, pl] = rng.pick([["Maya", "pizza"], ["Jordan", "pie"], ["Kofi", "flatbread"], ["Sana", "cake"], ["Luis", "quiche"]]); const u = rng.pick(["inches", "centimeters"] as const);
      const stimulus = spin(rng, `A round ${pl} has a diameter of ${d} ${u}. It is cut into ${n} equal slices, each with its center at the middle of the ${pl}. ${who} eats ${k} of the slices.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the total length of the curved crust edge of the ${k} slices ${who} eats, in ${u}, in terms of π?|How long is the combined curved edge of the ${k} slices that ${who} eats, in ${u}, in terms of π?|Find the total arc length of the ${k} slices, in ${u}, in terms of π.]]`), correct: coef, fmt: piOpt,
        wrongs: [W((2 * d * k) / n, "geometry_misapplied", "지름을 반지름처럼 보고 2πd 로 계산했다."), W(d / n, "step_missing", "조각 하나의 호만 구했다."), W(d * k, "step_missing", "둘레를 등분하지 않았다."), W((d * k) / (2 * n), "formula_misuse", "둘레를 πr 로 계산했다."), W((d * d * k) / (4 * n), "geometry_misapplied", "호의 길이 대신 조각 넓이를 계산했다.")],
        verificationJs: withParams({ d, n, k }, "let total=0; const circ=P.d; for(let i=0;i<P.k;i++) total+=circ/P.n;\nreturn Math.round(total*1e6)/1e6;"),
        trace: [
          [`지름이 ${d} 이므로 원둘레는 ${d}π 이다.`, "Circumference from the diameter."],
          [`${n} 조각으로 똑같이 나누므로 한 조각의 중심각은 360° ÷ ${n} = ${360 / n}° 이다.`, "Central angle of one slice."],
          [`한 조각의 호는 원둘레의 1/${n} 이므로 ${d}π ÷ ${n} 이다.`, "Arc of one slice."],
          [`${k} 조각이므로 ${k} 를 곱한다.`, "Multiply by the number of slices."],
          [`총 호의 길이는 ${coef}π 이다.`, "Answer."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: d, words: ["diameter"] }, { v: n, words: ["slices", "equal"] }, { v: k, words: ["slices", "eats"] }], { words: ["length", "edge", "arc"], forbid: forbidExcept("arc", "length") });
    },
  },
  // ───────────── sector_area ─────────────
  {
    id: "ci.sector_area.inverse", skill: SKILL, kind: "sector_area", operator: "inverse",
    structure: "부채꼴의 넓이 Aπ 와 중심각 θ 로부터 원 전체 넓이를 구해 반지름을 역산하고 호의 길이를 계산",
    extraThinking: "부채꼴 넓이에서 반지름을 거꾸로 구하고 다른 양(호의 길이)으로 다시 계산 — medium 은 반지름·중심각으로 부채꼴 넓이 계산",
    concepts: ["부채꼴 넓이", "반지름 역산(제곱근)", "호의 길이"], mediumSteps: 1,
    generate(rng) {
      const [th] = rng.pick(PI_DEGREES), r = rng.int(3, 18); const A = (th * r * r) / 360, L = (th * r) / 180; if (!Number.isInteger(A) || !Number.isInteger(L) || A < 2 || A > 400 || A === th) throw new GenFail("x"); const [nm, who] = rng.pick([["pizza slice", "A pizza slice"], ["fan blade", "A sector-shaped fan blade"], ["pie wedge", "A pie wedge"], ["flower bed", "A sector-shaped flower bed"], ["radar sweep", "A radar screen sweep"]]); const u = rng.pick(UNITS);
      const stimulus = spin(rng, `${who} is a sector of a circle. The sector has an area of $${A}\\pi$ ${sq(u)} and a central angle of ${th} degrees.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the length of the curved arc of the ${nm}, in ${u}, in terms of π?|Find the length of the arc of the ${nm}, in ${u}, in terms of π.|How long is the arc of the sector, in ${u}? Give the answer in terms of π.]]`), correct: L, fmt: piOpt,
        wrongs: [W(r, "step_missing", "반지름만 구했다."), W(A * 2, "geometry_misapplied", "넓이를 두 배로 계산해 호의 길이로 답했다."), W(2 * r, "step_missing", "원둘레 계수를 답했다."), W(r * r, "step_missing", "r² 를 답했다."), W(L * 2, "formula_misuse", "호의 길이를 2 배로 계산했다.")],
        verificationJs: withParams({ A, th }, "const out=[];\nfor(let r=1;r<=200;r++){ if(P.th*r*r===360*P.A) out.push(P.th*r/180); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`부채꼴은 원의 ${th}/360 이므로 원 전체의 넓이는 ${A}π ÷ (${th}/360) = ${r * r}π 이다.`, "Full circle area."],
          [`πr² = ${r * r}π 에서 r² = ${r * r} 이다.`, "r squared."],
          [`r = ${r} 이다.`, "Radius."],
          [`원둘레는 2π × ${r} = ${2 * r}π 이다.`, "Circumference."],
          [`호의 길이 = (${th}/360) × ${2 * r}π = ${L}π 이다.`, "Arc length."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: A, words: ["area"] }, { v: th, words: ["angle", "degrees"] }], { words: ["arc"], forbid: forbidExcept("arc", "length") });
    },
  },
  {
    id: "ci.sector_area.chain2", skill: SKILL, kind: "sector_area", operator: "chain2",
    structure: "반지름 r 과 호의 길이 Lπ 로부터 호가 원둘레의 L/(2r) 임을 구하고 같은 비율로 부채꼴 넓이 (L r/2)π 를 계산",
    extraThinking: "호의 길이로 구한 비율이 다음 단계(넓이)의 조건이 되는 연쇄 — medium 은 반지름·중심각으로 부채꼴 넓이 계산",
    concepts: ["호의 길이", "원둘레에 대한 비율", "부채꼴 넓이"], mediumSteps: 1,
    generate(rng) {
      const r = rng.int(4, 24), L = rng.int(2, 2 * r - 1); const A = (L * r) / 2; if (!Number.isInteger(A) || A > 400 || L === r || A === L) throw new GenFail("x"); const [nm, who] = rng.pick([["pizza slice", "A pizza slice"], ["fan blade", "A sector-shaped fan blade"], ["pie wedge", "A pie wedge"], ["flower bed", "A sector-shaped flower bed"], ["tent floor", "A sector-shaped tent floor"]]); const u = rng.pick(UNITS);
      const stimulus = spin(rng, `${who} is a sector of a circle with a radius of ${r} ${u}. The curved arc of the sector has a length of $${L}\\pi$ ${u}.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the area of the ${nm}, in ${sq(u)}, in terms of π?|Find the area of the ${nm}, in ${sq(u)}, in terms of π.|How many ${sq(u)} does the sector cover, in terms of π?]]`), correct: A, fmt: piOpt,
        wrongs: [W(r * r, "step_missing", "원 전체의 넓이를 답했다."), W(L * r, "formula_misuse", "÷2 를 빼먹었다."), W(L * 2, "other", "계산 실수."), W((L * L) / 2, "other", "계산 실수."), W(2 * A, "formula_misuse", "넓이를 두 배로 계산했다.")],
        verificationJs: withParams({ r, L }, "let area=0; const frac=P.L/(2*P.r); area=frac*P.r*P.r; return Math.round(area*1e6)/1e6;"),
        trace: [
          [`원둘레는 2π × ${r} = ${2 * r}π 이다.`, "Circumference."],
          [`호의 비율 = ${L}π ÷ ${2 * r}π = ${L}/${2 * r} 이다.`, "Fraction of the circle."],
          [`같은 비율이 중심각에도 적용되므로 중심각은 ${(360 * L) / (2 * r)}° 이다.`, "The same fraction of 360 degrees."],
          [`원 전체의 넓이는 π × ${r}² = ${r * r}π 이다.`, "Full area."],
          [`부채꼴의 넓이 = (${L}/${2 * r}) × ${r * r}π = ${A}π 이다.`, "Sector area."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: r, words: ["radius"] }, { v: L, words: ["arc", "length"] }], { words: ["area", "cover"], forbid: forbidExcept("area") });
    },
  },
  {
    id: "ci.sector_area.compose_kind", skill: SKILL, kind: "sector_area", operator: "compose_kind",
    structure: "원그래프의 세 부채꼴 중심각의 비 a:b:c 로 가장 큰 부채꼴의 중심각을 구하고 반지름 r 인 원의 넓이의 c/(a+b+c) 를 계산",
    extraThinking: "비례배분(비)과 부채꼴 넓이를 합성 — medium 은 반지름·중심각으로 부채꼴 넓이 계산",
    concepts: ["부채꼴 넓이", "비례배분(연비)", "원의 넓이"], mediumSteps: 1,
    generate(rng) {
      const a = rng.int(1, 4), b = rng.int(a + 1, 6), c = rng.int(b + 1, 9); const T = a + b + c; const r = rng.int(3, 24); if (T > 18 || (r * r * c) % T !== 0) throw new GenFail("x"); const coef = (r * r * c) / T; if (coef > 400 || r === a || r === b || r === c || r === T) throw new GenFail("x");
      const [nm, who] = rng.pick([["budget chart", "A circular budget chart"], ["survey chart", "A circular survey chart"], ["pie chart", "A circular pie chart"], ["time chart", "A circular time-use chart"], ["sales chart", "A circular sales chart"]]); const u = rng.pick(UNITS);
      const stimulus = spin(rng, `[[${who} is divided into three sectors whose central angles are in the ratio ${a} : ${b} : ${c}. The circle has a radius of ${r} ${u}.|The circle in ${who.charAt(0).toLowerCase() + who.slice(1)} has a radius of ${r} ${u}. Its three sectors have central angles in the ratio ${a} : ${b} : ${c}.|${who} has three sectors, and their central angles are in the ratio ${a} : ${b} : ${c}; the radius of the whole circle is ${r} ${u}.]]`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the area of the largest sector, in ${sq(u)}, in terms of π?|Find the area of the largest sector, in ${sq(u)}, in terms of π.|How many ${sq(u)} does the largest sector cover, in terms of π?]]`), correct: coef, fmt: piOpt,
        wrongs: [W((r * r * a) / T, "other", "가장 작은 부채꼴의 넓이를 답했다."), W((r * r * b) / T, "other", "중간 부채꼴의 넓이를 답했다."), W(r * r, "step_missing", "원 전체의 넓이를 답했다."), W((r * r * c) / (a + b), "formula_misuse", "비의 전체를 a+b 로 잡았다."), W((r * r) / c, "formula_misuse", "비를 거꾸로 사용했다.")],
        verificationJs: withParams({ a, b, c, r }, "let best=null; const parts=[P.a,P.b,P.c]; const T=parts[0]+parts[1]+parts[2];\nconst areas=parts.map(p=>P.r*P.r*p/T); return Math.round(Math.max(...areas)*1e6)/1e6;"),
        trace: [
          [`비의 합은 ${a} + ${b} + ${c} = ${T} 이다.`, "Sum of the ratio parts."],
          [`가장 큰 부채꼴의 중심각은 360° × ${c}/${T} = ${(360 * c) / T}° 이다.`, "Largest central angle."],
          [`그 부채꼴은 원의 ${c}/${T} 이다.`, "Fraction of the circle."],
          [`원의 넓이는 π × ${r}² = ${r * r}π 이다.`, "Area of the circle."],
          [`부채꼴의 넓이 = (${c}/${T}) × ${r * r}π = ${coef}π 이다.`, "Sector area."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: r, words: ["radius"] }], { words: ["area", "cover"], forbid: forbidExcept("area") });
    },
  },
  {
    id: "ci.sector_area.compare_scenarios", skill: SKILL, kind: "sector_area", operator: "compare_scenarios",
    structure: "반지름·중심각이 서로 다른 두 부채꼴 A, B 의 넓이 θ r²/360 을 각각 구해 차를 비교",
    extraThinking: "두 부채꼴을 각각 모델링해 넓이 차를 비교(각이 크다고 넓이가 큰 것은 아님) — medium 은 한 부채꼴 넓이 계산",
    concepts: ["부채꼴 넓이", "두 경우 비교", "넓이의 차"], mediumSteps: 1,
    generate(rng) {
      const [tA] = rng.pick(PI_DEGREES), [tB] = rng.pick(PI_DEGREES), rA = rng.int(3, 20), rB = rng.int(3, 20); const a = (tA * rA * rA) / 360, b = (tB * rB * rB) / 360;
      if (!Number.isInteger(a) || !Number.isInteger(b) || a === b || tA === tB || rA === rB || a < 2 || b < 2 || a > 300 || b > 300 || tB > tA) throw new GenFail("x"); const diff = Math.abs(a - b); const bigger = a > b ? "A" : "B";
      const u = rng.pick(UNITS); const [S1, S2] = rng.pick([["Sector A", "Sector B"], ["Slice A", "Slice B"], ["Wedge A", "Wedge B"]]);
      const stimulus = spin(rng, `${S1} has a radius of ${rA} ${u} and a central angle of ${tA} degrees. ${S2} has a radius of ${rB} ${u} and a central angle of ${tB} degrees.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[How many ${sq(u)} greater is the area of the larger sector than the area of the smaller sector, in terms of π?|The larger sector has an area that exceeds the smaller one by how many ${sq(u)}, in terms of π?|What is the positive difference, in ${sq(u)}, between the two areas, in terms of π?]]`), correct: diff, fmt: piOpt,
        wrongs: [W(a + b, "sign_error", "두 넓이를 더했다."), W(Math.abs((tA * rA - tB * rB) / 180), "geometry_misapplied", "호의 길이로 비교했다."), W(a, "step_missing", `${S1} 의 넓이만 답했다.`), W(b, "step_missing", `${S2} 의 넓이만 답했다.`), W(Math.abs(rA * rA - rB * rB), "step_missing", "중심각 비율을 곱하지 않고 원의 넓이 차를 구했다.")],
        verificationJs: withParams({ tA, rA, tB, rB }, "const a=P.tA*P.rA*P.rA/360, b=P.tB*P.rB*P.rB/360; return Math.round(Math.abs(a-b)*1e6)/1e6;"),
        trace: [
          [`${S1} 는 원의 ${tA}/360 이므로 넓이는 (${tA}/360) × π × ${rA}² = ${a}π 이다.`, "Area of the first sector."],
          [`${S2} 는 원의 ${tB}/360 이므로 넓이는 (${tB}/360) × π × ${rB}² = ${b}π 이다.`, "Area of the second sector."],
          [`두 넓이의 계수는 ${a} 와 ${b} 이다.`, "Compare coefficients."],
          [`더 큰 것은 ${S1 === "Sector A" || a > b ? (a > b ? "A" : "B") : bigger} 쪽이다.`, "Identify the larger."],
          [`차이는 |${a} − ${b}|π = ${diff}π 이다.`, "Difference."],
        ],
        variant: "angle_vs_radius",
      });
      return sem(out, [{ v: rA, words: ["radius"] }, { v: rB, words: ["radius"] }, { v: tA, words: ["angle", "degrees"] }, { v: tB, words: ["angle", "degrees"] }], { words: ["area", "difference"], forbid: forbidExcept("area") });
    },
  },
  // ───────────── central_from_inscribed ─────────────
  {
    id: "ci.central_from_inscribed.inverse", skill: SKILL, kind: "central_from_inscribed", operator: "inverse",
    structure: "'중심각 = a × 원주각 − k' 라는 관계와 '중심각 = 2 × 원주각' 으로 방정식을 세워 원주각을 구하고 중심각을 답함",
    extraThinking: "원주각·중심각 정리를 방정식의 한 변으로 사용해 거꾸로 각을 구함 — medium 은 원주각의 2 배 계산",
    concepts: ["원주각과 중심각", "일차방정식", "문장→식"], mediumSteps: 1,
    generate(rng) {
      const x = rng.int(12, 50), a = rng.pick([3, 4, 5]); const k = (a - 2) * x; if (k > 200 || 2 * x >= 360 || k === x) throw new GenFail("x"); const [P, Q] = rng.pick([["A", "B"], ["P", "Q"], ["R", "S"], ["X", "Y"]]); const c = rng.pick(["C", "D", "T", "Z"]);
      const stimulus = spin(rng, `In a circle with center O, inscribed angle ${P}${c}${Q} and central angle ${P}O${Q} both intercept arc ${P}${Q}. The measure of angle ${P}O${Q} is ${k} degrees less than ${a} times the measure of angle ${P}${c}${Q}.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the measure of central angle ${P}O${Q}, in degrees?|Find the measure of angle ${P}O${Q}, in degrees.|How many degrees is central angle ${P}O${Q}?]]`), correct: 2 * x,
        wrongs: [W(x, "other", "원주각을 답했다."), W(a * x, "step_missing", "'k 작다' 를 반영하지 않았다."), W(k, "other", "상수 k 를 답했다."), W(a * x - k - x, "other", "원주각과의 차를 답했다."), W(4 * x, "formula_misuse", "중심각의 두 배를 답했다.")],
        verificationJs: withParams({ a, k }, "const out=[];\nfor(let x=1;x<=180;x++){ const central=2*x; if(central===P.a*x-P.k) out.push(central); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          ["같은 호의 원주각을 x 라 하면 중심각은 2x 이다.", "Inscribed angle x, central angle 2x."],
          [`문장에 따라 중심각 = ${a} × x − ${k} 이다.`, "Translate the sentence."],
          [`2x = ${a}x − ${k} 이다.`, "Equate the two expressions."],
          [`${a - 2}x = ${k} 이므로 x = ${x} 이다.`, "Solve for x."],
          [`중심각은 2 × ${x} = ${2 * x}° 이다.`, "Central angle."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: k, words: ["less"] }, { v: a, words: ["times"] }], { words: ["angle"], forbid: [] });
    },
  },
  {
    id: "ci.central_from_inscribed.chain2", skill: SKILL, kind: "central_from_inscribed", operator: "chain2",
    structure: "원주각 x 로 호 AB 의 크기 2x 를 구하고, 원 전체 360° 에서 빼서 반대쪽 큰 호의 크기 360−2x 를 구함",
    extraThinking: "앞 단계(호의 크기 2x)가 뒤 단계(보호 360°−2x)의 조건이 되는 연쇄 — medium 은 원주각의 2 배 계산",
    concepts: ["원주각과 호", "원의 한 바퀴 360°", "보호(큰 호)"], mediumSteps: 1,
    generate(rng) {
      const x = rng.int(20, 80); if (x === 45 || x === 90) throw new GenFail("x"); const [P, Q] = rng.pick([["A", "B"], ["P", "Q"], ["M", "N"], ["E", "F"]]); const c = rng.pick(["C", "D", "T", "Z"]); const ans = 360 - 2 * x;
      const stimulus = spin(rng, `In a circle with center O, inscribed angle ${P}${c}${Q} measures ${x} degrees and intercepts minor arc ${P}${Q}.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the measure of major arc ${P}${Q}, in degrees?|Find the measure of the major arc ${P}${Q}, in degrees.|How many degrees is the arc ${P}${Q} that is not intercepted by the angle?]]`), correct: ans,
        wrongs: [W(2 * x, "step_missing", "작은 호의 크기를 답했다."), W(360 - x, "formula_misuse", "원주각을 호의 크기로 착각했다."), W(180 - x, "formula_misuse", "180° 에서 원주각을 뺐다."), W(180 - 2 * x, "formula_misuse", "180° 에서 호를 뺐다."), W(ans / 2, "formula_misuse", "큰 호를 반으로 나눴다.")],
        verificationJs: withParams({ x }, "let minor=0; for(let i=0;i<P.x;i++) minor+=2;\nreturn 360-minor;"),
        trace: [
          [`원주각 ${x}° 는 같은 호의 중심각의 절반이므로 호 ${P}${Q} 는 ${2 * x}° 이다.`, "Minor arc is twice the inscribed angle."],
          ["원 전체의 호는 360° 이다.", "A full circle is 360 degrees."],
          ["큰 호는 원 전체에서 작은 호를 뺀 나머지이다.", "The major arc is the complement."],
          [`360° − ${2 * x}° = ${ans}° 이다.`, "Subtract."],
          [`큰 호의 크기는 ${ans}° 이다.`, "Answer."],
        ],
        variant: "major_arc",
      });
      return sem(out, [{ v: x, words: ["measures", "degrees"] }], { words: ["arc"], forbid: [] });
    },
  },
  {
    id: "ci.central_from_inscribed.compose_kind", skill: SKILL, kind: "central_from_inscribed", operator: "compose_kind",
    structure: "원주각 x 로 중심각 2x 를 구하고, 삼각형 AOB 가 이등변삼각형(OA=OB)임을 이용해 밑각 (180−2x)/2 = 90−x 를 구함",
    extraThinking: "원주각 정리를 이등변삼각형·삼각형 내각의 합과 합성 — medium 은 원주각의 2 배 계산",
    concepts: ["원주각과 중심각", "이등변삼각형(반지름 OA=OB)", "삼각형 내각의 합"], mediumSteps: 1,
    generate(rng) {
      const x = rng.int(15, 70); if (x === 45) throw new GenFail("x"); const [P, Q] = rng.pick([["A", "B"], ["P", "Q"], ["K", "L"], ["U", "V"]]); const c = rng.pick(["C", "D", "T", "Z"]); const ans = 90 - x;
      const stimulus = spin(rng, `Points ${P}, ${Q}, and ${c} lie on a circle with center O. Inscribed angle ${P}${c}${Q} measures ${x} degrees. Segments O${P} and O${Q} are radii of the circle.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the measure of angle O${P}${Q}, in degrees?|Find the measure of angle O${P}${Q}, in degrees.|How many degrees is angle O${P}${Q}?]]`), correct: ans,
        wrongs: [W(2 * x, "step_missing", "중심각을 답했다."), W(x, "step_missing", "원주각을 그대로 답했다."), W(180 - 2 * x, "step_missing", "두 밑각의 합을 답했다."), W(90 + x, "formula_misuse", "90° 에 원주각을 더했다."), W(180 - x, "formula_misuse", "180° 에서 원주각을 뺐다.")],
        verificationJs: withParams({ x }, "const central=2*P.x; const base=(180-central)/2; return base;"),
        trace: [
          [`같은 호의 중심각 ${P}O${Q} 는 원주각의 2 배인 ${2 * x}° 이다.`, "Central angle."],
          [`O${P} 와 O${Q} 는 모두 반지름이므로 삼각형 ${P}O${Q} 는 이등변삼각형이다.`, "Isosceles because OA = OB."],
          ["밑각 두 개는 서로 같다.", "The base angles are equal."],
          [`삼각형 내각의 합이 180° 이므로 밑각 하나는 (180° − ${2 * x}°) ÷ 2 이다.`, "Angle sum."],
          [`따라서 ${ans}° 이다.`, "Answer."],
        ],
        variant: "base_angle",
      });
      return sem(out, [{ v: x, words: ["measures", "degrees"] }], { words: ["angle"], forbid: [] });
    },
  },
  {
    id: "ci.central_from_inscribed.constraint_select", skill: SKILL, kind: "central_from_inscribed", operator: "constraint_select",
    structure: "중심각이 m° 의 배수이고 lo° 초과 hi° 미만일 때, 중심각 = 2×원주각 이므로 가능한 원주각(정수)의 개수를 셈",
    extraThinking: "제약(배수·범위)을 만족하는 후보 중심각을 열거하고 원주각으로 환산해 개수를 셈 — medium 은 원주각의 2 배 계산",
    concepts: ["원주각과 중심각", "배수 조건", "범위 제약 후 개수"], mediumSteps: 1,
    generate(rng) {
      const m = rng.pick([14, 18, 20, 24, 30, 36, 40]), lo = rng.int(30, 120), hi = lo + rng.int(90, 200); if (hi >= 360) throw new GenFail("x");
      const cs: number[] = []; for (let c = lo + 1; c < hi; c++) if (c % m === 0) cs.push(c); if (cs.length < 3 || cs.length > 8) throw new GenFail("x");
      const [P, Q] = rng.pick([["A", "B"], ["P", "Q"], ["R", "S"]]); const c0 = rng.pick(["C", "D"]);
      const stimulus = spin(rng, `[[In a circle with center O, inscribed angle ${P}${c0}${Q} and central angle ${P}O${Q} intercept the same arc.|Angle ${P}${c0}${Q} is an inscribed angle of a circle with center O, and angle ${P}O${Q} is the central angle on the same arc.|A circle has center O. Inscribed angle ${P}${c0}${Q} and central angle ${P}O${Q} cut off the same arc.]] [[The measure of angle ${P}O${Q} is a multiple of ${m} degrees and is greater than ${lo} degrees but less than ${hi} degrees.|Angle ${P}O${Q} measures a multiple of ${m} degrees, with more than ${lo} degrees but fewer than ${hi} degrees.|The central angle is a multiple of ${m} degrees lying strictly between ${lo} degrees and ${hi} degrees.]]`);
      const n = cs.length;
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[How many different whole-number measures are possible for angle ${P}${c0}${Q}?|How many possible whole-number values does the inscribed angle ${P}${c0}${Q} have?|Find the number of possible whole-number measures of angle ${P}${c0}${Q}.]]`), correct: n,
        wrongs: [W(n + 1, "other", "경계값을 포함해 하나 더 셌다."), W(n - 1, "other", "경계 근처의 값을 하나 빠뜨렸다."), W(Math.floor((hi - lo) / m) + 1, "formula_misuse", "범위의 길이를 m 으로 나눠 어림했다."), W(Math.floor((hi - lo) / (2 * m)), "formula_misuse", "원주각의 배수 간격으로 잘못 계산했다."), W(Math.floor((hi - lo) / m), "other", "구간 안의 배수를 어림했다.")],
        verificationJs: withParams({ m, lo, hi }, "let c=0; for(let x=1;x<=180;x++){ const central=2*x; if(central>P.lo && central<P.hi && central%P.m===0) c++; }\nreturn c;"),
        trace: [
          ["중심각은 같은 호의 원주각의 2 배이므로 원주각 = 중심각 ÷ 2 이다.", "Inscribed angle is half the central angle."],
          [`중심각은 ${m} 의 배수이고 ${lo} 초과 ${hi} 미만이다.`, "State the constraints."],
          [`가능한 중심각: ${cs.join(", ")}.`, "List the possible central angles."],
          [`각각을 반으로 나누면 원주각은 ${cs.map((v) => v / 2).join(", ")} 이다(모두 정수).`, "Halve each."],
          [`따라서 ${n} 가지이다.`, "Count."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: m, words: ["multiple"] }, { v: lo, words: ["greater", "more", "between", "strictly"] }, { v: hi, words: ["less", "fewer", "between", "strictly"] }], { words: ["how many", "number of"], forbid: [] });
    },
  },
  // ───────────── inscribed_from_central ─────────────
  {
    id: "ci.inscribed_from_central.inverse", skill: SKILL, kind: "inscribed_from_central", operator: "inverse",
    structure: "중심각이 원주각보다 k 크다(같은 호)는 조건에서 원주각 = k 를 구하고, 반대쪽 호 위의 원주각 180° − k 를 구함",
    extraThinking: "관계식으로 원주각을 역산한 뒤 맞은편 호의 원주각(합이 180°)으로 다시 계산 — medium 은 중심각의 절반 계산",
    concepts: ["원주각과 중심각", "맞은편 원주각(보각 180°)", "일차식"], mediumSteps: 1,
    generate(rng) {
      const k = rng.int(30, 80); if (k === 60) throw new GenFail("x"); const [P, Q] = rng.pick([["A", "B"], ["P", "Q"], ["R", "S"], ["M", "N"]]); const [c1, c2] = rng.pick([["C", "D"], ["T", "U"], ["X", "Z"]]); const ans = 180 - k;
      const stimulus = spin(rng, `In a circle with center O, point ${c1} lies on the major arc ${P}${Q} and point ${c2} lies on the minor arc ${P}${Q}. Central angle ${P}O${Q} measures ${k} degrees more than inscribed angle ${P}${c1}${Q}.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the measure of inscribed angle ${P}${c2}${Q}, in degrees?|Find the measure of angle ${P}${c2}${Q}, in degrees.|How many degrees is angle ${P}${c2}${Q}?]]`), correct: ans,
        wrongs: [W(k, "step_missing", `원주각 ${P}${c1}${Q} 를 답했다.`), W(2 * k, "step_missing", "중심각을 답했다."), W(180 - 2 * k, "formula_misuse", "180° 에서 중심각을 뺐다."), W(360 - 2 * k, "formula_misuse", "큰 호의 크기를 답했다."), W(90 - k / 2, "other", "계산 실수.")],
        verificationJs: withParams({ k }, "const out=[];\nfor(let x=1;x<=179;x++){ const central=2*x; if(central-x===P.k) out.push(180-x); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          ["같은 호의 중심각은 원주각 x 의 2 배인 2x 이다.", "Central angle is twice the inscribed angle."],
          [`문장에 따라 2x = x + ${k} 이다.`, "Translate the sentence."],
          [`x = ${k} 이다.`, "Solve."],
          [`${c2} 는 작은 호 위에 있어 큰 호를 가리키므로 ∠${P}${c2}${Q} = 180° − x 이다(맞은편 원주각의 합 180°).`, "Opposite inscribed angles sum to 180 degrees."],
          [`${180 - k}° 이다.`, "Answer."],
        ],
        variant: "opposite_angle",
      });
      return sem(out, [{ v: k, words: ["more"] }], { words: ["angle"], forbid: [] });
    },
  },
  {
    id: "ci.inscribed_from_central.chain2", skill: SKILL, kind: "inscribed_from_central", operator: "chain2",
    structure: "작은 호 AB 의 중심각 c 에서 큰 호 360−c 를 구하고, 작은 호 위의 점 C 에서 본 원주각이 큰 호의 절반 180−c/2 임을 구함",
    extraThinking: "점의 위치(작은 호 위)에 따라 가리키는 호가 바뀜을 반영한 2단계 연쇄 — medium 은 중심각의 절반 계산",
    concepts: ["원주각과 중심각", "점의 위치와 가리키는 호", "큰 호(360°−c)"], mediumSteps: 1,
    generate(rng) {
      const c = rng.pick([50, 60, 70, 80, 90, 100, 110, 120, 130, 140]); const [P, Q] = rng.pick([["A", "B"], ["P", "Q"], ["R", "S"], ["M", "N"]]); const t = rng.pick(["C", "D", "T", "Z"]); const ans = 180 - c / 2;
      const stimulus = spin(rng, `In a circle with center O, central angle ${P}O${Q} measures ${c} degrees. Point ${t} lies on the minor arc ${P}${Q}.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the measure of inscribed angle ${P}${t}${Q}, in degrees?|Find the measure of angle ${P}${t}${Q}, in degrees.|How many degrees is inscribed angle ${P}${t}${Q}?]]`), correct: ans,
        wrongs: [W(c / 2, "geometry_misapplied", "점이 큰 호 위에 있는 경우의 원주각(c/2)을 답했다."), W(360 - c, "step_missing", "큰 호의 크기를 답했다."), W(180 - c, "formula_misuse", "180° 에서 중심각을 뺐다."), W(c, "step_missing", "중심각을 답했다."), W(360 - c / 2, "formula_misuse", "360° 에서 원주각을 뺐다.")],
        verificationJs: withParams({ c }, "const major=360-P.c; return major/2;"),
        trace: [
          [`작은 호 ${P}${Q} 의 크기는 중심각과 같은 ${c}° 이다.`, "The minor arc equals the central angle."],
          [`${t} 가 작은 호 위에 있으므로 ∠${P}${t}${Q} 는 반대편의 큰 호를 가리킨다.`, "The angle intercepts the other arc."],
          [`큰 호의 크기는 360° − ${c}° = ${360 - c}° 이다.`, "Major arc."],
          ["원주각은 가리키는 호의 절반이다.", "Inscribed angle is half its arc."],
          [`${360 - c}° ÷ 2 = ${ans}° 이다.`, "Answer."],
        ],
        variant: "point_on_minor_arc",
      });
      return sem(out, [{ v: c, words: ["measures", "degrees"] }], { words: ["angle"], forbid: [] });
    },
  },
  {
    id: "ci.inscribed_from_central.constraint_select", skill: SKILL, kind: "inscribed_from_central", operator: "constraint_select",
    structure: "원주각이 m 의 배수인 정수이고 중심각이 lo 초과 hi 미만일 때, 중심각 = 2×원주각 이므로 가능한 중심각의 개수를 셈",
    extraThinking: "제약(원주각이 배수인 정수·범위)을 중심각으로 옮겨(2m 의 배수) 후보를 열거해 셈 — medium 은 중심각의 절반 계산",
    concepts: ["원주각과 중심각", "배수·정수 조건", "범위 제약 후 개수"], mediumSteps: 1,
    generate(rng) {
      const m = rng.pick([5, 6, 7, 8, 9, 10, 12]), lo = rng.int(40, 150), hi = lo + rng.int(80, 190); if (hi >= 360) throw new GenFail("x");
      const cs: number[] = []; for (let c = lo + 1; c < hi; c++) if (c % 2 === 0 && (c / 2) % m === 0) cs.push(c); if (cs.length < 3 || cs.length > 9) throw new GenFail("x");
      const [P, Q] = rng.pick([["A", "B"], ["P", "Q"], ["R", "S"]]); const t = rng.pick(["C", "D"]); const n = cs.length;
      const stimulus = spin(rng, `[[In a circle with center O, central angle ${P}O${Q} is greater than ${lo} degrees but less than ${hi} degrees.|A circle has center O, and central angle ${P}O${Q} lies strictly between ${lo} degrees and ${hi} degrees.|Central angle ${P}O${Q} of a circle with center O measures more than ${lo} degrees but fewer than ${hi} degrees.]] [[The inscribed angle ${P}${t}${Q} intercepts the same arc, and its measure is a whole number of degrees that is a multiple of ${m}.|Inscribed angle ${P}${t}${Q} cuts off the same arc; its measure is a whole number of degrees and a multiple of ${m}.|On that same arc, the inscribed angle ${P}${t}${Q} has a whole-number measure in degrees that is a multiple of ${m}.]]`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[How many different measures are possible for central angle ${P}O${Q}?|How many possible values does the central angle ${P}O${Q} have, in degrees?|Find the number of possible measures of angle ${P}O${Q}.]]`), correct: n,
        wrongs: [W(n + 1, "other", "경계값을 포함해 하나 더 셌다."), W(n - 1, "other", "경계 근처의 값을 하나 빠뜨렸다."), W(Math.floor((hi - lo) / m), "formula_misuse", "중심각의 간격을 m 으로 잘못 계산했다."), W(Math.floor((hi - lo) / (4 * m)), "formula_misuse", "간격을 4m 으로 잘못 계산했다."), W(Math.floor((hi - lo) / 2), "formula_misuse", "짝수만 센다고 어림했다.")],
        verificationJs: withParams({ m, lo, hi }, "let c=0; for(let x=1;x<=180;x++){ const central=2*x; if(central>P.lo && central<P.hi && x%P.m===0) c++; }\nreturn c;"),
        trace: [
          ["원주각 x 는 정수이고 m 의 배수이다.", "State the inscribed angle condition."],
          [`중심각은 원주각의 2 배이므로 ${2 * m} 의 배수이다.`, "The central angle is a multiple of 2m."],
          [`${lo} 초과 ${hi} 미만의 ${2 * m} 의 배수를 나열한다: ${cs.join(", ")}.`, "List the multiples in range."],
          [`각각의 원주각은 ${cs.map((v) => v / 2).join(", ")} 이고 모두 ${m} 의 배수이다.`, "Check the inscribed angles."],
          [`따라서 ${n} 가지이다.`, "Count."],
        ],
        variant: "frame",
      });
      return sem(out, [{ v: lo, words: ["greater", "more", "between", "strictly"] }, { v: hi, words: ["less", "fewer", "between", "strictly"] }, { v: m, words: ["multiple"] }], { words: ["how many", "number of"], forbid: [] });
    },
  },
  {
    id: "ci.inscribed_from_central.repr_shift", skill: SKILL, kind: "inscribed_from_central", operator: "repr_shift",
    structure: "원주각이 x+a, 중심각이 bx+c 로 표현될 때 2(x+a)=bx+c 로 방정식을 세워 x 를 구해 원주각 x+a 를 계산",
    extraThinking: "각을 식으로 옮기고 원주각 정리로 방정식을 세우는 모델링 — medium 은 중심각의 절반 계산",
    concepts: ["원주각과 중심각", "문자식 표현", "일차방정식"], mediumSteps: 1,
    generate(rng) {
      const x = rng.int(10, 40), a = rng.int(-10, 15), b = rng.pick([3, 4, 5]); const c = 2 * (x + a) - b * x; if (Math.abs(c) > 60 || x + a < 5 || 2 * (x + a) >= 360 || a === 0) throw new GenFail("x"); const ans = x + a; const [P, Q] = rng.pick([["A", "B"], ["P", "Q"], ["R", "S"], ["M", "N"]]); const t = rng.pick(["C", "D", "T"]);
      const stimulus = spin(rng, `In a circle with center O, inscribed angle ${P}${t}${Q} and central angle ${P}O${Q} intercept the same arc. Angle ${P}${t}${Q} measures ${M(lin(1, a, "x"))} degrees, and angle ${P}O${Q} measures ${M(lin(b, c, "x"))} degrees.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What is the measure of angle ${P}${t}${Q}, in degrees?|Find the measure of inscribed angle ${P}${t}${Q}, in degrees.|How many degrees is angle ${P}${t}${Q}?]]`), correct: ans,
        wrongs: [W(x, "step_missing", "x 의 값만 답했다."), W(2 * ans, "step_missing", "중심각을 답했다."), W(b * x + c - ans, "formula_misuse", "중심각과 원주각의 차를 답했다."), W((x * b + c) , "formula_misuse", "중심각 식에 대입한 값을 원주각으로 답했다(같음 혼동)."), W(x + a + 10, "other", "계산 실수.")],
        verificationJs: withParams({ a, b, c }, "const out=[];\nfor(let x=1;x<=200;x++){ if(2*(x+P.a)===P.b*x+P.c) out.push(x+P.a); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          ["같은 호의 중심각은 원주각의 2 배이다.", "Central angle is twice the inscribed angle."],
          [`2(x ${a >= 0 ? "+" : "−"} ${Math.abs(a)}) = ${lin(b, c, "x").replace(/-/g, "−")} 로 식을 세운다.`, "Set up the equation."],
          [`좌변을 전개하면 ${lin(2, 2 * a, "x").replace(/-/g, "−")} 이다.`, "Expand."],
          [`${b - 2 === 1 ? "" : b - 2}x = ${2 * a - c} 이므로 x = ${x} 이다.`, "Solve for x."],
          [`원주각 = ${x} ${a >= 0 ? "+" : "−"} ${Math.abs(a)} = ${ans}° 이다.`, "Evaluate the inscribed angle."],
        ],
        variant: "frame",
      });
      return sem(out, [], { words: ["angle"], forbid: [] });
    },
  },
  // ───────────── circle_equation_transform ─────────────
  {
    id: "ci.circle_equation_transform.param_condition", skill: SKILL, kind: "circle_equation_transform", operator: "param_condition",
    structure: "x²+y²+Dx+Ey+k=0 을 완전제곱식으로 바꿔 r²=h²+k₀²−k 를 얻고 '반지름이 ρ' 또는 '축에 접한다' 는 조건으로 k 를 구함",
    extraThinking: "완전제곱식 변형과 '원이 되는/접하는' 조건을 식으로 번역해 매개변수를 결정 — medium 은 표준형에 중심·반지름 대입",
    concepts: ["완전제곱식 변형", "원의 방정식", "매개변수 조건(접함·반지름)"], mediumSteps: 1,
    generate(rng) {
      const h = rng.int(-6, 6), k0 = rng.int(-6, 6); if (h === 0 || k0 === 0 || h === k0) throw new GenFail("x"); const D = -2 * h, E = -2 * k0; const mode = rng.pick(["radius", "tangent_x", "tangent_y"] as const);
      const rho = rng.int(2, 9); let k: number; let cond: string; if (mode === "radius") { k = h * h + k0 * k0 - rho * rho; cond = `the circle has a radius of ${rho}`; } else if (mode === "tangent_x") { k = h * h; cond = "the circle is tangent to the x-axis"; } else { k = k0 * k0; cond = "the circle is tangent to the y-axis"; }
      if (Math.abs(k) > 200 || (mode === "radius" && (h * h + k0 * k0 - k) !== rho * rho)) throw new GenFail("x"); const eq = `x^2 + y^2${term2(D, "x")}${term2(E, "y")} + k = 0`;
      const stimulus = spin(rng, `[[In the xy-plane, the equation|The equation|The graph of the equation]] ${M(eq)} [[represents a circle, where k is a constant, and|is a circle for a certain constant k, and|describes a circle, with k a constant, such that]] ${cond}.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, "[[What is the value of k?|Find the value of k.|What must k equal?]]"), correct: k,
        wrongs: [W(-k, "sign_error", "상수항을 이항할 때 부호를 바꿨다."), W(h * h + k0 * k0, "step_missing", "r² 와 상수의 관계를 쓰지 않고 중심까지의 거리 제곱을 답했다."), W(mode === "radius" ? rho * rho : (mode === "tangent_x" ? k0 * k0 : h * h), "formula_misuse", "r² 를 k 로 답했다."), W(h * h + k0 * k0 + (mode === "radius" ? rho * rho : k), "sign_error", "r² 의 부호를 반대로 적용했다."), W(k + 2 * (h + k0), "other", "완전제곱식에서 상수를 잘못 더했다.")],
        verificationJs: withParams({ D, E, mode: mode === "radius" ? 0 : mode === "tangent_x" ? 1 : 2, rho: mode === "radius" ? rho : 1 }, "const out=[];\nfor(let k=-500;k<=500;k++){ const cx=-P.D/2, cy=-P.E/2; const r2=cx*cx+cy*cy-k; if(r2<=0) continue; let ok=false; if(P.mode===0) ok=(r2===P.rho*P.rho); else if(P.mode===1) ok=(r2===cy*cy); else ok=(r2===cx*cx); if(ok) out.push(k); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`x 항을 묶어 완전제곱식으로: x² ${D >= 0 ? "+" : "−"} ${Math.abs(D)}x = (x ${-h >= 0 ? "+" : "−"} ${Math.abs(h)})² − ${h * h} 이다.`, "Complete the square in x."],
          [`y 항도 같게: y² ${E >= 0 ? "+" : "−"} ${Math.abs(E)}y = (y ${-k0 >= 0 ? "+" : "−"} ${Math.abs(k0)})² − ${k0 * k0} 이다.`, "Complete the square in y."],
          [`정리하면 (x ${h >= 0 ? "−" : "+"} ${Math.abs(h)})² + (y ${k0 >= 0 ? "−" : "+"} ${Math.abs(k0)})² = ${h * h + k0 * k0} − k 이다(우변이 r²).`, "Standard form with r² on the right."],
          [mode === "radius" ? `반지름이 ${rho} 이므로 r² = ${rho * rho} 이다.` : mode === "tangent_x" ? `x축에 접하려면 반지름이 중심의 y좌표의 절댓값 ${Math.abs(k0)} 이어야 하므로 r² = ${k0 * k0} 이다.` : `y축에 접하려면 반지름이 중심의 x좌표의 절댓값 ${Math.abs(h)} 이어야 하므로 r² = ${h * h} 이다.`, "Translate the condition into r squared."],
          [`${h * h + k0 * k0} − k = r² 에서 k = ${k} 이다.`, "Solve for k."],
        ],
        variant: mode,
      });
      return sem(out, [], { words: ["value of k", "k"], forbid: [] });
    },
  },
  {
    id: "ci.circle_equation_transform.inverse", skill: SKILL, kind: "circle_equation_transform", operator: "inverse",
    structure: "중심 (h,k₀) 와 지나는 점 (a,b) 로 r² 를 구하고 전개한 일반형 x²+y²+Dx+Ey+F=0 의 상수 F=h²+k₀²−r² 를 구함",
    extraThinking: "중심과 한 점에서 거꾸로 방정식을 구성하고 일반형으로 전개 — medium 은 표준형에 중심·반지름 대입",
    concepts: ["원의 방정식(표준형)", "두 점 사이 거리", "일반형으로 전개"], mediumSteps: 1,
    generate(rng) {
      const h = rng.int(-5, 5), k0 = rng.int(-5, 5), a = rng.int(-8, 8), b = rng.int(-8, 8); const r2 = (a - h) ** 2 + (b - k0) ** 2; if (r2 < 4 || r2 > 150 || h === 0 || k0 === 0 || (a === h && b === k0) || Math.abs(h) === Math.abs(k0)) throw new GenFail("x"); const F = h * h + k0 * k0 - r2;
      const stimulus = spin(rng, `[[In the xy-plane, a circle has center ${M(`(${h}, ${k0})`)} and passes through the point ${M(`(${a}, ${b})`)}.|The center of a circle in the xy-plane is ${M(`(${h}, ${k0})`)}, and the point ${M(`(${a}, ${b})`)} lies on the circle.|Consider the circle in the xy-plane that is centered at ${M(`(${h}, ${k0})`)} and goes through the point ${M(`(${a}, ${b})`)}.]] [[The circle can be written as|An equation of this circle is|This circle has an equation of the form]] ${M("x^2 + y^2 + Dx + Ey + F = 0")}, where D, E, and F are constants.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, "[[What is the value of F?|Find the value of the constant term F.|If the equation is written in this form, what is F?|Determine F, the constant term of the equation.]]"), correct: F,
        wrongs: [W(r2, "step_missing", "r² 를 F 로 답했다."), W(-F, "sign_error", "F 의 부호를 반대로 적었다."), W(h * h + k0 * k0, "step_missing", "중심의 좌표 제곱합만 답했다."), W(r2 - h * h - k0 * k0 + 2 * h * k0, "other", "전개에서 상수를 잘못 더했다."), W(-r2, "sign_error", "r² 의 부호만 바꿔 답했다.")],
        verificationJs: withParams({ h, k0, a, b }, "const D=-2*P.h, E=-2*P.k0; const F=-(P.a*P.a+P.b*P.b+D*P.a+E*P.b); return F;"),
        trace: [
          [`반지름의 제곱은 중심에서 점까지 거리의 제곱이다: (${a} ${-h >= 0 ? "+" : "−"} ${Math.abs(h)})² + (${b} ${-k0 >= 0 ? "+" : "−"} ${Math.abs(k0)})² = ${r2} 이다.`, "r squared from the distance."],
          [`표준형은 (x ${-h >= 0 ? "+" : "−"} ${Math.abs(h)})² + (y ${-k0 >= 0 ? "+" : "−"} ${Math.abs(k0)})² = ${r2} 이다.`, "Standard form."],
          [`전개하면 x² + y² ${-2 * h >= 0 ? "+" : "−"} ${Math.abs(2 * h)}x ${-2 * k0 >= 0 ? "+" : "−"} ${Math.abs(2 * k0)}y + ${h * h + k0 * k0} − ${r2} = 0 이다.`, "Expand."],
          [`D = ${-2 * h}, E = ${-2 * k0} 이다.`, "Read D and E."],
          [`F = ${h * h + k0 * k0} − ${r2} = ${F} 이다.`, "Constant term."],
        ],
        variant: "constant_from_point",
      });
      return sem(out, [], { words: ["F"], forbid: [] });
    },
  },
  {
    id: "ci.circle_equation_transform.compose_kind", skill: SKILL, kind: "circle_equation_transform", operator: "compose_kind",
    structure: "원 (x−h)²+(y−k)²=r² 과 수평선 y=c 가 만드는 현의 길이를 중심에서 직선까지의 거리 d=|c−k| 와 피타고라스(√(r²−d²))로 구함",
    extraThinking: "원의 방정식 읽기를 거리·피타고라스와 합성해 현의 길이를 계산 — medium 은 표준형에 중심·반지름 대입",
    concepts: ["원의 방정식", "점과 직선 사이 거리", "피타고라스(현의 길이)"], mediumSteps: 1,
    generate(rng) {
      const [d, hc, r] = rng.pick(PYTH); const h = rng.int(-5, 5), k0 = rng.int(-5, 5); const up = rng.pick([1, -1]); const c = k0 + up * d; if (r * r > 700 || h === 0 || k0 === 0) throw new GenFail("x"); const chord = 2 * hc;
      const stimulus = spin(rng, `[[In the xy-plane, the circle|The graph of the equation|Consider the circle]] ${M(`(${shifted("x", -h)})^2 + (${shifted("y", -k0)})^2 = ${r * r}`)} [[intersects the horizontal line|meets the horizontal line|is cut by the horizontal line]] ${M(`y = ${c}`)} [[at two points.|in exactly two points.|at two different points.]]`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, "[[What is the distance between the two points of intersection?|Find the length of the chord that the line cuts from the circle.|What is the length of the segment of the line that lies inside the circle?|How far apart are the two points where the line and the circle meet?]]"), correct: chord,
        wrongs: [W(hc, "step_missing", "현의 절반만 답했다."), W(2 * r, "geometry_misapplied", "지름을 현의 길이로 답했다."), W(2 * d, "geometry_misapplied", "중심에서 직선까지 거리의 두 배를 답했다."), W(r, "geometry_misapplied", "반지름을 답했다."), W(2 * Math.abs(r - d), "formula_misuse", "피타고라스 대신 r − d 를 사용했다.")],
        verificationJs: withParams({ h, k0, R: r * r, c }, "const xs=[];\nfor(let x=-200;x<=200;x++){ if((x-P.h)*(x-P.h)+(P.c-P.k0)*(P.c-P.k0)===P.R) xs.push(x); }\nif(xs.length!==2) throw new Error('교점 2개 아님');\nreturn Math.max(...xs)-Math.min(...xs);"),
        trace: [
          [`방정식에서 중심은 (${h}, ${k0}), r² = ${r * r} 이므로 반지름은 ${r} 이다.`, "Read the center and radius."],
          [`직선 y = ${c} 와 중심의 y좌표 ${k0} 의 차이가 중심에서 직선까지의 거리 ${d} 이다.`, "Distance from the center to the line."],
          [`현의 절반 길이는 피타고라스로 √(${r}² − ${d}²) = ${hc} 이다.`, "Half-chord by Pythagoras."],
          ["중심에서 직선에 내린 수선은 현을 수직이등분한다.", "The perpendicular bisects the chord."],
          [`현의 길이는 2 × ${hc} = ${chord} 이다.`, "Chord length."],
        ],
        variant: "horizontal_line",
      });
      return sem(out, [], { words: ["distance", "length", "far apart"], forbid: [] });
    },
  },
  {
    id: "ci.circle_equation_transform.constraint_select", skill: SKILL, kind: "circle_equation_transform", operator: "constraint_select",
    structure: "원 (x−h)²+(y−k)²=R 위의 정수 좌표 점의 개수: 평행이동 후 a²+b²=R 의 정수해(부호·순서 포함)를 모두 셈",
    extraThinking: "정수 제약 아래 a²+b²=R 의 모든 해를 부호·순서까지 열거해 개수를 셈 — medium 은 표준형에 중심·반지름 대입",
    concepts: ["원의 방정식", "평행이동(중심 정수)", "정수해 열거"], mediumSteps: 1,
    generate(rng) {
      const R = rng.pick([5, 10, 13, 25, 50, 65, 85, 100, 125, 169, 130, 145, 17, 20, 26, 29, 34, 37, 41, 45, 52, 53, 58, 61, 68, 73, 74, 80, 89, 97]); const h = rng.int(-5, 5), k0 = rng.int(-5, 5); if (h === 0 || k0 === 0) throw new GenFail("x");
      const pairs: [number, number][] = []; let cnt = 0; for (let a = -20; a <= 20; a++) for (let b = -20; b <= 20; b++) if (a * a + b * b === R) { cnt++; if (a >= 0 && b >= 0 && a <= b) pairs.push([a, b]); }
      const pos = (() => { let c = 0; for (let a = 0; a <= 20; a++) for (let b = 0; b <= 20; b++) if (a * a + b * b === R) c++; return c; })();
      if (cnt < 4 || cnt > 24) throw new GenFail("x");
      const stimulus = spin(rng, `[[In the xy-plane, consider the circle|The graph of the equation|A circle in the xy-plane is given by]] ${M(`(${shifted("x", -h)})^2 + (${shifted("y", -k0)})^2 = ${R}`)}[[.|, where x and y are real numbers.]]`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, "[[How many points with integer coordinates lie on the circle?|Find the number of lattice points (points whose coordinates are both integers) on the circle.|How many points on the circle have two integer coordinates?]]"), correct: cnt,
        wrongs: [W(pos, "condition_ignored", "음수 부호의 경우를 세지 않았다."), W(cnt / 2, "other", "대칭인 경우의 절반만 셌다."), W(cnt + 4, "other", "축 위의 점을 중복해서 셌다."), W(cnt - 4, "other", "축 위의 점을 빠뜨렸다."), W(pairs.length, "condition_ignored", "순서와 부호를 고려하지 않고 서로 다른 제곱합 쌍만 셌다.")],
        verificationJs: withParams({ h, k0, R }, "let c=0;\nfor(let x=-60;x<=60;x++) for(let y=-60;y<=60;y++){ if((x-P.h)*(x-P.h)+(y-P.k0)*(y-P.k0)===P.R) c++; }\nreturn c;"),
        trace: [
          [`중심 (${h}, ${k0}) 가 정수점이므로 점 (x, y) 가 정수점일 필요충분조건은 a = x − ${h}, b = y − ${k0} 가 정수인 것이다.`, "Shift the center to the origin."],
          [`따라서 정수 a, b 에 대해 a² + b² = ${R} 의 해를 센다.`, "Reduce to a sum of two squares."],
          [`음이 아닌 해: ${pairs.map(([a, b]) => `(${a}, ${b})`).join(", ")} 이다(순서 무시).`, "List the nonnegative solutions."],
          ["각 쌍은 부호(±)와 순서를 바꾸면 서로 다른 점이 된다(0 이 있으면 부호 중복 제외).", "Count signs and orders."],
          [`모두 ${cnt} 개이다.`, "Total."],
        ],
        variant: "frame",
      });
      return sem(out, [], { words: ["integer"], forbid: [] });
    },
  },
 ] as Archetype[]).map(paraArch);

// ───────────────────────── easy / medium 원형(lite) — 14개 틀 ─────────────────────────
export const CI_LITE: LiteArchetype[] = [
  {
    id: "ci.circumference_radius.wheel", skill: SKILL, kind: "circumference_radius", frame: "wheel", levels: ["easy", "medium"], structure: "바퀴 한 바퀴의 둘레 2πr(easy) / n 바퀴 이동 거리(medium)",
    generate(rng, level) {
      const r = rng.int(2, level === "easy" ? 15 : 12), n = rng.int(2, 9); if (r === n) throw new GenFail("x"); const [nm, who] = rng.pick(WHEELS); const u = rng.pick(["centimeters", "inches", "meters", "feet"] as const); const coef = level === "easy" ? 2 * r : 2 * r * n;
      const stimulus = withOpen(rng, OPEN_GEO, spin(rng, `[[${who} has a radius of ${r} ${u}.|The radius of ${who.charAt(0).toLowerCase() + who.slice(1)} is ${r} ${u}.|${who} is a circle of radius ${r} ${u}.]]${level === "easy" ? "" : ` [[It rolls straight ahead and makes exactly ${n} complete turns.|It rolls along the ground through exactly ${n} complete turns.|It goes through exactly ${n} full turns as it rolls forward.]]`}`));
      const out = finish(rng, { stimulus, question: spin(rng, level === "easy" ? `[[What is the circumference of the ${nm}, in ${u}, in terms of π?|Find the circumference of the ${nm}, in ${u}, in terms of π.|How long is the edge of the ${nm}, in ${u}? Give the answer in terms of π.]]` : `[[How far does the ${nm} roll, in ${u}, in terms of π?|What distance does the ${nm} cover in those turns, in ${u}? Give the answer in terms of π.|Find the total distance rolled, in ${u}, in terms of π.]]`), correct: coef, fmt: piOpt,
        wrongs: [W(coef / 2, "formula_misuse", "둘레를 πr 로 계산했다."), W(level === "easy" ? r * r : r * r * n, "geometry_misapplied", "둘레 대신 넓이 계수를 계산했다."), W(coef * 2, "geometry_misapplied", "반지름을 지름처럼 취급했다."), W(level === "easy" ? coef + 2 : 2 * r, "step_missing", level === "easy" ? "계산 실수." : "한 바퀴의 거리만 답했다.")],
        verificationJs: withParams({ r, n: level === "easy" ? 1 : n }, "let d=0; for(let i=0;i<P.n;i++) d+=2*P.r;\nreturn d;"),
        trace: [[`둘레 = 2π × ${r} = ${2 * r}π 이다.`, "Circumference."], ...(level === "easy" ? [] : [[`${n} 바퀴이므로 ${2 * r}π × ${n} = ${coef}π 이다.`, "Multiply by the number of turns."] as [string, string]])], variant: level === "easy" ? "circumference" : "distance" });
      return sem(out, [{ v: r, words: ["radius"] }, ...(level === "easy" ? [] : [{ v: n, words: ["turns", "complete"] }])], { words: level === "easy" ? ["circumference", "edge"] : ["far", "distance", "roll"], forbid: forbidExcept(...(level === "easy" ? ["circumference"] : [])) });
    },
  },
  {
    id: "ci.circumference_radius.fence", skill: SKILL, kind: "circumference_radius", frame: "fence", levels: ["easy", "medium"], structure: "원형 정원 울타리 길이 2πr(easy) / 단가를 곱한 비용(medium)",
    generate(rng, level) {
      const r = rng.int(3, 20), cost = rng.pick([2, 3, 4, 5, 6, 8]); if (r === cost) throw new GenFail("x"); const [nm, who] = rng.pick(ROUND); const u = rng.pick(UNITS); const coef = level === "easy" ? 2 * r : 2 * r * cost;
      const stimulus = withOpen(rng, OPEN_GEO, spin(rng, `[[${who} has a radius of ${r} ${u}. A fence will be built along its entire edge.|The radius of ${who.charAt(0).toLowerCase() + who.slice(1)} is ${r} ${u}, and a fence is to run all the way along its edge.|${who} with a radius of ${r} ${u} is going to be fenced in around its whole edge.]]${level === "easy" ? "" : ` [[The fence costs ${cost} dollars for each ${SING[u]} of fencing.|Fencing is priced at ${cost} dollars for every ${SING[u]}.|Each ${SING[u]} of fence costs ${cost} dollars.]]`}`));
      const out = finish(rng, { stimulus, question: spin(rng, level === "easy" ? `[[How many ${u} of fencing are needed, in terms of π?|What length of fence is needed around the ${nm}, in ${u}? Give the answer in terms of π.|Find the total amount of fencing, in ${u}, in terms of π.]]` : `[[What is the total cost of the fence, in dollars, in terms of π?|How many dollars will the fence around the ${nm} cost? Give the answer in terms of π.|Find the cost of fencing the whole edge, in dollars, in terms of π.]]`), correct: coef, fmt: piOpt,
        wrongs: [W(coef / 2, "formula_misuse", "둘레를 πr 로 계산했다."), W(level === "easy" ? r * r : r * r * cost, "geometry_misapplied", "둘레 대신 넓이 계수를 계산했다."), W(coef * 2, "geometry_misapplied", "반지름을 지름처럼 취급했다."), W(level === "easy" ? coef + 2 : 2 * r, "step_missing", level === "easy" ? "계산 실수." : "단가를 곱하지 않았다.")],
        verificationJs: withParams({ r, cost: level === "easy" ? 1 : cost }, "let t=0; for(let i=0;i<2*P.r;i++) t+=P.cost;\nreturn t;"),
        trace: [[`울타리의 길이는 원둘레 2π × ${r} = ${2 * r}π 이다.`, "Fence length is the circumference."], ...(level === "easy" ? [] : [[`비용 = ${2 * r}π × ${cost} = ${coef}π 달러이다.`, "Multiply by the unit cost."] as [string, string]])], variant: level === "easy" ? "length" : "cost" });
      return sem(out, [{ v: r, words: ["radius"] }], { words: level === "easy" ? ["fencing", "fence"] : ["cost", "dollars"], forbid: forbidExcept(...(level === "easy" ? ["length"] : [])) });
    },
  },
  {
    id: "ci.circumference_diameter.pizza", skill: SKILL, kind: "circumference_diameter", frame: "pizza", levels: ["easy", "medium"], structure: "지름으로 둘레 πd(easy) / 두 원의 둘레 차(medium)",
    generate(rng, level) {
      const d1 = rng.int(4, 30), d2 = rng.int(d1 + 2, 40); if (d1 === d2) throw new GenFail("x"); const [nm, who] = rng.pick([["pizza", "A round pizza"], ["pie", "A round pie"], ["tray", "A round serving tray"], ["plate", "A large round plate"], ["cake", "A round cake"], ["table", "A round table"]]); const u = rng.pick(["inches", "centimeters"] as const); const coef = level === "easy" ? d1 : d2 - d1;
      const stimulus = withOpen(rng, OPEN_GEO, spin(rng, level === "easy" ? `[[${who} has a diameter of ${d1} ${u}.|The diameter of ${who.charAt(0).toLowerCase() + who.slice(1)} is ${d1} ${u}.|${who} measures ${d1} ${u} across, through its center.]]` : `[[${who} has a diameter of ${d1} ${u}. A larger one has a diameter of ${d2} ${u}.|${who} has a diameter of ${d1} ${u}, and a bigger one of the same kind has a diameter of ${d2} ${u}.|Two round items are the same kind: the smaller has a diameter of ${d1} ${u} and the larger has a diameter of ${d2} ${u}.]]`));
      const out = finish(rng, { stimulus, question: spin(rng, level === "easy" ? `[[What is the circumference of the ${nm}, in ${u}, in terms of π?|Find the circumference of the ${nm}, in ${u}, in terms of π.|How far is it around the ${nm}, in ${u}? Give the answer in terms of π.|Determine the circumference of the ${nm} in ${u}, in terms of π.]]` : `[[By how many ${u} is the circumference of the larger one greater than that of the smaller one, in terms of π?|What is the difference between the two circumferences, in ${u}, in terms of π?|How much longer, in ${u}, is the distance around the larger one than around the smaller one? Give the answer in terms of π.]]`), correct: coef, fmt: piOpt,
        wrongs: [W(coef * 2, "geometry_misapplied", "지름을 반지름처럼 보고 2πd 로 계산했다."), W(coef / 2, "formula_misuse", "둘레를 πd/2 로 계산했다."), W(level === "easy" ? (d1 * d1) / 4 : (d2 * d2 - d1 * d1) / 4, "geometry_misapplied", level === "easy" ? "둘레 대신 넓이 계수를 계산했다." : "넓이의 차를 구했다."), W(level === "easy" ? coef + 2 : d1 + d2, level === "easy" ? "other" : "sign_error", level === "easy" ? "계산 실수." : "둘레를 더했다.")],
        verificationJs: withParams(level === "easy" ? { d1, d2: 0, easy: 1 } : { d1, d2, easy: 0 }, "return P.easy? P.d1 : P.d2-P.d1;"),
        trace: level === "easy" ? [[`둘레 = π × ${d1} = ${d1}π 이다.`, "Circumference."]] : [[`작은 원의 둘레는 ${d1}π, 큰 원의 둘레는 ${d2}π 이다.`, "Both circumferences."], [`차이는 ${d2}π − ${d1}π = ${d2 - d1}π 이다.`, "Subtract."]], variant: level === "easy" ? "circumference" : "difference" });
      return sem(out, [{ v: d1, words: ["diameter", "across"] }, ...(level === "easy" ? [] : [{ v: d2, words: ["diameter"] }])], { words: level === "easy" ? ["circumference", "around"] : ["circumference", "difference", "around", "longer"], forbid: forbidExcept("circumference") });
    },
  },
  {
    id: "ci.circumference_diameter.rope", skill: SKILL, kind: "circumference_diameter", frame: "rope", levels: ["easy", "medium"], structure: "기둥을 한 바퀴 감는 끈의 길이 πd(easy) / k 바퀴 감는 끈의 길이(medium)",
    generate(rng, level) {
      const d = rng.int(3, 30), k = rng.int(2, 9); if (d === k) throw new GenFail("x"); const [nm, who] = rng.pick([["pole", "A rope"], ["pipe", "A cord"], ["post", "A ribbon"], ["barrel", "A strap"], ["tree trunk", "A cable"], ["column", "A string of lights"]]); const u = rng.pick(["inches", "centimeters", "feet"] as const); const coef = level === "easy" ? d : d * k;
      const stimulus = withOpen(rng, OPEN_GEO, spin(rng, `[[${who} is wrapped around a cylindrical ${nm} that has a diameter of ${d} ${u}.|A cylindrical ${nm} has a diameter of ${d} ${u}, and ${who.charAt(0).toLowerCase() + who.slice(1)} is wound around it.|Around a cylindrical ${nm} with a diameter of ${d} ${u}, ${who.charAt(0).toLowerCase() + who.slice(1)} is wrapped snugly.]]${level === "easy" ? " [[The wrapping goes around the outside exactly once.|It makes exactly one trip around the outside.|It circles the outside one time and no more.]]" : ` [[The material goes around the outside exactly ${k} times.|It winds around the outside exactly ${k} times.|It makes exactly ${k} complete trips around the outside.]]`}`));
      const out = finish(rng, { stimulus, question: spin(rng, `[[What is the length of the material used for the wrapping, in ${u}, in terms of π?|How long is the wrapping, in ${u}? Give the answer in terms of π.|Find the total length of material needed, in ${u}, in terms of π.|Determine how many ${u} of material the wrapping uses. Give the answer in terms of π.]]`), correct: coef, fmt: piOpt,
        wrongs: [W(coef * 2, "geometry_misapplied", "지름을 반지름처럼 보고 2πd 로 계산했다."), W(coef / 2, "formula_misuse", "둘레를 πd/2 로 계산했다."), W(level === "easy" ? (d * d) / 4 : d * k * k, "geometry_misapplied", level === "easy" ? "둘레 대신 넓이 계수를 계산했다." : "감은 횟수를 제곱했다."), W(level === "easy" ? coef + 2 : d, level === "easy" ? "other" : "step_missing", level === "easy" ? "계산 실수." : "한 바퀴의 길이만 답했다.")],
        verificationJs: withParams({ d, k: level === "easy" ? 1 : k }, "let t=0; for(let i=0;i<P.k;i++) t+=P.d;\nreturn t;"),
        trace: [[`한 바퀴 = π × ${d} = ${d}π 이다.`, "One wrap."], ...(level === "easy" ? [] : [[`${k} 바퀴이므로 ${d}π × ${k} = ${coef}π 이다.`, "Multiply by the number of wraps."] as [string, string]])], variant: level === "easy" ? "one_wrap" : "k_wraps" });
      return sem(out, [{ v: d, words: ["diameter"] }, ...(level === "easy" ? [] : [{ v: k, words: ["times", "around"] }])], { words: ["length", "long", "material", "wrapping"], forbid: forbidExcept("length") });
    },
  },
  {
    id: "ci.arc_length.sector", skill: SKILL, kind: "arc_length", frame: "sector", levels: ["easy", "medium"], structure: "쉬운 중심각의 호의 길이(easy) / 일반 중심각의 호의 길이(medium)",
    generate(rng, level) {
      const th = rng.pick(level === "easy" ? [90, 180, 60, 120] : [45, 72, 150, 30, 135, 40]), r = rng.int(3, 24); const coef = (th * r) / 180; if (!Number.isInteger(coef) || coef < 2 || r === th || coef === r) throw new GenFail("x"); const [nm, who] = rng.pick(ROUND); const u = rng.pick(UNITS);
      const stimulus = withOpen(rng, OPEN_GEO, spin(rng, `${who} has a radius of ${r} ${u}. An arc AB of the ${nm}'s edge corresponds to a central angle of ${th} degrees.`));
      const out = finish(rng, { stimulus, question: spin(rng, `[[What is the length of arc AB, in ${u}, in terms of π?|Find the length of arc AB, in ${u}, in terms of π.|How long is arc AB, in ${u}? Give the answer in terms of π.]]`), correct: coef, fmt: piOpt,
        wrongs: [W(2 * r, "step_missing", "원둘레를 답했다."), W((th * r * r) / 360, "geometry_misapplied", "호의 길이 대신 부채꼴 넓이를 계산했다."), W(coef * 2, "formula_misuse", "비율을 θ/180 대신 θ/90 으로 계산했다."), W(coef / 2, "formula_misuse", "둘레를 πr 로 계산했다."), W((th * 2 * r) / 360 + r, "other", "계산 실수.")],
        verificationJs: withParams({ r, th }, "let arc=0; for(let a=0;a<P.th;a++) arc+=2*P.r/360;\nreturn Math.round(arc*1e6)/1e6;"),
        trace: [[`원둘레는 2π × ${r} = ${2 * r}π 이다.`, "Circumference."], [`호는 원둘레의 ${th}/360 이므로 ${coef}π 이다.`, "Fraction of the circumference."]], variant: level === "easy" ? "friendly_angle" : "general_angle" });
      return sem(out, [{ v: r, words: ["radius"] }, { v: th, words: ["angle", "degrees"] }], { words: ["arc"], forbid: forbidExcept("arc", "length") });
    },
  },
  {
    id: "ci.arc_length.clock", skill: SKILL, kind: "arc_length", frame: "clock", levels: ["easy", "medium"], structure: "분침 끝이 그리는 호(분 → 각도): 15·30·45분(easy) / 그 밖의 분(medium)",
    generate(rng, level) {
      const r = rng.pick([6, 9, 10, 12, 15, 18, 20, 24, 30]), m = rng.pick(level === "easy" ? [15, 30, 45] : [10, 20, 25, 35, 40, 50, 5]); const coef = (r * m) / 30; if (!Number.isInteger(coef) || coef < 1 || r === m) throw new GenFail("x");
      const [nm, who] = rng.pick([["wall clock", "The minute hand of a wall clock"], ["station clock", "The minute hand of a station clock"], ["clock tower", "The minute hand of a clock tower"], ["school clock", "The minute hand of a school clock"], ["kitchen clock", "The minute hand of a kitchen clock"]]);
      const stimulus = withOpen(rng, OPEN_GEO, spin(rng, `[[${who} is ${r} centimeters long. A full turn of the hand takes 60 minutes.|The hand is ${r} centimeters long, and it needs 60 minutes for one full turn.|${who} measures ${r} centimeters, and it takes exactly 60 minutes to go once around the dial.]]`));
      const out = finish(rng, { stimulus, question: spin(rng, `[[How far does the tip of the minute hand move in ${m} minutes, in centimeters, in terms of π?|In ${m} minutes, what distance does the tip of the hand travel, in centimeters, in terms of π?|Find the length of the path traced by the tip of the minute hand in ${m} minutes, in centimeters, in terms of π.|During ${m} minutes, how many centimeters does the tip of the hand travel? Give the answer in terms of π.]]`), correct: coef, fmt: piOpt,
        wrongs: [W(coef * 2, "geometry_misapplied", "분침의 길이를 지름으로 착각했다."), W(coef / 2, "formula_misuse", "둘레를 πr 로 계산했다."), W(2 * r, "step_missing", "한 바퀴의 거리를 답했다."), W((r * r * m) / 360, "geometry_misapplied", "호의 길이 대신 부채꼴 넓이로 계산했다.")],
        verificationJs: withParams({ r, m }, "let deg=0; for(let t=0;t<P.m;t++) deg+=6;\nreturn Math.round(2*P.r*deg/360*1e6)/1e6;"),
        trace: [[`${m}분 동안 분침은 ${6 * m}° 돈다(1분에 6°).`, "Angle swept."], [`호는 원둘레 2π × ${r} = ${2 * r}π 의 ${6 * m}/360 이므로 ${coef}π 이다.`, "Arc length."]], variant: level === "easy" ? "quarter_turns" : "other_minutes" });
      return sem(out, [{ v: r, words: ["hand", "long"] }, { v: m, words: ["minutes"] }], { words: ["far", "distance", "travel", "move", "path"], forbid: forbidExcept("length") });
    },
  },
  {
    id: "ci.sector_area.slice", skill: SKILL, kind: "sector_area", frame: "slice", levels: ["easy", "medium"], structure: "쉬운 중심각 부채꼴 넓이(easy) / n 등분 중 k 조각의 넓이(medium)",
    generate(rng, level) {
      const r = rng.int(3, 20); const [nm, who] = rng.pick([["pizza", "A round pizza"], ["pie", "A round pie"], ["cake", "A round cake"], ["flatbread", "A round flatbread"], ["quiche", "A round quiche"]]); const u = rng.pick(["inches", "centimeters"] as const);
      if (level === "easy") { const th = rng.pick([90, 180, 60, 120, 45, 30, 72, 40]); const c = (th * r * r) / 360; if (!Number.isInteger(c) || c < 2 || c > 300 || r === th) throw new GenFail("x");
        const out = finish(rng, { stimulus: withOpen(rng, OPEN_GEO, spin(rng, `[[${who} has a radius of ${r} ${u}. A slice of it forms a sector with a central angle of ${th} degrees.|The radius of ${who.charAt(0).toLowerCase() + who.slice(1)} is ${r} ${u}. One slice is a sector whose central angle measures ${th} degrees.|A slice is cut from ${who.charAt(0).toLowerCase() + who.slice(1)} of radius ${r} ${u}, and the slice's central angle is ${th} degrees.]]`)), question: spin(rng, `[[What is the area of the slice, in square ${u}, in terms of π?|Find the area of the slice, in square ${u}, in terms of π.|How many square ${u} does the slice cover, in terms of π?|Determine the area of the slice in square ${u}, leaving the answer in terms of π.]]`), correct: c, fmt: piOpt,
          wrongs: [W(r * r, "step_missing", "원 전체의 넓이를 답했다."), W((th * r) / 180, "geometry_misapplied", "부채꼴 넓이 대신 호의 길이를 계산했다."), W((th * r * r) / 180, "formula_misuse", "비율을 θ/180 으로 계산했다."), W(c * 4, "geometry_misapplied", "반지름 대신 지름을 제곱했다.")],
          verificationJs: withParams({ r, th }, "return Math.round(P.th*P.r*P.r/360*1e6)/1e6;"), trace: [[`원 전체의 넓이는 π × ${r}² = ${r * r}π 이다.`, "Area of the circle."], [`부채꼴은 ${th}/360 이므로 ${c}π 이다.`, "Take the fraction."]], variant: "angle_given" });
        return sem(out, [{ v: r, words: ["radius"] }, { v: th, words: ["angle", "degrees"] }], { words: ["area", "cover"], forbid: forbidExcept("area") }); }
      const n = rng.pick([4, 6, 8, 12, 3, 5, 10]), k = rng.int(2, n - 1); const c = (k * r * r) / n; if (!Number.isInteger(c) || c < 2 || c > 300 || r === n || r === k || k === n) throw new GenFail("x");
      const [who2] = rng.pick([["Maya"], ["Jordan"], ["Kofi"], ["Sana"], ["Luis"]]);
      const out = finish(rng, { stimulus: withOpen(rng, OPEN_GEO, spin(rng, `[[${who} has a radius of ${r} ${u}. It is cut into ${n} equal slices, and ${who2} eats ${k} of them.|${who2} is served ${k} slices of ${who.charAt(0).toLowerCase() + who.slice(1)} that has a radius of ${r} ${u} and was cut into ${n} equal slices.|The radius of ${who.charAt(0).toLowerCase() + who.slice(1)} is ${r} ${u}; it is divided into ${n} equal slices, and ${who2} takes ${k} of them.]]`)), question: spin(rng, `[[What is the total area of the slices ${who2} eats, in square ${u}, in terms of π?|Find the combined area of the ${k} slices, in square ${u}, in terms of π.|How many square ${u} do the ${k} slices cover together, in terms of π?]]`), correct: c, fmt: piOpt,
        wrongs: [W(r * r, "step_missing", "원 전체의 넓이를 답했다."), W((r * r) / n, "step_missing", "한 조각의 넓이만 답했다."), W((k * r) / n * 2, "geometry_misapplied", "호의 길이로 계산했다."), W(c * 4, "geometry_misapplied", "반지름 대신 지름을 제곱했다.")],
        verificationJs: withParams({ r, n, k }, "let a=0; for(let i=0;i<P.k;i++) a+=P.r*P.r/P.n;\nreturn Math.round(a*1e6)/1e6;"), trace: [[`원 전체의 넓이는 π × ${r}² = ${r * r}π 이다.`, "Area of the circle."], [`한 조각은 1/${n} 이므로 ${k} 조각은 ${k}/${n} 이다.`, "Fraction eaten."], [`${k}/${n} × ${r * r}π = ${c}π 이다.`, "Area of the slices."]], variant: "equal_slices" });
      return sem(out, [{ v: r, words: ["radius"] }, { v: n, words: ["slices", "equal"] }, { v: k, words: ["slices", "eats"] }], { words: ["area", "cover"], forbid: forbidExcept("area") });
    },
  },
  {
    id: "ci.sector_area.pie", skill: SKILL, kind: "sector_area", frame: "pie", levels: ["easy", "medium"], structure: "분수·퍼센트로 주어진 부채꼴의 넓이(easy: 1/4·1/2, medium: 그 밖의 비율)",
    generate(rng, level) {
      const r = rng.int(2, 24); const [num, den, txt] = rng.pick((level === "easy" ? [[1, 4, "one fourth"], [1, 2, "one half"], [3, 4, "three fourths"]] : [[1, 6, "one sixth"], [1, 3, "one third"], [5, 12, "five twelfths"], [1, 8, "one eighth"], [2, 5, "two fifths"], [3, 8, "three eighths"]]) as [number, number, string][]); const c = (num * r * r) / den; if (!Number.isInteger(c) || c < 2 || c > 300 || r === den || r === num) throw new GenFail("x");
      const [nm, who] = rng.pick([["budget chart", "A circular budget chart"], ["survey chart", "A circular survey chart"], ["spinner", "A circular game spinner"], ["clock face", "A circular clock face"], ["dartboard", "A circular dartboard"]]); const u = rng.pick(UNITS);
      const out = finish(rng, { stimulus: withOpen(rng, OPEN_GEO, spin(rng, `${who} has a radius of ${r} ${u}. One shaded sector covers ${txt} (${num}/${den}) of the whole circle.`)), question: spin(rng, `[[What is the area of the shaded sector, in ${sq(u)}, in terms of π?|Find the area of the shaded sector, in ${sq(u)}, in terms of π.]]`), correct: c, fmt: piOpt,
        wrongs: [W(r * r, "step_missing", "원 전체의 넓이를 답했다."), W((num * 2 * r) / den, "geometry_misapplied", "넓이 대신 호의 길이를 계산했다."), W(c * 4, "geometry_misapplied", "반지름 대신 지름을 제곱했다."), W((den - num) * r * r / den, "opposite", "색칠하지 않은 부분의 넓이를 답했다."), W(c * 2, "formula_misuse", "비율을 두 배로 적용했다.")],
        verificationJs: withParams({ r, num, den }, "return Math.round(P.num*P.r*P.r/P.den*1e6)/1e6;"), trace: [[`원 전체의 넓이는 π × ${r}² = ${r * r}π 이다.`, "Area of the circle."], [`색칠한 부분은 ${num}/${den} 이므로 ${c}π 이다.`, "Take the fraction."]], variant: level === "easy" ? "simple_fraction" : "general_fraction" });
      return sem(out, [{ v: r, words: ["radius"] }], { words: ["area"], forbid: forbidExcept("area") });
    },
  },
  {
    id: "ci.central_from_inscribed.direct", skill: SKILL, kind: "central_from_inscribed", frame: "direct", levels: ["easy", "medium"], structure: "원주각의 2 배(easy) / 중심각 = 원주각 + k 관계(medium)",
    generate(rng, level) {
      const x = rng.int(12, 85), k = rng.int(10, 60); const [P, Q] = rng.pick([["A", "B"], ["P", "Q"], ["R", "S"], ["M", "N"]]); const c = rng.pick(["C", "D", "T"]); if (x === k) throw new GenFail("x"); const cen = level === "easy" ? 2 * x : 2 * k;
      const stimulus = withOpen(rng, OPEN_GEO, spin(rng, level === "easy" ? `[[In a circle with center O, inscribed angle ${P}${c}${Q} measures ${x} degrees and intercepts arc ${P}${Q}.|Angle ${P}${c}${Q} is inscribed in a circle with center O; it measures ${x} degrees and cuts off arc ${P}${Q}.|A circle has center O, and its inscribed angle ${P}${c}${Q} of ${x} degrees intercepts arc ${P}${Q}.]]` : `[[In a circle with center O, inscribed angle ${P}${c}${Q} and central angle ${P}O${Q} intercept the same arc. The central angle measures ${k} degrees more than the inscribed angle.|A circle has center O. Inscribed angle ${P}${c}${Q} and central angle ${P}O${Q} cut off the same arc, and the central angle is ${k} degrees more than the inscribed one.|Angles ${P}${c}${Q} (inscribed) and ${P}O${Q} (central) share the same arc of a circle with center O; angle ${P}O${Q} measures ${k} degrees more than angle ${P}${c}${Q}.]]`));
      const out = finish(rng, { stimulus, question: spin(rng, `[[What is the measure of central angle ${P}O${Q}, in degrees?|Find the measure of angle ${P}O${Q}, in degrees.|How many degrees is central angle ${P}O${Q}?|Determine the central angle ${P}O${Q} in degrees.]]`), correct: cen,
        wrongs: level === "easy" ? [W(x / 2 + 0.5 === Math.floor(x / 2 + 0.5) ? x / 2 + 0.5 : x + 2, "other", "계산 실수."), W(x, "step_missing", "원주각을 그대로 답했다."), W(180 - 2 * x, "formula_misuse", "180° 에서 뺐다."), W(360 - 2 * x, "step_missing", "큰 호의 크기를 답했다."), W(x + 45, "other", "계산 실수.")] : [W(k, "step_missing", "원주각을 답했다."), W(4 * k, "formula_misuse", "중심각의 두 배를 답했다."), W(k + 20, "other", "계산 실수."), W(180 - 2 * k, "formula_misuse", "180° 에서 뺐다."), W(3 * k, "other", "계산 실수.")],
        verificationJs: withParams(level === "easy" ? { x, easy: 1 } : { k, easy: 0 }, "if(P.easy) return 2*P.x;\nfor(let i=1;i<=180;i++){ if(2*i===i+P.k) return 2*i; }\nthrow new Error('없음');"),
        trace: level === "easy" ? [["중심각은 같은 호의 원주각의 2 배이다.", "Central angle is twice the inscribed angle."], [`2 × ${x} = ${2 * x}° 이다.`, "Compute."]] : [["원주각을 x 라 하면 중심각은 2x 이다.", "Name the inscribed angle x."], [`2x = x + ${k} 이므로 x = ${k} 이다.`, "Solve."], [`중심각은 2 × ${k} = ${2 * k}° 이다.`, "Central angle."]], variant: level === "easy" ? "double" : "difference_given" });
      return sem(out, level === "easy" ? [{ v: x, words: ["measures", "degrees"] }] : [{ v: k, words: ["more"] }], { words: ["angle"], forbid: [] });
    },
  },
  {
    id: "ci.central_from_inscribed.arc", skill: SKILL, kind: "central_from_inscribed", frame: "arc", levels: ["easy", "medium"], structure: "원주각으로 호의 크기(easy) / 식으로 표현된 원주각의 중심각(medium)",
    generate(rng, level) {
      const x = rng.int(10, 80), a = rng.int(3, 25), t = rng.int(5, 40); const [P, Q] = rng.pick([["A", "B"], ["P", "Q"], ["R", "S"], ["M", "N"], ["E", "F"]]); const c = rng.pick(["C", "D", "T"]); const val = level === "easy" ? x : t + a; if (t === a || val === t) throw new GenFail("x"); const ans = 2 * val;
      const stimulus = withOpen(rng, OPEN_GEO, spin(rng, level === "easy" ? `[[Points ${P}, ${Q}, and ${c} lie on a circle. Inscribed angle ${P}${c}${Q} measures ${x} degrees.|Three points, ${P}, ${Q}, and ${c}, are on a circle, and the inscribed angle ${P}${c}${Q} is ${x} degrees.|On a circle, the inscribed angle formed at ${c} by points ${P} and ${Q} measures ${x} degrees.]]` : `[[In a circle with center O, inscribed angle ${P}${c}${Q} measures ${M(`x + ${a}`)} degrees, where x = ${t}.|The inscribed angle ${P}${c}${Q} of a circle with center O has a measure of ${M(`x + ${a}`)} degrees, and x = ${t}.|Let x = ${t}. In a circle with center O, inscribed angle ${P}${c}${Q} is ${M(`x + ${a}`)} degrees.]]`));
      const out = finish(rng, { stimulus, question: spin(rng, level === "easy" ? `[[What is the measure of arc ${P}${Q} that the angle intercepts, in degrees?|Find the measure of the intercepted arc ${P}${Q}, in degrees.|How many degrees is the arc ${P}${Q} cut off by the angle?|Determine the measure of intercepted arc ${P}${Q} in degrees.]]` : `[[What is the measure of central angle ${P}O${Q}, in degrees?|Find the measure of angle ${P}O${Q}, in degrees.|How many degrees is the central angle ${P}O${Q} on the same arc?|Determine the central angle ${P}O${Q} in degrees.]]`), correct: ans,
        wrongs: [W(val, "step_missing", level === "easy" ? "원주각을 호의 크기로 답했다." : "원주각을 그대로 답했다."), W(180 - ans, "formula_misuse", "180° 에서 뺐다."), W(val * 4, "formula_misuse", "두 배를 한 번 더 했다."), W(level === "easy" ? 360 - ans : 2 * t + a, level === "easy" ? "step_missing" : "formula_misuse", level === "easy" ? "큰 호의 크기를 답했다." : "x 에만 2 를 곱했다.")],
        verificationJs: withParams(level === "easy" ? { x, a: 0, t: 0, easy: 1 } : { x: 0, a, t, easy: 0 }, "const v=P.easy? P.x : P.t+P.a; return v*2;"),
        trace: level === "easy" ? [["원주각은 가리키는 호의 크기의 절반이다.", "Inscribed angle is half its arc."], [`호의 크기 = 2 × ${x} = ${ans}° 이다.`, "Arc measure."]] : [[`원주각 = ${t} + ${a} = ${t + a}° 이다.`, "Evaluate the expression."], [`중심각은 원주각의 2 배이므로 2 × ${t + a} = ${ans}° 이다.`, "Double it."]], variant: level === "easy" ? "arc_measure" : "expression" });
      return sem(out, level === "easy" ? [{ v: x, words: ["measures", "degrees"] }] : [{ v: a, words: ["x"] }, { v: t, words: ["where", "x"] }], { words: level === "easy" ? ["arc"] : ["angle"], forbid: [] });
    },
  },
  {
    id: "ci.inscribed_from_central.direct", skill: SKILL, kind: "inscribed_from_central", frame: "direct", levels: ["easy", "medium"], structure: "중심각의 절반(easy) / 작은 호 위의 점에서 본 원주각 180−c/2(medium)",
    generate(rng, level) {
      const c = rng.pick(level === "easy" ? [40, 50, 60, 70, 80, 90, 100, 110, 120, 130] : [50, 60, 70, 80, 90, 100, 110, 120]); const [P, Q] = rng.pick([["A", "B"], ["P", "Q"], ["R", "S"], ["M", "N"]]); const t = rng.pick(["C", "D", "T"]); const ans = level === "easy" ? c / 2 : 180 - c / 2;
      const stimulus = withOpen(rng, OPEN_GEO, spin(rng, level === "easy" ? `In a circle with center O, central angle ${P}O${Q} measures ${c} degrees. Point ${t} lies on the major arc ${P}${Q}.` : `In a circle with center O, central angle ${P}O${Q} measures ${c} degrees. Point ${t} lies on the minor arc ${P}${Q}.`));
      const out = finish(rng, { stimulus, question: spin(rng, `[[What is the measure of inscribed angle ${P}${t}${Q}, in degrees?|Find the measure of angle ${P}${t}${Q}, in degrees.|How many degrees is inscribed angle ${P}${t}${Q}?]]`), correct: ans,
        wrongs: level === "easy" ? [W(c, "step_missing", "중심각을 그대로 답했다."), W(2 * c, "formula_misuse", "중심각의 2 배를 답했다."), W(180 - c / 2, "geometry_misapplied", "맞은편 호의 원주각을 답했다."), W(c / 4, "formula_misuse", "두 번 반으로 나눴다."), W(360 - c, "step_missing", "큰 호의 크기를 답했다.")] : [W(c / 2, "geometry_misapplied", "큰 호 위의 점일 때의 원주각을 답했다."), W(360 - c, "step_missing", "큰 호의 크기를 답했다."), W(180 - c, "formula_misuse", "180° 에서 중심각을 뺐다."), W(c, "step_missing", "중심각을 답했다."), W(360 - c / 2, "formula_misuse", "360° 에서 뺐다.")],
        verificationJs: withParams({ c, minor: level === "easy" ? 0 : 1 }, "const arc=P.minor? 360-P.c : P.c; return arc/2;"),
        trace: level === "easy" ? [[`${t} 가 큰 호 위에 있으므로 ∠${P}${t}${Q} 는 작은 호 ${P}${Q}(=${c}°)를 가리킨다.`, "The angle intercepts the minor arc."], [`원주각은 호의 절반이므로 ${c / 2}° 이다.`, "Half of the arc."]] : [[`${t} 가 작은 호 위에 있으므로 ∠${P}${t}${Q} 는 큰 호(360° − ${c}° = ${360 - c}°)를 가리킨다.`, "The angle intercepts the major arc."], [`원주각은 호의 절반이므로 ${ans}° 이다.`, "Half of the arc."]], variant: level === "easy" ? "major_side" : "minor_side" });
      return sem(out, [{ v: c, words: ["measures", "degrees"] }], { words: ["angle"], forbid: [] });
    },
  },
  {
    id: "ci.inscribed_from_central.fraction", skill: SKILL, kind: "inscribed_from_central", frame: "fraction", levels: ["easy", "medium"], structure: "호가 원의 몇 분의 몇인지로 주어진 원주각(easy: 1/4·1/2·1/3, medium: 그 밖의 분수)",
    generate(rng, level) {
      const [num, den, txt] = rng.pick((level === "easy" ? [[1, 4, "one fourth"], [1, 2, "one half"], [1, 3, "one third"], [1, 6, "one sixth"]] : [[1, 5, "one fifth"], [1, 9, "one ninth"], [2, 5, "two fifths"], [1, 8, "one eighth"], [3, 10, "three tenths"], [1, 10, "one tenth"]]) as [number, number, string][]);
      const arc = (360 * num) / den, ans = arc / 2; if (!Number.isInteger(ans)) throw new GenFail("x"); const [P, Q] = rng.pick([["A", "B"], ["P", "Q"], ["R", "S"], ["M", "N"]]); const t = rng.pick(["C", "D", "T"]);
      const out = finish(rng, { stimulus: withOpen(rng, OPEN_GEO, spin(rng, `Points ${P}, ${Q}, and ${t} lie on a circle. The minor arc ${P}${Q} is ${txt} (${num}/${den}) of the whole circle, and point ${t} is on the major arc.`)), question: spin(rng, `[[What is the measure of inscribed angle ${P}${t}${Q}, in degrees?|Find the measure of angle ${P}${t}${Q}, in degrees.]]`), correct: ans,
        wrongs: [W(arc, "step_missing", "호의 크기를 그대로 답했다."), W(arc * 2, "formula_misuse", "호의 크기를 두 배로 계산했다."), W(arc / 4, "formula_misuse", "두 번 반으로 나눴다."), W(180 - ans, "geometry_misapplied", "맞은편 원주각을 답했다."), W(360 - arc, "step_missing", "큰 호의 크기를 답했다.")],
        verificationJs: withParams({ num, den }, "let arc=0; for(let i=0;i<P.num;i++) arc+=360/P.den;\nreturn arc/2;"), trace: [[`호의 크기는 360° × ${num}/${den} = ${arc}° 이다.`, "Arc measure."], [`원주각은 호의 절반이므로 ${ans}° 이다.`, "Half of the arc."]], variant: level === "easy" ? "simple_fraction" : "general_fraction" });
      return sem(out, [], { words: ["angle"], forbid: [] });
    },
  },
  {
    id: "ci.circle_equation_transform.read", skill: SKILL, kind: "circle_equation_transform", frame: "read", levels: ["easy", "medium"], structure: "표준형에서 반지름(easy) / 원둘레 계수(medium)",
    generate(rng, level) {
      const h = rng.int(-9, 9), k0 = rng.int(-9, 9), r = rng.int(2, 14); if (h === 0 || k0 === 0 || r === Math.abs(h) || r === Math.abs(k0)) throw new GenFail("x"); const R = r * r; const coef = level === "easy" ? r : 2 * r;
      const out = finish(rng, { stimulus: withOpen(rng, OPEN_GEO, (() => { const [a, b] = rng.pick([["In the xy-plane, a circle is given by the equation ", "."], ["A circle in the xy-plane has the equation ", "."], ["The graph of ", " is a circle in the xy-plane."], ["Consider the circle in the xy-plane described by ", "."], ["The equation ", " defines a circle in the xy-plane."]]); return `${a}${M(`(${shifted("x", -h)})^2 + (${shifted("y", -k0)})^2 = ${R}`)}${b}`; })()), question: spin(rng, level === "easy" ? "[[What is the radius of the circle?|Find the radius of the circle.|How long is the radius of the circle?|Determine the length of the radius of this circle.]]" : "[[What is the circumference of the circle, in terms of π?|Find the circumference of the circle, in terms of π.|How long is the circle's circumference? Give the answer in terms of π.|Determine the circumference of this circle in terms of π.]]"), correct: coef, fmt: level === "easy" ? undefined : piOpt,
        wrongs: level === "easy" ? [W(R, "formula_misuse", "r² 를 반지름으로 답했다."), W(2 * r, "formula_misuse", "지름을 반지름으로 답했다."), W(Math.abs(h) + Math.abs(k0), "geometry_misapplied", "중심의 좌표를 반지름으로 답했다."), W(R / 2, "formula_misuse", "r² 를 반으로 나눴다.")] : [W(r, "formula_misuse", "둘레를 πr 로 계산했다."), W(R, "formula_misuse", "r² 를 계수로 답했다."), W(4 * r, "geometry_misapplied", "둘레를 4πr 로 계산했다."), W(R * 2, "geometry_misapplied", "넓이 계수의 두 배를 답했다.")],
        verificationJs: withParams({ R, easy: level === "easy" ? 1 : 0 }, "let r=null; for(let x=1;x<=100;x++) if(x*x===P.R) r=x;\nif(r===null) throw new Error('제곱수 아님');\nreturn P.easy? r : 2*r;"),
        trace: [[`우변 ${R} 이 r² 이므로 r = ${r} 이다.`, "Read r squared from the right side."], ...(level === "easy" ? [] : [[`둘레 = 2π × ${r} = ${2 * r}π 이다.`, "Circumference."] as [string, string]])], variant: level === "easy" ? "radius" : "circumference" });
      return sem(out, [], { words: level === "easy" ? ["radius"] : ["circumference"], forbid: forbidExcept(...(level === "easy" ? ["radius", "length"] : ["circumference", "length"])) });
    },
  },
  {
    id: "ci.circle_equation_transform.center", skill: SKILL, kind: "circle_equation_transform", frame: "center", levels: ["easy", "medium"], structure: "표준형에서 중심 좌표의 합(easy) / 일반형에서 중심 좌표의 합(medium)",
    generate(rng, level) {
      const h = rng.int(-9, 9), k0 = rng.int(-9, 9), F = rng.int(-20, 5); if (h === 0 || k0 === 0 || h === k0 || h + k0 === 0) throw new GenFail("x"); const R = h * h + k0 * k0 - F; if (R <= 0 || R > 400) throw new GenFail("x"); const D = -2 * h, E = -2 * k0; const ans = h + k0;
      const eq = level === "easy" ? `(${shifted("x", -h)})^2 + (${shifted("y", -k0)})^2 = ${R}` : `x^2 + y^2${term2(D, "x")}${term2(E, "y")}${F === 0 ? "" : ` ${F > 0 ? "+" : "-"} ${Math.abs(F)}`} = 0`;
      const out = finish(rng, { stimulus: withOpen(rng, OPEN_GEO, (() => { const [a, b] = rng.pick([["In the xy-plane, a circle is given by the equation ", "."], ["A circle in the xy-plane has the equation ", "."], ["The graph of ", " is a circle in the xy-plane."], ["Consider the circle in the xy-plane described by ", "."], ["The equation ", " defines a circle in the xy-plane."]]); return `${a}${M(eq)}${b}`; })()), question: spin(rng, "[[What is the sum of the x-coordinate and the y-coordinate of the center of the circle?|Find the sum of the coordinates of the center of the circle.|If the center is the point (a, b), what is the value of a + b?|Add the x-coordinate and the y-coordinate of the circle's center. What is the result?]]"), correct: ans,
        wrongs: [W(-ans, "sign_error", "중심 좌표의 부호를 반대로 읽었다."), W(Math.abs(h) + Math.abs(k0), "sign_error", "부호를 무시하고 더했다."), W(level === "easy" ? h - k0 : (D + E) / 2, level === "easy" ? "formula_misuse" : "formula_misuse", level === "easy" ? "두 좌표를 더하지 않고 뺐다." : "x 와 y 의 계수 합의 절반(부호 반대)을 답했다."), W(level === "easy" ? R : F, "other", level === "easy" ? "r² 를 답했다." : "상수항을 답했다.")],
        verificationJs: withParams(level === "easy" ? { h: -h, k: -k0, easy: 1 } : { h: D, k: E, easy: 0 }, "if(P.easy) return -P.h + -P.k;\nreturn (-P.h/2) + (-P.k/2);"),
        trace: level === "easy" ? [["표준형 (x − h)² + (y − k)² = r² 에서 중심은 (h, k) 이다.", "Read the center from standard form."], [`중심은 (${h}, ${k0}) 이므로 합은 ${ans} 이다.`, "Add the coordinates."]] : [["x²+y²+Dx+Ey+F=0 의 중심은 (−D/2, −E/2) 이다.", "Center from general form."], [`(${-D / 2}, ${-E / 2}) 이므로 합은 ${ans} 이다.`, "Add the coordinates."]], variant: level === "easy" ? "standard_form" : "general_form" });
      return sem(out, [], { words: ["sum", "a + b", "add", "result"], forbid: [] });
    },
  },
];
