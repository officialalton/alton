# 2026-09-14 — ALTON 표준 렌더링 엔진 설계안 (그림·그래프·표·수식·자료 화면)

제품 오너 지시(2026-09-14 저녁): "AI가 화면 결과물을 자유롭게 만들고 관리자가 건별로 고쳐 쓰는 구조가 아니라, ALTON의
표준 렌더링 엔진이 시험 수준의 완성도를 일관되게 보장해야 한다. AI의 역할은 문제의 의미와 필요한 데이터만 구조화해
반환하는 것." 구현 전에 **템플릿별 데이터 스키마와 렌더링 예시를 먼저 제시**하고, 첫 템플릿(평행선·횡단선·각도)으로
Preview에서 한 문제를 끝까지 검증한다.

현재 상태(문제점): `lib/problem-figures`의 `geometry` 스펙은 AI가 **임의 좌표**(polygon points, parallel_lines y1/y2,
transversal 좌표, angleLabels at [x,y])를 내는 구조다. 그래서 지문("C는 n 위에 있다")과 그림이 어긋나고, 라벨이 겹치고,
한 그림에 여러 상황이 섞였다. 이 방식은 **중단**한다. 이미 만들어진 평행선 문제는 `그림 확인함`이 꺼진 초안이라 공개
게이트(`20261361`: figure 있으면 figure_checked 필수)에 막혀 있고, 아래 새 검증이 들어가기 전까지 공개하지 않는다.

> **2026-09-14 저녁 승인·구현 상태**: 설계 승인(결정: 그림 선택지 3차, 업로드 alt·참조 확인 필수, 좌표형 초안은 `재생성 필요` 표시, 기존 회차 자동분 일괄 축소 없음).
> **템플릿 1(평행선·횡단선·각) 구현 완료** — `lib/problem-figures/templates/parallel-transversal.ts`(스키마·표준 렌더·충돌 검사·alt·지문 참조 lint),
> `lib/problem-figures/check.ts`(검증 계층), `20261365`(render_check + 공개 게이트), 관리자 편집기(렌더 미리보기 우선·사유 목록·JSON 접힘),
> AI 도구 스키마(관계만). 로컬 E2E `e2e/figure-template-1.spec.ts`: 실제 모델 생성 → 검증 → 공개 → 학생 화면(데스크톱·375px)까지 통과.
> 표본: `docs/assets/2026-09-14-render-samples/t1-*.png`(대표 10문항), `e2e/*.png`(실제 생성본).
> **템플릿 2(삼각형·직각삼각형·합동/닮음) 구현 완료** — `templates/triangle.ts`(관계형 스키마: 꼭짓점·종류·직각·변 라벨/눗금·각 라벨/호·높이·두 번째 삼각형; 표준형 배치; 참조 lint: △ABC, side AB, AB = 6 값 일치, ∠/angle, right angle at, 직각삼각형, 각도 라벨), 공통 조판 `templates/_layout.ts`(Sheet: 선·호·직각·눗금·라벨 충돌 검사). 표본 `t2-desktop.png`, E2E `e2e/04~06-*.png`.
> **검증 구분**: 로컬 E2E(로컬 Supabase+dev, 실제 모델) = 템플릿 1·2 통과. **Preview**: 공유 non-prod DB 에서 공개 게이트 4단계(검증 기록 없음 거절 → 실패 사유 거절 → 확인 없이 거절 → 공개)를 실제로 실행해 확인(`[PREVIEW GATE LOG 2026-09-14]` 보관 문제). Preview **UI**(관리자 생성→학생 화면)는 시드 계정이 non-prod 에 없어 미실행 — 제품 오너 UAT 계정으로 확인 필요.

