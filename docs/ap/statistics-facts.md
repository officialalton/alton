# AP Statistics 공식 사실 검증 + 엔지니어링 준비 (2026-10-12, 무료)

유료 호출·DB·키·생성 없음. 출처는 공개 College Board 자료이며 문구는 짧은 인용·요약만 쓴다(시험 문항·채점 문구 복제 없음).

**출처**
- [CED] AP Statistics Course and Exam Description (2027 시험·5단원, ©2026): https://apcentral.collegeboard.org/media/pdf/ap-statistics-course-and-exam-description.pdf — 로컬 텍스트 추출 후 대조. 쪽 번호는 CED 인쇄 쪽.
- [AP-exam] https://apcentral.collegeboard.org/courses/ap-statistics/exam
- [AP-rev] https://apcentral.collegeboard.org/courses/ap-statistics/future-revisions

## 1. 검증된 사실 (미확인 ①~⑤ 해소)

| 항목 | 확인 결과 | 출처 |
|---|---|---|
| 시험 총 길이 | **3시간**(MC 90분 + FRQ 90분). 문항 수: MC 42 + FRQ 4 | CED p.156 Exam Overview |
| MC | **42문항·90분·가중 50%**, "discrete and set-based questions", 선지 **4개**(5→4) | CED p.156–157, [AP-rev] |
| MC 세트 구조 | **3문항 세트 2개**(합 6문항 + 단독 36문항). 샘플에서 Q9–11(단원 2 이항·확률), Q22–24(단원 5 회귀)가 각각 3문항 세트. [AP-rev]: 하나는 확률·확률변수·분포, 하나는 회귀 | CED p.160 이하 샘플, [AP-rev] |
| FRQ | **4문항·90분·50%**, 각 **10점**, 문항당 12.5%, 분석적 채점 | CED p.156 |
| FRQ 순서·초점 | Q1 Multi-Focus Practices 1·2 / Q2 Multi-Focus Practices 3·4 / Q3 Inference(가설검정 또는 신뢰구간) / Q4 Multi-Focus Practices 2·3·4(여러 단원) | CED p.156, p.158 |
| FRQ 문항별 권장 시간 | **공식 미명시**(CED·AP Central에 문항별 분 배분 없음) → UNVERIFIED(미공표로 취급) | CED p.156 |
| FRQ 채점 구조(샘플 4문항) | 모든 문항 **파트 행 1점씩 합 10점**(0/1점 이분 행, 일부 파트는 구성요소 행 여러 개). Q1: A(i)(ii), B(i)(ii), C(i)(ii), D, E(3행: 질문의 3요소) = 10행. Q2: A(i)(ii), B(i)(ii), C(i)(ii)(iii), D(2행), E = 10행. Q3: A(2), B, C(5), D(2) = 10행. Q4: A(i)(ii), B(2), C, D(i), D(ii)(2), E(2) = 10행 | CED p.176–224 |
| "investigative task" | **별도 FRQ·문항 유형이 아니다.** 공식 표현은 *investigative question*: Practice 1 스킬 **1.A**("valid investigative question that requires a statistical investigation")·LO 1.1.B·토픽 1.10. 샘플 FRQ1 파트 E에서 출제("valid investigative question"의 3요소 포함). [AP-exam]/[AP-rev]는 "investigative questions topics 추가"만 언급 | CED p.11·p.158·샘플 FRQ1 E |
| Q4가 investigative task라는 repo 추정 | **오답.** Q4는 복합 추론(Practices 2·3·4, 단원 1·2·4 샘플). 투자 질문은 Q1(Practice 1)에서 주로 다뤄짐 | CED p.175 정렬표 |
| 공식 수식·표 | **전 섹션에서 제공**(CED 부록 "Formula Sheet and Tables", p.226–237). 시험지: Bluebook 내 참조 정보 + 학교에 인쇄본 발송 | CED p.156, 부록, [AP-rev] |
| 계산기 | CED: **통계 기능을 갖춘 그래핑 계산기가 양 섹션에서 "expected"**(허용·사실상 전제). [AP-rev]: 승인된 휴대용 그래핑 계산기 **+ Bluebook 내장 Desmos 그래핑 계산기** 사용 가능. 파트 분할 없음 | CED p.156–158, [AP-rev] |
| 전달 방식 | **완전 디지털(Bluebook)**, 종이 FRQ 책자 폐지, 자동 제출. 통계 표기를 키보드로 입력하는 별도 안내 있음 | [AP-exam], [AP-rev] |
| 단원 MC 가중 | U1 20–30, U2 15–25, U3 15–25, U4 10–20, U5 10–20 (%) | CED p.157 (JSON과 일치) |
| 스킬 MC 가중 | P1 5–10, P2 20–30, P3 25–35, P4 25–35 (%) | CED p.157 (일치) |
| 스킬 코드 | 1.A / 2.A–2.E / 3.A–3.E / 4.A–4.G, 라벨은 CED p.11–12 대조 완료 | CED p.12 (JSON `skills`와 일치) |
| 시험일 | 2027-05-11(화) Session 2 | [AP-exam] |
| 삭제 주제(기하분포 등) | CED 본문에서 별도 대조 안 함(spec-table 기존 값 유지) → 부록 B 항목은 UNVERIFIED | — |

