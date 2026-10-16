# AP World History: Modern 공식 사실 검증 (2026-10-15, 무료)

유료 호출·DB·키·생성 없음. 공개 College Board 자료(AP World History: Modern CED, AP Central 시험 페이지·시험 일정 페이지)만 사용했고 문구는 짧은 요약만 쓴다(공식 샘플 문항·채점 지침의 본문은 복제하지 않는다).

**출처**
- [CED] AP World History: Modern Course and Exam Description, 표지 "Effective Fall 2026"(PDF 메타데이터 제목 "…Effective Fall 2026", 생성일 2026-05-17), 쪽 바닥글 "Course Framework V.1" · "Exam Information V.1" · "Scoring Guidelines V.1", ©2026, 260쪽. https://apcentral.collegeboard.org/media/pdf/ap-world-history-modern-course-and-exam-description.pdf — 공개 PDF 를 로컬에서 `pdftotext -layout`·`-raw` 로 추출해 대조(2026-10-15). 쪽 번호는 CED 인쇄 쪽.
- [AP Central] https://apcentral.collegeboard.org/courses/ap-world-history/exam (2026-10-15 조회): 시험 형식·전달 방식·시험일·"AP History Exam Updates for 2027". 시험 일정: https://apcentral.collegeboard.org/exam-administration-ordering-scores/exam-dates.
- [data] `data/ap/curriculum-2027/ap_world_history.json`(이 작업에서 만든 CED 전사본: 9개 단원·토픽 71·스킬 17·MC 단원 가중). 생성기 `scripts/ap-curriculum/wh-curriculum-build.py`.

## 1. 검증된 사실

