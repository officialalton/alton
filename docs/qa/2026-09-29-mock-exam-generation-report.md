# 2026-09-29 모의고사용(mock_exam) RW·Math 신규 문항 생성·AI 검수 보고

실행 ID `mockgen-20260929`. 산출물: `data/mock-exam-generation/mockgen-20260929/` (`raw/` 생성 원본 1,410, `review/` 검수 로그, `final/passed.json` 통과 520, `final/archive-candidates.json` 보관 후보 890, `final/summary.md|json` 셀별 표, `plan-round1~4.json`, 각 라운드 로그). DB 쓰기는 로컬 시험 임포트뿐(시험 데이터 전부 삭제 확인), 원격·배포·푸시 없음.

## 1. 방법
- **필요량**: 풀 요구량 보고서의 3배 풀(RW 243 / Math 198). 영역별 3배 풀(보고서 3절)을 영역 안 skill 비중으로 나누고(RW: info 30/25/25/20, craft 45/35/20, expression 50/50, SEC 50/50; Math: algebra 5개 균등, advanced 3개 균등, PSD 7개 균등, geometry 26/26/26/22), 난이도는 풀 난이도 비율(RW easy 54 / medium 162 / hard 27, Math 42 / 132 / 24)로 배분해 **skill x 난이도 칸** 목표를 만들었다(M1·M2 lower는 easy·medium, M2 higher는 medium·hard를 쓰므로 hard는 M2 higher 전용 — M1에 hard를 만들지 않음). 종료 기준(총괄 보강): 칸마다 **기존 공개 + 신규 검수 통과 >= 3세트분 + 여분 2**.
- **생성**: 기존 `runGenerationPipeline`(생성 -> 자료 -> 품질 계약 -> 파이프라인 독립 채점)을 그대로 사용. Math는 SPR 약 25%(evaluating_statistical_claims 제외). 계산형 컴파일러가 아니라 AI 경로를 쓴 이유: 컴파일러 문항은 (skill, 세부 패턴)이 같으면 유사문항 그룹이 같아 세트당 1문항만 들어갈 수 있다. 임포트 시 AI 문항은 본문 해시 그룹이라 520건이 520개 서로 다른 그룹을 받았다.
- **AI 검수 패스**(별도 호출 2회 + 결정론): 1) 블라인드 풀이(정답·해설 미공개) — 정답 일치, 정답 유일성, 추정 난이도, 쉽게 지워지는 오답 수. 2) 감사(정답·해설 공개) — 해설 정합성, 형식(빈칸·Text 1/2·깨진 수식·영문 혼입), 사실 오류, 기존 시험 문항 재현(저작권) 의심. 3) 결정론 — 지문·선택지의 원시 LaTeX 명령, 해설의 `$` 밖 LaTeX·`$` 짝 불일치, 내부 필드명 노출, 빈 해설, 생성분 간 3-gram Jaccard 0.6 이상 중복(숫자 마스킹). **고치지 않고** 통과/보관 후보만 가른다.
- **판정 규칙(임계값은 `aggregate.ts` 인자로 조정, AI 재호출 불필요)**: 오답 제거 용이성은 easy 4(판정 안 함) / medium 3 / hard 2 이상이면 보관 후보. 난이도 라벨은 블라인드 추정과 두 단계 이상(hard<->easy) 어긋나면 보관 후보, 단 라벨 hard이고 파이프라인 추정도 hard면 통과(풀이 모델이 SAT 문항을 대체로 쉽게 봄).
- **라운드**: 1차 490건(계획 491) -> 총괄 보강 기준으로 부족 칸만 재생성 3회(2차 528 / 3차 259 / 4차 133, 생성량 = 미달분 / 칸·skill 통과율 하한 0.3 올림 + 1).

