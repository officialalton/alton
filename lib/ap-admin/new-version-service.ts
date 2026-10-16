// 'AB/AP 세트 새 버전' + 공개 범위(무료/튜터링) 서비스. 서버 액션(app/admin/ap-new-version-actions.ts)이 requireAdmin 뒤에서 부른다.
// 쓰기는 모두 dry-run → 같은 계획 해시로 execute, 환경 가드(assertCanWrite), 감사 로그(ap_stock_admin_runs). v1(공개본)·응시·답안·결과는 읽기만 하거나(응시 수) 건드리지 않는다.
// 실제 쓰기(새 버전 초안 만들기·공개)는 기존 서버 액션(createMockExamNewVersionAction·publishMockExamSet)을 주입받아 호출한다.
import { base, cap, auditReady, checkHash, gate, type Ctx, type StepResult } from "./service";
import { buildNewVersionPreview, type NewVersionPreview, type PlanSwapInput } from "./new-version";
import { planHash } from "./plan-hash";

const unitLine = (c: NewVersionPreview["before"]) => Object.entries(c.unitCounts).sort((a, b) => Number(a[0]) - Number(b[0])).map(([u, n]) => `${u}:${n}`).join(" ");
const compLine = (c: NewVersionPreview["before"]) => `MC ${c.mc} (계산기 불가 ${c.calculator.not_allowed} / 필수 ${c.calculator.required}) FRQ ${c.frq} · 단원 ${unitLine(c)}`;

export function previewLines(p: NewVersionPreview): string[] {
  const att = Object.entries(p.attempts.byStatus).map(([k, v]) => `${k} ${v}`).join(", ");
  return [
    `대상: ${p.source.name} v${p.source.versionNo} (${p.source.status}, 공개 범위 ${p.source.accessTier === "free" ? "무료" : "튜터링"}) → 새 버전 v${p.newVersionNo} 초안`,
    `교체 ${p.swaps.length}건. 기존 응시 ${p.attempts.total}건${att ? `(${att})` : ""}은 v${p.source.versionNo} 에 그대로 남고 바뀌지 않습니다.`,
    `구성 전: ${compLine(p.before)}`, `구성 후: ${compLine(p.after)}`,
    ...p.swaps.map((s) => `${s.section} #${s.position}: ${s.removeKey ?? "?"}(단원 ${s.before?.unit ?? "-"}·${s.before?.calculator ?? "-"}) → ${s.addKey}(단원 ${s.after?.unit ?? "-"}·${s.after?.calculator ?? "-"})`),
    ...p.issues.map((i) => `위반: ${i}`),
  ];
}
const effectOf = (p: NewVersionPreview) => ({ v: p.source.versionNo, nv: p.newVersionNo, swaps: p.actionSwaps.map((s) => `${s.section}:${s.position}:${s.problemId}`).sort() });

/** 미리보기(읽기 전용; 감사 기록은 호출자가 남긴다). */
export async function runNewVersionPreview(c: Ctx, sourceSetId: string, inputs: PlanSwapInput[]): Promise<StepResult & { preview: NewVersionPreview }> {
  const r = base(c, "new_version_preview", "dry_run", { sourceSetId, swaps: inputs.length });
  const p = await buildNewVersionPreview(c.db, sourceSetId, inputs);
  r.counts = { swaps: p.swaps.length, attempts: p.attempts.total, violations: p.issues.length };
  r.lines = cap(previewLines(p)); r.ok = p.ok; if (!p.ok) r.blocked = "검증 위반이 있어 새 버전 초안을 만들 수 없습니다.";
  r.planHash = p.ok ? planHash("new_version", { sourceSetId }, effectOf(p)) : null;
  return { ...r, preview: p };
}

export type CreateFn = (sourceSetId: string, swaps: { section: string; position: number; problemId: string }[]) => Promise<{ newSetId: string; versionNo: number; swapped: number }>;
/** 새 버전 초안 만들기(execute). createFn = createMockExamNewVersionAction. 계획이 미리보기와 같을 때만. */
export async function runNewVersionDraft(c: Ctx, sourceSetId: string, inputs: PlanSwapInput[], expectedHash: string | null | undefined, createFn: CreateFn): Promise<StepResult> {
  const r = base(c, "new_version_draft", "execute", { sourceSetId, swaps: inputs.length });
  if (!gate(c, r, true, expectedHash)) return r;
  const p = await buildNewVersionPreview(c.db, sourceSetId, inputs);
  r.counts = { swaps: p.swaps.length, attempts: p.attempts.total, violations: p.issues.length };
  r.lines = cap(previewLines(p)); r.ok = p.ok;
  if (!p.ok) { r.blocked = "검증 위반이 있어 새 버전 초안을 만들 수 없습니다."; return r; }
  r.planHash = planHash("new_version", { sourceSetId }, effectOf(p));
  if (!checkHash(r, expectedHash, true)) return r;
  await auditReady(c);
  const out = await createFn(sourceSetId, p.actionSwaps);
  r.executed = true; r.scope = { ...r.scope, newSetId: out.newSetId, versionNo: out.versionNo };
  r.lines.push(`v${out.versionNo} 초안 ${out.newSetId} 생성(교체 ${out.swapped}건). 공개 전이며 공개본·응시는 그대로입니다. 다음: 초안 검토 후 '새 버전 공개'.`);
  return r;
}

