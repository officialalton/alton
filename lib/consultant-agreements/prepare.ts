import { randomUUID } from "node:crypto";
import { CONSULTANT_TEMPLATE_VERSION, renderConsultantAgreementHtml, type TeacherRate } from "@/lib/contracts/teacher-agreement-template";
import { COMPANY_NAME } from "@/lib/legal";
import { UnfilledContractError } from "@/lib/legal/guard";
import { bankTransferText, countryName, englishUtc, type PayoutAccountSummary } from "@/lib/teacher-agreements/prepare";
import { TEACHER_APPROVER } from "@/lib/teacher-agreements/schedule-defaults";

export type ConsultantAgreementInputs = {
  work_country: string | null;
  work_region: string | null;
  work_location_detail: string | null;
  mailing_address: string | null;
  start_date: string | null;
  /** minor units: KRW won, USD cents */
  monthly_fee_minor: number | null;
  monthly_fee_currency: "KRW" | "USD" | null;
  monthly_scope: string | null;
  prior_materials: string | null;
};

export const EMPTY_CONSULTANT_INPUTS: ConsultantAgreementInputs = {
  work_country: null,
  work_region: null,
  work_location_detail: null,
  mailing_address: null,
  start_date: null,
  monthly_fee_minor: null,
  monthly_fee_currency: null,
  monthly_scope: null,
  prior_materials: null,
};

export type PrepareConsultantArgs = {
  consultantName: string;
  /** consultant_workspace_provisioning.workspace_email of the linked account */
  workspaceEmail: string | null;
  inputs: ConsultantAgreementInputs | null;
  payoutAccount?: PayoutAccountSummary | null;
  agreementId?: string;
  now?: Date;
};

export type PrepareConsultantResult =
  | { ok: true; html: string; templateVersion: string; recipientEmail: string; agreementId: string }
  | { ok: false; missing: string[] };

const blank = (v: string | null | undefined) => !v || !v.trim();

/** Pay currency by actual work country: Korea KRW, United States USD; any other country is not configured. */
export function consultantCurrencyFor(country: string | null | undefined): "KRW" | "USD" | null {
  const c = (country ?? "").trim().toUpperCase();
  return c === "KR" ? "KRW" : c === "US" ? "USD" : null;
}

const workspaceEmailOk = (email: string | null | undefined) => (email ?? "").trim().toLowerCase().endsWith("@alton.education");

export function consultantChecklist(a: PrepareConsultantArgs): { key: string; label: string; ok: boolean }[] {
  const i = a.inputs ?? EMPTY_CONSULTANT_INPUTS;
  const want = consultantCurrencyFor(i.work_country);
  return [
    { key: "workspace", label: "컨설턴트 Workspace 계정(@alton.education) 연결 완료", ok: workspaceEmailOk(a.workspaceEmail) },
    {
      key: "location",
      label: "근무 위치 입력(국가·위치·우편 주소·시작일)",
      ok: !blank(i.work_country) && !blank(i.work_location_detail) && !blank(i.mailing_address) && !blank(i.start_date) && (i.work_country?.toUpperCase() !== "US" || !blank(i.work_region)),
    },
    { key: "currency", label: "근무 국가의 보수 통화 지원(한국=KRW, 미국=USD)", ok: want !== null },
    { key: "fee", label: `월 보수·통화 입력(${want ?? "통화 확인 필요"})`, ok: !!i.monthly_fee_minor && i.monthly_fee_minor > 0 && want !== null && i.monthly_fee_currency === want },
    { key: "scope", label: "월 업무 범위 입력", ok: !blank(i.monthly_scope) },
    { key: "payout_account", label: "수취 계좌 등록(정산 > 수취 계좌)", ok: !!a.payoutAccount && (!want || a.payoutAccount.currency === want) },
  ];
}

export function prepareConsultantAgreement(a: PrepareConsultantArgs): PrepareConsultantResult {
  const i = a.inputs ?? EMPTY_CONSULTANT_INPUTS;
  const missing: string[] = [];
  const checklist = consultantChecklist(a);
  const want = consultantCurrencyFor(i.work_country);
  const bad = (k: string) => !checklist.find((c) => c.key === k)?.ok;
  if (bad("workspace")) missing.push("컨설턴트 Workspace 계정(@alton.education) 연결");
  if (blank(i.work_country)) missing.push("실제 근무 국가");
  else if (want === null) missing.push("해당 국가의 보수 통화가 설정되지 않음(현재 KR=KRW, 미국=USD만 지원)");
  if (i.work_country?.toUpperCase() === "US" && blank(i.work_region)) missing.push("근무 주(미국)");
  if (blank(i.work_location_detail)) missing.push("근무 도시·지역");
  if (blank(i.mailing_address)) missing.push("우편 주소");
  if (blank(i.start_date)) missing.push("시작일");
  if (!i.monthly_fee_minor || i.monthly_fee_minor <= 0) missing.push("월 보수 금액");
  else if (want && i.monthly_fee_currency !== want) missing.push(`월 보수 통화는 ${want}이어야 합니다(현재 ${i.monthly_fee_currency ?? "미입력"})`);
  if (blank(i.monthly_scope)) missing.push("월 업무 범위");
  if (!a.payoutAccount) missing.push("수취 계좌 미등록 — 정산 > 수취 계좌에서 등록(컨설턴트 또는 관리자)");
  else if (want && a.payoutAccount.currency !== want) missing.push(`수취 계좌 통화(${a.payoutAccount.currency})가 보수 통화(${want})와 다릅니다`);
  if (missing.length > 0) return { ok: false, missing };

  const agreementId = a.agreementId ?? randomUUID();
  try {
    const html = renderConsultantAgreementHtml({
      teacherName: a.consultantName,
      teacherEmail: a.workspaceEmail!.trim().toLowerCase(),
      teacherAddress: i.mailing_address!,
      effectiveDate: i.start_date!,
      priorMaterials: blank(i.prior_materials) ? "None" : i.prior_materials!,
      actualWorkCountryAndLocation: `${countryName(i.work_country!)}${blank(i.work_region) ? "" : `, ${i.work_region}`} — ${i.work_location_detail!}`,
      paymentMethodAndRecipientDetails: bankTransferText(a.payoutAccount!),
      monthlyFee: { amountMinor: i.monthly_fee_minor!, currency: i.monthly_fee_currency! } as TeacherRate,
      monthlyServiceScope: i.monthly_scope!,
      companyApproval: {
        companyEntityName: COMPANY_NAME,
        approverName: TEACHER_APPROVER.name,
        approverTitle: TEACHER_APPROVER.title,
        approvedAtLabel: englishUtc(a.now ?? new Date()),
        documentIdentifier: agreementId,
      },
    });
    return { ok: true, html, templateVersion: CONSULTANT_TEMPLATE_VERSION, recipientEmail: a.workspaceEmail!.trim().toLowerCase(), agreementId };
  } catch (e) {
    if (e instanceof UnfilledContractError) return { ok: false, missing: e.problems };
    throw e;
  }
}
