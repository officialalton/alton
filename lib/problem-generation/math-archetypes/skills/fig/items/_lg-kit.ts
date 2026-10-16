// 선그래프(LG) 공용 장면 — 연도별 값(눈금 간격의 배수)을 한 계열 선그래프로 그린다. 지문은 연도 이름 대신 '첫 해·마지막 해' 같은 서수로 가리킨다(자료 값 참조 lint 회피).
import type { Rng } from "../../../rng";
import { GenFail } from "../../../types";
import { BAR_TOPICS } from "../data-kit";
import { lcFirst, type CountTopic } from "./_t4-kit";

export const LG_TOPICS = BAR_TOPICS;
export type LgFig = { type: "data"; kind: "line"; categories: string[]; series: { name?: string; values: number[] }[]; xTitle: string; yTitle: string; yMin: number; yMax: number; yStep: number };
export type LgScene = { t: CountTopic; name: string; years: string[]; vals: number[]; yStep: number; fig: LgFig };
export const lgFig = (t: CountTopic, years: string[], vals: number[], yStep: number): LgFig => ({ type: "data", kind: "line", categories: years, series: [{ values: vals }], xTitle: "Time (years)", yTitle: `${t.col} (${t.unit})`, yMin: 0, yMax: (Math.max(...vals) / yStep + 1) * yStep, yStep });
/** 값은 눈금 간격의 k 배(k 2~10), 이웃한 값은 서로 다르다. */
export function lgScene(rng: Rng, nLo = 4, nHi = 6): LgScene {
  const t = rng.pick(LG_TOPICS); const name = rng.pick(t.rows); const n = rng.int(nLo, nHi); const y0 = rng.int(2012, 2020); const years = Array.from({ length: n }, (_, i) => String(y0 + i)); const yStep = rng.pick([10, 20, 25, 50]);
  for (let tr = 0; tr < 60; tr++) { const ks = Array.from({ length: n }, () => rng.int(2, 10)); if (ks.some((k, i) => i > 0 && k === ks[i - 1])) continue; const vals = ks.map((k) => k * yStep); return { t, name, years, vals, yStep, fig: lgFig(t, years, vals, yStep) }; }
  throw new GenFail("선그래프 장면 표집 실패");
}
export const lgIntro = (rng: Rng, z: LgScene) => rng.pick([
  `The graph shows the number of ${z.t.what} ${z.t.prep} ${z.name} for each of ${z.years.length} consecutive years.`,
  `${z.t.who} recorded the number of ${z.t.what} ${z.t.prep} ${z.name} each year. The results are shown in the line graph.`,
  `The line graph shown gives the yearly number of ${z.t.what} ${z.t.prep} ${z.name}.`,
  `For a report, ${lcFirst(z.t.who)} charted how many ${z.t.what} there were ${z.t.prep} ${z.name} in each of several years, as shown in the graph.`,
]);
export const LG_JS = "const v=FIGURE.series[0].values; if (v.length<2||v.some(x=>typeof x!=='number'||x<=0)) throw new Error('값 오류');\n";
