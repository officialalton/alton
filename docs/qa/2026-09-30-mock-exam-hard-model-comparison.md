# 2026-09-30 hard 생성 모델 상향 비교 (Message Batches) — 중간 결과

## 1. 구성
- **모델 설정 분리**: `lib/problem-generation/models.ts`(`GENERATION_MODEL`·`REVIEW_MODEL`·`WEAK_MODEL`, 미지정이면 기존 `claude-sonnet-5` — 기본 동작 불변). 생성 호출(`core.ts` 줄 296·547·660·746·823·908·977, `math-staged.ts` 줄 51·92·132)과 독립 채점(`review.ts` 줄 89), `scripts/mock-exam-generation/*`가 모두 이 함수를 거친다. Claude Code 작업 세션 모델과 생성 API 모델은 별개다.
- **배치 파이프라인**(새 파일, 기존 동기 경로는 소량 시험용으로 유지): `batch-lib.ts`(제출·폴링·결과 수집·재개·만료/오류 재시도·토큰×배치 단가 비용 집계·예산 장부 `batch/ledger.json`), `batch-pipeline.ts`(`run`: 1단계 후보 전체 생성 배치 -> 결정론 필터(품질 계약·원시 LaTeX·Math `verification_js` 재계산) -> 2단계 검수 배치(블라인드 풀이 + 정답 공개 감사·레시피 준수·hard 적합 통합) ; `report`; `rereview`). 재실행하면 끝난 `custom_id`는 건너뛰고 진행 중 배치는 이어서 폴링한다.
- 공유 시스템 프롬프트(skill 규칙+레시피)는 1시간 캐시(`cache_control ttl 1h`).
- **발견한 API 제약(신모델 3종 공통)**: `tool_choice` 강제(`tool`/`any`) 불가 -> `auto` + 프롬프트로 도구 호출 지시. 사고(thinking)를 끌 수 없고 사고 토큰이 `max_tokens`를 같이 소비한다 — 첫 시도에서 55건 중 41건이 잘려 전량 폐기(비용 $0.74 손실, 장부 기록). 해결: Sonnet 5.5 는 `thinking: between_tools`, Opus/Fable 은 `adaptive` + `output_config.effort=low`, `max_tokens` 4500~5000. 세 조합에 같은 원칙 적용(사고를 길게 허용하면 Fable 출력 단가 때문에 예산 초과).
- 비용은 사용 토큰 x 총괄 제공 배치 단가(Fable $5/$25, Opus $2/$10, Sonnet 5.5 $1/$5). 1시간 캐시 쓰기 2배·읽기 0.1배 가정.

## 2. 조합 A(생성 Sonnet 5.5 / 검수 Sonnet 5.5) 결과 — 완료
표본: RW 4 skill x 10 + Math 3 skill x 5 = 후보 55. 분모 = 생성 요청 전체(=최초 후보).

| 구분 | 후보 | 결정론 통과 | 정답·해설 통과 | 레시피 준수 | hard 적합 | 채택 | 수율 | 호출 | 비용(USD) | 채택 1건당 비용 |
|---|---|---|---|---|---|---|---|---|---|---|
| RW | 40 | 33 | 29 | 27 | 16 | 15 | 37.5% | 106 | 0.585 | 0.039 |
| Math | 15 | 12 | 12 | 10 | 4 | 4 | 26.7% | 39 | 0.234 | 0.058 |

skill별(탈락 원인):
- transitions 10 -> 채택 4: hard 적합 실패 6, 레시피 미준수 3, 블라인드 불일치 1
- boundaries 10 -> 2: hard 적합 실패 5, 계약(option_echo) 2, 해설 불일치 1, 검수 응답 없음 1
- command_of_evidence_text 10 -> 4: 계약(evidence) 3, hard 적합 2, 블라인드 불일치 1, 해설 불일치 1, 레시피 미준수 1
- text_structure_purpose 10 -> 5: hard 적합 3, 계약(evidence) 2, 레시피 미준수 1
- linear_equations_one_var 5 -> 0: **생성 형식(LaTeX 미닫힘·$ 짝 불일치) 5건**, 레시피 미준수 2, hard 적합 2
- linear_equations_two_var 5 -> 2: hard 적합 3
- equivalent_expressions 5 -> 2: hard 적합 3

