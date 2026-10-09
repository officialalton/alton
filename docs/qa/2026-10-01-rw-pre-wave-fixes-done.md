# R&W 대량 생성 전 선행 수정 — 완료 보고 (2026-10-01)

**범위**: 코드·단위 테스트·설계만. 유료 API·원격 DB·supabase·마이그레이션·배포·푸시 없음(외부 변경 없음). 브랜치 `feat/rw-pre-wave-fixes`(worktree `~/Developer/ALTON-worktrees/rw-pre-wave-fixes`). 새 코드는 `scripts/rw-generation/`(순수 모듈 + 단위 테스트), 데이터는 `data/mock-exam-generation/recipes-v3-literary.json`·`data/rw-generation/plan-literary-40.json`.

## 1. 모듈별 구현 요약
| # | 항목 | 파일 | 요점 |
|---|---|---|---|
| 1 | 목표 정답 위치 | `answer-position.ts` | `planAnswerPositions` — (skill x 난이도) 그룹마다 가장 적게 쓰인 글자를 고르므로 **어느 시점에 끊어도 그룹 안 글자 수 차이 ≤ 1**(소량 배치·배치 분할 `prior` 누적 포함, 결정론). `positionDirective`로 프롬프트에 주입, `enforceAnswerPosition`으로 후처리: 어긋나면 순열 보정(해설 글자 치환), 보정 불가(숫자 선택지·선택지 안 글자 참조·형식 오류)는 **탈락**. |
| 2 | 소재 씨앗·이름 풀 | `name-pool.ts`, `seed-bank.ts`, `seed-compose.ts`, `usage-caps.ts` | 이름 428개(문화 26곳 x 성별 x 시대 classic/modern; Tobias·Odalys·Wren·Elena·Maren·Elias 금지), 배경 60종 x 지역 64곳(약 3,800 조합), 갈등 73, 관계 58, 장르 가중 배분(규격 비율), 도입 방식 12종·첫 단어 The/You/It/There 금지. `UsageLedger`가 배치·세트·전체 풀 상한을 강제: 이름 2/1/10, 지역 3/1/40, 배경 4/1/45, 갈등 2/1/32, 관계 3/1/40, 첫 단어(배치 12%·세트 2·전체 10%), 2인칭 배치 20%. 생성 전 배정(덜 쓴 것 우선, 상한 초과 조합 거절)과 생성 후 검사 양쪽. 2,000건(20배치) 배정 시 이름 최대 10회(이전 60건 중 Tobias 18건). |
| 3 | 지문 단어 수 | `passage-words.ts` | `judgeWordCount` — 규격 60~220 안에서 레시피 범위(예: 110~170)를 코드가 센다. 범위 밖이면 재요청 지시(실제 단어 수·목표 범위 포함) 1회, 그 뒤에도 벗어나면 탈락. `<u>`·`__` 표시는 단어 수에서 제외. |
| 4 | 약한 유형 레시피 v3 | `data/mock-exam-generation/recipes-v3-literary.json`, `recipe-v3.ts` | 인물 동기·요지/목적·인물 관계·어조/분위기 x hard·medium = 8개(v2 구조 호환 + 확장 필드). 골격: 근거를 서로 떨어진 2~3곳에 흩고(hard 간격 ≥ 2문장), **마지막 문장이 정답을 재진술하지 않게**, 오답은 '정반대 분위기'가 아니라 부분 정답(한 단서만)·방향 뒤집기·지문 표현 차용. 검증기: 근거 ≥ 2곳, 마지막 문장 금지·정반대 금지가 모든 레시피에 있어야 함, 오답 계획 3개 등. |
| 5 | 오답 품질 게이트 | `distractor-gate.ts` | 정답이 가장 긴 선택지(차이 ≥ 2단어)·길이 불균형(최장/최단 > 1.8)·정답만 구체적(쉼표)·오답이 절대어로 소거·정답과 어휘 60% 이상 겹치는 오답(복수 정답 위험)·오답끼리 거의 동일·'모두/없음/both' 선택지를 코드로 탈락. 추가로 `restatementGate`: 정답이 마지막 문장의 직설 재진술이면(내용어 겹침 ≥ 45% 이고 오답보다 +25%p) 탈락. 그럴듯함은 기존 AI 판정 유지. |
| 6 | 앱 코드 3건 | `lib/mock-exam/assemble.ts`, `app/admin/mock-exam-actions.ts`, `lib/problem-material-need.ts` | (a) **hard 세트 간 교차 제외**: `SelectionContext.hardExcludeIds` — 다른 세트에서 쓴 hard 문항은 하드 제외, 후보가 모자랄 때만 재사용하고 `hardReused`에 기록·`console.warn`. (b) **hard SPR**: `hardIgnoreFormat` — hard 셀은 mc/spr로 나누지 않아 hard SPR 공급이 없어도 칸이 비지 않음(Math 조립 양쪽 경로에서 켬). (c) **materialBlocker 오탐**: 본문 낱말(figure·as shown·table·graph shows)만으로 필수가 된 판정은 `viaTextCue`로 표시 — 그림이 이미 있으면(종류가 달라도) 막지 않고, R&W 본문 낱말은 필수가 아니라 권장(정량 근거만 계속 필수). 세부 기술이 필수로 선언된 경우(도형 기술 등)는 종류가 다른 그림이면 계속 차단. DB 통합 테스트는 돌리지 않음(공유 로컬 DB 보호) — 아래 '미완료' 참조. |
| 7 | 문학 40% 배치 계획 | `batch-plan.ts`, `plan-literary.ts` | 30세트 문학 필요 채택 572건(easy 127·medium 379·hard 66) → skill(중심내용·추론·어휘·구조 비중 190/158/306/238) → 문항 유형 11종 → 장르(유형별 허용 장르: 일기·시·희곡·편지는 잘 되는 유형만) → 후보 수(채택률 easy .30·medium .35·hard .15, 발췌 easy .33) → 100건 배치 22개. **easy = 발췌(`route=excerpt`) 438후보, hard·medium = AI 지문 동시 생성(`route=ai_passage`) 1,567후보**(셀별 올림으로 합계 2,005 — pilot 단순 합 1,949 대비 +56). 예상 비용: 동기 $152.28 / 배치 $76.14(hard '쉬움' 재작성 60% 포함). 레시피 v3 로 hard 수율이 35%가 되는 시나리오: 후보 1,746 · $120.37 / $60.19. 출력 `data/rw-generation/plan-literary-40.json`. |
| – | 후보 전개·후처리 | `candidate-pipeline.ts` | `expandBatch`(배치 → 씨앗·목표 위치·단어 범위·레시피가 붙은 후보 명세), `injectedPromptBlock`(프롬프트 주입 블록), `evaluateGenerated`(형식 → 단어 수(재요청 1회) → 정답 위치 보정/탈락 → 오답 게이트 → 재진술 게이트 → 금지 이름·소재 상한). |

