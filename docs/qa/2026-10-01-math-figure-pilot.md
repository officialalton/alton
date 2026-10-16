# 수학 자료(그림·표) 원형 — 0단계 인프라 + 파일럿(two_variable_data 15항목) 결과 (2026-10-01)

브랜치 `feat/math-figure-archetypes`(worktree `~/Developer/ALTON-worktrees/math-figure-archetypes`). 코드·테스트·문서만 바뀌었고 DB·원격·배포·푸시·유료 API는 쓰지 않았다. 기준 문서: [`2026-10-01-math-figure-catalog-and-estimate.md`](2026-10-01-math-figure-catalog-and-estimate.md)(이하 카탈로그).

## 1. 한눈에

| 항목 | 결과 |
|---|---|
| 새 항목 구현 | two_variable_data 15항목(지문형 P 11 · 선택지형 C 4) = hard 60 + easy/medium 틀 30. SPR 가능한 hard 40개는 같은 원형의 SPR 변형으로도 나온다(원형 정의는 늘지 않고 형식만 다름). |
| 인프라 | Instance 에 `figure`·`format`·`answers`·`choice`·`answerKind` 추가, 자료 의존·FIGURE 일치·렌더 검사를 `verifyInstance` 에 연동, 선택지형 일반 검증기, SPR 정확 표기 생성기·검증, `bulk.ts` 형식 쿼터(25%)·커버리지 가드, 매니페스트 303행, 게이트 G1~G10, **시각 검수 절차(조합당 샘플 PNG·자동 구조 검사·검수 에이전트 판정·코드 해시 유효성)** |
| 게이트 | 파일럿 15항목 전부 pass(시각 검수 포함), 나머지 288항목 미구현 → 전체 게이트 `ok=false`(자료 원형 대량 생성은 가드가 거부) |
| 회귀 | 기존 hard 328 + easy/medium 77 원형과 `lib/problem-figures/**` 테스트 전부 통과(아래 5절) |

## 2. 설계 결정

### 2-1. 자료는 Instance 한 곳에서(5-1)
- `Instance.figure?: unknown`(figure 객체 또는 없음). `bulk.ts`·`levels-d.ts` 의 `figure: null, needsFigure: false` 고정을 풀어 `figure: inst.figure ?? null, needsFigure: !!inst.figure` 로 낸다. figure 가 없는 기존 원형은 바이트 단위로 같은 레코드(하위 호환).
- 생성기 규칙: 수치를 먼저 뽑고 → figure 를 만들고 → 지문은 값을 되풀이하지 않고 "the table/graph shown" 으로 가리킨다. 정보는 자료에만 있다. 지문에 남는 수는 가정·요구 조건(목표값 T, 추가 인원 비율 p% 등)뿐이다.
- 빌더·장면은 `figure-kit.ts`(표 `twFig`, 산점도 `makeScatter`, 선그래프 `makeLineGraph`, 선택지 `placeChoices`, 통계 `pearson`·`ols`), 장면 풀은 `figure-topics.ts`(이원표 45, 산점도·선그래프 66, 단위 환산 가능 44). 장면 수가 독립 변형 수(본문 유사도 0.6 미만)를 좌우한다 — 옛 8장면으로는 표 원형이 20에서 막혀 45장면으로 늘렸다.
- 산점도 추세선은 격자점 두 곳(x=0, x=X)을 지나고 점은 추세선에서 분명히 떨어진다(위·아래 판독 가능). 선그래프는 모든 값이 y 격자 위에 놓인다. 읽어야 하는 값만 격자에 맞추고 나머지는 정보로 쓰지 않는다.

### 2-2. 정답 재계산이 자료에서도(5-2)
- `verification_js` 는 `const P = {지문에 인쇄된 값};` 다음 줄에 `const FIGURE = {...};`(선택지형은 `const CHOICES = [...];`)를 받아 **그 값만 읽어** 정답을 다시 계산한다. 생성기 내부 변수에는 접근할 수 없다.
- `figure-verify.ts` 의 검사(모두 `verifyInstance` 안): ① FIGURE/CHOICES 상수 = `Instance.figure`(검증이 인쇄된 자료를 푼다는 보증) ② **자료 의존**: FIGURE 를 `null`/`[]` 로 가리고 돌렸을 때 답이 나오면 실패 ③ 자료가 있는데 지문·질문이 자료를 가리키지 않으면 실패 ④ `checkFigure(figure, text, options, correctIndex)` 렌더·참조 검사 ⑤ 기존 `checkContent`(figure 전달) · `checkParamsPrinted`(P 값은 지문에 인쇄돼야 함).
- 돌연변이(G6): `tamperFigure` 6종 — add(+3)·scale(×2)·neg·**flipy**(점 y 부호 반전)·**scramble**(y 고정 순열)·**drop**(첫 점 삭제). 처음 3종만으로는 평행이동·배율에 불변인 상관계수 문항(연관 방향·강도 8원형)과 "점의 개수" 문항에서 변조가 살아남았다(검출 0/12, 10/12) — 게이트가 잡아내서 3종을 더했다. 한 모드라도 검출하면 변조가 잡힌 것이고 항목당 97% 이상이어야 한다. 정답 키(자리·SPR 목록) 변조는 100% 검출해야 한다.

