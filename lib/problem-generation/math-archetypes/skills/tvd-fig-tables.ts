// two_variable_data — 자료(이원표)가 붙는 지문형 원형. 표의 칸·합계는 그림에만 있고 지문에는 값이 없다(지문에 있는 수는 가정·요구 조건뿐).
// 항목: cell · row_total · conditional_share (이원표, 지문형 P).
// 표 라벨(Joined 등)과 지문 표현(signed up 등)을 일부러 다른 낱말로 두어, 지문의 숫자 절이 표 라벨과 겹쳐 값 검사를 오작동시키지 않게 한다.
import { GenFail, type Archetype, type Instance, type OperatorId } from "../types";
import type { Rng } from "../rng";
import { gcd } from "../rng";
import { fmtNum, frac, spin } from "../text";
import { W } from "./d-kit";
import { figJs, figInst, makeTw, twFig, TW_JS, oneDec, r1d, cap1, type TwScene } from "../figure-kit";
import { TW_TOPICS } from "../figure-topics";

const SKILL = "two_variable_data";
const isInt = Number.isInteger;
const intro = (rng: Rng, s: TwScene) => spin(rng, `[[The table shows|The two-way table below summarizes|The table gives]] the responses of ${s.t.ent} ${s.t.where}, organized by ${s.t.rowHeader.toLowerCase()}.`);
const readTw = (s: TwScene): [string, string] => [`표에서 칸을 읽는다: ${s.t.r1} — ${s.cells[0][0]}, ${s.cells[0][1]}; ${s.t.r2} — ${s.cells[1][0]}, ${s.cells[1][1]}.`, "Read the cells of the table."];
const notYv = (s: TwScene) => `did not ${s.t.yv}`;

type OpDef = { op: OperatorId; structure: string; extra: string; concepts: string[]; gen: (rng: Rng) => Instance };
function build(kind: string, ops: OpDef[], mediumSteps = 3): Archetype[] {
  return ops.map((o) => ({
    id: `tvd.${kind}.TW.P.${o.op}`, skill: SKILL, kind: `${kind}.TW.P`, operator: o.op, structure: o.structure, extraThinking: o.extra, concepts: o.concepts, mediumSteps,
    figureItem: `two_variable_data.${kind}.TW.P`, spr: { capable: true, reason: "정답이 하나의 수(정수·소수·분수)이고 질문이 선택지를 가리키지 않아 선택지 없이 낼 수 있다" },
    generate: (rng) => o.gen(rng),
  }));
}

