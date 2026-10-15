// AP Biology Practice Exam 1·2 (현재 게시 v1) → v3 정확 배정(exact-assign-bio-bi1-bi2-v3.json) 새 버전 교체 계획 생성기(무료·읽기 전용·DB 없음).
//   npx tsx scripts/audit/bio-new-version-plans.ts [--write]
// 입력: 게시 v1 슬롯 스냅샷 data/ap/stock/bio-bi1-bi2-published-v1-slots.json(SELECT 전용 조회 결과 + 변환 완료 후보 키 목록), v3 배정 보고서.
// 핵심 제약: 새 버전 초안(createNewVersion)은 '교체해 넣는 문항'이 다른 풀 모의고사 계열의 초안·게시 세트에 이미 있으면 거부한다.
//   v3 에서 BI1 이 가져올 문항 중 일부가 지금 BI2 v1 에 있고(X), BI2 가 가져올 문항 중 일부가 지금 BI1 v1 에 있다(Y) → 순환이라 한 번에 못 한다.
//   ① BI1 중간판(Y 칸을 BI1 이 가져올 '아무도 안 쓰는' 문항 Z 로 임시 교체) → ② BI2 → v3 목표(Y 를 가져오고 X 를 내보냄) → ③ BI1 중간판 → v3 목표(X 를 가져옴).
// 공유 세트(4문항)는 같은 크기 세트로만, FRQ 는 같은 유형끼리만 교체한다. 각 단계의 구성은 독립 검증기로 점검한다.
import { readFileSync, writeFileSync } from "node:fs";
import { verifyBioFullComposition, type BioSetItem } from "../../lib/ap-exam/full-set-rules";
import { verifyBioAssignment, type BioResult } from "../ap-generation/bio-assign";
import { loadBioPool, type BioItem } from "../ap-generation/bio-pool";

const write = process.argv.includes("--write");
const argv = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const rd = <T>(p: string) => JSON.parse(readFileSync(p, "utf-8")) as T;
type Snap = Record<"BI1" | "BI2", { sourceSetName: string; sourceVersionNo: number; slots: { section: string; position: number; candidateKey: string }[] }> & { convertedKeys: string[] };
// 입력은 인자로 바꿀 수 있다(기본값 = 2026-10-14 v1 → v3 계획). 2026-10-15 v4 계획: --slots data/ap/stock/bio-bi1-bi2-published-v3v4-slots.json --assign data/ap/stock/exact-assign-bio-bi1-bi2-v4.json --assume-converted bio-v3a-items,bio-v3b-items --frq-spread
const snap = rd<Snap>(argv("--slots", "data/ap/stock/bio-bi1-bi2-published-v1-slots.json"));
const FRQ_SPREAD = process.argv.includes("--frq-spread");
const v3 = Object.fromEntries(rd<{ sets: { id: string; mcA: string[]; frqA: string[] }[] }>(argv("--assign", "data/ap/stock/exact-assign-bio-bi1-bi2-v3.json")).sets.map((s) => [s.id, s]));
const { all } = loadBioPool(); const byKey = new Map(all.map((c) => [c.key, c]));
const assumeBatches = argv("--assume-converted", "").split(",").filter(Boolean);
/** 새 배치(DB 적재·변환 전)의 통과 키 — 관리자가 배치를 적재·변환한 뒤에 계획을 적용한다는 전제로 '변환 완료'로 센다. */
const assumed = new Set(assumeBatches.flatMap((b) => rd<{ stockKey: string; validation: string; duplicateOf?: string | null }[]>(`data/ap/stock/${b}.json`).filter((r) => r.validation === "auto_passed" && !r.duplicateOf).map((r) => r.stockKey)));
const converted = new Set([...snap.convertedKeys, ...assumed]);
const get = (k: string) => { const c = byKey.get(k); if (!c) throw new Error(`재고(화면 증거 보유)에 없는 키 ${k}`); return c; };

