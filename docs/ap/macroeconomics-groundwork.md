# AP Macroeconomics — 엔지니어링·생성·MA1/MA2 배정 (2026-10-14)

공식 사실은 `docs/ap/macroeconomics-facts.md`(CED V.1 ©2026 직접 대조). 패턴은 Microeconomics 와 같다(코드 우선 원형 → 결정적 게이트 → 동결 구성 → 유료 생성 → 격리 스택 화면 증거 → 정확 배정). 공식 수식 시트가 없으므로 **Reference 패널은 만들지 않았다**(사칙 계산기만).

## 1. 결과 요약
- **원형**: 단독 MC **133**(단원 U1 16·U2 25·U3 29·U4 24·U5 24·U6 15; 그림: 그래프 12·표 17·없음 104) + FRQ **10유형**(긴 3 × 10점 + 짧은 7 × 5점). 정답은 전부 코드가 계산하고 **이중 경로**로 검증한다: 정확 분수·규칙표 vs sympy·수치 시뮬레이션(AD–AS·화폐시장·대부자금·외환은 모두 '두 곡선 + 이동' 선형 모형이라 규칙표와 세 가지 크기 영역 시뮬레이션이 일치해야 쓴다; 정책 조합은 부호 시뮬레이션).
- **MA1·MA2 정확 배정 완료**: 가상 칸 0, 독립 검증기 위반 0, 두 시험 겹침 0(문항·FRQ 유형·같은 질문+정답 문장 지문 `sig`), 문항군 1. `data/ap/stock/exact-assign-macro-ma1-ma2.json`(검증기 출력 `-verifier.txt`).
- **비용**(이 워크트리 원장): 총 **$11.18**(상한 $16) — P1-a $1.80, P1-b $0.49, P2-A $3.72, P2-B $3.81, P2-F $0.94, P3 $0.41. 원장 누적 $135.8772 → $147.0535(중단선 $195). 다른 에이전트의 지출은 이 트리 원장에 없다.

## 2. 공식 구조와 내장한 범위
| 항목 | 값(공식, facts 참조) | 구현 |
|---|---|---|
| MC | 60 · 70분 · 5지선다 · 단독 문항 | `OPTION_COUNT` 5 |
| 단원 MC | U1 5–10 · U2 12–17 · U3 17–27 · U4 18–23 · U5 20–30 · U6 10–13 % → 정수 3–6 / 7–11 / 10–17 / 10–14 / 12–18 / 6–8(하한 내림·상한 올림) | `macro-rules.ts`, `macro_coverage.py` |
| 스킬 범주 MC | 범주1 30–40 · 범주2 25–32 · 범주3 30–40 %(18–24 / 15–20 / 18–24), 수치 분석(1.C·2.C·3.C) **16–20 %**(9–12) | 차단 조건(`verifyMacroFullComposition`) |
| FRQ | 긴 1(10점) + 짧은 2(5점) = 20점; 그래프 6–10 · 단언 2–4 · 설명 5–7 · 수치 2–5 점 | 파트 `response_mode` 분류, `verifyMacroFrqExam` |
| 계산기 | 사칙 | `subject-tools.ts`: `["basic"]`, `reference: null` |
| 통화정책 | 지급준비금 제한 경제에서만 통화량 변화(공개시장조작·지급준비율) 서술, 충분한 경제는 관리금리 | 원형 문장·`macro.ts` 표기 규칙 |

