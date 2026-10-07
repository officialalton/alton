# Mercury 기능 검증 (공식 문서 기준, 실호출 없음) — 2026-10-07

범위: 교사·컨설턴트 지급(US=USD ACH, KR=KRW 국제송금)과 Mercury Books. 모든 내용은 공개 문서 열람 결과이며 Mercury 계정·토큰이 없어 **실제 호출로 확인한 것은 하나도 없다.** "문서 미기재"는 "불가"가 아니라 "확인 필요"다.

## 1. 확인된 사실 (출처)

| 항목 | 문서 내용 | 출처 |
|---|---|---|
| 송금 경로 2종 | Direct Send `POST /account/{accountId}/transactions`(ACH·check·domesticWire·realTimePayment, **IP allowlist 필요**), Approval Queue `POST /account/{accountId}/request-send-money`(대시보드 승인 후 발송, IP allowlist 불필요, **internationalWire는 이 경로에서만**) | https://docs.mercury.com/docs/send-money.md |
| 금액 단위 | `amount`는 "USD amount", 최소 $0.01. Direct Send 본문 문서는 "USD only". 통화·환율·견적 필드 **문서 없음**(request-send-money도 외화 필드·환율·수취통화 미기재) | https://docs.mercury.com/reference/createtransaction , https://docs.mercury.com/reference/requestsendmoney.md |
| 수수료 부담 | `chargeType`(ours/shared)은 **USD 국제송금의 중개은행 수수료**용. "ours"=Mercury $15, 수취인 전액 수령 | requestsendmoney.md |
| 멱등성 | 같은 idempotencyKey 재전송은 HTTP 409. 같은 수취인·계좌·금액·방식은 키가 달라도 **24시간 내 400** | send-money.md, createtransaction |
| 승인 요청 | `GET /request-send-money`, `GET /request-send-money/{requestId}`. 상태 pendingApproval/approved/rejected/cancelled. `numberOfApproversRequired`, `reviews[]`, `scheduledSendDate`. **응답에 transactionId 없음, 통화/FX 정보 없음** — 승인 후 transaction 객체가 생긴다고만 기술 | https://docs.mercury.com/reference/getsendmoneyapprovalrequest.md |
| 거래 객체 | status pending/sent/cancelled/failed/reversed/blocked; `currencyExchangeInfo`(환율·수수료), `trackingNumber`, `estimatedDeliveryDate`, `requestId`, `attachments`(receipt), `reasonForFailure`, `failedAt`, `relatedTransactions`(환불·수수료·반환), `glAllocations` | https://docs.mercury.com/reference/gettransaction.md |
| 수취인 | `POST /recipients`(ACH·wire·RTP·check·international: SWIFT/IBAN/countrySpecific). **수취인 초대** `POST /recipients/invites`(paymentMethods에 internationalWire 포함, 수취인이 onboardingUrl에서 직접 은행정보 입력, 상태 created/completed/expired) | https://docs.mercury.com/reference/createrecipient.md , https://docs.mercury.com/reference/createrecipientinvite.md |
| Webhook | `transaction.created`, `transaction.updated`, 계좌 잔액 이벤트 5종. 엔드포인트 100개까지. 상태 active/paused/disabled(연속 실패 시 시스템이 중단). **서명 검증·재시도 정책은 이 페이지에 미기재**(별도 AsyncAPI/Postman 문서에 있다고 되어 있음 → 구현 전 확인) | https://docs.mercury.com/reference/createwebhook.md , https://github.com/api-evangelist/mercury(제3자 정리) |
| Sandbox | 가상 데이터, 실제 돈 없음, 수취인 생성·송금 테스트 가능. **웹훅·국제송금·승인 흐름의 지원 범위는 문서에 없음** | https://docs.mercury.com/docs/using-mercury-sandbox.md |
| 쓰기 권한 | Recipients·Payments 쓰기는 IP 화이트리스트 필요(제3자 정리). Vercel 서버리스는 고정 IP가 없으므로 **Direct Send는 부적합, Approval Queue가 현실적** | api-evangelist 정리 + send-money.md |
| 비USD 국제송금(UI) | 40+ 통화, 수취 가능 통화 목록에 KRW 있음(139개 비USD 수신 통화 기사). **USD 금액에 1% 환전 수수료**(중개은행 수수료 포함 주장), 영업일 mid-market 환율, 주말·휴일은 전 영업일 캐시 환율, 제출 전 환율·수수료·최종 수취액 확인 가능, 처리 1–3 영업일 | support.mercury.com 기사 "Sending international payments in non-USD"(검색 요약으로만 확인, 원문 403) — https://support.mercury.com/hc/en-us/articles/40403389534868 , 28772836414228 |
| Mercury Books | 2026-09 출시, 이중부기, 현금/발생주의, 계정과목표 커스터마이즈, Mercury 은행·카드·인보이스·빌페이 자동 반영, Stripe·PayPal·Gusto 연결, $35/월(2026-12-31까지 면제 조건) | https://mercury.com/books , https://www.cpapracticeadvisor.com/2026/09/30/mercury-debuts-accounting-software-for-its-digital-banking-platform/190825/ |
| Books API | **공개 API 문서 없음.** docs.mercury.com 목차 54개 엔드포인트에 회계 쓰기·분개 API 언급 없음(거래의 `glAllocations` 읽기 필드만 존재) | https://docs.mercury.com/llms.txt |

