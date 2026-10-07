import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// Consultation Smart Notes artifacts (20262100000200): same one-year rule counted from the consultation end date, via the
// existing deletion queue; the DB column is cleared only after the Drive deletion succeeded; legal holds are re-checked
// at claim time. Every statement runs in one rolled-back transaction with run-id data, so nothing is left behind.
const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const RUN = `rca-${Date.now()}`;
const ADMIN = "aaaaaaaa-0000-0000-0000-000000000001";
const C_OLD = "00000000-0000-0000-0000-0000000f0001";
const C_NEW = "00000000-0000-0000-0000-0000000f0002";
const C_HELD = "00000000-0000-0000-0000-0000000f0003";

function run(sql: string): string {
  try {
    return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A"], {
      encoding: "utf-8",
      input: `begin; insert into supervisor_capabilities (profile_id, capability) values ('${ADMIN}','legal_hold_holder') on conflict do nothing; set local session_replication_role = replica; ${sql} rollback;`,
    });
  } catch (e) {
    throw new Error(String((e as { stderr?: string }).stderr ?? e));
  }
}
const lines = (o: string) =>
  o.trim().split("\n").filter((l) => l !== "service_role" && l !== ADMIN && !/^(BEGIN|SET|ROLLBACK|INSERT .*|UPDATE .*|DELETE .*|TRUNCATE.*)$/.test(l));
const svc = `set local role service_role; select set_config('request.jwt.claim.role','service_role',true);`;

const setup = `
  insert into consultations (id, contact_name, contact_email, status, requested_at, ends_at, smart_notes_drive_file_id) values
    ('${C_OLD}', '${RUN} old', '${RUN}-old@example.com', 'completed', now() - interval '400 days', now() - interval '390 days', '${RUN}-old'),
    ('${C_NEW}', '${RUN} new', '${RUN}-new@example.com', 'completed', now() - interval '40 days',  now() - interval '30 days',  '${RUN}-new'),
    ('${C_HELD}','${RUN} held','${RUN}-held@example.com','completed', now() - interval '400 days', now() - interval '390 days', '${RUN}-held');
  insert into legal_holds (subject_type, subject_id, reason, set_by, review_by)
    values ('consultation','${C_HELD}','${RUN} dispute hold', '${ADMIN}', current_date + 30);
`;

describe("consultation Smart Notes retention (consultation end + 1 year)", () => {
  it("enqueues only expired, non-held consultation files; idempotent; the DB column stays until the file is deleted", () => {
    const out = lines(run(`
      ${setup}
      ${svc}
      select retention_enqueue_expired_consultation_artifacts(1000, true) >= 1;
      select retention_enqueue_expired_consultation_artifacts(1000, false) >= 1;
      select retention_enqueue_expired_consultation_artifacts(1000, false);
      reset role;
      select string_agg(drive_file_id, ',' order by drive_file_id) from retention_deletion_targets where drive_file_id like '${RUN}%';
      select count(*) from consultations where smart_notes_drive_file_id like '${RUN}%';
    `));
    expect(out[0]).toBe("t");
    expect(out[1]).toBe("t");
    expect(out[2]).toBe("0"); // second real run adds nothing
    expect(out[3]).toBe(`${RUN}-old`); // neither the recent one nor the held one
    expect(out[4]).toBe("3"); // nothing cleared before Drive deletion
  });

  it("clears consultations.smart_notes_drive_file_id only after a successful Drive deletion; failures stay queued", () => {
    const out = lines(run(`
      ${setup}
      ${svc}
      select retention_enqueue_expired_consultation_artifacts(1000, false) >= 1;
      select count(*) from retention_claim_deletion_targets(50) where drive_file_id like '${RUN}%';
      select retention_mark_deletion_result((select id from retention_deletion_targets where drive_file_id='${RUN}-old'), false, 'Drive 500');
      select retention_finalize_deleted_smart_notes(1000, false);
      reset role;
      select 'after-failure:' || status || ':' || last_error from retention_deletion_targets where drive_file_id='${RUN}-old';
      select 'after-failure-link:' || coalesce(smart_notes_drive_file_id, 'NULL') from consultations where id = '${C_OLD}';
      update retention_deletion_targets set next_attempt_at = now() where drive_file_id='${RUN}-old';
      ${svc}
      select retention_mark_deletion_result((select id from retention_deletion_targets where drive_file_id='${RUN}-old'), true);
      select retention_finalize_deleted_smart_notes(1000, false);
      reset role;
      select 'after-success:' || coalesce(smart_notes_drive_file_id, 'NULL') from consultations where id = '${C_OLD}';
      select 'recent:' || coalesce(smart_notes_drive_file_id, 'NULL') from consultations where id = '${C_NEW}';
      select 'held:' || coalesce(smart_notes_drive_file_id, 'NULL') from consultations where id = '${C_HELD}';
    `));
    expect(out).toContain("after-failure:failed:Drive 500");
    expect(out).toContain(`after-failure-link:${RUN}-old`); // still linked after the FAILED attempt
    expect(out).toContain("after-success:NULL"); // cleared only after success
    expect(out).toContain(`recent:${RUN}-new`);
    expect(out).toContain(`held:${RUN}-held`);
  });

  it("a consultation legal hold placed after enqueue stops the worker from claiming the file", () => {
    const out = lines(run(`
      ${setup}
      insert into retention_deletion_targets (category, source_table, source_id, session_id, drive_file_id, due_at)
        values ('lesson_ai_artifacts','consultations','${C_HELD}', null, '${RUN}-held', now());
      ${svc}
      select count(*) from retention_claim_deletion_targets(50) where drive_file_id = '${RUN}-held';
    `));
    expect(out[out.length - 1]).toBe("0");
  });
});
