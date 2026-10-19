# AP 외부 검수(2026-10-15) 유형 단위 수정 — 원형 수정·전수 목록·교체 계획

기준: `docs/audits/ap-external-audit-20261015-report.md`, `…-confirmed-fixes.csv`. 검수 이후 `fix1015`·`aud1015`·`audit-wuel` 교체안이 **지적된 문항만** 고쳤다. 이 문서는 같은 생성기 결함이 *다른 문항*에 남았는지를 유형(원형·템플릿) 단위로 찾아 (1) 원형 코드를 고치고 (2) 재고·공개 구성의 같은 유형 문항을 전수 목록으로 만들고 (3) 공개 문항의 새 버전 교체안을 만든 기록이다. **원형 수정은 이미 저장된 문항을 바꾸지 않는다** — 기존 문항은 복제본(새 키 `fix1019:…`)을 고쳐 교체안으로만 바꾼다.

재현: `python3 scripts/audit/ap-type-defect-scan.py --write`(전수 목록 JSON: `data/audit/ap-type-defect-scan-20261019.json`), `python3 scripts/audit/ap-type-defect-summary.py --write`(단계별 과목별 표: `data/audit/ap-type-defect-summary-20261019.json`). 공개 구성 = 정확 배정(exact-assign-*) + 모든 교체안 파일을 순서대로 적용해 재구성(PH1·PH2 는 PH3·PH4 로 대체되어 미공개, 미적분은 `exact-assign-5sets-cons`·`ab-full-set-selection` 기준).

## 1. 결과 요약

- **고친 원형 20개 계열**(아래 §2; `bif_q1/q2/q6` 는 3개 계열로 셈), 새 안전망 3개: (a) 모든 FRQ 원형 결과에 `ensure_setup_visible`(registry.batch), (b) Micro·Macro MC 생성기 `mk` 가 설명에만 있는 수치를 거부, (c) 단위 테스트 `test_audit_1019.py`(14개) — 이전 원형 코드에서는 13개 실패, 지금은 전부 통과.
- **같은 결함 유형의 공개 문항**: 검수가 짚은 행 밖에서 새로 찾은 것은 **FRQ 11건**(Bio 4·Chem 2·Micro 1·Stats 2·Calc 2) — 전부 새 버전 교체안으로 만들었다(§4). 나머지 유형(카이제곱 동치 귀무, 분기점 방향, 용질 퍼텐셜, UV 전제, 표본비율, 충돌 반올림, 꺾은선 전제)은 공개 구성에서 이미 지적된 그 한 문항뿐이었고 `fix1015`·`aud1015` 교체안이 덮고 있다. 같은 유형의 *비공개 예비 재고*는 전수 목록에 있다(§3).
- **독립 풀이 검증**: Opus 5.5 배치로 교체 후보 11건 + 고친 원형이 지금 내는 표본 27건 = 38건 전부 통과(`data/audit/ap-fix1019-independent-solve.json`; 첫 실행 36/38에서 원형 결함 2건을 추가로 찾아 고친 뒤 재실행). 유료 비용 합계 약 $0.73(한도 $5).
- 원격 DB·Production·관리자 UI 적재·공개는 하지 않았다. 후보는 `supp-fix1019`(관리자 '재고 관리'에서 적재해야 교체안을 쓸 수 있음) — 적재 후 각 교체안으로 새 버전 초안을 만든다.

## 2. 고친 원형(유형별)

