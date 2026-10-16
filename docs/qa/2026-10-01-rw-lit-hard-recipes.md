# 2026-10-01 R&W 문학 hard 레시피 v4: 웨이브 1 분석·설계·검증 계획

범위: 웨이브 1(`lit40-wave1`) 문학 hard 100건(채택 7건, 7%)의 탈락 원인을 분류하고, 문학 문항 유형 11종 전부에 hard 레시피를 새로 설계했다. 이번 작업은 설계와 시험 작업 파일 준비까지다. 시험 문항 생성·판정은 하지 않았다(총괄 실행). 공유 DB·원격·배포·유료 API는 사용하지 않았다.

## 1. 웨이브 1 hard 분석

### 1.1 숫자
- hard 후보 100건: 생성 게이트 탈락 24건(대부분 오답 게이트), AI 판정까지 간 76건 중 66건이 `difficulty_too_easy`로 탈락, 채택 7건.
- Fable 추정 난이도(판정된 hard 후보 76건): hard 10, medium 56, easy 10. 즉 대부분이 "medium으로 보임"이다.
- 레시피별 채택: v3 레시피를 쓴 4개 약한 유형은 33건 중 1건(3%), 레시피가 없던 7개 유형은 58건 중 6건(10%). v3의 "근거 분산 + 부분 정답 오답" 설계는 hard 채택률을 올리지 못했다(표본이 작아 단정은 아니다).

| 유형 | 채택 | 비고 |
|---|---|---|
| underlined_portion_function | 2 | 채택 효율 최고. 탈락은 밑줄 직후 문장이 답을 줌 |
| narrator_attitude | 2 | 정답만 yet/despite/but 구조인 탈락이 여럿 |
| character_motivation(v3) | 1 | |
| symbolism | 1 | |
| text_structure | 1 | 생성 게이트 탈락 4건 |
| main_idea_or_purpose(v3) | 0 | 12건 모두 탈락 |
| tone_or_mood(v3) | 0 | est 전부 medium |
| relationship(v3) | 0 | |
| tone_shift / figurative_language | 0 | 비유·전환이 직접 서술 |
| word_in_context | 0 | 10건 중 9건이 선택지가 한 단어라 게이트(2~40단어) 탈락, 나머지는 빈칸 뒤 동격구가 정답을 정의 |

### 1.2 '너무 쉬움' 66건의 패턴(Fable 판정 사유 기준, 중복 분류)
| 패턴 | 건수 | 대표 사유 |
|---|---|---|
| A. 오답이 지문 사실과 충돌하거나 근거가 전혀 없어 소거가 쉬움 | 약 37 | "A·C·D 모두 지문에 근거 없는 과장", "지문과 정면 충돌해 한 단계 소거" |
| B. 정답이 지문(특히 마지막 문장)에 거의 직접 서술됨 | 약 21 | "마지막 문장이 C를 거의 그대로 말함", "직후 문장이 답을 거의 직접 줌" |
| E. 근거가 한 방향이거나 추론이 한 단계 | 약 11 | "세 단서가 모두 같은 방향이라 C가 자연스럽게 떠오름", 관용 비유 해석 |
| D. 극단어·절대어·과장 오답 | 약 10 | "'-ly' 극단 수식어로 소거 가능", "fully/strictly 표현" |
| C. 정답만 양가 접속 구조(yet/despite/but) | 약 6(+생성 게이트에서 구체성 탈락 다수) | "정답만 'yet' 양가형이라 패턴 학습자가 맞힘" |
| F. 정답이 가장 길거나 추상적 | 약 3 | |

핵심 관찰: 레시피가 요구한 "근거를 두 곳에 흩어 놓기"는 대체로 지켜졌다(Fable 사유에도 "두 단서 결합은 필요하다"가 반복된다). 그래도 쉬웠던 이유는 오답이 지문 사실로 곧바로 소거되기 때문이다. 근거를 분산해도 오답이 "지문에 없는 말"이면 학생은 근거를 결합할 필요 없이 오답 세 개를 지워서 푼다.