> **템플릿 3(좌표평면, 객체 id) 구현 완료** — `templates/coordinate-plane.ts`(id 기반 점·직선·함수·선분·산점도+추세선, 축 범위·눈금·제목, 곡선은 축 경계에서 끊음, 라벨은 후보 자리 중 겹치지 않는 첫 자리·없으면 거부; lint: 지문 좌표 (x, y) 가 점/그래프 위에 있는지, point/line/f(x) 이름, `y = mx + b`·`y = ax² + bx + c` 식 일치). 옛 `coordinate_plane` 도 레거시(공개 불가, `20261366`). 템플릿 1은 공통 `Sheet` 로 이관(동작 동일, 회귀 23개 유지). 표본 `t3-desktop.png`, E2E `e2e/07~09-*.png`.
>
> **확정 로드맵(2026-09-14 저녁, 제품 오너)** — 수학 문제 템플릿 범위는 백로그가 아니라 이 로드맵에서 대부분 완결한다. 그래프 선택지·복합 도형도 "3차 이후"로 빼지 않는다. 순서: ✅좌표평면 → 표·데이터 그래프(함수표·값 표·빈도표·숫자 목록, 막대·선·히스토그램·산점도·상자그림) → 원·사각형·다각형·좌표기하 → 그래프 선택지·도형 선택지·복합 도형·복수 도형 비교. 수식·선택지(KaTeX, 수식 선택지, 로마숫자 조합)와 SPR 동치 채점은 Block 스키마로 같은 게이트에 넣는다. 각 단위마다 대표 10문항 회귀·로컬 E2E(관리자 미리보기→공개→학생)·Preview 확인 여부를 구분해 보고한다.

## 0. 역할 분리 (모든 자료 유형 공통)

| 층 | 하는 일 | 하지 않는 일 |
|---|---|---|
| **AI** | 문제 유형, 자극 블록, 데이터 값, 관계, 식별자, 라벨, 정답·해설을 **스키마에 맞는 JSON**으로 | SVG·HTML·스타일·임의 좌표·그림 파일 |
| **ALTON 렌더러** (`lib/render/*`) | 템플릿별 조판: 글꼴·크기·여백·선 굵기·축·격자·색·표 간격·수식·라벨 자리·반응형 | 데이터 해석의 재량(입력 그대로 그린다) |
| **검증 계층** (`lib/render/validate/*` + DB 공개 게이트) | 스키마·필수 요소·지문 참조 일치·라벨 중복·충돌·잘림·정답 정합 | 자동 보정(틀리면 **거부**하고 사유를 보여준다) |

같은 렌더러 결과를 관리자 미리보기·학생 풀이 화면·수업 화면·과거 수업 고정 화면(버전 스냅샷)이 그대로 쓴다.
관리자 화면은 JSON 원문이 아니라 **렌더된 큰 미리보기**로 검수하고, `도형 데이터 편집`은 접힌 고급 기능으로 둔다.

## 1. 데이터 스키마 — 우선순위 템플릿

문제 한 판(`problem_versions`)은 아래 **자극 블록 목록**(`stimulus: Block[]`)과 문항·선택지·답으로 구성한다.
(기존 `passage`/`options`/`answers`/`figure`는 마이그레이션 기간 동안 유지하고, 새 열 `stimulus jsonb`·`figure_template
jsonb`를 additive로 추가. 렌더러는 새 열이 있으면 그것을, 없으면 기존 열을 그린다.)

```ts
type Block =
  | { kind: "text"; markdown: string }                     // 지문·문항. 인라인 $…$, 블록 $$…$$ 수식, **굵게**, _밑줄_
  | { kind: "math"; latex: string }                        // 블록 수식(연립방정식 등) — KaTeX displayMode
  | { kind: "table"; caption?: string; columns: string[]; rows: (string|number)[][]; align?: ("l"|"c"|"r")[] }
  | { kind: "number_list"; title?: string; values: (string|number)[] }   // 데이터 집합 "3, 5, 5, 8, 12"
  | { kind: "notes"; title?: string; items: string[] }     // Rhetorical Synthesis 메모 목록(bullet)
  | { kind: "texts"; texts: { title: string; markdown: string }[] }      // Text 1 / Text 2 비교
  | { kind: "quote"; markdown: string; source?: string }
  | { kind: "figure"; template: FigureTemplate }           // 아래 2절
  | { kind: "image"; bucket: string; path: string; alt: string; width?: number }  // 지원 밖 → 관리자 업로드
```

