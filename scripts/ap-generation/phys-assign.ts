// AP Physics 1 풀 모의고사 세트 정확 배정(무료·읽기 전용·DB 없음). stats-assign.ts 와 같은 방식(정수계획 + 배정기와 별개인 독립 검증기)을 물리 구조에 적용한다.
//   npx tsx scripts/ap-generation/phys-assign.ts --sets PH1[,PH2] [--time-ms 120000] [--write-report <경로 .json>] [--files phys-p1a-items,...] [--no-screen] [--prefer-exam-prep] [--block-file <보고서.json[,..]>]
// 조건(공식 구조, docs/ap/physics1-facts.md): MC 42 = 단독 38 + 2문항 공유 세트 2(세트 단원은 자유), 단원 비중 10-15/18-23/18-23/10-15/10-15/5-8/5-8/10-15 % → 단원별 5/8/8/5/5/3/3/5 (하한 합 = 42),
//   FRQ 4(MR/TBR/LAB/QQT 각 1), 세트 안 문항군 1(look-alike 포함), 세트 간 같은 문항 0. 재고에 없는 칸은 가상 문항으로 세어 부족분을 정확히 보고한다.
//   스킬(2.A…3.C) 공식 범위는 기본으로는 차단 조건이 아니라 목표다(P0 원형이 2.B 편중이었음): 목적함수가 범위 중앙값에서 벗어난 만큼 벌점을 주고 보고서가 이탈을 밝힌다.
//   --hard-skills(2026-10-13, phys-s3 이후): 스킬 범위(2.A 7–8, 2.B 9–10, 2.C 5–6, 2.D 5–6, 3.B 9–10, 3.C 3–4)를 차단 조건으로 둔다. --balance: 항목이 속한 (단원·스킬) 칸의 재고가 적을수록 비용을 줘 순차 풀이에서 뒤 세트가 굶지 않게 한다.
//   --prefer-keys <보고서.json,..>: 그 보고서의 문항을 재사용하면 보너스(기존 PH1/PH2 초안과 겹침을 늘려 변경량 최소화).
import { readFileSync, writeFileSync } from "node:fs";
import { solveMip, type Cons } from "../../lib/ap-exam/ilp";
import { PHYS_FRQ_TEMPLATES, PHYS_MC_COUNT, PHYS_SET_COUNT, PHYS_SET_SIZE, physSkillBounds, physSkillWarnings, physUnitBounds, verifyPhysFullComposition, physFullTarget, type PhysSetItem } from "../../lib/ap-exam/full-set-rules";
import { loadPhysPool, type PhysItem } from "./phys-pool";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const has = (n: string) => process.argv.includes(n);
export type PhysVirtual = { set: string; part: "A"; unit: number };
export type PhysResult = { id: string; singles: PhysItem[]; sets: PhysItem[]; frq: PhysItem[]; virtual: PhysVirtual[]; virtualSets: number[]; frqVirtual: { set: string; part: "A"; native: false; type: string }[] };
/** 과목: 기본 Physics 1. `PHYS_SUBJECT=ap_physics_c_mechanics` 이면 7단원·C: Mechanics 단원 비중으로 푼다(2026-10-20). */
export const PHYS_SUBJECT = process.env.PHYS_SUBJECT ?? "ap_physics_1";
const UNITS = Object.keys(physFullTarget(PHYS_SUBJECT).units).map(Number); const SKILLS = Object.keys(physSkillBounds());
const SINGLES_PER_SET = PHYS_MC_COUNT - PHYS_SET_COUNT * PHYS_SET_SIZE;

