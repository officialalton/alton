// US History Stage B — 실제 자료 DBQ(2026-10-15): 문서 7개를 모두 레지스트리(data/ap/ush-sources/registry.json)의 실제 자료로 채운 DBQ 의 표시문·게이트.
// 규칙: 자료를 먼저 고정 → 그 자료로 프롬프트·논지 공간·증거 지도를 만든다. 학생 화면 본문(set_intro)은 이 파일의 realDbqPassage 가 레지스트리에서 코드로 만든다(손으로 옮기지 않음).
import { frqViolations, type UshFrqPayload } from "./ushistory-frq";
import { realPeopleIn, tableMarkdown, type UshSource } from "./ushistory-gates";
import type { RegistrySource } from "./ush-real-gates";
import { US_REAL_SOURCE_MARKER } from "../ap-exam/stimulus-display";

type Json = Record<string, unknown>;
const TYPE_LABEL: Record<string, string> = { primary_text: "primary source", secondary_text: "secondary source", political_cartoon: "political cartoon", photograph: "photograph", map: "map", print: "print", statistic_table: "table" };
const KIND_FOR: Record<string, UshSource["kind"]> = { primary_text: "primary_text", secondary_text: "secondary_text", statistic_table: "table", political_cartoon: "image", photograph: "image", map: "image", print: "image" };
const credit = (s: RegistrySource) => `${s.author}, ${s.year}. ${s.repository}. Reuse: ${s.reuse_basis}. ${s.modified}.`;
export const REAL_DBQ_LABEL = "ALTON reference — not official AP scoring";

/** 문서 하나의 학생 표시 블록. context 는 ALTON 이 쓴 한 줄(사건·청중; 사실만). */
export function realDbqDocText(n: number, s: RegistrySource, context: string): string {
  const head = `Document ${n} (${TYPE_LABEL[s.type] ?? s.type})\n${s.title}\n${credit(s)}\nContext: ${context}`;
  if (s.excerpt_segments) return `${head}\n\n"${s.excerpt_segments.join(" [...] ")}"`;
  if (s.table) return `${head}\n\n${tableMarkdown(s.table)}`;
  return `${head}\n\nThe image for this document is shown below the documents, labeled Document ${n}. Select the image to open it full size.`;
}
/** set_intro: 표지 한 줄 + 안내 + 문서 7개. 레지스트리가 유일한 원본이라 문서 본문은 발췌 구간·표 그대로다. */
export function realDbqPassage(order: { id: string; context: string }[], reg: Map<string, RegistrySource>, imageDocs: number[]): string {
  const docs = order.map((o, i) => realDbqDocText(i + 1, reg.get(o.id)!, o.context));
  const note = `These documents are real historical sources (excerpts are cut verbatim from the repository text; [...] marks an omission).${imageDocs.length === 1 ? ` Document ${imageDocs[0]} is an image shown below the documents.` : imageDocs.length ? ` Documents ${imageDocs.join(" and ")} are images shown below the documents.` : ""}`;
  return `${US_REAL_SOURCE_MARKER}\n${note}\n\n${docs.join("\n\n———\n\n")}`;
}

