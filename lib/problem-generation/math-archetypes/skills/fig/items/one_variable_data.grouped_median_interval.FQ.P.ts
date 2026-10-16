// one_variable_data.grouped_median_interval.FQ.P — 구간 도수표(예: "60–69" × 도수)에서 중앙값이 속한 구간을 누적 도수로 찾는다.
// 정답은 구간의 하한(수)으로 낸다(SPR 가능). 구간 도수표 장면은 키트에 없어 이 파일 안에서 만든다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";

type GTopic = { what: string; col: string; unit: string; cnt: string; ent: string; where: string; starts: number[]; w: number };
const G_TOPICS: GTopic[] = [
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
type GScene = { t: GTopic; los: number[]; freqs: number[]; N: number; fig: { type: "data"; kind: "table"; columns: string[]; rows: (string | number)[][] } };
const label = (t: GTopic, lo: number) => `${lo}–${lo + t.w - 1}`;
function makeG(rng: Rng, o: { fmax?: number } = {}): GScene {
  const t = rng.pick(G_TOPICS); const k = rng.int(4, 6); const s0 = rng.pick(t.starts); const los = Array.from({ length: k }, (_, i) => s0 + t.w * i);
  const freqs = los.map(() => rng.int(1, o.fmax ?? 12)); const N = freqs.reduce((a, b) => a + b, 0);
  return { t, los, freqs, N, fig: { type: "data", kind: "table", columns: [`${t.col} (${t.unit})`, t.cnt], rows: los.map((lo, i) => [label(t, lo), freqs[i]]) } };
}
/** 중앙값 구간의 인덱스(가운데 두 위치가 다른 구간이면 null). */
function medIdx(freqs: number[]): number | null {
  const N = freqs.reduce((a, b) => a + b, 0); const at = (p: number) => { let c = 0; for (let i = 0; i < freqs.length; i++) { c += freqs[i]; if (p <= c) return i; } return -1; };
  if (N % 2) return at((N + 1) / 2); const a = at(N / 2), b = at(N / 2 + 1); return a === b ? a : null;
}
const cumOf = (f: number[]) => { let c = 0; return f.map((x) => (c += x)); };
/** FIGURE 에서 구간 하한·도수를 읽고 중앙값 구간 함수 mi 를 정의하는 JS(구간 라벨이 등간격이 아니거나 도수가 음수면 던진다). */
const G_JS = "const los = FIGURE.rows.map(r => { const m = /^(\\d+)\\D+(\\d+)$/.exec(String(r[0])); if (!m) throw new Error('구간 라벨 오류'); return Number(m[1]); }); const fr = FIGURE.rows.map(r => r[1]); if (fr.some(f => typeof f !== 'number' || f < 0 || !Number.isInteger(f))) throw new Error('도수 오류'); const N = fr.reduce((a, b) => a + b, 0);\nconst mi = (f) => { const n = f.reduce((a, b) => a + b, 0); const at = (p) => { let c = 0; for (let i = 0; i < f.length; i++) { c += f[i]; if (p <= c) return i; } return -1; }; if (n % 2) return at((n + 1) / 2); const a = at(n / 2), b = at(n / 2 + 1); if (a !== b) throw new Error('중앙값 구간 모호'); return a; };\n";
const intro = (rng: Rng, s: GScene) => rng.pick([
  `The frequency table shows the ${s.t.what} for ${s.t.ent} ${s.t.where}, grouped into intervals.`,
  `The table shown summarizes the ${s.t.what} for a group of ${s.t.ent} ${s.t.where}. Each row gives an interval and how many ${s.t.ent} fall in it.`,
  `A study recorded the ${s.t.what} for ${s.t.ent} ${s.t.where}. The grouped results are shown in the table.`,
  `The ${s.t.what} for ${s.t.ent} ${s.t.where} were sorted into intervals, as shown in the table.`,
]);
const readStep = (s: GScene): [string, string] => [`표에서 구간과 도수를 읽는다: ${s.los.map((lo, i) => `${label(s.t, lo)}(${s.freqs[i]})`).join(", ")} — 전체 ${s.N}개.`, "Read each interval and its frequency."];
const cumStep = (los: number[], f: number[], t: GTopic): [string, string] => { const c = cumOf(f); return [`누적 도수: ${los.map((lo, i) => `${label(t, lo)}→${c[i]}`).join(", ")} 이다.`, "Accumulate the frequencies."]; };
const posStep = (N: number): [string, string] => [N % 2 ? `전체 ${N} 개이므로 중앙값은 ${(N + 1) / 2} 번째 값이다.` : `전체 ${N} 개이므로 중앙값은 ${N / 2} 번째와 ${N / 2 + 1} 번째 값 사이이다.`, "Locate the middle position."];
const LOWER = ["What is the lower endpoint of the interval that contains the median", "What is the least value of the interval that contains the median", "The median falls in one of the intervals. What is the lower endpoint of that interval"];
const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v >= 0);
const nbr = (s: GScene, i: number, ans: number) => pos([W(s.los[Math.min(i + 1, s.los.length - 1)], "other", "한 구간 위를 골랐다."), W(s.los[Math.max(i - 1, 0)], "other", "한 구간 아래를 골랐다."), W(s.los[i] + s.t.w - 1, "axis_misread", "구간의 상한을 답했다.")]).filter((w) => w.v !== ans);

