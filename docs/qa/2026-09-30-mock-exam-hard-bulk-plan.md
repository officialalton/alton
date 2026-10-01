# 2026-09-30 hard 대량 생성 계획(실행 전 — 승인 대기, 이 문서 작성 중 생성·원격 접근·임포트 없음)

## 0. 확정 기준(총괄·오너)
- hard 생성 **Opus 5.5**(동기), 일반 문항(easy/medium) **Sonnet 5.5** 유지.
- **hard 인정 = Fable 5.1 hard 적합 검수 통과 + 정답 정확성 + 레시피 준수 통과.** Opus 5.5 의 hard 적합 의견은 채택 조건이 아니라 `advisory`(통과/탈락·사유·추가 요구 사고 메모)로 기록만 한다. 교정 시험(공식 난이도 대조)은 약관상 중단 유지.
- 채택 hard 는 난이도 상태 **'잠정(AI 판정)'**(`difficultyStatus: provisional_ai`)으로 임포트되고, 문항 품질 JSON 에 `hardJudge`(모델·effort·결과·추가 요구 사고 메모)와 `advisory`(Opus 의견)가 남는다. 관리자 점검·변경 기능은 다른 세션이 구현 중.
- 구현(이번에 완료, 대량 실행 아님): `batch-pipeline.ts cross`/`cross-report` 가 위 규칙으로 `adopted-hard.json`(Raw 호환 형식 + `quality.hardJudge/advisory` + `difficultyStatus`)을 만든다. `import.ts` 는 `quality` 를 그대로 `set_problem_quality` 로 저장하고 `mockExamGeneration.difficultyStatus` 를 함께 기록한다(로컬 임포트 시험은 하지 않았다 — 이번 표본 25건은 임포트 대기).
- 정답 정확성은 기본적으로 **Fable·Opus 둘 다 통과**를 요구한다(한쪽만 잡은 실제 결함 — 해설 자기 모순·밑줄 형식 불일치 — 이 있었다). Fable 만 요구하는 변형은 `--correct-fable-only`. **결정 요청**: 기본값을 '둘 다'로 둘지.

## 1. 채택 수율 재계산(Opus 생성 36건 표본 = `batch2/D-cross`, 정답·레시피 포함)
| 체계 | 후보 | Fable hard 적합 통과(검수된 것 중) | **채택**(Fable hard 적합 ∧ 정답(둘 다) ∧ 레시피) | 채택 수율 | (참고) 정답은 Fable 만 요구 시 |
|---|---|---|---|---|---|
| RW | 24 | 20/21 (95%) | **16** | **67%** | 17 (71%) |
| Math | 12 | 10/12 (83%) | **9** | **75%** | 10 (83%) |
계획에는 표본이 작으므로 안전계수 **0.85**를 곱한 수율(RW 0.57, Math 0.64)을 쓴다. 이번 표본 채택 25건(RW 16, Math 9)은 로컬에 있고 **원격 임포트 전**이라 아래 부족 수량에서 차감했다(skill별: command_of_evidence_text 5, text_structure_purpose 5, boundaries 5, transitions 1, linear_equations_two_var 2, 그 외 채택 7건은 부족이 없는 skill).

## 2. hard 미충족 칸별 필요 수량(3세트분 + 칸별 여분 2, 기준 `data/mock-exam-generation/plan.json`)
"원격 hard"는 plan.json `supply`. **plan.json 에는 원격 hard 중 AI 생성분 표기가 없어**(필드 없음) 전부 충족 수량에 포함했고, 그중 AI 생성분은 '잠정'이므로 총괄이 구분 필드를 주면 해당 분을 '잠정 충족'으로 따로 표기한다(표의 '원격 hard'는 상한 추정).

