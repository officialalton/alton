# R&W 지문 소재 다양성 점검 (2026-10-08)

생성: `scripts/mock-exam-generation/rw-topics.ts` (모델 claude-haiku-4-5, LLM 지출 $1.35, 호출 64회). 원본 분류: `data/mock-exam-generation/rw-topics-20261008/topics.json`.

대상: 확정·미보관 R&W 문항의 고유 지문 1460개(문항 1472건). 상한 기준: 모듈당 같은 소재 1, 응시 경로(M1+M2)당 2, 넓은 소재(family)당 4.

## 1. 과목 분포 (은행 고유 지문)

| 과목 | 지문 수 | 비율 | 목표 |
|---|---|---|---|
| literature_fiction | 598 | 41% | 22% |
| humanities | 158 | 11% | 14% |
| social_science | 49 | 3% | 13% |
| history_civics | 136 | 9% | 12% |
| economics_business | 83 | 6% | 8% |
| science_life | 266 | 18% | 11% |
| science_earth_space | 102 | 7% | 7% |
| science_physical | 11 | 1% | 8% |
| technology | 57 | 4% | 5% |

## 2. 소재(cluster) 빈도 — 은행 전체 (고유 cluster 738개, 상위 40)

| cluster | 지문 수 |
|---|---|
| cephalopods | 38 |
| bus-rapid-transit | 25 |
| bioluminescent-plankton | 24 |
| coral-reefs | 21 |
| exoplanet-detection | 20 |
| carnivorous-plants | 19 |
| dutch-still-life-painting | 18 |
| desert-plant-adaptation | 16 |
| induced-demand-traffic | 15 |
| hydrothermal-vent-ecosystems | 14 |
| streetcar-systems | 14 |
| renaissance-workshop-practices | 12 |
| urban-highway-removal | 12 |
| textile-industry-decline | 11 |
| fast-radio-bursts | 11 |
| judith-leyster | 11 |
| deep-sea-anglerfish | 11 |
| sea-otters-kelp-forests | 10 |
| fiction-musical-partnership | 10 |
| fiction-family-secrets | 10 |
| transit-planning | 10 |
| fiction-apprenticeship | 9 |
| dwarf-planets | 9 |
| vermeer-painting | 9 |
| congestion-pricing | 9 |
| tulip-mania | 9 |
| fiction-reconciliation | 9 |
| plant-growth | 8 |
| medieval-trade-fairs | 8 |
| public-libraries-act | 8 |
| bridge-engineering | 8 |
| mangrove-forests | 7 |
| corpse-flower | 7 |
| fiction-rival-bakers | 7 |
| okavango-delta | 7 |
| fiction-estranged-sisters | 7 |
| fiction-reunion | 7 |
| dutch-golden-age-painting | 6 |
| railway-time-standardization | 6 |
| artemisia-gentileschi | 6 |

## 3. 넓은 소재(family) 빈도 (고유 84개, 상위 25)

| family | 지문 수 |
|---|---|
| family-relationships | 176 |
| marine-life | 106 |
| art-history | 105 |
| urban-planning | 73 |
| grief-and-memory | 39 |
| literature | 38 |
| fiction | 34 |
| engineering | 34 |
| astronomy | 33 |
| labor-history | 32 |
| coming-of-age | 32 |
| animal-behavior | 32 |
| plant-biology | 32 |
| urban-transportation | 28 |
| social-commentary | 27 |
| craft-tradition | 24 |
| trade-history | 24 |
| work-relationships | 23 |
| financial-history | 21 |
| music | 20 |
| linguistics | 20 |
| planetary-science | 20 |
| community | 18 |
| plant-ecology | 18 |
| adventure | 17 |

## 4. 과다 대표 소재 (cluster > 12, family > 44)

cluster: cephalopods(38), bus-rapid-transit(25), bioluminescent-plankton(24), coral-reefs(21), exoplanet-detection(20), carnivorous-plants(19), dutch-still-life-painting(18), desert-plant-adaptation(16), induced-demand-traffic(15), hydrothermal-vent-ecosystems(14), streetcar-systems(14)

family: marine-life(106), art-history(104), urban-planning(72)

## 5. 게시 세트별 소재

