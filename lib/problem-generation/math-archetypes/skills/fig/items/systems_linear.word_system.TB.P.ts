// systems_linear.word_system.TB.P — 표에 두 품목의 가격(단가)이 있고, 지문의 총 개수·총액으로 연립 문장제를 푼다(가격은 표에만).
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { withRetry } from "./_t6-kit";

type Topic = { head: string; A: string; B: string; noun: string; who: string; did: string; where: string; lo: number; hi: number };
const TOPICS: Topic[] = [
  { head: "Ticket type", A: "Adult", B: "Child", noun: "tickets", who: "A family", did: "bought", where: "at a science museum", lo: 6, hi: 30 },
  { head: "Seat", A: "Balcony", B: "Floor", noun: "seats", who: "A theater club", did: "reserved", where: "for a concert", lo: 10, hi: 45 },
  { head: "Notebook", A: "Spiral", B: "Composition", noun: "notebooks", who: "A teacher", did: "bought", where: "for a classroom", lo: 2, hi: 9 },
  { head: "Plant", A: "Fern", B: "Cactus", noun: "plants", who: "A cafe owner", did: "bought", where: "at a garden center", lo: 4, hi: 25 },
  { head: "Pass", A: "Weekend", B: "Weekday", noun: "passes", who: "A ski club", did: "purchased", where: "at a ski resort", lo: 20, hi: 80 },
  { head: "Pizza", A: "Large", B: "Medium", noun: "pizzas", who: "A soccer coach", did: "ordered", where: "for a team party", lo: 8, hi: 22 },
  { head: "Book format", A: "Hardcover", B: "Paperback", noun: "books", who: "A library", did: "bought", where: "at a book sale", lo: 3, hi: 28 },
  { head: "Shirt", A: "Long-sleeve", B: "Short-sleeve", noun: "shirts", who: "A club", did: "ordered", where: "for an event", lo: 7, hi: 24 },
  { head: "Bus fare", A: "Express", B: "Local", noun: "rides", who: "A commuter", did: "paid for", where: "in one month", lo: 2, hi: 9 },
  { head: "Lesson", A: "Private", B: "Small-group", noun: "lessons", who: "A student", did: "took", where: "at a music school", lo: 15, hi: 60 },
  { head: "Paint can", A: "Gallon", B: "Quart", noun: "cans of paint", who: "A painter", did: "bought", where: "for a job", lo: 8, hi: 40 },
  { head: "Snack", A: "Granola", B: "Fruit", noun: "snacks", who: "A camp director", did: "bought", where: "for a hike", lo: 1, hi: 6 },
  { head: "Room", A: "Suite", B: "Standard", noun: "room nights", who: "A travel agent", did: "booked", where: "at a hotel", lo: 60, hi: 200 },
  { head: "Flower", A: "Rose", B: "Tulip", noun: "flowers", who: "A florist", did: "sold", where: "in one morning", lo: 2, hi: 8 },
  { head: "Coffee", A: "Latte", B: "Drip coffee", noun: "drinks", who: "A coffee cart", did: "sold", where: "in one hour", lo: 2, hi: 7 },
  { head: "Game ticket", A: "Reserved", B: "General", noun: "tickets", who: "A school", did: "sold", where: "for a basketball game", lo: 4, hi: 18 },
  { head: "Tile", A: "Marble", B: "Ceramic", noun: "tiles", who: "A contractor", did: "bought", where: "for a kitchen", lo: 3, hi: 15 },
  { head: "Workshop", A: "Full-day", B: "Half-day", noun: "workshop seats", who: "A company", did: "paid for", where: "at a conference", lo: 40, hi: 150 },
  { head: "Cupcake", A: "Frosted", B: "Plain", noun: "cupcakes", who: "A bakery", did: "sold", where: "in one day", lo: 2, hi: 6 },
  { head: "Membership", A: "Premium", B: "Basic", noun: "memberships", who: "A gym", did: "sold", where: "in one week", lo: 20, hi: 90 },
];
type Scene = { t: Topic; pA: number; pB: number; a: number; b: number; n: number; T: number; fig: { type: "data"; kind: "table"; columns: string[]; rows: (string | number)[][] } };
/** 가격 표(행 A·B, 열 가격) + 정수 해 (a, b). pA > pB. */
function makeScene(rng: Rng, o: { stores?: boolean } = {}): Scene & { qA?: number; qB?: number } {
  for (let tr = 0; tr < 100; tr++) {
    const t = rng.pick(TOPICS); const pB = rng.int(t.lo, t.hi - 1); const pA = rng.int(pB + 1, t.hi); const a = rng.int(2, 14), b = rng.int(2, 14); if (a === b) continue;
    const n = a + b, T = pA * a + pB * b; if (T >= 1000) continue;
    if (o.stores) {
      const qB = rng.int(t.lo, t.hi - 1), qA = rng.int(qB + 1, t.hi + 3); if (qA === pA && qB === pB) continue; const T2 = qA * a + qB * b; if (T2 >= 1000 || T2 === T) continue;
      return { t, pA, pB, a, b, n, T, qA, qB, fig: { type: "data", kind: "table", columns: [t.head, "Store 1 price (dollars)", "Store 2 price (dollars)"], rows: [[t.A, pA, qA], [t.B, pB, qB]] } };
    }
    return { t, pA, pB, a, b, n, T, fig: { type: "data", kind: "table", columns: [t.head, "Price (dollars)"], rows: [[t.A, pA], [t.B, pB]] } };
  }
  throw new GenFail("가격 표 표집 실패");
}
const nA = (s: Scene) => `${s.t.A.toLowerCase()} ${s.t.noun}`, nB = (s: Scene) => `${s.t.B.toLowerCase()} ${s.t.noun}`;
const LEAD = ["", "", "Here is a word problem. ", "Read the information below. ", "A store manager is checking a receipt. ", "Consider the following purchase. "];
const tableSent = (rng: Rng, s: Scene) => rng.pick([`The table shows the price of each of two kinds of ${s.t.noun}.`, `The table shown gives the cost per item for two types of ${s.t.noun}.`, `Two kinds of ${s.t.noun} and their prices are listed in the table.`]);
const buySent = (rng: Rng, s: Scene) => rng.pick([`${s.t.who} ${s.t.did} ${s.n} ${s.t.noun} ${s.t.where}, some of each kind, for a total of ${s.T} dollars.`, `${s.t.who} ${s.t.did} a total of ${s.n} ${s.t.noun} ${s.t.where} and spent ${s.T} dollars altogether.`, `${s.t.where.charAt(0).toUpperCase()}${s.t.where.slice(1)}, ${s.t.who.toLowerCase()} ${s.t.did} ${s.n} ${s.t.noun} of the two kinds, costing ${s.T} dollars in total.`]);
const intro = (rng: Rng, s: Scene) => `${rng.pick(LEAD)}${tableSent(rng, s)} ${buySent(rng, s)}`;
/** a + b = n, pA a + pB b = T → b = (pA n − T)/(pA − pB). 표의 1열(Store 1) 가격을 쓴다. */
const WS_JS = "const R=FIGURE.rows; if (R.length!==2) throw new Error('행 수'); const pA=R[0][1], pB=R[1][1]; if (pA===pB) throw new Error('같은 가격'); const solve=(n,T)=>{ const b=(pA*n-T)/(pA-pB); return [n-b, b]; };\n";
const solveSteps = (s: Scene): [string, string][] => [[`표에서 ${s.t.A} ${s.pA}, ${s.t.B} ${s.pB} 달러를 읽는다.`, "Read both prices from the table."], [`a + b = ${s.n}, ${s.pA}a + ${s.pB}b = ${s.T} 로 놓는다.`, "Write the system."], [`a = ${s.n} - b 를 대입: ${s.pA}(${s.n} - b) + ${s.pB}b = ${s.T} 이다.`, "Substitute."], [`(${s.pA} - ${s.pB})b = ${s.pA * s.n - s.T} 이므로 b = ${s.b}, a = ${s.a} 이다.`, "Solve the system."]];

