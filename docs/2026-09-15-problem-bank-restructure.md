# 문제은행 생성·편집 재구성 — 문항 체계 분리 · 자료 필요성 판정 · 질문 분리 (2026-09-15)

제품 오너 지시(2026-09-14 밤): 관리자가 문제별 내부 데이터 구조를 판단하지 않아도, 시험 체계와 문제 유형에 맞는 작성 흐름만 보게 한다.

## 1. 데이터 모델 (migration 20261369, 20261370)

| 항목 | 위치 | 뜻 |
|---|---|---|
| 관리 과목·키워드 | `problems.subject_id`, `problem_keywords` | 라이브러리·커리큘럼·자동 구성 연결 단위(그대로) |
| 문항 체계 | `problems.exam_system` (`sat_rw` / `sat_math` / `ap`) | 어느 시험의 어떤 문항인가. 관리 과목과 독립 |
| AP 과목 | `problems.ap_subject` | 코드. 목록·지원 여부는 `lib/problem-taxonomy.ts` `AP_SUBJECTS`(지금 전부 `준비 중`) |
| 시험 분류 | `problems.sat_domain`, `problems.skill_code` | 문항 체계의 하위. 트리거가 skill_code → domain → exam_system 을 맞춘다 |
| 질문 | `problem_versions.question` | 지문/자료(`passage`)와 분리 저장. 옛 버전은 null 이고 지문 안의 질문 문장을 그대로 읽는다 |

- 관리 과목·키워드를 바꿔도 문항 체계·시험 분류는 바뀌지 않는다(다른 컬럼, 다른 액션). 문항 체계를 바꿔도 subject_id·problem_keywords 는 그대로다.
- 백필: `sat_domain` 이 이미 있는 문제만 체계가 결정적으로 따라왔다(rw_* → sat_rw, 그 외 → sat_math). 영역이 없는 옛 문제는 **미지정**으로 두고 자동 분류하지 않는다.
- `problem_version_has_question(passage, question)` 로 질문 유무를 판정하고, `problem_auto_composition_candidates` 는 **질문 있는 공개본**만 후보로 삼는다. 공개본은 자동으로 고치지 않는다.
- `unit_preview_for_viewer`(시작 전 회차 미리보기)도 지문 + 질문을 한 덩어리로 돌려준다(20261370).
- RPC: `create_bank_problem(…, p_exam_system, p_ap_subject)`, `create/save_problem_draft_version(…, p_question)`. 옛 오버로드는 내렸다.

## 2. 화면 구조 (`app/admin/ProblemBankTab.tsx`, `ProblemDraftEditor.tsx`, `problem-bank-ui.ts`)

생성 탭 → 새 문제 상자에 **문항 체계 탭**(SAT Reading & Writing / SAT Math / AP).

1. 관리 과목과 키워드
2. 문제 규격: 영역 / 세부 기술 코드 / 유형(자동) / 난이도 / 답안 형식(R&W 는 객관식 고정, Math 는 객관식·SPR)
   → 세부 기술을 고르면 **자료 판정**(필수/권장/불필요 + 이유)이 바로 보인다. 관리자가 고르던 '그림' 선택은 없다 — 판정이 AI 생성의 그림 요구가 된다.
3. 지문 / 자료 (자료 판정 + 그 유형의 도구만)
4. 질문
5. 선택지 · 정답 (또는 정답 · 답안 형식)
6. 해설
7. 학생 화면 미리보기 → 초안 저장 / 공개

모든 칸 위에 역할 제목(지문 / 자료, 질문, 선택지, 정답, 해설, 학생 화면 미리보기)과 안내가 붙는다.

### 문항 체계별 표시 규칙 (`editorVisibility`)

| | SAT R&W | SAT Math | AP | 미지정(옛 문제) |
|---|---|---|---|---|
| SPR 정답 | 숨김 | 형식이 SPR 일 때 | 숨김 | 형식 따라 |
| 로마숫자 진술 | 숨김 | 객관식일 때(접힘) | 숨김 | 보임 |
| 자료 구역 | 정량 근거(data) 판정일 때만, 도구는 표·그래프 하나 | 판정 유형의 도구만(도형은 질문에서 읽은 템플릿만, 없으면 6개) | 숨김 | 전부 |
| 그림 업로드 | 숨김 | 자료 판정 있을 때 | 숨김 | 보임 |
| 자료 데이터 고급 편집(JSON) | 숨김(숨은 칸만) | 보임 | 숨김 | 보임 |
| RW 구조 요약·유형 안내 | 보임 | 숨김 | — | 보임 |
| 편집 자체 | — | — | **준비 중** 안내만(SAT Math 입력 재사용 안 함) | 모든 항목 |

