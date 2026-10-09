import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { ADMIN_ID, createRoutingSet, psql, rest } from "@/test/mock-exam-routing-fixture";

// 대체 문항 필요 큐 자기 치유(마이그레이션 420): 활성 세트에 없는 need 는 세트 보관 시점·재시도 시점에 닫히고(삭제 없음),
// 요약 경보는 활성 세트 칸만 센다. 일반 문항 need 는 별도(bankLevel). 실행 ID 전용 세트·문항·skill 값만 쓴다.
const RUN = randomUUID().slice(0, 8);
const SK = `zzstale${RUN}`;
afterAll(() => {
  psql(`update problems set archived_at = coalesce(archived_at, now()), archived_reason = coalesce(archived_reason, 'stale test cleanup') where skill_code = '${SK}' and passage like 'stock %';`);
});
type Summary = {
  openTotal: number; openInMockSet: number; openBankLevel: number; staleOpen: number;
  items: { id: string; setName: string | null; setVersionNo: number | null; setStatus: string | null; openReason: string | null }[];
  bankCells: { skillCode: string | null; openCount: number; stock: number }[];
};
const summary = async () => (await rest(ADMIN_ID, "rpc/problem_replacement_need_summary", { method: "POST", body: {} })).json as Summary;
const retry = async () => (await rest(ADMIN_ID, "rpc/problem_replacement_retry_open", { method: "POST", body: {} })).json as { closedStale: number };
const state = (id: string) => psql(`select status || ':' || coalesce(resolution, '-') from problem_replacement_needs where id = '${id}';`);

function itemOf(setId: string): { itemId: string; problemId: string; versionId: string } {
  const [itemId, problemId, versionId] = psql(`select id || '|' || problem_id || '|' || problem_version_id from mock_exam_set_items where exam_set_id = '${setId}' order by section desc, position limit 1;`).split("|");
  return { itemId, problemId, versionId };
}
function need(setId: string | null, it: { itemId: string; problemId: string; versionId: string }, opts: { inSet: boolean; reason?: string }): string {
  const v = psql(`insert into problem_error_verdicts (problem_id, problem_version_id, decision, decided_by) values ('${it.problemId}', '${it.versionId}', 'key_wrong_confirmed', '${ADMIN_ID}') returning id;`);
  return psql(
    `insert into problem_replacement_needs (verdict_id, problem_id, set_item_id, exam_set_id, difficulty, sat_domain, skill_code, usage_scope, in_mock_set, open_reason)
     values ('${v}', '${it.problemId}', ${opts.inSet ? `'${it.itemId}'` : "null"}, ${setId && opts.inSet ? `'${setId}'` : "null"}, 'medium', 'rw_craft_structure', '${SK}', 'mock_exam', ${opts.inSet}, ${opts.reason ? `'${opts.reason}'` : "null"}) returning id;`,
  );
}

