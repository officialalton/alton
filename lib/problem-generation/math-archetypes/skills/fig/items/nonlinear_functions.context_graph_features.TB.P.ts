// nonlinear_functions.context_graph_features.TB.P — 맥락(높이·이익·물줄기) 이차 값표에서 그래프의 특징(최댓값·영점·y 절편·구간 길이)을 해석한다(카탈로그 부록 B 신규 패턴).
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { isInt, QUAD_JS, quadRead, quadTab, ROOTS_JS, symStep, xsRun, type Quad } from "./_t5-kit";

type Scene = {
  xa: string; xu: string; ya: string; yu: string; A: number[]; act: string; what: string; after: string; subj: string;
  /** 높이 맥락이면 true(0 = 땅/물), 이익 맥락이면 false */ height: boolean; zero: string; start?: string; xWord: string; yWord: string; base?: string;
};
const H16 = (act: string, subj: string, base: string, start: string, zero: string, ya = "Height"): Scene => ({ xa: "Time", xu: "seconds", ya, yu: "feet", A: [-16], act, what: `the height of ${subj} above the ${base}`, after: `after ${start}`, subj, height: true, zero, start, xWord: "time", yWord: "height", base });
const H5 = (act: string, subj: string, base: string, start: string, zero: string): Scene => ({ xa: "Time", xu: "seconds", ya: "Height", yu: "meters", A: [-5], act, what: `the height of ${subj} above the ${base}`, after: `after ${start}`, subj, height: true, zero, start, xWord: "time", yWord: "height", base });
const PR = (act: string, subj: string, xa: string, xWord: string, ya: string, yu: string, yWord: string, zero: string, A: number[]): Scene => ({ xa, xu: "dollars", ya, yu, A, act, what: `the ${yWord} for several values of the ${xWord}`, after: "", subj, height: false, zero, xWord, yWord });
const SCENES: Scene[] = [
  H16("A ball is thrown upward from the top of a platform", "the ball", "ground", "the ball was thrown", "hit the ground"),
  H16("A diver jumps upward from a diving platform", "the diver", "water", "the diver jumped", "enter the water", "Height above water"),
  H16("A stone is tossed upward from the edge of a cliff", "the stone", "beach", "the stone was tossed", "hit the beach"),
  H16("A water balloon is launched from a slingshot on a balcony", "the balloon", "ground", "the balloon was launched", "hit the ground"),
  H16("A football is punted from just above the ground", "the football", "ground", "the football was punted", "hit the ground"),
  H16("A tennis ball is hit straight up from the top of a wall", "the tennis ball", "ground", "the tennis ball was hit", "hit the ground"),
  H16("A frog leaps upward from a rock in a pond", "the frog", "water", "the frog leaped", "land in the water", "Height above water"),
  H16("A juggler tosses a pin upward from a stage", "the pin", "floor", "the pin was tossed", "hit the floor"),
  H5("A model rocket is launched from a raised stand", "the rocket", "ground", "the rocket was launched", "land on the ground"),
  H5("An arrow is shot upward from the top of a tower", "the arrow", "ground", "the arrow was shot", "hit the ground"),
  H5("A flare is fired upward from a ship's deck", "the flare", "sea", "the flare was fired", "reach the sea"),
  H5("A pebble is flicked upward from a bridge", "the pebble", "river", "the pebble was flicked", "reach the river"),
  H5("A toy drone drops a ball after tossing it upward from a rooftop", "the ball", "ground", "the ball was tossed", "hit the ground"),
  H5("A volleyball is served upward from a player's hand", "the volleyball", "floor", "the volleyball was served", "hit the floor"),
  PR("A company models its weekly profit as a quadratic function of the price it charges for a product", "the company", "Price", "price", "Profit", "hundreds of dollars", "profit", "break even", [-4, -2]),
  PR("A theater models the gain from a show as a quadratic function of the ticket price", "the theater", "Ticket price", "ticket price", "Gain", "hundreds of dollars", "gain", "have a gain of zero", [-4, -2]),
  PR("A bakery models the monthly profit from its cakes as a quadratic function of the price of a cake", "the bakery", "Cake price", "price", "Profit", "thousands of dollars", "profit", "earn zero profit", [-4, -1]),
  PR("A gym models its monthly earnings as a quadratic function of the membership fee", "the gym", "Membership fee", "fee", "Earnings", "hundreds of dollars", "earnings", "have zero earnings", [-4, -2]),
  PR("A food truck models its daily profit as a quadratic function of the price of a meal", "the food truck", "Meal price", "price", "Profit", "tens of dollars", "profit", "break even", [-4, -1]),
  PR("A museum models the income from a special exhibit as a quadratic function of the admission price", "the museum", "Admission price", "admission price", "Income", "hundreds of dollars", "income", "have zero income", [-4, -2]),
];
type Sc = Quad & { s: Scene };
const mk = (s: Scene, A: number, B: number, C: number, xs: number[]): Sc => {
  const q = quadTab("h", A, B, C, xs, 999); if (q.ys.some((y) => y < 0) && s.height) throw new GenFail("음수 높이"); return { ...q, s, fig: { ...q.fig, columns: [`${s.xa} (${s.xu})`, `${s.ya} (${s.yu})`] } };
};
const pickScene = (rng: Rng, f: (s: Scene) => boolean = () => true) => rng.pick(SCENES.filter(f));
/** 꼭짓점이 h(정수 또는 .5), 표는 x0 부터 연속 5~6개. */
function vertexScene(rng: Rng, o: { half?: boolean; vIn?: boolean; x0?: number; pred?: (s: Scene) => boolean } = {}): Sc {
  for (let t = 0; t < 120; t++) {
    const s = pickScene(rng, o.pred); const A = rng.pick(s.A); const n = rng.int(5, 6); const x0 = o.x0 ?? (s.height ? rng.int(0, 1) : rng.int(2, 8));
    const h = x0 + rng.int(1, n - 2) + (o.half ? 0.5 : 0); const B = -2 * A * h; const C = s.height ? rng.int(4, 120) : rng.int(5, 60) + A * h * h; const xs = xsRun(x0, n);
    if (!isInt(B)) continue; const K = C - (B * B) / (4 * A); if (!isInt(K)) continue; if (o.vIn === true && !xs.includes(h)) continue;
    try { return mk(s, A, B, C, xs); } catch { continue; }
  }
  throw new GenFail("맥락 꼭짓점 장면 표집 실패");
}
const ctx = (rng: Rng, s: Scene) => {
  const lead = rng.pick(["", "", "", "Read the following situation. ", "A math class studies a real-world model. ", "Consider a quadratic model. ", "Here is a modeling problem. "]);
  const tab = s.height
    ? rng.pick([`The table shows ${s.what} at several times ${s.after}.`, `The table shown gives ${s.what}, recorded at several times ${s.after}.`, `Selected values of ${s.what} ${s.after} are listed in the table.`, `Measurements of ${s.what} were taken at several times ${s.after}, as shown in the table.`, `The table records ${s.what} at one-second intervals ${s.after}.`])
    : rng.pick([`The table shows ${s.what}.`, `The table shown lists ${s.what}.`, `Selected values from the model, giving ${s.what}, are in the table.`, `Using the model, an analyst computed ${s.what}, as shown in the table.`]);
  const model = rng.pick(["", " The relationship is quadratic.", " A quadratic function models the data.", " The data fit a quadratic model exactly.", " Assume the quadratic model holds for all values considered."]);
  return rng.chance(0.5) ? `${lead}${s.act}. ${tab}${model}` : `${lead}${s.act}.${model} ${tab}`;
};
const maxQ = (rng: Rng, s: Scene) => s.height ? rng.pick([`What is the maximum height, in ${s.yu}, reached by ${s.subj}?`, `According to the model, what is the greatest height, in ${s.yu}, of ${s.subj}?`]) : rng.pick([`What is the maximum ${s.yWord}, in ${s.yu}, according to the model?`, `According to the model, what is the greatest ${s.yWord}, in ${s.yu}, that ${s.subj} can earn?`]);
const atMaxQ = (rng: Rng, s: Scene) => s.height ? rng.pick([`How many ${s.xu} after ${s.start} does ${s.subj} reach its maximum height?`, `At what time, in ${s.xu}, is ${s.subj} at its greatest height?`]) : rng.pick([`At what ${s.xWord}, in ${s.xu}, is the ${s.yWord} greatest?`, `What ${s.xWord}, in ${s.xu}, gives ${s.subj} the maximum ${s.yWord}?`]);

