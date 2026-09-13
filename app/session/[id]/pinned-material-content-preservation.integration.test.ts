import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

// 2026-09-13 제품 오너 지적에서 출발했다 — "doc_version_at_pick 에 updated_at 을
// 저장하는 것만으로 당시 교재 내용이 보존되는지는 별개다."
//
// 그때는 보존되지 않았다. 교재의 '버전'이 시각일 뿐이고 본문은
// curriculum_doc_sections 에 한 벌만 있었다. 20261327000000 이 공개 시점의 내용을
// curriculum_doc_versions.snapshot 에 남기게 하면서 고쳐졌다.
//
// 이 파일은 이제 **보존된다**는 것을 고정한다. 살아 있는 본문이 바뀌어도 스냅샷은
// 그대로여야 한다.

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

describe("교재 본문이 공개 시점으로 보존된다", () => {
  it("살아 있는 본문을 고쳐도 스냅샷은 그대로다", () => {
    const docId = psql(
      `insert into curriculum_docs (title, subject_id, owner_type, status)
       values ('교재 ${uniq()}', '${SUBJECT_ID}', 'admin', 'published') returning id;`
    );
    cleanupDocIds.push(docId);
    const sectionId = psql(
      `insert into curriculum_doc_sections (curriculum_doc_id, position, title, body)
       values ('${docId}', 1, '1절', '처음 본문') returning id;`
    );

    // 공개 시점에 스냅샷이 떠 있어야 한다. 다만 이 교재는 섹션을 나중에 넣었으므로
    // 지금 내용으로 한 벌 더 뜬다 — 재공개는 새 버전이다.
    psql(`select capture_curriculum_doc_version('${docId}', 'publish', '섹션 추가 후 재공개');`);

    const snapshotBody = psql(
      `select v.snapshot->'sections'->0->>'body'
       from curriculum_doc_versions v
       where v.curriculum_doc_id = '${docId}'
       order by v.version_number desc limit 1;`
    );
    expect(snapshotBody).toBe("처음 본문");

    // 나중에 살아 있는 본문을 고친다.
    psql(`update curriculum_doc_sections set body = '고친 본문' where id = '${sectionId}';`);

    // 스냅샷은 그대로다 — 과거 수업이 가리키는 내용이 바뀌지 않는다.
    expect(
      psql(
        `select v.snapshot->'sections'->0->>'body'
         from curriculum_doc_versions v
         where v.curriculum_doc_id = '${docId}'
         order by v.version_number desc limit 1;`
      )
    ).toBe("처음 본문");
    expect(psql(`select body from curriculum_doc_sections where id = '${sectionId}';`)).toBe(
      "고친 본문"
    );
  });

  it("섹션 식별자·순서·제목까지 담는다 — 필기를 어디에 붙일지 알 수 있어야 한다", () => {
    const docId = psql(
      `insert into curriculum_docs (title, subject_id, owner_type, status)
       values ('교재 ${uniq()}', '${SUBJECT_ID}', 'admin', 'draft') returning id;`
    );
    cleanupDocIds.push(docId);
    const s1 = psql(
      `insert into curriculum_doc_sections (curriculum_doc_id, position, title, body, teaching_tip)
       values ('${docId}', 1, '첫 절', '본문1', '팁1') returning id;`
    );
    psql(`update curriculum_docs set status = 'published' where id = '${docId}';`);

    const section = psql(
      `select v.snapshot->'sections'->0
       from curriculum_doc_versions v where v.curriculum_doc_id = '${docId}'
       order by v.version_number desc limit 1;`
    );
    expect(section).toContain(s1);
    expect(section).toContain("첫 절");
    expect(section).toContain("팁1");
  });

  it("공개하면 버전 행이 생긴다 — 번호는 1이라고 가정하지 않는다", () => {
    const docId = psql(
      `insert into curriculum_docs (title, subject_id, owner_type, status)
       values ('교재 ${uniq()}', '${SUBJECT_ID}', 'admin', 'published') returning id;`
    );
    cleanupDocIds.push(docId);
    psql(
      `insert into curriculum_doc_sections (curriculum_doc_id, position, title, body)
       values ('${docId}', 1, '1절', '본문');`
    );

    // 공개 상태로 만들면 그 시점 내용이 남는다.
    expect(
      psql(`select count(*) from curriculum_doc_versions where curriculum_doc_id = '${docId}';`)
    ).toBe("1");

    // 재공개는 새 버전이다. 기존 버전을 고치지 않는다.
    psql(`select capture_curriculum_doc_version('${docId}', 'publish', '재공개');`);
    expect(
      psql(`select count(*) from curriculum_doc_versions where curriculum_doc_id = '${docId}';`)
    ).toBe("2");
    expect(
      psql(
        `select string_agg(version_number::text, ',' order by version_number)
         from curriculum_doc_versions where curriculum_doc_id = '${docId}';`
      )
    ).toBe("1,2");
  });

  it("현재 내용 기준 생성본은 공개 스냅샷과 구분된다", () => {
    const docId = psql(
      `insert into curriculum_docs (title, subject_id, owner_type, status)
       values ('교재 ${uniq()}', '${SUBJECT_ID}', 'admin', 'published') returning id;`
    );
    cleanupDocIds.push(docId);
    psql(
      `select capture_curriculum_doc_version('${docId}', 'current_content_baseline', '사유');`
    );

    expect(
      psql(
        `select string_agg(origin, ',' order by version_number)
         from curriculum_doc_versions where curriculum_doc_id = '${docId}';`
      )
    ).toBe("publish,current_content_baseline");
    // 생성본은 공개 시각을 남기지 않는다 — 공개된 적이 없는 내용이다.
    expect(
      psql(
        `select published_at is null from curriculum_doc_versions
         where curriculum_doc_id = '${docId}' and origin = 'current_content_baseline';`
      )
    ).toBe("t");
  });
});

