# Reading & Writing 구조화 자료 블록 — 기존 11개 유형 적용 확인·보완 (2026-09-14)

제품 오너 지시(SAT Math 마무리 뒤): 새 유형은 추가하지 않고, 기존 11개 RW 유형이 실제 시험처럼 **구조화된 자료 블록**으로
렌더·검증되는지 확인하고 보완한다. Math 와 같은 블록/게이트 체계(`render_check` → 공개 게이트 → 학생 화면)를 그대로 쓴다.

## 설계 요지

- **AI 는 글만 낸다.** 지문(`passage`)은 그대로 한 컬럼이다. ALTON 이 저장 시점에 지문을 블록으로 **해석**하고(`lib/rw-stimulus.ts`
  `parseRwStimulus`), 세부 기술 코드에 맞는 구조인지 **검증**해(`checkRwStructure`) `render_check` 에 싣는다. 통과하지 못하면
  `confirm_and_publish_problem_version` 게이트가 막는다(DB 변경 없음 — 기존 게이트가 `render_check.ok` 를 본다).
- **레거시 유지.** `passage` 컬럼·마크다운 표·기존 공개본은 그대로 읽힌다. 세부 기술 코드가 없는 옛 문제는 의미를 확정할 수 없으므로
  RW 검사를 하지 않는다(자동 분류 금지 원칙). 새로 저장하는 문제만 검사한다.
- **렌더.** 학생·교사 수업 화면(`ProblemsPanel`)과 관리자 미리보기(`ProblemBankTab`)가 같은 `RwStimulusView` 를 쓴다.
  구조가 하나도 없으면 기존 `LearningText` 와 완전히 같다.

## 인식하는 블록

| 블록 | 지문 표기 | 렌더 | 검증 |
|---|---|---|---|
| Text 1 / Text 2 | `Text 1` / `Text 2` 제목 줄(한 줄, 다른 글자 없음) | 제목이 있는 두 구역(`rw-text-1`, `rw-text-2`) | Cross-Text 만: 둘 다 순서대로, 각 20단어 이상, 질문이 Text 1/2·both texts 를 가리킨다. 다른 유형에 Text 구조가 있으면 거부(`rw_texts`) |
| 메모 목록 + 목표 | `…the following notes:` 줄 + `- ` 항목 | 소개 줄 + 불릿 목록(`rw-notes`) | Rhetorical Synthesis 만: 메모 3~6개, 질문에 `The student wants to …` 와 `notes` 참조(`rw_notes`) |
| 빈칸 | `______` | 밑줄 칸(`rw-blank`) | WiC·Inferences·Boundaries·Form/Structure·Transitions: **정확히 하나**, 질문이 표준 문구로 빈칸을 가리킴(`rw_target`/`rw_question`). WiC 인용형(`"word"`)은 빈칸 없이 그 단어가 지문에 있어야 함. 근거 문항(Quant/Text)은 문장 끝 빈칸 하나까지 허용. 그 외 유형은 빈칸 금지. 선택지 안 빈칸 금지 |
| 밑줄 | `__문장__` | 밑줄 | Text Structure and Purpose 의 `underlined` 문항만: 정확히 하나. 질문이 underlined 를 안 가리키면 밑줄 금지. 다른 유형의 밑줄 거부 |
| 질문 | 마지막 단락(물음표 끝 또는 SAT 문항 말투) | 본문과 나눈 굵은 단락(`rw-question`) | 모든 RW 유형: 질문 인식 필수(`rw_question`), 선택지 4개(`rw_options`). 본문과 질문 사이 빈 줄이 빠져도 마지막 질문 문장부터 나눈다 |
| 정량 근거 | `figure(type:'data')` 표·막대·선·산점도 | 표준 데이터 렌더러(`problem-figure`) | Command of Evidence (Quantitative): figure(type:'data') 필수(`rw_data`), 지문 안 마크다운 표 거부(`rw_table`). 다른 유형의 마크다운 표도 `rw_table` 로 안내(레거시 표시는 유지) |