| 유형 | 원형(파일) | 결함 | 수정 |
|---|---|---|---|
| (a) 카이제곱 설정 | `st_chisq_setup`(`stats_s3_p.py`) | 동질성(분포 동일)과 독립성 귀무는 모집단에서 동치인데 한 문항 보기에 같이 나와 복수 정답 | 오답 보기를 같은 검정의 *대립가설을 귀무 자리에 쓴 것*("not the same", "associated")으로 교체. 문항 본문이 모집단을 보기와 같은 말로 쓰도록(예: "students at a large high school") 맞춤. 가이드 JSON 오개념 문구도 갱신 |
| (b) 표 FRQ 제목·설명 | `bif_q1_*`·`bif_q2_*`·`bif_q6_*`(`bio_p0_frq.py`·`bio_p0_l.py`) | 제목을 `intro[:40]`/`[:60]` 로 잘라 문장이 끊기고, 실험 소개는 학생에게 안 보이는 `stimulus.description` 에만 있음 | 제목 = 실험 소개 전체(`setup_title`, 글자 수로 자르지 않음) |
| (b) 전 과목 FRQ | `registry.batch` → `ensure_setup_visible`(`frq_visible.py`) | 같은 구조(설명에만 있는 표본 크기·온도·가격). 예: `chf_long_kinetics`(310 K), `mif_short_labor`(출력가 $3·임금 $55), `stfrq_q2_regression`(관측 수), `bif_q6_*`(n) | 학생 글에 없는 설명 정보가 있으면 제목을 설명 전체로 바꾼다(멱등). FRQ 7개 레지스트리의 전 원형 출력으로 테스트 |
| (c) 필수 값이 해설에만 | `mi_public_good_efficient`(`micro_p0_e.py`) | 한계비용 $26 이 표 설명·해설에만 있음 | 문항 본문에 "The marginal cost of providing each unit of the public good is $26." |
| (c) Micro·Macro 전체 | `micro_common.mk`·`macro_common.mk` | 표의 description 은 화면에 안 나오는데 값이 거기에만 있어도 생성이 통과됨 | `hidden_setup` 검사로 생성 단계에서 거부(Micro 110·Macro 165 원형 전부 통과 확인) |
| (d) 분기점 방향 | `bif_q5_replication`(`bio_p0_frq.py`) | 복제분기점 진행 방향이 그림 설명(숨김)에만 있어 선도 가닥 주형이 정해지지 않음 | 제목과 파트 A 문장에 방향을 넣음 |
| (d) 삼투 참고답 | `bif_q2_potato`(`bio_p0_frq.py`) | NaCl 이온이 많으면 용질 퍼텐셜이 *더 크다*고 서술 | "lower (more negative)" 로 정정 |
| (d) UV 전제 | `bif_q3_uvbacteria`(`bio_p0_l.py`) | UV 노출이 치명적이면 집락이 줄 수 있는데 증가를 단정 | 자극에 "UV 선량이 낮아 대부분 세포가 산다" 명시, 예측은 그 전제 조건부 |
| (d) 개체 수 | `bis_population_set`(`bio_p0_f.py`) | 798→800 인데 "변화를 멈춘다" | "changes very little" |
| (d) 표본비율 | `st_pvalue_interpretation`(`stats_s1_h.py`) | 표본비율을 n 과 무관하게 반올림(n=200 에서 .459 = 91.8명) | 정수 개수 x/n 으로 만들고 n 은 200·250·500 |
| (d) 회귀 참고답 | `stfrq_q2_regression`(`stats_s2a_frq.py`) | 외삽 참고답이 "자료의 범위 1~10" 이라 쓰지만 뽑힌 표본의 x 최댓값은 9(독립 풀이로 발견) | 실제 최소·최대로 서술 |
| (d) 반올림 전제 | `ph_evid_collision_data`(`phys_p0_g.py`) | 학생에게 보이는 속도(.3g)로 다시 계산하면 보기 값과 어긋남 | 두 속도가 3자리 유효숫자로 정확한 경우만 생성 |
| (d) 수학 전제 모순 | `g_lagrange_decimal_calc`·`g_taylor_deriv_graph`(`calc_graph_e.py`), `g_lagrange_p2_calc`(`calc_graph_h.py`), `lagrange_graph`(`calc_bc_topup.py`), `g_lhopital_graph`(`calc_graph_a.py`) | 꺾은선 도함수 그래프에 "모든 차수의 도함수가 존재" / 선분 그래프에 "미분 가능한 함수" | "continuous k-th derivative" 로 한정, 미분가능 조건은 해당 점으로 한정 |
| (d) 참고답 정밀성 | `frq_fprime_graph`(`calc_ab_frq.py`) | "f′ 증가 = f″ > 0" 로 쓰고 꺾임에서의 미정의를 생략 | 이유 행은 "f′ is increasing" 만 요구 |
| (d) CSA 범위 | `cs_compile_error`(`csa_p0_a.py`) | char·long·float 선언을 보기 판정에 사용(범위 밖) | int·double·boolean·String 만 사용 |
| (d) CSA 전제 | `cs_describe_list`(`csa_p0_b.py`) | 최대 원소 위치 문항에 비어 있지 않다는 전제 없음 | "Assume that list contains at least one element." |

## 3. 같은 결함 문항 수(과목별)

"재고"는 `data/ap/stock/*items.json` 의 후보(수정본 복제 후보 제외), "검수 전 공개"는 모든 교체안을 적용하기 전 게시 구성, "1015 후"는 `fix1015`·`aud1015`·`audit-wuel` 교체안 적용 후, "1019 후"는 이번 교체안 적용 후다. 문항 단위 목록(과목·세트·문항 번호·키)은 `data/audit/ap-type-defect-summary-20261019.json` 의 `items`.

