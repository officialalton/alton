import { describe, expect, it } from "vitest";
import { requestAttemptPayout, type AttemptRow, type AttemptStore } from "./attempts";
import { createFakeProvider } from "./providers/fake";

function mkStore(over: Partial<AttemptRow> = {}, gate = true) {
  const row: AttemptRow = {
    id: "att-1", status: "queued", provider: "mercury", manual_execution: false, requested_amount_minor: 50000, requested_currency: "USD",
    idempotency_key: "key-1", payout_request_id: null, provider_transaction_id: null, request_uncertain: false, recipient_provider_id: "rcp-1", ...over,
  };
  const log: string[] = [];
  const store: AttemptStore = {
    async getAttempt() { return { ...row }; },
    async isGateOpen() { return gate; },
    async transition(_id, to) { log.push(`transition:${to}`); row.status = to; },
    async recordRequest(_id, requestId, _a, uncertain) { log.push(`record:${requestId ?? "null"}:${uncertain}`); if (requestId) row.payout_request_id = requestId; row.request_uncertain = uncertain; },
  };
  return { store, row, log };
}

describe("requestAttemptPayout — 이중 송금 방지", () => {
  it("정상: 승인 대기로 전이하고 요청 ID를 기록한다", async () => {
    const { store, log } = mkStore();
    const p = createFakeProvider();
    const r = await requestAttemptPayout(store, p, "att-1", "u");
    expect(r).toEqual({ kind: "requested", requestId: "req_1" });
    expect(log).toEqual(["transition:awaiting_mercury_approval", "record:req_1:false"]);
  });
  it("중복 클릭: 이미 요청 ID가 있으면 제공자를 다시 호출하지 않는다", async () => {
    const { store } = mkStore({ payout_request_id: "req_x", status: "awaiting_mercury_approval" });
    const p = createFakeProvider();
    expect((await requestAttemptPayout(store, p, "att-1", "u")).kind).toBe("already_requested");
    expect(p.calls.requestPayout).toBe(0);
  });
  it("응답 유실 → 재시도 전에 조회해 기존 요청을 복구하고 새 요청을 만들지 않는다", async () => {
    const { store, row } = mkStore();
    const p = createFakeProvider({ mode: "lose-response" });
    expect((await requestAttemptPayout(store, p, "att-1", "u")).kind).toBe("uncertain");
    expect(row.request_uncertain).toBe(true);
    p.setMode("ok");
    const r = await requestAttemptPayout(store, p, "att-1", "u");
    expect(r.kind).toBe("recovered_existing");
    expect(p.requests).toHaveLength(1);
    expect(p.calls.requestPayout).toBe(1);
  });
  it("같은 idempotency key로 두 번 보내도 제공자에는 요청이 1건만 생긴다", async () => {
    const p = createFakeProvider();
    const input = { attemptId: "a", idempotencyKey: "k", recipientProviderId: "r", amountMinor: 1, currency: "USD" as const, memo: "ALTON:a" };
    await p.requestPayout(input);
    await p.requestPayout(input);
    expect(p.requests).toHaveLength(1);
  });
  it("게이트가 닫히면 아무것도 하지 않는다", async () => {
    const { store, log } = mkStore({}, false);
    const p = createFakeProvider();
    expect((await requestAttemptPayout(store, p, "att-1", "u")).kind).toBe("blocked");
    expect(log).toEqual([]);
    expect(p.calls.requestPayout).toBe(0);
  });
  it("KRW·수동 시도는 API를 호출하지 않고 수동 경로를 요구한다", async () => {
    const p = createFakeProvider();
    expect((await requestAttemptPayout(mkStore({ requested_currency: "KRW", manual_execution: true }).store, p, "att-1", null)).kind).toBe("manual_required");
    expect((await requestAttemptPayout(mkStore({ requested_currency: "KRW" }).store, p, "att-1", null)).kind).toBe("manual_required");
    expect(p.calls.requestPayout).toBe(0);
  });
  it("제공자 거절은 던지고 요청 ID를 기록하지 않는다", async () => {
    const { store, row } = mkStore();
    await expect(requestAttemptPayout(store, createFakeProvider({ mode: "reject" }), "att-1", "u")).rejects.toThrow();
    expect(row.payout_request_id).toBeNull();
  });
});
