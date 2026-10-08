// '확인' 목록 내보내기 — 오너가 개발자에게 전달하는 마크다운 복사본과 CSV(순수 함수, 서버 의존 없음).
import { REPORT_TYPE_LABEL, type ReportType } from "./labels";

export type ConfirmedExportRow = {
  problemId: string; versionId: string; versionNo: number; currentVersionNo: number | null;
  satDomain: string | null; skillCode: string | null; difficulty: string | null; confirmedAt: string; confirmNote: string | null;
  hasExplanationEn: boolean; hasExplanationKo: boolean;
  sets: { name: string; module: string | null; position: number }[];
  reports: { type: ReportType; memo: string | null; reporter: string | null; role: string; at: string }[];
};

const MODULE: Record<string, string> = { rw_m1: "R&W M1", rw_m2: "R&W M2", math_m1: "Math M1", math_m2: "Math M2" };
const yn = (b: boolean) => (b ? "있음" : "없음");
const setText = (r: ConfirmedExportRow) => r.sets.length ? r.sets.map((s) => `${s.name} ${s.module ? MODULE[s.module] ?? s.module : "고정형"} #${s.position}`).join("; ") : "(세트 미사용)";
const reportText = (x: ConfirmedExportRow["reports"][number]) => `${REPORT_TYPE_LABEL[x.type]}${x.memo ? ` — ${x.memo.replace(/\s+/g, " ")}` : ""} (${x.role === "teacher" ? "선생님" : "학생"} ${x.reporter ?? "?"})`;

export function confirmedToMarkdown(rows: ConfirmedExportRow[]): string {
  if (rows.length === 0) return "# 오류 신고 확인 목록\n\n(확인된 문항 없음)\n";
  const out = [`# 오류 신고 확인 목록 (${rows.length}건)`, ""];
  rows.forEach((r, i) => {
    out.push(`## ${i + 1}. ${r.problemId} (v${r.versionNo}${r.currentVersionNo && r.currentVersionNo !== r.versionNo ? ` → 현재 v${r.currentVersionNo}` : ""})`);
    out.push(`- 세트·모듈·위치: ${setText(r)}`);
    out.push(`- 세부 기술·난이도: ${r.skillCode ?? r.satDomain ?? "-"} · ${r.difficulty ?? "-"}`);
    out.push(`- 해설: 영어 ${yn(r.hasExplanationEn)} / 한글 ${yn(r.hasExplanationKo)}`);
    if (r.confirmNote) out.push(`- 확인 메모: ${r.confirmNote.replace(/\s+/g, " ")}`);
    out.push(`- 신고 ${r.reports.length}건:`);
    for (const x of r.reports) out.push(`  - ${reportText(x)}`);
    out.push("");
  });
  return out.join("\n");
}

function csvCell(v: string | number | null): string {
  const s = v === null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function confirmedToCsv(rows: ConfirmedExportRow[]): string {
  const head = ["problem_id", "version", "current_version", "sets_module_position", "skill", "difficulty", "report_types", "report_memos", "reporters", "explanation_en", "explanation_ko", "confirmed_at", "confirm_note"];
  const lines = [head.join(",")];
  for (const r of rows) {
    lines.push([
      r.problemId, r.versionNo, r.currentVersionNo, setText(r), r.skillCode ?? r.satDomain, r.difficulty,
      [...new Set(r.reports.map((x) => REPORT_TYPE_LABEL[x.type]))].join("; "),
      r.reports.map((x) => x.memo?.replace(/\s+/g, " ") ?? "").filter(Boolean).join(" | "),
      r.reports.map((x) => x.reporter ?? "").join("; "),
      yn(r.hasExplanationEn), yn(r.hasExplanationKo), r.confirmedAt, r.confirmNote,
    ].map(csvCell).join(","));
  }
  return "﻿" + lines.join("\n") + "\n";
}
