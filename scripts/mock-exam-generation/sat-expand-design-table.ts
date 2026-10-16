// 세트별 문항 설계표(내용·기능·표현·추론·중복) 생성 — DB 접근 없음. 실행: npx tsx scripts/mock-exam-generation/sat-expand-design-table.ts --plan DIR --dump proj/dump.json --topics proj/topics.json --out FILE
import { readFileSync, writeFileSync } from "node:fs";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const sets = JSON.parse(readFileSync(`${arg("--plan")}/new-sets.json`, "utf-8")) as any[][];
const names = JSON.parse(readFileSync(`${arg("--plan")}/new-sets-meta.json`, "utf-8")).names as string[];
const dump = JSON.parse(readFileSync(arg("--dump")!, "utf-8")); const topics = JSON.parse(readFileSync(arg("--topics")!, "utf-8"));
const P = new Map<string, any>(dump.problems.map((p: any) => [p.id, p]));
const grpOwner = new Map<string, Set<number>>();
sets.forEach((s, i) => s.forEach((it) => { const g = it.group; if (g) { const m = grpOwner.get(g) ?? new Set(); m.add(i); grpOwner.set(g, m); } }));
const out = sets.map((items, i) => {
  const rows = items.map((it) => {
    const p = P.get(it.problemId); const t = topics[it.problemId];
    return {
      position: it.position, module: it.moduleKey, route: it.route, problemId: it.problemId,
      content: it.section === "rw" ? { subject: t?.subject ?? null, cluster: t?.cluster ?? null } : { domain: it.domain },
      function: it.skill, expression: { format: it.format, subpattern: p?.subpattern ?? null, similarityGroup: it.group },
      reasoning: { difficulty: it.difficulty, depth: it.difficulty === "hard" ? "multi-step/judgment (hard-fit reviewed)" : it.difficulty === "medium" ? "single inference/application" : "direct" },
      duplicate: { acrossSets: it.group ? grpOwner.get(it.group)!.size > 1 : false },
    };
  });
  const groups = new Map<string, number>(); for (const r of rows) if (r.expression.similarityGroup) groups.set(r.expression.similarityGroup, (groups.get(r.expression.similarityGroup) ?? 0) + 1);
  const hardPos = rows.filter((r) => r.reasoning.difficulty === "hard").map((r) => r.position);
  return { name: names[i], sameFrameRepeatsWithinSet: [...groups].filter(([, n]) => n > 2).map(([g, n]) => ({ g, n })), hardPositions: hardPos, rows };
});
const summary = out.map((s) => ({ name: s.name, repeats: s.sameFrameRepeatsWithinSet.length, hard: s.hardPositions.length, hardSpreadFirstThird: s.hardPositions.filter((p) => p <= 49).length }));
writeFileSync(arg("--out")!, JSON.stringify({ solveCheck: "R&W 신규: Fable·Opus 독립 블라인드 풀이 일치+복수정답 없음만 채택; Math: 컴파일러 독립 재계산(verification_js)", sets: out }, null, 1));
console.log(JSON.stringify(summary));
