# 과목별 분류 매트릭스: 내용 / 평가 스킬 / 문항 구조 / 응답 방식 / 채점 방식 / 잠정 난이도

## 0. 공통 규칙
- **내용(content)**: 공식 단원(Unit) → 주제(Topic) → 학습 목표(Learning Objective, LO). 공식 코드만 사용(예: Calc `LIM-1.E`, Bio `LO 8.3.A`, Micro `MKT-4.B`).
- **평가 스킬(skill)**: 공식 CED 스킬 코드(예: Calc `1.E`, Bio `3.C`, Micro `2.A`). **내부 세부 분류가 있으면 공식 스킬 하나에 매핑**하고 내부 분류는 `internal_tag`(별도 컬럼)로만 둔다. 문항마다 `primary_skill` 1개 + `secondary_skills[]`(0~2개). FRQ 파트마다 따로 부여.
- **문항 구조(structure)**: `standalone` / `shared_stimulus_set`(자료 1개 + 2~4문항, 세트 완결성 필수) / `frq_multipart`(파트별 점수·스킬·루브릭 행).
- **응답 방식(response_mode)**: `select`(선택) / `calculate`(계산) / `explain`(서술 설명) / `graph`(그래프 그리기·표시) / `code`(코드 작성·추적) / `essay`(에세이).
- **채점 방식(scoring_mode)**: `exact`(MC 단일 정답) / `partial`(파트·루브릭 행별 부분 점수) / `argument`(근거·추론 품질 평가).
- **잠정 내부 난이도(difficulty_provisional)**: `basic_learning`(기본 학습) / `exam_prep`(시험 대비) / `advanced_supplement`(심화 보충). 풀 모의는 `exam_prep` 중심. **"AP 3/5 수준" 같은 표기 금지.** 난이도를 긴 계산, 모호한 서술, 읽기 분량 증가, 범위 밖 지식으로 올리지 않는다(반려 사유). 학생 응시 데이터가 충분히 쌓이기 전까지 잠정값.
- **FRQ 연결**: `frq_parts.skill_codes` ↔ `frq_rubric_rows.part_label/row_id` 1:N, 루브릭 행마다 점수·스킬·허용 답안 목록·흔한 오답 연결. 파트에 루브릭 행이 없으면 공개 불가.
- 신뢰도: **V**=CED 원문에서 코드까지 확인(2026-10-08), **N**=공식 범주명은 확인했으나 코드 원문 전사는 생성 착수 전 필요.

## 1. Calculus AB (V)
공식 스킬(Mathematical Practices): P1 Implementing Mathematical Processes(1.C 규칙/절차 선택-표현 분류, 1.D 개념 관계로 선택, 1.E 적용(기술 사용 가능), 1.F 근삿값 관계 설명) / P2 Connecting Representations(2.B 정보 식별, 2.C 재표현, 2.D 특성 관계, 2.E 표현 간 관계 설명) / P3 Justification(3.B 정의·정리·검정 식별, 3.C 조건 확인, 3.D 적용, 3.E 근거 제시, 3.F 맥락 의미 설명, 3.G 정확성 확인) / P4 Communication(4.A~E, FRQ에서만). MC 비중: P1 50–70%, P2 15–30%, P3 10–20%.
단원(AB MC 비중): U1 10–15, U2 10–15, U3 5–10, U4 10–15, U5 15–20, U6 15–20, U7 5–10, U8 10–15 (U9·U10은 BC).
| 구조 | 응답 | 채점 | 대표 내용×스킬 | 잠정 난이도 |
|---|---|---|---|---|
| standalone MC, 파트 A(계산기 불가) | select | exact | 극한·도함수·적분 규칙(1.E), 표현 변환(2.C), 정리 선택(3.D) | basic/exam_prep |
| standalone MC, 파트 B(그래핑 계산기) | select/calculate | exact | 수치 적분·도함수 값, 맥락 적용(1.E+3.F) | exam_prep |
| 자료 표·그래프 기반 MC | select | exact | 그래프 f′→f 성질(2.D, 3.D), 표 근사(2.B) | exam_prep |
| FRQ 파트 A(계산기) | calculate+explain | partial | 표 자료+맥락(2.B, 3.F, 4.B), 적분 평균값 | exam_prep |
| FRQ 파트 B(불가) | explain/justify | partial | f′ 그래프 분석·최솟값 정당화(2.E, 3.B, 3.E) | exam_prep/advanced |
| FRQ 유형(6): 맥락 표/변화율, 그래프 분석, 미분방정식·기울기장, 면적·부피, 입자 운동, 함수 분석 | | | 샘플은 이 6유형을 모두 포함해야 완전 | |

