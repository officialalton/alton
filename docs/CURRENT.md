# ALTON — 현재 상태 (2026-09-23 기준)

> 새 세션은 `CLAUDE.md` → 이 문서 → `docs/BRANCH-WORKFLOW.md` 순으로 읽고 시작한다.
> 그 이전 상세 이력(2026-08-29 ~ 2026-09-14 낮)은
> [`history/CURRENT-archive-until-2026-09-14.md`](history/CURRENT-archive-until-2026-09-14.md)에 원문 그대로 있다 — 필요할 때만 검색한다.

## 1. 한눈에

| 항목 | 값 |
|---|---|
| 브랜치 / Preview | `preview/m4-integration-verification`(UI 통일화 `feature/ui-unification` 병합 완료 + 2026-09-23 컨설턴트 포털 확장·lint 전량 정리 반영). 최신 Preview **https://alton-epv8zq7xw-alton7.vercel.app**(HEAD `60e6dd2`). 배포 주의: 이 Vercel 프로젝트는 GitHub 연동이라 **커밋과 완전히 일치하는 깨끗한 작업 트리**에서 `vercel deploy`하면 커밋 작성자 검증(TEAM_ACCESS_REQUIRED)에 걸려 빌드가 조용히 BLOCKED 된다 — 메인 워크트리(미커밋 docs 변경이 늘 있음)에서 배포하거나, git 없는 임시 복사본에서 배포한다(2026-09-20 확인). |
| 공유 non-prod(`worpsqwqgnspddnrtnvq`) | 마이그레이션 **`20261472000000`까지 local=remote 확인**(2026-09-23, `20261464000000`~`20261472000000`는 이번 컨설턴트 포털 확장분). Supabase 프로젝트는 이 하나뿐(별도 프로덕션 DB 없음 — 2026-09-20 확인). 새 마이그레이션 작성 시 `docs/BRANCH-WORKFLOW.md` 동기화 체크리스트를 통합/배포 직전 매번 실행할 것. |
| Production | Vercel production 도메인 배포·마이그레이션 없음(오픈 전, 실제 고객 데이터 없음). Stripe/DocuSign 등 외부 키는 샌드박스. |
| 테스트 | 2026-09-23: `tsc` 통과, `npm run build` 통과, `eslint .` **0 errors/warnings**(2026-09-21 리뷰가 지적한 "lint 정리(소스 82 errors)" 완료 — 상세는 4절 참고). `vitest run --exclude "**/*.integration.test.ts"`: 2530/2531 통과(1 skip) — 남은 1건은 랜덤 지오메트리 스트레스 테스트가 매번 다른 파일에서 산발적으로 실패하는 기존 flaky 이슈(단독 재실행 시 항상 통과, 코드 결함 아님). **알려진 사전 실패(무관)**: `app/session/[id]/problem-grading.integration.test.ts` 4건은 `confirm_and_publish_problem_version`·`issue_homework_by_keywords` 의 현재 정의에 없는 문구를 기대하는 오래된 테스트(함수 정의 확인됨), 나머지 `*.integration.test.ts` 실패는 로컬 DB 잔여 데이터(`reservations_no_overlap` 등) — `supabase db reset --local` 직후 `--no-file-parallelism`으로 돌릴 것. |
| 실제 외부 연동 | 교재 Drive 읽기·고정 사본 공개, Smart Notes Drive reader 권한 부여(웹훅 멱등성 적용), Google Calendar/Meet 실제 이벤트 생성(상담 일정 확정). Preview `CURRICULUM_DRIVE_ENABLED/ID/ALLOW_REAL_WRITES=true`. AI 생성은 Anthropic 키. 유료 서비스 추가 없음. |
| 대학 데이터 수집 표준 | 대학 학업지표·학비·전공을 다루는 모든 세션은 [`2026-09-23-cds-first-data-collection-standard.md`](2026-09-23-cds-first-data-collection-standard.md)를 먼저 읽고 따른다(CDS 원문 우선 수집, cohort 정확 구분, 출처·검증상태 명시 — 프린스턴 10차 세션 방식이 표준화됨). 진행 이력은 [`2026-09-23-university-info-sources-and-reports.md`](2026-09-23-university-info-sources-and-reports.md) 11차 세션 참고. |
| 상태 | 문제생성 파이프라인 Step 6 + College Board 840문항 커버리지 매핑 완료. **고정형 모의고사 V1 구현 완료**(`2026-09-17-fixed-mock-exam-v1-spec.md`; 4개 포털 탭 통합, 학생/교사/학부모 목록은 Shell 탭 안, 응시·결과 화면만 독립 라우트). UI 통일화(Acely 레퍼런스, `docs/2026-09-19-ui-unification-spec.md`) 3차까지 병합. 대학 DB Part 5 + 관리자 전체 필드 편집 반영. **남은 UX 지적**: 수업 준비 UI 개선안(제품 오너 결정 대기). |
| **2026-09-21 보안·리뷰 반영(기획자 코드 리뷰)** | **P0 차단 완료** — 학생이 모의고사 답안/응시 상태·과제 JSON(정답·성적)을 REST API 로 직접 읽거나 바꿀 수 있던 RLS 구멍을 막았다(`20261429000000`: 학생·학부모 읽기/쓰기는 SECURITY DEFINER RPC 만, 채점 확정 전 정답·해설·정오 DB 마스킹). P1: 결제→수업권 grant+ledger 원자화 RPC(`20261430000000`), 모의고사 교사 권한 `teaches_student()` 통일(v3 매칭 학생 누락 해결), `start_problem_work` 끝난 수업·미배정 문제 거절. P2: Stripe/DocuSign 웹훅 DB 오류는 500(재전송), Smart Notes 큐 적재 실패 시 claim 되돌림, `/student` 홈 목록 로더 실패 격리. **남은 리뷰 항목**: 전체 통합 테스트 green 복구(로컬 DB 격리, 순수 테스트 인프라 문제), 로컬 webpack 빌드 PDF worker ESM 실패(non-blocking). **lint 정리는 2026-09-23 완료**(아래 4절 및 테스트 행 참고). |
| 알려진 버그 | `/student` 홈 500(React #418/#441)은 이후 커밋으로 수정됨 + 2026-09-21 로더 실패 격리 추가. 재발 시 `docs/2026-09-18-real-student-teacher-uat.md` 5절 재현 절차 참고. |

## 2. 지금 유효한 확정 정책 (바꾸려면 제품 오너 결정)

**커리큘럼·수업 준비**
- 세 층: 관리자 기준본(`subject_template_units`) → 교사 기본 구성(`teacher_curriculum_template_units`) → 학생 회차(`curriculum_overlay_units`, 준비안 `curriculum_unit_preps/_items`). 상위 변경은 자동 반영하지 않는다 — `업데이트 있음` → `기본 구성 업데이트`(미리보기 → 적용, 지문 불일치 시 `ALT02` 거절). 최초 생성·최초 상속만 자동. 내려온 행은 `inherited`·`inherited_position`, 목표는 `inherited_goal`; 사람이 손댄 것은 덮지 않는다. 뺀 것은 제외 기록(`…_exclusions`)으로 되살아나지 않는다.
- **수업 시작이 곧 고정**(매니페스트). 진입·저장·연결은 고정하지 않는다. 쓸 수 없는 항목이 하나라도 있으면 시작 자체를 막는다. 시작한(live) 수업은 예약 시각 전이어도 화면에 '진행 중'. 진행 중 수업의 구성 변경은 교사가 **`수업 구성 변경`**을 눌러야만 반영(`repin_live_session_content`, 학생이 사용한 항목은 남김). 종료 수업 불가.
- 교사 포털의 모든 `수업 준비`는 **수업 화면(`/session/[id]?tab=prep`)**으로 들어간다. 학생·보호자의 `수업 준비`는 예약 수업이 있으면 그 수업 화면, 없으면 `/unit-preview`(읽기 전용, 정답·해설·teaching_tip 은 응답에 없음).
- 수업 화면 탭: 교재 · 문제 · 단어장 · 과제 · (교사)수업 준비. 연습장·문제 기록 탭은 없음(문제 기록은 학생 포털만).

**교재(Drive)**
- Drive 구조 **과목 → 키워드 → 파일**. 단원은 폴더를 만들지 않는다. 교재는 대표 키워드 하나에 속하고 그 키워드가 붙은 여러 단원에 들어간다(N:M).
- 교재는 **Drive 동기화로만** 들어온다(관리자 `Drive 자료 › 과목 자료 동기화`: 모든 키워드 폴더 → 미등록 등록 → 미공개 고정 사본 공개, 이미 공개는 건너뜀). 새 HTML 교재 만들기는 막았다. 영상도 같은 자료(kind=video)로 회차 구성에 담는다.
- 공개 = 그 시점 파일의 **고정 사본**(`curriculum-assets` 버킷, `curriculum_doc_versions.snapshot.asset`). 원본이 바뀌어도 공개 버전·과거 수업은 그대로. 원 파일명(`source_drive_name`)은 그대로 두고 표시 이름(`title`)은 관리자가 따로 적는다.
- 관리자 `교재` 탭 하나(라이브러리 통합): 과목 › 키워드(기본) / 과목 › 단원 / 목록. `Drive 원본 없는 교재 보관`(과목 미선택 시 전체).
- PDF 규격 v1(페이지 수 제한 없음): [`2026-09-14-lesson-pdf-spec.md`](2026-09-14-lesson-pdf-spec.md).

**문제·풀이·채점**
- 형식: `mc` 객관식(클릭이 곧 답, 채점 전 재선택), **`spr` 숫자 입력**(SAT Math 직접 입력, 정답 목록 정규화 비교, 채점 전 재입력), `essay` 서술형(AP용, **글 상자에 타이핑 — 쓰는 대로 저장**, 화이트보드 아님), `math` 풀이형(풀이판 → `풀이 제출`). **연습장은 없다** — 문제 화면 전체 필기가 그 자리(2026-09-14).
- 문제 분류 = **SAT 영역 + 세부 기술 코드**(`problem_skill_codes`). 문제은행 찾기/만들기, 회차 자동 구성 조건(`skill_codes`), 수업 준비 배정, 학생 성취 기록이 같은 코드를 쓴다(2026-09-14).
- 키워드 자동 문제 구성은 **회차당 자동분 기본 20개**(`target_count` 정하면 그 수). 직접 담은 것은 세지 않고, 이미 넘게 담긴 회차는 줄이지 않는다(2026-09-14).
- 자동 채점(mc·spr)은 서버가 계산하되 **교사가 `채점 완료`를 눌러야 확정**. 정답·해설은 **채점 뒤에만** 학생에게 열린다(payload 에서 제외). 목차엔 정답/부분 정답/오답, 점수는 정답만 센다.
- **과제 = 수업 문제와 같은 흐름**(v3 한 갈래). 교사가 회차 키워드 풀에서 골라 발급(`issue_homework_items`, 시작 전 회수), 학생은 수업 화면 과제 탭 또는 학생 포털 과제 탭(수업별 탭 → 같은 패널)에서 푼다. 답·채점·연습장·문제 위 필기는 **수업 것과 분리**(`session_problem_work.source`, `problem_context`). 레거시 `homework_items`는 읽기만.
- 문제은행: 초안 → 검수 → 공개(공개된 문제만 회차 후보). 난이도 필수 선택, `전체 공개`(보이는 초안 일괄). AI 생성은 초안으로만.
- 문제 템플릿(설계 [`2026-09-14-problem-template-design.md`](2026-09-14-problem-template-design.md)): 수식 KaTeX(`$…$`), 표는 마크다운 파이프 표, 메모 목록 `- `, 밑줄 `__문장__`. **도형·그래프는 데이터(figure spec)**로 받아 우리가 SVG 로 그린다(`lib/problem-figures`); 그림 파일은 비공개 버킷 `problem-assets` + 서명 URL. **그림이 있는 문제는 관리자가 `그림 확인함`을 켜야 공개된다**(그림이 바뀌면 확인 해제). 유형 코드(`lib/problem-skills.ts`: SAT RW 11종·SAT Math 4영역+SPR·AP FRQ)를 고르면 실제 시험 문항 말투 규칙이 프롬프트에 들어간다. 문항은 영어, 해설은 한국어.

**필기**
- PDF 페이지 필기: 대상 (수업, 공개 버전, 자료, 페이지). 교사 공유·학생 공유 두 레이어(각자 캔버스, 상대 것은 못 지움), `eventId` 중복 방지, 대기·전송 중 획 보존, 창 크기 변화에 좌표 추종. 도구: 펜·지우개·**텍스트(클릭한 자리 글 상자)**·**전체 지우기(내 레이어·이 페이지, `clear_all`)**. 실시간 채널.
- 문제 한 장 위 공유 필기: 대상 (수업, 문제, lesson|homework). 같은 컴포넌트. 문제 풀이판(`problem_student`/`problem_teacher_feedback`)과는 별개.

## 3. 스키마·구조 요점(2026-09-14 추가분)

- `session_problem_work`: `source`(lesson|homework, 고유키 포함), `auto_correct`·`grade`·`grade_comment`·`graded_at/by`, `submitted_text`(spr). RPC `start_problem_work(…, p_source)`, `submit_problem_attempt`(자동 채점·채점 전 재선택), `grade_problem_attempt`.
- `session_homework_items.problem_version_id`(발급 시 고정). RPC `issue_homework_items`, `withdraw_homework_item`, `session_problem_formats`(수업+과제).
- `problem_versions`: `answers`(spr 동치 정답), `figure`·`figure_checked`. RPC `save/create_problem_draft_version`(10인수), `mark_problem_figure_checked`, `confirm_and_publish_problem_version`(spr 정답·mc 선택지·그림 확인 검사). `problem_format` enum + `spr`. 함수 `spr_to_numeric`, `spr_answer_matches`.
- `session_annotation_events`: `curriculum_doc_version_id`·`page_number`·`client_event_id`(페이지 필기), `problem_context`(문제 위 필기). 모양 제약: teacher_shared/student_shared 에 `problem_id` 허용. RPC `append_page_stroke_events`(tool clear/text), `append_problem_page_stroke_events`.
- `curriculum_docs`: `kind`(html|pdf|video)·`source_drive_*`·`primary_keyword_id`; `curriculum_drive_folders`(scope subject|keyword, unit 은 retired). 버킷 `curriculum-assets`, `problem-assets`(비공개).
- `repin_live_session_content`(진행 중 재고정), `unit_composition_counts`(수업 준비 1.4초로 만든 정의자 함수), `overlay_unit_parent`(호출자 권한 — 정의자로 두면 남의 회차 존재가 새어 나간다).
- Vercel 함수 지역 `pdx1`(`vercel.json`), pdf.js 서버 워커 고정(`serverExternalPackages`·tracing).

## 4. 2026-09-14 진행 내역(압축, 시간순)

1. **P2 9~11차** — 준비안 유지·다시 구성·수업 시작 고정, 학생별 자동 상속, 수업 준비 화면 통합, 학생·보호자 사전 열람. 결함 5건(시딩 `source_unit_id`, 문제은행 RLS, 버전 스탬프 정의자 등).
2. **P2 12·13차** — 상위 변경의 완전한 반영(`inherited`·제외 기록·순서·목표), 학생·보호자 회차별 `수업 준비`, **Drive 기반 PDF·영상 자료 최소 구현**(고정 사본 공개·페이지 필기·뷰어). Drive 구조 정정(과목 → 키워드). 실제 Drive 첫 공개 성공(15,343KB·99쪽).
3. **P2 14차** — UAT 수정 5건(카탈로그 업데이트, 시딩 폴백, 보관 교재 건너뛰기, `수업 시작` 열 이름, **수업 준비 15~30초 → 1.4초**), PDF 뷰어(썸네일·fit-page·레티나·반투명 도구), 문제 슬라이드·교사 정답 토글, 객관식 지문 끝 A)~D) 중복 제거.
4. **P3 5차** — 문제 풀이·채점 흐름 재정리(객관식 클릭·서술형 연습장·풀이형 제출, 정답은 채점 뒤), 교사 채점 UI, PDF 텍스트·전체 지우기, 연습장·문제 기록 탭 제거.
5. **P3 6차** — 관리자 교재 정리(키워드 폴더, 과목 전체 Drive 동기화, Drive 원본 없는 교재 보관), 시작한 수업 '진행 중' 표시 + `수업 구성 변경`(재고정), 잔손질.
6. **P3 7차** — **과제 v3 한 갈래 통일**, 학생 포털 과제 = 수업별 탭 + 같은 패널, 커리큘럼 회차 키워드 칩, 연습장 실시간, PDF 필기 크기 추종·저장 후 사라짐 수정, 교사 수업 준비 → 수업 화면.
7. **P3 8차** — 과제 답안·채점·문제 위 필기를 수업과 **분리**(source/context), **문제 화면 전체 필기 레이어**(수업·과제 공통), 채점 결과·점수 표시, 관리자 교재 탭 통합·새 교재 차단·노출용 이름·목차 접기.
8. **P3 9차** — 문제 템플릿 ①~⑤(SPR / 표·수식 / 도형·그래프 데이터 렌더 + 그림 확인 게이트 / 그림 파일 첨부 / 유형 코드·문항 말투·메모·밑줄), 문제은행 난이도·`전체 공개`·자동 확장 칸. **실제 모델 호출 표본 10문항** 렌더 확인 → 영어 규칙·응답 정규화·라벨 위치 수정. AI 내용 오류(변 라벨 오기) 실례 확인 — 그림 확인 게이트가 필요한 이유.

