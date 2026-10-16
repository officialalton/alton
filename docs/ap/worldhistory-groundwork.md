# AP World History: Modern — 엔지니어링·생성·WH1/WH2 배정 (2026-10-15)

공식 사실은 `docs/ap/worldhistory-facts.md`(CED effective Fall 2026 직접 대조: **MC 55/55분/4지선다 3–4문항 자료 세트 · SAQ 3(각 3점) · DBQ 7점(문서 7) · LEQ 6점(필수) · 완전 디지털 · 2027-05-06 1교시**). 오너 정책(2026-10-15, `docs/POLICY-DECISIONS.md`)을 **처음부터** 적용했다: 모든 자료(사료 텍스트·이미지·통계)는 **실제 자료**이고 출처·저자·연도·재사용 근거·발췌/변경·sha256 을 레지스트리에 고정한 **뒤에** 모델이 그 자료에서 스킬·문항·정답·오답 근거를 설계한다. 가공·합성 자료는 하나도 없다(ALTON 이 쓴 것은 자료마다 붙는 한 줄 맥락(사실만)·과제문·루브릭·기대 답안·샘플 답안뿐이며 표지가 붙는다).

## 1. 결과 요약
- **WH1·WH2 정확 배정 완료**: 가상 칸 0, 독립 검증기 위반 0, 두 시험 겹침 0(후보·문항군 서로소), HiGHS 최적. `data/ap/stock/exact-assign-worldhistory-wh1-wh2.json`. 각 시험 MC 55 = 세트 15(4문항 10 + 3문항 5), 단원(DB 기준) 4/4/8/8/7/8/6/6/4, 자료 유형 WH1 1차 8·2차 3·짝지은 1·정량 1·이미지 2 / WH2 1차 6·2차 3·짝지은 1·정량 1·이미지 4, 스킬 범주 1–5 모두 ≥ 3. FRQ = SAQ 3(시대 구간 WH1 4/1/2 · WH2 3/4/1) + DBQ + LEQ.
- **재고**: MC 세트 30(문항 110, 모두 통과 세트) + FRQ 10(SAQ 6·DBQ 2·LEQ 2). 계획은 `lib/ap-generation/wh-plan.ts`(세트 30·FRQ 10, 자료별 맥락 한 줄), 자료 52건은 `data/ap/wh-sources/registry.json`.
- **비용**(이 워크트리 원장): 생성·검증 **$14.33**(파일럿 MC $0.53 · 본 MC $2.85+재시도 $0.06 · FRQ 4라운드 $12.0 중 gen·fact·samples·grade·fact2 포함) + 루브릭 보정(실제 채점 경로) **$1.85**(원장 미기록 경로) = 약 **$16.2**(상한 $22). 원장 누적 $238.72(병합 포함, 중단선 $295).

## 2. 코드 구성
- 규칙·데이터: `lib/ap-exam/wh-rules.ts`(55문항·세트 3–4·14–18·자료 유형 최소·SAQ 시대 구간 서로 다름·`whUnitBounds`), `data/ap/curriculum-2027/ap_world_history.json`(9단원 71토픽 17스킬, 생성기 `scripts/ap-curriculum/wh-curriculum-build.py`), `full-set-rules.ts`·`layouts.ts`·`frq-delivery.ts`·`subject-tools.ts`·`gates.ts`·`convert.ts`(whap_frq), `assemble-draft.ts`(WH 접두)·`assemble-wh-draft.ts`·`wh-pool.ts`·`wh-assign.ts`(**단원은 DB 와 같은 후보 keyword_code 단원**을 배정기·검증기·초안 계획기가 처음부터 사용).
- 자료: `scripts/ap-generation/wh-sources.py`(저장소 원본에서 앵커 문구로 발췌를 코드로 자름, 해시 기록, 이미지 복사)·`wh-sources-manifest.json`, `lib/ap-generation/wh-real-gates.ts`(레지스트리 무결성·학생 화면 문안이 레지스트리와 글자 그대로 같은지·문항 게이트·근거 인용이 자료에 있는지·토픽이 세트 단원 안인지).
- 생성: `wh-prompts.ts`·`wh-frq.ts`(스키마 `whap-frq-1`)·`wh-real-frq-gates.ts`·`wh-build.ts`·`wh-pipeline.ts`(MC: gen(세트당 n+2문항, 이미지 첨부) → check → balance → solve(Opus·Sonnet 블라인드) → panel(Fable, 이미지 첨부) → finalize; FRQ: frq-gen → frq-fact(Fable) → frq-samples → frq-grade(독립 2) → frq-fact2 → frq-finalize), 동결 구성 `config/ap-frozen/wh-{p1,m1,m2,f1,f2,f3,f4}.v1.json`(freeze → 커밋 → check-only → 실행).
- 채점기: 루브릭 id **`whap-v1`**(SAQ a·b·c / DBQ 6행 7점 / LEQ 4행 6점, US History 와 같은 공개 구조), `payload.ts` 가 `whap_frq` 를 읽음, `lib/essay-grading/whap.test.ts`.
- 배치 등록: `lib/ap-admin/batches.ts` `wh-p1·wh-m1·wh-m2·wh-f1·wh-f2·wh-f3·wh-f4`(`wh-*-items.json` 규칙으로 키 파일·render-check·supp 자동 인식), 증거 `evidence-wh-s1.json`.

