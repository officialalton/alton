// two_variable_data — 선택지가 그림(figure_choice)인 원형 4항목 + 서술 선지(연관 방향·강도) 지문형 2항목.
//  C 항목: conditional_share(이원표 4개 중 고르기), scatter_equation(추세선 산점도 4개 중), scatter_count_above(추세선 위 점 수 산점도 4개 중), association_direction_strength(산점도 4개 중)
//  P 항목: association_direction_strength(산점도 하나를 보고 서술 선지)
// 정답 판정은 verification_js 의 predicate 가 CHOICES(그림 데이터)만 읽어 계산한다. 오답 3개는 부록 C 의 오답 규칙(TBn·Ln·CTn·Dn)으로 만들고, 일반 선택지 검증기(figure-verify.checkChoiceInstance)가 규칙대로인지 다시 진단한다.
import { GenFail, type Archetype, type Instance, type OperatorId } from "../types";
import type { Rng } from "../rng";
import { gcd } from "../rng";
import { fmtNum, spin } from "../text";
import {
  ABCD, choiceJs, figJs, mean, oneDec, ols, pearson, placeChoices, planeScatter, r1d, twFig, withFigure, cap1, SE_TOPICS, TW_TOPICS, type TwScene,
} from "../figure-kit";
import type { SeTopic, TwTopic } from "../figure-topics";
import type { ChoiceDecl } from "../types";
import { titleWith } from "./fig/axis-title";

const SKILL = "two_variable_data";
const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const isInt = Number.isInteger;
const sing = (u: string) => u.replace(/s$/, "");

type COp = { op: OperatorId; structure: string; extra: string; concepts: string[]; gen: (rng: Rng) => Instance };
function buildC(kind: string, fig: string, loc: "C" | "P", ops: COp[], capable: boolean, reason: string, mediumSteps = 3): Archetype[] {
  return ops.map((o) => ({
    id: `tvd.${kind}.${fig}.${loc}.${o.op}`, skill: SKILL, kind: `${kind}.${fig}.${loc}`, operator: o.op, structure: o.structure, extraThinking: o.extra, concepts: o.concepts, mediumSteps,
    figureItem: `two_variable_data.${kind}.${fig}.${loc}`, spr: { capable, reason }, generate: (rng) => o.gen(rng),
  }));
}
const SPR_NO_CHOICE = "정답이 선택지(그림 4개 중 하나)를 고르는 것이 문제의 핵심이라 선택지 없이는 성립하지 않는다";
const SPR_NO_QUAL = "정답이 서술 선지(연관의 방향·강도 판단)이고 숫자 값이 아니라서 단답으로 낼 수 없다";

/** 선택지형 인스턴스 조립: options A~D, answerKind index, verificationJs 는 CHOICES 를 읽어 정답 번호를 return. */
export function choiceInst(rng: Rng, o: { stimulus: string; question: string; choices: unknown[]; correctIndex: number; rules: string[]; P: Record<string, number | string>; predicateJs: string; diagnoseJs: string; trace: [string, string][]; variant: string; explainKo: string; explainEn: string }): Instance {
  const decl: ChoiceDecl = { rules: o.rules, diagnoseJs: o.diagnoseJs, params: o.P };
  const body = `const pred = (c, i) => { ${o.predicateJs} };\nconst hits = CHOICES.map(pred); const idx = hits.reduce((a, h, i) => (h ? [...a, i] : a), []);\nif (idx.length !== 1) throw new Error('정답 선택지가 ' + idx.length + '개');\nreturn idx[0];`;
  const letter = ABCD[o.correctIndex];
  return {
    stimulus: o.stimulus, question: o.question, options: [...ABCD], correctIndex: o.correctIndex, answerKind: "index",
    explanation: `${o.trace.map(([ko], i) => `(${i + 1}) ${ko}`).join(" ")} 따라서 정답은 ${letter}이다.`, explanationEn: `${o.trace.map(([, en], i) => `(${i + 1}) ${en}`).join(" ")} So the answer is ${letter}.`,
    verificationJs: choiceJs(o.P as Record<string, number | string>, o.choices, body), trace: o.trace.map(([ko]) => ko), variant: o.variant,
    distractors: o.rules.map((r, i) => ({ r, i })).filter(({ i }) => i !== o.correctIndex).map(({ r, i }) => ({ index: i, kind: "other" as const, reason: `오답 규칙 ${r}` })),
    figure: { type: "figure_choice", choices: o.choices }, choice: decl,
  };
}

// ═════════════ conditional_share · 이원표 선택지형 ═════════════
type Cells = number[][];
export const twRulesDiag = `const a = c.cells, o = ok.cells; const eq = (x, y) => JSON.stringify(x) === JSON.stringify(y);
if (eq(a, [o[1], o[0]])) return "TB1_swap_rows";
if (eq(a, [[o[0][1], o[0][0]], [o[1][1], o[1][0]]])) return "TB4_swap_cols";
const diff = []; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) if (a[i][j] !== o[i][j]) diff.push([i, j]);
const rs = (m) => m.map((r) => r[0] + r[1]);
if (eq(rs(a), rs(o)) && diff.length === 2) return "TB3_transfer";
if (diff.length === 1) return "TB2_single_cell";
return null;`;
/** 표 오답 후보: 규칙 id → 칸 행렬(적용 불가면 null). */
function twWrong(rng: Rng, ok: Cells): { rule: string; cells: Cells }[] {
  const cl = (m: Cells) => m.map((r) => [...r]);
  const out: { rule: string; cells: Cells }[] = [];
  out.push({ rule: "TB1_swap_rows", cells: [cl([ok[1]])[0], cl([ok[0]])[0]] });
  out.push({ rule: "TB4_swap_cols", cells: [[ok[0][1], ok[0][0]], [ok[1][1], ok[1][0]]] });
  const m3 = cl(ok), i3 = rng.int(0, 1), d3 = rng.int(3, 9), dir = rng.chance(0.5);
  if (dir) { m3[i3][0] += d3; m3[i3][1] -= d3; } else { m3[i3][0] -= d3; m3[i3][1] += d3; }
  out.push({ rule: "TB3_transfer", cells: m3 });
  const m2 = cl(ok), i2 = rng.int(0, 1), j2 = rng.int(0, 1), d2 = rng.int(3, 12) * (rng.chance(0.5) ? 1 : -1); m2[i2][j2] += d2; out.push({ rule: "TB2_single_cell", cells: m2 });
  return out.filter((w) => w.cells.every((r) => r.every((v) => v >= 1)));
}
/** twRulesDiag 와 같은 순서·같은 판정의 TS 버전 — 후보를 만든 규칙이 아니라 '진단되는 규칙'으로 라벨한다(대칭 표에서 두 규칙이 같은 표를 만들 수 있다). */
export function diagTw(a: Cells, o: Cells): string | null {
  const eq = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y);
  if (eq(a, [o[1], o[0]])) return "TB1_swap_rows";
  if (eq(a, [[o[0][1], o[0][0]], [o[1][1], o[1][0]]])) return "TB4_swap_cols";
  const diff: number[][] = []; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) if (a[i][j] !== o[i][j]) diff.push([i, j]);
  const rs = (m: Cells) => m.map((r) => r[0] + r[1]);
  if (eq(rs(a), rs(o)) && diff.length === 2) return "TB3_transfer";
  if (diff.length === 1) return "TB2_single_cell";
  return null;
}
export function twChoices(rng: Rng, t: TwTopic, ok: Cells, test: (c: Cells) => boolean) {
  const cand = rng.shuffle(twWrong(rng, ok)).filter((w) => JSON.stringify(w.cells) !== JSON.stringify(ok) && !test(w.cells));
  const seen = new Set<string>([JSON.stringify(ok)]); const rulesSeen = new Set<string>(); const picked: { fig: unknown; rule: string }[] = [];
  for (const w of cand) { if (picked.length >= 3) break; const k = JSON.stringify(w.cells); const rule = diagTw(w.cells, ok); if (seen.has(k) || !rule || rulesSeen.has(rule)) continue; seen.add(k); rulesSeen.add(rule); picked.push({ fig: twFig(t, w.cells), rule }); }
  if (picked.length < 3) throw new GenFail("표 오답 후보 부족");
  return placeChoices(rng, twFig(t, ok), picked);
}
export const twIntro = (t: TwTopic) => `The responses of ${t.ent} ${t.where} are organized by ${t.rowHeader.toLowerCase()}.`;
export const TWC_PRED = (cond: string) => `const a = c.cells; const r1 = a[0][0] + a[0][1], r2 = a[1][0] + a[1][1], N = r1 + r2, c11 = a[0][0], c12 = a[0][1], c21 = a[1][0], c22 = a[1][1]; return ${cond};`;

