# 2026-10-01 모의고사 30세트 로드맵 (필요량·생성 설계·웨이브 계획·조립 설계)

**원칙(오너 확정)**: 30세트 이상, **문항 재사용 없음**, 파일럿 없음(출시 후 수업 데이터로 난이도 보정), 전체 1주일 안에 완료. 이 문서는 설계·계획이며 **대량 API 생성은 웨이브 승인 전 금지**(합격 검증 스모크만 실행: `docs/qa/2026-10-01-generation-acceptance.md`). Math 결정론 컴파일러는 별도 세션이 만들며 `lib/problem-generation/math-compilers` 는 수정하지 않았다(읽기 전용 참조). 계산은 `scripts/mock-exam-generation/thirty-need.ts`(순수 계산, 결과 `data/mock-exam-generation/mockgen-20260929/final/thirty-need.json`).

## 1. 30세트 필요량 정밀 계산
### 1.1 세트 구조와 기준
- 세트 1개 = RW 81(M1 27 + M2 lower 27 + M2 higher 27) + Math 66(22 x 3), 세트 안 중복 0, 세트 간 재사용 없음 → **RW 2,430 + Math 1,980 문항**.
- 모듈 난이도: M1·lower = easy·medium, higher = medium·hard(`difficultyAllowedForModule`). 영역 비중(표준 tier): RW 26/28/20/26, Math 35/35/15/15. 난이도 비중 25/50/25 를 모듈 허용 난이도로 재정규화(`assembleSection`의 `buildTargetCells` 그대로 재현).
- **세트당 난이도 구성(조립기 재현)**: RW easy 18·medium 54·hard 9, Math easy 16·medium 42·hard 8(Math 는 mc75/spr25 형식 분할 반올림으로 easy 16). Math 형식: mc 75%·spr 25%(문항 형식 제약은 §1.4).
### 1.2 skill 단위 배분과 hard 바닥값(오너 정정 반영)
- skill 총량 = 섹션 총량 x 영역 비중 x 영역 안 skill 비중(SAT 블루프린트 근사: `plan.ts` 의 `DOMAINS` — RW 정보와 아이디어 30/25/25/20, 구조 45/35/20, 표현 50/50, 표준영어 50/50; Math 대수 균등 5개·고급 균등 3개·PSD 균등 7개·기하 26/26/26/22). 조립기는 '덜 쓴 skill 우선'이라 실제 배분은 영역 안에서 균등에 가깝다 — 블루프린트 비중과의 차이는 수정안 §5 에 기록.
- **hard 는 '기존 풀 난이도 비율 비례'를 쓰지 않는다**(그 방식은 PSD 일부 skill 의 hard 를 0 으로 만든 계획 부산물이라 폐기). 모든 skill(RW 11·Math 19)에 hard 수요가 있다는 전제로: ① 섹션 hard 총량 = 세트당 hard(RW 9·Math 8) x 30 (RW 270·Math 240) ② **바닥값**: skill 당 최소 `ceil(30/3) = 10` (세트 3개당 각 skill hard ≥ 1 — M2 higher 경로 27개 중 hard 9개가 11개 skill 을 돌려 쓰는 구조, Math 는 22개 중 8개가 19개 skill 이므로 3세트(24개)에서 19개 skill 각 1개가 가능) ③ 남은 hard 는 skill 총량 비중으로 배분. 표의 `hard(바닥값)` 이 채택 수요, `기존방식 hard` 는 영역 경유(영역 hard x skill 비중) 비교값이다. 차이: 영역 경유는 작은 영역(PSD·기하)의 skill 에 세트당 1개 미만만 배정돼 '3세트당 skill hard ≥ 1'을 어긴다 — 바닥값이 이를 보장하지만 **도메인별 hard 비중이 영역 비중과 달라져 조립기의 영역 x 난이도 독립 가정과 충돌**(§5 코드 변경 1).
- 비-hard 의 easy:medium 은 섹션 전체 비율(RW 540:1620, Math 480:1260)로 skill 별 배분(각 skill 의 total − hard).
### 1.3 공급 차감(부족분)
공급 = 원격 실측(`inputs/remote-supply.json`: easy/medium/hard, **원격에 easy 가 전혀 없음 — 모든 skill 의 easy 는 신규 생성 대상**) + 로컬 통과 문항(`final/passed.json` 959건 중 easy·medium, 구 기준 hard 라벨은 medium 으로 취급) + 임포트 전 채택 hard 59건(잠정). hard 는 원격(`inputs/remote-hard-ai-split.json`의 AI 생성분은 '잠정')·로컬 채택분을 모두 더하되 열을 나눠 표기한다.
#### RW
| 영역 | skill | 세트당 | 30세트 총량 | easy | medium | hard(바닥값) | 기존방식 hard | 공급 easy | 공급 medium | 공급 hard(원격 비AI / 원격 AI 잠정 / 로컬 채택 잠정) | **부족 easy** | **부족 medium** | **부족 hard** | 합계 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| rw_information_ideas | central_ideas_details | 6.33 | 190 | 42 | 125 | 23 | 18 | 13 | 45 | 0 / 1 / 4 | 29 | 80 | 18 | 127 |
| rw_information_ideas | inferences | 5.27 | 158 | 35 | 103 | 20 | 15 | 10 | 29 | 0 / 4 / 1 | 25 | 74 | 15 | 114 |
| rw_information_ideas | command_of_evidence_text | 5.27 | 158 | 35 | 103 | 20 | 15 | 11 | 29 | 0 / 6 / 5 | 24 | 74 | 9 | 107 |
| rw_information_ideas | command_of_evidence_quant | 4.2 | 126 | 27 | 81 | 18 | 12 | 13 | 20 | 0 / 4 / 0 | 14 | 61 | 14 | 89 |
| rw_craft_structure | words_in_context | 10.2 | 306 | 69 | 207 | 30 | 41 | 49 | 41 | 0 / 1 / 5 | 20 | 166 | 24 | 210 |
| rw_craft_structure | text_structure_purpose | 7.93 | 238 | 53 | 159 | 26 | 32 | 19 | 37 | 0 / 6 / 5 | 34 | 122 | 15 | 171 |
| rw_craft_structure | cross_text_connections | 4.53 | 136 | 29 | 88 | 19 | 18 | 11 | 30 | 0 / 7 / 6 | 18 | 58 | 6 | 82 |
| rw_expression_ideas | rhetorical_synthesis | 8.1 | 243 | 54 | 163 | 26 | 30 | 19 | 63 | 0 / 4 / 4 | 35 | 100 | 18 | 153 |
| rw_expression_ideas | transitions | 8.1 | 243 | 54 | 163 | 26 | 30 | 14 | 57 | 0 / 3 / 4 | 40 | 106 | 19 | 165 |
| rw_standard_english | boundaries | 10.53 | 316 | 71 | 214 | 31 | 30 | 20 | 44 | 0 / 4 / 6 | 51 | 170 | 21 | 242 |
| rw_standard_english | form_structure_sense | 10.53 | 316 | 71 | 214 | 31 | 30 | 17 | 34 | 0 / 7 / 4 | 54 | 180 | 20 | 254 |
| **합계** | | | 2430 | 540 | 1620 | 270 | 271 | | | | 344 | 1191 | 179 | 1714 |
#### Math
| 영역 | skill | 세트당 | 30세트 총량 | easy | medium | hard(바닥값) | 기존방식 hard | 공급 easy | 공급 medium | 공급 hard(원격 비AI / 원격 AI 잠정 / 로컬 채택 잠정) | **부족 easy** | **부족 medium** | **부족 hard** | 합계 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| algebra | linear_equations_one_var | 4.63 | 139 | 34 | 91 | 14 | 18 | 5 | 27 | 4 / 2 / 3 | 29 | 64 | 5 | 98 |
| algebra | linear_functions | 4.63 | 139 | 34 | 91 | 14 | 18 | 8 | 20 | 10 / 2 / 0 | 26 | 71 | 2 | 99 |
| algebra | linear_equations_two_var | 4.63 | 139 | 35 | 91 | 13 | 18 | 13 | 29 | 0 / 3 / 3 | 22 | 62 | 7 | 91 |
| algebra | systems_linear | 4.6 | 138 | 34 | 91 | 13 | 18 | 11 | 39 | 0 / 2 / 4 | 23 | 52 | 7 | 82 |
| algebra | linear_inequalities | 4.6 | 138 | 34 | 91 | 13 | 18 | 5 | 18 | 4 / 2 / 0 | 29 | 73 | 7 | 109 |
| advanced_math | equivalent_expressions | 7.7 | 231 | 59 | 156 | 16 | 30 | 8 | 35 | 4 / 4 / 4 | 51 | 121 | 4 | 176 |
| advanced_math | nonlinear_equations_systems | 7.7 | 231 | 59 | 156 | 16 | 30 | 19 | 26 | 0 / 6 / 1 | 40 | 130 | 9 | 179 |
| advanced_math | nonlinear_functions | 7.7 | 231 | 59 | 156 | 16 | 30 | 8 | 48 | 8 / 2 / 0 | 51 | 108 | 6 | 165 |
| problem_solving_data | ratios_rates_units | 1.43 | 43 | 9 | 23 | 11 | 4 | 6 | 15 | 0 / 5 / 0 | 3 | 8 | 6 | 17 |
| problem_solving_data | percentages | 1.43 | 43 | 9 | 23 | 11 | 4 | 5 | 17 | 1 / 3 / 0 | 4 | 6 | 7 | 17 |
| problem_solving_data | one_variable_data | 1.43 | 43 | 9 | 23 | 11 | 4 | 3 | 10 | 4 / 0 / 0 | 6 | 13 | 7 | 26 |
| problem_solving_data | two_variable_data | 1.4 | 42 | 9 | 22 | 11 | 4 | 3 | 7 | 4 / 0 / 0 | 6 | 15 | 7 | 28 |
| problem_solving_data | probability | 1.4 | 42 | 9 | 22 | 11 | 4 | 5 | 8 | 3 / 0 / 0 | 4 | 14 | 8 | 26 |
| problem_solving_data | inference_margin_error | 1.4 | 42 | 9 | 22 | 11 | 4 | 5 | 8 | 2 / 0 / 0 | 4 | 14 | 9 | 27 |
| problem_solving_data | evaluating_statistical_claims | 1.4 | 42 | 9 | 22 | 11 | 4 | 3 | 9 | 1 / 0 / 0 | 6 | 13 | 10 | 29 |
| geometry_trig | area_volume | 2.57 | 77 | 18 | 47 | 12 | 8 | 8 | 22 | 14 / 0 / 0 | 10 | 25 | 0 | 35 |
| geometry_trig | lines_angles_triangles | 2.57 | 77 | 18 | 47 | 12 | 8 | 9 | 21 | 0 / 2 / 0 | 9 | 26 | 10 | 45 |
| geometry_trig | right_triangles_trigonometry | 2.57 | 77 | 18 | 47 | 12 | 8 | 9 | 19 | 1 / 3 / 0 | 9 | 28 | 8 | 45 |
| geometry_trig | circles | 2.2 | 66 | 15 | 39 | 12 | 7 | 6 | 14 | 9 / 1 / 0 | 9 | 25 | 2 | 36 |
| **합계** | | | 1980 | 480 | 1260 | 240 | 239 | | | | 341 | 868 | 121 | 1330 |
### 1.4 Math — 컴파일러 몫과 AI 몫
- 컴파일러 문항은 유사문항 그룹이 `(skill, 세부 패턴)` 이라 **한 세트에 같은 그룹은 1문항** → 세트당 skill 별 컴파일러 문항 수 ≤ 세부 패턴 수(`kind-catalog.ts`). 30세트 '재사용 없음'에서 컴파일러가 채울 수 있는 상한 = 30 x 패턴 수(각 세트가 패턴마다 새 변형을 하나씩). 패턴 수보다 세트당 필요량이 큰 skill(linear_equations_one_var 세트당 4.6 > 3 등)은 초과분을 AI 가 채운다.
- **컴파일러가 없는 skill**: systems_linear·inference_margin_error·evaluating_statistical_claims — 전량 AI(레시피 있음: systems_linear 만, 나머지 2개와 probability 는 hard 레시피 없음).
| skill | 부족 합계 | 컴파일러 세부 패턴 수 | 컴파일러 상한(30세트 x 패턴 수) | 컴파일러 몫(최대) | **AI 몫(최소)** | 부족 hard | 비고 |
|---|---|---|---|---|---|---|---|
| linear_equations_one_var | 98 | 3 | 90 | 90 | 8 | 5 | 컴파일러 용량 초과분 AI |
| linear_functions | 99 | 5 | 150 | 99 | 0 | 2 |  |
| linear_equations_two_var | 91 | 6 | 180 | 91 | 0 | 7 |  |
| systems_linear | 82 | 0 | 0 | 0 | 82 | 7 | 컴파일러 없음 — 전량 AI |
| linear_inequalities | 109 | 3 | 90 | 90 | 19 | 7 | 컴파일러 용량 초과분 AI |
| equivalent_expressions | 176 | 2 | 60 | 60 | 116 | 4 | 컴파일러 용량 초과분 AI |
| nonlinear_equations_systems | 179 | 9 | 270 | 179 | 0 | 9 |  |
| nonlinear_functions | 165 | 6 | 180 | 165 | 0 | 6 |  |
| ratios_rates_units | 17 | 2 | 60 | 17 | 0 | 6 |  |
| percentages | 17 | 5 | 150 | 17 | 0 | 7 |  |
| one_variable_data | 26 | 4 | 120 | 26 | 0 | 7 |  |
| two_variable_data | 28 | 7 | 210 | 28 | 0 | 7 |  |
| probability | 26 | 3 | 90 | 26 | 0 | 8 |  |
| inference_margin_error | 27 | 0 | 0 | 0 | 27 | 9 | 컴파일러 없음 — 전량 AI |
| evaluating_statistical_claims | 29 | 0 | 0 | 0 | 29 | 10 | 컴파일러 없음 — 전량 AI |
| area_volume | 35 | 6 | 180 | 35 | 0 | 0 |  |
| lines_angles_triangles | 45 | 4 | 120 | 45 | 0 | 10 |  |
| right_triangles_trigonometry | 45 | 3 | 90 | 45 | 0 | 8 |  |
| circles | 36 | 7 | 210 | 36 | 0 | 2 |  |
| **합계** | 1330 | | | 1049 | 281 | | |
- hard(Math 121건 부족): 컴파일러가 hard 를 만들 수 있는지는 다른 세션 결정이다. 만들지 못하면 AI(Opus + Fable)가 채워야 하며 그 경우 §4 비용에 약 $30 가 더해진다(부족 hard 121 / 채택률 0.64 x 후보당 $0.16). **hard SPR 문항은 지금 생성 경로에 없다**(§5 코드 변경 3).
### 1.5 레시피(hard)가 없는 skill
RW 는 11개 전부 있음(cross_text_connections 포함). **Math 는 probability·inference_margin_error·evaluating_statistical_claims 3개가 hard 레시피 없음**(커버리지 맵 표본 부족) — 웨이브 1 에서 각 4건 소량 시험 후 인접 skill 구조로 초안 레시피를 만들거나 medium 대체로 두고 보고. `systems_linear`·`cross_text_connections` 레시피는 선행 시험에서 수율 100%(근거 얇음).

