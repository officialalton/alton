import { describe, expect, it } from "vitest";
import { checkMercuryReadConnection, checkMercuryTransactionShape } from "./mercury";

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

describe("checkMercuryTransactionShape (값은 숨기고 형태만)", () => {
  it("계좌 id가 없으면 호출하지 않는다", async () => {
    expect(await checkMercuryTransactionShape({ token: "t", accountId: null })).toEqual({ ok: false, reason: "no_account" });
  });
  it("필드 이름·상태·종류만 돌려주고 금액·상대방 값은 포함하지 않는다", async () => {
    const r = await checkMercuryTransactionShape({ token: "t", accountId: "acc", fetchImpl: ok({ transactions: [{ id: "tx-abcdef123456", status: "sent", kind: "externalTransfer", createdAt: "2026-10-07T01:02:03Z", amount: -123.45, counterpartyName: "SECRET NAME", requestId: "r1", currencyExchangeInfo: { exchangeRate: 1, feeAmount: 2 } }] }) });
    expect(r).toMatchObject({ ok: true, count: 1, sample: [{ idTail: "123456", status: "sent", kind: "externalTransfer", createdDate: "2026-10-07", hasRequestId: true }] });
    expect(JSON.stringify(r)).not.toContain("SECRET NAME");
    expect(JSON.stringify(r)).not.toContain("123.45");
    if (r.ok) { expect(r.fieldNames).toContain("counterpartyName"); expect(r.exchangeInfoFieldNames).toEqual(["exchangeRate", "feeAmount"]); }
  });
  it("GET 만 호출한다", async () => {
    const seen: string[] = [];
    await checkMercuryTransactionShape({ token: "t", accountId: "acc", baseUrl: "https://x/api/v1", fetchImpl: (async (u: string, init?: RequestInit) => { seen.push(`${init?.method} ${u}`); return new Response(JSON.stringify({ transactions: [] })); }) as unknown as typeof fetch });
    expect(seen).toEqual(["GET https://x/api/v1/account/acc/transactions?limit=5"]);
  });
});
