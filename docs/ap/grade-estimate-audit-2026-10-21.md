# AP 예상 등급 — 배점·가중치·환산표 감사 (2026-10-21)

범위: 공개 세트가 있는 18과목. 방법: 코드·문서 전수 검색 + 비프로덕션 DB 읽기 전용 SELECT(쓰기 없음). 같은 내용의 기계 판독본: `docs/ap/grade-estimate-audit-2026-10-21.json`.
오너 방향: 예상 1~5등급은 **향후 제공**. 현재 숨김은 임시. 이 문서는 "지금 근거가 있는 것 / 없는 것"만 가른다.

## 1. 결론

1. **어느 과목에도 1~5 경계점(점수 → 등급 환산표) 값이 없다.** 코드·DB·문서 어디에도 저장돼 있지 않고, 따라서 값 성격은 전 과목 "없음"이다(공식·외부 추정·내부 임시 모두 아님). 환산이 적용된 세트도 0개다.
2. 코드에 있는 점수 관련 상수·로직은 아래 §3 에 전부 나열했다. 등급 환산으로 이어지는 것은 없다.
3. **FRQ 만점은 DB 문항 데이터로 실제 합계를 확인했다**(모든 공개 풀 세트). CS A: 최신 공식 CED 인쇄 페이지 145 의 배점은 7/7/5/6점 총 25점(오너 확인). 세트 1·2 는 이 구조와 일치하고 세트 3 만 9×4=36점으로 구조가 다르다(§7 정정안).
4. 섹션 비중은 저장소 문서가 CED·AP Central 을 인용해 기록한 값이다. **이 세션에서 1차 문서와 재대조하지 않았다**(표의 `recorded`). Micro·Macro 는 오너 확인값 Fall 2026 CED MC 66.65% · FRQ 33.35%(장문 50% · 단문 각 25%)로 확정(`owner`, CED 쪽수 미기록; 66⅔ 가정 제거). Physics C: Mechanics 도 오너 확인값.
5. FRQ AI 채점(점수 추정)은 **영어 2과목 + 미국사·세계사**에만 있다(보정 통과). 유럽사는 코드만 있고 꺼져 있으며 보정 미실행. 나머지 12과목은 FRQ 점수를 낼 방법 자체가 없다 → 합산 점수·등급 불가.
6. 응시 데이터는 사실상 없다: 공개 AP 세트 전체 응시 17건, 그중 테스트 계정 12건, 실사용자 5건(채점 완료는 English Language 1건뿐). 환산을 맞출 수 있는 표본이 아니다.

## 2. 감사표 (대상 시험 연도: 2027년 5월)

범례 — 섹션 비중 `[recorded]` = 저장소 문서가 출처 인용, `[owner]` = 오너 확인,  FRQ "DB 확인" = 공개 풀 세트의 문항 점수 합을 SELECT 로 직접 합산. FRQ AI 열의 "켜짐 가능"은 코드·보정이 갖춰졌다는 뜻이며 프로덕션 플래그 값은 이 감사에서 확인하지 않았다(플래그 `AI_ESSAY_GRADING_ENABLED`, 기본 꺼짐). 응시 = 전체/테스트 제외 실사용/그중 채점 완료(**비아카이브 공개 세트 기준**; 아카이브 세트까지 합치면 AP 응시 79건, §8-3). 준비도는 §4.

