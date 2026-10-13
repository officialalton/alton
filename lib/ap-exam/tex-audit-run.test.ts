// 전수 점검 실행기(평소엔 건너뜀): AP_TEX_AUDIT_OUT=<경로> npx vitest run lib/ap-exam/tex-audit-run.test.ts
import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { buildAuditReport } from "./tex-audit-report";

it.skipIf(!process.env.AP_TEX_AUDIT_OUT)("write audit report", () => {
  const r = buildAuditReport();
  writeFileSync(process.env.AP_TEX_AUDIT_OUT!, JSON.stringify(r, null, 1));
  const { rows, ...sum } = r;
  console.log(JSON.stringify(sum, null, 1));
});
