// AP Macroeconomics Practice Exam 3 (게시 v1) → v2 새 버전 교체 계획 생성기(한계 보완 A1, 2026-10-19; 무료·읽기 전용·DB 쓰기 없음).
//   npx tsx scripts/audit/macro-ma3-v2-plan.ts [--write]
// 목적: 그림·표 비율을 공개 MA1·MA2 수준으로 올린다(14% → 약 40%). 방법: 그림 없는 칸 16개를 같은 단원·같은 스킬의 새 그림 원형 문항(batch macro-fga, macro_p0_fig1.py)으로 1:1 교체한다(단원·스킬 범주·수치 분석 비중 불변).
// 입력: 게시본 스냅샷 data/ap/stock/macro-ma3-published-slots.json(SELECT 전용 조회), 재고(macro-fga). 검증: 관리자 새 버전 흐름(resolveSwaps + checkNewVersionComposition) + 독립 검증기(verifyMacroAssignment).
import { readFileSync, writeFileSync } from "node:fs";
import { fullPracticeUnitBounds } from "../../lib/ap-exam/full-set-rules";
import { checkNewVersionComposition, type SlotItem } from "../../lib/mock-exam/new-version";
import { resolveSwaps } from "../../lib/ap-admin/new-version";
import { verifyMacroAssignment, toReportSet, type MacroResult } from "../ap-generation/macro-assign";
import { loadMacroPool } from "../ap-generation/macro-pool";

