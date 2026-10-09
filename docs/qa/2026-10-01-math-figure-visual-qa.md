# 수학 자료(그림·표·도형) 문항 — 시각 검수 필수 절차와 체크리스트 (2026-10-01)

**규칙**: 그림·표·도형이 붙는 **모든 조합(매니페스트 항목)** 은 대량 생성 전에 시각 검수를 통과해야 한다. 이후 단계의 신규 조합(새 렌더러·새 skill 포함)도 예외 없이 같은 절차를 따른다 — 게이트 G9 가 이를 강제한다(검수가 없거나 코드가 바뀌어 무효이면 `ok=false` → `produceFromArchetypes` 가 자료 원형 생성을 거부).

## 왜 필요한가
자료가 붙는 문제는 **유형별로 같은 결함이 결정론적으로 모든 문항에 반복**된다(오너 경험): ① 길이·값 대비 그림 비율 불일치 ② 길이·값 표시 숫자의 위치 불일치 ③ 복수 자료에서 두 그림 간 숫자·축척 불일치 ④ 자료가 아예 없음. 한 항목(조합)에서 샘플 1개만 눈으로 봐도 구조 결함은 잡힌다 — 대량 생성 후 문항 단위로 찾는 것이 아니다.

## 절차 (조합 하나당)
1. **샘플 렌더(도구)** — 고정 시드(11)의 대표 문항을 앱 렌더 경로(`ProblemFigure` → `renderFigureSvg`)로 그려 PNG 로 만든다. 선택지형은 4개 선택지 그림이 한 화면에 모두 나온다. figure 종류(type·kind·선택지/복수 자료의 자식 종류)가 다른 hard 원형은 샘플을 하나씩 더 만든다.
   ```
   FIGURE_QA_SNAPSHOT=1 npx vitest run lib/problem-generation/math-archetypes/figure-qa-snapshot.test.ts --project unit
   node scripts/mock-exam-generation/figure-qa-render.mjs          # Playwright(Chromium): <조합ID>.png 데스크톱 720px, <조합ID>.m375.png 모바일 375px
   ```
   산출물: `data/mock-exam-generation/figure-qa/<조합ID>.png` · `<조합ID>.m375.png` · `<조합ID>.meta.json`(샘플 문항·정답·구조 검사 결과·**코드 해시**). 확장 샘플은 `<조합ID>~<연산자>.png`.
2. **자동 구조 검사(코드)** — `figure-qa.ts` 가 렌더된 SVG/HTML 을 직접 읽어 잡는다(전 원형·시드 스윕, 게이트 G8). 오너가 든 결함 4종은 돌연변이 테스트로 고정:
   - 자료 존재: 지문이 그림을 가리키는데 figure 없음(`figure_missing`), 렌더 결과가 비어 있음(`render_empty`)
   - 비율·값 충실도: 눈금 숫자로 만든 축척으로 읽은 점·선·표 값이 데이터와 같은가(`render_value_mismatch`·`fitline_mismatch`·`table_value_mismatch`), 눈금이 일정 간격인가(`render_scale_nonlinear`)
   - 숫자·라벨 위치: 눈금 숫자가 격자선과 맞는가(`label_misaligned`), 글자 겹침·잘림(`label_overlap`·`label_clipped`)
   - 복수 자료: 같은 단위의 그림은 같은 눈금·같은 크기·같은 축 제목(`scale_mismatch_between_figures`·`choice_axes_differ`·`choice_size_differ`)
   - 축 눈금 3개 이상·축 제목·단위 괄호·범례(`axis_ticks_missing`·`axis_title_missing`·`unit_missing_in_title`·`legend_missing`)
   - 선택지 구별: 오답 그림이 서로·정답과 눈으로 구별되는가(`choice_indistinct`), 오답이 선언한 **정확히 하나의 규칙**만 어기는가(진단이 선언과 다르면 실패 — `figure-verify.checkChoiceInstance`)
   - 본문·선택지의 수치 ↔ 그림 데이터 일치: `checkFigure` 참조 검사 + `verification_js` 의 `FIGURE`/`CHOICES` 일치·자료 의존 검사
3. **사람(검수 에이전트)의 눈 검수** — 검수자는 PNG(데스크톱·375px)와 메타를 직접 열어 아래 체크리스트로 판정하고 `data/mock-exam-generation/figure-qa/<조합ID>.review.json` 을 남긴다. **문제를 그림만 보고 직접 풀어 메타의 정답과 대조**해야 한다(그림으로 풀리지 않거나 정답이 다르면 결함).
4. **유효성** — 판정은 `meta.json` 의 `codeHash`(그 조합의 원형 정의 파일 + 공용 빌더·장면 풀 + 쓰는 렌더러 + `ProblemFigure` 의 SHA-256)와 같을 때만 유효하다. 생성기·렌더러 코드가 바뀌면 판정은 `stale` 이 되어 재검수 대상이다(스냅샷도 다시 만들어야 한다 — `snapshot_stale`). 한 파일이 여러 조합을 정의하므로 그 파일을 고치면 같은 파일의 모든 조합이 재검수 대상이다(보수적).