export const ITEM = defineItem({
  prefix: "ovd", itemId: "one_variable_data.grouped_median_interval.FQ.P",
  hard: [
    {
      op: "chain2", structure: "가장 높은 구간에 k 개가 더해진 뒤, 새 자료의 중앙값 구간 하한을 누적 도수로 구함", extra: "자료 추가 → 새 전체 개수 → 새 중앙값 위치 → 구간 찾기의 연쇄 — medium 은 원래 자료의 중앙값 구간",
      concepts: ["구간 도수표", "중앙값", "누적 도수"],
      gen(rng) {
        for (let t = 0; t < 80; t++) {
          const s = makeG(rng); const k = rng.int(2, 12); const f2 = [...s.freqs]; f2[f2.length - 1] += k; const i0 = medIdx(s.freqs), i1 = medIdx(f2); if (i0 === null || i1 === null || i0 === i1) continue;
          const ans = s.los[i1];
          return figInst(rng, {
            stimulus: `${intro(rng, s)} ${rng.pick(["Later,", "Afterward,", "In a follow-up,"])} ${k} more ${s.t.ent} are added, and all of them fall in the highest interval in the table.`,
            question: `${rng.pick(LOWER)} for the new data?`, correct: ans,
            wrongs: [W(s.los[i0], "step_missing", "추가 전 중앙값 구간을 답했다."), ...nbr(s, i1, ans), W(s.los[s.los.length - 1], "axis_misread", "추가된 구간을 답했다.")].filter((w) => w.v !== ans),
            verificationJs: figJs({ k }, s.fig, `${G_JS}const f2 = [...fr]; f2[f2.length - 1] += P.k; return los[mi(f2)];`),
            trace: [readStep(s), [`가장 높은 구간의 도수가 ${s.freqs[s.freqs.length - 1]} 에서 ${f2[f2.length - 1]} 로 늘어난다.`, "Increase the top frequency."], [`새 전체 개수 = ${s.N} + ${k} = ${s.N + k} 이다.`, "New total."], posStep(s.N + k), cumStep(s.los, f2, s.t), [`중앙값은 ${label(s.t, ans)} 구간에 있으므로 하한은 ${ans} 이다.`, "Read the interval containing the median."]], variant: "median_interval_after_adding_top",
          }, s.fig);
        }
        throw new GenFail("chain");
      },
    },
    {
      op: "param_condition", structure: "가장 낮은 구간에 개체를 더할 때 중앙값이 하한 L 보다 작은 구간으로 내려가는 최소 개수를 구함", extra: "추가 개수에 따라 중앙값 위치가 움직이는 조건을 누적 도수로 따져 최소 개수를 찾음 — medium 은 중앙값 구간 하나",
      concepts: ["구간 도수표", "중앙값", "조건을 만족하는 최소 개수"],
      gen(rng) {
        for (let t = 0; t < 80; t++) {
          const s = makeG(rng); const i0 = medIdx(s.freqs); if (i0 === null || i0 === 0) continue; const L = s.los[i0];
          let k = 0; for (k = 1; k <= 200; k++) { const f = [...s.freqs]; f[0] += k; const i = medIdx(f); if (i !== null && i < i0) break; } if (k > 200 || k < 2) continue;
          // 중간 k 에서 모호(null)였다가 정해지는 경우도 '처음으로 확실히 내려간' k 로 본다.
          return figInst(rng, {
            stimulus: `${intro(rng, s)} ${rng.pick(["Some new", "Additional", "More"])} ${s.t.ent} are added, and every one of them falls in the lowest interval in the table.`,
            question: rng.pick([`What is the least number of ${s.t.ent} that must be added so that the median of the data is less than ${L}?`, `At least how many ${s.t.ent} must be added for the median of the data to fall below ${L}?`]), correct: k,
            wrongs: pos([W(k - 1, "condition_ignored", "경계를 놓쳤다."), W(k + 1, "other", "하나 더 더했다."), W(2 * k, "formula_misuse", "가운데를 두 배로 옮겨야 한다고 보았다."), W(cumOf(s.freqs)[i0], "axis_misread", "누적 도수를 답했다."), W(s.freqs[i0], "axis_misread", "중앙값 구간의 도수를 답했다.")]).filter((w) => w.v !== k),
            verificationJs: figJs({ L }, s.fig, `${G_JS}const i0 = los.indexOf(P.L); if (i0 < 0) throw new Error('하한 없음'); if (mi(fr) !== i0) throw new Error('현재 중앙값 구간이 아님'); const safe = (f) => { try { return mi(f); } catch { return null; } }; for (let k = 1; k <= 200; k++) { const f = [...fr]; f[0] += k; const i = safe(f); if (i !== null && i < i0) return k; } throw new Error('없음');`),
            trace: [readStep(s), posStep(s.N), cumStep(s.los, s.freqs, s.t), [`현재 중앙값은 ${label(s.t, L)} 구간에 있다.`, "Find the current median interval."], [`가장 낮은 구간에 더할수록 중앙값 위치가 낮은 쪽으로 옮겨진다.`, "Adding low values pulls the median down."], [`하나씩 더해 보면 ${k} 개를 더했을 때 처음으로 중앙값이 ${L} 보다 작은 구간으로 내려간다.`, "Find the least count that works."]], variant: "least_added_to_drop_median",
          }, s.fig);
        }
        throw new GenFail("param");
      },
    },
    {
      op: "constraint_select", structure: "중앙값 구간을 찾은 뒤, 그 구간의 하한보다 작은 값을 가진 개체 수(아래 구간 도수 합)를 셈", extra: "중앙값 구간 → 그 아래 구간만 골라 도수 합의 연쇄 조건 선택 — medium 은 중앙값 구간까지",
      concepts: ["구간 도수표", "중앙값", "누적 도수"],
      gen(rng) {
        const s = makeG(rng); const i0 = medIdx(s.freqs); if (i0 === null || i0 === 0) throw new GenFail("idx"); const c = cumOf(s.freqs); const ans = c[i0 - 1];
        return figInst(rng, {
          stimulus: intro(rng, s),
          question: rng.pick([`How many ${s.t.ent} have a value less than the lower endpoint of the interval that contains the median?`, `How many ${s.t.ent} fall in intervals entirely below the interval that contains the median?`]), correct: ans,
          wrongs: pos([W(c[i0], "condition_ignored", "중앙값 구간까지 포함했다."), W(s.N - c[i0], "opposite", "위쪽 구간을 셌다."), W(s.freqs[i0], "axis_misread", "중앙값 구간의 도수를 답했다."), W(Math.floor(s.N / 2), "formula_misuse", "항상 절반이라고 보았다."), W(i0, "axis_misread", "구간의 개수를 셌다.")]).filter((w) => w.v !== ans),
          verificationJs: figJs({}, s.fig, `${G_JS}const i0 = mi(fr); if (i0 === 0) throw new Error('첫 구간'); return fr.slice(0, i0).reduce((a, b) => a + b, 0);`),
          trace: [readStep(s), posStep(s.N), cumStep(s.los, s.freqs, s.t), [`중앙값은 ${label(s.t, s.los[i0])} 구간에 있다.`, "Find the median interval."], [`그 아래 구간들의 도수 합 = ${ans} 이다.`, "Add the frequencies below it."]], variant: "count_below_median_interval",
        }, s.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "중앙값이 속한 구간과 도수가 가장 큰 구간(최빈 구간)의 하한 차를 구함", extra: "중앙값 구간(누적 도수)과 최빈 구간(도수 비교)이라는 두 기준을 함께 비교 — medium 은 중앙값 구간 하나",
      concepts: ["구간 도수표", "중앙값", "최빈 구간"],
      gen(rng) {
        const s = makeG(rng); const i0 = medIdx(s.freqs); const mx = Math.max(...s.freqs); if (i0 === null || s.freqs.filter((f) => f === mx).length > 1) throw new GenFail("idx"); const j = s.freqs.indexOf(mx); if (j === i0) throw new GenFail("same");
        const ans = Math.abs(s.los[i0] - s.los[j]);
        return figInst(rng, {
          stimulus: intro(rng, s),
          question: rng.pick(["What is the positive difference between the lower endpoint of the interval that contains the median and the lower endpoint of the interval with the greatest frequency?", "How far apart are the lower endpoints of the interval containing the median and the interval with the most data values?"]), correct: ans,
          wrongs: pos([W(s.los[i0], "step_missing", "중앙값 구간 하한만 답했다."), W(s.los[j], "step_missing", "최빈 구간 하한만 답했다."), W(ans + s.t.w, "other", "한 구간 더 떨어졌다고 보았다."), W(Math.abs(i0 - j), "axis_misread", "구간 칸 수를 답했다."), W(Math.abs(s.freqs[i0] - mx), "axis_misread", "도수의 차를 구했다.")]).filter((w) => w.v !== ans && w.v !== 0),
          verificationJs: figJs({}, s.fig, `${G_JS}const mx = Math.max(...fr); if (fr.filter(f => f === mx).length > 1) throw new Error('최빈 구간 둘 이상'); return Math.abs(los[mi(fr)] - los[fr.indexOf(mx)]);`),
          trace: [readStep(s), posStep(s.N), cumStep(s.los, s.freqs, s.t), [`중앙값 구간은 ${label(s.t, s.los[i0])} 이다.`, "Median interval."], [`도수가 가장 큰(${mx}) 구간은 ${label(s.t, s.los[j])} 이다.`, "Modal interval."], [`하한의 차 = |${s.los[i0]} - ${s.los[j]}| = ${ans} 이다.`, "Take the positive difference."]], variant: "median_vs_modal_interval",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "total_count", structure: "구간 도수표의 도수를 모두 더해 전체 개수를 구함", extra: "easy: 도수 합", concepts: ["구간 도수표", "전체 개수"],
      gen(rng) {
        const s = makeG(rng);
        return figInst(rng, { stimulus: intro(rng, s), question: rng.pick([`How many ${s.t.ent} are represented in the table?`, `What is the total number of ${s.t.ent} in the data?`]), correct: s.N, wrongs: [W(s.los.length, "axis_misread", "구간 수를 셌다."), W(Math.max(...s.freqs), "step_missing", "가장 큰 도수만 읽었다."), W(s.N - s.freqs[0], "step_missing", "첫 행을 빠뜨렸다."), W(s.N + 1, "other", "1 어긋났다."), W(s.N - 1, "other", "1 어긋났다.")], verificationJs: figJs({}, s.fig, `${G_JS}return N;`), trace: [readStep(s), [`전체 = ${s.freqs.join(" + ")} = ${s.N} 이다.`, "Add the frequencies."]], variant: "grouped_total" }, s.fig);
      },
    },
    {
      lv: "medium", name: "median_interval", structure: "누적 도수로 중앙값이 속한 구간을 찾아 하한을 답함", extra: "medium: 중앙값 위치 → 누적 도수 → 구간", concepts: ["구간 도수표", "중앙값"],
      gen(rng) {
        const s = makeG(rng); const i0 = medIdx(s.freqs); if (i0 === null) throw new GenFail("amb"); const ans = s.los[i0]; const mx = Math.max(...s.freqs);
        return figInst(rng, { stimulus: intro(rng, s), question: `${rng.pick(LOWER)}?`, correct: ans, wrongs: [...nbr(s, i0, ans), W(s.los[s.freqs.indexOf(mx)], "formula_misuse", "도수가 가장 큰 구간을 골랐다."), W(s.los[Math.floor((s.los.length - 1) / 2)], "axis_misread", "가운데 행의 구간을 골랐다.")].filter((w) => w.v !== ans), verificationJs: figJs({}, s.fig, `${G_JS}return los[mi(fr)];`), trace: [readStep(s), posStep(s.N), cumStep(s.los, s.freqs, s.t), [`중앙값은 ${label(s.t, ans)} 구간에 있으므로 하한은 ${ans} 이다.`, "Read the interval."]], variant: "median_interval_lower" }, s.fig);
      },
    },
  ],
});
