// probability.spinner_expected_value.TB.P — 같은 크기 칸으로 나뉜 회전판의 값·칸 수 표에서 기댓값(Σ값×칸 수 ÷ 전체 칸 수). 비용·횟수, 칸 바꾸기 비교, 칸 추가 역산, 목표 합계의 최소 횟수로 확장한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum, frac, spin } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";

type SpTopic = { game: string; col: string; unit: string; lo: number; hi: number; step: number };
const SP_TOPICS: SpTopic[] = [
  { game: "a carnival game", col: "Points", unit: "points", lo: 1, hi: 10, step: 1 },
  { game: "a school fair game", col: "Tickets won", unit: "tickets", lo: 1, hi: 12, step: 1 },
  { game: "an arcade game", col: "Tokens won", unit: "tokens", lo: 2, hi: 20, step: 2 },
  { game: "a board game", col: "Spaces moved", unit: "spaces", lo: 1, hi: 8, step: 1 },
  { game: "a classroom review game", col: "Points earned", unit: "points", lo: 5, hi: 50, step: 5 },
  { game: "a game show", col: "Prize", unit: "dollars", lo: 10, hi: 100, step: 10 },
  { game: "a store promotion", col: "Discount", unit: "dollars", lo: 1, hi: 10, step: 1 },
  { game: "a festival booth", col: "Coupons won", unit: "coupons", lo: 1, hi: 9, step: 1 },
  { game: "a library reading challenge", col: "Bonus minutes", unit: "minutes", lo: 5, hi: 30, step: 5 },
  { game: "a video game", col: "Coins collected", unit: "coins", lo: 10, hi: 90, step: 10 },
  { game: "a fitness app challenge", col: "Push-ups assigned", unit: "push-ups", lo: 5, hi: 25, step: 5 },
  { game: "a charity fundraiser", col: "Donation matched", unit: "dollars", lo: 5, hi: 40, step: 5 },
  { game: "a math club game", col: "Stars earned", unit: "stars", lo: 1, hi: 9, step: 1 },
  { game: "a summer camp activity", col: "Beads won", unit: "beads", lo: 2, hi: 16, step: 2 },
  { game: "a trivia night", col: "Bonus points", unit: "points", lo: 2, hi: 20, step: 2 },
  { game: "a coffee shop promotion", col: "Reward points", unit: "points", lo: 10, hi: 60, step: 10 },
  { game: "a museum scavenger hunt", col: "Stickers won", unit: "stickers", lo: 1, hi: 8, step: 1 },
  { game: "a bowling alley game", col: "Free games", unit: "games", lo: 1, hi: 5, step: 1 },
  { game: "a gym class warm-up", col: "Laps to run", unit: "laps", lo: 1, hi: 6, step: 1 },
  { game: "a radio station contest", col: "Prize", unit: "dollars", lo: 20, hi: 200, step: 20 },
  { game: "a toy store event", col: "Marbles won", unit: "marbles", lo: 3, hi: 15, step: 3 },
  { game: "a science fair booth", col: "Raffle entries", unit: "entries", lo: 1, hi: 7, step: 1 },
];
type SpScene = { t: SpTopic; vals: number[]; cs: number[]; N: number; S: number; fig: { type: "data"; kind: "table"; columns: string[]; rows: number[][] } };
/** 값 3~5종(서로 다름, 오름차순)·칸 수 1~5. 기댓값이 소수 첫째 자리 이내가 되도록 고른다(opt.int 면 정수). */
function makeSp(rng: Rng, o: { int?: boolean } = {}): SpScene {
  for (let tr = 0; tr < 200; tr++) {
    const t = rng.pick(SP_TOPICS); const span = Math.floor((t.hi - t.lo) / t.step) + 1; const k = Math.min(rng.int(3, 5), span);
    const vals = rng.shuffle(Array.from({ length: span }, (_, i) => t.lo + t.step * i)).slice(0, k).sort((a, b) => a - b);
    const cs = vals.map(() => rng.int(1, 5)); const N = cs.reduce((a, b) => a + b, 0); const S = vals.reduce((a, v, i) => a + v * cs[i], 0);
    if ((o.int ? S % N : (10 * S) % N) !== 0) continue;
    return { t, vals, cs, N, S, fig: { type: "data", kind: "table", columns: [`${t.col} (${t.unit})`, "Number of sections"], rows: vals.map((v, i) => [v, cs[i]]) } };
  }
  throw new GenFail("회전판 장면 표집 실패");
}
const SP_JS = "const vals=FIGURE.rows.map(r=>r[0]), cs=FIGURE.rows.map(r=>r[1]); if (cs.some(c=>!Number.isInteger(c)||c<1)) throw new Error('칸 수 오류'); const N=cs.reduce((a,b)=>a+b,0); const S=vals.reduce((a,v,i)=>a+v*cs[i],0); const E=S/N;\n";
const intro = (rng: Rng, s: SpScene) => spin(rng, `[[In ${s.t.game}, a player spins a spinner that is divided into equal sections.|${s.t.game.charAt(0).toUpperCase() + s.t.game.slice(1)} uses a spinner with sections of equal size.|A spinner used in ${s.t.game} has sections that are all the same size.|For ${s.t.game}, an organizer built a wheel split into congruent sections, and each spin is equally likely to stop on any section.|Players in ${s.t.game} take turns with a fair spinner whose sections are equal in size.]] [[Each section is labeled with an amount, and the table shows how many sections have each amount.|The table shown gives each amount on the spinner and the number of sections labeled with it.|The amounts on the sections, and how many sections show each amount, are listed in the table.|How many sections carry each amount is recorded in the table shown.]]`);
const read = (s: SpScene): [string, string] => [`표에서 읽는다: ${s.vals.map((v, i) => `${v}(${s.cs[i]}칸)`).join(", ")}.`, "Read each amount and its number of sections."];
const nStep = (s: SpScene): [string, string] => [`전체 칸 수 = ${s.cs.join(" + ")} = ${s.N} 이다.`, "Total number of sections."];
const eStep = (s: SpScene): [string, string] => [`기댓값 = (${s.vals.map((v, i) => `${v}×${s.cs[i]}`).join(" + ")}) ÷ ${s.N} = ${s.S} ÷ ${s.N} = ${fmtNum(s.S / s.N)} 이다.`, "Expected value = sum of amount × probability."];
const plain = (s: SpScene) => s.vals.reduce((a, b) => a + b, 0) / s.vals.length;
const ok1 = (v: number) => Math.abs(v * 10 - Math.round(v * 10)) < 1e-9;

