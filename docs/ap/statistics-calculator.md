# AP Statistics 계산기·Reference (2026-10-13)

## 1장 정리
1. **흐름**: Statistics 응시 화면(MC·FRQ 두 섹션) 상단 `Calculator`·`Reference` 버튼 → 팝업. Calculator 팝업은 `Statistics`(기본)·`Graphing (Desmos)` 탭, Reference 팝업은 `Formulas`·`Tables` 탭. 닫기/Esc, 탭은 ←/→/Home/End. 계산기는 한 번 열면 CSS로만 숨겨 입력값 유지.
2. **데이터·권한**: DB·서버 호출·마이그레이션 없음(순수 클라이언트·오프라인). 시험 규칙(섹션 시간, `calculator` 허용 여부)은 기존 `lib/ap-exam/layouts.ts`가 원본이며 변경 없음. 미적분은 구성 변경 없음(Desmos만, Reference 없음).
3. **UAT**: 계정·데이터 불필요(서버 상태 없음). Preview에서 통계 응시 화면 확인은 별도.
4. **UI**: 영어. 결과는 통계량·df·p값·구간·사용 규칙(양측/단측, pooled/unpooled, 소표본 경고)과 `Copy results`. 입력 오류는 `role=alert`. 모바일은 1열 폼·44px 버튼.
5. **검증**: 수치는 scipy 골든(아래 표), 화면은 컴포넌트 테스트.

## 구조
- `lib/stats-calc/special.ts` lgamma(Lanczos), 정규화 불완전 감마·베타(급수+연분수). `dist.ts` 정규·t·χ²·이항·기하(역함수는 구간확장+이분법). `describe.ts` 목록 파싱·1/2변수 통계. `infer.ts` 검정/구간. `modes.ts` 화면이 그리는 모드 정의(필드+실행). `tables.ts` z/t/χ² 표를 **함수에서 생성**(메모). `formulas.ts` 자체 작성 공식.
- `lib/exam-tools/subject-tools.ts` 과목별 구성(`calculatorTabs`, `reference`). 새 과목은 항목 추가 + `SubjectToolPanels`의 `CALCULATOR_TABS`/`REFERENCE_PANELS`에 컴포넌트 등록(물리 참조 정보, 화학 주기율표 자리).
- 골든: `scripts/stats-calc/gen-golden.py`(venv scipy) → `lib/stats-calc/__golden__/golden.json`(커밋됨, 재생성: `.venv-ap/bin/python scripts/stats-calc/gen-golden.py`).

## 규칙·규약
- 사분위수: TI-84 방식(홀수 n이면 중앙값 제외한 양쪽 절반의 중앙값). 다른 소프트웨어와 다를 수 있음(결과 화면 주석).
- 2-sample t: 기본 unpooled(Welch, df 소수 그대로), 선택 pooled. 2-비율 검정은 합동 p̂, 구간은 비합동. 1-비율 검정 SE는 p₀, 구간 SE는 p̂.
- 신뢰수준은 0~1 소수(예 0.95). 입력은 소수·분수(1/4)·퍼센트(95%)·`inf`/`-inf`.
- 2027 과정 토픽(`data/ap/curriculum-2027/ap_statistics.json`)에 없는 기하분포·χ² 적합도·기울기 추론·z 평균 검정은 계산기에만 있고 `*` 표시, Formulas에는 없음.

## 포함하지 않은 것
Desmos 트라이얼 키 배너, 공식 College Board 수식표 복제, 포아송·ANOVA·비모수·Bootstrap/랜덤화 시뮬레이션, 비정규 분포 기타, 쌍체/2표본 목록 직접 입력(요약통계 또는 차이 목록→1-sample t), 비선형 회귀, 잔차 그림, 그래프, 실제 Preview 시각 확인.