// 지시 2번 — "새 교재 공개와 기존 교재 재공개에서 스냅샷이 생성되는지 실제 흐름으로
// 검증해주세요." setDocPublished 가 내는 SQL 과 같은 모양으로 확인한다.
describe("공개 경로에서 스냅샷이 실제로 생긴다", () => {
  const versionCount = (docId: string) =>
    psql(`select count(*) from curriculum_doc_versions where curriculum_doc_id = '${docId}';`);

  it("초안 → 공개: status 변경만으로 스냅샷이 생긴다", () => {
    const docId = psql(
      `insert into curriculum_docs (title, subject_id, owner_type, status)
       values ('교재 ${uniq()}', '${SUBJECT_ID}', 'admin', 'draft') returning id;`
    );
    cleanupDocIds.push(docId);
    psql(
      `insert into curriculum_doc_sections (curriculum_doc_id, position, title, body)
       values ('${docId}', 1, '1절', '첫 공개 본문');`
    );
    expect(versionCount(docId)).toBe("0");

    // setDocPublished 가 내는 것과 같은 UPDATE.
    psql(`update curriculum_docs set status = 'published' where id = '${docId}';`);
    expect(versionCount(docId)).toBe("1");
  });

  it("이미 공개된 교재의 재공개는 status 가 안 바뀌어 트리거가 돌지 않는다", () => {
    // 이것이 앱에서 capture 를 명시적으로 부르는 이유다(curriculum-doc-actions).
    const docId = psql(
      `insert into curriculum_docs (title, subject_id, owner_type, status)
       values ('교재 ${uniq()}', '${SUBJECT_ID}', 'admin', 'published') returning id;`
    );
    cleanupDocIds.push(docId);
    expect(versionCount(docId)).toBe("1");

    psql(`update curriculum_doc_sections set body = body where curriculum_doc_id = '${docId}';`);
    psql(`update curriculum_docs set status = 'published' where id = '${docId}';`);
    expect(versionCount(docId)).toBe("1");

    // 앱이 부르는 명시적 캡처로만 새 버전이 생긴다.
    psql(`select capture_curriculum_doc_version('${docId}', 'publish', '재공개');`);
    expect(versionCount(docId)).toBe("2");
  });
});

