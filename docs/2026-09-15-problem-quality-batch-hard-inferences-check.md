# 유형별 표본 생성·품질 계약 검증 — 난이도 hard, 유형당 10문항 (2026-09-16 01:09)

파이프라인: 생성 → 자료 → 유형별 품질 계약 → 독립 검사 → (오답만 걸리면) 자리별 구조화 계획·생성·결정적 검사(자리당 최대 2회) → 통과 시 채택, 지문·질문·정답·계약·독립검사 통과 + 잔여 오답 실패 1~2건이면 보강 대기, 그 외 폐기. 대기 상한은 요청 수. 총 소요 8분.

**요청 10개(유형당 10) → 후보 22개 평가**

| 지표 | 값 |
|---|---|
| 첫 생성 통과율(보정 0회) | 2/22 = 9% |
| 자동 보정 뒤 최종 통과율 | 7/10 = 70% |
| 보강 대기 전환율 | 10/10 = 100% (목표 ≤10%) |
| 대기 한도 초과 폐기 | 4 |
| 오답 자리별 보정 시도(해소) | 17(17) |
| 필드 부분 수정 시도(해소) | 11(10) |
| 문항 전체 재생성(해소) | 4(2) |
| 빈 응답 이벤트 | 1 |
| 문항당 평균 모델 호출 | 5.94 |

## 유형별

| 세부 기술 | 체계·형식 | 요청 | 후보 | 첫통과 | 최종통과 | 통과율 | 대기(초과폐기) | 빈응답 | 부족반환 | 미해소 실패 사유 | 초 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Inferences (`inferences`) | sat_rw · mc | 10 | 22 | 2 | 7 | 70% | 10(4) | 1 | 1 | [contract] 빈칸(______)은 정확히 하나여야 합니다(지금 0개). / 지문은 'City A recycling ton<br>[contract] 지문에 닫히지 않은 수식 기호 $ 가 있습니다.<br>[contract] 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가  | 476 |

## 70% 미달 유형

없음 — 전 유형 70% 이상.

## 빈 응답 이벤트(원인·재시도 결과)

| 유형 | 원인 | 재시도 | 해소 |
|---|---|---|---|
| inferences | 생성 청크(2개 요청) 예외: AI 응답에 문제가 없습니다. | 아니오 | 아니오 |

## 요청보다 적게 반환된 경우(유형·사유)

| 요청 | 반환 | 사유 |
|---|---|---|
| 10 | 7 | inferences: 게이트 통과분이 요청 수 미달 |

## 실행 조건 표본(주제·문항 첫머리 — 같은 프롬프트 반복 여부 확인용)

- inferences: Which choice most logically completes the text?… | Which choice most logically completes the text?… | Which choice most logically completes the text?… | Which choice most logically completes the text?… | Which choice most logically completes the text?… | Which choice most logically completes the text?… | Which choice most logically completes the text?…

## 실패 단계별

| 단계 | 건수 | 해소 |
|---|---|---|
| contract | 3 | 0 |
| review | 2 | 2 |

## 반복되는 실패 사유(상위)

| 사유(숫자·인용 일반화) | 건수 |
|---|---|
| 빈칸(______)은 정확히 하나여야 합니다(지금 N개). / 지문은 'City A recycling tonnage change' 을 N/N 로 말하지만 자료의  | 1 |
| 지문에 닫히지 않은 수식 기호 $ 가 있습니다. | 1 |
| 객관식은 선택지 N개(A~D)여야 합니다(지금 N개). / Reading & Writing 문항은 선택지가 정확히 N개입니다(지금 N개). | 1 |
| 어려움 문제인데 오답 A), C), D)이 너무 명백합니다 / 독립 검사 지적: 선택지에 E)가 언급되어 있으나 실제 제시된 선택지는 A~D N개뿐이며 E는 존재 | 1 |
| 어려움 문제인데 오답 C)이 지문·자료와 무관합니다 / 독립 검사 지적: 오답 설계 의도(A: causal, B: scope, D: partial_computat | 1 |

## 전체 실패 목록

- inferences · [contract] 미해소 — 빈칸(______)은 정확히 하나여야 합니다(지금 0개). / 지문은 'City A recycling tonnage change' 을 9/2 로 말하지만 자료의 값은 -9 입니다.
- inferences · [contract] 미해소 — 지문에 닫히지 않은 수식 기호 $ 가 있습니다.
- inferences · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- inferences · [review] 해소 — 어려움 문제인데 오답 A), C), D)이 너무 명백합니다 / 독립 검사 지적: 선택지에 E)가 언급되어 있으나 실제 제시된 선택지는 A~D 4개뿐이며 E는 존재하지 않음 — 생성기 설계와 실제 문항이 불일치함
- inferences · [review] 해소 — 어려움 문제인데 오답 C)이 지문·자료와 무관합니다 / 독립 검사 지적: 오답 설계 의도(A: causal, B: scope, D: partial_computation)와 실제 선택지 내용이 다소 불일치함 - A는 사실 자체가 지문과 모순(비율이 동일하다고 명시)되어 causal 오류라
