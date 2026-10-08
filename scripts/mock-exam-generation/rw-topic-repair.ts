// 게시 세트(SAT Practice Test N) R&W 소재 상한 위반 보수 계획(2026-10-08). **DB 접근 없음 — 덤프·topics.json 만 읽고 JSON 계획만 쓴다. 원격 적용은 하지 않는다**
// (응시 기록이 있으면 세트 문항이 동결되므로 총괄이 영향 세트를 새 사본으로 다시 만든다 — 이 계획은 그 입력).
// 교체 규칙: 같은 섹션·영역·skill·난이도·형식, 어느 게시 세트에도 쓰이지 않은 미사용 문항, 같은 세트 안 유사문항 그룹 중복 없음,
//   다른 게시 세트와 공유 유사문항 그룹 수가 maxShared(15) 를 넘지 않음(이미 넘은 쌍은 늘리지 않음), 교체 후 소재 상한 위반이 줄어듦.
//   과목 구성은 소프트 — 목표보다 부족한 과목의 지문을 우선.
// 실행: npx tsx scripts/mock-exam-generation/rw-topic-repair.ts --dump DIR/dump.json --weights DIR/weights.json --topics .../topics.json [--sets "SAT Practice Test 1,..."] [--out FILE] [--max-per-module 1 --max-per-exam 2 --max-family-per-exam 4]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { buildCandidates, RW_DOMAINS, type Weights } from "./assemble-unique";
import { DEFAULT_TOPIC_CAPS, TARGET_MIX, TopicLedger, capViolations, countBy, subjectExcess, type TopicCaps, type TopicMap } from "./rw-topics-lib";

type It = { itemId: string; problemId: string; versionId: string; position: number; moduleKey: string; route: string | null; domain: string; skill: string | null; difficulty: string; format: string; group: string | null };
export type Swap = { itemId: string; position: number; moduleKey: string; route: string | null; domain: string; skill: string | null; difficulty: string; format: string; oldProblemId: string; oldVersionId: string; oldCluster: string; newProblemId: string; newVersionId: string; newCluster: string; newSubject: string; sameSkill: boolean };

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };

