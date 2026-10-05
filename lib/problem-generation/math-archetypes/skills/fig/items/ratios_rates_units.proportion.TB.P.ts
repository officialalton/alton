// ratios_rates_units.proportion.TB.P — 기준 분량(제목: 'Makes N servings')의 재료 표에서 비례로 다른 분량의 양을 구하고, 합계·역산·제한 재료·두 재료 비교로 확장한다.
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs, oneDec } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { pos, r1, retry, sum, tab } from "./_t4-kit";

type MixTopic = { what: string; rows: string[]; unit: string; yieldS: string; yieldP: string; who: string };
const MIX: MixTopic[] = [
  { what: "pancake batter", rows: ["Flour", "Milk", "Sugar", "Oats", "Butter"], unit: "cups", yieldS: "serving", yieldP: "servings", who: "a cook" },
  { what: "fruit punch", rows: ["Apple juice", "Orange juice", "Pineapple juice", "Sparkling water", "Lemon juice"], unit: "cups", yieldS: "pitcher", yieldP: "pitchers", who: "a caterer" },
  { what: "granola", rows: ["Oats", "Almonds", "Raisins", "Honey", "Coconut"], unit: "cups", yieldS: "jar", yieldP: "jars", who: "a baker" },
  { what: "trail mix", rows: ["Peanuts", "Raisins", "Pretzels", "Chocolate chips", "Sunflower seeds"], unit: "ounces", yieldS: "bag", yieldP: "bags", who: "a camp counselor" },
  { what: "vegetable soup", rows: ["Broth", "Carrots", "Potatoes", "Beans", "Celery"], unit: "cups", yieldS: "bowl", yieldP: "bowls", who: "a chef" },
  { what: "salad dressing", rows: ["Olive oil", "Vinegar", "Mustard", "Honey", "Lemon juice"], unit: "tablespoons", yieldS: "salad", yieldP: "salads", who: "a restaurant cook" },
  { what: "smoothie mix", rows: ["Yogurt", "Bananas", "Strawberries", "Spinach", "Milk"], unit: "cups", yieldS: "glass", yieldP: "glasses", who: "a juice bar" },
  { what: "potting soil", rows: ["Compost", "Peat moss", "Sand", "Perlite", "Bark"], unit: "scoops", yieldS: "pot", yieldP: "pots", who: "a gardener" },
  { what: "bird feed", rows: ["Millet", "Sunflower seeds", "Cracked corn", "Peanuts", "Thistle"], unit: "scoops", yieldS: "feeder", yieldP: "feeders", who: "a nature center" },
  { what: "concrete mix", rows: ["Cement", "Sand", "Gravel", "Water", "Lime"], unit: "buckets", yieldS: "batch", yieldP: "batches", who: "a builder" },
  { what: "paint mix", rows: ["White paint", "Blue paint", "Yellow paint", "Red paint", "Thinner"], unit: "pints", yieldS: "wall", yieldP: "walls", who: "a painter" },
  { what: "cookie dough", rows: ["Flour", "Sugar", "Butter", "Chocolate chips", "Oats"], unit: "cups", yieldS: "tray", yieldP: "trays", who: "a bakery" },
  { what: "bread dough", rows: ["Flour", "Water", "Whole wheat flour", "Seeds", "Milk"], unit: "cups", yieldS: "loaf", yieldP: "loaves", who: "a baker" },
  { what: "chili", rows: ["Beans", "Tomatoes", "Onions", "Peppers", "Corn"], unit: "cups", yieldS: "bowl", yieldP: "bowls", who: "a food truck" },
  { what: "fertilizer blend", rows: ["Nitrogen mix", "Phosphate mix", "Potash", "Bone meal", "Compost tea"], unit: "scoops", yieldS: "garden bed", yieldP: "garden beds", who: "a farmer" },
  { what: "lemonade", rows: ["Water", "Lemon juice", "Sugar syrup", "Ice", "Mint tea"], unit: "cups", yieldS: "jug", yieldP: "jugs", who: "a school club" },
  { what: "muffin batter", rows: ["Flour", "Blueberries", "Milk", "Sugar", "Oil"], unit: "cups", yieldS: "dozen muffins", yieldP: "dozen muffins", who: "a cafe" },
  { what: "oatmeal", rows: ["Oats", "Milk", "Water", "Raisins", "Walnuts"], unit: "cups", yieldS: "serving", yieldP: "servings", who: "a camp kitchen" },
  { what: "pizza dough", rows: ["Flour", "Water", "Olive oil", "Semolina", "Cornmeal"], unit: "cups", yieldS: "pizza", yieldP: "pizzas", who: "a pizzeria" },
  { what: "mosaic grout", rows: ["Grout powder", "Water", "Sand", "Color powder", "Sealer"], unit: "scoops", yieldS: "tile panel", yieldP: "tile panels", who: "an artist" },
  { what: "fish food", rows: ["Flakes", "Pellets", "Shrimp bits", "Algae wafers", "Bloodworms"], unit: "scoops", yieldS: "tank", yieldP: "tanks", who: "an aquarium keeper" },
];
type PScene = { t: MixTopic; names: string[]; amt: number[]; N: number };
function pScene(rng: Rng, n = rng.int(3, 5)): PScene {
  const t = rng.pick(MIX); const names = rng.shuffle(t.rows).slice(0, n); const N = rng.pick([2, 3, 4, 5, 6, 8]);
  return retry(40, () => { const amt = names.map(() => rng.int(1, 12)); return new Set(amt).size === n ? { t, names, amt, N } : null; }, "재료 장면");
}
const pFig = (s: PScene) => tab(["Ingredient", `Amount (${s.t.unit})`], s.names.map((nm, i) => [nm, s.amt[i]]), `Makes ${s.N} ${s.N === 1 ? s.t.yieldS : s.t.yieldP}`);
const intro = (rng: Rng, s: PScene) => rng.pick([
  `The table shows the amount of each ingredient that ${s.t.who} uses to make ${s.t.what}. The amounts are for the number of ${s.t.yieldP} given in the table title.`,
  `A recipe for ${s.t.what} is shown in the table. The table title tells how many ${s.t.yieldP} the listed amounts make.`,
  `To make ${s.t.what}, ${s.t.who} follows the recipe in the table shown. All the ingredients are always used in the same ratio.`,
  `${cap(s.t.who)} makes ${s.t.what} using the amounts in the table, which make the number of ${s.t.yieldP} stated in its title. The ingredients stay in the same ratio for any amount.`,
]);
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
/** FIGURE.title 의 기준 분량 N 과 재료 양 a·이름 nm 을 읽는 JS. */
const P_JS = "const mt=/Makes (\\d+)/.exec(FIGURE.title||''); if (!mt) throw new Error('기준 분량 없음'); const N=Number(mt[1]); const nm=FIGURE.rows.map(r=>r[0]); const a=FIGURE.rows.map(r=>r[1]); if (a.some(x=>typeof x!=='number'||x<=0)) throw new Error('양 오류'); const am=(k)=>{ const i=nm.indexOf(k); if (i<0) throw new Error('행 없음'); return a[i]; };\n";
const read = (s: PScene): [string, string] => [`표: ${s.N} ${s.t.yieldP} 기준, ${s.names.map((n, i) => `${n} ${s.amt[i]}`).join(", ")}.`, "Read the base amounts and the yield."];
const lc = (x: string) => x.charAt(0).toLowerCase() + x.slice(1);

