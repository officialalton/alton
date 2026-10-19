# SAT Practice Test 1..13 통합 재조정 (dry-run, 2026-10-08)

생성: `scripts/mock-exam-generation/rebalance-sets.ts` (DB 접근 없음, 원격 쓰기 없음). 덤프: tmp/proj/dump.json. 

상한: 모듈당 cluster 1, 54문항 경로당 2, 비문학 family 4. 유사문항 그룹 공유 <= 15. 게시 세트 13개(T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13), 새 세트 요청 13개(T14~), 계획 13개.

## 1. 교체 요약

총 1건 교체 (사유: topic_cap 1). skill fallback 0건, 교체 불가 0건. 현재 게시 버전으로 갱신된 문항 0건.

| 세트 | 교체 수 | 사유 | skill fallback | 교체 불가 | 소재 위반(전→후) |
|---|---|---|---|---|---|
| SAT Practice Test 1 | 0 | - | 0 | 0 | 0 → 0 |
| SAT Practice Test 2 | 1 | topic_cap:1 | 0 | 0 | 1 → 0 |
| SAT Practice Test 3 | 0 | - | 0 | 0 | 0 → 0 |
| SAT Practice Test 4 | 0 | - | 0 | 0 | 0 → 0 |
| SAT Practice Test 5 | 0 | - | 0 | 0 | 0 → 0 |
| SAT Practice Test 6 | 0 | - | 0 | 0 | 0 → 0 |
| SAT Practice Test 7 | 0 | - | 0 | 0 | 0 → 0 |
| SAT Practice Test 8 | 0 | - | 0 | 0 | 0 → 0 |
| SAT Practice Test 9 | 0 | - | 0 | 0 | 0 → 0 |
| SAT Practice Test 10 | 0 | - | 0 | 0 | 0 → 0 |
| SAT Practice Test 11 | 0 | - | 0 | 0 | 0 → 0 |
| SAT Practice Test 12 | 0 | - | 0 | 0 | 0 → 0 |
| SAT Practice Test 13 | 0 | - | 0 | 0 | 0 → 0 |

### skill fallback 목록(같은 skill 후보가 하나도 없던 경우)

- 없음

### 교체 불가(강제 교체 대상인데 같은 칸 미사용 재고 없음)

- 없음

## 2. 컬렉션 검증

- 전체 세트(수리본+새 세트) 문항 중복 problem: 0건
- 유사문항 그룹 한도 새 위반: 없음; 수리 전부터 넘던 쌍(늘리지 않음): SAT Practice Test 6 / SAT Practice Test 7 share 17 groups (before 17, limit 15)
- 30 skill x 3 난이도 칸 누락: 없음
- 새 세트 조립 실패: 없음; 소재 상한 완화로 들어간 새 세트 문항 0건
- 재고: 시작 미사용 3342 → 남음 1430. 미분류(소재 없음) R&W 재고 0건(소재 제약 계산에서 제외 또는 무제한 취급).

## 3. 세트별 R&W 과목 구성과 상위 소재 (최종)

