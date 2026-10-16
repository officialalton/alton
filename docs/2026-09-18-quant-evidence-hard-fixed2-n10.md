# 유형별 표본 생성·품질 계약 검증 — 난이도 hard, 유형당 10문항 (2026-09-18 04:36)

파이프라인: 생성 → 자료 → 유형별 품질 계약 → 독립 검사 → (오답만 걸리면) 자리별 구조화 계획·생성·결정적 검사(자리당 최대 2회) → 통과 시 채택, 지문·질문·정답·계약·독립검사 통과 + 잔여 오답 실패 1~2건이면 보강 대기, 그 외 폐기. 대기 상한은 요청 수. 총 소요 7분.

**요청 10개(유형당 10) → 후보 4개 평가**

| 지표 | 값 |
|---|---|
| 첫 생성 통과율(보정 0회) | 0/4 = 0% |
| 자동 보정 뒤 최종 통과율 | 4/10 = 40% |
| 보강 대기 전환율 | 0/10 = 0% (목표 ≤10%) |
| 대기 한도 초과 폐기 | 0 |
| 오답 자리별 보정 시도(해소) | 8(8) |
| 필드 부분 수정 시도(해소) | 2(2) |
| 문항 전체 재생성(해소) | 12(4) |
| 빈 응답 이벤트 | 3 |
| 문항당 평균 모델 호출 | 19.75 |

## 유형별

| 세부 기술 | 체계·형식 | 요청 | 후보 | 첫통과 | 최종통과 | 통과율 | 대기(초과폐기) | 빈응답 | 부족반환 | 미해소 실패 사유 | 초 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Command of Evidence (Quantitative) (`command_of_evidence_quant`) | sat_rw · mc | 10 | 4 | 0 | 4 | 40% | 0(0) | 3 | 1 | [contract] quant-evidence: distractor_error_types 개수(2)가 오답 개수(3)와 다릅니다<br>[review] 독립 검사는 D)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음<br>[contract] quant-evidence: 정답 선택지에 수치가 없습니다 — 정량 근거 문항의 정답은 자료의 값을 인용해야 | 422 |

## 70% 미달 유형

- Command of Evidence (Quantitative) (`command_of_evidence_quant`): 4/10 — 이 유형만 오답 설계 예시·오류 분류 보강 후 재검증 필요.

## 빈 응답 이벤트(원인·재시도 결과)

| 유형 | 원인 | 재시도 | 해소 |
|---|---|---|---|
| command_of_evidence_quant | 생성 청크(3개 요청) 예외: AI 응답에 문제가 없습니다. | 아니오 | 아니오 |
| command_of_evidence_quant | 생성 청크(3개 요청) 예외: AI 응답에 문제가 없습니다. | 아니오 | 아니오 |
| command_of_evidence_quant | 생성 청크(3개 요청) 예외: AI 응답에 문제가 없습니다. | 아니오 | 아니오 |

## 요청보다 적게 반환된 경우(유형·사유)

| 요청 | 반환 | 사유 |
|---|---|---|
| 10 | 4 | command_of_evidence_quant: 게이트 통과분이 요청 수 미달 |

## 실행 조건 표본(주제·문항 첫머리 — 같은 프롬프트 반복 여부 확인용)

- command_of_evidence_quant: Which choice most effectively uses data from the table to il… | Which choice most effectively uses data from the table to co… | The historian argues that beyond a certain scale of rail exp… | Which choice most effectively uses data from the table to su…

## 실패 단계별

| 단계 | 건수 | 해소 |
|---|---|---|
| contract | 11 | 4 |
| review | 5 | 0 |

## 반복되는 실패 사유(상위)

