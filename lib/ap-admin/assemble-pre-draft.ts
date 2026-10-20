// AP Precalculus 풀 모의고사 초안 세트 계획(순수 함수). MC 42 = 파트 A 29(계산기 불가) + 파트 B 13(그래핑 계산기 필수), FRQ 4 = 파트 A 2(fc·mn, 계산기) + 파트 B 2(mp·sy, 계산기 불가).
// 보고서 형식(pre-assign.ts toReportSet): mcA = 파트 A 키(단원 순), mcB = 파트 B 키, frqA = [fc, mn], frqB = [mp, sy]. 섹션 키는 ap_mc_a/ap_mc_b/ap_frq_a/ap_frq_b(레이아웃과 같다).
// 계산기 허용 여부는 섹션 레이아웃(not_allowed/required)이 학생 화면에서 제어하고, 여기서는 후보의 calculator 값이 섹션과 맞는지 독립 검증한다.
import { apSectionLayout } from "../ap-exam/layouts";
import { PRE_FRQ_CALC, verifyPreFullComposition, type PreSetItem } from "../ap-exam/full-set-rules";
import type { DraftPlan, FullSetUsage, PoolRow, SetKeys } from "./assemble-draft";
import { loadPrePool, type PreItem } from "../../scripts/ap-generation/pre-pool";

const DIFF: Record<string, "easy" | "medium" | "hard"> = { basic_learning: "easy", exam_prep: "medium", advanced_supplement: "hard" };
let cache: PreItem[] | null = null;
/** 화면 증거까지 있는 Precalculus 재고. 프로세스당 한 번만 계산한다. */
export const preStockItems = (): PreItem[] => (cache ??= loadPrePool().pool);
const FRQ_PART_TEMPLATES = { frqA: ["fc", "mn"], frqB: ["mp", "sy"] } as const;