24. **P3 25차 — 유형별 문제 품질 계약·독립 품질 검사**(2026-09-15, migration 20261371): 세부 기술 30개마다 질문 대상/자료 근거/표시 방식/정답 근거/답안 형식 다섯 연결을 정의·검사(`lib/problem-quality-contract.ts`), 생성 모델과 별도의 독립 검사(정답 일치·오답 근거·추정 난이도, `lib/problem-generation/review.ts`), 파이프라인(생성→자료→계약→검사→사유 재생성→부족분, `pipeline.ts`)을 서버 액션과 표본 배치(`scripts/problem-quality-batch.ts`)가 공유. `problem_versions.quality`(추정 난이도·근거·오답 근거·검토 필요), `problem_response_stats` 뷰(보정 재료). 관리자에는 난이도 근거·검토 필요·응답 통계만 표시. 선택지는 A)~D). 문서 `docs/2026-09-15-problem-type-conditions.md`.
23. **P3 24차 — 생성 게이트·템플릿 확장·제한 정리**(2026-09-15): 생성 결과는 공개 게이트와 같은 검사(자료 참조·렌더·내용)를 통과해야 초안 저장, 실패 시 사유 피드백으로 1회 자동 재생성 + 부족분 재생성. 평행선·횡단선 템플릿에 횡단선 교점·삼각형(crossing)과 수직 횡단선·직각 표시(perpendicular) 추가. 제한 조건은 네 분류(범위 밖/관례·정확성/구현 대기/임시 제거)로 전수 조사(`docs/2026-09-15-problem-bank-restructure.md` 6절), 구현 대기 4건은 scene 부품 조합 렌더러(6-6)로 다음 단위. 자료 포함 여부·유형은 생성 전에 선택(권장은 자료 포함 기본/텍스트형).
22. **P3 23차 — 문제은행 생성·편집 재구성**(2026-09-15, migration 20261369·20261370): 관리 과목과 문항 체계(sat_rw/sat_math/ap, `problems.exam_system`·`ap_subject`) 분리, 생성 탭에 문항 체계 탭 + 7단계 흐름, 체계·유형별 항목만 표시(`editorVisibility`), 자료 필요성 자동 판정(`lib/problem-material-need.ts`, R&W 정량 근거 포함, 필수면 저장·공개 차단), 질문 분리 저장(`problem_versions.question`)과 복수 생성 계약 검증(질문 없는 결과는 저장 안 함, 사유 분리), 질문 없는 문제는 자동 구성 후보 제외 + 집계·'질문 보완 필요' 표시, AP 는 과목 선택·준비 중 자리만. 문서 `docs/2026-09-15-problem-bank-restructure.md`.
21. **P3 22차 — RW 구조화 자료 블록**: 기존 11개 유형에 Text 1/Text 2 구역·메모 목록+목표·빈칸/밑줄 대상(정확히 하나)·질문 분리·정량 근거 figure(data) 를 저장 시 해석·검증(`lib/rw-stimulus.ts` → `render_check` → 공개 게이트, DB 변경 없음). 학생·관리자 같은 `RwStimulusView`. 레거시 passage 그대로 읽힘, 코드 없는 옛 문제는 검사 안 함. 로컬 E2E 13건(결정적 7 + AI 6) 통과. 문서 `docs/2026-09-14-rw-structured-blocks.md`. 다음: 분류 후속 UI(criteria skill_codes 편집·일괄 지정), Preview UI UAT.
20. **P3 21차 — SAT Math 마무리**: 부분 3건 해소 + E2E 없던 표현 5건 + 템플릿 8 복합 도형(음영) → 19개 기술 코드 전부 검증됨, "SAT Math 범위 완료(로컬 E2E 기준)". 3D 좌표는 범위 밖 판정. 다음: Reading & Writing 기존 11개 유형의 구조화 자료 블록(Text 1/2·메모·표/그래프 근거·밑줄/빈칸) 보완.
19. **P3 20차 — SAT Math 커버리지 매트릭스**(`docs/2026-09-14-sat-math-coverage-matrix.md`: 기술 코드 19 × 표현 × 상태 — 검증됨 16·부분 3), figure_choice 정답 자리 자동 배치·정답 불일치 거부, E2E 그래프 선택지 통과.
18. **P3 19차 — 좌표기하·복합 도형(polygon·circle·midpoint·intersection·transform, 값 계산 대조), figure_choice/figure_set, 수식·선택지 블록(KaTeX 조판 검증·로마숫자 진술 `statements` `20261368`·선택지 정합·SPR 형식) → 내용 검증도 `render_check` 게이트.** 로컬 E2E(진술 블록) 통과. 다음: SAT Math 커버리지 매트릭스 문서 → 분류 후속 UI.
17. **P3 18차 — 템플릿 6 사각형·다각형, 템플릿 7 입체 2.5D**(직육면체·정육면체·원기둥·원뿔·구·사각뿔). 대표 10문항씩·거부 사례·로컬 E2E(사다리꼴·원기둥) 통과. 다음: 좌표기하·복합 도형 → 그래프/도형 선택지(figure choice) → 수식·로마숫자 선택지 Block.
16. **P3 17차 — SAT 6~11 대조 보완 + 템플릿 5 원**: 점도표·양방향 표·문장형 자료, 음영 부등식·조각함수·유리함수·점근선, 선택지 부등호 대조·좌표 노출 거부, 원 템플릿(중심·반지름·현·호·부채꼴·접선·중심각·원주각). 로컬 E2E(원·부등식) 통과.
15. **P3 16차 — 문제 분류 모델**(`20261367`): `problem_skill_codes`(SAT 영역 8 · 세부 기술 30, College Board 분류), `problems.sat_domain/skill_code`(코드→영역 트리거, 옛 유형에서 영역 백필), 문제은행 필터·새 문제(영역→기술 선택 시 유형·형식·그림 요구 자동)·분류 편집, AI 생성 프롬프트에 영역·기술 힌트, 자동 구성 후보 뷰·회차 조건 `skill_codes` 필터, 수업 준비 후보 기술 필터·배지, 학생 문제 기록 기술별 성취(채점 기준). 로컬 통합·컴포넌트 테스트 통과.
14. **P3 15차 — 템플릿 4 표·데이터 그래프**(표·숫자 목록·막대·선·히스토그램·산점도+추세선·상자그림, 한 원본 데이터, 값·항목·단위 참조 lint, `require_data`). 로컬 E2E 통과, Preview DB 게이트 실측. 다음: SAT 영역·세부 기술 코드 분류 모델(문제은행·자동 구성·성취 기록 공통) → 원 → 사각형·다각형·입체 → 좌표기하·복합 → 그래프/도형 선택지 → 수식·로마숫자 선택지 Block.
13. **P3 14차 — 템플릿 3 좌표평면(객체 id)**: 점·직선·함수·선분·산점도+추세선, 라벨 후보 자리 배치(없으면 거부), 지문 좌표·이름·식 일치 lint, 옛 `coordinate_plane` 레거시화(`20261366`), 템플릿 1 → 공통 `Sheet` 이관. 로컬 E2E 통과. 제품 오너 확정: 수학 템플릿 전 범위(표·데이터 그래프, 원·사각형·좌표기하, 그래프/도형 선택지·복합 도형)를 이 로드맵에서 완결.
12. **P3 13차 — 템플릿 2 삼각형·직각삼각형·합동/닮음**(관계형 스키마·표준형 배치·변/각/직각/높이/두 번째 삼각형·참조 lint·라벨 충돌), 공통 조판 `_layout.ts`. 로컬 E2E 통과. Preview 는 DB 게이트만 실측(UI 는 UAT 계정 필요).
11. **P3 12차 — 표준 렌더링 엔진 템플릿 1(평행선·횡단선·각)** 끝까지: AI 는 관계만(`parallel_transversal`), 렌더러가 좌표·호·라벨 자리(충돌 시 거부), 검증 계층 `checkFigure`(지문 참조·중복·충돌·잘림·방위 표현·레거시·alt) → `render_check` 저장, 공개 게이트(`20261365`: ok + 그림 해시 일치 + 미리보기 확인, 좌표형 geometry 공개 불가=재생성 필요, 업로드 alt 필수). 관리자 편집기: 렌더 미리보기 우선, JSON 접힘. 로컬 E2E(실제 모델) 통과.
10. **P3 11차** — 과제 발급 = 키워드별 개수·무작위(`20261364`), 학생 포털 문제 기록 v3 재구성, v3 과제 탭 역할 수정(답 선택·필기 불가 결함), 교재 목차 이름 = 현재 노출용 이름, 교사 해설 보기 전 형식, 그림 라벨 평문화, 렌더링 엔진 설계안.
9. **P3 10차** — 그림 SAT 지면 스타일(격자·화살표 축·원점 O·축 설명·각 호 표시), UAT 수정: 문제 화면 필기 레이어가 **클릭을 먹던 결함**(선택지·버튼 클릭 불가) 수정, 서술형 = 글 상자 타이핑, 연습장 제거, PDF T 상자 기본 크기(가로 2배·5줄), 수업 준비 `담을 수 있는 문제` 클릭 미리보기(지문·선택지·그림), **키워드 자동 문제 기본 캡 20**(`20261363`).

