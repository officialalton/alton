# SAT Practice Test 1..13 통합 재조정 (dry-run, 2026-10-08)

생성: `scripts/mock-exam-generation/rebalance-sets.ts` (DB 접근 없음, 원격 쓰기 없음). 덤프: remote non-prod read-only dump 2026-10-08 (problems 6002 / sets 30). LLM 지출(이번 세션 R&W 신규 지문 재분류+라벨 병합) 약 $0.52, 누적 장부 $1.88 (rw-topics-20261008/ledger.json).

상한: 모듈당 cluster 1, 54문항 경로당 2, 비문학 family 4. 유사문항 그룹 공유 <= 15. 게시 세트 9개(T1, T2, T3, T4, T5, T6, T7, T8, T9), 새 세트 요청 4개(T10~), 계획 3개.

## 1. 교체 요약

총 48건 교체 (사유: archived_problem 1, topic_cap 47). skill fallback 10건, 교체 불가 0건. 현재 게시 버전으로 갱신된 문항 4건.

| 세트 | 교체 수 | 사유 | skill fallback | 교체 불가 | 소재 위반(전→후) |
|---|---|---|---|---|---|
| SAT Practice Test 1 | 13 | archived_problem:1 topic_cap:12 | 3 | 0 | 15 → 0 |
| SAT Practice Test 2 | 10 | topic_cap:10 | 1 | 0 | 9 → 0 |
| SAT Practice Test 3 | 13 | topic_cap:13 | 4 | 0 | 13 → 0 |
| SAT Practice Test 4 | 3 | topic_cap:3 | 0 | 0 | 3 → 0 |
| SAT Practice Test 5 | 2 | topic_cap:2 | 1 | 0 | 2 → 0 |
| SAT Practice Test 6 | 2 | topic_cap:2 | 1 | 0 | 5 → 0 |
| SAT Practice Test 7 | 2 | topic_cap:2 | 0 | 0 | 2 → 0 |
| SAT Practice Test 8 | 1 | topic_cap:1 | 0 | 0 | 1 → 0 |
| SAT Practice Test 9 | 2 | topic_cap:2 | 0 | 0 | 2 → 0 |

### skill fallback 목록(같은 skill 후보가 하나도 없던 경우)

- SAT Practice Test 1 rw_m1/- #14 rw_information_ideas medium: inferences → central_ideas_details (topic_cap)
- SAT Practice Test 1 rw_m1/- #22 rw_information_ideas medium: command_of_evidence_text → central_ideas_details (topic_cap)
- SAT Practice Test 1 rw_m1/- #4 rw_information_ideas easy: command_of_evidence_quant → central_ideas_details (topic_cap)
- SAT Practice Test 3 rw_m2/higher #64 rw_information_ideas medium: command_of_evidence_text → central_ideas_details (topic_cap)
- SAT Practice Test 3 rw_m1/- #15 rw_information_ideas medium: inferences → central_ideas_details (topic_cap)
- SAT Practice Test 3 rw_m1/- #17 rw_information_ideas medium: inferences → central_ideas_details (topic_cap)
- SAT Practice Test 3 rw_m2/lower #50 rw_craft_structure medium: cross_text_connections → text_structure_purpose (topic_cap)
- SAT Practice Test 2 rw_m1/- #6 rw_information_ideas easy: command_of_evidence_text → central_ideas_details (topic_cap)
- SAT Practice Test 6 rw_m2/lower #35 rw_information_ideas easy: command_of_evidence_quant → central_ideas_details (topic_cap)
- SAT Practice Test 5 rw_m2/higher #77 rw_information_ideas hard: command_of_evidence_quant → central_ideas_details (topic_cap)

### 교체 불가(강제 교체 대상인데 같은 칸 미사용 재고 없음)

- 없음

## 2. 컬렉션 검증

