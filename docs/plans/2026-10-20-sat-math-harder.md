# SAT 공개 30세트 수학 난이도 상향 계획 (2026-10-20)

오너 요청: 공개 SAT 30세트의 수학을 조금 더 어렵게. 원격은 읽기 SELECT 만 했고 쓰기·공개는 하지 않았다. 적용 SQL은 총괄이 실행한다. 로컬 격리 스택(project_id ALTON_mathharder, 포트 오프셋 +300)에서 41~45·99번을 전부 리허설했고, 스택은 종료하고 config.toml은 원복했다.

## 1. 현재 분포 (공개 30세트 합산, 세트당 Math 66문항)
| 모듈 | easy | medium | hard |
|---|---|---|---|
| 수학 1 | 240 | 420 | 0 |
| 수학 2 쉬운 경로 | 240 | 420 | 0 |
| 수학 2 어려운 경로 | 0 | 420 | 240 |

세트당 모듈은 22문항(수학 1: easy 8·medium 14, 수학 2 어려운 경로: medium 14·hard 8).

## 2. 목표·적용 분포
| 모듈 | easy | medium | hard | 변화 |
|---|---|---|---|---|
| 수학 1 | 150 | 510 | 0 | easy 90 -> medium (세트당 3, easy 8 -> 5) |
| 수학 2 쉬운 경로 | 240 | 420 | 0 | 변경 없음 |
| 수학 2 어려운 경로 | 0 | 330 | 330 | medium 90 -> hard (세트당 3, hard 8 -> 11 = 모듈의 50%) |

- 교체 180칸은 전부 기존 은행의 공개(published) 문항 160건과 신규 생성 hard 20건으로 채웠다. 세트마다 6칸, 30세트 모두 대상.
- hard 재고 계산: 미사용 확정 hard 412건(mc 385·spr 27) 중 외부 오류 신고(1018) 결함 규칙·π 혼재 보기에 걸린 문항을 뺀 재고를 썼다. 스킬별 재고가 없는 equivalent_expressions·linear_equations_one_var·systems_linear 등은 신규 생성으로 채웠다.
- 스킬·도메인·mc/spr 형식은 같은 칸 안에서만 바꾸므로 분포가 그대로다(칸 단위 교체). 문항 수 147·모듈 구성 불변.
- 세트 안 유사문항 그룹 중복 0, 세트 쌍 공유 그룹은 max(15, 현재값) 이하(현재 일부 쌍이 이미 17이어서 그 이상 늘리지 않음), 교체 문항은 어떤 다른 보관되지 않은 세트에도 쓰이지 않은 문항, 교체 후 모듈 안 순서는 공식 순서 규칙(lib/mock-exam/official-order.ts)으로 position 재배치.
- 교체 후보의 난이도 '문항 난이도'는 DB의 문항 난이도 값 그대로다. hard 후보 대부분이 `provisional_ai`(원형 근거 잠정 난이도)다. 응시 기반 보정은 정책(2026-10-15)대로 공개 후 실제 응시 데이터로 한다.

## 3. 수학 1·쉬운 경로에 hard를 넣을 수 있는가 (오너 추가 지시 검토) — 충돌, 도입하지 않음
`mock_exam_set_items`의 생성 열이 경로별 허용 난이도를 고정한다(마이그레이션 `20261901000002_mock_exam_mst_phase2.sql`).
- `m1_eligible` = difficulty in (easy, medium) — 수학 1에는 hard 불가
- `m2_lower_eligible` = difficulty in (easy, medium) — 쉬운 경로 수학 2에는 hard 불가
- `m2_higher_eligible` = difficulty in (medium, hard)

세트 검증 함수(`mock_exam_validate_mst_set`, 20261918000001)가 이 열로 `eligibilityViolations`를 만들어 위반이면 세트를 ready 로 못 만든다. 따라서 hard를 수학 1·쉬운 경로 모듈에 넣으면 세트 새 버전 검증이 막힌다(SQL 이 그 세트를 건너뛴다).