### 2027 vs 현행(구 형식) — repo 타깃은 2027
| 항목 | 현행(2026까지) | 2027 | repo |
|---|---|---|---|
| MC | 40문항·90분·5지선다 | 42·90분·4지선다 | 2027 |
| FRQ | 6문항(5 짧은 + 1 투자, 각 4점대 가변)·90분 | 4문항·각 10점·90분 | 2027 |
| 단원 | 9 | 5 | 2027 |
| 전달 | 종이/하이브리드 | 완전 디지털 | 2027 |

(구 형식 수치는 일반 공개 정보이며 이번 조사에서 CED 구판을 열지 않았음 → 참고용, 타깃 아님.)

## 2. repo 정정 이력

| 날짜 | 파일 | 변경 | 근거 |
|---|---|---|---|
| 2026-10-12 | `docs/ap/ten-set-plan.md` | "세트당 6문항=12문항" → 3문항 세트 2개 = 6문항(10세트 20묶음·60문항) | CED 샘플·[AP-rev] |
| 2026-10-12 | `lib/ap-exam/layouts.ts` | **변경 없음**(42·90·4지선다·FRQ 4·90·allowed 모두 공식과 일치). 회귀 방지 테스트만 추가(`layouts.test.ts`) | CED p.156 |
| 2026-10-12 | `docs/ap/2027-exam-spec-table.md` | 변경 없음(값 일치). Stats 행에 "총 3시간·수식표 제공·Desmos 내장·investigative task 아님" 보주 추가 | 위 표 |
| 2026-10-12 | `docs/ap/statistics-groundwork.md` | §1 미확인 ①②③④ 해소 표기, "Verified facts" 절 추가 | 위 표 |

## 3. 남은 UNVERIFIED
1. FRQ 문항별 권장 소요 시간(공식 미공표).
2. 삭제 주제 5종의 CED 본문 대조(spec-table 기존 값 사용 중).
3. Bluebook 내장 Desmos가 통계 함수(normalcdf 등)를 제공하는지 — AP Central은 "그래핑 계산기"라고만 기재. 제품 결정 C(계산기 위젯)에 영향. 휴대용 계산기가 통계 함수 담당이라는 전제.
4. 수식표 부록의 정확한 표 구성(정규·t·χ² 분포표 포함 여부 쪽별 대조) — 본 조사는 부록 존재(p.226–237)와 "Sampling Distributions…" 수식표 확인까지. 분포표 항목은 부록 본문 추가 대조 필요.
5. 샘플 MC 24문항의 비중(24 = 단독 18 + 세트 2×3)은 샘플이며 시험 분포를 대표하지 않는다고 CED가 명시.

## 4. E-리스트 점검 (엔지니어링, 무료)

