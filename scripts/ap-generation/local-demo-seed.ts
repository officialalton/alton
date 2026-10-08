// 로컬 전용 AP 데모 세트(브라우저·UAT 확인용). 실행 ID 로 만든 행만 지운다. 로컬 DB(127.0.0.1)가 아니면 즉시 중단.
//   npx tsx scripts/ap-generation/local-demo-seed.ts seed      # 과목 3·후보 일부 변환·세트 2개·학생 2명(무료·과외) 생성
//   npx tsx scripts/ap-generation/local-demo-seed.ts cleanup   # 이 스크립트가 만든 모든 행 삭제
// 학생 계정은 로컬 테스트 전용(이메일 @example.com, 실행 ID 접두). 비밀번호는 출력하지 않는다(로컬 시드 규약: .env.local 의 SEED_TEST_PASSWORD 가 없으면 생성 안 함).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { connect } from "../keywords/db";
import { convertCandidate, type CandidateRow } from "../../lib/ap-exam/convert-run";
import { gateCandidate } from "../../lib/ap-figures/gate";

const STATE = path.resolve(process.cwd(), "tmp/ap-demo-state.json");
const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const psql = (sql: string) => execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
const q = (t: string) => `'${t.replace(/'/g, "''")}'`;

const SUBJECTS: Record<string, string> = { ap_calculus_ab: "AP Calculus AB", ap_biology: "AP Biology", ap_microeconomics: "AP Microeconomics" };