export function solvePhysSets(ids: string[], items: PhysItem[], o: { timeMs: number; log?: (s: string) => void; blocked?: Set<string>; preferExamPrep?: boolean; skillWeight?: number; hardSkills?: boolean; cost?: (c: PhysItem) => number }) {
  const blocked = o.blocked ?? new Set<string>();
  const usable = items.filter((c) => !blocked.has(c.key) && (c.kind === "frq" ? (PHYS_FRQ_TEMPLATES as readonly string[]).includes(c.frqType) : c.shared ? c.members.length === PHYS_SET_SIZE : c.members.length === 1));
  const mcSingles = usable.filter((c) => c.kind === "mc" && !c.shared), mcSets = usable.filter((c) => c.kind === "mc" && c.shared), frqs = usable.filter((c) => c.kind === "frq");
  let n = 0; const V = (): number => n++;
  const xv = new Map<string, number>(); // `${i}|${s}`
  usable.forEach((c, i) => ids.forEach((_, s) => xv.set(`${i}|${s}`, V())));
  const idx = new Map(usable.map((c, i) => [c, i] as const));
  const x = (c: PhysItem, s: number) => xv.get(`${idx.get(c)}|${s}`)!;
  const vs = new Map<string, number>(), vset = new Map<string, number>(), vf = new Map<string, number>(), du = new Map<string, number>(), dk = new Map<string, number>();
  ids.forEach((_, s) => {
    for (const u of UNITS) { vs.set(`${s}|${u}`, V()); vset.set(`${s}|${u}`, V()); du.set(`${s}|${u}`, V()); }
    for (const t of PHYS_FRQ_TEMPLATES) vf.set(`${s}|${t}`, V());
    for (const k of SKILLS) dk.set(`${s}|${k}`, V());
  });
  const obj = new Array<number>(n).fill(0); const cons: Cons[] = [];
  for (const j of vs.values()) obj[j] = 1000; for (const j of vset.values()) obj[j] = 2000; for (const j of vf.values()) obj[j] = 1000;
  for (const j of du.values()) obj[j] = 1; for (const j of dk.values()) obj[j] = o.skillWeight ?? 0.5;
  if (o.preferExamPrep) usable.forEach((c) => ids.forEach((_, s) => { obj[x(c, s)] += -0.01 * (c.exam ?? 0); }));
  if (o.cost) usable.forEach((c) => ids.forEach((_, s) => { obj[x(c, s)] += o.cost!(c); }));
  const uB = physUnitBounds(PHYS_SUBJECT), kB = physSkillBounds();
  usable.forEach((c) => cons.push({ coef: ids.map((_, s) => [x(c, s), 1] as [number, number]), sense: "<=", rhs: 1 }));
  ids.forEach((_, s) => {
    cons.push({ coef: [...mcSingles.map((c) => [x(c, s), 1] as [number, number]), ...UNITS.map((u) => [vs.get(`${s}|${u}`)!, 1] as [number, number])], sense: "=", rhs: SINGLES_PER_SET });
    cons.push({ coef: [...mcSets.map((c) => [x(c, s), 1] as [number, number]), ...UNITS.map((u) => [vset.get(`${s}|${u}`)!, 1] as [number, number])], sense: "=", rhs: PHYS_SET_COUNT });
    for (const u of UNITS) {
      const co: [number, number][] = [...mcSingles.filter((c) => c.members[0].unit === u).map((c) => [x(c, s), 1] as [number, number]), ...mcSets.map((c) => [x(c, s), c.members.filter((m) => m.unit === u).length] as [number, number]).filter(([, v]) => v > 0), [vs.get(`${s}|${u}`)!, 1], [vset.get(`${s}|${u}`)!, PHYS_SET_SIZE]];
      cons.push({ coef: co, sense: ">=", rhs: uB[String(u)].min }); cons.push({ coef: co, sense: "<=", rhs: uB[String(u)].max });
      const t = physFullTarget(PHYS_SUBJECT).units[String(u)]; const d = du.get(`${s}|${u}`)!;
      cons.push({ coef: [...co, [d, -1]], sense: "<=", rhs: t }); cons.push({ coef: [...co.map(([j, v]) => [j, -v] as [number, number]), [d, -1]], sense: "<=", rhs: -t });
    }
    for (const k of SKILLS) { // 스킬: 실제 문항만 센다(가상 문항의 스킬은 정해지지 않음). 범위 중앙값에서의 이탈 벌점(차단 아님)
      const co: [number, number][] = [...mcSingles.filter((c) => c.members[0].skill === k).map((c) => [x(c, s), 1] as [number, number]), ...mcSets.map((c) => [x(c, s), c.members.filter((m) => m.skill === k).length] as [number, number]).filter(([, v]) => v > 0)];
      if (o.hardSkills) { cons.push({ coef: co, sense: ">=", rhs: kB[k].min }); cons.push({ coef: co, sense: "<=", rhs: kB[k].max }); continue; } // 스킬 범위 차단(가상 문항은 스킬이 없으므로 실제 문항만으로 범위를 채워야 한다)
      const t = (kB[k].min + kB[k].max) / 2; const d = dk.get(`${s}|${k}`)!;
      cons.push({ coef: [...co, [d, -1]], sense: "<=", rhs: t }); cons.push({ coef: [...co.map(([j, v]) => [j, -v] as [number, number]), [d, -1]], sense: "<=", rhs: -t });
    }
    const fam = new Map<string, [number, number][]>(); for (const c of [...mcSingles, ...mcSets]) (fam.get(c.fam) ?? fam.set(c.fam, []).get(c.fam)!).push([x(c, s), 1]);
    for (const co of fam.values()) if (co.length > 1) cons.push({ coef: co, sense: "<=", rhs: 1 });
    for (const t of PHYS_FRQ_TEMPLATES) cons.push({ coef: [...frqs.filter((c) => c.frqType === t).map((c) => [x(c, s), 1] as [number, number]), [vf.get(`${s}|${t}`)!, 1]], sense: "=", rhs: 1 });
    const ffam = new Map<string, [number, number][]>(); for (const c of frqs) (ffam.get(c.fam) ?? ffam.set(c.fam, []).get(c.fam)!).push([x(c, s), 1]);
    for (const co of ffam.values()) if (co.length > 1) cons.push({ coef: co, sense: "<=", rhs: 1 });
  });
  const binary = new Array<boolean>(n).fill(false); for (const j of xv.values()) binary[j] = true; for (const j of vf.values()) binary[j] = true; // vset 은 같은 단원 가상 세트를 둘 둘 수 있어 일반 정수(이진 아님)
  const r = solveMip({ n, obj, cons, integer: new Array(n).fill(true), binary }, { timeMs: o.timeMs, log: o.log });
  const out: PhysResult[] = ids.map((id) => ({ id, singles: [], sets: [], frq: [], virtual: [], virtualSets: [], frqVirtual: [] }));
  if (r.x.length) ids.forEach((id, s) => {
    for (const c of usable) if (r.x[x(c, s)] > 0.5) (c.kind === "frq" ? out[s].frq : c.shared ? out[s].sets : out[s].singles).push(c);
    for (const u of UNITS) {
      for (let q = 0; q < Math.round(r.x[vs.get(`${s}|${u}`)!]); q++) out[s].virtual.push({ set: id, part: "A", unit: u });
      for (let q = 0; q < Math.round(r.x[vset.get(`${s}|${u}`)!]); q++) out[s].virtualSets.push(u);
    }
    for (const t of PHYS_FRQ_TEMPLATES) if (r.x[vf.get(`${s}|${t}`)!] > 0.5) out[s].frqVirtual.push({ set: id, part: "A", native: false, type: t });
  });
  return { res: r, out };
}

