// 보강(supplement, 2026-10-09 오너 승인) 배치 레지스트리. 새 배치는 여기 한 줄만 추가하면 stock.ts 와 모든 재고 스크립트(keys-file·render-check·screen-evidence·six-set-plan …)가 읽는다.
// run = 최종 런 디렉터리(data/ap/sample-2027/<run>), file = 재고 보조 파일(data/ap/stock/<file>).
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

export const SUPP_BATCHES: { run: string; file: string }[] = [
  { run: "supp-b1-bc-final", file: "supp-b1-items.json" },
  { run: "supp-b2-ab-final", file: "supp-b2ab-items.json" },
  { run: "supp-b2-bc-final", file: "supp-b2bc-items.json" },
  { run: "supp-b3-ab-final", file: "supp-b3ab-items.json" },
  { run: "supp-b3-bc-final", file: "supp-b3bc-items.json" },
  { run: "supp-b3-fa-final", file: "supp-b3fa-items.json" },
  { run: "supp-b4-ab-final", file: "supp-b4ab-items.json" },
  { run: "supp-b5-bc-final", file: "supp-b5bc-items.json" },
  { run: "supp-b6-ab-final", file: "supp-b6ab-items.json" },
  // 2026-10-12 예비 보충 2차(docs/ap/reserve-topup-2.md)
  { run: "supp-t2a-ab-final", file: "supp-t2a-items.json" },
  { run: "supp-t2b-ab-final", file: "supp-t2b-items.json" },
  // 2026-10-12 예비 3차(docs/ap/reserve-r3-report.md)
  { run: "supp-r3a-ab-final", file: "supp-r3a-items.json" },
  { run: "supp-r3b-ab-final", file: "supp-r3b-items.json" },
  { run: "supp-r3b2-ab-final", file: "supp-r3b2-items.json" },
  { run: "supp-r3c-ab-final", file: "supp-r3c-items.json" },
  { run: "supp-r3c2-ab-final", file: "supp-r3c2-items.json" },
];

/** 디스크에 실제로 있는 보강 배치 파일 이름(확장자 없음). */
export const suppItemNames = (): string[] =>
  SUPP_BATCHES.map((b) => b.file.replace(/\.json$/, "")).filter((n) => existsSync(path.resolve(process.cwd(), `data/ap/stock/${n}.json`)));

/**
 * AP Computer Science A 재고 파일(data/ap/stock/csa-<배치>-items.json, 2026-10-13). 이름 규칙을 따르는 파일은 디스크에서 찾으므로 새 배치마다 keys-file·render-check 목록을 고치지 않는다
 * (예: csa-p1a-items.json, csa-p1b-items.json, csa-s2a-items.json). 관리자 적재 배치(lib/ap-admin/batches.ts STOCK_BATCHES)는 적재 시점에 따로 등록한다.
 */
export const CSA_ITEM_FILE_RE = /^csa-[a-z0-9]+(?:-[a-z0-9]+)*-items\.json$/;
export const csaItemNames = (): string[] => {
  const dir = path.resolve(process.cwd(), "data/ap/stock");
  return existsSync(dir) ? readdirSync(dir).filter((f) => CSA_ITEM_FILE_RE.test(f)).map((f) => f.replace(/\.json$/, "")).sort() : [];
};

/**
 * AP Biology 재고 파일(data/ap/stock/bio-<배치>-items.json, 2026-10-14). csa 와 같은 이름 규칙: 새 배치마다 keys-file·render-check 목록을 고치지 않는다.
 * 관리자 적재 배치(lib/ap-admin/batches.ts STOCK_BATCHES)는 적재 시점에 따로 등록한다.
 */
export const BIO_ITEM_FILE_RE = /^bio-[a-z0-9]+(?:-[a-z0-9]+)*-items\.json$/;
export const bioItemNames = (): string[] => {
  const dir = path.resolve(process.cwd(), "data/ap/stock");
  return existsSync(dir) ? readdirSync(dir).filter((f) => BIO_ITEM_FILE_RE.test(f)).map((f) => f.replace(/\.json$/, "")).sort() : [];
};

/**
 * AP English Language 재고 파일(data/ap/stock/el-<배치>-items.json, 2026-10-14). 이름 규칙을 따르는 파일은 디스크에서 찾으므로 새 배치마다 keys-file·render-check 목록을 고치지 않는다
 * (예: el-p1a-items.json, el-p2a-items.json, el-p2f-items.json). 관리자 적재 배치(lib/ap-admin/batches.ts STOCK_BATCHES)는 적재 시점에 따로 등록한다.
 */
export const EL_ITEM_FILE_RE = /^el-[a-z0-9]+(?:-[a-z0-9]+)*-items\.json$/;
export const elItemNames = (): string[] => {
  const dir = path.resolve(process.cwd(), "data/ap/stock");
  return existsSync(dir) ? readdirSync(dir).filter((f) => EL_ITEM_FILE_RE.test(f)).map((f) => f.replace(/\.json$/, "")).sort() : [];
};
