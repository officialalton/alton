# 2026-09-30 모의고사 hard 문항 공급 파이프라인: 구조·매뉴얼·측정표

목표(총괄 재정의): 이번 수량 채우기가 아니라 **hard를 재사용 가능한 구조로 안정 생산**하는 파이프라인을 세우고, 소량 표본으로 수율·비용·판정 타당성을 측정한다. 대량 실행은 기준 수율을 넘는 것이 확인된 뒤 총괄 승인으로 한다. 원격 접근·임포트 보류 유지.

## 1. 결론(측정 기반)
- 난이도 판정 기준 교체는 **검증했지만 "경험적 hard"(약한 모델이 틀림)는 대량 생산이 불가능**하다: 등급 A 수율이 RW 약 5%, Math 약 2%, 계산형 컴파일러 0%. 이 방식으로 hard를 채우려면 hard 1문항당 약 500회 호출이 든다.
- **구조 루브릭 기반 등급 C는 수율 약 33~58%로 대량화가 가능**하지만 경험적 근거가 없다(약한 모델 정답률과 상관 -0.09, 서로 독립). 진짜 보정은 출시 후 학생 응답(`problem_response_stats`)으로만 가능하다.
- 그래서 구조는 **등급(A/B/C)을 문항에 기록**해 두고, 엄격도는 설정(`HARD_MIN_TIER`, 기본 C)으로 고른다. 권장: C를 잠정 hard로 쓰고 응답 데이터로 재보정, 그 전에는 M2 higher 경로가 medium 여분도 쓰도록 유지.

## 2. 난이도 판정 기준과 타당성
판정(`weak.ts` -> `aggregate-lib.ts hardTier`): 문항마다 (1) 약한 모델(`claude-haiku-4-5`) 독립 풀이 5회 정답률 acc, (2) 강한 모델(`claude-sonnet-5`) 독립 풀이 3회 전부 정답 일치(정답 복수·모호·오답 키 제외), (3) 구조 루브릭(풀이 단계 수 + 결합 개념 수 + 함정 오답 수; 강한 모델 채점, 상위 기준 RW 11점 / Math 10점).

| 등급 | 조건 | 성격 |
|---|---|---|
| A | 강한 모델 3/3 + acc <= 0.4 | 경험적 |
| B | 강한 모델 3/3 + acc <= 0.8 + 루브릭 상위 | 경험+구조 |
| C | 강한 모델 3/3 + 루브릭 상위 | 구조만(잠정) |

**타당성 측정(표본 60건: 라벨별 RW·Math 각 10~12건)**

| 체계/라벨 | 약한 모델 평균 정답률 | acc<=0.4 | 평균 루브릭 | 루브릭 상위 |
|---|---|---|---|---|
| RW easy | 1.00 | 0/9 | 8.1 | 7/9 |
| RW medium | 0.98 | 0/12 | 9.75 | 11/12 |
| RW hard | 0.82 | 2/10 | 10.9 | 10/10 |
| Math easy | 1.00 | 0/11 | 6.0 | 1/11 |
| Math medium | 0.95 | 0/8 | 7.75 | 4/8 |
| Math hard | 0.90 | 1/10 | 9.8 | 10/10 |

- 약한 모델 정답률은 라벨과 같은 방향이지만 분리가 작다(haiku 4.5도 SAT 문항 대부분을 맞춘다). 그러나 **정밀도는 높다**: easy/medium에서 acc<=0.4는 0건.
- 루브릭은 라벨과 잘 맞고 Math에서 특히 분리가 크다(easy 6.0 vs hard 9.8). RW는 medium도 상위가 많아 정밀도가 낮다.
- 정답률과 루브릭의 피어슨 상관은 **-0.09**(독립) — 둘은 서로 다른 것을 잰다. 어느 쪽이 "진짜 난이도"인지는 학생 응답 없이 확정할 수 없다.
- 약한 모델 정답률이 낮은 문항(21건) 중 **약 24%는 강한 모델 3회 일치를 통과하지 못했다**(키 모호·논쟁 여지) — 약한 모델 정답률만으로 hard를 정하면 결함 문항이 섞이므로 강한 모델 일치 조건이 필수다.

