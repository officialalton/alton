// EL4 재배정(2026-10-21, 무료·읽기 전용). 차단 목록은 DB 스냅샷(data/ap/stock/el4-reassign-db-snapshot-2026-10-21.json: 원격 비프로덕션 DB 읽기 전용 SELECT)에서 읽은 공개 세트의 모든 키·문제 ID 이다.
//   npx tsx scripts/ap-generation/el4-reassign.ts [--conservative] [--no-pins] [--write data/ap/stock/exact-assign-el-el4-v2.json] [--md out.md]
// 보수적 차단(archived 포함)은 이번 편성의 선택이며 서비스 전체 정책이 아니다.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { solveElSets, verifyElAssignment, toReportSet, type ElResult } from "./el-assign";
import { loadElPool } from "./el-pool";
import { planElDraftSet } from "../../lib/ap-admin/assemble-elang-draft";
import { itemContentHash } from "../../lib/ap-generation/verify-guard";
import type { FullSetUsage, PoolRow } from "../../lib/ap-admin/assemble-draft";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const has = (n: string) => process.argv.includes(n);
type SnapPool = PoolRow & { renderHash: string | null; screenHash: string | null; item_family_id: string; content_key: string; duplicate_of?: string | null; defect_flags?: unknown };
type Snap = { pool: SnapPool[]; sets: Record<string, { name: string; status: string; version_no: number; problemIds: string[]; candidateKeys: string[] }> };
const snap = JSON.parse(readFileSync("data/ap/stock/el4-reassign-db-snapshot-2026-10-21.json", "utf-8")) as Snap;
const dbBy = new Map(snap.pool.map((r) => [r.candidate_key, r]));
const conservative = has("--conservative");

const setsAll = Object.entries(snap.sets);
const pubSets = setsAll.filter(([, s]) => s.status !== "archived");
const blockSets = conservative ? setsAll : pubSets;
const blockedKeys = new Set(blockSets.flatMap(([, s]) => s.candidateKeys));
const blockedPids = new Set(blockSets.flatMap(([, s]) => s.problemIds));
for (const r of snap.pool) if ((r.ap_candidate_problems ?? []).some((p) => blockedPids.has(p.problem_id))) blockedKeys.add(r.candidate_key);