## 2. 테스트 결과
- 새 단위 테스트 `scripts/rw-generation/*.test.ts` 7파일 77건 통과(결정론·분포·상한·경계: 소량 배치 편차 ≤ 1, 20배치 상한, 단어 수 59/60/220/221, 게이트 양·음성 사례, 레시피 검증기 위반 탐지, 계획 합계·라우팅·장르 제약).
- 앱 코드: `lib/mock-exam`·`lib/problem-material-need`·`app/admin` 포함 단위 117파일 868건 통과(신규 테스트: hard 교차 세트 제외 4건, 자료 종류 오탐 4건 포함). **전체 단위 프로젝트(`vitest --project unit`) 426파일 4,665건 통과(1파일 스킵 기존)**, 통합 프로젝트는 실행하지 않음.
- `tsc --noEmit`: 신규·수정 파일 오류 없음. 기존 오류 1건(`app/layout.tsx` `LayoutProps` 미정의 — 이번 변경과 무관, 미수정).

## 3. 결정 필요 (총괄)
1. **skill 코드와 앱 렌더 규칙 충돌(중요)**: 앱 `checkRwStructure` 는 `inferences` 를 '빈칸 하나 + "Which choice most logically completes the text?"' 형태로만 허용한다. 파일럿(v4)이 `inferences` 로 묶은 문학 유형 4개(인물 동기·어조/분위기·인물 관계·상징)는 빈칸 없는 문항이라 그대로 저장하면 거부된다(파일럿 채택분은 이 검사를 거친 적이 없다). 코드에서는 `APP_SKILL_OVERRIDE`(batch-plan.ts)로 이 4유형을 `central_ideas_details` 로 검사·저장하도록 했다(채택 레코드에 `skill`=앱 skill, `planSkill`=계획 skill). **권장**: 이 매핑 유지(실제 SAT에서도 문학 인물 문항은 빈칸형 추론이 아님). 영향: skill별 공급 집계에서 inferences 문학분이 central_ideas_details 로 이동 — 30세트 skill 균형 계산을 조정해야 한다. 빈 객체로 바꾸면 파일럿 매핑으로 돌아간다(그러면 해당 유형은 빈칸형으로 다시 설계해야 함).
2. **hard 레시피 범위**: v3 는 약한 4유형만 설계했다. 나머지 hard 유형(화자 태도·상징·어조 전환·비유 등)은 레시피 없이 난이도 지시문만 쓴다(계획 `recipeSource=difficulty_tip`). v2 레시피는 비문학 skill 별이라 문학에 연결하지 않았다. 웨이브 1 수율을 보고 필요한 유형만 추가 레시피를 설계할지 판단.
3. 문학 40% 필요량의 기준은 pilot 문서 12절의 1,429문항 난이도 구성(317/948/164)을 그대로 썼다. 총괄이 30세트 skill 별 배분(thirty-need)과 다른 기준을 원하면 `batch-plan.ts` 의 `PASSAGE_BASE`·`SKILL_WEIGHT` 만 바꾸면 된다.