export function repairSets(dump: any, W: Weights, topics: TopicMap, caps: TopicCaps, only?: string[], maxShared = 15, allowSkillFallback = true) {
  const P = new Map<string, any>(dump.problems.map((p: any) => [p.id, p]));
  const pub = dump.sets.filter((s: any) => s.status === "published" && !s.archived_at && /^SAT Practice Test \d+$/.test(s.name) && (!only || only.includes(s.name)))
    .sort((a: any, b: any) => Number(a.name.match(/\d+/)![0]) - Number(b.name.match(/\d+/)![0]));
  const allPub = dump.sets.filter((s: any) => s.status === "published" && !s.archived_at);
  const used = new Set<string>(dump.items.filter((i: any) => allPub.some((s: any) => s.id === i.exam_set_id)).map((i: any) => i.problem_id));
  const groupsOfSet = new Map<string, Map<string, number>>(); // setId -> group -> count (RW+Math 전체)
  for (const s of allPub) { const m = new Map<string, number>(); for (const i of dump.items.filter((x: any) => x.exam_set_id === s.id)) { const g = P.get(i.problem_id)?.similarity_group; if (g) m.set(g, (m.get(g) ?? 0) + 1); } groupsOfSet.set(s.id, m); }
  const shared = (a: string, b: string) => { let c = 0; for (const g of groupsOfSet.get(a)!.keys()) if (groupsOfSet.get(b)!.has(g)) c++; return c; };
  const pool = buildCandidates(dump, W).filter((c) => RW_DOMAINS.includes(c.satDomain) && !used.has(c.problemId) && topics.has(c.problemId));
  const taken = new Set<string>(); const out: any[] = [];
  for (const s of pub) {
    const items: It[] = dump.items.filter((i: any) => i.exam_set_id === s.id && i.section === "rw").map((i: any) => ({ itemId: i.id, problemId: i.problem_id, versionId: i.problem_version_id, position: i.position, moduleKey: i.module_key, route: i.route, domain: i.sat_domain, skill: i.skill_code, difficulty: i.difficulty, format: P.get(i.problem_id)?.format ?? "mc", group: P.get(i.problem_id)?.similarity_group ?? null }));
    const before = capViolations(items, topics, caps); const swaps: Swap[] = []; const unresolved: string[] = [];
    const sGroups = groupsOfSet.get(s.id)!; const others = allPub.filter((o: any) => o.id !== s.id);
    const subjCount = () => countBy(items, (i) => topics.get(i.problemId)?.subject);
    for (let guard = 0; guard < 120; guard++) {
      const viol = capViolations(items, topics, caps); if (!viol.length) break; const excess = (v: { count: number; limit: number }[]) => v.reduce((a, x) => a + x.count - x.limit, 0); const ex0 = excess(viol);
      const badClusters = new Set(viol.filter((v) => v.kind !== "family").map((v) => v.key)); const badFamilies = new Set(viol.filter((v) => v.kind === "family").map((v) => v.key));
      const suspects = items.filter((i) => { const t = topics.get(i.problemId)!; return badClusters.has(t.cluster) || (badFamilies.has(t.family ?? "") && t.subject !== "literature_fiction"); });
      let best: { idx: number; cand: (typeof pool)[number]; sameSkill: boolean; key: number[] } | null = null;
      for (const it of suspects) {
        const idx = items.indexOf(it);
        const base = pool.filter((c) => !taken.has(c.problemId) && c.satDomain === it.domain && c.difficulty === it.difficulty && c.format === it.format);
        const same = base.filter((c) => c.skillCode === it.skill); const cands = same.length || !allowSkillFallback ? same : base; // skill 동일 우선, 같은 skill 후보가 아예 없을 때만 같은 영역·난이도·형식(sameSkill=false 로 표시)
        for (const c of cands) {
          if (c.similarityGroup && c.similarityGroup !== it.group && sGroups.has(c.similarityGroup)) continue;
          if (c.similarityGroup && others.some((o: any) => { const cur = shared(s.id, o.id); const add = groupsOfSet.get(o.id)!.has(c.similarityGroup!) && !sGroups.has(c.similarityGroup!) ? 1 : 0; return add && cur + 1 > Math.max(maxShared, cur); })) continue;
          const trial = items.map((x, j) => (j === idx ? { ...x, problemId: c.problemId } : x));
          const nv = excess(capViolations(trial, topics, caps)); if (nv >= ex0) continue;
          const sub = topics.get(c.problemId)!.subject; const oldSub = topics.get(it.problemId)!.subject;
          const sc = subjCount(); const ex = subjectExcess(sc, items.length, sub) - subjectExcess(sc, items.length, oldSub);
          const key = [nv, Math.round(ex * 100), c.exposureCount ?? 0]; const ss = c.skillCode === it.skill;
          if (!best || key[0] < best.key[0] || (key[0] === best.key[0] && (key[1] < best.key[1] || (key[1] === best.key[1] && key[2] < best.key[2])))) best = { idx, cand: c, sameSkill: ss, key };
        }
      }
      if (!best) { unresolved.push(...viol.map((v) => `${v.key} ×${v.count} (${v.where})`)); break; }
      const old = items[best.idx]; const t = topics.get(best.cand.problemId)!;
      swaps.push({ itemId: old.itemId, position: old.position, moduleKey: old.moduleKey, route: old.route, domain: old.domain, skill: old.skill, difficulty: old.difficulty, format: old.format, oldProblemId: old.problemId, oldVersionId: old.versionId, oldCluster: topics.get(old.problemId)!.cluster, newProblemId: best.cand.problemId, newVersionId: best.cand.problemVersionId, newCluster: t.cluster, newSubject: t.subject, sameSkill: best.sameSkill });
      taken.add(best.cand.problemId);
      if (old.group) { /* 이전 그룹 제거는 보수적으로 유지(공유 수 계산을 낮추지 않는다) */ }
      if (best.cand.similarityGroup) sGroups.set(best.cand.similarityGroup, (sGroups.get(best.cand.similarityGroup) ?? 0) + 1);
      items[best.idx] = { ...old, problemId: best.cand.problemId, versionId: best.cand.problemVersionId, group: best.cand.similarityGroup ?? null };
    }
    const after = capViolations(items, topics, caps);
    out.push({ setName: s.name, setId: s.id, violationsBefore: before.length, violationsAfter: after.length, swapCount: swaps.length, skillFallbackCount: swaps.filter((x) => !x.sameSkill).length, unresolved: [...new Set(unresolved)], remaining: after, swaps });
  }
  return out;
}

