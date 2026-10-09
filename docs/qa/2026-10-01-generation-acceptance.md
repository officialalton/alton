# 2026-10-01 생성 품질 합격 검증 (소량·전 skill·격리 스택)

대상: RW 11·Math 19 전 skill. 코퍼스: ① 채택 hard 59건(Opus 생성 + Fable hard 적합 + 정답 Fable·Opus 둘 다 + 레시피) ② 일반 통과 959건(Sonnet 5.5 동기 파이프라인 등, 이 중 결함 19건 제외 후 940건 임포트) ③ Sonnet 5.5 배치 easy/medium 17건(이번 신규 스모크, RW 10 skill). 공유 로컬 DB(54422) 미사용 — **격리 스택**(`ALTON-genacc`, 포트 545xx, 마이그레이션 `20261986` 까지 적용)에서만 임포트·조립·응시를 시험했다. 원격 접근·마이그레이션 없음, API 호출은 배치 스모크 1건($0.28)뿐.

## 0. 합격/불합격 요약
| 항목 | 판정 | 요약 |
|---|---|---|
| 1. 정답·해설 정확성 | **조건부 불합격** | RW 이중 독립 풀이 전수: 채택 hard 59/59, 배치 17/17, 일반 944/959(15건 불합 — 구 '승격 변형' 실험 산물로 이중 확인 없음). Math 결정론 재계산: 채택 hard 14/15 통과(1건 비숫자라 재계산 불가), **일반 Math 340건은 재계산 데이터 없음(결정론 100% 미충족)**. 위반(계약·선택지 중복·접두어·언어) 5건 + 이중 확인 15건 = **19건 임포트 제외** |
| 2. 표기·렌더 | **합격** | 전 문항(1,035건)의 지문·질문·선택지·해설을 앱 렌더 경로(`splitLearningContent/Blocks`)로 검사 — 수식 파싱 오류 0, 깨진 표 0. 렌더 검사(`render_check`) 임포트 후 실패 0. 단 '앱 자료 게이트 오탐' 경고 60건(아래) |
| 3. 임포트 정합 | **합격(+개선 2건)** | 전 skill 임포트→`usage_scope=mock_exam`·skill↔영역 일치·유사 그룹 999/999 고유·공개·렌더 OK 모두 일관, 재실행 시 전건 건너뜀. 개선: 키워드 미부착(0건), hard 13건이 판정 기록 없이 잠정 hard 로 임포트되던 결함(수정 완료) |
| 4. 다양성·중복 | **불합격** | 본문 유사도는 양호(최대 0.58, ≥0.6 쌍 0). 그러나 **소재 쏠림(marine biologist 계열 문두 다수)과 정답 위치 편향(inferences 86% A, RW 전체 A 48%·D 5%)** |
| 5. 조립 | **부분 합격** | 세트 내 중복 0·유사 그룹 중복 0·M1/M2 난이도 배정 위반 0·RW 81 전 모듈 충족. 생성 문항만으로는 Math hard(SPR·PSD·Geometry) 부족으로 기본 조립이 incomplete(예상: 원격 공급이 채움). **세트 간 재사용 차단이 소프트라 Math 에서 재사용 발생**(코드 변경 필요) |
| 6. 응시 종단 | **합격** | M1→경로→M2→휴식→Math M1→경로→M2→채점, 경로별 M2 문항 집합 일치, 만점 학생 higher·하위 학생 lower, 점수 범위 정상(1540~1600 / 570~690) |
| 7. 난이도 점검 연계 | **합격** | 잠정 hard 59건이 점검 목록에 보이고 상세에 hardJudge·advisory·recipeId 표시, 변경 시 `medium\|confirmed` 로 전환·이력 1행·조립 스냅샷 불변 |