## 4. 미완료·남은 레거시 경로
- DB 통합 테스트(`mock-exam-*.integration.test.ts`)는 공유 로컬 DB 보호를 위해 이번에 돌리지 않았다. Math 조립에 `hardIgnoreFormat` 이 켜졌으므로 격리 스택에서 `mock-exam-routing-assemble`·`mock-exam-actions` 통합 테스트 1회 확인이 필요하다(hard 칸 형식 분포가 바뀐다).
- 웨이브 실행기(`batch-pipeline.ts`)에는 아직 연결하지 않았다(웨이브 승인 때). 대신 아래 세션 모드가 같은 모듈을 쓰는 독립 경로다.
- 기존 `diversity.ts` 의 `targetLetterFor`(skill 해시 순환)는 레거시로 남겼다 — 신규 경로는 `planAnswerPositions` 를 쓴다.
- 계획 생성기는 문학 40% 기준 하나만 출력한다(`--share` 로 비중 변경 가능).

## 5. 외부 변경
없음. 유료 API 호출 0건, 원격 DB·supabase·마이그레이션·배포·푸시 없음. 새 파일은 worktree 안에만 있고 커밋은 로컬 브랜치 `feat/rw-pre-wave-fixes` 에만 남긴다.

---

# 세션 모드 (API 0 — 서브 에이전트로 생성·판정)

유료 API 대신 에이전트 도구의 `model`(opus/fable/sonnet)로 생성·판정을 돌리는 흐름이다. 기존 API 모드(`batch-pipeline.ts` 등)는 그대로 있고 선택이다. 구현: `scripts/rw-generation/session-mode.ts`(순수 파일 입출력, API 호출 없음) + `session-cli.ts`. 테스트: `session-mode.test.ts`(모의 에이전트 결과 파일로 prepare → ingest → review 집계 → 재작성이 결정론적으로 동작함을 확인).

## 흐름과 파일
실행 폴더 `data/rw-generation/runs/<runId>/` — `tasks/`(작업 파일), `results/`(에이전트 결과), `ingested/`(검증 결과), `reports/`(채택 보고), `manifest.json`(작업 목록·상태), `state.json`(소재 상한·정답 위치 누적 장부), `sim-index.jsonl`(유사도 인덱스), `cost-ledger.json`.