## 3. 코드 구성
- Python(`scripts/ap-generation/archetypes/`): `macro_common.py`(micro_common 과 같은 규약), `macro_models.py`(사건표 → 곡선 이동, 규칙표·시뮬레이션, 방향 조합 선택지 `combo_item`, 정책 조합 `policy_mix`, AD–AS 장면), `macro_p0_a`(U1) `_b`(U2) `_c`(U3) `_d`(U4) `_e`(U5) `_f`(U6) `_g`(설명형 2.A·2.B 고정 문장, 범주 2 확보) `macro_p0_frq`, `macro_coverage.py`, `macro_p0_stages.py`, `test_macro_p0.py`(31개).
- TS: `subjects/macro.ts`(가이드 + `macro-archetypes.json` 133항목), `lib/ap-exam/macro-rules.ts`, `macro-pool.ts`(+`sig`)·`macro-assign.ts`·`macro-evidence-keys.ts`·`macro-finalize.ts`, `lib/ap-admin/assemble-macro-draft.ts`(`MA` 접두 → `ap_macroeconomics`, `SET_ID_RE`·`service.ts`·`full-set-rules.ts`), 게이트 배선(`gates.ts` NOT_ASSESSED·OPTION_COUNT·FRQ 프로필·시간 상한, `blueprint.ts`, `ap-figures/gate.ts`, `pipeline2.ts`·`prompts.ts` 과목 노트), `supp-batches.ts` `macroItemNames()`(이름 규칙 `macro-<배치>-items.json`).
- 그래프 렌더는 새 렌더러 없이 `ap_graph:econ_curves`.

## 4. 유료 단계(전부 동결 → 커밋 → `--check-only` → 실행, `config/ap-frozen/macro-*.v1.json`)
| 단계 | 내용 | 후보 | 통과 | 비용 |
|---|---|---|---|---|
| P1-a | MC 26원형 × 2 | 52 | 37 (71.2%) | $1.7976 |
| P1-b | FRQ 10유형 × 1 | 10 | 5 (50%) | $0.4918 |
| P2-A | MC 60원형 × 2 | 120 | 85 (70.8%) | $3.7165 |
| P2-B | MC 59원형 × 2 | 118 | 62 (52.5%) | $3.8123 |
| P2-F | FRQ 10유형 × 2 | 20 | 9 (45%) | $0.9448 |
| P3 | MC 3원형 × 4(마지막 부족 칸) | 12 | 5 | $0.4130 |
- **검토기 지적에서 고친 것**: 오답 해설의 "the other curve" → 곡선 이름 명시; 정책 문항의 "한 번에 자기교정" 식 오답 제거; 대부자금 시장의 **재정적자 사건 제거**(공급 감소 vs 수요 증가 두 모형이 있어 다중 정답 → 구축효과 문항은 "대부자금 수요 증가"로 명시); 외환시장 무역 사건에서 순수출 방향이 모호 → 이자율 사건에만 순수출을 묻고 무역 사건은 거래량으로; 필립스 곡선 "움직임 vs 이동" 오답의 자기모순 문장; "shown" 이 가리키는 그림 없음; 쉬운 점 읽기 → 변화량 읽기, 환전에 왕복 환전 추가; FRQ 짧은 문항의 1점 파트 5개 → 2–3점 파트로 병합(공식 짧은 문항 입자 크기); 긴 문항의 승수 가정 문구가 그래프 파트와 충돌 → 가정 문구 정정; 환율 파트 채점이 공급 감소 이동도 허용.
- 길이 단서 게이트(`key_much_longer`)를 처음부터 Python 테스트로 잡았다(고정 문장 키를 줄이고 오답을 늘림).

## 5. 화면 증거(격리 스택 `ALTON_apmacro`, API 54521/DB 54522, 하드닝 가드 통과)
통과 후보 **203개**(MC 189 + FRQ 14) × 390x844·1280x800 = **410항목, fail 0**(`data/ap/screen-evidence/evidence-macro-s2.json`, 스크린샷 `docs/ap/screen-evidence/macro-s2/` 17MB). 그림 문항 59. 끝난 뒤 `isolated-stack.sh stop`(컨테이너 0, `config.toml` 원복), dev 서버 종료, 시드 `cleanup`(apdemo 잔여 0), 임시 로컬 시드 비밀번호 파일 삭제. **자동 점검일 뿐**이며 그래프 의미·문장 자연스러움은 아니다. 로컬 시드 비밀번호는 `.env.local` 에 없어 실행마다 무작위 값을 만들어 로컬 DB 에만 썼다. 렌더 검사 재생성: Macro 332행 fail 0(전체 3건 실패는 AB·Physics 의 기존 항목). 이 개발 서버는 `--webpack` 으로 실행했다.

