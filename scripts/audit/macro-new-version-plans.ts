// AP Macroeconomics Practice Exam 1·2 (현재 게시본 MA1 v2·MA2 v1) → v3 정확 배정(exact-assign-macro-ma1-ma2-v3.json) 새 버전 교체 계획 생성기(무료·읽기 전용·DB 쓰기 없음).
//   npx tsx scripts/audit/macro-new-version-plans.ts [--write]
// 입력: 게시본 스냅샷 data/ap/stock/macro-ma1-ma2-published-slots.json(SELECT 전용 조회: 칸·DB keyword_code·변환 완료 후보·다른 계열 사용 문항), v3 배정 보고서.
// 순환 겹침 없음: v3 배정은 `macro-assign.ts --published-slots` 로 만들어서 한 시험의 현재 문항이 다른 시험으로 가지 않고 FRQ 는 그대로다 → 두 시험을 서로 독립인 한 번의 새 버전씩으로 바꾼다(중간판 불필요).
// 관리자 새 버전 흐름(resolveSwaps + checkNewVersionComposition, 단원은 DB candidate 의 keyword_code 첫 마디)을 스냅샷에 그대로 돌려 위반 0 이면 계획 파일을 쓴다.
import { readFileSync, writeFileSync } from "node:fs";
import { fullPracticeUnitBounds } from "../../lib/ap-exam/full-set-rules";
import { checkNewVersionComposition, type SlotItem } from "../../lib/mock-exam/new-version";
import { resolveSwaps } from "../../lib/ap-admin/new-version";
import { verifyMacroAssignment, type MacroResult } from "../ap-generation/macro-assign";
import { loadMacroPool, type MacroItem } from "../ap-generation/macro-pool";

type Id = "MA1" | "MA2";
type Slot = { section: string; position: number; candidateKey: string };
type Snap = Record<Id, { sourceSetName: string; sourceVersionNo: number; setGroupId: string; slots: Slot[] }> & { convertedKeys: string[]; dbKeywordCodes: Record<string, string | null>; usedByGroup: Record<string, string[]> };
const arg = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const rd = <T>(p: string) => JSON.parse(readFileSync(p, "utf-8")) as T;
const write = process.argv.includes("--write");
const snap = rd<Snap>(arg("--slots", "data/ap/stock/macro-ma1-ma2-published-slots.json"));
const assign = Object.fromEntries(rd<{ sets: { id: Id; mcA: string[]; frqA: string[] }[] }>(arg("--assign", "data/ap/stock/exact-assign-macro-ma1-ma2-v3.json")).sets.map((s) => [s.id, s])) as unknown as Record<Id, { mcA: string[]; frqA: string[] }>;
const { all } = loadMacroPool({ requireScreen: false }); const by = new Map(all.map((c) => [c.key, c]));
const get = (k: string) => { const c = by.get(k); if (!c) throw new Error(`재고에 없는 키 ${k}`); return c; };
/** 관리자 새 버전 검사가 쓰는 단원: DB candidate 의 keyword_code 첫 마디. */
export const dbUnit = (k: string) => String(snap.dbKeywordCodes[k] ?? get(k).members[0]?.topic ?? "").split(".")[0];
const converted = new Set(snap.convertedKeys);
const IDS: Id[] = ["MA1", "MA2"];

const pairs = (id: Id) => {
  const cur = snap[id].slots.filter((s) => s.section === "ap_mc").sort((a, b) => a.position - b.position);
  const tgt = new Set(assign[id].mcA);
  const removed = cur.filter((s) => !tgt.has(s.candidateKey)); const curKeys = new Set(cur.map((s) => s.candidateKey));
  const added = [...tgt].filter((k) => !curKeys.has(k)).map(get);
  if (removed.length !== added.length) throw new Error(`${id}: 제거 ${removed.length} ≠ 추가 ${added.length}`);
  // 같은 단원끼리 먼저(칸의 단원 순서 유지), 남는 것은 가까운 단원끼리, 같은 단원 안에서는 스킬이 같은 것을 우선한다.
  const left = [...added]; const out: { slot: Slot; add: MacroItem }[] = [];
  const unitOfSlot = (s: Slot) => Number(dbUnit(s.candidateKey));
  const score = (s: Slot, a: MacroItem) => -Math.abs(unitOfSlot(s) - Number(dbUnit(a.key))) * 10 + (get(s.candidateKey).members[0].skill === a.members[0].skill ? 2 : 0) + (get(s.candidateKey).members[0].skill[0] === a.members[0].skill[0] ? 1 : 0) + ((get(s.candidateKey).exam ?? 0) === (a.exam ?? 0) ? 0.5 : 0);
  for (const s of removed) { let bi = 0, bs = -Infinity; left.forEach((a, i) => { const sc = score(s, a); if (sc > bs) { bs = sc; bi = i; } }); out.push({ slot: s, add: left.splice(bi, 1)[0] }); }
  return out;
};