| 세트 | R&W 문항 | 고유 cluster | 경로당 최대 반복(cluster) | 상한 위반 수 | cephalopods | bus-rapid-transit | bioluminescent-plankton | coral-reefs | exoplanet-detection |
|---|---|---|---|---|---|---|---|---|---|
| SAT Practice Test 1 | 81 | 61 | 6 | 14 | 7 | 2 | 4 | 2 | 1 |
| SAT Practice Test 2 | 81 | 67 | 4 | 9 | 2 | 4 | 3 | 0 | 2 |
| SAT Practice Test 3 | 81 | 66 | 4 | 13 | 1 | 6 | 4 | 3 | 2 |
| SAT Practice Test 4 | 81 | 74 | 2 | 3 | 0 | 0 | 0 | 0 | 0 |
| SAT Practice Test 5 | 81 | 71 | 2 | 2 | 1 | 0 | 0 | 2 | 0 |
| SAT Practice Test 6 | 81 | 71 | 3 | 4 | 2 | 3 | 1 | 0 | 0 |
| SAT Practice Test 7 | 81 | 73 | 2 | 3 | 2 | 0 | 2 | 0 | 1 |
| SAT Practice Test 8 | 81 | 72 | 2 | 5 | 0 | 1 | 0 | 0 | 1 |
| SAT Practice Test 9 | 81 | 71 | 2 | 3 | 2 | 1 | 0 | 0 | 0 |

### 과목 구성 (경로 54문항 기준 = 저장 81문항 비율; 목표 대비 편차 pp)

| 세트 | literature_fiction | humanities | social_science | history_civics | economics_business | science_life | science_earth_space | science_physical | technology |
|---|---|---|---|---|---|---|---|---|---|
| SAT Practice Test 1 | 19 (+1) | 10 (-2) | 1 (-12) | 8 (-2) | 9 (+3) | 25 (+20) | 6 (+0) | 0 (-8) | 3 (-1) |
| SAT Practice Test 2 | 19 (+1) | 17 (+7) | 3 (-9) | 7 (-3) | 8 (+2) | 18 (+11) | 5 (-1) | 1 (-7) | 3 (-1) |
| SAT Practice Test 3 | 19 (+1) | 11 (-0) | 2 (-11) | 4 (-7) | 8 (+2) | 26 (+21) | 6 (+0) | 1 (-7) | 4 (-0) |
| SAT Practice Test 4 | 31 (+16) | 6 (-7) | 3 (-9) | 13 (+4) | 2 (-6) | 13 (+5) | 6 (+0) | 0 (-8) | 7 (+4) |
| SAT Practice Test 5 | 33 (+19) | 8 (-4) | 2 (-11) | 8 (-2) | 1 (-7) | 14 (+6) | 11 (+7) | 0 (-8) | 4 (-0) |
| SAT Practice Test 6 | 30 (+15) | 13 (+2) | 5 (-7) | 9 (-1) | 2 (-6) | 14 (+6) | 3 (-3) | 0 (-8) | 5 (+1) |
| SAT Practice Test 7 | 31 (+16) | 4 (-9) | 2 (-11) | 10 (+0) | 2 (-6) | 14 (+6) | 13 (+9) | 0 (-8) | 5 (+1) |
| SAT Practice Test 8 | 41 (+29) | 6 (-7) | 4 (-8) | 5 (-6) | 2 (-6) | 9 (+0) | 7 (+2) | 0 (-8) | 7 (+4) |
| SAT Practice Test 9 | 35 (+21) | 5 (-8) | 4 (-8) | 10 (+0) | 4 (-3) | 13 (+5) | 4 (-2) | 0 (-8) | 6 (+2) |

### 상한 위반 상세 (cluster)

- **SAT Practice Test 1**: cephalopods ×4 (rw_m1/-), tulip-mania ×2 (rw_m2/lower), bioluminescent-plankton ×3 (rw_m2/higher), cephalopods ×2 (rw_m2/higher), streetcar-systems ×2 (rw_m2/higher), cephalopods ×5 (path:lower), cephalopods ×6 (path:higher), streetcar-systems ×3 (path:higher), bioluminescent-plankton ×3 (path:higher)
- **SAT Practice Test 2**: bus-rapid-transit ×3 (rw_m1/-), textile-industry-decline ×2 (rw_m2/lower), bus-rapid-transit ×3 (path:lower), textile-industry-decline ×3 (path:lower), bus-rapid-transit ×4 (path:higher)
- **SAT Practice Test 3**: bioluminescent-plankton ×2 (rw_m1/-), bus-rapid-transit ×2 (rw_m2/lower), variable-stars ×2 (rw_m2/lower), coral-reefs ×2 (rw_m2/lower), hydrothermal-vent-ecosystems ×2 (rw_m2/higher), bus-rapid-transit ×3 (rw_m2/higher), bioluminescent-plankton ×2 (rw_m2/higher), bus-rapid-transit ×3 (path:lower), bus-rapid-transit ×4 (path:higher), bioluminescent-plankton ×4 (path:higher)
- **SAT Practice Test 4**: ynes-mexia ×2 (rw_m2/lower), mechanics-institutes ×2 (rw_m2/lower), induced-demand-traffic ×2 (rw_m2/higher)
- **SAT Practice Test 5**: fiction-translation-ethics ×2 (rw_m2/higher), coral-reefs ×2 (rw_m2/higher)
- **SAT Practice Test 6**: bus-rapid-transit ×2 (rw_m2/lower), dutch-still-life-painting ×2 (rw_m2/higher), dutch-still-life-painting ×3 (path:higher)
- **SAT Practice Test 7**: fiction-hidden-letters ×2 (rw_m2/lower)
- **SAT Practice Test 8**: fast-radio-bursts ×2 (rw_m1/-), fiction-reunion ×2 (rw_m1/-), penny-post-reform ×2 (rw_m2/lower), fiction-estranged-sisters ×2 (rw_m2/higher)
- **SAT Practice Test 9**: ynes-mexia ×2 (rw_m1/-), literary-analysis ×2 (rw_m2/lower), penny-post-reform ×2 (rw_m2/higher)

