// '출시 차단·검증 현황'(읽기 전용): 비보관 AP 세트(풀·부분)의 문항 중 ap_launch_ready_v 에 없는 것과 그 사유, 세트별 출시 게이트 판정.
// 쓰기 없음. 사유는 ap_item_review_status_v(검증 상태·신고 수·결함 플래그)와 ap_launch_blockers(미해결 대장)에서 풀어 쓴다.
// 문서: docs/ap/admin-stock-screen.md
import type { SupabaseClient } from "@supabase/supabase-js";

export type LaunchSetRow = { id: string; name: string; status: string; label: string | null; versionNo: number | null };
export type LaunchStatusRow = {
  candidate_key: string; release_tier: string | null; review_state: string | null; render_verified: boolean; screen_verified: boolean; review_env_ready: boolean;
  open_reports: number; open_defect_reports: number; open_blockers: number; defect_flags: string[] | null;
};
export type LaunchBlockerRow = { candidate_key: string; category: string };

export type LaunchBlockedItem = { section: string; position: number; candidateKey: string | null; reasons: string[] };
export type LaunchSetReport = {
  id: string; name: string; status: string; label: string | null; versionNo: number | null;
  itemCount: number; readyCount: number; blockedCount: number;
  openBlockers: number; openDefectReports: number; openErrorReports: number;
  ready: boolean; verdict: string; blocked: LaunchBlockedItem[];
};
export type LaunchGateReport = {
  sets: LaunchSetReport[];
  totals: { sets: number; readySets: number; blockedItems: number; openBlockers: number; openDefectReports: number; openErrorReports: number; globalOpenBlockers: number };
};
/** 세트 문항 한 칸: 문제 → 후보 연결을 풀어 둔 입력. */
export type LaunchSetItem = { setId: string; section: string; position: number; problemId: string; candidateKey: string | null };

const CATEGORY_KO: Record<string, string> = { wrong_key: "오답 키", multiple_correct: "복수 정답", missing_condition: "조건 누락", wrong_figure: "그림·표 오류", other: "기타" };

/** 후보 한 건이 launch 준비가 안 된 이유(없으면 빈 배열이 아니라 ready 로 분류되므로 호출하지 않는다). */
export function launchReasons(row: LaunchStatusRow | undefined, blockerCats: string[]): string[] {
  if (!row) return ["후보 상태 없음(현재 적재본이 아님 또는 변환 전)"];
  const r: string[] = [];
  if (row.release_tier !== "review_env") r.push(`검수 환경 미게시(현재 ${row.release_tier ?? "없음"})`);
  if (row.review_state !== "auto_passed") r.push(`자동 게이트 미통과(${row.review_state ?? "없음"})`);
  if (!row.render_verified) r.push("렌더 검증 없음");
  if (!row.screen_verified) r.push("학생 화면 검증 없음");
  if (row.defect_flags && row.defect_flags.length > 0) r.push(`생성기 결함 플래그: ${row.defect_flags.join(", ")}`);
  if (row.open_defect_reports > 0) r.push(`미해결 오답·문항 결함 신고 ${row.open_defect_reports}건`);
  if (row.open_blockers > 0) r.push(`미해결 launch 차단 결함 ${row.open_blockers}건${blockerCats.length ? `(${[...new Set(blockerCats)].map((c) => CATEGORY_KO[c] ?? c).join("·")})` : ""}`);
  const generalOpen = row.open_reports - row.open_defect_reports;
  if (generalOpen > 0) r.push(`미해결 일반 오류 신고 ${generalOpen}건(차단은 아님)`);
  return r;
}

