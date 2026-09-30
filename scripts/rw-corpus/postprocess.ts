// 수집 후처리(네트워크 없음): 원시 파일 → 항목 단위 텍스트(`items/<원천>/…txt` + `.meta.json`). 원문은 저장소 밖(storageRoot)에만 쓴다.
//  - Gutenberg: *.txt 중 UTF-8(-0) > 일반 > -8 순으로 하나 고르고 Project Gutenberg 머리·꼬리 고지를 제거(상표 문구 본문 제외).
//  - MedlinePlus: 토픽 XML 에서 full-summary(평문화)만 — A.D.A.M.·© 표시가 있는 토픽은 제외, 단어 수 60~400.
//  - PLOS: Search API JSON 의 abstract(120~260단어)만, 출처 표시 메타(저자·제목·DOI).
export function pickGutenbergFile(files: string[], id: string): string | null {
  for (const cand of [`${id}-0.txt`, `${id}.txt`, `${id}-8.txt`]) if (files.includes(cand)) return cand;
  return files.find((f) => f.endsWith(".txt")) ?? null;
}
export function stripGutenberg(text: string): string | null {
  const s = text.search(/\*\*\* ?START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i);
  const e = text.search(/\*\*\* ?END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i);
  if (s < 0 || e < 0 || e <= s) return null; // 머리·꼬리 고지를 못 찾으면 제외(불확실한 본문은 쓰지 않는다)
  const body = text.slice(text.indexOf("\n", s) + 1, e).trim();
  return body.length > 2000 ? body : null;
}
const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&");
const plain = (html: string) => decode(html).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const wc = (s: string) => s.split(/\s+/).filter(Boolean).length;
export type Item = { id: string; title: string; text: string; url?: string; extra?: Record<string, unknown> };
export function medlineItems(xml: string, date: string): Item[] {
  const out: Item[] = [];
  for (const m of xml.matchAll(/<health-topic\s+([^>]*)>([\s\S]*?)<\/health-topic>/g)) {
    const attrs = m[1];
    if (/language="Spanish"/i.test(attrs)) continue;
    const id = /\bid="(\d+)"/.exec(attrs)?.[1], title = /\btitle="([^"]*)"/.exec(attrs)?.[1], url = /\burl="([^"]*)"/.exec(attrs)?.[1];
    const sum = /<full-summary>([\s\S]*?)<\/full-summary>/.exec(m[2])?.[1];
    if (!id || !title || !sum) continue;
    const text = plain(sum);
    if (/A\.D\.A\.M|©|copyright/i.test(text)) continue;
    const w = wc(text);
    if (w < 60 || w > 400) continue;
    out.push({ id: `medlineplus-${id}`, title: decode(title), text, url, extra: { fileDate: date } });
  }
  return out;
}
export function plosItems(json: string): Item[] {
  const out: Item[] = [];
  const docs = (JSON.parse(json) as { response?: { docs?: { id: string; title?: string; author_display?: string[]; journal?: string; publication_date?: string; abstract?: string[] | string }[] } }).response?.docs ?? [];
  for (const d of docs) {
    const a = Array.isArray(d.abstract) ? d.abstract.join(" ") : d.abstract ?? "";
    const text = plain(a);
    const w = wc(text);
    if (w < 120 || w > 260 || !d.id) continue;
    out.push({ id: `plos-${d.id.replace(/[^A-Za-z0-9.]+/g, "_")}`, title: d.title ?? "", text, url: `https://doi.org/${d.id.replace(/^info:doi\//, "")}`, extra: { authors: d.author_display ?? [], journal: d.journal ?? "", publicationDate: d.publication_date ?? "" } });
  }
  return out;
}