### 4-1. `ap_statistics` 지원 공백 (읽기 전용 점검 결과)
| 위치 | 현황 | 필요 조치 |
|---|---|---|
| `lib/ap-curriculum/*`·`curriculum-data.test.ts` | 완료(JSON 로드·검증) | 없음 |
| `lib/ap-exam/layouts.ts` | 완료 | 없음 |
| `lib/problem-taxonomy.ts` AP_SUBJECTS | `supported:false`(AB도 동일, 자리표시) | 없음 |
| `lib/ap-generation/gates.ts` `NOT_ASSESSED_MC`·`OPTION_COUNT` | AB·Micro·Bio만. Stats 없음 → 선지 수 기본값 의존 | Stats 항목(`OPTION_COUNT: 4`, NOT_ASSESSED_MC 없음) 추가 — E2 |
| `scripts/ap-generation/cells.ts` `SAMPLE_PLAN`·`NOT_ASSESSED_MC`·`assignMcSkills`(calc 분기: AB 기본 스킬·needle 문구) | AB·Bio·Micro 전용 | Stats 계획(MC 42, 세트 2 = `sets:[{unit:"2",items:3},{unit:"5",items:3}]`, FRQ 4슬롯)·기본 스킬(P1→1.A, P2→2.A, P3→3.B, P4→4.D) 추가 |
| `lib/ap-generation/subjects/` | calc-ab/bc만 | `stats.ts` 신규(E2) — SubjectGuide, bannedTerms |
| `lib/ap-generation/stock.ts` `SUBJECT_FAMILY`·AB/BC 공유 로직 | calculus만 | `ap_statistics: "statistics"` 추가(공유 스코프 영향 없음) |
| `lib/ap-figures/normalize.ts:338` `calc` 분기, `gate.ts:263`(표 제목 경고 AB·BC 예외), `renderTypeOf` | Bio·Micro·Calc 렌더 이름만, 나머지는 `calc_*`로 떨어짐 | Stats 렌더 분류(`ap_graph:stats_*`, 표 제목 경고 정책) — §4-3 어댑터 |
| `lib/ap-admin/batches.ts` | 과목 중립(레지스트리 하드코딩은 배치 ID 목록뿐) | Stats 배치 ID는 생성 후 추가 |
| `scripts/ap-generation/import-candidates.ts` | `subjects.ap_subject_code`로 과목 조회, 코드 하드코딩 없음 | **DB `subjects`에 `ap_statistics` 행 존재 여부만 확인 필요**(읽기, 오너/배포 세션) |
| `lib/ap-admin/assemble-draft.ts:18` `subjectOfSetId` | `BC*`면 BC, 아니면 AB — **Stats 세트 ID는 AB로 오판** | 과목 인자화 필요(Stats 세트 조립 전) |
| `lib/ap-admin/partial-draft.ts:80`·`new-version.ts:126/141`·`mock-exam-actions.ts:632` | AB/BC 전제, unitBounds는 AB full만 | Stats full_practice 단원 bounds(공식 20–30 등) 연결 필요. 부분 세트는 AB/BC 전용(`AP_PARTIAL_SUBJECTS`) → Stats는 부분 세트 없음(정책 유지) |
| `scripts/ap-generation/assign-pool.ts`·`ab-select.ts`·`exact-assign*` | AB/BC 단원 기준 | Stats 칸 구조(2 공유 세트 제약)용 확장 — E9 |
| 관리자 화면(`ApNewVersionPanel`, `getMockExamApPool*`) | RPC `mock_exam_ap_pool_subjects`로 과목 동적 | 별도 하드코딩 없음 |

요약: 데이터·레이아웃은 준비됨. **코드 공백은 생성 계층(gates/cells/subjects)과 조립 계층(`subjectOfSetId`·unitBounds)**.

### 4-2. Python 환경 설정 절차 (이 머신: scipy/numpy/sympy 없음, python3 = 3.14.7, python3.11도 있음, pip 인덱스 접근 확인됨)
```
cd ~/Developer/ALTON            # 또는 worktree
python3.11 -m venv .venv-ap     # (3.14보다 scipy 휠 호환성이 안정적; 3.14도 scipy 1.18 휠 제공 확인 시 사용 가능)
source .venv-ap/bin/activate
pip install numpy==2.4.6 scipy==1.18.1 sympy
pip freeze | grep -E "numpy|scipy|sympy" > scripts/ap-generation/requirements.txt
python -c "import scipy.stats as s; print(s.norm.cdf(1.96), s.t.ppf(.975, 14), s.chi2.sf(3.84, 1), s.binom.pmf(3, 10, .5))"
```
- `.venv-ap/`는 `.gitignore`에 추가(현재 requirements 파일 없음). 기존 AB 원형(`common.py`)이 `import sympy`를 쓰므로 같은 venv에서 AB 원형 회귀 테스트도 실행한다.
- 이 점검에서 `pip index versions scipy/numpy`로 가용성만 확인했다. 설치는 하지 않음(무료 읽기 범위).

### 4-3. SAT 차트 템플릿 → AP 그림 게이트 어댑터 계획
현재 AP 게이트 인식 타입: `ap_graph`/`ap_table`/`ap_table_set`/`ap_diagram`. SAT `lib/problem-figures/templates`: `data.ts`(table·two_way·bar·line·histogram·scatter+fitLine·boxplot/boxes·dot_plot), `stem-leaf.ts`, `pie.ts`, `stacked-bar.ts`, `freq-chart.ts`, `venn-tree.ts`, `number-line.ts`.

