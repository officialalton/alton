# 유형별 표본 생성·품질 계약 검증 — 난이도 hard (2026-09-15 20:46)

파이프라인: 생성 → 자료 필요 시 자료 생성 → 유형별 품질 계약(질문 대상·자료 근거·표시·정답·답안 형식) → 독립 품질 검사(정답 일치·오답 품질·추정 난이도) → 실패 시 사유 피드백 1회 재생성 → 부족분 1회 재생성. DB 저장 없음(보고서만). 총 소요 18분.

**요청 18 · 통과 4 (22%) · 재생성 19회(해소 3) · 오답 부분수정 10회(해소 0) · 검토 필요 3**

## 유형별

| 세부 기술 | 체계·형식 | 단건 | 복수 | 재생성(해소) | 오답 부분수정(해소) | 추정 난이도 분포 | 검토 필요 | 미해소 실패 사유 | 초 |
|---|---|---|---|---|---|---|---|---|---|
| Linear functions (`linear_functions`) | sat_math · mc | 1/1 | 0/2 | 2(0) | 0(0) | e0 m1 h0 | 1 | [contract] 점 P2 라벨 '(0, 4)' 가 선과 겹칩니다. / 점 P3 라벨 '(-4, 4)' 가 선과 겹칩니다.<br>[contract] 점 A 라벨 '(-4, -2)' 가 선과 겹칩니다. / 점 B 라벨 '(0, 4)' 가 선과 겹칩니다.<br>[contract] 지문의 직선 'n' 가 그림에 없습니다(직선 객체의 label 로 두세요).<br>[generate] AI 응답에 문제가 없습니다. | 121 |
| Lines, angles, and triangles (`lines_angles_triangles`) | sat_math · mc | 1/1 | 1/2 | 7(1) | 0(0) | e0 m1 h1 | 2 | [contract] 각 라벨 '(2x + 30)°' 가 '(3x + 10)°' 와 겹칩니다.<br>[contract] 자료 필수 문항입니다 — Lines, angles, and triangles 문항이 도형(figure)을 가리키므로 도형 자료<br>[contract] 객관식은 선택지 4개(A~D)여야 합니다(지금 0개). / 정답 자리가 선택지 범위 안에 없습니다.<br>[contract] 자료 필수 문항입니다 — 각·평행선·삼각형 문항은 도형 없이 성립하지 않습니다. 도형 자료가 필요합니다. '도형' 자료를 만들<br>[contract] 자료 필수 문항입니다 — 각·평행선·삼각형 문항은 도형 없이 성립하지 않습니다. 도형 자료가 필요합니다. '도형' 자료를 만들<br>[contract] 점 이름 'A' 가 중복됩니다(두 삼각형은 서로 다른 이름을 씁니다). / 지문의 변 DB 가 도형에 없습니다.<br>[contract] 지문의 도형 with 의 점 'w' 가 도형 데이터에 없습니다. / 지문의 도형 with 의 점 'i' 가 도형 데이터에 없습<br>[contract] 지문의 도형 with 의 점 'w' 가 도형 데이터에 없습니다. / 지문의 도형 with 의 점 'i' 가 도형 데이터에 없습<br>[contract] 지문의 도형 with 의 점 'w' 가 도형 데이터에 없습니다. / 지문의 도형 with 의 점 'i' 가 도형 데이터에 없습 | 226 |
| Central Ideas and Details (`central_ideas_details`) | sat_rw · mc | 0/1 | 0/2 | 0(0) | 0(0) | e0 m0 h0 | 0 | [generate] AI 응답에 문제가 없습니다.<br>[generate] AI 응답에 문제가 없습니다. | 82 |
| Inferences (`inferences`) | sat_rw · mc | 0/1 | 0/2 | 0(0) | 0(0) | e0 m0 h0 | 0 | [generate] AI 응답에 문제가 없습니다.<br>[generate] AI 응답에 문제가 없습니다. | 89 |
| Command of Evidence (Textual) (`command_of_evidence_text`) | sat_rw · mc | 1/1 | 0/2 | 2(2) | 1(0) | e0 m0 h1 | 0 | [generate] AI 응답에 문제가 없습니다. | 140 |
| Cross-Text Connections (`cross_text_connections`) | sat_rw · mc | 0/1 | 0/2 | 8(0) | 9(0) | e0 m0 h0 | 0 | [review] 어려움 문제인데 오답 C), D)이 너무 명백합니다<br>[contract] 지문의 "road diets" 가 표·그래프의 항목(열·범주·계열·제목)에 없습니다.<br>[contract] 지문의 "road diets" 가 표·그래프의 항목(열·범주·계열·제목)에 없습니다.<br>[review] 어려움 문제인데 오답 C)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 D)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 A), B), D)이 너무 명백합니다 / 어려움으로 요청했지만 독립 검사 추정 난이도가 easy 입니다 <br>[review] 어려움 문제인데 오답 B)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 B)이 너무 명백합니다<br>[review] 어려움 문제인데 오답 B)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 C)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 C)이 지문·자료와 무관합니다<br>[review] 어려움 문제인데 오답 B)이 지문·자료와 무관합니다<br>[generate] AI 응답에 문제가 없습니다. | 434 |