숨긴 값은 지우지 않는다 — 저장 때 원래 값을 그대로 넘긴다.

### 초안·공개본
- 공개본 조회(`PublishedContentView`)도 같은 규칙으로 필요한 항목만 보인다. 질문이 없으면 `질문 보완 필요`.
- 초안에서 문항 체계·답안 형식을 바꾸면 `compatibilityPreview` 가 **유지되는 값 / 비활성화되는 값**을 먼저 보여주고 '이대로 변경'을 눌러야 적용된다.
- 공개본만 있는 문제는 체계·형식 선택이 잠기고 '수정 초안 만들기' 뒤 초안에서만 바꿀 수 있다.

## 3. 자료 필요성 자동 판정 (`lib/problem-material-need.ts`)

`judgeMaterialNeed({examSystem, skillCode, text})` → `{level, kind, geometry[], reason}`.

1. 질문·지문 문장의 단서가 우선: "Which of the following graphs" → 그래프 선택지 필수, table/histogram/scatterplot… → 표·그래프 필수, xy-plane/graph of/slope of the line shown → 좌표평면 필수, figure/triangle ABC/circle/cylinder/shaded region… → 도형 필수(템플릿까지 읽음). R&W 지문의 낱말(figure 등)은 도형 단서로 보지 않는다.
2. 단서가 없으면 세부 기술 기본값: 예) lines_angles_triangles·right_triangles_trigonometry·one/two_variable_data·probability → 필수, linear_functions·area_volume·circles·percentages… → 권장, 그 외 → 불필요.
3. **R&W 에도 적용**(문항 체계에 갇히지 않음): Command of Evidence (Quantitative) → 표·그래프 필수, 나머지 R&W 유형 → 불필요.
4. AP → 판정 안 함(준비 중), 세부 기술 없음 → 불필요 + "세부 기술을 고르면 판정" 안내.

- 자료 필수인데 자료가 없으면 `materialBlocker` 사유로 **초안 저장·공개가 막힌다**(서버 `createDraftVersionAction` + 화면). 올린 그림(alt 필수)은 어떤 자료든 대신한다.
- **자료를 넣을지는 생성 전에 정한다**(2026-09-15 제품 오너: 자료 유무에 따라 문항 자체가 달라진다). 새 문제 패널의 판정 줄에서 — 필수: 자료 포함 고정, 권장: `자료 포함(기본)` / `텍스트형` 선택, 불필요: 텍스트형 고정. 선택이 그대로 AI 생성의 그림 요구(`require_*` / `none`)가 되어, 자료 포함이면 자료를 읽어야 풀리는 문항으로, 텍스트형이면 식·조건만으로 성립하는 문항으로 만든다. `optional`(모델 재량)은 더 쓰지 않는다.
- **자료 유형이 둘 이상 나오는 기술은 유형까지 고른다**(`MaterialNeed.alternatives`): Linear functions(좌표평면 / 함수표), Nonlinear functions·Systems(좌표평면 / 그래프 선택지), Circles(도형 / 좌표평면의 원의 방정식). 그 외는 하나로 고정. 세부 형태(표·양방향표·막대·선·히스토그램·산점도·상자그림·점도표·문장형 / 평행선·삼각형·원·다각형·입체·복합)는 관리자가 고르지 않고 문항 내용에 맞춰 AI 가 정하며 검증·게이트가 확인한다. 복수 생성이면 문항마다 세부 형태가 다를 수 있다.
- 편집 화면에서 권장인데 자료가 없는 초안은 "텍스트형 문항 — 자료를 붙이면 지문·질문도 함께 고쳐야 한다" 안내가 붙는다.
- 회차 구성 화면(`CompositionPanel`)에 `materialStatusLines` 로 기술 코드별 자료 현황을 안내한다(예: `도형 자료 필수 문제 1개 (자료 없음 1) · 도형 자료 있는 문제 0개`). **자동 추가·제거 기준이 아니다.**

## 4. 복수 AI 생성의 질문 누락 수정

