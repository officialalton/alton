# 2026-10-01 수학 원형 C 담당 — percentages·area_volume·circles hard 원형과 5개 skill easy/medium 원형

작성: 하위 에이전트(수학 원형 C). 브랜치 `feat/math-archetypes-C`(worktree `~/Developer/ALTON-worktrees/math-archetypes-C`, 베이스 `feat/math-hard-compilers 344e8c01`). **DB·원격·배포·유료 API·supabase 명령 사용 0**, 마이그레이션 없음. 공용 문서 `docs/qa/2026-09-30-math-hard-archetypes.md`는 수정하지 않았다.

## 1. 결론

- **담당 범위 전부 완료.** hard 원형 72개(percentages 20·area_volume 24·circles 28 = 세부 패턴 18개 × 연산자 4, 세부 패턴마다 연산자 4개가 모두 다르고 풀이 5단계 이상·결합 개념 2개 이상·4자리 숫자 지문 없음)와 easy/medium 원형(lite) 46개 틀(percentages 10·area_volume 12·circles 14·ratios_rates_units 4·probability 6, 틀마다 easy·medium 모두 생산)을 같은 프레임워크 위에 구현했다.
- **5,000 시드 스윕(최종 코드)**: 원형·난이도 164칸 × 5,000 = 820,000 시드에서 생성 816,147건, **정답 재계산 불일치 0·선지 값 겹침 0·표기 위반 0·검증 실패 0·생성 예외 0**(생성 거부 GenFail 는 제약을 못 맞춘 표집이라 시드 재표집으로 흡수). 개발 중 의미 검사가 잡아낸 실제 모호성: 소재 이름 "picnic area" 의 area(수량 명사 충돌), "raised garden bed" 의 raised(증가 방향어 충돌), 같은 수가 백분율과 일반 수로 겹친 경우 — 모두 소재명·문장을 고쳐 0 으로 만들었다.
- **의미 일치 기계 검사** 신설(`c-kit.ts`): 지문에 인쇄한 핵심 수치마다 수량 명사(반지름·지름·둘레·넓이·부피·길이·너비·높이·증가·감소 등)를 선언하고, 그 수와 가장 가까운 명사가 선언과 다르면 생성 단계에서 예외로 막는다. 질문이 구하는 양 외의 다른 양의 명사(예: 넓이를 묻는데 둘레)를 섞어도 막는다. 의미 불일치 돌연변이(명사를 반지름↔지름, 넓이→둘레 등으로 바꿈)를 의도적으로 주입하면 검사가 잡는지 테스트한다.
- **생산 가능 수량은 필요량을 크게 넘는다**(5절). easy+medium 그룹 부족은 원형 틀 하나가 새 유사문항 그룹이 되는 구조로 해소된다(6절).
- **모델 보조 문구 미사용**(예산 US$2.5 중 사용 0): 결정론 검증을 통과하는 문장 틀을 직접 작성했다.

## 2. 구조와 파일

| 경로 | 역할 |
|---|---|
| `lib/problem-generation/math-archetypes/skills/percentages.ts` | percentages hard 20 + lite 10 |
| `.../skills/area-volume.ts` | area_volume hard 24 + lite 12 |
| `.../skills/circles.ts` | circles hard 28 + lite 14 |
| `.../skills/ratios-rates-units-lite.ts`·`probability-lite.ts` | ratios_rates_units lite 4, probability lite 6 (hard 는 파일럿 그대로) |
| `.../c-lite.ts` | easy/medium 원형 프레임워크: `LiteArchetype`(틀 단위), `generateLite`·`verifyLite`·`sweepLite`·`produceFromLite` |
| `.../c-kit.ts` | π 선지(`piOpt`·`piDiff`), 의미 일치 검사(`sem`·`semanticIssues`), 도입·종결 문장 은행 |
| `.../lite-c.ts` | `LITE_C_ARCHETYPES`(lite 46틀 목록) |
| `.../registry.ts` | hard 3 skill 한 줄씩 등록(`PCT_ARCHETYPES`·`AV_ARCHETYPES`·`CI_ARCHETYPES`) |
| `.../archetypes-c.test.ts` | lite 시드 스윕·재현성, hard·lite 전 원형 돌연변이, 의미 검사기 테스트(360건) |
| `scripts/mock-exam-generation/archetype-c-sweep.ts`·`archetype-c-samples.ts` | 5,000 시드 스윕 CLI, Preview 샘플·생산 가능 수량표 CLI |
| `data/mock-exam-generation/math-archetype-C/` | `samples.tsv`(Preview 확인용 236건 목록), `passed.json`(import 호환 레코드), `supply.json`, `sweep-*.json` |

### easy/medium 원형(lite)의 규약

