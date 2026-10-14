# AP Computer Science A — P0 무료 엔지니어링 (2026-10-13)

유료 호출·DB·키·push·삭제 없음. 공식 사실은 `docs/ap/csa-facts.md`. 이 문서는 구현 결과·검증 방식·동결 골격·비용·위험을 한곳에 둔다.

## 1. 핵심 설계 — 정답은 실제 Java 실행 결과

- **실행기** `scripts/ap-generation/archetypes/csa_java.py`: `javac`/`java`(OpenJDK 21, `CSA_JAVA_HOME` → `/opt/homebrew/opt/openjdk@21` → PATH; 시스템 설정 변경 없음)로 컴파일·실행. 임시 폴더(`<tmp>/alton-csa-java`, `CSA_WORKDIR`)에 내용 해시로 저장하고 결과를 캐시(결정적). 제한: 컴파일 30초·실행 10초, 프로세스 그룹 통째 종료, RLIMIT_CPU·FSIZE·NOFILE, `-Xmx128m -Xss1m`, 출력 64KB, 최소 환경변수, 생성 소스에 위험 API 정적 금지(`System.exit`·`Runtime`·`ProcessBuilder`·`java.io/net/nio`·`Thread`·리플렉션 등). 이 실행기는 **우리 템플릿 코드**용이다 — 학생 답안 실행은 범위 밖(자기 점검은 §6 참고).
- **이중 경로**: 정답은 Java 출력 = 독립 Python 참조(`py=`)가 같아야 하고, 다르면 `ValueError`로 시드를 버린다(`test_python_mismatch_discards_the_seed`).
- **오답 = 이름 붙은 오개념을 코드 변형(mutant)으로 실제 실행한 값**: off-by-one, 정수 나눗셈, 별칭(aliasing), 단락 평가, 매개변수 가림(shadowing), 순회 중 삭제, 재귀 기저 조건 등. 정답과 같은 결과를 내는 변형은 자동 제외되어 오답이 3개 미만이면 시드 폐기.
- **코드 완성·버그 수정**(`mk_tests`): 후보를 전부 클래스에 끼워 컴파일·실행해 경계 테스트(음수 배열·빈 배열·한 원소·동률·비정방 2D 등)를 돌린다 — 정답은 전부 통과하는 하나, 오답은 최소 한 테스트에서 실패해야 한다(복수 정답·오답 전부 통과는 폐기). 컴파일 오류 문항은 후보 문장을 각각 `javac`에 넣어 판정, 동작 설명 문항은 영어 설명마다 Python 술어를 두고 5~9개 입력에서 Java 출력과 대조, 초기 조건 문항은 보기 호출을 전부 실행해 한 개만 사양을 어기는지 확인.
- **수치 선택지 간격**: 비정수 값은 서로 상대 8% 이상. **정수는 정확 값이라 서로 다르기만 하면 되고(코드 출력은 반올림 흐림이 없다), |값| > 12 인 정수 쌍만 8% 이상** — 의도적 완화이며 `csa_java.spaced_ok` 가 한 곳에서 정의한다(`test_spaced_ok`). 대안은 "작은 정수 출력도 8% 강제"인데, 그러면 off-by-one 오답(예: 20 vs 21)을 만들 수 없다 — 오너가 원하면 바꾼다.

## 2. 원형 라이브러리 (`csa_p0_a.py`~`csa_p0_f.py`, `csa_p0_frq.py`, `csa_p0_frq2.py`)

| 구분 | 수 | 내용 |
|---|---|---|
| MC 단독 | 84 | P0 48(`a`~`d`) + **2026-10-13 추가 36(`e`·`f`)**: 추적(출력 예측) 약 47·코드 완성(테스트 실행) 약 25·동작 설명·초기 조건·컴파일 오류 약 12 |
| MC 2문항 세트 | 4 (문항 8) | P0 2(같은 배열 메서드, 같은 클래스) + 추가 2(`css_loop_set` 문자열 루프, `css_list_set` ArrayList 메서드: 구체 입력 추적 + 동작 설명) |
| FRQ 시나리오 | 16 (4유형 x 4) | P0 8(유형당 2) + **추가 8(유형당 2, `csa_p0_frq2.py`)** — Q1 메서드·제어문(4+5점) 4·Q2 클래스 설계(9점) 4·Q3 ArrayList 1메서드(9점) 4·Q4 2D 배열(9점) 4 |

