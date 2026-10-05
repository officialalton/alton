// nonlinear_functions.exponential_model.TB.C — 지문의 지수 모형 y = A·g^(e(t)) 에 맞는 값표를 4개 중에서 고른다.
// 오답 규칙: EX1_linear(공비↔공차 혼동 — 첫 변화량을 매번 더함), EX2_shift(초기값 위치 혼동 — 첫 값을 한 주기 뒤의 값으로 둠),
//            EX3_factor(증가↔감소 혼동 — 반대 방향의 배율), EX4_period(주기 혼동 — 단위 환산을 빠뜨려 지수를 두 배로 셈, unit_ratio 에서만).
import { GenFail, type Instance } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { choiceInst } from "../../tvd-fig-choice";
import { defineItem } from "../item-kit";
import { SPR_NO_TABLE, tableChoices, type Rows } from "./_t8-kit";

/** 장면: 모형 JS(MODEL — P 에서 A, g, g3, e(t) 를 정의)와 같은 계산의 TS 값. */
type M = { A: number; g: number; g3: number; e: (t: number) => number; ts: number[] };
const near = (u: number, v: number) => Math.abs(u - v) < 1e-6;
const fitsJs = `const R = c.rows; if (R.length < 3 || R.some((r) => r.length !== 2)) throw new Error('표 형식'); const fits = (f) => R.every((r) => Math.abs(r[1] - f(r[0])) < 1e-6);`;
const predJs = (model: string) => `${model}\n${fitsJs}\nreturn fits((t) => A * g ** e(t));`;
const diagJs = (model: string) => `${model}\n${fitsJs}
if (fits((t) => A * g ** (e(t) + 1))) return "EX2_shift";
if (fits((t) => A + A * (g - 1) * e(t))) return "EX1_linear";
if (fits((t) => A * g3 ** e(t))) return "EX3_factor";
if (fits((t) => A * g ** (2 * e(t)))) return "EX4_period";
return null;`;
const rowsOf = (m: M, f: (t: number) => number): Rows | null => { const r = m.ts.map((t) => [t, f(t)]); return r.every(([, y]) => y >= 0 && near(y, Math.round(y))) ? r.map(([t, y]) => [t, Math.round(y)]) : null; };

type Txt = { stimulus: string; question: string; P: Record<string, number | string>; trace: [string, string][]; variant: string };
function build(rng: Rng, m: M, cols: [string, string], model: string, d: Txt, period = false): Instance {
  const ok = rowsOf(m, (t) => m.A * m.g ** m.e(t)); if (!ok) throw new GenFail("정답 표가 정수가 아님");
  const cands = [
    { rule: "EX1_linear", rows: rowsOf(m, (t) => m.A + m.A * (m.g - 1) * m.e(t)) },
    { rule: "EX2_shift", rows: rowsOf(m, (t) => m.A * m.g ** (m.e(t) + 1)) },
    { rule: "EX3_factor", rows: rowsOf(m, (t) => m.A * m.g3 ** m.e(t)) },
    ...(period ? [{ rule: "EX4_period", rows: rowsOf(m, (t) => m.A * m.g ** (2 * m.e(t))) }] : []),
  ];
  const { choices, correctIndex, rules } = tableChoices(rng, { cols, ok, cands, P: d.P, predicateJs: predJs(model), diagnoseJs: diagJs(model) });
  const tr: [string, string][] = [...d.trace, [`정답 표의 값 ${ok.map((r) => r[1]).join(", ")} 은 모두 이 모형으로 계산된다.`, "The correct table matches the model in every row."], [`나머지 표는 일정하게 더하기·한 주기 밀림·반대 배율${period ? "·주기 환산 누락" : ""} 중 하나로 만들어졌다.`, "Each other table follows one typical error."]];
  return choiceInst(rng, { stimulus: d.stimulus, question: d.question, choices, correctIndex, rules, P: d.P, predicateJs: predJs(model), diagnoseJs: diagJs(model), trace: tr, variant: d.variant, explainKo: "", explainEn: "" });
}

