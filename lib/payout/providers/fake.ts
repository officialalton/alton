// 테스트용 가짜 제공자 — 메모리에서만 동작하고 어떤 네트워크도 쓰지 않는다.
import {
  ProviderRejectedError,
  ProviderUncertainError,
  attemptMemo,
  type PayoutProvider,
  type PayoutRequestInput,
  type PayoutRequestResult,
  type ProviderTransaction,
} from "./types";

export type FakeProviderOptions = {
  /** "lose-response": 요청은 접수되지만 호출자는 오류를 받는다(응답 유실). */
  mode?: "ok" | "lose-response" | "reject";
};

export type FakeRequest = PayoutRequestInput & { requestId: string; memo: string };

export function createFakeProvider(options: FakeProviderOptions = {}): PayoutProvider & {
  requests: FakeRequest[];
  transactions: Map<string, ProviderTransaction>;
  setMode(mode: FakeProviderOptions["mode"]): void;
  calls: { requestPayout: number; findExistingRequest: number };
} {
  let mode = options.mode ?? "ok";
  const requests: FakeRequest[] = [];
  const transactions = new Map<string, ProviderTransaction>();
  const calls = { requestPayout: 0, findExistingRequest: 0 };
  return {
    name: "mercury",
    requests,
    transactions,
    calls,
    setMode(m) {
      mode = m ?? "ok";
    },
    async requestPayout(input): Promise<PayoutRequestResult> {
      calls.requestPayout += 1;
      if (mode === "reject") throw new ProviderRejectedError("fake rejection", 400);
      // 같은 idempotencyKey는 같은 요청을 돌려준다(Mercury 409 동작과 동치: 중복 생성 없음).
      let existing = requests.find((r) => r.idempotencyKey === input.idempotencyKey);
      if (!existing) {
        existing = { ...input, requestId: `req_${requests.length + 1}`, memo: input.memo };
        requests.push(existing);
      }
      if (mode === "lose-response") throw new ProviderUncertainError();
      return { requestId: existing.requestId, status: "pending_approval" };
    },
    async findExistingRequest(ref) {
      calls.findExistingRequest += 1;
      const found = requests.find((r) => r.memo === attemptMemo(ref.attemptId));
      return found ? { requestId: found.requestId, status: "pending_approval" } : null;
    },
    async getTransaction(id) {
      return transactions.get(id) ?? null;
    },
  };
}
