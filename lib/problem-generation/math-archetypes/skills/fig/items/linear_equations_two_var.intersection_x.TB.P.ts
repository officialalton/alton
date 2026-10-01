// linear_equations_two_var.intersection_x.TB.P — 한 표에 두 일차 관계(같은 x 열, 두 값 열)가 있고, 두 관계가 같아지는 x 를 구한다(교점은 표 밖).
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";

type TwoTopic = { x: string; xa: string; xu: string; ya: string; yu: string; A: string; B: string; what: string };
const TOPICS: TwoTopic[] = [
  { x: "the number of months", xa: "Months", xu: "months", ya: "total cost", yu: "dollars", A: "Plan A", B: "Plan B", what: "the total cost of two phone plans" },
  { x: "the number of hours", xa: "Time", xu: "hours", ya: "water level", yu: "inches", A: "Tank 1", B: "Tank 2", what: "the water levels in two tanks" },
  { x: "the number of weeks", xa: "Weeks", xu: "weeks", ya: "savings", yu: "dollars", A: "Maya", B: "Theo", what: "the savings of two friends" },
  { x: "the number of days", xa: "Days", xu: "days", ya: "height", yu: "centimeters", A: "Plant P", B: "Plant Q", what: "the heights of two plants" },
  { x: "the number of years", xa: "Years", xu: "years", ya: "population", yu: "hundreds of people", A: "Town X", B: "Town Y", what: "the populations of two towns" },
  { x: "the number of miles driven", xa: "Distance", xu: "miles", ya: "rental charge", yu: "dollars", A: "Company R", B: "Company S", what: "the charges of two car rental companies" },
  { x: "the number of visits", xa: "Visits", xu: "visits", ya: "total fee", yu: "dollars", A: "Gym A", B: "Gym B", what: "the total fees at two gyms" },
  { x: "the number of minutes", xa: "Time", xu: "minutes", ya: "distance from home", yu: "meters", A: "Runner 1", B: "Runner 2", what: "the distances of two runners from home" },
  { x: "the number of hours worked", xa: "Hours worked", xu: "hours", ya: "pay", yu: "dollars", A: "Job A", B: "Job B", what: "the pay for two part-time jobs" },
  { x: "the number of weeks", xa: "Weeks", xu: "weeks", ya: "pages read", yu: "pages", A: "Reader 1", B: "Reader 2", what: "the pages read by two students" },
  { x: "the number of guests", xa: "Guests", xu: "guests", ya: "catering cost", yu: "dollars", A: "Caterer A", B: "Caterer B", what: "the costs of two caterers" },
  { x: "the number of hours", xa: "Time", xu: "hours", ya: "battery charge", yu: "percent", A: "Phone A", B: "Phone B", what: "the battery charge of two phones" },
  { x: "the number of days", xa: "Days", xu: "days", ya: "snow depth", yu: "inches", A: "Site 1", B: "Site 2", what: "the snow depth at two sites" },
  { x: "the number of months", xa: "Months", xu: "months", ya: "members", yu: "members", A: "Club A", B: "Club B", what: "the membership of two clubs" },
  { x: "the number of uses", xa: "Uses", xu: "uses", ya: "total cost", yu: "dollars", A: "Pass A", B: "Pass B", what: "the costs of two transit passes" },
  { x: "the number of years", xa: "Years", xu: "years", ya: "value", yu: "hundreds of dollars", A: "Car A", B: "Car B", what: "the values of two cars" },
  { x: "the number of seconds", xa: "Time", xu: "seconds", ya: "altitude", yu: "meters", A: "Balloon A", B: "Balloon B", what: "the altitudes of two weather balloons" },
  { x: "the number of hours", xa: "Time", xu: "hours", ya: "temperature", yu: "degrees", A: "Oven A", B: "Oven B", what: "the temperatures of two ovens" },
  { x: "the number of lessons", xa: "Lessons", xu: "lessons", ya: "total charge", yu: "dollars", A: "Studio A", B: "Studio B", what: "the charges of two music studios" },
  { x: "the number of trips", xa: "Trips", xu: "trips", ya: "fuel left", yu: "gallons", A: "Truck A", B: "Truck B", what: "the fuel remaining in two trucks" },
  { x: "the number of months", xa: "Months", xu: "months", ya: "subscribers", yu: "thousands", A: "Channel A", B: "Channel B", what: "the subscribers of two video channels" },
  { x: "the number of shirts printed", xa: "Shirts", xu: "shirts", ya: "order cost", yu: "dollars", A: "Printer A", B: "Printer B", what: "the order costs at two print shops" },
  { x: "the number of weeks", xa: "Weeks", xu: "weeks", ya: "weight", yu: "pounds", A: "Calf A", B: "Calf B", what: "the weights of two calves" },
  { x: "the number of hours", xa: "Time", xu: "hours", ya: "distance traveled", yu: "miles", A: "Bus A", B: "Bus B", what: "the distances traveled by two buses" },
  { x: "the number of days", xa: "Days", xu: "days", ya: "items in stock", yu: "items", A: "Store A", B: "Store B", what: "the stock levels at two stores" },
  { x: "the number of years", xa: "Years", xu: "years", ya: "tree height", yu: "feet", A: "Oak", B: "Maple", what: "the heights of two trees" },
  { x: "the number of tickets", xa: "Tickets", xu: "tickets", ya: "total price", yu: "dollars", A: "Theater A", B: "Theater B", what: "the total ticket prices at two theaters" },
  { x: "the number of hours", xa: "Time", xu: "hours", ya: "pool water", yu: "hundreds of gallons", A: "Pool A", B: "Pool B", what: "the water in two pools being filled" },
];
type Two = { t: TwoTopic; xs: number[]; m1: number; b1: number; m2: number; b2: number; xi: number; fig: { type: "data"; kind: "table"; columns: string[]; rows: number[][] } };
/** 두 직선: 교점 x 는 표 마지막 x 뒤의 정수(또는 0.5 단위), 표 안에서는 1 이 2 보다 작고 교점 뒤에 역전. */
function makeTwo(rng: Rng, o: { intX?: boolean } = {}): Two {
  for (let tr = 0; tr < 120; tr++) {
    const t = rng.pick(TOPICS); const d = rng.pick([1, 2, 2, 5]); const n = 4; const off = rng.pick([0, d]); const xs = Array.from({ length: n }, (_, i) => i * d + off);
    const m1 = rng.int(3, 15), m2 = rng.int(1, m1 - 1); const xiTarget = xs[n - 1] + rng.int(1, 12); const b1 = rng.int(5, 60); const b2 = b1 + (m1 - m2) * xiTarget + (o.intX === false ? rng.int(1, m1 - m2 - 1 || 1) : 0);
    const xi = (b2 - b1) / (m1 - m2); if (o.intX !== false && !Number.isInteger(xi)) continue; if (o.intX === false && Number.isInteger(xi)) continue;
    const r = xs.map((x) => [x, m1 * x + b1, m2 * x + b2]); if (r.some((q) => q[1] > 900 || q[2] > 900)) continue;
    return { t, xs, m1, b1, m2, b2, xi, fig: { type: "data", kind: "table", columns: [`${t.xa} (${t.xu})`, `${t.A} ${t.ya} (${t.yu})`, `${t.B} ${t.ya} (${t.yu})`], rows: r } };
  }
  throw new GenFail("두 관계 표 표집 실패");
}
const TWO_JS = "const R=FIGURE.rows; const L=(j)=>{ const m=(R[1][j]-R[0][j])/(R[1][0]-R[0][0]); const b=R[0][j]-m*R[0][0]; for (const r of R) if (Math.abs(m*r[0]+b-r[j])>1e-9) throw new Error('일차 관계 아님'); return [m,b]; }; const [m1,b1]=L(1), [m2,b2]=L(2); if (m1===m2) throw new Error('평행'); const xi=(b2-b1)/(m1-m2);\n";
const intro = (rng: Rng, s: Two) => rng.pick([
  `The table shows ${s.t.what} for several values of ${s.t.x}. Each relationship is linear.`,
  `The table shown compares ${s.t.what}. For each, the relationship with ${s.t.x} is linear.`,
  `Two linear relationships are shown in the table: ${s.t.what} at several values of ${s.t.x}.`,
  `A report tracked ${s.t.what}. The table shown gives the values at several points, and both change linearly with ${s.t.x}.`,
  `For ${s.t.what}, the values listed in the table change at a constant rate as ${s.t.x} increases.`,
]);
const ifCont = (rng: Rng) => rng.pick(["If both relationships continue", "Assuming the linear patterns continue", "If the patterns in the table continue", "Extending both relationships"]);
const read = (s: Two): [string, string][] => [
  [`${s.t.A}: 두 행에서 기울기 ${s.m1}, x = 0 일 때 ${s.b1} 이다.`, `${s.t.A}: slope and starting value from the table.`],
  [`${s.t.B}: 두 행에서 기울기 ${s.m2}, x = 0 일 때 ${s.b2} 이다.`, `${s.t.B}: slope and starting value from the table.`],
  [`${s.m1}x + ${s.b1} = ${s.m2}x + ${s.b2} 로 놓는다.`, "Set the two expressions equal."],
];

