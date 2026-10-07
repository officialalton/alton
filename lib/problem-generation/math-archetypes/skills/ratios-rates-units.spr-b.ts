// ratios_rates_units — SPR 독립 그룹 보강(G10): 비율·속도·단위·비례 응용 hard 원형 4개 × 변형 25개(변형 하나 = 유사문항 그룹 하나).
import { GenFail, T, W, multi, type VFn } from "../spr-groups-b-kit";
import { spin, withParams } from "../text";
import { gcd } from "../rng";

const SKILL = "ratios_rates_units", KIND = "rate_applications";
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;

// ───────── unit_ratio: 단위 환산이 비율 계산 중간에 끼는 구조 ─────────
const UNIT: Record<string, VFn> = {
  tile_pack_cost: (rng) => {
    const L = rng.int(6, 20), Wd = rng.int(5, 16), s = rng.pick([4, 6, 12, 3]), n = rng.pick([4, 6, 8, 10, 12, 20, 24]), p = rng.int(12, 60);
    const tiles = ((12 * L) / s) * ((12 * Wd) / s); if (!Number.isInteger(tiles) || tiles % n !== 0 || tiles > 4000) throw new GenFail("x");
    const boxes = tiles / n, ans = boxes * p; const place = rng.pick(["patio", "kitchen floor", "hallway", "studio floor", "porch"]);
    return {
      stimulus: spin(rng, `A rectangular ${place} measures ${L} feet by ${Wd} feet and will be covered completely with square tiles that are ${s} inches on each side. The tiles are sold only in boxes of ${n} tiles, and each box costs ${p} dollars.`),
      question: spin(rng, `[[What is the total cost, in dollars, of the boxes needed to cover the ${place} exactly?|How many dollars will the boxes of tile cost if no tile is left over?]]`), correct: ans,
      wrongs: [W(boxes, "step_missing", "상자 수만 구하고 가격을 곱하지 않았다."), W(tiles * p, "step_missing", "타일 한 장 값으로 상자 값을 곱했다."), W(L * Wd * p, "unit_error", "넓이를 타일 수로 환산하지 않고 가격을 곱했다."), W(Math.round((L * Wd) / n) * p + p, "unit_error", "ft 와 inch 를 환산하지 않고 상자 수를 어림했다."), W(ans + p, "other", "상자를 하나 더 샀다.")],
      verificationJs: withParams({ L, Wd, s, n, p }, "let tiles=0; for(let r=0;r<P.L*12;r+=P.s) for(let c=0;c<P.Wd*12;c+=P.s) tiles++;\nif(tiles%P.n!==0) throw new Error('상자 단위로 나누어떨어지지 않음'); return (tiles/P.n)*P.p;"),
      trace: [T(`한 변이 ${s} inch 인 타일로 가로 ${L} ft = ${12 * L} inch 를 채우면 ${(12 * L) / s} 줄이다.`, "Convert feet to inches and count tiles along one side."), T(`세로 ${Wd} ft = ${12 * Wd} inch 는 ${(12 * Wd) / s} 장이다.`, "Count tiles along the other side."), T(`타일은 모두 ${tiles} 장이다.`, "Multiply to get the number of tiles."), T(`상자는 ${tiles} ÷ ${n} = ${boxes} 개이다.`, "Divide by the box size."), T(`비용은 ${boxes} × ${p} = ${ans} 달러이다.`, "Multiply by the price per box.")],
    };
  },
  drone_trip_minutes: (rng) => {
    const d = rng.pick([3, 6, 9, 12, 15, 18]), v = rng.pick([2, 5, 10, 25]), st = rng.int(2, 9); const mins = (d * 50) / (3 * v); if (!Number.isInteger(mins) || mins < 4) throw new GenFail("x");
    const ans = mins + st; const who = rng.pick(["A delivery drone", "A survey drone", "A rescue drone", "A camera drone"]);
    return {
      stimulus: spin(rng, `${who} flies ${d} kilometers at a constant speed of ${v} meters per second, and it hovers for ${st} minutes at a checkpoint along the way.`),
      question: spin(rng, `[[How many minutes does the whole trip take, including the stop?|What is the total time, in minutes, from takeoff to arrival?]]`), correct: ans,
      wrongs: [W(mins, "step_missing", "정지 시간을 더하지 않았다."), W((d * 1000) / v / 60 / 60 + st, "unit_error", "초를 분으로 바꿀 때 60 으로 두 번 나눴다."), W((d * 1000) / v + st, "unit_error", "초 단위 시간에 분 단위 정지 시간을 더했다."), W(mins * 60 + st, "unit_error", "시간을 분으로 잘못 환산했다."), W(d * 1000 / (v * 60) + st + 1, "other", "계산 실수.")],
      verificationJs: withParams({ d, v, st }, "let sec=0, m=0; while(m<P.d*1000){ m+=P.v; sec++; }\nif(sec%60!==0) throw new Error('분 단위로 나누어떨어지지 않음'); return sec/60+P.st;"),
      trace: [T(`${d} km = ${d * 1000} m 이다.`, "Convert kilometers to meters."), T(`비행 시간은 ${d * 1000} ÷ ${v} = ${(d * 1000) / v} 초이다.`, "Divide distance by speed to get seconds."), T(`${(d * 1000) / v} 초 = ${mins} 분이다.`, "Convert seconds to minutes."), T(`정지 ${st} 분을 더한다.`, "Add the stop."), T(`전체 시간은 ${mins} + ${st} = ${ans} 분이다.`, "Total time.")],
    };
  },
  ink_cartridge_days: (rng) => {
    const m = rng.int(2, 8), p = rng.pick([50, 100, 150, 200, 250]), D = rng.int(5, 40), k = rng.int(2, 5); const c = (D * m * p) / (100 * k); if (!Number.isInteger(c) || c < 5 || c > 200) throw new GenFail("x");
    const place = rng.pick(["An office", "A school library", "A print shop", "A law firm"]);
    return {
      stimulus: spin(rng, `${place} printer uses ${m} milliliters of ink for every 100 pages printed. Each ink cartridge holds ${c} milliliters, and the staff prints ${p} pages per day.`),
      question: spin(rng, `[[For how many days will ${k} full cartridges last?|How many days can ${k} cartridges keep the printer going at this rate?]]`), correct: D,
      wrongs: [W(Math.round((k * c) / m), "step_missing", "100 쪽 단위를 쪽 수로 환산하지 않았다."), W(Math.round(((k * c) / m) * 100), "unit_error", "쪽당 잉크로 환산하지 않고 100 을 곱했다."), W(Math.round((c / m) * (100 / p)), "step_missing", "카트리지 수 k 를 곱하지 않았다."), W(D * k, "other", "카트리지 수를 한 번 더 곱했다."), W(Math.round(D / k), "other", "카트리지 수로 나눴다.")],
      verificationJs: withParams({ m, c, p, k }, "const totalMl=P.k*P.c; let days=0, ink=0; while(true){ const need=P.m*P.p/100; if(ink+need>totalMl+1e-9) break; ink+=need; days++; }\nreturn days;"),
      trace: [T(`하루 사용량은 ${p} 쪽 ÷ 100 × ${m} mL = ${(p * m) / 100} mL 이다.`, "Daily ink use from the per-100-page rate."), T(`카트리지 ${k} 개의 잉크는 ${k} × ${c} = ${k * c} mL 이다.`, "Total ink available."), T(`일수 = 전체 잉크 ÷ 하루 사용량이다.`, "Days equal total ink divided by daily use."), T(`${k * c} ÷ ${(p * m) / 100} = ${D} 이다.`, "Divide."), T(`${D} 일 동안 쓸 수 있다.`, "Answer.")],
    };
  },
  broth_cartons: (rng) => {
    const c = rng.pick([2, 3, 5]), S = rng.pick([10, 14, 18, 22, 26, 30, 34]), f = rng.pick([24, 32, 48]); const oz = (c * S * 8) / 4; const cartons = Math.ceil(oz / f - 1e-9); if (oz % f === 0 || oz % 1 !== 0) throw new GenFail("x");
    const dish = rng.pick(["soup", "risotto", "stew", "curry"]);
    return {
      stimulus: spin(rng, `A recipe for ${dish} makes 4 servings and needs ${c} cups of broth. Broth is sold only in cartons that each hold ${f} fluid ounces, and 1 cup is 8 fluid ounces. A caterer will make ${S} servings.`),
      question: spin(rng, `[[What is the fewest number of cartons the caterer must buy?|How many cartons must be bought so that there is enough broth for all ${S} servings?]]`), correct: cartons,
      wrongs: [W(Math.floor(oz / f), "step_missing", "남는 분량을 위해 올림하지 않고 내림했다."), W(Math.ceil((c * S) / 4 / f), "unit_error", "컵을 fl oz 로 환산하지 않았다."), W(Math.ceil((c * S * 8) / f), "step_missing", "4 인분 기준으로 나누지 않았다."), W(cartons + 1, "other", "여유분을 한 상자 더 샀다."), W(Math.ceil(oz / 8), "unit_error", "상자 크기 대신 컵 단위로 나눴다.")],
      verificationJs: withParams({ c, S, f }, "const need=P.c*(P.S/4)*8; let n=0, have=0; while(have<need){ have+=P.f; n++; }\nreturn n;"),
      trace: [T(`${S} 인분은 4 인분의 ${S / 4} 배이므로 육수는 ${c} × ${S / 4} = ${(c * S) / 4} 컵이다.`, "Scale the recipe by the number of servings."), T(`1 컵 = 8 fl oz 이므로 ${oz} fl oz 가 필요하다.`, "Convert cups to fluid ounces."), T(`상자 하나는 ${f} fl oz 이다.`, "Carton size."), T(`${oz} ÷ ${f} = ${(oz / f).toFixed(2)} 이므로 정수 상자가 아니다.`, "The quotient is not a whole number."), T(`부족하지 않으려면 올림하여 ${cartons} 상자이다.`, "Round up to whole cartons.")],
    };
  },
  metal_block_mass: (rng) => {
    const a = rng.pick([5, 10, 20, 25, 8, 4]), b = rng.pick([10, 20, 25, 5, 40]), c = rng.pick([10, 25, 20, 5, 50]), d = rng.pick([2, 3, 5, 7, 8]); const g = a * b * c * d; if (g % 1000 !== 0 || g / 1000 < 1 || g / 1000 > 300 || a === b) throw new GenFail("x");
    const mat = rng.pick(["aluminum", "steel", "titanium", "brass", "copper"]);
    return {
      stimulus: spin(rng, `A solid ${mat} block is a rectangular prism measuring ${a} centimeters by ${b} centimeters by ${c} centimeters. The ${mat} has a density of ${d} grams per cubic centimeter.`),
      question: spin(rng, `[[What is the mass of the block, in kilograms?|How many kilograms does the block weigh?]]`), correct: g / 1000,
      wrongs: [W(g, "unit_error", "그램을 킬로그램으로 환산하지 않았다."), W(g / 1000 / d, "step_missing", "밀도를 곱하지 않았다."), W(g / 100, "unit_error", "1 kg = 100 g 으로 환산했다."), W((a * b * c) / 1000, "step_missing", "부피만 kg 단위로 바꿨다."), W(g / 1000 + d, "other", "밀도를 더했다.")],
      verificationJs: withParams({ a, b, c, d }, "let vol=0; for(let i=0;i<P.a;i++) for(let j=0;j<P.b;j++) for(let k=0;k<P.c;k++) vol++;\nconst grams=vol*P.d; if(grams%1000!==0) throw new Error('kg 단위 정수 아님'); return grams/1000;"),
      trace: [T(`부피는 ${a} × ${b} × ${c} = ${a * b * c} cm³ 이다.`, "Volume of the prism."), T(`질량(g)은 부피 × 밀도 = ${a * b * c} × ${d} = ${g} g 이다.`, "Mass in grams from density."), T("1 kg = 1000 g 이다.", "Recall the conversion."), T(`${g} ÷ 1000 = ${g / 1000} kg 이다.`, "Convert to kilograms."), T(`블록의 질량은 ${g / 1000} kg 이다.`, "Answer.")],
    };
  },
  currency_exchange_net: (rng) => {
    const D = rng.int(20, 90), f = rng.int(2, 8), r = rng.pick([4, 5, 6, 7, 9, 12]), S = rng.int(30, 200); const ans = (D - f) * r - S; if (ans < 5 || D % 5 === 0 && rng.chance(0.5)) throw new GenFail("x");
    const cur = rng.pick(["zloty", "pesos", "lira", "kroner", "rand"]);
    return {
      stimulus: `At an exchange booth, a traveler converts ${D} dollars to ${cur}. The booth first takes a flat fee of ${f} dollars, and the remaining dollars are exchanged at ${r} ${cur} per dollar. The traveler then buys a gift that costs ${S} ${cur}.`,
      question: spin(rng, `[[How many ${cur} does the traveler have left after buying the gift?|After the purchase, how many ${cur} remain?]]`), correct: ans,
      wrongs: [W(D * r - S, "step_missing", "수수료를 빼지 않았다."), W((D - f) * r, "step_missing", "선물 값을 빼지 않았다."), W(D * r - f - S, "unit_error", "수수료(달러)를 환전 후 금액에서 뺐다."), W((D - f) * r + S, "sign_error", "선물 값을 더했다."), W((D - f) / r - S, "formula_misuse", "환율로 곱하지 않고 나눴다.")],
      verificationJs: withParams({ D, f, r, S }, "let units=0; for(let i=0;i<P.D-P.f;i++) units+=P.r;\nreturn units-P.S;"),
      trace: [T(`수수료를 뺀 환전 금액은 ${D} − ${f} = ${D - f} 달러이다.`, "Dollars left after the fee."), T(`환율 ${r} 을 곱하면 ${(D - f) * r} ${cur} 이다.`, "Apply the exchange rate."), T(`선물 값 ${S} 을 뺀다.`, "Subtract the gift cost."), T(`${(D - f) * r} − ${S} = ${ans} 이다.`, "Compute."), T(`남는 돈은 ${ans} ${cur} 이다.`, "Answer.")],
    };
  },
};

