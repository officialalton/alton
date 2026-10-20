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
