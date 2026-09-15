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
- 자료 권장은 이유만 보이고 텍스트형으로 진행할 수 있다. AI 생성에는 그림 요구 `optional` 로 넘어가 모델이 문항 내용에 따라 자료를 넣을지 정한다(강제 없음). 생성된 본문이 그래프·표를 가리켜 판정이 필수로 바뀌면 필수 유형과 같은 2차 자료 생성을 거친다.
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
