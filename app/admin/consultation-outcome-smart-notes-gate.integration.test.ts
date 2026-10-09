import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";

// M4 후속(2026-09-06, 2차 완화) — admin_record_consultation_outcome()이 Smart Notes
// 원본 실제 연결(smart_notes_drive_file_id)과 Smart Notes 활성화 상태
// (smart_notes_config_status) 둘 다와 무관하게 결과 기록을 허용하는지 로컬
// Postgres에 직접 psql로 검증한다(둘 다 제품 오너 확정으로 제거).
//
// 2026-09-28(초기 고객 절차 단순화) — 첫 상담에는 AI 기록을 아예 안 쓰므로
// 동의 확인(consent_confirmed_at) 게이트도 제거됐다. 이제 남은 조건은 관리자
// 검토 요약(admin_review_summary) 하나뿐이다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";

// 2026-09-29(20261910000000) — 컨설턴트 없이는 scheduled 상담을 만들 수 없다. 이 테스트 전용
// 고정 컨설턴트를 한 번 만들어 두고(멱등) 모든 scheduled 상담에 붙인다.
const CONSULTANT_ID = "cccccccc-0000-0000-0000-00000000a0b1";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

beforeAll(() => {
  psql(`
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ('00000000-0000-0000-0000-000000000000', '${CONSULTANT_ID}', 'authenticated', 'authenticated', 'outcome-gate-consultant@example.com',
      crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '')
    on conflict (id) do nothing;
    insert into profiles (id, role, name) values ('${CONSULTANT_ID}', 'consultant', 'outcome-gate-consultant')
    on conflict (id) do nothing;
  `);
});

