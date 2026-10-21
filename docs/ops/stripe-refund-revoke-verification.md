# 환불 자동 회수 검증 결과 (2026-10-21)

상태: **운영 활성화 보류**(`STRIPE_AUTO_REVOKE_ON_REFUND` 기본 꺼짐). 환불 기록(`payment_refunds`)과 관리자 확인 표시(`needs_review`)만 항상 동작한다.
검증 환경: 격리 Supabase 스택(PORT_OFFSET=1300, 종료·config 원복 완료), 읽기 전용 원격 SELECT. 프로덕션 반영·마이그레이션 적용 없음.
테스트: `lib/stripe-webhook-rpc.integration.test.ts`(DB RPC, 19건 통과), `app/api/webhooks/stripe/route.r4.test.ts`(웹훅 흐름).

회수 판정(`auto_revoke_refunded_purchase`): (1) 그 구매의 `status='succeeded'` 환불 합계 >= 구매 총액, (2) 그 구매의 모든 유료 grant 에서 ledger 에 `grant` 이벤트만 있고 잔량 == original_quantity. 둘 다 만족할 때만 `refund_entitlement` 로 그 구매 grant 의 refund ledger 행을 쓴다. 하나라도 어긋나면 아무것도 쓰지 않고 사유 반환(관리자 처리).

| # | 시나리오 | 기대 동작 | 테스트 |
|---|---|---|---|
| 1 | 전액 환불 succeeded + 전부 미사용 | 그 구매 grant 잔량 0 으로 회수 | 통과 |
| 2 | 다른 구매의 grant / 기존 ledger | 불변(ledger 행 수·잔량 동일) | 통과 |
| 3 | 같은 이벤트·다른 이벤트 반복, 동시 4회 호출 | refund ledger 1행, 2회째부터 already_revoked | 통과 (웹훅 event.id 재전송 skip 은 단위 테스트) |
| 4 | 예약 hold 가 grant 점유 | 회수 안 함(partially_used_or_reserved), 관리자 처리 | 통과 |
| 5 | hold + consume 진행 | 회수 안 함 | 통과 |
| 6 | hold 후 release(예약 취소 이력) | 잔량은 원래대로여도 이력이 있어 보수적으로 회수 안 함 → 관리자 처리 | 통과 |
| 7 | 부분 환불 | 회수 안 함(not_full_refund) | 통과 |
| 8 | 환불 pending / failed / canceled | 성공으로 취급 안 함, 회수 안 함 | 통과 |
| 9 | pending → succeeded 순서 도착 | succeeded 후에만 회수, 반복 안전 | 통과 |
| 10 | 환불 후 재결제 | 새 구매 grant 영향 없음, 새 구매는 환불 없으면 회수 안 함 | 통과 |
| 11 | 일부 사용(adjust -1) | 회수 안 함 | 통과 |
| 12 | 일부 만료(expire) | 회수 안 함 | 통과 |
| 13 | 이전(transfer) 이력 | 회수 안 함 | 통과 |
| 14 | 관리자 보정(adjust +, 이월·연장 포함) | 회수 안 함 | 통과 |
| 15 | grant 없는 구매 | no_grant, 회수 안 함 | 통과 |
| 16 | 환불 이벤트 플래그 꺼짐 | 기록만, RPC 호출 없음 | 통과(단위) |
| 17 | 플래그 켜짐 + 회수 불가 | `needs_review` 유지 | 통과(단위: RPC 호출 확인) |

범위·한계
- RPC 는 `entitlement_ledger` 만 읽고 쓴다. 과거 수업·reservation·세션 행은 건드리지 않는다(시나리오 2·4 에서 ledger 외 변경 없음 확인).
- hold/consume/release 는 앱의 `hold_entitlement` 등이 남기는 ledger 이벤트로 시뮬레이션했다(reservation FK 는 픽스처에서 우회). 실제 예약 플로우 E2E 는 활성화 전 Preview UAT 에서 한 번 더 확인해야 한다.
- 만료로 전량 소진된 grant 는 잔량 0 이라 회수 대상이 아니고 manual 로 분류된다(현금 환불과 수업권 정합은 관리자 판단).
- 보수적 원칙: 판단이 애매하면 회수하지 않는다.
