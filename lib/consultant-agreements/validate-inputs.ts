import type { ConsultantAgreementInputs } from "./prepare";
import { sensitiveNumberProblem } from "@/lib/teacher-agreements/validate-inputs";

export type RawConsultantInputs = Partial<Record<keyof ConsultantAgreementInputs | "monthly_fee_amount", string | number | null | undefined>>;

const TEXT: Record<"work_country" | "work_region" | "work_location_detail" | "mailing_address" | "start_date" | "monthly_scope" | "prior_materials", [number, number, string]> = {
  work_country: [2, 2, "근무 국가"],
  work_region: [2, 60, "근무 주"],
  work_location_detail: [2, 200, "근무 위치"],
  mailing_address: [5, 300, "우편 주소"],
  start_date: [10, 10, "시작일"],
  monthly_scope: [2, 2000, "월 업무 범위"],
  prior_materials: [2, 2000, "기존 자료"],
};

/**
 * Trims and bounds-checks consultant inputs. `monthly_fee_amount` is the admin-typed amount in major units
 * (KRW won / USD dollars); it is stored as minor units (USD cents). No currency conversion anywhere.
 */
export function validateConsultantAgreementInputs(raw: RawConsultantInputs): { ok: true; value: ConsultantAgreementInputs } | { ok: false; error: string } {
  const out: ConsultantAgreementInputs = {
    work_country: null, work_region: null, work_location_detail: null, mailing_address: null, start_date: null,
    monthly_fee_minor: null, monthly_fee_currency: null, monthly_scope: null, prior_materials: null,
  };
  for (const key of Object.keys(TEXT) as (keyof typeof TEXT)[]) {
    let v = (raw[key] ?? "").toString().trim();
    if (key === "work_country") v = v.toUpperCase();
    if (!v) continue;
    const [min, max, label] = TEXT[key];
    if (v.length < min || v.length > max) return { ok: false, error: `${label} 값의 길이가 올바르지 않습니다.` };
    if (key === "work_country" && !/^[A-Z]{2}$/.test(v)) return { ok: false, error: "근무 국가는 2자리 국가 코드(예: US, KR)로 입력하세요." };
    if (key === "start_date") {
      const d = new Date(`${v}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return { ok: false, error: "시작일은 YYYY-MM-DD 형식의 올바른 날짜여야 합니다." };
    }
    if (key === "prior_materials") {
      const bad = sensitiveNumberProblem(v);
      if (bad) return { ok: false, error: bad };
    }
    out[key] = v;
  }
  if (out.work_country !== "US") out.work_region = null;

  const currency = (raw.monthly_fee_currency ?? "").toString().trim().toUpperCase();
  const amountText = (raw.monthly_fee_amount ?? "").toString().trim();
  if (currency || amountText) {
    if (currency !== "KRW" && currency !== "USD") return { ok: false, error: "월 보수 통화는 KRW 또는 USD여야 합니다." };
    const amount = Number(amountText);
    if (!amountText || !Number.isFinite(amount) || amount <= 0) return { ok: false, error: "월 보수는 0보다 큰 금액으로 입력하세요." };
    const minor = currency === "USD" ? Math.round(amount * 100) : Math.round(amount);
    if (minor <= 0) return { ok: false, error: "월 보수가 너무 작습니다." };
    out.monthly_fee_minor = minor;
    out.monthly_fee_currency = currency;
  }
  return { ok: true, value: out };
}
