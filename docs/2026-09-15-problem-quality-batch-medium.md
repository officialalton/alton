# 유형별 표본 생성·품질 계약 검증 — 난이도 medium (2026-09-15 18:45)

파이프라인: 생성 → 자료 필요 시 자료 생성 → 유형별 품질 계약(질문 대상·자료 근거·표시·정답·답안 형식) → 독립 품질 검사(정답 일치·오답 품질·추정 난이도) → 실패 시 사유 피드백 1회 재생성 → 부족분 1회 재생성. DB 저장 없음(보고서만). 총 소요 80분.

**요청 90 · 통과 61 (68%) · 재생성 94회(해소 19) · 검토 필요 21**

## 유형별

| 세부 기술 | 체계·형식 | 단건 | 복수 | 재생성(해소) | 추정 난이도 분포 | 검토 필요 | 미해소 실패 사유 | 초 |
|---|---|---|---|---|---|---|---|---|
| Linear equations in one variable (`linear_equations_one_var`) | sat_math · mc | 1/1 | 2/2 | 2(1) | e1 m2 h0 | 1 | [review] 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)<br>[review] 독립 검사는 다른 답을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) | 122 |
| Linear functions (`linear_functions`) | sat_math · mc | 1/1 | 2/2 | 0(0) | e2 m1 h0 | 2 | — | 59 |
| Linear equations in two variables (`linear_equations_two_var`) | sat_math · mc | 1/1 | 1/2 | 4(0) | e1 m1 h0 | 1 | [contract] 지문의 좌표 (2, -1) 가 그림의 점이나 그래프 위에 없습니다. / 지문의 직선 'm' 가 그림에 없습니다(직선 객체의 l<br>[contract] 지문의 좌표 (2, -1) 가 그림의 점이나 그래프 위에 없습니다. / 지문의 직선 'm' 가 그림에 없습니다(직선 객체의 l<br>[contract] 선택지 1에 수식 기호($…$) 밖에 LaTeX 제어문이 있습니다 — 그대로 노출됩니다: "\frac{4}{3}x" / 선택지<br>[review] 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)<br>[contract] 선택지는 값만 적습니다('x = 3' 이 아니라 '3').<br>[contract] 점 P0 라벨 '(0, 5)' 가 선과 겹칩니다. / 점 X 라벨 '(2, 3)' 가 선과 겹칩니다.<br>[contract] 자료 필수 문항입니다 — Linear equations in two variables 문항이 도형(figure)을 가리키므로 <br>[contract] 자료 필수 문항입니다 — Linear equations in two variables 문항이 도형(figure)을 가리키므로  | 149 |
| Systems of two linear equations (`systems_linear`) | sat_math · mc | 1/1 | 1/2 | 4(0) | e1 m1 h0 | 1 | [review] 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)<br>[contract] 선택지의 점 (3, 1) 이 그림에 찍혀 있습니다 — 선택지 좌표는 그림에 넣지 않습니다(정답 노출).<br>[contract] 점 B 라벨 '(0, 3)' 를 겹치지 않게 놓을 자리가 없습니다 — 축 범위를 넓히거나 라벨을 줄이세요. / 선택지의 점 (<br>[contract] 점 B 라벨 '(0, 3)' 를 겹치지 않게 놓을 자리가 없습니다 — 축 범위를 넓히거나 라벨을 줄이세요. / 선택지의 점 (<br>[contract] 점 A 라벨 '(0, -2)' 가 선과 겹칩니다.<br>[contract] 점 A 라벨 '(0, -2)' 가 선과 겹칩니다.<br>[review] 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)<br>[review] 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) | 201 |
| Linear inequalities (`linear_inequalities`) | sat_math · mc | 1/1 | 0/2 | 5(1) | e0 m1 h0 | 0 | [contract] 지문의 식 y = -1/2x + 3 과 같은 직선이 그림에 없습니다.<br>[contract] 지문에 배치 용어(region, northeast 등)가 있습니다 — 좌표·점 이름·직선 이름으로 부릅니다.<br>[contract] 점 D 라벨 '(2, 2)' 를 겹치지 않게 놓을 자리가 없습니다 — 축 범위를 넓히거나 라벨을 줄이세요. / 점 A 라벨 '<br>[contract] 지문에 배치 용어(region, northeast 등)가 있습니다 — 좌표·점 이름·직선 이름으로 부릅니다.<br>[contract] 선택지 1에 수식 기호($…$) 밖에 LaTeX 제어문이 있습니다 — 그대로 노출됩니다: "\ge" / 선택지 2에 수식 기호<br>[contract] 지문에 배치 용어(region, northeast 등)가 있습니다 — 좌표·점 이름·직선 이름으로 부릅니다.<br>[contract] 점 P4 라벨 '(4, -1)' 가 선과 겹칩니다.<br>[review] 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) | 153 |
| Equivalent expressions (`equivalent_expressions`) | sat_math · mc | 1/1 | 1/2 | 5(1) | e0 m2 h0 | 0 | [review] 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)<br>[review] 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)<br>[contract] 선택지 3에 수식 기호($…$) 밖에 LaTeX 제어문이 있습니다 — 그대로 노출됩니다: "\dfrac{2}{x-2}"<br>[review] 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)<br>[review] 독립 검사는 D)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)<br>[review] 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)<br>[review] 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)<br>[review] 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) | 237 |
| Nonlinear equations and systems (`nonlinear_equations_systems`) | sat_math · mc | 1/1 | 2/2 | 1(0) | e2 m1 h0 | 2 | [contract] 점 Q 라벨 '(3, 3)' 가 선과 겹칩니다.<br>[contract] 점 Q 라벨 '(4, -3)' 가 선과 겹칩니다. | 101 |
| Nonlinear functions (`nonlinear_functions`) | sat_math · mc | 1/1 | 2/2 | 2(1) | e2 m1 h0 | 2 | [review] 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)<br>[review] 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) | 130 |
| Ratios, rates, proportional relationships, and units (`ratios_rates_units`) | sat_math · mc | 1/1 | 2/2 | 0(0) | e2 m1 h0 | 2 | — | 59 |
| Percentages (`percentages`) | sat_math · mc | 1/1 | 0/2 | 4(0) | e0 m1 h0 | 0 | [contract] 지문은 'February' 의 'Price (dollars)' 를 25 로 말하지만 표의 값은 100 입니다. / 지문은 'F<br>[contract] 지문에 닫히지 않은 수식 기호 $ 가 있습니다. / 해설에 수식 기호($…$) 밖에 LaTeX 제어문이 있습니다 — 그대로 노<br>[contract] 지문은 'Original' 의 'Price (dollars)' 를 1 로 말하지만 표의 값은 80 입니다. / 지문은 'Sta<br>[contract] 지문에 닫히지 않은 수식 기호 $ 가 있습니다. / 해설에 수식 기호($…$) 밖에 LaTeX 제어문이 있습니다 — 그대로 노<br>[contract] 지문에 닫히지 않은 수식 기호 $ 가 있습니다.<br>[contract] 지문에 닫히지 않은 수식 기호 $ 가 있습니다.<br>[contract] 지문은 'Week 2'(Reported Flu Cases) 값을 3 로 말하지만 그래프의 값은 240 입니다.<br>[review] 독립 검사는 다른 답을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) | 113 |
| One-variable data: distributions and measures (`one_variable_data`) | sat_math · mc | 0/1 | 2/2 | 4(2) | e1 m1 h0 | 1 | [contract] 선택지가 로마숫자 조합인데 진술(statements)이 없습니다 — 진술 I, II, III 을 statements 에 적으세<br>[review] 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)<br>[contract] 선택지가 로마숫자 조합인데 진술(statements)이 없습니다 — 진술 I, II, III 을 statements 에 적으세<br>[review] 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) | 166 |
| Two-variable data: models and scatterplots (`two_variable_data`) | sat_math · mc | 1/1 | 1/2 | 3(1) | e1 m1 h0 | 1 | [review] 오답 D)이 지문·자료와 무관합니다<br>[review] 오답 D)이 지문·자료와 무관합니다<br>[contract] 자료 필수 문항입니다 — Two-variable data: models and scatterplots 문항이 자료(scatte<br>[contract] 선택지 1에 닫히지 않은 수식 기호 $ 가 있습니다. / 선택지 2에 닫히지 않은 수식 기호 $ 가 있습니다. | 139 |
| Probability and conditional probability (`probability`) | sat_math · mc | 1/1 | 2/2 | 0(0) | e2 m1 h0 | 2 | — | 62 |
| Inference from sample statistics and margin of error (`inference_margin_error`) | sat_math · mc | 1/1 | 2/2 | 0(0) | e0 m3 h0 | 0 | — | 82 |
| Evaluating statistical claims: observational studies and experiments (`evaluating_statistical_claims`) | sat_math · mc | 1/1 | 0/2 | 4(0) | e0 m1 h0 | 0 | [review] 오답 C)이 지문·자료와 무관합니다<br>[review] 오답 C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[review] 오답 C)이 지문·자료와 무관합니다<br>[review] 오답 C)이 지문·자료와 무관합니다 / 오답 B), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다 / 독립 검사 지<br>[review] 오답 C)이 지문·자료와 무관합니다<br>[contract] 객관식은 선택지 4개(A~D)여야 합니다(지금 5개).<br>[review] 오답 B), C)이 지문·자료와 무관합니다 / 오답 B), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[contract] 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). | 236 |
| Area and volume (`area_volume`) | sat_math · mc | 0/1 | 1/2 | 5(1) | e1 m0 h0 | 1 | [contract] 지문은 rectangular prism 를 말하지만 도식의 kind 는 cylinder 입니다.<br>[contract] 지문은 rectangular prism 를 말하지만 도식의 kind 는 cylinder 입니다.<br>[review] 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)<br>[review] 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)<br>[contract] 지문은 cone 를 말하지만 도식의 kind 는 cylinder 입니다.<br>[contract] 지문은 cone 를 말하지만 도식의 kind 는 cylinder 입니다.<br>[contract] 지문은 cone 를 말하지만 도식의 kind 는 cylinder 입니다. / 지문은 높이 5 인데 도식 라벨은 '10' 입니다<br>[contract] 지문은 cone 를 말하지만 도식의 kind 는 cylinder 입니다. / 지문은 높이 5 인데 도식 라벨은 '10' 입니다 | 163 |
| Lines, angles, and triangles (`lines_angles_triangles`) | sat_math · mc | 1/1 | 1/2 | 3(0) | e1 m1 h0 | 1 | [contract] 자료 필수 문항입니다 — Lines, angles, and triangles 문항이 도형(figure)을 가리키므로 도형 자료<br>[review] 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)<br>[contract] 자료 필수 문항입니다 — 각·평행선·삼각형 문항은 도형 없이 성립하지 않습니다. 도형 자료가 필요합니다. '도형' 자료를 만들<br>[contract] 변 라벨(AB) 'AD = 4, DB = 6' 가 그림 밖으로 나갑니다. / 점 이름 'A' 가 중복됩니다(두 삼각형은 서로 <br>[contract] 지문의 삼각형 DEF 의 점 'D' 가 도형 데이터에 없습니다. / 지문의 삼각형 DEF 의 점 'E' 가 도형 데이터에 없습<br>[contract] 자료 필수 문항입니다 — 각·평행선·삼각형 문항은 도형 없이 성립하지 않습니다. 도형 자료가 필요합니다. '도형' 자료를 만들 | 140 |
| Right triangles and trigonometry (`right_triangles_trigonometry`) | sat_math · mc | 1/1 | 2/2 | 1(1) | e0 m3 h0 | 0 | — | 88 |
| Circles (`circles`) | sat_math · mc | 1/1 | 1/2 | 4(1) | e2 m0 h0 | 2 | [contract] 중심각 라벨(AB) '80°' 가 '9' 와 겹칩니다.<br>[contract] 중심각 라벨(AB) '80°' 가 '9' 와 겹칩니다.<br>[review] 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)<br>[contract] 객관식은 선택지 4개(A~D)여야 합니다(지금 0개). / 정답 자리가 선택지 범위 안에 없습니다.<br>[contract] 현 라벨 'AC' 을 겹치지 않게 놓을 자리가 없습니다.<br>[review] 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) | 160 |
| Central Ideas and Details (`central_ideas_details`) | sat_rw · mc | 1/1 | 2/2 | 4(2) | e0 m3 h0 | 0 | [review] 오답 A), C)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[review] 오답 A), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[review] 오답 C)이 지문·자료와 무관합니다<br>[review] 오답 C)이 지문·자료와 무관합니다 / 오답 A), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다 | 239 |
| Inferences (`inferences`) | sat_rw · mc | 0/1 | 0/2 | 6(0) | e0 m0 h0 | 0 | [contract] 빈칸(______)은 정확히 하나여야 합니다(지금 0개).<br>[review] 오답 D)이 지문·자료와 무관합니다 / 오답 A), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[review] 오답 C)이 지문·자료와 무관합니다 / 오답 A), C)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[contract] 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(<br>[review] 오답 A), C)이 지문·자료와 무관합니다 / 오답 A), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[review] 오답 A), C)이 지문·자료와 무관합니다 / 오답 A), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[contract] 자료 필수 문항입니다 — Inferences 문항이 자료(frequency)를 읽어야 풀 수 있으므로 표·그래프 자료가 필요합<br>[review] 오답 C)이 지문·자료와 무관합니다 / 오답 B), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[review] 오답 C)이 지문·자료와 무관합니다 / 오답 B), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[review] 오답 C)이 지문·자료와 무관합니다 / 오답 B), C)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[review] 오답 D)이 지문·자료와 무관합니다 / 오답 B), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[contract] 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다( | 279 |
| Command of Evidence (Textual) (`command_of_evidence_text`) | sat_rw · mc | 0/1 | 0/2 | 6(0) | e0 m0 h0 | 0 | [review] 오답 C), D)이 지문·자료와 무관합니다 / 오답 C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[contract] 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(<br>[review] 오답 B), D)이 지문·자료와 무관합니다 / 오답 B), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[review] 오답 C), D)이 지문·자료와 무관합니다 / 오답 B), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[review] 오답 B), C), D)이 지문·자료와 무관합니다 / 오답 B), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[contract] 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(<br>[review] 오답 C), D)이 지문·자료와 무관합니다 / 오답 A), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[contract] 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(<br>[review] 오답 C), D)이 지문·자료와 무관합니다 / 오답 C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[contract] 객관식은 선택지 4개(A~D)여야 합니다(지금 6개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(<br>[review] 오답 C)이 지문·자료와 무관합니다 / 독립 검사 지적: 질문에서 이미 Evidence B의 결과(Main Street 매출 <br>[contract] 정답 선택지 문장이 지문에 그대로 들어 있습니다 — 정답 노출. | 244 |
| Command of Evidence (Quantitative) (`command_of_evidence_quant`) | sat_rw · mc | 1/1 | 2/2 | 3(2) | e0 m3 h0 | 0 | [review] 오답 A), B), C)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[review] 오답 A), B), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다 | 183 |
| Words in Context (`words_in_context`) | sat_rw · mc | 1/1 | 2/2 | 5(3) | e1 m2 h0 | 1 | [review] 오답 D)이 지문·자료와 무관합니다 / 오답 C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[review] 오답 D)이 지문·자료와 무관합니다 / 오답 B), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[review] 오답 A), C)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[review] 오답 C)이 지문·자료와 무관합니다 / 오답 A), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다 | 247 |
| Text Structure and Purpose (`text_structure_purpose`) | sat_rw · mc | 1/1 | 0/2 | 5(0) | e0 m1 h0 | 0 | [review] 오답 B)이 지문·자료와 무관합니다 / 오답 B), C)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[review] 오답 B)이 지문·자료와 무관합니다<br>[review] 오답 B), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[review] 오답 C)이 지문·자료와 무관합니다 / 오답 C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[review] 오답 C)이 지문·자료와 무관합니다 / 오답 B), C)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[review] 오답 B), C)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[review] 오답 A)이 지문·자료와 무관합니다<br>[review] 오답 A)이 지문·자료와 무관합니다<br>[review] 오답 D)이 지문·자료와 무관합니다<br>[contract] 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다( | 247 |
| Cross-Text Connections (`cross_text_connections`) | sat_rw · mc | 1/1 | 0/2 | 5(0) | e0 m1 h0 | 0 | [review] 오답 C)이 지문·자료와 무관합니다<br>[review] 오답 B), D)이 지문·자료와 무관합니다 / 오답 B), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[review] 오답 A), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[review] 오답 A)이 지문·자료와 무관합니다 / 오답 A), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[review] 오답 C)이 지문·자료와 무관합니다<br>[review] 오답 D)이 지문·자료와 무관합니다 / 오답 A), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[review] 오답 D)이 지문·자료와 무관합니다 / 오답 C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[review] 오답 B), C)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[review] 오답 D)이 지문·자료와 무관합니다 / 오답 C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[review] 오답 B), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다 | 315 |
| Rhetorical Synthesis (`rhetorical_synthesis`) | sat_rw · mc | 0/1 | 0/2 | 5(0) | e0 m0 h0 | 0 | [review] 오답 C), D)이 지문·자료와 무관합니다 / 오답 A), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[contract] 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(<br>[review] 오답 C)이 지문·자료와 무관합니다<br>[review] 오답 A), D)이 지문·자료와 무관합니다 / 오답 A), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[review] 오답 A), C)이 지문·자료와 무관합니다 / 오답 A), C)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[contract] 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(<br>[review] 오답 C)이 지문·자료와 무관합니다 / 오답 A), C)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[contract] 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(<br>[review] 오답 C), D)이 지문·자료와 무관합니다 / 오답 B), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다<br>[contract] 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다( | 187 |
| Transitions (`transitions`) | sat_rw · mc | 1/1 | 2/2 | 1(1) | e1 m2 h0 | 1 | — | 95 |
| Boundaries (`boundaries`) | sat_rw · mc | 0/1 | 2/2 | 3(1) | e0 m2 h0 | 0 | [contract] 빈칸(______)은 정확히 하나여야 합니다(지금 0개).<br>[review] 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 오답 B),<br>[contract] 빈칸(______)은 정확히 하나여야 합니다(지금 0개).<br>[review] 오답 C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다 | 135 |
| Form, Structure, and Sense (`form_structure_sense`) | sat_rw · mc | 1/1 | 2/2 | 0(0) | e0 m3 h0 | 0 | — | 76 |