- 라이브러리 문항 **92**(원형 88): 단원 U1 19·U2 26·U3 18·U4 29, Practice P2 28·P3 50·P4 14, 스킬 2.A 19·2.B 5·2.C 4·3.A 20·3.B 15·3.C 11·3.D 4·4.A 10·4.B 4.
- 범위: 2027 토픽 목록(`data/ap/curriculum-2027/ap_computer_science_a.json`)에 **상속·다형성·인터페이스 토픽이 없어** 그 원형은 두지 않았다(`csa-facts.md` §3). 코드 실행으로 검증할 수 없는 Practice 1(1.A·1.B)·Practice 5(5.A)는 라이브러리에 없다(공식 최솟값이 0문항으로 내려가 범위 안 조립은 가능, 권장: 비코드 문항 1~2개는 오너 결정).
- **새 구조 규칙(두 번째 회 겹침 0)**: 새 원형은 기존 원형과 코드 모양이 다른 것만 둔다(같은 코드에 숫자만 바꾼 것은 새 원형이 아니다). 모든 MC 원형은 Java 실행 정답 + 독립 Python 경로, 오답 3개는 이름 붙은 오개념을 코드 변형으로 **실제 실행한 값**(코드 완성은 후보 전부를 경계 테스트로 실행). 새 오개념 예: 대입 순서, `+` 연결 우선순위, char 산술, int 오버플로, `Math.random` 범위, 오버로드 선택, `equals` 대 `==`, 반복 횟수·루프 변수 최종값, 독립 `if` + `else if` 사슬, 중첩 반복 시작값, 조기 반환, 범위(scope), 생성자 가림, 값 한계 유지, 배열 참조 전달, `ArrayList.remove(int)` 대 `remove(Object)`, 삽입 정렬 경계 검사 순서, 재귀 이진 탐색 호출 수, 테두리·전치(FRQ).
- **공식 범위를 처음부터 계획에 넣음**: `csa_coverage.py` — (1) `assemble_check`: 라이브러리 한 벌로 42문항을 공식 단원(15–25/25–35/10–18/30–40%)·Practice(2–10/22–38/37–53/10–15/2–10%) 창 안에서 정수계획으로 조립(`test_full_exam_assemblable_in_official_ranges`). (2) **`assemble_two_check`(2026-10-13)**: 같은 라이브러리에서 **서로 겹치지 않는 두 회(각 42문항)** 를 한 번에 푼다 — 원형은 두 회를 합쳐 최대 한 번, 회마다 단원·Practice 범위·코드 스킬 9종이 최소 1문항씩·2문항 세트 1~3개. 결과: **가능**(첫 회 41 원형·42문항, 둘째 회 39 원형·42문항). 마진: **원형 임의 2개가 반려돼도 가능**(`test_survives_the_loss_of_any_two_archetypes`, 88 + 3,828 쌍 전수).
- FRQ 마다 모범 답안·**독립 대안 답안**(다른 알고리즘·다른 내부 표현)·**그럴듯한 오답 3~6개**를 같은 테스트 묶음(6~22개)에 돌려 모범·대안은 전부 통과, 오답은 자기 파트에서 최소 1개 실패함을 확인하고, 테스트 케이스를 `self_check_tests` 로 팩에 저장한다. 기대값은 Python 참조(시뮬레이션·리스트 회전·정렬 등). 채점 행은 1점씩(Q1 a 4행·b 5행, Q2~Q4 9행), `response_mode: "code"`. 새 시나리오: Q1 윤년·월의 일수 / 자릿수 합·디지털 루트, Q2 Scoreboard / Stock, Q3 가장 긴 연속 구간(`Integer ==` 함정: 127 초과 값) / 짧은 문자열 제거(제거 시 인덱스 밀림), Q4 테두리 합(코너 중복 계산) / 전치(비정방형).

## 3. 코드 렌더링 (학생 화면)

- **코드 블록**: stimulus `{kind:"text", description:"```java … ```", data:{variant:"java_code"}}` — 기존 text 자료 경로를 그대로 쓰므로 렌더 게이트(`gateCandidate`)는 `not_applicable`(그림 불필요), 변환(`planConversion`)은 passage 에 펜스 코드를 싣는다. `render-learning-content.ts` 가 펜스를 코드 블록으로, 백틱을 한 줄 코드로 해석하고 `LearningText` 가 줄 번호(선택·복사에 안 섞임)·고정폭·가로 스크롤로 그린다. 코드 글자는 React 텍스트 노드(HTML 주입 없음)라 `$`·`__`·`<`·`&`·`^`·`|` 가 수식·밑줄·표·HTML 로 해석되지 않는다.
- `autoMathExplanation`(해설·선택지 수식 자동 감싸기)은 코드 펜스·백틱을 건너뛴다. `apPassageForDisplay`는 코드 자료를 본문과 단어가 겹쳐도 숨기지 않는다. RW 자료 파서(`rw-stimulus.ts`)는 코드 블록을 글로 처리한다.
- 코드·선택지에 `$`·`__`·백슬래시를 넣지 않는 규칙을 원형 테스트가 검사한다.

