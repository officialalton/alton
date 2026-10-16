# AP Psychology — 엔지니어링·생성·PS1/PS2 배정 (2026-10-14)

공식 사실은 `docs/ap/psychology-facts.md`(CED effective Fall 2025 직접 대조; 지시서의 9단원·FRQ 형식 전제는 틀렸고 **5단원 · MC 75/90분/4지선다 · FRQ 2(AAQ+EBQ, 각 7점) · 완전 디지털**이 공식이다). 패턴은 Macro 와 같되 **개념 문항은 코드로 정답을 계산할 수 없으므로** 문항을 사람이 CED 필수 내용에서 직접 쓰고(고정 문장 변형), 정답 보증을 모델 검증으로 대체했다.

## 1. 결과 요약
- **PS1·PS2 정확 배정 완료**: 가상 칸 0, 독립 검증기 위반 0, 두 시험 겹침 0(문항·변형 sig·세트·FRQ 시나리오). `data/ap/stock/exact-assign-psych-ps1-ps2.json`(검증기 출력 `-verifier.txt`). 각 시험 MC 75 = 단독 66 + 3문항 세트 3개, 단원 15/15/15/15/15(PS2 15/15/16/18/11, 모두 11–19), Practice 49/19/7(PS2 51/15/9), FRQ = AAQ + EBQ.
- **재고**: 원형 MC 단독 181 + 세트 20 + FRQ 8(AAQ 4·EBQ 4). 통과(재고) 단독 139(화면 증거 보유) · 세트 7 · FRQ 7(AAQ 4·EBQ 3).
- **비용**(이 워크트리 원장): 총 **$8.59**(상한 $14) — P1-a $1.13, P1-b $0.24, P2 $4.98, P3 $0.48, P4 $0.40, 두 번째 패널 $1.37. 원장 $163.8888 → $172.478(중단선 $195). 모든 유료 단계는 Message Batches(절반 단가)로 실행했다(`batch: true`, run-frozen.ts).

## 2. 코드 구성
- Python(`scripts/ap-generation/archetypes/`): `psych_common.py`(문항·세트·FRQ 빌더, 선택지 위치는 원형 id 를 섞은 결정적 난수), `psych_p0_u1..u5.py`(CED 토픽 35개 전부), `psych_p0_r.py`(연구 방법 Practice 2), `psych_p0_stats.py`(코드 계산 기술통계·자료 해석), `psych_p0_sets_a/b.py`(공유 세트 20), `psych_p0_frq.py`(FRQ 8), `psych_p0_stages.py`, `test_psych_p0.py`(14개).
- TS: `subjects/psych.ts`(+`psych-archetypes.json` 241행), `lib/ap-exam/psych-rules.ts`, `psych-frq-checks.ts`(AAQ/EBQ 구조·숫자 일관성), `psych-pool.ts`·`psych-assign.ts`·`psych-finalize.ts`·`psych-evidence-keys.ts`·`psych-panel.ts`, `lib/ap-admin/assemble-psych-draft.ts`(`PS` 접두, `SET_ID_RE`·`service.ts`·`full-set-rules.ts`), 게이트 배선(`gates.ts` NOT_ASSESSED·OPTION_COUNT·FRQ 프로필, 세트 문항 길이 한도), `pipeline2.ts`(개념 문항 검토기 문구·FRQ 풀이기에 출처 본문), `layouts.ts`·`subject-tools.ts`(계산기·참조 없음)·`frq-delivery.ts`(digital).
- 배치: `lib/ap-admin/batches.ts` 에 `psych-p1a, p1b, p2a, p3a, p3b, p4a` 등록(증거 `evidence-psych-s2.json`). 적재는 하지 않았다(원격 DB 쓰기 없음).

## 3. 품질 보증(개념 문항)
1. 결정적 게이트(81·349·24·27건 전부 통과) + 설계도.
2. 키를 숨긴 독립 풀이(Opus) + 5기준 검토(Sonnet, "키는 코드로 검증되지 않았다" 문구) + 난이도.
3. **두 번째 독립 모델 패널**(Fable + Sonnet 맹검 풀이, 모호 표시 포함) — 배정에 쓰인 MC 142건 전부 두 모델이 키와 일치, 모호 표시 0, FRQ 4건 Fable 결함 검토 blocker 0.
4. 통계 원형(`ps_stat_*`)은 코드로 정답 계산 + statistics 모듈/numpy 독립 재계산.
- 검토기가 많이 반려한 이유(지침 참조): 정의 되풀이 줄기, 비현실적 오답, 얇은 해설, 세트에서 자료를 쓰지 않는 문항. 단독 통과율 P1 74%, P2 47%; 세트는 3문항이 모두 통과해야 해서 P1 1/5, P2 2/19(→ 지적 반영 후 재실행 P3 2/8, P4 2/5). 검토기 지적에서 고친 것: 정의 노출 줄기를 시나리오로, 오답을 가까운 개념으로, 세트 안 질문이 자료를 쓰도록, 인과 과잉 주장 금지, 변형 선택지 길이 균형, FRQ 루브릭의 출처·개념 비의존화, 모범 답안의 한계 인정.

