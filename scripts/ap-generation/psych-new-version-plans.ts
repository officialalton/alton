// AP Psychology Practice Exam 1·2 (게시 v2) → v3 정확 배정(exact-assign-psych-ps1-ps2-v3.json) 새 버전 교체 계획 생성기(무료·읽기 전용·DB 없음).
//   npx tsx scripts/ap-generation/psych-new-version-plans.ts [--slots data/ap/stock/psych-ps1-ps2-published-v2-slots.json] [--assign data/ap/stock/exact-assign-psych-ps1-ps2-v3.json] [--assume-converted psych-hard-a-items,psych-hard-b-items] [--write]
// 입력: 게시 v2 슬롯 스냅샷(`supabase db query --linked` SELECT 전용; 두 시험 모두 published v2), v3 배정 보고서, 재고(Psychology 풀).
// 순환 겹침 없음: v3 배정은 `psych-assign.ts --no-transfer <스냅샷>` 으로 만들어 어느 시험도 상대 시험이 지금 갖고 있는 문항을 가져오지 않는다 → PS1·PS2 새 버전은 서로 독립(한 단계씩, 순서 무관).
// 새 버전 초안은 단원을 문항별 토픽이 아니라 후보 keyword_code 단원(절대 범위 11-19; 세트의 전 칸에 같은 값)으로 센다 → 이 스크립트와 테스트는 keyUnit 으로도 검증한다.
import { readFileSync, writeFileSync } from "node:fs";
import { psychUnitBounds, verifyPsychFullComposition, type PsychSetItem } from "../../lib/ap-exam/psych-rules";
import { loadPsychPool, type PsychItem } from "./psych-pool";
import { verifyPsychAssignment, type PsychResult } from "./psych-assign";

export type Slot = { section: string; position: number; candidateKey: string };
export type SetId = "PS1" | "PS2";
export type Snap = Record<SetId, { setId?: string; sourceSetName: string; sourceVersionNo: number; slots: Slot[] }> & { convertedKeys: string[]; dbKeywordCode?: Record<string, string> };
export type Meta = { unit: number | null; skill: string | null; shared: boolean; type: string; examPrep: number };
export type PlanSwap = { section: "ap_mc" | "ap_frq"; position: number; removeKey: string; addKey: string; remove: Meta; add: Meta };
const rd = <T>(p: string) => JSON.parse(readFileSync(p, "utf-8")) as T;
const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };

export const metaOf = (c: PsychItem): Meta => ({ unit: c.members[0]?.unit ?? null, skill: c.members[0]?.skill ?? null, shared: c.shared, type: c.frqType, examPrep: c.exam ?? 0 });
const cls = (c: PsychItem) => (c.kind === "frq" ? `frq:${c.frqType}` : c.shared ? "set" : "single");
const sim = (a: PsychItem, b: PsychItem) => a.members.reduce((n, m, i) => n + (m.unit === b.members[i]?.unit ? 4 : 0) + (m.skill[0] === b.members[i]?.skill[0] ? 2 : 0), 0);

/** 슬롯 → 위치 순서의 MC 구성(세트 = 같은 후보 키가 연속 3칸). */
export function compositionOf(slots: Slot[], by: Map<string, PsychItem>): PsychSetItem[] {
  const out: PsychSetItem[] = []; const mc = slots.filter((s) => s.section === "ap_mc").sort((a, b) => a.position - b.position); const seen = new Map<string, number>();
  for (const s of mc) { const c = by.get(s.candidateKey); if (!c) throw new Error(`재고(화면 증거 보유)에 없는 키 ${s.candidateKey}`); const j = seen.get(s.candidateKey) ?? 0; seen.set(s.candidateKey, j + 1); const m = c.members[j]; out.push({ kind: "mc", unit: String(m.unit), skill: m.skill, candidateKey: c.shared ? s.candidateKey : null, position: s.position }); }
  slots.filter((s) => s.section === "ap_frq").sort((a, b) => a.position - b.position).forEach((s) => out.push({ kind: "frq", unit: null, skill: null, candidateKey: s.candidateKey, position: s.position, frqType: by.get(s.candidateKey)?.frqType ?? "" }));
  return out;
}
export function resultOf(id: string, slots: Slot[], by: Map<string, PsychItem>): PsychResult {
  const keys = [...new Set(slots.filter((s) => s.section === "ap_mc").map((s) => s.candidateKey))]; const items = keys.map((k) => by.get(k)!);
  return { id, singles: items.filter((c) => !c.shared), sets: items.filter((c) => c.shared), frq: slots.filter((s) => s.section === "ap_frq").map((s) => by.get(s.candidateKey)!), virtual: [], virtualSets: [], virtualSetArchetypes: [], frqVirtual: [] };
}
/** 관리자 새 버전·초안이 읽는 단원별 MC 문항 수(후보 keyword_code 단원) 위반. */
export function dbUnitViolations(slots: Slot[], by: Map<string, PsychItem>): string[] {
  const c: Record<string, number> = {}; for (const s of slots.filter((x) => x.section === "ap_mc")) { const u = by.get(s.candidateKey)?.keyUnit; if (u) c[String(u)] = (c[String(u)] ?? 0) + 1; }
  return Object.entries(psychUnitBounds()).flatMap(([u, b]) => { const n = c[u] ?? 0; return n < b.min || n > b.max ? [`db_unit_${u}_${n}_not_in_${b.min}-${b.max}`] : []; });
}
export const slotViolations = (id: string, slots: Slot[], by: Map<string, PsychItem>) => verifyPsychFullComposition(compositionOf(slots, by)).map((v) => `${id}: ${v}`);

