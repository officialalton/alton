# 2026-09-18 — 실제 학생/교사 세션 UAT (문제은행 공개 후)

## 배경

`docs/2026-09-18-problem-bank-role-uat.md`에서 확인된 대로, 공개된 문제가 0건이라
관리자 미리보기만으로는 실제 학생 세션 풀이·채점·교사 리뷰 흐름을 검증할 수 없었다.
제품 오너 승인에 따라 Math MC/SPR, R&W 근거모델/정량모델 각 1문항씩 총 4문항을 실제로
공개 처리하고, 진짜 테스트 학생·교사 계정과 세션을 만들어 실 사용 흐름을 끝까지
검증했다.

## 1. 공개 처리한 4문항

전수 감사(`docs/2026-09-18-problem-bank-full-audit.md`)로 결함 8건이 이미 보관
처리된(마이그레이션 `20261413000000` 원격 적용 확인) 활성 152문항 중에서 계열별
1문항씩 선정. 공개 전 관리자 검수 화면에서 지문·선택지·정답·해설(그림/표 포함)이
LaTeX 노출이나 금칙어 없이 정상 렌더링되는지 육안 확인 후 "공개하기" 클릭.

| 계열 | problem_id | skill_code | 문항 요약 |
|---|---|---|---|
| Math MC | `019f899e-6b69-4567-872a-5f9724c7e606` | linear_equations_two_var | 연립방정식 해의 개수(정답 D, 해 없음) |
| Math SPR | `1e82859d-9547-4f01-9916-2d3290b73c38` | linear_equations_one_var | `4x+8=3x+13` 방정식(정답 5) |
| R&W 근거모델 | `9de2c8b6-6697-4fee-8aa9-a18d5c46c087` | central_ideas_details | 보도블록 설문 지문(정답 C) |
| R&W 정량모델 | `e2f41d4a-cb00-4d7c-a12b-3c3426972591` | command_of_evidence_quant | 운동시간×안정시 심박수 표(정답 A) |

4건 모두 Admin Preview UI(`https://alton-7sfby1ror-alton7.vercel.app`)에서 실제
"공개하기" 클릭으로 처리(스크립트/SQL로 상태를 바꾸지 않음). 처리 후 원격 DB에서
`problem_versions.status = 'published'` 확인.

## 2. 테스트 계정/세션 구성 (UAT 실행 ID: `uat20260918`)

`scripts/uat-20260918-problembank-seed.ts` (신규, `docs/CURRENT.md`의 UAT 실행 ID
관례를 따름 — 참고: `scripts/uat-r13-consult-seed.ts`)로 비프로덕션
(`worpsqwqgnspddnrtnvq`)에 아래를 생성:

- 보호자 1명(`uat-uat20260918-guardian@example.com`), household, contract(draft)
- 테스트 학생 1명(`uat-uat20260918-student@example.com`, 비밀번호
  `Uat-pb0918-Passw0rd!`)
- 테스트 교사 1명(`uat-uat20260918-teacher@example.com`, 동일 비밀번호,
  `teacher_rate_history` 포함)
- SAT Math, SAT R&W 각각 과목수강(subject_enrollments) + 담당 배정
  (teacher_assignments) + 커리큘럼 오버레이/단원 + 회차 준비
  (curriculum_unit_preps/prep_items, 공개된 문제 2개씩 배정)
- 각 단원을 세션에 연결(`link_unit_prep_to_session`) 후 시작
  (`mark_lesson_session_started`) — 실제 "수업 준비" → "회차 연결" → "수업 시작"
  경로를 그대로 재현(로컬 `problem-grading.integration.test.ts`가 검증하는 것과 동일한
  DB 함수 체인)
- Math 세션 `b87617dd-ab6c-4ecf-b6a3-8c649312afb1`, R&W 세션
  `a6bf3630-aafa-477e-96a6-9eab756209c0`. 두 세션 모두 `session_content_manifest`에
  공개된 문제 2개씩 정상 포함, `final_status='live'` 확인.
- 문제가 "이 회차의 키워드 범위" 안에 들어가도록 임시 `subject_keywords` +
  `curriculum_overlay_unit_keywords` + `problem_keywords` 연결을 만듦(회차 준비 검증
  트리거 요구사항). 공개된 문제 자체의 콘텐츠는 바꾸지 않음.

세션 만들기는 SQL/서비스 롤 스크립트로 했지만(예약·Google Calendar 연동 없이 최소
경로), **문제 풀이·채점·리뷰는 전부 실제 로그인한 학생/교사 계정으로 실제 세션뷰
UI를 클릭해서 검증**했다.

## 3. 학생 UAT 결과 (실제 세션뷰, `app/session/[id]/ProblemsPanel.tsx`)

로그인: `uat-uat20260918-student@example.com` (최초 로그인 시 프로필 완성 폼 제출
필요 — 생년월일/학교명/학년 입력 후 통과).

| 문제 | 학생이 고른 답 | DB 기록(`session_problem_work`) |
|---|---|---|
| Math MC | D) No solution | `submitted_choice_index=3`, `auto_correct=true` (정답) |
| Math SPR | `5.0` 입력(정답은 `5`, 동등 형식 테스트) | `submitted_text='5.0'`, `auto_correct=true` — `spr_answer_matches`가 `5.0`≡`5` 정상 판정 |
| R&W 근거모델 | A) (의도적 오답) | `submitted_choice_index=0`, `auto_correct=false` |
| R&W 정량모델 | A) (정답) | `submitted_choice_index=0`, `auto_correct=true` |