export function planPreDraftSet(o: {
  setId: string; keys: SetKeys; hasVirtual: boolean; name: string; pool: PoolRow[]; existingFullSets: FullSetUsage[]; stock?: PreItem[]; subject: string;
}): DraftPlan {
  const problems: string[] = [];
  const g = (k: keyof SetKeys) => o.keys[k] ?? [];
  const all = [...g("mcA"), ...g("mcB"), ...g("frqA"), ...g("frqB")];
  if (o.hasVirtual) problems.push("이 배정에는 가상 문항(재고에 없는 칸)이 있어 저장하지 않습니다.");
  if (new Set(all).size !== all.length) problems.push("세트 안에 같은 문항이 두 번 들어 있습니다.");
  const byKey = new Map(o.pool.map((r) => [r.candidate_key, r]));
  const stockBy = new Map((o.stock ?? preStockItems()).map((c) => [c.key, c]));
  const notReady: string[] = [];
  for (const key of all) {
    const r = byKey.get(key);
    if (!stockBy.has(key)) { problems.push(`재고(화면 증거 보유)에 없는 키 ${key}`); continue; }
    if (!r || r.purpose !== "mock_exam" || !r.is_current) { notReady.push(`${key}(변환 안 됨)`); continue; }
    if (!r.render_verified || !r.screen_verified) { notReady.push(`${key}(렌더·화면 검증 미완)`); continue; }
    if ((r.ap_candidate_problems ?? []).length !== 1) notReady.push(`${key}(변환 문제 ${(r.ap_candidate_problems ?? []).length}건 — 후보당 1건만 지원)`);
  }
  if (notReady.length) problems.push(`문제은행 변환·검증이 끝나지 않은 문항 ${notReady.length}건: ${notReady.slice(0, 8).join(", ")}${notReady.length > 8 ? " …" : ""}`);

  // 독립 검증: 파트별 계산기 일치, 구성(42 = 29 + 13, FRQ 4유형 각 1, 단원 범위), FRQ 파트별 유형, 문항군 중복
  for (const k of g("mcA")) { const c = stockBy.get(k); if (c && c.calc !== "not_allowed") problems.push(`독립 검증: 파트 A(계산기 불가)에 계산기 필수 문항 ${k}`); }
  for (const k of g("mcB")) { const c = stockBy.get(k); if (c && c.calc !== "required") problems.push(`독립 검증: 파트 B(그래핑 계산기 필수)에 계산기 불가 문항 ${k}`); }
  for (const part of ["frqA", "frqB"] as const) {
    const types = g(part).map((k) => stockBy.get(k)?.template ?? "");
    if ([...types].sort().join() !== [...FRQ_PART_TEMPLATES[part]].sort().join()) problems.push(`독립 검증: FRQ ${part === "frqA" ? "파트 A" : "파트 B"} 유형이 ${FRQ_PART_TEMPLATES[part].join("·")} 가 아닙니다(${types.join(",")})`);
  }
  const comp: PreSetItem[] = []; let pos = 1;
  for (const key of [...g("mcA"), ...g("mcB")]) { const c = stockBy.get(key); if (c) comp.push({ kind: "mc", unit: String(c.unit), calc: c.calc, template: null, candidateKey: key, position: pos++ }); }
  for (const [i, key] of [...g("frqA"), ...g("frqB")].entries()) { const c = stockBy.get(key); if (c) comp.push({ kind: "frq", unit: null, calc: PRE_FRQ_CALC[c.template] ?? null, template: c.template, candidateKey: key, position: i + 1 }); }
  for (const v of verifyPreFullComposition(comp)) problems.push(`독립 검증: ${v}`);
  const fams = [...g("mcA"), ...g("mcB")].map((k) => stockBy.get(k)?.fam).filter(Boolean); if (new Set(fams).size !== fams.length) problems.push("독립 검증: 세트 안 문항군(구조 look-alike) 중복");
  const ffams = [...g("frqA"), ...g("frqB")].map((k) => stockBy.get(k)?.fam).filter(Boolean); if (new Set(ffams).size !== ffams.length) problems.push("독립 검증: FRQ 문항군 중복");

  const mine = all.map((k) => byKey.get(k)?.ap_candidate_problems?.[0]?.problem_id).filter((x): x is string => !!x);
  const blocked = new Set(o.existingFullSets.flatMap((s) => s.candidateKeys));
  if (o.existingFullSets.some((s) => s.name === o.name)) problems.push(`같은 이름의 세트가 이미 있습니다: ${o.name}`);
  const sig = [...mine].sort().join(",");
  const same = o.existingFullSets.find((s) => mine.length > 0 && [...s.problemIds].sort().join(",") === sig); if (same) problems.push(`같은 문항 구성의 세트가 이미 있습니다: ${same.name}`);
  for (const s of o.existingFullSets.filter((x) => x.problemIds.some((p) => mine.includes(p)))) problems.push(`저장된 세트 "${s.name}"(${s.status})와 같은 문항이 있습니다.`);
  for (const k of all) if (blocked.has(k)) problems.push(`다른 풀 세트가 이미 쓰는 문항 ${k}`);

  const items: DraftPlan["items"] = []; const at: Record<string, number> = {};
  for (const [part, sectionKey] of [["mcA", "ap_mc_a"], ["mcB", "ap_mc_b"], ["frqA", "ap_frq_a"], ["frqB", "ap_frq_b"]] as const) {
    for (const key of g(part)) {
      const r = byKey.get(key); const p = r?.ap_candidate_problems?.[0]; if (!r || !p) continue;
      at[sectionKey] = (at[sectionKey] ?? 0) + 1;
      items.push({ sectionKey, position: at[sectionKey], problemId: p.problem_id, versionId: p.problem_version_id, satDomain: `ap:${r.keyword_code}`, difficulty: DIFF[r.difficulty_provisional ?? ""] ?? "medium", candidateKey: key });
    }
  }
  const composition = { mcA: g("mcA").length, mcB: g("mcB").length, frqA: g("frqA").length, frqB: g("frqB").length, mcTotal: g("mcA").length + g("mcB").length, frqTotal: g("frqA").length + g("frqB").length };
  return { ok: problems.length === 0, setId: o.setId, subject: o.subject, name: o.name, problems, composition, items, layout: { sections: apSectionLayout(o.subject) } };
}
