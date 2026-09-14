import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// 2026-09-07(발송 내역 목록 화면) — listDirectOnboardingLinksAction()이 읽는
// 쿼리 모양(consultation_id IS NULL인 trial_onboarding_links + 딸린
// trial_onboarding_link_students 상태 집계)이 실제로 지인/추천 링크 3건을
// 전부 잡아내는지 로컬 Postgres에 직접 psql로 검증한다(다른 통합 테스트와
// 동일한 shell-out 패턴 — requireAdminOrCapability는 admin 인증을 요구해
// vitest 환경에서 서버 액션을 직접 호출하기 어렵기 때문에, 액션이 그대로
// 실행하는 쿼리를 재현해 검증한다).

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function createDirectOnboardingLink(label: string): string {
  const now = Date.now();
  const guardianEmail = `m4-list-guardian-${label}-${now}@example.com`;
  const studentEmail = `m4-list-student-${label}-${now}@example.com`;
  return psql(`
    select link_id from create_direct_onboarding_link_multi(
      '${guardianEmail}', '목록테스트 보호자 ${label}',
      jsonb_build_array(
        jsonb_build_object('name', '학생${label}', 'email', '${studentEmail}', 'grade', '10학년')
      ),
      '${ADMIN_ID}'::uuid
    );
  `).trim();
}

describe("listDirectOnboardingLinksAction 쿼리 모양 (지인/추천 발송 내역 목록)", () => {
  it("consultation_id가 null인 링크 3건을 모두 조회하고, 각각 학생 수/상태 집계가 맞는다", () => {
    const linkA = createDirectOnboardingLink("a");
    const linkB = createDirectOnboardingLink("b");
    const linkC = createDirectOnboardingLink("c");

    // linkA는 정상 pending, linkB는 학생이 created 상태, linkC는 학생이 취소됨.
    const studentBId = psql(`select id from trial_onboarding_link_students where link_id = '${linkB}'::uuid limit 1;`);
    psql(`update trial_onboarding_link_students set status = 'created' where id = '${studentBId}'::uuid;`);
    const studentCId = psql(`select id from trial_onboarding_link_students where link_id = '${linkC}'::uuid limit 1;`);
    psql(`select cancel_trial_onboarding_link_student('${studentCId}'::uuid, '${ADMIN_ID}'::uuid, '취소');`);

    const rows = psql(`
      select l.id, l.consultation_id is null, count(s.id) filter (where s.status = 'created')
      from trial_onboarding_links l
      left join trial_onboarding_link_students s on s.link_id = l.id
      where l.id in ('${linkA}'::uuid, '${linkB}'::uuid, '${linkC}'::uuid)
      group by l.id
      order by l.id;
    `)
      .split("\n")
      .map((line) => line.split("|"));

    expect(rows).toHaveLength(3);
    for (const [, isDirectLink] of rows) {
      expect(isDirectLink).toBe("t"); // consultation_id가 전부 null
    }

    const createdCountByLink = new Map(rows.map(([id, , created]) => [id, Number(created)]));
    expect(createdCountByLink.get(linkA)).toBe(0);
    expect(createdCountByLink.get(linkB)).toBe(1);
    expect(createdCountByLink.get(linkC)).toBe(0);
  });
});
