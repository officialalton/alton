# Stripe 웹훅 오너 점검 체크리스트

> **2026-10-21 점검 정정:** 공유 DB에 `20261030100000`, `20261031100000` 적용은 개발자 보고. Production 코드 배포·실제 결제·환불·자동 회수 켜기는 별도 단계다. 자동 회수는 꺼짐 유지. [환불 검증](stripe-refund-revoke-verification.md)의 실예약 함수 29건과 Preview 화면 UAT를 구분한다. 이 문서의 라이브 결제·환불 예시는 실행 승인 자체가 아니며 임의 소액 실거래 테스트를 하지 않는다. 우선 Stripe 테스트 환경으로 검증한다.

엔드포인트: `https://<도메인>/api/webhooks/stripe`. 처리 이벤트: `checkout.session.completed`, `checkout.session.async_payment_succeeded/failed`, `payment_intent.payment_failed`, `checkout.session.expired`, `charge.dispute.created/updated/closed`, `charge.refunded`, `charge.refund.updated`. 그 외 이벤트는 영수증만 남기고 200(`skipped: unhandled event`).
모드는 환경변수 `STRIPE_MODE`(`live`|`test`)로 명시하고 `STRIPE_SECRET_KEY` 접두사와 반드시 일치해야 한다(불일치면 웹훅이 500 — 배포 설정 오류). 배포 전 `node scripts/check-stripe-env.mjs` 로 확인. 반대 모드 이벤트는 처리하지 않고 `payment_webhook_issues`(kind=livemode_mismatch, 이벤트 원문 포함)에 보관하며 200 `recorded:true`(receipt 는 만들지 않음 → 설정 수정 후 Stripe 에서 Resend 하면 정상 처리, 모두 멱등). 테스트 모드 시크릿(`whsec_`)과 라이브 모드 시크릿은 서로 다르며 환경별로 따로 넣는다(Preview=테스트, Production=라이브).

## A. 테스트 모드 (Preview 배포)
Stripe 대시보드 우상단 "Test mode" 켜기.
1. Developers > Webhooks > Preview URL 엔드포인트 > "Signing secret" 을 Vercel Preview 의 `STRIPE_WEBHOOK_SECRET` 과 대조(앞 6자만). Preview 의 `STRIPE_SECRET_KEY` 는 `sk_test_`.
2. 엔드포인트 > "Send test webhook" > `checkout.session.completed` 전송 → 응답 200. 단 이 이벤트에는 우리 `purchase_id` metadata 가 없어 레거시 분기에서 `missing metadata` 400 이 나올 수 있다(정상: 처리 안 함). 진짜 반영 확인은 3번.
3. 실결제 흐름: Preview 에서 UAT 학부모 계정으로 구매 → Stripe Checkout 에서 테스트 카드 `4242 4242 4242 4242`(아무 미래 만료일/CVC). 기대 결과:
   - Stripe 엔드포인트 > Event deliveries: `checkout.session.completed` 200.
   - DB: `external_event_receipts`(provider=stripe, event_id=evt_..., processed_at 채워짐) 1행, `payment_attempts` status=succeeded 1행, `purchases.status=succeeded`+confirmed_at, `entitlement_grants` 1행(purchase_id 유일), `entitlement_ledger` grant 1행.
4. 중복 방지: 위 이벤트 상세 > "Resend" 클릭 → 응답 200 `{"ok":true,"skipped":"already processed"}`; 위 행들이 늘지 않아야 한다(grant/ledger/attempt 각 1행 유지).
5. 실패: 카드 `4000 0000 0000 0002`(거절) → `payment_intent.payment_failed` 200, `purchases.status=failed`, grant 없음. 같은 구매에 이미 성공 기록이 있으면 failed 로 덮이지 않아야 한다.
6. 만료: Checkout 창을 만료시키거나(Sessions 만료 API는 호출하지 말고 24시간 대기) 생략 가능. 기대: `purchases.status=cancelled`.
7. 서명 오류 확인: 엔드포인트 URL 로 임의 POST(서명 헤더 없음) → 401, 잘못된 서명 → 400 (Vercel 로그에 `stripe_webhook_audit signature_verification_*`).
8. 분쟁: 테스트 카드 `4000 0000 0000 0259` 결제 → `charge.dispute.created` → `payment_disputes` 1행(status=needs_response), `purchases.status` 그대로 succeeded, grant 자동 회수 없음.
9. Vercel 로그(Project > Logs, 경로 `/api/webhooks/stripe`)에서 5xx 가 없어야 한다. `stripe_receipt_insert_failed` 나 5xx 가 보이면 Stripe 가 자동 재시도하므로 원인 수정 후 대시보드에서 Resend.

