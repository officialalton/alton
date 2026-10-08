// Mercury API 클라이언트 골격(2026-10-07) — 닫힌 스위치 뒤. 근거: docs/2026-10-07-mercury-capabilities.md.
//
// - USD 전용(`amount`는 USD). KRW 요청은 API 지원이 확인되지 않아 ProviderUnsupportedError — KRW는 수동 경로(입력표 → Mercury 화면).
// - Approval Queue(`POST /account/{id}/request-send-money`)만 쓴다: Direct Send는 IP allowlist가 필요해 서버리스에 부적합.
// - HTTP 계층은 주입(fetchImpl). 테스트는 실제 네트워크를 쓰지 않는다. 토큰은 env에서만 읽고 로그에 남기지 않는다.
// - 아래 응답 형태 중 목록·단건 조회 경로는 공식 문서에서 확정하지 못했다 → 실계정/샌드박스 확인 항목(체크리스트 참고).
import {
  ATTEMPT_MEMO_PREFIX,
  ProviderDisabledError,
  ProviderRejectedError,
  ProviderUncertainError,
  ProviderUnsupportedError,
  type PayoutProvider,
  type PayoutRequestInput,
  type PayoutRequestResult,
  type ProviderTransaction,
} from "./types";

export const MERCURY_DEFAULT_BASE_URL = "https://api.mercury.com/api/v1";

export type MercuryConfig = {
  enabled: boolean;
  token: string | null;
  accountId: string | null;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

/** env에서 설정을 읽는다. MERCURY_PAYOUTS_ENABLED가 정확히 "true"가 아니면 닫힘. */
export function mercuryConfigFromEnv(env: Record<string, string | undefined> = process.env): MercuryConfig {
  return {
    enabled: env.MERCURY_PAYOUTS_ENABLED === "true",
    token: env.MERCURY_API_TOKEN ?? null,
    accountId: env.MERCURY_PAYOUT_ACCOUNT_ID ?? null,
    baseUrl: env.MERCURY_API_BASE_URL || MERCURY_DEFAULT_BASE_URL,
  };
}

const MERCURY_STATUS: Record<string, PayoutRequestResult["status"]> = {
  pendingApproval: "pending_approval",
  approved: "approved",
  rejected: "rejected",
  cancelled: "cancelled",
};

export function minorToUsdAmount(amountMinor: number): number {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) throw new ProviderRejectedError("Amount must be a positive integer number of cents");
  return Number((amountMinor / 100).toFixed(2));
}

export type MercuryAccountSummary = { id: string; name: string; kind: string; status: string; last4: string | null };
export type MercuryReadCheck =
  | { ok: true; accounts: MercuryAccountSummary[] }
  | { ok: false; reason: "no_token" | "unauthorized" | "forbidden" | "http_error" | "network"; status?: number };

/** 읽기 전용 연결 확인(GET /accounts). 지급 스위치(MERCURY_PAYOUTS_ENABLED)와 무관하다 — 읽기 토큰으로는 돈이 움직일 수 없다.
 * 계좌번호는 끝 4자리만 돌려준다. 토큰은 절대 반환·로그하지 않는다. */
export async function checkMercuryReadConnection(config: Pick<MercuryConfig, "token" | "baseUrl" | "fetchImpl" | "timeoutMs">): Promise<MercuryReadCheck> {
  if (!config.token) return { ok: false, reason: "no_token" };
  const base = (config.baseUrl ?? MERCURY_DEFAULT_BASE_URL).replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? 20_000);
  try {
    const res = await (config.fetchImpl ?? fetch)(`${base}/accounts`, {
      method: "GET",
      headers: { Authorization: `Bearer ${config.token}`, Accept: "application/json" },
      signal: controller.signal,
    });
    if (res.status === 401) return { ok: false, reason: "unauthorized", status: 401 };
    if (res.status === 403) return { ok: false, reason: "forbidden", status: 403 };
    if (!res.ok) return { ok: false, reason: "http_error", status: res.status };
    const json = (await res.json().catch(() => null)) as { accounts?: unknown[] } | null;
    const list = Array.isArray(json?.accounts) ? json!.accounts! : [];
    const accounts = list.map((raw) => {
      const a = (raw ?? {}) as { id?: string; name?: string; nickname?: string; kind?: string; type?: string; status?: string; accountNumber?: string };
      const num = typeof a.accountNumber === "string" ? a.accountNumber : "";
      return { id: String(a.id ?? ""), name: String(a.nickname ?? a.name ?? ""), kind: String(a.kind ?? a.type ?? ""), status: String(a.status ?? ""), last4: num.length >= 4 ? num.slice(-4) : null };
    }).filter((a) => a.id);
    return { ok: true, accounts };
  } catch {
    return { ok: false, reason: "network" };
  } finally {
    clearTimeout(timer);
  }
}