### 2-3. 선택지가 그림인 문항의 일반 검증기(5-4)
- `answerKind: "index"` + `figure: {type:"figure_choice", choices}` + `choice: {rules, diagnoseJs, params}`. `verification_js` 의 predicate 가 CHOICES 만 읽어 **정답 하나만 참**임을 확인(`hits.length !== 1` 이면 던짐), `diagnoseJs(c, ok, P)` 가 오답 3개를 **선언한 서로 다른 오답 규칙 id**로 진단하는지 다시 돌려 대조, 같은 그림 없음·규칙 중복 없음·`options = A~D` 를 검사(`checkChoiceInstance`).
- 이번에 4개 skill 항목에서 동작: 이원표 4개 중 고르기(규칙 TB1 행 교환·TB4 열 교환·TB3 이동·TB2 한 칸), 추세선 산점도(L1 기울기 부호·L2 절편·L6 끝점 교환·L8 기울기 배율), 추세선 위 점 수(CT1 보완·CT2 +1·CT3 −1·CT4 한쪽 쏠림), 연관 방향·강도(D3 방향 반대·D5 강도·D7 연관 없음). 부록 C 의 규칙 id 체계를 그대로 따랐고 점 수·표에 필요한 TB·CT 규칙을 추가했다. 각 항목 4개 연산자(stem 유형)가 서로 다른 조건 서술(정답을 정하는 조건)을 쓴다.
- 대칭 표에서 두 규칙이 같은 표를 만들 수 있어(예: 행 교환 = 열 교환) 오답은 "만든 규칙"이 아니라 **진단되는 규칙**으로 라벨한다 — 처음에 이 부분이 어긋나 게이트가 잡았다.
- 서술 선지(연관 방향·강도 지문형 P): `P.options` 의 문장을 JS 가 파싱해 FIGURE 에서 계산한 부류와 대조, 참인 선지가 정확히 하나인지 확인.
- B형(지문+선택지 둘 다 자료, 7항목)은 이번 범위 밖(스키마 `figure_choice.stem` 미구현) — manifest 에 "미지원(B형 스키마)" 로 남아 게이트에서 `blocked_renderer`.

### 2-4. SPR(주관식 단답) 설계
- 같은 원형·같은 지문·같은 자료에서 선택지만 떼고 `answers[]` 로 낸다(`toSprInstance`). `Instance.format:"spr"`, `options:[]`, 레코드는 `format:"spr"`, `options/correctIndex:null`, `answers`. 정답 값은 선지 표기가 아니라 **`verification_js` 재계산값**에서 만든다(표기와 값이 다르면 변환 거부).
- **정답 목록 규칙(정확한 표기만)**: 기약분수 + 끝나는 소수(그리드에 들어갈 때) + 끝나지 않는 소수는 그리드 최대 자릿수에서 절사·반올림(예: 7/2 → `7/2`, `3.5` / 1/3 → `1/3`, `0.333` / 2/3 → `2/3`, `0.666`, `0.667`). 양수 5자·음수 6자(checkContent 정책) 위반, 분모 1000 초과, π·문자·식 정답은 SPR 불가. `checkSprAnswers` 는 재계산값에서 규칙대로 만든 목록과 **정확히 같아야** 통과 — 누락·손실 표기·중복·그리드 위반을 모두 잡는다. 같은 값의 다른 분수 표기(14/4)는 DB 함수 `spr_answer_matches` 가 숫자로 정규화해 받으므로 목록에 넣지 않는다.
- **기존 SPR 정답 생성기 결함(별건, 미수정)**: `math-compilers/spr-answer.ts` 의 `sprFromAnswerText` 가 소수 0~2자리로 반올림·절사한 값을 정답에 넣는다(실측: `7/2 → ["7/2","3.5","3.500","3.50","4","3"]`, `1/3 → ["1/3","0.333","0.33","0.3","0"]`, `-3/8 → [… "-0.4","-0.3","-0"]`). DB `spr_answer_matches` 는 숫자 동치라 학생이 `4` 를 쓰면 정답 7/2 가 맞음으로 채점된다. 이 파일은 컴파일러 19종 공용이라 건드리지 않았다. 대신 (a) 새 원형 SPR 은 `spr.ts` 를 쓰고 (b) 컴파일러 경로 쿼터(`produceFromCompilers`)는 `sprFromAnswerText` 결과를 `sprAnswerSet(plainNumberOf(answers[0]))` 로 **정확한 표기만 남기게 덮어쓴다**. 원본 수정은 총괄 결정 사항(영향: 이미 공개된 SPR 문항 중 손실 표기가 든 것의 재검수).
- `Archetype.spr:{capable, reason}` 선언: 새 자료 원형은 전부 필수(테스트가 강제), 옛 원형은 선언이 없으면 `sprCapability()` 가 시드 30개 프로브(절반 이상 변환되면 가능)로 판정하고 결과에 '프로브 판정'을 적는다. 선택지가 그림인 항목·서술 선지 항목은 `capable:false` + 사유.
- **유사문항 그룹**: `subpattern = <groupId ?? id>/<변형>` — 같은 원형·변형의 mc/spr 문항은 같은 그룹 키를 공유해 한 세트에 하나만 뽑힌다. spr 변형은 별도 난수 흐름(`<id>:spr:<seed>`)과 gid 를 쓴다.

