import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

// P2 3차 — 문제은행의 DB 계약.
//
// 핵심은 **자동 공개가 없다**는 것이다. 어떻게 만들어졌든(손으로 쓰든 AI가
// 만들든) 문제는 draft로 들어오고, 공개는 검수를 거친 버전만 가능하다.

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
    // published_version_id가 버전을 참조하므로 먼저 끊는다.
    psql(`update problems set published_version_id = null where id = '${id}';
          delete from problem_versions where problem_id = '${id}';
          delete from problem_keywords where problem_id = '${id}';
          delete from problems where id = '${id}';`);
  }
});

function newProblem(): string {
  const id = psql(
    `select create_bank_problem('${SUBJECT_ID}', 'mc', '판별식 ${uniq()}', 'medium', '${ADMIN_ID}');`
  );
  cleanup.push(id);
  return id;
}

/** 문제를 만들면 트리거가 버전을 함께 만든다 — 그래서 "저장"은 고치기다. */
function draftOn(problemId: string, passage = "지문"): string {
  return psql(
    `select save_problem_draft_version('${problemId}', '${passage}', '["a","b"]'::jsonb, 0, '해설', 'medium', '${ADMIN_ID}');`
  );
}

describe("문제은행 — 교재 섹션 없이 문제를 만든다", () => {
  it("새 문제는 섹션에 매달리지 않고 draft로 시작한다", () => {
    const id = newProblem();
    expect(psql(`select status from problems where id = '${id}';`)).toBe("draft");
    expect(psql(`select section_id is null from problems where id = '${id}';`)).toBe("t");
    expect(psql(`select archived_at is null from problems where id = '${id}';`)).toBe("t");
  });

  it("보관된 과목에는 만들 수 없다", () => {
    const archivedSubject = psql(
      `insert into subjects (name, archived_at) values ('보관과목 ${uniq()}', now()) returning id;`
    );
    const stderr = psqlExpectError(
      `select create_bank_problem('${archivedSubject}', 'mc', 'x', 'medium', '${ADMIN_ID}');`
    );
    expect(stderr).toContain("보관되지 않은 과목");
    psql(`delete from subjects where id = '${archivedSubject}';`);
  });
});

describe("자동 공개는 없다", () => {
  it("초안을 바로 공개할 수 없다 — 검수를 먼저 거쳐야 한다", () => {
    const id = newProblem();
    const version = draftOn(id);
    const stderr = psqlExpectError(`select publish_problem_version('${version}', '${ADMIN_ID}');`);
    expect(stderr).toContain("검수 중인 버전만 공개할 수 있습니다");
    expect(psql(`select status from problems where id = '${id}';`)).toBe("draft");
  });

  it("검수 → 공개를 거치면 문제 본문과 상태가 갱신된다", () => {
    const id = newProblem();
    const version = draftOn(id, "공개될 지문");
    psql(`select submit_problem_version_for_review('${version}', '${ADMIN_ID}');`);
    psql(`select publish_problem_version('${version}', '${ADMIN_ID}');`);

    // 공개된 내용이 문제 본문이 된다 — 이게 없으면 검수를 통과해도 학생 화면은
    // 옛 내용을 계속 본다.
    expect(psql(`select passage from problems where id = '${id}';`)).toBe("공개될 지문");
    expect(psql(`select status from problems where id = '${id}';`)).toBe("confirmed");
    expect(psql(`select published_version_id = '${version}' from problems where id = '${id}';`)).toBe("t");
  });

  it("새 버전을 공개하면 이전 공개본은 지난 공개본이 된다", () => {
    const id = newProblem();
    const first = draftOn(id, "첫 지문");
    psql(`select submit_problem_version_for_review('${first}', '${ADMIN_ID}');`);
    psql(`select publish_problem_version('${first}', '${ADMIN_ID}');`);

    const second = draftOn(id, "둘째 지문");
    psql(`select submit_problem_version_for_review('${second}', '${ADMIN_ID}');`);
    psql(`select publish_problem_version('${second}', '${ADMIN_ID}');`);

    expect(psql(`select status from problem_versions where id = '${first}';`)).toBe("archived");
    expect(psql(`select status from problem_versions where id = '${second}';`)).toBe("published");
    expect(psql(`select passage from problems where id = '${id}';`)).toBe("둘째 지문");
  });

  it("초안을 다시 저장하면 새로 쌓이지 않고 그 초안이 고쳐진다", () => {
    const id = newProblem();
    const first = draftOn(id, "처음");
    const second = draftOn(id, "고침");
    expect(second).toBe(first);
    expect(psql(`select count(*) from problem_versions where problem_id = '${id}';`)).toBe("1");
    expect(psql(`select passage from problem_versions where id = '${first}';`)).toBe("고침");
  });

  it("검수 중인 버전은 고칠 수 없다", () => {
    const id = newProblem();
    const version = draftOn(id, "검수 대상");
    psql(`select submit_problem_version_for_review('${version}', '${ADMIN_ID}');`);
    const stderr = psqlExpectError(
      `select save_problem_draft_version('${id}', '몰래 바꾸기', null, null, '', 'medium', '${ADMIN_ID}');`
    );
    expect(stderr).toContain("검수 중인 버전은 고칠 수 없습니다");
    expect(psql(`select passage from problem_versions where id = '${version}';`)).toBe("검수 대상");
  });
});

describe("문제 보관은 숨김이지 삭제가 아니다", () => {
  it("보관하면 선택 가능 후보에서 빠진다", () => {
    const id = newProblem();
    const version = draftOn(id);
    psql(`select submit_problem_version_for_review('${version}', '${ADMIN_ID}');`);
    psql(`select publish_problem_version('${version}', '${ADMIN_ID}');`);

    const keywordId = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', '보관확인 ${uniq()}') returning id;`
    );
    psql(`insert into problem_keywords (problem_id, keyword_id) values ('${id}', '${keywordId}');`);
    expect(
      psql(`select count(*) from problem_keywords_selectable where problem_id = '${id}';`)
    ).toBe("1");

    psql(`update problems set archived_at = now() where id = '${id}';`);
    expect(
      psql(`select count(*) from problem_keywords_selectable where problem_id = '${id}';`)
    ).toBe("0");

    // 문제와 버전 기록은 그대로 남는다 — 과거 풀이가 가리키는 대상이다.
    expect(psql(`select count(*) from problems where id = '${id}';`)).toBe("1");
    expect(psql(`select count(*) from problem_versions where problem_id = '${id}';`)).toBe("1");
    expect(psql(`select passage from problems where id = '${id}';`)).toBe("지문");
  });
});