## 6. MA1 / MA2 구성
| | 단원 | 범주 1/2/3 | 수치 분석 | exam_prep | FRQ(긴 + 짧은 2) |
|---|---|---|---|---|---|
| MA1 | 5/9/13/12/15/6 | 24/18/18 | 11 | 4/60 | `maf_long_adas_policy` + `maf_short_fiscal_multiplier` + `maf_short_fx_trade` |
| MA2 | 5/9/14/13/13/6 | 21/15/24 | 12 | 7/60 | `maf_long_money_market` + `maf_short_lf_crowding` + `maf_short_phillips` |
- 한 시험 전용 원형(`ONE_EXAM_ONLY`, 질문이 한 가지): `ma_ad_vs_demand`, `ma_bop_identity`, `ma_crowding_concept`, `ma_growth_tradeoff`, `ma_money_vs_lf`, `ma_multiplier_overstated`.
- **적재 필요 배치**(조정 세션이 관리자 화면에서 적재 후 MA1·MA2 초안 저장): `macro-p1a, macro-p1b, macro-p2a, macro-p2b, macro-p2f, macro-p3`(`lib/ap-admin/batches.ts`, 증거 `evidence-macro-s2.json`). 적재는 하지 않았다(원격 DB 쓰기 없음).

## 7. 한계·남은 일 (UNVERIFIED 포함)
- exam_prep 난이도 문항이 MA1 4/60, MA2 7/60 로 적었다 → §8 에서 보강해 v3 배정 26/60 씩(`docs/ap/macroeconomics-difficulty-audit.md`).
- 이 문항은 **LLM 검토기(Sonnet)·독립 풀이(Opus) 통과 + 코드 이중 검증**일 뿐 교사 검수는 아니다. 그래프 의미(AD–AS 곡선 모양·축 눈금)는 사람이 눈으로 본 것이 아니다.
- 공식 수식 시트 부재(Reference 패널 없음), Bluebook 계산기 형태, FRQ 문항별 시간, Macro 전달 방식 재확인은 UNVERIFIED(`macroeconomics-facts.md` §3).
- P1-a 의 원 동결 구성(v1)은 이후 원형 수정으로 해시가 달라졌다(실행 당시 일치 확인됨, P1-b 는 재동결 후 실행). 통화정책 문항 일부는 "지급준비금 제한 경제"를 명시했고, 준비금 시장 그래프는 만들지 않았다.
- FRQ 그래프 파트는 종이 손그리기 체크리스트이며 자동 채점 불가. 모범 답안은 "ALTON reference answer for self-review — not official AP scoring".

