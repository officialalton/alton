# AP English Literature and Composition — 설계와 실행 기록 (2026-10-14/15)

사실(시험 구조·루브릭·비중)은 `englit-facts.md`. 이 문서는 AP English Language 선례(`englang-groundwork.md`, `englang-review-report.md`)를 문학에 옮긴 설계와 실행 결과다.

## 1. 선례에서 가져온 것과 달라진 것

| 항목 | Language(선례) | Literature(이번) |
|---|---|---|
| MC 구조 | 지문 묶음 4–6문항, 읽기·글쓰기 두 영역, 45문항 | **지문 5묶음 8–13문항**(시 2·단편 소설 2·장편/희곡 1이 사실상 강제), 55문항, 글쓰기 영역 없음 |
| 지문 | 논픽션 문단(¶)·문장 번호 | **시·산문·희곡, 줄 번호(5줄마다)**, 문항이 "lines 7–9"로 가리킨다 |
| 정답 보증 | 풀이 3 + 적대 + 심판 | 풀이 2(Opus·Sonnet) + 적대(Opus) + 심판(Opus) + 지문 검토(Sonnet) + **제2 모델 패널(Fable)** + 결정적 게이트 |
| 길이 단서 | 생성 후 검수에서 76/90 발견 | **생성 프롬프트에 규칙 + 코드 검출(키가 유일 최장 ≥ 1.12배) + 오답 보정 단계(Sonnet) + 묶음 40% 상한 + 키 위치 코드 균등 배치** |
| FRQ | 종합·수사 분석·논증 | 시 분석·산문 분석·**문학 논증(실제 출판 작품 40편 목록은 코드가 고정)**, 각 6점 분석 루브릭 |
| 채점 루브릭 | `englang-v2` | 새 루브릭 id `englit`(버전 `englit-v1`); Language 루브릭·동작·행 키는 그대로 |

## 2. 줄 번호를 코드가 계산한다 (`lib/ap-exam/passage-lines.ts`)
- 모델은 줄 번호를 쓰지 않는다. 시는 줄 배열(연=배열)로, 산문·희곡은 문단 문자열로 낸다 — 산문은 코드가 56자 폭으로 접어 줄을 만든다(첫 줄 4칸 들여쓰기).
- 문항은 지문 구절을 `refs[{id, quote}]`로 인용하고 줄 자리를 `[[r1]]`로 쓴다. 코드가 구절의 위치(지문에서 정확히 한 번 나타나야 함)를 찾아 `line 7` / `lines 7-9`로 바꾼다. 손으로 쓴 `line 12` 는 위반(hand_written_line_number). 따라서 **줄 번호 오류는 구조적으로 없다**.
- 빈 줄(연·문단 사이)은 세지 않고 번호는 5줄마다 표시한다. 학생 화면(`LearningText`의 `passage` 펜스 → `PassageBlock`)·풀이기 프롬프트·채점기 입력이 같은 규칙을 쓴다.

## 3. 결정적 게이트 (`lib/ap-generation/englit-gates.ts`, 테스트 `englit-gates.test.ts`)
- 지문: 단어 수(시 100–330, 산문·희곡 450–800), 줄 수, 연·문단 수, 마크다운/수식 기호, 실존 저자·작품명(`real_author_or_title`), AI 상투구, 5-gram·연속 10단어 유사도(이전 지문·FRQ 지문 전체와), 한글, 출처 `original`.
- **장치 근거 검증**: 블루프린트 장치마다 지문 속 정확한 구절(quote)이 있어야 하고, 코드로 형태를 확인한다 — 직유(like/as/than), 행간 걸침(enjambment: 줄 끝이 .!?;: 가 아니고 문장이 이어짐), 중간 휴지(caesura), 두운(같은 첫 소리 3어 이상), 반복 수미(anaphora: 연속 줄 머리 반복). 확인 실패 장치는 목록에서 빼고(세트를 버리지 않음) 5개 미만이면 세트 탈락.
- 문항: 4지선다·키 1개·오답 라벨(11종) 2종 이상·근거 인용(`evidence_quotes`)이 지문에 그대로 존재·stem/선지의 따옴표가 지문에 그대로 존재·연/문단 서수가 범위 안·시 문항이 "paragraph", 산문 문항이 "stanza"라고 쓰지 않음·스킬 6.A–6.D 는 직유·은유·의인화·인유 장치가 블루프린트에 있어야 함·MC 에 7.E 금지.
- 길이 단서: `lengthCueRatio`(키가 유일 최장이면 키 글자수/오답 평균). ≥ 1.12 이면 보정 대상. 보정 뒤에도 묶음 안 비율이 40% 를 넘으면 큰 것부터 제외.
- 키 위치: 코드가 전체에서 균등 배치(연속 3회 금지)한다.