const CTX = [
  { who: "A biologist", what: "the number of bacteria in a sample", tv: "t", fn: "B", tu: "hours", grow: true },
  { who: "A social media analyst", what: "the number of followers of a new account", tv: "w", fn: "F", tu: "weeks", grow: true },
  { who: "A scientist", what: "the mass, in grams, of a radioactive sample", tv: "d", fn: "M", tu: "days", grow: false },
  { who: "A nurse", what: "the amount of a medication, in milligrams, remaining in a patient's body", tv: "h", fn: "A", tu: "hours", grow: false },
  { who: "An ecologist", what: "the number of fish in a pond", tv: "n", fn: "P", tu: "years", grow: true },
  { who: "A collector", what: "the value, in dollars, of a rare coin", tv: "y", fn: "V", tu: "years", grow: true },
  { who: "A dealer", what: "the value, in dollars, of a used car", tv: "x", fn: "C", tu: "years", grow: false },
  { who: "An engineer", what: "the number of active sensors in a network", tv: "k", fn: "S", tu: "months", grow: true },
  { who: "A chemist", what: "the concentration, in parts per million, of a substance in a solution", tv: "m", fn: "K", tu: "minutes", grow: false },
  { who: "A city planner", what: "the number of residents in a new neighborhood", tv: "q", fn: "R", tu: "years", grow: true },
  { who: "A physicist", what: "the brightness, in lumens, of a fading light source", tv: "s", fn: "L", tu: "seconds", grow: false },
  { who: "A marketing team", what: "the number of subscribers to a newsletter", tv: "p", fn: "G", tu: "weeks", grow: true },
  { who: "A botanist", what: "the number of leaves on a fast-growing vine", tv: "r", fn: "T", tu: "days", grow: true },
  { who: "A librarian", what: "the number of digital books borrowed through a new program", tv: "b", fn: "D", tu: "months", grow: true },
  { who: "A park ranger", what: "the number of rabbits on an island", tv: "j", fn: "N", tu: "months", grow: true },
  { who: "A veterinarian", what: "the number of bacteria in a culture dish", tv: "u", fn: "Q", tu: "hours", grow: true },
  { who: "A farmer", what: "the number of bees in a new hive", tv: "z", fn: "H", tu: "weeks", grow: true },
  { who: "A software company", what: "the number of registered users of an app", tv: "e", fn: "U", tu: "months", grow: true },
  { who: "A zoologist", what: "the number of birds nesting on a cliff", tv: "a", fn: "E", tu: "years", grow: true },
  { who: "A teacher", what: "the number of students who joined an online club", tv: "c", fn: "J", tu: "weeks", grow: true },
  { who: "A banker", what: "the balance, in dollars, of a savings account", tv: "i", fn: "W", tu: "years", grow: true },
  { who: "A geologist", what: "the number of mineral crystals in a growing sample", tv: "g", fn: "X", tu: "days", grow: true },
  { who: "A streaming service", what: "the number of viewers of a new series", tv: "v", fn: "Y", tu: "weeks", grow: true },
];
const lcf1 = (w: string) => w.charAt(0).toLowerCase() + w.slice(1);
const sg = (u: string) => u.replace(/s$/, "");
const QS = (fn: string, tv: string) => [`Which table gives values of $${fn}(${tv})$ that are consistent with this model?`, `Which of the following tables could show values of $${fn}(${tv})$ for this model?`, `Which table correctly shows values of $${fn}(${tv})$ predicted by the model?`, `For which table are all the values of $${fn}(${tv})$ given by this model?`];
const WORD: Record<number, string> = { 2: "doubles", 3: "triples", 4: "quadruples" };

