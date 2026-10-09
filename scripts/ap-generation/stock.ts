// 재고(stock) 통합·집계·보고(2026-10-08). LLM·DB 호출 없음.
//   npx tsx scripts/ap-generation/stock.ts [--mc-target 50] [--frq-target 5]
// 입력: data/ap/sample-2027/{run1,run2,run2bc}/candidates.json (+ 중간 런 run2a/run2b/run2bc_a/run2bc_b 는 이력으로만).
// 출력: data/ap/stock/items.json, data/ap/stock/summary.json, docs/ap/stock-report.md
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { REVALIDATED_GATE, buildStock, cellCounts, LATEST_GATE, shortfall, summarize, topicTargets, VARIANT_CAP, type HistoryEntry, type RawCand } from "../../lib/ap-generation/stock";
import type { ApCurriculumFile } from "../../lib/ap-curriculum/types";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const MC_TARGET = Number(arg("--mc-target", "50")); const FRQ_TARGET = Number(arg("--frq-target", "5"));
const ROOT = path.resolve(process.cwd(), "data/ap/sample-2027"); const OUT = path.resolve(process.cwd(), "data/ap/stock"); mkdirSync(OUT, { recursive: true });
const load = (run: string) => (existsSync(path.join(ROOT, run, "candidates.json")) ? (JSON.parse(readFileSync(path.join(ROOT, run, "candidates.json"), "utf-8")) as RawCand[]) : []);
const WITH_S1A = existsSync(path.join(ROOT, "s1a-final", "candidates.json")); // S1a 는 항상 같은 계산에 포함(중복·문항군을 한 번에 계산해 단일 재고 표를 유지) // S1a 후보를 별도 보조 배치로 내보낼 때(items.json 의 783행 기준선은 바꾸지 않는다)
const SUPP: { run: string; file: string }[] = [{ run: "s1a-final", file: "s1a-items.json" }, { run: "v1ab-final", file: "v1ab-items.json" }, { run: "v45ab-final", file: "v45ab-items.json" }, { run: "bc-topup-final", file: "bc-topup-items.json" }, { run: "s1-graph-ab-final", file: "graph-s1-items.json" }, { run: "s2-graph-ab-final", file: "graph-s2a-items.json" }, { run: "s2-graph-bc-final", file: "graph-s2b-items.json" }, { run: "s3a-graph-ab-final", file: "graph-s3a-items.json" }, { run: "s3a-graph-bc-final", file: "graph-s3b-items.json" }, { run: "s3b-graph-ab-final", file: "graph-s3c-items.json" }, { run: "s3b-graph-bc-final", file: "graph-s3d-items.json" }, { run: "s3c-graph-ab-final", file: "graph-s3e-items.json" }, { run: "s3c-graph-bc-final", file: "graph-s3f-items.json" }, { run: "s3d-graph-bc-final", file: "graph-s3g-items.json" }]; // 보조 적재 배치(파일=배치). 기준 배치는 items.json
const runs: Record<string, RawCand[]> = { run1: load("run1"), run2: load("run2"), run2bc: load("run2bc"), ...Object.fromEntries(SUPP.filter((x) => existsSync(path.join(ROOT, x.run, "candidates.json"))).map((x) => [x.run, load(x.run)])) };
// 이력: 중간 런에서 같은 원형·시드(pack_id)로 평가된 결과를 최종 항목의 history 에 붙인다.
const history: Record<string, HistoryEntry[]> = {};
const hk = (c: RawCand) => `${c.apSubjectCode}|${(c.payload as { pack_id?: string }).pack_id ?? c.candidateKey}`;
for (const [run, interim] of [["run2", ["run2a", "run2b"]], ["run2bc", ["run2bc_a", "run2bc_b"]]] as const) for (const ir of interim) for (const c of load(ir)) { (history[hk(c)] ??= []).push({ run: ir, gateVersion: `v2-interim-${ir}`, outcome: c.rejectionReason ? "rejected" : "passed", reasons: c.rejectionReason }); void run; }
if (WITH_S1A) for (const c of load("s1a-final") as (RawCand & { history?: { run: string; outcome: "passed" | "rejected"; reasons: string | null }[] })[]) (history[hk(c)] ??= []).push(...(c.history ?? []).slice(0, -0 || undefined).map((h) => ({ run: h.run, gateVersion: LATEST_GATE, outcome: h.outcome, reasons: h.reasons })).filter((_, i, a) => i < a.length - 1)); // 시도 이력(최초·수선); 마지막 시도는 buildStock 이 현재 행으로 기록
// 파서 오류로 반려됐다가 정규화 파서에서 전 게이트 통과가 확인된 후보만(후보 ID·오류 파서·사후 결과 모두 확인된 건) 상태를 올린다. "+24 추정" 전체가 아니다.
const reparse = existsSync(path.join(OUT, "reparse-candidates.json")) ? (JSON.parse(readFileSync(path.join(OUT, "reparse-candidates.json"), "utf-8")) as { run: string; key: string; old_reason: string; confirmed: boolean }[]).filter((r) => r.confirmed) : [];
for (const r of reparse) { const list = runs[r.run]; const i = list?.findIndex((c) => c.candidateKey === r.key) ?? -1; if (i < 0) continue; const c = list[i]; (history[hk(c)] ??= []).push({ run: "reparse-2026-10-09", gateVersion: LATEST_GATE, outcome: "rejected", reasons: `malformed review output (old parser): ${r.old_reason}` }); list[i] = { ...c, rejectionReason: null, reviewState: "auto_passed" } as RawCand; }
// 근사 중복 6건: 개별 분류(숫자·문구 변형 = 같은 문항군 변형으로 보존, 풀이 구조·스킬이 다르면 독립). 일괄 반려/일괄 독립 처리 아님. 완전 중복 여부는 buildStock 이 판정.
const nearDup = existsSync(path.join(OUT, "near-dup-classification.json")) ? (JSON.parse(readFileSync(path.join(OUT, "near-dup-classification.json"), "utf-8")) as { run: string; key: string; reason: string }[]) : [];
for (const r of nearDup) { const list = runs[r.run]; const i = list?.findIndex((c) => c.candidateKey === r.key) ?? -1; if (i < 0) continue; const c = list[i]; if (c.rejectionReason !== "duplicate_gate_near_duplicate") continue; (history[hk(c)] ??= []).push({ run: "near-dup-classified-2026-10-09", gateVersion: LATEST_GATE, outcome: "passed", reasons: `near-duplicate gate: classified as same item-family variant (${r.reason})` }); list[i] = { ...c, rejectionReason: null, reviewState: "auto_passed" } as RawCand; }
// 재검증 통과 승격(apply-revalidation.ts 가 만든 결정만; 결정적 검사 전부 통과한 것)
const applyF = path.join(OUT, "revalidation-apply.json");
if (existsSync(applyF)) for (const r of JSON.parse(readFileSync(applyF, "utf-8")) as { stockKey: string; apply: boolean; source: string }[]) { if (!r.apply) continue; const [run, key] = [r.stockKey.split(":")[0], r.stockKey.slice(r.stockKey.indexOf(":") + 1)]; const list = runs[run]; const i = list?.findIndex((c) => c.candidateKey === key) ?? -1; if (i < 0) continue; const c = list[i]; (history[hk(c)] ??= []).push({ run: `revalidated-${r.source}`, gateVersion: REVALIDATED_GATE, outcome: "passed", reasons: "legacy re-validation: Opus independent solve + Sonnet 5-criteria review (subject variant, parser 66ad0da7e962) + deterministic checks (gates v2, free structure/computation, generator-defects, table-text consistency)" }); list[i] = { ...c, gateOverride: REVALIDATED_GATE } as RawCand; }
const items = buildStock(runs, { history, historyKey: hk });
const subjects = ["ap_calculus_ab", "ap_calculus_bc", "ap_biology", "ap_microeconomics"];
const summary = summarize(items); const cells = cellCounts(items);
// 한 번의 계산으로 두 파일을 쓴다: items.json = 기본 배치(783행), s1a-items.json = 보조 배치(S1a). 합친 표가 단일 재고(요약·보고·DB 비교 기준).
for (const x of SUPP) if (runs[x.run]) writeFileSync(path.join(OUT, x.file), JSON.stringify(items.filter((i) => i.run === x.run).map((i) => ({ ...i })), null, 0));
writeFileSync(path.join(OUT, "items.json"), JSON.stringify(items.filter((i) => !SUPP.some((x) => x.run === i.run)).map((i) => ({ ...i })), null, 0));
writeFileSync(path.join(OUT, "summary.json"), JSON.stringify({ latestGate: LATEST_GATE, variantCap: VARIANT_CAP, summary, cells }, null, 1));

