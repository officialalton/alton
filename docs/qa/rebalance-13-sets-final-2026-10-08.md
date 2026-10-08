# SAT Practice Test 1..13 통합 재조정 (dry-run, 2026-10-08)

생성: `scripts/mock-exam-generation/rebalance-sets.ts` (DB 접근 없음, 원격 쓰기 없음). 덤프: bank-dump-20261008b. 

상한: 모듈당 cluster 1, 54문항 경로당 2, 비문학 family 4. 유사문항 그룹 공유 <= 15. 게시 세트 9개(T1, T2, T3, T4, T5, T6, T7, T8, T9), 새 세트 요청 4개(T10~), 계획 4개.

## 1. 교체 요약

총 56건 교체 (사유: archived_problem 15, topic_cap 41). skill fallback 6건, 교체 불가 0건. 현재 게시 버전으로 갱신된 문항 14건.

| 세트 | 교체 수 | 사유 | skill fallback | 교체 불가 | 소재 위반(전→후) |
|---|---|---|---|---|---|
| SAT Practice Test 1 | 13 | archived_problem:5 topic_cap:8 | 1 | 0 | 15 → 0 |
| SAT Practice Test 2 | 10 | topic_cap:10 | 0 | 0 | 9 → 0 |
| SAT Practice Test 3 | 13 | archived_problem:2 topic_cap:11 | 1 | 0 | 13 → 0 |
| SAT Practice Test 4 | 3 | topic_cap:3 | 0 | 0 | 3 → 0 |
| SAT Practice Test 5 | 2 | topic_cap:2 | 1 | 0 | 2 → 0 |
| SAT Practice Test 6 | 4 | archived_problem:2 topic_cap:2 | 1 | 0 | 5 → 0 |
| SAT Practice Test 7 | 4 | archived_problem:2 topic_cap:2 | 0 | 0 | 2 → 0 |
| SAT Practice Test 8 | 3 | archived_problem:2 topic_cap:1 | 2 | 0 | 1 → 0 |
| SAT Practice Test 9 | 4 | archived_problem:2 topic_cap:2 | 0 | 0 | 2 → 0 |

### skill fallback 목록(같은 skill 후보가 하나도 없던 경우)

- SAT Practice Test 1 rw_m1/- #4 rw_information_ideas easy: command_of_evidence_quant → central_ideas_details (archived_problem)
- SAT Practice Test 3 rw_m2/lower #54 rw_information_ideas medium: command_of_evidence_quant → central_ideas_details (archived_problem)
- SAT Practice Test 8 rw_m2/lower #34 rw_information_ideas easy: command_of_evidence_quant → central_ideas_details (archived_problem)
- SAT Practice Test 8 rw_m2/higher #76 rw_information_ideas hard: command_of_evidence_quant → central_ideas_details (archived_problem)
- SAT Practice Test 6 rw_m2/lower #35 rw_information_ideas easy: command_of_evidence_quant → central_ideas_details (topic_cap)
- SAT Practice Test 5 rw_m2/higher #77 rw_information_ideas hard: command_of_evidence_quant → command_of_evidence_text (topic_cap)

### 교체 불가(강제 교체 대상인데 같은 칸 미사용 재고 없음)

- 없음

## 2. 컬렉션 검증

- 전체 세트(수리본+새 세트) 문항 중복 problem: 0건
- 유사문항 그룹 한도 새 위반: 없음; 수리 전부터 넘던 쌍(늘리지 않음): SAT Practice Test 6 / SAT Practice Test 7 share 17 groups (before 17, limit 15)
- 30 skill x 3 난이도 칸 누락: 없음
- 새 세트 조립 실패: 없음; 소재 상한 완화로 들어간 새 세트 문항 0건
- 재고: 시작 미사용 3285 → 남음 2641. 미분류(소재 없음) R&W 재고 0건(소재 제약 계산에서 제외 또는 무제한 취급).

## 3. 세트별 R&W 과목 구성과 상위 소재 (최종)