## 1. 정답·해설 정확성
- **RW 이중 독립 풀이(전수, 저장 기록 기준)**: 채택 hard 59건은 Fable·Opus 정답 검수 모두 통과(59/59). 일반 959건 중 944건은 파이프라인 독립 채점 + `review.ts` 블라인드 풀이가 모두 지정 정답과 일치. **15건은 이중 확인이 없다**(구 '승격 변형' 기법 산물로 블라인드 풀이 1회만) → 임포트 제외. 배치 easy/medium 17건은 블라인드 풀이 일치 + 감사 `answer_correct` 통과분만 채택돼 기록상 이중 확인.
- **Math 결정론 재계산**: 채택 hard 15건 중 14건은 저장된 `verification_js` 를 다시 실행해 정답 값과 일치·오답 값과 불일치(14/14), 1건은 선택지가 비숫자라 재계산 불가. **일반 Math 340건은 `verification_js` 가 없어 재계산할 수 없다** — '수학 결정론 100%' 기준 미충족. 수정 제안: (a) 일반 Math 는 다른 세션의 결정론 컴파일러 산출로 대체, 또는 (b) 기존 문항마다 모델이 검증 스크립트를 쓰고 코드가 재계산하는 후처리(후보당 약 $0.01, 340건 약 $3.5) — 미실행.
- 임포트 제외 19건: 이중 확인 없음 15, 선택지 중복 1, 계약 위반(option_echo 1·option_language 1), 선택지 접두어("A)") 2(ID는 `acceptance/exclude-gids.json`).
- 해설 정합성: 채택 경로마다 감사 단계의 `explanation_consistent` 통과가 채택 조건이다(전수 재검사는 API 가 필요해 이번엔 저장된 판정 기록을 사용).

## 2. 표기·렌더
- 전수 검사 결과 수식 파싱 오류 0, 원시 LaTeX 노출 0(지문·선택지·해설 `$` 짝 불일치 0), 깨진 마크다운 표 0, 임포트 후 `render_check.ok = false` 0건.
- **앱 자료 게이트 오탐 경고 60건**: 앱 저장 경로(`createDraftVersionAction`)의 `materialBlocker` 는 본문의 'figure'·'as shown' 같은 낱말로 자료 종류를 '도형'이라 오판해 이미 그림(plane/data)이 있는 문항(systems_linear 17, linear_equations_two_var 16, nonlinear_functions 10, nonlinear_equations_systems 5 등)을 거부한다. 임포트 스크립트는 이 게이트를 우회하므로 임포트는 통과하지만 **관리자가 그 문항을 편집·재저장하면 거부될 수 있다**. 수정 제안: 문항에 그림이 이미 있으면 종류 불일치를 오류가 아닌 경고로 처리하거나 `figurePolicy` 를 전달.
- **Preview 육안 확인 샘플(총괄용)**: skill 당 2~3건(문항 gid = 품질 JSON `mockExamGeneration.gid`, 임포트 후 관리자 문제은행 검색). 확인 포인트 = 그 문항이 가진 표기 요소(수식·빈칸·밑줄·Text 1/2·메모 목록·그림/자료·SPR 입력). 전체 목록 `acceptance/preview-samples.md/.json`:

