import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveStockTarget } from "./env-guard";
import { recordRun, runAssemble, runConvert, runImport, runVerify, type Ctx } from "./service";

// DB 를 가짜로 바꿔 "쓰기 가드·확인 해시" 규칙만 검증한다(실제 DB 통합은 service.integration.test.ts).
const NONPROD = "worpsqwqgnspddnrtnvq";
function fakeDb(rows: unknown[] = []) {
  const writes: string[] = [];
  const chain: unknown = new Proxy(function () {}, {
    get: (_t, p) => (p === "then" ? (res: (v: unknown) => void) => res({ data: rows, error: null, count: 0 }) : () => chain),
    apply: () => chain,
  });
  const db = { from: vi.fn(() => chain), rpc: vi.fn(async (fn: string) => { writes.push(fn); return { data: null, error: null }; }) };
  return { db: db as unknown as SupabaseClient, raw: db, writes };
}
const ctx = (db: SupabaseClient, allowed: boolean): Ctx => ({ db, actorId: "admin-1", target: resolveStockTarget({ NEXT_PUBLIC_SUPABASE_URL: `https://${NONPROD}.supabase.co`, AP_STOCK_ADMIN_ALLOWED_REFS: allowed ? NONPROD : "" }) });

describe("쓰기 가드", () => {
  it("허용 목록 밖 대상: execute 는 DB 를 건드리기 전에 거부", async () => {
    const f = fakeDb();
    for (const r of [await runVerify(ctx(f.db, false), "render", "graph-s1", true, "h"), await runConvert(ctx(f.db, false), "graph-s1", true, "h"), await runImport(ctx(f.db, false), "graph-s1", true, "h"), await runAssemble(ctx(f.db, false), "exact-assign-5sets-cons.json", "BC1", undefined, true, "h")]) {
      expect(r.ok).toBe(false); expect(r.executed).toBe(false); expect(r.blocked).toMatch(/허용 목록/);
    }
    expect(f.raw.from).not.toHaveBeenCalled(); expect(f.raw.rpc).not.toHaveBeenCalled();
  });
  it("미리보기(해시) 없이 execute 하면 거부", async () => {
    const f = fakeDb();
    const r = await runVerify(ctx(f.db, true), "render", "graph-s1", true, null);
    expect(r.blocked).toMatch(/미리보기/); expect(f.raw.rpc).not.toHaveBeenCalled();
  });
  it("미리보기 해시와 현재 계획이 다르면 거부(쓰기 0)", async () => {
    const f = fakeDb();
    const r = await runVerify(ctx(f.db, true), "render", "graph-s1", true, "stale-hash");
    expect(r.blocked).toMatch(/계획이 달라졌습니다/); expect(f.writes).toEqual([]);
  });
  it("같은 해시면 실행되고 변경 대상이 없으면 쓰기 0(멱등)", async () => {
    const f = fakeDb();
    const dry = await runVerify(ctx(f.db, true), "render", "graph-s1", false);
    expect(dry.planHash).toBeTruthy(); expect(dry.mode).toBe("dry_run");
    const ex = await runVerify(ctx(f.db, true), "render", "graph-s1", true, dry.planHash);
    expect(ex.executed).toBe(true); expect(f.writes).toEqual([]);
  });
  it("이미 적재된 배치(형제 21건)는 적재 단계를 거부", async () => {
    const f = fakeDb();
    expect((await runImport(ctx(f.db, true), "siblings", false)).blocked).toMatch(/이미 적재/);
  });
});

describe("감사 로그", () => {
  it("실행 환경·건수·계획 해시를 append-only 로 기록한다", async () => {
    const inserted: unknown[] = [];
    const db = { from: () => ({ insert: async (v: unknown) => { inserted.push(v); return { error: null }; } }) } as unknown as SupabaseClient;
    const c = ctx(db, true);
    const r = await runVerify(ctx(fakeDb().db, true), "screen", "graph-s1", false);
    expect(await recordRun(c, r, "ok")).toBeNull();
    expect(inserted[0]).toMatchObject({ actor_id: "admin-1", action: "screen_verify", mode: "dry_run", status: "ok", target_ref: NONPROD });
  });
});