/** 한 세트의 상태: MC 블록(단독 1칸·세트 4칸, 시작 위치 고정) + FRQ 칸 6개. */
type Block = { key: string; start: number; size: number };
type State = { mc: Block[]; frq: string[] };
function stateOf(id: "BI1" | "BI2"): State {
  const mcSlots = snap[id].slots.filter((s) => s.section === "ap_mc").sort((a, b) => a.position - b.position);
  const mc: Block[] = [];
  for (const s of mcSlots) { const l = mc[mc.length - 1]; if (l && l.key === s.candidateKey) l.size++; else mc.push({ key: s.candidateKey, start: s.position, size: 1 }); }
  const frq = snap[id].slots.filter((s) => s.section === "ap_frq").sort((a, b) => a.position - b.position).map((s) => s.candidateKey);
  return { mc, frq };
}
const keysOf = (s: State) => [...s.mc.map((b) => b.key), ...s.frq];
const resultOf = (id: string, s: State): BioResult => { const items = s.mc.map((b) => get(b.key)); return { id, singles: items.filter((c) => !c.shared), sets: items.filter((c) => c.shared), frq: s.frq.map(get), virtual: [], virtualSets: [], virtualSetArchetypes: [], frqVirtual: [] }; };
/** 실제 위치 순서(교체는 칸을 그대로 쓰므로 단원 순서는 보장되지 않는다) 기준 공식 구성 검증. */
function slotViolations(id: string, s: State): string[] {
  const comp: BioSetItem[] = [];
  for (const b of s.mc) { const c = get(b.key); for (let j = 0; j < b.size; j++) comp.push({ kind: "mc", unit: String(c.members[j].unit), skill: c.members[j].skill, candidateKey: c.shared ? b.key : null, position: b.start + j }); }
  s.frq.forEach((k, i) => comp.push({ kind: "frq", unit: null, skill: null, candidateKey: k, position: i + 1 }));
  return verifyBioFullComposition(comp).map((v) => `${id}: ${v}`);
}
const examOf = (s: State) => s.mc.reduce((n, b) => n + (get(b.key).exam ?? 0), 0);

const C = { BI1: stateOf("BI1"), BI2: stateOf("BI2") };
const F = (id: "BI1" | "BI2"): { mc: string[]; frq: string[] } => ({ mc: v3[id].mcA, frq: v3[id].frqA });

