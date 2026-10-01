import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// M4 (6/N) — 보호자가 온보딩 중 로그인 이메일을 prospect 이메일과 다른 주소로
// 바꾸는 예외 흐름을 로컬 Postgres에 직접 psql로 검증한다(정상/중복계정/
// 미검증 차단 3가지). 실제 외부 이메일은 추가로 요구하지 않는다 — 여기서는
// DB 함수(request_trial_login_email_change/confirm_trial_login_email_change)
// 자체의 정확성만 고정하고, 실제 발송은 app/admin/trial-onboarding-actions.test.ts
// 의 mock 테스트가 이미 다룬다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

let consultationId: string;
let linkId: string;

beforeAll(() => {
  const now = Date.now();
  const prospectContactId = psql(
    `insert into prospect_contacts (full_name, primary_email) values ('이메일변경테스트', 'prospect-${now}@example.com') returning id;`
  );
  consultationId = psql(
    `insert into consultations (source, status, outcome, contact_name, contact_email, starts_at, ends_at, prospect_contact_id, trial_intent_confirmed_at)
     values ('homepage', 'completed', 'trial_recommended', '이메일변경테스트', 'prospect-${now}@example.com', now(), now() + interval '30 minutes', '${prospectContactId}', now())
     returning id;`
  );
  linkId = psql(
    `insert into trial_onboarding_links (consultation_id, prospect_contact_id, guardian_email, guardian_name, student_name, student_email, token_hash, expires_at)
     values ('${consultationId}', '${prospectContactId}', 'prospect-${now}@example.com', '이메일변경테스트', '학생', 'student-${now}@example.com', 'unused-hash-${now}', now() + interval '72 hours')
     returning id;`
  );
});

afterAll(() => {
  psql(`
    delete from trial_login_email_change_requests where link_id = '${linkId}';
    delete from trial_onboarding_link_events where link_id = '${linkId}';
    delete from trial_onboarding_links where id = '${linkId}';
    delete from consultations where id = '${consultationId}';
  `);
});

describe("보호자 로그인 이메일 변경 예외 흐름", () => {
  it("정상: 아무도 안 쓰는 새 이메일이면 토큰이 발급되고, 확인하면 requested_email이 반환된다(계정은 아직 안 만들어짐)", () => {
    const row = psql(
      `select request_id, raw_token, conflict from request_trial_login_email_change('${linkId}', 'new-login@example.com');`
    );
    const [, rawToken, conflict] = row.split("|");
    expect(conflict).toBe("f");
    expect(rawToken).not.toBe("");

    const confirmed = psql(`select link_id, requested_email from confirm_trial_login_email_change('${rawToken}');`);
    expect(confirmed).toBe(`${linkId}|new-login@example.com`);

    // 이 함수 자체는 auth.users/profiles/students/households 어느 것도 건드리지
    // 않는다 — 실제 계정 생성은 app/api/trial-onboarding/confirm-email-change
    // 라우트가 이 확인 결과를 받은 "다음" 단계에서만 한다(검증 끝나기 전에는
    // 학생·수업권·계약을 연결하지 않는다는 요구사항).
    const guardianAccountExists = psql(
      `select count(*) from auth.users where lower(email) = 'new-login@example.com';`
    );
    expect(guardianAccountExists).toBe("0");
  });

  it("중복 계정: 이미 다른 계정이 쓰는 이메일이면 토큰을 주지 않고 conflict로만 기록한다(자동 병합 없음)", () => {
    const existingEmail = psql(`select email from auth.users where email is not null limit 1;`);
    const row = psql(
      `select request_id, raw_token, conflict from request_trial_login_email_change('${linkId}', '${existingEmail}');`
    );
    const [, rawToken, conflict] = row.split("|");
    expect(conflict).toBe("t");
    expect(rawToken).toBe(""); // 토큰이 발급되지 않았다 — 확인 메일을 보낼 수 없다.

    const eventType = psql(
      `select event_type from trial_onboarding_link_events where link_id = '${linkId}' and event_type = 'conflict_manual_review' order by created_at desc limit 1;`
    );
    expect(eventType).toBe("conflict_manual_review");
  });

  it("미검증 차단: 존재하지 않거나 만료된 토큰으로는 확인이 통과하지 않는다", () => {
    expect(() => psql(`select confirm_trial_login_email_change('this-token-does-not-exist');`)).toThrow(
      /유효하지 않은 확인 링크/
    );
  });
});
