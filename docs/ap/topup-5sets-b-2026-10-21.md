# 5세트 채우기 B그룹 — 재고 기반 배정 결과 (2026-10-21, 읽기 전용·유료 호출 0·DB 쓰기 0)

공개 세트와의 겹침은 **DB의 현재 공개 세트 사용 키**(`blocked-db-*.json`, 읽기 전용 조회)로 막고 배정했다.
파일 기반 배정(옛 보고서)만 쓰면 Macro MA4 에서 DB 공개 문항 13개가 겹쳤다(검증으로 발견).

| 세트 | 결과 | 파일 | 남은 작업 |
|---|---|---|---|
| Precalculus PC5 | 가상 0, 독립 검증기 위반 0, 46키 전부 DB 변환 완료·공개 세트와 겹침 0 | `exact-assign-pre-pc5.json` | 초안 저장→검토 공개(관리자 화면) |
| English Language EL5 | 가상 0, 위반 0, 14키 중 11 DB 적재·변환 완료, 3키(`englang-r19-a` r41/w41/w45) 미적재 | `exact-assign-el-el5.json` | 배치 `englang-r19-a` 적재→렌더→화면 기록→변환 후 초안 |
| Macro MA4 | DB 차단 적용 시 MC 52 + 가상 8, FRQ 3 | (미기록) | 가상 MC 8 신규 저작 필요 |
| Macro MA5 | MC 22 + 가상 38, FRQ 1 + 가상 2 | (미기록) | MC 38·FRQ 2 신규 저작 |
| Micro MI4 | MC 60, FRQ 2 + 가상 1(`mif_short_externality`) | (미기록) | FRQ 1 신규 저작 |
| Micro MI5 | MC 26 + 가상 34, FRQ 1 + 가상 2 | (미기록) | MC 34·FRQ 2 신규 저작 |

DB 기준 미사용·변환 완료 재고(`is_current`·`review_env_ready`·중복 아님): Calc AB MC 76·FRQ 25, EL MC 46·FRQ 6, Lit MC 9·FRQ 7, Euro 0, Macro MC 132·FRQ 7, Micro MC 65·FRQ 4, Precalc MC 225·FRQ 18, WH MC 5·FRQ 6.
World History·English Literature·European History 는 재고가 사실상 없어 세트당 신규 원형·실제 자료 저작이 필요하다(앞선 라운드 기록: 병목은 비용이 아니라 원형 저작 분량).
`el-assign.ts` 에 `--block-file` 옵션 추가(다른 *-assign 과 동일 형식).