- 원형 = **문장 틀(frame)**. 한 틀이 easy·medium 두 난이도를 만들고 `(원형 ID, 난이도, 시드)`로 재현된다. 유사문항 그룹 키 = `c:<skill>:<원형ID>/<난이도.변형>`. 틀마다·난이도마다 새 그룹이 된다.
- 검증은 hard 와 같은 공개 게이트(정답 재계산 `verification_js`·선지 값 겹침·표기·checkContent·checkFigure·금칙어·인쇄 상수 확인)에서 **풀이 단계 수 검사만 제외**한다(`verifyLite`).
- 레코드는 `difficulty=easy|medium`, `quality.mockExamGeneration = { difficultyStatus: "confirmed", source: "compiler_archetype_lite", archetypeId, kind, frame, seed, variant, verification }`, `recipeId=null`(기존 컴파일러 easy/medium 과 같은 취급). 도입은 `produceFromLite`.
- 모든 문항은 그림 없이 서술·식만으로 성립한다(`needsFigure=false`, `figure=null`). 기존 컴파일러는 area_volume·circles 에서 그림을 참조("as shown in the figure")하지만 lite·hard 원형은 서술형이다.

### 독립 변형 수와 표현 대안 층(추가 보강 완료)

본문 유사도(숫자 마스킹 3-gram Jaccard 0.6)는 단어가 달라야 낮아진다. 변형을 늘리는 장치는 세 가지다. (1) 맥락 목록·사실 문장 대안(`spin`). (2) 수치와 무관한 도입 30개·종결 30개 중립 문장 은행(`OPEN_NEUTRAL`·`TAILS`). (3) **표현 대안 층**(`paraphraseInst`, 추가 보강): 도입·종결 은행과 수식($…$)을 제외한 본문·질문에 규칙 기반 동의 표현(동사·접속·질문 문형·단위 문장 등 약 100개 규칙, 질문은 문형 5~6종, 독립 사실 문장 순서 바꾸기)을 적용한다. 바꾼 뒤 수량 명사 의미 일치 검사를 **다시** 돌려 어긋나면 예외로 막으므로, 표현을 바꿔도 수치-명사 대응은 유지된다. 모델은 쓰지 않았다(비용 0).

"독립 변형"은 은행을 포함한 값과, **은행 문장을 떼고 수학 틀 본문·질문·선지만으로 센 값(`core`)** 두 가지를 적었다. 은행 문장만 다른 문항이 같은 문제로 보이는 것을 막기 위해 합격 기준은 **`core` 30 이상**으로 올렸다(원형·난이도 164칸 전부 충족, 1,500 시드 표본·상한 400).

은행 제외(`core`) 값 요약: hard 72개 모두 30 이상(중앙값 80.0, 최소 32), lite 92칸 모두 30 이상(중앙값 120.0, 최소 32).

### 유사문항 그룹 키는 구조 변형만 쓴다

그룹 키의 변형 이름은 소재(도구·장소·단위)가 아니라 **풀이 구조 변형**(예: add_water/evaporate, tangent_x/tangent_y/radius, growth/decline, easy·medium 난이도)만 쓴다. 소재 이름을 변형으로 쓰면 같은 틀의 문항이 서로 다른 그룹으로 세어져 세트당 그룹 1문항 규칙을 우회하게 되므로, 대부분의 원형은 변형이 하나(`frame`)이고 그룹 수 = 원형 수(× 난이도)다.

## 3. 진행표

| skill | 세부 패턴 | hard 원형(목표→구현) | lite 틀 | 5,000시드 결과 |
|---|---|---|---|---|
| percentages | 5 | 20/20 완료 | 10 (easy·medium 각 10) | 200,000시드 중 생성 198,349, 검증 실패 0, 예외 0 |
| area_volume | 6 | 24/24 완료 | 12 (easy·medium 각 12) | 240,000시드 중 생성 239,573, 검증 실패 0, 예외 0 |
| circles | 7 | 28/28 완료 | 14 (easy·medium 각 14) | 280,000시드 중 생성 278,227, 검증 실패 0, 예외 0 |
| ratios_rates_units | 2 | 파일럿 8개 유지(변경 없음) | 4 (easy·medium 각 4) | 40,000시드 중 생성 40,000, 검증 실패 0, 예외 0 |
| probability | 3 | 파일럿 12개 유지(변경 없음) | 6 (easy·medium 각 6) | 60,000시드 중 생성 59,998, 검증 실패 0, 예외 0 |

## 4. 원형 목록

### hard 원형 72개(연산자·추가 요구 사고)

