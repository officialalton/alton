import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listSwapPlans, parseSwapPlan, readSwapPlan, resolveSwaps, summarize } from "./new-version";
import { runNewVersionDraft, runNewVersionPublish, runSetAccessTier } from "./new-version-service";
import { resolveStockTarget } from "./env-guard";
import type { Ctx } from "./service";

const slots = [
  { section: "ap_mc_a", position: 1, candidateKey: "k1" }, { section: "ap_mc_a", position: 2, candidateKey: "k2" },
  { section: "ap_mc_b", position: 1, candidateKey: "k3" },
];

describe("교체 계획 파일", () => {
  it("형식 검증: kind·swaps·position 또는 removeKey 필수", () => {
    expect(() => parseSwapPlan({})).toThrow(/형식/);
    expect(() => parseSwapPlan({ kind: "ap_new_version_swap_plan", sourceSetName: "S", swaps: [{ section: "ap_mc_a", addKey: "x" }] })).toThrow(/position 또는 removeKey/);
    expect(parseSwapPlan({ kind: "ap_new_version_swap_plan", set: "AB1", sourceSetName: "S", swaps: [{ section: "ap_mc_a", removeKey: "k1", addKey: "x" }] }).swaps).toHaveLength(1);
  });
  it("파일 이름 규칙 밖(경로 이탈 포함)은 읽지 않는다", () => {
    expect(() => readSwapPlan("../../etc/passwd")).toThrow(/이름/);
    expect(() => readSwapPlan("items.json")).toThrow(/이름/);
  });
  it("목록은 *swap-plan*.json 만, 형식 오류 파일은 뺀다", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "swapplan-"));
    writeFileSync(path.join(dir, "ab1-v2-swap-plan.json"), JSON.stringify({ kind: "ap_new_version_swap_plan", set: "AB1", sourceSetName: "AP Calculus AB — Practice Exam", swaps: [{ section: "ap_mc_a", removeKey: "k1", addKey: "x" }] }));
    writeFileSync(path.join(dir, "bad-swap-plan.json"), "{}"); writeFileSync(path.join(dir, "other.json"), "{}");
    expect(listSwapPlans(dir)).toEqual([{ file: "ab1-v2-swap-plan.json", set: "AB1", sourceSetName: "AP Calculus AB — Practice Exam", swapCount: 1 }]);
    expect(listSwapPlans(path.join(dir, "none"))).toEqual([]);
  });
});

describe("슬롯 해석", () => {
  it("removeKey 로 실제 위치를 찾는다", () => {
    const r = resolveSwaps([{ section: "ap_mc_a", removeKey: "k2", addKey: "n1" }], slots);
    expect(r.problems).toEqual([]); expect(r.swaps).toEqual([{ section: "ap_mc_a", position: 2, addKey: "n1", removeKey: "k2" }]);
  });
  it("계획과 현재 문항이 다르거나 키가 없으면 사유를 돌려준다", () => {
    expect(resolveSwaps([{ section: "ap_mc_a", position: 1, removeKey: "k2", addKey: "n" }], slots).problems[0]).toMatch(/다릅니다/);
    expect(resolveSwaps([{ section: "ap_mc_b", removeKey: "k1", addKey: "n" }], slots).problems[0]).toMatch(/없습니다/);
    expect(resolveSwaps([{ section: "ap_mc_a", position: 9, addKey: "n" }], slots).problems[0]).toMatch(/슬롯/);
  });
  it("같은 슬롯 두 번·같은 새 문항 두 번은 거부", () => {
    expect(resolveSwaps([{ section: "ap_mc_a", position: 1, addKey: "n1" }, { section: "ap_mc_a", position: 1, addKey: "n2" }], slots).problems.join()).toMatch(/두 번/);
    expect(resolveSwaps([{ section: "ap_mc_a", position: 1, addKey: "n1" }, { section: "ap_mc_a", position: 2, addKey: "n1" }], slots).problems.join()).toMatch(/같은 문항/);
  });
});

describe("구성 요약", () => {
  it("MC 단원·계산기·FRQ 를 센다", () => {
    expect(summarize([{ kind: "mc", unit: "1", calculator: "not_allowed" }, { kind: "mc", unit: "1", calculator: "required" }, { kind: "mc", unit: "2", calculator: null }, { kind: "frq", unit: "3", calculator: "required" }]))
      .toEqual({ mc: 3, frq: 1, unitCounts: { "1": 2, "2": 1 }, calculator: { not_allowed: 1, required: 1, other: 1 } });
  });
});

const NONPROD = "worpsqwqgnspddnrtnvq";
const ctx = (db: unknown, allowed: boolean): Ctx => ({ db: db as SupabaseClient, actorId: "admin-1", target: resolveStockTarget({ NEXT_PUBLIC_SUPABASE_URL: `https://${NONPROD}.supabase.co`, AP_STOCK_ADMIN_ALLOWED_REFS: allowed ? NONPROD : "" }) });

describe("쓰기 가드(서비스)", () => {
  it("허용 목록 밖: 초안 만들기·공개·범위 변경 execute 는 DB·주입 함수를 건드리지 않고 거부", async () => {
    const db = { from: vi.fn(), rpc: vi.fn() }; const create = vi.fn(); const pub = vi.fn();
    const rs = [await runNewVersionDraft(ctx(db, false), "s", [{ section: "ap_mc_a", position: 1, addKey: "x" }], "h", create), await runNewVersionPublish(ctx(db, false), "s", true, "h", pub), await runSetAccessTier(ctx(db, false), "s", "free", true, "h")];
    for (const r of rs) { expect(r.ok).toBe(false); expect(r.executed).toBe(false); expect(r.blocked).toMatch(/허용 목록/); }
    expect(db.from).not.toHaveBeenCalled(); expect(db.rpc).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled(); expect(pub).not.toHaveBeenCalled();
  });
  it("미리보기 해시 없이 execute 하면 거부", async () => {
    const db = { from: vi.fn(), rpc: vi.fn() }; const create = vi.fn();
    const r = await runNewVersionDraft(ctx(db, true), "s", [{ section: "ap_mc_a", position: 1, addKey: "x" }], null, create);
    expect(r.blocked).toMatch(/미리보기/); expect(create).not.toHaveBeenCalled();
  });
  it("공개 범위: 잘못된 값은 던진다", async () => {
    await expect(runSetAccessTier(ctx({}, true), "s", "paid" as never, false)).rejects.toThrow(/무료 또는 튜터링/);
  });
});