선택지(`options`)는 값만(`"x = 3"` 금지 → `"3"`), 각 선택지는 `Block`과 같은 규칙(텍스트·수식·그래프 템플릿·로마숫자 조합)을
쓸 수 있게 `{ kind: "text" | "math" | "figure" | "roman"; ... }`로 확장한다. 초기엔 text·math·roman만 허용, figure 선택지는 3차.

### 1-1. 텍스트·4지선다·KaTeX·표 (우선 1) — 현재 구현을 스키마로 승격
- 렌더 규칙: 본문 16px/1.75, 표는 헤더 회색 배경·1px 선·숫자 우측 정렬(`align`), 수식은 KaTeX(깨진 수식은 원문+빨간 표시로
  검증 실패 사유에 포함). `_______` 빈칸은 언더바 7개 표준화.
- 검증: 빈칸 문제는 빈칸이 정확히 1개, 선택지 4개·중복 없음, `correct_index` 범위 안, 표 행 길이 = 열 수.

### 1-2. SPR (우선 2) — 현재 구현 유지
- `answers: string[]` 동치 목록, 서버 정규화 비교(`spr_answer_matches`). 검증: 답 1개 이상, 각 답이 SPR 형식(양수 5자·음수 6자·분수/소수).

### 1-3. 좌표평면 (우선 3) — 현재 `coordinate_plane` 스펙을 **의미 중심**으로 재정의
```ts
type PlaneTemplate = {
  template: "coordinate_plane";
  axes: { x: { min: number; max: number; step?: number; title?: string }; y: { …같음 } };
  objects: (
    | { id: string; kind: "line"; through?: [PointRef, PointRef]; slope?: number; intercept?: number; label?: string; style?: "solid"|"dashed" }
    | { id: string; kind: "function"; fn: "linear"|"quadratic"|"exponential"|"abs"|"sqrt"|"cubic"; params: number[]; label?: string; domain?: [number, number] }
    | { id: string; kind: "point"; at: [number, number]; label?: string; open?: boolean }
    | { id: string; kind: "scatter"; points: [number, number][]; fitLine?: { slope: number; intercept: number } }
  )[];
};
```
- 렌더러가 정하는 것: 격자·굵은 축·화살표·원점 O·눈금 간격 자동(`niceStep`)·축 제목 위치·라벨은 곡선과 겹치지 않는 사분면에 자동 배치.
- 검증: 모든 객체가 축 범위 안에 의미 있게 보임(직선은 범위를 가로지름, 점은 범위 안), 라벨 중복 없음, 지문이 참조하는 `id`/라벨 존재.

### 1-4. 기본 기하 (우선 4) — **좌표가 아닌 관계**로 받는다
```ts
type ParallelTransversalTemplate = {
  template: "parallel_transversal";
  parallel: [string, string];                 // 평행선 이름 예 ["m","n"] — 위→아래 순서
  transversals: { id: string; slant?: "left"|"right" }[];   // 횡단선 1~2개 (예 [{id:"k"}])
  points?: { id: string; on: [string, string] }[];          // 교점 이름: 두 선의 교점 예 {id:"A", on:["m","k"]}
  angles: { at: [string, string]; region: "NE"|"NW"|"SE"|"SW"; label: string; right?: boolean }[];
                                                            // 어느 교점(두 선), 어느 사분면, 라벨("x°","37°"), 직각 표시
  notToScale?: boolean;
};

type TriangleTemplate = {
  template: "triangle";
  vertices: [string, string, string];          // 예 ["A","B","C"]
  kind?: "scalene"|"isosceles"|"right"|"equilateral";
  rightAngleAt?: string;                        // 직각 꼭짓점
  sides?: { between: [string, string]; label?: string; tick?: 1|2 }[];   // 길이 라벨, 등변 표시(tick)
  angles?: { at: string; label?: string; arc?: boolean }[];
  altitude?: { from: string };                  // 높이(수선) 필요 시
  notToScale?: boolean;
};

type CircleTemplate = { template: "circle"; center?: string; radius?: { to: string; label?: string }; chords?: …; inscribedAngle?: … };
type QuadTemplate   = { template: "quadrilateral"; kind: "rectangle"|"square"|"parallelogram"|"trapezoid"; vertices: [string,string,string,string]; sides?: …; angles?: … };
```
- 렌더러가 정하는 것: 실제 좌표(표준 배치: 평행선 간격, 횡단선 기울기 55°, 삼각형 표준형·직각은 좌하단), 선 굵기 2px,
  라벨 세리프 15px, 각 호 반지름 14px·직각은 작은 정사각형, 라벨은 호 바깥 사분면 중심 방향으로 밀어 **충돌 검사 뒤 배치**,
  선 이름은 선 끝 바깥, 여백 24px, `Note: Figure not drawn to scale.`는 `notToScale`일 때만 좌하단 기울임체.
