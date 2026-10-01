// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildSamplePdf } from "./sample-pdf";
import { kindForMime, probePdf, sha256Hex } from "./pdf";

describe("PDF 확인", () => {
  it("2페이지 표본 PDF 의 페이지 수와 지문을 읽는다", async () => {
    const bytes = buildSamplePdf(["Page one", "Page two"]);
    const probe = await probePdf(bytes);
    expect(probe.pageCount).toBe(2);
    expect(probe.bytes).toBe(bytes.byteLength);
    expect(probe.sha256).toBe(sha256Hex(bytes));
    expect(probe.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("내용이 다르면 지문이 다르고, 같으면 같다", async () => {
    const a = buildSamplePdf(["A", "B"]);
    const b = buildSamplePdf(["A", "B"]);
    const c = buildSamplePdf(["A", "C"]);
    expect(sha256Hex(a)).toBe(sha256Hex(b));
    expect(sha256Hex(a)).not.toBe(sha256Hex(c));
  });

  it("PDF 가 아니면 던진다 — 페이지 수를 모르는 파일은 공개하지 않는다", async () => {
    await expect(probePdf(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow();
  });

  it("MIME 으로 자료 종류를 가른다 — 그 밖의 파일은 등록하지 않는다", () => {
    expect(kindForMime("application/pdf")).toBe("pdf");
    expect(kindForMime("video/mp4")).toBe("video");
    expect(kindForMime("image/png")).toBeNull();
    expect(kindForMime("application/vnd.google-apps.folder")).toBeNull();
  });
});
