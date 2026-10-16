// linear_inequalities — SPR 독립 그룹 보강(G10): 부등식 응용 hard 원형 4개 × 변형 23개(변형 하나 = 유사문항 그룹 하나). 금액은 '$' 가 수식 기호와 겹치므로 dollars 로 쓴다.
import { GenFail, T, W, multi, type VFn } from "../spr-groups-b-kit";
import { spin, withParams, M } from "../text";

const SKILL = "linear_inequalities", KIND = "ineq_applications";
const ceilDiv = (a: number, b: number) => Math.ceil(a / b - 1e-9), floorDiv = (a: number, b: number) => Math.floor(a / b + 1e-9);

// ───────── constraint_select: 제약을 읽어 경계에서 정수 후보를 선택 ─────────
const SEL: Record<string, VFn> = {
  max_items_two_budgets: (rng) => {
    const p = rng.int(2, 9), q = rng.int(3, 12), n = rng.int(2, 6), k = rng.int(3, 15), extra = rng.int(0, p - 1); const B = q * n + p * k + extra; if (extra === 0 && rng.chance(0.5)) throw new GenFail("x");
    const [a, b] = rng.pick([["pens", "notebooks"], ["cupcakes", "greeting cards"], ["markers", "sketchbooks"], ["stickers", "folders"], ["granola bars", "water bottles"]]);
    return {
      stimulus: spin(rng, `Maya has ${B} dollars to spend. She must buy exactly ${n} ${b} that cost ${q} dollars each, and she will spend whatever is left on ${a} that cost ${p} dollars each.`),
      question: spin(rng, `[[What is the greatest number of ${a} she can buy?|At most how many ${a} can Maya afford?]]`), correct: k,
      wrongs: [W(floorDiv(B, p), "step_missing", `${b} 값을 빼지 않았다.`), W(k + 1, "other", "남는 돈이 모자라는데 하나 더 샀다."), W(floorDiv(B - q, p), "step_missing", `${b} 를 한 개만 샀다고 계산했다.`), W(Math.max(1, k - 1), "other", "경계값에서 하나를 덜 샀다."), W(floorDiv(B, p + q), "formula_misuse", "두 물건을 같은 값으로 취급했다.")],
      verificationJs: withParams({ B, p, q, n }, "let k=0; while((k+1)*P.p+P.q*P.n<=P.B) k++;\nreturn k;"),
      trace: [T(`${b} 는 ${n} × ${q} = ${n * q} 달러이다.`, "Cost of the required items."), T(`남는 돈은 ${B} − ${n * q} = ${B - n * q} 달러이다.`, "Money left."), T(`${a} 개수를 x 라 하면 ${p}x ≤ ${B - n * q} 이다.`, "Write the inequality."), T(`x ≤ ${B - n * q}/${p} 이고 x 는 정수이다.`, "Solve and note x is a whole number."), T(`최댓값은 ${k} 이다.`, "Take the greatest integer.")],
    };
  },
  min_tickets_for_profit: (rng) => {
    const t = rng.int(9, 24), c = rng.int(2, 6), F = rng.int(20, 90) * 10, Pf = rng.int(5, 40) * 10; const n = ceilDiv(F + Pf, t - c); if (n < 10 || n > 400 || (F + Pf) % (t - c) === 0) throw new GenFail("x");
    const ev = rng.pick(["school play", "charity concert", "film night", "science fair", "talent show"]);
    return {
      stimulus: spin(rng, `A ${ev} has fixed costs of ${F} dollars for the venue and equipment. Each attendee also costs ${c} dollars in refreshments, and each ticket sells for ${t} dollars. The organizers want a profit of at least ${Pf} dollars.`),
      question: spin(rng, `[[What is the least number of tickets that must be sold?|What is the minimum whole number of tickets needed to reach the profit goal?]]`), correct: n,
      wrongs: [W(floorDiv(F + Pf, t - c), "step_missing", "올림하지 않고 내림했다."), W(ceilDiv(F + Pf, t), "formula_misuse", "참석자당 비용을 빼지 않았다."), W(ceilDiv(F, t - c), "step_missing", "목표 이익을 더하지 않았다."), W(n + 1, "other", "경계에서 하나 더 잡았다."), W(ceilDiv(F + Pf + c, t - c), "formula_misuse", "참석자 비용을 고정 비용에 한 번만 더했다.")],
      verificationJs: withParams({ t, c, F, Pf }, "let n=0; while(P.t*n-P.c*n-P.F<P.Pf) n++;\nreturn n;"),
      trace: [T(`티켓 한 장의 순이익은 ${t} − ${c} = ${t - c} 달러이다.`, "Profit per ticket."), T(`n 장을 팔면 이익은 ${t - c}n − ${F} 이다.`, "Profit expression."), T(`목표는 ${t - c}n − ${F} ≥ ${Pf} 이다.`, "Set up the inequality."), T(`n ≥ ${F + Pf}/${t - c} = ${((F + Pf) / (t - c)).toFixed(2)} 이다.`, "Solve."), T(`정수여야 하므로 최소 ${n} 장이다.`, "Round up to a whole ticket.")],
    };
  },
  max_boxes_elevator: (rng) => {
    const w1 = rng.int(120, 200), w2 = rng.int(120, 200), w3 = rng.int(110, 190), bw = rng.int(12, 45), C = rng.pick([700, 800, 900, 1000]); const free = C - (w1 + w2 + w3); if (free < bw * 2) throw new GenFail("x"); const k = floorDiv(free, bw); if (free % bw === 0) throw new GenFail("x");
    const what = rng.pick(["boxes of textbooks", "crates of fruit", "cartons of paper", "bags of cement mix"]);
    return {
      stimulus: spin(rng, `A freight elevator can carry at most ${C} pounds. Three workers weighing ${w1}, ${w2}, and ${w3} pounds ride the elevator together with identical ${what}, each weighing ${bw} pounds.`),
      question: spin(rng, `[[What is the greatest number of ${what} that can be loaded on this trip?|At most how many ${what} can go up with the three workers?]]`), correct: k,
      wrongs: [W(floorDiv(C, bw), "step_missing", "작업자 몸무게를 빼지 않았다."), W(k + 1, "other", "한도를 넘는 하나를 더 실었다."), W(floorDiv(C - w1, bw), "step_missing", "한 사람의 무게만 뺐다."), W(Math.max(1, k - 1), "other", "경계값에서 하나를 덜 실었다."), W(floorDiv(free, bw) + 3, "other", "작업자 수를 상자로 센 계산 실수.")],
      verificationJs: withParams({ C, w1, w2, w3, bw }, "let k=0; while(P.w1+P.w2+P.w3+(k+1)*P.bw<=P.C) k++;\nreturn k;"),
      trace: [T(`세 작업자의 무게 합은 ${w1} + ${w2} + ${w3} = ${w1 + w2 + w3} lb 이다.`, "Weight of the workers."), T(`상자에 쓸 수 있는 무게는 ${C} − ${w1 + w2 + w3} = ${free} lb 이다.`, "Capacity left for cargo."), T(`상자 수 x 는 ${bw}x ≤ ${free} 를 만족한다.`, "Inequality for the number of items."), T(`x ≤ ${free}/${bw} = ${(free / bw).toFixed(2)} 이다.`, "Solve."), T(`정수이므로 최대 ${k} 개이다.`, "Round down.")],
    };
  },
  abs_count_integers: (rng) => {
    const a = rng.int(2, 5), b = rng.int(1, 20), c = rng.int(a * 3, a * 9) + rng.int(0, a - 1); let cnt = 0; for (let x = -200; x <= 200; x++) if (Math.abs(a * x - b) < c) cnt++; if (cnt < 4 || cnt > 40) throw new GenFail("x");
    return {
      stimulus: spin(rng, `Consider the inequality ${M(`|${a}x - ${b}| < ${c}`)}, where x is an integer.`),
      question: spin(rng, `[[How many integer values of x satisfy the inequality?|For how many integers x is the inequality true?]]`), correct: cnt,
      wrongs: [W(cnt + 1, "other", "경계의 정수를 포함했다."), W(cnt - 1, "other", "경계 근처의 정수를 빠뜨렸다."), W(Math.round((2 * c) / a), "formula_misuse", "구간 길이를 개수로 썼다."), W(Math.max(1, floorDiv(c + b, a)), "step_missing", "한쪽 부등식만 풀었다."), W(2 * cnt, "other", "두 경우를 중복해서 셌다.")],
      verificationJs: withParams({ a, b, c }, "let n=0; for(let x=-500;x<=500;x++){ if(Math.abs(P.a*x-P.b)<P.c) n++; }\nreturn n;"),
      trace: [T(`절댓값 부등식은 −${c} < ${a}x − ${b} < ${c} 로 쓸 수 있다.`, "Rewrite the absolute value inequality as a compound inequality."), T(`각 변에 ${b} 를 더하면 ${b - c} < ${a}x < ${b + c} 이다.`, "Add the constant to all parts."), T(`${a} 로 나누면 ${((b - c) / a).toFixed(2)} < x < ${((b + c) / a).toFixed(2)} 이다.`, "Divide by the coefficient."), T("양 끝은 포함되지 않는다.", "Endpoints are excluded."), T(`그 사이의 정수는 ${cnt} 개이다.`, "Count the integers.")],
    };
  },
  min_final_exam_score: (rng) => {
    const m = rng.int(66, 90), Tg = rng.int(80, 92); const x = ceilDiv(10 * Tg - 6 * m, 4); if (x < 40 || x > 100 || (10 * Tg - 6 * m) % 4 === 0 || m >= Tg) throw new GenFail("x");
    const cls = rng.pick(["chemistry", "world history", "statistics", "economics", "biology"]);
    return {
      stimulus: spin(rng, `In a ${cls} course, the final grade is 60% of the coursework average plus 40% of the final exam score, both on a 100-point scale. A student's coursework average is ${m}, and the student wants a final grade of at least ${Tg}.`),
      question: spin(rng, `[[What is the lowest whole-number score the student can earn on the final exam to reach that goal?|What is the minimum integer score needed on the final exam?]]`), correct: x,
      wrongs: [W(floorDiv(10 * Tg - 6 * m, 4), "step_missing", "올림하지 않고 내림했다."), W(Tg, "step_missing", "목표 점수를 그대로 답했다."), W(2 * Tg - m, "formula_misuse", "가중치를 무시하고 단순 평균으로 계산했다."), W(x + 1, "other", "경계에서 하나 더 잡았다."), W(ceilDiv(10 * Tg - 4 * m, 6), "formula_misuse", "가중치를 서로 바꿨다.")],
      verificationJs: withParams({ m, Tg }, "let x=0; while(6*P.m+4*x<10*P.Tg) x++;\nreturn x;"),
      trace: [T(`최종 점수는 0.6 × ${m} + 0.4x 이다.`, "Weighted grade expression."), T(`0.6 × ${m} = ${(0.6 * m).toFixed(1)} 이다.`, "Coursework part."), T(`0.6 × ${m} + 0.4x ≥ ${Tg} 이므로 0.4x ≥ ${(Tg - 0.6 * m).toFixed(1)} 이다.`, "Set up and isolate."), T(`x ≥ ${((Tg - 0.6 * m) / 0.4).toFixed(2)} 이다.`, "Divide by the weight."), T(`정수 점수이므로 ${x} 이다.`, "Round up.")],
    };
  },
  triangle_third_side_count: (rng) => {
    const a = rng.int(5, 15), b = rng.int(a + 2, a + 12), Pm = a + b + rng.int(6, 16); let cnt = 0; for (let x = 1; x < 100; x++) if (x > b - a && x < a + b && a + b + x < Pm) cnt++; if (cnt < 2 || cnt > 14) throw new GenFail("x");
    return {
      stimulus: spin(rng, `Two sides of a triangle measure ${a} centimeters and ${b} centimeters. The third side has a whole-number length, and the perimeter of the triangle is less than ${Pm} centimeters.`),
      question: spin(rng, `[[How many different whole-number lengths are possible for the third side?|How many whole-number values can the third side take?]]`), correct: cnt,
      wrongs: [W(a + b - (b - a) - 1, "step_missing", "둘레 조건을 무시하고 삼각형 부등식만 썼다."), W(cnt + 1, "other", "경계 값을 포함했다."), W(Math.max(1, cnt - 1), "other", "경계 근처 값을 빠뜨렸다."), W(Pm - a - b - 1, "step_missing", "삼각형 부등식을 무시하고 둘레 조건만 썼다."), W(a + b, "other", "두 변의 합을 답했다.")],
      verificationJs: withParams({ a, b, Pm }, "let n=0; for(let x=1;x<=200;x++){ const ok=x+P.a>P.b && x+P.b>P.a && P.a+P.b>x && P.a+P.b+x<P.Pm; if(ok) n++; }\nreturn n;"),
      trace: [T(`삼각형 부등식에서 ${b} − ${a} < x < ${a} + ${b} 이다.`, "Triangle inequality bounds."), T(`즉 ${b - a} < x < ${a + b} 이다.`, "Combine."), T(`둘레 조건 ${a} + ${b} + x < ${Pm} 에서 x < ${Pm - a - b} 이다.`, "Perimeter bound."), T(`두 조건을 합치면 ${b - a} < x < ${Math.min(a + b, Pm - a - b)} 이다.`, "Intersect the intervals."), T(`정수 x 는 ${cnt} 개이다.`, "Count whole numbers.")],
    };
  },
};

