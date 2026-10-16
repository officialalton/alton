# 자체 제작 그래핑 계산기 사양 (Desmos 임베드 대체)

작성 2026-10-12 · 상태: 설계안(코드 변경 없음) · 오너 방향(2026-10-13): Desmos 상용 API 키 없이 "AP 학생이 실제로 쓰는 범위"의 Desmos 유사 사용성을 자체 구현. Desmos와 동일 기능은 목표가 아니다.

## 0. 현황 (코드 확인)
- 계산기는 `app/session/[id]/MockExamMathTools.tsx`의 `GraphingCalculator`(Desmos CDN `calculator.js?apiKey=...` 동적 로드). `MockExamToolButtons`(버튼) + `MockExamMathTools`(fixed 플로팅 패널, 한 번 열면 마운트 유지해 수식 보존)로 구성. 재사용처: `ApExamTakeClient.tsx`(AP), `MockExamTakeClient`, `MockExamMstTakeClient`, `HomeworkBatchPanel`, 세션 문제 화면.
- AP 응시 화면은 `section.calculator === "allowed" | "required"`일 때만 `calcOk` → 버튼/패널 노출. "none"이면 렌더 자체가 없음(완전 비활성 확보됨).
- **IP/약관 위험(즉시 조치 후보)**: 코드의 `DESMOS_API_KEY`는 Desmos 공개 문서의 평가용 데모 키를 하드코딩한 것이다. 데모 키를 유료 서비스(상용 학원 제품) 운영에 쓰는 것은 약관 위반 소지가 크다(내가 약관 원문을 읽지는 못함 — §7 문의 항목). 자체 계산기 출시 전 기간의 임시 방편이며, 오너 결정 사항으로 표시.
- 통계 계산기 모듈(`lib/student-stats`, 타 에이전트 작업)은 건드리지 않음. 활성화 설정 메커니즘만 공유 대상(§4).