**Math 원인 분해(이전 Sonnet 5 기준 '정답 검수 통과 13/28'과 대비)**: 결정론 통과 12건 전부에서 `verification_js` 재계산이 정답 선택지 값과 일치하고 오답 값과 겹치지 않았다(9건은 숫자 선택지로 검증, 3건은 비숫자라 검증 생략). 정답 불일치 0, 해설 모순 0. 즉 이번 Math 탈락은 **산술 오류가 아니라** (1) 생성 형식(LaTeX 미닫힘 등 4건, 프롬프트·형식 지시 문제), (2) hard 적합 판정(12건 중 8건 '전형적 medium')이다. 이전 '모델의 산술 한계' 결론은 Sonnet 5 에 한정된 것이고 Sonnet 5.5 에서는 재현되지 않았다. 단 (2)는 **같은 모델이 검수**한 결과라 관대함/엄격함을 이 조합만으로 판단할 수 없다(B·C의 다른 모델 검수와 비교 필요).

### 원형 vs 레시피 — 동일 조건 비교(모델 Sonnet 5.5, 같은 검수, RW 4 skill x 6, 호출 예산 요청당 동일)
| 방식 | 후보 | 채택 | 수율 | 비용/채택 |
|---|---|---|---|---|
| 새 레시피 | 24 | 11 | 46% | 약 $0.04 |
| 기존 원형(`archetypes.json`, 보존) | 24 | 8 | 33% | $0.045 |
skill별(레시피 대 원형, 각 6개): transitions 4 대 0, boundaries 1 대 0, command_of_evidence_text 2 대 6, text_structure_purpose 4 대 2. 원형은 레시피 체크리스트가 없어 준수 검사가 자동 통과이므로 '채택' 엄격도는 레시피 쪽이 더 높다. 표본이 작고 skill 편차가 커서(COE text 는 원형이 우세) 종합 우열 결론은 유보.

## 3. 조합 B·C·재검수 — 큐 지연으로 **축소 표본 + 동기 전환**으로 완료
Opus·Fable 배치는 2~3시간 뒤에도 0건이라 총괄 결정으로 대기를 중단했다. 처리된 배치(B 생성 39건 전량, B 검수 68요청 중 57건, 재검수 28요청 중 23건)는 수집·과금 반영하고, 남은 단계(C 생성·검수, B 검수 잔여 6건, 재검수 잔여 4건)는 동기 API(배치 2배 단가)로 실행했다. 취소한 배치 중 C 생성(39건)은 처리 0건이라 과금 없음. **표본 축소 명시**: 조합 간 비교는 같은 후보 id의 부분집합(RW 4 skill x 3 = 12건, Math 3 skill x 3 = 9건, 총 21건)으로 A·B·C를 동일 지표로 재집계했다(`batch-pipeline.ts compare`, 출력 `batch/compare.json`).

### 조합 비교(동일 후보 부분집합 RW 12 + Math 9)
| 조합(생성/검수) | 체계 | 후보 | 결정론 통과 | 검수됨 | 정답·해설 통과 | 레시피 준수 | hard 적합(검수된 것 중) | 채택 | 수율 | 비용 | 채택 1건당 | Math 재계산 통과/실패/생략 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A(Sonnet5.5/Sonnet5.5) | RW | 12 | 9 | 8 | 7 | 7 | 6 (75%) | 6 | 50% | $0.17 | $0.028 | - |
| A(Sonnet5.5/Sonnet5.5) | Math | 9 | 7 | 7 | 7 | 6 | 2 (28%) | 2 | 22% | $0.15 | $0.073 | 7/0/2 |
| B(Opus5.5/Fable5.1) | RW | 12 | 11 | 11 | 10 | 11 | 11 (100%) | 10 | 83% | $0.87 | $0.087 | - |
| B(Opus5.5/Fable5.1) | Math | 9 | 7 | 7 | 7 | 6 | 5 (71%) | 5 | 56% | $0.49 | $0.098 | 9/0/0 |
| C(Fable5.1/Opus5.5) | RW | 12 | 11 | 11 | 11 | 10 | 10 (91%) | 10 | 83% | $1.49 | $0.149 | - |
| C(Fable5.1/Opus5.5) | Math | 9 | 7 | 7 | 7 | 7 | 1 (14%) | 1 | 11% | $0.80 | $0.795 | 7/0/2 |
| A-원형(Sonnet5.5) | RW | 12 | 12 | 12 | 10 | 12 | 4 (33%) | 4 | 33% | $0.19 | $0.047 | - |