1. **prepare** — 배치 계획의 한 배치를 **청크(10~25문항, 기본 20)** 작업 파일로 내보낸다. 작업 파일 1개 = 에이전트 1명. 파일에 프롬프트(`instructions`: 규칙·금지 사항·출력 스키마·허용 값·결과 저장 경로)와 후보별 정보(skill·난이도·유형·장르·소재 씨앗·이름·도입 방식·목표 정답 위치·단어 범위·레시피 블록, 발췌 경로는 발췌 원문)가 모두 들어 있다. 같은 배치를 두 번 prepare 하면 거부(장부 이중 집계 방지).
2. **에이전트 실행** — 총괄이 `status --dispatch` 가 출력하는 짧은 프롬프트로 에이전트를 띄운다(작업 파일 경로 + 결과 경로, 끝나면 `done N` 한 줄). 모델은 작업 파일의 `suggestedModel`(생성 opus, 판정 fable/opus/sonnet).
3. **ingest** — 결과 JSON 을 읽어 기존 코드 검증을 **전부** 통과시킨다: 형식(4지선다·정답 글자·해설·한글 혼입)·선언 3개·발췌 원문 일치·잔재 검사(`findResidue`)·렌더 검사(`checkContent`, 앱 skill 매핑 적용)·규격 검증(`validatePassages`: 마크업·출처 머리글·청크 안 유사도)·단어 수(재요청 1회)·정답 위치 보정/탈락·오답 길이·정답 최장·복수 정답 신호·마지막 문장 재진술·이름·첫 단어·소재 상한·전역 유사도(3-gram MinHash, 같은 skill 0.6 / 문두 3건). 통과분은 `ingested/<taskId>.json` 의 `passed`, 탈락은 `rejected`(stage·사유), 단어 수 재요청 대상은 `retryWords`. 탈락 후보가 소재 장부를 소진하지 않는다.
4. **review-prepare** — 통과분을 청크로 나눠 **3역할 작업 파일**을 만든다: `fable_judge`(Fable, 블라인드 풀이 + 난이도·hard 적합·오답 그럴듯함·길이 균형·복수 정답 위험), `second_solver`(Opus, 블라인드 풀이 + 방어 가능 정답 여부 = 정답 일치의 두 번째 모델 관점), `explanation_audit`(Sonnet, 표시된 정답·해설 정합·사실 오류). 블라인드 두 역할의 작업 파일에는 정답·해설이 없다(테스트로 확인).
5. **review-ingest** — 판정 집계. 채택 규칙(운영 기준과 동일): Fable 정답 일치·단일 정답 + 두 번째 풀이자 일치·단일 정답 + 해설 감사 통과 + 오답 품질(그럴듯함·길이 균형·복수 정답 위험 없음) + 난이도(**hard = Fable 추정 hard + hard_fit**, medium·easy = 추정 난이도가 요청과 일치). 세 역할 결과가 다 오기 전에는 `pending`. 채택은 `reports/adopted-items.json`(기존 adopted 레코드 모양: gid·problem·quality, hard 는 `difficultyStatus=provisional_ai`), 탈락 사유 집계는 `reports/adoption-report.json`, 사유별 목록은 `reports/rejected.json`.
6. **rewrite-prepare** — 재작성 작업 파일. 대상은 (a) **탈락 사유가 '쉬움' 하나뿐**(정답·오답 품질·해설은 모두 통과, 난이도만 요청보다 쉬움)이고 재작성 이력이 없는 AI 지문 후보(medium·hard), (b) 지문 단어 수 재요청 대상. 후보당 1회뿐이며 재작성본이 다시 '쉬움'이면 재작성하지 않고 탈락한다. 재작성 결과는 같은 `ingest`(재작성 모드: 단어 수 재요청 소진) → `review-prepare`(재작성본만 다시 판정) 순서로 돈다.
7. **비용 장부** — `cost-ledger.json` 은 **세션 사용(API 0: 작업 수·문항 수만 기록)** 과 **API 사용(달러)** 을 구분한다. ingest 가 세션 사용을 자동 기록하고, 기존 API 경로로 판정을 돌렸다면 `session-cli record --step … --model … --items n --usd x` 로 API 사용을 기록한다. `session-cli cost` 가 두 합계를 보여 준다.