| 세트 | 종류 | literature fiction | humanities | social science | history civics | economics business | science life | science earth_space | science physical | technology | 상위 cluster | 위반 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SAT Practice Test 1 | copy | 19 (23%) | 9 (11%) | 8 (10%) | 6 (7%) | 8 (10%) | 18 (22%) | 6 (7%) | 4 (5%) | 3 (4%) | cephalopods×3, congestion-pricing×2, whistled-languages×2, streetcar-systems×2 | 0 |
| SAT Practice Test 2 | copy | 19 (23%) | 11 (14%) | 8 (10%) | 8 (10%) | 7 (9%) | 17 (21%) | 5 (6%) | 4 (5%) | 2 (2%) | carnivorous-plants×3, exoplanet-detection×2, cephalopods×2, textile-industry-decline×2 | 0 |
| SAT Practice Test 3 | copy | 22 (27%) | 9 (11%) | 7 (9%) | 6 (7%) | 6 (7%) | 19 (23%) | 6 (7%) | 2 (2%) | 4 (5%) | bus-rapid-transit×3, exoplanet-detection×2, whistled-languages×2, carnivorous-plants×2 | 0 |
| SAT Practice Test 4 | copy | 31 (38%) | 6 (7%) | 5 (6%) | 12 (15%) | 1 (1%) | 12 (15%) | 6 (7%) | 1 (1%) | 7 (9%) | sea-otters-kelp-forests×2, coqui-frog×2, desert-plant-adaptation×2, fiction-loss-of-faith×1 | 0 |
| SAT Practice Test 5 | copy | 32 (40%) | 8 (10%) | 4 (5%) | 8 (10%) | 1 (1%) | 14 (17%) | 10 (12%) | 0 (0%) | 4 (5%) | public-libraries×2, dutch-still-life-painting×2, carnivorous-plants×2, okavango-delta×2 | 0 |
| SAT Practice Test 6 | copy | 31 (38%) | 12 (15%) | 5 (6%) | 9 (11%) | 2 (2%) | 12 (15%) | 3 (4%) | 2 (2%) | 5 (6%) | whistled-languages×3, dutch-still-life-painting×2, fiction-family-secrets×2, sea-otters-kelp-forests×2 | 0 |
| SAT Practice Test 7 | copy | 30 (37%) | 5 (6%) | 4 (5%) | 9 (11%) | 2 (2%) | 13 (16%) | 13 (16%) | 0 (0%) | 5 (6%) | stellar-spectroscopy×2, okavango-delta×2, railway-time-standardization×2, bioluminescent-plankton×2 | 0 |
| SAT Practice Test 8 | copy | 40 (49%) | 6 (7%) | 5 (6%) | 5 (6%) | 2 (2%) | 8 (10%) | 6 (7%) | 2 (2%) | 7 (9%) | desert-plant-adaptation×2, fiction-lighthouse-keeper×2, bridge-engineering×2, 3d-printed-bridge×2 | 0 |
| SAT Practice Test 9 | copy | 35 (43%) | 6 (7%) | 6 (7%) | 8 (10%) | 4 (5%) | 12 (15%) | 4 (5%) | 1 (1%) | 5 (6%) | sea-otters-kelp-forests×2, fast-radio-bursts×2, railway-time-standardization×2, streetcar-systems×2 | 0 |
| SAT Practice Test 10 | new | 18 (22%) | 11 (14%) | 10 (12%) | 9 (11%) | 7 (9%) | 9 (11%) | 6 (7%) | 7 (9%) | 4 (5%) | fiction-coming-of-age×1, fiction-gothic-mystery×1, apartheid×1, fiction-estranged-father-daughter×1 | 0 |
| SAT Practice Test 11 | new | 18 (22%) | 11 (14%) | 11 (14%) | 8 (10%) | 7 (9%) | 8 (10%) | 5 (6%) | 7 (9%) | 6 (7%) | self-efficacy×1, public-libraries×1, desert-plant-adaptation×1, fiction-village-mystery×1 | 0 |
| SAT Practice Test 12 | new | 18 (22%) | 11 (14%) | 11 (14%) | 8 (10%) | 7 (9%) | 9 (11%) | 6 (7%) | 7 (9%) | 4 (5%) | emotional-labor×2, fish-ladder-engineering×1, optical-lens-patents×1, bordeaux-wine-ranking×1 | 0 |
| SAT Practice Test 13 | new | 18 (22%) | 12 (15%) | 9 (11%) | 9 (11%) | 7 (9%) | 8 (10%) | 6 (7%) | 7 (9%) | 5 (6%) | tidal-river-management×2, public-libraries×2, cleaner-wrasse×2, boat-lifts×1 | 0 |

