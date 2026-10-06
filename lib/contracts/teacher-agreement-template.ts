// Teacher agreements. Authoritative English text:
//   docs/contracts/teacher-california-employment-agreement-v0.2-en.md  (teachers working in California)
//   docs/contracts/teacher-non-us-services-agreement-v0.2-en.md        (teachers working outside the United States)
// The form is chosen from the ACTUAL work location only — never from nationality, account role or tax form.
// Paydays (semimonthly, 26th/10th pay deadlines, Pacific Time), fee allocation (Company bears) and the 30-day notice are fixed in the
// source text (owner decision 2026-10-06). Other execution values (payment details, ...) are never
// invented here: if a required value is missing, rendering throws UnfilledContractError and nothing is sent.
import { GENERATED_LEGAL_DOCUMENTS } from "@/lib/legal/documents/generated";
import { assertLegalTextClean, UnfilledContractError } from "@/lib/legal/guard";
import { CONTRACT_STYLES, documentBodyHtml, escapeHtml } from "@/lib/legal/render-html";
import { COMPANY_NAME, COMPANY_NOTICE_ADDRESS } from "@/lib/legal";
import {
  CONTRACT_SIGNING_ANCHORS,
  DATE_SIGNED_ANCHOR,
  SIGNATURE_ANCHOR,
  formatIsoDateEn,
  type CompanyApprovalForTemplate,
} from "./family-contract-template";

export const TEACHER_CALIFORNIA_TEMPLATE_VERSION = "0.2-EN-CA";
export const TEACHER_NON_US_TEMPLATE_VERSION = "0.2-EN";
export const TEACHER_US_CONTRACTOR_TEMPLATE_VERSION = "0.1-EN-US-CONTRACTOR";

export type TeacherAgreementForm = "california_employment" | "non_us_services" | "us_contractor_services";

/** Where the teacher will actually perform the work. Nationality and account role are deliberately not inputs. */
export type TeacherWorkLocation = {
  /** ISO 3166-1 alpha-2 country code, e.g. "US", "KR". */
  country: string | null | undefined;
  /** U.S. state or territory (code or name) when country is US. */
  region?: string | null;
  /** contractor (default) or employee. Employee is only available in California. */
  engagementType?: "contractor" | "employee" | null;
};

export type TeacherAgreementSelection =
  | { form: TeacherAgreementForm; templateVersion: string }
  | { form: null; reason: string };

export function selectTeacherAgreementForm(location: TeacherWorkLocation): TeacherAgreementSelection {
  const country = (location.country ?? "").trim().toUpperCase();
  if (!country) return { form: null, reason: "The actual work country has not been provided." };
  // Default engagement is contractor (owner decision 2026-10-06); the California employment form is selected only for an
  // explicitly marked employee working in California.
  if (location.engagementType === "employee") {
    const region = (location.region ?? "").trim().toLowerCase();
    if (country === "US" && (region === "ca" || region === "california")) return { form: "california_employment", templateVersion: TEACHER_CALIFORNIA_TEMPLATE_VERSION };
    return { form: null, reason: "The employee agreement is available only for work performed in California." };
  }
  if (country === "KR") return { form: "non_us_services", templateVersion: TEACHER_NON_US_TEMPLATE_VERSION };
  if (country === "US") return { form: "us_contractor_services", templateVersion: TEACHER_US_CONTRACTOR_TEMPLATE_VERSION };
  return { form: null, reason: "The pay currency and agreement form are not configured for this work country." };
}

export type TeacherAgreementCommon = {
  teacherName: string;
  teacherEmail: string;
  teacherAddress: string;
  /** Start / effective date, YYYY-MM-DD. */
  effectiveDate: string;
  /** Schedule B text; use "None" when there are no prior materials. */
  priorMaterials: string;
  companyApproval: CompanyApprovalForTemplate;
};

/** Teacher's accepted hourly rate per 60 minutes in minor units (KRW: won, USD: cents). Never converted between currencies. */
export type TeacherRate = { amountMinor: number; currency: "KRW" | "USD" };

export type CaliforniaTeacherAgreementParams = TeacherAgreementCommon & {
  lessonRate: TeacherRate & { currency: "USD" };
  californiaWorkLocation: string;
  supervisor: string;
};

