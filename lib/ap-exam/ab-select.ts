// AB 풀 세트 정확 제약 선택(탐욕적 planApSet 대체). 제약마다 official(공식)/internal(내부 설계) 라벨을 붙여 따로 보고한다.
// 방식: 고정 시드 담금질 탐색 + 독립 검증기(verify). 해를 찾으면 verify 가 모든 제약을 다시 계산한 증거(witness)다. 못 찾은 것은 불가능의 증명이 아니다.
export type Cand = { key: string; kind: "mc" | "frq"; unit: number; skillCat: number; calc: "required" | "not_allowed" | "na"; family: string; type: string; graphRequired: boolean; screenVerified: boolean; renderOk: boolean; fullMockUses: number; practiceUses: number };
export type Constraint = { id: string; label: "official" | "internal"; text: string; ok: boolean; detail: string };
export const OFFICIAL = { mcA: 29, mcB: 13, frqA: 2, frqB: 4, unitBounds: { 1: [5, 6], 2: [5, 6], 3: [3, 4], 4: [5, 6], 5: [7, 8], 6: [7, 8], 7: [3, 4], 8: [5, 6] } as Record<number, [number, number]>, skillBounds: { 1: [21, 29], 2: [7, 12], 3: [5, 8] } as Record<number, [number, number]> };
export const INTERNAL = { familyCap: 2, minFamilies: 21, graphRequiredMin: 10 };
export type Sel = { mcA: Cand[]; mcB: Cand[]; frqA: Cand[]; frqB: Cand[] };
const count = <T,>(xs: T[], f: (x: T) => string | number) => xs.reduce<Map<string | number, number>>((m, x) => (m.set(f(x), (m.get(f(x)) ?? 0) + 1), m), new Map());

