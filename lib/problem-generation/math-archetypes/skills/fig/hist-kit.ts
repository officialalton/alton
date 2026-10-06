// 히스토그램(HG) 공용 장면 키트 — 구간 막대(왼쪽 끝 포함·오른쪽 끝 불포함)의 중앙값 구간·상대 누적 도수 등 HG 조합 파일들이 함께 쓴다.
// 구간 도수표 문항(grouped_median_interval.FQ)의 장면·해설·검증 JS 를 그림(data.histogram)용으로 옮긴 것이다. 세로 눈금은 1 칸 간격이라 막대 높이를 정확히 읽을 수 있다.
import type { Rng } from "../../rng";
import { W } from "../d-kit";
export { expand, medianOfList } from "./table-kit";

export type GTopic = { what: string; col: string; unit: string; cnt: string; ent: string; where: string; starts: number[]; w: number };
export const G_TOPICS: GTopic[] = [
  { what: "scores on a final exam", col: "Score", unit: "points", cnt: "Number of students", ent: "students", where: "in a history course", starts: [40, 50], w: 10 },
  { what: "weights of packages", col: "Weight", unit: "pounds", cnt: "Number of packages", ent: "packages", where: "at a shipping center", starts: [0, 5, 10], w: 5 },
  { what: "heights of sunflowers", col: "Height", unit: "inches", cnt: "Number of sunflowers", ent: "sunflowers", where: "in a garden", starts: [20, 30, 40], w: 10 },
  { what: "ages of volunteers", col: "Age", unit: "years", cnt: "Number of volunteers", ent: "volunteers", where: "at an animal shelter", starts: [15, 20, 25], w: 10 },
  { what: "commute times of workers", col: "Commute time", unit: "minutes", cnt: "Number of workers", ent: "workers", where: "at an office", starts: [0, 5, 10], w: 10 },
  { what: "daily high temperatures", col: "High temperature", unit: "degrees", cnt: "Number of days", ent: "days", where: "in one city over a season", starts: [40, 50, 60], w: 5 },
  { what: "lengths of songs", col: "Length", unit: "seconds", cnt: "Number of songs", ent: "songs", where: "on a playlist", starts: [120, 150, 180], w: 30 },
  { what: "amounts spent by customers", col: "Amount spent", unit: "dollars", cnt: "Number of customers", ent: "customers", where: "at a bookstore", starts: [0, 10, 20], w: 10 },
  { what: "distances thrown in a contest", col: "Distance", unit: "feet", cnt: "Number of throws", ent: "throws", where: "at a field day", starts: [30, 40, 50], w: 10 },
  { what: "times to finish a puzzle", col: "Finish time", unit: "minutes", cnt: "Number of contestants", ent: "contestants", where: "at a puzzle event", starts: [10, 15, 20], w: 5 },
  { what: "numbers of pages in novels", col: "Length", unit: "pages", cnt: "Number of novels", ent: "novels", where: "on a library shelf", starts: [100, 150, 200], w: 50 },
  { what: "typing speeds of applicants", col: "Typing speed", unit: "words per minute", cnt: "Number of applicants", ent: "applicants", where: "for an office job", starts: [20, 30, 40], w: 10 },
  { what: "resting heart rates of athletes", col: "Heart rate", unit: "beats per minute", cnt: "Number of athletes", ent: "athletes", where: "on a track team", starts: [40, 50], w: 5 },
  { what: "lengths of phone calls", col: "Call length", unit: "minutes", cnt: "Number of calls", ent: "calls", where: "at a help desk", starts: [0, 4, 8], w: 4 },
  { what: "wingspans of birds", col: "Wingspan", unit: "centimeters", cnt: "Number of birds", ent: "birds", where: "in a field study", starts: [20, 30, 40], w: 10 },
  { what: "monthly rents of apartments", col: "Rent", unit: "hundreds of dollars", cnt: "Number of apartments", ent: "apartments", where: "in a town", starts: [6, 8, 10], w: 2 },
  { what: "numbers of steps walked per day", col: "Steps", unit: "hundreds of steps", cnt: "Number of people", ent: "people", where: "in a fitness study", starts: [20, 40, 60], w: 20 },
  { what: "battery lives of phones", col: "Battery life", unit: "hours", cnt: "Number of phones", ent: "phones", where: "in a product test", starts: [6, 8, 10], w: 4 },
  { what: "weights of apples", col: "Weight", unit: "grams", cnt: "Number of apples", ent: "apples", where: "from an orchard", starts: [100, 120, 140], w: 20 },
  { what: "reaction times of drivers", col: "Reaction time", unit: "hundredths of a second", cnt: "Number of drivers", ent: "drivers", where: "in a safety study", starts: [30, 40, 50], w: 10 },
  { what: "lengths of hiking trips", col: "Trip length", unit: "miles", cnt: "Number of trips", ent: "trips", where: "logged by a hiking club", starts: [0, 3, 6], w: 3 },
  { what: "times spent on homework", col: "Homework time", unit: "minutes", cnt: "Number of students", ent: "students", where: "at a middle school", starts: [0, 15, 30], w: 15 },
];
export type GScene = { t: GTopic; los: number[]; freqs: number[]; N: number; fig: { type: "data"; kind: "histogram"; bins: { from: number; to: number; count: number }[]; xTitle: string; yTitle: string; yMin: number; yMax: number; yStep: number } };
/** 첫 경계값이 세 자리면 엔진이 그리는 첫 가로 눈금 숫자가 세로축 0 과 겹치므로 첫 경계가 두 자리 이하인 주제만 쓴다. */
export const HG_TOPICS = G_TOPICS.filter((t) => Math.min(...t.starts) < 100);
/** 막대 구간 라벨: 히스토그램은 경계가 이어지므로 "60–70"(왼쪽 끝 포함, 오른쪽 끝 불포함)로 쓴다. */
export const label = (t: GTopic, lo: number) => `${lo}–${lo + t.w}`;
export const histFig = (t: GTopic, los: number[], freqs: number[]) => ({ type: "data" as const, kind: "histogram" as const, bins: los.map((lo, i) => ({ from: lo, to: lo + t.w, count: freqs[i] })), xTitle: `${t.col} (${t.unit})`, yTitle: `Frequency (${t.ent})`, yMin: 0, yMax: Math.max(...freqs) + 1, yStep: 1 });
/** 히스토그램: 구간 k(4~6)개, 도수 1~fmax(≤10 — 세로 눈금을 1 칸씩 두어 정확히 읽게 한다). */
export function makeG(rng: Rng, o: { fmax?: number } = {}): GScene {
  const t = rng.pick(HG_TOPICS); const k = rng.int(4, 6); const s0 = rng.pick(t.starts); const los = Array.from({ length: k }, (_, i) => s0 + t.w * i);
  const freqs = los.map(() => rng.int(1, Math.min(10, o.fmax ?? 10))); const N = freqs.reduce((a, b) => a + b, 0);
  return { t, los, freqs, N, fig: histFig(t, los, freqs) };
}
/** 중앙값 구간의 인덱스(가운데 두 위치가 다른 구간이면 null). */
export function medIdx(freqs: number[]): number | null {
  const N = freqs.reduce((a, b) => a + b, 0); const at = (p: number) => { let c = 0; for (let i = 0; i < freqs.length; i++) { c += freqs[i]; if (p <= c) return i; } return -1; };
  if (N % 2) return at((N + 1) / 2); const a = at(N / 2), b = at(N / 2 + 1); return a === b ? a : null;
}
export const cumOf = (f: number[]) => { let c = 0; return f.map((x) => (c += x)); };
/** FIGURE 에서 구간 하한·도수를 읽고 중앙값 구간 함수 mi 를 정의하는 JS(구간 라벨이 등간격이 아니거나 도수가 음수면 던진다). */
export const G_JS = "const bins = FIGURE.bins; if (bins.some((b, i) => i > 0 && Math.abs(b.from - bins[i - 1].to) > 1e-9)) throw new Error('구간이 이어지지 않음'); const los = bins.map(b => b.from); const fr = bins.map(b => b.count); if (fr.some(f => typeof f !== 'number' || f < 0 || !Number.isInteger(f))) throw new Error('도수 오류'); const N = fr.reduce((a, b) => a + b, 0);\nconst mi = (f) => { const n = f.reduce((a, b) => a + b, 0); const at = (p) => { let c = 0; for (let i = 0; i < f.length; i++) { c += f[i]; if (p <= c) return i; } return -1; }; if (n % 2) return at((n + 1) / 2); const a = at(n / 2), b = at(n / 2 + 1); if (a !== b) throw new Error('중앙값 구간 모호'); return a; };\n";
export const intro = (rng: Rng, s: GScene) => rng.pick([
  `The histogram shown gives the ${s.t.what} for ${s.t.ent} ${s.t.where}, grouped into intervals. Each bar includes its left endpoint but not its right endpoint.`,
  `The histogram shown summarizes the ${s.t.what} for a group of ${s.t.ent} ${s.t.where}. Bar heights give the number of ${s.t.ent} in each interval, and a value equal to a bar\'s right endpoint is counted in the interval to its right.`,
  `A study recorded the ${s.t.what} for ${s.t.ent} ${s.t.where}. The grouped results are shown in the histogram, where a value equal to a bar\'s right endpoint is counted in the interval to its right.`,
  `The ${s.t.what} for ${s.t.ent} ${s.t.where} were sorted into intervals, as shown in the histogram. A value on the boundary between two bars is counted in the interval to its right.`,
]);
export const readStep = (s: GScene): [string, string] => [`히스토그램에서 막대의 구간과 높이를 읽는다: ${s.los.map((lo, i) => `${label(s.t, lo)}(${s.freqs[i]})`).join(", ")} — 전체 ${s.N}개.`, "Read each interval and its frequency."];
export const cumStep = (los: number[], f: number[], t: GTopic): [string, string] => { const c = cumOf(f); return [`누적 도수: ${los.map((lo, i) => `${label(t, lo)}→${c[i]}`).join(", ")} 이다.`, "Accumulate the frequencies."]; };
export const posStep = (N: number): [string, string] => [N % 2 ? `전체 ${N} 개이므로 중앙값은 ${(N + 1) / 2} 번째 값이다.` : `전체 ${N} 개이므로 중앙값은 ${N / 2} 번째와 ${N / 2 + 1} 번째 값 사이이다.`, "Locate the middle position."];
export const LOWER = ["What is the lower endpoint of the interval that contains the median", "What is the least value of the interval that contains the median", "The median falls in one of the intervals. What is the lower endpoint of that interval"];
export const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v >= 0);
export const nbr = (s: GScene, i: number, ans: number) => pos([W(s.los[Math.min(i + 1, s.los.length - 1)], "other", "한 구간 위를 골랐다."), W(s.los[Math.max(i - 1, 0)], "other", "한 구간 아래를 골랐다."), W(s.los[i] + s.t.w - 1, "axis_misread", "구간의 상한을 답했다.")]).filter((w) => w.v !== ans);