그대로 두는 것을 권장하는 이유: 경로 의미(쉬운 경로는 상한이 낮고 어려운 경로에서만 800 도달)와 점수 모델(`lib/mock-exam/score-estimate.ts`)이 경로를 기준으로 하고, 라우팅 임계값(수학 M1 정답률 70% 이상 -> higher, `mock_exam_routing_policies` v2)이 M1에 hard가 없다는 전제로 정해졌다.
대안(적용함): 수학 1은 easy 일부를 medium 으로 올려 전체 체감 난이도를 높였다. 쉬운 경로는 의도적으로 건드리지 않았다(쉬운 경로를 더 올리면 어려운 경로와 격차가 줄고 낮은 점수대 응시자에게 부담이 커진다).
오너가 그래도 M1·쉬운 경로에 hard를 원하면 필요한 일: (a) 생성 열 두 개를 hard 허용으로 바꾸는 마이그레이션(생성 열이라 drop/add 필요, 세트 문항 재생성), (b) 검증 함수 eligibility 규칙 수정, (c) 라우팅 임계값·점수 앵커 재보정. 정책 변경이므로 오너 결정 사항으로 남긴다.
참고: M1 이 조금 어려워지면 70% 임계값을 넘는 응시자 비율이 약간 줄 수 있다(M1 에서 easy 3문항이 medium 이 됨). 임계값은 오너 관리 값이라 바꾸지 않았다.

## 4. 대상 세트
SAT Practice Test 1~30 전체(30세트). 세트당 수학 6칸 교체(어려운 경로 medium 3 -> hard, 수학 1 easy 3 -> medium). 세트별 칸 목록: `data/mock-exam-generation/sat-math-harder-20261020/final/old-set-specs.json`, 요약: `plan-report.json`.
스킬별 교체 수(합계): nonlinear_functions hard 15 / M1 17, nonlinear_equations_systems 15 / 17, linear_inequalities 7 / 9, systems_linear 7 / 7, linear_equations_two_var 7 / 6, linear_functions 7 / 8, linear_equations_one_var 5 / 4, area_volume 5 / 4, lines_angles_triangles 3 / 4, circles 3 / 1, one_variable_data 4 / 2, ratios_rates_units 2 / 0, percentages 2 / 2, probability 2 / 1, two_variable_data 2 / 2, right_triangles_trigonometry 2 / 3, inference_margin_error 2 / 1, equivalent_expressions 0 / 2.

## 5. 신규 hard 문항 생성
- 방법: 기존 결정론 원형 컴파일러(`scripts/mock-exam-generation/gap-bulk.ts --cells`, 독립 정답 재계산·선택지 중복·표기·SPR 쿼터 검증). AI 호출 없음.
- 칸: equivalent_expressions 20, linear_equations_one_var 24, systems_linear 24, nonlinear_equations_systems 20, linear_equations_two_var 12 = 100건 시도(시드 810000~).
- 정리(`scripts/prod-open/sat-math-harder-clean.ts`): 은행과 정확히 같은 문항 0, 다른 원형과 3-gram 0.6 이상 근접 0, 오류 신고 9건 수정 규칙(그래프+식 이중 제시 G1~G7, 눈금 라벨 R2 등)·π 보기 혼재·그래프+식 같은 곡선 이중 제시 0, 한글이 섞이거나 영어 해설이 없는 7건 제외 -> **93건**(mc 68·spr 25).
- 임포트 게이트(`buildImport`: 잔재·답 키·자료 필수·렌더 검사) 93건 전부 통과, 로컬 임포트 created=93 전부 confirmed.
- **세트에 실제로 쓰인 신규 hard: 20건**. 나머지 73건은 은행에 예비로 남는다(다음 세트 확충·수정용).
- 비용: **$0**(유료 호출 없음). 예산 $40·중단선 $640 모두 미사용.

