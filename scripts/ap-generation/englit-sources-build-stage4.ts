// Stage 4 출처 등록부 추가(2026-10-22, LT4 단편 묶음 보강): 기존 항목은 그대로 두고 새 항목만 추가한다. 사용: RAW_DIR=<원문 폴더> npx tsx scripts/ap-generation/englit-sources-build-stage4.ts
// RAW_DIR 에는 gutenberg.org 의 pg416.txt(Winesburg, Ohio)가 있어야 한다. 원문은 저장소에 커밋하지 않고 sha256 만 남긴다.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { extractDrama, extractParagraphs, extractPoem, serializeText, sha256, stripUnderscoreItalics, validateEntry, wordCount, type Registry, type SourceEntry } from "../../lib/ap-generation/englit-sources";

const RAW = process.env.RAW_DIR ?? ""; if (!RAW) { console.error("RAW_DIR 필요"); process.exit(1); }
const OUT = path.resolve("data/ap/englit-sources"); mkdirSync(path.join(OUT, "texts"), { recursive: true });
const PD_US = (why: string) => `United States public domain: ${why}. The repository states the eBook is not protected by U.S. copyright; the text is reproduced without the repository's trademark or license header.`;
type Spec = { id: string; ebook: number; title: string; author: string; genre: SourceEntry["genre"]; form: SourceEntry["form"]; year: number; edition: string; period: string; region: string; perspective: string; from: number; to: number; unit: SourceEntry["excerpt"]["unit"]; whole: boolean; note: string; reuse: string; mods: string[] };
const SPECS: Spec[] = [
  { id: "anderson-hands", ebook: 416, title: "Hands (opening)", author: "Sherwood Anderson", genre: "short_fiction", form: "prose", year: 1919, edition: "Winesburg, Ohio (New York: B. W. Huebsch, 1919), as in Gutenberg eBook #416. The file may include an introduction and other tales; only the opening of the story \"Hands\" is used. The exact printing is UNVERIFIED.", period: "Early 20th century (American, 1919)", region: "United States (a small Ohio town)", perspective: "Third-person narrator describing a man living apart on the edge of a small town", from: 517, to: 579, unit: "paragraph", whole: false, note: "Story paragraphs 1-6 (about 690 words), from 'Upon the half decayed veranda of a small frame house' to the paragraph that begins 'When he talked to George Willard'; title omitted.", reuse: PD_US("story published 1916-1919; author died 1941"), mods: ["Repository hard-wrap rejoined into paragraphs.", "Removed italic underscore markup.", "Title omitted."] },
];
const regPath = path.join(OUT, "registry.json"); const reg = JSON.parse(readFileSync(regPath, "utf-8")) as Registry; const fails: string[] = [];
for (const s of SPECS) {
  const file = `pg${s.ebook}.txt`; const raw = readFileSync(path.join(RAW, file)); const lines = raw.toString("utf-8").split("\n"); let text: string; let unitCount = 0; let counted = 0;
  if (s.id === "keats-to-autumn") for (let n = s.from; n <= s.to; n++) { const l = lines[n - 1].replace(/\r$/, ""); lines[n - 1] = /^\s*\d\.\s*$/.test(l) ? "" : l.replace(/\s{2,}\d+\s*$/, ""); }
  if (s.form === "poem") { const { stanzas } = extractPoem(lines, s.from, s.to, [], false); text = serializeText(stanzas); unitCount = stanzas.length; counted = stanzas.flat().length; }
  else if (s.form === "drama") { const paras = extractDrama(lines, s.from, s.to).map(stripUnderscoreItalics); text = serializeText(paras); unitCount = paras.length; counted = paras.length; }
  else { const paras = extractParagraphs(lines, s.from, s.to).map(stripUnderscoreItalics); text = serializeText(paras); unitCount = paras.length; counted = paras.length; }
  const entry: SourceEntry = { id: s.id, title: s.title, author: s.author, genre: s.genre, form: s.form, year_first_published: s.year, edition: s.edition, period: s.period, region: s.region, perspective: s.perspective, repository: "Project Gutenberg (gutenberg.org)", url: `https://www.gutenberg.org/ebooks/${s.ebook}`, retrieved: "2026-10-22", raw_sha256: sha256(raw), raw_bytes: raw.length, raw_line_range: [s.from, s.to], reuse_basis: s.reuse, excerpt: { unit: s.unit, from: 1, to: s.form === "poem" ? counted : unitCount, whole_work: s.whole, note: s.note }, modifications: s.mods, text_file: `texts/${s.id}.txt`, text_sha256: sha256(text), word_count: wordCount(text), counted_line_count: counted, unit_count: unitCount };
  writeFileSync(path.join(OUT, entry.text_file), text); const i = reg.entries.findIndex((e) => e.id === s.id); if (i >= 0) reg.entries[i] = entry; else reg.entries.push(entry);
  const v = validateEntry(entry, text); if (v.length) fails.push(`${s.id}: ${v.join(",")}`);
  console.log(`${s.id}: ${s.form} ${unitCount} units, ${counted} counted lines, ${entry.word_count} words, raw ${entry.raw_bytes}B sha ${entry.raw_sha256.slice(0, 10)}…`);
}
writeFileSync(regPath, JSON.stringify(reg, null, 1) + "\n");
if (fails.length) { console.error("검증 실패:\n" + fails.join("\n")); process.exit(1); }