## 2. 결과 요약
- 생성(파이프라인 통과) 1,410 = RW 923 + Math 487. **AI 검수 통과 520**(RW 324, Math 196), **보관 후보 890**(RW 599, Math 291). 통과율 37%(hard 칸은 660건 중 77건, 12%).
- 보관 사유(중복 계상): 오답 쉽게 지워짐 500, 난이도 라벨 불일치 397, 해설 불일치 208, 정답 불일치 92, 사실 오류 52, 형식 결함 58, 정답 복수 36, 빈 해설 22, 원시 LaTeX 27, 생성분 간 중복 9, 저작권 의심 4. 원본 JSON은 삭제하지 않았고 보관 후보는 수정하지 않았다.
- **미달 칸 13개, 전부 hard**(아래 표의 "미달" 열). 그중 3개는 세트 3개분(여분 제외)에도 못 미친다: central_ideas_details hard 1/2, words_in_context hard 1/3, transitions hard 2/3. 나머지 10개는 3세트분은 충족, 여분만 부족(예: inferences hard 3/4, nonlinear_functions hard 3/5). 재생성 상한(3회)에 도달해 멈췄다.

## 3. 셀별 최종 수량
"기존 공개(가정)" 주의: 원격 난이도 실측을 읽을 수 없어(이 세션은 원격 읽기 권한 없음) skill별 총량(분류 보고서 A)을 풀 난이도 비율로 나눈 **가정치**다. 총괄이 원격 실측(skill x 난이도)을 JSON으로 주면 `plan.ts --supply`/`aggregate.ts`가 같은 표를 다시 계산한다(형식 `{"<skill>": {"easy":n,"medium":n,"hard":n}}`).

