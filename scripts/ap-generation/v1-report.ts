// 설계도 검증 라운드(AB 3 + Bio 2 + Micro 2 원형) 원형별 보고: 최초 후보·최초 통과·고유 수·문항군·비용·실패 사유. 수선은 실행하지 않았다(실패 중단 규칙 + 예산).
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { gateDuplicate } from "../../lib/ap-generation/gates";
const root = path.resolve("data/ap/sample-2027"); type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const jl = (f: string) => (existsSync(f) ? readFileSync(f, "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Json) : []);
const runs: [string, string][] = [["v1-ab", "AB"], ["v1-bio", "Bio v1"], ["v2-bio", "Bio v2(설계 수정 1)"], ["v3-bio", "Bio v3(설계 수정 2)"], ["v6-bio", "Bio v6(승인 재검증 1회)"], ["v1-micro", "Micro v1"], ["v2-micro", "Micro v2(설계 수정)"]];
const out: Json[] = [];
for (const [run, label] of runs) {
  const d = path.join(root, run); const v = JSON.parse(readFileSync(path.join(d, "verdicts.json"), "utf-8")) as Json[]; const cells = JSON.parse(readFileSync(path.join(d, "cells.json"), "utf-8")) as Json[]; const packs = JSON.parse(readFileSync(path.join(d, "packs.json"), "utf-8")) as Record<string, Json[]>;
  const bp = existsSync(path.join(d, "blueprint-check.json")) ? JSON.parse(readFileSync(path.join(d, "blueprint-check.json"), "utf-8")) as Record<string, string[]> : {};
  const cost = new Map<string, number>(); for (const f of ["gen", "solve", "review", "review2", "review3", "review4", "difficulty"]) for (const r of jl(path.join(d, `${f}.results.jsonl`))) { const k = String(r.custom_id).replace(/^[srdx]-/, ""); cost.set(k, (cost.get(k) ?? 0) + Number(r.cost ?? 0)); }
  for (const c of cells) {
    const mine = v.filter((x) => x.cellId === c.cellId); const passed = mine.filter((x) => x.passed); const acc: Json[] = []; let exact = 0, near = 0;
    for (const x of passed) { const m = x.key.match(/^(.*)-k(\d+)$/)!; const p = packs[m[1]][Number(m[2])]; const g = gateDuplicate(p as never, acc as never); if (g.includes("exact_duplicate")) { exact++; continue; } if (g.length) near++; acc.push(p); }
    const reasons: Record<string, number> = {}; mine.filter((x) => !x.passed).forEach((x) => x.reasons.forEach((r: string) => { const k = r.split(":")[0]; reasons[k] = (reasons[k] ?? 0) + 1; }));
    out.push({ run: label, archetype: c.archetype, topic: c.topic, skill: c.skill, firstCandidates: mine.length, blueprintFail: mine.filter((x) => (bp[x.key] ?? []).length).length, firstPass: passed.length, uniqueItems: passed.length - exact, families: passed.length - exact - near, costUsd: Number(mine.reduce((a, x) => a + (cost.get(x.key) ?? 0), 0).toFixed(3)), failureReasons: reasons });
  }
}
for (const o of out) console.log(JSON.stringify(o));
