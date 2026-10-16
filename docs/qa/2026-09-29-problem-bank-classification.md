# 2026-09-29 문제은행 973건 분류 보고 (읽기 전용 분석)

대상 DB: 공유 비프로덕션 `worpsqwqgnspddnrtnvq`(SELECT만 사용, 쓰기·마이그레이션·커밋 없음). 결정 배경: 오너 규칙 "이미 검수된 좋은 문제는 전부 `mock_exam`, 나쁜 문제는 **수정 없이 보관**".

## 1. 요약

| 구분 | 건수 | 조치 권고 |
|---|---|---|
| 이미 보관(archived_at 있음) — 이번 분류 제외 | 598 | 조치 없음(재보관·재분류 불필요) |
| **A** 검수됨·결함 없음 | **195** | `mock_exam` |
| **B** 결함 확인 | **14** | 수정 없이 보관 |
| **C** 애매 — 오너 결정 필요 | **166** | 아래 3절 |
| 합계 | 973 | |

활성(미보관) 375건 = A 195 + B 14 + C 166. ID 목록: `2026-09-29-problem-ids-A-mock-exam.txt`(195), `2026-09-29-problem-ids-B-archive.txt`(14).

## 2. 정의와 기준

**"검수됨(reviewed)"** — 코드 기준: 관리자가 초안 저장 → 미리보기·내용 확인 → 공개 버튼(`confirm_and_publish_problem_version`)을 누른 상태. 자동 공개는 없다(`app/admin/problem-bank-actions.ts` 머리 주석). DB 상 표지는 `problems.status='confirmed'` + `published_version_id` 존재 + 해당 버전 `status='published'`, `review_kind='self_confirmed'`, `published_by` 기록. 별도 검수자 승인은 없다(self_confirmed = 작성 관리자 본인 확인). 활성 229건 전부 이 상태(published_by = created_by = 같은 관리자 1명). `draft`(146건)는 사람이 공개한 적 없는 미검수 초안. `problem_versions.quality`(JSON)에는 계약검사 결과·`needsReview`·추정 난이도·오답 평가가 있고, `needsReview=true`는 (a) '쉽게 지워지는 오답' 지적 또는 (b) 요청/추정 난이도 불일치 때문에 붙는다.

**검사(결정론적, 프로젝트 자체 로직을 그대로 실행한 읽기 전용 스크립트)** — 활성 375건의 공개 버전(없으면 최신 버전)에 대해:
`checkQualityContract`(lib/problem-quality-contract.ts: 질문 유무·선택지 4개·정답 자리 범위·SPR 정답·자료 필요/누락·RW 구조(빈칸/밑줄/Text1·2)·수식·자료 참조·렌더 검사 포함) + `findBannedWords`(내부 필드명 노출) + `isMostlyKorean`(문제 본문 영어 통일 정책) + RW 전용 모델검사 6종(근거·문법·정량·전환어·종합·구조) + `render_check.ok` + 저장된 `quality.contract.ok` + 독립검사 불일치 + 직접 검사(빈 지문·질문·해설, 선택지 중복·빈칸, 정답 인덱스, SPR 정답, 원시 LaTeX). 완전 중복은 지문+질문+선택지(정렬)+자료+SPR정답이 모두 같은 경우만(지문·질문만 같고 자료가 다른 21건은 정상 변형이라 제외).

**중요한 오탐 정리** — 지문·선택지의 `$...$`는 플랫폼의 KaTeX 수식 표기(`lib/render-learning-content.ts`)로 정상이다(72건, 결함 아님). 해설의 `$...$`(선형부등식 10건)는 세션 화면(`LearningText`)에서는 렌더되나, 2026-09-18 감사(마이그레이션 `20261413000000`)는 같은 결함 3건을 보관했다 → 일관성 때문에 C(오너 결정)로 분리.

