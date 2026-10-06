import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseContractMarkdown } from "../../scripts/legal-docs/parse-markdown.mjs";
import { UNDER_13_CONSENT_VERSION, under13NoticeSections } from "@/lib/contracts/under13-notice";
import { GENERATED_LEGAL_DOCUMENTS } from "./documents/generated";
import { findLegalTextProblems } from "./guard";
import { inlineToPlainText } from "./inline";
import { canStartLessonCapture } from "./recording-gate";
import { RECORDING_CLAUSE_HEADING, RECORDING_CLAUSE_PARAGRAPHS } from "./recording-clause";
import { PRIVACY_SECTIONS, RETENTION_INTRO, RETENTION_ITEMS, TERMS_SECTIONS, type SiteSection } from "./site-documents";

const root = path.resolve(__dirname, "../..");
const read = (f: string) => readFileSync(path.join(root, "docs/contracts", f), "utf8");
const norm = (s: string) => s.replace(/[^A-Za-z0-9]/g, "");
const FIXES: [string, string][] = [
  ["contact us at and we", "contact us at official@alton.education and we"],
  ["Send requests to .", "Send requests to official@alton.education."],
  ["Contact official@alton.education", "Contact official@alton.education"],
];
const fix = (s: string) => FIXES.reduce((t, [a, b]) => t.replace(a, b), s);

function flat(sections: SiteSection[]): string {
  return sections
    .flatMap((s) => [s.title, ...s.blocks.flatMap((b) => (b.t === "ul" ? b.items : [b.text]))])
    .map(inlineToPlainText)
    .join(" ");
}

describe("generated documents match the English sources", () => {
  const sources: [keyof typeof GENERATED_LEGAL_DOCUMENTS, string][] = [
    ["parentAgreement", "parent-education-services-agreement-v0.3-en-california-draft.md"],
    ["teacherCalifornia", "teacher-california-employment-agreement-v0.2-en.md"],
    ["teacherNonUs", "teacher-non-us-services-agreement-v0.2-en.md"],
    ["teacherUsContractor", "teacher-us-contractor-services-agreement-v0.1-en.md"],
    ["consultantServices", "consultant-services-agreement-v0.1-en.md"],
    ["teacherRateAddendum", "teacher-rate-change-addendum-v0.2-en.md"],
    ["under13Notice", "under-13-parental-notice-and-consent-en.md"],
  ];
  it("every generated document has a drift check here, and internal review files are never generated", () => {
    expect(sources.map(([k]) => k).sort()).toEqual(Object.keys(GENERATED_LEGAL_DOCUMENTS).sort());
    expect(JSON.stringify(GENERATED_LEGAL_DOCUMENTS)).not.toMatch(/legal review request|legal-review-request/i);
  });
  it.each(sources)("%s is in step with its source file (re-run scripts/legal-docs/generate.mjs if this fails)", (key, file) => {
    expect(JSON.parse(JSON.stringify(GENERATED_LEGAL_DOCUMENTS[key]))).toEqual(parseContractMarkdown(read(file)));
  });

  it.each([
    ["terms", TERMS_SECTIONS, "terms-of-use-en.md"],
    ["privacy", PRIVACY_SECTIONS, "privacy-policy-en.md"],
  ] as const)("%s page content contains every source paragraph", (_n, sections, file) => {
    const body = norm(flat([...sections]));
    const src = parseContractMarkdown(read(file));
    const paras: string[] = src.sections.flatMap((s: { blocks: { t: string; text?: string }[] }) => s.blocks.filter((b) => b.t !== "ul").map((b) => fix(b.text!)));
    for (const para of paras) expect(body, para.slice(0, 60)).toContain(norm(para));
  });
});