## 8. exam_prep 보강과 MA1·MA2 v3 배정(2026-10-15, 브랜치 `macro-hard`, DB 쓰기 없음)
- **목적·결과**: 공개 무료 Practice Exam 의 난이도 균형. 점검 표·원인·구조 제약은 `docs/ap/macroeconomics-difficulty-audit.md`. **v3 배정은 MA1·MA2 모두 exam_prep MC 26/60**(이전 4/60·7/60, 목표 20 이상). 정확 배정 `data/ap/stock/exact-assign-macro-ma1-ma2-v3.json`(사본 `assembled/macro-ma1-ma2-v3.json`, 검증기 출력 `exact-assign-macro-ma1-ma2-v3-verifier.txt`). 가상 칸 0, 독립 검증기 위반 0, 두 시험 문항 서로소, FRQ 는 게시본 그대로, 공식 단원·스킬 범주·수치 분석(12) 범위 유지. 하한 27 은 HiGHS infeasible(수치 분석 스킬 한 시험 최대 12 + 재고의 비수치 exam_prep 공급)이라 26 이 이번 재고의 최대다.
- **원형 32개**(`macro_p0_h.py` 단원 1–3, `macro_p0_i.py` 단원 4–6, `macro_hard_common.py`; 가이드 JSON `macro-archetypes.json` 133 → 165 항목, 기존 133개 불변): 계산 사슬(무역 이득·ppc 회전·실질 1인당 GDP·실업 사건·CPI→실질 임금·지출식→실질 성장·승수 조합·화폐시장 목표·준비율 인하·부채 경로·구축효과 표·화폐 성장→실질 금리·환율 왕복·교역 가격·감가→순수출→GDP) + 그래프·표 읽기 + 개념 결합(충격→재정 vs 자기 조정·단위 노동비용→SRAS·정책 조합→투자·순수출·필립스 곡선 단기/장기·두 사건 동시 이동(외환·대부자금)·실질 금리 차→자본 이동→환율→순수출). 키는 코드가 정확 분수·규칙표 vs sympy·반복 시뮬레이션으로 이중 계산하고 `test_macro_p0.py HardTruth` 가 facts·표만으로 세 번째로 다시 계산한다(39개 테스트). 오답은 단계 누락·오적용 값, 키가 가장 길고 평균 1.6배 넘는 형태는 `key_much_longer` 게이트와 Python 테스트가 막는다.
- **유료 실행**(동결 구성 `config/ap-frozen/macro-hard-a.v1.json`·`macro-hard-b.v1.json`, --freeze → 커밋 → --check-only → 실행, 수선 없음; 독립 풀이 Opus·검토 Sonnet·난이도 판정 Sonnet): hard-a 후보 51 → 통과 42($1.975), hard-b 후보 45 → 통과 29($1.492). 합계 **$3.4667**(원장 219.1319 → 222.5986, 중단선 235). hard-a 는 커밋 `7356877f` 에서 해시 일치 확인 후 실행했고(이후 hard-b 원형 3개를 더해 현재 트리 해시는 다르다 — 이전 P1-a 와 같은 경우), hard-b 는 `69aca39a` 에서 동결·실행했다.
- **배치·증거**: `lib/ap-admin/batches.ts` 에 `macro-hard-a`·`macro-hard-b`(증거 `evidence-macro-hard.json`) 등록. 화면 증거(격리 스택 `ALTON_machard`, 가드 통과, 종료 후 `isolated-stack.sh stop`·`config.toml` 원복·컨테이너 0·dev 서버 종료·시드 `cleanup`·임시 비밀번호 파일 삭제): 후보 71개 × 390x844·1280x800 = **142항목, fail 0**, 스크린샷 `docs/ap/screen-evidence/macro-hard/`(자동 점검일 뿐 그래프 의미·문장 자연스러움은 아님). `render-check` 재생성: 전체 4196행, 매크로 428행 fail 0(전체 6건 실패는 기존 AB·Physics 항목, 이번 변경과 무관); 이번 새 행의 스냅샷만 추가됐다. `tex-corrections.json` 은 변화 없음.
- **도구**: `macro-assign.ts --min-exam-prep N`(한 시험의 exam_prep MC 하한), `--published-slots <스냅샷>`(현재 FRQ 고정·한 시험의 현재 문항이 다른 시험으로 못 가게 금지·유지 보너스 → 순환 겹침 없음), `--keep-unit-counts`(게시본 칸의 단원 수 고정 → 칸 단위 교체로 단원 순서 유지). 공동 배정(`--joint`)에는 FRQ 유형·한 시험 전용 원형이 시험 사이 한 번만 쓰이는 제약을 추가했다(이전엔 순차 모드만 보장). 재현(HiGHS 용 `.venv-ap`): `macro-assign.ts --sets MA1,MA2 --published-slots data/ap/stock/macro-ma1-ma2-published-slots.json --keep-unit-counts --prefer-exam-prep --min-exam-prep 26 --time-ms 150000 --files macro-p1a-items,macro-p1b-items,macro-p2a-items,macro-p2b-items,macro-p2f-items,macro-p3-items,macro-hard-a-items,macro-hard-b-items --write-report data/ap/stock/exact-assign-macro-ma1-ma2-v3.json`.
- **게시본 → v3 새 버전 계획(읽기 전용 생성, DB 쓰기 없음)**: 게시본 스냅샷 `scripts/audit/macro-published-snapshot.ts`(`supabase db query --linked` SELECT 전용; 칸·DB `keyword_code`·변환 완료 후보 203·다른 계열 사용 문항) → 계획 생성기 `scripts/audit/macro-new-version-plans.ts [--write]` → `ma1-v3-swap-plan.json`(MA1 게시 v2 → v3, 교체 25 = 단독 MC 25), `ma2-v2-swap-plan.json`(MA2 게시 v1 → v2, 교체 20). 검증 `lib/ap-admin/macro-new-version-plans.test.ts`: 관리자 흐름의 `resolveSwaps` + `checkNewVersionComposition` 을 스냅샷에 그대로 재현한다.
  - **단원은 DB 후보의 `keyword_code` 첫 마디, 절대 범위**: 관리자 새 버전 검사는 교체 뒤 최종 구성의 MC 단원 수를 DB `ap_candidate_items.keyword_code` 로 세어 `fullPracticeUnitBounds`(3–6/7–11/10–17/10–14/12–18/6–8)와 비교한다(각 버전마다 절대 범위라 중간판도 범위를 지켜야 한다). 솔버의 단원 제약은 재고 `keywordCode` 첫 마디를 쓰고, 테스트가 DB `keyword_code` 와 같음을 전부 확인한다(불일치 0). 새 배치 후보는 적재 시 같은 `keyword_code` 가 DB 에 들어간다.
  - **순환 겹침 없음**: 새 버전 초안은 교체해 넣는 문항이 다른 시험 계열의 초안·게시본에 있으면 거부한다. v3 배정은 한 시험의 현재 문항이 다른 시험으로 가지 않게 만들었으므로(MA1 목표에 MA2 현재 문항 0, 반대도 0) 바이올로지 계획 같은 중간판·임시 공개 구간이 필요 없다. 두 시험은 서로 독립이고 어느 순서로 적용해도 된다(테스트가 양쪽 순서로 재현). 모든 교체는 같은 단원 칸끼리(25/25, 20/20)라 칸의 단원 순서가 그대로다.