- 생성 스키마에 `question`(필수)을 따로 두고 `passage` 는 지문/자료만 담는다(`generateSectionProblems`, `regenerateProblem`). 모델이 question 을 비우고 지문 끝에 질문을 썼으면 `splitLegacyQuestion` 으로 갈라낸다.
- 단건(1개)과 복수(N개)는 같은 함수·같은 유형별 프롬프트·같은 검증(`validateGeneratedProblem`: 자료 또는 지문 / 질문(물음 문장) / 선택지 4개·정답 인덱스 또는 SPR 정답 / 해설 / RW 구조 검사)·같은 저장 경로(`createDraftVersionAction` → render_check → 공개 게이트)를 쓴다.
- 계약을 어긴 결과는 초안으로 저장하지 않고 사유와 함께 화면에 분리해 보인다(`failures`).
- 기존 생성분 집계: `problemQuestionAuditAction` → 목록 위에 `질문 있음 / 질문 없는 초안 / 질문 없는 공개본`. 질문 없는 행에 `질문 보완 필요`. 편집 화면에서 '질문 갈라내기' 버튼으로만 나눈다(자동 적용 없음). 시작된 수업의 고정 버전은 건드리지 않는다(버전 불변).

## 5. 검증

- 단위: `lib/problem-material-need.test.ts`(판정·차단·안내·질문 분리), `app/admin/ProblemBankTab.test.tsx`(탭·판정·R&W/AP 표시), 기존 렌더·검증 스위트 — 비통합 223 파일 통과.
- 로컬 E2E `e2e/problem-bank-flow.spec.ts`: AP 과목 선택 화면 + 대표 9사례(R&W 5: WiC·Text Structure·Cross-Text·Command of Evidence(Quant)·Rhetorical Synthesis, Math 4: 도형·좌표평면·데이터 그래프·SPR) 각각 **단건 1개 + 복수 2개** 생성 → 저장된 모든 결과에 질문 분리 확인 → 편집 화면 항목(불필요 항목 없음·제목·안내) → 자료 판정 → 공개 게이트 → 학생 렌더. 결과는 아래 표.
- 기존 E2E(`figure-template-1`, `rw-structured-blocks`)는 새 패널(문항 체계 탭·영역·세부 기술)로 갱신.

### E2E 결과 (2026-09-15, `e2e/problem-bank-flow.spec.ts` — AP 1 + 대표 9사례 전부 통과, 직렬 실행을 여러 번 나눠 돌림)

| 사례 | 단건·복수 생성(저장된 초안 수) | 질문 분리 저장 | 편집 화면(불필요 항목 없음·제목·안내) | 자료 판정 | 공개 → 학생 렌더 | 비고 |
|---|---|---|---|---|---|---|
| AP 과목 선택 | — | — | AP 과목 선택 → `준비 중`, 생성·쓰기 잠김 | 판정 안 함 | — | SAT 입력 재사용 없음 확인 |
| R&W Words in Context | 1+2 (8, 여러 회차 합) | 전부 | SPR·진술·도형 도구·JSON·업로드 없음, 구조 요약 있음 | 불필요 | 공개 2 | |
| R&W Text Structure and Purpose | 1+2 (3) | 전부 | 같음 | 불필요 | 공개 1 | |
| R&W Cross-Text Connections | 1+2 (6, 1건은 저장 거부→보관) | 전부 | 같음(Text 1/2 안내) | 불필요 | 공개 1 | 저장 거부 1건: 지문의 `$` 미닫힘(수식 조판 불가) — 빈 문제는 자동 보관 |
| R&W Command of Evidence (Quant) | 1+2 (6) | 전부 | 표·그래프 도구 하나만, 업로드·JSON 없음 | **필수 · 표·그래프** | 공개 2 | 1차 회차 생성분 3건은 `unit_missing`·`ref_missing` 으로 게이트 차단(기대 동작); 모델이 data 자료를 빠뜨려 생성 자체가 거부된 회차 있음(사유 표시) |
| R&W Rhetorical Synthesis | 1+2 (6) | 전부 | 같음(메모 안내) | 불필요 | 공개 2 | |
| Math 도형(lines_angles_triangles) | 1+2 (2, 1회 생성 거부) | 전부 | 도형 도구만(질문에서 읽은 템플릿), 진술 접힘, SPR 없음 | **필수 · 도형** | 공개 1 | 생성 거부 1회: 모델이 옛 각 표기(`line/quadrant`) 사용 → 유형 규칙 문구를 표준 템플릿으로 갱신 |
| Math 좌표평면(linear_functions) | 1+2 (3, 1건 저장 거부→보관) | 전부 | 좌표평면·그래프 선택지 도구, 도형 도구 없음 | 권장 · 좌표평면(그래프를 가리키면 필수) | 공개 1 | 저장 거부 1건: "The graph shows" 를 자료 그래프로 판정해 plane 자료와 어긋남 → 세부 기술로 가르도록 판정 보정 |
| Math 데이터 그래프(two_variable_data) | 1+2 (2) | 전부 | 표·그래프 도구만 | **필수 · 표·그래프** | 공개 1 | |
| Math SPR(linear_equations_one_var) | 1+2 (3) | 전부 | 정답 목록(SPR) 보임, 선택지 없음, 자료 구역 없음 | 불필요 | 공개 1 | |