// ───────── compare_scenarios: 두 제약·두 경우를 맞춰 비교 ─────────
const CMP: Record<string, VFn> = {
  two_limits_min_of_floors: (rng) => {
    const w = rng.int(12, 40), v = rng.int(3, 9), Wl = rng.pick([500, 600, 800, 900, 1000]), Vl = rng.pick([120, 150, 200, 240]); const k1 = floorDiv(Wl, w), k2 = floorDiv(Vl, v); if (k1 === k2 || Wl % w === 0 || Vl % v === 0) throw new GenFail("x"); const k = Math.min(k1, k2);
    const what = rng.pick(["crates", "barrels", "boxes of tiles", "equipment cases"]);
    return {
      stimulus: spin(rng, `A delivery truck can carry at most ${Wl} pounds and at most ${Vl} cubic feet of cargo. Each of the identical ${what} weighs ${w} pounds and takes up ${v} cubic feet.`),
      question: spin(rng, `[[What is the greatest number of ${what} the truck can carry in one trip?|At most how many ${what} can be loaded?]]`), correct: k,
      wrongs: [W(Math.max(k1, k2), "condition_ignored", "한 제약만 보고 큰 쪽을 골랐다."), W(k1 + k2, "formula_misuse", "두 한도의 값을 더했다."), W(k + 1, "other", "경계를 넘는 하나를 더 실었다."), W(Math.max(1, k - 1), "other", "경계에서 하나를 덜 실었다."), W(floorDiv(Wl + Vl, w + v), "formula_misuse", "단위가 다른 양을 더했다.")],
      verificationJs: withParams({ w, v, Wl, Vl }, "let n=0; while((n+1)*P.w<=P.Wl && (n+1)*P.v<=P.Vl) n++;\nreturn n;"),
      trace: [T(`무게 제한: ${w}n ≤ ${Wl} 이므로 n ≤ ${(Wl / w).toFixed(2)} 이다.`, "Weight constraint."), T(`무게로는 최대 ${k1} 개이다.`, "Largest count by weight."), T(`부피 제한: ${v}n ≤ ${Vl} 이므로 n ≤ ${(Vl / v).toFixed(2)} 이다.`, "Volume constraint."), T(`부피로는 최대 ${k2} 개이다.`, "Largest count by volume."), T(`두 조건을 모두 만족하려면 작은 쪽인 ${k} 개이다.`, "Both constraints must hold, so take the smaller.")],
    };
  },
  speed_window_count: (rng) => {
    const t1 = rng.int(2, 4), t2 = t1 + rng.int(1, 3), D = t1 * t2 * rng.int(8, 20); let cnt = 0; for (let v = 1; v <= 400; v++) if (v * t2 >= D && v * t1 <= D) cnt++; if (cnt < 6 || cnt > 60) throw new GenFail("x");
    return {
      stimulus: spin(rng, `A coach bus must complete a ${D}-mile trip in no less than ${t1} hours and no more than ${t2} hours. The driver holds a constant speed that is a whole number of miles per hour.`),
      question: spin(rng, `[[How many different whole-number speeds would meet the schedule?|How many integer speeds, in miles per hour, allow the bus to arrive within the time window?]]`), correct: cnt,
      wrongs: [W(Math.round(D / t1 - D / t2), "formula_misuse", "양 끝 속력을 포함하지 않고 차이만 썼다."), W(cnt + 1, "other", "경계 값을 하나 더 포함했다."), W(cnt - 1, "other", "경계 값을 하나 빠뜨렸다."), W(Math.round(D / t1), "step_missing", "빠른 쪽 속력만 답했다."), W(Math.round(D / t2), "step_missing", "느린 쪽 속력만 답했다.")],
      verificationJs: withParams({ D, t1, t2 }, "let n=0; for(let v=1;v<=1000;v++){ const time=P.D/v; if(time>=P.t1-1e-9 && time<=P.t2+1e-9) n++; }\nreturn n;"),
      trace: [T(`가장 빠를 때 ${t1} 시간이므로 속력은 ${D} ÷ ${t1} = ${D / t1} mph 이다.`, "Fastest allowed speed."), T(`가장 느릴 때 ${t2} 시간이므로 속력은 ${D} ÷ ${t2} = ${(D / t2).toFixed(2)} mph 이다.`, "Slowest allowed speed."), T("시간 조건은 속력 구간으로 바뀐다.", "The time window becomes a speed interval."), T(`${(D / t2).toFixed(2)} ≤ v ≤ ${D / t1} 이다(양 끝 포함).`, "Endpoints are allowed."), T(`정수 v 는 ${cnt} 개이다.`, "Count integers.")],
    };
  },
  convert_range_count: (rng) => {
    const a = rng.int(0, 25), b = a + rng.int(4, 14); let cnt = 0; for (let F = 0; F <= 250; F++) if (5 * (F - 32) >= 9 * a && 5 * (F - 32) <= 9 * b) cnt++; if (cnt < 6) throw new GenFail("x");
    const place = rng.pick(["a museum gallery", "a wine cellar", "a greenhouse", "a server room", "an art studio"]);
    return {
      stimulus: spin(rng, `The thermostat in ${place} must keep the temperature between ${a} and ${b} degrees Celsius, inclusive. Temperature in degrees Fahrenheit is F = 9C/5 + 32, and the display shows only whole numbers of degrees Fahrenheit.`),
      question: spin(rng, `[[How many different whole-number Fahrenheit readings are within the allowed range?|How many whole-degree Fahrenheit values fall inside the required range?]]`), correct: cnt,
      wrongs: [W(b - a + 1, "unit_error", "섭씨 정수 개수를 그대로 답했다."), W(cnt + 1, "other", "경계 값을 하나 더 포함했다."), W(cnt - 1, "other", "경계 값을 하나 빠뜨렸다."), W(Math.round(((b - a) * 9) / 5), "step_missing", "구간 길이만 환산하고 양 끝 포함을 따지지 않았다."), W(Math.round((9 * b) / 5 + 32), "step_missing", "상한만 환산해 답했다.")],
      verificationJs: withParams({ a, b }, "let n=0; for(let F=-100;F<=400;F++){ const C=(F-32)*5/9; if(C>=P.a-1e-9 && C<=P.b+1e-9) n++; }\nreturn n;"),
      trace: [T(`하한 ${a}°C 는 9 × ${a}/5 + 32 = ${((9 * a) / 5 + 32).toFixed(1)}°F 이다.`, "Convert the lower limit."), T(`상한 ${b}°C 는 9 × ${b}/5 + 32 = ${((9 * b) / 5 + 32).toFixed(1)}°F 이다.`, "Convert the upper limit."), T("화씨 정수 F 가 이 구간 안(양 끝 포함)에 있어야 한다.", "F must be an integer inside the interval."), T(`${Math.ceil((9 * a) / 5 + 32 - 1e-9)} ≤ F ≤ ${Math.floor((9 * b) / 5 + 32 + 1e-9)} 이다.`, "Integer bounds."), T(`가능한 값은 ${cnt} 개이다.`, "Count.")],
    };
  },
  cost_per_person_min_people: (rng) => {
    const c = rng.int(8, 25), tg = c + rng.int(3, 12), F = rng.int(10, 60) * 10; const n = ceilDiv(F, tg - c); if (n < 8 || n > 300 || F % (tg - c) === 0) throw new GenFail("x");
    const ev = rng.pick(["a banquet hall", "a bowling alley", "a boat tour", "a cooking class", "a banquet room"]);
    return {
      stimulus: spin(rng, `A club rents ${ev} for a flat fee of ${F} dollars, and each guest also pays ${c} dollars for food. The club wants the average cost per guest, counting the flat fee, to be at most ${tg} dollars.`),
      question: spin(rng, `[[What is the smallest number of guests that makes this possible?|At least how many guests must attend?]]`), correct: n,
      wrongs: [W(floorDiv(F, tg - c), "step_missing", "올림하지 않고 내림했다."), W(ceilDiv(F, tg), "formula_misuse", "식비를 빼지 않았다."), W(ceilDiv(F, c), "formula_misuse", "참석자 식비로 고정 비용을 나눴다."), W(n + 1, "other", "경계에서 하나 더 잡았다."), W(ceilDiv(F + c, tg - c), "formula_misuse", "식비를 한 번 더 더했다.")],
      verificationJs: withParams({ F, c, tg }, "let n=1; while((P.F+P.c*n)/n>P.tg+1e-9) n++;\nreturn n;"),
      trace: [T(`손님 n 명의 총비용은 ${F} + ${c}n 이다.`, "Total cost."), T(`1인당 평균 비용은 (${F} + ${c}n)/n 이다.`, "Average per guest."), T(`(${F} + ${c}n)/n ≤ ${tg} 에서 ${F} ≤ ${tg - c}n 이다.`, "Clear the fraction."), T(`n ≥ ${F}/${tg - c} = ${(F / (tg - c)).toFixed(2)} 이다.`, "Solve."), T(`정수이므로 최소 ${n} 명이다.`, "Round up.")],
    };
  },
  savings_race_weeks: (rng) => {
    const s1 = rng.int(10, 60), a = rng.int(12, 30), s2 = s1 + rng.int(30, 160), b = rng.int(4, a - 3); const n = floorDiv(s2 - s1, a - b) + 1; if ((s2 - s1) % (a - b) === 0 || n < 4 || n > 60) throw new GenFail("x");
    const [x, y] = rng.pick([["Mia", "Leo"], ["Aria", "Sam"], ["Nora", "Kai"], ["Zoe", "Omar"]]);
    return {
      stimulus: spin(rng, `${x} has ${s1} dollars and adds ${a} dollars to her savings at the end of each week. ${y} has ${s2} dollars and adds ${b} dollars at the end of each week.`),
      question: spin(rng, `[[After how many weeks will ${x} first have strictly more money than ${y}?|What is the first whole number of weeks after which ${x}'s savings exceed ${y}'s?]]`), correct: n,
      wrongs: [W(ceilDiv(s2 - s1, a - b), "step_missing", "같아지는 순간을 넘는 것으로 착각했다."), W(n - 1, "other", "경계에서 하나 덜 잡았다."), W(n + 1, "other", "경계에서 하나 더 잡았다."), W(ceilDiv(s2, a + b), "formula_misuse", "두 증가율을 더했다."), W(ceilDiv(s2 - s1, a), "step_missing", "상대방의 증가를 무시했다.")],
      verificationJs: withParams({ s1, a, s2, b }, "let w=0; while(P.s1+P.a*w<=P.s2+P.b*w) w++;\nreturn w;"),
      trace: [T(`${x} 의 ${"w"} 주 후 금액은 ${s1} + ${a}w 이다.`, "First savings expression."), T(`${y} 의 금액은 ${s2} + ${b}w 이다.`, "Second savings expression."), T(`${s1} + ${a}w > ${s2} + ${b}w 를 푼다.`, "Write the inequality."), T(`${a - b}w > ${s2 - s1} 이므로 w > ${((s2 - s1) / (a - b)).toFixed(2)} 이다.`, "Solve."), T(`처음으로 만족하는 정수는 ${n} 이다.`, "Smallest integer satisfying it.")],
    };
  },
  at_least_twice_ratio_time: (rng) => {
    const r2 = rng.int(2, 6), r1 = 2 * r2 + rng.int(3, 9), a = rng.int(5, 30), b = rng.int(15, 60) ; const num = 2 * b - a; if (num <= 0) throw new GenFail("x"); const t = ceilDiv(num, r1 - 2 * r2); if (num % (r1 - 2 * r2) === 0 || t < 3 || t > 60) throw new GenFail("x");
    const [x, y] = rng.pick([["Tank A", "Tank B"], ["Pool A", "Pool B"], ["Vat A", "Vat B"], ["Basin A", "Basin B"]]);
    return {
      stimulus: spin(rng, `${x} holds ${a} liters of water and gains ${r1} liters each minute. ${y} holds ${b} liters and gains ${r2} liters each minute.`),
      question: spin(rng, `[[After how many whole minutes does ${x} first hold at least twice as much water as ${y}?|What is the least whole number of minutes after which ${x} contains at least twice the water in ${y}?]]`), correct: t,
      wrongs: [W(floorDiv(num, r1 - 2 * r2), "step_missing", "올림하지 않고 내림했다."), W(ceilDiv(b - a, r1 - r2), "formula_misuse", "두 배 조건을 무시하고 같아지는 시점을 구했다."), W(t + 1, "other", "경계에서 하나 더 잡았다."), W(ceilDiv(num, r1 + 2 * r2), "sign_error", "증가량을 더했다."), W(ceilDiv(a - 2 * b, r1 - 2 * r2) + 1, "sign_error", "상수항 이항에서 부호를 틀렸다.")],
      verificationJs: withParams({ a, r1, b, r2 }, "let t=0; while(P.a+P.r1*t<2*(P.b+P.r2*t)) t++;\nreturn t;"),
      trace: [T(`t 분 후 ${x} 는 ${a} + ${r1}t 리터이다.`, "First tank after t minutes."), T(`${y} 는 ${b} + ${r2}t 리터이다.`, "Second tank."), T(`조건은 ${a} + ${r1}t ≥ 2(${b} + ${r2}t) 이다.`, "Set up the inequality."), T(`${r1 - 2 * r2}t ≥ ${num} 이므로 t ≥ ${(num / (r1 - 2 * r2)).toFixed(2)} 이다.`, "Solve."), T(`가장 작은 정수는 ${t} 이다.`, "Round up.")],
    };
  },
};