/** 한 세트의 MC 위치 목록: 단원 오름차순 블록(단독 1칸, 세트 2칸 연속). 가상 문항은 candidateKey null(가상 세트는 `~virtual-set-<단원>`). 세트의 단원은 첫 문항 기준. */
export function buildPhysOrder(r: PhysResult): PhysSetItem[] {
  type Block = { unit: number; key: string; members: { unit: number; skill: string | null }[]; real: boolean };
  const blocks: Block[] = [
    ...r.singles.map((c) => ({ unit: c.members[0].unit, key: c.key, members: [{ unit: c.members[0].unit, skill: c.members[0].skill }], real: true })),
    ...r.sets.map((c) => ({ unit: c.members[0].unit, key: c.key, members: c.members.map((m) => ({ unit: m.unit, skill: m.skill })), real: true })),
    ...r.virtual.map((v, i) => ({ unit: v.unit, key: `~v${i}`, members: [{ unit: v.unit, skill: null }], real: false })),
    ...r.virtualSets.map((u) => ({ unit: u, key: `~virtual-set-${u}`, members: Array.from({ length: PHYS_SET_SIZE }, () => ({ unit: u, skill: null })), real: false })),
  ].sort((a, b) => a.unit - b.unit || a.key.localeCompare(b.key));
  const out: PhysSetItem[] = []; let pos = 1;
  for (const b of blocks) for (const m of b.members) out.push({ kind: "mc", unit: String(m.unit), skill: m.skill, candidateKey: b.real && b.members.length === 1 ? null : b.key, position: pos++ });
  return out;
}

