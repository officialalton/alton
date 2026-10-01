# 2026-10-01 수학 원형 확대 B(일차 계열 5 skill) 진행표

브랜치 `feat/math-archetypes-B`. DB·원격·배포·유료 API 사용 0, 마이그레이션 없음, 모델 보조 문구 미사용(비용 0).

## 진행표

| skill | 세부 패턴 | hard 원형 | easy 틀(그룹) | medium 틀(그룹) | 상태 |
|---|---|---|---|---|---|
| linear_inequalities | 3 | 12/12 | 3 | 5 | 완료 |
| linear_equations_one_var | 3 | 12(파일럿) | 3 | 5 | 완료 |
| linear_functions | 5 | 20/20 | 3 | 5 | 완료 |
| linear_equations_two_var | 6 | 24/24 | 3 | 5 | 완료 |
| systems_linear(카탈로그 밖 4패턴) | 4 | 16/16 | 3 | 5 | 완료(kind-catalog 미반영) |

hard 신규 72개 + em 40틀. 원형 124개(파일럿 le 12 포함) x 5,000 시드: 정답 재계산 불일치 0, 예외 0, 선지 겹침·표기 위반 0, 모든 원형 독립 변형 30개 이상.

## skill x 난이도 생산 가능 수량 (그룹당 30 상한, 유사도 0.6 미만, skill 풀 공유)

| skill | easy 필요/생산(그룹) | medium 필요/생산(그룹) | hard 필요/생산(그룹) | 30세트 배치 |
|---|---|---|---|---|
| linear_equations_one_var | 30 / 90 (3) | 90 / 150 (5) | 20 / 150 (23) | 가능 |
| linear_functions | 30 / 90 (3) | 90 / 150 (5) | 20 / 150 (22) | 가능 |
| linear_equations_two_var | 30 / 90 (3) | 90 / 150 (5) | 20 / 150 (25) | 가능 |
| systems_linear | 30 / 90 (3) | 90 / 150 (5) | 20 / 150 (16) | 가능 |
| linear_inequalities | 30 / 90 (3) | 90 / 150 (5) | 10 / 150 (16) | 가능 |

생산 수는 그룹 상한 30 x 그룹 수(easy 3, medium 5)와 hard 산출 상한(150)에서 멈춘 값이다. 세트당 필요 그룹은 easy 1 + medium 3(+ hard 최대 1)이라 easy 3·medium 5 틀이면 충분하다. 상세는 `data/mock-exam-generation/math-archetype-B/report.json`.

## 설계 메모

- easy/medium 원형은 `difficulty` 필드와 `operator: "frame"`, 별도 `EM_ARCHETYPES` 레지스트리. 틀 하나가 그룹 하나다.
- 정답은 모두 수치(검증기가 선지를 수식으로 평가). 부등식·해석 문항도 개수·정수값으로 바꿨다.
- 의미 일치: `Instance.bindings`(명사구-값 대응표)와 `verify.checkBindings`(명사구에 가장 가까운 수가 대응값). 현재 대응표는 가격·변화율 문장 등 일부 원형만 가진다. 나머지는 Preview 샘플 점검 포인트로 보완.
- 공용 코드 변경: types.ts(difficulty·bindings·frame), verify.ts(hard 검사를 hard만, checkBindings), bulk.ts(레코드 난이도), text.ts(bindings 전달), registry.ts(내 줄만).
- 한계: systems_linear 세부 패턴 4개는 컴파일러가 없어 kind-catalog.ts에 넣지 않았다.
- 재현: `npx tsx scripts/mock-exam-generation/math-archetype-b-report.ts`, 샘플은 `archetype-b-samples.ts`.
