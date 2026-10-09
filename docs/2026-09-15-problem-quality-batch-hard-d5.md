# 유형별 표본 생성·품질 계약 검증 — 난이도 hard, 유형당 10문항 (2026-09-16 00:36)

파이프라인: 생성 → 자료 → 유형별 품질 계약 → 독립 검사 → (오답만 걸리면) 자리별 구조화 계획·생성·결정적 검사(자리당 최대 2회) → 통과 시 채택, 지문·질문·정답·계약·독립검사 통과 + 잔여 오답 실패 1~2건이면 보강 대기, 그 외 폐기. 대기 상한은 요청 수. 총 소요 134분.

**요청 60개(유형당 10) → 후보 117개 평가**

| 지표 | 값 |
|---|---|
| 첫 생성 통과율(보정 0회) | 13/117 = 11% |
| 자동 보정 뒤 최종 통과율 | 38/60 = 63% |
| 보강 대기 전환율 | 36/60 = 60% (목표 ≤10%) |
| 대기 한도 초과 폐기 | 24 |
| 오답 자리별 보정 시도(해소) | 192(7) |
| 필드 부분 수정 시도(해소) | 34(33) |
| 문항 전체 재생성(해소) | 61(23) |
| 빈 응답 이벤트 | 5 |
| 문항당 평균 모델 호출 | 11.48 |

## 유형별