25. **P3 26차 — SAT Math 19개 기술 코드 전부 결정적 컴파일러로 전환**(AI 호출 0회, 2026-09-16~17): 식·함수 공통 엔진(A) 8종(`linear_equations_two_var`·`systems_linear`은 같은 엔진 재사용·`linear_inequalities`·`linear_equations_one_var`·`linear_functions`·`equivalent_expressions`·`nonlinear_equations_systems`·`nonlinear_functions`), 통계·확률 공통 엔진(B) 7종(`ratios_rates_units`·`percentages`·`one_variable_data`·`two_variable_data`·`probability`·`inference_margin_error`·`evaluating_statistical_claims`), 도형 공통 엔진(C) 4종(`area_volume`·`lines_angles_triangles`·`right_triangles_trigonometry`·`circles`). 해설 이중언어(`explanation`/`explanationEn`, DB 컬럼 `problem_versions.explanation_en`, 관리자 UI 토글)도 이 배치에서 완성. 커밋 `e3b687d`~`0428b05`(중간 UAT 수정 다수 포함, `git log` 참고). 다음: Preview UI UAT(로컬·non-prod DB 검증만 완료, 아직 Preview 화면 확인 안 됨).
26. **P3 27차 — R&W 5개 세부 기술에 얇은 근거 모델(Evidence Model) 추가**(2026-09-17, migration `20261403000000`): `words_in_context`·`central_ideas_details`·`inferences`·`command_of_evidence_text`·`cross_text_connections`에 구조화된 `target`/`evidence_span`/`answer_rationale`/`distractor_error_types` 필드를 기존 생성과 함께 산출, 저장 전 결정적 검사(지문 내 축어 일치 evidence_span + enum 검증)를 초안 채택 게이트로 추가, 관리자 화면에만 노출(학생·학부모는 안 보임). `cross_text_connections`의 `target`이 질문 재진술이 아니라 두 지문을 합성한 명제를 내도록 후속 수정. 커밋 `f106784`, `1e47505`. 다음: Preview UI UAT.
27. **P5 — 언어 전환 이전 문제 아카이브**(migration `20261402000000`): 문제 지문·질문·선택지가 영어로 통일되기 전 시기(한국어 혼용)의 기존 문제를 전부 보관 상태로 전환(`problems`/`problem_versions` 공개 후보에서 제외), 삭제 없음.

