import { randomUUID } from "node:crypto";
import {
  renderCaliforniaTeacherAgreementHtml,
  renderNonUsTeacherAgreementHtml,
  renderUsContractorTeacherAgreementHtml,
  type TeacherRate,
  selectTeacherAgreementForm,
  type TeacherAgreementForm,
} from "@/lib/contracts/teacher-agreement-template";
import { GENERATED_LEGAL_DOCUMENTS } from "@/lib/legal/documents/generated";
import { COMPANY_NAME } from "@/lib/legal";
import { UnfilledContractError } from "@/lib/legal/guard";
import { sensitiveNumberProblem } from "./validate-inputs";
import { TEACHER_APPROVER } from "./schedule-defaults";

export type TeacherAgreementInputs = {
  work_country: string | null;
  work_region: string | null;
  work_location_detail: string | null;
  mailing_address: string | null;
  start_date: string | null;
  supervisor_name: string | null;
  prior_materials: string | null;
  payment_details: string | null;
  /** contractor (default) or employee — selects the agreement form together with the work location. */
  engagement_type: "contractor" | "employee";
};

export const EMPTY_INPUTS: TeacherAgreementInputs = {
  work_country: null,
  work_region: null,
  work_location_detail: null,
  mailing_address: null,
  start_date: null,
  supervisor_name: null,
  prior_materials: null,
  payment_details: null,
  engagement_type: "contractor",
};

export type PrepareArgs = {
  teacherName: string;
  workspaceEmail: string | null;
  /** teacher_workspace_provisioning.status === 'created' */
  workspaceProvisioned: boolean;
  inputs: TeacherAgreementInputs | null;
  /** Current rate from teacher_rate_history (amount_minor + currency). Null when no rate is set. */
  rate?: TeacherRate | null;
  /** Agreement id printed as the document identifier; generated when sending. */
  agreementId?: string;
  now?: Date;
};

export type PrepareResult =
  | { ok: true; form: TeacherAgreementForm; templateVersion: string; html: string; recipientEmail: string; agreementId: string }
  | { ok: false; missing: string[]; form: TeacherAgreementForm | null };

const blank = (v: string | null | undefined) => !v || !v.trim();

export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

function englishUtc(d: Date): string {
  return `${d.toLocaleString("en-US", { timeZone: "UTC", dateStyle: "long", timeStyle: "short" })} UTC`;
}

/** Everything the admin must still supply (Korean labels for the admin UI) — empty means ready to send. */
export function prepareTeacherAgreement(a: PrepareArgs): PrepareResult {
  const i = a.inputs ?? EMPTY_INPUTS;
  const missing: string[] = [];
  const email = (a.workspaceEmail ?? "").trim().toLowerCase();
  if (!a.workspaceProvisioned || !email.endsWith("@alton.education")) missing.push("Workspace 계정(@alton.education) 생성 완료");
  if (blank(i.work_country)) missing.push("실제 근무 국가");

  const selection = selectTeacherAgreementForm({ country: i.work_country, region: i.work_region, engagementType: i.engagement_type });
  if (selection.form === null) {
    if (!blank(i.work_country)) {
      const emp = i.engagement_type === "employee";
      missing.push(
        emp
          ? "직원(employee) 계약은 미국 캘리포니아 근무자만 지원합니다"
          : "해당 국가의 보수 통화·계약서 양식이 설정되지 않음(현재 KR=KRW, 미국=USD만 지원)"
      );
    }
    return { ok: false, missing, form: null };
  }
  const form = selection.form;
  const wantCurrency = form === "non_us_services" ? "KRW" : "USD";
  if (!a.rate || a.rate.amountMinor <= 0) missing.push("선생님 시급 미설정 — 선생님 상세에서 시급을 먼저 등록");
  else if (a.rate.currency !== wantCurrency) missing.push(`이 근무 지역은 ${wantCurrency} 시급이 필요합니다(현재 ${a.rate.currency}) — 시급 통화를 확인하세요`);
  if (blank(i.mailing_address)) missing.push("우편 주소");
  if (blank(i.start_date)) missing.push("시작일");
  if (blank(i.work_location_detail)) missing.push(form === "california_employment" ? "캘리포니아 근무 위치" : "근무 도시·지역");
  if (form === "california_employment") {
    if (blank(i.supervisor_name)) missing.push("감독자(Supervisor) 이름");
  } else {
    if (blank(i.payment_details)) missing.push("지급 방법·수령 정보");
    else if (sensitiveNumberProblem(i.payment_details!)) missing.push("지급 정보에 전체 계좌·세금번호 포함 — 끝 4자리까지만 입력");
  }
  if (form === "us_contractor_services" && !GENERATED_LEGAL_DOCUMENTS.teacherUsContractor) missing.push("미국(캘리포니아 외) 프리랜서 계약서 양식 준비 중");
  if (missing.length > 0) return { ok: false, missing, form };

  const agreementId = a.agreementId ?? randomUUID();
  const companyApproval = {
    companyEntityName: COMPANY_NAME,
    approverName: TEACHER_APPROVER.name,
    approverTitle: TEACHER_APPROVER.title,
    approvedAtLabel: englishUtc(a.now ?? new Date()),
    documentIdentifier: agreementId,
  };
  const common = {
    teacherName: a.teacherName,
    teacherEmail: email,
    teacherAddress: i.mailing_address!,
    effectiveDate: i.start_date!,
    priorMaterials: blank(i.prior_materials) ? "None" : i.prior_materials!,
    companyApproval,
  };
  try {
    const html =
      form === "california_employment"
        ? renderCaliforniaTeacherAgreementHtml({
            ...common,
            californiaWorkLocation: i.work_location_detail!,
            supervisor: i.supervisor_name!,
            lessonRate: a.rate as TeacherRate & { currency: "USD" },
          })
        : form === "us_contractor_services"
        ? renderUsContractorTeacherAgreementHtml({
            ...common,
            actualWorkCountryAndLocation: `${countryName(i.work_country!)}${blank(i.work_region) ? "" : `, ${i.work_region}`} — ${i.work_location_detail!}`,
            paymentMethodAndRecipientDetails: i.payment_details!,
            lessonRate: a.rate as TeacherRate & { currency: "USD" },
          })
        : renderNonUsTeacherAgreementHtml({
            ...common,
            actualWorkCountryAndLocation: `${countryName(i.work_country!)} — ${i.work_location_detail!}`,
            paymentMethodAndRecipientDetails: i.payment_details!,
            lessonRate: a.rate as TeacherRate & { currency: "KRW" },
          });
    return { ok: true, form, templateVersion: selection.templateVersion, html, recipientEmail: email, agreementId };
  } catch (e) {
    if (e instanceof UnfilledContractError) return { ok: false, missing: e.problems, form };
    throw e;
  }
}
