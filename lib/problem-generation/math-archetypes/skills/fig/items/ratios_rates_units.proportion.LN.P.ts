// ratios_rates_units.proportion.LN.P — 원점을 지나는 비례 관계 그래프(맥락 있는 축)에서 비율(단위당 값)을 읽어 그래프 밖의 값·역산·차·배수를 구한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import type { SeTopic } from "../../../figure-topics";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst, GL_JS, glIntercept, glIntro, glRead, makeLinGraph, offXg, type LinGraph } from "../graph-kit";

const isI = Number.isInteger;
const PROP: SeTopic[] = [
  { x: "the time a printer runs", y: "the number of pages it prints", xa: "Time", ya: "Pages printed", xu: "minutes", yu: "pages" },
  { x: "the time a faucet is open", y: "the amount of water that flows out", xa: "Time", ya: "Water", xu: "minutes", yu: "liters" },
  { x: "the number of boxes packed", y: "the number of items packed", xa: "Boxes", ya: "Items packed", xu: "boxes", yu: "items" },
  { x: "the time a machine runs", y: "the number of parts it makes", xa: "Time", ya: "Parts made", xu: "hours", yu: "parts" },
  { x: "the number of tickets sold", y: "the money collected", xa: "Tickets sold", ya: "Money collected", xu: "tickets", yu: "dollars" },
  { x: "the distance a cyclist rides", y: "the calories burned", xa: "Distance", ya: "Calories burned", xu: "miles", yu: "calories" },
  { x: "the time a drone flies", y: "the distance it covers", xa: "Time", ya: "Distance", xu: "minutes", yu: "kilometers" },
  { x: "the number of pounds of apples bought", y: "the cost", xa: "Weight", ya: "Cost", xu: "pounds", yu: "dollars" },
  { x: "the time a pump runs", y: "the volume of oil it moves", xa: "Time", ya: "Oil moved", xu: "hours", yu: "gallons" },
  { x: "the number of shirts sewn", y: "the fabric used", xa: "Shirts", ya: "Fabric used", xu: "shirts", yu: "yards" },
];
const mk = (rng: Rng): LinGraph => makeLinGraph(rng, { topic: rng.pick(PROP), mSign: 1, bZero: true, mMax: 9 });
const BJ = "if (Math.abs(b) > 1e-9) throw new Error('원점을 지나지 않음');\n";
const rate = (s: LinGraph): [string, string] => [`원점을 지나므로 y = ${fmtNum(s.m)}x 이고, ${s.t.xu} 1 당 ${s.t.yu} ${fmtNum(s.m)} 이다.`, "A proportional relationship passes through the origin; the slope is the constant rate."];
const nz = (s: LinGraph) => { if (s.m <= 0) throw new GenFail("m"); };