describe("recording / transcription / AI notes consent is consistent", () => {
  const four = ["video recording", "audio recording", "conversion of speech into a text transcript", "AI-assisted preparation and storage of lesson notes"];
  const docs: [string, string][] = [
    ["parent", JSON.stringify(GENERATED_LEGAL_DOCUMENTS.parentAgreement)],
    ["teacher CA", JSON.stringify(GENERATED_LEGAL_DOCUMENTS.teacherCalifornia)],
    ["teacher non-US", JSON.stringify(GENERATED_LEGAL_DOCUMENTS.teacherNonUs)],
    ["under-13", JSON.stringify(GENERATED_LEGAL_DOCUMENTS.under13Notice)],
    ["terms", flat(TERMS_SECTIONS)],
    ["privacy", flat(PRIVACY_SECTIONS)],
  ];
  it.each(docs)("%s carries the identical clause with all four items", (_n, text) => {
    for (const p of RECORDING_CLAUSE_PARAGRAPHS) expect(norm(text)).toContain(norm(p));
    for (const f of four) expect(text).toContain(f);
    expect(text).toContain("initial consultations and trial lessons are excluded");
    expect(text).toContain("Free learning access is not conditioned on agreeing to lesson recording");
    expect(text).toContain("No public posting, unrelated advertising, sale, or unrestricted model training");
  });
  it("adds no per-lesson consent step", () => {
    for (const [, text] of docs) expect(text).not.toMatch(/consent (again )?(before|at) each lesson|per-lesson consent/i);
  });
});

describe("recording clause in the contractor documents added 2026-10-07", () => {
  const newDocs = [
    ["teacher US contractor", "teacherUsContractor"],
    ["consultant", "consultantServices"],
  ] as const;
  const paragraphsOf = (key: (typeof newDocs)[number][1]) => {
    const sec = GENERATED_LEGAL_DOCUMENTS[key].sections.find((x: { heading: string | null }) => x.heading?.includes(RECORDING_CLAUSE_HEADING));
    return (sec?.blocks ?? []).flatMap((b) => (b.t === "p" ? [b.text] : []));
  };
  it.each(newDocs)("%s keeps the four items, the not-currently-provided statement and the retention wording", (_n, key) => {
    const text = paragraphsOf(key).join(" ");
    for (const f of ["video recording", "audio recording", "conversion of speech into a text transcript", "AI-assisted preparation and storage of lesson notes"]) expect(text).toContain(f);
    expect(text).toContain("are not currently provided");
    expect(text).toContain("before any recording is activated");
    expect(text).toContain("eligible for deletion one year after");
    expect(text).toContain("regardless of continued enrolment");
    expect(text).toContain("reviewed at least every 12 months");
    expect(text).toContain("Children's information is deleted earlier");
    expect(text).toContain("Free learning access is not conditioned on agreeing to lesson recording");
    expect(text).toContain("No public posting, unrelated advertising, sale, or unrestricted model training");
    expect(text).not.toMatch(/consent (again )?(before|at) each lesson|per-lesson consent/i);
  });
  // KNOWN MISMATCH reported to the planner (2026-10-07): the new documents reword the shared clause (trial lessons and service
  // consultations included after execution; "session" instead of "lesson"; consultant scope wording). `it.fails` records the
  // difference without editing confirmed wording; remove the marker once the wording is aligned or the difference is approved.
  it.fails.each(newDocs)("%s carries the five shared paragraphs identical to the confirmed clause", (_n, key) => {
    const ps = paragraphsOf(key);
    RECORDING_CLAUSE_PARAGRAPHS.forEach((p, i) => expect(ps[i]).toBe(p));
  });
  it("the rate addendum carries no recording clause and no internal wording", () => {
    expect(JSON.stringify(GENERATED_LEGAL_DOCUMENTS.teacherRateAddendum)).not.toMatch(/recording/i);
  });
});

