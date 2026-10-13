// AP Physics 1 Practice Exam 2(PH4 초안) FRQ 4칸 → 두 번째 시나리오(phys-s4) 교체 계획(무료·읽기 전용·DB 없음). MC 는 그대로 두고 FRQ 4칸(MR·TBR·LAB·QQT)만 위치 교체한다.
//   npx tsx scripts/ap-generation/ph2-new-version-plan.ts [--report data/ap/stock/exact-assign-phys-ph3-ph4.json] [--write data/ap/stock/ph2-v2-frq-swap-plan.json]
// 목적(오너 결정 2026-10-13): 게시되는 두 연습 모의고사(PH3 = Practice Exam 1, PH4 = Practice Exam 2)가 같은 FRQ 시나리오를 재사용하지 않게 한다.
// 검증: 독립 검증기(phys-assign.ts verifyPhysAssignment: 공식 구조·FRQ 유형 각 1·문항군·세트 간 중복) 를 PH3(그대로) + PH4(교체 후)에 돌려 위반 0 이어야 계획 파일을 쓴다. 교체 FRQ 는 PH3 의 어떤 FRQ·시나리오(원형)와도 겹치지 않아야 한다.
import { readFileSync, writeFileSync } from "node:fs";
import { PHYS_FRQ_TEMPLATES } from "../../lib/ap-exam/full-set-rules";
import { verifyPhysAssignment, type PhysResult } from "./phys-assign";
import { loadPhysPool, type PhysItem } from "./phys-pool";

export type PhysReport = { id: string; mcA: string[]; frqA: string[] };
export type PhysPlanSwap = { section: "ap_frq"; position: number; removeKey: string; addKey: string; remove: { type: string; archetype: string }; add: { type: string; archetype: string } };
/** 두 번째 시나리오 원형(scripts/ap-generation/archetypes/phys_p0_frq2.py STAGE_FRQ2). */
export const NEW_SCENARIO_ARCHETYPES = ["phf_mr_incline_slide", "phf_mr_energy_patch", "phf_tbr_cart_vt", "phf_tbr_vertical_toss", "phf_lab_pendulum_g", "phf_lab_sliding_friction", "phf_qqt_flat_curve", "phf_qqt_floating_block"];
const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };

export function resultOf(rep: PhysReport, by: Map<string, PhysItem>): PhysResult {
  const get = (k: string) => { const c = by.get(k); if (!c) throw new Error(`재고(화면 증거 보유)에 없는 키 ${k}`); return c; };
  const mc = rep.mcA.map(get);
  return { id: rep.id, singles: mc.filter((c) => !c.shared), sets: mc.filter((c) => c.shared), frq: rep.frqA.map(get), virtual: [], virtualSets: [], frqVirtual: [] };
}

/** 유형별로 새 시나리오 FRQ 하나를 고른다: exam_prep 난이도 우선, 같으면 키 순. */
export function pickNewFrq(pool: PhysItem[], examPrep: (key: string) => boolean, blocked: Set<string>): Map<string, PhysItem> {
  const out = new Map<string, PhysItem>();
  for (const t of PHYS_FRQ_TEMPLATES) {
    const cands = pool.filter((c) => c.kind === "frq" && c.frqType === t && NEW_SCENARIO_ARCHETYPES.includes(c.archetype) && !blocked.has(c.key)).sort((a, b) => Number(examPrep(b.key)) - Number(examPrep(a.key)) || a.key.localeCompare(b.key));
    if (cands[0]) out.set(t, cands[0]);
  }
  return out;
}

