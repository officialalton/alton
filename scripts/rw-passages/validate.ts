// 사용: npx tsx scripts/rw-passages/validate.ts data/rw-passages/<batchId>/passages.jsonl [더 많은 파일...]
// 한 줄에 지문 하나(JSON). 파일 여러 개를 주면 서로 간 중복·유사도도 함께 검사한다. 문제가 있으면 종료 코드 1.
import { readFileSync } from "node:fs";
import { validatePassages } from "../../lib/rw-passages/schema";

const files = process.argv.slice(2);
if (!files.length) { console.error("파일 경로를 주세요."); process.exit(2); }
const items: unknown[] = [];
for (const f of files) {
  const lines = readFileSync(f, "utf-8").split("\n").filter((l) => l.trim());
  lines.forEach((l, i) => { try { items.push(JSON.parse(l)); } catch { items.push({ id: `${f}:${i + 1}(JSON 오류)` }); } });
}
const { issues, ok } = validatePassages(items);
console.log(`총 ${items.length}건 · 통과 ${ok}건 · 문제 ${new Set(issues.map((x) => x.id)).size}건`);
for (const x of issues.slice(0, 200)) console.log(`- ${x.id} [${x.field}] ${x.message}`);
process.exit(issues.length ? 1 : 0);
