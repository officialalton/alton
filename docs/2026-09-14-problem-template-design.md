# 2026-09-14 — 문제 템플릿 설계안 (SAT Practice Test 5 디지털판 분석 기반)

제품 오너 요청: "전체 문제 유형을 보고, 우리 문제 생성 템플릿을 어떻게 셋업할지. 답안 양식도 다양하다."
근거 자료: College Board SAT Practice Test 5(디지털) — Reading and Writing 2모듈(27+27), Math 2모듈(27+27).

## 1. 실제 시험에서 나오는 문제 모양

### Reading and Writing (전부 4지선다, 단일 정답)
| 유형 | 자극(stimulus) | 문항 |
|---|---|---|
| Words in Context | 짧은 지문(빈칸 `_______` 또는 인용 단어) | "가장 논리적·정확한 단어", "'trace'의 의미" |
| Text Structure / Purpose | 지문 | 주된 목적, 밑줄 문장의 기능 |
| Cross-Text Connections | **지문 2개**(Text 1 / Text 2) | 두 저자 관점 비교 |
| Central Ideas / Details | 지문 | 중심 생각, 세부 |
| Command of Evidence | 지문 + **표 또는 그래프**, 또는 연구 요약 | 주장을 가장 잘 뒷받침하는 선택지(선택지가 문장) |
| Inferences | 지문(끝이 비어 있음) | "가장 논리적으로 완성하는 것" |
| Boundaries / Form-Structure-Sense | 빈칸이 있는 문장 | 표준 영어 관습(문장부호·수일치·시제) |
| Transitions | 빈칸 | 접속 표현 |
| Rhetorical Synthesis | **메모 목록**(bullet notes) | 목표에 맞게 종합한 문장 |

### Math (MC 4지선다 + 학생 직접 입력 SPR)
| 자극 | 예 |
|---|---|
| 텍스트만 | 방정식·서술형 응용 |
| **수식 블록**(연립방정식, 함수 정의) | `y = 4x`, `y = x² − 12` |
| **좌표평면 그래프**(직선·포물선·지수·산점도·최적선) | "그래프의 y절편", "해 (x, y)" |
| **기하 도형**(평행선·삼각형·원·각도 표시, "Note: Figure not drawn to scale") | cos x°, 각의 크기 |
| **표**(x, f(x) / 데이터 집합) | 함수 특징, 평균 비교 |
| 수열·숫자 목록 | 범위(range) |
| **선택지 자체가 그래프 4개** | 어느 그래프가 함수인가 |
| 선택지가 수식/함수식 | `V(x) = 9x(x + 7)` |
| 로마 숫자 조합 | I only / II only / I and II / Neither |

### 답안 양식
1. **객관식 4지**(A–D) — RW 전부, Math 대부분. 선택지는 텍스트·수식·그래프.
2. **SPR(Student-Produced Response)** — Math 약 25%. 숫자 입력: 정수, 소수, 분수(`7/2`), 음수. 양수 5자·음수 6자 제한, 대분수 금지, 기호(%, $, 쉼표) 금지. **정답이 여러 개일 수 있음**("a solution", "sum of all possible values" 등 — 채점표는 동치 답 목록).
3. (우리 서비스만) **서술형/풀이형** — SAT엔 없지만 수업용으로 유지.

## 2. 우리 템플릿 — 확정 제안

### 2-1. 문제 하나의 데이터 모양(`problem_versions` 확장)
```
format:        'mc' | 'spr' | 'essay' | 'math'      -- spr 신설(숫자 직접 입력·자동 채점)
stimulus:      jsonb  [ {type:'text', md}, {type:'text', md, label:'Text 2'},
                        {type:'latex', tex}, {type:'table', columns, rows},
                        {type:'svg', svg, alt}, {type:'image', asset_path, alt},
                        {type:'notes', items[]} ]        -- 순서 있는 블록 목록
prompt:        text   -- 질문 문장("What is the value of x?")
options:       jsonb  [ {md, tex?, svg?} ×4 ]            -- 선택지도 블록(텍스트/수식/그래프)
correct_index: int    -- mc
answers:       jsonb  -- spr: ["7/2","3.5"] 동치 답 목록(서버가 분수↔소수 정규화 비교)
explanation:   md(+latex)
difficulty:    easy|medium|hard  (완료)
skill_type:    위 표의 유형 코드(RW 9종, Math 4영역: Algebra / Advanced Math / Problem-Solving & Data Analysis / Geometry & Trig)
figure_policy: 'none' | 'to_scale' | 'not_to_scale'      -- 도형 문제의 "Figure not drawn to scale" 표기
```
`passage` 는 `stimulus[0].md` 로 옮기고, 기존 문제는 `[{type:'text', md: passage}]` 로 자동 변환(마이그레이션·읽기 호환).