| 체계 | skill | 3세트분 | +여분 2 | 원격 hard | 부족 | 이미 채택(로컬 표본) | **남은 부족** | 레시피 | 후보 수(수율 반영) |
|---|---|---|---|---|---|---|---|---|---|
| RW | central_ideas_details | 2 | 4 | 0 | 4 | 0 | **4** | 있음 | 8 |
| RW | inferences | 2 | 4 | 1 | 3 | 0 | **3** | 있음 | 6 |
| RW | command_of_evidence_text | 2 | 4 | 0 | 4 | 5 | 0 | 있음 | 0 |
| RW | command_of_evidence_quant | 1 | 3 | 1 | 2 | 0 | **2** | 있음(자료 필요) | 4 |
| RW | words_in_context | 3 | 5 | 0 | 5 | 0 | **5** | 있음 | 9 |
| RW | text_structure_purpose | 3 | 5 | 2 | 3 | 5 | 0 | 있음 | 0 |
| RW | **cross_text_connections** | 2 | 4 | 1 | 3 | 0 | **3** | **없음** | 6 |
| RW | rhetorical_synthesis | 3 | 5 | 1 | 4 | 0 | **4** | 있음 | 8 |
| RW | transitions | 3 | 5 | 1 | 4 | 1 | **3** | 있음 | 6 |
| RW | boundaries | 4 | 6 | 0 | 6 | 5 | **1** | 있음 | 2 |
| RW | form_structure_sense | 3 | 5 | 0 | 5 | 0 | **5** | 있음 | 9 |
| Math | linear_equations_two_var | 2 | 4 | 0 | 4 | 2 | **2** | 있음 | 4 |
| Math | **systems_linear** | 2 | 4 | 2 | 2 | 0 | **2** | **없음** | 4 |
| Math | nonlinear_equations_systems | 3 | 5 | 4 | 1 | 0 | **1** | 있음(v1만) | 2 |
| Math | lines_angles_triangles | 1 | 3 | 1 | 2 | 0 | **2** | 있음(**도형 자료 필요**) | 4 |
- 그 외 hard 칸(linear_equations_one_var, linear_functions, linear_inequalities, equivalent_expressions, nonlinear_functions, ratios_rates_units, percentages, area_volume, right_triangles_trigonometry, circles)은 원격 hard 로 이미 충족(AI 생성분이면 잠정).
- 합계: 남은 부족 RW 30(레시피 있음 27 + 없음 3), Math 7(있음 5 + 없음 2); **후보 수 합계 72**(RW 58, Math 14).
- **자료(그림) 필요 skill**(`command_of_evidence_quant` 표·그래프, `lines_angles_triangles` 도형): 현재 배치 파이프라인(`batch-pipeline.ts`)은 텍스트 전용이라 이 두 skill(후보 8)은 자료 생성 단계가 있는 기존 동기 파이프라인(`runGenerationPipeline`, 모델은 환경변수 `GENERATION_MODEL=claude-opus-5-5`)으로 돌려야 하며 호출 수·비용이 더 든다(문항당 자료 생성 호출 추가, 추정 x1.5).

## 3. 레시피 없는 skill의 레시피 마련(대량 전 선행, 소량)
- **cross_text_connections**(필요 후보 6): 7개 실전 시험에서 해당 문항이 7개뿐이라 특성 합성 임계값(8)에 못 미쳤다. 방법: (1) 임계값을 낮춰 7개 프로파일로 상·하위 3개 대조(`cb-synth.ts`, 호출 1~2회, 약 $0.05), (2) 기존 문제은행 cross-text hard 특성(Text 1·2 관계: 전면 반박이 아닌 범위 한정·근거 일반화 문제 제기 등)을 반영해 레시피 2~3개 초안 작성(`cb-recipes.ts`), (3) 6건 소량 시험(Opus 생성 + Fable 검수 + Opus 참고, 약 $1)로 채택 수율 ≥ 25% 확인 후 대량에 편입. 원문 복제 없이 특성·패턴 이름만 기록.
- **systems_linear**(필요 후보 4): 커버리지 맵에 해당 skill 라벨 문항이 없다(연립방정식 문항이 `linear_two_variables` 로 분류됨). 방법: 맵에서 `linear_two_variables` 문항 중 연립·해의 개수형을 골라 특성을 별도 합성하거나(`cb-extract` 프로파일 재사용), 인접 skill(`linear_equations_two_var` v2) 레시피를 '해가 없음/무수히 많음 조건 + 계수 결정 + 재대입' 구조로 변형해 초안 작성 후 4건 시험. 수율이 기준 미달이면 이 skill 은 medium 대체로 두고 별도 보고(이전 합의).
- nonlinear_equations_systems 는 v1 레시피만 있어(Math 구조 골격 v2 없음) 포함하되 첫 6건을 시험 표본으로 돌려 수율 확인.

