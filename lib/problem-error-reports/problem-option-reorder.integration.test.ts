import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN_ID, SEED_STUDENT_ID, TEACHER_ID, createRoutingSet, fails, psql, rest } from "@/test/mock-exam-routing-fixture";

// 선지 순서 교정 RPC(20261990000000) — 실제 로컬 DB. 실행 ID(RUN)가 붙은 전용 문항만 쓰고 공유 시드는 읽기만 한다.
// 정상 적용·순열 검증·stale·이미 적용(멱등)·사용된 버전 건너뛰기·되돌리기·이력 불변·권한.
const RUN = randomUUID().slice(0, 8);
const TITLE = `reorder-${RUN}`;
const SKILL = `zzro${RUN}`;

const sqlStr = (s: string) => `'${s.replace(/'/g, "''")}'`;
const J = (o: unknown) => sqlStr(JSON.stringify(o));

type Content = { options: string[]; correct_index: number; explanation: string; explanation_en: string };
const BEFORE: Content = {
  options: ["오답 하나", "정답 문장", "오답 셋", "오답 넷"],
  correct_index: 1,
  explanation: "정답은 B 이다. A 는 틀렸다.",
  explanation_en: "The answer is B. A is wrong.",
};
// perm: 새 위치 i 의 선택지는 원래 perm[i] 번째. 정답(원래 1)을 위치 3 으로.
const PERM = [0, 2, 3, 1];
const AFTER: Content = {
  options: PERM.map((p) => BEFORE.options[p]),
  correct_index: 3,
  explanation: "정답은 D 이다. A 는 틀렸다.",
  explanation_en: "The answer is D. A is wrong.",
};

const makeVersion = (c: Content = BEFORE): { problemId: string; versionId: string } => {
  const problemId = psql(`insert into problems (format, skill_code, status, created_via, unit_title, difficulty)
    values ('mc', '${SKILL}', 'draft', 'manual', ${sqlStr(TITLE)}, 'medium') returning id;`).split("\n")[0];
  const versionId = psql(`update problem_versions set passage = '본문 ' || ${sqlStr(RUN)}, options = ${J(c.options)}::jsonb, correct_index = ${c.correct_index},
    explanation = ${sqlStr(c.explanation)}, explanation_en = ${sqlStr(c.explanation_en)}, difficulty = 'medium', status = 'published', published_at = now()
    where problem_id = '${problemId}' returning id;`).split("\n")[0];
  psql(`update problems set published_version_id = '${versionId}' where id = '${problemId}';`);
  return { problemId, versionId };
};

const item = (versionId: string, over: Record<string, unknown> = {}) => ({
  version_id: versionId, expected: BEFORE, after: AFTER, perm: PERM, method: "deterministic", verification: "static", ...over,
});
const apply = (items: unknown[], actor = ADMIN_ID) =>
  JSON.parse(psql(`select public.apply_problem_option_reorders(${J(items)}::jsonb, '${actor}');`)) as {
    applied: number; already: number; skipped: number; results: { version_id: string; status: string; reason?: string }[];
  };
const row = (vid: string) =>
  JSON.parse(psql(`select to_jsonb(t) from (select options, correct_index, explanation, explanation_en, passage, difficulty, status, quality->'positionFix' as pf from problem_versions where id = '${vid}') t;`));
const logCount = (vid: string) => Number(psql(`select count(*) from problem_option_reorders where problem_version_id = '${vid}';`));

beforeAll(() => {
  psql(`insert into problem_skill_codes (code, domain, label, sort) values ('${SKILL}', 'rw_craft_structure', '순서 교정 테스트', 9999) on conflict do nothing;`);
});
afterAll(() => {
  // append-only 트리거·FK 를 우회해 이 실행의 전용 데이터만 지운다.
  psql(`
    set session_replication_role = replica;
    delete from problem_option_reorders where problem_version_id in (select v.id from problem_versions v join problems p on p.id = v.problem_id where p.unit_title = ${sqlStr(TITLE)});
    delete from homework_batches where items::text like '%' || ${sqlStr(RUN)} || '%';
    delete from mock_exam_set_items where exam_set_id in (select id from mock_exam_sets where name like ${sqlStr(`R3 reorder-ref ${RUN}-%`)});
    delete from mock_exam_sets where name like ${sqlStr(`R3 reorder-ref ${RUN}-%`)};
    delete from problem_versions where problem_id in (select id from problems where passage like ${sqlStr(`R3 ${RUN} %`)});
    delete from problems where passage like ${sqlStr(`R3 ${RUN} %`)};
    delete from problem_versions where problem_id in (select id from problems where unit_title = ${sqlStr(TITLE)});
    delete from problems where unit_title = ${sqlStr(TITLE)};
    delete from problem_skill_codes where code = '${SKILL}';
    set session_replication_role = origin;`);
});

