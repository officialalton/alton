# 외부 감사 삼각검증 (2026-10-13)

Codex 학생 계정 풀이 감사(SAT 13세트·AP Calculus AB/BC 9세트)의 P1·P2 지적을 우리 저장소 데이터(`data/ap/stock/*`, `data/mock-exam-generation/*`, `data/rw-generation/*`, 생성기 코드)와 대조한 결과다. 감사 자료는 검증 전 데이터로만 취급했고, 수학 주장은 sympy/numpy 로 독립 재계산했다. **DB·원격·유료 호출은 없다.** 계획 파일만 만들었고 적용은 하지 않았다.

## 읽는 법과 한계

- **verdict**: `a` = 실제 결함이며 저장소 데이터/코드에 아직 있음 · `b` = 이미 고쳐졌거나 대체됨 · `c` = 감사 오류(계산 인용) · `d` = 저장소만으로 판정 불가(필요한 DB 조회 또는 외부 사실 확인을 적었다).
- **`b` 는 0건**이다. 지적 항목 중 이전 QA(`data/qa/*`, `rw-answer-leak`, `position-fix`)나 AB1 v2 교체(`ab1-v2-swap-plan.json`)로 이미 고쳐진 것은 없었다. AB1 v2 는 mcA 5·12·14·20·26 / mcB 1·5·6·9·11 만 바꿔 감사 대상 A17 은 그대로 남는다.
- **저장소 사본 ≠ DB 현재본**이다. 위치 보정(`position-fix`)이 선택지 순서를 섞었고, 13세트 재조정(`rebalance-20261008`)이 DB 에 적용됐는지, 이후 편집이 있었는지는 저장소에서 알 수 없다. 모든 SAT 항목의 "현재 게시 세트에 아직 있는가"는 아래 **DB 조회 Q1** 이 필요하다. 패치는 선택지 **글자**가 아니라 **텍스트**로 적용해야 한다.
- 내부 id: SAT 문항은 `problem_versions.quality->'mockExamGeneration'->>'gid'`(예: `a118bb1b-…`, `rwstock:med-se-2:medium-boundaries-408`), AP 는 `stockKey`(`run2:ap_calculus_ab-m17-k2`)다. "SAT n" 은 감사 화면 이름이며 세트 id 매핑은 Q1 로 한다.

## 결과 한눈에

| verdict | 행(문항 단위) |
|---|---|
| a 실제 결함·현존 | 66 |
| b 이미 수정·대체 | 0 |
| c 감사 오류 | 1 |
| d 저장소로 판정 불가 | 8 |

감사 보고서의 P1 49건·P2 48건(등록부 98행) + 발견 파일 전체(중복 포함 P1 90·P2 111행)를 **문항 단위 75행**으로 묶었다. 같은 문항을 다른 경로·결과 재검토에서 반복 보고한 행은 한 행으로 합쳤다.

### 학생 영향 순으로 확인된 결함

1. **정답이 틀리거나 정답이 없다 (점수에 직접 영향)**: SAT2 M2 Q17(키 오답), SAT3 M1 Q6(정답 3개), SAT8 M2 Q22(정답 없음), SAT11 M2 Q22(음수 넓이), SAT1 M1 Q12(정답 2개, 학생이 1 입력 후 오답 처리됨), SAT1 RW32(키가 비논리), SAT5 M1 Q1(두 그래프 정답), SAT2(신) M2 Q14·Q20, 그리고 **RW 빈칸 뒤 단어 중복 계열 26개 문항**(`S-R*`, 전체 RW 완성 문항 중 감사가 본 11건 포함). AP: AB1·AB2·BC1 MC 3건은 전제 모순으로 존재하지 않는 함수(`A-01~03`).
2. **학생이 문제를 풀 수 없게 만드는 표시 결함**: AP FRQ 3건(초기값·함수 정의가 학생 화면에 없음, `A-04`), SAT2 M2 Q16·SAT2(신) M2 Q20 그림 오류, 수식 상한 소수 분리(`A-05`), 그림 창 밖 교점 3건.
3. **문항 문장·맥락 결함(정답엔 영향 적음)**: 목표 문장 이중 표시(12건 기계 패치), 촛불 높이·중고차 가치 증가 등 맥락 오류, 영어 해설 번역 오류 4건, 선택지 복수 문법 정답(`S-G*`).
4. **구성 다양성**: BC1·BC2 실생활 FRQ 1개뿐, AB2·AB3 FRQ 6개 중 5개 같은 원형(수치 답까지 동일).

## 오늘 밤 관리자 패널로 적용 가능 / 오너 결정 필요

| 구분 | 항목 | 방법 | 비고 |
|---|---|---|---|
| 배포만 하면 됨(DB 쓰기 없음) | 수식 상한 소수 분리(`A-05`), 그래프 FRQ 초기값(신규 변환분) | 이 브랜치의 코드 변경 배포 | 이미 저장된 `$…$` 해설도 렌더 시점에 바로잡힌다. 단위 테스트 추가 |
| 관리자 패널(AP 새 버전) | `ab1-v3-audit-swap-plan.json`, `ab2-v2-…`, `bc1-v2-…` (MC 전제 모순 3건) | AB1 v3 / AB2 v2 / BC1 v2 새 버전(미리보기→확인) | 검증기(`verifyAssignment`) 6세트 전체 위반 0. 교체 후보는 모두 DB 준비 재고(`pending ""`) |
| 관리자 패널(AP 새 버전) | `ab3-v2-…`, `bc1-v2-…`(FRQ 2칸 포함), `bc2-v2-…` (FRQ 다양성·맥락) | 같은 흐름 | AB3 의 `v45ab-final:v5-ab:…-f01-k0` 는 화면 증거가 `sib21`(비프로덕션 검증 대기) — 적재·검증 후 미리보기 |
| 관리자 문제 편집 + SAT 세트 새 버전 | `data/audit/2026-10-13-sat-patch-list.json` 의 `S-01…S-19`(P1) | 문항 새 초안 저장 → 렌더 검사 → 공개 → 세트 새 버전 | 세트 항목은 문항 버전 스냅샷에 고정이므로 문항만 고쳐서는 세트에 반영되지 않는다 |
| 관리자 해설 새로고침 | 영어 해설 번역 오류 4건(`S-P06`), `S-M22` | 해설 수정 흐름(`mock_exam_refresh_explanations`) | 정답·문항 본문은 그대로 |
| **오너 결정 필요** | (1) AP FRQ 3건 초기값 재변환 — 게시 버전은 불변이라 새 문제 버전 + 세트 새 버전 3개 필요 (2) FRQ 교체로 AB3·BC1·BC2 구성이 바뀜(AB3 FRQ 3칸, BC1 FRQ 2칸, BC2 1칸) (3) RW 빈칸 중복 26건 일괄 패치와 사전 게이트(생성기) 도입 (4) 맥락 풀 생성기 수정(촛불·중고차·수입·면적 맥락) (5) SAT RW 150단어 초과·수학 난이도 구성(관찰) | | 정책·구성 변경 또는 다수 문항 일괄 수정이라 확인 필요 |

## 판정표

범례: E1 = `edit question + rerun validation`(패치 id 는 `data/audit/2026-10-13-sat-patch-list.json`), EX = `explanation-fix`, NV = `new version via admin panel`, SW = `replace item via swap plan`.

