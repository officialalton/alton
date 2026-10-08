# AP 문항 은행 재고 보고 (2026-10-08)

기준: 최신 게이트 `v2-code-first-final-2026-10-08` (코드 우선 파이프라인 최종: 결정적 게이트 + Opus 독립 풀이 + Sonnet 5기준 검토 + 난이도 별도 + Fable 표본). 이전 게이트(런1, LLM 생성)로 통과한 항목은 **재검증 필요(needs_revalidation)**이며 자동 승격하지 않는다. 이 보고는 LLM 호출 없이 기존 결과 파일로 계산했다.

## 정의

- **검증 상태**(validation): `rejected` / `needs_revalidation`(최신 게이트 이전 통과) / `auto_passed`(최신 게이트 통과) / `exact_duplicate`(완전 중복, canonical 에 연결·재고 제외).
- **게시 후 검수 상태**(expert_status): `unreviewed` / `in_review` / `approved` / `issues_reported` — 검수 환경에 게시된 뒤 기존 오류 신고 흐름과 표본 승인으로 추적하며 **게시를 막지 않는다**. **검수 환경 게시 가능 = auto_passed + 그래프 렌더링 + 학생 화면 검증**(현재 둘 다 미완료이므로 0). 프로덕션(launch)은 별도 게이트: review_env_ready + 미해결 launch 차단 결함 0(전문가 승인·검수 기간은 조건 아님, 신고 0건은 검수 완료 증거 아님).
- **선택**(selectedForSample)은 별개 속성이며 재고 여부와 무관하다. `legacy reserve`는 샘플에서 선택되지 않은 통과분(과거 표기)이다.
- **문항군(item family)**: 같은 원형·토픽의 숫자/표현 변형 또는 문장 3-gram 유사(>0.8). **반려하지 않으며** 재고에 모두 남기되 군으로 묶는다. **완전 중복(exact)만** 제외한다.
- **칸**(cell) = 토픽 × 주 스킬 × 구조 × 계산기. 칸 채움 = 최신 게이트 통과 문항군별 min(문항 수, 2). 낡은 통과·숫자 변형만으로는 칸이 채워지지 않는다.
- **AB/BC 공유**: AB 재고는 BC 에도 쓸 수 있고(공통 content_key) 합계에서는 소유 과목(AB)에서 **한 번만** 센다. BC 열의 '공유 사용 가능'은 합산에서 제외.

## 1. 과목 × 종류별 집계

| 과목 | 종류 | 전체 행 | 반려 | 완전 중복 제거 | 문항군 수 | 재검증 필요 | **최신 게이트 자동 통과** | 게시 후 승인 | **검수 환경 게시 가능** | 샘플 선택 | legacy reserve | AB 공유 사용 가능 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ap_biology | FRQ | 76 | 73 | 0 | 3 | 3 | **0** | 0 | **0** | 3 | 0 |  |
| ap_biology | MC | 124 | 70 | 0 | 54 | 54 | **0** | 0 | **0** | 24 | 30 |  |
| ap_calculus_ab | FRQ | 84 | 62 | 0 | 14 | 10 | **12** | 0 | **0** | 8 | 14 |  |
| ap_calculus_ab | MC | 256 | 92 | 4 | 100 | 70 | **90** | 0 | **0** | 71 | 89 |  |
| ap_calculus_bc | FRQ | 7 | 3 | 0 | 2 | 0 | **4** | 0 | **0** | 2 | 2 | 22 |
| ap_calculus_bc | MC | 64 | 19 | 1 | 16 | 0 | **44** | 0 | **0** | 22 | 22 | 160 |
| ap_microeconomics | FRQ | 28 | 16 | 0 | 12 | 12 | **0** | 0 | **0** | 3 | 9 |  |
| ap_microeconomics | MC | 144 | 73 | 0 | 71 | 71 | **0** | 0 | **0** | 27 | 44 |  |

- 전체 고유 재고(완전 중복 제외, AB/BC 한 번만): MC 329, FRQ 41 — 이 중 최신 게이트 자동 통과 MC 134, FRQ 16, 재검증 필요(런1) MC 195, FRQ 25.
- 이력: 중간 런(run2a/run2b/run2bc_a/run2bc_b)은 재고에서 제외하고 최종 항목의 history 로만 보존(같은 원형·시드 기준). 파일럿 런은 제외.

