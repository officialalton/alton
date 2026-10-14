# AP Biology P0 무료 엔지니어링 (2026-10-13~14)

범위: 유료 호출·DB·키·push·삭제 없음(P0). 공식 사실은 `docs/ap/biology-facts.md`(CED V.1 ©2025 직접 대조). 구조는 `chemistry-groundwork.md`·`csa-groundwork.md` 와 같은 패턴(코드 우선 원형 → 결정적 게이트 → 동결 골격 → 예산)이다.
이전 Bio 작업(`bio-frq-bottleneck.md`: LLM 이 루브릭·키·표를 모두 설계 → 런1 FRQ 76 후보 중 통과 3)이 멈춘 원인(루브릭 설계 오류·키/허용 답 불일치·메타데이터 불일치·파트별 스킬 구조 불일치)은 **코드가 표·키·루브릭 행을 만들고 구조를 공식 FRQ 구조(Q1–Q6)에 고정**하는 것으로 처음부터 없앴다.

## 1. 결과 요약
- Python 원형 **단독 MC 163 + 4문항 세트 8(문항 32) + FRQ 6유형 29시나리오**(Q1 4·Q2 4·Q3 5·Q4 5·Q5 5·Q6 6). 8단원 전부, 계산형은 **두 독립 경로**(정의가 다른 두 공식 / 정확 분수 vs numpy·열거·시뮬레이션)로 정답을 확인하고 불일치 시 시드를 건너뛴다. 개념형은 **고정 문장 은행**(정답 1 + 이름 붙은 오개념 3, 시나리오 은행에서 시드로 선택).
- **공식 단원·Practice 범위가 처음부터 계획에 내장**: 단원 MC 8–11/10–13/12–16/10–15/8–11/12–16/13–20/10–15 %(CED p.198)와 Practice MC P1 25–33·P2 16–24·P3 8–14·P4 8–14·P5 8–14·P6 20–26 %(CED p.201)를 60문항에 옮긴 정수 범위 안에서 `bio_coverage.py`(정수계획)가 **한 벌과 서로 겹치지 않는 두 벌(BI1·BI2)** 의 조립 가능을 보장한다(원형을 두 회 합쳐 최대 한 번; 회마다 세트 정확히 2개). 라이브러리 원형 15 % 임의 손실 8회 전부, 20 % 손실 12회 전부 조립 가능(30 % 는 불가).
- 테스트: Python unittest **27**(결정성·선택지 구조·길이 단서·간격·수치 진실·구조 중복·조립 정수계획·FRQ 구조) + Vitest(`biology-archetypes.test.ts` 등 TS 게이트·가이드 일치·세트·그림·FRQ 게이트·도구 구성) 통과.
- 시험 도구: `ap_biology` → 공학용 계산기 + **Biology Reference 패널**(식 시트 5묶음 + 카이제곱 임계값 표 + 접두어, "ALTON study reference — not the official College Board sheet").
- 동결 골격(미동결·미실행): `config/ap-frozen/bio-p1-a.template.json`(MC 21칸 24문항, 상한 $2.2), `bio-p1-b.template.json`(FRQ 6, 상한 $0.8).
- 무료 배선 점검: `AP_FIXED_WORDING=1 AP_REQUIRE_BLUEPRINT=1 AP_LIST=bio_all AP_MC_CANDS=4 AP_FRQ_CANDS=3 pipeline2.ts plan|blueprint|check` — 후보 833건 중 설계도 실패 0(수정 후), 결정적 게이트 통과 100 %(수정 후 재확인).

