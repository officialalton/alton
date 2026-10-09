import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// 2026-09-29 #11 — profiles SELECT RLS 를 "보이는 id 집합을 한 번 계산"하는 set-based 정책으로 바꿨다
// (20261906000000). 보이는 행이 그대로임을 두 방식으로 증명한다.
//  (1) 관계 그래프(가족·교사·컨설턴트)를 실행 ID 로 만들고 역할별 기대 집합과 정확히 일치.
//  (2) 이전 정책 술어(아래 OLD_PREDICATE)를 소유자 권한으로 그대로 돌려 새 정책 결과와 전체 테이블 기준 동일.
// 그리고 학생 JWT 의 count(*) 가 수 초 안에 끝나는지 확인한다(이전 ~40초+).

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const RUN = `perf${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

const OLD_PREDICATE = `
  (profiles.id = auth.uid() OR is_admin()
   OR EXISTS (SELECT 1 FROM enrollments e WHERE ((e.student_id = profiles.id AND e.teacher_id = auth.uid()) OR (e.teacher_id = profiles.id AND e.student_id = auth.uid())))
   OR EXISTS (SELECT 1 FROM guardian_students gs WHERE ((gs.student_id = profiles.id AND gs.parent_id = auth.uid()) OR (gs.parent_id = profiles.id AND gs.student_id = auth.uid())))
   OR shares_household_as_guardian_or_child(profiles.id)
   OR EXISTS (SELECT 1 FROM teacher_assignments ta JOIN subject_enrollments se ON se.id = ta.subject_enrollment_id
              WHERE ((ta.teacher_id = profiles.id AND se.child_id = auth.uid()) OR (ta.teacher_id = auth.uid() AND se.child_id = profiles.id)))
   OR EXISTS (SELECT 1 FROM teacher_assignments ta JOIN subject_enrollments se ON se.id = ta.subject_enrollment_id
              WHERE (ta.teacher_id = profiles.id AND is_guardian_of(se.child_id)))
   OR EXISTS (SELECT 1 FROM consultant_assignments ca WHERE ((ca.student_id = profiles.id AND ca.consultant_id = auth.uid()) OR (ca.consultant_id = profiles.id AND ca.student_id = auth.uid()))))
  OR EXISTS (SELECT 1 FROM consultant_assignments ca
             JOIN household_members child_hm ON child_hm.profile_id = ca.student_id AND child_hm.role = 'child'
             JOIN household_members guardian_hm ON guardian_hm.household_id = child_hm.household_id AND guardian_hm.role = 'guardian'
             WHERE ca.consultant_id = profiles.id AND guardian_hm.profile_id = auth.uid())`;

const ids = {
  gA: randomUUID(), gA2: randomUUID(), cA: randomUUID(), tchA: randomUUID(), conA: randomUUID(),
  gB: randomUUID(), cB: randomUUID(), tchB: randomUUID(),
  sX: randomUUID(), pX: randomUUID(), tX: randomUUID(), cX: randomUUID(),
};
const fixtureIds = Object.values(ids);
const hh = { A: randomUUID(), B: randomUUID() };
const seA = randomUUID();
const inList = (l: string[]) => l.map((i) => `'${i}'`).join(",");

function asUser(uid: string, sql: string): string {
  return psql(`begin; set local role authenticated; do $$ begin perform set_config('request.jwt.claim.sub','${uid}',true); end $$; ${sql}; rollback;`);
}
function visibleNew(uid: string, onlyFixtures: boolean): string[] {
  const filter = onlyFixtures ? `where id in (${inList(fixtureIds)})` : "";
  const out = psql(`begin; set local role authenticated;
    do $$ begin perform set_config('request.jwt.claim.sub','${uid}',true); end $$;
    select id from public.profiles ${filter}; rollback;`);
  return out.split("\n").filter((l) => /^[0-9a-f-]{36}$/.test(l)).sort();
}
function visibleOld(uid: string, onlyFixtures: boolean): string[] {
  const filter = onlyFixtures ? `and profiles.id in (${inList(fixtureIds)})` : "";
  const out = psql(`begin; do $$ begin perform set_config('request.jwt.claim.sub','${uid}',true); end $$;
    select id from public.profiles where (${OLD_PREDICATE}) ${filter}; rollback;`);
  return out.split("\n").filter((l) => /^[0-9a-f-]{36}$/.test(l)).sort();
}
const sorted = (...v: string[]) => [...v].sort();

function cleanup() {
  psql(`set session_replication_role = replica;
    delete from consultant_assignments where student_id in (${inList(fixtureIds)});
    delete from teacher_assignments where subject_enrollment_id = '${seA}';
    delete from subject_enrollments where id = '${seA}';
    delete from enrollments where student_id in (${inList(fixtureIds)});
    delete from guardian_students where student_id in (${inList(fixtureIds)});
    delete from household_members where household_id in ('${hh.A}','${hh.B}');
    delete from households where id in ('${hh.A}','${hh.B}');
    delete from profiles where id in (${inList(fixtureIds)});
    delete from auth.users where id in (${inList(fixtureIds)});
    set session_replication_role = origin;`);
}

beforeAll(() => {
  const users = fixtureIds
    .map((i) => `('00000000-0000-0000-0000-000000000000','${i}','authenticated','authenticated','${RUN}-${i}@example.com','x',now(),'{}','{}',now(),now())`)
    .join(",");
  const role = (id: string, r: string) => `('${id}','${r}','${RUN}-${r}')`;
  psql(`set session_replication_role = replica;
    insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ${users};
    insert into profiles (id,role,name) values
      ${[role(ids.gA, "parent"), role(ids.gA2, "parent"), role(ids.cA, "student"), role(ids.tchA, "teacher"), role(ids.conA, "consultant"),
         role(ids.gB, "parent"), role(ids.cB, "student"), role(ids.tchB, "teacher"),
         role(ids.sX, "student"), role(ids.pX, "parent"), role(ids.tX, "teacher"), role(ids.cX, "consultant")].join(",")};
    insert into households (id, primary_guardian_id) values ('${hh.A}','${ids.gA}'),('${hh.B}','${ids.gB}');
    insert into household_members (household_id,profile_id,role,is_primary) values
      ('${hh.A}','${ids.gA}','guardian',true),('${hh.A}','${ids.gA2}','guardian',false),('${hh.A}','${ids.cA}','child',false),
      ('${hh.B}','${ids.gB}','guardian',true),('${hh.B}','${ids.cB}','child',false);
    insert into subject_enrollments (id,child_id,subject_id,contract_id) values ('${seA}','${ids.cA}','${randomUUID()}','${randomUUID()}');
    insert into teacher_assignments (subject_enrollment_id,teacher_id,effective_from) values ('${seA}','${ids.tchA}',now());
    insert into consultant_assignments (consultant_id,student_id) values ('${ids.conA}','${ids.cA}');
    insert into enrollments (student_id,teacher_id,subject_id) values ('${ids.cB}','${ids.tchB}','${randomUUID()}');
    insert into guardian_students (parent_id,student_id,relation_type) values ('${ids.gB}','${ids.cB}','모');
    set session_replication_role = origin;`);
}, 60_000);

afterAll(() => cleanup(), 60_000);

describe("profiles SELECT RLS (set-based)", () => {
  const fixtureOnly = (uid: string) => visibleNew(uid, true);

  it("역할별로 정확히 기대한 프로필만 보인다", () => {
    const { gA, gA2, cA, tchA, conA, gB, cB, tchB, sX, pX, tX, cX } = ids;
    expect(fixtureOnly(cA)).toEqual(sorted(cA, gA, gA2, tchA, conA)); // 자녀: 본인·가구 보호자·담당교사·담당 컨설턴트
    expect(fixtureOnly(gA)).toEqual(sorted(gA, cA, tchA, conA)); // 보호자: 자녀·자녀 교사·자녀 컨설턴트(공동 보호자는 아님)
    expect(fixtureOnly(tchA)).toEqual(sorted(tchA, cA));
    expect(fixtureOnly(conA)).toEqual(sorted(conA, cA));
    expect(fixtureOnly(cB)).toEqual(sorted(cB, gB, tchB)); // 레거시 enrollments·guardian_students 경로
    expect(fixtureOnly(gB)).toEqual(sorted(gB, cB));
    expect(fixtureOnly(tchB)).toEqual(sorted(tchB, cB));
    for (const solo of [sX, pX, tX, cX]) expect(fixtureOnly(solo)).toEqual([solo]);
    expect(fixtureOnly(ADMIN_ID)).toEqual(sorted(...fixtureIds));
  });

  it("이전 정책 술어와 전체 테이블 기준으로 보이는 id 집합이 동일하다", () => {
    const users = [ids.cA, ids.gA, ids.gA2, ids.tchA, ids.conA, ids.cB, ids.gB, ids.tchB, ids.sX, ADMIN_ID];
    for (const uid of users) expect(visibleNew(uid, false)).toEqual(visibleOld(uid, false));
  }, 120_000);

  it("실제 데이터의 역할별 계정 1명씩도 이전 정책과 동일하다", () => {
    const pick = (r: string, extra: string) =>
      psql(`select id from profiles p where role='${r}' ${extra} and id <> all(array[${inList(fixtureIds)}]::uuid[]) order by id limit 1`);
    const real = [
      pick("student", "and exists(select 1 from household_members h where h.profile_id=p.id)"),
      pick("parent", "and exists(select 1 from household_members h where h.profile_id=p.id)"),
      pick("teacher", "and exists(select 1 from teacher_assignments t where t.teacher_id=p.id)"),
      pick("consultant", ""),
    ].filter(Boolean);
    for (const uid of real) expect(visibleNew(uid, false)).toEqual(visibleOld(uid, false));
  }, 120_000);

  it("학생 JWT 의 select count(*) from profiles 가 수 초 안에 끝난다", () => {
    const t0 = Date.now();
    const n = asUser(ids.cA, "select count(*) from public.profiles");
    const ms = Date.now() - t0;
    expect(Number(n.split("\n").pop())).toBeGreaterThanOrEqual(5);
    expect(ms).toBeLessThan(3000);
  });
});
