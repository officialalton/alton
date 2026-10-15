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

## 9. Stage A — 게시 US1·US2 의 가공 표 자료 4칸을 실제 Census 자료로 교체 (2026-10-15, 브랜치 `ush-real-a`, DB 쓰기 없음)
정책: `docs/POLICY-DECISIONS.md` 2026-10-15(실제 자료·전체 출처 기록, 자료를 먼저 고정한 뒤 스킬·문항·키 근거·오답 근거 설계, 대량 재생성 없음, 새 버전 흐름으로 소규모 교체, 미해결 문항은 출시 제외). 감사: `docs/ap/ushistory-material-audit.md` §4 Stage A.

| 칸 | 교체 전(가공) | 교체 후(실제) 후보 키 | 실제 자료(레지스트리 id) | 위치·구성 |
|---|---|---|---|---|
| US1 MC `u747`(위치 42–44) | Calder City 가공 표 | `ush-real-a:ap_us_history-real_a_gm-k0` | `stat-black-pop-region-1900-1940` — Census WP 56 표 1–5, 지역별 흑인 인구 1900–1940 | 단원 7·7·6, 스킬 1.B·3.A·4.A, 시대 7, 자료 유형 quantitative(그대로) |
| US2 MC `u719`(위치 39–41) | Bayhaven 항구 가공 표 | `ush-real-a:ap_us_history-real_a_imm-k0` | `stat-foreign-born-1850-1940`(1단계 레지스트리 자료) — Census WP 81 표 1 | 단원 7·7·6, 스킬 1.B·4.B·5.A, 시대 7, quantitative |
| US1 SAQ q3 `saq3_1`(ap_saq 3) | Dunmore County 가공 표 | `ush-real-a:ap_us_history-real_a_saq3_own-k0` | `stat-homeownership-1900-1980` — Census 'Historical Census of Housing: Homeownership Rates'(미국·뉴욕·미시시피 1900–1980) | 시대 8 그대로(US1 SAQ 시대 5/7/8 유지), saq3, 스킬 1.B |
| US2 SAQ q3 `saq3_3`(ap_saq 3) | Wheatley County 가공 표 | `ush-real-a:ap_us_history-real_a_saq3_plains-k0` | `stat-plains-state-pop-1870-1900` — Census WP 56 표 31·42·49·56(캔자스·네브래스카·노스/사우스다코타 총인구) | 시대 6 그대로(US2 SAQ 시대 8/4/6 유지), saq3, 스킬 1.B |

- **자료 출처·권리**: 셋 다 미국 연방기관(Census Bureau) 간행물·표(17 U.S.C. 105, 저작권 주장 없음 → 퍼블릭 도메인), 도메인 허용 목록(census.gov) 안. 수치는 공식 파일에서 **코드로 추출**했다(`scripts/ap-generation/ush-real-a-sources.py`; WP 56 PDF `pdftotext` 의 표 1–5·31·42·49·56, 호머오너십은 `owner-tab.txt`). 지역 합 = 전국 합계를 코드가 검사한다(1900–1940 전 행 일치). 레지스트리 3건 추가(총 13건): 표 해시 `b9b4d44d…`(흑인 인구), `17a7005c…`(평원 4개 주), `963d86e5…`(자가 보유율); 원본 파일 해시(WP 56 PDF `1e60f6a4…`, owner-tab.txt `fb32f67a…`)·검색일 2026-10-15·URL·호출번호를 레지스트리와 `data/ap/ush-sources/files/<id>/SOURCE.md` 에 기록. 원본 PDF·txt 는 커밋하지 않았다(PDF 1.6 MB).
  - 평원 표의 1890 행은 '인디언 보호구역 제외' 줄을 썼고, 노스·사우스다코타의 1870·1880 값은 다코타 준주를 현재 주 면적으로 나눈 **부분 추정치**라고 원문이 밝힌 것을 학생 화면 자료 소개에 그대로 적었다(Fable 사실 점검이 "이 시기 '주'가 아니다"를 한 차례 지적 → 문항·답안에서 '주'가 아닌 '네 지역'으로 고침).
  - 인구 표 용어: Census 표의 범주명은 'Black'(1900–1950 조사는 'Negro' 용어였음)이며, 자료 소개에 범주명이 Census 의 것이라고 적었다.
