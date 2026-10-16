import { describe, expect, it, vi } from "vitest";
import { computeBatchStatus, loadBatch, runBatchSequence, violation, type BatchRun, type LoadStepInput, type LoadStepResult } from "./load-batch";

// 서비스 계층을 가짜로 바꿔 오케스트레이션 규칙만 검증한다: 건너뜀에서 멈춤, 변환 20건 청크 반복, 상한, 감사(단계 호출) 기록, 가드 거부, 멱등.
const res = (o: Partial<LoadStepResult> & { counts?: Record<string, number> }): LoadStepResult => ({ mode: "dry_run", executed: false, counts: {}, lines: [], planHash: "h", blocked: null, ok: true, ...o });

type Sim = { convertible: number; loaded: boolean; toRender: number; toScreen: number; skippedRender: number; failConvertAt?: number; keys: number };
/** 간단한 배치 시뮬레이터: 단계 호출을 기록하고(= 감사 로그 한 줄씩) 상태를 갱신한다. */
function sim(init: Partial<Sim> = {}) {
  const s: Sim = { convertible: 45, loaded: false, toRender: 3, toScreen: 3, skippedRender: 0, keys: 45, ...init };
  const calls: LoadStepInput[] = [];
  let convertCalls = 0;
  const step = vi.fn(async (i: LoadStepInput): Promise<LoadStepResult> => {
    calls.push(i);
    const mode = i.execute ? "execute" : "dry_run";
    if (i.step === "import") {
      const insert = s.loaded ? 0 : s.keys;
      if (i.execute) s.loaded = true;
      return res({ mode, executed: i.execute, planHash: "imp-" + insert, counts: { insert, update: 0 } });
    }
    if (i.step === "render") { const r = s.toRender; if (i.execute) s.toRender = 0; return res({ mode, executed: i.execute, planHash: "r-" + r, counts: { toRecord: r, skipped: s.skippedRender, recordedNow: i.execute ? r : 0, remaining: 0 } }); }
    if (i.step === "screen") { const r = s.toScreen; if (i.execute) s.toScreen = 0; return res({ mode, executed: i.execute, planHash: "s-" + r, counts: { toRecord: r, skipped: 0, recordedNow: i.execute ? r : 0, remaining: 0 } }); }
    const thisRun = Math.min(20, s.convertible);
    if (i.execute) { convertCalls++; if (s.failConvertAt === convertCalls) throw new Error("rpc boom"); s.convertible -= thisRun; }
    return res({ mode, executed: i.execute, planHash: "c-" + thisRun + "-" + s.convertible, counts: { passKeys: s.keys, convertible: i.execute ? thisRun : s.convertible, thisRun, alreadyConverted: s.keys - (i.execute ? thisRun : s.convertible) - 0, notReviewReady: 0, skipped: 0, convertedNow: i.execute ? thisRun : 0, skippedNow: 0, remaining: 0 } });
  });
  return { s, step, calls };
}
const deps = (step: ReturnType<typeof sim>["step"], canWrite = true, maxRounds?: number) => ({ step, canWrite, hasLoadStep: () => true, maxRounds });
const previewHashOf = async (step: ReturnType<typeof sim>["step"]) => (await loadBatch(deps(step), "b", false)).previewHash;