export const ITEM = defineItem({
  prefix: "l2", itemId: "linear_equations_two_var.intersection_x.TB.P",
  hard: [
    {
      op: "compare_scenarios", structure: "표의 두 관계 각각의 기울기·처음 값을 구하고, 두 관계의 값이 같아지는 x(표 밖)를 구함", extra: "두 열에서 각각 식을 세워 연립해야 함(표 안에는 같은 값이 없다) — medium 은 한 관계의 식",
      concepts: ["두 일차 관계 값표", "식 세우기", "교점의 x"],
      gen(rng) {
        const s = makeTwo(rng);
        return figInst(rng, {
          stimulus: intro(rng, s), question: `${ifCont(rng)}, for what value of ${s.t.x} will ${s.t.A} and ${s.t.B} have the same ${s.t.ya}?`, correct: s.xi,
          wrongs: [W(Math.round((s.b2 - s.b1) / s.m1), "step_missing", "한 관계의 기울기로만 나눴다."), W(s.xi + 1, "other", "한 단위 어긋났다."), W(Math.round((s.b2 + s.b1) / (s.m1 - s.m2)), "sign_error", "처음 값을 더했다."), W(s.xs[s.xs.length - 1], "condition_ignored", "표의 마지막 x 를 답했다."), W(Math.max(1, s.xi - 2), "other", "계산 중 어긋났다.")],
          verificationJs: figJs({}, s.fig, `${TWO_JS}return xi;`),
          trace: [...read(s), [`(${s.m1} - ${s.m2})x = ${s.b2} - ${s.b1} 이다.`, "Collect terms."], [`x = ${s.b2 - s.b1} ÷ ${s.m1 - s.m2} = ${s.xi} 이다.`, "Solve for x."]], variant: "equal_value_input",
        }, s.fig);
      },
    },
    {
      op: "chain2", structure: "두 관계가 같아지는 x 를 구한 뒤, 그때의 공통 값을 구함", extra: "교점의 x 를 먼저 구하고 다시 대입해 y 를 구하는 연쇄 — medium 은 한 관계의 식",
      concepts: ["두 일차 관계 값표", "연립", "교점의 y"],
      gen(rng) {
        const s = makeTwo(rng); const y = s.m1 * s.xi + s.b1;
        return figInst(rng, {
          stimulus: intro(rng, s), question: `${ifCont(rng)}, what will the ${s.t.ya}, in ${s.t.yu}, be at the moment ${s.t.A} and ${s.t.B} are equal?`, correct: y,
          wrongs: [W(s.xi, "step_missing", "x 를 답했다."), W(s.m2 * s.xi + s.b1, "formula_misuse", "기울기와 처음 값을 섞었다."), W(y + s.m1, "other", "한 단위 더 갔다."), W(s.fig.rows[s.fig.rows.length - 1][1], "condition_ignored", "표의 마지막 값을 답했다."), W(y - s.m2, "other", "한 단위 덜 갔다.")],
          verificationJs: figJs({}, s.fig, `${TWO_JS}return m1 * xi + b1;`),
          trace: [...read(s), [`x = ${s.xi} 이다.`, "Solve for x."], [`y = ${s.m1}·${s.xi} + ${s.b1} = ${y} 이다.`, "Substitute back."], [`확인: ${s.m2}·${s.xi} + ${s.b2} = ${s.m2 * s.xi + s.b2} 이다.`, "Check with the other model."]], variant: "common_value",
        }, s.fig);
      },
    },
    {
      op: "constraint_select", structure: "두 관계의 교점 x 가 정수가 아닐 때, 처음으로 관계 1 의 값이 관계 2 보다 커지는 최소 정수 x 를 구함", extra: "연립 해가 정수가 아니어서 부등식으로 바꾸고 올림해야 함(내림·반올림 함정) — medium 은 교점 x(정수)",
      concepts: ["두 일차 관계 값표", "일차부등식", "정수 조건(올림)"],
      gen(rng) {
        const s = makeTwo(rng, { intX: false }); const correct = Math.floor(s.xi) + 1;
        return figInst(rng, {
          stimulus: intro(rng, s), question: `${ifCont(rng)}, what is the least whole-number value of ${s.t.x} for which the ${s.t.ya} of ${s.t.A} is greater than that of ${s.t.B}?`, correct,
          wrongs: [W(Math.floor(s.xi), "condition_ignored", "내림했다."), W(correct + 1, "other", "한 단위 더 갔다."), W(Math.round((s.b2 - s.b1) / s.m1), "step_missing", "한 기울기로만 나눴다."), W(s.xs[s.xs.length - 1] + 1, "condition_ignored", "표 다음 값을 답했다."), W(correct + 2, "other", "계산 중 어긋났다.")],
          verificationJs: figJs({}, s.fig, `${TWO_JS}for (let x = 0; x <= 5000; x++) if (m1 * x + b1 > m2 * x + b2) return x; throw new Error('해 없음');`),
          trace: [...read(s), [`${s.m1 - s.m2}x > ${s.b2 - s.b1} 이다.`, "Write the inequality."], [`x > ${fmtNum(Math.round(s.xi * 100) / 100)} 이다.`, "Solve."], [`가장 작은 정수는 ${correct} 이다.`, "Least whole number above the bound."]], variant: "first_whole_overtake",
        }, s.fig);
      },
    },
    {
      op: "param_condition", structure: "관계 2 의 모든 값에 k 를 더했을 때 두 관계가 지문의 x = X 에서 같아지는 k 를 구함", extra: "두 식을 세우고, 교점 조건(x = X 에서 같음)을 만족하는 매개변수 k 를 역산해야 함 — medium 은 교점 x",
      concepts: ["두 일차 관계 값표", "매개변수 조건", "교점 위치"],
      gen(rng) {
        const s = makeTwo(rng); const X = s.xi + rng.nz(-4, 6); if (X <= s.xs[s.xs.length - 1] || X === s.xi) throw new GenFail("X"); const k = (s.m1 * X + s.b1) - (s.m2 * X + s.b2);
        return figInst(rng, {
          stimulus: `${intro(rng, s)} ${rng.pick([`Suppose every value of the ${s.t.ya} for ${s.t.B} is changed by the same amount $k$, where $k$ is a constant.`, `Suppose the same constant $k$ is added to each ${s.t.ya} value for ${s.t.B}.`, `A change adds a constant $k$ to the ${s.t.ya} of ${s.t.B} at every value of ${s.t.x}, where $k$ is a constant.`])}`,
          question: `For what value of $k$ will ${s.t.A} and ${s.t.B} have the same ${s.t.ya} when ${s.t.x} is ${X}?`, correct: k,
          wrongs: [W(-k, "sign_error", "부호를 반대로 했다."), W(s.m1 * X + s.b1, "step_missing", "한 관계의 값만 답했다."), W((s.m1 - s.m2) * X, "step_missing", "처음 값의 차를 무시했다."), W(k + s.m1 - s.m2, "other", "한 단위 어긋났다."), W(s.b2 - s.b1, "formula_misuse", "처음 값의 차만 답했다.")].filter((w) => w.v !== k),
          verificationJs: figJs({ X }, s.fig, `${TWO_JS}return (m1 * P.X + b1) - (m2 * P.X + b2);`),
          trace: [...read(s).slice(0, 2), [`x = ${X} 에서 ${s.t.A} = ${s.m1 * X + s.b1} 이다.`, "Value of the first model at X."], [`x = ${X} 에서 ${s.t.B} = ${s.m2 * X + s.b2} 이다.`, "Value of the second model at X."], [`k = ${s.m1 * X + s.b1} - ${s.m2 * X + s.b2} = ${k} 이다.`, "Required shift."]], variant: "shift_to_meet_at_X",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "row_gap", structure: "두 관계 표의 한 행에서 두 값의 차를 구함", extra: "easy: 한 행의 두 칸 차", concepts: ["두 관계 표", "차"],
      gen(rng) {
        const s = makeTwo(rng); const i = rng.int(0, 3); const x = s.xs[i]; const r = s.fig.rows[i]; const c = Math.abs(r[2] - r[1]);
        return figInst(rng, { stimulus: intro(rng, s), question: `According to the table, when ${s.t.x} is ${x}, what is the positive difference between the ${s.t.ya} of ${s.t.A} and of ${s.t.B}, in ${s.t.yu}?`, correct: c, wrongs: [W(r[1], "step_missing", "한 값만 답했다."), W(r[2], "step_missing", "한 값만 답했다."), W(r[1] + r[2], "sign_error", "합을 구했다."), W(c + s.m1, "other", "다른 행을 읽었다.")].filter((w) => w.v !== c), verificationJs: figJs({ x }, s.fig, `${TWO_JS}const r = R.find(q => q[0] === P.x); if (!r) throw new Error('행 없음'); return Math.abs(r[2] - r[1]);`), trace: [[`x = ${x} 행: ${r[1]}, ${r[2]}.`, "Read the row."], [`차 = ${c} 이다.`, "Difference."]], variant: "gap_in_row",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "gap_closing", structure: "두 관계의 차가 한 단위마다 얼마씩 줄어드는지 구함", extra: "medium: 두 기울기의 차", concepts: ["두 관계 표", "변화율 비교"],
      gen(rng) {
        const s = makeTwo(rng); const c = s.m1 - s.m2;
        return figInst(rng, { stimulus: intro(rng, s), question: `As ${s.t.x} increases by 1, by how many ${s.t.yu} does the difference between the ${s.t.ya} of ${s.t.B} and of ${s.t.A} decrease?`, correct: c, wrongs: [W(s.m1, "step_missing", "한 기울기만 답했다."), W(s.m2, "step_missing", "한 기울기만 답했다."), W(s.m1 + s.m2, "sign_error", "합을 구했다."), W(c * (s.xs[1] - s.xs[0]) === c ? c + 2 : c * (s.xs[1] - s.xs[0]), "unit_error", "한 행의 변화를 답했다.")].filter((w) => w.v !== c), verificationJs: figJs({}, s.fig, `${TWO_JS}return m1 - m2;`), trace: [[`${s.t.A} 의 기울기 ${s.m1}, ${s.t.B} 의 기울기 ${s.m2} 이다.`, "Two slopes."], [`차는 한 단위마다 ${s.m1} - ${s.m2} 만큼 줄어든다.`, "Gap closes by the slope difference."], [`= ${c} 이다.`, "Compute."]], variant: "gap_change_rate",
        }, s.fig);
      },
    },
  ],
});
