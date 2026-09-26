import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

// P2 8차 — 문제은행의 공개 흐름.
//
// 2026-09-13 제품 오너 지시:
//   "'검수 요청' 클릭은 없애되 공개 전 지문·선택지·정답·해설을 미리보고 확인하는
//    흐름은 유지합니다."
//   "내부의 초안 → 검수 중 → 공개 처리는 중간 실패로 상태가 어긋나지 않도록
//    합니다. 실제 별도 검수자가 승인한 것처럼 기록하지 않습니다."
//   "공개본에서 수정 초안을 만들 때 기존 수정 초안이 있으면 이를 안내하고 이어서
//    편집할 수 있게 합니다. 반복 클릭으로 초안이 불필요하게 늘어나지 않도록."
//   "키워드 없이 공개할 수 있는 정책은 유지하되…"

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function psqlExpectError(sql: string): string {
  try {
    execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    throw new Error("expected psql to fail, but it succeeded");
  } catch (err) {
    return (err as { stderr?: Buffer })?.stderr?.toString() ?? String(err);
  }
}

const uniq = () => `${Date.now()}_${Math.random()}`;
const cleanup: string[] = [];

afterEach(() => {
  for (const id of cleanup.splice(0)) {
    psql(`update problems set published_version_id = null where id = '${id}';
          delete from problem_versions where problem_id = '${id}';
          delete from problem_keywords where problem_id = '${id}';
          delete from problems where id = '${id}';`);
  }
});

/** 유형과 주제를 따로 받는 생성 경로. 둘 다 선택 항목이다. */
function newProblem(opts: { skillType?: string; topic?: string } = {}): string {
  const id = psql(
    `select create_bank_problem('${SUBJECT_ID}', 'mc', '${opts.skillType ?? ""}', '${opts.topic ?? ""}', 'medium', '${ADMIN_ID}');`
  );
  cleanup.push(id);
  return id;
}

function saveDraft(problemId: string, passage: string): string {
  return psql(
    `select save_problem_draft_version('${problemId}', '${passage}', '["ㄱ","ㄴ","ㄷ","ㄹ"]'::jsonb, 2, '해설', 'medium', '${ADMIN_ID}');`
  );
}

describe("유형과 주제는 다른 축이다", () => {
  it("생성할 때 둘을 따로 저장한다", () => {
    const id = newProblem({ skillType: "Words in Context", topic: "생태계" });
    const row = psql(
      `select coalesce(skill_type,'-') || '|' || coalesce(topic,'-') from problems where id = '${id}';`
    );
    expect(row).toBe("Words in Context|생태계");
  });

  it("둘 다 비워도 만들 수 있다 — 선택 항목이다", () => {
    const id = newProblem();
    const row = psql(
      `select coalesce(skill_type,'없음') || '|' || coalesce(topic,'없음') from problems where id = '${id}';`
    );
    expect(row).toBe("없음|없음");
  });
});

describe("확인하고 공개 — 한 동작, 한 트랜잭션", () => {
  it("초안을 바로 공개한다. 중간 상태가 남지 않는다", () => {
    const id = newProblem();
    const versionId = saveDraft(id, `공개 대상 ${uniq()}`);

    psql(`select confirm_and_publish_problem_version('${versionId}', '${ADMIN_ID}');`);

    expect(psql(`select status from problem_versions where id = '${versionId}';`)).toBe(
      "published"
    );
    // in_review 에 갇힌 버전이 남지 않는다.
    expect(
      psql(
        `select count(*) from problem_versions where problem_id = '${id}' and status = 'in_review';`
      )
    ).toBe("0");
  });

  it("별도 검수자가 승인한 것처럼 기록하지 않는다", () => {
    const id = newProblem();
    const versionId = saveDraft(id, `기록 확인 ${uniq()}`);
    psql(`select confirm_and_publish_problem_version('${versionId}', '${ADMIN_ID}');`);

    const row = psql(
      `select review_kind || '|' || (submitted_by = published_by)::text
       from problem_versions where id = '${versionId}';`
    );
    expect(row).toBe("self_confirmed|true");
  });

  it("같은 버전을 다시 공개해도 아무것도 바뀌지 않는다 — 중복 클릭", () => {
    const id = newProblem();
    const versionId = saveDraft(id, `중복 클릭 ${uniq()}`);
    psql(`select confirm_and_publish_problem_version('${versionId}', '${ADMIN_ID}');`);
    const first = psql(`select published_at from problem_versions where id = '${versionId}';`);

    psql(`select confirm_and_publish_problem_version('${versionId}', '${ADMIN_ID}');`);
    psql(`select confirm_and_publish_problem_version('${versionId}', '${ADMIN_ID}');`);

    expect(psql(`select published_at from problem_versions where id = '${versionId}';`)).toBe(
      first
    );
    // 문제당 공개본은 여전히 하나다.
    expect(
      psql(
        `select count(*) from problem_versions where problem_id = '${id}' and status = 'published';`
      )
    ).toBe("1");
  });

  it("지난 공개본은 되살리지 않는다 — 수정 초안을 만들어야 한다", () => {
    const id = newProblem();
    const v1 = saveDraft(id, `1판 ${uniq()}`);
    psql(`select confirm_and_publish_problem_version('${v1}', '${ADMIN_ID}');`);
    const v2 = saveDraft(id, `2판 ${uniq()}`);
    psql(`select confirm_and_publish_problem_version('${v2}', '${ADMIN_ID}');`);

    expect(psql(`select status from problem_versions where id = '${v1}';`)).toBe("archived");
    const err = psqlExpectError(
      `select confirm_and_publish_problem_version('${v1}', '${ADMIN_ID}');`
    );
    expect(err).toContain("지난 공개본");
  });
});