| skill | 문항 gid(품질 JSON mockExamGeneration.gid) | 난이도/형식 | 확인할 포인트 |
|---|---|---|---|
| area_volume | `0a85f397-2085-4920-87da-719bd0f26b1a` | easy/spr | 수식($…$), 그림/자료:solid, SPR 렌더·정답 표시·해설 수식 렌더 |
| area_volume | `2612d3d2-cdcf-4f13-953a-23e947e679f1` | easy/mc | 수식($…$), 그림/자료:circle 렌더·정답 표시·해설 수식 렌더 |
| area_volume | `40287680-3da1-49ba-9e95-85b7cafd6ee8` | easy/mc | 수식($…$), 그림/자료:solid 렌더·정답 표시·해설 수식 렌더 |
| boundaries | `f4dcff2e-6c99-4dad-bef6-8af843033ac9` | easy/mc | 그림/자료:data, 빈칸 렌더·정답 표시·해설 문단 |
| boundaries | `07fdeecb-6540-4e55-a54e-f5f6ab39d0aa` | medium/mc | 빈칸 렌더·정답 표시·해설 문단 |
| central_ideas_details | `16e4d181-e14d-42cd-8232-87776836b8ed` | medium/mc | 그림/자료:data 렌더·정답 표시·해설 문단 |
| central_ideas_details | `1e8ced65-37a9-4f7e-9636-bfc470c1565c` | easy/mc | 일반 텍스트 렌더·정답 표시·해설 문단 |
| circles | `7ab1804c-30b2-4cbf-91af-cb042d075ae9` | medium/spr | 수식($…$), 그림/자료:circle, SPR 렌더·정답 표시·해설 수식 렌더 |
| circles | `0361cf83-95c0-471c-a037-8023a6bbefdd` | easy/mc | 수식($…$), 그림/자료:circle 렌더·정답 표시·해설 수식 렌더 |
| circles | `09cf46f2-6aca-43b3-9d71-2c4f0cba716e` | medium/mc | 수식($…$), 그림/자료:composite 렌더·정답 표시·해설 수식 렌더 |
| command_of_evidence_quant | `d90f5e5b-62cd-4982-9182-baf5f4d6345f` | easy/mc | 수식($…$), 그림/자료:data 렌더·정답 표시·해설 수식 렌더 |
| command_of_evidence_quant | `06e70dab-0b4f-413e-abaf-664cfa5634d2` | easy/mc | 그림/자료:data 렌더·정답 표시·해설 문단 |
| command_of_evidence_text | `cad943b6-5c85-42a5-971f-6fb0d8dfd993` | medium/mc | 그림/자료:data 렌더·정답 표시·해설 문단 |
| command_of_evidence_text | `0da913b1-e7de-4f98-9e66-5cb901b4d253` | easy/mc | 일반 텍스트 렌더·정답 표시·해설 문단 |
| cross_text_connections | `006ab521-6a1e-4dd8-b698-584e72a4e6a5` | easy/mc | Text 1/2 렌더·정답 표시·해설 문단 |
| equivalent_expressions | `0fb4220d-70e3-414c-bad0-d265c8e86187` | medium/spr | 수식($…$), SPR 렌더·정답 표시·해설 수식 렌더 |
| equivalent_expressions | `01ea36e2-2166-45a3-8661-fc09993fc110` | medium/mc | 수식($…$) 렌더·정답 표시·해설 수식 렌더 |
| evaluating_statistical_claims | `2cb2eb08-942f-4ba6-99c5-276a73356ee0` | easy/mc | 그림/자료:data 렌더·정답 표시·해설 문단 |
| form_structure_sense | `047e2abb-8678-4aee-87e4-a13af7fef1c3` | medium/mc | 빈칸 렌더·정답 표시·해설 문단 |
| inference_margin_error | `1158b634-832c-4734-808d-b0b5e6babf81` | easy/mc | 수식($…$), 그림/자료:data 렌더·정답 표시·해설 수식 렌더 |
| inference_margin_error | `445a2567-9028-438e-b5e8-0d5147bf6c25` | easy/spr | 그림/자료:data, SPR 렌더·정답 표시·해설 문단 |
| inference_margin_error | `1262e758-b8b3-4d5c-a700-8ade981c29ef` | medium/mc | 그림/자료:data 렌더·정답 표시·해설 문단 |
| inferences | `00edac6a-d5d5-4c55-b359-6dd5bf148275` | easy/mc | 빈칸 렌더·정답 표시·해설 문단 |
| linear_equations_one_var | `017e8a57-46f2-44b3-9cab-258cc3ed86aa` | easy/spr | 수식($…$), SPR 렌더·정답 표시·해설 수식 렌더 |
| linear_equations_one_var | `108f617c-1300-4872-aaac-a8cc7e184a68` | medium/mc | 수식($…$) 렌더·정답 표시·해설 수식 렌더 |
| linear_equations_one_var | `615a95fd-f93e-4f4d-9c79-9631ba8abe5d` | medium/spr | SPR 렌더·정답 표시·해설 문단 |
| linear_equations_two_var | `60fa05ad-c76d-4a10-a46e-b5349390c6bb` | easy/spr | 수식($…$), 그림/자료:plane, SPR 렌더·정답 표시·해설 수식 렌더 |
| linear_equations_two_var | `2ae819a4-89e5-4997-87b8-b95c98a57ada` | easy/mc | 수식($…$), 그림/자료:plane 렌더·정답 표시·해설 수식 렌더 |
| linear_equations_two_var | `c42bf72f-7517-4dbb-a6d6-ba0d85767ee9` | easy/spr | 그림/자료:plane, SPR 렌더·정답 표시·해설 문단 |
| linear_functions | `e3a20c9a-7f24-4a7d-98ab-9088ef4ca3eb` | easy/spr | 수식($…$), 그림/자료:plane, 마크다운 표, SPR 렌더·정답 표시·해설 수식 렌더 |
| linear_functions | `94400a50-a5fa-47e6-953c-d6101764e5ba` | easy/spr | 수식($…$), 그림/자료:plane, SPR 렌더·정답 표시·해설 수식 렌더 |
| linear_functions | `10eafc29-478b-4172-abbf-7b5c6c2d5cd2` | medium/mc | 수식($…$), 그림/자료:plane 렌더·정답 표시·해설 수식 렌더 |
| linear_inequalities | `04578261-5932-4608-8c1d-33f0b795b42c` | medium/spr | 수식($…$), 그림/자료:plane, SPR 렌더·정답 표시·해설 수식 렌더 |
| linear_inequalities | `111db6c5-7f34-4f6f-aab5-a86ef186df4b` | medium/mc | 수식($…$), 그림/자료:plane 렌더·정답 표시·해설 수식 렌더 |
| linear_inequalities | `2b704caf-4481-498d-b9d1-aa8d1d4b5ecd` | medium/mc | 그림/자료:plane 렌더·정답 표시·해설 문단 |
| lines_angles_triangles | `30e2faa4-eaaa-45d6-bcc0-0c1256287ef1` | medium/spr | 수식($…$), 그림/자료:triangle, SPR 렌더·정답 표시·해설 수식 렌더 |
| lines_angles_triangles | `7ef4706e-1968-4ca5-8804-6e1ce98bb97e` | easy/spr | 수식($…$), 그림/자료:parallel_transversal, SPR 렌더·정답 표시·해설 수식 렌더 |
| lines_angles_triangles | `08db616f-37da-42df-a130-cc3864d530a9` | medium/mc | 수식($…$), 그림/자료:triangle 렌더·정답 표시·해설 수식 렌더 |
| nonlinear_equations_systems | `0f0e0752-352f-49fa-a084-24b5c91e1b51` | medium/spr | 수식($…$), 그림/자료:plane, SPR 렌더·정답 표시·해설 수식 렌더 |
| nonlinear_equations_systems | `06745ff8-8e3e-43d1-bdad-49cc174e7e22` | medium/mc | 수식($…$), 그림/자료:plane 렌더·정답 표시·해설 수식 렌더 |
| nonlinear_equations_systems | `8346b878-5af2-4d2d-af8d-17985a689032` | easy/mc | 그림/자료:plane 렌더·정답 표시·해설 문단 |
| nonlinear_functions | `4245f582-e550-4b4f-a264-e8cbf7a23eb1` | easy/spr | 수식($…$), 그림/자료:plane, SPR 렌더·정답 표시·해설 수식 렌더 |
| nonlinear_functions | `0a629561-277d-4291-9bd2-0fb8b95c50c7` | medium/mc | 수식($…$), 그림/자료:plane 렌더·정답 표시·해설 수식 렌더 |
| one_variable_data | `66ad1f3f-f93b-429a-bfcd-4d81978084bd` | easy/spr | 그림/자료:data, SPR 렌더·정답 표시·해설 문단 |
| one_variable_data | `4dbe701d-4118-4a60-88f5-c646e1845688` | easy/mc | 그림/자료:data 렌더·정답 표시·해설 문단 |
| percentages | `00a331da-a1c8-49c7-89b1-abd2e5a60b12` | medium/spr | 그림/자료:data, SPR 렌더·정답 표시·해설 문단 |
| percentages | `260151fc-ce18-46b4-bf92-76bfad11099c` | easy/mc | 수식($…$), 그림/자료:data 렌더·정답 표시·해설 수식 렌더 |
| percentages | `0d334af4-ca08-46de-8162-500afc52b7b4` | medium/mc | 그림/자료:data 렌더·정답 표시·해설 문단 |
| probability | `ab3d1a5f-28bf-4e55-8c42-0185ae78d8b1` | easy/spr | 그림/자료:data, 마크다운 표, SPR 렌더·정답 표시·해설 문단 |
| probability | `1300e0b9-26a6-4221-bfed-9e44d908dc20` | easy/mc | 수식($…$), 그림/자료:data 렌더·정답 표시·해설 수식 렌더 |
| probability | `511ff047-6f82-4506-9239-42eaa6055d70` | easy/mc | 그림/자료:data 렌더·정답 표시·해설 문단 |
| ratios_rates_units | `18ec5fbb-2079-4d2f-8317-4c39af5a7500` | medium/spr | 그림/자료:data, SPR 렌더·정답 표시·해설 문단 |
| ratios_rates_units | `00259c64-307d-4fc7-9259-a8f3cc7704d7` | easy/mc | 그림/자료:data 렌더·정답 표시·해설 문단 |
| rhetorical_synthesis | `c526ec1f-4be7-422d-9f12-8aae58405953` | easy/mc | 수식($…$), 메모 목록 렌더·정답 표시·해설 수식 렌더 |
| rhetorical_synthesis | `00371549-f930-44a1-b972-b6bf0233db88` | medium/mc | 메모 목록 렌더·정답 표시·해설 문단 |
| right_triangles_trigonometry | `10200761-b3ca-4ddb-909b-4ee8a79ec82b` | medium/spr | 수식($…$), 그림/자료:triangle, SPR 렌더·정답 표시·해설 수식 렌더 |
| right_triangles_trigonometry | `27602bf3-2581-4952-b3d7-0c8f3e5b9b85` | medium/spr | 수식($…$), 그림/자료:solid, SPR 렌더·정답 표시·해설 수식 렌더 |
| right_triangles_trigonometry | `3de60a55-826e-496c-bf78-58f89fe249eb` | medium/spr | 수식($…$), 그림/자료:circle, SPR 렌더·정답 표시·해설 수식 렌더 |
| systems_linear | `017f5883-4558-4f64-9c9b-37a76ae13d33` | medium/spr | 수식($…$), 그림/자료:plane, SPR 렌더·정답 표시·해설 수식 렌더 |
| systems_linear | `05041cad-0851-44a7-8a56-409e4b098928` | medium/mc | 수식($…$), 그림/자료:plane 렌더·정답 표시·해설 수식 렌더 |
| systems_linear | `batch3-pilot:recipe-systems_linear-00` | hard/mc | 수식($…$) 렌더·정답 표시·해설 수식 렌더 |
| text_structure_purpose | `01128865-ae39-4d98-9f28-848ed2b2e90b` | medium/mc | 밑줄 표기 렌더·정답 표시·해설 문단 |
| text_structure_purpose | `0a1d288a-4930-4487-8817-d9c9c50f2415` | easy/mc | 일반 텍스트 렌더·정답 표시·해설 문단 |
| transitions | `a7a555f1-7845-4e75-9535-56a1e6c4e0a7` | medium/mc | 그림/자료:data, 빈칸 렌더·정답 표시·해설 문단 |
| transitions | `03ae9479-1af2-4f87-bd88-30710870a92b` | medium/mc | 빈칸 렌더·정답 표시·해설 문단 |
| two_variable_data | `be57134d-9269-4e1c-8e9f-795a8bcf6f6d` | easy/spr | 수식($…$), 그림/자료:data, SPR 렌더·정답 표시·해설 수식 렌더 |
| two_variable_data | `75d85b76-df97-4457-abb9-a292faf6123c` | easy/mc | 수식($…$), 그림/자료:data 렌더·정답 표시·해설 수식 렌더 |
| two_variable_data | `e06440d5-f44f-4ac3-b3f8-41f53bcc25e9` | easy/mc | 그림/자료:data 렌더·정답 표시·해설 문단 |
| words_in_context | `0de60ce3-5fa8-4feb-a166-f032a268e305` | easy/mc | 그림/자료:data, 빈칸 렌더·정답 표시·해설 문단 |
| words_in_context | `0a8819e7-e301-4aec-9e59-ddc43d5a1cb7` | easy/mc | 빈칸 렌더·정답 표시·해설 문단 |
| words_in_context | `059ce665-8516-4c7e-b7fa-ef15ca443787` | easy/mc | 일반 텍스트 렌더·정답 표시·해설 문단 |

