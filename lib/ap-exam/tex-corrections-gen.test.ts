// 교정 파일 생성기(평소엔 건너뜀): AP_TEX_CORR_WRITE=1 npx vitest run lib/ap-exam/tex-corrections-gen.test.ts → data/ap/stock/tex-corrections.json
// 평소 실행에서는 저장소의 교정 파일이 "현재 재고로 다시 계산한 결과"와 같은지(오래되지 않았는지) 확인한다.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { correctionsForStock, CORRECTION_FILE, type CorrectionFile } from "../ap-admin/explanation-fix";
import { loadMembership } from "./tex-audit-report";

const DIR = "data/ap/stock";
function build(): CorrectionFile {
  const mem = loadMembership(DIR);
  const byKey = new Map<string, never>();
  for (const f of readdirSync(DIR).filter((x) => /items\.json$/.test(x)).sort()) for (const it of JSON.parse(readFileSync(path.join(DIR, f), "utf-8")) as { stockKey: string; validation?: string }[]) if (it.stockKey && !byKey.has(it.stockKey)) byKey.set(it.stockKey, it as never);
  const entries = [...byKey.values()].filter((it: { validation?: string }) => it.validation === "auto_passed").flatMap((it: { stockKey: string }) => {
    const sets = Object.keys(mem).filter((k) => mem[k].has(it.stockKey));
    return correctionsForStock(it as never, sets);
  }).sort((a, b) => (a.candidateKey + a.itemIndex).localeCompare(b.candidateKey + b.itemIndex));
  return { kind: "ap_explanation_math_correction", version: 1, generatedBy: "lib/ap-exam/tex-corrections-gen.test.ts (AP_TEX_CORR_WRITE=1)", note: "변환 전 해설(explanation_en)의 sha256 에 묶인 교정 문안. 적용은 관리자 'AP 설명 수정 새 버전'(미리보기→확인→실행)만. before 해시가 DB 와 다르면 건드리지 않는다.", count: entries.length, entries };
}

describe("tex-corrections.json", () => {
  it.skipIf(!process.env.AP_TEX_CORR_WRITE)("write", () => { writeFileSync(CORRECTION_FILE, JSON.stringify(build(), null, 1) + "\n"); });
  it.skipIf(!!process.env.AP_TEX_CORR_WRITE)("저장소 교정 파일이 현재 재고에서 다시 계산한 결과와 같다", () => {
    const cur = JSON.parse(readFileSync(CORRECTION_FILE, "utf-8")) as CorrectionFile;
    expect(cur).toEqual(build());
    expect(cur.count).toBeGreaterThan(0);
  });
});
