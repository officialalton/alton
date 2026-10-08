// SAT Practice Test 1..13 통합 재조정 플래너(2026-10-08). **DB 접근 없음 — 덤프·weights·topics JSON 만 읽고 JSON/마크다운 계획만 쓴다. 원격 적용은 하지 않는다.**
// 게시 세트(T1..T9)는 응시 기록이 있으면 문항이 동결되므로, 결과는 "수리된 새 사본"(세트마다 147문항) + "보관할 옛 세트" + "새 세트 T10..T13" 이다.
//   (a) 소재 상한 위반 수리(모듈 1 / 54문항 경로 2 / 비문학 family 4, 설정 가능): 같은 칸(영역·난이도·형식) 미사용 문항으로 교체, 같은 skill 우선, 후보가 전혀 없을 때만 skill fallback(전부 목록화)
//   (b) 보관·미확정 문제 / 세트 간 중복 / 게시 버전 없음 문항 교체(같은 칸 미사용 문항)
//   (c) 남은 미사용 재고로 새 세트 조립 — assemble-unique.ts(planUnique)의 제약 전부: 전체 컬렉션 중복 0, 유사문항 그룹 공유 <= 15 / 그룹 상한, 30 skill x 3 난이도 커버리지, 소재 상한, 과목 구성 소프트 목표
//   (d) 수리와 새 세트는 하나의 `taken` 집합을 공유하므로 수리에 쓴 교체 문항은 새 세트에 다시 쓰이지 않는다
// 사본의 모든 문항은 계획 시점의 **현재 게시 버전** id 를 쓴다(나중에 다른 에이전트가 만든 수정 버전은 같은 명령을 새 덤프로 재실행하면 반영된다).
// 실행: npx tsx scripts/mock-exam-generation/rebalance-sets.ts --dump d/dump.json --weights d/weights.json --topics .../topics.json --out DIR [--total 13] [--first-index 10] [--report docs/qa/rebalance-13-sets-2026-10-08.md]
//        [--max-per-module 1 --max-per-exam 2 --max-family-per-exam 4] [--max-shared-groups 15] [--group-cap N] [--strict-skill] [--mix-tol 0.02] [--exclude-problems ids.json]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { assertGroupLimits, assertUnique, buildCandidates, buildSlots, demandVsSupply, feasibleN, planUnique, RW_DOMAINS, type PlanItem, type Weights } from "./assemble-unique";
import { DEFAULT_TOPIC_CAPS, SUBJECTS, TARGET_MIX, capViolations, countBy, rwPaths, subjectExcess, type CapViolation, type TopicCaps, type TopicMap } from "./rw-topics-lib";
import type { EligibleProblem } from "../../lib/mock-exam/assemble";

export type RebalanceOpts = { caps: TopicCaps; maxShared: number; groupCap: number; total: number; firstIndex?: number; allowSkillFallback: boolean; mix: Record<string, number>; mixTol: number; relaxFormat: boolean; excludeProblems?: ReadonlySet<string> };
export const DEFAULT_OPTS: RebalanceOpts = { caps: DEFAULT_TOPIC_CAPS, maxShared: 15, groupCap: Infinity, total: 13, allowSkillFallback: true, mix: TARGET_MIX, mixTol: 0.02, relaxFormat: false };

export type SetItem = PlanItem & { itemId: string | null; section: string; m1Eligible?: boolean; m2LowerEligible?: boolean; m2HigherEligible?: boolean };
export type Reason = "archived_problem" | "no_published_version" | "duplicate_in_collection" | "topic_cap";
export type Swap = { setId: string; setName: string; itemId: string | null; section: string; position: number; moduleKey: string; route: string | null; domain: string; skill: string | null; difficulty: string; format: string;
  reason: Reason; oldProblemId: string; oldVersionId: string; oldCluster: string | null; newProblemId: string | null; newVersionId: string | null; newSkill: string | null; newCluster: string | null; newSubject: string | null; sameSkill: boolean; status: "ok" | "skill_fallback" | "NO_REPLACEMENT" };

const asTopicMap = (o: Record<string, any>): TopicMap => new Map(Object.entries(o)) as TopicMap;
const cellKey = (domain: string, difficulty: string, format?: string) => `${domain}|${difficulty}|${format ?? "mc"}`;
const setNum = (name: string) => Number(name.match(/\d+/)![0]);
const LIVE_NAME = /^SAT Practice Test \d+$/;

type Work = { id: string; name: string; items: SetItem[]; rw0: SetItem[] };