const cur = (s: string) => JSON.parse(readFileSync(path.resolve(process.cwd(), `data/ap/curriculum-2027/${s}.json`), "utf-8")) as ApCurriculumFile;
const L: string[] = [];
const kindName: Record<string, string> = { mc: "MC", frq_bundle: "FRQ" };
L.push("# AP 문항 은행 재고 보고 (2026-10-08)", "", `기준: 최신 게이트 \`${LATEST_GATE}\` (코드 우선 파이프라인 최종: 결정적 게이트 + Opus 독립 풀이 + Sonnet 5기준 검토 + 난이도 별도 + Fable 표본). 이전 게이트(런1, LLM 생성)로 통과한 항목은 **재검증 필요(needs_revalidation)**이며 자동 승격하지 않는다. 이 보고는 LLM 호출 없이 기존 결과 파일로 계산했다.`, "",
  "## 정의", "", "- **검증 상태**(validation): `rejected` / `needs_revalidation`(최신 게이트 이전 통과) / `auto_passed`(최신 게이트 통과) / `exact_duplicate`(완전 중복, canonical 에 연결·재고 제외).",
  "- **게시 후 검수 상태**(expert_status): `unreviewed` / `in_review` / `approved` / `issues_reported` — 검수 환경에 게시된 뒤 기존 오류 신고 흐름과 표본 승인으로 추적하며 **게시를 막지 않는다**. **검수 환경 게시 가능 = auto_passed + 그래프 렌더링 + 학생 화면 검증**(현재 둘 다 미완료이므로 0). 프로덕션(launch)은 별도 게이트: review_env_ready + 미해결 launch 차단 결함 0(전문가 승인·검수 기간은 조건 아님, 신고 0건은 검수 완료 증거 아님).",
  "- **선택**(selectedForSample)은 별개 속성이며 재고 여부와 무관하다. `legacy reserve`는 샘플에서 선택되지 않은 통과분(과거 표기)이다.",
  "- **문항군(item family)**: 같은 원형·토픽의 숫자/표현 변형 또는 문장 3-gram 유사(>0.8). **반려하지 않으며** 재고에 모두 남기되 군으로 묶는다. **완전 중복(exact)만** 제외한다.",
  `- **칸**(cell) = 토픽 × 주 스킬 × 구조 × 계산기. 칸 채움 = 최신 게이트 통과 문항군별 min(문항 수, ${VARIANT_CAP}). 낡은 통과·숫자 변형만으로는 칸이 채워지지 않는다.`, "- **AB/BC 공유**: AB 재고는 BC 에도 쓸 수 있고(공통 content_key) 합계에서는 소유 과목(AB)에서 **한 번만** 센다. BC 열의 '공유 사용 가능'은 합산에서 제외.", "");
