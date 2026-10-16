// 모의고사 MST 라우팅(Phase 3) DB 통합 테스트 공용 픽스처 — 실행마다 새 세트·새 문항·새 학생을 만들어
// 재실행 안전(초기화 없이 연속 통과)하게 한다. 정리는 하지 않아도 다른 실행과 겹치지 않는다(실행 ID로 구분).
import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";

export const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
export const API_URL = process.env.SUPABASE_TEST_API_URL ?? "http://127.0.0.1:54421";
export const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
export const SEED_STUDENT_ID = "cccccccc-0000-0000-0000-000000000001";
export const SEED_GUARDIAN_ID = "bbbbbbbb-0000-0000-0000-000000000001";
export const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
export const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";

export function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
export function asUser(userId: string, sql: string): string {
  return psql(`set role authenticated; do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$; ${sql} reset role;`);
}
export function fails(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    return String((e as { stderr?: string }).stderr ?? e);
  }
  return "";
}

/** 로컬 Supabase 기본 JWT 시크릿으로 서명한 사용자 JWT — 실제 PostgREST 를 그 사용자 권한으로 호출한다. */
export function userJwt(userId: string): string {
  const b = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = b({ alg: "HS256", typ: "JWT" });
  const body = b({ iss: "supabase-demo", role: "authenticated", sub: userId, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 });
  const sig = createHmac("sha256", process.env.SUPABASE_TEST_JWT_SECRET ?? "super-secret-jwt-token-with-at-least-32-characters-long")
    .update(`${head}.${body}`)
    .digest("base64url");
  return `${head}.${body}.${sig}`;
}

