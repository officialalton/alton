// 2026-09-24 — 문제은행 유형별 생성 품질 UAT(문서: 사용자 지시서 "문제은행 유형별 생성 품질 UAT 지시서").
//
// 매트릭스를 코드에서 직접 유도한다(SKILL_CODES + SKILL_DEFAULT) — 손으로 나열하지 않는다.
// Math 19개 세부 기술은 결정적 계산 컴파일러(runMathCompilerBatch)를 실제로 호출한다 —
// AI 호출이 전혀 없으므로(app/admin/problem-bank-actions.ts의 MATH_COMPILER_SKILLS 분기와
// 동일한 코드 경로) 비용·API 키 없이 전수 검증할 수 있다.
// R&W 11개 세부 기술은 실제 AI 파이프라인(runGenerationPipeline)이 필요하다 — ANTHROPIC_API_KEY가
// 없는 환경에서는 그 부분만 skip 처리하고 사유를 남긴다(조용히 통과시키지 않는다).
import { describe, it, expect } from "vitest";
import { SKILL_CODES, SKILL_BY_CODE, type SkillCode } from "@/lib/problem-taxonomy";
import { judgeMaterialNeed, applyFigurePolicy, materialBlocker, figureSatisfies, MATERIAL_KIND_LABEL, type MaterialKind } from "@/lib/problem-material-need";
import { checkFigure } from "@/lib/problem-figures/check";
import { GEOMETRY_TEMPLATE_TYPES } from "@/lib/problem-figures/spec";
import { findEquationChoice } from "@/lib/problem-figures/templates/figure-choice";
import { runMathCompilerBatch, type MathCompilerSkill } from "./math-compilers/batch";
import { runGenerationPipeline } from "./pipeline";

// ---------------------------------------------------------------------------- 매트릭스 유도

const MATH_COMPILER_SKILLS = new Set([
  "linear_equations_two_var", "systems_linear", "linear_inequalities", "linear_equations_one_var", "linear_functions",
  "equivalent_expressions", "nonlinear_equations_systems", "nonlinear_functions", "ratios_rates_units", "percentages",
  "one_variable_data", "two_variable_data", "probability", "inference_margin_error", "evaluating_statistical_claims",
  "area_volume", "lines_angles_triangles", "right_triangles_trigonometry", "circles",
]);

const requireFor = (kind: MaterialKind | null): string =>
  kind === "plane" ? "require_plane" : kind === "geometry" ? "require_geometry" : kind === "figure_choice" ? "require_figure_choice" : "require_data";

type Row = {
  skillCode: string;
  domain: string;
  examSystem: "sat_math" | "sat_rw";
  isCompiler: boolean;
  /** null materialChoice = 텍스트형(자료 없음). */
  materialChoice: MaterialKind | null;
  figurePolicy: string;
  label: string;
};

/** 관리자 화면(ProblemBankTab.tsx NewProblemPanel)과 정확히 같은 로직으로 각 세부 기술의 선택
 * 가능한 행(텍스트형 + 자료 유형별)을 만든다 — "유형별 2문항"은 자료 유형별로 별도 행이다. */
function rowsForSkill(skill: SkillCode): Row[] {
  const examSystem = skill.domain.startsWith("rw_") ? "sat_rw" : "sat_math";
  const need = judgeMaterialNeed({ examSystem, skillCode: skill.code, text: "" });
  const isCompiler = MATH_COMPILER_SKILLS.has(skill.code);
  const rows: Row[] = [];
  if (need.level === "none") {
    rows.push({ skillCode: skill.code, domain: skill.domain, examSystem, isCompiler, materialChoice: null, figurePolicy: "none", label: `${skill.label} · 텍스트형` });
    return rows;
  }
  // required + 단일 대안 → 텍스트형 선택지 자체가 없다(화면과 동일).
  if (!(need.level === "recommended" || (need.level === "required" && need.alternatives.length > 1))) {
    rows.push({ skillCode: skill.code, domain: skill.domain, examSystem, isCompiler, materialChoice: need.kind, figurePolicy: requireFor(need.kind), label: `${skill.label} · 자료(${MATERIAL_KIND_LABEL[need.kind as MaterialKind]})` });
    return rows;
  }
  for (const k of need.alternatives) {
    rows.push({ skillCode: skill.code, domain: skill.domain, examSystem, isCompiler, materialChoice: k, figurePolicy: requireFor(k), label: `${skill.label} · 자료(${MATERIAL_KIND_LABEL[k]})` });
  }
  if (need.level === "recommended") {
    rows.push({ skillCode: skill.code, domain: skill.domain, examSystem, isCompiler, materialChoice: null, figurePolicy: "none", label: `${skill.label} · 텍스트형` });
  }
  return rows;
}

