import { describe, expect, it } from "vitest";
import { computeMercurySignature, verifyMercuryWebhookSignature } from "./mercury-webhook";
import { handleMercuryWebhook, type WebhookStore, WEBHOOK_MISMATCH_FLAG } from "./mercury-webhook-handler";
import { mapMercuryTransaction } from "./providers/mercury";
import { safeMercuryDashboardUrl } from "./mercury-links";
import type { AttemptStatus } from "./attempt-state";

const SECRET = "whsec_test";
const NOW = 1_800_000_000_000;
const body = '{"id":"e1"}';
const hdr = (t: number, s = SECRET, b = body) => `t=${t},v1=${computeMercurySignature(s, String(t), b)}`;
const sec = NOW / 1000;
const v = (header: string | null, rawBody = body, secret: string | null = SECRET) => verifyMercuryWebhookSignature({ secret, header, rawBody, nowMs: NOW });

describe("서명 검증", () => {
  it("유효", () => expect(v(hdr(sec))).toEqual({ ok: true }));
  it("본문 변조", () => expect(v(hdr(sec), '{"id":"e2"}')).toMatchObject({ reason: "bad_signature" }));
  it("다른 비밀", () => expect(v(hdr(sec, "other"))).toMatchObject({ reason: "bad_signature" }));
  it("5분 초과 과거", () => expect(v(hdr(sec - 301))).toMatchObject({ reason: "stale" }));
  it("먼 미래", () => expect(v(hdr(sec + 301))).toMatchObject({ reason: "future" }));
  it("헤더 없음/형식 오류/비밀 없음", () => {
    expect(v(null)).toMatchObject({ reason: "missing_header" });
    expect(v("garbage")).toMatchObject({ reason: "malformed_header" });
    expect(v(hdr(sec), body, null)).toMatchObject({ reason: "no_secret" });
  });
});

function fakeStore(status: AttemptStatus | null, extra: { byRequest?: boolean } = {}) {
  const events = new Set<string>(); const calls: string[] = [];
  const attempt = status ? { id: "a1", status, requested_currency: "USD" as const } : null;
  const store: WebhookStore = {
    async insertEvent(e) { if (events.has(e.eventId)) return false; events.add(e.eventId); return true; },
    async finishEvent(id, o) { calls.push(`finish:${o}`); },
    async discardEvent(id) { events.delete(id); },
    async addFlag(_a, f) { calls.push(`flag:${f}`); },
    async findByTransactionId() { return extra.byRequest ? null : attempt; },
    async findByRequestId() { return attempt; },
    async linkTransaction() { calls.push("link"); },
    async applyTransition(_a, to) { calls.push(`to:${to}`); },
    async recordActuals() { calls.push("actuals"); },
    async recordReturn() { calls.push("return"); },
    async recordDetails() { calls.push("details"); },
  };
  return { store, calls };
}
const evt = (id: string, mergePatch: Record<string, unknown>, resourceType = "transaction") => JSON.stringify({ id, resourceType, operationType: "update", resourceId: "tx1", mergePatch });

describe("웹훅 핸들러", () => {
  it("processing → sent 적용, actuals는 기록하지 않음, 링크·도착일 저장", async () => {
    const { store, calls } = fakeStore("processing");
    expect(await handleMercuryWebhook(store, evt("e1", { status: "sent", dashboardLink: "https://mercury.com/transactions/x", estimatedDeliveryDate: "2026-10-12" }))).toBe("applied");
    expect(calls).toContain("to:sent"); expect(calls).toContain("details"); expect(calls).not.toContain("actuals");
  });
  it("중복 이벤트는 다시 처리하지 않는다", async () => {
    const { store, calls } = fakeStore("processing");
    await handleMercuryWebhook(store, evt("e1", { status: "sent" }));
    const n = calls.length;
    expect(await handleMercuryWebhook(store, evt("e1", { status: "sent" }))).toBe("duplicate");
    expect(calls.length).toBe(n);
  });
  it("알 수 없는 거래는 저장 후 무시", async () => {
    const { store, calls } = fakeStore(null);
    expect(await handleMercuryWebhook(store, evt("e2", { status: "sent" }))).toBe("ignored_unknown");
    expect(calls.filter((c) => c.startsWith("to:"))).toEqual([]);
  });
  it("거래 이외 이벤트는 무시", async () => {
    const { store } = fakeStore("processing");
    expect(await handleMercuryWebhook(store, evt("e3", {}, "balance"))).toBe("ignored_type");
  });
  it("허용되지 않는 전이는 플래그만", async () => {
    const { store, calls } = fakeStore("cancelled");
    expect(await handleMercuryWebhook(store, evt("e4", { status: "sent" }))).toBe("flagged_mismatch");
    expect(calls).toContain(`flag:${WEBHOOK_MISMATCH_FLAG}`); expect(calls.some((c) => c.startsWith("to:"))).toBe(false);
  });
  it("reversed: sent면 반환 기록, 아니면 플래그", async () => {
    const a = fakeStore("sent");
    expect(await handleMercuryWebhook(a.store, evt("e5", { status: "reversed" }))).toBe("applied");
    expect(a.calls).toContain("return");
    const b = fakeStore("processing");
    expect(await handleMercuryWebhook(b.store, evt("e6", { status: "reversed" }))).toBe("flagged_mismatch");
  });
  it("failed 적용 / 잘못된 JSON", async () => {
    const { store, calls } = fakeStore("processing");
    expect(await handleMercuryWebhook(store, evt("e7", { status: "failed", reasonForFailure: "x" }))).toBe("applied");
    expect(calls).toContain("to:failed");
    expect(await handleMercuryWebhook(store, "not json")).toBe("invalid_payload");
  });
  it("requestId로 매칭", async () => {
    const { store } = fakeStore("awaiting_mercury_approval", { byRequest: true });
    expect(await handleMercuryWebhook(store, evt("e8", { status: "sent", requestId: "rq" }))).toBe("applied");
  });
});

describe("링크·거래 매핑", () => {
  it("mercury.com https만 허용", () => {
    expect(safeMercuryDashboardUrl("https://app.mercury.com/t/1")).not.toBeNull();
    for (const u of ["http://mercury.com/x", "https://evilmercury.com/x", "https://mercury.com.evil.io/x", "javascript:alert(1)", "https://u:p@mercury.com/", null])
      expect(safeMercuryDashboardUrl(u)).toBeNull();
  });
  it("mapMercuryTransaction이 링크·도착일·실패 시각을 담는다", () => {
    const t = mapMercuryTransaction({ id: "t", status: "failed", dashboardLink: "https://app.mercury.com/t", estimatedDeliveryDate: "2026-10-12T00:00:00Z", failedAt: "2026-10-09T01:00:00Z", reasonForFailure: "r" });
    expect(t).toMatchObject({ dashboardUrl: "https://app.mercury.com/t", estimatedDeliveryDate: "2026-10-12", failedAt: "2026-10-09T01:00:00Z" });
  });
});