| # | 과목 | MC | FRQ(총점) | 섹션 비중(근거) | 1~5 경계점·성격 | 환산 적용 세트 | 공개 세트(풀/부분) | 응시(전체/실사용/채점) | FRQ AI 채점 | 준비도 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | English Language | 45Q·60min | 3 essays·135min; 18 (6×3, DB 확인) | MC 45 / FRQ 55 [recorded] | 없음 | 0 | 2/0 | 3/1/1 | englang-v2 · 보정 18샘플 MAE 0.33·주입 시험 통과 · 켜짐 가능 | 상 |
| 2 | English Literature | 55Q·60min | 3 essays·120min; 18 (6×3, DB 확인) | MC 45 / FRQ 55 [recorded] | 없음 | 0 | 2/0 | 0/0/0 | englit-v1 · 보정 18샘플 MAE 0.17 · 켜짐 가능 | 상 |
| 3 | U.S. History | 55Q·55min | SAQ 3·40min + DBQ·LEQ·100min; 22 (SAQ 9+DBQ 7+LEQ 6, DB 확인) | MC 40 / SAQ 20 / DBQ 25 / LEQ 15 [recorded] | 없음 | 0 | 2/0 | 0/0/0 | ushistory-v1 · 보정 30샘플 MAE 0.17 · 켜짐 가능 | 상~중 |
| 4 | World History: Modern | 55Q·55min | 같은 구성; 22 (DB 확인) | 위와 같음 [recorded] | 없음 | 0 | 2/0 | 1/1/0 | whap-v1 · 보정 30샘플 MAE 0.167 · 켜짐 가능 | 상~중 |
| 5 | European History | 55Q·55min | 같은 구성; 22 (DB 확인) | 위와 같음 [recorded] | 없음 | 0 | 2/0 | 0/0/0 | euro-v1 · **꺼짐**(`EURO_ESSAY_GRADING_VALIDATED=false`), 보정 미실행 | 중 |
| 6 | Psychology | 75Q·90min | 2 FRQ·70min; 14 (7+7, DB 확인) | MC 66.7 / FRQ 33.3 [recorded] | 없음 | 0 | 2/0 | 2/0/0 | 없음(루브릭 미구현) | 중 |
| 7 | Microeconomics | 60Q·70min | 3 FRQ·60min; 20 (DB 확인) | MC 66.65 / FRQ 33.35 (장문 50·단문 25·25) [owner] | 없음 | 0 | 3/0 | 1/1/0 | 없음(그래프 그리기 채점 필요) | 중 |
| 8 | Macroeconomics | 60Q·70min | 3 FRQ·60min; 20 (DB 확인) | 위와 같음 [owner] | 없음 | 0 | 3/0 | 2/0/0 | 없음 | 중 |
| 9 | Statistics | 42Q·90min | 4 FRQ·90min; 40 (10×4, DB 확인) | MC 50 / FRQ 50 [recorded] | 없음 | 0 | 5/0 | 0/0/0 | 없음 | 하 |
| 10 | Biology | 60Q·90min | 6 FRQ·90min(종이 손글씨); 34 (DB 확인) | MC 50 / FRQ 50 [recorded] | 없음 | 0 | 4/0 | 0/0/0 | 없음(종이 FRQ) | 하 |
| 11 | Chemistry | 60Q·90min | 7 FRQ·105min(종이); 46 (DB 확인) | MC 50 / FRQ 50 [recorded] | 없음 | 0 | 3/0 | 0/0/0 | 없음(종이 FRQ) | 하 |
| 12 | Physics 1 | 42Q·85min | 4 FRQ·95min(종이); 40 (DB 확인) | MC 50 / FRQ 50 [recorded] | 없음 | 0 | 4/0 | 2/1/0 | 없음(종이 FRQ) | 하 |
| 13 | Calculus AB | 42Q·100min(A29/B13) | 6 FRQ·90min(종이); 54 (A 18 + B 36, DB 확인) | MC 50 / FRQ 50 [recorded] | 없음 | 0 | 3/3 | 5/0/0 | 없음(종이 FRQ) | 하 |
| 14 | Calculus BC | 42Q·100min | 6 FRQ·90min(종이); 54 (DB 확인) | MC 50 / FRQ 50 [recorded] | 없음 | 0 | 4/0 | 0/0/0 | 없음(종이 FRQ) | 하 |
| 15 | Precalculus | 42Q·105min | 4 FRQ·70min(종이); 24 (6×4, DB 확인) | MC 62.5 / FRQ 37.5 [recorded] | 없음 | 0 | 4/0 | 0/0/0 | 없음(종이 FRQ) | 하 |
| 16 | Physics C: Mechanics | 42Q·85min | 4 FRQ·95min(종이); 40 (DB 확인) | MC 50 / FRQ 50 [owner] | 없음 | 0 | 4/0 | 0/0/0 | 없음(종이 FRQ) | 하 |
| 17 | Physics C: E&M | 42Q·85min | 4 FRQ·95min(종이); 40 (DB 확인) | MC 50 / FRQ 50 [recorded] | 없음 | 0 | 5/0 | 0/0/0 | 없음(종이 FRQ) | 하 |
| 18 | Computer Science A | 42Q·90min | 4 FRQ·90min; 세트 1·2: 25 (7·7·5·6, CED p.145 일치) / **세트 3: 36 (9×4, CED 구조와 불일치)** | MC 55 / FRQ 45 [recorded] | 없음 | 0 | 3/0 | 1/1/0 | 없음 | 하 |