export function verify(s: Sel, o = { ...INTERNAL }): Constraint[] {
  const mc = [...s.mcA, ...s.mcB], frq = [...s.frqA, ...s.frqB]; const out: Constraint[] = []; const add = (id: string, label: "official" | "internal", text: string, ok: boolean, detail = "") => out.push({ id, label, text, ok, detail });
  add("mc_counts", "official", "MC Part A 29(계산기 불가) + Part B 13(계산기 필수)", s.mcA.length === 29 && s.mcB.length === 13 && s.mcA.every((c) => c.calc === "not_allowed") && s.mcB.every((c) => c.calc === "required"), `${s.mcA.length}+${s.mcB.length}`);
  add("frq_counts", "official", "FRQ Part A 2(계산기) + Part B 4(계산기 불가)", s.frqA.length === 2 && s.frqB.length === 4 && s.frqA.every((c) => c.calc === "required") && s.frqB.every((c) => c.calc !== "required"), `${s.frqA.length}+${s.frqB.length}`);
  const u = count(mc, (c) => c.unit); const bad = Object.entries(OFFICIAL.unitBounds).filter(([k, [a, b]]) => (u.get(Number(k)) ?? 0) < a || (u.get(Number(k)) ?? 0) > b);
  add("unit_weights", "official", "MC 단원 비중(공식 범위)", bad.length === 0, [1, 2, 3, 4, 5, 6, 7, 8].map((k) => `${k}:${u.get(k) ?? 0}`).join(" "));
  const k = count(mc, (c) => c.skillCat); const badK = Object.entries(OFFICIAL.skillBounds).filter(([c, [a, b]]) => (k.get(Number(c)) ?? 0) < a || (k.get(Number(c)) ?? 0) > b);
  add("skill_weights", "official", "MC 스킬 범주 비중(공식 범위)", badK.length === 0, [1, 2, 3].map((c) => `${c}:${k.get(c) ?? 0}`).join(" "));
  const f = count(mc, (c) => c.family); const over = [...f.values()].filter((n) => n > o.familyCap).length;
  add("family_cap", "internal", `MC 문항군당 ${o.familyCap}개 이하`, over === 0, `최대 ${Math.max(...f.values())}`);
  add("family_diversity", "internal", `MC 서로 다른 문항군 >= ${o.minFamilies}`, f.size >= o.minFamilies, `${f.size}`);
  const g = mc.filter((c) => c.graphRequired).length; add("graph_required", "internal", `그래프가 풀이에 필수인 MC >= ${o.graphRequiredMin}(장식·보조 그래프 제외, 공식 기준 아님)`, g >= o.graphRequiredMin, `${g}`);
  add("frq_types", "internal", "FRQ 6개 모두 다른 유형·문항군", new Set(frq.map((c) => c.type)).size === 6 && new Set(frq.map((c) => c.family)).size === 6, `${new Set(frq.map((c) => c.type)).size}유형`);
  const keys = [...mc, ...frq].map((c) => c.key); add("no_dup", "internal", "항목 중복 없음", new Set(keys).size === keys.length);
  const fm = [...mc, ...frq].filter((c) => c.fullMockUses > 0).length; add("full_mock_overlap", "internal", "다른 풀 모의고사와 겹침 0(기본 정책)", fm === 0, `${fm}`);
  return out;
}
const cost = (s: Sel, o = INTERNAL) => verify(s, o).filter((c) => !c.ok).length * 1000 + (() => { const mc = [...s.mcA, ...s.mcB]; const u = count(mc, (c) => c.unit); let v = 0; for (const [kk, [a, b]] of Object.entries(OFFICIAL.unitBounds)) v += Math.max(0, a - (u.get(Number(kk)) ?? 0)) + Math.max(0, (u.get(Number(kk)) ?? 0) - b); const kc = count(mc, (c) => c.skillCat); for (const [kk, [a, b]] of Object.entries(OFFICIAL.skillBounds)) v += Math.max(0, a - (kc.get(Number(kk)) ?? 0)) + Math.max(0, (kc.get(Number(kk)) ?? 0) - b); const f = count(mc, (c) => c.family); v += [...f.values()].reduce((a, n) => a + Math.max(0, n - o.familyCap), 0) + Math.max(0, o.minFamilies - f.size) + Math.max(0, o.graphRequiredMin - mc.filter((c) => c.graphRequired).length); return v * 20; })();
const soft = (s: Sel) => [...s.mcA, ...s.mcB, ...s.frqA, ...s.frqB].reduce((a, c) => a + (c.screenVerified ? 0 : 2) + (c.renderOk ? 0 : 3) + c.practiceUses, 0);
/** 키 기준 안정 정렬 사본(원본 불변). */
export const stableByKey = (xs: Cand[]): Cand[] => [...xs].sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0));
function rng(seed: number) { let x = seed >>> 0 || 1; return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296); }

