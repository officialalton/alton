import { describe, expect, it } from "vitest";
import { buildLaunchGateReport, fetchLaunchGateReport, launchReasons, type LaunchSetItem, type LaunchStatusRow } from "./launch-gate";

const ok = (k: string, o: Partial<LaunchStatusRow> = {}): LaunchStatusRow => ({ candidate_key: k, release_tier: "review_env", review_state: "auto_passed", render_verified: true, screen_verified: true, review_env_ready: true, open_reports: 0, open_defect_reports: 0, open_blockers: 0, defect_flags: [], ...o });
const set = (id: string, name = id) => ({ id, name, status: "published", label: "full_practice", versionNo: 1 });
const mk = (setId: string, pos: number, key: string | null): LaunchSetItem => ({ setId, section: "ap_mc_a", position: pos, problemId: `p-${setId}-${pos}`, candidateKey: key });

describe("launchReasons", () => {
  it("모든 미충족 사유를 한국어로 낸다", () => {
    const r = launchReasons(ok("k", { release_tier: "candidate", review_state: "needs_revalidation", render_verified: false, screen_verified: false, defect_flags: ["unbalanced_braces"], open_defect_reports: 2, open_blockers: 1, open_reports: 3 }), ["wrong_key"]);
    expect(r.join("|")).toContain("검수 환경 미게시(현재 candidate)");
    expect(r.join("|")).toContain("자동 게이트 미통과(needs_revalidation)");
    expect(r.join("|")).toContain("렌더 검증 없음");
    expect(r.join("|")).toContain("학생 화면 검증 없음");
    expect(r.join("|")).toContain("생성기 결함 플래그: unbalanced_braces");
    expect(r.join("|")).toContain("오답·문항 결함 신고 2건");
    expect(r.join("|")).toContain("launch 차단 결함 1건(오답 키)");
    expect(r.join("|")).toContain("일반 오류 신고 1건(차단은 아님)");
  });
  it("상태 행이 없으면 현재 적재본이 아님으로 표시", () => { expect(launchReasons(undefined, [])[0]).toContain("후보 상태 없음"); });
});

describe("buildLaunchGateReport", () => {
  it("준비 문항만 있는 세트는 통과, 하나라도 빠지면 차단 + 사유", () => {
    const status = [ok("a"), ok("b"), ok("c", { open_blockers: 1 }), ok("d", { open_reports: 2, open_defect_reports: 1, open_blockers: 0 })];
    const blockers = [{ candidate_key: "c", category: "wrong_figure" }];
    const rep = buildLaunchGateReport([set("S1"), set("S2")], [mk("S1", 1, "a"), mk("S1", 2, "b"), mk("S2", 1, "a"), mk("S2", 2, "c"), mk("S2", 3, "d"), mk("S2", 4, null)], status, blockers, new Set(["a", "b"]));
    const s1 = rep.sets.find((s) => s.id === "S1")!; const s2 = rep.sets.find((s) => s.id === "S2")!;
    expect(s1.ready).toBe(true); expect(s1.verdict).toBe("출시 게이트 통과 가능"); expect(s1.blocked).toEqual([]);
    expect(s2.ready).toBe(false); expect(s2.itemCount).toBe(4); expect(s2.readyCount).toBe(1); expect(s2.blockedCount).toBe(3);
    expect(s2.openBlockers).toBe(1); expect(s2.openDefectReports).toBe(1); expect(s2.openErrorReports).toBe(2);
    expect(s2.blocked.find((b) => b.candidateKey === "c")!.reasons.join()).toContain("그림·표 오류");
    expect(s2.blocked.find((b) => b.candidateKey === null)!.reasons[0]).toContain("후보 연결 없음");
    expect(rep.totals).toMatchObject({ sets: 2, readySets: 1, blockedItems: 3, openBlockers: 1, openDefectReports: 1, openErrorReports: 2, globalOpenBlockers: 1 });
  });
  it("준비 뷰에 없으면(상태 뷰 조건을 모두 만족해 보여도) 차단으로 센다", () => {
    const rep = buildLaunchGateReport([set("S")], [mk("S", 1, "x")], [ok("x")], [], new Set());
    expect(rep.sets[0].ready).toBe(false);
  });
  it("문항 없는 세트는 통과로 보지 않는다", () => {
    expect(buildLaunchGateReport([set("E")], [], [], [], new Set()).sets[0]).toMatchObject({ ready: false, verdict: "문항 없음" });
  });
});

// 읽기 전용 증명: select/in/is/neq/eq/order/range 만 쓰고 insert/update/upsert/delete/rpc 를 호출하면 실패하는 가짜 클라이언트.
function fakeDb(tables: Record<string, unknown[]>) {
  const calls: string[] = [];
  const q = (name: string) => {
    calls.push(name);
    const rows = tables[name] ?? [];
    const b: Record<string, unknown> = {};
    const chain = () => b;
    for (const m of ["select", "eq", "neq", "in", "is", "order"]) b[m] = chain;
    b.range = (a: number, z: number) => Promise.resolve({ data: rows.slice(a, z + 1), error: null });
    b.then = (res: (v: unknown) => void) => res({ data: rows, error: null });
    for (const m of ["insert", "update", "upsert", "delete"]) b[m] = () => { throw new Error(`쓰기 호출 금지: ${m}`); };
    return b;
  };
  return { db: { from: q, rpc: () => { throw new Error("rpc 금지"); } } as never, calls };
}

describe("fetchLaunchGateReport", () => {
  it("6개 읽기 쿼리만 쓰고 결과를 조립한다", async () => {
    const { db, calls } = fakeDb({
      mock_exam_sets: [{ id: "S1", name: "AP Calculus AB — Practice Exam", status: "published", ap_label: "full_practice", version_no: 2 }],
      mock_exam_set_items: [{ exam_set_id: "S1", section: "ap_mc_a", position: 1, problem_id: "p1" }, { exam_set_id: "S1", section: "ap_mc_a", position: 2, problem_id: "p2" }],
      ap_candidate_problems: [{ problem_id: "p1", candidate_key: "a" }, { problem_id: "p2", candidate_key: "b" }],
      ap_item_review_status_v: [ok("a"), ok("b", { open_blockers: 1 })],
      ap_launch_ready_v: [{ candidate_key: "a" }],
      ap_launch_blockers: [{ candidate_key: "b", category: "wrong_key" }],
    });
    const rep = await fetchLaunchGateReport(db);
    expect(calls.sort()).toEqual(["ap_candidate_problems", "ap_item_review_status_v", "ap_launch_blockers", "ap_launch_ready_v", "mock_exam_set_items", "mock_exam_sets"]);
    expect(rep.sets[0]).toMatchObject({ ready: false, itemCount: 2, readyCount: 1, openBlockers: 1, versionNo: 2 });
  });
  it("세트가 없으면 1회만 읽는다", async () => {
    const { db, calls } = fakeDb({ mock_exam_sets: [] });
    expect((await fetchLaunchGateReport(db)).sets).toEqual([]);
    expect(calls).toEqual(["mock_exam_sets"]);
  });
});