| 세트 | 종류 | literature fiction | humanities | social science | history civics | economics business | science life | science earth_space | science physical | technology | 상위 cluster | 위반 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SAT Practice Test 1 | unchanged | 19 (23%) | 9 (11%) | 8 (10%) | 6 (7%) | 8 (10%) | 18 (22%) | 6 (7%) | 4 (5%) | 3 (4%) | cephalopods×3, congestion-pricing×2, whistled-languages×2, streetcar-systems×2 | 0 |
| SAT Practice Test 2 | copy | 19 (23%) | 11 (14%) | 9 (11%) | 8 (10%) | 7 (9%) | 16 (20%) | 5 (6%) | 4 (5%) | 2 (2%) | carnivorous-plants×3, exoplanet-detection×2, textile-industry-decline×2, bus-rapid-transit×2 | 0 |
| SAT Practice Test 3 | unchanged | 22 (27%) | 9 (11%) | 7 (9%) | 6 (7%) | 6 (7%) | 20 (25%) | 5 (6%) | 2 (2%) | 4 (5%) | bus-rapid-transit×3, exoplanet-detection×2, whistled-languages×2, carnivorous-plants×2 | 0 |
| SAT Practice Test 4 | unchanged | 32 (40%) | 5 (6%) | 5 (6%) | 12 (15%) | 1 (1%) | 12 (15%) | 6 (7%) | 1 (1%) | 7 (9%) | sea-otters-kelp-forests×2, coqui-frog×2, desert-plant-adaptation×2, fiction-loss-of-faith×1 | 0 |
| SAT Practice Test 5 | unchanged | 32 (40%) | 8 (10%) | 4 (5%) | 8 (10%) | 1 (1%) | 14 (17%) | 10 (12%) | 0 (0%) | 4 (5%) | public-libraries×2, dutch-still-life-painting×2, carnivorous-plants×2, okavango-delta×2 | 0 |
| SAT Practice Test 6 | unchanged | 31 (38%) | 12 (15%) | 5 (6%) | 10 (12%) | 1 (1%) | 12 (15%) | 3 (4%) | 2 (2%) | 5 (6%) | whistled-languages×3, dutch-still-life-painting×2, fiction-family-secrets×2, sea-otters-kelp-forests×2 | 0 |
| SAT Practice Test 7 | unchanged | 30 (37%) | 5 (6%) | 4 (5%) | 9 (11%) | 2 (2%) | 13 (16%) | 13 (16%) | 0 (0%) | 5 (6%) | stellar-spectroscopy×2, okavango-delta×2, railway-time-standardization×2, bioluminescent-plankton×2 | 0 |
| SAT Practice Test 8 | unchanged | 40 (49%) | 6 (7%) | 5 (6%) | 5 (6%) | 2 (2%) | 8 (10%) | 6 (7%) | 2 (2%) | 7 (9%) | fiction-lighthouse-keeper×2, bridge-engineering×2, 3d-printed-bridge×2, fiction-domestic-anticipation×1 | 0 |
| SAT Practice Test 9 | unchanged | 35 (43%) | 6 (7%) | 6 (7%) | 8 (10%) | 4 (5%) | 12 (15%) | 4 (5%) | 1 (1%) | 5 (6%) | sea-otters-kelp-forests×2, fast-radio-bursts×2, railway-time-standardization×2, hydrothermal-vent-ecosystems×2 | 0 |
| SAT Practice Test 10 | unchanged | 18 (22%) | 10 (12%) | 10 (12%) | 9 (11%) | 7 (9%) | 9 (11%) | 6 (7%) | 7 (9%) | 5 (6%) | fiction-coming-of-age×1, fiction-gothic-mystery×1, apartheid×1, fiction-estranged-father-daughter×1 | 0 |
| SAT Practice Test 11 | unchanged | 18 (22%) | 11 (14%) | 11 (14%) | 9 (11%) | 6 (7%) | 8 (10%) | 5 (6%) | 7 (9%) | 6 (7%) | self-efficacy×1, public-libraries×1, desert-plant-adaptation×1, fiction-village-mystery×1 | 0 |
| SAT Practice Test 12 | unchanged | 18 (22%) | 11 (14%) | 11 (14%) | 8 (10%) | 7 (9%) | 9 (11%) | 6 (7%) | 7 (9%) | 4 (5%) | emotional-labor×2, fish-ladder-engineering×1, optical-lens-patents×1, bordeaux-wine-ranking×1 | 0 |
| SAT Practice Test 13 | unchanged | 18 (22%) | 12 (15%) | 9 (11%) | 9 (11%) | 7 (9%) | 8 (10%) | 6 (7%) | 7 (9%) | 5 (6%) | tidal-river-management×2, public-libraries×2, cleaner-wrasse×2, boat-lifts×1 | 0 |
| SAT Practice Test 14 | new | 18 (22%) | 12 (15%) | 10 (12%) | 10 (12%) | 6 (7%) | 9 (11%) | 6 (7%) | 5 (6%) | 5 (6%) | coral-reefs×2, dutch-golden-age-painting×1, ynes-mexia×1, public-libraries×1 | 0 |
| SAT Practice Test 15 | new | 19 (23%) | 11 (14%) | 10 (12%) | 10 (12%) | 7 (9%) | 9 (11%) | 6 (7%) | 5 (6%) | 4 (5%) | cephalopods×2, judith-leyster×1, fiction-mysterious-visitor×1, cathedral-architecture×1 | 0 |
| SAT Practice Test 16 | new | 18 (22%) | 12 (15%) | 9 (11%) | 10 (12%) | 7 (9%) | 9 (11%) | 5 (6%) | 5 (6%) | 6 (7%) | fiction-forest-description×1, fiction-marriage-doubt×1, chelation×1, public-libraries×1 | 0 |
| SAT Practice Test 17 | new | 18 (22%) | 12 (15%) | 11 (14%) | 10 (12%) | 6 (7%) | 9 (11%) | 6 (7%) | 5 (6%) | 4 (5%) | fiction-armed-conflict×1, recycled-plastic-bridges×1, impressionism×1, metal-recrystallization×1 | 0 |
| SAT Practice Test 18 | new | 18 (22%) | 11 (14%) | 10 (12%) | 10 (12%) | 7 (9%) | 10 (12%) | 5 (6%) | 6 (7%) | 4 (5%) | tea-auctions×2, fiction-cold-and-fire×1, fiction-unconventional-dress×1, mock-spanish×1 | 0 |
| SAT Practice Test 19 | new | 19 (23%) | 11 (14%) | 10 (12%) | 10 (12%) | 7 (9%) | 9 (11%) | 5 (6%) | 5 (6%) | 5 (6%) | bioluminescent-plankton×1, fiction-doctor-and-dying-patient×1, cephalopods×1, fiction-pygmalion-myth×1 | 0 |
| SAT Practice Test 20 | new | 19 (23%) | 12 (15%) | 10 (12%) | 10 (12%) | 6 (7%) | 10 (12%) | 5 (6%) | 5 (6%) | 4 (5%) | fiction-confrontation×1, storm-surge-barriers×1, fiction-social-institutions×1, archerfish-hunting×1 | 0 |
| SAT Practice Test 21 | new | 20 (25%) | 12 (15%) | 11 (14%) | 9 (11%) | 5 (6%) | 10 (12%) | 4 (5%) | 4 (5%) | 6 (7%) | fiction-romantic-tension×1, la-bruyere-literary-criticism×1, fiction-psychological-distress×1, giraffe-circulation×1 | 0 |
| SAT Practice Test 22 | new | 19 (23%) | 12 (15%) | 11 (14%) | 10 (12%) | 6 (7%) | 10 (12%) | 4 (5%) | 4 (5%) | 5 (6%) | physical-vapor-deposition×2, fiction-social-reform×1, fiction-marriage-doubt×1, heroic-motives×1 | 0 |
| SAT Practice Test 23 | new | 19 (23%) | 12 (15%) | 9 (11%) | 10 (12%) | 5 (6%) | 10 (12%) | 5 (6%) | 5 (6%) | 6 (7%) | fiction-civil-war-letter×1, bridge-engineering×1, fiction-romantic-disappointment×1, personal-magnetism×1 | 0 |
| SAT Practice Test 24 | new | 22 (27%) | 11 (14%) | 10 (12%) | 9 (11%) | 5 (6%) | 10 (12%) | 4 (5%) | 4 (5%) | 6 (7%) | fiction-victorian-pastiche×1, fiction-reunion×1, fiction-childhood-memory×1, polymer-mechanics×1 | 0 |
| SAT Practice Test 25 | new | 20 (25%) | 10 (12%) | 9 (11%) | 11 (14%) | 6 (7%) | 11 (14%) | 5 (6%) | 4 (5%) | 5 (6%) | fiction-rural-isolation×1, tenement-reform×1, fiction-train-journey×1, fiction-reunion×1 | 0 |
| SAT Practice Test 26 | new | 25 (31%) | 12 (15%) | 8 (10%) | 10 (12%) | 4 (5%) | 10 (12%) | 4 (5%) | 2 (2%) | 6 (7%) | fiction-ice-climbing×1, fiction-consciousness-gap×1, japanese-silk-trade×1, pangolin-scales×1 | 0 |