/** 독립 검증기(배정기와 별개): 공식 구조·단원·세트·FRQ 유형·문항군·세트 간 중복·차단 키. 위반 목록(빈 배열 = 통과). */
export function verifyPhysAssignment(res: PhysResult[], blocked: Set<string> = new Set()): string[] {
  const bad: string[] = []; const used = new Map<string, string>();
  for (const r of res) {
    const mc = buildPhysOrder(r);
    const frqItems: PhysSetItem[] = [...r.frq.map((c, i) => ({ kind: "frq" as const, unit: null, skill: null, candidateKey: c.key, position: i + 1 })), ...r.frqVirtual.map((v, i) => ({ kind: "frq" as const, unit: null, skill: null, candidateKey: null, position: r.frq.length + i + 1 }))];
    for (const v of verifyPhysFullComposition([...mc, ...frqItems], PHYS_SUBJECT)) bad.push(`${r.id}: ${v}`);
    const keys = [...r.singles, ...r.sets, ...r.frq];
    const fams = [...r.singles, ...r.sets].map((c) => c.fam); if (new Set(fams).size !== fams.length) bad.push(`${r.id}: 문항군 중복`);
    const ffams = r.frq.map((c) => c.fam); if (new Set(ffams).size !== ffams.length) bad.push(`${r.id}: FRQ 문항군 중복`);
    const types = [...r.frq.map((c) => c.frqType), ...r.frqVirtual.map((v) => v.type)].sort(); if (types.join() !== [...PHYS_FRQ_TEMPLATES].sort().join()) bad.push(`${r.id}: FRQ 유형 ${types.join("+")} ≠ 4 유형 각 1개`);
    if (r.sets.some((c) => c.members.length !== PHYS_SET_SIZE)) bad.push(`${r.id}: 공유 세트 크기`);
    for (const c of keys) { if (blocked.has(c.key)) bad.push(`${r.id}: 차단된 항목 ${c.key}`); if (used.has(c.key)) bad.push(`${c.key}: ${used.get(c.key)} 와 ${r.id} 중복`); used.set(c.key, r.id); }
  }
  return bad;
}

/** 보고서(exact-assign 형식과 호환): mcA = MC 후보 키(세트는 한 번, 위치 순서), mcB = [], frqA = FRQ 키(MR·TBR·LAB·QQT 순), frqB = []. */
export function toReportSet(r: PhysResult) {
  const seen = new Set<string>(); const mcKeys: string[] = [];
  // 단독 문항은 buildPhysOrder 에서 candidateKey 가 null 로 표기되므로 단원 블록 순서(buildPhysOrder 와 같은 정렬)로 키를 다시 만든다.
  const blocks = [...r.singles.map((c) => ({ unit: c.members[0].unit, key: c.key })), ...r.sets.map((c) => ({ unit: c.members[0].unit, key: c.key }))].sort((a, b) => a.unit - b.unit || a.key.localeCompare(b.key));
  for (const b of blocks) if (!seen.has(b.key)) { seen.add(b.key); mcKeys.push(b.key); }
  const frqKeys = [...PHYS_FRQ_TEMPLATES].map((t) => r.frq.find((c) => c.frqType === t)?.key).filter((k): k is string => !!k);
  return { id: r.id, mcA: mcKeys, mcB: [] as string[], virtual: r.virtual, virtualSets: r.virtualSets, frqA: frqKeys, frqB: [] as string[], frqVirtual: r.frqVirtual, subject: PHYS_SUBJECT };
}

export function skillSummary(r: PhysResult) {
  const c: Record<string, number> = {}; for (const it of [...r.singles, ...r.sets]) for (const m of it.members) c[m.skill] = (c[m.skill] ?? 0) + 1;
  return { counts: c, warnings: physSkillWarnings(buildPhysOrder(r)) };
}

