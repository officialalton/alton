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
| 레시피 있는 skill, 텍스트 전용(RW 50·Math 6 = 56) | 56 | 약 263 | 약 $8.9 |
| 자료 필요 skill(`command_of_evidence_quant`·`lines_angles_triangles`, 동기 파이프라인, x1.5) | 8 | 약 56 | 약 $1.9 |
| 레시피 신규 skill(`cross_text_connections` 6·`systems_linear` 4) + 선행 레시피 작성·시험 | 10 | 약 47 + 합성 | 약 $1.6 + $1.3(시험) |
| **합계** | **72 + 시험 10** | **약 370** | **약 $13.7 (점추정)** |
- 비용 절감 선택지: Opus 참고 의견을 생략하면 후보당 $0.033 절감(약 $2.4)이지만 `advisory` 기록이 사라진다(오너 지시상 유지 권장). Fable 검수를 정답 검수 통과분에만 적용하는 2단계 필터(Opus 블라인드 풀이로 정답 불일치 조기 제거)는 후보당 Fable 호출을 줄일 수 있으나 구현·검증이 더 필요하다.

## 5. 실행 상한 제안
- 새 예산 구간 ledger 로 분리(`batch3/`), 실행 전 추정 출력, 동기 호출 동시 6개 이하(Fable Start tier 500k ITPM·Opus 2M ITPM 안).
- **상한 US$16**(점추정 $13.7 + 약 15% 여유, 수율이 표본보다 낮으면 자동 중단). 단계별 상한: ① 선행 레시피 시험 $2.5 ② 텍스트 전용 56건 $10.0 ③ 자료 필요 skill 8건 $3.5(별도 승인). 단계마다 채택 수율이 25% 미만이거나 누적이 단계 상한의 90%에 이르면 **즉시 중단·보고**.
- 대량 전 확인 요청 사항: (a) plan.json 에 원격 hard 중 AI 생성분 구분 필드, (b) 정답 기준 '둘 다 통과' 기본값 승인, (c) 채택 hard 임포트 시 난이도 상태 '잠정(AI 판정)' 저장 방식(품질 JSON 의 `mockExamGeneration.difficultyStatus` = `provisional_ai` 로 기록해 두었으니 다른 세션 구현이 읽을 필드명 합의).
- 임포트는 이 계획에 포함하지 않는다(원격 임포트는 총괄). 실행 승인은 총괄이 오너에게 받는다.