## 4. 시험 도구

`subject-tools.ts`: `ap_computer_science_a` = 계산기 탭 없음 + **Java Reference 패널**(`lib/exam-tools/java-reference.ts`, `JavaReference.tsx`; "ALTON study reference — not the official College Board sheet. Use the official Java Quick Reference for exam preparation."). 공식 Quick Reference 와의 1:1 일치는 UNVERIFIED. 레이아웃의 계산기 `na` 와 맞다.

## 5. 학생 FRQ 코드 입력 (완전 디지털 — Statistics 와 같은 타이핑 경로)

Statistics 의 타이핑 FRQ 는 일반 `textarea` 였고 `mode: "code"` 에는 고정폭만 있었다. 코드에 필요한 최소 변경: `CodeAnswerField`(고정폭·줄 바꿈 없음·가로 스크롤·`spellcheck/autocorrect/autocapitalize` 끔, Tab = 공백 4칸·Shift+Tab 내어쓰기·여러 줄 선택 들여쓰기, Enter = 이전 줄 들여쓰기 유지(`{` 뒤 한 단계 더), **Escape 다음 Tab 은 포커스 이동**(키보드 함정 방지), 힌트 문구와 `aria-describedby`). 저장·디바운스·제출은 기존 경로 그대로, 결과 화면의 내 답안은 `mode: "code"` 일 때 고정폭. 손글씨 UI 는 digital 과목이라 나타나지 않는다(테스트). **미구현(문서화된 공백)**: 자동 완성·괄호 자동 닫기·구문 강조·학생 답안 자동 실행(자기 점검 테스트 케이스는 팩에 있으나 앱에서 돌리는 기능은 별도 — 샌드박스 설계가 필요하다), 모바일 가상 키보드의 Tab 키 부재(들여쓰기 버튼은 후속).

## 6. 풀 모의고사 두 회 조립 배선 (2026-10-13, 무료, 구현 완료)

오너 결정(2026-10-13): CS A 를 풀 모의고사 두 회까지 진행한다(예산 중단선 $95·상한 $100, 누적 약 $80.04). 이번 라운드는 유료 호출·DB·키·push·삭제 없이 배선과 계획만 끝냈다.

| 파일 | 내용 |
|---|---|
| `lib/ap-exam/full-set-rules.ts` | `CSA_*` 상수·`csaUnitBounds()`(6–11/10–15/4–8/12–17)·`csaPracticeBounds()`(P1 0–5·P2 9–16·P3 15–23·P4 4–7·P5 0–5)·`verifyCsaFullComposition`(MC 42·FRQ 4·단원·Practice 범위·2문항 세트 1~3개 연속·FRQ 키 중복 없음), `fullPracticeUnitBounds("ap_computer_science_a")` |
| `scripts/ap-generation/cs-pool.ts` | 재고 로더(자동 통과·결함 0·중복 제외·렌더 게이트 통과·화면 증거 보유). FRQ 유형 = `payload.template`(q1~q4), 시나리오 = `payload.archetype`(csf_*) |
| `scripts/ap-generation/cs-assign.ts` (+ `.test.ts`) | HiGHS 정수계획 + 독립 검증기. **두 회를 한 번에(joint) 풀고 구조(원형·시나리오)는 두 회를 합쳐 한 번만**(`--allow-shared-structure` 로만 해제), 한 회 안 문항군(look-alike 포함) 1, 단원·Practice 범위 차단, FRQ q1~q4 각 1, 재고에 없는 칸은 가상 칸(라이브러리 단독 원형·세트 원형·FRQ 시나리오)으로 세어 부족분을 정확히 보고. 순차 모드 `--sequential` |
| `lib/ap-admin/assemble-csa-draft.ts` (+ `.test.ts`) | `planCsaDraftSet`: 가상 문항·미변환 후보·문제 수·FRQ 유형·세트 위치·저장된 풀 세트와의 문항 겹침을 독립 검증 |
| `lib/ap-admin/assemble-draft.ts`, `service.ts` | `SET_PREFIX_SUBJECT` `CS` → `ap_computer_science_a`, `SET_ID_RE`·저장 가능 정규식에 `CS`, 기본 이름 "AP Computer Science A — Practice Exam N" |
| `scripts/ap-generation/supp-batches.ts` | `csaItemNames()` — `data/ap/stock/csa-<배치>-items.json` 을 디스크에서 찾는다(`keys-file.ts` `STOCK_FILES`·`render-check.ts` `SUPP_FILES` 둘 다에 연결). 배치 파일이 생겨도 목록을 고치지 않는다(`csa-item-files.test.ts`) |
| 정확 배정 보고서 복사 규칙 | `--write-report data/ap/stock/exact-assign-csa-cs1-cs2.json`(Chemistry `exact-assign-chem-ch1-ch2.json`·Micro `exact-assign-micro-mi1-mi2.json` 와 같은 이름 규칙: 관리자 화면의 배정 목록이 `exact-assign-*.json` 을 읽는다) |