export type NonUsTeacherAgreementParams = TeacherAgreementCommon & {
  actualWorkCountryAndLocation: string;
  paymentMethodAndRecipientDetails: string;
  lessonRate: TeacherRate & { currency: "KRW" };
};

function requireFields(values: Record<string, string | null | undefined>): void {
  const missing = Object.entries(values)
    .filter(([, v]) => !v || !v.trim())
    .map(([k]) => k);
  if (missing.length > 0) throw new UnfilledContractError(missing.map((k) => `missing required field ${k}`));
}

function approvalLine(a: CompanyApprovalForTemplate): string {
  const cleaned = (a.approverTitle ?? "").replace(a.approverName, "").replace(/^[\s,]+|[\s,]+$/g, "").trim();
  return cleaned ? `${a.approverName}, ${cleaned}` : a.approverName;
}

function page(title: string, versionLine: string | null, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>${CONTRACT_STYLES}
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">${escapeHtml(versionLine ?? "")}</p>
${body}
</body>
</html>`;
}

function assertCompany(a: CompanyApprovalForTemplate): void {
  if (a.companyEntityName !== COMPANY_NAME) throw new Error(`회사 승인 기록의 계약 주체가 ${COMPANY_NAME}이(가) 아닙니다.`);
  requireFields({ approverName: a.approverName, approvedAtLabel: a.approvedAtLabel, documentIdentifier: a.documentIdentifier });
}

function signatureParagraphs(text: string, who: "employee" | "teacher", name: string, a: CompanyApprovalForTemplate): string[] | null {
  const label = who === "employee" ? "Employee" : "Teacher";
  if (text.startsWith(`${label} name and signature:`))
    return [`${label} name: ${escapeHtml(name)}`, `${label} signature: ${SIGNATURE_ANCHOR}`, `Date and time signed: ${DATE_SIGNED_ANCHOR}`];
  if (text.startsWith("Alton Education LLC authorized representative name, title, and signature:"))
    return [
      `Alton Education LLC authorized representative name and title: ${escapeHtml(approvalLine(a))}`,
      `Company electronic approval: recorded ${escapeHtml(a.approvedAtLabel)}; document identifier ${escapeHtml(a.documentIdentifier)}`,
    ];
  return null;
}

export function renderCaliforniaTeacherAgreementHtml(p: CaliforniaTeacherAgreementParams): string {
  requireFields({
    teacherName: p.teacherName,
    teacherEmail: p.teacherEmail,
    teacherAddress: p.teacherAddress,
    effectiveDate: p.effectiveDate,
    californiaWorkLocation: p.californiaWorkLocation,
    supervisor: p.supervisor,
    priorMaterials: p.priorMaterials,
  });
  assertCompany(p.companyApproval);
  const doc = GENERATED_LEGAL_DOCUMENTS.teacherCalifornia;
  const body = documentBodyHtml(doc, {
    rewriteBullet: (item) => {
      const at = (l: string) => item.startsWith(l);
      if (at("Employee legal name:")) return [`Employee legal name: ${escapeHtml(p.teacherName)}`];
      if (at("Employee address and email:")) return [`Employee address and email: ${escapeHtml(p.teacherAddress)}; ${escapeHtml(p.teacherEmail)}`];
      if (at("Company notice address:")) return [`Company notice address: ${escapeHtml(COMPANY_NOTICE_ADDRESS)}`];
      if (at("Regular hourly rate:")) return [`Regular hourly rate: ${escapeHtml(formatRate(p.lessonRate))} per hour of compensable time`];
      if (at("Start date:")) return [`Start date: ${escapeHtml(formatIsoDateEn(p.effectiveDate))}`];
      if (at("California work location:")) return [`California work location: ${escapeHtml(p.californiaWorkLocation)}`];
      if (at("Supervisor:")) return [`Supervisor: ${escapeHtml(p.supervisor)}`];
      return null;
    },
    rewriteParagraph: (text) => {
      if (/^_{5,}$/.test(text)) return [escapeHtml(p.priorMaterials)];
      return signatureParagraphs(text, "employee", p.teacherName, p.companyApproval);
    },
  });
  const html = page(doc.title, doc.versionLine, body);
  assertLegalTextClean(html, { allowedAnchors: CONTRACT_SIGNING_ANCHORS });
  return html;
}

function formatRate(rate: TeacherRate | undefined): string {
  if (!rate || !Number.isFinite(rate.amountMinor) || rate.amountMinor <= 0) throw new UnfilledContractError(["Hourly rate"]);
  if (rate.currency === "USD") return `USD $${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rate.amountMinor / 100)}`;
  if (rate.currency === "KRW") return `KRW ${new Intl.NumberFormat("en-US").format(rate.amountMinor)}`;
  throw new UnfilledContractError(["Hourly rate currency"]);
}

export type UsContractorTeacherAgreementParams = TeacherAgreementCommon & {
  /** U.S. state and city where the work is actually performed. */
  actualWorkCountryAndLocation: string;
  paymentMethodAndRecipientDetails: string;
  lessonRate: TeacherRate & { currency: "USD" };
};

/**
 * U.S. (outside California) independent-contractor services agreement. The source text does not exist yet: until
 * docs/contracts/teacher-us-contractor-services-agreement-v0.1-en.md is written and generated, rendering throws
 * UnfilledContractError so nothing is sent. Once the text exists only that file + `node scripts/legal-docs/generate.mjs`
 * are needed; Schedule A bullets reuse the same labels as the non-U.S. form.
 */
export function renderUsContractorTeacherAgreementHtml(p: UsContractorTeacherAgreementParams): string {
  const doc = GENERATED_LEGAL_DOCUMENTS.teacherUsContractor;
  if (!doc) throw new UnfilledContractError(["U.S. independent-contractor agreement text (not yet available)"]);
  requireFields({
    teacherName: p.teacherName,
    teacherEmail: p.teacherEmail,
    teacherAddress: p.teacherAddress,
    effectiveDate: p.effectiveDate,
    actualWorkCountryAndLocation: p.actualWorkCountryAndLocation,
    paymentMethodAndRecipientDetails: p.paymentMethodAndRecipientDetails,
    priorMaterials: p.priorMaterials,
  });
  assertCompany(p.companyApproval);
  return renderNonUsLikeBody(doc, p);
}

export function renderNonUsTeacherAgreementHtml(p: NonUsTeacherAgreementParams): string {
  requireFields({
    teacherName: p.teacherName,
    teacherEmail: p.teacherEmail,
    teacherAddress: p.teacherAddress,
    effectiveDate: p.effectiveDate,
    actualWorkCountryAndLocation: p.actualWorkCountryAndLocation,
    paymentMethodAndRecipientDetails: p.paymentMethodAndRecipientDetails,
    priorMaterials: p.priorMaterials,
  });
  assertCompany(p.companyApproval);
  return renderNonUsLikeBody(GENERATED_LEGAL_DOCUMENTS.teacherNonUs, p);
}

function renderNonUsLikeBody(
  doc: NonNullable<typeof GENERATED_LEGAL_DOCUMENTS.teacherUsContractor>,
  p: NonUsTeacherAgreementParams | UsContractorTeacherAgreementParams
): string {
  const body = documentBodyHtml(doc, {
    rewriteBullet: (item) => {
      const at = (l: string) => item.startsWith(l);
      if (at("Teacher legal name, address, and email:"))
        return [`Teacher legal name, address, and email: ${escapeHtml(p.teacherName)}; ${escapeHtml(p.teacherAddress)}; ${escapeHtml(p.teacherEmail)}`];
      if (at("Actual work country and location:")) return [`Actual work country and location: ${escapeHtml(p.actualWorkCountryAndLocation)}`];
      if (at("Company notice address:")) return [`Company notice address: ${escapeHtml(COMPANY_NOTICE_ADDRESS)}`];
      if (at("Effective date:")) return [`Effective date: ${escapeHtml(formatIsoDateEn(p.effectiveDate))}`];
      if (at("Lesson fee:")) return [`Lesson fee: ${escapeHtml(formatRate(p.lessonRate))} per 60 recognized minutes`];
      if (at("Payment method and recipient details:")) return [`Payment method and recipient details: ${escapeHtml(p.paymentMethodAndRecipientDetails)}`];
      return null;
    },
    rewriteParagraph: (text) => {
      if (/^_{5,}$/.test(text)) return [escapeHtml(p.priorMaterials)];
      return signatureParagraphs(text, "teacher", p.teacherName, p.companyApproval);
    },
  });
  const html = page(doc.title, doc.versionLine, body);
  assertLegalTextClean(html, { allowedAnchors: CONTRACT_SIGNING_ANCHORS });
  return html;
}
