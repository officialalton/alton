// linear_equations_one_var.word_problem_translate.TB.P — 요금제 표(기본요금 + 단위당 요금)에서 문장을 일차방정식으로 옮겨 풀고, 손익분기·예산 내 최대·다른 요금제 환산·새 요금 역산으로 확장한다.
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { pos, retry, tab } from "./_t4-kit";

type PlanTopic = { what: string; rowHead: string; rows: string[]; per: string; pers: string; use: string };
const TOPICS: PlanTopic[] = [
  { what: "bike rental shops", rowHead: "Shop", rows: ["Shop A", "Shop B", "Shop C", "Shop D"], per: "hour", pers: "hours", use: "rents a bike" },
  { what: "kayak rental companies", rowHead: "Company", rows: ["River Kayaks", "Lake Kayaks", "Bay Kayaks", "Cove Kayaks"], per: "hour", pers: "hours", use: "rents a kayak" },
  { what: "taxi companies", rowHead: "Company", rows: ["City Cab", "Metro Cab", "Star Cab", "Blue Cab"], per: "mile", pers: "miles", use: "takes a taxi ride" },
  { what: "gym membership plans", rowHead: "Plan", rows: ["Plan A", "Plan B", "Plan C", "Plan D"], per: "visit", pers: "visits", use: "joins a gym" },
  { what: "parking garages", rowHead: "Garage", rows: ["Garage A", "Garage B", "Garage C", "Garage D"], per: "hour", pers: "hours", use: "parks a car" },
  { what: "tutoring services", rowHead: "Service", rows: ["Bright Tutors", "Study Hub", "Learn Lab", "Top Prep"], per: "session", pers: "sessions", use: "signs up for tutoring" },
  { what: "car rental companies", rowHead: "Company", rows: ["Rent One", "Drive Now", "Go Cars", "Road Rentals"], per: "day", pers: "days", use: "rents a car" },
  { what: "moving truck companies", rowHead: "Company", rows: ["Move It", "Haul Pros", "Truck Pro", "Load Up"], per: "mile", pers: "miles", use: "rents a moving truck" },
  { what: "dog walking services", rowHead: "Service", rows: ["Happy Paws", "Dog Days", "Tail Trail", "Pup Walk"], per: "walk", pers: "walks", use: "hires a dog walker" },
  { what: "cleaning services", rowHead: "Service", rows: ["Spark Clean", "Fresh Home", "Neat Team", "Shine Crew"], per: "room", pers: "rooms", use: "hires a cleaning service" },
  { what: "bowling alleys", rowHead: "Alley", rows: ["Strike Lanes", "Pin Palace", "Bowl Zone", "Lucky Lanes"], per: "game", pers: "games", use: "goes bowling" },
  { what: "skating rinks", rowHead: "Rink", rows: ["Rink A", "Rink B", "Rink C", "Rink D"], per: "hour", pers: "hours", use: "goes skating" },
  { what: "laundry services", rowHead: "Service", rows: ["Wash World", "Fold Pro", "Clean Spin", "Suds Shop"], per: "load", pers: "loads", use: "uses a laundry service" },
  { what: "delivery services", rowHead: "Service", rows: ["Quick Ship", "Fast Parcel", "Zip Post", "Send It"], per: "package", pers: "packages", use: "sends some packages" },
  { what: "climbing gyms", rowHead: "Gym", rows: ["Peak Gym", "Rock Gym", "Cliff Gym", "Summit Gym"], per: "visit", pers: "visits", use: "joins a climbing gym" },
  { what: "music schools", rowHead: "School", rows: ["Note School", "Tune School", "Chord School", "Beat School"], per: "lesson", pers: "lessons", use: "signs up for guitar lessons" },
  { what: "boat tour companies", rowHead: "Company", rows: ["Wave Tours", "Sea Tours", "Gull Tours", "Reef Tours"], per: "person", pers: "people", use: "books a boat tour for a group" },
  { what: "photo studios", rowHead: "Studio", rows: ["Studio A", "Studio B", "Studio C", "Studio D"], per: "print", pers: "prints", use: "orders photo prints" },
  { what: "scooter rental apps", rowHead: "App", rows: ["App A", "App B", "App C", "App D"], per: "ride", pers: "rides", use: "rents scooters" },
  { what: "cooking schools", rowHead: "School", rows: ["Chef Hall", "Taste Lab", "Spice Room", "Oven Club"], per: "workshop", pers: "workshops", use: "signs up for cooking workshops" },
  { what: "storage companies", rowHead: "Company", rows: ["Safe Store", "Barn Storage", "Keep It", "Stow Place"], per: "month", pers: "months", use: "rents a storage unit" },
];
const PEOPLE = ["Maya", "Jordan", "Luis", "Priya", "Sam", "Nora", "Eli", "Kai", "Rosa", "Theo", "Ava", "Omar"];
type QScene = { t: PlanTopic; names: string[]; fee: number[]; rate: number[]; who: string };
function qScene(rng: Rng, n = rng.int(3, 4)): QScene {
  const t = rng.pick(TOPICS); const names = t.rows.slice(0, n); const who = rng.pick(PEOPLE);
  return retry(40, () => { const fee = names.map(() => 5 * rng.int(1, 12)); const rate = names.map(() => rng.int(2, 15)); return new Set(fee).size === n && new Set(rate).size === n ? { t, names, fee, rate, who } : null; }, "요금 장면");
}
const qFig = (s: QScene) => tab([s.t.rowHead, "Fee (dollars)", `Cost per ${s.t.per} (dollars)`], s.names.map((nm, i) => [nm, s.fee[i], s.rate[i]]));
const intro = (rng: Rng, s: QScene) => rng.pick([
  `The table shows the charges at ${s.names.length} ${s.t.what}. Each charges a one-time fee plus a cost for each ${s.t.per}.`,
  `Several ${s.t.what} charge a one-time fee plus an amount per ${s.t.per}, as shown in the table.`,
  `The table shown lists the one-time fee and the cost per ${s.t.per} for each of ${s.names.length} ${s.t.what}. No other charges apply.`,
  `${s.who} ${s.t.use} and compares ${s.t.what}. The fee and the cost per ${s.t.per} for each are given in the table.`,
]);
/** FIGURE 에서 기본요금 F·단위당 요금 R 을 읽는 JS. 음수·0 요금이면 던진다. */
const Q_JS = "const nm=FIGURE.rows.map(r=>r[0]); const F=FIGURE.rows.map(r=>r[1]), R=FIGURE.rows.map(r=>r[2]); if (F.some(x=>typeof x!=='number'||x<0)||R.some(x=>typeof x!=='number'||x<=0)) throw new Error('요금 오류'); const idx=(k)=>{ const i=nm.indexOf(k); if (i<0) throw new Error('행 없음'); return i; };\n";
const eqStep = (s: QScene, i: number): [string, string] => [`${s.names[i]} 의 총액 = ${s.fee[i]} + ${s.rate[i]}x 이다(x 는 ${s.t.pers} 수).`, "Write the cost as an expression."];

