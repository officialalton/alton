// ratios_rates_units.proportion.BR.P — 막대그래프(제목 'Makes N servings')의 재료 양에서 비례로 다른 분량의 양을 구하고, 합계·역산·두 재료 비교·제한 재료로 확장한다.
import type { Rng } from "../../../rng";
import { GenFail } from "../../../types";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figJs, oneDec } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";
import { pos, retry, sum } from "./_t4-kit";

type MixTopic = { what: string; rows: string[]; unit: string; yieldS: string; yieldP: string; who: string };
const MIX: MixTopic[] = [
  { what: "pancake batter", rows: ["Flour", "Milk", "Sugar", "Oats", "Butter"], unit: "cups", yieldS: "serving", yieldP: "servings", who: "a cook" },
  { what: "fruit punch", rows: ["Apple juice", "Orange juice", "Pineapple", "Lemon juice", "Seltzer"], unit: "cups", yieldS: "pitcher", yieldP: "pitchers", who: "a caterer" },
  { what: "granola", rows: ["Oats", "Almonds", "Raisins", "Honey", "Coconut"], unit: "cups", yieldS: "jar", yieldP: "jars", who: "a baker" },
  { what: "trail mix", rows: ["Peanuts", "Raisins", "Pretzels", "Cereal", "Seeds"], unit: "ounces", yieldS: "bag", yieldP: "bags", who: "a camp counselor" },
  { what: "vegetable soup", rows: ["Broth", "Carrots", "Potatoes", "Beans", "Celery"], unit: "cups", yieldS: "bowl", yieldP: "bowls", who: "a chef" },
  { what: "potting soil", rows: ["Compost", "Peat moss", "Sand", "Perlite", "Bark"], unit: "scoops", yieldS: "pot", yieldP: "pots", who: "a gardener" },
  { what: "bird feed", rows: ["Millet", "Sunflower", "Corn", "Peanuts", "Thistle"], unit: "scoops", yieldS: "feeder", yieldP: "feeders", who: "a nature center" },
  { what: "concrete mix", rows: ["Cement", "Sand", "Gravel", "Water", "Lime"], unit: "buckets", yieldS: "batch", yieldP: "batches", who: "a builder" },
  { what: "cookie dough", rows: ["Flour", "Sugar", "Butter", "Chips", "Oats"], unit: "cups", yieldS: "tray", yieldP: "trays", who: "a bakery" },
  { what: "lemonade", rows: ["Water", "Lemon juice", "Syrup", "Ice", "Mint tea"], unit: "cups", yieldS: "jug", yieldP: "jugs", who: "a school club" },
];
type PScene = { t: MixTopic; names: string[]; amt: number[]; N: number };
function pScene(rng: Rng, n = rng.int(3, 5)): PScene {
  const t = rng.pick(MIX); const names = rng.shuffle(t.rows).slice(0, n); const N = rng.pick([2, 3, 4, 5, 6, 8]);
  return retry(40, () => { const amt = names.map(() => rng.int(1, 10)); return new Set(amt).size === n ? { t, names, amt, N } : null; }, "재료 장면");
}
const pFig = (s: PScene) => ({ type: "data" as const, kind: "bar" as const, title: `Makes ${s.N} ${s.N === 1 ? s.t.yieldS : s.t.yieldP}`, categories: s.names, series: [{ values: s.amt }], xTitle: "Ingredient", yTitle: `Amount (${s.t.unit})`, yMin: 0, yMax: Math.max(...s.amt) + 1, yStep: 1 });
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
const intro = (rng: Rng, s: PScene) => rng.pick([
  `The graph shows the amount of each ingredient that ${s.t.who} uses to make ${s.t.what}. The amounts are for the number of ${s.t.yieldP} given in the graph title.`,
  `A recipe for ${s.t.what} is shown in the graph. The graph title tells how many ${s.t.yieldP} the listed amounts make.`,
  `To make ${s.t.what}, ${s.t.who} follows the recipe in the graph shown. All the ingredients are always used in the same ratio.`,
  `${cap(s.t.who)} makes ${s.t.what} using the amounts in the graph, which make the number of ${s.t.yieldP} stated in its title. The ingredients stay in the same ratio for any amount.`,
]);
/** FIGURE.title 의 기준 분량 N 과 재료 양 a·이름 nm 을 읽는 JS. */
const P_JS = "const mt=/Makes (\\d+)/.exec(FIGURE.title||''); if (!mt) throw new Error('기준 분량 없음'); const N=Number(mt[1]); const nm=FIGURE.categories; const a=FIGURE.series[0].values; if (a.some(x=>typeof x!=='number'||x<=0)||a.length!==nm.length) throw new Error('양 오류'); const am=(k)=>{ const i=nm.indexOf(k); if (i<0) throw new Error('막대 없음'); return a[i]; };\n";
const read = (s: PScene): [string, string] => [`막대그래프: ${s.N} ${s.t.yieldP} 기준, ${s.names.map((n, i) => `${n} ${s.amt[i]}`).join(", ")}.`, "Read the base amounts and the yield."];
const lc = (x: string) => x.charAt(0).toLowerCase() + x.slice(1);
const nm = (n: string) => `the amount of ${lc(n)}`;