## 3. 구조(단계별 스크립트 — 입력·출력·기준·호출 수)
모든 스크립트는 `scripts/mock-exam-generation/`, 산출물은 `data/mock-exam-generation/<run>/`. DB 접근은 `import.ts`뿐(로컬 기본).

| 단계 | 명령 | 입력 -> 출력 | 기준 | 호출/문항 |
|---|---|---|---|---|
| 0 계획 | `plan.ts`(또는 총괄 `plan.json`) | 풀 요구량·원격 실측 -> 칸별 목표 | 칸마다 3세트분 + 여분 2 | 0 |
| 1 원형 | `data/mock-exam-generation/archetypes.json` | skill별 원형 문자열 배열 | 새 원형 = 배열에 추가 | 0 |
| 2 생성 | `generate.ts --run R --plan P --round N --archetype [--hard-prompt]` | 계획 + 원형 -> `raw/*.json`(파이프라인 통과분) | 기존 품질 계약·독립 채점 | 약 5~7 |
| 2' 컴파일러(Math) | `compile.ts --run R --skill S --count N` | 계산형 컴파일러 hard -> `raw/*__c6__*` | 수식 보장 정답 | 0(모델 호출 없음) |
| 3 검수 | `review.ts --run R` | `raw/` -> `review/` | 블라인드 풀이·감사·결정론 | 2 |
| 4 난이도 판정 | `hardpool.ts` -> `weak.ts --mode gids --gids ... --n 5 --strong 3` | 대상 gid -> `weak/` | 약한 5 + 강한 3 + 루브릭 1 | 9(약한 모델 5는 저가) |
| 5 보수 | `repair.ts --run R` | weak_distractors 단독 보관 -> `repair/`, `review-repaired/` | 보수 후 재통과 | 1 + 2 |
| 6 집계 | `aggregate.ts --run R --plan P [--next-round K]` | 전 결과 -> `final/passed.json`(등급·재라벨·중복 제거)·`summary.md`·다음 라운드 계획 | 재라벨 합의, hard 등급 | 0 |
| 7 임포트 | `import.ts --file final/passed.json [--publish] [--tag T]` | passed -> 문제은행(`usage_scope=mock_exam`) | 재실행 안전(신규분만), 기존 은행 유사도 0.6 제외 | 0 |
보조: `hard-yield.ts`(출처별 등급 수율), `weak-stats.ts`(판정 타당성 표), `stats.ts`(보수·승격 통과율).

**문항당 호출 수**: 생성 약 6(파이프라인 내부 포함) + 검수 2 + 판정 9 = 약 17. **수량당 호출 수**(수율 반영, 검수 통과율 약 50% 가정): 등급 C hard 1건 약 100회, 등급 A/B hard 1건 약 500회.

## 4. 수율·비용 측정표(소량 표본)
판정 대상은 "난이도 외 검수를 통과한 문항"(기준선은 기존 생성분 중 hard 라벨·후보, 그 외는 이번 시험).

| 출처 | 판정 수 | A | B | C | 등급 없음 | 비고 |
|---|---|---|---|---|---|---|
| 기존 직접 생성 RW | 312 | 15 (4.8%) | 6 | 104 (33%) | 187 | A+B 6.7% |
| 기존 직접 생성 Math | 173 | 3 (1.7%) | 2 | 38 (22%) | 130 | A+B 2.9% |
| hard 원형 생성 RW(central/inferences/WIC 각 12) | 36 | 1 (2.8%) | 0 | 21 (58%) | 14 | 원형·few-shot으로 C는 증가, A는 그대로 |
| Math 계산형 컴파일러 hard(eq_two_var 16·lines 10) | 26 | 0 | 0 | 0 | 26 | 검수 통과 자체가 5/26(컴파일러 hard는 풀이 단계 증가 한계, 유사문항 그룹 제약까지 고려하면 비효율) -> **폐기** |
| 승격 변형(통과 medium -> hard) | 15 | 1 | 1 | 8 | 5 | Math 0/8(계산 모순) -> **폐기**(2차 기록) |
| hard 프롬프트 개선 | 10 | 0 | 0 | 8 | 2 | 기준선 대비 A 개선 없음 |

판단: (계속) 원형 라이브러리 + 등급 C 중심 생산, 등급 판정 스크립트, 재라벨 합의. (폐기) Math 컴파일러 hard, 승격 변형(Math), 프롬프트만 강화. (보류) 등급 A/B 대량화 — 수율 2~7%로 비효율, 모델 성능이 오르면 기준(0.4)을 재검토.