| 원형 ID | 연산자 | 추가 요구 사고(medium 대비) | 시드 5,000 생성 | 독립 변형(은행 포함/제외) |
|---|---|---|---|---|
| `pct.percent_of.compose_kind` | compose_kind | 퍼센트 계산을 '변하지 않는 양(용질)' 보존 + 일차방정식과 합성 | 5,000 | 400/183 |
| `pct.percent_of.chain2` | chain2 | 단계마다 기준량이 바뀌는 연쇄 퍼센트와 '나머지(보수)' 처리 | 5,000 | 400/133 |
| `pct.percent_of.inverse` | inverse | 퍼센트의 값이 같다는 조건을 비율 관계로 역산해 비례배분 | 4,994 | 400/34 |
| `pct.percent_of.compare_scenarios` | compare_scenarios | 정률 할인과 정액+정률 할인 두 모델을 세워 같아지는 임계점을 찾음 | 4,253 | 400/145 |
| `pct.find_whole.chain2` | chain2 | 두 번의 감소가 서로 다른 기준량에 적용된 연쇄를 역순으로 풀기 | 5,000 | 400/134 |
| `pct.find_whole.inverse` | inverse | 증가 후 값에서 원래 값을 역산하고 방향을 바꿔 다시 적용(증가·감소가 서로 상쇄되지 않음) | 5,000 | 400/50 |
| `pct.find_whole.unit_ratio` | unit_ratio | 퍼센트 역산에 질량 단위 환산(kg→g)과 보수(성분이 아닌 부분)를 결합 | 4,998 | 400/50 |
| `pct.find_whole.compare_scenarios` | compare_scenarios | 서로 다른 기준량(용량)에 대한 퍼센트가 같은 값이라는 두 경우의 비교를 방정식으로 세움 | 5,000 | 400/68 |
| `pct.percent_change.chain2` | chain2 | 앞 단계에서 구한 변화율이 다음 단계의 조건이 되는 연쇄(두 번째 기준량은 b) | 4,915 | 400/45 |
| `pct.percent_change.inverse` | inverse | 변화량과 변화율에서 원래 값을 역산한 뒤 새 기준량에 다른 퍼센트를 적용 | 5,000 | 400/126 |
| `pct.percent_change.compare_scenarios` | compare_scenarios | 서로 다른 기준량에 대한 증가율과 감소율의 비교(절대 변화량이 아닌 퍼센트포인트 차) | 5,000 | 400/34 |
| `pct.percent_change.unit_ratio` | unit_ratio | 단위당 양(mpg)과 필요량(gallons)이 역수 관계임을 파악해 변화율을 구함 | 5,000 | 400/81 |
| `pct.find_percent.inverse` | inverse | 목표 퍼센트에서 필요한 개수를 거꾸로 구하고 가능 범위(≤m)를 확인 | 5,000 | 400/178 |
| `pct.find_percent.chain2` | chain2 | 부분집합 안의 개수를 전체 기준 퍼센트로 바꾸고 보수까지 구함(기준량 혼동 방지) | 5,000 | 400/40 |
| `pct.find_percent.unit_ratio` | unit_ratio | 길이 단위 환산이 넓이에서는 제곱으로 적용됨을 알고 넓이 비를 퍼센트로 변환 | 4,195 | 400/36 |
| `pct.find_percent.constraint_select` | constraint_select | 퍼센트를 기약분수로 바꿔 정수 조건을 도출하고 범위 제약으로 후보를 고름 | 5,000 | 400/201 |
| `pct.compound_change.inverse` | inverse | 연속 증감의 결과에서 거꾸로 기준량을 되돌리고 중간 값으로 할인액을 구함 | 5,000 | 400/122 |
| `pct.compound_change.chain2` | chain2 | 복리 구조에서 연 변화율을 제곱근으로 되돌리고 한 해를 더 합성 | 5,000 | 400/180 |
| `pct.compound_change.compare_scenarios` | compare_scenarios | 연속 할인은 각각 새 기준량에 적용되어 단순 합과 다르다는 점을 두 가격의 비교로 확인 | 5,000 | 400/374 |
| `pct.compound_change.repr_shift` | repr_shift | 지수식의 밑을 한 기간 퍼센트 변화로 해석하고 k 기간으로 합성(단순 합 k×r 이 아님) | 5,000 | 400/68 |
| `av.rectangle_area.inverse` | inverse | 넓이·둘레에서 가로·세로를 역으로 복원(합과 곱으로부터 두 수 찾기) | 5,000 | 400/162 |
| `av.rectangle_area.compose_kind` | compose_kind | 변의 퍼센트 변화를 각각 적용해 넓이로 합성하고 넓이끼리 비교(넓이 변화율은 퍼센트의 단순 합이 아님) | 4,997 | 400/174 |
| `av.rectangle_area.repr_shift` | repr_shift | 문장 조건을 이차방정식으로 번역하고 음의 근을 버리는 모델링 | 5,000 | 400/291 |
| `av.rectangle_area.compare_scenarios` | compare_scenarios | 둘레가 같은 두 도형의 넓이를 각각 세워 비교(둘레가 같아도 넓이가 다름) | 5,000 | 400/78 |
| `av.triangle_area.inverse` | inverse | 넓이에서 거꾸로 높이를 구하는 이차 구조(h² = 2A/k)와 관계식 활용 | 5,000 | 400/42 |
| `av.triangle_area.compose_kind` | compose_kind | 삼각형 넓이를 피타고라스 정리와 합성(높이가 주어지지 않음) | 5,000 | 400/49 |
| `av.triangle_area.repr_shift` | repr_shift | 좌표 표현을 넓이 공식으로 옮기는 표현 변환(밑변·높이가 축에 평행하지 않음) | 5,000 | 400/62 |
| `av.triangle_area.constraint_select` | constraint_select | 넓이 조건을 정수 약수쌍으로 바꾸고 부등 제약으로 후보를 걸러 세는 추론 | 5,000 | 400/45 |
| `av.prism_volume.inverse` | inverse | 부피 조건에서 치수를 역으로 찾고 다른 양(겉넓이)으로 다시 계산 | 5,000 | 400/110 |
| `av.prism_volume.unit_ratio` | unit_ratio | 부피 단위 환산(cm³→L)과 비율(L/분) 결합 | 5,000 | 400/395 |
| `av.prism_volume.compose_kind` | compose_kind | 부피 보존으로 다른 입체(정육면체)를 정하고 겉넓이로 합성 | 5,000 | 400/79 |
| `av.prism_volume.compare_scenarios` | compare_scenarios | 두 수조의 물 부피 보존과 밑넓이 비교로 수위 변화를 계산 | 5,000 | 400/124 |
| `av.prism_missing_dimension.inverse` | inverse | 세 면의 넓이에서 거꾸로 세 치수를 복원(곱의 제곱근으로 부피 → 모서리) | 5,000 | 400/65 |
| `av.prism_missing_dimension.chain2` | chain2 | 앞 단계에서 구한 미지 치수가 뒤 단계의 조건이 되는 2단계 연쇄 | 5,000 | 400/60 |
| `av.prism_missing_dimension.unit_ratio` | unit_ratio | 용량(L)→부피(cm³) 환산 후 밑넓이로 나누는 미지 치수 계산 | 5,000 | 400/122 |
| `av.prism_missing_dimension.constraint_select` | constraint_select | 정수 제약 아래 가능한 치수를 모두 나열하고 목표 함수(겉넓이)로 비교·선택 | 5,000 | 400/88 |
| `av.cylinder_volume_radius.inverse` | inverse | 부피에서 반지름을 역으로 구하고(r²=k/h) 다른 양(밑면 둘레)으로 다시 계산 | 5,000 | 400/139 |
| `av.cylinder_volume_radius.compose_kind` | compose_kind | 길이의 퍼센트 변화가 부피에는 제곱으로 작용함을 반영해 두 부피를 비교 | 5,000 | 400/93 |
| `av.cylinder_volume_radius.unit_ratio` | unit_ratio | 원기둥 부피에 부피 단위 환산(cm³→L)을 결합 | 4,886 | 400/77 |
| `av.cylinder_volume_radius.compare_scenarios` | compare_scenarios | 두 원기둥의 같은 부피 조건에서 반지름 제곱비로 높이를 비교(높이는 반비례 제곱) | 4,937 | 400/186 |
| `av.cylinder_volume_diameter.inverse` | inverse | 관계(h=d)와 부피로 지름을 역산하고 반지름으로 되돌리는 지름·반지름 구분 | 5,000 | 400/292 |
| `av.cylinder_volume_diameter.chain2` | chain2 | 둘레→지름→반지름→높이로 앞 결과가 다음 조건이 되는 연쇄(지름·반지름 변환 포함) | 5,000 | 400/32 |
| `av.cylinder_volume_diameter.unit_ratio` | unit_ratio | 지름→반지름 변환과 부피 단위 환산(cm³→L)을 함께 처리 | 4,871 | 400/47 |
| `av.cylinder_volume_diameter.compare_scenarios` | compare_scenarios | 한쪽은 지름, 다른 쪽은 반지름으로 주어진 두 조건을 같은 기준(반지름)으로 맞춰 비교 | 4,882 | 400/205 |
| `ci.circumference_radius.inverse` | inverse | 둘레에서 반지름을 역산하고 다른 원의 넓이(다른 양)로 다시 계산 | 5,000 | 400/79 |
| `ci.circumference_radius.unit_ratio` | unit_ratio | 원둘레와 회전 수의 곱에 길이 단위 환산(cm→m)을 결합 | 5,000 | 400/73 |
| `ci.circumference_radius.compose_kind` | compose_kind | 원과 정사각형의 관계(변=지름)를 이용해 두 넓이를 합성해 차를 구함 | 5,000 | 400/232 |
| `ci.circumference_radius.compare_scenarios` | compare_scenarios | 한쪽은 반지름, 다른 쪽은 지름으로 주어진 두 원의 둘레를 같은 공식으로 맞춰 비교 | 5,000 | 400/148 |
| `ci.circumference_diameter.inverse` | inverse | 둘레에서 지름을 역산하고 동심원(폭 w)의 바깥 둘레를 다시 계산 | 5,000 | 400/82 |
| `ci.circumference_diameter.unit_ratio` | unit_ratio | 원둘레·회전 속도(번/분)에 단위 환산(cm→m)을 결합한 비율 계산 | 4,995 | 400/40 |
| `ci.circumference_diameter.chain2` | chain2 | 앞 결과(정사각형의 한 변)가 뒤 단계의 지름이 되는 2단계 연쇄 | 5,000 | 400/53 |
| `ci.circumference_diameter.compare_scenarios` | compare_scenarios | 두 원의 둘레 비교와 이동 거리 보존으로 회전 수를 구함(π 가 약분됨) | 5,000 | 400/133 |
| `ci.arc_length.inverse` | inverse | 호의 길이에서 거꾸로 원의 크기(지름)를 복원 | 5,000 | 400/163 |
| `ci.arc_length.chain2` | chain2 | 앞 단계(보각 360−θ)가 뒤 단계의 중심각이 되는 연쇄 | 5,000 | 400/66 |
| `ci.arc_length.unit_ratio` | unit_ratio | 시간(분)을 각도·원둘레의 비율로 환산하는 단위·비율 결합 | 5,000 | 400/93 |
| `ci.arc_length.repr_shift` | repr_shift | 도형(조각 수)을 중심각 360°/n 과 호의 길이 식으로 번역 | 5,000 | 400/33 |
| `ci.sector_area.inverse` | inverse | 부채꼴 넓이에서 반지름을 거꾸로 구하고 다른 양(호의 길이)으로 다시 계산 | 5,000 | 400/73 |
| `ci.sector_area.chain2` | chain2 | 호의 길이로 구한 비율이 다음 단계(넓이)의 조건이 되는 연쇄 | 5,000 | 400/95 |
| `ci.sector_area.compose_kind` | compose_kind | 비례배분(비)과 부채꼴 넓이를 합성 | 4,804 | 400/39 |
| `ci.sector_area.compare_scenarios` | compare_scenarios | 두 부채꼴을 각각 모델링해 넓이 차를 비교(각이 크다고 넓이가 큰 것은 아님) | 3,430 | 400/62 |
| `ci.central_from_inscribed.inverse` | inverse | 원주각·중심각 정리를 방정식의 한 변으로 사용해 거꾸로 각을 구함 | 5,000 | 400/162 |
| `ci.central_from_inscribed.chain2` | chain2 | 앞 단계(호의 크기 2x)가 뒤 단계(보호 360°−2x)의 조건이 되는 연쇄 | 5,000 | 400/48 |
| `ci.central_from_inscribed.compose_kind` | compose_kind | 원주각 정리를 이등변삼각형·삼각형 내각의 합과 합성 | 5,000 | 400/59 |
| `ci.central_from_inscribed.constraint_select` | constraint_select | 제약(배수·범위)을 만족하는 후보 중심각을 열거하고 원주각으로 환산해 개수를 셈 | 5,000 | 400/159 |
| `ci.inscribed_from_central.inverse` | inverse | 관계식으로 원주각을 역산한 뒤 맞은편 호의 원주각(합이 180°)으로 다시 계산 | 5,000 | 400/39 |
| `ci.inscribed_from_central.chain2` | chain2 | 점의 위치(작은 호 위)에 따라 가리키는 호가 바뀜을 반영한 2단계 연쇄 | 5,000 | 400/106 |
| `ci.inscribed_from_central.constraint_select` | constraint_select | 제약(원주각이 배수인 정수·범위)을 중심각으로 옮겨(2m 의 배수) 후보를 열거해 셈 | 5,000 | 400/130 |
| `ci.inscribed_from_central.repr_shift` | repr_shift | 각을 식으로 옮기고 원주각 정리로 방정식을 세우는 모델링 | 5,000 | 400/92 |
| `ci.circle_equation_transform.param_condition` | param_condition | 완전제곱식 변형과 '원이 되는/접하는' 조건을 식으로 번역해 매개변수를 결정 | 5,000 | 400/37 |
| `ci.circle_equation_transform.inverse` | inverse | 중심과 한 점에서 거꾸로 방정식을 구성하고 일반형으로 전개 | 5,000 | 400/42 |
| `ci.circle_equation_transform.compose_kind` | compose_kind | 원의 방정식 읽기를 거리·피타고라스와 합성해 현의 길이를 계산 | 5,000 | 400/38 |
| `ci.circle_equation_transform.constraint_select` | constraint_select | 정수 제약 아래 a²+b²=R 의 모든 해를 부호·순서까지 열거해 개수를 셈 | 5,000 | 400/45 |

