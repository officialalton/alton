# 유형별 표본 생성·품질 계약 검증 — 난이도 hard, 유형당 10문항 (2026-09-18 05:56)

파이프라인: 생성 → 자료 → 유형별 품질 계약 → 독립 검사 → (오답만 걸리면) 자리별 구조화 계획·생성·결정적 검사(자리당 최대 2회) → 통과 시 채택, 지문·질문·정답·계약·독립검사 통과 + 잔여 오답 실패 1~2건이면 보강 대기, 그 외 폐기. 대기 상한은 요청 수. 총 소요 5분.

**요청 10개(유형당 10) → 후보 11개 평가**

| 지표 | 값 |
|---|---|
| 첫 생성 통과율(보정 0회) | 6/11 = 55% |
| 자동 보정 뒤 최종 통과율 | 10/10 = 100% |
| 보강 대기 전환율 | 0/10 = 0% (목표 ≤10%) |
| 대기 한도 초과 폐기 | 0 |
| 오답 자리별 보정 시도(해소) | 6(6) |
| 필드 부분 수정 시도(해소) | 5(5) |
| 문항 전체 재생성(해소) | 5(3) |
| 빈 응답 이벤트 | 0 |
| 문항당 평균 모델 호출 | 6.8 |

## 유형별

| 세부 기술 | 체계·형식 | 요청 | 후보 | 첫통과 | 최종통과 | 통과율 | 대기(초과폐기) | 빈응답 | 부족반환 | 미해소 실패 사유 | 초 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Command of Evidence (Quantitative) (`command_of_evidence_quant`) | sat_rw · mc | 10 | 11 | 6 | 10 | 100% | 0(0) | 0 | 0 | [review] 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음<br>[contract] quant-evidence: distractor_error_types에 알 수 없는 태그 "MAX_ONLY_<br>[review] 독립 검사 지적: 선택지 B의 수치가 지문 자료(29→27분)와 불일치함(선택지에는 28→26분으로 기재), | 286 |

## 70% 미달 유형

없음 — 전 유형 70% 이상.

## 빈 응답 이벤트(원인·재시도 결과)

없음.

## 요청보다 적게 반환된 경우(유형·사유)

없음.

## 실행 조건 표본(주제·문항 첫머리 — 같은 프롬프트 반복 여부 확인용)

- command_of_evidence_quant: Which choice most effectively uses data from the table to de… | Which choice most effectively uses data from the table to su… | Which choice most effectively uses data from the table to su… | Which choice most effectively uses data from the table to il… | Which choice most effectively uses data from the table to su… | Which choice most effectively uses data from the table to su… | Which choice most effectively uses data from the table to su… | Which choice most effectively uses data from the table to il… | Which choice most effectively uses data from the table to il… | Which choice most effectively uses data from the table to su…

## 실패 단계별

| 단계 | 건수 | 해소 |
|---|---|---|
| review | 5 | 3 |
| contract | 1 | 0 |

## 반복되는 실패 사유(상위)

| 사유(숫자·인용 일반화) | 건수 |
|---|---|
| 어려움 문제인데 오답 D)이 지문·자료와 무관합니다 | 1 |
| 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 어려움 문제인데 오답 A)이 지문·자료와 무관합 | 1 |
| quant-evidence: distractor_error_types에 알 수 없는 태그 “…”가 있습니다(허용: WRONG_ROW, WRONG_COLUMN, O | 1 |
| 독립 검사 지적: 선택지 B의 수치가 지문 자료(N→N분)와 불일치함(선택지에는 N→N분으로 기재), 오타 또는 설계 오류로 보임 | 1 |
| 어려움 문제인데 오답 D)이 너무 명백합니다 / 독립 검사 지적: 정답으로 보이는 B가 '거리가 멀수록 회복이 나쁘다'는 패턴(B<C 비교)을 보여주는 것처럼 읽 | 1 |
| 독립 검사 지적: A와 D 선택지에 제시된 수치(N%, N%)가 제공된 표 자료(Reef A N년 후=N%)와 일치하지 않아, 표 자체의 논리적 일관성에 오류가  | 1 |

## 전체 실패 목록

- command_of_evidence_quant · [review] 해소 — 어려움 문제인데 오답 D)이 지문·자료와 무관합니다
- command_of_evidence_quant · [review] 미해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 어려움 문제인데 오답 A)이 지문·자료와 무관합니다
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: distractor_error_types에 알 수 없는 태그 "MAX_ONLY_SINGLE_ROW"가 있습니다(허용: WRONG_ROW, WRONG_COLUMN, OFF_BY_ONE_INDEX, ADJACENT_CELL).
- command_of_evidence_quant · [review] 미해소 — 독립 검사 지적: 선택지 B의 수치가 지문 자료(29→27분)와 불일치함(선택지에는 28→26분으로 기재), 오타 또는 설계 오류로 보임
- command_of_evidence_quant · [review] 해소 — 어려움 문제인데 오답 D)이 너무 명백합니다 / 독립 검사 지적: 정답으로 보이는 B가 '거리가 멀수록 회복이 나쁘다'는 패턴(B<C 비교)을 보여주는 것처럼 읽힐 수 있어, 오히려 '거리가 회복을 결정한다'는 인상을 줄 수 있음. 그러나 전체 표를 보면 Reef A(가장 가까움)도 2
- command_of_evidence_quant · [review] 해소 — 독립 검사 지적: A와 D 선택지에 제시된 수치(31%, 20%)가 제공된 표 자료(Reef A 3년 후=15%)와 일치하지 않아, 표 자체의 논리적 일관성에 오류가 있음 — 생성기 설계상 'Reef A/D 비교'가 오답으로 의도되었으나 실제 선택지의 수치가 표 자료와 불일치하여 순수한
