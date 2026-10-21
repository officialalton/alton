# 5세트 채우기 — Chemistry·CS A·Psychology 부족분 측정(2026-10-21, 읽기 전용·무료, 생성 0건·비용 $0)

차단 키 = 공개 세트의 `ap_candidate_key`(원격 SELECT, `data/ap/stock/blocked-db-{chem,csa,psych}.json`). `--no-screen`(화면 증거 미요구)이라 "준비됨"이 아니라 "통과 후보 포함" 기준이다.

| 세트 | 문항 키 겹침만 막은 경우 | 비고 |
|---|---|---|
| Psychology PS3 | **가상 0, 위반 0** (`exact-assign-psych-ps3.json`) | 적재(③④ 포함) 필요 여부는 운영 에이전트가 확인 |
| Psychology PS4 | 세트 3 + FRQ 2(aaq compliance, ebq team_bonus) | 생성 필요 |
| Psychology PS5 | MC 15 + 세트 3 + FRQ 2 | 생성 필요 |
| CS A CS4 / CS5 | 각각 MC 10 (모두 *_completion 계열 원형) | 생성 필요 |
| Chemistry CH4 / CH5 | CH4 FRQ 1(chf_short_equilibrium), CH5 MC 5 + FRQ 1 (`exact-assign-chem-ch4-ch5-keylevel.json`) | 통과 후보 104건의 ③④ 처리 뒤 |

## 중요: Chemistry 는 엄격 규칙(원형 서로소)으로는 해가 없다
CH3 때 오너 지시("규칙 완화 금지")와 같이 **공개 세트가 쓴 원형(138개)을 모두 막으면 CH4+CH5 배정은 infeasible**(`CHEM_BLOCK_ARCH`). 문항 키만 막은 위 결과는 같은 원형의 숫자·표현만 다른 변형을 새 문항군으로 세는 것이라 POLICY-DECISIONS 의 "코드 원형·숫자 차이는 별도 군으로 세지 않음"과 충돌한다. 엄격 기준으로 CH4+CH5 를 채우려면 CH3 때(원형 단독 60 + 세트 2 + FRQ 7, 약 $10.6)와 같은 규모의 **새 원형 저작이 세트당 필요**하다. CS A·Psychology 도 같은 기준을 적용해야 하는지 오너 확인이 필요하다(이 문서의 CS/Psych 수치는 키 기준).