export type PublishFn = (setId: string) => Promise<void>;
type SetRow = { id: string; name: string; version_no: number; status: string; set_group_id: string; access_tier: string; planned_access_tier: string | null; exam_program: string; ap_label: string | null };
async function loadSet(c: Ctx, id: string): Promise<SetRow> {
  const { data, error } = await c.db.from("mock_exam_sets").select("id, name, version_no, status, set_group_id, access_tier, planned_access_tier, exam_program, ap_label").eq("id", id).single();
  if (error || !data) throw new Error(error?.message ?? "세트를 찾을 수 없습니다.");
  return data as SetRow;
}
/** 새 버전 공개: 초안(version_no ≥ 2, AP)만. 원자적 공개 RPC(mock_exam_publish_set)가 이전 공개본 보관 + 공개 + 범위 승계를 한 트랜잭션으로 한다. */
export async function runNewVersionPublish(c: Ctx, newSetId: string, execute: boolean, expectedHash: string | null | undefined, publishFn: PublishFn): Promise<StepResult> {
  const r = base(c, "new_version_publish", execute ? "execute" : "dry_run", { newSetId });
  if (execute && !gate(c, r, true, expectedHash)) return r;
  const s = await loadSet(c, newSetId);
  const problems: string[] = [];
  if (s.exam_program !== "ap") problems.push("AP 세트만 이 화면에서 공개합니다.");
  if (s.status !== "draft") problems.push("초안 상태의 세트만 공개할 수 있습니다.");
  if (s.version_no < 2) problems.push("새 버전(v2 이상) 초안만 이 화면에서 공개합니다. 첫 버전 공개는 기존 세트 관리 화면에서 하세요.");
  const { data: prev } = await c.db.from("mock_exam_sets").select("id, version_no, access_tier").eq("set_group_id", s.set_group_id).eq("status", "published").limit(1);
  const prevRow = prev?.[0] as { id: string; version_no: number; access_tier: string } | undefined;
  if (!prevRow) problems.push("같은 계열에 공개 중인 이전 버전이 없습니다.");
  const { count } = await c.db.from("mock_exam_set_items").select("id", { count: "exact", head: true }).eq("exam_set_id", newSetId);
  const tier = prevRow?.access_tier ?? s.planned_access_tier ?? s.access_tier;
  r.counts = { items: count ?? 0 };
  r.lines = problems.length ? problems : [`${s.name} v${s.version_no} 공개: 이전 공개본 v${prevRow?.version_no} 은(는) 보관 처리되고 공개 범위 ${tier === "free" ? "무료" : "튜터링"} 을(를) 이어받습니다. 기존 응시·답안·결과는 v${prevRow?.version_no} 에 그대로 남습니다. 한 트랜잭션으로 처리되며 실패하면 모두 되돌려집니다.`];
  r.ok = problems.length === 0; if (!r.ok) r.blocked = "공개할 수 없는 상태입니다.";
  r.planHash = r.ok ? planHash("new_version_publish", { newSetId }, { prev: prevRow?.id, items: count }) : null;
  if (!r.ok || !execute || !checkHash(r, expectedHash, true)) return r;
  await auditReady(c);
  await publishFn(newSetId);
  r.executed = true; r.lines.push("공개 완료.");
  return r;
}

/** AP 세트 공개 범위(무료/튜터링) 변경. 초안은 공개 때 적용할 범위만, 공개 중인 세트는 즉시. 내용·문항·응시·답안·결과는 건드리지 않는다. */
export async function runSetAccessTier(c: Ctx, setId: string, tier: "free" | "tutoring", execute: boolean, expectedHash?: string | null): Promise<StepResult> {
  if (tier !== "free" && tier !== "tutoring") throw new Error("공개 범위는 무료 또는 튜터링이어야 합니다.");
  const r = base(c, "set_access_tier", execute ? "execute" : "dry_run", { setId, tier });
  if (execute && !gate(c, r, true, expectedHash)) return r;
  const s = await loadSet(c, setId);
  const problems: string[] = [];
  if (s.exam_program !== "ap") problems.push("AP 세트만 이 화면에서 범위를 바꿉니다.");
  if (s.status === "archived") problems.push("보관된 세트는 범위를 바꿀 수 없습니다.");
  const cur = s.status === "published" ? s.access_tier : s.planned_access_tier ?? s.access_tier;
  const ko = (t: string) => (t === "free" ? "무료" : "튜터링");
  r.scope = { ...r.scope, name: s.name, status: s.status, from: cur };
  r.lines = problems.length ? problems : cur === tier ? [`${s.name}: 이미 ${ko(tier)} 입니다(변경 없음).`] : [`${s.name}(${s.status === "published" ? "공개 중" : "초안"}): ${ko(cur)} → ${ko(tier)}${s.status === "draft" ? " (공개 때 적용)" : " (즉시 적용: 무료 회원 목록에 " + (tier === "free" ? "나타납니다" : "서 사라집니다") + ")"}. 문항·구성·응시·답안·결과는 바뀌지 않습니다.`];
  r.ok = problems.length === 0; if (!r.ok) r.blocked = "범위를 바꿀 수 없는 세트입니다.";
  r.planHash = r.ok ? planHash("set_access_tier", { setId, tier }, { status: s.status, cur }) : null;
  if (!r.ok || !execute || !checkHash(r, expectedHash, true)) return r;
  await auditReady(c);
  const { error } = await c.db.rpc("ap_admin_set_access_tier", { p_set_id: setId, p_tier: tier, p_actor_id: c.actorId });
  if (error) throw new Error(error.message);
  r.executed = true; r.lines.push("변경 완료.");
  return r;
}