## 1. 과목·섹션별 계산기 정책
출처: `docs/ap/2027-exam-spec-table.md`, `docs/ap/statistics-facts.md`, AP Central 계산기 정책(https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/exam-policies/calculator-policy, https://apcentral.collegeboard.org/help-center/what-calculator-policy-digital-ap-exams). 아래 AP Central 요지는 검색 요약 기준이므로 구현 착수 전 원문 재확인 필요.

AP Central 요지(자체 요약): Bluebook 내장 Desmos는 계산기를 허용·요구하는 시험에서 제공되고, 과목에 따라 그래핑/공학용/사칙 버전이 다르다. Calculus AB/BC·Precalculus는 계산기 필수 파트에서만 제공. 웹·앱 Desmos는 시험 당일 불가(학기 중에는 가능). 2026부터 Statistics도 Bluebook 내 Desmos 제공.

| 과목 | 섹션 | 우리 제품 계산기 | 비고 |
|---|---|---|---|
| Calculus AB/BC | MC A(29문항·62분), FRQ B(4·60분) | **완전 비활성** | UI 버튼·패널·단축키·입력 모두 미노출, 서버 설정으로 강제 |
| Calculus AB/BC | MC B(13·38분 그래핑 필수), FRQ A(2·30분) | **그래핑(풀 기능)** | 주 사용처. 분석 도구(교점·영점·극값·정적분·미분값) 중요 |
| Statistics | MC·FRQ 양 섹션 | 그래핑 + 통계(1·2변수, 회귀) | 통계 패널은 타 에이전트 모듈. 분포 함수(normalcdf 등) 제공 여부는 미확정(facts §54) |
| Physics 1 | MC·FRQ | 공학용 수준(+ 간단 그래프) | 그래핑 필수 아님 |
| Chemistry, Biology | MC·FRQ | 공학용/사칙 수준 | 로그·지수·과학적 표기. 그래프 불필요 |
| Micro/Macro Econ | MC·FRQ | 사칙+공학용 일부 | 그래핑 불필요 |
| CS A, English Lang | — | 없음 | |
| SAT(기존) | 수학 섹션 | 그래핑(기존 Desmos 대체 대상) | 별도 SAT 정책 문서 기준 |

설계 결론: 계산기는 "프로파일" 3종(`graphing`, `scientific`, `basic`)으로 나누고 섹션 설정이 프로파일 또는 `none`을 지정. 한 코드베이스에서 그래핑은 scientific의 상위 집합. 1차 범위는 `graphing`(Calculus·Statistics·SAT), 2차로 `scientific`.

## 2. 기능 표 (Must / Should / Won't)
| 영역 | 기능 | 등급 | 메모 |
|---|---|---|---|
| 수식 | `y=f(x)`, `f(x)=` 정의, 함수 호출 `f(2)` | Must | |
| 수식 | 변수/상수 정의 `a=3`, 다른 식에서 참조 | Must | |
| 수식 | 슬라이더(변수 자동 생성, 범위·스텝·애니메이션 없이 수동) | Must(M3) | 애니메이션은 Won't |
| 수식 | 점 `(a,b)`, 점 목록 | Must | |
| 수식 | 부등식 음영 `y<x^2` (명시적 y/x) | Should(M3) | 일반 2변수 부등식 격자 샘플링은 M3 이후 |
| 수식 | 매개변수 `(cos t, sin t)` + t 범위 | Should(M3) | BC 대비 |
| 수식 | 극좌표 `r=f(θ)` | Should(M3) | BC 대비 |
| 수식 | 암시적 곡선 `x^2+y^2=4` | Should(M3) | marching squares + 구간 연산 보강 |
| 수식 | 리스트 `[1,2,3]`, 리스트 연산·sum/mean/stdev | Must(M3) | Statistics |
| 수식 | 표(table) 입력 x/y 열 → 점·회귀 | Must(M3) | Statistics |
| 수식 | 회귀 `y1~mx1+b` 선형, 이차, 지수, 로그, 거듭제곱, 로지스틱(선택) | Must(M3: 선형·이차·지수·로그·거듭제곱) | 결과로 r, r², 계수 표시 |
| 수식 | 폴더, 노트, 이미지 | Won't | |
| 수식 | 미분 `d/dx`, 적분 `∫` 표기 입력 | Should(M2) | 수치 평가, 결과 값 표시 |
| 수식 | 3D, 행렬, 복소수, 미분방정식 | Won't | |
| 분석 | 교점, x절편(영점), y절편 | Must(M2) | 곡선 탭/클릭 시 회색 점 표시 후 좌표 |
| 분석 | 극댓/극솟값 | Must(M2) | |
| 분석 | 변곡점 | Should(M2) | 수치 2계도함수 부호 변화; Desmos는 기본 제공 안 함이라 우선순위 낮춤 |
| 분석 | 정적분 값 (구간 지정) | Must(M2) | 칼큘러스 B 핵심. 부호 있는 넓이 음영 표시 |
| 분석 | 점에서 도함수 값 | Must(M2) | |
| 분석 | 접선 그리기 | Should(M2) | |
| 분석 | 점근선 표시 | Should(M4) | |
| 보기 | 줌(휠·핀치·+/-), 팬(드래그), 격자, 축 눈금·라벨, 축 범위 직접 입력, 원점 복귀, 데이터에 맞춤(fit) | Must(M1) | |
| 보기 | 축 비율 1:1 고정, 로그축 | Should(M4)/Won't | 로그축 Won't |
| 입력 | 수식 타이핑 + 실시간 미리보기(분수·지수·루트 조판) | Must(M1) | 단순 텍스트 입력 + KaTeX 미리보기가 1단계, 완전한 수식 편집기는 M4 |
| 입력 | 가상 키패드(숫자·연산·삼각·π·√·^·abs 등) | Must(M1/M4) | 모바일 필수 |
| 입력 | 키보드: 화살표 이동, Enter 새 식, Backspace, `^`·`/`·`sqrt` 자동 구조화 | Must(M4) | |
| 입력 | 터치: 핀치/드래그/탭 선택, 최소 44px 타깃 | Must(M4) | |
| 접근성 | 식 목록 aria, 그래프 요약 텍스트(함수·교점·범위), 키보드만으로 분석 도구 사용, 고대비, 축소 모션 | Must(M4) | 캔버스는 aria-hidden + 텍스트 표 대체 |
| 기타 | URL/계정 간 공유, 이미지 내보내기 | Won't | 시험 환경 |
| 기타 | 응시 문항별 상태 저장 | Should(M3) | §3.6 |

## 3. 아키텍처
### 3.1 파서
- 입력 표현: 내부 ASCII-math(`2x^2+sin(x)`) + 선택적 LaTeX 어휘(편집기 사용 시). 한 번 파싱해 AST로 통일.
- 문법(Pratt 파서, 의존성 없이 직접 구현 가능): 숫자(과학적 표기 포함), 식별자(단일 문자 변수 + 서브스크립트 `x_1`), 단항/이항 연산, `^`(우결합, 단항 마이너스와의 우선순위 `-x^2 = -(x^2)`), 함수 호출, 괄호, 절댓값 `|x|`, 팩토리얼, 리스트 리터럴, 비교 연산자(`<,>,<=,>=`), 등호(정의/방정식 구분).
- 암시적 곱셈: `2x`, `2(x+1)`, `(x+1)(x-1)`, `xsin(x)`는 `x*sin(x)`(함수명 최장 일치 토큰화), `3x^2`는 `3*(x^2)`, `2^3x`는 `(2^3)*x`. 모호 규칙을 문서화하고 골든 테스트로 고정. `f(x)`는 f가 정의된 함수면 호출, 아니면 곱셈.
- 함수: sin cos tan sec csc cot, asin/acos/atan(arcsin 별칭), sinh cosh tanh, ln log(밑10) `log_b`, exp, sqrt, nthroot, abs, floor ceil round, sign, min max, mean stdev total, nCr nPr, 통계는 Statistics 모듈에 위임(§4).
- 상수: π, e, 무한대 입력 `∞`은 적분 구간에서만.
- 각도: 도/라디안 모드 토글, 기본 라디안. 모드는 시험 섹션 설정으로 기본값 지정(Physics는 도 선택 가능). 모드는 평가기에서 삼각 함수 인수에 변환 계수를 곱해 처리.

### 3.2 평가기
- AST를 JS 클로저로 컴파일(성능), 부동소수 double. 도메인 오류는 예외 대신 `NaN` 반환.
- **구간 안전 샘플링**: 플롯 구간 [a,b]를 샘플링할 때 점값만이 아니라 구간 평가(interval arithmetic, 기본 함수는 단조/주기 분할 규칙)로 "이 구간에 함수가 정의되고 연속인가"를 판단. 구간 연산은 +,−,×,÷,^,sqrt,ln,exp,sin,cos,tan,abs 정도만 구현(M1은 샘플링 휴리스틱, 구간 연산은 M2에서 보강).
- 정수 거듭제곱의 음수 밑(`(-8)^(1/3)`): Desmos와 같이 홀수 분모 유리 지수는 실수 근을 허용하도록 유리수 판별을 구현(AP 칼큘러스에서 흔함).

### 3.3 적응형 플로팅
- 화면 폭 픽셀 단위 초기 샘플 + 재귀 세분화: 인접 세 점의 각도/높이 변화가 임계(예: 화면 높이 1/4 이상 또는 꺾임 각 큼)면 중점 삽입(최대 깊이 ~12).
- 불연속/점근선: 인접 샘플의 부호 반전 + 절대값 급증(`|y|`가 화면 범위를 크게 초과) 시 선 연결 끊기. tan, 1/x, 유리함수 검증. 제거 가능한 불연속(`(x²-1)/(x-1)`)은 선만 그리고 빈 점(open circle)은 Won't(1단계), Should(M4).
- 도메인 오류 구간(ln(x), sqrt(x), asin)은 NaN 구간으로 끊음.
- 매개변수/극좌표는 t/θ에 대해 같은 적응 알고리즘(화면 공간 거리 기준).
- 암시적 곡선: 격자 marching squares(셀 크기는 줌 따라 적응), 셀 내 구간 연산으로 거짓 양성 감소.
- 줌/팬 중에는 낮은 해상도 즉시 그림 후 유휴 시 고해상 재그리기(requestIdleCallback).

### 3.4 수치 알고리즘과 정확도 목표
| 기능 | 알고리즘 | 목표(AP 풀이 기준) |
|---|---|---|
| 영점/교점 | 구간 스캔(부호 변화) → Brent(또는 이분+시컨트), 접하는 근은 f'와 f의 최소 탐색 | 절대오차 ≤ 1e-9, 이중근 ≤ 1e-6, 표시 소수 3~6자리 |
| 극값 | 도함수 영점(수치 미분) + 황금분할/Brent 최소화, 경계 구간 처리 | 위치 ≤ 1e-6 |
| 적분 | 적응형 Gauss–Kronrod(G7K15) 재귀, 특이 끝점 변환(분모 0, 1/√x 같은 적분 가능 특이점)은 지수/변수치환 시도, 발산 판정 시 "발산" 표시 | 상대오차 ≤ 1e-8 |
| 도함수 값 | 중심 차분 Richardson 외삽 (h 적응), 복소 스텝 불가이므로 4차 차분 | 상대오차 ≤ 1e-7, 꼬임점(abs(x) at 0)은 "정의되지 않음" 경고 |
| 이차 도함수 | 5점 스텐실 + Richardson | ≤ 1e-5 |
| 회귀 | 선형·다항: QR(Householder) 최소제곱; 지수/로그/거듭제곱은 선형화 후 최소제곱(Desmos도 변환 방식이 아닌 비선형 적합일 수 있음 → 아래 비교) | 계수 상대오차 ≤ 1e-9 vs numpy.polyfit/scipy |
| 비선형 회귀(지수 등) | 선형화 초기값 → Levenberg–Marquardt 비선형 최소제곱 (표준 계산기와 같은 정의인 비선형 적합) | scipy.optimize.curve_fit와 1e-6 이내 |
| 통계량 | 2-pass/Welford | 1e-12 |

**주의(정의 일치)**: TI 계산기의 ExpReg 등은 선형화(ln y) 방식이다. Desmos는 비선형 최소제곱. AP 정답 선지와 일치해야 하므로 Statistics 팀과 "어느 방식을 표준으로 할지"를 정해야 한다(오너 결정 후보 아님, Statistics 팀과 합의).

**골든 테스트**: Python(sympy/scipy/numpy/mpmath)으로 생성한 `golden/*.json`을 저장소에 커밋하고(입력 식·구간·기대값·허용오차), Vitest가 읽는다. mpmath 50자리 참값을 기준으로 삼아 적분·근·극값 케이스 200개 이상(다항, 삼각, 지수/로그, 유리, 절댓값, 특이점, 접근 근, 진동). 생성 스크립트는 오프라인 1회 실행(유료 호출 없음).

### 3.5 렌더링
- **Canvas 2D 선택**(WebGL 불필요): 함수 수 ≤ ~10, 점 수 ~수천. devicePixelRatio 대응, 레이어 분리(격자·축 캐시 canvas / 곡선 canvas / 상호작용 오버레이). OffscreenCanvas+Worker는 M4 성능 문제 시 후속.
- 텍스트(눈금 라벨, 좌표 툴팁)는 canvas 직접 그림 + 접근성용 DOM 요약 병행.
- 수식 조판: KaTeX(MIT) 읽기 전용 렌더. 입력은 §3.7.

### 3.6 상태·저장
- 상태 모델(순수 JSON): `{ profile, angleMode, viewport:{xmin,xmax,ymin,ymax,lockRatio}, expressions:[{id, text, kind, color, hidden, sliderRange?}], tables:[...], settings }`. 평가 결과는 상태에서 파생(저장하지 않음).
- 렌더 상태와 문서 상태 분리(reducer + 구독). 이후 undo/redo 가능.
- 영속: 기본은 메모리(현재 Desmos 패널과 동일하게 한 번 열면 마운트 유지). 옵션으로 시도(attempt)·문항별 JSON을 `sessionStorage`(PII 없음)에 보관, 서버 저장은 하지 않음(시험 부정행위·용량 이슈 없음). 서버 저장은 추후 오너 요청 시.
- 시험 보안: 섹션 설정이 `none`이면 컴포넌트 미마운트 + 저장된 상태 폐기.

### 3.7 라이브러리 vs 직접 구현 (라이선스·크기는 구현 착수 전 `npm view`로 재확인할 것 — 본 표는 작성자 지식 기준)
| 후보 | 용도 | 라이선스(확인 필요) | 크기(대략, gzip) | 위험/판단 |
|---|---|---|---|---|
| math.js | 파서/평가 | Apache-2.0 | 트리셰이킹 시 ~100–170KB | 암시적 곱셈 규칙이 우리와 다름(`2x`는 지원), 구간 연산·도메인 NaN 처리 커스터마이즈 어려움. **파서는 직접 구현 권장**(작고 규칙 통제 필요), 수치 라이브러리로는 불필요 |
| MathLive | 수식 입력 편집기(가상 키보드 포함) | MIT | 수백 KB(폰트 포함) | 모바일 입력·접근성 강함. 번들 크기·스타일 충돌·CSP 영향 검토. **M4 후보, 1순위** |
| Cortex Compute Engine | LaTeX↔AST | MIT | 중간 | MathLive 짝. 사용 시 파서를 이걸로 바꿀 수 있으나 우리 규칙 검증 필요 |
| MathQuill | 입력 편집기 | LGPL-3.0 | ~ 큰 편, jQuery 의존 | LGPL·jQuery로 비선호. **제외** |
| KaTeX | 조판 | MIT | ~75KB+폰트 | 이미 프로젝트에서 쓰는지 확인(수식 렌더에 이미 존재할 가능성) |
| function-plot | 플로팅 | MIT | d3 포함 ~ 큼 | 기능(음영/매개/암시)이 제한적이고 구간 연산 포함이나 커스텀 분석 도구 통합 곤란. **플로터는 직접 구현** |
| ml-regression 류 | 회귀 | MIT | 작음 | 직접 구현이 쉽고 골든 테스트 통제 가능. 필요 시 참조만 |
| numeric/nerdamer | 기호 | MIT | 큼 | 기호 미분 불필요(수치로 충분). 제외 |

권장: **파서·평가기·플로터·수치 알고리즘은 직접 구현(의존성 0)**, 입력만 **MathLive(MIT)** 또는 1단계는 텍스트 입력+KaTeX 미리보기로 시작.

### 3.8 모바일 성능 예산
- 첫 로드 JS(계산기 코어) ≤ 80KB gzip(MathLive 제외, dynamic import로 패널 열 때 로드), MathLive 포함 ≤ 350KB.
- 팬/줌 중 프레임 ≥ 30fps(중급 안드로이드 기준), 식 10개·샘플 4,000점, 줌 재그리기 ≤ 50ms 목표.
- 분석 도구 계산 ≤ 100ms (필요 시 Web Worker).
- 메모리: canvas 2개 + 상태 소량.

## 4. 통합 계획
1. `MockExamMathTools.tsx`는 현재 `GraphingCalculator` 컴포넌트를 렌더. 이를 `CalculatorHost`로 감싸고 `calculatorEngine: "desmos" | "native"`를 선택한다.
2. 기능 플래그: 환경 설정 `NEXT_PUBLIC_CALC_ENGINE`(전역 기본) + 응시 단위 오버라이드(관리자 UAT/교사 계정에만 `native` 선공개). 점진 롤아웃: 내부 UAT → AP Calculus B 파트 → Statistics → SAT 전체.
3. 폴백: native 로드 실패·`window` 오류 시 Desmos로 전환(키가 있는 동안). 정식 전환 후 Desmos 코드와 `DESMOS_API_KEY` 하드코딩을 삭제한다.
4. 활성화 설정 공유: 섹션 메타(`section.calculator: none|allowed|required`)를 단일 진실 소스로 삼고, 여기에 프로파일(`graphing|scientific|basic`)과 `statsPanel: boolean`을 추가. Statistics 계산기 패널과 그래핑 패널이 같은 `MockExamToolButtons` 토글/패널 컨테이너를 쓰며 서로 다른 탭으로 공존. 정책 상수는 `lib/ap-exam/layouts.ts`(`CALCULATOR_TEXT` 존재)에 이어 붙임.
5. 호환: 기존 data-testid(`toggle-calculator`, `mock-exam-calculator`, `desmos-calculator-container`)를 유지/별칭 처리해 기존 테스트가 깨지지 않게 한다.

## 5. 테스트 전략
- **수치 골든**(Vitest): §3.4 JSON, mpmath 참값.
- **속성 테스트**(fast-check): 파서 round-trip(AST→문자열→AST), 적분의 선형성/구간 가산성, 도함수와 적분의 기본정리, 영점에서 |f| 작음, 암시적 곱셈 규칙 동치.
- **플로팅**: 순수 함수 단위(샘플 세분화·불연속 판정)를 점 목록으로 검증; 시각 스냅샷은 Playwright로 canvas 스크린샷(tan, 1/x, sin(1/x), |x|, 유리함수, 극좌표) + 허용 오차 diff.
- **컴포넌트**: Testing Library(키패드 입력, 슬라이더, 표).
- **E2E**: 섹션 `none`에서 버튼/패널 부재, `required`에서 사용 가능; 문항 이동 시 상태 유지; 모바일 뷰포트 핀치 대체 컨트롤.
- 접근성: axe + 키보드 전용 시나리오.

## 6. 작업량·마일스톤 (1인 숙련 개발 기준 일, 리뷰·UAT 포함 약 ±30%)
| 마일스톤 | 내용 | 일 |
|---|---|---|
| M1 | 파서·평가기, 적응형 플로팅(y=, 정의, 슬라이더 없음), 뷰포트·격자·축, 텍스트 입력+KaTeX 미리보기, 호스트·플래그 통합, 골든 파서 테스트 | 10–12 |
| M2 | 분석 도구(교점·영점·극값·적분·도함수·접선), 구간 연산 보강, 골든 수치 테스트 | 8–10 |
| M3 | 표·리스트·슬라이더·점·회귀·부등식·매개·극좌표·암시적 | 10–14 |
| M4 | 입력 편집기(MathLive 통합)·가상 키패드, 모바일 터치, 접근성, 성능 튜닝, 시각/E2E, Desmos 제거 | 8–12 |
| 합계 | | **약 36–48일(7–10주)**, Calculus B 파트만 목표면 M1+M2(+M4 일부)로 **약 4주** |

위험과 완화:
- IP: Desmos UI/문구/아이콘/색/코드 복제 금지. 문서화된 동작(예: 교점 탭 표시)은 기능 아이디어만 참고하고 레이아웃·시각 언어·문구는 독자 설계. 문서 열람은 공개 사용자 가이드에 한정. 시험용 앱 UI가 College Board 시험 UI와 혼동되지 않게 별도 브랜딩.
- 수치 극단 케이스(접근 근, 진동, 특이 적분): 골든 + 실패 시 "계산 불가" 정직 표기, 틀린 숫자를 내지 않는다. 학생이 풀이 점검에 쓰므로 오답 표시가 가장 큰 제품 위험.
- 성능(저가 모바일): 샘플 예산, 워커 이전, 해상도 적응.
- 범위 팽창: Won't 목록 고수, "Desmos와 같아 보이지 않음" 불만 대비 가치 문서화.
- 시험 정책 이탈: 계산기 미허용 섹션은 마운트 자체를 제거(CSS 숨김 금지)하고 E2E로 고정.

## 7. 비용·편익 vs Desmos 상용 라이선스
- 자체 제작: 개발 약 36–48일(위 범위) + 유지보수(연 ~1–2주), 키·정책 리스크 제거, 통계 패널과 통합·분석 도구 맞춤(예: Statistics 분포 함수, 문항별 상태) 가능. 한계: 기능 폭·정교함·학생 친숙도가 Desmos보다 낮음.
- Desmos 상용: 구현 비용 ≈ 0, 실제 시험 계산기와 동일해 학생 연습 일치도 최고. 단 가격·약관 미공개(검색에서 공개 가격 확인 불가), 데모 키는 운영용으로 부적절.
- Desmos에 물어볼 목록: (1) 가격(연간/MAU/좌석/트래픽 기준), (2) 교육 시험 연습 서비스(유료 학원 프로덕트)에 허용되는가, (3) 화이트 라벨·브랜딩 제거 가능 여부, (4) 사용 가능 도메인(스테이징/프리뷰/localhost) 및 키 수, (5) 계산기 상태 저장·모니터링 API(문항별 상태 저장) 범위, (6) 시험 환경 기능 제한 옵션(기능 끄기, 예: 통계/폴더 비활성), (7) SLA·API 버전 고정·장기 지원, (8) 데이터/개인정보 처리(학생 PII 전송 여부), (9) 계약 해지 시 철수 조건, (10) 현재 데모 키 사용의 과거 책임 여부.
- 손익 직감: 상용 연 수천 달러급이 아니면(가격 미확인) 라이선스가 자체 제작 ~7–10주 인건보다 싸다. 반대로 가격이 높거나 약관상 불가라면 자체 제작이 정답. 따라서 **Desmos 회신과 병행해 M1만 착수**하는 하이브리드가 합리적.

## 8. 출처
- AP Central 계산기 정책: https://apcentral.collegeboard.org/exam-administration-ordering-scores/administering-exams/exam-policies/calculator-policy ; https://apcentral.collegeboard.org/help-center/what-calculator-policy-digital-ap-exams
- Desmos 약관(일반 소비자 약관은 비상업적 용도 한정, API 약관은 본 조사에서 미확인): https://www.desmos.com/terms ; API/파트너 문의 https://www.desmos.com/api , https://www.desmos.com/partners
- 내부: `docs/ap/2027-exam-spec-table.md`, `docs/ap/statistics-facts.md`, `app/session/[id]/MockExamMathTools.tsx`, `app/student/mock-exam/[attemptId]/ApExamTakeClient.tsx`