## 2. 코드 구성(전부 `scripts/ap-generation/archetypes/`)
| 파일 | 내용 |
|---|---|
| `bio_common.py` | 식 시트 상수(R=0.0831·카이제곱 임계값 표), 설계도 `mk`(오답 why 에서 오개념 자동 생성·25자 미만/중복 거부·**키가 가장 길고 평균의 1.5배면 거부**·선택지 병렬성 검사), `make_bank_archetype`(시나리오 은행 → 모듈 전역 함수), 선택지 도구(정수·값·분수), 표·막대·가닥 자극 빌더, 코돈표·번역·상보 가닥 도구 |
| `bio_p0_a.py` | U1(13)·U2(17): 물 성질·거대분자·탈수 축합 수·샤가프·수소 결합 수·단백질 구조·표면적:부피·수분 퍼텐셜·삼투 방향·삼투 질량 변화·막 수송 유형·막 그래프·세포 소기관·엔도솜 공생 |
| `bio_p0_b.py` | U3(16)·U4(14): 효소 속도 계산·억제제 자료·pH 그래프·활성화 에너지 도표·광합성 자료·잎 원판 ET50·호흡 속도 비·제한 요인·신호 증폭·되먹임 그래프·세포 주기 시간·유사분열 지수·DNA 함량 그래프·사이클린 그래프·경로 돌연변이 표 |
| `bio_p0_c.py` | U5(14)·U6(17): 감수 분열 염색체 수·배우자 조합·확률(단성·이성 교배)·검정 교배·**카이제곱(df = 결과 수 − 1)**·연관 지도·가계도·반성 유전·복제 가닥·전사·번역·돌연변이 효과·lac 오페론·제한 효소·젤·PCR·형질 전환 |
| `bio_p0_d.py` | U7(20)·U8(18): 선택 유형 그래프·선택 자료·대립유전자 빈도·하디–바인베르크 3종·분자 시계·계통수(형질 표·DNA 차이 표)·표류 시뮬레이션 그래프·개체군 성장 계산 3종·성장 그래프·영양 단계 에너지·심프슨 다양도 2종·군집 상호작용·포식자–피식자 RK4 |
| `bio_p0_e.py` | **Practice 3(질문·방법) 14원형**·오차 막대 5.B·SE·평균·자료 서술 4.B·막대 그래프·논증 6.B–6.D(메셀슨–스탈·그리피스·완두 비율) — 공식 P3 8–14 % 를 처음부터 채우기 위한 원형 |
| `bio_p0_f.py` | 공유 자료 세트 6(문항 4개: 효소·카이제곱·세포 주기·개체군·수분 퍼텐셜·HW) |
| `bio_p0_g.py` | 두 회 조립 여유 보강(U1·P1·P2 원형 6)과 세트 2(번역·돌연변이, 잎 원판) |
| `bio_p0_frq.py` | FRQ 6유형(아래 §4) |
| `bio_coverage.py` | 공식 단원·Practice 범위, **한 벌/겹치지 않는 두 벌 조립 정수계획**(`assemble_check`·`assemble_two_check`), FRQ 점수 |
| `bio_p0_stages.py`·`registry.py` | 파일럿 단계 `bio_p1_mc`(단독 20 + 세트 1)·`bio_p1_frq`(6), 자동 등록(`bi_`·`bis_`·`bif_`), `guide-bio`·`guide-bio-frq` |
| `test_bio_p0.py` | Python 테스트 27 |
TS: `lib/ap-generation/subjects/bio.ts`(+`bio-archetypes.json` 가이드 항목, `bio-frq-templates.json`), `lib/ap-exam/full-set-rules.ts`(BIO 상수·`verifyBioFullComposition`), `stats-set.ts`(`setSizeOf("ap_biology") = 4`), `blueprint.ts`(`code_first` 설계도: 실험 규칙은 `experiment` 가 있을 때만), `bio-frq-checks.ts`·`part-refine.ts`·`guide-gates.ts`(아래 §6), `pipeline2.ts`(가이드·SUBJECT NOTES), `lib/exam-tools/biology-reference.ts`·`BiologyReference.tsx`·`subject-tools.ts`, 배정: `scripts/ap-generation/bio-pool.ts`·`bio-assign.ts`·`bio-evidence-keys.ts`, `lib/ap-admin/assemble-bio-draft.ts`.

## 3. 원형 라이브러리 분포
- 단원별 원형(문항): U1 17 · U2 26 · U3 25 · U4 22 · U5 20 · U6 27 · U7 25 · U8 29 (세트 문항 포함). 공식 한 벌 경계 4–7/6–8/7–10/6–9/4–7/7–10/7–12/6–9 에 모두 충분.
- Practice별: P1 43 · P2 27 · P3 15 · P4 18 · P5 55 · P6 36 (한 벌 경계 15–20/9–15/4–9/4–9/4–9/12–16). **P5 가 가장 많지만 정수계획이 시험 한 벌에서는 4–9 만 고른다.**
- 스킬 코드별: 1.A 12 · 1.B 24 · 1.C 9 · 2.A 7 · 2.B 15 · 2.D 3 · 3.A 2 · 3.B 5 · 3.C 5 · 3.D 3 · 4.B 18 · 5.A ~44 · 5.B 3 · 5.C 4 · 5.D 4 · 6.B 11 · 6.C 5 · 6.D 3 · 6.E 17. 2.C·6.A 는 원형이 없다(공식 MC Practice 범위 안 조립에는 영향 없음, 후속 추가 권장).
- 그림·자료: 표 stimulus 다수(약 60), 선 그래프 약 25(성장·속도·에너지 도표·시뮬레이션), 막대 그래프 2(통계 차트 bar), 가닥 쌍 다이어그램 2. **FRQ 그래프 작성(Q2 B 4점)은 종이 손글씨 + 행 체크리스트**.

