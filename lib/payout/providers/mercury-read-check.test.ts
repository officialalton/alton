import { describe, expect, it } from "vitest";
import { checkMercuryReadConnection } from "./mercury";

const ok = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("checkMercuryReadConnection (읽기 전용, 스위치와 무관)", () => {
  it("토큰이 없으면 호출하지 않고 no_token", async () => {
    let called = false;
    const r = await checkMercuryReadConnection({ token: null, fetchImpl: (async () => { called = true; return new Response("{}"); }) as unknown as typeof fetch });
    expect(r).toEqual({ ok: false, reason: "no_token" });
    expect(called).toBe(false);
  });
  it("계좌 목록을 돌려주되 계좌번호는 끝 4자리만", async () => {
    const r = await checkMercuryReadConnection({ token: "t", fetchImpl: ok({ accounts: [{ id: "a1", nickname: "Payouts", kind: "checking", status: "active", accountNumber: "9876543210", routingNumber: "111" }] }) });
    expect(r).toEqual({ ok: true, accounts: [{ id: "a1", name: "Payouts", kind: "checking", status: "active", last4: "3210" }] });
    expect(JSON.stringify(r)).not.toContain("9876543210");
  });
  it("401/403/기타 오류를 구분한다", async () => {
    expect(await checkMercuryReadConnection({ token: "t", fetchImpl: ok({}, 401) })).toMatchObject({ ok: false, reason: "unauthorized" });
    expect(await checkMercuryReadConnection({ token: "t", fetchImpl: ok({}, 403) })).toMatchObject({ ok: false, reason: "forbidden" });
    expect(await checkMercuryReadConnection({ token: "t", fetchImpl: ok({}, 500) })).toMatchObject({ ok: false, reason: "http_error", status: 500 });
  });
  it("네트워크 오류는 network", async () => {
    expect(await checkMercuryReadConnection({ token: "t", fetchImpl: (async () => { throw new Error("x"); }) as unknown as typeof fetch })).toEqual({ ok: false, reason: "network" });
  });
  it("GET /accounts 만 호출한다(쓰기 경로 없음)", async () => {
    const seen: { url: string; method?: string }[] = [];
    await checkMercuryReadConnection({ token: "t", baseUrl: "https://sandbox.example/api/v1", fetchImpl: (async (u: string, init?: RequestInit) => { seen.push({ url: u, method: init?.method }); return new Response(JSON.stringify({ accounts: [] })); }) as unknown as typeof fetch });
    expect(seen).toEqual([{ url: "https://sandbox.example/api/v1/accounts", method: "GET" }]);
  });
});
