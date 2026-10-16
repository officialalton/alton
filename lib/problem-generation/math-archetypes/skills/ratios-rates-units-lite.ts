// ratios_rates_units easy/medium 원형(lite) 4개 틀 — 비례식(recipe·map)·연쇄 단위 환산(time·rate). hard 원형(rr.*)은 ratios-rates-units.ts.
import { GenFail } from "../types";
import { finish, withParams } from "../text";
import { sem, withOpen, OPEN_SCI, OPEN_GEN } from "../c-kit";
import { spin } from "../text";
import type { LiteArchetype } from "../c-lite";
import type { DistractorKind } from "../../review";

const SKILL = "ratios_rates_units";
const W = (v: number, kind: DistractorKind, reason: string) => ({ v, kind, reason });
const MIX = [["flour", "sugar", "cups"], ["red paint", "blue paint", "liters"], ["sand", "cement", "buckets"], ["concentrate", "water", "milliliters"], ["rice", "beans", "ounces"], ["oats", "raisins", "cups"], ["blue beads", "white beads", "beads"], ["lemon juice", "water", "tablespoons"], ["potting soil", "compost", "scoops"], ["almonds", "dried cranberries", "handfuls"]] as const;
const MAPS = [["A map", "inches", "miles"], ["A road atlas", "centimeters", "kilometers"], ["A blueprint", "inches", "feet"], ["A trail map", "centimeters", "kilometers"], ["A city plan", "inches", "miles"], ["A scale model", "centimeters", "meters"]] as const;