## 4. 단계 요약(`config/ap-frozen/psych-*.v1.json`, 전부 동결 → 커밋 → 실행)
| 단계 | 후보 | 통과 | 비용 |
|---|---|---|---|
| P1-a 파일럿(단독 25+통계·자료 8, 세트 5) | 81 | 60 | $1.13 |
| P1-b FRQ 8 | 8 | 5 | $0.24 |
| P2 본 실행(원형 167, 세트 재실행 4 포함) | 349 | 164 | $4.98 |
| P3 세트 8(수정) + EBQ 3(수정) | 24 + 3 | 2세트(6문항)·FRQ 2 | $0.48 |
| P4 세트 5 + 연구 방법 원형 6 | 27 | 2세트·단독 7 | $0.40 |
| 패널 | 280 호출 | 불일치 0 | $1.37 |

## 5. 화면 증거(격리 스택 `ALTON_appsych`, API 54521/DB 54522, 하드닝 가드 통과)
배정에 쓰인 142 + 그림 문항 30 중 증거 필요 153건 × 390x844·1280x800 = **466항목, 점검 2432 pass / 830 해당 없음 / fail 0**(`data/ap/screen-evidence/evidence-psych-s2.json`, 스크린샷 `docs/ap/screen-evidence/psych-s2/`). 끝난 뒤 `isolated-stack.sh stop`(컨테이너 0, `config.toml` 원복), 개발 서버 종료, 임시 비밀번호 파일 삭제. 자동 점검일 뿐 문장 자연스러움·그림 의미를 사람이 본 것은 아니다. 렌더 검사 재생성: Psychology 항목 중 실패 2건(`figure_referenced_but_missing`, 모두 배정 밖).

## 6. 세트 개수와 구성 (공식과 다른 내부 결정)
공식 샘플은 21문항 중 3세트(9문항, 약 43%)이지만 회당 개수는 미공표다. 3문항이 모두 통과해야 하는 세트 재고가 7개뿐이라 `PSYCH_SET_COUNT` = **3**(회당 9문항, 12%)이다. 6세트(24%)를 목표로 시작했으나 재고가 부족해 낮췄다. 세트를 더 늘리려면 통과 직전(2/3)인 세트 3개(caffeine·teen_sleep·attribution)와 새 세트가 필요하다.

## 7. PS1 / PS2 구성
| | 단원 | Practice 1/2/3 | FRQ |
|---|---|---|---|
| PS1 | 15/15/15/15/15 | 49/19/7 | AAQ + EBQ |
| PS2 | 15/15/16/18/11 | 51/15/9 | AAQ + EBQ |
FRQ: AAQ 4종·EBQ 3종 중 시험당 AAQ 1·EBQ 1(`psf_ebq_team_bonus` 는 검토 미통과로 제외).

## 8. 한계·UNVERIFIED
- 개념 문항의 정답은 사람이 쓴 것을 **LLM 4개 검사(Opus 풀이·Sonnet 검토·Fable/Sonnet 패널)가 일치시킨 것**일 뿐 심리학 교사 검수가 아니다. 출시 전 교사 표본 검수 필수.
- exam_prep 난이도 라벨 문항이 v2 게시본에서는 PS1 1/75, PS2 1/75 로 적었다(§9 에서 v3 배정으로 보강 — 51·52/75).
- 세트 비중 12%(공식 샘플 43%), Practice ±5%p 허용, Bluebook 도구 동작, FRQ 읽기 시간 처리, 계산기 정책은 `psychology-facts.md` §4.
- FRQ 4종이 같은 AAQ 구조라 시나리오 다양성이 제한적이다(통과 AAQ 4·EBQ 3).
- 로컬 시드 비밀번호는 실행마다 무작위로 만들어 로컬 DB 에만 썼다. 개발 서버는 `--webpack` 으로 실행했다.

