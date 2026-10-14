# AP Biology 공식 사실 검증 (2026-10-13, 무료)

유료 호출·DB·키·생성 없음. 공개 College Board 자료만 사용했고 문구는 짧은 요약만 쓴다(시험 문항·채점 문구 복제 없음).

**출처**
- [CED] AP Biology Course and Exam Description (V.1, ©2025): https://apcentral.collegeboard.org/media/pdf/ap-biology-course-and-exam-description.pdf — 로컬 텍스트 추출(pdftotext) 후 대조. 쪽 번호는 CED 인쇄 쪽("Exam Information V.1 | n", "Appendix V.1 | n").
- [AP-exam] https://apcentral.collegeboard.org/courses/ap-biology/exam (2026-10-13 조회)
- [data] `data/ap/curriculum-2027/ap_biology.json`(repo 전사본: 단원·토픽·스킬 코드·단원 가중) — CED 와 아래 §1 항목을 대조해 일치 확인.

## 1. 검증된 사실

| 항목 | 확인 결과 | 출처 |
|---|---|---|
| 시험 총 길이 | **3시간**(MC 90분 + FRQ 90분), MC 60문항 + FRQ 6문항 | CED p.197, [AP-exam] |
| MC | **60문항·90분·50%**. "individual questions or in sets of **typically 4–5 questions** each". 세트의 개수는 공식 미공표 → UNVERIFIED(우리는 4문항 세트를 회당 2개로 둔다). 선택지 수는 4지(`layouts.ts` 4)이며 이 조사는 샘플 MC 전수 대조까지 하지 않았다 | CED p.197·201, [AP-exam] |
| FRQ | **6문항·90분·50%**: 긴 문항 2개(각 **9점**) + 짧은 문항 4개(각 **4점**) = **34점**. Q1 Interpreting and Evaluating Experimental Results(9) · Q2 …with Graphing(9) · Q3 Scientific Investigation(4) · Q4 Conceptual Analysis(4) · Q5 Analyze Model or Visual Representation of a Biological Concept or Process(4) · Q6 Analyze Data(4) | CED p.197 |
| FRQ 파트 구조 | Q1: A 1점(개념 서술) / B 3점(실험 방법 식별·자료 서술) / C 3점(방법·자료 분석·계산) / D 2점(예측과 정당화). Q2: A 1 / **B 4점(그래프 작성)** / C 2(자료 분석·계산·귀무가설·예측) / D 2. 짧은 문항은 모두 **정확히 1점 파트 A–D**: Q3 개념 서술 · 실험 절차 · 귀무가설 또는 예측 · 예측 정당화 / Q4 서술 · 설명 · 변화의 원인·결과 예측 · 예측 정당화 / Q5 모델 특징 서술 · 특징 간 관계 설명 · 모델 안의 관계 표현 · 큰 원리와 연결 / Q6 자료 서술 · 자료 서술 · 자료로 가설 평가 · 결과와 원리 연결. **짧은 네 문항은 각각 다른 빅 아이디어·다른 단원** | CED p.201–202 |
| **단원 MC 가중** | U1 8–11, U2 10–13, U3 12–16, U4 10–15, U5 8–11, U6 12–16, U7 13–20, U8 10–15 (%) | CED p.198, [data] 일치 |
| **Practice MC 가중** | **P1 개념 설명 25–33, P2 시각 표현 16–24, P3 질문·방법 8–14, P4 자료 표현·서술 8–14, P5 통계·자료 분석 8–14, P6 논증 20–26** (%) — `curriculum-data` 의 메모("CED 가 Practice 가중을 공표하지 않는다")는 **틀렸다**(CED p.201 에 표가 있다). FRQ 쪽 Practice 비중은 공표되지 않았다(섹션 설명만) | CED p.201 |
| 스킬 코드 | 6 Practice·22 코드: 1.A–1.C, 2.A–2.D, 3.A–3.D, 4.A–4.B, 5.A–5.D, 6.A–6.E. **4.A(그래프 작성)는 FRQ 전용**(MC 는 그래프를 그리게 할 수 없다) | [data], CED p.199–200 |
| FRQ task verb | Calculate·Construct/Draw·Describe·Determine·Evaluate·Explain·Identify·Justify·Make a claim·Predict·Represent·State — 파트 지시문의 동사로 사용 | CED p.203 |
| **계산기** | "A **four-function, scientific, or graphing calculator** is allowed on **both sections**". Bluebook 내장 계산기·Desmos 제공 여부는 **UNVERIFIED** | CED p.197, [AP-exam]("Calculators are permitted") |
| **참조 자료** | **AP Biology Equations and Formulas** 시트가 제공된다(인쇄 + Bluebook): 평균·표준편차·**표준오차 SE = s/√n**·**카이제곱 χ² = Σ(o−e)²/e 와 임계값 표(df 1–8, p 0.05·0.01)**(자유도 = 가능한 결과 수 − 1), 확률 법칙(상호 배타 합·독립 곱), **하디–바인베르크 p²+2pq+q²=1, p+q=1**, 최빈값·중앙값·평균·범위, **속도 dY/dt, 개체군 증가 dN/dt=B−D, 지수 dN/dt=r_max N, 로지스틱 dN/dt=r_max N(K−N)/K**, **심프슨 다양도 1−Σ(n/N)²**, **수분 퍼텐셜 Ψ=Ψ_P+Ψ_S, Ψ_S=−iCRT(R=0.0831 L·bar/(mol·K), T=°C+273; 열린 용기에서 Ψ_P=0)**, 구·직육면체·원기둥·정육면체의 표면적과 부피, 미터법 접두어. **깁스 자유에너지·Q10·미카엘리스–멘텐 식은 없다** — 원형은 시트에 없는 식을 쓰지 않는다 | CED Appendix p.230–231 |
| 전달 방식 | **하이브리드**: MC·FRQ 문제는 Bluebook 이지만 **FRQ 답은 종이 책자에 손으로 작성**. `lib/ap-exam/frq-delivery.ts` `ap_biology: "paper"` 와 일치. Q2 의 그래프 작성은 종이에 그린다 | [AP-exam] |
| 시험 구조 변화(2027) | 변화 없음(`docs/ap/2027-exam-spec-table.md` 와 일치) | spec-table |
| 내용 범위 | 8단원·토픽 60개(`ap_biology.json`). 4 빅 아이디어(진화·에너지론·정보 저장과 전달·시스템 상호작용) | CED p.197 |

