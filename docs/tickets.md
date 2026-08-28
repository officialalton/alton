# Alton Education — 개발 티켓 목록

우선순위: **고객(학생/학부모)이 실제로 보는 화면**을 먼저 실물로 만들고, 관리자 도구는 "굴러가는 수준"으로 먼저 만든 뒤 나중에 다듬는다.

각 티켓은 Claude Code 세션 1회에 1~3개씩 처리하는 것을 기준으로 잘라놓았다. 진행하면서 체크(`[x]`)하고, 세션 끝날 때 이 파일도 함께 커밋한다.

---

## Phase 0 — 기반 (건너뛸 수 없음)

- [ ] **000-project-init**: Next.js + TypeScript + Tailwind + Supabase 프로젝트 초기화, Vercel 연결, 목업 CSS 변수 → Tailwind 테마 이식 (Vercel 연결만 남음 — 로그인이 필요해 사람이 직접 해야 함)
- [x] **001-schema-design**: 목업 파일 전체를 검토해 DB 스키마 초안 작성 (사람 검토 완료, `docs/spec/schema-draft.md` 참고)
- [x] **002-schema-migrate**: 001에서 승인된 스키마로 Supabase 마이그레이션 작성 + 시드 데이터 (Docker 로컬 검증 완료, 호스팅된 프로젝트에도 push 완료. 개발용 시드 데이터는 로컬 전용이라 실제 프로젝트엔 안 넣음)
- [x] **003-auth-roles**: 로그인(학생/학부모/선생님/관리자), 역할 기반 라우팅. 목업의 `?role=` URL 파라미터 흉내를 실제 세션 기반으로 대체 (로컬 Supabase로 로그인/역할 리다이렉트/미들웨어 차단/실제 이메일 비밀번호 재설정까지 전부 브라우저로 실제 테스트함)

## Phase 1 — 수업 세션뷰 (가장 중요, 고객이 매번 보는 화면)

- [x] **010-session-shell**: 세션뷰 레이아웃, 상단바(세션 상태바: 준비중/진행중/완료), 역할별 권한 분기 — `alton_material_viewer_prototype.html` 참조 (목업 대비 개선: 탭을 `?tab=` URL로 관리해 새로고침/공유 가능하게 함, 상태를 30초마다 재계산해 자동 전환, 뷰어를 student/teacher/parent/admin 4종으로 확장, 로컬 DB 실데이터로 prep/live/completed 전부 검증)
- [ ] **011-session-material-tab**: 교재 탭 — TOC 네비게이션 + 아티클 렌더링 + 스크롤스파이
- [ ] **012-session-canvas**: 캔버스 필기 (펜/색상/지우기, 스크롤 콘텐츠 위 오버레이)
- [ ] **013-session-vocab**: 단어장 — 단어 클릭 선택 + AI 뜻풀이 생성, 학생 포털의 "단어장" 탭과 데이터 공유
- [ ] **014-session-homework**: 과제 탭 — 학생 인라인 답안 작성, 선생님 과제 추가
- [ ] **015-session-aigen**: 문제 생성 (선생님 전용) — 조건 선택 → AI 생성 → 편집 가능한 초안 → 재생성 → "과제로 확정"
- [ ] **016-session-scratchpad**: 연습장 — Docs/화이트보드 서브탭, 화이트보드 스크롤 가능
- [ ] **017-session-problemlog**: 문제 기록 — 풀이 이력, 필터(과목/단원/정답여부/저장)

## Phase 2 — 학생 포털

- [ ] **020-student-shell**: 사이드바, 홈 대시보드
- [ ] **021-student-lessons**: 레슨(예정/지난 수업), 커리큘럼 뷰
- [ ] **022-student-teacher-tab**: 선생님 탭(별도 최상위), 프로필, 메시지
- [ ] **023-student-materials-library**: 교재 탭 — 수강 과목 한정, **레이어 분리 주의**(세션뷰 아님, 순수 교재 뷰)
- [ ] **024-student-credits**: 수업권 현황

## Phase 3 — 학부모 포털

- [ ] **030-parent-shell**: 자녀 전환, 대시보드
- [ ] **031-parent-lessons-records**: 지난 수업 기록 열람 (세션뷰 읽기전용 접근)
- [ ] **032-parent-credits-billing**: 수업권/결제 현황

## Phase 4 — 선생님 포털

- [ ] **040-teacher-shell**: 사이드바, 스케줄
- [ ] **041-teacher-schedule**: 예정/지난 수업, 수업 준비/진행 → 세션뷰 진입
- [ ] **042-teacher-roster-curriculum**: 학생 로스터, 커리큘럼 편집 (회차 클릭 → 세션뷰)
- [ ] **043-teacher-review**: 수업 리뷰 작성 (카테고리별 AI 초안 + 검토완료 체크)

## Phase 5 — 관리자 포털 (첫 런칭엔 러프해도 됨, 나중 다듬기)

- [ ] **050-admin-shell**: 사이드바, 대시보드
- [ ] **051-admin-subject-template**: 과목 템플릿 CRUD (다른 화면의 선택지 소스)
- [ ] **052-admin-curriculum-doc-editor**: 교재 편집기 — WYSIWYG(contenteditable), 문제 생성(AI) 연동
- [ ] **053-admin-material-library**: 교재 라이브러리 (과목→단원→교재 폴더 탐색)
- [ ] **054-admin-users-billing**: 학생/선생님 계정 관리, 수업권 조정

## Phase 6 — AI 실연동

- [ ] **060-ai-integration**: 목업에서 `setTimeout`으로 흉내낸 AI 호출(문제생성, 단어 뜻풀이, 리뷰 초안)을 실제 Claude API 호출로 교체

## Phase 7 — 외부 서비스 연동

- [ ] **070-calendly**: 상담/수업 예약 임베드
- [ ] **071-stripe**: 수업권 결제
- [ ] **072-docusign**: 계약서 서명
- [ ] **073-kakao-email-notify**: 학부모 알림 (Kakao Alimtalk 우선, 이메일 폴백)
- [ ] **074-wise-payout**: 선생님 KRW 정산 (자동계산 + 사람 승인)

## Phase 8 — 통합 테스트 및 파일럿 준비

- [ ] **080-e2e-critical-paths**: 핵심 플로우 E2E (상담예약→계약→결제→매칭→수업→리뷰)
- [ ] **081-pilot-readiness**: 20명 파일럿 기준 버그바운스, 접근성 점검
