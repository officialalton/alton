// RW 원문 코퍼스 — 출처·발췌 메타 스키마(초안, 2026-10-01). 원문 본문은 저장소 밖(~/Developer/ALTON-data/rw-corpus/)에만 둔다.
export type CorpusLicense = "public_domain_us" | "us_gov_work" | "cc0" | "cc_by" | "cc_by_4.0" | "cc_by_3.0";
/** 코퍼스 원문 한 편(작품·기사)의 메타. 본문은 `textPath`(저장소 밖)에 있다. */
export type SourceText = {
  corpusId: string; // 예: "gutenberg:1234", "elife:12345"
  sourceId: string; // manifest.json 의 원천 id
  author: string | null;
  work: string;
  publishedYear: number | null;
  authorDeathYear: number | null; // 한국 기준(사후 70년) 교차 확인용, 모르면 null(→ 제외 후보)
  language: "en";
  isTranslation: boolean; // true 면 제외
  sourceUrl: string; // 원문 공식 URL
  license: CorpusLicense;
  licenseEvidenceUrl: string;
  attribution: string | null; // CC BY·NASA·MedlinePlus 출처 표시 문구
  koreaCopyrightChecked: boolean;
  retrievedAt: string;
  sha256: string;
  textPath: string; // 저장소 밖 절대 경로
};
/** 발췌 한 건(문항 품질 JSON 의 `quality.sourceText` 로 저장되는 형태와 같다). */
export type Excerpt = {
  corpusId: string;
  startChar: number; // 정규화 전 원문 파일 기준 문자 오프셋
  endChar: number;
  elisions: [number, number][]; // `[…]` 로 생략한 구간(원문 오프셋), 각 구간이 원문에서 연속
  wordCount: number;
  textSha256: string;
  editorialChanges: string[]; // 예: "각주 제거"
  verifiedAt: string | null;
  verifiedBy: "code:quote-match-v1" | null;
};
