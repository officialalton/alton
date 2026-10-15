# AP U.S. History — 엔지니어링·생성·US1/US2 배정 (2026-10-14)

공식 사실은 `docs/ap/ushistory-facts.md`(CED effective Fall 2026 + AP Central 직접 대조; **MC 55/55분/4지선다 3–4문항 자료 세트 · SAQ 3(각 3점) · DBQ 7점(문서 7) · LEQ 6점(필수) · 완전 디지털**). 정답을 코드로 계산할 수 없는 과목이라 English 와 같은 계열(모델이 쓴 자료·문항 + 결정적 게이트 + 독립 풀이 + 제2 모델 패널)로 만들었다. Psychology 의 "사람이 쓴 고정 원형" 방식은 쓰지 않았다(역사 자료는 변형이 아니라 서술이므로).

## 1. 결과 요약
- **US1·US2 정확 배정 완료**: 가상 칸 0, 독립 검증기 위반 0, 두 시험 겹침 0(후보·문항군=주제). `data/ap/stock/exact-assign-ushistory-us1-us2.json`(검증기 출력 `-verifier.txt`, HiGHS 최적). 각 시험 MC 55 = 세트 15(4문항 10 + 3문항 5), 시대(단원) US1 2/4/8/7/8/7/8/7/4 · US2 4/4/8/7/8/6/8/7/3(모두 공식 범위 안), 자료 유형 US1 1차 5·2차 5·짝지은 1·표 4 / US2 1차 5·2차 6·짝지은 2·표 2, 스킬 범주 1–5 모두 ≥ 3(6.x 없음). FRQ = SAQ 3(서로 다른 시대: US1 5/7/8, US2 8/4/6) + DBQ + LEQ.
- **재고(화면 증거 보유)**: MC 세트 73(문항 262) + FRQ 10(SAQ1 2·SAQ2 2·SAQ3 2·DBQ 2·LEQ 2). 통과 세트 74 중 1세트(`u103`)는 렌더 게이트 실패(본문이 "shown in the" 을 쓰는데 그림이 없음)로 재고에서 제외.
- **비용**(이 워크트리 원장): 총 **$14.48**(상한 $16) — 파일럿 MC $0.49, 본 실행 MC $6.17, 보충 MC(표 중심) $2.51, FRQ(생성·사실 점검·샘플·채점·재시도 전부) $5.32. 원장 $172.478 → $186.958(중단선 $215, 누적 $200 이내). 모든 유료 단계는 Message Batches(절반 단가)로 실행.

## 2. 코드 구성
- 규칙·데이터: `lib/ap-curriculum/types.ts`·`data/ap/curriculum-2027/ap_us_history.json`(9단원 105토픽 17스킬), `lib/ap-exam/ush-rules.ts`(55문항·세트 3–4·14–18·자료 유형 최소·스킬 범주·FRQ 5유형·SAQ 시대 서로 다름)·`full-set-rules.ts`·`layouts.ts`(`ap_mc`·`ap_saq`·`ap_frq`)·`frq-delivery.ts`(digital)·`subject-tools.ts`(계산기·참조 없음), `gates.ts`(MC 스킬 6.x 금지·4지선다), `assemble-draft.ts`·`service.ts`(`US` 접두), `stimulus-display.ts`(`ALTON-composed stimulus` 표지는 산문 취급), `convert.ts`(`ush_frq` 참고 답안).
- 생성: `lib/ap-generation/subjects/ushistory.ts`(시대별 발전 주제 은행 약 110개·자료 유형별 스킬 슬레이트·오답 분류·실존 인물 명단·**정설 날짜표 60건**), `ushistory-plan.ts`, `ushistory-prompts.ts`, `ushistory-gates.ts`(결정적 게이트), `ushistory-frq.ts`(스키마 `ush-frq-1` + 게이트), `scripts/ap-generation/ushistory-pipeline.ts`(gen → check → balance → solve → panel → finalize, FRQ: frq-gen → frq-fact → frq-samples → frq-grade → frq-fact2 → frq-finalize), `ushistory-finalize.ts`, `ush-pool.ts`·`ush-assign.ts`(HiGHS 정수계획 + 독립 검증기), `ush-panel-summary.ts`, `lib/ap-admin/assemble-ush-draft.ts`, 배치 4개 `lib/ap-admin/batches.ts`(`ush-p1a·p2a·p3a·p1b`, 증거 `evidence-ush-s2.json`), `supp-batches.ts`·`keys-file.ts`·`render-check.ts`(재고 파일 `ush-*-items.json` 자동 인식), `verify-guard.ts`(증거 content_hash 가 `ush_`·`ushfrq_` 세트의 지문·문항을 포함 — 안 그러면 모든 세트가 같은 해시).
- 테스트: `ushistory-gates.test.ts`·`ushistory-frq.test.ts`·`ush-rules.test.ts`·`assemble-ush-draft.test.ts`(합성 재고로 배정·검증기·초안 계획), 에세이 채점 `lib/essay-grading/essay-grading.test.ts`(§6).