## 2. Calculus BC (V)
AB 스킬 동일. 추가 단원 U9(매개변수·극좌표·벡터), U10(무한급수, 15–20%). BC 전용 스킬 초점: 3.C(수렴 검정 조건 확인), 3.D(검정 적용), 1.F(오차 한계). MC는 AB 공통 핵심(U1–8, 비중 낮아짐) + BC 개념. 구조·응답·채점은 AB와 같으며 급수는 `3.C/3.D` 중심 shared-stimulus 또는 standalone. FRQ 유형: AB와 공통 3개 + BC 3개(매개변수/극/벡터, 급수). 난이도: AB 문항을 숫자만 복잡하게 바꾼 것은 반려.

## 3. Statistics (N — 2027 신 CED 확인 필요)
2027부터 5단원(수집·요약, 설계·확률, 비율 추론, 평균 추론, 회귀), 공식 용어가 "skills"에서 "practices"로 바뀜(출처: AP Central future-revisions). 코드 체계는 신 CED 공개 후 전사. 구조: MC 42문항 4지선다 + **확률·회귀 3문항 세트 2개**(shared-stimulus 필수 지원), FRQ 4개(각 10점; 실습 조합: 1–2, 3–4, 추론, 2–4 복합). 응답: select/explain/calculate(공식·결론 서술). 채점: MC exact, FRQ partial(방법 선택·조건 확인·계산·맥락 결론 행). 삭제 주제 생성 금지 목록: 기하분포, 카이제곱 적합도, 기울기 추론(구 Unit 9), 확률변수 결합, 비선형성 분석.

## 4. Biology (V)
스킬(Science Practices): SP1 Concept Explanation(1.A 서술, 1.B 설명, 1.C 응용 맥락 설명) / SP2 Visual Representations(2.A 특성 서술, 2.B 관계 설명, 2.C 큰 원리 연결, 2.D 관계 표현) / SP3 Questions and Methods(3.A 검증 가능한 질문, 3.B 귀무가설·예측, 3.C 절차(변수·대조), 3.D 새 조사 제안) / SP4 Representing and Describing Data(4.A 그래프 작성, 4.B 표·그래프 서술) / SP5 Statistical Tests and Data Analysis(5.A 계산, 5.B 신뢰구간·오차막대, 5.C 카이제곱, 5.D 가설 평가) / SP6 Argumentation(6.A 주장, 6.B 근거, 6.C 추론, 6.D 결과-개념 연결, 6.E 예측). 단원 비중: U1 8–11, U2 10–13, U3 12–16, U4 10–15, U5 8–11, U6 12–16, U7 13–20, U8 10–15.
| 구조 | 응답 | 채점 | 대표 | 잠정 난이도 |
|---|---|---|---|---|
| standalone MC | select | exact | 개념 설명·예측(1.C, 6.E), 연구 질문(3.A) | basic/exam_prep |
| 자료 세트 MC(그림+그래프+데이터, 문항 3~4개) | select | exact | 6.B 주장-근거, 5.A 속도, 3.C 대조군, 6.E 결과 예측 | exam_prep |
| 시각 자료 MC(표·그림) | select | exact | 2.B, 2.C, 4.B | exam_prep |
| FRQ 긴 문항(9점): 실험 해석·평가 / +그래프 작성 | explain+graph+calculate | partial | 1.A·3.C·4.B·5.A·6.E·6.B (CED Q1), 4.A·5.B·6.C (Q2) | exam_prep/advanced |
| FRQ 짧은 문항(4점): 과학적 조사 / 개념 분석 / 모델·시각 표현 / 데이터 분석 | explain | partial | SP3·SP1·SP2·SP4 중심 | exam_prep |
공식 규정: FRQ는 문단 서술형(개요·목록·도식만으로는 채점 불가).

