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

### 9-1. US1 새 버전 막힘 수정(2026-10-15): 단원 기준 불일치와 균형 교체
- **원인**: 관리자 새 버전·초안은 MC 단원을 **후보 `keyword_code` 의 단원(세트의 모든 칸에 같은 값)** 으로 센다(`buildNewVersionPreview` → `brief().unit`). 1단계 검증기·내 첫 재생은 **문항별 토픽 단원**(`members[].unit`, 세트 안에서 단원이 섞임)으로 셌다. 두 기준이 달라 게시 US1 v1 이 DB 기준으로는 이미 범위 밖(단원 3 = 11 > 최대 10, 단원 4 = 4 < 최소 5; 전체 3/3/11/4/8/8/7/7/4)인 것을 검증기가 못 봤고, 교체만 하는 계획은 `unit_3_above_max_11/10`·`unit_4_below_min_4/5` 로 막혔다(US2 는 DB 기준으로도 범위 안이라 통과).
- **수정(근본)**: `UshItem.keyUnit`(후보 keyword_code 단원)·`UshSetItem.dbUnit` 추가. `verifyUshFullComposition` 이 `dbUnit` 이 있으면 같은 범위를 DB 단원으로도 검사(`db_unit_<u>_<n>_not_in_<min>-<max>`)하고, `verifyUshAssignment`(`buildUshOrder`)와 초안 계획(`planUshDraftSet`)이 `dbUnit` 을 채운다 → 앞으로 배정·초안 검증이 DB 와 같은 단원으로 위반을 잡는다. **ILP 배정기(`solveUshSets`)의 제약은 아직 토픽 단원 기준**이라 새 배정을 만들면 검증기가 DB 단원 위반을 보고할 수 있다(후속: 제약에 keyUnit 반영).
- **US1 계획 갱신**(`us1-v2-real-a-swap-plan.json`, 같은 파일명, 생성기 `ush-stage-a-plans.ts`는 현재 DB 상태 스냅샷 `data/ap/stock/ush-us1-us2-db-state-v2.json`(US1 v1·US2 v2·변환 완료 키, SELECT 전용)에서 US1 만 계획): 교체 3건 — ① `ap_mc` #42 `u747` → `ush-real-a:…real_a_gm`(Stage A), ② `ap_mc` #7 `ush-p2-a:ap_us_history-u313-k0`(단원 3, 4문항, 헌법제정회의 타협, 2차 자료) → `ush-p2-a:ap_us_history-u418-k0`(단원 4, 4문항, 1차 자료, American System; 둘 다 exam_prep 3), ③ `ap_saq` #3 `saq3_1` → `real_a_saq3_own`. 교체 뒤 DB 단원 수 3/3/**7**/**8**/8/8/7/7/4(모두 범위 안). 교체 문항은 전부 변환 완료(`review_env_ready`)이고 US2 v1·v2 와 겹치지 않으며 테마 중복 없음, 독립 검증기(토픽 단원 + DB 단원) 위반 0, SAQ 시대·exam_prep 수 그대로, 자료 유형 최소(1차 5→6, 2차 5→4, 짝지은 1, 표 4) 충족. u418 은 시대 4 이므로 위치 7 은 시대 순서상 약간 어긋난다(구성 규칙에는 순서 조건 없음).
- **US2 계획**은 이미 적용돼(US2 v2 게시) 기록용으로 그대로 둔다(게시 v1 스냅샷으로 DB 단원 기준 재생도 통과).
- **테스트**(`lib/ap-admin/ush-stage-a-plans.test.ts`): 관리자 서비스와 같은 컨텍스트(`fullPracticeUnitBounds('ap_us_history','full_practice')`, 단원 = keyUnit)로 `resolveSwaps`+`checkNewVersionComposition` 재생 — 현재 US1 v1 이 DB 단원 11/4 로 위반임을 고정, Stage A 만 교체하면 위 두 오류로 막힘(음성 테스트), 3건 계획은 통과·교체 후 DB 단원 수 고정, 교체 문항 변환 완료·US2 와 서로소, 검증기가 교체 전 v1 의 DB 단원 위반을 잡고 교체 후 0, 균형 교체는 같은 크기만 허용.
- **관리자 순서 갱신**: §9 의 단계 3(US1)은 새 계획 3건으로 진행(미리보기 0 위반 기대). 단계 4(US2)는 이미 완료.

