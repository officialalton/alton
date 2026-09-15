# 문제 유형별 조건 정리 — 세부 기술 코드 30개 (2026-09-15)

코드에서 실제로 적용되는 조건을 유형별로 한 곳에 모았다. 출처: 생성 규칙(`lib/problem-skills.ts`, `curriculum-doc-actions.ts` 스키마 설명), 자료 판정(`lib/problem-material-need.ts`), RW 구조 검사(`lib/rw-stimulus.ts`), 내용 검증(`lib/problem-content-check.ts`), 자료 검증(`lib/problem-figures/check.ts`), 학생 렌더(`RwStimulusView`, `ProblemFigure`).

공통(모든 유형): 질문은 `question` 에 따로 저장하고 지문/자료는 `passage`. 생성 결과는 공개 게이트와 같은 검사(자료 참조·렌더 충돌·잘림·내용)를 통과해야 초안이 되고, 걸리면 사유 피드백으로 1회 자동 재생성. 정답 노출·수학 오류·참조 불일치·읽을 수 없음/접근성 부재만 차단 기준.

## A. SAT Reading & Writing (11) — 전부 객관식 4지, 지문 영어·해설 한국어, 자료는 정량 근거만

| 세부 기술 | 지문 구조 | 질문 문구(표준) | 선택지 | 자료 판정 | 구조 검증(거부 조건) | 학생 화면 |
|---|---|---|---|---|---|---|
| Words in Context | (a) 빈칸형: 1단락 50~120단어, `______` 정확히 1 (b) 인용 단어형: 빈칸 없음, 대상 단어가 지문에 있음, 지문에 다른 따옴표 낱말 없음 | (a) "Which choice completes the text with the most logical and precise word or phrase?" (b) "As used in the text, what does the word “…” most nearly mean?" | 단어/짧은 구 4 | 불필요 | 빈칸 0·2개, 질문 문구 불일치, 인용 단어 지문에 없음, 다른 인용 표시(대상 모호), 선택지 안 빈칸 | 빈칸은 밑줄 칸, 인용형은 대상 단어 자동 밑줄, 질문 굵게 분리 |
| Text Structure and Purpose | 1단락. '밑줄 문장' 문항이면 `__문장__` 정확히 1 | "Which choice best states the main purpose of the text?" / "…function of the underlined sentence in the text as a whole?" | To + 동사구 4 | 불필요 | underlined 질문인데 밑줄 0·2, 밑줄 있는데 질문이 underlined 아님, 빈칸 있음 | 밑줄 렌더 |
| Cross-Text Connections | `Text 1` / `Text 2` 제목 줄, 각 60~110단어(최소 20), 순서 | "Based on the texts, how would the author of Text 2 most likely respond to …?" 류(Text 1/2·both texts 참조) | 완결 문장 4 | 불필요 | Text 1·2 둘이 순서대로 없음, 본문 20단어 미만, 질문이 텍스트 미참조 | 제목이 있는 두 구역 |
| Central Ideas and Details | 1단락 | "Which choice best states the main idea of the text?" / "According to the text, …?" | 완결 문장 4 | 불필요 | 빈칸·밑줄·Text 구조·메모 있으면 거부, 질문 미인식 | 본문+질문 |
| Inferences | 미완성 문장으로 끝남(`______` 1) | "Which choice most logically completes the text?" | 절 4 | 불필요 | 빈칸 ≠1, 질문 문구 불일치 | 빈칸 칸 |
| Command of Evidence (Textual) | 연구·주장 요약 지문, 빈칸 ≤1 | "Which finding, if true, would most directly support …?" / "Which quotation … most effectively illustrates …?" | 문장·인용 4 | 불필요 | 빈칸 2+, 질문 미인식 | 본문+질문 |
| Command of Evidence (Quantitative) | 자료(figure type:'data')를 설명하는 단락, 마크다운 표 금지, 빈칸 ≤1 | "Which choice most effectively uses data from the table/graph to complete the statement?" 류 | 자료 수치 인용 문장 4 | **필수 · 표·그래프** | data 자료 없음, 마크다운 표, 지문 단위·값 ↔ 자료 불일치(`unit_missing`·`ref_missing`) | 표준 표/그래프 위, 본문, 질문 |
| Rhetorical Synthesis | 첫 줄 "While researching a topic, a student has taken the following notes:" + `- ` 메모 3~6 | "The student wants to …. Which choice most effectively uses relevant information from the notes to accomplish this goal?" | 완결 문장 4 | 불필요 | 메모 목록 없음·개수 밖, 목표 문장 없음, notes 미참조 | 소개 줄 + 불릿 목록 + 질문 |
| Transitions | 두 문장 사이 `______` 1 | "Which choice completes the text with the most logical transition?" | 접속 표현 4 | 불필요 | 빈칸 ≠1, 문구 불일치 | 빈칸 칸 |
| Boundaries | 한 문장 안 `______` 1 | "Which choice completes the text so that it conforms to the conventions of Standard English?" | 문장부호·수일치만 다른 어구 4 | 불필요 | 빈칸 ≠1, 문구 불일치 | 빈칸 칸 |
| Form, Structure, and Sense | Boundaries 와 같음 | 같음 | 동사형·대명사·수 일치가 다른 어구 4 | 불필요 | 같음 | 같음 |

