# 유형별 표본 생성·품질 계약 검증 — 난이도 hard, 유형당 10문항 (2026-09-18 05:28)

파이프라인: 생성 → 자료 → 유형별 품질 계약 → 독립 검사 → (오답만 걸리면) 자리별 구조화 계획·생성·결정적 검사(자리당 최대 2회) → 통과 시 채택, 지문·질문·정답·계약·독립검사 통과 + 잔여 오답 실패 1~2건이면 보강 대기, 그 외 폐기. 대기 상한은 요청 수. 총 소요 4분.

**요청 10개(유형당 10) → 후보 10개 평가**

| 지표 | 값 |
|---|---|
| 첫 생성 통과율(보정 0회) | 0/10 = 0% |
| 자동 보정 뒤 최종 통과율 | 10/10 = 100% |
| 보강 대기 전환율 | 0/10 = 0% (목표 ≤10%) |
| 대기 한도 초과 폐기 | 0 |
| 오답 자리별 보정 시도(해소) | 5(5) |
| 필드 부분 수정 시도(해소) | 9(9) |
| 문항 전체 재생성(해소) | 3(3) |
| 빈 응답 이벤트 | 0 |
| 문항당 평균 모델 호출 | 5.5 |

## 유형별

| 세부 기술 | 체계·형식 | 요청 | 후보 | 첫통과 | 최종통과 | 통과율 | 대기(초과폐기) | 빈응답 | 부족반환 | 미해소 실패 사유 | 초 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Command of Evidence (Quantitative) (`command_of_evidence_quant`) | sat_rw · mc | 10 | 10 | 0 | 10 | 100% | 0(0) | 0 | 0 | — | 211 |

## 70% 미달 유형

없음 — 전 유형 70% 이상.

## 빈 응답 이벤트(원인·재시도 결과)

없음.

## 요청보다 적게 반환된 경우(유형·사유)

없음.

## 실행 조건 표본(주제·문항 첫머리 — 같은 프롬프트 반복 여부 확인용)

- command_of_evidence_quant: Which choice most effectively uses data from the table to il… | Which choice most effectively uses data from the table to su… | Which choice most effectively uses data from the table to su… | Which choice most effectively uses data from the table to il… | Which choice most effectively uses data from the table to su… | Which choice most effectively uses data from the graph to su… | Which choice most effectively uses data from the table to su… | Which choice most effectively uses data from the table to su… | Which choice most effectively uses data from the table to il… | Which choice most effectively uses data from the table to il…

## 실패 단계별

| 단계 | 건수 | 해소 |
|---|---|---|
| contract | 2 | 2 |
| review | 1 | 1 |

## 반복되는 실패 사유(상위)

| 사유(숫자·인용 일반화) | 건수 |
|---|---|
| quant-evidence: distractor_error_types 개수(N)가 오답 개수(N)와 다릅니다. | 1 |
| quant-evidence: operation이 비어 있습니다. | 1 |
| 독립 검사 지적: A의 수치(둘 다 N주)는 표의 실제 값(Tavua N주, Nuku N주)과 명백히 불일치하므로, 표를 직접 대조하면 이 오답은 사실관계 오류로 | 1 |

## 전체 실패 목록

- command_of_evidence_quant · [contract] 해소 — quant-evidence: distractor_error_types 개수(0)가 오답 개수(3)와 다릅니다.
- command_of_evidence_quant · [contract] 해소 — quant-evidence: operation이 비어 있습니다.
- command_of_evidence_quant · [review] 해소 — 독립 검사 지적: A의 수치(둘 다 6주)는 표의 실제 값(Tavua 3주, Nuku 9주)과 명백히 불일치하므로, 표를 직접 대조하면 이 오답은 사실관계 오류로 쉽게 제거될 수 있어 설계 의도(causal 오류)보다 더 명백한 오류가 됨