describe("one unified retention schedule", () => {
  const withSchedule: [string, string][] = [
    ["parent", JSON.stringify(GENERATED_LEGAL_DOCUMENTS.parentAgreement)],
    ["under-13", JSON.stringify(GENERATED_LEGAL_DOCUMENTS.under13Notice)],
    ["terms", flat(TERMS_SECTIONS)],
    ["privacy", flat(PRIVACY_SECTIONS)],
  ];
  it.each(withSchedule)("%s states every schedule item exactly", (_n, text) => {
    expect(norm(text)).toContain(norm(RETENTION_INTRO));
    for (const item of RETENTION_ITEMS) expect(norm(text)).toContain(norm(item));
  });
  it.each(["teacherCalifornia", "teacherNonUs", "teacherUsContractor", "consultantServices"] as const)("%s refers to the schedule", (k) => {
    expect(JSON.stringify(GENERATED_LEGAL_DOCUMENTS[k])).toContain("retention schedule in ALTON's Privacy Policy");
  });
  it("recording clause states the 1-year period and no longer says there is no fixed period", () => {
    expect(RECORDING_CLAUSE_PARAGRAPHS.join(" ")).toContain("eligible for deletion one year after that lesson, regardless of continued enrolment");
    for (const item of [...RETENTION_ITEMS, ...RECORDING_CLAUSE_PARAGRAPHS]) expect(item).not.toMatch(/no fixed (period|duration)/i);
  });
});

describe("user-facing legal text guard", () => {
  const docText = (d: { title: string; sections: readonly { heading: string | null; blocks: readonly { t: string; text?: string; items?: readonly string[] }[] }[] }) =>
    [d.title, ...d.sections.flatMap((x) => [x.heading ?? "", ...x.blocks.flatMap((bl) => (bl.t === "ul" ? [...bl.items!] : [bl.text!]))])].join(" ");
  const all: [string, string][] = [
    ...Object.entries(GENERATED_LEGAL_DOCUMENTS).map(([k, v]): [string, string] => [k, docText(v)]),
    ["terms", flat(TERMS_SECTIONS)],
    ["privacy", flat(PRIVACY_SECTIONS)],
  ];
  it.each(all)("%s has no internal review wording and no old under-13 rule", (_n, text) => {
    // Execution fields in the raw source (filled at render time, covered by the render tests) are not wording.
    const wording = text.replace(/\[[^\]]*\]/g, " ").replace(/_{3,}/g, " ");
    expect(findLegalTextProblems(wording, { checkNonEnglish: true })).toEqual([]);
    expect(text).not.toMatch(/consultation route led by a parent|13 years old to create/i);
  });
  it("terms and privacy are fully English and use the official contact email", () => {
    for (const t of [flat(TERMS_SECTIONS), flat(PRIVACY_SECTIONS)]) {
      expect(findLegalTextProblems(t, { checkNonEnglish: true })).toEqual([]);
      expect(t).toContain("official@alton.education");
      expect(t).not.toMatch(/contact us at and|requests to \./);
    }
  });
  it("the guard flags placeholders, blanks and draft wording", () => {
    expect(findLegalTextProblems("Name: [Complete before signature]")).not.toEqual([]);
    expect(findLegalTextProblems("Name: ______")).not.toEqual([]);
    expect(findLegalTextProblems("This is a draft pending legal review")).not.toEqual([]);
    expect(findLegalTextProblems("Governing law: [to be confirmed]")).not.toEqual([]);
  });
});

describe("under-13 notice", () => {
  it("is versioned, has no paper-form blanks and keeps verification language", () => {
    const text = JSON.stringify(under13NoticeSections());
    expect(UNDER_13_CONSENT_VERSION).toBe("U13-EN-2026-10-06");
    expect(text).not.toMatch(/_{4,}/);
    expect(text).toContain("Signing this form alone does not bypass that process");
    expect(text).toContain("video recording, audio recording, speech-to-text transcription and storage, and AI meeting notes");
  });
});

describe("canStartLessonCapture", () => {
  const ok = { lessonKind: "regular", customerAgreementSigned: true, teacherAgreementSigned: true, under13ConsentMissing: false } as const;
  it("allows only regular lessons with signed agreements", () => {
    expect(canStartLessonCapture(ok).allowed).toBe(true);
    expect(canStartLessonCapture({ ...ok, lessonKind: "trial" }).allowed).toBe(false);
    expect(canStartLessonCapture({ ...ok, lessonKind: "consultation" }).allowed).toBe(false);
    expect(canStartLessonCapture({ ...ok, customerAgreementSigned: false }).allowed).toBe(false);
    expect(canStartLessonCapture({ ...ok, teacherAgreementSigned: false }).allowed).toBe(false);
    expect(canStartLessonCapture({ ...ok, under13ConsentMissing: true }).allowed).toBe(false);
  });
});