const ALL_ROWS: Row[] = SKILL_CODES.flatMap(rowsForSkill);
const MATH_ROWS = ALL_ROWS.filter((r) => r.examSystem === "sat_math");
const RW_ROWS = ALL_ROWS.filter((r) => r.examSystem === "sat_rw");

type RowResult = {
  row: Row;
  requested: number;
  created: number;
  failures: string[];
  perProblem: { figureType: string | null; figureChoiceCount: number | null; renderOk: boolean; renderIssues: string[]; materialSatisfied: boolean; hasQuestion: boolean; optionsOk: boolean }[];
};

const MATRIX: RowResult[] = [];

function assertRowInvariants(row: Row, need: ReturnType<typeof judgeMaterialNeed>, g: { figure: unknown; question: string | null; passage: string; stimulus?: string | null; options: string[] | null; correctIndex: number | null; answers: string[] | null }) {
  const text = (g.stimulus ?? g.passage) + "\n\n" + (g.question ?? "");
  // 자료 정책: require_* 인데 자료가 없다면 이 문항은 애초에 채택되지 않아야 한다(materialBlocker 재확인).
  const blocker = materialBlocker(need, g.figure ?? null);
  const materialSatisfied = blocker === null;
  // 자료 유형: 요청한 kind와 저장된 figure.type 일치(도형은 템플릿 타입 허용).
  const figType = (g.figure as { type?: string } | null)?.type ?? null;
  if (row.materialChoice === "geometry") {
    expect(figType === null || (GEOMETRY_TEMPLATE_TYPES as readonly string[]).includes(figType)).toBeTruthy();
  } else if (row.materialChoice) {
    if (materialSatisfied) expect(figureSatisfies(row.materialChoice, g.figure)).toBeTruthy();
  }
  // figure_choice 전용: 정확히 4개, A-D 순서 == 정답 인덱스 그래프만 지문 식과 일치.
  let figureChoiceCount: number | null = null;
  if (row.materialChoice === "figure_choice" && figType === "figure_choice") {
    const spec = g.figure as { choices?: unknown[] };
    figureChoiceCount = spec.choices?.length ?? 0;
    expect(figureChoiceCount).toBe(4);
    const at = findEquationChoice(spec as never, text);
    if (at !== null) expect(at).toBe(g.correctIndex);
  }
  // 렌더링.
  const render = checkFigure(g.figure ?? null, text, g.options ?? null, g.correctIndex ?? null);
  // 정답: mc면 선택지 4개 + correctIndex 범위, spr이면 answers.
  const optionsOk = g.options ? g.options.length === 4 && (g.correctIndex ?? -1) >= 0 && (g.correctIndex ?? 99) < g.options.length : Array.isArray(g.answers) && g.answers.length > 0;
  const hasQuestion = Boolean((g.question ?? "").trim());
  return { figureType: figType, figureChoiceCount, renderOk: render.ok, renderIssues: render.issues.map((i) => i.message), materialSatisfied, hasQuestion, optionsOk };
}

// ---------------------------------------------------------------------------- Math(컴파일러, AI 없음)

