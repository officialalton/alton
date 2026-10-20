// 식만 남긴 SAT Math 패치 7건(E1019-M011~M017, 08_manual_patches) 확인·정정 SQL 생성기(백로그 B3, 2026-10-19).
//   npx tsx scripts/prod-open/sat-expr-only-fixes-sql.ts [--out data/prod-open/sat-expand-sql]
//   산출: 23_expr_only_fixes.sql · 99_expr_only_rollback.sql · 23_preflight.sql · 23_verify.sql · 23_expr_only_fixes.report.json
// 확인 결과(원격 현재 공개 버전 읽기 SELECT, 독립 풀이로 정답 재계산): 7건 모두 그림이 없고(figure=null) 지문에 필요한 식이 다 있으며 정답 키가 맞다.
//   figure_checked=false 는 그림 없는 버전의 기본값이다(관리자 편집기도 그림이 있을 때만 true 로 저장) — 정정 대상이 아니다.
//   다만 해설 오류 3건을 새 problem_version 으로 정정한다(E1019-X*):
//   - M012(4cc47e7c) 보기 D(150) 해설이 "고정비를 두 번 더함"인데 그러면 165 가 된다 → 25(3+3)=150(시간을 두 배로 착각)으로, 보기 A(70) 해설도 구체화(25+45).
//   - M014(9977438d) 보기 5 해설이 앞뒤가 맞지 않는 서술 → "x=2.5 일 때 2x=5 에서 멈춤"으로.
//   - M016(f59b7f57) 지문의 단가 $6$·$3$ 이 통화 표시 없는 수식으로 렌더링 → \$6·\$3.
// 원격은 읽기 SELECT 만. 적용은 총괄이 `supabase db query --linked -f 23_expr_only_fixes.sql` 로 한다(새 problem_versions 만, 삭제·덮어쓰기 없음, 멱등).
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { planPatch, type Patch, type PatchChange, type PatchPlan, type ProblemReadout } from "../../lib/audit-fix/plan";
import { emitApplySql, emitRollbackSql, toSqlPlan } from "../../lib/audit-fix/sql";
import { PROBLEM_SELECT } from "../audit/apply-audit-fixes";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const OUT = path.resolve(arg("--out") ?? "data/prod-open/sat-expand-sql");
function dbRows<T = any>(sql: string): T[] {
  const r = spawnSync("supabase", ["db", "query", "--linked", sql], { encoding: "utf-8", maxBuffer: 512 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`supabase db query 실패: ${(r.stderr || r.stdout).slice(0, 400)}`);
  const o = r.stdout; return (JSON.parse(o.slice(o.indexOf("{"), o.lastIndexOf("}") + 1)) as { rows: T[] }).rows;
}

type Cur = { passage: string | null; question: string | null; explanation: string | null; explanation_en: string | null };
const once = (s: string | null, re: RegExp, to: string, what: string) => { if (!s || !re.test(s)) throw new Error(`패치 대상 문장을 찾지 못함: ${what}`); return s.replace(re, to); };
const SPECS: { prefix: string; set: string; why: string; next: (c: Cur) => Partial<Cur> }[] = [
  { prefix: "4cc47e7c", set: "T1 m2#28", why: "해설 정정: 보기 D(150)는 25(3+3)(시간을 두 배로), 보기 A(70)는 25+45(곱셈 없이 더함)",
    next: (c) => ({
      explanation: once(once(c.explanation, /Choice A \(70\) incorrectly computes 25\(3\) - 5 or similar miscalculation\./, "Choice A (70) comes from adding the hourly rate and the flat fee once (25 + 45) instead of multiplying the rate by 3 hours.", "M012 A ko"),
        /Choice D \(150\) incorrectly adds the flat fee twice or uses 25\(3\+3\)\./, "Choice D (150) comes from using 6 hours instead of 3, that is, 25(3 + 3) = 150.", "M012 D ko"),
      explanation_en: once(once(c.explanation_en, /Choice A \(70\) comes from a miscalculation such as 25\(3\) - 5\./, "Choice A (70) comes from adding the hourly rate and the flat fee once (25 + 45) instead of multiplying the rate by 3 hours.", "M012 A en"),
        /Choice D \(150\) comes from adding the flat fee twice or from computing 25\(3\+3\)\./, "Choice D (150) comes from using 6 hours instead of 3, that is, 25(3 + 3) = 150.", "M012 D en"),
    }) },
  { prefix: "9977438d", set: "T3 m1#15", why: "해설 정정: 보기 5 는 x=2.5 일 때 2x=5 에서 멈추고 상수항 3 을 더하지 않은 경우",
    next: (c) => ({
      explanation: once(c.explanation, /^- 5:.*$/m, "- 5: $x = 2.5$일 때 $2x = 5$에서 멈추고 상수항 $3$을 더하지 않은 경우이다.", "M014 5 ko"),
      explanation_en: once(c.explanation_en, /^- 5:.*$/m, "- 5: This is the value of $2x$ when $x = 2.5$; it comes from stopping before adding the constant term $3$.", "M014 5 en"),
    }) },
  { prefix: "f59b7f57", set: "T21 m2#30", why: "지문 정정: 단가 $6$·$3$ 을 통화 표시(\\$6·\\$3)로(수식 렌더링으로 단위가 사라짐)",
    next: (c) => ({ passage: once(c.passage, /sells for \$6\$ and each pepper seedling sells for \$3\$/, "sells for \\$6 and each pepper seedling sells for \\$3", "M016 price") }) },
];

const ids = dbRows<{ id: string }>(`select id from problems where id::text ~ '^(${SPECS.map((s) => s.prefix).join("|")})'`).map((r) => r.id);
if (ids.length !== SPECS.length) { console.error(`문항 ${ids.length}/${SPECS.length}건만 찾음`); process.exit(1); }
const readouts = dbRows<ProblemReadout>(PROBLEM_SELECT(`p.id = any (array[${ids.map((i) => `'${i}'`).join(",")}]::uuid[])`));
const plans: PatchPlan[] = []; const items: unknown[] = [];
SPECS.forEach((s, i) => {
  const pid = ids.find((x) => x.startsWith(s.prefix))!;
  const id = `E1019-X${String(i + 1).padStart(3, "0")}`;
  const r = readouts.find((x) => x.problem_id === pid);
  if (!r?.pub) throw new Error(`${pid} 공개 버전 없음`);
  const cur = r.pub as unknown as Cur;
  const nx = s.next(cur);
  const changes: PatchChange[] = Object.entries(nx).filter(([f, v]) => JSON.stringify((cur as any)[f] ?? null) !== JSON.stringify(v ?? null)).map(([field, v]) => ({ field, old: (cur as any)[field] ?? null, new: v ?? null }));
  const p: Patch = { id, problemId: pid, expectVersionId: r.published_version_id ?? undefined, kind: "sat", why: s.why, changes };
  const already = (r.pub.quality as any)?.auditFix?.patch === id;
  plans.push(already ? ({ ...planPatch({ ...p, expectVersionId: undefined }, r), status: "already" } as PatchPlan) : planPatch(p, r));
  items.push({ patch: id, problemId: pid, set: s.set, fields: changes.map((c) => c.field), why: s.why, currentPatch: (r.pub.quality as any)?.auditFix?.patch ?? null, figure_checked: r.pub.figure_checked });
});
const tally: Record<string, number> = {}; for (const p of plans) tally[p.status] = (tally[p.status] ?? 0) + 1;
console.log("plan status:", tally);
for (const p of plans) { if (p.status !== "apply" && p.status !== "already") console.log(`  ${p.patchId} ${p.status}: ${p.reasons.join(" | ").slice(0, 300)}`); for (const w of p.warnings) console.log(`  warn ${p.patchId}: ${w.slice(0, 160)}`); }
if (plans.some((p) => p.status !== "apply" && p.status !== "already")) { console.error("계획 실패 — 파일을 쓰지 않고 중단"); process.exit(1); }

const sqlPlan = toSqlPlan(plans, [], "scripts/prod-open/sat-expr-only-fixes-sql.ts");
const HDR = (w: string) => `-- ${w}\n-- generated by scripts/prod-open/sat-expr-only-fixes-sql.ts. Run: npx supabase db query --linked -f <this file>. Idempotent; new problem_versions only; no deletes/overwrites; set composition untouched.\n`;
const idList = `array[${ids.map((i) => `'${i}'`).join(",")}]::uuid[]`;
mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, "23_expr_only_fixes.sql"), emitApplySql(sqlPlan).replace("External audit fixes 2026-10-13 - APPLY", "SAT expression-only patch review 2026-10-19 (E1019-X*) - explanation/format fixes as new problem versions (no set changes)"));
writeFileSync(path.join(OUT, "99_expr_only_rollback.sql"), emitRollbackSql(sqlPlan, []));
writeFileSync(path.join(OUT, "23_preflight.sql"), `${HDR("preflight for 23 (SELECT only): the 7 expression-only problems - current published version, figure state, in-flight drafts")}
select p.id as problem_id, pv.version_no, pv.quality->'auditFix'->>'patch' as patch, pv.figure is null as no_figure, pv.figure_checked,
  (select count(*) from problem_versions v where v.problem_id = p.id and v.status in ('draft', 'in_review')) as inflight_versions,
  (select string_agg(distinct s.name || ' (' || s.status || ')', ', ') from mock_exam_set_items i join mock_exam_sets s on s.id = i.exam_set_id where i.problem_id = p.id and s.status in ('published', 'draft')) as used_in
from problems p join problem_versions pv on pv.id = p.published_version_id where p.id::text ~ '^(3cdc0ad5|4cc47e7c|e90ca1b1|9977438d|e1f8fcfb|f59b7f57|d1e251f0)' order by p.id;
`);
writeFileSync(path.join(OUT, "23_verify.sql"), `${HDR("verify after 23 (SELECT only): the 3 problems are on E1019-X* versions; the other 4 expression-only problems are unchanged")}
select p.id as problem_id, pv.version_no, pv.quality->'auditFix'->>'patch' as patch, pv.figure is null as no_figure,
  pv.explanation_en ~ 'adding the flat fee twice' as stale_m012_d, pv.explanation_en ~ 'miscalculating' as stale_m014_5, pv.passage ~ 'sells for \\$6\\$' as stale_m016_price
from problems p join problem_versions pv on pv.id = p.published_version_id where p.id = any (${idList}) order by 3;
select count(*) as expr_only_still_figureless from problems p join problem_versions pv on pv.id = p.published_version_id where p.id::text ~ '^(3cdc0ad5|4cc47e7c|e90ca1b1|9977438d|e1f8fcfb|f59b7f57|d1e251f0)' and pv.figure is null;
`);
writeFileSync(path.join(OUT, "23_expr_only_fixes.report.json"), JSON.stringify({ count: plans.length, tally, reviewed: ["E1019-M011", "E1019-M012", "E1019-M013", "E1019-M014", "E1019-M015", "E1019-M016", "E1019-M017"], items }, null, 1));
console.log("wrote 23_expr_only_fixes.sql, 99_expr_only_rollback.sql, 23_preflight.sql, 23_verify.sql, 23_expr_only_fixes.report.json");
