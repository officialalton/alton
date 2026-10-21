# Hotfix: 관리자 AP 결과 크래시 (`hotfix/admin-ap-result`) — 2026-10-21

상태: 준비 완료, **Production 배포 안 함**(Preview 확인 뒤 오너 승인). main 푸시 없음. 공유 DB 쓰기 없음.

## 1. 증상·원인
- 관리자 > Free Accounts > 학생 상세 > AP 응시 `View result` 가 SAT 결과 화면으로 열려 `Cannot read properties of undefined (reading 'answered')` 로 크래시.
- 원인: (1) 응시 목록 함수 `admin_student_mock_attempt_facts` 가 `exam_track='sat'` 고정이었음(마이그레이션 640 으로 공유 DB 에 이미 정정). (2) main 의 `AttemptHistoryTable` 이 track 과 무관하게 SAT `MockExamResultView` 로 연다 → 640 적용 뒤에도 같은 크래시(AP 읽기 전용 화면이 main 에 없음).

## 2. 기준 브랜치와 커밋
- 기준: `origin/main` = `7f6d68424`(학생·학부모 AP 결과 핫픽스 포함). 브랜치 `hotfix/admin-ap-result`, 커밋 1개(+ 이 문서 커밋).
- 출처(통합 브랜치): `db7b78b91`(관리자 AP 화면 부분만), `480ceef90`, `68d9657d0`(AttemptHistoryTable·facts·score-aggregate 부분만, 670 관련 코드는 조건부로 포함 — §4). 커밋 단위 cherry-pick 이 아니라 **필요한 파일만 통합 브랜치 버전으로 체크아웃**했다(db7b78b91 은 student/parent/result-score 변경이 섞여 있고 그 부분은 main 7f6d68424 에 이미 반영돼 있음).

## 3. 포함 / 제외
포함(11개):
| 파일 | 역할 |
|---|---|
| `app/admin/free-accounts-actions.ts` | `getApAttemptViewForAdminAction`(서버 가드 `requireAdminOrCapability("학생관리")`, AP 아니면 null, 읽기만) |
| `app/admin/free-accounts/AdminApResultView.tsx`(신규) | main 의 `ApExamResultView`(readOnly) + 관리자용 메타(테스트 계정·채점 구성) |
| `app/admin/free-accounts/AttemptHistoryTable.tsx` | track==='ap' 면 AP 화면으로 연다. 목록이 AP 를 못 알려줘도 상세가 AP 면 AP 화면(이중 방어). AP 목록 행 요약 문구 |
| `app/student/mock-exam/[attemptId]/MockExamResultView.tsx` | SAT 화면이 AP 데이터를 받으면 크래시 대신 안내 문구(가드) |
| `lib/free-accounts/facts.ts`, `lib/mock-exam/score-aggregate.ts` | `mc_total/mc_correct/mc_item_count` 선택 필드(없으면 undefined/null) |
| `supabase/migrations/20262100000640_admin_attempt_facts_ap_track.sql` | **이미 공유 DB 에 적용됨**. 저장소 파일을 main 에 맞추기 위한 것(재적용 불필요, 번호 추적으로 `db push` 가 건너뜀) |
| 테스트 4개(위 11개 중) | `AdminApResult.test.tsx`, `AttemptHistoryTable.test.tsx`, `MockExamResultViewApGuard.test.tsx`, `app/admin/admin-attempt-facts-compat.integration.test.ts`(격리 DB 전용, `COMPAT_EXPECT_ITEM_COUNT=1` 일 때만 670 열 단언) |

제외: Stripe·결제 환불 화면(`PaymentRefundBoard` 등)·비용 원장·European History 활성화·SEO·인문 재고·마이그레이션 650/660/670·문서(통합 브랜치 전용 문서).

## 4. 의존성
- 공통 모듈: `lib/ap-exam/result-score.ts`, `ApExamResultView`(readOnly·essayScoringSupported), `lib/essay-grading/view.ts`·`subject.ts`, `loadMockExamAttemptDetail` — **전부 main 에 이미 있는 것을 사용**(새 복사 없음, `git diff origin/main -- lib/ap-exam` 변경 없음).
- 마이그레이션 640: 필수(공유 DB 적용 완료). 이 코드는 640 이 없으면 track 이 'sat' 로 와서 AP 가 SAT 쪽 경로로 가지만, `getAttemptDetailForAdminAction` 결과의 `examProgram==='ap'` 를 보고 AP 화면으로 보내고 SAT 화면 가드도 있어 크래시하지 않는다(이중 방어).
- 마이그레이션 670: **선택**. `mc_item_count` 가 없으면(`undefined`→null) 미채점 AP 행은 '—' 그대로, 채점된 AP 는 저장 문항 수 분모로 표시. 조건부 코드: `AttemptHistoryTable` 의 `r.mc?.setTotal` 분기(없으면 '—').

