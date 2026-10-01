// lines_angles_triangles — hard 원형 16개(세부 패턴 4 × 연산자 4) + easy 2 + medium 4 원형. 그림 없이 서술만으로 성립하는 형태.
import { GenFail, type Archetype } from "../types";
import { facts, lin, spin, withParams, M, frac } from "../text";
import { gcd } from "../rng";
import { asLevel, withBind, type LArch } from "../levels-d";
import { W, NAMES3, TIMES, countMult, GEO_CTX, fin as finish } from "./d-kit";

const SKILL = "lines_angles_triangles";
const rad = "const rad=Math.PI/180;";
const round6 = "const r6=(x)=>Math.round(x*1e6)/1e6;";

export const LAT_HARD: Archetype[] = [
  // ───────── triangle_angle_sum ─────────
  {
    id: "lat.triangle_angle_sum.inverse", skill: SKILL, kind: "triangle_angle_sum", operator: "inverse",
    structure: "한 각과 '두 각 사이의 관계'(한 각 = p×다른 각 ∓ d)가 주어졌을 때 합 180°로 관계에 쓰인 미지 각을 역산",
    extraThinking: "문장 관계를 식으로 번역해 합 180°의 미지 각을 거꾸로 풀고, 묻는 각이 관계식의 기준 각과 다를 수 있음 — medium 은 두 각이 모두 주어진 단순 뺄셈",
    concepts: ["삼각형 내각의 합", "문장→일차방정식", "관계식 대입"], mediumSteps: 1,
    generate(rng) {
      const [A, B, C] = rng.pick(NAMES3); const p = rng.pick([2, 3]); const d = rng.int(-24, 24); if (d === 0) throw new GenFail("x");
      const c = rng.int(14, 52); const bb = p * c - d; const a = 180 - bb - c;
      if (a < 25 || a > 120 || bb < 15 || bb > 150) throw new GenFail("x");
      const ask = rng.int(0, 1); const T = `${A}${B}${C}`; const mult = TIMES[p]; const dd = Math.abs(d);
      const rel = d > 0 ? `${dd} degrees less than ${mult} the measure of angle ${C}` : `${dd} degrees more than ${mult} the measure of angle ${C}`;
      const stimulus = facts(rng, [
        [`In triangle ${T}, angle ${A} measures ${a} degrees.`, `Triangle ${T} has an angle ${A} of ${a} degrees.`, `The measure of angle ${A} in triangle ${T} is ${a} degrees.`, `A surveyor records that angle ${A} of triangle ${T} measures ${a} degrees.`],
        [`Angle ${B} is ${rel}.`, `The measure of angle ${B} is ${rel}.`, d > 0 ? `If ${mult} the measure of angle ${C} is decreased by ${dd} degrees, the result is the measure of angle ${B}.` : `If ${mult} the measure of angle ${C} is increased by ${dd} degrees, the result is the measure of angle ${B}.`],
      ]);
      const target = ask === 0 ? C : B;
      const correct = ask === 0 ? c : bb;
      return withBind(finish(rng, {
        stimulus, question: spin(rng, `[[What is the measure of angle ${target}, in degrees?|Find the measure of angle ${target}, in degrees.|How many degrees are in angle ${target}?]]`),
        correct, wrongs: [
          W(ask === 0 ? (180 - a) / (p + 1) : p * ((180 - a) / (p + 1)) - d, "step_missing", "관계식의 ±d 를 빠뜨리고 합 180°만으로 나눴다."),
          W(ask === 0 ? (180 - a - d) / (p + 1) : p * ((180 - a - d) / (p + 1)) - d, "sign_error", "'더 크다/작다'의 부호를 거꾸로 적용했다."),
          W(ask === 0 ? (180 - a + d) / p : p * ((180 - a + d) / p) - d, "formula_misuse", "합에서 기준 각 C 를 한 번 빼먹어 (p+1)이 아니라 p 로 나눴다."),
          W(ask === 0 ? bb : c, "other", "묻는 각이 아닌 다른 각을 답했다."),
          W(180 - a - correct, "other", "180에서 두 각만 빼서 남은 각을 답했다."),
          W(ask === 0 ? (180 - a + d) / (p + 2) : 0, "formula_misuse", "배수를 한 번 더 세어 (p+2)로 나눴다."),
        ],
        verificationJs: withParams({ a, p, d, ask }, "let out=null;\nfor(let C=1;C<179;C++){ const B=P.p*C-P.d; if(B>0 && P.a+B+C===180){ out=(P.ask===0)?C:B; } }\nif(out===null) throw new Error('해 없음');\nreturn out;"),
        trace: [
          [`삼각형 내각의 합은 180° 이므로 ${A} + ${B} + ${C} = 180 이다.`, "Use the angle sum of 180."],
          [`${C} 를 x 로 두면 ${B} = ${p}x ${d > 0 ? "-" : "+"} ${dd} 이다.`, "Express the second angle through the base angle."],
          [`식에 대입하면 ${a} + (${p}x ${d > 0 ? "-" : "+"} ${dd}) + x = 180 이다.`, "Substitute into the sum."],
          [`동류항을 정리하면 ${p + 1}x = ${180 - a + d} 이다.`, "Collect like terms."],
          [`x = ${c} 이므로 ${C} = ${c}°, ${B} = ${bb}° 이다.`, "Solve and evaluate the other angle."],
          [`묻는 각 ${target} 는 ${correct}° 이다.`, "Answer the requested angle."],
        ],
        variant: "relation_inverse",
      }), [{ noun: `angle ${A}`, value: a }, { noun: `angle ${B}`, value: dd }]);
    },
  },
  {
    id: "lat.triangle_angle_sum.chain2", skill: SKILL, kind: "triangle_angle_sum", operator: "chain2",
    structure: "두 각으로 셋째 각을 구하고, 그 각의 이등분선이 만든 작은 삼각형의 내각 합으로 이등분선과 대변이 이루는 각을 구함",
    extraThinking: "앞 단계의 셋째 각을 반으로 나눠 새 삼각형의 조건으로 쓰는 2단계 연쇄 — medium 은 한 번의 180° 뺄셈",
    concepts: ["삼각형 내각의 합", "각의 이등분", "작은 삼각형 재적용"], mediumSteps: 1,
    generate(rng) {
      const [A, B, C] = rng.pick(NAMES3); const a = rng.int(30, 100), b = rng.int(30, 100);
      if ((a + b) % 2 !== 0 || a + b > 150 || a === b) throw new GenFail("x");
      const Cc = 180 - a - b; const ask = rng.int(0, 1); const D = rng.pick(["D", "E", "F"].filter((n) => ![A, B, C].includes(n)));
      const cdb = 90 + (a - b) / 2; const cda = 90 + (b - a) / 2; const correct = ask === 0 ? cdb : cda; const other = ask === 0 ? cda : cdb;
      const stimulus = facts(rng, [
        [`In triangle ${A}${B}${C}, angle ${A} measures ${a} degrees and angle ${B} measures ${b} degrees.`, `Triangle ${A}${B}${C} has angle ${A} = ${a} degrees and angle ${B} = ${b} degrees.`, `Two angles of triangle ${A}${B}${C} are known: angle ${A} is ${a} degrees and angle ${B} is ${b} degrees.`],
        [`The bisector of angle ${C} meets side ${A}${B} at point ${D}.`, `Point ${D} lies on side ${A}${B}, and ${C}${D} bisects angle ${C}.`, `A ray that splits angle ${C} into two equal parts crosses side ${A}${B} at ${D}.`],
      ]);
      const tgt = ask === 0 ? `${C}${D}${B}` : `${C}${D}${A}`;
      return withBind(finish(rng, {
        stimulus, question: spin(rng, `[[What is the measure of angle ${tgt}, in degrees?|Find the measure of angle ${tgt}, in degrees.|How many degrees is angle ${tgt}?]]`),
        correct, wrongs: [W(a, "step_missing", "이등분(반으로 나누기)을 빼먹고 큰 삼각형의 각으로 계산했다."), W(Cc / 2, "partial", "이등분한 각 하나만 구하고 멈췄다."), W(other, "geometry_misapplied", "이등분선이 대변과 이루는 두 각(보각)을 서로 바꿔 답했다."), W(a + b, "formula_misuse", "작은 삼각형이 아니라 큰 삼각형의 외각으로 계산했다."), W(180 - Cc, "formula_misuse", "180에서 셋째 각만 뺐다.")],
        verificationJs: withParams({ a, b, ask }, `${rad}${round6}\nconst A=P.a*rad, B=P.b*rad;\nconst AC=Math.sin(B)/Math.sin(A+B), BC=Math.sin(A)/Math.sin(A+B);\nconst Cx=AC*Math.cos(A), Cy=AC*Math.sin(A);\nconst AD=AC/(AC+BC);\nconst ang=Math.atan2(Cy, Cx-AD)/rad;\nreturn r6(P.ask===0?ang:180-ang);`),
        trace: [
          [`셋째 각 ${C} = 180 - ${a} - ${b} = ${Cc}° 이다.`, "Find the third angle."],
          [`${C}${D} 는 각 ${C} 를 이등분하므로 각 ${A}${C}${D} = 각 ${D}${C}${B} = ${Cc / 2}° 이다.`, "Halve it with the bisector."],
          [`삼각형 ${C}${D}${B} 에서 각 ${B} = ${b}°, 각 ${D}${C}${B} = ${Cc / 2}° 이다.`, "Identify the small triangle's known angles."],
          [`각 ${C}${D}${B} = 180 - ${b} - ${Cc / 2} = ${cdb}° 이다.`, "Apply the angle sum again."],
          [`각 ${C}${D}${A} 는 각 ${C}${D}${B} 의 보각이므로 ${cda}° 이다.`, "Use the supplement for the other angle."],
          [`묻는 각 ${tgt} 는 ${correct}° 이다.`, "Answer."],
        ],
        variant: "bisector_chain",
      }), [{ noun: `angle ${A}`, value: a }, { noun: `angle ${B}`, value: b }]);
    },
  },
  {
    id: "lat.triangle_angle_sum.repr_shift", skill: SKILL, kind: "triangle_angle_sum", operator: "repr_shift",
    structure: "각의 관계를 비(a:b:c) 또는 '몇 배·몇 도 더'라는 문장으로 주고, 식으로 번역해 합 180°에서 묻는 각(최대·최소·차)을 구함",
    extraThinking: "문장·비를 하나의 변수식으로 번역하고 묻는 값이 변수가 아니라 최대·최소·차인지 재계산 — medium 은 두 각이 직접 주어짐",
    concepts: ["삼각형 내각의 합", "비·배수 문장→식", "최대·최소 판별"], mediumSteps: 1,
    generate(rng) {
      const mode = rng.pick(["ratio", "multiples"] as const); const T = rng.pick(["ABC", "PQR", "XYZ", "DEF", "KLM"]);
      if (mode === "ratio") {
        const r = [rng.int(1, 8), rng.int(1, 8), rng.int(1, 8)].sort((x, y) => x - y); const S = r[0] + r[1] + r[2];
        if (180 % S !== 0 || r[0] === r[1] || r[1] === r[2] || gcd(gcd(r[0], r[1]), r[2]) !== 1) throw new GenFail("x");
        const k = 180 / S; const ang = r.map((x) => x * k); const ask = rng.int(0, 2);
        const val = ask === 0 ? ang[2] - ang[0] : ask === 1 ? ang[2] : ang[0];
        const what = ask === 0 ? "the positive difference between the largest and smallest angles" : ask === 1 ? "the measure of the largest angle" : "the measure of the smallest angle";
        const stimulus = GEO_CTX[rng.int(0, GEO_CTX.length - 1)] + facts(rng, [[`The measures of the angles of triangle ${T} are in the ratio ${r[0]} : ${r[1]} : ${r[2]}.`, `The three interior angles of triangle ${T} are in the ratio ${r[0]} : ${r[1]} : ${r[2]}.`, `Triangle ${T} has interior angles whose measures are in the ratio ${r[0]} : ${r[1]} : ${r[2]}.`]]);
        return withBind(finish(rng, {
          stimulus, question: spin(rng, `[[What is ${what}, in degrees?|Find ${what}, in degrees.]]`),
          correct: val, wrongs: [W(k, "step_missing", "비의 한 묶음 k 만 구하고 멈췄다."), W(ask === 0 ? ang[1] : ask === 1 ? ang[1] : ang[1], "other", "가운데 각을 답했다."), W(ask === 0 ? r[2] - r[0] : ask === 1 ? r[2] : r[0], "step_missing", "비의 값 자체를 각도로 답했다(k 를 곱하지 않았다)."), W(ask === 0 ? ang[2] : ask === 1 ? ang[0] : ang[2], "other", "묻는 값이 아닌 최대·최소 각을 답했다."), W(ask === 0 ? ang[2] + ang[0] : (180 - ang[1]) , "formula_misuse", "차가 아니라 합으로 계산했다."), W((val * 90) / 180 || 1, "formula_misuse", "180 대신 90 으로 나눠 계산했다.")],
          verificationJs: withParams({ r1: r[0], r2: r[1], r3: r[2], ask }, "let out=null;\nfor(let k=1;k<=180;k++){ const a=P.r1*k,b=P.r2*k,c=P.r3*k; if(a+b+c===180){ const xs=[a,b,c]; out=P.ask===0?Math.max(...xs)-Math.min(...xs):P.ask===1?Math.max(...xs):Math.min(...xs); } }\nif(out===null) throw new Error('해 없음');\nreturn out;"),
          trace: [
            [`비 ${r[0]} : ${r[1]} : ${r[2]} 를 각각 ${r[0]}k, ${r[1]}k, ${r[2]}k 로 둔다.`, "Write the angles as multiples of k."],
            [`내각의 합 180° 이므로 ${r[0]}k + ${r[1]}k + ${r[2]}k = 180 이다.`, "Set the sum equal to 180."],
            [`${S}k = 180 이므로 k = ${k} 이다.`, "Solve for k."],
            [`세 각은 ${ang[0]}°, ${ang[1]}°, ${ang[2]}° 이다.`, "Evaluate all three angles."],
            [`묻는 값은 ${val} 이다.`, "Pick the requested quantity."],
          ],
          variant: "ratio_statement",
        }), [{ noun: "ratio", value: r[0] }]);
      }
      const m = rng.pick([2, 3]); const t = rng.int(-30, 30); if (t === 0) throw new GenFail("x");
      if ((180 - t) % (2 * m + 1) !== 0) throw new GenFail("x"); const x = (180 - t) / (2 * m + 1); const angs = [x, m * x, m * x + t];
      if (angs.some((v) => v < 10 || v > 150)) throw new GenFail("x");
      const ask = rng.int(0, 1); const val = ask === 0 ? Math.max(...angs) : Math.min(...angs); const tt = Math.abs(t);
      const stimulus = facts(rng, [
        [`In triangle ${T}, the second angle is ${TIMES[m]} the first angle.`, `The second angle of triangle ${T} measures ${TIMES[m]} the first angle.`, `Triangle ${T} has a second angle that is ${TIMES[m]} as large as its first angle.`],
        [`The third angle is ${tt} degrees ${t > 0 ? "more" : "less"} than the second angle.`, `The third angle measures ${tt} degrees ${t > 0 ? "more" : "less"} than the second angle.`, `The third angle exceeds the second by ${tt} degrees.`.replace("exceeds the second by", t > 0 ? "exceeds the second by" : "falls short of the second by")],
      ]);
      return withBind(finish(rng, {
        stimulus, question: spin(rng, `[[What is the measure of the ${ask === 0 ? "largest" : "smallest"} angle, in degrees?|Find the ${ask === 0 ? "largest" : "smallest"} angle of the triangle, in degrees.]]`),
        correct: val, wrongs: [W(x, "other", "첫째 각 x 만 구하고 답했다."), W(m * x, "other", "둘째 각을 답했다."), W(m * x + t, "other", "셋째 각을 답했다."), W(180 - 2 * x - m * x, "formula_misuse", "합 180° 식에서 관계를 잘못 세웠다."), W(x + t, "sign_error", "'더/덜'의 부호를 거꾸로 적용했다."), W(m * x - t, "sign_error", "'더/덜'의 부호를 거꾸로 적용했다.")],
        verificationJs: withParams({ m, t, ask }, "let out=null;\nfor(let x=1;x<=180;x++){ const a=x,b=P.m*x,c=P.m*x+P.t; if(a+b+c===180){ out=P.ask===0?Math.max(a,b,c):Math.min(a,b,c); } }\nif(out===null) throw new Error('해 없음');\nreturn out;"),
        trace: [
          [`첫째 각을 x 로 두면 둘째 각은 ${m}x 이다.`, "Let the first angle be x."],
          [`셋째 각은 ${m}x ${t > 0 ? "+" : "-"} ${tt} 이다.`, "Translate the third angle."],
          [`합이 180° 이므로 x + ${m}x + (${m}x ${t > 0 ? "+" : "-"} ${tt}) = 180 이다.`, "Set the sum equal to 180."],
          [`${2 * m + 1}x = ${180 - t} 이므로 x = ${x} 이다.`, "Solve for x."],
          [`세 각은 ${angs.join("°, ")}° 이다.`, "Evaluate all three angles."],
          [`묻는 값(${ask === 0 ? "최대" : "최소"})은 ${val} 이다.`, "Pick the requested angle."],
        ],
        variant: "multiples_statement",
      }), [{ noun: "second angle", value: m === 2 ? "twice" : "three times" }, { noun: "third angle", value: tt }]);
    },
  },
  {
    id: "lat.triangle_angle_sum.constraint_select", skill: SKILL, kind: "triangle_angle_sum", operator: "constraint_select",
    structure: "이등변삼각형의 같은 두 각 x 를 정수(배수) 제약·예각/둔각 조건·꼭지각/밑각 하한으로 걸러 가능한 값의 개수를 셈",
    extraThinking: "여러 부등식 조건(모든 각이 90° 미만 등)을 x 의 범위로 번역하고 경계 포함 여부와 배수 제약까지 추적 — medium 은 한 각을 직접 계산",
    concepts: ["삼각형 내각의 합", "예각·둔각 조건", "정수·배수 개수 세기"], mediumSteps: 1,
    generate(rng) {
      const mode = rng.int(0, 1); const m = rng.pick([1, 2, 3, 5]); const v = mode === 0 ? rng.int(20, 80) : rng.int(6, 34);
      const count = (lo: number, hi: number, flt: (x: number) => boolean) => { let c = 0; for (let x = lo; x <= hi; x++) if (flt(x) && x % m === 0) c++; return c; };
      const ok = (x: number) => (mode === 0 ? x < 90 && 180 - 2 * x < 90 && 180 - 2 * x >= v : 180 - 2 * x > 90 && x >= v && 2 * x < 180);
      const correct = count(1, 89, ok); if (correct < 3 || correct > 30) throw new GenFail("x");
      const T = rng.pick(["ABC", "PQR", "XYZ", "DEF"]);
      const mText = m === 1 ? "a whole number of degrees" : `a multiple of ${m} degrees`;
      const cond = mode === 0 ? `The triangle is acute (all three of its angles are less than 90 degrees), and its third angle is at least ${v} degrees.` : `The triangle is obtuse, and each of the two equal angles is at least ${v} degrees.`;
      const stimulus = GEO_CTX[rng.int(0, GEO_CTX.length - 1)] + facts(rng, [
        [`Triangle ${T} is isosceles. Each of its two equal angles measures x degrees, where x is ${mText}.`, `In isosceles triangle ${T}, the two equal angles each measure x degrees, and x is ${mText}.`, `Two angles of triangle ${T} are equal, each x degrees, with x being ${mText}.`, `Triangle ${T} has exactly two equal angles, each measuring x degrees; x is ${mText}.`, `Let x be the measure, in degrees, of each of the two equal angles of isosceles triangle ${T}, where x is ${mText}.`],
        [cond, cond.replace("The triangle is acute", "The triangle is acute").replace(/^The triangle/, "Triangle " + T)],
      ]);
      const near = [
        count(1, 89, (x) => (mode === 0 ? x < 90 && 180 - 2 * x <= 90 && 180 - 2 * x >= v : 180 - 2 * x >= 90 && x >= v)),
        count(1, 89, (x) => (mode === 0 ? x < 90 && 180 - 2 * x < 90 && 180 - 2 * x > v : 180 - 2 * x > 90 && x > v)),
        count(1, 89, ok) && (() => { let c = 0; for (let x = 1; x <= 89; x++) if (ok(x)) c++; return c; })(),
      ];
      return withBind(finish(rng, {
        stimulus, question: spin(rng, `[[How many possible values are there for x?|For how many values of x can such a triangle exist?|How many different values of x are possible?|Which count of allowed values of x is correct? Give the number of possibilities.|Find the number of values of x that satisfy every condition.|How many values of x make this description possible?]]`),
        correct, wrongs: [W(near[0], "condition_ignored", "'예각/둔각'의 경계(90°)를 포함해 센다."), W(near[1], "condition_ignored", "'적어도(이상)'를 '초과'로 읽어 경계값을 뺐다."), W(near[2], "condition_ignored", "배수 제약을 무시하고 정수 전체를 셌다."), W(correct + 1, "step_missing", "경계값을 하나 더 센다."), W(correct - 1, "step_missing", "경계값을 하나 뺐다.")],
        verificationJs: withParams({ mode, v, m }, "let c=0;\nfor(let x=1;x<=89;x++){ const t=180-2*x; if(x%P.m!==0) continue; const good=P.mode===0 ? (x<90 && t<90 && t>=P.v) : (t>90 && x>=P.v && t<180); if(good) c++; }\nreturn c;"),
        trace: [
          [`세 각은 x, x, 180 - 2x 이고 모두 양수여야 하므로 0 < x < 90 이다.`, "Write the three angles and require positivity."],
          [mode === 0 ? "예각이므로 180 - 2x < 90, 즉 x > 45 이다." : "둔각이므로 180 - 2x > 90, 즉 x < 45 이다.", "Translate the acute/obtuse condition."],
          [mode === 0 ? `셋째 각이 ${v} 이상이므로 180 - 2x ≥ ${v}, 즉 x ≤ ${(180 - v) / 2} 이다.` : `각 x 가 ${v} 이상이므로 x ≥ ${v} 이다.`, "Translate the extra bound."],
          [mode === 0 ? `따라서 45 < x ≤ ${Math.floor((180 - v) / 2)} 이다.` : `따라서 ${v} ≤ x < 45 이다.`, "Combine into one range."],
          [`${m === 1 ? "범위 안의 정수" : `범위 안의 ${m} 의 배수`}를 센다(경계 포함 여부 확인).`, "Count the allowed values."],
          [`가능한 x 는 ${correct} 개이다.`, "State the count."],
        ],
        variant: mode === 0 ? "acute_window" : "obtuse_window",
      }), [{ noun: mode === 0 ? "third angle" : "equal angles", value: v }]);
    },
  },
  // ───────── exterior_angle ─────────
  {
    id: "lat.exterior_angle.inverse", skill: SKILL, kind: "exterior_angle", operator: "inverse",
    structure: "외각과 두 원격 내각의 관계(비 또는 차)로부터 외각 정리(외각 = 원격 내각의 합)를 역으로 써서 각 원격 내각과 가장 큰 내각을 구함",
    extraThinking: "외각 정리를 역방향(외각 → 원격 내각 분해)으로 쓰고 셋째 내각(180 - 외각)까지 비교해 가장 큰 각을 고름 — medium 은 두 원격 내각의 합",
    concepts: ["외각 정리", "비·차 조건 분해", "내각의 합 비교"], mediumSteps: 0,
    generate(rng) {
      const [A, B, C] = rng.pick(NAMES3); const mode = rng.pick(["ratio", "diff"] as const); const ask = rng.int(0, 2);
      let e = 0, a = 0, b = 0, p = 0, q = 0, d = 0;
      if (mode === "ratio") { p = rng.int(1, 4); q = rng.int(p + 1, 6); if (gcd(p, q) !== 1) throw new GenFail("x"); const k = rng.int(10, 30); e = k * (p + q); a = k * q; b = k * p; }
      else { d = rng.int(2, 14) * 2; b = rng.int(25, 70); a = b + d; e = a + b; }
      if (e < 100 || e > 170) throw new GenFail("x");
      const third = 180 - e; const larger = Math.max(a, b); const smaller = Math.min(a, b);
      const correct = ask === 0 ? larger : ask === 1 ? smaller : Math.max(a, b, third);
      const what = ask === 0 ? `the larger of the two remote interior angles` : ask === 1 ? `the smaller of the two remote interior angles` : `the largest interior angle of the triangle`;
      const stimulus = facts(rng, [
        [`An exterior angle at vertex ${C} of triangle ${A}${B}${C} measures ${e} degrees.`, `Extending side ${A}${C} past ${C} forms an exterior angle of ${e} degrees at vertex ${C} of triangle ${A}${B}${C}.`, `The exterior angle at ${C} of triangle ${A}${B}${C} is ${e} degrees.`],
        [mode === "ratio" ? `The measures of angle ${A} and angle ${B} are in the ratio ${q} : ${p}.` : `Angle ${A} measures ${d} degrees more than angle ${B}.`, mode === "ratio" ? `Angle ${A} and angle ${B} have measures in the ratio ${q} to ${p}.` : `The measure of angle ${A} exceeds the measure of angle ${B} by ${d} degrees.`],
      ]);
      return withBind(finish(rng, {
        stimulus, question: spin(rng, `[[What is the measure of ${what}, in degrees?|Find ${what}, in degrees.]]`),
        correct, wrongs: [W(ask === 0 ? smaller : larger, "other", "두 원격 내각 중 묻지 않은 쪽을 답했다."), W(third, "geometry_misapplied", "외각이 아니라 이웃한 내각(180 - 외각)을 답했다."), W(e, "step_missing", "외각 자체를 답했다."), W(Math.round(e / 2), "formula_misuse", "두 원격 내각이 같다고 보고 외각을 반으로 나눴다."), W(180 - larger, "formula_misuse", "원격 내각의 보각을 구했다."), W(ask === 2 ? Math.max(a, b) : Math.max(a, b, third) === third ? a : third, "condition_ignored", "셋째 내각과 비교하지 않고 원격 내각 중에서만 골랐다.")],
        verificationJs: withParams({ e, mode: mode === "ratio" ? 0 : 1, p, q, d, ask }, "let sol=null;\nfor(let a=1;a<P.e;a++){ const b=P.e-a; const ok=P.mode===0 ? a*P.p===b*P.q || a*P.q===b*P.p : a-b===P.d; if(ok && a>=b){ sol=[a,b]; } }\nif(!sol) throw new Error('해 없음');\nconst c=180-P.e; return P.ask===0?sol[0]:P.ask===1?sol[1]:Math.max(sol[0],sol[1],c);"),
        trace: [
          [`외각 정리: 꼭짓점 ${C} 의 외각 = 각 ${A} + 각 ${B} 이므로 ${A} + ${B} = ${e} 이다.`, "Apply the exterior angle theorem."],
          [mode === "ratio" ? `${A}:${B} = ${q}:${p} 이므로 ${A} = ${q}k, ${B} = ${p}k 로 둔다.` : `${A} = ${B} + ${d} 로 둔다.`, "Translate the relation."],
          [mode === "ratio" ? `${q}k + ${p}k = ${e} 이므로 k = ${e / (p + q)} 이다.` : `2${B} + ${d} = ${e} 이므로 ${B} = ${b} 이다.`, "Solve for the unknown."],
          [`두 원격 내각은 ${a}° 와 ${b}° 이다.`, "Evaluate both remote angles."],
          [`셋째 내각은 180 - ${e} = ${third}° 이다.`, "Find the interior angle at the exterior vertex."],
          [`묻는 값은 ${correct}° 이다.`, "Answer."],
        ],
        variant: mode === "ratio" ? "ratio_remote" : "difference_remote",
      }), [{ noun: "exterior angle", value: e }]);
    },
  },
  {
    id: "lat.exterior_angle.chain2", skill: SKILL, kind: "exterior_angle", operator: "chain2",
    structure: "두 꼭짓점의 외각이 주어지면 각각 내각(180 - 외각)을 구하고 셋째 내각 또는 셋째 외각을 구함",
    extraThinking: "외각 → 내각 변환을 두 번 연쇄하고 마지막에 내각/외각 중 묻는 쪽으로 다시 변환(외각의 합 360° 활용 가능) — medium 은 두 원격 내각의 합",
    concepts: ["외각과 내각의 보각 관계", "내각의 합", "외각의 합 360°"], mediumSteps: 0,
    generate(rng) {
      const [A, B, C] = rng.pick(NAMES3); const eA = rng.int(100, 165), eB = rng.int(100, 165); const ask = rng.int(0, 1);
      const iC = eA + eB - 180; if (iC < 12 || iC > 100) throw new GenFail("x");
      const eC = 360 - eA - eB; const correct = ask === 0 ? iC : eC;
      const stimulus = facts(rng, [
        [`In triangle ${A}${B}${C}, the exterior angle at ${A} measures ${eA} degrees and the exterior angle at ${B} measures ${eB} degrees.`, `Triangle ${A}${B}${C} has an exterior angle at ${A} of ${eA} degrees and an exterior angle at ${B} of ${eB} degrees.`, `One exterior angle at ${A} is ${eA} degrees, and one exterior angle at ${B} is ${eB} degrees, in triangle ${A}${B}${C}.`],
        [`Each exterior angle is formed by extending one side of the triangle.`, `Every exterior angle is formed by extending a side of the triangle.`, `The exterior angles are formed by extending the sides.`],
      ]);
      return withBind(finish(rng, {
        stimulus, question: spin(rng, ask === 0 ? `[[What is the measure of the interior angle at ${C}, in degrees?|Find the measure of angle ${C} of the triangle, in degrees.]]` : `[[What is the measure of the exterior angle at ${C}, in degrees?|Find the measure of an exterior angle at vertex ${C}, in degrees.]]`),
        correct, wrongs: [W(eA + eB, "formula_misuse", "두 외각을 그대로 더했다(내각으로 바꾸지 않았다)."), W(ask === 0 ? eC : iC, "geometry_misapplied", "내각과 외각(보각)을 바꿔 답했다."), W(eA + eB - 360 + 180 > 0 ? eA + eB - 180 + 20 : 1, "other", "계산 중 20° 어긋났다."), W(360 - eA, "formula_misuse", "한 외각만 360에서 뺐다."), W(180 - eA - eB + 180 - 0 > 0 ? 180 - (eA + eB - 180) - (ask === 0 ? 0 : 0) : 1, "formula_misuse", "180에서 두 내각을 빼는 단계를 잘못 적용했다."), W(Math.abs(eA - eB), "formula_misuse", "두 외각의 차를 구했다.")],
        verificationJs: withParams({ eA, eB, ask }, "const iA=180-P.eA, iB=180-P.eB; const iC=180-iA-iB; const eC=180-iC;\nreturn P.ask===0?iC:eC;"),
        trace: [
          [`꼭짓점 ${A} 의 내각 = 180 - ${eA} = ${180 - eA}° 이다.`, "Convert the first exterior angle to an interior angle."],
          [`꼭짓점 ${B} 의 내각 = 180 - ${eB} = ${180 - eB}° 이다.`, "Convert the second exterior angle."],
          [`내각의 합 180° 로 꼭짓점 ${C} 의 내각 = 180 - ${180 - eA} - ${180 - eB} = ${iC}° 이다.`, "Use the angle sum for the third interior angle."],
          [`꼭짓점 ${C} 의 외각 = 180 - ${iC} = ${eC}° 이다(세 외각의 합 360° 로도 확인).`, "Convert back to the exterior angle and cross-check with 360."],
          [`묻는 값은 ${correct}° 이다.`, "Answer."],
        ],
        variant: "two_exterior_chain",
      }), [{ noun: `exterior angle at ${A}`, value: eA }, { noun: `exterior angle at ${B}`, value: eB }]);
    },
  },
  {
    id: "lat.exterior_angle.constraint_select", skill: SKILL, kind: "exterior_angle", operator: "constraint_select",
    structure: "외각(=원격 내각의 합)이 주어지고 두 원격 내각이 정수이며 예각삼각형·대소 관계·배수 조건을 만족하는 경우의 수를 셈",
    extraThinking: "외각 정리와 '모든 내각 < 90°' 조건을 한 변수 범위로 줄이고 경계 포함·배수 제약을 추적 — medium 은 외각 하나의 값 계산",
    concepts: ["외각 정리", "예각삼각형 조건", "정수 개수 세기"], mediumSteps: 0,
    generate(rng) {
      const [A, B, C] = rng.pick(NAMES3); const e = rng.int(100, 156); const m = rng.pick([1, 2, 3, 5]);
      const cnt = (f: (a: number, b: number) => boolean) => { let c = 0; for (let a = 1; a < e; a++) { const b = e - a; if (a % m === 0 && f(a, b)) c++; } return c; };
      const ok = (a: number, b: number) => a > b && a < 90 && b < 90 && 180 - e < 90;
      const correct = cnt(ok); if (correct < 3 || correct > 30) throw new GenFail("x");
      const mT = m === 1 ? "a whole number of degrees" : `a multiple of ${m} degrees`;
      const stimulus = facts(rng, [
        [`The exterior angle at vertex ${C} of triangle ${A}${B}${C} measures ${e} degrees.`, `Triangle ${A}${B}${C} has an exterior angle of ${e} degrees at vertex ${C}.`],
        [`The measures of angle ${A} and angle ${B} are whole numbers of degrees, and the triangle is acute (every angle is less than 90 degrees).`, `Angle ${A} and angle ${B} have whole-number measures, and every angle of the triangle is less than 90 degrees.`],
        [`Angle ${A} is larger than angle ${B}, and angle ${A} is ${mT}.`, `The measure of angle ${A} is ${mT} and is greater than the measure of angle ${B}.`],
      ]);
      return withBind(finish(rng, {
        stimulus, question: spin(rng, `[[How many possible values are there for the measure of angle ${A}?|For how many different measures of angle ${A} can such a triangle exist?]]`),
        correct, wrongs: [W(cnt((a, b) => a > b), "condition_ignored", "예각 조건(각 < 90°)을 무시하고 센다."), W(cnt((a, b) => a >= b && a < 90 && b < 90), "condition_ignored", "'더 크다'에 같은 경우를 포함해 센다."), W(cnt((a, b) => a > b && a <= 90 && b < 90), "condition_ignored", "예각의 경계 90°를 포함해 센다."), W(correct + 1, "step_missing", "경계값을 하나 더 센다."), W(correct - 1, "step_missing", "경계값을 하나 뺐다.")],
        verificationJs: withParams({ e, m }, "let c=0;\nfor(let a=1;a<P.e;a++){ const b=P.e-a, t=180-P.e; if(a%P.m!==0) continue; if(a>b && a<90 && b<90 && t<90 && t>0) c++; }\nreturn c;"),
        trace: [
          [`외각 정리: 각 ${A} + 각 ${B} = ${e} 이고 각 ${C} = 180 - ${e} = ${180 - e}° 이다.`, "Use the exterior angle theorem."],
          [`각 ${C} = ${180 - e}° 는 90° 미만이므로 예각 조건에 영향이 없다.`, "Check the third angle."],
          [`예각이므로 ${A} < 90 이고 ${B} = ${e} - ${A} < 90, 즉 ${A} > ${e - 90} 이다.`, "Turn both acute conditions into bounds on one angle."],
          [`${A} > ${B} 이므로 ${A} > ${e / 2} 이다.`, "Use the size condition."],
          [`${Math.max(e / 2, e - 90)} < ${A} < 90 에서 ${m === 1 ? "정수" : `${m} 의 배수`}를 센다.`, "Count the admissible values."],
          [`가능한 값은 ${correct} 개이다.`, "State the count."],
        ],
        variant: "acute_window",
      }), [{ noun: ["exterior angle"], value: e }]);
    },
  },
  {
    id: "lat.exterior_angle.compose_kind", skill: SKILL, kind: "exterior_angle", operator: "compose_kind",
    structure: "원격 내각 둘과 외각이 모두 x 의 일차식일 때 외각 정리로 일차방정식을 세워 x 를 구하고 묻는 각을 계산",
    extraThinking: "외각 정리를 일차방정식 풀이와 합성하고, x 를 구한 뒤 묻는 각(내각/원격 각)을 다시 평가 — medium 은 숫자 각의 합",
    concepts: ["외각 정리", "일차방정식", "대입 평가"], mediumSteps: 0,
    generate(rng) {
      const [P1, Q1, R1] = rng.pick(NAMES3); const x = rng.int(4, 24); const p1 = rng.int(1, 3), q1 = rng.nz(-12, 20), r1 = rng.int(1, 3), s1 = rng.nz(-12, 20);
      const A = p1 * x + q1, B = r1 * x + s1; const ext = A + B; const k = rng.int(1, 6); if (k === p1 + r1) throw new GenFail("x"); const t = ext - k * x;
      if (A < 10 || B < 10 || ext >= 175 || ext <= 95) throw new GenFail("x"); const ask = rng.int(0, 1);
      const interior = 180 - ext; const correct = ask === 0 ? interior : B; if (interior < 5) throw new GenFail("x");
      const eq = (a: number, b: number) => M(`(${lin(a, b)})`);
      const stimulus = facts(rng, [
        [`In triangle ${P1}${Q1}${R1}, angle ${P1} measures ${eq(p1, q1)} degrees and angle ${Q1} measures ${eq(r1, s1)} degrees.`, `Triangle ${P1}${Q1}${R1} has angle ${P1} = ${eq(p1, q1)} degrees and angle ${Q1} = ${eq(r1, s1)} degrees.`],
        [`The exterior angle at ${R1} measures ${eq(k, t)} degrees.`, `An exterior angle at vertex ${R1} is ${eq(k, t)} degrees.`, `The measure of the exterior angle at ${R1} is ${eq(k, t)} degrees.`],
      ]);
      return withBind(finish(rng, {
        stimulus, question: spin(rng, ask === 0 ? `[[What is the measure of the interior angle at ${R1}, in degrees?|Find the measure of angle ${R1}, in degrees.]]` : `[[What is the measure of angle ${Q1}, in degrees?|Find the value of angle ${Q1}, in degrees.]]`),
        correct, wrongs: [W(x, "step_missing", "x 의 값만 구하고 각도로 평가하지 않았다."), W(ask === 0 ? ext : A, "geometry_misapplied", "묻는 각이 아닌 다른 각(외각 또는 P)을 답했다."), W(ask === 0 ? B : interior, "other", "묻는 각이 아닌 다른 각을 답했다."), W(ask === 0 ? 180 - A : 180 - B, "formula_misuse", "한 각의 보각을 구했다."), W(ask === 0 ? A + B - 180 + 2 * x : B + x, "formula_misuse", "x 를 더 더해 계산했다.")],
        verificationJs: withParams({ p1, q1, r1, s1, k, t, ask }, "let out=null;\nfor(let x=-200;x<=400;x++){ const A=P.p1*x+P.q1, B=P.r1*x+P.s1, E=P.k*x+P.t; if(A+B===E && A>0 && B>0 && E<180){ out=(P.ask===0)?180-E:B; } }\nif(out===null) throw new Error('해 없음');\nreturn out;"),
        trace: [
          [`외각 정리: 외각 = 두 원격 내각의 합이므로 (${lin(p1, q1)}) + (${lin(r1, s1)}) = ${lin(k, t)} 이다.`, "Apply the exterior angle theorem."],
          [`좌변을 정리하면 ${lin(p1 + r1, q1 + s1)} = ${lin(k, t)} 이다.`, "Simplify the left side."],
          [`x 항을 한쪽으로 모으면 ${p1 + r1 - k}x = ${t - q1 - s1} 이다.`, "Collect x terms."],
          [`x = ${x} 이다.`, "Solve for x."],
          [`각 ${P1} = ${A}°, 각 ${Q1} = ${B}°, 외각 = ${ext}° 이다.`, "Evaluate each angle."],
          [`묻는 각은 ${correct}° 이다.`, "Answer."],
        ],
        variant: "algebra_exterior",
      }), [{ noun: `angle ${P1}`, value: lin(p1, q1) }, { noun: `angle ${Q1}`, value: lin(r1, s1) }]);
    },
  },
  // ───────── isosceles_base_angle ─────────
  {
    id: "lat.isosceles_base_angle.inverse", skill: SKILL, kind: "isosceles_base_angle", operator: "inverse",
    structure: "꼭지각과 밑각의 관계(밑각보다 d 크다/작다 또는 m 배)가 주어졌을 때 합 180° 와 밑각 동일성으로 밑각·꼭지각을 역산",
    extraThinking: "'밑각 둘은 같다'를 식에 두 번 반영하고 꼭지각을 밑각의 식으로 번역해 미지 각을 거꾸로 구함 — medium 은 꼭지각만 주고 밑각을 계산",
    concepts: ["이등변삼각형 밑각", "문장→방정식", "내각의 합"], mediumSteps: 1,
    generate(rng) {
      const mode = rng.int(0, 2); const T = rng.pick(["ABC", "PQR", "XYZ", "DEF", "KLM"]); const ask = rng.int(0, 1);
      let b = 0, dm = 0;
      if (mode === 0) { dm = rng.int(1, 16) * 3; b = (180 - dm) / 3; }
      else if (mode === 1) { dm = rng.int(1, 29) * 3; b = (180 + dm) / 3; }
      else { dm = rng.pick([2, 3, 4]); b = 180 / (dm + 2); }
      if (!Number.isInteger(b) || b >= 90 || b < 20 || 180 - 2 * b <= 0) throw new GenFail("x");
      const v = 180 - 2 * b; const correct = ask === 0 ? b : v;
      const rel = mode === 0 ? `The vertex angle is ${dm} degrees larger than each base angle.` : mode === 1 ? `The vertex angle is ${dm} degrees smaller than each base angle.` : `The vertex angle is ${TIMES[dm]} as large as each base angle.`;
      const alt = mode === 0 ? `Each base angle is ${dm} degrees smaller than the vertex angle.` : mode === 1 ? `Each base angle is ${dm} degrees larger than the vertex angle.` : `Each base angle is $\\frac{1}{${dm}}$ as large as the vertex angle.`;
      const stimulus = facts(rng, [[`Triangle ${T} is isosceles with two equal base angles.`, `In isosceles triangle ${T}, the two base angles are equal.`, `Triangle ${T} has two equal base angles and a vertex angle.`], [rel, alt]]);
      return withBind(finish(rng, {
        stimulus, question: spin(rng, `[[What is the measure of ${ask === 0 ? "each base angle" : "the vertex angle"}, in degrees?|Find the measure of ${ask === 0 ? "a base angle" : "the vertex angle"}, in degrees.]]`),
        correct, wrongs: [W(ask === 0 ? v : b, "other", "묻는 각이 아닌 다른 각(꼭지각/밑각)을 답했다."), W(ask === 0 ? (180 - dm) / 2 : 180 - (180 - dm), "formula_misuse", "밑각이 두 개임을 반영하지 않았다."), W(ask === 0 ? (180 + (mode === 1 ? -dm : dm)) / 3 : 2 * b, "sign_error", "'더 크다/작다'의 부호를 거꾸로 적용했다."), W(ask === 0 ? 180 / 3 : 90 - b, "formula_misuse", "세 각이 같다고 가정했다."), W(correct + dm, "step_missing", "관계식의 상수를 한 번 더 더했다."), W(Math.abs(correct - dm), "step_missing", "관계식의 상수를 한 번 더 뺐다.")],
        verificationJs: withParams({ mode, dm, ask }, "let out=null;\nfor(let b=1;b<90;b++){ const v=180-2*b; const ok=P.mode===0 ? v===b+P.dm : P.mode===1 ? v===b-P.dm : v===P.dm*b; if(ok) out=(P.ask===0)?b:v; }\nif(out===null) throw new Error('해 없음');\nreturn out;"),
        trace: [
          ["이등변삼각형이므로 두 밑각이 같다. 밑각을 x 로 둔다.", "Name the base angle x (both equal)."],
          [mode === 0 ? `꼭지각 = x + ${dm} 이다.` : mode === 1 ? `꼭지각 = x - ${dm} 이다.` : `꼭지각 = ${dm}x 이다.`, "Express the vertex angle in x."],
          [`내각의 합: x + x + 꼭지각 = 180 이다.`, "Write the angle sum."],
          [mode === 0 ? `3x + ${dm} = 180 이므로 x = ${b} 이다.` : mode === 1 ? `3x - ${dm} = 180 이므로 x = ${b} 이다.` : `${dm + 2}x = 180 이므로 x = ${b} 이다.`, "Solve for x."],
          [`꼭지각 = 180 - 2·${b} = ${v}° 이다.`, "Compute the other angle."],
          [`묻는 각은 ${correct}° 이다.`, "Answer."],
        ],
        variant: mode === 2 ? "vertex_times_base" : "vertex_offset_base",
      }), [{ noun: "base angle", value: dm }]);
    },
  },
  {
    id: "lat.isosceles_base_angle.chain2", skill: SKILL, kind: "isosceles_base_angle", operator: "chain2",
    structure: "AB = AC 인 삼각형에서 BD = BC 가 되도록 AC 위에 점 D 를 잡을 때, 밑각 → 작은 이등변삼각형의 밑각 → 각 ABD(또는 ADB)를 연쇄로 구함",
    extraThinking: "밑각을 구한 뒤 그 값을 새 이등변삼각형(BD = BC)의 조건으로 다시 쓰고 각의 뺄셈·보각까지 두 단계 이상 연결 — medium 은 꼭지각으로 밑각만 계산",
    concepts: ["이등변삼각형 밑각", "삼각형 내각의 합", "각의 뺄셈·보각"], mediumSteps: 1,
    generate(rng) {
      const a = rng.int(10, 28) * 2; if (a >= 60) throw new GenFail("x"); const [A, B, C] = rng.pick(NAMES3); const D = rng.pick(["D", "E", "F"].filter((n) => ![A, B, C].includes(n)));
      const beta = (180 - a) / 2; const ask = rng.int(0, 1); const correct = ask === 0 ? beta - a : 180 - beta;
      const stimulus = facts(rng, [
        [`In triangle ${A}${B}${C}, ${A}${B} = ${A}${C} and angle ${B}${A}${C} measures ${a} degrees.`, `Triangle ${A}${B}${C} is isosceles with ${A}${B} = ${A}${C}, and its vertex angle ${B}${A}${C} is ${a} degrees.`],
        [`Point ${D} lies on side ${A}${C} so that ${B}${D} = ${B}${C}.`, `A point ${D} is chosen on side ${A}${C} with ${B}${D} equal in length to ${B}${C}.`, `Point ${D} is on ${A}${C} (between ${A} and ${C}), and the segments ${B}${D} and ${B}${C} have the same length.`],
      ]);
      const tgt = ask === 0 ? `${A}${B}${D}` : `${A}${D}${B}`;
      return withBind(finish(rng, {
        stimulus, question: spin(rng, `[[What is the measure of angle ${tgt}, in degrees?|Find the measure of angle ${tgt}, in degrees.]]`),
        correct, wrongs: [W(beta, "step_missing", "큰 삼각형의 밑각에서 멈췄다."), W(ask === 0 ? 180 - beta : beta - a, "geometry_misapplied", "각 ABD 와 각 ADB 를 서로 바꿔 답했다."), W(a, "other", "꼭지각을 그대로 답했다."), W(ask === 0 ? beta - 2 * a : 180 - beta - a, "formula_misuse", "작은 삼각형의 꼭지각을 두 번 뺐다."), W(180 - 2 * beta + 0 || 1, "formula_misuse", "작은 삼각형의 꼭지각을 답했다."), W(ask === 0 ? beta / 2 : 90 + beta / 2, "formula_misuse", "밑각을 반으로 나눠 이등분선처럼 계산했다.")],
        verificationJs: withParams({ a, ask }, `${rad}${round6}\nconst a=P.a*rad; const Ax=0,Ay=0,Bx=1,By=0,Cx=Math.cos(a),Cy=Math.sin(a);\nconst t=2*Math.cos(a)-1; const Dx=t*Math.cos(a), Dy=t*Math.sin(a);\nconst ang=(px,py,qx,qy,rx,ry)=>{ const ux=px-qx,uy=py-qy,vx=rx-qx,vy=ry-qy; return Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy)/(Math.hypot(ux,uy)*Math.hypot(vx,vy)))))/rad; };\nreturn r6(P.ask===0?ang(Ax,Ay,Bx,By,Dx,Dy):ang(Ax,Ay,Dx,Dy,Bx,By));`),
        trace: [
          [`${A}${B} = ${A}${C} 이므로 밑각 ${B} = ${C} = (180 - ${a})/2 = ${beta}° 이다.`, "Find the base angle of the big isosceles triangle."],
          [`삼각형 ${B}${D}${C} 는 ${B}${D} = ${B}${C} 인 이등변삼각형이므로 각 ${B}${D}${C} = 각 ${B}${C}${D} = ${beta}° 이다.`, "Recognize the second isosceles triangle."],
          [`그 꼭지각 ${C}${B}${D} = 180 - 2·${beta} = ${180 - 2 * beta}° 이다.`, "Find its apex angle."],
          [`각 ${A}${B}${D} = 각 ${A}${B}${C} - 각 ${C}${B}${D} = ${beta} - ${180 - 2 * beta} = ${beta - a}° 이다.`, "Subtract to get the requested angle."],
          [`각 ${A}${D}${B} 는 각 ${B}${D}${C} 의 보각이므로 180 - ${beta} = ${180 - beta}° 이다.`, "Use the supplement for the other angle."],
          [`묻는 각 ${tgt} 는 ${correct}° 이다.`, "Answer."],
        ],
        variant: "nested_isosceles",
      }), [{ noun: `angle ${B}${A}${C}`, value: a }]);
    },
  },
  {
    id: "lat.isosceles_base_angle.repr_shift", skill: SKILL, kind: "isosceles_base_angle", operator: "repr_shift",
    structure: "꼭지각이 밑각의 분수 배(m/n)라는 문장을 식으로 번역(분수 일차방정식)해 밑각·꼭지각을 구함",
    extraThinking: "분수 배 관계를 분수 계수의 방정식으로 세우고 통분해 푸는 번역 — medium 은 꼭지각 숫자에서 밑각을 바로 계산",
    concepts: ["이등변삼각형 밑각", "분수 계수 방정식", "내각의 합"], mediumSteps: 1,
    generate(rng) {
      const pairs: [number, number][] = [[1, 2], [1, 4], [2, 5], [5, 2], [7, 4], [4, 3], [8, 5]];
      const [m, n] = rng.pick(pairs); const b = (180 * n) / (2 * n + m); if (!Number.isInteger(b) || (m * b) % n !== 0) throw new GenFail("x");
      const v = (m * b) / n; if (v + 2 * b !== 180) throw new GenFail("x"); const T = rng.pick(["ABC", "PQR", "XYZ", "DEF"]); const ask = rng.int(0, 1);
      const fr = `$\\frac{${m}}{${n}}$`; const correct = ask === 0 ? v : b;
      const stimulus = GEO_CTX[rng.int(0, GEO_CTX.length - 1)] + facts(rng, [
        [`In isosceles triangle ${T}, the two base angles are equal.`, `Triangle ${T} is isosceles, so its two base angles have the same measure.`],
        [`The vertex angle is ${fr} as large as each base angle.`, `The measure of the vertex angle equals ${fr} of the measure of one base angle.`, `Each base angle is larger than the vertex angle: the vertex angle is ${fr} of a base angle.`],
      ]);
      return withBind(finish(rng, {
        stimulus, question: spin(rng, `[[What is the measure of ${ask === 0 ? "the vertex angle" : "each base angle"}, in degrees?|Find ${ask === 0 ? "the vertex angle" : "a base angle"}, in degrees.]]`),
        correct, wrongs: [W(ask === 0 ? b : v, "other", "묻는 각이 아닌 다른 각을 답했다."), W(ask === 0 ? (180 * m) / (2 + m) : 180 / (2 + m / n), "formula_misuse", "분수를 정수 배처럼 처리했다."), W(ask === 0 ? 180 - b : (180 - v), "step_missing", "밑각이 둘임을 반영하지 않고 나머지를 답했다."), W(ask === 0 ? (v * n) / m : 90 - v / 2 + 0, "formula_misuse", "관계를 거꾸로(밑각이 꼭지각의 분수 배로) 적용했다."), W(correct + 10, "other", "계산 중 10° 어긋났다."), W(Math.abs(correct - 10), "other", "계산 중 10° 어긋났다.")],
        verificationJs: withParams({ m, n, ask }, "let out=null;\nfor(let b=1;b<90;b++){ const v=180-2*b; if(v*P.n===P.m*b){ out=(P.ask===0)?v:b; } }\nif(out===null) throw new Error('해 없음');\nreturn out;"),
        trace: [
          ["밑각을 x 로 두면 꼭지각은 분수 배이므로 (m/n)x 이다.", "Let the base angle be x and write the vertex angle as a fraction of x."],
          [`내각의 합: x + x + (${m}/${n})x = 180 이다.`, "Write the sum of angles."],
          [`양변에 ${n} 을 곱하면 ${2 * n}x + ${m}x = ${180 * n} 이다.`, "Clear the denominator."],
          [`${2 * n + m}x = ${180 * n} 이므로 x = ${b} 이다.`, "Solve for x."],
          [`꼭지각 = (${m}/${n})·${b} = ${v}° 이다.`, "Evaluate the vertex angle."],
          [`묻는 각은 ${correct}° 이다.`, "Answer."],
        ],
        variant: "fraction_relation",
      }), [{ noun: "vertex angle", value: `\\frac{${m}}{${n}}` }]);
    },
  },
  {
    id: "lat.isosceles_base_angle.compose_kind", skill: SKILL, kind: "isosceles_base_angle", operator: "compose_kind",
    structure: "AB = AC 인 삼각형의 변 BC 에 평행한 선분 DE 를 두고, 밑각과 평행선의 동위각·동측내각으로 지정한 각을 구함",
    extraThinking: "이등변삼각형 밑각을 평행선의 동위각·동측내각 성질과 합성(서로 다른 두 개념의 연결) — medium 은 밑각만 계산",
    concepts: ["이등변삼각형 밑각", "평행선의 동위각", "보각·동측내각"], mediumSteps: 1,
    generate(rng) {
      const a = rng.int(10, 70) * 2; const [A, B, C] = rng.pick(NAMES3); const [D, E] = rng.pick([["D", "E"], ["M", "N"], ["P", "Q"], ["S", "T"]].filter(([x, y]) => ![A, B, C].includes(x) && ![A, B, C].includes(y)));
      const beta = (180 - a) / 2; const ask = rng.int(0, 1); const correct = ask === 0 ? beta : 180 - beta; if (a >= 150) throw new GenFail("x");
      const stimulus = facts(rng, [
        [`In triangle ${A}${B}${C}, ${A}${B} = ${A}${C} and angle ${B}${A}${C} measures ${a} degrees.`, `Triangle ${A}${B}${C} has ${A}${B} = ${A}${C}, and its vertex angle ${B}${A}${C} is ${a} degrees.`],
        [`Point ${D} lies on ${A}${B} and point ${E} lies on ${A}${C} such that ${D}${E} is parallel to ${B}${C}.`, `A segment ${D}${E} is drawn with ${D} on side ${A}${B} and ${E} on side ${A}${C}, parallel to side ${B}${C}.`, `Segment ${D}${E} connects a point ${D} on ${A}${B} to a point ${E} on ${A}${C}, and ${D}${E} ∥ ${B}${C}.`.replace("∥", "is parallel to")],
      ]);
      const tgt = ask === 0 ? `${A}${D}${E}` : `${D}${E}${C}`;
      return withBind(finish(rng, {
        stimulus, question: spin(rng, `[[What is the measure of angle ${tgt}, in degrees?|Find the measure of angle ${tgt}, in degrees.]]`),
        correct, wrongs: [W(a, "other", "꼭지각을 그대로 답했다."), W(ask === 0 ? 180 - beta : beta, "geometry_misapplied", "동위각과 동측내각(보각)을 바꿔 답했다."), W(180 - a, "formula_misuse", "180 에서 꼭지각만 뺐다(밑각을 둘로 나누지 않았다)."), W(ask === 0 ? beta / 2 : 90 + beta / 2, "formula_misuse", "밑각을 반으로 나눴다."), W(ask === 0 ? 90 - a / 2 + a : 90 + a / 2 - 0, "other", "평행 성질을 빠뜨리고 계산했다.")],
        verificationJs: withParams({ a, ask }, `${rad}${round6}\nconst a=P.a*rad; const s=0.37; const Bx=1,By=0,Cx=Math.cos(a),Cy=Math.sin(a);\nconst Dx=s*Bx,Dy=s*By,Ex=s*Cx,Ey=s*Cy;\nconst ang=(px,py,qx,qy,rx,ry)=>{ const ux=px-qx,uy=py-qy,vx=rx-qx,vy=ry-qy; return Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy)/(Math.hypot(ux,uy)*Math.hypot(vx,vy)))))/rad; };\nreturn r6(P.ask===0?ang(0,0,Dx,Dy,Ex,Ey):ang(Dx,Dy,Ex,Ey,Cx,Cy));`),
        trace: [
          [`${A}${B} = ${A}${C} 이므로 밑각 ${B} = ${C} = (180 - ${a})/2 = ${beta}° 이다.`, "Compute the base angle."],
          [`${D}${E} ∥ ${B}${C} 이므로 각 ${A}${D}${E} 는 각 ${A}${B}${C} 와 동위각으로 같다.`, "Use corresponding angles for the parallel segment."],
          [`따라서 각 ${A}${D}${E} = ${beta}° 이다.`, "Transfer the base angle."],
          [`각 ${A}${E}${D} = ${beta}° 이고 각 ${D}${E}${C} 는 그 보각이므로 180 - ${beta} = ${180 - beta}° 이다.`, "Use the supplement along line AC."],
          [`묻는 각 ${tgt} 는 ${correct}° 이다.`, "Answer."],
        ],
        variant: "parallel_segment",
      }), [{ noun: `angle ${B}${A}${C}`, value: a }]);
    },
  },
  // ───────── similar_triangles ─────────
  {
    id: "lat.similar_triangles.unit_ratio", skill: SKILL, kind: "similar_triangles", operator: "unit_ratio",
    structure: "닮은 두 삼각형의 넓이가 주어지면 넓이비의 제곱근으로 닮음비(길이비)를 구해 대응변의 길이를 구함",
    extraThinking: "넓이비는 길이비의 제곱이라는 차원 변환과 그 역산(제곱근) — medium 은 길이비로 대응변을 구함",
    concepts: ["닮음비", "넓이비와 길이비의 관계", "제곱근"], mediumSteps: 3,
    generate(rng) {
      const p = rng.int(1, 6), q = rng.int(1, 6); if (p === q || gcd(p, q) !== 1) throw new GenFail("x"); const c = rng.int(1, 6); const a1 = q * q * c, a2 = p * p * c;
      const mm = rng.int(1, 6); const s = q * mm; const correct = p * mm; const [A, B, C] = rng.pick(NAMES3); const [D, E, F] = ["D", "E", "F"].map((x, i) => (x === A || x === B || x === C ? ["U", "V", "W"][i] : x));
      const stimulus = facts(rng, [
        [`Triangle ${A}${B}${C} is similar to triangle ${D}${E}${F}, with side ${A}${B} corresponding to side ${D}${E} and side ${B}${C} corresponding to side ${E}${F}.`, `Triangles ${A}${B}${C} and ${D}${E}${F} are similar, and ${B}${C} corresponds to ${E}${F}.`, `Triangle ${D}${E}${F} is similar to triangle ${A}${B}${C} (in that vertex order), so side ${E}${F} matches side ${B}${C}.`],
        [`The area of triangle ${A}${B}${C} is ${a1} square centimeters, and the area of triangle ${D}${E}${F} is ${a2} square centimeters.`, `Triangle ${A}${B}${C} has area ${a1} square centimeters, while triangle ${D}${E}${F} has area ${a2} square centimeters.`],
        [`Side ${B}${C} is ${s} centimeters long.`, `The length of side ${B}${C} is ${s} centimeters.`],
      ]);
      return withBind(finish(rng, {
        stimulus, question: spin(rng, `[[What is the length of side ${E}${F}, in centimeters?|Find the length of ${E}${F}, in centimeters.|How long is side ${E}${F}, in centimeters?]]`),
        correct, wrongs: [W((s * a2) / a1, "formula_misuse", "넓이비를 그대로 길이비로 썼다."), W((s * q) / p, "formula_misuse", "닮음비를 거꾸로(작은 쪽/큰 쪽) 적용했다."), W(s + (a2 - a1), "formula_misuse", "넓이의 차를 길이에 더했다."), W(s * (a2 - a1), "formula_misuse", "넓이의 차를 길이에 곱했다."), W(s, "condition_ignored", "닮음비를 적용하지 않고 대응변 길이를 그대로 답했다."), W(s * Math.sqrt(a2 / a1) + 1 || 1, "other", "계산을 하나 어긋나게 했다.")],
        verificationJs: withParams({ a1, a2, s }, "let out=null;\nfor(let L=1;L<1000;L++){ if(L*L*P.a1===P.s*P.s*P.a2) out=L; }\nif(out===null) throw new Error('해 없음');\nreturn out;"),
        trace: [
          [`닮은 도형의 넓이비 = 닮음비의 제곱이므로 ${a2}/${a1} = (${E}${F}/${B}${C})² 이다.`, "Relate the area ratio to the squared scale factor."],
          [`넓이비 ${a2}/${a1} = ${frac(a2, a1)} 를 기약분수로 한다.`, "Reduce the area ratio."],
          [`제곱근을 취해 닮음비 ${E}${F}/${B}${C} = ${frac(p, q)} 를 얻는다.`, "Take the square root for the length ratio."],
          [`${E}${F} = ${s} × ${frac(p, q)} 이다.`, "Apply the length ratio."],
          [`${E}${F} = ${correct} cm 이다.`, "Compute the length."],
        ],
        variant: "area_to_length",
      }), [{ noun: `side ${B}${C}`, value: s }, { noun: `triangle ${A}${B}${C}`, value: a1 }]);
    },
  },
  {
    id: "lat.similar_triangles.compose_kind", skill: SKILL, kind: "similar_triangles", operator: "compose_kind",
    structure: "한 삼각형의 세 변과 닮은 삼각형의 최단변이 주어질 때 대응변(최단변↔최단변)으로 닮음비를 구하고 둘레비로 둘레를 계산",
    extraThinking: "대응변 매칭(최단변↔최단변), 닮음비와 둘레비의 동일성을 결합 — medium 은 주어진 대응변 쌍으로 한 변의 길이만 계산",
    concepts: ["닮음비", "대응변 판별", "둘레의 비"], mediumSteps: 3,
    generate(rng) {
      const g = rng.pick([2, 3, 4]); const t = [rng.int(2, 8), rng.int(2, 9), rng.int(3, 10)].sort((x, y) => x - y); if (t[0] === t[1] || t[1] === t[2] || t[0] + t[1] <= t[2]) throw new GenFail("x");
      const [s1, s2, s3] = t.map((x) => x * g); const q = rng.pick([1, 2, g > 2 ? g : 1]); const pn = rng.int(1, 7); if (gcd(pn, q) !== 1 || pn === q) throw new GenFail("x");
      const d = (s1 * pn) / q; if (!Number.isInteger(d) || d < 2) throw new GenFail("x"); const Pn = ((s1 + s2 + s3) * pn) / q; if (!Number.isInteger(Pn) || Pn > 400 || !Number.isInteger((s2 * pn) / q) || !Number.isInteger((s3 * pn) / q)) throw new GenFail("x");
      const [A, B, C] = rng.pick(NAMES3); const [D, E, F] = ["D", "E", "F"].map((x, i) => (x === A || x === B || x === C ? ["U", "V", "W"][i] : x));
      const stimulus = GEO_CTX[rng.int(0, GEO_CTX.length - 1)] + facts(rng, [
        [`Triangle ${A}${B}${C} has side lengths ${s1}, ${s2}, and ${s3}.`, `The side lengths of triangle ${A}${B}${C} are ${s1}, ${s2}, and ${s3}.`, `A triangle ${A}${B}${C} has sides measuring ${s1}, ${s2}, and ${s3}.`],
        [`Triangle ${D}${E}${F} is similar to triangle ${A}${B}${C}, and its shortest side has length ${d}.`, `Triangle ${D}${E}${F} is similar to triangle ${A}${B}${C}; the shortest side of ${D}${E}${F} is ${d} long.`, `A similar triangle ${D}${E}${F} has a shortest side of length ${d}.`],
      ]);
      return withBind(finish(rng, {
        stimulus, question: spin(rng, `[[What is the perimeter of triangle ${D}${E}${F}?|Find the perimeter of triangle ${D}${E}${F}.|What is the sum of the three side lengths of triangle ${D}${E}${F}?]]`),
        correct: Pn, wrongs: [W(d + s2 + s3, "step_missing", "최단변만 바꾸고 나머지 두 변은 원래 길이로 더했다."), W(s1 + s2 + s3 + (d - s1), "formula_misuse", "배율이 아니라 증가분만 더했다."), W(((s1 + s2 + s3) * q) / pn, "formula_misuse", "닮음비를 거꾸로 적용했다."), W(s1 + s2 + s3, "condition_ignored", "닮음비를 적용하지 않고 원래 둘레를 답했다.")],
        verificationJs: withParams({ s1, s2, s3, d }, "let out=null;\nfor(let y=1;y<=600;y++) for(let z=y;z<=600;z++){ if(P.d*P.s2===y*P.s1 && P.d*P.s3===z*P.s1) out=P.d+y+z; }\nif(out===null) throw new Error('해 없음');\nreturn out;"),
        trace: [
          [`닮은 삼각형에서 가장 짧은 변끼리 대응한다. ${A}${B}${C} 의 최단변은 ${s1} 이다.`, "Match the shortest sides."],
          [`닮음비 = ${d} / ${s1} = ${frac(d, s1)} 이다.`, "Compute the scale factor."],
          [`${A}${B}${C} 의 둘레는 ${s1} + ${s2} + ${s3} = ${s1 + s2 + s3} 이다.`, "Find the perimeter of the original triangle."],
          [`닮은 도형의 둘레비는 닮음비와 같으므로 둘레 = ${s1 + s2 + s3} × ${frac(d, s1)} 이다.`, "Perimeters scale by the same factor."],
          [`둘레 = ${Pn} 이다.`, "Compute."],
        ],
        variant: "perimeter_scale",
      }), [{ noun: `triangle ${A}${B}${C}`, value: s1 }, { noun: "shortest side", value: d }]);
    },
  },
  {
    id: "lat.similar_triangles.inverse", skill: SKILL, kind: "similar_triangles", operator: "inverse",
    structure: "닮은 삼각형에서 대응변 비 AB:DE 와 BC:EF 가 같다는 조건에 BC, EF 가 x 의 일차식으로 주어질 때 비례식(교차곱)을 세워 x 를 역산",
    extraThinking: "대응 관계로 비례식을 세우고 교차곱 방정식을 풀어 변수를 역산한 뒤 묻는 변의 길이를 재계산 — medium 은 비 하나로 한 변 계산",
    concepts: ["닮음비", "비례식", "일차방정식"], mediumSteps: 3,
    generate(rng) {
      const p = rng.int(1, 5), q = rng.int(1, 5); if (p === q || gcd(p, q) !== 1) throw new GenFail("x"); const u = rng.int(1, 4); const a = q * u, b = p * u;
      const x = rng.int(3, 18), c = rng.int(1, 9); const BC = x + c; if (BC % q !== 0) throw new GenFail("x"); const EF = (BC / q) * p; const m = rng.int(1, 4); const d = m * x - EF; if (d === 0 || a * m === b) throw new GenFail("x");
      const [A, B, C] = rng.pick(NAMES3); const [D, E, F] = ["D", "E", "F"].map((xx, i) => (xx === A || xx === B || xx === C ? ["U", "V", "W"][i] : xx)); const ask = rng.int(0, 1); const correct = ask === 0 ? x : EF;
      const e1 = M(`(${lin(1, c)})`); const e2 = M(`(${lin(m, -d)})`);
      const stimulus = facts(rng, [
        [`Triangle ${A}${B}${C} is similar to triangle ${D}${E}${F}, with ${A}${B} corresponding to ${D}${E} and ${B}${C} corresponding to ${E}${F}.`, `Triangles ${A}${B}${C} and ${D}${E}${F} are similar, where side ${A}${B} matches side ${D}${E} and side ${B}${C} matches side ${E}${F}.`],
        [`Side ${A}${B} has length ${a} and side ${D}${E} has length ${b}.`, `${A}${B} = ${a} and ${D}${E} = ${b}.`, `The lengths of ${A}${B} and ${D}${E} are ${a} and ${b}, respectively.`],
        [`Side ${B}${C} has length ${e1} and side ${E}${F} has length ${e2}.`, `${B}${C} = ${e1} and ${E}${F} = ${e2}.`, `The lengths of ${B}${C} and ${E}${F} are ${e1} and ${e2}, respectively.`],
      ]);
      return withBind(finish(rng, {
        stimulus, question: spin(rng, ask === 0 ? `[[What is the value of $x$?|Find the value of $x$.]]` : `[[What is the length of side ${E}${F}?|Find the length of ${E}${F}.]]`),
        correct, wrongs: [W(ask === 0 ? EF : x, "other", "묻는 값이 아닌 x 또는 EF 를 답했다."), W(ask === 0 ? (a * -d + b * c) / (a * m + b || 1) : 0, "sign_error", "교차곱에서 부호를 잘못 옮겼다."), W(ask === 0 ? (b * c + a * d) / (a * m + b || 1) : 0, "sign_error", "x 항을 이항할 때 부호를 틀렸다."), W(ask === 0 ? BC : BC + 0, "other", "대응변 BC 의 길이를 답했다."), W(ask === 0 ? x + 1 : EF + 1, "other", "계산 중 1 어긋났다."), W(ask === 0 ? (a * c + b * d) / (Math.abs(b - a * m) || 1) : (b * BC) / a - 1, "formula_misuse", "비례식의 대응을 AB:BC = DE:EF 로 잘못 세웠다.")],
        verificationJs: withParams({ a, b, c, m, d, ask }, "let sol=[];\nfor(let x=-60;x<=300;x++){ if(P.a*(P.m*x-P.d)===P.b*(x+P.c)) sol.push(x); }\nif(sol.length!==1) throw new Error('해가 유일하지 않음');\nconst x=sol[0]; return P.ask===0?x:P.m*x-P.d;"),
        trace: [
          [`닮음이므로 대응변의 비가 같다: ${A}${B}/${D}${E} = ${B}${C}/${E}${F} 이다.`, "Set equal corresponding side ratios."],
          [`대입하면 ${a}/${b} = (${lin(1, c)})/(${lin(m, -d)}) 이다.`, "Substitute the side expressions."],
          [`교차곱: ${a}(${lin(m, -d)}) = ${b}(${lin(1, c)}) 이다.`, "Cross-multiply."],
          [`전개하면 ${lin(a * m, -a * d)} = ${lin(b, b * c)} 이다.`, "Expand both sides."],
          [`x 를 모으면 ${a * m - b}x = ${b * c + a * d} 이므로 x = ${x} 이다.`, "Solve for x."],
          [`${E}${F} = ${m}·${x} - ${d} = ${EF} 이다.`, "Evaluate EF if asked."],
        ],
        variant: "cross_multiply_expr",
      }), [{ noun: `${A}${B}`, value: a }, { noun: `${D}${E}`, value: b }]);
    },
  },
  {
    id: "lat.similar_triangles.constraint_select", skill: SKILL, kind: "similar_triangles", operator: "constraint_select",
    structure: "세 변이 주어진 삼각형과 닮고 변이 모두 양의 정수이며 둘레가 구간에 드는 삼각형의 개수를 기약 변비로 셈",
    extraThinking: "세 변을 최대공약수로 약분한 기약 변비를 찾아 정수 변을 가진 닮은 삼각형이 그 배수뿐임을 추론하고 둘레 구간의 배수 개수를 셈 — medium 은 닮음비로 변 하나를 계산",
    concepts: ["닮음비와 기약 변비", "정수 변 제약", "배수 개수 세기"], mediumSteps: 3,
    generate(rng) {
      const g = rng.int(2, 4); const prim = [[3, 4, 5], [5, 12, 13], [6, 8, 9].map((x) => x), [4, 5, 6], [5, 6, 7], [7, 8, 9], [4, 6, 7], [5, 7, 8], [3, 5, 7]].filter((t) => gcd(gcd(t[0], t[1]), t[2]) === 1 && t[0] + t[1] > t[2]);
      const tp = rng.pick(prim); const Sp = tp[0] + tp[1] + tp[2]; const [s1, s2, s3] = tp.map((x) => x * g); const mode = rng.int(0, 1);
      const lo = mode === 0 ? Sp * g : Sp * rng.int(1, g + 1) + rng.int(0, Sp - 1); const hi = lo + Sp * rng.int(2, 8) + rng.int(0, Sp - 1); if (hi > 130) throw new GenFail("x");
      const correct = Math.floor(hi / Sp) - Math.floor(lo / Sp); if (correct < 2 || correct > 14) throw new GenFail("x");
      const [A, B, C] = rng.pick(NAMES3); const D = rng.pick(["D", "E", "F"].filter((n) => ![A, B, C].includes(n)));
      const range = mode === 0 ? `a perimeter greater than that of triangle ${A}${B}${C} (which is ${lo}) and at most ${hi}` : `a perimeter greater than ${lo} and at most ${hi}`;
      const stimulus = GEO_CTX[rng.int(0, GEO_CTX.length - 1)] + facts(rng, [
        [`Triangle ${A}${B}${C} has side lengths ${s1}, ${s2}, and ${s3}.`, `The three sides of triangle ${A}${B}${C} measure ${s1}, ${s2}, and ${s3}.`],
        [`Consider triangles that are similar to triangle ${A}${B}${C}, have side lengths that are all positive integers, and have ${range}.`, `A triangle similar to ${A}${B}${C} has three positive integer side lengths and ${range}.`],
        [`Two such triangles are considered different only if their side lengths differ.`, `Triangles with the same three side lengths count once.`],
      ]);
      void D;
      const withAbc = Math.floor(hi / (Sp * g));
      return withBind(finish(rng, {
        stimulus, question: spin(rng, `[[How many such triangles are there?|How many different triangles satisfy these conditions?|Find the number of triangles that satisfy all of the conditions.]]`),
        correct, wrongs: [W(Math.floor(hi / (s1 + s2 + s3)), "condition_ignored", "닮은 삼각형이 ABC 의 배수뿐이라고 보고 기약 변비로 약분하지 않았다."), W(correct + 1, "step_missing", "경계(둘레 = 하한)를 포함해 센다."), W(correct - 1, "step_missing", "경계(둘레 = 상한)를 빼고 센다."), W(Math.floor(hi / Sp), "condition_ignored", "둘레 하한 조건을 빼고 센다."), W(withAbc + 0 === correct ? correct + 2 : withAbc, "formula_misuse", "기약 변비 대신 주어진 변으로 배수를 셌다.")],
        verificationJs: withParams({ s1, s2, s3, lo, hi }, "let c=0;\nfor(let x=1;x<=P.hi;x++) for(let y=x;y<=P.hi;y++) for(let z=y;z<=P.hi;z++){ const per=x+y+z; if(per>P.hi) break; if(per<=P.lo) continue; if(x*P.s2===y*P.s1 && x*P.s3===z*P.s1) c++; }\nreturn c;"),
        trace: [
          [`세 변 ${s1}, ${s2}, ${s3} 의 최대공약수는 ${g} 이므로 기약 변비는 ${tp.join(" : ")} 이다.`, "Reduce the side ratio by the gcd."],
          [`정수 변을 가진 닮은 삼각형의 변은 ${tp.join(", ")} 의 자연수 배 t 이다.`, "Integer-sided similar triangles are integer multiples of the primitive triple."],
          [`둘레는 ${Sp}t 이다.`, "Express the perimeter."],
          [`${lo} < ${Sp}t ≤ ${hi} 에서 t 의 범위를 구한다.`, "Convert the perimeter window into a range for t."],
          [`${Math.floor(lo / Sp) + 1} ≤ t ≤ ${Math.floor(hi / Sp)} 인 정수 t 를 센다.`, "Count admissible t."],
          [`삼각형은 ${correct} 개이다.`, "State the count."],
        ],
        variant: mode === 0 ? "larger_than_given" : "perimeter_window",
      }), [{ noun: `triangle ${A}${B}${C}`, value: s1 }]);
    },
  },
];