관리자 편집 칸에는 인식된 구조 한 줄 요약(`rw-structure`: "Text 1·Text 2 · 빈칸 0 · 밑줄 0 · 질문 인식됨")과 학생 화면 미리보기가 함께 보인다.

## 11개 유형 × 상태

| 세부 기술 코드 | 구조 블록 | 단위 테스트 | 로컬 E2E(관리자 저장·공개 → 학생) | AI 생성 E2E |
|---|---|---|---|---|
| words_in_context | 빈칸 1 / 인용 단어형 | √ | √ `60~62-wic` | √ `80-ai-wic` 공개 |
| text_structure_purpose | 밑줄 1 + underlined 질문 | √ | √ `63~65-tsp` | √ `92-ai-tsp` — 1차 생성분은 질문·밑줄 불일치로 **게이트 차단**(기대 동작), 파서 보완 뒤 2차 공개 |
| cross_text_connections | Text 1 / Text 2 | √ | √ `66~68-cross`, 차단 `77-cross-blocked` | √ `83-ai-cross` 공개 |
| rhetorical_synthesis | 메모 3~6 + 목표 | √ | √ `69~71-rs` | √ `86-ai-rs` 공개 |
| command_of_evidence_quant | figure data + 마크다운 표 금지 | √ | √ `72~74-quant` | √ `89-ai-quant` — 1차 생성분은 단위 누락으로 차단(기대 동작), 재생성 공개. 모델이 data 자료를 빠뜨려 **생성 자체가 거부**된 회차 2/5(오류 사유 표기·서버 로그 추가) |
| transitions | 빈칸 1 | √ | √ `75~76-trans` | — (빈칸 규칙은 WiC·Boundaries 와 동일 경로) |
| boundaries | 빈칸 1 | √ | √ (공개 확인) | √ `95-ai-bnd` 공개 |
| form_structure_sense | 빈칸 1 | √ (규칙 공유) | — | — |
| inferences | 빈칸 1(문장 끝) | √ | — | — |
| central_ideas_details | 본문+질문(빈칸·밑줄·Text 금지) | √ | — | — |
| command_of_evidence_text | 본문+질문(빈칸 ≤1) | √ (규칙 공유) | — | — |

대표 유형 6개(WiC·밑줄·Text 1/2·메모·표/그래프 근거·문법/전환)는 지시대로 E2E 를 끝냈다. 나머지 4개는 같은 규칙(빈칸 1 / 본문+질문)을
공유하며 단위 테스트로 덮는다.

## 검증·배포

- 단위: `lib/rw-stimulus.test.ts` 18, `lib/problem-content-check.test.ts`, `lib/render-learning-content.test.ts`(빈칸 토큰) — 통과.
- 로컬 E2E: `e2e/rw-structured-blocks.spec.ts` 13건(결정적 7 + AI 6) 통과. 스크린샷 `docs/assets/2026-09-14-render-samples/e2e/60~95-*`.
- Preview: 코드 배포. 공유 non-prod DB 게이트는 RW 사유(`rw_texts`)가 실린 `render_check.ok=false` 초안의 공개가 거부되고,
  `ok=true` 면 공개되는 것을 SQL 로 실측(임시 문제는 보관). **Preview UI 클릭 확인은 미실행**(non-prod 시드 계정 없음 — UAT 계정으로 남김).

## 남은 것

- AI 가 RW 정량 근거에 `data` 자료를 빠뜨리는 회차가 있다(생성 거부로 안전하게 끝남). 실패 모양은 서버 로그에 남기므로 표본이 모이면 스키마 설명을 보강.
- 세부 기술 코드가 없는 기존 RW 문제는 검사·구조 렌더 대상이 아니다 — 관리자가 코드를 달아 다시 저장하면 그때 검사한다(일괄 자동 분류 없음).
