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

## 3. 2차 라운드(2026-09-30): 소량 시험 -> 점검 -> 확대 기록
기준 플랜은 총괄이 원격 실측(활성 mock_exam 303)으로 갱신한 `data/mock-exam-generation/plan.json`. 기법마다 소량 표본 -> 기준 통과율 -> 계속/수정/폐기.

| 기법 | 표본·측정 | 기준 | 판단 |
|---|---|---|---|
| 난이도 재라벨(집계만, AI 재호출 0) | 기존 보관 890건 재판정 | 효과 확인 | **계속**. 원안(블라인드 추정으로 무조건 재라벨)은 풀이 모델이 거의 모두 easy로 봐 통과 1,003건이 easy 851/medium 152/hard 0으로 쏠려 medium·hard 칸이 더 비었다(미달 143). 그래서 **합의 방식**으로 조정: 블라인드·파이프라인 추정이 일치하면 그 난이도, 갈리고 라벨이 파이프라인 쪽이면 라벨 유지, 셋이 모두 다르면 중앙값, 블라인드 확신 낮음만 보관. 통과 520 -> 852. `RELABEL_MODE=literal`로 원안 재현 가능 |
| 오답 보수(선지만 교체, 보수 후 블라인드·감사 재통과) | 1차 206건 시도: 유효 보수 76건에 그쳐 원인 조사 -> 모델이 선지 번호를 1부터 세는 인덱스 오류(0/1 기반) 발견, 알파벳 지정으로 수정 | 보수 후 통과 50% | 수정 후 재시험 32건(92·108건 누계): 통과 37~40/108 = **37%**. 프롬프트 v2(채점 기준 명시) 재시험 16건 6건 통과(38%), 개선 없음. 주 실패 = 여전히 weak_distractors(블라인드 채점자가 보수 선지도 지움) -> **기준 미달**이라 확대하지 않고 종료(총 통과 +40건). 이후 미달 칸이 없어 추가 보수 불필요 |
| hard 승격 변형(통과 medium -> hard 새 문항) | RW 21건, Math 8건 | hard로 통과 40% | RW 76% 통과하나 hard 유지는 1/21(5%), 나머지는 medium·easy로 재라벨. Math 0/8(해설 계산 모순·정답 불일치 — 다단계 산술을 모델이 검산 없이 써서 깨짐). **hard 공급원으로는 폐기**(RW 변형은 medium 공급으로만 유효) |
| 개선 hard 직접 생성 프롬프트(hard 정의·few-shot·검산 지시; `extraGuidance`는 스크립트 전용, 운영 경로 변화 없음) | RW 16건·Math 12건 | 기준선 대비 개선 | 기준선 hard 통과+hard 유지: RW 31/386(8%), Math 24/274(9%). 개선본: RW 1/16, Math 0/12. **개선 없음 -> 폐기**. 근본 원인은 프롬프트가 아니라 검수 모델이 SAT 문항을 대체로 easy/medium으로 판정하는 것 |
| 보충 생성(미달 칸, 부족분/통과율) | Math easy 3칸(linear_functions, area_volume, circles) 24건 | - | 24/24 파이프라인 통과 후 검수 통과 20, 모든 칸 충족 |

**hard 처리 결론**: hard 칸은 실제로는 M2 higher가 medium·hard 모두 적격이므로 같은 skill의 medium 여분(필요량 초과분)으로 대체했다(총괄 지시). hard로 직접 통과한 문항은 RW 33·Math 24. 대체 전 미달 21칸분(RW 16·Math 5)이 medium 여분으로 메워져 대체 후 미달 0이다.

API 호출(개략, 이번 라운드): 생성 — hard 시험 약 615 + 보충(6차) 약 118 = 약 730(파이프라인 내부 호출 포함); 보수 — 시도 206+32+16 = 254 호출(실패 재시도 포함 최대 3배), 보수본 재검수 108건 x 2 = 216; 승격 변형 29 + 재검수 29 x 2 = 87; 신규 문항 재검수(hard 시험 28 + 보충 24 + 승격 29) x 2 = 162. 보관 890건 재집계와 재라벨은 AI 호출 0.