export const ITEM = defineItem({
  prefix: "rru", itemId: "ratios_rates_units.proportion.TB.P",
  hard: [
    {
      op: "chain2", structure: "기준 분량에 대한 배율을 구해 모든 재료의 양을 합한 뒤 배율을 곱함", extra: "배율(M ÷ N) → 모든 재료의 합의 연쇄 — medium 은 한 재료",
      concepts: ["비례(배율)", "재료 표", "합계"],
      gen(rng) {
        return retry(80, () => {
          const s = pScene(rng); const M = rng.int(2, 30); if (M % s.N === 0 || M === s.N) return null; const tot = sum(s.amt); const c = (tot * M) / s.N; if (!oneDec(c) || c > 999) return null; const fig = pFig(s);
          return figInst(rng, {
            stimulus: intro(rng, s),
            question: rng.pick([`What is the total amount of all the ingredients, in ${s.t.unit}, needed to make ${M} ${s.t.yieldP}?`, `How many ${s.t.unit} of ingredients in all are needed for ${M} ${s.t.yieldP}?`]), correct: c,
            wrongs: pos([W(tot * M, "step_missing", "기준 분량으로 나누지 않았다."), W(tot, "step_missing", "배율을 적용하지 않았다."), W(r1((tot * s.N) / M), "opposite", "배율을 거꾸로 적용했다."), W(tot + M - s.N, "formula_misuse", "분량 차를 더했다."), W(r1(((tot - s.amt[s.amt.length - 1]) * M) / s.N), "step_missing", "마지막 재료를 빠뜨렸다.")], c),
            verificationJs: figJs({ M }, fig, `${P_JS}return a.reduce((x, y) => x + y, 0) * P.M / N;`),
            trace: [read(s), [`배율 = ${M} ÷ ${s.N} = ${fmtNum(M / s.N)} 이다.`, "Find the scale factor."], [`기준 합계 = ${s.amt.join(" + ")} = ${tot} 이다.`, "Add the base amounts."], [`${tot} × ${M} ÷ ${s.N} = ${fmtNum(c)} 이다.`, "Scale the total."], [`따라서 ${fmtNum(c)} ${s.t.unit} 이다.`, "That is the total amount."]], variant: "scaled_total",
          }, fig);
        }, "chain2");
      },
    },
    {
      op: "inverse", structure: "한 재료를 Q 만큼 썼을 때 다른 재료의 양을 비례로 역산", extra: "쓴 양에서 배율(또는 분량)을 거꾸로 구한 뒤 다른 재료에 적용 — 표의 두 재료의 비를 써야 함 — medium 은 분량에서 양",
      concepts: ["비례", "재료 표", "역산"],
      gen(rng) {
        return retry(120, () => {
          const s = pScene(rng); const [i, j] = rng.shuffle([...s.names.keys()]).slice(0, 2); const f = rng.pick([1.5, 2, 2.5, 3, 4, 5, 6]); const Q = s.amt[i] * f; if (!Number.isInteger(Q) || Q === s.amt[i]) return null; const c = s.amt[j] * f; if (!oneDec(c)) return null; const fig = pFig(s);
          return figInst(rng, {
            stimulus: `${intro(rng, s)} One day, a bigger batch is made with ${Q} ${s.t.unit} of ${lc(s.names[i])}.`,
            question: rng.pick([`How many ${s.t.unit} of ${lc(s.names[j])} should be used with it?`, `To keep the same ratio, what amount of ${lc(s.names[j])}, in ${s.t.unit}, is needed?`]), correct: c,
            wrongs: pos([W(Q - s.amt[i] + s.amt[j], "formula_misuse", "늘어난 양만큼 더했다(비가 아닌 차를 유지)."), W(r1((s.amt[i] * Q) / s.amt[j]), "opposite", "두 재료의 비를 거꾸로 썼다."), W(s.amt[j], "step_missing", "표의 양을 그대로 답했다."), W(Q, "other", "쓴 양을 그대로 답했다."), W(r1(s.amt[j] * f * s.N), "unit_error", "분량 수를 한 번 더 곱했다.")], c),
            verificationJs: figJs({ ni: s.names[i], nj: s.names[j], Q }, fig, `${P_JS}return P.Q / am(P.ni) * am(P.nj);`),
            trace: [read(s), [`${s.names[i]} 기준 ${s.amt[i]}, ${s.names[j]} 기준 ${s.amt[j]} 이다.`, "Pick the two ingredients."], [`배율 = ${Q} ÷ ${s.amt[i]} = ${fmtNum(f)} 이다.`, "Find the scale factor from the amount used."], [`비가 같으므로 ${s.names[j]} 도 ${fmtNum(f)} 배이다.`, "The ratio stays the same."], [`${s.amt[j]} × ${fmtNum(f)} = ${fmtNum(c)} 이다.`, "Scale the second ingredient."]], variant: "other_ingredient_from_used",
          }, fig);
        }, "inverse");
      },
    },
    {
      op: "constraint_select", structure: "두 재료의 보유량으로 각각 만들 수 있는 분량을 구해 작은 쪽(제한 재료)으로 최대 분량을 정함", extra: "재료마다 가능한 분량을 비례로 구하고 최솟값을 고른 뒤 정수로 내림 — medium 은 한 재료",
      concepts: ["비례", "제한 재료(최솟값)", "정수 내림"],
      gen(rng) {
        return retry(200, () => {
          const s = pScene(rng); const [i, j] = rng.shuffle([...s.names.keys()]).slice(0, 2); const Qi = rng.int(s.amt[i] + 1, s.amt[i] * 8), Qj = rng.int(s.amt[j] + 1, s.amt[j] * 8);
          const ci = (Qi * s.N) / s.amt[i], cj = (Qj * s.N) / s.amt[j]; const c = Math.floor(Math.min(ci, cj)); if (Math.abs(ci - cj) < 1 || Number.isInteger(Math.min(ci, cj)) || c < 2 || c > 999) return null; const fig = pFig(s);
          return figInst(rng, {
            stimulus: `${intro(rng, s)} There are ${Qi} ${s.t.unit} of ${lc(s.names[i])} and ${Qj} ${s.t.unit} of ${lc(s.names[j])} available, and there is plenty of every other ingredient.`,
            question: rng.pick([`What is the greatest whole number of ${s.t.yieldP} that can be made?`, `At most, how many whole ${s.t.yieldP} can be made with these ingredients?`]), correct: c,
            wrongs: pos([W(Math.floor(Math.max(ci, cj)), "condition_ignored", "더 많이 만들 수 있는 재료를 기준으로 했다."), W(Math.ceil(Math.min(ci, cj)), "other", "내림 대신 올림을 했다."), W(Math.floor(Math.min(Qi / s.amt[i], Qj / s.amt[j])), "step_missing", "기준 분량을 곱하지 않았다(배치 수를 답했다)."), W(Math.floor((Qi + Qj) * s.N / (s.amt[i] + s.amt[j])), "formula_misuse", "두 재료를 합쳐서 계산했다."), W(c - 1, "other", "하나 적게 셌다.")], c),
            verificationJs: figJs({ ni: s.names[i], nj: s.names[j], Qi, Qj }, fig, `${P_JS}return Math.floor(Math.min(P.Qi / am(P.ni), P.Qj / am(P.nj)) * N + 1e-9);`),
            trace: [read(s), [`${s.names[i]}: ${Qi} ÷ ${s.amt[i]} × ${s.N} = ${fmtNum(r1(ci))} ${s.t.yieldP} 분량이다.`, "Servings allowed by the first ingredient."], [`${s.names[j]}: ${Qj} ÷ ${s.amt[j]} × ${s.N} = ${fmtNum(r1(cj))} ${s.t.yieldP} 분량이다.`, "Servings allowed by the second ingredient."], [`작은 쪽이 제한한다: ${fmtNum(r1(Math.min(ci, cj)))} 이다.`, "The smaller value limits the amount."], [`정수로 내리면 ${c} 이다.`, "Round down to a whole number."]], variant: "limiting_ingredient",
          }, fig);
        }, "select");
      },
    },
    {
      op: "compare_scenarios", structure: "M 분량에서 두 재료의 양을 각각 비례로 구해 차를 구함", extra: "두 재료 모두 같은 배율로 키운 뒤 비교(차도 배율만큼 커짐) — medium 은 한 재료",
      concepts: ["비례(배율)", "재료 표", "두 양 비교"],
      gen(rng) {
        return retry(120, () => {
          const s = pScene(rng); const [i, j] = rng.shuffle([...s.names.keys()]).slice(0, 2); if (s.amt[i] <= s.amt[j]) return null; const M = rng.int(2, 40); if (M % s.N === 0 || M === s.N) return null;
          const c = ((s.amt[i] - s.amt[j]) * M) / s.N; if (!oneDec(c) || c > 999) return null; const fig = pFig(s);
          return figInst(rng, {
            stimulus: `${intro(rng, s)} Suppose ${s.t.who} makes ${M} ${s.t.yieldP}.`,
            question: rng.pick([`How many more ${s.t.unit} of ${lc(s.names[i])} than ${lc(s.names[j])} are needed?`, `By how many ${s.t.unit} does the amount of ${lc(s.names[i])} exceed the amount of ${lc(s.names[j])}?`]), correct: c,
            wrongs: pos([W(s.amt[i] - s.amt[j], "step_missing", "배율을 적용하지 않았다."), W(r1(((s.amt[i] + s.amt[j]) * M) / s.N), "sign_error", "차 대신 합을 구했다."), W(r1((s.amt[i] * M) / s.N), "step_missing", "한 재료의 양만 구했다."), W((s.amt[i] - s.amt[j]) * M, "step_missing", "기준 분량으로 나누지 않았다."), W(r1(s.amt[i] - s.amt[j] + M - s.N), "formula_misuse", "분량 차를 더했다.")], c),
            verificationJs: figJs({ ni: s.names[i], nj: s.names[j], M }, fig, `${P_JS}return (am(P.ni) - am(P.nj)) * P.M / N;`),
            trace: [read(s), [`배율 = ${M} ÷ ${s.N} = ${fmtNum(M / s.N)} 이다.`, "Find the scale factor."], [`${s.names[i]}: ${s.amt[i]} × ${fmtNum(M / s.N)} = ${fmtNum((s.amt[i] * M) / s.N)} 이다.`, "Scale the first ingredient."], [`${s.names[j]}: ${s.amt[j]} × ${fmtNum(M / s.N)} = ${fmtNum((s.amt[j] * M) / s.N)} 이다.`, "Scale the second ingredient."], [`차 = ${fmtNum(c)} 이다.`, "Subtract."]], variant: "scaled_difference",
          }, fig);
        }, "compare");
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "multiple_batch", structure: "기준 분량의 k 배를 만들 때 한 재료의 양", extra: "easy: 정수 배율", concepts: ["비례", "재료 표"],
      gen(rng) {
        const s = pScene(rng); const i = rng.int(0, s.names.length - 1); const k = rng.int(2, 5); const M = k * s.N; const c = s.amt[i] * k; const fig = pFig(s);
        return figInst(rng, { stimulus: intro(rng, s), question: `How many ${s.t.unit} of ${lc(s.names[i])} are needed to make ${M} ${s.t.yieldP}?`, correct: c, wrongs: pos([W(s.amt[i] * M, "step_missing", "기준 분량으로 나누지 않았다."), W(s.amt[i], "step_missing", "배율을 적용하지 않았다."), W(s.amt[i] + M - s.N, "formula_misuse", "분량 차를 더했다."), W(s.amt[(i + 1) % s.amt.length] * k, "axis_misread", "다른 재료를 읽었다.")], c), verificationJs: figJs({ nm: s.names[i], M }, fig, `${P_JS}return am(P.nm) * P.M / N;`), trace: [[`배율 = ${M} ÷ ${s.N} = ${k} 이다.`, "Find the scale factor."], [`${s.amt[i]} × ${k} = ${c} 이다.`, "Scale the amount."]], variant: "multiple_batch" }, fig);
      },
    },
    {
      lv: "medium", name: "scale_amount", structure: "임의의 분량 M 에 대한 한 재료의 양을 비례로 구함", extra: "medium: 단위당 양 → 배율", concepts: ["비례", "재료 표"],
      gen(rng) {
        return retry(80, () => {
          const s = pScene(rng); const i = rng.int(0, s.names.length - 1); const M = rng.int(2, 30); if (M % s.N === 0) return null; const c = (s.amt[i] * M) / s.N; if (!oneDec(c)) return null; const fig = pFig(s);
          return figInst(rng, { stimulus: intro(rng, s), question: rng.pick([`How many ${s.t.unit} of ${lc(s.names[i])} are needed to make ${M} ${s.t.yieldP}?`, `For ${M} ${s.t.yieldP}, how many ${s.t.unit} of ${lc(s.names[i])} are used?`]), correct: c, wrongs: pos([W(s.amt[i] * M, "step_missing", "기준 분량으로 나누지 않았다."), W(r1((s.amt[i] * s.N) / M), "opposite", "배율을 거꾸로 적용했다."), W(s.amt[i] + M - s.N, "formula_misuse", "분량 차를 더했다."), W(r1(s.amt[i] / s.N), "step_missing", "한 분량당 양만 구했다.")], c), verificationJs: figJs({ nm: s.names[i], M }, fig, `${P_JS}return am(P.nm) * P.M / N;`), trace: [[`${s.names[i]} 은 ${s.N} ${s.t.yieldP} 에 ${s.amt[i]} 이다.`, "Read the row and the yield."], [`한 분량당 ${s.amt[i]} ÷ ${s.N} = ${fmtNum(s.amt[i] / s.N)} 이다.`, "Amount per unit."], [`${fmtNum(s.amt[i] / s.N)} × ${M} = ${fmtNum(c)} 이다.`, "Scale up."]], variant: "scale_amount" }, fig);
        }, "medium");
      },
    },
  ],
});