| 영역 | skill | 난이도 | 필요량(3세트 +여분2) | 기존 공개(가정) | 신규 생성(파이프라인 통과) | 신규 검수 통과 | 보관 후보 | 최종 | 여분(최종−3세트분) | 미달 |
|---|---|---|---|---|---|---|---|---|---|---|
| rw_information_ideas | central_ideas_details | easy | 6 | 0 | 6 | 6 | 0 | 6 | 2 |  |
| rw_information_ideas | central_ideas_details | medium | 15 | 1 | 27 | 14 | 13 | 15 | 2 |  |
| rw_information_ideas | central_ideas_details | hard | 4 | 0 | 31 | 1 | 30 | 1 | -1 | 3 |
| rw_information_ideas | inferences | easy | 5 | 0 | 8 | 6 | 2 | 6 | 3 |  |
| rw_information_ideas | inferences | medium | 13 | 1 | 47 | 13 | 34 | 14 | 3 |  |
| rw_information_ideas | inferences | hard | 4 | 0 | 29 | 3 | 26 | 3 | 1 | 1 |
| rw_information_ideas | command_of_evidence_text | easy | 5 | 0 | 14 | 7 | 7 | 7 | 4 |  |
| rw_information_ideas | command_of_evidence_text | medium | 13 | 0 | 35 | 16 | 19 | 16 | 5 |  |
| rw_information_ideas | command_of_evidence_text | hard | 4 | 0 | 20 | 6 | 14 | 6 | 4 |  |
| rw_information_ideas | command_of_evidence_quant | easy | 5 | 0 | 8 | 7 | 1 | 7 | 4 |  |
| rw_information_ideas | command_of_evidence_quant | medium | 10 | 2 | 19 | 10 | 9 | 12 | 4 |  |
| rw_information_ideas | command_of_evidence_quant | hard | 3 | 0 | 20 | 3 | 17 | 3 | 2 |  |
| rw_craft_structure | words_in_context | easy | 9 | 0 | 18 | 10 | 8 | 10 | 3 |  |
| rw_craft_structure | words_in_context | medium | 23 | 0 | 80 | 25 | 55 | 25 | 4 |  |
| rw_craft_structure | words_in_context | hard | 5 | 0 | 53 | 1 | 52 | 1 | -2 | 4 |
| rw_craft_structure | text_structure_purpose | easy | 7 | 0 | 11 | 9 | 2 | 9 | 4 |  |
| rw_craft_structure | text_structure_purpose | medium | 18 | 2 | 43 | 21 | 22 | 23 | 7 |  |
| rw_craft_structure | text_structure_purpose | hard | 5 | 0 | 40 | 4 | 36 | 4 | 1 | 1 |
| rw_craft_structure | cross_text_connections | easy | 5 | 0 | 5 | 5 | 0 | 5 | 2 |  |
| rw_craft_structure | cross_text_connections | medium | 11 | 1 | 29 | 11 | 18 | 12 | 3 |  |
| rw_craft_structure | cross_text_connections | hard | 4 | 0 | 28 | 6 | 22 | 6 | 4 |  |
| rw_expression_ideas | rhetorical_synthesis | easy | 7 | 0 | 11 | 9 | 2 | 9 | 4 |  |
| rw_expression_ideas | rhetorical_synthesis | medium | 18 | 1 | 37 | 22 | 15 | 23 | 7 |  |
| rw_expression_ideas | rhetorical_synthesis | hard | 5 | 0 | 49 | 3 | 46 | 3 | 0 | 2 |
| rw_expression_ideas | transitions | easy | 7 | 0 | 11 | 9 | 2 | 9 | 4 |  |
| rw_expression_ideas | transitions | medium | 18 | 3 | 25 | 15 | 10 | 18 | 2 |  |
| rw_expression_ideas | transitions | hard | 5 | 0 | 53 | 2 | 51 | 2 | -1 | 3 |
| rw_standard_english | boundaries | easy | 9 | 0 | 18 | 11 | 7 | 11 | 4 |  |
| rw_standard_english | boundaries | medium | 23 | 0 | 32 | 23 | 9 | 23 | 2 |  |
| rw_standard_english | boundaries | hard | 6 | 0 | 43 | 4 | 39 | 4 | 0 | 2 |
| rw_standard_english | form_structure_sense | easy | 9 | 0 | 16 | 12 | 4 | 12 | 5 |  |
| rw_standard_english | form_structure_sense | medium | 23 | 0 | 37 | 23 | 14 | 23 | 2 |  |
| rw_standard_english | form_structure_sense | hard | 5 | 0 | 20 | 7 | 13 | 7 | 4 |  |
| algebra | linear_equations_one_var | easy | 5 | 2 | 5 | 4 | 1 | 6 | 3 |  |
| algebra | linear_equations_one_var | medium | 11 | 10 | 3 | 1 | 2 | 11 | 2 |  |
| algebra | linear_equations_one_var | hard | 4 | 1 | 22 | 2 | 20 | 3 | 1 | 1 |
| algebra | linear_functions | easy | 5 | 4 | 3 | 2 | 1 | 6 | 3 |  |
| algebra | linear_functions | medium | 11 | 16 | 0 | 0 | 0 | 16 | 7 |  |
| algebra | linear_functions | hard | 4 | 2 | 10 | 2 | 8 | 4 | 2 |  |
| algebra | linear_equations_two_var | easy | 5 | 0 | 8 | 6 | 2 | 6 | 3 |  |
| algebra | linear_equations_two_var | medium | 11 | 1 | 15 | 12 | 3 | 13 | 4 |  |
| algebra | linear_equations_two_var | hard | 4 | 0 | 22 | 3 | 19 | 3 | 1 | 1 |
| algebra | systems_linear | easy | 5 | 1 | 6 | 6 | 0 | 7 | 4 |  |
| algebra | systems_linear | medium | 11 | 4 | 13 | 8 | 5 | 12 | 3 |  |
| algebra | systems_linear | hard | 4 | 0 | 37 | 2 | 35 | 2 | 0 | 2 |
| algebra | linear_inequalities | easy | 5 | 2 | 7 | 4 | 3 | 6 | 3 |  |
| algebra | linear_inequalities | medium | 11 | 7 | 8 | 5 | 3 | 12 | 3 |  |
| algebra | linear_inequalities | hard | 3 | 1 | 13 | 2 | 11 | 3 | 2 |  |
| advanced_math | equivalent_expressions | easy | 7 | 1 | 9 | 8 | 1 | 9 | 4 |  |
| advanced_math | equivalent_expressions | medium | 17 | 7 | 15 | 10 | 5 | 17 | 2 |  |
| advanced_math | equivalent_expressions | hard | 5 | 0 | 36 | 4 | 32 | 4 | 1 | 1 |
| advanced_math | nonlinear_equations_systems | easy | 7 | 0 | 8 | 7 | 1 | 7 | 2 |  |
| advanced_math | nonlinear_equations_systems | medium | 17 | 2 | 25 | 15 | 10 | 17 | 2 |  |
| advanced_math | nonlinear_equations_systems | hard | 5 | 0 | 23 | 6 | 17 | 6 | 3 |  |
| advanced_math | nonlinear_functions | easy | 7 | 3 | 7 | 6 | 1 | 9 | 4 |  |
| advanced_math | nonlinear_functions | medium | 17 | 11 | 6 | 6 | 0 | 17 | 2 |  |
| advanced_math | nonlinear_functions | hard | 5 | 1 | 36 | 2 | 34 | 3 | 0 | 2 |
| problem_solving_data | ratios_rates_units | easy | 3 | 1 | 8 | 6 | 2 | 7 | 6 |  |
| problem_solving_data | ratios_rates_units | medium | 5 | 5 | 0 | 0 | 0 | 5 | 2 |  |
| problem_solving_data | ratios_rates_units | hard | 3 | 0 | 18 | 5 | 13 | 5 | 4 |  |
| problem_solving_data | percentages | easy | 3 | 1 | 5 | 5 | 0 | 6 | 5 |  |
| problem_solving_data | percentages | medium | 5 | 7 | 0 | 0 | 0 | 7 | 4 |  |
| problem_solving_data | percentages | hard | 3 | 1 | 10 | 3 | 7 | 4 | 3 |  |
| problem_solving_data | one_variable_data | easy | 3 | 2 | 3 | 3 | 0 | 5 | 4 |  |
| problem_solving_data | one_variable_data | medium | 5 | 7 | 0 | 0 | 0 | 7 | 4 |  |
| problem_solving_data | two_variable_data | easy | 3 | 1 | 5 | 3 | 2 | 4 | 3 |  |
| problem_solving_data | two_variable_data | medium | 5 | 7 | 0 | 0 | 0 | 7 | 4 |  |
| problem_solving_data | probability | easy | 3 | 1 | 5 | 5 | 0 | 6 | 5 |  |
| problem_solving_data | probability | medium | 5 | 6 | 0 | 0 | 0 | 6 | 3 |  |
| problem_solving_data | inference_margin_error | easy | 3 | 0 | 4 | 4 | 0 | 4 | 3 |  |
| problem_solving_data | inference_margin_error | medium | 5 | 4 | 2 | 2 | 0 | 6 | 3 |  |
| problem_solving_data | evaluating_statistical_claims | easy | 3 | 1 | 5 | 3 | 2 | 4 | 3 |  |
| problem_solving_data | evaluating_statistical_claims | medium | 5 | 4 | 7 | 2 | 5 | 6 | 3 |  |
| geometry_trig | area_volume | easy | 4 | 6 | 0 | 0 | 0 | 6 | 4 |  |
| geometry_trig | area_volume | medium | 7 | 23 | 0 | 0 | 0 | 23 | 18 |  |
| geometry_trig | area_volume | hard | 3 | 3 | 0 | 0 | 0 | 3 | 2 |  |
| geometry_trig | lines_angles_triangles | easy | 4 | 0 | 6 | 6 | 0 | 6 | 4 |  |
| geometry_trig | lines_angles_triangles | medium | 7 | 0 | 15 | 11 | 4 | 11 | 6 |  |
| geometry_trig | lines_angles_triangles | hard | 3 | 0 | 19 | 2 | 17 | 2 | 1 | 1 |
| geometry_trig | right_triangles_trigonometry | easy | 4 | 1 | 10 | 9 | 1 | 10 | 8 |  |
| geometry_trig | right_triangles_trigonometry | medium | 7 | 7 | 0 | 0 | 0 | 7 | 2 |  |
| geometry_trig | right_triangles_trigonometry | hard | 3 | 0 | 21 | 3 | 18 | 3 | 2 |  |
| geometry_trig | circles | easy | 3 | 4 | 0 | 0 | 0 | 4 | 3 |  |
| geometry_trig | circles | medium | 6 | 13 | 0 | 0 | 0 | 13 | 9 |  |
| geometry_trig | circles | hard | 3 | 2 | 7 | 1 | 6 | 3 | 2 |  |
| **sat_rw 합계** | | | 309 | 11 | 923 | 324 | 599 | 335 | 92 | 16 |
| **sat_math 합계** | | | 302 | 183 | 487 | 196 | 291 | 379 | 181 | 8 |