## 2. 칸 부족분(최신 게이트 + 문항군 다양성 기준)

목표(기준선): 과목당 MC 50, FRQ 5(오너 기준선). 토픽 목표는 공식 단원 MC 비중으로 단원에 나눈 뒤 단원 내 토픽에 균등 배분. 채움 = 위 정의의 effective. BC 는 BC 전용 + AB 공유 사용분을 합산해 계산.

### ap_calculus_ab (MC, 토픽 목표 합 50, 부족 합 29, 목표가 있는 토픽 중 채움 0 = 29/50, 부족한 토픽 = 29)

| 단원 | 토픽 | 목표 | 최신 통과(문항) | 문항군 | 칸 채움(effective) | 재검증 필요 | 부족 |
|---|---|---|---|---|---|---|---|
| 1 | 1.1 Introducing Calculus: Can Change Occur a | 1 | 0 | 0 | 0 | 0 | 1 |
| 1 | 1.2 Defining Limits and Using Limit Notation | 1 | 0 | 0 | 0 | 0 | 1 |
| 1 | 1.3 Estimating Limit Values from Graphs | 1 | 0 | 0 | 0 | 4 | 1 |
| 1 | 1.5 Determining Limits Using Algebraic Prope | 1 | 0 | 0 | 0 | 0 | 1 |
| 1 | 1.6 Determining Limits Using Algebraic Manip | 1 | 0 | 0 | 0 | 0 | 1 |
| 2 | 2.1 Defining Average and Instantaneous Rates | 1 | 0 | 0 | 0 | 0 | 1 |
| 2 | 2.2 Defining the Derivative of a Function an | 1 | 0 | 0 | 0 | 2 | 1 |
| 2 | 2.5 Applying the Power Rule | 1 | 0 | 0 | 0 | 0 | 1 |
| 2 | 2.6 Derivative Rules: Constant, Sum, Differe | 1 | 0 | 0 | 0 | 0 | 1 |
| 3 | 3.3 Differentiating Inverse Functions | 1 | 0 | 0 | 0 | 0 | 1 |
| 3 | 3.4 Differentiating Inverse Trigonometric Fu | 1 | 0 | 0 | 0 | 0 | 1 |
| 4 | 4.1 Interpreting the Meaning of the Derivati | 1 | 0 | 0 | 0 | 2 | 1 |
| 4 | 4.3 Rates of Change in Applied Contexts Othe | 1 | 0 | 0 | 0 | 1 | 1 |
| 4 | 4.5 Solving Related Rates Problems | 1 | 0 | 0 | 0 | 1 | 1 |
| 5 | 5.2 Extreme Value Theorem, Global Versus Loc | 1 | 0 | 0 | 0 | 3 | 1 |
| 5 | 5.3 Determining Intervals on Which a Functio | 1 | 0 | 0 | 0 | 0 | 1 |
| 5 | 5.5 Using the Candidates Test to Determine A | 1 | 0 | 0 | 0 | 0 | 1 |
| 5 | 5.7 Using the Second Derivative Test to Dete | 1 | 0 | 0 | 0 | 4 | 1 |
| 5 | 5.8 Sketching Graphs of Functions and Their  | 1 | 0 | 0 | 0 | 0 | 1 |
| 6 | 6.1 Exploring Accumulations of Change | 1 | 0 | 0 | 0 | 0 | 1 |
| 6 | 6.3 Riemann Sums, Summation Notation, and De | 1 | 0 | 0 | 0 | 0 | 1 |
| 6 | 6.5 Interpreting the Behavior of Accumulatio | 1 | 0 | 0 | 0 | 0 | 1 |
| 6 | 6.8 Finding Antiderivatives and Indefinite I | 1 | 0 | 0 | 0 | 0 | 1 |
| 7 | 7.1 Modeling Situations with Differential Eq | 1 | 0 | 0 | 0 | 0 | 1 |
| 7 | 7.2 Verifying Solutions for Differential Equ | 1 | 0 | 0 | 0 | 4 | 1 |
| 7 | 7.4 Reasoning Using Slope Fields | 1 | 0 | 0 | 0 | 0 | 1 |
| 8 | 8.2 Connecting Position, Velocity, and Accel | 1 | 0 | 0 | 0 | 2 | 1 |
| 8 | 8.5 Finding the Area Between Curves Expresse | 1 | 0 | 0 | 0 | 1 | 1 |
| 8 | 8.6 Finding the Area Between Curves That Int | 1 | 0 | 0 | 0 | 0 | 1 |

