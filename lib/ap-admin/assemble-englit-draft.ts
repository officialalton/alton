// AP English Literature 풀 모의고사 초안 세트 계획(순수 함수). assemble-draft.ts 의 AB/BC 경로와 별개로, 문학의 구조(MC 55 = 지문 5묶음(8–13문항, 시·단편·장편/희곡) / FRQ 3 = q1 시 분석·q2 산문 분석·q3 문학 논증 각 1)를 독립 검증한다.
// 보고서 형식(lt-assign.ts): mcA = MC 후보 키(지문 묶음은 한 번, 장르 순 단편 → 시 → 장편·희곡), frqA = FRQ 키(q1·q2·q3 순). 묶음은 후보 1개 = 문제 n건(ap_candidate_problems.item_index 0..n-1)이며 연속 n칸에 그대로 들어간다.
import { apSectionLayout } from "../ap-exam/layouts";
import { ENGLIT_FRQ_TYPES, verifyEnglitFullComposition, type EnglitSetItem } from "../ap-exam/englit-rules";
import type { DraftPlan, FullSetUsage, PoolRow, SetKeys } from "./assemble-draft";
import { loadLtPool, type LtItem } from "../../scripts/ap-generation/lt-pool";

const DIFF: Record<string, "easy" | "medium" | "hard"> = { basic_learning: "easy", exam_prep: "medium", advanced_supplement: "hard" };
let cache: LtItem[] | null = null;
/** 화면 증거까지 있는 문학 재고. 프로세스당 한 번만 계산한다. */
export const ltStockItems = (): LtItem[] => (cache ??= loadLtPool().pool);

export function planLtDraftSet(o: { setId: string; keys: SetKeys; hasVirtual: boolean; name: string; pool: PoolRow[]; existingFullSets: FullSetUsage[]; stock?: LtItem[]; subject: string }): DraftPlan {
  const problems: string[] = []; const mcKeys = [...(o.keys.mcA ?? []), ...(o.keys.mcB ?? [])]; const frqKeys = [...(o.keys.frqA ?? []), ...(o.keys.frqB ?? [])]; const all = [...mcKeys, ...frqKeys];
  if (o.hasVirtual) problems.push("이 배정에는 가상 문항(재고에 없는 칸)이 있어 저장하지 않습니다.");
  if (new Set(all).size !== all.length) problems.push("세트 안에 같은 문항이 두 번 들어 있습니다.");
  const byKey = new Map(o.pool.map((r) => [r.candidate_key, r])); const stockBy = new Map((o.stock ?? ltStockItems()).map((c) => [c.key, c])); const notReady: string[] = [];
  for (const key of all) {
    const r = byKey.get(key); const st = stockBy.get(key);
    if (!st) { problems.push(`재고(화면 증거 보유)에 없는 키 ${key}`); continue; }
    if (!r || r.purpose !== "mock_exam" || !r.is_current) { notReady.push(`${key}(변환 안 됨)`); continue; }
    if (!r.render_verified || !r.screen_verified) { notReady.push(`${key}(렌더·화면 검증 미완)`); continue; }
    const want = st.kind === "mc" ? st.members.length : 1; const have = (r.ap_candidate_problems ?? []).length; if (have !== want) notReady.push(`${key}(변환 문제 ${have}건, ${want}건 필요)`);
  }
  if (notReady.length) problems.push(`문제은행 변환·검증이 끝나지 않은 문항 ${notReady.length}건: ${notReady.slice(0, 8).join(", ")}${notReady.length > 8 ? " …" : ""}`);
  const comp: EnglitSetItem[] = []; let pos = 1;
  for (const key of mcKeys) { const st = stockBy.get(key); if (!st) continue; for (const m of st.members) comp.push({ kind: "mc", skill: m.skill, group: st.group, candidateKey: key, position: pos++ }); }
  for (const [i, key] of frqKeys.entries()) comp.push({ kind: "frq", skill: null, group: null, candidateKey: key, position: i + 1 });
  for (const v of verifyEnglitFullComposition(comp)) problems.push(`독립 검증: ${v}`);
  const mcStock = mcKeys.map((k) => stockBy.get(k)).filter((c): c is LtItem => !!c); const fams = mcStock.map((c) => c.fam); if (new Set(fams).size !== fams.length) problems.push("독립 검증: 세트 안 문항군(구조 look-alike) 중복");
  const types = frqKeys.map((k) => stockBy.get(k)?.frqType).filter(Boolean); if (new Set(types).size !== types.length || types.length !== ENGLIT_FRQ_TYPES.length || !ENGLIT_FRQ_TYPES.every((t) => types.includes(t))) problems.push(`독립 검증: FRQ 유형이 3개(q1 시 분석 / q2 산문 분석 / q3 문학 논증) 각 1개가 아님(${types.join(",")})`);
  const ffams = frqKeys.map((k) => stockBy.get(k)?.fam); if (new Set(ffams).size !== ffams.length) problems.push("독립 검증: FRQ 문항군 중복");
  const blocked = new Set(o.existingFullSets.flatMap((s) => s.candidateKeys)); const mine = all.flatMap((k) => (byKey.get(k)?.ap_candidate_problems ?? []).map((p) => p.problem_id));
  if (o.existingFullSets.some((s) => s.name === o.name)) problems.push(`같은 이름의 세트가 이미 있습니다: ${o.name}`);
  const sig = [...mine].sort().join(","); const same = o.existingFullSets.find((s) => mine.length > 0 && [...s.problemIds].sort().join(",") === sig); if (same) problems.push(`같은 문항 구성의 세트가 이미 있습니다: ${same.name}`);
  for (const s of o.existingFullSets.filter((x) => x.problemIds.some((p) => mine.includes(p)))) problems.push(`저장된 세트 "${s.name}"(${s.status})와 같은 문항이 있습니다.`);
  for (const k of all) if (blocked.has(k)) problems.push(`다른 풀 세트가 이미 쓰는 문항 ${k}`);
  const items: DraftPlan["items"] = []; let mp = 0, fp = 0;
  for (const key of mcKeys) { const r = byKey.get(key); const st = stockBy.get(key); if (!r || !st) continue; const rows = [...(r.ap_candidate_problems ?? [])].sort((a, b) => a.item_index - b.item_index);
    rows.forEach((p, j) => items.push({ sectionKey: "ap_mc", position: ++mp, problemId: p.problem_id, versionId: p.problem_version_id, satDomain: `ap:${st.members[j]?.topic ?? r.keyword_code}`, difficulty: DIFF[r.difficulty_provisional ?? ""] ?? "medium", candidateKey: key })); }
  for (const key of frqKeys) { const r = byKey.get(key); const p = r?.ap_candidate_problems?.[0]; if (!r || !p) continue; items.push({ sectionKey: "ap_frq", position: ++fp, problemId: p.problem_id, versionId: p.problem_version_id, satDomain: `ap:${r.keyword_code}`, difficulty: DIFF[r.difficulty_provisional ?? ""] ?? "medium", candidateKey: key }); }
  const composition = { mcA: mp, mcB: 0, frqA: fp, frqB: 0, mcTotal: mp, frqTotal: fp };
  return { ok: problems.length === 0, setId: o.setId, subject: o.subject, name: o.name, problems, composition, items, layout: { sections: apSectionLayout(o.subject) } };
}