## 3. 임포트 정합(격리 스택)
- 임포트: 채택 hard 59 + 일반 940 + 배치 17 = **1,016건, 전부 생성·공개 성공, 실패 0**. 재실행: 59·940 전건 `skippedExisting`(같은 skill 지문·질문 일치), 생성 0.
- DB 검사: `usage_scope=mock_exam`·`status=confirmed`·공개 버전 존재 999건(당시 채택 hard + 일반, 배치 17건은 이후 추가 임포트), skill↔영역 불일치 0, 유사 그룹 null 0, 그룹 고유 999/999, 렌더 검사 실패 0, 공개 버전 난이도 = 문제 난이도(불일치 0).
- 잠정 hard: 채택 59건 모두 `difficulty_status=provisional`(자동 트리거) + 품질 JSON 에 `hardJudge`·`advisory`·`recipeId`·`difficultyStatus`.
- **결함 수정**: 구 Sonnet 검수 기반 '레시피 채택' hard 13건이 판정 기록(`hardJudge`) 없이 잠정 hard 로 임포트됐다 → `aggregate-lib` 가 일반 통과 문항에서 hard 를 만들지 않도록 고쳤고(hard 는 채택분 파일만), 격리 스택을 초기화해 전체를 다시 임포트해 0건임을 확인.
- **개선 필요**: 키워드(`problem_keywords`) 0건 — 생성 임포트는 키워드를 붙이지 않는다(관리자 검색·분류에 키워드가 필요하면 생성 단계 또는 후처리 필요).

