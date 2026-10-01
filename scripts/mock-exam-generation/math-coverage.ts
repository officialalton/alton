// 기존 계산형 컴파일러 19종의 모의고사용 공급 가능량 측정 (2026-09-30). DB·API 호출 없음(순수 계산).
// 실행: npx tsx scripts/mock-exam-generation/math-coverage.ts [--batches 120] [--out data/mock-exam-generation/math-coverage.json]
// 지표: skill×난이도별로 N개를 뽑아 (1) 서로 다른 유사문항 그룹(=subpattern) 수, (2) 본문 유사도 0.6 미만을 지키는 탐욕 독립 집합 크기.
//       표본 크기 곡선(25%·50%·100%)으로 포화 여부를 본다 — 포화하면 그 값이 사실상 상한이다.
import { writeFileSync } from "node:fs";
import path from "node:path";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const shingles = (t: string) => {
  const w = t.toLowerCase().replace(/[0-9]+([.,][0-9]+)*/g, "#").replace(/[^a-z#\s]+/g, " ").split(/\s+/).filter(Boolean);
  const s = new Set<string>(); for (let i = 0; i + 3 <= w.length; i++) s.add(w.slice(i, i + 3).join(" ")); return s;
};
const jaccard = (a: Set<string>, b: Set<string>) => { if (!a.size || !b.size) return 0; let x = 0; for (const v of a) if (b.has(v)) x++; return x / (a.size + b.size - x); };
function greedy(items: Set<string>[]) { const keep: Set<string>[] = []; for (const s of items) if (keep.every((k) => jaccard(k, s) < 0.6)) keep.push(s); return keep.length; }
(async () => {
  const batches = Number(arg("--batches") ?? 60);
  const { runMathCompilerBatch } = await import("../../lib/problem-generation/math-compilers/batch");
  const { MATH_SKILL_KINDS } = await import("../../lib/problem-generation/math-compilers/kind-catalog");
  const skills = ["linear_equations_two_var", "systems_linear", "linear_inequalities", "linear_equations_one_var", "linear_functions", "equivalent_expressions", "nonlinear_equations_systems", "nonlinear_functions", "ratios_rates_units", "percentages", "one_variable_data", "two_variable_data", "probability", "inference_margin_error", "evaluating_statistical_claims", "area_volume", "lines_angles_triangles", "right_triangles_trigonometry", "circles"];
  const origLog = console.log; const rows: unknown[] = [];
  for (const skill of skills) for (const difficulty of ["easy", "medium"] as const) {
    const texts: string[] = []; const kindsOf: string[] = []; const groups = new Map<string, number>(); let fail = 0;
    console.log = () => {};
    // 세부 패턴이 있는 skill 은 kind 를 하나씩 강제해 고르게 표집한다(무작위 선택은 일부 kind 에 쏠린다).
    const kinds: (string | undefined)[] = (MATH_SKILL_KINDS[skill] ?? []).length ? MATH_SKILL_KINDS[skill].map((k) => k.value) : [undefined];
    const perKind = Math.max(1, Math.ceil(batches / kinds.length));
    for (const kind of kinds) for (let b = 0; b < perKind; b++) {
      let r = await runMathCompilerBatch({ skillCode: skill as never, difficulty, count: 10, kind });
      // 자료 필수 세부 패턴은 정책 없이 전부 거절되므로 require_data 로 재시도한다.
      if (r.accepted.length === 0 && r.failures.some((f) => f.reason.includes("자료 필수"))) r = await runMathCompilerBatch({ skillCode: skill as never, difficulty, count: 10, kind, figurePolicy: "require_data" });
      fail += r.failures.length;
      for (const a of r.accepted) {
        const g = a.problem as never as { stimulus?: string; question?: string; options?: string[]; subpattern?: string };
        texts.push(`${g.stimulus ?? ""} ${g.question ?? ""} ${(g.options ?? []).join(" ")}`); kindsOf.push(String(g.subpattern ?? kind ?? "-"));
        const k = g.subpattern ?? "-"; groups.set(k, (groups.get(k) ?? 0) + 1);
      }
    }
    console.log = origLog;
    // 세부 패턴 순서로 쌓인 표본이라 섞어서 포화 곡선을 본다(고정 시드).
    const order = texts.map((_, i) => i); let sd = 12345; for (let i = order.length - 1; i > 0; i--) { sd = (sd * 1103515245 + 12345) & 0x7fffffff; const j = sd % (i + 1); [order[i], order[j]] = [order[j], order[i]]; }
    const sh = order.map((i) => shingles(texts[i])); const n = sh.length;
    const perKindInd: Record<string, number> = {}; for (const kd of new Set(kindsOf)) perKindInd[kd] = greedy(texts.filter((_, i) => kindsOf[i] === kd).map(shingles));
    const row = { skill, difficulty, kindsInCatalog: (MATH_SKILL_KINDS[skill] ?? []).length, sampled: n, compileFail: fail, groups: groups.size, independent25: greedy(sh.slice(0, Math.floor(n / 4))), independent50: greedy(sh.slice(0, Math.floor(n / 2))), independent100: greedy(sh), perKindIndependent: perKindInd };
    rows.push(row); origLog(JSON.stringify(row));
  }
  writeFileSync(path.resolve(arg("--out") ?? "data/mock-exam-generation/math-coverage.json"), JSON.stringify(rows, null, 1));
})();
