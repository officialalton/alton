// World History 실제 자료 게이트(2026-10-15): 자료 레지스트리(data/ap/wh-sources/registry.json)를 먼저 고정하고 문항·FRQ 는 그 자료에서만 나와야 한다.
// 점검: 레지스트리 필수 필드·해시·허용 저장소 / 학생 화면 문안이 레지스트리 발췌와 글자 그대로 같은지 / 'ALTON 작성' 표지가 실제 자료에 붙지 않았는지 / 문항 공통 게이트.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { itemViolations, tableMarkdown, type UshItemRaw, type UshSetRaw, type UshSource } from "./ushistory-gates";
import { sha256, type RegistrySource } from "./ush-real-gates";
import { WH_SOURCE_MARKER } from "./subjects/worldhistory";
import { whUnitOfTopic } from "../ap-exam/wh-rules";
import type { WhSetSpec } from "./wh-plan";

export type WhRegistrySource = RegistrySource & { region?: string; unit?: string; width?: number; height?: number; notes?: string };
const REQUIRED = ["id", "type", "title", "author", "year", "repository", "url", "rights_statement", "reuse_basis", "modified", "retrieved", "sha256"] as const;
const ALLOWED_URL = /^https:\/\/(www\.)?(loc\.gov|archives\.gov|nara\.gov|census\.gov|avalon\.law\.yale\.edu|gutenberg\.org|en\.wikisource\.org|commons\.wikimedia\.org|upload\.wikimedia\.org|si\.edu|archive\.org)\//;
export const WH_REGISTRY_PATH = "data/ap/wh-sources/registry.json";
export const loadWhRegistry = (p = WH_REGISTRY_PATH): WhRegistrySource[] => (JSON.parse(readFileSync(p, "utf-8")) as { sources: WhRegistrySource[] }).sources;
function sortKeys(o: unknown): unknown { if (Array.isArray(o)) return o.map(sortKeys); if (o && typeof o === "object") return Object.fromEntries(Object.keys(o as object).sort().map((k) => [k, sortKeys((o as Record<string, unknown>)[k])])); return o; }

