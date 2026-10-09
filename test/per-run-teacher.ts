// DB 통합 테스트 공용 — 실행마다 전용 선생님을 새로 만든다.
//
// 예약·수업권 원장은 append-only라 정리되지 않는다. 시드 선생님에 예약을 쌓으면 재실행할수록
// 예약 가능 창과 날짜 구간이 줄어들어 결국 빈 슬롯이 사라진다. 실행마다 새 선생님을 만들면
// 예약이 그 선생님에만 쌓여 시드 선생님의 슬롯은 소모되지 않는다.
//
// 순서 주의: 시급 이력(set_teacher_rate)이 있어야 teacher_assignments·sessions insert
// 트리거가 통과하므로 teachers insert 전에 먼저 만든다.

type Psql = (sql: string) => string;

const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";

/**
 * 새 선생님 auth user + profile + teachers 행을 만들고 id를 돌려준다.
 * availability: true면 매일 00:00~23:59(America/Los_Angeles) 가능 시간 규칙도 넣는다
 * (confirm_lesson_booking처럼 가능 시간을 검사하는 경로용). 정리는 cleanupPerRunTeacher().
 */
export function createPerRunTeacher(psql: Psql, opts: { emailPrefix: string; name?: string; availability?: boolean }): string {
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${opts.emailPrefix}-teacher-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`,
  ).trim();
  psql(`insert into profiles (id, role, name) values ('${id}', 'teacher', '${opts.name ?? "통합테스트 선생님"}');`);
  psql(`select set_teacher_rate('${id}', 3000000, 'KRW', now() - interval '1 day');`);
  psql(`insert into teachers (id, status) values ('${id}', 'active');`);
  if (opts.availability) {
    psql(
      `insert into teacher_availability_rules (teacher_id, day_of_week, start_time_local, end_time_local, timezone, created_by)
       select '${id}', d, '00:00', '23:59', 'America/Los_Angeles', '${ADMIN_ID}' from generate_series(0,6) d;`,
    );
  }
  return id;
}

/** afterAll용 — setup이 실패해 id가 없으면 아무것도 하지 않는다. */
export function cleanupPerRunTeacher(psql: Psql, teacherId: string | undefined): void {
  if (!teacherId) return;
  psql(`delete from teacher_availability_rules where teacher_id = '${teacherId}' and created_by = '${ADMIN_ID}';`);
}
