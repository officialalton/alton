# 문항 설계도(blueprint)와 과목별 접근 — 2026-10-09 (오너 승인 설계 명세)

**원칙**: 반복 가능한 유형 = **원형(archetype, 코드 템플릿) + 설계도**, 자유형 문항 = **설계도만**. 설계도가 **원형 위의 필수 층**이다. 설계도는 문항·보기·해설을 쓰기 **전에** 만들어 결정적 검사를 통과해야 하며, 실패하면 문항 생성·검토 호출을 쓰지 않는다(비용 0). 구현: `lib/ap-generation/blueprint.ts`(스키마+검증기), `blueprint.test.ts`(8건), 파이프라인 `pipeline2.ts blueprint` 단계(실패한 팩은 생성·검토로 가지 않고 `blueprint:<코드>` 로 기록), 원형 쪽 `archetypes/bp.py`.

## 1. 설계도 스키마(기계 판독 JSON)
| 필드 | 내용 | 결정적 검사 |
|---|---|---|
| id, subject, kind(mc/frq_bundle) | 식별 | 필수 |
| concept, topic, skill | 개념 + 공식 CED 토픽·스킬 | 토픽·스킬이 공식 코드, MC 에서 평가되지 않는 스킬 금지 |
| student_thinking[] | 학생이 거쳐야 할 사고 단계 | 2단계 이상, 각 15자 이상 |
| structure, response_mode, calculator | 구조·응답 방식·계산기 | 값 범위 |
| key_conditions[] {condition, evidence} | 키가 성립하는 조건과 근거 | 1개 이상, 근거 필수 |
| material {type, must_include[]} | 필요한 지문/실험/표/그래프/코드 | 필수 |
| misconceptions[] {id, description} (MC) | 오답이 반영하는 오개념 | 3개 이상, 서로 다름 |
| verification {independent_path, method} | 생성 경로와 독립된 검증 경로 | 20자 이상 설명 |
| parts[] (FRQ) {label, skills, topics, points, accepted_answers, rubric_rows} | 파트별 스킬·점수·허용 답·루브릭 | 공식 스킬·토픽, 루브릭 합 = 파트 점수, 총점 일치, 행마다 필수 요소 |
| experiment (Bio) / model (Micro) | 과목별 확장 | 아래 §2 |

## 2. 과목별 접근과 설계도 확장
- **Calculus AB/BC**(이번 라운드 구현): 개념 → 필요한 사고(규칙 선택·적용·검증) → 키 성립 조건(연속성·구간·초기조건) → 생성 경로(기호 계산) + **독립 경로**(수치 미분·이분법·수치 적분·미분방정식 수치해) → 오개념별 오답.
- **Biology**(구현): **실험·자료 먼저**. `experiment` = {fictional, design(experimental/observational), independent_variables[], dependent_variable, controls[], replicates_per_group, measurement{variable,unit}, claims[{text,scope}], ced_topics_used[]}. 한 자료에서 해석·예측·설계·논증 문항을 파생. FRQ 는 파트별 스킬·허용 답·점수. 가상 실험을 실제 연구처럼 제시하지 않는다(`fictional=true` 필수).
  - **실험 설계 타당성(결정적, 전문가 검수가 게시 전 게이트가 아니므로 코드로 가능한 만큼)**: 실험 설계는 독립변수 정확히 1개, 대조군 존재, 집단당 반복 ≥ 3, 측정 변수·단위 정의, 결론은 자료가 지지하는 범위로 제한, **관찰 자료에서 인과 결론 금지**, 연관 결론에 인과 동사(causes/leads to/results in…) 금지, 사용 개념은 해당 단원 이하의 CED 토픽만(이후 단원 개념 금지).
  - **한계(문서화)**: 생물학적 사실의 정확성(예: 효소 최적 pH 값의 현실성)은 코드로 증명할 수 없다. 남는 불확실성은 게시 후 오류 신고 흐름으로 처리한다.