// ───────── 히스토그램의 '구간 중점 가정' 평균·중앙값 문항용 어댑터(점도표 문항 논리를 그대로 쓴다) ─────────
export type HistMid = { t: { what: string; ent: string; where: string; unit: string; step: number; lo: number; hi: number }; vals: number[]; freqs: number[]; N: number; sum: number; w: number; fig: GScene["fig"] };
/** 구간 너비가 짝수인 주제만 — 중점이 정수가 되어 평균·중앙값이 깔끔하다. 값 = 구간 중점, 도수 = 막대 높이. */
export const HM_TOPICS = HG_TOPICS.filter((t) => t.w % 2 === 0);
export function makeHistMid(rng: Rng, o: { fmax?: number } = {}): HistMid {
  const t = rng.pick(HM_TOPICS); const k = rng.int(4, 6); const s0 = rng.pick(t.starts); const los = Array.from({ length: k }, (_, i) => s0 + t.w * i);
  const freqs = los.map(() => rng.int(1, Math.min(10, o.fmax ?? 10))); const N = freqs.reduce((a, b) => a + b, 0); const vals = los.map((lo) => lo + t.w / 2); const sum = vals.reduce((a, v, i) => a + v * freqs[i], 0);
  return { t: { what: t.what, ent: t.ent, where: t.where, unit: t.unit, step: t.w, lo: vals[0], hi: vals[vals.length - 1] + 2 * t.w }, vals, freqs, N, sum, w: t.w, fig: histFig(t, los, freqs) };
}
/** 점도표 FQ 문항 JS(DP_JS)와 같은 변수 이름: vals(구간 중점)·fr(막대 높이)·N·S·list·med. */
export const HM_JS = "const bins = FIGURE.bins; if (bins.some((b, i) => i > 0 && Math.abs(b.from - bins[i - 1].to) > 1e-9)) throw new Error('구간이 이어지지 않음'); const vals = bins.map(b => (b.from + b.to) / 2), fr = bins.map(b => b.count); if (fr.some(f => f < 0 || !Number.isInteger(f))) throw new Error('도수 오류'); const N = fr.reduce((a, b) => a + b, 0); const S = vals.reduce((a, v, i) => a + v * fr[i], 0); const list = []; vals.forEach((v, i) => { for (let k = 0; k < fr[i]; k++) list.push(v); }); list.sort((p, q) => p - q); const med = list.length % 2 ? list[(list.length - 1) / 2] : (list[list.length / 2 - 1] + list[list.length / 2]) / 2;\n";
export const hmIntro = (rng: Rng, s: HistMid) => rng.pick([
  `The histogram shown gives the ${s.t.what} for ${s.t.ent} ${s.t.where}. Assume that every value in an interval is equal to the midpoint of that interval.`,
  `The histogram shown summarizes the ${s.t.what} for a group of ${s.t.ent} ${s.t.where}. For estimates, treat each value as the midpoint of its interval.`,
  `A survey recorded the ${s.t.what} for ${s.t.ent} ${s.t.where}; the histogram shown gives the results. To estimate, assume each value lies at the midpoint of its interval.`,
  `Researchers grouped the ${s.t.what} of ${s.t.ent} ${s.t.where} into equal-width intervals, as the histogram shown displays. Use the midpoint of each interval as the value for every member of that interval.`,
  `In the histogram shown, bar heights count ${s.t.ent} ${s.t.where} by ${s.t.what}. When a calculation needs one number per interval, use the interval's midpoint.`,
  `The ${s.t.what} for ${s.t.ent} ${s.t.where} are summarized in the histogram shown. Estimate with the midpoint of each interval standing for all the values in it.`,
]);
export const hmRead = (s: HistMid): [string, string] => [`히스토그램에서 막대의 구간과 높이를 읽고 중점을 값으로 본다: ${s.vals.map((v, i) => `${v}(${s.freqs[i]})`).join(", ")} — 전체 ${s.N}개.`, "Read each bar, and use its midpoint as the value."];