## 9. psych-hard: 응용·분석 문항 보강과 PS1·PS2 v3 배정 (2026-10-15, 브랜치 `psych-hard`, DB 쓰기 없음)
상세 감사·표: `docs/ap/psychology-difficulty-audit.md`. 요약: 게시 v2 의 exam_prep MC 1/75(PS1)·1/75(PS2) → **v3 배정 51/75·52/75**, 설계 기록 풀이 단계 3 이상 58·59문항, 가상 칸 0, 독립 검증기 위반 0, 두 시험 겹침 0, 공유 세트 3개씩 완전, 단원 15×5, Practice 45/19/11(공식 범위: 단원 11–19, Practice 1 45–53·2 15–23·3 3–12).
- **원형**(`archetypes/psych_p0_hd_a..f.py`): 다단계 개념 적용 41, 연구 설계 평가 16, 코드 계산 자료 해석 13(총 70개, 고정 문장 변형 2개씩 + 코드 원형은 무제한 변형). 공통 도우미 `psych_hd_common.py`(정답이 가장 긴 선택지 금지·표 비율 정수 인원 검사), 구조 신호 `psych_hd_signals.py`. 테스트 `test_psych_hd.py`(11), `lib/ap-generation/psych-hd-signals.test.ts`(3).
- **난이도 신호 선언**: `gates.ts`(`gateDifficultySignals` 를 ap_psychology 에도 적용)·`stats-difficulty.ts`(`difficultyContext` 를 ap_psychology MC 에 적용; 선언이 없는 기존 문항은 판정 요청이 바이트 단위로 같다). 판정기는 신호 없이는 다단계 개념 문항을 거의 basic 으로 분류했다(통과 23건 중 exam_prep 3). 신호를 주면 통과 24건 중 22건. 자세한 근거·한계는 감사 문서 §4–5.
- **유료 실행**(동결 구성 `config/ap-frozen/psych-hard-{a,b,c3,d}.*.json`, --freeze → 커밋 → --check-only → 실행, Message Batches): 최종 재고 = 런 a(다단계 개념 26 원형)+d(11 원형) → 배치 `psych-hard-a`, 런 b(연구 설계·자료 해석·세트 2)+c3(13 원형) → 배치 `psych-hard-b`. v1 실행(신호 없음)의 solve·review 결과는 **문항 텍스트가 바뀌지 않은 칸에만** 재사용했고(`.v2` 구성, `skipStages: gen`), 검토기 지적(핵심 절의 근거 오류·약한 절대어 오답·꼬리 질문 모호성 등)으로 고친 원형 13개와 c 는 처음부터 다시 돌렸다. 난이도 라벨은 전부 신호 포함으로 다시 판정했다. 통과: a·d 72/74(배치 통과 키는 그림 누락 2건을 빼 70), b·c3 69/81(실패 원형 `ps_hd_r_meta_effect`·`ps_hd_s_relative`). **비용**: 원장 $219.13 → $224.31 = **$5.17**(생성·재판정 $3.97 + 두 번째 모델 패널 $1.20; 캡 $6, 중단선 $295).
- **두 번째 모델 패널**(`psych-panel.ts --files psych-hard-a-items,psych-hard-b-items --report <배정>`): 새 배정에 들어간 119키(238회 맹검 풀이, Fable+Sonnet) **불일치·모호 표시 0**. 기존 문항 23키는 2026-10-14 패널 결과(`psych-panel-flags.json`)를 그대로 쓴다(패널 스크립트가 파일을 덮어쓰므로 기존 반려 목록을 복원·보존했다).
- **화면 증거**(격리 스택 `ALTON_apsych2`, 가드 통과, 종료 후 `isolated-stack.sh stop`·`config.toml` 원복·컨테이너 0·시드 정리·개발 서버 종료): 후보 139개 x 390x844·1280x800 = 318항목, **fail 0**(pass 1664 / 해당 없음 562), `data/ap/screen-evidence/evidence-psych-hard.json`, 스크린샷 `docs/ap/screen-evidence/psych-hard/`(자동 점검일 뿐 사람이 문장·자료 의미를 본 것은 아니다). 렌더 검사 재생성: 보고서만 반영(Psychology 표 렌더 행 추가, 실패 `figure_referenced_but_missing` 2건은 배정 밖 — 본문이 "photograph/advertisement is shown"만 있고 그림이 없는 두 후보라 **통과 키 목록에서 뺐다**).
- **표 비율 정수 인원 수**: 감사 지적에 따라 `scripts/audit/psych-table-pct-scan.ts` 로 점검(표의 행마다 인원 x 백분율이 정수여야 한다) → 위반 후보 8건(세트 2종·AAQ 1종)을 `psych-table-pct-flags.json` 으로 재고에서 뺐고 원형을 고쳤다(세트 2종은 새 배치로 재생성·통과, AAQ 는 다른 3종 사용). `psych-pool.ts` 가 목록을 읽어 배정에서 제외하고, 새 원형은 코드로 같은 검사를 강제한다.
- **v3 배정**: `data/ap/stock/exact-assign-psych-ps1-ps2-v3.json`(검증기 출력 `…-v3-verifier.txt`). 재현: `npx tsx scripts/ap-generation/psych-assign.ts --sets PS1,PS2 --joint --prefer-exam-prep --exam-weight 0.5 --hd-bonus 0.05 --no-transfer data/ap/stock/psych-ps1-ps2-published-v2-slots.json --time-ms 240000 --write-report data/ap/stock/exact-assign-psych-ps1-ps2-v3.json`(HiGHS 용 `.venv-ap` 필요; 같은 재고에서 `--min-exam-prep 51` 까지 가상 0, 52 는 가상 3칸, 53 은 infeasible). 재검증: `psych-assign.ts --verify-report <보고서>`. 새 옵션: `--min-exam-prep N`, `--exam-weight`, `--hd-bonus`, `--no-transfer <게시 슬롯 스냅샷>`(상대 시험이 지금 갖고 있는 문항을 가져오지 않는다 → 두 시험의 새 버전이 서로 독립이라 **중간판이 필요 없다**), 후보 keyword_code 단원(`keyUnit`)과 문항 토픽 단원이 다른 후보는 쓰지 않는다(관리자 새 버전 검사는 keyword_code 단원을 센다).
- **새 버전 계획**(`scripts/ap-generation/psych-new-version-plans.ts [--write]`, 입력 = 게시 PS1 v2·PS2 v2 SELECT 전용 스냅샷 `data/ap/stock/psych-ps1-ps2-published-v2-slots.json`: 둘 다 published, 77칸): `ps1-v3-swap-plan.json`(교체 60 = 단독 MC + 공유 세트 3칸 통째 + FRQ 같은 유형), `ps2-v3-swap-plan.json`(교체 60). 검증 `lib/ap-admin/psych-new-version-plans.test.ts`(17): 관리자 흐름의 `resolveSwaps` + `checkNewVersionComposition`(`fullPracticeUnitBounds('ap_psychology','full_practice')` 절대 범위 11-19, **DB 단원 = 후보 keyword_code 단원**, 문항군 상한, 다른 시험 겹침, 교체 후보 완전성)을 라이브 스냅샷에서 재현해 위반 0, 교체 뒤 구성 = v3 배정, 독립 검증기 0, 계획 파일이 다른 시험에는 적용되지 않음, 표 비율 정수 인원, 정답 길이 단서 < 45 %, exam_prep ≥ 51.

