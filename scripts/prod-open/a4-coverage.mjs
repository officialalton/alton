import fs from "node:fs";
const d = JSON.parse(fs.readFileSync("tmp/bank-dump-a4/dump.json", "utf8"));
const sets = d.sets.filter((s) => /^SAT Practice Test/.test(s.name) && !s.archived_at && ["published", "draft"].includes(s.status));
const rows = [];
for (const s of sets) {
  const its = d.items.filter((i) => i.exam_set_id === s.id);
  const q = its.filter((i) => i.skill_code === "command_of_evidence_quant");
  rows.push([s.name, s.status, its.length, q.length]);
}
rows.sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
for (const r of rows) console.log(r.join("\t"));
const all = d.problems.filter((p) => p.skill_code === "command_of_evidence_quant");
console.log("bank quant problems", all.length, JSON.stringify(all.reduce((a, p) => ((a[p.status] = (a[p.status] || 0) + 1), a), {})));
