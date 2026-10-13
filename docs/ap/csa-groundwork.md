# AP Computer Science A — P0 무료 엔지니어링 (2026-10-13)

유료 호출·DB·키·push·삭제 없음. 공식 사실은 `docs/ap/csa-facts.md`. 이 문서는 구현 결과·검증 방식·동결 골격·비용·위험을 한곳에 둔다.

## 1. 핵심 설계 — 정답은 실제 Java 실행 결과

- **실행기** `scripts/ap-generation/archetypes/csa_java.py`: `javac`/`java`(OpenJDK 21, `CSA_JAVA_HOME` → `/opt/homebrew/opt/openjdk@21` → PATH; 시스템 설정 변경 없음)로 컴파일·실행. 임시 폴더(`<tmp>/alton-csa-java`, `CSA_WORKDIR`)에 내용 해시로 저장하고 결과를 캐시(결정적). 제한: 컴파일 30초·실행 10초, 프로세스 그룹 통째 종료, RLIMIT_CPU·FSIZE·NOFILE, `-Xmx128m -Xss1m`, 출력 64KB, 최소 환경변수, 생성 소스에 위험 API 정적 금지(`System.exit`·`Runtime`·`ProcessBuilder`·`java.io/net/nio`·`Thread`·리플렉션 등). 이 실행기는 **우리 템플릿 코드**용이다 — 학생 답안 실행은 범위 밖(자기 점검은 §6 참고).
- **이중 경로**: 정답은 Java 출력 = 독립 Python 참조(`py=`)가 같아야 하고, 다르면 `ValueError`로 시드를 버린다(`test_python_mismatch_discards_the_seed`).
- **오답 = 이름 붙은 오개념을 코드 변형(mutant)으로 실제 실행한 값**: off-by-one, 정수 나눗셈, 별칭(aliasing), 단락 평가, 매개변수 가림(shadowing), 순회 중 삭제, 재귀 기저 조건 등. 정답과 같은 결과를 내는 변형은 자동 제외되어 오답이 3개 미만이면 시드 폐기.
- **코드 완성·버그 수정**(`mk_tests`): 후보를 전부 클래스에 끼워 컴파일·실행해 경계 테스트(음수 배열·빈 배열·한 원소·동률·비정방 2D 등)를 돌린다 — 정답은 전부 통과하는 하나, 오답은 최소 한 테스트에서 실패해야 한다(복수 정답·오답 전부 통과는 폐기). 컴파일 오류 문항은 후보 문장을 각각 `javac`에 넣어 판정, 동작 설명 문항은 영어 설명마다 Python 술어를 두고 5~9개 입력에서 Java 출력과 대조, 초기 조건 문항은 보기 호출을 전부 실행해 한 개만 사양을 어기는지 확인.
- **수치 선택지 간격**: 비정수 값은 서로 상대 8% 이상. **정수는 정확 값이라 서로 다르기만 하면 되고(코드 출력은 반올림 흐림이 없다), |값| > 12 인 정수 쌍만 8% 이상** — 의도적 완화이며 `csa_java.spaced_ok` 가 한 곳에서 정의한다(`test_spaced_ok`). 대안은 "작은 정수 출력도 8% 강제"인데, 그러면 off-by-one 오답(예: 20 vs 21)을 만들 수 없다 — 오너가 원하면 바꾼다.

## 2. 원형 라이브러리 (`csa_p0_a.py`~`csa_p0_d.py`, `csa_p0_frq.py`)

| 구분 | 수 | 내용 |
|---|---|---|
| MC 단독 | 48 | 추적(출력 예측) 24·코드 완성(테스트 실행) 14·버그 수정/컴파일 오류 2·동작 설명 5·전제(초기 조건) 2·De Morgan 진리표 1 |
| MC 2문항 세트 | 2 (문항 4) | 같은 배열 메서드(추적 + 동작 설명)·같은 클래스(상태 추적 + 메서드 구현 선택) |
| FRQ 유형 | 8 (4유형 x 2) | Q1 메서드·제어문(4+5점) 2·Q2 클래스 설계(9점) 2·Q3 ArrayList 1메서드(9점) 2·Q4 2D 배열(9점) 2 |

