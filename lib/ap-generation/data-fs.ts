// 배포 번들 크기 절감(2026-10-15, docs/vercel-function-size.md): /admin 람다는 AP 재고 JSON(data/ap/**, 원본 약 50 MB)을 파일로 읽는다.
// 빌드 직전 scripts/pack-ap-data.cjs 가 JSON 마다 옆에 `.json.gz` 를 만들고(저장소에는 넣지 않는다), next.config.ts 가 /admin 추적에서 원본 JSON 을 빼고 .gz 만 넣는다.
// 이 모듈은 node:fs 의 readFileSync·existsSync·readdirSync 와 같은 모양으로, 원본이 없을 때만 `.gz` 로 대신한다 → 로컬·스크립트(원본 있음)는 동작이 그대로다.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const underDataAp = (p: string) => /(^|[\\/])data[\\/]ap[\\/]/.test(p);

export function existsSync(p: string): boolean {
  return fs.existsSync(p) || (underDataAp(p) && p.endsWith(".json") && fs.existsSync(p + ".gz"));
}

/** 원본이 있으면 원본, 없고 `.gz` 가 있으면 풀어서 돌려준다. 인코딩을 주면 문자열, 안 주면 Buffer(해시용 이진 읽기) — node:fs 와 같다. */
export function readFileSync(p: string): Buffer;
export function readFileSync(p: string, enc: BufferEncoding | { encoding: BufferEncoding }): string;
export function readFileSync(p: string, enc?: BufferEncoding | { encoding: BufferEncoding }): string | Buffer {
  const raw = !fs.existsSync(p) && underDataAp(p) && p.endsWith(".json") && fs.existsSync(p + ".gz") ? zlib.gunzipSync(fs.readFileSync(p + ".gz")) : fs.readFileSync(p);
  if (enc === undefined) return raw;
  return raw.toString(typeof enc === "string" ? enc : enc.encoding);
}

/** 디렉터리 목록: `x.json.gz` 는 `x.json` 으로 보이게 하고 중복을 없앤다(원본과 .gz 가 함께 있어도 한 번만). */
export function readdirSync(dir: string): string[] {
  const names = fs.readdirSync(dir);
  if (!underDataAp(path.join(dir, "x"))) return names;
  return [...new Set(names.map((n) => (n.endsWith(".json.gz") ? n.slice(0, -3) : n)))];
}