## 5. Chemistry (N)
스킬 6범주(공식명): Models and Representations, Question and Method, Representing Data and Phenomena, Model Analysis, Mathematical Routines, Argumentation. 9단원. MC 60(단독+세트, 입자 그림·표·그래프), FRQ 7(긴 3×10점, 짧은 4×4점). 응답: select/calculate/explain/graph(그리기 포함). 채점: partial(단위·유효숫자 행 포함). 난이도: 단위·조건 오류, 산술만 있는 문항 반려.

## 6. Physics 1 (N, 구조는 V)
스킬: 공식 Science Practices(표현 생성, 수학 루틴, 과학적 질문, 데이터 분석, 논증)이며 코드 전사 필요. 8단원(운동학, 힘, 일·에너지, 운동량, 토크, 회전 에너지·운동량, 진동, 유체). MC 42(단독 + 자료 세트), FRQ 4(수학 루틴 / 표현 변환 / 실험 설계·분석 / 정성·정량 변환). 응답: select/calculate/explain/graph(그래프·자유물체도). 채점: partial(식·대입·단위·추론 행).

## 7. Computer Science A (N)
스킬: Computational Thinking Practices 1~5(공식 5범주; 프로그램 설계·알고리즘, 코드 논리, 코드 구현, 코드 테스트, 문서화). MC 42(코드 추적·구현·설계), FRQ 4(메서드·제어문 / 클래스 설계 / ArrayList / 2D 배열). 응답: select/code. 채점: MC exact, FRQ partial(행: 메서드 헤더, 루프 경계, 조건, 반환 등, 대체 구현 허용 규칙). 완전 디지털. Java 범위: 공식 Java Quick Reference·CED Java 서브셋만.

## 8. Microeconomics (V)
스킬 범주: 1 Principles and Models(1.A 정의·비교, 1.C 수치 분석으로 식별) / 2 Interpretation(2.A 결과 설명, 2.C 수치 분석으로 설명) / 3 Manipulation(3.A 결과 결정, 3.C 변화 효과 수치 결정) / 4 Graphing and Visuals(4.A 그리기, 4.B 상황 표시, 4.C 변화 표시, **MC 미평가**, FRQ만). MC 비중: 스킬1 30–42%, 스킬2 37–47%, 스킬3 16–25%, 수치 분석 20–30%. 단원: U1 12–15, U2 20–25, U3 22–25, U4 15–22, U5 10–13, U6 8–13. MC **5지선다**. FRQ 3(긴 10점 + 짧은 5점×2; 과제: 주장/설명/수치 분석/그래프 그리기 30–50%).
| 구조 | 응답 | 채점 | 대표 | 난이도 |
|---|---|---|---|---|
| standalone MC | select | exact | 정의·원리(1.A), 결과 설명(2.A) | basic/exam_prep |
| 그래프 기반 세트 MC(2문항) | select | exact | 잉여·DWL·가격 하한(2.A, 3.A) | exam_prep |
| 수치 MC | calculate→select | exact | 교차탄력성·비용(2.C, 3.C) | exam_prep |
| FRQ 긴(10점) | graph+explain+calculate | partial | 완전경쟁·가격 하한·탄력성(MKT, POL, PRD) | exam_prep/advanced |
| FRQ 짧은(5점) | graph/explain | partial | 독점·외부효과 | exam_prep |

## 9. Macroeconomics (N)
스킬 범주: Micro와 같은 4범주 체계(원리·모델 / 해석 / 조작 / 그래프). 단원 6개(기본 개념, 경제지표·경기순환, 국민소득·물가, 금융, 장기 영향·정책, 개방경제). MC 60, FRQ 3(긴 1 + 짧은 2). 구조·응답·채점은 Micro와 같다. 현재 사건이 정답을 결정하는 문항 반려.

## 10. English Language and Composition (N)
스킬: 읽기(Reading: rhetorical situation, claims and evidence, reasoning and organization, style)와 쓰기(Writing: 같은 4범주)로 공식 구성. MC 45(읽기 지문 세트 + 쓰기 수정 세트), FRQ 3(Synthesis·Rhetorical Analysis·Argument). 응답: select/essay. 채점: MC exact, 에세이는 공식 루브릭 행(Thesis·Evidence/Commentary·Sophistication)별 partial·argument. AI 에세이 채점은 전문가 비교 보고 전 비노출. 지문은 모두 독창(공식 지문 사용 금지).