## 4. 다양성·중복
| skill | n | 최대유사도 p50/p90/최대 | 유사 쌍(≥0.6) | 상위 토큰 점유 | 정답 위치 A/B/C/D | 유사그룹 키 비율 | 가장 흔한 문두 |
|---|---|---|---|---|---|---|---|
| area_volume | 8 | 0.42/0.43/0.43 | 0 | 0.75 | 1/2/2/1 | 1 | a cylindrical water(2) |
| boundaries | 70 | 0.12/0.16/0.21 | 0 | 0.27 | 44/21/0/5 | 1 | the marine biologist(9) |
| central_ideas_details | 63 | 0.03/0.07/0.08 | 0 | 0.57 | 11/33/16/3 | 1 | for decades, marine(12) |
| circles | 9 | 0.11/0.3/0.3 | 0 | 0.89 | 2/4/1/0 | 1 | in the circle(5) |
| command_of_evidence_quant | 32 | 0.07/0.11/0.11 | 0 | 0.56 | 15/10/5/2 | 1 | an economic historian(4) |
| command_of_evidence_text | 47 | 0.03/0.06/0.09 | 0 | 0.57 | 27/13/7/0 | 1 | a team of(4) |
| cross_text_connections | 49 | 0.05/0.09/0.15 | 0 | 0.59 | 22/19/8/0 | 1 | text 1 urban(10) |
| equivalent_expressions | 39 | 0.24/0.53/0.53 | 0 | 0.62 | 21/5/2/0 | 1 | which expression is(5) |
| evaluating_statistical_claims | 5 | 0.05/0.07/0.07 | 0 | 0.8 | 5/0/0/0 | 1 | an art historian(2) |
| form_structure_sense | 56 | 0.11/0.18/0.23 | 0 | 0.3 | 31/12/8/5 | 1 | the marine biologist(5) |
| inference_margin_error | 6 | 0.23/0.28/0.28 | 0 | 1 | 3/0/0/0 | 1 | a marine biologist(3) |
| inferences | 42 | 0.02/0.05/0.13 | 0 | 0.48 | 36/3/3/0 | 1 | art historians examining(5) |
| linear_equations_one_var | 17 | 0.05/0.26/0.26 | 0 | 0.47 | 2/2/6/1 | 1 | a beekeeper is(3) |
| linear_equations_two_var | 38 | 0.16/0.57/0.58 | 0 | 0.68 | 12/4/9/2 | 1 | in the $xy$-plane,(14) |
| linear_functions | 13 | 0.05/0.2/0.2 | 0 | 0.92 | 5/1/4/0 | 1 | the graph shows(6) |
| linear_inequalities | 16 | 0.05/0.1/0.1 | 0 | 0.63 | 6/3/3/1 | 1 | a landscaping company(2) |
| lines_angles_triangles | 26 | 0.14/0.34/0.34 | 0 | 0.85 | 5/4/5/4 | 1 | in the figure,(13) |
| nonlinear_equations_systems | 40 | 0.15/0.49/0.57 | 0 | 0.88 | 9/11/9/1 | 1 | in the $xy$-plane,(6) |
| nonlinear_functions | 34 | 0.19/0.31/0.41 | 0 | 1 | 11/8/5/0 | 1 | the graph shows(6) |
| one_variable_data | 3 | 0.03/0.03/0.03 | 0 | 0.67 | 0/2/0/0 | 1 | a city planner(1) |
| percentages | 13 | 0.04/0.09/0.09 | 0 | 0.69 | 2/6/2/1 | 1 | a marine biology(3) |
| probability | 5 | 0.18/0.18/0.18 | 0 | 1 | 3/1/0/0 | 1 | a city library(1) |
| ratios_rates_units | 15 | 0.03/0.1/0.1 | 0 | 0.67 | 1/6/1/0 | 1 | a marine biology(3) |
| rhetorical_synthesis | 86 | 0.09/0.19/0.25 | 0 | 1 | 24/40/20/2 | 1 | while researching a(86) |
| right_triangles_trigonometry | 23 | 0.12/0.41/0.42 | 0 | 0.78 | 2/5/6/1 | 1 | in right triangle(3) |
| systems_linear | 42 | 0.08/0.17/0.49 | 0 | 0.6 | 5/13/8/1 | 1 | a marine biology(6) |
| text_structure_purpose | 63 | 0.05/0.08/0.11 | 0 | 0.49 | 40/18/5/0 | 1 | art historians have(4) |
| transitions | 75 | 0.07/0.14/0.26 | 0 | 0.37 | 24/18/16/17 | 1 | marine biologists have(14) |
| two_variable_data | 3 | 0.05/0.05/0.05 | 0 | 1 | 1/0/1/0 | 1 | an art historian(1) |
| words_in_context | 97 | 0.07/0.12/0.22 | 0 | 0.38 | 57/33/5/2 | 1 | marine biologists studying(17) |
- **본문 유사도**: 모든 skill 에서 ≥0.6 쌍 0, 최대 0.58(linear_equations_two_var) — 중복 차단 기준은 통과.
- **소재 쏠림(불합격)**: 문두가 "marine biologist(s)…"(words_in_context 17/97, transitions 14/75, boundaries 9/70, systems_linear 6/42), "art historians…"(text_structure_purpose·inferences) 등 **모델 기본 소재로 수렴**한다. 씨앗 주입(§ 로드맵 문서의 주제 씨앗 배분표)이 없으면 대량 생성에서 소재 중복이 커진다. 이번 배치 easy/medium 스모크 17건에는 씨앗을 넣어 시험했다(소재 다양성은 수량이 적어 판정 보류).
- **정답 위치 편향(불합격)**: RW 전체 정답 위치 A 48%·B 32%·C 14%·D 5%, Math A 39%·B 31%·C 26%·D 5%. inferences 는 A 86%, words_in_context 59%, boundaries 63%, text_structure_purpose 63%. 학생이 위치만으로 맞힐 수 있는 **실제 품질 결함**이다. 수정 제안: (a) 생성 요청에 후보별 목표 정답 위치(A~D 균등 순환)를 넣어 모델이 그 자리에 정답을 두게 한다(선택지 순서는 모델이 정함), (b) 사후 검사로 skill별 위치 분포가 균등 범위를 벗어나면 차단, (c) 기존 생성분은 해설이 선택지 글자를 언급(RW 74%·Math 88%)해 단순 셔플이 불가하므로 해설의 글자 참조를 함께 다시 쓰는 후처리 또는 재생성이 필요.
- 유사 그룹 분산: 생성 AI 문항은 본문 해시 키라 전부 고유(키 비율 1.0) — 한 세트에 같은 그룹 중복이 구조적으로 없다. 컴파일러 문항은 (skill, 세부 패턴) 그룹이라 세트당 패턴 수가 상한.
- 표본이 작은 skill(one_variable_data 3·two_variable_data 3·probability 5·evaluating_statistical_claims 5·inference_margin_error 6): 전 skill 커버는 했지만 분포 해석은 보류.