### 2-5. 대량 생성기 형식 쿼터 (`bulk.ts`)
- `BulkRequest.sprQuota`(기본 **0.25**, 0 이면 끔). 버킷 = `skill × 난이도`. 버킷에서 i 번째로 채택되는 문항이 SPR 인지는 **`sprSlot(i)`**(누적 SPR 수 = ⌊i·0.25 + 0.5⌋, half-up)로 결정론적으로 정해진다: 4건 → 1, 10건 → 3, 100건 → 25, 1000건 → 250이고, 어느 시점에서도 `|SPR − 0.25·n| ≤ 1`.
- 라운드 로빈으로 고른 원형이 SPR 불가이면 **같은 버킷의 SPR 가능 원형이 대신 그 자리를 채운다**. 버킷에 SPR 가능 원형이 없으면 mc 로 채우되 `stats.format.shortfalls` 에 (버킷, 슬롯, 사유)를 남기고(조용히 대체하지 않음), `strictSpr:true` 면 던진다. 컴파일러 경로(`produceFromCompilers`)도 같은 규칙(SPR 1차 범위 밖 skill 은 부족분으로 보고).
- 쿼터는 R&W 와 무관(수학 전용). 기존 `bulk.test.ts` 는 mc 형태 검증이라 `sprQuota: 0` 을 명시하도록 바꿨다(쿼터 검증은 새 `bulk-spr-quota.test.ts`). **동작 변경**: 기본값이 25% 라서 `produceFromArchetypes` 를 쓰는 기존 스크립트(`archetype-*-samples.ts` 등)는 이제 SPR 문항이 섞여 나온다(의도된 변경, 필요하면 `sprQuota: 0`).

### 2-6. 커버리지 매니페스트와 게이트
- `figure-coverage-manifest.ts`: 카탈로그 부록 A·B 표를 **기계 변환**한 303행(207 + 96; 위치 P 241 / C 55 / B 7; E3 근거 109·빈도 하 110 모두 포함 — 제외 없음) + 자료 없음 패턴 1(`equivalent_expressions.rational_equivalence`). 항목 id = `<skill>.<kind>.<자료코드>.<P|C|B>`(같은 조합 중복 1건은 `#2`). 낮은 빈도는 `freq` 로만 구분(제작 순서용). 이후 항목 추가·삭제는 이 파일 변경뿐. **면제(waiver) 없음** — hard 4개를 못 채우는 항목은 면제하지 않고 `fail` 로 보고한다(오너 결정).
- **형식(MC/SPR) 축**: `sprPlanned(row)`(위치 P = 계획, C/B = 불가, 정성 판단형 불가)가 계획 기본값이고, 구현된 항목은 원형 선언이 우선한다. 보고서에 SPR 가능 항목 수·불가 수와 `sprInventory`(전체 원형 중 SPR 가능 비율·불가 목록, 선언/프로브 구분)가 들어간다.
- `figure-coverage-gate.ts` 의 G1~G10(시각 검수 절차를 넣으면서 번호를 다시 정했다: 오너 요구로 시각 검수가 필수 절차가 됐다):
  - **G1** manifest 완전성(옛 패턴 전부 manifest 에 있음, manifest 밖 자료 원형 없음, 중복 id 없음) · **G2** 수량(hard 4개·서로 다른 연산자 4개, easy 1+·medium 1+) · **G3** 렌더러 준비('미지원'이면 blocked) · **G4** 시드 스윕(생성 실패 0·예외 0·검증 실패 0·자료 없는 인스턴스 0; `checkFigure`·`checkContent` 포함) · **G5** 정답 재계산+자료 의존(`verifyInstance` 안) · **G6** 돌연변이 · **G7** 분포·중복(정답 자리 12~40%, 시드 200 내 지문+자료 완전 중복 ≤ 2%, 독립 변형 ≥ 30, 항목 hard 변형 ≥ 3) ·
  - **G8 렌더 구조 검사(자동)** — `figure-qa.ts` 가 렌더된 SVG/HTML 을 직접 읽어 점·추세선·표 값이 눈금 기준으로 데이터와 같게 그려졌는지, 눈금 숫자가 격자선과 맞는지, 라벨 겹침·잘림, 축 눈금 3개 이상·축 제목·단위, 복수 그림(figure_set·선택지 4개)의 같은 눈금·크기·축 제목, 선택지 구별, 자료 존재를 확인한다(전 원형 × 시드 0~199). 오너가 든 결함 4종은 돌연변이 테스트로 고정(3절의 시각 검수).
  - **G9 시각 검수 판정** — 조합마다 대표 샘플 PNG 를 검수자가 보고 남긴 판정(`figure-qa/<조합ID>.review.json`)이 **현재 생성기·렌더 코드 해시**와 같고 pass 여야 한다. 코드가 바뀌면 판정이 무효(stale)가 된다. 매니페스트의 검수 상태 열 = 보고서의 `qaByItem`.
  - **G10 SPR 공급** — 자료 원형이 있는 skill 의 hard 버킷에서 SPR 가능 유사문항 그룹 ≥ 60(= 30세트 × 세트당 hard SPR 2), SPR 가능 그룹 비율 ≥ 25%.
- 보고서 `coverage-gate-report.json`(게이트 테스트가 `WRITE_GATE_REPORT=1` 일 때 기록). **가드**: `produceFromArchetypes` 는 자료(figureItem) 원형이 섞여 있으면 시작 전에 보고서를 읽어 `ok=false` 면 `CoverageGateError` 로 거부한다. 부분 생성은 오너 승인 항목을 `allowItems` 로 지정하고 그 항목이 보고서에서 pass 일 때만 열린다(카탈로그의 `--allow-stage` 대신 항목 단위).