### 관리자가 할 일(순서대로; PS1·PS2 는 독립이라 단계 사이 순서 제약이 없다)
1. **새 배치 적재·변환**: 관리자 → Mock Exams → AP 재고 관리 → 배치 `psych-hard-a`(통과 70)·`psych-hard-b`(통과 69)를 각각 "배치 전체 적재"(① 후보 적재 ②③ 렌더·화면 기록 ④ 문제은행 변환). 증거 파일은 `evidence-psych-hard.json`(318항목 fail 0), 렌더 보고서는 이미 갱신돼 있어 건너뜀이 없어야 한다.
2. **새 버전**(관리자 ⑥ 새 버전, 계획 파일은 목록에서 선택. 각 시험 = 미리보기 → 확인 → 초안 생성 → 별도 '새 버전 공개'; 공개 범위(무료)는 이전 공개본에서 승계):
   - `AP Psychology — Practice Exam 1`(지금 게시 v2): 계획 `ps1-v3-swap-plan.json` → 초안 v3 확인 → 공개.
   - `AP Psychology — Practice Exam 2`(지금 게시 v2): 계획 `ps2-v3-swap-plan.json` → 초안 v3 확인 → 공개.
   - 각 계획의 `sourceVersionNo`(2)와 제거 문항이 현재 공개본의 그 칸과 맞아야 미리보기가 통과한다. 어긋나면(다른 새 버전이 먼저 공개됨 등) 고치지 말고 `psych-new-version-plans.ts` 를 새 스냅샷으로 다시 생성한다. `requiresConvertedCandidates` 는 1단계에서 변환해야 하는 새 배치 키다.
3. **최종 상태**: PS1·PS2 = v3 배정(MC 75 + AAQ + EBQ), exam_prep MC 51·52/75, 두 시험 문항 서로소.
- **남은 위험**: ① exam_prep 은 내부 라벨이다(감사 문서 §5). ② 새 문항은 자동 게이트·두 모델 검토를 통과한 초안이며 **심리학 교사 검수 전**이다(FRQ 루브릭은 "ALTON reference answer — not official AP scoring"). ③ 새 배치는 DB 적재 전이다(적재·새 버전은 관리자 화면). ④ 일부 문항은 검토기가 지적한 "약한 절대어 오답" 형태가 남아 있을 수 있다. ⑤ 공유 세트는 기존 3개 그대로(회당 12 %, 공식 샘플 43 %와 다름 — §6).
