# AP 원문 수식(TeX) 점검과 교정 (2026-10-12)

문제: 학생·관리자 화면은 `$...$`·`$$...$$`·`\(...\)` 안의 수식만 KaTeX 로 그린다. 생성기가 구분자 없이 쓴 `\frac{1}{10}`, `\pi\int_0^2.746\left[...\right]dx`, `∫₀^2.746` 는 글자 그대로 보인다.

## 원인
1. **MC 해설**: `scripts/ap-generation/pipeline2.ts`(`structuredExplanation`)와 `graph-precheck.ts`(`expl`)가 "The correct answer is X." 를 만들 때 선택지의 `$` 를 전부 뗐다 → `$\frac{1}{10}$` 이 `\frac{1}{10}` 이 됨.
2. **FRQ 참고 답안**: Python 원형(`archetypes/calc_ab_frq.py` 등)이 모범 답안에 `\pi\int…\left[…\right]`·`∫₀^2.746` 같은 TeX·유니코드 혼합을 `$` 없이 씀.
3. **화면 쪽**: 학생 화면(응시·결과·문제 이력)은 렌더 직전에 `autoMathExplanation`(lib/ap-exam/explanation-math.ts)으로 감싸지만, **관리자·교사 세트 내용 보기(`MockExamSetContentViewer`)는 이 변환을 거치지 않아** 저장 원문이 그대로 보였다. 그리고 점검기(`result_no_raw_tex`/`scanRawMath`)는 `\frac` 등 일부 명령과 `^{` 만 보고, 임의 `\명령`·`∫₀^` 는 보지 못했다.

## 전수 점검 결과 (코드: lib/ap-exam/tex-audit*.ts, 실행: `AP_TEX_AUDIT_OUT=out.json npx vitest run lib/ap-exam/tex-audit-run.test.ts`)
재고 1079건 중 auto_passed 530건(거절·중복 제외). 학생·관리자가 읽는 필드(본문·선지·해설·FRQ 문제·모범 답안·자료) 기준.
- **저장 원문에 구분자 밖 수식이 있는 문항: 251건**(MC 217, FRQ 34). 필드별: `explanation_en` 205, `parts[].model_answer` 68(FRQ 참고 답안), `stimulus.*` 합계 약 40(자료 설명·표 칸·함수식).
- 종류(필드 수): plain-exponent 202, tex-command 150, tex-script 44, ascii-inequality 29, unicode-script-caret(`∫₀^`) 25, unicode-escape 1.
- **수정 전 화면 변환(autoMath)을 거친 뒤에도 남는 문항: 11건**(주로 `∫₀^2.746` 형태 25개 필드, `lim_{x->inf}` 자료 2개). 이번에 변환 규칙을 추가해 **0건**.
- 원형별 상위: frq_area_volume(6건 전부), frq_diffeq·frq_related_rates·frq_series 등 FRQ 모범 답안, MC 는 원형이 아니라 **해설 조립기**가 원인(205건).
- 세트별(저장 원문 기준 영향 문항 수 / 수정 전 화면 잔여): AB1 v1 23/2, AB1 v2(계획 적용) 24/2, BC1 24/1, AB2 25/1, AB3 26/1, BC2 28/1, BC3 28/0, 부분 연습 PNC 18/0, PC 3/0, PF 5/2, 게시 중 Calculator Practice 6, Free-Response Practice 1, Non-Calculator Practice 17, 예비(어느 세트에도 없음) 65/3. 수정 후 화면 잔여는 전부 0.
- 교정 대상 항목(문항 단위, 해설 문장 기준) **259건**: MC 224 + FRQ 35. 세트별: AB1 v1 26, AB1 v2 25, AB2 26, AB3 22, BC1 25, BC2 31, BC3 27, 부분 PNC 18 / PC 6 / PF 4, 게시 중 연습 세트(Non-Calculator 17·Calculator 8·FRQ 1), 예비 68. 전체 목록(세트 소속·해시)은 `data/ap/stock/tex-corrections.json`.
- 보고된 두 사례: `run2:ap_calculus_ab-m01-k0`(MC, x→5 표 극한; 게시 중 Non-Calculator Practice, BC2 계획) 과 FRQ `run2:ap_calculus_ab-f04-k3`(c)(AB2 계획)가 목록에 있다.