## 2. repo 와의 대조 — 불일치·정정 목록

| # | 위치 | 내용 | 조치 |
|---|---|---|---|
| 1 | `lib/ap-exam/layouts.ts` `ap_biology` | 60문항·90분·4지선다·FRQ 6·90분·`allowed` — **공식과 일치** | 변경 없음 |
| 2 | `data/ap/curriculum-2027/ap_biology.json` designNotes | "CED 는 Practice 별 가중을 공표하지 않는다" — **오류**(CED p.201 표). weights 배열에 Practice 축이 없다 | `biology-facts.md` 와 `bio_coverage.py`·`full-set-rules.ts` 에 P1 25–33 … P6 20–26 을 직접 둔다(데이터 파일 자체는 건드리지 않음 — 다른 세션이 쓰는 입력 데이터) |
| 3 | `lib/exam-tools/subject-tools.ts` | `ap_biology` 항목이 없었다(기본 Desmos). CED 는 사칙·공학용·그래핑 모두 허용 | 공학용 계산기 + Reference 패널(`reference: "biology"`) |
| 4 | `lib/ap-generation/stats-set.ts` | 공유 자료 세트 크기가 Bio 에 없었다 | `setSizeOf("ap_biology") = 4` |
| 5 | `lib/ap-generation/bio-frq-checks.ts` | 대조군 표 규칙이 모든 문항 문구의 'control'(controlled variable 포함)에 걸렸고, 그래프 작성 파트가 '표 자료인데 그래프 언급' 검사에 걸렸다 | 표 집단 라벨이 있을 때만 대조군 규칙, construct/draw/plot/sketch 파트는 그래프 언급 허용 |

## 3. 남은 UNVERIFIED
1. MC 공유 자료 세트의 개수(우리는 회당 4문항 세트 2개를 둔다; 공식 구성이라고 주장하지 않는다).
2. 4칙 포함 계산기 허용은 확인했으나 Bluebook 내장 계산기 형태(Desmos 제공 여부).
3. 공식 수식 시트와 우리 Reference 패널의 1:1 일치(패널은 ALTON 자체 문구로 "ALTON study reference — not the official College Board sheet" 고지).
4. 문항별 FRQ 시간(공식 미공표 — 내부 점수 비례 추정, 게이트에는 쓰지 않는다 — `bio-frq-rules.md` §5).
5. MC 샘플 전수 대조(문항 수 4지 선다 외 선택지 구성).
6. FRQ 답안을 **앱에서 어떻게 받을지**는 제품 결정(실제 시험은 종이 손글씨; 현재 구현은 타이핑·Handwrite 둘 다 허용).
