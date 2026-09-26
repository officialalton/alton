# 2026-09-18 — 문제은행 역할별 UAT (통합 Preview)

## 배경

기획자 3단계 계획 중 3단계: 병렬 세션들(부모/교사 포털 작업)을 하나의 통합 Preview로
합치고, 이번 세션 담당 범위(문제은행/Math/R&W 생성)에 대해서만 역할별 UAT를 수행한다.
부모/교사 포털 자체의 신규 기능은 이 UAT 범위가 아니다.

## Preview 배포

- HEAD: `db818b3` (브랜치 `preview/m4-integration-verification`, origin 대비 19 커밋 앞섬 — 다른 세션들의 부모/교사 포털 커밋 포함, 정상)
- 배포: `vercel deploy --target=preview --yes --scope alton7`
- URL: https://alton-7sfby1ror-alton7.vercel.app
- `vercel inspect` 결과 `target: preview` 확인

## 관리자(Admin) 역할 UAT — PASS

로그인: `admin-uat-20260917@alton.education`

- 문제은행 탭 구조: 생성 / 검수 / 공개 / 보관 순서 정상 렌더링.
- 검수 탭 전체 필터에서 활성 문항 152개 확인(SAT Math 100 + SAT R&W 52, 이전 전수 감사 결과와 일치).
- 공개 탭: 공개된 문제 0개 확인 — 2026-09-17 전수 감사에서 확인된 문제(공개본 전량 보관 처리)와 일치.
- 과목/영역/기술 드롭다운이 선택한 과목에 따라 동적으로 좁혀짐 확인(하드코딩 아님).
- 문항 유형 필터(전체/객관식/서술형/풀이형) 동작 확인 — SAT Math 필터 시 전체 100개 중 객관식 91개로 정확히 좁혀짐.
- 개별 문항 열람 검증(검수 탭, 읽기 전용 뷰):
  - **Math SPR** — "2x - 2 = -x - 14" 선형방정식 문제: 지문/질문, 정답, 해설(한국어/English 토글) 정상 렌더링.
  - **R&W Command of Evidence(근거 모델)** — 조류 연구 지문 문제: 지문, 질문, 4지선다 선택지, 정답 표시, 해설 정상 렌더링. "내부 검토용 — 학생 비공개(근거 모델)" 접이식 블록을 펼쳐 대상/근거 인용/근거→정답 논리/오답 유형 라벨(CONTRADICTS_CLAIM 등)까지 정상 노출 확인 — 커밋 `dce6433`의 Step-6-gate 수정이 Preview에 정상 반영됨.
- 발견된 버그: 없음.

## 학생(Student) 역할 UAT — 코드 경로 검증만 가능, 실사용 흐름은 차단

- 공개 탭에 공개된 문제가 0개이므로, 실제 학생 로그인 후 세션뷰에서 문제를 푸는 라이브 클릭 테스트는 수행 불가.
- 대신 코드 경로를 확인: 학생용 문제 풀이 화면은 `app/session/[id]/ProblemsPanel.tsx` + `app/session/[id]/session-problem-data.ts`이며, "공개 여부"는 `problems.status='published'` 문자열이 아니라 `problems.published_version_id` → `problem_versions.status='published'` 조인으로 판정됨.
- 관리자 검수 화면의 "학생용 미리보기" 라벨은 `app/admin/ProblemDraftEditor.tsx`의 `PublishedContentView`가 렌더링하며, `ProblemFigure`/`RwStimulusView`/`LearningText` 등 학생 패널과 동일한 저수준 렌더링 컴포넌트를 재사용한다. 하지만 이는 정답·해설을 제출 없이 한 블록에 같이 보여주는 읽기 전용 뷰이며, 실제 학생 패널의 제출/채점/워크보드/실시간 상태/이슈 발급 로직은 전혀 거치지 않는다. **따라서 관리자 미리보기 통과가 실제 학생 세션 UAT의 대체물이 될 수 없다.**
- **열린 결정 (제품 책임자 확인 필요)**: Math MC / Math SPR / R&W 근거 모델 / R&W 문법 모델 각 계열에서 최소 1문항씩 실제로 "공개"하여, 진짜 학생 세션에서의 풀이·제출·채점 흐름과 교사의 `ProblemLogTab` 정답/해설 노출을 검증할 수 있게 할지 여부. 이 세션에서는 임의로 공개 처리하지 않았다.

## 교사(Teacher) 역할 UAT — 코드 경로 검증만, 실데이터 없음

- 교사용 문제 뷰는 동일한 `app/session/[id]/` 라우트 계열에서 `viewerRole === "teacher"`로 분기되는 `app/session/[id]/ProblemLogTab.tsx`이며, 풀이 완료된 문제의 `entry.explanation`/정답을 읽기 전용으로 보여줌.
- `app/teacher/review/[sessionId]/TeacherReviewPanel.tsx`는 수업 리뷰 노트용이며 문제 렌더링과 무관 — 혼동 주의.
- 공개된 문제가 없어 실제 세션 데이터로 교사 화면을 클릭 테스트하지 못함. `app/teacher/` 파일은 다른 세션 소유 범위이므로 코드 확인만 하고 수정하지 않음.

## 자동 테스트

`npx vitest run app/admin lib/problem-generation`

- 138 passed / 1 failed / 1 skipped (1129 tests passed, 1 failed)
- 실패: `app/admin/trial-sessions-guardian-consent.integration.test.ts` (보호자 동의 체험 세션 트리거) — 문제은행/Math/R&W 범위 밖이며, 공유 비프로덕션 DB에서 동시 진행 중인 다른 세션(상담·체험 세션 관련 작업)의 데이터 상태 변경으로 인한 실패로 추정됨. 이번 세션에서 발생시킨 회귀 아님 — 수정하지 않음(범위 밖).
- 문제은행/Math/R&W 관련 테스트는 전부 통과.

## 버그 수정

없음 — UAT 중 문제은행/Math/R&W 범위 내 실제 버그는 발견되지 않음. 코드 변경·재배포 없음.

## 외부 변경 요약

- 비프로덕션 Preview 배포 1건(읽기 전용 UAT 목적).
- Supabase 비프로덕션 DB 쓰기 없음(문제 공개 처리 등 상태 변경 없음).
- Production 미접촉.
- `app/parent/`, `app/teacher/` 파일 미수정(교사 UAT는 읽기 전용 관찰만 수행).
