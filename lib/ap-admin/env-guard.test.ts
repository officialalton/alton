import { describe, expect, it } from "vitest";
import { assertCanWrite, resolveStockTarget } from "./env-guard";
import { planHash } from "./plan-hash";

const NONPROD = "worpsqwqgnspddnrtnvq";
const URL_NP = `https://${NONPROD}.supabase.co`;

describe("resolveStockTarget", () => {
  it("허용 목록이 비어 있으면(기본) 비프로덕션도 쓰기 거부, 점검(읽기)용 ref 는 보여준다", () => {
    const t = resolveStockTarget({ NEXT_PUBLIC_SUPABASE_URL: URL_NP });
    expect(t).toMatchObject({ kind: "remote", ref: NONPROD, canWrite: false });
    expect(() => assertCanWrite(t)).toThrow(/허용 목록/);
  });
  it("허용 목록의 비프로덕션 ref 는 쓰기 허용", () => {
    expect(resolveStockTarget({ NEXT_PUBLIC_SUPABASE_URL: URL_NP, AP_STOCK_ADMIN_ALLOWED_REFS: ` ${NONPROD}, local ` }).canWrite).toBe(true);
  });
  it("허용 목록에 없는 ref(=프로덕션 가정)는 거부", () => {
    const t = resolveStockTarget({ NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co", AP_STOCK_ADMIN_ALLOWED_REFS: NONPROD });
    expect(t.canWrite).toBe(false);
  });
  it("차단 목록은 허용 목록보다 우선", () => {
    expect(resolveStockTarget({ NEXT_PUBLIC_SUPABASE_URL: URL_NP, AP_STOCK_ADMIN_ALLOWED_REFS: NONPROD, AP_STOCK_ADMIN_BLOCKED_REFS: NONPROD }).canWrite).toBe(false);
  });
  it("VERCEL_ENV=production 이면 허용 목록이어도 거부", () => {
    const t = resolveStockTarget({ NEXT_PUBLIC_SUPABASE_URL: URL_NP, AP_STOCK_ADMIN_ALLOWED_REFS: NONPROD, VERCEL_ENV: "production" });
    expect(t.canWrite).toBe(false);
    expect(t.reason).toMatch(/프로덕션/);
  });
  it("로컬은 `local` 이 허용 목록에 있을 때만 쓰기", () => {
    expect(resolveStockTarget({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54521" }).canWrite).toBe(false);
    expect(resolveStockTarget({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54521", AP_STOCK_ADMIN_ALLOWED_REFS: "local" })).toMatchObject({ kind: "local", canWrite: true });
  });
  it("URL 이 없거나 이상하거나 supabase 호스트가 아니면 unknown + 쓰기 거부(허용 목록에 있어도)", () => {
    expect(resolveStockTarget({}).canWrite).toBe(false);
    expect(resolveStockTarget({ NEXT_PUBLIC_SUPABASE_URL: "not a url" }).kind).toBe("unknown");
    expect(resolveStockTarget({ NEXT_PUBLIC_SUPABASE_URL: `https://${NONPROD}.supabase.co.evil.com`, AP_STOCK_ADMIN_ALLOWED_REFS: NONPROD })).toMatchObject({ kind: "unknown", canWrite: false });
  });
});

describe("planHash", () => {
  it("키 순서와 무관하고 효과가 다르면 달라진다", () => {
    expect(planHash("a", { x: 1, y: 2 }, ["k1"])).toBe(planHash("a", { y: 2, x: 1 }, ["k1"]));
    expect(planHash("a", { x: 1 }, ["k1"])).not.toBe(planHash("a", { x: 1 }, ["k1", "k2"]));
    expect(planHash("a", {}, [])).not.toBe(planHash("b", {}, []));
  });
});