## 5. 조립(격리 스택, 생성 문항만)
- 기본 조립(관리자 액션과 같은 순수 함수·같은 순서, 세트 2~3개 반복): RW 81(M1 27 + lower 27 + higher 27) **전 모듈 정원 충족**, Math M1·lower 22/22 충족, **Math M2 higher 18~20/22 부족** — 원인은 hard 칸(생성 채택 hard 는 전부 객관식 MC 이고 PSD·Geometry hard 가 없음): 기본 조립의 Math 형식 비중 mc75/spr25 가 hard 칸에도 적용돼 **hard SPR 칸이 비어** 부족이 생긴다(실제 조립은 원격 hard 공급이 일부 채움). 세트 내 중복 0, 세트 내 유사 그룹 중복 0, 난이도 배정(M1·lower 에 hard 없음, higher 에 easy 없음) 위반 0, 스냅샷 누락 0.
- **세트 간 재사용(코드 변경 필요)**: 관리자 액션은 '이미 쓴 문항'을 `excludeProblemIds` 로 넘기지만 선택 키가 `[skill 사용량, 재사용 여부, 노출 이력, id]` 순이라 **skill 균형이 재사용 회피보다 앞서** 미사용 후보가 있어도 재사용한다(세트 2 에서 3건, 세트 3 에서 9건 재사용, RW 는 풀이 커서 0). '문항 재사용 없음'(30세트)에는 세트 간 문항을 **하드 제외**해야 한다.
- 종단 시험용 세트(부족한 hard 칸을 같은 모듈에 허용되는 medium 으로 보충, `ACC-…-nofmt`): ready.