export async function rest(userId: string | null, path: string, init?: { method?: string; body?: unknown }) {
  const token = userId ? userJwt(userId) : userJwt("00000000-0000-0000-0000-000000000000");
  const res = await fetch(`${API_URL}/rest/v1/${path}`, {
    method: init?.method ?? "GET",
    headers: { apikey: token, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json, text };
}

export function createStudent(label: string, run: string): string {
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'mxr3-${label}-${run}-${Math.random().toString(36).slice(2)}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`,
  );
  psql(`insert into profiles (id, role, name) values ('${id}', 'student', 'mxr3-${label}-${run}');`);
  psql(`insert into students (id, status) values ('${id}', 'active');`);
  return id;
}

export type RoutingFixture = {
  setId: string;
  run: string;
  ids: {
    rw_m1: string[];
    rw_lower: string[];
    rw_higher: string[];
    math_m1: string[];
    math_lower: string[];
    math_higher: string[];
  };
};

const alphaOf = (n: number) => String(n).replace(/\d/g, (d) => String.fromCharCode(97 + Number(d)).repeat(2));
let counter = 0;

function problem(run: string, domain: string, difficulty: string): { problemId: string; versionId: string } {
  counter += 1;
  const problemId = psql(
    `insert into problems (format, passage, subject_id, status, created_by, sat_domain) values ('mc', 'R3 ${run} ${alphaOf(counter)} ${randomUUID().slice(0, 6).replace(/\d/g, "x")}', '${SUBJECT_ID}', 'confirmed', '${TEACHER_ID}', '${domain}') returning id;`,
  );
  psql(
    `update problem_versions set options = '["a","b","c","d"]'::jsonb, correct_index = 0, explanation = '해설', difficulty = '${difficulty}', status = 'published', published_at = now()
     where problem_id = '${problemId}' and version_no = 1;`,
  );
  const versionId = psql(`select id from problem_versions where problem_id = '${problemId}' and version_no = 1;`);
  psql(`update problems set published_version_id = '${versionId}' where id = '${problemId}';`);
  return { problemId, versionId };
}

/**
 * 라우팅 세트(assembly_rules.routing=true): R&W M1 4 · M2 lower 2 / higher 2, Math M1 2 · M2 lower 2 / higher 2.
 * position 은 섹션 안에서 연속(rw 1..8, math 1..6). 모든 문항 정답 인덱스 0. publish=true 면 ready·published 까지.
 */
export function createRoutingSet(opts: { run: string; routing?: boolean; publish?: boolean; label?: string }): RoutingFixture {
  const { run } = opts;
  const routing = opts.routing ?? true;
  const setId = psql(
    `insert into mock_exam_sets (name, difficulty_tier, status, format, module_item_counts, assembly_rules, created_by)
     values ('R3 ${opts.label ?? "routing"} ${run}-${Date.now()}', 'standard', 'draft', 'mst',
             '${routing ? '{"rw_m1":4,"rw_m2":2,"math_m1":2,"math_m2":2}' : '{"rw_m1":4,"rw_m2":4,"math_m1":2,"math_m2":4}'}',
             '${routing ? '{"routing":true,"enforceM1Eligibility":true}' : '{"enforceM1Eligibility":true}'}', '${ADMIN_ID}') returning id;`,
  );
  const ids: RoutingFixture["ids"] = { rw_m1: [], rw_lower: [], rw_higher: [], math_m1: [], math_lower: [], math_higher: [] };
  let rwPos = 0;
  let mathPos = 0;
  const add = (
    bucket: keyof RoutingFixture["ids"],
    section: "rw" | "math",
    moduleKey: string,
    route: "lower" | "higher" | null,
    difficulty: string,
  ) => {
    const domain = section === "rw" ? "rw_craft_structure" : "algebra";
    const p = problem(run, domain, difficulty);
    const pos = section === "rw" ? ++rwPos : ++mathPos;
    const id = psql(
      `insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, difficulty, module_key, route)
       values ('${setId}', '${section}', ${pos}, '${p.problemId}', '${p.versionId}', '${domain}', '${difficulty}', '${moduleKey}', ${route ? `'${route}'` : "null"}) returning id;`,
    );
    ids[bucket].push(id);
  };
  for (const d of ["easy", "easy", "medium", "medium"]) add("rw_m1", "rw", "rw_m1", null, d);
  for (const d of ["easy", "medium"]) add("rw_lower", "rw", "rw_m2", routing ? "lower" : null, d);
  for (const d of ["medium", "hard"]) add("rw_higher", "rw", "rw_m2", routing ? "higher" : null, d);
  for (const d of ["easy", "medium"]) add("math_m1", "math", "math_m1", null, d);
  for (const d of ["easy", "medium"]) add("math_lower", "math", "math_m2", routing ? "lower" : null, d);
  for (const d of ["medium", "hard"]) add("math_higher", "math", "math_m2", routing ? "higher" : null, d);
  if (opts.publish ?? true) publishSet(setId);
  return { setId, run, ids };
}

/** 검증 통과를 확인하고 ready → published(배정 게이트 통과 조건). 라우팅이 아닌 세트는 M2 문항이 2개씩 4개라 정원 초과 → 레거시 세트는 별도 정원으로. */
export function publishSet(setId: string) {
  psql(`update mock_exam_sets set readiness_status = 'ready', readiness_checked_at = now() where id = '${setId}';`);
  psql(`update mock_exam_sets set status = 'published' where id = '${setId}';`);
}

export function validate(setId: string) {
  return JSON.parse(psql(`select mock_exam_validate_mst_set('${setId}')::text;`));
}

export function assign(studentId: string, setId: string): string {
  return psql(`insert into mock_exam_attempts (student_id, exam_set_id, status) values ('${studentId}', '${setId}', 'assigned') returning id;`);
}
export function start(studentId: string, attemptId: string) {
  asUser(studentId, `select mock_exam_start_mst('${attemptId}');`);
}
/** 앞에서부터 nCorrect 개는 정답("0"), 나머지는 오답("1")으로 저장. */
export function answer(studentId: string, attemptId: string, itemIds: string[], nCorrect: number) {
  itemIds.forEach((id, i) => asUser(studentId, `select mock_exam_save_answer('${attemptId}', '${id}', '${i < nCorrect ? "0" : "1"}', 3);`));
}
export function submitModule(studentId: string, attemptId: string, key: string) {
  asUser(studentId, `select mock_exam_submit_module('${attemptId}', '${key}');`);
}
export function state(studentId: string, attemptId: string) {
  return JSON.parse(asUser(studentId, `select mock_exam_mst_state('${attemptId}')::text;`)) as {
    currentModule: string;
    items: { setItemId: string; section: string; position: number; moduleSeq: number; difficulty: string | null }[];
    modules: { moduleKey: string; itemCount: number; locked: boolean }[];
  };
}
export function routes(attemptId: string) {
  const [rw, math, rwV, mathV] = psql(
    `select coalesce(rw_m2_route::text,'-'), coalesce(math_m2_route::text,'-'), coalesce(rw_m2_route_policy_version::text,'-'), coalesce(math_m2_route_policy_version::text,'-') from mock_exam_attempts where id = '${attemptId}';`,
  ).split("|");
  return { rw, math, rwV, mathV };
}