describe("공개본은 고치지 않는다 — 수정은 새 버전이다", () => {
  it("재공개해도 이전 공개본의 내용은 그대로 남는다", () => {
    const id = newProblem();
    const first = `원래 지문 ${uniq()}`;
    const v1 = saveDraft(id, first);
    psql(`select confirm_and_publish_problem_version('${v1}', '${ADMIN_ID}');`);

    const v2 = saveDraft(id, `고친 지문 ${uniq()}`);
    psql(`select confirm_and_publish_problem_version('${v2}', '${ADMIN_ID}');`);

    expect(psql(`select passage from problem_versions where id = '${v1}';`)).toBe(first);
    expect(v2).not.toBe(v1);
  });

  it("작업 중인 초안이 있으면 새 초안을 만들지 않고 그것을 고친다", () => {
    const id = newProblem();
    const v1 = saveDraft(id, `1판 ${uniq()}`);
    psql(`select confirm_and_publish_problem_version('${v1}', '${ADMIN_ID}');`);

    const a = saveDraft(id, `수정 중 ${uniq()}`);
    const b = saveDraft(id, `더 수정 ${uniq()}`);
    expect(b).toBe(a);
    expect(
      psql(
        `select count(*) from problem_versions where problem_id = '${id}' and status = 'draft';`
      )
    ).toBe("1");
  });
});

describe("키워드 없이도 공개된다 — 다만 구성 후보는 아니다", () => {
  it("키워드가 없어도 공개까지 간다", () => {
    const id = newProblem();
    const versionId = saveDraft(id, `키워드 없음 ${uniq()}`);
    psql(`select confirm_and_publish_problem_version('${versionId}', '${ADMIN_ID}');`);
    expect(psql(`select status from problems where id = '${id}';`)).toBe("confirmed");
  });

  it("그 사유가 no_keyword 로 드러난다", () => {
    const id = newProblem();
    const versionId = saveDraft(id, `사유 확인 ${uniq()}`);
    psql(`select confirm_and_publish_problem_version('${versionId}', '${ADMIN_ID}');`);
    expect(
      psql(`select readiness from problem_composition_readiness where problem_id = '${id}';`)
    ).toBe("no_keyword");
  });

  it("키워드를 붙이면 후보가 된다", () => {
    const id = newProblem();
    const versionId = saveDraft(id, `키워드 붙임 ${uniq()}`);
    psql(`select confirm_and_publish_problem_version('${versionId}', '${ADMIN_ID}');`);

    const keywordId = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', '8차키워드 ${uniq()}') returning id;`
    );
    psql(
      `insert into problem_keywords (problem_id, keyword_id) values ('${id}', '${keywordId}');`
    );

    expect(
      psql(`select readiness from problem_composition_readiness where problem_id = '${id}';`)
    ).toBe("ok");
    psql(`delete from problem_keywords where keyword_id = '${keywordId}';
          delete from subject_keywords where id = '${keywordId}';`);
  });
});

describe("선택지 개수는 드러내되 건드리지 않는다", () => {
  it("4개가 아닌 기존 버전을 잘라내지 않고 목록에만 올린다", () => {
    const id = newProblem();
    const versionId = psql(
      `select save_problem_draft_version('${id}', '보기 두 개 ${uniq()}', '["a","b"]'::jsonb, 0, '해설', 'medium', '${ADMIN_ID}');`
    );
    expect(
      psql(
        `select option_count from problem_option_count_anomalies where version_id = '${versionId}';`
      )
    ).toBe("2");
    // 값 자체는 그대로다.
    expect(
      psql(`select jsonb_array_length(options) from problem_versions where id = '${versionId}';`)
    ).toBe("2");
  });
});
