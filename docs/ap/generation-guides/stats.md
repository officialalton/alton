# AP Statistics 생성 가이드 (2027 CED, 2026-10-12)

설정 파일: `lib/ap-generation/subjects/stats.ts`(`statsGuide`, 원형 목록은 `stats-archetypes.json` — 원천 `registry.py guide-stats`). 공식 사실은 `docs/ap/statistics-facts.md`, 계획은 `statistics-groundwork.md`, 파일럿 결과는 `statistics-pilot-report.md`.

## 1. 시험 구조(요약)
MC 42(단독 36 + 3문항 공유 세트 2개: 확률·분포 / 회귀)·90분·4지선다·50%, FRQ 4×10점(1점 행 10개)·90분·50%. 그래핑 계산기(통계 기능) 전 섹션 허용, 수식표·분포표는 시험이 제공. 완전 디지털(Bluebook). investigative question 은 FRQ1 의 스킬(1.A, 토픽 1.10)이지 별도 문항이 아니다.

## 2. 단원 범위(공식 MC 비중)
| 단원 | 비중 | 범위 안 | 범위 밖(삭제 주제 포함) |
|---|---|---|---|
| 1 One-Variable Data·Collecting Data | 20–30% | 그래프·요약통계·이상치(1.5 IQR)·z 점수·분포 비교, 탐구 질문, 표본추출·편향, 실험 설계·교란·인과 | 확률 규칙·추론·회귀 |
| 2 Probability·Random Variables·Distributions | 15–25% | 이원표·조건부·독립, 시뮬레이션, 이산 확률변수, 이항, 정규, 표본분포·CLT | 기하분포, 확률변수 결합(선형 변환 이상) |
| 3 Inference: Proportions | 15–25% | p̂ 분포·조건, 1-표본 z 구간·검정, 구간·p값 해석, 오류, 2-표본 비율, 카이제곱(동질성·독립성) | 적합도 카이제곱 |
| 4 Inference: Means | 10–20% | x̄ 분포, 1-표본·짝지은 t, 2-표본 t(비합동), 조건 | 합동 t, 기울기 추론 |
| 5 Regression | 10–20% | 산점도·상관·최소제곱선·잔차·영향점·r²·회귀 출력 | 기울기 추론, 비선형·변환 |

## 3. 설계 규칙(계산기 허용 과목)
- **계산만 묻는 문항 금지**: 설계도 `judgment_demand`(procedure_choice / condition_check / interpretation / claim_justification / representation_reading / calculated_value_decision)에 계산값 판정 외 하나 이상이 있어야 한다(`blueprint.ts` `calculation_only_item`).
- **반올림 관례**: 소수 선택지가 있으면 stem 이 반올림 자릿수를 밝힌다(`rounding_convention_not_stated`), 선택지 값 간격은 마지막 자릿수 2단위 이상(`options_too_close_for_rounding`). 정답은 정확 경로로 계산한 뒤 마지막에만 반올림한다.
- **해석형 문항은 고정 문장 4개**: 정답 1 + 이름 붙은 오해 3(예: 확률로 읽기·표본 분포와 혼동·표본 개체로 서술). 문장 길이를 맞춘다.
- **TeX 위생**: 수·확률·통계량·기호는 모두 `$...$` 안(stem·선택지·해설). 화폐는 `\$`.
- **조건 확인 문구(CED)**: 무작위 표본 또는 무작위 배정, 10% 조건(비복원), 비율은 큰 표본(대횟수), 평균은 표본 크기 또는 그래프로 정규성. 정확히 한 조건이 위반 또는 충족되는 설계.
- **독립 검증**: 정규·t·카이제곱 값은 scipy 와 독립 경로(`math.erf`, pdf 를 `scipy.integrate.quad` 로 적분, 정확 분수, 전수 열거, 대규모 시뮬레이션)를 병행한다.
- **구조 기준 문항군**: 푸는 방식·질문·표현이 다른 것만 별도 구조. 숫자·문구 변형은 같은 군(`lookAlikeReason`).

## 4. 그림(figure) 시스템
`stimulus.kind = "stat_chart"` → `ap_stat_chart` 래퍼(SAT `data` 차트 + 트리 + 신규): histogram · dot_plot · boxplot(이상치 점) · scatter(점 강조·축 범위·0 기준선) · two_way · bar · table · tree · **curve**(밀도곡선, 이중 눈금 z, 꼬리 음영, 표시선) · **output**(컴퓨터 출력 블록). 게이트가 면적 1·확률 합 1·계급 폭 동일·수염 밖 이상치 등을 검사하고 영어 alt 를 만든다. 코드: `lib/problem-figures/templates/ap-stat-chart.ts`.

## 5. S1 파일럿 원형 20개(전부 계산기 `allowed`, 위험 L→M→H)
| 위험 | 단원 | id | 토픽 / 스킬 | 그림 |
|---|---|---|---|---|
| L | 1 | `st_hist_median_interval` | 1.7 / 3.B | 히스토그램 |
| L | 1 | `st_box_outlier_fence` | 1.7 / 3.B | 상자그림 + 이상치 점 |
| L | 1 | `st_z_compare` | 1.7 / 3.B | — |
| L | 2 | `st_cond_prob_table` | 2.6 / 3.C | 이원표 |
| L | 2 | `st_tree_bayes` | 2.6 / 3.C | 확률 트리 |
| L | 2 | `st_binomial_exact` | 2.10 / 3.C | — |
| L | 2 | `st_normal_area` | 2.11 / 3.C | 정규곡선(이중 눈금) |
| L | 3 | `st_z_test_decision` | 3.7 / 3.E | — |
| L | 4 | `st_t_test_stats` | 4.5 / 3.E | t 곡선 + 꼬리 |
| L | 4 | `st_two_sample_t` | 4.7 / 3.E | 요약통계 표 |
| M | 1 | `st_study_conclusion` | 1.13 / 2.B | — |
| M | 2 | `st_clt_describe` | 2.12 / 4.C | 점도표(시뮬 표본평균) |
| M | 3 | `st_chisq_output` | 3.15 / 4.G | 컴퓨터 출력 |
| M | 4 | `st_t_output_claim` | 4.10 / 4.G | 컴퓨터 출력 |
| M | 5 | `st_residual_plot` | 5.4 / 4.D | 잔차그림 |
| M | 5 | `st_influential_point` | 5.2 / 4.D | 산점도 + 강조 점 |
| H | 1 | `st_confounder` | 1.13 / 2.A | — |
| H | 3 | `st_ci_interpretation` | 3.4 / 4.F | — |
| H | 3 | `st_pvalue_interpretation` | 3.6 / 4.F | 표본비율 분포 + 꼬리 |
| H | 5 | `st_slope_interp` | 5.5 / 4.D | 회귀 출력 |

## 6. 재현
```
python3 -m venv .venv-ap && .venv-ap/bin/pip install -r scripts/ap-generation/requirements.txt   # Python 3.12+ (검증 3.14.7)
npx tsx scripts/ap-generation/stats-precheck.ts --list stats_s1_all --n 3 [--svg-dir <경로>]       # 무료 사전 점검
npx tsx scripts/ap-generation/run-frozen.ts --config config/ap-frozen/stats-s1-l.v1.json --check-only   # 해시 대조(유료 아님)
npx tsx scripts/ap-generation/stats-pilot-summary.ts                                                 # 결과 요약
npx tsx scripts/ap-generation/stats-finalize.ts                                                      # 재고 행·통과 키·look-alike
```