const rawBy = new Map<string, Record<string, unknown>>();
for (const f of readdirSync("data/ap/stock").filter((x) => /^(el|englang).*-items\.json$/.test(x))) for (const r of JSON.parse(readFileSync(`data/ap/stock/${f}`, "utf-8")) as { stockKey: string; payload: Record<string, unknown> }[]) if (!rawBy.has(r.stockKey)) rawBy.set(r.stockKey, r.payload);
// 같은 계보(개정본) 식별: FRQ 는 제목, MC 는 첫 문항 발문+지문 앞부분 해시. 공개 세트 문항의 개정본·원본도 막는다(el-rv 가 p1-b2 의 개정본인 경우 등).
const lineage = (k: string): string | null => { const p = rawBy.get(k); if (!p) return null; const it = Array.isArray(p.items) ? (p.items as { stem?: string }[])[0] : null; const t = it ? String(it.stem ?? "") + String(p.stimulus ? JSON.stringify(p.stimulus).slice(0, 300) : "") : String(p.title ?? ""); return t ? createHash("sha1").update(t).digest("hex") : null; };
// --pending-key: DB 에 아직 적재되지 않았지만 로컬 렌더 보고서·화면 증거(격리 스택)가 현재 내용 해시와 일치하는 수선된 키. 가상 DB 행(가짜 문제 ID)으로 취급하고, 렌더 보고서·로컬 증거 해시 일치를 반드시 확인한다. 총괄의 실제 적재 뒤에는 DB 행으로 다시 검증해야 한다.
const pendingKey = arg("--pending-key");
let pendingHashOk = true;
if (pendingKey) {
  const lh = itemContentHash(rawBy.get(pendingKey) ?? null);
  const rep = (JSON.parse(readFileSync("data/ap/render-check/report.json", "utf-8")) as { results?: { key: string; contentHash: string }[]; rows?: { key: string; contentHash: string }[] });
  const rr = (rep.results ?? rep.rows ?? Object.values(rep).flat().filter((x): x is { key: string; contentHash: string } => !!x && typeof x === "object" && (x as { key?: string }).key === pendingKey)).find((x) => x.key === pendingKey);
  const ev = (JSON.parse(readFileSync("data/ap/screen-evidence/evidence-el-r19.json", "utf-8")) as { entries: { candidate_key: string; content_hash: string }[] }).entries.filter((e) => e.candidate_key === pendingKey);
  pendingHashOk = rr?.contentHash === lh && ev.length >= 2 && ev.every((e) => e.content_hash === lh);
  console.log(`pending ${pendingKey}: 로컬 해시 ${lh.slice(0, 12)} 렌더보고서 ${rr?.contentHash === lh ? "=" : "!="} 화면증거(${ev.length}) ${ev.every((e) => e.content_hash === lh) ? "=" : "!="} → ${pendingHashOk ? "ok" : "불일치"}`);
  const row = { candidate_key: pendingKey, kind: "frq_bundle", keyword_code: "U9.3", difficulty_provisional: "exam_prep", purpose: "mock_exam", is_current: true, render_verified: true, screen_verified: true, content_key: "ap_english_language:U9.3", item_family_id: `fam:${pendingKey}`, duplicate_of: null, defect_flags: [], renderHash: lh, screenHash: lh, ap_candidate_problems: [{ item_index: 0, problem_id: "00000000-0000-4000-8000-0000000000f1", problem_version_id: "00000000-0000-4000-8000-0000000000f2" }] } as unknown as SnapPool;
  snap.pool.push(row); dbBy.set(pendingKey, row);
}
const assume = arg("--assume-key"); // 가능성 점검 전용: 화면 증거·DB 적재가 없는 키를 있는 것으로 보고 해가 나는지만 본다(기록하지 않음).
const { pool: local, all: localAll } = loadElPool(); if (assume) { const a = localAll.find((c) => c.key === assume); if (a && !local.includes(a)) local.push(a); }
const famOf = new Map(local.map((c) => [`${c.kind}|${c.key}`, c.fam]));
// 공개 세트에 쓰인 문항군(구조 look-alike 포함)도 막는다: 같은 군을 다른 시험에 다시 쓰지 않는다.
const pubFams = new Set<string>();
for (const [, s] of pubSets) for (const k of s.candidateKeys) { for (const kind of ["mc", "frq"]) { const f = famOf.get(`${kind}|${k}`); if (f) pubFams.add(`${kind}|${f}`); } }
const blocked = new Set(blockedKeys);
for (const c of local) if (pubFams.has(`${c.kind}|${c.fam}`)) blocked.add(c.key);
// DB 에서 변환·검증이 끝난 것만 쓴다.
const ready = (k: string) => { if (k === assume) return true; const r = dbBy.get(k); const c = local.find((x) => x.key === k); if (!r || !c) return false; const want = c.kind === "mc" ? c.members.length : 1; return r.purpose === "mock_exam" && r.is_current && r.render_verified && r.screen_verified && (r.ap_candidate_problems ?? []).length === want && !r.duplicate_of && (r.defect_flags as unknown as unknown[] | null ?? []).length === 0; };
const pubLineages = new Set<string>(); for (const [, st] of pubSets) for (const k of st.candidateKeys) { const l = lineage(k); if (l) pubLineages.add(l); }
let lineageBlocked = 0; for (const c of local) { const l = lineage(c.key); if (l && pubLineages.has(l) && !blocked.has(c.key)) { blocked.add(c.key); lineageBlocked++; } }
const notReady = local.filter((c) => !ready(c.key));
for (const c of notReady) blocked.add(c.key);

