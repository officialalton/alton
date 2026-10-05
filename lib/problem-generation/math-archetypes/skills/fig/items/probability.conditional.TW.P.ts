// probability.conditional.TW.P — 이원표의 조건부 확률(칸 ÷ 행·열 합계). 두 조건부 확률 비교·추가 인원 역산·역전 임계 인원·합집합 안의 조건부 확률로 확장한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import type { DistractorKind } from "../../../../review";
import { fmtNum, frac, spin } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs, makeTw, TW_JS, type TwScene } from "../../../figure-kit";
import { defineItem } from "../item-kit";

const FW = (n: number, d: number, kind: DistractorKind, reason: string) => ({ text: frac(n, d), kind, reason });
const intro = (rng: Rng, s: TwScene) => spin(rng, `[[The table shows|The two-way table shown summarizes|The table shown gives|A researcher recorded, in the table shown,]] the responses of ${s.t.ent} ${s.t.where}, [[organized|sorted|classified]] by ${s.t.rowHeader.toLowerCase()}.`);
const readTw = (s: TwScene): [string, string] => [`표에서 칸을 읽는다: ${s.t.r1} — ${s.cells[0][0]}, ${s.cells[0][1]}; ${s.t.r2} — ${s.cells[1][0]}, ${s.cells[1][1]}.`, "Read the cells of the table."];