describe("loadBatch", () => {
  it("①→④ 를 순서대로 실행하고 변환은 20건씩 ⌈n/20⌉ 회 반복해 남은 0 에서 끝낸다", async () => {
    const f = sim({ convertible: 45 });
    const ph = await previewHashOf(f.step); expect(ph).toBeTruthy();
    f.calls.length = 0;
    const run = await loadBatch(deps(f.step), "b", true, ph);
    expect(run.ok).toBe(true); expect(run.completed).toBe(true);
    const exec = f.calls.filter((c) => c.execute).map((c) => c.step);
    expect(exec).toEqual(["import", "render", "screen", "convert", "convert", "convert"]); // 45 = 20+20+5
    expect(f.s.convertible).toBe(0);
    // 실행된 모든 단계는 직전 dry-run 의 해시로 호출된다(단일 단계 흐름과 같은 규칙).
    for (const c of f.calls.filter((x) => x.execute)) expect(c.planHash).toBeTruthy();
  });
  it("멱등: 이미 끝난 배치를 다시 돌리면 쓰기 호출 0", async () => {
    const f = sim({ convertible: 0, toRender: 0, toScreen: 0, loaded: true });
    const ph = await previewHashOf(f.step); f.calls.length = 0;
    const run = await loadBatch(deps(f.step), "b", true, ph);
    expect(run.ok).toBe(true); expect(f.calls.filter((c) => c.execute)).toEqual([]);
  });
  it("건너뜀이 있으면 그 단계에서 즉시 멈추고 다음 단계는 호출하지 않는다", async () => {
    const f = sim({ skippedRender: 2 });
    const ph = await previewHashOf(f.step);
    expect(ph).toBeNull(); // 미리보기에서 이미 위반 → 해시 없음 = 실행 불가
    const run = await loadBatch(deps(f.step), "b", true, "whatever");
    expect(run.ok).toBe(false); expect(run.stoppedAt?.step).toBe("render"); expect(run.stoppedAt?.reason).toMatch(/건너뜀 2건/);
    expect(f.calls.some((c) => c.execute)).toBe(false);
  });
  it("실행 중 오류가 나면 그 위치에서 멈추고 이후 호출이 없다", async () => {
    const f = sim({ convertible: 45, failConvertAt: 2 });
    const ph = await previewHashOf(f.step); f.calls.length = 0;
    const run = await loadBatch(deps(f.step), "b", true, ph);
    expect(run.ok).toBe(false); expect(run.stoppedAt).toMatchObject({ step: "convert", reason: "rpc boom" });
    expect(f.calls.filter((c) => c.execute && c.step === "convert")).toHaveLength(2);
  });
  it("반복 상한을 넘으면 오류로 멈춘다", async () => {
    const f = sim({ convertible: 45 });
    const ph = await previewHashOf(f.step);
    const run = await loadBatch(deps(f.step, true, 2), "b", true, ph);
    expect(run.ok).toBe(false); expect(run.stoppedAt?.step).toBe("convert"); expect(run.stoppedAt?.reason).toMatch(/반복 상한\(2회\)/);
  });
  it("쓰기 허용 목록 밖이면 어떤 단계도 호출하지 않고 거부한다", async () => {
    const f = sim();
    const run = await loadBatch(deps(f.step, false), "b", true, "h");
    expect(run.ok).toBe(false); expect(run.stoppedAt?.step).toBe("guard"); expect(f.step).not.toHaveBeenCalled();
  });
  it("미리보기 해시가 없거나 달라지면 쓰기 0 으로 거부한다", async () => {
    const f = sim();
    expect((await loadBatch(deps(f.step), "b", true, null)).stoppedAt?.step).toBe("preview");
    const stale = await loadBatch(deps(f.step), "b", true, "stale");
    expect(stale.stoppedAt?.reason).toMatch(/계획이 달라졌습니다/); expect(f.calls.some((c) => c.execute)).toBe(false);
  });
  it("미리보기는 dry-run 만 호출한다", async () => {
    const f = sim(); await loadBatch(deps(f.step), "b", false);
    expect(f.calls.every((c) => !c.execute)).toBe(true); expect(f.calls.map((c) => c.step)).toEqual(["import", "render", "screen", "convert"]);
  });
  it("적재 단계가 없는 배치는 ②③④ 만", async () => {
    const f = sim(); await loadBatch({ ...deps(f.step), hasLoadStep: () => false }, "b", false);
    expect(f.calls.map((c) => c.step)).toEqual(["render", "screen", "convert"]);
  });
  it("실행 시점에 검증 안 끝난 후보가 남으면 변환을 시작하지 않는다", () => {
    const r = res({ counts: { passKeys: 10, notReviewReady: 3, convertible: 0, alreadyConverted: 7, skipped: 0 } });
    expect(violation("convert", r, false)).toBeNull(); expect(violation("convert", r, true)).toMatch(/3건/);
    expect(violation("convert", res({ counts: { passKeys: 10, convertible: 5, alreadyConverted: 3 } }), true)).toMatch(/2건/);
  });
  it("가드/차단 결과(blocked)와 적재 충돌은 위반", () => {
    expect(violation("render", res({ blocked: "허용 목록" }), false)).toBe("허용 목록");
    expect(violation("import", res({ counts: { payloadSkipped: 1 } }), false)).toMatch(/건너뛴/);
    expect(violation("import", res({ counts: { stateConflictsKept: 1 } }), false)).toMatch(/충돌/);
  });
});

describe("runBatchSequence", () => {
  const ok = (id: string): BatchRun => ({ batchId: id, mode: "execute", ok: true, completed: true, previewHash: "h", stoppedAt: null, entries: [] });
  it("첫 중단에서 멈추고 다음 배치는 시작하지 않는다", async () => {
    const seen: string[] = [];
    const out = await runBatchSequence(["a", "b", "c"], async (id) => { seen.push(id); return id === "b" ? { ...ok(id), ok: false, stoppedAt: { step: "render", reason: "x" } } : ok(id); });
    expect(seen).toEqual(["a", "b"]); expect(out.stoppedAt).toEqual({ batchId: "b", step: "render", reason: "x" }); expect(out.completed).toBe(1);
  });
  it("예외도 중단으로 처리하고 진행 콜백을 배치마다 부른다", async () => {
    const prog: string[] = [];
    const out = await runBatchSequence(["a", "b"], async (id) => { if (id === "b") throw new Error("net"); return ok(id); }, (r) => prog.push(r.batchId));
    expect(prog).toEqual(["a", "b"]); expect(out.stoppedAt?.reason).toBe("net");
  });
  it("모두 성공하면 stoppedAt 없음", async () => {
    expect((await runBatchSequence(["a", "b"], async (id) => ok(id))).stoppedAt).toBeNull();
  });
});

describe("computeBatchStatus", () => {
  it("적재·렌더·화면·변환 수와 완료 여부를 계산한다", () => {
    const rows = ["k1", "k2", "k3"].map((k, i) => ({ candidate_key: k, review_state: "auto_passed", render_verified: true, screen_verified: i < 2, review_env_ready: i < 2 }));
    const [a, b] = computeBatchStatus([{ id: "a", keys: ["k1", "k2", "k3", "k4"] }, { id: "b", keys: ["k1"] }], rows as never, new Set(["k1"]));
    expect(a).toMatchObject({ keys: 4, loaded: 3, render: 3, screen: 2, ready: 2, converted: 1, done: false });
    expect(b).toMatchObject({ converted: 1, done: true });
  });
});