const twcOps: COp[] = [
  {
    op: "inverse", structure: "집단별 인원과 집단별 응답 비율(%)을 서술로 주고 그 조건을 만족하는 이원표를 4개 중에서 고름", extra: "비율 두 개를 각 집단의 칸으로 역산(칸 = 비율 × 그 집단 인원)해 표 네 개를 검사해야 함 — medium 은 비율 하나로 표 고르기",
    concepts: ["이원표 만들기(역산)", "조건부 비율", "표 비교"],
    gen(rng) {
      const t = rng.pick(TW_TOPICS); const r1 = rng.pick([20, 25, 40, 50, 60, 80, 100]), r2 = rng.pick([20, 25, 40, 50, 60, 80, 100]); const p = rng.pick([10, 20, 25, 30, 40, 50, 60, 75, 80]), q = rng.pick([10, 20, 25, 30, 40, 50, 60, 75, 80]); if (p === q || (r1 === r2)) throw new GenFail("same");
      const c11 = (r1 * p) / 100, c21 = (r2 * q) / 100; if (!isInt(c11) || !isInt(c21)) throw new GenFail("int"); const ok: Cells = [[c11, r1 - c11], [c21, r2 - c21]];
      const test = (c: Cells) => c[0][0] + c[0][1] === r1 && c[1][0] + c[1][1] === r2 && c[0][0] * 100 === p * r1 && c[1][0] * 100 === q * r2;
      const { choices, correctIndex, rules } = twChoices(rng, t, ok, test);
      return choiceInst(rng, {
        stimulus: `${twIntro(t)} There were ${r1} ${t.r1} and ${r2} ${t.r2}. Of the ${t.r1}, ${p}% ${t.yp}, and of the ${t.r2}, ${q}% ${t.yp}.`,
        question: spin(rng, `[[Which table shows the results of this survey?|Which of the following tables matches the results described?]]`), choices, correctIndex, rules, P: { r1, r2, p, q },
        predicateJs: TWC_PRED("r1 === P.r1 && r2 === P.r2 && c11 * 100 === P.p * r1 && c21 * 100 === P.q * r2"), diagnoseJs: twRulesDiag,
        trace: [[`${t.r1} 는 ${r1} 명이고 ${p}% 가 응답했으므로 응답 칸은 ${r1} × ${p}% = ${c11} 이다.`, `First row: ${p}% of ${r1}.`], [`${t.r2} 는 ${r2} 명이고 ${q}% 가 응답했으므로 응답 칸은 ${c21} 이다.`, "Second row's cell."], [`각 행의 나머지 칸은 합계에서 뺀 ${r1 - c11}, ${r2 - c21} 이다.`, "Fill the remaining cells from the row totals."], [`네 표를 이 칸 값과 행 합계에 대어 본다.`, "Test each table against the cells and totals."], [`행을 바꾼 표나 응답·비응답 열을 바꾼 표는 비율이 맞지 않는다.`, "Swapped rows or columns break the percents."]] as [string, string][], variant: "table_from_row_totals_and_percents", explainKo: "", explainEn: "",
      });
    },
  },
  {
    op: "chain2", structure: "전체 인원의 비율로 집단 인원, 그 집단 안의 비율로 칸, 다른 집단의 칸 수를 서술로 주고 표를 4개 중에서 고름", extra: "전체 → 집단 인원(퍼센트) → 칸(조건부 퍼센트)의 연쇄로 표를 완성해 네 표와 대조 — medium 은 한 단계",
    concepts: ["이원표 만들기", "퍼센트의 연쇄", "표 비교"],
    gen(rng) {
      const t = rng.pick(TW_TOPICS); const N = rng.pick([100, 120, 150, 200, 240, 250]); const p = rng.pick([20, 25, 30, 40, 50, 60, 75]); const q = rng.pick([20, 25, 40, 50, 60, 75]); const r1 = (N * p) / 100, c11 = (r1 * q) / 100; if (!isInt(r1) || !isInt(c11)) throw new GenFail("int");
      const r2 = N - r1; const z = rng.int(6, Math.max(7, r2 - 6)); const ok: Cells = [[c11, r1 - c11], [z, r2 - z]]; if (z >= r2 || c11 < 4 || r1 - c11 < 4) throw new GenFail("range");
      const test = (c: Cells) => c[0][0] + c[0][1] + c[1][0] + c[1][1] === N && (c[0][0] + c[0][1]) * 100 === p * N && c[0][0] * 100 === q * (c[0][0] + c[0][1]) && c[1][0] === z;
      const { choices, correctIndex, rules } = twChoices(rng, t, ok, test);
      return choiceInst(rng, {
        stimulus: `${twIntro(t)} Of ${N} ${t.ent} surveyed, ${p}% were ${t.r1} and the rest were ${t.r2}. Of the ${t.r1}, ${q}% ${t.yp}, and ${z} of the ${t.r2} ${t.yp}.`,
        question: `Which table shows the results of this survey?`, choices, correctIndex, rules, P: { N, p, q, z },
        predicateJs: TWC_PRED("N === P.N && r1 * 100 === P.p * N && c11 * 100 === P.q * r1 && c21 === P.z"), diagnoseJs: twRulesDiag,
        trace: [[`${t.r1} 는 ${N} 의 ${p}% = ${r1} 명, ${t.r2} 는 ${r2} 명이다.`, "Row totals from the overall percent."], [`${t.r1} 중 응답 칸은 ${r1} × ${q}% = ${c11} 이다.`, "First cell from the conditional percent."], [`${t.r2} 의 응답 칸은 ${z} 이다.`, "Second row's cell is given."], [`나머지 칸은 ${r1 - c11} 과 ${r2 - z} 이다.`, "Remaining cells."], [`이 네 칸과 일치하는 표를 고른다.`, "Match the table."]] as [string, string][], variant: "table_from_chained_percents", explainKo: "", explainEn: "",
      });
    },
  },
  {
    op: "repr_shift", structure: "집단 인원과 '한 집단의 응답자 수가 다른 집단의 k 배'라는 관계 문장을 칸의 식으로 번역해 표를 4개 중에서 고름", extra: "배수 관계 문장을 칸의 방정식으로 번역(응답 칸 = k × 응답 칸)하고 인원 제약과 함께 표를 검사 — medium 은 인원만으로 표 고르기",
    concepts: ["이원표 만들기", "문장→칸 방정식", "표 비교"],
    gen(rng) {
      const t = rng.pick(TW_TOPICS); const r1 = rng.int(30, 80), r2 = rng.int(40, 110); const k = rng.pick([2, 3]); const c11 = rng.int(6, Math.min(r1 - 6, Math.floor((r2 - 6) / k))); const z = r1 - c11; const c21 = k * c11; if (c21 >= r2 - 3 || c21 < 6) throw new GenFail("range");
      const ok: Cells = [[c11, z], [c21, r2 - c21]];
      const test = (c: Cells) => c[0][0] + c[0][1] === r1 && c[1][0] + c[1][1] === r2 && c[0][1] === z && c[1][0] === k * c[0][0];
      const { choices, correctIndex, rules } = twChoices(rng, t, ok, test); const kw = k === 2 ? "twice" : "three times";
      return choiceInst(rng, {
        stimulus: `${twIntro(t)} There were ${r1} ${t.r1} and ${r2} ${t.r2}. The number of ${t.r2} who ${t.yp} was ${kw} the number of ${t.r1} who ${t.yp}, and ${z} of the ${t.r1} did not ${t.yv}.`,
        question: `Which table shows the results of this survey?`, choices, correctIndex, rules, P: { r1, r2, k, z },
        predicateJs: TWC_PRED("r1 === P.r1 && r2 === P.r2 && c12 === P.z && c21 === P.k * c11"), diagnoseJs: twRulesDiag,
        trace: [[`${t.r1} 중 응답하지 않은 칸이 ${z} 이므로 응답 칸은 ${r1} - ${z} = ${c11} 이다.`, "First row's responders from its total."], [`${t.r2} 의 응답 칸은 ${c11} 의 ${k} 배 = ${c21} 이다.`, "Translate the multiple relation."], [`${t.r2} 의 나머지 칸은 ${r2} - ${c21} = ${r2 - c21} 이다.`, "Remaining cell."], [`네 표의 칸과 합계를 이 값에 대어 본다.`, "Test the four tables."], [`관계식(${k} 배)을 만족하는 표는 하나뿐이다.`, "Only one table satisfies the relation."]] as [string, string][], variant: "table_from_multiple_relation", explainKo: "", explainEn: "",
      });
    },
  },
  {
    op: "compare_scenarios", structure: "전체·한 집단 인원·응답자 총수와 '한 집단의 응답 비율이 다른 집단보다 d 퍼센트포인트 높다'는 조건으로 표를 4개 중에서 고름", extra: "두 조건부 비율의 퍼센트포인트 차와 열 합계 조건을 함께 만족하는 칸을 찾아 네 표를 비교 — medium 은 한 조건",
    concepts: ["이원표 만들기", "퍼센트포인트 차", "열 합계 조건"],
    gen(rng) {
      const t = rng.pick(TW_TOPICS); const r1 = rng.pick([20, 25, 40, 50, 60, 80, 100]), r2 = rng.pick([20, 25, 40, 50, 60, 80, 100]); const p = rng.pick([30, 40, 50, 60, 75, 80]), q = rng.pick([10, 20, 25, 30, 40, 50]); if (p <= q) throw new GenFail("order"); const c11 = (r1 * p) / 100, c21 = (r2 * q) / 100; if (!isInt(c11) || !isInt(c21)) throw new GenFail("int");
      const ok: Cells = [[c11, r1 - c11], [c21, r2 - c21]]; const N = r1 + r2, d = p - q, cy = c11 + c21;
      const test = (c: Cells) => { const a = c[0][0] + c[0][1], b = c[1][0] + c[1][1]; return a === r1 && a + b === N && c[0][0] + c[1][0] === cy && 100 * c[0][0] * b - 100 * c[1][0] * a === d * a * b; };
      const { choices, correctIndex, rules } = twChoices(rng, t, ok, test);
      return choiceInst(rng, {
        stimulus: `${twIntro(t)} A total of ${N} ${t.ent} were surveyed, and ${r1} of them were ${t.r1}. In all, ${cy} of the ${t.ent} ${t.yp}. The percent of ${t.r1} who ${t.yp} was ${d} percentage points greater than the percent of ${t.r2} who ${t.yp}.`,
        question: `Which table shows the results of this survey?`, choices, correctIndex, rules, P: { N, r1, cy, d },
        predicateJs: TWC_PRED("r1 === P.r1 && N === P.N && c11 + c21 === P.cy && 100 * c11 * r2 - 100 * c21 * r1 === P.d * r1 * r2"), diagnoseJs: twRulesDiag,
        trace: [[`${t.r1} 는 ${r1} 명, ${t.r2} 는 ${N - r1} 명이다.`, "Row totals."], [`응답자 총수가 ${cy} 이므로 두 응답 칸의 합이 ${cy} 이어야 한다.`, "The responder column total is fixed."], [`${t.r1} 의 비율이 ${t.r2} 보다 ${d} 퍼센트포인트 높아야 한다.`, "The percentage-point gap condition."], [`가능한 칸은 ${c11} 과 ${c21} (비율 ${p}%, ${q}%)이다.`, "Solve for the two responder cells."], [`네 표를 세 조건에 모두 대어 본다.`, "Check all three conditions."]] as [string, string][], variant: "table_from_gap_and_total", explainKo: "", explainEn: "",
      });
    },
  },
];
export const FIG_SHARE_TWC = buildC("conditional_share", "TW", "C", twcOps, false, SPR_NO_CHOICE);