> 주의: 위 수치는 저장소 재고(items.json 계열)와 계획 파일(ab-full-set-selection·ab1-v2-swap-plan·exact-assign-5sets-cons·partial-rebuild-ab-plan·published-usage) 기준이다. 실제 DB 의 게시 상태와 다를 수 있으므로 적용 전 관리자 화면 미리보기가 DB 와 대조한다(변환 전 해설과 다르면 건드리지 않는다).

## 수정 (생성기·점검)
- `lib/ap-generation/math-wrapping.ts`: `answerTextForExplanation`(TeX 가 든 선택지는 `$` 유지) + 생성 게이트 `gateMathWrapping`(해설·모범 답안·본문·선지·문제 파트의 구분자 밖 `\명령`·`^{`·`_{`·`∫₀^` 거부). `pipeline2.ts`·`graph-precheck.ts`·`frq-precheck.ts` 에 연결(신규 생성 경로 전용 — 기존 재고 재검증 `revalidate-free` 는 바꾸지 않았다).
- `lib/ap-exam/convert.ts`: 변환 시점에 해설·참고 답안을 `autoMathExplanation` 으로 감싼다(예비 재고를 나중에 변환할 때 자동 교정). `planConversion(c, { wrapMath:false })` 는 "변환 전 원문"(교정 파일 before 해시) 계산용.
- `lib/ap-exam/explanation-math.ts`: `∫₀^2.746`·`∫₀^∞` → `$\int_{0}^{2.746}$`, `lim_{x->inf}` → `$\lim_{x\to \infty}$` 규칙 추가(멱등).
- 점검 확장: `lib/ap-exam/raw-math-scan.ts`(자동 화면 점검 `stimulus_no_raw_tex`/`result_no_raw_tex` 가 쓰는 DOM 스캐너)에 임의 `\명령`(`tex-command-any`)과 `unicode-script-caret` 추가. `lib/ap-exam/tex-audit.ts` 는 저장 원문 단계(`findUnwrappedMath`)와 화면 변환 후 단계(`findUnwrappedAfterDisplay`)를 구분한다.
- 관리자 세트 내용 보기(`MockExamSetContentViewer`)가 AP 세트에서 학생 화면과 같은 변환을 거치도록 `autoMath` 속성 추가(`MockExamSetsPanel` 3곳에서 AP 세트일 때 켬). 교사 탭·오류 신고 패널(`ReportedProblemsPanel`)은 AP 여부를 몰라 이번에 바꾸지 않았다(남은 일).
- 테스트: `lib/ap-exam/tex-audit.test.ts`(두 보고 사례 + 유니코드 사례가 저장 단계·DOM 스캐너·생성 게이트에서 실패, 변환 후 통과, 재고 전수 화면 잔여 0), `lib/ap-admin/explanation-fix.test.ts`, `app/admin/mock-exam/ApExplanationFixPanel.test.tsx`.

## 이미 게시된 문항의 교정 경로 (새 버전만 — 공개 버전 불변)
공개된 `problem_versions` 와 조립된 세트 스냅샷(`mock_exam_set_items.content_snapshot`)은 수정할 수 없다. 두 단계로 새 버전을 만든다. 본문·선지·정답·그림·진술은 그대로이고 해설·참고 답안만 달라지며, 응시·답안·결과·공개본은 쓰지 않는다.

