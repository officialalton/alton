# AP U.S. History 공식 사실 검증 (2026-10-14, 무료)

유료 호출·DB·키·생성 없음. 공개 College Board 자료(AP U.S. History CED, AP Central 시험 페이지)만 사용했고 문구는 짧은 요약만 쓴다(공식 샘플 문항·채점 지침의 본문은 복제하지 않는다).

**출처**
- [CED] AP U.S. History Course and Exam Description, 표지 "Effective Fall 2026"(PDF 메타데이터 제목·생성일 2026-05), 쪽 바닥글 "Course Framework V.1" · "Exam Information V.1" · "Scoring Guidelines V.1", ©2026. https://apcentral.collegeboard.org/media/pdf/ap-us-history-course-and-exam-description.pdf — 공개 PDF 를 로컬에서 `pdftotext -layout` 으로 추출해 대조(2026-10-14). 쪽 번호는 CED 인쇄 쪽.
- [AP Central] https://apcentral.collegeboard.org/courses/ap-united-states-history/exam (2026-10-14 조회): 시험 형식·전달 방식·시험 날짜·"AP History Exam Updates for 2027".
- [data] `data/ap/curriculum-2027/ap_us_history.json`(이 작업에서 만든 CED 전사본: 9개 시대 단원·토픽 105·스킬 17·MC 단원 가중).

## 1. 검증된 사실

| 항목 | 확인 결과 | 출처 |
|---|---|---|
| 시험 총 길이 | **3시간 15분** = MC 55분 + SAQ 40분 + Section II 100분 | CED p.497 |
| 전달 방식 | **완전 디지털(Bluebook)**: MC·FRQ 모두 앱에서 응답·자동 제출. → `AP_FRQ_DELIVERY.ap_us_history = "digital"`(타이핑, 손글씨 UI 없음) | [AP Central] |
| 시험일 | 2027-05-07(금) 1교시 | [AP Central] |
| 2027 개편 | SAQ·LEQ 가 개편되어 2027-05 시험부터 적용("give back time, reposition choice, improve focus"). 강의 내용은 불변. AP European/US/World History 공통. **SAQ 는 3문항 전부 필수, LEQ 는 필수 1문항(선택 없음)** | [AP Central], CED p.497·499·500 |
| Section I Part A (MC) | **55문항 · 55분 · 40 %**. 대개 **3–4문항 세트**, 각 세트에 하나 이상의 자료: 1차 텍스트, 2차 텍스트, 이미지(미술·사진·포스터·만화), 도표·정량 자료, 지도. **짝지은 텍스트 자료 세트가 최소 1개**(MC 또는 SAQ 중). **4지선다(A–D)** — 샘플 17문항 전부 A–D | CED p.497·499·503–509 |
| Section I Part B (SAQ) | **3문항 · 40분 · 20 %**, 3문항 전부 필수. **q1 2차 텍스트 자료(복수), q2 1차 텍스트 자료 1개, q3 1차/2차 비텍스트 자료**. 세 문항은 **1491–2001** 범위에서 **서로 다른 시대**를 다룬다. 각 문항 3점(파트 A·B·C 각 1점) | CED p.497·499, 채점 p.523–525 |
| Section II DBQ | **1문항 · 60분(읽기 15분 포함) · 25 %**, **문서 7개**(글·정량·시각), **1754–1980**, **7점**: A 논지 1 · B 맥락화 1 · C 증거(문서 3개 서술 1 / 4개로 논증 2 + 문서 밖 증거 1 = 0–3) · D 분석·추론(출처 분석 1 + 복합적 이해 1 = 0–2) | CED p.497·499, 루브릭 p.517–519 |
| Section II LEQ | **1문항 · 40분 · 15 %**, **필수(선택 없음)**, 넓은 문항으로 **과정 연표의 약 절반**을 포괄, 학생은 일부 발전에 초점 가능. **6점**: A 논지 1 · B 맥락화 1 · C 증거 0–2 · D 분석·추론 0–2 | CED p.497·500, 루브릭 p.520–521 |
| 단원(시대) 가중 | P1 1491–1607 **4–6 %** · P2 1607–1754 **6–8 %** · P3 1754–1800 / P4 1800–1848 / P5 1844–1877 / P6 1865–1898 / P7 1890–1945 / P8 1945–1980 각 **10–17 %** · P9 1980–현재 **4–6 %** | CED p.498 |
| 역사적 사고 스킬 | 6범주 17코드: 1 발전과 과정(1.A·1.B) · 2 출처와 상황(2.A–2.C) · 3 출처 속 주장과 증거(3.A–3.D) · 4 맥락화(4.A·4.B) · 5 연결(5.A·5.B) · 6 논증(6.A–6.D). **MC 는 스킬 6(논증)을 명시적으로 평가하지 않는다**(1–5 만). SAQ·DBQ·LEQ 는 스킬 1·2·3(SAQ), 1–6(DBQ·LEQ) | CED p.16·501 |
| 추론 과정 | 비교(Comparison)·인과(Causation)·연속과 변화(Continuity and Change) | CED p.17 |
| 8개 주제 | NAT 미국·국가 정체성 · WOR 노동·교환·기술 · GEO 지리·환경 · MIG 이주·정착 · PCE 정치·권력 · WXT 세계 속 미국 · ARC 미국·지역 문화 · SOC 사회 구조 | CED p.498 |
| 계산기·참조 자료 | 계산기 언급 없음(`calculator` 용도 없음). 공식 수식·참조 시트 없음 | CED 전반 |
| task verb | Compare · Describe · Evaluate · Explain · Identify · Support an argument | CED p.502 |
| 토픽 | 9단원 · **105개 토픽**(U1 7 · U2 8 · U3 13 · U4 14 · U5 12 · U6 14 · U7 15 · U8 15 · U9 7) | CED 단원 안내 |
| 채점 일반 규칙 | 각 점수는 독립적으로 얻는다. 정확성: 서술한 내용이 역사적으로 옹호 가능해야 하며, 논지 전개에 쓰이는 내용이 정확하면 사소한 오류는 감점되지 않는다. 명료성: 첫 초안으로 보고 문법 오류는 이해를 해치지 않는 한 감점하지 않는다 | CED p.517, 524 |