## 6. 파일·실행 순서
SQL 생성: `SAT_MATH_HARDER=1 npx tsx scripts/prod-open/sat-expand-sql.ts` (입력은 파일뿐). 출력 `data/prod-open/sat-expand-sql/`:
1. `41_preflight_math_harder.sql` 읽기: 대상 세트의 기존 초안·응시 수·현재 수학 hard 수.
2. `42_import_math_hard.sql` 신규 hard 93건 임포트+공개(멱등).
3. `43_keywords_math_hard.sql` 스킬 키워드 연결(멱등).
4. `44_set_versions_math_harder.sql` 30세트의 새 초안 버전(교체 칸 검증: 스킬·난이도·형식 일치, 다른 세트와 중복 없음, 세트 검증 함수 통과 못하면 그 세트만 건너뜀, 공개 없음).
5. `45_verify_math_harder.sql` 읽기 검증.
6. 롤백 `99_rollback_math_harder.sql`: 이 작업이 만든 초안 세트 버전 삭제(응시 없는 초안만)·미사용 신규 hard 보관 처리.

세트 새 버전의 공개는 총괄 판단이다. 응시 이력이 있는 세트는 기존 버전이 그대로 보존되고(진행 중 응시는 옛 버전으로 완료, 재응시는 새 버전 'Updated version' 배지 규칙).

## 7. 검증
- 로컬 리허설(원격 읽기 복사): 42 created=93, 43 링크 93, 44 초안 30개 전부 생성·`ready`(147문항, 문항 이슈 0), 45 확인: 세트마다 어려운 경로 hard 11·수학 1 easy 5·수학 1/쉬운 경로 hard 0·다른 시험과 공유 문항 0, 재실행 시 "초안 이미 있음" 건너뜀(멱등), 99 롤백으로 초안 30개 제거·신규 hard 93 보관.
- 단위 테스트: official-order·new-version·assemble·routing·assemble-unique 5파일 63건 통과.

## 8. 주의·한계
- **다른 초안과의 순서**: 같은 세트에 이미 초안(예: 27 공식 순서, 34 정량 근거, 24~26 보정)이 있으면 44가 그 세트를 건너뛴다. 그 초안을 먼저 공개(또는 폐기)한 뒤 44를 재실행한다. 44는 교체 칸을 옛 problem_id 로 찾으므로 위치가 바뀐 뒤에도 동작하고, 수학 모듈은 공식 순서로 다시 배치한다. 수학 문항 버전이 패치(E1019 등)로 바뀐 세트도 그대로 동작한다.
- hard 난이도는 `provisional_ai` 가 대부분이다(생성 원형 근거). 화면(그래프 의미)·문장 자연스러움은 사람이 검토하지 않았다. 브라우저 화면 확인은 하지 않았다.
- 수학 쉬운 경로는 변경하지 않았다(3절).

---

# 개정 (2026-10-20 오너 정정·최종 구성) — 위 1~8절은 직전 작업(어려운 경로 hard 8->11, 수학 1 easy->medium)의 기록이며 **폐기·대체**된다

## A. 오너 최종 구성(세트당, 22문항 모듈)
| 모듈 | easy | medium | hard | 현재 공개본 -> 변화 |
|---|---|---|---|---|
| 수학 1 | 3 | 14 | **5** | easy 8 -> 3 (easy 5개 -> hard) |
| 수학 2 쉬운 경로 | 3 | 14 | **5** | easy 8 -> 3 (easy 5개 -> hard) |
| 수학 2 어려운 경로 | 0 | 11 | **11** | medium 14 -> 11 (3개 -> hard) |
30세트 합산: 수학 1 hard 150, 쉬운 경로 hard 150, 어려운 경로 hard 330(현재 240 + 90). 필요한 서로 다른 hard 총 **630**(현재 공개본이 이미 쓰는 240 + 신규 배치 390). 직전 초안(44번, 어려운 경로 hard 330)이 이미 쓰는 분량 대비 추가분 = **300**(수학 1 150 + 쉬운 경로 150); 어려운 경로의 +90은 44 초안과 같은 규모라 재배치하되 동일 수량.

