# Stripe 웹훅 오너 점검 체크리스트

엔드포인트: `https://<도메인>/api/webhooks/stripe`. 처리 이벤트: `checkout.session.completed`, `payment_intent.payment_failed`, `checkout.session.expired`, `charge.dispute.created/updated/closed`. 그 외 이벤트는 영수증만 남기고 200(`skipped: unhandled event`).
모드는 배포의 `STRIPE_SECRET_KEY` 접두사로 결정된다(`sk_test_`=테스트, `sk_live_`=라이브). 반대 모드 이벤트는 처리 없이 200 `skipped: livemode mismatch`. 테스트 모드 시크릿(`whsec_`)과 라이브 모드 시크릿은 서로 다르며 환경별로 따로 넣는다(Preview=테스트, Production=라이브).

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
4. 테스트 모드 이벤트가 라이브 URL 로 들어오면 로그에 `livemode_mismatch` 가 남고 DB 변화는 없어야 한다.

## C. 알려진 제한(오너 인지 필요)
- `charge.refunded` 는 아직 처리하지 않는다. Stripe 에서 환불해도 수업권/구매 상태는 자동으로 바뀌지 않는다(수동 대응).
- 분쟁은 기록만 하며 수업권을 자동 회수하지 않는다(확정 정책).
