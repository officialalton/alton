// 담당 D 원형 Preview 육안 확인 샘플 — 실행: npx tsx scripts/mock-exam-generation/archetype-samples-d.ts [--id lat.] [--out data/mock-exam-generation/math-archetype-D/samples.tsv]
// 원형당 2건(시드 11, 12 이후 첫 성공). 열: 원형ID, 난이도, 변형, 지문, 질문, 선지, 정답(1~4), 의미 일치 점검 포인트(명사→값 표)
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { D_ARCHETYPES } from "../../lib/problem-generation/math-archetypes/registry-d";
import { verifyLevel, type BInstance } from "../../lib/problem-generation/math-archetypes/levels-d";
import { generateOne } from "../../lib/problem-generation/math-archetypes/sweep";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const prefix = arg("--id") ?? ""; const out = arg("--out") ?? "data/mock-exam-generation/math-archetype-D/samples.tsv";
const esc = (s: string) => s.replace(/\t/g, " ").replace(/\n/g, " ⏎ ");
const rows = ["archetype\tlevel\tvariant\tstimulus\tquestion\toptions\tanswer\tmeaning_check"];
for (const a of D_ARCHETYPES.filter((x) => x.id.startsWith(prefix))) {
  let found = 0;
  for (let s = 11; s < 400 && found < 2; s++) {
    const g = generateOne(a, s); if (!g.ok) continue; const inst = g.inst as BInstance; if (!verifyLevel(a, inst).ok) continue;
    const mc = (inst.bindings ?? []).map((b) => `${Array.isArray(b.noun) ? b.noun.join("|") : b.noun}=${b.value}`).join("; ") || "(선지 서술형 — 지문 키워드→정답 규칙 일치)";
    rows.push([a.id, a.level, inst.variant, inst.stimulus, inst.question, inst.options.map((o, i) => `${"ABCD"[i]}) ${o}`).join(" | "), String(inst.correctIndex + 1), `${mc}. 점검: 지문의 명사와 수식·값이 짝이 맞는지, 질문이 묻는 대상이 정답 선지와 일치하는지`].map(esc).join("\t"));
    found++;
  }
}
mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, rows.join("\n") + "\n"); console.log(`wrote ${rows.length - 1} rows -> ${out}`);