## 4. 최종 결과(2차 이후)
- **최종 passed.json 938건**(RW 603 + Math 335; 기존 520 전부 포함, 중복 없음). 난이도: RW easy 196/medium 374/hard 33, Math easy 139/medium 172/hard 24. 보관 후보 553.
- **기존 passed 520 중 107건은 난이도 라벨이 바뀌었다**(재라벨). 이미 원격에 넣었다면 임포트가 "같은 지문·질문 있음"으로 건너뛰므로 원격 라벨은 옛 값 그대로다 — 원하면 원격에서 해당 버전 난이도를 갱신해야 한다. `final/passed.json`의 `requestedDifficulty`(생성 때 라벨)·`relabeled`·`repaired` 필드로 구분.
- 임포트 로컬 시험(태그 `full2`): 938건 생성, 937건 공개, 1건(gid eabd2b5b…, rw_question 렌더 검사 미통과)은 초안만, 재실행 938 전부 건너뜀, 정리 후 잔여 0.
- 종료 조건: hard 미달은 medium 여분 대체 후 전 칸 충족(RW·Math 미달 0).

### 칸별 수량표(필요량 = 3세트분 + 여분 2, 기존은 원격 실측)
| 영역 | skill | 난이도 | 필요량(3세트 +여분2) | 기존 공개(가정) | 신규 생성(파이프라인 통과) | 신규 검수 통과 | 보관 후보 | 최종 | 여분(최종−3세트분) | 미달 | 미달(hard는 medium 여분 대체 후) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| rw_information_ideas | central_ideas_details | easy | 6 | 0 | 14 | 13 | 1 | 13 | 9 |  |  |
| rw_information_ideas | central_ideas_details | medium | 15 | 1 | 47 | 37 | 10 | 38 | 25 |  |  |
| rw_information_ideas | central_ideas_details | hard | 4 | 0 | 10 | 2 | 8 | 2 | 0 | 2 |  |
| rw_information_ideas | inferences | easy | 5 | 0 | 15 | 10 | 5 | 10 | 7 |  |  |
| rw_information_ideas | inferences | medium | 13 | 0 | 60 | 23 | 37 | 23 | 12 |  |  |
| rw_information_ideas | inferences | hard | 4 | 1 | 12 | 1 | 11 | 2 | 0 | 2 |  |
| rw_information_ideas | command_of_evidence_text | easy | 5 | 0 | 17 | 11 | 6 | 11 | 8 |  |  |
| rw_information_ideas | command_of_evidence_text | medium | 13 | 0 | 40 | 22 | 18 | 22 | 11 |  |  |
| rw_information_ideas | command_of_evidence_text | hard | 4 | 0 | 12 | 7 | 5 | 7 | 5 |  |  |
| rw_information_ideas | command_of_evidence_quant | easy | 5 | 0 | 15 | 13 | 2 | 13 | 10 |  |  |
| rw_information_ideas | command_of_evidence_quant | medium | 10 | 1 | 22 | 16 | 6 | 17 | 9 |  |  |
| rw_information_ideas | command_of_evidence_quant | hard | 3 | 1 | 10 | 3 | 7 | 4 | 3 |  |  |
| rw_craft_structure | words_in_context | easy | 9 | 0 | 74 | 49 | 25 | 49 | 42 |  |  |
| rw_craft_structure | words_in_context | medium | 23 | 0 | 78 | 34 | 44 | 34 | 13 |  |  |
| rw_craft_structure | words_in_context | hard | 5 | 0 | 6 | 0 | 6 | 0 | -3 | 5 |  |
| rw_craft_structure | text_structure_purpose | easy | 7 | 0 | 21 | 19 | 2 | 19 | 14 |  |  |
| rw_craft_structure | text_structure_purpose | medium | 18 | 0 | 58 | 34 | 24 | 34 | 18 |  |  |
| rw_craft_structure | text_structure_purpose | hard | 5 | 2 | 18 | 3 | 15 | 5 | 2 |  |  |
| rw_craft_structure | cross_text_connections | easy | 5 | 0 | 11 | 11 | 0 | 11 | 8 |  |  |
| rw_craft_structure | cross_text_connections | medium | 11 | 0 | 37 | 25 | 12 | 25 | 16 |  |  |
| rw_craft_structure | cross_text_connections | hard | 4 | 1 | 14 | 5 | 9 | 6 | 4 |  |  |
| rw_expression_ideas | rhetorical_synthesis | easy | 7 | 0 | 22 | 19 | 3 | 19 | 14 |  |  |
| rw_expression_ideas | rhetorical_synthesis | medium | 18 | 2 | 68 | 57 | 11 | 59 | 43 |  |  |
| rw_expression_ideas | rhetorical_synthesis | hard | 5 | 1 | 7 | 4 | 3 | 5 | 2 |  |  |
| rw_expression_ideas | transitions | easy | 7 | 0 | 16 | 14 | 2 | 14 | 9 |  |  |
| rw_expression_ideas | transitions | medium | 18 | 2 | 71 | 56 | 15 | 58 | 42 |  |  |
| rw_expression_ideas | transitions | hard | 5 | 1 | 9 | 0 | 9 | 1 | -2 | 4 |  |
| rw_standard_english | boundaries | easy | 9 | 0 | 28 | 20 | 8 | 20 | 13 |  |  |
| rw_standard_english | boundaries | medium | 23 | 0 | 61 | 41 | 20 | 41 | 20 |  |  |
| rw_standard_english | boundaries | hard | 6 | 0 | 11 | 3 | 8 | 3 | -1 | 3 |  |
| rw_standard_english | form_structure_sense | easy | 9 | 0 | 21 | 17 | 4 | 17 | 10 |  |  |
| rw_standard_english | form_structure_sense | medium | 23 | 0 | 47 | 29 | 18 | 29 | 8 |  |  |
| rw_standard_english | form_structure_sense | hard | 5 | 0 | 8 | 5 | 3 | 5 | 2 |  |  |
| algebra | linear_equations_one_var | easy | 5 | 0 | 10 | 5 | 5 | 5 | 2 |  |  |
| algebra | linear_equations_one_var | medium | 11 | 18 | 18 | 8 | 10 | 26 | 17 |  |  |
| algebra | linear_equations_one_var | hard | 4 | 6 | 6 | 1 | 5 | 7 | 5 |  |  |
| algebra | linear_functions | easy | 5 | 0 | 10 | 8 | 2 | 8 | 5 |  |  |
| algebra | linear_functions | medium | 11 | 15 | 8 | 3 | 5 | 18 | 9 |  |  |
| algebra | linear_functions | hard | 4 | 12 | 2 | 2 | 0 | 14 | 12 |  |  |
| algebra | linear_equations_two_var | easy | 5 | 0 | 16 | 13 | 3 | 13 | 10 |  |  |
| algebra | linear_equations_two_var | medium | 11 | 7 | 26 | 17 | 9 | 24 | 15 |  |  |
| algebra | linear_equations_two_var | hard | 4 | 0 | 7 | 1 | 6 | 1 | -1 | 3 |  |
| algebra | systems_linear | easy | 5 | 0 | 12 | 11 | 1 | 11 | 8 |  |  |
| algebra | systems_linear | medium | 11 | 12 | 42 | 25 | 17 | 37 | 28 |  |  |
| algebra | systems_linear | hard | 4 | 2 | 6 | 2 | 4 | 4 | 2 |  |  |
| algebra | linear_inequalities | easy | 5 | 0 | 8 | 5 | 3 | 5 | 2 |  |  |
| algebra | linear_inequalities | medium | 11 | 7 | 18 | 10 | 8 | 17 | 8 |  |  |
| algebra | linear_inequalities | hard | 3 | 6 | 2 | 1 | 1 | 7 | 6 |  |  |
| advanced_math | equivalent_expressions | easy | 7 | 0 | 11 | 8 | 3 | 8 | 3 |  |  |
| advanced_math | equivalent_expressions | medium | 17 | 8 | 39 | 25 | 14 | 33 | 18 |  |  |
| advanced_math | equivalent_expressions | hard | 5 | 8 | 18 | 2 | 16 | 10 | 7 |  |  |
| advanced_math | nonlinear_equations_systems | easy | 7 | 0 | 21 | 19 | 2 | 19 | 14 |  |  |
| advanced_math | nonlinear_equations_systems | medium | 17 | 6 | 28 | 18 | 10 | 24 | 9 |  |  |
| advanced_math | nonlinear_equations_systems | hard | 5 | 4 | 7 | 2 | 5 | 6 | 3 |  |  |
| advanced_math | nonlinear_functions | easy | 7 | 0 | 9 | 8 | 1 | 8 | 3 |  |  |
| advanced_math | nonlinear_functions | medium | 17 | 22 | 35 | 22 | 13 | 44 | 29 |  |  |
| advanced_math | nonlinear_functions | hard | 5 | 10 | 5 | 4 | 1 | 14 | 11 |  |  |
| problem_solving_data | ratios_rates_units | easy | 3 | 0 | 8 | 6 | 2 | 6 | 5 |  |  |
| problem_solving_data | ratios_rates_units | medium | 5 | 6 | 10 | 5 | 5 | 11 | 8 |  |  |
| problem_solving_data | ratios_rates_units | hard | 3 | 4 | 8 | 4 | 4 | 8 | 7 |  |  |
| problem_solving_data | percentages | easy | 3 | 0 | 5 | 5 | 0 | 5 | 4 |  |  |
| problem_solving_data | percentages | medium | 5 | 9 | 5 | 5 | 0 | 14 | 11 |  |  |
| problem_solving_data | percentages | hard | 3 | 4 | 5 | 3 | 2 | 7 | 6 |  |  |
| problem_solving_data | one_variable_data | easy | 3 | 0 | 3 | 3 | 0 | 3 | 2 |  |  |
| problem_solving_data | one_variable_data | medium | 5 | 10 | 0 | 0 | 0 | 10 | 7 |  |  |
| problem_solving_data | two_variable_data | easy | 3 | 0 | 5 | 3 | 2 | 3 | 2 |  |  |
| problem_solving_data | two_variable_data | medium | 5 | 7 | 0 | 0 | 0 | 7 | 4 |  |  |
| problem_solving_data | probability | easy | 3 | 0 | 5 | 5 | 0 | 5 | 4 |  |  |
| problem_solving_data | probability | medium | 5 | 8 | 0 | 0 | 0 | 8 | 5 |  |  |
| problem_solving_data | inference_margin_error | easy | 3 | 0 | 5 | 5 | 0 | 5 | 4 |  |  |
| problem_solving_data | inference_margin_error | medium | 5 | 7 | 1 | 1 | 0 | 8 | 5 |  |  |
| problem_solving_data | evaluating_statistical_claims | easy | 3 | 0 | 5 | 3 | 2 | 3 | 2 |  |  |
| problem_solving_data | evaluating_statistical_claims | medium | 5 | 7 | 7 | 2 | 5 | 9 | 6 |  |  |
| geometry_trig | area_volume | easy | 4 | 0 | 9 | 8 | 1 | 8 | 6 |  |  |
| geometry_trig | area_volume | medium | 7 | 22 | 0 | 0 | 0 | 22 | 17 |  |  |
| geometry_trig | area_volume | hard | 3 | 14 | 0 | 0 | 0 | 14 | 13 |  |  |
| geometry_trig | lines_angles_triangles | easy | 4 | 0 | 9 | 9 | 0 | 9 | 7 |  |  |
| geometry_trig | lines_angles_triangles | medium | 7 | 4 | 27 | 16 | 11 | 20 | 15 |  |  |
| geometry_trig | lines_angles_triangles | hard | 3 | 1 | 4 | 0 | 4 | 1 | 0 | 2 |  |
| geometry_trig | right_triangles_trigonometry | easy | 4 | 0 | 10 | 9 | 1 | 9 | 7 |  |  |
| geometry_trig | right_triangles_trigonometry | medium | 7 | 5 | 17 | 12 | 5 | 17 | 12 |  |  |
| geometry_trig | right_triangles_trigonometry | hard | 3 | 4 | 4 | 2 | 2 | 6 | 5 |  |  |
| geometry_trig | circles | easy | 3 | 0 | 8 | 6 | 2 | 6 | 5 |  |  |
| geometry_trig | circles | medium | 6 | 11 | 7 | 3 | 4 | 14 | 10 |  |  |
| geometry_trig | circles | hard | 3 | 10 | 0 | 0 | 0 | 10 | 9 |  |  |
| **sat_rw 합계** | | | 309 | 13 | 960 | 603 | 357 | 616 | 373 | 16 | 0 |
| **sat_math 합계** | | | 302 | 276 | 531 | 335 | 196 | 611 | 413 | 5 | 0 |