export const RR_LITE: LiteArchetype[] = [
  {
    id: "rr.proportion.recipe", skill: SKILL, kind: "proportion", frame: "recipe", levels: ["easy", "medium"], structure: "재료 두 가지의 비(a:b)로 한 재료의 양에서 다른 재료의 양(easy) / 전체 양으로 한 재료의 양(medium)",
    generate(rng, level) {
      const a = rng.int(2, 9), b = rng.int(2, 9), k = rng.int(2, level === "easy" ? 9 : 14); if (a === b || gcd2(a, b) !== 1) throw new GenFail("x"); const [x, y, unit] = rng.pick(MIX);
      const given = a * k, ans = level === "easy" ? b * k : a * k, total = (a + b) * k; if (total > 990) throw new GenFail("x");
      const stimulus = withOpen(rng, OPEN_SCI, spin(rng, level === "easy" ? `A mixture uses ${x} and ${y} in the ratio ${a} to ${b}. A batch contains ${given} ${unit} of ${x}.` : `A mixture uses ${x} and ${y} in the ratio ${a} to ${b}. A batch contains ${total} ${unit} altogether.`));
      const out = finish(rng, { stimulus, question: spin(rng, level === "easy" ? `[[How many ${unit} of ${y} are in the batch?|How much ${y}, in ${unit}, does the batch contain?|Find the number of ${unit} of ${y} in the batch.]]` : `[[How many ${unit} of ${x} are in the batch?|How much ${x}, in ${unit}, does the batch contain?|Find the number of ${unit} of ${x} in the batch.]]`), correct: ans,
        wrongs: level === "easy" ? [W(given + (b - a), "formula_misuse", "비를 차이로 해석해 더했다."), W((given * a) / b, "formula_misuse", "비를 거꾸로 적용했다."), W(b, "step_missing", "배수 k 를 곱하지 않았다."), W(given + b, "formula_misuse", "비의 항을 그대로 더했다.")]
          : [W(total - ans, "other", "다른 재료의 양을 답했다."), W(total / (a + b) * b, "other", "다른 재료의 양을 답했다(반대 항 사용)."), W(total / 2, "condition_ignored", "두 재료가 같은 양이라고 보았다."), W(a, "step_missing", "한 묶음 양만 답했다.")],
        verificationJs: withParams(level === "easy" ? { a, b, given, easy: 1 } : { a, b, given: total, easy: 0 }, "for(let k=1;k<=1000;k++){ if(P.easy){ if(P.a*k===P.given) return P.b*k; } else { if((P.a+P.b)*k===P.given) return P.a*k; } }\nthrow new Error('없음');"),
        trace: level === "easy" ? [[`${a} : ${b} = ${given} : x 이므로 한 묶음은 ${given} ÷ ${a} = ${k} 이다.`, "Find the size of one part."], [`${y} = ${b} × ${k} = ${ans} 이다.`, "Scale the other term."]] : [[`비의 합은 ${a} + ${b} = ${a + b} 이므로 한 묶음은 ${total} ÷ ${a + b} = ${k} 이다.`, "Find the size of one part."], [`${x} = ${a} × ${k} = ${ans} 이다.`, "Scale the term."]], variant: level === "easy" ? "one_part_known" : "total_known" });
      return sem(out, [{ v: a, words: ["ratio"] }, { v: b, words: ["ratio"] }], { words: [level === "easy" ? y : x], forbid: [] });
    },
  },
  {
    id: "rr.proportion.map", skill: SKILL, kind: "proportion", frame: "map", levels: ["easy", "medium"], structure: "축척으로 실제 거리(easy) / 한 쌍의 지점으로 축척을 구해 다른 쌍의 거리(medium)",
    generate(rng, level) {
      const d = rng.int(2, 9), sc = rng.pick([5, 10, 12, 20, 25, 30, 40, 50]), e = rng.int(2, 15); if (d === e || sc === d || sc === e) throw new GenFail("x"); const [who, u1, u2] = rng.pick(MAPS); const D = d * sc, ans = e * sc; if (D > 990 || ans > 990) throw new GenFail("x");
      const stimulus = withOpen(rng, OPEN_GEN, spin(rng, level === "easy" ? `[[${who} uses a scale in which ${d} ${u1} on the drawing represent ${D} ${u2} in real life.|On ${who.charAt(0).toLowerCase() + who.slice(1)}, a length of ${d} ${u1} stands for ${D} ${u2} on the ground.|The scale of ${who.charAt(0).toLowerCase() + who.slice(1)} says that ${d} ${u1} on paper correspond to ${D} ${u2} in reality.]]` : `[[${who} shows two towns ${d} ${u1} apart. Their real distance is ${D} ${u2}. Two other towns are ${e} ${u1} apart on the same drawing.|On ${who.charAt(0).toLowerCase() + who.slice(1)}, two towns are ${d} ${u1} apart, and they are really ${D} ${u2} apart. Another pair of towns is ${e} ${u1} apart on the same drawing.|Two towns that are really ${D} ${u2} apart appear ${d} ${u1} apart on ${who.charAt(0).toLowerCase() + who.slice(1)}; two other towns appear ${e} ${u1} apart on it.]]`));
      const out = finish(rng, { stimulus, question: spin(rng, level === "easy" ? `[[How many ${u2} do ${e} ${u1} on the drawing represent?|What real distance, in ${u2}, is represented by ${e} ${u1}?|Find the real distance, in ${u2}, for ${e} ${u1} on the drawing.|A length of ${e} ${u1} on the drawing equals how many ${u2} in reality?]]` : `[[What is the real distance between the other two towns, in ${u2}?|How many ${u2} apart are the other two towns?|Find the real distance, in ${u2}, between the other two towns.|In reality, how far apart, in ${u2}, are the other two towns?]]`), correct: ans,
        wrongs: [W(D + (e - d), "formula_misuse", "차이를 더해 (덧셈으로) 계산했다."), W((D * d) / e, "formula_misuse", "비를 거꾸로 적용했다."), W(e * d, "step_missing", "축척 값을 곱하지 않았다."), W(ans + sc, "other", "계산 실수.")],
        verificationJs: withParams({ d, D, e }, "for(let s=1;s<=1000;s++){ if(P.d*s===P.D) return P.e*s; }\nthrow new Error('없음');"),
        trace: [[`축척은 ${D} ÷ ${d} = ${sc} ${u2} / ${u1} 이다.`, "Scale per unit."], [`${e} × ${sc} = ${ans} ${u2} 이다.`, "Apply the scale."]], variant: level === "easy" ? "scale_given" : "scale_from_pair" });
      return sem(out, [], { words: [u2], forbid: [] });
    },
  },
  {
    id: "rr.chained_conversion.time", skill: SKILL, kind: "chained_conversion", frame: "time", levels: ["easy", "medium"], structure: "시간 단위 연쇄 환산 — easy: 단위 둘(분·초), medium: 일·시간·분 등 큰 단위",
    generate(rng, level) {
      const sets: readonly (readonly [string, string, string, number, number])[] = level === "easy" ? [["hours", "minutes", "seconds", 60, 60], ["minutes", "seconds", "milliseconds", 60, 1000]] : [["days", "hours", "minutes", 24, 60], ["weeks", "days", "hours", 7, 24], ["days", "hours", "minutes", 24, 60], ["weeks", "days", "hours", 7, 24]];
      const [u1, u2, u3, f1, f2] = rng.pick(sets); const n = rng.int(2, level === "easy" ? 6 : 9); const ans = n * f1 * f2; if (ans > 99999 || n === f1 || n === f2) throw new GenFail("x"); const ctx = rng.pick(["A concert", "A road trip", "A science fair", "A hiking trail walk", "A film festival", "A tournament"]);
      const s1 = u1.replace(/s$/, ""), s2 = u2.replace(/s$/, "");
      const stimulus = withOpen(rng, OPEN_GEN, spin(rng, `[[${ctx} lasts ${n} ${u1}. There are ${f1} ${u2} in 1 ${s1}, and there are ${f2} ${u3} in 1 ${s2}.|The length of ${ctx.charAt(0).toLowerCase() + ctx.slice(1)} is ${n} ${u1}. Remember that 1 ${s1} has ${f1} ${u2} and that 1 ${s2} has ${f2} ${u3}.|From start to finish, ${ctx.charAt(0).toLowerCase() + ctx.slice(1)} takes ${n} ${u1}; 1 ${s1} equals ${f1} ${u2}, and 1 ${s2} equals ${f2} ${u3}.]]`));
      const out = finish(rng, { stimulus, question: spin(rng, `[[How many ${u3} does it last?|The event lasts how many ${u3}?|Find the number of ${u3} it lasts.|Expressed in ${u3}, how long does it last?]]`), correct: ans,
        wrongs: [W(n * f1, "step_missing", `둘째 환산(${u2}→${u3})을 하지 않았다.`), W(n * f2, "step_missing", `첫째 환산(${u1}→${u2})을 하지 않았다.`), W(n * (f1 + f2), "formula_misuse", "환산 계수를 곱하지 않고 더했다."), W((n * f1) / f2, "formula_misuse", "둘째 환산에서 곱하지 않고 나눴다.")],
        verificationJs: withParams({ n, f1, f2 }, "let a=0; for(let i=0;i<P.n;i++) for(let j=0;j<P.f1;j++) for(let k=0;k<P.f2;k++) a++;\nreturn a;"),
        trace: [[`1 ${s1} = ${f1} ${u2} 이므로 ${n} × ${f1} = ${n * f1} ${u2} 이다.`, "First conversion."], [`1 ${s2} = ${f2} ${u3} 이므로 ${n * f1} × ${f2} = ${ans} ${u3} 이다.`, "Second conversion."]], variant: level === "easy" ? "small_units" : "large_units" });
      return sem(out, [], { words: [u3], forbid: [] });
    },
  },
  {
    id: "rr.chained_conversion.rate", skill: SKILL, kind: "chained_conversion", frame: "rate", levels: ["easy", "medium"], structure: "비율 단위 환산 — easy: 분당→시간당 한 번, medium: 단위를 둘 이상 바꾸는 속도 환산",
    generate(rng, level) {
      type S = readonly [string, string, string, string, number, number, number, readonly string[]];
      const eSets: S[] = [["pages per minute", "pages per hour", "1 hour = 60 minutes", "mul", 60, 1, 1, ["A printer", "A copier", "A scanner"]], ["cups per hour", "cups per day", "1 day = 24 hours", "mul", 24, 1, 1, ["A coffee shop", "A cafe", "A tea stall"]], ["meters per second", "meters per minute", "1 minute = 60 seconds", "mul", 60, 1, 1, ["A cyclist", "A sprinter", "A drone"]], ["gallons per hour", "gallons per day", "1 day = 24 hours", "mul", 24, 1, 1, ["A pump", "A fountain", "A leaking pipe"]]];
      const mSets: S[] = [["kilometers per hour", "meters per minute", "1 kilometer = 1000 meters and 1 hour = 60 minutes", "chain", 1000, 1, 60, ["A cyclist", "A bus", "A train"]], ["liters per minute", "milliliters per second", "1 liter = 1000 milliliters and 1 minute = 60 seconds", "chain", 1000, 1, 60, ["A pump", "A faucet", "A sprinkler"]], ["meters per second", "meters per hour", "1 hour = 60 minutes and 1 minute = 60 seconds", "chain", 60, 60, 1, ["A robot", "A conveyor", "A snail-cam rover"]], ["cubic centimeters per minute", "liters per hour", "1 liter = 1000 cubic centimeters and 1 hour = 60 minutes", "chain", 60, 1, 1000, ["A drip line", "A syringe pump", "A cooling unit"]]];
      const [from, to, fact, , f1, f2, g, ctxs] = rng.pick(level === "easy" ? eSets : mSets); const v = level === "easy" ? rng.int(2, 60) : (g === 1000 ? rng.int(2, 19) * 50 : rng.int(2, 40)); const ans = (v * f1 * f2) / g;
      if (!Number.isInteger(ans) || ans > 99999 || v === ans || v === f1 || v === f2 || v === g) throw new GenFail("x"); const ctx = rng.pick(ctxs);
      const stimulus = withOpen(rng, OPEN_GEN, spin(rng, `[[${ctx} works at a constant rate of ${v} ${from}. Recall that ${fact}.|At a steady ${v} ${from}, ${ctx.charAt(0).toLowerCase() + ctx.slice(1)} keeps going. Remember that ${fact}.|${ctx}'s rate is ${v} ${from}, and it never changes. You may use the fact that ${fact}.]]`));
      const out = finish(rng, { stimulus, question: spin(rng, `[[What is this rate in ${to}?|Express the rate in ${to}.|Convert the rate to ${to}.|Rewrite the rate using ${to}. What is its value?]]`), correct: ans,
        wrongs: [W(v * f1, "step_missing", "환산 중 한 단계만 적용했다."), W(v * f1 * f2 * (g === 1 ? 1 : 1), "formula_misuse", "나눗셈 단계 없이 계수를 곱했다."), W(Math.round((v * g) / (f1 * f2) * 100) / 100, "formula_misuse", "환산 계수를 거꾸로 적용했다."), W(ans + v, "other", "계산 실수."), W(ans * 2, "formula_misuse", "환산 결과를 두 배로 계산했다."), W(v + f1, "formula_misuse", "계수를 더했다.")],
        verificationJs: withParams({ v, f1, f2, g }, "let r=0; for(let i=0;i<P.v;i++) r+=P.f1*P.f2/P.g;\nif(Math.abs(r-Math.round(r))>1e-9) throw new Error('정수 아님'); return Math.round(r);"),
        trace: level === "easy" ? [[`단위 시간이 ${f1} 배로 길어지므로 양도 ${f1} 배이다.`, "Scale by the time factor."], [`${v} × ${f1} = ${ans} 이다.`, "Compute."]] : [["길이(부피) 단위와 시간 단위를 각각 환산한다.", "Convert each unit."], [`환산 계수는 ${f1}${f2 > 1 ? ` × ${f2}` : ""}${g > 1 ? ` ÷ ${g}` : ""} 이다.`, "Combined factor."], [`${v} × ${f1}${f2 > 1 ? ` × ${f2}` : ""}${g > 1 ? ` ÷ ${g}` : ""} = ${ans} 이다.`, "Compute."]], variant: level === "easy" ? "single_step_time_unit" : "multi_unit_rate" });
      return sem(out, [], { words: [to.split(" per ")[1]], forbid: [] });
    },
  },
];
function gcd2(a: number, b: number): number { return b ? gcd2(b, a % b) : a; }