**버킷 규칙**: B = 아래 하드 결함이 하나라도 있음(금칙어·내부 필드명 노출, 렌더검사 실패, 계약 위반, 완전 중복의 비대표본). A = 공개 상태(confirmed·published·self_confirmed)이면서 B/C 사유 없음. C = 하드 결함은 없으나 (i) 미공개 초안(사람이 검수한 적 없음), (ii) '쉽게 지워지는 오답' 지적(needsReview), (iii) 해설 원시 LaTeX. 난이도 불일치만 있는 문항은 결함으로 보지 않고 A에 둠(A 중 3건).
중복 대표본은 confirmed 우선, 같으면 id 오름차순 1건을 남긴다. 기존 감사(P5 `20261402000000`, P6 `20261413000000`)로 이미 보관된 598건은 분류에서 제외(이중 계산 없음; 기존 8건도 여기 포함).

## 3. 버킷별 집계

| exam_system | A | B | C | 합계 |
|---|---|---|---|---|
| sat_math | 184 | 10 | 116 | 310 |
| sat_rw | 11 | 4 | 50 | 65 |

| sat_domain | A | B | C | 합계 |
|---|---|---|---|---|
| advanced_math | 25 | 0 | 33 | 58 |
| algebra | 51 | 2 | 44 | 97 |
| geometry_trig | 59 | 7 | 12 | 78 |
| problem_solving_data | 49 | 1 | 27 | 77 |
| rw_craft_structure | 3 | 1 | 14 | 18 |
| rw_expression_ideas | 4 | 0 | 16 | 20 |
| rw_information_ideas | 4 | 0 | 16 | 20 |
| rw_standard_english | 0 | 3 | 4 | 7 |

| skill_code | A | B | C | 합계 |
|---|---|---|---|---|
| area_volume | 32 | 0 | 4 | 36 |
| boundaries | 0 | 2 | 3 | 5 |
| central_ideas_details | 1 | 0 | 6 | 7 |
| circles | 19 | 7 | 2 | 28 |
| command_of_evidence_quant | 2 | 0 | 1 | 3 |
| command_of_evidence_text | 0 | 0 | 3 | 3 |
| cross_text_connections | 1 | 1 | 3 | 5 |
| equivalent_expressions | 8 | 0 | 8 | 16 |
| evaluating_statistical_claims | 5 | 1 | 3 | 9 |
| form_structure_sense | 0 | 1 | 1 | 2 |
| inference_margin_error | 4 | 0 | 5 | 9 |
| inferences | 1 | 0 | 6 | 7 |
| linear_equations_one_var | 13 | 2 | 11 | 26 |
| linear_equations_two_var | 1 | 0 | 6 | 7 |
| linear_functions | 22 | 0 | 5 | 27 |
| linear_inequalities | 10 | 0 | 13 | 23 |
| lines_angles_triangles | 0 | 0 | 5 | 5 |
| nonlinear_equations_systems | 2 | 0 | 8 | 10 |
| nonlinear_functions | 15 | 0 | 17 | 32 |
| one_variable_data | 10 | 0 | 4 | 14 |
| percentages | 9 | 0 | 4 | 13 |
| probability | 7 | 0 | 4 | 11 |
| ratios_rates_units | 6 | 0 | 4 | 10 |
| rhetorical_synthesis | 1 | 0 | 11 | 12 |
| right_triangles_trigonometry | 8 | 0 | 1 | 9 |
| systems_linear | 5 | 0 | 9 | 14 |
| text_structure_purpose | 2 | 0 | 3 | 5 |
| transitions | 3 | 0 | 5 | 8 |
| two_variable_data | 8 | 0 | 3 | 11 |
| words_in_context | 0 | 0 | 8 | 8 |

| pstatus | A | B | C | 합계 |
|---|---|---|---|---|
| confirmed | 195 | 7 | 27 | 229 |
| draft | 0 | 7 | 139 | 146 |

| created_via | A | B | C | 합계 |
|---|---|---|---|---|
| ai_generated | 11 | 4 | 50 | 65 |
| compiler | 184 | 10 | 116 | 310 |