- 라이브러리 단원 문항 수 U1 9·U2 12·U3 10·U4 21, Practice P2 15·P3 29·P4 8, 스킬 2.A 10·2.B 3·2.C 2·3.A 10·3.B 11·3.C 6·3.D 2·4.A 6·4.B 2.
- 범위: 2027 토픽 목록(`data/ap/curriculum-2027/ap_computer_science_a.json`)에 **상속·다형성·인터페이스 토픽이 없어** 그 원형은 두지 않았다(요청 목록과 다름 — `csa-facts.md` §3). 코드 실행으로 검증할 수 없는 Practice 1(1.A·1.B)·Practice 5(5.A)는 파일럿 라이브러리에 없다(공식 최솟값이 0문항으로 내려가 범위 안 조립은 가능, 권장: 비코드 문항 1~2개는 오너 결정).
- **공식 범위를 처음부터 계획에 넣음**: `csa_coverage.py` — 라이브러리 한 벌로 42문항을 공식 단원(15–25/25–35/10–18/30–40%)·Practice(2–10/22–38/37–53/10–15/2–10%) 창 안에서 정수계획으로 조립할 수 있는지 검사(`test_full_exam_assemblable_in_official_ranges`: 40개 원형 → 42문항 가능). 처음 조립 검사가 Practice 2·4 가 모자라 불가능(P2+P3+P4 가 42에 못 미침)하다는 것을 잡아 원형 8개(코드 완성 5·동작 설명 2·초기 조건 1)를 추가했다 — Physics 에서 겪은 쏠림을 유료 호출 전에 막았다.
- FRQ 마다 모범 답안·**독립 대안 답안**(다른 알고리즘·다른 내부 표현)·**그럴듯한 오답 3~5개**를 같은 테스트 묶음(6~22개)에 돌려 모범·대안은 전부 통과, 오답은 자기 파트에서 최소 1개 실패함을 확인하고, 테스트 케이스를 `self_check_tests` 로 팩에 저장한다. 기대값은 Python 참조(시뮬레이션·리스트 회전·정렬 등). 채점 행은 1점씩(Q1 a 4행·b 5행, Q2~Q4 9행), `response_mode: "code"`.

## 3. 코드 렌더링 (학생 화면)

- **코드 블록**: stimulus `{kind:"text", description:"```java … ```", data:{variant:"java_code"}}` — 기존 text 자료 경로를 그대로 쓰므로 렌더 게이트(`gateCandidate`)는 `not_applicable`(그림 불필요), 변환(`planConversion`)은 passage 에 펜스 코드를 싣는다. `render-learning-content.ts` 가 펜스를 코드 블록으로, 백틱을 한 줄 코드로 해석하고 `LearningText` 가 줄 번호(선택·복사에 안 섞임)·고정폭·가로 스크롤로 그린다. 코드 글자는 React 텍스트 노드(HTML 주입 없음)라 `$`·`__`·`<`·`&`·`^`·`|` 가 수식·밑줄·표·HTML 로 해석되지 않는다.
- `autoMathExplanation`(해설·선택지 수식 자동 감싸기)은 코드 펜스·백틱을 건너뛴다. `apPassageForDisplay`는 코드 자료를 본문과 단어가 겹쳐도 숨기지 않는다. RW 자료 파서(`rw-stimulus.ts`)는 코드 블록을 글로 처리한다.
- 코드·선택지에 `$`·`__`·백슬래시를 넣지 않는 규칙을 원형 테스트가 검사한다.

## 4. 시험 도구

`subject-tools.ts`: `ap_computer_science_a` = 계산기 탭 없음 + **Java Reference 패널**(`lib/exam-tools/java-reference.ts`, `JavaReference.tsx`; "ALTON study reference — not the official College Board sheet. Use the official Java Quick Reference for exam preparation."). 공식 Quick Reference 와의 1:1 일치는 UNVERIFIED. 레이아웃의 계산기 `na` 와 맞다.

## 5. 학생 FRQ 코드 입력 (완전 디지털 — Statistics 와 같은 타이핑 경로)

