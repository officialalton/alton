# 유형별 표본 생성·품질 계약 검증 — 난이도 hard (2026-09-15 19:53)

파이프라인: 생성 → 자료 필요 시 자료 생성 → 유형별 품질 계약(질문 대상·자료 근거·표시·정답·답안 형식) → 독립 품질 검사(정답 일치·오답 품질·추정 난이도) → 실패 시 사유 피드백 1회 재생성 → 부족분 1회 재생성. DB 저장 없음(보고서만). 총 소요 32분.

**요청 24 · 통과 4 (17%) · 재생성 36회(해소 1) · 검토 필요 3**

## 유형별

| 세부 기술 | 체계·형식 | 단건 | 복수 | 재생성(해소) | 추정 난이도 분포 | 검토 필요 | 미해소 실패 사유 | 초 |
|---|---|---|---|---|---|---|---|---|
| Linear functions (`linear_functions`) | sat_math · mc | 0/1 | 0/2 | 6(0) | e0 m0 h0 | 0 | [contract] 지문의 직선 'm' 가 그림에 없습니다(직선 객체의 label 로 두세요).<br>[contract] 선택지의 점 (-4, 5) 이 그림에 찍혀 있습니다 — 선택지 좌표는 그림에 넣지 않습니다(정답 노출). / 지문의 직선 'm<br>[contract] 변 라벨(BC) 'B(2, -1)' 가 그림 밖으로 나갑니다. / 선택지 1에 수식 기호($…$) 밖에 LaTeX 제어문이 있<br>[review] 독립 검사는 D)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)<br>[contract] 점 A 라벨 '(-4, 6)' 가 선과 겹칩니다. / 점 B 라벨 '(2, -3)' 가 선과 겹칩니다.<br>[contract] 점 A 라벨 '(-4, 6)' 가 선과 겹칩니다. / 점 B 라벨 '(2, -3)' 가 선과 겹칩니다.<br>[contract] 점 B 라벨 '(12, 300)' 가 선과 겹칩니다.<br>[contract] 점 P2 라벨 '(12, 300)' 가 선과 겹칩니다. / 지문의 함수 g(x) 에 해당하는 그래프 라벨이 없습니다(label<br>[contract] 지문의 좌표 (0, -4) 가 그림의 점이나 그래프 위에 없습니다. / 지문의 직선 'm' 가 그림에 없습니다(직선 객체의 l<br>[contract] 지문의 좌표 (0, -4) 가 그림의 점이나 그래프 위에 없습니다. / 지문의 직선 'm' 가 그림에 없습니다(직선 객체의 l<br>[contract] 점 A 라벨 '(0, 8)' 가 선과 겹칩니다.<br>[contract] 지문의 함수 g(x) 에 해당하는 그래프 라벨이 없습니다(label 을 'g' 또는 'y = g(x)' 로). | 204 |
| Percentages (`percentages`) | sat_math · mc | 0/1 | 1/2 | 4(0) | e0 m1 h0 | 1 | [contract] 지문은 'dollars' 단위를 쓰지만 표·그래프의 열 이름이나 축 제목에 단위가 없습니다(예: 'Cost (dollars)'<br>[contract] 지문에 닫히지 않은 수식 기호 $ 가 있습니다. / 해설에 닫히지 않은 수식 기호 $ 가 있습니다.<br>[review] 어려움 문제인데 오답 D)이 너무 명백합니다 / 어려움으로 요청했지만 독립 검사 추정 난이도가 easy 입니다 — 핵심 관계를<br>[contract] 지문은 'Original retail price' 의 'Price (dollars)' 를 102 로 말하지만 표의 값은 136<br>[review] 어려움 문제인데 오답 A), C)이 너무 명백합니다<br>[contract] 지문의 수치가 표·그래프 자료의 값과 하나도 겹치지 않습니다 — 자료가 지문의 근거가 아닙니다.<br>[contract] 지문은 'February' 의 'Resulting Price (dollars)' 를 25 로 말하지만 표의 값은 100 입니다<br>[contract] 지문에 닫히지 않은 수식 기호 $ 가 있습니다. | 155 |
| Lines, angles, and triangles (`lines_angles_triangles`) | sat_math · mc | 0/1 | 0/2 | 0(0) | e0 m0 h0 | 0 | [generate] AI 응답에 문제가 없습니다.<br>[generate] AI 응답에 문제가 없습니다. | 66 |
| Central Ideas and Details (`central_ideas_details`) | sat_rw · mc | 0/1 | 0/2 | 6(0) | e0 m0 h0 | 0 | [review] 어려움 문제인데 오답 C)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 A), D)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 C)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 D)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 A), C), D)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 A)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 D)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 B)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 B)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 A)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 D)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 C), D)이 너무 명백합니다 | 343 |
| Inferences (`inferences`) | sat_rw · mc | 0/1 | 0/2 | 6(0) | e0 m0 h0 | 0 | [review] 어려움 문제인데 오답 B)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 C)이 지문·자료와 무관합니다<br>[contract] 빈칸(______)은 정확히 하나여야 합니다(지금 0개).<br>[review] 어려움 문제인데 오답 D)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 A)이 지문·자료와 무관합니다<br>[contract] 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(<br>[review] 어려움 문제인데 오답 A)이 지문·자료와 무관합니다<br>[contract] 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(<br>[review] 어려움 문제인데 오답 A)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 C)이 지문·자료와 무관합니다<br>[contract] 빈칸(______)은 정확히 하나여야 합니다(지금 0개).<br>[contract] 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다( | 288 |
| Command of Evidence (Textual) (`command_of_evidence_text`) | sat_rw · mc | 0/1 | 2/2 | 3(1) | e0 m1 h1 | 1 | [review] 어려움 문제인데 오답 B)이 지문·자료와 무관합니다<br>[contract] 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(<br>[review] 어려움 문제인데 오답 A), C)이 지문·자료와 무관합니다<br>[contract] 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다( | 196 |
| Text Structure and Purpose (`text_structure_purpose`) | sat_rw · mc | 0/1 | 1/2 | 5(0) | e0 m1 h0 | 1 | [review] 어려움 문제인데 오답 D)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 D)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 C)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 D)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 D)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 C), D)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 D)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 B)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 D)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 A)이 너무 명백합니다 | 316 |
| Cross-Text Connections (`cross_text_connections`) | sat_rw · mc | 0/1 | 0/2 | 6(0) | e0 m0 h0 | 0 | [review] 어려움 문제인데 오답 B)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 C)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 D)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 D)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 B), C)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 C)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 C)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 B)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 D)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 A)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 B), C)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 D)이 지문·자료와 무관합니다 | 332 |

