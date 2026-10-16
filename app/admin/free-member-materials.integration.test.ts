import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// psql 동기 호출이 많다(약 60회). 공유 DB 부하 때 30초 기본 제한에 걸리지 않도록 넉넉히.
vi.setConfig({ testTimeout: 180_000 });

// 2026-10-05 무료 학습 회원 S3 — 20262100000003(교재 access_tier·권리 상태·RLS·감사) DB 검증.
// 브리프 9.1 항목 4: 무료 자료 열림 / 비공개 차단(docs·sections·versions 3계층) / free+미확인 거절 /
// 무료→비공개 전환 즉시 차단 / 과외 학생은 기존 열람 그대로 + 무료 합집합.
// psql + set role 패턴(free-member-access.integration.test.ts). 실행 ID(RUN) 접두 행만 만들고 끝에 지운다.

const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const RUN = `fmm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
function asUser(userId: string, sql: string): string {
  const out = psql(`set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false); ${sql} reset role;`);
  const lines = out.split("\n");
  return lines[lines.length - 1];
}
function fails(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    return String((e as { stderr?: string }).stderr ?? e);
  }
  return "";
}
function createStudent(label: string, memberType: "free" | "tutoring", status = "active"): string {
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${RUN}-${label}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`,
  );
  psql(`insert into profiles (id, role, name, date_of_birth) values ('${id}', 'student', '${RUN}-${label}', '2010-01-01');`);
  psql(`insert into students (id, status, member_type, signup_source, grade, profile_completed_at) values ('${id}', '${status}', '${memberType}', '${memberType === "free" ? "self_signup" : "admin_direct"}', '10학년', now());`);
  return id;
}
function createDoc(label: string, opts: { status?: string; tier?: "free" | "tutoring"; rights?: string; owner?: string } = {}): string {
  const id = psql(
    `insert into curriculum_docs (title, subject_id, owner_type, owner_teacher_id, status, kind, access_tier, rights_status)
     values ('${RUN}-${label}', '${subjectId}', ${opts.owner ? `'teacher', '${opts.owner}'` : "'admin', null"}, '${opts.status ?? "published"}', 'pdf', '${opts.tier ?? "tutoring"}', '${opts.rights ?? (opts.tier === "free" ? "confirmed" : "needs_review")}')
     returning id;`,
  );
  psql(`insert into curriculum_doc_sections (curriculum_doc_id, position, title, body, teaching_tip) values ('${id}', 1, '${RUN}-sec', '<p>body</p>', '<p>tip</p>');`);
  psql(`insert into curriculum_doc_versions (curriculum_doc_id, version_number, snapshot, created_by) values ('${id}', 1, '{"kind":"pdf","asset":{"bucket":"curriculum-assets","path":"${RUN}/x.pdf","mimeType":"application/pdf"}}', '${ADMIN_ID}');`);
  return id;
}
// psql -t 출력에서 빈 문자열 행은 빈 줄이 되어 trim()에 잘린다 — 항상 접두어를 붙여 마지막 줄을 고정한다.
const visibleDocs = (uid: string) =>
  asUser(uid, `select '>' || coalesce(string_agg(title, ',' order by title), '') from curriculum_docs where title like '${RUN}-%';`)
    .replace(/^>/, "")
    .split(",")
    .filter(Boolean);
const visibleSections = (uid: string, docId: string) => Number(asUser(uid, `select count(*) from curriculum_doc_sections where curriculum_doc_id = '${docId}';`));
const visibleVersions = (uid: string, docId: string) => Number(asUser(uid, `select count(*) from curriculum_doc_versions where curriculum_doc_id = '${docId}';`));
const auditCount = (docId: string) => Number(psql(`select count(*) from curriculum_doc_access_changes where curriculum_doc_id = '${docId}';`));

let subjectId: string;
let freeStudent: string, tutoringEnrolled: string, tutoringOther: string, suspendedFree: string;
let freeDoc: string, privateDoc: string, draftFreeDoc: string, candidateDoc: string, teacherDoc: string;