const toSlot = (s: Slot, i = 0): SlotItem => { const c = get(s.candidateKey); return { section: s.section, position: s.position, problemId: `${s.candidateKey}#${i}`, candidateKey: s.candidateKey, kind: c.kind === "mc" ? "mc" : "frq", unit: c.kind === "mc" ? dbUnit(s.candidateKey) : null, family: c.fam, calculator: "allowed" }; };
/** 관리자 새 버전 흐름 재현(위반 목록). */
export function replay(id: Id, swaps: { section: string; position: number; removeKey: string; addKey: string }[]) {
  const cur = snap[id].slots;
  const res = resolveSwaps(swaps, cur.map((s) => ({ ...s })));
  const before = cur.map((s) => toSlot(s));
  const actionSwaps = res.swaps.map((sw) => ({ section: sw.section, position: sw.position, problemId: `${sw.addKey}#0` }));
  const replacements = new Map(res.swaps.map((sw) => { const sl = toSlot({ section: sw.section, position: sw.position, candidateKey: sw.addKey }); return [`${sw.addKey}#0`, { problemId: `${sw.addKey}#0`, candidateKey: sw.addKey, kind: sl.kind, unit: sl.unit, family: sl.family, calculator: sl.calculator }] as const; }));
  const other = IDS.find((x) => x !== id)!;
  const used = new Set((snap.usedByGroup[snap[other].setGroupId] ?? []).map((k) => `${k}#0`));
  const out = checkNewVersionComposition(before, actionSwaps, { apLabel: "full_practice", sectionCalculator: { ap_mc: "allowed", ap_frq: "allowed" }, unitBounds: fullPracticeUnitBounds("ap_macroeconomics", "full_practice"), usedByOtherExams: used, replacements, setSizes: new Map() });
  const next = cur.map((s) => { const sw = res.swaps.find((x) => x.section === s.section && x.position === s.position); return sw ? { ...s, candidateKey: sw.addKey } : s; });
  return { problems: res.problems, issues: out.issues, next };
}
const resultOf = (id: string, slots: Slot[]): MacroResult => ({ id, singles: slots.filter((x) => x.section === "ap_mc").map((x) => get(x.candidateKey)), frq: slots.filter((x) => x.section === "ap_frq").map((x) => get(x.candidateKey)), virtual: [], frqVirtual: [] });

if (require.main === module || process.argv[1]?.endsWith("macro-new-version-plans.ts")) {
  const plans: Record<string, unknown>[] = []; const finals: Slot[][] = [];
  for (const id of IDS) {
    const ps = pairs(id);
    const swaps = ps.map((p) => ({ section: "ap_mc", position: p.slot.position, removeKey: p.slot.candidateKey, addKey: p.add.key }));
    const r = replay(id, swaps);
    const meta = (k: string) => { const c = get(k); return { unit: Number(dbUnit(k)), skill: c.members[0].skill, examPrep: c.exam ?? 0 }; };
    const exam = r.next.filter((x) => x.section === "ap_mc").reduce((n, x) => n + (get(x.candidateKey).exam ?? 0), 0);
    console.log(`${id}: 교체 ${swaps.length}건(단원 같은 짝 ${swaps.filter((s) => dbUnit(s.removeKey) === dbUnit(s.addKey)).length}), 흐름 검증 위반 ${r.problems.length + r.issues.length}${r.problems.length + r.issues.length ? " — " + [...r.problems, ...r.issues].join(" | ") : ""}, 최종 exam_prep MC ${exam}/60`);
    const set = new Set(r.next.filter((x) => x.section === "ap_mc").map((x) => x.candidateKey)); const T = new Set(assign[id].mcA);
    if (set.size !== T.size || [...set].some((k) => !T.has(k))) throw new Error(`${id}: 최종 구성이 v3 배정과 다르다`);
    finals.push(r.next);
    const req = [...new Set(swaps.map((s) => s.addKey))].filter((k) => !converted.has(k)).sort();
    plans.push({ file: `${id.toLowerCase()}-v${snap[id].sourceVersionNo + 1}-swap-plan.json`, id, body: { kind: "ap_new_version_swap_plan", set: id, sourceSetName: snap[id].sourceSetName, sourceVersionNo: snap[id].sourceVersionNo, generatedBy: "scripts/audit/macro-new-version-plans.ts", note: `${id} 게시본 v${snap[id].sourceVersionNo} → v3 배정(exam_prep MC ${exam}/60). 상대 시험과 독립인 한 번의 새 버전(중간판 없음).`, swapCount: swaps.length, verifierViolations: [...r.problems, ...r.issues], swaps: swaps.map((s) => ({ ...s, remove: meta(s.removeKey), add: meta(s.addKey) })), ...(req.length ? { requiresConvertedCandidates: req } : {}) } });
  }
  const bad = verifyMacroAssignment([resultOf("MA1", finals[0]), resultOf("MA2", finals[1])]);
  console.log(`최종 독립 검증기 위반: ${bad.length ? bad.join("; ") : "0"}`);
  if (write) {
    if (bad.length || plans.some((p) => ((p.body as { verifierViolations: string[] }).verifierViolations).length)) throw new Error("위반이 있어 계획 파일을 쓰지 않습니다");
    for (const p of plans) writeFileSync(`data/ap/stock/${p.file}`, JSON.stringify(p.body, null, 1));
    console.log("wrote", plans.map((p) => p.file).join(", "));
  }
}