## B. 재고 계산과 신규 생성
- 은행 미사용 확정 수학 hard: 505건(= 사용 중 제외 415 + 폐기될 44 초안이 잡고 있던 90). 필터(오류신고 1018 규칙·π 혼재 15건 제외, **신규 서두·문법 규칙 31건 제외**) 후 사용 가능 459건. 칸(스킬·도메인·형식)별로 수학 1·쉬운 경로 easy 칸을 hard 로 바꾸면 nonlinear_functions·nonlinear_equations_systems·equivalent_expressions 등 칸이 부족했다.
- 부족분 신규 생성: 결정론 컴파일러(`gap-bulk.ts --cells`, 시드 820000~, AI 호출 0, **비용 $0**; 예산 $40 미사용): nonlinear_equations_systems 110, nonlinear_functions 70, equivalent_expressions 30, linear_functions 25, linear_inequalities 25 = 260건 시도 -> 정리 후 **240건**(mc 168·spr 72). 탈락: 근접 중복 9, 한글/영어 해설 없음 10, 메타 지시 서두 1.
- 배치 결과: 390칸 전부 충원(신규 161건 + 기존 은행 229건 사용; `data/mock-exam-generation/sat-math-hard5-20261020/final/plan-report.json`). 세트당 어려운 경로 3 / 수학 1 5 / 쉬운 경로 5 교체(13칸).
- 세트 간 문항 중복 0(초안 30개 안 수학 문항 중복 0, 서로 다른 hard 630). 세트 쌍 유사그룹 공유 최대 15(<= max(15, 현재 17)), 같은 세트 안 유사그룹 중복 0. 공유 불가피 사례 없음.
- hard 후보는 영어 해설 필수. 스킬·도메인·mc/spr 구성은 같은 칸 안에서만 교체해 **세트별 (모듈, 경로, 스킬, 도메인) 개수가 공개본과 동일(차이 0)**, mc/spr 수 불변.
- **hard 위치**: 후반(모듈 순번 12~22) 칸을 우선 교체했다. 결과 수학 1 hard 평균 순번 14.3/22 (150건 중 102건 후반, 64건 마지막 6칸), 쉬운 경로 14.5(103·71), 어려운 경로 13.4. 모듈 안 순서는 공식 순서 규칙(스킬 공식 평균 위치 -> 난이도)을 유지했으므로 hard 가 일부 앞쪽 스킬 칸에도 남는다. 더 강하게 후반 몰기는 순서 규칙 변경이라 하지 않았다.

## C. 신규 hard 문항 서두·문법 규칙 (`lib/problem-generation/awkward-framing.ts` + 테스트)
결정론 컴파일러(`skills/a-kit.ts lead()`)가 문항 앞에 붙이는 한 문장 상황 설명이 원인이다(교사·튜터가 old test item/warm-up question 을 whiteboard 에서 점검 등).
- F1 메타 서두(교사·튜터·저자가 문제 자체를 점검·제시·채점), F2 메타 지시 서두("The following scenario comes from…" 등), F3 시제 불일치("Last week, … is working"), F4 단수 주어+복수 동사("The equation … are", 문장·절 첫머리 주어만).
- 기존 신규 hard 93건 재검사: **26건 탈락(F1 20·F2 6), 67건 사용 가능**. 은행 후보 865건 중 31건도 같은 규칙에 걸려 제외. F4 는 93건에서 0건(은행 오탐 12건은 "points on the graph are" 같은 전치사구라 규칙에서 제외하도록 보정).
- 신규 생성분은 앞 서두 문장(`lead()` 첫 문장)을 **제거**한 뒤(`stripMetaLead`, 수식·정답 무관 문장이라 문제 불변) 규칙·근접 중복(3-gram 0.6) 검사를 다시 한다. 제거 후에도 F1 이 남으면 탈락. 20건 경로의 정리 스크립트: `scripts/prod-open/sat-math-harder-clean.ts`(규칙 반영).