## 10. Stage B — 게시 US2 `dbq_1`·US1 `dbq_2` 의 가공 문서 7개 세트를 실제 자료 7개 DBQ 로 교체 (2026-10-15, 브랜치 `ush-real-b`, DB 쓰기 없음)
오너 정책(`docs/POLICY-DECISIONS.md` 2026-10-15)대로 **자료를 먼저 고정**하고(레지스트리 `data/ap/ush-sources/registry.json`, 출처·저자·연도·재사용 근거·발췌/수정·해시), 프롬프트·논지 공간·증거 지도·루브릭·샘플 답안은 그 자료 7개에서 설계했다. 가공 자료는 삭제·표지 변경 없이 보존한다(게시 v2 는 그대로, 새 버전 v3 로만 바뀐다). 시험 위치(ap_frq #1)·구간(DBQ)·시대(US2 4, US1 6)·루브릭 템플릿(ushistory-v1 DBQ 7점)·문서 7개 구조는 그대로다. 소스 DBQ 시대 범위 1754–1980 안.

| 시험 | 교체 전(ALTON 작성) | 교체 후 키 | 프롬프트 |
|---|---|---|---|
| US2 `dbq_1` | 시장 혁명(가공 편지·팸플릿·합성 차트) | `ush-real-b:ap_us_history-real_b_dbq_market-k0` | Evaluate the extent to which the market revolution changed the lives of Americans between 1815 and 1860. |
| US1 `dbq_2` | 노동 운동 1877–1900(가공 문서·합성 표) | `ush-real-b:ap_us_history-real_b_dbq_regulation-k0` | Evaluate the extent to which the growth of large corporations led to greater federal regulation of business in the United States between 1880 and 1910. |

### 문서 설계(자료를 먼저 고정 → 그 자료로 프롬프트·논지 공간)
- **US2 시장 혁명(시대 4–5)**: ① Jackson 은행 거부 메시지 1832(Avalon, 정치·1차) ② Robinson *Loom and Spindle* 1898(Gutenberg #72757, 로웰 직공 회고) ③ Tocqueville 1840(Gutenberg #816, 외부 관찰자) ④ **로웰 공장 도시 판화 c.1840(LoC, 시각)** ⑤ Thoreau *Walden* 1854(Gutenberg #205, 비판) ⑥ **지역별 인구 1800–1860(Census Bureau 표, 정량)** ⑦ **1860 센서스 노예 인구 분포 지도 1861(LoC, 시각, Stage A 레지스트리 자료)**. 논지 공간: 북부·서부 생활의 큰 변화(②③④⑥) / 변화는 불균등하며 노예제를 깊게 했다(⑦⑥) / 새 불안·갈등·비판으로 이득이 엇갈렸다(①⑤②③). 반론·복합성: ⑤는 '변화' 주장에 반론, ④는 비노동 시각을 제공하고 ⑦·② 가 이를 한정한다.
- **US1 기업 규제(시대 6–7)**: ① Sumner 1883(Gutenberg #18603, 자유방임 반론) ② 주간통상법 1887 제2조(archives.gov) ③ **Keppler 'The Bosses of the Senate' 1889(LoC, 시각, 레지스트리 자료)** ④ Sherman 반독점법 1890 제1·2조(archives.gov) ⑤ Tarbell *History of the Standard Oil Company* 1904(Gutenberg #60692, **2차(저널리즘 역사)**) ⑥ **U. J. Keppler 'Next!' 1904(LoC, 시각, 스탠더드 오일 문어)** ⑦ Sinclair *The Jungle* 1906 발췌(레지스트리 자료, 소설). 논지 공간: 큰 폭의 연방 규제 확대(②④⑤⑦③) / 한정·반응적(⑥③④⑦ — 법이 좁고 집행이 약하며 기업 영향력 지속) / 저항·시장의 답(①⑤ — Tarbell 의 석유업자는 '공정한 경쟁'을 요구, 정부 통제 요구가 아님). 1단계가 지적한 '반대 관점 없음'을 ① 과 ⑤ 로, '더 나은 통계' 문제는 아래 UNVERIFIED 를 참고한다(정량 자료는 US2 에만 있다).
- 모든 문서에 **ALTON 이 쓴 한 줄 context(사건·청중, 사실만)** 와 레지스트리의 저자·연도·저장소·재사용 근거·수정 표시가 학생 화면에 붙는다. 발췌는 저장소 원문에서 **앵커 문구→연속 구간을 코드로 잘라**(`ush-real-b-sources.py`) 해시를 고정했다(Sherman 한 곳만 원문 줄바꿈 하이픈 'other- wise'→'otherwise' 보정, 레지스트리 modified 에 기록). 학생 화면 본문은 `realDbqPassage()`(레지스트리→코드)가 만들고 게이트가 글자 그대로 일치하는지 점검한다.
- **증거 지도·문서 사용·출처 분석**은 `expected_features.evidence_map`(논증 줄별 뒷받침·복합 문서), `doc_uses`(문서별 usable_for + sourcing) 에 있고 참고 답안(`reference_text`)에 실린다. 루브릭은 ushistory-v1 7점(주장·맥락·문서 증거 2·외부 증거·출처 분석·복합성)의 ALTON 의역이며 **'ALTON reference — not official AP scoring'** 표지를 붙였다.

### 새 실제 자료와 다운로드(전부 허용 도메인; 커밋 대상은 아래 발췌·표·이미지뿐, 원본 파일은 커밋하지 않음)
| 파일(레지스트리 id) | 출처 | 크기 | 재사용 근거(항목 페이지 확인) |
|---|---|---|---|
| `txt-jackson-veto-1832` ← ajveto01.asp | avalon.law.yale.edu | 53 KB(html) | 미국 대통령 메시지(정부 저작물, 1832) |
| `txt-robinson-1898` ← pg72757.txt | gutenberg.org #72757 | 306 KB | 1898년 출판, Gutenberg 미국 내 제한 없음 |
| `txt-tocqueville-1840` ← pg816.txt | gutenberg.org #816 | 866 KB | 1840(영역 19세기), 공유 영역 |
| `txt-thoreau-1854` ← pg205.txt | gutenberg.org #205 | 668 KB | 1854, 공유 영역 |
| `txt-sumner-1883` ← pg18603.txt | gutenberg.org #18603 | 210 KB | 1883, 공유 영역 |
| `txt-tarbell-1904` ← pg60692.txt | gutenberg.org #60692 | 1.9 MB | 1904, 공유 영역 |
| `txt-ica-1887`, `txt-sherman-1890` | archives.gov milestone-documents | 75 KB·45 KB(html) | 미국 의회 법률(정부 저작물, 1887·1890) |
| `stat-region-pop-1800-1860` ← POP-twps0056.pdf(Tables 1–5) | census.gov | 1.6 MB(PDF, 커밋 안 함; 표는 코드로 추출·지역 합=전국 검증) | 미국 정부 간행물 |
| `img-next-1904`(`25884v.jpg` 1024×650) | loc.gov/item/2001695241 | 151 KB(JPEG) | LoC 'No known restrictions on publication.' |
| `img-lowell-1840`(`07376v.jpg` 1024×669) | loc.gov/item/94515606 | 361 KB(JPEG) | LoC 'No known restrictions on publication.' |
레지스트리 기존 자료 재사용: Keppler 'Bosses of the Senate', The Jungle, 1860 노예 인구 지도. 추가로 **내려받았으나 쓰지 못하고 폐기한 파일**(보고에도 명시): Statistical Abstract 1911 PDF 18개(census.gov, 합계 약 120 MB; 스캔본이라 텍스트층 없음)와 Historical Statistics 1970 ch.D PDF 1개(약 7 MB; 스캔본). 그래서 US1 에는 정량 문서가 없다. 모두 실행하지 않았고 repo 에 없다.

### 샘플 답안 3단계×독립 채점 2 + 사실 점검(Fable, 시각 자료 이미지 첨부)
- 채점(`scripts/ap-generation/ush-real-b-verify.ts`): ushistory-v1 루브릭으로 Opus·Sonnet 각각 독립 채점. **US2: 상 7·7, 중 4·5, 하 1·1(대역 상 5–7 / 중 3–5 / 하 1–3 전부 안, 단계 엄격 순서). US1: 상 7·7, 중 4·4, 하 1·1.** 채점기 간 편차는 중 단계 US2 에서만 1점.
- 사실 점검(Fable): 문서 7개·프롬프트·증거 지도·루브릭·외부 증거·facts·샘플 3개 항목별 verdict, 전부 sound·플래그 0(최종). 과정에서 **고친 것**: (1) 'Next!' 이미지 설명(실제로는 국회의사당·주 의사당을 감고 백악관을 향해 뻗음, 상원·백악관을 이미 감은 것으로 잘못 씀) (2) Sumner 발췌에 없는 문장을 문서 사용·샘플에 귀속 (3) Tocqueville 발췌에 없는 '휴가' 세부 (4) Robinson 의 예금자 수 vs 예금액 오독 (5) 1861 지도 출처를 '연방 정부 제작'으로 과장(실제: 센서스 자료로 Hergesheimer 가 그리고 Graham 이 발행) (6) 증거 지도의 한 문서를 같은 줄에 뒷받침·복합으로 동시 기재 (7) Keppler 부자(Joseph·Udo) 혼동 (8) 파일 설명의 깃발 문자 단정. 수정 뒤 재채점·재점검(3라운드). 원자료: `data/ap/sample-2027/ush-real-b/*.round1|round2.*.txt`(이전 라운드), `real-b-verification*.json`.
- 비용: 이 브랜치 3라운드 합계 **$3.78**(원장 214.59 → 218.37; 한도 $6·중단 $226 이내). 사실 점검도 LLM 이며 **역사 교사 검수가 아니다**.

### 화면(학생 시험 화면, 문서 패널)과 이미지 확대
- 변경: DBQ 는 한 문제에 이미지가 2장이라 그림 스펙을 확장(`lib/problem-figures/spec.ts` `ImageFigureSpec.label`·`more`(static 전용, 최대 3장; path·credit 검증), `lib/ap-figures/normalize.ts`, `lib/problem-figures/check.ts` alt·credit 점검, `app/session/[id]/ProblemFigure.tsx`). 각 이미지에 **라벨(Document N)·출처 캡션(항상 표시)·"Tap or click the image to open it full size."** 와 원본 크기 **새 탭 링크**(`<a target=_blank rel=noopener>`)를 둔다 — 390px 에서 1024px 이미지는 약 35 % 로 줄어 만평·지도 글자가 읽히지 않아, 가장 작은 안전한 개선으로 확대 링크를 택했다. 단위 테스트 `app/session/[id]/ProblemFigure.static-image.test.tsx`(3).
- 격리 스택(`ALTON_apushb`, 포트 +100, 가드 통과)에서 두 DBQ × 390×844·1280×800 = 4항목, `data/ap/screen-evidence/evidence-ush-real-b.json` 점검 전부 pass(입력 가능·정답/해설 비노출·잘림 없음·그림 렌더 포함). 스크린샷 `docs/ap/screen-evidence/ush-real-b/`(항목 4 + 그림 칸 `figures-*-390|1280.png` + 문서 패널 `panel-top-*-1280.png`). 측정: 이미지 4장 모두 로드·라벨·출처 캡션 표시(390px 에서 약 358 px 폭으로 줄어듦), 각 문제의 첫 이미지 링크를 새 탭으로 열어 원본(로웰 1024×669, Bosses 1024×808)이 열리는 것 확인(지도 링크는 같은 컴포넌트이며 단위 테스트로 href·target 을 확인). 데스크톱 1280 에서도 이미지는 문서 본문 **아래**에 나온다(스크롤 필요; 본문이 문서 N 이 이미지임을 알려 줌). 종료 뒤 개발 서버 종료·`isolated-stack.sh stop`·`config.toml` 원복·컨테이너 0·임시 비밀번호 삭제.

### 배치·렌더·계획
- 배치 `ush-real-b`(2키; 보조 적재, 증거 `evidence-ush-real-b.json`)를 `lib/ap-admin/batches.ts` 에 등록(`ush-*-items.json` 규칙으로 키 파일·render-check·supp 자동 인식). `render-check.ts` 재생성: 보고서(report.json·md)만 바뀜(4097행, `image:static` 2행 통과; 다른 과목 스냅샷 변경 없음).
- 새 버전 계획(게시 v2 → v3, 각 1건): `data/ap/stock/us2-v3-real-b-swap-plan.json`(`ap_frq` #1 `ush-p1-b:…dbq_1-k0` → `ush-real-b:…real_b_dbq_market-k0`), `us1-v3-real-b-swap-plan.json`(`ap_frq` #1 `ush-p1-b:…dbq_2-k0` → `…real_b_dbq_regulation-k0`). 생성기 `scripts/ap-generation/ush-stage-b-plans.ts [--write]`, 입력 = **게시 US1 v2·US2 v2 SELECT 전용 스냅샷**(`data/ap/stock/ush-us1-us2-published-v2-slots.json`, 2026-10-15 `supabase db query --linked`; 두 시험 모두 status published, DB 단원 수 범위 안).
- 테스트 `lib/ap-admin/ush-stage-b-plans.test.ts`(15): 관리자 새 버전 흐름(`resolveSwaps` + `checkNewVersionComposition`, `fullPracticeUnitBounds`, **DB 단원 = 후보 keyword_code 단원**)을 라이브 스냅샷에서 재현해 0 위반, 교체 뒤 독립 검증기(`verifyUshAssignment`, 두 시험 합) 0 위반·다른 칸 그대로·다른 시험에는 적용 불가, 배치 등록·키 일치·레지스트리·`realDbqViolations` 0, 문서 7(시각 2)·모든 문서가 논증 줄을 뒷받침·반론 문서 존재·표지, 변조 8종(발췌 글자·표 숫자·이미지 출처·본문 순서·증거 지도·ALTON 표지·이미지 칸 불일치·같은 줄 지지·복합) 검출, 변환 시 이미지 2장(라벨·출처)이 그림 칸에 실림.

### 관리자 작업 순서(DB 쓰기 전부 관리자 화면 — 이 브랜치는 쓰지 않았다)
1. 이 브랜치를 통합 브랜치에 병합·배포한다(배치 파일·증거·계획·**이미지 `public/ap-sources/img-next-1904`, `img-lowell-1840`**·확대 링크 코드가 번들에 실려야 한다).
2. 관리자 → Mock Exams → AP 재고 관리 → **배치 전체 적재**: 배치 **`ush-real-b`**(2키) 선택 → 미리보기(dry-run, 쓰기 0) → "확인했습니다" → 실행(① 적재 ② 렌더 기록 ③ 화면 기록 ④ 문제은행 변환). **건너뜀 허용은 켜지 않는다**(2키 모두 렌더 보고서·화면 증거 해시 일치). 건너뜀·'검증 미완료'가 보이면 진행하지 말고 payload 와 배포본 불일치부터 푼다. 현황 표에서 `ush-real-b` 가 2/2 변환·`review_env_ready` 인지 확인.
3. **새 버전 — `AP U.S. History — Practice Exam 1`**: 계획 `us1-v3-real-b-swap-plan.json`(교체 1건) 선택 → 미리보기(검증 통과·기존 응시 수) → 확인 → 초안 v3 → 초안에서 FRQ 1번이 새 DBQ(대기업과 연방 규제)인지, 문서 3·6 이미지가 보이는지 확인 → **'새 버전 공개'**(공개 범위는 이전 공개본에서 승계).
4. **새 버전 — `AP U.S. History — Practice Exam 2`**: 계획 `us2-v3-real-b-swap-plan.json` 동일 절차(FRQ 1번 = 시장 혁명 DBQ, 문서 4·7 이미지). 3·4 는 서로 독립이라 순서 무관.
5. 공개 뒤 두 DBQ 를 학생 화면(휴대폰 폭 포함)에서 한 번씩 열어 이미지·출처 캡션·'열기' 링크·정답/해설 비노출을 확인한다. 기존 v2 응시 이력은 새 버전 정책대로 건드리지 않는다. 미리보기가 source version 불일치를 보이면 그 사이 다른 v3 가 만들어진 것이니 `ush-stage-b-plans.ts` 로 새 스냅샷에서 다시 만든다.

### Stage B 의 한계·UNVERIFIED
- 사실 정확성은 LLM 검사(Opus·Sonnet 채점, Fable 사실 점검)로 보증한 것이며 **역사 교사 검수가 아니다**. 샘플 답안의 점수는 모델 채점기 결과이고 College Board 공식 채점 지침과의 일치는 검증하지 않았다(루브릭 라벨: ALTON reference — not official AP scoring).
- **US1 DBQ 에는 정량 문서가 없다**(텍스트층 있는 공식 통계를 찾지 못함 — 위 폐기 파일 참고). 필수 구성이 아니라 '적절한 곳에서'였고 2차 자료(Tarbell)·정책 문서 2종·시각 2종으로 구성했다. 후속: 텍스트층 있는 산업 집중 통계가 확인되면 ⑥·⑦ 중 하나를 교체.
- Tarbell 은 저널리즘 저작이며(2차 자료 표시, 사건 30여 년 뒤 저술) 엄밀한 학술 2차 자료가 아니다. Sinclair 는 소설이다(근거 자료가 아니라 여론·집필 목적 자료로 쓰도록 노트에 명시). 로웰 판화(제작자·목적 미상, LoC 날짜 c.1840), 'Next!'(두 쪽 펼침면, 가운데 접힘 보임), 'Bosses of the Senate'(LoC 필름 색띠 보임)는 원본 그대로다.
- Document 7(US2) 지도의 작은 인쇄 글자·범례는 390px 에서 읽을 수 없어 확대 링크로만 읽는다(앱 안 확대 뷰어는 만들지 않았다).
- 한 문제에 이미지가 둘 이상이면 이미지는 문서 본문 **아래**에 한꺼번에 나온다(문서 사이에 끼워 넣지 않음). 문서 인라인 배치는 폴리싱 라운드 후보.
- 새 버전 공개·DB 적재는 실행하지 않았다. 적재 후 `review_env_ready`·`release_tier` 가 채워져야 새 버전 미리보기가 통과한다(미리보기가 사유를 알려 준다).

## 11. Stage C·D — 게시 US1·US2 의 가공 1차·2차 자료 MC 세트 7개를 실제 자료 세트로 교체 (2026-10-15, 브랜치 `ush-real-cd`, DB 쓰기 없음)
오너 정책(`docs/POLICY-DECISIONS.md` 2026-10-15)대로 **자료를 먼저 고정**하고(레지스트리 `data/ap/ush-sources/registry.json`: 저자·연도·저장소·권리 문구·수정 표시·해시), 스킬 → 정답 근거(자료 안 증거) → 오답 근거는 그 자료에서 설계했다(`ush-real-c-content.ts`·`ush-real-d-content.ts`, 문항마다 `design.key_evidence_in_source`·`facts`·옵션별 `why`). 가공 세트는 삭제·표지 변경 없이 보존하고, 게시 v3 → **새 버전 v4** 로만 바뀐다. 칸 크기(3·4문항)·시대·후보 단원(keyword_code, DB 기준)·문항별 토픽 단원·스킬 범주 순서·난이도 라벨은 교체되는 세트와 같다(DB 에서 읽은 단원 기준 구성 검사가 그대로 통과).
**게시 상태 확인**: 2026-10-15 SELECT 전용(`supabase db query --linked`)으로 US1·US2 모두 **v3 가 게시**(v1·v2 보관)인 것을 확인했고 슬롯을 `data/ap/stock/ush-us1-us2-published-v3-slots.json` 에 저장했다(`mock_exam_set_items` ⨝ `ap_candidate_problems`, 60칸씩).

| 시험·칸 | 교체 전(ALTON 작성) | 교체 후 키 | 자료 | 시대·단원 | 스킬(그대로) |
|---|---|---|---|---|---|
| US2 ap_mc 24–26 `u526` | 가공 북군 대위 편지 | `ush-real-c:…real_c_emanc-k0` | Emancipation Proclamation 발췌(레지스트리 기존 `txt-emancipation-1863`) | 5 · 5.9 | 2.A·4.B·1.A |
| US2 ap_mc 20–23 `u408` | 가공 볼티모어 선주 편지 | `…real_c_monroe-k0` | Monroe 7차 연두교서 1823(`txt-monroe-1823`) | 4 · 4.4 | 2.B·3.A·4.B·5.A |
| US1 ap_mc 22–25 `u528` | 가공 오하이오 타운 연설 | `…real_c_fsa-k0` | 도망노예법 1850 제5·6·7·8조(`txt-fugitive-slave-act-1850`) | 5 · 5.4 | 2.A·3.A·4.A·1.B |
| US1 ap_mc 26–29 `u531` | 가공 조지아 병사 아내 편지 | `…real_c_jones-k0` | J. B. Jones, *A Rebel War Clerk's Diary* 1863 리치먼드 빵 폭동 일기(`txt-jones-diary-1863`) | 5 · 5.9 | 2.A·3.A·4.A·5.A |
| US2 ap_mc 27–30 `u527` | 가공 현대 역사가(2차) | `ush-real-d:…real_d_reynolds-k0` | Reynolds 1856 정치 지도(기존 `map-reynolds-1856`) | 5 · 5.6 | 3.A·3.D·4.B·5.B |
| US2 ap_mc 42–45 `u720` | 가공 외교사가(2차) | `…real_d_school-k0` | Puck 만평 'School begins' 1899(`img-school-begins-1899`) | 7 · 7.2 | 3.B·3.D·4.A·5.B |
| US1 ap_mc 34–37 `u616` | 가공 역사가(2차) | `…real_d_reserv-k0` | 1892 연방 인디언 보호구역 지도(`map-indian-reservations-1892`) | 6 · 6.3 | 3.A·3.D·4.A·5.A |
**변환하지 않은 칸(미해결, 가공 세트 그대로)**: US2 `u617`(Plessy/짐 크로, 2차 자료 둘의 짝지은 세트). 1896 전후 시대 6 에 맞는 **공개 도메인 시각·정량 자료를 확인하지 못했다**(LoC 검색에서 시대 맞는 짐 크로 사진·만평이 안 나왔고, 시대 7 의 FSA 사진은 세트 시대·토픽을 바꾸게 된다). 현대 학술 서술은 저작권이라 쓰지 않았다. 짝지은 세트 최소 1(US2 에는 `u959` 도 있음)은 유지된다. 만평·사진을 찾으면 같은 절차로 후속 라운드에서 변환한다. 나머지 가공 세트는 '가공' 표지로 보존.
**자료 유형**: Stage C 는 `primary_text` 그대로. Stage D 는 `ush_set.stim_type = "visual"` (지도·만평) — 구성 규칙의 4개 유형 최소(paired≥1·quantitative≥1·primary≥5·secondary≥2)는 교체 뒤에도 충족(US1 2차 4→3, US2 2차 6→4; 계획기·검증기가 확인).

### 새 실제 자료와 다운로드(전부 허용 도메인; 커밋 대상은 아래 발췌·이미지뿐, 원본 파일은 커밋하지 않음; 큰 PDF 스캔은 내려받지 않았다)
| 파일(레지스트리 id) | 출처 | 크기 | 권리(항목 페이지 확인) | 원본 해시(sha256 앞 16) |
|---|---|---|---|---|
| `txt-monroe-1823` ← monroe.asp (발췌 212 단어, 3구간) | avalon.law.yale.edu | 10.5 KB(html) | 대통령 메시지(정부 저작물, 1823) | 원본 `98c19828…`, 발췌 `6226fefd…` |
| `txt-fugitive-slave-act-1850` ← fugitive.asp (290 단어, 4구간) | avalon.law.yale.edu | 21 KB(html) | 의회 법률(정부 저작물, 1850) | 원본 `9e0aaf64…`, 발췌 `a614227b…` |
| `txt-jones-diary-1863` ← pg31087.txt (238 단어, 4구간) | gutenberg.org #31087 | 1.99 MB(txt, 1·2권 합본) | 1866 출판, Gutenberg 미국 내 제한 없음 | 원본 `2d09350d…`, 발췌 `3d966a8c…` |
| `img-school-begins-1899`(`28668v.jpg` 1024×662) | loc.gov/pictures/item/2012647459 | 177,467 B(JPEG) | LoC 'No known restrictions on publication.' | `8b79f1f7…` |
| `map-indian-reservations-1892`(IIIF 12.5%, 1311×839) | loc.gov/item/2009579467 (tile.loc.gov) | 279,525 B(JPEG) | LoC 지도과 자료 'free to use and reuse'(Rights Advisory 없음) | `33d21576…` |
기존 레지스트리 재사용: `txt-emancipation-1863`, `map-reynolds-1856`. 발췌는 저장소 원문에서 **앵커 문구→연속 구간을 코드로 잘라**(`scripts/ap-generation/ush-real-cd-sources.py`) 해시를 고정했다(손으로 옮기지 않음). 학생 화면 본문은 `ush-real-cd-build.ts` 의 `setIntro()`(레지스트리→코드)가 만들고 게이트가 글자 그대로 일치하는지 점검한다. 이미지는 `data/ap/ush-sources/files/<id>/image.jpg` + `public/ap-sources/<id>/image.jpg`(LoC 원본 그대로, 수정 없음).
- 지도·만평 사용 범위: 눈으로 읽을 수 있는 글자·색·배치만 문항 근거로 썼다(Reynolds 지도 아래 통계표는 읽을 수 없어 쓰지 않음, 1892 지도 범례도 쓰지 않음). 'School begins' 는 인종 희화를 포함한 1899년 제국주의 지지 관점의 자료이며 자료 소개가 이를 역사 자료로 제시한다.

### 독립 검증(`scripts/ap-generation/ush-real-cd-verify.ts`, 동기 호출; 이미지 세트는 풀이·점검 요청에 **이미지를 첨부**)
- 블라인드 풀이(Opus·Sonnet, Sonnet 은 선택지 역순) 27문항 54표 **전원 키와 일치**(두 모델 모두 'certain'/'likely', 'also defensible' 최종 0), Fable 사실 점검(키·근거 공개; 이미지 세트는 이미지 첨부) 전 문항 sound·플래그 0(최종).
- 과정에서 **고친 것**: (1) 길이 단서 — 처음 문항 27개 중 대부분의 키가 가장 길었다(게이트 `key_is_longest_option`·`key_much_longer`) → 키를 줄이고 오답을 같은 문체·길이로 보강해 **키가 가장 긴 선택지인 문항 0**(테스트 고정). (2) Fable 이 지적한 자료 오독 — Monroe 해설이 발췌에 없는 러시아 제안을 언급, '미국 체제를 옹호한다'는 발췌에 없는 구절, 도망노예법 해설이 법이 영토를 다룬다고 쓴 것, Jones 문항의 '투기꾼·extortioners' 근거가 발췌에 없어 Jones 발췌에 해당 구간 추가(레지스트리 재해시), Jones '현재형', Emancipation '전쟁 전 요구' 오기, Gadsden 해설 과장, Reynolds 문항 시점 모호(1857 Dred Scott 도 가능) → 줄기에 '1855·1856' 명시. 1라운드 기록은 `data/ap/sample-2027/ush-real-c/*.round1.*`·`round1-verification.json`.
- 비용: 이 브랜치 **$1.79**(원장 219.13 → 220.92; 한도 $10·누적 중단 $260·원장 중단선 $295 이내). 사실 점검도 LLM 이며 **역사 교사 검수가 아니다**.

### 화면 증거·배치·렌더·계획
- 격리 스택 `ALTON_apushcd`(포트 +100, 가드 통과)에서 후보 7개 × 390×844·1280×800 = **54항목, 점검 전부 pass**(보기 보임 54, 그림 렌더 24(이미지 세트 12문항×2), 정답·해설 비노출 54, 잘림 없음 54; 수식 원문 없음 54). 증거 `data/ap/screen-evidence/evidence-ush-real-c.json`(30)·`evidence-ush-real-d.json`(24), 스크린샷 `docs/ap/screen-evidence/ush-real-cd/`. 시드 정리(`local-demo-seed.ts cleanup`)·개발 서버 종료(내가 시작한 PID)·`isolated-stack.sh stop`·`config.toml` 원복·컨테이너 0·임시 `.env.local` 원복 확인.
- 배치 `ush-real-c`(4키)·`ush-real-d`(3키)를 `lib/ap-admin/batches.ts` 에 등록(보조 적재; `ush-*-items.json` 규칙으로 키 파일·render-check·supp 자동 인식). `render-check.ts` 재생성: 보고서(report.json·md)만 바뀜.
- 새 버전 계획(게시 v3 → v4; **Stage C 와 D 를 한 계획으로**): `data/ap/stock/us1-v4-real-cd-swap-plan.json`(교체 3건: `ap_mc` #22 `u528`, #26 `u531`, #34 `u616`), `us2-v4-real-cd-swap-plan.json`(교체 4건: #24 `u526`, #20 `u408`, #27 `u527`, #42 `u720`). 생성기 `scripts/ap-generation/ush-stage-cd-plans.ts [--write]`(입력 = 게시 US1 v3·US2 v3 SELECT 전용 스냅샷). 두 계획은 서로 독립(교체해 넣는 세트가 다름)이라 순서 무관.
- 테스트 `lib/ap-admin/ush-stage-cd-plans.test.ts`(20): 관리자 새 버전 흐름(`resolveSwaps` + `checkNewVersionComposition`, `fullPracticeUnitBounds`, **DB 단원 = 후보 keyword_code 단원**)을 라이브 스냅샷에서 재현해 0 위반(세트 통째 교체), 독립 검증기(`verifyUshAssignment`, 두 시험 합) 0 위반·DB 단원 수 범위 안·다른 칸 그대로·교체 문항의 크기·시대·keyUnit·토픽 단원·스킬 범주 동일·다른 시험에는 적용 불가, 배치 등록·키 파일·증거 전 항목 pass·레지스트리·게이트·변환 가능·검증 기록, 난이도 라벨 동일·키가 가장 긴 선택지 아님·정답 위치 분산, 변조(발췌 글자·ALTON 표지·이미지 출처·해시) 검출, 표시문 = 코드 생성 문안·이미지 칸에 출처 실림, 레지스트리 자료 중복 없음.

### 관리자 작업 순서(DB 쓰기 전부 관리자 화면 — 이 브랜치는 쓰지 않았다)
1. 이 브랜치를 통합 브랜치에 병합·배포한다(배치 파일·증거·계획·**이미지 `public/ap-sources/img-school-begins-1899`, `map-indian-reservations-1892`** 가 번들에 실려야 한다).
2. 관리자 → Mock Exams → AP 재고 관리 → **배치 전체 적재**: 배치 **`ush-real-c`**(4키)와 **`ush-real-d`**(3키)를 각각 미리보기(dry-run, 쓰기 0) → "확인했습니다" → 실행(① 적재 ② 렌더 기록 ③ 화면 기록 ④ 문제은행 변환). **건너뜀 허용은 켜지 않는다**(7키 모두 렌더 보고서·화면 증거 해시 일치). 건너뜀·'검증 미완료'가 보이면 진행하지 말고 payload 와 배포본 불일치부터 푼다. 현황 표에서 두 배치가 4/4·3/3 변환·`review_env_ready` 인지 확인.
3. **새 버전 — `AP U.S. History — Practice Exam 1`**: 계획 `us1-v4-real-cd-swap-plan.json`(교체 3건) 선택 → 미리보기(검증 통과·구성 전/후·기존 응시 수 확인; source version 이 v3 인지) → 확인 → 초안 v4 생성 → 초안에서 세트 위치 22–25·26–29(1차 자료)·34–37(지도)이 새 자료인지 확인 → **'새 버전 공개'**(공개 범위는 이전 공개본에서 승계).
4. **새 버전 — `AP U.S. History — Practice Exam 2`**: 계획 `us2-v4-real-cd-swap-plan.json`(교체 4건) 동일 절차(위치 20–23·24–26·27–30(지도)·42–45(만평)). 3·4 는 서로 독립이라 순서 무관. 미리보기가 source version 불일치를 보이면 그 사이 다른 v4 가 만들어진 것이니 `ush-stage-cd-plans.ts` 를 새 스냅샷으로 다시 만든다.
5. 공개 뒤 두 시험의 해당 문항을 학생 화면(휴대폰 폭 포함)에서 한 번씩 연다: 지도·만평이 문서 본문 **아래**에 보이는지, 출처 캡션·정답/해설 비노출. 기존 v3 응시 이력은 새 버전 정책대로 건드리지 않는다.

### Stage C·D 의 한계·UNVERIFIED
- 사실 정확성은 LLM 검사(Opus·Sonnet 풀이, Fable 점검)로 보증한 것이며 **역사 교사 검수가 아니다**. 지도·만평 문항의 근거(색·글자·배치)는 이미지를 첨부한 모델 검사와 개발자 육안으로 확인했다.
- 도망노예법(290 단어)·Jones 일기(238 단어)는 발췌가 길다(학생 화면에서 스크롤). Jones 는 Confederate 관료의 시점('mob'·'extortioners')이며 자료 소개가 이를 밝힌다. 'School begins' 는 제국주의 지지 관점의 1899년 만평(인종 희화 포함)이다. 1892 지도는 보호구역을 주색으로 표시하고 범례는 작아 문항이 쓰지 않는다.
- 앱 안 확대 뷰어는 없다(지도 글자는 390px 에서 작음; Stage B 의 '새 탭 원본 보기' 링크는 이 세트에도 적용). 문서 인라인 배치는 폴리싱 라운드 후보.
- US2 `u617` 미변환(위 사유). 새 버전 공개·DB 적재는 실행하지 않았다. 적재 후 `review_env_ready`·`release_tier` 가 채워져야 새 버전 미리보기가 통과한다(미리보기가 사유를 알려 준다).