// ───────── compare_scenarios: 두 대상의 속도·비율 비교 ─────────
const COMP: Record<string, VFn> = {
  lap_lead_distance: (rng) => {
    const dv = rng.int(1, 4), v2 = rng.int(3, 7), v1 = v2 + dv, L = dv * rng.int(40, 120); const t = L / dv, ans = v1 * t; if (ans > 5000 || t < 20) throw new GenFail("x");
    return {
      stimulus: spin(rng, `Two runners start together at the same point on a circular track that is ${L} meters around, and both run in the same direction. One runs at a steady ${v1} meters per second and the other at a steady ${v2} meters per second.`),
      question: spin(rng, `[[At the first moment the faster runner is exactly one full lap ahead, how many meters has the faster runner run?|When the faster runner has gained exactly one lap on the slower one, what total distance, in meters, has the faster runner covered?]]`), correct: ans,
      wrongs: [W(v2 * t, "other", "느린 주자가 달린 거리를 답했다."), W(L, "step_missing", "한 바퀴 길이를 답했다."), W(t, "step_missing", "걸린 시간(초)을 답했다."), W(v1 * (L / (v1 + v2)), "formula_misuse", "반대 방향 만남 공식(속력의 합)을 썼다."), W(ans + L, "other", "한 바퀴를 더 더했다.")],
      verificationJs: withParams({ L, v1, v2 }, "let t=0; while(P.v1*t-P.v2*t<P.L) t++;\nif(P.v1*t-P.v2*t!==P.L) throw new Error('정확히 한 바퀴 차이가 아님'); return P.v1*t;"),
      trace: [T(`같은 방향이므로 두 주자의 간격은 속력 차 ${v1} − ${v2} = ${dv} m/s 로 벌어진다.`, "Closing speed in the same direction is the difference."), T(`한 바퀴 ${L} m 를 벌리는 시간은 ${L} ÷ ${dv} = ${t} 초이다.`, "Time to gain one lap."), T(`빠른 주자의 거리는 속력 × 시간이다.`, "Distance equals speed times time."), T(`${v1} × ${t} = ${ans} m 이다.`, "Compute."), T(`답은 ${ans} m 이다.`, "Answer.")],
    };
  },
  fill_and_drain_hours: (rng) => {
    const [a, b] = rng.pick([[2, 3], [3, 4], [4, 6], [3, 6], [6, 9], [4, 5], [5, 6], [6, 8], [10, 15], [12, 18], [8, 12], [6, 10], [5, 10], [4, 12], [9, 12], [8, 10], [15, 20], [12, 16]] as const); const num = a * b, den = b - a; const ans = num / den; if (!Number.isInteger(ans) || ans > 60) throw new GenFail("x");
    const thing = rng.pick(["reservoir", "water tank", "swimming pool", "storage tank"]);
    return {
      stimulus: spin(rng, `A pipe can fill an empty ${thing} in ${a} hours. A drain can empty a full ${thing} in ${b} hours. Both the pipe and the drain are opened at the same time while the ${thing} is empty.`),
      question: spin(rng, `[[How many hours will it take for the ${thing} to be completely full?|After how many hours is the ${thing} first completely full?]]`), correct: ans,
      wrongs: [W(a, "step_missing", "배수구를 무시했다."), W((a * b) / (a + b), "sign_error", "배수를 채우는 속도로 더했다."), W(b - a, "formula_misuse", "시간을 직접 뺐다."), W(a + b, "formula_misuse", "시간을 더했다."), W(ans + a, "other", "계산 실수.")],
      verificationJs: withParams({ a, b }, "let t=0; while(true){ t++; const level=t/P.a - t/P.b; if(Math.abs(level-1)<1e-9) return t; if(t>1000) throw new Error('도달하지 않음'); }"),
      trace: [T(`급수관은 한 시간에 전체의 1/${a} 를 채운다.`, "Fill rate of the pipe."), T(`배수구는 한 시간에 전체의 1/${b} 를 비운다.`, "Drain rate."), T(`동시에 열면 순 채움 속도는 1/${a} − 1/${b} = ${b - a}/${a * b} 이다.`, "Net rate."), T(`가득 차려면 1 ÷ ${b - a}/${a * b} 시간이 걸린다.`, "Invert the net rate."), T(`${a * b}/${b - a} = ${ans} 시간이다.`, "Answer.")],
    };
  },
  fuel_cost_gap: (rng) => {
    const g1 = rng.pick([20, 25, 30, 32, 40]), g2 = rng.pick([12, 15, 16, 18, 24]); if (g1 <= g2) throw new GenFail("x"); const l = lcm(g1, g2); const D = l * rng.int(1, 3), p = rng.int(3, 6); if (D > 900) throw new GenFail("x");
    const ans = (D / g2 - D / g1) * p; if (!Number.isInteger(ans)) throw new GenFail("x");
    return {
      stimulus: spin(rng, `A hybrid car gets ${g1} miles per gallon and a pickup truck gets ${g2} miles per gallon. Both drive the same ${D}-mile route, and gasoline costs ${p} dollars per gallon.`),
      question: spin(rng, `[[How many more dollars does the truck spend on gasoline than the hybrid for the route?|What is the difference, in dollars, between the truck's fuel cost and the hybrid's fuel cost for the trip?]]`), correct: ans,
      wrongs: [W((D / g2) * p, "step_missing", "트럭의 연료비만 구했다."), W(D / g2 - D / g1, "step_missing", "갤런 차이에 가격을 곱하지 않았다."), W((D / g1) * p, "step_missing", "하이브리드의 연료비를 답했다."), W(((D / g2 + D / g1) * p), "sign_error", "두 연료비를 더했다."), W((g1 - g2) * p, "formula_misuse", "연비 차이에 가격을 곱했다.")],
      verificationJs: withParams({ g1, g2, D, p }, "let gh=0, gt=0; for(let m=P.g1; m<=P.D; m+=P.g1) gh++; for(let m=P.g2; m<=P.D; m+=P.g2) gt++;\nif(gh*P.g1!==P.D||gt*P.g2!==P.D) throw new Error('갤런이 정수가 아님'); return (gt-gh)*P.p;"),
      trace: [T(`하이브리드는 ${D} ÷ ${g1} = ${D / g1} 갤런을 쓴다.`, "Gallons used by the hybrid."), T(`트럭은 ${D} ÷ ${g2} = ${D / g2} 갤런을 쓴다.`, "Gallons used by the truck."), T(`갤런 차이는 ${D / g2 - D / g1} 이다.`, "Difference in gallons."), T(`갤런당 ${p} dollars 이므로 차이는 ${D / g2 - D / g1} × ${p} 이다.`, "Multiply by the price."), T(`${ans} 달러이다.`, "Answer.")],
    };
  },
  copier_jam_total_minutes: (rng) => {
    const a = rng.pick([30, 40, 50, 60]), b = rng.pick([15, 20, 25, 10]), t = rng.int(3, 12), extra = rng.int(2, 15); const N = (a + b) * t + b * extra; if (N > 990 || a <= b) throw new GenFail("x"); const ans = t + extra;
    return {
      stimulus: spin(rng, `Copier A prints ${a} pages per minute and copier B prints ${b} pages per minute. Both start together on a ${N}-page report, but copier A jams after ${t} minutes and is out of service for the rest of the job.`),
      question: spin(rng, `[[How many minutes after the start is the report finished?|What is the total time, in minutes, from the start until all ${N} pages are printed?]]`), correct: ans,
      wrongs: [W(Math.round(N / (a + b)), "step_missing", "복사기 A 가 계속 작동한다고 가정했다."), W(N / b, "step_missing", "복사기 B 만 처음부터 쓴다고 가정했다."), W(extra, "step_missing", "A 가 멈추기 전의 시간을 더하지 않았다."), W(t * 2 + extra, "other", "계산 실수."), W(ans + t, "other", "멈춘 시간을 두 번 더했다.")],
      verificationJs: withParams({ a, b, t, N }, "let done=0, min=0; while(done<P.N){ min++; done+= (min<=P.t? P.a+P.b : P.b); }\nif(done!==P.N) throw new Error('정확히 끝나지 않음'); return min;"),
      trace: [T(`처음 ${t} 분 동안 두 대가 함께 인쇄한다: (${a} + ${b}) × ${t} = ${(a + b) * t} 쪽이다.`, "Pages printed while both work."), T(`남은 쪽수는 ${N} − ${(a + b) * t} = ${b * extra} 쪽이다.`, "Pages remaining after the jam."), T(`이후에는 B 만 분당 ${b} 쪽을 인쇄한다.`, "Only B continues."), T(`남은 시간은 ${b * extra} ÷ ${b} = ${extra} 분이다.`, "Remaining time."), T(`전체 시간은 ${t} + ${extra} = ${ans} 분이다.`, "Total time.")],
    };
  },
  opposite_trains_meet: (rng) => {
    const v1 = rng.pick([60, 70, 80, 90, 100, 120]), v2 = rng.pick([40, 50, 60, 75, 90]), k = rng.int(1, 6); const D = ((v1 + v2) * k) / 2; if (!Number.isInteger(D) || D > 900 || v1 === v2) throw new GenFail("x"); const ans = 30 * k;
    const [x, y] = rng.pick([["Station A", "Station B"], ["Dover", "Linton"], ["Harbor City", "Ridgeway"], ["Eastfield", "Westport"]]);
    return {
      stimulus: spin(rng, `${x} and ${y} are ${D} kilometers apart. At the same moment, one train leaves ${x} toward ${y} at ${v1} kilometers per hour, and another train leaves ${y} toward ${x} on a parallel track at ${v2} kilometers per hour.`),
      question: spin(rng, `[[How many minutes after departure do the two trains meet?|After how many minutes will the trains pass each other?]]`), correct: ans,
      wrongs: [W(ans / 60, "unit_error", "시간 단위로 답했다(분으로 환산하지 않음)."), W(Math.round((D / Math.abs(v1 - v2)) * 60), "formula_misuse", "속력의 차로 나눴다."), W(Math.round((D / v1) * 60), "step_missing", "한 열차의 속력만 썼다."), W(Math.round((D / (v1 + v2)) * 100), "unit_error", "1 시간을 100 분으로 환산했다."), W(ans + 30, "other", "계산 실수.")],
      verificationJs: withParams({ D, v1, v2 }, "let gap=P.D, min=0; while(gap>1e-9){ min++; gap-=(P.v1+P.v2)/60; if(min>5000) throw new Error('만나지 않음'); }\nif(Math.abs(gap)>1e-9) throw new Error('분 단위 정수에서 만나지 않음'); return min;"),
      trace: [T(`마주 보고 달리므로 두 열차가 가까워지는 속력은 ${v1} + ${v2} = ${v1 + v2} km/h 이다.`, "Closing speed is the sum."), T(`만나는 시간은 ${D} ÷ ${v1 + v2} = ${D / (v1 + v2)} 시간이다.`, "Time in hours."), T("1 시간 = 60 분 이다.", "Convert hours to minutes."), T(`${D / (v1 + v2)} × 60 = ${ans} 분이다.`, "Compute."), T(`두 열차는 출발 ${ans} 분 뒤에 만난다.`, "Answer.")],
    };
  },
  round_trip_average_speed: (rng) => {
    const k = rng.int(1, 6), v1 = 10 * k, v2 = 15 * k; const avg = 12 * k; const d = lcm(v1, v2) * rng.int(1, 2); if (d > 900) throw new GenFail("x");
    const who = rng.pick(["A courier", "A hiker on a bike path", "A delivery van", "A ferry"]);
    return {
      stimulus: spin(rng, `${who} travels ${d} miles from town A to town B at ${v1} miles per hour and returns along the same route at ${v2} miles per hour, without any stops.`),
      question: spin(rng, `[[What is the average speed, in miles per hour, for the entire round trip?|For the whole round trip, what is the average speed in miles per hour?]]`), correct: avg,
      wrongs: [W((v1 + v2) / 2, "formula_misuse", "두 속력의 산술평균을 답했다."), W(v1 + v2, "formula_misuse", "속력을 더했다."), W(Math.round((2 * d) / (d / v1)), "step_missing", "가는 시간만으로 평균을 구했다."), W(Math.round(Math.sqrt(v1 * v2)), "formula_misuse", "기하평균을 썼다."), W(avg + k, "other", "계산 실수.")],
      verificationJs: withParams({ d, v1, v2 }, "const t=P.d/P.v1+P.d/P.v2; const avg=2*P.d/t;\nif(Math.abs(avg-Math.round(avg))>1e-9) throw new Error('정수 아님'); return Math.round(avg);"),
      trace: [T(`갈 때 걸린 시간은 ${d} ÷ ${v1} = ${d / v1} 시간이다.`, "Time going."), T(`올 때 걸린 시간은 ${d} ÷ ${v2} = ${d / v2} 시간이다.`, "Time returning."), T(`전체 시간은 ${d / v1 + d / v2} 시간이다.`, "Total time."), T(`전체 거리는 2 × ${d} = ${2 * d} 마일이다.`, "Total distance."), T(`평균 속력 = ${2 * d} ÷ ${d / v1 + d / v2} = ${avg} mph 이다.`, "Average speed is total distance over total time.")],
    };
  },
};