// ── v3 에 변환 안 된 문항이 있으면 같은 칸(단원·스킬·시험 단계)의 변환 완료·미사용 문항으로 대체한다 ──
const target: Record<"BI1" | "BI2", { mc: string[]; frq: string[] }> = { BI1: { mc: [...F("BI1").mc], frq: [...F("BI1").frq] }, BI2: { mc: [...F("BI2").mc], frq: [...F("BI2").frq] } };
const notes: string[] = [];
const inCurrent = new Set([...keysOf(C.BI1), ...keysOf(C.BI2)]);
const inBI2 = new Set(keysOf(C.BI2));
/** BI1 목표에는 BI2 가 v3 에서 내보내는 문항도 쓸 수 있다(단계 ③ 에서 BI1 이 가져오는 시점엔 이미 비어 있다). */
const canUse = (id: "BI1" | "BI2", key: string) => !inCurrent.has(key) || (id === "BI1" && inBI2.has(key));
const targetResult = (id: "BI1" | "BI2"): BioResult => { const items = target[id].mc.map(get); return { id, singles: items.filter((c) => !c.shared), sets: items.filter((c) => c.shared), frq: target[id].frq.map(get), virtual: [], virtualSets: [], virtualSetArchetypes: [], frqVirtual: [] }; };
for (const id of ["BI1", "BI2"] as const) {
  for (const k of [...target[id].mc, ...target[id].frq]) {
    if (converted.has(k) || inCurrent.has(k)) continue;
    const orig = get(k); const taken = new Set([...target.BI1.mc, ...target.BI1.frq, ...target.BI2.mc, ...target.BI2.frq]);
    const taken0 = () => new Set([...target.BI1.mc, ...target.BI1.frq, ...target.BI2.mc, ...target.BI2.frq]);
    const same = (c: BioItem, o: BioItem) => JSON.stringify(c.members.map((m) => [m.unit, m.skill[0]])) === JSON.stringify(o.members.map((m) => [m.unit, m.skill[0]]));
    const free = (o: BioItem) => all.filter((c) => c.kind === o.kind && c.shared === o.shared && c.frqType === o.frqType && c.screen && converted.has(c.key) && canUse(id, c.key) && ![...target.BI1.mc, ...target.BI1.frq, ...target.BI2.mc, ...target.BI2.frq].includes(c.key) && (c.exam ?? 0) >= (o.exam ?? 0) && same(c, o)).sort((p, q) => p.key.localeCompare(q.key));
    const other = id === "BI1" ? "BI2" : "BI1";
    const sub = (set: "BI1" | "BI2", from: string, to: string) => { target[set] = { mc: target[set].mc.map((x) => (x === from ? to : x)), frq: target[set].frq.map((x) => (x === from ? to : x)) }; };
    let chosen: BioItem | undefined;
    // 0순위: 이 시험이 지금 갖고 있다가 v3 에서 빠지는 문항 중 같은 원형·단원·스킬인 것(= 사실상 같은 문항 틀이라 교체할 필요가 없다).
    const own = new Set(keysOf(C[id]));
    for (const c of all.filter((x) => own.has(x.key) && !taken0().has(x.key) && x.kind === orig.kind && x.shared === orig.shared && x.frqType === orig.frqType && x.archetype === orig.archetype && same(x, orig) && (x.exam ?? 0) >= (orig.exam ?? 0))) {
      sub(id, k, c.key);
      if (verifyBioAssignment([targetResult("BI1"), targetResult("BI2")]).length === 0) { chosen = c; notes.push(`${id}: ${c.key} 는 ${id} 가 지금 이미 갖고 있고 v3 에서만 빠지는 같은 원형(${c.archetype})·단원·Practice 문항이라 그대로 유지한다(교체 불필요).`); break; }
      sub(id, c.key, k);
    }
    if (!chosen) for (const c of free(orig)) {
      sub(id, k, c.key);
      let bad = verifyBioAssignment([targetResult("BI1"), targetResult("BI2")]);
      if (bad.length === 0) { chosen = c; break; }
      // 구조(원형) 겹침이 원인이면 반대 시험의 그 원형 문항을 같은 칸의 변환 완료 문항으로 맞바꾼다(2단계 수리).
      const arch = c.archetype; const d = [...target[other].mc, ...target[other].frq].map(get).find((x) => x.archetype === arch);
      if (process.env.DBG) console.log("repair", c.key, arch, d?.key, d?.members.map((m) => m.unit + ":" + m.skill).join(), d?.exam, free(d ?? orig).map((x) => x.key).join(), bad.slice(0, 3).join(" | "));
      if (d) for (const e of free(d)) {
        sub(other, d.key, e.key); bad = verifyBioAssignment([targetResult("BI1"), targetResult("BI2")]);
        if (bad.length === 0) { chosen = c; notes.push(`${other}: ${d.key}(원형 ${arch}) → ${e.key} (${id} 의 대체 문항과 구조 겹침을 피하려고 같은 칸의 변환 완료 문항으로 교체).`); break; }
        sub(other, e.key, d.key);
      }
      if (chosen) break;
      sub(id, c.key, k);
    }
    if (!chosen) {
      // 같은 칸 대체가 없으면 2건 교환 탐색: k → c(변환 완료·미사용 단독, 어느 단원이든), 그리고 같은 시험의 다른 단독 d → e 로 단원·Practice 균형을 되맞춘다. exam_prep 합계는 v3 이상.
      const exTotal = (set: "BI1" | "BI2") => target[set].mc.reduce((n, x) => n + (get(x).exam ?? 0), 0);
      const baseEx = exTotal(id); const taken00 = taken0();
      const pool1 = all.filter((c) => c.kind === "mc" && !c.shared && c.screen && converted.has(c.key) && canUse(id, c.key) && !taken00.has(c.key)).sort((p, q) => sim(orig, q) - sim(orig, p) || p.key.localeCompare(q.key));
      const ok = () => verifyBioAssignment([targetResult("BI1"), targetResult("BI2")]).length === 0 && exTotal(id) >= baseEx;
      search: for (const c of pool1) {
        sub(id, k, c.key);
        for (const d of target[id].mc.map(get).filter((x) => !x.shared && x.key !== c.key && !(id === "BI1" ? false : false))) {
          for (const e of pool1) { if (e.key === c.key) continue; sub(id, d.key, e.key); if (ok()) { chosen = c; notes.push(`${id}: ${d.key} → ${e.key} (대체 문항 ${c.key} 로 깨진 단원·Practice 균형을 맞추는 교환).`); break search; } sub(id, e.key, d.key); }
        }
        sub(id, c.key, k);
      }
    }
    if (!chosen) throw new Error(`${k} 는 변환되지 않았고 검증기를 통과하는 대체 문항도 없다`);
    notes.push(`${id}: v3 의 ${k} 는 DB 에서 아직 변환되지 않아 같은 (단원·Practice) 의 변환 완료 문항 ${chosen.key} 로 대체(exam_prep ${(chosen.exam ?? 0)}/${orig.exam ?? 0}; 단원·Practice 동일).`);
  }
}
for (const id of ["BI1", "BI2"] as const) for (const k of [...target[id].mc, ...target[id].frq]) if (!converted.has(k) && !inCurrent.has(k)) throw new Error(`${k} 변환 안 됨`);

