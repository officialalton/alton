# 수학 자료(그래프·표·도형) 버전 원형 — 카탈로그와 추산 (2026-10-01, 전 범위·선택지형 포함 개정판)

조사 전용 문서(코드·DB 변경 없음). 기준: `lib/problem-figures/*`, `lib/problem-generation/math-archetypes/registry.ts`(hard 328 = 82 세부 패턴 × 4, easy/medium 틀 77). 오너 결정 반영: **빈도가 낮아도 SAT에 나올 수 있는 조합은 전부 포함**(빈도는 제작 순서용), **선택지(답안)가 그림인 유형 포함**, 최소 범위 폐기.

## 0. 핵심 숫자 (전 범위 단일 합계)

| 항목 | 수량 |
|---|---|
| (a) 새 세부 항목 (세부 패턴 × 자료 종류 × 자료 위치) | **303** |
| 　├ 기존 82개 세부 패턴에 자료 버전 추가 | 207 (자료가 붙는 패턴 81개) |
| 　├ 원형이 아직 없는 SAT 세부 패턴 50개의 자료 버전(새 패턴 핵부터 설계) | 96 |
| 　└ 위치별: 자료가 지문 241 / **선택지형 55** / 지문+선택지 둘 다 7 |  |
| (b) 새 hard 원형 (항목 × 4) | **1,212** (선택지형 62항목 = 248 포함) |
| (c) 새 easy/medium 틀 (항목 × 2~3) | **606 ~ 909** (선택지형 124 ~ 186 포함) |
| (d) 활용 figure 템플릿 종류 | 31 (앱 지원 19 + 신규/확장 12) |
| (d) 앱에 추가 구현할 렌더러 | **12** — 신규 8(수직선, 줄기-잎, 원그래프, 도수다각형·누적, 스택 막대, 벤·수형도, 단위원, 삼각함수 곡선) + 기존 확장 4(삼각형 중첩·내부 평행선, 복합 입체·대각선·단면, L자형 합성 다각형, 평행선 3개 이상) |
| (d) 앱 인프라 추가 | 2 — 선택지 정답 검증기 일반화, B형(지문+선택지 자료) 스키마 |
| 단계별(제작 순서용): 1 표 계열 / 2 그래프 계열 / 3 도형 계열 | 56 / 181 / 66 항목 → hard 224 / 724 / 264 → EM 112~168 / 362~543 / 132~198 |
| 원형 신규 작성 난이도(303항목): 재사용 / 조정 / 신규 핵 | 33 / 110 / 160 |
| 대략 작업량(사람·일, 거친 추정) | 약 260 (원형 223 + 렌더러 29 + 연결·선택지 인프라 8 + 커버리지 게이트 3) |

해석:
- 지금 있는 hard 328개의 약 3.7배를 새로 만드는 규모다. 앱의 렌더러는 이미 31종 중 19종을 지원한다. **병목은 렌더러(12종, 약 29일)보다 원형 핵 신규 설계 160항목과 선택지형 오답 설계**다.
- 앱 지원 상태별(303항목): 지원 197 / 부분 50(선택지 검증 확장 필요) / 미지원 56(신규 렌더러 49 + B형 스키마 7).
- 근거 수준: E1(우리 커버리지 기준선 문서에 명시) 83 / E2(SAT 출제 범위 지식) 111 / **E3(희귀하지만 가능성 있어 보수적으로 포함) 109**. E3는 오너가 원하면 제작 순서 맨 뒤로 보낼 수 있다(제외가 아님).
- SAT 빈도(제작 순서용, 추정): 상 73 / 중 120 / 하 110. 연습시험 PDF는 텍스트 추출이라 그림 정보가 없어(`docs/qa/2026-09-30-collegeboard-hard-characteristics.md` 9행) 실측 근거가 없다 — 전부 추정.
- 항목 수 상한 가정이라 실제로는 일부 항목이 hard 4개를 못 채울 수 있다(연산자와 자료가 안 맞는 경우, 최대 -15% 추정).

## 1. 앱의 그림·표 지원 범위 (코드 확인)

저장: `problem_versions.figure jsonb` + `figure_checked`(마이그레이션 20261361). 검증: `checkFigure(figure, passage, options, correctIndex)`(`lib/problem-figures/check.ts`, renderer `std-1`) = 스키마 → LaTeX 누출 거부 → 템플릿별 `lint*AgainstText`(지문이 가리키는 이름·값이 그림에 있는지) → "as shown/the figure/the graph"인데 그림 없음 = `figure_required`. 공개 게이트는 `ok=true` + 그림 해시 일치. 그림 라벨은 평문(KaTeX 미적용). 템플릿 목록은 `TEMPLATE_FIGURE_TYPES`(spec.ts).

| 종류 | type / kind | 상태 | 비고 |
|---|---|---|---|
| 값·함수표, 빈도표 | `data` / `table` | 지원 | `<table>`, 열 2~8·행 1~20 |
| 이원표(합계 자동) | `data` / `two_way` | 지원 | |
| 숫자 목록 | `data` / `number_list` | 지원 | |
| 막대(복수 계열) | `data` / `bar` | 지원 | 스택·비율 막대 없음 |
| 선그래프 | `data` / `line` | 지원 | 범주 축 기준(숫자 축 도수다각형·누적은 없음) |
| 히스토그램 | `data` / `histogram` | 지원 | |
| 점도표 | `data` / `dot_plot` | 지원 | |
| 상자그림(복수) | `data` / `boxplot` | 지원 | |
| 산점도+직선 추세선 | `data` / `scatter` | 지원 | 곡선 적합·잔차도는 `plane` scatter + function/line 으로 가능 |
| 문장형 자료 | `data` / `statement` | 지원 | 표본·오차범위·연구 설계 |
| 좌표평면: 점·직선·선분·함수(linear/quadratic/exponential/abs/sqrt/cubic/rational)·조각함수·부등식 음영·산점도·다각형·원·중점·교점·변환(평행이동·대칭·확대·회전) | `plane` | 지원 | 삼각함수 곡선 없음. 구 `coordinate_plane`·`geometry`는 레거시(표시만) |
| 평행선·횡단선·각 | `parallel_transversal` | 지원 | 평행선 3개 이상 미구현(코드 주석에 명시) |
| 삼각형(직각·이등변·정삼각형)·합동·닮음(옆에 두 번째 삼각형)·높이 | `triangle` | 지원 | 삼각형 안 평행선·중첩 닮음 없음 |
| 원: 반지름·현·호·부채꼴·접선·중심각·원주각 | `circle` | 지원 | |
| 사각형·정n각형 | `polygon` | 지원 | 마름모 높이 미지원, L자형 합성 없음 |
| 입체: 직육면체·정육면체·원기둥·원뿔·구·정사각뿔 | `solid` | 지원 | 치수는 라벨 문자열, 대각선·단면·복합 입체 없음 |
| 복합 도형 음영(정사각형 안 원 등) | `composite` | 지원 | |
| 그래프·도형 선택지 | `figure_choice` | 지원(부분) | 아래 1-1 |
| 복수 자료(Figure A / Table B) | `figure_set` | 지원 | |
| 업로드 이미지 | `image` | 수작업용 | 자동 생성 경로에 쓰지 않음 |
| **미지원**: 수직선, 줄기-잎, 원그래프, 도수다각형·누적(오자이브), 스택·비율 막대, 벤·수형도, 단위원·표준위치 각, 삼각함수 곡선, 복합 입체·대각선·단면, L자형 합성 다각형, 삼각형 중첩 | — | 미지원 | 12종 신규·확장 |
| 범위 밖(제외 근거 있음) | 3D 좌표(공간좌표·벡터)·전개도 | 제외 | `docs/2026-09-14-sat-math-coverage-matrix.md` 판정: Digital SAT Math 세부 기술에 없음 |

마크다운 표: `lib/render-learning-content.ts`가 지문 안 파이프 표를 `table` 블록으로 렌더하고(한 줄로 눌린 표도 복구) `LearningText`가 표시한다. 단 마크다운 표는 `checkFigure`·참조 lint·alt 밖이라 폴백으로만 쓴다.

원형 쪽 현황: `Instance`(types.ts)에 `figure` 필드가 없고 `bulk.ts`·`levels-d.ts`가 조립 시 `figure: null, needsFigure: false`로 고정한다(두 파일의 `checkContent` 호출도 `figure: null`). AI 생성 파이프라인(`core.ts` `FigurePolicy`: `require_figure_choice` 등)은 이미 figure·figure_choice를 다룬다.

### 1-1. figure_choice 지원 범위와 부족분
이미 있는 것(`lib/problem-figures/templates/figure-choice.ts`): 선택지 4개를 같은 축·눈금·크기·여백으로 나란히 렌더, 정답을 암시하는 보조 점·라벨·색 거부, `placeCorrectChoice`(선택지 i ↔ 그림 i, 정답 자리 배치), 자식 type 허용 목록 `plane/parallel_transversal/triangle/circle/polygon/solid/composite/data`(`CHILD_TYPES_ALLOWED`), 지문의 식(일차 y=mx+b, 이차 일반형·꼭짓점형, 절댓값)과 같은 그래프가 선택지에 정확히 몇 개인지 세는 `equationChoices`.

부족분:
1. **정답 재계산 검증이 식→그래프 한 경로뿐이다.** 표·서술→그래프, 그래프 변환 결과, 연립·부등식 영역, 원 이동, 산점도 추세선, 히스토그램 비교 같은 선택지형은 기계 검증이 없다 → 일반 검증기 필요(5-4).
2. 자식 허용 목록에 신규 렌더러(수직선·단위원·삼각함수 곡선·원그래프 등)가 없다 → 렌더러마다 등록 + 같은 크기 규칙 적용.
3. **B형(지문에도 자료, 선택지도 자료)**은 스키마가 없다: `figure`는 jsonb 하나이고 `figure_choice` 자식에 stem 슬롯이 없다. `figure_choice.stem` 필드 추가 또는 `figure_set`에 선택지 자식 허용 필요(7항목).
4. 표·막대·히스토그램 선택지(`data` 자식)는 허용되나 선택지 4개의 같은 크기 규칙·편향 검사가 `plane` 중심으로 짜여 있어 확인·보강이 필요하다(부분 지원으로 표기).
5. 현재 선택지 라벨·점 금지 규칙은 "정답 암시"를 막는 용도이므로 유지하되, 오답이 "의도한 오답 규칙"을 따르는지 확인하는 검사는 없다(부록 C 규칙 id 선언 + 검사 필요).

## 2. SAT에서 skill별로 붙는 자료 종류와 빈도 (전부 추정)

근거: 앱의 커버리지 기준선(skill별 필요 자료 블록) + 일반 지식. 연습시험 분석 산출물에는 그림 정보가 없어 문항 대조는 불가. "그림 동반율"은 해당 skill 문항 중 표·그래프·도형이 붙는 비율의 거친 추정이고, 선택지가 그림인 문항(그래프 고르기·변환 결과·수직선·표·도형 고르기)은 지문 자료와 별도로 있다.

