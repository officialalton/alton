import { describe, expect, it, vi } from "vitest";
import { createMercuryProvider, mapMercuryTransaction, mercuryConfigFromEnv, minorToUsdAmount } from "./mercury";
import { ProviderDisabledError, ProviderRejectedError, ProviderUncertainError, ProviderUnsupportedError } from "./types";

const input = {
  attemptId: "att-1",
  idempotencyKey: "11111111-1111-1111-1111-111111111111",
  recipientProviderId: "rcp-1",
  amountMinor: 123456,
  currency: "USD" as const,
  memo: "ALTON:att-1",
};
const open = (fetchImpl: typeof fetch) => createMercuryProvider({ enabled: true, token: "tok", accountId: "acct", fetchImpl });
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("Mercury 클라이언트 골격(실제 네트워크 없음)", () => {
  it("스위치가 닫혀 있으면 fetch를 호출하지 않는다", async () => {
    const f = vi.fn();
    const p = createMercuryProvider({ enabled: false, token: "tok", accountId: "acct", fetchImpl: f as unknown as typeof fetch });
    await expect(p.requestPayout(input)).rejects.toBeInstanceOf(ProviderDisabledError);
    await expect(p.getTransaction("t")).rejects.toBeInstanceOf(ProviderDisabledError);
    expect(f).not.toHaveBeenCalled();
  });
  it("env 기본값은 닫힘이고 정확히 'true'일 때만 열린다", () => {
    expect(mercuryConfigFromEnv({}).enabled).toBe(false);
    expect(mercuryConfigFromEnv({ MERCURY_PAYOUTS_ENABLED: "1" }).enabled).toBe(false);
    expect(mercuryConfigFromEnv({ MERCURY_PAYOUTS_ENABLED: "true" }).enabled).toBe(true);
  });
  it("KRW는 API로 요청하지 않는다(임의 USD 환산 금지)", async () => {
    const f = vi.fn();
    await expect(open(f as unknown as typeof fetch).requestPayout({ ...input, currency: "KRW" })).rejects.toBeInstanceOf(ProviderUnsupportedError);
    expect(f).not.toHaveBeenCalled();
  });
  it("USD ACH 요청은 Approval Queue 경로에 센트→달러로 변환해 보낸다", async () => {
    const f = vi.fn(async () => json(200, { requestId: "r1", status: "pendingApproval" }));
    const r = await open(f as unknown as typeof fetch).requestPayout(input);
    expect(r).toEqual({ requestId: "r1", status: "pending_approval" });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.mercury.com/api/v1/account/acct/request-send-money");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ recipientId: "rcp-1", amount: 1234.56, paymentMethod: "ach", idempotencyKey: input.idempotencyKey });
  });
  it("네트워크 오류·5xx·409는 '불확실'로 취급한다(조회 후 재시도)", async () => {
    await expect(open((async () => { throw new Error("net"); }) as unknown as typeof fetch).requestPayout(input)).rejects.toBeInstanceOf(ProviderUncertainError);
    await expect(open((async () => json(503, {})) as unknown as typeof fetch).requestPayout(input)).rejects.toBeInstanceOf(ProviderUncertainError);
    await expect(open((async () => json(409, {})) as unknown as typeof fetch).requestPayout(input)).rejects.toBeInstanceOf(ProviderUncertainError);
  });
  it("4xx는 거절이다", async () => {
    await expect(open((async () => json(400, { errors: "dup" })) as unknown as typeof fetch).requestPayout(input)).rejects.toBeInstanceOf(ProviderRejectedError);
  });
  it("조회: memo가 같은 요청을 찾는다", async () => {
    const f = async () => json(200, { requests: [{ requestId: "r9", status: "pendingApproval", note: "ALTON:att-1", recipientId: "rcp-1" }] });
    expect(await open(f as unknown as typeof fetch).findExistingRequest({ attemptId: "att-1", recipientProviderId: "rcp-1", amountMinor: 1 })).toEqual({ requestId: "r9", status: "pending_approval" });
    expect(await open(f as unknown as typeof fetch).findExistingRequest({ attemptId: "att-2", recipientProviderId: "rcp-1", amountMinor: 1 })).toBeNull();
  });
  it("금액 변환과 거래 매핑", () => {
    expect(minorToUsdAmount(5)).toBe(0.05);
    expect(() => minorToUsdAmount(0)).toThrow();
    expect(mapMercuryTransaction({ id: "t1", status: "sent", amount: -100.5, requestId: "r1" })).toMatchObject({ transactionId: "t1", status: "sent", amountMinorUsd: 10050, requestId: "r1" });
    expect(mapMercuryTransaction({})).toBeNull();
  });
});
