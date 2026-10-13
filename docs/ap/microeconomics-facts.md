# AP Microeconomics 공식 사실 검증 (2026-10-13, 무료)

유료 호출·DB·키·생성 없음. 공개 College Board 자료만 사용했고 문구는 짧은 요약만 쓴다(시험 문항·채점 문구 복제 없음).

**출처**
- [CED] AP Microeconomics Course and Exam Description (V.1, ©2026): https://apcentral.collegeboard.org/media/pdf/ap-microeconomics-course-and-exam-description.pdf — 로컬 텍스트 추출(pdftotext) 후 대조. 쪽 번호는 CED 인쇄 쪽("Exam Information V.1 | n").
- [AP-exam] https://apcentral.collegeboard.org/courses/ap-microeconomics/exam (2026-10-13 조회)
- [data] `data/ap/curriculum-2027/ap_microeconomics.json`(repo 전사본: 단원·토픽·스킬 코드·가중) — CED 와 아래 §1 항목을 대조해 일치 확인.

## 1. 검증된 사실

| 항목 | 확인 결과 | 출처 |
|---|---|---|
| 시험 총 길이 | **2시간 10분**: MC 60문항·70분·66.65% + FRQ 3문항·60분(읽기 10분 포함)·33.35% | CED p.121, [AP-exam] |
| 시험일 | 2027-05-04(화) Session 2 | [AP-exam] |
| MC 선택지 | **5지선다(A–E)** — 샘플 문항 15개 전부 A–E. `layouts.ts`·`OPTION_COUNT` 5 와 일치 | CED p.126–132 |
| MC 공유 자료 | 샘플은 "Questions 4 and 5 refer to the graph below" 형태의 2문항 공유 그래프가 있다. **세트의 개수·크기는 공식 미공표** → UNVERIFIED. 우리 구성은 단독 문항만 쓴다(공식 구성이라고 주장하지 않음) | CED p.128 |
| FRQ | **3문항**: 긴 문항 1개(**10점**) + 짧은 문항 2개(각 **5점**) = **20점**. "Question 1: Long (10 points) / Question 2: Short (5) / Question 3: Short (5)" | CED p.121 |
| FRQ 문항별 시간 | **공식 미공표**(60분 중 10분은 읽기). 우리 내부 추정: 쓰기 50분 / 20점 = 점당 2.5분 → 긴 약 25분, 짧은 약 12.5분. `MICRO_PROFILE` 과 일치 | CED p.121, 내부 추정 |
| FRQ 과제 유형 비중(FRQ 점수 기준) | 단언(assertion, 스킬 범주 1–3) **10–20%**, 설명(explain, 범주 1–3) **25–35%**, 수치 분석(calculate, 범주 1–3) **15–30%**, **그래프·시각 표현(범주 4) 30–50%** | CED p.124, [data] 일치 |
| 단원 MC 가중 | U1 12–15, U2 20–25, U3 22–25, U4 15–22, U5 10–13, U6 8–13 (%) | CED p.122, [data] 일치 |
| 스킬 범주 MC 가중 | 범주 1 원리·모형 **30–42%**, 범주 2 해석 **37–47%**, 범주 3 조작 **16–25%**, **범주 4(그래프 그리기)는 MC 에서 평가하지 않는다**(MC 는 그래프를 읽는 문항만). 범주 1·2·3 의 수치 분석 스킬(1.C·2.C·3.C) 문항이 **MC 의 20–30%** | CED p.123, [data] 일치 |
| 스킬 코드 | 4 범주·13 코드: 1.A–1.D, 2.A–2.C, 3.A–3.C, 4.A–4.C (이름은 `ap_microeconomics.json`) | [data] |
| FRQ task verb | Identify · Explain · Calculate(풀이 과정 필수) · Draw a correctly labeled(라벨 필수) · Show/Label/Plot/Indicate(축·곡선 라벨과 이동 방향 필수) | CED p.125 |
| 샘플 FRQ 형태 | 긴 문항: 완전경쟁 상품시장과 개별 농가를 나란히 그리고(라벨 Q·가격), 가격 하한 도입 후 공급량·이윤 음영, 탄력성과 소비 지출, 노동 수요, 대체재·보완재 파트 — 단원 2·3·5·6 에 걸친 복합. 짧은 문항: 보수행렬(우월전략·내시균형·협조 시 결과). 채점은 분석적 1점 행 | CED p.133–134, 6091 이하 |
| **계산기** | **사칙(four-function) 계산기가 두 섹션 모두에서 허용**(2022–23 학년도부터). 공학용·그래핑 필수가 아니다. Bluebook 내장 계산기 형태·Desmos 제공 여부는 **UNVERIFIED** | CED p.121, [AP-exam]("Calculators are permitted") |
| **참조 자료** | CED 의 시험 안내에 **공식 제공 수식 시트 언급이 없다**(경제학은 암기·정의 중심). → ALTON 은 학생 연습용으로 **자체 문구의 수식 요약 패널**을 둔다("ALTON study reference — not the official College Board sheet"). 공식 시트가 있다고 주장하지 않는다 | CED 전반 |
| 전달 방식 | **하이브리드**: MC 는 Bluebook, FRQ 문제는 Bluebook 에서 보지만 **답(그래프 포함)은 종이 책자에 손으로 작성**. `lib/ap-exam/frq-delivery.ts` `ap_microeconomics: "paper"` 와 일치 | [AP-exam] |
| 시험 구조 변화(2027) | 구조 변화 없음(`docs/ap/2027-exam-spec-table.md` 와 일치) | spec-table |
| 내용 범위 | 6단원 · 토픽 36개(`ap_microeconomics.json`). 거시 내용·계량 경제·게임 이론의 혼합 전략·수식 미적분은 범위 밖 | CED 단원 표, [data] |

