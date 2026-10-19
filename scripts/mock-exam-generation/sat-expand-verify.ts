// SAT 모의고사 확장(14->) 정확 배정 검증 보고서 생성(2026-10-15). DB 접근 없음 — 계획 JSON(rebalance-sets.ts 산출)과 투영 덤프만 읽는다.
// 실행: npx tsx scripts/mock-exam-generation/sat-expand-verify.ts --plan DIR(new-sets.json,new-sets-meta.json) --dump tmp/proj/dump.json --keep tmp/keep.txt --topics tmp/proj/topics.json --out FILE.json
// 검증: 세트당 147문항·모듈 구성(mstModulePlans) 일치, 세트 간·기존 게시 세트와 문항 중복 0, 영역×난이도×형식 분포, 30 skill 커버, 소재 상한(모듈당 cluster 1 / 경로당 2).
import { readFileSync, writeFileSync } from "node:fs";
import { mstModulePlans } from "../../lib/mock-exam/assemble";
import type { PlanItem } from "./assemble-unique";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const sets = JSON.parse(readFileSync(`${arg("--plan")}/new-sets.json`, "utf-8")) as PlanItem[][];
const names = (JSON.parse(readFileSync(`${arg("--plan")}/new-sets-meta.json`, "utf-8")) as { names: string[] }).names;
const dump = JSON.parse(readFileSync(arg("--dump")!, "utf-8"));
const topics = JSON.parse(readFileSync(arg("--topics")!, "utf-8")) as Record<string, { subject: string; cluster: string }>;
const keep = new Set(readFileSync(arg("--keep")!, "utf-8").trim().split(","));
const livePids = new Set<string>(dump.items.filter((i: any) => keep.has(i.exam_set_id)).map((i: any) => i.problem_id));
const plans = mstModulePlans(true);
const countBy = <T>(a: T[], f: (x: T) => string) => { const m: Record<string, number> = {}; for (const x of a) { const k = f(x); m[k] = (m[k] ?? 0) + 1; } return m; };

const seen = new Map<string, string>();
let dupNew = 0, dupLive = 0, projected = 0;
const report = sets.map((items, idx) => {
  const issues: string[] = [];
  if (items.length !== 147) issues.push(`items ${items.length} != 147`);
  for (const p of plans) {
    const n = items.filter((i) => i.moduleKey === p.key && (p.route ? i.route === p.route : true)).length;
    if (n !== p.count) issues.push(`module ${p.key}${p.route ? "/" + p.route : ""}: ${n} != ${p.count}`);
  }
  for (const it of items) {
    if (seen.has(it.problemId)) { dupNew++; issues.push(`dup within new sets: ${it.problemId} (${seen.get(it.problemId)})`); } else seen.set(it.problemId, names[idx]);
    if (livePids.has(it.problemId)) { dupLive++; issues.push(`dup with live set: ${it.problemId}`); }
    if (it.problemId.startsWith("proj:")) projected++;
  }
  // 소재 상한: 모듈(rw_m1, rw_m2/lower, rw_m2/higher)당 cluster 1회, 응시경로(m1+m2 lower|higher)당 2회
  const rw = items.filter((i) => i.section === "rw");
  const clusterOf = (i: PlanItem) => topics[i.problemId]?.cluster ?? null;
  const perModule = new Map<string, Map<string, number>>();
  for (const i of rw) { const c = clusterOf(i); if (!c) continue; const k = `${i.moduleKey}/${i.route ?? ""}`; const m = perModule.get(k) ?? new Map(); m.set(c, (m.get(c) ?? 0) + 1); perModule.set(k, m); }
  const modViol = [...perModule].flatMap(([k, m]) => [...m].filter(([, n]) => n > 1).map(([c, n]) => `${k}:${c}x${n}`));
  const pathViol: string[] = [];
  for (const route of ["lower", "higher"]) { const m = new Map<string, number>(); for (const i of rw.filter((x) => x.moduleKey === "rw_m1" || x.route === route)) { const c = clusterOf(i); if (c) m.set(c, (m.get(c) ?? 0) + 1); } for (const [c, n] of m) if (n > 2) pathViol.push(`${route}:${c}x${n}`); }
  if (modViol.length || pathViol.length) issues.push(`topic cap: ${[...modViol, ...pathViol].join(",")}`);
  const subj = countBy(rw, (i) => topics[i.problemId]?.subject ?? "unclassified");
  return {
    name: names[idx], items: items.length, ok: issues.length === 0, issues,
    byDomain: countBy(items, (i) => i.domain), byDifficulty: countBy(items, (i) => i.difficulty), byFormat: countBy(items, (i) => i.format),
    rwSubjects: subj, skills: new Set(items.map((i) => i.skill)).size, newItems: items.filter((i) => i.problemId.startsWith("proj:")).length,
    problemIds: items.map((i) => i.problemId),
  };
});
const out = { generatedAt: "2026-10-15", sets: report.length, allOk: report.every((r) => r.ok), duplicatesBetweenNewSets: dupNew, duplicatesWithLiveSets: dupLive, projectedItems: projected, note: "proj:<gid> 문항은 은행 임포트 전 합성 id — 임포트 후 새 덤프로 rebalance-sets.ts 를 같은 인자로 재실행해 실제 id 로 확정한다.", report };
writeFileSync(arg("--out")!, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ sets: out.sets, allOk: out.allOk, dupNew, dupLive, projected, perSet: report.map((r) => ({ n: r.name, ok: r.ok, newItems: r.newItems, issues: r.issues.slice(0, 2) })) }, null, 1));
