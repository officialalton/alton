// US History 실제 자료 SAQ(2026-10-21, US3 전환): SAQ1(2차 텍스트 둘) · SAQ2(1차 텍스트) · SAQ3(이미지)를 레지스트리(data/ap/ush-sources/registry.json)의 실제 자료로 채운 레코드의 표시문·게이트.
// 규칙: 자료를 먼저 고정 → 질문·허용 답안·루브릭은 그 자료에서 만든다. 학생 화면 본문(set_intro)은 realSaqPassage 가 레지스트리에서 코드로 만든다(손으로 옮기지 않음).
import { frqViolations, type UshFrqPayload } from "./ushistory-frq";
import type { UshSource } from "./ushistory-gates";
import type { RegistrySource } from "./ush-real-gates";
import { US_REAL_SOURCE_MARKER } from "../ap-exam/stimulus-display";

type Json = Record<string, unknown>;
const TYPE_LABEL: Record<string, string> = { primary_text: "primary source", secondary_text: "secondary source", political_cartoon: "political cartoon", photograph: "photograph", map: "map", print: "print", statistic_table: "table" };
export const KIND_FOR_SAQ: Record<string, UshSource["kind"]> = { primary_text: "primary_text", secondary_text: "secondary_text", statistic_table: "table", political_cartoon: "image", photograph: "image", map: "image", print: "image" };
export const saqCredit = (s: RegistrySource) => `${s.author}, ${s.year}. ${s.repository}. Reuse: ${s.reuse_basis}. ${s.modified}.`;
export const REAL_SAQ_LABEL = "ALTON practice rubric, not official College Board scoring";
const letter = (i: number) => String.fromCharCode(65 + i);

/** 자료 하나의 학생 표시 블록. label 은 자료가 둘 이상일 때만("Source A"). context 는 ALTON 이 쓴 한 줄(사실만). */
export function realSaqBlock(label: string | null, s: RegistrySource, context: string): string {
  const head = `${label ? `${label} ` : ""}(${TYPE_LABEL[s.type] ?? s.type})\n${s.title}\n${saqCredit(s)}\nContext: ${context}`;
  if (s.excerpt_segments) return `${head}\n\n"${s.excerpt_segments.join(" [...] ")}"`;
  return `${head}\n\nThe ${s.type === "photograph" ? "photograph" : "image"} for this source appears below. Select the image to open it full size.`;
}
export function realSaqPassage(order: { id: string; context: string }[], reg: Map<string, RegistrySource>): string {
  const multi = order.length > 1;
  const note = "These sources are real historical sources (excerpts are cut verbatim from the repository text, with any OCR corrections listed in the credit line; [...] marks an omission).";
  return `${US_REAL_SOURCE_MARKER}\n${note}\n\n${order.map((o, i) => realSaqBlock(multi ? `Source ${letter(i)}` : null, reg.get(o.id)!, o.context)).join("\n\n———\n\n")}`;
}
/** 그림 칸: 이미지 자료가 있으면 정적 이미지, 없으면 없음(텍스트 SAQ). */
export function realSaqStimulus(order: { id: string }[], reg: Map<string, RegistrySource>): Json | undefined {
  const s = order.map((o) => reg.get(o.id)!).find((x) => x.public_path); if (!s) return undefined;
  return { kind: "image", description: s.alt, data: { path: s.public_path, alt: s.alt, credit: s.credit } };
}

/** 실제 SAQ payload 점검: 레지스트리 대조 + 표시문·그림 칸 = 코드로 만든 것 + 공통 FRQ 게이트(ALTON 작성 출처 표지·가공 출처 규칙 제외). */
export function realSaqViolations(payload: Json, reg: Map<string, RegistrySource>, order: { id: string; context: string }[]): string[] {
  const v: string[] = []; const u = payload.ush_frq as UshFrqPayload | undefined; const intro = String(payload.set_intro ?? "");
  if (!u) return ["no_ush_frq"];
  if (/ALTON-composed/i.test(intro)) v.push("real_set_marked_alton_composed");
  if (!intro.startsWith(`${US_REAL_SOURCE_MARKER}\n`)) v.push("real_marker_missing");
  const srcs = u.sources ?? []; if (srcs.length !== order.length) v.push(`sources_${srcs.length}_not_${order.length}`);
  for (const [i, s] of srcs.entries()) {
    const r = reg.get(String(s.source_registry_id)); const t = `src${s.id}`; if (!r) { v.push(`${t}:unknown_source_${String(s.source_registry_id)}`); continue; }
    if (s.id !== letter(i)) v.push(`${t}:id_not_${letter(i)}`);
    if (s.source_registry_id !== order[i]?.id) v.push(`${t}:order_differs`);
    if (s.real_data !== true) v.push(`${t}:real_data_flag`); if (s.source_sha256 !== r.sha256) v.push(`${t}:sha_not_pinned`);
    if (s.provenance?.kind !== "real_historical_source") v.push(`${t}:provenance_kind`);
    if (KIND_FOR_SAQ[r.type] !== s.kind) v.push(`${t}:kind_${s.kind}_vs_registry_${r.type}`);
    if (s.title !== r.title) v.push(`${t}:title_differs_from_registry`);
    if (s.attribution !== saqCredit(r)) v.push(`${t}:attribution_differs_from_registry`);
    if (!intro.includes(r.author) || !intro.includes(r.repository)) v.push(`${t}:author_or_repository_not_shown`);
    if (r.excerpt_segments) { if (s.body !== r.excerpt_segments.join(" [...] ")) v.push(`${t}:body_not_verbatim_registry_excerpt`); for (const seg of r.excerpt_segments) if (!intro.includes(seg)) v.push(`${t}:excerpt_not_verbatim_in_set_intro`); }
    else if (r.public_path) { if (s.image?.path !== r.public_path) v.push(`${t}:image_path_differs`); if (s.image?.alt !== r.alt) v.push(`${t}:alt_differs`); if (s.image?.credit !== r.credit) v.push(`${t}:credit_differs`); }
  }
  if (order.every((o) => reg.has(o.id))) {
    if (intro !== realSaqPassage(order, reg)) v.push("set_intro_differs_from_generated_passage");
    if (JSON.stringify(payload.stimulus ?? null) !== JSON.stringify(realSaqStimulus(order, reg) ?? null)) v.push("stimulus_differs_from_registry");
  }
  if (!u.rubric.scoring_notes.length) v.push("scoring_notes_missing");
  if (!String(payload.reference_text ?? "").includes(REAL_SAQ_LABEL)) v.push("reference_text_label_missing");
  const skip = /not_marked_alton_composed|real_person/;
  v.push(...frqViolations(u).filter((x) => !skip.test(x)));
  return v;
}