## 2. RW 대량 생성 설계
- **easy·medium**: Sonnet 5.5 **Message Batches**(약 10~30분, 50% 단가) 생성 + Sonnet 5.5 검수(블라인드 풀이 + 감사), 이번 스모크 17/20(85%) 채택, 후보당 $0.014. 구현 완료(`batch-pipeline.ts basic`).
- **hard**: Opus 5.5 **동기** 생성 + Fable 5.1 hard 적합 + 정답(Fable·Opus 둘 다) + 레시피 준수, Opus 의견 advisory, 채택분 `difficultyStatus=provisional_ai`(`batch-pipeline.ts cross`).
- **다양성(수천 건)**: 
  1. **주제 씨앗 배분표**: 지문 장르(과학 해설 25·인문/역사 25·문학 서술 20·사회과학 15·인물/조직 사례 15), 소재 풀 120개(자연 20·과학기술 20·사회경제 20·예술문화 20·역사 20·인물/일상 20), 구조(skill별 — transitions 빈칸 위치, boundaries 경계 유형 5종, text_structure 2유형 등). 후보마다 씨앗 튜플(장르·소재·구조·**목표 정답 위치 A~D 균등 순환**)을 **결정적으로 배정**해 생성 지시에 주입. 같은 소재는 전 풀에서 최대 2문항·skill 안 1문항. 이번 합격 검증에서 씨앗 없는 생성은 'marine biologist' 계열 문두가 words_in_context 17/97 등으로 수렴했고 정답 위치도 A 48%(RW)로 쏠려 **씨앗·정답 위치 주입이 필수**임이 확인됐다.
  2. **전역 유사도 인덱스**: 원격 passed(총괄이 본문 해시·3-gram MinHash 만 내보낸 인덱스 파일 제공 — 본문 자체는 불필요)·로컬 통과·진행 중 웨이브 후보의 (skill, MinHash 64) 를 한 파일(`data/mock-exam-generation/index/text-index.jsonl`)에 누적하고, **생성 직후(검수 전)** Jaccard(3-gram, 숫자 마스킹) ≥ 0.6 이면 즉시 폐기(검수 비용 절감). 웨이브 사이에 인덱스 갱신. 문두 n-gram·소재 키워드 빈도 한도(skill 안 3%)도 같은 인덱스에서 검사.
  3. **유사 문항 그룹 다양성**: AI 문항은 본문 해시 그룹이라 구조적으로 고유하지만 '같은 틀(질문·선택지 패턴)' 집중을 막기 위해 (skill, 구조 씨앗) 별 상한을 둔다. 컴파일러 문항은 세부 패턴 그룹이라 세트당 1문항.
  4. **원문 발췌 경로(별도 계획서)**: `docs/qa/2026-10-01-rw-source-corpus-plan.md` — 읽기이해 계열은 원문 발췌 기반으로 전환해 소재 다양성과 지문 품질을 높인다.