## 4. FRQ 6유형(공식 구조 고정, 시나리오는 유형당 4–6)
- **Q1 결과 해석·평가(9점, A1 개념 / B3 변수·통제·자료 서술 / C3 퍼센트 변화 식·값·±2SE 비교 / D2 예측·정당화)**: 표(평균 ± 2SE, n) — 억제제·성장 인자·염분·항생제 내성 4시나리오.
- **Q2 결과 해석·평가 + 그래프(9점, A1 / B4 그래프 작성 / C2 계산·귀무가설 / D2)**: 표 → 종이 그래프 — 감자 삼투·효소 온도·개체군 성장·광합성 4시나리오. B 4행 = 축 라벨·단위, 균등 눈금, 점 표기, 그래프 유형.
- **Q3 과학적 탐구(4점 = A 개념 / B 절차 / C 귀무가설·예측 / D 정당화)** 5시나리오, **Q4 개념 분석(서술 / 설명 / 교란 효과 예측 / 정당화)** 5시나리오, **Q5 모델·시각(특징 / 관계 설명 / 표현 그리기 / 큰 원리)** 5시나리오(복제 포크 가닥·에너지 도표·형질 행렬 계통수·에너지 막대 그래프·가계도), **Q6 자료 분석(자료 서술 / 퍼센트 변화 / ±2SE 로 가설 평가 / 원리 연결)** 6시나리오.
- 모든 행은 **의미 기반**(필수 요소 = 개념 서술 25자 이상, 허용 표현 2개 이상, 흔한 오류 1개 이상), 수치 행은 `expected_values` 구조화 필드와 허용 오차, 모범 답안은 "ALTON reference answer for self-review — not official AP scoring". 파트마다 공식 스킬·토픽 코드.

## 5. 규약(코드로 강제)
- **식 시트의 식만 쓴다**(미카엘리스–멘텐·Q10·깁스 식 없음). 카이제곱 자유도 = 결과 수 − 1, 임계값 표는 시트 값. 수분 퍼텐셜 R = 0.0831, T = °C + 273.
- **선택지**: 숫자 선택지는 8% 이상(또는 정수·분수·절대 간격), 문장 선택지는 키 길이가 평균의 1.5배를 넘지 않고 병렬(최대/최소 5배 이하), 오답 why 는 25자 이상·서로 다름(소문자 비교에서도 — `Aa`/`aa` 사고를 잡았다).
- **세트**: 4문항, 한 단원, 공유 표 하나, 소개 문장에 자료 언급. 문항은 서로 다른 스킬(서술 → 계산 → 통계 → 예측).
- **설계도**: `code_first: true`. 실험 설계(experiment)가 있는 FRQ(Q1·Q6)는 Bio 실험 규칙을 그대로 통과(독립변수 1개·대조 사유·반복 ≥3·가상 실험).

## 6. 기존 게이트 수정(정당성)
| 파일 | 변경 | 이유 |
|---|---|---|
| `bio-frq-checks.ts` | 대조군 표 규칙은 표 집단 라벨이 있을 때만; construct/draw/plot/sketch 파트는 그래프 언급 허용; 모범 답 수의 크기(부호 제거)도 표에서 파생된 수로 인정 | 글 시나리오의 'controlled variable' 문구와 Q2 그래프 작성 파트, 음수 평균의 크기 인용이 오탐이었다 |
| `part-refine.ts` | 위와 같은 그래프 언급 예외 | 같은 이유 |
| `guide-gates.ts` | Biology 는 수식 `$` 감싸기와 수치 행 2개 이상 규칙에서 제외 | 생물 식은 평문, 개념 FRQ 는 수치 행이 없다 |
| `blueprint.ts` | `code_first` 설계도는 `experiment` 없이 통과 | MC·개념 FRQ 에는 실험 설계 객체가 의미 없다 |
| `stats-set.ts` | Biology 세트 크기 4 | 공식 "typically 4–5 questions" |

## 7. 시험 도구
`ap_biology: { calculatorTabs: ["scientific"], reference: "biology" }`. 공식은 사칙·공학용·그래핑 허용(CED p.197)이며 SE·카이제곱·로그가 필요하므로 공학용을 제공한다(Desmos 는 켜지 않음, Bluebook 내장 형태는 UNVERIFIED).

## 8. 유료 계획·구성
- 오너 예산: 총 상한 $150 / 중단선 $145, 착수 누적 **$88.0814**, **Biology 유료 합계 하드 캡 $22**(원장 누적 $110.0814 에서 중단).
- 파일럿: **P1-a MC 21칸(단독 20 + 세트 1) AP_MC_CANDS=2**, 상한 $2.2 / **P1-b FRQ 6칸 × 1**, 상한 $0.8 — 합 $3.0. 중단 규칙: P1-a 첫 통과 45 % 미만이면 중단, P1-b 는 6개 중 2개 미만 통과 시 중단. 원인은 무료로 수정.
- 사용 절차: 템플릿 복사 → `run-frozen.ts --freeze` → 커밋 → `--check-only` → 유료 실행. `hardStopCumulativeUsd` 는 집행 직전에 `ledger-total.ts` 로 재계산.