## 2. repo 와의 대조 — 불일치·정정 목록

| # | 위치 | 내용 | 조치 |
|---|---|---|---|
| 1 | `lib/ap-exam/layouts.ts` `ap_microeconomics` | MC 60·70분·**5지선다**·FRQ 3·60분·`allowed` — **공식과 일치** | 변경 없음 |
| 2 | `lib/ap-generation/gates.ts` | `OPTION_COUNT` 5, `NOT_ASSESSED_MC` 4.A–4.C, `MICRO_PROFILE`(긴 10 / 짧은 5, 점당 2.5분) — **공식과 일치**. `MATH_SUBJECT` 에서 Micro 제외(달러가 통화) | 변경 없음 |
| 3 | `lib/exam-tools/subject-tools.ts` | `ap_microeconomics` 항목이 없었다(기본 Desmos 탭). 공식은 **사칙 계산기**이며 그래핑은 요구하지 않는다 | 사칙·공학용이 아니라 **사칙 계산기 + Micro 수식 요약 패널**로 구성(P0) |
| 4 | `scripts/ap-generation/cells.ts` `ap_microeconomics` | 옛 목업 칸(MC 30, FRQ 3 유형) — 풀 세트 용도가 아니다 | 변경 없음(레거시 경로, 풀 세트는 `micro-assign.ts`) |
| 5 | `lib/ap-admin/assemble-draft.ts` | `SET_PREFIX_SUBJECT` 에 `MI` 없음 | `MI` → `ap_microeconomics` 추가(P3) |

## 3. 남은 UNVERIFIED
1. MC 공유 그래프 세트의 개수·크기(우리는 단독 문항만 쓴다).
2. Bluebook 내장 계산기 형태(Desmos 제공 여부). 앱은 사칙 계산기를 제공한다.
3. 공식 수식 시트 존재 여부(CED 에 언급 없음 → 없다고 가정하지만 확정 아님). 우리 Reference 패널은 ALTON 자체 문구.
4. FRQ 문항별 시간(내부 추정).
5. FRQ 답안을 **앱에서 어떻게 받을지**는 제품 결정(실제 시험은 종이 손글씨·그래프 그리기; 현재 구현은 타이핑·Handwrite 둘 다 허용).