### easy/medium 틀 46개

| 틀 ID | 풀이 구조(easy / medium) | easy 생성 | medium 생성 | 독립 변형 easy(포함/제외) | medium(포함/제외) |
|---|---|---|---|---|---|
| `pct.percent_of.count` | 집단 N 의 p% 가 속한 인원(easy) / 속하지 않는 인원(medium) | 5,000 | 5,000 | 400/62 | 400/57 |
| `pct.percent_of.price` | 정가 N 의 p% 할인액(easy) / 할인 후 판매가(medium) | 5,000 | 5,000 | 400/173 | 400/233 |
| `pct.find_whole.members` | p% 가 k 명 → 전체(easy) / 나머지 (100−p)% 가 k 명 → 전체(medium) | 5,000 | 5,000 | 400/160 | 400/50 |
| `pct.find_whole.number` | k 가 p% 인 수(easy) / p% 증가해 B 가 된 원래 값(medium) | 5,000 | 5,000 | 400/56 | 400/70 |
| `pct.percent_change.table` | a 에서 b 로 변한 증가율(easy) / 증가·감소 모두(medium) | 4,994 | 5,000 | 400/35 | 400/35 |
| `pct.percent_change.forward` | p% 인상 후 가격(easy) / 인상 후 쿠폰 차감 후 가격(medium) | 5,000 | 5,000 | 400/196 | 400/400 |
| `pct.find_percent.share` | k 명이 전체 N 의 몇 %(easy) / 속하지 않는 비율(medium) | 5,000 | 5,000 | 400/40 | 400/33 |
| `pct.find_percent.score` | 맞힌 개수/전체(easy) / 틀린 개수가 주어진 정답률(medium) | 5,000 | 5,000 | 400/103 | 400/282 |
| `pct.compound_change.twostep` | p% 증가 후 q% 감소한 최종값(easy) / 전체 변화율(medium) | 5,000 | 5,000 | 400/224 | 400/92 |
| `pct.compound_change.discounts` | 연속 할인 p%, q% 후 가격(easy) / 전체 할인율(medium) | 5,000 | 5,000 | 400/147 | 400/101 |
| `av.rectangle_area.floor` | 가로×세로 넓이(easy) / 넓이×단가 비용(medium) | 5,000 | 5,000 | 400/141 | 400/133 |
| `av.rectangle_area.wall` | 직사각형 넓이(easy) / 큰 직사각형에서 작은 직사각형을 뺀 넓이(medium) | 5,000 | 5,000 | 400/198 | 400/89 |
| `av.triangle_area.sail` | 삼각형 넓이(easy) / 같은 삼각형 n 장의 넓이 합(medium) | 5,000 | 5,000 | 400/120 | 400/45 |
| `av.triangle_area.garden` | 삼각형 넓이(easy) / 넓이와 밑변으로 높이 역산(medium) | 5,000 | 5,000 | 400/120 | 400/95 |
| `av.prism_volume.box` | 직육면체 부피(easy) / 같은 상자 n 개의 부피 합(medium) | 5,000 | 5,000 | 400/135 | 400/176 |
| `av.prism_volume.tank` | 수조 부피(easy) / 분수만큼 찬 물의 부피(medium) | 5,000 | 5,000 | 400/142 | 400/304 |
| `av.prism_missing_dimension.box` | 부피와 두 치수로 높이(easy) / 부피·길이와 '너비=높이' 관계로 너비(medium) | 5,000 | 5,000 | 400/106 | 400/65 |
| `av.prism_missing_dimension.tank` | 부피와 밑넓이로 높이(easy) / 부피와 밑면 두 변으로 높이(medium) | 5,000 | 5,000 | 400/89 | 400/44 |
| `av.cylinder_volume_radius.can` | 원기둥 부피(easy) / n 개 합(medium) | 5,000 | 5,000 | 400/342 | 400/400 |
| `av.cylinder_volume_radius.pipe` | 관의 부피(easy) / 밑넓이 kπ 로 부피(medium) | 5,000 | 5,000 | 400/131 | 400/184 |
| `av.cylinder_volume_diameter.can` | 지름으로 주어진 원기둥 부피(easy) / 분수만큼 찬 부피(medium) | 5,000 | 5,000 | 400/368 | 400/400 |
| `av.cylinder_volume_diameter.column` | 지름·높이로 부피(easy) / 높이가 지름의 2 배인 원기둥(medium) | 5,000 | 5,000 | 400/127 | 400/123 |
| `ci.circumference_radius.wheel` | 바퀴 한 바퀴의 둘레 2πr(easy) / n 바퀴 이동 거리(medium) | 5,000 | 5,000 | 400/212 | 400/335 |
| `ci.circumference_radius.fence` | 원형 정원 울타리 길이 2πr(easy) / 단가를 곱한 비용(medium) | 5,000 | 5,000 | 400/262 | 400/400 |
| `ci.circumference_diameter.pizza` | 지름으로 둘레 πd(easy) / 두 원의 둘레 차(medium) | 5,000 | 5,000 | 400/97 | 400/40 |
| `ci.circumference_diameter.rope` | 기둥을 한 바퀴 감는 끈의 길이 πd(easy) / k 바퀴 감는 끈의 길이(medium) | 5,000 | 5,000 | 400/303 | 400/296 |
| `ci.arc_length.sector` | 쉬운 중심각의 호의 길이(easy) / 일반 중심각의 호의 길이(medium) | 5,000 | 5,000 | 400/161 | 400/156 |
| `ci.arc_length.clock` | 분침 끝이 그리는 호(분 → 각도): 15·30·45분(easy) / 그 밖의 분(medium) | 5,000 | 5,000 | 400/66 | 400/66 |
| `ci.sector_area.slice` | 쉬운 중심각 부채꼴 넓이(easy) / n 등분 중 k 조각의 넓이(medium) | 5,000 | 5,000 | 400/41 | 400/150 |
| `ci.sector_area.pie` | 분수·퍼센트로 주어진 부채꼴의 넓이(easy: 1/4·1/2, medium: 그 밖의 비율) | 5,000 | 4,998 | 400/86 | 400/124 |
| `ci.central_from_inscribed.direct` | 원주각의 2 배(easy) / 중심각 = 원주각 + k 관계(medium) | 5,000 | 5,000 | 400/157 | 400/134 |
| `ci.central_from_inscribed.arc` | 원주각으로 호의 크기(easy) / 식으로 표현된 원주각의 중심각(medium) | 5,000 | 5,000 | 400/145 | 400/167 |
| `ci.inscribed_from_central.direct` | 중심각의 절반(easy) / 작은 호 위의 점에서 본 원주각 180−c/2(medium) | 5,000 | 5,000 | 400/90 | 400/88 |
| `ci.inscribed_from_central.fraction` | 호가 원의 몇 분의 몇인지로 주어진 원주각(easy: 1/4·1/2·1/3, medium: 그 밖의 분수) | 5,000 | 5,000 | 400/58 | 400/72 |
| `ci.circle_equation_transform.read` | 표준형에서 반지름(easy) / 원둘레 계수(medium) | 5,000 | 5,000 | 400/38 | 400/32 |
| `ci.circle_equation_transform.center` | 표준형에서 중심 좌표의 합(easy) / 일반형에서 중심 좌표의 합(medium) | 5,000 | 5,000 | 400/36 | 400/32 |
| `rr.proportion.recipe` | 재료 두 가지의 비(a:b)로 한 재료의 양에서 다른 재료의 양(easy) / 전체 양으로 한 재료의 양(medium) | 5,000 | 5,000 | 400/38 | 400/40 |
| `rr.proportion.map` | 축척으로 실제 거리(easy) / 한 쌍의 지점으로 축척을 구해 다른 쌍의 거리(medium) | 5,000 | 5,000 | 400/98 | 400/44 |
| `rr.chained_conversion.time` | 시간 단위 연쇄 환산 — easy: 단위 둘(분·초), medium: 일·시간·분 등 큰 단위 | 5,000 | 5,000 | 400/48 | 400/87 |
| `rr.chained_conversion.rate` | 비율 단위 환산 — easy: 분당→시간당 한 번, medium: 단위를 둘 이상 바꾸는 속도 환산 | 5,000 | 5,000 | 400/203 | 400/153 |
| `probability.simple.bag` | 세 색 중 한 색을 뽑을 확률(easy) / 두 색 또는 '그 색이 아님'(medium) | 5,000 | 5,000 | 400/188 | 400/268 |
| `probability.simple.dice` | 주사위 한 개(easy) / 주사위 두 개 합(medium)의 확률 — 모든 경우를 세어 계산 | 5,000 | 5,000 | 400/47 | 400/58 |
| `probability.conditional.survey` | A 에 속한 사람 중 B 일 확률 — easy: 개수 직접 주어짐, medium: 합집합으로 교집합을 구해야 함 | 5,000 | 5,000 | 400/68 | 400/102 |
| `probability.conditional.numbers` | 번호 카드에서 조건 A 일 때 B 일 확률 — 경우를 열거해 |A∩B|/|A| | 4,998 | 5,000 | 400/50 | 400/125 |
| `probability.sequential_without_replacement.marbles` | 비복원 두 번 뽑기 — easy: 같은 색 둘, medium: 서로 다른 두 색(순서 무관) | 5,000 | 5,000 | 400/188 | 400/94 |
| `probability.sequential_without_replacement.committee` | 모임에서 두 명을 순서대로 뽑기 — easy: 둘 다 여학생, medium: 적어도 한 명이 남학생(여사건) | 5,000 | 5,000 | 400/377 | 400/400 |