// ═════════════ scatter_equation · 추세선 산점도 선택지형 ═════════════
export const PX = 10; // 가로 격자 끝(figure-kit PLANE_X.max 와 같은 값 — 10)
export type Pt = [number, number];
function dotsAround(rng: Rng, m: number, b: number, S: number, n: number, yMax: number): Pt[] {
  for (let tr = 0; tr < 60; tr++) {
    const xs = rng.shuffle(Array.from({ length: PX - 1 }, (_, i) => i + 1)).slice(0, n - 1).concat([PX]).sort((p, q) => p - q);
    const rmin = Math.max(2, Math.ceil(0.25 * S)), rmax = Math.max(rmin + 1, Math.round(0.55 * S)); const pts: Pt[] = []; let ok = true;
    for (const x of xs) { const y = Math.round(m * x + b) + rng.int(rmin, rmax) * (rng.chance(0.5) ? 1 : -1); if (y < 1 || y > yMax - 1) { ok = false; break; } pts.push([x, y]); }
    if (ok) return pts;
  }
  throw new GenFail("점 생성 실패");
}
export const lineDiag = `const eps = 1e-9; const sc = (ch) => ch.objects.find((o) => o.kind === 'scatter').fitLine; const f = sc(c), g = sc(ok); const e = g.intercept + g.slope * 10;
const near = (x, y) => Math.abs(x - y) < eps;
if (near(f.slope, -g.slope) && near(f.intercept, g.intercept)) return "L1_slope_sign";
if (near(f.slope, -g.slope) && near(f.intercept, e)) return "L6_endpoints_swapped";
if (near(f.slope, g.slope) && !near(f.intercept, g.intercept)) return "L2_intercept_shift";
if (near(f.intercept, g.intercept) && (near(Math.abs(f.slope), 2 * Math.abs(g.slope)) || near(Math.abs(f.slope), Math.abs(g.slope) / 2))) return "L8_slope_scale";
return null;`;
export const SC_PRED = (cond: string) => `const f = c.objects.find((o) => o.kind === 'scatter').fitLine; const m = f.slope, b = f.intercept; return ${cond};`;
export type LineSpec = { S: number; yMax: number; k: number; j: number; m: number; b: number };
export function pickLine(rng: Rng, S: number, yMax: number, need?: (m: number, b: number) => boolean): LineSpec {
  for (let tr = 0; tr < 80; tr++) {
    const k = rng.nz(-4, 4), j = rng.int(1, 8); const m = (k * S) / PX, b = j * S, e = b + k * S; if (e < S || e > 8 * S || !oneDec(m)) continue; if (need && !need(m, b)) continue; return { S, yMax, k, j, m, b };
  }
  throw new GenFail("직선 표집 실패");
}
export function scChoices(rng: Rng, topic: SeTopic, ln: LineSpec, test: (m: number, b: number) => boolean) {
  const { S, yMax, m, b } = ln; const e = b + m * PX;
  const cands: { rule: string; m: number; b: number }[] = [
    { rule: "L1_slope_sign", m: -m, b }, { rule: "L6_endpoints_swapped", m: -m, b: e }, { rule: "L2_intercept_shift", m, b: b + S * rng.pick([-2, -1, 1, 2]) }, { rule: "L8_slope_scale", m: rng.chance(0.5) ? 2 * m : m / 2, b },
  ];
  const valid = rng.shuffle(cands).filter((c) => { const e2 = c.b + c.m * PX; return c.b >= S && c.b <= 8 * S && e2 >= S && e2 <= 8 * S && oneDec(c.m) && !test(c.m, c.b) && !(Math.abs(c.m - m) < 1e-9 && Math.abs(c.b - b) < 1e-9); });
  const wrong = valid.slice(0, 3); if (wrong.length < 3) throw new GenFail("선 오답 후보 부족");
  const mk = (mm: number, bb: number) => planeScatter(topic, S, yMax, dotsAround(rng, mm, bb, S, 8, yMax), { slope: mm, intercept: bb });
  return placeChoices(rng, mk(m, b), wrong.map((w) => ({ fig: mk(w.m, w.b), rule: w.rule })));
}
export const scTopicWords = (t: SeTopic) => `${t.x} and ${t.y}`;
const sceOps: COp[] = [
  {
    op: "repr_shift", structure: "추세선의 기울기와 x=0 의 예측값을 문장으로 주고 그 추세선이 그려진 산점도를 4개 중에서 고름", extra: "문장(기울기·절편)을 직선으로 번역해 네 그래프의 추세선과 대조(부호·절편 오류 구별) — medium 은 기울기 부호만 확인",
    concepts: ["문장→직선", "추세선의 기울기·절편", "그래프 비교"],
    gen(rng) {
      const t = rng.pick(SE_TOPICS); const S = rng.pick([5, 10, 20]); const yMax = 10 * S; const ln = pickLine(rng, S, yMax); const test = (m: number, b: number) => Math.abs(m - ln.m) < 1e-9 && Math.abs(b - ln.b) < 1e-9;
      const { choices, correctIndex, rules } = scChoices(rng, t, ln, test); const up = ln.m > 0;
      return choiceInst(rng, {
        stimulus: `Researchers studied ${scTopicWords(t)}. A line of best fit for the data predicts ${ln.b} ${t.yu} when ${lc(t.xa)} is 0, and the predicted value ${up ? "increases" : "decreases"} by ${fmtNum(Math.abs(ln.m))} ${t.yu} for each 1 ${sing(t.xu)} increase in ${lc(t.xa)}.`,
        question: `Which scatterplot shows a line of best fit that matches this description?`, choices, correctIndex, rules, P: { b: ln.b, m: ln.m },
        predicateJs: SC_PRED("Math.abs(m - P.m) < 1e-9 && Math.abs(b - P.b) < 1e-9"), diagnoseJs: lineDiag,
        trace: [[`x = 0 에서 ${ln.b} 이므로 y 절편은 ${ln.b} 이다.`, "Read the intercept from the description."], [`1 ${sing(t.xu)} 당 ${up ? "증가" : "감소"} ${fmtNum(Math.abs(ln.m))} 이므로 기울기는 ${fmtNum(ln.m)} 이다.`, "Read the slope with its sign."], [`직선은 y = ${fmtNum(ln.m)}x + ${ln.b} 이다.`, "Write the line."], [`네 그래프의 추세선이 (0, ${ln.b}) 를 지나는지, 기울기의 부호와 크기가 맞는지 대어 본다.`, "Test each graph's line."], [`부호가 반대이거나 절편·기울기 크기가 다른 선은 제외한다.`, "Eliminate lines with the wrong sign, intercept, or steepness."]] as [string, string][], variant: "line_from_slope_and_intercept", explainKo: "", explainEn: "",
      });
    },
  },
  {
    op: "chain2", structure: "추세선이 x1 과 x2 에서 낸 예측값 두 개를 주고 그 직선이 그려진 산점도를 4개 중에서 고름", extra: "두 예측값에서 기울기 → 절편을 차례로 구해 직선을 확정하고 네 그래프와 대조하는 연쇄 — medium 은 기울기만 확인",
    concepts: ["두 점의 기울기", "절편 계산", "그래프 비교"],
    gen(rng) {
      const t = rng.pick(SE_TOPICS); const S = rng.pick([5, 10, 20]); const yMax = 10 * S; const x1 = rng.pick([2, 4]), x2 = rng.pick([6, 8, 10]);
      const ln = pickLine(rng, S, yMax, (m, b) => oneDec(m * x1 + b) && oneDec(m * x2 + b)); const y1 = r1d(ln.m * x1 + ln.b), y2 = r1d(ln.m * x2 + ln.b); const test = (m: number, b: number) => Math.abs(m * x1 + b - y1) < 1e-9 && Math.abs(m * x2 + b - y2) < 1e-9;
      const { choices, correctIndex, rules } = scChoices(rng, t, ln, test);
      return choiceInst(rng, {
        stimulus: `Researchers studied ${scTopicWords(t)}. A line of best fit for the data predicts ${fmtNum(y1)} ${t.yu} when ${lc(t.xa)} is ${x1} ${t.xu} and predicts ${fmtNum(y2)} ${t.yu} when ${lc(t.xa)} is ${x2} ${t.xu}.`,
        question: `Which scatterplot shows this line of best fit?`, choices, correctIndex, rules, P: { x1, y1, x2, y2 },
        predicateJs: SC_PRED("Math.abs(m * P.x1 + b - P.y1) < 1e-9 && Math.abs(m * P.x2 + b - P.y2) < 1e-9"), diagnoseJs: lineDiag,
        trace: [[`기울기 m = (${fmtNum(y2)} - ${fmtNum(y1)}) ÷ (${x2} - ${x1}) = ${fmtNum(ln.m)} 이다.`, "Slope from the two predictions."], [`절편 b = ${fmtNum(y1)} - ${fmtNum(ln.m)}·${x1} = ${ln.b} 이다.`, "Intercept."], [`직선은 y = ${fmtNum(ln.m)}x + ${ln.b} 이다.`, "The line."], [`네 그래프의 추세선이 두 예측점을 모두 지나는지 대어 본다.`, "Test whether each line passes through both points."], [`한 점만 지나거나 기울기 부호가 다른 선은 제외한다.`, "Eliminate lines that miss one point or have the wrong sign."]] as [string, string][], variant: "line_from_two_predictions", explainKo: "", explainEn: "",
      });
    },
  },
  {
    op: "inverse", structure: "추세선의 기울기와 예측값이 0 이 되는 x 를 주고 그 직선이 그려진 산점도를 4개 중에서 고름", extra: "예측값이 0 이 되는 x(x 절편)와 기울기로부터 y 절편을 거꾸로 구해 네 그래프와 대조하는 역산 — medium 은 y 절편이 주어짐",
    concepts: ["x 절편과 기울기", "y 절편 역산", "그래프 비교"],
    gen(rng) {
      for (let tr = 0; tr < 80; tr++) {
        const t = rng.pick(SE_TOPICS); const S = rng.pick([5, 10, 20]); const yMax = 10 * S; const ln = pickLine(rng, S, yMax, (m) => m < 0); const xi = -ln.b / ln.m; if (!isInt(xi) || xi <= 0 || xi > 40) continue;
        const test = (m: number, b: number) => Math.abs(m - ln.m) < 1e-9 && Math.abs(b + m * xi) < 1e-9;
        const { choices, correctIndex, rules } = scChoices(rng, t, ln, test);
        return choiceInst(rng, {
          stimulus: `Researchers studied ${scTopicWords(t)}. A line of best fit for the data has a slope of ${fmtNum(ln.m)} and predicts a value of 0 ${t.yu} when ${lc(t.xa)} is ${xi} ${t.xu}.`,
          question: `Which scatterplot shows this line of best fit?`, choices, correctIndex, rules, P: { m: ln.m, xi },
          predicateJs: SC_PRED("Math.abs(m - P.m) < 1e-9 && Math.abs(b + m * P.xi) < 1e-9"), diagnoseJs: lineDiag,
          trace: [[`기울기는 ${fmtNum(ln.m)} 이다.`, "The slope is given."], [`x = ${xi} 에서 예측값이 0 이므로 0 = ${fmtNum(ln.m)}·${xi} + b 이다.`, "Use the x-intercept."], [`b = ${ln.b} 이다.`, "Solve for the y-intercept."], [`직선은 y = ${fmtNum(ln.m)}x + ${ln.b} 이다.`, "The line."], [`네 그래프의 추세선을 (0, ${ln.b}) 와 기울기 부호로 대어 본다.`, "Test each graph's line."]] as [string, string][], variant: "line_from_x_intercept_and_slope", explainKo: "", explainEn: "",
        });
      }
      throw new GenFail("sce.inverse");
    },
  },
  {
    op: "compare_scenarios", structure: "두 x 에서의 예측값의 차와 한 점의 예측값을 주고 그 직선이 그려진 산점도를 4개 중에서 고름", extra: "예측값의 차에서 기울기를 구하고 한 점으로 절편을 구해 직선을 확정(차 조건과 점 조건 결합)한 뒤 그래프를 비교 — medium 은 한 조건",
    concepts: ["예측값의 차와 기울기", "한 점으로 절편", "그래프 비교"],
    gen(rng) {
      const t = rng.pick(SE_TOPICS); const S = rng.pick([5, 10, 20]); const yMax = 10 * S; const x1 = rng.pick([1, 2, 3]), x2 = rng.pick([6, 8, 9]), x0 = rng.pick([4, 5]); const ln = pickLine(rng, S, yMax, (m, b) => oneDec(m * (x2 - x1)) && oneDec(m * x0 + b)); const T = r1d(Math.abs(ln.m * (x2 - x1))), y0 = r1d(ln.m * x0 + ln.b); const up = ln.m > 0;
      const test = (m: number, b: number) => Math.abs(m * (x2 - x1) - (up ? T : -T)) < 1e-9 && Math.abs(m * x0 + b - y0) < 1e-9;
      const { choices, correctIndex, rules } = scChoices(rng, t, ln, test);
      return choiceInst(rng, {
        stimulus: `Researchers studied ${scTopicWords(t)}. A line of best fit for the data predicts a value that is ${fmtNum(T)} ${t.yu} ${up ? "greater" : "less"} when ${lc(t.xa)} is ${x2} ${t.xu} than when it is ${x1} ${t.xu}, and it predicts ${fmtNum(y0)} ${t.yu} when ${lc(t.xa)} is ${x0} ${t.xu}.`,
        question: `Which scatterplot shows this line of best fit?`, choices, correctIndex, rules, P: { T, x1, x2, x0, y0, dir: up ? 1 : -1 },
        predicateJs: SC_PRED("Math.abs(m * (P.x2 - P.x1) - P.dir * P.T) < 1e-9 && Math.abs(m * P.x0 + b - P.y0) < 1e-9"), diagnoseJs: lineDiag,
        trace: [[`${x1} 에서 ${x2} 로 갈 때 예측값이 ${fmtNum(T)} ${up ? "증가" : "감소"}하므로 기울기 = ${up ? "" : "-"}${fmtNum(T)} ÷ ${x2 - x1} = ${fmtNum(ln.m)} 이다.`, "Slope from the difference in predictions."], [`x = ${x0} 에서 ${fmtNum(y0)} 이므로 ${fmtNum(y0)} = ${fmtNum(ln.m)}·${x0} + b 이다.`, "Use the single prediction."], [`b = ${ln.b} 이다.`, "Solve for the intercept."], [`직선은 y = ${fmtNum(ln.m)}x + ${ln.b} 이다.`, "The line."], [`네 그래프의 추세선을 이 직선에 대어 본다.`, "Test each graph's line."]] as [string, string][], variant: "line_from_difference_and_point", explainKo: "", explainEn: "",
      });
    },
  },
];
export const FIG_EQ_SCC = buildC("scatter_equation", "SC", "C", sceOps, false, SPR_NO_CHOICE);