### 2-7. 앱 렌더 경로 수정(공용 파일, 최소·하위 호환)
구현 중 Browser 창으로 직접 본 것과 시각 검수 3라운드에서 나온 렌더러 결함을 고쳤다(모두 새 테스트 포함, `lib/problem-figures` 154→155 테스트 통과, `app/session` 통과).
1. `figure_choice` 가 표(이원표·표·숫자 목록)를 선택지로 받으면 2×2 의 좁은 칸에서 칸 값이 가로 스크롤 뒤로 숨어 **표 선택지가 읽히지 않았다**(데스크톱·375px 모두). 표 선택지는 한 줄에 하나씩 쌓고 375px 에서도 모든 열이 보이도록 글자·여백을 줄이고 줄바꿈을 허용한다(`renderFigureChoice`).
2. 그래프 선택지 격자가 칸 최소 폭 200px 라서 720px 화면에서 3열+1개로 나오고 눈금 글자가 약 7px 로 줄었다(검수자 지적) → 칸 최소 폭 280px(640px 안에서 2×2, 모바일 1열).
3. 이원표(`two_way`)가 375px 에서 3~4열 중 일부가 가로 스크롤 뒤로 잘렸다 → 머리글(열·행 이름)이 줄바꿈되도록 하고 칸 여백을 줄였다. 합계(Total) 행 밑줄이 첫 열 아래에서 끊겼다(검수자 지적) → 보강(`renderTwoWay`; `table` 종류는 건드리지 않음).
4. 데스크톱 산점도(`data` scatter)의 y 축이 왼쪽 끝 세로 격자선(회색)에 덧그려져 흐려졌다(검수자 지적) → 왼쪽 끝 격자선 생략(`renderScatter`).

## 3. 시각 검수(오너 필수 절차) — 도구·판정·발견한 결함

오너 경험(자료가 붙는 문제는 유형별로 같은 결함이 결정론적으로 모든 문항에 반복)에 따라 **조합당 샘플 1개를 앱 렌더 경로로 PNG 로 찍어 눈으로 검수**하는 절차를 필수로 넣었다. 체크리스트·판정 파일 형식·유효성 규칙은 [`2026-10-01-math-figure-visual-qa.md`](2026-10-01-math-figure-visual-qa.md). 요약:

- **도구**: `figure-qa-snapshot.test.ts`(조합마다 고정 시드 11 샘플을 `ProblemFigure` 로 렌더한 HTML+메타) → `scripts/mock-exam-generation/figure-qa-render.mjs`(Playwright Chromium: `<조합ID>.png` 720px · `<조합ID>.m375.png` 375px). 선택지형은 4개 선택지가 한 화면에 모두 나오고, figure 종류가 다른 hard 원형(예: 단일 산점도와 Plot A/B `figure_set`)은 샘플을 하나씩 더 만든다. 산출물 `data/mock-exam-generation/figure-qa/`(PNG 32·메타 15·판정 15).
- **자동 구조 검사(G8, `figure-qa.ts`)**: 렌더된 SVG/HTML 을 직접 읽는다 — 눈금 숫자로 만든 축척으로 읽은 점·추세선·선그래프 값·표 칸이 데이터와 같은가, 눈금이 일정 간격이고 격자선과 맞는가, 라벨 겹침·잘림, 축 눈금 3개 이상·축 제목·단위, 복수 그림(Plot A/B·선택지 4개)의 같은 눈금·크기·축 제목, 선택지 구별, 자료 존재. **오너가 든 4가지 결함은 각각 돌연변이 테스트로 고정**했다: (a) 비율 불일치(점 높이를 25% 늘림·추세선 기울기 변경·선그래프 점 하나 이동·표 칸 숫자 변경) (b) 숫자 위치 불일치(눈금 숫자 18px 이동·두 눈금 숫자 맞바꿈·글자 겹침·단위 없는 축 제목) (c) 복수 자료 불일치(Plot B 눈금 두 배·선택지 하나의 축 범위·축 제목 하나만 다름) (d) 자료 없음(figure null·점이 하나도 없는 SVG·빈 표).
- **검수 에이전트 판정(G9)**: 검수자는 PNG(데스크톱·375px)를 직접 열어 9개 체크리스트로 판정하고, **문제를 그림만 보고 직접 풀어 메타의 정답과 대조**한다. 판정은 `<조합ID>.meta.json` 의 `codeHash`(그 조합의 원형 정의 파일+공용 빌더·장면 풀+쓰는 렌더러+`ProblemFigure`+스냅샷 도구의 SHA-256)와 같을 때만 유효하다. 코드가 바뀌면 `stale` → 재검수. 매니페스트 303행 전체의 **검수 상태 열**은 보고서의 `qaByItem`(미구현은 `unimplemented`).
- **검수 3라운드와 발견한 결함** (판정 파일은 마지막 라운드가 덮어쓴다; 라운드별 원본 판정은 이 문서의 결함 표로 보존):

| 라운드 | 결과 | 검수자가 잡은 결함 → 조치 |
|---|---|---|
| 1 | 6 pass · 9 defect | ① 한 자리 수 선택지가 `Choice 9` 로 표시됨 — **스냅샷 페이지 도구의 결함**(그림 선택지가 아닌데 라벨 규칙 적용) → 도구 수정 ② `scatter_count_above` 해설 (5)가 전체·x 조건 부분집합의 위·아래 개수를 섞어 말함 → **생성기 해설 문구 수정** ③ 선택지 그림 4개가 3열+1개로 나오고 눈금 글자가 약 7px — **공용 렌더러 레이아웃 결함** → 칸 최소 폭 280px(2×2, 모바일 1열) ④ 선택지 점 하나가 추세선에 너무 가까워 위·아래가 모호 → 점이 선에서 분명히 떨어지게 잔차 확대 ⑤ 데스크톱 산점도 y 축이 회색으로 덧그려짐 → 렌더러 수정 |
| 2 | 11 pass · 4 defect | 이원표 4조합: 합계(Total) 행 밑줄이 둘째 열부터 시작(`sat_visual_style`, **공용 렌더러**) → 수정(코드 해시가 바뀌어 영향받는 12조합 재검수; 평면·선택지 3조합은 해시가 같아 판정 유지) |
| 3 | 15 pass | 결함 없음(현재 코드 해시 기준 유효) |