| skill | 주로 붙는 자료(많은 순) | 선택지가 자료인 유형 | 그림 동반율(추정) |
|---|---|---|---|
| linear_functions | 직선 그래프, 값 표 | 식·표에 맞는 그래프, 두 점을 지나는 그래프 | 50~60% |
| linear_equations_two_var | 연립/직선 그래프, 값 표 | 식에 맞는 그래프 | 40~50% |
| systems_linear | 두 직선 그래프, 가격 표 | 연립에 맞는 그래프 | 25~35% |
| linear_inequalities | 음영 그래프, 수직선, 값 표 | 해집합 수직선, 음영 그래프 | 30~40% |
| linear_equations_one_var | 거의 없음 | — | <10% |
| nonlinear_functions | 포물선·지수 곡선, 값 표 | 식·설명에 맞는 그래프, 변환 결과 그래프, 지수 표 | 55~65% |
| nonlinear_equations_systems | 포물선+직선 그래프, 원 그래프 | 해 개수에 맞는 그래프, 원의 방정식 그래프 | 25~35% |
| equivalent_expressions | 거의 없음(면적 모형) | — | <5% |
| ratios_rates_units | 값 표, 직선·막대·원그래프 | 비례 관계 그래프 | 20~30% |
| percentages | 막대·선·원그래프·표 | — | 35~45% |
| one_variable_data | 점도표, 도수표, 히스토그램, 상자그림, 줄기-잎, 누적 | 분포 비교(표준편차·평균) 그래프 고르기 | 85~95% |
| two_variable_data | 산점도+추세선, 이원표, 선그래프, 잔차도 | 연관 방향·추세선·모델 곡선 고르기 | 90~95% |
| probability | 이원표, 빈도표, 원그래프(스피너), 벤·수형도 | — | 60~70% |
| inference_margin_error | 문장형 자료, 신뢰구간 수직선 | 구간 수직선 | 10~20% |
| evaluating_statistical_claims | 문장형 자료, 간단한 표·막대 | — | 10~20% |
| area_volume | 사각형·입체·복합 도형·음영 영역 | 조건에 맞는 도형 | 75~85% |
| lines_angles_triangles | 삼각형·평행선 그림 | 조건에 맞는 삼각형, 닮음·합동 도형 | 90% |
| right_triangles_trigonometry | 직각삼각형, 단위원, (드물게) 삼각함수 곡선 | 단위원·삼각 곡선 고르기 | 85~90% |
| circles | 원 그림, 좌표평면 원 | 방정식에 맞는 원 그래프 | 75~85% |
| coordinate_geometry(SAT는 기하 skill에 포함) | 좌표평면 도형·변환·넓이 | 변환 결과 도형 고르기 | 70~80% |

## 3. 합계 표

### 3-1. 자료 종류별(31종) × 위치

| 자료 종류 | 렌더 템플릿 | 앱 지원 | 단계 | 지문 | 선택지 | 둘 다 | 항목 합 |
|---|---|---|---|---|---|---|---|
| 사각형·다각형 | polygon | 지원 | 3 | 6 | 1 | 0 | 7 |
| 값·함수표 | data.table | 지원 | 1 | 36 | 2 | 0 | 38 |
| 직선·연립·음영 그래프 | plane.line/inequality | 지원 | 2 | 25 | 14 | 1 | 40 |
| 막대그래프 | data.bar | 지원 | 2 | 10 | 0 | 0 | 10 |
| 원그래프 | data.pie | 신규/확장 | 2 | 8 | 0 | 0 | 8 |
| 이원표 | data.two_way | 지원 | 1 | 5 | 1 | 0 | 6 |
| 도수·빈도표 | data.table | 지원 | 1 | 6 | 0 | 0 | 6 |
| 벤·수형도 | venn_tree | 신규/확장 | 2 | 3 | 0 | 0 | 3 |
| 함수 곡선 그래프(값 읽기) | plane.function | 지원 | 2 | 23 | 13 | 1 | 37 |
| 수직선(부등식·구간·점) | number_line | 신규/확장 | 2 | 4 | 3 | 0 | 7 |
| 삼각형·직각삼각형 | triangle | 지원 | 3 | 14 | 2 | 2 | 18 |
| 평행선·횡단선 | parallel_transversal | 지원 | 3 | 4 | 1 | 0 | 5 |
| 삼각형 내부 평행선·중첩 | triangle 확장 | 신규/확장 | 3 | 3 | 0 | 0 | 3 |
| 좌표평면 도형·원·변환 | plane.polygon/circle/transform | 지원 | 2 | 10 | 4 | 2 | 16 |
| 복합 입체·대각선·단면 | solid 확장 | 신규/확장 | 3 | 6 | 0 | 0 | 6 |
| 단위원·표준위치 각 | unit_circle | 신규/확장 | 2 | 2 | 1 | 0 | 3 |
| 삼각함수 곡선 | plane.function(sin/cos) | 신규/확장 | 2 | 2 | 1 | 0 | 3 |
| 점도표 | data.dot_plot | 지원 | 2 | 5 | 1 | 0 | 6 |
| 히스토그램 | data.histogram | 지원 | 2 | 6 | 2 | 0 | 8 |
| 줄기-잎 그림 | data.stem_leaf | 신규/확장 | 2 | 5 | 0 | 0 | 5 |
| 도수다각형·누적 그래프 | data.frequency_polygon/ogive | 신규/확장 | 2 | 5 | 0 | 0 | 5 |
| 상자그림 | data.boxplot | 지원 | 2 | 5 | 1 | 0 | 6 |
| 누적(스택)·비율 막대 | data.bar 확장(stacked) | 신규/확장 | 2 | 4 | 0 | 0 | 4 |
| 산점도(+추세선·곡선) | data.scatter / plane.scatter | 지원 | 2 | 9 | 5 | 0 | 14 |
| 선그래프 | data.line | 지원 | 2 | 6 | 0 | 0 | 6 |
| 문장형 자료 | data.statement | 지원 | 1 | 6 | 0 | 0 | 6 |
| 복합 도형 음영 | composite | 지원 | 3 | 6 | 1 | 0 | 7 |
| L자형 합성 다각형 | polygon 확장 | 신규/확장 | 3 | 1 | 0 | 0 | 1 |
| 입체(기둥·뿔·구) | solid | 지원 | 3 | 7 | 1 | 1 | 9 |
| 원(호·부채꼴·각·접선) | circle | 지원 | 3 | 8 | 1 | 0 | 9 |
| 평행선 3개 이상 | parallel_transversal 확장 | 신규/확장 | 3 | 1 | 0 | 0 | 1 |
### 3-2. skill별 (hard = 항목 × 4)

| skill | 기존 패턴 확장 항목 | 신규 패턴 항목 | 선택지형 | 둘 다 | 항목 합 | hard 원형 |
|---|---|---|---|---|---|---|
| equivalent_expressions | 2 | 0 | 0 | 0 | 2 | 8 |
| ratios_rates_units | 7 | 0 | 1 | 0 | 7 | 28 |
| linear_equations_one_var | 4 | 0 | 0 | 0 | 4 | 16 |
| probability | 11 | 2 | 0 | 0 | 13 | 52 |
| nonlinear_equations_systems | 16 | 2 | 5 | 0 | 18 | 72 |
| nonlinear_functions | 15 | 16 | 10 | 1 | 31 | 124 |
| linear_inequalities | 8 | 4 | 5 | 0 | 12 | 48 |
| linear_functions | 13 | 4 | 4 | 1 | 17 | 68 |
| linear_equations_two_var | 11 | 0 | 3 | 0 | 11 | 44 |
| systems_linear | 8 | 2 | 3 | 0 | 10 | 40 |
| lines_angles_triangles | 11 | 10 | 3 | 2 | 21 | 84 |
| right_triangles_trigonometry | 8 | 8 | 2 | 0 | 16 | 64 |
| one_variable_data | 24 | 13 | 4 | 0 | 37 | 148 |
| two_variable_data | 16 | 9 | 6 | 0 | 25 | 100 |
| inference_margin_error | 8 | 0 | 1 | 0 | 8 | 32 |
| percentages | 16 | 0 | 0 | 0 | 16 | 64 |
| area_volume | 15 | 9 | 3 | 1 | 24 | 96 |
| circles | 14 | 5 | 3 | 1 | 19 | 76 |
| evaluating_statistical_claims | 0 | 5 | 0 | 0 | 5 | 20 |
| coordinate_geometry | 0 | 7 | 2 | 1 | 7 | 28 || **합계** | 207 | 96 | 55 | 7 | **303** | **1,212** |

(선택지형·둘 다 열은 항목 합에 이미 포함된 내역이다. 82개 패턴 중 자료 버전이 없는 것은 rational_equivalence 1개뿐이다 — 서술·식만으로 성립하고 SAT에서 표·그래프가 붙는 형태가 확인되지 않았다. 다른 6개 "자료 없음 후보"(solve, literal_rearrange, irrational 3종, sample_size_effect)도 가능성이 낮은 E3 조합으로 보수적 포함했다.)

### 3-3. 단계(제작 순서용)

| 단계 | 자료 종류 | 항목 | hard | EM 틀 | 새 렌더러 |
|---|---|---|---|---|---|
| 0 공통 기반 | Instance.figure, figure-kit, FIGURE 주입 검증, 선택지 검증기, 커버리지 게이트 | — | — | — | 인프라 2 + 게이트 |
| 1 표·문장 계열 | 값표·도수표·이원표·문장형 | 56 | 224 | 112~168 | 0 |
| 2 그래프 계열 | 막대·히스토그램·점도표·상자·산점도·선·곡선·직선·좌표평면·수직선·줄기-잎·원·누적·벤·단위원·삼각 곡선 | 181 | 724 | 362~543 | 신규 8 |
| 3 도형 계열 | 삼각형·원·평행선·사각형·입체·복합 | 66 | 264 | 132~198 | 확장 4 |
| **합** | | **303** | **1,212** | **606~909** | **12** |

선택지형(62항목)은 각 자료 종류의 단계에 포함되며 단계 2 시작 시 선택지 검증기(0단계)가 먼저 있어야 한다.

### 3-4. 렌더러 추가 목록 (12종)

| 렌더러 | 종류 | 쓰는 항목 수 | 난이도(일) | 비고 |
|---|---|---|---|---|
| number_line (수직선: 해집합·열린/닫힌 점·구간·신뢰구간) | 신규 | 7 | 하-중(2) | 선택지 자식으로도 등록 |
| data.stem_leaf (줄기-잎) | 신규 | 5 | 하(1.5) | HTML 조판 가능 |
| data.pie (원그래프, 스피너 겸용) | 신규 | 8 | 중(2) | 라벨 겹침 검사 |
| data.frequency_polygon / ogive (숫자 축 도수다각형·누적) | 신규 | 5 | 중(2) | line 확장 |
| data.bar stacked / percent-stacked | 확장 | 4 | 하-중(1.5) | |
| venn_tree (벤·수형도) | 신규 | 3 | 중(3) | |
| unit_circle (단위원·표준위치 각, 라디안 라벨) | 신규 | 3 | 중(3) | |
| plane sin/cos 곡선 (진폭·주기·이동 params) | 확장 | 3 | 하(2) | FnKind 추가 |
| triangle 확장 (내부 평행선·중첩 닮음·보조선) | 확장 | 3 | 중(3) | |
| solid 확장 (복합 입체·공간 대각선·단면) | 확장 | 6 | 중-상(5) | 치수 라벨 검증 확장 |
| polygon 확장 (L자형 합성) | 확장 | 1 | 중(2) | |
| parallel_transversal 3개 이상 | 확장 | 1 | 하-중(2) | |

합계 약 29일. 이 외 인프라: 선택지 일반 검증기·B형 스키마(약 5일), Instance.figure·kit·검증 주입(약 3일).

## 4. 가정과 불확실성