| 사유(숫자·인용 일반화) | 건수 |
|---|---|
| quant-evidence: 정답 선택지에 수치가 없습니다 — 정량 근거 문항의 정답은 자료의 값을 인용해야 합니다. | 2 |
| 어려움 문제인데 오답 D)이 너무 명백합니다 | 2 |
| 정답 선택지의 수치(N.N, N, N.N, N)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다. | 1 |
| quant-evidence: distractor_error_types 개수(N)가 오답 개수(N)와 다릅니다. | 1 |
| 독립 검사는 D)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 어려움 문제인데 오답 B)이 너무 명백합니다 | 1 |
| quant-evidence: distractor_error_types에 알 수 없는 태그 “…”가 있습니다(허용: WRONG_ROW, WRONG_COLUMN, O | 1 |
| quant-evidence: 오답 선택지 “…”에 수치가 없습니다. | 1 |
| 지문은 'hours' 단위를 쓰지만 표·그래프의 열 이름이나 축 제목에 단위가 없습니다(예: 'Cost (dollars)'). | 1 |
| 질문 문장을 인식하지 못했습니다 — 지문 마지막 단락이 SAT 문항처럼 물음표로 끝나야 합니다(예: “…”). / 지문은 'hours' 단위를 쓰지만 표·그래프의 | 1 |
| 어려움 문제인데 오답 D)이 지문·자료와 무관합니다 | 1 |
| 정답 선택지의 수치(N, -N, N, -N, N, -N, N, -N)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다. | 1 |
| 정답 선택지의 수치(N, N, N, N, N, N)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다. | 1 |
| 어려움 문제인데 오답 B), D)이 너무 명백합니다 | 1 |
| 지문의 “…” 가 표·그래프의 항목(열·범주·계열·제목)에 없습니다. | 1 |

## 전체 실패 목록

- command_of_evidence_quant · [contract] 해소 — 정답 선택지의 수치(2.4, 35, 2.1, 51)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: distractor_error_types 개수(2)가 오답 개수(3)와 다릅니다.
- command_of_evidence_quant · [review] 미해소 — 독립 검사는 D)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 어려움 문제인데 오답 B)이 너무 명백합니다
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 정답 선택지에 수치가 없습니다 — 정량 근거 문항의 정답은 자료의 값을 인용해야 합니다.
- command_of_evidence_quant · [contract] 해소 — quant-evidence: distractor_error_types에 알 수 없는 태그 "MAX"가 있습니다(허용: WRONG_ROW, WRONG_COLUMN, OFF_BY_ONE_INDEX, ADJACENT_CELL).
- command_of_evidence_quant · [contract] 해소 — quant-evidence: 정답 선택지에 수치가 없습니다 — 정량 근거 문항의 정답은 자료의 값을 인용해야 합니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "This is true of Denver, where both the midday and nighttime "에 수치가 없습니다.
- command_of_evidence_quant · [contract] 미해소 — 지문은 'hours' 단위를 쓰지만 표·그래프의 열 이름이나 축 제목에 단위가 없습니다(예: 'Cost (dollars)').
- command_of_evidence_quant · [contract] 미해소 — 질문 문장을 인식하지 못했습니다 — 지문 마지막 단락이 SAT 문항처럼 물음표로 끝나야 합니다(예: "Which choice …?"). / 지문은 'hours' 단위를 쓰지만 표·그래프의 열 이름이나 축 제목에 단위가 없습니다(예: 'Cost (dollars)').
- command_of_evidence_quant · [review] 미해소 — 어려움 문제인데 오답 D)이 너무 명백합니다
- command_of_evidence_quant · [review] 미해소 — 어려움 문제인데 오답 D)이 지문·자료와 무관합니다
- command_of_evidence_quant · [contract] 미해소 — 정답 선택지의 수치(3, -5, 6, -8, 0, -2, 3, -5)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.
- command_of_evidence_quant · [contract] 해소 — 정답 선택지의 수치(2, 95, 61, 5, 160, 90)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.
- command_of_evidence_quant · [review] 미해소 — 어려움 문제인데 오답 D)이 너무 명백합니다
- command_of_evidence_quant · [review] 미해소 — 어려움 문제인데 오답 B), D)이 너무 명백합니다
- command_of_evidence_quant · [contract] 미해소 — 지문의 "confirmation rate" 가 표·그래프의 항목(열·범주·계열·제목)에 없습니다.