## 3. 웨이브 실행기 설계(기존 `batch-pipeline.ts` 확장, 동기 경로 유지)
- **이미 구현됨**: 단계별 배치(생성→결정론 필터→검수→집계), 재개(끝난 `custom_id` 건너뛰기·진행 중 배치 이어 폴링·취소 배치 수집), 동기 폴백(`--sync`), 예산 장부(`ledger.json`)와 제출 전 추정·상한 거부, `basic`(Sonnet 배치 RW easy/medium)·`cross`(Opus 동기 + 검수 2모델)·`cross-report`·`merge-adopted`.
- **추가할 것(웨이브 실행기, 문서 설계)**:
  1. `wave --plan wave-N.json`: 웨이브 계획(skill·난이도·후보 수·방식·씨앗 배정·비용 상한)을 읽어 `data/mock-exam-generation/<run>/wave-N/`(candidates·gen·review·adopted·report·ledger)에 단계별 산출, 같은 명령 재실행 시 끝난 후보·요청 건너뜀.
  2. 웨이브별 비용 상한 + 누적 장부, 단계 체크포인트(후보 절반 처리 후) 채택 수율 25% 미만이면 자동 중단·보고(skill 단위로도 집계해 낮은 skill 만 제외).
  3. 씨앗·목표 정답 위치 배정기와 전역 유사도 인덱스 게이트(생성 직후).
  4. 결과 병합(`merge-adopted` 확장): 웨이브 간 본문 유사도 0.6 차단, 기존 은행 대비 차단.
