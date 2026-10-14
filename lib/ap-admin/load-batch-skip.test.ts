import { describe, expect, it, vi } from "vitest";
import { loadBatch, type LoadStepInput, type LoadStepResult } from "./load-batch";

// 건너뜀 허용(opt-in) 모드 보장 테스트. 서비스 계층은 가짜(단계 호출 = 감사 로그 한 줄).
const res = (o: Partial<LoadStepResult>): LoadStepResult => ({ mode: "dry_run", executed: false, counts: {}, lines: [], planHash: "h", blocked: null, ok: true, ...o });

type TolSim = { renderSkips: { key: string; reason: string }[]; screenSkips: { key: string; reason: string }[]; notReady: string[]; convertible: number; convertSkipped: number; keys: number; missing: number };
function tolSim(init: Partial<TolSim> = {}) {
  const s: TolSim = { renderSkips: [], screenSkips: [], notReady: [], convertible: 25, convertSkipped: 0, keys: 30, missing: 0, ...init };
  const calls: LoadStepInput[] = [];
  const converted: number[] = [];
  const step = vi.fn(async (i: LoadStepInput): Promise<LoadStepResult> => {
    calls.push({ ...i });
    const mode = i.execute ? "execute" : "dry_run";
    if (i.step === "import") return res({ mode, executed: i.execute, planHash: "imp", counts: { insert: 0, update: 0 } });
    if (i.step === "render") return res({ mode, executed: i.execute, planHash: "r", counts: { toRecord: 0, skipped: s.renderSkips.length, remaining: 0 }, skips: s.renderSkips });
    if (i.step === "screen") return res({ mode, executed: i.execute, planHash: "s", counts: { toRecord: 0, skipped: s.screenSkips.length, remaining: 0 }, skips: s.screenSkips });
    const thisRun = Math.min(20, s.convertible);
    if (i.execute) { s.convertible -= thisRun; converted.push(thisRun); }
    const done = s.keys - s.convertible - s.notReady.length - s.convertSkipped;
    return res({ mode, executed: i.execute, planHash: "c-" + thisRun + "-" + s.convertible, counts: { passKeys: s.keys, convertible: s.convertible, thisRun, alreadyConverted: (i.execute ? done - thisRun : done) - s.missing, notReviewReady: s.notReady.length, skipped: s.convertSkipped, skippedNow: 0, convertedNow: i.execute ? thisRun : 0, remaining: 0 }, notReady: s.notReady });
  });
  return { s, step, calls, converted };
}
const noEv = (k: string) => ({ key: k, reason: "화면 증거 항목 없음" });
const deps = (f: ReturnType<typeof tolSim>, canWrite = true, maxRounds?: number) => ({ step: f.step, canWrite, hasLoadStep: () => true, maxRounds });
const runTol = async (f: ReturnType<typeof tolSim>, allow: boolean, maxRounds?: number) => {
  const pv = await loadBatch(deps(f), "b", false, null, allow);
  f.calls.length = 0;
  return { pv, run: await loadBatch(deps(f, true, maxRounds), "b", true, pv.previewHash, allow) };
};

