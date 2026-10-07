// 문항 유형 × 난이도(easy/medium/hard) 커버리지 점검 — 모의고사 구성과 별개로, 모든 유형·난이도 칸이 채워져 있고 건강한지 반복 확인한다.
// 실행: npm run check:type-difficulty [-- --seeds 12 --compiler-count 10 --no-bank --out docs/qa/type-difficulty-coverage-report]
// 읽기 전용: 생성기는 결정적(LLM·DB 호출 없음), 은행은 비프로덕션 원격을 SELECT 만 한다(supabase CLI 로 서비스 키를 메모리로만 받고 출력·저장하지 않는다).
//   --no-bank 면 은행 집계를 건너뛴다. --bank-json <file> 이면 미리 받은 {problems,versions,sets,items} 덤프를 쓴다(원격 호출 없음).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { FIGURE_ITEMS, NO_FIGURE } from "../../lib/problem-generation/math-archetypes/figure-coverage-manifest";
import { ARCHETYPES, ARCHETYPES_EM } from "../../lib/problem-generation/math-archetypes/registry";
import { D_ARCHETYPES } from "../../lib/problem-generation/math-archetypes/registry-d";
import { LITE_C_ARCHETYPES } from "../../lib/problem-generation/math-archetypes/lite-c";
import { generateLite, verifyLite } from "../../lib/problem-generation/math-archetypes/c-lite";
import { generateOne, bodyShingles } from "../../lib/problem-generation/math-archetypes/sweep";
import { verifyInstance } from "../../lib/problem-generation/math-archetypes/verify";
import { verifyLevel, type LArch } from "../../lib/problem-generation/math-archetypes/levels-d";
import { checkInstanceFigureQa } from "../../lib/problem-generation/math-archetypes/figure-qa";
import { levelOf } from "../../lib/problem-generation/math-archetypes/spr-capability";
import type { Archetype } from "../../lib/problem-generation/math-archetypes/types";
import { MATH_SKILL_KINDS } from "../../lib/problem-generation/math-compilers/kind-catalog";
import { runMathCompilerBatch } from "../../lib/problem-generation/math-compilers/batch";
import { SKILL_CODES } from "../../lib/problem-taxonomy";
import { aggregateBank, aggregateGen, classifyBank, collectWeak, countStatus, DIFFS, type Attempt, type BankCell, type Diff, type GenCell, type WeakEntry } from "./type-difficulty-lib";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const flag = (n: string) => process.argv.includes(n);
const SEEDS = Number(arg("--seeds") ?? 12), COMPILER_COUNT = Number(arg("--compiler-count") ?? 10);
const OUT = arg("--out") ?? "docs/qa/type-difficulty-coverage-report";
const PROJECT_REF = "worpsqwqgnspddnrtnvq";

/* ---- 생성기 시도 수집 ---- */
const isL = (a: Archetype): a is LArch => !!(a as LArch).level;
const verifyAny = (a: Archetype, inst: Parameters<typeof verifyInstance>[1]) => (isL(a) ? verifyLevel(a, inst) : verifyInstance(a, inst));
const uniqArch = (): Archetype[] => { const m = new Map<string, Archetype>(); for (const a of [...ARCHETYPES, ...ARCHETYPES_EM]) m.set(a.id, a); for (const a of D_ARCHETYPES) m.set(a.id, a); return [...m.values()]; };

