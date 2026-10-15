# AP Psychology 공식 사실 검증 (2026-10-14, 무료)

유료 호출·DB·키·생성 없음. 공개 College Board 자료(AP Psychology CED, AP Central 시험 페이지)만 사용했고 문구는 짧은 요약만 쓴다(시험 문항·채점 문구 복제 없음). 공식 샘플 문항의 장면·수치는 쓰지 않는다.

**출처**
- [CED] AP Psychology Course and Exam Description (표지 "Effective Fall 2025", 쪽 바닥글 "Course Framework V.1" · "Exam Information V.1", ©2024): https://apcentral.collegeboard.org/media/pdf/ap-psychology-course-and-exam-description.pdf — 공개 PDF 를 로컬에서 `pdftotext -layout` 으로 추출해 대조(2026-10-14). 쪽 번호는 CED 인쇄 쪽.
- [AP Central] https://apcentral.collegeboard.org/courses/ap-psychology/exam (2026-10-14 조회): 시험 형식·전달 방식·시험 날짜.
- [data] `data/ap/curriculum-2027/ap_psychology.json`(이 작업에서 만든 CED 전사본: 단원·토픽·스킬·가중).

## 0. 요청 전제와 공식 사실의 차이 (먼저 읽을 것)
작업 지시서의 전제(2024 CED 9단원, MC·FRQ 형식)는 **현행 공식 문서와 다르다**. 아래 공식 값으로 구현했다.

| 항목 | 지시서 전제 | 공식(CED effective Fall 2025) |
|---|---|---|
| 단원 수·가중 | 9단원 | **5단원**, 각 **15–25 %** |
| MC | (미정; "100문항·70분"으로 오해하기 쉬움) | **75문항 · 90분 · 66.7 %**, 4지선다 |
| FRQ | Concept Application + Research Design | **Article Analysis(AAQ) + Evidence-Based(EBQ)**, 총 **70분 · 33.3 %**, 각 **7점** |
| 계산기·참조 시트 | "없을 것" | CED·AP Central 시험 안내에 **언급 없음** → 앱은 둘 다 제공하지 않는다(실제 시험 정책은 UNVERIFIED) |

## 1. 검증된 사실

| 항목 | 확인 결과 | 출처 |
|---|---|---|
| 시험 총 길이 | **2시간 40분**: MC 75문항·90분·66.7 % + FRQ 2문항·70분·33.3 % | CED p.147, [AP Central] |
| 전달 방식 | **완전 디지털**(Bluebook): MC·FRQ 모두 앱에서 응답·자동 제출. → `AP_FRQ_DELIVERY.ap_psychology = "digital"`(타이핑, 손글씨 UI 없음) | [AP Central] |
| 시험일 | 2027-05-14(금) 2교시 | [AP Central] |
| MC 선택지 | **4지선다(A–D)** — 샘플 MC 21개 전부 A–D | CED p.151–159 |
| MC 형태 | **단독 문항 + 공유 자료 세트**(CED: "set-based and discrete"). 샘플 21문항 = 단독 12 + 3문항 세트 3개(9). 세트는 연구 시나리오(표 포함) 하나에 3문항 | CED p.148, p.151–159 |
| MC 단원 가중 | U1 생물학적 기초 · U2 인지 · U3 발달과 학습 · U4 사회심리학과 성격 · U5 정신·신체 건강 — **각 15–25 %** | CED p.19·148, [data] |
| MC 과학 실천(Practice) 가중 | 실천 1 개념 적용 **65 %** · 실천 2 연구 방법·설계 **25 %** · 실천 3 자료 해석 **10 %**(모두 "approximate"). **실천 4(논증)는 MC 에서 평가하지 않는다** | CED p.148 |
| FRQ 1 AAQ | 요약된 동료 심사 논문 1편. **25분(읽기 10분 포함)**, **7점**: A 연구 방법 1 · B 변수의 조작적 정의 1 · C 통계 해석 1 · D 윤리 지침 1 · E 일반화 1 · F 가설 지지·반박 2. 실천 2·3·4 평가 | CED p.149·159–166, 채점 p.168–173 |
| FRQ 2 EBQ | 요약된 동료 심사 논문 3편(공통 주제). **45분(읽기 15분 포함)**, **7점**: A 주장 1 · B(i) 근거 1 · B(ii) 설명·적용 2 · C(i) 다른 출처 근거 1 · C(ii) 다른 개념 설명·적용 2. 실천 1·4 평가 | CED p.149·162–167, 채점 p.174–177 |
| FRQ task verb | Describe · Explain · Identify/State · Propose · Support or Refute · Use evidence | CED p.150 |
| 스킬 코드 | 실천 1: 1.A·1.B · 실천 2: 2.A–2.D · 실천 3: 3.A–3.C · 실천 4: 4.A·4.B (총 **11**) | CED p.13–17, [data] |
| 효과 크기 해석 | 작음 ≈ 0.2 이하 · 중간 0.3–0.7 · 큼 0.8 이상(통계적 유의성은 "결과가 우연일 가능성이 낮음") | CED p.15 |
| 통계 범위 | 평균·중앙값·최빈값·범위·표준편차·백분위, 정규분포의 비율(68-95-99.7 수준), 왜도·이봉분포 해석, 상관계수 해석, 효과 크기·유의성 해석 | CED p.13–15 |
| 계산기 | CED 와 AP Central 시험 안내에 계산기 언급이 없다(`calculator` 검색 0건). 계산은 손계산 수준(소수 몇 개의 평균·중앙값 등) | CED 전반 |
| 참조 자료 | 공식 수식·참조 시트 언급 없음 | CED 전반 |
| 토픽 | 5단원 · **35개 토픽**(U1 6 · U2 8 · U3 9 · U4 7 · U5 5), 토픽 권장 스킬 | CED p.27–127, [data] |
| 제외 진술 | 유전 세부(유전자형 등)·나트륨-칼륨 펌프·열거되지 않은 신경전달물질/호르몬·내분비샘 세부·정신분석적 꿈 이론·태아 발달 단계·화용론·정신성적 발달 단계·지연/흔적/동시/역행 조건화·기대 이론·매슬로 욕구 위계·감정 이론의 고유 이름은 **시험 범위 밖**. 5.4 장애는 CED 목록(범주별 예시)만 | CED 각 토픽 "Exclusion Statement" |

