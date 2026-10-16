# 유형별 표본 생성·품질 계약 검증 — 난이도 hard, 유형당 10문항 (2026-09-18 04:57)

파이프라인: 생성 → 자료 → 유형별 품질 계약 → 독립 검사 → (오답만 걸리면) 자리별 구조화 계획·생성·결정적 검사(자리당 최대 2회) → 통과 시 채택, 지문·질문·정답·계약·독립검사 통과 + 잔여 오답 실패 1~2건이면 보강 대기, 그 외 폐기. 대기 상한은 요청 수. 총 소요 6분.

**요청 10개(유형당 10) → 후보 8개 평가**

| 지표 | 값 |
|---|---|
| 첫 생성 통과율(보정 0회) | 2/8 = 25% |
| 자동 보정 뒤 최종 통과율 | 8/10 = 80% |
| 보강 대기 전환율 | 0/10 = 0% (목표 ≤10%) |
| 대기 한도 초과 폐기 | 0 |
| 오답 자리별 보정 시도(해소) | 7(7) |
| 필드 부분 수정 시도(해소) | 11(6) |
| 문항 전체 재생성(해소) | 13(3) |
| 빈 응답 이벤트 | 1 |
| 문항당 평균 모델 호출 | 10.5 |

## 유형별

| 세부 기술 | 체계·형식 | 요청 | 후보 | 첫통과 | 최종통과 | 통과율 | 대기(초과폐기) | 빈응답 | 부족반환 | 미해소 실패 사유 | 초 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Command of Evidence (Quantitative) (`command_of_evidence_quant`) | sat_rw · mc | 10 | 8 | 2 | 8 | 80% | 0(0) | 1 | 1 | [contract] 질문 문장을 인식하지 못했습니다 — 지문 마지막 단락이 SAT 문항처럼 물음표로 끝나야 합니다(예: "Whi<br>[contract] 질문 문장을 인식하지 못했습니다 — 지문 마지막 단락이 SAT 문항처럼 물음표로 끝나야 합니다(예: "Whi<br>[contract] quant-evidence: 오답 선택지 "a total of 500 commuters were survey | 381 |

## 70% 미달 유형

없음 — 전 유형 70% 이상.

## 빈 응답 이벤트(원인·재시도 결과)

| 유형 | 원인 | 재시도 | 해소 |
|---|---|---|---|
| command_of_evidence_quant | 생성 청크(3개 요청) 예외: AI 응답에 문제가 없습니다. | 아니오 | 아니오 |

## 요청보다 적게 반환된 경우(유형·사유)

| 요청 | 반환 | 사유 |
|---|---|---|
| 10 | 8 | command_of_evidence_quant: 게이트 통과분이 요청 수 미달 |

## 실행 조건 표본(주제·문항 첫머리 — 같은 프롬프트 반복 여부 확인용)

- command_of_evidence_quant: Which choice most effectively uses data from the table to co… | Which choice most effectively uses data from the table to su… | Which choice most effectively uses data from the table to su… | Which choice most effectively uses data from the table to co… | Which choice most effectively uses data from the table to co… | Which choice most effectively uses data from the table to su… | Which choice most effectively uses data from the table to il… | Which choice most effectively uses data from the table to su…

## 실패 단계별

| 단계 | 건수 | 해소 |
|---|---|---|
| contract | 14 | 0 |
| review | 4 | 3 |

## 반복되는 실패 사유(상위)

| 사유(숫자·인용 일반화) | 건수 |
|---|---|
| 질문 문장을 인식하지 못했습니다 — 지문 마지막 단락이 SAT 문항처럼 물음표로 끝나야 합니다(예: “…”). | 5 |
| 지문의 'percentage of each group' 에 해당하는 항목이 데이터에 없습니다. | 2 |
| quant-evidence: 오답 선택지 “…”의 수치(N)가 자료 어디에도 없습니다 — 오답은 실제 자료를 잘못 읽은 값(다른 행/열·인접 셀 등)이어야지 임의 | 1 |
| quant-evidence: 오답 선택지 “…”의 수치(N, N)가 자료 어디에도 없습니다 — 오답은 실제 자료를 잘못 읽은 값(다른 행/열·인접 셀 등)이어야지 | 1 |
| quant-evidence: 오답 선택지 “…”의 수치(N, N, N)가 자료 어디에도 없습니다 — 오답은 실제 자료를 잘못 읽은 값(다른 행/열·인접 셀 등)이 | 1 |
| quant-evidence: 정답 선택지에 수치가 없습니다 — 정량 근거 문항의 정답은 자료의 값을 인용해야 합니다. | 1 |
| 어려움 문제인데 오답 D)이 지문·자료와 무관합니다 / 어려움으로 요청했지만 독립 검사 추정 난이도가 easy 입니다 — 핵심 관계를 종합해야 풀리는 문항으로 | 1 |
| 자료 필수 문항입니다 — Command of Evidence (Quantitative) 문항이 자료(table)를 읽어야 풀 수 있으므로 표·그래프 자료가 필요합 | 1 |
| 정답 선택지의 수치(N.N, N.N)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다. | 1 |
| 객관식은 선택지 N개(A~D)여야 합니다(지금 N개). / Reading & Writing 문항은 선택지가 정확히 N개입니다(지금 N개). | 1 |
| 어려움 문제인데 오답 D)이 너무 명백합니다 | 1 |
| 어려움 문제인데 오답 A)이 지문·자료와 무관합니다 | 1 |
| 어려움 문제인데 오답 D)이 지문·자료와 무관합니다 / 독립 검사 지적: A의 수치(N,N,N)가 실제 자료(N,N,N)와 일치하지 않아 자료-선택지 불일치가 존 | 1 |