function main() {
  const ids = arg("--sets", "PH1").split(",").filter(Boolean); const TIME = Number(arg("--time-ms", "120000"));
  const files = arg("--files") ? arg("--files").split(",") : undefined;
  const { all, pool } = loadPhysPool({ requireScreen: !has("--no-screen"), files }); void all;
  const log = (s: string) => console.error(s);
  const hardSkills = has("--hard-skills");
  const prefer = new Set<string>(); for (const f of arg("--prefer-keys").split(",").filter(Boolean)) for (const st of (JSON.parse(readFileSync(f, "utf-8")) as { sets: { mcA?: string[]; frqA?: string[] }[] }).sets) for (const k of [...(st.mcA ?? []), ...(st.frqA ?? [])]) prefer.add(k);
  const supply = new Map<string, number>(); for (const c of pool) if (c.kind === "mc") for (const mm of c.members) supply.set(`${mm.unit}|${mm.skill}`, (supply.get(`${mm.unit}|${mm.skill}`) ?? 0) + 1);
  const cost = (c: PhysItem) => { let v = prefer.has(c.key) ? -0.05 : 0; if (has("--balance") && c.kind === "mc") v += (c.members.reduce((a, mm) => a + 1 / (supply.get(`${mm.unit}|${mm.skill}`) ?? 1), 0) / c.members.length) * 0.5; return v; };
  const blocked = new Set<string>(); for (const f of arg("--block-file").split(",").filter(Boolean)) for (const st of (JSON.parse(readFileSync(f, "utf-8")) as { sets: { mcA?: string[]; frqA?: string[] }[] }).sets) for (const k of [...(st.mcA ?? []), ...(st.frqA ?? [])]) blocked.add(k);
  // --joint: 두 세트를 한 번에 푼다(변수가 많아 분기한정이 해를 못 찾는 경우가 있다). 기본은 순차: PH1 을 최적으로 푼 뒤 그 문항을 막고 PH2 를 푼다(세트 간 겹침 0 보장, stats ST2 와 같은 방식).
  let m: ReturnType<typeof solvePhysSets>;
  if (has("--joint")) m = solvePhysSets(ids, pool, { timeMs: TIME, log, preferExamPrep: has("--prefer-exam-prep"), blocked, hardSkills, cost });
  else {
    const out: PhysResult[] = []; let res = { status: "optimal", obj: 0, nodes: 0, x: [0] } as unknown as ReturnType<typeof solvePhysSets>["res"]; const bl = new Set(blocked);
    for (const id of ids) {
      const one = solvePhysSets([id], pool, { timeMs: TIME, log, preferExamPrep: has("--prefer-exam-prep"), blocked: bl, hardSkills, cost });
      out.push(...one.out); res = { ...one.res, obj: (res.obj ?? 0) + one.res.obj, nodes: (res.nodes ?? 0) + one.res.nodes, status: one.res.status } as typeof res;
      for (const it of [...one.out[0].singles, ...one.out[0].sets, ...one.out[0].frq]) bl.add(it.key);
    }
    m = { res, out };
  }
  const results = m.out;
  const bad = m.res.x.length ? verifyPhysAssignment(results) : ["해 없음"];
  if (hardSkills && m.res.x.length) for (const r of results) { for (const w of skillSummary(r).warnings) bad.push(`${r.id}: ${w}`); if (r.virtual.length + r.virtualSets.length + r.frqVirtual.length) bad.push(`${r.id}: 가상 칸 ${r.virtual.length + r.virtualSets.length + r.frqVirtual.length}개`); }
  const cnt = (f: (c: PhysItem) => boolean) => pool.filter(f).length;
  console.log(`# phys-assign sets=${ids.join(",")} 재고 단독 ${cnt((c) => c.kind === "mc" && !c.shared)} 세트 ${cnt((c) => c.shared)} FRQ ${cnt((c) => c.kind === "frq")}`);
  console.log(`status=${m.res.status} 목적값(가상×1000 + 단원 이탈 + 스킬 이탈×0.5)=${m.res.obj} 노드 ${m.res.nodes} 가상 문항=${results.reduce((a, r) => a + r.virtual.length + r.virtualSets.length * PHYS_SET_SIZE + r.frqVirtual.length, 0)}`);
  console.log(`독립 검증기 위반: ${bad.length ? bad.join("; ") : "0"}`);
  for (const r of results) {
    const u: Record<string, number> = {}; for (const it of buildPhysOrder(r)) u[it.unit ?? "?"] = (u[it.unit ?? "?"] ?? 0) + 1;
    console.log(`- ${r.id}: 단독 ${r.singles.length}+가상 ${r.virtual.length}, 세트 ${r.sets.length}+가상 ${r.virtualSets.length}, FRQ ${r.frq.length}+가상 ${r.frqVirtual.length}, 단원 ${JSON.stringify(u)}`);
    const mcq = [...r.singles, ...r.sets].reduce((a, c) => a + (c.kind === "mc" ? c.members.length : 0), 0), ex = [...r.singles, ...r.sets].reduce((a, c) => a + (c.exam ?? 0), 0);
    console.log(`    MC exam_prep ${ex}/${mcq + r.virtual.length + r.virtualSets.length * PHYS_SET_SIZE}${mcq ? ` (재고 문항 기준 ${((ex / mcq) * 100).toFixed(0)}%)` : ""}`);
    const sk = skillSummary(r); console.log(`    스킬 ${JSON.stringify(sk.counts)} 범위 이탈(비차단): ${sk.warnings.join(", ") || "없음"}`);
    for (const v of r.virtual) console.log(`    가상 MC: 단원 ${v.unit}`);
    for (const v of r.virtualSets) console.log(`    가상 세트: 단원 ${v}`);
    for (const v of r.frqVirtual) console.log(`    가상 FRQ: ${v.type}`);
  }
  const w = arg("--write-report");
  if (w) { writeFileSync(w, JSON.stringify({ sets: results.map(toReportSet) }, null, 1)); console.error(`보고서 기록: ${w}`); }
}
if (process.argv[1]?.endsWith("phys-assign.ts")) main();
