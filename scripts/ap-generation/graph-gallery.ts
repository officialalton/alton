// 그래프 원형 갤러리(무료·로컬): 원형별 첫 팩의 그림(SVG)과 문항을 HTML 한 장으로 만든다. 출력 경로는 --out (기본: 스크래치).
//   npx tsx scripts/ap-generation/graph-gallery.ts --list graph_s1_ab --subject ap_calculus_ab --out <dir> [--png]
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { gateCandidate } from "../../lib/ap-figures/gate";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const LIST = arg("--list", "graph_s1_ab"); const SUBJECT = arg("--subject", "ap_calculus_ab"); const SEED0 = Number(arg("--seed0", "3100")); const OUT = path.resolve(arg("--out", "/tmp/graph-gallery"));
const PY = process.env.AP_PY ?? "/private/tmp/claude-501/-Users-jangjiman-Developer-ALTON/d05b2ffe-5d6e-4058-a909-5e3b8827cbe2/scratchpad/apvenv/bin/python";
const ARCH = path.resolve("scripts/ap-generation/archetypes");
const py = (a: string[]): unknown => { const r = spawnSync(PY, ["-B", "registry.py", ...a], { cwd: ARCH, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 }); if (r.status !== 0) throw new Error(r.stderr.slice(-300)); return JSON.parse(r.stdout); };
const names = (py(["list", LIST]) as { mc: string[] }).mc;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const cards: string[] = [];
for (const n of names) {
  const p = (py(["batch", n, "1", String(SEED0)]) as Record<string, unknown>[])[0]; if (!p) continue;
  const g = gateCandidate({ stockKey: `new:${n}`, candidateKey: `new:${n}`, apSubjectCode: SUBJECT, kind: "mc", payload: p });
  const opts = (p.options as { text: string }[]).map((o, i) => `<li${i === p.key_index ? ' style="font-weight:bold"' : ""}>${esc(o.text)}</li>`).join("");
  cards.push(`<div style="border:1px solid #ccc;margin:8px;padding:8px;width:520px;display:inline-block;vertical-align:top"><b>${n}</b> ${p.topic} ${p.skill} ${p.calculator}<div style="font-size:12px">${esc(String(p.stem))}</div><div style="width:480px">${g.output ?? "(no figure)"}</div><ol type="A" style="font-size:12px">${opts}</ol></div>`);
}
mkdirSync(OUT, { recursive: true });
const html = `<!doctype html><meta charset="utf-8"><body style="font-family:Georgia,serif;background:#fff">${cards.join("")}</body>`;
writeFileSync(path.join(OUT, "gallery.html"), html); console.log(`wrote ${path.join(OUT, "gallery.html")} (${cards.length} cards)`);
