// US History 실제 자료 게이트(2026-10-15): 자료 레지스트리(data/ap/ush-sources/registry.json)를 먼저 고정하고, 문항은 그 자료에서만 나와야 한다.
// 점검: 레지스트리 필수 필드·파일 해시·발췌 해시 / 문항의 자료가 레지스트리와 글자 그대로 같은지 / "ALTON 작성" 표지가 실제 자료에 붙지 않았는지 / 문항 공통 게이트(itemViolations).
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "./data-fs";
import path from "node:path";
import { itemViolations, type UshItemRaw, type UshSetRaw } from "./ushistory-gates";
import { frqViolations, type UshFrqPayload } from "./ushistory-frq";

export type RegistrySource = {
  id: string; type: string; title: string; author: string; year: string; repository: string; url: string; call_number: string; rights_statement: string; reuse_basis: string; modified: string; retrieved: string; origin: string; sha256: string;
  excerpt_segments?: string[]; table?: { columns: string[]; rows: string[][] }; file?: string; public_path?: string; bytes?: number; alt?: string; credit?: string;
};
export const sha256 = (b: string | Buffer) => createHash("sha256").update(b).digest("hex");
const REQUIRED = ["id", "type", "title", "author", "year", "repository", "url", "rights_statement", "reuse_basis", "modified", "retrieved", "sha256"] as const;