목표(%): literature_fiction 22, humanities 14, social_science 13, history_civics 12, economics_business 8, science_life 11, science_earth_space 7, science_physical 8, technology 5

### 수리 전 과목 구성·상위 cluster (게시 세트)

| 세트 | literature fiction | humanities | social science | history civics | economics business | science life | science earth_space | science physical | technology | 상위 cluster |
|---|---|---|---|---|---|---|---|---|---|---|
| SAT Practice Test 1 | 19 | 10 | 1 | 8 | 9 | 25 | 6 | 0 | 3 | cephalopods×7, streetcar-systems×4, bioluminescent-plankton×4, congestion-pricing×2 |
| SAT Practice Test 2 | 19 | 17 | 3 | 7 | 8 | 18 | 5 | 1 | 3 | bus-rapid-transit×4, bioluminescent-plankton×3, carnivorous-plants×3, judith-leyster×3 |
| SAT Practice Test 3 | 19 | 11 | 2 | 4 | 8 | 26 | 6 | 1 | 4 | bus-rapid-transit×6, bioluminescent-plankton×4, hydrothermal-vent-ecosystems×3, coral-reefs×3 |
| SAT Practice Test 4 | 31 | 6 | 3 | 13 | 2 | 13 | 6 | 0 | 7 | sea-otters-kelp-forests×2, coqui-frog×2, desert-plant-adaptation×2, ynes-mexia×2 |
| SAT Practice Test 5 | 33 | 8 | 2 | 8 | 1 | 14 | 11 | 0 | 4 | public-libraries×2, dutch-still-life-painting×2, carnivorous-plants×2, okavango-delta×2 |
| SAT Practice Test 6 | 30 | 13 | 5 | 9 | 2 | 14 | 3 | 0 | 5 | dutch-still-life-painting×3, whistled-languages×3, bus-rapid-transit×3, cephalopods×2 |
| SAT Practice Test 7 | 31 | 4 | 2 | 10 | 2 | 14 | 13 | 0 | 5 | stellar-spectroscopy×2, okavango-delta×2, cephalopods×2, railway-time-standardization×2 |
| SAT Practice Test 8 | 41 | 6 | 4 | 5 | 2 | 9 | 7 | 0 | 7 | desert-plant-adaptation×2, fiction-lighthouse-keeper×2, bridge-engineering×2, 3d-printed-bridge×2 |
| SAT Practice Test 9 | 35 | 5 | 4 | 10 | 4 | 13 | 4 | 0 | 6 | sea-otters-kelp-forests×2, fast-radio-bursts×2, railway-time-standardization×2, ynes-mexia×2 |

## 4. 남은 위반과 이유

- 없음

## 5. 목표 과목 구성을 위한 추가 생성 필요량 (R&W)

전제: 13세트 R&W 문항 1053건, 과목별 하한 = (목표% - 4pp) x 칸 수요. 공급 = 최종 계획에 쓰인 문항 + 남은 미사용 재고(분류된 것만). 칸 단위로 부족분을 계산하고 과목별 합계만 올림한다. 생성된 문항은 과다 과목(문학 등) 문항을 대체한다.

허용오차 민감도(추가 생성 총량): 0pp → 213건, 2pp → 108건, 4pp → 37건, 6pp → 14건.

**칸 단위 추정 총 37건** — 채택 기준 $0.22/건 ≈ $8.14, hard 비중이 높으면 $0.5/건 ≈ $18.5.

과목별(칸 단위 합계):