부가: 미국사·세계사·유럽사 SAQ 는 3문항×3점(DB 확인), DBQ 7·LEQ 6. 2027 시험에서 구조가 바뀐 과목(Calculus AB/BC, Statistics, Physics 1, Physics C 2종, Precalculus, CS A 디지털화, 역사 3과목 SAQ·LEQ)은 이전 연도 공개 자료를 그대로 쓸 수 없다(§5).
FRQ AI 의 보정 수치 출처: `docs/ap/essay-ai-calibration.md`(영어·문학·미국사), `docs/ap/worldhistory-groundwork.md` §5. 보정 표본은 ALTON 이 작성한 등급 에세이이며(leave-one-out 앵커 2개) 실제 학생 답안·공식 채점 샘플이 아니다.

## 3. 코드에 이미 있는 점수 관련 로직·상수 (전수)

| 위치 | 내용 | 등급 환산과의 관계 |
|---|---|---|
| `lib/mock-exam/score-aggregate.ts` `estimateAttempt` | `track === "ap"` 이면 무조건 `no_estimate_ap`(SAT 점수 범위 추정만 구현) | AP 는 환산 없음. 관리자 free-accounts `AttemptHistoryTable` 이 이 결과를 표시(AP 는 "Score estimate not available") |
| `lib/ap-exam/layouts.ts` `AP_SECTION_WEIGHTS_PCT` | 2과목(Precalculus 62.5/37.5·파트 A/B 비중, Physics C: Mechanics 50/50)만 | 주석상 "환산 만들 때 단일 출처". 이번에 `section-weights.ts` 레지스트리(18과목)로 확장, 두 상수가 어긋나지 않게 테스트 추가 |
| `lib/ap-exam/layouts.ts` `AP_LAYOUTS`·`AP_NEW_SUBJECT_FRQ_TYPES` | 섹션 문항 수·시간·계산기, 신규 과목 FRQ 유형 점수(일부 `points: null` = 공식값 미확인) | 구성 기준. 등급 없음 |
| `lib/ap-exam/layouts.ts` `isOfficialFullLayout`, `apBadgeText`, `apCoverageLines` | 풀 구성 판정, 부분 세트 안내("전범위 성취로 읽지 말 것") | 예상 등급 표시 게이트로 재사용 |
| `lib/essay-grading/rubric.ts` | 루브릭 5종 총점(영어 6, 문학 6, 역사 SAQ 3·DBQ 7·LEQ 6) | FRQ 점수만, 등급 없음 |
| `lib/essay-grading/subject.ts` | `ESSAY_GRADING_SUBJECTS`(4과목), 유럽사 `EURO_ESSAY_GRADING_VALIDATED=false`, 미지원 안내 문구 | FRQ AI 지원 범위 |
| `app/components/EssayScoreCard.tsx` | "AI estimated score (internal estimate — not an official AP score)" + 면책 문구 | 에세이 단위 점수만 |
| `ApExamResultView.tsx` | (수정 전) MC 정답률만. FRQ 점수·합산 없음, "AP scores (1–5) are not estimated" 문구 | 이번 수정 §ApExamResultView 참고 |
| DB `mock_exam_essay_scores` | 에세이 점수 행(`scores`, `rubric_version`, `cost_usd`) | 공개 AP 응시 중 점수 행 3건(완료 1·skipped 2) |
| 점수 환산 테이블·함수 | **없음** (`composite`, `cut`, `conversion` 로 검색한 결과 AP 환산 코드 없음) | — |

## 4. 준비도 등급과 우선 적용 과목

기준: ① 2027 시험 구조가 이전 연도와 같은가(비교 자료 재사용 가능성) ② FRQ 점수를 낼 수단과 보정 상태 ③ 풀 세트 수 ④ 섹션 가중 근거 ⑤ FRQ 오차가 합산에 미치는 영향. 응시 데이터 부족은 전 과목 공통이므로 등급에 반영하지 않았다.

