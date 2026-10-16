// probability.simple.BR.P — 도수 막대그래프에서 무작위로 하나를 고를 때의 확률(조건에 맞는 도수 합 ÷ 전체). 평균 기준·수 성질·추가 개체 역산·임계 개수로 확장한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import type { DistractorKind } from "../../../../review";
import { fmtNum, frac, spin } from "../../../text";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { BF_JS, bfIntro, bfRead, makeBarFq, type BarFqScene, gInst } from "../data-kit";

const FW = (n: number, d: number, kind: DistractorKind, reason: string) => ({ text: frac(n, d), kind, reason });
const one = (ent: string) => (ent === "people" ? "person" : ent === "fish" ? "fish" : ent.endsWith("ies") ? `${ent.slice(0, -3)}y` : ent.replace(/s$/, ""));
const pick1 = (rng: Rng, s: BarFqScene) => spin(rng, `[[One of these ${s.t.ent} is chosen at random.|Suppose one of the ${s.t.ent} is selected at random.|A single ${one(s.t.ent)} is picked at random from the group.|Each of the ${s.t.ent} is equally likely to be chosen, and one is chosen.]]`);
const valIs = (s: BarFqScene) => `the value recorded for the chosen ${one(s.t.ent)}`;
const big = (k: number) => { if (k < 2) throw new GenFail("기준값 1 이하"); return k; };
const cnt = (s: BarFqScene, f: (v: number) => boolean) => s.vals.reduce((a, v, i) => a + (f(v) ? s.freqs[i] : 0), 0);
const nStep = (s: BarFqScene): [string, string] => [`전체 개수 = ${s.freqs.join(" + ")} = ${s.N} 이다.`, "Add the frequencies."];
const isPrime = (n: number) => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
type Prop = { id: string; text: string; fn: (v: number) => boolean };
const PROPS: Prop[] = [
  { id: "even", text: "an even number", fn: (v) => v % 2 === 0 },
  { id: "odd", text: "an odd number", fn: (v) => v % 2 === 1 },
  { id: "prime", text: "a prime number", fn: isPrime },
  { id: "mult3", text: "a multiple of 3", fn: (v) => v % 3 === 0 },
];
const PROP_JS = "function prop(id,v){ if(id==='even') return v%2===0; if(id==='odd') return Math.abs(v%2)===1; if(id==='mult3') return v%3===0; if(id==='prime'){ if(v<2) return false; for(let i=2;i*i<=v;i++) if(v%i===0) return false; return true; } throw new Error('prop'); }\n";

