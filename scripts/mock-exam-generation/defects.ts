// 해설 결함 목록 + 생성 잔재 전수 검색 + 후보 v3 구성 (2026-10-01). 로컬 파일만 읽는다.
//   npx tsx scripts/mock-exam-generation/defects.ts
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { findResidue } from "../../lib/problem-generation/residue";
import type { FixEntry } from "./position-fix";

const DIR = path.resolve("data/mock-exam-generation/position-fix");
const ROOTS = [path.resolve("data/mock-exam-generation"), path.join(process.env.HOME ?? "", "Developer/ALTON-worktrees/general-problem-pool/data/general-generation")];
const rd = <T>(f: string) => JSON.parse(readFileSync(f, "utf-8")) as T;
function* walk(d: string): Generator<string> {
  for (const n of readdirSync(d)) { const f = path.join(d, n); const st = statSync(f); if (st.isDirectory()) { if (n === "position-fix" || n === "rw-corpus" || n.startsWith("cb-")) continue; yield* walk(f); } else if (n.endsWith(".json") && st.size < 60e6) yield f; }
}
type Hit = { gid: string; files: Set<string>; fields: Set<string>; matches: Set<string> };

function scanResidue() {
  const hits = new Map<string, Hit>();
  const visit = (o: unknown, f: string) => {
    if (!o || typeof o !== "object") return;
    const r = o as { gid?: string; problem?: Record<string, unknown> };
    if (r.gid && r.problem && typeof r.problem === "object") {
      const found = findResidue(r.problem as never);
      if (found.length) { const h = hits.get(r.gid) ?? { gid: r.gid, files: new Set(), fields: new Set(), matches: new Set() }; h.files.add(path.relative(process.cwd(), f).replace(/^.*general-generation\//, "general:")); found.forEach((x) => { h.fields.add(x.field); h.matches.add(x.match); }); hits.set(r.gid, h); }
    }
  };
  for (const root of ROOTS) if (existsSync(root)) for (const f of walk(root)) {
    let d: unknown; try { d = rd(f); } catch { continue; }
    if (Array.isArray(d)) d.forEach((x) => visit(x, f)); else visit(d, f);
  }
  return hits;
}

const SHUFFLE_INDUCED = ["06a3ced4", "a19ad79c", "daf80509", "9cedb4e8", "b43c5755", "7f8bd0b4", "9d4af989", "4eaf03a4", "9eb0fc6f", "a397f4d3", "021df67e", "43f4e230", "a297b352"];
function main() {
  const plan = rd<FixEntry[]>(path.join(DIR, "plan.json"));
  const inPlan = new Set(plan.map((e) => e.gid));
  const sub = rd<{ chunk: number; gid: string; ok: boolean; severity: string; issue: string }[]>(path.join(DIR, "subverify/all-results.json"));
  const residue = scanResidue();
  const residueGids = new Set(residue.keys());
  const rows = {
    residue: [...residue.values()].map((h) => ({ gid: h.gid, type: "생성 잔재", inPlan: inPlan.has(h.gid), fields: [...h.fields], matches: [...h.matches], foundIn: [...h.files].slice(0, 6) })),
    shuffleInducedBlocking: sub.filter((s) => !s.ok && s.severity === "blocking" && SHUFFLE_INDUCED.some((p) => s.gid.startsWith(p))).map((s) => ({ gid: s.gid, type: "섞기로 생긴 오류(규칙 보강 대상)", issue: s.issue })),
    preExisting: [
      ...sub.filter((s) => !s.ok && s.severity === "blocking" && !SHUFFLE_INDUCED.some((p) => s.gid.startsWith(p)) && !residueGids.has(s.gid)).map((s) => ({ gid: s.gid, type: "해설-선택지 불일치 등 기존 결함(blocking)", issue: s.issue })),
      ...sub.filter((s) => !s.ok && s.severity === "minor").map((s) => ({ gid: s.gid, type: "경미한 해설 결함(minor)", issue: s.issue })),
    ],
  };
  writeFileSync(path.join(DIR, "explanation-defects.json"), JSON.stringify({ generatedAt: new Date().toISOString(), counts: { residueGids: rows.residue.length, residueInPlan: rows.residue.filter((r) => r.inPlan).length, shuffleInducedBlocking: rows.shuffleInducedBlocking.length, preExisting: rows.preExisting.length }, ...rows }, null, 1));

  // 후보 v3: 이전에 검수를 통과했고(서브 에이전트 ok/minor 또는 AI 검증 통과) after 가 새 계획에서 불변인 항목만. 잔재·blocking 제외.
  const prevVerified = rd<FixEntry[]>(path.join(DIR, "apply-candidates.v2-verified223.json"));
  const prevStatic = rd<FixEntry[]>(path.join(DIR, "apply-candidates.v2-static891.json"));
  const preBlocking = new Set(rows.preExisting.filter((x) => x.type.includes("blocking")).map((x) => x.gid));
  const inducedGids = new Set(rows.shuffleInducedBlocking.map((x) => x.gid));
  const subBy = new Map(sub.map((s) => [s.gid, s]));
  const reviewed = new Map<string, { e: FixEntry; how: string }>();
  for (const e of prevVerified) reviewed.set(e.gid, { e, how: "ai_verified_223" });
  for (const e of prevStatic) { const s = subBy.get(e.gid); if (s && (s.ok || s.severity === "minor")) reviewed.set(e.gid, { e, how: s.ok ? "subagent_pass" : "subagent_minor_only" }); }
  const v3: unknown[] = [], need: unknown[] = [];
  const same = (a?: FixEntry["after"], b?: FixEntry["after"]) => !!a && !!b && JSON.stringify(a) === JSON.stringify(b);
  for (const e of plan) {
    if (e.status !== "shuffle" || !e.after) continue;
    if (residueGids.has(e.gid)) continue;
    if (preBlocking.has(e.gid)) continue; // 기존 결함(blocking) — 해설 결함 목록으로 관리, 후보 아님
    const r = reviewed.get(e.gid);
    if (r && same(r.e.after, e.after)) v3.push({ ...e, verification: r.how });
    else need.push({ ...e, verification: "static_only_needs_review", reason: inducedGids.has(e.gid) ? "섞기 오류를 규칙 보강으로 고친 뒤 재검수" : r ? "새 규칙에서 after 가 달라짐(이전 검수 무효)" : "새로 후보가 됨(이전 검수 없음)" });
  }
  writeFileSync(path.join(DIR, "apply-candidates.json"), JSON.stringify(v3));
  writeFileSync(path.join(DIR, "apply-candidates.needs-rereview.json"), JSON.stringify(need));
  const summary = { v3Count: v3.length, needsRereview: need.length, byReason: (need as { reason: string }[]).reduce<Record<string, number>>((m, x) => ((m[x.reason] = (m[x.reason] ?? 0) + 1), m), {}), byHow: (v3 as { verification: string }[]).reduce<Record<string, number>>((m, x) => ((m[x.verification] = (m[x.verification] ?? 0) + 1), m), {}), droppedFromPrevious: [...reviewed.keys()].filter((g) => !v3.some((x) => (x as FixEntry).gid === g)).length, residueExcludedFromPlan: rows.residue.filter((r) => r.inPlan).length };
  writeFileSync(path.join(DIR, "apply-summary.json"), JSON.stringify(summary, null, 1));
  console.log(JSON.stringify({ defects: JSON.parse(readFileSync(path.join(DIR, "explanation-defects.json"), "utf-8")).counts, ...summary }, null, 1));
}
main();
