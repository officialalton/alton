# ALTON — 현재 상태 (2026-09-14 기준)

> 새 세션은 이 문서만 읽고 시작한다. 그 이전 상세 이력(2026-08-29 ~ 2026-09-14 낮)은
> [`history/CURRENT-archive-until-2026-09-14.md`](history/CURRENT-archive-until-2026-09-14.md)에 원문 그대로 있다 — 필요할 때만 검색한다.

## 1. 한눈에

| 항목 | 값 |
|---|---|
| 브랜치 / Preview | `preview/m4-integration-verification` / **https://alton-czrtormc2-alton7.vercel.app** (커밋 `f52865c` 시점) |
| 공유 non-prod(`worpsqwqgnspddnrtnvq`) | 마이그레이션 **`20261362000000`까지 적용됨**(local = remote) |
| Production | 배포·마이그레이션 없음(오픈 전, 실제 고객 데이터 없음) |
| 테스트 | 마지막 전체 일괄 실행 2596/1 skip(`63d1189`, `db reset` 직후). 그 뒤 배치들은 **파일별 스위트 전부 초록**(전체 일괄 재실행 미실시). 통합 테스트는 `supabase db reset --local` 직후 `--no-file-parallelism`으로 돌려야 한다(예약 fixture 충돌·append-only 전역 count 는 재실행 시 실패 — 결함 아님) |
| 실제 외부 연동 | 교재 Drive `ALTON Company Tutoring Resources`(id `0AKnx7roQfcSaUk9PVA`) 읽기·폴더 생성·파일 가져오기·고정 사본 공개 확인. Preview 환경변수 `CURRICULUM_DRIVE_ENABLED/ID/ALLOW_REAL_WRITES=true`(제품 오너 설정). AI 생성은 Anthropic 키(Preview·로컬 있음). 유료 서비스 추가 없음 |
| 상태 | **제품 오너 Preview UAT 진행 중**(2026-09-14 야간 배치 전체) |

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

마이그레이션: `20261346`~`20261368`(전부 additive, 공유 non-prod 적용). 배치별 상세는 아카이브의 각 블록.

## 5. 검증 구분

- **자동 테스트(로컬 DB)**: 위 전부. 통합 — 부모 변경 반영 25, Drive 자료 15, 채점·재고정·과제·문제 필기·출처 분리·SPR·그림 게이트 21 등. 컴포넌트 — ProblemsPanel 32, ProblemBankTab 28, PDF 레이어 9, HomeworkTab 7, StudentHomeworkTab 3, CurriculumDocsTab 13, Drive 패널 6, 셸 18, figures 4, blocks 4.
- **실제 Drive·Preview·제품 오너 계정**: Drive 읽기 → 폴더 생성 → 가져오기 → 고정 사본 공개 → 카탈로그 편입 → 학생 회차 → 수업 준비 → 수업 시작 → PDF 렌더·필기 저장/복원 → 문제 슬라이드 → 객관식 채점.
- **실제 모델 호출**: 표본 10문항(로컬).
- **미확인**: 2026-09-14 야간 배치(P3 5차 이후)의 Preview UAT — 진행 중 / 두 계정 동시 필기·상대 레이어 지우개 / 영상 재생 / 모바일·iPad·Pencil / 원본 교체·재공개 후 필기 유지(RPC 테스트만) / 시험 데이터: 옛 과제 UI 답안(`session_homework_attempts`)은 옮기지 않음.

## 6. 미결·다음 작업 단위

- **지금**: 제품 오너 Preview UAT(문제은행 AI 생성 → 그림 확인 → 전체 공개 → 수업 준비에 담기 → SPR 풀이·채점 / 과제 발급·풀이 / 문제 위 필기 / 관리자 교재 탭).
- 미결(제품 오너): 학생이 푼 것 실시간 배지 / 선택지 자체가 그래프 4개인 문항(선택지 figure) / 이미지가 있는 문항의 AI 생성(현재 AI는 데이터 도형만) / 기한·알림·AI 과제 생성(후속).
- 다듬을 것: `CompositionPanel` 변경마다 `window.location.reload()` / PDF 교재 행 키워드 이름 / `SessionShell`(7)·`ProblemBankTab`(1) 기존 lint 오류 / 통합 테스트 병렬 격리(예약 fixture, append-only 전역 count).
- 오픈 전 blocker(변화 없음, 아카이브 참고): 실제 세금 계산, 실제 이메일 발송, Workspace 위임 계정 분리, SECURITY DEFINER anon 권한 감사, E2E 전용 fixture, `mark_expired_invites` cron.

## 7. 관련 문서
- **표준 렌더링 엔진**(승인됨, 템플릿 1 구현): `docs/2026-09-14-standard-rendering-engine-design.md` + 표본 `docs/assets/2026-09-14-render-samples/`. AI=의미 데이터만, ALTON 렌더러=조판, 검증 계층=거부. 좌표형 `geometry` 는 레거시(표시만, 공개 불가). 템플릿 1~7 완료(평행선·삼각형·좌표평면·표/데이터·원·사각형/다각형·입체) + 분류 모델. 다음: 좌표기하·복합 도형 → 그래프/도형 선택지 → 수식·로마숫자 선택지 Block.

- **남은 작업 전체 목록**: [`2026-09-14-remaining-work.md`](2026-09-14-remaining-work.md)(A 지금 UAT → B 콘텐츠·수업 → C 상담·결제·정산·문서 → D 운영·소통 → E 보안·데이터 수명 → F 출시 게이트).
- 문제 템플릿 설계: [`2026-09-14-problem-template-design.md`](2026-09-14-problem-template-design.md) · 과제 통일: [`2026-09-14-homework-v3-unification.md`](2026-09-14-homework-v3-unification.md) · 문제 풀이·채점·PDF 텍스트: [`2026-09-14-problem-answer-grading-and-pdf-text-notes.md`](2026-09-14-problem-answer-grading-and-pdf-text-notes.md) · Drive 자료 설계: [`2026-09-14-drive-material-assets-design.md`](2026-09-14-drive-material-assets-design.md) · PDF 규격: [`2026-09-14-lesson-pdf-spec.md`](2026-09-14-lesson-pdf-spec.md) · 로드맵: [`2026-08-29-master-roadmap-v3.md`](2026-08-29-master-roadmap-v3.md) · 이전 이력 전체: [`history/CURRENT-archive-until-2026-09-14.md`](history/CURRENT-archive-until-2026-09-14.md).