## 실패 단계별

| 단계 | 건수 | 재생성으로 해소 |
|---|---|---|
| contract | 15 | 1 |
| generate | 7 | 0 |
| review | 12 | 2 |

## 반복되는 실패 사유(상위)

| 사유(숫자·인용 일반화) | 건수 |
|---|---|
| AI 응답에 문제가 없습니다. | 7 |
| 지문의 도형 with 의 점 'w' 가 도형 데이터에 없습니다. / 지문의 도형 with 의 점 'i' 가 도형 데이터에 없습니다. | 3 |
| 자료 필수 문항입니다 — 각·평행선·삼각형 문항은 도형 없이 성립하지 않습니다. 도형 자료가 필요합니다. '도형' 자료를 만들거나 그림을 올린 뒤 저장하세요. | 2 |
| 어려움 문제인데 오답 D)이 지문·자료와 무관합니다 | 2 |
| 지문의 “…” 가 표·그래프의 항목(열·범주·계열·제목)에 없습니다. | 2 |
| 어려움 문제인데 오답 B)이 너무 명백합니다 | 2 |
| 어려움 문제인데 오답 B)이 지문·자료와 무관합니다 | 2 |
| 어려움 문제인데 오답 C)이 지문·자료와 무관합니다 | 2 |
| 점 PN 라벨 '(N, N)' 가 선과 겹칩니다. / 점 PN 라벨 '(-N, N)' 가 선과 겹칩니다. | 1 |
| 점 A 라벨 '(-N, -N)' 가 선과 겹칩니다. / 점 B 라벨 '(N, N)' 가 선과 겹칩니다. | 1 |
| 지문의 직선 'n' 가 그림에 없습니다(직선 객체의 label 로 두세요). | 1 |
| 각 라벨 '(Nx + N)°' 가 '(Nx + N)°' 와 겹칩니다. | 1 |
| 자료 필수 문항입니다 — Lines, angles, and triangles 문항이 도형(figure)을 가리키므로 도형 자료가 필요합니다. '도형' 자료를 만들 | 1 |
| 객관식은 선택지 N개(A~D)여야 합니다(지금 N개). / 정답 자리가 선택지 범위 안에 없습니다. | 1 |
| 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 어려움 문제인데 오답 B), D)이 너무 명백합 | 1 |
| 점 이름 'A' 가 중복됩니다(두 삼각형은 서로 다른 이름을 씁니다). / 지문의 변 DB 가 도형에 없습니다. | 1 |
| 객관식은 선택지 N개(A~D)여야 합니다(지금 N개). / Reading & Writing 문항은 선택지가 정확히 N개입니다(지금 N개). | 1 |
| 어려움 문제인데 오답 C), D)이 너무 명백합니다 | 1 |
| 어려움 문제인데 오답 C)이 너무 명백합니다 | 1 |
| 어려움 문제인데 오답 A), B), D)이 너무 명백합니다 / 어려움으로 요청했지만 독립 검사 추정 난이도가 easy 입니다 — 핵심 관계를 종합해야 풀리는 문항 | 1 |

## 전체 실패 목록

