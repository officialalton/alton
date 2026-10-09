# 유형별 표본 생성·품질 계약 검증 — 난이도 hard (2026-09-15 20:27)

파이프라인: 생성 → 자료 필요 시 자료 생성 → 유형별 품질 계약(질문 대상·자료 근거·표시·정답·답안 형식) → 독립 품질 검사(정답 일치·오답 품질·추정 난이도) → 실패 시 사유 피드백 1회 재생성 → 부족분 1회 재생성. DB 저장 없음(보고서만). 총 소요 31분.

**요청 18 · 통과 11 (61%) · 재생성 43회(해소 11) · 검토 필요 6**

## 유형별

| 세부 기술 | 체계·형식 | 단건 | 복수 | 재생성(해소) | 추정 난이도 분포 | 검토 필요 | 미해소 실패 사유 | 초 |
|---|---|---|---|---|---|---|---|---|
| Linear functions (`linear_functions`) | sat_math · mc | 1/1 | 0/2 | 10(2) | e0 m0 h1 | 0 | [contract] 지문의 좌표 (4, -1) 가 그림의 점이나 그래프 위에 없습니다. / 지문의 직선 'm' 가 그림에 없습니다(직선 객체의 l<br>[contract] 선택지는 값만 적습니다('x = 3' 이 아니라 '3').<br>[review] 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)<br>[contract] 지문의 함수 g(x) 에 해당하는 그래프 라벨이 없습니다(label 을 'g' 또는 'y = g(x)' 로).<br>[contract] 점 B 라벨 '(6, -12)' 가 선과 겹칩니다. / 지문의 함수 g(x) 에 해당하는 그래프 라벨이 없습니다(label 을<br>[contract] 지문의 함수 g(x) 에 해당하는 그래프 라벨이 없습니다(label 을 'g' 또는 'y = g(x)' 로).<br>[review] 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)<br>[contract] 해설에 수식 기호($…$) 밖에 LaTeX 제어문이 있습니다 — 그대로 노출됩니다: "\frac{3}{2}(x" / 선택지 1<br>[review] 독립 검사는 D)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)<br>[contract] 점 A 라벨 '(-2, 5)' 가 선과 겹칩니다. / 점 B 라벨 '(2, -1)' 가 선과 겹칩니다.<br>[contract] 지문의 함수 g(x) 에 해당하는 그래프 라벨이 없습니다(label 을 'g' 또는 'y = g(x)' 로).<br>[contract] 지문의 함수 g(x) 에 해당하는 그래프 라벨이 없습니다(label 을 'g' 또는 'y = g(x)' 로). | 300 |
| Lines, angles, and triangles (`lines_angles_triangles`) | sat_math · mc | 0/1 | 2/2 | 4(2) | e0 m2 h0 | 2 | [generate] AI 응답에 문제가 없습니다.<br>[review] 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 어려움 문제<br>[review] 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 어려움 문제<br>[contract] 지문은 수직(perpendicular)이라 하는데 수직 횡단선(perpendicular:true)이 데이터에 없습니다. | 256 |
| Central Ideas and Details (`central_ideas_details`) | sat_rw · mc | 1/1 | 2/2 | 6(2) | e0 m2 h1 | 2 | [review] 어려움 문제인데 오답 C)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 C)이 너무 명백합니다<br>[contract] 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(<br>[review] 어려움 문제인데 오답 C), D)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 C)이 지문·자료와 무관합니다<br>[contract] 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다( | 248 |
| Inferences (`inferences`) | sat_rw · mc | 1/1 | 1/2 | 5(1) | e0 m1 h1 | 1 | [contract] 빈칸(______)은 정확히 하나여야 합니다(지금 0개).<br>[review] 어려움 문제인데 오답 C)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 D)이 너무 명백합니다<br>[contract] 질문 문장을 인식하지 못했습니다 — 지문 마지막 단락이 SAT 문항처럼 물음표로 끝나야 합니다(예: "Which choice <br>[review] 어려움 문제인데 오답 D)이 너무 명백합니다<br>[contract] 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다( | 224 |
| Command of Evidence (Textual) (`command_of_evidence_text`) | sat_rw · mc | 1/1 | 2/2 | 6(4) | e0 m1 h2 | 1 | [review] 어려움 문제인데 오답 C)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 C)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 C)이 지문·자료와 무관합니다 | 309 |
| Cross-Text Connections (`cross_text_connections`) | sat_rw · mc | 0/1 | 0/2 | 12(0) | e0 m0 h0 | 0 | [review] 어려움 문제인데 오답 D)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 A)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 C), D)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 B), C), D)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 D)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 B), C), D)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 B)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 B)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 B)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 C), D)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 B)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 D)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 D)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 B), D)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 D)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 A)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 A)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 A), D)이 너무 명백합니다 | 550 |