목표(%): literature_fiction 22, humanities 14, social_science 13, history_civics 12, economics_business 8, science_life 11, science_earth_space 7, science_physical 8, technology 5

### 수리 전 과목 구성·상위 cluster (게시 세트)

| 세트 | literature fiction | humanities | social science | history civics | economics business | science life | science earth_space | science physical | technology | 상위 cluster |
|---|---|---|---|---|---|---|---|---|---|---|
| SAT Practice Test 1 | 19 | 9 | 8 | 6 | 8 | 18 | 6 | 4 | 3 | cephalopods×3, congestion-pricing×2, whistled-languages×2, streetcar-systems×2 |
| SAT Practice Test 2 | 19 | 11 | 8 | 8 | 7 | 17 | 5 | 4 | 2 | carnivorous-plants×3, exoplanet-detection×2, cephalopods×2, textile-industry-decline×2 |
| SAT Practice Test 3 | 22 | 9 | 7 | 6 | 6 | 20 | 5 | 2 | 4 | bus-rapid-transit×3, exoplanet-detection×2, whistled-languages×2, carnivorous-plants×2 |
| SAT Practice Test 4 | 32 | 5 | 5 | 12 | 1 | 12 | 6 | 1 | 7 | sea-otters-kelp-forests×2, coqui-frog×2, desert-plant-adaptation×2, fiction-loss-of-faith×1 |
| SAT Practice Test 5 | 32 | 8 | 4 | 8 | 1 | 14 | 10 | 0 | 4 | public-libraries×2, dutch-still-life-painting×2, carnivorous-plants×2, okavango-delta×2 |
| SAT Practice Test 6 | 31 | 12 | 5 | 10 | 1 | 12 | 3 | 2 | 5 | whistled-languages×3, dutch-still-life-painting×2, fiction-family-secrets×2, sea-otters-kelp-forests×2 |
| SAT Practice Test 7 | 30 | 5 | 4 | 9 | 2 | 13 | 13 | 0 | 5 | stellar-spectroscopy×2, okavango-delta×2, railway-time-standardization×2, bioluminescent-plankton×2 |
| SAT Practice Test 8 | 40 | 6 | 5 | 5 | 2 | 8 | 6 | 2 | 7 | fiction-lighthouse-keeper×2, bridge-engineering×2, 3d-printed-bridge×2, fiction-domestic-anticipation×1 |
| SAT Practice Test 9 | 35 | 6 | 6 | 8 | 4 | 12 | 4 | 1 | 5 | sea-otters-kelp-forests×2, fast-radio-bursts×2, railway-time-standardization×2, hydrothermal-vent-ecosystems×2 |
| SAT Practice Test 10 | 18 | 10 | 10 | 9 | 7 | 9 | 6 | 7 | 5 | fiction-coming-of-age×1, fiction-gothic-mystery×1, apartheid×1, fiction-estranged-father-daughter×1 |
| SAT Practice Test 11 | 18 | 11 | 11 | 9 | 6 | 8 | 5 | 7 | 6 | self-efficacy×1, public-libraries×1, desert-plant-adaptation×1, fiction-village-mystery×1 |
| SAT Practice Test 12 | 18 | 11 | 11 | 8 | 7 | 9 | 6 | 7 | 4 | emotional-labor×2, fish-ladder-engineering×1, optical-lens-patents×1, bordeaux-wine-ranking×1 |
| SAT Practice Test 13 | 18 | 12 | 9 | 9 | 7 | 8 | 6 | 7 | 5 | tidal-river-management×2, public-libraries×2, cleaner-wrasse×2, boat-lifts×1 |

