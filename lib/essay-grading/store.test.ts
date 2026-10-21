import { describe, expect, it } from "vitest";
import { createSupabaseEssayStore } from "./store";
import { processEssay, type EssayKey } from "./queue";
import { worstCaseUsd, limits } from "./costs";

type R = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
// 두 테이블(행·원장)과 월 지출·예약 RPC 를 메모리로 흉내 낸다. RPC 는 마이그레이션 SQL(essay_ai_month_spend / reserve_essay_ai_budget)과 같은 규칙:
// 확정(settled·legacy) + 이벤트 없는 기존 행(updated_at) + 30분 이내 예약, UTC 월 [시작, 다음 달 시작).
function fakeAdmin(rows: R[], events: R[] = [], clock: { t: Date } = { t: new Date() }) {
  let seq = 0;
  const monthSpend = (nowIso: string) => {
    const n = new Date(nowIso), s = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1), e = Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 1);
    const inM = (iso: string) => new Date(iso).getTime() >= s && new Date(iso).getTime() < e;
    const fin = (v: R) => v.state === "settled" || v.state === "legacy";
    let sum = 0;
    for (const v of events) if (fin(v) && inM(v.occurred_at)) sum += Number(v.cost_usd);
    for (const r of rows) if (Number(r.cost_usd) > 0 && !events.some((v) => v.essay_score_id === r.id && fin(v)) && inM(r.updated_at)) sum += Number(r.cost_usd);
    for (const v of events) if (v.state === "reserved" && inM(v.occurred_at) && new Date(v.created_at).getTime() > n.getTime() - 30 * 60_000) sum += Number(v.cost_usd);
    return Math.round(sum * 100_000) / 100_000;
  };
  const table = (name: string) => {
    const data = name === "mock_exam_essay_scores" ? rows : events;
    return {
      select: (_c?: string, o?: { head?: boolean }) => {
        const f: Array<(r: R) => boolean> = [];
        const c: R = {};
        c.eq = (k: string, v: unknown) => { f.push((r) => r[k] === v); return c; };
        c.in = (k: string, vs: unknown[]) => { f.push((r) => vs.includes(r[k])); return c; };
        for (const m of ["neq", "or", "gte"]) c[m] = () => c; // usage() 의 응시·일일 건수 조회는 이 테스트의 대상이 아니다(월 지출만 본다)
        const run = () => data.filter((r) => f.every((x) => x(r)));
        c.maybeSingle = async () => ({ data: run()[0] ?? null });
        c.then = (res: (v: unknown) => unknown) => res(o?.head ? { count: run().length, data: null } : { data: run(), count: run().length });
        return c;
      },
      update: (patch: R) => {
        const f: Array<(r: R) => boolean> = [];
        const c: R = { eq: (k: string, v: unknown) => { f.push((r) => r[k] === v); return c; }, then: (res: (v: unknown) => unknown) => { data.filter((r) => f.every((x) => x(r))).forEach((r) => Object.assign(r, patch)); return res({ data: null }); } };
        return c;
      },
      insert: async (row: R) => { data.push({ id: `e${++seq}`, created_at: clock.t.toISOString(), occurred_at: clock.t.toISOString(), ...row }); return { data: null }; },
    };
  };
  return {
    from: (n: string) => table(n),
    rpc: async (fn: string, a: R) => {
      if (fn === "essay_ai_month_spend") return { data: monthSpend(a.p_now) };
      if (monthSpend(a.p_now) + a.p_amount > a.p_budget) return { data: null };
      const id = `res${++seq}`;
      events.push({ id, essay_score_id: a.p_score_id, student_id: a.p_student_id, state: "reserved", cost_usd: a.p_amount, occurred_at: a.p_now, created_at: a.p_now });
      return { data: id };
    },
  } as never;
}
const key: EssayKey = { attemptId: "a", setItemId: "i", partLabel: "x", studentId: "s" };
const row = (over: R = {}): R => ({ id: "row1", attempt_id: "a", set_item_id: "i", part_label: "x", rubric_version: "englang-v2", cost_usd: 0, input_tokens: 0, output_tokens: 0, updated_at: "2026-09-10T00:00:00.000Z", ...over });
const at = (iso: string) => () => new Date(iso);
const monthOf = async (rows: R[], events: R[], iso: string) => (await createSupabaseEssayStore(fakeAdmin(rows, events), at(iso)).usage(key)).monthSpendUsd;
const OCT = "2026-10-15T12:00:00.000Z", SEP = "2026-09-15T12:00:00.000Z";

