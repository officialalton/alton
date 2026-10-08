// 첫 샘플(런1, 이전 게이트) 통과분 = needs_revalidation 항목의 **무료 재검증**(코드만, LLM·DB 없음).
//   npx tsx scripts/ap-generation/stock.ts && npx tsx scripts/ap-generation/revalidate-free.ts
// 검사: (1) 중복(완전 중복은 stock.ts 가 제거; 여기서는 최신 게이트 통과 문항군과의 변형 관계 표시) (2) 범위(금지어·단원) (3) 구조(결정적 게이트 gateMc/gateFrq + 참조 프로필)
//       (4) 코드 계산 재실행(항목의 verification_code 를 다시 실행해 키·파트 수치 재확인).
// 출력: data/ap/stock/revalidation-free.json, docs/ap/revalidation-free-report.md
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { calibrateFrq, calibrateMc, gateFrq, gateMc, gateNoCalcExact, type FrqPack, type McPack } from "../../lib/ap-generation/gates";
import { calcAbGuide } from "../../lib/ap-generation/subjects/calc-ab";
import type { StockItem } from "../../lib/ap-generation/stock";
import type { ApCurriculumFile } from "../../lib/ap-curriculum/types";

const PY = process.env.AP_PY ?? "/private/tmp/claude-501/-Users-jangjiman-Developer-ALTON/d05b2ffe-5d6e-4058-a909-5e3b8827cbe2/scratchpad/apvenv/bin/python";
const items = (JSON.parse(readFileSync(path.resolve(process.cwd(), "data/ap/stock/items.json"), "utf-8")) as StockItem[]).filter((i) => i.validation === "needs_revalidation");
const cur = new Map<string, ApCurriculumFile>(); const curr = (s: string) => cur.get(s) ?? (cur.set(s, JSON.parse(readFileSync(path.resolve(process.cwd(), `data/ap/curriculum-2027/${s}.json`), "utf-8"))), cur.get(s)!);
const all = JSON.parse(readFileSync(path.resolve(process.cwd(), "data/ap/stock/items.json"), "utf-8")) as StockItem[];
const autoFam = new Set(all.filter((i) => i.validation === "auto_passed").map((i) => i.itemFamilyId));
function runPy(code: unknown): { ok: boolean; out: Record<string, unknown> | null; err: string } {
  if (typeof code !== "string" || !code.trim()) return { ok: false, out: null, err: "no_code" };
  const tmp = `/tmp/ap-revalidate-${process.pid}.py`; writeFileSync(tmp, code);
  const r = spawnSync(PY, ["-I", tmp], { timeout: 25000, encoding: "utf-8", env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" } as unknown as NodeJS.ProcessEnv });
  if (r.status !== 0) return { ok: false, out: null, err: (r.stderr ?? r.error?.message ?? "").slice(0, 120) };
  try { const l = (r.stdout ?? "").trim().split("\n").filter(Boolean); return { ok: true, out: JSON.parse(l[l.length - 1]), err: "" }; } catch { return { ok: false, out: null, err: "unparseable" }; }
}
type Res = { stockKey: string; subject: string; kind: string; fails: Record<string, string[]>; survivor: boolean };
const results: Res[] = [];
for (const it of items) {
  const fails: Record<string, string[]> = { duplicate: [], scope: [], structure: [], computation: [] }; const p = it.payload as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const guide = it.apSubjectCode === "ap_calculus_ab" ? calcAbGuide : null; const c = curr(it.apSubjectCode); const skills = new Set(c.skills.map((s) => s.code));
  if (autoFam.has(it.itemFamilyId)) fails.duplicate.push("variant_of_latest_gate_family"); // 정보: 같은 문항군(변형) — 탈락 사유 아님
  const text = JSON.stringify(p);
  if (guide) for (const b of guide.bannedTerms) if (new RegExp(b.pattern, "i").test(text)) fails.scope.push(`banned:${b.why}`);
  if (!c.units.some((u) => u.topics.some((t) => t.code === it.keywordCode))) fails.scope.push("topic_not_in_curriculum");
  if (it.kind === "mc") {
    const list: Record<string, any>[] = Array.isArray(p.items) ? p.items : [p]; // eslint-disable-line @typescript-eslint/no-explicit-any
    list.forEach((q, n) => {
      const opts = (q.options as unknown[]).map((o, i) => (typeof o === "string" ? { text: o, why: (q.option_rationale as string[])?.[i] ?? "", value: null } : o)) as McPack["options"];
      const key = typeof q.key_index_before_shuffle === "number" ? q.key_index_before_shuffle : q.key_index; // 재배열 전 인덱스로 코드 결과와 대조
      const keyNow = q.key_index as number;
      const pack = { archetype: "legacy", topic: it.keywordCode, skill: q.skill_primary ?? it.skillPrimary, calculator: (it.calculator as McPack["calculator"]) ?? "na", stem: q.stem ?? "", stimulus: q.stimulus ?? p.stimulus ?? { kind: "none", description: "", data: {} }, options: opts, key_index: keyNow, est_seconds: q.est_seconds ?? 90, facts: [], explanation_en: q.explanation_en } as McPack;
      const s = [...gateMc(it.apSubjectCode, pack), ...calibrateMc(it.apSubjectCode, pack), ...gateNoCalcExact(pack)].filter((x) => !/explanation_does_not_cover|reference_distractor/.test(x));
      fails.structure.push(...s.map((x) => (list.length > 1 ? `item${n + 1}:${x}` : x)));
      const code = q.verification_code ?? (list.length === 1 ? p.verification_code : undefined); const r = runPy(code);
      if (!r.ok) fails.computation.push(`verification_${r.err || "error"}`); else if (r.out?.conceptual_only !== true && r.out?.computed_key_index !== key) fails.computation.push("key_mismatch_on_rerun"); else if (r.out?.conceptual_only === true) fails.computation.push("conceptual_only(info)");
    });
  } else {
    const parts = (p.parts as any[]).map((x) => ({ ...x, skill_codes: x.skill_codes ?? [] })); // eslint-disable-line @typescript-eslint/no-explicit-any
    const pack = { archetype: "legacy", template: p.template ?? "", topic: it.keywordCode, skill: it.skillPrimary, calculator: p.calculator_part ?? "na", title: p.title ?? "", stimulus: p.stimulus ?? { kind: "", description: "" }, parts, total_points: p.total_points, est_minutes: p.est_minutes ?? 15, facts: [] } as FrqPack;
    fails.structure.push(...gateFrq(it.apSubjectCode, pack, skills), ...calibrateFrq(pack, it.apSubjectCode));
    const r = runPy(p.verification_code); if (!r.ok) fails.computation.push(`verification_${r.err || "error"}`); else { const chk = (r.out?.checks as { part: string; pass: boolean }[]) ?? []; if (!chk.length && !(r.out?.conceptual_parts as unknown[])?.length) fails.computation.push("no_checks"); chk.filter((k) => !k.pass).forEach((k) => fails.computation.push(`part_${k.part}_numeric_check_failed`)); }
  }
  const hard = ["scope", "structure", "computation"].some((k) => fails[k].some((x) => !/\(info\)$/.test(x)));
  results.push({ stockKey: it.stockKey, subject: it.apSubjectCode, kind: it.kind, fails, survivor: !hard });
}
writeFileSync(path.resolve(process.cwd(), "data/ap/stock/revalidation-free.json"), JSON.stringify(results, null, 0));
const agg = new Map<string, { n: number; surv: number; dupVar: number; scope: number; structure: number; computation: number; conceptual: number }>();
for (const r of results) { const k = `${r.subject}|${r.kind}`; const a = agg.get(k) ?? { n: 0, surv: 0, dupVar: 0, scope: 0, structure: 0, computation: 0, conceptual: 0 }; a.n++; if (r.survivor) a.surv++; if (r.fails.duplicate.length) a.dupVar++; if (r.fails.scope.length) a.scope++; if (r.fails.structure.length) a.structure++; if (r.fails.computation.some((x) => !/\(info\)$/.test(x))) a.computation++; if (r.fails.computation.some((x) => /conceptual_only/.test(x))) a.conceptual++; agg.set(k, a); }
// 비용 추정: 최신 런 결과 파일의 단계별 평균 호출 비용(동기 = 배치의 2배)
const jl = (f: string) => readFileSync(f, "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as { ok?: boolean; cost?: number; custom_id: string });
const avg = (st: string, run: string) => { const x = jl(path.resolve(process.cwd(), `data/ap/sample-2027/${run}/${st}.results.jsonl`)).filter((r) => r.ok); return x.reduce((a, r) => a + (r.cost ?? 0), 0) / Math.max(1, x.length); };
const per = { solve: avg("solve", "run2"), review: avg("review", "run2"), difficulty: avg("difficulty", "run2") }; const syncPer = per.solve + per.review + per.difficulty;
const L: string[] = ["# 첫 샘플 재검증 대상(needs_revalidation) 무료 검사 결과", "", "코드만 사용(LLM·DB 호출 0). 검사: 범위(금지어·토픽), 구조(결정적 게이트+참조 프로필), 코드 계산 재실행(항목의 `verification_code` 재실행), 변형 관계(최신 게이트 통과 문항군과 같은 군인지 — 탈락 사유 아님).", "", "| 과목 | 종류 | 대상 | 범위 실패 | 구조 실패 | 코드 계산 실패 | 개념 전용(코드 검증 불가) | 최신 통과군의 변형 | **무료 검사 생존** |", "|---|---|---|---|---|---|---|---|---|"];
let tN = 0, tS = 0; const surv: Record<string, number> = {};
for (const [k, a] of [...agg.entries()].sort()) { const [s, kind] = k.split("|"); L.push(`| ${s} | ${kind === "mc" ? "MC" : "FRQ"} | ${a.n} | ${a.scope} | ${a.structure} | ${a.computation} | ${a.conceptual} | ${a.dupVar} | **${a.surv}** |`); tN += a.n; tS += a.surv; surv[kind] = (surv[kind] ?? 0) + a.surv; }
L.push("", `- 합계: 대상 ${tN} → 무료 검사 생존 ${tS} (MC ${surv.mc ?? 0}, FRQ ${surv.frq_bundle ?? 0}).`);
const per1 = syncPer, perBatch = syncPer / 2;
L.push("", "## 생존 항목 LLM 재검증 비용 vs 신규 생성 비용(추정)", "", `- 단계별 평균 호출 비용(런2 실측, 동기=배치×2): 독립 풀이 $${per.solve.toFixed(4)}, 5기준 검토 $${per.review.toFixed(4)}, 난이도 $${per.difficulty.toFixed(4)} → 항목당 동기 $${per1.toFixed(3)}, 배치 약 $${perBatch.toFixed(3)} (FRQ 는 더 길어 약 2.5배 가정).`);
const mcS = surv.mc ?? 0, frS = surv.frq_bundle ?? 0;
L.push(`- 재검증(풀이+검토+난이도, 수선 없음): MC ${mcS}개 ≈ $${(mcS * per1).toFixed(1)}(동기) / $${(mcS * perBatch).toFixed(1)}(배치), FRQ ${frS}개 ≈ $${(frS * per1 * 2.5).toFixed(1)}(동기) / $${(frS * perBatch * 2.5).toFixed(1)}(배치). **합계 약 $${(mcS * per1 + frS * per1 * 2.5).toFixed(1)}(동기)**.`);
L.push(`- 신규 생성(코드 우선, 실측): 사용 가능 고유 MC 1개당 $0.134, FRQ 1개당 $0.399(수선·낭비 포함) → 같은 개수를 새로 만들면 MC ${mcS}개 ≈ $${(mcS * 0.134).toFixed(1)}, FRQ ${frS}개 ≈ $${(frS * 0.399).toFixed(1)}.`);
L.push("- **판단 근거**: 재검증은 '검토만' 하므로 항목당 비용이 신규 생성보다 낮지만, 재검증 통과분은 **코드 우선 키 검증이 아니라 런1의 자체 검증 코드 + LLM 풀이**에 의존한다(생성기 독립 검증 경로 없음). 또한 Bio/Micro 는 코드 우선 원형이 아직 없어 신규 생성 경로가 없다 → 재검증이 유일한 단기 재고 경로. 유료 전수 재검증은 이 보고와 오너 결정 뒤에만 실행.", "", "## 한계", "", "- 코드 계산 재실행은 `verification_code` 가 있는 항목만 해당(없거나 개념 전용이면 '개념 전용'으로 표시).", "- 범위 검사는 AB 가이드의 금지어만 적용(Bio·Micro 과목 가이드는 아직 없음).", "- **구조 실패의 일부는 규칙 오탐일 수 있다**: 런1 FRQ 루브릭의 행 문구가 `answer/value…` 키워드를 쓰지 않는 경우(특히 Micro FRQ 'calculation_without_answer_row' 24건)와 Calculus 표 참조 문구는 규칙 문구 일치 검사라 사람이 표본 확인 후 규칙을 조정해야 한다. 이 단계는 탈락 확정이 아니라 **유료 재검증 전 무료 선별**이다(탈락 항목도 삭제하지 않고 이력 보존).");
writeFileSync(path.resolve(process.cwd(), "docs/ap/revalidation-free-report.md"), L.join("\n") + "\n");
console.log(L.join("\n"));