## D. 마이그레이션 `supabase/migrations/20262100000630_mock_exam_math_hard_in_m1_and_lower.sql` (additive, 번호 충돌 없음: 모든 원격 브랜치 최대 번호 620)
- 생성 열 `m1_eligible`, `m2_lower_eligible` 식을 `difficulty in (easy, medium) or (section = 'math' and difficulty = 'hard')` 로 변경(PG17 `ALTER COLUMN ... SET EXPRESSION`, 멱등, 열 순서·시그니처 불변). **R&W 는 종전 그대로**, `m2_higher_eligible` 불변.
- 세트 검증 함수 `mock_exam_validate_mst_set`(마지막 정의 20262100000260)은 이 열만 읽으므로 **본문 변경 없음**. 자동 조립기(`assemble.ts moduleEligibility`)도 종전대로 M1/lower 에 hard 를 고르지 않는다(주석으로 DB 와의 차이 명시).
- 롤백: `data/prod-open/sat-expand-sql/99_rollback_math_hard_eligibility.sql`(M1/lower 에 수학 hard 가 남아 있으면 중단 후 원 식 복귀).
- 테스트: `mock-exam-mst-phase2.integration.test.ts` 에 수학 hard/R&W hard/수학 easy 플래그 케이스 추가. 격리 DB 에서 phase2·routing·new-version 통합 3파일 40건 + 신규 1건 통과, 단위 5파일 62건 통과.

## E. 라우팅·점수 영향 분석 (코드 기반) — 임계값·앵커는 **변경하지 않았다**
코드: 라우팅 `lib/mock-exam/routing.ts decideRoute`(M1 정답 수 * 1e6 >= 임계값 * 문항 수; 같으면 higher), 정책 `mock_exam_routing_policies` 수학 v2 = correct_ratio 0.70(활성; v1 0.65). 22문항 기준 0.70 -> **16개 이상 정답이면 higher**(15/22=68.2% 는 lower). 점수 `lib/mock-exam/score-estimate.ts`: 경로별 (섹션 정답률 -> 점수) 앵커 표, 정답률은 M1+M2 합산, lower 상한 650.
- 영향 1(라우팅): M1 easy 5개 -> hard 이므로 같은 능력의 응시자의 M1 기대 정답 수가 내려가 16개 문턱을 넘는 비율이 준다. 실응시 데이터가 없어(수학 응시 기록은 QA/테스트 계정뿐) **가정 모형 추정**: 정답 확률 = 추측 하한 + 로지스틱(난도 b = easy -1 / medium 0 / hard +1, 변별 1.2, mc 75%/spr 25%). 중간 능력(theta 0) 기대 정답 14.8 -> 12.6(-2.2), P(>=16) 0.38 -> 0.10. 능력이 정규분포일 때 higher 비율 45% -> **29%**(균등 분포 가정 47% -> 35%). 문턱을 15개(0.68 이상)로 내리면 37%, 14개(0.63~0.636)로 내리면 44% 로 현재(45%)에 가장 가깝다.
- 영향 2(점수 앵커): M1·쉬운 경로·어려운 경로 모두 어려워지므로 같은 실력의 섹션 정답률이 약 6~10%p 내려가고(쉬운 경로 모듈 2개 합 -4.4/44, 어려운 경로 -2.9/44 가정), 앵커 기울기(쉬운 경로 정답률 0.5~0.8 구간 약 500점/1.0, 어려운 경로 0.5~0.7 약 700점/1.0)로 **예상 점수 범위가 약 40~70점 낮게 나올 수 있다**. 앵커는 원래 정확도 미검증 가정 모델(SCORE_VALIDATION_STATUS)이라 공개 후 응시 데이터로 보정하는 것이 정책(2026-10-15)과 일치한다.

