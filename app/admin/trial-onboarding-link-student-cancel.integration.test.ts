import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// 2026-09-07(UAT 후속) — 지인/추천 온보딩 링크에서 잘못된 이메일로 등록된
// 학생을 관리자가 "취소"할 수 있는지, 취소된 학생이 finalize_trial_onboarding_students()에서
// 실제로 건너뛰어지는지(계정/체험수업권 생성 대상에서 제외)를 로컬 Postgres에
// 직접 psql로 검증한다(다른 통합 테스트와 동일한 shell-out 패턴).

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function createDirectOnboardingLink(label: string): { linkId: string; studentIds: string[] } {
  const now = Date.now();
  const guardianEmail = `m4-cancel-guardian-${label}-${now}@example.com`;
  const goodStudentEmail = `m4-cancel-good-${label}-${now}@example.com`;
  const badStudentEmail = `not-a-real-address-${label}-${now}`; // 형식은 유효(psql 레벨에서는 검증 없음)하지만 시나리오상 "잘못된 이메일"
  const linkId = psql(`
    select link_id from create_direct_onboarding_link_multi(
      '${guardianEmail}', '취소테스트 보호자',
      jsonb_build_array(
        jsonb_build_object('name', '정상학생', 'email', '${goodStudentEmail}', 'grade', '10학년'),
        jsonb_build_object('name', '오타학생', 'email', '${badStudentEmail}@example.com', 'grade', '9학년')
      ),
      '${ADMIN_ID}'::uuid
    );
  `).trim();
  const studentIdsOut = psql(
    `select id from trial_onboarding_link_students where link_id = '${linkId}'::uuid order by created_at asc;`
  );
  const studentIds = studentIdsOut.split("\n").map((s) => s.trim()).filter(Boolean);
  return { linkId, studentIds };
}

describe("cancel_trial_onboarding_link_student / finalize_trial_onboarding_students (지인/추천 취소)", () => {
  it("pending 학생을 취소하면 status가 cancelled로 바뀌고 링크 이벤트가 남는다", () => {
    const { studentIds } = createDirectOnboardingLink("basic");
    const targetId = studentIds[1];

    psql(`select cancel_trial_onboarding_link_student('${targetId}'::uuid, '${ADMIN_ID}'::uuid, '잘못된 이메일');`);

    const status = psql(`select status from trial_onboarding_link_students where id = '${targetId}'::uuid;`);
    expect(status).toBe("cancelled");

    const eventType = psql(
      `select event_type from trial_onboarding_link_events where detail->>'link_student_id' = '${targetId}' order by created_at desc limit 1;`
    );
    expect(eventType).toBe("student_cancelled");
  });

  it("이미 계정이 생성된(created) 학생은 취소할 수 없다", () => {
    const { studentIds } = createDirectOnboardingLink("created-guard");
    const targetId = studentIds[0];
    psql(`update trial_onboarding_link_students set status = 'created' where id = '${targetId}'::uuid;`);

    expect(() =>
      psql(`select cancel_trial_onboarding_link_student('${targetId}'::uuid, '${ADMIN_ID}'::uuid, null);`)
    ).toThrow(/이미 계정이 생성된 학생은 취소할 수 없습니다/);
  });

  it("취소된 학생은 finalize_trial_onboarding_students()에서 계정 생성 없이 건너뛰어진다", () => {
    const now = Date.now();
    const { linkId, studentIds } = createDirectOnboardingLink("finalize");
    const [keepId, cancelId] = studentIds;

    psql(`select cancel_trial_onboarding_link_student('${cancelId}'::uuid, '${ADMIN_ID}'::uuid, '잘못된 이메일');`);

    // 보호자용 auth.users 계정 + 취소되지 않은 학생용 auth.users 계정을 미리
    // 만들어 finalize에 넘긴다(실제 redeem 플로우는 lib/trial-onboarding-finalize.ts가
    // auth.admin.createUser로 만들지만, 여기서는 DB 함수 자체의 skip 동작만 검증한다).
    const guardianAuthId = psql(`
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'm4-cancel-finalize-guardian-${now}@example.com', 'x', now(), '{}', '{}', now(), now())
      returning id;
    `);
    const keepAuthId = psql(`
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'm4-cancel-finalize-keep-${now}@example.com', 'x', now(), '{}', '{}', now(), now())
      returning id;
    `);
    // 취소된 학생용 auth.users도 만들어보되(실제로는 만들 필요조차 없어야 정상) finalize에
    // link_student_id/child_auth_user_id 쌍으로 넘겨 "만들려고 시도해도 무시되는지" 검증한다.
    const cancelledAuthId = psql(`
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'm4-cancel-finalize-cancelled-${now}@example.com', 'x', now(), '{}', '{}', now(), now())
      returning id;
    `);

    const result = psql(`
      select created_count, failed_count from finalize_trial_onboarding_students(
        '${linkId}'::uuid, true, '${guardianAuthId}'::uuid, '취소테스트 보호자',
        jsonb_build_array(
          jsonb_build_object('link_student_id', '${keepId}', 'child_auth_user_id', '${keepAuthId}'),
          jsonb_build_object('link_student_id', '${cancelId}', 'child_auth_user_id', '${cancelledAuthId}')
        )
      );
    `);
    const [createdCount, failedCount] = result.split("|").map(Number);
    expect(createdCount).toBe(1); // keepId만 생성됨
    expect(failedCount).toBe(0); // cancelId는 실패도 아니고 그냥 건너뜀

    const keepStatus = psql(`select status from trial_onboarding_link_students where id = '${keepId}'::uuid;`);
    expect(keepStatus).toBe("created");
    const cancelStatus = psql(`select status from trial_onboarding_link_students where id = '${cancelId}'::uuid;`);
    expect(cancelStatus).toBe("cancelled"); // 그대로 유지 — created로 바뀌지 않음

    const profileExists = psql(`select count(*) from profiles where id = '${cancelledAuthId}'::uuid;`);
    expect(profileExists).toBe("0"); // 취소된 학생은 profiles/students row가 생기지 않는다
  });
});
