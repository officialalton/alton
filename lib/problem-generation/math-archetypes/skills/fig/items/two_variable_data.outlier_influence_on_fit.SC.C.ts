// two_variable_data.outlier_influence_on_fit.SC.C — 산점도 4개(점 10개 + 전체 최소제곱 추세선, 이상치 하나씩) 중 이상치를 빼면 기울기가 늘어나는 것(또는 줄어드는 것)을 고른다.
// 네 산점도는 같은 축·같은 점(이상치 하나만 위치·방향이 다름)을 쓴다. 오답은 기울기가 반대로 변하는 그림(이상치 위치·크기에 따라 세 규칙).
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { defineItem } from "../item-kit";
import { SPR_NO_DATA_CHOICE, cInst, poolChoices } from "../data-c-kit";
import { LIN_TOPICS, fitOf, scFig, type ScatterFig } from "./_sc-kit";
import type { SeTopic } from "../../../figure-topics";

type Base = { topic: SeTopic; S: number; yMax: number; b0: number; m: number; base10: [number, number][] };
function baseScene(rng: Rng): Base {
  for (let tr = 0; tr < 100; tr++) {
    const topic = rng.pick(LIN_TOPICS); const S = rng.pick([10, 20, 25]); const m = (rng.int(1, 4) * S) / 10 * (rng.chance(0.3) ? -1 : 1); const b0 = S * rng.int(m < 0 ? 5 : 1, m < 0 ? 7 : 3);
    const base10: [number, number][] = Array.from({ length: 10 }, (_, i) => [i + 1, Math.round(b0 + m * (i + 1) + rng.int(-3, 3) * (S / 10))]);
    if (base10.some((p) => p[1] < S / 2 || p[1] > 8 * S)) continue; return { topic, S, yMax: 10 * S, b0, m, base10 };
  }
  throw new GenFail("기본 장면 실패");
}
const withOut = (z: Base, x: number, y: number): [number, number][] => z.base10.map((p) => (p[0] === x ? [x, y] : p) as [number, number]);
const figOf = (z: Base, pts: [number, number][]): ScatterFig => scFig(z.topic, pts, fitOf(pts), z.S, z.yMax);
const pool = (rng: Rng, z: Base, n = 500) => Array.from({ length: n }, () => { const x = rng.pick([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); const dir = rng.pick([-1, 1]); const y = Math.round(z.b0 + z.m * x + dir * rng.int(3, 5) * z.S); if (y < z.S / 2 || y > 9.5 * z.S) return null; return figOf(z, withOut(z, x, y)); }).filter((f): f is ScatterFig => f !== null);
/** c(산점도)의 이상치 x·기울기 변화 d = (이상치 제외 기울기) - (전체 기울기), 기준 T = 0.12·|전체 기울기| + 0.05. */
const STATS = `const pts = c.points, fl = c.fitLine; const resd = (p) => Math.abs(p[1] - (fl.slope * p[0] + fl.intercept)); let oi = 0; pts.forEach((p, i) => { if (resd(p) > resd(pts[oi])) oi = i; }); const rest = pts.filter((_, i) => i !== oi); const sl = (a) => { const n = a.length, mx = a.reduce((s, p) => s + p[0], 0) / n, my = a.reduce((s, p) => s + p[1], 0) / n; let sxy = 0, sxx = 0; for (const p of a) { sxy += (p[0] - mx) * (p[1] - my); sxx += (p[0] - mx) ** 2; } return sxy / sxx; }; const d = sl(rest) - sl(pts); const T = 0.12 * Math.abs(fl.slope) + 0.05; const ox = pts[oi][0]; return { d, T, ox, big: resd(pts[oi]) >= 2 * rest.map(resd).sort((a, b) => b - a)[0] };`;
const pre = `const s = ((c) => { ${STATS} })(c);`;
const INC = { predicateJs: `${pre} return s.big && s.d >= s.T;`, diagnoseJs: `${pre} if (s.big && s.d >= s.T) return null; if (s.d <= -s.T) return s.ox <= 4 ? "decrease_early_outlier" : (s.d <= -2 * s.T ? "decrease_large" : "decrease_small"); return "little_change";` };
const DEC = { predicateJs: `${pre} return s.big && s.d <= -s.T;`, diagnoseJs: `${pre} if (s.big && s.d <= -s.T) return null; if (s.d >= s.T) return s.ox <= 4 ? "increase_early_outlier" : (s.d >= 2 * s.T ? "increase_large" : "increase_small"); return "little_change";` };

const intro = (rng: Rng, z: Base) => rng.pick([
  `Each of the four scatterplots shows ${z.topic.x} and ${z.topic.y} for 10 data points, along with the line of best fit for all 10 points. Each scatterplot has one outlier.`,
  `Four scatterplots of ${z.topic.x} and ${z.topic.y} are shown, each with 10 data points and its line of best fit. In every scatterplot, one point is an outlier.`,
  `The four graphs shown plot ${z.topic.x} against ${z.topic.y} for ten observations each, with the line of best fit through all ten points. Each graph contains a single outlier.`,
  `Four possible scatterplots of ${z.topic.x} and ${z.topic.y} are shown; each has 10 points and a line of best fit computed from all of them, including one outlier.`,
]);
const Q_INC = ["Removing the outlier from which scatterplot would cause the slope of the line of best fit to increase?", "In which scatterplot would the slope of the line of best fit increase if the outlier were removed?", "For which scatterplot would deleting the outlier make the slope of the line of best fit greater?"];
const Q_DEC = ["Removing the outlier from which scatterplot would cause the slope of the line of best fit to decrease?", "In which scatterplot would the slope of the line of best fit decrease if the outlier were removed?", "For which scatterplot would deleting the outlier make the slope of the line of best fit smaller?"];
const TAIL: [string, string] = ["다른 산점도는 이상치를 빼도 기울기가 반대로 변하거나 거의 변하지 않는다.", "Each other scatterplot changes the other way or hardly at all."];
/** 추세선에서 가장 먼 점의 잔차가 나머지 최대 잔차의 2.6 배 이상이어야 사람이 보아도 뚜렷한 이상치(그림 모호성 방지). */
const clearOutlier = (f: unknown): boolean => { const c = f as ScatterFig; const fl = c.fitLine; const r = (p: [number, number]) => Math.abs(p[1] - (fl.slope * p[0] + fl.intercept)); const rs = c.points.map(r).sort((a, b) => b - a); if (rs[0] < 2.6 * rs[1]) return false;
  const oi = c.points.map(r).indexOf(rs[0]); const rest = c.points.filter((_, i) => i !== oi); const sl = (a: [number, number][]) => { const n = a.length, mx = a.reduce((t, p) => t + p[0], 0) / n, my = a.reduce((t, p) => t + p[1], 0) / n; let sxy = 0, sxx = 0; for (const p of a) { sxy += (p[0] - mx) * (p[1] - my); sxx += (p[0] - mx) ** 2; } return sxy / sxx; };
  const d = Math.abs(sl(rest) - sl(c.points)), T = 0.12 * Math.abs(fl.slope) + 0.05; return d >= T || d < 0.5 * T; }; // 기울기 변화가 애매한 구간(0.5T~T)은 사람이 판단하기 어려워 제외
const okFig = (rng: Rng, z: Base, inc: boolean, tries = 200): ScatterFig => { for (let t = 0; t < tries; t++) { const x = rng.pick([8, 9, 10]); const dir = rng.pick([-1, 1]); const y = Math.round(z.b0 + z.m * x + dir * rng.int(3, 5) * z.S); if (y < z.S / 2 || y > 9.5 * z.S) continue; const f = figOf(z, withOut(z, x, y)); const pr = (inc ? INC : DEC).predicateJs; const fn = new Function("c", "i", "P", pr) as (c: unknown, i: number, P: unknown) => boolean; if (fn(f, 0, {}) && clearOutlier(f)) return f; } throw new GenFail("정답 산점도 표집 실패"); };
const mkInst = (rng: Rng, z: Base, inc: boolean, variant: string, trace: [string, string][]) => {
  const ok = okFig(rng, z, inc); const c = inc ? INC : DEC; const ch = poolChoices(rng, { ok, pool: pool(rng, z), P: {}, sameAxis: clearOutlier, ...c });
  return cInst(rng, ch, { stimulus: intro(rng, z), question: rng.pick(inc ? Q_INC : Q_DEC), P: {}, ...c, trace, variant }, TAIL);
};

export const ITEM = defineItem({
  prefix: "tvd", itemId: "two_variable_data.outlier_influence_on_fit.SC.C",
  hard: [
    {
      op: "repr_shift", sprNo: SPR_NO_DATA_CHOICE, structure: "네 산점도 중 이상치를 빼면 기울기가 커지는 것을 고름", extra: "이상치가 추세선을 어느 쪽으로 끄는지 보고 빼면 기울기가 되돌아가는 방향을 판단해야 함 — 이상치 위치·방향이 서로 다른 네 그림을 비교 — medium 은 한 그림",
      concepts: ["산점도", "이상치의 영향", "기울기의 변화"],
      gen(rng) { const z = baseScene(rng); return mkInst(rng, z, true, "outlier_removal_increases_slope", [["각 산점도에서 추세선에서 가장 먼 점(이상치)을 찾는다.", "Find each outlier."], ["이상치가 오른쪽 끝에서 추세선을 끌어 내리면 빼면 기울기가 커진다.", "A low outlier at the right end drags the slope down."], ["이상치가 위에서 끌어 올리면 빼면 기울기가 작아진다.", "A high outlier at the right end drags it up."], ["이상치가 가운데이거나 가까우면 기울기가 거의 변하지 않는다.", "A middle or nearby outlier changes little."], ["빼면 기울기가 커지는 그림은 하나뿐이다.", "Exactly one plot matches."]]); },
    },
    {
      op: "inverse", sprNo: SPR_NO_DATA_CHOICE, structure: "네 산점도 중 이상치를 빼면 기울기가 작아지는 것을 고름", extra: "이상치가 추세선을 위로 끄는 그림을 가려 빼면 기울기가 작아지는 방향을 거꾸로 추론 — 이상치 위치·방향이 서로 다른 네 그림 — medium 은 한 그림",
      concepts: ["산점도", "이상치의 영향", "기울기의 변화"],
      gen(rng) { const z = baseScene(rng); return mkInst(rng, z, false, "outlier_removal_decreases_slope", [["각 산점도에서 이상치를 찾는다.", "Find each outlier."], ["이상치가 오른쪽 끝에서 추세선을 끌어 올리면 빼면 기울기가 작아진다.", "A high outlier at the right end drags the slope up."], ["이상치가 아래에서 끌어 내리면 빼면 기울기가 커진다.", "A low outlier at the right end drags it down."], ["가운데에 있으면 기울기는 거의 변하지 않는다.", "A middle outlier changes little."], ["빼면 기울기가 작아지는 그림은 하나뿐이다.", "Exactly one plot matches."]]); },
    },
    {
      op: "compare_scenarios", sprNo: SPR_NO_DATA_CHOICE, structure: "기울기가 커지는 그림을 이상치가 왼쪽에 있는 그림과 오른쪽 끝에 있는 그림 사이에서 구별해 고름", extra: "이상치가 왼쪽 끝에 있을 때와 오른쪽 끝에 있을 때 같은 방향으로 벗어나도 기울기 변화가 반대임을 이용해야 함 — medium 은 한 그림",
      concepts: ["산점도", "이상치의 영향(위치)", "두 경우 비교"],
      gen(rng) { const z = baseScene(rng); return mkInst(rng, z, true, "outlier_position_changes_direction", [["이상치의 위(아래) 방향과 x 위치를 함께 본다.", "Look at both the side and the position of the outlier."], ["오른쪽 끝에서 아래로 벗어난 이상치는 기울기를 줄이고, 빼면 기울기가 커진다.", "A low right-end outlier lowers the slope."], ["왼쪽 끝에서 아래로 벗어난 이상치는 반대로 기울기를 키운다.", "A low left-end outlier raises the slope."], ["같은 방향이라도 x 위치에 따라 기울기 변화가 반대가 된다.", "Position flips the effect."], ["따라서 조건을 만족하는 그림은 하나뿐이다.", "Exactly one plot matches."]]); },
    },
    {
      op: "param_condition", sprNo: SPR_NO_DATA_CHOICE, structure: "이상치를 빼면 기울기가 작아진다는 조건과 이상치가 추세선에서 뚜렷이 떨어졌다는 조건을 함께 만족하는 그림을 고름", extra: "뚜렷한 이상치 여부와 기울기 변화의 방향을 함께 확인해야 함(이상치가 없는 그림이 함정) — medium 은 한 조건",
      concepts: ["산점도", "이상치", "기울기의 변화"],
      gen(rng) { const z = baseScene(rng); return mkInst(rng, z, false, "clear_outlier_decreasing_slope", [["각 그림에서 추세선에서 뚜렷하게 떨어진 점이 있는지 본다.", "Is there a clear outlier?"], ["이상치를 빼면 기울기가 작아지는 그림을 찾는다.", "Find the plot where removing it lowers the slope."], ["이상치가 위로 끌어 올린 그림이 해당한다.", "A high right-end outlier fits."], ["다른 그림은 기울기가 커지거나 거의 변하지 않는다.", "The others raise or barely change the slope."], ["조건을 만족하는 그림은 하나이다.", "Exactly one plot matches."]]); },
    },
  ],
  em: [
    {
      lv: "easy", name: "increase_simple", sprNo: SPR_NO_DATA_CHOICE, structure: "이상치를 빼면 기울기가 커지는 산점도를 고름", extra: "easy: 한 방향", concepts: ["산점도", "이상치"],
      gen(rng) { const z = baseScene(rng); return mkInst(rng, z, true, "easy_outlier_increase", [["이상치를 찾는다.", "Find the outlier."], ["이상치를 빼면 기울기가 커지는 그림을 찾는다.", "Which plot's slope rises?"]]); },
    },
    {
      lv: "medium", name: "decrease_simple", sprNo: SPR_NO_DATA_CHOICE, structure: "이상치를 빼면 기울기가 작아지는 산점도를 고름", extra: "medium: 방향 판단", concepts: ["산점도", "이상치"],
      gen(rng) { const z = baseScene(rng); return mkInst(rng, z, false, "med_outlier_decrease", [["이상치의 위치와 방향을 본다.", "Look at the outlier."], ["빼면 기울기가 작아지는 그림을 찾는다.", "Find the plot whose slope falls."], ["한 그림만 해당한다.", "Only one fits."]]); },
    },
  ],
});
