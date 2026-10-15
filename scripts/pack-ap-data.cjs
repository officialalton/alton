// 빌드 직전 실행: data/ap 의 JSON 을 옆에 `.json.gz` 로 압축한다. 저장소에는 넣지 않는다(.gitignore).
// next.config.ts 가 /admin 람다에는 원본 JSON 대신 이 .gz 만 넣는다 → lib/ap-generation/data-fs.ts 가 원본이 없을 때 .gz 를 읽는다.
// `npm run build`(package.json)와 `next build`(next.config.ts 가 로드될 때) 어느 쪽으로 빌드해도 만들어지도록 둘 다 부른다. 이미 최신이면 건너뛴다.
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const DIRS = ["data/ap/stock", "data/ap/stock/assembled", "data/ap/screen-evidence", "data/ap/render-check"];
function packApData(root = process.cwd()) {
  let n = 0, raw = 0, gz = 0, written = 0;
  for (const d of DIRS) {
    const dir = path.join(root, d);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".json")) continue;
      const p = path.join(dir, f), dst = p + ".gz", st = fs.statSync(p);
      n++; raw += st.size;
      if (fs.existsSync(dst) && fs.statSync(dst).mtimeMs >= st.mtimeMs) { gz += fs.statSync(dst).size; continue; }
      const out = zlib.gzipSync(fs.readFileSync(p), { level: 9 });
      fs.writeFileSync(dst, out); gz += out.length; written++;
    }
  }
  return { files: n, written, rawBytes: raw, gzBytes: gz };
}
module.exports = { packApData };
if (require.main === module) {
  const r = packApData();
  console.log(`pack-ap-data: ${r.files} files (${r.written} written), ${(r.rawBytes / 1e6).toFixed(1)} MB -> ${(r.gzBytes / 1e6).toFixed(1)} MB gz`);
}
