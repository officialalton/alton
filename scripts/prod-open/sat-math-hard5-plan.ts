// SAT 공개 30세트 수학 hard 재배치 계획(2026-10-20, 오너 최종 구성). DB 접근 없음 — 덤프·후보 본문·신규 hard 파일만 읽는다.
//   npx tsx scripts/prod-open/sat-math-hard5-plan.ts --dump tmp/bank-dump-math/dump.json --cand tmp/bank-dump-math/cand-content.json \
//        --new data/mock-exam-generation/sat-math-hard5-20261020/final/adopted-all.json --out data/mock-exam-generation/sat-math-hard5-20261020/final
// 세트당 최종 구성(22문항 모듈): 수학 1 = easy 3 / medium 14 / hard 5, 수학 2 쉬운 경로 = easy 3 / medium 14 / hard 5, 수학 2 어려운 경로 = medium 11 / hard 11.
// 즉 수학 1·쉬운 경로 easy 5개 -> hard, 어려운 경로 medium 3개 -> hard. 같은 칸(스킬·도메인·형식) 안에서만 교체해 스킬·도메인 분포가 그대로다.
// 수학 상향 초안(44번이 만든 draft 30개, 폐기 예정)은 사용 중으로 세지 않는다. 후보는 오류신고 규칙·π 혼재·영어 해설 없음·어색한 서두/문법(awkward-framing)을 모두 통과해야 한다.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { planSatErrorReportFix } from "../../lib/audit-fix/sat-error-report-1018";
import { findAwkwardFraming } from "../../lib/problem-generation/awkward-framing";

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const HARD_ADD = Number(arg("--hard-add", "3")); const M1_HARD = Number(arg("--m1-hard", "5")); const LOW_HARD = Number(arg("--lower-hard", "5"));
const isDiscardDraft = (s: any) => s.status === "draft" && /^SAT Practice Test \d+$/.test(s.name);
const dump = JSON.parse(readFileSync(arg("--dump")!, "utf8")); const cand = JSON.parse(readFileSync(arg("--cand")!, "utf8")) as any[];
const fresh = JSON.parse(readFileSync(arg("--new")!, "utf8")) as any[];
const P = new Map<string, any>(dump.problems.map((p: any) => [p.id, p]));
const live = dump.sets.filter((s: any) => /^SAT Practice Test \d+$/.test(s.name) && s.status === "published" && !s.archived_at).sort((a: any, b: any) => Number(a.name.match(/\d+/)![0]) - Number(b.name.match(/\d+/)![0]));
const liveAll = new Set<string>(dump.sets.filter((s: any) => !s.archived_at && s.status !== "failed" && !isDiscardDraft(s)).map((s: any) => s.id));
const piMixed = (r: any) => /in terms of (π|pi)/i.test(`${r.passage ?? ""} ${r.question ?? ""}`) && !!r.options && r.options.some((o: string) => /π/.test(o)) && r.options.some((o: string) => !/π/.test(o));

type Cand = { key: string; problemId?: string; gid?: string; skill: string; domain: string; format: string; group: string | null; sub: string | null; difficulty: string; fresh: boolean };
const cands: Cand[] = [];
let excluded = 0; let noEn = 0; let awk = 0; let awkFresh = 0;
for (const r of cand) {
  if (planSatErrorReportFix(r) || piMixed(r)) { excluded++; continue; }
  if (findAwkwardFraming(`${r.passage ?? ""} ${r.question ?? ""}`)) { awk++; continue; }
  if (!r.explanation_en) { noEn++; continue; } // 영어 해설 없는 옛 문항은 새 칸에 쓰지 않는다(영어 기본 원칙)
  cands.push({ key: r.problem_id, problemId: r.problem_id, skill: r.skill_code, domain: r.sat_domain, format: r.format, group: r.similarity_group ?? null, sub: r.subpattern ?? null, difficulty: r.difficulty, fresh: false });
}
const DOMAIN_OF: Record<string, string> = {}; for (const i of dump.items) if (i.section === "math") DOMAIN_OF[i.skill_code] = i.sat_domain;
for (const r of fresh) { if (findAwkwardFraming(`${r.problem?.stimulus ?? r.problem?.passage ?? ""} ${r.problem?.question ?? ""}`)) { awkFresh++; continue; } cands.push({ key: r.gid, gid: r.gid, skill: r.skill, domain: DOMAIN_OF[r.skill] ?? r.domain, format: r.format, group: r.subpattern ? `c:${r.skill}:${String(r.subpattern).trim()}` : (r.quality?.mockExamGeneration?.archetypeId ?? null), /* DB 트리거 problem_similarity_key: compiler+subpattern -> c:<skill>:<subpattern> */ sub: r.subpattern ?? null, difficulty: r.difficulty, fresh: true }); }

