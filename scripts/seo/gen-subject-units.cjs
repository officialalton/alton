// data/ap/curriculum-2027 → lib/landing/subject-units.generated.ts (공개 과목 페이지용 단원명·MC 가중치만). 문항 내용 없음.
const fs = require("node:fs"), path = require("node:path");
const dir = "data/ap/curriculum-2027", out = {};
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  const w = new Map(d.weights.filter((x) => x.axis === "unit" && x.section === "mc").map((x) => [String(x.code), [x.min, x.max]]));
  out[d.subject.apCode] = d.units.map((u) => ({ code: String(u.code), title: u.title, ...(w.has(String(u.code)) ? { mc: w.get(String(u.code)) } : {}) }));
}
const body = `// 자동 생성: node scripts/seo/gen-subject-units.cjs — 직접 수정하지 않는다.\nexport type SubjectUnit = { code: string; title: string; mc?: [number, number] };\nexport const SUBJECT_UNITS: Record<string, SubjectUnit[]> = ${JSON.stringify(out, null, 1)};\n`;
fs.writeFileSync("lib/landing/subject-units.generated.ts", body);
