# 유형별 표본 생성·품질 계약 검증 — 난이도 medium, 유형당 5문항 (2026-09-18 02:44)

파이프라인: 생성 → 자료 → 유형별 품질 계약 → 독립 검사 → (오답만 걸리면) 자리별 구조화 계획·생성·결정적 검사(자리당 최대 2회) → 통과 시 채택, 지문·질문·정답·계약·독립검사 통과 + 잔여 오답 실패 1~2건이면 보강 대기, 그 외 폐기. 대기 상한은 요청 수. 총 소요 3분.

**요청 5개(유형당 5) → 후보 5개 평가**

| 지표 | 값 |
|---|---|
| 첫 생성 통과율(보정 0회) | 2/5 = 40% |
| 자동 보정 뒤 최종 통과율 | 5/5 = 100% |
| 보강 대기 전환율 | 0/5 = 0% (목표 ≤10%) |
| 대기 한도 초과 폐기 | 0 |
| 오답 자리별 보정 시도(해소) | 0(0) |
| 필드 부분 수정 시도(해소) | 3(3) |
| 문항 전체 재생성(해소) | 7(1) |
| 빈 응답 이벤트 | 0 |
| 문항당 평균 모델 호출 | 6.4 |

## 유형별

| 세부 기술 | 체계·형식 | 요청 | 후보 | 첫통과 | 최종통과 | 통과율 | 대기(초과폐기) | 빈응답 | 부족반환 | 미해소 실패 사유 | 초 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Command of Evidence (Quantitative) (`command_of_evidence_quant`) | sat_rw · mc | 5 | 5 | 2 | 5 | 100% | 0(0) | 0 | 0 | [contract] 정답 선택지의 수치(2, 5)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.<br>[contract] 정답 선택지의 수치(2, 5)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.<br>[contract] quant-evidence: 오답 선택지 "Workshop C produced 50 surviving pai | 170 |

## 70% 미달 유형

없음 — 전 유형 70% 이상.

## 빈 응답 이벤트(원인·재시도 결과)

없음.

## 요청보다 적게 반환된 경우(유형·사유)

없음.

## 실행 조건 표본(주제·문항 첫머리 — 같은 프롬프트 반복 여부 확인용)

- command_of_evidence_quant: Which choice most effectively uses data from the table to co… | Which choice most effectively uses data from the table to co… | Which choice most effectively uses data from the table to co… | Which choice most effectively uses data from the table to co… | A local farmer claims that the wettest period of the year at…

## 실패 단계별

| 단계 | 건수 | 해소 |
|---|---|---|
| contract | 13 | 1 |

## 반복되는 실패 사유(상위)

| 사유(숫자·인용 일반화) | 건수 |
|---|---|
| quant-evidence: 오답 선택지 “…”의 수치가 정답과 같습니다 — 변별력이 없습니다. | 4 |
| 정답 선택지의 수치(N, N)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다. | 2 |
| 정답 선택지의 수치(N, N, N)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다. | 2 |
| 지문은 'N'(Freight trains) 값을 N 로 말하지만 그래프의 값은 N,N 입니다. | 2 |
| 정답 선택지의 수치(N, N, N, N, N, N)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다. | 1 |
| 정답 선택지의 수치(N, N, N, N, N)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다. | 1 |
| 정답 선택지의 수치(N, -N, N, N, N)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다. | 1 |

## 전체 실패 목록

- command_of_evidence_quant · [contract] 미해소 — 정답 선택지의 수치(2, 5)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.
- command_of_evidence_quant · [contract] 미해소 — 정답 선택지의 수치(2, 5)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "Workshop C produced 50 surviving paintings over 25 years, a "의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "Workshop C produced 50 surviving paintings over 25 years, a "의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 미해소 — 정답 선택지의 수치(1, 2, 18)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.
- command_of_evidence_quant · [contract] 미해소 — 정답 선택지의 수치(1, 2, 18)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "At a nitrogen concentration of 55 mg/kg, average leaf area w"의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 미해소 — 정답 선택지의 수치(10, 42, 2, 70, 103, 2)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.
- command_of_evidence_quant · [contract] 미해소 — 정답 선택지의 수치(45, 64, 49, 63, 65)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.
- command_of_evidence_quant · [contract] 미해소 — 정답 선택지의 수치(45, -64, 49, 63, 65)가 표·그래프 자료에 없습니다 — 근거 위치가 끊겼습니다.
- command_of_evidence_quant · [contract] 미해소 — 지문은 '2015'(Freight trains) 값을 2019 로 말하지만 그래프의 값은 1,840 입니다.
- command_of_evidence_quant · [contract] 미해소 — 지문은 '2015'(Freight trains) 값을 2019 로 말하지만 그래프의 값은 1,840 입니다.
- command_of_evidence_quant · [contract] 해소 — quant-evidence: 오답 선택지 "The claim is supported: the Jun-Aug period had an average ra"의 수치가 정답과 같습니다 — 변별력이 없습니다.