describe("essay store 비용 원장 — 월별 귀속", () => {
  it("전월 $0.10(원장 이전 행) + 이번 달 재시도 $0.02 → 전월 0.10, 이번 달 0.02, 누적 0.12", async () => {
    const rows = [row({ cost_usd: 0.1, input_tokens: 1000, output_tokens: 100, updated_at: "2026-09-20T00:00:00.000Z" })];
    const events: R[] = [];
    const store = createSupabaseEssayStore(fakeAdmin(rows, events), at(OCT));
    expect(await monthOf(rows, events, SEP)).toBe(0.1); // 재시도 전: 전월 행은 전월 비용
    await store.finish(key, { status: "done", costUsd: 0.02, inputTokens: 200, outputTokens: 20 });
    expect(rows[0].cost_usd).toBe(0.12); // 응답별 누적
    expect(await monthOf(rows, events, OCT)).toBe(0.02); // 이번 달은 재시도분만
    expect(await monthOf(rows, events, SEP)).toBe(0.1); // 완료된 달의 집계가 재시도로 바뀌지 않는다
  });
  it("원장 기반 행도 같다: 9월 $0.10 실행, 10월 $0.02 재시도", async () => {
    const rows = [row()]; const events: R[] = []; const clock = { t: new Date(SEP) };
    await createSupabaseEssayStore(fakeAdmin(rows, events, clock), at(SEP)).finish(key, { status: "failed", costUsd: 0.1, inputTokens: 1, outputTokens: 1 });
    clock.t = new Date(OCT);
    await createSupabaseEssayStore(fakeAdmin(rows, events, clock), at(OCT)).finish(key, { status: "done", costUsd: 0.02, inputTokens: 1, outputTokens: 1 });
    expect(rows[0].cost_usd).toBe(0.12);
    expect([await monthOf(rows, events, SEP), await monthOf(rows, events, OCT)]).toEqual([0.1, 0.02]);
  });
  it("모델 호출 없는 상태 갱신(비용 0·한도 대기)은 updated_at 이 바뀌어도 월 귀속을 옮기지 않는다", async () => {
    const rows = [row({ cost_usd: 0.1, updated_at: "2026-09-20T00:00:00.000Z" })]; const events: R[] = [];
    const store = createSupabaseEssayStore(fakeAdmin(rows, events), at(OCT));
    await store.finish(key, { status: "failed", lastError: "daily_cap" });
    await store.finish(key, { status: "failed", costUsd: 0, inputTokens: 0, outputTokens: 0 });
    expect(rows[0].cost_usd).toBe(0.1);
    expect(rows[0].updated_at).toBe(OCT); // updated_at 은 갱신됐지만
    expect(await monthOf(rows, events, OCT)).toBe(0); // 이번 달 지출 아님
    expect(await monthOf(rows, events, SEP)).toBe(0.1); // legacy 이벤트로 고정돼 전월에 남는다
  });
  it("원장 기반 행은 비용 0 갱신으로 월 집계가 불변이다", async () => {
    const rows = [row()]; const events: R[] = []; const clock = { t: new Date(SEP) };
    await createSupabaseEssayStore(fakeAdmin(rows, events, clock), at(SEP)).finish(key, { status: "failed", costUsd: 0.1, inputTokens: 1, outputTokens: 1 });
    const store = createSupabaseEssayStore(fakeAdmin(rows, events, clock), at(OCT));
    await store.finish(key, { status: "failed", lastError: "daily_cap" });
    await store.finish(key, { status: "failed", costUsd: 0, inputTokens: 0, outputTokens: 0 });
    expect(rows[0].updated_at).toBe(OCT);
    expect([await monthOf(rows, events, SEP), await monthOf(rows, events, OCT)]).toEqual([0.1, 0]);
  });
  it("월 경계(UTC) 직전·직후 실행은 각각 그 달", async () => {
    const before = "2026-09-30T23:59:59.999Z", after = "2026-10-01T00:00:00.000Z";
    const rows = [row()]; const events: R[] = []; const clock = { t: new Date(before) };
    await createSupabaseEssayStore(fakeAdmin(rows, events, clock), at(before)).finish(key, { status: "failed", costUsd: 0.03, inputTokens: 1, outputTokens: 1 });
    clock.t = new Date(after);
    await createSupabaseEssayStore(fakeAdmin(rows, events, clock), at(after)).finish(key, { status: "done", costUsd: 0.05, inputTokens: 1, outputTokens: 1 });
    expect([await monthOf(rows, events, before), await monthOf(rows, events, after)]).toEqual([0.03, 0.05]);
  });
  it("대기 행(비용 없음)은 지출 0, 비용 없는 finish 는 누적을 건드리지 않는다", async () => {
    const rows = [row({ cost_usd: 0.1, input_tokens: 1000, output_tokens: 100 })];
    const store = createSupabaseEssayStore(fakeAdmin(rows, []), at(OCT));
    await store.finish(key, { status: "failed", lastError: "monthly_budget", nextRetryAt: "2026-11-01T00:00:00.000Z" });
    expect(rows[0]).toMatchObject({ cost_usd: 0.1, input_tokens: 1000, output_tokens: 100 });
    await store.finish(key, { status: "failed", costUsd: 0, inputTokens: 0, outputTokens: 0 });
    expect(rows[0].cost_usd).toBe(0.1); // 호출 전 실패(0)가 과거 지출을 지우지 않는다
    expect(await monthOf([row()], [], OCT)).toBe(0); // 비용 없는 대기 행
  });
});

