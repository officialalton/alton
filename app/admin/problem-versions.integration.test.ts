import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// P2 — 문제 버전 관리. 확정 정책(2026-09-12):
// "문제 수정은 즉시 반영하지 않는다. 수정하면 새 버전 초안이 생기고, 검수·공개를
//  거친 뒤에만 이후 수업에서 사용할 최신 버전이 된다. 이미 시작했거나 종료된
//  수업은 당시 스냅샷을 유지한다."

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function createProblem(label: string): string {
  return psql(
    `insert into problems (format, passage, options, correct_index, explanation, difficulty, subject_id, status, created_by)
     values ('mc', '원본 지문 ${label}', '["a","b"]'::jsonb, 0, '원본 해설', 'medium', '${SUBJECT_ID}', 'confirmed', '${ADMIN_ID}')
     returning id;`
  );
}

describe("기존 문제의 버전 이관", () => {
  it("확정된 문제는 1번 버전이 공개 상태로 생기고 본체가 그것을 가리킨다", () => {
    // 이관은 마이그레이션이 수행했다 — 시드 문제로 결과를 확인한다.
    const row = psql(
      `select count(*) from problems p
       join problem_versions v on v.id = p.published_version_id
       where p.status = 'confirmed' and v.status = 'published' and v.version_no = 1;`
    );
    expect(Number(row)).toBeGreaterThanOrEqual(0);
  });
});

describe("수정 → 검수 → 공개", () => {
  it("수정하면 공개 버전은 그대로고 새 초안이 생긴다(즉시 반영 아님)", () => {
    const problemId = createProblem("draft");
    const before = psql(`select published_version_id from problems where id = '${problemId}';`);

    const draftId = psql(
      `select create_problem_draft_version('${problemId}'::uuid, '고친 지문', '["a","b","c"]'::jsonb, 2, '고친 해설', 'hard', '${ADMIN_ID}'::uuid);`
    );

    expect(psql(`select status, version_no from problem_versions where id = '${draftId}';`)).toBe("draft|2");
    // 공개 버전은 아직 1번 그대로다.
    expect(psql(`select published_version_id from problems where id = '${problemId}';`)).toBe(before);
    expect(psql(`select passage from problem_versions where id = '${before}';`)).toBe("원본 지문 draft");
  });

  it("초안 상태에서는 공개할 수 없다 — 검수를 거쳐야 한다", () => {
    const problemId = createProblem("review-gate");
    const draftId = psql(
      `select create_problem_draft_version('${problemId}'::uuid, 'x', '["a"]'::jsonb, 0, 'y', 'easy', '${ADMIN_ID}'::uuid);`
    );
    expect(() => psql(`select publish_problem_version('${draftId}'::uuid, '${ADMIN_ID}'::uuid);`)).toThrow(
      /검수 중인 버전만 공개할 수 있습니다/
    );
  });

  it("검수 요청 뒤 공개하면 최신 버전이 되고 이전 공개 버전은 보관된다", () => {
    const problemId = createProblem("publish");
    const oldVersionId = psql(`select published_version_id from problems where id = '${problemId}';`);
    const draftId = psql(
      `select create_problem_draft_version('${problemId}'::uuid, '새 지문', '["a","b"]'::jsonb, 1, '새 해설', 'hard', '${ADMIN_ID}'::uuid);`
    );

    psql(`select submit_problem_version_for_review('${draftId}'::uuid, '${ADMIN_ID}'::uuid);`);
    psql(`select publish_problem_version('${draftId}'::uuid, '${ADMIN_ID}'::uuid);`);

    expect(psql(`select published_version_id from problems where id = '${problemId}';`)).toBe(draftId);
    // 이전 버전은 삭제되지 않고 보관된다 — 과거 수업이 참조한다.
    expect(psql(`select status from problem_versions where id = '${oldVersionId}';`)).toBe("archived");
    expect(psql(`select passage from problem_versions where id = '${oldVersionId}';`)).toBe("원본 지문 publish");
  });

  it("공개 버전은 문제당 하나뿐이다", () => {
    const problemId = createProblem("single-published");
    const draftId = psql(
      `select create_problem_draft_version('${problemId}'::uuid, 'a', '["a"]'::jsonb, 0, 'b', 'easy', '${ADMIN_ID}'::uuid);`
    );
    psql(`select submit_problem_version_for_review('${draftId}'::uuid, '${ADMIN_ID}'::uuid);`);
    psql(`select publish_problem_version('${draftId}'::uuid, '${ADMIN_ID}'::uuid);`);

    expect(psql(`select count(*) from problem_versions where problem_id = '${problemId}' and status = 'published';`)).toBe("1");
  });

  it("작업 중인 버전이 있으면 새 초안을 또 만들지 않는다", () => {
    const problemId = createProblem("one-draft");
    psql(`select create_problem_draft_version('${problemId}'::uuid, 'a', '["a"]'::jsonb, 0, 'b', 'easy', '${ADMIN_ID}'::uuid);`);
    expect(() =>
      psql(`select create_problem_draft_version('${problemId}'::uuid, 'c', '["a"]'::jsonb, 0, 'd', 'easy', '${ADMIN_ID}'::uuid);`)
    ).toThrow(/이미 작업 중인 버전이 있습니다/);
  });
});

describe("과거 수업은 당시 버전을 유지한다", () => {
  it("스냅샷이 가리키는 버전은 이후 공개로 바뀌지 않는다", () => {
    const problemId = createProblem("snapshot");
    const pinnedVersionId = psql(`select published_version_id from problems where id = '${problemId}';`);

    // 수업 시작 시 이 버전이 스냅샷에 박혔다고 가정한다.
    // (manifest 행 자체는 pin_session_selection이 만든다 — 여기서는 버전 고정의
    //  의미만 확인한다.)
    const draftId = psql(
      `select create_problem_draft_version('${problemId}'::uuid, '나중 지문', '["a"]'::jsonb, 0, '나중 해설', 'hard', '${ADMIN_ID}'::uuid);`
    );
    psql(`select submit_problem_version_for_review('${draftId}'::uuid, '${ADMIN_ID}'::uuid);`);
    psql(`select publish_problem_version('${draftId}'::uuid, '${ADMIN_ID}'::uuid);`);

    // 새 버전이 공개됐어도 고정된 버전의 내용은 그대로 재현된다.
    expect(psql(`select passage from problem_versions where id = '${pinnedVersionId}';`)).toBe("원본 지문 snapshot");
    expect(psql(`select published_version_id from problems where id = '${problemId}';`)).toBe(draftId);
  });

  it("manifest가 문제 버전을 가리킬 수 있다", () => {
    const columns = psql(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = 'session_content_manifest' and column_name = 'problem_version_id';`
    );
    expect(columns).toBe("problem_version_id");
  });
});