마이그레이션: `20261346`~`20261403`(전부 additive, 공유 non-prod 적용). 배치별 상세는 아카이브의 각 블록.

> 아래 28~30번은 `git log` 재구성(2026-09-23, 커밋 메시지 원문 기준 — 그 세션의 실시간 맥락은 없어 UAT 세부 스크린샷 등 부가 정보는 생략했다).

28. **학생 성공 플래너 Board(2026-09-21) + 컨설턴트 role/포털 Phase 1~2(2026-09-22, migration `20261444000000`~`20261459000000`)**:
    - `2de9d94` **Student Success Planner Board MVP**: 과제·모의고사·단어시험·수동 할 일을 한 보드(칸반)에서 관리하는 화면을 학생 포털에 신설 — 이후 컨설턴트 담당 학생 패널의 Board 탭이 이 컴포넌트를 그대로 재사용.
    - `24e2389`/`7422284`(docs) — 컨설턴트 인테이크 role 모델·관리자 핸드오프 설계 확정(`docs/superpowers/specs/2026-09-22-consultant-role-and-intake-design.md`).
    - `d3043dc` **컨설턴트 role/포털 Phase 1**: `consultations`에 `intake_owner_id`/`admissions_consultant_id`/`contacted_at` 추가, `assign_consultation_owner()`/`mark_consultation_contacted()` RPC로 배정·연락 상태를 감사 이력과 함께 변경. `manage_consultation_intake`/`manage_admissions_students` capability 도입. 관리자 "Consultants" 탭에 미배정 상담 요청 큐, 컨설턴트 포털에 "신규 배정" 화면 신설.
    - `e204f76`/`32ed1b2`/`4bfea5a` — 실제 UAT 컨설턴트 계정(이메일이 여러 번 바뀌며 재백필) role/capability 부여.
    - `b16dfe4` **컨설턴트별 가능시간**: 기존 회사 공용 가용시간 규칙을 컨설턴트 개인 단위로도 가능하게 확장(`consultant_id` nullable — null=공용, 값 있음=개인).
    - `05a6e96` **랜딩 폼 "신청만" + 컨설턴트 전용 스케줄링 링크**: 홈페이지 상담 신청에서 슬롯 선택 UI 제거(신청만 접수). 관리자가 어드미션 컨설턴트를 배정하면 "링크 보내기"로 서명된 스케줄링 링크(`/schedule/[token]`)를 수동 발송(자동 발송 아님, 실제 이메일 발송 지점이라 확인 게이트). 고객은 로그인 없이 배정된 컨설턴트의 개인 가능시간만 보고 직접 확정.
    - `c80ac70` **컨설턴트 전용 Google 로그인**: 캘린더 접근이 필요해 비밀번호 로그인이 아닌 Google 로그인 전용 계정 연결(선생님 콜백과 동일 패턴, 사전 등록 이메일만 최초 로그인 시 자동 연결).
    - `6637c51`/`a376aa4` — 스케줄링 이메일 CTA 버튼 스타일 적용, 확정 시 동의 버전 누락 버그 수정(기존 UAT 데이터 백필 포함).
    - `ee4a91e` **컨설턴트별 Calendar organizer + 자동배정**: 배정된 어드미션 컨설턴트가 있으면 그 사람의 실제 Google Workspace 계정을 Calendar/Meet organizer로 사용(R6 선생님별 패턴과 동일). 전역 자동배정 토글(관리자) + 컨설턴트 개인 "신규 배정 받기" 토글, 켜져 있으면 신청 접수 즉시 가용 컨설턴트 중 무작위 배정. `42addae`는 그 토글 RPC의 WHERE절 누락 버그 수정.