## 실패 단계별

| 단계 | 건수 | 재생성으로 해소 |
|---|---|---|
| review | 100 | 16 |
| contract | 69 | 3 |

## 반복되는 실패 사유(상위)

| 사유(숫자·인용 일반화) | 건수 |
|---|---|
| 객관식은 선택지 N개(A~D)여야 합니다(지금 N개). / Reading & Writing 문항은 선택지가 정확히 N개입니다(지금 N개). | 12 |
| 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) | 10 |
| 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) | 8 |
| 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) | 7 |
| 오답 C)이 지문·자료와 무관합니다 | 7 |
| 지문에 배치 용어(region, northeast 등)가 있습니다 — 좌표·점 이름·직선 이름으로 부릅니다. | 4 |
| 오답 B), C)이 너무 명백해 정답을 쉽게 고를 수 있습니다 | 3 |
| 오답 D)이 지문·자료와 무관합니다 | 3 |
| 오답 C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다 | 3 |
| 오답 A), C)이 너무 명백해 정답을 쉽게 고를 수 있습니다 | 3 |
| 오답 A)이 지문·자료와 무관합니다 | 3 |
| 빈칸(______)은 정확히 하나여야 합니다(지금 N개). | 3 |
| 오답 C)이 지문·자료와 무관합니다 / 오답 B), C)이 너무 명백해 정답을 쉽게 고를 수 있습니다 | 3 |
| 오답 D)이 지문·자료와 무관합니다 / 오답 C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다 | 3 |
| 독립 검사는 다른 답을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) | 2 |
| 지문의 좌표 (N, -N) 가 그림의 점이나 그래프 위에 없습니다. / 지문의 직선 'm' 가 그림에 없습니다(직선 객체의 label 로 두세요). | 2 |
| 선택지 N에 수식 기호($…$) 밖에 LaTeX 제어문이 있습니다 — 그대로 노출됩니다: “…” / 선택지 N에 수식 기호($…$) 밖에 LaTeX 제어문이 있습 | 2 |
| 자료 필수 문항입니다 — Linear equations in two variables 문항이 도형(figure)을 가리키므로 도형 자료가 필요합니다. '도형' 자 | 2 |
| 점 B 라벨 '(N, N)' 를 겹치지 않게 놓을 자리가 없습니다 — 축 범위를 넓히거나 라벨을 줄이세요. / 선택지의 점 (N, N) 이 그림에 찍혀 있습니다  | 2 |
| 점 A 라벨 '(N, -N)' 가 선과 겹칩니다. | 2 |
| 지문에 닫히지 않은 수식 기호 $ 가 있습니다. / 해설에 수식 기호($…$) 밖에 LaTeX 제어문이 있습니다 — 그대로 노출됩니다: “…” | 2 |
| 지문에 닫히지 않은 수식 기호 $ 가 있습니다. | 2 |
| 선택지가 로마숫자 조합인데 진술(statements)이 없습니다 — 진술 I, II, III 을 statements 에 적으세요. | 2 |
| 객관식은 선택지 N개(A~D)여야 합니다(지금 N개). | 2 |
| 지문은 rectangular prism 를 말하지만 도식의 kind 는 cylinder 입니다. | 2 |