// 지시 — "재공개 시 스냅샷 생성이 실패하면 공개 성공으로 응답하지 않아야 합니다.
// 공개 처리와 버전 생성의 일관성, 중복 클릭·동시 요청 시 버전 번호 충돌."
describe("공개와 버전 생성의 일관성", () => {
  const versionCount = (docId: string) =>
    psql(`select count(*) from curriculum_doc_versions where curriculum_doc_id = '${docId}';`);
  const statusOf = (docId: string) =>
    psql(`select status from curriculum_docs where id = '${docId}';`);

  function makeDraft(): string {
    const docId = psql(
      `insert into curriculum_docs (title, subject_id, owner_type, status)
       values ('교재 ${uniq()}', '${SUBJECT_ID}', 'admin', 'draft') returning id;`
    );
    cleanupDocIds.push(docId);
    psql(
      `insert into curriculum_doc_sections (curriculum_doc_id, position, title, body)
       values ('${docId}', 1, '1절', '본문');`
    );
    return docId;
  }

  it("초안 → 공개: 상태와 버전이 함께 생긴다", () => {
    const docId = makeDraft();
    psql(`select publish_curriculum_doc('${docId}', true);`);
    expect(statusOf(docId)).toBe("published");
    expect(versionCount(docId)).toBe("1");
  });

  it("재공개: 기존 버전을 고치지 않고 새 버전을 만든다", () => {
    const docId = makeDraft();
    psql(`select publish_curriculum_doc('${docId}', true);`);
    psql(`update curriculum_doc_sections set body = '고친 본문' where curriculum_doc_id = '${docId}';`);
    psql(`select publish_curriculum_doc('${docId}', true);`);

    expect(versionCount(docId)).toBe("2");
    // 1번은 처음 내용 그대로, 2번이 고친 내용이다.
    expect(
      psql(
        `select snapshot->'sections'->0->>'body' from curriculum_doc_versions
         where curriculum_doc_id = '${docId}' and version_number = 1;`
      )
    ).toBe("본문");
    expect(
      psql(
        `select snapshot->'sections'->0->>'body' from curriculum_doc_versions
         where curriculum_doc_id = '${docId}' and version_number = 2;`
      )
    ).toBe("고친 본문");
  });

  it("버전을 남기지 못하면 공개도 되돌아간다", () => {
    const docId = makeDraft();
    // 버전 테이블 쓰기를 막아 캡처를 실패시킨다. 같은 트랜잭션이므로 상태도
    // 함께 되돌아가야 한다 — "공개됐는데 내용은 없는" 상태가 남으면 안 된다.
    psql(
      `create or replace function tmp_block_version_insert() returns trigger language plpgsql as $fn$
       begin raise exception '일부러 실패'; end; $fn$;
       create trigger tmp_block_version_insert before insert on curriculum_doc_versions
       for each row execute function tmp_block_version_insert();`
    );
    try {
      expect(() => psql(`select publish_curriculum_doc('${docId}', true);`)).toThrow();
      expect(statusOf(docId)).toBe("draft");
      expect(versionCount(docId)).toBe("0");
    } finally {
      psql(
        `drop trigger if exists tmp_block_version_insert on curriculum_doc_versions;
         drop function if exists tmp_block_version_insert();`
      );
    }
  });

  it("중복 클릭에도 버전 번호가 충돌하지 않고 순서대로 쌓인다", () => {
    const docId = makeDraft();
    psql(`select publish_curriculum_doc('${docId}', true);`);
    // 같은 요청을 연달아 세 번. advisory lock 이 직렬화한다.
    psql(`select publish_curriculum_doc('${docId}', true);`);
    psql(`select publish_curriculum_doc('${docId}', true);`);
    psql(`select publish_curriculum_doc('${docId}', true);`);

    expect(
      psql(
        `select string_agg(version_number::text, ',' order by version_number)
         from curriculum_doc_versions where curriculum_doc_id = '${docId}';`
      )
    ).toBe("1,2,3,4");
  });
});