1. 항목 = (세부 패턴, 자료 종류, 자료 위치). 같은 조합 안의 변형(행 수·점 개수·값 범위)은 항목이 아니라 생성기 난수/variant. 선택지형은 지문형과 **별도 항목**이다(오답 그래프 설계가 다름).
2. 적용 가능 여부는 보수적이다: 연습시험·공개 문항 유형에 한 번이라도 나올 수 있으면 포함. 근거 E3 109항목은 확신이 낮은 포함분이다. 반대로 3D 좌표·전개도는 SAT 범위 밖이라 제외(근거: 기존 문서 판정).
3. 신규 SAT 세부 패턴 50개(부록 B)는 우리 82개 패턴표에 없는 유형이다(특히 evaluating_statistical_claims skill 전체가 원형 레지스트리에 없음). 이 항목은 "자료 추가"가 아니라 패턴 자체의 신규 설계이므로 난이도를 '신규 핵'으로 셌다. 패턴 목록의 완전성은 SAT 공식 도메인·기술 목록 지식에 의존하며, 빠진 패턴이 있을 수 있다 — 커버리지 게이트의 manifest에 추가하면 자동으로 강제된다.
4. hard = 항목 × 4, EM = 항목당 2~3(지시 그대로). 연산자 8종 중 자료와 맞는 4개를 고르지 못하는 항목이 있을 수 있어 실제 수량은 최대 15% 낮아질 수 있다.
5. 작업량: 재사용 0.25 / 조정 0.5 / 신규 핵 1 (항목당, hard 4 + EM 2~3 포함, AI 보조 전제) → 33×0.25 + 110×0.5 + 160×1 = 223. 렌더러 29 + 인프라 8 + 게이트 3. 병렬 세션이 가능하면 달력 기간은 크게 단축되나 같은 파일(registry·figure-kit) 충돌을 피하려면 skill별 분담이 필요. 오차 ±40% 가정.
6. 렌더 품질(SAT 수준 레이아웃)은 `checkFigure` 통과와 별개다. Preview 스크린샷 대조는 아직 하지 않았다.
7. 정확한 SAT 문항 빈도는 실측하지 못했다. 오너가 문제집을 직접 대조해 빈도·E3 항목을 정정하면 manifest 한 곳만 고치면 된다.

## 5. 구현 방식 권장

### 5-1. Instance에 figure 붙이기 (단일 원천)
- `Instance`에 `figure?: unknown`을 추가하고 `bulk.ts`/`levels-d.ts`의 `figure: null, needsFigure: false`를 `figure: inst.figure ?? null, needsFigure: !!inst.figure`로, `checkContent`의 `figure`도 실제 값으로 넘긴다.
- 생성기는 **수치 파라미터를 먼저 뽑고 → figure 객체 생성 → 지문은 "the table / the graph shown"으로 가리킨다.** 지문에 값을 중복 서술하지 않는다(SAT처럼 정보가 자료에만 있음). figure 빌더는 `math-archetypes/figure-kit.ts`(신규)에 모은다(`tableFig`, `twoWayFig`, `scatterFig`, `planeLine`, `planeQuadratic`, `numberLineFig`…).
- 표는 마크다운이 아니라 `data.table`로 낸다(참조 lint·alt·해시 게이트 적용). 마크다운 표는 폴백.
- 원형 id 규칙 확장: `<skill>.<kind>.<fig>.<loc>.<operator>` (예 `lf.interpret_slope.LG.C.inverse`).

### 5-2. 정답 재계산 검증이 figure 데이터에서도 되게
- `verificationJs`에 **`FIGURE`(지문형) 또는 `CHOICES`(선택지형) JSON을 상수로 주입**하고 그 안의 값만 읽어 재계산한다(dots로 중앙값, cells로 조건부 비율, points로 회귀 기울기, 직선 params로 교점). 생성기 내부 변수는 접근 불가(독립 경로 원칙 유지).
- 이중 검사: (i) 지문이 인용하는 값 ↔ figure 일치(기존 `lint*AgainstText` 재사용), (ii) 선택지 값이 오답 경로 선언과 부합, (iii) **자료 의존 검사**: 지문 텍스트의 숫자만으로 verificationJs를 돌려 답이 나오면 "자료 없이 풀림" 경고(자료 버전인데 자료가 장식인 경우를 잡는다), (iv) 돌연변이: figure 수치 1칸을 바꾸면 검증이 실패해야 한다(검증이 실제로 figure를 읽는지).

### 5-3. 렌더 검사 연동
소비 경로는 기존과 같다: 생성 → `checkFigure(figure, passage, options, correctIndex)` → `render_check` → 공개 게이트. 원형 테스트에 "figure 있는 원형은 `ok===true`, `figure_required` 없음"을 추가한다. 시드 N개 스윕의 `checkFigure` 실패율을 지표로 삼고, 라벨 겹침·잘림이 난수에서 나오지 않도록 생성기 값 범위를 제한한다.

### 5-4. 선택지가 그림인 문항 (선택지형 55 + 둘 다 7)
- 생성기는 **정답 그림 + 오답 그림 3개를 같은 축·크기**로 만들고, `options=['A','B','C','D']`, `correctIndex`는 `placeCorrectChoice`로 정한 자리, `figure = {type:'figure_choice', choices:[...]}`로 낸다. B형은 `stem` 슬롯(스키마 확장) 필요.
- **일반 선택지 검증기**(신규): 생성기가 `predicate(choice)`(그 항목의 의미 조건, 예 "기울기 2·y절편 -3인 직선", "꼭짓점 (h,k)·a<0", "구간 (−∞,3] 닫힌 점") JS와 오답 규칙별 `diagnose(choice)`를 제공 → verify가 4개 선택지 JSON에 적용해 (1) 정답만 predicate 참, (2) 오답 3개는 각각 선언한 오답 규칙 id를 반환, (3) 서로 같은 그림 없음, (4) 정답 자리 분포(시드 스윕 시 A~D 편향 한계)를 확인한다. 기존 `equationChoices`는 이 검증기의 특수 경우로 흡수.
- 오답은 단순 무작위가 아니라 **의도한 실수 규칙**으로 만든다(부록 C). 규칙마다 id를 `distractors[].kind`/`reason`에 남겨 해설·분석에 쓴다.
- 편향 방지(기존 유지): 오답에만 보조 점·라벨·색 차이를 두지 않는다.

### 5-5. 커버리지 게이트 — 대량 생성 시작 전 자동 테스트 설계
목표: **모든 조합이 hard 4개 + easy/medium 틀 + 렌더 검사 + 정답 재계산 검증을 통과해야만 대량 생성을 시작**한다.

구성:
1. `math-archetypes/figure-coverage-manifest.ts`: 모든 조합을 한 줄씩 기계가 읽는 단일 목록으로 둔다(항목 id=`<skill>.<kind>.<fig>.<loc>`, 빈도, 근거 E1~E3, 필요 렌더러, 단계). 이 문서 부록 A·B의 303행이 초기 내용이다. 항목을 추가·삭제하는 것은 이 파일 변경(리뷰 대상)뿐이다. 면제(waiver)는 `{id, 사유, 승인자}` 필수, 전체 면제 상한 15%.
2. `figure-coverage.test.ts`(vitest) 검사:
   - G1 manifest 완전성: 레지스트리의 82 패턴(+ 신규 패턴)이 manifest에 모두 있거나 "자료 없음 사유"가 명시돼 있다. manifest 밖의 자료 원형 id가 없다.
   - G2 수량: 항목마다 hard 원형이 **서로 다른 연산자 4개**, easy/medium 틀 ≥ 2. 모자라면 실패(면제 목록 제외).
   - G3 렌더러 준비: manifest가 요구하는 렌더러가 `TEMPLATE_FIGURE_TYPES`/`CHILD_TYPES_ALLOWED`에 등록돼 있다. 미구현 렌더러를 쓰는 항목이 있으면 "blocked"로 실패.
   - G4 스윕: 원형마다 시드 200개 — 생성 실패(`GenFail`) 0(허용치는 면제로만), `Instance.figure` 존재(위치 P: 단일 figure, C: `figure_choice` 4개, B: stem+선택지), `checkFigure.ok` 100%, `checkContent` 통과.
   - G5 정답 재계산: `verificationJs`가 `FIGURE`/`CHOICES`만으로 정답과 일치, 자료 의존 검사 통과(지문 단독으로 풀리지 않음), C형은 predicate가 정답 1개만 참·오답 3개가 선언된 오답 규칙대로 실패.
   - G6 돌연변이: figure 수치 변조·정답 선택지 교환 시 검증 실패(검증기 자체의 감도 확인).
   - G7 분포·중복: 항목별 variant ≥ 3, 정답 자리 편향 한계, 시드 200 내 지문 중복(핑거프린트) < 2%.
   - G8 시각 승인 기록: `figure-visual-approved.json`에 항목별 대표 1건의 Preview 스크린샷 승인(실행 ID·날짜)이 있는지만 자동으로 확인(눈 확인은 사람).
3. 대량 생성 실행기는 시작 시 `coverage-gate-report.json`(위 테스트가 쓴 요약: ok, 항목 수, 실패 항목)을 읽어 `ok=false`면 거부한다. 기본은 전 범위 게이트. 단계별 선행 생성이 필요하면 오너 승인 시에만 `--allow-stage N`(해당 단계 항목만 통과하면 허용)로 연다.
4. CI에는 빠른 부분(G1~G3, 시드 20개 스모크)만, 전체(G4~G7, 시드 200)는 수동/야간 실행. 실행 시간은 303항목 × 4 원형 × 200시드 ≈ 24만 생성이라 `vm` 검증 포함 시 분 단위가 아니라 십 분 단위로 가정(병렬 워커 권장, 이미 있는 `math-archetype-sweep.json` 스윕 방식 재사용).

### 5-6. 파일럿 제안: two_variable_data (표 + 산점도 + 선택지형)
범위: 이원표·산점도·선그래프 항목 13개 + 선택지형 인프라 검증용 신규 패턴 1개(association_direction_strength: 산점도 지문형·선택지형 2항목) = **15항목 → hard 60, EM 30~45**. 스택 막대 3항목(cell/row_total/conditional_share)은 새 렌더러가 필요해 파일럿에서 뺀다(단계 2에서).
앱 지원 완비(렌더러 신규 0), 기존 원형이 문장·좌표 서술형이라 재사용 비율이 높고, 선택지형(이원표 고르기 1, 산점도 추세선 고르기 2, 연관 방향 고르기 1)으로 검증기를 함께 시험한다.

인수 기준:
1. `Instance.figure` + `figure-kit` + `FIGURE`/`CHOICES` 주입 검증 + 선택지 일반 검증기가 들어가고 기존 328+77 원형 회귀 테스트가 그대로 통과(figure 없는 원형 무영향).
2. 15항목 × hard 4 = 60개 원형이 시드 200 스윕에서 생성 실패 0, 정답 재계산 불일치 0, `checkFigure.ok` 100%, 자료 의존 검사 100%, 돌연변이 검사 통과.
3. 선택지형 4항목: predicate가 정답 1개만 참, 오답 3개가 선언한 규칙으로 실패, 정답 자리 분포 편향 한계 이내.
4. 커버리지 게이트 G1~G8의 two_variable_data 부분이 통과(manifest·수량·렌더러·스윕·승인 기록).
5. 항목당 대표 1건(총 15건) Preview 스크린샷을 데스크톱·375px로 눈 확인(라벨 겹침·잘림·추세선 위치).
6. 공개 게이트(`render_check` + 그림 해시) 통과 문항 20개를 비프로덕션 DB에 적재해 학생 화면까지 확인(UAT 실행 ID 사용, 종료 후 정리).
7. 소요 예상 8~10일(인프라 8 + 15항목). 결과로 항목당 실작업량을 보정해 전체 추산(약 260일)을 갱신.

제작 순서 권장: 0단계(인프라·게이트) → 파일럿 → 1단계 표 계열 → 2단계(앱 지원 렌더러 항목 먼저, 신규 렌더러 항목은 렌더러 구현과 함께) → 3단계. 빈도 상 → 중 → 하 순은 각 단계 안에서 적용.

## 부록 A. 기존 82개 세부 패턴 × 자료 종류 × 위치 (207항목)

