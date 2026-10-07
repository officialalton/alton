// 빈 셀·자료 조합 보충 생성기 (2026-10-06). 기존 원형 파이프라인(produceFromArchetypes / produceFromLite — 독립 재계산 verification_js,
// 선택지 중복·SPR 쿼터·본문 유사도·그룹 상한 게이트)을 그대로 쓰고, DB·LLM 접근 없음(비용 0). 결과는 import.ts 입력 배열(JSON)이다.
// 실행: npx tsx scripts/mock-exam-generation/gap-bulk.ts --run <id> --out <file.json> (--cells skill:level:count,... | --items [id,id|all] --per-item N)
//   --cells : skill×난이도 칸을 count 개 채운다(자료 원형·lite·hard 원형 전부에서 라운드 로빈).
//   --items : 자료 조합(매니페스트 id)마다 그 조합 원형에서 per-item 개를 만든다. 레코드에 quality.mockExamGeneration.figureItem 을 남긴다(은행에서 조합을 식별하는 메타데이터, 스키마 변경 없음).
//   게이트 보고서가 ok=false(G9/G10)여도 pass 상태인 조합만 allowItems 로 연다. fail·incomplete 조합은 건너뛰고 목록으로 출력한다.
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { ARCHETYPES } from "../../lib/problem-generation/math-archetypes/registry";
import { D_ARCHETYPES } from "../../lib/problem-generation/math-archetypes/registry-d";
import { LITE_C_ARCHETYPES } from "../../lib/problem-generation/math-archetypes/lite-c";
import { produceFromArchetypes, type PassedRecord } from "../../lib/problem-generation/math-archetypes/bulk";
import { produceFromLite } from "../../lib/problem-generation/math-archetypes/c-lite";
import { levelOf } from "../../lib/problem-generation/math-archetypes/spr-capability";
import { FIGURE_ITEMS } from "../../lib/problem-generation/math-archetypes/figure-coverage-manifest";
import { loadGateReport } from "../../lib/problem-generation/math-archetypes/figure-coverage";
import { qaSamples } from "../../lib/problem-generation/math-archetypes/figure-qa-samples";
import { codeHash, reviewStatus } from "../../lib/problem-generation/math-archetypes/figure-qa-hash";
import { SKILL_BY_CODE } from "../../lib/problem-taxonomy";
import { judgeMaterialNeed, materialBlocker } from "../../lib/problem-material-need";
import { composeProblemText } from "../../lib/problem-question";
import type { Archetype } from "../../lib/problem-generation/math-archetypes/types";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const runId = arg("--run") ?? "gapfill"; const outFile = path.resolve(arg("--out") ?? `data/mock-exam-generation/${runId}/passed.json`);
const ALL: Archetype[] = [...new Map([...ARCHETYPES, ...D_ARCHETYPES].map((a) => [a.id, a] as const)).values()];
const report = loadGateReport(); const passItems = Object.entries(report?.items ?? {}).filter(([, v]) => v.status === "pass").map(([k]) => k);
// 시각 검수(G9)는 코드 해시 기준 파생값이라 저장된 보고서가 낡을 수 있다 — 현재 판정 파일로 다시 계산한다.
const liveQa = (id: string) => { try { const types = [...new Set(qaSamples(id).flatMap((x) => x.types))]; return reviewStatus(id, codeHash(id, types)).state; } catch { return "error"; } };
const qaPass = (id: string) => liveQa(id) === "pass" && (report?.items?.[id]?.status === "pass" || report?.items?.[id]?.failures?.every((f) => f.startsWith("G9")) === true);
// coordinate_geometry 는 앱 taxonomy 에 없는 skill 이라 내용에 맞는 기존 skill 로 매핑한다(2026-10-07 오너 지시: 직선·기울기→linear_equations_two_var, 원→circles; 그 외는 도형 내용 기준).
const COORD_MAP: Record<string, string> = { parallel_perpendicular_slopes: "linear_equations_two_var", circle_equation: "circles", polygon_area_on_plane: "area_volume", distance_midpoint: "lines_angles_triangles", transformation_image: "lines_angles_triangles" };
const remap = (r: PassedRecord) => { if (r.skill !== "coordinate_geometry") return r; const kind = String((r.quality as { mockExamGeneration?: { kind?: string } }).mockExamGeneration?.kind ?? "").split(".")[0]; const to = COORD_MAP[kind]; if (!to) throw new Error(`coordinate_geometry 매핑 없음: ${kind}`); const m = SKILL_BY_CODE.get(to)!; (r.quality as { mockExamGeneration: Record<string, unknown> }).mockExamGeneration.mappedFrom = "coordinate_geometry"; return { ...r, skill: to, domain: m.domain }; };
const allowItems = passItems.filter(qaPass);
// 저장된 보고서의 G9 낡은 판정을 현재 판정 파일 기준으로 덮어쓴 보고서(게이트 가드용). G9 외 실패가 있는 조합은 그대로 막힌다.
const liveReport = report && { ...report, ok: false, items: Object.fromEntries(Object.entries(report.items).map(([k, v]) => [k, qaPass(k) && v.status !== "pass" ? { ...v, status: "pass" as const } : v])) };
// 임포터의 은행 게이트(자료 필수)를 미리 적용 — 그림 없이는 못 들어가는 문항은 만들지 않고 다른 원형으로 채운다.
const materialOk = (r: PassedRecord) => { const g = r.problem as { stimulus?: string; question?: string; figure?: unknown }; return !materialBlocker(judgeMaterialNeed({ examSystem: "sat_math", skillCode: r.skill, text: composeProblemText(g.stimulus ?? "", g.question ?? "") }), g.figure ?? null); };
const archById = new Map(ALL.map((a) => [a.id, a] as const));
const withFig = (r: PassedRecord) => { const a = archById.get(String((r.quality as { mockExamGeneration?: { archetypeId?: string } }).mockExamGeneration?.archetypeId)); const q = r.quality as { mockExamGeneration: Record<string, unknown> }; if (a?.figureItem) q.mockExamGeneration.figureItem = a.figureItem; return r; };
const out: PassedRecord[] = []; const notes: string[] = [];
const seen = new Set<string>();
const push = (rs: PassedRecord[]) => { for (const r of rs) if (!seen.has(r.gid)) { seen.add(r.gid); out.push(remap(withFig(r))); } };
const seedStart = Number(arg("--seed") ?? 0);