## 3. 콘텐츠 규칙과 이를 지킨 방식 (매우 중요)
1. **모든 자료는 ALTON 작성**: 1차 자료는 가공 인물·가공 매체의 "~풍" 글(예: "a fictional wheat farmer in Oriska County, New York, private letter, 1830 (ALTON-composed, in the style of …)"), 2차 자료는 가공 역사학자·가공 서명, 표·그래프는 **가공 합성 데이터**("ALTON-composed illustrative data, not real statistics"). 실존 인물의 말·실존 저서·실존 신문·실제 통계는 쓰지 않았다(실제 통계 2종은 허용 목록으로 제공했지만 모델이 한 번도 쓰지 않아 **재고의 실제 데이터 세트는 0**). 학생 화면 첫 줄은 `ALTON-composed stimulus`.
2. **결정적 게이트(코드)**: 출처 표기 필수 문구(`ALTON-composed`)·`provenance`, **실존 인물 전체 이름 또는 직함+성이 출처 표기에 있으면 반려**(지명 Washington·Monroe 등은 허용), 사건명 바로 뒤 연도가 **정설 날짜표**와 다르면 반려(60건: 조약·법·판결·전쟁), 시대 범위에서 벗어난 연도, 표·그래프 숫자 재계산(`derived`)과 **자료에 없는 숫자 금지**(차·합·비·변화율은 코드가 허용), **길이 단서**(정답이 가장 긴 선택지면 반려 — 초기 실행에서 반려가 많아 오답만 다시 쓰는 균형 단계 `balance` 를 두었고 본 실행에서는 프롬프트 개선으로 거의 걸리지 않음), 중복·AI 상투구·`$` 등 기호·한글.
3. **독립 풀이 2**(Opus·Sonnet, 선택지 순서를 달리한 블라인드 풀이) 전원 일치 + 제2 독립 모델 **패널(Fable, 블라인드 풀이 + 사실 점검)**: 세트 안 사실 오류·시대착오·학계 논쟁·비중립·실존 인물에게 말을 돌림·실제 텍스트 복제를 플래그. 세트 수준 플래그(자료 자체의 문제)는 세트 전체를, 문항 수준 플래그는 그 문항을 탈락시킨다. 패널이 본 316문항은 **전부 키와 일치**했고(풀이 불일치 문항은 패널에 보내지 않음) 플래그는 second_defensible 4·inaccurate 4·contested 1(전부 해당 문항·세트 탈락). `data/ap/stock/ush-panel-flags.json`.
4. **FRQ 사실 점검**(Fable): 문제·자료·기대 답안·채점 문구·**샘플 답안 3단계**(점수와 무관하게 역사적 사실이 정확해야 함)를 모두 점검했다. 첫 시도에서 저점 샘플이 사실 오류를 자주 담아(전쟁 연대·법·순서) 탈락 → 후보를 늘려 다시 쓰고 점검했다(탈락 사유가 곧 품질 신호: 점검이 실제 오류를 잡았다).
5. 민감 주제(노예제·원주민·이민·전쟁·노동·종교·정당·성)는 사건 중심·비선동으로, 시대 관점은 "관점을 분석하게 하는 문항"에서만 쓰고 출처 표기가 화자의 입장을 밝히게 했다. 공식 출제 문항·자료를 프롬프트에 넣지 않았고 CED 샘플의 자료·문항을 쓰지 않았다.