## 체크리스트 (판정 파일의 `checklist` 키)
각 항목 `pass` / `fail` / `n/a`(해당 없음, 사유는 notes). 하나라도 `fail` 이거나 `defects` 가 있으면 `verdict: "defect"`.

| 키 | 확인 |
|---|---|
| `figure_present` | 지문이 가리키는 그림·표가 실제로 보이고 비어 있지 않다(선택지형은 4개 모두). |
| `proportion_matches_values` | 그려진 길이·높이·점 위치가 문제의 수치 비율과 맞는다 — 추세선이 눈금의 격자점을 지나고, 점 높이가 눈금 숫자와 일치하고, 표 칸 값이 맞다. |
| `labels_placed_and_legible` | 길이·값·눈금 숫자와 축 제목이 해당 선·점·격자선 근처에 있고 서로 겹치거나 잘리지 않으며 읽을 수 있다. |
| `multi_figure_consistent` | 복수 자료(Plot A/B)·선택지 4개는 같은 단위에서 같은 축척·크기·축 제목을 쓴다. 단일 그림이면 `n/a`. |
| `text_matches_figure_and_solvable` | 본문·질문·선택지의 수치와 용어가 그림과 일치하고, **그림만 보고 풀어 메타의 정답과 같은 답이 나온다**. |
| `axes_ticks_units_legend` | 축 눈금 숫자(3개 이상)·축 제목·단위·(복수 계열이면)범례가 있다. 표는 열·행 이름·합계가 있다. |
| `choice_distinct_one_rule` | 선택지형: 정답이 정확히 하나이고 오답 그림은 서로 구별되며 각각 하나의 실수 유형에 해당한다. 선택지형이 아니면 `n/a`. |
| `sat_visual_style` | SAT 지면과 같은 인상 — 세리프 글꼴, 굵은 축과 화살표, 얇은 격자, 점·선 굵기, 라벨 크기가 시험지답다. 이상한 색·장식·잘린 틀이 없다. |
| `mobile_375_readable` | 375px 에서 가로 스크롤 없이(또는 표만 약간) 모든 열·축·라벨이 판독된다. |

## 판정 파일 형식 (`<조합ID>.review.json`)
```json
{
  "itemId": "two_variable_data.cell.TW.P",
  "verdict": "pass",
  "reviewedAt": "2026-10-01T…Z",
  "reviewer": "<검수 에이전트 이름>",
  "codeHash": "<meta.json 의 codeHash 와 같은 값>",
  "samples": ["<meta.samples[].file 전부>"],
  "checklist": { "figure_present": "pass", "proportion_matches_values": "pass", "labels_placed_and_legible": "pass", "multi_figure_consistent": "n/a", "text_matches_figure_and_solvable": "pass", "axes_ticks_units_legend": "pass", "choice_distinct_one_rule": "n/a", "sat_visual_style": "pass", "mobile_375_readable": "pass" },
  "defects": [],
  "notes": "문제를 그림만 보고 풀어 얻은 답과 근거(예: x=… → …)"
}
```
결함이 있으면 `verdict: "defect"`, `defects: [{ "sample": "<파일>", "check": "<체크리스트 키 또는 other>", "description": "무엇이 어떻게 잘못됐는지" }]`. 검수자는 **코드·데이터를 고치지 않는다** — 판정만 남긴다. 고치는 일은 구현자가 하고, 고친 뒤 스냅샷을 다시 만들면 해시가 바뀌어 재검수가 필요하다.

## 게이트와 매니페스트의 검수 상태
- 게이트 `G9`(시각 검수): 모든 조합이 `pass`(현재 코드 해시 기준) 여야 한다. 상태: `pass` · `defect` · `missing`(판정 없음) · `stale`(코드 변경으로 무효) · `snapshot_stale`(스냅샷이 현재 코드와 다름) · `no_snapshot` · `incomplete`(일부 샘플·항목 누락) · `unimplemented`.
- `coverage-gate-report.json` 의 `qaByItem`(조합 303개 전체)이 매니페스트의 **검수 상태 열**이다. 상태는 코드가 바뀔 때마다 달라지는 파생값이라 매니페스트 TS 에 박지 않고 보고서에 기록한다.
- 게이트 `G8`(구조 검사): 위 2번 자동 검사가 전 원형·시드 스윕 샘플에서 0건이어야 한다.

## 이후 단계에 대한 설계 요구
새 조합(새 skill·새 자료 종류·새 렌더러·B형)을 구현할 때마다 (1) `figure-qa-hash.ts` 의 `archetypeSourceFor` 에 그 조합의 원형 정의 파일 규칙을 더하고 (2) 필요하면 `figure-qa.ts` 에 그 렌더러용 충실도 검사를 더하고(렌더러마다 SVG 구조가 다르다) 그 검사의 돌연변이 테스트를 쓰고 (3) 스냅샷을 만들어 검수를 받는다. 이 세 가지가 빠진 조합은 게이트에서 `no_snapshot`/`missing` 으로 막힌다.
