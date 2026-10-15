import type { createAdminClient } from "@/lib/supabase-admin";

/** 문항의 stock JSON(payload) 로더 — AP English FRQ(ap_stock_current_v.payload.el_frq)를 채점 맥락 형식(context.ts)으로 옮긴다.
 *  현재 버전 행(is_current)만, 변환된 problem_id 로만 찾는다. 없거나 모양이 다르면 null → actions 가 앵커 샘플 부족으로 채점을 건너뛴다
 *  (점수 신뢰도를 보증할 수 없으면 채점하지 않는 안전 기본값). */
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter(isObj) : []);
const clipTo = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);

const cell = (v: unknown) => (v == null ? "" : String(v).replace(/\s*\|\s*/g, "/").replace(/\s+/g, " ").trim());
/** ush_frq 소스 한 개 → 채점 프롬프트용 텍스트(표는 파이프 표, 그림은 설명 + 데이터). */
function ushSourceBody(s: Record<string, unknown>): string {
  const out: string[] = [];
  if (str(s.attribution)) out.push(`Attribution: ${str(s.attribution)}`);
  if (str(s.body)) out.push(str(s.body));
  if (isObj(s.table)) {
    const cols = (Array.isArray(s.table.columns) ? s.table.columns : []).map(cell);
    const rows = (Array.isArray(s.table.rows) ? s.table.rows : []).map((r) => (Array.isArray(r) ? r.map(cell).join(" | ") : cell(r)));
    if (cols.length) out.push([cols.join(" | "), cols.map(() => "---").join(" | "), ...rows].join("\n")); else if (rows.length) out.push(rows.join("\n"));
  }
  if (isObj(s.figure)) {
    const f = s.figure; const cats = (Array.isArray(f.categories) ? f.categories : []).map(cell);
    if (str(f.title)) out.push(`Figure: ${str(f.title)}`);
    if (str(f.description)) out.push(str(f.description));
    for (const se of arr(f.series)) out.push(`${cell(se.name)}: ${(Array.isArray(se.values) ? se.values : []).map((v, i) => `${cats[i] ?? i + 1}=${cell(v)}`).join(", ")}`);
  }
  return out.join("\n");
}

/** payload.ush_frq(schema_version 'ush-frq-1') → context.ts 가 읽는 모양 + rubricId/taskType/scoringNotes.
 *  읽는 필드: task_type, prompt{scenario,task,requirements[],parts[{label,prompt,points}]}, sources[{id,kind,title,attribution,body,table{columns,rows},figure{title,categories,series[{name,values}],description}}],
 *  rubric{rubric_id,rows[{row_id,name,max,descriptors,task_specific}]}, expected_features, samples[{tier,essay,annotations[{quote,comment,row_id}],rubric_scores}]. */
function ushToEssayPayload(u: Record<string, unknown>, outerVersion: unknown): unknown | null {
  const ver = str(u.schema_version) || str(outerVersion);
  if (ver && ver !== "ush-frq-1") return null;
  const taskType = str(u.task_type);
  if (taskType !== "saq" && taskType !== "dbq" && taskType !== "leq") return null;
  const pr = isObj(u.prompt) ? u.prompt : {};
  const reqs = (Array.isArray(pr.requirements) ? pr.requirements : []).map(str).filter(Boolean);
  const parts = arr(pr.parts);
  const task = [str(pr.scenario), str(pr.task), reqs.length ? "Requirements:\n" + reqs.map((r) => `- ${r}`).join("\n") : "", ...(taskType === "saq" ? parts.map((p) => `(${str(p.label)}) ${str(p.prompt)}${typeof p.points === "number" ? ` [${p.points} pt]` : ""}`) : [])].filter((x) => x.trim()).join("\n\n");
  if (!task.trim()) return null;
  const sources = arr(u.sources).map((s) => ({ id: str(s.id), title: str(s.title), body: ushSourceBody(s) })).filter((s) => s.body.trim());
  const rub = isObj(u.rubric) ? u.rubric : {};
  const rubricRows = arr(rub.rows);
  const rowName = new Map(rubricRows.map((r) => [str(r.row_id), str(r.name) || str(r.row_id)]));
  const samples = arr(u.samples).map((s) => {
    const ann = arr(s.annotations).map((a) => `- ${str(a.row_id) ? `[${rowName.get(str(a.row_id)) ?? str(a.row_id)}] ` : ""}${str(a.quote) ? `"${clipTo(str(a.quote), 160)}" ` : ""}${str(a.comment)}`.trim());
    const rs = isObj(s.rubric_scores) ? s.rubric_scores : null;
    const earned = rs ? "Rubric points this sample earned: " + Object.entries(rs).filter(([, v]) => typeof v === "number").map(([k, v]) => `${rowName.get(k) ?? k} ${v}`).join(", ") : "";
    return { tier: str(s.tier), text: str(s.essay), note: clipTo([earned, ...ann].filter(Boolean).join("\n"), 1500) };
  });
  const notes = [
    ...rubricRows.map((r) => {
      const d = isObj(r.descriptors) ? Object.entries(r.descriptors).map(([k, v]) => `${k}: ${str(v)}`).join("; ") : "";
      return `${str(r.name) || str(r.row_id)} (0-${typeof r.max === "number" ? r.max : "?"}): ${[str(r.task_specific), d].filter(Boolean).join(" | ")}`;
    }),
    isObj(u.expected_features) ? "Expected features: " + JSON.stringify(u.expected_features) : "",
  ].filter(Boolean).join("\n");
  return { task, parts: [], sources, samples, rubricId: "ushistory-v1", taskType, scoringNotes: clipTo(notes, 4000) };
}

/** payload(el_frq: prompt·sources[{id,title,body}]·samples[{tier,essay,annotations}]; parts[{label,prompt}]) → context.ts 가 읽는 모양. */
export function toEssayPayload(payload: unknown): unknown | null {
  if (isObj(payload) && isObj(payload.ush_frq)) return ushToEssayPayload(payload.ush_frq, payload.schema_version);
  if (!isObj(payload) || !isObj(payload.el_frq)) return null;
  const el = payload.el_frq;
  const parts = (Array.isArray(payload.parts) ? payload.parts.filter(isObj) : []).map((p) => ({ label: str(p.label), prompt: str(p.prompt) || str(el.prompt) }));
  const samples = (Array.isArray(el.samples) ? el.samples.filter(isObj) : []).map((s) => ({ tier: str(s.tier), text: str(s.essay) || str(s.text), note: s.annotations == null ? "" : typeof s.annotations === "string" ? s.annotations : JSON.stringify(s.annotations).slice(0, 600) }));
  const sources = (Array.isArray(el.sources) ? el.sources.filter(isObj) : []).map((s) => ({ id: str(s.id), title: str(s.title), body: str(s.body) }));
  return { task: str(el.prompt), parts, sources, samples };
}

export async function loadEssayPayload(admin: ReturnType<typeof createAdminClient>, problemId: string): Promise<unknown | null> {
  const { data, error } = await admin.from("ap_stock_current_v").select("payload").eq("problem_id", problemId).eq("is_current", true).limit(1).maybeSingle();
  if (error || !data) return null;
  return toEssayPayload((data as { payload: unknown }).payload);
}
