# 교재 라이브러리 서식 보존 + 문제풀이 인터랙션 설계

## 배경

사용자가 첨부한 참고 문서(`Alton_SAT_Words_in_Context_Student_Packet.docx`)는 색상 있는 안내 박스(LEARNING OBJECTIVE 등), 네이비색 표 헤더, 색상 구분된 번호 단계 등 구글독스에서 직접 만든 세련된 서식을 갖고 있다. 사용자는:

1. 관리자 에디터로 이런 서식을 직접 구현하길 원하지 않는다 — 구글독스에서 만들어서 붙여넣기만 하면 되고, **배포했을 때 그 서식이 무너지지 않는 것**만 보장하면 된다.
2. 문제 생성 쪽도 같은 수준의 서식이 적용되어야 한다.
3. 객관식은 5지선다 클릭 채점, 서술형은 자동 확장 타이핑 박스, 수학 풀이는 화이트보드(캔버스) — 학생이 실제로 풀 수 있어야 하고, 모범답안/정답은 선생님만 봐야 한다.

조사 결과 알게 된 것:

- **학생 답변 UI(객관식 클릭채점/서술형 타이핑/수학 캔버스 그리기)는 세션뷰(`app/session/[id]/MaterialTab.tsx`의 `ProblemCard`, `MathCanvas.tsx`)에 이미 전부 구현되어 있다.** 재사용하면 된다.
- **진짜 버그는 `app/materials/[id]/LibraryDocView.tsx`(교재 라이브러리 열람 화면)에 있다**: 이 화면은 뷰어 역할 구분이 전혀 없어서, 학생이 봐도 객관식 정답이 초록색으로 강조되고 해설(모범답안)이 그대로 노출된다(`ProblemPreview` 컴포넌트, 정적 미리보기, 클릭 불가). `app/materials/[id]/page.tsx`는 `requireUser()`로 아무 역할이나 통과시키고 `LibraryDocView`에 역할 정보를 아예 넘기지 않는다.
- **서식이 무너지는 원인은 `lib/sanitize-doc-html.ts`다**: `allowedAttributes: {}`라 저장 시 `style` 속성(색상/배경/표 테두리 등)이 전부 제거된다. 구글독스에서 붙여넣은 내용은 인라인 스타일로 서식을 표현하므로, 이 태그만 지나면 색·배경·강조박스가 모두 사라진다.
- **섹션 제목은 라이브러리/세션뷰 둘 다 이미 `<h2>`로 렌더링 중**이다. 첨부 문서 수준으로 크기·색상만 다듬으면 된다.
- **목차 스크롤 버그**: 마지막 섹션 아래에 여백이 없어서, 마지막 섹션을 화면 맨 위로 스크롤시키려 해도 그 아래로 스크롤할 공간 자체가 없어 정확히 이동하지 못한다.
- **서술형 입력창은 현재 고정 높이(`min-h-[90px]`)라 타이핑이 늘어나도 커지지 않는다.** 세션뷰·라이브러리 둘 다 해당.

## 결정 사항

- 문제 3종(mc/essay/math)의 답변 캡처 로직·재시도(3회) 로직·`MathCanvas`는 새로 만들지 않고 그대로 재사용한다. 라이브러리 화면은 세션이 없는 컨텍스트이므로, 세션 없이 재시도할 때 이미 쓰던 `app/session/[id]/problemlog-actions.ts`의 `retryMcAttempt`/`retryEssayAttempt`/`retryMathAttempt`(모두 `session_id: null`로 저장)를 그대로 import해서 쓴다.
- 뷰어 역할은 3단계로 나눈다: **teacher**(교사/관리자 — 정답·모범답안 항상 노출, 입력 불가), **student**(학생 — 정답/해설 숨김, 클릭/타이핑/캔버스로 직접 풀이 가능), **other**(그 외 — 학부모 등. 정답도 입력도 없이 문제 지문만 노출 — 답 유출도 막고, 학생이 아닌 계정이 시도 기록을 오염시키는 것도 막는다).
- 역할 판정은 `profiles.role` 컬럼을 그대로 사용한다(`admin`/`teacher` → teacher 뷰, `student` → student 뷰, 그 외 → other 뷰).
- 서식 보존은 `sanitize-html`의 `allowedStyles` 옵션(속성 전체 허용이 아니라 태그별로 허용할 CSS 속성과 값 패턴을 정규식으로 검증하는 기능)을 사용한다 — `allowedAttributes: {}`를 유지한 상태로 `style` 속성만 별도로 안전하게 허용하는 방식이라, 임의 속성 주입(예: `onclick`)은 여전히 막힌다.
- 관리자 에디터(`RichTextEditable.tsx`)의 툴바 UI는 그대로 둔다 — 이번 스코프는 "붙여넣은 서식이 저장 시 사라지지 않게" 하는 것이지, 에디터 자체를 구글독스처럼 다시 만드는 게 아니다.
- 서술형 자동 확장 textarea는 세션뷰(`MaterialTab.tsx`)와 라이브러리 화면 둘 다에 적용한다(같은 버그, 같은 컴포넌트 패턴).

## 1. 서식 보존 (`lib/sanitize-doc-html.ts`)

허용 태그에 `h1`, `h4`, `blockquote`, `hr`을 추가한다(구글독스 문서가 흔히 쓰는 제목 레벨과 인용/구분선).