### 관리자가 할 일(DB 쓰기는 전부 관리자 화면)
1. **새 배치 적재·변환**: 관리자 → Mock Exams → AP 재고 관리 → 배치 `macro-hard-a`, `macro-hard-b` 를 각각 "배치 전체 적재"(① 후보 적재 ②③ 렌더·화면 기록 ④ 문제은행 변환). 통과 키 42 + 29 = 71 이 모두 변환돼야 한다(증거 `evidence-macro-hard.json` 142항목 fail 0, 렌더 보고서는 이미 갱신돼 있어 건너뜀이 없어야 한다). 계획의 `requiresConvertedCandidates` 가 이 키들이다(MA1 16개, MA2 17개).
2. **새 버전**(관리자 ⑥ 새 버전, 계획 파일은 목록에서 선택. 각 단계 = 미리보기 → 확인 → 초안 생성 → 별도 '새 버전 공개'; 공개 범위(무료)는 이전 공개본에서 승계. 두 단계는 서로 독립):
   1. `AP Macroeconomics — Practice Exam 1`(지금 게시 v2): 계획 `ma1-v3-swap-plan.json`(교체 25) → 초안 v3 확인 → 공개.
   2. `AP Macroeconomics — Practice Exam 2`(지금 게시 v1): 계획 `ma2-v2-swap-plan.json`(교체 20) → 초안 v2 확인 → 공개.
   - 각 계획의 `sourceVersionNo`(2·1)와 제거 문항이 지금 공개본의 그 칸과 맞아야 미리보기가 통과한다. 누군가 먼저 새 버전을 냈으면 계획을 다시 생성한다(`macro-published-snapshot.ts` → `macro-new-version-plans.ts --write`). 새 배치를 적재하기 전에 미리보기를 하면 "변환되지 않았습니다"로 막히니 1 번을 먼저 한다.
3. **최종 상태**: MA1·MA2 = v3 배정, MC 60 + FRQ 3(게시본 그대로), 독립 검증기 위반 0, 두 시험 문항 서로소, exam_prep MC 각 26/60, 단원 5/9/13/12/15/6(MA1)·5/9/14/13/13/6(MA2), 새 버전은 기존 응시를 건드리지 않고 공개본만 바꾼다.
- **남은 위험**: ① exam_prep 은 판정기(LLM) 라벨이다. ② 신규 문항은 자동 게이트·독립 풀이·검토기를 통과한 초안일 뿐 사람 검토 전이다. ③ 단원 4 의 exam_prep 은 MA1 에서 1개뿐이다(원형 보강 여지). ④ 새 배치는 DB 적재 전이다(적재·새 버전은 관리자 화면). ⑤ 한 시험의 수치 분석 스킬이 12(상한)에 붙어 있다 — 공식 범위 안이다.