// ── 단계별 교체 ──
type Swap = { section: "ap_mc" | "ap_frq"; position: number; removeKey: string; addKey: string; remove: Meta; add: Meta };
type Meta = { unit: number | null; skill: string | null; shared: boolean; type: string; examPrep: number };
const meta = (c: BioItem): Meta => ({ unit: c.members[0]?.unit ?? null, skill: c.members[0]?.skill ?? null, shared: c.shared, type: c.frqType, examPrep: c.exam ?? 0 });
const cls = (c: BioItem) => (c.kind === "frq" ? `frq:${c.frqType}` : c.shared ? "set" : "single");
function sim(a: BioItem, b: BioItem) { return a.members.reduce((n, m, i) => n + (m.unit === b.members[i]?.unit ? 4 : 0) + (m.skill === b.members[i]?.skill ? 2 : 0) + (m.skill[0] === b.members[i]?.skill[0] ? 1 : 0), 0) + ((a.exam ?? 0) === (b.exam ?? 0) ? 0.5 : 0); }
/** 같은 부류(단독 / 세트 / FRQ 유형) 안에서 유사도 합 최대 짝짓기(탐욕 + 2-교환 개선). */
function pairUp(rem: BioItem[], add: BioItem[]): [BioItem, BioItem][] {
  const out: [BioItem, BioItem][] = [];
  for (const k of new Set(rem.map(cls))) {
    const r = rem.filter((c) => cls(c) === k), a = add.filter((c) => cls(c) === k);
    if (r.length !== a.length) throw new Error(`부류 ${k} 교체 수 불일치 ${r.length}/${a.length}`);
    const as = [...a]; const pick: BioItem[] = [];
    for (const x of [...r].sort((p, q) => p.key.localeCompare(q.key))) { let bi = 0, bs = -1; as.forEach((y, i) => { const s = sim(x, y); if (s > bs) { bs = s; bi = i; } }); pick.push(as.splice(bi, 1)[0]); }
    for (let pass = 0; pass < 20; pass++) { let changed = false; for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) if (sim(r[i], pick[j]) + sim(r[j], pick[i]) > sim(r[i], pick[i]) + sim(r[j], pick[j])) { [pick[i], pick[j]] = [pick[j], pick[i]]; changed = true; } if (!changed) break; }
    r.forEach((x, i) => out.push([x, pick[i]]));
  }
  return out;
}
function apply(src: State, pairs: [BioItem, BioItem][]): { next: State; swaps: Swap[] } {
  const rep = new Map(pairs.map(([r, a]) => [r.key, a.key])); const swaps: Swap[] = [];
  const next: State = { mc: src.mc.map((b) => ({ ...b, key: rep.get(b.key) ?? b.key })), frq: src.frq.map((k) => rep.get(k) ?? k) };
  for (const b of src.mc) { const a = rep.get(b.key); if (a) swaps.push({ section: "ap_mc", position: b.start, removeKey: b.key, addKey: a, remove: meta(get(b.key)), add: meta(get(a)) }); }
  src.frq.forEach((k, i) => { const a = rep.get(k); if (a) swaps.push({ section: "ap_frq", position: i + 1, removeKey: k, addKey: a, remove: meta(get(k)), add: meta(get(a)) }); });
  return { next, swaps };
}