보관 사유 집계: {"format_defect":58,"answer_mismatch":92,"explanation_inconsistent":208,"weak_distractors":500,"difficulty_label_mismatch":397,"factual_error":52,"ambiguous_answer":36,"empty_explanation":22,"raw_latex_in_explanation":13,"near_duplicate_of":9,"raw_latex_in_body":14,"copyright_suspect":4}


## 4. 임포트 스크립트와 로컬 시험
- `scripts/mock-exam-generation/import.ts --file final/passed.json [--publish] [--tag T]`: `create_bank_problem(p_usage_scope=mock_exam)` -> `created_via=ai_generated` -> `save_problem_draft_version` -> `set_problem_render_check` -> `set_problem_quality`(검수 결과 포함) -> 선택 공개(`confirm_and_publish_problem_version`). 유사문항 그룹은 DB 트리거가 자동 부여.
- **재실행 안전**: 같은 skill에 지문·질문이 같은 버전이 있으면 건너뜀, 기존 은행과 본문 유사도 0.6 이상이면 중복으로 건너뜀(`--no-dup-check`로 끔). 환경은 `.env.local` 대상 DB를 따르므로 원격 실행은 총괄이 환경을 지정한다.
- **로컬 시험**(태그 `full1`): 520건 전부 생성·공개 성공(실패 0), 전부 `usage_scope=mock_exam`·`confirmed`·`published`, 유사문항 그룹 520개(null 0), 재실행 시 520건 전부 건너뜀, `--cleanup-tag`로 시험 데이터 520건 삭제(잔여 0).