- linear_functions · [contract] 미해소 — 점 P2 라벨 '(0, 4)' 가 선과 겹칩니다. / 점 P3 라벨 '(-4, 4)' 가 선과 겹칩니다.
- linear_functions · [contract] 미해소 — 점 A 라벨 '(-4, -2)' 가 선과 겹칩니다. / 점 B 라벨 '(0, 4)' 가 선과 겹칩니다.
- linear_functions · [contract] 미해소 — 지문의 직선 'n' 가 그림에 없습니다(직선 객체의 label 로 두세요).
- linear_functions · [generate] 미해소 — AI 응답에 문제가 없습니다.
- lines_angles_triangles · [contract] 미해소 — 각 라벨 '(2x + 30)°' 가 '(3x + 10)°' 와 겹칩니다.
- lines_angles_triangles · [contract] 미해소 — 자료 필수 문항입니다 — Lines, angles, and triangles 문항이 도형(figure)을 가리키므로 도형 자료가 필요합니다. '도형' 자료를 만들거나 그림을 올린 뒤 저장하세요. / 지문이 그림을 가리키는데("as shown", "figure") 그림이 없습니다.
- lines_angles_triangles · [contract] 미해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 0개). / 정답 자리가 선택지 범위 안에 없습니다.
- lines_angles_triangles · [review] 해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 어려움 문제인데 오답 B), D)이 너무 명백합니다
- lines_angles_triangles · [contract] 미해소 — 자료 필수 문항입니다 — 각·평행선·삼각형 문항은 도형 없이 성립하지 않습니다. 도형 자료가 필요합니다. '도형' 자료를 만들거나 그림을 올린 뒤 저장하세요.
- lines_angles_triangles · [contract] 미해소 — 자료 필수 문항입니다 — 각·평행선·삼각형 문항은 도형 없이 성립하지 않습니다. 도형 자료가 필요합니다. '도형' 자료를 만들거나 그림을 올린 뒤 저장하세요.
- lines_angles_triangles · [contract] 미해소 — 점 이름 'A' 가 중복됩니다(두 삼각형은 서로 다른 이름을 씁니다). / 지문의 변 DB 가 도형에 없습니다.
- lines_angles_triangles · [contract] 미해소 — 지문의 도형 with 의 점 'w' 가 도형 데이터에 없습니다. / 지문의 도형 with 의 점 'i' 가 도형 데이터에 없습니다.
- lines_angles_triangles · [contract] 미해소 — 지문의 도형 with 의 점 'w' 가 도형 데이터에 없습니다. / 지문의 도형 with 의 점 'i' 가 도형 데이터에 없습니다.
- lines_angles_triangles · [contract] 미해소 — 지문의 도형 with 의 점 'w' 가 도형 데이터에 없습니다. / 지문의 도형 with 의 점 'i' 가 도형 데이터에 없습니다.
- central_ideas_details · [generate] 미해소 — AI 응답에 문제가 없습니다.
- central_ideas_details · [generate] 미해소 — AI 응답에 문제가 없습니다.
- inferences · [generate] 미해소 — AI 응답에 문제가 없습니다.
- inferences · [generate] 미해소 — AI 응답에 문제가 없습니다.
- command_of_evidence_text · [review] 해소 — 어려움 문제인데 오답 D)이 지문·자료와 무관합니다
- command_of_evidence_text · [contract] 해소 — 객관식은 선택지 4개(A~D)여야 합니다(지금 5개). / Reading & Writing 문항은 선택지가 정확히 4개입니다(지금 5개).
- command_of_evidence_text · [generate] 미해소 — AI 응답에 문제가 없습니다.
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 C), D)이 너무 명백합니다
- cross_text_connections · [contract] 미해소 — 지문의 "road diets" 가 표·그래프의 항목(열·범주·계열·제목)에 없습니다.
- cross_text_connections · [contract] 미해소 — 지문의 "road diets" 가 표·그래프의 항목(열·범주·계열·제목)에 없습니다.
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 C)이 너무 명백합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 D)이 지문·자료와 무관합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 A), B), D)이 너무 명백합니다 / 어려움으로 요청했지만 독립 검사 추정 난이도가 easy 입니다 — 핵심 관계를 종합해야 풀리는 문항으로
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 B)이 너무 명백합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 B)이 너무 명백합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 B)이 지문·자료와 무관합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 C)이 지문·자료와 무관합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 C)이 지문·자료와 무관합니다
- cross_text_connections · [review] 미해소 — 어려움 문제인데 오답 B)이 지문·자료와 무관합니다
- cross_text_connections · [generate] 미해소 — AI 응답에 문제가 없습니다.