## 2. 구현에 옮긴 규칙
- 풀 모의고사: MC 55(4지선다, 3–4문항 세트) 55분 + SAQ 3 40분 + DBQ·LEQ 100분. `lib/ap-exam/layouts.ts` `ap_us_history`(섹션 키 `ap_mc`·`ap_saq`·`ap_frq`). 학생 화면 섹션 타이머는 섹션별 단일 타이머이고 DBQ 읽기 15분의 분리는 하지 않는다(UNVERIFIED: Bluebook 의 읽기 시간 처리).
- 단원 범위: 공식 가중을 55문항에 옮길 때 하한 내림·상한 올림(다른 과목과 같은 관용) → P1 2–4 / P2 3–5 / P3–P8 5–10 / P9 2–4. 목표 배분(제안): 3/4/8/7/8/7/8/7/3(합 55). `lib/ap-exam/ush-rules.ts`.
- 세트 크기 3–4(공식), 세트 수 14–18(내부 합의; 공식 미공표), 자료 유형 최소(내부): paired_text ≥ 1(공식), quantitative ≥ 1, primary_text ≥ 5, secondary_text ≥ 2. 스킬 범주 1–5 각 ≥ 3(내부). 스킬 6 은 MC 금지(공식).
- FRQ 구성(공식): saq1·saq2·saq3(각 3점, 서로 다른 시대) + DBQ(7점) + LEQ(6점). AI 채점 루브릭 id `ushistory-v1`(SAQ a·b·c / DBQ thesis·context·docs·outside·sourcing·complexity / LEQ thesis·context·evidence·analysis). 영어 루브릭은 그대로.

## 3. repo 와의 대조 — 정정·추가
| # | 위치 | 내용 | 조치 |
|---|---|---|---|
| 1 | `data/ap/curriculum-2027/` | `ap_us_history.json` 없음(11개 과목) | CED 전사본 추가, `AP_SUBJECT_CODES`·테스트 12개 과목으로 |
| 2 | `lib/ap-exam/layouts.ts` | `ap_us_history` 레이아웃·이름 없음 | MC 55/55분, SAQ 3/40분, Section II 2/100분 |
| 3 | `lib/ap-exam/frq-delivery.ts` | 항목 없음 | `digital`(AP Central 확인) |
| 4 | `lib/exam-tools/subject-tools.ts` | 기본값이 계산기 탭 | 계산기·참조 패널 모두 끔 |
| 5 | `lib/ap-generation/gates.ts` | NOT_ASSESSED·OPTION_COUNT | 6.A–6.D 금지, 4지선다 |
| 6 | `lib/ap-admin/assemble-draft.ts`·`service.ts` | `US` 접두 없음 | `US` → `ap_us_history`(`SET_ID_RE`·저장 가능 정규식) |
| 7 | `lib/ap-exam/stimulus-display.ts` | ALTON 영어 지문 표지만 인식 | `ALTON-composed stimulus` 표지도 같은 처리(산문이라 수식 변환·중복 숨김 제외) |
| 8 | `lib/ap-exam/convert.ts` | `el_frq` 일 때만 reference_text 사용 | `ush_frq` 도 같은 경로 |
| 9 | `lib/essay-grading/*` | 영어 루브릭만 | 루브릭 레지스트리, `ushistory-v1`, SAQ 는 질문당 1건, 결과 카드 일반화 |

## 4. 남은 UNVERIFIED
1. Bluebook 내장 도구(주석·메모·하이라이트 등)가 이 과목에서 어떻게 제공되는지, DBQ 15분 읽기 시간의 화면 처리.
2. MC 세트의 정확한 세트 수·자료 유형 분포(공식은 유형 목록만 제시). 우리 세트 수 14–18·유형 최소는 내부 값이다.
3. 이미지(포스터·만화·사진)와 지도 자료: 우리 그림 렌더러에 지도·삽화가 없고 실제 이미지를 만들 수 없어 **이번 재고에는 텍스트·표·막대그래프 자료만** 있다(공식 MC 는 이미지·지도도 쓴다). SAQ q3 도 표·그래프로 대체했다.
4. 2027 개편 세부(SAQ·LEQ 시간 배분·선택 위치)는 CED(effective Fall 2026) 값이며 이후 개정 가능.
5. AP 점수(1–5) 환산은 하지 않는다(검증 계획 승인 전).
