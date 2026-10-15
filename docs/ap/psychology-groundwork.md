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
- exam_prep 난이도 라벨 문항이 PS1 1/75, PS2 1/75 로 적다(난이도 분류기 기준; 다수가 basic_learning 로 분류됨). 문항이 시험 난이도보다 쉬울 가능성이 크다.
- 세트 비중 12%(공식 샘플 43%), Practice ±5%p 허용, Bluebook 도구 동작, FRQ 읽기 시간 처리, 계산기 정책은 `psychology-facts.md` §4.
- FRQ 4종이 같은 AAQ 구조라 시나리오 다양성이 제한적이다(통과 AAQ 4·EBQ 3).
- 로컬 시드 비밀번호는 실행마다 무작위로 만들어 로컬 DB 에만 썼다. 개발 서버는 `--webpack` 으로 실행했다.