/** 같은 부류(단독 / 세트 / FRQ 유형) 안에서 유사도 합 최대 짝짓기(탐욕 + 2-교환 개선). */
export function pairUp(rem: PsychItem[], add: PsychItem[]): [PsychItem, PsychItem][] {
  const out: [PsychItem, PsychItem][] = [];
  for (const k of new Set([...rem, ...add].map(cls))) {
    const r = rem.filter((c) => cls(c) === k), a = add.filter((c) => cls(c) === k);
    if (r.length !== a.length) throw new Error(`부류 ${k} 교체 수 불일치 ${r.length}/${a.length}`);
    const as = [...a]; const pick: PsychItem[] = [];
    for (const x of [...r].sort((p, q) => p.key.localeCompare(q.key))) { let bi = 0, bs = -1; as.forEach((y, i) => { const s = sim(x, y); if (s > bs) { bs = s; bi = i; } }); pick.push(as.splice(bi, 1)[0]); }
    const rs = [...r].sort((p, q) => p.key.localeCompare(q.key));
    for (let pass = 0; pass < 20; pass++) { let ch = false; for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) if (sim(rs[i], pick[j]) + sim(rs[j], pick[i]) > sim(rs[i], pick[i]) + sim(rs[j], pick[j])) { [pick[i], pick[j]] = [pick[j], pick[i]]; ch = true; } if (!ch) break; }
    rs.forEach((x, i) => out.push([x, pick[i]]));
  }
  return out;
}
export function planFor(id: SetId, slots: Slot[], target: { mcA: string[]; frqA: string[] }, by: Map<string, PsychItem>): { swaps: PlanSwap[]; problems: string[] } {
  const problems: string[] = []; const cur = new Set(slots.map((s) => s.candidateKey)); const tgt = new Set([...target.mcA, ...target.frqA]);
  const rem = [...cur].filter((k) => !tgt.has(k)), add = [...tgt].filter((k) => !cur.has(k));
  for (const k of [...rem, ...add]) if (!by.has(k)) problems.push(`${id}: 재고(화면 증거 보유)에 없는 키 ${k}`);
  if (problems.length) return { swaps: [], problems };
  const pairs = pairUp(rem.map((k) => by.get(k)!), add.map((k) => by.get(k)!)); const swaps: PlanSwap[] = [];
  for (const [r, a] of pairs) {
    const section = r.kind === "frq" ? "ap_frq" : "ap_mc"; const first = slots.filter((s) => s.section === section && s.candidateKey === r.key).sort((x, y) => x.position - y.position)[0];
    if (!first) { problems.push(`${id}: ${r.key} 가 ${section} 에 없음`); continue; }
    if (r.members.length !== a.members.length) problems.push(`${id}: 세트 크기가 다름 ${r.key} → ${a.key}`);
    swaps.push({ section, position: first.position, removeKey: r.key, addKey: a.key, remove: metaOf(r), add: metaOf(a) });
  }
  return { swaps, problems };
}
/** 교체를 적용한 슬롯(세트는 3칸 통째). */
export function afterSwaps(slots: Slot[], swaps: PlanSwap[]): Slot[] { const m = new Map(swaps.map((s) => [`${s.section}|${s.removeKey}`, s.addKey])); return slots.map((s) => { const a = m.get(`${s.section}|${s.candidateKey}`); return a ? { ...s, candidateKey: a } : s; }); }