- **주의 1(표본)**: 칸당 후보 2~3건이라 통계적 결론이 아니라 방향 확인 수준이다.
- **주의 2(검수 모델이 조합마다 다름)**: hard 적합 판정은 검수 모델에 크게 좌우된다. C는 Opus 가 Fable 생성 Math 7건 중 1건만 hard 로 인정(14%), B 는 Fable 이 Opus 생성 Math 7건 중 5건 인정(71%), A 는 Sonnet 이 Sonnet 생성 Math 7건 중 2건(29%). 생성 모델 우열과 검수 엄격도가 섞여 있다(같은 문항을 두 검수 모델이 채점한 자료는 재검수 14건뿐).
- **주의 3(비용 혼합)**: B 생성·검수 대부분은 배치 단가, C 와 B 검수 잔여 일부는 동기(2배) 단가. 비용은 같은 단가 기준이 아니다.
- **Math 원인 분해(세 모델 공통)**: 결정론 통과 Math 전부에서 `verification_js` 재계산이 정답과 일치(검증 불가 생략 제외 실패 0건) — 정답 오류·해설 모순은 세 모델 모두 0건. 생성 단계 탈락은 세 조합 모두 4~5/9건이 LaTeX/수식 형식(`math_parse`·`math_unclosed`·`$` 짝 불일치, 한글을 수식 안에 넣는 경우 포함)이다 — **모델 산술 한계가 아니라 수식 표기 지시·검사의 문제**로 분해된다. 이 형식 탈락은 프롬프트 수정(수식 안 한글 금지·`$` 닫기)으로 줄일 수 있는지 별도 시험이 필요하다. 남는 탈락은 hard 적합·레시피 미준수(검수 모델 의존).
- **hard 적합 관대함**: 기존 레시피 채택 RW 14건(Sonnet 5 생성·Sonnet 5 계열 검수에서 전부 hard 적합)을 Opus 5.5 로 재검수한 결과 정답 정확성 통과 11/14, 레시피 준수 11/14, **hard 적합 4/14(29%)**, 보류(정답 또는 hard 불일치) 10건. 즉 같은 계열 모델 검수는 hard 적합에 **관대**했고 다른 상위 모델 검수에서는 크게 엄격해진다(`batch/rereview-claude-opus-5-5/rereview.json`, 문항별로 추가 요구 사고 기록). 모델 간 일치만으로 hard 를 확정하지 않으며, 불일치 문항은 보류 처리.

### 원형 대 레시피(동일 조건, Sonnet 5.5, RW 12건 부분집합)
레시피 채택 6/12(50%) 대 원형 4/12(33%), 채택 1건당 $0.028 대 $0.047. 원형은 hard 적합 실패가 8/12(검수 67%)로 가장 큰 탈락 원인이고 레시피는 준수 체크리스트가 추가 엄격도를 만든다. 표본이 작아 우열 확정은 유보, `archetypes.json`은 보존.

## 4. 앱 동기 경로 기본 모델 전환(Sonnet 5.5)
- `DEFAULT_GENERATION_MODEL`/`DEFAULT_REVIEW_MODEL` = `claude-sonnet-5-5`(WEAK 기본 haiku 그대로, 환경변수 덮어쓰기 유지).
- 신모델은 `tool_choice` 강제(`tool`/`any`) 미지원·사고 필수·사고 토큰이 `max_tokens` 공유이므로 `lib/problem-generation/models.ts`의 `createToolMessage`가 한 곳에서 모델별 옵션을 정한다: 신모델(sonnet-5-5·opus-5·fable)은 `tool_choice: auto` + `thinking`(Sonnet 5.5 `between_tools`, Opus/Fable `adaptive`) + `effort: low` + `max_tokens` +3000, 구모델은 params 를 그대로 둔다. 기대한 `tool_use` 가 없으면 1회 재시도 후 명확한 오류(조용한 실패 없음).
- 11개 호출부(core.ts 7, math-staged.ts 3, review.ts 1) 전부 이 헬퍼 경유. 단위 테스트 `lib/problem-generation/models.test.ts`(옵션 분기·누락 처리·기본값) + 기존 `lib/problem-generation`·`app/admin`·스크립트 테스트 1,338개 통과(회귀 없음).
- 실제 스모크(동기 경로, 생성 1 + 자동 검수): `runGenerationPipeline` words_in_context medium 1건 — 채택 1, 모델 호출 3회, 23초, 독립 검수 일치. 추정 비용 약 US$0.05(사용량 미집계, 호출 3회 x 동기 단가 추정).