- 전체 세트(수리본+새 세트) 문항 중복 problem: 0건
- 유사문항 그룹 한도 새 위반: 없음; 수리 전부터 넘던 쌍(늘리지 않음): SAT Practice Test 6 / SAT Practice Test 7 share 17 groups (before 17, limit 15)
- 30 skill x 3 난이도 칸 누락: 없음
- 새 세트 조립 실패: 없음; 소재 상한 완화로 들어간 새 세트 문항 0건
- 재고: 시작 미사용 2924 → 남음 2435. 미분류(소재 없음) R&W 재고 0건(소재 제약 계산에서 제외 또는 무제한 취급).

새 세트 요청 수 기준 칸 부족:

| 영역 | 난이도 | 형식 | 수요 | 공급 | 부족 |
|---|---|---|---|---|---|
| rw_expression_ideas | easy | any | 16 | 12 | 4 |
| rw_expression_ideas | medium | any | 36 | 29 | 7 |
| rw_standard_english | easy | any | 16 | 13 | 3 |
| rw_standard_english | medium | any | 60 | 46 | 14 |

## 3. 세트별 R&W 과목 구성과 상위 소재 (최종)

| 세트 | 종류 | literature fiction | humanities | social science | history civics | economics business | science life | science earth_space | science physical | technology | 상위 cluster | 위반 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SAT Practice Test 1 | copy | 19 (23%) | 8 (10%) | 6 (7%) | 10 (12%) | 8 (10%) | 18 (22%) | 7 (9%) | 1 (1%) | 4 (5%) | antikythera-mechanism×3, cephalopods×3, congestion-pricing×2, coral-reefs×2 | 0 |
| SAT Practice Test 2 | copy | 21 (26%) | 11 (14%) | 5 (6%) | 9 (11%) | 7 (9%) | 17 (21%) | 7 (9%) | 1 (1%) | 3 (4%) | carnivorous-plants×3, exoplanet-detection×2, cephalopods×2, public-libraries×2 | 0 |
| SAT Practice Test 3 | copy | 22 (27%) | 10 (12%) | 4 (5%) | 9 (11%) | 6 (7%) | 19 (23%) | 6 (7%) | 1 (1%) | 4 (5%) | railway-time-standardization×2, exoplanet-detection×2, whistled-languages×2, carnivorous-plants×2 | 0 |
| SAT Practice Test 4 | copy | 31 (38%) | 7 (9%) | 4 (5%) | 12 (15%) | 1 (1%) | 12 (15%) | 7 (9%) | 0 (0%) | 7 (9%) | sea-otters-kelp-forests×2, coqui-frog×2, desert-plant-adaptation×2, fiction-loss-of-faith×1 | 0 |
| SAT Practice Test 5 | copy | 32 (40%) | 8 (10%) | 2 (2%) | 8 (10%) | 2 (2%) | 14 (17%) | 10 (12%) | 0 (0%) | 5 (6%) | public-libraries×2, dutch-still-life-painting×2, suspension-bridge-engineering×2, carnivorous-plants×2 | 0 |
| SAT Practice Test 6 | copy | 30 (37%) | 12 (15%) | 5 (6%) | 9 (11%) | 2 (2%) | 14 (17%) | 4 (5%) | 0 (0%) | 5 (6%) | whistled-languages×3, cephalopods×2, dutch-still-life-painting×2, fiction-family-secrets×2 | 0 |
| SAT Practice Test 7 | copy | 30 (37%) | 5 (6%) | 2 (2%) | 10 (12%) | 3 (4%) | 13 (16%) | 13 (16%) | 0 (0%) | 5 (6%) | stellar-spectroscopy×2, okavango-delta×2, railway-time-standardization×2, bioluminescent-plankton×2 | 0 |
| SAT Practice Test 8 | copy | 40 (49%) | 7 (9%) | 4 (5%) | 5 (6%) | 2 (2%) | 9 (11%) | 7 (9%) | 0 (0%) | 7 (9%) | desert-plant-adaptation×2, fiction-lighthouse-keeper×2, bridge-engineering×2, 3d-printed-bridge×2 | 0 |
| SAT Practice Test 9 | copy | 35 (43%) | 5 (6%) | 4 (5%) | 9 (11%) | 4 (5%) | 13 (16%) | 5 (6%) | 0 (0%) | 6 (7%) | sea-otters-kelp-forests×2, fast-radio-bursts×2, railway-time-standardization×2, hydrothermal-vent-ecosystems×2 | 0 |
| SAT Practice Test 10 | new | 28 (35%) | 10 (12%) | 3 (4%) | 8 (10%) | 3 (4%) | 13 (16%) | 6 (7%) | 2 (2%) | 8 (10%) | cephalopods×2, boat-lifts×2, bombardier-beetles×2, fiction-labor-resistance×2 | 0 |
| SAT Practice Test 11 | new | 35 (43%) | 8 (10%) | 5 (6%) | 6 (7%) | 2 (2%) | 14 (17%) | 6 (7%) | 0 (0%) | 5 (6%) | okavango-delta×2, atacama-desert×1, fiction-coming-of-age×1, public-libraries×1 | 0 |
| SAT Practice Test 12 | new | 41 (51%) | 9 (11%) | 3 (4%) | 4 (5%) | 3 (4%) | 13 (16%) | 4 (5%) | 0 (0%) | 4 (5%) | fiction-victorian-pastiche×2, ceramic-art×2, fiction-ferry-terminal-dignity×2, public-libraries×1 | 0 |

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

