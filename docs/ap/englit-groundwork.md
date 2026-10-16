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

## 8. 실행 결과 (2026-10-15, 원장 기준 모델 지출 $11.91 / 상한 $12)

**원장 $172.478 → $184.388**(`ledger-total.ts`, 중단선 $195 여유 $10.61). 단계별: 파일럿 Fable 생성 2건 $1.08(시 1건 max_tokens 잘림 — 이후 Opus 로 전환), Opus 생성 14묶음 $3.2 + 재생성 5묶음·재시도 합쳐 약 $1.3(max_tokens 로 잘린 5건 포함), 풀이·적대·지문 검토·길이 보정 ≈ $1.4, 심판(배치가 100분 넘게 멈춰 취소하고 동기 전환) $0.64, 패널(Fable) ≈ $0.9, FRQ(생성 + 샘플 36편 + 채점 90회 + 재실행) ≈ $3.8. 합계 구성 요소 중 약 $1.3 은 잘려서 쓸 수 없던 생성 결과(낭비)다.

**통과율(최종 = 결정적 게이트 ∧ 풀이 2 전원 일치 ∧ 두 번째 방어 가능 선지 없음 ∧ 적대 strong 아님 ∧ 심판 key_clearly_better ∧ 지문 검토 ok ∧ 패널 일치)**

| 런 | 묶음 | 문항 생성 | 결정적 통과 | 풀이 전원 일치 | 최종 통과 | 묶음 통과(≥8문항) |
|---|---|---|---|---|---|---|
| englit-p0(파일럿) | 2 | 15 | 13 | 13 | 9 | 1/2 (시는 출력 잘림) |
| englit-p1-a | 14 | 198 | 169 | 159 | 133 (67%) | 12/14 (실패 2: 지문 검토 major 1·6문항만 통과 1, 출력 잘림 5건은 재생성 후 포함) |
| englit-p1-c | 1 | 13 | 13 | 13 | 11 | 1/1 |

- 패널(Fable, 선지 순서 변경 맹검)은 새로 물은 문항 **전부 일치**(121/121, 4/4, 2/2, 6/6, 3/3 …). 이는 풀이·적대·심판을 이미 통과한 문항만 패널에 가므로 독립 확인이지 선별 능력의 증거가 아니다. 키 오류 신호: 풀이 2 전원 일치 159/198(80%), 불일치는 대부분 모호한 stem 이었다.
- **길이 단서 해결 확인**(배정된 110문항): 키가 유일하게 가장 긴 선지(글자 수) **19/110 = 17%**(Language 선례 검수 전 84%), 단어 수 기준 12.7%, 키 길이/오답 평균 0.996, 키 위치 27/28/29/26(코드 균등 배치).
- 키 신뢰도(배정 110문항): 평균 0.913, high(≥0.9) 60 / medium 43 / **0.7–0.8 구간 7**(점수 임계를 0.8→0.7 로 낮추고 패널 일치를 요구해 받아들인 문항 — 풀이 전원 일치·심판 clear·적대 strong 아님은 동일, 'likely' 확신도와 weak 대안 때문에 합성 점수만 낮음). `payload.items[].review_notes`에 적대 검토의 key_flaw·stem_issue 가 남아 있다.
- 걸러진 주된 이유: 지문 검토 major(p04: 폐쇄 갑문 비유의 논리 모순)·풀이 불일치·적대/심판 미도달·출력 잘림. 지문 5-gram 유사도 위반 0.

**FRQ**(`lit-frq-1`): 6 프롬프트 전부 통과(시 2·산문 2·논증 2). 샘플 점수는 독립 채점기 3(Opus·Sonnet·Fable)의 행별 중앙값 — high 6/6/6/6/6/6, mid 4/4/4/4/4/4, low 2·3·3 / 2·2·3 (서열 위반 0). 첫 실행은 3건이 코드 게이트(제목 인용을 지문 인용으로 오판·`frost` 일반어를 실존 이름으로 오판)에 막혀 게이트를 고쳤고(`englit-frq.ts`+테스트), 2건은 샘플이 아예 없어(fb1) 재실행, fb3 low 는 채점기가 작품 사실 오류를 보고해 재생성했다.

**조립(정확 배정, 가상 칸 0, 독립 검증기 위반 0, HiGHS optimal)** — `data/ap/stock/exact-assign-englit-lt1-lt2.json`

| | 묶음(문항) | 장르 문항 수 | 7범주 | FRQ |
|---|---|---|---|---|
| LT1 | s01(11) s05(13) p01(13) p03(8) l04(10) | 시 21 / 단편 24 / 장편 10 | 8·4·11·12·6·6·8 | fb1 q1 · fb2 q2 · fb3 q3 |
| LT2 | s02(12) s03(12) p02(10) p05(13) l01(8) | 시 23 / 단편 24 / 장편 8 | 8·4·11·12·6·6·8 | fa1 q1 · fa2 q2 · fa3 q3 |

