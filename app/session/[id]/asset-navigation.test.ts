import { describe, expect, it } from "vitest";
import { nextPosition, prevPosition, tableOfContents } from "./asset-navigation";
import type { MaterialAsset } from "./material-data";

const pdf = (id: string, pages: number): MaterialAsset => ({
  docId: id, versionId: `${id}-v`, kind: "pdf", title: id, pageCount: pages, mimeType: "application/pdf",
});
const video = (id: string): MaterialAsset => ({
  docId: id, versionId: `${id}-v`, kind: "video", title: id, pageCount: null, mimeType: "video/mp4",
});

describe("자료 사이 이동", () => {
  const assets = [pdf("A", 2), video("V"), pdf("B", 1)];

  it("PDF 마지막 페이지의 다음은 다음 자료, 영상의 다음은 그 다음 자료", () => {
    expect(nextPosition(assets, { assetIndex: 0, page: 1 })).toEqual({ assetIndex: 0, page: 2 });
    expect(nextPosition(assets, { assetIndex: 0, page: 2 })).toEqual({ assetIndex: 1, page: 1 });
    expect(nextPosition(assets, { assetIndex: 1, page: 1 })).toEqual({ assetIndex: 2, page: 1 });
    expect(nextPosition(assets, { assetIndex: 2, page: 1 })).toBeNull();
  });

  it("이전은 앞 자료의 마지막 페이지로 돌아간다", () => {
    expect(prevPosition(assets, { assetIndex: 2, page: 1 })).toEqual({ assetIndex: 1, page: 1 });
    expect(prevPosition(assets, { assetIndex: 1, page: 1 })).toEqual({ assetIndex: 0, page: 2 });
    expect(prevPosition(assets, { assetIndex: 0, page: 1 })).toBeNull();
  });

  it("목차는 자료마다 한 줄, PDF 는 페이지를 편다", () => {
    expect(tableOfContents(assets).map((t) => t.label)).toEqual(["A", "1쪽", "2쪽", "V", "B", "1쪽"]);
  });
});
