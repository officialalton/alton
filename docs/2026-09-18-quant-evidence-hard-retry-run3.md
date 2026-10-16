# 유형별 표본 생성·품질 계약 검증 — 난이도 hard, 유형당 10문항 (2026-09-18 06:03)

파이프라인: 생성 → 자료 → 유형별 품질 계약 → 독립 검사 → (오답만 걸리면) 자리별 구조화 계획·생성·결정적 검사(자리당 최대 2회) → 통과 시 채택, 지문·질문·정답·계약·독립검사 통과 + 잔여 오답 실패 1~2건이면 보강 대기, 그 외 폐기. 대기 상한은 요청 수. 총 소요 7분.

**요청 10개(유형당 10) → 후보 7개 평가**

| 지표 | 값 |
|---|---|
| 첫 생성 통과율(보정 0회) | 1/7 = 14% |
| 자동 보정 뒤 최종 통과율 | 7/10 = 70% |
| 보강 대기 전환율 | 0/10 = 0% (목표 ≤10%) |
| 대기 한도 초과 폐기 | 0 |
| 오답 자리별 보정 시도(해소) | 5(5) |
| 필드 부분 수정 시도(해소) | 5(4) |
| 문항 전체 재생성(해소) | 8(2) |
| 빈 응답 이벤트 | 2 |
| 문항당 평균 모델 호출 | 9.71 |

## 유형별

| 세부 기술 | 체계·형식 | 요청 | 후보 | 첫통과 | 최종통과 | 통과율 | 대기(초과폐기) | 빈응답 | 부족반환 | 미해소 실패 사유 | 초 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Command of Evidence (Quantitative) (`command_of_evidence_quant`) | sat_rw · mc | 10 | 7 | 1 | 7 | 70% | 0(0) | 2 | 1 | [contract] 지문은 '1883'(Average price of wheat) 값을 1893 로 말하지만 그래프의 값은 1.<br>[contract] 지문은 '1883'(Average price of wheat) 값을 1893 로 말하지만 그래프의 값은 1.<br>[contract] 지문은 '1883'(Average wheat price) 값을 1893 로 말하지만 그래프의 값은 1.15  | 410 |

## 70% 미달 유형

없음 — 전 유형 70% 이상.

## 빈 응답 이벤트(원인·재시도 결과)

| 유형 | 원인 | 재시도 | 해소 |
|---|---|---|---|
| command_of_evidence_quant | 생성 청크(3개 요청) 예외: AI 응답에 문제가 없습니다. | 예 | 아니오 |
| command_of_evidence_quant | 생성 청크(3개 요청) 예외: AI 응답에 문제가 없습니다. | 예 | 아니오 |

## 요청보다 적게 반환된 경우(유형·사유)

| 요청 | 반환 | 사유 |
|---|---|---|
| 10 | 7 | command_of_evidence_quant: 게이트 통과분이 요청 수 미달 |

## 실행 조건 표본(주제·문항 첫머리 — 같은 프롬프트 반복 여부 확인용)

- command_of_evidence_quant: Which choice most effectively uses data from the table to su… | Which choice most effectively uses data from the table to su… | Which choice most effectively uses data from the table to il… | Which choice most effectively uses data from the table to su… | Which choice uses data from the graph to most effectively su… | Which choice most effectively uses data from the table to su… | Which choice most effectively uses data from the table to il…

## 실패 단계별

| 단계 | 건수 | 해소 |
|---|---|---|
| contract | 7 | 1 |
| review | 4 | 1 |

## 반복되는 실패 사유(상위)

| 사유(숫자·인용 일반화) | 건수 |
|---|---|
| 선택지 N에 닫히지 않은 수식 기호 $ 가 있습니다. / 선택지 N에 닫히지 않은 수식 기호 $ 가 있습니다. | 1 |
| 지문은 'N'(Average price of wheat) 값을 N 로 말하지만 그래프의 값은 N.N 입니다. | 1 |
| 지문은 'N'(Average price of wheat) 값을 N 로 말하지만 그래프의 값은 N.N 입니다. / 지문에 닫히지 않은 수식 기호 $ 가 있습니다. | 1 |
| 지문은 'N'(Average wheat price) 값을 N 로 말하지만 그래프의 값은 N.N 입니다. / 지문에 배치 용어(region 등)가 있습니다. | 1 |
| 독립 검사 지적: 선택지 A의 after 값이 N이 아니라 N으로 제시되어 있어, 그래프 자료(peak after=N)와 명백히 불일치함. 이는 생성기 설계(sc | 1 |
| 어려움 문제인데 오답 A), C), D)이 너무 명백합니다 / 어려움으로 요청했지만 독립 검사 추정 난이도가 easy 입니다 — 핵심 관계를 종합해야 풀리는 문항 | 1 |
| 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 어려움 문제인데 오답 D)이 너무 명백합니다 | 1 |
| quant-evidence: distractor_error_types에 알 수 없는 태그 “…”가 있습니다(허용: WRONG_ROW, WRONG_COLUMN, O | 1 |
| 어려움 문제인데 오답 D)이 너무 명백합니다 | 1 |
| 지문의 'oldest age group' 에 해당하는 항목이 데이터에 없습니다. | 1 |
| 객관식은 선택지 N개(A~D)여야 합니다(지금 N개). / Reading & Writing 문항은 선택지가 정확히 N개입니다(지금 N개). | 1 |

## 전체 실패 목록

- command_of_evidence_quant · [contract] 해소 — 선택지 1에 닫히지 않은 수식 기호 $ 가 있습니다. / 선택지 3에 닫히지 않은 수식 기호 $ 가 있습니다.
- command_of_evidence_quant · [contract] 미해소 — 지문은 '1883'(Average price of wheat) 값을 1893 로 말하지만 그래프의 값은 1.1 입니다.
- command_of_evidence_quant · [contract] 미해소 — 지문은 '1883'(Average price of wheat) 값을 1893 로 말하지만 그래프의 값은 1.1 입니다. / 지문에 닫히지 않은 수식 기호 $ 가 있습니다.
- command_of_evidence_quant · [contract] 미해소 — 지문은 '1883'(Average wheat price) 값을 1893 로 말하지만 그래프의 값은 1.15 입니다. / 지문에 배치 용어(region 등)가 있습니다.
- command_of_evidence_quant · [review] 해소 — 독립 검사 지적: 선택지 A의 after 값이 38이 아니라 30으로 제시되어 있어, 그래프 자료(peak after=38)와 명백히 불일치함. 이는 생성기 설계(scope 오류만 의도)와 다르게 A가 사실관계 오류(오독 유발)까지 포함하고 있어, A를 지우는 근거가 '비교 부재'뿐 아
- command_of_evidence_quant · [review] 미해소 — 어려움 문제인데 오답 A), C), D)이 너무 명백합니다 / 어려움으로 요청했지만 독립 검사 추정 난이도가 easy 입니다 — 핵심 관계를 종합해야 풀리는 문항으로
- command_of_evidence_quant · [review] 미해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 어려움 문제인데 오답 D)이 너무 명백합니다
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: distractor_error_types에 알 수 없는 태그 "ROW_SUM"가 있습니다(허용: WRONG_ROW, WRONG_COLUMN, OFF_BY_ONE_INDEX, ADJACENT_CELL).
- command_of_evidence_quant · [review] 미해소 — 어려움 문제인데 오답 D)이 너무 명백합니다
- command_of_evidence_quant · [contract] 미해소 — 지문의 'oldest age group' 에 해당하는 항목이 데이터에 없습니다.
- command_of_evidence_quant · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