## 5. skill × 난이도 생산 가능 수량표

필요량은 30세트 목표(공용 문서 9절): easy/medium/hard. 생산 가능 수량 = 본문 유사도 0.6 미만 + **유사문항 그룹(원형/변형)당 30개 상한**(세트당 그룹 1문항 → 한 그룹은 최대 30세트에 1개씩)에서 `produceFromLite`·`produceFromArchetypes`로 실제 뽑은 개수다(`archetype-c-samples.ts --supply`). 그룹 수는 그 안에서 사용된 그룹(원형/변형) 수.

| skill | 필요 easy | 필요 medium | 필요 hard | 생산 easy | 생산 medium | 생산 hard | 그룹 수 easy/medium/hard | 원형 수 lite/hard |
|---|---|---|---|---|---|---|---|---|
| percentages | 10 | 30 | 10 | 300 | 300 | 690 | 10/10/23 | 10/20 |
| area_volume | 20 | 50 | 10 | 360 | 360 | 720 | 12/12/24 | 12/24 |
| circles | 10 | 40 | 10 | 420 | 420 | 900 | 14/14/30 | 14/28 |
| ratios_rates_units | 10 | 30 | 10 | 120 | 120 | (hard 는 파일럿 원형, 이번 범위 밖) 322 | 4/4/11 | 4/8 |
| probability | 10 | 30 | 0 | 180 | 210 | (hard 는 파일럿 원형, 이번 범위 밖) 521 | 6/7/20 | 6/12 |

