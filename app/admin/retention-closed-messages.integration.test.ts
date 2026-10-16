import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// 2026-10-06 보존 감사 — 종료 후 2년 지난 스레드/문의 메시지 삭제(20262100000081).
// 모든 데이터는 BEGIN…ROLLBACK 한 트랜잭션 안에서만 만들어 정리가 필요 없다(실행 ID 라벨만 구분용).
// FK 의존 행(수강·배정)을 만들지 않기 위해 session_replication_role=replica 로 FK 트리거를 끈다.

const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const RUN = `ret-${Date.now()}`;

function run(sql: string): string[] {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A"], {
    encoding: "utf-8",
    input: `begin; set local session_replication_role = replica; ${sql} rollback;`,
  })
    .trim()
    .split("\n")
    .filter((l) => l !== "service_role" && !/^(BEGIN|SET|ROLLBACK|INSERT .*)$/.test(l));
}

const asService = `set local role service_role; select set_config('request.jwt.claim.role','service_role',true);`;

describe("종료 후 2년 메시지 보존 삭제", () => {
  it("보관(archived) 2년 초과 스레드의 메시지만 지우고, 활성·최근 건은 남긴다", () => {
    const out = run(`
      insert into subject_threads (id, subject_enrollment_id, teacher_assignment_id, teacher_id, status, archived_at) values
        ('00000000-0000-0000-0000-0000000a0001', gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'archived', now() - interval '3 years'),
        ('00000000-0000-0000-0000-0000000a0002', gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'archived', now() - interval '1 year'),
        ('00000000-0000-0000-0000-0000000a0003', gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'active', null);
      insert into subject_thread_messages (thread_id, sender_id, text) select id, gen_random_uuid(), '${RUN}' from subject_threads where id::text like '00000000-0000-0000-0000-0000000a000%';
      ${asService}
      select retention_delete_expired_subject_thread_messages(1000, true);
      select retention_delete_expired_subject_thread_messages(1000, false);
      select thread_id::text from subject_thread_messages where text = '${RUN}' order by 1;
    `);
    expect(Number(out[0])).toBeGreaterThanOrEqual(1); // dry-run
    expect(Number(out[1])).toBeGreaterThanOrEqual(1);
    expect(out.slice(2)).toEqual([
      "00000000-0000-0000-0000-0000000a0002",
      "00000000-0000-0000-0000-0000000a0003",
    ]);
  });

  it("종료(closed) 2년 초과 선생님-관리자 문의의 메시지만 지운다", () => {
    const out = run(`
      insert into teacher_admin_inquiries (id, teacher_id, status, opened_by, opened_by_role, closed_at) values
        ('00000000-0000-0000-0000-0000000b0001', gen_random_uuid(), 'closed', gen_random_uuid(), 'admin', now() - interval '3 years'),
        ('00000000-0000-0000-0000-0000000b0002', gen_random_uuid(), 'open', gen_random_uuid(), 'admin', null);
      insert into teacher_admin_messages (inquiry_id, sender_id, sender_role, body) select id, gen_random_uuid(), 'admin', '${RUN}' from teacher_admin_inquiries where id::text like '00000000-0000-0000-0000-0000000b000%';
      ${asService}
      select retention_delete_expired_teacher_admin_messages(1000, false);
      select inquiry_id::text from teacher_admin_messages where body = '${RUN}';
    `);
    expect(Number(out[0])).toBeGreaterThanOrEqual(1);
    expect(out.slice(1)).toEqual(["00000000-0000-0000-0000-0000000b0002"]);
  });

  it("오케스트레이터가 새 항목을 오류 없이 돌려준다", () => {
    const out = run(`${asService} select run_data_retention_batch(10, true)::text;`);
    const parsed = JSON.parse(out[out.length - 1]);
    expect(parsed).toHaveProperty("subjectThreadMessages");
    expect(parsed).toHaveProperty("teacherAdminMessages");
    expect(parsed.errors).toEqual([]);
  });
});