## 4. 호출 수·비용 추정(동기 단가, 배치 대기 불가)
이번 36건 실측(`batch2/ledger.json`): Opus 생성 $0.0336/후보, Fable 검수(블라인드 + 감사 2요청) $0.104/후보, Opus 참고 의견(2요청) $0.033/후보, 결정론 통과율 92%. 후보당 합계 **$0.159**, **후보당 호출 4.7회**(생성 1 + 검수 4 x 0.92).
| 구분 | 후보 | 호출 수 | 추정 비용 |
|---|---|---|---|
| 레시피 있는 skill, 텍스트 전용(RW 48·Math 6 = 54) | 54 | 약 254 | 약 $8.6 |
| 자료 필요 skill(`command_of_evidence_quant`·`lines_angles_triangles`, 동기 파이프라인, x1.5) | 8 | 약 56 | 약 $1.9 |
| 레시피 신규 skill(`cross_text_connections` 6·`systems_linear` 4) + 선행 레시피 작성·시험 | 10 | 약 47 + 합성 | 약 $1.6 + $1.3(시험) |
| **합계** | **72 + 시험 10** | **약 360** | **약 $13.4 (점추정)** |
- 비용 절감 선택지: Opus 참고 의견을 생략하면 후보당 $0.033 절감(약 $2.4)이지만 `advisory` 기록이 사라진다(오너 지시상 유지 권장). Fable 검수를 정답 검수 통과분에만 적용하는 2단계 필터(Opus 블라인드 풀이로 정답 불일치 조기 제거)는 후보당 Fable 호출을 줄일 수 있으나 구현·검증이 더 필요하다.

## 5. 실행 상한 제안
- 새 예산 구간 ledger 로 분리(`batch3/`), 실행 전 추정 출력, 동기 호출 동시 6개 이하(Fable Start tier 500k ITPM·Opus 2M ITPM 안).
- **상한 US$16**(점추정 $13.4 + 약 15% 여유, 수율이 표본보다 낮으면 자동 중단). 단계별 상한: ① 선행 레시피 시험 $2.5 ② 텍스트 전용 54건 $10.0 ③ 자료 필요 skill 8건 $3.5(별도 승인). 단계마다 채택 수율이 25% 미만이거나 누적이 단계 상한의 90%에 이르면 **즉시 중단·보고**.
- 대량 전 확인 요청 사항: (a) plan.json 에 원격 hard 중 AI 생성분 구분 필드, (b) 정답 기준 '둘 다 통과' 기본값 승인, (c) 채택 hard 임포트 시 난이도 상태 '잠정(AI 판정)' 저장 방식(품질 JSON 의 `mockExamGeneration.difficultyStatus` = `provisional_ai` 로 기록해 두었으니 다른 세션 구현이 읽을 필드명 합의).
- 임포트는 이 계획에 포함하지 않는다(원격 임포트는 총괄). 실행 승인은 총괄이 오너에게 받는다.