## 4. 남은 위반과 이유

- 없음

## 5. 목표 과목 구성을 위한 추가 생성 필요량 (R&W)

전제: 13세트 R&W 문항 2106건, 과목별 하한 = (목표% - 2pp) x 칸 수요. 공급 = 최종 계획에 쓰인 문항 + 남은 미사용 재고(분류된 것만). 칸 단위로 부족분을 계산하고 과목별 합계만 올림한다. 생성된 문항은 과다 과목(문학 등) 문항을 대체한다.

허용오차 민감도(추가 생성 총량): 0pp → 514건, 2pp → 313건, 4pp → 167건, 6pp → 86건.

**칸 단위 추정 총 313건** — 채택 기준 $0.22/건 ≈ $68.86, hard 비중이 높으면 $0.5/건 ≈ $156.5.

과목별(칸 단위 합계):

| 과목 | 추가 생성 | 전역 하한 | 전역 공급 | 전역 부족 |
|---|---|---|---|---|
| literature_fiction | 111 | 421 | 713 | 0 |
| humanities | 35 | 252 | 272 | 0 |
| social_science | 35 | 231 | 223 | 8 |
| history_civics | 22 | 210 | 249 | 0 |
| economics_business | 18 | 126 | 144 | 0 |
| science_life | 19 | 189 | 307 | 0 |
| science_earth_space | 21 | 105 | 147 | 0 |
| science_physical | 41 | 126 | 104 | 22 |
| technology | 11 | 63 | 142 | 0 |

skill x 난이도 칸별 추가 생성 (상위 40; 전체는 shortfall.json):