29. **컨설턴트 담당 학생 패널(Overview/Board/Roadmap) + 칸반화 + Board/Roadmap 공통 기능 확장**(2026-09-22, migration `20261460000000`~`20261463000000`):
    - `b53c431` **담당 학생 Overview/Board(수정 권한)/Roadmap 탭**: 로드맵만 보이던 학생 카드 클릭 화면을 세 서브탭으로 확장, Board는 컨설턴트가 학생 본인처럼 직접 할 일을 추가·이동·삭제 가능(RLS에 `is_assigned_consultant_of()` 반영). `a9e6387`은 두 탭이 같은 데이터를 중복 조회하던 성능 결함과 이름 중복 표기(예: "학생 학생") 정정.
    - `f53e088` **"신규 배정"을 칸반으로**: 컨설턴트 본인에게 배정된 상담 요청만 연락 필요/일정 조율 중/일정 확정 3칼럼 칸반으로 표시(관리자 화면은 반대로 전체 노출).
    - `a1790e6` **Board 개선**: 카드마다 마감일 항상 노출(수동 할 일은 시작~마감 기간 입력 가능), 작성자(선생님/컨설턴트/학생 본인/관리자) 표시, 학생·학부모 Board 아래에 예정 수업 리스트 추가.
    - `ced35f4` **로드맵 개선**: 저장 성공 배너, 수강과목을 개별 CRUD 가능한 리스트로 교체, "목표 설정" 서브서브탭(목표 GPA/SAT/AP 과목수/Extracurricular) 신설.
    - `602fdae` **프로필 IA 재구성 + 타임라인뷰**: 프로필을 요약/인구통계/학업정보/대학 관심사/활동·수상/준비 현황 서브서브탭으로 재편, Board에 보드/타임라인 전환 토글 추가(마감일 기준 월별 묶음).
    - `f356dc4` **간트 타임라인 + Board 구조 정리**: 타임라인뷰를 실제 간트 차트로 재작업, 학생 Home의 별도 "Done" 탭을 없애고 4칼럼 Board로 복귀(학부모 포털과 동일 구성), 학생 Home에 학부모와 동일한 "Review"(수업 리뷰) 탭 추가.
    - `224cee7` **학부모 Home 서브탭 정리**: 종합/수업/상담 리뷰를 "Review" 하나로 통합, "Done"을 별도 탭 대신 Board 안 칼럼으로 재통합, 모의고사를 좌측 독립 nav로 이동.

30. **로그인 화면 통합 — 역할별 버튼 3개 → "직원" 버튼 하나**(2026-09-22): `0349cdb` — 선생님/관리자/컨설턴트 개별 Google 로그인 버튼을 하나로 합치고, 첫 로그인 시 선생님→컨설턴트 순으로 사전 등록 여부를 확인해 자동 연결(재로그인은 기존 role로 바로 라우팅, 관리자 콜드 스타트는 미지원 — 기존 설계 유지). 개별 콜백 라우트는 삭제. `348a6b5`는 버튼 라벨을 "Staff - Google Login"으로 확정.

31. **컨설턴트 포털 — 가구/학생 메신저 + 개인 일정 잡기 + 교사 재조정 요청**(2026-09-22~23, migration `20261464000000`~`20261472000000`, non-prod 반영 완료):
    - **가구 메신저 컨설턴트 접근**: 담당 학생의 household 메신저(보호자↔컨설턴트)를 읽고 답장할 수 있게 함. `household_id_for_assigned_student()` SECURITY DEFINER RPC로 `household_members` 원본 행을 넓게 노출하지 않고 household_id만 반환하는 패턴 사용.
    - **학생↔컨설턴트 개인 메신저**를 신설(보호자와 별도 채널). 프로필/모의고사 열람 RLS도 담당 컨설턴트까지 확장(`is_assigned_consultant_of()`).
    - **학생-컨설턴트 개인 일정 잡기(신청→확정)**: 수업 예약과 같은 UI 패턴이되, 학생 개인 단위로 진행 가능(보호자 동반 불필요) — 컨설턴트가 요청을 확인하고 확정/변경/거절하는 request→confirm 흐름(수업 예약 자체의 즉시 확정 방식과는 분리해 새로 설계, 기존 예약 상태 머신은 건드리지 않음).
    - **선생님 수업 재조정 요청**: 기존 즉시 확정 예약 시스템(약 54개 연관 테스트)은 그대로 두고, 교사가 확정된 예약에 대해 변경을 요청하면 학생/보호자가 확인 후 확정·변경·거절할 수 있는 별도 레이어를 추가.
    - **버그 수정**(실사용 UAT로 발견): 컨설턴트 담당 학생 목록이 전부 "이름 없음"으로 뜨던 문제(프로필 가시성 RLS 누락), Overview/Board가 500으로 멈추던 문제(모의고사 권한 함수가 컨설턴트 관계를 모름), 일정 확정 시각이 신청 시각과 어긋나던 타임존 버그(`toISOString()`이 항상 UTC를 반환해 `datetime-local` input에 잘못 채워짐 — `lib/calendar-date-utils.ts`에 DST-안전 `zonedDateTimeToUtcIso()` 유틸 신설), 학생 쪽 "일정 잡기"가 배정된 컨설턴트가 있는데도 없다고 뜨던 RLS 누락.
    - **메신저 안읽음 배지**: 학생·컨설턴트 포털 데스크톱/모바일 내비에 실제 안읽음 수 배지 추가. 버그 수정 — 보호자가 보낸 메시지가 학생 쪽 배지에 안 잡히던 필터 누락.

32. **ESLint 실제 이슈 161개 전량 정리 + 죽은 기능 2건 삭제(사용자 승인)**(2026-09-23):
    - **근본 원인 2건**: (a) `.claude/worktrees/**`(다른 세션들의 전체 git worktree 사본, 각자 `.next` 빌드 산출물 포함)가 lint 대상에서 빠지지 않아 `npx eslint .`가 실제 161개가 아니라 766개로 부풀려 보고되고 있었음 — `eslint.config.mjs`에 ignore 패턴 추가. (b) 코드베이스 전반에 이미 퍼져 있던 "`_` 접두사로 의도적 미사용 표시" 관례를 ESLint 설정이 인식하지 못해, 그 관례를 따른 곳들까지 전부 에러로 잡히고 있었음(`no-unused-vars` 71개 중 23개) — `argsIgnorePattern`/`varsIgnorePattern: '^_'` 규칙 추가.
    - 나머지는 카테고리별 수작업 정리: 미사용 import·타입·함수·상수 삭제, 한국어 따옴표 `&ldquo;/&rdquo;` 치환(30건), `react/no-children-prop`(데이터 prop 이름이 우연히 `children`과 겹치던 곳을 JSX children 형태로 전환, 동작 동일), `exhaustive-deps` 실제 버그 1건 수정(관리자 통합 일정 화면이 시간대 비동기 로드 후 재계산 안 되던 문제), `set-state-in-effect` 28건(전부 "마운트 시 데이터 로드" 관용 패턴 확인 후 의도 명시), 렌더 중 `Date.now()`/ref 직접 조작 2건을 effect로 이동.
    - **기획 참고 — 기능 2건 완전 삭제(코드베이스에서 더 이상 존재하지 않음)**:
      1. **"제안서(Proposal)" 생성/발송 UI**(`ProposalSection`, admin `ConsultationTab`) — 2026-09-10 서브탭 재편으로 진입 경로 자체가 이미 없어졌던 채 방치돼 있던 기능. `제안서 생성 → 발송 → 학부모 수락/거절 관리자 기록` 흐름 전체와 백엔드 액션(`createProposal`/`sendProposal`/`respondToProposal`)을 삭제. **`proposals`/`proposal_subjects` DB 테이블 자체는 남아있음**(삭제하지 않음, 데이터 손실 없음). 이 기능이 다시 필요해지면 재설계가 필요함(코드 없음).
      2. **개인 이메일 기반 선생님/학부모 초대 폼**(`InviteForm`, admin `UsersTab`) — Google Workspace 프로비저닝(R2 Task 7)으로 이미 대체된 뒤 호출부 없이 방치돼 있던 폼. 삭제.
    - 검증: `tsc` 클린, `vitest run` 2530/2531 통과(1건은 무관한 기존 flaky), `npm run build` 성공, Preview 배포 확인.

마이그레이션(2026-09-14 배치): `20261346`~`20261403`. 이후 배치는 위 각 항목 참고, 최신은 `20261472000000`(1절 표 참고).

## 5. 검증 구분