- **아직 하지 않은 것(재고가 생기면)**: `lib/ap-admin/batches.ts` `STOCK_BATCHES` 에 `csa-*` 적재 배치 등록(적재 시점에 필요), `cs-evidence-keys.ts`(화면 증거 대상 키 산출; `chem-evidence-keys.ts` 복제), 관리자 화면 과목 표시. 커밋된 배정 보고서·재고가 없어서 `assemble-csa-draft.test.ts` 는 라이브러리 구조대로 만든 합성 재고를 배정기로 푼 키를 쓴다.
- 파이프라인 단계 목록(`registry.py list`): `csa_p1_a`(파일럿 MC), `csa_p1_frq`(파일럿 FRQ), **`csa_s2_mc_a/b/c`**(파일럿에 없는 MC 원형 67개를 22·22·23칸으로), **`csa_s2_frq_a/b`**(파일럿에 없는 FRQ 시나리오 12개: q1·q2 / q3·q4), `csa_s2_short_mc`·`csa_s2_short_frq`(비어 있음 — `cs-assign.ts` 부족분 보고 후 채운다). `csa_p0_stages.py`, 검사는 `test_csa_p0.TestPaidRunPlan`.

## 7. 유료 전 남은 일 (코드 밖 결정 포함)

1. FRQ 코드 입력 방식 공식 확인(UNVERIFIED) — 앱은 타이핑을 가정.
2. 공식 Java Quick Reference 항목 대조, 5.A·1.B 비코드 문항 정책.
3. 위 §6 "아직 하지 않은 것" 3가지(적재 배치 등록·증거 키 산출기·관리자 화면)는 재고가 생긴 뒤 한 번에.
4. 학생 답안 자기 점검 실행(샌드박스 설계)·모바일 Tab 대체 버튼(후속).

## 8. 유료 실행 계획 (미동결·미실행 — 오너 승인 뒤 한 단계씩)

**전제**: 누적 약 $80.04(착수 전에 `ledger-total.ts` 로 다시 계산), 중단선 $95, 상한 $100. 단가는 Physics·Chemistry·Micro 실측: **MC 약 $0.039/후보**(생성 문장 고정 + 풀이 + 검토 + 난이도), **FRQ 약 $0.06/후보**(CS A 는 풀이가 Java 전체를 써서 **$0.07 가정**, 범위 0.05–0.10 — 파일럿 실측으로 갱신). 첫 통과율: MC 60–75%(Physics 52%·Chemistry 76%; 코드 검증 정답이라 상위 구간 기대), FRQ 약 45–55%. 칸 = 원형(MC) 또는 시나리오(FRQ), 세트는 2문항이라 비용 2칸으로 센다. 칸당 예산은 각 구성의 `_budget_estimate.perCellUsd`(기대)·`perCellCapUsd`(칸당 참고 상한 = 기대 x 1.5; 실행기는 배치 상한 `capUsd` 98% 에서 멈춘다).

모든 구성은 `config/ap-frozen/csa-*.template.json`(해시 `UNFROZEN`, `--check-only` 가 일부러 실패). 사용: 사본 `<이름>.v1.json` → `run-frozen.ts --freeze` → 커밋(JDK 21.0.x 버전을 커밋 메시지에) → `--check-only` → 오너 승인 후 실행. `hardStopCumulativeUsd` 는 "착수 누적 $80.04 + 이 단계까지의 상한 합 + 0.1" 이므로 앞 단계 상한을 다 쓰지 않았다면 동결 전에 `ledger-total.ts` 로 다시 계산한다.

