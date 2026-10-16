// 담당 A 진행표·생산 가능 수량표(마크다운)를 스윕 JSON(archetype-sweep-a.ts --json)에서 만든다.
// 실행: npx tsx scripts/mock-exam-generation/archetype-a-report.ts <sweep.json>
import { readFileSync } from "node:fs";
import { A_ARCHETYPES } from "../../lib/problem-generation/math-archetypes/skills/a-registry";
type Row = { id: string; difficulty: string; seeds: number; produced: number; verifyFail: number; thrown: number; semanticFail: number; independent: number; distinctParams: number; variants: Record<string, number> };
const rows: Row[] = JSON.parse(readFileSync(process.argv[2], "utf-8")); const by = new Map(rows.map((r) => [r.id, r]));
const NEED: Record<string, { easy: number; medium: number; hard: number }> = { nonlinear_equations_systems: { easy: 50, medium: 150, hard: 30 }, nonlinear_functions: { easy: 50, medium: 150, hard: 30 }, equivalent_expressions: { easy: 50, medium: 150, hard: 30 } };
const CAP = 30; const SKILLS = Object.keys(NEED);
// 원형 하나의 생산 가능 수량: 그룹(원형/변형)당 30 이하, 본문 독립 변형·서로 다른 수치 조합 수 이하.
const supply = (a: { id: string }) => { const r = by.get(a.id)!; const groups = Object.keys(r.variants).length; return { groups, cap: Math.min(groups * CAP, r.independent >= 400 ? 9999 : r.independent, r.distinctParams) }; };
console.log("### 진행표(skill · 난이도 · 원형 수 · 합격)\n\n| skill | hard 원형 | hard 합격 | easy 원형 | medium 원형 | easy/medium 합격 | 그룹(easy/medium/hard) |\n|---|---|---|---|---|---|---|");
for (const s of SKILLS) {
  const mine = A_ARCHETYPES.filter((a) => a.skill === s); const h = mine.filter((a) => (a.difficulty ?? "hard") === "hard"), e = mine.filter((a) => a.difficulty === "easy"), m = mine.filter((a) => a.difficulty === "medium");
  const ok = (arr: typeof mine) => arr.filter((a) => { const r = by.get(a.id)!; return !r.verifyFail && !r.thrown && !r.semanticFail && r.independent >= 30; }).length;
  const g = (arr: typeof mine) => arr.reduce((t, a) => t + supply(a).groups, 0);
  console.log(`| ${s} | ${h.length || "파일럿 8(별도)"} | ${h.length ? `${ok(h)}/${h.length}` : "-"} | ${e.length} | ${m.length} | ${ok([...e, ...m])}/${e.length + m.length} | ${g(e)}/${g(m)}/${h.length ? g(h) : "14(파일럿)"} |`);
}
console.log("\n### 세부 패턴별 hard 원형(연산자)\n\n| skill | 세부 패턴 | 연산자 4 | 합격 |\n|---|---|---|---|");
const kinds = new Map<string, typeof A_ARCHETYPES>(); for (const a of A_ARCHETYPES.filter((x) => (x.difficulty ?? "hard") === "hard")) kinds.set(`${a.skill}|${a.kind}`, [...(kinds.get(`${a.skill}|${a.kind}`) ?? []), a]);
for (const [k, arr] of kinds) { const [s, kind] = k.split("|"); console.log(`| ${s} | ${kind} | ${arr.map((a) => a.operator).join(", ")} | ${arr.filter((a) => { const r = by.get(a.id)!; return !r.verifyFail && !r.thrown && r.independent >= 30; }).length}/${arr.length} |`); }
console.log("\n### skill × 난이도 생산 가능 수량(그룹당 30 상한 · 본문 독립 변형 · 서로 다른 수치 조합 중 최소) 대 30세트 필요량\n\n| skill | 난이도 | 그룹(문장 틀) 수 | 생산 가능 | 30세트 필요 | 충족 |\n|---|---|---|---|---|---|");
for (const s of SKILLS) for (const d of ["easy", "medium", "hard"] as const) {
  const arr = A_ARCHETYPES.filter((a) => a.skill === s && (a.difficulty ?? "hard") === d); if (!arr.length) { console.log(`| ${s} | ${d} | 14(파일럿) | 파일럿 8 원형 | ${NEED[s][d]} | 파일럿 완료 |`); continue; }
  const groups = arr.reduce((t, a) => t + supply(a).groups, 0); const cap = arr.reduce((t, a) => t + supply(a).cap, 0);
  console.log(`| ${s} | ${d} | ${groups} | ${cap} | ${NEED[s][d]} | ${cap >= NEED[s][d] ? "충족" : "부족"} |`);
}
console.log("\n### 원형별 스윕 결과\n\n| 원형 | 난이도 | 생성/시드 | 검증 실패 | 독립 변형(0.6 미만, 상한 400) | 서로 다른 수치 조합 | 그룹 |\n|---|---|---|---|---|---|---|");
for (const a of A_ARCHETYPES) { const r = by.get(a.id)!; console.log(`| ${a.id} | ${r.difficulty} | ${r.produced}/${r.seeds} | ${r.verifyFail + r.thrown + r.semanticFail} | ${r.independent} | ${r.distinctParams} | ${Object.keys(r.variants).length} |`); }
console.log("\n### hard 원형 메타데이터(추가 요구 사고)\n\n| 원형 | 연산자 | 풀이 구조 | 추가 요구 사고(medium 대비) | 결합 개념 | medium 단계 |\n|---|---|---|---|---|---|");
for (const a of A_ARCHETYPES.filter((x) => (x.difficulty ?? "hard") === "hard")) console.log(`| ${a.id} | ${a.operator} | ${a.structure} | ${a.extraThinking} | ${a.concepts.join(", ")} | ${a.mediumSteps} |`);
console.log("\n### easy/medium 원형(문장 틀 = 유사문항 그룹)\n\n| 원형 | 난이도 | 틀 |\n|---|---|---|");
for (const a of A_ARCHETYPES.filter((x) => x.difficulty && x.difficulty !== "hard")) console.log(`| ${a.id} | ${a.difficulty} | ${a.structure} |`);