## B. 라이브 모드 (Production)
"Test mode" 끄기. 실제 고객 결제 전에 소액 점검.
1. Developers > Webhooks 에 Production URL 엔드포인트가 라이브 모드로 등록돼 있는지, 이벤트 선택이 위 6종(최소 checkout.session.completed/expired, payment_intent.payment_failed, charge.dispute.*)인지 확인. Vercel Production 의 `STRIPE_SECRET_KEY`=`sk_live_`/`rk_live_`, `STRIPE_WEBHOOK_SECRET`=라이브 엔드포인트의 `whsec_`(테스트 것과 다름).
2. 라이브 엔드포인트에서 "Send test webhook" 은 라이브 데이터를 만들지 않지만 서명 경로 점검용으로 200/400 확인 가능(우리 metadata 없어 처리는 안 됨).
3. 실결제 1건(가장 작은 상품, 본인 카드) → A-3 과 동일한 DB 행 확인 → 이벤트 "Resend" 로 A-4 확인 → 필요 시 대시보드에서 환불(환불은 현재 앱이 자동 반영하지 않음: 아래 참고) 후 수업권은 관리자 화면에서 수동 조정.
4. 테스트 모드 이벤트가 라이브 URL 로 들어오면 로그에 `livemode_mismatch` 가 남고 `payment_webhook_issues` 에 1행이 쌓이며 그 외 DB 변화는 없어야 한다. 설정을 고친 뒤 해당 이벤트를 대시보드에서 Resend → 처리 후 issue 행의 `resolved_at` 을 채운다(수동).

## C. 새 동작과 확인 방법 (2026-10 점검 후속)
- **멱등**: `payment_attempts.attempt_key=evt:<event.id>` unique, 레거시 크레딧은 `credit_purchases.stripe_checkout_session_id` unique + 단일 트랜잭션 RPC. 같은 이벤트 Resend / 다른 이벤트가 같은 결제를 가리켜도 지급은 1회. 확인: Resend 후 `select count(*) from credit_purchases where stripe_checkout_session_id=...` = 1.
- **금액·통화·결제상태 대조**: Checkout `amount_total`/`currency` 가 저장된 구매(`total_minor`, `currency`)와 다르면 수업권 부여 안 함, `purchases.status=reconciliation_needed`, `payment_webhook_issues`(kind=amount_mismatch / purchase_not_found / legacy_amount_mismatch) 기록. `payment_status!=paid`(지연 결제수단)는 `processing` 만 기록하고 `async_payment_succeeded` 에서 부여, `async_payment_failed` 는 failed. 미해결 이상: `select * from payment_webhook_issues where resolved_at is null`.
- **환불**: `charge.refunded`/`charge.refund.updated` 는 항상 `payment_refunds`(구매에 연결, status·금액)에 기록되고 `needs_review=true` 가 관리자 확인 대상이다(`select * from payment_refunds where needs_review`). pending/failed/canceled 환불은 성공으로 취급하지 않는다.
- **환불 자동 회수(기본 꺼짐)**: `STRIPE_AUTO_REVOKE_ON_REFUND=true` 일 때만. 성공 환불 합계 ≥ 구매 총액 AND 그 구매 grant 가 전부 미사용일 때만 그 구매의 grant 를 회수(반복 이벤트 중복 회수 없음). 일부 사용·예약·부분 환불이면 회수 안 하고 `needs_review` 유지. **운영 활성화는 오너 확인 후.**
- **운영 기록 대조(읽기 전용)**: `npx supabase db query --linked -f scripts/stripe-reconcile-readonly.sql -o table`. 이것은 "앱에 기록된 웹훅·구매·지급끼리의 정합"만 본다. "기록된 이벤트에 미처리 없음"이 "Stripe 의 모든 실제 결제가 앱에 반영됨"을 뜻하지 않는다. 후자는 Stripe 대시보드 Payments > Export(기간·테스트/라이브 구분 선택, CSV)의 `id`/`payment_intent` 열이 `purchases.stripe_payment_intent_id` 에 모두 있는지 대조하고, Developers > Events 에서 Delivery 실패(5xx) 이벤트가 없는지 확인한다.

