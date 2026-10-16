# 유형별 표본 생성·품질 계약 검증 — 난이도 hard (2026-09-15 21:34)

파이프라인: 생성 → 자료 필요 시 자료 생성 → 유형별 품질 계약(질문 대상·자료 근거·표시·정답·답안 형식) → 독립 품질 검사(정답 일치·오답 품질·추정 난이도) → 실패 시 사유 피드백 1회 재생성 → 부족분 1회 재생성. DB 저장 없음(보고서만). 총 소요 25분.

**요청 18 · 통과 8 (44%) · 오답 보강 대기 12건(별도 — 통과에 포함 안 함) · 재생성 9회(해소 1) · 오답 부분수정 13회(해소 1) · 필드 부분수정 7회(해소 7) · 검토 필요 3 · 문항당 평균 모델 호출 4.88회**

## 유형별

| 세부 기술 | 체계·형식 | 단건 | 복수 | 재생성(해소) | 오답 부분수정(해소) | 필드 부분수정(해소) | 대기 | 추정 난이도 분포 | 검토 필요 | 미해소 실패 사유 | 초 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Linear functions (`linear_functions`) | sat_math · mc | 1/1 | 2/2 | 0(0) | 0(0) | 0(0) | 0 | e0 m3 h0 | 3 | — | 96 |
| Lines, angles, and triangles (`lines_angles_triangles`) | sat_math · mc | 0/1 | 0/2 | 9(1) | 1(0) | 0(0) | 1 | e0 m0 h0 | 0 | [contract] 자료 필수 문항입니다 — Lines, angles, and triangles 문항이 도형(figure)을 가리키므로 도형 자료<br>[contract] 자료 필수 문항입니다 — Lines, angles, and triangles 문항이 도형(figure)을 가리키므로 도형 자료<br>[review] 독립 검사 지적: 생성기 설계와 실제 계산 확인: (2x+14)+(3x-4)+62=180 => 5x+72=180 => 5x=1<br>[generate] 부족분 재생성 실패: AI 응답에 문제가 없습니다.<br>[contract] 자료 필수 문항입니다 — Lines, angles, and triangles 문항이 도형(figure)을 가리키므로 도형 자료<br>[contract] 각 라벨 'x°' 가 그림 밖으로 나갑니다. / 점 이름 'E' 가 그림 밖으로 나갑니다.<br>[contract] 각 라벨 'x°' 가 그림 밖으로 나갑니다. / 점 이름 'E' 가 그림 밖으로 나갑니다.<br>[contract] 꼭짓점 이름(D) 'D' 가 그림 밖으로 나갑니다.<br>[contract] 꼭짓점 이름(D) 'D' 가 그림 밖으로 나갑니다.<br>[review] 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 어려움 문제<br>[contract] 자료 필수 문항입니다 — Lines, angles, and triangles 문항이 도형(right triangle)을 가리키<br>[contract] 자료 필수 문항입니다 — Lines, angles, and triangles 문항이 도형(right triangle)을 가리키<br>[contract] 높이 발 이름 'D' 가 각 표시와 겹칩니다. / 높이 발 이름 'D' 가 선과 겹칩니다.<br>[generate] 부족분 재생성 실패: AI 응답에 문제가 없습니다. | 400 |
| Central Ideas and Details (`central_ideas_details`) | sat_rw · mc | 1/1 | 1/2 | 0(0) | 7(1) | 4(4) | 6 | e0 m0 h2 | 0 | [generate] 부족분 재생성 실패: AI 응답에 문제가 없습니다. | 395 |
| Inferences (`inferences`) | sat_rw · mc | 0/1 | 0/2 | 0(0) | 0(0) | 0(0) | 0 | e0 m0 h0 | 0 | [generate] AI 응답에 문제가 없습니다.<br>[generate] AI 응답에 문제가 없습니다. | 153 |
| Command of Evidence (Textual) (`command_of_evidence_text`) | sat_rw · mc | 1/1 | 2/2 | 0(0) | 1(0) | 3(3) | 1 | e0 m0 h3 | 0 | — | 177 |
| Cross-Text Connections (`cross_text_connections`) | sat_rw · mc | 0/1 | 0/2 | 0(0) | 4(0) | 0(0) | 4 | e0 m0 h0 | 0 | [generate] AI 응답에 문제가 없습니다. | 275 |

## 실패 단계별

| 단계 | 건수 | 재생성으로 해소 |
|---|---|---|
| contract | 10 | 0 |
| review | 3 | 1 |
| generate | 6 | 0 |

## 반복되는 실패 사유(상위)