보관 사유 집계: {"answer_mismatch":106,"format_defect":69,"explanation_inconsistent":231,"weak_distractors":189,"factual_error":62,"ambiguous_answer":39,"empty_explanation":23,"raw_latex_in_explanation":13,"near_duplicate_of":11,"raw_latex_in_body":14,"copyright_suspect":4,"difficulty_unstable":1}

## 5. 임포트 스크립트와 로컬 시험
- `scripts/mock-exam-generation/import.ts --file final/passed.json [--publish] [--tag T]`: `create_bank_problem(p_usage_scope=mock_exam)` -> `created_via=ai_generated` -> `save_problem_draft_version` -> `set_problem_render_check` -> `set_problem_quality`(검수 결과 포함) -> 선택 공개(`confirm_and_publish_problem_version`). 유사문항 그룹은 DB 트리거가 자동 부여.
- **재실행 안전**: 같은 skill에 지문·질문이 같은 버전이 있으면 건너뜀, 기존 은행과 본문 유사도 0.6 이상이면 중복으로 건너뜀(`--no-dup-check`로 끔). 환경은 `.env.local` 대상 DB를 따르므로 원격 실행은 총괄이 환경을 지정한다.
- **로컬 시험**(태그 `full1`): 520건 전부 생성·공개 성공(실패 0), 전부 `usage_scope=mock_exam`·`confirmed`·`published`, 유사문항 그룹 520개(null 0), 재실행 시 520건 전부 건너뜀, `--cleanup-tag`로 시험 데이터 520건 삭제(잔여 0).