- **상(영어 2과목)**: 구조 불변, FRQ AI 보정 통과(MAE 0.33/0.17), 풀 세트 2개씩, 가중 45/55 근거 기록. 남은 일 = 경계점 근거 확보 + 파일럿.
- **상~중(미국사·세계사)**: AI 보정 통과(MAE 0.17). 2027 SAQ·LEQ 개편 → 이전 연도 자료의 재사용 조건을 개별 확인해야 한다. 4개 구성 요소(MC·SAQ·DBQ·LEQ) 가중이 필요하고 DBQ·LEQ 가 낮게 평가되는 경향(보수 방향).
- **중(유럽사)**: 구성은 역사 3과목과 같으나 AI 꺼짐·보정 미실행. 보정이 통과해야 위 단계로 올라간다.
- **중(Psychology·Micro·Macro)**: 구조 불변, MC 비중 66.7% 라 FRQ 오차의 영향이 작다. 그러나 FRQ 점수 수단이 없다(루브릭·AI 미구현, Micro/Macro 는 그래프 채점).
- **하(나머지 11과목)**: 2027 구조 변경 또는 종이 손글씨 FRQ 라 점수 수단 없음 / CS A 는 배점 불일치. 결과 분석(섹션 원점수)만 제공한다.

**우선 적용 제안**: 1) English Language → 2) English Literature → 3) U.S. History → 4) World History. 유럽사는 보정 통과 후 합류. 이 4과목 외에는 MC 만으로 등급을 내지 않는다(섹션 50%·55% 를 무시한 추정이 되므로).

## 5. 과목별 환산 근거 설계 요약 (상세는 `docs/ap/grade-estimate-pilot-plan.md` §2)

재사용 조건 원칙: 비교 자료(공식 보고서·공개 복합점수 구간·공개 문항)는 ① 같은 시험 구조(문항 수·배점·섹션 비중·채점 기준) ② 공개 출처와 적용 연도 ③ 우리 문항이 그 자료와 같은 난도 분포라는 증거, 세 가지가 모두 확인될 때만 환산 근거로 쓴다. 하나라도 빠지면 "외부 추정" 이하로 표시하고 등급을 숨긴다. 공식 등급 분포(몇 %가 5점)만으로 원점수 경계를 역산하지 않는다.

- 이 감사 시점에 위 세 조건이 충족된 과목: **없음.** College Board 가 과거 시험의 복합점수 구간을 공개하는지(예: 연례 보고서)와 2027 구조에 적용 가능한지는 이 세션에서 1차 자료로 확인하지 않았다 — 파일럿 0단계의 첫 작업.
- 우리 시험은 ALTON 자체 생성 문항이다. 난도 보정(문항 응답 자료)이 없으면 다른 시험의 환산표를 적용해도 검증된 것이 아니다.
- FRQ AI 채점 오차의 합산 영향(100점 만점 복합점수 기준, 가중치에서 계산): 영어 에세이 1점 = 55/18 = **3.1점**, 미국사·세계사 DBQ 1점 = 25/7 = **3.6점**, LEQ 1점 = 15/6 = **2.5점**, SAQ 1점 = 20/9 = **2.2점**. 보정 결과의 에세이당 평균 오차 0.17~0.33점이면 복합점수 0.5~1점이지만, 약한 답안 +2 과대(영어 fb3)·중간 답안 −1 압축 같은 체계적 편향이 있고 표본이 작다. 등급 경계 근처 학생은 AI 오차만으로 등급이 바뀔 수 있어 범위 표시(§구현 계획)가 필요하다.
- 자료 부족 시 필요한 추가 검증: ① 공식 채점 샘플(과거 시험 공개 답안)로 AI 채점 재보정(유럽사 필수) ② 실제 학생 답안에서 AI 대 교사 채점 비교 ③ 파일럿에서 실제 AP 성적과 대조.

## 6. 이번 작업에서 바뀐 것 / 남은 차단 항목