// ═════════════ cell ═════════════
const cellOps: OpDef[] = [
  {
    op: "inverse", structure: "표의 한 집단 합계·한 칸을 읽고, 같은 응답을 하는 추가 응답자 x 명을 더했을 때 그 집단의 비율이 p% 가 되는 x 를 역산", extra: "표에서 칸과 행 합계를 읽어 분자·분모에 같은 x 를 더하는 식을 세워 푸는 역산(분모도 변함) — medium 은 현재 비율 읽기",
    concepts: ["이원표 읽기", "비율 방정식", "분자·분모 동시 증가"],
    gen(rng) {
      for (let tr = 0; tr < 80; tr++) {
        const s = makeTw(rng); const [c11] = s.cells[0]; const p = rng.pick([60, 65, 70, 75, 80, 85, 90]); const num = p * s.r1 - 100 * c11; if (num <= 0 || num % (100 - p) !== 0) continue; const x = num / (100 - p); if (x < 2 || x > 40) continue;
        const t = s.t;
        return figInst(rng, {
          stimulus: `${intro(rng, s)} Suppose some additional ${t.r1} respond to the survey, and every one of them ${t.yp}.`,
          question: `After these ${t.r1} are included, exactly ${p}% of all the ${t.r1} surveyed ${t.yp}. How many additional ${t.r1} responded?`, correct: x,
          wrongs: [W(Math.round((p * s.r1) / 100 - c11), "formula_misuse", "분자에만 x 를 더하고 분모는 그대로 뒀다."), W(Math.round((p * s.r1) / 100), "step_missing", "원래 칸의 값을 빼지 않았다."), W(x + 2, "other", "계산 중 어긋났다."), W(Math.max(1, x - 2), "other", "계산 중 어긋났다."), W(Math.round(((100 - p) * s.r1) / 100), "formula_misuse", "반대 비율을 썼다."), W(Math.round((p * s.r1 - 100 * c11) / 100), "formula_misuse", "(100 − p) 로 나누지 않고 100 으로 나눴다.")],
          verificationJs: figJs({ p }, s.fig, `${TW_JS}for (let x = 0; x <= 2000; x++) { if ((c11 + x) * 100 === P.p * (r1 + x)) return x; } throw new Error('해 없음');`),
          trace: [readTw(s), [`${t.r1} 의 합계는 ${s.r1}, 그중 응답 칸은 ${c11} 이다.`, "Row total and the matching cell."], [`추가 x 명이 모두 응답하면 (${c11} + x) ÷ (${s.r1} + x) = ${p}% 이다.`, "Add x to both numerator and denominator."], [`교차곱: 100(${c11} + x) = ${p}(${s.r1} + x) 이다.`, "Cross-multiply."], [`(100 - ${p})x = ${p}·${s.r1} - 100·${c11} = ${num} 이다.`, "Collect the x terms."], [`x = ${num} ÷ ${100 - p} = ${x} 이다.`, "Solve for x."]] as [string, string][], variant: "additional_to_reach_share",
        }, s.fig);
      }
      throw new GenFail("cell.inverse");
    },
  },
  {
    op: "chain2", structure: "표에서 한 집단의 '응답하지 않은 칸' 을 읽고 그 중 q% 가 나중에 응답한다고 할 때 그 집단의 총 응답자 수", extra: "표에서 두 칸을 읽고 칸의 q% 를 구해 다른 칸에 더하는 3단 연쇄(퍼센트의 기준이 응답하지 않은 칸) — medium 은 한 칸 읽기",
    concepts: ["이원표 읽기", "칸의 퍼센트", "합산"],
    gen(rng) {
      for (let tr = 0; tr < 80; tr++) {
        const s = makeTw(rng); const [c21, c22] = s.cells[1]; const q = rng.pick([10, 20, 25, 40, 50, 60, 75]); if ((c22 * q) % 100 !== 0) continue; const add = (c22 * q) / 100; if (add < 2) continue;
        const t = s.t; const correct = c21 + add;
        return figInst(rng, {
          stimulus: `${intro(rng, s)} Later, ${q}% of the ${t.r2} who ${notYv(s)} decide to ${t.yv}.`,
          question: `After that, in all, how many of the ${t.r2} ${t.yp}?`, correct,
          wrongs: [W(add, "step_missing", "새로 응답한 사람만 답했다."), W(c21 + c22, "formula_misuse", "응답하지 않은 칸 전체를 더했다."), W(c21 + Math.round((s.cells[0][1] * q) / 100), "formula_misuse", "다른 집단의 칸에 퍼센트를 적용했다."), W(c21 + Math.round(c22 * (1 - q / 100)), "sign_error", "남는 비율로 계산했다."), W(c21 + Math.round((s.r2 * q) / 100), "formula_misuse", "집단 합계에 퍼센트를 적용했다."), W(c21, "step_missing", "처음 응답자 수를 답했다.")],
          verificationJs: figJs({ q }, s.fig, `${TW_JS}return c21 + c22 * P.q / 100;`),
          trace: [readTw(s), [`${t.r2} 중 응답한 칸은 ${c21}, 응답하지 않은 칸은 ${c22} 이다.`, "Identify the two cells of the second group."], [`응답하지 않은 칸의 ${q}% = ${c22} × ${q}% = ${add} 이다.`, "Take the percent of the non-responding cell."], [`새로 응답하는 사람은 ${add} 명이다.`, "Newly responding people."], [`총 응답자 = ${c21} + ${add} = ${correct} 이다.`, "Add to the original responders."]] as [string, string][], variant: "cell_percent_then_add",
        }, s.fig);
      }
      throw new GenFail("cell.chain2");
    },
  },
  {
    op: "unit_ratio", structure: "표에서 집단별 응답 칸을 읽고 집단마다 다른 1인당 금액을 곱해 합산", extra: "표에서 두 응답 칸을 읽고 집단별 단가를 각각 곱해 합치는 단위 결합(행 합계가 아닌 응답 칸만 써야 함) — medium 은 한 집단의 총액",
    concepts: ["이원표 읽기", "집단별 단가", "가중 합"],
    gen(rng) {
      const s = makeTw(rng); const t = s.t; const u = rng.int(3, 12), v = rng.int(3, 12); if (u === v) throw new GenFail("same"); const [c11] = s.cells[0], [c21] = s.cells[1]; const correct = u * c11 + v * c21;
      return figInst(rng, {
        stimulus: `${intro(rng, s)} Each of the ${t.r1} who ${t.yp} paid ${u} dollars, and each of the ${t.r2} who ${t.yp} paid ${v} dollars.`,
        question: `What was the total amount, in dollars, paid by all of the ${t.ent} who ${t.yp}?`, correct,
        wrongs: [W(v * c11 + u * c21, "other", "단가를 서로 바꿔 곱했다."), W(u * s.r1 + v * s.r2, "condition_ignored", "응답한 칸이 아니라 행 합계에 곱했다."), W(u * c11, "step_missing", "한 집단만 계산했다."), W((u + v) * c11, "formula_misuse", "단가의 합에 한 칸만 곱했다."), W(u * c11 + v * s.cells[1][1], "other", "다른 응답 칸을 읽었다."), W(u * s.cells[0][1] + v * s.cells[1][1], "other", "응답하지 않은 칸을 읽었다.")],
        verificationJs: figJs({ u, v }, s.fig, `${TW_JS}return P.u * c11 + P.v * c21;`),
        trace: [readTw(s), [`${t.r1} 의 응답 칸은 ${c11} 이고 단가는 ${u} 이다.`, "First group's responders and rate."], [`${t.r2} 의 응답 칸은 ${c21} 이고 단가는 ${v} 이다.`, "Second group's responders and rate."], [`${u} × ${c11} = ${u * c11}, ${v} × ${c21} = ${v * c21} 이다.`, "Multiply each."], [`합계 = ${u * c11} + ${v * c21} = ${correct} 이다.`, "Add the two amounts."]] as [string, string][], variant: "weighted_total_of_responders",
      }, s.fig);
    },
  },
  {
    op: "compare_scenarios", structure: "표에서 두 집단의 응답 비율을 구하고, 한 집단에 응답자를 더 넣었을 때 비율이 처음 역전되는 최소 인원(임계)을 구함", extra: "두 비율의 대소 비교를 부등식으로 세우고 정수 경계(등호 불포함)를 올려 구하는 임계 비교 — medium 은 두 비율 비교",
    concepts: ["이원표 읽기", "두 비율 비교", "부등식의 정수 경계"],
    gen(rng) {
      for (let tr = 0; tr < 120; tr++) {
        const s = makeTw(rng); const [c11, c12] = s.cells[0], [c21] = s.cells[1]; if (!(c11 * s.r2 > c21 * s.r1)) continue; const num = c11 * s.r2 - c21 * s.r1; const k = Math.floor(num / c12) + 1; if (k < 2 || k > 50) continue;
        const t = s.t; const eqCase = num % c12 === 0;
        return figInst(rng, {
          stimulus: `${intro(rng, s)} Suppose some additional ${t.r2} respond to the survey, and every one of them ${t.yp}.`,
          question: `What is the least number of additional ${t.r2} needed so that the percent of ${t.r2} who ${t.yp} is greater than the percent of ${t.r1} who ${t.yp}?`, correct: k,
          wrongs: [W(Math.floor(num / c12), "condition_ignored", eqCase ? "등호가 되는 인원을 답했다(같지 않고 더 커야 한다)." : "내림만 했다."), W(k + 1, "other", "한 명 더 했다."), W(Math.max(1, k - 2), "other", "계산 중 어긋났다."), W(c11 - c21 > 0 ? c11 - c21 : k + 3, "formula_misuse", "두 칸의 차를 답했다."), W(Math.round(num / s.r1), "formula_misuse", "분모를 잘못 잡았다."), W(Math.ceil((c11 * s.r2) / s.r1 - c21), "step_missing", "분모가 늘어나는 것을 무시했다.")],
          verificationJs: figJs({}, s.fig, `${TW_JS}for (let k = 0; k <= 2000; k++) { if ((c21 + k) * r1 > c11 * (r2 + k)) return k; } throw new Error('해 없음');`),
          trace: [readTw(s), [`${t.r1} 의 비율은 ${c11}/${s.r1}, ${t.r2} 의 비율은 ${c21}/${s.r2} 이다.`, "Two current shares."], [`${t.r2} 에 k 명을 더하면 (${c21} + k)/(${s.r2} + k) 이다.`, "Add k to numerator and denominator."], [`(${c21} + k)·${s.r1} > ${c11}·(${s.r2} + k) 로 놓는다.`, "Write the strict inequality."], [`k(${s.r1} - ${c11}) > ${c11 * s.r2 - c21 * s.r1} 이므로 k > ${fmtNum(r1d(num / c12))} 이다.`, "Solve for k."], [`정수이고 등호는 안 되므로 최소 k = ${k} 이다.`, "Take the least integer strictly above the bound."]] as [string, string][], variant: "least_additional_to_overtake",
        }, s.fig);
      }
      throw new GenFail("cell.compare");
    },
  },
];
export const FIG_CELL_TW = build("cell", cellOps);

