import { execFileSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";

// 2026-10-06 은행 게이트 우회 봉쇄(마이그레이션 20262100000240) — 실행 ID(RUN)가 붙은 전용 문항·세트만 만들고 afterAll 에서 지운다.
// 로컬 DB(공유)에는 db reset 없이 psql 만 쓴다. 다른 통합 테스트는 vitest.config 가 PGOPTIONS 로 우회 설정을 켜지만, 이 파일은 끈다.
const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
const RUN = `gate${Date.now()}`;

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8", env: { ...process.env, PGOPTIONS: "" } }).trim();
}
/** 실패해야 하는 SQL — 오류 메시지를 돌려준다(성공하면 빈 문자열). */
function psqlErr(sql: string): string {
  try { psql(sql); return ""; } catch (e) { return String((e as { stderr?: Buffer | string }).stderr ?? e); }
}
const problems: string[] = [];
const sets: string[] = [];
const OK_RC = `'{"ok": true, "issues": []}'::jsonb`;

/** draft 문항 + v1 을 만들고 본문을 채운다. 공개는 호출자가 한다. */
function make(scope: "mock_exam" | "general" | "both", v: { options?: string; correct?: number; en?: string | null; rc?: string | null } = {}): { pid: string; vid: string } {
  const pid = psql(`insert into problems (format, passage, subject_id, status, created_by, usage_scope, sat_domain, skill_code, exam_system)
    values ('mc', '${RUN} passage', '${SUBJECT_ID}', 'draft', '${ADMIN_ID}', '${scope}', 'rw_craft_structure', 'words_in_context', 'sat_rw') returning id;`);
  problems.push(pid);
  const vid = psql(`select id from problem_versions where problem_id = '${pid}' and version_no = 1;`);
  const en = v.en === undefined ? "English explanation." : v.en;
  psql(`update problem_versions set passage = '${RUN} passage', question = 'Which choice?', options = '${v.options ?? '["a1","b2","c3","d4"]'}'::jsonb,
    correct_index = ${v.correct ?? 0}, explanation = '해설', explanation_en = ${en === null ? "null" : `'${en}'`}, difficulty = 'medium',
    render_check = ${v.rc === null ? "null" : (v.rc ?? OK_RC)} where id = '${vid}';`);
  return { pid, vid };
}
const publish = (vid: string) => psqlErr(`select confirm_and_publish_problem_version('${vid}', '${ADMIN_ID}');`);
const published = (v: Parameters<typeof make>[1] = {}, scope: "mock_exam" | "general" | "both" = "mock_exam") => {
  const p = make(scope, v);
  expect(publish(p.vid)).toBe("");
  return p;
};
function newSet(): string {
  const id = psql(`insert into mock_exam_sets (name, difficulty_tier, status, created_by) values ('${RUN} set', 'standard', 'draft', '${ADMIN_ID}') returning id;`);
  sets.push(id);
  return id;
}
let pos = 0;
function place(setId: string, pid: string, vid: string) {
  pos += 1;
  psql(`insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, skill_code, difficulty)
    values ('${setId}', 'rw', ${pos}, '${pid}', '${vid}', 'rw_craft_structure', 'words_in_context', 'medium');`);
}
const publishSet = (id: string) => psqlErr(`update mock_exam_sets set status = 'published', published_at = now(), published_by = '${ADMIN_ID}' where id = '${id}';`);
/** 공개본 내용 직접 수정(합법 경로 시뮬레이션) — 세션 설정을 같은 트랜잭션에서 켠다. */
const editViaRpcPath = (sql: string) => psqlErr(`begin; select set_config('alton.version_content_edit', 'on', true); ${sql} commit;`);

afterAll(() => {
  const ids = problems.map((i) => `'${i}'`).join(",") || "null";
  const s = sets.map((i) => `'${i}'`).join(",") || "null";
  psql(`delete from mock_exam_set_items where exam_set_id in (${s}) or problem_id in (${ids});`);
  psql(`delete from mock_exam_sets where id in (${s});`);
  psql(`update problems set published_version_id = null where id in (${ids});`);
  psql(`delete from problem_versions where problem_id in (${ids});`);
  psql(`delete from problems where id in (${ids});`);
});

describe("버전 공개 게이트", () => {
  it("render_check 가 없으면(그림 없는 버전도) 공개를 거부한다", () => {
    expect(publish(make("mock_exam", { rc: null }).vid)).toMatch(/렌더링 검증 기록이 없습니다/);
  });
  it("정답 번호가 범위 밖이거나 선택지가 중복이면 거부한다", () => {
    expect(publish(make("mock_exam", { correct: 4 }).vid)).toMatch(/범위를 벗어났/);
    expect(publish(make("mock_exam", { options: '["x","y","x","z"]' }).vid)).toMatch(/중복/);
  });
  it("모의고사용·양쪽 용도는 영어 해설이 필수, 일반용은 불필요", () => {
    expect(publish(make("mock_exam", { en: null }).vid)).toMatch(/영어 해설/);
    expect(publish(make("both", { en: " " }).vid)).toMatch(/영어 해설/);
    expect(publish(make("general", { en: null }).vid)).toBe("");
  });
  it("정상 문항은 공개된다", () => { published(); });
});