if (process.argv[1]?.endsWith("rw-topic-repair.ts")) {
  const dump = JSON.parse(readFileSync(arg("--dump")!, "utf-8")); const W: Weights = JSON.parse(readFileSync(arg("--weights")!, "utf-8"));
  const topics: TopicMap = new Map(Object.entries(JSON.parse(readFileSync(arg("--topics")!, "utf-8")))) as TopicMap;
  const caps: TopicCaps = { perModule: Number(arg("--max-per-module") ?? DEFAULT_TOPIC_CAPS.perModule), perExam: Number(arg("--max-per-exam") ?? DEFAULT_TOPIC_CAPS.perExam), familyPerExam: Number(arg("--max-family-per-exam") ?? DEFAULT_TOPIC_CAPS.familyPerExam) };
  const plan = repairSets(dump, W, topics, caps, arg("--sets")?.split(",").map((x) => x.trim()), 15, !process.argv.includes("--strict-skill"));
  const file = arg("--out") ?? "data/mock-exam-generation/rw-topics-20261008/repair-plan.json";
  writeFileSync(file, JSON.stringify({ caps, note: "적용 금지(계획만). 총괄이 영향 세트를 새 사본으로 재구성한다.", targetMix: TARGET_MIX, sets: plan }, null, 1));
  const rf = arg("--append-report");
  if (rf && existsSync(rf)) {
    const L = ["", "## 7. 보수 계획 요약 (적용 금지 — 계획만)", "", `상한: 모듈당 ${caps.perModule}, 응시 경로당 ${caps.perExam}, 비문학 family 경로당 ${caps.familyPerExam}. 계획 파일: \`data/mock-exam-generation/rw-topics-20261008/repair-plan.json\` (교체 후보는 게시 세트 어디에도 안 쓰인 확정 문항, 같은 영역·난이도·형식, 같은 skill 우선·없을 때만 skill fallback).`, "",
      "| 세트 | 위반(전→후) | 교체 수 | skill fallback | 남은 위반(재고 부족) |", "|---|---|---|---|---|", ...plan.map((p) => `| ${p.setName} | ${p.violationsBefore} → ${p.violationsAfter} | ${p.swapCount} | ${p.skillFallbackCount} | ${p.unresolved.join("; ") || "-"} |`),
      "", "남은 위반은 같은 (영역, skill, 난이도, 형식) 칸의 미사용 재고가 없어 생긴다 — rw-stock 생성분(회피 목록 적용)이 들어오면 같은 명령으로 다시 계획한다.", "",
      "## 8. 목표 과목 구성 제안", "", "College Board digital SAT R&W 지문은 문학·역사/사회·인문·과학이 대체로 비슷한 비중이다. 이를 세부 과목으로 나눈 제안값(합 100%):", "", "| 과목 | 목표 |", "|---|---|", ...Object.entries(TARGET_MIX).map(([k, v]) => `| ${k} | ${v}% |`),
      "", "은행 재고 자체가 문학 41%·사회과학 3%·물리/화학 1%로 치우쳐 있어 조립만으로는 목표에 닿지 않는다(조립기는 소프트 목표로 가까운 쪽을 고른다). 생성 쪽에서 social_science·science_physical·economics_business 지문을 우선 채워야 한다."];
    const cur = readFileSync(rf, "utf-8"); const i = cur.indexOf("\n## 7."); writeFileSync(rf, (i >= 0 ? cur.slice(0, i) : cur.trimEnd()) + "\n" + L.join("\n") + "\n");
  }
  for (const p of plan) console.log(`${p.setName}: violations ${p.violationsBefore} -> ${p.violationsAfter}, swaps ${p.swapCount} (skill fallback ${p.skillFallbackCount})${p.unresolved.length ? `, unresolved: ${p.unresolved.join("; ")}` : ""}`);
}