export const ITEM = defineItem(withRetry({
  prefix: "sl", itemId: "systems_linear.word_system.TB.P",
  hard: [
    {
      op: "repr_shift", structure: "표의 두 가격과 지문의 총 개수·총액으로 연립방정식을 세워 저가 품목의 개수를 구함", extra: "문장·표의 정보를 두 식(개수·금액)으로 바꿔 연립해야 함 — medium 은 한 품목 개수가 주어진 일차방정식",
      concepts: ["가격 표", "연립방정식 세우기", "대입법"],
      gen(rng) {
        const s = makeScene(rng);
        return figInst(rng, {
          stimulus: intro(rng, s), question: rng.pick([`How many ${nB(s)} were included?`, `What is the number of ${nB(s)}?`]), correct: s.b,
          wrongs: [W(s.a, "axis_misread", "다른 품목의 개수를 답했다."), W(Math.round(s.T / s.pB), "step_missing", "총액을 한 가격으로만 나눴다."), W(s.n - Math.round(s.T / s.pA), "formula_misuse", "가격을 바꿔 썼다."), W(s.b + 1, "other", "계산 중 어긋났다."), W(s.n, "step_missing", "총 개수를 답했다.")].filter((w) => w.v !== s.b && w.v > 0),
          verificationJs: figJs({ n: s.n, T: s.T }, s.fig, `${WS_JS}return solve(P.n,P.T)[1];`),
          trace: [...solveSteps(s), [`확인: ${s.pA}·${s.a} + ${s.pB}·${s.b} = ${s.T} 이다.`, "Check the total."]], variant: "count_cheaper_item",
        }, s.fig);
      },
    },
    {
      op: "chain2", structure: "연립으로 고가 품목의 개수를 구한 뒤, 그 품목에 쓴 금액을 구함", extra: "개수를 먼저 구하고 가격을 곱해 금액으로 잇는 2단 연쇄 — medium 은 개수까지",
      concepts: ["가격 표", "연립방정식", "금액 계산"],
      gen(rng) {
        const s = makeScene(rng); const c = s.a * s.pA;
        return figInst(rng, {
          stimulus: intro(rng, s), question: rng.pick([`How many dollars were spent on ${nA(s)}?`, `What was the total cost, in dollars, of the ${nA(s)}?`]), correct: c,
          wrongs: [W(s.b * s.pB, "axis_misread", "다른 품목 금액을 답했다."), W(s.a, "step_missing", "개수만 답했다."), W(s.b * s.pA, "formula_misuse", "개수와 가격을 엇갈려 곱했다."), W(s.T - c + s.pA, "other", "계산 중 어긋났다."), W(c + s.pA, "other", "한 개 더 셌다.")].filter((w) => w.v !== c && w.v > 0),
          verificationJs: figJs({ n: s.n, T: s.T }, s.fig, `${WS_JS}const [a]=solve(P.n,P.T); return a*pA;`),
          trace: [...solveSteps(s), [`${s.t.A} 금액 = ${s.a} × ${s.pA} = ${c} 이다.`, "Multiply count by price."]], variant: "spending_on_item",
        }, s.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "두 상점의 가격 표에서 상점 1 의 총액으로 연립해 개수를 구한 뒤, 같은 구매를 상점 2 가격으로 계산", extra: "한 시나리오로 개수를 구하고 다른 가격 시나리오에 적용해야 함 — medium 은 한 상점의 개수",
      concepts: ["가격 표(두 상점)", "연립방정식", "시나리오 비교"],
      gen(rng) {
        const s = makeScene(rng, { stores: true }); const T2 = s.qA! * s.a + s.qB! * s.b;
        return figInst(rng, {
          stimulus: `${rng.pick(LEAD)}${rng.pick([`The table shows the prices of two kinds of ${s.t.noun} at two stores.`, `Two stores sell the same two kinds of ${s.t.noun}, and the table shown lists their prices.`, `The table compares what two stores charge for each of two kinds of ${s.t.noun}.`])} ${rng.pick([`${s.t.who} ${s.t.did} ${s.n} ${s.t.noun} at Store 1, some of each kind, for a total of ${s.T} dollars.`, `At Store 1, ${s.t.who.toLowerCase()} ${s.t.did} a mix of ${s.n} ${s.t.noun} and paid ${s.T} dollars in all.`, `${s.t.who} spent ${s.T} dollars at Store 1 on ${s.n} ${s.t.noun} of the two kinds.`])}`,
          question: rng.pick([`How many dollars would the same ${s.t.noun} have cost at Store 2?`, `If the same numbers of each kind were bought at Store 2 instead, what would the total cost be, in dollars?`]), correct: T2,
          wrongs: [W(s.T, "condition_ignored", "Store 1 금액을 답했다."), W(s.qA! * s.b + s.qB! * s.a, "formula_misuse", "개수를 엇갈려 곱했다."), W(Math.abs(T2 - s.T), "step_missing", "차를 답했다."), W(T2 + s.qB!, "other", "한 개 더 셌다."), W(s.n * s.qB!, "step_missing", "모두 저가 품목으로 보았다.")].filter((w) => w.v !== T2 && w.v > 0),
          verificationJs: figJs({ n: s.n, T: s.T }, s.fig, `${WS_JS}const [a,b]=solve(P.n,P.T); return a*R[0][2]+b*R[1][2];`),
          trace: [...solveSteps(s), [`Store 2: ${s.qA}·${s.a} + ${s.qB}·${s.b} = ${T2} 이다.`, "Price the same purchase at Store 2."]], variant: "same_purchase_other_store",
        }, s.fig);
      },
    },
    {
      op: "constraint_select", structure: "총 개수 n 과 예산 상한 B 가 주어질 때, 고가 품목을 최대 몇 개 살 수 있는지(부등식 + 정수 내림)", extra: "연립 대신 부등식(예산 이하)을 세우고 정수 해 중 최댓값을 골라야 함(올림 함정) — medium 은 등식 연립",
      concepts: ["가격 표", "일차부등식", "정수 조건(내림)"],
      gen(rng) {
        const s = makeScene(rng); const Bd = s.T + rng.int(1, s.pA - s.pB - 1 > 0 ? s.pA - s.pB - 1 : 1); const x = Math.floor((Bd - s.pB * s.n) / (s.pA - s.pB));
        if (x < 1 || x >= s.n || (Bd - s.pB * s.n) % (s.pA - s.pB) === 0 || Bd >= 1000) throw new GenFail("x");
        return figInst(rng, {
          stimulus: `${rng.pick(LEAD)}${tableSent(rng, s)} ${s.t.who} plans to buy exactly ${s.n} ${s.t.noun} of these two kinds ${s.t.where} and can spend at most ${Bd} dollars.`,
          question: rng.pick([`What is the greatest number of ${nA(s)} that can be included?`, `At most how many of the ${s.n} ${s.t.noun} can be ${nA(s)}?`]), correct: x,
          wrongs: [W(x + 1, "condition_ignored", "올림했다."), W(Math.floor(Bd / s.pA), "step_missing", "총 개수 조건을 무시했다."), W(s.n - x, "opposite", "저가 품목 개수를 답했다."), W(x - 1, "other", "한 개 덜 셌다."), W(Math.floor((Bd - s.pA * s.n) / (s.pB - s.pA)), "sign_error", "가격을 바꿔 썼다.")].filter((w) => w.v !== x && w.v > 0),
          verificationJs: figJs({ n: s.n, Bd }, s.fig, `${WS_JS}if (pA<=pB) throw new Error('고가 아님'); let best=-1; for (let a=0;a<=P.n;a++) if (pA*a+pB*(P.n-a)<=P.Bd) best=a; if (best<0) throw new Error('해 없음'); return best;`),
          trace: [[`표에서 ${s.t.A} ${s.pA}, ${s.t.B} ${s.pB} 달러를 읽는다.`, "Read both prices."], [`${s.t.A} 를 a 개라 하면 ${s.t.B} 는 ${s.n} - a 개이다.`, "Express the other count."], [`${s.pA}a + ${s.pB}(${s.n} - a) ≤ ${Bd} 이다.`, "Write the budget inequality."], [`${s.pA - s.pB}a ≤ ${Bd - s.pB * s.n} 이므로 a ≤ ${((Bd - s.pB * s.n) / (s.pA - s.pB)).toFixed(1)} 이다.`, "Solve the inequality."], [`가장 큰 정수 a 는 ${x} 이다.`, "Take the greatest whole number."]], variant: "budget_max_expensive",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "total_cost", structure: "표의 가격으로 두 품목을 정해진 개수만큼 살 때의 총액을 구함", extra: "easy: 곱해서 더하기", concepts: ["가격 표", "총액"],
      gen(rng) {
        const s = makeScene(rng); const c = s.a * s.pA + s.b * s.pB;
        return figInst(rng, { stimulus: `${rng.pick(LEAD)}${tableSent(rng, s)}`, question: `What is the total cost, in dollars, of ${s.a} ${nA(s)} and ${s.b} ${nB(s)}?`, correct: c, wrongs: [W(s.a * s.pB + s.b * s.pA, "formula_misuse", "가격을 엇갈려 곱했다."), W(s.pA + s.pB, "step_missing", "개수를 곱하지 않았다."), W(s.a * s.pA, "step_missing", "한 품목만 계산했다."), W(c + s.pB, "other", "한 개 더 셌다.")].filter((w) => w.v !== c), verificationJs: figJs({ a: s.a, b: s.b }, s.fig, `${WS_JS}return P.a*pA+P.b*pB;`), trace: [[`${s.a} × ${s.pA} = ${s.a * s.pA}, ${s.b} × ${s.pB} = ${s.b * s.pB} 이다.`, "Multiply each count by its price."], [`합 = ${c} 이다.`, "Add."]], variant: "cost_of_order",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "one_unknown", structure: "한 품목 개수와 총액이 주어질 때 다른 품목 개수를 구함", extra: "medium: 일차방정식", concepts: ["가격 표", "일차방정식"],
      gen(rng) {
        const s = makeScene(rng);
        return figInst(rng, { stimulus: `${rng.pick(LEAD)}${tableSent(rng, s)} ${s.t.who} ${s.t.did} ${s.b} ${nB(s)} and some ${nA(s)} ${s.t.where}, spending ${s.T} dollars in all.`, question: `How many ${nA(s)} were included?`, correct: s.a, wrongs: [W(s.b, "axis_misread", "다른 품목 개수를 답했다."), W(Math.floor(s.T / s.pA), "step_missing", "다른 품목 금액을 빼지 않았다."), W(s.a + 1, "other", "계산 중 어긋났다."), W(s.a - 1, "other", "계산 중 어긋났다.")].filter((w) => w.v !== s.a && w.v > 0), verificationJs: figJs({ b: s.b, T: s.T }, s.fig, `${WS_JS}return (P.T-P.b*pB)/pA;`), trace: [[`${s.t.B} 금액 = ${s.b} × ${s.pB} = ${s.b * s.pB} 이다.`, "Cost of the known item."], [`남은 금액 ${s.T - s.b * s.pB} 이다.`, "Subtract from the total."], [`${s.t.A} 개수 = ${s.T - s.b * s.pB} ÷ ${s.pA} = ${s.a} 이다.`, "Divide by the price."]], variant: "solve_one_count",
        }, s.fig);
      },
    },
  ],
}));