1. **문제 단위(기존 RPC 재사용)**: 관리자 → Mock Exams → AP 재고 관리 → "AP 설명 수정 새 버전" ①. 교정 파일(`data/ap/stock/tex-corrections.json`, 항목별 변환 전 해설 sha256 + 교정 문안 + 교정 문안 sha256)을 DB 의 현재 공개 버전과 대조:
   - 교정 대상(DB 해설 해시 = before) / 이미 교정됨(= after) / 변환 전(DB 에 아직 없음 — 나중 변환 때 자동 반영) / 해설 불일치(손으로 고친 경우 등 — 건드리지 않음) / 진행 중 초안·검수 버전 있음(덮어쓰지 않음).
   - 미리보기(읽기 전용, 계획 해시) → 확인 체크 → 실행: 항목마다 `save_problem_draft_version`(해설만 교체) → `set_problem_render_check`(기존 점검 복사) → `confirm_and_publish_problem_version` → `ap_attach_new_version`(후보에 새 버전 연결). 한 번에 최대 40건, 실패하면 거기서 멈추고 이미 끝난 항목은 다음 실행에서 "이미 교정됨"이 된다(멱등). 환경 가드(허용된 비프로덕션 ref 만)·`requireAdmin`·감사 기록(`ap_stock_admin_runs`: explanation_fix_preview / explanation_fix).
2. **세트 단위(신규 RPC, 마이그레이션 540)**: 같은 패널 ②. `mock_exam_refresh_explanations(source, actor)` 가 공개 중인 AP 고정형 세트의 같은 계열에 version_no+1 초안을 만든다. 모든 문항을 복사하되 문제의 현재 공개 버전이 세트의 버전과 다르면 새 버전으로 교체(스냅샷은 INSERT 트리거가 새 버전 내용으로 다시 만든다). 새 버전이 본문·선지·정답·그림·진술까지 같을 때만(아니면 거부), 하나도 바뀌지 않으면 거부, 계열당 초안 1개, 공개 범위는 공개 시 기존 공개본에서 승계. 그다음 공개는 기존 'AB/AP 세트 새 버전'의 **새 버전 공개**(원자적 RPC)를 그대로 쓴다.
3. 학생 영향: 새 버전 공개 후 새로 시작하는 응시부터 교정 해설. 진행 중·완료된 옛 응시는 옛 버전에 남는다(기존 새 버전 규칙과 동일).

### 적용 순서 (오너/총괄)
1. 마이그레이션 `20262100000540_ap_explanation_refresh_version.sql` 적용(additive: RPC 1개 + 감사 허용 값 3개 추가).
2. 앱 배포 후 관리자 화면에서 ① 미리보기 → 확인 → 실행(40건씩 반복, 남은 건수 0 까지).
3. ② 각 공개 세트(AB1 v1·Calculator/Non-Calculator/FRQ 연습 등)에서 미리보기 → 새 버전 초안 만들기 → 초안 내용 확인(관리자 세트 보기는 이제 변환 적용) → 'AB/AP 세트 새 버전' 패널에서 새 버전 공개.
4. 교정 파일 재생성/검증: `AP_TEX_CORR_WRITE=1 npx vitest run lib/ap-exam/tex-corrections-gen.test.ts`(쓰기), 평소 `npx vitest run lib/ap-exam/tex-corrections-gen.test.ts`(파일이 재고와 같은지 확인).

### 검증 범위와 한계
- 단위: 교정 파일 전 항목이 구분자 밖 TeX 없음·KaTeX 파싱 가능·멱등, 서비스(상태 분류·환경 가드·해시·RPC 순서와 인자·"문제·세트·응시 테이블 직접 쓰기 없음"·중간 실패), 패널.
- 마이그레이션 540 은 **스텁 스키마의 일회용 Postgres 컨테이너**에서 동작(초안 생성·문항 교체·스냅샷 갱신·초안 중복 거부·내용 변경 거부)만 확인했다. 실제 전체 스키마(격리 Supabase 스택)에서의 통합 테스트와 원격 적용은 하지 않았다(`npx tsx` 가 이 환경에 없어 `scripts/dev/isolated-stack.sh` 를 쓰지 못함).
- 실제 DB 의 게시 상태·문제 버전은 조회하지 않았다(원격·서비스 키 금지). 관리자 미리보기가 적용 전에 DB 와 대조한다.
- 남은 일: 교사 탭 `TeacherMockExamTab`·오류 신고 패널의 AP 변환 적용, 자료(stimulus) 표 칸 평문 수식의 화면 표시는 기존 `apPassageForDisplay`/표 렌더 경로에 의존.