- **수율이 낮은 skill — 지시 단순화 소량 시험 후보**(각 6건, 사고 수준·채택 기준은 유지): `inferences`(hard 14%, 정답 불일치·hard 적합), `boundaries`(easy/medium 배치 0/2), `form_structure_sense`(배치 1/2, hard 57%), `words_in_context`(hard 45%, hard 적합 6건 탈락), Math hard 레시피 없는 3개 skill(probability·inference_margin_error·evaluating_statistical_claims).

## 4. 웨이브 계획서(후보 수·호출·비용·시간·1주 일정)
**추정 전제**: 채택 수율 — RW easy/medium 0.65(스모크 0.85에 SEC 계열 저수율 반영), RW hard 0.57(표본 67%에 안전계수 0.85), Math AI easy/medium 0.6, Math AI hard 0.64. 비용(측정): Sonnet 배치 후보당 $0.0141(생성 + 검수), Opus 동기 + Fable + Opus 참고 후보당 $0.159. 동시 호출 6~10(Opus 2M ITPM·Fable 500k ITPM 한도 안: 후보당 검수 입력 약 3k 토큰 x 요청 → 분당 160건 이내), 동기 처리량 약 1.1~1.8 후보/분.
| 구분 | 부족 | 후보 수 | 방식 | 호출(생성+검수) | 비용 | 소요(처리 시간) |
|---|---|---|---|---|---|---|
| RW easy+medium | 1,535 | 2,362 | Sonnet 5.5 배치 | 약 7,090 | 약 $33 | 배치 약 1~2일(병렬 제출) |
| RW hard | 179 | 314 | Opus 동기 + Fable + Opus | 약 1,470 | 약 $50 | 동시 10 기준 약 3시간 |
| Math AI easy+medium(컴파일러 제외 281 중) | 약 246 | 약 410 | Sonnet 5.5 배치 | 약 1,230 | 약 $6~8 | 배치 수 시간 |
| Math AI hard | 약 35 | 약 55 | Opus 동기 | 약 260 | 약 $9 | 약 1시간 |
| (선택) Math hard 전체를 AI 로 | 121 | 약 189 | Opus 동기 | 약 890 | 약 $30 | 약 1.7시간 |
| 지시 단순화·레시피 소량 시험 | — | 약 40 | 혼합 | — | 약 $3 | 반나절 |
| **소계** | | **약 3,180(+189)** | | **약 10,050** | **약 $100 (범위 $85~150)** | |
- 재시도·탈락 재생성 20% 여유 포함 **총 약 $120 (범위 $100~175)**. 합격 검증 재실행·코퍼스 파일럿(별도 계획서 $?)은 별도. **충전 필요 금액 = 총액 − 현재 잔액**(총괄이 잔액 확인; 직전 안내 잔액 약 $39 기준이면 약 $80~140 추가).
- **웨이브 구성(안)**: 
  - **웨이브 1(소량, 수정 후 재합격)**: skill 당 소수 — RW 11 skill x(easy 2·medium 2) Sonnet 배치 44 + hard 2 x 11 = 22, Math AI 대상 skill 16 + hard 6 = 약 88건, 약 $5. 목적: 씨앗·정답 위치 주입·유사도 인덱스 게이트 검증과 `acc-static` 재측정(정답 위치 분포·소재 쏠림 해소 확인). 합격 전 웨이브 2 금지.
  - 웨이브 2: RW easy/medium 35%(약 830건, $12) + RW hard 40%(약 125건, $20).
  - 웨이브 3: RW easy/medium 35% + Math AI 전량(약 480건).
  - 웨이브 4: 나머지 RW easy/medium 30%(약 700건) + RW hard 나머지(약 190건, $30) + 재생성.
  - 웨이브 5: 부족 칸 보충(skill x 난이도 칸 단위 재집계 후 재생성).