C 166건 내역: 미공개 초안만 해당 109 / 초안 + '쉽게 지워지는 오답' 27 / 공개됨 + '쉽게 지워지는 오답' 20 / 공개됨 + 해설 원시 LaTeX 7 / 초안 + 해설 LaTeX 3.
- 사유별(중복 포함): 미공개 초안 139, '쉽게 지워지는 오답' 47, 해설 LaTeX 10.
- 초안 139건은 결정론 검사·계약·중복까지 모두 통과한 '깨끗한 미검수'가 109건이다. 초안은 어차피 후보 풀(공개 버전 필요)에 들어가지 않으므로 `mock_exam` 태깅해도 노출은 안 늘지만 '검수됨' 조건은 아니다.

## 4. B(보관 권고 14건) 전체 목록

상위 결함: 완전 중복 8건(6개 묶음에서 대표본 제외; circles 7·통계 1 등), 금칙어(evidence_span 내부 필드명이 해설에 노출) 1, 계약 위반 `blank_duplicate_word` 3(boundaries·form_structure_sense: 빈칸 뒤 단어가 선택지와 중복), 렌더 실패 `option_style` 2(선택지가 값만 적는 형식 위반). 2건은 렌더 실패와 계약이 겹침. (14건 중 공개 7·초안 7)

| id | 상태 | 세부기술 | 사유 | 내용 일부 |
|---|---|---|---|---|
| 0e05fcfe-b9c5-470a-91c1-5f35421aa3ca | confirmed | cross_text_connections | banned:answer_rationale | Based on the texts, how would Priya Nandakumar (Text 2) most |
| 2a089508-0c9a-4e1a-a297-a7c8e9e85ccb | draft | circles | exact_duplicate_of:1a55458a-6290-494b-b8dd-68f1a7eb8688 | What is the length of arc AB, in terms of π? |
| 48c3829b-5ed7-4538-883f-896174d5750c | confirmed | boundaries | contract:contract_blank_duplicate_word | Which choice completes the text so that it conforms to the c |
| 50538d12-c7db-4e54-b77f-c02c13742a17 | draft | evaluating_statistical_claims | exact_duplicate_of:4a4b70c6-2f64-4434-93a4-d07221b5703e | Based on the design of the study, which of the following is  |
| 63528c9e-275a-41e5-83c1-fb90dfb13c19 | draft | form_structure_sense | contract:contract_blank_duplicate_word | Which choice completes the text so that it conforms to the c |
| 7ae38de5-a9c7-4a4f-af76-0be3a8dc3771 | draft | linear_equations_one_var | contract:contract_option_style, render_check_failed | Which equation correctly gives k in terms of P and V? |
| 8cec80b5-acae-49ab-95ba-971dfaa3e54e | draft | circles | exact_duplicate_of:12f790f7-5d86-48f4-8211-90d9ae5066f2 | What is the length of arc AB, in terms of π? |
| 8ea12010-771c-4de4-9aaa-55d3bbcffc70 | confirmed | circles | exact_duplicate_of:2f49debf-82f1-4697-8ea4-46c8e5695e81 | What is the circumference of the circle shown, in terms of π |
| 8f3d3b89-97e2-4a65-b32e-15b315ac1f5c | confirmed | circles | exact_duplicate_of:1a55458a-6290-494b-b8dd-68f1a7eb8688 | What is the length of arc AB, in terms of π? |
| b2329278-6a2d-492d-804c-836fbaf868d8 | draft | circles | exact_duplicate_of:040b6470-44cd-460e-9861-7d20440efe8e | What is the length of arc AB, in terms of π? |
| b5e72ec4-ec75-43ec-b895-2ff7f1d14fbc | draft | linear_equations_one_var | contract:contract_option_style, render_check_failed | Which equation correctly gives k in terms of d and b? |
| cb7071ee-6acc-460a-8d00-596469289dda | confirmed | boundaries | contract:contract_blank_duplicate_word | Which choice completes the text so that it conforms to the c |
| d581fead-e707-4a4c-844c-4ae9cbf1caa1 | confirmed | circles | exact_duplicate_of:508b24dd-fe8e-43c6-b165-408aac130a64 | What is the circumference of the circle shown, in terms of π |
| f876db2f-f011-4041-916a-c60c8c68ecec | confirmed | circles | exact_duplicate_of:508b24dd-fe8e-43c6-b165-408aac130a64 | What is the circumference of the circle shown, in terms of π |

