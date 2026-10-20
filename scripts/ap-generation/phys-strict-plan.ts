// AP Physics 1 엄격 배정 계획기(무료·읽기 전용): 공개 세트가 쓴 원형(풀이 틀)을 모두 뺀 재고 + 라이브러리 미생성 원형 + 새로 쓸 원형 칸으로 두 세트 이상을 한 번에 푼다.
//   npx tsx scripts/ap-generation/phys-strict-plan.ts --sets PH5,PH6 --block-archetypes <JSON 배열 파일> [--no-virtual] [--write-report <경로>] [--time-ms 120000]
// 조건: MC 42 = 단독 38 + 2문항 세트 2, 단원 5/8/8/5/5/3/3/5, 스킬 범위(2.A 7–8, 2.B 9–10, 2.C 5–6, 2.D 5–6, 3.B 9–10, 3.C 3–4) 차단, FRQ 유형 4개 각 1,
//   세트 사이·공개 세트와 원형 서로소(같은 원형은 어느 세트에서도 한 번만), 한 세트 안 문항군 1. --no-virtual 은 재고만으로 푼다(최종 배정).
//   가상 칸 종류와 비용: 라이브러리 미생성 원형 3, 새로 쓸 단독 원형(단원×스킬 칸) 10, 새 세트 원형 20, 새 FRQ 시나리오 10.
import { readFileSync, writeFileSync } from "node:fs";
import { PHYS_FRQ_TEMPLATES, PHYS_FULL_TARGET, PHYS_SET_COUNT, PHYS_SET_SIZE, physSkillBounds, verifyPhysFullComposition } from "../../lib/ap-exam/full-set-rules";
import { loadPhysPool, type PhysItem } from "./phys-pool";
import { solveMipHighs } from "./ilp-highs";
import type { Cons } from "../../lib/ap-exam/ilp";
import { verifyPhysAssignment, skillSummary, toReportSet, type PhysResult } from "./phys-assign";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const has = (n: string) => process.argv.includes(n);
const base = (a: string) => a.replace(/-s\d+(-.*)?$/, "");
const UNITS = [1, 2, 3, 4, 5, 6, 7, 8]; const SKILLS = Object.keys(physSkillBounds()); const kB = physSkillBounds();
type Lib = { id: string; unit: number; skill: string };
const guide = JSON.parse(readFileSync("lib/ap-generation/subjects/physics1-archetypes.json", "utf-8")) as { id: string; topic: string; skill: string }[];

