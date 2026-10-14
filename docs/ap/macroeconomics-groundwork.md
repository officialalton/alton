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
- exam_prep 난이도 문항이 MA1 4/60, MA2 7/60 로 적다(난이도 분류 기준; 구조와 무관, `--prefer-exam-prep --joint` 재배정으로 올릴 수 있다).
- 이 문항은 **LLM 검토기(Sonnet)·독립 풀이(Opus) 통과 + 코드 이중 검증**일 뿐 교사 검수는 아니다. 그래프 의미(AD–AS 곡선 모양·축 눈금)는 사람이 눈으로 본 것이 아니다.
- 공식 수식 시트 부재(Reference 패널 없음), Bluebook 계산기 형태, FRQ 문항별 시간, Macro 전달 방식 재확인은 UNVERIFIED(`macroeconomics-facts.md` §3).
- P1-a 의 원 동결 구성(v1)은 이후 원형 수정으로 해시가 달라졌다(실행 당시 일치 확인됨, P1-b 는 재동결 후 실행). 통화정책 문항 일부는 "지급준비금 제한 경제"를 명시했고, 준비금 시장 그래프는 만들지 않았다.
- FRQ 그래프 파트는 종이 손그리기 체크리스트이며 자동 채점 불가. 모범 답안은 "ALTON reference answer for self-review — not official AP scoring".
