# 5세트 채우기 — Macroeconomics MA4·MA5, Microeconomics MI4·MI5 (2026-10-21, "적재 직전"까지)

공개 세트와의 겹침은 DB 현재 공개 세트 사용 키(`data/ap/stock/blocked-db-{macro,micro}.json`)로 막았다. 세트 사이는 같은 문항 0·같은 질문+정답 문장(`sig`) 0(MA1~MA3 때와 같은 규칙). 신규 원형 풀이 틀 제한(0.5 유사도·문항군)은 MA3·MI3 확대 때의 오너 규칙이라 이번에는 적용하지 않았다(적용하면 새 문항 수십 개를 원형부터 새로 써야 한다 — `_topup-assign.ts --strict` 로 같은 계산을 다시 볼 수 있다).

## 결과

| 세트 | 구성 | 독립 검증기 | 화면 증거 | 배정 파일 |
|---|---|---|---|---|
| Macro MA4 | MC 60 + FRQ 3, 가상 0 | 위반 0 | 전 키 있음(390×844·1280×800, 실패 0) | `exact-assign-macro-ma4-ma5.json` |
| Macro MA5 | MC 60 + FRQ 3, 가상 0 | 위반 0 | 전 키 있음 | 같은 파일 |
| Micro MI4 | MC 60 + FRQ 3, 가상 0 | 위반 0 | 전 키 있음 | `exact-assign-micro-mi4-mi5.json` |
| Micro MI5 | MC 60 + FRQ 3, 가상 0 | 위반 0 | 전 키 있음 | 같은 파일 |

검증기 출력: `exact-assign-{macro-ma4-ma5,micro-mi4-mi5}-verifier.txt`. **관리자 적재(①)·변환(④)·초안 저장·공개는 아직 하지 않았다**(운영 에이전트 몫). 공유 DB 쓰기 없음.

## 예비 문항 풀 (~30 %, 비공개)

세트 문항의 단원×스킬 칸 수의 30 %를 올림해 같은 칸의 미사용·공개 아님·sig 중복 제거 후보로 골랐다. 키 목록: `spare-macro-ma4-ma5.json`(36), `spare-micro-mi4-mi5.json`(33)의 `selected`(전체 후보는 `spare`). 선택된 예비 전부 화면 증거가 있다. 같은 칸에 후보가 부족한 칸이 있어(Macro 17·Micro 23 칸) 칸별 정확한 30 %는 아니다 — 부족 칸은 `spare` 전체 목록에서 다른 칸 후보를 골라 세트 안 교체 때 단원·스킬 범위 검증을 거친다.

## 새로 만든 것

- 생성(유료, 신규 지출 약 $11.9(장부 $512.18 → $524.08)): `config/ap-frozen/{macro-t,macro-t-f,macro-t2-a,macro-t2-f,macro-t3-a,macro-t4-a,macro-t5-a,micro-t-a,micro-t-f,micro-t2-a,micro-t2-f}.v1.json`. 이미 있는 원형의 **공개 안 된 변형**과 FRQ 새 시드, 그리고 새 정의·비교·설명 원형 11개(`ma_t_*`, `archetypes/macro_p0_t2.py`, 시나리오 2개씩, 가이드 JSON 11항목 추가).
- 재고 배치: `macro-t`, `macro-t2`, `macro-t3`, `macro-t5`, `micro-s6t`, `micro-s6u`(`data/ap/stock/<배치>-{items,pass-keys,summary}.json`), `lib/ap-admin/batches.ts` 에 등록(증거 파일 `evidence-macro-t.json`, `evidence-micro-t.json`).
- 화면 증거: `data/ap/screen-evidence/evidence-macro-t.json`(206), `evidence-micro-t.json`(140), 스크린샷 `docs/ap/screen-evidence/{macro-t,micro-t}`. 격리 스택 `ALTON_aptop`(PORT_OFFSET 3300), 정리·중지·config 원복 완료.
- `scripts/ap-generation/_topup-assign.ts`: MA4/MA5·MI4/MI5 배정·예비 후보 산출(DB 공개 키·sig 차단, 순차 풀이, 독립 검증기).
- 렌더 보고서 `data/ap/render-check/report.json` 재생성.

## 알려진 한계

- 자동 채점(AI 독립 풀이 + 검토기)과 결정적 게이트 통과만 확인했다. 사람이 읽고 검수한 것이 아니다(출시 후 오류 신고로 보완).
- 신규 `ma_t_*` 원형은 고정 문장 은행형이라 시나리오당 정답이 한 개로 정해진다. 같은 세트에 같은 원형을 두 번 넣지 않는다(문항군 규칙).
- `data/ap/stock/exact-assign-*` 의 키는 DB 변환 전(`review_env_ready` 아님)이므로 운영 에이전트가 ① 적재 → ② 렌더 → ③ 화면 → ④ 변환을 거친 뒤 초안 검증(`planDraftSet`)으로 DB 기준 겹침·해시를 다시 확인해야 한다.
- 이 작업 트리에서 실패한 기존 테스트 3건(`audit-1019-type-fixes`·`psych-archetypes`·`screen-evidence-file(evidence-pre)`)은 이번 변경과 무관한 기존 상태다(Precalculus 증거 스크린샷 파일 누락 등).