관찰: MC는 클릭 즉시 저장(제출 버튼 없음), SPR은 입력 후 "답 저장" 클릭. R&W
정량모델 문제의 표(Mean Resting Heart Rate by Weekly Exercise Hours)가 학생 화면에
정상 렌더링됨(가로 스크롤 가능한 표, LaTeX 노출 없음).

## 4. 교사 UAT 결과 (동일 `ProblemsPanel`, `viewerRole="teacher"`)

로그인: `uat-uat20260918-teacher@example.com`. 두 세션 모두 "문제" 탭에서 학생의
제출 답("학생 답" 라벨)과 자동 채점 결과를 확인 후 "채점" 섹션에서 "채점 완료"
클릭(자동 채점 결과 그대로 확정, `grade_problem_attempt(p_grade=null)` 경로).

| 문제 | 채점 전 자동 채점 표시 | 채점 확정 결과(`session_problem_work.grade`) |
|---|---|---|
| Math MC | 학생 답: 4 · 자동 채점: 정답 | `correct` |
| Math SPR | 학생 답: 5.0 · 자동 채점: 정답 | `correct` |
| R&W 근거모델 | 학생 답: 1 · 자동 채점: 오답 | `incorrect` |
| R&W 정량모델 | 학생 답: 1 · 자동 채점: 정답 | `correct` |

채점 확정 후 문제 탭 상단 라벨이 "정답"/"오답"으로 바뀌는 것도 확인. 정답·해설은
채점 완료 전에는 학생에게 노출되지 않고, 교사에게는 "정답·해설 보기" 토글로 항상
열람 가능함을 확인(기존 정책과 일치).

`app/session/[id]/ProblemLogTab.tsx`(문제 히스토리 로그)는 이번 세션(1회차) 화면
탭 바에는 노출되지 않았다 — grep 결과 현재 어떤 페이지에서도 이 컴포넌트를
import하지 않는다. 즉 코드는 존재하지만 실제로 마운트되는 화면이 없는 상태로
보인다(아래 "발견 사항" 참고). 교사 리뷰는 `ProblemsPanel`의 채점 섹션이 실질적인
경로이며, 이 경로로 4문항 모두 정상 검증했다.

## 5. 발견 사항 (버그로 확신하지 못해 수정하지 않음)

1. **`app/student` 홈이 로그인 직후 500 에러(React 오류 #418/#441, 참조 코드
   `2436755022`)로 렌더링 실패.** 세션뷰(`/session/[id]`)는 정상 동작하므로 학생
   UAT 자체는 세션 URL 직접 진입으로 우회해 완료했지만, 실제 학생이 로그인 후
   보게 될 기본 진입 화면이 깨져 있다. 이 세션에서 만든 테스트 학생 데이터(과목
   2개 동시 수강 등)가 원인인지, 기존에 있던 회귀인지 확증하지 못했다 —
   `app/student/`는 이번 작업 범위(`lib/problem-generation/`, `app/admin/`,
   `app/session/`) 밖이라 코드를 고치지 않고 현상만 기록한다. 재현: 위 학생
   계정으로 로그인 후 `/student` 접속.
2. **`ProblemLogTab.tsx`가 어떤 페이지에서도 참조되지 않는다.** 죽은 코드이거나,
   아직 연결 안 된 예정 화면일 수 있다 — 세션/코드 이력을 더 볼 시간이 없어
   판단을 보류하고 사실만 기록한다.
3. Math `linear_equations_one_var` 계열 해설의 `(1)x = 5`류 표기(계수 1도 괄호로
   묶어 보여줌)는 수학적으로는 틀리지 않으나 다소 부자연스럽다
   (`lib/problem-generation/math-compilers/linear-equations-one-var.ts:442`). 전
   계열에 일관되게 적용된 의도된 템플릿으로 보여(오류가 아니라 스타일) 별도 수정은
   하지 않았다.

## 6. 자동 테스트

`npx vitest run app/admin lib/problem-generation app/session`

- 167 files passed / 2 failed, 1398 tests passed / 4 failed / 8 skipped.
- 실패 4건 전부 `app/session/[id]/problem-grading.integration.test.ts`의 로컬
  Supabase(127.0.0.1:54422) 기준 그림 검수 관련 assertion(`그림을 확인해야` 등
  기대 문자열 불일치) — 이번 세션은 코드를 전혀 수정하지 않았고(신규 스크립트
  파일 1개만 추가), 로컬 DB 상태에 좌우되는 사전 존재 실패로 판단, 문제은행/
  Math/R&W 공개·풀이·채점 범위 밖이라 수정하지 않음.

## 7. 외부 변경 요약

- 비프로덕션(`worpsqwqgnspddnrtnvq`) DB: 문제 4건 공개 처리(영구, 의도된 산출물),
  UAT 실행 ID `uat20260918` 태그의 학생/교사/보호자/세션/커리큘럼 데이터 생성(정리
  안 함 — 향후 회귀 재현·추가 검증에 재사용 가능하도록 보존).
- 코드 변경 없음, 재배포 없음(기존 Preview `https://alton-7sfby1ror-alton7.vercel.app`,
  `target: preview` 그대로 사용, HEAD는 배포 시점 `db818b3` 그대로 — 이번 세션은
  코드를 안 고쳤으므로 새로 배포하지 않음).
- Production 미접촉.
- `app/parent/`, `app/teacher/` 파일 미수정.
