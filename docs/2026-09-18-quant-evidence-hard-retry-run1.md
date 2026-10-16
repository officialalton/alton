# 유형별 표본 생성·품질 계약 검증 — 난이도 hard, 유형당 10문항 (2026-09-18 05:51)

파이프라인: 생성 → 자료 → 유형별 품질 계약 → 독립 검사 → (오답만 걸리면) 자리별 구조화 계획·생성·결정적 검사(자리당 최대 2회) → 통과 시 채택, 지문·질문·정답·계약·독립검사 통과 + 잔여 오답 실패 1~2건이면 보강 대기, 그 외 폐기. 대기 상한은 요청 수. 총 소요 4분.

**요청 10개(유형당 10) → 후보 7개 평가**

| 지표 | 값 |
|---|---|
| 첫 생성 통과율(보정 0회) | 3/7 = 43% |
| 자동 보정 뒤 최종 통과율 | 7/10 = 70% |
| 보강 대기 전환율 | 0/10 = 0% (목표 ≤10%) |
| 대기 한도 초과 폐기 | 0 |
| 오답 자리별 보정 시도(해소) | 6(6) |
| 필드 부분 수정 시도(해소) | 4(3) |
| 문항 전체 재생성(해소) | 9(3) |
| 빈 응답 이벤트 | 0 |
| 문항당 평균 모델 호출 | 10 |

## 유형별

| 세부 기술 | 체계·형식 | 요청 | 후보 | 첫통과 | 최종통과 | 통과율 | 대기(초과폐기) | 빈응답 | 부족반환 | 미해소 실패 사유 | 초 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Command of Evidence (Quantitative) (`command_of_evidence_quant`) | sat_rw · mc | 10 | 7 | 3 | 7 | 70% | 0(0) | 0 | 1 | [review] 어려움 문제인데 오답 A)이 너무 명백합니다<br>[contract] 지문에 닫히지 않은 수식 기호 $ 가 있습니다. / 선택지 2에 닫히지 않은 수식 기호 $ 가 있습니다.<br>[contract] quant-evidence: 오답 선택지 "Paintings from the 1870s sold for an | 241 |

## 70% 미달 유형

없음 — 전 유형 70% 이상.

## 빈 응답 이벤트(원인·재시도 결과)

없음.

## 요청보다 적게 반환된 경우(유형·사유)

| 요청 | 반환 | 사유 |
|---|---|---|
| 10 | 7 | command_of_evidence_quant: 게이트 통과분이 요청 수 미달 |

## 실행 조건 표본(주제·문항 첫머리 — 같은 프롬프트 반복 여부 확인용)

- command_of_evidence_quant: Which choice most effectively uses data from the table to il… | Which choice most effectively uses data from the table to su… | Which choice most effectively uses data from the table to su… | Which choice most effectively uses data from the table to il… | Which choice most effectively uses data from the table to su… | Which choice most effectively uses data from the table to sh… | Which choice most effectively uses data from the table to su…

## 실패 단계별

| 단계 | 건수 | 해소 |
|---|---|---|
| review | 5 | 2 |
| contract | 7 | 1 |

## 반복되는 실패 사유(상위)

| 사유(숫자·인용 일반화) | 건수 |
|---|---|
| 어려움 문제인데 오답 A)이 너무 명백합니다 | 2 |
| quant-evidence: 오답 선택지 “…”의 수치가 정답과 완전히 같습니다 — 변별력이 없습니다. | 2 |
| 어려움 문제인데 오답 D)이 너무 명백합니다 | 2 |
| 지문은 'N hours' 의 'Average Leaf Count' 를 N/N/N/N 로 말하지만 표의 값은 N 입니다. | 2 |
| 지문에 닫히지 않은 수식 기호 $ 가 있습니다. / 선택지 N에 닫히지 않은 수식 기호 $ 가 있습니다. | 1 |
| 자료 필수 문항입니다 — Command of Evidence (Quantitative) 문항이 자료(Table)를 읽어야 풀 수 있으므로 표·그래프 자료가 필요합 | 1 |
| 독립 검사 지적: 선택지 D에서 Site D의 생존율이 표의 실제 값(N%)과 다르게 N%로 제시되어 자료와 불일치함(자료-지문 불일치) | 1 |
| 지문은 'kilograms' 단위를 쓰지만 표·그래프의 열 이름이나 축 제목에 단위가 없습니다(예: 'Cost (dollars)'). | 1 |

## 전체 실패 목록

- command_of_evidence_quant · [review] 미해소 — 어려움 문제인데 오답 A)이 너무 명백합니다
- command_of_evidence_quant · [contract] 미해소 — 지문에 닫히지 않은 수식 기호 $ 가 있습니다. / 선택지 2에 닫히지 않은 수식 기호 $ 가 있습니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "Paintings from the 1870s sold for an average of $61,000, the"의 수치가 정답과 완전히 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 미해소 — 자료 필수 문항입니다 — Command of Evidence (Quantitative) 문항이 자료(Table)를 읽어야 풀 수 있으므로 표·그래프 자료가 필요합니다. '표·그래프' 자료를 만들거나 그림을 올린 뒤 저장하세요. / Command of Evidence (Quantitati
- command_of_evidence_quant · [review] 미해소 — 어려움 문제인데 오답 D)이 너무 명백합니다
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "Average commute time fell from 34 minutes in Year 2 to 26 mi"의 수치가 정답과 완전히 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [review] 해소 — 어려움 문제인데 오답 D)이 너무 명백합니다
- command_of_evidence_quant · [review] 해소 — 독립 검사 지적: 선택지 D에서 Site D의 생존율이 표의 실제 값(33%)과 다르게 35%로 제시되어 자료와 불일치함(자료-지문 불일치)
- command_of_evidence_quant · [contract] 해소 — 지문은 'kilograms' 단위를 쓰지만 표·그래프의 열 이름이나 축 제목에 단위가 없습니다(예: 'Cost (dollars)').
- command_of_evidence_quant · [contract] 미해소 — 지문은 '16 hours' 의 'Average Leaf Count' 를 0/4/8/12 로 말하지만 표의 값은 30 입니다.
- command_of_evidence_quant · [contract] 미해소 — 지문은 '16 hours' 의 'Average Leaf Count' 를 0/4/8/12 로 말하지만 표의 값은 30 입니다.
- command_of_evidence_quant · [review] 미해소 — 어려움 문제인데 오답 A)이 너무 명백합니다
