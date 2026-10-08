import { describe, expect, it } from "vitest";
import { buildCandidates, planUnique, type Weights } from "./assemble-unique";
import { capViolations, type TopicMap } from "./rw-topics-lib";
import { generationNeed, rebalance, DEFAULT_OPTS } from "./rebalance-sets";

// 합성 은행: RW 1개 영역(skill 3개) + 수학 1개 영역, 난이도 3종, 칸당 N건. cluster 는 앞쪽 id 를 3개씩 묶어 초기 세트(id 순 선택)가 상한을 어기게 만든다.
const W: Weights = { dom: [{ section: "rw", sat_domain: "rw_information_ideas", weight_pct: 100 }, { section: "math", sat_domain: "algebra", weight_pct: 100 }],
  diff: ["easy", "medium", "hard"].flatMap((d, i) => ["rw", "math"].map((s) => ({ section: s, problem_difficulty: d, weight_pct: [25, 50, 25][i] }))) };
const N = 420;
const diffs = ["easy", "medium", "hard"];
const subjects = ["literature_fiction", "humanities", "science_life", "history_civics", "social_science", "science_physical"];

function synth() {
  const problems: any[] = [], versions: any[] = []; const topics: TopicMap = new Map();
  for (const dom of ["rw_information_ideas", "algebra"]) for (const d of diffs) for (let i = 0; i < N; i++) {
    const id = `${dom}-${d}-${String(i).padStart(3, "0")}`;
    problems.push({ id, sat_domain: dom, skill_code: `${dom}_s${i % 3}`, format: "mc", status: "confirmed", usage_scope: "mock", similarity_group: null, archived_at: null });
    versions.push({ id: `v-${id}`, problem_id: id, difficulty: d, status: "published" });
    if (dom === "rw_information_ideas") topics.set(id, { subject: subjects[i % subjects.length], cluster: i < 150 ? `c-${d}-${Math.floor(i / 3)}` : `u-${d}-${i}`, family: `f-${d}-${Math.floor(i / 3) % 40}` });
  }
  const dump: any = { problems, versions, sets: [], items: [] };
  const cands = buildCandidates(dump, W);
  const init = planUnique(cands, W, 2, new Map(), true, {}); // 상한 없이 id 순으로 뽑아 위반을 만든다
  init.sets.forEach((items, s) => { const id = `set${s + 1}`; dump.sets.push({ id, name: `SAT Practice Test ${s + 1}`, status: "published", archived_at: null });
    items.forEach((it, k) => dump.items.push({ id: `${id}-i${k}`, exam_set_id: id, section: it.section, position: it.position, problem_id: it.problemId, problem_version_id: it.versionId, sat_domain: it.domain, skill_code: it.skill, difficulty: it.difficulty, module_key: it.moduleKey, route: it.route })); });
  return { dump, topics };
}
const opts = { ...DEFAULT_OPTS, total: 4, relaxFormat: true };
const allItems = (r: ReturnType<typeof rebalance>) => r.finalSets.flatMap((s) => s.items);