## 실패 단계별

| 단계 | 건수 | 재생성으로 해소 |
|---|---|---|
| review | 40 | 7 |
| contract | 19 | 4 |
| generate | 1 | 0 |

## 반복되는 실패 사유(상위)

| 사유(숫자·인용 일반화) | 건수 |
|---|---|
| 어려움 문제인데 오답 C)이 지문·자료와 무관합니다 | 6 |
| 어려움 문제인데 오답 D)이 너무 명백합니다 | 5 |
| 객관식은 선택지 N개(A~D)여야 합니다(지금 N개). / Reading & Writing 문항은 선택지가 정확히 N개입니다(지금 N개). | 5 |
| 지문의 함수 g(x) 에 해당하는 그래프 라벨이 없습니다(label 을 'g' 또는 'y = g(x)' 로). | 4 |
| 어려움 문제인데 오답 D)이 지문·자료와 무관합니다 | 4 |
| 어려움 문제인데 오답 C)이 너무 명백합니다 | 3 |
| 어려움 문제인데 오답 C), D)이 지문·자료와 무관합니다 | 3 |
| 어려움 문제인데 오답 B)이 지문·자료와 무관합니다 | 3 |
| 독립 검사는 D)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) | 2 |
| 빈칸(______)은 정확히 하나여야 합니다(지금 N개). | 2 |
| 어려움 문제인데 오답 A)이 너무 명백합니다 | 2 |
| 어려움 문제인데 오답 B), C), D)이 너무 명백합니다 | 2 |
| 지문의 좌표 (N, -N) 가 그림의 점이나 그래프 위에 없습니다. / 지문의 점 'P' 가 그림에 없습니다. | 1 |
| 지문의 좌표 (N, -N) 가 그림의 점이나 그래프 위에 없습니다. / 지문의 직선 'm' 가 그림에 없습니다(직선 객체의 label 로 두세요). | 1 |
| 선택지는 값만 적습니다('x = N' 이 아니라 'N'). | 1 |
| 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) | 1 |
| 점 B 라벨 '(N, -N)' 가 선과 겹칩니다. / 지문의 함수 g(x) 에 해당하는 그래프 라벨이 없습니다(label 을 'g' 또는 'y = g(x)' 로) | 1 |
| 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) | 1 |
| 해설에 수식 기호($…$) 밖에 LaTeX 제어문이 있습니다 — 그대로 노출됩니다: “…” / 선택지 N에 수식 기호($…$) 밖에 LaTeX 제어문이 있습니다  | 1 |
| 점 A 라벨 '(-N, N)' 가 선과 겹칩니다. / 점 B 라벨 '(N, -N)' 가 선과 겹칩니다. | 1 |
| AI 응답에 문제가 없습니다. | 1 |
| 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 어려움 문제인데 오답 D)이 지문·자료와 무관합 | 1 |
| 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 어려움 문제인데 오답 D)이 너무 명백합니다 | 1 |
| 지문은 수직(perpendicular)이라 하는데 수직 횡단선(perpendicular:true)이 데이터에 없습니다. | 1 |
| 독립 검사는 E)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 어려움으로 요청했지만 독립 검사 추정 난이도가  | 1 |

## 전체 실패 목록