| 과목 | 추가 생성 | 전역 하한 | 전역 공급 | 전역 부족 |
|---|---|---|---|---|
| literature_fiction | 9 | 189 | 701 | 0 |
| humanities | 5 | 105 | 151 | 0 |
| social_science | 6 | 94 | 108 | 0 |
| history_civics | 2 | 84 | 141 | 0 |
| economics_business | 1 | 42 | 79 | 0 |
| science_life | 1 | 73 | 186 | 0 |
| science_earth_space | 4 | 31 | 92 | 0 |
| science_physical | 7 | 42 | 60 | 0 |
| technology | 2 | 10 | 83 | 0 |

skill x 난이도 칸별 추가 생성 (상위 40; 전체는 shortfall.json):

| 칸 | 수요 | 추가 | 과목별 |
|---|---|---|---|
| central_ideas_details|medium | 154 | 6 | social_science 2, economics_business 1, science_life 1, science_earth_space 2, science_physical 2 |
| command_of_evidence_quant|medium | 10 | 4 | literature_fiction 2, humanities 1, history_civics 1 |
| boundaries|easy | 26 | 3 | literature_fiction 1, humanities 1, social_science 2, science_physical 1 |
| words_in_context|medium | 85 | 3 | humanities 1, history_civics 1, science_physical 2 |
| transitions|medium | 59 | 3 | literature_fiction 3, social_science 1 |
| boundaries|medium | 98 | 3 | literature_fiction 2, humanities 1 |
| cross_text_connections|easy | 9 | 2 | literature_fiction 1, science_physical 1, technology 1 |
| inferences|medium | 12 | 2 | humanities 1, social_science 1, economics_business 1, science_physical 1, technology 1 |
| cross_text_connections|medium | 12 | 2 | social_science 1, science_earth_space 1, science_physical 1, technology 1 |
| command_of_evidence_quant|easy | 3 | 2 | literature_fiction 1, humanities 1, social_science 1, history_civics 1, science_earth_space 1, science_physical 1, technology 1 |
| words_in_context|hard | 13 | 2 | humanities 1, social_science 1, science_physical 1, technology 1 |
| words_in_context|easy | 35 | 1 | science_earth_space 1 |
| text_structure_purpose|easy | 34 | 1 | science_earth_space 1 |
| form_structure_sense|easy | 26 | 1 | social_science 1 |
| rhetorical_synthesis|easy | 26 | 1 | economics_business 1 |
| text_structure_purpose|medium | 98 | 1 | science_physical 1 |
| rhetorical_synthesis|medium | 58 | 1 | social_science 1 |
| command_of_evidence_text|medium | 19 | 1 | technology 1 |
| central_ideas_details|hard | 8 | 1 | technology 1 |
| inferences|hard | 8 | 1 | science_earth_space 1, science_physical 1, technology 1 |
| boundaries|hard | 13 | 1 | history_civics 1 |
| form_structure_sense|hard | 13 | 1 | technology 1 |
| cross_text_connections|hard | 13 | 1 | social_science 1, science_physical 1 |
| rhetorical_synthesis|hard | 13 | 1 | social_science 1 |
| transitions|hard | 13 | 1 | social_science 1, history_civics 1, technology 1 |
| command_of_evidence_text|easy | 11 | 1 | science_earth_space 1, technology 1 |
| inferences|easy | 15 | 1 | humanities 1, social_science 1 |
| command_of_evidence_text|hard | 9 | 1 | science_earth_space 1 |
| command_of_evidence_quant|hard | 1 | 1 | literature_fiction 1, humanities 1, social_science 1, history_civics 1, economics_business 1, science_earth_space 1, science_physical 1, technology 1 |

## 6. 적용 순서 제안(총괄)

1. 다른 에이전트의 R&W 수정 버전이 들어온 뒤 새 덤프로 같은 명령 재실행 2. `set-copies.json` 각 항목: `<name> (new)` 초안 사본 생성 → `mock_exam_validate_mst_set`·`mock_exam_set_item_issues` 검증 → 옛 세트 보관 → 사본 free 게시 3. `new-sets.json` 으로 T10~ 신규 세트 생성. 모든 단계는 이 보고서 범위 밖(원격 쓰기 없음).