describe("rebalance-sets", () => {
  it("수리: 상한 위반 0, 모든 세트 147문항, 전체 중복 0, 새 세트가 수리 교체분을 재사용하지 않는다", () => {
    const { dump, topics } = synth();
    const rw1 = (name: string) => dump.items.filter((i: any) => i.exam_set_id === dump.sets.find((s: any) => s.name === name).id && i.section === "rw").map((i: any) => ({ problemId: i.problem_id, moduleKey: i.module_key, route: i.route }));
    expect(capViolations(rw1("SAT Practice Test 1"), topics).length).toBeGreaterThan(0); // 대조군
    const r = rebalance(dump, W, topics, opts);
    expect(r.swaps.length).toBeGreaterThan(0);
    for (const s of r.finalSets) expect(s.items.length).toBe(147);
    expect(r.finalSets.length).toBe(4); expect(r.plannedNew).toBe(2);
    for (const s of r.perSet) expect(s.capViolations).toEqual([]);
    expect(r.dupAcross).toEqual([]);
    const ids = allItems(r).map((i) => i.problemId); expect(new Set(ids).size).toBe(ids.length);
    const repl = new Set(r.swaps.map((s) => s.newProblemId)); const newIds = new Set(r.newSets.flat().map((i) => i.problemId));
    for (const id of repl) expect(newIds.has(id as string)).toBe(false);
    expect(r.groupErrors).toEqual([]);
  });
  it("교체는 같은 칸(영역·난이도·형식)·같은 skill 우선이고 fallback 은 같은 skill 후보가 없을 때만", () => {
    const { dump, topics } = synth(); const r = rebalance(dump, W, topics, opts);
    for (const s of r.swaps) { expect(s.status).not.toBe("NO_REPLACEMENT"); expect(s.sameSkill).toBe(s.status === "ok"); }
    expect(r.swaps.every((s) => s.sameSkill)).toBe(true); // 합성 은행은 칸마다 같은 skill 후보가 충분하다
    const strict = rebalance(dump, W, topics, { ...opts, allowSkillFallback: false }); expect(strict.swaps.every((s) => s.sameSkill || s.status === "NO_REPLACEMENT")).toBe(true);
  });
  it("보관된 문제와 세트 간 중복은 강제 교체, 현재 게시 버전으로 갱신", () => {
    const { dump, topics } = synth();
    const victim = dump.items.find((i: any) => i.exam_set_id === "set1" && i.section === "math" && i.position === 7);
    dump.problems.find((p: any) => p.id === victim.problem_id).archived_at = "2026-10-08";
    const dupSrc = dump.items.find((i: any) => i.exam_set_id === "set1" && i.section === "math" && i.position === 8);
    const dupTarget = dump.items.find((i: any) => i.exam_set_id === "set2" && i.section === "math" && i.position === 8);
    dupTarget.problem_id = dupSrc.problem_id; dupTarget.problem_version_id = dupSrc.problem_version_id; dupTarget.difficulty = dupSrc.difficulty; dupTarget.skill_code = dupSrc.skill_code; // 같은 칸이 아닐 수 있어 난이도·skill 도 맞춘다
    const keep = dump.items.find((i: any) => i.exam_set_id === "set2" && i.section === "math" && i.position === 9);
    const v = dump.versions.find((x: any) => x.problem_id === keep.problem_id); const oldId = v.id; v.id = "v-fixed"; // 수정 버전이 게시됨
    const r = rebalance(dump, W, topics, opts);
    expect(r.swaps.find((s) => s.oldProblemId === victim.problem_id)?.reason).toBe("archived_problem");
    expect(r.swaps.find((s) => s.oldProblemId === dupSrc.problem_id && s.setName === "SAT Practice Test 2")?.reason).toBe("duplicate_in_collection");
    expect(r.dupAcross).toEqual([]);
    expect(allItems(r).some((i) => i.problemId === victim.problem_id)).toBe(false);
    const bumped = r.finalSets.find((s) => s.name === "SAT Practice Test 2")!.items.find((i) => i.problemId === keep.problem_id)!; expect(bumped.versionId).toBe("v-fixed"); expect(oldId).not.toBe("v-fixed");
    expect(r.versionBumped.length).toBe(1);
  });
  it("재고가 모자라면 새 세트 수를 줄이고 칸별 부족을 보고한다", () => {
    const { dump, topics } = synth(); dump.problems = dump.problems.filter((p: any) => !(p.sat_domain === "algebra" && Number(p.id.slice(-3)) >= 200)); // 수학 재고 절반으로 축소
    const r = rebalance(dump, W, topics, { ...opts, total: 6 });
    expect(r.plannedNew).toBeLessThan(4); expect(r.shortfallsAtRequestedNew.length).toBeGreaterThan(0);
    const ids = allItems(r).map((i) => i.problemId); expect(new Set(ids).size).toBe(ids.length);
  });
  it("재실행해도 같은 결과(결정적)", () => {
    const a = synth(); const b = synth();
    expect(JSON.stringify(rebalance(a.dump, W, a.topics, opts).swaps)).toBe(JSON.stringify(rebalance(b.dump, W, b.topics, opts).swaps));
  });
});

describe("generationNeed", () => {
  it("과목 하한에 모자란 칸만 부족분을 센다", () => {
    const topics: TopicMap = new Map([["a", { subject: "literature_fiction", cluster: "x" }], ["b", { subject: "literature_fiction", cluster: "y" }], ["c", { subject: "social_science", cluster: "z" }]]);
    const plan: any[] = [{ problemId: "a", skill: "s1", difficulty: "easy" }, { problemId: "b", skill: "s1", difficulty: "easy" }];
    const mix = { literature_fiction: 50, social_science: 50 };
    const g = generationNeed(plan, [{ problemId: "c", satDomain: "rw_information_ideas", skillCode: "s1", difficulty: "easy", format: "mc", similarityGroup: null, problemVersionId: "vc" } as any], topics, { mix, mixTol: 0 });
    expect(g.totalItemsCellLevel).toBe(0); // 문학 1(공급 2) + 사회과학 1(공급 1) 필요 — 모두 충족
    const g2 = generationNeed(plan, [], topics, { mix, mixTol: 0 });
    expect(g2.bySubjectCellLevel).toEqual({ social_science: 1 }); expect(g2.perCell[0].cell).toBe("s1|easy");
  });
});