export function rebalance(dump0: any, W: Weights, topics: TopicMap, o: RebalanceOpts = DEFAULT_OPTS) {
  // 제외 문항(정답 누설 미수정 등)은 보관 문항과 같이 취급: 재고에서 빠지고 세트 안에 있으면 교체 대상(archived_problem).
  const dump = o.excludeProblems?.size ? { ...dump0, problems: dump0.problems.map((p: any) => (o.excludeProblems!.has(p.id) ? { ...p, archived_at: p.archived_at ?? "excluded" } : p)) } : dump0;
  const P = new Map<string, any>(dump.problems.map((p: any) => [p.id, p]));
  const V = new Map<string, any>(dump.versions.map((v: any) => [v.problem_id, v])); // 현재 게시 버전
  const pubSets = dump.sets.filter((s: any) => s.status === "published" && !s.archived_at && LIVE_NAME.test(s.name)).sort((a: any, b: any) => setNum(a.name) - setNum(b.name));
  const liveSets = dump.sets.filter((s: any) => !s.archived_at && s.status !== "failed");
  const liveIds = new Set<string>(liveSets.map((s: any) => s.id));
  const used = new Set<string>(dump.items.filter((i: any) => liveIds.has(i.exam_set_id)).map((i: any) => i.problem_id)); // 보관되지 않은 세트에 있는 문항은 전부 사용 중
  const cands = buildCandidates(dump, W);
  const candById = new Map(cands.map((c) => [c.problemId, c]));
  const pool = cands.filter((c) => !used.has(c.problemId));
  const taken = new Set<string>(); // 수리·새 세트가 공유하는 단일 사용 집합(joint consistency)
  const newCount = Math.max(0, o.total - pubSets.length);
  const firstIndex = o.firstIndex ?? (pubSets.length ? Math.max(...pubSets.map((s: any) => setNum(s.name))) + 1 : 1);

  const toItem = (i: any): SetItem => { const p = P.get(i.problem_id); return { itemId: i.id, versionId: i.problem_version_id, position: i.position, problemId: i.problem_id, moduleKey: i.module_key, route: i.route ?? null, section: i.section, skill: i.skill_code ?? null, difficulty: i.difficulty, domain: i.sat_domain, format: p?.format ?? "mc", group: p?.similarity_group ?? null, m1Eligible: i.m1_eligible, m2LowerEligible: i.m2_lower_eligible, m2HigherEligible: i.m2_higher_eligible }; };
  const work: Work[] = pubSets.map((s: any) => { const items = dump.items.filter((i: any) => i.exam_set_id === s.id).map(toItem); return { id: s.id, name: s.name, items, rw0: items.filter((i: SetItem) => i.section === "rw").map((i: SetItem) => ({ ...i })) }; });
  const before = work.map((w) => ({ name: w.name, rw: w.items.filter((i) => i.section === "rw").map((i) => ({ ...i })) }));

  // 세트 간 중복: 컬렉션 안 첫 등장(세트 번호 순)만 유지, 이후 등장은 교체 대상
  const firstOwner = new Map<string, string>(); const dupItems = new Set<SetItem>();
  for (const w of work) for (const it of [...w.items].sort((a, b) => a.position - b.position)) { const own = firstOwner.get(it.problemId); if (own === undefined) firstOwner.set(it.problemId, w.id); else dupItems.add(it); }

  // 교체 후보 풀 가중: 새 세트가 필요로 하는 칸을 가능한 한 덜 소모(남는 재고가 많은 칸 우선)
  const demand = new Map<string, number>(); for (const sl of buildSlots(W, newCount, o.relaxFormat)) { const k = cellKey(sl.cell.satDomain, sl.cell.difficulty, sl.cell.format ?? "mc"); demand.set(k, (demand.get(k) ?? 0) + sl.cell.targetCount); }
  const remaining = new Map<string, number>(); for (const c of pool) { const k = cellKey(c.satDomain, c.difficulty, c.format); remaining.set(k, (remaining.get(k) ?? 0) + 1); }
  const slackOf = (c: EligibleProblem) => { const k = cellKey(c.satDomain, c.difficulty, c.format); return (remaining.get(k) ?? 0) - (demand.get(k) ?? 0); };

  const groupMap = new Map<string, Map<string, number>>(); // setId -> group -> count (살아 있는 모든 세트)
  const regroup = (id: string, items: { group: string | null }[]) => { const m = new Map<string, number>(); for (const i of items) if (i.group) m.set(i.group, (m.get(i.group) ?? 0) + 1); groupMap.set(id, m); };
  for (const s of liveSets) { if (work.some((w) => w.id === s.id)) continue; regroup(s.id, dump.items.filter((i: any) => i.exam_set_id === s.id).map((i: any) => ({ group: P.get(i.problem_id)?.similarity_group ?? null }))); }
  for (const w of work) regroup(w.id, w.items);
  const shared = (a: string, b: string) => { let c = 0; for (const g of groupMap.get(a)!.keys()) if (groupMap.get(b)!.has(g)) c++; return c; };

  const baseShare = new Map<string, number>(); for (const a of work) for (const b of work) if (a.id < b.id) { const k = `${a.name}|${b.name}`; baseShare.set(k, shared(a.id, b.id)); baseShare.set(`${b.name}|${a.name}`, shared(a.id, b.id)); }
  const swaps: Swap[] = [];
  const excessOf = (v: CapViolation[]) => v.reduce((a, x) => a + x.count - x.limit, 0);
  const rwView = (items: SetItem[]) => items.filter((i) => i.section === "rw");
  const forcedReason = (it: SetItem): Reason | null => {
    const p = P.get(it.problemId); const c = candById.get(it.problemId);
    if (!p || p.archived_at || p.status !== "confirmed" || p.usage_scope === "general") return "archived_problem";
    if (!V.has(it.problemId)) return "no_published_version";
    if (dupItems.has(it)) return "duplicate_in_collection";
    void c; return null;
  };

  /** 한 세트의 한 문항을 교체. 같은 칸(영역·난이도·형식) 후보 중 하드 필터를 통과한 것에서 같은 skill 우선, 없을 때만 fallback. */
  const replaceOne = (w: Work, idx: number, reason: Reason, mustReduce: boolean): boolean => {
    const it = w.items[idx]; const sg = groupMap.get(w.id)!; const others = [...groupMap.keys()].filter((k) => k !== w.id);
    const rwItems = rwView(w.items); const isRw = it.section === "rw"; const ri = rwItems.indexOf(it);
    const baseViol = isRw ? excessOf(capViolations(rwItems, topics, o.caps)) : 0;
    const base = pool.filter((c) => !taken.has(c.problemId) && c.satDomain === it.domain && c.difficulty === it.difficulty && c.format === it.format && (!isRw || topics.has(c.problemId)));
    const ok = base.filter((c) => {
      if (c.similarityGroup && c.similarityGroup !== it.group && sg.has(c.similarityGroup)) return false;
      if (c.similarityGroup && c.similarityGroup !== it.group) for (const x of others) { const cur = shared(w.id, x); if (groupMap.get(x)!.has(c.similarityGroup) && cur + 1 > Math.max(o.maxShared, cur)) return false; }
      return true; });
    const score = (c: EligibleProblem) => {
      let nv = 0, sx = 0;
      if (isRw) { const trial = rwItems.map((x, j) => (j === ri ? { ...x, problemId: c.problemId } : x)); nv = excessOf(capViolations(trial, topics, o.caps));
        const sc = countBy(rwItems.filter((_, j) => j !== ri), (x) => topics.get(x.problemId)?.subject); sx = Math.round(subjectExcess(sc, rwItems.length - 1, topics.get(c.problemId)!.subject, o.mix) * 100); }
      return { c, nv, key: [nv, c.skillCode === it.skill ? 0 : 1, sx, -slackOf(c), c.exposureCount ?? 0] as number[] };
    };
    const scored = ok.map(score).filter((s) => !mustReduce || s.nv < baseViol);
    const sameSkill = scored.filter((s) => s.c.skillCode === it.skill);
    const poolPick = sameSkill.length ? sameSkill : o.allowSkillFallback ? scored : [];
    poolPick.sort((a, b) => { for (let i = 0; i < a.key.length; i++) if (a.key[i] !== b.key[i]) return a.key[i] - b.key[i]; return a.c.problemId < b.c.problemId ? -1 : 1; });
    const pick = poolPick[0];
    const t = (id: string) => topics.get(id) ?? null;
    if (!pick) { if (reason !== "topic_cap") swaps.push({ setId: w.id, setName: w.name, itemId: it.itemId, section: it.section, position: it.position, moduleKey: it.moduleKey, route: it.route, domain: it.domain, skill: it.skill, difficulty: it.difficulty, format: it.format, reason, oldProblemId: it.problemId, oldVersionId: it.versionId, oldCluster: t(it.problemId)?.cluster ?? null, newProblemId: null, newVersionId: null, newSkill: null, newCluster: null, newSubject: null, sameSkill: false, status: "NO_REPLACEMENT" }); return false; }
    const c = pick.c; taken.add(c.problemId); const k = cellKey(c.satDomain, c.difficulty, c.format); remaining.set(k, (remaining.get(k) ?? 1) - 1);
    swaps.push({ setId: w.id, setName: w.name, itemId: it.itemId, section: it.section, position: it.position, moduleKey: it.moduleKey, route: it.route, domain: it.domain, skill: it.skill, difficulty: it.difficulty, format: it.format, reason, oldProblemId: it.problemId, oldVersionId: it.versionId, oldCluster: t(it.problemId)?.cluster ?? null,
      newProblemId: c.problemId, newVersionId: c.problemVersionId, newSkill: c.skillCode ?? null, newCluster: t(c.problemId)?.cluster ?? null, newSubject: t(c.problemId)?.subject ?? null, sameSkill: c.skillCode === it.skill, status: c.skillCode === it.skill ? "ok" : "skill_fallback" });
    w.items[idx] = { ...it, problemId: c.problemId, versionId: c.problemVersionId, skill: c.skillCode ?? null, group: c.similarityGroup ?? null, itemId: it.itemId };
    regroup(w.id, w.items); return true;
  };

  // 1) 강제 교체(보관 문제·게시 버전 없음·중복)
  const unresolvedForced: { setName: string; position: number; problemId: string; reason: Reason }[] = [];
  for (const w of work) for (let idx = 0; idx < w.items.length; idx++) { const r = forcedReason(w.items[idx]); if (!r) continue; if (!replaceOne(w, idx, r, false)) unresolvedForced.push({ setName: w.name, position: w.items[idx].position, problemId: w.items[idx].problemId, reason: r }); }
  // 2) 소재 상한 수리(위반 수가 줄어드는 교체만; 위반이 가장 많은 세트부터)
  const unresolvedTopic = new Map<string, CapViolation[]>();
  const order = [...work].sort((a, b) => capViolations(rwView(b.items), topics, o.caps).length - capViolations(rwView(a.items), topics, o.caps).length);
  for (const w of order) {
    for (let guard = 0; guard < 200; guard++) {
      const rw = rwView(w.items); const viol = capViolations(rw, topics, o.caps); if (!viol.length) break;
      const badC = new Set(viol.filter((v) => v.kind !== "family").map((v) => v.key)); const badF = new Set(viol.filter((v) => v.kind === "family").map((v) => v.key));
      const suspects = rw.filter((i) => { const t = topics.get(i.problemId); return t && (badC.has(t.cluster) || (badF.has(t.family ?? "") && t.subject !== "literature_fiction")); });
      // 의심 문항 중 교체로 가장 많이 줄어드는 것을 고른다
      let bestIdx = -1; let bestNv = Infinity; const ex0 = excessOf(viol);
      for (const it of suspects) {
        const idx = w.items.indexOf(it); const snapshot = swaps.length; const takenBefore = new Set(taken); const itemBefore = w.items[idx];
        const done = replaceOne(w, idx, "topic_cap", true);
        if (done) { const nv = excessOf(capViolations(rwView(w.items), topics, o.caps)); // 되돌리고 비교
          const sw = swaps.pop()!; remaining.set(cellKey(sw.domain, sw.difficulty, sw.format), (remaining.get(cellKey(sw.domain, sw.difficulty, sw.format)) ?? 0) + 1);
          taken.clear(); for (const x of takenBefore) taken.add(x); w.items[idx] = itemBefore; regroup(w.id, w.items); swaps.length = snapshot;
          if (nv < bestNv) { bestNv = nv; bestIdx = idx; } }
      }
      if (bestIdx < 0 || bestNv >= ex0) { unresolvedTopic.set(w.name, viol); break; }
      replaceOne(w, bestIdx, "topic_cap", true);
    }
  }
  const after = work.map((w) => ({ name: w.name, rw: rwView(w.items) }));
  for (const w of work) if (!unresolvedTopic.has(w.name)) { const v = capViolations(rwView(w.items), topics, o.caps); if (v.length) unresolvedTopic.set(w.name, v); }

  // 3) 새 세트: 수리된 세트들을 keep 으로 보고 남은 재고에서 조립
  const keptCov = new Map<string, number>(); for (const w of work) for (const i of w.items) { const k = `${i.skill}|${i.difficulty}`; keptCov.set(k, (keptCov.get(k) ?? 0) + 1); }
  const keptGroups = work.map((w) => new Set<string>([...groupMap.get(w.id)!.keys()]));
  // 다른 live 세트(초안 등)와의 공유는 keptGroups 에 포함
  for (const s of liveSets) if (!work.some((w) => w.id === s.id) && (groupMap.get(s.id)?.size ?? 0) > 0) keptGroups.push(new Set([...groupMap.get(s.id)!.keys()]));
  const poolNew = pool.filter((c) => !taken.has(c.problemId));
  const shortAtRequested = demandVsSupply(poolNew, buildSlots(W, newCount, o.relaxFormat));
  const feas = newCount ? feasibleN(poolNew, W, newCount, o.relaxFormat) : 0;
  const planN = shortAtRequested.length === 0 ? newCount : feas;
  const plan = planN > 0 ? planUnique(poolNew, W, planN, keptCov, o.relaxFormat, { maxShared: o.maxShared, groupCap: o.groupCap, keptGroups, topics, topicCaps: o.caps, subjectMix: o.mix }) : null;
  const newSets: PlanItem[][] = plan?.sets ?? [];
  const keptIds = new Set<string>(used); for (const id of taken) keptIds.add(id);
  // 사본(수리 안 한 세트 포함)이 쓰는 문항은 used 에 이미 있다. 새 세트는 used·taken 어디와도 겹치면 안 된다.
  assertUnique(newSets, keptIds);
  // 4) 사본 문항을 현재 게시 버전으로 맞춘다
  const versionBumped: { setName: string; position: number; problemId: string; from: string; to: string }[] = [];
  for (const w of work) for (const it of w.items) { const cv = V.get(it.problemId)?.id; if (cv && cv !== it.versionId) { versionBumped.push({ setName: w.name, position: it.position, problemId: it.problemId, from: it.versionId, to: cv }); it.versionId = cv; } }

  // 5) 최종 컬렉션 검증·통계
  const finalSets: { name: string; kind: "unchanged" | "copy" | "new"; items: PlanItem[] }[] = [
    ...work.map((w) => ({ name: w.name, kind: (swaps.some((s) => s.setId === w.id) || versionBumped.some((b) => b.setName === w.name) ? "copy" : "unchanged") as "copy" | "unchanged", items: w.items })),
    ...newSets.map((items, i) => ({ name: `SAT Practice Test ${firstIndex + i}`, kind: "new" as const, items })),
  ];
  const dupAcross = [...countBy(finalSets.flatMap((s) => s.items), (i) => i.problemId)].filter(([, n]) => n > 1);
  // 유사문항 그룹 공유 한도: 수리 전부터 한도를 넘던 쌍은 "기존 초과"로 따로 보고하고(늘어났으면 오류), 새로 넘은 쌍만 오류로 본다.
  const gset = (items: PlanItem[]) => new Set(items.map((i) => i.group).filter(Boolean) as string[]);
  const shareN = (a: Set<string>, b: Set<string>) => { let c = 0; for (const g of a) if (b.has(g)) c++; return c; };
  const groupErrors: string[] = []; const groupPreExisting: string[] = [];
  const finalG = finalSets.map((s) => gset(s.items));
  for (let a = 0; a < finalSets.length; a++) for (let b = a + 1; b < finalSets.length; b++) { const c = shareN(finalG[a], finalG[b]); if (c <= o.maxShared) continue;
    const base = baseShare.get(`${finalSets[a].name}|${finalSets[b].name}`) ?? 0; const msg = `${finalSets[a].name} / ${finalSets[b].name} share ${c} groups (before ${base}, limit ${o.maxShared})`; (c > Math.max(o.maxShared, base) ? groupErrors : groupPreExisting).push(msg); }
  if (Number.isFinite(o.groupCap)) try { assertGroupLimits(finalSets.map((s) => s.items), 1e9, o.groupCap); } catch (e) { groupErrors.push((e as Error).message); }
  const skillsAll = [...new Set(cands.map((c) => c.skillCode).filter(Boolean))] as string[];
  const covered = new Set(finalSets.flatMap((s) => s.items.map((i) => `${i.skill}|${i.difficulty}`)));
  const missingCells = skillsAll.flatMap((sk) => ["easy", "medium", "hard"].map((d) => `${sk}|${d}`)).filter((k) => !covered.has(k));
  const subjectMix = (items: PlanItem[]) => { const rw = items.filter((i) => i.section === "rw"); const c = countBy(rw, (i) => topics.get(i.problemId)?.subject ?? "unclassified"); return Object.fromEntries([...c]); };
  const topCl = (items: PlanItem[]) => [...countBy(items.filter((i) => i.section === "rw"), (i) => topics.get(i.problemId)?.cluster)].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${k}×${n}`);
  const perSet = finalSets.map((s) => ({ name: s.name, kind: s.kind, items: s.items.length, subjects: subjectMix(s.items), topClusters: topCl(s.items), capViolations: capViolations(s.items.filter((i) => i.section === "rw") as any, topics, o.caps) }));

  // 남은 위반 이유
  const poolLeft = pool.filter((c) => !taken.has(c.problemId) && !newSets.flat().some((i) => i.problemId === c.problemId));
  const poolLeftIds = new Set(poolLeft.map((c) => c.problemId));
  const why = (setName: string, v: CapViolation) => {
    const fs = finalSets.find((s) => s.name === setName)!; const rw = fs.items.filter((i) => i.section === "rw");
    const offenders = rw.filter((i) => topics.get(i.problemId)?.cluster === v.key || (v.kind === "family" && topics.get(i.problemId)?.family === v.key));
    const cells = [...new Set(offenders.map((i) => cellKey(i.domain, i.difficulty, i.format)))];
    return cells.map((c) => { const [d, df, f] = c.split("|"); const same = poolLeft.filter((x) => x.satDomain === d && x.difficulty === df && x.format === f); const okTopic = same.filter((x) => { const t = topics.get(x.problemId); return t && t.cluster !== v.key; });
      return `${c}: 남은 미사용 ${same.length}건 중 소재 허용 ${okTopic.length}건${same.length === 0 ? " (재고 소진)" : okTopic.length === 0 ? " (남은 재고가 전부 같은 소재거나 미분류)" : " (그룹·세트 내 중복 제약에 막힘)"}`; }).join("; ");
  };
  const remainingViolations = perSet.filter((s) => s.capViolations.length).map((s) => ({ set: s.name, violations: s.capViolations.map((v) => ({ ...v, why: why(s.name, v) })) }));

  const sh = generationNeed(finalSets.flatMap((s) => s.items).filter((i) => i.section === "rw"), poolLeft.filter((c) => RW_DOMAINS.includes(c.satDomain)), topics, o);
  void poolLeftIds;
  const planRwFinal = finalSets.flatMap((s) => s.items).filter((i) => i.section === "rw"); const leftRw = poolLeft.filter((c) => RW_DOMAINS.includes(c.satDomain));
  (sh as any).sensitivity = [0, 0.02, 0.04, 0.06].map((t) => ({ mixTol: t, items: generationNeed(planRwFinal, leftRw, topics, { mix: o.mix, mixTol: t }).totalItemsCellLevel }));
  return { opts: o, pubSets: pubSets.map((s: any) => s.name), newCount, plannedNew: planN, firstIndex, work, swaps, versionBumped, unresolvedForced, unresolvedTopic: Object.fromEntries(unresolvedTopic), before, after, newSets, newPlanFailures: plan?.failures ?? [], topicRelaxed: plan?.topicRelaxed ?? [], shortfallsAtRequestedNew: shortAtRequested, finalSets, perSet, dupAcross, groupErrors, groupPreExisting, missingCells, remainingViolations, poolLeft: poolLeft.length, poolInitial: pool.length, generation: sh, unclassifiedPool: pool.filter((c) => RW_DOMAINS.includes(c.satDomain) && !topics.has(c.problemId)).length };
}

/** 목표 과목 구성을 만족하려면 (skill x 난이도) 칸마다 과목별로 몇 문항을 더 만들어야 하는지.
 * 칸 수요 = 최종 계획의 R&W 문항 수, 공급 = 그 칸의 (계획에 쓰인 + 남은 미사용) 분류된 문항. 과목 s 의 하한 = (목표% - 허용오차) x 칸 수요(소수 유지, 과목별 합계에서만 올림). */
export function generationNeed(planRw: PlanItem[], leftover: EligibleProblem[], topics: TopicMap, o: Pick<RebalanceOpts, "mix" | "mixTol">) {
  const cellDemand = new Map<string, number>(); const supply = new Map<string, number>(); // `${skill}|${diff}` , `${skill}|${diff}|${subject}`
  for (const i of planRw) { const k = `${i.skill}|${i.difficulty}`; cellDemand.set(k, (cellDemand.get(k) ?? 0) + 1); const s = topics.get(i.problemId)?.subject; if (s) supply.set(`${k}|${s}`, (supply.get(`${k}|${s}`) ?? 0) + 1); }
  for (const c of leftover) { const s = topics.get(c.problemId)?.subject; if (!s) continue; const k = `${c.skillCode}|${c.difficulty}`; if (!cellDemand.has(k)) continue; supply.set(`${k}|${s}`, (supply.get(`${k}|${s}`) ?? 0) + 1); }
  const perCell: { cell: string; demand: number; need: Record<string, number>; total: number }[] = []; const bySubject: Record<string, number> = {};
  for (const [cell, n] of cellDemand) { const need: Record<string, number> = {}; for (const s of SUBJECTS) { const min = Math.max(0, (o.mix[s] ?? 0) / 100 - o.mixTol) * n; const d = Math.max(0, min - (supply.get(`${cell}|${s}`) ?? 0)); if (d > 1e-9) { need[s] = d; bySubject[s] = (bySubject[s] ?? 0) + d; } }
    const total = Object.values(need).reduce((a, b) => a + b, 0); if (total > 1e-9) perCell.push({ cell, demand: n, need, total }); }
  const subjectsCeil = Object.fromEntries(Object.entries(bySubject).map(([k, v]) => [k, Math.ceil(v - 1e-9)]));
  const totalItems = Object.values(subjectsCeil).reduce((a, b) => a + b, 0);
  // 전역(칸 무시) 하한도 함께: 전체 R&W 문항 중 과목별 목표 대비 공급 부족
  const totalRw = planRw.length; const globalSupply = new Map<string, number>(); for (const [k, v] of supply) { const s = k.split("|")[2]; globalSupply.set(s, (globalSupply.get(s) ?? 0) + v); }
  const global = SUBJECTS.map((s) => { const target = Math.round(((o.mix[s] ?? 0) / 100) * totalRw); const min = Math.floor(Math.max(0, (o.mix[s] ?? 0) / 100 - o.mixTol) * totalRw); const have = globalSupply.get(s) ?? 0; return { subject: s, targetItems: target, minItems: min, usableSupply: have, globalShortfall: Math.max(0, min - have) }; });
  return { totalRwItems: totalRw, mixTol: o.mixTol, perCell: perCell.map((c) => ({ ...c, total: Math.ceil(c.total - 1e-9) })).sort((a, b) => b.total - a.total), bySubjectCellLevel: subjectsCeil, totalItemsCellLevel: totalItems, global,
    estCostUsd: { adopted_0_22: +(totalItems * 0.22).toFixed(2), hard_0_5: +(totalItems * 0.5).toFixed(2) } };
}

// ---- 출력 ----
function writeOutputs(r: ReturnType<typeof rebalance>, out: string) {
  mkdirSync(out, { recursive: true });
  const w = (f: string, x: unknown) => writeFileSync(path.join(out, f), JSON.stringify(x, null, f.startsWith("new-sets.") ? undefined : 1));
  w("repair-plan.json", r.swaps);
  const copies = r.work.filter((x) => r.swaps.some((s) => s.setId === x.id) || r.versionBumped.some((b) => b.setName === x.name)).map((x) => ({ oldSetId: x.id, setName: x.name, copyName: `${x.name} (new)`, archiveOldSet: true, publishCopyAs: "free", items: x.items.map((i) => ({ ...i })).sort((a, b) => (a.section === b.section ? a.position - b.position : a.section < b.section ? 1 : -1)) }));
  w("set-copies.json", copies);
  w("archive-list.json", copies.map((c) => ({ setId: c.oldSetId, name: c.setName })));
  w("new-sets.json", r.newSets); w("new-sets-meta.json", { names: r.newSets.map((_, i) => `SAT Practice Test ${r.firstIndex + i}`), firstIndex: r.firstIndex });
  w("shortfall.json", r.generation);
  w("plan-report.json", { opts: { ...r.opts, groupCap: Number.isFinite(r.opts.groupCap) ? r.opts.groupCap : null }, pubSets: r.pubSets, newRequested: r.newCount, newPlanned: r.plannedNew, swaps: r.swaps.length, byReason: Object.fromEntries([...countBy(r.swaps, (s) => s.reason)]), skillFallbacks: r.swaps.filter((s) => s.status === "skill_fallback").length, noReplacement: r.swaps.filter((s) => s.status === "NO_REPLACEMENT"),
    versionBumped: r.versionBumped.length, duplicatesAcrossAllSets: r.dupAcross.length, groupErrors: r.groupErrors, groupPreExisting: r.groupPreExisting, missingCells: r.missingCells, newPlanFailures: r.newPlanFailures, topicRelaxedInNewSets: r.topicRelaxed, shortfallsAtRequestedNew: r.shortfallsAtRequestedNew, remainingViolations: r.remainingViolations, perSet: r.perSet, poolInitial: r.poolInitial, poolLeft: r.poolLeft, unclassifiedPool: r.unclassifiedPool });
}

function reportMd(r: ReturnType<typeof rebalance>, meta: { dumpAt: string; ledger?: string }) {
  const L: string[] = []; const pct = (n: number, d: number) => `${((n / Math.max(1, d)) * 100).toFixed(0)}%`;
  L.push("# SAT Practice Test 1..13 통합 재조정 (dry-run, 2026-10-08)", "", `생성: \`scripts/mock-exam-generation/rebalance-sets.ts\` (DB 접근 없음, 원격 쓰기 없음). 덤프: ${meta.dumpAt}. ${meta.ledger ?? ""}`, "",
    `상한: 모듈당 cluster ${r.opts.caps.perModule}, 54문항 경로당 ${r.opts.caps.perExam}, 비문학 family ${r.opts.caps.familyPerExam}. 유사문항 그룹 공유 <= ${r.opts.maxShared}. 게시 세트 ${r.pubSets.length}개(${r.pubSets.map((n: string) => n.replace("SAT Practice Test ", "T")).join(", ")}), 새 세트 요청 ${r.newCount}개(T${r.firstIndex}~), 계획 ${r.plannedNew}개.`, "");
  L.push("## 1. 교체 요약", "", `총 ${r.swaps.length}건 교체 (사유: ${[...countBy(r.swaps, (s) => s.reason)].map(([k, n]) => `${k} ${n}`).join(", ") || "-"}). skill fallback ${r.swaps.filter((s) => s.status === "skill_fallback").length}건, 교체 불가 ${r.swaps.filter((s) => s.status === "NO_REPLACEMENT").length}건. 현재 게시 버전으로 갱신된 문항 ${r.versionBumped.length}건.`, "",
    "| 세트 | 교체 수 | 사유 | skill fallback | 교체 불가 | 소재 위반(전→후) |", "|---|---|---|---|---|---|");
  for (const b of r.before) { const s = r.swaps.filter((x) => x.setName === b.name); const a = r.after.find((x) => x.name === b.name)!;
    L.push(`| ${b.name} | ${s.length} | ${[...countBy(s, (x) => x.reason)].map(([k, n]) => `${k}:${n}`).join(" ") || "-"} | ${s.filter((x) => x.status === "skill_fallback").length} | ${s.filter((x) => x.status === "NO_REPLACEMENT").length} | ${capViolations(b.rw as any, topicsOf(r), r.opts.caps).length} → ${capViolations(a.rw as any, topicsOf(r), r.opts.caps).length} |`); }
  const fb = r.swaps.filter((s) => s.status === "skill_fallback");
  L.push("", "### skill fallback 목록(같은 skill 후보가 하나도 없던 경우)", "", ...(fb.length ? fb.map((s) => `- ${s.setName} ${s.moduleKey}/${s.route ?? "-"} #${s.position} ${s.domain} ${s.difficulty}: ${s.skill} → ${s.newSkill} (${s.reason})`) : ["- 없음"]));
  const nr = r.swaps.filter((s) => s.status === "NO_REPLACEMENT");
  L.push("", "### 교체 불가(강제 교체 대상인데 같은 칸 미사용 재고 없음)", "", ...(nr.length ? nr.map((s) => `- ${s.setName} ${s.moduleKey}/${s.route ?? "-"} #${s.position} ${s.domain}/${s.skill}/${s.difficulty}/${s.format} (${s.reason}) problem ${s.oldProblemId}`) : ["- 없음"]));
  L.push("", "## 2. 컬렉션 검증", "", `- 전체 세트(수리본+새 세트) 문항 중복 problem: ${r.dupAcross.length}건`, `- 유사문항 그룹 한도 새 위반: ${r.groupErrors.length ? r.groupErrors.join(" / ") : "없음"}; 수리 전부터 넘던 쌍(늘리지 않음): ${r.groupPreExisting.length ? r.groupPreExisting.join(" / ") : "없음"}`, `- 30 skill x 3 난이도 칸 누락: ${r.missingCells.length ? r.missingCells.join(", ") : "없음"}`, `- 새 세트 조립 실패: ${r.newPlanFailures.length ? r.newPlanFailures.slice(0, 5).join(" / ") : "없음"}; 소재 상한 완화로 들어간 새 세트 문항 ${r.topicRelaxed.length}건`,
    `- 재고: 시작 미사용 ${r.poolInitial} → 남음 ${r.poolLeft}. 미분류(소재 없음) R&W 재고 ${r.unclassifiedPool}건(소재 제약 계산에서 제외 또는 무제한 취급).`);
  if (r.shortfallsAtRequestedNew.length) L.push("", "새 세트 요청 수 기준 칸 부족:", "", "| 영역 | 난이도 | 형식 | 수요 | 공급 | 부족 |", "|---|---|---|---|---|---|", ...r.shortfallsAtRequestedNew.map((s) => `| ${s.domain} | ${s.difficulty} | ${s.format} | ${s.demand} | ${s.supply} | ${s.extraNeeded} |`));
  L.push("", "## 3. 세트별 R&W 과목 구성과 상위 소재 (최종)", "", `| 세트 | 종류 | ${SUBJECTS.map((s) => s.replace("_", " ")).join(" | ")} | 상위 cluster | 위반 |`, `|---|---|${SUBJECTS.map(() => "---").join("|")}|---|---|`);
  for (const s of r.perSet) { const tot = Object.values(s.subjects).reduce((a: number, b) => a + (b as number), 0); L.push(`| ${s.name} | ${s.kind} | ${SUBJECTS.map((x) => `${(s.subjects as any)[x] ?? 0} (${pct((s.subjects as any)[x] ?? 0, tot)})`).join(" | ")} | ${s.topClusters.join(", ")} | ${s.capViolations.length} |`); }
  L.push("", "목표(%): " + SUBJECTS.map((s) => `${s} ${TARGET_MIX[s]}`).join(", "), "", "### 수리 전 과목 구성·상위 cluster (게시 세트)", "", `| 세트 | ${SUBJECTS.map((s) => s.replace("_", " ")).join(" | ")} | 상위 cluster |`, `|---|${SUBJECTS.map(() => "---").join("|")}|---|`);
  for (const b of r.before) { const c = countBy(b.rw, (i) => topicsOf(r).get(i.problemId)?.subject ?? "unclassified"); const tc = [...countBy(b.rw, (i) => topicsOf(r).get(i.problemId)?.cluster)].sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k, n]) => `${k}×${n}`);
    L.push(`| ${b.name} | ${SUBJECTS.map((x) => `${c.get(x) ?? 0}`).join(" | ")} | ${tc.join(", ")} |`); }
  L.push("", "## 4. 남은 위반과 이유", "", ...(r.remainingViolations.length ? r.remainingViolations.flatMap((s) => [`- **${s.set}**`, ...s.violations.map((v) => `  - ${v.kind} ${v.key} ×${v.count}/${v.limit} (${v.where}) — ${v.why}`)]) : ["- 없음"]));
  const g = r.generation;
  L.push("", "## 5. 목표 과목 구성을 위한 추가 생성 필요량 (R&W)", "", `전제: 13세트 R&W 문항 ${g.totalRwItems}건, 과목별 하한 = (목표% - ${(g.mixTol * 100).toFixed(0)}pp) x 칸 수요. 공급 = 최종 계획에 쓰인 문항 + 남은 미사용 재고(분류된 것만). 칸 단위로 부족분을 계산하고 과목별 합계만 올림한다. 생성된 문항은 과다 과목(문학 등) 문항을 대체한다.`, "",
    `허용오차 민감도(추가 생성 총량): ${((g as any).sensitivity ?? []).map((x: any) => `${(x.mixTol * 100).toFixed(0)}pp → ${x.items}건`).join(", ")}.`, "", `**칸 단위 추정 총 ${g.totalItemsCellLevel}건** — 채택 기준 $0.22/건 ≈ $${g.estCostUsd.adopted_0_22}, hard 비중이 높으면 $0.5/건 ≈ $${g.estCostUsd.hard_0_5}.`, "", "과목별(칸 단위 합계):", "", "| 과목 | 추가 생성 | 전역 하한 | 전역 공급 | 전역 부족 |", "|---|---|---|---|---|",
    ...g.global.map((x) => `| ${x.subject} | ${(g.bySubjectCellLevel as any)[x.subject] ?? 0} | ${x.minItems} | ${x.usableSupply} | ${x.globalShortfall} |`), "", "skill x 난이도 칸별 추가 생성 (상위 40; 전체는 shortfall.json):", "", "| 칸 | 수요 | 추가 | 과목별 |", "|---|---|---|---|",
    ...g.perCell.slice(0, 40).map((c) => `| ${c.cell} | ${c.demand} | ${c.total} | ${Object.entries(c.need).map(([k, v]) => `${k} ${Math.ceil(v - 1e-9)}`).join(", ")} |`));
  L.push("", "## 6. 적용 순서 제안(총괄)", "", "1. 다른 에이전트의 R&W 수정 버전이 들어온 뒤 새 덤프로 같은 명령 재실행 2. `set-copies.json` 각 항목: `<name> (new)` 초안 사본 생성 → `mock_exam_validate_mst_set`·`mock_exam_set_item_issues` 검증 → 옛 세트 보관 → 사본 free 게시 3. `new-sets.json` 으로 T10~ 신규 세트 생성. 모든 단계는 이 보고서 범위 밖(원격 쓰기 없음).");
  return L.join("\n") + "\n";
}
let _topics: TopicMap = new Map(); const topicsOf = (_r: unknown) => _topics;