## 5. 결정·주의
1. **hard 미달 13칸**: 선택지는 (a) 오너 승인 하에 hard 생성·검수를 추가 라운드 진행(통과율 12%라 칸당 수십 건 필요), (b) M2 higher가 medium·hard 모두 적격이므로 해당 칸을 medium 여분(대부분 칸에서 +2~7 여유)으로 대체 — 난이도 구성만 medium 쪽으로 기운다.
2. 기존 공개 난이도 실측이 가정치다 — 실측이 다르면 칸별 미달이 달라지므로 위 JSON으로 재집계 필요.
3. 해설의 `$...$`(KaTeX)는 모든 화면이 LearningText로 렌더하므로 결함으로 보지 않았다. 2026-09-29 분류 때 같은 형태 10건을 일관성으로 보관한 전례가 있어, 엄격 적용을 원하면 해설 `$` 포함 문항(Math 대부분)을 추가 보관해야 한다(이 경우 Math 통과 수가 크게 줄어 재생성이 필요).
4. 오답 제거 용이성·난이도 라벨은 AI 판정이라 임계값에 민감하다(`--weak easy=4,medium=3,hard=2`). 더 엄격히 하면 통과 수가 줄어든다.
5. 저작권 의심은 모델 자기 지식 기준의 1차 점검이며 법적 확인이 아니다.

## 6. 외부 변경
Anthropic API 호출(유료): 생성 파이프라인 367회 실행(후보당 내부 재생성·자료 생성·채점 호출 포함)과 검수 2회 x 약 1,400건. 그 외 원격 DB·Supabase 원격·배포·푸시 없음, 로컬 DB는 시험 임포트 후 정리 완료.
