import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { loadLegacyProblemAnswers } from "@/lib/legacy-problem-answers";
import { loadLibraryDoc } from "@/app/student/materials-data";
import { loadMaterialData } from "./material-data";

// 2026-09-29 포털 점검 #9 잔여·#10 — (1) 레거시 problems.correct_index / explanation 을 학생·학부모가
// publishable key + 로그인 JWT 로 REST 직접 조회하지 못한다(컬럼 권한 회수). 정상 흐름(서버 admin 경유
// 교재 로더)은 그대로 값을 준다. (2) 학부모는 진행 중 응시의 mock_exam_answers.correct 를 REST 로 읽지
// 못하고, 채점 확정(graded) 뒤에만 읽는다. 실행마다 새 행을 만들고 그 행만 본다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const API_URL = "http://127.0.0.1:54421";
const JWT_SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";

const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001";
const PARENT_ID = "bbbbbbbb-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const SECRET_EXPLANATION = `LEGACY-EXPL-${RUN}`;

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
function quote(text: string): string {
  return `'${text.replace(/'/g, "''")}'`;
}
function jwtFor(userId: string): string {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = enc({ alg: "HS256", typ: "JWT" });
  const body = enc({ sub: userId, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 });
  const sig = createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
// 서버 admin 클라이언트(lib/supabase-admin)가 반드시 **로컬** 스택을 가리키게 한다 — 로컬 데모 시크릿으로 만든
// service_role JWT. 원격 키가 환경에 있어도 쓰지 않는다.
function pointAdminClientAtLocalStack() {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = enc({ alg: "HS256", typ: "JWT" });
  const body = enc({ role: "service_role", iss: "supabase-demo", exp: Math.floor(Date.now() / 1000) + 3600 });
  const sig = createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url");
  process.env.NEXT_PUBLIC_SUPABASE_URL = API_URL;
  process.env.SUPABASE_SECRET_KEY = `${head}.${body}.${sig}`;
}
function clientFor(userId: string): SupabaseClient {
  const token = jwtFor(userId);
  return createClient(API_URL, token, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

let docId: string;
let sectionId: string;
let problemId: string; // 교재 섹션의 확정 문제(학생 읽기 정책이 열려 있던 행)
let ownProblemId: string; // 학생 본인이 만든 문제(created_by = 학생 → "문제 조회" 정책으로 행이 보인다)
let examSetId: string;
let mcItemId: string;
let attemptId: string;

beforeAll(() => {
  pointAdminClientAtLocalStack();
  docId = psql(
    `insert into curriculum_docs (title, subject_id, owner_type, status) values ('레거시정답 ${RUN}', '${SUBJECT_ID}', 'admin', 'published') returning id;`
  );
  sectionId = psql(
    `insert into curriculum_doc_sections (curriculum_doc_id, position, title, body) values ('${docId}', 1, '개념 ${RUN}', '<p>본문</p>') returning id;`
  );
  problemId = psql(
    `insert into problems (format, passage, options, correct_index, explanation, subject_id, section_id, status, created_by)
     values ('mc', ${quote(`레거시 문제 ${RUN}`)}, '["가","나","다","라"]'::jsonb, 2, ${quote(SECRET_EXPLANATION)}, '${SUBJECT_ID}', '${sectionId}', 'confirmed', '${TEACHER_ID}') returning id;`
  );
  ownProblemId = psql(
    `insert into problems (format, passage, options, correct_index, explanation, subject_id, status, created_by)
     values ('mc', ${quote(`본인 문제 ${RUN}`)}, '["가","나"]'::jsonb, 1, ${quote(SECRET_EXPLANATION)}, '${SUBJECT_ID}', 'draft', '${STUDENT_ID}') returning id;`
  );

  // 모의고사 응시(학부모 답안 조회 정책 검증용).
  const mcProblemId = psql(
    `insert into problems (format, passage, subject_id, status, created_by, sat_domain) values ('mc', ${quote(`모의 문제 ${RUN}`)}, '${SUBJECT_ID}', 'confirmed', '${TEACHER_ID}', 'algebra') returning id;`
  );
  psql(
    `update problem_versions set options = '["가","나","다","라"]'::jsonb, correct_index = 1, explanation = '해설', difficulty = 'medium', status = 'published', published_at = now() where problem_id = '${mcProblemId}' and version_no = 1;`
  );
  const mcVersionId = psql(`select id from problem_versions where problem_id = '${mcProblemId}' and version_no = 1;`);
  psql(`update problems set published_version_id = '${mcVersionId}' where id = '${mcProblemId}';`);
  examSetId = psql(
    `insert into mock_exam_sets (name, difficulty_tier, status, created_by) values ('레거시정답 세트 ${RUN}', 'standard', 'published', '${TEACHER_ID}') returning id;`
  );
  mcItemId = psql(
    `insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, difficulty)
     values ('${examSetId}', 'rw', 1, '${mcProblemId}', '${mcVersionId}', 'rw_craft_structure', 'medium') returning id;`
  );
  attemptId = psql(
    `insert into mock_exam_attempts (exam_set_id, student_id, assigned_by) values ('${examSetId}', '${STUDENT_ID}', '${TEACHER_ID}') returning id;`
  );
});

describe("problems.correct_index / explanation — 학생·학부모 REST 직접 조회 차단", () => {
  for (const [label, userId] of [["학생", STUDENT_ID], ["학부모", PARENT_ID], ["교사", TEACHER_ID]] as const) {
    it(`${label} JWT 는 정답·해설 컬럼을 어떤 방식으로도 읽지 못한다(권한 오류)`, async () => {
      const client = clientFor(userId);
      for (const cols of ["correct_index", "explanation", "id,correct_index,explanation", "*"]) {
        const { data, error } = await client.from("problems").select(cols).in("id", [problemId, ownProblemId]);
        expect(error?.code, `${label} select=${cols}`).toBe("42501");
        expect(data).toBeNull();
      }
      // 필터·정렬로 캐 보는 것도 마찬가지.
      const probe = await client.from("problems").select("id").eq("correct_index", 2).eq("id", problemId);
      expect(probe.error?.code).toBe("42501");
      const sorted = await client.from("problems").select("id").in("id", [problemId]).order("explanation");
      expect(sorted.error?.code).toBe("42501");
    });
  }

  it("학생은 자기에게 열린 행의 나머지 컬럼(지문·보기)은 그대로 읽는다", async () => {
    const { data, error } = await clientFor(STUDENT_ID).from("problems").select("id, passage, options, format").eq("id", ownProblemId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].passage).toBe(`본인 문제 ${RUN}`);
    expect(data![0].options).toEqual(["가", "나"]);
  });

  it("정답·해설은 서버 admin 경유(loadLegacyProblemAnswers)로만 읽힌다", async () => {
    const answers = await loadLegacyProblemAnswers([problemId, ownProblemId]);
    expect(answers.get(problemId)).toEqual({ correctIndex: 2, explanation: SECRET_EXPLANATION });
    expect(answers.get(ownProblemId)?.correctIndex).toBe(1);
    expect((await loadLegacyProblemAnswers([])).size).toBe(0);
  });

  it("교재 로더(학생 JWT)는 정상 동작한다 — 행 가시성은 학생 RLS, 값은 서버가 채운다", async () => {
    const student = clientFor(STUDENT_ID);
    const doc = await loadLibraryDoc(student, docId, STUDENT_ID);
    expect(doc?.sections).toHaveLength(1);
    const p = doc!.sections[0].problems[0];
    expect(p.passage).toBe(`레거시 문제 ${RUN}`);
    expect(p.correctIndex).toBe(2);
    expect(p.explanation).toBe(SECRET_EXPLANATION);
    expect(p.done).toBe(false); // 화면 노출 여부는 page 의 redactProblem 이 결정한다(기존 규칙 유지).

    const material = await loadMaterialData(student, docId, "00000000-0000-0000-0000-00000000dead", STUDENT_ID);
    expect(material?.sections[0].problems[0].correctIndex).toBe(2);
  });
});

describe("mock_exam_answers — 학부모는 채점 확정 뒤에만 정오를 읽는다", () => {
  const parentRows = async () => {
    const { data, error } = await clientFor(PARENT_ID).from("mock_exam_answers").select("id, correct, response").eq("attempt_id", attemptId);
    expect(error).toBeNull();
    return data ?? [];
  };

  it("진행 중(in_progress): 학부모는 0행, 학생 본인도 0행, 교사·관리자는 그대로 읽는다", async () => {
    asUser(STUDENT_ID, `select mock_exam_save_answer('${attemptId}', '${mcItemId}', '1', null);`);
    expect(psql(`select status from mock_exam_attempts where id = '${attemptId}';`)).toBe("in_progress");
    expect(psql(`select correct from mock_exam_answers where attempt_id = '${attemptId}';`)).toBe("t");
    expect(await parentRows()).toEqual([]);
    const own = await clientFor(STUDENT_ID).from("mock_exam_answers").select("id").eq("attempt_id", attemptId);
    expect(own.data ?? []).toEqual([]);
    for (const userId of [TEACHER_ID, ADMIN_ID]) {
      const { data } = await clientFor(userId).from("mock_exam_answers").select("id, correct").eq("attempt_id", attemptId);
      expect(data, `${userId}`).toHaveLength(1);
      expect(data![0].correct).toBe(true);
    }
    // 학부모 요약 RPC 도 응시 중에는 정오를 주지 않는다.
    const detail = JSON.parse(asUser(PARENT_ID, `select mock_exam_attempt_detail('${attemptId}')::text;`));
    expect(detail.items[0].correct).toBeNull();
  });

  it("제출·채점 확정(graded) 뒤: 학부모가 답안 정오를 읽는다(결과 화면 경로 유지)", async () => {
    asUser(STUDENT_ID, `select mock_exam_submit('${attemptId}');`);
    expect(psql(`select status from mock_exam_attempts where id = '${attemptId}';`)).toBe("graded");
    const rows = await parentRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].correct).toBe(true);
    const detail = JSON.parse(asUser(PARENT_ID, `select mock_exam_attempt_detail('${attemptId}')::text;`));
    expect(detail.items[0].correct).toBe(true);
    expect(detail.items[0].correctIndex).toBe(1);
  });

  it("관계없는 사용자(다른 학생)는 채점 뒤에도 0행", async () => {
    const other = "cccccccc-0000-0000-0000-000000000002";
    const { data } = await clientFor(other).from("mock_exam_answers").select("id").eq("attempt_id", attemptId);
    expect(data ?? []).toEqual([]);
  });
});