export const ITEM = defineItem({
  prefix: "pr", itemId: "probability.spinner_expected_value.TB.P",
  hard: [
    {
      op: "chain2", structure: "표에서 한 번 돌릴 때의 기댓값을 구하고, 한 번에 드는 비용 c 를 빼 n 번 돌릴 때의 기대 순이익을 구함", extra: "기댓값(가중 평균) → 순이익(빼기) → n 배의 연쇄 — medium 은 기댓값까지",
      concepts: ["기댓값", "확률 분포 표", "기대 순이익"],
      gen(rng) {
        for (let tr = 0; tr < 40; tr++) {
          const s = makeSp(rng); const E = s.S / s.N; const c = Math.floor(E) - rng.int(1, Math.max(1, Math.min(5, Math.floor(E / 3)))); if (c < 1) continue; const n = rng.int(3, 12);
          const ans = n * (E - c); if (!ok1(ans) || ans > 999) continue;
          return figInst(rng, {
            stimulus: `${intro(rng, s)} ${spin(rng, `[[Each spin costs ${c} ${s.t.unit}, and the player receives the amount on the section where the spinner stops.|A player must give up ${c} ${s.t.unit} for each spin and then receives the amount shown where the spinner lands.]]`)}`,
            question: spin(rng, `[[If the player spins ${n} times, what is the expected net gain, in ${s.t.unit}?|What is the expected net gain, in ${s.t.unit}, for ${n} spins?]]`), correct: ans, fmt: fmtNum,
            wrongs: [W(n * E, "step_missing", "비용을 빼지 않았다."), W(E - c, "step_missing", "한 번의 순이익만 구했다."), W(n * (plain(s) - c), "formula_misuse", "칸 수를 무시하고 값만 평균 냈다."), W(n * E - c, "formula_misuse", "비용을 한 번만 뺐다."), W(n * (E + c), "sign_error", "비용을 더했다.")].filter((w) => ok1(w.v) && w.v > 0),
            verificationJs: figJs({ c, n }, s.fig, `${SP_JS}return P.n * (E - P.c);`),
            trace: [read(s), nStep(s), eStep(s), [`한 번의 기대 순이익 = ${fmtNum(E)} - ${c} = ${fmtNum(E - c)} 이다.`, "Subtract the cost of one spin."], [`${n} 번이면 ${n} × ${fmtNum(E - c)} = ${fmtNum(ans)} 이다.`, "Multiply by the number of spins."]], variant: "net_gain_n_spins",
          }, s.fig);
        }
        throw new GenFail("chain2");
      },
    },
    {
      op: "compare_scenarios", structure: "가장 작은 값의 칸을 모두 가장 큰 값으로 바꾸는 경우와 원래 회전판의 기댓값 차를 구함", extra: "두 회전판(원래·바꾼 뒤)의 기댓값을 각각 구해 비교해야 함 — medium 은 기댓값 하나",
      concepts: ["기댓값", "확률 분포 표", "두 상황 비교"],
      gen(rng) {
        const s = makeSp(rng); const lo = s.vals[0], hi = s.vals[s.vals.length - 1], cl = s.cs[0]; const d = (cl * (hi - lo)) / s.N; if (!ok1(d)) throw new GenFail("dec");
        const E = s.S / s.N;
        return figInst(rng, {
          stimulus: `${intro(rng, s)} ${spin(rng, "[[The owner plans a new spinner by relabeling every section that shows the least amount so that it shows the greatest amount instead.|A new version of the spinner is made: each section with the least amount is relabeled with the greatest amount, and every other section is unchanged.]]")}`,
          question: spin(rng, `[[By how many ${s.t.unit} is the expected value of one spin of the new spinner greater than that of the original spinner?|What is the increase, in ${s.t.unit}, in the expected value of one spin?]]`), correct: d, fmt: fmtNum,
          wrongs: [W(hi - lo, "step_missing", "칸의 비율을 곱하지 않았다."), W((hi - lo) / s.vals.length, "formula_misuse", "칸 수 대신 값 종류 수로 나눴다."), W(E + d, "step_missing", "새 기댓값을 답했다."), W(((hi - lo) * s.cs[s.cs.length - 1]) / s.N, "axis_misread", "가장 큰 값의 칸 수를 썼다."), W(E, "step_missing", "원래 기댓값을 답했다.")].filter((w) => ok1(w.v) && w.v > 0),
          verificationJs: figJs({}, s.fig, `${SP_JS}let lo = 0, hi = 0; vals.forEach((v, i) => { if (v < vals[lo]) lo = i; if (v > vals[hi]) hi = i; }); const S2 = S + cs[lo] * (vals[hi] - vals[lo]); return S2 / N - E;`),
          trace: [read(s), nStep(s), eStep(s), [`가장 작은 값 ${lo} 의 칸 ${cl} 개가 ${hi} 로 바뀌면 합이 ${cl} × (${hi} - ${lo}) = ${cl * (hi - lo)} 늘어난다.`, "Change in the weighted sum."], [`새 기댓값 = (${s.S} + ${cl * (hi - lo)}) ÷ ${s.N} = ${fmtNum(E + d)} 이다.`, "New expected value."], [`차 = ${fmtNum(E + d)} - ${fmtNum(E)} = ${fmtNum(d)} 이다.`, "Subtract."]], variant: "relabel_least_to_greatest",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "값 V 인 칸 k 개를 더한 뒤 기댓값이 M 이 될 때 더한 칸 수 k 를 역산", extra: "기댓값 = (원래 합 + kV) ÷ (원래 칸 수 + k) 를 세워 k 를 역으로 풀어야 함 — medium 은 기댓값 계산까지",
      concepts: ["기댓값", "확률 분포 표", "역산(방정식)"],
      gen(rng) {
        for (let tr = 0; tr < 80; tr++) {
          const s = makeSp(rng); const V = s.vals[s.vals.length - 1] + s.t.step * rng.int(1, 4); const k = rng.int(2, 8); const M = (s.S + k * V) / (s.N + k);
          if (!ok1(M) || M === s.S / s.N || V > 999) continue;
          return figInst(rng, {
            stimulus: `${intro(rng, s)} ${spin(rng, `[[The spinner is redesigned by adding some equal-size sections, each labeled ${V} ${s.t.unit}.|Some new sections of the same size are added to the spinner, and each new section shows ${V} ${s.t.unit}.]]`)} After the change, the expected value of one spin is ${fmtNum(M)} ${s.t.unit}.`,
            question: spin(rng, "[[How many sections were added?|How many sections were added to the spinner?]]"), correct: k,
            wrongs: [W(k + s.N, "step_missing", "새 전체 칸 수를 답했다."), W(Math.round((M * s.N - s.S) / V), "formula_misuse", "분모에 k 를 더하지 않았다."), W(k + 1, "other", "계산 중 1 어긋났다."), W(k - 1, "other", "계산 중 1 어긋났다."), W(Math.round((s.S + k * V) / V), "formula_misuse", "합을 새 값으로 나눴다.")].filter((w) => w.v > 0 && Number.isInteger(w.v)),
            verificationJs: figJs({ V, M }, s.fig, `${SP_JS}const k = (P.M * N - S) / (P.V - P.M); if (Math.abs(k - Math.round(k)) > 1e-9 || k < 1) throw new Error('정수 아님'); return Math.round(k);`),
            trace: [read(s), nStep(s), [`원래 합 = ${s.vals.map((v, i) => `${v}×${s.cs[i]}`).join(" + ")} = ${s.S} 이다.`, "Weighted sum."], [`(${s.S} + ${V}k) ÷ (${s.N} + k) = ${fmtNum(M)} 이다.`, "Set up the new expected value."], [`${s.S} + ${V}k = ${fmtNum(M * s.N)} + ${fmtNum(M)}k 이므로 ${fmtNum(V - M)}k = ${fmtNum(M * s.N - s.S)} 이다.`, "Collect terms."], [`k = ${k} 이다.`, "Solve."]], variant: "sections_added_for_ev",
          }, s.fig);
        }
        throw new GenFail("inverse");
      },
    },
    {
      op: "param_condition", structure: "한 번의 기댓값을 구하고, n 번 돌렸을 때 기대 총합이 목표 T 이상이 되는 최소 정수 n 을 구함", extra: "기댓값 → n·E ≥ T 부등식 → 정수 최소값(올림)을 골라야 함 — medium 은 기댓값까지",
      concepts: ["기댓값", "확률 분포 표", "부등식과 정수 조건"],
      gen(rng) {
        for (let tr = 0; tr < 40; tr++) {
          const s = makeSp(rng); const E = s.S / s.N; const n = rng.int(4, 20); const T = Math.round(E * n - rng.int(1, Math.max(1, Math.floor(E) - 1)));
          if (T <= 0 || T > 999 || Math.ceil(T / E) !== n || Number.isInteger(T / E)) continue;
          return figInst(rng, {
            stimulus: `${intro(rng, s)} ${spin(rng, `[[A player wants the expected total from several spins to be at least ${T} ${s.t.unit}.|A player sets a goal: the expected total over all spins should be at least ${T} ${s.t.unit}.]]`)}`,
            question: spin(rng, "[[What is the least number of spins that meets this goal?|What is the smallest whole number of spins the player needs?]]"), correct: n,
            wrongs: [W(n - 1, "condition_ignored", "올림 대신 내림했다."), W(Math.ceil(T / plain(s)), "formula_misuse", "칸 수를 무시하고 값만 평균 냈다."), W(n + 1, "other", "하나 더 올렸다."), W(Math.ceil(T / s.vals[s.vals.length - 1]), "formula_misuse", "가장 큰 값만 나온다고 보았다."), W(Math.ceil(T / s.vals[0]), "formula_misuse", "가장 작은 값만 나온다고 보았다.")].filter((w) => w.v > 0),
            verificationJs: figJs({ T }, s.fig, `${SP_JS}for (let n = 1; n <= 10000; n++) if (n * S >= P.T * N) return n; throw new Error('해 없음');`),
            trace: [read(s), nStep(s), eStep(s), [`n 번의 기대 총합 = ${fmtNum(E)}n ≥ ${T} 이다.`, "Set up the inequality."], [`n ≥ ${T} ÷ ${fmtNum(E)} ≈ ${fmtNum(Math.round((T / E) * 10) / 10)} 이다.`, "Divide."], [`가장 작은 정수는 ${n} 이다.`, "Round up."]], variant: "least_spins_for_target",
          }, s.fig);
        }
        throw new GenFail("param");
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "greatest_amount_probability", structure: "가장 큰 값이 나올 확률(그 값의 칸 수 ÷ 전체 칸 수)", extra: "easy: 칸 수 ÷ 전체 칸 수", concepts: ["확률 분포 표", "확률"],
      gen(rng) {
        const s = makeSp(rng); const c = s.cs[s.cs.length - 1];
        return figInst(rng, {
          stimulus: intro(rng, s), question: spin(rng, "[[What is the probability that one spin lands on a section with the greatest amount?|For one spin, what is the probability of landing on the greatest amount?]]"), correctText: frac(c, s.N), range: [0, 1],
          wrongTexts: [{ text: frac(1, s.vals.length), kind: "axis_misread", reason: "값의 종류 수로 확률을 냈다." }, { text: frac(c, s.N - c), kind: "formula_misuse", reason: "나머지 칸 수로 나눴다." }, { text: frac(s.cs[0], s.N), kind: "axis_misread", reason: "가장 작은 값의 칸 수를 읽었다." }, { text: frac(s.N - c, s.N), kind: "opposite", reason: "여사건을 구했다." }],
          verificationJs: figJs({}, s.fig, `${SP_JS}let hi = 0; vals.forEach((v, i) => { if (v > vals[hi]) hi = i; }); return cs[hi] / N;`), trace: [read(s), nStep(s), [`확률 = ${c}/${s.N} = ${frac(c, s.N)} 이다.`, "Sections with the greatest amount over all sections."]], variant: "p_greatest",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "expected_value", structure: "값 × 칸 수의 합을 전체 칸 수로 나눠 한 번의 기댓값을 구함", extra: "medium: 가중 합 → 전체 칸 수 → 기댓값", concepts: ["확률 분포 표", "기댓값"],
      gen(rng) {
        const s = makeSp(rng); const E = s.S / s.N;
        return figInst(rng, {
          stimulus: intro(rng, s), question: spin(rng, `[[What is the expected value, in ${s.t.unit}, of one spin?|What is the expected amount, in ${s.t.unit}, for a single spin?]]`), correct: E, fmt: fmtNum,
          wrongs: [W(plain(s), "formula_misuse", "칸 수를 무시하고 값만 평균 냈다."), W(s.S, "step_missing", "전체 칸 수로 나누지 않았다."), W(s.S / s.vals.length, "formula_misuse", "값 종류 수로 나눴다."), W(s.vals[s.cs.indexOf(Math.max(...s.cs))], "formula_misuse", "가장 많은 칸의 값을 답했다."), W(E + s.t.step, "other", "계산 중 어긋났다.")].filter((w) => ok1(w.v)),
          verificationJs: figJs({}, s.fig, `${SP_JS}return E;`), trace: [read(s), nStep(s), eStep(s)], variant: "ev_one_spin",
        }, s.fig);
      },
    },
  ],
});