- **구현 중 직접 눈으로 본 것(검수 도구 전)**: 표 선택지(이원표 4개)가 2×2 좁은 칸에서 **칸 값이 스크롤 뒤로 숨어 읽히지 않음**(데스크톱·375px) → 표 선택지는 한 줄에 하나씩 쌓고 글자·여백 축소; 이원표 375px 에서 열 잘림 → 머리글 줄바꿈·여백 축소. 둘 다 `lib/problem-figures` 테스트 추가.
- **검수자가 '결함 아님'으로 남긴 관찰**(오너 판단용): 선택지 그림의 축 위 눈금 숫자(100/50)가 화살촉에 붙음(기존 `plane` 렌더러 스타일), 데스크톱에서 선택지 그림 눈금 글자가 작음(읽을 수는 있음), 산점도 그림 안 제목 `1 week = 7 days` 가 지문과 중복(단위 검사를 만족시키려고 둔 것), 단일 산점도(`data`)와 선택지 산점도(`plane`)의 축 스타일이 약간 다름, 모바일에서 표 숫자 칸의 세로 정렬이 줄바꿈된 행 라벨보다 약간 위.

## 4. 파일럿 15항목

| 항목 id | 자료 | 위치 | hard 4 연산자 | easy / medium | SPR |
|---|---|---|---|---|---|
| cell.TW.P | 이원표 | 지문 | inverse · chain2 · unit_ratio · compare_scenarios | read_cell / sum_cells | 가능 |
| row_total.TW.P | 이원표 | 지문 | inverse · unit_ratio · constraint_select · compare_scenarios | row_total / row_gap | 가능 |
| conditional_share.TW.P | 이원표 | 지문 | chain2 · compare_scenarios · inverse · compose_kind | row_percent / overall_percent | 가능 |
| conditional_share.TW.C | 이원표 4개 | 선택지 | inverse · chain2 · repr_shift · compare_scenarios | table_row_share / table_two_totals | 불가(선택지) |
| scatter_equation.SC.P | 산점도 | 지문 | inverse · chain2 · compare_scenarios · constraint_select | slope / intercept | 가능 |
| scatter_equation.LG.P | 선그래프 | 지문 | (같은 4) | slope / intercept | 가능 |
| scatter_equation.SC.C | 산점도 4개 | 선택지 | repr_shift · chain2 · inverse · compare_scenarios | sign_intercept / slope_and_point | 불가(선택지) |
| scatter_predict.SC.P | 산점도 | 지문 | chain2 · compare_scenarios · unit_ratio · constraint_select | read_end / predict | 가능 |
| scatter_predict.LG.P | 선그래프 | 지문 | (같은 4) | read_end / predict | 가능 |
| scatter_slope_context.SC.P | 산점도 | 지문 | unit_ratio · repr_shift · compare_scenarios · inverse | range_change / unit_slope | 가능 |
| scatter_slope_context.LG.P | 선그래프 | 지문 | (같은 4) | range_change / unit_slope | 가능 |
| scatter_count_above.SC.P | 산점도 | 지문 | constraint_select · repr_shift · compare_scenarios · chain2 | count_points / count_above | 가능 |
| scatter_count_above.SC.C | 산점도 4개 | 선택지 | constraint_select · compare_scenarios · inverse · unit_ratio | majority_above / at_least | 불가(선택지) |
| association_direction_strength.SC.P | 산점도 | 지문(서술 선지) | repr_shift · compare_scenarios(Plot A/B `figure_set`) · chain2 · param_condition | direction / strength | 불가(서술 선지) |
| association_direction_strength.SC.C | 산점도 4개 | 선택지 | repr_shift · compare_scenarios · chain2 · param_condition | none / negative | 불가(선택지) |

(`kind` 는 `<세부유형>.<자료코드>.<위치>` 로 구분 — 기존 `<skill>.<kind>` 당 hard 4개 테스트가 그대로 적용된다. 카탈로그의 스택 막대 3항목은 새 렌더러가 필요해 파일럿에서 뺐다.)

SPR 선언: 15항목 중 hard SPR 변형이 있는 것은 10항목(40원형) — 선택지가 그림인 4항목과 서술 선지 1항목은 `capable:false`+사유(선택지 비교·서술 판단 자체가 문제의 핵심).

## 5. 파일럿 인수 기준 7개 (카탈로그 5-6) 판정