## D. 알려진 제한(오너 인지 필요)
- 자동 회수 조건은 전액 성공 환불·해당 구매 전부 미사용으로 정해졌으며, 운영 활성화만 보류다. 조건을 다시 정책 승인 대기로 올리지 않는다. 수동 회수의 잠금 전 예약 검사 경합은 수정·검증 대상이다.
- 관리자 결제 실패·대사 탭 하단의 PaymentRefundBoard와 수동 처리 RPC는 be52a9291로 구현됐다. Preview UAT는 최신 보고 확인이 필요하다. 최근 100건 제한으로 오래된 미해결 건 누락 가능성이 있어 서버 미해결 조회/페이지 이동 보강 대상이다.
- 분쟁은 기록만 하며 수업권을 자동 회수하지 않는다(확정 정책).

## E. 환불 자동 회수 검증 (활성화 보류)
시나리오 17종 검증 결과는 `docs/ops/stripe-refund-revoke-verification.md`. 오너 확인 전까지 `STRIPE_AUTO_REVOKE_ON_REFUND` 를 켜지 않는다(현재 환불은 기록 + 관리자 처리 대상 표시만).

### 현재 상태 (구분 기재)
- 공유 DB 스키마: `20261030100000`, `20261031100000` 적용 완료(공유 비프로덕션 DB). `20261031200000_refund_entitlement_lock_before_check.sql`(수동 회수 예약 경합 정정)은 작성만 됨, 적용 대기.
- Preview 코드 배포·UAT: 미확인. Production 코드 배포: 미배포. 자동 회수: 꺼짐. 실제 결제·환불 조작: 없음.

### 운영 반영 전 확인 항목 (값 요청 없음, 이름·이벤트·기대 결과만)
1. 환경변수 이름: `STRIPE_MODE`(live|test, 키 접두사와 일치), `STRIPE_AUTO_REVOKE_ON_REFUND`(미설정 또는 false 가 기대값). 점검: `node scripts/check-stripe-env.mjs` 가 OK.
2. Stripe 웹훅 이벤트 선택: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.payment_failed`, `charge.refunded`, `charge.refund.updated`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`. 기대 결과: 각 이벤트 전달 응답 200.
3. 환불 이벤트 도착 시 기대 결과: 관리자 "결제 실패·대사" 탭에 처리 대기로 표시, 자동 회수 꺼짐 상태에서 수업권 변화 없음.
4. 수동 회수는 예약(미소비 hold)이 있으면 중단되고 처리 완료 표시가 남지 않는다(마이그레이션 `20261031200000` 적용 후). 예약을 취소한 뒤 다시 처리하면 1회만 회수된다.

## 참고: 같은 Preview UAT 의 AP 결과 화면 현황 (2026-10-21)
학생 결과 화면(English Language `5b9952b6…`, Calculus AB `7020773d…`) 확인 완료. 학부모 화면은 UAT 보호자 계정 연결(오너 가입 대기), 관리자 AP 결과 화면은 브라우저 확인 대기. 결제·Stripe 항목과 무관하며 같은 UAT 계정 준비를 공유한다.