## 4. 파이프라인 (`scripts/ap-generation/englit-pipeline.ts`, 동결 구성 `config/ap-frozen/englit-*.v1.json`)
동결(--freeze → 커밋 → --check-only → 유료), `"batch": true`(Message Batches). 예산 가드: 실행 상한·Literature 합계 $12·누적 $186(구성의 `hardStopCumulativeUsd`).
`gen → check → rebalance → solve → adv → judge(+review) → panel → finalize`; FRQ: `frq-gen → frq-samples → frq-grade → frq-finalize`.
- 생성: Opus 5.5(effort low). Fable 은 생성 1건당 $0.4–0.65(사고 토큰) + 큐가 느려 이번 예산에 맞지 않아 쓰지 않았다(파일럿 2건 $1.08 으로 확인; 시 1건은 max_tokens 로 잘림).
- 풀이: Opus·Sonnet 이 지문+문항만 보고(키·블루프린트 비공개, 선지 순서를 풀이기마다 다르게). **전원 일치 + 두 번째 방어 가능 선지 보고 없음 + 적대 strong 아님 + 심판 key_clearly_better + 지문 검토 ok** 가 키 신뢰도 게이트(점수 0–1, 0.8 이상).
- **제2 모델 패널**: 위를 통과한 문항만 **다른 모델(Fable)** 이 선지 순서를 바꿔 맹검으로 다시 풀고, 키와 다르거나 제2 방어 가능 선지가 있으면 제외한다.
- 적대 검토의 `key_flaw`·`stem_issue` 는 대부분 해설 문구의 사소한 부정확이라(파일럿 13문항 중 8건) 제외 사유로 쓰지 않고 `payload.items[].review_notes`에 남겨 사람 검수에 넘긴다.
- FRQ 샘플: 프롬프트마다 high/mid/low × 후보 2, 독립 채점기 3(Opus·Sonnet·Fable)의 행별 중앙값을 점수로 저장, 의도 점수 ±1·채점기 총점 편차 ≤ 2·서열 엄격, 샘플의 따옴표 인용은 지문에 그대로 있어야 하고(코드), Q3 는 채점기가 작품에 대한 사실 오류를 보고하면(2/3) 탈락.

## 5. FRQ 스키마 `lit-frq-1` (`lib/ap-generation/englit-frq.ts`)
`payload.lit_frq` = { schema_version, task_type(poetry_analysis|prose_analysis|literary_argument), template(q1|q2|q3), title, prompt{lead,task,requirements[]}, passage?{form,title,attribution,headnote?,stanzas,line_count,provenance}, works_list?(Q3, 검증된 40편 고정), rubric{rows A|B|C(공통 수준 설명 + 과제별 task_specific), scoring_notes}, expected_features, samples[3]{tier,target_total,essay,word_count,rubric_scores,annotations}, blueprint, provenance }.
학생 화면 필드(`set_intro`=줄 번호 지문, `parts[0].prompt`=과제문, `reference_text`=루브릭+샘플+주석)는 같은 데이터에서 파생된다. **AI 채점**: `lib/essay-grading/payload.ts`가 `lit_frq`를 읽는 어댑터를 추가했다(과제문=parts 프롬프트, 지문=줄 번호 붙은 출처 `Text`, 샘플 3). `rubric.ts`에 `englit` 루브릭(`RUBRIC_ROWS_ENGLIT`)과 버전 `englit-v1`, 주제→루브릭 id 매핑을 추가했고 프롬프트·큐·저장소·결과 화면이 id/버전을 받는다(기본값은 Language 그대로, 기존 테스트 무변경 통과).

## 6. 구성 규칙·배정 (`lib/ap-exam/englit-rules.ts`, `scripts/ap-generation/lt-assign.ts`)
정확 배정은 정수계획(HiGHS) + 별개의 독립 검증기(`verifyLtAssignment`/`verifyEnglitFullComposition`). 가상 칸 없음. 결과는 `data/ap/stock/exact-assign-englit-lt1-lt2.json` 과 아래 §8.

## 7. 사람 검수·위험 (출시 전 필요)
1. 모든 시·산문·희곡 지문의 독창성·문학적 품질·사실(인유한 신화/성서 이야기의 정확성)은 사람이 읽어야 한다. 자동 검토(Sonnet)는 "known text 유사"만 본다.
2. 키 오류: 모델 합의(풀이 2 + 적대 + 심판 + Fable 패널)로 거른 뒤 잔여 오류율은 사람 표본 검수 없이는 확정할 수 없다. Language 선례(검수 뒤 추정 ≈1%)보다 낮다고 주장하지 않는다.
3. Q3 샘플 에세이의 실제 작품 사실 정확성은 모델 채점기 신고에 의존한다(UNVERIFIED).
4. 줄 번호·산문 줄 접기는 56자 폭 가정이다(Bluebook 실제 표시는 UNVERIFIED, facts §3-2).