async function main() {
  const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
  const dump = JSON.parse(readFileSync(arg("--dump")!, "utf-8")); const W: Weights = JSON.parse(readFileSync(arg("--weights")!, "utf-8"));
  _topics = arg("--topics") ? asTopicMap(JSON.parse(readFileSync(arg("--topics")!, "utf-8"))) : new Map();
  const o: RebalanceOpts = { ...DEFAULT_OPTS, caps: { perModule: Number(arg("--max-per-module") ?? DEFAULT_TOPIC_CAPS.perModule), perExam: Number(arg("--max-per-exam") ?? DEFAULT_TOPIC_CAPS.perExam), familyPerExam: Number(arg("--max-family-per-exam") ?? DEFAULT_TOPIC_CAPS.familyPerExam) },
    maxShared: Number(arg("--max-shared-groups") ?? 15), groupCap: arg("--group-cap") ? Number(arg("--group-cap")) : Infinity, total: Number(arg("--total") ?? 13), firstIndex: arg("--first-index") ? Number(arg("--first-index")) : undefined, allowSkillFallback: !process.argv.includes("--strict-skill"), mixTol: Number(arg("--mix-tol") ?? 0.02), relaxFormat: process.argv.includes("--relax-format"), excludeProblems: arg("--exclude-problems") ? new Set<string>(JSON.parse(readFileSync(arg("--exclude-problems")!, "utf-8"))) : undefined };
  const r = rebalance(dump, W, _topics, o); const out = arg("--out") ?? "data/mock-exam-generation/rebalance-20261008"; writeOutputs(r, out);
  const rep = arg("--report"); if (rep) { mkdirSync(path.dirname(rep), { recursive: true }); writeFileSync(rep, reportMd(r, { dumpAt: arg("--dump-label") ?? arg("--dump")!, ledger: arg("--ledger-note") })); }
  console.log(JSON.stringify({ swaps: r.swaps.length, byReason: Object.fromEntries(countBy(r.swaps, (s) => s.reason)), skillFallbacks: r.swaps.filter((s) => s.status === "skill_fallback").length, noReplacement: r.swaps.filter((s) => s.status === "NO_REPLACEMENT").length, newPlanned: r.plannedNew, newRequested: r.newCount, dupAcross: r.dupAcross.length, groupErrors: r.groupErrors.length, missingCells: r.missingCells.length, remainingViolationSets: r.remainingViolations.length, genItemsCellLevel: r.generation.totalItemsCellLevel, out }, null, 1));
}
if (process.argv[1]?.endsWith("rebalance-sets.ts")) main().catch((e) => { console.error(e); process.exit(1); });