async function seed() {
  const conn = await connect(); if (!conn || conn.target !== "local") throw new Error("로컬 DB 에서만 실행합니다.");
  const RUN = `apdemo${Date.now().toString(36)}`;
  const items = JSON.parse(readFileSync(path.resolve(process.cwd(), "data/ap/stock/items.json"), "utf-8")) as (CandidateRow & { validation: string; keywordCode: string; difficultyProvisional: string; run: string; stockKey: string; calculator: string })[];
  const state: { run: string; students: Record<string, string>; sets: string[] } = { run: RUN, students: {}, sets: [] };
  const admin = psql(`select id from profiles where role = 'admin' limit 1;`);
  const subj: Record<string, string> = {};
  for (const [code, name] of Object.entries(SUBJECTS)) subj[code] = psql(`insert into subjects (name, ap_subject_code) values (${q(`${RUN} ${name}`)}, ${q(code)}) returning id;`);
  const pick = (code: string, kind: string, pred: (c: typeof items[number]) => boolean, n: number) =>
    items.filter((c) => (c.validation === "auto_passed" || c.validation === "needs_revalidation") && c.apSubjectCode === code && c.kind === kind && pred(c) && gateCandidate(c).status !== "fail").slice(0, n);
  const hasFig = (renderType: RegExp) => (c: typeof items[number]) => renderType.test(gateCandidate(c).renderType);
  const chosen = [
    ...pick("ap_calculus_ab", "mc", hasFig(/ap_graph/), 2), ...pick("ap_calculus_ab", "mc", hasFig(/^ap_table/), 1), ...pick("ap_calculus_ab", "mc", (c) => gateCandidate(c).need === "text_only", 1),
    ...pick("ap_biology", "mc", hasFig(/ap_table/), 2), ...pick("ap_biology", "frq_bundle", () => true, 1),
    ...pick("ap_microeconomics", "mc", hasFig(/ap_graph/), 2), ...pick("ap_microeconomics", "mc", hasFig(/ap_table/), 1),
  ];
  const lessonOne = pick("ap_calculus_ab", "mc", (c) => gateCandidate(c).need === "text_only", 3).slice(1, 2);
  const byKey = new Map<string, string>(); // stockKey -> problem ids
  for (const [c, purpose] of [...chosen.map((x) => [x, "mock_exam"] as const), ...lessonOne.map((x) => [x, "lesson"] as const)]) {
    const key = `${RUN}-${c.stockKey.replace(/[^A-Za-z0-9_.-]/g, "_")}`;
    psql(`insert into ap_candidate_items (candidate_key, run_id, subject_id, ap_subject_code, kind, keyword_code, skill_primary, structure, response_mode, scoring_mode, difficulty_provisional, payload, review_state, calculator, is_current)
      values (${q(key)}, ${q(RUN)}, '${subj[c.apSubjectCode]}', ${q(c.apSubjectCode)}, ${q(c.kind)}, ${q(c.keywordCode)}, '1.A', ${q(c.kind === "mc" ? "standalone" : "frq_multipart")}, 'select', 'exact', ${q(c.difficultyProvisional ?? "exam_prep")}, ${q(JSON.stringify(c.payload))}::jsonb, 'auto_passed', ${q(c.calculator === "required" || c.calculator === "not_allowed" ? c.calculator : "na")}, true);`);
    psql(`select ap_set_verification(${q(key)}, true, null, ${q(JSON.stringify({ demo: true }))}::jsonb, '${admin}');`);
    psql(`select ap_set_verification(${q(key)}, null, true, ${q(JSON.stringify({ demo: true, note: "local demo seed" }))}::jsonb, '${admin}');`);
    const res = await convertCandidate(conn.db as never, { ...c, candidateKey: key } as CandidateRow, purpose, admin);
    console.log(key, purpose, res.status, (res as { reason?: string }).reason ?? "");
    byKey.set(key, c.apSubjectCode);
  }
  // 세트: 과목별(데모용 소형 구조 — 공식 문항 수 아님)
  const mk = async (code: string, label: "mc_practice" | "full_practice", name: string, tier: "free" | "tutoring") => {
    const rows = psql(`select i.candidate_key || '|' || cp.problem_id || '|' || cp.problem_version_id || '|' || i.kind || '|' || i.keyword_code from ap_candidate_items i join ap_candidate_problems cp on cp.candidate_key = i.candidate_key where i.run_id = ${q(RUN)} and i.ap_subject_code = ${q(code)} and i.purpose = 'mock_exam' order by i.candidate_key;`).split("\n").filter(Boolean).map((l) => l.split("|"));
    const mc = rows.filter((r) => r[3] === "mc"), frq = rows.filter((r) => r[3] === "frq_bundle");
    const sections = [{ key: "ap_mc", kind: "mc", label: "Section I: Multiple Choice", minutes: 25, count: mc.length, calculator: code === "ap_calculus_ab" ? "not_allowed" : "allowed", options: code === "ap_microeconomics" ? 5 : 4 }, ...(label === "full_practice" && frq.length ? [{ key: "ap_frq", kind: "frq", label: "Section II: Free Response", minutes: 20, count: frq.length, calculator: "allowed" }] : [])];
    const id = psql(`insert into mock_exam_sets (name, difficulty_tier, status, format, readiness_status, exam_program, ap_subject, ap_label, section_layout) values (${q(`${RUN}-${name}`)}, 'standard', 'draft', 'ap_fixed', 'not_applicable', 'ap', ${q(code)}, ${q(label)}, ${q(JSON.stringify({ sections }))}::jsonb) returning id;`);
    let pos = 0;
    for (const r of mc) psql(`insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, difficulty) values ('${id}', 'ap_mc', ${++pos}, '${r[1]}', '${r[2]}', ${q(`ap:${r[4]}`)}, 'medium');`);
    pos = 0;
    if (label === "full_practice") for (const r of frq) psql(`insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, difficulty) values ('${id}', 'ap_frq', ${++pos}, '${r[1]}', '${r[2]}', ${q(`ap:${r[4]}`)}, 'medium');`);
    psql(`update mock_exam_sets set status = 'published', published_at = now(), access_tier = ${q(tier)} where id = '${id}';`);
    state.sets.push(id);
    console.log("세트", name, id);
  };
  await mk("ap_calculus_ab", "mc_practice", "AP Calculus AB MC Practice (demo)", "free");
  await mk("ap_biology", "full_practice", "AP Biology Full Practice (demo)", "free");
  await mk("ap_microeconomics", "mc_practice", "AP Microeconomics MC Practice (demo)", "tutoring");
  // 학생(로컬 테스트 전용). 비밀번호는 환경변수에서만 읽고 출력하지 않는다.
  const pw = process.env.SEED_TEST_PASSWORD;
  if (pw) for (const [label, type] of [["free", "free"], ["tutoring", "tutoring"]] as const) {
    const email = `${RUN}-${label}@example.com`;
    const id = psql(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
      values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', ${q(email)}, crypt(${q(pw)}, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '') returning id;`);
    psql(`insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at) values (gen_random_uuid(), '${id}', '${id}', 'email', jsonb_build_object('sub', '${id}', 'email', ${q(email)}), now(), now(), now());`);
    psql(`insert into profiles (id, role, name, date_of_birth) values ('${id}', 'student', ${q(`${RUN}-${label}`)}, '2010-01-01');`);
    psql(`insert into students (id, status, member_type, signup_source, grade, profile_completed_at) values ('${id}', 'active', '${type}', '${type === "free" ? "self_signup" : "admin_direct"}', '10th', now());`);
    state.students[label] = email;
  }
  else console.log("SEED_TEST_PASSWORD 가 없어 학생 계정은 만들지 않았습니다.");
  writeFileSync(STATE, JSON.stringify(state, null, 1));
  console.log("완료. 상태:", STATE);
}

function cleanup() {
  if (!existsSync(STATE)) throw new Error("상태 파일이 없습니다.");
  const { run } = JSON.parse(readFileSync(STATE, "utf-8")) as { run: string };
  psql(`begin; set local session_replication_role = replica;
    delete from mock_exam_answers where attempt_id in (select a.id from mock_exam_attempts a join mock_exam_sets s on s.id = a.exam_set_id where s.name like ${q(`${run}-%`)});
    delete from mock_exam_attempts where exam_set_id in (select id from mock_exam_sets where name like ${q(`${run}-%`)});
    delete from mock_exam_set_items where exam_set_id in (select id from mock_exam_sets where name like ${q(`${run}-%`)});
    delete from mock_exam_sets where name like ${q(`${run}-%`)};
    delete from ap_candidate_problems where candidate_key like ${q(`${run}-%`)};
    delete from problem_keywords where problem_id in (select id from problems where ap_candidate_key like ${q(`${run}-%`)});
    delete from problem_error_reports where problem_id in (select id from problems where ap_candidate_key like ${q(`${run}-%`)});
    delete from problem_versions where problem_id in (select id from problems where ap_candidate_key like ${q(`${run}-%`)});
    delete from problems where ap_candidate_key like ${q(`${run}-%`)};
    delete from ap_candidate_items where run_id = ${q(run)};
    delete from subjects where name like ${q(`${run} %`)};
    delete from students where id in (select id from profiles where name like ${q(`${run}-%`)});
    delete from auth.identities where user_id in (select id from auth.users where email like ${q(`${run}-%`)});
    delete from profiles where name like ${q(`${run}-%`)};
    delete from auth.users where email like ${q(`${run}-%`)};
    commit;`);
  console.log("정리 완료:", run);
}
const cmd = process.argv[2];
(cmd === "seed" ? seed() : cmd === "cleanup" ? Promise.resolve(cleanup()) : Promise.reject(new Error("seed|cleanup"))).catch((e) => { console.error(e); process.exit(1); });