| 유형(탐지) | 재고 | 검수 전 공개 | 1015 후 공개 | 1019 후 공개 | 과목별 재고 |
|---|---|---|---|---|---|
| a 카이제곱 동치 귀무 | 3 | 3 | 0 | 0 | Stats 3 |
| b 설명에만 있는 실험 소개·값 | 64 | 13 | 10 | **1** | Bio 43·Chem 7·Micro 4·Stats 5·Macro 3·English Language 2 |
| b 제목이 잘림 | 8 | 2 | 0 | 0 | Bio 8 |
| d 분기점 방향 | 2 | 1 | 0 | 0 | Bio 2 |
| d 용질 퍼텐셜 참고답 | 1 | 1 | 0 | 0 | Bio 1 |
| d UV 비치명 전제 | 1 | 1 | 0 | 0 | Bio 1 |
| d "변화를 멈춘다" | 3 | 1 | 0 | 0 | Bio 3 |
| d 표본비율≠x/n | 1 | 1 | 0 | 0 | Stats 1 |
| d 회귀 참고답 범위 | 1 | 0 | 0 | 0 | Stats 1(비공개 예비) |
| d 반올림된 보이는 값 | 1 | 1 | 0 | 0 | Physics 1 |
| d 꺾은선·미분가능 전제 모순 | 6 | 4 | 0 | 0 | Calc AB 1·BC 5 |
| d 오목성 참고답(f″) | 6 | 5 | 2 | **0** | Calc AB 6 |
| d CSA 범위·배점(char·long, 9점 FRQ) | 28 | 10 | 0 | 0 | CSA 28(범위·FRQ 배점은 §6) |

남은 공개 1건은 English Language 1 FRQ1(`elfrq_fb1`)의 *차트 대체 글*(그림이 값을 보여 주는 alt text)이라 학생 정보 결손이 아니다 — 탐지 규칙의 알려진 예외.

비공개 예비 재고의 같은 유형 문항은 `data/audit/ap-type-defect-scan-20261019.json` 의 `detectors.<유형>.stockItems` 에 있다. **새 세트·버전을 조립할 때 이 키들은 쓰지 말고 이번 수정본으로 교체해 쓴다**(원형은 고쳤지만 저장된 문항은 그대로다). 예비 문항 자체를 일괄 교정하는 것은 이번 범위가 아니다.

## 4. 공개 문항 교체안(새 버전, 후보 11건)

후보 = 게시 문항의 복제본에서 학생이 보는 제목(설정·값) 또는 참고답 문구만 고친 것(정답 키 불변), 새 키 `fix1019:…`. 후보 파일 `data/ap/stock/supp-fix1019-items.json`(+`-pass-keys.json`, 렌더 보고 `data/ap/render-check/report-fix1019.json`), 생성기 `scripts/audit/ap-audit-typefix-1019.ts`, 교체안 생성·독립 검증기 `ap-audit-typefix-1019-plans.ts`, 미적분 검증 `ap-typefix-1019-verify.ts`.