모든 칸에서 생산 가능 ≥ 필요량(easy·medium·hard 모두 최소 수 배). 이 수량은 그 skill 안의 원형만의 값이며 기존 컴파일러 산출(easy+medium 합 232)과 합산되지 않는다.

### 은행 제외 기준 수량표(`core`)

은행 문장을 떼고 센 독립 변형으로 본 skill × 난이도별 생산 가능 수량. 원형·난이도 칸마다 min(core, 30)(그룹당 30세트 상한)을 합산했다. 변형이 여럿인 칸도 1 그룹으로 보수적으로 셌다.

| skill | easy 칸(min core) | easy 생산 | medium 칸(min core) | medium 생산 | hard 칸(min core) | hard 생산 | 필요 e/m/h |
|---|---|---|---|---|---|---|---|
| percentages | 10칸(min 35) | 300 | 10칸(min 33) | 300 | 20칸(min 34) | 600 | 10/30/10 |
| area_volume | 12칸(min 89) | 360 | 12칸(min 44) | 360 | 24칸(min 32) | 720 | 20/50/10 |
| circles | 14칸(min 36) | 420 | 14칸(min 32) | 420 | 28칸(min 33) | 840 | 10/40/10 |
| ratios_rates_units | 4칸(min 38) | 120 | 4칸(min 40) | 120 | - | (파일럿 hard 별도) | 10/30/10 |
| probability | 6칸(min 47) | 180 | 6칸(min 58) | 180 | - | (파일럿 hard 별도) | 10/30/0 |

