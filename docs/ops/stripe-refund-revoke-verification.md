# 환불 자동 회수 검증 결과 (2026-10-21)

## 현재 상태 (구분 기재)
| 항목 | 상태 |
|---|---|
| 공유 DB 스키마 | `20261030100000`, `20261031100000` **적용 완료**(공유 비프로덕션 DB — 공유 DB 변경이므로 영향 범위를 가볍게 보지 않는다). `20261031200000_refund_entitlement_lock_before_check.sql` 은 **작성만, 미적용**(총괄 적용 대기) |
| Preview 코드 배포 · UAT | 미확인(이 문서 작성 시점에 Preview 배포·화면 UAT 를 수행하지 않음) |
| Production 코드 배포 | **미배포** |
| 자동 회수 활성화 | **꺼짐**(`STRIPE_AUTO_REVOKE_ON_REFUND` 미설정, 기본 off) |
| 실제 결제·환불 조작 | **없음**(Stripe 호출 없음, 실제 고객 수업권 사용 없음) |
| 환불 기록·관리자 확인 표시 | 항상 동작(`payment_refunds`, `needs_review`) |

검증 환경: 격리 Supabase 스택(PORT_OFFSET=1300, 매번 종료·config 원복 완료), 읽기 전용 원격 SELECT. 프로덕션 반영 없음.
테스트: `lib/stripe-webhook-rpc.integration.test.ts`(DB RPC), `lib/booking/stripe-refund-revoke-real-booking.integration.test.ts`(실제 예약 경로·경합·수동 처리), `app/api/webhooks/stripe/route.r4.test.ts`(웹훅 흐름).

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

## 추가 검증 (2026-10-21, 실제 예약 경로·경합·관리자 화면)
격리 스택(PORT_OFFSET=1300, 종료·config 원복 완료)에서 `lib/booking/stripe-refund-revoke-real-booking.integration.test.ts` 10건 + 기존 19건 = 29건 통과. 실행 ID(`rvk-…`) 전용 선생님·학생·구매만 사용(ledger 는 append-only 라 격리 스택에서만 실행).

### ① 실제 예약·취소·소비 경로 (ledger 직접 삽입 없음)
| 시나리오 | 사용한 실제 RPC | 기대 | 결과 |
|---|---|---|---|
| 예약된 수업 | `confirm_lesson_booking` | 회수 안 함(partially_used_or_reserved), 잔량 19 유지 | 통과 |
| 선생님 귀책 취소 후 | `cancel_lesson_booking`(release) | 이력이 있어 회수 안 함 | 통과 |
| 수업 소비 후 | `consume_entitlement` | 회수 안 함 | 통과 |
| 미사용 구매 회수 후 예약 시도 | `confirm_lesson_booking` | 잔량 0 이라 예약 거부, hold 0 | 통과 |
한계: 학생 24시간 이내 취소→consume 분기와 세션 완료 경로는 `consume_entitlement` 호출로 대표했다(예약 창 최소 24시간 제약으로 테스트에서 만들 수 없음). 실제 Preview 화면 UAT 는 아직 수행하지 않았다(활성화 전 필수 항목으로 남김).

### ② 경합 분석과 테스트
- 잠금: `hold_entitlement` 는 grant 행을 `for update` 로 잠근 뒤 잔량을 합산하고, `auto_revoke_refunded_purchase` 도 같은 grant 행을 `for update` 로 잠근 뒤 ledger 를 읽는다(판정과 쓰기가 한 트랜잭션, 기본 READ COMMITTED 로 충분 — 잠금 획득 후 다시 읽으므로 stale 판정 없음). 따라서 회수와 예약은 직렬화된다: 예약이 먼저면 hold 가 보여 회수 안 함, 회수가 먼저면 잔량 0 이라 예약 거부.
- 테스트: 12회 반복 동시 실행(예약 vs 회수) — 매 회 "회수됨 + hold 공존" 없음, 예약 성공 시 회수는 partially_used_or_reserved, 회수 성공 시 예약 실패 및 잔량 0. 6회 반복(회수 2회 + consume 동시) — 잔량 음수 없음, consume 1건, refund 0건. 모두 통과.
- (정정됨) 수동 경로의 `refund_entitlement`(M2)는 "미래 hold 존재" 검사를 grant 잠금 **이전**에 해서, 검사~잠금 사이에 끼어든 예약은 유지된 채 남은 잔량만 회수되는 결함이 있었다. 이는 정상 동작이 아니므로 새 마이그레이션 `20261031200000` 으로 정정했다(아래 "수동 경로 정정" 절). 적용 전까지 공유 DB 의 수동 회수에는 이 결함이 남아 있다.

### ③ 자동 회수 꺼짐 상태
웹훅 단위 테스트(`route.r4.test.ts`)에서 플래그 꺼짐이면 `payment_refunds` 에 구매 연결 기록이 남고 RPC 호출이 없음을 확인했다. `needs_review=true` 로 남아 관리자 화면 "처리 대기"에 표시된다(`PaymentRefundBoard.test.tsx`).

