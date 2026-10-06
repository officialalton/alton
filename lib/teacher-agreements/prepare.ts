import { randomUUID } from "node:crypto";
import {
  renderCaliforniaTeacherAgreementHtml,
  renderNonUsTeacherAgreementHtml,
  selectTeacherAgreementForm,
  type TeacherAgreementForm,
} from "@/lib/contracts/teacher-agreement-template";
import { COMPANY_NAME } from "@/lib/legal";
import { UnfilledContractError } from "@/lib/legal/guard";
import { TEACHER_APPROVER, TEACHER_SCHEDULE_DEFAULTS } from "./schedule-defaults";

export type TeacherAgreementInputs = {
  work_country: string | null;
  work_region: string | null;
  work_location_detail: string | null;
  mailing_address: string | null;
  start_date: string | null;
  supervisor_name: string | null;
  prior_materials: string | null;
  non_lesson_terms: string | null;
  payment_details: string | null;
};

export const EMPTY_INPUTS: TeacherAgreementInputs = {
  work_country: null,
  work_region: null,
  work_location_detail: null,
  mailing_address: null,
  start_date: null,
  supervisor_name: null,
  prior_materials: null,
  non_lesson_terms: null,
  payment_details: null,
};

export type PrepareArgs = {
  teacherName: string;
  workspaceEmail: string | null;
  /** teacher_workspace_provisioning.status === 'created' */
  workspaceProvisioned: boolean;
  inputs: TeacherAgreementInputs | null;
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

  const selection = selectTeacherAgreementForm({ country: i.work_country, region: i.work_region });
  if (selection.form === null) {
    if (!blank(i.work_country)) {
      missing.push(blank(i.work_region) && i.work_country?.toUpperCase() === "US" ? "근무 주(미국)" : "이 근무 지역에 사용할 수 있는 계약서 양식 없음");
    }
    return { ok: false, missing, form: null };
  }
  const form = selection.form;
  if (blank(i.mailing_address)) missing.push("우편 주소");
  if (blank(i.start_date)) missing.push("시작일");
  if (blank(i.work_location_detail)) missing.push(form === "california_employment" ? "캘리포니아 근무 위치" : "근무 도시·지역");
  if (blank(i.prior_materials)) missing.push("기존 자료(없으면 None 입력)");
  if (form === "california_employment") {
    if (blank(i.supervisor_name)) missing.push("감독자(Supervisor) 이름");
  } else {
    if (blank(i.non_lesson_terms)) missing.push("비수업 업무 범위·보수");
    if (blank(i.payment_details)) missing.push("지급 방법·수령 정보");
  }
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
    priorMaterials: i.prior_materials!,
    companyApproval,
  };
  try {
    const html =
      form === "california_employment"
        ? renderCaliforniaTeacherAgreementHtml({
            ...common,
            californiaWorkLocation: i.work_location_detail!,
            supervisor: i.supervisor_name!,
            payrollPeriodAndPaydays: TEACHER_SCHEDULE_DEFAULTS.californiaPayrollPeriodAndPaydays,
          })
        : renderNonUsTeacherAgreementHtml({
            ...common,
            actualWorkCountryAndLocation: `${countryName(i.work_country!)} — ${i.work_location_detail!}`,
            nonLessonServicesScopeAndCompensation: i.non_lesson_terms!,
            paymentMethodAndRecipientDetails: i.payment_details!,
            transferAndConversionFeeAllocation: TEACHER_SCHEDULE_DEFAULTS.transferAndConversionFeeAllocation,
            terminationNoticePeriod: TEACHER_SCHEDULE_DEFAULTS.terminationNoticePeriod,
          });
    return { ok: true, form, templateVersion: selection.templateVersion, html, recipientEmail: email, agreementId };
  } catch (e) {
    if (e instanceof UnfilledContractError) return { ok: false, missing: e.problems, form };
    throw e;
  }
}