### 1.3 채택된 7건의 공통점
채택: 010(character_motivation), 042·044(underlined), 046·093(narrator_attitude), 064(symbolism), 081(text_structure).
1. 정답이 지문에 문장으로 없다. 숨은 사실을 읽어야 한다(093: 노인이 일부러 졌다는 사실이 명시되지 않음, 010: 소문과 타자본 사실을 결합).
2. 앞 단서가 표면 해석을 지지하고 뒤 단서가 그것을 바꾼다(재해석 구조: 042 비유, 044 '11년', 064 균열, 081 커피 제스처).
3. 가장 강한 오답이 그럴듯한 표면 해석이며 지문과 충돌하지 않는다(064의 '관계 손상', 042의 C, 010의 D).
4. 정답이 두 개 이상의 떨어진 단서를 결합해야만 확정된다.
5. 오답이 극단어가 아니라 온건한 어휘로 쓰여 형식으로 소거되지 않는다(046에서 극단어 오답 D만 탈락).
6. 7건 중 5건이 '밑줄·구조·상징'처럼 추상 수준이 한 단계 높은 질문이거나 화자의 말투와 행동이 어긋나는 문항이다.

## 2. v4 레시피 설계 원칙(11유형 공통)
1. 사실 호환 오답: 오답 3개는 지문의 모든 명시 문장과 양립한다. 소거 근거가 "지문과 충돌"이면 쉽다. 오답은 "지문이 말하지 않는 추론"이라서만 틀려야 한다.
2. 결정 단서 한 곳: 정답 외 선택지를 배제하는 단서를 행동·시점·누락 중 한 곳에 둔다(없으면 복수 정답 6건처럼 `fable_multi_defensible`).
3. 재해석 구조: 앞 단서는 표면 해석을 지지하고 뒤 단서가 그것을 바꾼다.
4. 정답의 핵심 어휘와 해석 문장은 지문에 없다. 어휘 차용은 오답에만 둔다.
5. 형식 균질: 네 선택지의 문장틀·길이(±2단어)·접속 구조를 통일하고 절대어·`-ly` 극단어를 쓰지 않는다. 과잉 일반화 오답은 온건한 어휘로 범위만 넓힌다.
6. 마지막 문장은 장면·사물·동작으로 끝나고 정답을 요약하지 않는다.
7. 오답 3개는 서로 다른 오독 경로(kind)를 갖는다(부분 정답·지문 표현 차용·방향/원인 뒤집기·과잉 일반화·그럴듯한 다른 감정 중 3종).