export const ITEM = defineItem({
  prefix: "nf", itemId: "nonlinear_functions.context_graph_features.TB.P",
  hard: [
    {
      op: "repr_shift", structure: "맥락 이차 값표(꼭짓점이 표에 없을 수 있음)에서 식을 세워 꼭짓점의 y 좌표 = 최댓값을 맥락으로 해석", extra: "표의 가장 큰 값이 최댓값이 아니어서 식(또는 대칭)으로 꼭짓점을 구한 뒤 맥락의 최대 높이·이익으로 해석해야 함 — medium 은 최대가 되는 시점(대칭)",
      concepts: ["이차식 세우기", "꼭짓점 = 최댓값", "맥락 해석(높이·이익)"],
      gen(rng) {
        const q = vertexScene(rng, { half: true }); const tabMax = Math.max(...q.ys);
        return figInst(rng, {
          stimulus: ctx(rng, q.s), question: maxQ(rng, q.s), correct: q.K,
          wrongs: [W(tabMax, "axis_misread", "표의 가장 큰 값을 답했다."), W(q.H, "axis_misread", "최대가 되는 x 를 답했다."), W(q.C, "formula_misuse", "처음 값(y 절편)을 답했다."), W(q.K + q.A, "other", "축을 한 칸 잘못 잡았다."), W(2 * q.K - tabMax, "other", "계산 중 어긋났다.")].filter((w) => w.v !== q.K && w.v > 0),
          verificationJs: figJs({}, q.fig, `${QUAD_JS}if (A >= 0) throw new Error('최댓값 없음'); return K;`),
          trace: [...quadRead(q), symStep(q), [`최댓값 = h(${fmtNum(q.H)}) = ${fmtNum(q.K)} ${q.s.yu} 이다.`, "Evaluate at the vertex; this is the maximum."]], variant: "max_value_context",
        }, q.fig);
      },
    },
    {
      op: "chain2", structure: "값표에서 식을 세운 뒤 영점(땅에 닿는 시점·손익분기 가격)을 풀어 맥락에 맞는 해를 고름", extra: "식 → 이차방정식의 두 해 → 맥락(양수·큰 값)으로 선택, 2단 연쇄 — medium 은 최대 시점",
      concepts: ["이차식 세우기", "이차방정식의 해", "맥락에 맞는 해 선택"],
      gen(rng) {
        let q: Sc | null = null; let T = 0;
        for (let t = 0; t < 120 && !q; t++) {
          const s = pickScene(rng); const A = rng.pick(s.A); const n = rng.int(5, 6);
          if (s.height) { T = rng.int(n, n + 2); const sv = A === -16 ? rng.pick([0.5, 1, 2]) : rng.pick([1, 2]); const B = A * (sv - T), C = -A * T * sv; try { q = mk(s, A, B, C, xsRun(0, n)); } catch { q = null; } }
          else { const p = rng.int(2, 6); T = p + rng.int(n, n + 3); const x0 = p + 1; try { q = mk(s, A, -A * (p + T), A * p * T, xsRun(x0, n)); } catch { q = null; } if (q && q.xs.includes(T)) q = null; }
        }
        if (!q) throw new GenFail("영점 장면"); const s = q.s; const other = q.C / q.A / T;
        const question = s.height ? rng.pick([`How many ${s.xu} after ${s.start} will ${s.subj} ${s.zero}?`, `According to the model, at what time, in ${s.xu}, will ${s.subj} ${s.zero}?`]) : rng.pick([`What is the greater ${s.xWord}, in ${s.xu}, at which ${s.subj} would ${s.zero}?`, `According to the model, ${s.subj} would ${s.zero} at two ${s.xWord}s. What is the greater one, in ${s.xu}?`]);
        return figInst(rng, {
          stimulus: ctx(rng, s), question, correct: T,
          wrongs: [W(Math.abs(other), "condition_ignored", "맥락에 맞지 않는 다른 해(의 크기)를 답했다."), W(q.H, "axis_misread", "최대가 되는 x 를 답했다."), W(2 * q.H, "formula_misuse", "두 해의 합을 답했다."), W(T + 1, "other", "한 칸 어긋났다."), W(q.xs[q.xs.length - 1] + 1, "step_missing", "표를 한 칸만 이어 답했다.")].filter((w) => w.v !== T && w.v > 0),
          verificationJs: figJs({}, q.fig, `${QUAD_JS}const a2=A, b2=B, c2=C; ${ROOTS_JS}return hi;`),
          trace: [...quadRead(q), [`h(x) = 0 을 풀면 x = ${fmtNum(other)}, ${T} 이다.`, "Solve the equation equal to zero."], [`맥락상 ${s.height ? "양수인 시간" : "큰 값"} ${T} ${s.xu} 이다.`, "Choose the solution that fits the context."]], variant: "zero_in_context",
        }, q.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "값표에서 식을 세워 값이 기준 c 보다 큰 구간의 양 끝(두 해)을 구하고 그 길이를 구함", extra: "h(x) = c 의 두 해(표에 없음)를 구해 비교 구간의 길이로 해석해야 함(한 해만 답하는 것이 함정) — medium 은 최대 시점",
      concepts: ["이차식 세우기", "이차방정식 h(x) = c", "구간의 길이(맥락 해석)"],
      gen(rng) {
        const s = pickScene(rng, (x) => x.A.includes(-16) || x.A.includes(-4)); const A = s.A.includes(-16) ? -16 : -4; const n = s.height ? 5 : rng.int(5, 6); const x0 = s.height ? 0 : rng.int(2, 6);
        const t1 = x0 + rng.int(0, 1) + 0.5; const t2 = t1 + rng.int(s.height ? 3 : 2, s.height ? 4 : n - 2); const c = s.height ? 16 * t1 * t2 + rng.int(4, 50) : rng.int(2, 30);
        const q = mk(s, A, -A * (t1 + t2), A * t1 * t2 + c, xsRun(x0, n)); if (!isInt(q.B) || !isInt(q.C)) throw new GenFail("int"); const ans = t2 - t1;
        const question = s.height ? rng.pick([`For how many ${s.xu} is ${s.subj} more than ${c} ${s.yu} above the ${s.base}?`, `How many ${s.xu} does ${s.subj} spend at a height greater than ${c} ${s.yu}?`]) : `The ${s.yWord} is greater than ${c} ${s.yu} for all ${s.xWord}s between two values. What is the difference, in ${s.xu}, between these two ${s.xWord}s?`;
        return figInst(rng, {
          stimulus: ctx(rng, s), question, correct: ans,
          wrongs: [W(t2, "step_missing", "끝점 하나만 답했다."), W(t1, "step_missing", "시작점을 답했다."), W(q.ys.filter((y) => y > c).length, "axis_misread", "표에서 기준보다 큰 칸 수를 셌다."), W(ans / 2, "formula_misuse", "반만 답했다."), W(q.H, "axis_misread", "최대가 되는 x 를 답했다."), W(ans + 1, "other", "끝점을 표의 칸으로 반올림했다."), W(ans - 1, "other", "끝점을 표의 칸으로 내림했다.")].filter((w) => Math.abs(w.v - ans) > 1e-9 && w.v > 0),
          verificationJs: figJs({ c }, q.fig, `${QUAD_JS}const a2=A, b2=B, c2=C-P.c; ${ROOTS_JS}return hi - lo;`),
          trace: [...quadRead(q), [`h(x) = ${c} ⇒ ${fmtNum(q.A)}(x - ${fmtNum(t1)})(x - ${fmtNum(t2)}) = 0, 두 해 ${fmtNum(t1)}, ${fmtNum(t2)} 이다.`, "Solve h(x) = c."], [`그 사이에서 h(x) > ${c} 이므로 길이 = ${fmtNum(t2)} - ${fmtNum(t1)} = ${fmtNum(ans)} 이다.`, "The values exceed c between the two solutions."]], variant: "duration_above",
        }, q.fig);
      },
    },
    {
      op: "inverse", structure: "x = 0 행이 없는 맥락 이차 값표에서 거슬러 계산해 처음 높이(y 절편)를 구함", extra: "표가 1 초부터라 식을 세워 x = 0 의 값으로 거슬러 올라가야 함(표 첫 값을 답하는 것이 함정) — medium 은 최대 시점",
      concepts: ["이차식 세우기", "y 절편 = 처음 값", "맥락 해석(출발 높이)"],
      gen(rng) {
        const q = vertexScene(rng, { x0: 1, pred: (s) => s.height, half: rng.chance(0.5) }); const s = q.s;
        const question = rng.pick([`According to the model, what was the height, in ${s.yu}, of ${s.subj} at the moment ${s.start}?`, `What was the height, in ${s.yu}, of ${s.subj} at time 0 ${s.xu}?`, `How high, in ${s.yu}, was ${s.subj} at the instant ${s.start}?`]);
        const d1 = q.ys[1] - q.ys[0]; const d2 = q.ys[2] - 2 * q.ys[1] + q.ys[0];
        return figInst(rng, {
          stimulus: ctx(rng, s), question, correct: q.C,
          wrongs: [W(q.ys[0], "axis_misread", "표의 첫 값을 답했다."), W(q.ys[0] - d1, "formula_misuse", "1계 차분만 거슬러 뺐다(2계 차분 무시)."), W(q.K, "axis_misread", "최대 높이를 답했다."), W(q.ys[0] - d1 + d2 * 2, "sign_error", "2계 차분 부호를 반대로 썼다."), W(q.C + 16, "other", "어긋났다.")].filter((w) => w.v !== q.C && w.v > 0),
          verificationJs: figJs({}, q.fig, `${QUAD_JS}return f(0);`),
          trace: [...quadRead(q), [`x = 0 을 대입하면 h(0) = c = ${q.C} ${s.yu} 이다.`, "The value at time 0 is the starting height."]], variant: "initial_height",
        }, q.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "time_of_max", structure: "꼭짓점이 표에 있는 맥락 값표에서 최대가 되는 x 를 대칭으로 읽음", extra: "easy: 대칭 가운데", concepts: ["이차함수의 대칭", "맥락 해석"],
      gen(rng) {
        const q = vertexScene(rng, { vIn: true });
        return figInst(rng, { stimulus: ctx(rng, q.s), question: atMaxQ(rng, q.s), correct: q.H, wrongs: [W(q.K, "axis_misread", "최댓값을 답했다."), W(q.H + 1, "other", "옆 칸을 읽었다."), W(q.H - 1, "other", "옆 칸을 읽었다."), W(2 * q.H, "formula_misuse", "두 배로 했다.")].filter((w) => w.v !== q.H && w.v > 0), verificationJs: figJs({}, q.fig, `${QUAD_JS}return H;`), trace: [symStep(q), [`따라서 ${fmtNum(q.H)} ${q.s.xu} 에서 최대이다.`, "The maximum is on the axis of symmetry."]], variant: "time_max_read",
        }, q.fig);
      },
    },
    {
      lv: "medium", name: "time_of_max_half", structure: "꼭짓점이 두 칸 사이인 맥락 값표에서 같은 값의 쌍으로 최대 시점을 구함", extra: "medium: 쌍의 가운데(반정수)", concepts: ["이차함수의 대칭", "맥락 해석"],
      gen(rng) {
        const q = vertexScene(rng, { half: true }); if (!q.ys.some((y, i) => q.ys.indexOf(y) !== i)) throw new GenFail("pair");
        return figInst(rng, { stimulus: ctx(rng, q.s), question: atMaxQ(rng, q.s), correct: q.H, wrongs: [W(q.H - 0.5, "axis_misread", "표의 큰 값 칸을 읽었다."), W(q.H + 0.5, "axis_misread", "표의 큰 값 칸을 읽었다."), W(q.K, "axis_misread", "최댓값을 답했다."), W(2 * q.H, "formula_misuse", "두 x 의 합을 답했다.")].filter((w) => w.v !== q.H && w.v > 0), verificationJs: figJs({}, q.fig, `${QUAD_JS}return H;`), trace: [quadRead(q)[0], symStep(q), [`따라서 ${fmtNum(q.H)} ${q.s.xu} 에서 최대이다.`, "The maximum is on the axis."]], variant: "time_max_half",
        }, q.fig);
      },
    },
  ],
});