/** FRQ: 서로 다른 유형 6개를 전수 탐색(Part A 필수 2 × Part B 4), 검증·렌더 우선. */
export function selectFrq(poolIn: Cand[], exclude = new Set<string>()): { a: Cand[]; b: Cand[] } | null {
  const pool = stableByKey(poolIn); // 입력 순서와 무관하게 동일 결과(결정성)
  const A = pool.filter((c) => c.kind === "frq" && c.calc === "required" && !exclude.has(c.key) && c.fullMockUses === 0), B = pool.filter((c) => c.kind === "frq" && c.calc !== "required" && !exclude.has(c.key) && c.fullMockUses === 0);
  let best = null as { a: Cand[]; b: Cand[]; s: number } | null; const sc = (xs: Cand[]) => xs.reduce((a, c) => a + (c.screenVerified ? 0 : 2) + (c.renderOk ? 0 : 3) + c.practiceUses, 0);
  for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) { const a = [A[i], A[j]]; if (a[0].type === a[1].type || a[0].family === a[1].family) continue;
    const used = new Set(a.map((c) => c.type)); const Bf = B.filter((c) => !used.has(c.type)); const pick = (st: number, cur: Cand[]) => { if (cur.length === 4) { const s = sc(a) + sc(cur); if (!best || s < best.s) best = { a, b: [...cur], s }; return; } for (let q = st; q < Bf.length; q++) { if (cur.some((c) => c.type === Bf[q].type || c.family === Bf[q].family)) continue; cur.push(Bf[q]); pick(q + 1, cur); cur.pop(); } }; pick(0, []); }
  const bb = best as { a: Cand[]; b: Cand[] } | null; return bb ? { a: bb.a, b: bb.b } : null;
}
/** MC: 고정 시드 탐색. exclude 는 후보에서 뺄 키, lock 은 가능하면 유지할 이전 선택(교체 슬롯만 움직임). */
export function selectMc(poolIn: Cand[], opts: { exclude?: Set<string>; prev?: { mcA: Cand[]; mcB: Cand[] }; seed?: number; iters?: number } = {}): { mcA: Cand[]; mcB: Cand[] } | null {
  const pool = stableByKey(poolIn); // 입력 순서와 무관하게 동일 결과(결정성)
  const ex = opts.exclude ?? new Set<string>(); const A = pool.filter((c) => c.kind === "mc" && c.calc === "not_allowed" && !ex.has(c.key) && c.fullMockUses === 0), B = pool.filter((c) => c.kind === "mc" && c.calc === "required" && !ex.has(c.key) && c.fullMockUses === 0);
  const empty = { mcA: [] as Cand[], mcB: [] as Cand[] }; const dummy = { frqA: [] as Cand[], frqB: [] as Cand[] };
  const cst = (a: Cand[], b: Cand[]) => cost({ mcA: a, mcB: b, ...dummy }) - 2000 /* FRQ 제약 2개 항상 실패 */ + soft({ mcA: a, mcB: b, ...dummy }) * 0.01;
  for (const attempt of [0, 1, 2, 3]) {
    const r = rng((opts.seed ?? 7) + attempt * 101); const pickN = (p: Cand[], n: number, base: Cand[] = []) => { const out = base.filter((c) => p.includes(c)); const pool2 = p.filter((c) => !out.includes(c)); while (out.length < n && pool2.length) out.push(pool2.splice(Math.floor(r() * pool2.length), 1)[0]); return out; };
    const prev = attempt === 0 ? opts.prev : undefined; const locked = new Set<Cand>(prev ? [...prev.mcA, ...prev.mcB].filter((c) => !ex.has(c.key)) : []);
    const a = pickN(A, 29, prev?.mcA ?? []), b = pickN(B, 13, prev?.mcB ?? []); let cur = cst(a, b); let T = 30; let feasibleAt = -1;
    for (let t = 0; t < (opts.iters ?? 120000); t++) {
      if (cur < 20 && feasibleAt < 0) feasibleAt = t; if (feasibleAt >= 0 && t > feasibleAt + 20000) break; // 가능해를 찾은 뒤 짧게 검증·렌더·겹침 선호로 다듬는다
      const inA = r() < 0.7; const part = inA ? a : b, pl = inA ? A : B; const p = Math.floor(r() * part.length); if (locked.has(part[p])) continue;
      const n = pl[Math.floor(r() * pl.length)]; if (part.includes(n)) continue; const old = part[p]; part[p] = n; const c = cst(a, b);
      if (feasibleAt >= 0 && c >= 20) { part[p] = old; continue; }
      if (c <= cur || r() < Math.exp((cur - c) / Math.max(T, 0.05))) cur = c; else part[p] = old; T *= 0.99995;
    }
    if (verify({ mcA: a, mcB: b, frqA: [], frqB: [] }).filter((c) => c.id !== "frq_counts" && c.id !== "frq_types").every((c) => c.ok)) return { mcA: a, mcB: b };
  }
  void empty; return null;
}
export const failedKeys = (s: Sel) => [...s.mcA, ...s.mcB, ...s.frqA, ...s.frqB];
