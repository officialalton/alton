# 5세트 채우기 C그룹(World History · English Literature · European History) — 재고 점검 (2026-10-21, 읽기 전용·유료 호출 0·DB 쓰기 0)

공개 세트 사용 키(`data/ap/stock/blocked-db-{world_history,english_literature,european_history}.json`, DB 읽기 전용 조회: WH 60 · Lit 24 · Euro 46)를 뺀 "남은 재고". `lt-assign.ts` 에 `--block-file` 옵션 추가(다른 *-assign 과 같은 형식).

| 과목 | 공개 | 남은 재고(화면 증거 있는 것) | 목표 세트가 요구하는 것 | 결과 |
|---|---|---|---|---|
| World History | 3 | MC 자료 세트 5개(17문항; 단원 2·4·5·7만) · FRQ 6(saq1 2, dbq 2, leq 2) | WH4+WH5 = MC 30세트(110문항, 9개 단원 전부) + FRQ 10(5유형 ×2) | 부족: MC 25세트(단원 1·3·6·8·9 전무, 나머지 단원 보충) · saq2 2 · saq3 2 |
| English Literature | 3 | MC 묶음 9(단편 3·30문항, 시 3·34, 장편·희곡 3·27) · FRQ 7(q1 2, q2 4, q3 1) | LT4(1세트, 묶음 5·MC 55·FRQ 3), LT5 | LT4 단독도 `infeasible`(묶음 크기 조합이 장르 문항 수 23–27/19–25/8–10에 안 맞음). LT4 는 묶음 몇 개(단편 13문항급 1–2)만 신규, LT5 는 전체 신규 |
| European History | 2 | **0**(공개 46키가 재고 전부) | EU3·EU4·EU5 = MC ~45세트·FRQ 12 | 전부 신규 저작 |

판단: 세트 구성 병목은 비용이 아니라 **실제 자료(저작권·출처 확인)를 고르고 앵커를 잡는 일**이다. 이전 라운드(WH1·WH2: MC 30세트 + FRQ 10, 약 $16)를 기준으로 생성비만 보면 WH4·5 약 $12–16, LT4·5 약 $8–12, EU3–5 약 $18–24(합 약 $38–52)이고 $35 안에 7세트를 다 채우기는 어렵다. 품질을 낮춰 채우지 않았다.
시작 순서 권장: LT4(묶음 소수 신규) → WH4(저장 MC 5세트 + 신규 10세트 + saq2·saq3) → 나머지.