## 5. 비용 장부
누적 **$7.68**(`batch/ledger.json`) + 스모크 추정 $0.05 = 약 $7.73(상한 8 이내). 내역: 조합 A 0.82, 원형 비교 0.36, 첫 시도 폐기 0.74, B 생성(배치) 0.67, B 검수(배치 57건 1.49 + 동기 0.23), C 생성+검수(동기) 약 2.0+0.55, 재검수(배치 0.19+0.01 + 동기 0.11).


## 6. 교차 채점 소량 표본(2026-09-30, 새 예산 구간 $6 — 앞선 $8 실험과 합산하지 않음)
**설계**: 생성 Opus 5.5 고정(동기), 같은 후보를 검수 모델 2개(Fable 5.1·Opus 5.5)가 독립 채점(후보당 블라인드 풀이 + 정답 공개 감사). 레시피·자료 유형(텍스트)·검수 기준은 앞선 실험과 동일. 후보 36건 = RW 4 skill x 6 + Math 3 skill x 4(지시의 "x6"은 Math까지 합하면 42건이라 예산 상한 때문에 Math를 4로 줄여 36건으로 맞췄다). 구간 누적 지출 **$5.72**(`batch2/ledger.json`, 상한 $6, 실행 전 추정 $5.36 출력, 모두 동기 단가).

### 두 검수 모델 일치율(두 모델 모두 채점한 후보 기준)
| 체계 | 정답 정확성 일치 | 레시피 준수 일치 | hard 적합성 일치 | 둘 다 채택 | 한 모델만 통과(보류) | 수율(둘 다 통과/후보) | 총비용 | 채택 1건당 |
|---|---|---|---|---|---|---|---|---|
| RW | 18/21 (Fable 통과 19, Opus 통과 20) | 20/21 (Fable 통과 20, Opus 통과 19) | 16/21 (Fable 통과 20, Opus 통과 15) | 13 | 5 (Fable만 4, Opus만 1) | 54% (13/24) | $3.84 | $0.295 |
| Math | 11/12 (Fable 통과 12, Opus 통과 11) | 12/12 (Fable 통과 11, Opus 통과 11) | 3/12 (Fable 통과 10, Opus 통과 1) | 1 | 9 (Fable만 9, Opus만 0) | 8% (1/12) | $1.88 | $1.879 |
| 합계 | | | | 14 | 14 | 39% | $5.72 | $0.409 |

**검수 모델 엄격도 차이**: 정답 정확성·레시피 준수는 두 모델이 거의 같다(일치 29/33, 32/33). **hard 적합성만 크게 갈린다**: RW는 Fable 20/21 통과 대 Opus 15/21, Math는 **Fable 10/12 통과 대 Opus 1/12**. Fable 이 관대하고 Opus 가 엄격하다(불일치 사례에서 Opus가 '전형적 medium 구조·오답이 전형적이어서 쉽게 걸러짐'으로 탈락시킨 것이 대부분, 반대 방향은 RW 1건). 불일치 14건(Fable만 통과 13, Opus만 통과 1)은 **보류**하고 채택에 넣지 않았다. 모델 간 일치만으로 hard 를 확정하지 않았고, 문항별 '같은 skill medium 대비 추가 요구 사고'는 각 모델의 `which`·`note` 로 `batch2/D-cross/cross.json` 의 items[].fable/opus 에 기록했다.