### 수동 경로 정정과 동시성 검증 (마이그레이션 `20261031200000`, 작성만)
- 정정: `refund_entitlement` 가 (1) 그 구매의 유료 grant 를 id 오름차순으로 모두 먼저 잠그고 (2) 잠금 이후에 미래 활성 hold **또는 release/consume 으로 해소되지 않은 hold**가 하나라도 있으면 예외로 전체 중단 (3) 통과하면 같은 트랜잭션에서 회수. 중단되면 `resolve_payment_refund`(및 `approveRefund`)의 회수 장부·처리 완료 표시도 같은 트랜잭션이라 함께 롤백된다. 수업 시간이 지났지만 소비·해제되지 않은 hold 도 막는다.
- 참고: 스키마가 구매당 grant 를 1개로 제한(`entitlement_grants_purchase_id_ref_uq`)하므로 "여러 수업권 중 하나에서 예약 발견 시 전체 롤백"은 현재 스키마에서 재현할 수 없다. 코드는 여러 grant 를 id 순으로 모두 잠그도록 작성했고, 다중 grant 가 생기면 다시 검증해야 한다(미검증). `order by … for update` 의 잠금 순서는 단일 행에서는 의미가 없고, 다중 행에서는 정렬 후 잠금이라는 PostgreSQL 의 알려진 한계가 있다.
- **부분 회수(예약은 유지하고 남은 잔량만 회수)는 정상 동작이 아니다.** 필요하면 별도 관리자 작업으로 설계해야 하며 이번 범위에서는 만들지 않았다.
- 시행 결과(격리 스택, 실행 ID 전용 데이터, 수동 회수 = `resolve_payment_refund`):
  | 시나리오 | 반복 | 실제 결과 |
  |---|---|---|
  | 수동 회수 vs 신규 예약(무작위 동시 시작) | 25 | 25회 모두 회수가 먼저 도착(예약 실패) — 불변식(회수+hold 공존 없음) 25/25 유지. **순서가 한쪽으로 쏠려 예약이 먼저인 경우는 이 시행에서 관찰되지 않음** |
  | 수동 회수 vs 소비(무작위) | 15 | 15회 모두 소비가 먼저 → 회수 성공, 소비 1건 유지, 이중 반영 없음 |
  | 같은 환불을 3개 세션이 동시 처리 | 15 | 15/15 정확히 1회 처리, 나머지는 already_handled, 회수 장부 1행 |
  | 결정적 교차 ①: 예약 트랜잭션을 2초 열어두고 0.7초 뒤 수동 회수 | 3 | 3/3 회수 중단(예약 유지), 장부·완료 표시 미반영, 잔량 19 |
  | 결정적 교차 ②: 수동 회수 트랜잭션을 2초 열어두고 0.7초 뒤 예약 | 3 | 3/3 예약 실패(잔량 0), 회수 1행·완료 표시 |
  | 결정적 교차 ③: 소비 트랜잭션을 2초 열어두고 0.7초 뒤 수동 회수 | 3 | 3/3 소비 확정 후 회수, 소비 1건 유지 |
  | 예약 있어 실패 → 예약 취소 → 재시도 → 재재시도 | 1 | 실패 시 장부·완료 표시 없음, 재시도 1회 회수, 재재시도 already_handled |
  | 수업 시간 경과했으나 미해소 hold | 1 | 회수 중단 |
  제한된 반복(총 수십 회)이므로 "경합이 절대 없다"는 단정이 아니라, 관찰한 모든 시행에서 불변식이 유지됐고 잠금 설계로 설명된다는 뜻이다. 무작위 경합은 한쪽 순서로 쏠렸기 때문에 반대 방향은 결정적 교차 테스트로 보강했다.

### 남은 수업 경로 (24시간 이내 학생 취소 · 실제 수업 완료)
- 기존에는 `consume_entitlement` 직접 호출로 대표했던 부분이며 이는 **직접 호출 검증**이다. 이번에 제품 RPC 경로로 분리해 검증했다.
- 방법: 제품에는 테스트 시계가 없고 예약은 24시간 이상 뒤 슬롯만 만들 수 있다. 저장소 기존 테스트(`session-final-judgment`)와 같이 예약은 정당한 경로(`confirm_lesson_booking`)로 만든 뒤 **예약 행의 시각만** 이동하고, 이후 제품 RPC(`cancel_lesson_booking`, `mark_lesson_session_started`, `finalize_lesson_session`)는 시간·권한 검사를 그대로 거쳐 호출했다. 시각 이동은 테스트 픽스처 조작이라는 점을 명시한다.
- 결과: 24시간 미만 학생 취소 → consume 1건, 자동 회수 안 함(partially_used_or_reserved), 수동 회수는 소비분 제외 잔량 0 처리 / 수업 완료(`finalize completed`) → consume 1건, 자동 회수 안 함. 각 1회 통과.
- 미검증: 실제 시간 경과(시계)로 인한 흐름, Preview 화면에서의 완료 처리, 노쇼 판정 경로의 환불 상호작용.

### 관리자 환불 처리 화면
- 위치: 관리자 > 수업권/결제 > "결제 실패·대사" 탭 하단(`app/admin/PaymentRefundBoard.tsx`). 구성: 환불 내역(Stripe 상태·금액), 원래 구매(총액·상태), 수업권 지급·잔여·소비·예약 점유·회수 수, 자동 회수 결과 또는 수동 처리 사유, 처리 대기/완료(처리자·시각·사유), 웹훅 이상(모드·금액 불일치 등) 확인·해결.
- 수동 처리: `resolve_payment_refund` RPC(마이그레이션 `20261031100000`)가 기존 `refund_entitlement` 를 재사용(그 구매 grant 만, 미래 예약 있으면 중단·롤백), 이미 처리된 행 재처리 거부, 사유 필수, 과거 기록 삭제 없음. 통합 테스트로 확인(다른 구매 불변, 중복 거부, 미래 hold 시 롤백, dismiss 는 수업권 불변).
- 권한: 서버 액션이 `manage_payments`/관리자 검사 후에만 동작(`payment-refund-actions.test.ts`).
