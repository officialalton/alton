# SAT Math 커버리지 기준선 — 세부 기술 코드 × 표현 × 검증 상태 (2026-09-14, 마무리 갱신)

제품 오너 지시(2026-09-14 저녁): "템플릿 구현 완료"가 아니라 **세부 기술 코드별로 필요한 표현(텍스트·표·그래프·도형·선택지·SPR)과 대표 문항이 모두 검증됐을 때만** SAT Math 범위 완료로 본다. 분류 원본은 `problem_skill_codes`(20261367) · 화면 사본 `lib/problem-taxonomy.ts`.

검증 상태 뜻: **검증됨** = 대표 문항이 단위 테스트(렌더·참조 lint)로 통과하고 같은 표현이 로컬 E2E(관리자 미리보기→공개 게이트→학생 화면)로 한 번 이상 확인됨. **부분** = 표현은 지원하나 그 기술의 대표 문항 표본이 아직 없음. Preview UI 실제 클릭 확인은 모든 행에서 **미실행**(UAT 계정 필요) — Preview 는 DB 게이트만 실측.

| 영역 | 세부 기술 코드 | 가능한 문항 형식 | 필요한 자료 블록 / 그림 템플릿 | 대표 문항·검증 근거 | SAT 6~11 등장 | 상태 |
|---|---|---|---|---|---|---|
| Algebra | `linear_equations_one_var` (Linear equations in one variable) | MC·SPR | 텍스트·KaTeX | E2E 진술 블록(Algebra), SPR 정답 형식 테스트 | √ | 검증됨 |
| Algebra | `linear_functions` (Linear functions) | MC·SPR | KaTeX·좌표평면(직선·점)·함수표(data table)·복수 자료(Figure A/Table B) | E2E T3 직선·점, 데이터 함수표 표본, **복수 자료 E2E `41~43-fs`** | √ | 검증됨 |
| Algebra | `linear_equations_two_var` (Linear equations in two variables) | MC·SPR | KaTeX·좌표평면(직선·교점·중점) | 좌표평면 표본(두 직선 교점·기울기 대조) | √ | 검증됨 |
| Algebra | `systems_linear` (Systems of two linear equations) | MC·SPR | KaTeX cases 블록·좌표평면(두 직선)·그래프 선택지 | cases 조판 테스트, 연립 표본, figure_choice E2E | √ | 검증됨 |
| Algebra | `linear_inequalities` (Linear inequalities) | MC·SPR | KaTeX 부등식·좌표평면 음영 부등식(단일·연립) | E2E T3b 연립 부등식(선택지 좌표 노출 거부 실례) | √ | 검증됨 |
| Advanced Math | `equivalent_expressions` (Equivalent expressions) | MC·SPR | KaTeX(분수·지수·근호) | content-check 표본(분수·근호·지수) | √ | 검증됨(수식만) |
| Advanced Math | `nonlinear_equations_systems` (Nonlinear equations and systems) | MC·SPR | KaTeX·좌표평면(포물선+직선 교점) | 좌표평면 표본 '비선형 연립 교점'(교점 좌표 대조) + **E2E `29~31-nl`**(AI 생성→공개→학생) | √ | 검증됨 |
| Advanced Math | `nonlinear_functions` (Nonlinear functions) | MC·SPR | 좌표평면(포물선·지수·절댓값·제곱근·유리·조각)·그래프 선택지 | 표본 8종, 포물선 그래프 선택지 표본(꼭짓점형 포함) + **E2E `35~37-pc`**(정답 자리 C 배치·공개·학생) | √ | 검증됨 |
| PSDA | `ratios_rates_units` (Ratios, rates, proportional relationships, and units) | MC·SPR | 텍스트·표(data table)·문장형 자료 | 데이터 표본(값 표·속도 선그래프) | √ | 검증됨 |
| PSDA | `percentages` (Percentages) | MC·SPR | 텍스트·표·막대그래프 | 데이터 표본(빈도표 비율·막대 증가율) + **막대그래프 E2E `47~49-bar`** | √ | 검증됨 |
| PSDA | `one_variable_data` (One-variable data: distributions and measures) | MC·SPR | 숫자 목록·점도표·히스토그램·상자그림·빈도표 | 데이터 표본 5종(점도표 포함) | √ | 검증됨 |
| PSDA | `two_variable_data` (Two-variable data: models and scatterplots) | MC·SPR | 산점도+추세선·선그래프·함수표 | 데이터 표본(산점도·선), E2E T4 값 표 | √ | 검증됨 |
| PSDA | `probability` (Probability and conditional probability) | MC·SPR | 양방향 표(합계 자동)·2×2 표·빈도표 | 데이터 표본(2×2, 양방향 값 대조) | √ | 검증됨 |
| PSDA | `inference_margin_error` (Inference from sample statistics and margin of error) | MC | 문장형 자료(statement: 표본 크기·추정치·오차범위) | 데이터 표본(문장형, 값 불일치 거부) | √ | 검증됨 |
| PSDA | `evaluating_statistical_claims` (Evaluating statistical claims: observational studies and experiments) | MC | 텍스트·문장형 자료(statement: 참가자·배정·처치) | 데이터 표본 '통계적 주장 판단' + **E2E `32~34-sc`** | √ | 검증됨 |
| Geometry & Trig | `area_volume` (Area and volume) | MC·SPR | 사각형·다각형(T6)·입체 2.5D(T7)·원(부채꼴)·**복합 도형 음영(T8 composite)** | T6·T7 표본 20 + T8 표본 5, E2E 사다리꼴·원기둥·**정사각형 안 원 음영 `50~52-cp`** | √ | 검증됨 |
| Geometry & Trig | `lines_angles_triangles` (Lines, angles, and triangles) | MC·SPR | 평행선·횡단선(T1)·삼각형(T2)·다각형 각·좌표기하 변환 | T1·T2 표본 20, E2E 평행선·직각삼각형·**도형 선택지 `38~40-tc`**·**좌표 변환 `44~46-cg`** | √ | 검증됨 |
| Geometry & Trig | `right_triangles_trigonometry` (Right triangles and trigonometry) | MC·SPR | 직각삼각형(T2, θ·삼각비)·좌표기하 거리 | T2 표본(삼각비 θ), 좌표 거리 대조 표본 | √ | 검증됨 |
| Geometry & Trig | `circles` (Circles) | MC·SPR | 원(T5)·좌표평면 원(등축)·원의 방정식 | T5 표본 10, E2E 접선, 좌표 원 표본 | √ | 검증됨 |