// ───────── inverse: 해(정수 해·경계)를 주고 상수·계수를 거꾸로 구함 ─────────
const INV: Record<string, VFn> = {
  greatest_constant_for_integer_solution: (rng) => {
    const a = rng.int(2, 7), s = rng.int(3, 12), b = rng.int(40, 120); const c = b - a * s; if (c <= 0 || c > 90) throw new GenFail("x");
    return {
      stimulus: spin(rng, `For the inequality ${M(`${a}x + c \\le ${b}`)}, where c is a positive integer constant, the greatest integer solution is x = ${s}.`),
      question: spin(rng, `[[What is the greatest possible value of c?|What is the largest integer value that c can have?]]`), correct: c,
      wrongs: [W(b - a * (s + 1) + 1, "other", "경계값 처리 실수."), W(b - a * s - a, "other", "해 x = s+1 을 막으려는 경계로 계산했다."), W(b - s, "formula_misuse", "계수 a 를 곱하지 않았다."), W(b - a * s + 1, "other", "경계를 하나 넘겼다."), W(b / a - s, "formula_misuse", "양변을 a 로 나눠 상수를 구했다.")],
      verificationJs: withParams({ a, b, s }, "let best=-1; for(let c=1;c<=500;c++){ let g=-Infinity; for(let x=-300;x<=300;x++) if(P.a*x+c<=P.b) g=x; if(g===P.s) best=c; }\nif(best<0) throw new Error('없음'); return best;"),
      trace: [T(`x = ${s} 가 해이므로 ${a}×${s} + c ≤ ${b} 이다.`, "x = s must satisfy the inequality."), T(`즉 c ≤ ${b - a * s} 이다.`, "Upper bound on c."), T(`x = ${s + 1} 은 해가 아니므로 ${a}×${s + 1} + c > ${b} 이다.`, "The next integer must fail."), T(`즉 c > ${b - a * (s + 1)} 이다.`, "Lower bound on c."), T(`c 의 최댓값은 ${c} 이다.`, "Take the largest allowed integer.")],
    };
  },
  largest_coefficient_smallest_solution: (rng) => {
    const N = rng.int(30, 140), s = rng.int(4, 12); const a = floorDiv(N, s - 1); if (a * s <= N) throw new GenFail("x"); let cnt = 0; for (let k = 1; k < 200; k++) { let sm = Infinity; for (let x = -300; x <= 300; x++) if (k * x > N) { sm = x; break; } if (sm === s) cnt++; } if (cnt < 2) throw new GenFail("x");
    return {
      stimulus: spin(rng, `In the inequality ${M(`ax > ${N}`)}, a is a positive integer. The smallest integer solution of the inequality is x = ${s}.`),
      question: spin(rng, `[[What is the largest possible value of a?|What is the greatest integer that a can be?]]`), correct: a,
      wrongs: [W(floorDiv(N, s), "formula_misuse", "경계 x = s 에 대입해 a 를 구했다."), W(a + 1, "other", "경계에서 하나 더 잡았다."), W(cnt, "other", "가능한 a 의 개수를 답했다."), W(Math.max(1, a - 1), "other", "경계에서 하나 덜 잡았다."), W(ceilDiv(N, s - 1), "formula_misuse", "올림했다.")],
      verificationJs: withParams({ N, s }, "let best=-1; for(let a=1;a<=400;a++){ let sm=null; for(let x=-300;x<=300;x++){ if(a*x>P.N){ sm=x; break; } } if(sm===P.s) best=a; }\nif(best<0) throw new Error('없음'); return best;"),
      trace: [T(`x = ${s} 는 해이므로 ${s}a > ${N} 이다.`, "x = s satisfies the inequality."), T(`x = ${s - 1} 은 해가 아니므로 ${s - 1}a ≤ ${N} 이다.`, "The previous integer fails."), T(`즉 a ≤ ${N}/${s - 1} = ${(N / (s - 1)).toFixed(2)} 이다.`, "Upper bound for a."), T(`또 a > ${N}/${s} = ${(N / s).toFixed(2)} 이다.`, "Lower bound for a."), T(`조건을 만족하는 가장 큰 정수는 ${a} 이다.`, "Largest integer in the range.")],
    };
  },
  largest_rate_within_budget: (rng) => {
    const f = rng.int(15, 70), n = rng.int(6, 24), B = rng.int(100, 400); const r = floorDiv(B - f, n); if (r < 3 || (B - f) % n === 0) throw new GenFail("x");
    const [svc, unit] = rng.pick([["A tutoring center", "hour"], ["A kayak shop", "rental"], ["A photographer", "session"], ["A guitar teacher", "lesson"]]);
    return {
      stimulus: spin(rng, `${svc} charges a one-time registration fee of ${f} dollars plus a fixed whole-dollar price for each ${unit}. A family plans exactly ${n} ${unit}s and can spend at most ${B} dollars in total.`),
      question: spin(rng, `[[What is the greatest whole-dollar price per ${unit} the family can afford?|What is the maximum integer price per ${unit}, in dollars, that stays within the budget?]]`), correct: r,
      wrongs: [W(floorDiv(B, n), "step_missing", "등록비를 빼지 않았다."), W(r + 1, "other", "예산을 넘는 하나를 더 잡았다."), W(ceilDiv(B - f, n), "step_missing", "내림하지 않고 올림했다."), W(floorDiv(B - f, n + 1), "formula_misuse", "횟수에 등록을 한 번 더 셌다."), W(B - f - n, "formula_misuse", "나누지 않고 뺐다.")],
      verificationJs: withParams({ f, n, B }, "let r=0; while(P.f+P.n*(r+1)<=P.B) r++;\nreturn r;"),
      trace: [T(`등록비 ${f} 달러를 빼면 ${B} − ${f} = ${B - f} 달러가 남는다.`, "Budget after the fee."), T(`가격을 p 라 하면 ${n}p ≤ ${B - f} 이다.`, "Inequality for the price."), T(`p ≤ ${B - f}/${n} = ${((B - f) / n).toFixed(2)} 이다.`, "Solve."), T("가격은 정수 달러이므로 내림한다.", "The price is a whole number of dollars, so round down."), T(`최대 ${r} 달러이다.`, "Answer.")],
    };
  },
  consecutive_odd_greatest_larger: (rng) => {
    const N = rng.int(40, 220); let best = -1; for (let n = -50; n <= 300; n += 1) { if (n % 2 !== 0 && n + n + 2 < N) best = n + 2; } if (best < 10) throw new GenFail("x");
    return {
      stimulus: spin(rng, `The sum of two consecutive positive odd integers is less than ${N}.`),
      question: spin(rng, `[[What is the greatest possible value of the larger of the two integers?|What is the largest value the bigger integer can have?]]`), correct: best,
      wrongs: [W(floorDiv(N, 2), "step_missing", "홀수 조건을 무시했다."), W(best + 2, "other", "합이 N 이상이 되는 쌍을 골랐다."), W(best - 2, "other", "작은 수를 답했다."), W(floorDiv(N - 2, 2) + 1, "step_missing", "홀수 조건을 확인하지 않았다."), W(floorDiv(N - 1, 2), "formula_misuse", "두 수의 합을 2n 으로 두었다.")],
      verificationJs: withParams({ N }, "let best=-1; for(let n=1;n<=1000;n+=2){ if(n+(n+2)<P.N) best=n+2; }\nif(best<0) throw new Error('없음'); return best;"),
      trace: [T("연속한 두 홀수를 n 과 n + 2 로 둔다.", "Name the integers n and n + 2."), T(`합 2n + 2 < ${N} 이다.`, "Sum inequality."), T(`n < ${(N - 2) / 2} 이다.`, "Solve for n."), T("n 은 홀수여야 한다.", "n must be odd."), T(`n 의 최댓값에서 큰 수 n + 2 = ${best} 이다.`, "Take the greatest odd n and add 2.")],
    };
  },
  least_k_for_all_x_above: (rng) => {
    const x0 = rng.int(3, 9), c = rng.int(2, 15), M0 = rng.int(30, 90); const k = ceilDiv(M0 - c, x0); if ((M0 - c) % x0 === 0 || k < 3 || M0 <= c) throw new GenFail("x");
    return {
      stimulus: spin(rng, `The positive integer k is chosen so that ${M(`kx + ${c} \\ge ${M0}`)} is true for every real number x with x ≥ ${x0}.`),
      question: spin(rng, `[[What is the least possible value of k?|What is the smallest integer that k can be?]]`), correct: k,
      wrongs: [W(floorDiv(M0 - c, x0), "step_missing", "올림하지 않고 내림했다."), W(ceilDiv(M0, x0), "step_missing", "상수항을 이항하지 않았다."), W(k + 1, "other", "경계에서 하나 더 잡았다."), W(ceilDiv(M0 + c, x0), "sign_error", "상수항을 더했다."), W(M0 - c - x0, "formula_misuse", "나누지 않고 뺐다.")],
      verificationJs: withParams({ x0, c, M0 }, "let k=1; while(k*P.x0+P.c<P.M0) k++;\nreturn k;"),
      trace: [T("k 가 양수이므로 kx + c 는 x 가 커질수록 커진다.", "With k positive the expression increases in x."), T(`따라서 가장 작은 x = ${x0} 에서 성립하면 충분하다.`, "Check the smallest x."), T(`${x0}k + ${c} ≥ ${M0} 이다.`, "Substitute."), T(`k ≥ ${(M0 - c) / x0} = ${((M0 - c) / x0).toFixed(2)} 이다.`, "Solve."), T(`가장 작은 정수는 ${k} 이다.`, "Round up.")],
    };
  },
  count_constants_exact_solutions: (rng) => {
    const a = rng.int(2, 6), n = rng.int(3, 9), Bm = rng.int(30, 80); let cnt = 0; for (let c = 1; c <= 200; c++) { let m = 0; for (let x = 1; x <= 100; x++) if (a * x + c < Bm) m++; if (m === n) cnt++; } if (cnt < 3) throw new GenFail("x");
    return {
      stimulus: spin(rng, `The inequality ${M(`${a}x + c < ${Bm}`)} has exactly ${n} positive integer solutions, where c is a positive integer.`),
      question: spin(rng, `[[How many possible values of c are there?|For how many positive integers c does this happen?]]`), correct: cnt,
      wrongs: [W(a, "other", "계수를 답했다."), W(cnt + 1, "other", "경계 값을 하나 더 셌다."), W(Math.max(1, cnt - 1), "other", "경계 값을 하나 빠뜨렸다."), W(Bm - a * n - 1, "formula_misuse", "다음 정수 해를 막는 조건만 썼다."), W(n, "other", "해의 개수를 답했다.")],
      verificationJs: withParams({ a, n, Bm }, "let cnt=0; for(let c=1;c<=500;c++){ let m=0; for(let x=1;x<=500;x++) if(P.a*x+c<P.Bm) m++; if(m===P.n) cnt++; }\nreturn cnt;"),
      trace: [T(`양의 정수 해가 정확히 ${n} 개이므로 x = ${n} 까지 해이다.`, "Solutions are x = 1, ..., n."), T(`x = ${n} 이 해: ${a * n} + c < ${Bm} 이므로 c < ${Bm - a * n} 이다.`, "The n-th integer works."), T(`x = ${n + 1} 은 해가 아님: ${a * (n + 1)} + c ≥ ${Bm} 이므로 c ≥ ${Bm - a * (n + 1)} 이다.`, "The next integer fails."), T(`${Math.max(1, Bm - a * (n + 1))} ≤ c < ${Bm - a * n} 이다.`, "Combine the bounds."), T(`가능한 양의 정수 c 는 ${cnt} 개이다.`, "Count.")],
    };
  },
};

