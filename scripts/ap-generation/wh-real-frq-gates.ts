// World History 실제 자료 FRQ(SAQ·DBQ·LEQ) 레코드 게이트: 학생 화면 문안·그림 칸·참고 답안 표지가 레지스트리에서 코드로 만든 것과 같은지 점검한다.
import { whFrqIntro, whFrqStimulus, REAL_LABEL } from "../../lib/ap-generation/wh-frq";
import type { WhRegistrySource } from "../../lib/ap-generation/wh-real-gates";
import type { WhFrqSpec } from "../../lib/ap-generation/wh-plan";
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export function whRealFrqViolations(payload: Json, reg: Map<string, WhRegistrySource>, spec: WhFrqSpec): string[] {
  const v: string[] = []; const intro = String(payload.set_intro ?? "");
  if (!payload.whap_frq) return ["no_whap_frq"];
  if (/ALTON-composed/i.test(intro)) v.push("real_set_marked_alton_composed");
  if (intro !== whFrqIntro(spec, reg)) v.push("set_intro_differs_from_generated_passage");
  if (JSON.stringify(payload.stimulus ?? null) !== JSON.stringify(whFrqStimulus(spec, reg) ?? null)) v.push("stimulus_differs_from_registry");
  for (const r of spec.sources) { const e = reg.get(r.id); if (!e) { v.push(`unknown_source_${r.id}`); continue; } if (e.excerpt_segments) for (const seg of e.excerpt_segments) if (!intro.includes(seg)) v.push(`${r.id}:excerpt_not_verbatim_in_set_intro`); if (!intro.includes(e.author) || !intro.includes(e.repository) || !intro.includes(r.context)) v.push(`${r.id}:author_repository_or_context_not_shown`); }
  if (!String(payload.reference_text ?? "").includes(REAL_LABEL)) v.push("reference_text_label_missing");
  return v;
}