- **1주 일정(안)**: D1 코드 수정 4건(씨앗·정답 위치·인덱스 게이트·하드 교차 세트 제외)+웨이브 1, D2 웨이브 1 합격 판정 + 웨이브 2, D3 웨이브 3 + Math 컴파일러 산출 합류(별도 세션), D4 웨이브 4, D5 웨이브 5 + 임포트 전 합격 검증(`acc-static`·격리 임포트), D6 30세트 조립·검증·응시 종단, D7 예비·원격 임포트(총괄)·Preview 육안 확인. 배치 지연(Sonnet 약 10~30분, Opus·Fable 큐 지연은 동기로 회피)은 D 단위 버퍼로 흡수.

## 5. 30세트 조립·검증 설계
### 5.1 현재 조립 로직으로 가능한 것(격리 스택 검증 완료)
- 관리자 서버 액션 `assembleMockExamSet`(세션 필요)이 순수 함수(`lib/mock-exam/assemble`)로 MST 라우팅 세트를 조립하고 `mock_exam_validate_mst_set` RPC 가 정원·중복·난이도 배정·스냅샷·경로 모양을 검증한다. 합격 검증에서 같은 함수·RPC 를 스크립트(`acc-set.ts`)로 재현해 **세트 내 중복 0·세트 내 유사 그룹 중복 0·M1/M2 배정 위반 0·RW 81 충족**을 확인했다(`docs/qa/2026-10-01-generation-acceptance.md` §5).
- 30세트 자동 조립 스크립트(제안): `scripts/assemble-sets.ts`(관리자 서비스 키 대신 격리/원격 환경 변수) — 세트 i 마다 이전 세트가 쓴 문항을 **제외**하고 조립·검증 RPC·`ready` 기록, 칸 규칙(영역 x 난이도 정원) 미충족이면 세트 생성 중단·부족 보고, 마지막에 **30세트 전수 검증**(세트 간 문항 중복 0, 세트 내 유사 그룹 중복 0, 모듈 정원, 난이도 배정, 스냅샷). 관리자 기능으로는 '일괄 조립 N세트' 버튼이 필요(현재는 세트 1개씩).
### 5.2 필요한 코드 변경 목록
1. **세트 간 문항 하드 제외**: `selectForCells` 의 선택 키가 `[skill 사용량, 재사용 여부, …]` 라 skill 균형이 재사용 회피보다 앞서 재사용이 발생(세트 2~3 에서 3~9건). 30세트 '재사용 없음'은 후보에서 다른 세트 사용 문항을 **필터로 제거**(세트 안 `usedInSet` 처럼).
2. **hard skill 커버리지 규칙**: 세트 3개당 각 skill hard ≥ 1 — 영역 x 난이도 독립 셀 대신 hard 칸을 skill 순환 배정(또는 영역별 hard 비중을 skill 수에 맞춰 조정)하는 규칙. 기존 셀 방식은 PSD·기하의 hard 를 세트당 ~1 로 줘 skill 7개·4개를 덮지 못한다.
3. **Math hard SPR**: 형식 비중(mc75/spr25)이 hard 칸에도 적용돼 hard SPR 칸이 비면 조립 불가(생성·컴파일러 hard 는 MC 만). 수정: hard 칸은 형식 분할을 끄거나(MC 허용), hard SPR 공급을 만든다.
4. **일괄 조립 + 전수 검증 관리자 기능**(또는 스크립트 운영 절차).
5. 응시 안내·시간(계산기·참조표 정책)은 이미 세트 구조에 포함 — 변경 없음.
### 5.3 오류 신고 자동 교체·난이도 점검과의 정합
- 난이도 점검(`review_problem_difficulty`)은 공개·초안 버전의 난이도만 바꾸고 **세트 스냅샷(`mock_exam_set_items.difficulty`)은 건드리지 않는다**. 난이도를 **올려야 하는데 M1/lower 에 이미 들어 있는 문항**(medium→hard)은 배정 위반이 되므로 RPC 가 `needsSetReplacement` 로 교체 대상을 알린다(합격 검증에서 변경 시 빈 배열 확인, hard→medium 은 higher 에서 허용되어 교체 불필요). 30세트 운영 시 세트 교체 동선(오류 신고 자동 교체)과 이 목록을 합쳐 처리하는 절차 필요(교체 후보는 '같은 skill·난이도·유사 그룹 다른 문항'이고 **세트 간 재사용 없음 규칙 때문에 여분 풀이 필요** — 칸별 여분 +2 와 별개로 교체 여분 풀(세트 수의 약 5%)을 계획에 더한다).
- 마이그레이션은 이번 작업에서 금지였고 필요한 경우(키워드·출처 컬럼 등)는 제안만 기록했다.