function sweepArch(a: Archetype): Attempt[] {
  const d = levelOf(a) as Diff, out: Attempt[] = [];
  for (let s = 0; s < SEEDS; s++) {
    const g = generateOne(a, s, "mc"); const base = { source: "archetype" as const, archetypeId: a.id, difficulty: d };
    if (!g.ok) { out.push({ ...base, outcome: g.why === "genfail" ? "genfail" : "throw" }); continue; }
    let ok = false; try { ok = verifyAny(a, g.inst).ok; } catch { ok = false; }
    if (!ok) { out.push({ ...base, outcome: "verifyfail" }); continue; }
    let qaFail = false; if (g.inst.figure) { try { qaFail = checkInstanceFigureQa(g.inst).length > 0; } catch { qaFail = true; } }
    out.push({ ...base, outcome: "produced", qaFail, variant: g.inst.variant, shingles: bodyShingles(g.inst) });
  }
  return out;
}
function sweepLite(): Map<string, Attempt[]> { // 키: skill.kind|difficulty
  const m = new Map<string, Attempt[]>();
  for (const a of LITE_C_ARCHETYPES) for (const lv of a.levels) for (let s = 0; s < SEEDS; s++) {
    const key = `${a.skill}.${a.kind}|${lv}`; const list = m.get(key) ?? []; m.set(key, list);
    const base = { source: "lite" as const, archetypeId: `${a.id}@${lv}`, difficulty: lv };
    const g = generateLite(a, lv, s);
    if (!g.ok) { list.push({ ...base, outcome: g.why === "genfail" ? "genfail" : "throw" }); continue; }
    if (!verifyLite(a, g.inst).ok) { list.push({ ...base, outcome: "verifyfail" }); continue; }
    list.push({ ...base, outcome: "produced", variant: g.inst.variant, shingles: bodyShingles(g.inst) });
  }
  return m;
}
const shingleText = (t: string) => { const w = t.toLowerCase().replace(/[0-9]+([.,][0-9]+)*/g, "#").replace(/[^a-z#\s]+/g, " ").split(/\s+/).filter(Boolean); const s = new Set<string>(); for (let i = 0; i + 3 <= w.length; i++) s.add(w.slice(i, i + 3).join(" ")); return s; };
async function sweepCompilers(kinds: string[]): Promise<Map<string, Attempt[]>> {
  const m = new Map<string, Attempt[]>(); const origLog = console.log;
  for (const sk of kinds) { const [skill, kind] = sk.split(/\.(.+)/); if (!(MATH_SKILL_KINDS[skill] ?? []).some((k) => k.value === kind)) continue;
    for (const d of DIFFS) {
      console.log = () => {};
      try {
        let r = await runMathCompilerBatch({ skillCode: skill as never, difficulty: d, count: COMPILER_COUNT, kind });
        if (r.accepted.length === 0 && r.failures.some((f) => f.reason.includes("자료 필수"))) r = await runMathCompilerBatch({ skillCode: skill as never, difficulty: d, count: COMPILER_COUNT, kind, figurePolicy: "require_data" });
        const list: Attempt[] = [];
        for (const a of r.accepted) { const g = a.problem as never as { stimulus?: string; question?: string; options?: string[]; subpattern?: string }; list.push({ source: "compiler", archetypeId: `compiler:${sk}`, difficulty: d, outcome: "produced", variant: g.subpattern ?? "-", shingles: shingleText(`${g.stimulus ?? ""} ${g.question ?? ""} ${(g.options ?? []).join(" ")}`) }); }
        for (let i = 0; i < r.failures.length; i++) list.push({ source: "compiler", archetypeId: `compiler:${sk}`, difficulty: d, outcome: "genfail" });
        m.set(`${sk}|${d}`, list);
      } catch { m.set(`${sk}|${d}`, [{ source: "compiler", archetypeId: `compiler:${sk}`, difficulty: d, outcome: "throw" }]); }
      finally { console.log = origLog; }
    } }
  return m;
}

type Row<C> = { id: string; label?: string; cells: Record<Diff, C> };
const emptyCell = () => aggregateGen([], new Set());

/* ---- 은행 ---- */
type Dump = { problems: never[]; versions: never[]; sets: never[]; items: never[] };
async function loadBank(): Promise<Dump> {
  const jf = arg("--bank-json"); if (jf) return JSON.parse(readFileSync(jf, "utf-8"));
  const keys = JSON.parse(execFileSync("npx", ["supabase", "projects", "api-keys", "--project-ref", PROJECT_REF, "-o", "json"], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] })) as { name: string; api_key: string }[];
  const key = keys.find((k) => k.name === "service_role")?.api_key; if (!key) throw new Error("service_role 키를 받지 못했다");
  const db = createClient(`https://${PROJECT_REF}.supabase.co`, key, { auth: { persistSession: false } });
  const pg = async (name: string, q: () => { range: (a: number, b: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> }) => {
    let rows: unknown[] = []; for (let from = 0; ; from += 1000) { const { data, error } = await q().range(from, from + 999); if (error) throw new Error(`${name}: ${error.message}`); rows = rows.concat(data ?? []); if (!data || data.length < 1000) break; } return rows as never[];
  };
  return {
    problems: await pg("problems", () => db.from("problems").select("id,skill_code,difficulty,status,usage_scope,archived_at,published_version_id").order("id").not("sat_domain", "is", null)),
    versions: await pg("versions", () => db.from("problem_versions").select("id,problem_id,explanation_en").eq("status", "published").order("id")),
    sets: await pg("sets", () => db.from("mock_exam_sets").select("id,status,archived_at").order("id")),
    items: await pg("items", () => db.from("mock_exam_set_items").select("id,exam_set_id,problem_id").order("id")),
  };
}

/* ---- 마크다운 ---- */
const g = (c: GenCell) => (c.status === "EMPTY" ? `EMPTY${c.attempts ? ` 0/${c.attempts}` : ""}` : `${c.status} ${c.produced}/${c.attempts} i${c.independent}${c.verifyFail + c.thrown + c.qaFail ? ` f${c.verifyFail + c.thrown + c.qaFail}` : ""}`);
const b = (c: BankCell) => (c.status === "EMPTY" ? `EMPTY${c.live ? ` (초안 ${c.live})` : ""}` : `${c.status} ${c.published}${c.explEnMissing ? ` e-${c.explEnMissing}` : ""} m${c.mockScope} x${c.exposedInSets}`);
const table = (head: string[], rows: string[][]) => [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
const sum = (t: ReturnType<typeof countStatus>) => `칸 ${t.cells} = OK ${t.OK} · WEAK ${t.WEAK} · EMPTY ${t.EMPTY}`;

(async () => {
  const t0 = Date.now();
  const archAll = uniqArch(); const bySK = new Map<string, Archetype[]>();
  const itemKind = new Map(FIGURE_ITEMS.map((r) => [r.id, `${r.skill}.${r.kind}`]));
  // 자료 원형은 kind 필드가 아니라 figureItem 의 매니페스트 행으로 종류를 정한다(원형 kind 는 변형 이름일 수 있다).
  for (const a of archAll) { const k = (a.figureItem && itemKind.get(a.figureItem)) || `${a.skill}.${a.kind}`; bySK.set(k, [...(bySK.get(k) ?? []), a]); }
  const attemptsOf = new Map<string, Attempt[]>(); for (const a of archAll) attemptsOf.set(a.id, sweepArch(a));
  const lite = sweepLite();
  const manifestKinds = [...new Set([...FIGURE_ITEMS, ...NO_FIGURE].map((r) => `${r.skill}.${r.kind}`))];
  const compilers = await sweepCompilers(manifestKinds);

  // (a) 조합 303 × 난이도 — 자료 원형(figureItem 선언)만
  const comboRows: Row<GenCell>[] = FIGURE_ITEMS.map((it) => {
    const list = archAll.filter((a) => a.figureItem === it.id);
    const cells = {} as Record<Diff, GenCell>;
    for (const d of DIFFS) { const as = list.filter((a) => levelOf(a) === d); cells[d] = as.length ? aggregateGen(as.flatMap((a) => attemptsOf.get(a.id) ?? []), new Set(as.map((a) => a.id))) : emptyCell(); }
    return { id: it.id, cells };
  });
  // (b) 종류 132 × 난이도 — 원형 + lite 틀 + 계산형 컴파일러
  const kindRows: Row<GenCell>[] = manifestKinds.map((k) => {
    const cells = {} as Record<Diff, GenCell>;
    for (const d of DIFFS) {
      const as = (bySK.get(k) ?? []).filter((a) => levelOf(a) === d); const at = [...as.flatMap((a) => attemptsOf.get(a.id) ?? []), ...(lite.get(`${k}|${d}`) ?? []), ...(compilers.get(`${k}|${d}`) ?? [])];
      const ids = new Set(at.map((x) => x.archetypeId.replace(/@.*/, "")));
      cells[d] = at.length ? aggregateGen(at, ids) : emptyCell();
    }
    return { id: k, cells };
  });
  // (c) 은행 skill × 난이도
  let skillRows: Row<BankCell>[] = []; let bankNote = "";
  if (!flag("--no-bank")) {
    const dump = await loadBank(); const m = aggregateBank(dump.problems, dump.versions, dump.sets, dump.items);
    skillRows = SKILL_CODES.map((s) => ({ id: s.code, label: s.domain.startsWith("rw_") ? "RW" : "Math", cells: Object.fromEntries(DIFFS.map((d) => [d, classifyBank(m.get(`${s.code}|${d}`))])) as Record<Diff, BankCell> }));
    bankNote = `원격 비프로덕션 ${PROJECT_REF}: 문항 ${dump.problems.length}·게시 버전 ${dump.versions.length}·세트 ${dump.sets.length}·세트 항목 ${dump.items.length}`;
  }
  const weak: WeakEntry[] = [...collectWeak("a.조합", comboRows), ...collectWeak("b.종류", kindRows), ...collectWeak("c.skill(은행)", skillRows)];
  const tA = countStatus(comboRows), tB = countStatus(kindRows), tC = countStatus(skillRows);
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  const kindsWithGen = kindRows.filter((r) => DIFFS.some((d) => r.cells[d].status !== "EMPTY")).length;

  const md = [
    `# 문항 유형 × 난이도 커버리지 점검`,
    `생성: ${new Date().toISOString()} · 시드/원형 ${SEEDS} · 컴파일러 배치 ${COMPILER_COUNT} · 소요 ${secs}s · 재실행: \`npm run check:type-difficulty\` (JSON: ${OUT}.json)`, "",
    `## 요약`,
    `- (a) 자료 조합 ${comboRows.length} × 3: ${sum(tA)}`,
    `- (b) 종류 ${kindRows.length} × 3(원형 있는 종류 ${kindsWithGen}): ${sum(tB)}`,
    skillRows.length ? `- (c) skill ${skillRows.length} × 3(Math ${skillRows.filter((r) => r.label === "Math").length} + RW ${skillRows.filter((r) => r.label === "RW").length}): ${sum(tC)} — ${bankNote}` : `- (c) 은행 집계 생략(--no-bank)`,
    `- (d) 비어 있거나 약한 칸 ${weak.length}개(아래 목록)`, "",
    `## 방법`,
    `- 모의고사 구성과 무관하다. 칸의 판정은 "그 유형·난이도가 존재·산출·건강한가"만 본다.`,
    `- 판정: **EMPTY**=항목 0(생성기 없음 또는 산출 0 / 은행 게시 0), **WEAK**=3 미만(독립 변형 또는 게시 문항) 또는 검증·렌더 실패 또는 explanation_en 누락, **OK**=나머지.`,
    `- **조합·종류는 은행 행이 아니라 생성기 산출로 측정한다.** 은행(problems)에는 조합 id 열이 없고 subpattern 은 원형/변형 키라 조합으로 역추적할 수 없다. 따라서 (a)(b)는 "생성기가 그 난이도를 만들 수 있나"이고 (c)만 실제 은행 보유량이다.`,
    `- (a) 매니페스트 303 조합 각각의 \`figureItem\` 원형을 난이도(level/difficulty)별로 시드 0~${SEEDS - 1} 생성 → 공개 검증 게이트(verifyLevel/verifyInstance: 정답 재계산·표기·내용) → 자료 렌더 구조검사(checkInstanceFigureQa). 셀 표기 \`상태 산출/시도 i<독립 변형 수> f<실패 수>\`; 독립 = 본문 3-gram Jaccard < 0.6 탐욕 집합(칸 안 모든 원형 합산).`,
    `- (b) 종류=매니페스트의 skill.kind 132(기존 82 + 신규 SAT 50). 난이도별로 (1) 레지스트리 원형(hard·easy/medium) (2) lite 틀(easy/medium) (3) 계산형 컴파일러(kind-catalog 등록 kind만, 배치 ${COMPILER_COUNT})의 산출을 합친다. 컴파일러 hard 는 원형 hard 와 품질 근거가 다르므로 셀 단위 출처는 JSON 의 bySource 로 확인한다.`,
    `- (c) 원격 비프로덕션 SELECT 만(키는 supabase CLI 에서 메모리로만 사용). 보관되지 않은 문항 중 \`published_version_id\` 가 있으면 게시. 칸 표기 \`상태 게시수 e-<explanation_en 누락> m<모의고사 용도(mock_exam|both)> x<게시 세트에 실제 노출된 문항 수>\`. EMPTY 의 "(초안 n)"은 게시 아닌 보관 외 문항 수.`,
    `- 한계: 시드 ${SEEDS}개의 표본이라 독립 변형 수는 하한 추정이다(시드를 늘리면 증가). 미구현 신규 종류·조합은 시도 0 으로 EMPTY.`, "",
    `## (a) 자료 조합 × 난이도`,
    table(["조합 id", ...DIFFS], comboRows.map((r) => [r.id, ...DIFFS.map((d) => g(r.cells[d]))])), "",
    `## (b) 종류 × 난이도`,
    table(["skill.kind", ...DIFFS], kindRows.map((r) => [r.id, ...DIFFS.map((d) => g(r.cells[d]))])), "",
    `## (c) skill × 난이도(은행)`,
    skillRows.length ? table(["skill", "영역", ...DIFFS], skillRows.map((r) => [r.id, r.label!, ...DIFFS.map((d) => b(r.cells[d]))])) : "(생략)", "",
    `## (d) 비었거나 약한 칸`,
    table(["매트릭스", "id", "난이도", "상태", "사유"], weak.map((w) => [w.matrix, w.id, w.difficulty, w.status, w.reasons.join("; ")])),
  ].join("\n");
  writeFileSync(`${OUT}.md`, md + "\n");
  writeFileSync(`${OUT}.json`, JSON.stringify({ generatedAt: new Date().toISOString(), seeds: SEEDS, compilerCount: COMPILER_COUNT, totals: { combos: tA, kinds: tB, skills: tC }, combos: comboRows, kinds: kindRows, skills: skillRows, weak }, null, 1) + "\n");
  console.log(`(a) ${sum(tA)}\n(b) ${sum(tB)}\n(c) ${sum(tC)}\n(d) weak+empty ${weak.length}\n→ ${OUT}.md`);
})();