**정답 정확성 불일치 사례(4건)**: transitions-03(Opus: 해설이 '방향은 맞아도 관계가 틀렸다'며 스스로 모순, Fable 통과), boundaries-04(Fable: 오답 A가 표준 영어에 부합해 복수정답 의심, Opus 통과), text_structure_purpose-05(Fable: 문두는 '밑줄 친 문장'인데 실제 밑줄은 절 일부 — 형식 불일치, Opus 통과), linear_equations_two_var-02(Opus: 정답은 맞지만 선택지 순서가 오름차순이 아니라 형식 결함으로 탈락 — 형식 관례 판단이 갈린 사례). 한 모델의 지적이 실제 결함인 경우(transitions-03 모순, text_structure_purpose-05 형식)가 있어 **둘 다 통과 조건이 타당**하다.

**hard 적합성 불일치 사례(RW 5건)**: transitions-03·boundaries-01/02/04·text_structure_purpose-02 전부 Fable 통과/Opus 불합. Opus 사유는 공통으로 '정답은 옳으나 오답 장치(콤마 스플라이스·접속사 뒤 세미콜론·so/but 구분)가 전형적 medium 수준'.

**Math 원인 분해(이번 표본)**: 결정론 재계산 11 통과 + 1 생략, 정답·해설 오류 사실상 0(Fable 12/12, Opus 11/12 통과 — Opus 1건은 선택지 정렬 관례 지적). 탈락은 거의 전부 hard 적합성(Opus 기준 11/12 '전형적 medium 2단계 문장제'). 즉 Math 에서 상위 모델이 만드는 문항은 정확하지만 **Opus 기준으로는 hard 가 아니다**.

### Math 수식 표기 프롬프트 개선 전후(같은 skill, 생성 지시 단순화만, 사고 수준·채택 기준 유지)
개선(v2): 수식은 `$…$` 로 열고 반드시 닫기, 수식 안에 한글 금지(한글 설명은 수식 밖), 금액은 `$` 대신 단어, 분수·곱은 LaTeX 명령, 수식 안 줄바꿈 금지.
| 구분 | 수식 형식 탈락(math_parse·math_unclosed·$ 짝 불일치 등) |
|---|---|
| 개선 전(v1; 조합 A/B/C 생성분 Math 합계) | 7/33 = 21% (전부 linear_equations_one_var: A 3/5, B 2/3, C 2/3 → 7/11 = 64%) |
| 개선 후(v2; Opus 생성 Math 12건) | **0/12 = 0%** (linear_equations_one_var 0/4), 재계산 11 통과 |
형식 탈락은 해소됐고, 사고 수준은 같은 레시피라 변하지 않았다(hard 적합 통과율은 v2 에서 검수 모델별로 위와 같음).

## 7. hard 생성·검수 모델 지정 경로(매뉴얼)
- **기본(일반 문항 easy/medium)**: 생성·검수 모두 `claude-sonnet-5-5`(코드 기본값, `lib/problem-generation/models.ts`). 환경변수 미설정이 이 경로다.
- **hard 생성·검수**: 환경변수/옵션으로 상위 모델을 지정한다.
  - 앱 동기 경로(`runGenerationPipeline` 등): 실행 환경에 `GENERATION_MODEL=claude-opus-5-5`(hard 생성), `REVIEW_MODEL=claude-opus-5-5`(독립 채점). 헬퍼가 신모델 옵션(tool_choice auto·thinking·effort low)을 자동 적용한다.
  - 배치/교차 스크립트: `batch-pipeline.ts cross --gen-model claude-opus-5-5 [--budget N]`(검수는 Fable 5.1·Opus 5.5 교차), 단일 조합은 `run --combo B|C ...`의 `--gen-model/--review-model`, 동기 폴백은 `--sync`.
- **권장(측정 기반)**: hard 생성 Opus 5.5 + hard 적합 검수 Opus 5.5(엄격). Fable 5.1 검수는 후보당 비용이 Opus 의 약 3배(후보당 $0.10 대 $0.03)이면서 hard 적합에 관대했다. 더 보수적으로 가려면 Opus·Fable 둘 다 통과한 문항만 채택하고 나머지는 보류(이번 표본에서 채택 39%, 총 $0.41/건).