## 6. 응시 종단(격리 스택, 조립 세트)
- 학생 2명(상위·하위)이 M1(RW)→경로 결정→M2→휴식→M1(Math)→경로→M2→채점. 경로별 M2 문항 집합이 세트의 해당 변형과 일치, 총 문항 54 + 44.
- 상위 학생: RW·Math 모두 higher 경로, 점수 범위 RW 770~800·Math 770~800·총 1540~1600. 하위 학생: 둘 다 lower, RW 280~340·Math 290~350·총 570~690(하위 경로 상한 적용). 모두 범위 정상(low ≤ high, 섹션 200~800).

## 7. 난이도 점검 연계
- 점검 목록: 잠정 59건(`changed`·`confirmed` 0 → 변경 후 요약 반영), 상세에 `hardJudge`·`advisory`·`recipeId`·`generationStatus=provisional_ai` 표시.
- `review_problem_difficulty` 로 hard→medium 변경: `medium|confirmed|medium`(문제·공개 버전 난이도 일치), 이력 행 1건 생성, 이미 세트에 들어간 문항의 `mock_exam_set_items.difficulty`(스냅샷)는 그대로(hard), `needsSetReplacement` 빈 배열(세트가 이 문항을 쓰면 교체 안내가 나오는 구조 확인은 해당 기능 테스트가 담당).

## 8. 불합격 원인과 수정 제안(우선순위)
1. **정답 위치 편향**(4): 생성 시 후보별 목표 정답 위치를 주입 + 사후 분포 검사. 기존 생성분은 해설 글자 참조 재작성 후처리 또는 재생성.
2. **소재 쏠림**(4): 주제 씨앗 주입(로드맵 문서의 배분표), 전역 유사도 인덱스에 '문두·소재 키워드' 빈도 한도 추가.
3. **일반 Math 결정론 재계산 불가**(1): 컴파일러 산출로 대체하거나 후처리 검증 스크립트 생성.
4. **세트 간 재사용 하드 제외**(5): 조립 코드 변경.
5. **hard SPR 공급 없음 / PSD·Geometry hard**(5): hard 생성에서 SPR·해당 영역 포함, 또는 조립의 형식 비중을 hard 칸에 적용하지 않는 규칙.
6. 앱 자료 게이트 오탐, 키워드 미부착(2·3).
7. Sonnet 5.5 배치 easy/medium 은 이번에 17/20 채택(boundaries 0/2, form_structure_sense 1/2 — SEC 계열 정답 불일치·해설 불일치): SEC skill 은 배치에서도 수율이 낮다.