"기존 원형" 열: 재사용 = 풀이 핵·verificationJs 유지하고 값만 figure로 이동, 조정 = 핵 일부 재사용 + figure에서 읽는 단계 추가·문장 재작성, 신규 핵 = 새로 설계(선택지형·새 렌더러 포함). 앱 지원: 지원 / 부분(선택지 검증 확장 필요) / 미지원(신규 렌더러 또는 B형 스키마). 근거 E1·E2·E3은 위 4절 참조.

| 세부 패턴 | 자료 종류 | 자료 위치 | SAT 빈도(제작 순서용) | 기존 원형 | 필요 렌더 | 앱 지원 | 근거 | 단계 |
|---|---|---|---|---|---|---|---|---|
| equivalent_expressions.polynomial_distribution | 사각형·다각형 | 지문 | 하 | 조정 | polygon | 지원 | E3 | 3 |
| equivalent_expressions.polynomial_distribution | 값·함수표 | 지문 | 하 | 조정 | data.table | 지원 | E3 | 1 |
| equivalent_expressions.rational_equivalence | — | — | — | 자료 없음(서술·식만) | — | — | — | — |
| ratios_rates_units.proportion | 값·함수표 | 지문 | 상 | 재사용 | data.table | 지원 | E1 | 1 |
| ratios_rates_units.proportion | 직선·연립·음영 그래프 | 지문 | 중 | 조정 | plane.line/inequality | 지원 | E1 | 2 |
| ratios_rates_units.proportion | 직선·연립·음영 그래프 | 선택지 | 중 | 신규 핵 | plane.line/inequality | 부분(figure_choice 지원, 정답 검증 확장 필요) | E2 | 2 |
| ratios_rates_units.proportion | 막대그래프 | 지문 | 하 | 조정 | data.bar | 지원 | E3 | 2 |
| ratios_rates_units.proportion | 원그래프 | 지문 | 하 | 조정 | data.pie | 미지원(신규 렌더러) | E3 | 2 |
| ratios_rates_units.chained_conversion | 값·함수표 | 지문 | 중 | 조정 | data.table | 지원 | E2 | 1 |
| ratios_rates_units.chained_conversion | 직선·연립·음영 그래프 | 지문 | 하 | 조정 | plane.line/inequality | 지원 | E3 | 2 |
| linear_equations_one_var.solve | 직선·연립·음영 그래프 | 지문 | 하 | 조정 | plane.line/inequality | 지원 | E3 | 2 |
| linear_equations_one_var.word_problem_translate | 값·함수표 | 지문 | 하 | 조정 | data.table | 지원 | E3 | 1 |
| linear_equations_one_var.word_problem_translate | 직선·연립·음영 그래프 | 지문 | 하 | 조정 | plane.line/inequality | 지원 | E3 | 2 |
| linear_equations_one_var.literal_rearrange | 사각형·다각형 | 지문 | 하 | 조정 | polygon | 지원 | E3 | 3 |
| probability.simple | 이원표 | 지문 | 상 | 재사용 | data.two_way | 지원 | E1 | 1 |
| probability.simple | 도수·빈도표 | 지문 | 상 | 재사용 | data.table | 지원 | E1 | 1 |
| probability.simple | 막대그래프 | 지문 | 중 | 조정 | data.bar | 지원 | E2 | 2 |
| probability.simple | 원그래프 | 지문 | 하 | 조정 | data.pie | 미지원(신규 렌더러) | E3 | 2 |
| probability.simple | 벤·수형도 | 지문 | 하 | 신규 핵 | venn_tree | 미지원(신규 렌더러) | E3 | 2 |
| probability.conditional | 이원표 | 지문 | 상 | 재사용 | data.two_way | 지원 | E1 | 1 |
| probability.conditional | 도수·빈도표 | 지문 | 중 | 재사용 | data.table | 지원 | E2 | 1 |
| probability.conditional | 벤·수형도 | 지문 | 하 | 신규 핵 | venn_tree | 미지원(신규 렌더러) | E3 | 2 |
| probability.sequential_without_replacement | 값·함수표 | 지문 | 중 | 재사용 | data.table | 지원 | E2 | 1 |
| probability.sequential_without_replacement | 벤·수형도 | 지문 | 하 | 신규 핵 | venn_tree | 미지원(신규 렌더러) | E3 | 2 |
| probability.sequential_without_replacement | 원그래프 | 지문 | 하 | 조정 | data.pie | 미지원(신규 렌더러) | E3 | 2 |
| nonlinear_equations_systems.root | 함수 곡선 그래프(값 읽기) | 지문 | 중 | 조정 | plane.function | 지원 | E2 | 2 |
| nonlinear_equations_systems.root | 함수 곡선 그래프(값 읽기) | 선택지 | 하 | 신규 핵 | plane.function | 부분(figure_choice 지원, 정답 검증 확장 필요) | E3 | 2 |
| nonlinear_equations_systems.root | 값·함수표 | 지문 | 하 | 조정 | data.table | 지원 | E3 | 1 |
| nonlinear_equations_systems.sum_of_roots | 함수 곡선 그래프(값 읽기) | 지문 | 중 | 조정 | plane.function | 지원 | E2 | 2 |
| nonlinear_equations_systems.sum_of_roots | 값·함수표 | 지문 | 하 | 조정 | data.table | 지원 | E3 | 1 |
| nonlinear_equations_systems.product_of_roots | 함수 곡선 그래프(값 읽기) | 지문 | 하 | 조정 | plane.function | 지원 | E3 | 2 |
| nonlinear_equations_systems.num_real_solutions | 함수 곡선 그래프(값 읽기) | 지문 | 상 | 조정 | plane.function | 지원 | E1 | 2 |
| nonlinear_equations_systems.num_real_solutions | 함수 곡선 그래프(값 읽기) | 선택지 | 중 | 신규 핵 | plane.function | 부분(figure_choice 지원, 정답 검증 확장 필요) | E2 | 2 |
| nonlinear_equations_systems.irrational_sum_of_roots | 함수 곡선 그래프(값 읽기) | 지문 | 하 | 조정 | plane.function | 지원 | E3 | 2 |
| nonlinear_equations_systems.irrational_product_of_roots | 함수 곡선 그래프(값 읽기) | 지문 | 하 | 조정 | plane.function | 지원 | E3 | 2 |
| nonlinear_equations_systems.irrational_root_radical_form | 함수 곡선 그래프(값 읽기) | 지문 | 하 | 조정 | plane.function | 지원 | E3 | 2 |
| nonlinear_equations_systems.linear_quadratic_intersection | 함수 곡선 그래프(값 읽기) | 지문 | 상 | 조정 | plane.function | 지원 | E1 | 2 |
| nonlinear_equations_systems.linear_quadratic_intersection | 함수 곡선 그래프(값 읽기) | 선택지 | 중 | 신규 핵 | plane.function | 부분(figure_choice 지원, 정답 검증 확장 필요) | E3 | 2 |
| nonlinear_equations_systems.linear_quadratic_intersection | 값·함수표 | 지문 | 하 | 조정 | data.table | 지원 | E3 | 1 |
| nonlinear_equations_systems.parameter_discriminant | 함수 곡선 그래프(값 읽기) | 지문 | 중 | 조정 | plane.function | 지원 | E2 | 2 |
| nonlinear_equations_systems.parameter_discriminant | 함수 곡선 그래프(값 읽기) | 선택지 | 하 | 신규 핵 | plane.function | 부분(figure_choice 지원, 정답 검증 확장 필요) | E3 | 2 |
| nonlinear_functions.evaluate | 값·함수표 | 지문 | 중 | 재사용 | data.table | 지원 | E1 | 1 |
| nonlinear_functions.evaluate | 함수 곡선 그래프(값 읽기) | 지문 | 중 | 조정 | plane.function | 지원 | E1 | 2 |
| nonlinear_functions.evaluate | 함수 곡선 그래프(값 읽기) | 선택지 | 하 | 신규 핵 | plane.function | 부분(figure_choice 지원, 정답 검증 확장 필요) | E3 | 2 |
| nonlinear_functions.vertex_x | 함수 곡선 그래프(값 읽기) | 지문 | 상 | 조정 | plane.function | 지원 | E1 | 2 |
| nonlinear_functions.vertex_x | 값·함수표 | 지문 | 중 | 조정 | data.table | 지원 | E2 | 1 |
| nonlinear_functions.vertex_x | 함수 곡선 그래프(값 읽기) | 선택지 | 중 | 신규 핵 | plane.function | 부분(figure_choice 지원, 정답 검증 확장 필요) | E2 | 2 |
| nonlinear_functions.vertex_y | 함수 곡선 그래프(값 읽기) | 지문 | 상 | 조정 | plane.function | 지원 | E1 | 2 |
| nonlinear_functions.vertex_y | 값·함수표 | 지문 | 하 | 조정 | data.table | 지원 | E3 | 1 |
| nonlinear_functions.vertex_y | 함수 곡선 그래프(값 읽기) | 선택지 | 하 | 신규 핵 | plane.function | 부분(figure_choice 지원, 정답 검증 확장 필요) | E3 | 2 |
| nonlinear_functions.find_x_for_value | 함수 곡선 그래프(값 읽기) | 지문 | 중 | 조정 | plane.function | 지원 | E2 | 2 |
| nonlinear_functions.find_x_for_value | 값·함수표 | 지문 | 중 | 조정 | data.table | 지원 | E2 | 1 |
| nonlinear_functions.interpret_a | 함수 곡선 그래프(값 읽기) | 지문 | 상 | 조정 | plane.function | 지원 | E1 | 2 |
| nonlinear_functions.interpret_a | 함수 곡선 그래프(값 읽기) | 선택지 | 중 | 신규 핵 | plane.function | 부분(figure_choice 지원, 정답 검증 확장 필요) | E1 | 2 |
| nonlinear_functions.interpret_b | 함수 곡선 그래프(값 읽기) | 지문 | 중 | 조정 | plane.function | 지원 | E2 | 2 |
| nonlinear_functions.interpret_b | 함수 곡선 그래프(값 읽기) | 선택지 | 하 | 신규 핵 | plane.function | 부분(figure_choice 지원, 정답 검증 확장 필요) | E2 | 2 |
| linear_inequalities.solve_one_var | 수직선(부등식·구간·점) | 지문 | 중 | 신규 핵 | number_line | 미지원(신규 렌더러) | E2 | 2 |
| linear_inequalities.solve_one_var | 수직선(부등식·구간·점) | 선택지 | 중 | 신규 핵 | number_line | 미지원(신규 렌더러) | E2 | 2 |
| linear_inequalities.solve_one_var | 직선·연립·음영 그래프 | 지문 | 하 | 조정 | plane.line/inequality | 지원 | E3 | 2 |
| linear_inequalities.point_in_solution | 직선·연립·음영 그래프 | 지문 | 상 | 조정 | plane.line/inequality | 지원 | E1 | 2 |
| linear_inequalities.point_in_solution | 직선·연립·음영 그래프 | 선택지 | 중 | 신규 핵 | plane.line/inequality | 부분(figure_choice 지원, 정답 검증 확장 필요) | E2 | 2 |
| linear_inequalities.point_in_solution | 값·함수표 | 지문 | 하 | 조정 | data.table | 지원 | E3 | 1 |
| linear_inequalities.table_verification | 값·함수표 | 지문 | 상 | 재사용 | data.table | 지원 | E1 | 1 |
| linear_inequalities.table_verification | 값·함수표 | 선택지 | 하 | 신규 핵 | data.table | 부분(표·막대 선택지 렌더 확인 + 검증 확장) | E3 | 1 |
| linear_functions.evaluate | 값·함수표 | 지문 | 상 | 재사용 | data.table | 지원 | E1 | 1 |
| linear_functions.evaluate | 직선·연립·음영 그래프 | 지문 | 상 | 조정 | plane.line/inequality | 지원 | E1 | 2 |
| linear_functions.find_x_for_value | 값·함수표 | 지문 | 상 | 재사용 | data.table | 지원 | E1 | 1 |
| linear_functions.find_x_for_value | 직선·연립·음영 그래프 | 지문 | 중 | 조정 | plane.line/inequality | 지원 | E2 | 2 |
| linear_functions.slope_from_two_points | 직선·연립·음영 그래프 | 지문 | 상 | 조정 | plane.line/inequality | 지원 | E1 | 2 |
| linear_functions.slope_from_two_points | 값·함수표 | 지문 | 상 | 재사용 | data.table | 지원 | E1 | 1 |
| linear_functions.slope_from_two_points | 직선·연립·음영 그래프 | 선택지 | 중 | 신규 핵 | plane.line/inequality | 부분(figure_choice 지원, 정답 검증 확장 필요) | E2 | 2 |
| linear_functions.interpret_slope | 직선·연립·음영 그래프 | 지문 | 상 | 조정 | plane.line/inequality | 지원 | E1 | 2 |
| linear_functions.interpret_slope | 값·함수표 | 지문 | 중 | 조정 | data.table | 지원 | E2 | 1 |
| linear_functions.interpret_slope | 직선·연립·음영 그래프 | 선택지 | 중 | 신규 핵 | plane.line/inequality | 부분(figure_choice 지원, 정답 검증 확장 필요) | E2 | 2 |
| linear_functions.interpret_intercept | 직선·연립·음영 그래프 | 지문 | 상 | 조정 | plane.line/inequality | 지원 | E1 | 2 |
| linear_functions.interpret_intercept | 값·함수표 | 지문 | 중 | 조정 | data.table | 지원 | E2 | 1 |
| linear_functions.interpret_intercept | 직선·연립·음영 그래프 | 선택지 | 하 | 신규 핵 | plane.line/inequality | 부분(figure_choice 지원, 정답 검증 확장 필요) | E3 | 2 |
| linear_equations_two_var.intersection_x | 직선·연립·음영 그래프 | 지문 | 상 | 조정 | plane.line/inequality | 지원 | E1 | 2 |
| linear_equations_two_var.intersection_x | 값·함수표 | 지문 | 하 | 조정 | data.table | 지원 | E3 | 1 |
| linear_equations_two_var.intersection_y | 직선·연립·음영 그래프 | 지문 | 상 | 조정 | plane.line/inequality | 지원 | E1 | 2 |
| linear_equations_two_var.intersection_sum | 직선·연립·음영 그래프 | 지문 | 상 | 조정 | plane.line/inequality | 지원 | E1 | 2 |
| linear_equations_two_var.slope | 직선·연립·음영 그래프 | 지문 | 상 | 조정 | plane.line/inequality | 지원 | E1 | 2 |
| linear_equations_two_var.slope | 값·함수표 | 지문 | 중 | 조정 | data.table | 지원 | E2 | 1 |
| linear_equations_two_var.slope | 직선·연립·음영 그래프 | 선택지 | 중 | 신규 핵 | plane.line/inequality | 부분(figure_choice 지원, 정답 검증 확장 필요) | E2 | 2 |
| linear_equations_two_var.intercept | 직선·연립·음영 그래프 | 지문 | 상 | 조정 | plane.line/inequality | 지원 | E1 | 2 |
| linear_equations_two_var.intercept | 직선·연립·음영 그래프 | 선택지 | 하 | 신규 핵 | plane.line/inequality | 부분(figure_choice 지원, 정답 검증 확장 필요) | E3 | 2 |
| linear_equations_two_var.num_solutions | 직선·연립·음영 그래프 | 지문 | 상 | 조정 | plane.line/inequality | 지원 | E1 | 2 |
| linear_equations_two_var.num_solutions | 직선·연립·음영 그래프 | 선택지 | 중 | 신규 핵 | plane.line/inequality | 부분(figure_choice 지원, 정답 검증 확장 필요) | E2 | 2 |
| systems_linear.substitution_solve | 직선·연립·음영 그래프 | 지문 | 중 | 조정 | plane.line/inequality | 지원 | E1 | 2 |
| systems_linear.substitution_solve | 값·함수표 | 지문 | 하 | 조정 | data.table | 지원 | E3 | 1 |
| systems_linear.elimination_value | 직선·연립·음영 그래프 | 지문 | 하 | 조정 | plane.line/inequality | 지원 | E3 | 2 |
| systems_linear.param_no_solution | 직선·연립·음영 그래프 | 지문 | 중 | 조정 | plane.line/inequality | 지원 | E2 | 2 |
| systems_linear.param_no_solution | 직선·연립·음영 그래프 | 선택지 | 하 | 신규 핵 | plane.line/inequality | 부분(figure_choice 지원, 정답 검증 확장 필요) | E3 | 2 |
| systems_linear.word_system | 값·함수표 | 지문 | 중 | 재사용 | data.table | 지원 | E2 | 1 |
| systems_linear.word_system | 직선·연립·음영 그래프 | 지문 | 중 | 조정 | plane.line/inequality | 지원 | E2 | 2 |
| systems_linear.word_system | 직선·연립·음영 그래프 | 선택지 | 하 | 신규 핵 | plane.line/inequality | 부분(figure_choice 지원, 정답 검증 확장 필요) | E3 | 2 |
| lines_angles_triangles.triangle_angle_sum | 삼각형·직각삼각형 | 지문 | 상 | 조정 | triangle | 지원 | E1 | 3 |
| lines_angles_triangles.triangle_angle_sum | 삼각형·직각삼각형 | 선택지 | 하 | 신규 핵 | triangle | 부분(figure_choice 지원, 정답 검증 확장 필요) | E3 | 3 |
| lines_angles_triangles.triangle_angle_sum | 평행선·횡단선 | 지문 | 하 | 조정 | parallel_transversal | 지원 | E3 | 3 |
| lines_angles_triangles.exterior_angle | 삼각형·직각삼각형 | 지문 | 상 | 조정 | triangle | 지원 | E1 | 3 |
| lines_angles_triangles.exterior_angle | 평행선·횡단선 | 지문 | 하 | 조정 | parallel_transversal | 지원 | E3 | 3 |
| lines_angles_triangles.isosceles_base_angle | 삼각형·직각삼각형 | 지문 | 상 | 조정 | triangle | 지원 | E1 | 3 |
| lines_angles_triangles.isosceles_base_angle | 삼각형·직각삼각형 | 선택지 | 하 | 신규 핵 | triangle | 부분(figure_choice 지원, 정답 검증 확장 필요) | E3 | 3 |
| lines_angles_triangles.similar_triangles | 삼각형·직각삼각형 | 지문 | 상 | 조정 | triangle | 지원 | E1 | 3 |
| lines_angles_triangles.similar_triangles | 삼각형 내부 평행선·중첩 | 지문 | 중 | 신규 핵 | triangle 확장 | 미지원(신규 렌더러) | E2 | 3 |
| lines_angles_triangles.similar_triangles | 삼각형·직각삼각형 | 둘 다 | 하 | 신규 핵 | triangle | 미지원(B형 스키마) | E3 | 3 |
| lines_angles_triangles.similar_triangles | 좌표평면 도형·원·변환 | 지문 | 하 | 조정 | plane.polygon/circle/transform | 지원 | E3 | 2 |
| right_triangles_trigonometry.pythagorean_hypotenuse | 삼각형·직각삼각형 | 지문 | 상 | 조정 | triangle | 지원 | E1 | 3 |
| right_triangles_trigonometry.pythagorean_hypotenuse | 좌표평면 도형·원·변환 | 지문 | 중 | 조정 | plane.polygon/circle/transform | 지원 | E2 | 2 |
| right_triangles_trigonometry.pythagorean_hypotenuse | 복합 입체·대각선·단면 | 지문 | 하 | 신규 핵 | solid 확장 | 미지원(신규 렌더러) | E3 | 3 |
| right_triangles_trigonometry.pythagorean_leg | 삼각형·직각삼각형 | 지문 | 상 | 조정 | triangle | 지원 | E1 | 3 |
| right_triangles_trigonometry.pythagorean_leg | 좌표평면 도형·원·변환 | 지문 | 하 | 조정 | plane.polygon/circle/transform | 지원 | E3 | 2 |
| right_triangles_trigonometry.trig_ratio | 삼각형·직각삼각형 | 지문 | 상 | 조정 | triangle | 지원 | E1 | 3 |
| right_triangles_trigonometry.trig_ratio | 단위원·표준위치 각 | 지문 | 하 | 신규 핵 | unit_circle | 미지원(신규 렌더러) | E3 | 2 |
| right_triangles_trigonometry.trig_ratio | 삼각함수 곡선 | 지문 | 하 | 신규 핵 | plane.function(sin/cos) | 미지원(신규 렌더러) | E3 | 2 |
| one_variable_data.mean | 도수·빈도표 | 지문 | 상 | 재사용 | data.table | 지원 | E1 | 1 |
| one_variable_data.mean | 점도표 | 지문 | 상 | 재사용 | data.dot_plot | 지원 | E1 | 2 |
| one_variable_data.mean | 막대그래프 | 지문 | 중 | 조정 | data.bar | 지원 | E2 | 2 |
| one_variable_data.mean | 히스토그램 | 지문 | 중 | 조정 | data.histogram | 지원 | E2 | 2 |
| one_variable_data.mean | 값·함수표 | 지문 | 중 | 재사용 | data.table | 지원 | E2 | 1 |
| one_variable_data.mean | 줄기-잎 그림 | 지문 | 하 | 신규 핵 | data.stem_leaf | 미지원(신규 렌더러) | E3 | 2 |
| one_variable_data.mean | 도수다각형·누적 그래프 | 지문 | 하 | 신규 핵 | data.frequency_polygon/ogive | 미지원(신규 렌더러) | E3 | 2 |
| one_variable_data.mean | 점도표 | 선택지 | 하 | 신규 핵 | data.dot_plot | 부분(figure_choice 지원, 정답 검증 확장 필요) | E3 | 2 |
| one_variable_data.median | 점도표 | 지문 | 상 | 재사용 | data.dot_plot | 지원 | E1 | 2 |
| one_variable_data.median | 도수·빈도표 | 지문 | 상 | 재사용 | data.table | 지원 | E1 | 1 |
| one_variable_data.median | 히스토그램 | 지문 | 중 | 조정 | data.histogram | 지원 | E2 | 2 |
| one_variable_data.median | 상자그림 | 지문 | 중 | 조정 | data.boxplot | 지원 | E2 | 2 |
| one_variable_data.median | 줄기-잎 그림 | 지문 | 하 | 신규 핵 | data.stem_leaf | 미지원(신규 렌더러) | E3 | 2 |
| one_variable_data.median | 도수다각형·누적 그래프 | 지문 | 하 | 신규 핵 | data.frequency_polygon/ogive | 미지원(신규 렌더러) | E3 | 2 |
| one_variable_data.median | 상자그림 | 선택지 | 하 | 신규 핵 | data.boxplot | 부분(figure_choice 지원, 정답 검증 확장 필요) | E3 | 2 |
| one_variable_data.range | 점도표 | 지문 | 상 | 재사용 | data.dot_plot | 지원 | E1 | 2 |
| one_variable_data.range | 상자그림 | 지문 | 중 | 조정 | data.boxplot | 지원 | E2 | 2 |
| one_variable_data.range | 값·함수표 | 지문 | 중 | 재사용 | data.table | 지원 | E2 | 1 |
| one_variable_data.range | 줄기-잎 그림 | 지문 | 하 | 신규 핵 | data.stem_leaf | 미지원(신규 렌더러) | E3 | 2 |
| one_variable_data.range | 히스토그램 | 지문 | 하 | 조정 | data.histogram | 지원 | E3 | 2 |
| one_variable_data.grouped_median_interval | 히스토그램 | 지문 | 상 | 재사용 | data.histogram | 지원 | E1 | 2 |
| one_variable_data.grouped_median_interval | 도수·빈도표 | 지문 | 상 | 재사용 | data.table | 지원 | E1 | 1 |
| one_variable_data.grouped_median_interval | 도수다각형·누적 그래프 | 지문 | 하 | 신규 핵 | data.frequency_polygon/ogive | 미지원(신규 렌더러) | E3 | 2 |
| one_variable_data.grouped_median_interval | 히스토그램 | 선택지 | 하 | 신규 핵 | data.histogram | 부분(figure_choice 지원, 정답 검증 확장 필요) | E3 | 2 |
| two_variable_data.cell | 이원표 | 지문 | 상 | 재사용 | data.two_way | 지원 | E1 | 1 |
| two_variable_data.cell | 누적(스택)·비율 막대 | 지문 | 하 | 신규 핵 | data.bar 확장(stacked) | 미지원(신규 렌더러) | E3 | 2 |
| two_variable_data.row_total | 이원표 | 지문 | 상 | 재사용 | data.two_way | 지원 | E1 | 1 |
| two_variable_data.row_total | 누적(스택)·비율 막대 | 지문 | 하 | 신규 핵 | data.bar 확장(stacked) | 미지원(신규 렌더러) | E3 | 2 |
| two_variable_data.conditional_share | 이원표 | 지문 | 상 | 재사용 | data.two_way | 지원 | E1 | 1 |
| two_variable_data.conditional_share | 누적(스택)·비율 막대 | 지문 | 하 | 신규 핵 | data.bar 확장(stacked) | 미지원(신규 렌더러) | E3 | 2 |
| two_variable_data.conditional_share | 이원표 | 선택지 | 하 | 신규 핵 | data.two_way | 부분(figure_choice 지원, 정답 검증 확장 필요) | E3 | 1 |
| two_variable_data.scatter_equation | 산점도(+추세선·곡선) | 지문 | 상 | 재사용 | data.scatter / plane.scatter | 지원 | E1 | 2 |
| two_variable_data.scatter_equation | 선그래프 | 지문 | 하 | 조정 | data.line | 지원 | E3 | 2 |
| two_variable_data.scatter_equation | 산점도(+추세선·곡선) | 선택지 | 중 | 신규 핵 | data.scatter / plane.scatter | 부분(figure_choice 지원, 정답 검증 확장 필요) | E2 | 2 |
| two_variable_data.scatter_predict | 산점도(+추세선·곡선) | 지문 | 상 | 재사용 | data.scatter / plane.scatter | 지원 | E1 | 2 |
| two_variable_data.scatter_predict | 선그래프 | 지문 | 중 | 조정 | data.line | 지원 | E2 | 2 |
| two_variable_data.scatter_slope_context | 산점도(+추세선·곡선) | 지문 | 상 | 재사용 | data.scatter / plane.scatter | 지원 | E1 | 2 |
| two_variable_data.scatter_slope_context | 선그래프 | 지문 | 중 | 조정 | data.line | 지원 | E2 | 2 |
| two_variable_data.scatter_count_above | 산점도(+추세선·곡선) | 지문 | 상 | 재사용 | data.scatter / plane.scatter | 지원 | E1 | 2 |
| two_variable_data.scatter_count_above | 산점도(+추세선·곡선) | 선택지 | 하 | 신규 핵 | data.scatter / plane.scatter | 부분(figure_choice 지원, 정답 검증 확장 필요) | E3 | 2 |
| inference_margin_error.population_estimate | 문장형 자료 | 지문 | 중 | 재사용 | data.statement | 지원 | E1 | 1 |
| inference_margin_error.population_estimate | 수직선(부등식·구간·점) | 지문 | 하 | 신규 핵 | number_line | 미지원(신규 렌더러) | E3 | 2 |
| inference_margin_error.population_estimate | 막대그래프 | 지문 | 하 | 조정 | data.bar | 지원 | E3 | 2 |
| inference_margin_error.margin_interval | 문장형 자료 | 지문 | 중 | 재사용 | data.statement | 지원 | E1 | 1 |
| inference_margin_error.margin_interval | 수직선(부등식·구간·점) | 지문 | 하 | 신규 핵 | number_line | 미지원(신규 렌더러) | E3 | 2 |
| inference_margin_error.margin_interval | 수직선(부등식·구간·점) | 선택지 | 하 | 신규 핵 | number_line | 미지원(신규 렌더러) | E3 | 2 |
| inference_margin_error.sample_size_effect | 문장형 자료 | 지문 | 하 | 재사용 | data.statement | 지원 | E1 | 1 |
| inference_margin_error.sample_size_effect | 막대그래프 | 지문 | 하 | 조정 | data.bar | 지원 | E3 | 2 |
| percentages.percent_of | 값·함수표 | 지문 | 중 | 조정 | data.table | 지원 | E2 | 1 |
| percentages.percent_of | 막대그래프 | 지문 | 중 | 조정 | data.bar | 지원 | E2 | 2 |
| percentages.percent_of | 원그래프 | 지문 | 중 | 신규 핵 | data.pie | 미지원(신규 렌더러) | E2 | 2 |
| percentages.find_whole | 값·함수표 | 지문 | 중 | 조정 | data.table | 지원 | E2 | 1 |
| percentages.find_whole | 원그래프 | 지문 | 중 | 신규 핵 | data.pie | 미지원(신규 렌더러) | E2 | 2 |
| percentages.find_whole | 막대그래프 | 지문 | 하 | 조정 | data.bar | 지원 | E3 | 2 |
| percentages.percent_change | 막대그래프 | 지문 | 상 | 조정 | data.bar | 지원 | E1 | 2 |
| percentages.percent_change | 선그래프 | 지문 | 상 | 조정 | data.line | 지원 | E1 | 2 |
| percentages.percent_change | 값·함수표 | 지문 | 상 | 재사용 | data.table | 지원 | E1 | 1 |
| percentages.percent_change | 누적(스택)·비율 막대 | 지문 | 하 | 신규 핵 | data.bar 확장(stacked) | 미지원(신규 렌더러) | E3 | 2 |
| percentages.find_percent | 값·함수표 | 지문 | 중 | 조정 | data.table | 지원 | E2 | 1 |
| percentages.find_percent | 막대그래프 | 지문 | 중 | 조정 | data.bar | 지원 | E2 | 2 |
| percentages.find_percent | 원그래프 | 지문 | 중 | 신규 핵 | data.pie | 미지원(신규 렌더러) | E2 | 2 |
| percentages.compound_change | 값·함수표 | 지문 | 중 | 조정 | data.table | 지원 | E2 | 1 |
| percentages.compound_change | 선그래프 | 지문 | 하 | 조정 | data.line | 지원 | E3 | 2 |
| percentages.compound_change | 함수 곡선 그래프(값 읽기) | 지문 | 하 | 조정 | plane.function | 지원 | E3 | 2 |
| area_volume.rectangle_area | 사각형·다각형 | 지문 | 상 | 조정 | polygon | 지원 | E1 | 3 |
| area_volume.rectangle_area | 복합 도형 음영 | 지문 | 중 | 조정 | composite | 지원 | E1 | 3 |
| area_volume.rectangle_area | L자형 합성 다각형 | 지문 | 중 | 신규 핵 | polygon 확장 | 미지원(신규 렌더러) | E2 | 3 |
| area_volume.rectangle_area | 사각형·다각형 | 선택지 | 하 | 신규 핵 | polygon | 부분(figure_choice 지원, 정답 검증 확장 필요) | E3 | 3 |
| area_volume.triangle_area | 삼각형·직각삼각형 | 지문 | 상 | 조정 | triangle | 지원 | E1 | 3 |
| area_volume.triangle_area | 좌표평면 도형·원·변환 | 지문 | 중 | 조정 | plane.polygon/circle/transform | 지원 | E2 | 2 |
| area_volume.triangle_area | 사각형·다각형 | 지문 | 하 | 조정 | polygon | 지원 | E3 | 3 |
| area_volume.prism_volume | 입체(기둥·뿔·구) | 지문 | 상 | 조정 | solid | 지원 | E1 | 3 |
| area_volume.prism_volume | 복합 입체·대각선·단면 | 지문 | 하 | 신규 핵 | solid 확장 | 미지원(신규 렌더러) | E3 | 3 |
| area_volume.prism_missing_dimension | 입체(기둥·뿔·구) | 지문 | 상 | 조정 | solid | 지원 | E1 | 3 |
| area_volume.prism_missing_dimension | 입체(기둥·뿔·구) | 선택지 | 하 | 신규 핵 | solid | 부분(figure_choice 지원, 정답 검증 확장 필요) | E3 | 3 |
| area_volume.cylinder_volume_radius | 입체(기둥·뿔·구) | 지문 | 상 | 조정 | solid | 지원 | E1 | 3 |
| area_volume.cylinder_volume_radius | 복합 입체·대각선·단면 | 지문 | 중 | 신규 핵 | solid 확장 | 미지원(신규 렌더러) | E2 | 3 |
| area_volume.cylinder_volume_diameter | 입체(기둥·뿔·구) | 지문 | 상 | 조정 | solid | 지원 | E1 | 3 |
| area_volume.cylinder_volume_diameter | 복합 입체·대각선·단면 | 지문 | 하 | 신규 핵 | solid 확장 | 미지원(신규 렌더러) | E3 | 3 |
| circles.circumference_radius | 원(호·부채꼴·각·접선) | 지문 | 상 | 조정 | circle | 지원 | E1 | 3 |
| circles.circumference_radius | 복합 도형 음영 | 지문 | 하 | 조정 | composite | 지원 | E3 | 3 |
| circles.circumference_diameter | 원(호·부채꼴·각·접선) | 지문 | 상 | 조정 | circle | 지원 | E1 | 3 |
| circles.arc_length | 원(호·부채꼴·각·접선) | 지문 | 상 | 조정 | circle | 지원 | E1 | 3 |
| circles.arc_length | 복합 도형 음영 | 지문 | 하 | 조정 | composite | 지원 | E3 | 3 |
| circles.sector_area | 원(호·부채꼴·각·접선) | 지문 | 상 | 조정 | circle | 지원 | E1 | 3 |
| circles.sector_area | 복합 도형 음영 | 지문 | 중 | 조정 | composite | 지원 | E2 | 3 |
| circles.sector_area | 원그래프 | 지문 | 하 | 신규 핵 | data.pie | 미지원(신규 렌더러) | E3 | 2 |
| circles.central_from_inscribed | 원(호·부채꼴·각·접선) | 지문 | 상 | 조정 | circle | 지원 | E1 | 3 |
| circles.central_from_inscribed | 원(호·부채꼴·각·접선) | 선택지 | 하 | 신규 핵 | circle | 부분(figure_choice 지원, 정답 검증 확장 필요) | E3 | 3 |
| circles.inscribed_from_central | 원(호·부채꼴·각·접선) | 지문 | 상 | 조정 | circle | 지원 | E1 | 3 |
| circles.circle_equation_transform | 좌표평면 도형·원·변환 | 지문 | 상 | 재사용 | plane.polygon/circle/transform | 지원 | E1 | 2 |
| circles.circle_equation_transform | 좌표평면 도형·원·변환 | 선택지 | 중 | 신규 핵 | plane.polygon/circle/transform | 부분(figure_choice 지원, 정답 검증 확장 필요) | E2 | 2 |
| circles.circle_equation_transform | 좌표평면 도형·원·변환 | 둘 다 | 중 | 신규 핵 | plane.polygon/circle/transform | 미지원(B형 스키마) | E2 | 2 |
## 부록 B. 원형이 없는 SAT 세부 패턴 50개 × 자료 종류 × 위치 (96항목)

