// 통계 추론 막대그래프(BR) 공용 장면 — 설문 응답 막대(Yes·No·Unsure)와 표본 크기 막대(Survey A·B·C).
// 막대 높이는 세로 눈금 간격의 배수. 모집단 크기·표본 정보 중 지문에 4자리 숫자가 되는 값은 그래프 제목에 둔다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { SURVEYS, type Surv } from "./_t7-kit";

export { SURVEYS, type Surv };
export type RespScene = { s: Surv; yStep: number; a: number; d: number; u: number; n: number; N: number; fig: { type: "data"; kind: "bar"; title: string; categories: string[]; series: { values: number[] }[]; xTitle: string; yTitle: string; yMin: number; yMax: number; yStep: number } };
export const RESP = ["Yes", "No", "Unsure"];
export function respFig(s: Surv, yStep: number, vals: number[], N: number): RespScene["fig"] {
  return { type: "data", kind: "bar", title: `Population: ${N.toLocaleString("en-US")} ${s.ent}`, categories: RESP, series: [{ values: vals }], xTitle: "Answer to the survey question", yTitle: `Responses (${s.ent})`, yMin: 0, yMax: (Math.max(...vals) / yStep + 1) * yStep, yStep };
}
/** N: 모집단(100 의 배수, 표본 크기의 5 배 이상). 추정치 N·a/n 이 정수. */
export function respScene(rng: Rng, o: { needInt?: ("a" | "d")[]; maxEst?: number } = {}): RespScene {
  for (let t = 0; t < 400; t++) {
    const s = rng.pick(SURVEYS); const yStep = rng.pick([5, 10, 20, 25]); const ka = rng.int(2, 10), kd = rng.int(2, 10), ku = rng.int(1, 3); if (ka === kd) continue;
    const a = ka * yStep, d = kd * yStep, u = ku * yStep, n = a + d + u; const N = rng.int(12, 96) * 100; if (n * 5 > N) continue;
    if ((N * a) % n !== 0 || ((N * d) % n !== 0 && (o.needInt ?? []).includes("d"))) continue;
    if (o.maxEst && (N * a) / n > o.maxEst) continue;
    return { s, yStep, a, d, u, n, N, fig: respFig(s, yStep, [a, d, u], N) };
  }
  throw new GenFail("설문 응답 장면 표집 실패");
}
export const RESP_JS = "const nm=FIGURE.categories, v=FIGURE.series[0].values; if (v.some(x=>typeof x!=='number'||x<=0)) throw new Error('값 오류'); const mt=/Population: ([\\d,]+)/.exec(FIGURE.title||''); if (!mt) throw new Error('모집단 크기 없음'); const N=Number(mt[1].replace(/,/g,'')); const g=(k)=>{const i=nm.indexOf(k); if (i<0) throw new Error('막대 없음'); return v[i];}; const n=v.reduce((x,y)=>x+y,0); const a=g('Yes'), d=g('No'), u=g('Unsure');\n";
export const respIntro = (rng: Rng, s: Surv) => rng.pick([
  `A survey asked a random sample of ${s.ent} whether they ${s.ev}. The graph shows the responses, and the graph title gives the total number of ${s.ent} in the whole population.`,
  `To learn about ${s.topic}, researchers selected ${s.ent} at random and asked whether they ${s.ev}. The responses are shown in the graph, whose title gives the size of the whole population.`,
  `The graph shown summarizes a survey about ${s.topic}. The ${s.ent} in the sample were chosen at random, and the title of the graph gives the number of ${s.ent} in the population they came from.`,
  `A random sample of ${s.ent} took part in a survey on ${s.topic}. The graph and its title describe the sample responses and the size of the population.`,
]);
export const respRead = (r: RespScene): [string, string] => [`막대그래프에서 읽는다: Yes ${r.a}, No ${r.d}, Unsure ${r.u} — 표본 ${r.n}, 모집단 ${r.N}.`, "Read the responses and the population size."];

// ── 표본 크기 막대(Survey A·B·C): 표본 크기가 단위 u 의 제곱수 배 ──
export type SizeScene = { s: Surv; u: number; yStep: number; ratios: number[]; names: string[]; vals: number[]; fig: { type: "data"; kind: "bar"; categories: string[]; series: { values: number[] }[]; xTitle: string; yTitle: string; yMin: number; yMax: number; yStep: number } };
export function sizeScene(rng: Rng, ratios: number[]): SizeScene {
  const s = rng.pick(SURVEYS); const u = rng.pick([50, 100, 200, 250]); const names = ["Survey A", "Survey B", "Survey C"].slice(0, ratios.length); const order = rng.shuffle([...ratios.keys()]);
  const rs = order.map((i) => ratios[i]); const vals = rs.map((r) => r * u); const yStep = u; const yMax = (Math.max(...rs) + 1) * u;
  return { s, u, yStep, ratios: rs, names, vals, fig: { type: "data", kind: "bar", categories: names, series: [{ values: vals }], xTitle: "Survey", yTitle: `Sample size (${s.ent})`, yMin: 0, yMax, yStep } };
}
export const SIZE_JS = "const nm=FIGURE.categories, v=FIGURE.series[0].values; if (v.some(x=>typeof x!=='number'||x<=0)||v.length!==nm.length) throw new Error('값 오류'); const g=(k)=>{const i=nm.indexOf(k); if (i<0) throw new Error('막대 없음'); return v[i];}; const mn=Math.min(...v), mx=Math.max(...v);\n";