## 2. 자동화 가능 / 수동 매트릭스

| 단계 | US USD (ACH) | KR KRW (International Wire) |
|---|---|---|
| 수취인 등록 | **API 가능**: 초대(invite)로 본인이 은행정보 입력, 상태 폴링 | **API 가능(초대)**: internationalWire 초대. 한국 계좌 필수 필드는 실계정 폼으로 확인 필요 |
| 지급 요청 생성 | **API 가능**: request-send-money(ACH) 승인 대기 요청 | **API 불가(문서상)**: USD `amount`만 정의, KRW 금액·견적 필드 없음 → 임의 환산 금지. **수동**: ALTON 입력표 다운로드 → 관리자가 Mercury UI에서 KRW 송금 작성 |
| Mercury 내부 승인 | 대시보드 수동(승인 요청은 `reviews`로 조회 가능) | 수동 |
| 거래 ID 확보 | 요청→거래 매핑 필요(승인 응답에 transactionId 없음 → `transaction.created` 웹훅/거래 조회에서 `requestId`로 매칭) | 관리자가 ALTON에 거래 ID 입력(+증빙). 웹훅 수신 시 자동 후보 매칭 |
| 상태 수집 | 웹훅·조회 자동(pending→sent / failed / reversed) | 웹훅·조회 자동 가능성 있음(거래 객체의 currencyExchangeInfo로 환율·수수료 수집 — **실계정에서 확인 필요**), 아니면 증빙 입력 |
| 수취 확인 | **자동 불가**: sent는 수취 확인이 아님. ACH 반환 가능 기간·수취 증빙은 운영 확인(교사 확인 또는 반환 없음 경과) | 동일. KRW 도착은 교사 확인·한국 은행 입금 증빙 |
| 반환·실패 | 웹훅(`reversed`, `relatedTransactions`) 자동 | 동일 |
| Books 대사 | Books에 은행 피드 자동 반영. ALTON→Books 쓰기 API 문서 없음 → **대사 파일(CSV) 수동 대조/업로드(은행 피드 중복 금지)** | 동일 |

## 3. KRW 확정 경로 (오너 지시 폴백 적용)

문서상 Mercury API는 KRW 금액 기반 요청을 지원한다고 확인되지 않는다. 따라서 KRW는:
1. ALTON 정산 승인(KRW 원본 금액 보존)
2. ALTON이 Mercury 입력표(수취인, KRW 금액, 지급기한, 송금 예정일, 정산 ID, 메모) CSV/인쇄용 표 생성
3. 관리자가 Mercury UI에서 KRW 국제송금 작성·Mercury 내부 승인
4. 관리자가 ALTON에서 Mercury 거래 ID를 연결(증빙 첨부 가능), 웹훅 있으면 자동 상태 수집
5. 실제 USD 원금·수수료·총 출금액·환율을 거래에서 읽거나 증빙과 함께 입력 → 수취 확인

KRW 정산 금액을 USD로 임의 환산해 API에 제출하는 코드는 만들지 않는다(구현에서도 KRW+API 경로는 차단).

## 4. 실계정에서만 확인 가능한 미해결 질문

1. UI에서 KRW 송금 시 "수취인이 받을 KRW 금액"을 지정하는가, USD를 입력하면 KRW가 환산되는가. 견적 환율 고정 시간은?
2. 1% 수수료 외 추가 수수료(중개·수취 은행)와 수취 KRW 실제 도착액, 소요 시간(문서상 1–3 영업일 처리 + 은행 입금).
3. 한국 은행 수취인 폼 필수 필드(영문 성명, 은행명/SWIFT, 계좌번호, 한국 특화 정보, 송금 목적 코드 등). 한국 시중은행 해외송금 수취 안내와 대조.
4. request-send-money의 internationalWire가 통화 선택을 받는지(스키마에 필드 없음 — Mercury api@mercury.com 문의).
5. 승인 요청 → 거래 ID 연결 방법과 웹훅 서명 검증·재시도 정책.
6. Sandbox가 웹훅·승인 흐름·국제송금을 지원하는지.
7. API 토큰 종류(읽기/읽기-쓰기/커스텀), Approval Queue 사용 권한, IP allowlist 요구 범위.
8. 회계 쓰기 API(분개)가 Books에 있는지. 없으면 대사는 파일/수동.
9. 한국 미국 휴일 외 Mercury 처리 시간(영업일·컷오프).
10. ACH 반환 기간(R01 등 2영업일, 무권한 60일)에 따른 "수취 확인" 시점 기준 — 운영 정책 결정 필요.