## 3. 실제 자료(52건; 파일명·출처·크기·권리는 레지스트리와 `data/ap/wh-sources/files/<id>/SOURCE.md`)
- **텍스트 38**: Project Gutenberg(Marco Polo/Yule, Decameron/Payne, Bābur-nāma/Beveridge, Las Casas, Equiano, Bernal Díaz/Lockhart, Smith, Wollstonecraft, Engels, Manifesto, Kipling, Twain, Gandhi 2구간, Sun Yat-sen, Morgenthau, Lenin, Wells, Lybyer, Malleson), Avalon(Magna Carta, 인권선언, Kanagawa, Wilson 14, Truman, Atlantic Charter, Order No.1, Sykes-Picot, Balfour, League Covenant), Wikisource(Tientsin, McMahon–Hussein 2건, 1922 White Paper), archive.org(Backhouse & Bland 1914 Qianlong 칙서), LoC Country Studies(Ghana·China 2구간·India·Egypt; archive.org OCR 텍스트). 모두 1929년 이전 발행이거나 미국 정부 저작물이다(Gutenberg 등 저장소의 권리 문구 기록).
- **이미지 10**(Wikimedia Commons PD 태그 확인·CIA 사진은 PD-USGov-CIA; ≤1280px JPEG): Catalan Atlas(Mansa Musa), Rhodes Colossus, Jahangir(Bichitr), 1898 Petit Journal 중국 케이크, Piri Reis 지도, 몽골 내습 그림두루마리, Brookes 선박 도면 포스터(1788), Doré 런던, Sykes-Picot 지도(UK National Archives), 베를린 장벽 CIA 사진. 용량 ≤0.99 MB, 각 파일 sha256·출처 URL·권리 근거·대체 설명 기록.
- **통계 2**: U.S. Census Bureau "Historical Estimates of World Population" 의 요약 하한·상한(1000–1500, 1700–1900; 값 변경·계산 없음).
- 내려받은 저장소 파일(커밋 안 함): Gutenberg txt 다수(0.1–2.8 MB), Avalon html, archive.org 텍스트(OCR djvu, 1–2.2 MB: Country Studies·Annals and Memoirs), Wikisource 원문, Commons 썸네일. 모두 실행하지 않았다. 폐기: 이미지 `img-berlin-wall-1961`(출처가 국가기록원 경유 불명확 → CIA 사진으로 교체), LoC Berlin 사진(권리 "not evaluated"), Mexico·Japan Country Study(대출 제한/없음), Census API(키 필요). 사용하지 않은 다운로드: Gutenberg Nemesis·Smiles·Kaempfer 검색 결과 등.

## 4. 단계 요약
| 단계 | 후보 | 통과 | 비용 |
|---|---|---|---|
| p1 파일럿(MC 4세트) | 23문항 | 4/4 세트(문항 23/23) | $0.53 |
| m1 본(MC 26세트) | 142문항 | 25/26 세트(문항 130) | $2.85 |
| m2 재시도(Ghana 세트) | 5문항 | 1/1 | $0.06 |
| f1–f4 FRQ(10 팩, 4라운드) | 팩 10 | 10/10 | $2.43 + 2.40 + 1.62 + 4.45 |
- 걸러낸 사례(결정적 게이트·점검이 실제 오류를 잡음): **맥락 한 줄의 사실 오류**(Tientsin 조약을 "2차 아편전쟁 뒤"로 적음 → 전쟁 "중" 으로 정정), 레지스트리 표기 정정(Piri Reis 직함, Atlantic Charter 발췌 범위 표기, 두루마리 이미지의 인물 수), 모델이 쓴 기대 답안의 논쟁적·부정확 서술(흑사병–원 멸망 인과, 오픈도어 노트, 하이티 혁명 지도자, "처음으로" 서술)·샘플 답안의 시대착오(저점 샘플이 세균설 귀속)·사료 오인(칙서가 교역을 거부했다는 서술) → 재생성·후보 확대로 해결. 출처 표기(저자·저장소·재사용 근거·수정 표시)는 학생 화면에 자료와 함께 항상 보인다.
- 풀이 일치율: 파일럿 23/23, 본 120/142 이상(블라인드 풀이 2 + Fable 패널 모두 키와 일치한 문항만 통과). 키 위치는 균형(36/36/35/35).

