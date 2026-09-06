import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// M4 후속(2026-09-06) — admin_record_consultation_outcome()이 Smart Notes 원본 실제
// 연결(smart_notes_drive_file_id) 여부와 무관하게 결과 기록을 허용하는지 로컬
// Postgres에 직접 psql로 검증한다(비동기 도착 산출물이 정상 업무 흐름을 막지
// 않도록 완화한 확정 정책). 동의 확인·Smart Notes 활성화·검토 요약은 여전히
// 강제돼야 한다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function psqlAsAdmin(sql: string): string {
  return psql(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
    ${sql}
    reset role;
  `);
}

function createConsultation(label: string, opts: { consent: boolean; smartNotesApplied: boolean }): string {
  const policyId = psql(
    `insert into consult_consent_versions (version_label, title, body_markdown, is_placeholder, is_active, effective_at)
     values ('${label}-v1', 'ALTON 개인정보 처리방침 ${label}', '테스트용 본문', false, true, now() - interval '1 day')
     returning id;`
  );
  const consultationId = psql(
    `insert into consultations (contact_name, contact_email, status, scheduled_at,
       consent_version_id, consent_confirmed_at, smart_notes_config_status)
     values ('테스트 ${label}', '${label}@example.com', 'scheduled', now() - interval '1 hour',
       ${opts.consent ? `'${policyId}'` : "null"}, ${opts.consent ? "now()" : "null"},
       '${opts.smartNotesApplied ? "applied" : "pending"}')
     returning id;`
  );
  return consultationId;
}

describe("admin_record_consultation_outcome() — Smart Notes 원본 연결 여부와 무관하게 결과 기록 허용", () => {
  it("동의 확인 + Smart Notes 활성화 + 검토 요약만 있으면, 원본이 아직 연결되지 않아도(smart_notes_drive_file_id null) 결과를 기록할 수 있다", () => {
    const consultationId = createConsultation("gate-relax-ok", { consent: true, smartNotesApplied: true });
    const driveFileId = psql(`select coalesce(smart_notes_drive_file_id, 'null') from consultations where id = '${consultationId}';`);
    expect(driveFileId).toBe("null");

    psqlAsAdmin(
      `select admin_record_consultation_outcome('${consultationId}', 'closed', null, '전화로 충분히 상담 완료, 원본 도착 전 기록');`
    );

    const [status, outcome, summary] = psql(
      `select status, outcome, admin_review_summary from consultations where id = '${consultationId}';`
    ).split("|");
    expect(status).toBe("completed");
    expect(outcome).toBe("closed");
    expect(summary).toBe("전화로 충분히 상담 완료, 원본 도착 전 기록");
  });

  it("동의 확인이 없으면 여전히 거부된다", () => {
    const consultationId = createConsultation("gate-relax-no-consent", { consent: false, smartNotesApplied: true });
    expect(() =>
      psqlAsAdmin(`select admin_record_consultation_outcome('${consultationId}', 'closed', null, '요약');`)
    ).toThrow(/동의 확인이 완료되지 않아/);
  });

  it("Smart Notes가 활성화(applied)되지 않았으면 여전히 거부된다", () => {
    const consultationId = createConsultation("gate-relax-no-smart-notes", { consent: true, smartNotesApplied: false });
    expect(() =>
      psqlAsAdmin(`select admin_record_consultation_outcome('${consultationId}', 'closed', null, '요약');`)
    ).toThrow(/Smart Notes 활성화가 확인되지 않아/);
  });

  it("관리자 검토 요약이 비어 있으면 여전히 거부된다", () => {
    const consultationId = createConsultation("gate-relax-no-summary", { consent: true, smartNotesApplied: true });
    expect(() =>
      psqlAsAdmin(`select admin_record_consultation_outcome('${consultationId}', 'closed', null, '');`)
    ).toThrow(/관리자 검토 요약을 작성해야/);
  });

  it("원본이 나중에 도착해 자동 연결되면(smart_notes_drive_file_id) 상담 행에서 그대로 조회 가능하다", () => {
    const consultationId = createConsultation("gate-relax-later-link", { consent: true, smartNotesApplied: true });
    psqlAsAdmin(
      `select admin_record_consultation_outcome('${consultationId}', 'closed', null, '원본 도착 전 기록');`
    );
    // 원본이 뒤늦게 연결되는 상황을 재현(실제로는 Workspace 이벤트 처리가 채운다).
    psql(`update consultations set smart_notes_drive_file_id = 'drive-file-123' where id = '${consultationId}';`);
    const driveFileId = psql(`select smart_notes_drive_file_id from consultations where id = '${consultationId}';`);
    expect(driveFileId).toBe("drive-file-123");
  });
});
