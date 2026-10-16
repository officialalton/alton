// linear_inequalities.table_verification.TB.P — 표의 행(날·주문·판매자…)마다 두 양이 주어지고, 지문의 일차부등식 조건을 각 행이 만족하는지 검증한다(정답은 수).
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { withRetry } from "./_t6-kit";

type Topic = { rowHead: string; rows: string[]; uc: string; vc: string; u: string; v: string; uD: string; vD: string; vNoun: string; ctx: string; rule: string; ok: string; dir: "ge" | "le"; lo: number; hi: number };
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TOPICS: Topic[] = [
  { rowHead: "Day", rows: DAYS, uc: "Running (miles)", vc: "Swimming (miles)", u: "r", v: "s", uD: "the number of miles run", vD: "the number of miles swum", vNoun: "miles of swimming", ctx: "An athlete recorded her training for several days.", rule: "a day counts as a full training day when", ok: "is a full training day", dir: "ge", lo: 1, hi: 9 },
  { rowHead: "Shipment", rows: ["Shipment A", "Shipment B", "Shipment C", "Shipment D", "Shipment E", "Shipment F"], uc: "Small crates (crates)", vc: "Large crates (crates)", u: "a", v: "b", uD: "the number of small crates", vD: "the number of large crates", vNoun: "large crates", ctx: "A warehouse lists several shipments.", rule: "based on weight, a shipment fits on one truck only when", ok: "fits on one truck", dir: "le", lo: 1, hi: 12 },
  { rowHead: "Week", rows: ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"], uc: "Reading (hours)", vc: "Practice tests (hours)", u: "h", v: "t", uD: "the hours spent reading", vD: "the hours spent on practice tests", vNoun: "hours of practice tests", ctx: "A student logged study time for several weeks.", rule: "a week meets the study plan when", ok: "meets the study plan", dir: "ge", lo: 1, hi: 10 },
  { rowHead: "Seller", rows: ["Ava", "Ben", "Carla", "Dev", "Elena", "Femi"], uc: "Mugs sold (mugs)", vc: "Shirts sold (shirts)", u: "m", v: "s", uD: "the number of mugs sold", vD: "the number of shirts sold", vNoun: "shirts", ctx: "Several students sold items for a fundraiser.", rule: "a seller earns a prize when", ok: "earns a prize", dir: "ge", lo: 1, hi: 14 },
  { rowHead: "Meal", rows: ["Meal 1", "Meal 2", "Meal 3", "Meal 4", "Meal 5", "Meal 6"], uc: "Protein (grams)", vc: "Fat (grams)", u: "p", v: "f", uD: "the grams of protein", vD: "the grams of fat", vNoun: "grams of fat", ctx: "A nutrition app lists several meals.", rule: "counting calories, a meal fits a diet plan when", ok: "fits the diet plan", dir: "le", lo: 2, hi: 30 },
  { rowHead: "Plot", rows: ["Plot A", "Plot B", "Plot C", "Plot D", "Plot E", "Plot F"], uc: "Tomato plants (plants)", vc: "Pepper plants (plants)", u: "x", v: "y", uD: "the number of tomato plants", vD: "the number of pepper plants", vNoun: "pepper plants", ctx: "A community garden lists several garden plots.", rule: "based on daily water use, a plot stays within its water limit when", ok: "stays within its water limit", dir: "le", lo: 1, hi: 15 },
  { rowHead: "Team", rows: ["Hawks", "Lions", "Otters", "Bears", "Foxes", "Wolves"], uc: "Cans collected (cans)", vc: "Bottles collected (bottles)", u: "c", v: "b", uD: "the number of cans", vD: "the number of bottles", vNoun: "bottles", ctx: "Several teams collected items for a recycling drive.", rule: "a team earns a badge when", ok: "earns a badge", dir: "ge", lo: 5, hi: 40 },
  { rowHead: "Order", rows: ["Order 1", "Order 2", "Order 3", "Order 4", "Order 5", "Order 6"], uc: "Cakes (cakes)", vc: "Pies (pies)", u: "c", v: "p", uD: "the number of cakes", vD: "the number of pies", vNoun: "pies", ctx: "A bakery received several orders.", rule: "based on oven time, an order can be finished in one day only when", ok: "can be finished in one day", dir: "le", lo: 1, hi: 12 },
  { rowHead: "Trip", rows: ["Trip 1", "Trip 2", "Trip 3", "Trip 4", "Trip 5", "Trip 6"], uc: "Uphill hiking (miles)", vc: "Flat hiking (miles)", u: "u", v: "f", uD: "the miles hiked uphill", vD: "the miles hiked on flat ground", vNoun: "miles of flat hiking", ctx: "A hiking club planned several trips.", rule: "based on hiking time, a trip fits in one afternoon only when", ok: "fits in one afternoon", dir: "le", lo: 1, hi: 8 },
  { rowHead: "Store", rows: ["Store A", "Store B", "Store C", "Store D", "Store E", "Store F"], uc: "Laptops sold (laptops)", vc: "Tablets sold (tablets)", u: "L", v: "T", uD: "the number of laptops sold", vD: "the number of tablets sold", vNoun: "tablets", ctx: "An electronics chain reported sales at several stores for one day.", rule: "based on a revenue score, a store meets its sales target when", ok: "meets its sales target", dir: "ge", lo: 2, hi: 20 },
  { rowHead: "Shift", rows: ["Shift 1", "Shift 2", "Shift 3", "Shift 4", "Shift 5", "Shift 6"], uc: "Model X units (units)", vc: "Model Y units (units)", u: "x", v: "y", uD: "the number of Model X units", vD: "the number of Model Y units", vNoun: "Model Y units", ctx: "A factory recorded production for several shifts.", rule: "based on labor points, a shift meets its quota when", ok: "meets its quota", dir: "ge", lo: 2, hi: 25 },
  { rowHead: "Month", rows: ["January", "February", "March", "April", "May", "June"], uc: "Calls (hours)", vc: "Data (gigabytes)", u: "c", v: "d", uD: "the hours of calls", vD: "the gigabytes of data used", vNoun: "gigabytes of data", ctx: "A family tracked phone use for several months.", rule: "based on the plan's charges, a month stays within the budget when", ok: "stays within the budget", dir: "le", lo: 1, hi: 15 },
  { rowHead: "Volunteer", rows: ["Jordan", "Kiara", "Luis", "Mina", "Noah", "Priya"], uc: "Tutoring (hours)", vc: "Cleanup (hours)", u: "t", v: "c", uD: "the hours of tutoring", vD: "the hours of cleanup", vNoun: "hours of cleanup", ctx: "A service club recorded volunteer hours.", rule: "a volunteer earns a certificate when", ok: "earns a certificate", dir: "ge", lo: 1, hi: 12 },
  { rowHead: "Load", rows: ["Load 1", "Load 2", "Load 3", "Load 4", "Load 5", "Load 6"], uc: "Bags of sand (bags)", vc: "Bags of gravel (bags)", u: "s", v: "g", uD: "the number of bags of sand", vD: "the number of bags of gravel", vNoun: "bags of gravel", ctx: "A landscaping company planned several loads for its truck.", rule: "based on weight, a load is safe to carry only when", ok: "is safe to carry", dir: "le", lo: 2, hi: 20 },
];
type Scene = { t: Topic; names: string[]; us: number[]; vs: number[]; c1: number; c2: number; L: number; vals: number[]; fig: { type: "data"; kind: "table"; columns: string[]; rows: (string | number)[][] } };
const meets = (dir: "ge" | "le", v: number, L: number) => (dir === "ge" ? v >= L : v <= L);
/** 표집: 행 4~6개, 계수 c1 ≠ c2(2~9), 기준 L 은 값들 사이(적어도 하나 만족·하나 불만족). 마지막 행 마지막 칸 +1 로 만족 여부가 바뀌도록 마지막 행을 기준에 붙인다. */
function makeScene(rng: Rng, o: { t?: Topic } = {}): Scene {
  for (let tr = 0; tr < 200; tr++) {
    const t = o.t ?? rng.pick(TOPICS); const n = rng.int(4, 6); const names = t.rows.slice(0, n);
    const c1 = rng.int(2, 9), c2 = rng.int(2, 9); if (c1 === c2) continue;
    const us = names.map(() => rng.int(t.lo, t.hi)), vs = names.map(() => rng.int(t.lo, t.hi));
    const vals0 = us.map((u, i) => c1 * u + c2 * vs[i]); const srt = [...vals0].sort((a, b) => a - b);
    const L = srt[rng.int(1, n - 2)] + rng.int(0, 2); if (L >= 1000 || L < 5) continue;
    // 마지막 행: ge 면 L - c2·k 근처(한 칸 +1 로 넘어서게), le 면 L 바로 위(한 칸 +1 로… 대신 -) — 마지막 칸을 조정해 경계 민감성 확보
    const last = n - 1; const need = t.dir === "ge" ? Math.ceil((L - c1 * us[last]) / c2) - 1 : Math.floor((L - c1 * us[last]) / c2);
    if (need < t.lo || need > t.hi) continue; vs[last] = need;
    const vals = us.map((u, i) => c1 * u + c2 * vs[i]);
    const k = vals.filter((v) => meets(t.dir, v, L)).length; if (k < 1 || k >= n) continue;
    if (new Set(names.map((_, i) => `${us[i]},${vs[i]}`)).size !== n) continue;
    return { t, names, us, vs, c1, c2, L, vals, fig: { type: "data", kind: "table", columns: [t.rowHead, t.uc, t.vc], rows: names.map((nm, i) => [nm, us[i], vs[i]]) } };
  }
  throw new GenFail("검증 표 표집 실패");
}
const TEXOP = { ge: "\\ge", le: "\\le" };
const expr = (s: Scene, a = s.c1, b = s.c2) => `${a}${s.t.u} + ${b}${s.t.v}`;
const ruleTex = (s: Scene) => `${expr(s)} ${TEXOP[s.t.dir]} ${s.L}`;
const LEAD = ["", "", "Here is a question about a data table. ", "Read the information below. ", "A manager is reviewing some records. ", "A planner is checking a list against a rule. "];
const intro = (rng: Rng, s: Scene) => `${rng.pick(LEAD)}${s.t.ctx} ${rng.pick(["The table shows", "The table shown gives", "The table lists"])} ${s.t.uD} and ${s.t.vD} for each ${s.t.rowHead.toLowerCase()}. ${rng.pick([`Let $${s.t.u}$ be ${s.t.uD} and $${s.t.v}$ be ${s.t.vD}.`, `In what follows, $${s.t.u}$ is ${s.t.uD} and $${s.t.v}$ is ${s.t.vD}.`, `Here, $${s.t.u}$ represents ${s.t.uD}, and $${s.t.v}$ represents ${s.t.vD}.`])}`;
const ruleSent = (s: Scene) => ` ${s.t.rule.charAt(0).toUpperCase()}${s.t.rule.slice(1)} $${ruleTex(s)}$.`;
const VAL_JS = "const R=FIGURE.rows; const U=R.map(r=>r[1]), V=R.map(r=>r[2]); if (U.some(x=>typeof x!=='number')||V.some(x=>typeof x!=='number')) throw new Error('값 오류'); const val=(i,a,b)=>a*U[i]+b*V[i]; const ok=(x,L)=>P.dir===1?x>=L:x<=L;\n";
const dirP = (s: Scene) => (s.t.dir === "ge" ? 1 : 0);
const readT = (s: Scene): [string, string] => [`표에서 각 ${s.t.rowHead} 의 ${s.t.u}, ${s.t.v} 를 읽는다.`, "Read both quantities for every row."];
const evalT = (s: Scene): [string, string] => [`${expr(s)} 를 행마다 계산하면 ${s.vals.join(", ")} 이다.`, "Evaluate the expression for each row."];
const cntOk = (s: Scene, vals = s.vals, L = s.L) => vals.filter((v) => meets(s.t.dir, v, L)).length;
const pl = (s: Scene) => (s.t.rowHead === "Day" ? "days" : `${s.t.rowHead.toLowerCase()}s`);
const nonneg = <T extends { v: number }>(ws: T[]) => ws.filter((w) => w.v >= 0);

export const ITEM = defineItem(withRetry({
  prefix: "li", itemId: "linear_inequalities.table_verification.TB.P",
  hard: [
    {
      op: "constraint_select", structure: "각 행이 부등식 조건과 추가 조건(두 양의 합의 상한·하한)을 동시에 만족하는지 검증해 개수를 셈", extra: "두 부등식을 모두 행마다 확인해야 함(한 조건만·경계 함정) — medium 은 조건 하나",
      concepts: ["값표 검증", "일차부등식", "연립 조건"],
      gen(rng) {
        const s = makeScene(rng); const sums = s.us.map((u, i) => u + s.vs[i]); const srt = [...sums].sort((a, b) => a - b);
        const capUp = rng.chance(0.5); const K = srt[rng.int(1, srt.length - 2)];
        const okK = (i: number) => (capUp ? sums[i] <= K : sums[i] >= K);
        const both = s.vals.filter((v, i) => meets(s.t.dir, v, s.L) && okK(i)).length; const c1 = cntOk(s); const cK = sums.filter((_, i) => okK(i)).length;
        if (both === c1 || both === cK || both === 0) throw new GenFail("trivial");
        const sat2 = `${s.t.u} + ${s.t.v} ${capUp ? "\\le" : "\\ge"} ${K}`;
        return figInst(rng, {
          stimulus: `${intro(rng, s)}${ruleSent(s)} ${rng.pick([`A second requirement is $${sat2}$.`, `It must also be true that $${sat2}$.`])}`,
          question: rng.pick([`For how many ${pl(s)} in the table are both requirements met?`, `How many of the ${pl(s)} listed satisfy both inequalities?`]), correct: both,
          wrongs: nonneg([W(c1, "condition_ignored", "둘째 조건을 무시했다."), W(cK, "condition_ignored", "첫 조건을 무시했다."), W(s.names.length - both, "opposite", "조건을 만족하지 않는 행을 셌다."), W(both + 1, "other", "경계의 행을 잘못 판정했다."), W(both - 1, "other", "한 행을 빠뜨렸다.")]),
          verificationJs: figJs({ c1: s.c1, c2: s.c2, L: s.L, K, dir: dirP(s), cap: capUp ? 1 : 0 }, s.fig, `${VAL_JS}let c=0; for (let i=0;i<R.length;i++) { const sm=U[i]+V[i]; if (ok(val(i,P.c1,P.c2),P.L) && (P.cap? sm<=P.K : sm>=P.K)) c++; } return c;`),
          trace: [readT(s), evalT(s), [`첫 조건을 만족하는 행은 ${c1}개이다.`, "Check the first requirement."], [`${s.t.u} + ${s.t.v} 는 ${sums.join(", ")} 이다.`, "Compute the sums."], [`둘 다 만족하는 행은 ${both}개이다.`, "Count rows meeting both."]], variant: "count_rows_two_conditions",
        }, s.fig);
      },
    },
    {
      op: "param_condition", structure: "기준값을 상수 k 로 바꿀 때 표의 모든 행이 조건을 만족하는 k 의 최댓값(최솟값)을 구함", extra: "행마다 식의 값을 구해 모든 행이 만족할 매개변수 범위의 끝값을 정해야 함(최대·최소 혼동) — medium 은 고정 기준의 개수",
      concepts: ["값표 검증", "일차식의 값", "모든 행이 만족할 조건"],
      gen(rng) {
        const s = makeScene(rng); const ext = s.t.dir === "ge" ? Math.min(...s.vals) : Math.max(...s.vals); const oth = s.t.dir === "ge" ? Math.max(...s.vals) : Math.min(...s.vals);
        const srt = [...s.vals].sort((a, b) => a - b); const second = s.t.dir === "ge" ? srt[1] : srt[srt.length - 2]; if (second === ext) throw new GenFail("tie");
        return figInst(rng, {
          stimulus: `${intro(rng, s)} ${rng.pick(["Suppose that", "Under a new rule,"])} ${s.t.rule} $${expr(s)} ${TEXOP[s.t.dir]} k$, where $k$ is a constant.`,
          question: rng.pick([`What is the ${s.t.dir === "ge" ? "greatest" : "least"} value of $k$ for which every ${s.t.rowHead.toLowerCase()} in the table ${s.t.ok}?`, `If every ${s.t.rowHead.toLowerCase()} listed ${s.t.ok}, what is the ${s.t.dir === "ge" ? "maximum" : "minimum"} possible value of $k$?`]), correct: ext,
          wrongs: [W(oth, "opposite", "최댓값·최솟값을 바꿨다."), W(second, "condition_ignored", "한 행을 빼고 판정했다."), W(s.t.dir === "ge" ? Math.min(...s.us.map((u, i) => s.c2 * u + s.c1 * s.vs[i])) : Math.max(...s.us.map((u, i) => s.c2 * u + s.c1 * s.vs[i])), "formula_misuse", "계수를 바꿔 곱했다."), W(ext + (s.t.dir === "ge" ? 1 : -1), "other", "등호를 빼고 생각했다."), W(s.t.dir === "ge" ? Math.min(...s.us) * s.c1 + Math.min(...s.vs) * s.c2 : Math.max(...s.us) * s.c1 + Math.max(...s.vs) * s.c2, "step_missing", "열마다 따로 최솟값을 골랐다.")].filter((w) => w.v !== ext),
          verificationJs: figJs({ c1: s.c1, c2: s.c2, dir: dirP(s) }, s.fig, `${VAL_JS}const vs=R.map((_,i)=>val(i,P.c1,P.c2)); return P.dir===1 ? Math.min(...vs) : Math.max(...vs);`),
          trace: [readT(s), evalT(s), [`모든 행이 조건을 만족하려면 k 는 이 값들의 ${s.t.dir === "ge" ? "최솟값 이하" : "최댓값 이상"} 이어야 한다.`, "Every row must satisfy the inequality."], [`그 값은 ${ext} 이다.`, "Find the extreme row value."], [`따라서 k 의 ${s.t.dir === "ge" ? "최댓값" : "최솟값"}은 ${ext} 이다.`, "State the extreme k."]], variant: "parameter_all_rows",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "조건을 만족하지 않는 한 행에 대해, 다른 양은 그대로 두고 둘째 양을 최소 몇 단위 바꿔야 조건을 만족하는지 역산", extra: "부족(초과)분을 계수로 나누고 정수 올림해야 함(내림·계수 무시 함정) — medium 은 만족 행 개수",
      concepts: ["값표 검증", "일차부등식 풀이", "정수 조건(올림)"],
      gen(rng) {
        const s = makeScene(rng); const fails = s.names.map((_, i) => i).filter((i) => !meets(s.t.dir, s.vals[i], s.L)); const i = rng.pick(fails);
        const gap = Math.abs(s.L - s.vals[i]); const need = Math.ceil(gap / s.c2); if (need < 1) throw new GenFail("need");
        const add = s.t.dir === "ge"; if (!add && need > s.vs[i]) throw new GenFail("remove");
        const chg = add ? "increased" : "decreased";
        return figInst(rng, {
          stimulus: `${intro(rng, s)}${ruleSent(s)}`,
          question: rng.pick([`For ${s.names[i]}, ${s.t.uD} stays the same. What is the least whole number by which ${s.t.vD} must be ${chg} so that it ${s.t.ok}?`, `${s.names[i]} does not meet the condition. If only ${s.t.vD} changes, what is the least whole number by which it must be ${chg}?`, `Keeping ${s.t.uD} the same, by at least how many whole units must ${s.t.vD} be ${chg} for ${s.names[i]} to satisfy the inequality?`]), correct: need,
          wrongs: nonneg([W(Math.floor(gap / s.c2) === need ? need - 1 : Math.floor(gap / s.c2), "condition_ignored", "올림하지 않고 내림했다."), W(gap, "step_missing", "계수로 나누지 않았다."), W(Math.ceil(gap / s.c1), "formula_misuse", "다른 양의 계수로 나눴다."), W(need + 1, "other", "한 단위 더 갔다."), W(s.vs[i] + need, "step_missing", "바뀐 뒤의 전체 양을 답했다.")]).filter((w) => w.v !== need),
          verificationJs: figJs({ c1: s.c1, c2: s.c2, L: s.L, dir: dirP(s), row: s.names[i] }, s.fig, `${VAL_JS}const i=R.findIndex(r=>r[0]===P.row); if (i<0) throw new Error('행 없음'); const x=val(i,P.c1,P.c2); if (ok(x,P.L)) throw new Error('이미 만족'); return Math.ceil(Math.abs(P.L-x)/P.c2);`),
          trace: [[`표에서 ${s.names[i]} 행: ${s.t.u} = ${s.us[i]}, ${s.t.v} = ${s.vs[i]} 이다.`, "Read the row."], [`${expr(s)} = ${s.vals[i]} 로 기준 ${s.L} 을 만족하지 않는다.`, "Evaluate and compare with the bound."], [`차이는 |${s.L} - ${s.vals[i]}| = ${gap} 이다.`, "Find the shortfall."], [`${s.t.v} 한 단위마다 ${s.c2} 씩 바뀌므로 ${gap} ÷ ${s.c2} 이상 필요하다.`, "Divide by the coefficient."], [`가장 작은 정수는 ${need} 이다.`, "Round up to a whole number."]], variant: "least_change_to_pass",
        }, s.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "원래 조건과 계수를 바꾼 새 조건 각각에서 만족하는 행의 개수를 세어 그 차를 구함", extra: "같은 표를 두 규칙으로 각각 검증하고 개수 차를 구해야 함 — medium 은 한 규칙의 개수",
      concepts: ["값표 검증", "일차식의 값", "두 규칙 비교"],
      gen(rng) {
        const s = makeScene(rng); const vals2 = s.us.map((u, i) => s.c2 * u + s.c1 * s.vs[i]); const a = cntOk(s), b = cntOk(s, vals2); if (a === b) throw new GenFail("same");
        const d = Math.abs(a - b);
        return figInst(rng, {
          stimulus: `${intro(rng, s)}${ruleSent(s)} ${rng.pick(["A proposed new rule replaces this with", "Under a different rule, the condition is"])} $${expr(s, s.c2, s.c1)} ${TEXOP[s.t.dir]} ${s.L}$.`,
          question: rng.pick([`What is the positive difference between the number of ${pl(s)} in the table that meet the original rule and the number that meet the new rule?`, `By how much do the numbers of ${pl(s)} in the table meeting the two rules differ?`]), correct: d,
          wrongs: nonneg([W(a, "step_missing", "원래 규칙의 개수만 답했다."), W(b, "step_missing", "새 규칙의 개수만 답했다."), W(a + b, "sign_error", "차가 아니라 합을 구했다."), W(d + 1, "other", "경계의 행을 잘못 셌다."), W(s.names.length - d, "opposite", "여집합을 셌다.")]).filter((w) => w.v !== d),
          verificationJs: figJs({ c1: s.c1, c2: s.c2, L: s.L, dir: dirP(s) }, s.fig, `${VAL_JS}let a=0,b=0; for (let i=0;i<R.length;i++) { if (ok(val(i,P.c1,P.c2),P.L)) a++; if (ok(val(i,P.c2,P.c1),P.L)) b++; } return Math.abs(a-b);`),
          trace: [readT(s), evalT(s), [`원래 규칙을 만족하는 행은 ${a}개이다.`, "Count under the original rule."], [`${expr(s, s.c2, s.c1)} 는 ${vals2.join(", ")} 이므로 새 규칙은 ${b}개이다.`, "Count under the new rule."], [`차 = |${a} - ${b}| = ${d} 이다.`, "Take the difference."]], variant: "compare_two_rules",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "row_value", structure: "표의 한 행에서 부등식 좌변의 값을 계산함", extra: "easy: 한 행 대입", concepts: ["값표", "일차식의 값"],
      gen(rng) {
        const s = makeScene(rng); const i = rng.int(0, s.names.length - 1); const v = s.vals[i];
        return figInst(rng, { stimulus: `${intro(rng, s)}${ruleSent(s)}`, question: `What is the value of $${expr(s)}$ for ${s.names[i]}?`, correct: v, wrongs: nonneg([W(s.c2 * s.us[i] + s.c1 * s.vs[i], "formula_misuse", "계수를 바꿔 곱했다."), W(s.us[i] + s.vs[i], "step_missing", "계수를 곱하지 않았다."), W(s.vals[(i + 1) % s.vals.length], "axis_misread", "다른 행을 읽었다."), W(v - s.L, "other", "기준과의 차를 구했다.")]).filter((w) => w.v !== v), verificationJs: figJs({ c1: s.c1, c2: s.c2, dir: dirP(s), row: s.names[i] }, s.fig, `${VAL_JS}const i=R.findIndex(r=>r[0]===P.row); if (i<0) throw new Error('행 없음'); return val(i,P.c1,P.c2);`), trace: [[`${s.names[i]} 행: ${s.us[i]}, ${s.vs[i]}.`, "Read the row."], [`${s.c1}·${s.us[i]} + ${s.c2}·${s.vs[i]} = ${v} 이다.`, "Evaluate."]], variant: "evaluate_row",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "count_rows", structure: "표의 행 중 부등식 조건을 만족하는 행의 개수를 셈", extra: "medium: 행마다 계산·비교", concepts: ["값표 검증", "일차부등식"],
      gen(rng) {
        const s = makeScene(rng); const k = cntOk(s); const strict = s.vals.filter((v) => (s.t.dir === "ge" ? v > s.L : v < s.L)).length;
        return figInst(rng, { stimulus: `${intro(rng, s)}${ruleSent(s)}`, question: rng.pick([`How many of the ${pl(s)} in the table meet this condition?`, `For how many ${pl(s)} listed in the table is the inequality true?`]), correct: k, wrongs: nonneg([W(s.names.length - k, "opposite", "만족하지 않는 행을 셌다."), W(strict === k ? k - 1 : strict, "condition_ignored", "등호인 경우를 빼고 셌다."), W(cntOk(s, s.us.map((u, i) => s.c2 * u + s.c1 * s.vs[i])), "formula_misuse", "계수를 바꿔 계산했다."), W(k + 1, "other", "한 행을 더 셌다.")]).filter((w) => w.v !== k), verificationJs: figJs({ c1: s.c1, c2: s.c2, L: s.L, dir: dirP(s) }, s.fig, `${VAL_JS}let c=0; for (let i=0;i<R.length;i++) if (ok(val(i,P.c1,P.c2),P.L)) c++; return c;`), trace: [readT(s), evalT(s), [`기준 ${s.L} 과 비교하면 ${k}개가 만족한다.`, "Compare with the bound and count."]], variant: "count_rows_meeting",
        }, s.fig);
      },
    },
  ],
}));