## 6. 결정·주의
1. **hard 미달 13칸**: 선택지는 (a) 오너 승인 하에 hard 생성·검수를 추가 라운드 진행(통과율 12%라 칸당 수십 건 필요), (b) M2 higher가 medium·hard 모두 적격이므로 해당 칸을 medium 여분(대부분 칸에서 +2~7 여유)으로 대체 — 난이도 구성만 medium 쪽으로 기운다.
2. 기존 공개 난이도 실측이 가정치다 — 실측이 다르면 칸별 미달이 달라지므로 위 JSON으로 재집계 필요.
3. 해설의 `$...$`(KaTeX)는 모든 화면이 LearningText로 렌더하므로 결함으로 보지 않았다. 2026-09-29 분류 때 같은 형태 10건을 일관성으로 보관한 전례가 있어, 엄격 적용을 원하면 해설 `$` 포함 문항(Math 대부분)을 추가 보관해야 한다(이 경우 Math 통과 수가 크게 줄어 재생성이 필요).
4. 오답 제거 용이성·난이도 라벨은 AI 판정이라 임계값에 민감하다(`--weak easy=4,medium=3,hard=2`). 더 엄격히 하면 통과 수가 줄어든다.
5. 저작권 의심은 모델 자기 지식 기준의 1차 점검이며 법적 확인이 아니다.

## 7. 외부 변경
Anthropic API 호출(유료): 생성 파이프라인 367회 실행(후보당 내부 재생성·자료 생성·채점 호출 포함)과 검수 2회 x 약 1,400건. 그 외 원격 DB·Supabase 원격·배포·푸시 없음, 로컬 DB는 시험 임포트 후 정리 완료.