- 재구성 뒤 저장된 생성분은 전부 `question` 컬럼에 질문이 따로 있다(집계의 질문 없는 항목은 재구성 전 생성분). 계약을 어긴 결과는 저장하지 않고 사유가 화면에 분리되어 보였다(빈 문제는 자동 보관).
- 공유 non-prod DB 실측(`gate-check-question.sql`): 체계 RPC 기록 `sat_rw` → 질문 없는 공개본은 후보 뷰에서 0건 → 질문 넣은 새 공개본은 1건 → 체계를 sat_math 로 바꿔도 키워드 유지. **Preview UI 클릭 확인은 미실행**(non-prod 시드 계정 없음).

## 6. 생성 규칙·검증의 제한 조건 — 전수 조사 (2026-09-15)

원칙: 제한은 **① 시험 범위 밖**, **② 실제 시험 문항 관례**, **③ 표준 렌더러가 그릴 수 없는 모양** 세 근거에서만 둔다. "오류가 잦아서"는 제한 이유가 아니다 — 그 경우는 생성 시 게이트 검사와 2차 자료 생성으로 처리한다. 임시 제한은 렌더러를 확장해 없앤다.

조사 범위: 생성 프롬프트·스키마 설명(`curriculum-doc-actions.ts`), 유형 규칙(`problem-skills.ts`), 분류 힌트(`problem-taxonomy.ts`), 템플릿 10종의 스키마 검증(`validate*`)과 렌더 거부 코드(`unsupported`·`impossible`), RW 구조 검사(`rw-stimulus.ts`), 내용 검증(`problem-content-check.ts`).

### 6-1. 생성 프롬프트·규칙의 제한

| 제한 | 근거 | 판단 |
|---|---|---|
| 옛 형식 `coordinate_plane`·`geometry`(좌표 직접 찍기), `angles:[{line, quadrant}]` 옛 표기 금지 | ③ AI 는 관계만, 좌표·배치는 렌더러 | 유지 |
| 지문에 north/south/east/west, region, quadrant 표현 금지 | ② 시험은 라벨·점 이름으로 각을 부른다 | 유지 |
| 정답 암시 보조 점·라벨·색 금지, 선택지 좌표를 점으로 찍기 금지, 구하는 값은 라벨에 쓰지 않음(미지수 문자) | ② 정답 노출 방지 | 유지 |
| 도형 라벨은 평문(LaTeX `$x^\circ$` 금지) | ③ SVG 라벨 렌더 | 유지 |
| 선택지 `x = 3` 표기·단위 기호(°, $, %) 금지, RW 선택지에 빈칸 금지 | ② SAT 선택지 관례 | 유지 |
| 마크다운 표 금지 → `figure(type:'data')` | ③ 표준 렌더러 정책(검증·alt·잘림) | 유지 |
| 지문에 없는 항목·라벨 금지, 값 null 금지, 합계 행·열은 넣지 않음(렌더러 계산) | ② 참조 일치·시험 자료는 빈칸이 없다 | 유지 |
| 자료 kind 10종 외(원그래프 등) 금지 | ① Digital SAT Math 자료: 표·양방향표·숫자 목록·막대·선·히스토그램·산점도·상자그림·점도표·문장형 | 유지(근거 명시) |
| 로마숫자 진술 시 선택지는 조합만, SPR 은 선택지 없음·정답 5/6자 | ② 시험 형식 | 유지 |
| 한 그림에 한 상황(여러 도형 섞지 않음) → 복수 자료는 figure_set | ③ 렌더 단위 | 유지 |
| 그래프 선택지: 같은 축·같은 객체 수·라벨/점 없음, 다른 키 이름 금지 | ②③ | 유지 |
| 모든 문항이 고른 세부 기술만 묻는다 | ② 분류 정확성 | 유지 |
| **횡단선끼리 만나는 점·삼각형 금지** | 임시 | **제거** — `crossing`(below/above) 확장으로 표준 렌더. 표본 `t1-crossing.png` |
| "복합 도형 등 이 템플릿들로 그릴 수 없는" 문구 | 낡음(composite 있음) | **정정** — 실제 범위 밖만 나열 |
| `math.algebra` 의 `figure(coordinate_plane)`, `math.advanced` 의 `figure(function 항목)` | 낡은 형식 이름 | **정정** → `figure(type:'plane')` |
| 평행선 3개 | ③ 템플릿은 평행선 2개 | 유지 — Test 6~11 표본에 3개 평행선 문항 없음. 나오면 확장 |
| 평행선에 수직인 횡단선 | ③ 55° 고정 기울기 | **결정 필요** — 실제 시험에 있는 모양이므로 확장 후보 |