## 전체 실패 목록

- command_of_evidence_quant · [contract] 미해소 — 질문 문장을 인식하지 못했습니다 — 지문 마지막 단락이 SAT 문항처럼 물음표로 끝나야 합니다(예: "Which choice …?").
- command_of_evidence_quant · [contract] 미해소 — 질문 문장을 인식하지 못했습니다 — 지문 마지막 단락이 SAT 문항처럼 물음표로 끝나야 합니다(예: "Which choice …?").
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "a total of 500 commuters were surveyed both before and after"의 수치(500)가 자료 어디에도 없습니다 — 오답은 실제 자료를 잘못 읽은 값(다른 행/열·인접 셀 등)이어야지 임의의 숫자면 안 됩
- command_of_evidence_quant · [contract] 미해소 — 질문 문장을 인식하지 못했습니다 — 지문 마지막 단락이 SAT 문항처럼 물음표로 끝나야 합니다(예: "Which choice …?").
- command_of_evidence_quant · [contract] 미해소 — 질문 문장을 인식하지 못했습니다 — 지문 마지막 단락이 SAT 문항처럼 물음표로 끝나야 합니다(예: "Which choice …?").
- command_of_evidence_quant · [contract] 미해소 — 질문 문장을 인식하지 못했습니다 — 지문 마지막 단락이 SAT 문항처럼 물음표로 끝나야 합니다(예: "Which choice …?").
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "the Carpaccio Workshop used ultramarine in 90 percent of its"의 수치(90, 40)가 자료 어디에도 없습니다 — 오답은 실제 자료를 잘못 읽은 값(다른 행/열·인접 셀 등)이어야지 임의의 숫자면 
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "the Vivarini Workshop and the Tura Workshop used ultramarine"의 수치(40, 35, 90)가 자료 어디에도 없습니다 — 오답은 실제 자료를 잘못 읽은 값(다른 행/열·인접 셀 등)이어야지 임의의 
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 정답 선택지에 수치가 없습니다 — 정량 근거 문항의 정답은 자료의 값을 인용해야 합니다.
- command_of_evidence_quant · [review] 미해소 — 어려움 문제인데 오답 D)이 지문·자료와 무관합니다 / 어려움으로 요청했지만 독립 검사 추정 난이도가 easy 입니다 — 핵심 관계를 종합해야 풀리는 문항으로
- command_of_evidence_quant · [contract] 미해소 — 자료 필수 문항입니다 — Command of Evidence (Quantitative) 문항이 자료(table)를 읽어야 풀 수 있으므로 표·그래프 자료가 필요합니다. '표·그래프' 자료를 만들거나 그림을 올린 뒤 저장하세요. / 질문 문장을 인식하지 못했습니다 — 지문 마지막 단락이 
- command_of_evidence_quant · [contract] 미해소 — 정답 선택지의 수치(1.5, 1.8)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.
- command_of_evidence_quant · [contract] 미해소 — 지문의 'percentage of each group' 에 해당하는 항목이 데이터에 없습니다.
- command_of_evidence_quant · [contract] 미해소 — 지문의 'percentage of each group' 에 해당하는 항목이 데이터에 없습니다.
- command_of_evidence_quant · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- command_of_evidence_quant · [review] 해소 — 어려움 문제인데 오답 D)이 너무 명백합니다
- command_of_evidence_quant · [review] 해소 — 어려움 문제인데 오답 A)이 지문·자료와 무관합니다
- command_of_evidence_quant · [review] 해소 — 어려움 문제인데 오답 D)이 지문·자료와 무관합니다 / 독립 검사 지적: A의 수치(52,61,18)가 실제 자료(45,28,12)와 일치하지 않아 자료-선택지 불일치가 존재함; 오답 설계상 의도적 왜곡일 수 있으나 이는 채점자가 자료를 정확히 대조해야 발견 가능한 문제