const old = JSON.parse(readFileSync("data/ap/stock/exact-assign-el-el3-el4.json", "utf-8")) as { sets: { id: string; mcA: string[]; frqA: string[] }[] };
const oldEl4 = old.sets.find((s) => s.id === "EL4")!;
const pins = has("--no-pins") ? {} : { mc: { EL4: oldEl4.mcA.filter((k) => !blocked.has(k)) }, frq: { EL4: oldEl4.frqA.filter((k) => !blocked.has(k)) } };
const m = solveElSets(["EL4"], local, { timeMs: 120000, official: true, blocked, mcPins: pins.mc, frqPins: pins.frq, log: () => {} });
console.log(`mode=${conservative ? "conservative(archived 포함)" : "non-archived"} blockedKeys(공개 세트 키+문제 겹침)=${blockedKeys.size} blockedProblemIds=${blockedPids.size} blockedFamKeys(+문항군)=${blocked.size - blockedKeys.size - lineageBlocked - notReady.length} lineageBlocked(개정본/원본)=${lineageBlocked} notReadyInDb=${notReady.length} 재고=${local.length} status=${m.res.status}`);
if (!m.res.x.length) {
  const left = local.filter((c) => !blocked.has(c.key)); const cnt = (f: (c: (typeof local)[number]) => boolean) => left.filter(f).length;
  console.log(`해 없음. 남은 재고: FRQ q1 ${cnt((c) => c.frqType === "q1")} q2 ${cnt((c) => c.frqType === "q2")} q3 ${cnt((c) => c.frqType === "q3")} / MC 읽기묶음 ${cnt((c) => c.kind === "mc" && c.section === "reading")} 글쓰기묶음 ${cnt((c) => c.kind === "mc" && c.section === "writing")}`);
  for (const c of local.filter((x) => x.frqType === "q1")) { const l = lineage(c.key); console.log(`  q1 ${c.key} blockedKey=${blockedKeys.has(c.key)} lineage=${!!(l && pubLineages.has(l))} fam=${pubFams.has(`frq|${c.fam}`)} dbReady=${ready(c.key)}`); }
  console.log(`q1 후보:${left.filter((c) => c.frqType === "q1").map((c) => c.key).join(", ")}`);
  process.exit(1);
}
const bad = verifyElAssignment(m.out, blocked);
const el4: ElResult = m.out[0]; if (assume) { console.log(`assume ${assume}: 독립 검증기 위반=${bad.length ? bad.join("; ") : "0"} 선택 FRQ=${el4.frq.map((c) => c.key).join(", ")}`); process.exit(0); }
const rep = toReportSet(el4);
// 관리자 화면과 같은 코드 경로(planElDraftSet): DB 풀 행 + 비보관 풀 세트 사용 현황
const existing: FullSetUsage[] = pubSets.map(([id, s]) => ({ id, name: s.name, status: s.status, label: "full_practice", problemIds: s.problemIds, candidateKeys: s.candidateKeys }));
const plan = assume ? { ok: false, problems: ["assume 모드"], items: [] as unknown[] } : planElDraftSet({ setId: "EL4", keys: { mcA: rep.mcA, mcB: [], frqA: rep.frqA, frqB: [] }, hasVirtual: false, name: "AP English Language — Practice Exam 4", pool: snap.pool, existingFullSets: existing, stock: local, subject: "ap_english_language" });
console.log(`독립 검증기 위반: ${bad.length ? bad.join("; ") : "0"}`);
console.log(`planElDraftSet(관리자 검증과 동일 코드): ok=${plan.ok} 위반=${plan.problems.length ? plan.problems.join(" | ") : "0"} items=${plan.items.length}`);
// 증거·해시 대조
const evHash = new Map<string, Set<string>>();
for (const f of readdirSync("data/ap/screen-evidence").filter((x) => /^evidence-.*\.json$/.test(x))) for (const e of (JSON.parse(readFileSync(`data/ap/screen-evidence/${f}`, "utf-8")) as { entries: { candidate_key: string; content_hash: string }[] }).entries) (evHash.get(e.candidate_key) ?? evHash.set(e.candidate_key, new Set()).get(e.candidate_key)!).add(e.content_hash);
const rows: string[] = []; let hashBad = 0;
for (const k of [...rep.mcA, ...rep.frqA]) {
  const r = dbBy.get(k)!; const c = local.find((x) => x.key === k)!; const lh = itemContentHash(rawBy.get(k) ?? null);
  const ok = r.renderHash === lh && r.screenHash === lh && (evHash.get(k)?.has(lh) ?? false); if (!ok) hashBad++;
  rows.push(`| ${k} | ${(r.ap_candidate_problems ?? []).map((p) => p.problem_id.slice(0, 8)).join(",")} | ${c.kind === "mc" ? `${c.members.length}문항 ${c.section}` : c.frqType} | ${c.renderType} | ${r.render_verified && r.screen_verified ? "yes" : "NO"} | ${lh.slice(0, 12)} ${ok ? "=" : "!="} DB 렌더/화면/로컬증거 | ${c.fam.slice(0, 40)} |`);
}
console.log(`해시 불일치 ${hashBad}`); console.log(rows.join("\n"));
console.log(`변경: EL4 구 mcA ${JSON.stringify(oldEl4.mcA)} frqA ${JSON.stringify(oldEl4.frqA)}\n신 mcA ${JSON.stringify(rep.mcA)} frqA ${JSON.stringify(rep.frqA)}`);
const el3Hash = createHash("sha256").update(JSON.stringify(old.sets.find((s) => s.id === "EL3"))).digest("hex");
console.log(`EL3 항목 sha256(원 파일, 변경 없음) ${el3Hash}`);
const w = arg("--write"); if (w && !bad.length && plan.ok && !hashBad && pendingHashOk) { writeFileSync(w, JSON.stringify({ sets: [rep] }, null, 1)); console.log(`기록 ${w}`); }
const md = arg("--md"); if (md) writeFileSync(md, rows.join("\n"));
