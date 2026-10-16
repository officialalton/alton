// probability.simple.TW.P — 이원표에서 무작위로 한 명을 고를 때의 확률(칸·합계 ÷ 전체). 합집합·두 확률 비교·추가 인원 역산·임계 인원으로 확장한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import type { DistractorKind } from "../../../../review";
import { frac, spin } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs, makeTw, TW_JS, type TwScene } from "../../../figure-kit";
import { defineItem } from "../item-kit";

const FW = (n: number, d: number, kind: DistractorKind, reason: string) => ({ text: frac(n, d), kind, reason });
const intro = (rng: Rng, s: TwScene) => spin(rng, `[[The table shows|The two-way table shown summarizes|The table shown gives|A researcher recorded, in the table shown,]] the responses of ${s.t.ent} ${s.t.where}, [[organized|sorted|classified]] by ${s.t.rowHeader.toLowerCase()}.`);
const pick1 = (rng: Rng, s: TwScene) => spin(rng, `[[One of these ${s.t.ent} is chosen at random.|Suppose one of the ${s.t.ent} in the table is selected at random.|A single person is picked at random from all the ${s.t.ent} in the table.|Each of the ${s.t.ent} in the table is equally likely to be chosen, and one is chosen.]]`);
const readTw = (s: TwScene): [string, string] => [`표에서 칸을 읽는다: ${s.t.r1} — ${s.cells[0][0]}, ${s.cells[0][1]}; ${s.t.r2} — ${s.cells[1][0]}, ${s.cells[1][1]}.`, "Read the cells of the table."];
const totalStep = (s: TwScene): [string, string] => [`전체 인원 = ${s.r1} + ${s.r2} = ${s.N} 이다.`, "Find the grand total."];