export function createMercuryProvider(config: MercuryConfig): PayoutProvider {
  const base = (config.baseUrl ?? MERCURY_DEFAULT_BASE_URL).replace(/\/$/, "");

  function requireOpen(): { token: string; accountId: string; fetchImpl: typeof fetch } {
    if (!config.enabled) throw new ProviderDisabledError("MERCURY_PAYOUTS_ENABLED is not true");
    if (!config.token || !config.accountId) throw new ProviderDisabledError("Mercury token/account id is not configured");
    return { token: config.token, accountId: config.accountId, fetchImpl: config.fetchImpl ?? fetch };
  }

  async function call(path: string, init: { method: string; body?: unknown }): Promise<{ status: number; json: unknown }> {
    const { token, fetchImpl } = requireOpen();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? 20_000);
    let res: Response;
    try {
      res = await fetchImpl(`${base}${path}`, {
        method: init.method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: controller.signal,
      });
    } catch {
      // 네트워크 오류·타임아웃: 요청이 접수됐는지 알 수 없다(쓰기일 때 특히 중요).
      throw new ProviderUncertainError();
    } finally {
      clearTimeout(timer);
    }
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    if (res.status >= 500) throw new ProviderUncertainError(`Mercury server error ${res.status}`);
    return { status: res.status, json };
  }

  return {
    name: "mercury",

    async requestPayout(input: PayoutRequestInput): Promise<PayoutRequestResult> {
      const { accountId } = requireOpen();
      if (input.currency !== "USD") {
        throw new ProviderUnsupportedError(
          "Mercury API payments are USD only (no documented KRW amount/quote fields). Use the manual KRW wire path."
        );
      }
      const { status, json } = await call(`/account/${encodeURIComponent(accountId)}/request-send-money`, {
        method: "POST",
        body: {
          recipientId: input.recipientProviderId,
          amount: minorToUsdAmount(input.amountMinor),
          paymentMethod: "ach",
          idempotencyKey: input.idempotencyKey,
          note: input.memo,
          externalMemo: "ALTON compensation",
        },
      });
      const body = (json ?? {}) as { requestId?: string; id?: string; status?: string; errors?: unknown };
      if (status === 409) {
        // 같은 idempotencyKey가 이미 접수됨 — 중복 생성이 아니라 기존 요청을 조회해야 한다.
        throw new ProviderUncertainError("Mercury reported an existing request for this idempotency key (409); look it up before retrying");
      }
      if (status >= 400) throw new ProviderRejectedError(`Mercury rejected the request (${status})`, status);
      const requestId = body.requestId ?? body.id;
      if (!requestId) throw new ProviderUncertainError("Mercury response had no requestId");
      return { requestId, status: MERCURY_STATUS[body.status ?? ""] ?? "pending_approval" };
    },

    async findExistingRequest(ref) {
      const { status, json } = await call(`/request-send-money`, { method: "GET" });
      if (status >= 400) throw new ProviderRejectedError(`Mercury list failed (${status})`, status);
      const list: unknown[] = Array.isArray(json) ? json : Array.isArray((json as { requests?: unknown[] })?.requests) ? (json as { requests: unknown[] }).requests : [];
      const wanted = `${ATTEMPT_MEMO_PREFIX}${ref.attemptId}`;
      for (const item of list) {
        const r = item as { requestId?: string; id?: string; status?: string; memo?: string; note?: string; recipientId?: string };
        if ((r.memo ?? r.note ?? "") === wanted && (!r.recipientId || r.recipientId === ref.recipientProviderId)) {
          const requestId = r.requestId ?? r.id;
          if (requestId) return { requestId, status: MERCURY_STATUS[r.status ?? ""] ?? "pending_approval" };
        }
      }
      return null;
    },

    async getTransaction(transactionId: string): Promise<ProviderTransaction | null> {
      const { status, json } = await call(`/transaction/${encodeURIComponent(transactionId)}`, { method: "GET" });
      if (status === 404) return null;
      if (status >= 400) throw new ProviderRejectedError(`Mercury transaction lookup failed (${status})`, status);
      return mapMercuryTransaction(json);
    },
  };
}

type MercuryTx = {
  id?: string;
  status?: string;
  requestId?: string | null;
  amount?: number;
  trackingNumber?: string | null;
  reasonForFailure?: string | null;
  currencyExchangeInfo?: { exchangeRate?: number | string; feeAmount?: number | string; convertedFromAmount?: number | string } | null;
};
/** Mercury 거래 객체 → 내부 형태. currencyExchangeInfo의 세부 필드명은 실계정에서 확인 전이라 있으면 읽고 없으면 null. */
export function mapMercuryTransaction(raw: unknown): ProviderTransaction | null {
  const t = (raw ?? {}) as MercuryTx;
  if (!t.id) return null;
  const status = (["pending", "sent", "cancelled", "failed", "reversed", "blocked"] as const).find((s) => s === t.status) ?? "pending";
  const fx = t.currencyExchangeInfo ?? null;
  const toNum = (v: unknown) => (v === undefined || v === null || v === "" ? null : Number(v));
  const usdCents = typeof t.amount === "number" ? Math.round(Math.abs(t.amount) * 100) : null;
  const fee = toNum(fx?.feeAmount);
  return {
    transactionId: t.id,
    status,
    requestId: t.requestId ?? null,
    amountMinorUsd: usdCents,
    feeMinorUsd: fee === null ? null : Math.round(fee * 100),
    fxRate: toNum(fx?.exchangeRate),
    trackingUrl: null,
    failureReason: t.reasonForFailure ?? null,
  };
}
