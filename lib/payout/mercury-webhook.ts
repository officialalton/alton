// Mercury 웹훅 서명 검증(순수 함수). 근거: https://docs.mercury.com/docs/webhooks
// 헤더 `Mercury-Signature: t=<unix seconds>,v1=<hex>`; v1 = HMAC-SHA256(secretKey, `${t}.${rawBody}`).
import { createHmac, timingSafeEqual } from "node:crypto";

export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;
export type WebhookVerifyResult = { ok: true } | { ok: false; reason: "no_secret" | "missing_header" | "malformed_header" | "bad_timestamp" | "stale" | "future" | "bad_signature" };

export function computeMercurySignature(secret: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export function verifyMercuryWebhookSignature(opts: { secret: string | null | undefined; header: string | null | undefined; rawBody: string; nowMs?: number }): WebhookVerifyResult {
  if (!opts.secret) return { ok: false, reason: "no_secret" };
  if (!opts.header) return { ok: false, reason: "missing_header" };
  let t: string | null = null;
  const sigs: string[] = [];
  for (const part of opts.header.split(",")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim();
    if (k === "t") t = v;
    else if (k === "v1") sigs.push(v);
  }
  if (!t || sigs.length === 0) return { ok: false, reason: "malformed_header" };
  if (!/^\d{1,12}$/.test(t)) return { ok: false, reason: "bad_timestamp" };
  const age = Math.floor((opts.nowMs ?? Date.now()) / 1000) - Number(t);
  if (age > WEBHOOK_TOLERANCE_SECONDS) return { ok: false, reason: "stale" };
  if (age < -WEBHOOK_TOLERANCE_SECONDS) return { ok: false, reason: "future" };
  const expected = Buffer.from(computeMercurySignature(opts.secret, t, opts.rawBody), "hex");
  const match = sigs.some((s) => {
    if (!/^[0-9a-fA-F]+$/.test(s) || s.length !== expected.length * 2) return false;
    return timingSafeEqual(Buffer.from(s, "hex"), expected);
  });
  return match ? { ok: true } : { ok: false, reason: "bad_signature" };
}