`allowedStyles`로 다음 속성을 태그 전반에 허용한다:
- `color`, `background-color` — hex/rgb 값만
- `font-weight`, `font-style`, `text-decoration` — 표준 키워드만
- `text-align` — `left|center|right|justify`
- `border`, `border-color`, `border-width`, `border-style` — 표 테두리
- `padding`, `margin` — px/em 단위 숫자만
- `width` — 표 폭 조정용, px/% 단위만

`allowedAttributes`는 `{}`(전체 태그 공통)로 유지하되, `sanitize-html`이 `allowedStyles`를 처리하려면 `style` 속성이 통과해야 하므로, 관련 태그(`p, div, span, h1, h2, h3, h4, ul, ol, li, table, thead, tbody, tr, th, td, blockquote`)에 한해 `style`을 허용 속성에 추가한다. `style` 값 자체는 `allowedStyles`가 속성별로 검증하므로 임의 CSS(예: `expression()`, `url(javascript:...)`)는 걸러진다.

## 2. 섹션 제목 서식

라이브러리(`LibraryDocView.tsx`)·세션뷰(`MaterialTab.tsx`) 양쪽의 섹션 제목 `<h2>` 스타일을 첨부 문서 수준으로 다듬는다: 더 크게(`text-[22px]`), 네이비 계열 색상(`text-[#0b2545]` 또는 기존 `--ink` 토큰), `font-extrabold` 유지. 관리자 에디터의 섹션 제목 입력 필드도 시각적으로 맞춰(굵게, 약간 더 큰 크기) 저작 화면과 열람 화면의 괴리를 줄인다.

## 3. 교재 라이브러리 인터랙티브 문제 (핵심 버그 수정)

### 데이터/역할 배선

`app/materials/[id]/page.tsx`가 `profiles.role`을 조회해 `LibraryDocView`에 `viewerRole: "teacher" | "student" | "other"`로 넘긴다.

### `LibraryProblem` 뷰

`ProblemPreview`(정적 미리보기, 정답 노출)를 제거하고, `LibraryProblemCard`라는 새 컴포넌트로 교체한다. 이 컴포넌트는 `MaterialTab.tsx`의 `ProblemCard`와 거의 같은 렌더링 로직을 쓰되, 서버 액션만 세션 없는 버전(`retryMcAttempt`/`retryEssayAttempt`/`retryMathAttempt`)을 쓰고, `viewerRole`이 3단계(teacher/student/other)라는 점이 다르다.

- **teacher**: 객관식 정답이 초록 배지로 항상 보임, 해설(모범답안/모범풀이) 항상 보임. 입력 UI 없음.
- **student**: `ProblemCard`와 동일한 인터랙션(mc 클릭 채점 3회, essay 타이핑+제출, math 캔버스+제출). 정답을 맞히거나 3회 다 틀리기 전까지는 정답/해설 숨김.
- **other**: 지문만 보이고, 선택지/입력창/정답/해설 전부 숨김. 대신 "이 문제는 학생 계정으로 로그인해야 풀 수 있습니다." 안내 문구만 표시.

## 4. 서술형 자동 확장 입력창

`MaterialTab.tsx`의 `ProblemCard`와 새 `LibraryProblemCard` 둘 다에서 쓸 공용 `AutoGrowTextarea` 컴포넌트를 만든다. `onChange`마다 `textarea.style.height`를 `"auto"`로 리셋한 뒤 `scrollHeight`만큼 다시 세팅하는 방식(외부 라이브러리 불필요).

## 5. 목차 스크롤 버그

`LibraryDocView.tsx`·`MaterialTab.tsx` 양쪽에서 섹션 목록 맨 끝(마지막 섹션 뒤)에 `<div className="h-[60vh]" aria-hidden />` 같은 여백 스페이서를 추가해, 마지막 섹션도 화면 맨 위까지 스크롤할 수 있는 공간을 확보한다.

## 영향받는 파일 (구현 태스크에서 상세화 예정)

- `lib/sanitize-doc-html.ts` — allowedTags/allowedStyles 확장
- `app/materials/[id]/page.tsx` — `viewerRole` 조회 및 전달
- `app/materials/[id]/LibraryDocView.tsx` — `LibraryProblemCard`로 교체, 스크롤 스페이서, 제목 스타일
- `app/session/[id]/MaterialTab.tsx` — `AutoGrowTextarea` 적용, 스크롤 스페이서, 제목 스타일
- 신규: `app/session/[id]/AutoGrowTextarea.tsx` (또는 공용 위치) — 세션뷰와 라이브러리 양쪽에서 import
- `app/student/materials-data.ts` — `LibraryProblem`/`LibraryDocDetail` 타입에 필요한 필드(이미 있는 `session_problem_attempts` 조회 결과 등) 점검
- 관련 테스트: `LibraryDocView.test.tsx`(신규 또는 갱신), `MaterialTab.test.tsx`, `sanitize-doc-html.test.ts`

## 스코프 제외

- 관리자 에디터(`RichTextEditable.tsx`)의 툴바 UI 개편(색상 피커, 강조박스 버튼 추가 등)은 이번에 하지 않는다 — 붙여넣기 서식 보존만 다룬다.
- 완전한 LaTeX/수식 렌더링은 이번 스코프에 포함하지 않는다(기존 결정 유지).
- 목차 첫 번째 섹션 스크롤이 별도의 원인으로 여전히 어긋난다면(스티키 헤더 높이 재측정 등) 이번 태스크로 완전히 해결되지 않을 수 있다 — 마지막 섹션 문제(확실한 원인)를 우선 고치고, 남는 문제는 사용자 확인 후 후속 처리한다.
