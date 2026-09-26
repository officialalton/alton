# 유형별 표본 생성·품질 계약 검증 — 난이도 medium, 유형당 10문항 (2026-09-18 04:55)

파이프라인: 생성 → 자료 → 유형별 품질 계약 → 독립 검사 → (오답만 걸리면) 자리별 구조화 계획·생성·결정적 검사(자리당 최대 2회) → 통과 시 채택, 지문·질문·정답·계약·독립검사 통과 + 잔여 오답 실패 1~2건이면 보강 대기, 그 외 폐기. 대기 상한은 요청 수. 총 소요 5분.

**요청 10개(유형당 10) → 후보 10개 평가**

| 지표 | 값 |
|---|---|
| 첫 생성 통과율(보정 0회) | 3/10 = 30% |
| 자동 보정 뒤 최종 통과율 | 10/10 = 100% |
| 보강 대기 전환율 | 0/10 = 0% (목표 ≤10%) |
| 대기 한도 초과 폐기 | 0 |
| 오답 자리별 보정 시도(해소) | 4(4) |
| 필드 부분 수정 시도(해소) | 6(2) |
| 문항 전체 재생성(해소) | 9(5) |
| 빈 응답 이벤트 | 0 |
| 문항당 평균 모델 호출 | 5.6 |

## 유형별

| 세부 기술 | 체계·형식 | 요청 | 후보 | 첫통과 | 최종통과 | 통과율 | 대기(초과폐기) | 빈응답 | 부족반환 | 미해소 실패 사유 | 초 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Command of Evidence (Quantitative) (`command_of_evidence_quant`) | sat_rw · mc | 10 | 10 | 3 | 10 | 100% | 0(0) | 0 | 0 | [contract] 정답 선택지의 수치(2, 1500)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.<br>[contract] 정답 선택지의 수치(2, 1500)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.<br>[contract] 정답 선택지의 수치(215)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다. | 272 |

## 70% 미달 유형

없음 — 전 유형 70% 이상.

## 빈 응답 이벤트(원인·재시도 결과)

없음.

## 요청보다 적게 반환된 경우(유형·사유)

없음.

## 실행 조건 표본(주제·문항 첫머리 — 같은 프롬프트 반복 여부 확인용)

- command_of_evidence_quant: Which choice most effectively uses data from the table to co… | Which choice most effectively uses data from the table to co… | Which choice most effectively uses data from the table to co… | The graph below shows the average one-way commute time (in m… | Which choice most effectively uses data from the table to co… | Which choice most effectively uses data from the table to co… | Which choice most effectively uses data from the table to co… | Which choice most effectively uses data from the bar graph t… | Which choice most effectively uses data from the table to co… | Which choice most effectively uses data from the table to co…

## 실패 단계별

| 단계 | 건수 | 해소 |
|---|---|---|
| contract | 13 | 5 |

## 반복되는 실패 사유(상위)

| 사유(숫자·인용 일반화) | 건수 |
|---|---|
| 질문 문장을 인식하지 못했습니다 — 지문 마지막 단락이 SAT 문항처럼 물음표로 끝나야 합니다(예: “…”). | 4 |
| 정답 선택지의 수치(N)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다. | 3 |
| 정답 선택지의 수치(N, N)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다. | 2 |
| 객관식은 선택지 N개(A~D)여야 합니다(지금 N개). / 빈 선택지가 있습니다. | 2 |
| 지문에 배치 용어(region 등)가 있습니다. / 정답 선택지의 수치(N)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다. | 1 |
| 정답 선택지의 수치(N, N, N)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다. | 1 |

## 전체 실패 목록

- command_of_evidence_quant · [contract] 미해소 — 정답 선택지의 수치(2, 1500)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.
- command_of_evidence_quant · [contract] 미해소 — 정답 선택지의 수치(2, 1500)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.
- command_of_evidence_quant · [contract] 미해소 — 정답 선택지의 수치(215)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.
- command_of_evidence_quant · [contract] 미해소 — 정답 선택지의 수치(215)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.
- command_of_evidence_quant · [contract] 미해소 — 정답 선택지의 수치(1100)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.
- command_of_evidence_quant · [contract] 미해소 — 지문에 배치 용어(region 등)가 있습니다. / 정답 선택지의 수치(1100)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.
- command_of_evidence_quant · [contract] 해소 — 질문 문장을 인식하지 못했습니다 — 지문 마지막 단락이 SAT 문항처럼 물음표로 끝나야 합니다(예: "Which choice …?").
- command_of_evidence_quant · [contract] 해소 — 질문 문장을 인식하지 못했습니다 — 지문 마지막 단락이 SAT 문항처럼 물음표로 끝나야 합니다(예: "Which choice …?").
- command_of_evidence_quant · [contract] 해소 — 질문 문장을 인식하지 못했습니다 — 지문 마지막 단락이 SAT 문항처럼 물음표로 끝나야 합니다(예: "Which choice …?").
- command_of_evidence_quant · [contract] 미해소 — 정답 선택지의 수치(25, 30, 670)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.
- command_of_evidence_quant · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 6개). / 빈 선택지가 있습니다.
- command_of_evidence_quant · [contract] 해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 6개). / 빈 선택지가 있습니다.
- command_of_evidence_quant · [contract] 해소 — 질문 문장을 인식하지 못했습니다 — 지문 마지막 단락이 SAT 문항처럼 물음표로 끝나야 합니다(예: "Which choice …?").
