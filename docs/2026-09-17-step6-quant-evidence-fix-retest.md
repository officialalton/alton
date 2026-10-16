# 유형별 표본 생성·품질 계약 검증 — 난이도 medium, 유형당 5문항 (2026-09-18 03:49)

파이프라인: 생성 → 자료 → 유형별 품질 계약 → 독립 검사 → (오답만 걸리면) 자리별 구조화 계획·생성·결정적 검사(자리당 최대 2회) → 통과 시 채택, 지문·질문·정답·계약·독립검사 통과 + 잔여 오답 실패 1~2건이면 보강 대기, 그 외 폐기. 대기 상한은 요청 수. 총 소요 4분.

**요청 5개(유형당 5) → 후보 4개 평가**

| 지표 | 값 |
|---|---|
| 첫 생성 통과율(보정 0회) | 1/4 = 25% |
| 자동 보정 뒤 최종 통과율 | 4/5 = 80% |
| 보강 대기 전환율 | 0/5 = 0% (목표 ≤10%) |
| 대기 한도 초과 폐기 | 0 |
| 오답 자리별 보정 시도(해소) | 0(0) |
| 필드 부분 수정 시도(해소) | 1(1) |
| 문항 전체 재생성(해소) | 8(3) |
| 빈 응답 이벤트 | 0 |
| 문항당 평균 모델 호출 | 8.5 |

## 유형별

| 세부 기술 | 체계·형식 | 요청 | 후보 | 첫통과 | 최종통과 | 통과율 | 대기(초과폐기) | 빈응답 | 부족반환 | 미해소 실패 사유 | 초 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Command of Evidence (Quantitative) (`command_of_evidence_quant`) | sat_rw · mc | 5 | 4 | 1 | 4 | 80% | 0(0) | 0 | 1 | [contract] quant-evidence: 오답 선택지 "Site C, had a temperature anomaly of<br>[contract] quant-evidence: 오답 선택지 "Site D, had a lower percentage of bl<br>[contract] quant-evidence: 오답 선택지 "increased by 8 bushels per acre, whi | 220 |

## 70% 미달 유형

없음 — 전 유형 70% 이상.

## 빈 응답 이벤트(원인·재시도 결과)

없음.

## 요청보다 적게 반환된 경우(유형·사유)

| 요청 | 반환 | 사유 |
|---|---|---|
| 5 | 4 | command_of_evidence_quant: 게이트 통과분이 요청 수 미달 |

## 실행 조건 표본(주제·문항 첫머리 — 같은 프롬프트 반복 여부 확인용)

- command_of_evidence_quant: Which choice most effectively uses data from the table to co… | Which choice most effectively uses data from the table to co… | Which choice most effectively uses data from the table to co… | A researcher claims that among the four moth species studied…

## 실패 단계별

| 단계 | 건수 | 해소 |
|---|---|---|
| contract | 12 | 2 |
| review | 1 | 1 |

## 반복되는 실패 사유(상위)

| 사유(숫자·인용 일반화) | 건수 |
|---|---|
| quant-evidence: 오답 선택지 “…”의 수치가 정답과 같습니다 — 변별력이 없습니다. | 6 |
| quant-evidence: 오답 선택지 “…”에 수치가 없습니다. | 3 |
| 독립 검사 지적: 추세선 식 y=Nx+N.N에 따르면 정답은 N.N AU여야 하는데 선택지 중 N.N가 없음. A(N.N), B(N.N) 모두 계산과 불일치함 | 1 |
| 범주 이름 'Elmwood (replaced)' 가 너무 길어 축 아래에 놓을 수 없습니다 — 짧게 줄이세요. / 범주 이름 'Fairview (not repla | 1 |
| 지문은 'hours' 단위를 쓰지만 표·그래프의 열 이름이나 축 제목에 단위가 없습니다(예: 'Cost (dollars)'). | 1 |
| 지문은 'Cellulose B' 의 'Mass Decomposed After N Days (%)' 를 N 로 말하지만 표의 값은 N 입니다. | 1 |

## 전체 실패 목록

- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "Site C, had a temperature anomaly of 2.6 degrees Celsius and"의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "Site D, had a lower percentage of bleached coral coverage th"에 수치가 없습니다.
- command_of_evidence_quant · [contract] 해소 — quant-evidence: 오답 선택지 "had 34 percent of commuters using public transit and 51 perc"의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "increased by 8 bushels per acre, while wages increased by 3 "의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "increased by 8 bushels per acre, while wages decreased by 5 "의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [review] 해소 — 독립 검사 지적: 추세선 식 y=0x+0.15에 따르면 정답은 0.15 AU여야 하는데 선택지 중 0.15가 없음. A(0.61), B(0.85) 모두 계산과 불일치함
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "Elmwood had a lower lead concentration than Ironside, even t"에 수치가 없습니다.
- command_of_evidence_quant · [contract] 미해소 — 범주 이름 'Elmwood (replaced)' 가 너무 길어 축 아래에 놓을 수 없습니다 — 짧게 줄이세요. / 범주 이름 'Fairview (not replaced)' 가 너무 길어 축 아래에 놓을 수 없습니다 — 짧게 줄이세요.
- command_of_evidence_quant · [contract] 해소 — quant-evidence: 오답 선택지 "Xylophanes tersa carried the largest pollen load, at 410 gra"의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 미해소 — 지문은 'hours' 단위를 쓰지만 표·그래프의 열 이름이나 축 제목에 단위가 없습니다(예: 'Cost (dollars)').
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "The 55–64 age group averaged 7.4 hours of sleep, more than t"의 수치가 정답과 같습니다 — 변별력이 없습니다.
- command_of_evidence_quant · [contract] 미해소 — 지문은 'Cellulose B' 의 'Mass Decomposed After 60 Days (%)' 를 60 로 말하지만 표의 값은 52 입니다.
- command_of_evidence_quant · [contract] 미해소 — quant-evidence: 오답 선택지 "Cellulose D, the thickest film tested, showed the lowest per"에 수치가 없습니다.
