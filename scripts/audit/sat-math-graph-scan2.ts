// 후보 점검: 그래프(plane) + 지문에 숫자만으로 완전히 주어진 식(미지 상수 없음)이 같이 있는 문항. 읽기 전용 rows.json 입력.
import { readFileSync } from "node:fs";
const j = JSON.parse(readFileSync(process.argv[2], "utf-8"));
const rows = j.rows ?? j;
const seen = new Map<string, any>();
for (const r of rows) {
  if (r.figure?.type !== "plane" || !Array.isArray(r.figure.objects) || !r.figure.objects.some((o: any) => o.kind === "function" || o.kind === "line")) continue;
  const p: string = r.passage ?? "";
  const eqs = [...p.matchAll(/(?:\$\$?)?\s*([A-Za-z](?:\([a-z]\))?)\s*=\s*([^$\n]+?)\s*(?:\$|\n|$|\.\s|,\s*where)/g)];
  const full = eqs.filter((m) => {
    const rhs = m[2].replace(/\\(cdot|frac|sqrt|left|right|times)/g, "").replace(/[{}^+\-*/().\d\s|]/g, "");
    return new Set(rhs.split("")).size <= 1 && /\d/.test(m[2]);
  });
  if (!full.length) continue;
  const e = seen.get(r.problem_id) ?? { p: r, sets: [] as string[] };
  e.sets.push(`${r.set_name} ${r.module_key}#${r.position}`);
  seen.set(r.problem_id, e);
}
console.log(seen.size);
for (const e of seen.values()) console.log("\n##", e.p.problem_id, e.p.version_id, e.sets.join("; "), "\nP:", e.p.passage, "\nQ:", e.p.question, "\nA:", e.p.options?.[e.p.correct_index], "\nE:", e.p.explanation_en);
