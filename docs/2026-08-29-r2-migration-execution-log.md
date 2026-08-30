# R2 — 마이그레이션·구현 실행 로그

- 목적: R1 실행 로그(`2026-08-29-r1-migration-execution-log.md`)와 동일한 형식으로 R2 각 태스크의 실행 기록을 남긴다.
- 원칙: R1과 동일 — 로컬 검증 → 역할별 RLS/동시성 실측(해당 시) → 원격 변경 대상·영향 범위 요약 보고 → `supabase db push --linked` → 원격 재검증.

## Task 1 — R1 회귀 버그 수정: 시급 이력 연동 (완료, 2026-08-30)

### 배경

`app/admin/users-actions.ts`의 `inviteTeacher()`/`setTeacherHourlyRate()`가 `teachers.hourly_rate_krw`만 직접 쓰고 R1의 `set_teacher_rate()`를 호출하지 않아, R1의 `teachers_enforce_active_requires_rate` 트리거 때문에 이 경로로 처리된 선생님이 `active` 전환에서 영구히 막히는 회귀가 있었다(R2 investigation 문서 §0 참고).

### 조사 중 추가로 발견한 것

`app/admin/payouts-data.ts`(정산 금액 계산: `amountKrw = hourly_rate_krw * totalMinutes / 60`)도 `teachers.hourly_rate_krw`를 직접 읽는다. `teacher_rate_history`만 진실 소스로 만들고 이 읽기 경로를 다시 쓰는 것은 R4/R10 범위의 더 큰 변경이 되므로, 대신 `set_teacher_rate()` 자체가 `teacher_rate_history` insert와 같은 트랜잭션에서 `teachers.hourly_rate_krw`도 함께 갱신하도록 수정했다(신규 마이그레이션 `20260831000000_r2_sync_teachers_hourly_rate.sql`). 이렇게 하면 `payouts-data.ts`/`users-data.ts`는 전혀 수정할 필요가 없다.

### 변경 내역

1. **`supabase/migrations/20260831000000_r2_sync_teachers_hourly_rate.sql`**: `set_teacher_rate()`를 `CREATE OR REPLACE` — 기존 로직(락 → 기존 이력 종료 → 새 이력 생성) 그대로 유지하고, 마지막에 `update teachers set hourly_rate_krw = p_amount_minor where id = p_teacher_id;` 한 줄만 추가.
2. **`app/admin/users-actions.ts`**:
   - `inviteTeacher()`: `teachers` insert에서 `hourly_rate_krw` 직접 저장을 제거하고, insert 직후 서비스-role 클라이언트로 `admin.rpc('set_teacher_rate', {...})` 호출. 실패 시 "선생님 계정은 생성됐지만 시급 이력 생성에 실패했습니다... 다시 시도해주세요" 안내.
   - `setTeacherHourlyRate()`: `supabase.from("teachers").update(...)` 대신 서비스-role 클라이언트로 `admin.rpc('set_teacher_rate', {...})` 호출.
   - `setTeacherStatus()`: `status==='active'`일 때 먼저 서비스-role로 `has_valid_current_teacher_rate` RPC를 호출해 확인하고, 없으면 DB 트리거의 원시 오류 대신 "이 선생님은 아직 시급이 설정되지 않아 active로 전환할 수 없습니다. 먼저 시급을 설정해주세요"를 던진다. DB 트리거는 그대로 최종 방어선으로 남긴다.
3. **`app/admin/users-actions.test.ts`**: 기존 `inviteTeacher` 테스트를 새 동작에 맞게 수정하고, `set_teacher_rate` RPC 실패 케이스, `setTeacherHourlyRate`의 RPC 호출·직접 update 안 함, `setTeacherStatus`의 active 전환 시 사전 확인 성공/실패/`pending` 전환 시 미확인 등 신규 테스트 6건 추가.

### 검증

| 항목 | 결과 |
|---|---|
| `npx tsc --noEmit` | 클린 |
| `npx vitest run`(전체) | 76개 파일 320개 테스트 전부 통과 |
| `npx vitest run app/admin/users-actions.test.ts` | 8개 테스트 전부 통과(신규 6 + 기존 2) |
| 로컬 DB 실제 SQL 시퀀스 재현(신규 테스트 선생님) | `teachers insert(pending)` → `set_teacher_rate(42000,'KRW')` → `has_valid_current_teacher_rate` = `true` → `update status='active'` 성공 → `hourly_rate_krw`가 `42000`으로 동기화됨 확인 |
| 부정 케이스(시급 없는 선생님) | `has_valid_current_teacher_rate` = `false` 확인, 사전 확인을 우회해 직접 `UPDATE status='active'` 시도해도 DB 트리거가 여전히 차단(최종 방어선 살아있음) 확인 |
| `set_teacher_rate()` 동기화 로직 재확인 | 기존 테스트 선생님(김도경) 시급을 65000으로 변경 → `teachers.hourly_rate_krw`도 65000으로 동기화 확인 |

### 원격 적용

`supabase db push --linked`로 `20260831000000_r2_sync_teachers_hourly_rate.sql` 1개 파일 적용 성공. `supabase db query --linked`로 확인: 기존 두 선생님(장세준·김도경) `hourly_rate_krw=50000` 그대로 보존(함수 본문 교체만이라 기존 데이터 영향 없음), `set_teacher_rate()` 함수 본문에 신규 동기화 라인이 실제로 배포됐음을 `pg_proc.prosrc` 조회로 확인.

**Task 1 완료. 앱 코드(`app/admin/users-actions.ts`) 변경은 아직 커밋하지 않았다 — 사용자가 커밋을 명시적으로 요청하면 진행한다(프로젝트 관례).**