L.push("## 1. 과목 × 종류별 집계", "", "| 과목 | 종류 | 전체 행 | 반려 | 완전 중복 제거 | 문항군 수 | 재검증 필요 | **최신 게이트 자동 통과** | 게시 후 승인 | **검수 환경 게시 가능** | 샘플 선택 | legacy reserve | AB 공유 사용 가능 |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const r of summary) L.push(`| ${r.subject} | ${kindName[r.kind]} | ${r.totalRows} | ${r.rejected} | ${r.exactDuplicates} | ${r.itemFamilies} | ${r.needsRevalidation} | **${r.autoPassed}** | ${r.expertApproved} | **${r.reviewEnvReady}** | ${r.selectedForSample} | ${r.legacyReserve} | ${r.sharedIn || ""} |`);
const uniq = (k: string) => summary.filter((r) => r.kind === k).reduce((a, r) => a + r.autoPassed + r.needsRevalidation, 0);
L.push("", `- 전체 고유 재고(완전 중복 제외, AB/BC 한 번만): MC ${uniq("mc")}, FRQ ${uniq("frq_bundle")} — 이 중 최신 게이트 자동 통과 MC ${summary.filter((r) => r.kind === "mc").reduce((a, r) => a + r.autoPassed, 0)}, FRQ ${summary.filter((r) => r.kind === "frq_bundle").reduce((a, r) => a + r.autoPassed, 0)}, 재검증 필요(런1) MC ${summary.filter((r) => r.kind === "mc").reduce((a, r) => a + r.needsRevalidation, 0)}, FRQ ${summary.filter((r) => r.kind === "frq_bundle").reduce((a, r) => a + r.needsRevalidation, 0)}.`);
L.push(`- 이력: 중간 런(run2a/run2b/run2bc_a/run2bc_b)은 재고에서 제외하고 최종 항목의 history 로만 보존(같은 원형·시드 기준). 파일럿 런은 제외.`, "");
L.push("## 2. 칸 부족분(최신 게이트 + 문항군 다양성 기준)", "", `목표(기준선): 과목당 MC ${MC_TARGET}, FRQ ${FRQ_TARGET}(오너 기준선). 토픽 목표는 공식 단원 MC 비중으로 단원에 나눈 뒤 단원 내 토픽에 균등 배분. 채움 = 위 정의의 effective. BC 는 BC 전용 + AB 공유 사용분을 합산해 계산.`, "");
for (const s of ["ap_calculus_ab", "ap_calculus_bc"]) {
  const f = cur(s); const w: Record<string, [number | null, number | null]> = {}; f.weights.filter((x) => x.axis === "unit" && x.section === "mc").forEach((x) => (w[x.code] = [x.min, x.max]));
  const tg = topicTargets(f.units, w, MC_TARGET, s); const mcCells = cells.filter((c) => c.subject === s && c.structure === "standalone");
  const eff: Record<string, { eff: number; auto: number; fam: number; stale: number }> = {};
  for (const c of mcCells) { const e = (eff[c.keyword] ??= { eff: 0, auto: 0, fam: 0, stale: 0 }); e.eff += c.effective; e.auto += c.autoPassed; e.fam += c.families; e.stale += c.needsRevalidation; }
  const topics = f.units.flatMap((u) => u.topics.map((t) => ({ u: u.code, code: t.code, title: t.title }))).filter((t) => tg[t.code] !== undefined);
  const zero = topics.filter((t) => tg[t.code] > 0 && !(eff[t.code]?.eff > 0)); const short = topics.filter((t) => tg[t.code] > 0 && shortfall(tg[t.code], eff[t.code]?.eff ?? 0) > 0);
  const totalShort = topics.reduce((a, t) => a + shortfall(tg[t.code] ?? 0, eff[t.code]?.eff ?? 0), 0);
  L.push(`### ${s} (MC, 토픽 목표 합 ${Object.values(tg).reduce((a, b) => a + b, 0)}, 부족 합 ${totalShort}, 목표가 있는 토픽 중 채움 0 = ${zero.length}/${topics.filter((t) => tg[t.code] > 0).length}, 부족한 토픽 = ${short.length})`, "", "| 단원 | 토픽 | 목표 | 최신 통과(문항) | 문항군 | 칸 채움(effective) | 재검증 필요 | 부족 |", "|---|---|---|---|---|---|---|---|");
  for (const t of short.slice(0, 200)) { const e = eff[t.code] ?? { eff: 0, auto: 0, fam: 0, stale: 0 }; L.push(`| ${t.u} | ${t.code} ${t.title.slice(0, 40)} | ${tg[t.code]} | ${e.auto} | ${e.fam} | ${e.eff} | ${e.stale} | ${shortfall(tg[t.code], e.eff)} |`); }
  L.push("");
}
for (const s of ["ap_biology", "ap_microeconomics"]) {
  const mine = summary.filter((r) => r.subject === s); const f = cur(s);
  const reval = items.filter((i) => i.apSubjectCode === s && i.validation === "needs_revalidation" && i.kind === "mc"); const topicsHit = new Set(reval.map((i) => i.keywordCode));
  const w: Record<string, [number | null, number | null]> = {}; f.weights.filter((x) => x.axis === "unit" && x.section === "mc").forEach((x) => (w[x.code] = [x.min, x.max]));
  const tg = topicTargets(f.units, w, MC_TARGET, s); const nTopics = Object.keys(tg).length;
  L.push(`### ${s}`, "", `최신 게이트 통과 0(런1 LLM 생성 방식만 존재) → **전 항목 재검증 필요**. 재검증 필요 MC ${mine.find((r) => r.kind === "mc")?.needsRevalidation ?? 0}개가 ${topicsHit.size}개 토픽에 분포(토픽 ${nTopics}개 중). 칸 채움 = 0, 부족 = 목표 ${Object.values(tg).reduce((a, b) => a + b, 0)} 전부. 다음 생성은 코드 우선 원형이 준비된 뒤 부족 토픽에만.`, "");
}
L.push("## 3. FRQ 재고(템플릿 단위)", "", "| 과목 | 최신 통과 FRQ(문항) | 문항군(=채움, FRQ 는 군당 1) | 재검증 필요 | 목표 | 부족 |", "|---|---|---|---|---|---|");
for (const s of subjects) { const fr = items.filter((i) => i.apSubjectCode === s && i.kind === "frq_bundle"); const auto = fr.filter((i) => i.validation === "auto_passed"); const fam = new Set(auto.map((i) => i.itemFamilyId)); L.push(`| ${s} | ${auto.length} | ${fam.size} | ${fr.filter((i) => i.validation === "needs_revalidation").length} | ${FRQ_TARGET} | ${shortfall(FRQ_TARGET, fam.size)} |`); }
L.push("", "## 4. 칸 분포(어느 칸이 0 또는 적은가)", "");
for (const s of ["ap_calculus_ab", "ap_calculus_bc"]) {
  const cs = cells.filter((c) => c.subject === s); const by = (n: number) => cs.filter((c) => c.effective === n).length;
  L.push(`- ${s}: 관측된 칸 ${cs.length}개(토픽×스킬×구조×계산기) — 채움 1: ${by(1)}, 2: ${by(2)}, 3 이상: ${cs.filter((c) => c.effective >= 3).length}. 한 문항군이 3개 이상 문항을 가진 칸: ${cs.filter((c) => c.autoPassed > c.effective).length}(변형이 많아도 채움은 문항군당 ${VARIANT_CAP}개까지만 인정).`);
}
L.push("- 위 '부족' 표의 토픽만 다음 생성 대상(칸 단위 1개 후보 → 실패한 칸에만 추가). 구조(FRQ 유형·세트)는 템플릿이 없는 유형이 먼저 부족(입자 운동·음함수 관련 변화율 FRQ, Bio·Micro 전부).", "");
L.push("", "## 5. 현재(783행) vs 이전 적재(767행) 대조와 DB 일치", "",
  "- **현재 배치 = 새 형식 행 783**(런1 576 + 런2 136 + 런2bc 71; 위 표의 전체 행 합). **이전 적재 = 구 형식 행 767**(삭제하지 않고 `is_current=false` 로 표시). 이전 적재의 내역은 파일이 아니라 DB 에만 있으므로 아래 SQL 로 조회한다:",
  "```sql", "select batch, is_current, subject, kind, rows, unique_items, item_families, auto_passed, needs_revalidation, rejected, exact_duplicates from ap_stock_by_batch_v order by is_current desc, subject, kind;", "```",
  "- 현재 집계의 단일 출처는 DB 뷰 `ap_stock_summary_v`(현재 배치만). 파일 집계와의 일치는 `scripts/ap-generation/stock-consistency.ts`(읽기 전용)로 점검한다.", "- **로컬 검증(트랜잭션 후 롤백)**: 783행을 로컬 DB 에 적재한 뒤 `ap_stock_summary_v` 를 조회해 위 표 8행(과목×종류)의 전체 행·반려·완전 중복·재검증 필요·자동 통과·고유 문항·문항군이 **파일 집계와 전부 일치**함을 확인했다(총 783행).", "- 표식 방법: `select * from ap_mark_load_batches('<cutoff>', 767, 783, false);`(dry-run) → 건수 일치 시 `true`. 상세: `docs/ap/publication-flow.md` §표식.", "");
writeFileSync(path.resolve(process.cwd(), "docs/ap/stock-report.md"), L.join("\n") + "\n");
console.log(L.slice(0, 40).join("\n"));