// ───────── chain2: 앞 단계 결과가 뒤 부등식의 입력 ─────────
const CHAIN: Record<string, VFn> = {
  data_overage_max_gb: (rng) => {
    const base = rng.pick([30, 40, 45, 50]), inc = rng.pick([8, 10, 12, 15]), per = rng.int(3, 8), B = base + rng.int(5, 60); const k = floorDiv(B - base, per); if ((B - base) % per === 0 || k < 3) throw new GenFail("x"); const ans = inc + k;
    return {
      stimulus: spin(rng, `A phone plan costs ${base} dollars per month and includes ${inc} gigabytes of data. Each additional whole gigabyte beyond that costs ${per} dollars. A customer wants to spend at most ${B} dollars in a month.`),
      question: spin(rng, `[[What is the greatest total number of gigabytes the customer can use that month?|At most how many gigabytes in total can the customer use?]]`), correct: ans,
      wrongs: [W(k, "step_missing", "포함 데이터를 더하지 않았다."), W(floorDiv(B, per), "step_missing", "기본 요금을 빼지 않았다."), W(ans + 1, "other", "예산을 넘는 하나를 더 잡았다."), W(inc + ceilDiv(B - base, per), "step_missing", "내림하지 않고 올림했다."), W(floorDiv(B - base, per) + base, "formula_misuse", "기본 요금을 데이터에 더했다.")],
      verificationJs: withParams({ base, inc, per, B }, "let gb=P.inc; while(P.base+(gb+1-P.inc)*P.per<=P.B) gb++;\nreturn gb;"),
      trace: [T(`예산에서 기본 요금을 빼면 ${B} − ${base} = ${B - base} 달러이다.`, "Money available for extra data."), T(`추가 GB x 에 대해 ${per}x ≤ ${B - base} 이다.`, "Inequality for the extra gigabytes."), T(`x ≤ ${((B - base) / per).toFixed(2)} 이므로 정수 x 의 최댓값은 ${k} 이다.`, "Round down."), T(`포함된 ${inc} GB 를 더한다.`, "Add the included data."), T(`전체는 ${inc} + ${k} = ${ans} GB 이다.`, "Total.")],
    };
  },
  weeks_to_goal_with_withdrawals: (rng) => {
    const s = rng.int(20, 80), d = rng.int(15, 40), m = rng.int(20, 60), G = rng.int(200, 700); if (4 * d - m <= 0) throw new GenFail("x"); let bal = s, wk = 0; while (bal < G && wk < 500) { wk++; bal += d; if (wk % 4 === 0) bal -= m; } if (wk < 8 || wk > 120 || wk % 4 === 0) throw new GenFail("x");
    const what = rng.pick(["a new bike", "a camera", "a concert trip", "a laptop"]);
    return {
      stimulus: spin(rng, `Jordan has ${s} dollars saved toward ${what} and adds ${d} dollars at the end of every week. At the end of every fourth week, right after adding the deposit, Jordan withdraws ${m} dollars for a bill. The goal is a balance of at least ${G} dollars.`),
      question: spin(rng, `[[After how many weeks does Jordan's balance first reach the goal?|What is the first week at whose end the balance is at least ${G} dollars?]]`), correct: wk,
      wrongs: [W(ceilDiv(G - s, d), "step_missing", "인출을 무시했다."), W(wk + 1, "other", "경계에서 하나 더 잡았다."), W(Math.max(1, wk - 1), "other", "경계에서 하나 덜 잡았다."), W(Math.round(ceilDiv(G - s, d - m / 4)), "formula_misuse", "인출액을 매주 평균으로 나눠 근사했다."), W(ceilDiv(G - s + m * floorDiv(wk, 4), d) + 1, "other", "인출 횟수 계산이 어긋났다.")],
      verificationJs: withParams({ s, d, m, G }, "let bal=P.s, w=0; while(bal<P.G){ w++; bal+=P.d; if(w%4===0) bal-=P.m; if(w>1000) throw new Error('끝나지 않음'); }\nreturn w;"),
      trace: [T(`4 주 동안 순증가는 4 × ${d} − ${m} = ${4 * d - m} 달러이다.`, "Net gain per 4-week cycle."), T(`한 주기가 끝날 때의 잔액은 ${s} + ${4 * d - m} × (주기 수) 이다.`, "Balance at cycle ends."), T(`주기 중간에는 인출 전이라 잔액이 더 높게 유지된다.`, "Within a cycle the balance is higher before the withdrawal."), T(`목표 ${G} 달러를 처음 넘는 주를 차례로 확인한다.`, "Check the weeks in order for the first time the goal is met."), T(`${wk} 주 끝에 처음으로 목표에 도달한다.`, "Answer.")],
    };
  },
  min_trips_by_capacity: (rng) => {
    const C = rng.pick([500, 600, 800, 900, 1000]), w = rng.pick([35, 45, 55, 65, 75, 85]), n = rng.int(30, 140); const per = floorDiv(C, w); if (C % w === 0 || per < 3) throw new GenFail("x"); const trips = ceilDiv(n, per); if (n % per === 0 || trips < 4) throw new GenFail("x");
    const what = rng.pick(["sacks of flour", "cases of bottled water", "paint buckets", "sandbags"]);
    return {
      stimulus: spin(rng, `A lift can raise at most ${C} pounds per trip. A crew must move ${n} identical ${what} up to a rooftop, and each one weighs ${w} pounds.`),
      question: spin(rng, `[[What is the fewest number of trips needed to move all of them?|At least how many trips must the lift make?]]`), correct: trips,
      wrongs: [W(floorDiv(n, per), "step_missing", "마지막 남은 개수를 위한 한 번을 빼먹었다."), W(ceilDiv(n * w, C) + 1, "other", "무게로 계산한 뒤 하나를 더했다."), W(ceilDiv(n, C / w), "step_missing", "한 번에 싣는 개수를 내림하지 않았다."), W(n, "step_missing", "한 번에 하나씩 옮긴다고 계산했다."), W(per, "other", "한 번에 싣는 개수를 답했다.")].filter((x) => Number.isInteger(x.v)),
      verificationJs: withParams({ C, w, n }, "let per=0; while((per+1)*P.w<=P.C) per++;\nlet left=P.n, trips=0; while(left>0){ left-=per; trips++; }\nreturn trips;"),
      trace: [T(`한 번에 ${w}x ≤ ${C} 이므로 x ≤ ${(C / w).toFixed(2)} 이다.`, "Inequality for the load of one trip."), T(`정수이므로 한 번에 최대 ${per} 개를 옮긴다.`, "Round down per trip."), T(`${n} 개를 옮기려면 ${n} ÷ ${per} = ${(n / per).toFixed(2)} 번이 필요하다.`, "Trips needed."), T("횟수는 정수여야 하므로 올림한다.", "Round up to whole trips."), T(`${trips} 번이다.`, "Answer.")],
    };
  },
  min_buses_cost: (rng) => {
    const S = rng.int(60, 220), ch = rng.int(5, 20), seat = rng.pick([30, 36, 40, 45, 48, 50]), price = rng.int(3, 9) * 50; const tot = S + ch; const buses = ceilDiv(tot, seat); if (tot % seat === 0 || buses < 3) throw new GenFail("x"); const ans = buses * price;
    return {
      stimulus: spin(rng, `A school is taking ${S} students and ${ch} adult chaperones on a field trip. Each bus seats ${seat} people, and renting one bus for the day costs ${price} dollars. Everyone must have a seat.`),
      question: spin(rng, `[[What is the least total cost, in dollars, to rent the buses?|What is the minimum amount, in dollars, the school must pay for bus rentals?]]`), correct: ans,
      wrongs: [W(floorDiv(tot, seat) * price, "step_missing", "남는 인원을 위한 버스를 빼먹었다."), W(buses, "step_missing", "버스 수만 답했다."), W(S === 0 ? 1 : ceilDiv(S, seat) * price, "step_missing", "보호자를 세지 않았다."), W((buses + 1) * price, "other", "버스를 하나 더 빌렸다."), W(tot * price, "formula_misuse", "사람 수에 가격을 곱했다.")],
      verificationJs: withParams({ S, ch, seat, price }, "const people=P.S+P.ch; let b=0; while(b*P.seat<people) b++;\nreturn b*P.price;"),
      trace: [T(`전체 인원은 ${S} + ${ch} = ${tot} 명이다.`, "Total people."), T(`버스 x 대의 좌석은 ${seat}x 이고 ${seat}x ≥ ${tot} 이어야 한다.`, "Seats must cover everyone."), T(`x ≥ ${(tot / seat).toFixed(2)} 이므로 정수 x 의 최솟값은 ${buses} 이다.`, "Round up to whole buses."), T(`비용은 버스 수 × ${price} 이다.`, "Cost per bus."), T(`${buses} × ${price} = ${ans} 달러이다.`, "Total cost.")],
    };
  },
  pages_remaining_daily_min: (rng) => {
    const D = rng.int(10, 30), k = rng.int(3, D - 3), a = rng.int(15, 60), G = rng.int(300, 900); const need = G - a * k; if (need <= 0) throw new GenFail("x"); const rem = D - k; const per = ceilDiv(need, rem); if (need % rem === 0 || per > 200) throw new GenFail("x");
    const book = rng.pick(["a reading challenge", "a library summer program", "a book club schedule", "a study plan for a long novel"]);
    return {
      stimulus: spin(rng, `${book[0].toUpperCase() + book.slice(1)} asks a student to read ${G} pages in ${D} days. In the first ${k} days, the student read ${a} pages each day, and on every one of the remaining days the student will read the same whole number of pages.`),
      question: spin(rng, `[[What is the least number of pages per day the student must read on the remaining days to meet the goal?|At least how many pages must be read each remaining day to finish on time?]]`), correct: per,
      wrongs: [W(floorDiv(need, rem), "step_missing", "올림하지 않고 내림했다."), W(ceilDiv(G, D), "step_missing", "이미 읽은 쪽수를 반영하지 않았다."), W(ceilDiv(need, D), "formula_misuse", "남은 일수가 아니라 전체 일수로 나눴다."), W(per + 1, "other", "경계에서 하나 더 잡았다."), W(ceilDiv(G - a, rem), "formula_misuse", "하루 치만 뺐다.")],
      verificationJs: withParams({ D, k, a, G }, "let per=0; while(P.a*P.k+per*(P.D-P.k)<P.G) per++;\nreturn per;"),
      trace: [T(`처음 ${k} 일 동안 읽은 쪽수는 ${a} × ${k} = ${a * k} 이다.`, "Pages already read."), T(`남은 쪽수는 ${G} − ${a * k} = ${need} 이다.`, "Pages still needed."), T(`남은 일수는 ${D} − ${k} = ${rem} 일이다.`, "Days remaining."), T(`하루 읽는 쪽수 s 는 ${rem}s ≥ ${need} 이다.`, "Inequality for the daily pages."), T(`s ≥ ${(need / rem).toFixed(2)} 이므로 정수 최솟값은 ${per} 이다.`, "Round up.")],
    };
  },
};