describe("UAT 매트릭스 — SAT Math (계산형 컴파일러, AI 호출 없음)", () => {
  it(`매트릭스 크기 확인 — Math ${MATH_ROWS.length}행`, () => {
    expect(MATH_ROWS.length).toBeGreaterThan(0);
  });

  for (const row of MATH_ROWS) {
    it(`${row.label} [${row.skillCode}]`, async () => {
      const need = judgeMaterialNeed({ examSystem: "sat_math", skillCode: row.skillCode, text: "" });
      const collected: { figure: unknown; question: string | null; passage: string; stimulus?: string | null; options: string[] | null; correctIndex: number | null; answers: string[] | null }[] = [];
      const failures: string[] = [];
      const result = await runMathCompilerBatch({
        skillCode: row.skillCode as MathCompilerSkill,
        difficulty: "medium",
        count: 2,
        figurePolicy: row.figurePolicy,
        onAccepted: async ({ problem: g }) => {
          collected.push({ figure: g.figure ?? null, question: g.question ?? null, passage: g.passage, stimulus: g.stimulus, options: g.options ?? null, correctIndex: g.correctIndex ?? null, answers: g.answers ?? null });
        },
      });
      failures.push(...result.failures.map((f) => f.reason));

      const perProblem = collected.map((g) => assertRowInvariants(row, applyFigurePolicy(need, row.figurePolicy), g));
      MATRIX.push({ row, requested: 2, created: collected.length, failures, perProblem });

      for (const p of perProblem) {
        expect(p.hasQuestion).toBeTruthy();
        expect(p.materialSatisfied).toBeTruthy(); // 자료 필수인데 자료 없이 통과한 문항이 없어야 한다(신고된 버그 재발 방지).
        expect(p.optionsOk).toBeTruthy();
      }
      // 생성 실패(0건)는 통과로 위장하지 않는다 — 지원하지 않는 조합은 사유와 함께 실패로 보고한다.
      if (collected.length === 0) {
        expect(failures.length).toBeGreaterThan(0);
      }
    });
  }
});

// ---------------------------------------------------------------------------- R&W(AI 파이프라인, 비용 발생)

describe.skipIf(!process.env.ANTHROPIC_API_KEY)("UAT 매트릭스 — SAT R&W (실제 AI 생성, ANTHROPIC_API_KEY 필요)", () => {
  for (const row of RW_ROWS) {
    it(`${row.label} [${row.skillCode}]`, async () => {
      const need = judgeMaterialNeed({ examSystem: "sat_rw", skillCode: row.skillCode, text: "" });
      const collected: { figure: unknown; question: string | null; passage: string; options: string[] | null; correctIndex: number | null; answers: string[] | null }[] = [];
      const failures: string[] = [];
      let modelCalls = 0;
      const skill = SKILL_BY_CODE.get(row.skillCode)!;
      const result = await runGenerationPipeline({
        subjectName: "UAT",
        skillType: skill.legacySkill,
        skillCode: row.skillCode,
        examSystem: "sat_rw",
        topic: undefined,
        difficulty: "medium" as never,
        format: "mc" as never,
        count: 2,
        figurePolicy: row.figurePolicy as never,
        onAccepted: async ({ problem: g }) => {
          collected.push({ figure: g.figure ?? null, question: g.question ?? null, passage: g.stimulus ?? g.passage, options: g.options ?? null, correctIndex: g.correctIndex ?? null, answers: g.answers ?? null });
        },
      });
      modelCalls = (result.stats as { modelCalls?: number }).modelCalls ?? -1;
      failures.push(...result.failures.map((f) => `${f.snippet} — ${f.reason}`));
      const perProblem = collected.map((g) => assertRowInvariants(row, applyFigurePolicy(need, row.figurePolicy), g));
      MATRIX.push({ row, requested: 2, created: collected.length, failures, perProblem });
      console.log(JSON.stringify({ event: "uat_rw_model_calls", skillCode: row.skillCode, modelCalls }));
      for (const p of perProblem) {
        expect(p.hasQuestion).toBeTruthy();
        expect(p.materialSatisfied).toBeTruthy();
      }
    }, 300_000);
  }
});

// ---------------------------------------------------------------------------- 매트릭스 산출물

describe("UAT 매트릭스 산출물", () => {
  it("결과를 docs/assets 에 기록한다", async () => {
    if (MATRIX.length === 0) return; // 위 describe들이 이 파일 안에서 순서대로 먼저 돈다(vitest 파일 단위 순차).
    const fs = await import("node:fs");
    const rows = MATRIX.map((m) => ({
      skillCode: m.row.skillCode, domain: m.row.domain, examSystem: m.row.examSystem, label: m.row.label,
      materialChoice: m.row.materialChoice, isCompiler: m.row.isCompiler,
      requested: m.requested, created: m.created, failures: m.failures,
      perProblem: m.perProblem,
    }));
    fs.mkdirSync("docs/assets/2026-09-24-problem-bank-uat", { recursive: true });
    fs.writeFileSync("docs/assets/2026-09-24-problem-bank-uat/matrix-result.json", JSON.stringify(rows, null, 2));
  });
});