(coordinate_geometry는 SAT에서 별도 skill이 아니라 기하 skill 안의 좌표기하 유형이다.)

| 세부 패턴 | 자료 종류 | 자료 위치 | SAT 빈도(제작 순서용) | 기존 원형 | 필요 렌더 | 앱 지원 | 근거 | 단계 |
|---|---|---|---|---|---|---|---|---|
| linear_functions.construct_equation_from_graph | 직선·연립·음영 그래프 | 지문 | 상 | 신규 핵 | plane.line/inequality | 지원 | E1 | 2 |
| linear_functions.construct_equation_from_graph | 값·함수표 | 지문 | 상 | 신규 핵 | data.table | 지원 | E1 | 1 |
| linear_functions.construct_equation_from_graph | 직선·연립·음영 그래프 | 선택지 | 중 | 신규 핵 | plane.line/inequality | 부분(figure_choice 지원, 정답 검증 확장 필요) | E2 | 2 |
| linear_functions.construct_equation_from_graph | 직선·연립·음영 그래프 | 둘 다 | 하 | 신규 핵 | plane.line/inequality | 미지원(B형 스키마) | E3 | 2 |
| systems_linear.system_from_graph | 직선·연립·음영 그래프 | 지문 | 중 | 신규 핵 | plane.line/inequality | 지원 | E2 | 2 |
| systems_linear.system_from_graph | 직선·연립·음영 그래프 | 선택지 | 중 | 신규 핵 | plane.line/inequality | 부분(figure_choice 지원, 정답 검증 확장 필요) | E2 | 2 |
| linear_inequalities.inequality_from_graph | 직선·연립·음영 그래프 | 지문 | 상 | 신규 핵 | plane.line/inequality | 지원 | E1 | 2 |
| linear_inequalities.inequality_from_graph | 직선·연립·음영 그래프 | 선택지 | 중 | 신규 핵 | plane.line/inequality | 부분(figure_choice 지원, 정답 검증 확장 필요) | E2 | 2 |
| linear_inequalities.compound_inequality_number_line | 수직선(부등식·구간·점) | 지문 | 중 | 신규 핵 | number_line | 미지원(신규 렌더러) | E2 | 2 |
| linear_inequalities.compound_inequality_number_line | 수직선(부등식·구간·점) | 선택지 | 중 | 신규 핵 | number_line | 미지원(신규 렌더러) | E2 | 2 |
| nonlinear_functions.exponential_model | 값·함수표 | 지문 | 상 | 신규 핵 | data.table | 지원 | E1 | 1 |
| nonlinear_functions.exponential_model | 함수 곡선 그래프(값 읽기) | 지문 | 상 | 신규 핵 | plane.function | 지원 | E1 | 2 |
| nonlinear_functions.exponential_model | 함수 곡선 그래프(값 읽기) | 선택지 | 중 | 신규 핵 | plane.function | 부분(figure_choice 지원, 정답 검증 확장 필요) | E2 | 2 |
| nonlinear_functions.exponential_model | 값·함수표 | 선택지 | 중 | 신규 핵 | data.table | 부분(표·막대 선택지 렌더 확인 + 검증 확장) | E2 | 1 |
| nonlinear_functions.exponential_vs_linear_growth | 값·함수표 | 지문 | 중 | 신규 핵 | data.table | 지원 | E2 | 1 |
| nonlinear_functions.exponential_vs_linear_growth | 선그래프 | 지문 | 중 | 신규 핵 | data.line | 지원 | E2 | 2 |
| nonlinear_functions.exponential_vs_linear_growth | 함수 곡선 그래프(값 읽기) | 지문 | 중 | 신규 핵 | plane.function | 지원 | E2 | 2 |
| nonlinear_functions.function_transformation | 함수 곡선 그래프(값 읽기) | 지문 | 중 | 신규 핵 | plane.function | 지원 | E2 | 2 |
| nonlinear_functions.function_transformation | 함수 곡선 그래프(값 읽기) | 선택지 | 중 | 신규 핵 | plane.function | 부분(figure_choice 지원, 정답 검증 확장 필요) | E2 | 2 |
| nonlinear_functions.function_transformation | 함수 곡선 그래프(값 읽기) | 둘 다 | 중 | 신규 핵 | plane.function | 미지원(B형 스키마) | E2 | 2 |
| nonlinear_functions.zeros_end_behavior_polynomial | 함수 곡선 그래프(값 읽기) | 지문 | 중 | 신규 핵 | plane.function | 지원 | E2 | 2 |
| nonlinear_functions.zeros_end_behavior_polynomial | 함수 곡선 그래프(값 읽기) | 선택지 | 하 | 신규 핵 | plane.function | 부분(figure_choice 지원, 정답 검증 확장 필요) | E3 | 2 |
| nonlinear_functions.context_graph_features | 함수 곡선 그래프(값 읽기) | 지문 | 중 | 신규 핵 | plane.function | 지원 | E2 | 2 |
| nonlinear_functions.context_graph_features | 값·함수표 | 지문 | 중 | 신규 핵 | data.table | 지원 | E2 | 1 |
| nonlinear_functions.rational_asymptote | 함수 곡선 그래프(값 읽기) | 지문 | 하 | 신규 핵 | plane.function | 지원 | E3 | 2 |
| nonlinear_functions.rational_asymptote | 함수 곡선 그래프(값 읽기) | 선택지 | 하 | 신규 핵 | plane.function | 부분(figure_choice 지원, 정답 검증 확장 필요) | E3 | 2 |
| nonlinear_equations_systems.circle_equation_graph | 좌표평면 도형·원·변환 | 지문 | 중 | 신규 핵 | plane.polygon/circle/transform | 지원 | E2 | 2 |
| nonlinear_equations_systems.circle_equation_graph | 좌표평면 도형·원·변환 | 선택지 | 중 | 신규 핵 | plane.polygon/circle/transform | 부분(figure_choice 지원, 정답 검증 확장 필요) | E2 | 2 |
| one_variable_data.spread_comparison | 히스토그램 | 지문 | 중 | 신규 핵 | data.histogram | 지원 | E2 | 2 |
| one_variable_data.spread_comparison | 점도표 | 지문 | 중 | 신규 핵 | data.dot_plot | 지원 | E2 | 2 |
| one_variable_data.spread_comparison | 상자그림 | 지문 | 하 | 신규 핵 | data.boxplot | 지원 | E3 | 2 |
| one_variable_data.spread_comparison | 히스토그램 | 선택지 | 중 | 신규 핵 | data.histogram | 부분(figure_choice 지원, 정답 검증 확장 필요) | E2 | 2 |
| one_variable_data.quartile_percentile_from_plot | 상자그림 | 지문 | 중 | 신규 핵 | data.boxplot | 지원 | E2 | 2 |
| one_variable_data.quartile_percentile_from_plot | 줄기-잎 그림 | 지문 | 하 | 신규 핵 | data.stem_leaf | 미지원(신규 렌더러) | E3 | 2 |
| one_variable_data.quartile_percentile_from_plot | 도수다각형·누적 그래프 | 지문 | 하 | 신규 핵 | data.frequency_polygon/ogive | 미지원(신규 렌더러) | E3 | 2 |
| one_variable_data.outlier_effect | 점도표 | 지문 | 중 | 신규 핵 | data.dot_plot | 지원 | E2 | 2 |
| one_variable_data.outlier_effect | 상자그림 | 지문 | 하 | 신규 핵 | data.boxplot | 지원 | E3 | 2 |
| one_variable_data.outlier_effect | 줄기-잎 그림 | 지문 | 하 | 신규 핵 | data.stem_leaf | 미지원(신규 렌더러) | E3 | 2 |
| one_variable_data.relative_cumulative_frequency | 히스토그램 | 지문 | 중 | 신규 핵 | data.histogram | 지원 | E2 | 2 |
| one_variable_data.relative_cumulative_frequency | 도수다각형·누적 그래프 | 지문 | 하 | 신규 핵 | data.frequency_polygon/ogive | 미지원(신규 렌더러) | E3 | 2 |
| one_variable_data.relative_cumulative_frequency | 도수·빈도표 | 지문 | 중 | 신규 핵 | data.table | 지원 | E2 | 1 |
| two_variable_data.association_direction_strength | 산점도(+추세선·곡선) | 지문 | 중 | 신규 핵 | data.scatter / plane.scatter | 지원 | E2 | 2 |
| two_variable_data.association_direction_strength | 산점도(+추세선·곡선) | 선택지 | 중 | 신규 핵 | data.scatter / plane.scatter | 부분(figure_choice 지원, 정답 검증 확장 필요) | E2 | 2 |
| two_variable_data.model_choice_linear_quadratic_exponential | 산점도(+추세선·곡선) | 지문 | 상 | 신규 핵 | data.scatter / plane.scatter | 지원 | E1 | 2 |
| two_variable_data.model_choice_linear_quadratic_exponential | 산점도(+추세선·곡선) | 선택지 | 중 | 신규 핵 | data.scatter / plane.scatter | 부분(figure_choice 지원, 정답 검증 확장 필요) | E2 | 2 |
| two_variable_data.model_choice_linear_quadratic_exponential | 함수 곡선 그래프(값 읽기) | 지문 | 중 | 신규 핵 | plane.function | 지원 | E2 | 2 |
| two_variable_data.intercept_residual_interpretation | 산점도(+추세선·곡선) | 지문 | 중 | 신규 핵 | data.scatter / plane.scatter | 지원 | E2 | 2 |
| two_variable_data.intercept_residual_interpretation | 산점도(+추세선·곡선) | 지문 | 하 | 신규 핵 | data.scatter / plane.scatter | 지원 | E3 | 2 |
| two_variable_data.outlier_influence_on_fit | 산점도(+추세선·곡선) | 지문 | 중 | 신규 핵 | data.scatter / plane.scatter | 지원 | E2 | 2 |
| two_variable_data.outlier_influence_on_fit | 산점도(+추세선·곡선) | 선택지 | 하 | 신규 핵 | data.scatter / plane.scatter | 부분(figure_choice 지원, 정답 검증 확장 필요) | E3 | 2 |
| probability.spinner_expected_value | 원그래프 | 지문 | 하 | 신규 핵 | data.pie | 미지원(신규 렌더러) | E3 | 2 |
| probability.spinner_expected_value | 값·함수표 | 지문 | 중 | 신규 핵 | data.table | 지원 | E2 | 1 |
| evaluating_statistical_claims.sampling_generalization | 문장형 자료 | 지문 | 상 | 신규 핵 | data.statement | 지원 | E1 | 1 |
| evaluating_statistical_claims.sampling_generalization | 값·함수표 | 지문 | 하 | 신규 핵 | data.table | 지원 | E3 | 1 |
| evaluating_statistical_claims.causal_vs_association | 문장형 자료 | 지문 | 상 | 신규 핵 | data.statement | 지원 | E1 | 1 |
| evaluating_statistical_claims.causal_vs_association | 막대그래프 | 지문 | 하 | 신규 핵 | data.bar | 지원 | E3 | 2 |
| evaluating_statistical_claims.study_design_random_assignment | 문장형 자료 | 지문 | 중 | 신규 핵 | data.statement | 지원 | E1 | 1 |
| lines_angles_triangles.parallel_lines_transversal_angles | 평행선·횡단선 | 지문 | 상 | 신규 핵 | parallel_transversal | 지원 | E1 | 3 |
| lines_angles_triangles.parallel_lines_transversal_angles | 평행선·횡단선 | 선택지 | 하 | 신규 핵 | parallel_transversal | 부분(figure_choice 지원, 정답 검증 확장 필요) | E3 | 3 |
| lines_angles_triangles.parallel_lines_transversal_angles | 평행선 3개 이상 | 지문 | 하 | 신규 핵 | parallel_transversal 확장 | 미지원(신규 렌더러) | E3 | 3 |
| lines_angles_triangles.vertical_supplementary_angles | 평행선·횡단선 | 지문 | 중 | 신규 핵 | parallel_transversal | 지원 | E2 | 3 |
| lines_angles_triangles.vertical_supplementary_angles | 삼각형·직각삼각형 | 지문 | 중 | 신규 핵 | triangle | 지원 | E2 | 3 |
| lines_angles_triangles.congruent_triangles | 삼각형·직각삼각형 | 지문 | 중 | 신규 핵 | triangle | 지원 | E2 | 3 |
| lines_angles_triangles.congruent_triangles | 삼각형·직각삼각형 | 둘 다 | 하 | 신규 핵 | triangle | 미지원(B형 스키마) | E3 | 3 |
| lines_angles_triangles.polygon_interior_angle | 사각형·다각형 | 지문 | 중 | 신규 핵 | polygon | 지원 | E2 | 3 |
| lines_angles_triangles.triangle_inequality | 삼각형·직각삼각형 | 지문 | 하 | 신규 핵 | triangle | 지원 | E3 | 3 |
| lines_angles_triangles.nested_similar_parallel | 삼각형 내부 평행선·중첩 | 지문 | 중 | 신규 핵 | triangle 확장 | 미지원(신규 렌더러) | E2 | 3 |
| right_triangles_trigonometry.special_right_triangles | 삼각형·직각삼각형 | 지문 | 상 | 신규 핵 | triangle | 지원 | E1 | 3 |
| right_triangles_trigonometry.sin_cos_complementary | 삼각형·직각삼각형 | 지문 | 중 | 신규 핵 | triangle | 지원 | E2 | 3 |
| right_triangles_trigonometry.trig_application_elevation | 삼각형·직각삼각형 | 지문 | 중 | 신규 핵 | triangle | 지원 | E2 | 3 |
| right_triangles_trigonometry.unit_circle_radian | 단위원·표준위치 각 | 지문 | 중 | 신규 핵 | unit_circle | 미지원(신규 렌더러) | E2 | 2 |
| right_triangles_trigonometry.unit_circle_radian | 단위원·표준위치 각 | 선택지 | 하 | 신규 핵 | unit_circle | 미지원(신규 렌더러) | E3 | 2 |
| right_triangles_trigonometry.sinusoid_graph | 삼각함수 곡선 | 지문 | 하 | 신규 핵 | plane.function(sin/cos) | 미지원(신규 렌더러) | E3 | 2 |
| right_triangles_trigonometry.sinusoid_graph | 삼각함수 곡선 | 선택지 | 하 | 신규 핵 | plane.function(sin/cos) | 미지원(신규 렌더러) | E3 | 2 |
| right_triangles_trigonometry.similar_right_triangle_altitude | 삼각형 내부 평행선·중첩 | 지문 | 하 | 신규 핵 | triangle 확장 | 미지원(신규 렌더러) | E3 | 3 |
| area_volume.cone_pyramid_sphere_volume | 입체(기둥·뿔·구) | 지문 | 상 | 신규 핵 | solid | 지원 | E1 | 3 |
| area_volume.surface_area | 입체(기둥·뿔·구) | 지문 | 중 | 신규 핵 | solid | 지원 | E2 | 3 |
| area_volume.composite_solid | 복합 입체·대각선·단면 | 지문 | 중 | 신규 핵 | solid 확장 | 미지원(신규 렌더러) | E2 | 3 |
| area_volume.shaded_region_area | 복합 도형 음영 | 지문 | 상 | 신규 핵 | composite | 지원 | E1 | 3 |
| area_volume.shaded_region_area | 복합 도형 음영 | 선택지 | 하 | 신규 핵 | composite | 부분(figure_choice 지원, 정답 검증 확장 필요) | E3 | 3 |
| area_volume.trapezoid_parallelogram_area | 사각형·다각형 | 지문 | 중 | 신규 핵 | polygon | 지원 | E2 | 3 |
| area_volume.similar_solids_scale | 입체(기둥·뿔·구) | 지문 | 중 | 신규 핵 | solid | 지원 | E2 | 3 |
| area_volume.similar_solids_scale | 입체(기둥·뿔·구) | 둘 다 | 하 | 신규 핵 | solid | 미지원(B형 스키마) | E3 | 3 |
| area_volume.space_diagonal | 복합 입체·대각선·단면 | 지문 | 하 | 신규 핵 | solid 확장 | 미지원(신규 렌더러) | E3 | 3 |
| circles.tangent_radius_perpendicular | 원(호·부채꼴·각·접선) | 지문 | 중 | 신규 핵 | circle | 지원 | E2 | 3 |
| circles.chord_length | 원(호·부채꼴·각·접선) | 지문 | 중 | 신규 핵 | circle | 지원 | E2 | 3 |
| circles.circle_equation_complete_square | 좌표평면 도형·원·변환 | 지문 | 중 | 신규 핵 | plane.polygon/circle/transform | 지원 | E2 | 2 |
| circles.circle_equation_complete_square | 좌표평면 도형·원·변환 | 선택지 | 중 | 신규 핵 | plane.polygon/circle/transform | 부분(figure_choice 지원, 정답 검증 확장 필요) | E2 | 2 |
| circles.inscribed_circumscribed_polygon | 복합 도형 음영 | 지문 | 하 | 신규 핵 | composite | 지원 | E3 | 3 |
| coordinate_geometry.distance_midpoint | 좌표평면 도형·원·변환 | 지문 | 중 | 신규 핵 | plane.polygon/circle/transform | 지원 | E2 | 2 |
| coordinate_geometry.transformation_image | 좌표평면 도형·원·변환 | 지문 | 중 | 신규 핵 | plane.polygon/circle/transform | 지원 | E2 | 2 |
| coordinate_geometry.transformation_image | 좌표평면 도형·원·변환 | 선택지 | 중 | 신규 핵 | plane.polygon/circle/transform | 부분(figure_choice 지원, 정답 검증 확장 필요) | E2 | 2 |
| coordinate_geometry.transformation_image | 좌표평면 도형·원·변환 | 둘 다 | 중 | 신규 핵 | plane.polygon/circle/transform | 미지원(B형 스키마) | E2 | 2 |
| coordinate_geometry.polygon_area_on_plane | 좌표평면 도형·원·변환 | 지문 | 중 | 신규 핵 | plane.polygon/circle/transform | 지원 | E2 | 2 |
| coordinate_geometry.parallel_perpendicular_slopes | 직선·연립·음영 그래프 | 지문 | 중 | 신규 핵 | plane.line/inequality | 지원 | E2 | 2 |
| coordinate_geometry.parallel_perpendicular_slopes | 직선·연립·음영 그래프 | 선택지 | 하 | 신규 핵 | plane.line/inequality | 부분(figure_choice 지원, 정답 검증 확장 필요) | E3 | 2 |
## 부록 C. 선택지형 대표 오답 규칙 (오답 그래프·표·도형 3개 설계용)