if (arg("--cells")) {
  for (const spec of arg("--cells")!.split(",")) {
    const [skill, level, countS] = spec.split(":"); const count = Number(countS);
    const pool = ALL.filter((a) => a.skill === skill && levelOf(a) === level && (!a.figureItem || allowItems.includes(a.figureItem)));
    const lite = LITE_C_ARCHETYPES.filter((a) => a.skill === skill && a.levels.includes(level as "easy" | "medium"));
    let got = 0;
    if (pool.length) { let r = produceFromArchetypes(pool, { runId, count: count * 3, seedStart, allowItems, coverageReport: liveReport }); const okRecs = r.records.filter(materialOk).slice(0, count); r = { ...r, records: okRecs }; push(r.records); got += r.records.length; notes.push(`${spec}: 원형 ${pool.length}개 → ${r.records.length}건 (시도 ${r.stats.attempts}, 생성실패 ${r.stats.genFail}, 검증실패 ${r.stats.verifyFail}, 중복 ${r.stats.duplicate}, 그룹상한 ${r.stats.groupCap}, SPR부족 ${r.stats.format.shortfalls.length})`); }
    if (lite.length && level !== "hard" && got < count) { const r = produceFromLite(lite, level as "easy" | "medium", { runId, count: count - got, seedStart }); push(r.records); notes.push(`${spec}: lite 원형 ${lite.length}개 → ${r.records.length}건`); }
    if (!pool.length && !lite.length) notes.push(`${spec}: 해당 칸 원형 없음`);
  }
}
if (arg("--items")) {
  const per = Number(arg("--per-item") ?? 1); const sel = arg("--items") === "all" ? FIGURE_ITEMS.map((r) => r.id) : arg("--items")!.split(",");
  for (const id of sel) {
    if (!qaPass(id)) { notes.push(`SKIP ${id}: 게이트/시각 검수 pass 아님(${report?.qaByItem?.[id]?.state ?? "?"}/${report?.items?.[id]?.status ?? "?"})`); continue; }
    const archs = ALL.filter((a) => a.figureItem === id);
    if (!archs.length) { notes.push(`SKIP ${id}: 원형 없음`); continue; }
    // 원형마다(난이도 다양화) per 개씩
    let n = 0;
    // 난이도마다 대표 원형 1개(--all-archetypes 면 전부)로 per 개씩 — 조합당 난이도별 최소 1문항.
    const byLevel = new Map<string, Archetype[]>(); for (const a of archs) (byLevel.get(levelOf(a)) ?? byLevel.set(levelOf(a), []).get(levelOf(a))!).push(a);
    const chosen = process.argv.includes("--all-archetypes") ? archs : [...byLevel.values()].map((l) => l[Math.floor(seedStart) % l.length]);
    for (const a of chosen) { const r = produceFromArchetypes([a], { runId, count: per, seedStart, allowItems: [id], sprQuota: 0, coverageReport: liveReport }); const okR = r.records.filter(materialOk); if (okR.length < r.records.length) notes.push(`MATERIAL_REJECT ${id} ${a.id}: ${r.records.length - okR.length}건 자료 필수 게이트에 걸림`); push(okR); n += okR.length; }
    if (!n) notes.push(`EMPTY ${id}: 원형 ${archs.length}개에서 0건`);
  }
}
mkdirSync(path.dirname(outFile), { recursive: true }); writeFileSync(outFile, JSON.stringify(out));
const byCell: Record<string, number> = {}; for (const r of out) { const k = `${r.skill}|${r.difficulty}|${r.format}`; byCell[k] = (byCell[k] ?? 0) + 1; }
console.log(notes.join("\n")); console.log(JSON.stringify({ records: out.length, byCell }, null, 1)); console.log("->", outFile);