LT1·LT2 는 후보·문항군이 서로소(테스트 `lt-assign.test.ts`). 예비 재고: 시 p06(13문항), 단편 p0 s00(9). 목표 범주 이탈 합 35(목표 10·2·10·13·6·7·7 대비 4번 범주가 12, 3번이 11).
재고가 빠듯했던 점: 배경(범주 2) 문항 상한이 시험당 2–4개라 묶음당 배경 문항 1개로 제한했고(초과분 제외), 비교(범주 6)가 시험당 5개 이상 필요한데 통과 문항이 12개뿐이라 조합이 거의 유일했다. **다음에 보충한다면**: 시 묶음 1–2개(비교 스킬 6.A–6.D 비중 높게)와 단편 1개를 더 만들면 LT3 이상도 가능하다.

**화면 증거**(격리 스택 `ALTON_englit`, 포트 +300 — 기본 래퍼의 +100 은 다른 세션 `ALTON_apush` 가 사용 중이라 수동 이동, dev 서버 3111): 후보 20개(묶음 14 + FRQ 6) × 390×844·1280×800 = **310항목 fail 0**(`data/ap/screen-evidence/evidence-lt.json`, 스크린샷 `docs/ap/screen-evidence/lt/`). 이 과정에서 두 가지를 고쳤다: ① DB 변환 게이트(`passageRequiresFigure`)가 문학 지문의 "the figure of …"를 그림 지시로 오판 → `ALTON original passage` 표지가 있는 지문은 제외(`lib/problem-figures/check.ts`+테스트), ② 화면 증거 검사기의 "correct answer" 누출 검사가 지문 속 같은 구절에 걸림 → 줄 번호 지문 블록 제외. 스택은 `isolated-stack.sh stop`(컨테이너 0), `supabase/config.toml` 원복, 시드 `cleanup`, 개발 서버 종료, 임시 비밀번호·키 파일 삭제.

**배치 등록**: `lib/ap-admin/batches.ts` 에 `lt-p0, lt-p1a, lt-p1b, lt-p1c`(증거 `evidence-lt.json`). **원격 DB 쓰기 없음, 적재하지 않았다.**

## 9. 남은 위험 / UNVERIFIED
- 사람 검수 없음(§7). 지문 자동 검토는 모델 하나(Sonnet)다.
- 줄 번호는 56자 폭 접기 가정(Bluebook 표시 UNVERIFIED). 시 줄 번호는 모델이 낸 줄바꿈 그대로.
- 지문 머리말이 "contemporary poet …"처럼 가공 저자를 실제 시인처럼 소개한다(상단 `ALTON original passage` 표지로 가공임을 밝힘). 사람 검토에서 문구를 중립화할지 정해야 한다.
- 모든 FRQ 샘플의 인용·작품 사실을 사람이 읽지 않았다(Q3 샘플의 실제 작품 사실은 채점기 신고에만 의존).
- 7문항은 합성 점수 0.7–0.8(위 설명). 보수적으로 쓰려면 해당 문항(`key_confidence.score < 0.8`)을 교체 후보로 빼면 된다.
- 이 세션의 에세이 채점 flag(`AI_ESSAY_GRADING_ENABLED`)는 건드리지 않았다. `englit` 루브릭은 코드·테스트만 있고 프로덕션 점수 행은 만들어지지 않았다.

## 반응형 줄 번호 (2026-10-15, 산문 390px 쟁점 해결)

- **문제**: 산문은 저장 시 코드가 56자로 접는다(`PROSE_WRAP_WIDTH`). 휴대폰 칸(326px)에서는 그 줄이 다시 접혀 5줄 번호 간격이 6~10행으로 보였다.
- **방식(DB·저장 내용 변경 없음)**: `lib/ap-exam/passage-layout.ts` 가 펜스의 접힌 줄을 문단(단어 배열)으로 복원한다(`isWrappedProse`: 첫 줄 4칸 들여쓰기·나머지 무들여쓰기·≤56자·마지막 줄 외 ≥36자. 시 원문 줄은 해당 없음 → 기존 표시 그대로). `PassageBlock`(LearningText.tsx)은 마운트 후 문단을 브라우저가 자연스럽게 접게 두고, 단어별 `Range` 좌표로 실제 화면 행을 읽어 **세는 행 5개마다** 번호를 번호 열(absolute, aria-hidden, select-none)에 문단 상단+행×줄높이 위치로 붙인다. `ResizeObserver`(분할 화면 폭 변화)·`document.fonts.ready` 에서 다시 측정한다. 복사하면 자연스러운 문장이 나온다(행마다 줄바꿈 없음).
- **측정 전/불가**: 서버 렌더·hydration 첫 렌더·`Range.getClientRects` 없음(jsdom)·측정 실패 시 기존 56자 줄 표시(`LegacyPassage`)를 그대로 쓴다 → hydration 불일치 없음, `useLayoutEffect` 로 첫 페인트 전에 전환(클라이언트 렌더 시 깜빡임 없음; SSR HTML 은 hydration 전까지 옛 표시).
- **줄 참조**: 저장된 문항·해설에는 `(lines 7-9)`, `line 15` 같은 리터럴이 56자 줄 번호로 들어 있다(공개본 LT: 문항 106/153건). 지문을 그리는 쪽이 `PassageRefsScope`(app/components/PassageRefs.tsx)에 '옛 줄 → 화면 번호' 표를 등록하고, `LearningText` 의 모든 글 조각이 `rewriteLineRefs` 로 바꿔 그린다. 앵커는 **옛 줄의 첫 단어/끝 단어가 놓인 화면 행**이라 인용 구절을 항상 덮는다(범위가 한 행이면 `line N`, 둘 이상이면 `lines a-b`; `lines 7 and 9`·`3, 5-6`·en dash 도 처리, 범위 밖 번호·`baseline 2` 같은 단어는 그대로). 시는 옛 줄=원문 줄이라 변경 없음. 새 실제 산문(등록부)도 같은 `wrapParagraph` 저장이라 같은 경로로 동작한다. 적용 범위: ApExamTakeClient·ApExamResultView(문항 카드마다 scope). 지문 하나일 때만 다시 쓴다.
- **검증**: `lib/ap-exam/passage-layout.test.ts`, `app/session/[id]/LearningText.passage-live.test.tsx`(가짜 Range 로 번호·접근성·참조·폴백) + Chromium 측정 `npx tsx scripts/ap-generation/englit-live-layout.ts` → `docs/ap/englit-layout/live-layout.json`·`live-*-{before,after,resize}.png`.
  - 390px(칸 358): 이전 번호 간격 6~10행·번호≠화면 행(Chopin 113행/70줄, Chekhov 112/74, Crane 84/55, Ibsen 92/62). 이후 **간격 항상 5행, 번호=화면 행, 문항 참조=인용 줄의 화면 범위 일치(4개 작품 ×3 참조 전부 true)**. 768·1280 도 같음(1280 은 Chopin 70→46행). 분할 화면 576→358 폭 변경 후에도 true.