## 8. 선행 레시피 시험 결과(2026-09-30, ① 단계만 실행 — ②③ 대량 생성·원격 접근·임포트 없음)
구간 지출 **$1.57**(`batch3/ledger.json`, 상한 $2.5, 모두 동기 단가) + 레시피 마련용 합성·생성 호출 약 $0.1(장부 외 소액 추정 기록) = 약 **$1.67**. 모델: 생성 Opus 5.5, hard 적합 검수 Fable 5.1(effort low), 참고 의견 Opus 5.5(effort low), 정답 정확성은 Fable·Opus 둘 다 통과 필수.

### 레시피 마련
- **cross_text_connections**: 실전 시험 문항이 7개뿐이라 `cb-synth.ts --only cross_text_connections --min-n 7`(상·하위 각 2개 대조)로 특성 4개를 얻고(근거 문항 test10-RW-M1-Q10, test11-RW-M1-Q9), `cb-recipes.ts --only`로 레시피 3개(`..._unstated_rebuttal`, `..._weak_point_target`, `perspective_bound_evaluation_author_criterion`)를 만들었다. **근거가 문항 2개 수준으로 얇다**(표본 7, 대조 그룹 2) — 레시피 타당성은 이 표본으로 확인된 것이 아니므로 출시 후 재검토 대상.
- **systems_linear**: 커버리지 맵에 해당 라벨 문항이 없어 CB 대조 근거 없음(`evidence` 비어 있음). `linear_equations_two_var` v2 구조를 변형해 레시피 2개(`systems_linear_condition_param_then_solve`, `systems_linear_word_two_constraints_one_hidden`)를 직접 설계해 `recipes-v2.json`에 넣었다(난이도 출처에 '내부 설계, CB 근거 없음' 명시).
- 기존 `recipes.json`·`archetypes.json`은 보존(recipes.json 에 cross_text_connections 항목만 추가).

### 시험 결과(후보 전체 분모)
| skill | 후보 | 생성 실패 | 결정론 통과 | Fable hard 적합 | 정답(둘 다) | 레시피 준수 | **채택** | 수율 | 비용 | 채택 1건당 |
|---|---|---|---|---|---|---|---|---|---|---|
| cross_text_connections | 6 | 0 | 6 | 6/6 | 6/6 | 6/6 | **6** | **100%** | $0.99 | $0.165 |
| systems_linear | 4 | 0 | 4 | 4/4 | 4/4 | 4/4 | **4** | **100%** | $0.58 | $0.145 |
- 탈락 원인: 없음(10건 전부 채택). **수율 기준(25%) 충족** — 둘 다 medium 대체 없이 hard 공급 가능으로 판단. 단 표본이 작고(6·4건) 레시피 근거가 얇아(cross_text: 문항 2개, systems_linear: 근거 없음) **수율이 과대 추정일 수 있다**.
- Opus 참고 의견(advisory): cross_text 6건 중 2건(00·01)은 hard 적합 '불합'(참고 기록만, 채택엔 영향 없음), systems_linear 4건은 Opus 도 hard 적합. 이번 Math 4건은 Math 재계산 결과 4건 통과·0건 생략, 정답 오류 없음. 이전 표본에서 Opus 는 Math hard 적합에 매우 엄격했으나(1/12) `systems_linear` 는 4/4 통과 — 레시피 구조(해의 개수 조건 → 계수 결정 → 재풀이)가 '추가 사고'로 인정받은 것으로 보이며 skill별 편차가 크다.
- 채택분 10건은 `batch3/pilot/adopted-hard.json`(`hardJudge`·`advisory`·`difficultyStatus=provisional_ai`·`recipeId` 포함, 원격 임포트 전)에 있다. 유사도(후보 간·기존 은행 대비)는 이 단계에서 점검하지 않았다(임포트 스크립트가 본문 유사도 0.6 기준으로 제외).