export const ITEM = defineItem({
  prefix: "rru", itemId: "ratios_rates_units.proportion.BR.P",
  hard: [
    {
      op: "chain2", structure: "기준 분량에 대한 배율을 구해 모든 재료의 양을 합한 뒤 배율을 곱함", extra: "배율(M ÷ N) → 모든 재료의 합의 연쇄 — medium 은 한 재료",
      concepts: ["비례(배율)", "막대그래프", "합계"],
      gen(rng) {
        return retry(80, () => {
          const s = pScene(rng); const M = rng.int(2, 30); if (M % s.N === 0 || M === s.N) return null; const tot = sum(s.amt); const c = (tot * M) / s.N; if (!oneDec(c) || c > 999) return null; const fig = pFig(s);
          return gInst(rng, {
            stimulus: intro(rng, s),
            question: rng.pick([`How many ${s.t.unit} of ingredients in all are needed to make ${M} ${s.t.yieldP}?`, `What is the total amount, in ${s.t.unit}, of all the ingredients needed for ${M} ${s.t.yieldP}?`]), correct: c,
            wrongs: pos([W(tot, "step_missing", "기준 분량의 합만 답했다."), W(r2(tot + M - s.N), "formula_misuse", "배율 대신 분량의 차를 더했다."), W(r2(tot * M), "step_missing", "나누지 않고 곱했다."), W(r2(tot / s.N), "step_missing", "한 분량의 합만 구했다."), W(r2(c + s.amt[0]), "other", "계산 중 어긋났다.")], c),
            verificationJs: figJs({ M }, fig, `${P_JS}return a.reduce((x, y) => x + y, 0) * P.M / N;`),
            trace: [read(s), [`배율 = ${M} ÷ ${s.N} 이다.`, "Scale factor = new yield ÷ base yield."], [`기준 합 = ${s.amt.join(" + ")} = ${tot} 이다.`, "Add the base amounts."], [`필요한 합 = ${tot} × ${M} ÷ ${s.N} = ${fmtNum(c)} 이다.`, "Scale the total."], [`따라서 ${fmtNum(c)} ${s.t.unit} 이다.`, "State the total."]], variant: "scaled_total_bar",
          }, fig);
        }, "chain");
      },
    },
    {
      op: "inverse", structure: "한 재료의 양이 주어질 때 만들 수 있는 분량을 비례로 역산", extra: "재료 양의 비(주어진 양 ÷ 기준 양)로 분량을 거꾸로 구해야 함 — 양을 분량에 곱하면 틀림 — medium 은 한 재료",
      concepts: ["비례(역산)", "막대그래프"],
      gen(rng) {
        return retry(80, () => {
          const s = pScene(rng); const i = rng.int(0, s.names.length - 1); const M = rng.int(2, 30); const L = (s.amt[i] * M) / s.N; if (!Number.isInteger(L) || M === s.N || L > 99) return null; const fig = pFig(s);
          return gInst(rng, {
            stimulus: `${intro(rng, s)} ${cap(s.t.who)} has exactly ${L} ${s.t.unit} of a single ingredient and uses it all.`,
            question: rng.pick([`If that ingredient is ${lc(s.names[i])}, how many ${s.t.yieldP} can be made?`, `Using the same ratio, how many ${s.t.yieldP} are made if the ingredient used up is ${lc(s.names[i])}?`]), correct: M,
            wrongs: pos([W(s.N, "step_missing", "기준 분량을 답했다."), W(r2(L * s.N), "formula_misuse", "양에 기준 분량을 곱했다."), W(r2(L + s.N), "formula_misuse", "더했다."), W(r2((L * s.N) / s.amt[i] + s.N), "other", "기준 분량을 한 번 더 더했다."), W(M + 1, "other", "계산 중 1 어긋났다.")], M),
            verificationJs: figJs({ nm: s.names[i], L }, fig, `${P_JS}return P.L * N / am(P.nm);`),
            trace: [read(s), [`${s.names[i]} 의 기준 양은 ${s.amt[i]} ${s.t.unit} 이다.`, "Find the base amount."], [`배율 = ${L} ÷ ${s.amt[i]} 이다.`, "Scale factor = available ÷ base amount."], [`분량 = ${s.N} × ${L} ÷ ${s.amt[i]} = ${M} 이다.`, "Multiply the base yield by the factor."], [`따라서 ${M} ${s.t.yieldP} 이다.`, "State the yield."]], variant: "yield_from_one_ingredient_bar",
          }, fig);
        }, "inverse");
      },
    },
    {
      op: "compare_scenarios", structure: "두 재료가 M 분량에서 필요한 양의 차를 비례로 구함", extra: "각 재료의 양을 배율로 늘린 뒤 차를 구해야 함(기준 양의 차에 배율을 곱해도 같지만 기준 차만 답하면 틀림) — medium 은 한 재료",
      concepts: ["비례(배율)", "막대그래프", "두 경우 비교"],
      gen(rng) {
        return retry(80, () => {
          const s = pScene(rng); const [i, j] = rng.shuffle([...s.names.keys()]).slice(0, 2); const M = rng.int(2, 30); const A = (s.amt[i] * M) / s.N, B = (s.amt[j] * M) / s.N; if (M === s.N || !Number.isInteger(A) || !Number.isInteger(B)) return null; const c = Math.abs(A - B); const fig = pFig(s);
          return gInst(rng, {
            stimulus: `${intro(rng, s)} The recipe is scaled up or down to make ${M} ${s.t.yieldP}.`,
            question: rng.pick([`At that size, how many more ${s.t.unit} are needed for ${nm(s.names[i])} than for ${nm(s.names[j])}? (Give the positive difference.)`, `At that size, what is the positive difference between ${nm(s.names[i])} and ${nm(s.names[j])}, in ${s.t.unit}?`]), correct: c,
            wrongs: pos([W(Math.abs(s.amt[i] - s.amt[j]), "step_missing", "기준 양의 차만 답했다."), W(A + B, "sign_error", "차 대신 합을 구했다."), W(Math.max(A, B), "step_missing", "한쪽 양만 답했다."), W(r2(Math.abs(s.amt[i] - s.amt[j]) * M), "formula_misuse", "나누지 않고 곱했다."), W(c + 1, "other", "계산 중 1 어긋났다.")], c),
            verificationJs: figJs({ ni: s.names[i], nj: s.names[j], M }, fig, `${P_JS}return Math.abs(am(P.ni) - am(P.nj)) * P.M / N;`),
            trace: [read(s), [`배율 = ${M} ÷ ${s.N} 이다.`, "Scale factor."], [`${s.names[i]}: ${s.amt[i]} × ${M} ÷ ${s.N} = ${A} 이다.`, "First amount."], [`${s.names[j]}: ${s.amt[j]} × ${M} ÷ ${s.N} = ${B} 이다.`, "Second amount."], [`차 = |${A} - ${B}| = ${c} 이다.`, "Take the positive difference."]], variant: "difference_of_scaled_bar",
          }, fig);
        }, "compare");
      },
    },
    {
      op: "constraint_select", structure: "두 재료의 보유량이 제한일 때 만들 수 있는 가장 많은 분량(정수)을 구함", extra: "재료마다 가능한 분량을 따로 구해 더 작은 쪽(제한 재료)을 골라야 함 — 한쪽만 보면 틀림 — medium 은 한 재료",
      concepts: ["비례", "막대그래프", "제한 재료(최솟값)"],
      gen(rng) {
        return retry(120, () => {
          const s = pScene(rng); const [i, j] = rng.shuffle([...s.names.keys()]).slice(0, 2); const Li = rng.int(4, 40), Lj = rng.int(4, 40); const mi = Math.floor((Li * s.N) / s.amt[i]), mj = Math.floor((Lj * s.N) / s.amt[j]); const c = Math.min(mi, mj); if (mi === mj || c < 1) return null; const fig = pFig(s);
          return gInst(rng, {
            stimulus: `${intro(rng, s)} ${cap(s.t.who)} has only ${Li} ${s.t.unit} of one ingredient and only ${Lj} ${s.t.unit} of another, and plenty of everything else. The first is ${lc(s.names[i])} and the second is ${lc(s.names[j])}. Only whole ${s.t.yieldP} can be made.`,
            question: rng.pick([`What is the greatest number of ${s.t.yieldP} that can be made?`, `At most how many whole ${s.t.yieldP} can be made with these supplies?`]), correct: c,
            wrongs: pos([W(Math.max(mi, mj), "condition_ignored", "제한이 덜한 재료를 기준으로 했다."), W(mi + mj, "sign_error", "두 분량을 더했다."), W(Math.ceil(Math.min((Li * s.N) / s.amt[i], (Lj * s.N) / s.amt[j])), "condition_ignored", "올림했다(정수 분량만 가능)."), W(c + 1, "other", "계산 중 1 어긋났다."), W(c - 1, "other", "계산 중 1 어긋났다.")], c),
            verificationJs: figJs({ ni: s.names[i], nj: s.names[j], Li, Lj }, fig, `${P_JS}return Math.min(Math.floor(P.Li * N / am(P.ni)), Math.floor(P.Lj * N / am(P.nj)));`),
            trace: [read(s), [`${s.names[i]}: ${Li} × ${s.N} ÷ ${s.amt[i]} → 최대 ${mi} 분량이다.`, "Servings allowed by the first ingredient."], [`${s.names[j]}: ${Lj} × ${s.N} ÷ ${s.amt[j]} → 최대 ${mj} 분량이다.`, "Servings allowed by the second ingredient."], [`둘 중 작은 값이 한계이다.`, "The smaller one limits the batch."], [`따라서 ${c} 이다.`, "State the greatest whole number."]], variant: "limiting_ingredient_bar",
          }, fig);
        }, "limit");
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "double", structure: "분량을 k 배(정수배)로 할 때 한 재료의 양을 구함", extra: "easy: 정수배", concepts: ["비례", "막대그래프"],
      gen(rng) {
        const s = pScene(rng); const i = rng.int(0, s.names.length - 1); const k = rng.pick([2, 3, 4]); const M = s.N * k; const c = s.amt[i] * k; const fig = pFig(s);
        return gInst(rng, { stimulus: `${intro(rng, s)} The plan is to make ${M} ${s.t.yieldP}.`, question: rng.pick([`How many ${s.t.unit} of ${lc(s.names[i])} are needed?`, `What amount of ${lc(s.names[i])}, in ${s.t.unit}, is needed for the plan?`]), correct: c, wrongs: pos([W(s.amt[i], "step_missing", "기준 양을 답했다."), W(s.amt[i] + k, "formula_misuse", "배율을 더했다."), W(s.amt[i] + (M - s.N), "formula_misuse", "분량의 차를 더했다."), W(c + s.amt[i], "other", "한 번 더 더했다."), W(M, "axis_misread", "분량을 답했다.")], c), verificationJs: figJs({ nm: s.names[i], M }, fig, `${P_JS}return am(P.nm) * P.M / N;`), trace: [read(s), [`배율 = ${M} ÷ ${s.N} = ${k} 이다.`, "Scale factor."], [`양 = ${s.amt[i]} × ${k} = ${c} 이다.`, "Multiply."]], variant: "multiple_bar" }, fig);
      },
    },
    {
      lv: "medium", name: "scaled_one", structure: "임의의 분량 M 에서 한 재료의 양을 비례로 구함", extra: "medium: 분수 배율", concepts: ["비례", "막대그래프"],
      gen(rng) {
        return retry(80, () => {
          const s = pScene(rng); const i = rng.int(0, s.names.length - 1); const M = rng.int(2, 30); const c = (s.amt[i] * M) / s.N; if (M === s.N || !oneDec(c) || Number.isInteger(M / s.N)) return null; const fig = pFig(s);
          return gInst(rng, { stimulus: `${intro(rng, s)} The plan is to make ${M} ${s.t.yieldP}.`, question: rng.pick([`How many ${s.t.unit} of ${lc(s.names[i])} are needed?`, `What amount of ${lc(s.names[i])}, in ${s.t.unit}, is needed for the plan?`]), correct: c, wrongs: pos([W(s.amt[i], "step_missing", "기준 양을 답했다."), W(r2(s.amt[i] + M - s.N), "formula_misuse", "분량의 차를 더했다."), W(r2(s.amt[i] * M), "step_missing", "나누지 않고 곱했다."), W(r2((s.amt[i] * s.N) / M), "formula_misuse", "배율을 거꾸로 썼다."), W(c + 1, "other", "계산 중 1 어긋났다.")], c), verificationJs: figJs({ nm: s.names[i], M }, fig, `${P_JS}return am(P.nm) * P.M / N;`), trace: [read(s), [`배율 = ${M} ÷ ${s.N} 이다.`, "Scale factor."], [`양 = ${s.amt[i]} × ${M} ÷ ${s.N} = ${fmtNum(c)} 이다.`, "Scale the amount."]], variant: "scaled_one_bar" }, fig);
        }, "medium");
      },
    },
  ],
});
function r2(n: number) { return Math.round(n * 10) / 10; }
void GenFail;
