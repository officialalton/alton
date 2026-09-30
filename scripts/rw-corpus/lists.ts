// 다운로드 목록(list.jsonl) 생성 — 순수 함수(네트워크·파일 없음). 상한(파일 수·용량)을 여기서 적용한다.
// 행 형식은 collect.ts 의 Row 와 같다. 원문 문장은 다루지 않는다(메타와 URL 뿐).
export type Row = {
  sourceId: string;
  method?: "http" | "rsync";
  url?: string; // http
  rsyncSource?: string; // rsync (공식 미러 모듈 경로, 끝에 /)
  relPath: string; // storageRoot 기준 상대 경로(rsync 는 디렉터리)
  attribution?: string | null;
  author?: string | null;
  work?: string;
  publishedYear?: number | null;
  authorDeathYear?: number | null;
  isTranslation?: boolean;
  estMB?: number;
};
export type Caps = { maxFiles: number; maxMB: number };

/** 카탈로그 선별 결과(gutenberg_select.py 출력) 한 건. */
export type Selected = { id: number; title: string; author: string; birth: number; death: number; locc: string; issued: string; group?: string };

/** Gutenberg 책 번호 → 공식 미러의 계층 경로(12345 → 1/2/3/4/12345, 123 → 1/2/123, 12 → 1/12). 번호 < 10 은 지원하지 않는다(선별이 id>=100 만 고른다). */
export function gutenbergPath(id: number): string {
  if (!Number.isInteger(id) || id < 10) throw new Error(`지원하지 않는 Gutenberg 번호: ${id}`);
  const s = String(id);
  return `${s.slice(0, -1).split("").join("/")}/${s}`;
}

export function applyCaps<T extends { estMB?: number }>(rows: T[], caps: Caps, defaultMB: number): { kept: T[]; dropped: number; estMB: number } {
  const kept: T[] = [];
  let mb = 0;
  for (const r of rows) {
    const e = r.estMB ?? defaultMB;
    if (kept.length >= caps.maxFiles || mb + e > caps.maxMB) break;
    kept.push(r);
    mb += e;
  }
  return { kept, dropped: rows.length - kept.length, estMB: Math.round(mb * 10) / 10 };
}

export function gutenbergRows(selected: Selected[], caps: Caps = { maxFiles: 165, maxMB: 100 }): { rows: Row[]; dropped: number; estMB: number } {
  const all: Row[] = selected.map((s) => ({
    sourceId: "gutenberg", method: "rsync",
    rsyncSource: `rsync.ibiblio.org::gutenberg/${gutenbergPath(s.id)}/`,
    relPath: `gutenberg/raw/${s.id}`,
    author: s.author, work: s.title, publishedYear: null, authorDeathYear: s.death, isTranslation: false, attribution: null, estMB: 0.65,
  }));
  const { kept, dropped, estMB } = applyCaps(all, caps, 0.65);
  return { rows: kept, dropped, estMB };
}

/** MedlinePlus 공식 XML(하루 1개 파일, 약 30MB). 날짜는 호출부가 정한다(최근 영업일). */
export function medlineRows(date: string, caps: Caps = { maxFiles: 1, maxMB: 35 }): { rows: Row[]; dropped: number; estMB: number } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`날짜 형식 오류: ${date}`);
  const all: Row[] = [{ sourceId: "medlineplus", method: "http", url: `https://medlineplus.gov/xml/mplus_topics_${date}.xml`, relPath: `medlineplus/raw/mplus_topics_${date}.xml`, attribution: "Courtesy of MedlinePlus from the National Library of Medicine", estMB: 30 }];
  const { kept, dropped, estMB } = applyCaps(all, caps, 30);
  return { rows: kept, dropped, estMB };
}

export const PLOS_JOURNALS = ["PLOS Biology", "PLOS ONE", "PLOS Genetics", "PLOS Pathogens", "PLOS Computational Biology"];
/** PLOS Search API 페이지 목록(요청당 rows ≤ 100, 공식 한도 안: 동시 1·7초 간격은 collect 가 지킨다). */
export function plosRows(maxDocs = 2000, caps: Caps = { maxFiles: 20, maxMB: 15 }): { rows: Row[]; dropped: number; estMB: number } {
  const rowsPer = 100;
  const pages = Math.ceil(maxDocs / rowsPer);
  const journalQ = PLOS_JOURNALS.map((j) => `journal:"${j}"`).join(" OR ");
  const q = `(${journalQ}) AND article_type:"Research Article" AND publication_date:[2016-01-01T00:00:00Z TO 2025-12-31T23:59:59Z]`;
  const all: Row[] = [];
  for (let p = 0; p < pages; p++) {
    const params = new URLSearchParams({ q, fl: "id,title,author_display,journal,publication_date,abstract", rows: String(rowsPer), start: String(p * rowsPer), wt: "json", sort: "id asc" });
    all.push({ sourceId: "plos", method: "http", url: `https://api.plos.org/search?${params.toString()}`, relPath: `plos/raw/page-${String(p).padStart(3, "0")}.json`, attribution: "PLOS (CC BY)", estMB: 0.6 });
  }
  const { kept, dropped, estMB } = applyCaps(all, caps, 0.6);
  return { rows: kept, dropped, estMB };
}
export const toJsonl = (rows: Row[]) => rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