export const ITEM = defineItem({
  prefix: "prpg", itemId: "ratios_rates_units.proportion.LN.P",
  hard: [
    { op: "repr_shift", structure: "원점을 지나는 그래프에서 비율을 구해 그림 밖의 x 에서의 값을 구함", extra: "점들에서 비율 y/x 를 구한 뒤 그림 밖으로 곱해야 함(마지막 표시점의 값을 답하는 것이 함정) — medium 은 비율", concepts: ["비례 관계 그래프", "비율", "함숫값"],
      gen(rng) { const s = mk(rng); nz(s); const x = offXg(rng, s, 2, 9); const y = s.m * x; return gInst(rng, { stimulus: glIntro(rng, s), question: `Based on the graph, what is ${s.yq}, in ${s.t.yu}, when ${s.xq} is ${x} ${s.t.xu}?`, correct: y, wrongs: [W(s.ys[s.ys.length - 1], "step_missing", "마지막 표시점의 값을 답했다."), W(y + s.m, "other", "한 단위 더 갔다."), W(y - s.m, "other", "한 단위 덜 갔다."), W(x + s.m, "formula_misuse", "곱하지 않고 더했다."), W(Math.round(x / s.m), "formula_misuse", "비율로 나눴다.")].filter((w) => isI(w.v) && w.v !== y && w.v >= 0), verificationJs: figJs({ x }, s.fig, `${GL_JS}${BJ}return m * P.x;`), trace: [...glRead(s), glIntercept(s), rate(s), [`값 = ${fmtNum(s.m)} × ${x} = ${y} 이다.`, "Multiply the rate by the input."]], variant: "proportion_value_outside" }, s.fig); } },
    { op: "inverse", structure: "비율을 구한 뒤 그림 밖의 값 Y 에 해당하는 x 를 역산", extra: "y = mx 를 거꾸로 풀어야 함(Y 에 비율을 곱하는 것이 함정) — medium 은 읽기", concepts: ["비례 관계 그래프", "비율", "역산"],
      gen(rng) { const s = mk(rng); nz(s); const x = offXg(rng, s, 2, 9); const Y = s.m * x; return gInst(rng, { stimulus: glIntro(rng, s), question: `Based on the graph, for what value of ${s.xq}, in ${s.t.xu}, will ${s.yq} be ${Y} ${s.t.yu}?`, correct: x, wrongs: [W(Y * s.m, "formula_misuse", "비율을 곱했다."), W(Y - s.m, "formula_misuse", "비율을 뺐다."), W(x + 1, "other", "한 단위 어긋났다."), W(Y, "step_missing", "Y 를 답했다."), W(Math.max(1, x - 1), "other", "한 단위 어긋났다.")].filter((w) => isI(w.v) && w.v !== x && w.v >= 0), verificationJs: figJs({ Y }, s.fig, `${GL_JS}${BJ}return P.Y / m;`), trace: [...glRead(s), glIntercept(s), rate(s), [`${fmtNum(s.m)}x = ${Y} 에서 x = ${x} 이다.`, "Divide by the rate."]], variant: "proportion_input_for_value" }, s.fig); } },
    { op: "chain2", structure: "두 개의 그림 밖 x 에서의 값의 차(= 비율 × 입력의 차)를 구함", extra: "비율을 구한 뒤 입력 차에 곱하는 2단 연쇄(한 값만 답하는 것이 함정) — medium 은 한 값", concepts: ["비례 관계 그래프", "비율", "값의 차"],
      gen(rng) { const s = mk(rng); nz(s); const x1 = offXg(rng, s, 1, 5), x2 = x1 + rng.int(2, 8); const d = s.m * (x2 - x1); return gInst(rng, { stimulus: glIntro(rng, s), question: `Based on the graph, how many more ${s.t.yu} does ${s.yq} increase by when ${s.xq} goes from ${x1} ${s.t.xu} to ${x2} ${s.t.xu}?`, correct: d, wrongs: [W(s.m * x2, "step_missing", "큰 x 의 값만 답했다."), W(x2 - x1, "step_missing", "입력의 차만 답했다."), W(s.m * x1, "step_missing", "작은 x 의 값만 답했다."), W(d + s.m, "other", "한 단위 더 갔다.")].filter((w) => isI(w.v) && w.v !== d && w.v >= 0), verificationJs: figJs({ x1, x2 }, s.fig, `${GL_JS}${BJ}return m * (P.x2 - P.x1);`), trace: [...glRead(s), glIntercept(s), rate(s), [`증가량 = ${fmtNum(s.m)} × (${x2} - ${x1}) = ${d} 이다.`, "Multiply the rate by the change in input."]], variant: "proportion_change" }, s.fig); } },
    { op: "compose_kind", structure: "같은 비율로 일하는 k 개가 동시에 작동할 때 그림 밖의 x 에서의 총량을 구함", extra: "비율을 구한 뒤 입력과 개수 k 를 모두 곱해야 함(k 를 빠뜨리는 것이 함정) — medium 은 한 개", concepts: ["비례 관계 그래프", "비율", "배수"],
      gen(rng) { const s = mk(rng); nz(s); const x = offXg(rng, s, 1, 6); const k = rng.int(2, 6); const tot = k * s.m * x; if (tot > 2000) throw new GenFail("big"); return gInst(rng, { stimulus: `${glIntro(rng, s)} ${k} identical setups, each following the graph shown, run at the same time.`, question: `In total, how many ${s.t.yu} will the ${k} setups produce when each has ${s.xq} equal to ${x} ${s.t.xu}?`, correct: tot, wrongs: [W(s.m * x, "step_missing", "한 개의 값만 답했다."), W(k * x, "formula_misuse", "비율을 곱하지 않았다."), W(k * s.m, "step_missing", "x 를 곱하지 않았다."), W(tot + s.m, "other", "어긋났다.")].filter((w) => isI(w.v) && w.v !== tot && w.v >= 0), verificationJs: figJs({ x, k }, s.fig, `${GL_JS}${BJ}return P.k * m * P.x;`), trace: [...glRead(s), glIntercept(s), rate(s), [`한 개: ${fmtNum(s.m)} × ${x} = ${s.m * x}, ${k} 개: ${tot} 이다.`, "Multiply by the number of setups."]], variant: "proportion_multiple_units" }, s.fig); } },
  ],
  em: [
    { lv: "easy", name: "rate_read", structure: "비례 그래프에서 비율(단위당 값)을 읽음", extra: "easy: 비율 읽기", concepts: ["비례 관계 그래프", "비율"],
      gen(rng) { const s = mk(rng); nz(s); return gInst(rng, { stimulus: glIntro(rng, s), question: `Based on the graph, how many ${s.t.yu} correspond to each 1 ${s.t.xu.replace(/s$/, "")}?`, correct: s.m, wrongs: [W(s.ys[1], "axis_misread", "표시점의 값을 답했다."), W(s.xs[1], "axis_misread", "표시점의 x 를 답했다."), W(s.m + 1, "other", "한 단위 어긋났다."), W(Math.max(1, s.m - 1), "other", "한 단위 어긋났다.")].filter((w) => w.v !== s.m && w.v >= 0), verificationJs: figJs({}, s.fig, `${GL_JS}${BJ}return m;`), trace: [...glRead(s), [`비율은 ${fmtNum(s.m)} 이다.`, "The slope is the rate."]], variant: "proportion_rate_read" }, s.fig); } },
    { lv: "medium", name: "value_inside", structure: "그림 안의 x 에서의 값을 비율로 계산", extra: "medium: 비율 × x", concepts: ["비례 관계 그래프", "비율"],
      gen(rng) { const s = mk(rng); nz(s); const x = rng.int(1, s.X - 1); const y = s.m * x; if (y > s.yMax) throw new GenFail("range"); return gInst(rng, { stimulus: glIntro(rng, s), question: `Based on the graph, what is ${s.yq}, in ${s.t.yu}, when ${s.xq} is ${x} ${s.t.xu}?`, correct: y, wrongs: [W(y + s.m, "other", "한 단위 더 갔다."), W(x + s.m, "formula_misuse", "더했다."), W(Math.max(0, y - s.m), "other", "한 단위 덜 갔다.")].filter((w) => isI(w.v) && w.v !== y && w.v >= 0), verificationJs: figJs({ x }, s.fig, `${GL_JS}${BJ}return m * P.x;`), trace: [...glRead(s), rate(s), [`값 = ${fmtNum(s.m)} × ${x} = ${y} 이다.`, "Multiply."]], variant: "proportion_value_inside" }, s.fig); } },
  ],
});
