// two_variable_data.outlier_influence_on_fit.SC.P — 이상치가 든 산점도(추세선 = 이상치 포함 전체의 최소제곱선)에서 이상치를 빼면 기울기·절편·상관이 어떻게 달라지는지 고르고,
// 두 그래프의 이상치 위치(끝 / 가운데)에 따른 영향 크기를 비교한다. 서술 선지(MC 전용) 3개 + 개수 1개.
import type { Rng } from "../../../rng";
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs, pearson } from "../../../figure-kit";
import { defineItem, MC_ONLY_STATEMENT, statementInst } from "../item-kit";
import { gInst } from "../graph-kit";
import { OUT_JS, outScene, scFig, fitOf, type OutScene } from "./_sc-kit";

const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const intro = (rng: Rng, z: OutScene) => rng.pick([
  `The scatterplot shows ${z.topic.x} and ${z.topic.y} for 10 data points, along with the line of best fit for all 10 points. One data point is an outlier.`,
  `Researchers recorded ${z.topic.x} and ${z.topic.y} for 10 cases; the scatterplot shows the data and the line of best fit for all of them. One point lies far from the others.`,
  `A scatterplot of 10 observations relates ${z.topic.x} to ${z.topic.y}. The line of best fit shown was computed from all 10 points, including one outlier.`,
  `The graph shows 10 data points on ${z.topic.x} and ${z.topic.y} and the line of best fit for all of them. A single point is an outlier, far from the pattern of the rest.`,
  `For ten cases, ${z.topic.x} and ${z.topic.y} were plotted in the scatterplot shown, and the line of best fit through all ten points is drawn. Nine points follow a clear trend; one does not.`,
  `An analyst made the scatterplot shown of ${z.topic.x} against ${z.topic.y} for ten observations. The line of best fit shown uses every observation, and one of them is an outlier.`,
  `In the scatterplot, each point pairs ${z.topic.x} with ${z.topic.y}. The drawn line of best fit was found from all 10 points, one of which is unusually far from the line.`,
  `Ten pairs of values for ${z.topic.x} and ${z.topic.y} are plotted in the graph shown with their line of best fit. One pair is an outlier.`,
]);
const sl = (z: OutScene) => (z.fit10.slope > z.fit9.slope ? "decrease" : "increase");   // 이상치를 빼면 기울기가 바뀌는 방향
const ic = (z: OutScene) => (z.fit10.intercept > z.fit9.intercept ? "decrease" : "increase");
const COMBO = (a: string, b: string) => `${a} ${b}`;