beforeAll(() => {
  subjectId = psql(`insert into subjects (name) values ('${RUN}-subject') returning id;`);
  freeStudent = createStudent("free", "free");
  suspendedFree = createStudent("suspended", "free", "suspended");
  tutoringEnrolled = createStudent("enrolled", "tutoring");
  tutoringOther = createStudent("other", "tutoring");
  psql(`insert into enrollments (student_id, teacher_id, subject_id, status) values ('${tutoringEnrolled}', '${TEACHER_ID}', '${subjectId}', 'active');`);
  freeDoc = createDoc("freeDoc", { tier: "free" });
  privateDoc = createDoc("privateDoc");
  draftFreeDoc = createDoc("draftFree", { tier: "free", status: "draft" });
  candidateDoc = createDoc("candidate");
  teacherDoc = createDoc("teacherDoc", { owner: TEACHER_ID });
});

afterAll(() => {
  psql(`begin; set local session_replication_role = replica;
    delete from curriculum_doc_access_changes where curriculum_doc_id in (select id from curriculum_docs where title like '${RUN}-%');
    delete from curriculum_doc_versions where curriculum_doc_id in (select id from curriculum_docs where title like '${RUN}-%');
    delete from curriculum_doc_sections where curriculum_doc_id in (select id from curriculum_docs where title like '${RUN}-%');
    delete from curriculum_docs where title like '${RUN}-%';
    delete from enrollments where student_id in (select id from profiles where name like '${RUN}-%');
    delete from students where id in (select id from profiles where name like '${RUN}-%');
    delete from profiles where name like '${RUN}-%';
    delete from auth.users where email like '${RUN}-%';
    delete from subjects where name like '${RUN}-%';
    commit;`);
});

describe("무료 공개 자료 RLS(20262100000003)", () => {
  it("무료 회원은 published+free 문서만 본다 — 비공개·초안 free는 docs/sections/versions 3계층 모두 0행", () => {
    expect(visibleDocs(freeStudent)).toEqual([`${RUN}-freeDoc`]);
    expect(visibleSections(freeStudent, freeDoc)).toBe(1);
    expect(visibleVersions(freeStudent, freeDoc)).toBe(1);
    for (const blocked of [privateDoc, draftFreeDoc, teacherDoc]) {
      expect(visibleSections(freeStudent, blocked)).toBe(0);
      expect(visibleVersions(freeStudent, blocked)).toBe(0);
    }
    // id 직접 지정(직접 URL/REST 호출에 해당)도 0행.
    expect(asUser(freeStudent, `select count(*) from curriculum_docs where id = '${privateDoc}';`)).toBe("0");
  });

  it("정지된 무료 회원은 free 문서도 못 본다(활성 학생만)", () => {
    expect(visibleDocs(suspendedFree)).toEqual([]);
  });

  it("과외 학생: 수강 과목 문서는 그대로 + free 문서 합집합. 수강 없는 과외 학생은 free만", () => {
    expect(visibleDocs(tutoringEnrolled)).toEqual([`${RUN}-candidate`, `${RUN}-freeDoc`, `${RUN}-privateDoc`, `${RUN}-teacherDoc`]);
    expect(visibleSections(tutoringEnrolled, privateDoc)).toBe(1);
    expect(visibleDocs(tutoringOther)).toEqual([`${RUN}-freeDoc`]);
  });

  it("curriculum-assets 버킷은 비공개이고 학생은 storage.objects를 직접 읽지 못한다", () => {
    expect(psql(`select public from storage.buckets where id = 'curriculum-assets';`)).toBe("f");
    expect(asUser(freeStudent, `select count(*) from storage.objects where bucket_id = 'curriculum-assets';`)).toBe("0");
  });
});