describe("essay store 월 예산 원자적 예약", () => {
  it("예약은 잔여 예산을 선점한다 — 같은 잔여를 본 두 번째 요청은 거절, 정산(실비) 후 다시 가능", async () => {
    const w = worstCaseUsd(limits());
    const rows = [row()]; const events: R[] = [];
    const store = createSupabaseEssayStore(fakeAdmin(rows, events), at(OCT));
    const budget = w * 1.5; // 한 건만 들어간다
    const a = await store.reserveBudget!(key, w, budget);
    const b = await store.reserveBudget!(key, w, budget);
    expect(a.ok).toBe(true); expect(b.ok).toBe(false);
    await store.finish(key, { status: "done", costUsd: 0.08, inputTokens: 1, outputTokens: 1, reservationId: (a as { reservationId: string }).reservationId });
    expect(events.filter((e) => e.state === "reserved")).toHaveLength(0); // 정산됨
    expect(await monthOf(rows, events, OCT)).toBe(0.08);
    expect((await store.reserveBudget!(key, w, budget)).ok).toBe(true); // 실비 0.08 만 남아 다시 예약 가능
  });
  it("호출이 없었던 실패는 예약을 0 으로 해제한다", async () => {
    const rows = [row()]; const events: R[] = [];
    const store = createSupabaseEssayStore(fakeAdmin(rows, events), at(OCT));
    const r = await store.reserveBudget!(key, 0.234, 1) as { reservationId: string };
    await store.finish(key, { status: "failed", lastError: "no_key", costUsd: 0, inputTokens: 0, outputTokens: 0, reservationId: r.reservationId });
    expect(await monthOf(rows, events, OCT)).toBe(0);
  });
  it("30분 넘게 정산되지 않은 예약은 월 합계에서 빠진다(비정상 종료 대비)", async () => {
    const rows = [row()]; const events: R[] = [{ id: "x", essay_score_id: "row1", state: "reserved", cost_usd: 0.2, occurred_at: OCT, created_at: "2026-10-15T11:00:00.000Z" }];
    expect(await monthOf(rows, events, OCT)).toBe(0);
  });
  it("processEssay: 예약이 거절되면 모델 호출 없이 월 예산 대기, 허용되면 실비로 정산", async () => {
    process.env.AI_ESSAY_GRADING_ENABLED = "true";
    let calls = 0; const finishes: unknown[] = [];
    const mk = (ok: boolean) => ({
      claim: async () => ({ claimed: true, row: { status: "pending", attemptsMade: 0, nextRetryAt: null } }),
      usage: async () => ({ attemptEssays: 0, accountEssaysToday: 0, monthSpendUsd: 0 }),
      reserveBudget: async () => (ok ? { ok: true as const, reservationId: "res1" } : { ok: false as const }),
      finish: async (_k: unknown, f: unknown) => { finishes.push(f); },
    });
    const client = { grade: async () => { calls++; throw new Error("grader_error"); } } as never;
    const job = { ...key, taskPrompt: "p", sources: [], essay: "word ".repeat(300), anchors: [{ score: 3, text: "a" }, { score: 4, text: "b" }, { score: 5, text: "c" }] } as never;
    const r1 = await processEssay({ store: mk(false) as never, client }, job);
    expect(r1).toEqual({ status: "failed", error: "monthly_budget" }); expect(calls).toBe(0);
    await processEssay({ store: mk(true) as never, client }, job);
    expect(finishes.at(-1)).toMatchObject({ reservationId: "res1", costUsd: 0 });
    delete process.env.AI_ESSAY_GRADING_ENABLED;
  });
});