- 결과 화면 점수 표시 수정(`lib/ap-exam/result-score.ts`, `section-weights.ts`, `ApExamResultView.tsx`) — 단위 테스트 20건 추가. 등급은 계속 숨김.
- 차단 항목: ① CS A 세트 3 구조 정정(§7) ② Micro·Macro CED 쪽수 기록 ③ 모든 과목 경계점 근거 ④ 유럽사 AI 보정.

## 7. CS A FRQ 배점 정정안 (제안만, 적용 금지)

사실(DB 읽기 전용): 공개 CS A 풀 세트 3개. 세트 1 응시 1건(미채점·진행 중)뿐이라 기존 응시·답안에 영향이 없다.

| 세트 | Q1 Methods and Control Structures | Q2 Class | Q3 ArrayList | Q4 2D Array | 합계 | 루브릭 요소 합 = 파트 점수 합 |
|---|---|---|---|---|---|---|
| 1 | (a) 3 + (b) 4 = 7 | 7 | 5 | 6 | 25 | 일치(요소당 1점) |
| 2 | 3 + 4 = 7 | 7 | 5 | 6 | 25 | 일치 |
| 3 | 4 + 5 = 9 | 9 | 9 | 9 | 36 | 내부는 일치하지만 CED 의 7/7/5/6 구조가 아님 |

판단:
- 세트 1·2 는 총점만이 아니라 **문항 유형**이 CED 유형(메서드·제어문 / 클래스 / ArrayList / 2차원 배열)에 맞고 문항별 채점 요소 개수가 만점과 같다. 오류로 보지 않는다.
- 세트 3 은 같은 4유형이지만 모든 문항이 9요소 구조다(예: ArrayList 문항이 새 리스트 생성·빈 리스트 처리·합 누적·평균·비교·추가 등 9요소, 클래스 문항도 9요소). 목표 시험 연도(2027)의 공식 구조라는 근거는 **확인되지 않는다**: 저장소 문서와 오너가 확인한 최신 인쇄 CED p.145 모두 7/7/5/6=25 이다. 9×4 는 다른 판의 방식으로 보이나 이 세션에서 1차 문서로 확인하지는 않았다. 목표 연도에 맞지 않는 것으로 취급한다.
- **금지**: 만점 숫자만 25 로 바꾸거나 9→7·5·6 으로 비례 축소하는 것(문항 요구와 채점 요소가 어긋난다).
- 수정안(오너 승인 후 별도 작업): 세트 3 의 네 문항을 **문항 요구부터** 다시 쓴다 — Q1 (a) 3요소 + (b) 4요소의 두 메서드, Q2 클래스 7요소(헤더·변수·생성자·메서드로 구성), Q3 ArrayList 5요소(순회·접근·조건·누적·반환 중심; 빈 리스트 처리 같은 부가 요소는 문항 요구와 요소에서 함께 제거), Q4 2D 배열 6요소. 요구 문장·참고 답안·요소 목록·테스트 케이스를 함께 검토해 새 문항 버전으로 올리고 세트 3 은 새 버전 행으로 교체한다(기존 문항 버전·응시·답안·채점 버전 보존). 세트 3 응시 0건이라 영향은 없다.
- 그 전까지 CS A 는 합산 점수·등급 대상에서 제외(FRQ 채점이 없어 합산이 이미 막혀 있다).

## 8. 결과 화면 확인 절차와 경로 조사

### 8-1. 경로 전수 조사 (코드)
| 화면 | 라우트·컴포넌트 | AP 결과를 AP 화면으로 보이는가 |
|---|---|---|
| 학생 | `/student/mock-exam/[attemptId]` → `ApExamResultView` | 예 |
| 학부모 | `/parent/mock-exam/[studentId]/[attemptId]` | **이번 작업 전에는 아니오**(SAT `MockExamResultView` 로 렌더). 이번에 AP 분기를 추가해 `ApExamResultView readOnly` 로 렌더 |
| 관리자 응시 상세 | `app/admin/free-accounts/AttemptHistoryTable.tsx`("View result") → `MockExamResultView readOnly` | **아니오** — AP 응시도 SAT 결과 컴포넌트로 렌더. AP 전용 관리자 응시 상세 라우트는 없다 |
| 관리자 학생 상세 | `StudentDetailPanel` → `StudentMockScoresCard`(SAT 점수 통계) | AP 응시 결과 경로 없음 |
| 세션 화면 | `SessionMockExamTab` → `MockExamResultView` | AP 전용 아님 |
| 교사 | `TeacherMockExamAttemptViewer` → `ItemDetail` | 문항 상세만 |