## 3. 11유형별 설계 요약(전문은 `data/mock-exam-generation/recipes-v4-literary-hard.json`)
| 유형(skill) | 지문 설계(근거 위치) | 정답 설계 | 오답 3개(kind) | 웨이브 1 약점 대응 |
|---|---|---|---|---|
| character_motivation(inferences) | 앞 습관 · 중간 시점/순서 단서 · 끝 사물. 표면 명분을 한 번 서술 | 두 단서로 표면 명분 기각(2단계) | 표면 명분 차용(passage_wording) · 한 단서만(partial) · 다른 감정(plausible_emotion) | 표면 진술 함정을 의도적으로 넣고 오답이 지문과 충돌하지 않게 함 |
| tone_or_mood(inferences) | 감정어 없이 어휘·리듬·디테일로 겉 어조(앞)·속 어조(뒤·결말) | 겉 층+속 층 두 층 어조 | 겉 층만(partial) · 원인 뒤집기(reversed_cause) · 같은 감정군 범위 변경(overgeneralization) | 선택지를 전부 두 층 문장틀로 통일해 yet 형식 노출 제거, 극단 수식어 금지 |
| relationship_between_characters(inferences) | 호칭(앞) · 물건/시간/돈이 오가는 방향(중) · 끝 양보 동작 | 실제 관계와 의존 방향 | 공식 호칭 관계(passage_wording) · 한 장면(partial) · 의존 방향 뒤집기(reversed_cause) | 결말에서 관계를 선언하지 않음, 방향을 정하는 결정 단서 한 곳 |
| symbolism(inferences) | 사물이 떨어진 두 맥락에 등장, 마지막에 대하는 동작이 변함 | 두 맥락을 포괄하는 추상 의미(3단계) | 문자 기능(passage_wording) · 앞 맥락만(partial) · 관계 손상/회복으로 읽기(reversed_cause) | 채택 064의 '관계 손상' 오답을 표준 오답으로 승격 |
| main_idea_or_purpose(central_ideas_details) | 사건 1(앞) · 미해결 디테일 · 사건 2(뒤). 교훈 문장 없음 | 두 사건의 관계(3단계) | 사건1 요지(partial) · 사건2 요지(passage_wording) · 두 사건 인과 뒤집기(reversed_cause) | 극단어 금지, 오답이 지문과 충돌하지 않음, 정답 요약 문장이 마지막에 없음 |
| narrator_attitude(central_ideas_details) | 말투(앞) · 자기 정정 어구(중) · 행동(뒤) | 말투 아래 태도 | 말투만(partial) · 방향 같고 이유 뒤집기(reversed_cause) · 지문 표현 차용(passage_wording) | 네 선택지를 모두 양가 구조로 통일 |
| figurative_language(words_in_context) | 신선한 비유, 단서는 비유 앞 두 곳·뒤 한 곳, 직후 문장이 풀이하지 않음 | 두 단서를 만족하는 속성 | 속성 A(partial) · 속성 B 지문 표현(passage_wording) · 문자 해석/범위 확대(overgeneralization) | 관용 비유 금지, 문자 오답은 하나 이하 |
| word_in_context(words_in_context) | 빈칸 뒤 정의 금지, 제약 두 개를 떨어뜨림 | 두 제약을 모두 만족하는 구 | 한 제약(partial) · 정도 차 근접 표현(overgeneralization) · 지문 주제어(passage_wording) | 선택지를 2~3단어 구로 통일해 게이트(2~40단어, 비율 1.8) 통과 |
| tone_shift(text_structure_purpose) | 접속 표지·감정어 없이 리듬·화제 이탈로 전환, 겉 어조는 유지 | 전환 방향+원인(끝 동작) | 겉 변화만(partial) · 원인 뒤집기(reversed_cause) · 성격 한 단계 오독(overgeneralization) | 전환이 명시적이던 문제 제거 |
| text_structure(text_structure_purpose) | 관찰 · 요청이 재해석 · 열린 결말 | 재해석 단계 포함 구조 | 전반부만(partial) · 순서 뒤집기(reversed_cause) · 결말 기능 오독(passage_wording) | 오답에 지문에 없는 사건 금지 |
| underlined_portion_function(text_structure_purpose) | 밑줄 문장(단독으로는 배경) · 무관해 보이는 장면 · 기능을 바꾸는 후반 사건 | 밑줄 문장의 재해석된 기능(3단계) | 밑줄만(partial) · 직후 문장 관계(reversed_cause) · 일반화(passage_wording) | 밑줄 직후 문장이 해석을 주지 않음 |

레시피 구조: v3 필드 전부(`id·difficulty·questionType·genres·passageWords·instruction·beyondMedium·checklist·minMet·evidenceSpread·distractorPlan·bannedPatterns·evidence·officialDifficulty·difficultySource`)에 v4 필드 `version:4`, `passageDesign`(근거 위치 3곳·직접 서술 금지 범위·문체 장치), `answerDesign`(추론 단계·결합), `selfCheck`(자기 점검 6개 이상)를 추가했다. 모든 레시피는 v3 검증기를 통과하고, 추가로 `validateRecipesV4`가 11유형 전수·서로 다른 kind 3개·추론 2단계 이상·selfCheck 6개 이상을 강제한다. 난이도 적합 체크리스트는 `checklist`(minMet = 항목 수 - 1)와 `selfCheck`에 있다.