전제: 13세트 R&W 문항 972건, 과목별 하한 = (목표% - 2pp) x 칸 수요. 공급 = 최종 계획에 쓰인 문항 + 남은 미사용 재고(분류된 것만). 칸 단위로 부족분을 계산하고 과목별 합계만 올림한다. 생성된 문항은 과다 과목(문학 등) 문항을 대체한다.

허용오차 민감도(추가 생성 총량): 0pp → 451건, 2pp → 337건, 4pp → 237건, 6pp → 152건.

**칸 단위 추정 총 337건** — 채택 기준 $0.22/건 ≈ $74.14, hard 비중이 높으면 $0.5/건 ≈ $168.5.

과목별(칸 단위 합계):

| 과목 | 추가 생성 | 전역 하한 | 전역 공급 | 전역 부족 |
|---|---|---|---|---|
| literature_fiction | 66 | 194 | 613 | 0 |
| humanities | 44 | 116 | 107 | 9 |
| social_science | 67 | 106 | 47 | 59 |
| history_civics | 29 | 97 | 108 | 0 |
| economics_business | 30 | 58 | 47 | 11 |
| science_life | 15 | 87 | 176 | 0 |
| science_earth_space | 17 | 48 | 82 | 0 |
| science_physical | 55 | 58 | 5 | 53 |
| technology | 14 | 29 | 63 | 0 |

skill x 난이도 칸별 추가 생성 (상위 40; 전체는 shortfall.json):