### ② 실행 전 재추정(선행 시험 반영)
- 선행 채택 10건으로 `cross_text_connections`(부족 3)·`systems_linear`(부족 2)는 충족 → 대량 대상에서 제외. **남은 부족: RW 27 + Math 5 = 32**(RW central 4·inferences 3·command_of_evidence_quant 2·words_in_context 5·rhetorical_synthesis 4·transitions 3·boundaries 1·form_structure_sense 5 = 27, Math linear_equations_two_var 2·nonlinear_equations_systems 1·lines_angles_triangles 2 = 5).
- 후보 수(안전계수 0.85 수율): 텍스트 전용 54건(RW 48 + Math 6), 자료 필요 8건(`command_of_evidence_quant` 4 + `lines_angles_triangles` 4). 합계 **62건**(이전 72건에서 선행 시험분 10건 감소).
- 비용(후보당 $0.157 실측): 텍스트 전용 54건 약 $8.5, 자료 필요 8건(x1.5) 약 $1.9 → **약 $10.4**, 호출 약 290회. 단계 체크포인트에서 수율이 25% 미만이면 중단.
- **실행 상한 재제안 US$12.5**(점추정 $10.4 + 약 20%; 앞선 제안 $16 에서 축소). 단계: ② 텍스트 전용 54건 상한 $9.5, ③ 자료 필요 8건 상한 $3.0(별도 승인).


## 9. 단계 ② 텍스트 전용 hard 생성 결과(2026-09-30)
생성 Opus 5.5(동기), hard 인정 = Fable 5.1 hard 적합 + 정답 정확성(Fable·Opus 둘 다) + 레시피 준수, Opus hard 의견은 `advisory` 기록만, 채택분 `difficultyStatus=provisional_ai`. 로컬 DB·원격 접근 없음(API 호출·파일 산출물만), 동시 호출 6. 단계 ② 소계 **$7.18**(`batch3/ledger.json` 누적 $8.85 중 기존 ①·레시피 마련 $1.67 제외, 상한 $9.5의 76%, 90% 도달 안 함).
- **체크포인트**: 후보 28건(전반) 처리 후 채택 19건(68%) ≥ 25% → 계속. 후반은 전반 채택분을 반영해 남은 부족이 있는 skill만(18건, 채택 비율 낮은 skill는 더 많이) — 후보 수는 계획 54건에서 **46건으로 줄었다**(= 28 + 18, 이미 충족된 skill 생성을 생략해 비용 절약). 후반 6건 채택(33%).
- 후보 전체 분모, 단계 ② 합계 **후보 46 → 채택 25 (54%)**, 비용 $7.18(생성 + Fable 검수 + Opus 참고 의견), 채택 1건당 **$0.29**.

### skill별(전반 + 후반)
| skill | 후보 | 채택 | 수율 | 비용 | 채택 1건당 | 탈락 원인(중복 계상) |
|---|---|---|---|---|---|---|
| central_ideas_details | 6 | 4 | 67% | $0.88 | $0.22 | {'정답 정확성(Opus)': 1, '생성 결정론(evidence)': 1} |
| inferences | 7 | 1 | 14% | $1.04 | $1.04 | {'정답 정확성(Opus)': 3, '생성 결정론(evidence)': 1, 'hard 적합(Fable)': 2, '생성 결정론(rw_table)': 1, '정답 정확성(Fable)': 1} |
| words_in_context | 11 | 5 | 45% | $1.79 | $0.36 | {'hard 적합(Fable)': 6, '정답 정확성(Opus)': 1} |
| rhetorical_synthesis | 6 | 4 | 67% | $0.83 | $0.21 | {'hard 적합(Fable)': 1, '생성 결정론(evidence)': 1} |
| transitions | 5 | 3 | 60% | $0.85 | $0.28 | {'정답 정확성(Opus)': 1, 'hard 적합(Fable)': 2, '레시피 미준수': 1} |
| boundaries | 1 | 1 | 100% | $0.16 | $0.16 | {} |
| form_structure_sense | 7 | 4 | 57% | $1.20 | $0.30 | {'정답 정확성(Opus)': 3, '정답 정확성(Fable)': 1} |
| linear_equations_two_var | 2 | 2 | 100% | $0.30 | $0.15 | {} |
| nonlinear_equations_systems | 1 | 1 | 100% | $0.14 | $0.14 | {} |