type SetId = "BI1" | "BI2";
const IDS: SetId[] = ["BI1", "BI2"]; const oth = (i: SetId): SetId => (i === "BI1" ? "BI2" : "BI1");
const T = Object.fromEntries(IDS.map((i) => [i, new Set([...target[i].mc, ...target[i].frq])])) as Record<SetId, Set<string>>;
const CUR = Object.fromEntries(IDS.map((i) => [i, new Set(keysOf(C[i]))])) as Record<SetId, Set<string>>;
const lowerName = (i: SetId) => i.toLowerCase();

/** 구성 위반의 크기(단원은 새 버전 흐름이 막는 항목이라 가중 100, Practice 는 범위 이탈 거리). */
const vioCost = (vs: string[]) => vs.reduce((n, v) => { const m = /(unit|practice)_(\d)_(\d+)_not_in_(\d+)-(\d+)/.exec(v); if (!m) return n + 50; const c = Number(m[3]), lo = Number(m[4]), hi = Number(m[5]); return n + (m[1] === "unit" ? 100 : 1) * (c < lo ? lo - c : c - hi); }, 0);
const hardOf = (id: SetId, st: State) => vioCost(slotViolations(id, st).filter((v) => /unit_/.test(v))) + 100 * verifyBioAssignment([resultOf(id, st)], new Set(), { disjoint: false }).filter((v) => /문항군|구조/.test(v)).length;
const softOf = (id: SetId, st: State) => vioCost(slotViolations(id, st).filter((v) => !/unit_/.test(v)));

/** 중간판의 채움 선택: 상대가 가져갈 문항(rel) 칸마다 같은 부류의 자유 문항 하나(중복 없이). 단원 범위·문항군 중복(새 버전 흐름이 막는 항목)을 먼저 맞추고 Practice 이탈을 최소화하도록 담금질한다. */
function fill(first: SetId, rel: string[]): { pairs: [BioItem, BioItem][]; hard: number; soft: number } {
  const ys = rel.map(get).sort((p, q) => p.key.localeCompare(q.key));
  const free = [...T[first]].filter((k) => !CUR.BI1.has(k) && !CUR.BI2.has(k));
  const tgtAll = new Set([...T.BI1, ...T.BI2]);
  const extra = all.filter((c) => c.kind === "mc" && !c.shared && c.screen && converted.has(c.key) && !inCurrent.has(c.key) && !tgtAll.has(c.key));
  const zs = [...free.map(get), ...extra]; const isExtra = (c: BioItem) => !free.includes(c.key);
  const cost = (pairs: [BioItem, BioItem][]) => { const st = apply(C[first], pairs).next; return hardOf(first, st) * 1000 + softOf(first, st) + 0.5 * pairs.filter((p) => isExtra(p[1])).length; };
  let best: [BioItem, BioItem][] | null = null, bestCost = Infinity;
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let r = 0; r < 8; r++) {
    const left = new Map(zs.map((z) => [z.key, z])); const pairs: [BioItem, BioItem][] = [];
    for (const y of ys) { const c = [...left.values()].filter((z) => cls(z) === cls(y)); if (!c.length) throw new Error(`${first}: ${y.key} 와 같은 부류의 자유 문항이 없다`); const pick = r === 0 ? c.sort((a2, b2) => sim(y, b2) - sim(y, a2))[0] : c[Math.floor(rnd() * c.length)]; left.delete(pick.key); pairs.push([y, pick]); }
    let cur = cost(pairs); let bestHere = cur; let bestPairs = pairs.map((p) => [...p] as [BioItem, BioItem]);
    const N = 8000;
    for (let it = 0; it < N; it++) {
      const temp = 3000 * (1 - it / N) + 0.05; const t = [...pairs]; const i = Math.floor(rnd() * pairs.length);
      if (rnd() < 0.5) { const c = [...left.values()].filter((z) => cls(z) === cls(pairs[i][1])); if (!c.length) continue; const z = c[Math.floor(rnd() * c.length)]; t[i] = [pairs[i][0], z]; const nc = cost(t); if (nc <= cur || rnd() < Math.exp((cur - nc) / temp)) { left.set(pairs[i][1].key, pairs[i][1]); left.delete(z.key); pairs.splice(0, pairs.length, ...t); cur = nc; } }
      else { const j = Math.floor(rnd() * pairs.length); if (i === j || cls(pairs[i][1]) !== cls(pairs[j][1])) continue; t[i] = [pairs[i][0], pairs[j][1]]; t[j] = [pairs[j][0], pairs[i][1]]; const nc = cost(t); if (nc <= cur || rnd() < Math.exp((cur - nc) / temp)) { pairs.splice(0, pairs.length, ...t); cur = nc; } }
      if (cur < bestHere) { bestHere = cur; bestPairs = pairs.map((p) => [...p] as [BioItem, BioItem]); }
    }
    if (bestHere < bestCost) { bestCost = bestHere; best = bestPairs; }
  }
  const st = apply(C[first], best!).next;
  return { pairs: best!, hard: hardOf(first, st), soft: softOf(first, st) };
}

