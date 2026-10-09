import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupPerRunTeacher, createPerRunTeacher } from "@/test/per-run-teacher";
import { ADMIN_ID, SUBJECT_ID, createRoutingSet, psql, rest } from "@/test/mock-exam-routing-fixture";

// 오류 확정 → '오류 아님' 번복: 문항 복귀·대체 문항 필요 기록 닫기. 실행 ID(RUN) 전용 문항·세트만 쓴다.
const RUN = randomUUID().slice(0, 8);
// 실행 ID 전용 skill 코드 — 실제 skill 칸의 여분(다른 세션·시드의 공개 문항)에 결과가 흔들리지 않게 격리한다.
const SK_A = `zzra${RUN}`;
const SK_B = `zzrb${RUN}`;
let TEACHER_ID: string;
type Json = Record<string, unknown>;
const letters = () => Array.from({ length: 14 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join("");
const verdict = (p: string, v: string, decision: string) =>
  rest(ADMIN_ID, "rpc/problem_error_apply_verdict", { method: "POST", body: { p_problem_id: p, p_version_id: v, p_decision: decision, p_note: null } });
const archivedAt = (p: string) => psql(`select (archived_at is not null)::text from problems where id = '${p}';`);
const needs = (p: string) => psql(`select coalesce(string_agg(status || ':' || coalesce(resolution, '-'), ',' order by created_at, id), '') from problem_replacement_needs where problem_id = '${p}';`);

function general(scope = "general"): { p: string; v: string } {
  const p = psql(`insert into problems (format, passage, subject_id, status, created_by, usage_scope) values ('mc', 'R4 revert ${RUN} ${letters()}', '${SUBJECT_ID}', 'confirmed', '${ADMIN_ID}', '${scope}') returning id;`);
  return { p, v: psql(`select id from problem_versions where problem_id = '${p}' limit 1;`) };
}
function spare(skill: string, difficulty: string): string {
  const id = psql(`insert into problems (format, passage, subject_id, status, created_by, skill_code) values ('mc', 'R4 spare ${RUN} ${letters()}', '${SUBJECT_ID}', 'confirmed', '${ADMIN_ID}', '${skill}') returning id;`);
  psql(`update problem_versions set options = '["a","b","c","d"]'::jsonb, correct_index = 0, explanation = '해설', difficulty = '${difficulty}', status = 'published', published_at = now() where problem_id = '${id}' and version_no = 1;`);
  const vid = psql(`select id from problem_versions where problem_id = '${id}' and version_no = 1;`);
  psql(`update problems set published_version_id = '${vid}' where id = '${id}';`);
  return id;
}

beforeAll(() => {
  TEACHER_ID = createPerRunTeacher(psql, { emailPrefix: "problem-error-revert" });
  [SK_A, SK_B].forEach((code, i) => {
    psql(`insert into problem_skill_codes (code, domain, label, sort) values ('${code}', 'rw_craft_structure', 'REV spare ${RUN} ${i}', 9980 + ${i}) on conflict (code) do nothing;`);
  });
});
afterAll(() => {
  psql(`update problems set archived_at = coalesce(archived_at, now()), archived_reason = coalesce(archived_reason, 'revert test cleanup') where skill_code in ('${SK_A}','${SK_B}') and passage like 'R4 spare %';`);
  cleanupPerRunTeacher(psql, TEACHER_ID);
});

describe("오류 확정 → 오류 아님 번복", () => {
  it("보관 해제(용도·상태 유지)·열린 대체 필요 취소·재확정 시 다시 쌓임·멱등", async () => {
    const { p, v } = general("both");
    expect((await verdict(p, v, "key_wrong_confirmed")).status).toBe(200);
    expect(archivedAt(p)).toBe("true");
    expect(needs(p)).toBe("open:-");

    const r = await verdict(p, v, "not_error");
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ alreadyApplied: false, restored: true, replacementNeedsCancelled: 1, replacementNeedsOpen: 0, archived: false, replacedSetsKept: 0 });
    expect(psql(`select (archived_at is null)::text || ',' || (archived_reason is null)::text || ',' || usage_scope || ',' || status || ',' || error_review_needed::text from problems where id = '${p}';`)).toBe("true,true,both,confirmed,false");
    expect(needs(p)).toBe("cancelled:verdict_reverted");
    const sum = await rest(ADMIN_ID, "rpc/problem_replacement_need_summary", { method: "POST", body: {} });
    expect((sum.json as { items: { problemId: string }[] }).items.some((i) => i.problemId === p)).toBe(false);

    // 멱등: 같은 판정 재적용은 새 행 없이 끝나고, 이미 활성인 문항은 그대로
    const again = await verdict(p, v, "not_error");
    expect(again.json).toMatchObject({ alreadyApplied: true });
    expect(archivedAt(p)).toBe("false");
    expect(psql(`select count(*) from problem_error_verdicts where problem_id = '${p}';`)).toBe("2");

    // 재확정: 보관·대체 필요 기록이 다시 생긴다(취소 행은 이력으로 남음)
    expect((await verdict(p, v, "flawed_confirmed")).status).toBe(200);
    expect(archivedAt(p)).toBe("true");
    expect(needs(p)).toBe("cancelled:verdict_reverted,open:-");
    // 다시 번복해도 안전
    expect((await verdict(p, v, "not_error")).json).toMatchObject({ restored: true, replacementNeedsCancelled: 1 });
    expect(needs(p)).toBe("cancelled:verdict_reverted,cancelled:verdict_reverted");
  });

  it("관리자가 따로 보관한 문항은 오류 아님 판정이 건드리지 않는다", async () => {
    const { p, v } = general();
    psql(`update problems set archived_at = now(), archived_reason = '관리자 수동 보관 ${RUN}' where id = '${p}';`);
    const r = await verdict(p, v, "not_error");
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ restored: false });
    expect(archivedAt(p)).toBe("true");
    expect(psql(`select archived_reason from problems where id = '${p}';`)).toBe(`관리자 수동 보관 ${RUN}`);

    // 수동 보관 뒤 오류 확정(사유는 수동 그대로 유지) → 번복해도 수동 보관은 유지, 대체 필요 기록만 닫힘
    const g = general();
    psql(`update problems set archived_at = now(), archived_reason = '수동 ${RUN}' where id = '${g.p}';`);
    expect((await verdict(g.p, g.v, "flawed_confirmed")).status).toBe(200);
    const back = await verdict(g.p, g.v, "not_error");
    expect(back.json).toMatchObject({ restored: false, replacementNeedsCancelled: 1 });
    expect(archivedAt(g.p)).toBe("true");
    expect(needs(g.p)).toBe("cancelled:verdict_reverted");
  });

  it("이미 자동 교체된 세트는 그대로: 기록은 linked 유지·교체 이력 유지·세트 불변, 문항만 복귀", async () => {
    const f = createRoutingSet({ run: RUN, label: "revert-replaced" });
    const item = f.ids.rw_higher[0];
    psql(`update mock_exam_set_items set skill_code = '${SK_A}' where id = '${item}';`);
    psql(`update problems set archived_at = now(), archived_reason = 'revert test cleanup' where skill_code = '${SK_A}' and passage like 'R4 spare %' and archived_at is null;`);
    const s = spare(SK_A, "medium");
    const [p, v] = psql(`select problem_id || '|' || problem_version_id from mock_exam_set_items where id = '${item}';`).split("|");
    expect(((await verdict(p, v, "flawed_confirmed")).json as Json).autoReplaced).toBe(1);
    const shape = () => psql(`select string_agg(problem_id::text, ',' order by section, position) from mock_exam_set_items where exam_set_id = '${f.setId}';`);
    const before = shape();
    const r = await verdict(p, v, "not_error");
    expect(r.json).toMatchObject({ restored: true, replacementNeedsCancelled: 0, replacedSetsKept: 1 });
    expect(archivedAt(p)).toBe("false");
    expect(needs(p)).toBe("linked:auto_replaced");
    expect(shape()).toBe(before);
    expect(psql(`select count(*) from mock_exam_set_items where exam_set_id = '${f.setId}' and problem_id = '${s}';`)).toBe("1");
    expect(psql(`select count(*) from mock_exam_item_replacements where old_problem_id = '${p}';`)).toBe("1");
  });

  it("여분이 없어 열려 있던 세트 칸 기록은 취소되고 세트 칸은 원래 문항 그대로(복귀한 문항이 계속 사용 가능)", async () => {
    const f = createRoutingSet({ run: RUN, label: "revert-nospare" });
    const item = f.ids.rw_lower[1];
    psql(`update mock_exam_set_items set skill_code = '${SK_B}' where id = '${item}';`);
    psql(`update problems set archived_at = now(), archived_reason = 'revert test cleanup' where skill_code = '${SK_B}' and passage like 'R4 spare %' and archived_at is null;`);
    const [p, v] = psql(`select problem_id || '|' || problem_version_id from mock_exam_set_items where id = '${item}';`).split("|");
    expect(((await verdict(p, v, "key_wrong_confirmed")).json as Json).replacementNeedsOpen).toBe(1);
    const r = await verdict(p, v, "not_error");
    expect(r.json).toMatchObject({ restored: true, replacementNeedsCancelled: 1, replacementNeedsOpen: 0 });
    expect(needs(p)).toBe("cancelled:verdict_reverted");
    expect(psql(`select count(*) from mock_exam_set_items where exam_set_id = '${f.setId}' and problem_id = '${p}';`)).toBe("1");
    // 재시도(여분 교체 루틴)는 취소된 기록을 건드리지 않는다
    spare(SK_B, "medium");
    await rest(ADMIN_ID, "rpc/problem_replacement_retry_open", { method: "POST", body: {} });
    expect(needs(p)).toBe("cancelled:verdict_reverted");
    expect(psql(`select count(*) from mock_exam_set_items where exam_set_id = '${f.setId}' and problem_id = '${p}';`)).toBe("1");
  });
});
