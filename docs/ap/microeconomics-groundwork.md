# AP Microeconomics — 엔지니어링·생성·MI1/MI2 배정 (2026-10-13)

공식 사실은 `docs/ap/microeconomics-facts.md`(CED V.1 ©2026·AP Central 직접 대조). 패턴은 Chemistry/Physics 와 같다(코드 우선 원형 → 결정적 게이트 → 동결 구성 → 유료 생성 → 격리 스택 화면 증거 → 정확 배정).

## 1. 결과 요약
- **원형**: 단독 MC **110**(5지선다; 단원 U1 13·U2 29·U3 24·U4 19·U5 12·U6 13, 그래프 원형 18·표 원형 17·보수행렬 3) + FRQ **8유형**(긴 3 × 10점 + 짧은 5 × 5점) + 기존 `frq_micro_game`·`frq_micro_monopoly`. 모든 정답은 정확 분수·규칙표 경로와 sympy·수치 시뮬레이션(격자 탐색·수치 적분·한계 최댓값)의 **이중 경로**. 공식 단원·스킬 범주·수치 분석 범위를 **처음부터** 조립 검사에 내장(`micro_coverage.py`: 라이브러리로 60문항 시험이 정수계획으로 조립됨).
- **MI1·MI2 정확 배정 완료**(가상 칸 0, 독립 검증기 위반 0, 두 시험 겹침 0, 문항군 1, FRQ 유형도 서로 다름): MC 60 + FRQ 3(긴 1 + 짧은 2 = 20점) 각각. `data/ap/stock/exact-assign-micro-mi1-mi2.json`(= `assembled/micro-mi1-mi2.json`, 검증기 출력 `-verifier.txt`).
- **비용**(원장 대비): 이 작업 총 **$9.72**(상한 $14.5) — P1 파일럿 $2.03, P2 $7.69(상한 $10.5, 추정+20% $8.4 이내). 원장 누적 $68.4316 → **$78.1525**(중단선 $90 여유 $11.85). 다른 에이전트(Physics FRQ ≤ $2.5)의 지출은 이 작업 트리 원장에 없다 — 합산 최대 $80.7.

## 2. 공식 구조와 내장한 범위
| 항목 | 값(공식) | 구현 |
|---|---|---|
| MC | 60 · 70분 · 5지선다(A–E) · 단독 문항만 사용(공유 그래프 세트 크기는 미공표 → 쓰지 않음) | `OPTION_COUNT` 5, `mk()` 가 `n_total=5` |
| 단원 MC(60문항 정수 범위) | U1 7–9 · U2 12–15 · U3 13–15 · U4 9–14 · U5 6–8 · U6 4–8 | `micro-rules.ts`(하한 내림·상한 올림) |
| 스킬 범주 MC | 범주1 30–42%(18–26) · 범주2 37–47%(22–29) · 범주3 16–25%(9–15) · 범주4 MC 평가 안 함 · 수치 분석(1.C·2.C·3.C) 20–30%(12–18) | 차단 조건(`verifyMicroFullComposition`) |
| FRQ | 긴 1(10점) + 짧은 2(5점) = 20점; 과제 유형 점수: 그래프 30–50%(6–10) · 단언 10–20%(2–4) · 설명 25–35%(5–7) · 수치 15–30%(3–6) | 파트 `response_mode`(draw·identify·explain·calculate)로 분류, `verifyMicroFrqExam` |
| 계산기 | 사칙 계산기 허용 | `subject-tools.ts`: `BasicCalculator`(사칙·괄호·소수, 함수·거듭제곱 거부) + `MicroReference`(ALTON 자체 문구 "ALTON study reference — not the official College Board sheet"; CED 에 공식 수식 시트 언급 없음 → UNVERIFIED) |
| 전달 | 하이브리드(FRQ 종이 + 그래프 손그리기) | `frq-delivery.ts` paper; FRQ 그래프 파트는 체크리스트 행 |