// ═════════════ scatter_count_above · 추세선 위 점 수 산점도 선택지형 ═════════════
const ctDiag = `const cnt = (ch) => { const s = ch.objects.find((o) => o.kind === 'scatter'); return s.points.filter((p) => p[1] > s.fitLine.slope * p[0] + s.fitLine.intercept).length; };
const A = cnt(ok), k = cnt(c); const n = ok.objects.find((o) => o.kind === 'scatter').points.length;
if (k === n - A) return "CT1_complement";
if (k === A + 1) return "CT2_plus_one";
if (k === A - 1) return "CT3_minus_one";
if (k === 0 || k === n) return "CT4_all_one_side";
return null;`;
export function ctPlot(rng: Rng, topic: SeTopic, S: number, yMax: number, above: number) {
  const ln = pickLine(rng, S, yMax); const n = PX; const xs = Array.from({ length: n }, (_, i) => i + 1); const side = rng.shuffle(xs.map((_, i) => i < above)); const rmin = Math.max(3, Math.ceil(0.45 * S)), rmax = Math.max(rmin + 2, Math.round(0.7 * S)); // 4개를 한 화면에 작게 그리므로 점이 선에서 분명히 떨어져야 위·아래가 판독된다(시각 검수 지적)
  for (let tr = 0; tr < 30; tr++) {
    const pts: Pt[] = []; let ok = true;
    xs.forEach((x, i) => { const y = Math.round(ln.m * x + ln.b) + rng.int(rmin, rmax) * (side[i] ? 1 : -1); if (y < 1 || y > yMax - 1) ok = false; pts.push([x, y]); });
    if (ok) return planeScatter(topic, S, yMax, pts, { slope: ln.m, intercept: ln.b });
  }
  throw new GenFail("ct plot");
}
function ctChoices(rng: Rng, topic: SeTopic, S: number, yMax: number, A: number) {
  const n = PX; const diag = (k: number) => (k === n - A ? "CT1_complement" : k === A + 1 ? "CT2_plus_one" : k === A - 1 ? "CT3_minus_one" : k === 0 || k === n ? "CT4_all_one_side" : null);
  const cands = new Map<string, number>(); for (const k of [n - A, A + 1, A - 1, A >= 5 ? 0 : n]) { if (k < 0 || k > n || k === A) continue; const r = diag(k); if (r && !cands.has(r)) cands.set(r, k); }
  const wrong = rng.shuffle([...cands.entries()]).slice(0, 3); if (wrong.length < 3) throw new GenFail("ct 오답 부족");
  return placeChoices(rng, ctPlot(rng, topic, S, yMax, A), wrong.map(([rule, k]) => ({ fig: ctPlot(rng, topic, S, yMax, k), rule })));
}
export const CT_PRED = (cond: string) => `const s = c.objects.find((o) => o.kind === 'scatter'); const n = s.points.length; const above = s.points.filter((p) => p[1] > s.fitLine.slope * p[0] + s.fitLine.intercept).length; const below = n - above; return ${cond};`;
const ctOps: COp[] = [
  {
    op: "constraint_select", structure: "10개 점 중 추세선 위에 정확히 k 개가 있는 산점도를 4개 중에서 고름", extra: "네 그래프 각각에서 추세선 위 점을 세어 조건과 대조(보완 개수·한 개 차이를 걸러냄) — medium 은 한 그래프의 개수 세기",
    concepts: ["산점도 읽기", "추세선 위·아래 판정", "그래프 비교"],
    gen(rng) {
      const t = rng.pick(SE_TOPICS); const S = rng.pick([5, 10, 20]); const yMax = 10 * S; const k = rng.int(2, 8); const { choices, correctIndex, rules } = ctChoices(rng, t, S, yMax, k);
      return choiceInst(rng, {
        stimulus: `Each scatterplot shows ${scTopicWords(t)} for 10 data points, along with a line of best fit.`,
        question: `Which scatterplot has exactly ${k} of its data points above its line of best fit?`, choices, correctIndex, rules, P: { k },
        predicateJs: CT_PRED("above === P.k"), diagnoseJs: ctDiag,
        trace: [["각 그래프에서 추세선의 위치를 읽는다.", "Locate each graph's line of best fit."], ["각 그래프의 점 10개가 추세선보다 위인지 아래인지 판정한다.", "Judge each of the 10 points."], ["그래프마다 위쪽 점 수를 센다.", "Count the points above in each graph."], [`위쪽 점이 정확히 ${k} 개인 그래프를 찾는다.`, `Find the graph with exactly ${k}.`], [`위쪽과 아래쪽을 바꿔 센 그래프(${10 - k} 개)나 한 개 차이인 그래프와 구별한다.`, "Do not confuse above/below or off-by-one counts."]] as [string, string][], variant: "exactly_k_above", explainKo: "", explainEn: "",
      });
    },
  },
  {
    op: "compare_scenarios", structure: "추세선 위의 점이 아래의 점보다 정확히 d 개 많은 산점도를 4개 중에서 고름", extra: "위·아래 두 개수의 차를 네 그래프마다 구해 조건(차 = d)과 대조 — medium 은 위쪽 점 수만 세기",
    concepts: ["산점도 읽기", "위·아래 두 개수 비교", "그래프 비교"],
    gen(rng) {
      const t = rng.pick(SE_TOPICS); const S = rng.pick([5, 10, 20]); const yMax = 10 * S; const d = rng.pick([2, 4, 6]); const A = (10 + d) / 2; const { choices, correctIndex, rules } = ctChoices(rng, t, S, yMax, A);
      return choiceInst(rng, {
        stimulus: `Each scatterplot shows ${scTopicWords(t)} for 10 data points, along with a line of best fit.`,
        question: `Which scatterplot has exactly ${d} more data points above its line of best fit than below it?`, choices, correctIndex, rules, P: { d },
        predicateJs: CT_PRED("above - below === P.d"), diagnoseJs: ctDiag,
        trace: [["각 그래프에서 추세선의 위치를 읽는다.", "Locate each line."], ["점 10개를 위·아래로 나눠 센다.", "Split the 10 points into above and below."], [`위쪽을 a 라 하면 아래쪽은 10 - a 이므로 차는 2a - 10 이다.`, "Difference = a − (10 − a)."], [`2a - 10 = ${d} 이므로 a = ${A} 이다.`, "Solve for a."], [`위쪽 점이 ${A} 개인 그래프를 고른다.`, "Pick the graph with that many above."]] as [string, string][], variant: "above_exceeds_below_by_d", explainKo: "", explainEn: "",
      });
    },
  },
  {
    op: "inverse", structure: "10개 점 중 추세선 아래에 정확히 j 개가 있는 산점도를 4개 중에서 고름(아래 개수 → 위 개수 역산)", extra: "'아래 j 개' 조건을 위쪽 점 수로 거꾸로 바꿔(10 − j) 네 그래프와 대조 — medium 은 위쪽 개수 조건",
    concepts: ["산점도 읽기", "전체에서 보수 개수", "그래프 비교"],
    gen(rng) {
      const t = rng.pick(SE_TOPICS); const S = rng.pick([5, 10, 20]); const yMax = 10 * S; const j = rng.int(2, 8); const A = 10 - j; const { choices, correctIndex, rules } = ctChoices(rng, t, S, yMax, A);
      return choiceInst(rng, {
        stimulus: `Each scatterplot shows ${scTopicWords(t)} for 10 data points, along with a line of best fit.`,
        question: `Which scatterplot has exactly ${j} of its data points below its line of best fit?`, choices, correctIndex, rules, P: { j },
        predicateJs: CT_PRED("below === P.j"), diagnoseJs: ctDiag,
        trace: [["각 그래프에서 추세선의 위치를 읽는다.", "Locate each line."], ["점 10개를 위·아래로 판정한다.", "Judge the 10 points."], [`아래쪽이 ${j} 개이면 위쪽은 10 - ${j} = ${A} 개이다.`, "Convert below to above."], ["그래프마다 아래쪽 점 수를 센다.", "Count below in each graph."], [`아래쪽이 정확히 ${j} 개인 그래프를 고른다.`, "Pick the matching graph."]] as [string, string][], variant: "exactly_j_below", explainKo: "", explainEn: "",
      });
    },
  },
  {
    op: "unit_ratio", structure: "추세선 위의 점 수와 아래의 점 수의 비가 a : b 인 산점도를 4개 중에서 고름", extra: "비(a : b)와 전체 10개에서 위·아래 개수를 비례 배분(10a/(a+b))으로 구해 그래프와 대조 — medium 은 한 쪽 개수 조건",
    concepts: ["산점도 읽기", "비 → 개수 환산", "그래프 비교"],
    gen(rng) {
      const t = rng.pick(SE_TOPICS); const S = rng.pick([5, 10, 20]); const yMax = 10 * S; const [a, b] = rng.pick([[4, 1], [3, 2], [2, 3], [1, 4]] as [number, number][]); const A = (10 * a) / (a + b); const { choices, correctIndex, rules } = ctChoices(rng, t, S, yMax, A);
      return choiceInst(rng, {
        stimulus: `Each scatterplot shows ${scTopicWords(t)} for 10 data points, along with a line of best fit.`,
        question: `Which scatterplot has data points above its line of best fit and below it in the ratio ${a} to ${b}, respectively?`, choices, correctIndex, rules, P: { a, b },
        predicateJs: CT_PRED("above * P.b === below * P.a"), diagnoseJs: ctDiag,
        trace: [["각 그래프에서 추세선의 위치를 읽는다.", "Locate each line."], [`위 : 아래 = ${a} : ${b} 이고 합이 10 이므로 위쪽은 10 × ${a}/${a + b} = ${A} 개이다.`, "Convert the ratio to counts."], [`아래쪽은 ${10 - A} 개이다.`, "The below count."], ["그래프마다 위·아래 점 수를 센다.", "Count above and below in each graph."], [`위 ${A} 개·아래 ${10 - A} 개인 그래프를 고른다(비를 거꾸로 읽지 않는다).`, "Pick the matching graph; do not reverse the ratio."]] as [string, string][], variant: "above_below_ratio", explainKo: "", explainEn: "",
      });
    },
  },
];
export const FIG_CNT_SCC = buildC("scatter_count_above", "SC", "C", ctOps, false, SPR_NO_CHOICE);