describe("대체 문항 필요 — 오래된 항목 자동 종료", () => {
  it("활성(초안) 세트 칸은 경보로 세고 세트·버전·사유를 보여준다", async () => {
    const f = createRoutingSet({ run: RUN, label: "stale-active", publish: false });
    const n = need(f.setId, itemOf(f.setId), { inSet: true, reason: "set_started" });
    const s = await summary();
    const row = s.items.find((i) => i.id === n);
    expect(row).toMatchObject({ setVersionNo: 1, setStatus: "draft", openReason: "set_started" });
    expect(row?.setName).toContain("stale-active");
    expect(s.openTotal).toBe(s.openInMockSet);
    expect(state(n)).toBe("open:-");
  });

  it("세트를 보관하면 트리거가 열린 need 를 set_replaced 로 닫고 행·이력은 남는다", async () => {
    const f = createRoutingSet({ run: RUN, label: "stale-archive", publish: false });
    const n = need(f.setId, itemOf(f.setId), { inSet: true, reason: "set_started" });
    const before = psql(`select count(*) from problem_replacement_needs;`);
    psql(`update mock_exam_sets set status = 'archived', archived_at = now() where id = '${f.setId}';`);
    expect(state(n)).toBe("cancelled:set_replaced");
    expect(psql(`select count(*) from problem_replacement_needs;`)).toBe(before);
    expect((await summary()).items.some((i) => i.id === n)).toBe(false);
  });

  it("재시도는 보관된 세트·활성 세트에 없는 문항의 need 를 닫고(멱등) 활성 칸은 건드리지 않는다", async () => {
    const f = createRoutingSet({ run: RUN, label: "stale-retry", publish: false });
    // 보관된 세트의 need 가 트리거 이후에 생긴 경우(이전 데이터 모사)
    const fa = createRoutingSet({ run: RUN, label: "stale-retry-arch", publish: false });
    const ia = itemOf(fa.setId);
    psql(`update mock_exam_sets set status = 'archived', archived_at = now() where id = '${fa.setId}';`);
    const nArchived = need(fa.setId, ia, { inSet: true, reason: "set_started" });
    expect(state(nArchived)).toBe("open:-");
    // 활성 세트인데 그 칸 문항이 이미 빠진 경우
    const nGone = need(f.setId, itemOf(f.setId), { inSet: true, reason: "no_spare" });
    psql(`delete from mock_exam_set_items where id = (select set_item_id from problem_replacement_needs where id = '${nGone}');`);

    expect((await summary()).staleOpen).toBeGreaterThanOrEqual(2);
    const r = await retry();
    expect(r.closedStale).toBeGreaterThanOrEqual(2);
    expect(state(nArchived)).toBe("cancelled:set_replaced");
    expect(state(nGone)).toBe("cancelled:not_in_active_set");
    expect((await summary()).staleOpen).toBe(0);
    expect((await retry()).closedStale).toBe(0);
    expect(state(nArchived)).toBe("cancelled:set_replaced");
  });

  it("일반 문항 need(세트 없음)는 닫히지 않고 경보 건수에서 분리돼 bankLevel 로 보인다", async () => {
    const f = createRoutingSet({ run: RUN, label: "stale-bank", publish: false });
    const n = need(null, itemOf(f.setId), { inSet: false });
    const before = await summary();
    await retry();
    const after = await summary();
    expect(state(n)).toBe("open:-");
    expect(after.openBankLevel).toBeGreaterThanOrEqual(1);
    expect(after.bankCells.find((c) => c.skillCode === SK)?.openCount).toBe(1);
    expect(after.items.some((i) => i.id === n)).toBe(false);
    expect(after.openTotal).toBe(before.openTotal);
  });

  it("일반 문항 need 는 재시도·정리 함수로 닫히지 않고, 재고는 같은 영역·기술·난이도·용도의 미배정 공개 문항만 센다", async () => {
    const f = createRoutingSet({ run: RUN, label: "stale-stock", publish: false });
    const it = itemOf(f.setId);
    psql(`update mock_exam_sets set status = 'archived', archived_at = now() where id = '${f.setId}';`);
    const bank = need(null, it, { inSet: false });
    psql(`select public._problem_replacement_close_stale(null);`);
    expect(state(bank)).toBe("open:-");
    const cell = () => summary().then((s) => s.bankCells.find((c) => c.skillCode === SK));
    expect((await cell())?.stock).toBe(0);
    // 같은 조건의 공개 문항 2개(하나는 초안 세트에 배정) → 재고 1
    psql(`insert into problem_skill_codes (code, domain, label, sort) values ('${SK}', 'rw_craft_structure', 'stale stock ${RUN}', 9970) on conflict (code) do nothing;`);
    const mk = () => {
      const p = psql(`insert into problems (format, passage, subject_id, status, created_by, sat_domain, skill_code, usage_scope) values ('mc', 'stock ${RUN} ${randomUUID().slice(0, 6).replace(/\d/g, "x")}', (select subject_id from problems where id = '${it.problemId}'), 'confirmed', '${ADMIN_ID}', 'rw_craft_structure', '${SK}', 'mock_exam') returning id;`);
      psql(`update problem_versions set options = '["a","b","c","d"]'::jsonb, correct_index = 0, explanation = 'x', difficulty = 'medium', status = 'published', published_at = now() where problem_id = '${p}' and version_no = 1;`);
      psql(`update problems set published_version_id = (select id from problem_versions where problem_id = '${p}' and version_no = 1) where id = '${p}';`);
      return p;
    };
    mk();
    const assigned = mk();
    const g = createRoutingSet({ run: RUN, label: "stale-stock-b", publish: false });
    psql(`insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, skill_code, difficulty, module_key) values ('${g.setId}', 'rw', 99, '${assigned}', (select published_version_id from problems where id = '${assigned}'), 'rw_craft_structure', '${SK}', 'medium', 'rw_m1');`);
    expect((await cell())?.stock).toBe(1);
    expect(state(bank)).toBe("open:-");
  });

  it("한 번 정정한 행은 resolution 이 남고 행 수는 그대로다(허용 값 확인)", () => {
    const f = createRoutingSet({ run: RUN, label: "stale-res", publish: false });
    const n = need(null, itemOf(f.setId), { inSet: false });
    psql(`update problem_replacement_needs set status = 'cancelled', resolution = 'bank_stock_satisfied' where id = '${n}';`);
    expect(state(n)).toBe("cancelled:bank_stock_satisfied");
  });
});
