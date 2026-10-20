// SAT 수동 결함 패치(2026-10-19): 그래프+식 중복 문항을 새 problem_version 으로 고치는 SQL 생성기.
//   - 08_manual_patches.sql  : 새 problem_versions(옛 버전 보존, 세트 구성 불변, 멱등, 삭제·덮어쓰기 없음)
//   - 98_manual_rollback.sql : 이 패치가 만든 새 버전을 쓰기 전 공개 버전으로 되돌림(problems.published_version_id 복원)
//   - 08_preflight.sql       : 적용 전 읽기 전용 점검(대상 문항의 현재 공개 버전/진행 중 초안 유무)
// DB 에는 읽기 SELECT(`supabase db query --linked`)만 쓴다. 실행: npx tsx scripts/prod-open/sat-manual-patches-sql.ts [--out data/prod-open/sat-expand-sql]
// 결함 판정: 공개 SAT 세트(Test 1~26) Math 문항 중 그래프(plane 그림)와 지문 식이 같은 곡선을 둘 다 완전하게 주는 것
//   (scripts/audit/sat-math-graph-scan2.ts 로 후보 전수 → 사람이 읽고 확정). 그래프 읽기 문항은 식을 빼 그래프만, 계산 문항은 그림을 뺀다.
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

type Cur = { passage: string | null; question: string | null; explanation: string | null; explanation_en: string | null; figure: unknown };
type Spec = { id: string; set: string; kind: "graph-only" | "expression-only"; why: string; next: (c: Cur) => Partial<Cur> };
const P = "THE_ID";
const S: Spec[] = [
  // ── 그래프 읽기: 식을 지문에서 빼고 그래프만 남긴다 ──
  { id: "01d7207e-c5d8-4b93-a2ea-ba5b57b7ff0e", set: "T1 m1#10", kind: "graph-only", why: "그래프 읽기(교량 아치): 식 h(x)=-0.5x²+4x 삭제, 그래프만 제시",
    next: () => ({ passage: "A city planner models the height of a pedestrian bridge arch above a walkway, where $x$ is the horizontal distance in meters from the base of the arch and $h(x)$ is the height in meters. The graph of $h$ is shown.",
      explanation: "그래프에서 곡선이 가장 높은 점(꼭짓점)에 이르는 곳의 x좌표를 읽는다. 곡선은 x = 0과 x = 8에서 x축과 만나고, 좌우 대칭이므로 정점은 그 가운데인 x = 4에서 나타난다. 따라서 최대 높이가 되는 x는 4이다. 다른 선택지는 x절편(0, 8)이나 정점이 아닌 임의의 점을 최댓값 위치로 착각한 경우다.",
      explanation_en: "Read the graph for the x-coordinate of the highest point on the curve. The curve meets the x-axis at x = 0 and x = 8 and is symmetric, so its peak lies midway, at x = 4. Therefore the arch reaches its maximum height at x = 4. The other choices mistake the x-intercepts or an arbitrary point for the location of the maximum." }) },
  { id: "079d2fb7-55f3-455f-a32c-32b252e0da59", set: "T1 m1#3", kind: "graph-only", why: "그래프 읽기(지수함수와 y=24): 식 삭제, 그래프만 제시",
    next: () => ({ passage: "The graph of an exponential function $r$ and the horizontal line $y = 24$ are shown in the same $xy$-plane.",
      explanation: "그래프에서 곡선 $y = r(x)$와 직선 $y = 24$가 만나는 점의 $x$좌표를 읽는다. 두 그래프는 $x = 3$에서 교차하므로 $r(x) = 24$를 만족하는 값은 $x = 3$이다. 따라서 정답은 B번이다.",
      explanation_en: "Read the $x$-coordinate of the point where the curve $y = r(x)$ meets the line $y = 24$. The two graphs intersect at $x = 3$, so $r(x) = 24$ when $x = 3$. Therefore the answer is B." }) },
  { id: "0b94e63d-1d30-4fdb-ad23-2ea8895e0978", set: "T1 m1#12", kind: "graph-only", why: "그래프 읽기(분수 물줄기): 식 삭제, 그래프만 제시",
    next: () => ({ passage: "The function $f$ models the height, in feet, of a water arc from a decorative fountain jet, where $x$ is the horizontal distance, in feet, from the jet's base. The graph of $y = f(x)$ is shown.",
      explanation: "그래프에서 $x = 1$일 때의 높이는 0이다(곡선이 x축 위의 점 $(1, 0)$을 지난다). 같은 높이 0을 갖는 다른 점을 찾으면 곡선이 x축과 다시 만나는 $x = 5$이다. 포물선은 꼭짓점의 수직선 $x = 3$에 대해 대칭이므로 $x = 1$의 대칭점이 $x = 5$이다. 따라서 답은 $x = 5$이다.",
      explanation_en: "On the graph, the height at $x = 1$ is 0 (the curve passes through the point $(1, 0)$). The other point on the curve at the same height 0 is where the curve meets the x-axis again, at $x = 5$. The parabola is symmetric about the vertical line through its vertex, $x = 3$, so the mirror image of $x = 1$ is $x = 5$. The answer is $x = 5$." }) },
  { id: "1473eff6-7ef8-48a6-add7-d241754fdec6", set: "T1 m2#35", kind: "graph-only", why: "그래프 읽기(아치 로고): 식 삭제, 그래프만 제시",
    next: () => ({ passage: "A graphic designer creates a parabolic arch logo. The function $f$ models the height (in inches) of the arch above the baseline, where $x$ is the horizontal distance (in inches) from the left edge of the logo. The graph of $y = f(x)$ is shown in the xy-plane.",
      explanation: "높이가 0이 되는 지점은 그래프가 x축과 만나는 x절편이다. 그래프를 보면 포물선이 x축과 $x = 1$과 $x = 7$에서 만난다. 따라서 높이가 0이 되는 두 값은 $x = 1$과 $x = 7$이고, 정답은 D번이다.",
      explanation_en: "The arch's height is 0 where the graph meets the x-axis, at the x-intercepts. On the graph, the parabola crosses the x-axis at $x = 1$ and $x = 7$. So the two values of $x$ where the height is 0 are $x = 1$ and $x = 7$, and the answer is D." }) },
  { id: "2c4d3a89-40e8-4de9-9d80-7d91657c2674", set: "T1 m2#45", kind: "graph-only", why: "그래프 읽기(소행성 고도): 식 삭제, 그래프만 제시",
    next: () => ({ passage: "An astronomer tracks the altitude of a small asteroid above the horizon, in degrees, as a function $h$ of time $t$, in hours, after it rises. The graph of $y = h(t)$, including the point where the asteroid's altitude equals $12$ degrees, is shown below.",
      explanation: "그래프에서 직선 $y = 12$가 곡선 $y = h(t)$와 만나는 두 교점이 P(2, 12)와 Q(6, 12)로 표시되어 있으므로, 고도가 12도가 되는 시각은 $t = 2$와 $t = 6$이다. 따라서 정답은 D번이다.",
      explanation_en: "On the graph, the line $y = 12$ meets the curve $y = h(t)$ at the two marked points P(2, 12) and Q(6, 12), so the altitude is 12 degrees at $t = 2$ and $t = 6$. So the answer is D." }) },
  { id: "c93ba362-8516-4e33-b085-ce1b5615787d", set: "T16 m1#6 (신규 세트 Math 수동 2건 중 1)", kind: "graph-only", why: "그래프 읽기(세균 군집): 식 삭제, 그래프만 제시",
    next: () => ({ passage: "A biologist models the population of a bacterial colony, in thousands, $t$ hours after an experiment begins. The graph of the population function $P$ is shown below.",
      explanation: "초기 개체 수는 $t = 0$일 때의 값이다. 그래프에서 곡선이 $t = 0$일 때 $y$축과 만나는 점의 높이를 읽으면 2이다. 따라서 $P(0) = 2$, 즉 초기 개체 수는 2천 마리이고 정답은 B번이다.",
      explanation_en: "The initial population is the value at $t = 0$. On the graph, the curve meets the $y$-axis at a height of 2 when $t = 0$. So $P(0) = 2$, meaning the initial population is 2 thousand, and the answer is B." }) },
  { id: "dcea79ab-0a4c-4923-8c01-21b87e30d90d", set: "T3 m1#19", kind: "graph-only", why: "그래프 읽기(포물선 아치웨이): 식 삭제, 그래프만 제시",
    next: () => ({ passage: "An architectural historian studies the profile of a parabolic archway in a 19th-century train station. The function $h$ models the height, in feet, of the underside of the arch at a horizontal distance $x$ feet from one base of the arch, where the graph of $h$ is shown.",
      explanation: "그래프에서 아치의 밑변에 해당하는 두 점 A(0, 0)와 B(12, 0)가 x절편으로 표시되어 있다. 아치의 밑변 너비는 두 x절편 사이의 거리이므로 $12 - 0 = 12$피트이다. 정답은 C번이다.",
      explanation_en: "On the graph, points A(0, 0) and B(12, 0), which correspond to the base of the arch, are marked as the x-intercepts. The width of the arch at its base is the distance between the two x-intercepts, which is $12 - 0 = 12$ feet. The answer is C." }) },
  { id: "eaac2a72-9970-466d-b509-1c34b9b80a26", set: "T19 m1#8", kind: "graph-only", why: "그래프 읽기(포물선과 y=3): 식 삭제, 그래프만 제시",
    next: () => ({ passage: "The graphs of a quadratic function $f$ and the horizontal line $y = 3$ are shown in the same coordinate plane.",
      explanation: "그래프에서 포물선과 직선 $y = 3$이 만나는 두 점의 x좌표를 읽으면 $x = -2$와 $x = 2$이다. 두 점은 원점을 기준으로 좌우 대칭이므로 x좌표의 합은 $-2 + 2 = 0$이다.",
      explanation_en: "On the graph, the parabola and the line $y = 3$ meet at the points with $x$-coordinates $-2$ and $2$. The two points are symmetric about the $y$-axis, so the sum of the $x$-coordinates is $-2 + 2 = 0$." }) },
  { id: "58c8d686-47e7-4ce7-95fe-ebfda36d4e60", set: "T2 m2#31", kind: "graph-only", why: "그래프 읽기(침입종 개체 수): 식 삭제, 그래프만 제시",
    next: () => ({ passage: "A biologist studying the spread of an invasive plant species models the number of plants, $N(t)$, in a field $t$ years after the species was first observed. The graph of $y = N(t)$ is shown for $0 \\le t \\le 5$.",
      explanation: "그래프에서 곡선이 $y = 300$ 높이를 넘어서는 지점의 $t$값을 읽는다. $t = 4$일 때 곡선은 아직 300보다 한참 아래(약 200)에 있고, $t = 5$ 근처에서 300에 도달한다. 가장 가까운 정수는 $t = 5$이다.",
      explanation_en: "Read the $t$-value on the graph where the curve rises above the height $y = 300$. At $t = 4$ the curve is still well below 300 (about 200), and it reaches 300 near $t = 5$. The nearest whole number is $t = 5$." }) },
  { id: "2d39235f-33fc-44e9-9945-777c44395d5a", set: "T2 m1#1", kind: "graph-only", why: "그래프 읽기(정원 넓이): 식 삭제, 그래프만 제시",
    next: () => ({ passage: "A rectangular garden has a length that is $3$ meters more than its width $w$. The area $A$ of the garden, in square meters, is a function of $w$. The graph of $y = A(w)$ is shown for $w \\ge 0$.",
      explanation: "그래프에서 $y = 40$ (넓이 40 제곱미터)일 때의 $w$값을 읽으면 곡선이 점 $(5, 40)$을 지난다. 따라서 넓이가 40 제곱미터가 되는 너비는 $w = 5$이다.",
      explanation_en: "On the graph, find the $w$-value where $y = 40$ (an area of 40 square meters). The curve passes through the point $(5, 40)$. So the width that gives an area of 40 square meters is $w = 5$." }) },
  // ── 계산 문항: 같은 식을 이미 주므로 그림(그래프)을 뺀다 ──
  { id: "3cdc0ad5-a948-4e18-9906-a91e90334fdb", set: "T2 m1#10", kind: "expression-only", why: "계산 문항(꼭짓점 높이): 식을 이미 주므로 그래프 삭제",
    next: (c) => ({ passage: (c.passage ?? "").replace(" The graph of $f$ is shown.", ""), figure: null }) },
  { id: "4cc47e7c-e766-47d8-aa9b-ae16aeb96d71", set: "T1 m2#28", kind: "expression-only", why: "계산 문항(대입): 식을 이미 주므로 그래프 삭제", next: () => ({ figure: null }) },
  { id: "e90ca1b1-6000-4e2d-9346-c6f757d5bed7", set: "T10 m2#58", kind: "expression-only", why: "계산 문항(두 직선 교점): 식을 이미 주므로 그래프 삭제",
    next: (c) => ({ passage: (c.passage ?? "").replace("The graphs of both equations are shown, intersecting at point $Q$.", "The two lines intersect at point $Q$."),
      question: "What is the $x$-coordinate of point $Q$, the intersection of the two lines?", figure: null,
      explanation: (c.explanation ?? "").replace(" 그래프에서 점 Q도 이 위치에서 두 직선이 교차함을 보여주므로 정답은 B번이다.", " 따라서 점 Q의 x좌표는 5이고 정답은 B번이다."),
      explanation_en: (c.explanation_en ?? "").replace(" The graph also shows the two lines crossing at point Q at this location, so the answer is B.", " So the x-coordinate of point Q is 5, and the answer is B.") }) },
  { id: "9977438d-6d27-48ed-aebb-c4ad8e08c6c0", set: "T3 m1#15", kind: "expression-only", why: "계산 문항(연립방정식): 식을 이미 주므로 그래프 삭제",
    next: (c) => ({ passage: (c.passage ?? "").replace(" The graphs of both equations are shown.", ""), question: "What is the value of $y$ in the solution to the system of equations?", figure: null }) },
  { id: "e1f8fcfb-fbe0-45e7-819a-a38851a50e39", set: "T19 m1#7 (신규 세트 Math 수동 2건 중 1)", kind: "expression-only", why: "계산 문항(두 직선 연립): 식을 이미 주므로 그래프 삭제", next: () => ({ figure: null }) },
  { id: "f59b7f57-b596-4235-9902-d8036d9040ff", set: "T21 m2#30", kind: "expression-only", why: "계산 문항(연립방정식): 식을 이미 주므로 그래프 삭제", next: () => ({ figure: null }) },
  { id: "d1e251f0-cebc-4187-b79c-37da71685423", set: "T2 m2#57", kind: "expression-only", why: "계산 문항(직선 y절편): 그래프가 정답(y절편)을 그대로 보여주므로 그래프 삭제", next: () => ({ figure: null }) },
];
void P;

