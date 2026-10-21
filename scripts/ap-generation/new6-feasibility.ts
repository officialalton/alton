// 2026-10-19 추가 6세트(US3·WH3·EL3·EL4·LT3·PS3) 재고 타당성. 현재 공개 키(기준 배정 + 교체 계획)·교체돼 빠진 키·같은 칸(cell, 배치 달라도 같은 내용)·같은 문항군을 차단하고 재고만으로 가능한지 본다(읽기 전용).
import { readdirSync, readFileSync } from "node:fs";
import { currentKeys } from "./new6-current";
import { loadUshPool } from "./ush-pool";
import { solveUshSets, verifyUshAssignment, unitSummary } from "./ush-assign";
import { loadWhPool } from "./wh-pool";
import { solveWhSets, verifyWhAssignment } from "./wh-assign";

type P = { key: string; fam: string };
export const cellOf = (k: string) => k.slice(k.indexOf(":") + 1);
/** 교체 계획에서 빠진 키(공개 세트에서 내려간 내용; 같은 주제의 실제 자료판이 공개 중이므로 다시 쓰지 않는다). */
export function removedKeys(swapRe: RegExp | null): Set<string> {
  const out = new Set<string>(); if (!swapRe) return out;
  for (const f of readdirSync("data/ap/stock").filter((x) => swapRe.test(x))) { const p = JSON.parse(readFileSync(`data/ap/stock/${f}`, "utf-8")); for (const s of p.swaps ?? []) { if (s.removeKey) out.add(s.removeKey); for (const k of s.removeKeys ?? []) out.add(k); } }
  return out;
}
export function blockSet(pool: P[], cur: Set<string>, removed: Set<string> = new Set()): Set<string> {
  const cells = new Set([...cur, ...removed].map(cellOf)); const out = new Set([...cur, ...removed]);
  for (const p of pool) if (cells.has(cellOf(p.key))) out.add(p.key);
  const fams = new Set(pool.filter((p) => out.has(p.key)).map((p) => p.fam));
  for (const p of pool) if (fams.has(p.fam)) out.add(p.key);
  return out;
}
const which = process.argv[2];
if (which === "us") {
  const { pool } = loadUshPool({ requireScreen: false }); const re = /^us\d-v\d-.*swap-plan\.json$/; const blocked = blockSet(pool, currentKeys(["exact-assign-ushistory-us1-us2.json"], re), removedKeys(re)); console.log("blocked", blocked.size, "pool", pool.length);
  if (process.argv[3] === "frqfree") for (const p of pool as unknown as { key: string; kind: string }[]) if (p.kind === "frq" && !currentKeys(["exact-assign-ushistory-us1-us2.json"], re).has(p.key)) blocked.delete(p.key);
  const m = solveUshSets(["US3"], pool, { timeMs: 120000, blocked, highs: true, mcOnly: process.argv[3] === "mc", log: console.error });
  const bad = m.res.x.length ? verifyUshAssignment(m.out, blocked) : ["해 없음"]; console.log(m.res.status, bad.join("; ") || "0");
  for (const r of m.out) console.log(r.id, r.sets.length, JSON.stringify(unitSummary(r)), r.frq.map((c) => c.template + c.period).join(","));
}
if (which === "wh") {
  const { pool } = loadWhPool({ requireScreen: false }); const re = /^wh\d-v\d-.*swap-plan\.json$/; const blocked = blockSet(pool, currentKeys(["exact-assign-worldhistory-wh1-wh2.json"], re), removedKeys(re)); console.log("blocked", blocked.size, "pool", pool.length);
  const m = solveWhSets(["WH3"], pool, { timeMs: 120000, blocked, highs: true, mcOnly: process.argv[3] === "mc", log: console.error });
  const bad = m.res.x.length ? verifyWhAssignment(m.out, blocked) : ["해 없음"]; console.log(m.res.status, bad.join("; ") || "0");
  for (const r of m.out) console.log(r.id, r.sets.length, r.frq.map((c) => c.template + c.era).join(","));
}