## 5. C 예시(사유별 10건)

**미공개 초안(깨끗한 미검수)**
| id | 상태 | 세부기술 | 사유 | 내용 일부 |
|---|---|---|---|---|
| 0029ecfa-12e5-415b-aa36-9b38d2cdf246 | draft | systems_linear | unpublished_draft_unreviewed | What is the slope of the line represented by the second equa |
| 004c4be0-891c-4adf-9128-5ed437a3b9ec | draft | linear_functions | unpublished_draft_unreviewed | For what value of x does f(x) = -14? |
| 06ffe28a-56a2-4b2d-a1c0-69ae9f277b12 | draft | words_in_context | obvious_distractor_flag, unpublished_draft_unreviewed | Which choice completes the text with the most logical and pr |
| 0a39089b-581d-43b7-9b13-afe27e378f35 | draft | cross_text_connections | obvious_distractor_flag, unpublished_draft_unreviewed | Based on the texts, how would Paul Ibarra (Text 2) most like |
| 0c51e5fc-d139-4c7e-9b9f-49bdbc120ce2 | draft | rhetorical_synthesis | unpublished_draft_unreviewed | The student wants to explain what made the 1637 collapse of  |
| 0c9460a9-6e09-431d-ad87-3e193b34f59a | draft | nonlinear_functions | unpublished_draft_unreviewed | What is f(6)? |
| 0c9c20df-8e81-4bb3-95bd-12cb65d75df7 | draft | transitions | obvious_distractor_flag, unpublished_draft_unreviewed | Which choice completes the text with the most logical transi |
| 0cd8d6c8-52ce-4caf-b3b2-187741df1d9c | draft | ratios_rates_units | unpublished_draft_unreviewed | Based on the ratio shown, how many cups of sugar are needed? |
| 0d93cabc-501a-47ba-8296-a9cee89739c2 | draft | linear_equations_one_var | unpublished_draft_unreviewed | What is the solution to the equation shown? |
| 0e8257e7-5fb0-494d-a334-980640753c1e | draft | nonlinear_functions | unpublished_draft_unreviewed | For what value of t does P(t) = 63175? |

**'쉽게 지워지는 오답' 지적(needsReview)**
| id | 상태 | 세부기술 | 사유 | 내용 일부 |
|---|---|---|---|---|
| 06ffe28a-56a2-4b2d-a1c0-69ae9f277b12 | draft | words_in_context | obvious_distractor_flag, unpublished_draft_unreviewed; 쉽게 지워지는 오답 A), C) | Which choice completes the text with the most logical and pr |
| 0a39089b-581d-43b7-9b13-afe27e378f35 | draft | cross_text_connections | obvious_distractor_flag, unpublished_draft_unreviewed; 쉽게 지워지는 오답 C) | Based on the texts, how would Paul Ibarra (Text 2) most like |
| 0c9c20df-8e81-4bb3-95bd-12cb65d75df7 | draft | transitions | obvious_distractor_flag, unpublished_draft_unreviewed; 쉽게 지워지는 오답 D) | Which choice completes the text with the most logical transi |
| 0e0c80e4-2bcc-42f7-b3d3-ded6c1f67826 | confirmed | words_in_context | obvious_distractor_flag; 쉽게 지워지는 오답 B), C) | Which choice completes the text with the most logical and pr |
| 1713f458-e833-43e8-9f00-de063539d151 | draft | words_in_context | obvious_distractor_flag, unpublished_draft_unreviewed; 쉽게 지워지는 오답 D) | As used in the text, what does the word "tempered" most near |
| 1b145009-d824-4d97-a91b-545628e3c71c | confirmed | central_ideas_details | obvious_distractor_flag; 쉽게 지워지는 오답 A), D) | Which choice best states the main idea of the text? |
| 1b71fe4a-59bb-42bd-949a-f2274990a5e4 | draft | boundaries | obvious_distractor_flag, unpublished_draft_unreviewed; 쉽게 지워지는 오답 C), D) | Which choice completes the text so that it conforms to the c |
| 1c7e60d3-6e09-4fb0-803a-eeffbd744bc6 | draft | central_ideas_details | obvious_distractor_flag, unpublished_draft_unreviewed; 쉽게 지워지는 오답 D) | Which choice best states the main idea of the text? |
| 31674734-b8cc-4700-a3f5-559d7bf25d40 | draft | text_structure_purpose | obvious_distractor_flag, unpublished_draft_unreviewed; 쉽게 지워지는 오답 D) | Which choice best describes the function of the underlined s |
| 33535510-f8d3-467a-b068-b766946e0b3e | confirmed | rhetorical_synthesis | obvious_distractor_flag; 쉽게 지워지는 오답 D) | The student wants to explain how a pesticide applied to farm |