const ids = S.map((s) => s.id);
const readouts = dbRows<ProblemReadout>(PROBLEM_SELECT(`p.id = any (array[${ids.map((i) => `'${i}'`).join(",")}]::uuid[])`));
const bySet = new Map<string, string>();
const patches: Patch[] = [];
const plans: PatchPlan[] = [];
S.forEach((s, i) => {
  const r = readouts.find((x) => x.problem_id === s.id);
  const id = `E1019-M${String(i + 1).padStart(3, "0")}`;
  bySet.set(id, s.set);
  if (!r?.pub) { plans.push({ patchId: id, gid: null, problemId: s.id, status: "not_in_db", reasons: ["문항 없음"], warnings: [], fromVersionId: null, fromVersionNo: null, changed: [], before: {}, after: {}, expect: {}, set: {}, target: {}, args: null, renderCheck: null, quality: null, auditFix: null, placements: [] }); return; }
  const cur = r.pub as unknown as Cur;
  const nx = s.next(cur);
  const changes: PatchChange[] = Object.entries(nx).filter(([f, v]) => JSON.stringify((cur as any)[f] ?? null) !== JSON.stringify(v ?? null)).map(([field, v]) => ({ field, old: (cur as any)[field] ?? null, new: v ?? null }));
  // 이미 적용돼 있으면(같은 패치 id 가 공개 버전에 기록) 건너뛰는 멱등 처리는 SQL 쪽(expect)이 맡는다 — 여기서는 현재 상태 기준으로 계획한다.
  const p: Patch = { id, problemId: s.id, expectVersionId: r.published_version_id ?? undefined, kind: "sat", why: `[${s.kind}] ${s.why}`, changes };
  patches.push(p);
  const already = (r.pub.quality as any)?.auditFix?.patch === id;
  plans.push(already ? ({ ...planPatch({ ...p, expectVersionId: undefined }, r), status: "already" } as PatchPlan) : planPatch(p, r));
});