Statistics 의 타이핑 FRQ 는 일반 `textarea` 였고 `mode: "code"` 에는 고정폭만 있었다. 코드에 필요한 최소 변경: `CodeAnswerField`(고정폭·줄 바꿈 없음·가로 스크롤·`spellcheck/autocorrect/autocapitalize` 끔, Tab = 공백 4칸·Shift+Tab 내어쓰기·여러 줄 선택 들여쓰기, Enter = 이전 줄 들여쓰기 유지(`{` 뒤 한 단계 더), **Escape 다음 Tab 은 포커스 이동**(키보드 함정 방지), 힌트 문구와 `aria-describedby`). 저장·디바운스·제출은 기존 경로 그대로, 결과 화면의 내 답안은 `mode: "code"` 일 때 고정폭. 손글씨 UI 는 digital 과목이라 나타나지 않는다(테스트). **미구현(문서화된 공백)**: 자동 완성·괄호 자동 닫기·구문 강조·학생 답안 자동 실행(자기 점검 테스트 케이스는 팩에 있으나 앱에서 돌리는 기능은 별도 — 샌드박스 설계가 필요하다), 모바일 가상 키보드의 Tab 키 부재(들여쓰기 버튼은 후속).

## 6. 유료 전 남은 일 (코드 밖 결정 포함)

1. FRQ 코드 입력 방식 공식 확인(UNVERIFIED) — 앱은 타이핑을 가정.
2. 풀 모의고사 조립 배선(`cells.ts`, `stock.ts` SUBJECT_FAMILY, `assemble-draft.ts` subjectOfSetId·`SET_PREFIX_SUBJECT` 에 CS, `full-set-rules.ts` unitBounds): 이번 라운드는 라이브러리·게이트·파일럿 배선까지만(`pipeline2.ts plan|blueprint|check` 무료 배선 점검 통과). 문서 `docs/ap/chemistry-groundwork.md` §10 과 같은 후속 단계.
3. 서로 다른 풀 모의고사 2회(겹침 0): 라이브러리 52 문항 구조로는 한 회분(42)만 구조가 겹치지 않는다. 두 번째 회는 같은 원형을 다른 시드로 다시 쓰게 되어 **구조 중복(같은 코드 모양, 다른 숫자)** 이 생긴다 — 완전히 새 구조의 두 번째 회가 필요하면 원형 약 30개 추가(무료 엔지니어링).
4. 공식 Java Quick Reference 항목 대조, 5.A·1.B 비코드 문항 정책.
5. Q2 클래스 설계는 한 파트에 9행 — 공식 형식과 같다.

## 7. 동결 구성 골격과 비용 추정 (미동결·미실행)

- `config/ap-frozen/csa-p1-a.template.json`(MC 22칸 = 단독 20 + 세트 1, 단원 4/6/4/8·Practice 8/11/3, 후보 2, 상한 $2.2)와 `csa-p1-b.template.json`(FRQ 4, 후보 2, 상한 $1.0). 해시는 `UNFROZEN`, 동결 전 `ledger-total.ts` 로 누적 재계산(누적 약 $85 가정 시 `hardStopCumulativeUsd` 87.3·88.3, 중단선 $90 이내). JDK 주버전(21)은 동결 커밋 메시지에 기록한다.
- 단가 근거: Physics·Chemistry 실측 — MC 약 $0.039/후보, FRQ 약 $0.05–0.06/후보(CS A 는 풀이가 Java 전체를 써서 $0.07 가정, 범위 0.05–0.10), 첫 통과율 MC 52–76%(중간 60%)·FRQ 약 45%(`csa_cost.py`, 테스트로 고정):

| 항목 | 기대 비용 |
|---|---|
| 파일럿 P1-a(MC 22칸x후보 2) | $1.72 (범위 1.3–2.2) |
| 파일럿 P1-b(FRQ 4칸x후보 2) | $0.56 (범위 0.4–0.8) |
| 파일럿 합계 | **$2.28** |
| 풀 모의고사 1회(MC 42·FRQ 4, 칸당 후보 2/3 + 실패 칸 1회 보충) | $4.78 → 예비 1.3배 $6.21 |
| **풀 모의고사 2회(겹침 0)** | **$9.56 → 예비 1.3배 $12.43** (낙관 $10.83, 비관 $14.12) |
| 파일럿 통과분 재사용 시 2회 | $7.44 + 파일럿 $2.28 = $9.72 → 예비 포함 약 $12.0 |

- 예산: 누적 약 $85·중단선 $90 → 여유 $5. **파일럿($2.28)은 안, 풀 1회($6.21 예비 포함)는 초과, 2회는 총 상한 상향 결정 필요.** 유료 CS A 단계는 오너 결정 사항이며 이 문서는 준비와 추정만 한다.
