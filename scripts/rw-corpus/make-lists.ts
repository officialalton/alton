// 목록 생성 CLI. 사용: npx tsx scripts/rw-corpus/make-lists.ts --source gutenberg|medlineplus|plos --out list.jsonl [--date YYYY-MM-DD]
//  gutenberg : ~/Developer/ALTON-data/rw-corpus/catalog/gutenberg_selected.json (gutenberg_select.py 출력) 필요.
//  medlineplus: --date 미지정이면 최근 7일을 공식 서버에 HEAD 로 확인해 존재하는 가장 최근 파일을 쓴다(네트워크 HEAD 1~7회).
//  plos      : 네트워크 없음(API URL 목록만 만든다).
import { readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { gutenbergRows, medlineRows, plosRows, toJsonl, type Selected } from "./lists";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
async function latestMedlineDate(): Promise<string> {
  for (let back = 0; back < 8; back++) {
    const d = new Date(Date.now() - back * 86400000).toISOString().slice(0, 10);
    const r = await fetch(`https://medlineplus.gov/xml/mplus_topics_${d}.xml`, { method: "HEAD", headers: { "User-Agent": `ALTON-corpus-collector/0.1 (${process.env.CORPUS_CONTACT ?? "contact unset"})` } });
    if (r.ok) return d;
    await new Promise((x) => setTimeout(x, 1000));
  }
  throw new Error("최근 7일 안에 MedlinePlus 토픽 XML 이 없습니다(--date 로 지정)");
}
(async () => {
  const source = arg("--source"), out = arg("--out");
  if (!source || !out) throw new Error("--source 와 --out 필요");
  let res: { rows: import("./lists").Row[]; dropped: number; estMB: number };
  if (source === "gutenberg") {
    const sel = JSON.parse(readFileSync(path.join(os.homedir(), "Developer/ALTON-data/rw-corpus/catalog/gutenberg_selected.json"), "utf-8")) as Selected[];
    res = gutenbergRows(sel);
  } else if (source === "medlineplus") res = medlineRows(arg("--date") ?? (await latestMedlineDate()));
  else if (source === "plos") res = plosRows();
  else throw new Error(`알 수 없는 원천: ${source}`);
  writeFileSync(out, toJsonl(res.rows));
  console.log(JSON.stringify({ source, out, rows: res.rows.length, droppedByCaps: res.dropped, estimatedMB: res.estMB }));
})().catch((e) => { console.error(e.message); process.exit(1); });