## 2. 구현에 옮긴 규칙
- 풀 모의고사: MC 75(4지선다) + FRQ 2(AAQ + EBQ) = 학생 화면 섹션 90분 + 70분. `lib/ap-exam/layouts.ts` `ap_psychology`.
- 단원 범위: 75문항에서 15–25 % → 정수 **11–19**(하한 내림·상한 올림, 다른 과목과 같은 관용). 목표 15/단원.
- Practice 범위: 공식 값이 "대략"이라 ±5%p **내부 관용(UNVERIFIED)** 으로 60–70 / 20–30 / 5–15 % → 정수 45–53 / 15–23 / 3–12. 차단 조건. 실천 4 는 MC 에서 금지(게이트 `skill_not_assessed_in_mc`).
- 공유 세트: 3문항·같은 단원·연속 위치. 회당 세트 개수는 **CED 미공표**(샘플은 21문항 중 3세트) — ALTON 은 회당 정확히 `PSYCH_SET_COUNT` 개를 쓰며 "공식 구성"이라 주장하지 않는다(`psych-rules.ts`).
- FRQ 분해 점수(AAQ A–F 1/1/1/1/1/2, EBQ A–E 1/1/2/1/2)는 공식 채점 지침의 점수 구조를 따른다. EBQ 의 공식 라벨 B(i)·B(ii)·C(i)·C(ii) 는 엔진의 파트 참조 검사 때문에 B–E 로 옮겼다(내용·점수 동일).

## 3. repo 와의 대조 — 정정·추가
| # | 위치 | 내용 | 조치 |
|---|---|---|---|
| 1 | `data/ap/curriculum-2027/` | `ap_psychology.json` 없음(10개 과목 중 심리학 없음) | CED 전사본 추가, `AP_SUBJECT_CODES` 에 추가, 커리큘럼 테스트 11개로 |
| 2 | `lib/ap-exam/layouts.ts` | `ap_psychology` 레이아웃·이름 없음 | MC 75/90분/4지선다, FRQ 2/70분 |
| 3 | `lib/ap-exam/frq-delivery.ts` | 항목 없음 | `digital`(AP Central 확인). DB `_ap_frq_paper_subject` 는 목록 밖이면 false 라 마이그레이션 불필요 |
| 4 | `lib/exam-tools/subject-tools.ts` | 기본값이 Desmos 탭 | 계산기·참조 패널 모두 끔 |
| 5 | `lib/ap-generation/gates.ts` | NOT_ASSESSED·OPTION_COUNT·FRQ 프로필·시간 상한 | 4.A·4.B 금지, 4지선다, AAQ/EBQ 프로필(7점·25/45분) |
| 6 | `lib/ap-admin/assemble-draft.ts` | `PS` 접두 없음 | `PS` → `ap_psychology`, `SET_ID_RE`·`service.ts` 저장 가능 정규식·`full-set-rules.ts` |
| 7 | `lib/ap-generation/gates.ts` `gateMc` | 공유 세트 문항의 본문 = 소개 + 질문이라 소개가 길면 `stem_too_long` | 세트 문항은 질문만 120단어 한도, 소개는 220단어 한도(다른 과목의 기존 통과 문항에는 영향 없음, 완화만) |

## 4. 남은 UNVERIFIED
1. Bluebook 내장 도구(계산기·메모·하이라이트 등)가 이 과목에서 어떻게 제공되는지. 앱은 계산기·참조 패널을 두지 않는다.
2. MC 공유 세트의 실제 개수·구성(샘플 3세트/21문항 기준 약 43 %가 세트 문항). 우리 풀 세트의 세트 비중은 재고 통과 수에 따라 정한 내부 값이다.
3. Practice 비중의 정확한 허용 범위(CED 는 대략값). ±5%p 는 내부 관용이다.
4. FRQ 문항별 시간 내부 구분(AAQ 읽기 10 + 쓰기 15, EBQ 읽기 15 + 쓰기 30)은 CED 값이지만 Bluebook 화면의 읽기 시간 처리 방식은 미확인. 앱은 섹션 70분 단일 타이머이다.
5. 2027 시험에 CED(2024)에서 달라지는 점이 있는지(AP Central 은 같은 CED 를 안내).
6. AP 점수(1–5) 환산은 하지 않는다(검증 계획 승인 전).