function psqlAsAdmin(sql: string): string {
  return psql(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
    ${sql}
    reset role;
  `);
}

// 재실행 안전: version_label·contact_email은 고유 제약/조회 키이므로 실행마다
// 고유 접미사를 붙인다.
const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function createConsultation(baseLabel: string, opts: { consent: boolean; smartNotesApplied: boolean }): string {
  const label = `${baseLabel}-${RUN_ID}`;
  // is_active=false: 앱·DB는 "is_active=true 중 최신 created_at"을 현재 상담 동의
  // 문안으로 쓴다(admin_accept_consultation 등). 이 테스트가 넣는 문안이 그
  // "현재 문안"을 가로채지 않도록 비활성으로 둔다 — 결과 기록 게이트는 동의
  // 문안의 활성 여부를 보지 않으므로 검증 내용은 같다.
  const policyId = psql(
    `insert into consult_consent_versions (version_label, title, body_markdown, is_placeholder, is_active, effective_at)
     values ('${label}-v1', 'ALTON 개인정보 처리방침 ${label}', '테스트용 본문', false, false, now() - interval '1 day')
     returning id;`
  );
  const consultationId = psql(
    `insert into consultations (contact_name, contact_email, status, admissions_consultant_id, scheduled_at,
       consent_version_id, consent_confirmed_at, smart_notes_config_status)
     values ('테스트 ${label}', '${label}@example.com', 'scheduled', '${CONSULTANT_ID}', now() - interval '1 hour',
       ${opts.consent ? `'${policyId}'` : "null"}, ${opts.consent ? "now()" : "null"},
       '${opts.smartNotesApplied ? "applied" : "pending"}')
     returning id;`
  );
  return consultationId;
}

describe("admin_record_consultation_outcome() — Smart Notes 상태와 무관하게 결과 기록 허용", () => {
  it("동의 확인 + 검토 요약만 있으면, Smart Notes 미활성화·원본 미연결이어도 결과를 기록할 수 있다", () => {
    const consultationId = createConsultation("gate-relax-ok", { consent: true, smartNotesApplied: false });
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

  it("2026-09-28(초기 고객 절차 단순화): 동의 확인이 없어도 더 이상 거부되지 않는다", () => {
    const consultationId = createConsultation("gate-relax-no-consent", { consent: false, smartNotesApplied: true });
    psqlAsAdmin(`select admin_record_consultation_outcome('${consultationId}', 'closed', null, '요약');`);
    const [status, outcome] = psql(`select status, outcome from consultations where id = '${consultationId}';`).split("|");
    expect(status).toBe("completed");
    expect(outcome).toBe("closed");
  });

  it("2026-09-06(2차 완화): Smart Notes가 활성화(applied)되지 않았어도 더 이상 거부되지 않는다", () => {
    const consultationId = createConsultation("gate-relax-no-smart-notes", { consent: true, smartNotesApplied: false });
    psqlAsAdmin(`select admin_record_consultation_outcome('${consultationId}', 'closed', null, '요약');`);
    const [status, outcome] = psql(`select status, outcome from consultations where id = '${consultationId}';`).split("|");
    expect(status).toBe("completed");
    expect(outcome).toBe("closed");
  });

  it("관리자 검토 요약이 비어 있으면 여전히 거부된다", () => {
    const consultationId = createConsultation("gate-relax-no-summary", { consent: true, smartNotesApplied: true });
    expect(() =>
      psqlAsAdmin(`select admin_record_consultation_outcome('${consultationId}', 'closed', null, '');`)
    ).toThrow(/검토 요약을 작성해야/);
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

// 2026-09-28(초기 고객 절차 단순화) — 체험 Smart Notes 동의 화면(및 그 화면의
// "동의 버튼 클릭 시 지급 시도" 트리거)을 없앴으므로, admin_record_consultation_outcome()
// 이 outcome='trial_recommended'를 기록하는 시점에 자동으로 체험수업권 지급을
// 시도하도록 바꿨다(20261900000025). 그 연결고리가 실제로 동작하는지 검증한다.
describe("admin_record_consultation_outcome() — outcome='trial_recommended' 기록 시 체험수업권 자동 지급", () => {
  function createChildAuthProfile(label: string): string {
    const id = psql(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${label}-${Date.now()}@example.com', 'x', now(), '{}', '{}', now(), now())
       returning id;`
    );
    psql(`insert into profiles (id, role, name) values ('${id}', 'student', '${label}');`);
    psql(`insert into students (id, grade, status) values ('${id}', '10학년', 'active');`);
    return id;
  }

  it("child_id가 연결된 상담에 outcome='trial_recommended'를 기록하면 별도 동의 없이 체험수업권이 즉시 지급된다", () => {
    const childId = createChildAuthProfile("auto-grant-child");
    const consultationId = psql(
      `insert into consultations (source, status, contact_name, contact_email, child_id, admissions_consultant_id, scheduled_at)
       values ('homepage', 'scheduled', '자동지급 테스트', 'auto-grant-${Date.now()}@example.com', '${childId}', '${CONSULTANT_ID}', now() - interval '1 hour')
       returning id;`
    );

    psqlAsAdmin(
      `select admin_record_consultation_outcome('${consultationId}', 'trial_recommended', null, '전화 상담 완료, 체험 진행 권장');`
    );
    const [status, hasGrant] = psql(
      `select trial_entitlement_grant_status, (trial_entitlement_grant_id is not null) from consultations where id = '${consultationId}';`
    ).split("|");
    expect(status).toBe("granted");
    expect(hasGrant).toBe("t");

    const grantCount = psql(
      `select count(*) from entitlement_grants eg join entitlement_products ep on ep.id = eg.entitlement_product_id
       where eg.child_id = '${childId}' and ep.code = 'trial_lesson_grant';`
    );
    expect(grantCount).toBe("1");
  });

  it("이미 체험수업권이 지급된 상담을 다시 기록해도 중복 지급하지 않는다(멱등)", () => {
    const childId = createChildAuthProfile("auto-grant-idempotent-child");
    const consultationId = psql(
      `insert into consultations (source, status, contact_name, contact_email, child_id, admissions_consultant_id, scheduled_at)
       values ('homepage', 'scheduled', '멱등 테스트', 'auto-grant-idem-${Date.now()}@example.com', '${childId}', '${CONSULTANT_ID}', now() - interval '1 hour')
       returning id;`
    );
    psqlAsAdmin(
      `select admin_record_consultation_outcome('${consultationId}', 'trial_recommended', null, '1차 기록');`
    );
    psqlAsAdmin(
      `select admin_record_consultation_outcome('${consultationId}', 'trial_recommended', null, '2차 기록(재확정)');`
    );

    const grantCount = psql(
      `select count(*) from entitlement_grants eg join entitlement_products ep on ep.id = eg.entitlement_product_id
       where eg.child_id = '${childId}' and ep.code = 'trial_lesson_grant';`
    );
    expect(grantCount).toBe("1");
  });
});
