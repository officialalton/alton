import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// 2026-09-29 — regular_recommended 상담은 '체험 진행 확정' 없이도 온보딩 링크를 발급할 수 있다.
// 체험 경로(trial_recommended 등)는 여전히 trial_intent_confirmed_at을 요구한다.
// 실행마다 고유 행만 만들고 그 행만 조회한다(재실행 안전).

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const RUN = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
function psqlFails(sql: string): string {
  try {
    psql(sql);
  } catch (e) {
    return String((e as { stderr?: string }).stderr ?? e);
  }
  throw new Error("expected failure");
}
function authUser(label: string): string {
  return psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${label}-${RUN}@example.com', 'x', now(), '{}', '{}', now(), now()) returning id;`
  ).split("\n")[0];
}
function consultation(outcome: string | null, confirmed: boolean): string {
  const pc = psql(
    `insert into prospect_contacts (full_name, primary_email) values ('링크가족-${RUN}', 'rr-link-${RUN}-${Math.random().toString(36).slice(2, 6)}@example.com') returning id;`
  ).split("\n")[0];
  return psql(
    `insert into consultations (source, status, outcome, contact_name, contact_email, starts_at, ends_at, prospect_contact_id, trial_intent_confirmed_at)
     values ('homepage', 'completed', ${outcome ? `'${outcome}'` : "null"}, '링크가족-${RUN}', 'rr-${RUN}@example.com', now(), now() + interval '30 minutes', '${pc}', ${confirmed ? "now()" : "null"}) returning id;`
  ).split("\n")[0];
}
const studentsJson = (n: string) => `'[{"name":"학생${n}","email":"rr-stu-${n}-${RUN}@example.com","grade":"9학년"}]'::jsonb`;
function createLink(cid: string, admin: string, n = "a") {
  return `select link_id from create_trial_onboarding_link_multi('${cid}', 'g-${RUN}@example.com', '보호자', ${studentsJson(n)}, '${admin}');`;
}

describe("create_trial_onboarding_link_multi — regular_recommended 가드", () => {
  const admin = authUser("rr-link-admin");
  psql(`insert into profiles (id, role, name) values ('${admin}', 'admin', 'rr-link-admin-${RUN}') on conflict do nothing;`);

  it("regular_recommended는 체험 확정 없이 링크 발급 가능", () => {
    const cid = consultation("regular_recommended", false);
    expect(psql(createLink(cid, admin)).length).toBeGreaterThan(10);
  });

  it("trial_recommended는 체험 확정 없으면 거부, 확정하면 허용", () => {
    const cid = consultation("trial_recommended", false);
    expect(psqlFails(createLink(cid, admin))).toContain("체험 진행 확정");
    const ok = consultation("trial_recommended", true);
    expect(psql(createLink(ok, admin)).length).toBeGreaterThan(10);
  });

  it("on_hold / closed / null outcome은 확정 없으면 거부", () => {
    for (const o of ["on_hold", "closed", null]) {
      expect(psqlFails(createLink(consultation(o, false), admin))).toContain("체험 진행 확정");
    }
  });

  it("anon/authenticated 호출자는 거부(execute 권한 없음)", () => {
    const cid = consultation("regular_recommended", false);
    for (const role of ["anon", "authenticated"]) {
      expect(psqlFails(`set role ${role}; ${createLink(cid, admin)}`)).toMatch(/permission denied/);
    }
  });

  it("finalize: 자녀 생성, regular_recommended 계약 job 정확히 1건, 체험수업권 지급 없음", () => {
    const cid = consultation("regular_recommended", false);
    const linkId = psql(createLink(cid, admin, "f"));
    const studentLinkId = psql(`select id from trial_onboarding_link_students where link_id='${linkId}';`);
    const guardian = authUser("rr-link-guardian");
    const child = authUser("rr-link-child");
    const items = JSON.stringify([{ link_student_id: studentLinkId, child_auth_user_id: child }]);
    psql(`select finalize_trial_onboarding_students('${linkId}', true, '${guardian}', '보호자', '${items}'::jsonb);`);
    expect(psql(`select outcome from consultations where family_root_consultation_id='${cid}' and is_child_onboarding_card;`)).toBe("regular_recommended");
    expect(psql(`select count(*) from contract_dispatch_jobs where child_id='${child}' and trigger_type='regular_recommended';`)).toBe("1");
    expect(psql(`select count(*) from contract_dispatch_jobs where child_id='${child}';`)).toBe("1");
    expect(
      psql(`select trial_entitlement_grant_status::text || ':' || coalesce(trial_entitlement_grant_id::text,'') from consultations where family_root_consultation_id='${cid}' and is_child_onboarding_card;`)
    ).toBe("not_applicable:");
  });
});