**해설 원시 LaTeX**
| id | 상태 | 세부기술 | 사유 | 내용 일부 |
|---|---|---|---|---|
| 3ee87a30-fbee-4e5f-8fe1-e20c2ff00556 | confirmed | linear_inequalities | explanation_raw_latex | Which of the following describes all values of x that satisf |
| 40138a38-c980-48ac-b686-17470fe25f5e | confirmed | linear_inequalities | explanation_raw_latex | Which of the following describes all values of x that satisf |
| 4cd98395-4035-4834-b2a6-987ee1472592 | draft | linear_inequalities | explanation_raw_latex, unpublished_draft_unreviewed | Which of the following describes all values of x that satisf |
| a6fbe9bb-64cf-463d-932d-b65fa04c9f5b | confirmed | linear_inequalities | explanation_raw_latex | Which of the following describes all values of x that satisf |
| aca429bb-c927-4fd1-91f7-ce6eeb1a8e10 | draft | linear_inequalities | explanation_raw_latex, unpublished_draft_unreviewed | Which of the following describes all values of x that satisf |
| b79bfbda-8ab2-4230-9756-59d40a73f82b | confirmed | linear_inequalities | explanation_raw_latex | Which of the following describes all values of x that satisf |
| c9e7ddf7-b2a3-4584-9d59-e85e3c661cc3 | confirmed | linear_inequalities | explanation_raw_latex | Which of the following describes all values of x that satisf |
| e978c7da-e4e8-4dad-84cf-1075bfed6c1b | confirmed | linear_inequalities | explanation_raw_latex | Which of the following describes all values of x that satisf |
| ee667166-1d5c-4698-b1a1-f6d618c34aa1 | draft | linear_inequalities | explanation_raw_latex, unpublished_draft_unreviewed | Which of the following describes all values of x that satisf |
| f5856976-c538-418c-a04d-e96a7178984c | confirmed | linear_inequalities | explanation_raw_latex | Which of the following describes all values of x that satisf |

## 6. 부작용: A를 `mock_exam`으로 옮겼을 때 수업 후보 풀

