import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { FIRST_CONSULTATION_CONSENT_VERSION } from "@/lib/consultation/first-consultation-consent";

// The request-time consent stamp (20262100000230): submit_homepage_consult_request stores the accepted wording version + time
// on the consultation, and nothing is stamped when no consent was given. Each statement runs in one rolled-back transaction
// with run-id emails, so nothing is left behind.
const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const RUN = `fc-${Date.now()}`;

function run(sql: string): string[] {
  try {
    const out = execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A"], {
      encoding: "utf-8",
      input: `begin; ${sql} rollback;`,
    });
    return out.trim().split("\n").filter((l) => l && !/^(BEGIN|ROLLBACK)$/.test(l));
  } catch (e) {
    throw new Error(String((e as { stderr?: string }).stderr ?? e));
  }
}

describe("first-consultation AI notes consent stamp", () => {
  it("stores the accepted wording version and a timestamp when the request carries the consent", () => {
    const out = run(`
      select id from submit_homepage_consult_request('${RUN} A', '${RUN}-a@example.com', null, null, null, null, '${RUN}-ka', '${FIRST_CONSULTATION_CONSENT_VERSION}');
      select ai_notes_consent_version || '|' || (ai_notes_consent_at is not null)::text from consultations where idempotency_key = '${RUN}-ka';
    `);
    expect(out[out.length - 1]).toBe(`${FIRST_CONSULTATION_CONSENT_VERSION}|true`);
  });

  it("leaves the stamp empty when no consent version is passed (no Smart Notes generation or linking)", () => {
    const out = run(`
      select id from submit_homepage_consult_request('${RUN} B', '${RUN}-b@example.com', null, null, null, null, '${RUN}-kb');
      select coalesce(ai_notes_consent_version, 'NULL') || '|' || (ai_notes_consent_at is null)::text from consultations where idempotency_key = '${RUN}-kb';
    `);
    expect(out[out.length - 1]).toBe("NULL|true");
  });

  it("a blank version is not a consent, and the idempotent re-submit returns the same row without restamping", () => {
    const out = run(`
      select id from submit_homepage_consult_request('${RUN} C', '${RUN}-c@example.com', null, null, null, null, '${RUN}-kc', '   ');
      select coalesce(ai_notes_consent_version, 'NULL') from consultations where idempotency_key = '${RUN}-kc';
      select id from submit_homepage_consult_request('${RUN} C', '${RUN}-c@example.com', null, null, null, null, '${RUN}-kc', '${FIRST_CONSULTATION_CONSENT_VERSION}');
      select coalesce(ai_notes_consent_version, 'NULL') from consultations where idempotency_key = '${RUN}-kc';
    `);
    expect(out[1]).toBe("NULL");
    expect(out[3]).toBe("NULL"); // the existing row is returned as-is; a later submit never restamps it
  });
});