## 전체 실패 목록

- linear_equations_one_var · [review] 미해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- linear_equations_one_var · [review] 미해소 — 독립 검사는 다른 답을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- linear_equations_one_var · [contract] 해소 — 지문의 수식을 조판할 수 없습니다: $\$ / 지문에 닫히지 않은 수식 기호 $ 가 있습니다.
- linear_equations_two_var · [contract] 미해소 — 지문의 좌표 (2, -1) 가 그림의 점이나 그래프 위에 없습니다. / 지문의 직선 'm' 가 그림에 없습니다(직선 객체의 label 로 두세요).
- linear_equations_two_var · [contract] 미해소 — 지문의 좌표 (2, -1) 가 그림의 점이나 그래프 위에 없습니다. / 지문의 직선 'm' 가 그림에 없습니다(직선 객체의 label 로 두세요).
- linear_equations_two_var · [contract] 미해소 — 선택지 1에 수식 기호($…$) 밖에 LaTeX 제어문이 있습니다 — 그대로 노출됩니다: "\frac{4}{3}x" / 선택지 2에 수식 기호($…$) 밖에 LaTeX 제어문이 있습니다 — 그대로 노출됩니다: "\frac{3}{4}x"
- linear_equations_two_var · [review] 미해소 — 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- linear_equations_two_var · [contract] 미해소 — 선택지는 값만 적습니다('x = 3' 이 아니라 '3').
- linear_equations_two_var · [contract] 미해소 — 점 P0 라벨 '(0, 5)' 가 선과 겹칩니다. / 점 X 라벨 '(2, 3)' 가 선과 겹칩니다.
- linear_equations_two_var · [contract] 미해소 — 자료 필수 문항입니다 — Linear equations in two variables 문항이 도형(figure)을 가리키므로 도형 자료가 필요합니다. '도형' 자료를 만들거나 그림을 올린 뒤 저장하세요. / 지문이 그림을 가리키는데("as shown", "figure") 그림이 없습니다
- linear_equations_two_var · [contract] 미해소 — 자료 필수 문항입니다 — Linear equations in two variables 문항이 도형(figure)을 가리키므로 도형 자료가 필요합니다. '도형' 자료를 만들거나 그림을 올린 뒤 저장하세요. / 지문의 좌표 (2, 5) 가 그림의 점이나 그래프 위에 없습니다.
- systems_linear · [review] 미해소 — 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- systems_linear · [contract] 미해소 — 선택지의 점 (3, 1) 이 그림에 찍혀 있습니다 — 선택지 좌표는 그림에 넣지 않습니다(정답 노출).
- systems_linear · [contract] 미해소 — 점 B 라벨 '(0, 3)' 를 겹치지 않게 놓을 자리가 없습니다 — 축 범위를 넓히거나 라벨을 줄이세요. / 선택지의 점 (0, 3) 이 그림에 찍혀 있습니다 — 선택지 좌표는 그림에 넣지 않습니다(정답 노출).
- systems_linear · [contract] 미해소 — 점 B 라벨 '(0, 3)' 를 겹치지 않게 놓을 자리가 없습니다 — 축 범위를 넓히거나 라벨을 줄이세요. / 선택지의 점 (0, 3) 이 그림에 찍혀 있습니다 — 선택지 좌표는 그림에 넣지 않습니다(정답 노출).
- systems_linear · [contract] 미해소 — 점 A 라벨 '(0, -2)' 가 선과 겹칩니다.
- systems_linear · [contract] 미해소 — 점 A 라벨 '(0, -2)' 가 선과 겹칩니다.
- systems_linear · [review] 미해소 — 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- systems_linear · [review] 미해소 — 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- linear_inequalities · [contract] 해소 — 지문에 배치 용어(region, northeast 등)가 있습니다 — 좌표·점 이름·직선 이름으로 부릅니다.
- linear_inequalities · [contract] 미해소 — 지문의 식 y = -1/2x + 3 과 같은 직선이 그림에 없습니다.
- linear_inequalities · [contract] 미해소 — 지문에 배치 용어(region, northeast 등)가 있습니다 — 좌표·점 이름·직선 이름으로 부릅니다.
- linear_inequalities · [contract] 미해소 — 점 D 라벨 '(2, 2)' 를 겹치지 않게 놓을 자리가 없습니다 — 축 범위를 넓히거나 라벨을 줄이세요. / 점 A 라벨 '(0, 4)' 가 선과 겹칩니다.
- linear_inequalities · [contract] 미해소 — 지문에 배치 용어(region, northeast 등)가 있습니다 — 좌표·점 이름·직선 이름으로 부릅니다.
- linear_inequalities · [contract] 미해소 — 선택지 1에 수식 기호($…$) 밖에 LaTeX 제어문이 있습니다 — 그대로 노출됩니다: "\ge" / 선택지 2에 수식 기호($…$) 밖에 LaTeX 제어문이 있습니다 — 그대로 노출됩니다: "\le"
- linear_inequalities · [contract] 미해소 — 지문에 배치 용어(region, northeast 등)가 있습니다 — 좌표·점 이름·직선 이름으로 부릅니다.
- linear_inequalities · [contract] 미해소 — 점 P4 라벨 '(4, -1)' 가 선과 겹칩니다.
- linear_inequalities · [review] 미해소 — 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- equivalent_expressions · [review] 미해소 — 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- equivalent_expressions · [review] 미해소 — 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- equivalent_expressions · [contract] 미해소 — 선택지 3에 수식 기호($…$) 밖에 LaTeX 제어문이 있습니다 — 그대로 노출됩니다: "\dfrac{2}{x-2}"
- equivalent_expressions · [review] 미해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- equivalent_expressions · [review] 미해소 — 독립 검사는 D)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- equivalent_expressions · [review] 미해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- equivalent_expressions · [review] 해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- equivalent_expressions · [review] 미해소 — 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- equivalent_expressions · [review] 미해소 — 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- nonlinear_equations_systems · [contract] 미해소 — 점 Q 라벨 '(3, 3)' 가 선과 겹칩니다.
- nonlinear_equations_systems · [contract] 미해소 — 점 Q 라벨 '(4, -3)' 가 선과 겹칩니다.
- nonlinear_functions · [review] 해소 — 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- nonlinear_functions · [review] 미해소 — 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- nonlinear_functions · [review] 미해소 — 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- percentages · [contract] 미해소 — 지문은 'February' 의 'Price (dollars)' 를 25 로 말하지만 표의 값은 100 입니다. / 지문은 'February' 의 'Price (dollars)' 를 20 로 말하지만 표의 값은 100 입니다.
- percentages · [contract] 미해소 — 지문에 닫히지 않은 수식 기호 $ 가 있습니다. / 해설에 수식 기호($…$) 밖에 LaTeX 제어문이 있습니다 — 그대로 노출됩니다: "\times"
- percentages · [contract] 미해소 — 지문은 'Original' 의 'Price (dollars)' 를 1 로 말하지만 표의 값은 80 입니다. / 지문은 'Stage 1' 의 'Price (dollars)' 를 2 로 말하지만 표의 값은 60 입니다.
- percentages · [contract] 미해소 — 지문에 닫히지 않은 수식 기호 $ 가 있습니다. / 해설에 수식 기호($…$) 밖에 LaTeX 제어문이 있습니다 — 그대로 노출됩니다: "\times"
- percentages · [contract] 미해소 — 지문에 닫히지 않은 수식 기호 $ 가 있습니다.
- percentages · [contract] 미해소 — 지문에 닫히지 않은 수식 기호 $ 가 있습니다.
- percentages · [contract] 미해소 — 지문은 'Week 2'(Reported Flu Cases) 값을 3 로 말하지만 그래프의 값은 240 입니다.
- percentages · [review] 미해소 — 독립 검사는 다른 답을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- one_variable_data · [contract] 미해소 — 선택지가 로마숫자 조합인데 진술(statements)이 없습니다 — 진술 I, II, III 을 statements 에 적으세요.
- one_variable_data · [review] 미해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- one_variable_data · [contract] 미해소 — 선택지가 로마숫자 조합인데 진술(statements)이 없습니다 — 진술 I, II, III 을 statements 에 적으세요.
- one_variable_data · [review] 미해소 — 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- one_variable_data · [review] 해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- one_variable_data · [review] 해소 — 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 독립 검사 지적: 문제에서 '차이'가 부호 있는 값(양수/음수)인지 절댓값인지 명확히 하지 않으면 정답이 모호해질 수 있음. 부호 있는 편차로 계산하면 range=3-(-5
- two_variable_data · [review] 해소 — 오답 B), C)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- two_variable_data · [review] 미해소 — 오답 D)이 지문·자료와 무관합니다
- two_variable_data · [review] 미해소 — 오답 D)이 지문·자료와 무관합니다
- two_variable_data · [contract] 미해소 — 자료 필수 문항입니다 — Two-variable data: models and scatterplots 문항이 자료(scatterplot)를 읽어야 풀 수 있으므로 표·그래프 자료가 필요합니다. '표·그래프' 자료를 만들거나 그림을 올린 뒤 저장하세요.
- two_variable_data · [contract] 미해소 — 선택지 1에 닫히지 않은 수식 기호 $ 가 있습니다. / 선택지 2에 닫히지 않은 수식 기호 $ 가 있습니다.
- evaluating_statistical_claims · [review] 미해소 — 오답 C)이 지문·자료와 무관합니다
- evaluating_statistical_claims · [review] 미해소 — 오답 C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- evaluating_statistical_claims · [review] 미해소 — 오답 C)이 지문·자료와 무관합니다
- evaluating_statistical_claims · [review] 미해소 — 오답 C)이 지문·자료와 무관합니다 / 오답 B), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다 / 독립 검사 지적: 자료 설명이 '삼각형 ABC'로 되어 있으나 실제 지문 내용(막대그래프/퍼센트 요약)과 불일치함 - 렌더링 오류로 보임
- evaluating_statistical_claims · [review] 미해소 — 오답 C)이 지문·자료와 무관합니다
- evaluating_statistical_claims · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개).
- evaluating_statistical_claims · [review] 미해소 — 오답 B), C)이 지문·자료와 무관합니다 / 오답 B), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- evaluating_statistical_claims · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개).
- area_volume · [contract] 미해소 — 지문은 rectangular prism 를 말하지만 도식의 kind 는 cylinder 입니다.
- area_volume · [contract] 미해소 — 지문은 rectangular prism 를 말하지만 도식의 kind 는 cylinder 입니다.
- area_volume · [review] 미해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- area_volume · [review] 미해소 — 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- area_volume · [contract] 미해소 — 지문은 cone 를 말하지만 도식의 kind 는 cylinder 입니다.
- area_volume · [contract] 미해소 — 지문은 cone 를 말하지만 도식의 kind 는 cylinder 입니다.
- area_volume · [review] 해소 — 오답 C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- area_volume · [contract] 미해소 — 지문은 cone 를 말하지만 도식의 kind 는 cylinder 입니다. / 지문은 높이 5 인데 도식 라벨은 '10' 입니다.
- area_volume · [contract] 미해소 — 지문은 cone 를 말하지만 도식의 kind 는 cylinder 입니다. / 지문은 높이 5 인데 도식 라벨은 '10' 입니다.
- lines_angles_triangles · [contract] 미해소 — 자료 필수 문항입니다 — Lines, angles, and triangles 문항이 도형(figure)을 가리키므로 도형 자료가 필요합니다. '도형' 자료를 만들거나 그림을 올린 뒤 저장하세요. / 지문이 그림을 가리키는데("as shown", "figure") 그림이 없습니다.
- lines_angles_triangles · [review] 미해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- lines_angles_triangles · [contract] 미해소 — 자료 필수 문항입니다 — 각·평행선·삼각형 문항은 도형 없이 성립하지 않습니다. 도형 자료가 필요합니다. '도형' 자료를 만들거나 그림을 올린 뒤 저장하세요.
- lines_angles_triangles · [contract] 미해소 — 변 라벨(AB) 'AD = 4, DB = 6' 가 그림 밖으로 나갑니다. / 점 이름 'A' 가 중복됩니다(두 삼각형은 서로 다른 이름을 씁니다).
- lines_angles_triangles · [contract] 미해소 — 지문의 삼각형 DEF 의 점 'D' 가 도형 데이터에 없습니다. / 지문의 삼각형 DEF 의 점 'E' 가 도형 데이터에 없습니다.
- lines_angles_triangles · [contract] 미해소 — 자료 필수 문항입니다 — 각·평행선·삼각형 문항은 도형 없이 성립하지 않습니다. 도형 자료가 필요합니다. '도형' 자료를 만들거나 그림을 올린 뒤 저장하세요.
- right_triangles_trigonometry · [review] 해소 — 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- circles · [contract] 미해소 — 중심각 라벨(AB) '80°' 가 '9' 와 겹칩니다.
- circles · [contract] 미해소 — 중심각 라벨(AB) '80°' 가 '9' 와 겹칩니다.
- circles · [review] 미해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- circles · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 0개). / 정답 자리가 선택지 범위 안에 없습니다.
- circles · [contract] 미해소 — 현 라벨 'AC' 을 겹치지 않게 놓을 자리가 없습니다.
- circles · [review] 미해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- circles · [review] 해소 — 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 오답 C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- central_ideas_details · [review] 미해소 — 오답 A), C)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- central_ideas_details · [review] 미해소 — 오답 A), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- central_ideas_details · [review] 해소 — 오답 A)이 지문·자료와 무관합니다
- central_ideas_details · [review] 미해소 — 오답 C)이 지문·자료와 무관합니다
- central_ideas_details · [review] 미해소 — 오답 C)이 지문·자료와 무관합니다 / 오답 A), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- central_ideas_details · [review] 해소 — 오답 A)이 지문·자료와 무관합니다 / 오답 A), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- inferences · [contract] 미해소 — 빈칸(______)은 정확히 하나여야 합니다(지금 0개).
- inferences · [review] 미해소 — 오답 D)이 지문·자료와 무관합니다 / 오답 A), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- inferences · [review] 미해소 — 오답 C)이 지문·자료와 무관합니다 / 오답 A), C)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- inferences · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- inferences · [review] 미해소 — 오답 A), C)이 지문·자료와 무관합니다 / 오답 A), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- inferences · [review] 미해소 — 오답 A), C)이 지문·자료와 무관합니다 / 오답 A), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- inferences · [contract] 미해소 — 자료 필수 문항입니다 — Inferences 문항이 자료(frequency)를 읽어야 풀 수 있으므로 표·그래프 자료가 필요합니다. '표·그래프' 자료를 만들거나 그림을 올린 뒤 저장하세요. / 빈칸(______)은 정확히 하나여야 합니다(지금 0개).
- inferences · [review] 미해소 — 오답 C)이 지문·자료와 무관합니다 / 오답 B), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- inferences · [review] 미해소 — 오답 C)이 지문·자료와 무관합니다 / 오답 B), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- inferences · [review] 미해소 — 오답 C)이 지문·자료와 무관합니다 / 오답 B), C)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- inferences · [review] 미해소 — 오답 D)이 지문·자료와 무관합니다 / 오답 B), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- inferences · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- command_of_evidence_text · [review] 미해소 — 오답 C), D)이 지문·자료와 무관합니다 / 오답 C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- command_of_evidence_text · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- command_of_evidence_text · [review] 미해소 — 오답 B), D)이 지문·자료와 무관합니다 / 오답 B), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- command_of_evidence_text · [review] 미해소 — 오답 C), D)이 지문·자료와 무관합니다 / 오답 B), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- command_of_evidence_text · [review] 미해소 — 오답 B), C), D)이 지문·자료와 무관합니다 / 오답 B), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- command_of_evidence_text · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- command_of_evidence_text · [review] 미해소 — 오답 C), D)이 지문·자료와 무관합니다 / 오답 A), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- command_of_evidence_text · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- command_of_evidence_text · [review] 미해소 — 오답 C), D)이 지문·자료와 무관합니다 / 오답 C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- command_of_evidence_text · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 6개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 6개).
- command_of_evidence_text · [review] 미해소 — 오답 C)이 지문·자료와 무관합니다 / 독립 검사 지적: 질문에서 이미 Evidence B의 결과(Main Street 매출 증가, 도시 전체는 변화 없음)를 제시하고 이것이 어떤 증거를 지지하는지 묻는데, 이는 사실상 정답을 질문 안에 노출시킨 것과 다름없어 문제가 지나치게 쉬워짐(C
- command_of_evidence_text · [contract] 미해소 — 정답 선택지 문장이 지문에 그대로 들어 있습니다 — 정답 노출.
- command_of_evidence_quant · [review] 미해소 — 오답 A), B), C)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- command_of_evidence_quant · [review] 미해소 — 오답 A), B), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- command_of_evidence_quant · [review] 해소 — 오답 A), C)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- command_of_evidence_quant · [contract] 해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- words_in_context · [review] 미해소 — 오답 D)이 지문·자료와 무관합니다 / 오답 C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- words_in_context · [review] 미해소 — 오답 D)이 지문·자료와 무관합니다 / 오답 B), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- words_in_context · [review] 해소 — 오답 C)이 지문·자료와 무관합니다 / 오답 B), C)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- words_in_context · [review] 해소 — 오답 D)이 지문·자료와 무관합니다 / 오답 A), C)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- words_in_context · [review] 미해소 — 오답 A), C)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- words_in_context · [review] 미해소 — 오답 C)이 지문·자료와 무관합니다 / 오답 A), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- words_in_context · [review] 해소 — 오답 C)이 지문·자료와 무관합니다 / 오답 A), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- text_structure_purpose · [review] 미해소 — 오답 B)이 지문·자료와 무관합니다 / 오답 B), C)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- text_structure_purpose · [review] 미해소 — 오답 B)이 지문·자료와 무관합니다
- text_structure_purpose · [review] 미해소 — 오답 B), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- text_structure_purpose · [review] 미해소 — 오답 C)이 지문·자료와 무관합니다 / 오답 C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- text_structure_purpose · [review] 미해소 — 오답 C)이 지문·자료와 무관합니다 / 오답 B), C)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- text_structure_purpose · [review] 미해소 — 오답 B), C)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- text_structure_purpose · [review] 미해소 — 오답 A)이 지문·자료와 무관합니다
- text_structure_purpose · [review] 미해소 — 오답 A)이 지문·자료와 무관합니다
- text_structure_purpose · [review] 미해소 — 오답 D)이 지문·자료와 무관합니다
- text_structure_purpose · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- cross_text_connections · [review] 미해소 — 오답 C)이 지문·자료와 무관합니다
- cross_text_connections · [review] 미해소 — 오답 B), D)이 지문·자료와 무관합니다 / 오답 B), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- cross_text_connections · [review] 미해소 — 오답 A), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- cross_text_connections · [review] 미해소 — 오답 A)이 지문·자료와 무관합니다 / 오답 A), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- cross_text_connections · [review] 미해소 — 오답 C)이 지문·자료와 무관합니다
- cross_text_connections · [review] 미해소 — 오답 D)이 지문·자료와 무관합니다 / 오답 A), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- cross_text_connections · [review] 미해소 — 오답 D)이 지문·자료와 무관합니다 / 오답 C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- cross_text_connections · [review] 미해소 — 오답 B), C)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- cross_text_connections · [review] 미해소 — 오답 D)이 지문·자료와 무관합니다 / 오답 C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- cross_text_connections · [review] 미해소 — 오답 B), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- rhetorical_synthesis · [review] 미해소 — 오답 C), D)이 지문·자료와 무관합니다 / 오답 A), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- rhetorical_synthesis · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- rhetorical_synthesis · [review] 미해소 — 오답 C)이 지문·자료와 무관합니다
- rhetorical_synthesis · [review] 미해소 — 오답 A), D)이 지문·자료와 무관합니다 / 오답 A), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- rhetorical_synthesis · [review] 미해소 — 오답 A), C)이 지문·자료와 무관합니다 / 오답 A), C)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- rhetorical_synthesis · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- rhetorical_synthesis · [review] 미해소 — 오답 C)이 지문·자료와 무관합니다 / 오답 A), C)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- rhetorical_synthesis · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- rhetorical_synthesis · [review] 미해소 — 오답 C), D)이 지문·자료와 무관합니다 / 오답 B), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- rhetorical_synthesis · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- transitions · [review] 해소 — 독립 검사는 D)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 오답 C)이 지문·자료와 무관합니다 / 오답 B), C)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- boundaries · [contract] 미해소 — 빈칸(______)은 정확히 하나여야 합니다(지금 0개).
- boundaries · [review] 미해소 — 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 오답 B), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- boundaries · [contract] 미해소 — 빈칸(______)은 정확히 하나여야 합니다(지금 0개).
- boundaries · [review] 미해소 — 오답 C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
- boundaries · [review] 해소 — 오답 B), C), D)이 너무 명백해 정답을 쉽게 고를 수 있습니다
