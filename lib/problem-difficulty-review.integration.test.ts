import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// 관리자 hard 난이도 점검 — DB 계약(2026-10-01, 마이그레이션 20261985000000).
// 실행 ID(RUN)가 붙은 전용 문항·세트·응시만 만들고 afterAll 에서 그 행만 정리한다(이력은 replica 설정으로 테스트 전용 정리).
// 재실행 안전. 대상 DB = SUPABASE_TEST_DB_URL(기본 로컬).

const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
const RUN = `DIFFREV${Date.now()}`;
const DOMAIN = "rw_craft_structure";
const SKILL = "words_in_context";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
function asRole(role: "anon" | "authenticated", userId: string | null, sql: string): string {
  return psql(`
    set role ${role};
    ${userId ? `do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$;` : ""}
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
const alpha = (n: number) => String(n).replace(/\d/g, (d) => String.fromCharCode(97 + Number(d)).repeat(3));
let seq = 0;
let tag = "";
const problems: string[] = [];
const sets: string[] = [];
const attempts: string[] = [];

/** 공개 문항 하나. created_via·난이도 지정. 본문에 RUN 을 넣어 검색 격리. */
function problem(opts: { difficulty: "easy" | "medium" | "hard"; via?: "manual" | "ai_generated"; scope?: string; publish?: boolean; quality?: object }): string {
  seq += 1;
  const id = psql(
    `insert into problems (format, passage, subject_id, status, created_by, usage_scope, sat_domain, skill_code, difficulty, created_via)
     values ('mc', '${RUN}${tag} ${alpha(seq)} passage', '${SUBJECT_ID}', 'confirmed', '${ADMIN_ID}', '${opts.scope ?? "mock_exam"}', '${DOMAIN}', '${SKILL}', '${opts.difficulty}', '${opts.via ?? "ai_generated"}') returning id;`,
  );
  problems.push(id);
  if (opts.publish === false) {
    psql(`update problem_versions set status = 'draft', published_at = null where problem_id = '${id}'; update problems set published_version_id = null where id = '${id}';`);
  } else {
    psql(`update problem_versions set options = '["가","나","다","라"]'::jsonb, correct_index = 0, explanation = '해설', difficulty = '${opts.difficulty}', status = 'published', published_at = now()${opts.quality ? `, quality = '${JSON.stringify(opts.quality)}'::jsonb` : ""} where problem_id = '${id}' and version_no = 1;`);
    psql(`update problems set published_version_id = (select id from problem_versions where problem_id = '${id}' and version_no = 1) where id = '${id}';`);
  }
  return id;
}
function review(ids: string[], to: string, reason: string | null = null, actor = ADMIN_ID): { confirmed: number; changed: number; skipped: number; needsSetReplacement: string[] } {
  const arr = `array[${ids.map((i) => `'${i}'`).join(",")}]::uuid[]`;
  const out = psql(`select review_problem_difficulty(${arr}, '${to}', '${actor}', ${reason === null ? "null" : `'${reason}'`})::text;`);
  return JSON.parse(out);
}
const state = (id: string) => psql(`select difficulty::text || '|' || difficulty_status || '|' || coalesce(difficulty_confirmed_at is not null, false)::text from problems where id = '${id}';`);
const vdiff = (id: string) => psql(`select difficulty from problem_versions where id = (select published_version_id from problems where id = '${id}');`);
const historyCount = (id: string) => Number(psql(`select count(*) from problem_difficulty_changes where problem_id = '${id}';`));
function list(status: string, extra = "null, null", q = `${RUN}${tag}`): { summary: Record<string, number>; total: number; rows: { problemId: string; state: string; difficulty: string }[] } {
  return JSON.parse(psql(`select problem_difficulty_review_list('${status}', ${extra}, '${q}', 50, 0)::text;`));
}
function mstSet(): string {
  const id = psql(
    `insert into mock_exam_sets (name, difficulty_tier, status, created_by, format) values ('${RUN} set', 'standard', 'draft', '${ADMIN_ID}', 'mst') returning id;`,
  );
  sets.push(id);
  return id;
}
let pos = 0;
function place(setId: string, problemId: string, moduleKey: string, route: string | null, difficulty: string): string {
  pos += 1;
  return psql(
    `insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, skill_code, difficulty, module_key, route)
     select '${setId}', 'rw', ${pos}, id, published_version_id, '${DOMAIN}', '${SKILL}', '${difficulty}', '${moduleKey}', ${route ? `'${route}'` : "null"} from problems where id = '${problemId}' returning id;`,
  );
}

beforeAll(() => {
  psql("select 1;");
});

afterAll(() => {
  if (problems.length) {
    const ids = problems.map((i) => `'${i}'`).join(",");
    const setIds = sets.map((i) => `'${i}'`).join(",");
    const attIds = attempts.map((i) => `'${i}'`).join(",");
    psql(`begin;
      set local session_replication_role = replica;
      ${attempts.length ? `delete from mock_exam_attempts where id in (${attIds});` : ""}
      ${sets.length ? `delete from mock_exam_set_items where exam_set_id in (${setIds}); delete from mock_exam_sets where id in (${setIds});` : ""}
      delete from problem_difficulty_changes where problem_id in (${ids});
      delete from problem_versions where problem_id in (${ids});
      delete from problems where id in (${ids});
      commit;`);
  }
});

describe("잠정 상태 자동 부여와 백필", () => {
  it("AI 생성 hard 는 created_via 전환 시점에 잠정, 그 밖은 기본값 유지", () => {
    const aiHard = problem({ difficulty: "hard", via: "ai_generated" });
    const aiMedium = problem({ difficulty: "medium", via: "ai_generated" });
    const manualHard = problem({ difficulty: "hard", via: "manual" });
    expect(state(aiHard)).toBe("hard|provisional|false");
    expect(state(aiMedium)).toBe("medium|confirmed|false");
    expect(state(manualHard)).toBe("hard|confirmed|false");
    // 생성 임포트 경로: manual 로 만든 뒤 created_via 만 ai_generated 로 바꾼다.
    const viaImport = problem({ difficulty: "hard", via: "manual" });
    psql(`update problems set created_via = 'ai_generated' where id = '${viaImport}';`);
    expect(state(viaImport)).toBe("hard|provisional|false");
  });

  it("백필 SQL: 기존 AI hard 만 잠정, 비AI·AI medium·이미 확인한 문항은 그대로(멱등)", () => {
    const aiHard = problem({ difficulty: "hard", via: "manual" });
    const aiMedium = problem({ difficulty: "medium", via: "manual" });
    const manualHard = problem({ difficulty: "hard", via: "manual" });
    const aiHardConfirmed = problem({ difficulty: "hard", via: "manual" });
    // 트리거 없이 '옛 상태'를 재현: created_via=ai_generated, status=confirmed.
    psql(`begin; set local session_replication_role = replica;
      update problems set created_via = 'ai_generated' where id in ('${aiHard}','${aiMedium}','${aiHardConfirmed}');
      update problems set difficulty_confirmed_at = now() where id = '${aiHardConfirmed}'; commit;`);
    expect(state(aiHard)).toBe("hard|confirmed|false");
    const sql = readFileSync(path.resolve(__dirname, "../supabase/migrations/20261985000000_admin_difficulty_review.sql"), "utf-8");
    const backfill = sql.slice(sql.indexOf("update public.problems p"), sql.indexOf("-- ── 2."));
    expect(backfill).toContain("created_via = 'ai_generated'");
    // 가드는 난이도·상태 직접 변경을 막으므로 RPC 와 같은 설정으로 백필만 통과시킨다(마이그레이션은 트리거 생성 전에 실행).
    psql(`begin; set local alton.difficulty_rpc = 'on'; ${backfill} commit;`);
    psql(`begin; set local alton.difficulty_rpc = 'on'; ${backfill} commit;`);
    expect(state(aiHard)).toBe("hard|provisional|false");
    expect(state(aiMedium)).toBe("medium|confirmed|false");
    expect(state(manualHard)).toBe("hard|confirmed|false");
    expect(state(aiHardConfirmed)).toBe("hard|confirmed|true");
  });
});

describe("권한 매트릭스", () => {
  const p = () => problem({ difficulty: "hard" });
  it("anon·authenticated(관리자 계정 포함) 는 쓰기·읽기 RPC 와 이력 테이블에 접근할 수 없다", () => {
    const id = p();
    const arr = `array['${id}']::uuid[]`;
    const calls = [
      `select review_problem_difficulty(${arr}, 'medium', '${ADMIN_ID}', 'x');`,
      `select problem_difficulty_review_list('all', null, null, null, 10, 0);`,
      `select problem_difficulty_review_detail('${id}');`,
      `select * from problem_difficulty_set_impact(${arr});`,
      `select * from problem_difficulty_changes;`,
      `insert into problem_difficulty_changes (problem_id, action, from_difficulty, to_difficulty, from_status, to_status, changed_by, batch_id) values ('${id}', 'change', 'hard', 'easy', 'provisional', 'confirmed', '${ADMIN_ID}', gen_random_uuid());`,
    ];
    for (const c of calls) {
      expect(fails(() => asRole("anon", null, c))).toMatch(/permission denied/);
      expect(fails(() => asRole("authenticated", ADMIN_ID, c))).toMatch(/permission denied/);
      expect(fails(() => asRole("authenticated", STUDENT_ID, c))).toMatch(/permission denied/);
    }
    expect(state(id)).toBe("hard|provisional|false");
  });

  it("service 경로여도 관리자가 아닌 actor·없는 actor 는 거절, 난이도 직접 UPDATE 는 관리자·superuser 모두 막힌다", () => {
    const id = p();
    expect(fails(() => review([id], "medium", "사유", STUDENT_ID))).toContain("관리자만");
    expect(fails(() => review([id], "medium", "사유", "00000000-0000-0000-0000-00000000dead"))).toContain("관리자만");
    expect(fails(() => psql(`update problems set difficulty = 'easy' where id = '${id}';`))).toContain("난이도 점검 기능으로만");
    expect(fails(() => psql(`update problems set difficulty_status = 'confirmed' where id = '${id}';`))).toContain("난이도 점검 기능으로만");
    expect(fails(() => asRole("authenticated", ADMIN_ID, `update problems set difficulty = 'easy' where id = '${id}';`))).not.toBe("");
    expect(state(id)).toBe("hard|provisional|false");
    expect(historyCount(id)).toBe(0);
  });
});

describe("변경·확인과 이력", () => {
  it("확인(hard 유지)은 잠정 → 확인됨이고 멱등, 이력은 append-only", () => {
    const id = problem({ difficulty: "hard" });
    const r1 = review([id], "hard", null);
    expect(r1).toMatchObject({ confirmed: 1, changed: 0, skipped: 0 });
    expect(state(id)).toBe("hard|confirmed|true");
    expect(historyCount(id)).toBe(1);
    const r2 = review([id], "hard", null);
    expect(r2).toMatchObject({ confirmed: 0, changed: 0, skipped: 1 });
    expect(historyCount(id)).toBe(1);

    expect(fails(() => psql(`update problem_difficulty_changes set reason = 'x' where problem_id = '${id}';`))).toContain("수정하거나 삭제할 수 없습니다");
    expect(fails(() => psql(`delete from problem_difficulty_changes where problem_id = '${id}';`))).toContain("수정하거나 삭제할 수 없습니다");
    expect(fails(() => psql(`truncate problem_difficulty_changes;`))).toContain("수정하거나 삭제할 수 없습니다");
    expect(historyCount(id)).toBe(1);
  });

  it("변경은 사유 필수, 공개·초안 버전과 problems 를 함께 맞추고 이력에 누가·이전→이후·사유를 남긴다", () => {
    const id = problem({ difficulty: "hard" });
    expect(fails(() => review([id], "medium", null))).toContain("사유");
    expect(fails(() => review([id], "medium", "   "))).toContain("사유");
    // 수정 초안(새 버전)이 있어도 다음 공개가 옛 난이도로 되돌리지 않게 같이 바꾼다. 보관 버전은 이력이라 그대로.
    psql(`insert into problem_versions (problem_id, version_no, passage, difficulty, status) values ('${id}', 2, 'draft v2', 'hard', 'draft'), ('${id}', 3, 'old v3', 'hard', 'archived');`);
    const r = review([id], "medium", "AI 판정이 과함: 전형적 medium");
    expect(r).toMatchObject({ confirmed: 0, changed: 1, skipped: 0 });
    expect(state(id)).toBe("medium|confirmed|true");
    expect(vdiff(id)).toBe("medium");
    expect(psql(`select difficulty from problem_versions where problem_id = '${id}' and version_no = 2;`)).toBe("medium");
    expect(psql(`select difficulty from problem_versions where problem_id = '${id}' and version_no = 3;`)).toBe("hard");
    expect(psql(`select from_difficulty || '>' || to_difficulty || '|' || from_status || '>' || to_status || '|' || action || '|' || changed_by || '|' || reason from problem_difficulty_changes where problem_id = '${id}';`)).toBe(
      `hard>medium|provisional>confirmed|change|${ADMIN_ID}|AI 판정이 과함: 전형적 medium`,
    );
    // 같은 변경 재전송은 멱등(이미 medium → '확인'으로 취급되지만 이미 확인됨이므로 건너뛴다).
    const again = review([id], "medium", "재전송");
    expect(again).toMatchObject({ changed: 0 });
    expect(again.skipped + again.confirmed).toBe(1);
    expect(historyCount(id)).toBe(again.confirmed === 1 ? 2 : 1);
  });

  it("일괄 처리는 한 트랜잭션: 하나라도 공개되지 않았으면 전부 실패하고 아무것도 바뀌지 않는다", () => {
    const a = problem({ difficulty: "hard" });
    const b = problem({ difficulty: "hard" });
    const draftOnly = problem({ difficulty: "hard", publish: false });
    expect(fails(() => review([a, b, draftOnly], "easy", "일괄"))).toContain("공개된 문항만");
    expect(state(a)).toBe("hard|provisional|false");
    expect(state(b)).toBe("hard|provisional|false");
    expect(historyCount(a) + historyCount(b)).toBe(0);
    // 정상 일괄(중복 id 포함)
    const r = review([a, b, a], "easy", "일괄 강등");
    expect(r).toMatchObject({ changed: 2, confirmed: 0, skipped: 0 });
    expect(vdiff(a) + vdiff(b)).toBe("easyeasy");
    const batches = psql(`select count(distinct batch_id) from problem_difficulty_changes where problem_id in ('${a}','${b}');`);
    expect(batches).toBe("1");
  });
});

describe("기존 스냅샷·진행 중 응시·세트 영향", () => {
  it("변경은 세트 스냅샷·응시를 바꾸지 않고, 칸 규칙에 어긋나는 세트만 '교체 필요'로 표시(자동 변경 없음)", () => {
    const hardHigher = problem({ difficulty: "hard" }); // M2 higher 칸
    const hardHigher2 = problem({ difficulty: "hard" }); // M2 higher 칸 → easy 로 바뀌면 위반
    const mediumM1 = problem({ difficulty: "medium" }); // M1 칸 → hard 로 바뀌면 위반
    const setId = mstSet();
    const i1 = place(setId, hardHigher, "rw_m2", "higher", "hard");
    const i2 = place(setId, hardHigher2, "rw_m2", "higher", "hard");
    const i3 = place(setId, mediumM1, "rw_m1", null, "medium");
    // 완성 전 4모듈 세트는 정상 경로로 배정할 수 없으므로(게이트) 트리거 없이 '진행 중 응시' 행을 직접 만든다.
    const attemptId = crypto.randomUUID();
    psql(`begin; set local session_replication_role = replica;
      insert into mock_exam_attempts (id, exam_set_id, student_id, status, started_at, exam_set_group_id)
      select '${attemptId}', id, '${STUDENT_ID}', 'in_progress', now(), set_group_id from mock_exam_sets where id = '${setId}'; commit;`);
    attempts.push(attemptId);
    const snapshot = () => psql(`select string_agg(id || ':' || problem_version_id || ':' || difficulty, ',' order by position) from mock_exam_set_items where exam_set_id = '${setId}';`);
    const attemptRow = () => psql(`select status || '|' || coalesce(started_at::text, '') from mock_exam_attempts where id = '${attemptId}';`);
    const before = snapshot();
    const beforeAttempt = attemptRow();

    // hard → medium: M2 higher 는 medium 허용 → 영향 없음
    expect(review([hardHigher], "medium", "완화").needsSetReplacement).toEqual([]);
    // hard → easy: M2 higher 위반 → 표시
    expect(review([hardHigher2], "easy", "강등").needsSetReplacement).toEqual([hardHigher2]);
    // medium → hard: M1 위반 → 표시
    expect(review([mediumM1], "hard", "상향").needsSetReplacement).toEqual([mediumM1]);

    expect(snapshot()).toBe(before); // 스냅샷 난이도·버전 불변
    expect(attemptRow()).toBe(beforeAttempt);
    expect(psql(`select count(*) from mock_exam_set_items where exam_set_id = '${setId}';`)).toBe("3");
    expect(psql(`select status from mock_exam_sets where id = '${setId}';`)).toBe("draft");
    const detail = JSON.parse(psql(`select problem_difficulty_review_detail('${hardHigher2}')::text;`));
    expect(detail.sets).toEqual([
      expect.objectContaining({ setId, moduleKey: "rw_m2", route: "higher", snapshotDifficulty: "hard", liveDifficulty: "easy", violates: true, startedAttempts: 1 }),
    ]);
    void i1; void i2; void i3;
  });

  it("보관된 세트는 영향 표시에서 제외", () => {
    const pId = problem({ difficulty: "medium" });
    const setId = mstSet();
    place(setId, pId, "rw_m1", null, "medium");
    psql(`update mock_exam_sets set status = 'archived', archived_at = now() where id = '${setId}';`);
    expect(review([pId], "hard", "상향").needsSetReplacement).toEqual([]);
  });
});

describe("풀 집계·자동 구성 후보·목록 일관", () => {
  it("변경 뒤 조립 후보(공개 버전 난이도)·키워드 자동 구성 후보·풀 수량이 새 난이도를 따른다", () => {
    const a = problem({ difficulty: "hard" });
    const b = problem({ difficulty: "hard" });
    const cell = (d: string) => Number(psql(`select count(*) from problems p join problem_versions v on v.id = p.published_version_id where p.id in ('${a}','${b}') and v.status = 'published' and v.difficulty = '${d}';`));
    const poolTotal = () => psql(`select coalesce(sum(published), 0) from mock_exam_pool_usage() where skill_code = '${SKILL}';`);
    const poolBefore = poolTotal();
    expect([cell("hard"), cell("medium")]).toEqual([2, 0]);
    review([a], "medium", "강등");
    expect([cell("hard"), cell("medium")]).toEqual([1, 1]);
    // 문항 수 풀(skill 별 총량)은 난이도 변경에 영향받지 않는다.
    expect(poolTotal()).toBe(poolBefore);
    // 키워드 자동 구성 뷰(problems.difficulty 기반)도 같은 값
    expect(psql(`select difficulty::text from problems where id = '${a}';`)).toBe("medium");
  });

  it("목록: 요약·상태 필터·페이지네이션, 비AI 확정 hard 는 점검 대상이 아님, 변경됨은 hard 에서 바뀐 것만", () => {
    tag = "L";
    const prov1 = problem({ difficulty: "hard" });
    const prov2 = problem({ difficulty: "hard" });
    const confirmed = problem({ difficulty: "hard" });
    const changed = problem({ difficulty: "hard" });
    const legacy = problem({ difficulty: "hard", via: "manual" });
    review([confirmed], "hard");
    review([changed], "easy", "강등");
    const all = list("all");
    const ids = all.rows.map((r) => r.problemId);
    expect(ids).toEqual(expect.arrayContaining([prov1, prov2, confirmed, changed]));
    expect(ids).not.toContain(legacy);
    expect(all.total).toBe(4);
    const by = (s: string) => list(s).rows.map((r) => r.problemId).sort();
    expect(by("provisional")).toEqual([prov1, prov2].sort());
    expect(by("confirmed")).toEqual([confirmed]);
    expect(by("changed")).toEqual([changed]);
    // 요약은 전체 범위(필터 무관) — 이번 실행 문항이 최소 이만큼 포함
    expect(all.summary.provisional).toBeGreaterThanOrEqual(2);
    expect(all.summary.confirmed).toBeGreaterThanOrEqual(1);
    expect(all.summary.changed).toBeGreaterThanOrEqual(1);
    // 페이지네이션: 잠정 우선 정렬, limit 2 offset 2
    const page2 = JSON.parse(psql(`select problem_difficulty_review_list('all', null, null, '${RUN}L', 2, 2)::text;`));
    expect(page2.rows).toHaveLength(2);
    expect(page2.total).toBe(4);
    // 영역·기술 필터
    expect(list("all", `'nonexistent', null`).total).toBe(0);
    expect(list("all", `'${DOMAIN}', '${SKILL}'`).total).toBe(4);
    tag = "";
  });

  it("상세: hardJudge·advisory·레시피 기록을 그대로 싣고, 기록이 없으면 null(=근거 기록 없음)", () => {
    const withJudge = problem({
      difficulty: "hard",
      quality: { hardJudge: { model: "claude-fable-5-1", fit: true, which: ["multi_step_logical_inference"], note: "추가 사고 메모" }, advisory: { model: "claude-opus-5-5", fit: true, passed: true }, mockExamGeneration: { recipeId: "r1", recipeCheck: { compliance: { met: 3, minMet: 2, of: 4, ok: true } }, difficultyStatus: "provisional_ai" } },
    });
    const without = problem({ difficulty: "hard" });
    const d1 = JSON.parse(psql(`select problem_difficulty_review_detail('${withJudge}')::text;`));
    expect(d1.judge.hardJudge.model).toBe("claude-fable-5-1");
    expect(d1.judge.hardJudge.note).toBe("추가 사고 메모");
    expect(d1.judge.advisory.model).toBe("claude-opus-5-5");
    expect(d1.judge.recipeCheck.compliance.ok).toBe(true);
    expect(d1.judge.generationStatus).toBe("provisional_ai");
    expect(d1.stats).toMatchObject({ responses: 0 });
    const d2 = JSON.parse(psql(`select problem_difficulty_review_detail('${without}')::text;`));
    expect(d2.judge.hardJudge).toBeNull();
    expect(d2.judge.advisory).toBeNull();
    expect(d2.history).toEqual([]);
  });

  it("본문 개정 공개: 새 버전 난이도가 다르면 문항 난이도를 맞추고 잠정으로 되돌리며 이력을 남긴다(거절 없음, 스냅샷 불변)", () => {
    const id = problem({ difficulty: "hard" });
    review([id], "hard"); // 확인됨
    const setId = mstSet();
    place(setId, id, "rw_m2", "higher", "hard");
    const snap = () => psql(`select problem_version_id || difficulty from mock_exam_set_items where exam_set_id = '${setId}';`);
    const before = snap();
    psql(`insert into problem_versions (problem_id, version_no, passage, options, correct_index, explanation, difficulty, status, created_by)
          values ('${id}', 2, 'v2 ${RUN}', '["가","나","다","라"]'::jsonb, 0, '해설', 'medium', 'draft', '${ADMIN_ID}');`);
    psql(`update problem_versions set status = 'archived' where problem_id = '${id}' and version_no = 1;
          update problem_versions set status = 'published', published_at = now(), published_by = '${ADMIN_ID}' where problem_id = '${id}' and version_no = 2;`);
    expect(state(id)).toBe("medium|provisional|false");
    expect(psql(`select from_difficulty || '>' || to_difficulty || '|' || to_status || '|' || changed_by || '|' || reason from problem_difficulty_changes where problem_id = '${id}' order by changed_at desc limit 1;`)).toBe(
      `hard>medium|provisional|${ADMIN_ID}|본문 개정 공개에 의한 변경`,
    );
    expect(snap()).toBe(before);
    // 같은 난이도 개정 공개는 이력·상태를 바꾸지 않는다.
    const n = historyCount(id);
    psql(`insert into problem_versions (problem_id, version_no, passage, difficulty, status) values ('${id}', 3, 'v3', 'medium', 'draft');
          update problem_versions set status = 'archived' where problem_id = '${id}' and version_no = 2;
          update problem_versions set status = 'published', published_at = now(), published_by = '${ADMIN_ID}' where problem_id = '${id}' and version_no = 3;`);
    expect(historyCount(id)).toBe(n);
    psql(`update problems set published_version_id = (select id from problem_versions where problem_id = '${id}' and version_no = 3) where id = '${id}';`);
    // 점검 RPC 가 공개 버전 난이도를 바꾸는 것은 이 트리거를 타지 않는다(이력 1건만).
    const m = historyCount(id);
    review([id], "easy", "재조정");
    expect(historyCount(id)).toBe(m + 1);
  });

  describe("실제 공개 경로(confirm_and_publish_problem_version → publish_problem_version)", () => {
    const real = (difficulty: string) => {
      seq += 1;
      const id = psql(`select create_bank_problem('${SUBJECT_ID}', 'mc', '', '', '${difficulty}', '${ADMIN_ID}', null, null, null, 'mock_exam');`);
      problems.push(id);
      return id;
    };
    const draftAndPublish = (id: string, difficulty: string, tagText: string) => {
      const v = psql(`select save_problem_draft_version('${id}', '${RUN} ${alpha(seq)}${tagText} real path', '["ㄱ","ㄴ","ㄷ","ㄹ"]'::jsonb, 2, '해설', '${difficulty}', '${ADMIN_ID}');`);
      psql(`select confirm_and_publish_problem_version('${v}', '${ADMIN_ID}');`);
      return v;
    };

    it("난이도가 다른 개정본 공개: 문항 난이도 동기화·잠정 복귀·이력 1건, 같은 난이도는 0건", () => {
      const id = real("hard");
      draftAndPublish(id, "hard", "a");
      psql(`update problems set created_via = 'ai_generated' where id = '${id}';`);
      expect(state(id)).toBe("hard|provisional|false");
      review([id], "hard"); // 확인됨 + 이력 1건
      expect(historyCount(id)).toBe(1);
      const setId = mstSet();
      place(setId, id, "rw_m2", "higher", "hard");
      const snap = () => psql(`select problem_version_id || difficulty from mock_exam_set_items where exam_set_id = '${setId}';`);
      const before = snap();

      draftAndPublish(id, "medium", "b");
      expect(state(id)).toBe("medium|provisional|false");
      expect(vdiff(id)).toBe("medium");
      expect(historyCount(id)).toBe(2);
      expect(psql(`select from_difficulty || '>' || to_difficulty || '|' || to_status || '|' || changed_by || '|' || reason from problem_difficulty_changes where problem_id = '${id}' order by changed_at desc limit 1;`)).toBe(
        `hard>medium|provisional|${ADMIN_ID}|본문 개정 공개에 의한 변경`,
      );
      expect(snap()).toBe(before);

      draftAndPublish(id, "medium", "c"); // 같은 난이도 → 이력 0건 추가, 상태 유지
      expect(historyCount(id)).toBe(2);
      expect(state(id)).toBe("medium|provisional|false");
    });

    it("문항 난이도가 비어 있던 문항의 첫 공개는 조용히 채워지고 이력·상태는 그대로", () => {
      const id = real("");
      expect(psql(`select coalesce(difficulty::text, 'null') from problems where id = '${id}';`)).toBe("null");
      draftAndPublish(id, "easy", "d");
      expect(state(id)).toBe("easy|confirmed|false");
      expect(historyCount(id)).toBe(0);
    });

    it("난이도 점검 RPC 는 공개 버전 난이도를 바꿔도 동기화 트리거를 타지 않는다(이력 1건)", () => {
      const id = real("hard");
      draftAndPublish(id, "hard", "e");
      review([id], "easy", "강등");
      expect(historyCount(id)).toBe(1);
      expect(state(id)).toBe("easy|confirmed|true");
    });
  });
});