type Slot = { setName: string; setId: string; itemId: string; section: string; position: number; oldVersionId: string; oldProblemId: string; moduleKey: string; route: string | null; skill: string; domain: string; format: string; from: string; to: string };
const setItems = new Map<string, any[]>(); for (const s of live) setItems.set(s.id, dump.items.filter((i: any) => i.exam_set_id === s.id));
const groupsOf = new Map<string, Map<string, number>>(); // setId -> group -> count (모든 섹션)
const regroup = (id: string, items: any[]) => { const m = new Map<string, number>(); for (const i of items) { const g = P.get(i.problem_id)?.similarity_group; if (g) m.set(g, (m.get(g) ?? 0) + 1); } groupsOf.set(id, m); };
for (const s of live) regroup(s.id, setItems.get(s.id)!);
// 보관되지 않은 다른 세트(초안·AP 고정 세트 제외 SAT 만)도 공유 계산에 넣는다.
const otherSat = dump.sets.filter((s: any) => liveAll.has(s.id) && !live.some((l: any) => l.id === s.id) && s.format !== "ap_fixed");
for (const s of otherSat) regroup(s.id, dump.items.filter((i: any) => i.exam_set_id === s.id));
const sharedCount = (a: string, b: string) => { let c = 0; for (const g of groupsOf.get(a)!.keys()) if (groupsOf.get(b)!.has(g)) c++; return c; };
const base = new Map<string, number>(); const allIds = [...groupsOf.keys()];
for (const a of live) for (const b of allIds) if (a.id !== b) base.set(`${a.id}|${b}`, sharedCount(a.id, b));
const maxBase = Math.max(0, ...base.values());

const taken = new Set<string>(); const slotsOf = new Map<string, Slot[]>(); const swaps: (Slot & { cand: Cand })[] = [];
const mk = (s: any, i: any, from: string, to: string): Slot => ({ setName: s.name, setId: s.id, itemId: i.id, section: i.section, position: i.position, oldVersionId: i.problem_version_id, oldProblemId: i.problem_id, moduleKey: i.module_key, route: i.route ?? null, skill: i.skill_code, domain: i.sat_domain, format: P.get(i.problem_id)?.format ?? "mc", from, to });
const used = new Set<string>(); // 이미 교체한 칸(itemId)
const canUse = (s: any, c: Cand, oldGroup: string | null) => {
  if (taken.has(c.key)) return false;
  const mine = groupsOf.get(s.id)!;
  if (c.group && c.group !== oldGroup && mine.has(c.group)) return false;
  if (c.group && c.group !== oldGroup) for (const o of allIds) { if (o === s.id) continue; if (!groupsOf.get(o)!.has(c.group)) continue; if (sharedCount(s.id, o) + 1 > Math.max(15, base.get(`${s.id}|${o}`) ?? 0)) return false; }
  return true;
};
const commit = (s: any, slot: Slot, c: Cand, oldGroup: string | null) => {
  taken.add(c.key); used.add(slot.itemId); swaps.push({ ...slot, cand: c });
  const mine = groupsOf.get(s.id)!; if (oldGroup) { const n = (mine.get(oldGroup) ?? 0) - 1; if (n <= 0) mine.delete(oldGroup); else mine.set(oldGroup, n); } if (c.group) mine.set(c.group, (mine.get(c.group) ?? 0) + 1);
};
const supplyLeft = (skill: string, fmt: string, diff: string) => cands.filter((c) => c.difficulty === diff && c.skill === skill && c.format === fmt && !taken.has(c.key)).length;
const pick = (s: any, slot: Slot, diff: string, oldGroup: string | null): Cand | null => {
  const pool = cands.filter((c) => c.difficulty === diff && c.skill === slot.skill && c.format === slot.format && c.domain === slot.domain && canUse(s, c, oldGroup));
  if (!pool.length) return null;
  const setSubs = new Set(swaps.filter((w) => w.setName === s.name).map((w) => w.cand.sub)); // 같은 세트에 이미 들어온 세부 패턴은 뒤로
  // 신규 생성분은 기존 hard 재고가 없는 스킬을 채울 때 우선, 그 외 기존 재고 우선(신규를 아껴 예비로 둔다).
  const hasOld = pool.some((c) => !c.fresh);
  pool.sort((a, b) => (Number(setSubs.has(a.sub)) - Number(setSubs.has(b.sub))) || (hasOld ? Number(a.fresh) - Number(b.fresh) : 0) || (a.key < b.key ? -1 : 1));
  return pool[0];
};