## 4. 코드 변경(`scripts/rw-generation`)
- `recipe-v3.ts`: v4 선택 필드 타입, `loadRecipesAll()`(v3+v4 병합, 같은 skill·유형·난이도에서 v4 우선), `findRecipe()`, `validateRecipesV4()`, `LITERARY_QUESTION_TYPES`, `recipePromptBlock`에 지문 설계·정답 설계·자기 점검 줄 추가(v4 필드가 있는 레시피만).
- `batch-plan.ts`: 기본 레시피를 `loadRecipesAll()`로, `recipeSource`에 `"v4"` 추가, hard 셀에 레시피가 없으면 계획 단계에서 예외.
- `candidate-pipeline.ts`: `expandBatch`가 `findRecipe`를 쓰고 hard AI 지문 후보에 레시피가 없으면 예외("레시피 없는 hard 후보 금지").
- `session-mode.ts`: prepare·review-prepare·rewrite-prepare 기본 레시피를 `loadRecipesAll()`로.
- 신규 `hard-pilot-plan.ts`: 11유형 x 3 후보(장르 순환)의 시험 배치 `hardv4-hard-01`.
- 테스트: 신규 `recipe-v4.test.ts` 10건(검증기·결함 검출·11유형 전수·v4 우선·레시피 없는 hard 금지·시험 계획 결정론), 기존 `batch-plan.test.ts`는 v4 기대값으로 갱신, `session-mode.test.ts` 픽스처 지문을 150단어로(hard 지문 하한이 올라감). `npx vitest run scripts/rw-generation` 8개 파일 87건 통과. `tsc --noEmit`의 유일한 오류는 기존 `app/layout.tsx` `LayoutProps`이며 이번 변경과 무관.
- 영향: `loadRecipesV3()` 기본 호출 동작과 v3 파일은 그대로다. 대량 계획(`buildLiteraryPlan` 기본값)의 hard 셀이 v4 레시피를 쓰게 바뀌며, 지문 하한이 120~130단어로 올라간 유형이 있다(비용 소폭 증가 가능).

## 5. 검증 계획(총괄 실행)
시험 작업 파일 준비 완료(worktree `~/Developer/ALTON-worktrees/rw-lit-hard-recipes`, 경로 `data/rw-generation/runs/lit-hard-v4-pilot/tasks/gen-hardv4-hard-01-0{1,2,3}.task.json`, 11유형 x 3 = 33후보, 모두 v4 레시피 배정). 총괄 체크아웃에서 쓰려면 브랜치를 가져온 뒤 같은 명령을 다시 실행하면 결정론적으로 같은 작업 파일이 나온다.

```
npx tsx scripts/rw-generation/hard-pilot-plan.ts
npx tsx scripts/rw-generation/session-cli.ts prepare --run lit-hard-v4-pilot --plan data/rw-generation/plan-lit-hard-v4-pilot.json --batch hardv4-hard-01 --chunk 11
# 에이전트가 생성 -> ingest -> review-prepare -> 판정 -> review-ingest (기존 웨이브 절차와 동일)
```
판정 기준(제안): 33건 중 hard 채택 6건(약 18%) 이상이면 대량 반영, 3건 이하이면 탈락 사유를 다시 분류해 레시피를 고친다. 유형별 3건은 통계가 아니라 유형 단위 진단용이므로, 채택 0건인 유형은 같은 유형을 추가 3건으로 재시험한다. 확인할 지표: 유형별 est_difficulty 분포, 사유 패턴 A(오답 소거)·B(정답 직접 서술)의 감소, `fable_multi_defensible`(복수 정답) 증가 여부(사실 호환 오답의 부작용), 생성 게이트 탈락률(특히 word_in_context 단어 수·쉼표 구체성).

## 6. 위험·남은 것
- 사실 호환 오답은 복수 정답 위험을 키운다. 결정 단서 한 곳 규칙으로 대응했지만 시험에서 `other_defensible` 비율로 확인해야 한다.
- 레시피 지침이 길어져 생성 프롬프트가 늘었다(토큰 증가). 시험에서 지침 준수율(마지막 문장 재진술·형식 균질)을 같이 본다.
- word_in_context는 2~3단어 구 선택지로 우회했다. SAT 실전은 한 단어 선택지가 보통이므로, 시험에서 채택률이 나쁘면 게이트를 유형별로 완화(minWords 1)하는 편이 낫다(코드 변경은 총괄 결정).
- hard는 여전히 `provisional_ai`다. 실제 난이도 보정은 출시 후 학생 응답으로만 가능하다.
