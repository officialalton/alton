import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

// 조립 준비(무료): 커밋된 5세트 보수 계획(가상 0)을 세트별 선택 파일로 내보내고, 독립 검증기가 통과시키며 위반은 잡는다.
// 보수 묶음(structure-groups.conservative.json)으로 계산한 계획이라 같은 묶음으로 검증한다(묶음 파일은 모듈 로드 전에 환경변수로 지정).
process.env.STRUCTURE_GROUPS_FILE = "data/ap/stock/structure-groups.conservative.json";
const report = JSON.parse(readFileSync("data/ap/stock/exact-assign-5sets-cons.json", "utf-8"));
describe("assembly-keys", async () => {
  const { exportKeys, verifyFiles } = await import("../../scripts/ap-generation/assembly-keys");
  const dir = mkdtempSync(path.join(os.tmpdir(), "asm-"));
  const f = (id: string) => `${dir}/${id}.keys.json`;
  it("내보내기: 세트 5개, 덮어쓰기 거부", () => {
    expect(exportKeys(report, dir)).toHaveLength(5);
    expect(() => exportKeys(report, dir)).toThrow();
  });
  it("독립 검증 통과(위반 0)", () => { expect(verifyFiles(["BC1", "AB2", "AB3", "BC2", "BC3"].map(f))).toEqual([]); }, 120000);
  it("세트 간 중복·DB 검증 목록 밖 키를 잡는다", () => {
    const a = JSON.parse(readFileSync(f("BC1"), "utf-8")); const b = JSON.parse(readFileSync(f("AB2"), "utf-8"));
    b.keys.mcA[0] = a.keys.mcA[0]; writeFileSync(f("AB2x"), JSON.stringify(b));
    expect(verifyFiles([f("BC1"), f("AB2x")]).length).toBeGreaterThan(0);
    expect(verifyFiles([f("BC1")], { verified: new Set() }).length).toBeGreaterThan(0);
  }, 120000);
});