- **잔여 위험**: 시의 긴 줄은 좁은 화면에서 접히되 번호는 원문 줄 기준(의도, 시 관행; 휴대폰 Whitman 16행/10줄). 산문 감지는 모양 휴리스틱(드문 시 연이 4칸 들여쓴 56자 이하 줄 묶음이면 산문으로 오인 가능). 다른 화면(관리자 뷰어·ProblemsPanel)은 scope 가 없어 리터럴 번호 그대로. SSR 직후 hydration 전 잠깐 옛 표시. 줄 높이 23.8px 가정(번호 위치).
## 10. Stage 1 — 게시 LT1·LT2 의 가공 지문 3칸을 실제 공유 영역 작품으로 교체 (2026-10-15, 브랜치 `englit-real-2`, DB 쓰기 없음)
정책: `docs/POLICY-DECISIONS.md` 2026-10-15(재사용 권리가 확인된 실제 작품 · 지문 먼저 → 스킬·문항·키·오답 근거 · 기존 ALTON 작성 지문은 그대로 두고 "ALTON original passage" 표지로 구분(실제 시험의 대표가 아님) · 일괄 재생성 없음 · 단계별 소규모 교체 · 미해결 문항 제외). 1단계 산출물(`docs/ap/englit-material-audit.md`, `data/ap/englit-sources/`)에서 가져와 **3칸만** 교체한다.

