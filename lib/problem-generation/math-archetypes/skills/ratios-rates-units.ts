// ratios_rates_units hard 원형 8개(proportion·chained_conversion × 연산자 4종).
import { GenFail, type Archetype } from "../types";
import { an, cap, facts, finish, spin, withParams } from "../text";
import { gcd } from "../rng";

const SKILL = "ratios_rates_units";
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;

export const RR_ARCHETYPES: Archetype[] = [
  {
    id: "rr.proportion.chain2", skill: SKILL, kind: "proportion", operator: "chain2",
    structure: "A:B 와 B:C 두 비를 공통 항 B 로 맞춰 A:B:C 연비를 만들고 전체량을 비례배분해 C 를 구함",
    extraThinking: "공통 항을 맞추는 연비 구성(최소공배수 배분) — medium 은 비 하나의 비례식",
    concepts: ["연비 구성", "비례배분", "공통 항 통일"], mediumSteps: 2,
    generate(rng) {
      const p = rng.int(1, 7), q = rng.int(2, 9), r = rng.int(1, 9), s = rng.int(1, 7);
      const L = lcm(q, r); const A = p * (L / q), B = L, C = s * (L / r); const T = A + B + C;
      if (T > 80 || gcd(gcd(A, B), C) !== 1 || p === q || r === s) throw new GenFail("x");
      const t = rng.int(2, 12); const N = T * t;
      if (N > 990) throw new GenFail("x");
      const ctx = rng.pick([
        { k: 0, who: ["red paint", "yellow paint", "blue paint"], unit: "liters", verb: "is mixed" },
        { k: 1, who: ["copper", "zinc", "tin"], unit: "kilograms", verb: "is melted together" },
        { k: 2, who: ["almonds", "raisins", "chocolate chips"], unit: "ounces", verb: "is prepared" },
        { k: 3, who: ["cement", "sand", "gravel"], unit: "pounds", verb: "is mixed" },
        { k: 4, who: ["Ava", "Ben", "Cleo"], unit: "dollars", verb: "is shared among them" },
        { k: 5, who: ["apple juice", "orange juice", "cranberry juice"], unit: "gallons", verb: "is blended" },
      ]);
      const [u1, u2, u3] = ctx.who; const pick = rng.pick([2, 0, 1] as const); const target = ctx.who[pick]; const ans = [A, B, C][pick] * t;
      const stimulus = spin(rng, ctx.k === 4
        ? `[[The ratio of|Comparing]] ${u1}'s share [[to|with]] ${u2}'s share [[is|comes to]] ${p} to ${q}, and [[the ratio of|comparing]] ${u2}'s share [[to|with]] ${u3}'s share [[is|comes to]] ${r} to ${s}. [[A total of ${N} ${ctx.unit} ${ctx.verb}.|In all, ${N} ${ctx.unit} ${ctx.verb}.|Altogether, ${N} ${ctx.unit} ${ctx.verb}.]]`
        : `[[A|One]] [[batch|blend|recipe|mixture]] [[contains|is made from|combines|uses]] ${u1}, ${u2}, and ${u3}. [[The ratio of ${u1} to ${u2} is|${u1} and ${u2} are in the ratio]] ${p} to ${q}, and [[the ratio of ${u2} to ${u3} is|${u2} and ${u3} are in the ratio]] ${r} to ${s}. [[A total of ${N} ${ctx.unit} ${ctx.verb}.|In all, ${N} ${ctx.unit} ${ctx.verb}.|Altogether, ${N} ${ctx.unit} ${ctx.verb}.]]`);
      return finish(rng, {
        stimulus, question: spin(rng, ctx.k === 4 ? `[[How many ${ctx.unit} does ${target} receive?|What amount, in ${ctx.unit}, does ${target} get?|Find the number of ${ctx.unit} that ${target} receives.]]` : `[[How many ${ctx.unit} of ${target} are in the batch?|What amount of ${target}, in ${ctx.unit}, is in the batch?|Find the number of ${ctx.unit} of ${target} in the batch.]]`), correct: ans,
        wrongs: [
          { v: (N * s) / (r + s), kind: "partial", reason: "둘째 비(B:C)만 써서 전체를 나눴다." },
          { v: (N * [p, q, s][pick]) / (p + q + s), kind: "formula_misuse", reason: "두 비의 항을 그대로 이어 붙여(공통 항을 맞추지 않고) 전체를 나눴다." },
          { v: [A, B, C][(pick + 1) % 3] * t, kind: "other", reason: "묻는 대상이 아닌 다른 재료의 양을 구했다." },
          { v: [A, B, C][(pick + 2) % 3] * t, kind: "other", reason: "묻는 대상이 아닌 다른 재료의 양을 구했다." },
          { v: [A, B, C][pick], kind: "step_missing", reason: "비의 합(한 묶음 양)을 구하고 배수 t 를 곱하지 않았다." },
        ],
        verificationJs: withParams({ p, q, r, s, N, pick }, "const sols=[];\nfor(let A=1;A<P.N;A++) for(let B=1;A+B<P.N;B++){ const C=P.N-A-B; if(A*P.q===B*P.p && B*P.s===C*P.r) sols.push([A,B,C]); }\nif(sols.length!==1) throw new Error('해가 유일하지 않음');\nreturn sols[0][P.pick===0?0:P.pick===1?1:2];"),
        trace: [
          [`두 비에서 공통인 둘째 항을 찾는다: ${p}:${q} 와 ${r}:${s} 에서 둘째 항이 각각 ${q} 와 ${r} 이다.`, "Identify the shared quantity in the two ratios."],
          [`${q} 와 ${r} 의 최소공배수 ${L} 로 맞춘다.`, "Scale both ratios to the least common multiple."],
          [`연비는 ${A} : ${B} : ${C} 이다.`, "Combine into one three-part ratio."],
          [`전체는 ${A} + ${B} + ${C} = ${T} 묶음이므로 한 묶음은 ${N} ÷ ${T} = ${t} 이다.`, "Find the size of one part."],
          [`묻는 대상의 묶음 수 ${[A, B, C][pick]} 에 ${t} 를 곱해 ${ans} 를 얻는다.`, "Multiply by the requested part count."],
        ],
        variant: ctx.k === 4 ? "shares" : "mixture",
      });
    },
  },
  {
    id: "rr.proportion.inverse", skill: SKILL, kind: "proportion", operator: "inverse",
    structure: "처음 비 a:b 를 (a k, b k)로 두고 인원 변화 후의 새 비로 방정식을 세워 k 를 구해 처음 전체 인원을 역산",
    extraThinking: "비를 미지 배수로 매개변수화하고 변화 후 비율을 식으로 세우는 역문제 — medium 은 주어진 비로 한 수량을 직접 계산",
    concepts: ["비의 매개변수화", "변화 후 비례식", "일차방정식"], mediumSteps: 2,
    generate(rng) {
      const a = rng.int(1, 7), b = rng.int(2, 9), c = rng.int(1, 8), d = rng.int(1, 8), k = rng.int(2, 14);
      const den = d * a - c * b; if (den === 0 || a === b) throw new GenFail("x");
      const num = k * den; if (num % c !== 0) throw new GenFail("x");
      const delta = num / c; const girls = b * k, boys = a * k;
      if (delta === 0 || girls + delta <= 0 || Math.abs(delta) > 40 || (a + b) * k > 400) throw new GenFail("x");
      if (gcd(a, b) !== 1 || gcd(c, d) !== 1) throw new GenFail("x");
      const [g1, g2, noun] = rng.pick([["boys", "girls", "students in a club"], ["cats", "dogs", "animals at a shelter"], ["sedans", "trucks", "vehicles on a lot"], ["novels", "biographies", "books on a shelf"], ["red tiles", "blue tiles", "tiles in a box"]] as const);
      const leave = delta < 0; const x = Math.abs(delta);
      const stimulus = spin(rng, `[[The ratio of|Initially, the ratio of]] ${g1} to ${g2} among the ${noun} [[is|was]] ${a} to ${b}. [[After|Once]] ${x} ${g2} [[${leave ? "are removed" : "are added"}|${leave ? "leave" : "join"}]] [[(and no ${g1} ${leave ? "are removed" : "are added"})|while the number of ${g1} stays the same|and ${g1} are unchanged]], the ratio of ${g1} to ${g2} [[becomes|changes to|is then]] ${c} to ${d}.`);
      return finish(rng, {
        stimulus, question: spin(rng, `[[How many ${noun.replace("students in a club", "students")} were there originally?|What was the original total number of ${g1} and ${g2}?|Before any change, how many ${g1} and ${g2} were there altogether?|What was the combined number of ${g1} and ${g2} at the start?]]`), correct: (a + b) * k,
        wrongs: [
          { v: (a + b) * k + delta, kind: "other", reason: "변화 후의 전체 개수를 구했다(처음 전체가 아님)." },
          { v: girls, kind: "other", reason: `처음 ${g2} 수만 구했다.` },
          { v: boys, kind: "other", reason: `처음 ${g1} 수만 구했다.` },
          { v: k, kind: "step_missing", reason: "한 묶음의 크기 k 만 구하고 전체 묶음 수(a+b)를 곱하지 않았다." },
          { v: (c + d) * k, kind: "formula_misuse", reason: "새 비의 합 c+d 를 처음 묶음 수로 착각했다." },
        ],
        verificationJs: withParams({ a, b, c, d, delta }, "const out=[];\nfor(let k=1;k<=500;k++){ const boys=P.a*k, girls=P.b*k+P.delta; if(girls>0 && boys*P.d===girls*P.c) out.push((P.a+P.b)*k); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`처음 ${g1} 수를 ${a}k, ${g2} 수를 ${b}k 로 둔다.`, "Write the original counts as multiples of the ratio."],
          [`${g2} 가 ${leave ? `${x}명 줄어` : `${x}명 늘어`} ${b}k ${leave ? "-" : "+"} ${x} 가 된다.`.replace("명", ""), "Express the new count."],
          [`새 비 ${c}:${d} 에서 ${a}k : (${b}k ${leave ? "-" : "+"} ${x}) = ${c} : ${d}.`, "Set up the new ratio as an equation."],
          [`내항·외항을 곱하면 ${d}·${a}k = ${c}(${b}k ${leave ? "-" : "+"} ${x}).`, "Cross-multiply."],
          [`정리해 k = ${k} 를 얻는다.`, "Solve for k."],
          [`처음 전체는 (${a} + ${b})·${k} = ${(a + b) * k} 이다.`, "Compute the original total."],
        ],
        variant: leave ? "remove" : "add",
      });
    },
  },
  {
    id: "rr.proportion.compare_scenarios", skill: SKILL, kind: "proportion", operator: "compare_scenarios",
    structure: "두 기계의 단위 생산률을 구하고, A 가 먼저 시작한 선행 생산량을 반영해 합산 목표 생산량에 도달하는 시간을 구함",
    extraThinking: "선행(시차) 생산량과 두 비율의 합성 — medium 은 단일 비율 비례식",
    concepts: ["단위 비율", "시차가 있는 합성 작업률", "일차방정식"], mediumSteps: 2,
    generate(rng) {
      const ra = rng.int(2, 9), rb = rng.int(2, 9), ka = rng.int(3, 9), kb = rng.int(3, 9), m = rng.int(2, 9), t = rng.int(3, 20);
      if (ra === rb) throw new GenFail("x");
      const itA = ra * ka, minA = ka, itB = rb * kb, minB = kb; const N = ra * (t + m) + rb * t;
      if (N > 990) throw new GenFail("x");
      const [A, B, thing, unit] = rng.pick([["Machine A", "Machine B", "bottles", "minutes"], ["Printer A", "Printer B", "pages", "minutes"], ["Oven A", "Oven B", "loaves", "minutes"], ["Worker A", "Worker B", "widgets", "minutes"], ["Pump A", "Pump B", "gallons", "minutes"]] as const);
      const stimulus = spin(rng, `${A} [[produces|makes|turns out]] ${itA} ${thing} [[in every|every]] ${minA} ${unit}, [[and|while]] ${B} [[produces|makes|turns out]] ${itB} ${thing} [[in every|every]] ${minB} ${unit}. ${A} [[starts running|begins working|gets going]] ${m} ${unit} [[before ${B} starts|before ${B} begins|before ${B} is switched on|earlier than ${B}]], and [[both then keep running at their steady rates|then both run at constant rates|after that both continue at steady rates]].`);
      return finish(rng, {
        stimulus, question: spin(rng, `[[How many ${unit} after ${B} starts will the two together have produced a total of ${N} ${thing}?|Counting from the moment ${B} starts, how many ${unit} pass before the two have made ${N} ${thing} in all?|${B} has been running for how many ${unit} when the combined output reaches ${N} ${thing}?]]`), correct: t,
        wrongs: [
          { v: t + m, kind: "other", reason: `${A}가 시작한 시점부터의 총 시간을 답했다(${B} 시작 기준이 아님).` },
          { v: Math.round(N / (ra + rb)), kind: "step_missing", reason: `${A}의 선행 생산량을 무시하고 합산 비율로만 나눴다.` },
          { v: Math.round(N / ra), kind: "partial", reason: `${A} 혼자 만든다고 계산했다.` },
          { v: Math.round((N - ra * m) / ra), kind: "partial", reason: `선행 생산량을 빼고도 ${B}의 생산을 더하지 않았다.` },
          { v: t - m, kind: "sign_error", reason: "시차를 더해야 할 곳에서 뺐다." },
        ],
        verificationJs: withParams({ itA, minA, itB, minB, m, N }, "const out=[];\nfor(let t=0;t<=1000;t++){ if(P.itA*(t+P.m)*P.minB + P.itB*t*P.minA === P.N*P.minA*P.minB) out.push(t); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`${A}의 비율은 ${itA}/${minA} = ${ra} 개/분, ${B}의 비율은 ${itB}/${minB} = ${rb} 개/분이다.`, "Compute each unit rate."],
          [`${B}가 시작할 때 ${A}는 이미 ${ra}×${m} = ${ra * m} 개를 만들었다.`, "Account for the head start."],
          [`이후 두 기계의 합산 비율은 ${ra} + ${rb} = ${ra + rb} 개/분이다.`, "Add the rates."],
          [`남은 생산량은 ${N} - ${ra * m} = ${N - ra * m} 개이다.`, "Find the remaining quantity."],
          [`걸리는 시간은 ${N - ra * m} ÷ ${ra + rb} = ${t} 분이다.`, "Divide the remaining quantity by the combined rate."],
        ],
        variant: "head_start",
      });
    },
  },
  {
    id: "rr.proportion.unit_ratio", skill: SKILL, kind: "proportion", operator: "unit_ratio",
    structure: "지도 위 넓이와 실제 넓이의 비에서 길이 축척(제곱근)을 역산해 실제 도로 길이를 지도 길이로 환산",
    extraThinking: "넓이비는 길이비의 제곱이라는 차원 변환과 그 역산(제곱근) — medium 은 길이 축척 하나의 비례",
    concepts: ["넓이와 길이 축척의 관계", "제곱근", "단위 비율 환산"], mediumSteps: 2,
    generate(rng) {
      const k = rng.int(2, 9), A = rng.int(2, 30), u = rng.int(2, 15), S = A * k * k, L = u * k;
      if (S > 990 || L > 150) throw new GenFail("x");
      const [place, road, unit, small] = rng.pick([["national park", "trail", "kilometers", "centimeters"], ["lake", "shoreline path", "kilometers", "centimeters"], ["island", "coastal road", "miles", "inches"], ["forest reserve", "fire road", "kilometers", "centimeters"]] as const);
      const stimulus = spin(rng, `[[On a scale map,|A map is drawn to scale.|On a map with one uniform scale,]] ${an(place)} [[appears with|is shown with|covers]] an area of ${A} square ${small} [[ and its actual area is|, while its true area is|, but in reality it covers]] ${S} square ${unit}. [[The map uses the same scale in both directions.|The scale is the same horizontally and vertically.|Lengths on the map are all reduced by one constant factor.]]`);
      return finish(rng, {
        stimulus, question: spin(rng, `[[A ${road} that is ${L} ${unit} long in reality would be how many ${small} long on the map?|On the map, how many ${small} long is a ${road} whose real length is ${L} ${unit}?|A ${road} measures ${L} ${unit} in real life. What is its length on the map, in ${small}?]]`), correct: u,
        wrongs: [
          { v: L / (S / A), kind: "formula_misuse", reason: "넓이 비 S/A 를 길이 축척으로 그대로 사용했다(제곱근을 취하지 않음)." },
          { v: L * k, kind: "formula_misuse", reason: "실제 길이를 나누지 않고 축척을 곱했다." },
          { v: Math.round((L * A) / S), kind: "formula_misuse", reason: "길이에 넓이 비례를 적용했다." },
          { v: S / A, kind: "step_missing", reason: "넓이 비 S/A 만 구하고 길이 비로 바꾸지 않았다." },
          { v: k, kind: "step_missing", reason: "축척 k 만 구하고 도로 길이를 환산하지 않았다." },
        ],
        verificationJs: withParams({ A, S, L }, "const out=[];\nfor(let k=1;k<=200;k++){ if(P.A*k*k===P.S) out.push(P.L/k); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          ["넓이는 길이 축척의 제곱으로 변하므로 (실제 넓이) ÷ (지도 넓이) = (길이 축척)² 이다.", "Areas scale with the square of the length scale."],
          [`${S} ÷ ${A} = ${S / A} 이다.`, "Compute the area ratio."],
          [`제곱근을 취해 길이 축척은 지도 1 ${small} 당 실제 ${k} ${unit} 이다.`, "Take the square root to get the length scale."],
          [`실제 길이 ${L} ${unit} 를 ${k} 로 나눈다.`, "Divide the actual length by the scale."],
          [`지도 위 길이는 ${u} ${small} 이다.`, "State the map length."],
        ],
        variant: "area_scale_inverse",
      });
    },
  },
  {
    id: "rr.chained_conversion.compose_kind", skill: SKILL, kind: "chained_conversion", operator: "compose_kind",
    structure: "분→시 환산 → 거리=속력×시간 → 연비로 연료량(또는 100마일당 연료 사용량을 역수로 해석) → 연료비",
    extraThinking: "속도·연비·가격·시간 단위를 한 사슬로 연결하면서 연비가 '100마일당 갤런' 꼴이면 역수 방향을 스스로 판단 — medium 은 단위 환산 두 번",
    concepts: ["연쇄 단위 환산", "거리·속력·시간", "비율의 방향(역수) 해석"], mediumSteps: 3,
    generate(rng) {
      const v = rng.pick([30, 36, 40, 45, 48, 50, 60]), t = rng.pick([20, 30, 40, 45, 60, 75, 90, 120, 150]);
      if ((v * t) % 60 !== 0) throw new GenFail("x");
      const D = (v * t) / 60; const p = rng.int(3, 6);
      const per100 = rng.chance(0.5);
      let m = 0, g100 = 0;
      if (per100) { g100 = rng.pick([2, 4, 5, 8, 10]); if ((D * g100) % 100 !== 0) throw new GenFail("x"); } else { m = rng.int(12, 40); if (D % m !== 0) throw new GenFail("x"); }
      const gallons = per100 ? (D * g100) / 100 : D / m; const cost = gallons * p;
      if (cost > 400 || cost < 4) throw new GenFail("x");
      const vehicle = rng.pick(["delivery van", "car", "bus", "truck", "minivan", "taxi", "shuttle", "pickup truck"]);
      const fuelSent = per100
        ? [`A ${vehicle} uses ${g100} gallons of fuel for every 100 miles.`, `The ${vehicle} burns ${g100} gallons of fuel per 100 miles driven.`, `Every 100 miles, a ${vehicle} consumes ${g100} gallons of fuel.`, `Fuel economy for a ${vehicle} is rated at ${g100} gallons per 100 miles.`]
        : [`A ${vehicle} travels ${m} miles on each gallon of fuel.`, `The ${vehicle} gets ${m} miles per gallon.`, `A ${vehicle} goes ${m} miles for every gallon it burns.`, `Fuel economy for a ${vehicle} is ${m} miles per gallon.`];
      const stimulus = facts(rng, [
        fuelSent,
        [`Fuel costs ${p} dollars per gallon.`, `The price of fuel is ${p} dollars per gallon.`, `Each gallon of fuel costs ${p} dollars.`, `Fuel is sold at ${p} dollars a gallon.`],
        [`The ${vehicle} drives at a constant speed of ${v} miles per hour.`, `It is driven at a steady ${v} miles per hour.`, `Its speed stays fixed at ${v} miles per hour the whole way.`, `The driver keeps a constant ${v} miles per hour.`],
      ], [1, 2]);
      return finish(rng, {
        stimulus, question: spin(rng, `[[What is the fuel cost, in dollars, for a ${t}-minute trip?|How many dollars of fuel are needed for a trip lasting ${t} minutes?|For a ${t}-minute drive, what does the fuel cost, in dollars?]]`), correct: cost,
        wrongs: [
          { v: v * t * p / (per100 ? 1 : m), kind: "unit_error", reason: "분을 시간으로 바꾸지 않고 분 단위 그대로 곱했다." },
          { v: per100 ? D * g100 * p : D * m * p, kind: "formula_misuse", reason: per100 ? "100마일당 갤런 비율을 나눗셈 방향으로 잘못 적용했다(100으로 나누지 않음)." : "연비(마일/갤런)를 곱해서 갤런 수를 구했다(나눠야 함)." },
          { v: D, kind: "step_missing", reason: "거리까지만 구하고 연료비로 환산하지 않았다." },
          { v: gallons, kind: "step_missing", reason: "연료량까지만 구하고 갤런당 가격을 곱하지 않았다." },
          { v: per100 ? D * p : (D / m) * p * 2, kind: "formula_misuse", reason: "연료 사용률을 잘못된 방향으로 적용했다." },
        ],
        verificationJs: withParams({ v, t, p, m, g100, per100: per100 ? 1 : 0 }, "const out=[];\nfor(let c=0;c<=3000;c++){ const lhs = P.per100 ? c*6000 : c*P.m*60; const rhs = P.per100 ? P.v*P.t*P.g100*P.p : P.v*P.t*P.p; if(lhs===rhs) out.push(c); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`${t}분 = ${t}/60 시간으로 바꾼다.`, "Convert minutes to hours."],
          [`거리 = ${v} × ${t}/60 = ${D} 마일이다.`, "Distance = speed x time."],
          [per100 ? `100마일당 ${g100} 갤런이므로 1마일당 ${g100}/100 갤런이다.` : `갤런당 ${m} 마일이므로 1마일당 1/${m} 갤런이다.`, "Turn the fuel-economy statement into gallons per mile."],
          [`연료량 = ${D} × ${per100 ? `${g100}/100` : `1/${m}`} = ${gallons} 갤런이다.`, "Compute the fuel used."],
          [`연료비 = ${gallons} × ${p} = ${cost} 달러이다.`, "Multiply by the price per gallon."],
        ],
        variant: per100 ? "gallons_per_100_miles" : "miles_per_gallon",
      });
    },
  },
  {
    id: "rr.chained_conversion.unit_ratio", skill: SKILL, kind: "chained_conversion", operator: "unit_ratio",
    structure: "수조의 수심 증가분으로 부피(m³)를 구하고 1 m³ = 1000 L 로 환산한 뒤 분당 급수량으로 나눠 시간을 구함",
    extraThinking: "부피 단위는 길이 환산의 세제곱(1 m³ = 1000 L)이라는 차원 변환과 수심 변화량 추출 — medium 은 선형 길이 단위 환산",
    concepts: ["부피 단위 환산", "직육면체 부피", "비율(유량)로 시간 계산"], mediumSteps: 3,
    generate(rng) {
      const Lm = rng.int(2, 8), W = rng.int(2, 8), H = rng.int(4, 6), d1 = rng.int(1, 2), d2 = rng.int(d1 + 1, H);
      const liters = 1000 * Lm * W * (d2 - d1); const R = rng.pick([50, 100, 125, 200, 250, 400, 500]);
      if (liters % R !== 0) throw new GenFail("x"); const T = liters / R; if (T > 900 || T < 4) throw new GenFail("x");
      const [tank, thing] = rng.pick([["rectangular fish tank", "water"], ["rectangular swimming pool", "water"], ["rectangular cistern", "water"], ["rectangular storage tank", "oil"], ["rectangular aquarium", "water"], ["rectangular reservoir", "water"], ["rectangular rain barrel", "water"], ["rectangular fuel tank", "diesel"]] as const);
      const stimulus = spin(rng, `[[A|Consider a|There is a]] ${tank} [[that is|which is|measuring]] ${Lm} meters long, ${W} meters wide, and ${H} meters deep. [[It currently holds|At the moment it contains|Right now it has|To start, it holds]] ${thing} to a depth of ${d1} meters. [[A pump adds ${thing} at|A pump delivers ${thing} at|${thing.charAt(0).toUpperCase() + thing.slice(1)} is pumped in at|Workers add ${thing} using a pump running at]] a constant rate of ${R} liters per minute. [[(1 cubic meter = 1000 liters.)|Recall that 1 cubic meter equals 1000 liters.|Use 1 cubic meter = 1000 liters.]]`);
      return finish(rng, {
        stimulus, question: spin(rng, `[[How many minutes will it take for the ${thing} to reach a depth of ${d2} meters?|After how many minutes does the ${thing} first reach a depth of ${d2} meters?|The pump must run for how many minutes to raise the ${thing} to a depth of ${d2} meters?]]`), correct: T,
        wrongs: [
          { v: liters / 1000 / R, kind: "unit_error", reason: "세제곱미터를 리터로 바꾸지 않았다." },
          { v: (liters / 10) / R, kind: "unit_error", reason: "1 m³ 를 10 L 로 잘못 환산했다(길이 환산 10배를 세제곱하지 않음)." },
          { v: (liters * 10) / R, kind: "unit_error", reason: "1 m³ 를 10000 L 로 잘못 환산했다." },
          { v: (1000 * Lm * W * d2) / R, kind: "step_missing", reason: "현재 수심 d1 을 빼지 않고 목표 수심 전체의 부피로 계산했다." },
          { v: (1000 * Lm * W * H) / R, kind: "step_missing", reason: "수조의 전체 깊이로 계산했다." },
        ],
        verificationJs: withParams({ L: Lm, W, d1, d2, R }, "const out=[];\nfor(let T=0;T<=2000;T++){ if(P.R*T===1000*P.L*P.W*(P.d2-P.d1)) out.push(T); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`더 채울 수심은 ${d2} - ${d1} = ${d2 - d1} m 이다.`, "Find the additional depth."],
          [`더 필요한 부피는 ${Lm} × ${W} × ${d2 - d1} = ${Lm * W * (d2 - d1)} m³ 이다.`, "Compute the extra volume in cubic meters."],
          [`1 m³ = 1000 L 이므로 ${Lm * W * (d2 - d1)} × 1000 = ${liters} L 이다.`, "Convert cubic meters to liters."],
          [`분당 ${R} L 로 채우므로 ${liters} ÷ ${R} 를 계산한다.`, "Divide by the pumping rate."],
          [`걸리는 시간은 ${T} 분이다.`, "State the time."],
        ],
        variant: "volume_to_time",
      });
    },
  },
  {
    id: "rr.chained_conversion.compare_scenarios", skill: SKILL, kind: "chained_conversion", operator: "compare_scenarios",
    structure: "두 상품의 가격을 공통 단위(리터당 센트)로 환산(리터·밀리리터·달러·센트)한 뒤 차이를 구함",
    extraThinking: "서로 다른 용량 단위·화폐 단위를 공통 단위로 통일해 비교(단위 기준 선택)한 뒤 차를 구함 — medium 은 단일 환산",
    concepts: ["단위 가격", "용량 단위 환산", "두 값 비교"], mediumSteps: 3,
    generate(rng) {
      const k = rng.pick([1, 2, 4, 5]), x = rng.int(2, 12), m = rng.pick([200, 250, 400, 500]), y = rng.int(1, 5);
      const perA = (100 * x) / k, perB = (100000 * y) / m; const diff = Math.abs(perA - perB);
      if (!Number.isInteger(perA) || diff === 0 || diff > 900) throw new GenFail("x");
      const [thing, A, B] = rng.pick([["olive oil", "Store A", "Store B"], ["orange juice", "Brand A", "Brand B"], ["vinegar", "Shop A", "Shop B"], ["liquid soap", "Market A", "Market B"], ["maple syrup", "Seller A", "Seller B"]] as const);
      const stimulus = spin(rng, `${A} [[sells|offers|charges]] ${k} liter${k > 1 ? "s" : ""} of ${thing} [[for|at a price of]] ${x} dollars. ${B} [[sells|offers|charges]] ${m} milliliters of the same ${thing} [[for|at a price of]] ${y} dollar${y > 1 ? "s" : ""}. [[(1 liter = 1000 milliliters and 1 dollar = 100 cents.)|Recall that 1 liter is 1000 milliliters and 1 dollar is 100 cents.|Use 1 liter = 1000 milliliters and 100 cents = 1 dollar.]]`);
      return finish(rng, {
        stimulus, question: spin(rng, `[[How many more cents per liter does the more expensive seller charge than the other seller?|Per liter, how many cents more does the pricier seller charge than the cheaper one?|What is the difference, in cents per liter, between the two prices?]]`), correct: diff,
        wrongs: [
          { v: Math.abs(perA - perB / 1000), kind: "unit_error", reason: "밀리리터를 리터로 바꿀 때 1000배를 곱하지 않았다." },
          { v: Math.round(diff / 100), kind: "unit_error", reason: "센트 대신 달러 단위로 답했다." },
          { v: Math.abs((100 * x) - (100 * y)), kind: "step_missing", reason: "용량 차이를 무시하고 가격만 비교했다." },
          { v: Math.round(perA + perB), kind: "formula_misuse", reason: "차가 아니라 합을 구했다." },
          { v: Math.abs(perA - (100 * y) / m), kind: "unit_error", reason: "B 의 리터당 가격을 밀리리터당 가격으로 그대로 썼다." },
        ],
        verificationJs: withParams({ k, x, m, y }, "const aPerMl=(100*P.x)/(P.k*1000), bPerMl=(100*P.y)/P.m;\nreturn Math.round(Math.abs(aPerMl-bPerMl)*1000);"),
        trace: [
          [`${A}: ${x} 달러 = ${100 * x} 센트, ${k} L 이므로 리터당 ${perA} 센트이다.`, "Convert store A to cents per liter."],
          [`${B}: ${y} 달러 = ${100 * y} 센트, 용량 ${m} mL.`, "Convert store B's price to cents."],
          [`${m} mL = ${m / 1000} L 이므로 1 L 는 ${1000 / m} 배 많다.`, "Scale to one liter."],
          [`${B} 는 리터당 ${100 * y} × ${1000 / m} = ${perB} 센트이다.`, "Compute store B's price per liter."],
          [`두 값의 차는 |${perA} - ${perB}| = ${diff} 센트이다.`, "Subtract."],
        ],
        variant: "unit_price_gap",
      });
    },
  },
  {
    id: "rr.chained_conversion.chain2", skill: SKILL, kind: "chained_conversion", operator: "chain2",
    structure: "km/h → m/min 환산 후 구간 1·2 이동 거리를 각각 구해 합산",
    extraThinking: "속력 단위(km/h→m/min) 환산을 구간마다 독립 적용하고 합산(구간별 속력·시간이 다름) — medium 은 한 구간 단위 환산",
    concepts: ["속력 단위 환산", "구간별 거리", "합산"], mediumSteps: 3,
    generate(rng) {
      const v1 = rng.pick([12, 15, 18, 21, 24, 30, 36]), v2 = rng.pick([12, 15, 18, 21, 24, 30, 36]), t1 = rng.pick([10, 12, 15, 20, 30, 40, 45]), t2 = rng.pick([10, 12, 15, 20, 30, 40, 45]);
      if ((v1 * t1) % 3 !== 0 || (v2 * t2) % 3 !== 0 || v1 === v2) throw new GenFail("x");
      const d1 = (v1 * t1 * 50) / 3, d2 = (v2 * t2 * 50) / 3, tot = d1 + d2; if (tot > 9000) throw new GenFail("x");
      const [who, verb, alt] = rng.pick([["a cyclist", "rides", "pedals"], ["a delivery robot", "travels", "rolls"], ["a runner", "runs", "jogs"], ["a scooter rider", "rides", "cruises"], ["a courier", "rides", "pedals"], ["a hiker", "walks", "hikes"], ["a drone", "flies", "glides"], ["a skater", "glides", "skates"], ["a mail carrier", "rides", "pedals"], ["a tourist", "rides", "cruises"], ["a student", "walks", "strolls"], ["an electric cart", "travels", "rolls"]] as const);
      const stimulus = facts(rng, [
        [`${cap(who)} ${verb} for ${t1} minutes at ${v1} kilometers per hour.`, `At first, ${who} ${alt} at ${v1} kilometers per hour for ${t1} minutes.`, `For the first ${t1} minutes, ${who} moves at ${v1} kilometers per hour.`, `${cap(who)} spends ${t1} minutes going ${v1} kilometers per hour.`, `The trip begins with ${t1} minutes at ${v1} kilometers per hour, made by ${who}.`, `Over a ${t1}-minute opening stretch, ${who} keeps up ${v1} kilometers per hour.`],
        [`Then it continues for another ${t2} minutes at ${v2} kilometers per hour.`, `After that, the trip goes on for ${t2} more minutes at ${v2} kilometers per hour.`, `The second part lasts ${t2} minutes at ${v2} kilometers per hour.`, `Next comes a ${t2}-minute stretch at ${v2} kilometers per hour.`, `Finally, ${t2} minutes are spent at ${v2} kilometers per hour.`, `The remaining ${t2} minutes are traveled at ${v2} kilometers per hour.`],
      ]);
      return finish(rng, {
        stimulus, question: spin(rng, "[[What is the total distance traveled, in meters?|Altogether, how many meters are covered?|How far, in meters, does the trip cover in total?]]"), correct: tot,
        wrongs: [
          { v: Math.round(((v1 * t1 + v2 * t2) * 1000) / 60 / 60), kind: "unit_error", reason: "분을 시간으로 바꾸면서 60 으로 두 번 나눴다." },
          { v: Math.round(((v1 * t1 + v2 * t2) * 1000)), kind: "unit_error", reason: "분을 시간으로 환산하지 않았다." },
          { v: Math.round(d1), kind: "step_missing", reason: "첫 구간 거리만 구했다." },
          { v: Math.round(((v1 + v2) / 2) * (t1 + t2) * 50 / 3), kind: "formula_misuse", reason: "두 속력의 평균에 전체 시간을 곱했다(시간 가중 평균이 아님)." },
          { v: Math.round(tot / 1000), kind: "unit_error", reason: "킬로미터를 미터로 환산하지 않았다." },
        ],
        verificationJs: withParams({ v1, v2, t1, t2 }, "const m1=P.v1*1000/3600*(P.t1*60), m2=P.v2*1000/3600*(P.t2*60);\nreturn Math.round(m1+m2);"),
        trace: [
          [`${v1} km/h = ${v1}×1000/60 = ${(v1 * 50) / 3} m/분 이다.`, "Convert the first speed to meters per minute."],
          [`첫 구간 거리 = ${(v1 * 50) / 3} × ${t1} = ${d1} m 이다.`, "First leg distance."],
          [`${v2} km/h = ${(v2 * 50) / 3} m/분 이다.`, "Convert the second speed."],
          [`둘째 구간 거리 = ${(v2 * 50) / 3} × ${t2} = ${d2} m 이다.`, "Second leg distance."],
          [`총 거리 = ${d1} + ${d2} = ${tot} m 이다.`, "Add the legs."],
        ],
        variant: "two_legs",
      });
    },
  },
];
