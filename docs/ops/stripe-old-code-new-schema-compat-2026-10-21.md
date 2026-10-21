# 구형 Stripe 웹훅 코드 + 신 스키마 호환성 점검 (2026-10-21)

범위: Production 코드(`app/api/webhooks/stripe/route.ts`, = `9ba5bb238` 버전, `f0194c028`에서 되돌려짐) 가 신 마이그레이션(20261030100000 / 20261031100000 / 20261031200000)이 적용된 DB 에서 어떻게 실패하는지. 격리 스택(PORT_OFFSET=1800)에 전체 마이그레이션을 적용하고, route 핸들러를 직접 호출(서명은 테스트 시크릿으로 정상 생성), 실패는 DB 트리거(실제 DB 오류)와 어댑터 crash(핸들러 도중 중단)로 주입했다.
재현 코드: `app/api/webhooks/stripe/route.old-code-new-schema.integration.test.ts` (격리 스택 전용). 원시 결과 JSON 은 실행 시 `STRIPE_COMPAT_OUT` 으로 출력.

## 핵심 결론

1. **신 유일 제약은 구형 코드에서 한 번도 걸리지 않는다.** 구형 코드는 `credit_purchases.stripe_checkout_session_id` 와 `payment_attempts.attempt_key` 를 쓰지 않아 항상 NULL 이고, 유일 인덱스는 NULL 을 중복으로 보지 않는다(실측: 두 컬럼이 채워진 행 0). 따라서 "중복 삽입 오류로 미지급 상태에서 복구 불가"는 **발생하지 않았다** — 반대로 제약이 아무 보호도 하지 않는다. 구매 단위 멱등성은 제약만으로 완성되지 않고, 그것을 쓰는 코드(신 route / RPC)가 있어야 한다.
2. 구형 코드의 결함은 신 스키마 이전부터 있던 것이며 **신 스키마가 새로 만든 실패는 재현되지 않았다.** 아래 레거시(L) 경로의 이중 지급·고아 행·원장/잔액 불일치가 구형 코드 자체의 문제다.
3. 현재 주력 purchases(P) 경로는 grant 생성이 단일 RPC(멱등)라 **이중 지급 없음**. 재시도마다 `payment_attempts` 성공 행이 늘어나는 것만 남는다(감사 중복, 지급 영향 없음).

## 시나리오별 재현 결과 (P = purchases/entitlement, L = 레거시 credit_packages)

| # | 시나리오 | P 경로 | L 경로 |
|---|---|---|---|
| 1a | 지급 단계 DB 오류(P: grant 삽입, L: credit_transactions 삽입) 후 재시도 | 500, 영수증 미처리, **시도 행 succeeded 1건인데 grant 0**(영수증/시도는 있고 지급은 없는 상태). 재시도 시 grant 1, 시도 행 2건(중복). 복구됨 | 500, `credit_purchases` 1행 생성 후 거래·잔액 없음(**구매 행만 있고 미지급**). 재시도 시 구매 행 2개(고아 1개), 거래·잔액 1회 지급. 지급은 복구, 데이터 오염 |
| 1b | 거래 기록 후 잔액 갱신 실패 후 재시도 | (해당 없음) | 500 → 재시도 후 **원장(txSum) 20 vs 잔액 10 불일치**, 구매 행 2개 |
| 2a | 지급 후 processed_at 갱신이 DB 오류 | 코드가 오류를 무시하고 **200**(Stripe 재시도 중단), 영수증 미처리로 방치. 같은 이벤트가 다시 오면 grant 1 유지, 시도 행만 증가 | 200, 영수증 미처리. 같은 이벤트가 다시 오면 **이중 지급**(잔액 20, 구매 행 2) |
| 2b | 지급 후 프로세스 중단(crash) 후 재시도 | 500 → 재시도 grant 1, 시도 행 2. 안전 | 500 → 재시도 **이중 지급**(잔액 20) |
| 3a | 동일 이벤트 재전송 | 2회째 `skipped: already processed`, 안전 | 동일, 안전 |
| 3b | **다른 이벤트 id, 같은 checkout session** | grant 1 유지(RPC 멱등), 시도 행 2 | **이중 지급**(구매 행 2, 잔액 20). 신 유일 제약은 session id 미사용으로 방어 못 함 |
| 4a | 같은 새 이벤트 동시 2건 | 하나는 `race: already recorded` 200, 하나 처리. grant 1, 시도 1 | 동일하게 1회 지급. 안전 |
| 4b | 미처리 영수증을 가진 이벤트의 동시 재전송 2건 | grant 1, 시도 행 2 | **이중 지급**: 구매 행 2, 거래 2(txSum 20), 잔액 10(읽기-수정-쓰기 경쟁으로 갱신 유실; 이번 실행 값) |
| 4c | 다른 이벤트 id, 같은 session 동시 2건 | (3b 와 동일 성격) | 구매 행 2, txSum 20, 잔액 10(위와 같은 유실) |
| 5a | 존재하지 않는 purchase_id (영구 오류) | 3회 모두 500, 영수증 미처리로 남음 (Stripe 재시도가 3일 지속될 수 있음 — 신 스키마 무관, 구형 코드 고유) | — |
| 5b | metadata 불완전 | — | 3회 모두 400, 영수증 미처리(Stripe 재시도 지속) |