/** 순수 계산. readyKeys = ap_launch_ready_v 에 있는 후보 키. */
export function buildLaunchGateReport(sets: LaunchSetRow[], items: LaunchSetItem[], status: LaunchStatusRow[], blockers: LaunchBlockerRow[], readyKeys: Set<string>): LaunchGateReport {
  const st = new Map(status.map((s) => [s.candidate_key, s]));
  const cats = new Map<string, string[]>();
  for (const b of blockers) (cats.get(b.candidate_key) ?? cats.set(b.candidate_key, []).get(b.candidate_key)!).push(b.category);
  const out: LaunchSetReport[] = sets.map((s) => {
    const mine = items.filter((i) => i.setId === s.id).sort((a, b) => a.section.localeCompare(b.section) || a.position - b.position);
    const blocked: LaunchBlockedItem[] = [];
    let openBlockers = 0, openDefect = 0, openErr = 0, ready = 0;
    for (const it of mine) {
      const row = it.candidateKey ? st.get(it.candidateKey) : undefined;
      if (row) { openBlockers += row.open_blockers; openDefect += row.open_defect_reports; openErr += row.open_reports; }
      if (it.candidateKey && readyKeys.has(it.candidateKey)) { ready++; continue; }
      const reasons = it.candidateKey ? launchReasons(row, cats.get(it.candidateKey) ?? []) : ["후보 연결 없음(AP 후보에서 변환되지 않은 문제)"];
      blocked.push({ section: it.section, position: it.position, candidateKey: it.candidateKey, reasons });
    }
    const isReady = mine.length > 0 && blocked.length === 0;
    const verdict = mine.length === 0 ? "문항 없음" : isReady ? "출시 게이트 통과 가능" : `출시 차단 — 문항 ${blocked.length}건 미충족`;
    return { id: s.id, name: s.name, status: s.status, label: s.label, versionNo: s.versionNo, itemCount: mine.length, readyCount: ready, blockedCount: blocked.length, openBlockers, openDefectReports: openDefect, openErrorReports: openErr, ready: isReady, verdict, blocked };
  });
  return {
    sets: out,
    totals: {
      sets: out.length, readySets: out.filter((s) => s.ready).length, blockedItems: out.reduce((a, s) => a + s.blockedCount, 0),
      openBlockers: out.reduce((a, s) => a + s.openBlockers, 0), openDefectReports: out.reduce((a, s) => a + s.openDefectReports, 0), openErrorReports: out.reduce((a, s) => a + s.openErrorReports, 0),
      globalOpenBlockers: blockers.length,
    },
  };
}

async function pageAll<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

/**
 * 읽기 전용 조회. 쿼리: ① 비보관 AP 세트 ② 세트 문항 ③ 문제→후보 연결 ④ 후보 검증 상태 뷰 ⑤ launch 준비 뷰 ⑥ 미해결 차단 대장 (각각 1회, 1000행 초과 시만 쪽 나눔).
 * ③~⑥ 은 키 목록으로 거르지 않고 전체를 한 번에 읽는다(수백 행) — URL 길이 제한으로 키를 쪼개 여러 번 묻는 것보다 요청 수가 적다.
 */
export async function fetchLaunchGateReport(db: SupabaseClient): Promise<LaunchGateReport> {
  const { data: sets, error } = await db.from("mock_exam_sets").select("id, name, status, ap_label, version_no").eq("exam_program", "ap").neq("status", "archived").order("name");
  if (error) throw new Error(error.message);
  const setRows: LaunchSetRow[] = (sets ?? []).map((s) => ({ id: s.id as string, name: s.name as string, status: s.status as string, label: (s.ap_label as string | null) ?? null, versionNo: (s.version_no as number | null) ?? null }));
  if (setRows.length === 0) return buildLaunchGateReport([], [], [], [], new Set());
  // 세트가 늘면 문항 행이 1000개를 넘는다(PostgREST 기본 상한) — 쪽 나눔 없이는 뒤쪽 세트가 '문항 없음'으로 잘린다. 안정적인 정렬(id)로 쪽을 나눈다.
  const setIds = setRows.map((s) => s.id);
  const its = await pageAll<{ exam_set_id: string; section: string; position: number; problem_id: string }>((a, b) => db.from("mock_exam_set_items").select("exam_set_id, section, position, problem_id").in("exam_set_id", setIds).order("id").range(a, b));
  const [links, status, ready, blockers] = await Promise.all([
    pageAll<{ problem_id: string; candidate_key: string }>((a, b) => db.from("ap_candidate_problems").select("problem_id, candidate_key").range(a, b)),
    pageAll<LaunchStatusRow>((a, b) => db.from("ap_item_review_status_v").select("candidate_key, release_tier, review_state, render_verified, screen_verified, review_env_ready, open_reports, open_defect_reports, open_blockers, defect_flags").range(a, b)),
    pageAll<{ candidate_key: string }>((a, b) => db.from("ap_launch_ready_v").select("candidate_key").range(a, b)),
    pageAll<LaunchBlockerRow>((a, b) => db.from("ap_launch_blockers").select("candidate_key, category").is("resolved_at", null).range(a, b)),
  ]);
  const keyOf = new Map(links.map((l) => [l.problem_id, l.candidate_key]));
  const items: LaunchSetItem[] = (its ?? []).map((i) => ({ setId: i.exam_set_id as string, section: i.section as string, position: i.position as number, problemId: i.problem_id as string, candidateKey: keyOf.get(i.problem_id as string) ?? null }));
  return buildLaunchGateReport(setRows, items, status, blockers, new Set(ready.map((r) => r.candidate_key)));
}