## 4. 단계 요약 (`config/ap-frozen/ush-*.v1.json`, 전부 동결 → 커밋 → 실행; 일부 FRQ 재시도는 코드 수정 뒤 재동결)
| 단계 | 후보 | 통과 | 비용 |
|---|---|---|---|
| p1-a 파일럿(MC 세트 8) | 32문항 | 6문항·세트 2 (초기 게이트 과엄격: 오답 라벨 다양성·세트 길이 단서가 결정적 탈락의 대부분 → 완화·`balance` 도입) | $0.49 |
| p2-a 본 실행(MC 세트 60) | 240문항 | **183문항(76.3 %), 세트 48/60** | $6.17 |
| p3-a 보충(MC 세트 24, 표·그래프 중심) | 96문항 | **85문항(88.5 %), 세트 24/24** | $2.51 |
| p1-b FRQ(SAQ 12·DBQ 3·LEQ 3 생성) | 18세트 | **10**(SAQ1 2·SAQ2 2·SAQ3 2·DBQ 2·LEQ 2) | $5.32 |
- p2-a 에서 표·그래프 세트가 거의 전부 탈락(통과 1/7)해 이유를 고쳐(연도처럼 보이는 표 숫자를 시대 범위 점검에서 제외, 자료 숫자의 파생값 허용) p3-a 로 보충했다.
- FRQ 반려 사유: 모델이 도구 입력을 깨진 JSON 문자열로 반환(1건, 복구 불가 → 대체 문제), 사실 점검 플래그(SAQ3 합성 데이터의 일반화 주장·LEQ 맥락화 아이디어 오류), 샘플이 채점 대역 밖(DBQ/LEQ 중·하 샘플이 채점기에서 한 단계 높게 나오는 경향 → 후보를 늘리고 대역 판정으로 바꿈).

## 5. 시험 구성
| | 단원(시대) 1–9 | 자료 유형(세트) | SAQ 시대(q1/q2/q3) | DBQ | LEQ |
|---|---|---|---|---|---|
| US1 | 2/4/8/7/8/7/8/7/4 | 1차 5 · 2차 5 · 짝지은 1 · 표 4 | 5 / 7 / 8 | 시대 6 | 시대 2–5(이주·이민) |
| US2 | 4/4/8/7/8/6/8/7/3 | 1차 5 · 2차 6 · 짝지은 2 · 표 2 | 8 / 4 / 6 | 시대 4 | 시대 3–5(연방 대 주 권한) |
(문항 스킬 범주 1/2/3/4/5: US1 6/5/19/14/11, US2 6/5/18/15/11. 단원은 문항의 토픽 코드 기준이며 세트의 시대와 ±1 단원까지 다를 수 있다.) exam_prep 라벨은 US1 26/55·US2 30/55 — 스킬 X.A(식별) 문항은 basic_learning 으로 분류해서이며 난이도 보정이 아니다.