| 사유(숫자·인용 일반화) | 건수 |
|---|---|
| 자료 필수 문항입니다 — Lines, angles, and triangles 문항이 도형(figure)을 가리키므로 도형 자료가 필요합니다. '도형' 자료를 만들 | 3 |
| 부족분 재생성 실패: AI 응답에 문제가 없습니다. | 3 |
| AI 응답에 문제가 없습니다. | 3 |
| 각 라벨 'x°' 가 그림 밖으로 나갑니다. / 점 이름 'E' 가 그림 밖으로 나갑니다. | 2 |
| 꼭짓점 이름(D) 'D' 가 그림 밖으로 나갑니다. | 2 |
| 자료 필수 문항입니다 — Lines, angles, and triangles 문항이 도형(right triangle)을 가리키므로 도형 자료가 필요합니다. '도형 | 2 |
| 독립 검사 지적: 생성기 설계와 실제 계산 확인: (Nx+N)+(Nx-N)+N=N => Nx+N=N => Nx=N => x=N.N, 이는 선택지 중 어느 것과도  | 1 |
| 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) | 1 |
| 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 어려움 문제인데 오답 A)이 너무 명백합니다 | 1 |
| 높이 발 이름 'D' 가 각 표시와 겹칩니다. / 높이 발 이름 'D' 가 선과 겹칩니다. | 1 |

## 전체 실패 목록

- lines_angles_triangles · [contract] 미해소 — 자료 필수 문항입니다 — Lines, angles, and triangles 문항이 도형(figure)을 가리키므로 도형 자료가 필요합니다. '도형' 자료를 만들거나 그림을 올린 뒤 저장하세요. / 지문이 그림을 가리키는데("as shown", "figure") 그림이 없습니다.
- lines_angles_triangles · [contract] 미해소 — 자료 필수 문항입니다 — Lines, angles, and triangles 문항이 도형(figure)을 가리키므로 도형 자료가 필요합니다. '도형' 자료를 만들거나 그림을 올린 뒤 저장하세요. / 지문이 그림을 가리키는데("as shown", "figure") 그림이 없습니다.
- lines_angles_triangles · [review] 미해소 — 독립 검사 지적: 생성기 설계와 실제 계산 확인: (2x+14)+(3x-4)+62=180 => 5x+72=180 => 5x=108 => x=21.6, 이는 선택지 중 어느 것과도 일치하지 않음. 즉 문제 설계에 오류가 있을 가능성 있음. 만약 62 대신 118을 그대로 사용: 5x+10
- lines_angles_triangles · [generate] 미해소 — 부족분 재생성 실패: AI 응답에 문제가 없습니다.
- lines_angles_triangles · [review] 해소 — 독립 검사는 C)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음)
- lines_angles_triangles · [contract] 미해소 — 자료 필수 문항입니다 — Lines, angles, and triangles 문항이 도형(figure)을 가리키므로 도형 자료가 필요합니다. '도형' 자료를 만들거나 그림을 올린 뒤 저장하세요. / 지문이 그림을 가리키는데("as shown", "figure") 그림이 없습니다.
- lines_angles_triangles · [contract] 미해소 — 각 라벨 'x°' 가 그림 밖으로 나갑니다. / 점 이름 'E' 가 그림 밖으로 나갑니다.
- lines_angles_triangles · [contract] 미해소 — 각 라벨 'x°' 가 그림 밖으로 나갑니다. / 점 이름 'E' 가 그림 밖으로 나갑니다.
- lines_angles_triangles · [contract] 미해소 — 꼭짓점 이름(D) 'D' 가 그림 밖으로 나갑니다.
- lines_angles_triangles · [contract] 미해소 — 꼭짓점 이름(D) 'D' 가 그림 밖으로 나갑니다.
- lines_angles_triangles · [review] 미해소 — 독립 검사는 B)을 정답으로 골랐습니다 — 지정 정답과 다릅니다(정답이 둘이거나 지정 정답이 틀렸을 수 있음) / 어려움 문제인데 오답 A)이 너무 명백합니다
- lines_angles_triangles · [contract] 미해소 — 자료 필수 문항입니다 — Lines, angles, and triangles 문항이 도형(right triangle)을 가리키므로 도형 자료가 필요합니다. '도형' 자료를 만들거나 그림을 올린 뒤 저장하세요.
- lines_angles_triangles · [contract] 미해소 — 자료 필수 문항입니다 — Lines, angles, and triangles 문항이 도형(right triangle)을 가리키므로 도형 자료가 필요합니다. '도형' 자료를 만들거나 그림을 올린 뒤 저장하세요. / 선택지 4에 수식 기호($…$) 밖에 LaTeX 제어문이 있습니다 — 그대
- lines_angles_triangles · [contract] 미해소 — 높이 발 이름 'D' 가 각 표시와 겹칩니다. / 높이 발 이름 'D' 가 선과 겹칩니다.
- lines_angles_triangles · [generate] 미해소 — 부족분 재생성 실패: AI 응답에 문제가 없습니다.
- central_ideas_details · [generate] 미해소 — 부족분 재생성 실패: AI 응답에 문제가 없습니다.
- inferences · [generate] 미해소 — AI 응답에 문제가 없습니다.
- inferences · [generate] 미해소 — AI 응답에 문제가 없습니다.
- cross_text_connections · [generate] 미해소 — AI 응답에 문제가 없습니다.