## 명령
```bash
R=lit40-wave1            # runId
C="npx tsx scripts/rw-generation/session-cli.ts"
$C prepare --run $R --batch lit40-hard-01 [--chunk 20] [--plan data/rw-generation/plan-literary-40.json]
$C prepare --run $R --batch lit40-easy-01 --excerpts <발췌.jsonl>   # easy: 줄마다 {"text":…,"source":{저자·작품·연도·URL·라이선스·SHA·위치}}
$C status  --run $R --dispatch      # 에이전트를 띄울 작업 + 프롬프트
$C ingest  --run $R                 # 결과 파일이 도착한 생성·재작성 작업을 전부 검증
$C review-prepare --run $R          # 통과분 -> 판정 작업 파일(3역할)
$C review-ingest  --run $R          # 집계 + 채택 보고
$C rewrite-prepare --run $R         # '쉬움' 재작성 + 단어 수 재요청 작업 파일
$C cost --run $R
```

## 총괄이 에이전트를 몇 개씩 띄워 웨이브를 돌리는 절차
규모(문학 40%, 후보 2,005건): 생성 작업 약 100개(AI 지문 1,567건 ≈ 79개 + 발췌 easy 438건 ≈ 22개, 20건씩), 통과율을 약 60%로 보면 판정 약 1,200건 ≈ 60청크 x 3역할 = 약 180개, 재작성 약 10개.
1. **웨이브 1(소량 검증)**: 배치 하나(100건)만 prepare → 생성 에이전트 5개를 **동시에** 띄운다(Agent 도구, `model: opus`, 프롬프트 = `status --dispatch` 출력, 백그라운드). 전부 `done` 이면 `ingest` → 탈락 사유 분포 확인(단어 수·오답 게이트·재진술·유사도) → `review-prepare` → 판정 에이전트를 역할별로 띄운다(`fable_judge` model fable, `second_solver` opus, `explanation_audit` sonnet) → `review-ingest` → 채택률·사유 확인. 기준 미달(예: 채택률 25% 미만)이면 웨이브 2 금지.
2. **병렬도 권장**: 생성(Opus) 동시 6~8개, 판정 Fable 동시 4개(속도 제한 여유 확인), Opus·Sonnet 판정 각 4~6개. 에이전트 한 개는 청크 하나만 처리하고 끝낸다(컨텍스트 오염 방지). 실패·무응답 청크는 결과 파일이 없으므로 `status` 에 계속 대기로 남고, 같은 작업 파일로 다시 띄우면 된다(재 prepare 불필요).
3. **웨이브 2 이후**: 난이도별로 배치를 순서대로 prepare(예: medium 배치 11개 → hard 배치 5개 → easy 발췌 배치 5개). 한 번에 모든 배치를 prepare 해도 되지만(장부는 배치 순서대로 누적), 에이전트는 한 번에 6~8개씩 띄우고 끝나는 대로 `ingest` 를 돌린다. 판정 단계도 생성이 끝난 청크부터 `review-prepare`(미판정 통과분만 대상)로 이어 돌릴 수 있다.
4. **재작성**: 한 웨이브의 `review-ingest` 직후 `rewrite-prepare` → 재작성 에이전트(opus) → `ingest` → `review-prepare` → 판정 → `review-ingest`. 재작성은 후보당 1회뿐이다.
5. **마무리**: `review-ingest` 의 `reports/adopted-items.json` 이 임포트 입력이다(임포트는 총괄 승인 후 기존 경로로). 발췌 easy 의 `quality.sourceText` 는 출처 메타로 보존된다.
6. 각 웨이브 끝에 `cost` 로 세션 사용(작업 수)과 API 사용(0 이어야 함)을 보고한다.

주의: 에이전트가 쓰는 결과 파일은 작업 파일이 지정한 경로 하나뿐이다. 에이전트는 작업 파일의 `instructions` 만 따르며 코드·장부를 직접 건드리지 않는다. 장부(소재 상한·정답 위치·유사도)는 prepare·ingest 가 갱신하므로 같은 runId 에서 순서를 지켜 실행한다.
