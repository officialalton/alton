import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";

// 2026-09-15 제품 오너 2차 지시 — 단어장 상시 학습 자산화 검증.
//   assign_vocab_quiz(due_at 포함 새 시그니처)/assign_library_words_to_student 가 teaches_student()
//   로만 권한을 가리고, vocab_review_items 의 "열린 항목 하나만" 제약이 실제로 동작하는지 SQL 레벨에서 확인한다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001";
const HOUSEHOLD_ID = "aabbccdd-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
function asUser(userId: string, sql: string): string {
  return psql(`
    set role authenticated;
    do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$;
    ${sql}
    reset role;
  `);
}
function fails(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    return String((e as { stderr?: string }).stderr ?? e);
  }
  return "";
}

let unrelatedTeacherId: string;
let sessionId: string;
let libraryWordId: string;
let libraryWordId2: string;

beforeAll(() => {
  // unrelatedTeacherId 고정 fixture는 다른 테스트 파일들이 이 STUDENT_ID의 진짜 담당 교사로
  // 만들어 둔 채 남아 있을 수 있어(공유 로컬 DB), "담당 아님" 부정 테스트에는 매번 새로
  // 만드는 교사를 쓴다 — 이 학생과 어떤 관계도 없다고 보장할 수 있다.
  unrelatedTeacherId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'vocab-round2-unrelated-${Date.now()}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`insert into profiles (id, role, name) values ('${unrelatedTeacherId}', 'teacher', '무관한 교사');`);

  const contractId = psql(`insert into contracts (household_id, child_id, status) values ('${HOUSEHOLD_ID}', '${STUDENT_ID}', 'draft') returning id;`);
  const enrollmentId = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status) values ('${STUDENT_ID}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`
  );
  psql(`insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from) values ('${enrollmentId}', '${TEACHER_ID}', 'active', now() - interval '1 day');`);
  const offset = 9200 + Math.floor(Math.random() * 5000) * 3;
  const reservationId = psql(
    `insert into reservations (kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status)
     values ('lesson', '${enrollmentId}', '${TEACHER_ID}', now() + interval '${offset} days', now() + interval '${offset} days 1 hour', 'confirmed') returning id;`
  );
  sessionId = psql(
    `insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes)
     values ('${reservationId}', '${enrollmentId}', '${TEACHER_ID}', (select id from lesson_types where code = 'regular'), 60) returning id;`
  );

  // 실제 시딩된 공용 단어장(1권)이 있으면 그걸 쓰고, 없으면(아직 채우기 전) 이 테스트만을 위한
  // 임시 단어를 1권에 끼워 넣는다(volume_no 제약이 1~10이라 별도 테스트 권을 만들 수 없다).
  let bookId = psql(`select id from vocab_library_books where volume_no = 1 limit 1;`);
  if (!bookId) bookId = psql(`insert into vocab_library_books (volume_no, title) values (1, '임시') returning id;`);
  const existing = psql(`select id from vocab_library_words where book_id = '${bookId}' order by position limit 2;`).split("\n").filter(Boolean);
  if (existing.length >= 2) {
    [libraryWordId, libraryWordId2] = existing;
  } else {
    libraryWordId = psql(
      `insert into vocab_library_words (book_id, word, definition_ko, example1, example2, synonym_words, antonym_words, difficulty)
       values ('${bookId}', 'testword${Date.now()}', '테스트 뜻', 'This is a testword example.', 'Another testword example.', '{a,b}', '{c,d}', 2) returning id;`
    );
    libraryWordId2 = psql(
      `insert into vocab_library_words (book_id, word, definition_ko, example1, example2, synonym_words, antonym_words, difficulty)
       values ('${bookId}', 'otherword${Date.now()}', '다른 뜻', 'This is an otherword example.', 'Yet another otherword example.', '{e,f}', '{g,h}', 2) returning id;`
    );
  }
});

describe("assign_vocab_quiz — teaches_student() 로만 권한 확인, due_at 저장", () => {
  it("담당 교사는 발급할 수 있고 due_at이 저장된다", () => {
    const dueAt = new Date(Date.now() + 86400000).toISOString();
    const quizId = asUser(
      TEACHER_ID,
      `select assign_vocab_quiz('${sessionId}', '${STUDENT_ID}', '{"customWords":false,"bookIds":[]}'::jsonb, '[{"word":"x","definitionShown":"x","options":["a","b","c","d"],"correctIndex":0}]'::jsonb, '${dueAt}');`
    );
    expect(quizId).toMatch(/^[0-9a-f-]{36}$/);
    const dueAtStored = psql(`select due_at from vocab_quizzes where id = '${quizId}';`);
    expect(dueAtStored).not.toBe("");
    const sessionIdStored = psql(`select session_id from vocab_quizzes where id = '${quizId}';`);
    expect(sessionIdStored).toBe(sessionId);
  });

  it("담당이 아닌 교사는 거절된다", () => {
    const out = fails(() =>
      asUser(
        unrelatedTeacherId,
        `select assign_vocab_quiz(null, '${STUDENT_ID}', '{"customWords":false,"bookIds":[]}'::jsonb, '[]'::jsonb);`
      )
    );
    expect(out).toContain("담당하는 학생의 수업에만");
  });
});