// ═════════════ association_direction_strength ═════════════
export type AClass = "pos_strong" | "pos_moderate" | "pos_weak" | "neg_strong" | "neg_moderate" | "neg_weak" | "none";
const BANDS: Record<AClass, [number, number]> = { pos_strong: [0.92, 0.985], pos_moderate: [0.62, 0.78], pos_weak: [0.25, 0.4], neg_strong: [-0.985, -0.92], neg_moderate: [-0.78, -0.62], neg_weak: [-0.4, -0.25], none: [-0.07, 0.07] };
export const CLASS_JS = `const cls = (pts) => { const n = pts.length; const mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n; let sxy = 0, sxx = 0, syy = 0; for (const p of pts) { sxy += (p[0] - mx) * (p[1] - my); sxx += (p[0] - mx) ** 2; syy += (p[1] - my) ** 2; } const r = sxy / Math.sqrt(sxx * syy); const a = Math.abs(r); if (a < 0.15) return 'none'; return (r > 0 ? 'pos' : 'neg') + '_' + (a >= 0.85 ? 'strong' : a >= 0.5 ? 'moderate' : 'weak'); };\nconst rOf = (pts) => { const n = pts.length; const mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n; let sxy = 0, sxx = 0, syy = 0; for (const p of pts) { sxy += (p[0] - mx) * (p[1] - my); sxx += (p[0] - mx) ** 2; syy += (p[1] - my) ** 2; } return sxy / Math.sqrt(sxx * syy); };\n`;
export const classOfR = (r: number): AClass => { const a = Math.abs(r); if (a < 0.15) return "none"; return `${r > 0 ? "pos" : "neg"}_${a >= 0.85 ? "strong" : a >= 0.5 ? "moderate" : "weak"}` as AClass; };
const gauss = (rng: Rng) => Math.sqrt(-2 * Math.log(Math.max(1e-12, rng.next()))) * Math.cos(2 * Math.PI * rng.next());
/** 목표 부류의 자료 10점(x = 1..10, y 는 1..99 정수). 상관계수 r 이 부류 구간 안(경계에서 떨어진)에 들 때까지 표집한다. */
export function samplePts(rng: Rng, cls: AClass, o: { xs?: number[]; yLo?: number; yHi?: number } = {}): Pt[] {
  const xs = o.xs ?? Array.from({ length: 10 }, (_, i) => i + 1); const [lo, hi] = BANDS[cls];
  for (let tr = 0; tr < 600; tr++) {
    const dir = cls === "none" ? 0 : cls.startsWith("pos") ? 1 : -1; const a = rng.int(4, 9); const target = cls === "none" ? 0.05 : Math.abs((lo + hi) / 2); const sdx = Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)));
    const sigma = cls === "none" ? rng.int(14, 24) : a * sdx * Math.sqrt(1 / (target * target) - 1);
    const pts: Pt[] = xs.map((x) => [x, Math.round(50 + dir * a * (x - mean(xs)) + gauss(rng) * sigma)]);
    if (pts.some((p) => p[1] < 4 || p[1] > 96)) continue; if (new Set(pts.map((p) => p[1])).size < 6) continue;
    const r = pearson(pts); if (r >= lo && r <= hi) return pts;
  }
  throw new GenFail("부류 자료 표집 실패");
}
const dirWord = (c: AClass) => (c.startsWith("pos") ? "positive" : "negative");
const dirKo = (c: AClass) => (c.startsWith("pos") ? "양" : "음");
const strKo = (c: AClass) => ({ strong: "강한", moderate: "보통 세기의", weak: "약한" } as Record<string, string>)[c.split("_")[1]] ?? "";
const strWord = (c: AClass) => c.split("_")[1];
export const claimOf = (c: AClass) => (c === "none" ? "There is no clear linear association between the two variables." : `There is a ${strWord(c)} ${dirWord(c)} linear association between the two variables.`);
const ALL_CLASSES: AClass[] = ["pos_strong", "pos_moderate", "pos_weak", "neg_strong", "neg_moderate", "neg_weak", "none"];
const flip = (c: AClass): AClass => (c === "none" ? "none" : (c.startsWith("pos") ? c.replace("pos", "neg") : c.replace("neg", "pos")) as AClass);

