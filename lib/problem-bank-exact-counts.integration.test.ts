import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN_ID, psql } from "@/test/mock-exam-routing-fixture";

// 문제은행 목록·질문 집계 정확도(마이그레이션 430): PostgREST max_rows(1000) 이상에서도 정확한 건수·페이지.
// 실행 ID 전용 과목·문제만 만들고 afterAll 에서 지운다. 읽기 RPC(problem_question_audit·problem_bank_list_page)만 호출.
const RUN = randomUUID().slice(0, 8);
const TOTAL = 1105;
let SUBJECT: string;
const page = (filter: object, bucket: string | null, offset = 0, limit = 10) =>
  JSON.parse(psql(`select problem_bank_list_page('${JSON.stringify(filter)}'::jsonb, ${bucket ? `'${bucket}'` : "null"}, ${offset}, ${limit})::text;`)) as { total: number; ids: string[] };

beforeAll(() => {
  SUBJECT = psql(`insert into subjects (name) values ('bankcount-${RUN}') returning id;`);
  // 질문 있는(물음표로 끝나는) 지문 TOTAL-3 개 + 질문 없는 지문 3개. 기본 버전(1)은 트리거가 초안으로 만든다.
  psql(`insert into problems (format, passage, subject_id, status, created_by, topic)
        select 'mc', 'bankcount ${RUN} ' || g || (case when g <= ${TOTAL - 3} then ' what is x?' else ' statement only' end), '${SUBJECT}', 'draft', '${ADMIN_ID}', 'bc-${RUN}' from generate_series(1, ${TOTAL}) g;`);
  psql(`update problem_versions v set passage = p.passage from problems p where p.id = v.problem_id and p.subject_id = '${SUBJECT}' and v.version_no = 1;`);
  // 5개는 공개본으로
  psql(`update problem_versions set options = '["a","b","c","d"]'::jsonb, correct_index = 0, explanation = 'x', difficulty = 'medium', status = 'published', published_at = now()
        where id in (select v.id from problem_versions v join problems p on p.id = v.problem_id where p.subject_id = '${SUBJECT}' and v.version_no = 1 order by p.passage limit 5);`);
});
afterAll(() => {
  psql(`begin; set local session_replication_role = replica;
    delete from problem_versions where problem_id in (select id from problems where subject_id = '${SUBJECT}');
    delete from problems where subject_id = '${SUBJECT}';
    delete from subjects where id = '${SUBJECT}';
    commit;`);
});

describe("problem_bank_list_page — 1000 초과에서도 정확", () => {
  it("전체 건수는 정확하고(1105) 페이지는 요청한 개수만 준다", () => {
    const r = page({ subjectId: SUBJECT }, null, 0, 10);
    expect(r.total).toBe(TOTAL);
    expect(r.ids).toHaveLength(10);
    const last = page({ subjectId: SUBJECT }, null, 1100, 10);
    expect(last.total).toBe(TOTAL);
    expect(last.ids).toHaveLength(5);
    expect(new Set([...r.ids, ...last.ids]).size).toBe(15);
  });
  it("버킷: 공개 5 / 작업 중 1100 / 보관 0", () => {
    expect(page({ subjectId: SUBJECT }, "published").total).toBe(5);
    expect(page({ subjectId: SUBJECT }, "working").total).toBe(TOTAL - 5);
    expect(page({ subjectId: SUBJECT, archived: true }, "archived").total).toBe(0);
    psql(`update problems set archived_at = now() where id in (select id from problems where subject_id = '${SUBJECT}' limit 7);`);
    expect(page({ subjectId: SUBJECT, archived: true }, "archived").total).toBe(7);
    expect(page({ subjectId: SUBJECT }, null).total).toBe(TOTAL - 7);
    psql(`update problems set archived_at = null where subject_id = '${SUBJECT}';`);
  });
  it("검색·난이도·형식 필터와 '%' 같은 문자는 글자 그대로 찾는다", () => {
    expect(page({ subjectId: SUBJECT, query: `bankcount ${RUN} 1100 ` }, null).total).toBeGreaterThanOrEqual(1);
    expect(page({ subjectId: SUBJECT, query: "%" }, null).total).toBe(0);
    expect(page({ subjectId: SUBJECT, format: "spr" }, null).total).toBe(0);
    expect(page({ subjectId: SUBJECT, workState: "published" }, null).total).toBe(5);
  });
});

describe("problem_question_audit — 행을 가져오지 않고 정확히 센다", () => {
  it("과목 단위로 1000 초과여도 정확하다", () => {
    const a = JSON.parse(psql(`select problem_question_audit('${SUBJECT}')::text;`));
    // 질문 없는 3개 중 공개본은 정렬상 앞 5개 안에 들어갈 수 있어 합계만 고정한다.
    expect(a.withQuestion + a.draftWithout + a.publishedWithout).toBe(TOTAL);
    expect(a.draftWithout + a.publishedWithout).toBe(3);
    expect(a.withQuestion).toBe(TOTAL - 3);
  });
});
