import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN_ID, TEACHER_ID, asUser, fails, psql } from "../../test/mock-exam-routing-fixture";

// 2026-10-06 Free Accounts S6 — student_learning_events / log_learning_event(20262100000042~44). RUN 전용 학생만 만들고 종료 시 정리.
const RUN = `le-${randomUUID().slice(0, 8)}`;
let S = "", T = "";
const jsonAs = (uid: string, sql: string) => JSON.parse(asUser(uid, `select (${sql})::text;`).split("\n").filter((l) => l.startsWith("{"))[0]);
const count = (kind?: string) => Number(psql(`select count(*) from student_learning_events where student_id = '${S}' ${kind ? `and kind = '${kind}'` : ""}`));

function student(label: string): string {
  const id = psql(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${RUN}-${label}@example.com', 'x', now(), '{}', '{}', now(), now()) returning id;`).split("\n")[0];
  psql(`insert into profiles (id, role, name) values ('${id}', 'student', 'LE ${label} ${RUN}');`);
  psql(`insert into students (id, status, member_type) values ('${id}', 'active', 'free');`);
  return id;
}
beforeAll(() => { S = student("s"); T = student("t"); });
afterAll(() => {
  psql(`set session_replication_role = replica;
    delete from student_learning_events where student_id = any(array['${S}','${T}']::uuid[]);
    delete from students where id = any(array['${S}','${T}']::uuid[]);
    delete from profiles where id = any(array['${S}','${T}']::uuid[]);
    delete from auth.users where email like '${RUN}-%';
    set session_replication_role = origin;`);
});

describe("log_learning_event", () => {
  it("기록·10분 디듀프·종류/ref 별 분리", () => {
    expect(asUser(S, `select log_learning_event('mistake_review_opened');`)).toBe("t");
    expect(asUser(S, `select log_learning_event('mistake_review_opened');`)).toBe("f");
    expect(asUser(S, `select log_learning_event('vocab_study_opened');`)).toBe("t");
    const ref = randomUUID(), ref2 = randomUUID();
    expect(asUser(S, `select log_learning_event('material_opened', '${ref}');`)).toBe("t");
    expect(asUser(S, `select log_learning_event('material_opened', '${ref2}');`)).toBe("t");
    expect(asUser(S, `select log_learning_event('material_opened', '${ref}');`)).toBe("f");
    expect(count()).toBe(4);
    psql(`update student_learning_events set created_at = now() - interval '11 minutes' where student_id = '${S}' and kind = 'mistake_review_opened'`);
    expect(asUser(S, `select log_learning_event('mistake_review_opened');`)).toBe("t");
    expect(count("mistake_review_opened")).toBe(2);
  });
  it("잘못된 종류 거절, 학생 아닌 호출자·익명은 기록 없음/거절, 직접 테이블 접근 불가", () => {
    expect(fails(() => asUser(S, `select log_learning_event('nope');`))).toContain("invalid_kind");
    expect(asUser(TEACHER_ID, `select log_learning_event('vocab_study_opened');`)).toBe("f");
    expect(Number(psql(`select count(*) from student_learning_events where student_id = '${TEACHER_ID}'`))).toBe(0);
    expect(fails(() => psql(`begin; set local role anon; select log_learning_event('vocab_study_opened'); commit;`))).toContain("permission denied");
    expect(asUser(S, `select count(*) from student_learning_events;`)).toBe("0"); // RLS: 정책 없음 → 본인 행도 직접 조회 불가
  });
  it("동시 호출도 1행", async () => {
    const id = student("c");
    await Promise.all([1, 2, 3, 4].map(() => Promise.resolve().then(() => asUser(id, `select log_learning_event('vocab_study_opened');`))));
    expect(Number(psql(`select count(*) from student_learning_events where student_id = '${id}'`))).toBe(1);
    psql(`set session_replication_role = replica; delete from student_learning_events where student_id = '${id}'; delete from students where id='${id}'; delete from profiles where id='${id}'; delete from auth.users where id='${id}'; set session_replication_role = origin;`);
  });
});

describe("관리자 지표 연결", () => {
  it("학습 사용 RPC: 열람 수·마지막 시각·추적 시작일, 새 학생은 0", () => {
    const u = jsonAs(ADMIN_ID, `admin_free_account_learning_usage('${S}')`);
    expect(u.mistakeNotebook.reviewed.opens).toBe(2);
    expect(u.vocabulary.flashcardStudy.opens).toBe(1);
    expect(u.materials.views.opens).toBe(2);
    expect(u.materials.timeSpent).toBe("not_tracked");
    expect(u.tracking.learningEventsSince).not.toBeNull();
    expect(jsonAs(ADMIN_ID, `admin_free_account_learning_usage('${T}')`).materials.views.opens).toBe(0);
  });
  it("Analytics: 코호트 한정 열람 수·학생 수·trackingSince, 권한 거절", () => {
    const a = jsonAs(ADMIN_ID, `admin_free_accounts_analytics(current_date - 1, current_date + 1, true, array['${S}','${T}']::uuid[])`);
    expect(a.learning).toMatchObject({ mistakeReviewOpens: 2, mistakeReviewStudents: 1, vocabStudyOpens: 1, materialOpens: 2, materialStudents: 1 });
    expect(a.learning.trackingSince).not.toBeNull();
    expect(fails(() => asUser(S, `select admin_free_account_learning_usage('${S}');`))).toContain("not_allowed");
  });
});