## 5. 이번 소량 실행 후 hard 칸 수량(판정 등급 반영, 기존은 원격 실측)
최종 hard 등급 분포: {'rw/A': 17, 'rw/B': 7, 'rw/C': 18, 'math/C': 13, 'math/B': 2, 'math/A': 3}

| 영역 | skill | 3세트분 | +여분2 | 기존(원격) | 신규 hard 통과 | 최종 hard | 3세트분 충족 | 여분 포함 충족 |
|---|---|---|---|---|---|---|---|---|
| rw_information_ideas | central_ideas_details | 2 | 4 | 0 | 1 | 1 | X | X |
| rw_information_ideas | inferences | 2 | 4 | 1 | 3 | 4 | O | O |
| rw_information_ideas | command_of_evidence_text | 2 | 4 | 0 | 8 | 8 | O | O |
| rw_information_ideas | command_of_evidence_quant | 1 | 3 | 1 | 2 | 3 | O | O |
| rw_craft_structure | words_in_context | 3 | 5 | 0 | 1 | 1 | X | X |
| rw_craft_structure | text_structure_purpose | 3 | 5 | 2 | 3 | 5 | O | O |
| rw_craft_structure | cross_text_connections | 2 | 4 | 1 | 3 | 4 | O | O |
| rw_expression_ideas | rhetorical_synthesis | 3 | 5 | 1 | 1 | 2 | X | X |
| rw_expression_ideas | transitions | 3 | 5 | 1 | 15 | 16 | O | O |
| rw_standard_english | boundaries | 4 | 6 | 0 | 4 | 4 | O | X |
| rw_standard_english | form_structure_sense | 3 | 5 | 0 | 1 | 1 | X | X |
| algebra | linear_equations_one_var | 2 | 4 | 6 | 1 | 7 | O | O |
| algebra | linear_functions | 2 | 4 | 12 | 2 | 14 | O | O |
| algebra | linear_equations_two_var | 2 | 4 | 0 | 0 | 0 | X | X |
| algebra | systems_linear | 2 | 4 | 2 | 1 | 3 | O | X |
| algebra | linear_inequalities | 1 | 3 | 6 | 1 | 7 | O | O |
| advanced_math | equivalent_expressions | 3 | 5 | 8 | 1 | 9 | O | O |
| advanced_math | nonlinear_equations_systems | 3 | 5 | 4 | 2 | 6 | O | O |
| advanced_math | nonlinear_functions | 3 | 5 | 10 | 3 | 13 | O | O |
| problem_solving_data | ratios_rates_units | 1 | 3 | 4 | 3 | 7 | O | O |
| problem_solving_data | percentages | 1 | 3 | 4 | 2 | 6 | O | O |
| geometry_trig | area_volume | 1 | 3 | 14 | 0 | 14 | O | O |
| geometry_trig | lines_angles_triangles | 1 | 3 | 1 | 0 | 1 | O | X |
| geometry_trig | right_triangles_trigonometry | 1 | 3 | 4 | 2 | 6 | O | O |
| geometry_trig | circles | 1 | 3 | 10 | 0 | 10 | O | O |

3세트분(target) 미충족 hard 칸은 M2 higher가 medium도 쓰므로 같은 skill의 medium 여분으로 대체한다(전 칸 대체 후 충족). hard를 더 채우려면 원형을 늘린 뒤 4절 기준 수율로 계산해 총괄 승인 후 대량 실행.

## 6. 실행 매뉴얼(요약)
1. `plan.json` 확인(원격 실측 반영) -> 미달 칸 확인: `aggregate.ts --run R --next-round K`.
2. `generate.ts --run R --plan R/plan-roundK.json --round K --archetype` (hard 칸은 `archetypes.json` 원형 사용).
3. `review.ts`, `hardpool.ts`, `weak.ts --mode gids ... --strong 3`, (선택) `repair.ts`.
4. `aggregate.ts`로 칸별 표 확인, 미달이면 2로(최대 3회). `import.ts`는 총괄이 원격 환경으로 실행(신규분만 들어간다).
비용 감시: 라운드마다 `grep 호출 generate-round*.log`, 판정 9호출/문항, 수량당 호출은 4절 수율로 추정.