## 3. 코드 구성
- Python(`scripts/ap-generation/archetypes/`): `micro_common.py`(선형 시장 `Mkt`, 규칙표·시뮬레이션 이중 경로 `eq_effect_*`, `val_opts`(8% 간격 5지), `sent_opts`, `econ_graph`(축 밖 곡선 자동 절단·곡선 라벨을 본문에 언급), `mk`(오답 why ≥25자·서로 다름·설계도+모형)), `micro_p0_a`(U1) `_b`(U2) `_c`(U3) `_d`(U4–6) `_e`(그래프 읽기 보강: 세금·수요 이동·가격 하한·비용 곡선·독점적 경쟁·독점 구매자·로렌츠·양의 외부효과·탄력성 + 단원 1·5·6), `micro_p0_frq.py`, `micro_coverage.py`, `micro_p0_stages.py`, `test_micro_p0.py`(26개).
- TS: `subjects/micro.ts`(가이드 + `micro-archetypes.json` 110항목), `lib/ap-exam/micro-rules.ts`, `micro-pool.ts`·`micro-assign.ts`·`micro-evidence-keys.ts`·`micro-finalize.ts`, `lib/ap-admin/assemble-micro-draft.ts`(`MI` 접두 → `ap_microeconomics`, `SET_ID_RE`·`service.ts` 저장 가능 정규식), `exam-tools`(`BasicCalculator`·`MicroReference`).
- 그래프 렌더는 새 렌더러 없이 기존 `ap_graph:econ_curves`(곡선 `vertices` + `labeled_points`)를 쓴다. 그림 게이트가 **본문에 나오지 않는 곡선 라벨을 지우므로** `mk()` 가 곡선 라벨 문장("The curves are labeled …")을 자동으로 넣는다.

## 4. 유료 단계(전부 동결 → 커밋 → `--check-only` → 실행, `config/ap-frozen/micro-*.v1.json`)
| 단계 | 내용 | 후보 | 통과 | 비용 |
|---|---|---|---|---|
| P1-a | MC 22원형 × 2 | 44 | 32 (72.7%) | $1.5791 |
| P1-b | FRQ 8유형 × 1 | 8 | 4 (50%) | $0.4489 |
| P2-F | FRQ 5유형 × 2(검토기 지적 수정본 + 보수행렬 짧은 문항) | 10 | 7 (70%) | $0.4836 |
| P2-A | MC 38원형 × 2(가상 칸 1개) | 76 | 59 (77.6%) | $2.3977 |
| P2-B | MC 25원형 × 4(가상 칸 2개) | 100 | 66 (66%) | $3.2720 |
| P2-C | MC 13원형 × 3(MI2 마지막 가상 칸 7 + 수정 6) | 39 | 24 (61.5%) | $1.3062 |
| P2-D | MC 3원형 × 3 | 9 | 3 (33%) | $0.2333 |
| **합계** | | MC 268 + FRQ 18 | MC **184** + FRQ **11** | **$9.7208** |
- 단가: MC 후보당 $0.036, FRQ 후보당 $0.056. 통과 재고 MC 단원별 U1 26·U2 40·U3 45·U4 36·U5 17·U6 20, 스킬 1.A 21·1.B 19·1.C 19·1.D 11·2.A 38·2.B 15·2.C 17·3.A 29·3.B 4·3.C 11. FRQ 유형(고유): pc_firm·market_policy·monopoly(긴) / externality·labor·trade·elasticity·mc·game(짧은).
- **검토기 지적에서 고친 것**: 오답 설명이 값·선택지와 어긋남(독점 수치·이윤 극대화 표·비용 그래프 최소점·독점 그래프 가격), Pigou 키 유일성(스템을 "한계 외부 비용과 같은 세금"으로 명시), 폐업 규칙 문항(선택지가 여러 개 정답 → 모든 오답이 조건과 모순되게 재설계·스킬 2.A), 시장 구조 식별(자연 독점이 독점의 하위 개념 → 카르텔화된 과점으로 교체), 가격 차별 탄력성(|e|<1 은 이윤 극대화 불가 → 1.5 이상), 탄력성 그래프(탄력성 1 이 되는 경우 제외), FRQ 유형(열린 설명 → 닫힌 두 행, 교역 가정 명시, 교차 탄력성 연구를 별도 노트로 분리, 독점적 경쟁 표를 U자 ATC 와 일치시킴, 선택지 없는 `select` 모드 → `identify`).
- **화면 증거에서 잡은 표시 문제**: 금액이 든 해설에서 "…$66 is incorrect:" 줄이 앞 줄 금액 뒤에 이어지면 원문 달러 수식 쌍으로 읽힘(`result_no_raw_tex`, 데스크톱 폭만). 해설의 금액 오답 줄 앞에 "The option " 을 붙임(18건, `micro-finalize.ts` 에도 반영), 이윤 유형 문항의 짧은 설명을 늘림.