(읽기 전용 카운트, `problem_auto_composition_candidates` = usage_scope가 general/both 인 공개 문제만)
- 후보 풀 전체: **20행, 키워드 3개**. 이 중 A가 **19행(95%)**. 옮기면 풀에 **1행**만 남고, A에만 연결된 키워드 **2개는 후보가 0**이 된다(`problem_keywords` 총 121행 중 A 19행이 키워드에 매핑; 매핑된 키워드 3개뿐).
- 이 키워드를 쓰는 커리큘럼 유닛: 카탈로그(subject_template) 유닛 **2**, 선생님 유닛 **3**, 오버레이 유닛 **10**.
- 유닛에 담긴 A 문제: 카탈로그 유닛 문제 14행(자동 `auto` 8행/1유닛, 수동 `manual` 6행/2유닛), 선생님 유닛 문제 0행, 오버레이 준비안(curriculum_unit_prep_items) 38행/준비안 3개/오버레이 유닛 3개(전체 problem 준비 항목 63행 중).
- 회차 연결: 준비 선택(session_prepared_selections)에 A 문제 4행 — `staged` 1건(회차 36dc3c4e…, 상태 scheduled=예정, 2행), `pinned` 1건(회차 b14e0068…, 이미 completed, 2행). 매니페스트(session_content_manifest)에 A 2행/회차 1개(위 completed 회차; 진행 중·예정 회차 0).
- **고정·배정 항목은 변하지 않는다**: 고정(pin)은 `problem_keywords_selectable`(변경 없음)을 읽고 매니페스트·완료 회차는 재분류 영향 밖(설계 문서 "고정 불변"). 바뀌는 것은 (1) 카탈로그 `auto` 8행·오버레이 자동 항목이 **다음 동기화/재구성 때** 후보에서 빠지는 것, (2) 새로 담거나 키워드로 발급할 때 A가 후보에서 제외되는 것뿐이다. 즉 지금 수업 후보 풀은 사실상 비게 된다(1행 남음) — 수업용으로 쓸 일반용 문제를 새로 만들어야 수업 자동 구성이 계속 동작한다.
- 참고: 숙제 항목 테이블(`homework_items`)은 문제 원본을 참조하지 않는 자유 텍스트/제목 구조라 이번 이동과 무관.

## 7. 권고와 위험

1. **A 195건 → `mock_exam`**, **B 14건 → 수정 없이 보관**(ID 파일 참조). B 14건은 키워드 매핑·유닛·준비안·선택·매니페스트 참조가 모두 0건임을 확인했다(보관해도 수업 쪽 영향 없음, 공개 7건은 학생 후보에서 빠질 뿐).
2. **C 166건은 오너 결정**. 제안: (a) 깨끗한 미공개 초안 109건 — 공개 전이라 보류 또는 `mock_exam` 태깅 후 미공개 유지; (b) '쉽게 지워지는 오답' 47건 — 난이도 신호에 가까워 모의고사 품질 기준에는 부적합하면 보관; (c) 해설 LaTeX 10건 — 세션 화면은 렌더하므로 보관 불필요할 수 있으나 2026-09-18 선례는 보관.
3. 위험: "검수됨"은 본인 확인이며 195건 중 185건은 2026-09-20 01시대에 같은 관리자가 한 시간 안에 일괄 공개했다(심층 검수 여부는 데이터로 알 수 없음). 컴파일러 산출물 비중이 높아(A 184건이 compiler) 정답·수치는 결정론적으로 안전하나 R&W 검수는 11건뿐이다. A를 옮기면 수업 후보 풀이 1행이 되는 부작용이 가장 큰 영향이다.
4. 한계: 자체 검사만 수행(Anthropic·외부 호출 없음). 난이도 적정성·모의고사 커버리지(영역·기술별 분포)는 평가하지 않았고, 정답 정확성은 컴파일러 신뢰 + 저장된 독립검사 결과에 의존한다.

## 적용 결과 (2026-09-29, 총괄이 공유 non-prod 에 적용)
- A 195개 → `usage_scope='mock_exam'`(감사 `problem_usage_scope_changes` 195행), B 14개 → 수정 없이 보관(`archived_reason` 기록). 적용 전 목록·조건(활성·공용·confirmed)을 원격에서 재검증했고 개수 가드 트랜잭션으로 실행.
- 미처리: C 166개(공개 20+7·초안 109+27+3 등 — 위 표)는 여전히 `both`·활성. 오너 결정 대기.
- 수업 쪽 영향: 오너 확인(2026-09-29) — 커리큘럼 셋업 전이라 문제 없음.
- 되돌리기: 재분류는 `retag_problem_usage_scope`(both 로는 못 돌아가고 general 로만), 보관은 `archived_at=null`.