export function whRegistryViolations(sources: WhRegistrySource[], root = "data/ap/wh-sources"): string[] {
  const v: string[] = []; const ids = new Set<string>();
  for (const s of sources) {
    if (ids.has(s.id)) v.push(`${s.id}:duplicate_id`); ids.add(s.id);
    for (const k of REQUIRED) if (!String((s as unknown as Record<string, unknown>)[k] ?? "").trim()) v.push(`${s.id}:missing_${k}`);
    if (s.origin !== "real_historical_source") v.push(`${s.id}:origin`);
    if (!ALLOWED_URL.test(s.url)) v.push(`${s.id}:url_not_allowed_repository`);
    if (s.excerpt_segments) { if (sha256(s.excerpt_segments.join(" [...] ")) !== s.sha256) v.push(`${s.id}:excerpt_hash_mismatch`); if (s.excerpt_segments.some((x) => /[_]|\[\d+\]|\{\{|\}\}|\[\[/.test(x))) v.push(`${s.id}:markup_in_excerpt`); }
    else if (s.table) { if (sha256(JSON.stringify(sortKeys(s.table))) !== s.sha256) v.push(`${s.id}:table_hash_mismatch`); }
    else if (s.file) { const f = path.join(root, s.file); if (!existsSync(f)) v.push(`${s.id}:file_missing`); else { const b = readFileSync(f); if (sha256(b) !== s.sha256) v.push(`${s.id}:file_hash_mismatch`); if (s.bytes !== b.length) v.push(`${s.id}:bytes_mismatch`); if (!/\.(jpg|jpeg|png|svg)$/.test(s.file)) v.push(`${s.id}:file_type`); if (b.length > 1_500_000) v.push(`${s.id}:file_too_large`); if (Math.max(s.width ?? 0, s.height ?? 0) > 1600) v.push(`${s.id}:image_dimension_gt_1600`); }
      if (!s.alt || !s.credit) v.push(`${s.id}:alt_or_credit_missing`); if (s.public_path && !existsSync(path.join("public", s.public_path))) v.push(`${s.id}:public_copy_missing`); }
    else v.push(`${s.id}:no_content`);
  }
  return v;
}

export const credit = (s: RegistrySource) => `${s.author}, ${s.year}. ${s.repository}. Reuse: ${s.reuse_basis}. ${s.modified}.`;
export const TYPE_LABEL: Record<string, string> = { primary_text: "primary source", secondary_text: "secondary source", political_cartoon: "political cartoon", photograph: "photograph", map: "map", print: "print", painting: "painting", statistic_table: "table" };
export const KIND_FOR: Record<string, UshSource["kind"]> = { primary_text: "primary_text", secondary_text: "secondary_text", statistic_table: "table", political_cartoon: "image", photograph: "image", map: "image", print: "image", painting: "image" };
export const isImage = (s: RegistrySource) => Boolean(s.public_path);
export const isTable = (s: RegistrySource) => Boolean(s.table);

/** 학생에게 보이는 자료 한 덩어리. label: "Source A"/"Document 3"/null. 이미지·표 자체는 그림 칸에 그려진다. */
export function realBlock(label: string | null, s: RegistrySource, context: string): string {
  const head = `${label ? `${label} ` : ""}(${TYPE_LABEL[s.type] ?? s.type})\n${s.title}\n${credit(s)}\nContext: ${context}`;
  if (s.excerpt_segments) return `${head}\n\n"${s.excerpt_segments.join(" [...] ")}"`;
  if (s.table) return `${head}\n\n${tableMarkdown(s.table)}`;
  return `${head}\n\nThe image for this source is shown below. Select the image to open it full size.`;
}
export function realSetIntro(refs: { id: string; context: string }[], reg: Map<string, RegistrySource>): string {
  const multi = refs.length > 1;
  return `${WH_SOURCE_MARKER}\n` + refs.map((r, i) => realBlock(multi ? `Source ${String.fromCharCode(65 + i)}` : null, reg.get(r.id)!, r.context)).join("\n\n———\n\n");
}
/** 그림 칸(stimulus): 표 자료는 표, 이미지 자료는 정적 이미지(여러 장이면 more). labelFor: 자료 순번(0부터) → 이미지 라벨(기본: 자료가 둘 이상이면 "Source A"…). */
export function realStimulus(refs: { id: string }[], reg: Map<string, RegistrySource>, labelFor?: (i: number) => string | undefined): Record<string, unknown> | undefined {
  const rs = refs.map((r) => reg.get(r.id)!); const lab = labelFor ?? ((i: number) => (rs.length > 1 ? `Source ${String.fromCharCode(65 + i)}` : undefined));
  const imgs = rs.map((s, i) => ({ s, i })).filter((x) => isImage(x.s));
  if (imgs.length) { const L = (i: number) => { const l = lab(i); return l ? { label: l } : {}; }; const [a, ...more] = imgs;
    return { kind: "image", description: imgs.map((x) => x.s.alt).join(" "), data: { path: a.s.public_path, alt: a.s.alt, credit: a.s.credit, ...L(a.i), ...(more.length ? { more: more.map((x) => ({ path: x.s.public_path, alt: x.s.alt, credit: x.s.credit, ...L(x.i) })) } : {}) } }; }
  const t = rs.find(isTable); if (t) return { kind: "table", description: t.title, data: { columns: t.table!.columns, rows: t.table!.rows } };
  return undefined;
}
export function srcEntry(s: RegistrySource, id: string, context: string) {
  return { id, kind: KIND_FOR[s.type], title: s.title, attribution: credit(s), context, real_data: true, source_registry_id: s.id, source_sha256: s.sha256 };
}
/** 문항 게이트용 모양(UshSetRaw 호환): 텍스트는 발췌, 표는 표, 이미지는 alt·제목(그림 존재 처리). */
function shim(spec: Pick<WhSetSpec, "unit" | "stim">, refs: { id: string }[], reg: Map<string, WhRegistrySource>): UshSetRaw {
  const sources: UshSource[] = refs.map((r, i) => { const s = reg.get(r.id)!; const base = { id: String.fromCharCode(65 + i), kind: KIND_FOR[s.type], title: s.title, attribution: credit(s), provenance: { kind: "real_historical_source" as const, note: "real source" } };
    if (s.excerpt_segments) return { ...base, body: s.excerpt_segments.join(" ") }; if (s.table) return { ...base, body: `${s.title} ${s.year}`, table: { columns: s.table.columns, rows: s.table.rows } };
    return { ...base, body: `${s.alt} ${s.title} ${s.year} ${s.credit ?? ""} ${s.notes ?? ""}`, figure: { chart: "bar" as const, title: s.title, categories: ["a", "b", "c"], series: [{ name: "x", values: [1, 2, 3] }], description: s.alt ?? "" } }; });
  return { period: 1, stim_type: spec.stim, theme: "", title: "", sources, items: [] };
}
const norm = (t: string) => t.replace(/[‘’‛]/g, "'").replace(/[“”„]/g, '"').replace(/—|–/g, "-").replace(/\s+/g, " ").trim().toLowerCase();
type Json = Record<string, unknown>;
/** 실제 자료 MC 세트 점검. */
export function whRealSetViolations(payload: Json, reg: Map<string, WhRegistrySource>, spec: WhSetSpec): string[] {
  const v: string[] = []; const ws = payload.wh_set as Json | undefined; const intro = String(payload.set_intro ?? "");
  if (!ws) return ["no_wh_set"];
  if (/ALTON-composed/i.test(intro)) v.push("real_set_marked_alton_composed");
  if (!intro.startsWith(`${WH_SOURCE_MARKER}\n`)) v.push("real_marker_missing");
  if (intro !== realSetIntro(spec.sources, reg)) v.push("set_intro_differs_from_generated_passage");
  const srcs = (ws.sources as Json[]) ?? []; if (srcs.map((s) => s.source_registry_id).join() !== spec.sources.map((s) => s.id).join()) v.push("sources_differ_from_plan");
  for (const r of spec.sources) { const e = reg.get(r.id); if (!e) { v.push(`unknown_source_${r.id}`); continue; } const s = srcs.find((x) => x.source_registry_id === r.id); if (!s || s.source_sha256 !== e.sha256 || s.real_data !== true) v.push(`${r.id}:sha_not_pinned`);
    if (e.excerpt_segments) for (const seg of e.excerpt_segments) if (!intro.includes(seg)) v.push(`${r.id}:excerpt_not_verbatim_in_set_intro`);
    if (!intro.includes(e.author) || !intro.includes(e.repository) || !intro.includes(r.context)) v.push(`${r.id}:author_repository_or_context_not_shown`); }
  const st = payload.stimulus as Json | undefined; const want = realStimulus(spec.sources, reg);
  if (JSON.stringify(st ?? null) !== JSON.stringify(want ?? null)) v.push("stimulus_differs_from_registry");
  const items = (payload.items as Json[]) ?? [];
  if (items.length < 3 || items.length > 4) v.push(`items_${items.length}`);
  for (const [i, it] of items.entries()) { const raw = rawItemOf(it); for (const x of whItemViolations(spec, reg, raw, it.design as Json | undefined)) v.push(`item${i + 1}:${x}`); }
  return v;
}
export const rawItemOf = (it: Json): UshItemRaw => ({ skill: String(it.skill), topic: String(it.topic), stem: String(it.stem), options: ((it.options as Json[]) ?? []).map((o, j) => ({ text: String(o.text), is_key: typeof o.is_key === "boolean" ? o.is_key : j === it.key_index, label: String(o.label), why: String(o.why) })), facts: (it.facts as string[]) ?? [], ...(it.derived ? { derived: it.derived as never } : {}), est_seconds: Number(it.est_seconds ?? 75) });
/** 문항 하나의 결정적 점검(공통 문항 게이트 + 단원 일치 + 설계 근거 + 근거 인용이 자료에 있는지). */
export function whItemViolations(spec: Pick<WhSetSpec, "unit" | "stim" | "sources">, reg: Map<string, WhRegistrySource>, raw: UshItemRaw, design: Json | undefined): string[] {
  const v: string[] = []; const set = shim(spec, spec.sources, reg); const srcText = norm(set.sources.map((s) => `${s.body ?? ""} ${s.table ? `${s.table.columns.join(" ")} ${s.table.rows.map((r) => r.join(" ")).join(" ")}` : ""}`).join(" ") + " " + spec.sources.map((r) => reg.get(r.id)?.notes ?? "").join(" "));
  v.push(...itemViolations(set, raw));
  if (whUnitOfTopic(raw.topic) !== String(spec.unit)) v.push(`topic_${raw.topic}_not_in_unit_${spec.unit}`);
  if (!design || design.source_fixed_first !== true || !String(design.key_evidence_in_source ?? "").trim()) v.push("design_evidence_missing");
  const q = String((design?.evidence_quote as string) ?? "").trim(); if (q && !spec.sources.some((r) => reg.get(r.id)?.table || reg.get(r.id)?.public_path) && !srcText.includes(norm(q.replace(/\s*\[\.\.\.\]\s*/g, " ")))) v.push("evidence_quote_not_in_source");
  return [...new Set(v)];
}
export { sha256 };