| 시험·칸 | 현재(ALTON 작성) | 교체(`lt-real-1:…`) | 출처 |
|---|---|---|---|
| LT1 MC 시 세트 `p03`(8문항) | The Bench in Vrana Square(가공) | `real-rs1-k0` — Dickinson "The Chariot"(20줄 전문, 8문항) | Poems by Emily Dickinson, ed. Todd & Higginson (1890), Gutenberg #12242 |
| LT1 FRQ Q1(ap_frq #1) `fb1` | 가공 시 | `real-rf1-k0` — Hopkins "God's Grandeur"(14줄 소네트 전문, 약 125단어) | Poems of G. M. Hopkins, ed. Bridges (1918), Gutenberg #22403 |
| LT2 FRQ Q2(ap_frq #2) `fa2` | 가공 산문 | `real-rf2-k0` — Chekhov "The Lady with the Dog"(I장 도입 발췌, 8문단 689단어) | trans. Constance Garnett (1917), Gutenberg #13415 |

- **지문 길이**: Chekhov 발췌 689단어는 공식 산문 FRQ 범위(약 600–800단어, `englit-facts.md` §추정 가정)에 들어 경계 확장이 필요 없었다(그대로 원문). Hopkins 125단어는 시 FRQ 범위(100–400). 지문 텍스트는 레지스트리 저장본과 글자 그대로 같다(테스트가 `stanzas` 를 등록부에서 다시 만들어 비교).
- **출처 표기**: 지문 첫 줄이 `Public-domain source text — <저자>, <작품>, <판본>`(예: "…— Emily Dickinson, The Chariot ("Because I could not stop for Death"), Poems by Emily Dickinson, ed. Mabel Loomis Todd and T. W. Higginson (Series One, 1890)"). `realAttribution()`(`lib/ap-generation/englit-real.ts`)이 만들고, `stimulus-display.ts` 의 `startsWithRealTextMarker`/`isEnglishPassage`·`problem-figures/check.ts` 가 이 형태를 영어 원문 지문으로 인식한다(표지 단독 줄 `Public-domain source text\n` 도 계속 인식). 문항 payload 에는 `provenance`(저장소·URL·재사용 근거·텍스트 sha256·변형 기록)와 `sourceRegistryIds`·`stimulusOrigin: real_public_domain_text`·`replaces` 가 남는다.
- **줄 번호**: 시의 번호는 **원문 줄**에 붙고(5줄마다), 들여쓰기 줄은 걸어 접기(hanging indent) 수정이 반영된 `PassageBlock` 으로 그려진다(스크린샷 `docs/ap/screen-evidence/lt-real-1/`).

### 10-1. 검증
- **구성 규칙**(독립 검증기 `verifyLtAssignment`·`verifyEnglitFullComposition`): LT1·LT2 교체 뒤 위반 **0**(MC 55·FRQ 3, 묶음 5개 8–13문항, 장르 문항 수, 범주 1–7 범위, 시 ≥2·산문 ≥2 묶음, FRQ 유형 q1/q2/q3 각 1, LT1/LT2 후보·문항군 서로소). p03 → rs1 교체는 문항 수(8)·장르(시) 같아 구조 불변이고 범주만 바뀐다: LT1 범주(1…7) **8/4/11/12/6/6/8 → 9/3/10/13/7/5/8**(허용 8–11/1–4/8–11/11–15/5–8/5–8/5–8 안; 범주 6 이 하한 5). 그래서 문항을 고르거나 다시 쓰지 않아도 균형이 유지된다. LT2 는 MC 불변(FRQ 만 교체).
- **실제 새 버전 검사 재생**(`lib/ap-admin/lt-real-1-plans.test.ts`): 2026-10-15 `supabase db query --linked` **SELECT 전용** 스냅샷(`data/ap/stock/lt1-lt2-published-v1-slots.json` — 게시 LT1·LT2 **둘 다 v1**, 58칸씩 + 후보 메타 16건)으로 `parseSwapPlan → resolveSwaps → checkNewVersionComposition`(관리자 미리보기와 같은 경로·`fullPracticeUnitBounds('ap_english_literature','full_practice')`·문항군 상한·교체 후보 완전성·다른 시험 겹침)을 돌려 위반 0. 문학에는 단원 상·하한이 **정의돼 있지 않다**(`fullPracticeUnitBounds` 가 undefined) — US History 때의 단원 불일치 문제는 해당 없음. 새 버전 후보 단원은 keyword_code 단원(U5.3→5, U9.4→9)이다.
- **MC 8문항(rs1)**: 1차(1단계) 전 단계 통과 8/10(탈락 2: 풀이자 둘째 선택지 신고) → **재검증**(같은 파이프라인 `englit-real-pipeline.ts` 재실행, `REAL_RUN=englit-real-2`, 엄격 임계 0.8): 5문항 그대로 통과, 2문항(1.E·5.B)은 점수 0.788(두 풀이자 모두 'likely'+적대 'weak' 로 0.012 모자람; 4표·심판·사후 Fable 패널 모두 키와 일치 → 유지), **1문항(4.A "speaker's situation")은 풀이자의 '둘째 방어 가능 선택지' 신고로 탈락 → 같은 텍스트에서 새로 생성**(`englit-real-3`, 2문항 생성 → 1문항이 코드 게이트·블라인드 풀이 2·적대·심판·Fable 패널 전부 통과, 5.A) **해 같은 자리(7번째)에 교체**. 최종 8문항 스킬 6.C·1.E·4.C·4.D·3.C·5.B·5.A·7.B, 키 위치 0·2·3·1·2·1·2·0(균형 게이트 통과). 설정(범주 2) 문항 없음. 제외된 3문항(1단계 탈락 2 + 재검증 탈락 1)은 `payload.excluded_items` 에 사유와 함께 남고 학생에게 보이지 않는다.
- **FRQ 샘플 6개**(Q1 3·Q2 3): 1단계에서 독립 채점기 2종(Opus·Sonnet)의 합의로 뽑은 6/4/2 샘플을 **운영 채점 경로 `processEssay`**(루브릭 `englit-v1`, 2회 실행 후 낮은 쪽, 샘플 leave-one-out 앵커; `scripts/essay-calibration.ts` `CALIB_SUBJECT=lit CALIB_FILES=lt-real-1`, `AI_ESSAY_GRADING_ENABLED` 는 이 프로세스에서만)로 재채점: rf1 **6/4/2 = 의도와 정확히 일치**, rf2 **6/4/3**(low 샘플 +1; 서열 6>4>3 유지, 모두 `done`, disagreement 없음). MAE 0.167. 결과 `data/ap/sample-2027/englit-real-2/frq-processessay.json`, 요약 `lt-real-1-summary.json`.
- **화면 증거**(격리 스택 `ALTON_ltreal1`, 포트 +100, dev 서버 3111): 후보 3개 × 390×844·1280×800 = **20항목 fail 0**(보기 가시·잘림 없음·정답/해설 비노출·원문 수식 없음 전부 pass, FRQ 입력 4 pass). `data/ap/screen-evidence/evidence-lt-real-1.json`, 스크린샷 `docs/ap/screen-evidence/lt-real-1/`. 종료 후 시드 정리·`isolated-stack.sh stop`(컨테이너 0)·`config.toml` 원복·임시 비밀번호/키 파일 삭제.
- **렌더 보고서**: `render-check.ts` 재생성, 보고서(`report.json/md`)에 신규 3행(`not_applicable`)만 반영.
- **모델 지출**(원장): 재검증 MC $0.15+0.03(경계 패널)+0.22(교체 생성·검증)·processEssay $0.33 = **약 $0.76**(누적 $214.59 → $215.35, 중단선 $235 이내).

### 10-2. 배치·계획·재현
- **배치** `lt-real-1`(`lib/ap-admin/batches.ts`, `lt-real-1-2026-10-15`, 보조 적재, 증거 `evidence-lt-real-1.json`): 파일 `data/ap/stock/lt-real-1-{items,pass-keys,summary}.json`(생성기 `scripts/ap-generation/englit-real-stage1-build.ts`). `keys-file`·`render-check`·`supp-batches` 는 `lt-*-items.json` 규칙(`ltItemNames`)으로 자동 인식.
- **새 버전 계획**: `data/ap/stock/lt1-v2-real-1-swap-plan.json`(9칸: ap_mc #(p03 의 첫 칸부터 8칸) + ap_frq #1) · `lt2-v2-real-1-swap-plan.json`(1칸: ap_frq #2). 생성기 `scripts/ap-generation/lt-real-1-plans.ts [--write]`. 원본 버전 = 현재 게시본(v1). FRQ 교체는 같은 FRQ 유형 칸 안(q1↔q1, q2↔q2).
- **관리자 작업 순서**(DB 쓰기는 전부 관리자 화면, 이 브랜치는 쓰지 않았다):
  1. 이 브랜치를 통합 브랜치에 병합·배포(배치 파일·증거·계획이 번들에 실려야 한다).
  2. 관리자 → Mock Exams → AP 재고 관리 → **배치 전체 적재**: 배치 **`lt-real-1`**(3키) → 미리보기 → "확인했습니다" → 실행(① 적재 ② 렌더 기록 ③ 화면 기록 ④ 문제은행 변환). **건너뜀 허용은 켜지 않는다(엄격 모드)** — 3키 모두 렌더 보고서·화면 증거(해시 일치)가 있다. 건너뜀·"검증 미완료"가 보이면 진행하지 말고 원인(증거 해시 불일치 = 배포본 payload 가 다름)부터 해결. 적재 뒤 현황 표에서 `lt-real-1` 3/3 변환·`review_env_ready` 확인.
  3. **새 버전 — `AP English Literature — Practice Exam 1`**: 계획 `lt1-v2-real-1-swap-plan.json`(교체 9칸 = MC 시 세트 `p03` 8칸 → rs1, FRQ Q1 `fb1` → rf1) → 미리보기(위반 0 기대) → 확인 → 초안 v2 → 초안 확인(시 세트 8문항이 같은 위치·FRQ Q1 이 Hopkins) → **'새 버전 공개'**.
  4. **새 버전 — `AP English Literature — Practice Exam 2`**: 계획 `lt2-v2-real-1-swap-plan.json`(FRQ Q2 `fa2` → rf2) 동일 절차. 3·4 는 서로 독립.
  5. 공개 뒤 학생 화면에서 Dickinson 세트·두 FRQ 지문을 한 번씩 연다(머리말 출처 줄·줄 번호·정답/해설 비노출).

### 10-3. Stage 1 의 한계·UNVERIFIED
- 사실·해석 정확성은 LLM 검사(Opus·Sonnet 블라인드 풀이, 적대, 심판, Fable 패널, 채점기 2종)로 보증한 것이며 **영문학 교사 검수가 아니다**. 재검증에서 같은 파이프라인이 문항 3개에 다른 결과를 낸 점(점수 경계 2, 둘째 선택지 신고 1)은 이 검증의 분산을 보여 준다.
- 경계 2문항(1.E·5.B)은 엄격 임계(0.8) 아래 0.788 이지만 모든 표·판정이 키와 일치해 유지했다. 더 보수적으로 가려면 해당 문항을 빼고 같은 텍스트에서 추가 생성해야 한다(8문항 크기 유지 필요).
- Dickinson 판본은 1890년 편집본(Todd·Higginson)이며 이후 원고 기반 텍스트(Johnson)와 어휘·구두점이 다르다(출처 줄에 판본을 밝힘). Hopkins 는 Bridges 1918 초판 줄 접힘 3곳을 레지스트리 `modifications` 에 기록한 대로 원 줄로 복원했다.
- 샘플 에세이 점수는 모델 채점기 결과이며 공식 College Board 채점과의 일치는 검증하지 않았다. rf2 low 샘플은 운영 채점기가 3점(의도 2)을 준다 — 서열은 유지.
- 이 브랜치는 `AI_ESSAY_GRADING_ENABLED` 를 건드리지 않았고(보정 프로세스 env 만), DB 적재·새 버전 공개를 실행하지 않았다.

## 11. Stage 2 — 시 13문항 세트(Arnold)·희곡 8문항 세트(Ibsen)·단편 13문항 세트(Chopin)·장편 10문항 세트(Austen)·FRQ Q2(Crane) (2026-10-15, 브랜치 `englit-real-3`, DB 쓰기 없음)
정책은 Stage 1 과 같다(`docs/POLICY-DECISIONS.md` 2026-10-15: 재사용 권리가 확인된 실제 작품 · 지문 먼저 → 스킬·문항·키·오답 근거 · 기존 ALTON 지문은 'ALTON original passage' 표지로 보존 · 일괄 재생성 없음 · 미해결 문항 제외). 현대(1929 이후) 작품은 오너 결정대로 라이선스를 추구하지 않고 ALTON 작성 현대 지문을 표지와 함께 유지한다.

| 시험·칸 | 현재(ALTON 작성) | 교체(`lt-real-2:…`) | 출처 |
|---|---|---|---|
| LT2 MC 시 세트 `p05`(13문항) | "Accession 4471-B" | `real-ls5` — Arnold "Dover Beach"(37줄 전문, 13문항) | Poems by Matthew Arnold, New and Complete Edition (Crowell), Gutenberg #54985 — 시 1867 |
| LT2 MC 희곡 세트 `l01`(8문항) | "The Kitchen Room" | `real-ll1` — Ibsen *A Doll's House* 3막 대화 21대사(538단어, 8문항) | trans. R. Farquharson Sharp (Everyman 1910), Gutenberg #2542 |
| LT1 MC 단편 세트 `s05`(13문항) | "The Danner Account" | `real-ls3` — Chopin "A Pair of Silk Stockings" 문단 1–13(965단어, 13문항) | Gutenberg #160 (Vogue 1897) |
| LT1 MC 장편 세트 `l04`(10문항) | "Breakfast Is at Seven" | `real-ll4` — Austen *Persuasion* 1장 문단 1–10(926단어, 10문항) | Gutenberg #105 (1818 표기, 판본 연도는 파일에 없음: UNVERIFIED) |
| LT1 FRQ Q2(ap_frq #2) `fb2` | 가공 산문(1953 manner) | `real-rf3` — Crane "The Open Boat" I장 문단 1–10(677단어) | Heinemann 1898 print, Gutenberg #45524 |

### 11-1. 출처 등록부 추가(빌더 `scripts/ap-generation/englit-sources-build-stage2.ts`, 기존 8항목 불변·4항목 추가)
- `arnold-dover-beach`(37줄·258단어): 원문 줄 7802–7842. **변경 기록**: 저장소 판은 첫 연을 5+9줄 두 덩어리로 인쇄했는데, 시의 표준 4연 구조(14/6/8/9)에 맞게 한 연(14줄)으로 합쳤다(줄 추가·삭제·순서 변경 없음 — 등록부 `modifications` 에 기록). 판본 인쇄 연도는 파일에 없다(UNVERIFIED), 시 자체는 1867 발행.
- `chopin-silk-stockings-long`: Stage 1 의 `chopin-silk-stockings`(문단 1–7, 640단어)를 **문단 13까지 글자 그대로 연장**(965단어; 테스트가 앞부분 일치를 고정). `crane-open-boat-q2`: 기존 `crane-open-boat`(문단 1–9, 531단어 — Q2 범위 600–800 미달)를 **문단 10까지 연장**(677단어, 범위 안; 앞 9문단 동일).
- `austen-persuasion-ch1`: 신규 장편 발췌. `SourceGenre` 에 `long_fiction` 추가 → `groupOfEntry` = `longer`(장편·희곡 묶음), 머리말 "passage from a novel". 장편(Persuasion)은 도입 1장 발췌(문단 2·3·6 의 준남작 명부 인용 포함).
- 원문 다운로드(gutenberg.org plain text, 스크래치패드 별도 폴더, 실행 안 함): pg54985.txt 531,357 B · pg105.txt 497,555 B · pg160.txt 392,860 B(Stage 1 과 동일 sha) · pg45524.txt 398,135 B(동일 sha). Dover Beach 판본 탐색은 gutenberg.org 검색 결과 HTML 2쪽을 읽기만 했다.
- **저장·화면 경로**: 산문·희곡은 `realStanzas`→`proseStanzas`(56자 접힘 줄 저장, 레거시 감지기 경로)로 저장돼 **기존 ALTON 산문 지문과 같은 반응형 번호 경로**를 탄다. 시는 줄 단위 저장 + 걸어 접기. 스크린샷(`docs/ap/screen-evidence/lt-real-2/`)에서 확인: 390px Dover Beach 줄 번호(5·10)가 원문 줄에 붙고 접힌 이어지는 행이 들여써진다(10행 "fling,"), Chopin·Ibsen 산문/희곡은 문단 들여쓰기 + 번호가 화면 행 기준 5행마다.

### 11-2. 생성·검증(파이프라인 `englit-real-pipeline.ts` 재사용, 실행 `data/ap/sample-2027/englit-real-4/`)
- 지문은 등록부 코드 고정 → 모델이 text_map·스킬·문항·근거 작성. 생성 66문항(1차 4세트 47 + 보충 3세트 19; 보충은 **세트 이어쓰기**(`avoidFrom`, 겹치지 않는 각도) + 슬롯 구성에 필요한 스킬 강조 `focus`)·**통과 54·제외 12**(블라인드 풀이 2종(Opus 5.5·Sonnet 5.5, 선지 순서 상이) 전원 일치 → 적대 → 심판 → **Fable 5.1 패널** 일치 54/54, 근거 규칙(키 인용 + 오답 ≥ 2 반박 인용), 키 신뢰도 ≥ 0.8).
- 제외 12건(`lt-real-2-summary.json` unresolved): 신뢰도 0.8 미달 8(적대 'weak'·'likely' 풀이로 0.788 등), '둘째 방어 가능 선지' 신고 3(ls5x 3.B·ll4 7.D·ll4x 3.E), 코드 게이트+단계 누락 1(ll1 6.B). 지문에 맞지 않는 스킬은 강제하지 않았다.
- **슬롯 선택(코드)**: 통과 문항이 슬롯 크기보다 많으면 `englit-real-stage2-build.ts` 가 시험 전체 범주 구성이 상·하한 안인 부분집합 조합을 전수 탐색(LT1 7,783,776 조합)해 공식 목표(10/2/10/13/6/7/7)에 가깝고 **키가 가장 긴 선지가 아닌** 문항을 고른다(키 위치 균형·세트당 설정(범주 2) ≤1 제약). 미선택 검증 통과 10문항은 `payload.surplus_items` 에 기록(화면에 안 나온다). 결과 문항 수: Arnold 13(통과 14), Ibsen 8(통과 8), Chopin 13(18), Austen 10(14). 정답이 가장 긴 선지인 문항 0(길이 단서 규칙 `lengthCueRatio` < 1.12 도 전 문항 통과, 테스트 고정).
- **FRQ(rf3) 샘플 3개**: 과제문·루브릭 지침을 지문 확정 후 설계, 샘플은 독립 채점기 2종(Opus·Sonnet) 합의, **운영 `processEssay` 경로**(`CALIB_SUBJECT=lit CALIB_FILES=lt-real-2 CALIB_CELLS=rf3`, 루브릭 `englit-v1`, 2회 후 낮은 쪽, leave-one-out 앵커)로 재채점: **6/4/2 = 의도와 정확히 일치**(MAE 0, 서열 유지, 모두 `done`). 결과 `data/ap/sample-2027/englit-real-4/frq-processessay.json`·`lt-real-2-summary.json`.
- 한계: 모든 검증은 LLM 이며 영문학 교사 검수가 아니다. 샘플 에세이 점수는 모델 채점기이며 공식 College Board 채점과의 일치는 검증하지 않았다. 문항 전체에 `expertStatus: unreviewed`.

### 11-3. 구성 검증과 실제 새 버전 검사 재생
- **원본 버전**: 2026-10-15 `supabase db query --linked` **SELECT 전용** 조회에서 게시 LT1·LT2 는 **둘 다 v1 published**(Stage 1 은 아직 공개 전)였다. 그래서 원본 = **게시 v1 + Stage 1 계획 적용 = Stage 1 공개 뒤의 v2** 로 모델링했고, Stage 2 계획은 `sourceVersionNo: 2`(v2 → v3)다. Stage 1 이 먼저 공개되지 않으면 미리보기가 source version 불일치를 알린다 — 먼저 Stage 1 을 공개한다. 계획의 교체 칸(s05·l04·fb2·p05·l01)은 Stage 1 이 건드리지 않은 칸이라 두 계획은 서로 독립이다.
- **검증기**(`verifyLtAssignment`·`verifyEnglitFullComposition`): Stage 1+2 모두 적용한 LT1·LT2 위반 **0**. LT1 범주(1…7) Stage 1 뒤 9/3/10/13/7/**5**/8 → Stage 2 뒤 **10/3/10/13/7/7/5**(허용 8–11/1–4/8–11/11–15/5–8/5–8/5–8 — 범주 6 은 5→7 로 여유, 범주 7 이 하한 5 가 됐다). LT2 8/4/11/12/6/6/8 → 8/3/10/12/7/7/8. 장르 묶음·세트 크기 불변(LT1 단편 24·시 21·장편 10, LT2 단편 24·시 23·장편 8), LT1/LT2 후보·문항군 서로소.
- **재생 테스트** `lib/ap-admin/lt-real-2-plans.test.ts`(11): 관리자 새 버전 미리보기와 같은 경로(`parseSwapPlan → resolveSwaps → checkNewVersionComposition`, `fullPracticeUnitBounds`, 문항군·교체 후보 완전성·다른 시험 겹침·세트 크기)로 LT1 24칸(MC 23 + FRQ 1)·LT2 21칸 교체가 위반 0, 교체 뒤 검증기·범주 상·하한·LT1 범주 6 ≥ 5, 배치 등록, 지문 = 등록부 글자 그대로(시 ≥ 30줄·Crane 600–800단어·앞 발췌 연장 일치), 근거 위치 재계산, 키 균형·길이 단서·검증 기록, processEssay 서열.
- 렌더 보고서 `render-check.ts` 재생성(`report.json/md` 만 변경, 신규 5행 `not_applicable`). 화면 증거(격리 스택 `ALTON_ltreal2`, `PORT_OFFSET=300`(래퍼에 옵션 추가: 다른 격리 스택 `ALTON_apsych2` 와 포트가 겹쳐서), dev 서버 3111): 후보 5개 × 390×844·1280×800 = **90항목 fail 0**(보기 가시·잘림 없음·정답/해설 비노출·원문 수식 없음 전부 pass, FRQ 입력 2 pass). `data/ap/screen-evidence/evidence-lt-real-2.json`, 스크린샷 `docs/ap/screen-evidence/lt-real-2/`. 종료 후 시드 정리·`isolated-stack.sh stop`(컨테이너 0)·`config.toml` 원복·임시 키 파일 삭제·dev 서버(PID 지정 종료).

### 11-4. 배치·계획·재현·관리자 작업 순서
- **배치** `lt-real-2`(`lib/ap-admin/batches.ts`, `lt-real-2-2026-10-15`, 보조 적재, 증거 `evidence-lt-real-2.json`): `data/ap/stock/lt-real-2-{items,pass-keys,summary}.json`(생성기 `englit-real-stage2-build.ts [--write]`).
- **새 버전 계획**: `data/ap/stock/lt1-v3-real-2-swap-plan.json`(24칸 = MC 단편 세트 `s05` 13칸 → `real-ls3`, MC 장편 세트 `l04` 10칸 → `real-ll4`, FRQ Q2 `fb2` → `real-rf3`)·`lt2-v3-real-2-swap-plan.json`(21칸 = MC 시 세트 `p05` 13칸 → `real-ls5`, MC 희곡 세트 `l01` 8칸 → `real-ll1`). 생성기 `scripts/ap-generation/lt-real-2-plans.ts [--write]`.
- **관리자 작업 순서**(DB 쓰기는 전부 관리자 화면 — 이 브랜치는 쓰지 않았다):
  1. (Stage 1 이 공개돼 LT1·LT2 가 v2 인지 확인한다. 아니면 Stage 1 을 먼저 공개한다.) 이 브랜치를 통합 브랜치에 병합·배포(배치 파일·증거·계획·스크린샷이 번들에 실려야 한다).
  2. 관리자 → Mock Exams → AP 재고 관리 → **배치 전체 적재**: 배치 **`lt-real-2`**(5키) → 미리보기 → "확인했습니다" → 실행(① 적재 ② 렌더 기록 ③ 화면 기록 ④ 문제은행 변환). **건너뜀 허용은 켜지 않는다(엄격 모드)** — 5키 모두 렌더 보고서·화면 증거(해시 일치)가 있다. 건너뜀·"검증 미완료"가 보이면 진행하지 말고 원인(증거 해시 불일치 = 배포본 payload 가 다름)부터 해결. 적재 뒤 현황 표에서 `lt-real-2` 5/5 변환·`review_env_ready` 확인.
  3. **새 버전 — `AP English Literature — Practice Exam 1`**: 계획 `lt1-v3-real-2-swap-plan.json`(교체 24칸) → 미리보기(위반 0 기대, source version 2) → 확인 → 초안 v3 → 초안 확인(MC 단편 세트 13·장편 세트 10문항이 같은 위치, FRQ Q2 가 Crane) → **'새 버전 공개'**.
  4. **새 버전 — `AP English Literature — Practice Exam 2`**: 계획 `lt2-v3-real-2-swap-plan.json`(교체 21칸) 동일 절차(시 세트 13문항 Arnold·희곡 세트 8문항 Ibsen). 3·4 는 서로 독립.
  5. 공개 뒤 학생 화면에서 Dover Beach(줄 번호)·Ibsen·Chopin·Austen 세트와 Crane FRQ 를 한 번씩 연다(머리말 출처 줄·정답/해설 비노출).

### 11-5. Stage 2 의 한계·UNVERIFIED 와 남은 슬롯
- 사실·해석 정확성은 LLM 검사(블라인드 풀이 2·적대·심판·Fable 패널·채점기 2종)로 보증한 것이며 영문학 교사 검수가 아니다. 문항 54개 중 일부는 점수 경계(0.83–0.87) 근처이며 모두 키와 일치하는 표만 통과했다.
- Dover Beach·Persuasion 의 인쇄 판본 연도는 저장소 파일에 없다(UNVERIFIED). Persuasion 연도 1818 은 파일 표기, 최초 발행은 1817 년 12월(1818 표기)로 알려져 있어 등록부에 병기했다. Ibsen·Chekhov 는 번역본(발행 1910·1917)이다.
- **시기 균형**: Stage 2 후에도 1929 이후 텍스트는 ALTON 작성 현대 지문(라벨 보존)이 맡는다. 실제 작품화한 칸은 Stage 1+2 로 LT1 시 1·단편 1·장편 1·FRQ 2, LT2 시 1·희곡 1·FRQ 1 이고(전부 1929 이전), 남은 ALTON 지문: LT1 s01·p01 + LT1 FRQ Q3(작품 목록), LT2 s02·s03·p02 + FRQ Q1(fa1)·Q3(fa3 작품 목록). 현대 슬롯 라이선스 추구는 하지 않는다(오너 결정).
- 번역 지문(Chekhov·Ibsen)은 공식 CED 가 번역을 허용하나 비율은 확인하지 않았다(UNVERIFIED).
- 모델 지출(원장): 1차 4세트 생성 $0.95 + 검증(풀이·적대·심판·패널) $1.07 + 보충 3세트 생성·검증 $1.35 + FRQ(과제·샘플·채점) $0.66 + processEssay $0.17 = **이번 라운드 $4.20**(원장 $219.13 → **$223.33**, 상한 $8·누적 $262 이내). 배치 큐가 50분 이상 지연돼 `solve` 배치를 취소(미처리 요청은 청구 없음)하고 이후 단계는 동기 실행(단가 2배)으로 돌렸다.