export const LI_SPR_B_ARCHETYPES = [
  multi({ id: "lib.ineq_applications.constraint_select", skill: SKILL, kind: KIND, operator: "constraint_select", structure: "예산·용량·평균·절댓값·삼각형 조건 같은 서로 다른 제약을 부등식으로 세워 경계에서 정수 해를 선택하는 6가지 장면", extraThinking: "제약을 스스로 부등식으로 세우고 경계 포함 여부와 정수 조건으로 해를 골라야 함 — medium 은 주어진 일차부등식 하나의 해", concepts: ["부등식 모델링", "경계 포함 여부", "정수 해 선택"], mediumSteps: 2, variants: SEL }),
  multi({ id: "lib.ineq_applications.compare_scenarios", skill: SKILL, kind: KIND, operator: "compare_scenarios", structure: "두 제약의 동시 만족·두 대상의 양을 비교하는 부등식(두 한도, 속력 구간, 단위 변환 구간, 1인당 비용, 저축 비교, 배수 비교) 6가지 장면", extraThinking: "두 조건·두 대상의 식을 같은 변수로 맞춘 뒤 공통 해를 찾아야 함 — medium 은 한 식의 부등식 풀이", concepts: ["두 식 비교", "구간의 교집합", "정수 경계"], mediumSteps: 2, variants: CMP }),
  multi({ id: "lib.ineq_applications.inverse", skill: SKILL, kind: KIND, operator: "inverse", structure: "정수 해·경계·합의 조건을 주고 숨은 상수·계수·값을 거꾸로 구하는 6가지 장면", extraThinking: "해의 조건에서 상수나 계수의 범위를 역으로 세워 극값을 고르는 역문제 — medium 은 상수를 알고 해를 구하는 정방향", concepts: ["해로부터 매개변수 역산", "부등식의 경계", "정수 극값"], mediumSteps: 2, variants: INV }),
  multi({ id: "lib.ineq_applications.chain2", skill: SKILL, kind: KIND, operator: "chain2", structure: "앞 부등식에서 구한 정수 개수·남은 양이 뒤 계산(총량·횟수·비용)의 입력이 되는 5가지 2단계 연쇄", extraThinking: "앞 부등식의 정수 해가 뒤 단계의 입력이 되는 연쇄이며 올림·내림 선택이 결과를 바꿈 — medium 은 부등식 하나만 풀이", concepts: ["연쇄 부등식", "올림·내림 판단", "총량 계산"], mediumSteps: 2, variants: CHAIN }),
];