- **자동 테스트(로컬 DB)**: 위 전부. 통합 — 부모 변경 반영 25, Drive 자료 15, 채점·재고정·과제·문제 필기·출처 분리·SPR·그림 게이트 21 등. 컴포넌트 — ProblemsPanel 32, ProblemBankTab 28, PDF 레이어 9, HomeworkTab 7, StudentHomeworkTab 3, CurriculumDocsTab 13, Drive 패널 6, 셸 18, figures 4, blocks 4.
- **실제 Drive·Preview·제품 오너 계정**: Drive 읽기 → 폴더 생성 → 가져오기 → 고정 사본 공개 → 카탈로그 편입 → 학생 회차 → 수업 준비 → 수업 시작 → PDF 렌더·필기 저장/복원 → 문제 슬라이드 → 객관식 채점.
- **실제 모델 호출**: 표본 10문항(로컬).
- **미확인**: 2026-09-14 야간 배치(P3 5차 이후)의 Preview UAT — 진행 중 / 두 계정 동시 필기·상대 레이어 지우개 / 영상 재생 / 모바일·iPad·Pencil / 원본 교체·재공개 후 필기 유지(RPC 테스트만) / 시험 데이터: 옛 과제 UI 답안(`session_homework_attempts`)은 옮기지 않음.

## 6. 미결·다음 작업 단위

- **College Board 커버리지 전수 매핑 완료 + Math SPR 아키텍처 결론(2026-09-17, 완료)**:
  `2026-09-17-collegeboard-coverage-map.md` — 실전 시험지 7종(test4·6·7·8·9·10·11)
  840문항(R&W 462 + Math 378) 전수 분류 완료(test5는 결번). **최종 결론**: "생성
  가능+결정론적 검증 있음" 331건(39.4%), 상위 스킬은 있으나 하위 패턴 불가 209건
  (24.9%), 생성 가능하나 검증 없음(R&W 위주) 273건(32.5%), 완전 불가 27건(3.2%).
  **화면 렌더링 검증은 840건 전부 미확인이었으나 2026-09-18 uat20260918로 4건
  (Math MC/SPR, R&W 근거모델/정량모델) 실제 학생·교사 세션까지 검증 완료**(아래
  참고). SPR은 특정 스킬 추가로 해결 안 됨 — `math-compilers/batch.ts`의
  `format="mc"` 고정 출력을 SPR 분기 가능하도록 재설계해야 하는 아키텍처
  작업(로드맵 Step 3, 아직 미착수). 완전 불가 갭 랭킹 1순위(산점도 회귀/최적선)는
  Step 4에서 이미 구현 완료.
- **문제은행 전수 감사 + 역할별/실사용자 UAT(2026-09-18, 완료)**: 활성(보관 안 된)
  160문항 전수 감사(`2026-09-18-problem-bank-full-audit.md`) → 결함 8건(원시
  LaTeX·빈 초안·내부 필드명 노출·완전 중복) 발견해 마이그레이션 `20261413000000`
  으로 보관 처리(non-prod 반영 완료). 관리자 역할 UAT(`2026-09-18-problem-bank-role-uat.md`)
  전부 PASS. 공개 문항이 0건이라 학생/교사 실사용 흐름은 별도로 Math MC·SPR,
  R&W 근거모델·정량모델 각 1문항씩 실제 공개해 `uat20260918`(정리 안 함, 회귀
  재현용으로 보존) 계정으로 실 세션 풀이·자동채점·교사 채점 확정까지 끝까지
  검증(`2026-09-18-real-student-teacher-uat.md`) — 전부 정상. 이 UAT에서
  `/student` 홈 500 에러(1절 참고)와 `ProblemLogTab.tsx`가 어떤 화면에서도
  import되지 않는 죽은 코드로 보인다는 점을 발견(둘 다 미수정, 판단만 보류).
- **고정형 SAT 모의고사 V1(정책 확정, 구현 대기 — 2026-09-17)**: 모의고사는 과제와
  별도 원본·응시 기록을 가진다. 수업 화면에 `모의고사` 탭을 추가해 교사가 배정하고 학생이
  시작·재개할 수 있으며, 학생 포털의 독립 모의고사 탭에서도 같은 응시를 연다. V1은
  기본·표준·상위 난이도의 고정 세트를 여러 개 운영하고 적응형 모듈은 V2로 미룬다. Math
  문제·과제·모의고사에는 공통 계산기와 ALTON용으로 재구성한 참조표를 제공하며 R&W에는
  보이지 않는다. 상세 사양: [`2026-09-17-fixed-mock-exam-v1-spec.md`](2026-09-17-fixed-mock-exam-v1-spec.md).