export const ITEM = defineItem({
  prefix: "pr", itemId: "probability.simple.TW.P",
  hard: [
    {
      op: "chain2", structure: "이원표에서 행 합계·열 합계·겹치는 칸을 읽고 합집합(r1 또는 응답)의 인원을 구한 뒤 전체로 나눠 확률을 구함", extra: "두 합계를 더하고 겹치는 칸을 한 번 빼는 합집합 계산 → 확률의 연쇄 — medium 은 행 합계 하나의 확률",
      concepts: ["이원표 읽기", "합집합(포함·배제)", "확률"],
      gen(rng) {
        const s = makeTw(rng); const t = s.t; const [c11] = s.cells[0]; const u = s.r1 + s.cy - c11;
        return figInst(rng, {
          stimulus: `${intro(rng, s)} ${pick1(rng, s)}`,
          question: spin(rng, `[[What is the probability that the person chosen is one of the ${t.r1} or ${t.yp}?|What is the probability that the chosen person is one of the ${t.r1}, or ${t.yp}, or both?]]`), correctText: frac(u, s.N), range: [0, 1],
          wrongTexts: [FW(s.r1 + s.cy, s.N, "formula_misuse", "겹치는 칸을 빼지 않고 두 합계를 더했다."), FW(c11, s.N, "scope", "'또는'을 '그리고'로 읽어 겹치는 칸만 셌다."), FW(s.r1 + s.cy - 2 * c11, s.N, "formula_misuse", "겹치는 칸을 두 번 뺐다."), FW(s.N - u, s.N, "opposite", "여사건을 구했다."), FW(u, s.N + c11, "formula_misuse", "분모에도 겹치는 칸을 더했다."), FW(s.r1, s.N, "step_missing", "행 합계만 셌다.")],
          verificationJs: figJs({}, s.fig, `${TW_JS}return (r1 + cy - c11) / N;`),
          trace: [readTw(s), totalStep(s), [`${t.r1} 의 합계는 ${s.r1}, 응답한 사람의 합계는 ${s.cy} 이다.`, "Row total and column total."], [`둘 다인 사람은 ${c11} 명이므로 합집합 = ${s.r1} + ${s.cy} - ${c11} = ${u} 이다.`, "Inclusion-exclusion: subtract the overlap once."], [`확률 = ${u}/${s.N} 이다.`, "Divide by the grand total."], [`기약분수로 ${frac(u, s.N)} 이다.`, "Reduce."]], variant: "union_probability",
        }, s.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "이원표에서 '한 집단일 확률'과 '응답했을 확률'을 각각 구해 두 확률의 차를 구함", extra: "행 합계·열 합계를 따로 구해 같은 분모의 두 확률을 비교해야 함 — medium 은 확률 하나",
      concepts: ["이원표 읽기", "행·열 합계", "확률 비교"],
      gen(rng) {
        const s = makeTw(rng); const t = s.t; const d = Math.abs(s.r1 - s.cy); if (d === 0) throw new GenFail("same");
        return figInst(rng, {
          stimulus: `${intro(rng, s)} ${pick1(rng, s)} Let A be the event that the person is one of the ${t.r1}, and let B be the event that the person ${t.yp}.`,
          question: spin(rng, "[[What is the positive difference between the probability of event A and the probability of event B?|By how much does the probability of event A differ from the probability of event B?]]"), correctText: frac(d, s.N), range: [0, 1],
          wrongTexts: [FW(Math.abs(s.r1 - s.cells[0][0]), s.N, "formula_misuse", "B 를 그 집단 안에서 응답하지 않은 칸으로 읽었다."), FW(s.r1 + s.cy, s.N, "sign_error", "차 대신 합을 구했다."), FW(Math.abs(s.r2 - s.cy), s.N, "axis_misread", "다른 집단의 합계를 썼다."), FW(Math.abs(s.r1 - s.cn), s.N, "axis_misread", "응답하지 않은 열 합계를 썼다."), FW(d, s.r1, "formula_misuse", "분모를 행 합계로 잡았다."), FW(Math.abs(s.cells[0][0] - s.cells[1][0]), s.N, "step_missing", "합계가 아니라 칸끼리 비교했다.")],
          verificationJs: figJs({}, s.fig, `${TW_JS}return Math.abs(r1 - cy) / N;`),
          trace: [readTw(s), totalStep(s), [`P(A) = ${s.r1}/${s.N} 이다(행 합계).`, "P(A) uses the row total."], [`P(B) = ${s.cy}/${s.N} 이다(열 합계).`, "P(B) uses the column total."], [`차 = |${s.r1} - ${s.cy}|/${s.N} = ${d}/${s.N} 이다.`, "Subtract the probabilities."], [`기약분수로 ${frac(d, s.N)} 이다.`, "Reduce."]], variant: "row_vs_column_probability",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "이원표의 전체와 한 칸을 읽고, 다른 칸에 x 명이 더해진 뒤 그 칸의 확률이 주어진 분수가 될 때 x 를 역산", extra: "분모만 x 만큼 커지는 확률 식을 세워 역으로 풀어야 함 — medium 은 확률 계산까지",
      concepts: ["이원표 읽기", "확률", "분수 방정식의 역산"],
      gen(rng) {
        for (let tr = 0; tr < 80; tr++) {
          const s = makeTw(rng, { lo: 6, hi: 40 }); const t = s.t; const [c11] = s.cells[0]; const x = rng.int(2, 40); const g = frac(c11, s.N + x); if (!g.includes("/")) continue;
          const [a, b] = g.split("/").map(Number); if (b > 999 || a < 2) continue; if (frac(c11, s.N) === g) continue;
          return figInst(rng, {
            stimulus: `${intro(rng, s)} Later, some additional ${t.r2} are surveyed, and none of them ${t.yp}. After they are added, the probability that a person chosen at random from everyone surveyed is one of the ${t.r1} who ${t.yp} is ${a}/${b}.`,
            question: spin(rng, `[[How many additional ${t.r2} were surveyed?|How many ${t.r2} were added to the survey?]]`), correct: x,
            wrongs: [W(c11 * b / a, "step_missing", "새 전체 인원을 답하고 원래 전체를 빼지 않았다."), W(c11 * b / a - s.r1, "formula_misuse", "원래 전체 대신 한 행 합계만 뺐다."), W(x + s.cells[1][1], "condition_ignored", "원래 칸의 인원까지 더했다."), W(x + 1, "other", "계산 중 1 어긋났다."), W(x - 1, "other", "계산 중 1 어긋났다."), W(b - s.N, "formula_misuse", "기약분수의 분모를 새 전체로 착각했다.")].filter((w) => w.v > 0 && Number.isInteger(w.v)),
            verificationJs: figJs({ a, b }, s.fig, `${TW_JS}const tot = c11 * P.b / P.a; if (!Number.isInteger(tot)) throw new Error('정수 아님'); return tot - N;`),
            trace: [readTw(s), totalStep(s), [`${t.r1} 이면서 응답한 사람은 ${c11} 명이고, 새로 더한 사람은 이 칸에 들어가지 않는다.`, "The favorable count stays the same."], [`${c11} ÷ (${s.N} + x) = ${a}/${b} 이다.`, "Only the denominator grows by x."], [`${s.N} + x = ${c11} × ${b} ÷ ${a} = ${s.N + x} 이다.`, "Solve for the new total."], [`x = ${s.N + x} - ${s.N} = ${x} 이다.`, "Subtract the original total."]], variant: "added_to_reach_probability",
          }, s.fig);
        }
        throw new GenFail("inverse");
      },
    },
    {
      op: "param_condition", structure: "이원표의 한 칸·전체를 읽고, 그 칸에 해당하는 사람 x 명이 더해질 때 확률이 p% 이상이 되는 최소 정수 x 를 구함", extra: "분자·분모가 함께 커지는 부등식을 세우고 정수 최소값(올림)을 골라야 함 — medium 은 확률 계산까지",
      concepts: ["이원표 읽기", "확률", "부등식과 정수 조건"],
      gen(rng) {
        for (let tr = 0; tr < 80; tr++) {
          const s = makeTw(rng); const t = s.t; const [c11] = s.cells[0]; const p = rng.pick([30, 35, 40, 45, 50, 55, 60]);
          const num = p * s.N - 100 * c11; if (num <= 0 || num % (100 - p) === 0) continue; const x = Math.ceil(num / (100 - p)); if (x < 2 || x > 300) continue;
          return figInst(rng, {
            stimulus: `${intro(rng, s)} Suppose more ${t.r1} are surveyed, and every one of them ${t.yp}.`,
            question: spin(rng, `[[What is the least number of additional ${t.r1} needed so that the probability that a person chosen at random from everyone surveyed is one of the ${t.r1} who ${t.yp} is at least ${p}%?|At least how many more ${t.r1} must be surveyed so that a randomly chosen person from everyone surveyed has at least a ${p}% chance of being one of the ${t.r1} who ${t.yp}?]]`), correct: x,
            wrongs: [W(x - 1, "condition_ignored", "올림 대신 내림했다."), W(Math.ceil((p * s.N) / 100 - c11), "formula_misuse", "분모에 x 를 더하지 않았다."), W(Math.ceil(num / 100), "formula_misuse", "(100 − p) 대신 100 으로 나눴다."), W(x + 1, "other", "하나 더 올렸다."), W(Math.ceil((p * s.r1 - 100 * c11) / (100 - p)), "axis_misread", "전체 대신 행 합계를 분모로 썼다.")].filter((w) => w.v > 0),
            verificationJs: figJs({ p }, s.fig, `${TW_JS}for (let x = 0; x <= 5000; x++) if (100 * (c11 + x) >= P.p * (N + x)) return x; throw new Error('해 없음');`),
            trace: [readTw(s), totalStep(s), [`추가 x 명 뒤 확률 = (${c11} + x) ÷ (${s.N} + x) 이다.`, "Both numerator and denominator grow by x."], [`100(${c11} + x) ≥ ${p}(${s.N} + x) 이므로 ${100 - p}x ≥ ${num} 이다.`, "Set up and simplify the inequality."], [`x ≥ ${num} ÷ ${100 - p} ≈ ${(num / (100 - p)).toFixed(1)} 이다.`, "Divide."], [`가장 작은 정수는 ${x} 이다.`, "Round up to a whole number."]], variant: "least_added_for_probability",
          }, s.fig);
        }
        throw new GenFail("param");
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "cell_probability", structure: "이원표의 한 칸을 전체로 나눠 확률을 구함", extra: "easy: 칸 ÷ 전체", concepts: ["이원표 읽기", "확률"],
      gen(rng) {
        const s = makeTw(rng); const t = s.t; const c22 = s.cells[1][1];
        return figInst(rng, {
          stimulus: `${intro(rng, s)} ${pick1(rng, s)}`, question: spin(rng, `[[What is the probability that the person chosen is one of the ${t.r2} who did not ${t.yv}?|What is the probability of choosing one of the ${t.r2} who did not ${t.yv}?]]`), correctText: frac(c22, s.N), range: [0, 1],
          wrongTexts: [FW(c22, s.r2, "formula_misuse", "행 합계로 나눴다."), FW(c22, s.cn, "formula_misuse", "열 합계로 나눴다."), FW(s.cells[1][0], s.N, "axis_misread", "옆 칸을 읽었다."), FW(s.N - c22, s.N, "opposite", "여사건을 구했다.")],
          verificationJs: figJs({}, s.fig, `${TW_JS}return c22 / N;`), trace: [readTw(s), totalStep(s), [`확률 = ${c22}/${s.N} = ${frac(c22, s.N)} 이다.`, "Divide the cell by the total."]], variant: "cell_over_total",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "row_probability", structure: "이원표에서 한 집단의 행 합계를 구해 전체로 나눠 확률을 구함", extra: "medium: 행 합계 → 전체 합계 → 확률", concepts: ["이원표 읽기", "행 합계", "확률"],
      gen(rng) {
        const s = makeTw(rng); const t = s.t;
        return figInst(rng, {
          stimulus: `${intro(rng, s)} ${pick1(rng, s)}`, question: spin(rng, `[[What is the probability that the person chosen is one of the ${t.r1}?|What is the probability of choosing one of the ${t.r1}?]]`), correctText: frac(s.r1, s.N), range: [0, 1],
          wrongTexts: [FW(s.cells[0][0], s.N, "step_missing", "행의 한 칸만 셌다."), FW(s.r2, s.N, "axis_misread", "다른 집단을 셌다."), FW(s.r1, s.r2, "formula_misuse", "다른 집단의 합계로 나눴다."), FW(s.cells[0][0], s.r1, "formula_misuse", "조건부 확률을 구했다."), FW(s.cy, s.N, "axis_misread", "열 합계를 썼다.")],
          verificationJs: figJs({}, s.fig, `${TW_JS}return r1 / N;`), trace: [readTw(s), [`${t.r1} 의 합계 = ${s.cells[0][0]} + ${s.cells[0][1]} = ${s.r1} 이다.`, "Add the row."], totalStep(s), [`확률 = ${s.r1}/${s.N} = ${frac(s.r1, s.N)} 이다.`, "Divide by the total."]], variant: "row_over_total",
        }, s.fig);
      },
    },
  ],
});