export const ITEM = defineItem({
  prefix: "nf", itemId: "nonlinear_functions.exponential_model.TB.C",
  hard: [
    {
      op: "repr_shift", sprNo: SPR_NO_TABLE, structure: "초기값과 '매 기간 r% 증가/감소' 문장을 지수 모형 A(1 ± r/100)^t 로 번역해 그 값표를 4개 중에서 고름", extra: "퍼센트 변화를 배율(1 ± r/100)로 바꿔야 함(r 을 더하거나 반대 방향 배율이면 오답) — medium 은 '두 배가 된다' 같은 정수 배율",
      concepts: ["퍼센트 변화→배율", "지수 모형", "값표 비교"],
      gen(rng) {
        const c = rng.pick(CTX); const grow = c.grow; const r = rng.pick([20, 25, 50]); const g = grow ? 1 + r / 100 : 1 - r / 100; const g3 = grow ? 1 - r / 100 : 1 + r / 100;
        const A = (r === 20 ? 125 : r === 25 ? 64 : 8) * rng.int(1, r === 50 ? 120 : r === 25 ? 15 : 7); const ts = [0, 1, 2, 3];
        const sign = grow ? 1 : -1; const word = grow ? "increases" : "decreases";
        const model = `const A = P.A, g = 1 + ${sign} * P.r / 100, g3 = 1 - ${sign} * P.r / 100; const e = (t) => t;`;
        return build(rng, { A, g, g3, e: (t) => t, ts }, [c.tv, `${c.fn}(${c.tv})`], model, {
          stimulus: rng.pick([
            `${c.who} models ${c.what}. At $${c.tv} = 0$, the amount is ${A}, and it ${word} by ${r}% every ${sg(c.tu)}. The function $${c.fn}$ gives the amount $${c.tv}$ ${c.tu} after the start.`,
            `The function $${c.fn}$ models ${c.what}, $${c.tv}$ ${c.tu} after observations began. The starting amount is ${A}, and each ${sg(c.tu)} the amount ${word} by ${r}% of the amount one ${sg(c.tu)} earlier.`,
            `According to a model used by ${c.who.replace(/^An? /, "a ").replace(/^a ([aeiou])/, "an $1")}, ${c.what} was ${A} when observations began and then ${word} by ${r}% per ${sg(c.tu)}. Let $${c.fn}(${c.tv})$ be the amount $${c.tv}$ ${c.tu} after observations began.`,
          ]),
          question: rng.pick(QS(c.fn, c.tv)), P: { A, r },
          trace: [[`${r}% ${grow ? "증가" : "감소"}는 매번 ${fmtNum(g)} 배가 되는 것이다.`, "Convert the percent change to a growth factor."], [`모형은 ${c.fn}(${c.tv}) = ${A}·(${fmtNum(g)})^${c.tv} 이다.`, "Write the exponential model."], [`표의 각 ${c.tv} 에서 값을 계산한다: ${ts.map((t) => fmtNum(A * g ** t)).join(", ")}.`, "Evaluate at each table input."]], variant: `percent_${word}`,
        });
      },
    },
    {
      op: "inverse", sprNo: SPR_NO_TABLE, structure: "지수함수 f(x) = a·b^x 의 두 값(초기값이 아닌 두 점)을 주고 a, b 를 역산한 뒤 맞는 값표를 고름", extra: "두 값의 비와 지수 차로 b 를 구하고 다시 a 를 구해야 함(첫 값을 a 로 착각하면 초기값 오답) — medium 은 a, b 가 문장에 직접",
      concepts: ["두 점으로 지수함수 결정", "거듭제곱근", "값표 비교"],
      gen(rng) {
        const vars = rng.pick([["x", "f"], ["t", "g"], ["n", "h"], ["s", "p"], ["k", "q"], ["u", "r"], ["z", "w"], ["m", "v"]]); const [tv, fn] = vars;
        const b = rng.pick([2, 3, 0.5]); const A = b === 0.5 ? 16 * rng.int(1, 40) : rng.int(1, 15) * b ** 3; const t1 = rng.pick([1, 2]), t2 = t1 + rng.pick([1, 2]);
        const v1 = A * b ** t1, v2 = A * b ** t2; if (!Number.isInteger(v1) || !Number.isInteger(v2) || Math.max(v1, v2, A) > 999) throw new GenFail("int");
        const ts = [0, 1, 2, 3];
        const model = `const g = (P.v2 / P.v1) ** (1 / (P.t2 - P.t1)); const A = P.v1 / g ** P.t1, g3 = 1 / g; const e = (t) => t;`;
        return build(rng, { A, g: b, g3: 1 / b, e: (t) => t, ts }, [tv, `${fn}(${tv})`], model, {
          stimulus: rng.pick([`For the exponential function $${fn}$, $${fn}(${tv}) = ab^{${tv}}$, where $a$ and $b$ are positive constants. It is known that $${fn}(${t1}) = ${v1}$ and $${fn}(${t2}) = ${v2}$.`, `The function $${fn}$ is defined by $${fn}(${tv}) = ab^{${tv}}$ for positive constants $a$ and $b$. The values $${fn}(${t1}) = ${v1}$ and $${fn}(${t2}) = ${v2}$ are given.`, `Two values of a function are $${fn}(${t1}) = ${v1}$ and $${fn}(${t2}) = ${v2}$. The function has the form $${fn}(${tv}) = ab^{${tv}}$, where $a$ and $b$ are positive.`, `An exponential function satisfies $${fn}(${t1}) = ${v1}$ and $${fn}(${t2}) = ${v2}$, and it can be written as $${fn}(${tv}) = ab^{${tv}}$ with $a > 0$ and $b > 0$.`]),
          question: rng.pick([`Which table gives values of $${fn}(${tv})$ for this function?`, `Which of the following tables shows values of $${fn}$?`, `In which table are all the values of $${fn}(${tv})$ correct?`, `Which table could be a table of values of the exponential function $${fn}$?`]), P: { t1, v1, t2, v2 },
          trace: [[`${fn}(${t2}) ÷ ${fn}(${t1}) = b^${t2 - t1} = ${fmtNum(v2 / v1)} 이다.`, "Divide the two values."], [`따라서 b = ${fmtNum(b)} 이다.`, "Take the root."], [`a = ${v1} ÷ ${fmtNum(b)}^${t1} = ${fmtNum(A)} 이다.`, "Solve for a."]], variant: `two_points_gap${t2 - t1}`,
        });
      },
    },
    {
      op: "chain2", sprNo: SPR_NO_TABLE, structure: "f(1) = k·f(0) 와 f(0) + f(1) = S 를 주어 초기값을 먼저 구하고(1단계) 그 초기값과 배율로 값표를 고름(2단계)", extra: "배율 관계와 합 조건으로 초기값을 구한 뒤 그 값으로 모형을 세워 표를 검사 — medium 은 초기값이 직접 주어짐",
      concepts: ["지수 모형의 배율", "일차방정식으로 초기값", "값표 비교"],
      gen(rng) {
        const c = rng.pick(CTX.filter((q) => q.grow)); const k = rng.pick([2, 3, 4]); const A = rng.int(1, Math.floor(999 / (k ** 3 * (1 + k)))) * k ** 3; const S = A * (1 + k); const ts = [0, 1, 2, 3];
        const model = `const g = P.k, A = P.S / (1 + P.k), g3 = 1 / P.k; const e = (t) => t;`;
        return build(rng, { A, g: k, g3: 1 / k, e: (t) => t, ts }, [c.tv, `${c.fn}(${c.tv})`], model, {
          stimulus: rng.pick([
            `${c.who} models ${c.what} with an exponential function $${c.fn}$, where $${c.tv}$ is the number of ${c.tu} after the start. The value of $${c.fn}(1)$ is ${k} times the value of $${c.fn}(0)$, and $${c.fn}(0) + ${c.fn}(1) = ${S}$.`,
            `Let $${c.fn}(${c.tv})$ be ${c.what} $${c.tv}$ ${c.tu} after observations began, where $${c.fn}$ is an exponential function. One ${sg(c.tu)} after the start, the amount was ${k} times the starting amount, and the starting amount and the amount one ${sg(c.tu)} later add up to ${S}.`,
            `When observations began, ${c.what} had some starting value. Exactly one ${sg(c.tu)} later it was ${k} times as large, and the two amounts together totaled ${S}. The exponential function $${c.fn}$ gives the amount $${c.tv}$ ${c.tu} after observations began.`,
            `For an exponential model $${c.fn}$ of ${c.what}, where $${c.tv}$ counts ${c.tu} since the start, the sum of the first two values $${c.fn}(0)$ and $${c.fn}(1)$ is ${S}, and the second value is ${k} times the first.`,
            `An exponential function $${c.fn}$ models ${c.what}, $${c.tv}$ ${c.tu} from the start. It satisfies $${c.fn}(1) = ${k}${c.fn}(0)$ and $${c.fn}(0) + ${c.fn}(1) = ${S}$.`,
          ]),
          question: rng.pick(QS(c.fn, c.tv)), P: { k, S },
          trace: [[`${c.fn}(0) = a 라 하면 ${c.fn}(1) = ${k}a 이다.`, "Name the initial value."], [`a + ${k}a = ${S} 이므로 a = ${A} 이다.`, "Solve for the initial value."], [`모형은 ${c.fn}(${c.tv}) = ${A}·${k}^${c.tv} 이다.`, "Write the model."]], variant: `sum_and_ratio_k${k}`,
        });
      },
    },
    {
      op: "unit_ratio", sprNo: SPR_NO_TABLE, structure: "'p 시간마다 b 배'인 모형에서 표의 시간이 분 단위로 주어져 지수 t/(60p) 로 환산해 값표를 고름", extra: "시간 단위를 환산하고 주기로 나눠 지수를 구해야 함(환산·주기를 빠뜨리면 주기 오답) — medium 은 표 단위와 주기가 같음",
      concepts: ["단위 환산", "주기가 있는 지수 모형", "값표 비교"],
      gen(rng) {
        const who = rng.pick(["the number of cells in a culture", "the number of downloads of an app", "the number of yeast cells in a dough sample", "the number of people who have heard a rumor", "the number of algae cells in a tank"]);
        const tv = rng.pick(["m", "t", "x"]), fn = rng.pick(["N", "Q", "R"]); const b = rng.pick([2, 3]); const p = rng.pick([1, 2, 3]); const A = rng.int(1, b === 2 ? 30 : 8) * b ** 3; const ts = [0, 1, 2, 3].map((i) => i * 60 * p);
        const model = `const A = P.A, g = ({ doubles: 2, triples: 3 })[P.w], g3 = 1 / g; const e = (t) => t / (60 * P.p);`;
        return build(rng, { A, g: b, g3: 1 / b, e: (t) => t / (60 * p), ts }, [tv, `${fn}(${tv})`], model, {
          stimulus: rng.pick([
            `A model predicts that ${who} ${WORD[b]} every ${p === 1 ? "hour" : `${p} hours`}, starting from ${A} at time 0. The function $${fn}$ gives the predicted number $${tv}$ minutes after time 0.`,
            `At time 0 there are ${A} in ${who.replace(/^the number of /, "the count of ")}. The count ${WORD[b]} every ${p === 1 ? "hour" : `${p} hours`}. Let $${fn}(${tv})$ be the predicted count $${tv}$ minutes after time 0.`,
            `The function $${fn}$ models ${who}, where $${tv}$ is the time in minutes since the count was ${A}. According to the model, the count ${WORD[b]} every ${p === 1 ? "hour" : `${p} hours`}.`,
          ]),
          question: rng.pick([`Which table gives values of $${fn}(${tv})$ that agree with this model?`, `Which of the following tables could show values of $${fn}(${tv})$ for this model?`, `In which table are all values of $${fn}(${tv})$ consistent with the model?`]), P: { A, w: WORD[b], p },
          trace: [[`주기 ${p} 시간 = ${60 * p} 분이다.`, "Convert the period to minutes."], [`${fn}(${tv}) = ${A}·${b}^(${tv}/${60 * p}) 이다.`, "Write the model with the converted period."], [`표의 ${tv} 를 ${60 * p} 으로 나눈 값이 지수이다: ${ts.map((t) => t / (60 * p)).join(", ")}.`, "Compute each exponent."]], variant: `period_${p}h_b${b}`,
        }, true);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "equation_given", sprNo: SPR_NO_TABLE, structure: "f(x) = a·b^x 식을 주고 맞는 값표를 고름", extra: "easy: 식에 대입", concepts: ["지수함수", "값표"],
      gen(rng) {
        const c = rng.pick(CTX.filter((q) => q.grow)); const tv = c.tv, fn = c.fn; const b = rng.pick([2, 3, 4]); const A = rng.int(1, Math.floor(999 / b ** 3)) * b ** 3;
        const model = `const A = P.A, g = P.b, g3 = 1 / P.b; const e = (t) => t;`;
        return build(rng, { A, g: b, g3: 1 / b, e: (t) => t, ts: [0, 1, 2, 3] }, [tv, `${fn}(${tv})`], model, { stimulus: rng.pick([`${c.who} models ${c.what} with the function $$${fn}(${tv}) = ${A}(${b})^{${tv}}$$ where $${tv}$ is the number of ${c.tu} since the start.`, `The function $${fn}$ given by $$${fn}(${tv}) = ${A}(${b})^{${tv}}$$ models ${c.what}, where $${tv}$ is the number of ${c.tu} after ${lcf1(c.who)} begins recording.`, `${c.who} finds that ${c.what} follows an exponential model: $$${fn}(${tv}) = ${A}(${b})^{${tv}}$$ Here $${tv}$ is measured in ${c.tu}.`]), question: rng.pick([`Which table gives values of $${fn}(${tv})$ for this function?`, `Which of the following tables shows values of $${fn}$?`]), P: { A, b }, trace: [[`${tv} = 0 일 때 ${A}, 이후 매번 ${b} 배이다.`, "Start value and factor."], [`값은 ${[0, 1, 2, 3].map((t) => A * b ** t).join(", ")} 이다.`, "Evaluate."]], variant: "equation_given" });
      },
    },
    {
      lv: "medium", name: "words_multiple", sprNo: SPR_NO_TABLE, structure: "'처음 A 에서 매 기간 b 배'인 문장을 모형으로 바꿔 값표를 고름", extra: "medium: 문장 → 모형 → 대입", concepts: ["지수 모형", "값표"],
      gen(rng) {
        const c = rng.pick(CTX.filter((q) => q.grow)); const b = rng.pick([2, 3, 4]); const A = rng.int(1, Math.floor(999 / b ** 3)) * b ** 3; const ts = [0, 1, 2, 3];
        const model = `const A = P.A, g = ({ doubles: 2, triples: 3, quadruples: 4 })[P.w], g3 = 1 / g; const e = (t) => t;`;
        return build(rng, { A, g: b, g3: 1 / b, e: (t) => t, ts }, [c.tv, `${c.fn}(${c.tv})`], model, { stimulus: rng.pick([`${c.who} models ${c.what}. The amount starts at ${A} and ${WORD[b]} every ${sg(c.tu)}. The function $${c.fn}$ gives the amount $${c.tv}$ ${c.tu} after the start.`, `At the start of an observation, ${c.what} is ${A}. Each ${sg(c.tu)}, this quantity ${WORD[b]}. Let $${c.fn}(${c.tv})$ represent the quantity $${c.tv}$ ${c.tu} later.`, `${c.who} tracks ${c.what}. Initially it is ${A}, and every ${sg(c.tu)} it ${WORD[b]}. The function $${c.fn}$ models the quantity after $${c.tv}$ ${c.tu}.`]), question: rng.pick(QS(c.fn, c.tv)), P: { A, w: WORD[b] }, trace: [[`초기값 ${A}, 배율 ${b} 이다.`, "Initial value and factor."], [`모형은 ${A}·${b}^${c.tv} 이다.`, "Write the model."], [`표의 각 ${c.tv} 에서 계산한다.`, "Evaluate each row."]], variant: `words_x${b}` });
      },
    },
  ],
});
