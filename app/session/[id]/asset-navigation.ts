import type { MaterialAsset } from "./material-data";

// 파일 자료 사이의 이동 — PDF 는 페이지 단위, 영상은 한 덩어리.
//
// "마지막 페이지의 다음 이동은 다음 자료로 이어진다"(2026-09-14). 이동 규칙을 순수
// 함수로 두어 화면 없이 검증한다.

export type AssetPosition = { assetIndex: number; page: number };

export function pageCountOf(asset: MaterialAsset): number {
  return asset.kind === "pdf" ? Math.max(1, asset.pageCount ?? 1) : 1;
}

export function nextPosition(assets: MaterialAsset[], pos: AssetPosition): AssetPosition | null {
  const asset = assets[pos.assetIndex];
  if (!asset) return null;
  if (pos.page < pageCountOf(asset)) return { assetIndex: pos.assetIndex, page: pos.page + 1 };
  if (pos.assetIndex + 1 < assets.length) return { assetIndex: pos.assetIndex + 1, page: 1 };
  return null;
}

export function prevPosition(assets: MaterialAsset[], pos: AssetPosition): AssetPosition | null {
  const asset = assets[pos.assetIndex];
  if (!asset) return null;
  if (pos.page > 1) return { assetIndex: pos.assetIndex, page: pos.page - 1 };
  if (pos.assetIndex > 0) {
    const prev = assets[pos.assetIndex - 1];
    return { assetIndex: pos.assetIndex - 1, page: pageCountOf(prev) };
  }
  return null;
}

/** 목차 한 줄 — 자료마다 하나, PDF 는 페이지도 편다. */
export type TocEntry = { label: string; position: AssetPosition; isPage: boolean };

export function tableOfContents(assets: MaterialAsset[]): TocEntry[] {
  const out: TocEntry[] = [];
  assets.forEach((a, i) => {
    out.push({ label: a.title, position: { assetIndex: i, page: 1 }, isPage: false });
    if (a.kind === "pdf") {
      for (let p = 1; p <= pageCountOf(a); p += 1) {
        out.push({ label: `${p}쪽`, position: { assetIndex: i, page: p }, isPage: true });
      }
    }
  });
  return out;
}
