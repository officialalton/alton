# 유형별 표본 생성·품질 계약 검증 — 난이도 hard, 유형당 10문항 (2026-09-18 05:35)

파이프라인: 생성 → 자료 → 유형별 품질 계약 → 독립 검사 → (오답만 걸리면) 자리별 구조화 계획·생성·결정적 검사(자리당 최대 2회) → 통과 시 채택, 지문·질문·정답·계약·독립검사 통과 + 잔여 오답 실패 1~2건이면 보강 대기, 그 외 폐기. 대기 상한은 요청 수. 총 소요 4분.

**요청 10개(유형당 10) → 후보 9개 평가**

| 지표 | 값 |
|---|---|
| 첫 생성 통과율(보정 0회) | 4/9 = 44% |
| 자동 보정 뒤 최종 통과율 | 9/10 = 90% |
| 보강 대기 전환율 | 0/10 = 0% (목표 ≤10%) |
| 대기 한도 초과 폐기 | 0 |
| 오답 자리별 보정 시도(해소) | 5(5) |
| 필드 부분 수정 시도(해소) | 5(5) |
| 문항 전체 재생성(해소) | 2(2) |
| 빈 응답 이벤트 | 2 |
| 문항당 평균 모델 호출 | 5.22 |

## 유형별

| 세부 기술 | 체계·형식 | 요청 | 후보 | 첫통과 | 최종통과 | 통과율 | 대기(초과폐기) | 빈응답 | 부족반환 | 미해소 실패 사유 | 초 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Command of Evidence (Quantitative) (`command_of_evidence_quant`) | sat_rw · mc | 10 | 9 | 4 | 9 | 90% | 0(0) | 2 | 1 | — | 245 |

## 70% 미달 유형

없음 — 전 유형 70% 이상.

## 빈 응답 이벤트(원인·재시도 결과)

| 유형 | 원인 | 재시도 | 해소 |
|---|---|---|---|
| command_of_evidence_quant | 생성 청크(1개 요청) 예외: AI 응답에 문제가 없습니다. | 아니오 | 아니오 |
| command_of_evidence_quant | 생성 청크(2개 요청) 예외: AI 응답에 문제가 없습니다. | 아니오 | 아니오 |

## 요청보다 적게 반환된 경우(유형·사유)

| 요청 | 반환 | 사유 |
|---|---|---|
| 10 | 9 | command_of_evidence_quant: 게이트 통과분이 요청 수 미달 |

## 실행 조건 표본(주제·문항 첫머리 — 같은 프롬프트 반복 여부 확인용)

- command_of_evidence_quant: Which choice most effectively uses data from the table to su… | Which choice most effectively uses data from the table to il… | Which choice most effectively uses data from the table to su… | Which choice most effectively uses data from the table to su… | Which choice most effectively uses data from the table to il… | Which choice most effectively uses data from the table to su… | Which choice most effectively uses data from the graph to su… | Which choice most effectively uses data from the graph to su… | Which choice most effectively uses data from the table to su…

## 실패 단계별

| 단계 | 건수 | 해소 |
|---|---|---|
| review | 1 | 1 |
| contract | 1 | 1 |

## 반복되는 실패 사유(상위)

| 사유(숫자·인용 일반화) | 건수 |
|---|---|
| 어려움 문제인데 오답 D)이 너무 명백합니다 | 1 |
| quant-evidence: distractor_error_types에 알 수 없는 태그 “…”가 있습니다(허용: WRONG_ROW, WRONG_COLUMN, O | 1 |

## 전체 실패 목록

- command_of_evidence_quant · [review] 해소 — 어려움 문제인데 오답 D)이 너무 명백합니다
- command_of_evidence_quant · [contract] 해소 — quant-evidence: distractor_error_types에 알 수 없는 태그 "ROW_SUM"가 있습니다(허용: WRONG_ROW, WRONG_COLUMN, OFF_BY_ONE_INDEX, ADJACENT_CELL).