| 세부 기술 | 체계·형식 | 요청 | 후보 | 첫통과 | 최종통과 | 통과율 | 대기(초과폐기) | 빈응답 | 부족반환 | 미해소 실패 사유 | 초 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Linear functions (`linear_functions`) | sat_math · mc | 10 | 20 | 3 | 7 | 70% | 0(0) | 0 | 3 | [contract] 지문의 직선 'n' 가 그림에 없습니다(직선 객체의 label 로 두세요).<br>[contract] 점 C 라벨 '(-2, 5)' 가 선과 겹칩니다. / 지문의 직선 'n' 가 그림에 없습니다(직선 객체의 l<br>[contract] 점 B1 라벨 '(-2, 5)' 가 선과 겹칩니다. / 지문의 직선 'n' 가 그림에 없습니다(직선 객체의  | 1060 |
| Lines, angles, and triangles (`lines_angles_triangles`) | sat_math · mc | 10 | 16 | 5 | 10 | 100% | 0(0) | 1 | 1 | [contract] 높이 발 이름 'D' 가 각 표시와 겹칩니다. / 높이 발 이름 'D' 가 선과 겹칩니다.<br>[contract] 높이 발 이름 'E' 가 각 표시와 겹칩니다. / 높이 발 이름 'E' 가 선과 겹칩니다.<br>[contract] 높이 발 이름 'D' 가 각 표시와 겹칩니다. / 높이 발 이름 'D' 가 선과 겹칩니다. | 923 |
| Central Ideas and Details (`central_ideas_details`) | sat_rw · mc | 10 | 18 | 2 | 7 | 70% | 10(1) | 1 | 1 | — | 1213 |
| Inferences (`inferences`) | sat_rw · mc | 10 | 27 | 3 | 4 | 40% | 10(13) | 0 | 1 | — | 1850 |
| Command of Evidence (Textual) (`command_of_evidence_text`) | sat_rw · mc | 10 | 15 | 0 | 9 | 90% | 6(0) | 0 | 1 | — | 902 |
| Cross-Text Connections (`cross_text_connections`) | sat_rw · mc | 10 | 21 | 0 | 1 | 10% | 10(10) | 3 | 1 | — | 2088 |

## 70% 미달 유형

- Inferences (`inferences`): 4/10 — 이 유형만 오답 설계 예시·오류 분류 보강 후 재검증 필요.
- Cross-Text Connections (`cross_text_connections`): 1/10 — 이 유형만 오답 설계 예시·오류 분류 보강 후 재검증 필요.

## 빈 응답 이벤트(원인·재시도 결과)

| 유형 | 원인 | 재시도 | 해소 |
|---|---|---|---|
| lines_angles_triangles | 생성 청크(1개 요청) 예외: AI 응답에 문제가 없습니다. | 아니오 | 아니오 |
| central_ideas_details | 생성 청크(3개 요청) 예외: AI 응답에 문제가 없습니다. | 아니오 | 아니오 |
| cross_text_connections | 생성 청크(3개 요청) 예외: AI 응답에 문제가 없습니다. | 아니오 | 아니오 |
| cross_text_connections | 생성 청크(3개 요청) 예외: AI 응답에 문제가 없습니다. | 아니오 | 아니오 |
| cross_text_connections | 생성 청크(3개 요청) 예외: AI 응답에 문제가 없습니다. | 아니오 | 아니오 |

## 요청보다 적게 반환된 경우(유형·사유)

| 요청 | 반환 | 사유 |
|---|---|---|
| 3 | 1 | linear_functions: 생성 청크가 요청보다 적게 반환 |
| 3 | 1 | linear_functions: 생성 청크가 요청보다 적게 반환 |
| 10 | 7 | linear_functions: 게이트 통과분이 요청 수 미달 |
| 3 | 1 | lines_angles_triangles: 생성 청크가 요청보다 적게 반환 |
| 10 | 7 | central_ideas_details: 게이트 통과분이 요청 수 미달 |
| 10 | 4 | inferences: 게이트 통과분이 요청 수 미달 |
| 10 | 9 | command_of_evidence_text: 게이트 통과분이 요청 수 미달 |
| 10 | 1 | cross_text_connections: 게이트 통과분이 요청 수 미달 |

## 실행 조건 표본(주제·문항 첫머리 — 같은 프롬프트 반복 여부 확인용)

- linear_functions: What is the value of $k$?… | At what time $t$, in minutes, do the two tanks contain the s… | For what value of $x$ does $f(x) = g(x)$?… | The system of equations formed by lines $\ell$ and $m$ has s… | Let $y = f(x)$ represent the total charge, in dollars, for t… | For which value of $x$ does $f(x) - g(x) = 8$?… | What is the $x$-intercept of the graph of $y = h(x) + 2x - 1…
- lines_angles_triangles: What is the measure of the angle marked $x^\circ$ at point $… | What is the measure of the angle at $C$ in triangle $ABC$?… | What is the value of $y$?… | What is the value of $x$?… | What is the value of $x$?… | What is the length of $EF$?… | What is the value of $x$?… | What is the value of $y$?… | What is the value of $x$?… | What is the length of $DF$?…
- central_ideas_details: According to the text, why did some Hanseatic kontors expand… | Which choice best states the main idea of the text?… | Which choice best states the main idea of the text?… | Which choice best states the main idea of the text?… | According to the text, what did the recent comparative study… | Which choice best states the main idea of the text?… | According to the text, in which situation did employment dec…
- inferences: Which choice most logically completes the text?… | Which choice most logically completes the text?… | Which choice most logically completes the text?… | Which choice most logically completes the text?…
- command_of_evidence_text: Which finding, if true, would most directly support the rese… | Which quotation, if added to the passage, would most effecti… | Which finding, if true, would most directly support the rese… | Which quotation from a contemporary source would most effect… | Which finding, if true, would most directly support the econ… | Which quotation from a contemporary factory inspector's repo… | Which finding, if true, would most directly support the advo… | Which finding, if true, would most directly support Cho's co… | Which finding, if true, would most directly support the rese…
- cross_text_connections: Based on the texts, how would the author of Text 2 most like…

## 실패 단계별

| 단계 | 건수 | 해소 |
|---|---|---|
| contract | 48 | 4 |
| review | 32 | 19 |

## 반복되는 실패 사유(상위)

| 사유(숫자·인용 일반화) | 건수 |
|---|---|
| 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) | 7 |
| 자료 필수 문항입니다 — Lines, angles, and triangles 문항이 도형(figure)을 가리키므로 도형 자료가 필요합니다. '도형' 자료를 만들 | 6 |
| 지문의 직선 'm' 가 그림에 없습니다(직선 객체의 label 로 두세요). | 4 |
| 각 라벨(B) '(Nx+N)°' 가 '(Nx+N)°' 와 겹칩니다. / 각 라벨(C) '(Nx-N)°' 가 '(Nx+N)°' 와 겹칩니다. | 3 |
| 지문의 직선 'n' 가 그림에 없습니다(직선 객체의 label 로 두세요). | 2 |
| 점 BN 라벨 '(-N, N)' 가 선과 겹칩니다. / 지문의 직선 'n' 가 그림에 없습니다(직선 객체의 label 로 두세요). | 2 |
| 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) | 2 |
| 지문의 좌표 (N, N) 가 그림의 점이나 그래프 위에 없습니다. / 지문의 직선 'k' 가 그림에 없습니다(직선 객체의 label 로 두세요). | 2 |
| 직선 lN 라벨 'Nx + Ny = N' 가 선과 겹칩니다. | 2 |
| 지문의 좌표 (N, -N) 가 그림의 점이나 그래프 위에 없습니다. / 지문의 직선 'q' 가 그림에 없습니다(직선 객체의 label 로 두세요). | 2 |
| 점 A 라벨 '(N, N)' 가 선과 겹칩니다. / 지문의 직선 'k' 가 그림에 없습니다(직선 객체의 label 로 두세요). | 2 |
| 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 어려움 문제인데 오답 A)이 너무 명백합니다 | 2 |
| 높이 발 이름 'D' 가 각 표시와 겹칩니다. / 높이 발 이름 'D' 가 선과 겹칩니다. | 2 |
| 어려움 문제인데 오답 A), B), D)이 너무 명백합니다 | 2 |
| 어려움 문제인데 오답 A), C), D)이 너무 명백합니다 | 2 |
| 어려움 문제인데 오답 B), C), D)이 너무 명백합니다 | 2 |
| 점 C 라벨 '(-N, N)' 가 선과 겹칩니다. / 지문의 직선 'n' 가 그림에 없습니다(직선 객체의 label 로 두세요). | 1 |
| 지문의 직선 'm' 가 그림에 없습니다(직선 객체의 label 로 두세요). / 해설의 수식을 조판할 수 없습니다: $m_\\ell = \\dfrac{-N-N}{ | 1 |
| 점 A 라벨 '(-N, N)' 가 선과 겹칩니다. / 점 B 라벨 '(N, -N)' 가 선과 겹칩니다. | 1 |
| 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 독립 검사 지적: 설계상 정답 계산이 N-Nt= | 1 |
| 지문의 함수 g(x) 에 해당하는 그래프 라벨이 없습니다(label 을 'g' 또는 'y = g(x)' 로). | 1 |
| 지문의 함수 f(x) 에 해당하는 그래프 라벨이 없습니다(label 을 'f' 또는 'y = f(x)' 로). / 지문의 함수 g(x) 에 해당하는 그래프 라벨이 | 1 |
| 점 A 라벨 '(N, N)' 가 선과 겹칩니다. / 지문의 함수 g(x) 에 해당하는 그래프 라벨이 없습니다(label 을 'g' 또는 'y = g(x)' 로). | 1 |
| 점 A 라벨 '(N, N)' 가 선과 겹칩니다. / 지문의 직선 'm' 가 그림에 없습니다(직선 객체의 label 로 두세요). | 1 |
| 지문의 좌표 (-N, N) 가 그림의 점이나 그래프 위에 없습니다. / 지문의 좌표 (N, N) 가 그림의 점이나 그래프 위에 없습니다. | 1 |

## 전체 실패 목록

- linear_functions · [contract] 미해소 — 지문의 직선 'n' 가 그림에 없습니다(직선 객체의 label 로 두세요).
- linear_functions · [contract] 미해소 — 점 C 라벨 '(-2, 5)' 가 선과 겹칩니다. / 지문의 직선 'n' 가 그림에 없습니다(직선 객체의 label 로 두세요).
- linear_functions · [contract] 미해소 — 점 B1 라벨 '(-2, 5)' 가 선과 겹칩니다. / 지문의 직선 'n' 가 그림에 없습니다(직선 객체의 label 로 두세요).
- linear_functions · [contract] 미해소 — 지문의 직선 'm' 가 그림에 없습니다(직선 객체의 label 로 두세요).
- linear_functions · [contract] 미해소 — 지문의 직선 'm' 가 그림에 없습니다(직선 객체의 label 로 두세요). / 해설의 수식을 조판할 수 없습니다: $m_\\ell = \\dfrac{-3-6}{2-(-4)} = \\dfrac{-9}{6} = -\\dfrac
- linear_functions · [contract] 미해소 — 점 A 라벨 '(-4, 6)' 가 선과 겹칩니다. / 점 B 라벨 '(2, -3)' 가 선과 겹칩니다.
- linear_functions · [review] 해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 독립 검사 지적: 설계상 정답 계산이 60-3t=80-6t → 3t=20 → t=20/3(약 6.67)로 나와 선택지(8,10,12,16) 중 어느 것과도 일치하지 않음. 
- linear_functions · [contract] 미해소 — 지문의 함수 g(x) 에 해당하는 그래프 라벨이 없습니다(label 을 'g' 또는 'y = g(x)' 로).
- linear_functions · [contract] 미해소 — 지문의 함수 f(x) 에 해당하는 그래프 라벨이 없습니다(label 을 'f' 또는 'y = f(x)' 로). / 지문의 함수 g(x) 에 해당하는 그래프 라벨이 없습니다(label 을 'g' 또는 'y = g(x)' 로).
- linear_functions · [contract] 미해소 — 점 A 라벨 '(0, 1)' 가 선과 겹칩니다. / 지문의 함수 g(x) 에 해당하는 그래프 라벨이 없습니다(label 을 'g' 또는 'y = g(x)' 로).
- linear_functions · [contract] 미해소 — 점 A 라벨 '(0, 3)' 가 선과 겹칩니다. / 지문의 직선 'm' 가 그림에 없습니다(직선 객체의 label 로 두세요).
- linear_functions · [contract] 미해소 — 지문의 직선 'm' 가 그림에 없습니다(직선 객체의 label 로 두세요).
- linear_functions · [contract] 미해소 — 지문의 직선 'm' 가 그림에 없습니다(직선 객체의 label 로 두세요).
- linear_functions · [contract] 미해소 — 지문의 좌표 (-2, 5) 가 그림의 점이나 그래프 위에 없습니다. / 지문의 좌표 (4, 1) 가 그림의 점이나 그래프 위에 없습니다.
- linear_functions · [contract] 미해소 — 지문의 직선 'n' 가 그림에 없습니다(직선 객체의 label 로 두세요).
- linear_functions · [contract] 미해소 — 점 B1 라벨 '(-2, 5)' 가 선과 겹칩니다. / 지문의 직선 'n' 가 그림에 없습니다(직선 객체의 label 로 두세요).
- linear_functions · [review] 미해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- linear_functions · [review] 미해소 — 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- linear_functions · [review] 미해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 독립 검사 지적: 생성기 설계에서 언급한 좌표(40,-800),(160,4000)는 실제 자료의 좌표(20,-800),(60,1600)와 다름 — 설계 설명이 실제 문항과 
- linear_functions · [contract] 미해소 — 점 B 라벨 '(4, -2)' 가 선과 겹칩니다. / 지문의 좌표 (2, 8) 가 그림의 점이나 그래프 위에 없습니다.
- linear_functions · [contract] 미해소 — 지문의 좌표 (2, 8) 가 그림의 점이나 그래프 위에 없습니다. / 지문의 직선 'k' 가 그림에 없습니다(직선 객체의 label 로 두세요).
- linear_functions · [contract] 미해소 — 지문의 좌표 (2, 8) 가 그림의 점이나 그래프 위에 없습니다. / 지문의 직선 'k' 가 그림에 없습니다(직선 객체의 label 로 두세요).
- linear_functions · [review] 해소 — 독립 검사는 다른 답을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 독립 검사 지적: 생성기 설계에서는 g(x)=15x+40, 목표값 30이라고 되어 있으나 질문 본문에는 목표값이 10으로 되어 있어 설계와 문항이 불일치함 / 독립 검사
- linear_functions · [review] 해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- linear_functions · [review] 해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- linear_functions · [review] 해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 독립 검사 지적: 정답 계산 결과 x=2가 나오는데, 선택지 A)4/3, B)-1, C)1, D)4 중 어디에도 2가 없음 - 선택지와 정답이 불일치함
- linear_functions · [contract] 미해소 — 직선 l2 라벨 '12x + 9y = 105' 가 선과 겹칩니다.
- linear_functions · [contract] 미해소 — 직선 l2 라벨 '12x + 9y = 105' 가 선과 겹칩니다.
- linear_functions · [review] 미해소 — 독립 검사는 다른 답을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 어려움으로 요청했지만 독립 검사 추정 난이도가 easy 입니다 — 핵심 관계를 종합해야 풀리는 문항으로
- linear_functions · [contract] 미해소 — 점 A 라벨 '(0, 2)' 가 선과 겹칩니다. / 지문의 좌표 (-4, -2) 가 그림의 점이나 그래프 위에 없습니다.
- linear_functions · [contract] 미해소 — 지문의 좌표 (-4, -2) 가 그림의 점이나 그래프 위에 없습니다. / 지문의 좌표 (2, 7) 가 그림의 점이나 그래프 위에 없습니다.
- linear_functions · [contract] 미해소 — 지문의 직선 'm' 가 그림에 없습니다(직선 객체의 label 로 두세요).
- linear_functions · [review] 미해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- linear_functions · [review] 미해소 — 독립 검사는 D)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 어려움 문제인데 오답 A)이 너무 명백합니다
- linear_functions · [review] 미해소 — 독립 검사 지적: 생성기가 제시한 정답 근거(g: y=x+1)와 계산 결과(x=1.5)가 불일치하며, 이는 선택지(A~D) 중 어느 것과도 맞지 않음
- linear_functions · [contract] 미해소 — 지문의 좌표 (6, -3) 가 그림의 점이나 그래프 위에 없습니다. / 지문의 직선 'q' 가 그림에 없습니다(직선 객체의 label 로 두세요).
- linear_functions · [contract] 미해소 — 지문의 좌표 (6, -3) 가 그림의 점이나 그래프 위에 없습니다. / 지문의 직선 'q' 가 그림에 없습니다(직선 객체의 label 로 두세요).
- linear_functions · [contract] 미해소 — 지문의 직선 'q' 가 그림에 없습니다(직선 객체의 label 로 두세요).
- linear_functions · [contract] 미해소 — 점 A 라벨 '(0, 4)' 가 선과 겹칩니다. / 지문의 직선 'k' 가 그림에 없습니다(직선 객체의 label 로 두세요).
- linear_functions · [contract] 미해소 — 점 A 라벨 '(0, 4)' 가 선과 겹칩니다. / 지문의 직선 'k' 가 그림에 없습니다(직선 객체의 label 로 두세요).
- linear_functions · [contract] 미해소 — 지문의 좌표 (6, -2) 가 그림의 점이나 그래프 위에 없습니다. / 지문의 직선 'k' 가 그림에 없습니다(직선 객체의 label 로 두세요).
- linear_functions · [review] 미해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 어려움 문제인데 오답 A)이 너무 명백합니다
- linear_functions · [review] 미해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- linear_functions · [review] 미해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 어려움으로 요청했지만 독립 검사 추정 난이도가 easy 입니다 — 핵심 관계를 종합해야 풀리는 문항으로
- lines_angles_triangles · [contract] 미해소 — 높이 발 이름 'D' 가 각 표시와 겹칩니다. / 높이 발 이름 'D' 가 선과 겹칩니다.
- lines_angles_triangles · [contract] 미해소 — 높이 발 이름 'E' 가 각 표시와 겹칩니다. / 높이 발 이름 'E' 가 선과 겹칩니다.
- lines_angles_triangles · [contract] 미해소 — 높이 발 이름 'D' 가 각 표시와 겹칩니다. / 높이 발 이름 'D' 가 선과 겹칩니다.
- lines_angles_triangles · [review] 해소 — 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- lines_angles_triangles · [contract] 해소 — 자료 필수 문항입니다 — Lines, angles, and triangles 문항이 도형(figure)을 가리키므로 도형 자료가 필요합니다. '도형' 자료를 만들거나 그림을 올린 뒤 저장하세요. / 지문이 그림을 가리키는데("as shown", "figure") 그림이 없습니다.
- lines_angles_triangles · [contract] 해소 — 자료 필수 문항입니다 — Lines, angles, and triangles 문항이 도형(figure)을 가리키므로 도형 자료가 필요합니다. '도형' 자료를 만들거나 그림을 올린 뒤 저장하세요. / 지문이 그림을 가리키는데("as shown", "figure") 그림이 없습니다.
- lines_angles_triangles · [contract] 미해소 — 꼭짓점 이름(D) 'D' 가 그림 밖으로 나갑니다.
- lines_angles_triangles · [contract] 미해소 — 지문의 삼각형 DEF 의 점 'D' 가 도형 데이터에 없습니다. / 지문의 삼각형 DEF 의 점 'E' 가 도형 데이터에 없습니다.
- lines_angles_triangles · [review] 미해소 — 독립 검사는 D)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- lines_angles_triangles · [contract] 미해소 — 자료 필수 문항입니다 — Lines, angles, and triangles 문항이 도형(figure)을 가리키므로 도형 자료가 필요합니다. '도형' 자료를 만들거나 그림을 올린 뒤 저장하세요. / 지문이 그림을 가리키는데("as shown", "figure") 그림이 없습니다.
- lines_angles_triangles · [contract] 미해소 — 자료 필수 문항입니다 — Lines, angles, and triangles 문항이 도형(figure)을 가리키므로 도형 자료가 필요합니다. '도형' 자료를 만들거나 그림을 올린 뒤 저장하세요. / 지문이 그림을 가리키는데("as shown", "figure") 그림이 없습니다.
- lines_angles_triangles · [contract] 미해소 — 자료 필수 문항입니다 — Lines, angles, and triangles 문항이 도형(figure)을 가리키므로 도형 자료가 필요합니다. '도형' 자료를 만들거나 그림을 올린 뒤 저장하세요. / 지문이 그림을 가리키는데("as shown", "figure") 그림이 없습니다.
- lines_angles_triangles · [contract] 미해소 — 각 라벨(B) '(2x+30)°' 가 '(3x+10)°' 와 겹칩니다. / 각 라벨(C) '(5x-20)°' 가 '(3x+10)°' 와 겹칩니다.
- lines_angles_triangles · [contract] 미해소 — 각 라벨(B) '(2x+20)°' 가 '(3x+10)°' 와 겹칩니다. / 각 라벨(C) '(4x-10)°' 가 '(3x+10)°' 와 겹칩니다.
- lines_angles_triangles · [contract] 미해소 — 각 라벨(B) '(2x+20)°' 가 '(4x+10)°' 와 겹칩니다. / 각 라벨(C) '(3x-10)°' 가 '(4x+10)°' 와 겹칩니다.
- lines_angles_triangles · [contract] 미해소 — 자료 필수 문항입니다 — Lines, angles, and triangles 문항이 도형(figure)을 가리키므로 도형 자료가 필요합니다. '도형' 자료를 만들거나 그림을 올린 뒤 저장하세요. / 지문이 그림을 가리키는데("as shown", "figure") 그림이 없습니다.
- lines_angles_triangles · [contract] 미해소 — 자료 필수 문항입니다 — 각·평행선·삼각형 문항은 도형 없이 성립하지 않습니다. 도형 자료가 필요합니다. '도형' 자료를 만들거나 그림을 올린 뒤 저장하세요.
- lines_angles_triangles · [contract] 미해소 — 지문의 변 ST 가 도형에 없습니다. / 지문의 변 PS 가 도형에 없습니다.
- lines_angles_triangles · [review] 해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- lines_angles_triangles · [review] 해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- lines_angles_triangles · [review] 미해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 어려움 문제인데 오답 A)이 너무 명백합니다
- lines_angles_triangles · [review] 미해소 — 독립 검사는 다른 답을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- lines_angles_triangles · [contract] 미해소 — 점 이름 'A' 가 중복됩니다. / 이름 'A' 가 선과 점에 중복으로 쓰였습니다.
- lines_angles_triangles · [review] 해소 — 독립 검사 지적: 오답 C(25)의 설계 의도인 '대응변 오적용'이 실제로 어떤 구체적 계산 실수에서 나오는지 명확히 재현하기 어려움 - 20*5/4=25 (BC/AB=12/9=4/3의 역수 등)로 볼 수도 있어 설계 설명과 실제 계산 경로가 다소 불일치함
- central_ideas_details · [review] 해소 — 어려움 문제인데 오답 A), B), D)이 너무 명백합니다
- inferences · [review] 해소 — 어려움 문제인데 오답 A), C), D)이 지문·자료와 무관합니다
- inferences · [review] 해소 — 어려움 문제인데 오답 A), B), D)이 너무 명백합니다
- command_of_evidence_text · [review] 해소 — 어려움 문제인데 오답 B)이 너무 명백합니다 / 독립 검사 지적: 생성기 설계에 언급된 선택지 D(오답 설명에서 소아과 방문율 등 혼란변수 언급)가 실제 선택지 목록에는 존재하지 않음 - 설계와 실제 선택지 수(4개)가 불일치
- command_of_evidence_text · [review] 해소 — 독립 검사 지적: 선택지 표기가 A)~D)로 4개이며 생성기 설계에는 E)까지 5개 오답이 언급되어 있으나 실제 선택지는 4개뿐이므로 설계와 실제 문항 간 불일치가 있음 (설계의 E 항목은 실제 문항에 존재하지 않음)
- cross_text_connections · [review] 해소 — 어려움 문제인데 오답 A), C), D)이 너무 명백합니다
- cross_text_connections · [review] 해소 — 어려움 문제인데 오답 A), C), D)이 너무 명백합니다
- cross_text_connections · [review] 해소 — 어려움 문제인데 오답 B), C), D)이 너무 명백합니다
- cross_text_connections · [review] 해소 — 어려움 문제인데 오답 B), C), D)이 너무 명백합니다
- cross_text_connections · [review] 해소 — 어려움 문제인데 오답 A), C), D)이 너무 명백합니다 / 어려움으로 요청했지만 독립 검사 추정 난이도가 easy 입니다 — 핵심 관계를 종합해야 풀리는 문항으로
- cross_text_connections · [contract] 해소 — 지문의 "in-person conversations initially rose" 가 표·그래프의 항목(열·범주·계열·제목)에 없습니다.
- cross_text_connections · [contract] 해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
