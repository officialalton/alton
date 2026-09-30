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

## 3. 조합 B·C, 기존 채택 14건 재검수 — **대기 중(Opus·Fable 배치 큐 지연)**
Sonnet 배치는 약 10분에 끝났지만 Opus·Fable 배치는 제출 후 2~3시간이 지나도 처리 건수 0이다(만료 24시간). 예산 보호를 위해 동기 API(2배 단가) 전환은 하지 않았다. 제출된 배치와 자동 수집 프로세스는 계속 돈다.
- B(생성 Opus 5.5 / 검수 Fable 5.1, 후보 39): 생성 배치 `msgbatch_018CvPDM8vkYJ8Nz35rndsCg`, 추정 $1.56
- C(생성 Fable 5.1 / 검수 Opus 5.5, 후보 39): 생성 배치 `msgbatch_0199CmEcZqoDMmmRB8JYvYSN`, 추정 $1.69
- 기존 레시피 채택 RW 14건 Opus 5.5 재검수: 배치 `msgbatch_01GXG5r6q5Y978YxgvUBw5bS`, 추정 $0.15
- 완료되면 수집·검수 제출까지 이어 실행된다. 프로세스가 끊겼으면 같은 명령으로 재개: `batch-pipeline.ts run --combo B --method recipe --per-rw 6`, `... --combo C ...`, `batch-pipeline.ts rereview --review-model claude-opus-5-5`; 집계는 `batch-pipeline.ts report --combo B --method recipe`(결과는 `batch/<조합>-recipe/report.json`).
- 예산: 누적 지출 $1.91 (상한 $8), B·C 추정 완료 시 약 $5.2.

## 4. 중간 권장
- Sonnet 5.5 + 레시피(+ 결정론 재계산)만으로도 RW 37.5%·Math 26.7%(25% 기준 충족), 채택 1건당 약 $0.04~0.06. 상위 모델이 이를 얼마나 높이는지는 B·C 결과 후 판단.
- hard 적합 판정의 관대함 여부는 다른 모델 검수(B·C, 재검수 14건) 결과로만 확인 가능하다.
