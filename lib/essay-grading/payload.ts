import type { createAdminClient } from "@/lib/supabase-admin";

/** 문항의 stock JSON(payload) 로더 — AP English FRQ(ap_stock_current_v.payload.el_frq)를 채점 맥락 형식(context.ts)으로 옮긴다.
 *  현재 버전 행(is_current)만, 변환된 problem_id 로만 찾는다. 없거나 모양이 다르면 null → actions 가 앵커 샘플 부족으로 채점을 건너뛴다
 *  (점수 신뢰도를 보증할 수 없으면 채점하지 않는 안전 기본값). */
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** payload(el_frq: prompt·sources[{id,title,body}]·samples[{tier,essay,annotations}]; parts[{label,prompt}]) → context.ts 가 읽는 모양. */
export function toEssayPayload(payload: unknown): unknown | null {
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