| ID | Audit ref | Prio | Finding | Verdict | Internal id | Evidence | Route |
|---|---|---|---|---|---|---|---|
| S-M01 | SAT2 Math M2 Q17 | P1 | Answer key wrong (x=10 keyed; intersection is (20,2000)); explanation divides 3000/150 as 10 | a | gid a118bb1b-89a4-4b3a-9d85-81dffc83e575 (mockgen-20260929 systems_linear medium r2) | sympy: -200x+6000=-350x+9000 -> x=20, y=2000; at x=10 B is 5500. Repo key index 2 = "x = 10". Not in position-fix as a correction. | edit question + rerun validation (patch S-01: key + ko/en explanation) |
| S-M02 | SAT3 Math M1 Q6 | P1 | Three options (-2, 1, 4) are all x-intercepts | a | gid f5124a1b-0ff4-4154-92ad-fea85f2b0dfe | g(x)=(x+2)(x-1)(x-4); g(-4,-2,1,4) = -80,0,0,0. Options stored as ["-4","-2","1","4"], key B. | edit question + rerun validation (patch S-02: options -> -4,-2,2,3) |
| S-M03 | SAT8 Math M2 Q22 (+ results ord 44) | P1 | No option equals the printed expression; stored factorization wrong | a | gid 1239c707-e34c-488c-9c14-156b58fa4159 | 3x^2+7x+2=(3x+1)(x+2), stored as (3x+2)(x+2). sympy: printed expr = (x+3)(2x-3)(3x+2)/((x+2)(2x-1)(3x+1)), matches none of A-D. With divisor numerator 3x^2+8x+4 the answer equals option A. | edit question + rerun validation (patch S-03) |
| S-M04 | SAT11 Math M2 Q22 (+ results ord 98: reference does not resolve it) | P1 | Photo side 2t-2 is twice the poster side t-1; "uncovered area" keyed as -3t^2+6t-3 (negative) | a | gid bc9b4038-6141-594c-a3a7-249f26efac98 (gapfill-20261006/items8, archetype ee.polynomial_distribution.compose_kind/area_context) | sympy: (t-1)^2-(2t-2)^2 = -3(t-1)^2 < 0 for every t != 1. Generator equivalent-expressions.ts:23-33 never enforces inner side < outer side; sibling item a6119db6 (tile 4z-4 vs z-2) is valid, so only this instance of the archetype is wrong in stock. | edit question + rerun validation (patch S-04: swap roles -> 3(t-1)^2) + generator fix + re-run (code, not applied) |
| S-M05 | SAT1 Math M1 Q12 | P1 | Two valid answers: 1 and 5 ("other than x=3") | a | gid 992e2718-a74d-47e6-9b24-bc5e0766ed3f (nonlinear_functions spr) | sympy: f(x)=f(1)=0 -> x in {1,5}; x=3 is the vertex, not the given point. Stored answers ["5"]. Student typed 1 -> graded wrong (observed in audit). | edit question + rerun validation (patch S-05: "other than x = 1") |
| S-M06 | SAT2 Math M2 Q16 | P1 | Boundary line x=5 drawn as the x-axis; no shading although text says shaded | a | gid 6fe93dc4-6ef8-4930-99f1-bfafaf5e59b2 (linear_inequalities medium mc r2) | Figure spec object l2 = {kind:line, slope:0, intercept:0, label:"x = 5"}. Not a renderer bug: plane lines support vertical via through:[[5,0],[5,25]] (coordinate-plane.ts lineParams). Scan of all figure specs: this is the only mis-encoded vertical line (stock-defect-scans.json). Text answer (6,10) is unique. | edit question + rerun validation (patch S-06: figure) then admin re-confirms "figure checked" |
| S-M07 | SAT5 Math M1 Q1 (+ results) | P1 | Removing outlier of plot C or D both increase slope | a | gid 18ef1549-7fdb-52bb-ab8f-ad5d9de5b6ca (gapfill-20261006/items4.clean, figure_choice) | numpy OLS on the stored points: C 3.0909->3.2716 (up), D 1.9394->3.2145 (up); A,B go down. Key D only. | edit question + rerun validation (patch S-08: move plot C outlier to (6,66)) |
| S-M08 | SAT2 (new attempt) Math M2 Q20 | P1 | Arch drawn flat; beam y=4 shows the answer; k=5/4 also valid | a | gid 9e664468-12eb-406b-bc76-38c8d15ecd39 | Figure: arch = fn sqrt params [0,0,0] (y=0). sympy: x[(16+25k^2)x+200k]=0; k=0 -> 1 point; k=5/4 -> second point has y<0 -> also 1 point on the upper half; 4/5 and 16/25 -> 2 points. A and D both valid. | edit question + rerun validation (patch S-07: polygon arch, drop beam, D -> 3/5) |
| S-M09 | SAT2 (new attempt) Math M2 Q14 (+ results) | P1 | Two equivalent expressions (A and D) | a | gid bbfa0e1a-c6d4-4b6b-ac17-f3797636eda0 | sympy: 400*3^(t/6) == 400*(3^(1/6))^t and == 400*(1/3)^(-t/6). D also equals P(t). | edit question + rerun validation (patch S-09) |
| S-M10 | SAT3 Math M2 Q16 | P2 | Figure labels radius 12 (reveals the answer); no 30 degree mark visible | a | gid a805ff7a-b16f-4d6f-ae43-b4cb48a64a50 | Figure spec: outer.radius "12" plus labels AB "12", angle_ACB "30°". Radius R = AB/(2 sin30) = 12 (sympy) so key B is right; the numeric outer radius label gives it away. | edit question + rerun validation (figure: drop numeric radius label; no patch written, spec semantics of outer.radius need the figure author) |
| S-M11 | SAT2 Math M1 Q11 | P2 | Text calls angles co-interior but places one above r and one below s | a | gid d4922e40-4840-4448-88e9-0061b738438b | Stimulus says "one above line r and the other below line s (co-interior)"; figure puts (4x+10) SE of r and (6x-30) NE of s (between the lines). x=20 either way ((4x+10)+(6x-30)=180). | edit question + rerun validation (patch A-d4922e40) |
| S-M12 | SAT13 Math Q14 (cum. 68) / SAT10 Math M1 Q1 | P2 | "greatest x that satisfies the equation" names no equation | a | gids 838ef1c9-3909-5cfa-af47-d789fb7dad50, e222cbc8-007f-59e5-a61d-a7f3a301e1d7 (gapfill-20261006/items8) | Both stems read "...the greatest value of x that satisfies the equation?" with only "q has two zeros" in the stimulus. | edit question + rerun validation (patches Q-838ef1c9, Q-e222cbc8) |
| S-M13 | SAT10 Math M2 Q21 / SAT12 Math M2 Q21 (+ results) | P2 | Intersection (11,-17) outside the drawn [-10,10] window | a | gids f87e641a-c551-5b11-a25a-340d4aa53f30, c27d0f37-985d-50aa-a9de-da4b37b244f2 (+ same class 8329a1bd-0921-53c0-a7bb-dffbf69c9493, not in audit) | Lines through (4,-3),(7,-9) and (-2,-4),(3,-9) meet at x=11,y=-17; axes -10..10. Scan: 3 imported items with this defect. | edit question + rerun validation (patches F-*: axes -20..20) |
| S-M14 | SAT12 Math M2 Q2; SAT8 Math M1 Q6 | P2 | Sentence about two real solutions/roots appears in both stimulus and question | a | gids d1fd93d2-66ec-5629-a68e-0464710aba65, 99fd6884-58f8-550f-ac7c-239cf0178ac1 | Stimulus ends "The equation g(x) = 0 has two real solutions." and the question restates it. Compiler wording issue (gapfill items4/items8). | edit question + rerun validation (delete the repeated sentence from the question; not patched) |
| S-M15 | SAT12 Math M2 Q8 | P2 | Car resale value rises with age | a | gid 9939657f-174b-52fc-a0c0-cf1b88a5b242 (+ same context in 704b95a5, 593e942e, 9f5d1526) | Table (0,19),(3,25),(6,31),(9,37) in "Age (years) / Resale value": slope +2. | edit question + rerun validation (patch C-9939657f: "collector car") + generator fix + re-run (code, not applied) |
| S-M16 | SAT9 Math M1 Q16 / Math M2 Q22 (+ results) | P2 | Burning candle "remaining height" increases with days | a | gids aaeb9945-8b35-5351-af60-92e0f2734f3a, 445bab61-b420-574d-a08c-abff7d043042 (same class: cb0b6233, fe679eca) | Tables (6,73),(9,94),(12,115),(15,136) and (4,72)..(10,102): slope positive. Numeric answers 157 and 3 are unique. | edit question + rerun validation (patches C-aaeb9945, C-445bab61: re-theme to seedling) + generator fix + re-run (code, not applied) |
| S-M17 | SAT4 Math M1 Q1 | P2 | Total earnings fall as tickets are sold | a | gid 95fff522-0778-5c44-a219-c4f12c31965f (gapfill-20261006/items4.clean) | Context "booth earnings vs tickets sold" with a decreasing line (value 10 at 5 tickets, 60 at 0). Context-pool defect, same class as candle/car. | edit question + rerun validation (reverse slope or re-theme; not patched) |
| S-M18 | SAT7 Math M2 Q7 | P2 | Says every number is a length but labels are degrees | a | gid efdafa88-0b16-5ab0-a7a6-a46a602eb484 | Stimulus: "...each number is a length in the same unit." Figure labels 112 deg, (5x+2) deg, y deg. | edit question + rerun validation (patch U-efdafa88) |
| S-M19 | SAT13 (new) Math M2 Q12 | P2 | "By how many percent" for a percentage-point change | a | gid 3de45c10-e1e4-5562-aa87-f47190761026 | Question: "By how many percent does the phone's battery life remaining change...?" while the quantity itself is a percentage. | edit question + rerun validation ("percentage points"; not patched) |
| S-M20 | SAT13 (new) Math M2 Q17 | P2 | Sampling unit shifts from households to people | a | gid 5d844285-56bb-5d34-ae52-30c7db4fae76 | Stimulus samples "households in Riverton"; question asks "How many people should be in the sample". Wording only; answer 3200. | edit question + rerun validation (wording) |
| S-M21 | SAT2 (new) Math M2 Q9; Q12 | P2 | Negative physical counts / negative price index | a | gids ac635b92-d13d-4605-8371-e9f13c6280e3, 84350a19-1c6e-462f-91d6-f722ba414be7 | r(t)=2^t-8 negative on 0<=t<3 and c(0)=-6 in the shown domain (claims consistent with the stored statements). | no action (low impact: answers unique) |
| S-M22 | SAT2 (new) Math M2 Q21 (+ results) | P2 | Distractor reasoning in the English explanation does not produce the listed distractors | a | DB problem 515a7e74-99e6-4afd-bd7a-809ac05b58db / version 4a3c2460-6c52-4f70-95f0-a37a8409ac6c (data/explanation-en tasks tr-*, approved.json); gid 2e283eea-41df-4f01-a054-733ec3a3e779 | Key b=2.50 (b+10r=8.5, b+8r=7.3 -> r=0.6) is right. The English explanation says the wrong readings give 6.50, "rather than 2.10/3.10", which are not the listed values. | explanation-fix |
| S-M23 | SAT3 (new) Math M2 Q21 | P2 | Hint note gives away the factoring; unrealistic revenue | a | gid 1a71ab2a-a857-419a-8606-e02d9f8b33e8 | Stimulus contains "Note: (x-2)(x+2) = x^2 - 4, and this expression is not a perfect square trinomial..." | edit question + rerun validation (delete the Note) |
| S-M24 | SAT1 (new) Math M2 Q14 | P2 | Stem already shows the equivalent expression | a | gid 01ea36e2-2166-45a3-8661-fc09993fc110 (probable match 3/7 text windows) | Stem: "(x^2-5x-14)/(x^2-4) = (x-7)/(x-2) is equivalent to which expression?" and option A repeats the first fraction. | edit question + rerun validation (rewrite stem; low impact) |
| S-M25 | SAT6 (new) Math M2 Q15 | P2 | Seller described as spending the purchase price | d | gid d368cef5-da91-5e58-abcd-145cbc85271f (probable) | Text not re-read; claim depends on the exact context sentence. | needs reviewer read (no DB needed) |
| S-M26 | SAT8 Math M1 Q20 | P2 | "Radioactive" amount modeled by 70000*1.15^t (growth) | d | not found by text search (compiler item, math glyph mismatch) | Stimulus per audit capture; numeric answer 2 unique. Needs gid lookup. | DB query Q1 (search passage ilike %radioactive substance%) |
| S-M27 | SAT1 Math M2 Q23 (cum. 77) | P2 | Several limitations plausible | d | gid 6719733a-0af8-46ec-bda2-99a04bef1b34 (low-confidence text match) | Editorial/subjective; item not re-derived. | no action |
| S-M28 | SAT10 results ord 76; SAT11 results ord 74 | P2 | English explanation wording errors (less than = add; each table fails in exactly one way) | d | SAT11 ord74 gid 022e9ff4-708f-541f-a62c-96bc08c6ed59 (probable); SAT10 ord76 not located | English explanation text lives in problem_versions.explanation_en (approved.json holds only some); needs DB read to confirm and edit. | explanation-fix after DB query Q3 |
| S-R01 | SAT1 RW49 | P1 | Verb after the blank duplicated ("reveal reveal underdrawings") | a | gid 6e8e14d6-bcfb-44b3-a4b8-554d7a2b037b | Stored passage: "...single painter ______ reveal underdrawings..." with options reveals / reveal / has revealed / revealing. Patch R-6e8e14d6... deletes the leftover verb. | edit question + rerun validation (patch R-*) |
| S-R02 | SAT13 RW13 | P1 | "such flaws" repeated after "; such" | a | gid w1-boundaries-m-254 (rebalance-20261008/gen) | Passage: "...Sen no Rikyu ______ such flaws..."; options , such / such / ; such / and such. | edit question + rerun validation (patch R-w1-boundaries-m-254) |
| S-R03 | SAT13 RW23 | P1 | "some" repeated after ": some" | a | gid w1-boundaries-m-042 (rebalance-20261008/gen) | Passage: "...critical trials ______ some later reported..."; options , some / some / : some / , some of which. | edit question + rerun validation (patch R-w1-boundaries-m-042) |
| S-R04 | SAT1 (new) RW M2 Q11 | P1 | "lions, horses, and deer" repeated | a | gid 0a3372d9-a0d6-4d65-83d1-7d3a2ef10a64 | Passage continues "...menagerie ______ lions, horses, and deer she sketched..." and every option ends with that list. | edit question + rerun validation (patch R-0a3372d9...) |
| S-R05 | SAT1 (new) RW M2 Q22 | P1 | Leftover continuation after the blank -> no grammatical completion | a | gid 5b2b6b59-5c82-4c60-b93d-d3b36e9c48db | Passage ends "...five years, ______ juveniles tracked in the same study drifted passively with currents just as the earlier researchers had described." while each option already supplies the whole second clause. | edit question + rerun validation (patch S-19) |
| S-R06 | SAT4 RW1 Q26 (+ results) | P1 | "the data" repeated | a | gid rwstock:med-se-2:medium-boundaries-609 | Passage "...and temperature ______ the data feed a digital twin..." options , the data / ; the data / the data / and, the data. | edit question + rerun validation (patch R-rwstock:med-se-2:medium-boundaries-609) |
| S-R07 | SAT4 RW2 Q3 (+ results) | P1 | "readers" repeated | a | gid rwstock:med-se-1:medium-boundaries-311 | Passage "...stories take place ______ readers instead infer..."; options , readers / readers / and readers / ; readers. | edit question + rerun validation (patch R-rwstock:med-se-1:medium-boundaries-311) |
| S-R08 | SAT5 RW1 Q4 (+ results) | P1 | "drought" repeated | a | gid rwstock:easy-1:easy-boundaries-104 | Passage "...since the 1960s ______ drought and heavy use...". | edit question + rerun validation (patch R-rwstock:easy-1:easy-boundaries-104) |
| S-R09 | SAT7 RW2 Q14 (+ results) | P1 | "condenses" repeated | a | gid sesup-medium-boundaries-42 (mockgen-20260929/se-topup) | Passage "...on winter ______ condenses on the leaves..."; key option "mornings-condenses". | edit question + rerun validation (patch R-sesup-medium-boundaries-42) |
| S-R10 | SAT4 (new) RW M2 Q9; SAT6 (new) RW M2 Q11, Q24 | P1 | Word after blank repeated ("many", "the floodwaters", "each") | a | gids rwstock:easy-1:easy-boundaries-100, rwstock:med-se-1:medium-boundaries-302, sesup-medium-boundaries-43 | Same defect pattern, scan hit; second words after the blank equal the second words of the key option. | edit question + rerun validation (patches R-*) |
| S-R11 | SAT13 (new) RW M2 Q4 | P1 | "Iranian" repeated | a | gid w1-boundaries-m-259 (rebalance-20261008/gen) | Passage "...a quarter of a whole step ______ Iranian composer Alireza Mashayekhi...". | edit question + rerun validation (patch R-w1-boundaries-m-259) |
| S-R12 | SAT3 (new) RW M2 Q6, Q21 | P1 | "she rendered" / "allows" repeated | a | gids e5a18ded-27f1-4874-b132-b405069b8b50, a5895ddf-0728-4328-a9c3-063bdce6363f | Passage "...jewelry ______ she rendered these details..."; "...single year, ______ allows the plant...". | edit question + rerun validation (patches R-*) |
| S-R13 | SAT3 RW1 Q23; SAT3 (final review), SAT3 RW2 Q26 | P1 | Comma/words after the blank leave no grammatical completion (RW1 Q23: comma after "productivity") | a | gids 618a6ee7-d30d-4577-ab49-f9747e5eb9bc (RW1 Q23), b4cdabde-f747-4dc9-80d3-c5565cbb3bac (RW2 Q26) | RW1 Q23 passage "...wheat fields ______ productivity, largely determined..." (option "depending on soil" leaves ", largely determined" after a full subject). RW2 Q26: literal ", the paintings may reflect" after the blank while the options end in a comma ("As a result," + ", the paintings"). | edit question + rerun validation (patch R-b4cdabde...; RW1 Q23 needs a hand rewrite) |
| S-R14 | SAT6 RW2 Q25 / results ord 52 (", they maintain" double comma) | P1 | Literal comma after blank duplicates option comma | d | DB problem b4af5fd9-678f-4f8c-82f4-45905d194cad / version ffe513f9-3f56-4040-99d1-6ffbcc4fca9c (transitions, options Even so, / For example, / Similarly, / Consequently,; from data/explanation-en/tasks/tr-021). Passage text is not in the stock JSON; the scan finds the same defect in 5 other transition items (04f6acc4, 51fc09b3, ef96f2f7, b4cdabde, be9e745f) | Defect class confirmed (literal "," after the blank, options end in ","). The exact SAT6 passage is not in the repo (SAT6 RW2 Q25 text search found no stock item). | DB query Q1 on version ffe513f9... (confirm literal comma), then patch like R-b4cdabde |
| S-R15 | SAT3 (final review) RW1 Q23 / SAT3 rw1-root | P1 | No grammatical option | a | gid 618a6ee7-d30d-4577-ab49-f9747e5eb9bc | See S-R13. | edit question + rerun validation |
| S-G01 | SAT1 RW25 | P1 | Two grammatical answers (", which offered" / ", offering") | a | gid 07fdeecb-6540-4e55-a54e-f5f6ab39d0aa | Stored options [", which offered","offering","; offering",", offering"]; both A and D complete a valid sentence; stored explanation calls A "double predication" (not a rule). | edit question + rerun validation (patch S-12) |
| S-G02 | SAT1 RW26 | P1 | "examining" vs "an examination that considers" | a | gid c9923475-95b4-4767-b881-325f5b34da25 | "requires an examination that considers how..., how..., and how..." is grammatical. | edit question + rerun validation (patch S-11) |
| S-G03 | SAT1 RW32 | P1 | Key "Despite" illogical; Given / Because of / As a result of valid | a | gid 3c263c92-e14d-4312-8051-886f17996d79 | Passage: "______ its extreme distance, Eris should look dim, but..." key Despite (concession) contradicts the sentence; 3 other options valid. | edit question + rerun validation (patch S-10) |
| S-G04 | SAT1 RW17; RW33 | P1 | ", and this launched" / "displaced, relocated" also grammatical | a | gids 410e5e7e-6c7e-4276-9b61-b7faa4c05c79, 88e31501-803a-489d-bb6e-9847846137e7 | Both extra options form valid sentences. | edit question + rerun validation (patches S-13, S-14) |
| S-G05 | SAT1 RW48 | P1 | Two supporting evidence choices | d | gid ffb53f81-6b4d-4233-b03d-9aeedcf3a9b8 (match 7/12) | Evidence-selection item; fixing needs a rewrite of options (not a mechanical edit). Claim not re-derived. | replace item from reserve RW stock |
| S-G06 | SAT10 RW2 Q17 | P1 | "mill workers; indeed," vs "mill workers indeed;" | a | gid rwstock4:med-se-2:medium-boundaries-408 (rw-stock-20261008) | Both complete a grammatical sentence; stored explanation rejects the second as "unconventional" (style). | edit question + rerun validation (patch S-18) + explanation-fix |
| S-G07 | SAT3 RW1 Q4 | P1 | Standard-English stem but "In doing so" and "In doing so, however" both grammatical | a | gid 1f905f95-d611-49c1-a9d8-3a78d179bccf | Options: In doing so / In doing so, however / Despite doing so / In doing so, or. Three are grammatical; only transition logic differs. | edit question + rerun validation (change stem to the transition-logic stem, or replace options; not patched) |
| S-G08 | SAT3 RW2 Q14 (+ results) | P1 | B and D both grammatical; explanation claims repeated subjects are prohibited | a | gid 82c5e756-c22a-4238-b56b-07c5c9f79c25 | Options: participial opener vs "She used ..., and she ..." — the second is also a correct compound sentence. | edit question + rerun validation + explanation-fix |
| S-G09 | SAT3 (new) RW M2 Q19, Q20; SAT2 (new) RW M2 Q11 | P1 | Relative clause / participle both grammatical | a | gids 3b5485c3-f437-4786-aeb6-14f5f97fecbc, d3db447d-6bc0-46b1-b14c-0e3b0597d7e0, 5ccf4804-9d89-4c6f-b4c2-de3a55e6b97b | "Her team, which used ..." vs "using"; "a group that comprised" vs "comprising"; "routes, which featured" vs "featuring". | edit question + rerun validation (patches S-15, S-16, S-17) |
| S-G10 | SAT2 (new) RW M2 Q12, Q21 | P1 | Multiple grammatical answers | d | gids ed758eb3-1970-40f2-8d34-74701a243e1a, 55981e4f-a11a-4074-9f46-93faa4d909bb | Q21 options "and, thereby" / "and thereby" / "and, thereby," / "and; thereby": the commaless and comma versions are both acceptable to many editors; Q12 "having reviewed ..." vs "which had reviewed". Judgement-level, not re-derived. | edit question + rerun validation after reviewer check |
| S-G11 | SAT5 RW1 Q8; RW2 Q22 | P1 | Several grammatical adverbs / clause forms | a | gids d40fe6a0-6492-4fc8-8537-c6639ff3f3b8, e66e12e0-d7bb-4aa1-be66-28705642b429 | Q8: "and consequently she became" / "meanwhile" / "having achieved this" all valid; Q22: "Noether persisted ... despite" and "despite these obstacles Noether persisted" both valid. | edit question + rerun validation |
| S-G12 | SAT6 RW1 Q5 | P1 | "their" and "his or her" both acceptable | a | gid 387fc03b-10ac-428b-a172-703ab895c465 | Options his or her / their / its / one's; stored explanation rejects singular they categorically. | edit question + rerun validation + explanation-fix |
| S-G13 | SAT8 RW2 Q21 | P1 | "a practice reflecting" vs "reflecting" | a | gid c7a5215b-adb8-4afa-ac99-d2af243c744e | Both attach validly to the preceding clause. | edit question + rerun validation |
| S-P01 | SAT1 RW44; SAT2 RW M2 Q8 (cum. 35); SAT3 RW1 Q18; SAT3 RW2 Q9; SAT3 (new) RW Q7; SAT4 RW1 Q9; SAT9 RW1 Q22 | P2 | Student goal / question sentence shown twice | a | gids ef704d02-d963-4fc9-a9b9-7b2523e33205, 5b9b865b-09e9-435d-b138-7710f25187f7, f6ad8197-06ca-4bf3-9c40-d425bb696d7d, 896b1d19-9734-425c-887d-ca61860501fc, 3e9176bf-e680-4816-a307-5458e53032da, fcde57e1-5271-4194-8dae-5c2bef3423e1, 3b4169b4-bd54-4fa1-bc01-eef69ef8ba9f | In each stored item the stimulus already contains the question text that is also stored as the question. Scan: 26 candidates (21 imported). | edit question + rerun validation (patches D-*: 12 mechanical) |
| S-P02 | SAT4 RW1 Q8 | P2 | Standard English stem used for a transition-logic question | a | gid 356d2176-ea3a-42bb-bff1-6a14bc31fc65 | Stored question: "Which choice completes the text so that it conforms to the conventions of Standard English?" with Similarly / For example / Eventually / Likewise (all grammatical). | edit question + rerun validation (use the "most logical transition" stem) |
| S-P03 | SAT4 RW1 Q18 | P2 | Passage dates cassette development to 1959 | a | gid rwstock:med-se-1:medium-boundaries-324 | Stored passage: "In 1959, engineers at the Dutch firm Philips...". Philips began the compact cassette project in the early 1960s (introduced 1963); date from general knowledge, not independently sourced here. | edit question + rerun validation (change year) |
| S-P04 | SAT3 RW1 Q2 | P2 | Tacoma Narrows collapse called resonance | a | gid 57c13ba3-a6bc-4706-9263-a3c8cae8e8e1 (probable) | Stored text speaks of "potential resonance problems" for the 1940 collapse; the accepted cause is aeroelastic flutter (self-excited), not forced resonance. | edit question + rerun validation (reword) |
| S-P05 | SAT4 RW1 Q21; SAT5 RW1 Q20; SAT7 RW1 Q4, Q9; SAT11 RW1 Q3; SAT8 RW1 Q5; SAT9 RW2 Q6; SAT11 RW2 Q12; SAT12 RW1 Q19; SAT3 RW1 Q2 | P2 | Factual / scientific accuracy of passages | d | gids 6273a28a-eb53-46b0-bcf3-7cea16fa40b0, 963ebc71-6ff9-432f-a9a7-f6d4e3d505b0, aeaae082-c163-428c-9920-fc7149a9825d, rwstock:easy-1:easy-boundaries-101, rwstock4:easy-ei:easy-transitions-205, b3de9199-dc32-422b-8605-f6d37d9a110c, 3b57dca2-8482-4af0-88cd-718a1bc13566, ebd8bd34-7bc2-44c8-ba4a-ae13576f059e, w1-boundaries-m-189 | Each cited passage statement is present in the stored text (e.g. SAT7 RW1 Q4 "length of the planet's orbit ... every nine days", SAT7 RW1 Q9 "In 2019 ... bicycle bridge", SAT11 RW1 Q3 fern grouped with desert plants); whether the outside fact is wrong needs an external fact-check, not a DB read. | external fact-check, then edit question + rerun validation |
| S-P06 | SAT6 results ord 47; SAT9 results ord 15, 42, 54; SAT6 results ord 52 | P2 | English explanation contradicts the passage (date direction; Mathis "his/brother"; nephew vs niece; absorbs vs oysters) | a | DB problem/version: ord 47 = 47056b8e-21e4-4e4c-ab4a-d4efb2276c16 / b679e222-ad35-4559-84f5-8e09e9aedba9; ord 15 = 457d567a-8ed3-4ca3-9e3d-989326420aa4 / 78e523ad-d682-4f41-9d7e-b257d990b6ac; ord 42 = d07ca7d3-eec2-4221-bdd6-7fbca6489315 / a3f5839d-ceda-49de-94b3-86760f55080f; ord 52 = b4af5fd9-678f-4f8c-82f4-45905d194cad / ffe513f9-3f56-4040-99d1-6ffbcc4fca9c (all from data/explanation-en/tasks, versionId = problem_versions.id) | data/explanation-en/approved.json: "dates ... a week ahead of the real ones" (passage: dated a week BEFORE); "the plane ticket of a brother" (passage: sister/she); "calls the narrator ... a nephew" (passage: like a niece); "shortage of oysters" (passage: shortage of suitable denning sites). Korean sources are gender-neutral (조카, 동생) and for ord 52 say "굴 부족" (굴 = burrow or oyster); the English translation picked the wrong reading, so the errors were introduced by translation. | explanation-fix |
| S-P07 | SAT1 (new) RW Q18, Q20, Q25; SAT13 (new) RW Q12, Q27; SAT2 (new) RW Q24, Q26; SAT3 (new) RW Q24, Q25; SAT6 RW1 Q9, Q27; SAT6 RW M2 (alt) Q21; SAT10 RW1 Q19; SAT5 RW2 Q26; SAT8 RW2 Q24, Q26; SAT9 RW1 Q20; SAT1 RW50; SAT1 RW77/Math Q23 | P2 | Alternate valid transition/punctuation/evidence choices, weak supporting data, editorial concerns | a | gids 6f6352ff-6922-4342-adcb-90c2c3aba649, 4ed4249c-86a7-485c-ba48-92675ad436f6, rebal13:w3-boundaries-m-035, c7c1fc86-cd69-4665-9d55-e3cca54fc9e2, 5fcdc4d9-408b-4a5b-8a2c-b88128f9b97a, 38f838b9-156f-4ea9-acbe-bd5471e358ee, d90f5e5b-62cd-4982-9182-baf5f4d6345f, 8af85fbf-c6b7-4c0f-987b-b5893f2f3b64, 4fe2723f-06c9-44d7-bef7-94d64fc4adf8, 58c8b184-f1f8-42e1-a786-b553a6457cc5, rwstock4:med-se-2:medium-boundaries-410, 0483480c-e56a-44a6-afdb-9857c3a1ead4, 03ae9479-1af2-4f87-bd88-30710870a92b (Q25 / SAT7 RW2 Q27 / SAT8 RW2 Q24 have no gid in the repo: pilot gens.json) | Re-read of the stored options: e.g. SAT3 (new) RW Q25 "bacteria, and" vs "bacteria; and" both valid; SAT13 (new) Q27 "that critics raised, proving" valid; SAT1 (new) Q18 option D also illustrates the claim. Judgement-level, low student impact. | no action unless the owner wants a polishing round (E1) |
| A-01 | AP AB1 MC-A17 | P1 | f' sign/monotonicity premises contradictory | a | run2:ap_calculus_ab-m17-k2 (AB1 v1 and v2 mcA#17; archetype fprime_graph_statements) | f twice differentiable -> f' continuous, sign change at 1 -> f'(1)=0; f' increasing on (1,5) -> f'>0 on (1,5), contradicting f'<0 on (1,6). AB1 v2 swaps only mcA 5,12,14,20,26 and mcB 1,5,6,9,11 so the item is still present. Generator scripts/ap-generation/archetypes/calc_ab_2.py:99-114 picks (lo,hi) at random. | new version via admin panel: data/ap/stock/ab1-v3-audit-swap-plan.json (mcA#17 -> run2:ap_calculus_ab-m19-k1, unit 5, calc not allowed, db-ready) |
| A-02 | AP AB2 MC-A18 | P1 | Same contradiction (f' increasing on (1,6) while negative on (1,2)) | a | s1a-final:ap_calculus_ab-m17-k1 (exact-assign-5sets-cons.json AB2 mcA#18) | Same archetype; the 3 auto_passed items of the archetype are exactly the 3 audited slots (the other 3 were rejected). | new version via admin panel: data/ap/stock/ab2-v2-audit-swap-plan.json (-> s1a-final:ap_calculus_ab-m19-k0) |
| A-03 | AP BC1 MC-A7 | P1 | Same contradiction | a | run2:ap_calculus_ab-m17-k3 (BC1 mcA#7) | Same archetype. | new version via admin panel: data/ap/stock/bc1-v2-audit-swap-plan.json (-> run2:ap_calculus_ab-m18-k0, unit 5 skill 2) |
| A-04 | AP AB1 FRQ-B1(c); AB2 FRQ-B1(c,d); BC1 FRQ-B1(c) | P1 | Absolute extremum asked without an initial value | a | run1:ap_calculus_ab-f02-k5 (AB1: given f(0)=40), run1:ap_calculus_ab-f02-k9 (AB2: S(0)=0), run1:ap_calculus_ab-f02-k10 (BC1: f(0)=1) | The value IS in the stock payload (stimulus.data.given / context) but convert.ts passageFor() only emits a passage for text stimuli, and the graph spec drops data.given/context, so the student never sees it. Exactly these 3 FRQs carry given/context on a graph stimulus. Fixed in code for future conversions (lib/ap-exam/convert.ts graphStatedFacts + tests); the published problem versions still lack it. | new version via admin panel + edit question + rerun validation: re-convert/edit the passage of those 3 problems, then a new set version for AB1, AB2, BC1 (published versions are immutable) |
| A-05 | AP AB1 FRQ-A2(c), AB2 FRQ-A2(c), AB3 FRQ-A2(c), BC1 FRQ-A2(c), BC2 FRQ-A2(c) | P1/P2 | Decimal integral upper limit rendered as superscript 2 + baseline ".746" | a | run2:ap_calculus_ab-f04-k0..k3, s1a-final:ap_calculus_ab-f04-k0/k1 (stored as `\int_0^3.154` etc.) | KaTeX renders `\int_0^3.154` as limit "3" and the text ".154" on the baseline (reproduced in a unit test, <mn>3</mn></msubsup><mn>.154</mn>). The old test even pinned the broken output. 37 stock items have unbraced multi-character scripts (^12, ^-2, _0.05, mm^-1 ...). FIXED (display only): braceNumericScripts() in lib/ap-exam/explanation-math.ts applied inside every `$...$` at render time, so already-stored explanations display correctly after deploy without a DB write; data/ap/stock/tex-corrections.json regenerated (7 entries) for the optional storage clean-up. | fixed in code (tests added); optional EX route for storage normalization |
| A-06 | AP BC2 FRQ-A2(d) | P2 | Average value 1.191 vs rounded 1.192 | c | run2:ap_calculus_ab-f04-k1 | sympy: exact intersection b=2.517456, average value = 1.191431 -> 1.191 (stored value correct). The auditor got 1.1917 by dividing by the rounded limit 2.517. | no action |
| A-07 | AP AB1 FRQ-B2(a) | P2 | Reference allows "a vertical" slope segment at (0,0) where dy/dx is undefined | a | run1:ap_calculus_ab-f03-k2 | model_answer: "no slope segment (or a vertical one) appears there". | explanation-fix (reference text) — low impact |
| A-08 | AP AB3 MC-A27 | P2 | "differentiable" piecewise-linear graphs with corners | a | s1-graph-ab-final:ap_calculus_ab-m24-k0 (probable, 6/7 windows) | Stem: "The graphs of the differentiable functions f and g ... each consisting of line segments". | edit question + rerun validation (stem wording) or replace item via swap plan; low impact (limit exists at x=7) |
| A-09 | AP BC1 MC-B6; MC-B5 | P2 | "derivatives of all orders" with a corner third-derivative graph; rounded implicit constant | a | s3a-graph-bc-final:ap_calculus_bc-m02-k0; s3a-graph-ab-final:ap_calculus_ab-m04-k0 | f''' has corners -> f'''' does not exist at them. xe^y+y^2=6.4366 vs exact 2e+1=6.43656; keyed -0.366 is right to 3 dp. | edit question + rerun validation (wording; low impact) |
| A-10 | AP BC2 MC-A23 / MC-A25 | P2 | Same segment graph reused in one exam | a | s1-graph-ab-final:ap_calculus_ab-m17-k0, s1-graph-ab-final:ap_calculus_ab-m32-k0 | Different questions on identical graph data (observation of the audit). | no action (optional swap) |
| A-11 | AP BC1, BC2 FRQ real-world contexts | P2 | Only 1 context FRQ (official minimum 2) | a | BC1 (A2 area/volume, B1 f' graph, B2 separable DE, B3 f' graph, B4 Taylor are abstract); BC2 (A1 table, A2 area/volume, B1 f' graph, B3 series, B4 Taylor abstract; B2 cooling the only context) | Read from exact-assign-5sets-cons.json + stock payloads. NOTE: part of the perceived missing context is the display bug of A-04. | new version via admin panel: bc1-v2-audit-swap-plan.json (A2 -> marginal profit, B2 -> pen cost), bc2-v2-audit-swap-plan.json (A2 -> trench volume); verifier violations 0 |
| A-12 | AP AB2/AB3 FRQ template repetition (5 of 6), identical numeric answers | P2 | AB2 and AB3 FRQs share 5 of 6 archetypes; area/volume answers identical | a | AB2 A1 run2:ap_calculus_ab-f04-k3 and AB3 A1 run2:ap_calculus_ab-f04-k2 (same f-g -> a=4.316, b=7.658, d=1.572); also A2 table-rate, B fprime graph, B cooling DE, B ladder | Compared archetypes from exact-assign-5sets-cons.json; the set rules only forbid repeats inside one set. | new version via admin panel: data/ap/stock/ab3-v2-audit-swap-plan.json (A1 -> particle motion, A2 -> accumulation, B3 -> exponential decay DE): AB2/AB3 then share 2 of 6 |


## 수정 계획 파일(전부 계획 전용, DB 쓰기 없음)

| 파일 | 내용 |
|---|---|
| `data/ap/stock/ab1-v3-audit-swap-plan.json` | AB1 (v2→v3): mcA#17 `run2:ap_calculus_ab-m17-k2` → `run2:ap_calculus_ab-m19-k1` |
| `data/ap/stock/ab2-v2-audit-swap-plan.json` | AB2: mcA#18 `s1a-final:ap_calculus_ab-m17-k1` → `s1a-final:ap_calculus_ab-m19-k0` |
| `data/ap/stock/ab3-v2-audit-swap-plan.json` | AB3: FRQ A1 → `v45ab-final:v5-ab:ap_calculus_ab-f01-k0`(직선 운동), A2 → `supp-r3c-ab-final:ap_calculus_ab-f01-k0`(누적 전류), B3 → `supp-r3c2-ab-final:ap_calculus_ab-f05-k0`(지수 감소 DE) |
| `data/ap/stock/bc1-v2-audit-swap-plan.json` | BC1: mcA#7 → `run2:ap_calculus_ab-m18-k0`; FRQ A2 → `supp-r3c-ab-final:ap_calculus_ab-f03-k0`(한계수익), B2 → `supp-r3c-ab-final:ap_calculus_ab-f09-k0`(울타리 비용) |
| `data/ap/stock/bc2-v2-audit-swap-plan.json` | BC2: FRQ A2 → `supp-r3c-ab-final:ap_calculus_ab-f04-k0`(도랑 부피) |
| `data/audit/2026-10-13-sat-patch-list.json` | SAT 문항 편집 67건(문항·필드·old→new·검증·DB 조회문). `S-*` 19건 수동(P1 중심), `R-*` 26건 RW 빈칸 중복 기계 패치, `D-*` 12건 목표 문장 이중 표시, `F-`3·`Q-`2·`C-`3·`U-`1·`A-`1 P2 문구·그림 |
| `data/audit/2026-10-13-stock-defect-scans.json` | 저장소 전체 스캔 후보(빈칸 중복 62·이미 임포트 47, 문장 이중 표시 26, 평면 수직선 오인코딩 1, 교점 창 밖 4) |
| `data/audit/2026-10-13-external-audit-triage.json` | 이 표의 기계 판독본 |

생성·검증: `scripts/audit/ap-external-audit-swap-plans.ts`(`STRUCTURE_GROUPS_FILE=data/ap/stock/structure-groups.conservative.json npx tsx … [--write]`, 6세트 전체에 독립 검증기 위반 0, 후보는 사용되지 않은 DB 준비 재고만), `scripts/audit/stock-defect-scans.py`. 교체 후보의 수학은 직접 확인했다: 직사각형 `y=3−x²` 최대 넓이 4, `y=12−x²` 최대 32, `f''=−(x−5)(x−1)²(x+5)` 변곡점 2개.

SAT 패치 검증(sympy/numpy 재계산): S-01 `x=20, y=2000`; S-02 `g(-4,-2,2,3)=-80,0,-8,-10`; S-03 `3x²+8x+4=(3x+2)(x+2)` 일 때 식 = 선택지 A 와 일치(B·C·D 불일치); S-04 `(2t−2)²−(t−1)²=3t²−6t+3`; S-05 `f(x)=f(1)` 해 `{1,5}`; S-07 기울기 `k=0,5/4` 가 윗반원에 1점, `3/5` 는 2점; S-08 OLS 로 C 이상점을 (6,66) 으로 옮기면 C 는 제거 시 기울기 감소·D 만 증가; S-09 `400·3^{t/6}=400·(1/3)^{−t/6}`.

## 코드 변경(표시 전용 + 변환기, 테스트 포함)

1. **소수·여러 글자 첨자 분리(`A-05`)**: KaTeX 는 `\int_0^3.154` 를 상한 `3` + 기준선 `.154` 로 그린다(단위 테스트로 `<mn>3</mn></msubsup><mn>.154</mn>` 재현, 기존 테스트가 이 깨진 출력을 정답으로 고정하고 있었다). `lib/ap-exam/explanation-math.ts` 에 `braceNumericScripts` 를 추가해 모든 `$…$` 안의 `^3.154`·`^10`·`^-2`·`_12` 를 `^{3.154}` 로 바꾼다(한 글자 숫자·이미 중괄호인 것·`\$` 는 그대로, 멱등). 응시 결과·학습 화면이 이미 `autoMathExplanation` 을 거치므로 **DB 에 저장된 해설도 배포 즉시 바로잡힌다**. 영향 AP 재고 37건(예: 면적·부피 FRQ 6개, 생물 `mm^-1`). 재생성한 `data/ap/stock/tex-corrections.json` 7건은 저장소 정규화를 원할 때만 쓴다.
2. **그래프 FRQ 의 초기값·함수 정의(`A-04`)**: `lib/ap-exam/convert.ts` `graphStatedFacts()` 가 그래프 자료의 `data.context`·`data.given` 을 지문으로 싣는다(통계 표 자료는 이미 노트를 싣는다). 해당 데이터가 있는 FRQ 는 정확히 3개다. **새로 변환하는 문항에만 효과가 있다** — 이미 공개된 3개 문제 버전은 새 버전이 필요하다.
3. 테스트: `lib/ap-exam/explanation-math.test.ts`(+3), `lib/ap-exam/convert.test.ts`(+3), `lib/ap-admin/explanation-fix.test.ts`(기대값 정정), 신규 `lib/ap-admin/audit-swap-plans.test.ts`(계획 정합 8), `lib/problem-generation/external-audit-sat-patches.test.ts`(SAT 패치 수학 10). `npx vitest run --project unit lib/ap-exam lib/ap-admin lib/ap-generation lib/problem-figures lib/mock-exam` → **97 파일 통과 / 847 테스트 통과**(통합 테스트·공유 DB 가드는 건드리지 않았다). 단 Python 원형 테스트(`lib/ap-generation/bio-frq-checks.test.ts`, `gates.test.ts`)는 `scripts/ap-generation/requirements.txt` 를 설치한 Python 을 `AP_PY` 로 지정해야 돈다(없으면 변경 전부터 16건 실패 — `py.ts` 기본값이 이전 세션 임시 폴더라 환경 의존). `tsc --noEmit` 은 변경 파일 오류 0(`app/layout.tsx` 의 `LayoutProps` 는 Next 타입 생성 전 상태의 기존 오류).

## 근본 원인과 권고(코드 변경은 하지 않음)

- **빈칸 뒤 단어 중복(RW 26건)**: 생성기가 빈칸 뒤 이어지는 원문을 그대로 두고 선택지에도 그 단어를 넣었다. AI 검수는 선택지만 보고 통과시켰다. 권고: 문항 게시 전 정적 게이트(`scripts/audit/stock-defect-scans.py` 의 `completion_duplicate` 로직: 선택지 끝 단어와 빈칸 뒤 첫 단어 겹침, 빈칸 뒤 리터럴 `,` + 선택지 끝 `,`)를 `import.ts` 거부 규칙에 추가. 이미 임포트된 후보 47건 중 26건은 패치로 정리됨.
- **`ee.polynomial_distribution` 문맥형(`S-M04`)**: `equivalent-expressions.ts:23-33` 이 안쪽 변이 바깥 변보다 짧도록 강제하지 않는다. 권고: `|a|>|c|` 또는 `a==c, b>d` 조건 추가.
- **`fprime_graph_statements`(`A-01~03`)**: `calc_ab_2.py:99-114` 가 `f'` 증가 구간 `(lo,hi)` 를 부호 변화점과 무관하게 뽑는다. 권고: `r1 < lo < hi <= r2` 로 제한(`f'` 가 음수 구간에서 0 으로 올라오는 구간만).
- **그래프 FRQ 맥락 누락(`A-04`)**: 변환기가 `data.given` 을 버렸다(위 수정). 게이트가 `given` 이 학생에게 보이는지 확인하지 않는다.
- **맥락 풀(촛불·중고차·입장 수입)**: 갭필 표 컴파일러의 맥락과 기울기 부호가 독립이다. 권고: 맥락별 허용 부호를 풀에 명시.
- **구성 규칙**: FRQ 는 세트 안 중복만 금지한다. 세트 간 원형 겹침 상한(예: 두 세트 사이 FRQ 원형 공유 ≤ 3)과 "변수만 다른 변형" 감지(f−g 동일)를 추가하면 `A-12` 가 재발하지 않는다.

## 관찰(우리 쪽 수치)

- **RW 150단어 초과**: 저장소에 생성된 RW 지문(고유 3,667) 기준 150단어 초과 707(문자수/6 기준 585), 155 표준단어 초과 482, 중앙값 120, 최대 260. 게시 세트에 실제 들어간 문항만의 수는 **DB 조회 Q2**.
- **SAT 수학 구성**: 세트 사본 147문항 중 수학 66 = 쉬움 16 / 보통 42 / 어려움 8(어려움 12%), 세트당 17~19개 세부 기술. 감사의 "표준 절차 91.8%"는 공식 통계가 아니지만 어려움 비율이 12%인 우리 구성과 방향이 맞는다.
- BC1 실생활 FRQ 부족의 일부는 `A-04`(그래프 FRQ 의 설명 문장이 화면에 안 나오는 문제)와 겹칠 수 있다.

## DB 조회(읽기 전용, 조정 세션이 실행)

Q1 — 패치·결함 gid 가 현재 어느 세트·위치에 있는가(그리고 DB 본문이 저장소 사본과 같은가):
```sql
select s.name, s.version_no, s.status, i.section, i.position,
       p.id as problem_id, pv.id as version_id, pv.version_no as v,
       pv.quality->'mockExamGeneration'->>'gid' as gid,
       left(pv.passage, 80) as passage_head, pv.correct_index, pv.options
from mock_exam_set_items i
join mock_exam_sets s   on s.id = i.exam_set_id
join problem_versions pv on pv.id = i.problem_version_id
join problems p          on p.id = i.problem_id
where pv.quality->'mockExamGeneration'->>'gid' = any (array[
  /* data/audit/2026-10-13-sat-patch-list.json 의 gid 전체: jq -r '.patches[].gid' | sort -u */ ])
order by s.name, s.version_no, i.section, i.position;
```
Q2 — 게시 세트 RW 지문 길이(공백 기준 단어 수, 문자수/6 은 `length(passage)/6.0`):
```sql
select count(*) filter (where w > 150) as over150, count(*) as total
from (select i.exam_set_id, i.problem_id,
             cardinality(regexp_split_to_array(trim(pv.passage), '\s+')) as w
      from mock_exam_set_items i
      join mock_exam_sets s on s.id = i.exam_set_id and s.status = 'published' and s.archived_at is null
      join problem_versions pv on pv.id = i.problem_version_id
      where i.section = 'rw' and pv.passage is not null) t;
```
Q3 — 영어 해설 오류 후보 위치(`S-M28`, `S-M22`): `select p.id, pv.id, pv.explanation_en from problem_versions pv join problems p on p.published_version_id = pv.id where pv.explanation_en ilike any (array['%exactly one way%','%less than%adding%','%6.50 rather than%'])`.
Q4 — 위치 못 찾은 항목 본문 검색: `select pv.id, left(pv.passage,120) from problem_versions pv where pv.passage ilike any (array['%they maintain%','%radioactive substance%','%purchase price%'])`.
Q5(AP) — AB1/AB2/BC1 현재 게시 버전의 해당 슬롯: `select s.name, s.version_no, i.section, i.position, p.ap_candidate_key from mock_exam_set_items i join mock_exam_sets s on s.id=i.exam_set_id join problems p on p.id=i.problem_id where p.ap_candidate_key in ('run2:ap_calculus_ab-m17-k2','s1a-final:ap_calculus_ab-m17-k1','run2:ap_calculus_ab-m17-k3','run1:ap_calculus_ab-f02-k5','run1:ap_calculus_ab-f02-k9','run1:ap_calculus_ab-f02-k10');`

## 적용 계획(2026-10-13 저녁, 조정 세션이 SQL 파일을 실행)

비프로덕션 DB(`worpsqwqgnspddnrtnvq`)의 **읽기 전용 SELECT** 로 현재 공개 버전을 읽어 만든 계획이다(쓰기는 하지 않았다). 읽은 결과는 `data/audit/2026-10-13-db-readout.json`(Q1=problems[]·Q2~Q5=triage, 패치별 상태 patchStatus[]), 상태 요약은 `data/audit/2026-10-13-apply-status.json`.

- **SAT·AP 문항 새 버전 + 세트 새 버전 SQL**: `data/audit/apply/2026-10-13-apply.sql`(한 개의 DO 블록 = 한 트랜잭션). 문항마다 `save_problem_draft_version → set_problem_render_check → set_problem_quality → confirm_and_publish_problem_version`(AP 는 `ap_attach_new_version` 포함), 세트마다 같은 `set_group_id` 의 version_no+1 초안(문항 스냅샷 복사, 바뀐 문항만 새 버전) → `mock_exam_validate_mst_set`·`mock_exam_set_item_issues` 검증 → `mock_exam_publish_set`(이전 공개본 보관, 공개 범위 승계). 멱등(이미 반영된 문항·세트는 건너뜀), 기대한 옛 값과 다르면 `DRIFT` 로 전체 롤백.
- 실행: `npx supabase db query --linked -f data/audit/apply/2026-10-13-apply.sql` → 검증 `-f data/audit/apply/2026-10-13-verify.sql` → 문제 시 `-f data/audit/apply/2026-10-13-rollback.sql`(문항은 옛 공개 버전으로, 세트는 이전 공개본으로).
- 재생성(DB 가 바뀌어 DRIFT 가 나면): `npx tsx scripts/audit/apply-audit-fixes.ts --dry-run --readout-out data/audit/2026-10-13-db-readout.json --status-out data/audit/2026-10-13-apply-status.json --emit-sql … --emit-rollback … --emit-verify …`(`--print-sql`, `--only S-01,S-02`, `--readout-in <file>` 오프라인 재계획).
- 패치 입력: `2026-10-13-sat-patch-list.json`(삼각검증 67건) + `2026-10-13-sat-extra-patches.json`(영어 해설 수동 8건, 문자열 치환) + `2026-10-13-scan-patches.json`(DB 스캔이 찾은 기계 패치) + `2026-10-13-apply-overrides.json`(DB 선택지 순서에 맞춘 해설 글자·정답 텍스트·S-07 그림) + AP 그래프 FRQ 3건(변환기 `graphStatedFacts` 지문).
- AP 교체 계획: `scripts/audit/ap-swap-plan-check.ts`(읽기 전용, `data/audit/2026-10-13-ap-swap-readout.json`)로 `ab3-v2`·`bc1-v3-frq`(bc1-v2 에서 이미 적용된 MC 칸을 뺀 FRQ 2칸)·`bc2-v2` 가 현재 공개 버전(AB3 v1, BC1 v2, BC2 v1)에 맞고 후보가 전부 적재돼 있으며 6세트 검증기 위반 0 임을 확인했다. 패널 새 버전과 이 SQL 은 순서에 무관하다(둘 다 그 시점의 공개 버전에서 복사한다).

## 재현

```
python3 scripts/audit/stock-defect-scans.py
STRUCTURE_GROUPS_FILE=data/ap/stock/structure-groups.conservative.json npx tsx scripts/audit/ap-external-audit-swap-plans.ts [--write]
npx vitest run --project unit lib/ap-exam/explanation-math.test.ts lib/ap-exam/convert.test.ts lib/ap-admin/explanation-fix.test.ts lib/ap-exam/tex-audit.test.ts
```


## 라운드 2 (2026-10-13 밤): 판단형 항목 검증·수정, 신규 지적 삼각검증, 근본 원인 수정

라운드 1(69문항 버전/16세트 버전)은 비프로덕션에 적용됐다. 라운드 2 는 라운드 1 이 패치하지 않은 판단형 항목을 **현재 게시 버전(v1/v2 그대로)** 에서 다시 읽어 확인하고(읽기 전용 SELECT), 결함이면 검증된 패치로, 아니면 이유와 함께 기록했다. 패치 원본은 `lib/audit-fix/r2-edits.ts`(편집 함수 + 문항별 why/validation), 생성 결과는 `data/audit/2026-10-13-r2-patches.json`(37건), 계획 상태는 `data/audit/2026-10-13-r2-apply-status.json`.

### A. 외부 감사 폴더 재확인(10-13 00:00 PDT 이후 갱신분)
갱신 파일은 SAT4~7 추가 경로(`findings-sat4/5/6-alt-*`, `findings-sat7-alt-rw2`)뿐이다(audit-report.md 는 10-12 23:47 이후 변경 없음). 새 지적은 두 건이고 나머지는 라운드 1 이 이미 다룬 항목이다.

| 감사 위치 | 내용 | 판정 | 내부 id | 처리 |
|---|---|---|---|---|
| SAT7 alt RW2 Q6 | "a chemical reaction which/that occurs" 둘 다 제한적 관계절로 문법상 유효 | a | gid 5f2cc935-… (SAT7 v3 rw_m2#33) | R2-N01: "which"를 "who"로 바꿈(사물 선행사에 불가) |
| SAT7 alt RW2 Q7 | 표 원자료가 지문 문장과 서식 표에 이중 표시 | a | gid cc5b3af5-… (SAT7 v3 rw_m2#34) | R2-N02: 지문의 원자료 줄 삭제(표 그림 유지) |
| SAT4 alt RW2 Q9, SAT6 alt RW2 Q11·Q24 | 빈칸 뒤 단어 중복 | (라운드 1 S-R10) | rwstock:easy-1:easy-boundaries-100 / medium-boundaries-302 / sesup-medium-boundaries-43 | 라운드 1 적용분 |
| SAT6 alt Math Q15 | 판매자가 구매가를 지출했다고 서술 | a(S-M25 확인) | gid d368cef5-… | R2-M25 |
| SAT6 alt RW2 Q21 | 검수자 풀이 실수로 철회(감사 파일 자체가 철회) | c | — | 조치 없음 |
| SAT4/5 alt Math2·결과 검토 | 확정 P1/P2 없음(관찰만) | — | — | 조치 없음 |
| 길이 후보(SAT5/6 alt RW2 > 155 표준단어) | RW 150단어 초과 | 목록 | — | B 절 목록 |

### B. 판단형 항목 판정

| ID | 판정 | 근거(독립 검증) | 처리 |
|---|---|---|---|
| S-G05 | c 오탐 | 선택지 A는 경쟁 가설(왁스 코팅)을 뒷받침, C·D는 뿌리 가설을 약화 — 뿌리 가설을 직접 뒷받침하는 것은 B 하나 | 조치 없음 |
| S-G07 | a | "In doing so"/"…, however"/"Despite doing so" 셋 다 문법적. 스킬 코드(form_structure_sense)가 전환어 문구를 금지(렌더 검사) → 선택지를 "In doing so, and/which/or"로 바꿔 한 개만 정문 | R2-G07 |
| S-G08 | a | B와 D("She used …, and she was able…") 둘 다 정문, 기존 해설의 "주어 중복 금지"는 규칙 아님. D를 쉼표만 남겨 콤마 스플라이스로 | R2-G08 |
| S-G10(Q21) | a | "and thereby"와 "and, thereby," 둘 다 용인. C를 "and thereby,"(짝 없는 쉼표)로 | R2-G10a |
| S-G10(Q12) | a | "having reviewed …"와 "…and residents' letters carefully" 둘 다 정문. A를 "which having reviewed…", D를 "…submissions and"로 바꿔 오류화 | R2-G10b |
| S-G11(Q8)+스캔 b7c3a411 | a | "meanwhile/consequently/having achieved this" 모두 정문 + "she" 선택지가 지문의 "she became"와 중복. 선택지를 "consequently;/consequently:/consequent"로 바꿔 한 개만 정문 | R2-G11a |
| S-G11(Q22) | a | B("despite these obstacles Noether persisted…, so")도 Noether 가 주어라 정문. B를 "her persistence … so"(현수 수식어)로 | R2-G11b |
| S-G12 | a | singular they 가 허용돼 "their"와 "his or her" 모호. 선행사를 복수("all of whom … instruments")로 바꾸고 정답을 "their"로 | R2-G12 |
| S-G13 | a | "reflecting"와 "a practice reflecting" 둘 다 유효. B를 "which reflecting…"(정동사 없음)로 | R2-G13 |
| S-M17 | a | 매표 수입이 판매 표 수와 함께 60→10 으로 감소(비현실). 선불카드 잔액 맥락으로 재테마(데이터·정답 10 불변), 그림 축 제목 변경 → figure_checked=false | R2-M17 |
| S-M19 | a | 기울기 −5(퍼센트포인트/시간). "By how many percentage points … decrease" | R2-M19 |
| S-M20 | a | 가구 표본인데 "people" 질문. (12/3)²×200=3200 가구 | R2-M20 |
| S-M23 | a | Note 가 인수분해를 알려 줌. 삭제(전개로 정답 (x−5)(x−2)(x+2) 확인) | R2-M23 |
| S-M24 | a | 문두가 이미 동치식을 제시. x²−5x−14=(x−7)(x+2), x²−4=(x−2)(x+2) 이므로 D만 동치(sympy 재계산) | R2-M24 |
| S-M25 | a | 판매자 지출 서술 → 고객 구매로(4·5=20, (32−20)/6=2) | R2-M25 |
| S-M28 | a(9건) | 해설이 값을 하나도 보이지 않고 "다른 표는 정확히 한 군데만 어긋난다"는 근거 없는 템플릿. 실제 표의 모든 행을 계산해 한·영 해설을 재생성(정답 표가 정확히 하나이고 DB 키와 같음을 코드가 검사) | R2-T1~T9 |
| S-P02 | a | 전환어 문항인데 Standard English 문구. 스킬 코드 때문에 문구를 못 바꿔 선택지를 문장부호/접속사 변형("Eventually;" 등)으로 바꿔 한 개만 정문(전환 논리 측면은 포기, 스킬 재분류가 대안) | R2-P02 |
| S-P03 | a | Philips 컴팩트 카세트는 1960년대 초 개발(Ottens 1960 부서장 취임, 나무 블록 원형은 "early 1960s", 1963 공개; Wikipedia "Lou Ottens", Philips Museum 인용). "In 1959" → "In the early 1960s" | R2-P03 |
| S-P04 | a | 타코마 내로스 붕괴는 공진이 아니라 공탄성 플러터(Practical Engineering, Structure magazine, Scanlan). 지문을 "풍력이 계속 에너지를 공급" / "oscillation problems"로 | R2-P04 |
| S-P05 sponge(6273a28a) | a | 해면이 규산질 골격을 영양분으로 소비한다는 근거 없음 → 문헌상 "sponge loop"(용존 유기물 흡수→입자 배출, de Goeij 2013)로 지문·선택지·해설 정렬 | R2-P05-sponge |
| S-P05 bridge(easy-boundaries-101) | a | 2019 네덜란드 재활용 플라스틱 "자전거 다리" 확인 불가. 확인된 것은 2018-09 즈월러 30m PlasticRoad 자전거 도로(Guinness, Yale e360, Total 보도자료). "installed in a single day"도 출처 없음 → 2018 자전거 도로·"installed quickly" | R2-P05-bridge |
| S-P05 fern(205) | a | 부활 고사리는 사막 식물이 아님 → "Many plants that endure dry seasons, such as desert succulents" | R2-P05-fern |
| S-P05 fern(b3de9199) | a | "Certain desert plants, such as the resurrection fern" → "Certain plants"; 선택지 A "other desert organisms" → "other plants" | R2-P05-fern2 |
| S-P05 FRB(3b57dca2) | a(경미) | 2016 발견 보고에서 "수십 번·수개월 반복"은 과장 → "multiple times" | R2-P05-frb |
| S-P05 NGC 6791(ebd8bd34) | a | 병합으로 생긴 별은 성단보다 **젊어 보인다**(blue straggler; Brogaard 2018, arXiv:1809.00705). 지문의 "older" 방향이 반대 → 지문·선택지 B/C·한영 해설을 "younger"로 | R2-P05-ngc |
| S-P05 신호등(963ebc71) | c | Garrett Morgan 1923 특허(정지·진행 사이 주의 위치), 경찰 수동 신호, 신호 연동은 사실과 일치 | 조치 없음 |
| S-P05 망원경(aeaae082) | c | 통과(transit) 주기로 궤도 길이를 구한다는 서술은 정확 | 조치 없음 |
| S-P05 w1-boundaries-m-189 | c | Kuapa Kokoo(가나, 1993, Divine Chocolate 공동 소유) 사실 일치, DB 미적재 | 조치 없음 |
| 스캔 318348e4 | a | 모든 선택지가 "the"/"the fixed exchange rate era"로 끝나는데 지문이 이어서 같은 말을 씀 → 선택지를 "ended"+부호로 | R2-SCAN-318348e4 |
| 스캔 b7c3a411 | a | S-G11(Q8)과 같은 문항 | R2-G11a |
| 스캔 53e14b14 | a | 빈칸 뒤 리터럴 쉼표 + 선택지 "However," 이중 쉼표(세트에 없음) → 지문의 쉼표 삭제 | R2-SCAN-53e14b14 |
| 그림 c5eb51a6 | a | f=x+6, g=2x−5 교점 (11,17) 이 축 [−10,10] 밖 → 축 −20..20(세트에 없음, figure_checked=false) | R2-F-c5eb51a6 |
| RW 150단어 초과 | 목록 | 게시 세트 RW 134개(문자수/6 기준, 150–155 25 · 156–170 55 · 171–200 37 · 200 초과 17). 안전한 기계적 삭제 없음(중심 내용·두 글 비교 문항은 문장을 빼면 문항 자체가 바뀜) | `data/audit/2026-10-13-r2-rw-over150.json` 에 목록만, 작성자 결정 필요 |
| S-M21, S-M27, S-P07 | — | 라운드 1 판정 유지(저영향·주관적) | 조치 없음 |

### C. 라운드 2 SQL
- `data/audit/apply/2026-10-13-r2-apply.sql`(DO 블록 1개 = 트랜잭션, 멱등, DRIFT 시 전체 롤백) → 검증 `…-r2-verify.sql` → 문제 시 `…-r2-rollback.sql`. 적용 대상 37문항 버전 + 세트 새 버전 13개(`r2-apply-status.json`).
- 재생성: `npx tsx scripts/audit/r2-readout.ts`(SELECT 전용 조회) → `npx tsx scripts/audit/r2-build-patches.ts` → `npx tsx scripts/audit/apply-audit-fixes.ts --round2 --dry-run --readout-in data/audit/2026-10-13-r2-readout.json --status-out … --emit-sql … --emit-rollback … --emit-verify …`.
- PGlite 가짜 스키마 하니스로 적용→재적용(멱등, 변화 없음)→롤백→재적용→검증→DRIFT 검출·원자성을 확인했다(대상 DB 쓰기 없음).

### D. 근본 원인 수정
1. **빈칸 이음새 게이트**: `lib/problem-blank-junction.ts`(순수)를 `draftBankGateError`(모의고사·일반 임포트·관리자 저장 공통)에 연결 → sat_rw 빈칸 문항에서 선택지 끝 단어가 빈칸 뒤 첫 단어와 같거나 리터럴 쉼표가 선택지 쉼표와 겹치면 저장·임포트 거절. 테스트 `lib/problem-text-guards.test.ts`.
2. **`fprime_graph_statements`**: 증가 구간을 `r1 < lo < hi <= r2` 로 제한. 회귀 `scripts/ap-generation/archetypes/test_calc_ab_2_fprime.py`(3000 시드).
3. **`equivalent-expressions.ts` 문맥형**: 안쪽 변이 바깥 변보다 길면 두 변의 역할을 바꿔 넓이가 항상 양수. 회귀 `ee-area-context.test.ts`.
4. **맥락 풀**: 값표 기울기 부호를 장면이 정함(`topicSign`을 `figure-topics.ts`로 이동, `makeLinTab` 적용), 산점도 "차 나이→중고 가치"는 음수만, 서술형 선형 모델 풀의 촛불은 증가 서술 금지(`canUp:false`). 회귀 `context-sign.test.ts`.
5. **저장소 원본**: DB 에 없던 R-* 7건·D-* 4건(D-309f9901 포함)의 지문을 `acceptance/import-general.json` 에 반영(`scripts/audit/apply-patches-to-stock.ts`), 테스트 `lib/audit-fix/stock-clean.test.ts`(옛 지문은 새 게이트가 거절함을 함께 확인).

### E. 그림 확인 대기
라운드 1·2 에서 그림이 바뀌어 figure_checked=false 로 저장되는 문항 10건: S-06, S-07, S-08, F-f87e641a, F-c27d0f37, F-8329a1bd, C-aaeb9945, C-445bab61, R2-M17, R2-F-c5eb51a6. 코디네이터가 눈으로 확인한 뒤에만 쓸 수 있는 SQL 은 `data/audit/apply/2026-10-13-figure-checked.PENDING.sql`(기본 실행 불가: 첫 줄 RAISE EXCEPTION 을 지워야 동작).

## 라운드 4 (2026-10-14): 숫자 누락 의심 MC 판정 + 금액 `$` 이스케이프

- 스캔: 공개 AP MC 중 표·그림 설명(stimulus.description)의 숫자가 화면에 없는 문항 10건(Chemistry 8, Calculus BC 1, Microeconomics 1). 풀이에 필요한 자료가 빠진 진짜 결함은 `micro-p2-a:ap_microeconomics-m32-k0`(한계비용 $26 가 화면에 없어 효율 수량을 구할 수 없음; 표 MSB 46·42·32·28·20·10 에서 MC=26 이면 4개 — 정답 4 확인) 1건뿐. Chemistry 8건("298 K"·"25 °C"·"5.0 mL" 는 풀이에 불필요한 캡션/조건 — 문항에 "same temperature"·"same small volume"·100 mL 이 이미 있음, Ka 순위·pH 변화 0.03/8.0 검산 일치)과 BC `s2-graph-bc-final:ap_calculus_bc-m02-k0`(f⁽⁴⁾ 의 "4" 는 표기; Lagrange 오차 3·1.4⁴/4! = 0.4802 = 선택지 C 검산 일치)는 정상.
- 변환기: `frqLostSetup` 이 MC 에도 적용된다(캡션 뒤에 조건 문장이 더 있는 설명 + 화면에 없는 숫자일 때만 — 한 줄 캡션은 그대로).
- 금액 `$`: 본문 렌더러는 이미 `looksLikeCurrencyPair` 로 "$3 … $55" 를 글로 그리지만 저장 문안이 그 휴리스틱에 기대면 게시 검사·수정 도구의 `$` 짝 맞춤과 어긋난다(`lib/problem-content-check.ts` 는 이스케이프된 `\$` 까지 "닫히지 않은 $" 로 잡던 버그도 수정). 저장 표기를 `\$` 로 통일(`lib/currency-dollars.ts`, 화면 모양 불변 검증), `mathToPlain` 도 `\$` 를 글자로 처리.
- 데이터: `data/audit/apply/2026-10-13-r4-{apply,rollback,verify}.sql` (패치 57건: AP 43·SAT 14, 세트 새 버전 4개 — 전부 free 등급 승계).
