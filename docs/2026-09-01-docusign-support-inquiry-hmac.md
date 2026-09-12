# DocuSign 지원 문의 — envelope-level eventNotification의 HMAC 서명 미수신

## 요약

`eventNotification.includeHMAC = "true"`를 설정하고 계정에 활성 HMAC 키를 등록한 채로 sandbox envelope을 발송했음에도, 우리 웹훅 엔드포인트가 `X-DocuSign-Signature-1` 헤더를 받지 못해(또는 검증 불일치로) 매번 요청을 거부합니다. 최초 배달과 DocuSign 자체 재시도(retry_queue) 모두 동일하게 실패했습니다.

## 계정/앱 식별 정보

- 환경: Developer Sandbox (`demo.docusign.net`, 인증 서버 `account-d.docusign.com`)
- App 이름: `alton-r3-dev`
- Integration Key (Client ID): `459ff6dc-5f08-4d74-8f4f-c2f69fc6a2c1`
- Account ID: `919e8493-2043-48e4-89c6-fc8c91cf7c24`
- 인증 방식: JWT Grant (impersonation), 정상 작동 확인됨(access token 발급 성공)

## 재현 대상 envelope

- **Envelope ID**: `a45828f2-a6f5-8eb5-81c0-6fc32f9601ca`
- 발송 시각: 2026-09-01T21:19:52.390Z
- 상태: `sent` → 검증 종료 후 관리자가 `voided` 처리(2026-09-01, 사유: 테스트 정리)
- 이 envelope은 `includeHMAC: "true"`가 명시적으로 포함된 발송 요청으로 생성됨(아래 참고)

## 발송 요청 본문 (비밀값 제거본)

`POST /restapi/v2.1/accounts/{accountId}/envelopes`에 아래 `eventNotification` 블록을 그대로 전송했습니다(문서 본문·JWT access token 등 나머지 필드는 생략):

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

## 계정 HMAC 키 상태

발송 직전, 아래 Connect 설정으로 계정에 HMAC 키를 등록·활성화했습니다(라우팅 목적이 아니라 순수 HMAC 키 보유 목적):

```json
{
  "configurationType": "custom",
  "allowEnvelopePublish": "false",
  "includeHMAC": "true",
  "hmacKeyItems": [{ "hmacKey": "<redacted>", "keyName": "preview-key-3" }],
  "envelopeEvents": ["completed"]
}
```

등록 후 `GET /connect/{connectId}`로 `includeHMAC: "true"`가 계정에 반영된 것을 확인했습니다.

## DocuSign delivery/retry 기록 (Connect Failures API 실측)

`GET /restapi/v2.1/accounts/{accountId}/connect/failures` 응답(실제):

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

- 최초 배달(created 21:19:52Z)과 `PUT /connect/envelopes/{envelopeId}/retry_queue`로 트리거한 재시도(lastTry 21:22:06Z) 모두 동일하게 401.
- 재시도 시 배달 대상 URL이 envelope 생성 시점에 기록된 원래 URL 그대로였습니다 — 이후 `PUT /envelopes/{envelopeId}/notification`으로 URL 변경을 시도했으나 반영되지 않아, 실제 요청 헤더를 저희 쪽에서 직접 캡처하지는 못했습니다(아래 "미확인 사항" 참고).

## Preview 수신 측 실측

- 요청은 실제로 도착합니다(Vercel 함수 로그에 `POST /api/webhooks/docusign` 수신 확인, Deployment Protection과 무관하게 우리 애플리케이션 코드까지 도달).
- 저희 웹훅 핸들러(`request.headers.get("X-DocuSign-Signature-1")`를 읽어 HMAC-SHA256 검증)가 매번 `401 {"error":"invalid signature"}`를 반환했습니다 — 이는 헤더가 없거나(`null`), 있어도 등록된 키로 검증되지 않을 때만 나오는 저희 코드의 정상적인 fail-closed 응답입니다.
- **미확인 사항**: DocuSign이 실제로 보낸 원본 요청의 헤더 이름 목록 자체를 직접 캡처하지는 못했습니다(디버그 로깅을 추가한 새 배포로 재시도를 유도했으나, retry_queue가 envelope 생성 시점의 원래 URL로만 재전달해 새 배포에 도달하지 않았습니다). 따라서 "헤더가 아예 없다"와 "헤더는 있으나 서명값이 우리 키와 불일치한다"를 저희 쪽에서 완전히 구분하지는 못한 상태입니다 — 다만 등록한 HMAC 키 외에 다른 키를 등록한 적이 없고, 코드의 서명 계산 로직은 동일 로직으로 만든 자체 요청(로컬/Preview 대상 자체 서명 요청)에서는 정상적으로 성공을 반환하는 것을 확인했습니다(구현 자체는 정상 동작).

## 질문

1. `eventNotification.includeHMAC = "true"`가 envelope 생성 요청에 포함되어 있고 계정에 활성 HMAC 키가 등록되어 있는데도 서명 헤더가 전달되지 않는(또는 검증되지 않는) 알려진 원인이 있습니까?
2. Envelope-level `eventNotification`이 계정 레벨 Connect 설정과 별도로 HMAC 서명을 적용받으려면 추가 설정(예: Connect 설정 자체의 `allowEnvelopePublish` 활성화, 특정 `configurationType`, 또는 HMAC 키의 별도 "활성화/확인" 절차)이 필요합니까?
3. 이 Developer Sandbox 계정에 HMAC 서명 기능 자체가 기본적으로 비활성화되어 있거나, 별도로 활성화해야 하는 계정 레벨 기능이 있습니까? (참고로 계정 레벨 Connect 설정을 이용한 라우팅(`allowEnvelopePublish: "true"`, `allUsers: "true"`)도 별도로 시도했으나 전달 시도 자체가 발생하지 않는 문제를 함께 겪었습니다 — 관련이 있을 수도 있어 첨부합니다.)

감사합니다.