export const ITEM = defineItem({
  prefix: "tvd", itemId: "two_variable_data.outlier_influence_on_fit.SC.P",
  hard: [
    {
      op: "repr_shift", sprNo: MC_ONLY_STATEMENT, structure: "이상치를 빼면 기울기가 어느 쪽으로 변하고 상관(직선에 가까움)이 어떻게 변하는지 서술 선지에서 고름", extra: "이상치가 추세선을 끄는 방향을 그림에서 읽어 기울기 변화의 방향을 정하고, 이상치를 빼면 점이 직선에 더 가까워짐을 함께 판단해야 함 — medium 은 한 가지 변화",
      concepts: ["산점도", "이상치의 영향", "기울기와 상관"],
      gen(rng) {
        const z = outScene(rng); const s = sl(z); const o = s === "increase" ? "decrease" : "increase";
        const V1 = rng.pick([(d: string, st: string) => `The slope of the line of best fit would ${d}, and the data would fit the line ${st}.`, (d: string, st: string) => `The new line would have a slope that would ${d}, and the points would be ${st === "more closely" ? "closer to" : "farther from"} the line.`, (d: string, st: string) => `Removing the outlier would make the slope ${d === "increase" ? "greater" : "smaller"}, and the remaining points would lie ${st === "more closely" ? "nearer to" : "farther from"} the line.`]);
        const mk = V1; const correct = mk(s, "more closely");
        return statementInst(rng, {
          stimulus: intro(rng, z), question: rng.pick(["Which statement describes what would happen if the outlier were removed and a new line of best fit were found for the remaining points?", "If the outlier is removed, which of the following is true about the new line of best fit?"]), correct,
          wrongs: [{ text: mk(o, "more closely"), reason: "기울기 변화의 방향을 반대로 판단했다." }, { text: mk(s, "less closely"), reason: "이상치를 빼면 더 멀어진다고 판단했다." }, { text: mk(o, "less closely"), reason: "방향과 가까움을 모두 반대로 판단했다." }], figure: z.fig, P: { inc: mk("increase", "more closely"), dec: mk("decrease", "more closely") },
          body: `${OUT_JS}if (Math.abs(f9.r) <= Math.abs(f10.r) + 0.05) throw new Error('상관 변화 작음'); if (Math.abs(f10.m - f9.m) < 0.1 * Math.abs(f9.m)) throw new Error('기울기 변화 작음'); const want = f10.m > f9.m ? P.dec : P.inc; const i = P.options.indexOf(want); if (i < 0) throw new Error('맞는 서술 없음'); return i;`,
          trace: [["그림에서 이상치(추세선에서 가장 먼 점)를 찾는다.", "Find the outlier (farthest from the line)."], [`이상치가 추세선보다 ${z.out[1] > z.fit10.slope * z.out[0] + z.fit10.intercept ? "위" : "아래"}에 있고 오른쪽 끝이라 기울기를 ${z.fit10.slope > z.fit9.slope ? "키운다" : "줄인다"}.`, "The outlier pulls the slope toward itself."], [`이상치를 빼면 기울기는 ${s === "increase" ? "커진다" : "작아진다"}.`, "Removing it moves the slope back."], ["나머지 점은 직선에 더 가깝게 놓인다(상관이 강해진다).", "The remaining points fit the line better."], ["따라서 두 가지를 모두 맞게 말한 서술이 정답이다.", "Choose the statement matching both."]], variant: "outlier_effect_slope_and_fit",
        });
      },
    },
    {
      op: "chain2", sprNo: MC_ONLY_STATEMENT, structure: "이상치를 빼면 y 절편과 기울기가 각각 어느 쪽으로 변하는지 서술 선지에서 고름", extra: "이상치가 오른쪽 끝에서 직선을 끌어 기울기와 절편이 서로 반대로 움직임을 이해해야 함(같은 방향이라고 답하는 선지가 함정) — medium 은 한 가지 변화",
      concepts: ["산점도", "이상치의 영향", "기울기와 절편"],
      gen(rng) {
        const z = outScene(rng); const s = sl(z), i = ic(z); const flip = (d: string) => (d === "increase" ? "decrease" : "increase");
        const mk = rng.pick([(a: string, b: string) => `The y-intercept would ${a} and the slope would ${b}.`, (a: string, b: string) => `The line would cross the y-axis at a ${a === "increase" ? "higher" : "lower"} point, and its slope would ${b}.`, (a: string, b: string) => `The slope would ${b}, while the y-intercept would ${a}.`]);
        return statementInst(rng, {
          stimulus: intro(rng, z), question: rng.pick(["If the outlier were removed, how would the y-intercept and the slope of the line of best fit change?", "Which statement is true about the line of best fit for the points that remain after the outlier is removed?"]), correct: mk(i, s),
          wrongs: [{ text: mk(flip(i), s), reason: "절편 변화의 방향을 반대로 판단했다." }, { text: mk(i, flip(s)), reason: "기울기 변화의 방향을 반대로 판단했다." }, { text: mk(flip(i), flip(s)), reason: "두 방향을 모두 반대로 판단했다." }], figure: z.fig, P: { ii: mk("increase", "increase"), id: mk("increase", "decrease"), di: mk("decrease", "increase"), dd: mk("decrease", "decrease") },
          body: `${OUT_JS}if (Math.abs(f10.m - f9.m) < 0.1 * Math.abs(f9.m)) throw new Error('기울기 변화 작음'); const I = f10.b > f9.b ? 'decrease' : 'increase', S = f10.m > f9.m ? 'decrease' : 'increase'; const want = P[(I === 'increase' ? 'i' : 'd') + (S === 'increase' ? 'i' : 'd')]; const i = P.options.indexOf(want); if (i < 0) throw new Error('맞는 서술 없음'); return i;`,
          trace: [["그림에서 이상치를 찾는다.", "Find the outlier."], [`이상치는 오른쪽 끝에서 추세선을 ${z.fit10.slope > z.fit9.slope ? "위로" : "아래로"} 끌어 기울기를 ${z.fit10.slope > z.fit9.slope ? "키운다" : "줄인다"}.`, "Effect on the slope."], [`직선은 점들의 평균점을 지나므로 기울기가 변하면 절편은 반대로 변한다.`, "The line passes near the centroid, so the intercept moves oppositely."], [`이상치를 빼면 기울기는 ${s === "increase" ? "커지고" : "작아지고"} 절편은 ${i === "increase" ? "커진다" : "작아진다"}.`, "Combine."], ["두 변화를 함께 맞게 말한 서술을 고른다.", "Pick the matching statement."]], variant: "outlier_effect_intercept_and_slope",
        });
      },
    },
    {
      op: "constraint_select", structure: "이상치를 뺀 나머지 점 중 원래 추세선 위에 있는 점의 개수를 셈", extra: "이상치를 먼저 가려내고 나머지 점을 추세선 위·아래로 나눠 세야 함(이상치를 포함하면 틀림) — medium 은 전체 점",
      concepts: ["산점도", "이상치", "추세선 위의 점"],
      gen(rng) {
        const z = outScene(rng); const f = z.fit10; const above = z.base.filter((p) => p[1] > f.slope * p[0] + f.intercept).length; const aboveAll = z.all.filter((p) => p[1] > f.slope * p[0] + f.intercept).length; if (above < 2 || z.base.length - above < 2) throw new GenFail("balance");
        return gInst(rng, {
          stimulus: intro(rng, z), question: rng.pick(["How many of the points other than the outlier lie above the line of best fit shown?", "Not counting the outlier, how many of the data points are above the line of best fit?"]), correct: above,
          wrongs: [W(aboveAll, "condition_ignored", "이상치까지 셌다."), W(z.base.length - above, "opposite", "추세선 아래의 점을 셌다."), W(above + 1, "other", "하나를 더 셌다."), W(above - 1, "other", "하나를 빠뜨렸다."), W(z.base.length, "condition_ignored", "이상치를 뺀 점 전체를 답했다.")].filter((w) => w.v !== above && w.v > 0),
          verificationJs: figJs({}, z.fig, `${OUT_JS}return rest.filter((p) => p[1] > fl.slope * p[0] + fl.intercept + 1e-9).length;`),
          trace: [["그림에서 추세선에서 가장 먼 점을 이상치로 가려낸다.", "Identify the outlier."], [`이상치를 뺀 나머지 ${z.base.length} 개 점을 본다.`, "Look at the rest."], [`추세선 위에 있는 점: ${above} 개이다.`, "Count those above the line."], [`이상치가 ${aboveAll === above ? "아래" : "위"}에 있으므로 이를 포함하면 ${aboveAll} 개가 된다.`, "Including the outlier would change the count."], [`따라서 ${above} 이다.`, "State the count."]], variant: "count_above_excluding_outlier",
        }, z.fig);
      },
    },
    {
      op: "compare_scenarios", sprNo: MC_ONLY_STATEMENT, structure: "같은 점들에서 이상치의 위치만 다른 두 그래프(끝 / 가운데)를 비교해, 이상치를 뺄 때 기울기가 더 크게 변하는 그래프를 고름", extra: "이상치의 x 위치(끝)가 기울기에 미치는 영향이 큼을 이용해 두 그래프를 비교해야 함(y 의 벗어난 정도는 같음) — medium 은 한 그래프",
      concepts: ["산점도", "이상치의 영향(지렛대 효과)", "두 경우 비교"],
      gen(rng) {
        for (let tr = 0; tr < 60; tr++) {
          const a = outScene(rng, { outX: 10 }); const dir = a.out[1] > a.fit10.slope * 10 + a.fit10.intercept ? 1 : -1; const off = a.out[1] - (a.fit9.slope * 10 + a.fit9.intercept);
          // 같은 y 벗어남(off)을 x=5 로 옮긴 그래프: 기본 점은 x=5 를 비우고 x=10 을 채운다(점 수 10)
          const base2: [number, number][] = a.base.filter((p) => p[0] !== 5).concat([[10, a.base.find((p) => p[0] === 9)![1] + Math.round(a.fit9.slope)]]); const y5 = Math.round(a.fit9.slope * 5 + a.fit9.intercept + off);
          const all2 = [...base2, [5, y5] as [number, number]].sort((p, q) => p[0] - q[0]); const fit2 = fitOf(all2), fit9b = fitOf(base2);
          const d1 = Math.abs(a.fit10.slope - a.fit9.slope), d2 = Math.abs(fit2.slope - fit9b.slope); if (d1 < 2.2 * d2 || y5 < a.S / 2 || y5 > a.yMax) continue; void dir;
          const top = Math.max(a.yMax, ...all2.map((p) => p[1]) ); const yMax = (Math.floor(top / a.S) + (top % a.S === 0 ? 0 : 1)) * a.S || a.yMax; const figA = scFig(a.topic, a.all, a.fit10, a.S, Math.max(yMax, a.yMax)), figB = scFig(a.topic, all2, fit2, a.S, Math.max(yMax, a.yMax));
          const endIsA = rng.chance(0.5); const sets = endIsA ? [figA, figB] : [figB, figA];
          const fig = { type: "figure_set" as const, figures: [{ id: "A", title: "Graph A", spec: sets[0] }, { id: "B", title: "Graph B", spec: sets[1] }] };
          const T = rng.pick([{ ok: "Graph # changes more, because its outlier is at the far end of the x-values", w1: "Graph # changes more, because its outlier is closer to the middle", same: "The slope changes by the same amount in both graphs", cant: "It cannot be determined from the graphs" }, { ok: "Graph #, because an outlier at an extreme x-value pulls the line more", w1: "Graph #, because an outlier near the middle pulls the line more", same: "Neither graph, because the slope changes equally", cant: "Neither graph can be compared without the equations" }]);
          const endId = endIsA ? "A" : "B", midId = endIsA ? "B" : "A"; const correct = T.ok.replace("#", endId) + "."; const wrongs = [{ text: T.w1.replace("#", midId) + ".", reason: "이상치가 가운데이면 더 큰 영향을 준다고 판단했다." }, { text: T.same + ".", reason: "x 위치에 따른 차이를 무시했다." }, { text: T.cant + ".", reason: "판단할 수 없다고 답했다." }];
          return statementInst(rng, {
            stimulus: `Graph A and Graph B each show data on ${z0(a)} for 10 data points, with the line of best fit for all 10 points. Each graph has one outlier.`, question: rng.pick(["For which graph would removing the outlier change the slope of the line of best fit more?", "Removing the outlier from which graph would change its line of best fit's slope more?"]), correct, wrongs, figure: fig, P: { ok: T.ok },
            body: `const F = FIGURE.figures; if (!F || F.length !== 2) throw new Error('그래프 둘 아님'); const info = F.map((f) => { const pts = f.spec.points, fl = f.spec.fitLine; const resd = (p) => Math.abs(p[1] - (fl.slope * p[0] + fl.intercept)); let oi = 0; pts.forEach((p, i) => { if (resd(p) > resd(pts[oi])) oi = i; }); const rest = pts.filter((_, i) => i !== oi); const sl = (a) => { const n = a.length, mx = a.reduce((s, p) => s + p[0], 0) / n, my = a.reduce((s, p) => s + p[1], 0) / n; let sxy = 0, sxx = 0; for (const p of a) { sxy += (p[0] - mx) * (p[1] - my); sxx += (p[0] - mx) ** 2; } return sxy / sxx; }; return Math.abs(sl(pts) - sl(rest)); }); if (Math.max(...info) < 2 * Math.min(...info)) throw new Error('영향 차이 작음'); const id = info[0] > info[1] ? 'A' : 'B'; const want = P.ok.replace('#', id) + '.'; const i = P.options.indexOf(want); if (i < 0) throw new Error('맞는 서술 없음'); return i;`,
            trace: [["각 그래프에서 추세선에서 가장 먼 점을 이상치로 찾는다.", "Find each outlier."], [`Graph ${endId} 의 이상치는 x 의 오른쪽 끝에, Graph ${midId} 의 이상치는 가운데에 있다.`, "Compare the outlier positions."], ["x 의 끝에 있는 점은 기울기에 지렛대처럼 작용해 더 크게 끈다.", "Extreme x-values have more leverage."], [`이상치가 벗어난 정도는 같으므로 x 위치가 영향을 가른다.`, "The vertical offsets are equal."], [`따라서 Graph ${endId} 이다.`, "Pick the graph with the end outlier."]], variant: "outlier_leverage_two_graphs",
          });
        }
        throw new GenFail("leverage");
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "count_points", structure: "산점도의 점 개수를 셈", extra: "easy: 점 세기", concepts: ["산점도", "점 개수"],
      gen(rng) {
        const z = outScene(rng);
        return gInst(rng, { stimulus: intro(rng, z), question: `How many data points are shown in the scatterplot?`, correct: z.all.length, wrongs: [W(z.base.length, "condition_ignored", "이상치를 뺐다."), W(z.all.length + 1, "other", "하나를 더 셌다."), W(z.all.length - 2, "other", "둘을 빠뜨렸다."), W(z.all.length * 2, "other", "두 배로 셌다.")].filter((w) => w.v !== z.all.length), verificationJs: figJs({}, z.fig, `const pts = FIGURE.points; return pts.length;`), trace: [["그림의 점을 하나씩 센다.", "Count the dots."], [`전체 ${z.all.length} 개이다.`, "Total."]], variant: "count_points" }, z.fig);
      },
    },
    {
      lv: "medium", name: "count_above_all", structure: "추세선 위에 있는 점(이상치 포함)의 개수를 셈", extra: "medium: 위·아래 구별", concepts: ["산점도", "추세선 위의 점"],
      gen(rng) {
        const z = outScene(rng); const f = z.fit10; const above = z.all.filter((p) => p[1] > f.slope * p[0] + f.intercept).length; if (above < 2 || z.all.length - above < 2) throw new GenFail("balance");
        return gInst(rng, { stimulus: intro(rng, z), question: `How many of the 10 data points are above the line of best fit?`, correct: above, wrongs: [W(z.all.length - above, "opposite", "아래의 점을 셌다."), W(above + 1, "other", "하나를 더 셌다."), W(above - 1, "other", "하나를 빠뜨렸다."), W(z.all.length, "condition_ignored", "전체를 답했다.")].filter((w) => w.v !== above && w.v > 0), verificationJs: figJs({}, z.fig, `const pts = FIGURE.points, fl = FIGURE.fitLine; return pts.filter((p) => p[1] > fl.slope * p[0] + fl.intercept + 1e-9).length;`), trace: [["추세선 위에 있는 점을 센다.", "Count dots above the line."], ["점이 선 위·아래에 놓인 개수를 모두 센다.", "Check every dot."], [`${above} 개이다.`, "State the count."]], variant: "count_above_with_outlier" }, z.fig);
      },
    },
  ],
});
void lc; void COMBO; void pearson;
function z0(a: OutScene) { return `${a.topic.x} and ${a.topic.y}`; }