## 5. 호환성 실측(격리 스택 `ALTON_hf28`, PORT_OFFSET=2800, 종료·정리 완료)
같은 통합 테스트(`admin-attempt-facts-compat.integration.test.ts`)를 코드×DB 조합별로 실행. 실행 ID 전용 계정·세트(`acf…`), 테스트 종료 시 정리, 공유 DB 접촉 없음.
| 응시 | **현재 Production(main) + 640 (670 없음)** | **핫픽스 + 640 (670 없음)** ← 배포 직후 조합 | 핫픽스 + 640 + 670 | main + 640 + 670 |
|---|---|---|---|---|
| AP 채점 — 목록 | "Score estimate not available" | "1/3 correct (multiple choice) · AP scores (1–5) are not estimated" | 동일 | main 과 동일 |
| AP 채점 — View result | **크래시**(SAT 화면, 미처리 TypeError 2건·빈 패널) | AP 읽기 전용 화면 정상(`admin-ap-result`) | 정상 | 크래시(무시되는 새 열) |
| AP 진행중 — 목록/상세 | "—" / 크래시 | "—" / AP 화면 정상 | "2 questions · not graded yet" / 정상 | "—" / 크래시 |
| AP 배정만 | 버튼 없음 | 버튼 없음, "—" | "3 questions · not graded yet" | "—" |
| SAT 채점·진행중 목록/상세 | 정상 | 정상(동일 값: 680–740/770–800/1,450–1,540 등) | 정상 | 정상 |
| 요약 카드 | 오류 없음 | 오류 없음(요약 코드는 main 과 동일) | 오류 없음 | 오류 없음 |
결론: 핫픽스는 670 없이 완전히 안전하게 동작. 670 은 미채점 AP 행에 문항 수를 보여 주는 표시 개선만 추가. 새 열 `mc_item_count` 는 main 코드가 이름으로 읽지 않아 무시되어 main 에서도 무해.

## 6. 권한 점검
- 서버 액션: `getApAttemptViewForAdminAction` 은 첫 줄에서 `requireAdminOrCapability("학생관리")`(master·full 관리자 통과, supervisor 는 학생관리 capability 필요, 학생·학부모·선생님·상담사는 로그인/권한 오류). 단위 테스트가 비관리자 거부를 가드 이전 읽기 없이 확인("rejects non-admins before reading anything").
- DB 이중 방어(`_free_accounts_staff()`, 격리 실측): 학생 본인·다른 학생·상담사·학생관리 권한 없는 supervisor → `42501 not_allowed`; 시드 관리자·master·full·학생관리 capability supervisor → 통과; anon → `permission denied for function`; JWT sub 없는 authenticated → `42501`.
- 액션이 읽는 테이블 RLS: `students` SELECT = 본인/담당 선생님/보호자/`is_admin()`, `mock_exam_essay_scores` SELECT = 본인/보호자/`is_admin()` — 관리자 세션 클라이언트로 읽으므로 서비스 롤 우회 없음.
- 학생·학부모 경로: 변경 없음(`app/student/mock-exam/[attemptId]/page.tsx`, `app/parent/mock-exam/[studentId]/[attemptId]/page.tsx` 가 이미 AP 를 `ApExamResultView` 로 분기). 이번 변경은 SAT 결과 컴포넌트에 AP 가드(안내 문구)만 추가.

## 7. 테스트 결과
- `npx tsc --noEmit -p .`: 새 오류 없음(Sanity·LayoutProps 제외 없음 — 출력 0줄).
- 관련 단위 테스트(`app/admin/free-accounts`, `app/student/mock-exam`, `lib/free-accounts`, `lib/mock-exam/score-aggregate`, `lib/ap-exam`): 424 통과, 1 실패.
- 실패 1건 `lib/ap-exam/tex-corrections-gen.test.ts`: **main 에서도 같은 기존 결함**. `data/ap/stock/tex-corrections.json` 이 현재 `data/ap/stock/*items.json` 재고로 다시 계산한 결과와 달라서 생기는 저장 파일 불일치(`pre-mc2:ap_precalculus-m46-k*` 등). DB·환경 무관, 이 핫픽스는 해당 파일·재고를 건드리지 않음(`git diff origin/main -- lib/ap-exam data/ap` 없음). 조치는 재고 담당 세션이 `AP_TEX_CORR_WRITE=1 npx vitest run lib/ap-exam/tex-corrections-gen.test.ts` 로 재생성(이번에는 하지 않음).
- 통합(격리 DB): 위 4개 조합 모두 3/3 통과(결과는 §5).

## 8. Preview 검증 절차 (Vercel Preview `hotfix/admin-ap-result`)
1. 관리자 계정으로 Preview 로그인(로그인은 사용자가 직접).
2. 관리자 > Free Accounts > 학생 `지만 2` 상세 > 응시 이력에서 English Language 응시(`5b9952b6…`) `View result`.
3. 기대: 크래시 없이 AP 결과(상단에 Account/Scoring versions 박스, 읽기 전용, 오류 신고·채점 시작 버튼 없음). FRQ 미채점이면 미채점 상태 표시, 점수 표시는 학생 화면과 동일 계산.
4. SAT 응시 `View result` 정상, 목록에서 AP 행은 "N/M correct (multiple choice) · AP scores (1–5) are not estimated"(채점) 또는 "—"(미채점, 670 미적용).
5. 비관리자(학생) 로그인 시 관리자 경로 접근 불가.

## 9. 롤백
- Production 배포 후 문제 시: Vercel 에서 이전 Production 배포(`7f6d68424` 기준)로 Instant Rollback(코드만). DB 640 은 이전 코드와도 안전(위 표 "현재 Production + 640")하므로 DB 롤백 불필요.
- 코드 revert 대안: 이 브랜치의 커밋을 `git revert` 후 배포.
