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
