# DocuSign Support Inquiry — HMAC signature not received on envelope-level eventNotification

## Summary

We set `eventNotification.includeHMAC = "true"` on envelope creation and registered an active HMAC key on the account, then sent a sandbox envelope. Our webhook endpoint never received a valid `X-DocuSign-Signature-1` header — every delivery attempt (the initial send and DocuSign's own retry) was rejected by our endpoint with HTTP 401 for failing signature verification. We'd like your help confirming, from DocuSign's side, whether the signature header was actually sent, and if not, what additional account/envelope configuration is required.

## Account / app identifiers

- Environment: Developer Sandbox (`demo.docusign.net`, auth server `account-d.docusign.com`)
- App name: `alton-r3-dev`
- Integration Key (Client ID): `459ff6dc-5f08-4d74-8f4f-c2f69fc6a2c1`
- Account ID: `919e8493-2043-48e4-89c6-fc8c91cf7c24`
- Auth method: JWT Grant (impersonation) — working correctly, access tokens issue successfully.

## Test envelope

- **Envelope ID**: `a45828f2-a6f5-8eb5-81c0-6fc32f9601ca`
- Created: 2026-09-01T21:19:52.390Z
- Status: `sent` at time of testing → voided afterward by our admin once this investigation concluded (reason: test cleanup), so it is no longer live
- This envelope was created with `includeHMAC: "true"` explicitly set in the request body (see below)

## Envelope creation request body (secrets redacted)

We sent the following `eventNotification` block on `POST /restapi/v2.1/accounts/{accountId}/envelopes` (document content and the JWT access token are omitted here):

```json
{
  "eventNotification": {
    "url": "https://alton-4j1agg8l6-alton7.vercel.app/api/webhooks/docusign",
    "loggingEnabled": "true",
    "requireAcknowledgment": "true",
    "includeHMAC": "true",
    "envelopeEvents": [
      { "envelopeEventStatusCode": "sent" },
      { "envelopeEventStatusCode": "delivered" },
      { "envelopeEventStatusCode": "completed" },
      { "envelopeEventStatusCode": "declined" },
      { "envelopeEventStatusCode": "voided" }
    ],
    "eventData": { "version": "restv2.1", "format": "json" }
  }
}
```

## Account HMAC key registration

Immediately before sending the envelope above, we registered an HMAC key on the account via a Connect configuration (created purely to hold the HMAC key, not for routing):

```json
{
  "configurationType": "custom",
  "allowEnvelopePublish": "false",
  "includeHMAC": "true",
  "hmacKeyItems": [{ "hmacKey": "<redacted>", "keyName": "preview-key-3" }],
  "envelopeEvents": ["completed"]
}
```

We confirmed via `GET /connect/{connectId}` that `includeHMAC: "true"` was reflected on the account-side configuration after creation.

**This Connect configuration and its HMAC key have since been deleted** as part of our post-verification cleanup, along with two earlier Connect configurations we created and removed during this same investigation while diagnosing a separate account-level routing issue:
- `connectId 22299996` — created 2026-09-01, deleted 2026-09-01 (verified, then deleted)
- `connectId 22300003` — created 2026-09-01, deleted 2026-09-01 (verified, then deleted)
- `connectId 22300007` — created 2026-09-01 (the HMAC-key-only configuration referenced above), deleted 2026-09-01 (verified, then deleted)

**If reproducing this on your side requires an active Connect configuration or HMAC key to still exist on the account, please let us know before we re-create one** — we'd like your guidance on the correct configuration first, rather than guessing again.

## DocuSign delivery/retry record (from the Connect Failures API)

Actual response from `GET /restapi/v2.1/accounts/{accountId}/connect/failures` at the time:

```json
{
  "envelopeId": "a45828f2-a6f5-8eb5-81c0-6fc32f9601ca",
  "status": "sent",
  "lastTry": "2026-09-01T21:22:06.4300000Z",
  "retryCount": "1",
  "error": "https://alton-4j1agg8l6-alton7.vercel.app/api/webhooks/docusign :: Error - The remote server returned an error: (401) Unauthorized.; ",
  "connectId": "Envelope"
}
```

- Both the initial delivery (created 21:19:52Z) and the retry we triggered via `PUT /connect/envelopes/{envelopeId}/retry_queue` (lastTry 21:22:06Z) failed identically with 401.
- The retry was delivered to the same URL that was configured at envelope creation time — a later `PUT /envelopes/{envelopeId}/notification` call we made to change the notification URL did not appear to take effect for the retry, so we were unable to capture the raw request on a separately instrumented endpoint (see "What we could not confirm" below).

## What we observed on our receiving end (Preview)

- The request genuinely arrives — our Vercel function logs show `POST /api/webhooks/docusign` received (independent of Vercel's deployment protection, which we temporarily disabled for testing and confirmed does not block API routes anyway).
- Our webhook handler (which reads `request.headers.get("X-DocuSign-Signature-1")` and verifies it via HMAC-SHA256 against our registered key) returned `401 {"error":"invalid signature"}` on every attempt — this is the exact response our code produces only when that header is either missing (`null`) or present but fails verification against our key.

## What we could not confirm ourselves — request for your help

**We were unable to capture the raw list of headers DocuSign actually sent on this delivery.** We attempted to redeploy our endpoint with temporary debug logging (to log header names only, not the signature value) and trigger a fresh retry, but DocuSign's `retry_queue` redelivered to the envelope's originally configured URL regardless of our later notification-URL update, so the debug-logging deployment was never actually invoked by DocuSign for this envelope. We are therefore asking you to check from your side:

1. **Please check your internal delivery logs for envelope `a45828f2-a6f5-8eb5-81c0-6fc32f9601ca`** (both the initial delivery around 2026-09-01T21:19:52–21:20:14Z and the retry around 21:22:06Z) and confirm the actual outbound request headers that were sent to `https://alton-4j1agg8l6-alton7.vercel.app/api/webhooks/docusign`.
2. Specifically, **was an `X-DocuSign-Signature-1` header included in that request at all?** If it was included, was it possibly computed using a different/older HMAC key than the one we registered (`keyName: "preview-key-3"`, since deleted)?
3. Our own signature-verification implementation (HMAC-SHA256 over the raw request body) produces correct, verifiable signatures when we sign test payloads with the same secret ourselves — so the issue appears to be on the sending/signing side, not our verification logic, but we'd appreciate your confirmation either way.

## Questions

1. Is there a known reason `eventNotification.includeHMAC = "true"` on the envelope creation request, combined with an active account-level HMAC key, would not result in a signed webhook delivery?
2. Does envelope-level `eventNotification` require any additional account configuration beyond `includeHMAC` and a registered HMAC key to actually sign outbound requests (e.g., a separate "enable HMAC signing" toggle, a specific `configurationType`, or a confirmation/activation step for a newly created HMAC key)?
3. Is HMAC signing itself disabled by default on this Developer Sandbox account, or does it require separate enablement? (For additional context: we also separately tried account-level Connect routing — `allowEnvelopePublish: "true"`, `allUsers: "true"` — and found that delivery attempts never fired at all under that configuration either; that may or may not be related, but we wanted to mention it.)

Thank you for your help.