describe("무료 공개 지정 규칙·감사", () => {
  it("권리 미확인 문서는 free 지정이 거절된다(CHECK) — insert·update 모두", () => {
    expect(fails(() => psql(`insert into curriculum_docs (title, subject_id, owner_type, status, access_tier, rights_status) values ('${RUN}-bad', '${subjectId}', 'admin', 'published', 'free', 'needs_review');`)))
      .toContain("curriculum_docs_free_requires_confirmed_rights");
    expect(fails(() => asUser(ADMIN_ID, `update curriculum_docs set access_tier = 'free' where id = '${candidateDoc}';`)))
      .toContain("curriculum_docs_free_requires_confirmed_rights");
    // free 문서의 권리 상태를 되돌리는 것도 거절(먼저 비공개로 바꿔야 한다).
    expect(fails(() => asUser(ADMIN_ID, `update curriculum_docs set rights_status = 'restricted' where id = '${freeDoc}';`)))
      .toContain("curriculum_docs_free_requires_confirmed_rights");
  });

  it("관리자가 아니면 access_tier·rights_status를 바꿀 수 없다(교사 소유자 포함)", () => {
    expect(fails(() => asUser(TEACHER_ID, `update curriculum_docs set rights_status = 'confirmed' where id = '${teacherDoc}';`))).toContain("관리자만");
    expect(fails(() => asUser(TEACHER_ID, `update curriculum_docs set access_tier = 'free' where id = '${teacherDoc}';`))).toContain("관리자만");
    expect(psql(`select rights_status from curriculum_docs where id = '${teacherDoc}';`)).toBe("needs_review");
  });

  it("권리 확인 → 무료 공개 → 비공개: 확인자·시각 기록, 감사 3건, 무료 회원 열람은 즉시 열리고 즉시 닫힌다", () => {
    expect(auditCount(candidateDoc)).toBe(0);
    expect(visibleDocs(freeStudent)).not.toContain(`${RUN}-candidate`);

    asUser(ADMIN_ID, `update curriculum_docs set rights_status = 'confirmed', rights_note = '자체 제작' where id = '${candidateDoc}';`);
    expect(psql(`select rights_confirmed_by || '|' || (rights_confirmed_at is not null)::text from curriculum_docs where id = '${candidateDoc}';`)).toBe(`${ADMIN_ID}|true`);
    expect(auditCount(candidateDoc)).toBe(1);
    // 권리 확인만으로는 아직 비공개.
    expect(visibleDocs(freeStudent)).not.toContain(`${RUN}-candidate`);

    asUser(ADMIN_ID, `update curriculum_docs set access_tier = 'free' where id = '${candidateDoc}';`);
    expect(visibleDocs(freeStudent)).toContain(`${RUN}-candidate`);
    expect(visibleVersions(freeStudent, candidateDoc)).toBe(1);
    expect(auditCount(candidateDoc)).toBe(2);
    expect(psql(`select actor_id || '|' || coalesce(old_access_tier, '-') || '>' || new_access_tier || '|' || rights_note from curriculum_doc_access_changes where curriculum_doc_id = '${candidateDoc}' order by created_at desc limit 1;`))
      .toBe(`${ADMIN_ID}|tutoring>free|자체 제작`);

    asUser(ADMIN_ID, `update curriculum_docs set access_tier = 'tutoring' where id = '${candidateDoc}';`);
    expect(visibleDocs(freeStudent)).not.toContain(`${RUN}-candidate`);
    expect(visibleVersions(freeStudent, candidateDoc)).toBe(0);
    expect(auditCount(candidateDoc)).toBe(3);
    // 수강 중인 과외 학생은 전환과 무관하게 계속 본다.
    expect(visibleDocs(tutoringEnrolled)).toContain(`${RUN}-candidate`);

    // 권리 상태를 내리면 확인자·시각이 비워진다.
    asUser(ADMIN_ID, `update curriculum_docs set rights_status = 'needs_review' where id = '${candidateDoc}';`);
    expect(psql(`select coalesce(rights_confirmed_by::text, 'null') || '|' || coalesce(rights_confirmed_at::text, 'null') from curriculum_docs where id = '${candidateDoc}';`)).toBe("null|null");
  });

  it("감사 테이블은 관리자만 조회하고 직접 쓰기는 거절된다", () => {
    expect(asUser(freeStudent, `select count(*) from curriculum_doc_access_changes;`)).toBe("0");
    expect(Number(asUser(ADMIN_ID, `select count(*) from curriculum_doc_access_changes where curriculum_doc_id = '${candidateDoc}';`))).toBeGreaterThanOrEqual(3);
    expect(fails(() => asUser(ADMIN_ID, `insert into curriculum_doc_access_changes (curriculum_doc_id, new_access_tier, new_rights_status) values ('${candidateDoc}', 'free', 'confirmed');`))).toContain("row-level security");
  });
});
