// Student education services agreement (parent / adult-student customer).
// Authoritative English text: docs/contracts/parent-education-services-agreement-v0.3-en-california-draft.md,
// parsed into lib/legal/documents/generated.ts. DocuSign receives this whole HTML as a single document
// (no console template). Every execution field is filled from real data; anything still unfilled blocks
// dispatch (UnfilledContractError) instead of reaching a customer.
import { GENERATED_LEGAL_DOCUMENTS } from "@/lib/legal/documents/generated";
import { assertLegalTextClean } from "@/lib/legal/guard";
import { CONTRACT_STYLES, documentBodyHtml, escapeHtml } from "@/lib/legal/render-html";
import { COMPANY_NAME, COMPANY_NOTICE_ADDRESS } from "@/lib/legal";

export const SIGNATURE_ANCHOR = "/sig1/";
export const DATE_SIGNED_ANCHOR = "/date1/";
/** Required text field in which the customer enters their notice address at signing. */
export const ADDRESS_ANCHOR = "/addr1/";
export const CONTRACT_SIGNING_ANCHORS = [SIGNATURE_ANCHOR, DATE_SIGNED_ANCHOR, ADDRESS_ANCHOR] as const;

/** Version of the agreement text recorded on contract_versions.template_version. */
export const FAMILY_CONTRACT_TEMPLATE_VERSION = "0.3-EN-CA";

// The company side is an authenticated administrator's electronic approval inserted into the document
// before dispatch (not a DocuSign signature field). The values come from contract_company_approvals,
// an immutable audit table, so the printed document always matches the stored record.
export type CompanyApprovalForTemplate = {
  companyEntityName: string;
  approverName: string;
  approverTitle: string | null;
  approvedAtLabel: string;
  documentIdentifier: string;
};

export type FamilyContractTemplateParams = {
  studentName: string;
  /** Student date of birth as YYYY-MM-DD (profiles.date_of_birth). */
  studentDateOfBirth: string;
  /** Kept for compatibility with existing minor-student dispatch callers. */
  parentName?: string;
  signerName?: string;
  signerEmail: string;
  signerType?: "guardian" | "adult_student";
  /** Agreement ID (contract_versions.id). */
  contractId: string;
  /** Agreement text version; defaults to FAMILY_CONTRACT_TEMPLATE_VERSION. */
  contractVersion?: string;
  companyApproval: CompanyApprovalForTemplate;
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function formatIsoDateEn(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) throw new Error(`Invalid date: ${iso}`);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) throw new Error(`Invalid date: ${iso}`);
  return `${MONTHS[month - 1]} ${day}, ${m[1]}`;
}

function approverLine(name: string, title: string | null): string {
  // Admin-entered titles are sometimes "Member, <name>"; do not print the name twice.
  const cleaned = (title ?? "").replace(name, "").replace(/^[\s,]+|[\s,]+$/g, "").trim();
  return cleaned ? `${name}, ${cleaned}` : name;
}

export function renderFamilyContractHtml(params: FamilyContractTemplateParams): string {
  const signerType = params.signerType ?? "guardian";
  const studentNameRaw = (params.studentName ?? "").trim();
  const signerNameRaw = (params.signerName ?? params.parentName ?? (signerType === "adult_student" ? params.studentName : "") ?? "").trim();
  const signerEmailRaw = (params.signerEmail ?? "").trim();
  const contractIdRaw = (params.contractId ?? "").trim();
  if (!studentNameRaw || !signerNameRaw) throw new Error("계약서 생성에는 학생명과 계약자명이 필요합니다.");
  if (!signerEmailRaw) throw new Error("계약서 생성에는 계약자 이메일이 필요합니다.");
  if (!contractIdRaw) throw new Error("계약서 생성에는 계약 ID가 필요합니다.");
  if (!params.studentDateOfBirth) throw new Error("계약서 생성에는 학생 생년월일이 필요합니다(학생 프로필에 생년월일을 먼저 입력하세요).");
  const dobLabel = formatIsoDateEn(params.studentDateOfBirth);

  const approval = params.companyApproval;
  if (approval.companyEntityName !== COMPANY_NAME) {
    throw new Error(`회사 승인 기록의 계약 주체가 ${COMPANY_NAME}이(가) 아닙니다.`);
  }
  if (!approval.approverName.trim() || !approval.approvedAtLabel.trim() || !approval.documentIdentifier.trim()) {
    throw new Error("회사 전자승인 기록이 불완전합니다.");
  }

  const student = escapeHtml(studentNameRaw);
  const signer = escapeHtml(signerNameRaw);
  const email = escapeHtml(signerEmailRaw);
  const agreementId = escapeHtml(contractIdRaw);
  const version = escapeHtml((params.contractVersion ?? FAMILY_CONTRACT_TEMPLATE_VERSION).trim());
  const capacity = signerType === "adult_student" ? "Adult Student" : "Parent or legal guardian";
  const relationship = signerType === "adult_student" ? "Self" : "Parent or legal guardian";

  const doc = GENERATED_LEGAL_DOCUMENTS.parentAgreement;
  const body = documentBodyHtml(doc, {
    rewriteBullet: (item) => {
      const at = (label: string) => item.startsWith(label);
      if (at("Company notice address:")) return [`Company notice address: ${escapeHtml(COMPANY_NOTICE_ADDRESS)}`];
      if (at("Customer legal name, email, and address:"))
        return [`Customer legal name, email, and address: ${signer}, ${email}; notice address as entered in the Execution and Student Schedule below`];
      if (at("Customer capacity:")) return [`Customer capacity: ${capacity}`];
      if (at("Student legal name and date of birth:")) return [`Student legal name and date of birth: ${student}, ${escapeHtml(dobLabel)}`];
      if (at("Agreement ID and version:")) return [`Agreement ID and version: ${agreementId} / ${version}`];
      if (at("Customer legal name and capacity:")) return [`Customer legal name and capacity: ${signer}, ${capacity}`];
      if (at("Customer email and notice address:")) return [`Customer email and notice address: ${email}; ${ADDRESS_ANCHOR}`];
      if (at("Relationship to Student:")) return [`Relationship to Student: ${relationship}`];
      if (at("Customer signature and timestamp:"))
        return [`Customer signature: ${SIGNATURE_ANCHOR}`, `Date and time signed: ${DATE_SIGNED_ANCHOR}`];
      if (at("Authorized representative name and title:"))
        return [`Authorized representative name and title: ${escapeHtml(approverLine(approval.approverName, approval.approverTitle))}`];
      if (at("Company signature and timestamp:"))
        return [`Company electronic approval: recorded ${escapeHtml(approval.approvedAtLabel)}; document identifier ${escapeHtml(approval.documentIdentifier)}`];
      return null;
    },
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(doc.title)}</title>
  <style>${CONTRACT_STYLES}
  </style>
</head>
<body>
  <h1>${escapeHtml(doc.title)}</h1>
  <p class="meta">${escapeHtml(doc.versionLine ?? "")}</p>
${body}
</body>
</html>`;

  assertLegalTextClean(html, { allowedAnchors: CONTRACT_SIGNING_ANCHORS });
  return html;
}