// ═════════════ row_total ═════════════
const rowOps: OpDef[] = [
  {
    op: "inverse", structure: "표의 두 행 합계를 읽고, 한 집단의 응답자를 x 명 더 받아 그 집단이 전체의 p% 가 되는 x 를 역산", extra: "표에서 행 합계와 전체를 읽고 분자·분모에 x 를 더하는 식으로 푸는 역산 — medium 은 행 합계 읽기",
    concepts: ["이원표 읽기", "행 합계와 전체", "비율 방정식"],
    gen(rng) {
      for (let tr = 0; tr < 80; tr++) {
        const s = makeTw(rng); const p = rng.pick([55, 60, 65, 70, 75, 80]); const num = p * s.N - 100 * s.r1; if (num <= 0 || num % (100 - p) !== 0) continue; const x = num / (100 - p); if (x < 2 || x > 60) continue; const t = s.t;
        return figInst(rng, {
          stimulus: `${intro(rng, s)} Suppose more ${t.r1} respond to the survey, with no change in the number of ${t.r2} responding.`,
          question: `How many additional ${t.r1} must respond for the ${t.r1} to make up exactly ${p}% of all the respondents?`, correct: x,
          wrongs: [W(Math.round((p * s.N) / 100 - s.r1), "formula_misuse", "전체도 늘어나는 것을 무시했다."), W(Math.round((p * s.r2) / (100 - p)) - 0, "formula_misuse", "다른 집단 기준으로 계산했다."), W(x + 3, "other", "계산 중 어긋났다."), W(Math.max(1, x - 3), "other", "계산 중 어긋났다."), W(Math.round(num / 100), "formula_misuse", "(100 − p) 로 나누지 않았다."), W(Math.round((p * s.N) / 100), "step_missing", "원래 인원을 빼지 않았다.")],
          verificationJs: figJs({ p }, s.fig, `${TW_JS}for (let x = 0; x <= 5000; x++) { if ((r1 + x) * 100 === P.p * (N + x)) return x; } throw new Error('해 없음');`),
          trace: [readTw(s), [`${t.r1} 의 합계는 ${s.r1}, 전체는 ${s.N} 이다.`, "Row total and grand total."], [`x 명 추가 시 (${s.r1} + x) ÷ (${s.N} + x) = ${p}% 이다.`, "Add x to the row and to the grand total."], [`100(${s.r1} + x) = ${p}(${s.N} + x) 로 교차곱한다.`, "Cross-multiply."], [`(100 - ${p})x = ${p}·${s.N} - 100·${s.r1} = ${num} 이다.`, "Collect the x terms."], [`x = ${x} 이다.`, "Solve for x."]] as [string, string][], variant: "additional_for_target_share_of_total",
        }, s.fig);
      }
      throw new GenFail("row.inverse");
    },
  },
  {
    op: "unit_ratio", structure: "표의 두 행 합계를 읽고 행마다 다른 1인당 금액(쿠폰)을 곱해 합산", extra: "표에서 행 합계(응답 칸이 아님)를 읽어 집단별 단가를 곱해 합치는 단위 결합 — medium 은 한 집단의 행 합계",
    concepts: ["이원표 읽기", "행 합계", "집단별 단가"],
    gen(rng) {
      const s = makeTw(rng); const t = s.t; const u = rng.int(2, 9), v = rng.int(2, 9); if (u === v) throw new GenFail("same"); const correct = u * s.r1 + v * s.r2;
      return figInst(rng, {
        stimulus: `${intro(rng, s)} Every one of the ${t.r1} surveyed received a coupon worth ${u} dollars, and every one of the ${t.r2} surveyed received a coupon worth ${v} dollars.`,
        question: `What is the total value, in dollars, of all the coupons given to the people surveyed?`, correct,
        wrongs: [W(v * s.r1 + u * s.r2, "other", "단가를 서로 바꿔 곱했다."), W(u * s.cells[0][0] + v * s.cells[1][0], "condition_ignored", "한 응답 칸만 사용했다."), W((u + v) * s.N, "formula_misuse", "단가의 합에 전체를 곱했다."), W(u * s.r1, "step_missing", "한 집단만 계산했다."), W(u * s.N, "formula_misuse", "한 단가를 전체에 곱했다."), W(correct + u, "other", "계산 중 어긋났다.")],
        verificationJs: figJs({ u, v }, s.fig, `${TW_JS}return P.u * r1 + P.v * r2;`),
        trace: [readTw(s), [`${t.r1} 의 합계는 ${s.cells[0][0]} + ${s.cells[0][1]} = ${s.r1} 이다.`, "First row total."], [`${t.r2} 의 합계는 ${s.cells[1][0]} + ${s.cells[1][1]} = ${s.r2} 이다.`, "Second row total."], [`${u} × ${s.r1} = ${u * s.r1}, ${v} × ${s.r2} = ${v * s.r2} 이다.`, "Multiply each total by its rate."], [`총액 = ${correct} 이다.`, "Add."]] as [string, string][], variant: "coupon_total_by_row",
      }, s.fig);
    },
  },
  {
    op: "constraint_select", structure: "표의 두 행 합계를 읽고 집단이 같은 버스에 타지 못할 때 필요한 최소 버스 수(올림)를 집단별로 구해 합산", extra: "행 합계를 읽어 집단마다 올림 나눗셈을 따로 적용하고 합쳐야 함(합친 인원으로 올림하면 틀림) — medium 은 한 집단의 올림",
    concepts: ["이원표 읽기", "행 합계", "올림 나눗셈(정수 제약)"],
    gen(rng) {
      const s = makeTw(rng); const t = s.t; const cap = rng.pick([12, 15, 18, 20, 24, 25, 30]); const a = Math.ceil(s.r1 / cap), b = Math.ceil(s.r2 / cap); const correct = a + b; const together = Math.ceil(s.N / cap); if (together === correct || s.r1 % cap === 0 || s.r2 % cap === 0) throw new GenFail("same");
      return figInst(rng, {
        stimulus: `${intro(rng, s)} All of the people surveyed will take a trip. Each bus holds ${cap} people, and the ${t.r1} and the ${t.r2} must ride in separate buses.`,
        question: `What is the minimum number of buses needed to carry everyone surveyed?`, correct,
        wrongs: [W(together, "condition_ignored", "두 집단이 따로 타야 한다는 조건을 무시했다."), W(Math.floor(s.r1 / cap) + Math.floor(s.r2 / cap), "step_missing", "올림하지 않고 내림했다."), W(correct + 1, "other", "한 대 더 계산했다."), W(Math.max(1, correct - 1), "other", "한 대 덜 계산했다."), W(Math.round(s.N / cap), "step_missing", "반올림했다."), W(a, "step_missing", "한 집단만 계산했다.")],
        verificationJs: figJs({ cap }, s.fig, `${TW_JS}return Math.ceil(r1 / P.cap) + Math.ceil(r2 / P.cap);`),
        trace: [readTw(s), [`${t.r1} 의 합계는 ${s.r1}, ${t.r2} 의 합계는 ${s.r2} 이다.`, "Row totals."], [`${t.r1}: ${s.r1} ÷ ${cap} = ${fmtNum(r1d(s.r1 / cap))} 이므로 버스 ${a} 대이다(올림).`, "Round up for the first group."], [`${t.r2}: ${s.r2} ÷ ${cap} = ${fmtNum(r1d(s.r2 / cap))} 이므로 버스 ${b} 대이다(올림).`, "Round up for the second group."], [`따로 타야 하므로 ${a} + ${b} = ${correct} 대이다.`, "Add the two counts."]] as [string, string][], variant: "buses_by_group_rounded_up",
      }, s.fig);
    },
  },
  {
    op: "compare_scenarios", structure: "표의 두 행 합계를 읽고 내년에 한 집단은 p% 증가·다른 집단은 q% 감소할 때 두 집단 인원의 차를 구함", extra: "행 합계를 읽어 서로 다른 방향의 퍼센트 변화를 각 집단에 적용한 뒤 비교 — medium 은 한 집단의 변화",
    concepts: ["이원표 읽기", "행 합계", "서로 다른 퍼센트 변화 비교"],
    gen(rng) {
      for (let tr = 0; tr < 80; tr++) {
        const s = makeTw(rng); const t = s.t; const p = rng.pick([10, 20, 25, 50]), q = rng.pick([10, 20, 25, 40, 50]); if ((s.r1 * p) % 100 !== 0 || (s.r2 * q) % 100 !== 0) continue; const n1 = s.r1 * (1 + p / 100), n2 = s.r2 * (1 - q / 100); const diff = Math.abs(n1 - n2); if (diff < 2) continue;
        return figInst(rng, {
          stimulus: `${intro(rng, s)} Next year, the number of ${t.r1} responding is expected to increase by ${p}%, and the number of ${t.r2} responding is expected to decrease by ${q}%.`,
          question: `Next year, what is the positive difference between the number of ${t.r1} and the number of ${t.r2} responding?`, correct: diff,
          wrongs: [W(Math.abs(s.r1 - s.r2), "step_missing", "변화를 적용하지 않은 차를 답했다."), W(Math.abs(s.r1 * (1 + p / 100) - s.r2 * (1 + q / 100)), "sign_error", "감소를 증가로 계산했다."), W(Math.abs(s.r1 * (1 - p / 100) - s.r2 * (1 + q / 100)), "sign_error", "증가·감소를 서로 바꿨다."), W(Math.abs(n1 - s.r2), "step_missing", "한 집단에만 변화를 적용했다."), W(Math.round(diff + (s.r1 * p) / 100), "other", "계산 중 어긋났다."), W(Math.abs(n1 + n2 - s.N), "formula_misuse", "합과 전체의 차를 답했다.")],
          verificationJs: figJs({ p, q }, s.fig, `${TW_JS}return Math.abs(r1 * (1 + P.p / 100) - r2 * (1 - P.q / 100));`),
          trace: [readTw(s), [`${t.r1} 의 합계 ${s.r1}, ${t.r2} 의 합계 ${s.r2} 이다.`, "Row totals."], [`${t.r1} 내년: ${s.r1} × ${1 + p / 100} = ${fmtNum(n1)} 이다.`, "Apply the increase."], [`${t.r2} 내년: ${s.r2} × ${1 - q / 100} = ${fmtNum(n2)} 이다.`, "Apply the decrease."], [`차 = |${fmtNum(n1)} - ${fmtNum(n2)}| = ${fmtNum(diff)} 이다.`, "Take the positive difference."]] as [string, string][], variant: "opposite_percent_changes",
        }, s.fig);
      }
      throw new GenFail("row.compare");
    },
  },
];
export const FIG_ROW_TW = build("row_total", rowOps);