- **Microeconomics / Macroeconomics**(Micro 구현): **모형·가정 → 변화 시나리오 → 결과·그래프 검증**. `model` = {initial_state, changed_conditions[], held_constant[], checks[], key_assumptions_id, explanation_assumptions_id}. 초기 상태, 바뀐 조건과 고정한 조건 구분, 계산·곡선·균형 검증, **키와 해설이 같은 가정**(id 일치) 필수. 오답은 실제 오개념(예: P=MC 로 푼 경쟁 수량, MR 대신 P 를 높이로 쓴 DWL).
- **Chemistry / Physics 1**(명세만): 모형 → 조건·자료 → **독립 계산** → 해설. 계산량이 난이도의 원인이 되지 않게 한다(수치는 단순화, 단계·표현 전환으로 난이도 조절). 설계도 확장: `model`(법칙·가정·단위), 독립 계산 경로(단위 분석 + 수치 재계산).
- **English Language**(명세만): **지문 먼저**(자체 창작 또는 라이선스 확인, 출처 기록 `provenance`) → 논증·수사 분석 → 스킬 → 문항. 키·오답은 지문 근거에 묶고 복수 정답·지문이 뒷받침하지 않는 해석을 검사. 에세이 프롬프트와 루브릭은 함께 설계. 설계도 확장: `passage {id, source, license, rights_checked}`, `evidence_spans[]`.
- **Computer Science A**(명세만): 요구사항 → **코드 + 테스트** → **실행 검증** → 문항·루브릭. 실행 결과, 요구 충족, 범위, 해설 정확성을 **각각** 검사. 설계도 확장: `requirements[]`, `code`, `tests[]`, `execution_result`.
- Statistics / Macroeconomics / 기타: Micro·Calc 접근을 따르며 과목별 설계도 확장은 해당 과목 생성 착수 시 이 문서에 추가한다.

## 3. 역할 분담(생성자 ≠ 검토자)
- 생성자는 필요한 근거를 **제공**하지만, 검토기는 이를 **신뢰하지 않는다**: 독립 계산/코드 경로로 답을 재도출, 지문·자료에서 답을 다시 도출, 조건 누락·복수 정답·자료 모순 검사, 해설이 정답과 **오답**을 실제로 설명하는지, 스킬이 실제 사고 요구와 맞는지, 번들·다중 파트 FRQ 는 구조와 문항 수준 모두 검사.
- 현재 구현: 설계도(결정적) → 코드 검증(독립 경로) → 결정적 게이트 → Opus 독립 풀이(키 비공개) → Sonnet 5기준 검토(독립 풀이 결과 비교) → 난이도 별도 태깅.

## 4. 이번 검증 라운드(AB 3 + Bio 2 + Micro 2)에서 확인된 점
설계도는 **잘못된 공식 토픽 코드(Bio data_short 의 존재하지 않는 3.7)**를 $0 에 잡았다. 반면 "루브릭이 문구 일치에 의존", "대조군 정의가 모호", "표시 오류(컬럼 'Ph', 중복 (control))" 같은 **설계 품질**은 설계도만으로는 못 잡고 검토기 단계에서 드러났다 → 설계도에 `accepted_answers` 허용 표현·대조군 정의 검사를 더 넣을 후보(`docs/ap/experiment-plan.md` §9).


## 5. 규칙 분류 정정(2026-10-09)
Bio 데이터형의 "개념을 요구하는 파트 ≥ 3/4" 와 "키워드 앵커"는 **(b) 이 원형 전용 설계 조건이었다가 폐기/이동**됐고 전역 수용 게이트가 아니다(공식 근거 없음). 현재 데이터형 설계는 파트별 평가 목적(표 해석·정량·통계 추론·생물학적 설명)을 분리하고 개념은 개념 파트(D)에서만 채점한다(`archetype-checks/bio-data-short.ts`). 무료 시드 60개 통과는 **구조적 안정성 증거**일 뿐 개념적 타당성이 아니다. 근거 분류 표: `docs/ap/experiment-plan.md` §13.1.

(2026-10-09 후속) 데이터형 D 는 하나의 설명(스킬 6.C)이고 개념(토픽 3.2) 증거는 D 만 기여한다. 파트별 스킬 A 4.B / B 5.A / C 5.B / D 6.C. 상세 `docs/ap/bio-frq-data-type-example-v2.md`, `experiment-plan.md` §14.