const tally: Record<string, number> = {};
for (const p of plans) tally[p.status] = (tally[p.status] ?? 0) + 1;
console.log("plan status:", tally);
for (const p of plans) if (p.status !== "apply" && p.status !== "already") console.log(`  ${p.patchId} ${bySet.get(p.patchId)} ${p.status}: ${p.reasons.join(" | ").slice(0, 300)}`);
for (const p of plans) for (const w of p.warnings) console.log(`  warn ${p.patchId}: ${w.slice(0, 120)}`);
const bad = plans.filter((p) => p.status !== "apply" && p.status !== "already");
if (bad.length) { console.error(`계획 실패 ${bad.length}건 — 파일을 쓰지 않고 중단`); process.exit(1); }

const sqlPlan = toSqlPlan(plans, [], "scripts/prod-open/sat-manual-patches-sql.ts");
const HDR = (w: string) => `-- ${w}\n-- generated by scripts/prod-open/sat-manual-patches-sql.ts. Run: npx supabase db query --linked -f <this file>. Idempotent; new problem_versions only; no deletes/overwrites; set composition untouched.\n`;
mkdirSync(OUT, { recursive: true });
const apply = emitApplySql(sqlPlan).replace("External audit fixes 2026-10-13 - APPLY", "SAT manual graph+expression patches 2026-10-19 - new problem versions (no set changes)");
writeFileSync(path.join(OUT, "08_manual_patches.sql"), apply);
const rb = emitRollbackSql(sqlPlan, []);
writeFileSync(path.join(OUT, "98_manual_rollback.sql"), rb);
const idList = `array[${ids.map((i) => `'${i}'`).join(",")}]::uuid[]`;
writeFileSync(path.join(OUT, "08_preflight.sql"), `${HDR("preflight for 08_manual_patches (SELECT only) - current published version, in-flight drafts and where each problem is used")}
select p.id as problem_id, p.status::text as pstatus, pv.version_no as pub_version_no, pv.quality->'auditFix'->>'patch' as already_patch,
  (select count(*) from problem_versions v where v.problem_id = p.id and v.status in ('draft', 'in_review')) as inflight_versions,
  (select string_agg(distinct s.name || ' (' || s.status || ')', ', ') from mock_exam_set_items i join mock_exam_sets s on s.id = i.exam_set_id where i.problem_id = p.id and s.status in ('published', 'draft')) as used_in
from problems p join problem_versions pv on pv.id = p.published_version_id where p.id = any (${idList}) order by p.id;
select count(*) as expected_17, count(*) filter (where p.status = 'confirmed') as confirmed, count(*) filter (where exists (select 1 from problem_versions v where v.problem_id = p.id and v.status in ('draft', 'in_review'))) as with_inflight_drafts from problems p where p.id = any (${idList});
`);
writeFileSync(path.join(OUT, "08_verify.sql"), `${HDR("verify after 08_manual_patches (SELECT only)")}
select count(*) as patched_published_versions from problems p join problem_versions pv on pv.id = p.published_version_id where p.id = any (${idList}) and pv.quality->'auditFix'->>'patch' like 'E1019-M%';
select p.id as problem_id, pv.version_no, pv.quality->'auditFix'->>'patch' as patch, pv.figure is null as figure_removed, left(pv.passage, 90) as passage from problems p join problem_versions pv on pv.id = p.published_version_id where p.id = any (${idList}) order by 3;
`);
writeFileSync(path.join(OUT, "08_manual_patches.report.json"), JSON.stringify({ count: plans.length, tally, items: S.map((s, i) => ({ patch: `E1019-M${String(i + 1).padStart(3, "0")}`, problemId: s.id, set: s.set, kind: s.kind, why: s.why })) }, null, 1));
console.log(`wrote 08_manual_patches.sql (${apply.length} bytes), 98_manual_rollback.sql, 08_preflight.sql, 08_verify.sql`);
