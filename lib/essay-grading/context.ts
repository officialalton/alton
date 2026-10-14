import type { Anchor } from "./prompt";

// 문항 stock JSON(payload) → 채점 맥락. 형식은 docs/ap/englang-groundwork.md §3 의 제안: payload.task|parts[].prompt, payload.sources[{id,title,body}], payload.samples[{tier,text,note}].
// English FRQ 문항이 아직 생성되기 전이라 실제 저장 위치(problems 의 어느 열)는 문항 생성 단계에서 확정된다 — 로더는 actions.ts 에서 주입한다.
export type EssayContext = { taskPrompt: string; sources: { id: string; title?: string; body: string }[]; anchors: Anchor[] };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");

export function parseEssayContext(payload: unknown, partLabel: string): EssayContext | null {
  if (!isObj(payload)) return null;
  const parts = Array.isArray(payload.parts) ? payload.parts.filter(isObj) : [];
  const part = parts.find((p) => str(p.label) === partLabel);
  const taskPrompt = str(part?.prompt) || str(payload.task);
  if (!taskPrompt.trim()) return null;
  const sources = (Array.isArray(payload.sources) ? payload.sources.filter(isObj) : [])
    .map((s) => ({ id: str(s.id) || "?", title: str(s.title) || undefined, body: str(s.body) })).filter((s) => s.body.trim());
  const anchors = (Array.isArray(payload.samples) ? payload.samples.filter(isObj) : [])
    .map((s) => ({ tier: str(s.tier) as Anchor["tier"], text: str(s.text), note: str(s.note) || undefined }))
    .filter((a) => (a.tier === "high" || a.tier === "mid" || a.tier === "low") && a.text.trim());
  return { taskPrompt, sources, anchors };
}