| 항목 | 확인 결과 | 출처 |
|---|---|---|
| 시험 총 길이 | **3시간 15분** = MC 55분 + SAQ 40분 + Section II 100분(DBQ 60 + LEQ 40) | CED p.195 |
| 전달 방식 | **완전 디지털(Bluebook)**: MC·FRQ 모두 앱에서 응답, 종료 시 자동 제출. → `AP_FRQ_DELIVERY.ap_world_history = "digital"`(타이핑, 손글씨 UI 없음) | [AP Central] |
| 시험일 | 2027-05-06(목) 1교시(Session 1) | [AP Central] 시험 일정 |
| 2027 개편 | SAQ·LEQ 가 개편되어 2027-05 시험부터 적용("give back time, reposition choice, improve focus"). 강의 내용은 불변. AP European/US/World History 공통. **SAQ 는 3문항 전부 필수, LEQ 는 필수 1문항(선택 없음)** | [AP Central], CED p.195·198 |
| Section I Part A (MC) | **55문항 · 55분 · 40 %**. 대개 **3–4문항 세트**, 각 세트에 하나 이상의 자료: 1차 텍스트, 2차 텍스트, 이미지(미술·사진·포스터·만화), 도표·정량 자료, 지도. **짝지은 텍스트 자료 세트가 최소 1개**. 선택지는 CED 샘플 문항 전부 A–D(4지선다) | CED p.195·197, 샘플 |
| Section I Part B (SAQ) | **3문항 · 40분 · 20 %**, 3문항 전부 필수. **q1 2차 텍스트 자료, q2 1차 텍스트 자료, q3 1차/2차 비텍스트 자료**. 세 문항은 **1200–2001** 사이의 발전·과정을 다루며 **각각 서로 다른 시대(historical period)** 에 초점을 둔다. 각 문항 3점(파트 a·b·c 1점) | CED p.195·197, 채점 p.225 |
| Section II DBQ | **1문항 · 60분(읽기 15분 포함) · 25 %**, **문서 7개**(여러 관점), **1200–2001**, **7점**: A 논지 1 · B 맥락화 1 · C 증거(문서 3개 서술 1 / 4개로 논증 2 + 문서 밖 증거 1 = 0–3) · D 분석·추론(출처 분석 1 + 복합적 이해 1 = 0–2) | CED p.195·197, 루브릭 p.230–238 |
| Section II LEQ | **1문항 · 40분 · 15 %**, **필수(선택 없음)**, 넓은 문항으로 **과정 연표의 약 절반**을 포괄하며 학생은 일부 발전에 초점 가능. **6점**: A 논지 1 · B 맥락화 1 · C 증거 0–2 · D 분석·추론 0–2 | CED p.195·198, 루브릭 p.242–246 |
| 단원 가중 | U1 The Global Tapestry **8–10 %** · U2 Networks of Exchange **8–10 %** · U3 Land-Based Empires **12–15 %** · U4 Transoceanic Interconnections **12–15 %** · U5 Revolutions **12–15 %** · U6 Consequences of Industrialization **12–15 %** · U7 Global Conflict **8–10 %** · U8 Cold War and Decolonization **8–10 %** · U9 Globalization **8–10 %**. 연표 구간: U1–2 c.1200–c.1450 · U3–4 c.1450–c.1750 · U5–6 c.1750–c.1900 · U7–9 c.1900–현재 | CED p.196 |
| 역사적 사고 스킬 | 6범주 17코드: 1 발전과 과정(1.A·1.B) · 2 출처와 상황(2.A–2.C) · 3 출처 속 주장과 증거(3.A–3.D) · 4 맥락화(4.A·4.B) · 5 연결(5.A·5.B) · 6 논증(6.A–6.D). **MC 는 스킬 6(논증)을 명시적으로 평가하지 않는다**(1–5 만). SAQ 는 1–5 일부, DBQ·LEQ 는 4–6 | CED p.199 |
| 추론 과정 | 비교(Comparison)·인과(Causation)·연속과 변화(Continuity and Change) | CED 전반 |
| 6개 주제 | ENV 인간과 환경 · CDI 문화 발전·상호작용 · GOV 통치 · ECN 경제 체제 · SIO 사회적 상호작용·조직 · TEC 기술·혁신 | CED p.196 |
| 계산기·참조 자료 | 계산기·공식 수식 시트 언급 없음 | CED 전반 |
| task verb | Compare · Describe · Evaluate · Explain · Identify · Support an argument | CED p.200 |
| 토픽 | 9단원 · **71개 토픽**(U1 7 · U2 7 · U3 4 · U4 8 · U5 10 · U6 8 · U7 9 · U8 9 · U9 9) | CED 단원 안내 |
| 채점 일반 규칙 | 각 점수는 독립적으로 얻는다. 정확성: 서술한 내용이 역사적으로 옹호 가능해야 하며 사소한 오류는 감점되지 않는다. 명료성: 첫 초안으로 보고 문법 오류는 이해를 해치지 않는 한 감점하지 않는다 | CED p.224·230 |

## 2. 구현에 옮긴 규칙
- 풀 모의고사: MC 55(4지선다, 3–4문항 세트) 55분 + SAQ 3 40분 + DBQ·LEQ 100분. `lib/ap-exam/layouts.ts` `ap_world_history`(섹션 키 `ap_mc`·`ap_saq`·`ap_frq`). 학생 화면 섹션 타이머는 섹션별 단일 타이머이고 DBQ 읽기 15분의 분리는 하지 않는다(UNVERIFIED: Bluebook 의 읽기 시간 처리).
- 단원 범위: 공식 가중을 55문항에 옮길 때 하한 내림·상한 올림(다른 과목과 같은 관용) → U1·U2·U7·U8·U9 4–6 / U3–U6 6–9. 목표 배분(제안): 5/5/7/8/7/7/5/6/5(합 55)이며 3–4문항 세트로는 단원 합이 5가 될 수 없어 실제 구성은 4/4/8/8/7/8/6/6/4(합 55, 세트 15개 = 4문항 10 + 3문항 5)다. `lib/ap-exam/wh-rules.ts`.
- **단원은 DB 와 같은 개념으로 센다**: 관리자 새 버전·초안 검사는 후보 `keyword_code` 의 단원을 세트의 모든 칸에 적용한다. 배정기·검증기도 처음부터 같은 단원(`members[].unit` = 후보 keyword_code 단원, 문항별 토픽 단원은 `topicUnit`)을 쓰고, 세트 문항의 토픽은 세트 단원 안으로 제한한다(US History 1단계에서 두 기준이 달라 게시본이 DB 기준으로 범위 밖이던 교훈).
- 세트 크기 3–4(공식), 세트 수 14–18(내부 합의; 공식 미공표), 자료 유형 최소(내부): paired_text ≥ 1(공식), quantitative ≥ 1, image(그림·지도) ≥ 2, primary_text ≥ 4, secondary_text ≥ 2. 스킬 범주 1–5 각 ≥ 3(내부). 스킬 6 은 MC 금지(공식).
- FRQ 구성(공식): saq1(2차 텍스트)·saq2(1차 텍스트)·saq3(비텍스트)(각 3점, **서로 다른 시대 구간 1–4**) + DBQ(7점, 문서 7) + LEQ(6점, 구간 2개 이상). AI 채점 루브릭 id `whap-v1`(SAQ a·b·c / DBQ thesis·context·docs·outside·sourcing·complexity / LEQ thesis·context·evidence·analysis; 행 구성은 US History `ushistory-v1` 과 같은 공개 구조, 과목 이름·상한 환경변수만 다름).