- 검증(거부 사유 예): `angles[].at`이 존재하지 않는 선 쌍 → "존재하지 않는 교점 (m,q)"; 같은 라벨 두 번 → "라벨 중복 'B'";
  지문에 나온 `∠ABC`·`x°`·`37°`·점 이름이 데이터에 없음 → "지문의 'C'가 도형에 없음"; 한 교점 같은 사분면에 각 2개 → "충돌";
  템플릿이 만족 못 하는 조건(평행선 3개, 횡단선 3개) → "지원하지 않는 구성 — 직접 SVG/PNG 업로드".
- 대체 설명(alt)은 데이터에서 자동 생성: "평행선 m과 n을 횡단선 k가 가로지른다. m과 k의 교점 위쪽 왼편 각은 x°, n과 k의 교점 아래 오른편 각은 37°."

### 1-5. 데이터 그래프 (우선 5)
```ts
type ChartTemplate = { template: "bar"|"line"|"scatter"; title?: string; x: { title: string; categories?: string[] }; y: { title: string; min?: number; max?: number; step?: number }; series: { name?: string; values: number[] | [number, number][] }[]; legend?: boolean };
```
- 렌더: 막대 폭·간격 비율 고정, 눈금 자동, 범례 우상단, 값 라벨은 옵션. 검증: series 길이 = categories 길이, 범위 안.

### 1-6. 복수 지문·메모·인용·로마숫자 (우선 6) — 1-1의 Block 확장으로 처리, 별도 그림 없음.
### 1-7. 원·복합 기하·복잡한 그래프 (우선 7) — 1-4의 CircleTemplate 등. 그 밖은 업로드로.

## 2. 렌더링 규칙 (공통 디자인 토큰)
- 글꼴: 세리프(Georgia/Times) — 그림 안 라벨·축 숫자. 본문은 서비스 글꼴.
- 선: 도형 2px 검정, 축 2px + 화살표, 격자 0.6px 회색, 보조선 점선.
- 크기: 그림 기본 폭 360px(모바일 100%까지 축소, viewBox 비율 유지), 라벨 15px, 축 숫자 12px, 최소 여백 24px.
- 라벨 배치: 후보 위치 4~8개 중 다른 라벨·선·호와 겹치지 않는 첫 위치. 못 찾으면 **검증 실패**(자동으로 밀어 넣지 않음).
- 접근성: `<svg role="img" aria-label=…>` + `<title>` 자동 생성, 표는 `<table>` 시맨틱.
- 동일 렌더러: `ProblemFigure`(학생·수업), 관리자 미리보기, 수업 준비 미리보기, 문제 기록 모두 `renderStimulus(blocks)` 하나.

## 3. 검증 계층과 공개 게이트
1. **초안 저장 시**(서버 액션 + `create/update_problem_draft_version` RPC): 스키마 검증 실패 → 저장 거부 + 사유 목록.
2. **공개 시**(`confirm_and_publish_problem_version`): (a) 스키마·렌더 검증 통과 기록(`render_check jsonb`: 검사 시각, 렌더러 버전, 경고 0),
   (b) 지문 참조 일치, (c) 관리자가 **렌더된 미리보기에서 확인**(`figure_checked` → `preview_confirmed_at`로 의미 명확화),
   (d) 지문이 그림을 요구하는데("as shown", "in the figure", "graph") 그림 블록이 없거나 검증 실패면 거부.