- **설계 기록(자료 → 스킬 → 키 근거 → 오답 근거 → 확인 사실)**: 문항별 정의는 `scripts/ap-generation/ush-real-a-content.ts`(순수 데이터)에 있고, 각 문항의 `payload.items[].design.key_evidence_in_source`(자료 안 정답 근거 — 표의 구체 수치)·`facts`(확인해야 할 역사 사실)·옵션별 `why`(키 근거·오답별 틀린 이유)와 `label`(오답 유형)에 남는다. 정답 위치는 자료 순서와 무관하게 흩었다(키 위치 US1 gm = C·A·D, US2 imm = B·D·C).
- **게이트**: 기존 MC 게이트(`itemViolations`·표 수치 검사)와 실제 자료 게이트(레지스트리 대조·ALTON 작성 표지 금지·표 글자 그대로) + 신규 `realFrqViolations`(SAQ: 표가 레지스트리와 같은지·ALTON 표지 금지·FRQ 공통 게이트에서 'ALTON 작성 출처' 규칙만 제외). 그림 게이트(`gateCandidate`)·변환(`planConversion`) 통과.
- **독립 검증**(`scripts/ap-generation/ush-real-a-verify.ts`, 동기 호출): MC 6문항 — Opus·Sonnet 블라인드 풀이(Sonnet 은 선택지 역순) 12표 전원 키와 일치(전부 certain), Fable 사실 점검(키·근거 공개) 전 문항 sound(Fable 이 1회 'first major federal law' 문구를 contested 로 지적 → '여러 최초 연방법 중 하나'로 고쳐 재점검 통과). SAQ 2건 — 샘플 답안 3단계×독립 채점기 2(Opus·Sonnet) 총점이 의도(3/2/1)와 정확히 일치·채점기 간 편차 0, Fable 사실 점검(과제·기대 답안·루브릭·샘플) 전부 sound. 비용 **$1.33**(원장 누적 204.08 → 205.41; 한도 $6·중단 $220 이내). 미해결 칸 **없음**.
- **화면 증거**(격리 스택 `ALTON_apusha`, 포트 +100, 가드 통과): 후보 4개 × 390×844·1280×800 = 16항목, 검사 전부 pass(표 렌더 16, FRQ 입력 4, 정답·해설 비노출 16, 잘림 없음 16). 증거 `data/ap/screen-evidence/evidence-ush-real-a.json`, 스크린샷 `docs/ap/screen-evidence/ush-real-a/`. 종료 후 시드 정리·`isolated-stack.sh stop`·`config.toml` 원복·컨테이너 0 확인. 모바일(390)에서 표는 가로 스크롤 래퍼에 든다("Scroll for more" 안내).
- **배치·렌더**: `lib/ap-admin/batches.ts` 에 `ush-real-a`(`ush-real-a-2026-10-15`, 보조 적재, 증거 `evidence-ush-real-a.json`) 등록. `keys-file.ts`·`render-check.ts`·`supp-batches.ts` 는 `ush-*-items.json` 파일명 규칙(`ushItemNames`)으로 자동 인식한다. `render-check.ts` 재생성(보고서 4행 추가: ap_us_history 114행, 표 렌더 18 통과). 다른 과목 스냅샷 파일(이전 병합으로 이미 바뀐 템플릿)은 이 변경과 무관하므로 되돌리고 보고서·US History 항목만 반영했다.
- **새 버전 계획**: `data/ap/stock/us1-v2-real-a-swap-plan.json`(교체 2건 = MC 세트 1(3칸 통째) + SAQ 1), `us2-v2-real-a-swap-plan.json`(교체 2건). 생성기 `scripts/ap-generation/ush-stage-a-plans.ts [--write]`(입력: 게시 v1 슬롯 SELECT 전용 스냅샷 `data/ap/stock/ush-us1-us2-published-v1-slots.json` — 2026-10-15 `supabase db query --linked` 조회, **US1·US2 모두 게시 v1**), 검증 `lib/ap-admin/ush-stage-a-plans.test.ts`(관리자 새 버전 흐름 `resolveSwaps`+`checkNewVersionComposition` 재현, 교체 뒤 독립 검증기 위반 0·단원 수/스킬 범주 수/자료 유형/SAQ 시대 그대로·시험 간 겹침 0, 배치 등록·통과 키 일치·레지스트리·표 변조 검출). 두 계획은 서로 독립(교체해 넣는 문항이 다름)이라 순서 제약이 없다.

