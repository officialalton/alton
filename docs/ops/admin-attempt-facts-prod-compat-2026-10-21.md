# admin_student_mock_attempt_facts — 현재 Production 코드(origin/main f0194c028) × 수정된 DB 함수(640) 호환 확인 (2026-10-21)

범위: 읽기 전용 점검 + 격리 Docker 스택(`ALTON_attfacts`, PORT_OFFSET=2300, 종료·정리 완료). 공유 DB 쓰기 없음, 프로덕션 배포 없음.
방법: origin/main 을 별도 체크아웃(worktree)해 같은 통합/컴포넌트 테스트(`app/admin/admin-attempt-facts-compat.integration.test.ts`)를 실행. 서버 액션만 실제 RPC(관리자 JWT)를 호출하도록 대체하고 컴포넌트(AttemptHistoryTable·ScoreStatsCard·MockExamResultView)는 체크아웃된 실제 코드를 렌더링했다. 실제 고객 데이터 없음(실행 ID `acf…` 전용 계정·세트, 격리 DB).

## 1. main 코드의 함수 사용처
- 호출: `app/admin/free-accounts-actions.ts#getStudentAttemptFactsAction` 한 곳 → `lib/free-accounts/facts.ts#factsFromRpcRows`. 소비자: `app/admin/free-accounts/AccountDetail.tsx`(응시 이력·점수 카드), `app/admin/StudentMockScoresCard.tsx`(일반 학생 상세).
- 열 이름: `exam_track`·`ap_subject`·`format`·`status`·`rw_*`·`math_*`·`*_answered` 등을 이름으로 읽는다. 640 이 추가한 `mc_total`·`mc_correct` 는 main 이 모르는 열이라 무시되고, 기존 열은 전부 유지·같은 타입이다 → 반환 열 추가는 main 에 안전.
- track 값: `exam_track === "ap" ? "ap" : "sat"`. main 의 `score-aggregate` 는 이미 `track:"ap"`(`groupKey`, `no_estimate_ap`)을 알고 있어 `'ap'` 값 자체는 처리된다.

## 2. 조합별 동작(같은 테스트 3조합 · 같은 데이터)
| 응시 | main + 409(이전 함수) | main + 640(현재 Production 조합) | 수정 브랜치 + 640(+670 미적용 시 동일) / +670 |
|---|---|---|---|
| RPC 행: AP 채점 | track `sat`, ap_subject null | track `ap`, ap_subject 정상, mc 1/3 | 동일 / + mc_item_count 3 |
| 목록 행: AP 채점 | "Score estimate not available (fixed-format test) · 0/0 correct"(오표시) | "Score estimate not available" | "1/3 correct (multiple choice) · AP scores (1–5) are not estimated" |
| 목록 행: AP 진행중 | "—" | "—" | "—" / "2 questions · not graded yet" |
| 목록 행: AP 배정만 | 버튼 없음 | 버튼 없음 | 버튼 없음 / "3 questions · not graded yet" |
| View result: AP 채점·진행중 | **크래시**(SAT 결과 화면이 AP 데이터를 받아 `TypeError: Cannot read properties of undefined (reading 'answered'/'total')`, report.ts) | **같은 크래시** | AP 읽기 전용 결과 화면 정상 |
| SAT 채점/진행중 목록·상세 | 정상 | 정상(동일) | 정상(동일) |
| 요약 카드 | 오류 없음. AP 정답률 "No AP tests available yet", 안내 "1 fixed-format attempt has no score estimate" | 오류 없음. "AP accuracy: ap_english_language: — (n=1)" | 같은 카드(요약 코드는 main 과 동일) |

결론: 640 이 main 에 **새로 다른 실패(크래시·잘못된 화면)를 만들지 않는다.** AP 상세 진입 크래시는 클릭 경로가 `getAttemptDetailForAdminAction`→SAT `MockExamResultView` 로 고정이라 함수 버전과 무관하게 main+409, main+640 모두 동일하게 발생한다(기존 결함, 수정 브랜치에서 해결됨). 640 으로 개선된 점은 목록·요약의 AP 오분류("fixed-format 0/0")가 사라진 것뿐이고, **상세 진입 크래시는 수정 브랜치 코드가 배포되기 전까지 Production 에서 계속된다**(이번 조합으로 악화되지는 않음).

요약 카드의 AP 정답률은 main 코드가 R&W/Math 열로 계산하므로 AP 는 계속 "—"(n=1)이다. main 에서도 640 이전·이후 모두 숫자가 나오지 않는다(수정 브랜치 포함 요약 코드는 같음 — 별도 개선 후보).

