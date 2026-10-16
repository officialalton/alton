# 유형별 표본 생성·품질 계약 검증 — 난이도 medium, 유형당 5문항 (2026-09-18 02:40)

파이프라인: 생성 → 자료 → 유형별 품질 계약 → 독립 검사 → (오답만 걸리면) 자리별 구조화 계획·생성·결정적 검사(자리당 최대 2회) → 통과 시 채택, 지문·질문·정답·계약·독립검사 통과 + 잔여 오답 실패 1~2건이면 보강 대기, 그 외 폐기. 대기 상한은 요청 수. 총 소요 9분.

**요청 20개(유형당 5) → 후보 19개 평가**

| 지표 | 값 |
|---|---|
| 첫 생성 통과율(보정 0회) | 12/19 = 63% |
| 자동 보정 뒤 최종 통과율 | 19/20 = 95% |
| 보강 대기 전환율 | 0/20 = 0% (목표 ≤10%) |
| 대기 한도 초과 폐기 | 0 |
| 오답 자리별 보정 시도(해소) | 2(2) |
| 필드 부분 수정 시도(해소) | 5(4) |
| 문항 전체 재생성(해소) | 8(4) |
| 빈 응답 이벤트 | 3 |
| 문항당 평균 모델 호출 | 3.94 |

## 유형별

| 세부 기술 | 체계·형식 | 요청 | 후보 | 첫통과 | 최종통과 | 통과율 | 대기(초과폐기) | 빈응답 | 부족반환 | 미해소 실패 사유 | 초 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Command of Evidence (Quantitative) (`command_of_evidence_quant`) | sat_rw · mc | 5 | 4 | 1 | 4 | 80% | 0(0) | 2 | 1 | [contract] quant-evidence: distractor_error_types에 알 수 없는 태그 "EXACT_LOO<br>[contract] 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 <br>[contract] quant-evidence: 오답 선택지 "In Kent, the daily wage rose from 1. | 242 |
| Transitions (`transitions`) | sat_rw · mc | 5 | 5 | 2 | 5 | 100% | 0(0) | 0 | 0 | [contract] transition-relationship: 오답 선택지 "Nevertheless,"는 실제로 CONCESS<br>[contract] transition-relationship: 오답 선택지 "Similarly,"는 실제로 ADDITION 관 | 110 |
| Boundaries (`boundaries`) | sat_rw · mc | 5 | 5 | 5 | 5 | 100% | 0(0) | 0 | 0 | — | 65 |
| Form, Structure, and Sense (`form_structure_sense`) | sat_rw · mc | 5 | 5 | 4 | 5 | 100% | 0(0) | 1 | 0 | — | 114 |

## 70% 미달 유형

없음 — 전 유형 70% 이상.

## 빈 응답 이벤트(원인·재시도 결과)

| 유형 | 원인 | 재시도 | 해소 |
|---|---|---|---|
| command_of_evidence_quant | 생성 청크(5개 요청) 예외: AI 응답에 문제가 없습니다. | 아니오 | 아니오 |
| command_of_evidence_quant | 생성 청크(5개 요청) 예외: AI 응답에 문제가 없습니다. | 아니오 | 아니오 |
| form_structure_sense | 생성 청크(5개 요청) 예외: AI 응답에 문제가 없습니다. | 아니오 | 아니오 |

## 요청보다 적게 반환된 경우(유형·사유)

| 요청 | 반환 | 사유 |
|---|---|---|
| 5 | 4 | command_of_evidence_quant: 게이트 통과분이 요청 수 미달 |

## 실행 조건 표본(주제·문항 첫머리 — 같은 프롬프트 반복 여부 확인용)

- command_of_evidence_quant: Which choice most effectively uses data from the table to co… | Which choice most effectively uses data from the table to co… | Which choice most effectively uses data from the scatterplot… | The researcher observed that while most cities fell short of…
- transitions: Which choice completes the text with the most logical transi… | Which choice completes the text with the most logical transi… | Which choice completes the text with the most logical transi… | Which choice completes the text with the most logical transi… | Which choice completes the text with the most logical transi…
- boundaries: Which choice completes the text so that it conforms to the c… | Which choice completes the text so that it conforms to the c… | Which choice completes the text so that it conforms to the c… | Which choice completes the text so that it conforms to the c… | Which choice completes the text so that it conforms to the c…
- form_structure_sense: Which choice completes the text so that it conforms to the c… | Which choice completes the text so that it conforms to the c… | Which choice completes the text so that it conforms to the c… | Which choice completes the text so that it conforms to the c… | Which choice completes the text so that it conforms to the c…