- **학부모 포털 IA 재구성 + 상담 신청·메신저(2026-09-17~18, 완료 — R12/R12.1 전체 반영, non-prod 배포·UAT 완료)**:
  - **메인 nav 최종 순서**: 홈 → 수업권 → 수강 과목 → 수업 → 상담 → 단어장 → 과제.
    **제거된 탭과 새 위치**: 가족(신규 자녀 상담 신청 흐름 자체를 폐기, `ConsultRequestTab.tsx`/
    `consult-request-actions.ts`/`consult-request-data.ts` 삭제 — 학부모는 이제 기존 자녀든
    신규든 상담 신청은 `상담 신청` 서브탭 하나로만 함) · 문의(구 `household_messages` 대화
    화면 → `상담` 탭의 `메신저` 서브탭으로 통합) · 예약(독립 탭 제거 → `수업` 탭 안
    "예정 수업 예약하기" 버튼으로 `LessonBookingTab`(학생 포털과 공유, 동작 변경 없음)을
    모달로 연다) · 교재(관리자 전용 라이브러리 탭 제거, 기존 세션·수강 과목 화면의
    `/materials/[id]` 진입점은 그대로 유지) · 독립 `통계` 탭(죽은 placeholder였음 →
    `홈`의 `통계` 서브탭으로 이동, 학생 포털 `stats-data.ts`의 `loadStats` 재사용).
    `지인 추천`(`CreditsTab`)·`동의`(`ConsentTab`)는 메인 nav에서 제거해 프로필
    드롭다운(학부모님 ▾) 메뉴로 이동 — `동의`는 자녀별 미해결 동의/정규 진행 선택
    건수를 숫자 배지로 표시.
  - **상담(`consult`) 탭**: 서브탭 3개 — `상담 신청`(`ConsultationRequestTab.tsx`, `상담
    사유` 단일 입력만, `submitMeetingRequest({ reason })`), `상담 내역`
    (`ConsultationHistoryTab.tsx`, 상태별 목록 + 완료 건의 확정 리뷰·미팅록 조건부
    노출), `메신저`(`MessengerTab.tsx`, 기존 그대로, 안읽음 배지). 상담 신청 내부
    메시지 스레드(`meeting_request_messages`)는 더 이상 UI로 노출하지 않음(테이블
    자체는 additive-only 원칙으로 유지, 대화는 메신저로만).
  - **스키마(R11 `meeting_requests`/`household_messages` 확장, 신규 테이블 만들지
    않음)**: `meeting_requests`(5단계 상태 requested→confirming→scheduling→
    scheduled→completed, cancelled는 레거시 조회용; content/contact_preference/
    preferred_contact_time; Calendar 동기화 컬럼 `google_event_id`/
    `google_meeting_code`/`google_sync_status`/`google_sync_retry_count`,
    `google_meet_link`는 R11부터 있던 컬럼), `meeting_request_reviews`(draft/final
    상태, `save_meeting_request_review_draft`/`finalize_meeting_request_review`
    RPC로만 씀), `meeting_request_review_edits`(확정 후 관리자 수정 시마다 이전
    `final_text`를 스냅샷 — `admin_edit_meeting_request_review` RPC가 원자적으로
    처리, `lesson_reviews`와 달리 이번 상담 리뷰는 확정 후 수정도 이력을 남기는
    것이 요구사항이었음), `meeting_request_review_drive_access`(미팅록 Drive 문서
    권한 부여 상태 `pending/granted/failed` — `status='granted'`일 때만 학부모에게
    링크 노출, `DRIVE_ARTIFACTS_ALLOW_REAL_WRITES` 게이트로 실제 Drive 호출 차단
    가능), `meeting_request_messages`(유지, UI 미노출), `household_message_reads`
    (메신저 안읽음 추적).
  - **RLS 요약**: `meeting_request_reviews`는 `status='final'`인 행만 그 household의
    guardian이 조회 가능(draft는 관리자만), 쓰기는 위 SECURITY DEFINER RPC로만
    허용(직접 insert/update 정책 없음 — `lesson_reviews` 패턴과 동일). `meeting_
    request_review_drive_access`는 관리자 전체 조회, guardian은 자기 household의
    확정된 리뷰에 연결된 행만 조회 가능(쓰기는 서비스 롤/서버 액션에서만). 다른
    household의 `meeting_requests`/리뷰/미팅록은 어느 화면에서도 조회 불가(Preview
    UAT에서 실제 두 household 계정으로 교차 열람 차단 확인).
  - **Calendar/Meet 연동**: 관리자가 `일정 확정`을 누르면(인라인 `datetime-local`
    입력, `window.prompt` 아님) `app/admin/inquiry-and-meeting-actions.ts`의
    `scheduleMeetingRequest()`가 (1) 시작/종료 시간 유효성(둘 다 필요, 종료>시작)
    검사 후 거부, (2) `google_event_id`가 이미 있으면 `patchCalendarEventTime`만
    호출(멱등, 재생성 안 함), 없으면 `createCalendarEventWithMeet` 호출, (3) Calendar
    API 호출이 실패하면 DB를 전혀 쓰지 않아 상태가 조용히 `scheduled`로 넘어가지
    않는다. 참석자 이메일은 `profiles`가 아니라(email 컬럼 없음) `auth.admin.
    getUserById()`로 조회(기존 `consultation-kanban-actions.ts` 패턴과 동일).
    관리자 리뷰 UI(`MeetingRequestReviewPanel.tsx` + `meeting-request-review-
    actions.ts`)는 완료된 상담에 draft 저장/확정/확정 후 수정 버튼을 제공하고,
    미팅록 Drive 문서 연결 시 `grantSmartNotesReaderPermission`(세션 Smart Notes와
    동일 헬퍼)으로 그 household 보호자에게 reader 권한 부여를 시도한다.
  - **홈(`activeTab==="home"`) 재설계**: 서브탭 4개 — `종합 리뷰`(수업/상담 리뷰를
    합친 목록이 **아니다** — 향후 AI OS가 월 단위로 생성할 "월간 종합 리뷰" 전용
    빈 자리, 이번 범위에서는 생성 로직·데이터 모델 없이 "아직 생성된 월간 종합
    리뷰가 없습니다. 준비 중입니다." 정적 문구만), `수업 리뷰`(`lesson-review-
    family-actions.ts`의 `getLessonReviewsForFamily`를 자녀의 모든 수강 과목에
    병렬 호출해 합친 것 — 확정 리뷰+확정 미팅록이 있는 것만, 시간순), `상담
    리뷰`(`home-reviews-actions.ts`의 `getHomeConsultationReviews` — household
    범위 확정된 `meeting_request_reviews`만, 최신순, 미팅록 없으면 "미팅록이
    없습니다."만 표시), `통계`(`home-stats-actions.ts`가 학생 포털 `stats-data.ts`
    의 `loadStats` 재사용). 상단 동의 배너(구 `ChildrenStatusRow`)와 캘린더·예정
    수업(구 `HomeDashboard` 사용)은 제거 — 동의 긴급도는 프로필 드롭다운 배지로만.
  - **마이그레이션·배포**: `supabase/migrations/20261406000000`(R12 V1)~
    `20261412000000`(스마트노트 권한 상태 조회 함수) 전부 non-prod(`worpsqwqgnspddnrtnvq`)
    반영 완료(`migration list --linked` local=remote 확인). 최신 Preview:
    **https://alton-ilrqy8v1j-alton7.vercel.app**(커밋 `e5b1042`).
  - **Preview UAT 실제 확인(2026-09-18, 실행 ID `r13-0918c`, 정리 완료)**: 태그된
    household 2개 + 관리자 계정으로 상담 신청 제출→관리자 일정 확정(실제 Calendar
    이벤트+Meet 링크 생성, `google_event_id`/`google_sync_status='succeeded'` DB
    확인)→완료 처리→리뷰 draft→확정→학부모 계정으로 홈 `상담 리뷰`·`상담 내역`
    양쪽에서 확정 리뷰 실제 열람 확인→다른 household 계정으로는 전혀 보이지 않음
    확인. UAT로 만든 DB 데이터·Auth 계정·실제 생성된 Calendar 이벤트(`v7rjj2epr9g4
    csroidibopjm1c`) 전부 삭제 확인 완료(재조회 시 `status="cancelled"`).
  - **남은 blocker**:
    (a) **미팅록 Drive 원본 링크 실제 클릭 검증 미완료** — `DRIVE_ARTIFACTS_ALLOW_
    REAL_WRITES`가 다른 Drive 쓰기 경로(Smart Notes 등)에도 영향을 주는 공유
    플래그라 이번 UAT에서는 켜지 않았다(게이트가 의도대로 차단하는 것만 확인).
    추후 별도 Sandbox 검증 창에서 이 플래그를 제한적으로 켜고 실제 권한 부여→
    학부모 계정으로 클릭 가능 여부까지 확인 필요.
    (b) `supabase/migrations/20261413000000_p6_problem_bank_full_audit_archive.sql`
    (문제은행 감사, 이 milestone과 무관한 다른 담당 소유)이 아직 non-prod에
    미반영 — 최종 통합 시 마이그레이션 적용 순서만 함께 검토 필요(이 파일 자체는
    수정하지 않았음).

- **예약·수업 준비·진도 단일 흐름(2026-09-17, 완료)**: 예약 확정 시 다음 미완료 회차
  (`curriculum_overlay_units.status`)를 자동 연결하고 그 시점 교재·문제·키워드를
  세션 전용 사본으로 즉시 복사(`_stage_unit_for_session`, 기존 P2 자동연결 트리거
  `auto_link_next_unit_to_session` 확장 — 이전에는 연결 기록만 남기고 구성을 복사하지
  않아 "연동됐지만 교재는 비어있음" 결함이 있었다). 정상 완료 시 회차를 진도상
  completed로 전진(`finalize_lesson_session`). 체험/정규 동일 코드 경로(`confirm_lesson_booking`
  →`sessions` insert→같은 트리거). 마이그레이션 `20261390`~`20261393`(재조정 가드,
  회차 연결 시 자동 상속, 자동배정+진도전진, `session_drive_tasks` RLS) 비프로덕션
  반영 완료. 실제 화면 데이터 로더(`loadPlannedMaterialData`/`unit_preview_for_viewer`/
  `loadSessionSelection`/`loadLessonBookingData`) 직접 호출로 학생·학부모·교사 화면
  단위 검증 완료(`lib/booking/curriculum-unit-screen-verification.integration.test.ts`).
  **주의**: 이 자동화는 이 시점 이후 새로 확정되는 예약부터만 적용된다. **2026-09-17
  이전에 만들어진 세션(회차가 비었거나 "아직 배정된 교재가 없습니다"로 보이는 것들)
  은 소급 보정하지 않았다** — 옛 수동 연결 방식으로 만들어졌기 때문이며, 확인하려면
  같은 학생·과목으로 새 예약을 하나 만들어 자동 연결·구성 복사가 되는지 보면 된다.
  체험 전용 커리큘럼(체험 관리 과목 + 1회차)은 코드 경로만 준비돼 있고, 실제 과목·
  회차 콘텐츠는 관리자가 아직 만들어야 한다. 과제는 이 자동 구성에서 의도적으로
  제외(정책 확정: 예약만으로 자동 발급하지 않음 — 회차에 기본 과제 계획/추천 문제
  구성은 둘 수 있으나 실제 발급은 교사가 명시적으로 함, 필요 시 회차별 자동 발급
  규칙은 별도 설계).
- **지금**: 제품 오너 Preview UAT(문제은행 AI 생성 → 그림 확인 → 전체 공개 → 수업 준비에 담기 → SPR 풀이·채점 / 과제 발급·풀이 / 문제 위 필기 / 관리자 교재 탭).
- **분류 후속 UI(criteria `skill_codes` 일괄 편집)는 2026-09-17 제품 오너 지시로 폐기** — 스펙이 백로그 한 줄뿐이고 대상·진입화면·권한이 전혀 정해지지 않아 로드맵에서 제외.
- **신규 — SAT Math 19종 + R&W 근거모델 5종 Preview UAT 필요(2026-09-17)**: 위 25·26차 작업은 로컬 테스트·non-prod DB 배치 검증만 마쳤고 실제 Preview 화면으로는 한 번도 확인되지 않았다. 다음 세션에서 관리자 문제은행 화면 기준으로 19개 Math 기술 코드 전부(생성→그림/렌더 확인→공개)와 R&W 5개 근거모델 기술(생성→근거모델 필드 표시·검사 통과 확인→공개)을 한 번씩 Preview UI로 통과시키는 전수 UAT가 필요.
- **단어장(2026-09-15~16, 완료 — 최종 8권 구성)**: ALTON SAT 공용 단어장. 원래 10권 계획 중 8·9·10권(추상·개념/저빈도 정밀/최상급)은 후보 어휘 풀이 좁아 중복률이 급증해 각각 200개를 못 채웠다(제품 오너 지시로 세 권의 목표를 8권 하나로 병합, `scripts/vocab-library-seed.ts`의 `VOLUME_PLAN`에서 9·10권 제거·8권 난이도 3~5로 확장). **1~8권 전부 완료(1,800단어)**, 마이그레이션 `20261378`+`20261383`+`20261384` non-prod 반영 완료. 내 단어장 폴더(기본 "오답 노트"), 별표 저장, 시험 선택지 영어화, UI 개편(가리기 개별 공개·A-Z 필터·랜덤 순서·페이지네이션) 전부 구현·테스트·Preview 배포 완료(마이그레이션 `20261376`~`20261380`). 기존 지문 클릭 저장(`VocabClickLayer.tsx`)은 손대지 않음.
- **과제(2026-09-16, 완료, 제품 오너 2차 정정 최종안)**: 과제를 수업(세션)과 완전히 분리 — 발급 시 수업 선택 없음, 배치명 = 발급 날짜, 발급할 때마다 새 배치(`homework_batches`, 단어장 `vocab_quizzes`와 같은 패턴: 세션 비의존 자기완결 레코드). 교사↔학생 쌍 단위로만 저장·노출(RLS + 쿼리 이중 격리, 다른 교사·다른 학생 노출 불가). 학생 포털 과제 탭·교사 포털 "과제 내역"·세션뷰 과제 탭 전부 동일한 공통 컴포넌트(`HomeworkBatchPanel`)로 배치를 눌러 열면 기존 목차/슬라이드 UI 그대로 정답·해설·채점. RPC `issue_homework_batch_v2`(마이그레이션 `20261382`, non-prod 반영 완료). **마이그레이션 `20261381`(`issue_homework_batch`, 회차 연동 1차안)은 이 최종안으로 대체되어 앱에서 더 이상 호출되지 않음 — DB 컬럼/RPC는 삭제하지 않고 방치.** 검증: 통합 테스트 6/6(발급 권한·배치 분리·문제 중복 방지·RLS 격리), 컴포넌트 테스트 전부 통과.
- **SAT Math 생성 품질(2026-09-16, 1단계 완료 + 실측 파일럿 완료)**: 코드 검토([`2026-09-16-sat-math-generation-code-review-and-proposal.md`](2026-09-16-sat-math-generation-code-review-and-proposal.md))에서 지목한 A(검사·저장 문항 분리)/B(필수 검사 미실행이 통과 처리)/C(해설 따라 정답 자동 변경)/G(오답 수정 후 재검증 누락) 결함을 Math 한정으로 수정·모의 검증(`lib/problem-generation/pipeline.test.ts`). R&W는 기존 동작 유지. **실측 파일럿(2026-09-16, `scripts/problem-quality-pilot.ts`, 승인된 소액 예산)**: 5개 유형×5문항 실제 API 호출 → 22/25 저장(88%), 총 $1.55(문항당 $0.07). 실패는 대부분 "정답-해설 불일치라 자동 정정 안 함" 정책이 정상 작동한 케이스. 저장은 admin 문제은행에 초안까지만 — 공개는 관리자 확인 후. **미완료**: 계산 기반 검증 확장(좌표평면·연립방정식 target 명시화 등, 검토 문서 3~4절), 유형 확대 배치(남은 예산 $28.45), Preview 로그인 확인(테스트 계정 없어 미실시).
- **Smart Notes 학생 열람 정책 반전(2026-09-16, 제품 오너 지시)**: 기존 정책("고객에게 원본을 직접 보여주지 않는다", `20261025000000`)을 뒤집어 **정규 수업(계정 생성 이후)에 한해 학생·보호자가 회의록 원본을 열람(view-only)** 할 수 있게 함(마이그레이션 `20261388`). 첫 상담(consultations)은 계속 관리자 전용 — 이 반전 대상이 아님. `session_smart_notes`에 학생·보호자 SELECT RLS 추가, 실제 Drive 문서 reader 권한 부여는 기존 `session_drive_tasks` 큐(`DRIVE_ARTIFACTS_ALLOW_REAL_WRITES` 게이트 재사용)로 비동기 처리(`grantSmartNotesReaderPermission`). **주의**: 이 웹훅(`app/api/webhooks/workspace-events/route.ts`)은 아직 실제 Pub/Sub 구독이 없어(코드 상단 주석 참고) 실제 트래픽으로 발동한 적이 없다 — 큐에 넣는 로직만 완성, 실제 동작은 구독 생성 후 확인 필요. **미완료**: 학생/보호자 포털에 "미팅록 보기" 링크 UI(백엔드 권한만 구현), 동의서 정책 갱신(제품 오너가 계약 문안은 직접 수정 예정 — 콘센트 UI 구조는 아직 손대지 않음), 수업 리뷰 화면 자체의 재설계(5단계 버튼+선택적 텍스트, 교사 본인 리뷰 열람, AI 요약 제거)는 별도 착수 필요.
- 미결(제품 오너): 학생이 푼 것 실시간 배지 / 선택지 자체가 그래프 4개인 문항(선택지 figure) / 이미지가 있는 문항의 AI 생성(현재 AI는 데이터 도형만) / 기한·알림·AI 과제 생성(후속).
- 다듬을 것: ~~`CompositionPanel` 전체 새로고침~~ ~~PDF 교재 행 키워드 이름~~ ~~SessionShell·ProblemBankTab lint 오류~~(완료 2026-09-15). 열린 항목: 통합 테스트 병렬 격리(예약 fixture·append-only 전역 count — 테스트 인프라 결함, 제품 결함 아님) / `session_homework_attempts`는 삭제·마이그레이션 없이 읽기 전용 보존, 보존·삭제 정책은 v3 과제 흐름 안정화 뒤 별도 결정.
- 오픈 전 blocker(변화 없음, 아카이브 참고): 실제 세금 계산, 실제 이메일 발송, Workspace 위임 계정 분리, SECURITY DEFINER anon 권한 감사, E2E 전용 fixture, `mark_expired_invites` cron.

## 7. 관련 문서
- **표준 렌더링 엔진**(승인됨, 템플릿 1 구현): `docs/2026-09-14-standard-rendering-engine-design.md` + 표본 `docs/assets/2026-09-14-render-samples/`. AI=의미 데이터만, ALTON 렌더러=조판, 검증 계층=거부. 좌표형 `geometry` 는 레거시(표시만, 공개 불가). 템플릿 1~7 완료(평행선·삼각형·좌표평면·표/데이터·원·사각형/다각형·입체) + 분류 모델. 다음: 좌표기하·복합 도형 → 그래프/도형 선택지 → 수식·로마숫자 선택지 Block.

- **남은 작업 전체 목록**: [`2026-09-14-remaining-work.md`](2026-09-14-remaining-work.md)(A 지금 UAT → B 콘텐츠·수업 → C 상담·결제·정산·문서 → D 운영·소통 → E 보안·데이터 수명 → F 출시 게이트).
- 문제 템플릿 설계: [`2026-09-14-problem-template-design.md`](2026-09-14-problem-template-design.md) · 과제 통일: [`2026-09-14-homework-v3-unification.md`](2026-09-14-homework-v3-unification.md) · 문제 풀이·채점·PDF 텍스트: [`2026-09-14-problem-answer-grading-and-pdf-text-notes.md`](2026-09-14-problem-answer-grading-and-pdf-text-notes.md) · Drive 자료 설계: [`2026-09-14-drive-material-assets-design.md`](2026-09-14-drive-material-assets-design.md) · PDF 규격: [`2026-09-14-lesson-pdf-spec.md`](2026-09-14-lesson-pdf-spec.md) · 로드맵: [`2026-08-29-master-roadmap-v3.md`](2026-08-29-master-roadmap-v3.md) · 이전 이력 전체: [`history/CURRENT-archive-until-2026-09-14.md`](history/CURRENT-archive-until-2026-09-14.md).