## 3. 실행 권한·가드(격리 스택, pg_proc / routine_privileges / has_function_privilege)
- 409 정의(트랜잭션에서 재현 후 롤백)와 640(마이그레이션 적용 상태)의 `proacl` 동일: `{postgres=X, authenticated=X, service_role=X}`. anon·public 실행 불가, `prosecdef=t`, `provolatile=s` 동일. `information_schema.routine_privileges`: authenticated·postgres·service_role. 670(새 번호)도 동일.
- 공유 DB 에서는 같은 SQL 문(`revoke … from public, anon; grant … to authenticated`)이 적용된 것이므로 파일 기준으로 같다(자격 증명 없는 이 워크트리에서 공유 DB 직접 조회는 하지 않음).
- `_free_accounts_staff()` 가드(실측): 학생 본인·다른 학생·상담사·학생관리 권한 없는 supervisor → 42501 `not_allowed`. 시드 관리자·master·full·학생관리 capability supervisor → 통과. anon → `permission denied for function`. JWT sub 없는 authenticated → 42501. 이전 정의(409)와 결과 동일.
- 기존 회귀: `free-accounts.integration.test.ts` + `score-display-rule.integration.test.ts` 29건 통과(670 적용 상태).

## 4. 미채점 AP 응시 '0문항' 정정(작성만, 미적용)
원인: `mc_total` 은 상세 RPC 가 `graded` 일 때만 호출되어 채점 후에만 채워진다. 미채점이면 0.
수정:
- 새 마이그레이션 `supabase/migrations/20262100000670_admin_attempt_facts_ap_item_count.sql`(추가형, 640 은 수정하지 않음): 같은 본문 + `mc_item_count`(세트 `mock_exam_set_items`의 AP 섹션 객관식 수. FRQ 제외, SAT 는 null). 정답 수(`mc_correct`)는 채점 전 null 유지. 실행 권한 동일(`revoke … public, anon` / `grant … authenticated`, service_role 은 기본 권한).
- 코드: `lib/free-accounts/facts.ts`(`mc.setTotal`), `lib/mock-exam/score-aggregate.ts`(타입), `AttemptHistoryTable.tsx` — 미채점 AP: `N questions · not graded yet`(1이면 단수), 세트 수를 모르는 구 RPC 면 기존 "—". 채점된 AP 에 저장 문항이 없으면 분모를 세트 수로 대체.
- 검증: 격리 스택 실측(채점 mc 1/3·item 3, 진행중 FRQ 포함 세트 item 2·mc_total 0·correct null, 배정만 item 3, SAT null), 컴포넌트 테스트 3건 추가(`AttemptHistoryTable.test.tsx`), 호환 통합 테스트.
- **적용 순서 주의**: 670 은 열이 늘어 `drop function` 후 재생성한다. 670 적용 후 main 코드가 호출해도 위와 같은 이유(열 이름 접근)로 안전하다.

## 5. `lib/ap-exam/tex-corrections-gen.test.ts` 실패 분류
- origin/main 별도 체크아웃(독립 `npm ci`)에서 같은 테스트 실행 → **main 에서도 동일하게 실패**. 수정 브랜치(HEAD)에서도 동일 실패. DB·환경 의존 없음(저장소 파일 비교).
- 분류: **기존 결함(저장 파일 stale)** — `data/ap/stock/tex-corrections.json`(count 336, 마지막 재생성 5f5a32f69, 2026-10-20)이 현재 `data/ap/stock/*items.json` 재고로 다시 계산한 결과와 다르다(`pre-mc2:ap_precalculus-m46-k*` 등 항목 차이). 이번 변경(함수·화면)과 무관, 환경(Docker·DB·네트워크) 문제도 아님. 조치 후보: `AP_TEX_CORR_WRITE=1 npx vitest run lib/ap-exam/tex-corrections-gen.test.ts` 로 재생성 후 커밋(재고 담당 세션 판단, 이번에는 건드리지 않음).

## 6. 남은 위험·기타
- 상세 진입 AP 크래시는 Production(main)에서 640 과 무관하게 이미 존재. 수정 브랜치(480ceef90 등)가 main 에 들어가야 해소.
- 마이그레이션 순서 결함 발견: `20261101100000_essay_ai_cost_events.sql` 가 `20262100000600_essay_ai_scores.sql`(mock_exam_essay_scores 생성)보다 앞 번호라 **빈 DB 전체 재적용(`supabase start`/db reset)이 실패**한다(이번 격리 스택은 해당 파일을 임시로 빼고 기동 후 원복). 운영 DB 는 순서대로 적용되어 영향 없지만 신규 환경·reset 에서는 깨진다 → 이 문서 작성 직후 원격에서 `20262100000650_essay_ai_cost_events.sql` 로 번호가 옮겨져 해소됨(확인만, 재적용 검증은 하지 않음). 이 때문에 내 마이그레이션 번호도 650 → 670 으로 바꿨다(650 충돌).
- 공유 DB 에 670 은 적용하지 않음(오너 승인 후 적용). 670 적용 전에도 수정 화면은 "—" 로 안전하게 동작.