export function registryViolations(sources: RegistrySource[], root = "data/ap/ush-sources"): string[] {
  const v: string[] = []; const ids = new Set<string>();
  for (const s of sources) {
    if (ids.has(s.id)) v.push(`${s.id}:duplicate_id`); ids.add(s.id);
    for (const k of REQUIRED) if (!String((s as unknown as Record<string, unknown>)[k] ?? "").trim()) v.push(`${s.id}:missing_${k}`);
    if (s.origin !== "real_historical_source") v.push(`${s.id}:origin`);
    if (!/^https:\/\/(www\.)?(loc\.gov|archives\.gov|census\.gov|avalon\.law\.yale\.edu|gutenberg\.org|commons\.wikimedia\.org)\//.test(s.url)) v.push(`${s.id}:url_not_allowed_repository`);
    if (s.excerpt_segments) { const joined = s.excerpt_segments.join(" [...] "); if (sha256(joined) !== s.sha256) v.push(`${s.id}:excerpt_hash_mismatch`); }
    else if (s.table) { if (sha256(JSON.stringify(sortKeys(s.table))) !== s.sha256) v.push(`${s.id}:table_hash_mismatch`); }
    else if (s.file) { const f = path.join(root, s.file); if (!existsSync(f)) v.push(`${s.id}:file_missing`); else { const b = readFileSync(f); if (sha256(b) !== s.sha256) v.push(`${s.id}:file_hash_mismatch`); if (s.bytes !== b.length) v.push(`${s.id}:bytes_mismatch`); if (!/\.(jpg|jpeg|png|svg)$/.test(s.file)) v.push(`${s.id}:file_type`); if (b.length > 1_500_000) v.push(`${s.id}:file_too_large`); } if (!s.alt || !s.credit) v.push(`${s.id}:alt_or_credit_missing`); }
    else v.push(`${s.id}:no_content`);
  }
  return v;
}
function sortKeys(o: unknown): unknown { if (Array.isArray(o)) return o.map(sortKeys); if (o && typeof o === "object") return Object.fromEntries(Object.keys(o as object).sort().map((k) => [k, sortKeys((o as Record<string, unknown>)[k])])); return o; }

type Json = Record<string, unknown>;
/** 실제 자료 MC 세트 점검(레지스트리 대조 + 공통 문항 게이트). */
export function realSetViolations(payload: Json, reg: Map<string, RegistrySource>): string[] {
  const v: string[] = []; const us = payload.ush_set as Json | undefined; const intro = String(payload.set_intro ?? "");
  if (!us) return ["no_ush_set"];
  if (/ALTON-composed/i.test(intro)) v.push("real_set_marked_alton_composed");
  if (!intro.startsWith("Historical source (real document)\n")) v.push("real_marker_missing");
  const sources = (us.sources as Json[]) ?? [];
  for (const s of sources) {
    const r = reg.get(String(s.source_registry_id)); if (!r) { v.push(`unknown_source_${String(s.source_registry_id)}`); continue; }
    if (s.real_data !== true) v.push(`${r.id}:real_data_flag`); if (s.source_sha256 !== r.sha256) v.push(`${r.id}:sha_not_pinned`);
    if (r.excerpt_segments) for (const seg of r.excerpt_segments) if (!intro.includes(seg)) v.push(`${r.id}:excerpt_not_verbatim_in_set_intro`);
    if (r.table) { const d = ((payload.stimulus as Json | undefined)?.data as { rows?: string[][]; columns?: string[] } | undefined); if (JSON.stringify(d?.rows) !== JSON.stringify(r.table.rows) || JSON.stringify(d?.columns) !== JSON.stringify(r.table.columns)) v.push(`${r.id}:table_differs_from_registry`); }
    if (r.public_path) { const d = ((payload.stimulus as Json | undefined)?.data as { path?: string; credit?: string } | undefined); if (d?.path !== r.public_path) v.push(`${r.id}:image_path_differs`); if (d?.credit !== r.credit) v.push(`${r.id}:credit_differs`); }
    if (!intro.includes(r.author) || !intro.includes(r.repository)) v.push(`${r.id}:author_or_repository_not_shown`);
  }
  const items = (payload.items as Json[]) ?? [];
  if (items.length < 3 || items.length > 4) v.push(`items_${items.length}`);
  const set = { period: Number(us.period), stim_type: String(us.stim_type), theme: String(us.theme), title: String(us.title), sources: sources.flatMap((s) => { const r = reg.get(String(s.source_registry_id)); return [{ id: String(s.id), kind: String(s.kind) as never, title: String(s.title), attribution: String(s.attribution), ...(r?.table ? { table: r.table as never } : {}), body: r?.excerpt_segments?.join(" ") ?? "", provenance: { kind: "alton_composed", note: "real source" } as never }]; }), items: [] } as UshSetRaw;
  for (const [i, it] of items.entries()) {
    const raw: UshItemRaw = { skill: String(it.skill), topic: String(it.topic), stem: String(it.stem), options: (it.options as Json[]).map((o, j) => ({ text: String(o.text), is_key: j === it.key_index, label: String(o.label), why: String(o.why) })), facts: (it.facts as string[]) ?? [], est_seconds: Number(it.est_seconds ?? 75) };
    for (const x of itemViolations(set, raw)) v.push(`item${i + 1}:${x}`);
    const d = it.design as Json | undefined; if (!d || d.source_fixed_first !== true || !String(d.key_evidence_in_source ?? "").trim()) v.push(`item${i + 1}:design_evidence_missing`);
  }
  return v;
}

/** 실제 자료 SAQ(비텍스트) 점검: 자료가 레지스트리와 글자 그대로 같은지 + ALTON 작성 표지 금지 + FRQ 공통 게이트(ALTON 작성 출처 표지·가공 출처 규칙만 제외). */
export function realFrqViolations(payload: Json, reg: Map<string, RegistrySource>): string[] {
  const v: string[] = []; const u = payload.ush_frq as Json | undefined; const intro = String(payload.set_intro ?? "");
  if (!u) return ["no_ush_frq"];
  if (/ALTON-composed/i.test(intro)) v.push("real_set_marked_alton_composed");
  if (!intro.startsWith("Historical source (real document)\n")) v.push("real_marker_missing");
  const sources = (u.sources as Json[]) ?? [];
  if (sources.length !== 1) v.push(`sources_${sources.length}_not_1`);
  for (const s of sources) {
    const r = reg.get(String(s.source_registry_id)); if (!r) { v.push(`unknown_source_${String(s.source_registry_id)}`); continue; }
    if (s.real_data !== true) v.push(`${r.id}:real_data_flag`); if (s.source_sha256 !== r.sha256) v.push(`${r.id}:sha_not_pinned`);
    if (r.table) {
      const t = s.table as { rows?: string[][]; columns?: string[] } | undefined; const d = ((payload.stimulus as Json | undefined)?.data as { rows?: string[][]; columns?: string[] } | undefined);
      for (const x of [t, d]) if (JSON.stringify(x?.rows) !== JSON.stringify(r.table.rows) || JSON.stringify(x?.columns) !== JSON.stringify(r.table.columns)) v.push(`${r.id}:table_differs_from_registry`);
    }
    if (!intro.includes(r.author) || !intro.includes(r.repository)) v.push(`${r.id}:author_or_repository_not_shown`);
  }
  v.push(...frqViolations(u as unknown as UshFrqPayload).filter((x) => !/not_marked_alton_composed/.test(x)));
  return v;
}