## 6. 같은 지문 텍스트를 쓰는 문항 (근접 중복)

고유 지문 중 2개 이상 문항이 같은 텍스트를 가진 것: 0건 (문항 0건).

게시 세트에서 같은 지문이 두 번 이상 노출되는 경우: 0건.

| 지문 해시 | cluster | 문항 수 | 게시 세트 |
|---|---|---|---|

단어 4-gram 자카드 0.35 이상인 근접 중복 쌍(같은 family 안): 3건.

- 1ab4656c / 9c0e6244 (fast-radio-bursts) J=0.45, 게시 세트: T7, T4
- 0dfb2407 / b0a7b108 (lina-bo-bardi) J=0.43, 게시 세트: T5, T4
- 92bdadff / b0a7b108 (lina-bo-bardi) J=0.40, 게시 세트: T8, T4

## 7. 보수 계획 요약 (적용 금지 — 계획만)

상한: 모듈당 1, 응시 경로당 2, 비문학 family 경로당 4. 계획 파일: `data/mock-exam-generation/rw-topics-20261008/repair-plan.json` (교체 후보는 게시 세트 어디에도 안 쓰인 확정 문항, 같은 영역·난이도·형식, 같은 skill 우선·없을 때만 skill fallback).

| 세트 | 위반(전→후) | 교체 수 | skill fallback | 남은 위반(재고 부족) |
|---|---|---|---|---|
| SAT Practice Test 1 | 14 → 3 | 13 | 8 | cephalopods ×2 (rw_m1/-); bioluminescent-plankton ×3 (rw_m2/higher); bioluminescent-plankton ×3 (path:higher) |
| SAT Practice Test 2 | 9 → 3 | 10 | 7 | bus-rapid-transit ×2 (rw_m1/-); art-history ×6 (path:lower); bus-rapid-transit ×3 (path:higher) |
| SAT Practice Test 3 | 13 → 6 | 9 | 5 | bioluminescent-plankton ×2 (rw_m1/-); bioluminescent-plankton ×2 (rw_m2/higher); bus-rapid-transit ×2 (rw_m2/higher); bus-rapid-transit ×3 (path:higher); bioluminescent-plankton ×4 (path:higher); marine-life ×5 (path:higher) |
| SAT Practice Test 4 | 3 → 2 | 1 | 0 | ynes-mexia ×2 (rw_m2/lower); mechanics-institutes ×2 (rw_m2/lower) |
| SAT Practice Test 5 | 2 → 0 | 2 | 1 | - |
| SAT Practice Test 6 | 4 → 0 | 2 | 1 | - |
| SAT Practice Test 7 | 3 → 1 | 2 | 1 | engineering ×5 (path:higher) |
| SAT Practice Test 8 | 5 → 3 | 2 | 0 | fast-radio-bursts ×2 (rw_m1/-); penny-post-reform ×2 (rw_m2/lower); engineering ×5 (path:higher) |
| SAT Practice Test 9 | 3 → 3 | 0 | 0 | ynes-mexia ×2 (rw_m1/-); literary-analysis ×2 (rw_m2/lower); penny-post-reform ×2 (rw_m2/higher) |

남은 위반은 같은 (영역, skill, 난이도, 형식) 칸의 미사용 재고가 없어 생긴다 — rw-stock 생성분(회피 목록 적용)이 들어오면 같은 명령으로 다시 계획한다.

## 8. 목표 과목 구성 제안

College Board digital SAT R&W 지문은 문학·역사/사회·인문·과학이 대체로 비슷한 비중이다. 이를 세부 과목으로 나눈 제안값(합 100%):

| 과목 | 목표 |
|---|---|
| literature_fiction | 22% |
| humanities | 14% |
| social_science | 13% |
| history_civics | 12% |
| economics_business | 8% |
| science_life | 11% |
| science_earth_space | 7% |
| science_physical | 8% |
| technology | 5% |

은행 재고 자체가 문학 41%·사회과학 3%·물리/화학 1%로 치우쳐 있어 조립만으로는 목표에 닿지 않는다(조립기는 소프트 목표로 가까운 쪽을 고른다). 생성 쪽에서 social_science·science_physical·economics_business 지문을 우선 채워야 한다.