## 실패 단계별

| 단계 | 건수 | 해소 |
|---|---|---|
| contract | 12 | 4 |

## 반복되는 실패 사유(상위)

| 사유(숫자·인용 일반화) | 건수 |
|---|---|
| quant-evidence: 오답 선택지 “…”의 수치가 정답과 같습니다 — 변별력이 없습니다. | 3 |
| transition-relationship: 오답 선택지 “…”는 실제로 CONCESSION 관계 전환어인데 distractor_relationship_types | 2 |
| transition-relationship: 오답 선택지 “…”는 실제로 ADDITION 관계 전환어인데 distractor_relationship_types는  | 2 |
| quant-evidence: distractor_error_types에 알 수 없는 태그 “…”가 있습니다(허용: WRONG_ROW, WRONG_COLUMN, O | 1 |
| 객관식은 선택지 N개(A~D)여야 합니다(지금 N개). / Reading & Writing 문항은 선택지가 정확히 N개입니다(지금 N개). | 1 |
| 질문 문장을 인식하지 못했습니다 — 지문 마지막 단락이 SAT 문항처럼 물음표로 끝나야 합니다(예: “…”). / 정답 선택지의 수치(N, N, N.N, N, N | 1 |
| 질문 문장을 인식하지 못했습니다 — 지문 마지막 단락이 SAT 문항처럼 물음표로 끝나야 합니다(예: “…”). | 1 |
| transition-relationship: 오답 선택지 “…”는 실제로 EXAMPLE 관계 전환어인데 distractor_relationship_types는 C | 1 |

## 전체 실패 목록

- command_of_evidence_quant · [contract] 미해소 — quant-evidence: distractor_error_types에 알 수 없는 태그 "EXACT_LOOKUP"가 있습니다(허용: WRONG_ROW, WRONG_COLUMN, OFF_BY_ONE_INDEX, ADJACENT_CELL).
- command_of_evidence_quant · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "In Kent, the daily wage rose from 1.8 shillings in the 1820s"의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "In Kent, the daily wage rose from 1.8 shillings in the 1820s"의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "the average dispersal distance at a wind speed of 1 m/s (4.2"의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 미해소 — 질문 문장을 인식하지 못했습니다 — 지문 마지막 단락이 SAT 문항처럼 물음표로 끝나야 합니다(예: "Which choice …?"). / 정답 선택지의 수치(5, 7, 0.8, 3, 5, 3.3)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.
- command_of_evidence_quant · [contract] 해소 — 질문 문장을 인식하지 못했습니다 — 지문 마지막 단락이 SAT 문항처럼 물음표로 끝나야 합니다(예: "Which choice …?").
- transitions · [contract] 미해소 — transition-relationship: 오답 선택지 "Nevertheless,"는 실제로 CONCESSION 관계 전환어인데 distractor_relationship_types는 CONTRAST로 태그했습니다 — 태그가 실제 단어와 어긋납니다.
- transitions · [contract] 미해소 — transition-relationship: 오답 선택지 "Similarly,"는 실제로 ADDITION 관계 전환어인데 distractor_relationship_types는 CONTRAST로 태그했습니다 — 태그가 실제 단어와 어긋납니다.
- transitions · [contract] 해소 — transition-relationship: 오답 선택지 "Nevertheless,"는 실제로 CONCESSION 관계 전환어인데 distractor_relationship_types는 CONTRAST로 태그했습니다 — 태그가 실제 단어와 어긋납니다.
- transitions · [contract] 해소 — transition-relationship: 오답 선택지 "Similarly,"는 실제로 ADDITION 관계 전환어인데 distractor_relationship_types는 CONTRAST로 태그했습니다 — 태그가 실제 단어와 어긋납니다.
- transitions · [contract] 해소 — transition-relationship: 오답 선택지 "For example,"는 실제로 EXAMPLE 관계 전환어인데 distractor_relationship_types는 CAUSE_EFFECT로 태그했습니다 — 태그가 실제 단어와 어긋납니다.