type Flow = { first: SetId; second: SetId; hard: number; soft: number; s1: ReturnType<typeof apply>; s2: ReturnType<typeof apply>; s3: ReturnType<typeof apply>; rel: string[]; inflow: string[] };
function flow(first: SetId): Flow {
  const second = oth(first);
  const rel = [...CUR[first]].filter((k) => T[second].has(k)); // first 가 지금 갖고 있고 second 가 가져갈 문항
  const inflow = [...CUR[second]].filter((k) => T[first].has(k)); // second 가 지금 갖고 있고 first 가 가져갈 문항
  const f = fill(first, rel);
  const s1 = apply(C[first], f.pairs);
  const s2 = apply(C[second], pairUp([...CUR[second]].filter((k) => !T[second].has(k)).map(get), [...T[second]].filter((k) => !CUR[second].has(k)).map(get)));
  const i1 = new Set(keysOf(s1.next));
  const s3 = apply(s1.next, pairUp([...i1].filter((k) => !T[first].has(k)).map(get), [...T[first]].filter((k) => !i1.has(k)).map(get)));
  return { first, second, hard: f.hard, soft: f.soft, s1, s2, s3, rel, inflow };
}
const flows = IDS.map(flow);
for (const f of flows) console.log(`중간판을 ${f.first} 로: ${f.first}→${f.second} 이동 ${f.rel.length}건, ${f.second}→${f.first} 이동 ${f.inflow.length}건; 중간판 필수 위반(단원·문항군) ${f.hard}, Practice 이탈 ${f.soft}`);
const okFlows = flows.filter((f) => f.hard === 0).sort((a, b) => a.soft - b.soft);
if (!okFlows.length) throw new Error("두 방향 모두 중간판이 새 버전 흐름의 필수 검증(단원 범위·문항군)을 통과하지 못한다");
const F0 = okFlows[0]; const { first, second, s1, s2, s3 } = F0;
console.log(`선택: 중간판 = ${first} (필수 위반 0, Practice 이탈 ${F0.soft})`);