| 세트 · 위치 | 원본 키 | 새 키 | 유형 | 교체안 파일 |
|---|---|---|---|---|
| BI1 FRQ1 | `bio-v3a:ap_biology-f01-k0` | `fix1019:ap_biology-tf02-k0` | b (`bif_q1`) | `bi1-v7-audit-1019-swap-plan.json` |
| BI1 FRQ6 | `bio-s2-frq:ap_biology-f24-k0` | `fix1019:ap_biology-tf03-k0` | b (`bif_q6`) | `bi1-v7-audit-1019-swap-plan.json` |
| BI2 FRQ1 | `bio-s2-frq:ap_biology-f01-k0` | `fix1019:ap_biology-tf01-k0` | b (`bif_q1`) | `bi2-v7-audit-1019-swap-plan.json` |
| BI2 FRQ6 | `bio-v3c:ap_biology-f02-k0` | `fix1019:ap_biology-tf04-k0` | b (`bif_q6`) | `bi2-v7-audit-1019-swap-plan.json` |
| CH1 FRQ3 | `chem-s2-f4:ap_chemistry-f03-k0` | `fix1019:ap_chemistry-tf05-k0` | b (`chf_long_kinetics`, 310 K) | `ch1-v2-audit-1019-swap-plan.json` |
| CH2 FRQ3 | `chem-s2-f2:ap_chemistry-f03-k0` | `fix1019:ap_chemistry-tf06-k0` | b | `ch2-v3-audit-1019-swap-plan.json` |
| MI1 FRQ3 | `micro-p1-b:ap_microeconomics-f05-k0` | `fix1019:ap_microeconomics-tf07-k0` | c (`mif_short_labor`, $3·$55) | `mi1-v2-audit-1019-swap-plan.json` |
| ST1 FRQ2 | `stats-s2b-c:ap_statistics-f02-k0` | `fix1019:ap_statistics-tf08-k0` | b (`stfrq_q2_regression`, 18건) | `st1-v4-audit-1019-swap-plan.json` |
| ST2 FRQ2 | `stats-s3b-c:ap_statistics-f02-k0` | `fix1019:ap_statistics-tf09-k0` | b (16건) | `st2-v3-audit-1019-swap-plan.json` |
| AB2 FRQ-B(ap_frq_b #2) | `run2:ap_calculus_ab-f02-k3` | `fix1019:ap_calculus_ab-tf11-k0` | d (`frq_fprime_graph`) | `ab2-v3-audit-1019-swap-plan.json` |
| AB3 FRQ-B(ap_frq_b #2) | `run2:ap_calculus_ab-f02-k2` | `fix1019:ap_calculus_ab-tf12-k0` | d | `ab3-v4-audit-1019-swap-plan.json` |

검증: 비미적분 7개 교체안은 해당 과목 독립 검증기(`verifyStats/Bio/Micro/Chem Assignment`)에 두 세트를 함께 넣어 교체 전·후 위반 0 → 0(새 위반 없음). 미적분 2개는 게시 구성 6세트 전체에 적용해 위반 0 → 0, 풀에 없는 키 0. 후보는 렌더(`gateCandidate`)·변환(`planConversion`)·결정적 게이트·생성기 결함 검사를 원본 대비 새 위반 없이 통과했다. 새 버전 적용 절차는 `docs/ap/set-new-version-design.md`(후보 적재 → review_env_ready → 새 버전 초안 → 검수 환경 확인).

## 5. 검증 기록

- Python `scripts/ap-generation/archetypes/test_audit_1019.py` 14개(FRQ 7개·MC 8개 레지스트리의 전 원형 생성 포함), 이전 원형 코드에서 실행하면 13개 실패(린트 자체 테스트 1개만 통과)임을 확인.
- Vitest `lib/ap-generation/audit-1019-type-fixes.test.ts`: 원형 단위 테스트 실행, 후보 재현·게이트, 교체안 검증, 유형 전수 스캔(공개 구성 잔여 = 알려진 예외 1건).
- 독립 풀이(유료): 첫 실행에서 `st_chisq_setup` 표본의 본문·보기 모집단 표현 불일치와 `stfrq_q2_regression` 참고답 범위 오류를 찾아 원형을 고치고 재실행해 38/38. 결과 `data/audit/ap-fix1019-independent-solve.json`(1회차 `…-run1.json`).

## 6. 고치지 않은 것과 이유(오너 결정·후속)

1. **CSA FRQ 배점(9점 ×4 → 7·7·5·6)**: `CSA_FRQ_PROFILE`(`lib/ap-generation/gates.ts`)·FRQ 원형 16개·가이드·`csa-archetypes.test.ts`·`test_csa_p0.py` 가 9점을 전제로 묶여 있고, 이 환경에는 JDK 가 없어 CSA 검증 스위트(Java 컴파일·실행)를 돌릴 수 없다. 공개 8문항은 `aud1015` 교체안이 7/7/5/6 으로 이미 덮었다. 원형 쪽 수정은 JDK 가 있는 세션에서 프로필·게이트·원형·테스트를 한 번에 바꾸는 별도 작업으로 남긴다.
2. **`cs_char_arith` 원형**(char 산술은 현행 범위 밖): 스테이지 목록·가이드 JSON·동결 구성 파일·`TestPaidRunPlan` 이 이름을 참조해 같은 이유로 퇴역을 미뤘다. 지금은 공개 구성에 char 코드가 없다(`aud1015` 교체). 새 조립에서는 이 원형의 재고(`cs_char_arith` 2건)를 쓰지 않는다.
3. **에세이 참고답 점수·해설 충돌**(World·US History DBQ/LEQ, Literature): LLM 작성 샘플이라 원형이 없다. 구조 게이트(총점=항목 합, 점수대, 단조성)는 이미 있고 의미 충돌은 정규식으로 안정적으로 잡히지 않았다(시험해 본 결과 오탐뿐). 지적된 행은 `audit-wuel` 교체안이 덮었다. 권고: 샘플별 독립 채점자 한 번 더(별도 승인·예산).
4. **Calc AP-015/016 · EL 차트 대체 글**: LLM 작성 문항(원형 없음)이거나 정보 결손이 아니다.
5. **관찰(조치 안 함)**: Macro·Micro FRQ 일부는 *체제 조건*("floating exchange rate", "recessionary gap", "constant-cost" 등)이 한 문장짜리 표 설명에만 있다(`maf_short_fx_trade`·`maf_short_fiscal_multiplier`·`maf_long_adas_policy`·`mif_long_pc_firm` 등, 공개 구성에 4세트분). 검수 지적은 없고, 수치·장문 서술이 아니라 `ensure_setup_visible` 의 대상이 아니다(안전망은 수치 결손과 두 문장 이상의 실험 소개만 본다). 다음 라운드에서 같은 방식(제목에 완전한 문장)으로 묶어 처리할지 오너가 정한다.