규칙마다 id를 `distractors[].kind`/`reason`에 남기고, 한 문항의 오답 3개는 서로 다른 규칙에서 뽑는다(같은 그림 금지). 정답과 같은 축·크기·객체 수.

| 영역 | 규칙 id | 오답 설계 |
|---|---|---|
| 직선·연립 | L1 기울기 부호 반전 | m → −m |
| | L2 절편 부호·위치 오류 | b → −b, 또는 y절편을 x절편 자리로 |
| | L3 기울기-절편 교환 | m ↔ b |
| | L4 기울기 역수 | rise/run 뒤집기(1/m) |
| | L5 단위·축 스케일 착각 | 눈금 간격을 다르게 읽은 그래프(축은 동일, 값만 변경) |
| | L6 연립: 한 직선만 맞음 | 두 직선 중 하나만 정답과 같음 |
| | L7 연립: 교점 위치 오류 | 두 직선은 맞으나 교점이 잘못 표시(점 금지 규칙에 따라 직선 값을 바꿔 교점 이동) |
| | L8 평행·일치 혼동 | 해가 없음/무한 해 선택 시 기울기만 같고 절편 다름 vs 일치 |
| 부등식 영역 | I1 경계 실선/점선 오류 | ≤ ↔ < |
| | I2 음영 방향 오류 | 반대쪽 반평면 |
| | I3 경계선 자체 오류 | L1~L3 적용 |
| | I4 연립 영역 교집합/합집합 혼동 | 한쪽 영역만 음영 |
| 이차·곡선 | Q1 개구 방향 반전 | a → −a |
| | Q2 꼭짓점 이동 방향 오류 | (x−h) 부호 오해: h → −h |
| | Q3 꼭짓점 이동 크기 오류 | k의 부호 또는 크기 |
| | Q4 폭 오류 | |a| 확대/축소 혼동 |
| | Q5 근 개수 오류 | 판별식 부호 반대(교점 0·1·2개) |
| | E1 지수 증가·감소 혼동 | 밑 b → 1/b |
| | E2 지수 초깃값·점근선 오류 | 절편 이동, 점근선 이동 |
| 변환 | T1 방향 오류 | 위/아래, 왼/오른쪽 반대 |
| | T2 대칭축 혼동 | x축 ↔ y축 대칭 |
| | T3 배율 오류 | 수직 확대 vs 수평 확대, k ↔ 1/k |
| | T4 순서 오류 | 이동·대칭을 반대 순서로 적용 |
| 원·좌표 도형 | C1 중심 부호 오류 | (h,k) → (−h,−k) |
| | C2 반지름 오류 | r ↔ r², 지름 혼동 |
| | C3 이동량 오류 | 한 축만 이동·크기 오류 |
| 수직선 | N1 열린/닫힌 점 혼동 | <, ≤ 반대 |
| | N2 방향 오류 | 화살표 반대 |
| | N3 경계값 부호 오류 | −c ↔ c |
| | N4 복합 부등식: and/or 혼동 | 교집합 ↔ 합집합 |
| | N5 절댓값 부등식 구간 오류 | 안쪽/바깥쪽 혼동 |
| 표 | TB1 값 순서 교환 | 두 행 값 바꿈 |
| | TB2 증가량 오류 | 등차 ↔ 등비 혼동, 증가폭 변경 |
| | TB3 한 칸만 틀림 | 한 행이 규칙에서 벗어남(표 전체 검증을 요구) |
| 자료 그래프 | D1 도수 교환·누락 | 히스토그램 두 구간 도수 교환 |
| | D2 분포 퍼짐 오류 | 평균은 같고 표준편차가 다른 분포(표준편차 비교) |
| | D3 추세 방향·강도 오류 | 양/음 상관 반대, 상관 강도 |
| | D4 모델 종류 오류 | 선형 ↔ 이차 ↔ 지수 곡선 |
| 도형 | S1 대응변·대응각 오류 | 닮음·합동 대응 어긋남 |
| | S2 닮음비 역수 | k ↔ 1/k 크기 |
| | S3 각 조건 위반 | 합이 180°가 아님, 이등변 아님 |
| | S4 입체 치수 교환 | 반지름 ↔ 지름, 높이 ↔ 밑변 |
| 단위원·삼각 곡선 | U1 사분면 오류 | 각의 위치가 다른 사분면 |
| | U2 라디안·도 혼동 | π/6 ↔ 30° 표기 오독 |
| | U3 진폭·주기 오류 | 진폭 2배, 주기 반 |

선택지형 오답 설계 원칙: (1) 오답은 실제 학생이 하는 실수 하나에 대응한다, (2) 정답과 눈으로 구별되려면 최소 한 곳 이상 의미 있는 차이, (3) 보조 점·라벨·색으로 정답을 드러내지 않는다, (4) 한 문항에서 같은 규칙 두 번 금지, (5) 규칙이 적용 불가능하면(예: 대칭 곡선) 다른 규칙으로 대체하고 id 기록.
