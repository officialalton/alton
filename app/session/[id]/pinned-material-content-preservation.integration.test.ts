import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

// 2026-09-13 제품 오너 지적 검증 — "doc_version_at_pick 에 updated_at 을 저장하는
// 것만으로 당시 교재 내용이 보존되는지는 별개다."
//
// 결론: 보존되지 않는다. 이 파일은 그 사실을 고정한다.
//
// 교재의 '버전'은 이 스키마에서 시각(updated_at)일 뿐이고, 본문은
// curriculum_doc_sections 에 **한 벌만** 있다. 고정된 교재를 읽는 경로도 그 표를
// id 로 읽으므로, 교재를 고치면 과거 수업 화면의 내용도 함께 바뀐다.
//
// curriculum_doc_versions(snapshot jsonb)는 초기 스키마에 있지만 앱 어디에서도
// 쓰지 않는다 — 테스트만 참조한다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

const uniq = () => `${Date.now()}_${Math.random()}`;
const cleanupDocIds: string[] = [];

afterEach(() => {
  for (const id of cleanupDocIds.splice(0)) {
    psql(`delete from curriculum_docs where id = '${id}';`);
  }
});

describe("교재 본문은 선택 시점으로 보존되지 않는다 (기존 결함)", () => {
  it("교재를 고치면 이미 담긴 구성이 가리키는 본문도 함께 바뀐다", () => {
    const docId = psql(
      `insert into curriculum_docs (title, subject_id, owner_type, status)
       values ('교재 ${uniq()}', '${SUBJECT_ID}', 'admin', 'published') returning id;`
    );
    cleanupDocIds.push(docId);
    const sectionId = psql(
      `insert into curriculum_doc_sections (curriculum_doc_id, position, title, body)
       values ('${docId}', 1, '1절', '처음 본문') returning id;`
    );

    const bodyAtPick = psql(
      `select body from curriculum_doc_sections where id = '${sectionId}';`
    );
    expect(bodyAtPick).toBe("처음 본문");

    // 나중에 교재를 고친다.
    psql(`update curriculum_doc_sections set body = '고친 본문' where id = '${sectionId}';`);

    // 선택 시점 본문을 되찾을 방법이 없다 — 같은 행을 덮어썼다.
    expect(psql(`select body from curriculum_doc_sections where id = '${sectionId}';`)).toBe(
      "고친 본문"
    );
  });

  it("curriculum_doc_versions 는 있지만 아무도 채우지 않는다", () => {
    const docId = psql(
      `insert into curriculum_docs (title, subject_id, owner_type, status)
       values ('교재 ${uniq()}', '${SUBJECT_ID}', 'admin', 'published') returning id;`
    );
    cleanupDocIds.push(docId);
    psql(
      `insert into curriculum_doc_sections (curriculum_doc_id, position, title, body)
       values ('${docId}', 1, '1절', '본문');`
    );

    // 공개된 교재인데도 스냅샷이 없다. 되돌릴 내용이 어디에도 남지 않는다.
    expect(
      psql(`select count(*) from curriculum_doc_versions where curriculum_doc_id = '${docId}';`)
    ).toBe("0");
  });
});