/** 실제 DBQ payload(ush_frq + stimulus 이미지 + set_intro) 점검. 레지스트리 대조 + DBQ 구성 + 증거 지도 + 공통 FRQ 게이트(ALTON 작성 표지·가공 출처 규칙 제외). */
export function realDbqViolations(payload: Json, reg: Map<string, RegistrySource>, order: { id: string; context: string }[]): string[] {
  const v: string[] = []; const u = payload.ush_frq as UshFrqPayload | undefined; const intro = String(payload.set_intro ?? "");
  if (!u) return ["no_ush_frq"];
  if (/ALTON-composed/i.test(intro)) v.push("real_set_marked_alton_composed");
  if (!intro.startsWith(`${US_REAL_SOURCE_MARKER}\n`)) v.push("real_marker_missing");
  const srcs = u.sources ?? [];
  if (srcs.length !== 7) v.push(`dbq_documents_${srcs.length}_not_7`);
  if (srcs.map((s) => s.id).join("") !== "1234567") v.push("dbq_ids_not_1_to_7");
  const ids = srcs.map((s) => s.source_registry_id); if (new Set(ids).size !== ids.length) v.push("duplicate_registry_source");
  const imageDocs: number[] = []; const imgs: { path: string; alt: string; credit: string; label: string }[] = [];
  for (const [i, s] of srcs.entries()) {
    const r = reg.get(String(s.source_registry_id)); if (!r) { v.push(`doc${s.id}:unknown_source_${String(s.source_registry_id)}`); continue; }
    const t = `doc${s.id}:${r.id}`;
    if (s.real_data !== true) v.push(`${t}:real_data_flag`); if (s.source_sha256 !== r.sha256) v.push(`${t}:sha_not_pinned`);
    if (s.provenance?.kind !== "real_historical_source") v.push(`${t}:provenance_kind`);
    if (KIND_FOR[r.type] !== s.kind) v.push(`${t}:kind_${s.kind}_vs_registry_${r.type}`);
    if (s.title !== r.title) v.push(`${t}:title_differs_from_registry`);
    if (s.attribution !== credit(r)) v.push(`${t}:attribution_differs_from_registry`);
    if (!intro.includes(r.author) || !intro.includes(r.repository)) v.push(`${t}:author_or_repository_not_shown`);
    if (r.excerpt_segments) {
      if (s.body !== r.excerpt_segments.join(" [...] ")) v.push(`${t}:body_not_verbatim_registry_excerpt`);
      for (const seg of r.excerpt_segments) if (!intro.includes(seg)) v.push(`${t}:excerpt_not_verbatim_in_set_intro`);
    } else if (r.table) {
      if (JSON.stringify(s.table?.rows) !== JSON.stringify(r.table.rows) || JSON.stringify(s.table?.columns) !== JSON.stringify(r.table.columns)) v.push(`${t}:table_differs_from_registry`);
      for (const row of r.table.rows) if (!intro.includes(`| ${row.join(" | ")} |`)) v.push(`${t}:table_row_not_in_set_intro`);
    } else if (r.public_path) {
      imageDocs.push(i + 1);
      if (s.image?.path !== r.public_path) v.push(`${t}:image_path_differs`); if (s.image?.credit !== r.credit) v.push(`${t}:credit_differs`); if (s.image?.alt !== r.alt) v.push(`${t}:alt_differs`);
      if (!s.body?.trim()) v.push(`${t}:image_description_missing`);
      imgs.push({ path: r.public_path, alt: r.alt ?? "", credit: r.credit ?? "", label: `Document ${i + 1}` });
    }
  }
  const kinds = srcs.map((s) => s.kind);
  if (!imageDocs.length) v.push("dbq_no_visual_document"); if (imageDocs.length > 3) v.push("dbq_too_many_images_for_one_figure_panel");
  if (kinds.filter((k) => k === "primary_text" || k === "image").length < 4) v.push("dbq_primary_type_lt_4");
  if (!kinds.some((k) => k === "secondary_text" || k === "table")) v.push("dbq_no_secondary_or_quantitative");
  // 표시문 = 코드로 만든 문안과 같아야 한다.
  if (order.length === 7 && order.every((o) => reg.has(o.id))) { const want = realDbqPassage(order, reg, imageDocs); if (intro !== want) v.push("set_intro_differs_from_generated_passage"); if (order.map((o) => o.id).join() !== ids.join()) v.push("document_order_differs_from_sources"); }
  // 그림 칸: stimulus.kind=image, 이미지 자료 순서대로 main + more.
  const st = payload.stimulus as { kind?: string; data?: { path?: string; label?: string; alt?: string; credit?: string; more?: { path?: string; alt?: string; credit?: string; label?: string }[] } } | undefined;
  if (st?.kind !== "image") v.push("stimulus_not_image");
  else { const all = [{ path: st.data?.path, alt: st.data?.alt, credit: st.data?.credit, label: st.data?.label }, ...(st.data?.more ?? [])]; if (JSON.stringify(all) !== JSON.stringify(imgs.map((x) => ({ path: x.path, alt: x.alt, credit: x.credit, label: x.label })))) v.push("stimulus_images_differ_from_image_documents"); }
  // 증거 지도: 모든 문서가 어떤 논증 줄을 뒷받침하고, 한 줄 이상에서 반론·복합성을 준다.
  const em = u.expected_features?.evidence_map ?? [];
  if (em.length < 3) v.push("evidence_map_lt_3_lines");
  const supported = new Set(em.flatMap((l) => l.supports)); for (const s of srcs) if (!supported.has(s.id)) v.push(`doc${s.id}:supports_no_line_of_reasoning`);
  if (!em.some((l) => l.complicates.length)) v.push("evidence_map_no_complicating_document");
  if (em.some((l) => ![...l.supports, ...l.complicates].every((x) => srcs.some((s) => s.id === x)))) v.push("evidence_map_unknown_doc");
  if (em.some((l) => l.supports.some((x) => l.complicates.includes(x)))) v.push("evidence_map_doc_both_supports_and_complicates");
  const uses = u.expected_features?.doc_uses ?? [];
  for (const s of srcs) { const d = uses.find((x) => x.source_id === s.id); if (!d || !d.usable_for?.trim() || !d.sourcing?.trim()) v.push(`doc${s.id}:doc_use_or_sourcing_missing`); }
  // 루브릭 표지
  if (!u.rubric.scoring_notes.some((n) => n.includes(REAL_DBQ_LABEL))) v.push("rubric_label_missing");
  if (!String(payload.reference_text ?? "").includes(REAL_DBQ_LABEL)) v.push("reference_text_label_missing");
  // 공통 FRQ 게이트: 가공 출처 전용 규칙(ALTON 표지·실존 인물·DBQ 구성)은 실제 자료에 맞지 않아 제외하고 위 전용 점검으로 대체한다.
  const skip = /not_marked_alton_composed|real_person|^dbq_primary_lt_4$|^dbq_no_secondary$|^dbq_no_quantitative$|^dbq_documents_|^dbq_ids_not/;
  v.push(...frqViolations(u).filter((x) => !skip.test(x)));
  void realPeopleIn;
  return v;
}