RW 공통 거부: 질문 문장 미인식, 선택지 4개 아님, 다른 유형의 Text/메모/밑줄 구조 혼입, 수식 조판 실패·`$` 미닫힘.

## B. SAT Math (19) — 객관식 4지 또는 SPR(숫자 입력), 수식 `$…$`, 선택지 값만·단위 없음

자료 판정 규칙: 질문·지문 단서(graph/xy-plane → 좌표평면, table/histogram/scatterplot… → 표·그래프, figure/triangle ABC/circle… → 도형, "Which of the following graphs" → 그래프 선택지)가 우선. 단서가 없으면 아래 기본값. "the graph shows" 는 자료 기술이면 표·그래프, 함수 기술이면 좌표평면. 자료 포함 여부·유형은 **생성 전** 패널에서 정한다(필수=고정, 권장=자료 포함 기본/텍스트형, 대안 유형이 있으면 선택).

| 영역 | 세부 기술 | 기본 자료 판정(대안) | 자료 검증 핵심 | 답안 |
|---|---|---|---|---|
| Algebra | Linear equations in one variable | 불필요 | — | MC/SPR |
| Algebra | Linear functions | 권장 · 좌표평면 (대안: 함수표) | 기울기·절편·점 좌표 ↔ 지문 대조, 선택지 좌표 점 금지 | MC/SPR |
| Algebra | Linear equations in two variables | 권장 · 좌표평면 | 같음 | MC/SPR |
| Algebra | Systems of two linear equations | 권장 · 좌표평면 (대안: 그래프 선택지) | 교점 좌표 대조, 선택지 4개 같은 축·정답 자리 | MC/SPR |
| Algebra | Linear inequalities | 권장 · 좌표평면(음영) | 부등호·경계 실선/점선 대조 | MC/SPR |
| Advanced Math | Equivalent expressions | 불필요 | — | MC/SPR |
| Advanced Math | Nonlinear equations & systems | 권장 · 좌표평면 | 교점 좌표 대조 | MC/SPR |
| Advanced Math | Nonlinear functions | 권장 · 좌표평면 (대안: 그래프 선택지) | 꼭짓점·절편 대조, 포물선 선택지 정답 자리 | MC/SPR |
| PSDA | Ratios, rates, proportional relationships, units | 권장 · 표·그래프 | 항목·값·단위 대조 | MC/SPR |
| PSDA | Percentages | 권장 · 표·그래프 | 같음 | MC/SPR |
| PSDA | One-variable data | **필수 · 표·그래프**(숫자 목록·점도표·히스토그램·상자그림) | 값 대조·단위 | MC/SPR |
| PSDA | Two-variable data | **필수 · 표·그래프**(산점도·표) | 추세선·값 대조 | MC/SPR |
| PSDA | Probability & conditional probability | **필수 · 표·그래프**(양방향표) | 합계는 렌더러 계산, 값 대조 | MC/SPR |
| PSDA | Inference from sample statistics & margin of error | 권장 · 표·그래프(문장형) | 표본 수·오차범위 대조 | MC/SPR |
| PSDA | Evaluating statistical claims | 권장 · 표·그래프(문장형) | 연구 설계 항목 대조 | MC |
| Geometry & Trig | Area and volume | 권장 · 도형(다각형·입체·복합) | 치수 라벨 대조, 구하는 값은 미지수 | MC/SPR |
| Geometry & Trig | Lines, angles, and triangles | **필수 · 도형**(평행선·횡단선 — 수직·교점·삼각형 포함, 삼각형, 다각형 각) | 선·점·각 이름 대조, 방위 표현 거부, 직각은 수직 교점에서만 | MC/SPR |
| Geometry & Trig | Right triangles and trigonometry | **필수 · 도형**(직각삼각형) | 변·각 라벨 대조 | MC/SPR |
| Geometry & Trig | Circles | 권장 · 도형 (대안: 좌표평면의 원의 방정식) | 중심·현·호·접선 대조, 등축 | MC/SPR |

Math 공통 거부: 수식 조판 실패·LaTeX 노출·`$` 미닫힘, 선택지 `x =` 표기·단위 기호, 로마숫자 진술 ↔ 조합 선택지 불일치, SPR 정답 형식(정수·소수·분수, 5/6자), 자료 참조 불일치·라벨 충돌·잘림·정답 노출, 자료 필수인데 없음.

## C. AP — 과목 선택 자리만(전부 준비 중). 문제 형식·자료 블록은 과목별 결정 뒤.

## D. 유형 무관 학생 화면 규칙

자료가 있으면 본문 위에 표준 렌더(그래프 선택지는 선택지 칸 안), 본문(Text 1/2·메모·빈칸·밑줄 블록), 질문 굵게, 선택지 또는 SPR 입력, 채점 뒤 정답·해설. 관리자 편집 화면의 '학생 화면 미리보기'는 같은 렌더를 맨 위에 보인다.