## 6. 유사문항 그룹: 세트당 필요 문항 대비

세트당 그룹 1문항 제약이므로 한 세트에 그 skill 문항 n 개를 넣으려면 그 난이도에서 쓸 수 있는 그룹이 n 개 이상이어야 하고, 한 그룹은 30세트에 1개씩이라 총수요 ÷ 30 이상의 그룹이 필요하다(= 세트당 필요 올림). 기존 컴파일러는 skill 당 세부 패턴 수(3~7)가 그룹 수의 전부여서 area_volume 같은 skill 에서 그룹이 모자랐다.

| skill | 세트당 필요(easy+medium) | 필요 그룹 수(올림) | 이번 lite 그룹 수(easy+medium) | 세트당 필요(hard) | 필요 그룹 수 | hard 그룹 수 |
|---|---|---|---|---|---|---|
| percentages | 1.3 | 2 | 20 | 0.3 | 1 | 23 |
| area_volume | 2.3 | 3 | 24 | 0.3 | 1 | 24 |
| circles | 1.7 | 2 | 28 | 0.3 | 1 | 30 |
| ratios_rates_units | 1.3 | 2 | 8 | 0.3 | 1 | 11 |
| probability | 1.3 | 2 | 13 | 0.0 | 0 | 20 |

## 7. 한계와 총괄 판단이 필요한 사항