export function planStrict(ids: string[], blockedArch: Set<string>, o: { timeMs: number; noVirtual?: boolean; noNewSets?: boolean; noNewFrq?: boolean; log?: (s: string) => void }) {
  const { pool } = loadPhysPool({ requireScreen: !process.env.PH_NO_SCREEN });
  const real = pool.filter((c) => !blockedArch.has(base(c.archetype)) && (c.kind === "frq" ? (PHYS_FRQ_TEMPLATES as readonly string[]).includes(c.frqType) : c.shared ? c.members.length === PHYS_SET_SIZE : c.members.length === 1));
  const stockedArch = new Set(pool.map((c) => base(c.archetype)));
  const libSingles: Lib[] = o.noVirtual ? [] : guide.filter((g) => g.id.startsWith("ph_") && !blockedArch.has(g.id) && !stockedArch.has(g.id)).map((g) => ({ id: g.id, unit: Number(g.topic.split(".")[0]), skill: g.skill }));
  const libSetIds = o.noVirtual ? [] : [...new Set(guide.filter((g) => g.id.startsWith("phs_")).map((g) => g.id.replace(/_q\d+$/, "")))].filter((id) => !blockedArch.has(id) && !stockedArch.has(id));
  const libSets = libSetIds.map((id) => ({ id, members: guide.filter((g) => g.id.startsWith(`${id}_q`)).map((g) => ({ unit: Number(g.topic.split(".")[0]), skill: g.skill })) }));
  let n = 0; const V = () => n++;
  const obj: number[] = []; const binary: boolean[] = []; const cons: Cons[] = [];
  const mk = (cost: number, bin = true) => { const j = V(); obj[j] = cost; binary[j] = bin; return j; };
  const x = new Map<string, number>(); // real
  real.forEach((c, i) => ids.forEach((_, s) => x.set(`${i}|${s}`, mk(-0.01 * (c.exam ?? 0)))));
  const y = new Map<string, number>(); libSingles.forEach((l) => ids.forEach((_, s) => y.set(`${l.id}|${s}`, mk(3))));
  const ys = new Map<string, number>(); libSets.forEach((l) => ids.forEach((_, s) => ys.set(`${l.id}|${s}`, mk(6))));
  const nw = new Map<string, number>(); // 새 단독 원형 (단원, 스킬, 세트)
  if (!o.noVirtual) ids.forEach((_, s) => { for (const u of UNITS) for (const k of SKILLS) nw.set(`${u}|${k}|${s}`, mk(10, false)); });
  const nws = new Map<string, number>(); // 새 세트 원형(두 문항 모두 같은 단원·스킬)
  if (!o.noVirtual && !o.noNewSets) ids.forEach((_, s) => { for (const u of UNITS) for (const k of SKILLS) nws.set(`${u}|${k}|${s}`, mk(20, false)); });
  const nf = new Map<string, number>(); if (!o.noVirtual && !o.noNewFrq) ids.forEach((_, s) => { for (const t of PHYS_FRQ_TEMPLATES) nf.set(`${t}|${s}`, mk(10)); });
  const idx = new Map(real.map((c, i) => [c, i] as const)); const X = (c: PhysItem, s: number) => x.get(`${idx.get(c)}|${s}`)!;
  const singles = real.filter((c) => c.kind === "mc" && !c.shared), sets = real.filter((c) => c.shared), frqs = real.filter((c) => c.kind === "frq");
  // 원형 서로소(모든 세트 합쳐 한 번)
  const archGroup = new Map<string, [number, number][]>();
  const push = (a: string, j: number) => { (archGroup.get(a) ?? archGroup.set(a, []).get(a)!).push([j, 1]); };
  real.forEach((c) => ids.forEach((_, s) => push(base(c.archetype), X(c, s))));
  libSingles.forEach((l) => ids.forEach((_, s) => push(l.id, y.get(`${l.id}|${s}`)!))); libSets.forEach((l) => ids.forEach((_, s) => push(l.id, ys.get(`${l.id}|${s}`)!)));
  for (const co of archGroup.values()) if (co.length > 1) cons.push({ coef: co, sense: "<=", rhs: 1 });
  ids.forEach((_, s) => {
    const cnt = (fU: (m: { unit: number; skill: string }) => boolean) => {
      const co: [number, number][] = [];
      for (const c of [...singles, ...sets]) { const k = c.members.filter(fU).length; if (k) co.push([X(c, s), k]); }
      for (const l of libSingles) if (fU(l)) co.push([y.get(`${l.id}|${s}`)!, 1]);
      for (const l of libSets) { const k = l.members.filter(fU).length; if (k) co.push([ys.get(`${l.id}|${s}`)!, k]); }
      for (const u of UNITS) for (const k of SKILLS) { const m = { unit: u, skill: k }; if (fU(m)) { const a = nw.get(`${u}|${k}|${s}`); if (a !== undefined) co.push([a, 1]); const b = nws.get(`${u}|${k}|${s}`); if (b !== undefined) co.push([b, PHYS_SET_SIZE]); } }
      return co;
    };
    const set2: [number, number][] = [...sets.map((c) => [X(c, s), 1] as [number, number]), ...libSets.map((l) => [ys.get(`${l.id}|${s}`)!, 1] as [number, number]), ...[...nws.entries()].filter(([k]) => k.endsWith(`|${s}`)).map(([, j]) => [j, 1] as [number, number])];
    cons.push({ coef: set2, sense: "=", rhs: PHYS_SET_COUNT });
    const sing: [number, number][] = [...singles.map((c) => [X(c, s), 1] as [number, number]), ...libSingles.map((l) => [y.get(`${l.id}|${s}`)!, 1] as [number, number]), ...[...nw.entries()].filter(([k]) => k.endsWith(`|${s}`)).map(([, j]) => [j, 1] as [number, number])];
    cons.push({ coef: sing, sense: "=", rhs: 42 - PHYS_SET_COUNT * PHYS_SET_SIZE });
    for (const u of UNITS) cons.push({ coef: cnt((m) => m.unit === u), sense: "=", rhs: PHYS_FULL_TARGET.units[String(u)] });
    for (const k of SKILLS) { const co = cnt((m) => m.skill === k); cons.push({ coef: co, sense: ">=", rhs: kB[k].min }); cons.push({ coef: co, sense: "<=", rhs: kB[k].max }); }
    for (const t of PHYS_FRQ_TEMPLATES) cons.push({ coef: [...frqs.filter((c) => c.frqType === t).map((c) => [X(c, s), 1] as [number, number]), ...(nf.has(`${t}|${s}`) ? [[nf.get(`${t}|${s}`)!, 1] as [number, number]] : [])], sense: "=", rhs: 1 });
    const fam = new Map<string, [number, number][]>(); for (const c of [...singles, ...sets, ...frqs]) (fam.get(c.fam) ?? fam.set(c.fam, []).get(c.fam)!).push([X(c, s), 1]);
    for (const co of fam.values()) if (co.length > 1) cons.push({ coef: co, sense: "<=", rhs: 1 });
  });
  const itemUse = [...real].map((c, i) => ({ c, i })); void itemUse;
  const r = solveMipHighs({ n, obj, cons, integer: new Array(n).fill(true), binary }, { timeMs: o.timeMs, log: o.log });
  const out = ids.map((id, s) => ({
    id, real: real.filter((c) => r.x[X(c, s)] > 0.5), lib: libSingles.filter((l) => r.x[y.get(`${l.id}|${s}`)!] > 0.5), libSets: libSets.filter((l) => r.x[ys.get(`${l.id}|${s}`)!] > 0.5),
    newSingles: [...nw.entries()].filter(([k, j]) => k.endsWith(`|${s}`) && r.x[j] > 0.5).flatMap(([k, j]) => { const [u, sk] = k.split("|"); return Array.from({ length: Math.round(r.x[j]) }, () => ({ unit: Number(u), skill: sk })); }),
    newSets: [...nws.entries()].filter(([k, j]) => k.endsWith(`|${s}`) && r.x[j] > 0.5).flatMap(([k, j]) => { const [u, sk] = k.split("|"); return Array.from({ length: Math.round(r.x[j]) }, () => ({ unit: Number(u), skill: sk })); }),
    newFrq: [...nf.entries()].filter(([k, j]) => k.endsWith(`|${s}`) && r.x[j] > 0.5).map(([k]) => k.split("|")[0]),
  }));
  return { status: r.status, obj: r.obj, out };
}