- 탈락 원인 요약: 정답 정확성에서 Opus 가 Fable 보다 더 자주 탈락시켰고(선택지·해설의 세부 불일치), hard 적합은 words_in_context 가 가장 많이 탈락(6건), inferences 는 정답·hard·형식(표 사용·evidence) 이 섞여 수율이 가장 낮았다(1/7 = 14%, 25% 미만).
- **inferences**: 25% 미만이지만 원격 hard 1 + 채택 1 로 3세트분(2)은 이미 충족이고 부족은 여분 2 뿐이라 **더 돌리지 않고 여분만 medium 대체 없이 '여분 미달'로 보고**한다(사고 수준·기준 완화 없음, 생성 지시 단순화 시도는 하지 않음 — 표본이 작아 원인을 단정하지 못함).

### 채택분 병합(`merge-adopted.ts` → `final/adopted-hard-all.json`)
입력 60건(① D-cross 25 + 선행 10 + 단계 ② 25) → **59건 유지**, 제외 1건(본문 유사도 0.90, `linear_equations_two_var` 단계 ② 전반 00번이 ① 25건 중 같은 번호와 동일 구조). 같은 skill 안 본문 3-gram(숫자 마스킹) 유사도 0.6 이상 검사를 adopted 간·기존 통과 문항(`final/passed.json`) 대비 모두 했고 기존 문항과의 유사 제외는 없었다. skill별 채택(중복 제거 후): transitions 4, boundaries 6, command_of_evidence_text 5, text_structure_purpose 5, linear_equations_one_var 3, linear_equations_two_var 3, equivalent_expressions 4, cross_text_connections 6, systems_linear 4, central_ideas_details 4, inferences 1, words_in_context 5, rhetorical_synthesis 4, form_structure_sense 4, nonlinear_equations_systems 1.
**주의**: 모든 채택분 gid 는 출처별 접두어(`batch2-D-cross:`, `batch3-pilot:`, `batch3-stage2a:`, `batch3-stage2b:`)가 붙는다. `adopted-hard-all.json` 은 임포트 스크립트(`import.ts`)에 그대로 넣을 수 있는 형식(`quality.hardJudge/advisory`, `difficultyStatus`, `recipeId` 포함)이며 원격 임포트는 총괄이 한다.

### 남은 hard 부족(3세트분 + 칸별 여분 2, `plan.json` 원격 hard + 신규 채택 59건 반영)
**3세트분은 전 skill 충족.** 여분(+2) 기준 부족은 8건:
| 체계 | skill | 3세트분 | +여분 2 | 원격 | 신규 채택 | 여분 포함 부족 | 비고 |
|---|---|---|---|---|---|---|---|
| RW | inferences | 2 | 4 | 1 | 1 | 2 | 수율 14% — 추가 시도 보류 |
| RW | command_of_evidence_quant | 1 | 3 | 1 | 0 | 2 | 자료(표·그래프) 필요 — ③ 대상 |
| RW | form_structure_sense | 3 | 5 | 0 | 4 | 1 | 텍스트 전용 |
| Math | linear_equations_two_var | 2 | 4 | 0 | 3 | 1 | 텍스트 전용 |
| Math | lines_angles_triangles | 1 | 3 | 1 | 0 | 2 | 도형 자료 필요 — ③ 대상 |
(원격 hard 중 AI 생성분 구분 필드는 여전히 plan.json 에 없어 전부 충족 수량에 포함.) 텍스트 전용으로 더 채울 수 있는 것은 inferences 2·form_structure_sense 1·linear_equations_two_var 1(모두 여분분)뿐이며, 자료 필요 4건은 ③ 별도 승인 대상이다.