// 모듈 안 순번(position 오름차순, 1-based). 새 hard 는 후반(순번 > LATE_FROM) 칸을 우선 교체한다(오너: 후반 위치 중심). 후반 칸이 모자라면 나머지 칸으로 채운다.
const LATE_FROM = Number(arg("--late-from", "11"));
const rankOf = new Map<string, number>();
for (const s of live) { const g = new Map<string, any[]>(); for (const i of setItems.get(s.id)!) { const k = `${i.section}|${i.module_key}|${i.route ?? ""}`; (g.get(k) ?? g.set(k, []).get(k)!).push(i); } for (const arr of g.values()) arr.sort((a, b) => a.position - b.position).forEach((i, n) => rankOf.set(i.id, n + 1)); }
const late = (sel: (i: any) => boolean) => (i: any) => sel(i) && (rankOf.get(i.id) ?? 0) > LATE_FROM;
function round(label: string, selector: (i: any) => boolean, toDiff: string, perSet: number, total: number, fallback?: (i: any) => boolean) {
  // 스킬별 쿼터: 이 유형 칸 수에 비례해 total 개를 배분(가장 큰 나머지).
  const bySkill = new Map<string, number>(); for (const s of live) for (const i of setItems.get(s.id)!) if (selector(i)) bySkill.set(i.skill_code, (bySkill.get(i.skill_code) ?? 0) + 1);
  const sum = [...bySkill.values()].reduce((a, b) => a + b, 0);
  const quota = new Map<string, number>(); let alloc = 0; const rema: [string, number][] = [];
  for (const [k, v] of bySkill) { const q = (v * total) / sum; quota.set(k, Math.floor(q)); alloc += Math.floor(q); rema.push([k, q - Math.floor(q)]); }
  rema.sort((a, b) => b[1] - a[1]); for (let k = 0; alloc < total; k++, alloc++) quota.set(rema[k % rema.length][0], quota.get(rema[k % rema.length][0])! + 1);
  const perSetCount = new Map<string, number>(); const unmet: string[] = [];
  const skills = [...quota.entries()].sort((a, b) => b[1] - a[1]);
  for (const [skill, q] of skills) {
    let left = q; let guard = 0;
    while (left > 0 && guard++ < 400) {
      // 이 스킬 칸을 가진 세트 중 아직 perSet 미달·교체 수가 가장 적은 세트부터 라운드 로빈
      const order = live.filter((s: any) => (perSetCount.get(s.id) ?? 0) < perSet).sort((a: any, b: any) => (perSetCount.get(a.id) ?? 0) - (perSetCount.get(b.id) ?? 0) || Number(a.name.match(/\d+/)![0]) - Number(b.name.match(/\d+/)![0]));
      let done = false;
      for (const s of order) {
        const its = setItems.get(s.id)!.filter((i) => selector(i) && i.skill_code === skill && !used.has(i.id)).sort((a, b) => (rankOf.get(b.id) ?? 0) - (rankOf.get(a.id) ?? 0));
        for (const i of its) {
          const slot = mk(s, i, i.difficulty, toDiff); const og = P.get(i.problem_id)?.similarity_group ?? null; const c = pick(s, slot, toDiff, og);
          if (!c) continue; commit(s, slot, c, og); perSetCount.set(s.id, (perSetCount.get(s.id) ?? 0) + 1); left--; done = true; break;
        }
        if (done) break;
      }
      if (!done) { unmet.push(`${label}:${skill}:${left}`); break; }
    }
  }
  // 남은 세트별 부족분: 아무 스킬이나 후보가 있는 칸으로 채운다.
  for (const s of live) {
    while ((perSetCount.get(s.id) ?? 0) < perSet) {
      let ok = false;
      const its = setItems.get(s.id)!.filter((i) => (fallback ?? selector)(i) && !used.has(i.id)).sort((a, b) => ((rankOf.get(b.id) ?? 0) > LATE_FROM ? 1 : 0) - ((rankOf.get(a.id) ?? 0) > LATE_FROM ? 1 : 0) || supplyLeft(b.skill_code, P.get(b.problem_id)?.format ?? "mc", toDiff) - supplyLeft(a.skill_code, P.get(a.problem_id)?.format ?? "mc", toDiff));
      for (const i of its) { const slot = mk(s, i, i.difficulty, toDiff); const og = P.get(i.problem_id)?.similarity_group ?? null; const c = pick(s, slot, toDiff, og); if (!c) continue; commit(s, slot, c, og); perSetCount.set(s.id, (perSetCount.get(s.id) ?? 0) + 1); ok = true; break; }
      if (!ok) { unmet.push(`${label}:${s.name}:fill`); break; }
    }
  }
  return unmet;
}
const isHigherMedium = (i: any) => i.section === "math" && i.module_key === "math_m2" && i.route === "higher" && i.difficulty === "medium";
const isM1Easy = (i: any) => i.section === "math" && i.module_key === "math_m1" && i.difficulty === "easy";
const isLowerEasy = (i: any) => i.section === "math" && i.module_key === "math_m2" && i.route === "lower" && i.difficulty === "easy";
const unmet = [...round("higher", late(isHigherMedium), "hard", HARD_ADD, HARD_ADD * live.length, isHigherMedium), ...round("m1", late(isM1Easy), "hard", M1_HARD, M1_HARD * live.length, isM1Easy), ...round("lower", late(isLowerEasy), "hard", LOW_HARD, LOW_HARD * live.length, isLowerEasy)];