### 2-2. 렌더링(학생·교사 화면 공통 `ProblemsPanel`)
- 텍스트: 지금처럼. **수식은 KaTeX**(`$…$`, `$$…$$`; 선택지·해설에도).
- 표: 헤더+행 그대로 표로.
- **도형·그래프: SVG 블록을 그대로 렌더**(sanitize). 좌표평면은 우리가 그리드·축·눈금을 만드는 **표준 SVG 생성기**를 제공해 AI 는 "선분/점/곡선/라벨" 데이터만 내게 함 → 정확성 확보(직선·포물선·점·표·산점도·평행선·삼각형·원·각도 라벨).
- 이미지: 교사·관리자가 업로드(Storage `problem-assets`), 기출 도형 등.
- 선택지 4개가 그래프면 2×2 격자.
- SPR 입력: 한 칸 입력 + 규칙 안내(양수 5자·음수 6자·분수/소수), **제출 즉시 정규화 비교로 자동 채점**(교사 `채점 완료`로 확정 — 지금 객관식과 같은 규칙).

### 2-3. AI 생성 템플릿(도구 스키마)
- 입력: 과목, `skill_type`(유형 코드), 난이도, 형식(mc/spr/essay/math), 주제(선택), 개수, **자극 종류 제한**(예: "좌표평면 그래프 포함" / "표 포함" / "도형 없음").
- 출력 스키마(`generate_problems`): 위 2-1 그대로. 규칙 프롬프트에 유형별 **문항 말투 고정**(예: WIC "Which choice completes the text with the most logical and precise word or phrase?", Purpose "Which choice best states the main purpose of the text?", SPR 는 답 형식 규칙 명시, 도형이면 `figure_policy` 와 SVG 데이터 필수).
- 검증(저장 전): 선택지 4개·정답 인덱스 범위 / SPR 답 정규화 가능 / 지문에 A)~D) 중복 없음(완료) / SVG 는 화이트리스트 태그만 / KaTeX 파싱 실패 시 초안에 경고 표시.
- **검수 필수**: 전부 초안 → 교사·관리자가 렌더된 모습을 보고 공개(지금 흐름 그대로). 그래프·도형은 미리보기에서 "그림 확인함" 체크가 있어야 공개 가능.

### 2-4. 채점 규칙 정리
| 형식 | 자동 | 교사 |
|---|---|---|
| mc | 정답 인덱스 비교 | `채점 완료`로 확정(지금과 같음) |
| spr | 답 정규화 비교(분수=소수, 앞자리 0, 반올림 허용치) | 확정 |
| essay / math(풀이형) | 없음 | 정답·부분·오답 |

## 3. 진행 순서(승인 시)
1. `spr` 형식 + `answers` + 정규화 채점 RPC + 입력 UI (SAT Math 25% 커버, 자동 채점)
2. KaTeX 렌더(지문·선택지·해설) + 표 블록
3. 표준 SVG 생성기(좌표평면·도형) + AI 스키마에 도형 데이터 + 미리보기 검수 체크
4. 이미지 첨부(Storage)
5. 유형 코드(skill_type) 표준화 + 유형별 문항 말투 프롬프트 + RW 2지문·메모 목록 블록
각 단계 끝에 표본 10문항을 AI 로 만들어 렌더 스크린샷으로 확인한다. 유료 서비스 없음(모델 호출은 기존 Anthropic 키).