const stageChecks: { stage: string; violations: string[] }[] = [];
const chk = (stage: string, a: State, b: State, strictStructure: boolean) => {
  const v = [...slotViolations(first, a), ...slotViolations(second, b)];
  v.push(...verifyBioAssignment([resultOf(first, a), resultOf(second, b)]).filter((x) => strictStructure || !/겹침/.test(x)));
  stageChecks.push({ stage, violations: v });
};
chk(`① ${first} 중간판 + ${second} v1`, s1.next, C[second], false);
chk(`② ${first} 중간판 + ${second} v3 목표`, s1.next, s2.next, false);
chk(`③ ${first} v3 목표 + ${second} v3 목표(최종)`, s3.next, s2.next, true);
if (FRQ_SPREAD) stageChecks[2].violations.push(...verifyBioAssignment([resultOf(first, s3.next), resultOf(second, s2.next)], new Set(), { frqSpread: true }).filter((x) => /frq_/.test(x)));
for (const c of stageChecks) console.log(`${c.stage}: 위반 ${c.violations.length}${c.violations.length ? " — " + c.violations.slice(0, 6).join(" | ") : ""}`);
const sameSet = (a: Iterable<string>, b: Iterable<string>) => { const x = [...a].sort(), y = [...b].sort(); return x.length === y.length && x.every((v, i) => v === y[i]); };
if (!sameSet(keysOf(s3.next), T[first]) || !sameSet(keysOf(s2.next), T[second])) throw new Error("최종 구성이 v3 목표와 다르다");
const ex = { [first]: examOf(s3.next), [second]: examOf(s2.next) };
console.log(`교체 수(키 단위): ①${first} 중간판 ${s1.swaps.length}, ②${second} ${s2.swaps.length}, ③${first} ${s3.swaps.length}. 최종 exam_prep MC: BI1 ${ex.BI1}/60, BI2 ${ex.BI2}/60`);
for (const n of notes) console.log(`NOTE ${n}`);
const final = stageChecks[2].violations;

const nm = (i: SetId) => snap[i].sourceSetName;
const v1 = snap[first].sourceVersionNo, v2 = snap[second].sourceVersionNo;
const plans: { file: string; set: SetId; ver: number; swaps: Swap[]; note: string; violations: string[] }[] = [
  { file: `${lowerName(first)}-v${v1 + 1}-swap-plan.json`, set: first, ver: v1, swaps: s1.swaps, note: `단계 ① ${first} 중간판(v${v1 + 1}): ${second} 가 목표 배정에서 가져갈 문항을 비우고 빈 칸을 아무도 안 쓰는 문항으로 채운다(단원 범위 유지). 공개 직후 ②③ 을 이어서 한다.`, violations: stageChecks[0].violations },
  { file: `${lowerName(second)}-v${v2 + 1}-swap-plan.json`, set: second, ver: v2, swaps: s2.swaps, note: `단계 ② ${second} → 목표 배정(v${v2 + 1}). 선행: ${lowerName(first)}-v${v1 + 1} 공개(${first} 가 ${second} 몫 문항을 비운 뒤).`, violations: stageChecks[1].violations },
  { file: `${lowerName(first)}-v${v1 + 2}-swap-plan.json`, set: first, ver: v1 + 1, swaps: s3.swaps, note: `단계 ③ ${first} 중간판(v${v1 + 1}) → 목표 배정(v${v1 + 2}). 선행: ${lowerName(second)}-v${v2 + 1} 공개(${second} 가 ${first} 몫 문항을 비운 뒤).`, violations: final },
];
if (write) {
  if (final.length) throw new Error(`최종 위반 ${final.length}건 — 계획 파일을 쓰지 않습니다`);
  for (const p of plans) writeFileSync(`data/ap/stock/${p.file}`, JSON.stringify({ kind: "ap_new_version_swap_plan", set: p.set, sourceSetName: nm(p.set), sourceVersionNo: p.ver, generatedBy: "scripts/audit/bio-new-version-plans.ts", note: p.note, swapCount: p.swaps.length, verifierViolations: p.violations, ...(notes.length ? { substitutions: notes } : {}), ...(() => { const r = [...new Set(p.swaps.map((x) => x.addKey))].filter((k) => !snap.convertedKeys.includes(k)).sort(); return r.length ? { requiresConvertedCandidates: r } : {}; })(), swaps: p.swaps }, null, 1) + "\n");
  console.log("wrote", plans.map((p) => p.file).join(", "));
}
