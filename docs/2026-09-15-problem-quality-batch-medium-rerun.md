# 유형별 표본 생성·품질 계약 검증 — 난이도 medium (2026-09-15 19:19)

파이프라인: 생성 → 자료 필요 시 자료 생성 → 유형별 품질 계약(질문 대상·자료 근거·표시·정답·답안 형식) → 독립 품질 검사(정답 일치·오답 품질·추정 난이도) → 실패 시 사유 피드백 1회 재생성 → 부족분 1회 재생성. DB 저장 없음(보고서만). 총 소요 32분.

**요청 36 · 통과 27 (75%) · 재생성 36회(해소 12) · 검토 필요 21**

## 유형별

| 세부 기술 | 체계·형식 | 단건 | 복수 | 재생성(해소) | 추정 난이도 분포 | 검토 필요 | 미해소 실패 사유 | 초 |
|---|---|---|---|---|---|---|---|---|
| Linear inequalities (`linear_inequalities`) | sat_math · mc | 0/1 | 1/2 | 4(0) | e0 m1 h0 | 0 | [contract] 점 B2 라벨 '(2, 0)' 가 선과 겹칩니다.<br>[contract] 지문에 배치 용어(region, northeast 등)가 있습니다 — 좌표·점 이름·직선 이름으로 부릅니다.<br>[contract] 점 C 라벨 '(0, -1)' 가 선과 겹칩니다.<br>[contract] 지문에 배치 용어(region, northeast 등)가 있습니다 — 좌표·점 이름·직선 이름으로 부릅니다.<br>[contract] 점 P4 라벨 '(2, 3)' 가 선과 겹칩니다. / 지문의 식 y = -1/2x + 2 과 같은 직선이 그림에 없습니다.<br>[contract] 지문에 배치 용어(region, northeast 등)가 있습니다 — 좌표·점 이름·직선 이름으로 부릅니다.<br>[contract] 부등식 q1 라벨 'y ≤ -1/2x + 4' 가 선과 겹칩니다.<br>[contract] 지문에 배치 용어(region, northeast 등)가 있습니다 — 좌표·점 이름·직선 이름으로 부릅니다. | 124 |
| Equivalent expressions (`equivalent_expressions`) | sat_math · mc | 0/1 | 2/2 | 5(1) | e0 m2 h0 | 0 | [contract] 선택지 4에 수식 기호($…$) 밖에 LaTeX 제어문이 있습니다 — 그대로 노출됩니다: "\dfrac{2}{2x-3}"<br>[review] 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)<br>[contract] 선택지 3에 수식 기호($…$) 밖에 LaTeX 제어문이 있습니다 — 그대로 노출됩니다: "\dfrac{4}{2x-3}" / <br>[review] 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)<br>[review] 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)<br>[review] 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)<br>[review] 독립 검사는 D)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)<br>[review] 독립 검사는 D)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) | 296 |
| Percentages (`percentages`) | sat_math · mc | 1/1 | 1/2 | 3(0) | e2 m0 h0 | 2 | [contract] 지문은 'Month 2' 의 'Price (dollars)' 를 3 로 말하지만 표의 값은 92 입니다.<br>[contract] 지문은 'Month 2' 의 'Price (dollars)' 를 3 로 말하지만 표의 값은 92 입니다. / 지문에 닫히지 않<br>[review] 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)<br>[review] 독립 검사는 다른 답을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)<br>[contract] 지문은 'Year 1'(Population) 값을 2/3/4 로 말하지만 그래프의 값은 8 입니다. / 지문은 'Year 1'<br>[contract] 지문은 'Year 1'(Population) 값을 3 로 말하지만 그래프의 값은 8,000 입니다. | 157 |
| Evaluating statistical claims: observational studies and experiments (`evaluating_statistical_claims`) | sat_math · mc | 1/1 | 2/2 | 1(0) | e0 m3 h0 | 2 | [review] 오답 B), C)이 지문·자료와 무관합니다<br>[review] 오답 B), C), D)이 모두 너무 명백해 정답이 노출됩니다 | 152 |
| Area and volume (`area_volume`) | sat_math · mc | 0/1 | 1/2 | 4(0) | e1 m0 h0 | 1 | [contract] 지문은 cone 를 말하지만 도식의 kind 는 cylinder 입니다. / 지문은 높이 4 인데 도식 라벨은 '10' 입니다<br>[contract] 지문은 cone 를 말하지만 도식의 kind 는 cylinder 입니다. / 지문은 높이 4 인데 도식 라벨은 '10' 입니다<br>[contract] 지문은 cylinder 를 말하지만 도식의 kind 는 cone 입니다.<br>[contract] 지문은 cylinder 를 말하지만 도식의 kind 는 cone 입니다.<br>[contract] 지문은 cone 를 말하지만 도식의 kind 는 cylinder 입니다.<br>[contract] 지문은 cylinder 를 말하지만 도식의 kind 는 cone 입니다.<br>[contract] 지문은 cone 를 말하지만 도식의 kind 는 cylinder 입니다.<br>[contract] 지문은 cone 를 말하지만 도식의 kind 는 cylinder 입니다. | 112 |
| Inferences (`inferences`) | sat_rw · mc | 1/1 | 1/2 | 4(1) | e0 m2 h0 | 2 | [contract] 빈칸(______)은 정확히 하나여야 합니다(지금 0개).<br>[review] 오답 A), C), D)이 모두 너무 명백해 정답이 노출됩니다<br>[review] 오답 A), C), D)이 모두 너무 명백해 정답이 노출됩니다<br>[review] 오답 A), B)이 지문·자료와 무관합니다<br>[review] 오답 A), C), D)이 모두 너무 명백해 정답이 노출됩니다<br>[review] 오답 C), D)이 지문·자료와 무관합니다 | 210 |
| Command of Evidence (Textual) (`command_of_evidence_text`) | sat_rw · mc | 1/1 | 1/2 | 4(2) | e2 m0 h0 | 2 | [review] 오답 B), C)이 지문·자료와 무관합니다<br>[contract] 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(<br>[review] 오답 C), D)이 지문·자료와 무관합니다<br>[contract] 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다( | 148 |
| Words in Context (`words_in_context`) | sat_rw · mc | 1/1 | 2/2 | 2(2) | e1 m2 h0 | 3 | — | 100 |
| Text Structure and Purpose (`text_structure_purpose`) | sat_rw · mc | 1/1 | 2/2 | 2(2) | e1 m2 h0 | 3 | — | 118 |
| Cross-Text Connections (`cross_text_connections`) | sat_rw · mc | 0/1 | 2/2 | 4(1) | e1 m1 h0 | 2 | [review] 오답 B), C), D)이 모두 너무 명백해 정답이 노출됩니다<br>[review] 오답 B), C), D)이 모두 너무 명백해 정답이 노출됩니다<br>[review] 오답 A), C), D)이 모두 너무 명백해 정답이 노출됩니다<br>[review] 오답 A), C), D)이 모두 너무 명백해 정답이 노출됩니다<br>[review] 오답 B), C), D)이 모두 너무 명백해 정답이 노출됩니다<br>[review] 오답 A), C), D)이 모두 너무 명백해 정답이 노출됩니다 | 238 |
| Rhetorical Synthesis (`rhetorical_synthesis`) | sat_rw · mc | 1/1 | 2/2 | 2(2) | e0 m3 h0 | 1 | — | 121 |
| Boundaries (`boundaries`) | sat_rw · mc | 1/1 | 2/2 | 1(1) | e0 m3 h0 | 3 | — | 119 |