### 6-2. 템플릿 스키마·렌더 검증의 제한(전수)

| 템플릿 | 제한 | 근거 | 판단 |
|---|---|---|---|
| parallel_transversal | 평행선 2개, 횡단선 1~2개, crossing 은 횡단선 2개일 때만 | ③ | 유지 |
| parallel_transversal | 직각 표시는 55° 교점에서 불가(`impossible`) | ③ | 결정 필요(수직 횡단선 확장과 함께) |
| triangle | 높이의 발이 맞은변 밖(둔각 쪽) 이면 그릴 수 없음 | ③ 배치 규칙 | 유지 — 시험 표본에서 둔각삼각형 외부 높이는 드묾. 나오면 확장 |
| triangle | 직각 표시는 kind 'right' 의 rightAngleAt 에서만 | ②③ 정합성 | 유지 |
| circle | 원 위의 점 0~8개, 반지름·지름 중 하나, 접선 external 은 새 이름, 중심각 직각은 90° 차이일 때만 | ③ 정합성 | 유지 |
| polygon | 정n각형 3~8, 마름모 높이 미지원(대각선으로), 높이의 발은 밑변 안 | ②③ 시험은 마름모를 대각선으로 다룸 | 유지(근거 명시) |
| solid | 6종(직육면체·정육면체·원기둥·원뿔·구·사각뿔), 치수 라벨 12자 | ① 시험 입체 범위 | 유지 |
| composite | outer 3종(square/rectangle/circle) × inner 5종, 반원은 사각형 위에만, 원 안에는 정사각형·직사각형·삼각형만, 겹침은 2겹 | ③ | 유지 + **후보 기록**: '직사각형 양끝 반원(트랙)', '삼각형 안 내접원' 은 시험에 나오는 모양 — 결정 시 확장 |
| plane | 함수 7종(linear·quadratic·cubic·exponential·abs·sqrt·rational), 곡선 교점은 점으로 직접, 원은 등축일 때만, 파생 점 계산 불가 시 거부 | ① 시험 그래프 범위(삼각·로그 그래프 없음) ③ | 유지 |
| data | kind 10종, 표 행은 열 수와 같음, 제목 90자(표·목록·문장형)/70자(그래프), series 이름 40자, note 300자 | ①③ | 유지(제목 한도는 40→90/70 으로 완화함) |
| figure_choice | 자식 type 8종(plane·도형 6·data), 모두 같은 type | ②③ | 유지 |
| figure_set | 자료 제목 90자(40→90 완화), spec type 은 지원 템플릿만 | ③ | 유지 |

### 6-3. RW 구조·내용 검증의 거부 조건(전수)

빈칸 정확히 1(빈칸 유형) / 인용 단어형은 빈칸 없음·단어가 지문에 있어야 함 / 밑줄은 Text Structure 의 'underlined' 문항에서만 정확히 1 / Text 1·Text 2 는 Cross-Text 에서만·순서·각 20단어 이상·질문이 텍스트를 가리킴 / 메모 목록은 Rhetorical Synthesis 에서만 3~6개·"The student wants to"·notes 참조 / 정량 근거는 data 자료 필수·마크다운 표 금지 / 근거 문항은 빈칸 최대 1 / 질문 문장 인식 필수 / RW 선택지 4개 / 수식 조판 실패·LaTeX 노출·미닫힘 `$` 거부 / 선택지 2~5·중복·빈칸·정답 범위 / 진술 5개까지·조합 선택지 정합 / SPR 정답 형식. — 전부 ② 실제 시험 문항 구조·형식이 근거이며 유지한다.