describe("공개 버전 불변", () => {
  it("공개본의 본문·선택지·정답·해설 직접 수정을 막는다", () => {
    const { vid } = published();
    for (const set of ["passage = 'x'", "question = 'x'", `options = '["q","w"]'::jsonb`, "correct_index = 1", "explanation = 'x'", "explanation_en = 'changed'", "explanation_en = null", "answers = '[\"1\"]'::jsonb"]) {
      expect(psqlErr(`update problem_versions set ${set} where id = '${vid}';`), set).toMatch(/직접 고칠 수 없습니다/);
    }
  });
  it("render_check·quality 갱신과 보관 전환은 허용, 영어 해설 빈 칸 채우기는 허용", () => {
    const g = published({}, "general");
    expect(psqlErr(`update problem_versions set quality = '{"a":1}'::jsonb, render_check = ${OK_RC} where id = '${g.vid}';`)).toBe("");
    const n = published({ en: null }, "general");
    expect(psqlErr(`update problem_versions set explanation_en = 'Filled later.' where id = '${n.vid}';`)).toBe("");
    expect(psqlErr(`update problem_versions set status = 'archived' where id = '${n.vid}';`)).toBe("");
  });
  it("선지 순서 교정 RPC 경로(세션 설정)는 통과하고, 설정은 그 트랜잭션에만 적용된다", () => {
    const { vid } = published();
    expect(editViaRpcPath(`update problem_versions set options = '["d4","c3","b2","a1"]'::jsonb, correct_index = 3 where id = '${vid}';`)).toBe("");
    expect(psql(`select correct_index from problem_versions where id = '${vid}';`)).toBe("3");
    expect(psqlErr(`update problem_versions set correct_index = 0 where id = '${vid}';`)).toMatch(/직접 고칠 수 없습니다/);
  });
  it("apply_problem_option_reorders RPC 가 실제로 공개본을 교정한다", () => {
    const { vid } = published();
    const exp = `{"options":["a1","b2","c3","d4"],"correct_index":0,"explanation":"해설","explanation_en":"English explanation."}`;
    const aft = `{"options":["b2","a1","c3","d4"],"correct_index":1,"explanation":"해설","explanation_en":"English explanation."}`;
    // problem_option_reorders 는 append-only(삭제 불가)라 롤백 트랜잭션 안에서만 실행한다.
    const out = psql(`begin; select apply_problem_option_reorders('[{"version_id":"${vid}","expected":${exp},"after":${aft},"perm":[1,0,2,3]}]'::jsonb, '${ADMIN_ID}')->>'applied';
      select correct_index from problem_versions where id = '${vid}'; rollback;`).split("\n").filter((l) => /^\d+$/.test(l));
    expect(out).toEqual(["1", "1"]);
  });
});

describe("세트 공개 게이트", () => {
  it("모든 항목이 정상이면 공개된다", () => {
    const a = published();
    const s = newSet();
    place(s, a.pid, a.vid);
    expect(publishSet(s)).toBe("");
  });
  it("현재 공개본이 아닌 버전을 가리키는 항목이 있으면 거부한다", () => {
    const a = published();
    const s = newSet();
    place(s, a.pid, a.vid);
    const v2 = psql(`insert into problem_versions (problem_id, version_no, passage, question, options, correct_index, explanation, explanation_en, difficulty, status, render_check)
      values ('${a.pid}', 2, '${RUN} passage v2', 'Which choice?', '["a1","b2","c3","d4"]', 0, '해설', 'English v2.', 'medium', 'draft', ${OK_RC}) returning id;`);
    expect(publish(v2)).toBe("");
    expect(publishSet(s)).toMatch(/version_not_current_published|version_not_published/);
  });
  it("영어 해설이 비었거나 한글 본문 항목이 있으면 거부한다", () => {
    const a = published();
    const b = published();
    const s = newSet();
    place(s, a.pid, a.vid); place(s, b.pid, b.vid);
    expect(editViaRpcPath(`update problem_versions set explanation_en = null where id = '${a.vid}';`)).toBe("");
    expect(publishSet(s)).toMatch(/explanation_en_missing/);
    expect(editViaRpcPath(`update problem_versions set explanation_en = 'ok' where id = '${a.vid}'; update problem_versions set options = '["가","b2","c3","d4"]'::jsonb where id = '${b.vid}';`)).toBe("");
    expect(publishSet(s)).toMatch(/hangul_in_stem/);
  });
  it("보관된 문항·render_check 불통과 항목이 있으면 거부한다", () => {
    const a = published();
    const s = newSet();
    place(s, a.pid, a.vid);
    expect(psqlErr(`update problem_versions set render_check = '{"ok": false, "issues": []}'::jsonb where id = '${a.vid}';`)).toBe("");
    expect(publishSet(s)).toMatch(/render_check_not_ok/);
    psql(`update problem_versions set render_check = ${OK_RC} where id = '${a.vid}'; update problems set archived_at = now() where id = '${a.pid}';`);
    expect(publishSet(s)).toMatch(/problem_archived/);
  });
});

describe("용도 되돌리기 차단", () => {
  it("draft·published 세트에 들어간 문항은 일반용으로 바꿀 수 없고, 세트 보관 뒤에는 가능", () => {
    const a = published();
    const s = newSet();
    place(s, a.pid, a.vid);
    expect(psqlErr(`update problems set usage_scope = 'general' where id = '${a.pid}';`)).toMatch(/일반용으로 바꿀 수 없습니다/);
    expect(psqlErr(`select retag_problem_usage_scope(array['${a.pid}']::uuid[], 'general', '${ADMIN_ID}', 'test');`)).toMatch(/일반용으로 바꿀 수 없습니다/);
    psql(`update mock_exam_sets set status = 'archived', archived_at = now() where id = '${s}';`);
    expect(psqlErr(`update problems set usage_scope = 'general' where id = '${a.pid}';`)).toBe("");
  });
});