type Slot = { section: string; position: number; candidateKey: string };
const snap = JSON.parse(readFileSync("data/ap/stock/macro-ma3-published-slots.json", "utf-8")) as { MA3: { sourceSetName: string; sourceVersionNo: number; setGroupId: string; slots: Slot[] }; others: Record<string, string[]> };
const { all } = loadMacroPool({ requireScreen: false }); const by = new Map(all.map((c) => [c.key, c]));
const get = (k: string) => { const c = by.get(k); if (!c) throw new Error(`재고에 없는 키 ${k}`); return c; };
const write = process.argv.includes("--write");
const F = (m: string, k: number) => `macro-fg-a:ap_macroeconomics-m${m}-k${k}`;
/** 교체 칸(MA3 v1 위치 → 새 그림 문항). 같은 단원·스킬: 단원 1(1.D·1.B)·2(2.C·1.D·3.A)·3(3.C·3.A·1.A)·4(1.C·3.C·2.B)·5(3.A·1.B·2.B)·6(1.D·3.A). 같은 원형의 후보 중 판정기 exam_prep 인 변형을 우선했다. */
const PAIRS: [number, string][] = [
  [3, F("02", 1)], [4, F("01", 1)], [8, F("04", 0)], [9, F("03", 1)], [13, F("05", 1)], [15, F("08", 0)], [19, F("06", 0)], [23, F("07", 0)],
  [31, F("09", 0)], [34, F("10", 0)], [38, F("11", 0)], [43, F("12", 0)], [45, F("13", 0)], [54, F("14", 0)], [55, F("16", 0)], [57, F("15", 0)],
];
const cur = snap.MA3.slots; const mc = cur.filter((s) => s.section === "ap_mc").sort((a, b) => a.position - b.position);
const swaps = PAIRS.map(([pos, add]) => { const slot = mc[pos - 1]; if (slot.position !== pos) throw new Error(`위치 불일치 ${pos}`); return { section: "ap_mc", position: pos, removeKey: slot.candidateKey, addKey: add }; });
const unitOf = (k: string) => String(get(k).members[0].topic).split(".")[0];
const toSlot = (s: Slot, i = 0): SlotItem => { const c = get(s.candidateKey); return { section: s.section, position: s.position, problemId: `${s.candidateKey}#${i}`, candidateKey: s.candidateKey, kind: c.kind === "mc" ? "mc" : "frq", unit: c.kind === "mc" ? unitOf(s.candidateKey) : null, family: c.fam, calculator: "allowed" }; };
const res = resolveSwaps(swaps, cur.map((s) => ({ ...s })));
const before = cur.map((s) => toSlot(s));
const actionSwaps = res.swaps.map((sw) => ({ section: sw.section, position: sw.position, problemId: `${sw.addKey}#0` }));
const replacements = new Map(res.swaps.map((sw) => { const sl = toSlot({ section: sw.section, position: sw.position, candidateKey: sw.addKey }); return [`${sw.addKey}#0`, { problemId: `${sw.addKey}#0`, candidateKey: sw.addKey, kind: sl.kind, unit: sl.unit, family: sl.family, calculator: sl.calculator }] as const; }));
const used = new Set(Object.values(snap.others).flat().map((k) => `${k}#0`));
const chk = checkNewVersionComposition(before, actionSwaps, { apLabel: "full_practice", sectionCalculator: { ap_mc: "allowed", ap_frq: "allowed" }, unitBounds: fullPracticeUnitBounds("ap_macroeconomics", "full_practice"), usedByOtherExams: used, replacements, setSizes: new Map() });
const next = cur.map((s) => { const sw = res.swaps.find((x) => x.section === s.section && x.position === s.position); return sw ? { ...s, candidateKey: sw.addKey } : s; });
const resultOf = (slots: Slot[]): MacroResult => ({ id: "MA3", singles: slots.filter((x) => x.section === "ap_mc").map((x) => get(x.candidateKey)), frq: slots.filter((x) => x.section === "ap_frq").map((x) => get(x.candidateKey)), virtual: [], frqVirtual: [] });
const bad = verifyMacroAssignment([resultOf(next)]);
const meta = (k: string) => { const c = get(k); return { unit: Number(unitOf(k)), skill: c.members[0].skill, examPrep: c.exam ?? 0, figure: c.stimKind }; };
const figs = (slots: Slot[]) => slots.filter((s) => { const c = get(s.candidateKey); return c.stimKind && !["none", "text"].includes(c.stimKind); }).length;
const exam = (slots: Slot[]) => slots.filter((s) => s.section === "ap_mc").reduce((n, s) => n + (get(s.candidateKey).exam ?? 0), 0);
const sameCell = swaps.every((s) => { const a = meta(s.removeKey), b = meta(s.addKey); return a.unit === b.unit && a.skill === b.skill; });
console.log(`교체 ${swaps.length}건, 같은 단원·스킬 ${sameCell}, 흐름 검증 위반 ${res.problems.length + chk.issues.length}${res.problems.length + chk.issues.length ? " — " + [...res.problems, ...chk.issues].join(" | ") : ""}, 독립 검증기 위반 ${bad.length ? bad.join("; ") : 0}`);
console.log(`그림·표(MC+FRQ): ${figs(cur)}/${cur.length} → ${figs(next)}/${next.length} (${(figs(cur) / cur.length * 100).toFixed(0)}% → ${(figs(next) / next.length * 100).toFixed(0)}%), exam_prep MC ${exam(cur)}/60 → ${exam(next)}/60`);
if (write) {
  if (res.problems.length || chk.issues.length || bad.length || !sameCell) throw new Error("위반이 있어 파일을 쓰지 않습니다");
  const plan = { kind: "ap_new_version_swap_plan", set: "MA3", sourceSetName: snap.MA3.sourceSetName, sourceVersionNo: snap.MA3.sourceVersionNo, generatedBy: "scripts/audit/macro-ma3-v2-plan.ts",
    note: `MA3 게시본 v${snap.MA3.sourceVersionNo} → v${snap.MA3.sourceVersionNo + 1}: 그림 없는 MC 16칸을 같은 단원·스킬의 새 그림 원형 문항(macro-fga)으로 교체. 그림·표 ${figs(cur)}/63 → ${figs(next)}/63, exam_prep MC ${exam(cur)} → ${exam(next)}/60. 단원·스킬 범주·수치 분석 비중 불변.`,
    swapCount: swaps.length, verifierViolations: [...res.problems, ...chk.issues, ...bad], swaps: swaps.map((s) => ({ ...s, remove: meta(s.removeKey), add: meta(s.addKey) })), requiresConvertedCandidates: [...new Set(swaps.map((s) => s.addKey))].sort() };
  writeFileSync("data/ap/stock/ma3-v2-swap-plan.json", JSON.stringify(plan, null, 1));
  const rep = toReportSet(resultOf(next)); rep.mcA = next.filter((x) => x.section === "ap_mc").map((x) => x.candidateKey); rep.frqA = next.filter((x) => x.section === "ap_frq").map((x) => x.candidateKey);
  writeFileSync("data/ap/stock/exact-assign-macro-ma3-v2.json", JSON.stringify({ sets: [rep] }, null, 1));
  writeFileSync("data/ap/stock/exact-assign-macro-ma3-v2-verifier.txt", `MA3 v2 (figure remediation, backlog A1): 16 slot swaps of the published v1; independent verifier violations: ${bad.length}; admin new-version flow violations: ${res.problems.length + chk.issues.length}; figures ${figs(cur)}/63 -> ${figs(next)}/63\n`);
  console.log("wrote data/ap/stock/ma3-v2-swap-plan.json, exact-assign-macro-ma3-v2.json");
}
