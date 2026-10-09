// 보강(supplement, 2026-10-09 오너 승인) 배치 레지스트리. 새 배치는 여기 한 줄만 추가하면 stock.ts 와 모든 재고 스크립트(keys-file·render-check·screen-evidence·six-set-plan …)가 읽는다.
// run = 최종 런 디렉터리(data/ap/sample-2027/<run>), file = 재고 보조 파일(data/ap/stock/<file>).
import { existsSync } from "node:fs";
import path from "node:path";

export const SUPP_BATCHES: { run: string; file: string }[] = [
  { run: "supp-b1-bc-final", file: "supp-b1-items.json" },
];

/** 디스크에 실제로 있는 보강 배치 파일 이름(확장자 없음). */
export const suppItemNames = (): string[] =>
  SUPP_BATCHES.map((b) => b.file.replace(/\.json$/, "")).filter((n) => existsSync(path.resolve(process.cwd(), `data/ap/stock/${n}.json`)));