## 실패 단계별

| 단계 | 건수 | 재생성으로 해소 |
|---|---|---|
| contract | 24 | 0 |
| review | 47 | 1 |
| generate | 2 | 0 |

## 반복되는 실패 사유(상위)

| 사유(숫자·인용 일반화) | 건수 |
|---|---|
| 어려움 문제인데 오답 D)이 지문·자료와 무관합니다 | 12 |
| 어려움 문제인데 오답 A)이 너무 명백합니다 | 5 |
| 어려움 문제인데 오답 C)이 지문·자료와 무관합니다 | 5 |
| 객관식은 선택지 N개(A~D)여야 합니다(지금 N개). / Reading & Writing 문항은 선택지가 정확히 N개입니다(지금 N개). | 5 |
| 어려움 문제인데 오답 B)이 너무 명백합니다 | 4 |
| 어려움 문제인데 오답 C)이 너무 명백합니다 | 3 |
| 어려움 문제인데 오답 D)이 너무 명백합니다 | 3 |
| 어려움 문제인데 오답 B)이 지문·자료와 무관합니다 | 3 |
| 점 A 라벨 '(-N, N)' 가 선과 겹칩니다. / 점 B 라벨 '(N, -N)' 가 선과 겹칩니다. | 2 |
| 지문의 좌표 (N, -N) 가 그림의 점이나 그래프 위에 없습니다. / 지문의 직선 'm' 가 그림에 없습니다(직선 객체의 label 로 두세요). | 2 |
| AI 응답에 문제가 없습니다. | 2 |
| 빈칸(______)은 정확히 하나여야 합니다(지금 N개). | 2 |
| 어려움 문제인데 오답 A)이 지문·자료와 무관합니다 | 2 |
| 어려움 문제인데 오답 B), C)이 너무 명백합니다 | 2 |
| 지문의 직선 'm' 가 그림에 없습니다(직선 객체의 label 로 두세요). | 1 |
| 선택지의 점 (-N, N) 이 그림에 찍혀 있습니다 — 선택지 좌표는 그림에 넣지 않습니다(정답 노출). / 지문의 직선 'm' 가 그림에 없습니다(직선 객체의  | 1 |
| 변 라벨(BC) 'B(N, -N)' 가 그림 밖으로 나갑니다. / 선택지 N에 수식 기호($…$) 밖에 LaTeX 제어문이 있습니다 — 그대로 노출됩니다: “…” | 1 |
| 독립 검사는 D)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) | 1 |
| 점 B 라벨 '(N, N)' 가 선과 겹칩니다. | 1 |
| 점 PN 라벨 '(N, N)' 가 선과 겹칩니다. / 지문의 함수 g(x) 에 해당하는 그래프 라벨이 없습니다(label 을 'g' 또는 'y = g(x)' 로) | 1 |
| 점 A 라벨 '(N, N)' 가 선과 겹칩니다. | 1 |
| 지문의 함수 g(x) 에 해당하는 그래프 라벨이 없습니다(label 을 'g' 또는 'y = g(x)' 로). | 1 |
| 지문은 'dollars' 단위를 쓰지만 표·그래프의 열 이름이나 축 제목에 단위가 없습니다(예: 'Cost (dollars)'). / 지문의 수치가 표·그래프 자 | 1 |
| 지문에 닫히지 않은 수식 기호 $ 가 있습니다. / 해설에 닫히지 않은 수식 기호 $ 가 있습니다. | 1 |
| 어려움 문제인데 오답 D)이 너무 명백합니다 / 어려움으로 요청했지만 독립 검사 추정 난이도가 easy 입니다 — 핵심 관계를 종합해야 풀리는 문항으로 / 독립  | 1 |

