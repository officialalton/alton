// 재검증 통과 후보의 상태 갱신 계획(파일 단계, DB 없음). 기본 dry-run: 결정만 계산·출력, --write 로 data/ap/stock/revalidation-apply.json 기록.
//   npx tsx scripts/ap-generation/apply-revalidation.ts [--write]
// 규칙: LLM 재검증 통과(S2/S3) AND 결정적 검사 전부 통과(구조·계산 무료 선별 생존, 최신 구조 게이트 v2, 생성기 결함, 표↔본문 모순, 완전 중복 아님)일 때만 'auto_passed'.
// 상태 반영은 stock.ts 가 이 파일을 읽어 수행(gateVersion = v2-legacy-revalidated-2026-10-09, 이력에 검증 방법·버전 기록). 학생 노출은 렌더·화면 검증 후에만.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { calibrateFrq, calibrateMc, gateFrq, gateMc, gateNoCalcExact, type FrqPack, type McPack } from "../../lib/ap-generation/gates";
import { generatorDefects } from "../../lib/ap-generation/generator-defects";
import { tableTextContradictions } from "../../lib/ap-generation/table-consistency";
import type { ApCurriculumFile } from "../../lib/ap-curriculum/types";

const root = path.resolve("data/ap/sample-2027"); type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const rj = <T,>(f: string): T => JSON.parse(readFileSync(f, "utf-8")) as T;
const results = rj<{ stockKey: string; source: string; subject: string; kind: string; passed: boolean; generatorDefect: boolean }[]>("data/ap/stock/revalidation-results.json");
const items = new Map(rj<Json[]>("data/ap/stock/items.json").map((i) => [i.stockKey as string, i])); const free = new Map(rj<Json[]>("data/ap/stock/revalidation-free.json").map((r) => [r.stockKey as string, r]));
const dirs = ["s2-ab", "s2-bio", "s2-micro", "s3-ab", "s3-bio", "s3-micro"]; const packOf = new Map<string, Json>();
for (const d of dirs) { const t = rj<Record<string, Json>>(path.join(root, d, "truth.json")); const p = rj<Record<string, Json[]>>(path.join(root, d, "packs.json")); for (const [k, v] of Object.entries(t)) packOf.set(v.stockKey as string, p[k.replace(/-k0$/, "")][0]); }
const cur = new Map<string, Set<string>>(); const skillsOf = (s: string) => { if (!cur.has(s)) cur.set(s, new Set(rj<ApCurriculumFile>(`data/ap/curriculum-2027/${s}.json`).skills.map((x) => x.code))); return cur.get(s)!; };
const cand = results.filter((r) => r.passed && !r.generatorDefect);
const out = cand.map((r) => {
  const it = items.get(r.stockKey)!; const pack = packOf.get(r.stockKey)!; const why: string[] = [];
  if (it.validation === "exact_duplicate") why.push("exact_duplicate_in_stock");
  if (!free.get(r.stockKey)?.survivor) why.push("free_check_not_survivor");
  why.push(...generatorDefects(it.payload).map((d) => `generator_defect:${d.code}`));
  if (tableTextContradictions(it.payload).length) why.push("table_text_contradiction");
  if (it.kind === "mc") why.push(...gateMc(it.apSubjectCode, pack as McPack), ...calibrateMc(it.apSubjectCode, pack as McPack), ...gateNoCalcExact(pack as McPack));
  else why.push(...gateFrq(it.apSubjectCode, { ...(pack as FrqPack), parts: (pack.parts as Json[]).map((x) => ({ ...x, skill_codes: x.skill_codes ?? [] })) } as FrqPack, skillsOf(it.apSubjectCode)), ...calibrateFrq(pack as FrqPack, it.apSubjectCode));
  const reasons = [...new Set(why)].filter((x) => !(it.apSubjectCode !== "ap_calculus_ab" && x === "reference_time_out_of_range" && it.kind !== "mc")); // Bio/Micro FRQ 시간은 참고용
  return { stockKey: r.stockKey, subject: r.subject, kind: r.kind, source: r.source, apply: reasons.length === 0, reasons };
});
const by = (f: (x: (typeof out)[number]) => boolean) => out.filter(f);
console.log(`LLM 재검증 통과(결함 플래그 제외) ${cand.length}건 → 최신 결정적 검사 후 승격 ${by((x) => x.apply).length}건, 보류 ${by((x) => !x.apply).length}건`);
const grp: Record<string, number> = {}; by((x) => x.apply).forEach((x) => (grp[`${x.subject}|${x.kind}`] = (grp[`${x.subject}|${x.kind}`] ?? 0) + 1)); console.log("승격 예상(과목|종류):", grp);
const hold: Record<string, number> = {}; by((x) => !x.apply).forEach((x) => x.reasons.forEach((r) => (hold[r] = (hold[r] ?? 0) + 1))); console.log("보류 사유:", hold);
if (process.argv.includes("--write")) { writeFileSync("data/ap/stock/revalidation-apply.json", JSON.stringify(out, null, 1)); console.log("기록: data/ap/stock/revalidation-apply.json"); } else console.log("(dry-run: --write 로 기록)");