// ───────── easy / medium 원형(그룹 부족 해소) ─────────
const scenesTri = [
  (a: number, b: number) => `A triangular garden bed has two corner angles of ${a} degrees and ${b} degrees.`,
  (a: number, b: number) => `A roof truss is shaped like a triangle with angles of ${a} degrees and ${b} degrees at its base.`,
  (a: number, b: number) => `In a triangular sail, two of the angles measure ${a} degrees and ${b} degrees.`,
  (a: number, b: number) => `A triangular road sign has two known angles, ${a} degrees and ${b} degrees.`,
  (a: number, b: number) => `A kite maker cuts a triangular piece of fabric with angles of ${a} degrees and ${b} degrees.`,
  (a: number, b: number) => `Triangle PQR is drawn on a worksheet with angle P equal to ${a} degrees and angle Q equal to ${b} degrees.`,
  (a: number, b: number) => `Two angles of a triangular tile measure ${a} degrees and ${b} degrees.`,
  (a: number, b: number) => `Two angles of a triangular pennant measure ${a} degrees and ${b} degrees.`,
  (a: number, b: number) => `A triangular pizza slice is cut so that two of its angles are ${a} degrees and ${b} degrees.`,
  (a: number, b: number) => `A hiking trail forms a triangle; at two of the corners the angles are ${a} degrees and ${b} degrees.`,
  (a: number, b: number) => `A triangular window pane has angles of ${a} degrees and ${b} degrees at two of its corners.`,
  (a: number, b: number) => `Engineers measure two angles of a triangular bracket: ${a} degrees and ${b} degrees.`,
  (a: number, b: number) => `A triangular flag has angles of ${a} degrees and ${b} degrees at its base.`,
  (a: number, b: number) => `In triangle ABC, angle A measures ${a} degrees and angle B measures ${b} degrees.`,
  (a: number, b: number) => `A triangular sandbox has two corners whose angles are ${a} degrees and ${b} degrees.`,
  (a: number, b: number) => `A triangular park is bounded by three paths; two of its corner angles measure ${a} degrees and ${b} degrees.`,
];
export const LAT_LEVELS: LArch[] = [
  {
    id: "lat.triangle_angle_sum.easy_third_angle", skill: SKILL, kind: "triangle_angle_sum", operator: "repr_shift", level: "easy",
    structure: "삼각형의 두 각이 주어지면 180°에서 빼서 셋째 각을 구함", extraThinking: "easy: 내각의 합 180° 한 번 적용", concepts: ["삼각형 내각의 합", "뺄셈"], mediumSteps: 1,
    generate(rng) {
      const a = rng.int(25, 95), b = rng.int(20, 140 - a); const c = 180 - a - b; if (c < 10 || c > 130) throw new GenFail("x");
      const scene = rng.pick(scenesTri)(a, b); const q = rng.pick([`What is the measure of the third angle, in degrees?`, `Find the measure of the remaining angle, in degrees.`, `How many degrees is the third angle?`, `What is the measure of the angle that is not given, in degrees?`]);
      return withBind(finish(rng, {
        stimulus: scene, question: q, correct: c,
        wrongs: [W(a + b, "formula_misuse", "180에서 빼지 않고 두 각의 합을 답했다."), W(180 - a, "step_missing", "한 각만 빼고 멈췄다."), W(180 - b, "step_missing", "한 각만 빼고 멈췄다."), W(90 - a - b + 180 - 90 === c ? c + 10 : 90 - a - b, "condition_ignored", "180° 대신 90°에서 뺐다."), W(360 - a - b, "formula_misuse", "180° 대신 360°에서 뺐다.")],
        verificationJs: withParams({ a, b }, "return 180-P.a-P.b;"),
        trace: [["삼각형 내각의 합은 180° 이다.", "Angles of a triangle sum to 180."], [`알려진 두 각의 합은 ${a} + ${b} = ${a + b}° 이다.`, "Add the known angles."], [`셋째 각 = 180 - ${a + b} = ${c}° 이다.`, "Subtract."]],
        variant: "third_angle",
      }), [{ noun: "angle", value: a }, { noun: "angle", value: b }]);
    },
  },
  {
    id: "lat.exterior_angle.easy_remote_sum", skill: SKILL, kind: "exterior_angle", operator: "repr_shift", level: "easy",
    structure: "두 원격 내각을 더해 외각을 구함", extraThinking: "easy: 외각 정리 한 번 적용", concepts: ["외각 정리", "덧셈"], mediumSteps: 1,
    generate(rng) {
      const a = rng.int(20, 90), b = rng.int(20, 150 - a); const e = a + b; const [A, B, C] = rng.pick(NAMES3);
      const stim = rng.pick([
        `In triangle ${A}${B}${C}, angle ${A} measures ${a} degrees and angle ${B} measures ${b} degrees. Side ${A}${C} is extended past ${C}.`,
        `Side ${B}${C} of triangle ${A}${B}${C} is extended past ${C} to form an exterior angle. The interior angles at ${A} and ${B} are ${a} degrees and ${b} degrees.`,
        `A triangular fence ${A}${B}${C} has interior angles of ${a} degrees at ${A} and ${b} degrees at ${B}; the fence line at ${C} is continued straight ahead.`,
        `A ramp forms triangle ${A}${B}${C}. Angle ${A} is ${a} degrees and angle ${B} is ${b} degrees, and one side is extended beyond ${C}.`,
        `Extending a side of triangle ${A}${B}${C} past vertex ${C} creates an exterior angle at ${C}, while angle ${A} measures ${a} degrees and angle ${B} measures ${b} degrees.`,
      ]);
      return withBind(finish(rng, {
        stimulus: stim, question: rng.pick([`What is the measure of the exterior angle at ${C}, in degrees?`, `Find the exterior angle at vertex ${C}, in degrees.`, `How many degrees is the exterior angle at ${C}?`]), correct: e,
        wrongs: [W(180 - e, "geometry_misapplied", "외각이 아니라 이웃한 내각을 답했다."), W(a, "step_missing", "한 원격 내각만 답했다."), W(180 - a, "formula_misuse", "한 각의 보각을 구했다."), W(360 - e, "formula_misuse", "360에서 합을 뺐다."), W(e + 10, "other", "합을 잘못 더했다.")],
        verificationJs: withParams({ a, b }, "return 180-(180-P.a-P.b);"),
        trace: [["외각 정리: 외각 = 이웃하지 않는 두 내각의 합이다.", "Use the exterior angle theorem."], [`${a} + ${b} = ${e} 이다.`, "Add the remote interior angles."]],
        variant: "ext_from_remote",
      }), [{ noun: "angle", value: a }, { noun: "angle", value: b }]);
    },
  },
  {
    id: "lat.isosceles_base_angle.med_base_from_apex", skill: SKILL, kind: "isosceles_base_angle", operator: "repr_shift", level: "medium",
    structure: "꼭지각(또는 한 밑각)이 주어진 이등변삼각형에서 다른 각을 구함", extraThinking: "medium: 밑각이 둘로 같다는 사실과 내각의 합을 함께 사용", concepts: ["이등변삼각형 밑각", "내각의 합"], mediumSteps: 1,
    generate(rng) {
      const mode = rng.int(0, 1); const base = rng.int(25, 80); const apex = 180 - 2 * base; if (apex < 15) throw new GenFail("x"); const [A, B, C] = rng.pick(NAMES3);
      const sA = rng.pick([`Triangle ${A}${B}${C} is isosceles with ${A}${B} = ${A}${C}.`, `In isosceles triangle ${A}${B}${C}, sides ${A}${B} and ${A}${C} have equal length.`, `A triangular banner ${A}${B}${C} has two sides of equal length, ${A}${B} and ${A}${C}.`, `The roof of a shed is an isosceles triangle ${A}${B}${C} with equal sides ${A}${B} and ${A}${C}.`]);
      const sB = mode === 0 ? rng.pick([`The angle at ${A} measures ${apex} degrees.`, `Its vertex angle ${A} is ${apex} degrees.`, `Angle ${A}, between the equal sides, is ${apex} degrees.`]) : rng.pick([`Angle ${B} measures ${base} degrees.`, `One base angle, angle ${B}, is ${base} degrees.`, `The angle at ${B} is ${base} degrees.`]);
      const ans = mode === 0 ? base : apex; const q = mode === 0 ? rng.pick([`What is the measure of angle ${B}, in degrees?`, `Find the base angle at ${B}, in degrees.`, `How many degrees is angle ${B}?`]) : rng.pick([`What is the measure of angle ${A}, in degrees?`, `Find the vertex angle, in degrees.`, `How many degrees is the angle at ${A}?`]);
      return withBind(finish(rng, {
        stimulus: `${sA} ${sB}`, question: q, correct: ans,
        wrongs: [W(mode === 0 ? 180 - apex : 180 - base, "step_missing", "남은 각을 둘로 나누지 않았다(또는 밑각이 둘임을 빠뜨렸다)."), W(mode === 0 ? apex : base, "other", "묻는 각이 아닌 주어진 각을 답했다."), W(mode === 0 ? (180 + apex) / 2 : 180 - base, "sign_error", "180에서 빼지 않고 더했다."), W(mode === 0 ? 90 - apex : 90 - base, "condition_ignored", "180° 대신 90°를 썼다."), W(mode === 0 ? 180 / 3 : 60, "formula_misuse", "세 각이 같다고 가정했다.")],
        verificationJs: withParams({ mode, v: mode === 0 ? apex : base }, "if(P.mode===0){ return (180-P.v)/2; } return 180-2*P.v;"),
        trace: mode === 0 ? [["이등변삼각형에서 두 밑각은 서로 같다.", "Base angles are equal."], [`두 밑각의 합 = 180 - ${apex} = ${180 - apex}° 이다.`, "Subtract the vertex angle."], [`밑각 하나 = ${180 - apex} ÷ 2 = ${base}° 이다.`, "Divide by two."]] : [["이등변삼각형에서 두 밑각은 서로 같다.", "Base angles are equal."], [`두 밑각의 합 = 2 × ${base} = ${2 * base}° 이다.`, "Double the base angle."], [`꼭지각 = 180 - ${2 * base} = ${apex}° 이다.`, "Subtract from 180."]],
        variant: mode === 0 ? "base_from_apex" : "apex_from_base",
      }), [{ noun: mode === 0 ? [`angle ${A}`, `angle at ${A}`] : [`angle ${B}`, `angle at ${B}`], value: mode === 0 ? apex : base }]);
    },
  },
  {
    id: "lat.exterior_angle.med_find_remote", skill: SKILL, kind: "exterior_angle", operator: "inverse", level: "medium",
    structure: "외각과 한 원격 내각이 주어질 때 다른 원격 내각 또는 이웃한 내각을 구함", extraThinking: "medium: 외각 정리를 역으로 써서 빠진 각을 구하고 보각 관계를 확인", concepts: ["외각 정리", "보각"], mediumSteps: 1,
    generate(rng) {
      const [A, B, C] = rng.pick(NAMES3); const e = rng.int(95, 160), a = rng.int(25, e - 20); const b = e - a; const ask = rng.int(0, 1); const third = 180 - e;
      const sA = rng.pick([`In triangle ${A}${B}${C}, the exterior angle at ${C} measures ${e} degrees.`, `Side ${A}${C} of triangle ${A}${B}${C} is extended past ${C}, forming an exterior angle of ${e} degrees.`, `An exterior angle at vertex ${C} of triangle ${A}${B}${C} is ${e} degrees.`]);
      const sB = rng.pick([`Angle ${A} measures ${a} degrees.`, `The interior angle at ${A} is ${a} degrees.`, `Angle ${A} is ${a} degrees.`]);
      const ans = ask === 0 ? b : third;
      return withBind(finish(rng, {
        stimulus: `${sA} ${sB}`, question: ask === 0 ? rng.pick([`What is the measure of angle ${B}, in degrees?`, `Find angle ${B}, in degrees.`]) : rng.pick([`What is the measure of the interior angle at ${C}, in degrees?`, `Find angle ${C} of the triangle, in degrees.`]), correct: ans,
        wrongs: [W(ask === 0 ? third : b, "geometry_misapplied", "묻는 각 대신 이웃한 내각(또는 원격 내각)을 답했다."), W(ask === 0 ? e + a : e + a - 180 + 0, "sign_error", "빼야 할 각을 더했다."), W(ask === 0 ? 180 - a : e - a - 10, "formula_misuse", "보각을 구했다."), W(a, "other", "주어진 각을 그대로 답했다."), W(ask === 0 ? e - a + 10 : third + 10, "other", "계산 중 10° 어긋났다.")],
        verificationJs: withParams({ e, a, ask }, "const b=P.e-P.a; return P.ask===0?b:180-P.e;"),
        trace: [["외각 정리: 외각 = 이웃하지 않는 두 내각의 합이다.", "Apply the exterior angle theorem."], ask === 0 ? [`${e} = ${a} + 각 ${B} 이므로 각 ${B} = ${e} - ${a} = ${b}° 이다.`, "Solve for the missing remote angle."] : [`외각의 이웃한 내각은 180 - ${e} = ${third}° 이다.`, "Use the supplement."], [`답은 ${ans}° 이다.`, "Answer."]],
        variant: ask === 0 ? "remote_from_exterior" : "interior_from_exterior",
      }), [{ noun: [`angle ${A}`, `angle at ${A}`], value: a }, { noun: "exterior angle", value: e }]);
    },
  },
  {
    id: "lat.similar_triangles.med_scale", skill: SKILL, kind: "similar_triangles", operator: "repr_shift", level: "medium",
    structure: "닮은 삼각형의 대응변 한 쌍으로 닮음비를 구해 다른 대응변의 길이를 구함", extraThinking: "medium: 대응변 짝짓기와 비례식 풀이", concepts: ["닮음비", "비례식"], mediumSteps: 3,
    generate(rng) {
      const q = rng.int(1, 5), p = rng.int(1, 5); if (p === q || gcd(p, q) !== 1) throw new GenFail("x"); const u = rng.int(1, 5); const ab = q * u, de = p * u; const bc = q * rng.int(1, 7); const ef = (bc / q) * p; if (bc === ab) throw new GenFail("x");
      const [A, B, C] = rng.pick(NAMES3); const [D, E, F] = ["D", "E", "F"].map((x, i) => (x === A || x === B || x === C ? ["U", "V", "W"][i] : x));
      const stim = rng.pick([
        `Triangle ${A}${B}${C} is similar to triangle ${D}${E}${F}, with ${A}${B} corresponding to ${D}${E} and ${B}${C} corresponding to ${E}${F}. ${A}${B} = ${ab}, ${D}${E} = ${de}, and ${B}${C} = ${bc}.`,
        `Triangles ${A}${B}${C} and ${D}${E}${F} are similar. Side ${A}${B} matches side ${D}${E}, and side ${B}${C} matches side ${E}${F}. The lengths are ${A}${B} = ${ab}, ${D}${E} = ${de}, and ${B}${C} = ${bc}.`,
        `A model ${D}${E}${F} of a triangular frame ${A}${B}${C} is built so that ${D}${E} matches ${A}${B} and ${E}${F} matches ${B}${C}. Here ${A}${B} is ${ab}, ${D}${E} is ${de}, and ${B}${C} is ${bc}.`,
        `A photographer prints triangle ${A}${B}${C} and an enlarged copy ${D}${E}${F}, so the triangles are similar with ${A}${B} matching ${D}${E} and ${B}${C} matching ${E}${F}. Measurements: ${A}${B} = ${ab}, ${D}${E} = ${de}, ${B}${C} = ${bc}.`,
        `Triangle ${D}${E}${F} is a scaled copy of triangle ${A}${B}${C}. The side ${A}${B} has length ${ab} and corresponds to side ${D}${E} of length ${de}; side ${B}${C} has length ${bc} and corresponds to side ${E}${F}.`,
        `On a blueprint, triangle ${A}${B}${C} is similar to triangle ${D}${E}${F}, with ${A}${B}, ${B}${C} matching ${D}${E}, ${E}${F} in that order. You are told that ${A}${B} = ${ab}, ${D}${E} = ${de}, and ${B}${C} = ${bc}.`,
        `Two triangular plots, ${A}${B}${C} and ${D}${E}${F}, have the same shape. Edges ${A}${B} and ${D}${E} correspond, as do edges ${B}${C} and ${E}${F}. Edge ${A}${B} is ${ab} long, ${D}${E} is ${de} long, and ${B}${C} is ${bc} long.`,
      ]);
      return withBind(finish(rng, {
        stimulus: stim, question: rng.pick([`What is the length of ${E}${F}?`, `Find the length of side ${E}${F}.`, `How long is side ${E}${F}?`, `What is ${E}${F}?`, `Determine the length of ${E}${F}.`]), correct: ef,
        wrongs: [W((bc * q) / p, "formula_misuse", "닮음비를 거꾸로 적용했다."), W(bc + (de - ab), "formula_misuse", "배율 대신 증가분을 더했다."), W(bc, "condition_ignored", "닮음비를 적용하지 않았다."), W((de * bc) / ab + 1 || 1, "other", "계산 중 1 어긋났다."), W(de + bc - ab + 2, "formula_misuse", "차이를 더해 구했다.")],
        verificationJs: withParams({ ab, de, bc }, "let out=null;\nfor(let ef=1;ef<1000;ef++){ if(P.ab*ef===P.de*P.bc) out=ef; }\nif(out===null) throw new Error('해 없음');\nreturn out;"),
        trace: [[`대응변의 비: ${D}${E}/${A}${B} = ${de}/${ab} 이다.`, "Form the scale factor."], [`${E}${F}/${B}${C} 도 같은 비이므로 ${E}${F} = ${bc} × ${de}/${ab} 이다.`, "Apply it to the second pair."], [`${E}${F} = ${ef} 이다.`, "Compute."]],
        variant: "proportion_one_pair",
      }), [{ noun: `${A}${B}`, value: ab }, { noun: `${B}${C}`, value: bc }]);
    },
  },
  {
    id: "lat.triangle_angle_sum.med_expressions", skill: SKILL, kind: "triangle_angle_sum", operator: "repr_shift", level: "medium",
    structure: "삼각형의 세 각이 x 의 일차식일 때 합 180°로 x 를 구하고 지정한 각을 계산", extraThinking: "medium: 일차방정식으로 미지수를 구한 뒤 각도로 되돌림", concepts: ["삼각형 내각의 합", "일차방정식"], mediumSteps: 2,
    generate(rng) {
      const x = rng.int(8, 30); const c1 = rng.int(1, 3), c2 = rng.int(1, 3); const q1 = rng.nz(-15, 15), q2 = rng.nz(-15, 15); const a = c1 * x + q1, b = c2 * x + q2; const t = 180 - a - b; const k = rng.int(1, 3); const q3 = t - k * x; if (k + c1 + c2 === 0 || a < 10 || b < 10 || t < 10 || q3 === 0) throw new GenFail("x");
      if (c1 + c2 + k < 2) throw new GenFail("x"); const ask = rng.int(0, 2); const [A, B, C] = rng.pick(NAMES3); const ans = [a, b, t][ask];
      const e = (u: number, v: number) => M(`(${lin(u, v)})`);
      const stim = rng.pick([
        `In triangle ${A}${B}${C}, angle ${A} measures ${e(c1, q1)} degrees, angle ${B} measures ${e(c2, q2)} degrees, and angle ${C} measures ${e(k, q3)} degrees.`,
        `The angles of triangle ${A}${B}${C} are ${e(c1, q1)} degrees at ${A}, ${e(c2, q2)} degrees at ${B}, and ${e(k, q3)} degrees at ${C}.`,
        `A triangular lot ${A}${B}${C} has corner angles of ${e(c1, q1)} degrees, ${e(c2, q2)} degrees, and ${e(k, q3)} degrees at ${A}, ${B}, and ${C}, respectively.`,
      ]);
      return withBind(finish(rng, {
        stimulus: stim, question: rng.pick([`What is the measure of angle ${[A, B, C][ask]}, in degrees?`, `Find the measure of angle ${[A, B, C][ask]}, in degrees.`, `How many degrees is angle ${[A, B, C][ask]}?`]), correct: ans,
        wrongs: [W(x, "step_missing", "x 만 구하고 각도로 되돌리지 않았다."), W([a, b, t][(ask + 1) % 3], "other", "다른 각을 답했다."), W([a, b, t][(ask + 2) % 3], "other", "다른 각을 답했다."), W(ans - 10, "other", "계산 중 10° 어긋났다."), W(ans + x, "formula_misuse", "x 를 더 더했다.")],
        verificationJs: withParams({ c1, q1, c2, q2, k, q3, ask }, "let out=null;\nfor(let x=1;x<=180;x++){ const a=P.c1*x+P.q1,b=P.c2*x+P.q2,c=P.k*x+P.q3; if(a+b+c===180 && a>0&&b>0&&c>0) out=[a,b,c][P.ask]; }\nif(out===null) throw new Error('해 없음');\nreturn out;"),
        trace: [["세 각의 합은 180° 이므로 세 식을 모두 더해 180 과 같게 놓는다.", "Set the sum of the three expressions equal to 180."], [`${lin(c1 + c2 + k, q1 + q2 + q3)} = 180 이므로 x = ${x} 이다.`, "Solve for x."], [`각 식에 x = ${x} 를 대입하면 ${a}°, ${b}°, ${t}° 이다.`, "Evaluate each angle."]],
        variant: "linear_expressions",
      }), [{ noun: [`angle ${A}`, `degrees at ${A}`, `${A}, respectively`], value: lin(c1, q1) }]);
    },
  },
];
export const LAT_ALL: LArch[] = [...LAT_HARD.map((a) => asLevel(a)), ...LAT_LEVELS];
void countMult;