// ── C: 산점도 4개 ──
const asDiag = `const rc = (ch) => cls(ch.objects.find((o) => o.kind === 'scatter').points); const co = rc(ok), cc = rc(c);
const dirOf = (k) => (k === 'none' ? 0 : k.startsWith('pos') ? 1 : -1), strOf = (k) => (k === 'none' ? 'none' : k.split('_')[1]);
if (cc === 'none') return "D7_no_association";
if (dirOf(cc) !== 0 && dirOf(cc) === -dirOf(co)) return "D3_direction_reversed";
if (dirOf(cc) === dirOf(co) && strOf(cc) !== strOf(co)) return "D5_strength_off";
return null;`;
const asChoicesBase = (rng: Rng, topic: SeTopic, correctCls: AClass, wrongSpec: { rule: string; cls: AClass }[]) => {
  const mk = (cls: AClass) => { const pts = samplePts(rng, cls); const f = ols(pts); return planeScatter(topic, 20, 100, pts, { slope: f.slope, intercept: f.intercept }); };
  return placeChoices(rng, mk(correctCls), wrongSpec.map((w) => ({ fig: mk(w.cls), rule: w.rule })));
};
const diagWrap = (diagnoseJs: string) => `${CLASS_JS}${diagnoseJs}`;
export const AS_PRED_BODY = (cond: string) => `${CLASS_JS}const pts = c.objects.find((o) => o.kind === 'scatter').points; return ${cond};`;
const pickStrong = (rng: Rng): AClass => rng.pick(["pos_strong", "pos_moderate", "pos_weak", "neg_strong", "neg_moderate", "neg_weak"]);
function threeWrong(rng: Rng, c: AClass): { rule: string; cls: AClass }[] {
  const dir = c.startsWith("pos") ? "pos" : "neg"; const others = ["strong", "moderate", "weak"].filter((s) => s !== strWord(c));
  return [{ rule: "D3_direction_reversed", cls: flip(c) }, { rule: "D5_strength_off", cls: `${dir}_${rng.pick(others)}` as AClass }, { rule: "D7_no_association", cls: "none" }];
}
const asCOps: COp[] = [
  {
    op: "repr_shift", structure: "연관의 방향과 강도(예: 음의 강한 연관)를 서술로 주고 그에 맞는 산점도를 4개 중에서 고름", extra: "방향(부호)과 강도(점이 직선에 모인 정도)를 동시에 판단해 방향만 반대이거나 강도만 다른 그래프를 걸러냄 — medium 은 방향만 판단",
    concepts: ["상관의 방향", "상관의 강도", "그래프 비교"],
    gen(rng) {
      const t = rng.pick(SE_TOPICS); const c = pickStrong(rng); const { choices, correctIndex, rules } = asChoicesBase(rng, t, c, threeWrong(rng, c));
      return choiceInst(rng, {
        stimulus: `Each scatterplot shows ${scTopicWords(t)} for 10 data points, along with a line of best fit.`,
        question: `Which scatterplot shows a ${strWord(c)} ${dirWord(c)} association between ${lc(t.xa)} and ${lc(t.ya)}?`, choices, correctIndex, rules, P: { target: c },
        predicateJs: AS_PRED_BODY("cls(pts) === P.target"), diagnoseJs: diagWrap(asDiag),
        trace: [[`${c.startsWith("pos") ? "x 가 늘면 y 도 느는" : "x 가 늘면 y 가 줄어드는"} 방향(${dirKo(c)})을 정한다.`, "Fix the direction."], [`점이 직선 주변에 ${strWord(c) === "strong" ? "촘촘히" : strWord(c) === "moderate" ? "어느 정도" : "넓게"} 모인 정도(${strKo(c)} 연관)를 정한다.`, "Fix the strength."], ["네 그래프의 방향을 먼저 대어 반대 방향 그래프를 지운다.", "Eliminate graphs with the opposite direction."], ["남은 그래프에서 점이 직선에 모인 정도를 비교한다.", "Compare the spread around the line."], [`방향과 강도가 모두 맞는 그래프를 고른다.`, "Pick the one matching both."]] as [string, string][], variant: "direction_and_strength", explainKo: "", explainEn: "",
      });
    },
  },
  {
    op: "compare_scenarios", structure: "네 산점도 중 x 와 y 의 연관이 가장 강한(상관계수의 절댓값이 가장 큰) 그래프를 고름", extra: "방향과 무관하게 점이 직선에 모인 정도만 네 그래프 사이에서 상대 비교(음의 연관도 강할 수 있음) — medium 은 두 그래프 비교",
    concepts: ["상관의 강도 비교", "방향과 강도의 분리", "그래프 비교"],
    gen(rng) {
      const t = rng.pick(SE_TOPICS); const c = rng.pick(["pos_strong", "neg_strong"] as AClass[]);
      const wrongSpec = [{ rule: "D5_strength_off", cls: `${c.startsWith("pos") ? "pos" : "neg"}_moderate` as AClass }, { rule: "D3_direction_reversed", cls: (flip(c).replace("strong", "weak")) as AClass }, { rule: "D7_no_association", cls: "none" as AClass }];
      const { choices, correctIndex, rules } = asChoicesBase(rng, t, c, wrongSpec);
      return choiceInst(rng, {
        stimulus: `Each scatterplot shows ${scTopicWords(t)} for 10 data points, along with a line of best fit.`,
        question: `Which scatterplot shows the strongest association between ${lc(t.xa)} and ${lc(t.ya)}?`, choices, correctIndex, rules, P: {},
        predicateJs: `${CLASS_JS}const pts = c.objects.find((o) => o.kind === 'scatter').points; const mine = Math.abs(rOf(pts)); return CHOICES.every((o, j) => j === i || mine > Math.abs(rOf(o.objects.find((q) => q.kind === 'scatter').points)) + 0.1);`, diagnoseJs: diagWrap(asDiag),
        trace: [["강한 연관은 방향(양·음)과 상관없이 점이 직선 가까이 모인 것이다.", "Strength ignores direction."], ["각 그래프에서 점이 추세선에 얼마나 가까운지 본다.", "Judge how tightly the points cluster around the line."], ["점이 거의 흩어진 그래프는 연관이 약하거나 없다.", "Widely scattered points mean a weak or no association."], ["음의 방향이어도 점이 직선에 가장 촘촘히 모이면 가장 강하다.", "A negative trend can still be the strongest."], ["가장 촘촘한 그래프를 고른다.", "Pick the tightest cluster."]] as [string, string][], variant: "strongest_association", explainKo: "", explainEn: "",
      });
    },
  },
  {
    op: "chain2", structure: "추세선의 기울기가 양(음)이고 점이 직선에서 넓게 흩어진(약한 연관) 산점도를 4개 중에서 고름", extra: "기울기의 부호 판단과 흩어진 정도 판단을 차례로 적용해 강한 연관·반대 방향 그래프를 걸러내는 2단 연쇄 — medium 은 기울기 부호만",
    concepts: ["추세선의 기울기 부호", "흩어진 정도(약한 연관)", "그래프 비교"],
    gen(rng) {
      const t = rng.pick(SE_TOPICS); const c = rng.pick(["pos_weak", "neg_weak"] as AClass[]); const dir = c.startsWith("pos") ? "pos" : "neg";
      const wrongSpec = [{ rule: "D3_direction_reversed", cls: flip(c) }, { rule: "D5_strength_off", cls: `${dir}_strong` as AClass }, { rule: "D7_no_association", cls: "none" as AClass }];
      const { choices, correctIndex, rules } = asChoicesBase(rng, t, c, wrongSpec);
      return choiceInst(rng, {
        stimulus: `Each scatterplot shows ${scTopicWords(t)} for 10 data points, along with a line of best fit.`,
        question: `Which scatterplot has a line of best fit with a ${dirWord(c)} slope and data points that are widely scattered around the line, showing only a weak association?`, choices, correctIndex, rules, P: { target: c },
        predicateJs: AS_PRED_BODY("cls(pts) === P.target"), diagnoseJs: diagWrap(asDiag),
        trace: [[`추세선의 기울기가 ${dirKo(c)}(${c.startsWith("pos") ? "+" : "-"})인 그래프만 남긴다.`, "Keep graphs whose fit line has the stated sign."], ["그중 점이 직선 가까이 모인 그래프(강한 연관)를 지운다.", "Remove tightly clustered graphs."], ["기울기가 거의 0 이고 점이 무작위로 흩어진 그래프(연관 없음)를 지운다.", "Remove the graph with no association."], ["넓게 흩어졌지만 기울기 부호가 맞는 그래프가 남는다.", "The remaining graph is scattered but has the right sign."], ["그 그래프가 약한 연관을 보인다.", "That graph shows a weak association."]] as [string, string][], variant: "sign_then_scatter", explainKo: "", explainEn: "",
      });
    },
  },
  {
    op: "param_condition", structure: "각 y 값을 (100 − y) 로 바꾸면 방향이 뒤집힌다는 조건에서, 바꾼 뒤 어떤 연관을 보이는 산점도가 되도록 처음 그래프를 4개 중에서 고름", extra: "변수 변환(y → 100 − y)이 방향만 뒤집고 강도는 유지함을 이용해 처음 그래프의 부류를 역으로 판단 — medium 은 변환 없이 방향 판단",
    concepts: ["변수 변환의 효과", "상관의 방향·강도", "그래프 비교"],
    gen(rng) {
      const t = rng.pick(SE_TOPICS); const target = pickStrong(rng); const c = flip(target); const dir = c.startsWith("pos") ? "pos" : "neg";
      const others = ["strong", "moderate", "weak"].filter((s) => s !== strWord(c));
      const wrongSpec = [{ rule: "D3_direction_reversed", cls: flip(c) }, { rule: "D5_strength_off", cls: `${dir}_${rng.pick(others)}` as AClass }, { rule: "D7_no_association", cls: "none" as AClass }];
      const { choices, correctIndex, rules } = asChoicesBase(rng, t, c, wrongSpec);
      return choiceInst(rng, {
        stimulus: `Each scatterplot shows ${scTopicWords(t)} for 10 data points. A new variable $w$ is defined for each data point as $w = 100 - y$, where $y$ is the vertical-axis value.`,
        question: `For which scatterplot would a plot of $w$ against ${lc(t.xa)} show a ${strWord(target)} ${dirWord(target)} association?`, choices, correctIndex, rules, P: { target },
        predicateJs: `${CLASS_JS}const pts = c.objects.find((o) => o.kind === 'scatter').points.map((p) => [p[0], 100 - p[1]]); return cls(pts) === P.target;`, diagnoseJs: diagWrap(asDiag),
        trace: [["w = 100 − y 는 y 가 클수록 w 가 작아지는 변환이다.", "w decreases as y increases."], ["이 변환은 연관의 방향을 반대로 뒤집고 강도는 그대로 둔다.", "The transform reverses direction and keeps strength."], [`변환 뒤 ${strKo(target)} ${dirKo(target)}의 연관이 되려면 처음에는 ${strKo(target)} ${dirKo(flip(target))}의 연관이어야 한다.`, "Work backwards to the original association."], ["네 그래프에서 그 방향·강도의 그래프를 찾는다.", "Find the graph with that direction and strength."], ["방향만 같거나 강도만 같은 그래프는 제외한다.", "Eliminate graphs matching only one attribute."]] as [string, string][], variant: "transform_reverses_direction", explainKo: "", explainEn: "",
      });
    },
  },
];
export const FIG_ASSOC_SCC = buildC("association_direction_strength", "SC", "C", asCOps, false, SPR_NO_CHOICE);