## F. 오너 결정 필요 (변경하지 않음)
1. **수학 M1 임계값**: 권장 = 공개(초안 승격)와 동시에 변경하지 않고 첫 응시 데이터 확보 후 보정하되, 바로 보정하려면 0.70 -> **0.63**(22문항 중 14개 이상 -> higher; 모형상 higher 비율 44%, 현재 45% 유지). 영향: 라우팅 비율·어려운 경로 노출량·M2 점수 앵커 전제가 달라진다. 0.65(v1)는 22문항에서 15개 이상이라 37%.
2. **점수 앵커 재보정 시점**: 권장 = 앵커는 그대로 두고 표시 문구(예상 범위, 정확도 미검증)를 유지, 공개 후 응시 N건 확보 뒤 SCORE_MODEL_VERSION 을 올려 재보정. 영향: 그전까지 예상 점수가 40~70점 낮게 보일 수 있음.
3. 쉬운 경로 hard 5개로 쉬운 경로 상한(lower cap 650)의 의미가 흐려지는지: 권장 = 유지(상한은 경로 기준, 문항 난이도와 무관하게 동작).

## G. 파일·실행 순서 (총괄 실행; 원격 쓰기 없음, 로컬 격리 스택 PORT_OFFSET=500 에서 리허설 완료·스택 종료·config.toml 원복)
SQL 생성: `SAT_MATH_HARD5=1 npx tsx scripts/prod-open/sat-expand-sql.ts`(입력은 파일뿐). 출력 `data/prod-open/sat-expand-sql/`.
0. **마이그레이션 20262100000630 적용**(`npx supabase db push --linked`) — 49 가 이 규칙에 의존한다(46 이 적용 여부를 출력).
1. `46_preflight_math_hard5.sql` 읽기. 2. `47_import_math_hard5.sql` 신규 hard 240건 임포트(멱등). 3. `48_keywords_math_hard5.sql`.
4. **`51_discard_math_harder_drafts.sql`: 직전 44번이 만든 초안 30개(표지 mathHarder1020, 어려운 경로 hard 11·수학 1 easy 5/medium 올림)를 삭제(공개 안 됐고 응시 0인 초안만; 공개본·응시 불변)**. 총괄이 롤백 여부를 판단하므로 자동으로 하지 않고 별도 파일로 분리했다. 49 는 초안이 남은 세트를 건너뛰므로 51 을 먼저 실행해야 한다(그 세트에 다른 종류의 초안이 있으면 건너뛰고 알린다; 현재 원격 SAT Practice Test 초안 30개는 전부 44 가 만든 것).
5. `49_set_versions_math_hard5.sql` 30세트 새 초안 버전(교체 칸 검증·세트 검증 함수 통과 못하면 그 세트만 건너뜀, 공개 없음, 멱등). 6. `50_verify_math_hard5.sql` 읽기.
7. 롤백: `99_rollback_math_hard5.sql`(이 작업의 초안 삭제·미사용 신규 hard 보관), 열 규칙 복귀는 `99_rollback_math_hard_eligibility.sql`.
이전 44 초안(51 로 삭제 전)에 묶여 있던 44 가 임포트한 신규 hard 93건(42·43)은 은행에 남고 이 계획의 후보로 재사용된다(F1·F2 26건 제외).

## H. 로컬 격리 스택 리허설 결과 (원격 읽기 복사본)
마이그레이션 신규 DB 적용·재적용 멱등 -> seed(게시 30세트 + 44 초안 30개) -> 47 created=240 -> 48 링크 240 -> 51 초안 30개 삭제 -> 49 새 초안 30개(각 13칸 교체, 건너뜀 0) -> 재실행 30세트 모두 "초안 이미 있음" 건너뜀(멱등) -> 50 검증: 30세트 전부 ready, 147문항, 수학 1 hard 5·easy 3, 쉬운 경로 hard 5·easy 3, 어려운 경로 hard 11·medium 11, R&W 적격 위반 0, 다른 시험과 공유 문항 0 -> 분포 불변·중복 0·hard 630 확인 -> 99 롤백: 초안 30개 제거·신규 hard 240 보관(게시 30세트 불변).
첫 시도에서 세트 2개(Test 10·29)가 같은 세트 안 유사그룹(DB 트리거 키 `c:<skill>:<subpattern>`) 중복으로 건너뛰어졌고, 계획 스크립트가 신규 문항의 유사그룹을 원형 id 로 잘못 계산한 것이 원인이어서 DB 키로 고쳤다(재리허설 30/30).
