# R8 sub-area 1 — cutover connection 착수 전 1장 정리 (2026-09-07)

CLAUDE.md "새 기능 착수 전 1장 정리" 요구에 따른 간단 정리. 상세 배경은
`docs/2026-08-29-master-roadmap-v3.md` R8 섹션, `docs/CURRENT.md`
`material_version_id` 정책 절 참고.

## 1. 사용자 흐름
- 정상: 학생/선생님이 `/student`,`/teacher`의 "수업" 탭에서 v3
  `sessions`/`reservations` 기반 예약을 보고 "수업 입장"을 누르면
  `/session/[id]`(id=v3 sessions.id)로 이동 → 세션뷰가 v3 데이터로 렌더링.
- 레거시 호환: 기존 `legacy_sessions.id`로 들어오는 링크(레거시 세션뷰,
  R6 이전 테스트 데이터)는 계속 동작해야 한다 — 두 테이블 다 조회해 판별.
- 실패: id가 어느 테이블에도 없거나 RLS가 막으면 `notFound()`(기존과 동일).
  완료된 세션(v3 `final_status` not in scheduled/live)은 읽기 전용으로 전환.

## 2. 데이터와 권한
- 신규 상태 없음 — 기존 `sessions`(v3)/`reservations`/`subject_enrollments`
  RLS(`sessions 조회` 정책, 이미 학생/보호자/선생님/관리자 필터링)를 그대로
  신뢰한다. page.tsx는 RLS를 우회하지 않는 사용자 세션 client로 조회.
- viewer role 판정: `sessions.teacher_id`=본인→teacher,
  `subject_enrollments.child_id`=본인→student, profile.role이 parent/admin이면
  그 role(RLS가 이미 관계 없는 접근을 차단하므로 기존 legacy 분기와 동일한
  방어적 판정 패턴 재사용).
- `material_version_id`: R9 이전이라 실제 배정 메커니즘(과목 템플릿→교재
  매핑)이 없다. 이번 라운드는 **불변식(시작/완료 후 재배정 금지)만 트리거로
  강제**하고, 값이 있는 세션은 그 버전이 가리키는 `curriculum_doc_id`로 기존
  `loadMaterialData`를 재사용(라이브 콘텐츠 — 완전한 시점 스냅샷 렌더링은 R9
  스냅샷 도입 후). 값이 없으면 "교재 미배정" 빈 상태로 렌더링.

## 3. UAT 데이터
- 로컬 시드에 실행 ID `r8cutover01` 접두 프로필/subject_enrollment/session을
  임시로 추가해 v3 세션 진입을 수동 확인 후 실행 ID로 정리(자동 vitest
  테스트와는 별개).

## 4. UI 기준
- 기존 `SessionShell` 컴포넌트를 그대로 재사용(레거시와 동일 화면 구조),
  신규 UI 없음. "완료 세션 읽기 전용" 배지/버튼 비활성화는 기존
  `SessionViewState "completed"` 처리 경로를 그대로 재사용.

## 5. 검증과 성능
- page.tsx의 추가 쿼리는 legacy 조회 1회 실패 후 v3 조회로 폴백하는 구조라
  legacy 히트 시 쿼리 수 변화 없음, v3 히트 시 legacy 조회 1회(빈 결과) +
  v3 조회 묶음 — 목록 화면이 아니라 상세 페이지 1건이므로 N+1 영향 없음.
- 통합 테스트로 (a) v3 세션 진입 시 올바른 viewer role, (b) 완료 세션 잠금,
  (c) material_version_id 재배정 차단 트리거를 확인.