describe("선지 순서 교정 RPC", () => {
  it("정상 적용: 선지·정답 위치·해설만 바뀌고 본문·난이도·상태는 그대로, 이력과 표식이 남는다", () => {
    const { versionId } = makeVersion();
    const res = apply([item(versionId)]);
    expect(res).toMatchObject({ applied: 1, already: 0, skipped: 0 });
    const r = row(versionId);
    expect(r.options).toEqual(AFTER.options);
    expect(r.correct_index).toBe(3);
    expect(r.options[r.correct_index]).toBe(BEFORE.options[BEFORE.correct_index]); // 정답 내용 동일
    expect(r.explanation).toBe(AFTER.explanation);
    expect(r.explanation_en).toBe(AFTER.explanation_en);
    expect(r.passage).toBe(`본문 ${RUN}`);
    expect(r.difficulty).toBe("medium");
    expect(r.status).toBe("published");
    expect(r.pf).toBeTruthy();
    expect(logCount(versionId)).toBe(1);
  });

  it("멱등: 같은 요청을 다시 보내면 already 이고 이력이 늘지 않는다", () => {
    const { versionId } = makeVersion();
    apply([item(versionId)]);
    const again = apply([item(versionId)]);
    expect(again).toMatchObject({ applied: 0, already: 1, skipped: 0 });
    expect(logCount(versionId)).toBe(1);
  });

  it("stale: 현재 내용이 expected 와 다르면 건너뛰고 아무것도 바꾸지 않는다", () => {
    const { versionId } = makeVersion();
    psql(`update problem_versions set explanation = '누군가 고친 해설' where id = '${versionId}';`);
    const res = apply([item(versionId)]);
    expect(res.results[0]).toMatchObject({ status: "skipped", reason: "stale" });
    expect(row(versionId).explanation).toBe("누군가 고친 해설");
    expect(row(versionId).options).toEqual(BEFORE.options);
    expect(logCount(versionId)).toBe(0);
  });

  it("순열 검증: 선지가 순열이 아니거나 정답 내용이 달라지거나 perm 이 틀리면 거절한다", () => {
    const { versionId } = makeVersion();
    const badOptions = { ...AFTER, options: ["오답 하나", "다른 문장", "오답 넷", "오답 셋"] };
    const wrongCorrect = { ...AFTER, correct_index: 0 };
    const res = apply([
      item(versionId, { after: badOptions }),
      item(versionId, { after: wrongCorrect }),
      item(versionId, { perm: [0, 0, 1, 2] }),
      item(versionId, { perm: [0, 1, 2] }),
    ]);
    expect(res.applied).toBe(0);
    expect(res.skipped).toBe(4);
    expect(res.results.map((r) => r.reason)).toEqual(["options_not_permutation", "correct_content_changed", "bad_perm", "bad_perm"]);
    expect(row(versionId).options).toEqual(BEFORE.options);
    expect(logCount(versionId)).toBe(0);
  });

  it("이미 사용된 버전은 건너뛴다 — 과제 묶음(homework_batches.items 문자열 참조)과 세트 항목", () => {
    const hw = makeVersion();
    psql(`insert into homework_batches (teacher_id, student_id, label, items)
          values ('${TEACHER_ID}', '${SEED_STUDENT_ID}', ${sqlStr(`reorder-${RUN}`)}, jsonb_build_array(jsonb_build_object('problemVersionId', '${hw.versionId}', 'note', ${sqlStr(RUN)})));`);
    expect(psql(`select public.problem_option_reorder_referenced('${hw.versionId}');`)).toBe("homework_batches");
    const res = apply([item(hw.versionId)]);
    expect(res.results[0]).toMatchObject({ status: "skipped", reason: "referenced:homework_batches" });
    expect(row(hw.versionId).options).toEqual(BEFORE.options);
    expect(logCount(hw.versionId)).toBe(0);

    const used = makeVersion();
    expect(psql(`select coalesce(public.problem_option_reorder_referenced('${used.versionId}'), 'none');`)).toBe("none");
    const fixture = createRoutingSet({ run: RUN, label: "reorder-ref" });
    const verOfItem = psql(`select problem_version_id from mock_exam_set_items where id = '${fixture.ids.rw_m1[0]}';`);
    expect(psql(`select public.problem_option_reorder_referenced('${verOfItem}');`)).toBe("mock_exam_set_items");
  });

  it("되돌리기: 현재가 after 와 같으면 before 로 복원하고 revert 행이 추가되며(원래 행은 그대로), 재호출은 already", () => {
    const { versionId } = makeVersion();
    apply([item(versionId)]);
    const applyId = psql(`select id from problem_option_reorders where problem_version_id = '${versionId}' and kind = 'apply';`);
    const out = JSON.parse(psql(`select public.revert_problem_option_reorder('${applyId}', '${ADMIN_ID}');`));
    expect(out.status).toBe("reverted");
    expect(row(versionId)).toMatchObject({ options: BEFORE.options, correct_index: 1, explanation: BEFORE.explanation, explanation_en: BEFORE.explanation_en });
    expect(row(versionId).pf).toBeNull();
    expect(logCount(versionId)).toBe(2);
    expect(JSON.parse(psql(`select public.revert_problem_option_reorder('${applyId}', '${ADMIN_ID}');`)).status).toBe("already");
    // 되돌린 뒤 다시 적용도 가능
    expect(apply([item(versionId)]).applied).toBe(1);
  });

  it("되돌리기는 적용 뒤 내용이 바뀌었으면 거절한다", () => {
    const { versionId } = makeVersion();
    apply([item(versionId)]);
    const applyId = psql(`select id from problem_option_reorders where problem_version_id = '${versionId}' and kind = 'apply';`);
    psql(`update problem_versions set explanation = '그 사이 수정' where id = '${versionId}';`);
    const out = JSON.parse(psql(`select public.revert_problem_option_reorder('${applyId}', '${ADMIN_ID}');`));
    expect(out).toMatchObject({ status: "skipped", reason: "changed_since" });
    expect(row(versionId).options).toEqual(AFTER.options);
  });

  it("이력은 수정·삭제·truncate 할 수 없다", () => {
    const { versionId } = makeVersion();
    apply([item(versionId)]);
    expect(fails(() => psql(`update problem_option_reorders set method = 'x' where problem_version_id = '${versionId}';`))).toContain("수정하거나 삭제할 수 없습니다");
    expect(fails(() => psql(`delete from problem_option_reorders where problem_version_id = '${versionId}';`))).toContain("수정하거나 삭제할 수 없습니다");
    expect(fails(() => psql(`truncate problem_option_reorders;`))).toContain("수정하거나 삭제할 수 없습니다");
  });

  it("관리자가 아닌 실행자·100건 초과·배열 아님은 거절한다", () => {
    const { versionId } = makeVersion();
    expect(fails(() => apply([item(versionId)], SEED_STUDENT_ID))).toContain("관리자만");
    expect(fails(() => apply(Array.from({ length: 101 }, () => item(versionId))))).toContain("100건");
    expect(fails(() => psql(`select public.apply_problem_option_reorders('{}'::jsonb, '${ADMIN_ID}');`))).toContain("배열");
    expect(row(versionId).options).toEqual(BEFORE.options);
  });

  it("일반 로그인 사용자는 REST 로 이 RPC 를 호출할 수 없다(service_role 전용)", async () => {
    const { versionId } = makeVersion();
    const res = await rest(ADMIN_ID, "rpc/apply_problem_option_reorders", { method: "POST", body: { p_items: [item(versionId)], p_actor_id: ADMIN_ID } });
    expect([401, 403, 404]).toContain((res as { status: number }).status);
    expect(row(versionId).options).toEqual(BEFORE.options);
  });

  it("동시 실행: 같은 문항을 두 번 동시에 적용해도 한 번만 반영된다", async () => {
    const { versionId } = makeVersion();
    const run = () => new Promise<void>((resolve) => { try { apply([item(versionId)]); } catch { /* 동시 직렬화 */ } resolve(); });
    await Promise.all([run(), run()]);
    expect(row(versionId).options).toEqual(AFTER.options);
    expect(logCount(versionId)).toBe(1);
  });
});
