// Release guard for user-facing legal text (contracts, notices, Terms, Privacy). It rejects text that
// still carries a template placeholder, an unfilled blank, or internal review / drafting language.

const INTERNAL_WORDING =
  /\bdraft\b|legal review|attorney review|lawyer review|counsel (review|must review)|\bTBD\b|to be confirmed|to be determined|place-?holder|\bTODO\b|\bFIXME\b|not for (signature|release|execution)|pending (legal )?review|before release|release (decision|check)|developer (note|instruction)|implementation (note|instruction)|internal (review|note|memo)|\bundefined\b|\bNaN\b|\[object /i;

export class UnfilledContractError extends Error {
  constructor(readonly problems: string[]) {
    super(`Contract text is not ready to send: ${problems.join("; ")}`);
    this.name = "UnfilledContractError";
  }
}

export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<title[\s\S]*?<\/title>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Returns a list of human-readable problems; empty when the text is clean. */
export function findLegalTextProblems(text: string, opts?: { allowedAnchors?: readonly string[]; checkNonEnglish?: boolean }): string[] {
  let t = text;
  for (const a of opts?.allowedAnchors ?? []) t = t.replaceAll(a, " ");
  const problems: string[] = [];
  const bracket = t.match(/\[[^\]]*\]/g);
  if (bracket) problems.push(`unfilled bracket field ${bracket.slice(0, 3).join(", ")}`);
  if (/_{3,}/.test(t)) problems.push("unfilled blank line");
  if (/\{\{|\}\}/.test(t)) problems.push("unreplaced template token");
  const internal = t.match(INTERNAL_WORDING);
  if (internal) problems.push(`internal wording "${internal[0]}"`);
  if (opts?.checkNonEnglish && /[ㄱ-ㆎ가-힣]/.test(t)) problems.push("non-English (Korean) text");
  return problems;
}

export function assertLegalTextClean(htmlOrText: string, opts?: { allowedAnchors?: readonly string[]; checkNonEnglish?: boolean }): void {
  const problems = findLegalTextProblems(htmlToText(htmlOrText), opts);
  if (problems.length > 0) throw new UnfilledContractError(problems);
}

/**
 * Source documents describe each filled-in value ("Identified in the executed ... details", "Accepted monthly amount and
 * currency recorded ..."). Those descriptions must be replaced by the real per-agreement value before sending; this
 * returns every description that is still present in a rendered document.
 */
const INPUT_DESCRIPTION_PATTERNS: RegExp[] = [
  /Identified in the executed/i,
  /Identifier of the executed/i,
  /Recorded signature completion date/i,
  /Previously accepted amount per/i,
  /Newly accepted amount per/i,
  /Prospective start date recorded/i,
  /service commencement date recorded/i,
  /Accepted monthly amount and currency recorded/i,
  /Accepted scope and deliverables recorded/i,
  /are recorded in the executed (payment|compensation|assignment|work|recipient)/i,
  /identified here in the executed Agreement/i,
  /authorized representative and authenticated Company electronic approval, including/i,
  /(Lesson fee|Monthly fee): (Teacher's accepted|Accepted)/i,
];

export function findUnreplacedInputDescriptions(htmlOrText: string): string[] {
  const t = htmlToText(htmlOrText);
  return INPUT_DESCRIPTION_PATTERNS.filter((re) => re.test(t)).map((re) => `unreplaced input description matching ${re}`);
}

export function assertNoUnreplacedInputDescriptions(htmlOrText: string): void {
  const problems = findUnreplacedInputDescriptions(htmlOrText);
  if (problems.length > 0) throw new UnfilledContractError(problems);
}