describe("assign_library_words_to_student — 공용 단어를 학생 개인 단어장에 배정 복사", () => {
  it("담당 교사가 배정하면 학생 vocab_words에 assigned_by와 함께 들어가고, 같은 단어 재배정은 중복되지 않는다", () => {
    asUser(TEACHER_ID, `select assign_library_words_to_student('${STUDENT_ID}', array['${libraryWordId2}']::uuid[]);`);
    asUser(TEACHER_ID, `select assign_library_words_to_student('${STUDENT_ID}', array['${libraryWordId2}']::uuid[]);`);
    const word = psql(`select word from vocab_library_words where id = '${libraryWordId2}';`);
    const count = psql(`select count(*) from vocab_words where student_id = '${STUDENT_ID}' and word = '${word}';`);
    expect(count).toBe("1");
    const assignedBy = psql(`select assigned_by from vocab_words where student_id = '${STUDENT_ID}' and word = '${word}';`);
    expect(assignedBy).toBe(TEACHER_ID);
  });

  it("담당이 아닌 교사는 거절된다", () => {
    const out = fails(() => asUser(unrelatedTeacherId, `select assign_library_words_to_student('${STUDENT_ID}', array['${libraryWordId}']::uuid[]);`));
    expect(out).toContain("담당하는 학생에게만");
  });
});

describe("vocab_review_items — 열린 오답 항목은 학생·단어당 하나만 유지된다", () => {
  it("같은 단어를 다시 틀려도 열린 행이 하나로 유지되고(upsert), 클리어 후 새로 틀리면 새 열린 행이 생긴다", () => {
    const word = `reviewtest_${Date.now()}`;
    asUser(STUDENT_ID, `insert into vocab_review_items (student_id, word, definition) values ('${STUDENT_ID}', '${word}', '뜻1') on conflict (student_id, word) where cleared_at is null do update set definition = excluded.definition;`);
    asUser(STUDENT_ID, `insert into vocab_review_items (student_id, word, definition) values ('${STUDENT_ID}', '${word}', '뜻2') on conflict (student_id, word) where cleared_at is null do update set definition = excluded.definition;`);
    const openCount = psql(`select count(*) from vocab_review_items where student_id = '${STUDENT_ID}' and word = '${word}' and cleared_at is null;`);
    expect(openCount).toBe("1");
    const def = psql(`select definition from vocab_review_items where student_id = '${STUDENT_ID}' and word = '${word}' and cleared_at is null;`);
    expect(def).toBe("뜻2");

    asUser(STUDENT_ID, `update vocab_review_items set cleared_at = now() where student_id = '${STUDENT_ID}' and word = '${word}' and cleared_at is null;`);
    asUser(STUDENT_ID, `insert into vocab_review_items (student_id, word, definition) values ('${STUDENT_ID}', '${word}', '뜻3') on conflict (student_id, word) where cleared_at is null do update set definition = excluded.definition;`);
    const totalRows = psql(`select count(*) from vocab_review_items where student_id = '${STUDENT_ID}' and word = '${word}';`);
    expect(totalRows).toBe("2");
    const openAgain = psql(`select count(*) from vocab_review_items where student_id = '${STUDENT_ID}' and word = '${word}' and cleared_at is null;`);
    expect(openAgain).toBe("1");
  });
});

describe("vocab_quizzes 조회 범위 확장 — 담당 교사/보호자도 볼 수 있다(20261376)", () => {
  it("담당 교사는 자신이 만들지 않은(다른 교사·본인 관리자 등) 이 학생의 시험도 조회할 수 있다", () => {
    const quizId = psql(
      `insert into vocab_quizzes (owner_id, created_by, source, items, status) values ('${STUDENT_ID}', '${ADMIN_ID}', '{}'::jsonb, '[]'::jsonb, 'pending') returning id;`
    );
    const seenByTeacher = asUser(TEACHER_ID, `select count(*) from vocab_quizzes where id = '${quizId}';`);
    expect(seenByTeacher).toBe("1");
  });
});