// ───────── inverse: 결과(일부 양)를 주고 입력·전체·비율을 역으로 구함 ─────────
const INV: Record<string, VFn> = {
  tank_capacity_from_fraction: (rng) => {
    const b = rng.pick([4, 5, 8, 10]), a = rng.int(1, b - 1), r = rng.int(3, 20), t = rng.int(4, 30); const num = r * t * b; if (num % a !== 0 || gcd(a, b) !== 1) throw new GenFail("x"); const ans = num / a; if (ans > 3000) throw new GenFail("x");
    const thing = rng.pick(["tank", "cistern", "aquarium", "rain barrel"]);
    return {
      stimulus: spin(rng, `A hose delivers ${r} liters of water per minute into an empty ${thing}. After ${t} minutes, the ${thing} is exactly ${a}/${b} full.`),
      question: spin(rng, `[[What is the full capacity of the ${thing}, in liters?|How many liters can the ${thing} hold when full?]]`), correct: ans,
      wrongs: [W(r * t, "step_missing", "현재 담긴 양을 용량으로 답했다."), W((r * t * a) / b, "formula_misuse", "분수를 곱했다(나눠야 함)."), W(r * t + (r * t * a) / b, "other", "담긴 양에 분수만큼 더했다."), W(ans - r * t, "other", "남은 양을 답했다."), W((r * t * b) / (b - a), "formula_misuse", "남은 비율로 나눴다.")],
      verificationJs: withParams({ r, t, a, b }, "const inTank=P.r*P.t; for(let cap=1;cap<=5000;cap++){ if(inTank*P.b===cap*P.a) return cap; }\nthrow new Error('없음');"),
      trace: [T(`${t} 분 동안 들어온 물은 ${r} × ${t} = ${r * t} L 이다.`, "Water delivered so far."), T(`이 양이 전체의 ${a}/${b} 이다.`, "That amount is a fraction of the capacity."), T(`용량을 C 라 하면 C × ${a}/${b} = ${r * t} 이다.`, "Set up the equation."), T(`C = ${r * t} × ${b}/${a} 이다.`, "Solve for the capacity."), T(`C = ${ans} L 이다.`, "Answer.")],
    };
  },
  map_scale_second_road: (rng) => {
    const w = rng.pick([1.5, 2.5, 4.5, 3, 6, 2]), s = rng.pick([8, 10, 12, 16, 20]), x = rng.int(3, 15); const miles = w * s; if (!Number.isInteger(miles) || !Number.isInteger(s * x) || x === w) throw new GenFail("x"); const ans = s * x;
    const [f1, f2] = rng.pick([["canal", "bike path"], ["highway", "county road"], ["railway", "river"], ["trail", "ridge road"]]);
    return {
      stimulus: spin(rng, `On a regional map, a ${f1} that is ${miles} miles long is drawn ${w} inches long. A ${f2} on the same map is drawn ${x} inches long.`),
      question: spin(rng, `[[How many miles long is the actual ${f2}?|What is the actual length of the ${f2}, in miles?]]`), correct: ans,
      wrongs: [W(miles + x, "formula_misuse", "지도 길이를 더하는 식으로 풀었다."), W(Math.round(miles / x), "formula_misuse", "비를 거꾸로 사용했다."), W(s, "step_missing", "축척(1 inch 당 거리)만 답했다."), W(Math.round(x / s), "formula_misuse", "축척의 역수를 곱했다."), W(Math.round(miles * x), "formula_misuse", "실제 길이에 지도 길이를 곱했다.")],
      verificationJs: withParams({ miles, w, x }, "const perInch=P.miles/P.w; return perInch*P.x;"),
      trace: [T(`지도 ${w} inch 가 실제 ${miles} mi 이다.`, "Relate map length to actual length."), T(`1 inch 당 실제 거리는 ${miles} ÷ ${w} = ${s} mi 이다.`, "Find the scale."), T(`둘째 길은 지도에서 ${x} inch 이다.`, "Map length of the second road."), T(`실제 길이 = ${s} × ${x} 이다.`, "Multiply by the scale."), T(`${ans} mi 이다.`, "Answer.")],
    };
  },
  speed_from_extra_distance: (rng) => {
    const sp = rng.int(8, 60), t = rng.int(1, 6), T2 = t + rng.int(2, 5), H = rng.int(3, 12); const M = sp * (T2 - t); if (H === T2 || H === t) throw new GenFail("x"); const ans = sp * H;
    const who = rng.pick(["A cyclist", "A bus", "A boat", "A snowmobile"]);
    return {
      stimulus: spin(rng, `${who} moves at a constant speed. The distance it covers in ${T2} hours is ${M} miles more than the distance it covers in ${t} hours.`),
      question: spin(rng, `[[At this speed, how many miles does it cover in ${H} hours?|How far, in miles, will it travel in ${H} hours at this constant speed?]]`), correct: ans,
      wrongs: [W(sp, "step_missing", "속력만 답했다."), W(M, "step_missing", "주어진 차이를 답했다."), W(Math.round(M / (T2 + t)) * H, "formula_misuse", "시간의 합으로 나눠 속력을 구했다."), W(M + H, "formula_misuse", "차이에 시간을 더했다."), W(Math.round(M * (H / T2)), "formula_misuse", "전체 시간에 대한 비율로 계산했다.")],
      verificationJs: withParams({ T2, t, M, H }, "let speed=-1; for(let s=1;s<=500;s++){ if(s*P.T2-s*P.t===P.M){ speed=s; break; } }\nif(speed<0) throw new Error('속력 없음'); return speed*P.H;"),
      trace: [T(`${T2} 시간과 ${t} 시간의 이동 거리 차는 ${M} mi 이다.`, "The extra distance is covered in the extra time."), T(`시간 차는 ${T2} − ${t} = ${T2 - t} 시간이다.`, "Difference in time."), T(`속력 = ${M} ÷ ${T2 - t} = ${sp} mph 이다.`, "Speed equals extra distance over extra time."), T(`${H} 시간 동안 ${sp} × ${H} 를 간다.`, "Apply the speed to the new time."), T(`${ans} mi 이다.`, "Answer.")],
    };
  },
  workers_remaining_job: (rng) => {
    const Wk = rng.pick([6, 8, 9, 10, 12, 15]), D = rng.int(10, 30), d = rng.int(3, D - 3), D2 = rng.int(2, 12); const rem = Wk * (D - d); if (rem % D2 !== 0) throw new GenFail("x"); const ans = rem / D2; if (ans === Wk || ans > 200) throw new GenFail("x");
    const job = rng.pick(["paint a long fence", "pave a parking lot", "assemble a batch of cabinets", "repair a boardwalk"]);
    return {
      stimulus: spin(rng, `A crew of ${Wk} workers, all working at the same constant rate, can ${job} in ${D} days. After the crew has worked for ${d} days, the manager wants the remaining work finished in exactly ${D2} more days.`),
      question: spin(rng, `[[How many workers, in total, must be working during those last ${D2} days?|What is the total number of workers needed for the remaining ${D2} days?]]`), correct: ans,
      wrongs: [W(Wk, "step_missing", "처음 인원을 그대로 답했다."), W(ans - Wk, "other", "추가로 필요한 인원만 답했다."), W(Math.round((Wk * D) / D2), "step_missing", "이미 한 작업량을 빼지 않았다."), W(Math.round((Wk * d) / D2), "formula_misuse", "한 일의 양으로 계산했다."), W(Math.round(Wk * (D - d)), "step_missing", "남은 기간으로 나누지 않았다.")],
      verificationJs: withParams({ Wk, D, d, D2 }, "const total=P.Wk*P.D; const done=P.Wk*P.d; const left=total-done; for(let n=1;n<=500;n++){ if(n*P.D2===left) return n; }\nthrow new Error('정수 인원 없음');"),
      trace: [T(`전체 작업량은 ${Wk} × ${D} = ${Wk * D} 인·일 이다.`, "Total work in worker-days."), T(`${d} 일 동안 한 작업은 ${Wk} × ${d} = ${Wk * d} 인·일 이다.`, "Work already done."), T(`남은 작업은 ${Wk * D} − ${Wk * d} = ${rem} 인·일 이다.`, "Remaining work."), T(`${D2} 일에 끝내려면 인원은 ${rem} ÷ ${D2} 이다.`, "Divide by the remaining days."), T(`필요한 인원은 ${ans} 명이다.`, "Answer.")],
    };
  },
  gear_teeth_from_revolutions: (rng) => {
    const a = rng.pick([24, 30, 36, 40, 48, 60]), ra = rng.pick([8, 10, 12, 15, 20]), rb = rng.pick([6, 9, 16, 18, 24, 25]); const num = a * ra; if (num % rb !== 0 || rb === ra) throw new GenFail("x"); const ans = num / rb; if (ans === a || ans > 200) throw new GenFail("x");
    return {
      stimulus: spin(rng, `Two gears are meshed so that their teeth engage. Gear A has ${a} teeth. While gear A makes ${ra} complete revolutions, gear B makes ${rb} complete revolutions.`),
      question: spin(rng, `[[How many teeth does gear B have?|What is the number of teeth on gear B?]]`), correct: ans,
      wrongs: [W(Math.round((a * rb) / ra) || 1, "formula_misuse", "비례를 거꾸로 세웠다."), W(a + (ra - rb), "formula_misuse", "차이를 더했다."), W(a, "step_missing", "A 의 잇수를 그대로 답했다."), W(num, "step_missing", "나누지 않고 맞물린 이 수만 구했다."), W(Math.round(num / (ra + rb)), "formula_misuse", "회전 수의 합으로 나눴다.")],
      verificationJs: withParams({ a, ra, rb }, "const engaged=P.a*P.ra; for(let b=1;b<=500;b++){ if(b*P.rb===engaged) return b; }\nthrow new Error('없음');"),
      trace: [T(`기어 A 가 ${ra} 회전하며 맞물린 이의 수는 ${a} × ${ra} = ${num} 이다.`, "Teeth passing the contact point for A."), T("맞물린 두 기어에서 지나간 이의 수는 같다.", "Meshed gears pass the same number of teeth."), T(`B 의 이 수를 n 이라 하면 n × ${rb} = ${num} 이다.`, "Set up for B."), T(`n = ${num} ÷ ${rb} 이다.`, "Solve."), T(`B 의 이는 ${ans} 개이다.`, "Answer.")],
    };
  },
  muffin_batch_from_leftover: (rng) => {
    const c = rng.pick([2, 3, 4, 5]), m = rng.pick([6, 8, 12, 10]), bag = rng.int(12, 40), left = rng.int(1, 6); const used = bag - left; if (used % c !== 0) throw new GenFail("x"); const ans = (used / c) * m; if (ans > 900) throw new GenFail("x");
    const what = rng.pick(["muffins", "pancakes", "scones", "biscuits"]);
    return {
      stimulus: spin(rng, `A bakery recipe uses ${c} cups of flour for every ${m} ${what}. A baker starts with a ${bag}-cup bag of flour, makes as many ${what} as possible using whole recipes, and has exactly ${left} cups of flour left over.`),
      question: spin(rng, `[[How many ${what} did the baker make?|What is the total number of ${what} produced?]]`), correct: ans,
      wrongs: [W((bag / c) * m, "step_missing", "남은 밀가루를 빼지 않았다."), W(used / c, "step_missing", "배치 수만 구했다."), W(used * m, "step_missing", "레시피 단위로 나누지 않았다."), W(Math.round(((used / c) * m) / 2), "other", "계산 실수."), W(((bag + left) / c) * m, "sign_error", "남은 밀가루를 더했다.")],
      verificationJs: withParams({ c, m, bag, left }, "let flour=P.bag, made=0; while(flour-P.left>=P.c){ flour-=P.c; made+=P.m; }\nif(flour!==P.left) throw new Error('정확히 남지 않음'); return made;"),
      trace: [T(`사용한 밀가루는 ${bag} − ${left} = ${used} 컵이다.`, "Flour actually used."), T(`레시피 한 번에 ${c} 컵을 쓴다.`, "Flour per batch."), T(`배치 수는 ${used} ÷ ${c} = ${used / c} 이다.`, "Number of batches."), T(`한 배치는 ${m} 개이다.`, "Pieces per batch."), T(`${used / c} × ${m} = ${ans} 개이다.`, "Total pieces.")],
    };
  },
};