1. **스펙 타입 확장**: `ApSpec` 유니온에 `ap_stat_chart`(공통 래퍼: `{type:"ap_stat_chart", chart:"histogram|dot_plot|scatter|boxes|two_way|bar|stem_leaf|pie|stacked_bar|venn_tree", data:<해당 SAT 템플릿 입력>, title, xLabel, yLabel, alt}`)를 추가. SAT 템플릿 입력 스키마를 그대로 통과시켜 재작성 없이 렌더(`data.ts`의 렌더 함수 직접 호출).
2. **normalize**: `normalizeStimulus`에 `stat_chart` 분기 — LLM·Python 원형 출력의 `kind`(예: `histogram`)를 `ap_stat_chart`로 변환, 필수 필드 검증(계급 경계 단조·도수 비음수·합계 일치(two_way)·가지 확률 합 1(venn_tree)·점 수 ≥ 한계), 오류는 `NormIssue`로.
3. **gate**: `classifyNeed`에 `histogram/dot_plot/scatter/boxes/two_way/...` stimKind → `required`; `renderTypeOf` → `ap_stat_chart:<chart>`; 제목·축 라벨·단위 검사, alt 문구 자동 생성(`computeFeatures`에 통계 특징: n, 중앙/범위, 상관 부호 추가).
4. **렌더 검사**(`render-check.ts`)와 `screen-evidence`: 차트 종류별 PNG 갤러리(390×844, 1280×800) 추가.
5. **신규 표현 4건(E5)**: 상자그림 이상치 점, 산점도 점 강조/라벨, 이중 눈금 정규/t/χ² 곡선(`ap_graph` 계열 + z 눈금 보조 축), 컴퓨터 출력 블록(고정폭 표).
6. **테스트**: 각 차트별 정상 1·결함 1(경계 비단조·합 불일치) 케이스 → `lib/ap-figures/gate.test.ts` 패턴 확장. 가장 작은 선행 단위는 histogram·scatter·two_way 3종(S1 파일럿 원형이 쓰는 것).
추정 2.5일(E4) + 신규 표현 3일(E5).

## 5. S1 파일럿 사양 (실행 대기 — 생성 없음, 오너 예산 확인 후)

**목적**: 원형·게이트·그림·통과율을 소량 실측해 S2(첫 세트+예비) 진행 여부 결정. 한도 **$1.5**(원장 자동 중단), 중단 규칙: 통과율 50% 미만(전체 또는 H 원형).

**전제(실행 전 필수)**: E1 Python 환경, E2 stats 가이드, E3 계산기 규칙(`allowed`에서 "계산만 묻는 문항" 검사), E4 어댑터 최소(histogram·scatter·two_way·dot_plot·boxes), `gates.ts` Stats 항목. 원형 코드(Python)는 무료 구현·로컬 이중 경로 검증.

**대상 20 원형 × 시드 1** (번호는 `statistics-groundwork.md` §4 표):
| 단원 | 원형 # | 위험 | 그림 |
|---|---|---|---|
| U1 (5) | 3 히스토그램 중앙구간, 6 5수→이상치 경계(상자그림), 9 z로 상대 위치, 12 관찰/실험·인과, 14 교란변수(H) | L,L,L,M,H | H,B,-,-,- |
| U2 (5) | 16 조건부확률(표), 19 트리→역확률, 23 이항 조건·P(X=k), 25 정규 영역, 29 CLT | L×4,M | T,V,-,N,D |
| U3 (4) | 33 CI 해석 문구(H), 37 p값 해석(H), 38 1-표본 z 검정, 43 χ² 출력 해석 | H,H,L,M | -,N,N,O |
| U4 (3) | 46 t 검정, 48 2표본 t, 50 t 컴퓨터 출력 | L,L,M | N,O,O |
| U5 (3) | 55 기울기 해석(H), 57 잔차그림 적합성, 60 영향점 | H,M,L | -,R,S |
(합 20: U1 5 + U2 5 + U3 4 + U4 3 + U5 3. 공유 세트·FRQ는 S2에서.)

**구성**: L 10·M 6·H 4 → 기대 첫 통과율 ≈ (10×0.8+6×0.67+4×0.5)/20 ≈ 70%(기존 가정). H 4개 통과율이 <50%면 H 원형 폐기/고정 문장 템플릿 강화. 그림 필요 문항(≈9개)에 ×1.6 승수.

**예상 비용**: 후보 20건 생성·검토를 단가 $0.06–0.134/통과(그림 ×1.27 평균)로 환산하면 낙관 약 $1.5(20×0.06×1.27), 보수 약 $3.4(20×0.134×1.27)(재시도 포함). **한도 $1.5는 낙관 단가에서만 20건 완주가 가능하다.** 따라서 실행 순서를 위험 오름차순(L 먼저 → M → H 마지막)으로 두고 원장이 $1.5에서 자동 중단되면 완주 건수와 통과율을 그대로 보고(미완 H 원형은 S2로 이월)하거나, 오너가 한도를 $2.5~3.5로 확인한다. → **오너 확인 질문**: S1 한도 $1.5 고정(미완주 허용) vs $3 상향.

**산출·판정**: 원형별 통과/반려 사유, 키 일치율, 그림 렌더 결과, 단가 실측, H 원형 유지/폐기, S2 한도 재산정. 모든 단계 결정적 게이트·설계도·5기준 검토는 기존과 동일.