export const ITEM = defineItem({
  prefix: "le1", itemId: "linear_equations_one_var.word_problem_translate.TB.P",
  hard: [
    {
      op: "compare_scenarios", structure: "두 요금제의 총액 식을 세워 같게 놓고 총액이 같아지는 단위 수를 구함", extra: "두 행에서 각각 식을 세워 방정식 F1 + R1x = F2 + R2x 를 풀어야 함 — medium 은 한 요금제의 방정식",
      concepts: ["요금표", "일차방정식 세우기", "두 경우 비교(손익분기)"],
      gen(rng) {
        return retry(200, () => {
          const s = qScene(rng); const [i, j] = rng.shuffle([...s.names.keys()]).slice(0, 2); if (!(s.fee[i] < s.fee[j] && s.rate[i] > s.rate[j])) return null; const x = (s.fee[j] - s.fee[i]) / (s.rate[i] - s.rate[j]); if (!Number.isInteger(x) || x < 2) return null; const fig = qFig(s);
          return figInst(rng, {
            stimulus: intro(rng, s),
            question: rng.pick([`For what number of ${s.t.pers} is the total cost at ${s.names[i]} equal to the total cost at ${s.names[j]}?`, `${s.names[i]} and ${s.names[j]} charge the same total for how many ${s.t.pers}?`]), correct: x,
            wrongs: pos([W((s.fee[j] + s.fee[i]) / (s.rate[i] - s.rate[j]), "sign_error", "기본요금의 차 대신 합을 썼다."), W((s.fee[j] - s.fee[i]) / (s.rate[i] + s.rate[j]), "sign_error", "단위당 요금의 차 대신 합으로 나누었다."), W(s.fee[j] - s.fee[i], "step_missing", "단위당 요금의 차로 나누지 않았다."), W(s.fee[i] + s.rate[i] * x, "step_missing", "그때의 총액을 답했다."), W(x + 1, "other", "하나 어긋났다.")].filter((w) => Number.isInteger(w.v)), x),
            verificationJs: figJs({ ni: s.names[i], nj: s.names[j] }, fig, `${Q_JS}const a = idx(P.ni), b = idx(P.nj); if (R[a] === R[b]) throw new Error('평행'); return (F[b] - F[a]) / (R[a] - R[b]);`),
            trace: [eqStep(s, i), eqStep(s, j), [`${s.fee[i]} + ${s.rate[i]}x = ${s.fee[j]} + ${s.rate[j]}x 로 놓는다.`, "Set the costs equal."], [`${s.rate[i] - s.rate[j]}x = ${s.fee[j] - s.fee[i]} 이다.`, "Collect like terms."], [`x = ${x} 이다.`, "Solve for x."]], variant: "break_even",
          }, fig);
        }, "compare");
      },
    },
    {
      op: "constraint_select", structure: "예산 B 이하가 되는 단위 수 부등식을 세워 가장 큰 정수 해를 구함", extra: "식을 세워 부등식으로 풀고 정수로 내림(올리면 예산 초과) — medium 은 등식",
      concepts: ["요금표", "일차부등식", "최대 정수 해"],
      gen(rng) {
        return retry(120, () => {
          const s = qScene(rng); const i = rng.int(0, s.names.length - 1); const B = rng.int(s.fee[i] + 3 * s.rate[i], Math.min(999, s.fee[i] + 40 * s.rate[i])); if ((B - s.fee[i]) % s.rate[i] === 0) return null; const x = Math.floor((B - s.fee[i]) / s.rate[i]); const fig = qFig(s);
          return figInst(rng, {
            stimulus: `${intro(rng, s)} ${s.who} chooses ${s.names[i]}. The total cost must be at most ${B} dollars.`,
            question: rng.pick([`What is the greatest whole number of ${s.t.pers} ${s.who} can pay for?`, `At most how many ${s.t.pers} can ${s.who} pay for within this limit?`]), correct: x,
            wrongs: pos([W(x + 1, "other", "올림을 해 예산을 넘었다."), W(Math.floor(B / s.rate[i]), "step_missing", "기본요금을 빼지 않았다."), W(Math.floor((B + s.fee[i]) / s.rate[i]), "sign_error", "기본요금을 더했다."), W(Math.floor((B - s.fee[i]) / s.fee[i]), "axis_misread", "기본요금으로 나누었다."), W(x - 1, "other", "하나 적게 셌다.")], x),
            verificationJs: figJs({ nm: s.names[i], B }, fig, `${Q_JS}const k = idx(P.nm); return Math.floor((P.B - F[k]) / R[k] + 1e-9);`),
            trace: [eqStep(s, i), [`${s.fee[i]} + ${s.rate[i]}x ≤ ${B} 이다.`, "Write the inequality."], [`${s.rate[i]}x ≤ ${B - s.fee[i]} 이다.`, "Subtract the fee."], [`x ≤ ${fmtNum((B - s.fee[i]) / s.rate[i])} 이다.`, "Divide by the rate."], [`가장 큰 정수는 ${x} 이다.`, "Take the greatest whole number."]], variant: "max_within_budget",
          }, fig);
        }, "select");
      },
    },
    {
      op: "chain2", structure: "한 요금제의 총액으로 단위 수를 구한 뒤, 같은 단위 수를 다른 요금제에 넣어 총액을 구함", extra: "방정식 풀이 결과가 다른 행 식의 입력이 되는 연쇄 — medium 은 단위 수까지",
      concepts: ["요금표", "일차방정식 풀이", "식의 값"],
      gen(rng) {
        return retry(120, () => {
          const s = qScene(rng); const [i, j] = rng.shuffle([...s.names.keys()]).slice(0, 2); const x = rng.int(2, 30); const T = s.fee[i] + s.rate[i] * x; const c = s.fee[j] + s.rate[j] * x; if (T > 999 || c > 999) return null; const fig = qFig(s);
          return figInst(rng, {
            stimulus: `${intro(rng, s)} ${s.who} used ${s.names[i]}. The total cost was ${T} dollars.`,
            question: rng.pick([`How much, in dollars, would the same number of ${s.t.pers} have cost at ${s.names[j]}?`, `What would ${s.who} have paid, in dollars, at ${s.names[j]} for the same number of ${s.t.pers}?`]), correct: c,
            wrongs: pos([W(s.fee[j] + s.rate[j] * T, "step_missing", "총액을 단위 수로 착각해 대입했다."), W(T - s.fee[i] + s.fee[j], "formula_misuse", "단위당 요금 차이를 무시했다."), W(s.rate[j] * x, "step_missing", "기본요금을 더하지 않았다."), W(x, "step_missing", "단위 수만 답했다."), W(s.fee[j] + s.rate[j] * (T / s.rate[i]), "step_missing", "기본요금을 빼지 않고 단위 수를 구했다.")].filter((w) => Number.isInteger(w.v)), c),
            verificationJs: figJs({ ni: s.names[i], nj: s.names[j], T }, fig, `${Q_JS}const a = idx(P.ni), b = idx(P.nj); const x = (P.T - F[a]) / R[a]; if (x < 0) throw new Error('음수'); return F[b] + R[b] * x;`),
            trace: [eqStep(s, i), [`${s.fee[i]} + ${s.rate[i]}x = ${T} 이다.`, "Set up the equation."], [`x = (${T} - ${s.fee[i]}) ÷ ${s.rate[i]} = ${x} 이다.`, "Solve for x."], eqStep(s, j), [`${s.fee[j]} + ${s.rate[j]} × ${x} = ${c} 이다.`, "Evaluate the second cost."]], variant: "same_usage_other_plan",
          }, fig);
        }, "chain2");
      },
    },
    {
      op: "inverse", structure: "새 요금제(기본요금 F 고정)가 표의 한 요금제와 u 단위에서 같은 총액이 되도록 단위당 요금을 역산", extra: "표의 식으로 u 에서의 총액을 구한 뒤 미지의 계수(단위당 요금)에 대한 방정식을 풀어야 함 — medium 은 단위 수 구하기",
      concepts: ["요금표", "식의 값", "계수에 대한 일차방정식"],
      gen(rng) {
        return retry(200, () => {
          const s = qScene(rng); const i = rng.int(0, s.names.length - 1); const u = rng.int(3, 20); const T = s.fee[i] + s.rate[i] * u; if (T > 999) return null; const Fd = 5 * rng.int(0, 20); if (Fd === s.fee[i] || Fd >= T) return null; const r = (T - Fd) / u; if (!Number.isInteger(r) || r === s.rate[i]) return null; const fig = qFig(s);
          return figInst(rng, {
            stimulus: `${intro(rng, s)} A new competitor will charge a one-time fee of ${Fd} dollars plus a fixed cost per ${s.t.per}. The competitor wants to match the total cost of ${s.names[i]} for one particular number of ${s.t.pers}.`,
            question: rng.pick([`If the two totals are to be equal for exactly ${u} ${s.t.pers}, what should the competitor's cost per ${s.t.per} be, in dollars?`, `What cost per ${s.t.per}, in dollars, would make the two totals equal for ${u} ${s.t.pers}?`]), correct: r,
            wrongs: pos([W(T / u, "step_missing", "새 기본요금을 빼지 않았다."), W(T - Fd, "step_missing", "단위 수로 나누지 않았다."), W((T + Fd) / u, "sign_error", "기본요금을 더했다."), W(s.rate[i], "other", "표의 단위당 요금을 그대로 답했다."), W(T, "step_missing", "총액을 답했다.")].filter((w) => Number.isInteger(w.v)), r),
            verificationJs: figJs({ nm: s.names[i], u, Fd }, fig, `${Q_JS}const k = idx(P.nm); return (F[k] + R[k] * P.u - P.Fd) / P.u;`),
            trace: [eqStep(s, i), [`${u} ${s.t.pers} 일 때 ${s.fee[i]} + ${s.rate[i]} × ${u} = ${T} 이다.`, "Evaluate the table plan."], [`새 요금: ${Fd} + ${u}r = ${T} 이다.`, "Set up the equation for the new rate."], [`${u}r = ${T - Fd} 이다.`, "Subtract the new fee."], [`r = ${r} 이다.`, "Divide."]], variant: "rate_for_equal_total",
          }, fig);
        }, "inverse");
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "total_cost", structure: "한 요금제의 k 단위 총액", extra: "easy: 식에 대입", concepts: ["요금표", "식의 값"],
      gen(rng) {
        const s = qScene(rng); const i = rng.int(0, s.names.length - 1); const k = rng.int(2, 12); const c = s.fee[i] + s.rate[i] * k; const fig = qFig(s);
        return figInst(rng, { stimulus: `${intro(rng, s)} ${s.who} chooses ${s.names[i]}.`, question: `What is the total cost, in dollars, for ${k} ${s.t.pers}?`, correct: c, wrongs: pos([W(s.rate[i] * k, "step_missing", "기본요금을 빠뜨렸다."), W((s.fee[i] + s.rate[i]) * k, "formula_misuse", "기본요금에도 단위 수를 곱했다."), W(s.fee[i] + s.rate[i], "step_missing", "단위 수를 곱하지 않았다."), W(s.fee[(i + 1) % s.names.length] + s.rate[(i + 1) % s.names.length] * k, "axis_misread", "다른 행을 읽었다.")], c), verificationJs: figJs({ nm: s.names[i], k }, fig, `${Q_JS}const j = idx(P.nm); return F[j] + R[j] * P.k;`), trace: [eqStep(s, i), [`${s.fee[i]} + ${s.rate[i]} × ${k} = ${c} 이다.`, "Substitute."]], variant: "total_cost" }, fig);
      },
    },
    {
      lv: "medium", name: "solve_units", structure: "총액 T 를 식에 놓고 단위 수를 구함", extra: "medium: 일차방정식 풀이", concepts: ["요금표", "일차방정식"],
      gen(rng) {
        return retry(40, () => {
          const s = qScene(rng); const i = rng.int(0, s.names.length - 1); const x = rng.int(2, 30); const T = s.fee[i] + s.rate[i] * x; if (T > 999) return null; const fig = qFig(s);
          return figInst(rng, { stimulus: `${intro(rng, s)} ${s.who} chooses ${s.names[i]}. The total cost is ${T} dollars.`, question: rng.pick([`For how many ${s.t.pers} did ${s.who} pay?`, `How many ${s.t.pers} were paid for?`]), correct: x, wrongs: pos([W(T / s.rate[i], "step_missing", "기본요금을 빼지 않았다."), W((T + s.fee[i]) / s.rate[i], "sign_error", "기본요금을 더했다."), W(T - s.fee[i], "step_missing", "단위당 요금으로 나누지 않았다."), W(x + 1, "other", "하나 어긋났다.")].filter((w) => Number.isInteger(w.v)), x), verificationJs: figJs({ nm: s.names[i], T }, fig, `${Q_JS}const j = idx(P.nm); return (P.T - F[j]) / R[j];`), trace: [eqStep(s, i), [`${s.fee[i]} + ${s.rate[i]}x = ${T} 이다.`, "Set up the equation."], [`x = (${T} - ${s.fee[i]}) ÷ ${s.rate[i]} = ${x} 이다.`, "Solve."]], variant: "solve_units" }, fig);
        }, "medium");
      },
    },
  ],
});