- **그림이 필요해 구현하지 않은 패턴**(figure 스키마 연동이 필요하므로 목록으로만 보고): area_volume — 도형 안의 빗금 합성 영역(직사각형 안의 원형 구멍, 겹친 도형), 전개도·단면 문제, 한 도형을 다른 도형 안에 그린 그림에서 읽는 치수. circles — 접선·할선 길이, 원 안에 삼각형이 내접한 그림에서 각 읽기, 좌표평면에 그려진 원의 그래프에서 중심·반지름 읽기. 이번 hard 72개는 모두 서술·식만으로 성립한다(내접 정사각형 등도 문장으로 정의). **서술형 대체 검토 결과**: 구멍 뚫린 직사각형(lite wall medium)과 정사각형에 내접한 원(circumference_radius compose)은 이미 서술형으로 구현했다. 접선·할선, 그림에서 각 읽기, 좌표평면 그래프 읽기는 서술하면 그림을 문장으로 풀어쓴 수준이 되어 그림 검사·학생 독해와 맞지 않으므로 figure 스키마 연동이 필요한 패턴으로 남긴다.
- ratios_rates_units·probability 의 **hard 는 파일럿 원형 그대로**(변경 없음). 이번에 추가한 것은 easy/medium 틀뿐이다. probability 의 easy/medium lite 는 표·그림 없이 서술(주머니·주사위·카드·명단)만으로 만들었다(기존 컴파일러는 표 자료 필수라 표가 없으면 생성 거절).
- lite 원형 산출(`produceFromLite`)을 `scripts/mock-exam-generation` 의 실제 대량 실행 파이프라인(import·계획)에 연결하는 일은 하지 않았다(총괄 범위). `LITE_C_ARCHETYPES` 를 소비하는 한 줄이면 된다. 다른 담당(A·B·D)이 자기 lite 프레임워크를 따로 만들었다면 `c-lite.ts`의 `LiteArchetype` 와 합칠지 결정이 필요하다(필드: id·skill·kind·frame·levels·structure·generate(rng, level)).
- 문장 표현 대안 보강은 완료했다(위 "표현 대안 층"). 남은 한계: 규칙 기반 동의 표현이라 어휘·문형은 늘었지만 문항의 수학 구조·소재 폭은 그대로다. 구조 자체의 다양성은 그룹(원형/변형) 수로 관리한다.
- 난이도(hard)는 여전히 **잠정(provisional_ai)** 이며 정답률 기반 교정 계획은 공용 문서 2절과 같다. easy/medium lite 는 `confirmed` 로 표기했으나 새 틀의 실제 난이도는 출시 후 `archetypeId`·`frame` 단위 정답률로 확인하는 것이 좋다.

## 8. 검증 요약

- `npx vitest run lib/problem-generation/math-archetypes`: 기존 `archetypes.test.ts`(hard 전체 + 신규 72, 400시드 스윕·재현성·돌연변이) + `bulk.test.ts` + `archetypes-c.test.ts`(lite 스윕·재현성·돌연변이 360건) 통과.
- `npx tsc --noEmit`: 신규 파일 오류 0(기존 `app/layout.tsx` 의 `LayoutProps` 오류만 남음, 이번 변경과 무관).
- 5,000 시드 스윕 원자료: `data/mock-exam-generation/math-archetype-C/sweep-0..3.json`.