## 6. FRQ 3단계 샘플과 AI 채점
- 각 FRQ 는 `payload.ush_frq`(스키마 `ush-frq-1`): 과제문·자료(문서 1–7 또는 Source A/B)·루브릭 행(SAQ a·b·c / DBQ thesis·context·docs·outside·sourcing·complexity / LEQ thesis·context·evidence·analysis, 행별 0..max 서술 + 과제별 기대)·기대 특징(논지 후보·맥락화·문서 밖 증거·문서별 출처 분석·SAQ 허용 답)·**3단계 주석 샘플**.
- 샘플 점수는 작성자 의도가 아니라 **독립 채점기(Opus·Sonnet)의 행별 중앙값**이고 대역 안(SAQ 3/2/1, DBQ 상 5–7·중 3–5·하 1–3, LEQ 상 5–6·중 3–5·하 1–3)·엄격한 서열·채점기 총점 편차 ≤ 2(SAQ ≤ 1)일 때만 채택. 학생 결과 화면의 참고 답안에 루브릭 요약 + 샘플 + 주석(`reference_text`, "not official College Board scoring").
- AI 채점기: 새 루브릭 id **`ushistory-v1`**(영어 `englang-v2` 는 그대로), SAQ 는 질문당 1건(a/b/c 각 1점), DBQ·LEQ 는 문항당 1건, `payload.ts` 어댑터가 `ush_frq` 를 읽는다(소스 본문·표·그래프, 샘플 3개 미만이면 채점 안 함). 자세한 내용 `docs/ap/essay-ai-grading.md` § US History. 실제 모델 호출·DB 변경 없음(테스트는 모의 클라이언트).

## 7. 화면 증거(격리 스택 `ALTON_apush`, API 54521/DB 54522, 하드닝 가드 통과)
통과 재고 83개 후보 × 390x844·1280x800 = **544항목, 점검 모두 fail 0**(`data/ap/screen-evidence/evidence-ush-s2.json`, 스크린샷 `docs/ap/screen-evidence/ush-s2/`; SAQ·DBQ 입력(frq_input_works) 10건 pass, 표 그림 43건 pass). 끝난 뒤 `isolated-stack.sh stop`(컨테이너 0, `config.toml` 원복), 개발 서버 종료, 임시 비밀번호 파일·`.venv-ap` 삭제. 자동 점검일 뿐 문장 자연스러움·역사 서술을 사람이 본 것은 아니다. 첫 증거 시도에서 `itemContentHash` 가 세트 지문·문항을 해시에 넣지 않아 모든 세트가 같은 해시가 되는 문제를 발견·수정했다(US 원형만 영향).

## 8. 한계·UNVERIFIED
- **이미지·지도 자료 없음**: 공식 MC 는 포스터·사진·만화·지도도 쓰지만 우리 그림 렌더러에 해당 유형이 없어 텍스트·표만 있다(SAQ q3 도 표). 재고의 표는 전부 **가공 합성 데이터**이며 실제 통계가 아니다(자료 표기에 명시). 막대그래프 자료는 한 건도 통과하지 않아 표만 있다.
- 사실 정확성은 **LLM 4개 검사(Opus 풀이·Sonnet 풀이·Fable 패널 + 날짜표 코드 검사)** 로 보증한 것이지 역사 교사 검수가 아니다. 출시 전 교사 표본 검수 필수(특히 FRQ 기대 답안·샘플 답안·세트 소개 자료의 시대 어조).
- 샘플 답안의 AI 채점 점수는 모델 채점기의 중앙값이다(DBQ·LEQ 는 중·하 샘플의 의도 점수보다 높게 나오는 경향이 있어 대역 판정을 썼다). 공식 채점 지침 샘플과의 일치는 검증하지 않았다.
- 두 시험이 같은 시대의 세트를 2개 안팎씩 쓴다(주제·후보는 겹치지 않는다). 시험당 1차 자료 세트가 5개로 내부 최소(5)에 가깝다.
- 이미 있는 DB 에 적재하지 않았다(원격 DB 쓰기 없음). 배치는 `STOCK_BATCHES` 에 등록만 했다. 적재 후 변환·검증 상태가 채워져야 `planDraftSet` 이 저장 가능해진다.
- 응시 화면의 시간·읽기 15분·Bluebook 도구 동작은 `ushistory-facts.md` §4. DBQ 문서 표시는 지문 패널의 단일 텍스트이다(문서 7개 + 표). 폴리싱은 마일스톤 종료 라운드 대상.