| 칸 | 수요 | 추가 | 과목별 |
|---|---|---|---|
| central_ideas_details|medium | 147 | 79 | humanities 15, social_science 17, history_civics 13, economics_business 8, science_life 8, science_earth_space 7, science_physical 9, technology 5 |
| text_structure_purpose|medium | 108 | 48 | humanities 10, social_science 11, history_civics 8, economics_business 6, science_life 4, science_earth_space 3, science_physical 7, technology 2 |
| boundaries|medium | 90 | 30 | literature_fiction 7, humanities 5, social_science 9, economics_business 4, science_physical 6 |
| words_in_context|medium | 64 | 19 | humanities 1, social_science 7, history_civics 3, economics_business 3, science_earth_space 2, science_physical 4, technology 2 |
| transitions|medium | 50 | 19 | literature_fiction 9, humanities 3, social_science 4, science_physical 3 |
| form_structure_sense|medium | 90 | 18 | literature_fiction 11, history_civics 1, science_physical 6 |
| rhetorical_synthesis|medium | 58 | 11 | literature_fiction 7, social_science 2, economics_business 1, science_physical 3 |
| text_structure_purpose|easy | 34 | 9 | social_science 3, economics_business 3, science_earth_space 1, science_physical 3, technology 2 |
| boundaries|easy | 24 | 8 | literature_fiction 2, humanities 2, social_science 3, science_physical 2 |
| rhetorical_synthesis|easy | 24 | 8 | literature_fiction 3, social_science 3, economics_business 1, science_physical 2 |
| central_ideas_details|easy | 33 | 7 | science_life 2, science_earth_space 2, science_physical 2, technology 1 |
| transitions|easy | 24 | 7 | humanities 3, social_science 2, science_earth_space 1, science_physical 2 |
| rhetorical_synthesis|hard | 13 | 7 | literature_fiction 3, humanities 1, social_science 1, history_civics 1, economics_business 1, science_earth_space 1, science_physical 1 |
| form_structure_sense|easy | 24 | 6 | literature_fiction 2, social_science 1, economics_business 2, science_physical 2 |
| boundaries|hard | 12 | 6 | literature_fiction 3, social_science 2, history_civics 1, economics_business 1, science_physical 1 |
| transitions|hard | 11 | 6 | literature_fiction 3, humanities 1, social_science 2, history_civics 1, economics_business 1, science_physical 1, technology 1 |
| command_of_evidence_text|medium | 14 | 5 | literature_fiction 3, history_civics 1, science_physical 1, technology 1 |
| command_of_evidence_quant|medium | 11 | 5 | literature_fiction 3, humanities 2, social_science 1, history_civics 2 |
| words_in_context|hard | 12 | 5 | humanities 1, social_science 2, economics_business 1, science_life 1, science_earth_space 1, science_physical 1, technology 1 |
| command_of_evidence_text|hard | 9 | 5 | literature_fiction 2, social_science 1, economics_business 1, science_earth_space 1, science_physical 1, technology 1 |
| words_in_context|easy | 35 | 4 | history_civics 1, economics_business 2, science_life 1, science_earth_space 1, science_physical 2, technology 1 |
| cross_text_connections|medium | 8 | 4 | literature_fiction 2, social_science 1, science_earth_space 1, science_physical 1, technology 1 |
| inferences|medium | 8 | 4 | literature_fiction 2, social_science 1, economics_business 1, science_physical 1, technology 1 |
| central_ideas_details|hard | 9 | 4 | social_science 1, science_life 1, science_earth_space 1, science_physical 1, technology 1 |
| form_structure_sense|hard | 12 | 4 | literature_fiction 3, science_earth_space 1, technology 1 |
| command_of_evidence_quant|easy | 4 | 3 | literature_fiction 1, humanities 1, social_science 1, history_civics 1, science_physical 1, technology 1 |
| inferences|hard | 4 | 3 | literature_fiction 1, humanities 1, economics_business 1, science_earth_space 1, science_physical 1, technology 1 |
| text_structure_purpose|hard | 16 | 3 | humanities 1, science_physical 1, technology 1 |
| cross_text_connections|hard | 8 | 3 | literature_fiction 2, economics_business 1, science_physical 1, technology 1 |
| inferences|easy | 6 | 3 | literature_fiction 2, history_civics 1, science_life 1, science_physical 1, technology 1 |
| command_of_evidence_text|easy | 5 | 3 | literature_fiction 1, humanities 1, history_civics 1, science_earth_space 1, science_physical 1 |
| cross_text_connections|easy | 3 | 2 | literature_fiction 1, humanities 1, social_science 1, history_civics 1, science_physical 1, technology 1 |
| command_of_evidence_quant|hard | 2 | 2 | literature_fiction 1, humanities 1, social_science 1, history_civics 1, economics_business 1, science_earth_space 1, science_physical 1, technology 1 |

## 6. 적용 순서 제안(총괄)

1. 다른 에이전트의 R&W 수정 버전이 들어온 뒤 새 덤프로 같은 명령 재실행 2. `set-copies.json` 각 항목: `<name> (new)` 초안 사본 생성 → `mock_exam_validate_mst_set`·`mock_exam_set_item_issues` 검증 → 옛 세트 보관 → 사본 free 게시 3. `new-sets.json` 으로 T10~ 신규 세트 생성. 모든 단계는 이 보고서 범위 밖(원격 쓰기 없음).