| # | 기준 | 판정 | 근거 |
|---|---|---|---|
| 1 | `Instance.figure`+`figure-kit`+`FIGURE`/`CHOICES` 주입 검증+선택지 일반 검증기가 들어가고 기존 328+77 원형 회귀 통과 | **통과** | 2-1~2-3절. 기존 원형·`lib/problem-figures` 테스트 전부 통과(6절). figure 없는 원형은 레코드가 바이트 단위로 같다. |
| 2 | 15항목×hard 4 = 60원형: 생성 실패 0·정답 불일치 0·`checkFigure.ok` 100%·자료 의존 100%·돌연변이 통과 (카탈로그는 시드 200, 여기서는 **5,000시드**) | **통과** | 6절 — mc 90 + spr 40 스윕 650,000건, 생성 실패 0·예외 0·검증 실패 0, 자료 변조·정답 키 변조 100% 검출. SPR 변형은 `answers` 정확 표기 검사까지 같은 스윕. |
| 3 | 선택지형 4항목: predicate 가 정답 1개만 참·오답 3개가 선언한 규칙·정답 자리 분포 편향 한계 이내 | **통과** | `verification_js` predicate 정확히 1개(아니면 던짐)·`diagnoseJs` 진단=선언·규칙 중복 없음, 정답 자리 분포 23~27%(허용 12~40%). 오답이 규칙 둘을 어기면 잡히는 돌연변이 테스트 포함. |
| 4 | 커버리지 게이트 two_variable_data 부분이 통과(manifest·수량·렌더러·스윕·시각 검수 기록) | **통과** | 15항목 `pass`(G1~G10, 시각 검수 G9 포함), 나머지 288항목은 미구현이라 전체 `ok=false`. 가드가 대량 생성을 거부함을 테스트. |
| 5 | 항목당 대표 1건 Preview 스크린샷을 데스크톱·375px 로 눈 확인 | **통과(검수 에이전트) — 오너 최종 승인은 대기** | Preview 배포가 아니라 앱 렌더 경로(`ProblemFigure`)를 Playwright 로 PNG 로 찍어 검수 에이전트가 3라운드로 판정(3절). 첫 검수에서 실제 결함 발견·수정. 오너가 PNG(`data/mock-exam-generation/figure-qa/`)를 직접 보고 승인하는 단계는 남아 있다. |
| 6 | 공개 게이트 통과 문항 20개를 비프로덕션 DB 에 적재해 학생 화면까지 확인(UAT 실행 ID) | **미수행(이번 임무 금지 범위: 원격 DB·배포)** | 대신 `bulk-spr-quota.test.ts` 가 파일럿 15항목에서 import 호환 레코드 20건을 실제 게이트 보고서·`allowItems` 로 산출하고 `checkContent`·`checkFigure`·`ProblemFigure` 렌더(`figure-render-pilot.test.ts`)를 통과시킨다. 적재는 총괄이 `scripts/mock-exam-generation/import.ts`(figure·answers·format 이미 지원)로 할 수 있다. |
| 7 | 소요 예상 8~10일, 결과로 전체 추산 갱신 | **갱신 완료(7절)** | 한 세션에서 인프라+파일럿 15항목+SPR 쿼터+시각 검수 도구까지 끝냈다. 항목당 실작업량을 보정해 전체 추산을 줄였다(약 260일 → 약 190일, ±40%). |

## 6. 검증 결과

- **자동 테스트(이번 변경 영역)**: `npx vitest run lib/problem-generation lib/problem-figures lib/mock-exam app/session ... --project unit` — 최종 결과: **93개 파일 통과·1개 건너뜀(스냅샷 도구, 환경변수로만 실행) / 2,703 테스트 통과·13 건너뜀**(범위: `lib/problem-generation`·`lib/problem-figures`·`lib/mock-exam`·`lib/problem-content-check`·`lib/problem-quality-contract`·`app/session`; eslint 오류 0). 기존 hard 328 + easy/medium 77 원형 스윕·`lib/problem-figures/**` 154+1 테스트는 그대로 통과(새 hard 60·easy/medium 30 원형도 같은 `archetypes.test.ts`·`levels-d.test.ts` 400시드 스윕에 자동 포함).
- **게이트 5,000시드 전수**(`WRITE_GATE_REPORT=1 GATE_SEEDS=5000`, 생성 시각 2026-10-01T07:35:28.038Z): 원형 스윕 130건(mc 90 + spr 40) × 5,000시드 = **650,000건 생성**, 생성 실패 0·예외 0·검증 실패(정답 재계산·checkFigure·checkContent·자료 의존·FIGURE 일치·SPR 정답 목록) 0. 독립 변형(본문+자료 글자 유사도 0.6 미만, 400시드 안) hard 원형 최소 33. 정답 자리 분포(mc, 100건 이상) 23.1%~26.5%(허용 12~40%). 시드 0~199 지문+자료 완전 중복 최대 0건. 5,000시드 전체 범위 완전 중복률 상위(조합 공간의 크기 정보): tvd.scatter_slope_context.LG.P.unit_ratio(spr) 138/5000, tvd.scatter_equation.LG.P.constraint_select(spr) 45/5000, tvd.scatter_predict.LG.P.unit_ratio(spr) 42/5000.
- **돌연변이(G6)**: 자료 변조(7종) 검출 1560/1560, 정답 키(자리·SPR 목록) 변조 검출 1560/1560 — 처음에는 평행이동·배율에 불변인 상관계수 문항과 점 개수 문항, 비교형(Plot A/B) 문항에서 변조가 살아남아(검출 0/12·10/12·6/12) 변조 모드를 flipy·scramble·drop·swap 으로 늘렸다.
- **구조 검사 자동(G8)**: `figure-qa.test.ts` 21건 — 전 원형 × 시드 12개(900건 이상) 구조 검사 0건 + 오너 결함 4종 돌연변이(비율 불일치 4·숫자 위치 4·복수 자료 4·자료 없음 3) + 선택지 구별·정확히 하나의 규칙. 이 검사가 처음 돌 때 **실제 결함 하나**를 잡았다: 추세선 위 점 수 선택지에서 두 선택지가 같은 선·비슷한 점이라 구별이 안 됨(검사 기준을 '선택지를 가르는 특징'으로 정교화).
- **시각 검수(G9)**: 15조합 전부 pass(15/15, 현재 코드 해시 기준). 검수는 3라운드로 돌았고(3절) 검수자가 PNG 를 직접 보고 **실제 결함 5건을 잡았다**. 구조 검사·돌연변이: `figure-qa.test.ts` 21건, 검수 판정 유효성 `figure-qa-review.test.ts` 9건, 앱 렌더 경로 `figure-render-pilot.test.ts` 30건.
- **SPR**: `figure-infra.test.ts` 28건(정확 표기·손실 표기 거부·변조·선언·쿼터 배정), `bulk-spr-quota.test.ts` 17건(4·10·100·1,000건 배치 쿼터, 누적 수렴, 불가 원형 보고, 컴파일러 경로, 30세트 시뮬레이션, 가드, 승인 부분집합).
- **SPR 인벤토리**: 전체 원형 388개 중 SPR 가능 342개(88%), 선언 60개·프로브 판정 328개, 불가 46개(목록·사유는 `coverage-gate-report.json` 의 `sprInventory.incapable`; 자료 원형 중 불가는 선택지형 4·서술 선지 1항목의 hard 20개).
- **tsc**: 이번 변경 파일 오류 0건(저장소에는 이번 작업과 무관한 `app/layout.tsx` 의 `LayoutProps` 오류 1건이 이미 있다).
- **게이트 보고서 요약**: 전체 항목 303 중 pass 15, fail 0, 미구현 232, 렌더러 미지원 blocked 56 → 전체 `ok=false`. G1 통과 · G8 통과 · G9 미통과(파일럿 15개만 pass, 나머지 288개 미구현이라 전체는 닫힘) · G10 통과(자료 원형 skill two_variable_data: SPR 가능 유사문항 그룹 71개(필요 60: 30세트 × 세트당 2)).

