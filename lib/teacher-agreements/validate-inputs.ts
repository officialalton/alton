import type { TeacherAgreementInputs } from "./prepare";

type TextKey = Exclude<keyof TeacherAgreementInputs, "engagement_type">;
const LIMITS: Record<TextKey, [number, number]> = {
  work_country: [2, 2],
  work_region: [2, 60],
  work_location_detail: [2, 200],
  mailing_address: [5, 300],
  start_date: [10, 10],
  supervisor_name: [2, 120],
  prior_materials: [2, 2000],
};

const LABEL: Record<TextKey, string> = {
  work_country: "근무 국가",
  work_region: "근무 주",
  work_location_detail: "근무 위치",
  mailing_address: "우편 주소",
  start_date: "시작일",
  supervisor_name: "감독자 이름",
  prior_materials: "기존 자료",
};

export type ValidatedInputs = { ok: true; value: TeacherAgreementInputs } | { ok: false; error: string };

/** Trims, turns blanks into null and enforces the same bounds as the table's check constraints. */
export function validateTeacherAgreementInputs(raw: Partial<Record<keyof TeacherAgreementInputs, string | null | undefined>>): ValidatedInputs {
  const out = {} as TeacherAgreementInputs;
  const eng = (raw.engagement_type ?? "contractor").toString().trim() || "contractor";
  if (eng !== "contractor" && eng !== "employee") return { ok: false, error: "계약 형태는 프리랜서(contractor) 또는 직원(employee)이어야 합니다." };
  out.engagement_type = eng;
  for (const key of Object.keys(LIMITS) as TextKey[]) {
    let v = (raw[key] ?? "").toString().trim();
    if (key === "work_country") v = v.toUpperCase();
    if (!v) {
      out[key] = null;
      continue;
    }
    const [min, max] = LIMITS[key];
    if (v.length < min || v.length > max) return { ok: false, error: `${LABEL[key]} 값의 길이가 올바르지 않습니다.` };
    if (key === "work_country" && !/^[A-Z]{2}$/.test(v)) return { ok: false, error: "근무 국가는 2자리 국가 코드(예: US, KR)로 입력하세요." };
    if (key === "start_date") {
      const d = new Date(`${v}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) {
        return { ok: false, error: "시작일은 YYYY-MM-DD 형식의 올바른 날짜여야 합니다." };
      }
    }
    if (key === "prior_materials") {
      const bad = sensitiveNumberProblem(v);
      if (bad) return { ok: false, error: bad };
    }
    out[key] = v;
  }
  if (out.work_country !== "US" && out.work_region) out.work_region = null;
  return { ok: true, value: out };
}

/**
 * Contract PDFs must not carry full account or tax numbers. Payment details may hold method, currency, recipient name
 * and at most the last 4 digits; any run of more than 8 digits (spaces/hyphens inside a run are ignored) is rejected.
 */
export function sensitiveNumberProblem(text: string): string | null {
  for (const run of text.match(/\d(?:[\s-]?\d)+/g) ?? []) {
    if (run.replace(/\D/g, "").length > 8) {
      return "지급 정보에는 전체 계좌번호·세금 식별번호를 넣을 수 없습니다. 방법, 통화, 수령인 이름과 계좌 끝 4자리까지만 입력하고, 전체 정보는 정산 계좌·세금 화면에 입력하세요.";
    }
  }
  return null;
}