### ap_calculus_bc (MC, 토픽 목표 합 50, 부족 합 28, 목표가 있는 토픽 중 채움 0 = 28/50, 부족한 토픽 = 28)

| 단원 | 토픽 | 목표 | 최신 통과(문항) | 문항군 | 칸 채움(effective) | 재검증 필요 | 부족 |
|---|---|---|---|---|---|---|---|
| 1 | 1.1 Introducing Calculus: Can Change Occur a | 1 | 0 | 0 | 0 | 0 | 1 |
| 1 | 1.2 Defining Limits and Using Limit Notation | 1 | 0 | 0 | 0 | 0 | 1 |
| 1 | 1.3 Estimating Limit Values from Graphs | 1 | 0 | 0 | 0 | 4 | 1 |
| 2 | 2.1 Defining Average and Instantaneous Rates | 1 | 0 | 0 | 0 | 0 | 1 |
| 2 | 2.2 Defining the Derivative of a Function an | 1 | 0 | 0 | 0 | 2 | 1 |
| 3 | 3.3 Differentiating Inverse Functions | 1 | 0 | 0 | 0 | 0 | 1 |
| 3 | 3.4 Differentiating Inverse Trigonometric Fu | 1 | 0 | 0 | 0 | 0 | 1 |
| 4 | 4.1 Interpreting the Meaning of the Derivati | 1 | 0 | 0 | 0 | 2 | 1 |
| 4 | 4.3 Rates of Change in Applied Contexts Othe | 1 | 0 | 0 | 0 | 1 | 1 |
| 5 | 5.2 Extreme Value Theorem, Global Versus Loc | 1 | 0 | 0 | 0 | 3 | 1 |
| 5 | 5.3 Determining Intervals on Which a Functio | 1 | 0 | 0 | 0 | 0 | 1 |
| 5 | 5.5 Using the Candidates Test to Determine A | 1 | 0 | 0 | 0 | 0 | 1 |
| 6 | 6.1 Exploring Accumulations of Change | 1 | 0 | 0 | 0 | 0 | 1 |
| 6 | 6.3 Riemann Sums, Summation Notation, and De | 1 | 0 | 0 | 0 | 0 | 1 |
| 6 | 6.5 Interpreting the Behavior of Accumulatio | 1 | 0 | 0 | 0 | 0 | 1 |
| 6 | 6.8 Finding Antiderivatives and Indefinite I | 1 | 0 | 0 | 0 | 0 | 1 |
| 7 | 7.1 Modeling Situations with Differential Eq | 1 | 0 | 0 | 0 | 0 | 1 |
| 7 | 7.2 Verifying Solutions for Differential Equ | 1 | 0 | 0 | 0 | 4 | 1 |
| 8 | 8.2 Connecting Position, Velocity, and Accel | 1 | 0 | 0 | 0 | 2 | 1 |
| 9 | 9.4 Defining and Differentiating Vector-Valu | 1 | 0 | 0 | 0 | 0 | 1 |
| 9 | 9.5 Integrating Vector-Valued Functions | 1 | 0 | 0 | 0 | 0 | 1 |
| 10 | 10.1 Defining Convergent and Divergent Infini | 1 | 0 | 0 | 0 | 0 | 1 |
| 10 | 10.3 The nth Term Test for Divergence | 1 | 0 | 0 | 0 | 0 | 1 |
| 10 | 10.4 Integral Test for Convergence | 1 | 0 | 0 | 0 | 0 | 1 |
| 10 | 10.5 Harmonic Series and p-Series | 1 | 0 | 0 | 0 | 0 | 1 |
| 10 | 10.6 Comparison Tests for Convergence | 1 | 0 | 0 | 0 | 0 | 1 |
| 10 | 10.7 Alternating Series Test for Convergence | 1 | 0 | 0 | 0 | 0 | 1 |
| 10 | 10.8 Ratio Test for Convergence | 1 | 0 | 0 | 0 | 0 | 1 |