## 7. 수량·작업량 재추정 (파일럿 실측 반영)

### 6-1. 파일럿 실측 → 항목당 작업량 보정
- 파일럿 15항목의 난이도 구성: 재사용 7 · 조정 3 · 신규 핵 5(선택지형 4 + 연관 서술 1). 새 코드: 항목 정의 약 1,900줄(hard 60 + easy/medium 30), 공용 빌더·검증·게이트·QA 약 2,000줄, 테스트 약 1,100줄. 한 항목(hard 4+easy/medium 2 포함) 평균 약 130줄 — 장면 빌더(이원표·산점도·선그래프)를 공유하면 같은 자료 종류의 다음 항목은 연산자 구현이 대부분이라 빠르다.
- 보정 기준(사람·일, AI 보조 전제, 검증·수정·시각 검수 사이클 포함): 카탈로그는 재사용 0.25 / 조정 0.5 / 신규 핵 1.0, **파일럿 실측은 재사용 0.2 / 조정 0.3 / 신규 핵 0.5**(기존 렌더러를 쓰는 신규 핵 기준 — 새 렌더러가 필요한 항목은 렌더러 몫을 따로 센다). 이유: 장면·검증기·게이트가 공용이라 항목별 비용은 연산자 4개와 자료 장면 한 종류로 줄었고, 선택지형은 오답 규칙 진단 한 벌을 skill 안에서 재사용한다.

### 6-2. 남은 288항목 재추정 (파일럿 15항목 제외)
| 단계 | 항목 | hard(×4) | easy/medium(×2) | 형식 변형 |
|---|---|---|---|---|
| 1 표 계열 | 52 | 208 | 104 | SPR 가능 약 40 |
| 2 그래프 계열 | 170 | 680 | 340 | SPR 가능 약 135 |
| 3 도형 계열 | 66 | 264 | 132 | SPR 가능 약 55 |
| 합계 | **288** | **1,152** | **576** | SPR 가능 계획 230(위치 P 항목), 불가 58(C 51·B 7) |

- 파일럿 포함 전체: 303항목 → hard **1,212** · easy/medium 606(카탈로그 상한과 같음 — 이번에 hard 4를 못 채워 줄어든 항목은 0건이다. 면제는 두지 않았다).
- **SPR 형식 변형은 원형 정의가 늘지 않는다**(같은 원형·같은 자료에서 선택지만 뗌). 수량 증가분은 '형식 변형' 약 960개(파일럿 40 + 남은 P 항목 230 × 4 중 SPR 가능분)이고, 비용은 항목당 SPR 가능 선언·그리드 표기 검증·스윕 추가분(항목당 약 0.05일)이다. 선택지·서술 선지 항목은 `capable:false` + 사유를 선언해야 한다(조용히 mc 로 대체 금지).
- 작업량(사람·일): 원형 = 26×0.2 + 107×0.3 + 155×0.5 = **약 115일**, 렌더러 12종 약 29일(카탈로그 값 유지), 선택지형 일반 검증기·B형 스키마 약 5일, 형식 변형(SPR)·선언 점검 약 14일, **시각 검수 사이클**(조합당 PNG·검수·결함 수정 — 파일럿 15조합에서 공용 결함 5건이 나왔고 대부분 공용 렌더러·도구라 조합 수에 비례하지 않는다고 보고 조합당 0.06일 + 새 렌더러마다 구조 검사 0.5일) 약 25일 → **합계 약 190일(오차 ±40%, 약 115~265일)**. 카탈로그 추산 약 260일(인프라 8·게이트 3 포함)에서 인프라·게이트·파일럿(이미 끝남 약 8~10일)을 빼고 보정하면 약 190일. 병렬 세션이면 같은 파일(`registry`·`figure-kit`) 충돌을 피하도록 skill 단위로 나눈다.
- 달력 기준 권장 순서(카탈로그와 같음): 1단계 표 계열(52) → 2단계(앱 지원 렌더러 항목 먼저, 새 렌더러 항목은 렌더러와 함께) → 3단계. 빈도 상→중→하는 단계 안에서 적용(낮은 빈도 맨 뒤, 제외 없음). **모든 신규 조합은 같은 시각 검수 절차를 거쳐야 게이트가 열린다.**