## 3. repo 와의 대조 — 정정·추가
| # | 위치 | 내용 | 조치 |
|---|---|---|---|
| 1 | `data/ap/curriculum-2027/` | `ap_world_history.json` 없음 | CED 전사본 추가, `AP_SUBJECT_CODES`·테스트 14개 과목으로 |
| 2 | `lib/ap-exam/layouts.ts` | `ap_world_history` 레이아웃·이름 없음 | MC 55/55분, SAQ 3/40분, Section II 2/100분 |
| 3 | `lib/ap-exam/frq-delivery.ts` | 항목 없음 | `digital`(AP Central 확인) |
| 4 | `lib/exam-tools/subject-tools.ts` | 기본값이 계산기 탭 | 계산기·참조 패널 모두 끔 |
| 5 | `lib/ap-generation/gates.ts` | NOT_ASSESSED_MC·OPTION_COUNT | 6.A–6.D 금지, 4지선다 |
| 6 | `lib/ap-admin/assemble-draft.ts`·`service.ts` | `WH` 접두 없음(충돌 없음 확인: AB·BC·ST·PH·CH·MI·MA·PS·CS·BI·EL·LT·US) | `WH` → `ap_world_history`(`SET_ID_RE`·저장 가능 정규식), 초안 계획기 `assemble-wh-draft.ts` |
| 7 | `lib/ap-exam/convert.ts` | FRQ 참고 답안이 `ush_frq` 까지만 | `whap_frq` 도 같은 경로 |
| 8 | `lib/essay-grading/*` | 루브릭 레지스트리에 `ushistory-v1` 까지 | `whap-v1`(SAQ·DBQ·LEQ), `payload.ts` 가 `whap_frq`(스키마 `whap-frq-1`) 읽음, 과목 목록·SAQ 질문당 1건 처리 |
| 9 | `lib/problem-taxonomy.ts` | `ap_world_history` 항목은 이미 존재(supported:false) | 그대로 둠 |

## 4. 남은 UNVERIFIED
1. Bluebook 내장 도구(주석·메모·하이라이트 등)가 이 과목에서 어떻게 제공되는지, DBQ 15분 읽기 시간의 화면 처리.
2. MC 세트의 정확한 세트 수·자료 유형 분포(공식은 유형 목록만 제시). 우리 세트 수 14–18·유형 최소는 내부 값이다.
3. SAQ 의 "서로 다른 시대"를 CED 연표 구간(4개)으로 해석했다. 공식 채점·출제가 단원(9개) 단위인지 구간 단위인지는 CED 문장("each focus on a different historical period")만으로는 확정할 수 없어, 더 엄격한 구간 기준을 택했다.
4. 2027 개편 세부(SAQ·LEQ 시간 배분·선택 위치)는 CED(effective Fall 2026) 값이며 이후 개정 가능.
5. AP 점수(1–5) 환산은 하지 않는다(검증 계획 승인 전).