### ap_biology

최신 게이트 통과 0(런1 LLM 생성 방식만 존재) → **전 항목 재검증 필요**. 재검증 필요 MC 54개가 24개 토픽에 분포(토픽 60개 중). 칸 채움 = 0, 부족 = 목표 50 전부. 다음 생성은 코드 우선 원형이 준비된 뒤 부족 토픽에만.

### ap_microeconomics

최신 게이트 통과 0(런1 LLM 생성 방식만 존재) → **전 항목 재검증 필요**. 재검증 필요 MC 71개가 25개 토픽에 분포(토픽 36개 중). 칸 채움 = 0, 부족 = 목표 50 전부. 다음 생성은 코드 우선 원형이 준비된 뒤 부족 토픽에만.

## 3. FRQ 재고(템플릿 단위)

| 과목 | 최신 통과 FRQ(문항) | 문항군(=채움, FRQ 는 군당 1) | 재검증 필요 | 목표 | 부족 |
|---|---|---|---|---|---|
| ap_calculus_ab | 12 | 4 | 10 | 5 | 1 |
| ap_calculus_bc | 4 | 2 | 0 | 5 | 3 |
| ap_biology | 0 | 0 | 3 | 5 | 5 |
| ap_microeconomics | 0 | 0 | 12 | 5 | 5 |

## 4. 칸 분포(어느 칸이 0 또는 적은가)

- ap_calculus_ab: 관측된 칸 59개(토픽×스킬×구조×계산기) — 채움 1: 4, 2: 30, 3 이상: 0. 한 문항군이 3개 이상 문항을 가진 칸: 24(변형이 많아도 채움은 문항군당 2개까지만 인정).
- ap_calculus_bc: 관측된 칸 77개(토픽×스킬×구조×계산기) — 채움 1: 5, 2: 47, 3 이상: 0. 한 문항군이 3개 이상 문항을 가진 칸: 33(변형이 많아도 채움은 문항군당 2개까지만 인정).
- 위 '부족' 표의 토픽만 다음 생성 대상(칸 단위 1개 후보 → 실패한 칸에만 추가). 구조(FRQ 유형·세트)는 템플릿이 없는 유형이 먼저 부족(입자 운동·음함수 관련 변화율 FRQ, Bio·Micro 전부).


## 5. 현재(783행) vs 이전 적재(767행) 대조와 DB 일치

- **현재 배치 = 새 형식 행 783**(런1 576 + 런2 136 + 런2bc 71; 위 표의 전체 행 합). **이전 적재 = 구 형식 행 767**(삭제하지 않고 `is_current=false` 로 표시). 이전 적재의 내역은 파일이 아니라 DB 에만 있으므로 아래 SQL 로 조회한다:
```sql
select batch, is_current, subject, kind, rows, unique_items, item_families, auto_passed, needs_revalidation, rejected, exact_duplicates from ap_stock_by_batch_v order by is_current desc, subject, kind;
```
- 현재 집계의 단일 출처는 DB 뷰 `ap_stock_summary_v`(현재 배치만). 파일 집계와의 일치는 `scripts/ap-generation/stock-consistency.ts`(읽기 전용)로 점검한다.
- **로컬 검증(트랜잭션 후 롤백)**: 783행을 로컬 DB 에 적재한 뒤 `ap_stock_summary_v` 를 조회해 위 표 8행(과목×종류)의 전체 행·반려·완전 중복·재검증 필요·자동 통과·고유 문항·문항군이 **파일 집계와 전부 일치**함을 확인했다(총 783행).
- 표식 방법: `select * from ap_mark_load_batches('<cutoff>', 767, 783, false);`(dry-run) → 건수 일치 시 `true`. 상세: `docs/ap/publication-flow.md` §표식.