// 결과 요약
const dist = (modKey: string, route: string | null, after: boolean) => { const o: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
  for (const s of live) for (const i of setItems.get(s.id)!) { if (i.section !== "math" || i.module_key !== modKey || (i.route ?? null) !== route) continue; const sw = after ? swaps.find((w) => w.itemId === i.id) : undefined; o[sw ? sw.to : i.difficulty]++; } return o; };
const summary = Object.fromEntries([["math_m1", null], ["math_m2", "lower"], ["math_m2", "higher"]].map(([m, r]) => [`${m}${r ? "/" + r : ""}`, { before: dist(m as string, r as string | null, false), after: dist(m as string, r as string | null, true) }]));
const bySet = live.map((s: any) => ({ name: s.name, higher: swaps.filter((w) => w.setName === s.name && w.moduleKey === "math_m2" && w.route === "higher").length, m1: swaps.filter((w) => w.setName === s.name && w.moduleKey === "math_m1").length, lower: swaps.filter((w) => w.setName === s.name && w.route === "lower").length }));
const bySkill: Record<string, { higher: number; m1: number; lower: number; freshUsed: number }> = {}; for (const w of swaps) { const k = (bySkill[w.skill] ??= { higher: 0, m1: 0, lower: 0, freshUsed: 0 }); if (w.moduleKey === "math_m1") k.m1++; else if (w.route === "lower") k.lower++; else k.higher++; if (w.cand.fresh) k.freshUsed++; }
const spec = live.map((s: any) => ({ name: s.name, repointProblemIds: [], newMeta: true, slots: swaps.filter((w) => w.setName === s.name).map((w) => ({ section: w.section, position: w.position, oldVersionId: w.oldVersionId, oldProblemId: w.oldProblemId, ...(w.cand.problemId ? { newProblemId: w.cand.problemId } : { newGid: w.cand.gid }), moduleKey: w.moduleKey, route: w.route, skill: w.skill, from: w.from, to: w.to, format: w.format })) })).filter((x: { slots: unknown[] }) => x.slots.length);
const outDir = path.resolve(arg("--out")!); mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "old-set-specs.json"), JSON.stringify(spec));
const rep = { sets: live.length, excludedByScan: excluded, excludedNoExplanationEn: noEn, excludedAwkwardBank: awk, excludedAwkwardFresh: awkFresh, candidates: cands.length, swaps: swaps.length, unmet, maxBaseShared: maxBase, summary, bySet, bySkill, freshUsed: swaps.filter((w) => w.cand.fresh).length };
writeFileSync(path.join(outDir, "plan-report.json"), JSON.stringify(rep, null, 1));
console.log(JSON.stringify(rep, null, 1));