## 실패 단계별

| 단계 | 건수 | 재생성으로 해소 |
|---|---|---|
| contract | 29 | 4 |
| review | 31 | 8 |

## 반복되는 실패 사유(상위)

| 사유(숫자·인용 일반화) | 건수 |
|---|---|
| 오답 B), C), D)이 모두 너무 명백해 정답이 노출됩니다 | 9 |
| 오답 A), C), D)이 모두 너무 명백해 정답이 노출됩니다 | 6 |
| 지문에 배치 용어(region, northeast 등)가 있습니다 — 좌표·점 이름·직선 이름으로 부릅니다. | 4 |
| 객관식은 선택지 N개(A~D)여야 합니다(지금 N개). / Reading & Writing 문항은 선택지가 정확히 N개입니다(지금 N개). | 4 |
| 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) | 3 |
| 지문은 cylinder 를 말하지만 도식의 kind 는 cone 입니다. | 3 |
| 지문은 cone 를 말하지만 도식의 kind 는 cylinder 입니다. | 3 |
| 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) | 2 |
| 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) | 2 |
| 독립 검사는 D)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) | 2 |
| 오답 B), C)이 지문·자료와 무관합니다 | 2 |
| 지문은 cone 를 말하지만 도식의 kind 는 cylinder 입니다. / 지문은 높이 N 인데 도식 라벨은 'N' 입니다. | 2 |
| 오답 C), D)이 지문·자료와 무관합니다 | 2 |
| 점 BN 라벨 '(N, N)' 가 선과 겹칩니다. | 1 |
| 점 C 라벨 '(N, -N)' 가 선과 겹칩니다. | 1 |
| 점 PN 라벨 '(N, N)' 가 선과 겹칩니다. / 지문의 식 y = -N/Nx + N 과 같은 직선이 그림에 없습니다. | 1 |
| 부등식 qN 라벨 'y ≤ -N/Nx + N' 가 선과 겹칩니다. | 1 |
| 선택지 N에 수식 기호($…$) 밖에 LaTeX 제어문이 있습니다 — 그대로 노출됩니다: “…” | 1 |
| 선택지 N에 수식 기호($…$) 밖에 LaTeX 제어문이 있습니다 — 그대로 노출됩니다: “…” / 선택지 N에 수식 기호($…$) 밖에 LaTeX 제어문이 있습 | 1 |
| 지문은 'Month N' 의 'Price (dollars)' 를 N 로 말하지만 표의 값은 N 입니다. | 1 |
| 지문은 'Month N' 의 'Price (dollars)' 를 N 로 말하지만 표의 값은 N 입니다. / 지문에 닫히지 않은 수식 기호 $ 가 있습니다. | 1 |
| 독립 검사는 다른 답을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) | 1 |
| 지문은 'Year N'(Population) 값을 N/N/N 로 말하지만 그래프의 값은 N 입니다. / 지문은 'Year N'(Population) 값을 N 로  | 1 |
| 지문은 'Year N'(Population) 값을 N 로 말하지만 그래프의 값은 N,N 입니다. | 1 |
| 빈칸(______)은 정확히 하나여야 합니다(지금 N개). | 1 |

