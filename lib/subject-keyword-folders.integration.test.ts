import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

// subject_keyword_folders — 폴더 삭제 시 키워드 보존, 같은 과목 제약, 도메인 자동 배정, RLS(관리자만 쓰기). 전부 rollback.
const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

function psql(sql: string): { ok: boolean; out: string } {
  try {
    const out = execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-F", "|", "-c", sql], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: String((e as { stderr?: string }).stderr ?? e) };
  }
}

const run = `kwf${randomUUID().slice(0, 8)}`;
const adminId = randomUUID();
const studentId = randomUUID();
const subA = randomUUID();
const subB = randomUUID();
const ZERO = "00000000-0000-0000-0000-000000000000";
const setup = `
  insert into auth.users (id, instance_id, aud, role, email) values
    ('${adminId}','${ZERO}','authenticated','authenticated','a-${run}@t.test'),
    ('${studentId}','${ZERO}','authenticated','authenticated','s-${run}@t.test');
  insert into profiles (id, role, name) values ('${adminId}','admin','${run}'), ('${studentId}','student','${run}');
  insert into subjects (id, name) values ('${subA}','${run} A'), ('${subB}','${run} B');`;
const tx = (body: string) => psql(`begin; ${setup} ${body}; rollback;`);
const asRole = (uid: string, body: string) =>
  tx(`set local role authenticated; select set_config('request.jwt.claim.sub','${uid}',true); ${body}`);

describe("subject_keyword_folders", () => {
  it("폴더를 지워도 키워드는 남고 folder_id만 null(기타)이 된다", () => {
    const r = tx(`
      insert into subject_keyword_folders (id, subject_id, name) values ('${subA.replace(/.$/, "1")}','${subA}','F1');
      insert into subject_keywords (id, subject_id, label, folder_id) values ('${subA.replace(/.$/, "2")}','${subA}','K1','${subA.replace(/.$/, "1")}');
      delete from subject_keyword_folders where id='${subA.replace(/.$/, "1")}';
      select count(*), count(folder_id) from subject_keywords where subject_id='${subA}'`);
    expect(r.out).toBe("1|0");
  });
  it("다른 과목의 폴더로는 배정할 수 없다", () => {
    const r = tx(`
      insert into subject_keyword_folders (id, subject_id, name) values ('${subB.replace(/.$/, "1")}','${subB}','F');
      insert into subject_keywords (subject_id, label, folder_id) values ('${subA}','K','${subB.replace(/.$/, "1")}')`);
    expect(r.ok).toBe(false);
    expect(r.out).toContain("keyword_folder_subject_mismatch");
  });
  it("같은 과목에서 폴더 이름은 대소문자·공백 무시하고 유일", () => {
    const r = tx(`insert into subject_keyword_folders (subject_id, name) values ('${subA}','Info'), ('${subA}',' info ')`);
    expect(r.ok).toBe(false);
    expect(r.out).toContain("duplicate key");
  });
  it("도메인 키워드는 폴더 없이 넣어도 기본 도메인 폴더에 자동 배정, 같은 폴더 재사용", () => {
    const r = tx(`
      insert into subject_keywords (subject_id, label, domain_code, skill_code) values
        ('${subA}','Words','rw_craft_structure','${run}_s1'), ('${subA}','Text','rw_craft_structure','${run}_s2');
      select count(distinct folder_id), (select count(*) from subject_keyword_folders where subject_id='${subA}'),
             (select name from subject_keyword_folders where subject_id='${subA}') from subject_keywords where subject_id='${subA}'`);
    expect(r.out).toBe("1|1|Craft and Structure");
  });
  it("관리자만 쓸 수 있고 인증 사용자는 읽을 수 있다", () => {
    const seed = `insert into subject_keyword_folders (id, subject_id, name) values ('${subA.replace(/.$/, "1")}','${subA}','F');`;
    const w = tx(`${seed} set local role authenticated; select set_config('request.jwt.claim.sub','${studentId}',true);
      with u as (update subject_keyword_folders set name='X' where id='${subA.replace(/.$/, "1")}' returning 1) select count(*) from u`);
    expect(w.out.split("\n").pop()).toBe("0");
    const ins = asRole(studentId, `insert into subject_keyword_folders (subject_id, name) values ('${subA}','Z')`);
    expect(ins.ok).toBe(false);
    const read = tx(`${seed} set local role authenticated; select set_config('request.jwt.claim.sub','${studentId}',true); select count(*) from subject_keyword_folders where subject_id='${subA}'`);
    expect(read.out.split("\n").pop()).toBe("1");
    const adminIns = asRole(adminId, `insert into subject_keyword_folders (subject_id, name) values ('${subA}','Z'); select count(*) from subject_keyword_folders where subject_id='${subA}'`);
    expect(adminIns.ok).toBe(true);
  });
});