export const ITEM = defineItem({
  prefix: "pr", itemId: "probability.simple.BR.P",
  hard: [
    {
      op: "chain2", structure: "도수 막대그래프의 평균을 구한 뒤, 평균보다 큰 값을 가진 개체의 도수 합을 전체로 나눠 확률을 구함", extra: "가중 평균 → 그 평균을 기준으로 도수 다시 합산 → 확률의 연쇄 — medium 은 주어진 기준값의 확률",
      concepts: ["도수 막대그래프", "평균", "확률"],
      gen(rng) {
        const s = makeBarFq(rng); const m = s.sum / s.N; const above = cnt(s, (v) => v > m); const ge = cnt(s, (v) => v >= m);
        if (above === 0 || above === s.N) throw new GenFail("above");
        return gInst(rng, {
          stimulus: `${bfIntro(rng, s)} ${pick1(rng, s)}`,
          question: spin(rng, `[[What is the probability that ${valIs(s)} is greater than the mean of the data?|What is the probability that the chosen ${one(s.t.ent)} has a value greater than the mean of all the values in the graph?]]`), correctText: frac(above, s.N), range: [0, 1],
          wrongTexts: [FW(s.N - above, s.N, "opposite", "평균 이하인 쪽을 셌다."), FW(ge === above ? above + 1 : ge, s.N, "condition_ignored", "평균과 같은 값까지 셌다."), FW(s.vals.filter((v) => v > m).length, s.vals.length, "axis_misread", "도수가 아니라 행의 수로 셌다."), FW(above, s.N - above, "formula_misuse", "확률 대신 비(odds)를 구했다."), FW(above - 1, s.N, "other", "한 개를 빠뜨렸다.")],
          verificationJs: figJs({}, s.fig, `${BF_JS}const m = S / N; return vals.reduce((a, v, i) => a + (v > m ? fr[i] : 0), 0) / N;`),
          trace: [bfRead(s), nStep(s), [`합 = ${s.vals.map((v, i) => `${v}×${s.freqs[i]}`).join(" + ")} = ${s.sum} 이다.`, "Multiply each value by its frequency and add."], [`평균 = ${s.sum} ÷ ${s.N} ≈ ${fmtNum(Math.round(m * 100) / 100)} 이다.`, "Compute the mean."], [`평균보다 큰 값의 도수 합은 ${above} 이다.`, "Add the frequencies above the mean."], [`확률 = ${above}/${s.N} = ${frac(above, s.N)} 이다.`, "Divide by the total."]], variant: "above_mean_probability",
        }, s.fig);
      },
    },
    {
      op: "compose_kind", structure: "도수 막대그래프의 값 중 수 성질(짝수·홀수·소수·3의 배수)을 만족하는 값을 골라 그 도수 합의 확률을 구함", extra: "값의 수론 성질 판정과 도수 합산을 합성해야 함 — medium 은 크기 조건 하나",
      concepts: ["도수 막대그래프", "수 성질(소수·배수·짝홀)", "확률"],
      gen(rng) {
        const s = makeBarFq(rng); const pr = rng.pick(PROPS); const c = cnt(s, pr.fn); if (c === 0 || c === s.N) throw new GenFail("prop");
        const rowsOk = s.vals.filter(pr.fn).length;
        return gInst(rng, {
          stimulus: `${bfIntro(rng, s)} ${pick1(rng, s)}`,
          question: spin(rng, `[[What is the probability that ${valIs(s)} is ${pr.text}?|What is the probability that the value recorded for the chosen ${one(s.t.ent)} is ${pr.text}?]]`), correctText: frac(c, s.N), range: [0, 1],
          wrongTexts: [FW(s.N - c, s.N, "opposite", "성질을 만족하지 않는 쪽을 셌다."), FW(rowsOk, s.vals.length, "axis_misread", "도수 대신 값의 종류 수를 셌다."), FW(c, s.N + c, "formula_misuse", "분모에 해당 도수를 더했다."), FW(cnt(s, (v) => pr.fn(v) || v === 1), s.N, "condition_ignored", "1 을 성질에 포함했다."), FW(c + 1, s.N, "other", "하나 더 셌다."), FW(c - 1, s.N, "other", "하나 빠뜨렸다.")],
          verificationJs: figJs({ prop: pr.id }, s.fig, `${BF_JS}${PROP_JS}return vals.reduce((a, v, i) => a + (prop(P.prop, v) ? fr[i] : 0), 0) / N;`),
          trace: [bfRead(s), nStep(s), [`사건은 값이 ${pr.text} 인 것이다.`, "State the event."], [`그래프의 값 중 조건을 만족하는 값: ${s.vals.filter(pr.fn).join(", ")} 이다.`, "Pick the values with the property."], [`그 도수 합은 ${c} 이다.`, "Add their frequencies."], [`확률 = ${c}/${s.N} = ${frac(c, s.N)} 이다.`, "Divide by the total."]], variant: `property_${pr.id}`,
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "도수 막대그래프의 전체와 최댓값의 도수를 읽고, 최댓값을 가진 개체 x 개가 더해진 뒤 그 확률이 주어진 분수가 될 때 x 를 역산", extra: "분자·분모가 함께 x 만큼 커지는 확률 방정식을 세워 역산해야 함 — medium 은 확률 계산까지",
      concepts: ["도수 막대그래프", "확률", "분수 방정식의 역산"],
      gen(rng) {
        for (let tr = 0; tr < 80; tr++) {
          const s = makeBarFq(rng); const fl = s.freqs[s.freqs.length - 1]; const x = rng.int(2, 30); const g = frac(fl + x, s.N + x); if (!g.includes("/")) continue;
          const [a, b] = g.split("/").map(Number); if (b > 999 || a < 2) continue;
          return gInst(rng, {
            stimulus: `${bfIntro(rng, s)} ${spin(rng, `[[Later, more ${s.t.ent} are added to the group, and each new ${one(s.t.ent)} has the greatest value shown in the graph.|Some additional ${s.t.ent} are then included, and every one of them has the largest value listed in the graph.|Next, a number of new ${s.t.ent} are counted as well; each of them has the greatest value in the graph.]]`)} ${spin(rng, "[[After they are added|Once they are included|With the new ones counted]]")}, the probability that a randomly chosen ${one(s.t.ent)} has that greatest value is ${a}/${b}.`,
            question: spin(rng, `[[How many ${s.t.ent} were added?|How many new ${s.t.ent} joined the group?]]`), correct: x,
            wrongs: [W((a * s.N - b * fl) / (b - a) + fl, "step_missing", "원래 도수를 다시 더했다."), W(b - s.N, "formula_misuse", "기약분수의 분모를 새 전체로 착각했다."), W(a - fl, "formula_misuse", "기약분수의 분자를 새 도수로 착각했다."), W(x + 1, "other", "계산 중 1 어긋났다."), W(x - 1, "other", "계산 중 1 어긋났다."), W(s.N + x, "step_missing", "새 전체 개수를 답했다.")].filter((w) => w.v > 0 && Number.isInteger(w.v)),
            verificationJs: figJs({ a, b }, s.fig, `${BF_JS}let j = 0; vals.forEach((v, i) => { if (v > vals[j]) j = i; }); const f = fr[j]; const x = (P.a * N - P.b * f) / (P.b - P.a); if (!Number.isInteger(x) || x < 0) throw new Error('정수 아님'); return x;`),
            trace: [bfRead(s), nStep(s), [`가장 큰 값 ${s.vals[s.vals.length - 1]} 의 도수는 ${fl} 이다.`, "Frequency of the greatest value."], [`(${fl} + x) ÷ (${s.N} + x) = ${a}/${b} 이다.`, "Both numerator and denominator grow by x."], [`${b}(${fl} + x) = ${a}(${s.N} + x) 이므로 ${b - a}x = ${a * s.N - b * fl} 이다.`, "Cross-multiply and collect terms."], [`x = ${x} 이다.`, "Solve."]], variant: "added_max_to_reach_probability",
          }, s.fig);
        }
        throw new GenFail("inverse");
      },
    },
    {
      op: "param_condition", structure: "도수 막대그래프에서 기준값 이상인 도수 합·전체를 구하고, 기준값보다 작은 값을 가진 개체 x 개가 더해질 때 확률이 p% 이하가 되는 최소 정수 x 를 구함", extra: "분모만 커지는 확률 부등식을 세우고 정수 최소값(올림)을 골라야 함 — medium 은 확률 계산까지",
      concepts: ["도수 막대그래프", "확률", "부등식과 정수 조건"],
      gen(rng) {
        for (let tr = 0; tr < 80; tr++) {
          const s = makeBarFq(rng); const k = big(s.vals[rng.int(1, s.vals.length - 1)]); const c = cnt(s, (v) => v >= k); const p = rng.pick([10, 15, 20, 25, 30, 40]);
          const num = 100 * c - p * s.N; if (num <= 0 || num % p === 0) continue; const x = Math.ceil(num / p); if (x < 2 || x > 400) continue;
          return gInst(rng, {
            stimulus: `${bfIntro(rng, s)} Suppose more ${s.t.ent} join the group, and each of them has a value less than ${k} ${s.t.unit}.`,
            question: spin(rng, `[[What is the least number of ${s.t.ent} that must join so that the probability that a randomly chosen ${one(s.t.ent)} has a value of at least ${k} ${s.t.unit} is at most ${p}%?|At least how many ${s.t.ent} must join so that a randomly chosen ${one(s.t.ent)} has at most a ${p}% chance of having a value of at least ${k} ${s.t.unit}?]]`), correct: x,
            wrongs: [W(x - 1, "condition_ignored", "올림 대신 내림했다."), W(Math.ceil((100 * c) / p), "step_missing", "새 전체 개수를 답했다."), W(Math.ceil((100 * cnt(s, (v) => v > k) - p * s.N) / p), "condition_ignored", "기준값과 같은 값을 빼고 셌다."), W(x + 1, "other", "하나 더 올렸다."), W(Math.ceil(num / 100), "formula_misuse", "p 대신 100 으로 나눴다.")].filter((w) => w.v > 0),
            verificationJs: figJs({ k, p }, s.fig, `${BF_JS}const c = vals.reduce((a, v, i) => a + (v >= P.k ? fr[i] : 0), 0); if (c === 0) throw new Error('없음'); for (let x = 0; x <= 5000; x++) if (100 * c <= P.p * (N + x)) return x; throw new Error('해 없음');`),
            trace: [bfRead(s), nStep(s), [`${k} 이상인 값의 도수 합은 ${c} 이다.`, "Count the values at least the threshold."], [`x 개가 더해지면 확률 = ${c} ÷ (${s.N} + x) 이다(분자는 그대로).`, "Only the denominator grows."], [`${c} ÷ (${s.N} + x) ≤ ${p}% 이므로 ${s.N} + x ≥ ${fmtNum(Math.round((100 * c / p) * 10) / 10)} 이다.`, "Set up the inequality."], [`x ≥ ${fmtNum(Math.round((num / p) * 10) / 10)} 이므로 가장 작은 정수는 ${x} 이다.`, "Round up to a whole number."]], variant: "least_added_to_lower_probability",
          }, s.fig);
        }
        throw new GenFail("param");
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "value_probability", structure: "도수 막대그래프에서 한 값의 도수를 전체로 나눠 확률을 구함", extra: "easy: 도수 ÷ 전체", concepts: ["도수 막대그래프", "확률"],
      gen(rng) {
        const s = makeBarFq(rng); const i = rng.int(0, s.vals.length - 1); const v = big(s.vals[i]); const f = s.freqs[i]; if (f === s.N) throw new GenFail("all");
        return gInst(rng, {
          stimulus: `${bfIntro(rng, s)} ${pick1(rng, s)}`, question: spin(rng, `[[What is the probability that the chosen ${one(s.t.ent)} has a value of exactly ${v} ${s.t.unit}?|What is the probability that ${valIs(s)} is exactly ${v} ${s.t.unit}?]]`), correctText: frac(f, s.N), range: [0, 1],
          wrongTexts: [FW(1, s.vals.length, "axis_misread", "행의 수로 확률을 냈다."), FW(s.N - f, s.N, "opposite", "여사건을 구했다."), FW(f, s.N - f, "formula_misuse", "나머지 개수로 나눴다."), FW(f + 1, s.N, "other", "하나 더 셌다.")],
          verificationJs: figJs({ v }, s.fig, `${BF_JS}const j = vals.indexOf(P.v); if (j < 0) throw new Error('값 없음'); return fr[j] / N;`), trace: [bfRead(s), nStep(s), [`확률 = ${f}/${s.N} = ${frac(f, s.N)} 이다.`, "Divide the frequency by the total."]], variant: "single_value",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "at_least_probability", structure: "도수 막대그래프에서 기준값 이상인 값들의 도수를 더해 전체로 나눠 확률을 구함", extra: "medium: 조건에 맞는 도수 합 → 전체 → 확률", concepts: ["도수 막대그래프", "도수 합", "확률"],
      gen(rng) {
        const s = makeBarFq(rng); const k = big(s.vals[rng.int(1, s.vals.length - 1)]); const c = cnt(s, (v) => v >= k);
        return gInst(rng, {
          stimulus: `${bfIntro(rng, s)} ${pick1(rng, s)}`, question: spin(rng, `[[What is the probability that the chosen ${one(s.t.ent)} has a value of at least ${k} ${s.t.unit}?|What is the probability that ${valIs(s)} is ${k} ${s.t.unit} or more?]]`), correctText: frac(c, s.N), range: [0, 1],
          wrongTexts: [FW(cnt(s, (v) => v > k), s.N, "condition_ignored", "기준값과 같은 값을 뺐다."), FW(s.N - c, s.N, "opposite", "기준값 미만을 셌다."), FW(s.vals.filter((v) => v >= k).length, s.vals.length, "axis_misread", "행의 수로 셌다."), FW(c, s.N - c, "formula_misuse", "비(odds)를 구했다."), FW(cnt(s, (v) => v >= k) - 1, s.N, "other", "하나 빠뜨렸다.")],
          verificationJs: figJs({ k }, s.fig, `${BF_JS}return vals.reduce((a, v, i) => a + (v >= P.k ? fr[i] : 0), 0) / N;`), trace: [bfRead(s), nStep(s), [`${k} 이상인 값의 도수 합은 ${c} 이다.`, "Add the frequencies that meet the condition."], [`확률 = ${c}/${s.N} = ${frac(c, s.N)} 이다.`, "Divide by the total."]], variant: "at_least_value",
        }, s.fig);
      },
    },
  ],
});