## 표현 종류별 지원 현황(SAT 6~11 대조)

| 표현 | 템플릿 / 블록 | 상태 |
|---|---|---|
| 텍스트·KaTeX(분수·지수·근호·연립 cases·부등식 연쇄·구간) | `LearningText` + `problem-content-check`(파싱 실패 저장 거부) | 검증됨 |
| 4지선다·정답 인덱스·'x =' 표기 금지 | content-check | 검증됨 |
| 로마숫자 진술 + 조합 선택지 | `statements`(20261368) + content-check + 학생 진술 블록 | 검증됨(E2E) |
| SPR 동치 답안·형식·자릿수 | `spr_answer_matches` + content-check | 검증됨 |
| 함수표·값 표·빈도/비율표·2×2·양방향 표 | data.table / two_way | 검증됨 |
| 숫자 목록·점도표·히스토그램·상자그림 | data.number_list / dot_plot / histogram / boxplot | 검증됨 |
| 막대·선·산점도+추세선 | data.bar / line / scatter | 검증됨(막대 E2E; 선·산점도는 표본) |
| 문장형 자료(표본·오차범위·연구 설계) | data.statement | 검증됨(표본) |
| 좌표평면: 점·직선·연립·포물선·지수·절댓값·근호·유리(점근선)·조각(열린/닫힌)·음영 부등식 | plane | 검증됨(E2E: 직선·점, 연립 부등식) |
| 좌표기하: 다각형·원(등축)·중점·교점·변환(평행이동·대칭·확대·회전) | plane.polygon/circle/midpoint/intersection/transform | 검증됨(표본·값 대조 + 평행이동 E2E) |
| 평행선·횡단선·각 / 삼각형·합동·닮음·삼각비 / 원 / 사각형·다각형 / 입체 2.5D | T1 / T2 / T5 / T6 / T7 | 검증됨(각 E2E 1건) |
| 그래프 선택지 4개(같은 축·크기, 편향 거부, 정답 자리 일치) | figure_choice | 검증됨(E2E 직선·포물선) |
| 복수 자료(그림 A/표 B) | figure_set | 검증됨(E2E) |
| 도형 선택지(도형 4개) | figure_choice(child: triangle/polygon/circle — 같은 type·꼭짓점 수, 조건 라벨 허용) | 검증됨(표본 + E2E 직각삼각형 고르기) |
| 복합 도형(정사각형 안 원·원 안 정사각형/삼각형·직사각형 위 반원·테두리) 음영 영역 | **composite(T8)** — 판정: Digital SAT Math 'Area and volume' 에 shaded-region 문항이 실제로 나오므로 **범위 안**, 표준 템플릿으로 구현 | 검증됨(표본 5 + E2E) |
| 3D 좌표(공간좌표·벡터) | — | **범위 밖(제외 근거)**: College Board Digital SAT Math 도메인(Algebra / Advanced Math / PSDA / Geometry & Trig)의 세부 기술에 3차원 좌표기하가 없고, Test 6~11 Math 모듈에도 등장하지 않음. 입체는 2.5D 도식(T7)으로 충분. 업로드 폴백도 두지 않는다 |

## 판정 — SAT Math 범위 (2026-09-14 저녁)

- 세부 기술 코드 19개 **모두 검증됨**(대표 문항 단위 테스트 + 그 표현의 로컬 E2E: 관리자 AI 생성 → 표준 렌더 미리보기 → `render_check` 게이트 → 공개 → 학생 렌더·풀이 화면, 1280/375px).
- 표현 종류 17개 중 미지원은 3D 좌표 1개이며 **시험 범위 밖으로 제외 근거를 명시**했다. 업로드 폴백에 남긴 표현은 없다.
- 실제 SAT 표본 연결: 각 행 'SAT 6~11 등장' √ — 대표 문항은 Test 6~11 의 문항 모양을 따라 만든 것이며, 원문 문항을 그대로 옮긴 것은 아니다(저작권).
- Preview: 공유 non-prod DB 게이트 실측(모든 템플릿 대표 1건씩). **Preview UI(관리자 로그인 클릭) 확인은 미실행** — 제품 오너 UAT 계정으로 남는다.
- 따라서 **"SAT Math 표준 렌더링 범위 완료(로컬 E2E 기준)"**으로 보고한다. Preview UI 확인이 끝나면 완료 상태를 확정한다.