## 8. 위험과 남은 일

1. **오너 최종 시각 승인 대기**: 15조합 PNG 는 검수 에이전트가 판정했지만 오너가 직접 PNG 를 보고 승인하는 단계는 남아 있다(특히 SAT 시각 스타일 일치). 오너가 보면 에이전트가 '결함 아님'으로 남긴 관찰(3절 마지막)을 결함으로 볼 수도 있다 — 그러면 렌더러를 고치고 재검수한다(코드 해시가 바뀌면 자동으로 재검수 대상).
2. **독립 변형 공간**: 장면 풀(이원표 45·산점도 66·단위 환산 44)이 독립 변형 수를 좌우한다. 5,000시드 전체 범위에서는 일부 원형(선그래프 단위 환산·기울기 등)의 완전 중복률이 2%를 넘는다(시드 200 안에서는 0). 수천 문항을 한 원형에서 뽑으면 장면·문구 풀을 늘려야 한다 — 게이트는 시드 200 기준이고 5,000시드 중복률은 보고서에 기록한다.
3. **기존 SPR 정답 목록 결함(원본 미수정)**: `sprFromAnswerText` 가 손실 표기(7/2 에 `4`·`3`)를 정답에 넣어 DB 채점에서 틀린 답이 맞음으로 처리된다. 이미 공개된 SPR 문항 중 소수 정답이 든 것의 재검수가 필요할 수 있다(총괄 결정 사항). 새 SPR 경로와 컴파일러 쿼터 경로는 정확한 표기로 덮어쓴다.
4. **hard 난이도 주장**: hard 원형의 '추가 요구 사고'는 연산자 구조 근거(`provisional_ai`)일 뿐 실제 난이도 보정이 아니다. 자료 읽기 단계가 늘어 hard 가 되는 항목과 눈금만 읽으면 되는 항목이 섞일 수 있어 실학생 데이터나 교사 검수가 필요하다.
5. **선택지형 오답 규칙의 현실성**: L8(기울기 배율)·CT4(한쪽 쏠림) 같은 규칙은 '학생이 실제로 하는 실수'인지 교사 검토가 필요하다(부록 C 규칙에 없는 새 규칙: TB1~TB4·CT1~CT4·L6·L8·D3/D5/D7 일부).
6. **범위 밖·미지원**: B형(지문+선택지 둘 다 자료) 7항목은 `figure_choice.stem` 스키마가 없어 `blocked_renderer`, 새 렌더러 12종(수직선·줄기-잎·원그래프 등)은 구현 전이라 해당 56항목이 blocked. 이 항목들은 렌더러와 함께 구조 검사(`figure-qa.ts`)·돌연변이 테스트를 추가해야 한다(렌더러마다 SVG 구조가 다르다).
7. **게이트 해시가 보수적**: 한 파일(`tvd-fig-lines.ts` 등)이 여러 조합을 정의해 그 파일을 고치면 같은 파일의 모든 조합이 재검수 대상이 된다. 공용 렌더러(`data.ts`)를 고치면 그 렌더러를 쓰는 모든 조합이 재검수된다(이번에 표 합계 행 수정으로 12조합이 재검수됐다). 의도된 안전 장치이고, 자주 고치는 공용 파일은 조합별로 쪼개는 것이 비용 절감 방안이다.
8. **공용 파일 변경**: `figure-choice.ts`(표 선택지 스택·2×2 격자 폭)·`data.ts`(이원표 머리글 줄바꿈·합계 행 밑줄·산점도 y 축)·`batch.ts`(`SPR_ELIGIBLE_SKILLS` export)·`bulk.ts`(기본 SPR 쿼터 25%)를 건드렸다. 기존 `lib/problem-figures` 테스트와 `app/session` 테스트는 통과했지만, 이미 공개된 문항의 표·선택지 그림 모양이 조금 달라 보일 수 있다(개선 방향). 기존 스크립트(`archetype-*-samples.ts`)는 기본값 변경으로 SPR 문항이 섞여 나온다.

## 9. 실행 방법

- 변경 영역 테스트: `npx vitest run lib/problem-generation/math-archetypes lib/problem-figures --project unit` (원형 전체 400시드 스윕 포함, 약 2.5분).
- 게이트 스모크: `GATE_SEEDS=40 npx vitest run lib/problem-generation/math-archetypes/figure-coverage.test.ts --project unit`.
- 보고서 + 5,000시드 스윕(약 20분): `WRITE_GATE_REPORT=1 GATE_SEEDS=5000 npx vitest run lib/problem-generation/math-archetypes/figure-coverage.test.ts --project unit --testTimeout=3600000` → `coverage-gate-report.json`(원형별 스윕 결과·변조 검출률·정답 자리 분포 포함).
- 시각 검수 스냅샷: `FIGURE_QA_SNAPSHOT=1 npx vitest run lib/problem-generation/math-archetypes/figure-qa-snapshot.test.ts --project unit` → `node scripts/mock-exam-generation/figure-qa-render.mjs [조합ID접두사]` → 검수자가 `data/mock-exam-generation/figure-qa/<조합ID>.png`·`.m375.png`·`.meta.json` 을 보고 `<조합ID>.review.json` 작성(절차·체크리스트: [`2026-10-01-math-figure-visual-qa.md`](2026-10-01-math-figure-visual-qa.md)). 코드(생성기·렌더러)를 바꾸면 스냅샷을 다시 만들고 재검수해야 게이트가 열린다.
- 오너 최종 승인: 15조합 PNG 를 직접 보는 단계가 남아 있다(검수 에이전트 판정은 `review.json` 의 `reviewer` 필드로 구분된다).