// ───────── chain2: 앞 단계 결과가 뒤 단계 비율의 입력 ─────────
const CHAIN: Record<string, VFn> = {
  pace_miles_in_time: (rng) => {
    const pace = rng.pick([6, 7.5, 8, 9, 10, 12]), hrs = rng.int(1, 4), extraMin = rng.pick([0, 15, 30, 45]); const totMin = hrs * 60 + extraMin; const miles = totMin / pace; if (!Number.isInteger(miles) || miles < 5 || miles > 60 || extraMin === 0) throw new GenFail("x");
    const paceTxt = pace % 1 === 0 ? `${pace} minutes` : `${Math.floor(pace)} minutes 30 seconds`;
    const sport = rng.pick(["runner", "race walker", "trail jogger", "marathon trainee"]);
    return {
      stimulus: spin(rng, `A ${sport} keeps a constant pace of ${paceTxt} per mile. The ${sport} runs for ${hrs} hours and ${extraMin} minutes.`),
      question: spin(rng, `[[How many miles does the ${sport} cover?|What total distance, in miles, is covered?]]`), correct: miles,
      wrongs: [W(Math.round(totMin * pace), "formula_misuse", "페이스를 속력처럼 곱했다."), W(Math.round((hrs * 60) / pace), "step_missing", "추가 시간(분)을 빼먹었다."), W(Math.round(totMin / 60 / pace), "unit_error", "분을 시간으로 바꾼 뒤 다시 페이스로 나눴다."), W(Math.round(miles + extraMin / pace), "other", "추가 시간을 두 번 셌다."), W(Math.round(hrs * 60 + extraMin - pace), "formula_misuse", "페이스를 뺐다.")],
      verificationJs: withParams({ hrs, extraMin, paceMin: Math.floor(pace), paceSec: pace % 1 ? 30 : 0 }, "const paceSec=P.paceMin*60+P.paceSec; const totalSec=(P.hrs*60+P.extraMin)*60; let miles=0, used=0; while(used+paceSec<=totalSec){ used+=paceSec; miles++; }\nif(used!==totalSec) throw new Error('정확히 끝나지 않음'); return miles;"),
      trace: [T(`${hrs} 시간 ${extraMin} 분 = ${totMin} 분이다.`, "Convert the total time to minutes."), T(`한 마일에 ${pace} 분이 걸린다.`, "Pace per mile."), T("거리 = 전체 시간 ÷ 마일당 시간이다.", "Distance is total time divided by time per mile."), T(`${totMin} ÷ ${pace} = ${miles} 이다.`, "Divide."), T(`${miles} 마일이다.`, "Answer.")],
    };
  },
  tiered_rate_total: (rng) => {
    const h = rng.int(2, 5), a = rng.int(40, 90), b = rng.int(a + 10, a + 60), T2 = h + rng.int(2, 6); const ans = a * h + b * (T2 - h); if (ans > 2000) throw new GenFail("x");
    const trade = rng.pick(["An electrician", "A consultant", "A plumber", "A piano tuner"]);
    return {
      stimulus: spin(rng, `${trade} charges ${a} dollars per hour for the first ${h} hours of a job. For every additional hour after that, the rate is ${b} dollars per hour. A customer's job takes ${T2} hours.`),
      question: spin(rng, `[[What is the total charge, in dollars, for the job?|How many dollars does the customer owe?]]`), correct: ans,
      wrongs: [W(a * T2, "step_missing", "모든 시간에 첫 요금을 적용했다."), W(b * T2, "step_missing", "모든 시간에 추가 요금을 적용했다."), W(b * T2 - a * h, "formula_misuse", "추가 시간 요금 계산이 틀렸다."), W(a * h + b * T2, "other", "추가 시간을 전체 시간으로 계산했다."), W(Math.round(((a + b) / 2) * T2), "formula_misuse", "평균 요금을 썼다.")],
      verificationJs: withParams({ h, a, b, T2 }, "let total=0; for(let hour=1;hour<=P.T2;hour++) total+= hour<=P.h ? P.a : P.b;\nreturn total;"),
      trace: [T(`처음 ${h} 시간은 시간당 ${a} dollars 이다.`, "First tier."), T(`첫 구간 요금은 ${h} × ${a} = ${h * a} 달러이다.`, "First-tier charge."), T(`추가 시간은 ${T2} − ${h} = ${T2 - h} 시간이다.`, "Hours in the second tier."), T(`추가 요금은 ${T2 - h} × ${b} = ${(T2 - h) * b} 달러이다.`, "Second-tier charge."), T(`합계는 ${h * a} + ${(T2 - h) * b} = ${ans} 달러이다.`, "Total.")],
    };
  },
  trip_split_fuel_each: (rng) => {
    const D = rng.pick([200, 250, 300, 350, 400, 450, 500]), Lp = rng.pick([5, 8, 10, 12]), p = rng.int(2, 3), n = rng.pick([2, 4, 5, 6, 8]); const liters = (D * Lp) / 100; const total = liters * p; if (!Number.isInteger(liters) || total % n !== 0) throw new GenFail("x"); const ans = total / n;
    const vehicle = rng.pick(["minivan", "carpool sedan", "camping van", "shuttle"]);
    return {
      stimulus: spin(rng, `A ${vehicle} uses ${Lp} liters of fuel for every 100 kilometers. It is driven ${D} kilometers on a trip, and fuel costs ${p} dollars per liter. The fuel bill is split equally among ${n} passengers.`),
      question: spin(rng, `[[How many dollars does each passenger pay?|What is each passenger's share of the fuel bill, in dollars?]]`), correct: ans,
      wrongs: [W(total, "step_missing", "승객 수로 나누지 않았다."), W(liters, "step_missing", "연료량(L)만 구했다."), W(Math.round((D * Lp * p) / n), "unit_error", "100 km 단위를 환산하지 않았다."), W(Math.round(liters / n), "step_missing", "가격을 곱하지 않았다."), W(ans + p, "other", "계산 실수.")],
      verificationJs: withParams({ D, Lp, p, n }, "let liters=0; for(let km=100;km<=P.D;km+=100) liters+=P.Lp;\nif(P.D%100!==0){ liters+=P.Lp*(P.D%100)/100; }\nconst cost=liters*P.p; if(cost%P.n!==0) throw new Error('나누어떨어지지 않음'); return cost/P.n;"),
      trace: [T(`${D} km 는 100 km 의 ${D / 100} 배이므로 연료는 ${Lp} × ${D / 100} = ${liters} L 이다.`, "Fuel used from the per-100-km rate."), T(`연료비는 ${liters} × ${p} = ${total} 달러이다.`, "Total fuel cost."), T(`${n} 명이 똑같이 나눈다.`, "Split equally."), T(`${total} ÷ ${n} = ${ans} 이다.`, "Divide."), T(`한 사람당 ${ans} 달러이다.`, "Answer.")],
    };
  },
  typists_pages: (rng) => {
    const a = rng.pick([40, 50, 60, 45]), b = rng.pick([30, 35, 55, 25]), t1 = rng.int(10, 40), w = rng.pick([250, 300, 500, 400]); let t2 = rng.int(10, 40); for (let i = 0; i < 40 && (a * t1 + b * t2) % w !== 0; i++) t2 = t2 >= 40 ? 10 : t2 + 1; const words = a * t1 + b * t2; if (words % w !== 0 || a === b) throw new GenFail("x"); const ans = words / w; if (ans < 3 || ans > 200) throw new GenFail("x");
    const [n1, n2] = rng.pick([["Dana", "Eli"], ["Priya", "Marcus"], ["Lena", "Tomas"], ["Noor", "Jack"]]);
    return {
      stimulus: spin(rng, `${n1} types ${a} words per minute for ${t1} minutes. Then ${n2} continues the same document and types ${b} words per minute for ${t2} minutes. Each printed page holds ${w} words.`),
      question: spin(rng, `[[How many full pages does their typing fill?|How many pages of ${w} words are completed by the two typists together?]]`), correct: ans,
      wrongs: [W(Math.round(words), "step_missing", "쪽 수로 환산하지 않고 단어 수를 답했다."), W(Math.round((a * t1) / w) + Math.round((b * t2) / w), "step_missing", "각자 쪽 수를 따로 내림했다."), W(Math.round(((a + b) * (t1 + t2)) / w), "formula_misuse", "속도 합에 전체 시간을 곱했다."), W(Math.round((a * t1) / w), "step_missing", "첫 번째 사람만 계산했다."), W(ans + 1, "other", "계산 실수.")],
      verificationJs: withParams({ a, b, t1, t2, w }, "let words=0; for(let m=0;m<P.t1;m++) words+=P.a; for(let m=0;m<P.t2;m++) words+=P.b;\nif(words%P.w!==0) throw new Error('쪽 단위로 나누어떨어지지 않음'); return words/P.w;"),
      trace: [T(`${n1}: ${a} × ${t1} = ${a * t1} 단어이다.`, "Words typed by the first typist."), T(`${n2}: ${b} × ${t2} = ${b * t2} 단어이다.`, "Words typed by the second typist."), T(`합계는 ${words} 단어이다.`, "Total words."), T(`한 쪽에 ${w} 단어이다.`, "Words per page."), T(`${words} ÷ ${w} = ${ans} 쪽이다.`, "Pages.")],
    };
  },
  battery_two_speed_hours: (rng) => {
    const s0 = rng.pick([5, 10, 15, 20]), p = rng.pick([20, 25, 30]), h = rng.int(1, 2), q = rng.pick([5, 10, 8, 4]); const after = s0 + p * h; const rest = 100 - after; if (rest <= 0 || rest % q !== 0) throw new GenFail("x"); const ans = h + rest / q;
    const dev = rng.pick(["phone", "tablet", "laptop", "e-reader", "scooter battery"]);
    return {
      stimulus: spin(rng, `A ${dev} is at ${s0}% charge when it is plugged in. It gains ${p} percentage points per hour for the first ${h} hours and then only ${q} percentage points per hour until it reaches 100%.`),
      question: spin(rng, `[[How many hours in all does it take to reach 100% charge?|What is the total charging time, in hours, from ${s0}% to 100%?]]`), correct: ans,
      wrongs: [W((100 - s0) / p, "step_missing", "처음 속도로만 계산했다."), W((100 - s0) / q, "step_missing", "나중 속도로만 계산했다."), W(rest / q, "step_missing", "첫 구간 시간을 더하지 않았다."), W(h + (100 - s0) / q, "other", "충전된 양을 빼지 않았다."), W(Math.round(h + rest / p), "formula_misuse", "나중 구간에도 처음 속도를 썼다.")],
      verificationJs: withParams({ s0, p, h, q }, "let charge=P.s0, hours=0; while(charge<100){ charge+= hours<P.h ? P.p : P.q; hours++; if(hours>500) throw new Error('끝나지 않음'); }\nif(charge!==100) throw new Error('정확히 100 이 아님'); return hours;"),
      trace: [T(`처음 ${h} 시간 동안 ${p} × ${h} = ${p * h} 포인트가 올라 ${after}% 가 된다.`, "Charge after the fast phase."), T(`남은 충전량은 100 − ${after} = ${rest} 포인트이다.`, "Charge still needed."), T(`느린 속도 ${q} 포인트/시간이다.`, "Slow rate."), T(`느린 구간은 ${rest} ÷ ${q} = ${rest / q} 시간이다.`, "Slow phase duration."), T(`전체 ${h} + ${rest / q} = ${ans} 시간이다.`, "Total time.")],
    };
  },
  map_scale_travel_time: (rng) => {
    const s = rng.pick([5, 8, 10, 12, 15, 20]), d = rng.pick([3, 4, 6, 7.5, 9, 12]), v = rng.pick([30, 40, 45, 60]); const miles = s * d; const hrs = miles / v; if (!Number.isInteger(miles) || !Number.isInteger(hrs) || hrs < 2) throw new GenFail("x");
    const vehicle = rng.pick(["bus", "tour coach", "delivery truck", "school van"]);
    return {
      stimulus: spin(rng, `On a road map, 1 inch represents ${s} miles. The route from a depot to a warehouse measures ${d} inches on the map, and a ${vehicle} drives the whole route at a constant ${v} miles per hour.`),
      question: spin(rng, `[[How many hours does the drive take?|What is the driving time, in hours?]]`), correct: hrs,
      wrongs: [W(miles, "step_missing", "실제 거리를 답했다."), W(Math.round(d / v), "step_missing", "축척을 적용하지 않았다."), W(Math.round(v * d / s), "formula_misuse", "축척과 속력을 잘못 결합했다."), W(Math.round(miles * v), "formula_misuse", "거리에 속력을 곱했다."), W(hrs + 1, "other", "계산 실수.")],
      verificationJs: withParams({ s, d, v }, "const miles=P.s*P.d; let hours=0, covered=0; while(covered<miles){ covered+=P.v; hours++; }\nif(covered!==miles) throw new Error('정확히 도착하지 않음'); return hours;"),
      trace: [T(`지도 1 inch 는 ${s} mi 이다.`, "Map scale."), T(`경로 ${d} inch 의 실제 거리는 ${d} × ${s} = ${miles} mi 이다.`, "Actual route length."), T(`속력은 ${v} mph 이다.`, "Driving speed."), T("시간 = 거리 ÷ 속력이다.", "Time is distance over speed."), T(`${miles} ÷ ${v} = ${hrs} 시간이다.`, "Answer.")],
    };
  },
  download_minutes: (rng) => {
    const S = rng.pick([2, 3, 4, 6, 9, 12]), r = rng.pick([25, 50, 20, 40, 10]); const sec = (S * 1000) / r; const mins = sec / 60; if (!Number.isInteger(mins) || mins < 3 || mins > 400) throw new GenFail("x");
    const what = rng.pick(["a video game update", "a movie file", "a software package", "a photo archive"]);
    return {
      stimulus: spin(rng, `A student downloads ${what} that is ${S} gigabytes in size. The connection is steady at ${r} megabytes per second, and 1 gigabyte is 1000 megabytes.`),
      question: spin(rng, `[[How many minutes does the download take?|How long, in minutes, will the download take?]]`), correct: mins,
      wrongs: [W(sec, "unit_error", "초 단위 시간을 그대로 답했다."), W(Math.round(S / r * 60), "unit_error", "GB 를 MB 로 바꾸지 않았다."), W(Math.round((S * 1000) / r / 60 / 60) || 1, "unit_error", "분으로 바꾸며 60 으로 두 번 나눴다."), W(Math.round(S * 1024 / r / 60), "unit_error", "1 GB = 1024 MB 로 계산했다."), W(Math.round((S * 100) / r / 6), "unit_error", "1 GB = 100 MB 로 계산했다.")],
      verificationJs: withParams({ S, r }, "const totalMb=P.S*1000; let sec=0, got=0; while(got<totalMb){ got+=P.r; sec++; }\nif(sec%60!==0) throw new Error('분 단위 정수 아님'); return sec/60;"),
      trace: [T(`${S} GB = ${S * 1000} MB 이다.`, "Convert gigabytes to megabytes."), T(`속도는 ${r} MB/s 이다.`, "Download rate."), T(`걸린 시간은 ${S * 1000} ÷ ${r} = ${sec} 초이다.`, "Time in seconds."), T("60 초 = 1 분 이다.", "Seconds to minutes."), T(`${sec} ÷ 60 = ${mins} 분이다.`, "Answer.")],
    };
  },
};

