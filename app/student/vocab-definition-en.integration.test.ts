import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPerRunTeacher } from "@/test/per-run-teacher";

// 2026-10-05 — 20262100000010: vocab_words / vocab_library_words 에 nullable definition_en 이 있고,
// assign_library_words_to_student 가 영어 뜻을 함께 복사하며(legacy null 은 그대로), 재배정은 기존 영어 뜻을 덮어쓰지 않는다.
const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001";
const HOUSEHOLD_ID = "aabbccdd-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
const RUN = `vocaben${Date.now()}`;

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
function asUser(userId: string, sql: string): string {
  return psql(`set role authenticated; do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$; ${sql} reset role;`);
}

let teacherId: string;
let bookId: string;
let enId: string;
let legacyId: string;
const wordEn = `${RUN}en`;
const wordLegacy = `${RUN}legacy`;

beforeAll(() => {
  teacherId = createPerRunTeacher(psql, { emailPrefix: "vocab-round2" });
  const contractId = psql(`insert into contracts (household_id, child_id, status) values ('${HOUSEHOLD_ID}', '${STUDENT_ID}', 'draft') returning id;`);
  const enrollmentId = psql(`insert into subject_enrollments (child_id, subject_id, contract_id, status) values ('${STUDENT_ID}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`);
  psql(`insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from) values ('${enrollmentId}', '${teacherId}', 'active', now() - interval '1 day');`);
  bookId = psql(`select id from vocab_library_books where volume_no = 1 limit 1;`);
  if (!bookId) bookId = psql(`insert into vocab_library_books (volume_no, title) values (1, '임시') returning id;`);
  enId = psql(
    `insert into vocab_library_words (book_id, word, definition_ko, definition_en, example1, example2, synonym_words, antonym_words, difficulty)
     values ('${bookId}', '${wordEn}', '영어 있음', 'has an english definition', 'A ${wordEn} example.', 'Another ${wordEn} example.', '{a,b}', '{c,d}', 2) returning id;`
  );
  legacyId = psql(
    `insert into vocab_library_words (book_id, word, definition_ko, example1, example2, synonym_words, antonym_words, difficulty)
     values ('${bookId}', '${wordLegacy}', '레거시', 'A ${wordLegacy} example.', 'Another ${wordLegacy} example.', '{e,f}', '{g,h}', 2) returning id;`
  );
});

afterAll(() => {
  psql(`delete from vocab_words where student_id = '${STUDENT_ID}' and word like '${RUN}%'; delete from vocab_library_words where word like '${RUN}%';`);
});

describe("definition_en 컬럼과 배정 복사", () => {
  it("두 테이블에 nullable definition_en 컬럼이 있다", () => {
    const n = psql(`select count(*) from information_schema.columns where column_name = 'definition_en' and is_nullable = 'YES' and table_name in ('vocab_words','vocab_library_words');`);
    expect(n).toBe("2");
  });

  it("배정하면 definition_en 이 학생 단어장으로 복사되고, 레거시(null)는 null 로 남는다", () => {
    asUser(teacherId, `select assign_library_words_to_student('${STUDENT_ID}', array['${enId}','${legacyId}']::uuid[], null);`);
    expect(psql(`select definition_en from vocab_words where student_id = '${STUDENT_ID}' and word = '${wordEn}';`)).toBe("has an english definition");
    expect(psql(`select definition from vocab_words where student_id = '${STUDENT_ID}' and word = '${wordEn}';`)).toBe("영어 있음");
    expect(psql(`select coalesce(definition_en, 'NULL') from vocab_words where student_id = '${STUDENT_ID}' and word = '${wordLegacy}';`)).toBe("NULL");
  });

  it("재배정은 이미 있는 영어 뜻을 덮어쓰지 않고, 비어 있던 영어 뜻은 채운다", () => {
    psql(`update vocab_words set definition_en = 'edited by student' where student_id = '${STUDENT_ID}' and word = '${wordEn}';`);
    psql(`update vocab_library_words set definition_en = 'now filled in' where id = '${legacyId}';`);
    asUser(teacherId, `select assign_library_words_to_student('${STUDENT_ID}', array['${enId}','${legacyId}']::uuid[], null);`);
    expect(psql(`select definition_en from vocab_words where student_id = '${STUDENT_ID}' and word = '${wordEn}';`)).toBe("edited by student");
    expect(psql(`select definition_en from vocab_words where student_id = '${STUDENT_ID}' and word = '${wordLegacy}';`)).toBe("now filled in");
  });

  it("vocab_words 에 definition_en 없이도(레거시 insert) 저장된다", () => {
    psql(`insert into vocab_words (student_id, word, definition) values ('${STUDENT_ID}', '${RUN}plain', '뜻');`);
    expect(psql(`select count(*) from vocab_words where student_id = '${STUDENT_ID}' and word = '${RUN}plain' and definition_en is null;`)).toBe("1");
  });
});