"무한 500"은 5a(없는 구매 id)에서 재현. 신 유일 제약 때문에 발생하는 500 은 **미재현**(제약 컬럼을 쓰지 않으므로 경로가 없음).

## 현재 Production 경로 사용 현황

- 코드 근거: Checkout Session 을 만드는 코드는 `app/parent/purchase-actions.ts` 한 곳뿐이며 metadata 는 `purchase_id`(P 경로). 레거시 L 경로(metadata `student_id`+`package_id`)를 만드는 `sessions.create` 는 앱 코드에 없다(`app/parent/credits-actions.ts` 에는 세션 생성 호출 없음). 즉 새 L 결제를 시작하는 UI 경로는 코드상 없고, L 이벤트는 과거에 만들어진 세션/외부 링크로만 올 수 있다.
- **건수는 미확인**: 이 세션에서 Production 읽기 SELECT 시도가 자동 권한 분류기에 의해 거부되어(자격증명 사용) 실행하지 못했다. 읽기 전용 SQL 을 `docs/ops/stripe-path-usage-readonly.sql` 로 제공 — 오너/배포 담당이 실행해야 한다. 미처리 영수증 수, grant 없는 succeeded 구매, 고아 credit_purchases 도 같은 파일에서 확인한다.

## 호환성 수정안 (Stripe 변경 전체 배포안과 구분)

판정: **P 경로는 구형 코드 그대로 신 스키마에서 안전**(이중 지급 없음). 신 스키마를 되돌릴 필요 없음(additive, 구형 코드가 쓰지 않는 컬럼/테이블/함수).
유일하게 구형 코드 위험을 줄이는 최소 변경은 L 분기 한 곳이다: `docs/ops/stripe-old-code-legacy-rpc-compat.patch`(미적용, route.ts L 분기만). 세 번의 개별 쓰기를 이미 적용된 `grant_legacy_credit_purchase` RPC 호출 1회로 교체한다(단일 트랜잭션, session 당 1회).
- 같은 테스트를 패치 route 로 실행한 결과: 1a/1b(고아·불일치 없음, 재시도로 복구), 2a/2b, 3b, 4b, 4c 전부 **지급 1회, 구매 행 1, txSum=잔액=10**. P 경로 결과는 불변.
- 이 패치는 새 마이그레이션이 필요 없다(RPC 는 이미 Production DB 에 있음). 유일 제약 완화 마이그레이션은 **불필요**(제약이 구형 코드에서 걸리지 않으므로) — 따라서 완화 SQL 은 작성하지 않았다.
- 패치 적용 후에도 남는 것(구형 코드 고유, 이번 수정 범위 밖): P 경로의 재시도별 `payment_attempts` 중복 행, markProcessed 오류 무시, 영구 오류 시 Stripe 재시도 지속, 금액·통화 대조 없음. 이는 신 route 의 몫이다.
- 전환 시 주의: 패치(또는 신 route)가 배포되기 전 구형 코드가 만든 L 구매 행은 session id 가 NULL 이라, 이후 같은 session 이벤트가 신 코드로 오면 중복 지급될 수 있다(배포 경계의 이론적 틈). 배포 직전 미처리 영수증(`processed_at is null`)을 0 으로 만든 뒤 전환하면 회피된다.

## 미재현·미검증

- Production 경로별 실제 건수, Production 의 미처리 영수증·고아 행 현황(권한 거부로 미조회).
- 실제 Stripe 이벤트/네트워크 단절(어댑터 crash 와 DB 트리거로 모사). Next.js 런타임의 예외→500 변환은 핸들러 직접 호출이라 테스트 하네스가 대신 모사.
- payment_intent.payment_failed / checkout.session.expired / 분쟁 분기의 신 스키마 상호작용(신 스키마가 이 분기가 쓰는 테이블을 변경하지 않음을 마이그레이션 파일 검토로만 확인, 실행 미검증).
- 패치 route 의 P 경로 동작은 원본과 같다는 것 외에 별도 시나리오 미실행.
- 신 route(494150d96) 전체 배포안 동작은 이 문서 범위 밖(검증하지 않음).
