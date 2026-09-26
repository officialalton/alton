# 유형별 표본 생성·품질 계약 검증 — 난이도 medium, 유형당 3문항 (2026-09-18 01:00)

파이프라인: 생성 → 자료 → 유형별 품질 계약 → 독립 검사 → (오답만 걸리면) 자리별 구조화 계획·생성·결정적 검사(자리당 최대 2회) → 통과 시 채택, 지문·질문·정답·계약·독립검사 통과 + 잔여 오답 실패 1~2건이면 보강 대기, 그 외 폐기. 대기 상한은 요청 수. 총 소요 4분.

**요청 9개(유형당 3) → 후보 9개 평가**

| 지표 | 값 |
|---|---|
| 첫 생성 통과율(보정 0회) | 7/9 = 78% |
| 자동 보정 뒤 최종 통과율 | 9/9 = 100% |
| 보강 대기 전환율 | 0/9 = 0% (목표 ≤10%) |
| 대기 한도 초과 폐기 | 0 |
| 오답 자리별 보정 시도(해소) | 0(0) |
| 필드 부분 수정 시도(해소) | 2(2) |
| 문항 전체 재생성(해소) | 0(0) |
| 빈 응답 이벤트 | 1 |
| 문항당 평균 모델 호출 | 2.67 |

## 유형별

| 세부 기술 | 체계·형식 | 요청 | 후보 | 첫통과 | 최종통과 | 통과율 | 대기(초과폐기) | 빈응답 | 부족반환 | 미해소 실패 사유 | 초 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Transitions (`transitions`) | sat_rw · mc | 3 | 3 | 3 | 3 | 100% | 0(0) | 1 | 0 | — | 97 |
| Boundaries (`boundaries`) | sat_rw · mc | 3 | 3 | 3 | 3 | 100% | 0(0) | 0 | 0 | — | 55 |
| Form, Structure, and Sense (`form_structure_sense`) | sat_rw · mc | 3 | 3 | 1 | 3 | 100% | 0(0) | 0 | 0 | — | 65 |

## 70% 미달 유형

없음 — 전 유형 70% 이상.

## 빈 응답 이벤트(원인·재시도 결과)

| 유형 | 원인 | 재시도 | 해소 |
|---|---|---|---|
| transitions | 생성 청크(3개 요청) 예외: AI 응답에 문제가 없습니다. | 아니오 | 아니오 |

## 요청보다 적게 반환된 경우(유형·사유)

없음.

## 실행 조건 표본(주제·문항 첫머리 — 같은 프롬프트 반복 여부 확인용)

- transitions: Which choice completes the text with the most logical transi… | Which choice completes the text with the most logical transi… | Which choice completes the text with the most logical transi…
- boundaries: Which choice completes the text so that it conforms to the c… | Which choice completes the text so that it conforms to the c… | Which choice completes the text so that it conforms to the c…
- form_structure_sense: Which choice completes the text so that it conforms to the c… | Which choice completes the text so that it conforms to the c… | Which choice completes the text so that it conforms to the c…

## 실패 단계별

| 단계 | 건수 | 해소 |
|---|---|---|

## 반복되는 실패 사유(상위)

| 사유(숫자·인용 일반화) | 건수 |
|---|---|

## 전체 실패 목록