| 단계 | 내용 | 칸 x 후보 | 기대 | 상한 | 누적(상한 다 쓸 때) | 진행 조건 |
|---|---|---|---|---|---|---|
| 0 (무료) | 동결 확인, JDK 21 확인, 무료 배선 점검(`pipeline2.ts plan\|blueprint\|check`) | — | $0 | — | 80.04 | — |
| 1 `csa-p1-a` | 파일럿 MC: 단독 20 + 세트 1(22문항) | 21칸 x 2 | $1.72 | $2.0 | 82.04 | 첫 통과 ≥ 50%(후보 44개 중 22 이상), 아니면 중단하고 실패 사유 분석 |
| 2 `csa-p1-b` | 파일럿 FRQ: 유형마다 1 시나리오 | 4칸 x 2 | $0.56 | $0.9 | 82.94 | 1 이상 통과, 실제 $/후보로 아래 단가 갱신 |
| 3 `csa-s2-mc-a/b/c` | 파일럿에 없는 MC 원형 67개(U1 15·U2 19·U3 14·U4 19, 세트 3) | 22+23+25(가중) x 2 | $1.72+1.79+1.95 = **$5.46** | $2.3 x 3 | 89.84 | 배치마다 첫 통과 ≥ 40%, 아니면 다음 배치 전에 원형 수정 |
| 4 `csa-s2-frq-a/b` | 파일럿에 없는 FRQ 시나리오 12개(유형당 3) | 6+6칸 x 2 | $0.84 x 2 = **$1.68** | $1.1 x 2 | 92.04 | 유형마다 시나리오 통과 ≥ 2(풀 두 회에 유형당 2개 필요, 파일럿 통과분 포함) |
| 5 (무료) | 재고 검수·렌더·화면 증거 → `cs-assign.ts --sets CS1,CS2 --write-report data/ap/stock/exact-assign-csa-cs1-cs2.json` 로 **가상 칸(부족분) 정확 보고** | — | $0 | — | 92.04 | 가상 칸이 0 이면 6단계 생략 |
| 6 `csa-s2-short-mc` / `-frq` | 부족분만: `STAGE_S2_SHORT_MC/FRQ` 를 보고서의 가상 칸으로 채워 동결 | MC 약 10칸 x 3 / FRQ 약 2칸 x 3 | $1.17 + $0.42 = **$1.59** | $1.4 + $0.5 | 93.94 | 한 번 더 부족하면 오너에게 보고(예산 중단선 $95 안에서는 한 번의 소규모 재시도만) |
| 합계 | | | **기대 $11.01 → 예비 1.15배 $12.66** | $13.9 | **93.94 (여유 $1.06)** | |

- 파일럿 통과분은 그대로 재사용하므로(파일럿 칸은 3단계에서 다시 만들지 않는다) 중복 비용이 없다. 구성·상한 합은 `csa_cost.paid_plan()` 과 `test_csa_p0.TestPaidRunPlanConfigs` 가 구성 파일과 맞는지 검사한다.
- **왜 칸당 후보 2 + 부족분 보충인가**(무료 시뮬레이션, `csa_coverage.assemble_two_check` 에서 원형을 확률적으로 제거): 칸당 2후보면 원형 손실률은 (1−p)², 두 회 조립이 부족분 없이 가능한 확률은 첫 통과 p=0.52 → 0%·p=0.60 → 1%·p=0.68 → 33%·p=0.76 → 79%, 부족분으로 복구해야 할 원형은 평균 14·8·3·2개. 칸당 3후보를 처음부터 쓰면 p=0.60 에서 75%·p=0.68 에서 99% 가 부족분 없이 가능하지만 MC 비용이 +$2.6 이다. 2후보 + 부족분(3후보 x 실제 필요한 칸만)이 더 싸다.
- **민감도**: 첫 통과 52%(낙관 아님) 이면 부족분 MC 약 14칸 x 3 x $0.039 = $1.64 로 단계 6 상한($1.4)을 올려야 한다(누적 약 94.2, 중단선 안). 단가가 FRQ $0.10 이면 단계 2·4·6(FRQ)이 +$0.9 정도 늘어 누적 약 94.8 로 중단선에 닿는다 → 그때는 단계 4 후에 멈추고 보고한다.
- 실행 순서와 중단 규칙: 1 → 2 → (결과로 단가·통과율 갱신) → 3 → 4 → 5 → 6. 어느 단계든 누적이 $95 에 닿으면 즉시 중단·보고(`hardStopCumulativeUsd` 가 자동으로 멈춘다). 유료 CS A 단계는 오너 승인 대기이며 이 문서는 계획과 구성만 둔다.
- 코드·스킬 설계 변경 시 라이브러리 수(88 원형·92 문항)나 단계 목록이 바뀌면 `csa_p0_stages.py`·구성 `archetypeList`·`PAID_STEPS` 를 같이 갱신한다(테스트가 어긋남을 잡는다).