export const ITEM = defineItem({
  prefix: "pr", itemId: "probability.conditional.TW.P",
  hard: [
    {
      op: "compare_scenarios", structure: "두 집단 각각에서 응답할 조건부 확률(칸 ÷ 행 합계)을 구해 두 확률의 차를 구함", extra: "분모가 다른 두 조건부 확률을 각각 구하고 통분해 비교해야 함 — medium 은 조건부 확률 하나",
      concepts: ["이원표 읽기", "조건부 확률", "분수의 차(통분)"],
      gen(rng) {
        const s = makeTw(rng); const t = s.t; const [c11] = s.cells[0], [c21] = s.cells[1]; const nu = Math.abs(c11 * s.r2 - c21 * s.r1); const de = s.r1 * s.r2; if (nu === 0) throw new GenFail("same"); const ans = frac(nu, de);
        if (ans.split("/").some((x) => Number(x) > 999)) throw new GenFail("big");
        return figInst(rng, {
          stimulus: `${intro(rng, s)} ${spin(rng, `[[A researcher compares the two groups.|The researcher wants to compare the two groups of ${t.ent}.]]`)}`,
          question: spin(rng, `[[What is the positive difference between the probability that one of the ${t.r1} chosen at random ${t.yp} and the probability that one of the ${t.r2} chosen at random ${t.yp}?|By how much does the probability that a randomly chosen one of the ${t.r1} ${t.yp} differ from the same probability for the ${t.r2}?]]`), correctText: ans, range: [0, 1],
          wrongTexts: [FW(Math.abs(c11 - c21), s.N, "formula_misuse", "칸의 차를 전체로 나눴다."), FW(Math.abs(c11 * s.cy - c21 * s.cy), s.cy * s.cy, "axis_misread", "행 합계 대신 열 합계를 분모로 썼다."), FW(Math.abs(c11 - c21), Math.abs(s.r1 - s.r2) || 1, "formula_misuse", "분자끼리·분모끼리 뺐다."), FW(c11 * s.r2 + c21 * s.r1, de, "sign_error", "차 대신 합을 구했다."), FW(Math.abs(c11 * s.r2 - s.cells[1][1] * s.r1), de, "axis_misread", "한 집단에서 응답하지 않은 칸을 썼다.")],
          verificationJs: figJs({}, s.fig, `${TW_JS}return Math.abs(c11 / r1 - c21 / r2);`),
          trace: [readTw(s), [`${t.r1} 합계 ${s.r1}, ${t.r2} 합계 ${s.r2} 이다.`, "Row totals."], [`P(응답 | ${t.r1}) = ${c11}/${s.r1} 이다.`, "First conditional probability."], [`P(응답 | ${t.r2}) = ${c21}/${s.r2} 이다.`, "Second conditional probability."], [`차 = |${c11}·${s.r2} - ${c21}·${s.r1}| ÷ (${s.r1}·${s.r2}) = ${nu}/${de} 이다.`, "Use a common denominator."], [`기약분수로 ${ans} 이다.`, "Reduce."]], variant: "difference_of_conditionals",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "응답한 사람(열) 안에서 한 집단일 조건부 확률이, 그 집단의 응답자 x 명이 더해진 뒤 주어진 분수가 될 때 x 를 역산", extra: "조건(열 합계)과 분자가 함께 x 만큼 바뀌는 식을 세워 역산해야 함 — medium 은 조건부 확률 계산까지",
      concepts: ["이원표 읽기", "조건부 확률", "분수 방정식의 역산"],
      gen(rng) {
        for (let tr = 0; tr < 80; tr++) {
          const s = makeTw(rng); const t = s.t; const [c21] = s.cells[1]; const x = rng.int(2, 40); const g = frac(c21 + x, s.cy + x); if (!g.includes("/")) continue;
          const [a, b] = g.split("/").map(Number); if (b > 999 || a < 2) continue;
          return figInst(rng, {
            stimulus: `${intro(rng, s)} ${spin(rng, `[[Later, more ${t.r2} are surveyed, and all of them ${t.yp}.|Afterward, additional ${t.r2} respond, and every one of them ${t.yp}.]]`)} Then, for a person chosen at random from those who ${t.yp}, the probability that the person is one of the ${t.r2} is ${a}/${b}.`,
            question: spin(rng, `[[How many more ${t.r2} were surveyed?|How many additional ${t.r2} responded?]]`), correct: x,
            wrongs: [W(x + c21, "step_missing", "원래 칸의 인원을 다시 더했다."), W(b - s.cy, "formula_misuse", "기약분수의 분모를 새 열 합계로 착각했다."), W(a - c21, "formula_misuse", "기약분수의 분자를 새 칸으로 착각했다."), W(x + 1, "other", "계산 중 1 어긋났다."), W(x - 1, "other", "계산 중 1 어긋났다."), W(s.cy + x, "step_missing", "새 열 합계를 답했다.")].filter((w) => w.v > 0 && Number.isInteger(w.v)),
            verificationJs: figJs({ a, b }, s.fig, `${TW_JS}const x = (P.a * cy - P.b * c21) / (P.b - P.a); if (!Number.isInteger(x) || x < 0) throw new Error('정수 아님'); return x;`),
            trace: [readTw(s), [`응답한 사람의 열 합계 = ${s.cells[0][0]} + ${c21} = ${s.cy}, 그중 ${t.r2} 는 ${c21} 명이다.`, "Column total and the matching cell."], [`x 명 추가 뒤 (${c21} + x) ÷ (${s.cy} + x) = ${a}/${b} 이다.`, "Numerator and condition both grow by x."], [`${b}(${c21} + x) = ${a}(${s.cy} + x) 이다.`, "Cross-multiply."], [`${b - a}x = ${a * s.cy - b * c21} 이다.`, "Collect the x terms."], [`x = ${x} 이다.`, "Solve."]], variant: "added_to_reach_conditional",
          }, s.fig);
        }
        throw new GenFail("inverse");
      },
    },
    {
      op: "param_condition", structure: "두 집단의 조건부 확률을 비교하고, 앞선 집단에 응답하지 않은 사람 x 명이 더해질 때 그 집단의 조건부 확률이 다른 집단보다 작아지는 최소 정수 x 를 구함", extra: "분모만 커지는 조건부 확률과 다른 집단의 확률 사이의 부등식을 세우고 엄격 부등호의 정수 최소값을 골라야 함 — medium 은 조건부 확률 하나",
      concepts: ["이원표 읽기", "조건부 확률 비교", "부등식과 정수 조건"],
      gen(rng) {
        for (let tr = 0; tr < 80; tr++) {
          const s = makeTw(rng); const t = s.t; const [c11] = s.cells[0], [c21] = s.cells[1]; if (c11 * s.r2 <= c21 * s.r1) continue;
          const bound = (c11 * s.r2) / c21 - s.r1; const x = Math.floor(bound) + 1; if (x < 2 || x > 400) continue;
          return figInst(rng, {
            stimulus: `${intro(rng, s)} Suppose more ${t.r1} are surveyed, and none of them ${t.yp}.`,
            question: spin(rng, `[[What is the least number of additional ${t.r1} needed so that the probability that a randomly chosen one of the ${t.r1} ${t.yp} is less than the same probability for the ${t.r2}?|At least how many more ${t.r1} must be surveyed so that, among the ${t.r1}, the fraction who ${t.yp} is less than that fraction among the ${t.r2}?]]`), correct: x,
            wrongs: [W(x - 1, "condition_ignored", "엄격한 부등호에서 경계값을 답으로 했다."), W(Math.ceil((c11 * s.r2) / c21), "step_missing", "새 행 합계를 답했다."), W(Math.max(1, Math.ceil((c11 * s.N) / s.cy - s.r1)), "axis_misread", "비교 대상을 전체 비율로 잡았다."), W(x + 1, "other", "하나 더 올렸다."), W(Math.max(1, c11 - c21), "formula_misuse", "칸의 차만 보았다.")].filter((w) => w.v > 0),
            verificationJs: figJs({}, s.fig, `${TW_JS}for (let x = 0; x <= 5000; x++) if (c11 * r2 < c21 * (r1 + x)) return x; throw new Error('해 없음');`),
            trace: [readTw(s), [`P(응답 | ${t.r1}) = ${c11}/${s.r1}, P(응답 | ${t.r2}) = ${c21}/${s.r2} 이다.`, "Two conditional probabilities."], [`x 명 추가 뒤 ${t.r1} 의 확률은 ${c11} ÷ (${s.r1} + x) 이다.`, "Only the first denominator grows."], [`${c11} ÷ (${s.r1} + x) < ${c21}/${s.r2} 이므로 ${s.r1} + x > ${fmtNum(Math.round((c11 * s.r2 / c21) * 10) / 10)} 이다.`, "Set up the strict inequality."], [`x > ${fmtNum(Math.round(bound * 10) / 10)} 이다.`, "Isolate x."], [`가장 작은 정수는 ${x} 이다.`, "Take the least integer above the bound."]], variant: "least_added_to_reverse",
          }, s.fig);
        }
        throw new GenFail("param");
      },
    },
    {
      op: "chain2", structure: "이원표에서 '한 집단이거나 응답한 사람'의 합집합 인원을 먼저 구하고, 그 안에서 둘 다인 사람의 조건부 확률을 구함", extra: "포함·배제로 조건(합집합)의 크기를 구한 뒤 그것을 분모로 쓰는 2단 연쇄 — medium 은 열 합계를 조건으로 쓰는 확률",
      concepts: ["이원표 읽기", "합집합(포함·배제)", "조건부 확률"],
      gen(rng) {
        const s = makeTw(rng); const t = s.t; const [c11] = s.cells[0]; const u = s.r1 + s.cy - c11;
        return figInst(rng, {
          stimulus: `${intro(rng, s)} One person is chosen at random from the ${t.ent} who are ${t.r1}, who ${t.yp}, or both.`,
          question: spin(rng, `[[What is the probability that the person chosen is one of the ${t.r1} who ${t.yp}?|What is the probability that the chosen person is both one of the ${t.r1} and someone who ${t.yp}?]]`), correctText: frac(c11, u), range: [0, 1],
          wrongTexts: [FW(c11, s.r1 + s.cy, "formula_misuse", "겹치는 칸을 빼지 않은 합을 분모로 썼다."), FW(c11, s.N, "condition_ignored", "조건을 무시하고 전체로 나눴다."), FW(c11, s.r1, "scope", "조건을 한 집단으로만 잡았다."), FW(c11, s.cy, "scope", "조건을 응답자로만 잡았다."), FW(u - c11, u, "opposite", "둘 중 하나만인 사람의 확률을 구했다."), FW(u, s.N, "step_missing", "합집합의 확률을 답했다.")],
          verificationJs: figJs({}, s.fig, `${TW_JS}return c11 / (r1 + cy - c11);`),
          trace: [readTw(s), [`${t.r1} 합계 ${s.r1}, 응답한 사람의 합계 ${s.cy} 이다.`, "Row and column totals."], [`조건(합집합) = ${s.r1} + ${s.cy} - ${c11} = ${u} 명이다.`, "Inclusion-exclusion gives the condition size."], [`둘 다인 사람은 ${c11} 명이다.`, "Favorable count."], [`확률 = ${c11}/${u} 이다.`, "Divide by the condition size."], [`기약분수로 ${frac(c11, u)} 이다.`, "Reduce."]], variant: "conditional_on_union",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "given_row", structure: "이원표에서 한 집단(행) 안에서 응답한 사람의 조건부 확률을 구함", extra: "easy: 칸 ÷ 행 합계", concepts: ["이원표 읽기", "조건부 확률"],
      gen(rng) {
        const s = makeTw(rng); const t = s.t; const [c11, c12] = s.cells[0];
        return figInst(rng, {
          stimulus: `${intro(rng, s)} One of the ${t.r1} is chosen at random.`, question: spin(rng, `[[What is the probability that the person chosen ${t.yp}?|What is the probability that this person ${t.yp}?]]`), correctText: frac(c11, s.r1), range: [0, 1],
          wrongTexts: [FW(c11, s.N, "condition_ignored", "전체로 나눴다."), FW(c11, s.cy, "axis_misread", "열 합계로 나눴다."), FW(c12, s.r1, "opposite", "응답하지 않은 칸을 썼다."), FW(c11, c12, "formula_misuse", "비(odds)를 구했다.")],
          verificationJs: figJs({}, s.fig, `${TW_JS}return c11 / r1;`), trace: [readTw(s), [`${t.r1} 합계 = ${c11} + ${c12} = ${s.r1} 이다.`, "Row total."], [`확률 = ${c11}/${s.r1} = ${frac(c11, s.r1)} 이다.`, "Cell over row total."]], variant: "given_row",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "given_column", structure: "이원표에서 응답한 사람(열) 안에서 한 집단일 조건부 확률을 구함", extra: "medium: 열 합계를 조건으로 삼는 확률(행·열 구분)", concepts: ["이원표 읽기", "열 합계", "조건부 확률"],
      gen(rng) {
        const s = makeTw(rng); const t = s.t; const [c11] = s.cells[0], [c21] = s.cells[1];
        return figInst(rng, {
          stimulus: `${intro(rng, s)} One person is chosen at random from the ${t.ent} who ${t.yp}.`, question: spin(rng, `[[What is the probability that the person chosen is one of the ${t.r2}?|What is the probability that this person is one of the ${t.r2}?]]`), correctText: frac(c21, s.cy), range: [0, 1],
          wrongTexts: [FW(c21, s.r2, "axis_misread", "행 합계로 나눴다."), FW(c21, s.N, "condition_ignored", "전체로 나눴다."), FW(c11, s.cy, "opposite", "다른 집단의 칸을 썼다."), FW(s.r2, s.N, "condition_ignored", "조건 없이 집단의 확률을 구했다."), FW(c21, c11, "formula_misuse", "비(odds)를 구했다.")],
          verificationJs: figJs({}, s.fig, `${TW_JS}return c21 / cy;`), trace: [readTw(s), [`응답한 사람의 열 합계 = ${c11} + ${c21} = ${s.cy} 이다.`, "Column total."], [`그중 ${t.r2} 는 ${c21} 명이다.`, "Favorable cell."], [`확률 = ${c21}/${s.cy} = ${frac(c21, s.cy)} 이다.`, "Cell over column total."]], variant: "given_column",
        }, s.fig);
      },
    },
  ],
});