// ── P: 산점도 하나 + 서술 선지 ──
export const mkAssocFig = (t: SeTopic, pts: Pt[], extra: Record<string, unknown> = {}) => ({ type: "data", kind: "scatter", xTitle: titleWith(t.xa, t.xu), yTitle: titleWith(t.ya, t.yu), points: pts, yMin: 0, yMax: 100, yStep: 20, ...extra });
const optsFor = (rng: Rng, c: AClass): { texts: string[]; correctIndex: number } => {
  const pool = new Map<string, AClass>(); const dir = c.startsWith("pos") ? "pos" : "neg";
  const cands: AClass[] = [flip(c), ...(c === "none" ? (["pos_strong", "neg_strong", "pos_weak"] as AClass[]) : (["strong", "moderate", "weak"].filter((s) => s !== strWord(c)).map((s) => `${dir}_${s}`) as AClass[])), "none"];
  for (const k of cands) if (k !== c && !pool.has(claimOf(k))) pool.set(claimOf(k), k);
  const wrong = rng.shuffle([...pool.keys()]).slice(0, 3); if (wrong.length < 3) throw new GenFail("서술 선지 부족");
  const all = rng.shuffle([claimOf(c), ...wrong]); return { texts: all, correctIndex: all.indexOf(claimOf(c)) };
};
export const PARSE_JS = `const parse = (o) => (/no clear/.test(o) ? 'none' : (/positive/.test(o) ? 'pos' : 'neg') + '_' + (/strong/.test(o) ? 'strong' : /moderate/.test(o) ? 'moderate' : 'weak'));\n`;
export function indexInst(rng: Rng, o: { stimulus: string; question: string; options: string[]; correctIndex: number; figure: unknown; P: Record<string, unknown>; body: string; trace: [string, string][]; variant: string }): Instance {
  const L = ABCD[o.correctIndex];
  return {
    stimulus: o.stimulus, question: o.question, options: o.options, correctIndex: o.correctIndex, answerKind: "index", figure: o.figure,
    explanation: `${o.trace.map(([ko], i) => `(${i + 1}) ${ko}`).join(" ")} 따라서 정답은 ${L}이다.`, explanationEn: `${o.trace.map(([, en], i) => `(${i + 1}) ${en}`).join(" ")} So the answer is ${L}.`,
    verificationJs: figJs({ ...o.P, options: o.options } as Record<string, number | string | number[] | string[]>, o.figure, o.body), trace: o.trace.map(([ko]) => ko), variant: o.variant,
    distractors: o.options.map((_, i) => i).filter((i) => i !== o.correctIndex).map((i) => ({ index: i, kind: "other" as const, reason: "방향·강도 판단의 한 가지를 틀린 서술" })),
  };
}
const asPOps: COp[] = [
  {
    op: "repr_shift", structure: "산점도를 보고 x 와 y 의 연관의 방향과 강도를 가장 잘 나타낸 서술 하나를 고름", extra: "점의 추세(방향)와 직선 주변 밀집도(강도)를 함께 판단해 네 서술 중 하나를 고름(방향만 맞거나 강도만 맞는 서술이 함정) — medium 은 방향만 판단",
    concepts: ["상관의 방향", "상관의 강도", "서술 선지 평가"],
    gen(rng) {
      const t = rng.pick(SE_TOPICS); const c = rng.pick([...ALL_CLASSES]); const pts = samplePts(rng, c); const { texts, correctIndex } = optsFor(rng, c);
      return indexInst(rng, {
        stimulus: `The scatterplot shows ${scTopicWords(t)} for 10 data points.`, question: `Which of the following best describes the association between ${lc(t.xa)} and ${lc(t.ya)} shown in the scatterplot?`, options: texts, correctIndex, figure: mkAssocFig(t, pts), P: {},
        body: `${CLASS_JS}${PARSE_JS}const want = cls(FIGURE.points); const hit = P.options.map(parse).map((k, i) => (k === want ? i : -1)).filter((i) => i >= 0); if (hit.length !== 1) throw new Error('일치 선지 ' + hit.length); return hit[0];`,
        trace: [["점들이 왼쪽에서 오른쪽으로 갈 때 올라가는지 내려가는지로 방향을 정한다.", "Decide the direction of the trend."], ["점들이 하나의 직선 주변에 얼마나 모여 있는지로 강도를 정한다.", "Judge how tightly points cluster around a line."], ["방향이 반대인 서술을 지운다.", "Remove statements with the wrong direction."], ["강도가 다른 서술을 지운다.", "Remove statements with the wrong strength."], [`남은 서술이 정답이다.`, "The remaining statement is correct."]] as [string, string][], variant: "describe_association",
      });
    },
  },
  {
    op: "compare_scenarios", structure: "두 산점도(Plot A, Plot B)를 보고 어느 쪽 연관이 더 강한지 또는 같은 정도인지 서술 하나를 고름", extra: "방향과 상관없이 두 그래프의 밀집도를 상대 비교해야 하며 방향이 달라 보여도 강도는 같을 수 있음 — medium 은 한 그래프 판단",
    concepts: ["상관의 강도 비교", "두 자료 비교", "서술 선지 평가"],
    gen(rng) {
      const t = rng.pick(SE_TOPICS); const strong = rng.pick(["pos_strong", "neg_strong"] as AClass[]); const weak = rng.pick(["pos_weak", "neg_weak", "none"] as AClass[]); const aStrong = rng.chance(0.5);
      const pa = samplePts(rng, aStrong ? strong : weak), pb = samplePts(rng, aStrong ? weak : strong);
      const figure = { type: "figure_set", figures: [{ id: "A", title: "Plot A", spec: mkAssocFig(t, pa) }, { id: "B", title: "Plot B", spec: mkAssocFig(t, pb) }] };
      const texts = ["Plot A shows the stronger linear association.", "Plot B shows the stronger linear association.", "Both plots show linear associations of about equal strength.", "Neither plot shows a linear association."];
      const order = rng.shuffle([0, 1, 2, 3]); const opts = order.map((i) => texts[i]); const correctText = aStrong ? texts[0] : texts[1];
      return indexInst(rng, {
        stimulus: `Two scatterplots, Plot A and Plot B, show ${scTopicWords(t)} for two different groups of 10 data points each.`, question: `Which of the following statements is true about the scatterplots shown?`, options: opts, correctIndex: opts.indexOf(correctText), figure, P: {},
        body: `${CLASS_JS}const rA = rOf(FIGURE.figures[0].spec.points), rB = rOf(FIGURE.figures[1].spec.points); const dirA = Math.abs(rA) < 0.15 ? 0 : Math.sign(rA), dirB = Math.abs(rB) < 0.15 ? 0 : Math.sign(rB);
const truth = (o) => { if (/Plot A shows the stronger/.test(o)) return Math.abs(rA) > Math.abs(rB) + 0.1; if (/Plot B shows the stronger/.test(o)) return Math.abs(rB) > Math.abs(rA) + 0.1; if (/about equal strength/.test(o)) return Math.abs(Math.abs(rA) - Math.abs(rB)) < 0.1; if (/Neither plot shows a linear association/.test(o)) return dirA === 0 && dirB === 0; throw new Error('모르는 서술'); };
const hit = P.options.map(truth).map((v, i) => (v ? i : -1)).filter((i) => i >= 0); if (hit.length !== 1) throw new Error('참인 서술 ' + hit.length); return hit[0];`,
        trace: [["Plot A 의 점들이 직선 주변에 모인 정도를 본다.", "Judge Plot A's clustering."], ["Plot B 도 같은 방식으로 본다.", "Judge Plot B the same way."], ["방향(양·음)은 강도와 무관하므로 모인 정도만 비교한다.", "Direction is irrelevant to strength."], [`${aStrong ? "Plot A" : "Plot B"} 가 더 촘촘하다.`, "One plot is clearly tighter."], ["이 비교와 일치하는 서술을 고른다.", "Pick the matching statement."]] as [string, string][], variant: "compare_two_plots",
      });
    },
  },
  {
    op: "chain2", structure: "산점도의 추세선이 가지는 기울기 부호와 y 절편 부호를 연달아 판단해 맞는 서술을 고름", extra: "추세의 방향(기울기 부호)을 먼저 정하고 직선을 x=0 까지 연장해 y 절편의 부호를 판단하는 2단 연쇄(절편은 자료 밖 외삽) — medium 은 기울기 부호만",
    concepts: ["추세선 기울기 부호", "외삽한 y 절편 부호", "서술 선지 평가"],
    gen(rng) {
      for (let tr = 0; tr < 200; tr++) {
        const t = rng.pick(SE_TOPICS); const combo = rng.pick([[1, 1], [1, -1], [-1, 1]] as [number, number][]); const [sg, ig] = combo; const xs = Array.from({ length: 9 }, (_, i) => 4 + i + (i > 4 ? 1 : 0));
        const a = rng.int(5, 9); let b: number; if (sg === 1 && ig === 1) b = rng.int(18, 34); else if (sg === 1) b = -rng.int(18, 30); else b = rng.int(90, 100) + a * 0; const slope = sg * a; if (sg === -1) { b = rng.int(78, 96) + 0; if (b + slope * xs[xs.length - 1] < 8) continue; }
        const pts: Pt[] = xs.map((x) => [x, Math.round(b + slope * x + gauss(rng) * 3)]); if (pts.some((p) => p[1] < 4 || p[1] > 96)) continue;
        const f = ols(pts); if (Math.sign(f.slope) !== sg || Math.abs(f.intercept) < 8 || Math.sign(f.intercept) !== ig) continue;
        const texts = ["The line of best fit has a positive slope and a positive y-intercept.", "The line of best fit has a positive slope and a negative y-intercept.", "The line of best fit has a negative slope and a positive y-intercept.", "The line of best fit has a negative slope and a negative y-intercept."]; const key = (s: number, i: number) => texts[(s === 1 ? 0 : 2) + (i === 1 ? 0 : 1)];
        const order = rng.shuffle([0, 1, 2, 3]); const opts = order.map((i) => texts[i]); const correctText = key(sg, ig);
        return indexInst(rng, {
          stimulus: rng.pick([`The scatterplot shows ${scTopicWords(t)} for 9 data points, and the horizontal axis starts at 0.`, `A scatterplot of 9 data points is shown for ${scTopicWords(t)}. The horizontal axis begins at 0, and a line of best fit is drawn for the data.`, `Nine observations of ${scTopicWords(t)} are plotted in the scatterplot shown; the horizontal axis starts at 0.`, `In the scatterplot shown, each of 9 points records ${scTopicWords(t)}. Note that the horizontal axis starts at 0 rather than at the smallest value.`]), question: rng.pick([`Which of the following must be true about the line of best fit for the data?`, `Which statement about the line of best fit for these data must be true?`, `Based on the scatterplot, which of the following is necessarily true of the line of best fit?`, `Which of the following correctly describes the slope and the y-intercept of the line of best fit?`]), options: opts, correctIndex: opts.indexOf(correctText), figure: mkAssocFig(t, pts), P: {},
          body: `${CLASS_JS}const pts = FIGURE.points; const n = pts.length; const mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n; let sxy = 0, sxx = 0; for (const p of pts) { sxy += (p[0] - mx) * (p[1] - my); sxx += (p[0] - mx) ** 2; } const slope = sxy / sxx, icpt = my - slope * mx;
const truth = (o) => (/positive slope/.test(o) ? slope > 0 : slope < 0) && (/positive y-intercept/.test(o) ? icpt > 0 : icpt < 0);
const hit = P.options.map(truth).map((v, i) => (v ? i : -1)).filter((i) => i >= 0); if (hit.length !== 1) throw new Error('참인 선지 ' + hit.length); return hit[0];`,
          trace: [[`점들이 ${sg === 1 ? "오르는" : "내리는"} 추세이므로 기울기는 ${sg === 1 ? "양수" : "음수"}이다.`, "Direction gives the slope sign."], ["직선을 왼쪽으로 x = 0 까지 연장한다.", "Extend the line to x = 0."], [`연장한 직선이 y 축과 ${ig === 1 ? "양의" : "음의"} 쪽에서 만난다.`, "Read the sign of the extrapolated intercept."], ["기울기 부호와 절편 부호가 모두 맞는 서술을 찾는다.", "Find the statement matching both signs."], ["데이터가 모두 양수여도 연장한 절편은 음수일 수 있음에 유의한다.", "Positive data do not force a positive intercept."]] as [string, string][], variant: "slope_and_intercept_signs",
        });
      }
      throw new GenFail("asP.chain2");
    },
  },
  {
    op: "param_condition", structure: "각 y 값을 (100 − y) 로 바꾼 새 변수와 x 의 연관의 방향·강도를 서술 중에서 고름", extra: "변환이 방향을 뒤집고 강도는 유지함을 이용해, 변환 뒤 그래프를 직접 그리지 않고 처음 그래프에서 판단 — medium 은 변환 없이 판단",
    concepts: ["변수 변환의 효과", "상관의 방향·강도", "서술 선지 평가"],
    gen(rng) {
      const t = rng.pick(SE_TOPICS); const c = pickStrong(rng); const pts = samplePts(rng, c); const after = flip(c); const { texts, correctIndex } = optsFor(rng, after);
      return indexInst(rng, {
        stimulus: `The scatterplot shows ${scTopicWords(t)} for 10 data points. A new variable $w$ is defined for each data point as $w = 100 - y$, where $y$ is the vertical-axis value.`, question: `Which of the following best describes the association between ${lc(t.xa)} and $w$?`, options: texts, correctIndex, figure: mkAssocFig(t, pts), P: {},
        body: `${CLASS_JS}${PARSE_JS}const want = cls(FIGURE.points.map((p) => [p[0], 100 - p[1]])); const hit = P.options.map(parse).map((k, i) => (k === want ? i : -1)).filter((i) => i >= 0); if (hit.length !== 1) throw new Error('일치 선지 ' + hit.length); return hit[0];`,
        trace: [["처음 그래프의 방향과 강도를 읽는다.", "Read the original direction and strength."], ["w = 100 − y 는 y 가 클수록 w 가 작아지는 변환이다.", "w falls as y rises."], ["방향이 반대로 뒤집힌다.", "The direction reverses."], ["점이 직선 주변에 모인 정도(강도)는 변하지 않는다.", "The strength is unchanged."], ["바뀐 방향과 같은 강도를 말한 서술을 고른다.", "Pick the statement with the flipped direction and the same strength."]] as [string, string][], variant: "transformed_variable_association",
      });
    },
  },
];
export const FIG_ASSOC_SCP = buildC("association_direction_strength", "SC", "P", asPOps, false, SPR_NO_QUAL);

export const FIG_CHOICE_HARD: Archetype[] = [...FIG_SHARE_TWC, ...FIG_EQ_SCC, ...FIG_CNT_SCC, ...FIG_ASSOC_SCC, ...FIG_ASSOC_SCP];
export { cap1, withFigure, gcd };