### 관리자 작업 순서(DB 쓰기 전부 관리자 화면 — 이 브랜치는 쓰지 않았다)
1. 이 브랜치를 통합 브랜치에 병합·배포(배치 파일·증거·계획이 번들에 실려야 한다).
2. 관리자 → Mock Exams → AP 재고 관리 → **배치 전체 적재**: 배치 **`ush-real-a`**(4키) 선택 → 미리보기(단계별 dry-run, 쓰기 0) → "확인했습니다" → 실행 (① 적재 → ② 렌더 기록 → ③ 화면 기록 → ④ 문제은행 변환). **건너뜀 허용은 켜지 않는다**: 4키 모두 렌더 보고서·화면 증거(해시 일치)가 있으므로 엄격 모드에서 멈춤 없이 끝나야 한다. 건너뜀·"검증 미완료"가 보이면 진행하지 말고 원인(증거 해시 불일치 = payload 가 배포본과 다름)을 먼저 해결. 실행 뒤 현황 표에서 `ush-real-a` 가 4/4 변환·`review_env_ready` 인지 확인.
3. **새 버전 — `AP U.S. History — Practice Exam 1`**: 계획 `us1-v2-real-a-swap-plan.json`(교체 2건: ap_mc #42 세트 `u747`→`real_a_gm`, ap_saq #3 `saq3_1`→`real_a_saq3_own`) 선택 → 미리보기(검증 통과·구성 전/후·기존 응시 수 확인) → 확인 → 초안 v2 생성 → 초안을 확인(문항 3칸 세트가 42–44, SAQ 3번) → **'새 버전 공개'**(공개 범위는 이전 공개본에서 승계).
4. **새 버전 — `AP U.S. History — Practice Exam 2`**: 계획 `us2-v2-real-a-swap-plan.json`(ap_mc #39 세트 `u719`→`real_a_imm`, ap_saq #3 `saq3_3`→`real_a_saq3_plains`) 동일 절차 → 공개. 3·4 는 서로 독립이라 어느 쪽을 먼저 해도 된다.
5. 공개 뒤 두 시험의 해당 문항을 학생 화면에서 한 번씩 연다(표 렌더·출처 표기·정답/해설 비노출). 응시 이력은 새 버전 정책대로 기존 v1 응시를 건드리지 않는다.

### Stage A 의 한계·UNVERIFIED
- 사실 정확성은 LLM 검사(Opus 풀이·Sonnet 풀이·Fable 사실 점검·채점기)로 보증한 것이며 **역사 교사 검수가 아니다**. 숫자는 코드가 공식 파일에서 추출하고 지역 합계 검증을 통과했지만 Census 표 자체의 기준 변경(1890 보호구역 포함/제외, 용어 변화)은 자료 소개의 한 줄 안내 수준이다.
- 샘플 답안 채점은 모델 채점기 결과이며 공식 College Board 채점 지침과의 일치는 검증하지 않았다.
- Lange 사진(`img-migrant-mother-1936`)은 시대 7 이라 SAQ 시대 서로 다름 규칙 때문에 쓰지 못했다(US1 은 SAQ2 가 시대 7, US2 의 q3 는 시대 6). Keppler 만화(1889, 시대 6)는 후속 DBQ(단계 B) 문서 후보라 겹침을 피해 쓰지 않았다. US1 SAQ q3 는 사진·지도가 아니라 **표**(비텍스트)다. 지도·사진 자료의 MC 전환은 단계 D.
- MC 문항의 토픽 코드는 실제 내용에 맞게 다시 붙였다(예: US1 u747 Q2 7.8 → 7.6). **단원·스킬 범주는 칸과 동일**(구성 규칙·검증기 영향 없음).
- 새 버전 공개와 DB 적재는 실행하지 않았다. 적재 후 `review_env_ready`·`release_tier` 가 채워져야 새 버전 미리보기가 통과한다(미리보기가 사유를 알려 준다).