## 5. 화면 증거·루브릭 보정
- 격리 스택 `ALTON_whap`(포트 +100, 하드닝 가드 통과), 40후보 × 390×844·1280×800 = **80 항목(중복 제거), 점검 모두 pass**(`data/ap/screen-evidence/evidence-wh-s1.json`, 스크린샷 `docs/ap/screen-evidence/wh-s1/`; 이미지·표 그림 렌더 34쌍, FRQ 입력 10쌍, 정답·해설 비노출·잘림·원문 수식 없음 전부 pass). 종료 후 시드 정리·dev 서버 종료·`isolated-stack.sh stop`·`config.toml` 원복·컨테이너 0 확인, 임시 `.venv-ap`(HiGHS)는 워크트리 안이며 제거 대상.
- `render-check.ts` 재생성(WH 행 추가, 실패 0).
- **루브릭 보정**(`scripts/essay-calibration.ts` CALIB_SUBJECT=wh, 실제 채점 경로 processEssay, 샘플 30건 leave-one-out): MAE **0.167**, 평균 부호 오차 −0.167, 10개 팩 모두 high > mid > low 서열 정상, 호출 62건 $1.85(`data/ap/essay-calibration-result-wh.json`). 일부 DBQ 호출이 `bad_rationale_context`(context 행 설명 누락)로 재시도 대상이 된 진단이 있다(기존 USH 경로와 같은 검증기).

## 6. 한계·UNVERIFIED
- 사실 정확성은 LLM 검사(Opus 풀이·Sonnet 풀이·Fable 패널·채점기·Fable 사실 점검 + 코드 게이트)로 보증한 것이며 **역사 교사 검수가 아니다**. 출시 전 교사 표본 검수 필수(특히 FRQ 기대 답안·샘플 답안·세트 맥락 한 줄·이미지 설명).
- 지역 균형: 서유럽·미국 중심이 되지 않도록 자료를 골랐으나(동아시아·남아시아·서아프리카·중동·대서양·러시아·라틴아메리카 포함) **라틴아메리카·동남아시아·사하라 이남 아프리카 20세기**와 **정량 자료**는 공개·재사용 가능한 텍스트 자료가 적어 얇다. 정량은 Census 세계 인구 요약 2종뿐이고(국제 통계 API 는 키 필요), U9 세계화 주제는 2차 자료(Country Study)·통계 위주다.
- 이미지는 문서 본문 **아래**에 나온다(앱 안 확대 뷰어 없음, 새 탭 링크). Document 5 Doré·Sykes-Picot 지도의 작은 글자는 390px 에서 읽기 어렵다.
- 일부 사료는 시대의 편견·논쟁적 주장을 담고 있다(Kipling·Twain·Malleson·Morgenthau 등). 문항은 관점 분석 중심이며 맥락 한 줄이 화자·목적을 밝힌다. Qianlong 칙서는 Backhouse 번역이며 그의 다른 저술에는 위조가 있었다는 점을 출처 노트에 적었다.
- 화면 증거의 데모 연습 세트 헤더에 "Calculator allowed" 가 보이는 것은 데모 세트의 레이아웃 표기이며 실제 풀 시험 레이아웃(`ap_world_history` calculator "na")과 무관하다(UNVERIFIED: 풀 세트 공개 시 화면 확인 필요).
- DB 적재·공개는 하지 않았다. 관리자 순서: 배치 `wh-p1`·`wh-m1`·`wh-m2`·`wh-f1`·`wh-f2`·`wh-f3`·`wh-f4` 적재(건너뜀 허용 끔) → 초안 `WH1`·`WH2`(배정 보고서) 저장 → 검토 후 공개. 커리큘럼 시드 SQL: `data/ap/seed-sql/ap_world_history.{sql,verify.sql,rollback.sql}`(`npx supabase db query --linked -f …` 는 오너/총괄이 승인 후).