export function planPh2NewVersion(ph3: PhysReport, ph4: PhysReport, pool: PhysItem[], examPrep: (key: string) => boolean = () => false) {
  const by = new Map(pool.map((c) => [c.key, c]));
  const src = resultOf(ph4, by); const other = resultOf(ph3, by);
  const picks = pickNewFrq(pool, examPrep, new Set([...ph3.frqA, ...ph3.mcA, ...ph4.mcA]));
  const swaps: PhysPlanSwap[] = []; const v2Frq = [...ph4.frqA];
  ph4.frqA.forEach((k, i) => {
    const cur = by.get(k)!; const add = picks.get(cur.frqType);
    if (!add) throw new Error(`유형 ${cur.frqType} 의 새 시나리오 FRQ 가 재고에 없습니다`);
    v2Frq[i] = add.key;
    swaps.push({ section: "ap_frq", position: i + 1, removeKey: k, addKey: add.key, remove: { type: cur.frqType, archetype: cur.archetype }, add: { type: add.frqType, archetype: add.archetype } });
  });
  const v2: PhysResult = { ...src, frq: v2Frq.map((k) => by.get(k)!) };
  const bad = verifyPhysAssignment([other, v2]);
  const ph3Arch = new Set(other.frq.map((c) => c.archetype)); const ph3Fam = new Set(other.frq.map((c) => c.fam));
  for (const c of v2.frq) { if (ph3Arch.has(c.archetype)) bad.push(`PH3 와 같은 FRQ 시나리오(원형) ${c.archetype}`); if (ph3Fam.has(c.fam)) bad.push(`PH3 와 같은 FRQ 문항군 ${c.fam}`); if (!NEW_SCENARIO_ARCHETYPES.includes(c.archetype)) bad.push(`새 시나리오가 아닌 FRQ ${c.key}`); }
  if (v2.frq.some((c) => ph3.frqA.includes(c.key))) bad.push("PH3 와 FRQ 문항 겹침");
  if (new Set(v2.frq.map((c) => c.frqType)).size !== 4) bad.push("FRQ 유형 4개 각 1개가 아님");
  if (JSON.stringify(src.singles.map((c) => c.key)) !== JSON.stringify(v2.singles.map((c) => c.key))) bad.push("MC 가 바뀜");
  return { ok: bad.length === 0, swaps, verifierViolations: bad, v2Frq };
}

function main() {
  const rep = JSON.parse(readFileSync(arg("--report", "data/ap/stock/exact-assign-phys-ph3-ph4.json"), "utf-8")) as { sets: PhysReport[] };
  const ph3 = rep.sets.find((s) => s.id === "PH3")!; const ph4 = rep.sets.find((s) => s.id === "PH4")!;
  const { pool } = loadPhysPool();
  const items = JSON.parse(readFileSync("data/ap/stock/phys-s4-items.json", "utf-8")) as { stockKey: string; difficultyProvisional?: string | null }[];
  const ep = new Set(items.filter((i) => i.difficultyProvisional === "exam_prep").map((i) => i.stockKey));
  const p = planPh2NewVersion(ph3, ph4, pool, (k) => ep.has(k));
  console.log(`# PH4(Practice Exam 2) v2 FRQ 교체 계획 — 교체 ${p.swaps.length}건, 독립 검증기 위반: ${p.verifierViolations.length ? p.verifierViolations.join("; ") : "0"}`);
  for (const s of p.swaps) console.log(`ap_frq #${s.position} (${s.add.type}): ${s.removeKey} (${s.remove.archetype}) -> ${s.addKey} (${s.add.archetype})`);
  const w = arg("--write");
  if (w && !p.ok) console.log("검증 실패 — 계획 파일을 쓰지 않습니다.");
  else if (w) { writeFileSync(w, JSON.stringify({ kind: "ap_new_version_swap_plan", set: "PH4", sourceSetName: "AP Physics 1 — Practice Exam 2", sourceVersionNo: 1, generatedBy: "scripts/ap-generation/ph2-new-version-plan.ts", swapCount: p.swaps.length, verifierViolations: p.verifierViolations, swaps: p.swaps }, null, 1) + "\n"); console.log(`계획 파일 기록: ${w}`); }
}
if (process.argv[1]?.endsWith("ph2-new-version-plan.ts")) main();
