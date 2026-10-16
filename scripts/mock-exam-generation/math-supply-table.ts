// skill×난이도별 '이 컴파일러 체계로 안전하게 만들 수 있는 수량(중복·유사 제한 반영)'과 AI 부족분 표를 만든다. DB·API 없음.
// 입력: plan.json(3세트분 목표 x10 = 30세트), math-coverage.json(기존 컴파일러 실측), 원형 시드 스윕(2000 시드).
// 실행: npx tsx scripts/mock-exam-generation/math-supply-table.ts
import { readFileSync } from "node:fs";
import { ARCHETYPES } from "../../lib/problem-generation/math-archetypes/registry";
import { sweepArchetype } from "../../lib/problem-generation/math-archetypes/sweep";
const plan = JSON.parse(readFileSync("data/mock-exam-generation/plan.json", "utf-8")) as { cells: { system: string; skill: string; difficulty: string; target: number }[] };
const cov = JSON.parse(readFileSync("data/mock-exam-generation/math-coverage.json", "utf-8")) as { skill: string; difficulty: string; independent100: number; groups: number }[];
const need: Record<string, Record<string, number>> = {};
for (const c of plan.cells) if (c.system === "sat_math") (need[c.skill] ??= {})[c.difficulty] = c.target * 10;
const hard: Record<string, { archetypes: number; capacity: number }> = {};
for (const a of ARCHETYPES) {
  const st = sweepArchetype(a, 2000, { independentCap: 1000 });
  const cap = Math.min(st.independent, 30 * Object.keys(st.variants).length);
  const h = (hard[a.skill] ??= { archetypes: 0, capacity: 0 }); h.archetypes++; h.capacity += cap;
}
const rows: string[] = ["| skill | 필요 easy | 필요 medium | 필요 hard | 기존 컴파일러 안전 생산(easy+medium 합, 프레임 공유) | easy+medium AI 부족분 | 원형 수(파일럿) | 원형 hard 안전 생산 상한 | hard AI 부족분 |", "|---|---|---|---|---|---|---|---|---|"];
let tE = 0, tM = 0, tH = 0, tC = 0, tHC = 0, tGapEM = 0, tGapH = 0;
for (const skill of Object.keys(need)) {
  const n = need[skill]; const e = n.easy ?? 0, m = n.medium ?? 0, h = n.hard ?? 0;
  // 안전 생산 = 본문 유사도 0.6 미만 독립 문항 수와 (유사문항 그룹 수 × 30세트)의 작은 값(세트당 그룹 1문항 제약).
  const ex = Math.max(...cov.filter((c) => c.skill === skill).map((c) => Math.min(c.independent100, 30 * c.groups)), 0);
  const gapEM = Math.max(0, e + m - ex); const hc = hard[skill]?.capacity ?? 0; const gapH = Math.max(0, h - hc);
  tE += e; tM += m; tH += h; tC += Math.min(ex, e + m); tHC += Math.min(hc, h); tGapEM += gapEM; tGapH += gapH;
  rows.push(`| ${skill} | ${e} | ${m} | ${h} | ${Math.min(ex, e + m)} | ${gapEM} | ${hard[skill]?.archetypes ?? 0} | ${hc ? hc : "0(미구현)"} | ${gapH} |`);
}
rows.push(`| **합계** | ${tE} | ${tM} | ${tH} | ${tC} | ${tGapEM} | ${ARCHETYPES.length} | ${tHC}(필요량 이내만) | ${tGapH} |`);
console.log(rows.join("\n"));
