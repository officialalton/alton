// 원형 시드 스윕: (원형, 시드) → 생성 → 검증. 생성 실패(GenFail·예외)는 '시드 건너뜀'으로, 검증 실패는 버그로 센다.
import type { Archetype, Instance } from "./types";
import { GenFail } from "./types";
import { hashSeed, makeRng } from "./rng";
import { verifyInstance } from "./verify";

export const seedRng = (a: Archetype, seed: number, attempt = 0) => makeRng(hashSeed(attempt === 0 ? `${a.id}:${seed}` : `${a.id}:${seed}:${attempt}`));
export type Gen = { ok: true; inst: Instance } | { ok: false; why: "genfail" | "throw"; msg: string };
/** 생성 제약(정수해·범위 등)을 못 맞춘 표집(GenFail)은 같은 시드에서 파생한 다음 난수 흐름으로 최대 MAX_TRIES 번 다시 뽑는다 — 결과는 (원형, 시드)만으로 결정된다. */
export const MAX_TRIES = 40;
export function generateOne(a: Archetype, seed: number): Gen {
  let last = "";
  for (let t = 0; t < MAX_TRIES; t++) {
    try { return { ok: true, inst: a.generate(seedRng(a, seed, t)) }; }
    catch (e) { if (!(e instanceof GenFail)) return { ok: false, why: "throw", msg: (e as Error).message }; last = (e as Error).message; }
  }
  return { ok: false, why: "genfail", msg: last };
}
export const shingles = (t: string) => {
  const w = t.toLowerCase().replace(/[0-9]+([.,][0-9]+)*/g, "#").replace(/[^a-z#\s]+/g, " ").split(/\s+/).filter(Boolean);
  const s = new Set<string>(); for (let i = 0; i + 3 <= w.length; i++) s.add(w.slice(i, i + 3).join(" ")); return s;
};
export const jaccard = (a: Set<string>, b: Set<string>) => { if (!a.size || !b.size) return 0; let x = 0; for (const v of a) if (b.has(v)) x++; return x / (a.size + b.size - x); };
/** import.ts 와 같은 본문 정의(지문+질문+선지)의 shingle. */
export const bodyShingles = (i: Instance) => shingles(`${i.stimulus} ${i.question} ${i.options.join(" ")}`);

export type SweepStat = { id: string; seeds: number; produced: number; genFail: number; thrown: number; verifyFail: number; failSeeds: { seed: number; why: string }[]; thrownSamples: string[]; variants: Record<string, number>; independent: number; };
export function sweepArchetype(a: Archetype, seeds: number, opts: { seedStart?: number; independentCap?: number } = {}): SweepStat {
  const st: SweepStat = { id: a.id, seeds, produced: 0, genFail: 0, thrown: 0, verifyFail: 0, failSeeds: [], thrownSamples: [], variants: {}, independent: 0 };
  const keep: Set<string>[] = []; const cap = opts.independentCap ?? 400;
  for (let s = (opts.seedStart ?? 0); s < (opts.seedStart ?? 0) + seeds; s++) {
    const g = generateOne(a, s);
    if (!g.ok) { if (g.why === "genfail") st.genFail++; else { st.thrown++; if (st.thrownSamples.length < 3) st.thrownSamples.push(g.msg); } continue; }
    const v = verifyInstance(a, g.inst);
    if (!v.ok) { st.verifyFail++; if (st.failSeeds.length < 5) st.failSeeds.push({ seed: s, why: v.failures.join(" | ").slice(0, 200) }); continue; }
    st.produced++; st.variants[g.inst.variant] = (st.variants[g.inst.variant] ?? 0) + 1;
    if (keep.length < cap) { const sh = bodyShingles(g.inst); if (keep.every((k) => jaccard(k, sh) < 0.6)) keep.push(sh); }
  }
  st.independent = keep.length;
  return st;
}