## 전체 실패 목록

- linear_functions · [contract] 미해소 — 지문의 직선 'm' 가 그림에 없습니다(직선 객체의 label 로 두세요).
- linear_functions · [contract] 미해소 — 선택지의 점 (-4, 5) 이 그림에 찍혀 있습니다 — 선택지 좌표는 그림에 넣지 않습니다(정답 노출). / 지문의 직선 'm' 가 그림에 없습니다(직선 객체의 label 로 두세요).
- linear_functions · [contract] 미해소 — 변 라벨(BC) 'B(2, -1)' 가 그림 밖으로 나갑니다. / 선택지 1에 수식 기호($…$) 밖에 LaTeX 제어문이 있습니다 — 그대로 노출됩니다: "\frac{3}{2}x"
- linear_functions · [review] 미해소 — 독립 검사는 D)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- linear_functions · [contract] 미해소 — 점 A 라벨 '(-4, 6)' 가 선과 겹칩니다. / 점 B 라벨 '(2, -3)' 가 선과 겹칩니다.
- linear_functions · [contract] 미해소 — 점 A 라벨 '(-4, 6)' 가 선과 겹칩니다. / 점 B 라벨 '(2, -3)' 가 선과 겹칩니다.
- linear_functions · [contract] 미해소 — 점 B 라벨 '(12, 300)' 가 선과 겹칩니다.
- linear_functions · [contract] 미해소 — 점 P2 라벨 '(12, 300)' 가 선과 겹칩니다. / 지문의 함수 g(x) 에 해당하는 그래프 라벨이 없습니다(label 을 'g' 또는 'y = g(x)' 로).
- linear_functions · [contract] 미해소 — 지문의 좌표 (0, -4) 가 그림의 점이나 그래프 위에 없습니다. / 지문의 직선 'm' 가 그림에 없습니다(직선 객체의 label 로 두세요).
- linear_functions · [contract] 미해소 — 지문의 좌표 (0, -4) 가 그림의 점이나 그래프 위에 없습니다. / 지문의 직선 'm' 가 그림에 없습니다(직선 객체의 label 로 두세요).
- linear_functions · [contract] 미해소 — 점 A 라벨 '(0, 8)' 가 선과 겹칩니다.
- linear_functions · [contract] 미해소 — 지문의 함수 g(x) 에 해당하는 그래프 라벨이 없습니다(label 을 'g' 또는 'y = g(x)' 로).
- percentages · [contract] 미해소 — 지문은 'dollars' 단위를 쓰지만 표·그래프의 열 이름이나 축 제목에 단위가 없습니다(예: 'Cost (dollars)'). / 지문의 수치가 표·그래프 자료의 값과 하나도 겹치지 않습니다 — 자료가 지문의 근거가 아닙니다.
- percentages · [contract] 미해소 — 지문에 닫히지 않은 수식 기호 $ 가 있습니다. / 해설에 닫히지 않은 수식 기호 $ 가 있습니다.
- percentages · [review] 미해소 — 어려움 문제인데 오답 D)이 너무 명백합니다 / 어려움으로 요청했지만 독립 검사 추정 난이도가 easy 입니다 — 핵심 관계를 종합해야 풀리는 문항으로 / 독립 검사 지적: 표에 이미 정답 계산에 필요한 모든 값(80, 102)이 명시되어 있어 문제가 매우 쉬움에도 'hard' 난이도로
- percentages · [contract] 미해소 — 지문은 'Original retail price' 의 'Price (dollars)' 를 102 로 말하지만 표의 값은 136 입니다. / 해설에 닫히지 않은 수식 기호 $ 가 있습니다.
- percentages · [review] 미해소 — 어려움 문제인데 오답 A), C)이 너무 명백합니다
- percentages · [contract] 미해소 — 지문의 수치가 표·그래프 자료의 값과 하나도 겹치지 않습니다 — 자료가 지문의 근거가 아닙니다.
- percentages · [contract] 미해소 — 지문은 'February' 의 'Resulting Price (dollars)' 를 25 로 말하지만 표의 값은 100 입니다. / 지문은 'June' 의 'Resulting Price (dollars)' 를 20 로 말하지만 표의 값은 80 입니다.
- percentages · [contract] 미해소 — 지문에 닫히지 않은 수식 기호 $ 가 있습니다.
- lines_angles_triangles · [generate] 미해소 — AI 응답에 문제가 없습니다.
- lines_angles_triangles · [generate] 미해소 — AI 응답에 문제가 없습니다.
- central_ideas_details · [review] 미해소 — 어려움 문제인데 오답 C)이 너무 명백합니다
- central_ideas_details · [review] 미해소 — 어려움 문제인데 오답 A), D)이 너무 명백합니다
- central_ideas_details · [review] 미해소 — 어려움 문제인데 오답 C)이 너무 명백합니다
- central_ideas_details · [review] 미해소 — 어려움 문제인데 오답 D)이 너무 명백합니다
- central_ideas_details · [review] 미해소 — 어려움 문제인데 오답 A), C), D)이 너무 명백합니다
- central_ideas_details · [review] 미해소 — 어려움 문제인데 오답 A)이 너무 명백합니다
- central_ideas_details · [review] 미해소 — 어려움 문제인데 오답 D)이 지문·자료와 무관합니다
- central_ideas_details · [review] 미해소 — 어려움 문제인데 오답 B)이 지문·자료와 무관합니다
- central_ideas_details · [review] 미해소 — 어려움 문제인데 오답 B)이 너무 명백합니다
- central_ideas_details · [review] 미해소 — 어려움 문제인데 오답 A)이 너무 명백합니다
- central_ideas_details · [review] 미해소 — 어려움 문제인데 오답 D)이 지문·자료와 무관합니다
- central_ideas_details · [review] 미해소 — 어려움 문제인데 오답 C), D)이 너무 명백합니다
- inferences · [review] 미해소 — 어려움 문제인데 오답 B)이 너무 명백합니다
- inferences · [review] 미해소 — 어려움 문제인데 오답 C)이 지문·자료와 무관합니다
- inferences · [contract] 미해소 — 빈칸(______)은 정확히 하나여야 합니다(지금 0개).
- inferences · [review] 미해소 — 어려움 문제인데 오답 D)이 지문·자료와 무관합니다
- inferences · [review] 미해소 — 어려움 문제인데 오답 A)이 지문·자료와 무관합니다
- inferences · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- inferences · [review] 미해소 — 어려움 문제인데 오답 A)이 지문·자료와 무관합니다
- inferences · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- inferences · [review] 미해소 — 어려움 문제인데 오답 A)이 너무 명백합니다
- inferences · [review] 미해소 — 어려움 문제인데 오답 C)이 지문·자료와 무관합니다
- inferences · [contract] 미해소 — 빈칸(______)은 정확히 하나여야 합니다(지금 0개).
- inferences · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- command_of_evidence_text · [review] 미해소 — 어려움 문제인데 오답 B)이 지문·자료와 무관합니다
- command_of_evidence_text · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- command_of_evidence_text · [review] 미해소 — 어려움 문제인데 오답 A), C)이 지문·자료와 무관합니다
- command_of_evidence_text · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- command_of_evidence_text · [review] 해소 — 어려움 문제인데 오답 D)이 지문·자료와 무관합니다
- text_structure_purpose · [review] 미해소 — 어려움 문제인데 오답 D)이 너무 명백합니다
- text_structure_purpose · [review] 미해소 — 어려움 문제인데 오답 D)이 지문·자료와 무관합니다
- text_structure_purpose · [review] 미해소 — 어려움 문제인데 오답 C)이 지문·자료와 무관합니다
- text_structure_purpose · [review] 미해소 — 어려움 문제인데 오답 D)이 너무 명백합니다
- text_structure_purpose · [review] 미해소 — 어려움 문제인데 오답 D)이 지문·자료와 무관합니다
- text_structure_purpose · [review] 미해소 — 어려움 문제인데 오답 C), D)이 지문·자료와 무관합니다
- text_structure_purpose · [review] 미해소 — 어려움 문제인데 오답 D)이 지문·자료와 무관합니다
- text_structure_purpose · [review] 미해소 — 어려움 문제인데 오답 B)이 너무 명백합니다
- text_structure_purpose · [review] 미해소 — 어려움 문제인데 오답 D)이 지문·자료와 무관합니다
- text_structure_purpose · [review] 미해소 — 어려움 문제인데 오답 A)이 너무 명백합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 B)이 너무 명백합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 C)이 지문·자료와 무관합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 D)이 지문·자료와 무관합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 D)이 지문·자료와 무관합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 B), C)이 너무 명백합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 C)이 너무 명백합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 C)이 지문·자료와 무관합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 B)이 지문·자료와 무관합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 D)이 지문·자료와 무관합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 A)이 너무 명백합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 B), C)이 너무 명백합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 D)이 지문·자료와 무관합니다
