import { describe, expect, it } from "vitest";
import { checkPlan, decideSteps, replacedName, type CopyJob, type NewJob, type PlanItem, type SetRow } from "./rebalance-apply";

const it1 = (p: string): PlanItem => ({ versionId: `v${p}`, position: 1, problemId: p, moduleKey: "rw_m1", route: null, section: "rw", skill: "x", difficulty: "easy", domain: "rw_information_ideas" });
const row = (o: Partial<SetRow> & { id: string; name: string }): SetRow => ({ status: "published", archived_at: null, set_group_id: "g1", version_no: 1, access_tier: "free", ...o });
const copy: CopyJob = { kind: "copy", name: "SAT Practice Test 1", oldSetId: "old", items: [it1("a")] };
const ops = (s: { op: string }[]) => s.map((x) => x.op);

describe("rebalance-apply decideSteps", () => {
  it("수리본: 새 버전이 없으면 초안 생성→문항→검증, 이후 기존 개명·보관→공개→free", () => {
    const d = decideSteps(copy, [row({ id: "old", name: copy.name })], () => 0);
    expect(ops(d.phase1)).toEqual(["create_draft", "insert_items", "validate"]);
    expect(ops(d.phase2)).toEqual(["swap_old", "publish", "set_free"]);
    expect(d.phase2[0]).toMatchObject({ to: "SAT Practice Test 1 (replaced)" });
  });
  it("멱등: 이미 새 버전이 공개돼 있으면 건너뛴다(free 가 아니면 free 만)", () => {
    const sets = [row({ id: "old", name: replacedName(copy.name), status: "archived", archived_at: "t" }), row({ id: "n", name: copy.name, version_no: 2, access_tier: "free" })];
    expect(ops(decideSteps(copy, sets, () => 81).phase1)).toEqual(["skip"]);
    expect(ops(decideSteps(copy, sets, () => 81).phase2)).toEqual([]);
    sets[1].access_tier = "tutoring";
    expect(ops(decideSteps(copy, sets, () => 81).phase2)).toEqual(["set_free"]);
  });
  it("재개: 초안이 있고 문항이 이미 있으면 삽입을 건너뛴다", () => {
    const d = decideSteps(copy, [row({ id: "old", name: copy.name }), row({ id: "n", name: copy.name, status: "draft", version_no: 2, access_tier: null })], (id) => (id === "n" ? 147 : 0));
    expect(ops(d.phase1)).toEqual(["validate"]);
  });
  it("새 세트: 같은 이름의 보관 세트는 (replaced) 로 개명하고 새로 만든다", () => {
    const job: NewJob = { kind: "new", name: "SAT Practice Test 10", items: [it1("b")] };
    const d = decideSteps(job, [row({ id: "arch", name: "SAT Practice Test 10", status: "archived", archived_at: "t", set_group_id: "g9" })], () => 0);
    expect(ops(d.phase1)).toEqual(["create_draft", "insert_items", "validate"]);
    expect(d.phase2[0]).toEqual({ op: "rename_archived_conflict", setId: "arch", from: "SAT Practice Test 10", to: "SAT Practice Test 10 (replaced)" });
    expect(ops(d.phase2).slice(1)).toEqual(["publish", "set_free"]);
  });
  it("checkPlan: 세트 간 problem 중복을 잡는다", () => {
    expect(checkPlan([copy, { kind: "new", name: "SAT Practice Test 10", items: [it1("b")] }])).toEqual([]);
    expect(checkPlan([copy, { kind: "new", name: "SAT Practice Test 10", items: [it1("a")] }]).length).toBe(1);
  });
});