- linear_functions · [review] 해소 — 어려움 문제인데 오답 D)이 너무 명백합니다
- linear_functions · [contract] 해소 — 지문의 좌표 (4, -1) 가 그림의 점이나 그래프 위에 없습니다. / 지문의 점 'P' 가 그림에 없습니다.
- linear_functions · [contract] 미해소 — 지문의 좌표 (4, -1) 가 그림의 점이나 그래프 위에 없습니다. / 지문의 직선 'm' 가 그림에 없습니다(직선 객체의 label 로 두세요).
- linear_functions · [contract] 미해소 — 선택지는 값만 적습니다('x = 3' 이 아니라 '3').
- linear_functions · [review] 미해소 — 독립 검사는 A)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- linear_functions · [contract] 미해소 — 지문의 함수 g(x) 에 해당하는 그래프 라벨이 없습니다(label 을 'g' 또는 'y = g(x)' 로).
- linear_functions · [contract] 미해소 — 점 B 라벨 '(6, -12)' 가 선과 겹칩니다. / 지문의 함수 g(x) 에 해당하는 그래프 라벨이 없습니다(label 을 'g' 또는 'y = g(x)' 로).
- linear_functions · [contract] 미해소 — 지문의 함수 g(x) 에 해당하는 그래프 라벨이 없습니다(label 을 'g' 또는 'y = g(x)' 로).
- linear_functions · [review] 미해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- linear_functions · [contract] 미해소 — 해설에 수식 기호($…$) 밖에 LaTeX 제어문이 있습니다 — 그대로 노출됩니다: "\frac{3}{2}(x" / 선택지 1에 수식 기호($…$) 밖에 LaTeX 제어문이 있습니다 — 그대로 노출됩니다: "\frac{2}{3}(x"
- linear_functions · [review] 미해소 — 독립 검사는 D)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- linear_functions · [contract] 미해소 — 점 A 라벨 '(-2, 5)' 가 선과 겹칩니다. / 점 B 라벨 '(2, -1)' 가 선과 겹칩니다.
- linear_functions · [contract] 미해소 — 지문의 함수 g(x) 에 해당하는 그래프 라벨이 없습니다(label 을 'g' 또는 'y = g(x)' 로).
- linear_functions · [contract] 미해소 — 지문의 함수 g(x) 에 해당하는 그래프 라벨이 없습니다(label 을 'g' 또는 'y = g(x)' 로).
- lines_angles_triangles · [generate] 미해소 — AI 응답에 문제가 없습니다.
- lines_angles_triangles · [review] 미해소 — 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 어려움 문제인데 오답 D)이 지문·자료와 무관합니다
- lines_angles_triangles · [review] 미해소 — 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 어려움 문제인데 오답 D)이 너무 명백합니다
- lines_angles_triangles · [contract] 미해소 — 지문은 수직(perpendicular)이라 하는데 수직 횡단선(perpendicular:true)이 데이터에 없습니다.
- lines_angles_triangles · [review] 해소 — 독립 검사는 E)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 어려움으로 요청했지만 독립 검사 추정 난이도가 easy 입니다 — 핵심 관계를 종합해야 풀리는 문항으로
- lines_angles_triangles · [review] 해소 — 독립 검사는 D)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- central_ideas_details · [review] 미해소 — 어려움 문제인데 오답 C)이 너무 명백합니다
- central_ideas_details · [review] 미해소 — 어려움 문제인데 오답 C)이 너무 명백합니다
- central_ideas_details · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- central_ideas_details · [contract] 해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- central_ideas_details · [review] 미해소 — 어려움 문제인데 오답 C), D)이 지문·자료와 무관합니다
- central_ideas_details · [review] 미해소 — 어려움 문제인데 오답 C)이 지문·자료와 무관합니다
- central_ideas_details · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- central_ideas_details · [contract] 해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- inferences · [contract] 해소 — 빈칸(______)은 정확히 하나여야 합니다(지금 0개).
- inferences · [contract] 미해소 — 빈칸(______)은 정확히 하나여야 합니다(지금 0개).
- inferences · [review] 미해소 — 어려움 문제인데 오답 C)이 너무 명백합니다
- inferences · [review] 미해소 — 어려움 문제인데 오답 D)이 너무 명백합니다
- inferences · [contract] 미해소 — 질문 문장을 인식하지 못했습니다 — 지문 마지막 단락이 SAT 문항처럼 물음표로 끝나야 합니다(예: "Which choice …?").
- inferences · [review] 미해소 — 어려움 문제인데 오답 D)이 너무 명백합니다
- inferences · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- command_of_evidence_text · [review] 미해소 — 어려움 문제인데 오답 C)이 지문·자료와 무관합니다
- command_of_evidence_text · [review] 미해소 — 어려움 문제인데 오답 C)이 지문·자료와 무관합니다
- command_of_evidence_text · [review] 미해소 — 어려움 문제인데 오답 C)이 지문·자료와 무관합니다
- command_of_evidence_text · [review] 해소 — 어려움 문제인데 오답 C), D)이 지문·자료와 무관합니다
- command_of_evidence_text · [review] 해소 — 어려움 문제인데 오답 C)이 지문·자료와 무관합니다
- command_of_evidence_text · [review] 해소 — 어려움 문제인데 오답 C)이 지문·자료와 무관합니다
- command_of_evidence_text · [review] 해소 — 어려움 문제인데 오답 D)이 지문·자료와 무관합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 D)이 지문·자료와 무관합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 A)이 너무 명백합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 C), D)이 지문·자료와 무관합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 B), C), D)이 너무 명백합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 D)이 너무 명백합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 B), C), D)이 너무 명백합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 B)이 지문·자료와 무관합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 B)이 지문·자료와 무관합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 B)이 지문·자료와 무관합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 C), D)이 너무 명백합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 B)이 너무 명백합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 D)이 너무 명백합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 D)이 지문·자료와 무관합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 B), D)이 너무 명백합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 D)이 지문·자료와 무관합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 A)이 지문·자료와 무관합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 A)이 너무 명백합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 A), D)이 너무 명백합니다
