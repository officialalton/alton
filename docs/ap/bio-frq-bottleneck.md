# Biology FRQ 병목 분석 (런1: 후보 76 → 통과 3)

생성 전에 원인을 먼저 가른다(오너 지시). 분석은 **근거 유형**으로 나눈다: (A) 코드·독립 풀이로 확인된 생성기 오류, (B) 검토기(LLM) 의견만 있는 항목 — 이 중 공식 패턴과 충돌하는 것은 '검토기 오류 의심', 스키마·구조와 어긋나는 것은 '구조 불일치'. 분류는 정규식 휴리스틱이며 B 영역은 사람의 표본 확인이 필요하다.

## 1. 칸별

| 칸 | 템플릿 | 후보 | 통과 |
|---|---|---|---|
| ap_biology-f01 | 긴 문항: 실험 해석 + 그래프(4.A) | 12 | 1 |
| ap_biology-f02 | 긴 문항: 실험 해석(6.B) | 20 | 1 |
| ap_biology-f03 | 짧은 문항: 과학적 탐구(3.C, 4×1점) | 32 | 0 |
| ap_biology-f04 | 짧은 문항: 모델·시각(2.B, 4×1점) | 12 | 1 |

## 2. 근거 유형별 분해(반려 73건)

| 유형 | 건수 | 비고 |
|---|---|---|
| (A1) 코드 결정적 검증 실패(수치·루브릭 구조·검증 코드 오류) | 8 | 생성기 오류(확정) |
| (A2) 독립 풀이(Opus)가 불일치·결함 지적(A1 제외) | 14 | 키·조건 불명확(생성기 오류 가능성 높음) |
| (B) 검토기 의견만(위 제외) | 51 | 아래 내용별 세분 |

### (B)+전체의 지적 내용별 건수(중복 집계, 반려 전체 기준)

| 지적 내용 | 건수 | 판정 |
|---|---|---|
| rubric bundles several asks/calculations into one point (scoring unclear) | 21 | 생성기 오류(루브릭 설계) |
| tolerance / alternative answers inconsistent with the key | 20 | 생성기 오류(키/허용 답 불일치) |
| metadata inconsistency (calculator flag, garbled verification field) | 36 | 생성기 오류(메타데이터) — 결정적 게이트로 막을 수 있음 |
| stimulus lacks data needed for a claim/prediction (design flaw) | 5 | 생성기 오류(자료 설계) |
| per-part skill mislabel (one bundle-level primary skill vs parts of different skills) | 25 | **구조 불일치** — 우리 스키마는 번들당 주 스킬 1개, 공식 FRQ는 파트별 스킬이 다름 |
| topic drift (parts belong to another unit/topic) | 23 | 구조 불일치/생성 지시 미준수 |
| time/point-grain critique (long/overloaded/fragmentary) | 29 | **검토기 오류 의심** — 공식 Bio 짧은 문항은 정확히 4×1점, 긴 문항은 9점·약 20분 |

- 반려이면서 코드·독립 풀이 근거가 없고 검토기만 지적한 항목: **51건**, 그중 생성기 결함 키워드(불일치·모순·garbled 등)가 없는 순수 의견: 20건.

## 3. 예시

**루브릭 설계 오류(1점에 여러 질문)**
- `ap_biology-f02-k9` (key_scoring): Calculator metadata is inconsistent: 'na' versus 'allowed'. Part e2 combines a prediction and a mechanism in one point. The remaining keys are correct.
- `ap_biology-f02-k14` (key_scoring): Part b key (95) is correct and totals sum to 9. However, c1 accepts strain 5 alone as evidence, which does not by itself show the repressor is a negative regulator, so the alternative is not equivalent. c2 bund

**허용 답/키 불일치**
- `ap_biology-f01-k4` (key_scoring): Part a: the experiment has two manipulated factors (GF presence and inhibitor concentration). The no-GF dish also lacks the inhibitor, so it is a baseline for GF rather than a clean negative control for the inh
- `ap_biology-f01-k8` (key_scoring): The percent-decrease key is correct (68.75%). The 68 to 69 tolerance would reject a student's 68.8% or 69%. Metadata says calculator_part allowed while calculator is na, and the verification code is garbled. Th

**메타데이터 불일치**
- `ap_biology-f01-k0` (key_scoring): Numerical keys are correct (5.6%, monotonic decrease, non-overlap of 2SE intervals). However, rubric d1 has a garbled common_errors entry that contradicts itself. The y-axis scale requirement in b1 (cover at le
- `ap_biology-f01-k1` (key_scoring): The numbers check out (index values, 178%, 6 h, non-overlapping 2SE bars). However, the part b assumption that a 25% mitotic index means 6 h in mitosis is biologically misleading. Part c and d1/d2 combine multi

**파트별 스킬 오표기(구조 불일치)**
- `ap_biology-f01-k0` (scope_skill): Only part b (3 of 9 points) truly assesses 4.A graph construction. Part a is recall of cyclin-CDK function and control design, part c is a calculation, and part d is description, prediction and justification. A
- `ap_biology-f01-k1` (scope_skill): Primary skill 4.A (construct a graph) is only part a (4 of 9 pts). Parts b (calculation), c (experimental design) and d (claim evaluation and mechanism recall) are different skills, yet all are tagged 4.A. The 

**시간·점수 입자 비판(검토기 오류 의심)**
- `ap_biology-f01-k4` (exam_suitability): The format is plausible for an AP FRQ, but the 9 points and 22 minutes are overloaded with disparate tasks. Part c is a trivial 1-point calculation. Part e is speculative. The point allocation is poorly aligned
- `ap_biology-f02-k3` (exam_suitability): 22 minutes and 9 points is long. Most of the load (graphing, a trivial division) is peripheral to the target argumentation skill. The calculator status is inconsistent.

## 4. 원인 → 조치(대량 생성 전)

1. **생성기**: LLM이 루브릭·키·표를 모두 설계했다 → 코드 우선 원형으로 전환(`frq_bio_investigation`: 설계표·평균·±2SE 겹침을 코드가 계산, 파트 4×1점, 루브릭 행은 코드가 생성). 메타데이터 불일치(계산기 flag, 검증 코드 문구)는 코드 생성으로 소멸.
2. **구조**: 번들 단일 `skill` 필드를 파트별 스킬 보유 구조로 바꾸고 검토 기준을 '번들의 지배 스킬'로 명시(Calc 가이드에는 이미 반영, Bio 가이드 필요). 데이터 모델의 `ap_frq_parts.skill_codes[]`는 이미 파트별 스킬을 지원한다.
3. **검토기**: Bio 참조 패턴(긴 9점 = A1/B3~4/C2~3/D2, 짧은 4×1점, 약 8~20분, 수식·표 제공)을 프롬프트에 넣어 시간·점수 입자 비판을 정정. 순수 의견 항목은 사람 표본 확인으로 오탐률을 측정.
4. **결정적 게이트 추가**(무료): 파트 루브릭 '한 점에 한 요소' 규칙(`required_elements` 수), 허용 답과 키의 수치 일치, 계산기 flag·검증 필드 형식.
5. 위 수정 전에는 Bio FRQ를 추가 생성하지 않는다(현재 통과율 3/76 = 4%).