## 전체 실패 목록

- linear_inequalities · [contract] 미해소 — 점 B2 라벨 '(2, 0)' 가 선과 겹칩니다.
- linear_inequalities · [contract] 미해소 — 지문에 배치 용어(region, northeast 등)가 있습니다 — 좌표·점 이름·직선 이름으로 부릅니다.
- linear_inequalities · [contract] 미해소 — 점 C 라벨 '(0, -1)' 가 선과 겹칩니다.
- linear_inequalities · [contract] 미해소 — 지문에 배치 용어(region, northeast 등)가 있습니다 — 좌표·점 이름·직선 이름으로 부릅니다.
- linear_inequalities · [contract] 미해소 — 점 P4 라벨 '(2, 3)' 가 선과 겹칩니다. / 지문의 식 y = -1/2x + 2 과 같은 직선이 그림에 없습니다.
- linear_inequalities · [contract] 미해소 — 지문에 배치 용어(region, northeast 등)가 있습니다 — 좌표·점 이름·직선 이름으로 부릅니다.
- linear_inequalities · [contract] 미해소 — 부등식 q1 라벨 'y ≤ -1/2x + 4' 가 선과 겹칩니다.
- linear_inequalities · [contract] 미해소 — 지문에 배치 용어(region, northeast 등)가 있습니다 — 좌표·점 이름·직선 이름으로 부릅니다.
- equivalent_expressions · [contract] 미해소 — 선택지 4에 수식 기호($…$) 밖에 LaTeX 제어문이 있습니다 — 그대로 노출됩니다: "\dfrac{2}{2x-3}"
- equivalent_expressions · [review] 미해소 — 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- equivalent_expressions · [contract] 미해소 — 선택지 3에 수식 기호($…$) 밖에 LaTeX 제어문이 있습니다 — 그대로 노출됩니다: "\dfrac{4}{2x-3}" / 선택지 4에 수식 기호($…$) 밖에 LaTeX 제어문이 있습니다 — 그대로 노출됩니다: "\dfrac{12}{2x-3}"
- equivalent_expressions · [review] 미해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- equivalent_expressions · [review] 미해소 — 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- equivalent_expressions · [review] 미해소 — 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- equivalent_expressions · [review] 미해소 — 독립 검사는 D)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- equivalent_expressions · [review] 미해소 — 독립 검사는 D)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- equivalent_expressions · [review] 해소 — 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- percentages · [contract] 미해소 — 지문은 'Month 2' 의 'Price (dollars)' 를 3 로 말하지만 표의 값은 92 입니다.
- percentages · [contract] 미해소 — 지문은 'Month 2' 의 'Price (dollars)' 를 3 로 말하지만 표의 값은 92 입니다. / 지문에 닫히지 않은 수식 기호 $ 가 있습니다.
- percentages · [review] 미해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- percentages · [review] 미해소 — 독립 검사는 다른 답을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- percentages · [contract] 미해소 — 지문은 'Year 1'(Population) 값을 2/3/4 로 말하지만 그래프의 값은 8 입니다. / 지문은 'Year 1'(Population) 값을 8000 로 말하지만 그래프의 값은 8 입니다.
- percentages · [contract] 미해소 — 지문은 'Year 1'(Population) 값을 3 로 말하지만 그래프의 값은 8,000 입니다.
- evaluating_statistical_claims · [review] 미해소 — 오답 B), C)이 지문·자료와 무관합니다
- evaluating_statistical_claims · [review] 미해소 — 오답 B), C), D)이 모두 너무 명백해 정답이 노출됩니다
- area_volume · [contract] 미해소 — 지문은 cone 를 말하지만 도식의 kind 는 cylinder 입니다. / 지문은 높이 4 인데 도식 라벨은 '10' 입니다.
- area_volume · [contract] 미해소 — 지문은 cone 를 말하지만 도식의 kind 는 cylinder 입니다. / 지문은 높이 4 인데 도식 라벨은 '10' 입니다.
- area_volume · [contract] 미해소 — 지문은 cylinder 를 말하지만 도식의 kind 는 cone 입니다.
- area_volume · [contract] 미해소 — 지문은 cylinder 를 말하지만 도식의 kind 는 cone 입니다.
- area_volume · [contract] 미해소 — 지문은 cone 를 말하지만 도식의 kind 는 cylinder 입니다.
- area_volume · [contract] 미해소 — 지문은 cylinder 를 말하지만 도식의 kind 는 cone 입니다.
- area_volume · [contract] 미해소 — 지문은 cone 를 말하지만 도식의 kind 는 cylinder 입니다.
- area_volume · [contract] 미해소 — 지문은 cone 를 말하지만 도식의 kind 는 cylinder 입니다.
- inferences · [contract] 미해소 — 빈칸(______)은 정확히 하나여야 합니다(지금 0개).
- inferences · [review] 미해소 — 오답 A), C), D)이 모두 너무 명백해 정답이 노출됩니다
- inferences · [review] 미해소 — 오답 A), C), D)이 모두 너무 명백해 정답이 노출됩니다
- inferences · [review] 미해소 — 오답 A), B)이 지문·자료와 무관합니다
- inferences · [contract] 해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / 빈 선택지가 있습니다.
- inferences · [review] 미해소 — 오답 A), C), D)이 모두 너무 명백해 정답이 노출됩니다
- inferences · [review] 미해소 — 오답 C), D)이 지문·자료와 무관합니다
- command_of_evidence_text · [contract] 해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- command_of_evidence_text · [contract] 해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- command_of_evidence_text · [review] 미해소 — 오답 B), C)이 지문·자료와 무관합니다
- command_of_evidence_text · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- command_of_evidence_text · [review] 미해소 — 오답 C), D)이 지문·자료와 무관합니다
- command_of_evidence_text · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- words_in_context · [review] 해소 — 오답 B), C), D)이 모두 너무 명백해 정답이 노출됩니다
- words_in_context · [contract] 해소 — 질문이 인용한 단어 “temper” 가 지문에 없습니다. / 빈칸 문항에 밑줄(__…__)이 함께 있습니다 — 대상은 하나만.
- text_structure_purpose · [review] 해소 — 오답 B), C), D)이 모두 너무 명백해 정답이 노출됩니다
- text_structure_purpose · [review] 해소 — 오답 B), C), D)이 모두 너무 명백해 정답이 노출됩니다
- cross_text_connections · [review] 미해소 — 오답 B), C), D)이 모두 너무 명백해 정답이 노출됩니다
- cross_text_connections · [review] 미해소 — 오답 B), C), D)이 모두 너무 명백해 정답이 노출됩니다
- cross_text_connections · [review] 미해소 — 오답 A), C), D)이 모두 너무 명백해 정답이 노출됩니다
- cross_text_connections · [review] 미해소 — 오답 A), C), D)이 모두 너무 명백해 정답이 노출됩니다
- cross_text_connections · [review] 미해소 — 오답 B), C), D)이 모두 너무 명백해 정답이 노출됩니다
- cross_text_connections · [review] 미해소 — 오답 A), C), D)이 모두 너무 명백해 정답이 노출됩니다
- cross_text_connections · [review] 해소 — 오답 B), C), D)이 모두 너무 명백해 정답이 노출됩니다
- rhetorical_synthesis · [review] 해소 — 오답 B), C), D)이 모두 너무 명백해 정답이 노출됩니다
- rhetorical_synthesis · [review] 해소 — 오답 A), B), C)이 모두 너무 명백해 정답이 노출됩니다
- boundaries · [review] 해소 — 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