수정 제안(승인 후): 관리자 `AttemptHistoryTable` 이 `detail.examProgram === "ap"` 일 때 `ApExamResultView readOnly` 를 쓰도록 분기하고 `getAttemptDetailForAdminAction` 에 FRQ 점수 행 로드를 추가(환산 근거 패널은 구현 계획 M2). 이번에는 조사만 했고 관리자 코드는 바꾸지 않았다.

### 8-2. Preview 확인용 데이터 (읽기 전용 조회, 비프로덕션 `worpsqwqgnspddnrtnvq`)
- **학생 경로**: 실사용(비테스트) 학생 `9f03bec4-1e95-41a7-95d6-f941e52f6a04` 의 채점 완료 응시.
  - English Language 풀 구성 attempt `5b9952b6-6d0b-4220-8aa3-16a86412ce3c` (FRQ 점수 행 3건: 완료 1·skipped 2 — 점수/건너뜀 사유 표시 확인용).
  - Calculus AB 풀 구성 attempt `7020773d-eeeb-4c00-b562-1b8773ed4241` (FRQ 점수 없음 → "not scored", 합산 없음 확인용).
  - 로그인은 사용자 창에서, 열 주소는 `/student/mock-exam/<attempt id>`.
  - 테스트 계정 `0c95c52b-8dd7-4a98-bbbc-53536d47197f` 에 다수(예: CS A `567054ed-2f00-4f9f-9b21-5faf1e1aed20`, Psychology `6316ce5f-c2f6-4a5d-8b67-22f80c15939a`, AB MC 부분 세트 `09fbfea9-ee94-47dd-be62-222633addd54`).
- **학부모 경로**: 위 학생·테스트 계정 모두 `guardian_students` 연결 보호자가 **0명**이라 현재 데이터로는 학부모 화면을 열 수 없다. 총괄이 UAT 보호자 계정과 위 학생의 연결(쓰기)을 만들어야 한다 — 나는 DB 쓰기를 하지 않았다. 연결 후 `/parent/mock-exam/<studentId>/<attemptId>` 로 확인.
- **체크리스트**: (1) MC 점수줄·Topics (2) FRQ 요약 줄 상태 문구가 0점이 아닌지 (3) 문항 헤더 `· Free response · <상태>` (4) 합산 박스는 풀 구성+전체 채점 때만 (5) 부분 세트에 합산 없음 (6) 학부모 화면에 "Report a problem" 버튼과 자동 채점 시작이 없는지 (7) "Estimated AP Score" 문구 부재.

### 8-3. 아카이브 포함 AP 응시 수요 (읽기 전용)
| 과목 | 응시 | 채점 | 실사용 응시 | 실사용 학생 |
|---|---|---|---|---|
| Calculus AB | 21 | 20 | 2 | 1 |
| Calculus BC | 7 | 7 | 0 | 0 |
| Statistics | 6 | 4 | 2 | 1 |
| English Language | 5 | 5 | 1 | 1 |
| Biology / CS A / Physics 1 / Microeconomics | 각 5 | 각 4 | 각 1 | 각 1 |
| World History | 4 | 2 | 2 | 1 |
| Chemistry / Macro / Psychology | 각 4 | 각 4 | 0 | 0 |
| US History / English Literature | 각 2 | 각 2 | 0 | 0 |
| **합계** | **79** | | | |

## 9. 현재 4과목 "보정 완료"의 의미

영어·문학·미국사·세계사의 AI 채점 "보정"은 **ALTON 이 작성한 샘플 에세이에 대한 자체 샘플 기능 검증**이다. **실제 학생 답안에 대한 정확도 검증이 아니며** 공식 채점 샘플·교사 채점과의 비교도 아직 없다. 문서·화면·보고에서 "보정 완료/통과"라고 쓸 때 이 구분을 함께 적는다. 또 같은 샘플이 프롬프트·문구 조정과 측정에 함께 쓰여 개발용/최종 평가용이 분리돼 있지 않다(파일럿 A단계에서 분리).