// ═════════════ conditional_share ═════════════
const NICE_R = [20, 25, 40, 50, 60, 80, 100, 120, 200];
const NICE_P = [10, 20, 25, 30, 40, 50, 60, 75, 80];
const shareOps: OpDef[] = [
  {
    op: "chain2", structure: "표에서 한 집단의 응답 비율을 구하고, 같은 비율이 다른 곳의 같은 집단 M 명에 적용될 때의 인원을 구함", extra: "표에서 칸 ÷ 행 합계의 비율을 만든 뒤 새 모집단에 적용하는 2단 연쇄(기준이 전체가 아닌 행) — medium 은 비율만 구함",
    concepts: ["이원표 읽기", "조건부 비율", "비율의 적용"],
    gen(rng) {
      for (let tr = 0; tr < 80; tr++) {
        const s = makeTw(rng); const [c11] = s.cells[0]; const g = gcd(c11, s.r1); const den = s.r1 / g; if (den > 40) continue; const M = den * rng.int(2, Math.max(2, Math.floor(300 / den))); if (M < 40 || M > 400 || M === s.r1) continue; const correct = (c11 * M) / s.r1; if (!isInt(correct)) continue; const t = s.t;
        return figInst(rng, {
          stimulus: `${intro(rng, s)} At another site, there are ${M} ${t.r1}, and the same percent of them ${t.yp} as in the table.`,
          question: `How many of the ${M} ${t.r1} at the other site ${t.yp}?`, correct,
          wrongs: [W(Math.round((M * s.cy) / s.N), "condition_ignored", "집단이 아니라 전체 응답자의 비율을 적용했다."), W(Math.round((M * s.cells[1][0]) / s.r2), "other", "다른 집단의 비율을 적용했다."), W(Math.round((M * c11) / s.N), "formula_misuse", "분모를 전체로 잡았다."), W(c11, "step_missing", "표의 칸을 그대로 답했다."), W(correct + 2, "other", "계산 중 어긋났다."), W(Math.max(1, correct - 2), "other", "계산 중 어긋났다.")],
          verificationJs: figJs({ M }, s.fig, `${TW_JS}return c11 / r1 * P.M;`),
          trace: [readTw(s), [`${t.r1} 의 합계는 ${s.r1}, 응답 칸은 ${c11} 이다.`, "Row total and the cell."], [`비율 = ${c11} ÷ ${s.r1} 이다(전체가 아니라 그 집단 기준).`, "Form the conditional share."], [`같은 비율이 ${M} 명에 적용된다.`, "Apply it to the new group."], [`${c11}/${s.r1} × ${M} = ${correct} 이다.`, "Compute the count."]] as [string, string][], variant: "apply_row_share_elsewhere",
        }, s.fig);
      }
      throw new GenFail("share.chain2");
    },
  },
  {
    op: "compare_scenarios", structure: "표에서 두 집단의 응답 비율을 각각 구해 그 차(퍼센트포인트)를 구함", extra: "기준 모집단이 서로 다른 두 조건부 비율을 만들어 퍼센트포인트 차로 비교(인원수의 차와 구별) — medium 은 한 집단의 비율",
    concepts: ["이원표 읽기", "두 조건부 비율", "퍼센트포인트 차"],
    gen(rng) {
      const t = rng.pick(TW_TOPICS); const r1 = rng.pick(NICE_R), r2 = rng.pick(NICE_R); const p = rng.pick(NICE_P), q = rng.pick(NICE_P); if (p === q || r1 === r2) throw new GenFail("same"); const c11 = (r1 * p) / 100, c21 = (r2 * q) / 100; if (!isInt(c11) || !isInt(c21)) throw new GenFail("int");
      const cells = [[c11, r1 - c11], [c21, r2 - c21]]; const fig = twFig(t, cells); const s: TwScene = { t, cells, fig, r1, r2, cy: c11 + c21, cn: r1 - c11 + r2 - c21, N: r1 + r2 }; const correct = Math.abs(p - q);
      return figInst(rng, {
        stimulus: intro(rng, s),
        question: spin(rng, `[[By how many percentage points does the percent of ${t.r1} who ${t.yp} differ from the percent of ${t.r2} who ${t.yp}?|What is the positive difference, in percentage points, between the percent of ${t.r1} who ${t.yp} and the percent of ${t.r2} who ${t.yp}?]]`), correct,
        wrongs: [W(Math.abs(c11 - c21), "unit_error", "비율이 아니라 인원수의 차를 답했다."), W(Math.round(Math.abs((c11 * 100) / (r1 + r2) - (c21 * 100) / (r1 + r2))), "formula_misuse", "두 행의 합을 공통 분모로 썼다."), W(p + q, "formula_misuse", "두 비율을 더했다."), W(Math.abs(r1 - r2), "other", "행 합계의 차를 답했다."), W(correct + 5, "other", "계산 중 어긋났다."), W(Math.max(1, correct - 5), "other", "계산 중 어긋났다.")],
        verificationJs: figJs({}, fig, `${TW_JS}return Math.abs(c11 * 100 / r1 - c21 * 100 / r2);`),
        trace: [readTw(s), [`${t.r1} 의 비율 = ${c11} ÷ ${r1} × 100 = ${p}% 이다.`, "First conditional percent."], [`${t.r2} 의 비율 = ${c21} ÷ ${r2} × 100 = ${q}% 이다.`, "Second conditional percent."], [`기준이 각각 ${r1} 과 ${r2} 로 달라 인원수를 바로 비교하면 안 된다.`, "The bases differ, so counts are not comparable."], [`차 = |${p} - ${q}| = ${correct} 퍼센트포인트이다.`, "Take the difference of the percents."]] as [string, string][], variant: "percentage_point_gap",
      }, fig);
    },
  },
  {
    op: "inverse", structure: "표에서 두 집단의 응답 비율을 구하고, 응답하지 않은 집단 일부가 응답을 바꿔 두 비율이 같아지게 하는 인원을 역산", extra: "비교 대상 비율을 목표값으로 삼아 한 집단의 응답 칸을 몇 명 늘려야 같아지는지 거꾸로 푸는 역산(분모는 고정) — medium 은 두 비율 비교",
    concepts: ["이원표 읽기", "두 조건부 비율", "목표 비율 역산"],
    gen(rng) {
      for (let tr = 0; tr < 120; tr++) {
        const t = rng.pick(TW_TOPICS); const r1 = rng.int(20, 80), c11 = rng.int(8, r1 - 6); const g = gcd(c11, r1); const den = r1 / g, a = c11 / g; const k = rng.int(2, 8); const r2 = den * k; if (r2 < 20 || r2 > 140) continue; const target = a * k; const x = rng.int(2, 15); const c21 = target - x; if (c21 < 4 || r2 - c21 < x + 4) continue;
        const cells = [[c11, r1 - c11], [c21, r2 - c21]]; const fig = twFig(t, cells); const s: TwScene = { t, cells, fig, r1, r2, cy: c11 + c21, cn: 0, N: r1 + r2 };
        return figInst(rng, {
          stimulus: `${intro(rng, s)} Suppose some of the ${t.r2} who ${notYv(s)} change their minds and ${t.yv}.`,
          question: `How many of them must change their minds so that the percent of ${t.r2} who ${t.yp} equals the percent of ${t.r1} who ${t.yp}?`, correct: x,
          wrongs: [W(target, "step_missing", "목표 칸의 값을 답했다(원래 칸을 빼지 않았다)."), W(Math.abs(c11 - c21), "formula_misuse", "두 집단의 응답 칸의 차를 답했다."), W(x + 2, "other", "계산 중 어긋났다."), W(Math.max(1, x - 2), "other", "계산 중 어긋났다."), W(Math.round(r2 * (c11 / r1)) - 0 === x ? x + 3 : Math.round((c11 * r2) / r1 / 2), "formula_misuse", "비율을 잘못 적용했다."), W(r1 - c11 - (r2 - c21), "other", "응답하지 않은 칸의 차를 답했다.")],
          verificationJs: figJs({}, fig, `${TW_JS}for (let x = 0; x <= c22; x++) { if ((c21 + x) * r1 === c11 * r2) return x; } throw new Error('해 없음');`),
          trace: [readTw(s), [`${t.r1} 의 비율은 ${c11}/${r1} = ${a}/${den} 이다.`, "Target share from the first row."], [`${t.r2} 의 합계는 ${r2} 이므로 같은 비율이면 응답 칸은 ${r2} × ${a}/${den} = ${target} 이다.`, "Required cell for the second row."], [`지금 응답 칸은 ${c21} 이다.`, "Current cell."], [`필요한 증가 = ${target} - ${c21} = ${x} 이다.`, "Difference to reach the target."]] as [string, string][], variant: "equalize_shares",
        }, fig);
      }
      throw new GenFail("share.inverse");
    },
  },
  {
    op: "compose_kind", structure: "표에서 응답한 사람 전체(열 합계) 중 한 집단의 비중을 확률로 구함(조건부 확률로 합성)", extra: "이원표의 열 합계를 기준으로 하는 조건부 확률(기준이 행이 아니라 열)로 합성 — medium 은 확률의 분자 읽기",
    concepts: ["이원표 읽기", "열 합계", "조건부 확률"],
    gen(rng) {
      const s = makeTw(rng); const t = s.t; const [c11] = s.cells[0], [c21] = s.cells[1]; const cy = c11 + c21; const correct = frac(c11, cy);
      const cands = [frac(c11, s.N), frac(c11, s.r1), frac(c21, cy), frac(cy, s.N), frac(s.r1, s.N), frac(c11, s.cn + c11), frac(s.cells[0][1], s.cn)];
      return figInst(rng, {
        stimulus: `${intro(rng, s)} One person is chosen at random from the ${t.ent} who ${t.yp}.`,
        question: spin(rng, `[[What is the probability that the person chosen is one of the ${t.r1}?|The person chosen is one of the ${t.r1} with what probability?]]`), correctText: correct, range: [0, 1],
        wrongTexts: cands.map((c) => ({ text: c, kind: "formula_misuse" as const, reason: "기준(분모)을 열 합계가 아닌 다른 합계로 잡았다." })),
        verificationJs: figJs({}, s.fig, `${TW_JS}return c11 / cy;`),
        trace: [readTw(s), [`응답한 사람의 열 합계는 ${c11} + ${c21} = ${cy} 이다.`, "Column total of those who responded."], [`그중 ${t.r1} 는 ${c11} 명이다.`, "Favorable count."], [`확률 = ${c11} / ${cy} 이다(분모는 행 합계나 전체가 아니라 열 합계).`, "The denominator is the column total."], [`기약분수로 나타내면 ${correct} 이다.`, "Reduce the fraction."]] as [string, string][], variant: "probability_in_column",
      }, s.fig);
    },
  },
];
export const FIG_SHARE_TW = build("conditional_share", shareOps);

export const FIG_TABLE_HARD: Archetype[] = [...FIG_CELL_TW, ...FIG_ROW_TW, ...FIG_SHARE_TW];
export { cap1, oneDec };