export const RR_SPR_B_ARCHETYPES = [
  multi({ id: "rrb.rate_applications.unit_ratio", skill: SKILL, kind: KIND, operator: "unit_ratio", structure: "비율(속도·밀도·가격·소비율)에 길이·시간·무게·부피 단위 환산이 중간에 끼어드는 6가지 장면의 계산", extraThinking: "서로 다른 단위의 양을 하나의 비율로 묶어 환산 순서를 스스로 정해야 함 — medium 은 단위가 이미 맞춰진 한 번의 비례 계산", concepts: ["비율 해석", "단위 환산", "다단계 계산"], mediumSteps: 2, variants: UNIT }),
  multi({ id: "rrb.rate_applications.compare_scenarios", skill: SKILL, kind: KIND, operator: "compare_scenarios", structure: "두 대상의 속도·비율을 결합 속도(합·차·순 채움률)나 총량 차이로 비교하는 6가지 장면", extraThinking: "두 비율을 같은 기준으로 맞춰 합치거나 차를 구하는 비교 설계 — medium 은 비율 하나를 적용", concepts: ["상대 속도·결합 비율", "두 경우 비교", "단위 맞추기"], mediumSteps: 2, variants: COMP }),
  multi({ id: "rrb.rate_applications.inverse", skill: SKILL, kind: KIND, operator: "inverse", structure: "결과(일부 양·차이·남은 양)로부터 전체량·속력·인원·축척을 거꾸로 구한 뒤 다시 적용하는 6가지 장면", extraThinking: "주어진 결과에서 숨은 비율을 역산해야 하는 역문제 — medium 은 알려진 비율로 결과를 바로 계산", concepts: ["비율 역산", "전체와 부분", "비례식"], mediumSteps: 2, variants: INV }),
  multi({ id: "rrb.rate_applications.chain2", skill: SKILL, kind: KIND, operator: "chain2", structure: "앞 단계에서 구한 양이 뒤 단계 비율의 입력이 되는 7가지 2단계 연쇄(구간 요금·페이스·분담·충전·축척·전송)", extraThinking: "앞 단계 결과가 뒤 단계 비율의 입력이 되는 연쇄이며 중간 단위가 바뀜 — medium 은 한 번의 비율 적용", concepts: ["연쇄 비율", "구간별 비율", "단위 환산"], mediumSteps: 2, variants: CHAIN }),
];