## 5. 화면 증거(격리 스택 `ALTON_apmicro`, API 54521/DB 54522, 하드닝 가드 통과)
통과 후보 **195개**(MC 184 + FRQ 11) × 390x844·1280x800 = **390항목, fail 0**(`data/ap/screen-evidence/evidence-micro-s2.json`, 스크린샷 `docs/ap/screen-evidence/micro-s2/` 17MB). 그래프 문항 77(곡선 38·표 30·보수행렬 9). 끝난 뒤 `isolated-stack.sh stop` 으로 정리(컨테이너 0, `config.toml` 원복), dev 서버 종료, 시드 `cleanup`(apdemo 잔여 0). **자동 점검일 뿐** 그래프 의미·문장 자연스러움은 아니다. 렌더 검사 `render-check.ts` 재생성: 마이크로 286행 fail 0(전체 2,291행의 3건 실패는 AB `run1:…f04-k8`·Physics v1 `m18` 의 기존 항목).

## 6. MI1 / MI2 구성(스킬 범위 포함, 전부 공식 범위 안)
| | 단원 | 범주 1/2/3 | 수치 분석 | exam_prep | FRQ(긴 + 짧은 2) | 그래프·단언·설명·수치 점수 |
|---|---|---|---|---|---|---|
| MI1 | 9/13/14/12/6/6 | 19/26/15 | 18 | 19/60 | `mif_long_market_policy` + `mif_short_externality` + `mif_short_labor` | 6·2·6·6 |
| MI2 | 8/13/15/11/6/7 | 23/22/15 | 17 | 7/60 | `mif_long_pc_firm` + `mif_short_trade` + `frq_micro_game` | 6·4·6·4 |
- 한 시험 전용 원형 18종(고정 문장 질문이 사실상 한 가지: `ONE_EXAM_ONLY`)은 두 시험에 함께 쓰지 않는다. FRQ 유형은 시험마다 다르다.
- **적재 필요 배치**(조정 세션이 관리자 화면에서 적재 후 MI1·MI2 초안 저장): `micro-p1a`, `micro-p1b`, `micro-p2f`, `micro-p2a`, `micro-p2b`, `micro-p2c`, `micro-p2d`(증거 `evidence-micro-s2.json`, 배치 등록 `lib/ap-admin/batches.ts`).

## 7. 한계·남은 일
- MI2 의 exam_prep 난이도 문항이 7/60 으로 적다(난이도 분류 기준; 시험 구조와 무관, 필요하면 MI2 를 `--prefer-exam-prep --joint` 로 재배정).
- 단일 변형 qualitative 원형 18종은 한 시험 전용. 변형 질문을 더하면 두 시험 모두에 쓸 수 있다.
- Bluebook 계산기 형태(Desmos 제공 여부), 공식 수식 시트 존재 여부, MC 공유 그래프 세트 크기는 UNVERIFIED(`microeconomics-facts.md` §3).
- FRQ 그래프 파트는 종이 손그리기 체크리스트이며 자동 채점 불가. 모범 답안은 "ALTON reference answer for self-review — not official AP scoring".
