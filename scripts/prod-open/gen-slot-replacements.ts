// 오류 신고(2026-10-18) 수동 교체 20칸용 슬롯별 교체 문항 사전 생성(결정형 컴파일러 — 유료 API 없음, DB 접근 없음).
// replacement-candidates.json 의 후보는 전부 mc·medium 이라 수동 칸(easy/hard/spr 포함)의 칸 조건(skill·형식·난이도)과 안 맞는다.
// 이 스크립트는 각 칸과 같은 skill·형식·난이도로 고친 컴파일러에서 한 문항씩 뽑아 import.ts 가 받는 레코드로 저장한다.
// 그래프+식 중복(hasGraphAndExpressionForSameCurves)이면 버리고 다시 뽑는다. 한 번 만들어 커밋하고, 적용 스크립트는 이 파일만 읽는다(재현성).
//   npx tsx scripts/prod-open/gen-slot-replacements.ts --slots <slots.json> --out data/mock-exam-generation/sat-error-report-1018/slot-replacements.json
//   slots.json: [{name, position, versionId, problemId, skill_code, format, difficulty, module_key, route, group}]  --groups groups.json: {세트이름: [세트 모든 문항의 similarity_group]}
//   모의고사 세트는 noSimilarGroupRepeat 규칙(같은 유사문항 그룹 두 번 금지)이라, 새 문항의 그룹(c:<skill>:<subpattern>)이 같은 세트의 다른 문항·다른 교체 문항과 겹치지 않게 kind 를 바꿔 뽑는다.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { attemptOne, type MathCompilerSkill } from "../../lib/problem-generation/math-compilers/batch";
import { hasGraphAndExpressionForSameCurves } from "../../lib/problem-generation/graph-expression-redundancy";
import { SKILL_BY_CODE } from "../../lib/problem-taxonomy";
import { getMathSkillKinds } from "../../lib/problem-generation/math-compilers/kind-catalog";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
type Slot = { group?: string | null; name: string; position: number; versionId: string; problemId: string; skill_code: string; format: "mc" | "spr"; difficulty: "easy" | "medium" | "hard"; module_key: string; route: string | null };
// 신고 원인에 맞춰 같은 종류로 교체(그래프만 / 식만). 목록에 없으면 컴파일러가 고르는 대로.
const KINDS: Record<string, { kind?: string; figurePolicy?: string }[]> = {
  nonlinear_equations_systems: [{ kind: "linear_quadratic_intersection", figurePolicy: "require_plane" }, {}],
  nonlinear_functions: [{ kind: "vertex_x", figurePolicy: "require_plane" }, { kind: "vertex_y", figurePolicy: "require_plane" }, { kind: "evaluate" }, {}],
  linear_equations_two_var: [{ kind: "intersection_x" }, {}],
  linear_inequalities: [{ kind: "point_in_solution" }, {}],
  systems_linear: [{}],
};

const slots = JSON.parse(readFileSync(path.resolve(arg("--slots")!), "utf-8")) as Slot[];
const setGroups = JSON.parse(readFileSync(path.resolve(arg("--groups")!), "utf-8")) as Record<string, string[]>;
const taken = new Map<string, Set<string>>(); // 세트 → 이미 쓰인 그룹(기존 문항 - 교체될 칸 + 이번에 뽑은 교체 문항)
for (const [n, gs] of Object.entries(setGroups)) taken.set(n, new Set(gs));
for (const s of slots) if (s.group) taken.get(s.name)?.delete(s.group);
const out: Record<string, unknown>[] = [];
const seen = new Set<string>();
for (const s of slots) {
  const meta = SKILL_BY_CODE.get(s.skill_code);
  if (!meta) throw new Error(`unknown skill ${s.skill_code}`);
  let done = false;
  const specs = [...(KINDS[s.skill_code] ?? []), ...getMathSkillKinds(s.skill_code).map((k) => ({ kind: k.value } as { kind?: string; figurePolicy?: string })), {}];
  for (const spec of specs) {
    for (let tries = 0; tries < 60 && !done; tries++) {
      let r: ReturnType<typeof attemptOne>;
      try { r = attemptOne(s.skill_code as MathCompilerSkill, s.difficulty, { compileMs: 0, renderCheckMs: 0 }, spec.figurePolicy, s.format, spec.kind); } catch { continue; }
      if (!r.ok) continue;
      const p = r.problem as unknown as { passage: string; stimulus?: string; question: string; options?: string[]; figure: unknown; subpattern?: string; difficulty?: string };
      if (hasGraphAndExpressionForSameCurves(p.figure as never, String(p.stimulus ?? p.passage))) continue;
      const grp = p.subpattern ? `c:${s.skill_code}:${p.subpattern}` : null;
      if (grp && taken.get(s.name)?.has(grp)) continue;
      const key = `${p.passage}\u0000${p.question}\u0000${(p.options ?? []).join("|")}`;
      if (seen.has(key)) continue;
      seen.add(key); if (grp) taken.get(s.name)?.add(grp);
      const gid = `e1018-t${s.name.replace(/\D+/g, "")}-${s.module_key}-${s.position}`;
      out.push({ slot: { name: s.name, position: s.position, versionId: s.versionId, problemId: s.problemId, skill: s.skill_code, format: s.format, difficulty: s.difficulty, moduleKey: s.module_key, route: s.route },
        rec: { gid, runId: "sat-error-report-1018", skill: s.skill_code, domain: meta.domain, examSystem: "sat_math", difficulty: s.difficulty, format: s.format, createdVia: "compiler", subpattern: p.subpattern ?? null, problem: r.problem, quality: r.quality } });
      done = true;
    }
    if (done) break;
  }
  console.error(`${s.name} #${s.position} ${s.skill_code}/${s.format}/${s.difficulty}: ${done ? "ok" : "컴파일러 미지원 → 적용 때 은행 미사용 문항(같은 skill·형식·난이도)으로 대체"}`);
  // 컴파일러가 그 칸(예: SPR 미지원 skill)을 못 만들면 rec=null — 적용 스크립트가 같은 칸의 은행 미사용 문항으로 채운다.
  if (!done) out.push({ slot: { name: s.name, position: s.position, versionId: s.versionId, problemId: s.problemId, skill: s.skill_code, format: s.format, difficulty: s.difficulty, moduleKey: s.module_key, route: s.route }, rec: null });
}
const file = arg("--out");
if (file) { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify({ generatedAt: "2026-10-19", generator: "scripts/prod-open/gen-slot-replacements.ts", note: "오류 신고 수동 교체 칸별 새 문항(컴파일러, 그래프·식 중복 없음). entries[].rec 는 import.ts 입력 레코드.", count: out.length, entries: out }, null, 1)); }