function main() {
  const ids = arg("--sets", "PH5,PH6").split(",").filter(Boolean);
  const blockedArch = new Set<string>(JSON.parse(readFileSync(arg("--block-archetypes"), "utf-8")) as string[]);
  const m = planStrict(ids, blockedArch, { timeMs: Number(arg("--time-ms", "120000")), noVirtual: has("--no-virtual"), noNewSets: has("--no-new-sets"), noNewFrq: has("--no-new-frq"), log: (s) => console.error(s) });
  console.log(`status=${m.status} 목적값=${m.obj}`);
  const totalNew = { singles: 0, sets: 0, frq: 0, lib: 0, libSets: 0 };
  for (const r of m.out) {
    console.log(`- ${r.id}: 재고 ${r.real.length}개 + 라이브러리 단독 ${r.lib.length} + 라이브러리 세트 ${r.libSets.length} + 새 단독 ${r.newSingles.length} + 새 세트 ${r.newSets.length} + 새 FRQ ${r.newFrq.length}`);
    for (const l of r.lib) console.log(`    라이브러리 단독: ${l.id} (${l.unit}, ${l.skill})`);
    for (const l of r.libSets) console.log(`    라이브러리 세트: ${l.id}`);
    for (const v of r.newSingles) console.log(`    새 단독 원형 필요: 단원 ${v.unit} 스킬 ${v.skill}`);
    for (const v of r.newSets) console.log(`    새 세트 원형 필요: 단원 ${v.unit} 스킬 ${v.skill}`);
    for (const v of r.newFrq) console.log(`    새 FRQ 시나리오 필요: ${v}`);
    totalNew.singles += r.newSingles.length; totalNew.sets += r.newSets.length; totalNew.frq += r.newFrq.length; totalNew.lib += r.lib.length; totalNew.libSets += r.libSets.length;
  }
  console.log(JSON.stringify(totalNew));
  if (has("--no-virtual")) { // 최종 배정: 배정기와 별개인 독립 검증기(공식 구조·단원·세트·FRQ 유형·문항군·세트 간 중복)로 다시 확인한다
    const results: PhysResult[] = m.out.map((r) => ({ id: r.id, singles: r.real.filter((c) => c.kind === "mc" && !c.shared), sets: r.real.filter((c) => c.shared), frq: r.real.filter((c) => c.kind === "frq"), virtual: [], virtualSets: [], frqVirtual: [] }));
    const bad = verifyPhysAssignment(results); for (const r of results) for (const w of skillSummary(r).warnings) bad.push(`${r.id}: ${w}`);
    console.log(`독립 검증기 위반: ${bad.length ? bad.join("; ") : "0"}`);
    for (const r of results) { const sk = skillSummary(r); const ex = [...r.singles, ...r.sets].reduce((a, c) => a + (c.exam ?? 0), 0); console.log(`- ${r.id}: exam_prep ${ex}/42, 스킬 ${JSON.stringify(sk.counts)}, 원형 ${new Set([...r.singles, ...r.sets, ...r.frq].map((c) => c.archetype)).size}종`); }
    const wr = arg("--write-report"); if (wr) writeFileSync(wr, JSON.stringify({ sets: results.map(toReportSet) }, null, 1));
    return;
  }
  const w = arg("--write-report");
  if (w && !has("--no-virtual")) throw new Error("--write-report 는 --no-virtual 에서만");
  if (w) writeFileSync(w, JSON.stringify({ sets: m.out.map((r) => {
    const blocks = r.real.filter((c) => c.kind === "mc").map((c) => ({ unit: c.members[0].unit, key: c.key })).sort((a, b) => a.unit - b.unit || a.key.localeCompare(b.key));
    return { id: r.id, mcA: blocks.map((b) => b.key), mcB: [], virtual: [], virtualSets: [], frqA: PHYS_FRQ_TEMPLATES.map((t) => r.real.find((c) => c.kind === "frq" && c.frqType === t)?.key).filter(Boolean), frqB: [], frqVirtual: [], subject: "ap_physics_1" };
  }) }, null, 1));
  void verifyPhysFullComposition;
}
if (process.argv[1]?.endsWith("phys-strict-plan.ts")) main();
