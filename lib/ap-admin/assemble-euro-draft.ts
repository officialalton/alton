// AP European History 풀 모의고사 초안 세트 계획(순수 함수). 구조: MC 55 = 3–4문항 자료 세트(14–18개) / SAQ 3(saq1·saq2·saq3, 서로 다른 시대) + DBQ + LEQ.
// 보고서 형식(euro-assign.ts): mcA = MC 후보 키(세트는 한 번, 시대 순), frqA = FRQ 키(saq1·saq2·saq3·dbq·leq 순). 세트는 후보 1개 = 문제 n건(ap_candidate_problems.item_index 0..n-1)이며 연속 n칸.
// 단원·자료 유형·스킬 범주 범위는 차단 조건이다(lib/ap-exam/euro-rules.ts). 시험 사이 중복은 배정기가 막고, 여기서는 저장된 다른 풀 세트와 같은 문항이 없는지 본다.
import { apSectionLayout } from "../ap-exam/layouts";
import { EURO_FRQ_TEMPLATES, verifyEuroFullComposition, type EuroSetItem } from "../ap-exam/euro-rules";
import type { DraftPlan, FullSetUsage, PoolRow, SetKeys } from "./assemble-draft";
import { loadEuroPool, type EuroItem } from "../../scripts/ap-generation/euro-pool";

const DIFF: Record<string, "easy" | "medium" | "hard"> = { basic_learning: "easy", exam_prep: "medium", advanced_supplement: "hard" };
let cache: EuroItem[] | null = null;
/** 화면 증거까지 있는 European History 재고. 프로세스당 한 번만 계산한다. */
export const euroStockItems = (): EuroItem[] => (cache ??= loadEuroPool().pool);

export function planEuroDraftSet(o: { setId: string; keys: SetKeys; hasVirtual: boolean; name: string; pool: PoolRow[]; existingFullSets: FullSetUsage[]; stock?: EuroItem[]; subject: string }): DraftPlan {
  const problems: string[] = [];
  const mcKeys = [...(o.keys.mcA ?? []), ...(o.keys.mcB ?? [])]; const frqKeys = [...(o.keys.frqA ?? []), ...(o.keys.frqB ?? [])]; const all = [...mcKeys, ...frqKeys];
  if (o.hasVirtual) problems.push("이 배정에는 가상 문항(재고에 없는 칸)이 있어 저장하지 않습니다.");
  if (new Set(all).size !== all.length) problems.push("세트 안에 같은 문항이 두 번 들어 있습니다.");
  const byKey = new Map(o.pool.map((r) => [r.candidate_key, r])); const stockBy = new Map((o.stock ?? euroStockItems()).map((c) => [c.key, c]));
  const notReady: string[] = [];
  for (const key of all) {
    const r = byKey.get(key); const st = stockBy.get(key);
    if (!st) { problems.push(`재고(화면 증거 보유)에 없는 키 ${key}`); continue; }
    if (!r || r.purpose !== "mock_exam" || !r.is_current) { notReady.push(`${key}(변환 안 됨)`); continue; }
    if (!r.render_verified || !r.screen_verified) { notReady.push(`${key}(렌더·화면 검증 미완)`); continue; }
    const want = st.kind === "mc" ? st.members.length : 1; const have = (r.ap_candidate_problems ?? []).length;
    if (have !== want) notReady.push(`${key}(변환 문제 ${have}건, ${want}건 필요)`);
  }
  if (notReady.length) problems.push(`문제은행 변환·검증이 끝나지 않은 문항 ${notReady.length}건: ${notReady.slice(0, 8).join(", ")}${notReady.length > 8 ? " …" : ""}`);
  const comp: EuroSetItem[] = []; let pos = 1;
  for (const key of mcKeys) { const st = stockBy.get(key); if (!st) continue; for (const m of st.members) comp.push({ kind: "mc", unit: m.unit, dbUnit: st.keyUnit, skill: m.skill, candidateKey: key, position: pos++, stim: st.stim }); }
  for (const [i, key] of frqKeys.entries()) { const st = stockBy.get(key); comp.push({ kind: "frq", unit: null, skill: null, candidateKey: key, position: i + 1, template: st?.template, era: st?.era }); }
  for (const v of verifyEuroFullComposition(comp)) problems.push(`독립 검증: ${v}`);
  const tpls = frqKeys.map((k) => stockBy.get(k)?.template); if (tpls.join() !== EURO_FRQ_TEMPLATES.join()) problems.push(`독립 검증: FRQ 순서가 saq1·saq2·saq3·dbq·leq 가 아님(${tpls.join(",")})`);
  const fams = mcKeys.map((k) => stockBy.get(k)?.fam); if (new Set(fams).size !== fams.length) problems.push("독립 검증: 세트 안 문항군(주제) 중복");
  const blocked = new Set(o.existingFullSets.flatMap((s) => s.candidateKeys));
  const mine = all.flatMap((k) => (byKey.get(k)?.ap_candidate_problems ?? []).map((p) => p.problem_id));
  if (o.existingFullSets.some((s) => s.name === o.name)) problems.push(`같은 이름의 세트가 이미 있습니다: ${o.name}`);
  const sig = [...mine].sort().join(","); const same = o.existingFullSets.find((s) => mine.length > 0 && [...s.problemIds].sort().join(",") === sig); if (same) problems.push(`같은 문항 구성의 세트가 이미 있습니다: ${same.name}`);
  for (const s of o.existingFullSets.filter((x) => x.problemIds.some((p) => mine.includes(p)))) problems.push(`저장된 세트 "${s.name}"(${s.status})와 같은 문항이 있습니다.`);
  for (const k of all) if (blocked.has(k)) problems.push(`다른 풀 세트가 이미 쓰는 문항 ${k}`);
  const items: DraftPlan["items"] = []; let mp = 0;
  for (const key of mcKeys) {
    const r = byKey.get(key); const st = stockBy.get(key); if (!r || !st) continue;
    [...(r.ap_candidate_problems ?? [])].sort((a, b) => a.item_index - b.item_index).forEach((p, j) => items.push({ sectionKey: "ap_mc", position: ++mp, problemId: p.problem_id, versionId: p.problem_version_id, satDomain: `ap:${st.members[j]?.topic ?? r.keyword_code}`, difficulty: DIFF[r.difficulty_provisional ?? ""] ?? "medium", candidateKey: key }));
  }
  let sp = 0, fp = 0;
  for (const key of frqKeys) {
    const r = byKey.get(key); const st = stockBy.get(key); const p = r?.ap_candidate_problems?.[0]; if (!r || !p || !st) continue;
    const saq = /^saq/.test(st.template);
    items.push({ sectionKey: saq ? "ap_saq" : "ap_frq", position: saq ? ++sp : ++fp, problemId: p.problem_id, versionId: p.problem_version_id, satDomain: `ap:${r.keyword_code}`, difficulty: DIFF[r.difficulty_provisional ?? ""] ?? "medium", candidateKey: key });
  }
  const composition = { mcA: mp, mcB: 0, frqA: sp + fp, frqB: 0, mcTotal: mp, frqTotal: sp + fp };
  return { ok: problems.length === 0, setId: o.setId, subject: o.subject, name: o.name, problems, composition, items, layout: { sections: apSectionLayout(o.subject) } };
}