| 칸 | 수요 | 추가 | 과목별 |
|---|---|---|---|
| central_ideas_details|medium | 314 | 93 | humanities 18, social_science 15, history_civics 11, economics_business 10, science_life 12, science_earth_space 11, science_physical 14, technology 5 |
| text_structure_purpose|medium | 194 | 37 | humanities 5, social_science 9, history_civics 5, economics_business 4, science_life 5, science_earth_space 3, science_physical 7, technology 2 |
| boundaries|medium | 195 | 25 | literature_fiction 20, humanities 4, social_science 1, science_physical 1 |
| form_structure_sense|medium | 195 | 20 | literature_fiction 20 |
| rhetorical_synthesis|medium | 117 | 17 | literature_fiction 13, social_science 1, economics_business 1, science_physical 4 |
| transitions|medium | 117 | 17 | literature_fiction 16, social_science 1 |
| boundaries|easy | 52 | 8 | literature_fiction 6, humanities 3, history_civics 1 |
| words_in_context|medium | 171 | 8 | history_civics 2, science_physical 7 |
| text_structure_purpose|easy | 67 | 6 | humanities 1, social_science 2, economics_business 2, science_earth_space 3, science_physical 2, technology 1 |
| form_structure_sense|easy | 52 | 6 | literature_fiction 6, science_physical 1 |
| cross_text_connections|easy | 22 | 6 | literature_fiction 4, humanities 1, science_physical 2 |
| transitions|easy | 52 | 6 | literature_fiction 6 |
| inferences|easy | 34 | 6 | literature_fiction 4, humanities 2, social_science 1, science_physical 1 |
| rhetorical_synthesis|easy | 52 | 5 | literature_fiction 4, social_science 1, economics_business 1 |
| command_of_evidence_quant|medium | 11 | 5 | literature_fiction 3, humanities 2, social_science 1, history_civics 2 |
| rhetorical_synthesis|hard | 26 | 5 | literature_fiction 1, humanities 2, social_science 2, economics_business 1, science_physical 1 |
| transitions|hard | 26 | 5 | literature_fiction 3, history_civics 1, economics_business 1, science_earth_space 1, science_physical 1, technology 1 |
| words_in_context|easy | 67 | 4 | humanities 1, social_science 2, economics_business 1, science_life 2, science_earth_space 1, science_physical 2 |
| inferences|medium | 27 | 4 | literature_fiction 2, economics_business 1, science_earth_space 1, science_physical 1, technology 1 |
| inferences|hard | 16 | 4 | literature_fiction 2, science_earth_space 1, science_physical 1, technology 1 |
| command_of_evidence_text|easy | 24 | 4 | literature_fiction 3, science_earth_space 2 |
| cross_text_connections|medium | 25 | 3 | literature_fiction 1, social_science 1, science_earth_space 1, science_physical 1 |
| command_of_evidence_text|medium | 38 | 3 | literature_fiction 3 |
| command_of_evidence_quant|easy | 6 | 3 | literature_fiction 2, history_civics 1, science_physical 1, technology 1 |
| boundaries|hard | 26 | 3 | social_science 1, history_civics 2, science_earth_space 1 |
| form_structure_sense|hard | 26 | 3 | economics_business 1, science_life 1, science_physical 1, technology 1 |
| text_structure_purpose|hard | 26 | 3 | humanities 2, history_civics 1, economics_business 1, science_life 1 |
| words_in_context|hard | 26 | 3 | humanities 2, science_life 1, science_physical 1 |
| cross_text_connections|hard | 26 | 3 | literature_fiction 1, science_earth_space 1, science_physical 2 |
| command_of_evidence_quant|hard | 3 | 3 | literature_fiction 1, humanities 1, social_science 1, history_civics 1, economics_business 1, science_physical 1, technology 1 |
| central_ideas_details|easy | 40 | 2 | social_science 1, science_life 1, technology 1 |
| central_ideas_details|hard | 16 | 2 | social_science 1, history_civics 1, technology 1 |
| command_of_evidence_text|hard | 17 | 1 | humanities 1, science_earth_space 1 |

## 6. 적용 순서 제안(총괄)

1. 다른 에이전트의 R&W 수정 버전이 들어온 뒤 새 덤프로 같은 명령 재실행 2. `set-copies.json` 각 항목: `<name> (new)` 초안 사본 생성 → `mock_exam_validate_mst_set`·`mock_exam_set_item_issues` 검증 → 옛 세트 보관 → 사본 free 게시 3. `new-sets.json` 으로 T10~ 신규 세트 생성. 모든 단계는 이 보고서 범위 밖(원격 쓰기 없음).