3. 우회 금지: AI 응답의 SVG/HTML 문자열은 스키마에 없으므로 저장 자체가 안 된다. 좌표 자유 입력(`geometry.shapes`)은 **읽기 전용 레거시**로만 남기고 새 저장은 거부.

## 4. 렌더링 예시
`docs/assets/2026-09-14-render-samples/`에 이 설계의 첫 템플릿 표본을 넣었다(스크린샷 PNG + 입력 JSON). 표본은 별도 스크립트로
만든 **프로토타입** 결과이며, 본 구현은 이 모양을 기준선으로 한다.
- 평행선·횡단선·각도: 입력 `{"template":"parallel_transversal","parallel":["m","n"],"transversals":[{"id":"k"}],"angles":[{"at":["m","k"],"region":"NW","label":"x°"},{"at":["n","k"],"region":"SE","label":"37°"}],"notToScale":true}`
- 삼각형(직각): 입력 `{"template":"triangle","vertices":["A","B","C"],"rightAngleAt":"B","sides":[{"between":["A","B"],"label":"6"},{"between":["B","C"],"label":"8"}],"angles":[{"at":"C","label":"x°","arc":true}]}`
- 좌표평면(현행 렌더러, SAT 스타일 확인용): 직선 y = 2x − 3과 점 (2, 1).

표본에서 보이는 프로토타입의 한계(본 구현의 검증 항목이 되는 이유): 표본 2에서 교점 이름 `B`가 횡단선과 겹치고 `(2x + 10)°` 라벨이
선에 닿는다. 좌표평면 표본에서 점 라벨 `(2, 1)`이 직선 위에 놓인다. 본 구현은 라벨 후보 위치를 선·호·다른 라벨과 **충돌 검사**해
고르고, 못 고르면 검증 실패로 거부한다(자동으로 밀어 넣지 않음).

## 5. 구현 순서와 검증 계획
1. `lib/render/` 골격: `Block`·`FigureTemplate` 타입, `validateStimulus()`(사유 목록 반환), `renderFigure(template)` → SVG 문자열, `renderStimulus()` React.
2. **템플릿 1 평행선·횡단선·각도** 끝까지: 스키마 → 렌더러(라벨 충돌 검사·alt) → AI 도구 스키마 교체(의미만) → 관리자 큰 미리보기(JSON은 접힘) →
   초안 저장·공개 게이트(새 마이그레이션: `stimulus`, `render_check`, 공개 검사 함수) → 학생 화면 → Preview에서 생성→저장→공개→풀이 1건.
3. 템플릿 2 삼각형·직각삼각형, 3 좌표평면 재정의(기존 스펙 → 새 스키마 변환기), 4 표·복수 지문·메모·로마숫자 Block, 5 데이터 그래프, 6 원·사각형.
4. 자동 검증: 템플릿마다 **대표 문제 10개 이상**의 렌더 스냅샷 테스트(`__snapshots__`), 참조 불일치·라벨 중복·충돌 거부 테스트,
   Playwright로 375px·1280px 잘림·겹침 검사(요소 bbox가 viewBox 안), 버전 변경 뒤 과거 수업 고정 화면 스냅샷 유지 테스트.
5. 기존 데이터: `figure`(좌표형)를 가진 초안은 "레거시 도형 — 다시 생성 필요" 표시, 공개 불가. 공개본은 그대로 보이되(고정 화면 유지) 새 버전 만들 때 새 스키마 강제.

## 6. 결정 필요(제품 오너)
- 그림 선택지(선택지 4개가 그래프)는 3차로 미룬다 — 동의 여부.
- 지원 밖 도형의 업로드 그림도 `alt`(대체 설명)와 지문 참조 확인을 **필수**로 할지(권장: 필수).
- 기존 좌표형 `figure` 초안(현재 비공개 몇 건)은 삭제하지 않고 "재생성 필요"로 두는 것으로 진행(권장).