function main() {
  const snap = rd<Snap>(arg("--slots", "data/ap/stock/psych-ps1-ps2-published-v2-slots.json")); const assign = rd<{ sets: { id: string; mcA: string[]; frqA: string[]; virtual: unknown[]; virtualSets: unknown[]; frqVirtual: unknown[] }[] }>(arg("--assign", "data/ap/stock/exact-assign-psych-ps1-ps2-v3.json"));
  const { all } = loadPsychPool({ ignorePctFlags: true }); const by = new Map(all.filter((c) => c.screen).map((c) => [c.key, c])); // 지금 게시본에 있는 표 비율 위반 후보도 '제거 대상'으로 읽어야 하므로 비율 표시 목록은 무시한다(배정기는 쓰지 않는다)
  const assumed = new Set(arg("--assume-converted").split(",").filter(Boolean).flatMap((b) => rd<{ stockKey: string; validation: string; duplicateOf?: string | null }[]>(`data/ap/stock/${b}.json`).filter((r) => r.validation === "auto_passed" && !r.duplicateOf).map((r) => r.stockKey)));
  void assumed; const write = process.argv.includes("--write"); const out: Record<string, { bad: string[]; plan: unknown; file: string }> = {};
  const finals: Record<string, Slot[]> = {};
  for (const id of ["PS1", "PS2"] as SetId[]) {
    const t = assign.sets.find((s) => s.id === id)!; if (t.virtual.length || t.virtualSets.length || t.frqVirtual.length) throw new Error(`${id}: 가상 칸이 있다`);
    const p = planFor(id, snap[id].slots, t, by); finals[id] = afterSwaps(snap[id].slots, p.swaps);
    const bad = [...p.problems]; const need = [...new Set(p.swaps.map((s) => s.addKey))].filter((k) => !new Set(snap.convertedKeys).has(k)); // 먼저 적재·변환해야 하는 후보(스냅샷에 변환 완료로 없는 키; --assume-converted 는 새 배치를 변환 완료로 가정할 뿐이다)
    bad.push(...slotViolations(id, finals[id], by), ...dbUnitViolations(finals[id], by));
    out[id] = { bad, file: `data/ap/stock/${id.toLowerCase()}-v${snap[id].sourceVersionNo + 1}-swap-plan.json`, plan: { kind: "ap_new_version_swap_plan", set: id, sourceSetName: snap[id].sourceSetName, sourceVersionNo: snap[id].sourceVersionNo, generatedBy: "scripts/ap-generation/psych-new-version-plans.ts", swapCount: p.swaps.length, verifierViolations: bad, requiresConvertedCandidates: need, swaps: p.swaps,
      note: `psych-hard: 게시 v${snap[id].sourceVersionNo} → v${snap[id].sourceVersionNo + 1}. 교체 ${p.swaps.length}건(단독 MC·공유 세트·FRQ 같은 부류끼리). 어느 시험도 상대 시험이 지금 갖고 있는 문항을 가져오지 않으므로 두 시험의 새 버전은 서로 독립이고 순서가 없다. requiresConvertedCandidates 는 먼저 배치 적재·변환해야 하는 후보 키다.` } };
  }
  const cross = verifyPsychAssignment(["PS1", "PS2"].map((id) => resultOf(id, finals[id], by)));
  for (const id of ["PS1", "PS2"]) out[id].bad.push(...cross.filter((v) => v.startsWith(id) || !/^PS[12]/.test(v)));
  for (const id of ["PS1", "PS2"]) console.log(`${id} v${snap[id as SetId].sourceVersionNo}→v${snap[id as SetId].sourceVersionNo + 1} 교체 ${(out[id].plan as { swapCount: number }).swapCount}건, 변환 필요 후보 ${(out[id].plan as { requiresConvertedCandidates: string[] }).requiresConvertedCandidates.length}, 위반: ${out[id].bad.length ? out[id].bad.join("; ") : "0"}`);
  if (write) { for (const id of ["PS1", "PS2"]) { if (out[id].bad.length) { console.log("검증 실패 — 계획 파일을 쓰지 않습니다."); process.exit(1); } writeFileSync(out[id].file, JSON.stringify(out[id].plan, null, 1)); } console.log("계획 파일을 썼습니다."); }
}
if (process.argv[1]?.endsWith("psych-new-version-plans.ts")) main();