describe("건너뜀 허용 모드", () => {
  it("기본(엄격)은 그대로: ③ 건너뜀이 즉시 멈추고 입력에 allowSkips 가 실리지 않는다", async () => {
    const f = tolSim({ screenSkips: [noEv("k1")], notReady: ["k1"] });
    const { pv, run } = await runTol(f, false);
    expect(pv.ok).toBe(false); expect(pv.stoppedAt?.step).toBe("screen"); expect(pv.previewHash).toBeNull();
    expect(run.ok).toBe(false); expect(f.calls.some((c) => c.execute)).toBe(false);
    expect(f.step.mock.calls.every(([i]) => !("allowSkips" in i))).toBe(true);
    expect(run.skipped).toEqual([]);
  });
  it("허용: ③ 증거 없음 5건을 건너뛰고 나머지만 20건씩 변환, 건너뛴 키는 남은 것 목록에 사유와 함께", async () => {
    const skips = ["a", "b", "c", "d", "e"];
    const f = tolSim({ screenSkips: skips.map(noEv), notReady: skips, convertible: 25, keys: 30 });
    const { pv, run } = await runTol(f, true);
    expect(pv.ok).toBe(true); expect(pv.skipped?.filter((x) => x.step === "screen").map((x) => x.key)).toEqual(skips);
    expect(run.ok).toBe(true); expect(run.completed).toBe(true);
    expect(run.skipped?.filter((x) => x.kind === "no_evidence")).toHaveLength(5);
    expect(run.remaining?.map((x) => x.key)).toEqual(skips); expect(run.remaining?.[0].reason).toMatch(/화면 증거 없음/);
    expect(f.converted).toEqual([20, 5]); expect(f.s.convertible).toBe(0); // 변환량은 건너뛴 키를 포함하지 않는 25건뿐
    expect(f.calls.every((c) => c.allowSkips === true)).toBe(true); // 감사용: 모든 단계 호출에 모드 표시(scope.skipTolerant)
  });
  it("허용 안 된 종류(결함 플래그·게이트 실패·증거 검증 실패)·목록 불일치는 허용 모드에서도 멈춘다", async () => {
    for (const reason of ["생성기 결함 플래그(x) — 렌더 검증 대상 아님", "렌더 게이트 실패(E1)", "모바일(<=430px) 점검 항목 없음"]) {
      const f = tolSim({ renderSkips: [{ key: "z", reason }] });
      const pv = await loadBatch(deps(f), "b", false, null, true);
      expect(pv.ok).toBe(false); expect(pv.stoppedAt?.step).toBe("render"); expect(pv.stoppedAt?.reason).toMatch(/허용되지 않는/);
    }
    const g = tolSim(); const orig = g.step.getMockImplementation()!;
    g.step.mockImplementation(async (i) => (i.step === "render" ? res({ counts: { skipped: 2 }, skips: [noEv("a")] }) : orig(i)));
    expect((await loadBatch(deps(g), "b", false, null, true)).stoppedAt?.reason).toMatch(/목록을 확인할 수 없어/);
  });
  it("렌더 보고서 없음·해시 불일치와 그 연쇄('렌더 먼저')는 허용, 앞 단계에서 건너뛰지 않은 키의 '렌더 먼저'는 실행 시 멈춘다", async () => {
    const ok = tolSim({ renderSkips: [{ key: "a", reason: "렌더 보고서(report.json)에 없는 후보" }, { key: "b", reason: "렌더한 버전과 DB 후보 내용이 다름(해시 불일치)" }], screenSkips: [{ key: "a", reason: "렌더 검증이 먼저입니다." }, { key: "b", reason: "렌더 검증이 먼저입니다." }], notReady: ["a", "b"], keys: 27 });
    const r = await runTol(ok, true);
    expect(r.run.ok).toBe(true); expect(r.run.skipped?.map((x) => x.kind).sort()).toEqual(["hash_mismatch", "not_review_ready", "not_review_ready", "render_prereq", "render_prereq", "render_report_missing"]);
    const bad = tolSim({ screenSkips: [{ key: "q", reason: "렌더 검증이 먼저입니다." }], notReady: ["q"] });
    const { pv, run } = await runTol(bad, true);
    expect(pv.ok).toBe(true); // 미리보기에서는 ② 가 아직 안 돈 행의 연쇄로 본다
    expect(run.ok).toBe(false); expect(run.stoppedAt?.step).toBe("screen"); expect(bad.calls.some((c) => c.execute && c.step === "convert")).toBe(false);
  });
  it("변환 불가(skipped)·DB 누락 키는 허용 모드에서도 멈추고 변환하지 않는다", async () => {
    const f = tolSim({ convertSkipped: 1 });
    const { pv, run } = await runTol(f, true);
    expect(pv.ok).toBe(false); expect(run.ok).toBe(false); expect(f.calls.some((c) => c.execute)).toBe(false);
    const g = tolSim({ keys: 40, convertible: 25, missing: 15 }); // 15건이 DB 에 없음
    const r2 = await runTol(g, true); expect(r2.run.ok).toBe(false); expect(r2.run.stoppedAt?.reason).toMatch(/DB 에 없는/);
    expect(g.converted).toEqual([]);
  });
  it("가드 거부·미리보기 해시 누락/불일치는 허용 모드에서도 쓰기 0, 엄격 해시로는 허용 실행 불가", async () => {
    const f = tolSim({ screenSkips: [noEv("a")], notReady: ["a"] });
    const pv = await loadBatch(deps(f), "b", false, null, true);
    f.calls.length = 0;
    expect((await loadBatch(deps(f, false), "b", true, pv.previewHash, true)).stoppedAt?.step).toBe("guard");
    expect((await loadBatch(deps(f), "b", true, null, true)).stoppedAt?.step).toBe("preview");
    expect((await loadBatch(deps(f), "b", true, "stale", true)).stoppedAt?.reason).toMatch(/계획이 달라졌습니다/);
    // 건너뛸 키 목록이 미리보기 뒤에 바뀌면(= 해시가 달라지면) 실행하지 않는다.
    f.s.screenSkips = [noEv("a"), noEv("b")]; f.s.notReady = ["a", "b"]; f.s.keys = 31;
    expect((await loadBatch(deps(f), "b", true, pv.previewHash, true)).stoppedAt?.reason).toMatch(/계획이 달라졌습니다/);
    expect(f.calls.some((c) => c.execute)).toBe(false);
  });
  it("④ 반복 상한을 지키고, 이미 끝난 배치 재실행은 쓰기 0 이며 같은 남은 것을 보고한다(멱등)", async () => {
    const f = tolSim({ screenSkips: [noEv("a")], notReady: ["a"], convertible: 45, keys: 46 });
    const capped = await runTol(f, true, 2);
    expect(capped.run.ok).toBe(false); expect(capped.run.stoppedAt?.reason).toMatch(/반복 상한\(2회\)/); expect(f.converted.length).toBeLessThanOrEqual(2);
    const g = tolSim({ screenSkips: [noEv("a")], notReady: ["a"], convertible: 0, keys: 1 });
    const again = await runTol(g, true);
    expect(again.run.ok).toBe(true); expect(g.calls.filter((c) => c.execute)).toEqual([]);
    expect(again.run.remaining?.map((x) => x.key)).toEqual(["a"]);
  });
});
