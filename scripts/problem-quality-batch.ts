// 유형별 표본 생성·품질 계약 검증 배치(2026-09-15).
//   세부 기술 30개 × (단건 1개 + 복수 2개) 를 실제 파이프라인(생성 → 자료 → 계약 → 독립 검사 → 재생성)으로 돌리고,
//   유형·단계·실패 사유·재생성 결과를 집계해 마크다운 보고서로 쓴다. DB 에 저장하지 않는다(보고서만).
// 실행: npx tsx scripts/problem-quality-batch.ts [--only=code1,code2] [--difficulty=hard] [--out=docs/…md]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

// .env.local 의 ANTHROPIC_API_KEY
const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const { SKILL_CODES, examSystemOfDomain } = await import("../lib/problem-taxonomy");
  const { findProblemSkill } = await import("../lib/problem-skills");
  const { judgeMaterialNeed } = await import("../lib/problem-material-need");
  const { runGenerationPipeline } = await import("../lib/problem-generation/pipeline");

  const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([a-z]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ""), "1"]; }));
  const only = args.only ? String(args.only).split(",") : null;
  const difficulty = (args.difficulty as "easy" | "medium" | "hard") || "medium";
  const out = String(args.out || `docs/2026-09-15-problem-quality-batch-${difficulty}.md`);
  const skills = SKILL_CODES.filter((k) => !only || only.includes(k.code));

  type Row = { code: string; label: string; system: string; format: string; single: { requested: number; accepted: number }; bulk: { requested: number; accepted: number }; regenerated: number; resolved: number; repairs: number; repairsResolved: number; failures: { stage: string; reason: string; resolved: boolean }[]; difficulties: string[]; needsReview: number; seconds: number };
  const rows: Row[] = [];
  const startedAll = Date.now();
  for (const k of skills) {
    const legacy = findProblemSkill(k.legacySkill);
    const system = examSystemOfDomain(k.domain) ?? "sat_math";
    const format = (legacy?.defaultFormat === "spr" ? "spr" : "mc") as "mc" | "spr";
    const need = judgeMaterialNeed({ examSystem: system, skillCode: k.code, text: "" });
    const figurePolicy = need.level === "none" ? "none" : need.kind === "plane" ? "require_plane" : need.kind === "geometry" ? "require_geometry" : need.kind === "figure_choice" ? "require_figure_choice" : "require_data";
    const base = { subjectName: system === "sat_rw" ? "SAT Reading & Writing" : "SAT Math", skillType: legacy?.label ?? k.label, skillCode: k.code, examSystem: system, difficulty, format, figurePolicy: figurePolicy as never };
    const t0 = Date.now();
    process.stderr.write(`▶ ${k.code} (${system}, ${format}, ${figurePolicy}) …\n`);
    const row: Row = { code: k.code, label: k.label, system, format, single: { requested: 1, accepted: 0 }, bulk: { requested: 2, accepted: 0 }, regenerated: 0, resolved: 0, repairs: 0, repairsResolved: 0, failures: [], difficulties: [], needsReview: 0, seconds: 0 };
    for (const [key, count] of [["single", 1], ["bulk", 2]] as const) {
      try {
        const r = await runGenerationPipeline({ ...base, count });
        row[key].accepted = r.accepted.length;
        row.regenerated += r.stats.regenerated;
        row.resolved += r.stats.regenerationResolved;
        row.repairs += r.stats.distractorRepairs;
        row.repairsResolved += r.stats.distractorRepairsResolved;
        row.failures.push(...r.failures.map((f) => ({ stage: f.stage, reason: f.reason.slice(0, 160), resolved: f.resolved })));
        row.difficulties.push(...r.accepted.map((a) => a.quality.estimatedDifficulty));
        row.needsReview += r.accepted.filter((a) => a.quality.needsReview).length;
      } catch (e) {
        row.failures.push({ stage: "generate", reason: `예외: ${e instanceof Error ? e.message : String(e)}`.slice(0, 160), resolved: false });
      }
    }
    row.seconds = Math.round((Date.now() - t0) / 1000);
    rows.push(row);
    process.stderr.write(`   단건 ${row.single.accepted}/1 · 복수 ${row.bulk.accepted}/2 · 재생성 ${row.regenerated}(해소 ${row.resolved}) · 오답 부분수정 ${row.repairs}(해소 ${row.repairsResolved}) · ${row.seconds}s\n`);
  }

  // 집계
  const byStage = new Map<string, { total: number; resolved: number }>();
  const byReason = new Map<string, number>();
  for (const r of rows) for (const f of r.failures) {
    const s = byStage.get(f.stage) ?? { total: 0, resolved: 0 }; s.total += 1; if (f.resolved) s.resolved += 1; byStage.set(f.stage, s);
    const key = f.reason.replace(/[“"][^”"]*[”"]/g, "“…”").replace(/\d+/g, "N").slice(0, 90);
    byReason.set(key, (byReason.get(key) ?? 0) + 1);
  }
  const totalReq = rows.reduce((n, r) => n + 3, 0), totalAcc = rows.reduce((n, r) => n + r.single.accepted + r.bulk.accepted, 0);
  const lines: string[] = [];
  lines.push(`# 유형별 표본 생성·품질 계약 검증 — 난이도 ${difficulty} (${new Date().toISOString().slice(0, 16).replace("T", " ")})`, "");
  lines.push(`파이프라인: 생성 → 자료 필요 시 자료 생성 → 유형별 품질 계약(질문 대상·자료 근거·표시·정답·답안 형식) → 독립 품질 검사(정답 일치·오답 품질·추정 난이도) → 실패 시 사유 피드백 1회 재생성 → 부족분 1회 재생성. DB 저장 없음(보고서만). 총 소요 ${Math.round((Date.now() - startedAll) / 60000)}분.`, "");
  lines.push(`**요청 ${totalReq} · 통과 ${totalAcc} (${Math.round((100 * totalAcc) / Math.max(1, totalReq))}%) · 재생성 ${rows.reduce((n, r) => n + r.regenerated, 0)}회(해소 ${rows.reduce((n, r) => n + r.resolved, 0)}) · 오답 부분수정 ${rows.reduce((n, r) => n + r.repairs, 0)}회(해소 ${rows.reduce((n, r) => n + r.repairsResolved, 0)}) · 검토 필요 ${rows.reduce((n, r) => n + r.needsReview, 0)}**`, "");
  lines.push("## 유형별", "", "| 세부 기술 | 체계·형식 | 단건 | 복수 | 재생성(해소) | 오답 부분수정(해소) | 추정 난이도 분포 | 검토 필요 | 미해소 실패 사유 | 초 |", "|---|---|---|---|---|---|---|---|---|---|");
  for (const r of rows) {
    const dist = ["easy", "medium", "hard"].map((d) => `${d[0]}${r.difficulties.filter((x) => x === d).length}`).join(" ");
    const unresolved = r.failures.filter((f) => !f.resolved).map((f) => `[${f.stage}] ${f.reason.slice(0, 70)}`).join("<br>");
    lines.push(`| ${r.label} (\`${r.code}\`) | ${r.system} · ${r.format} | ${r.single.accepted}/1 | ${r.bulk.accepted}/2 | ${r.regenerated}(${r.resolved}) | ${r.repairs}(${r.repairsResolved}) | ${dist} | ${r.needsReview} | ${unresolved || "—"} | ${r.seconds} |`);
  }
  lines.push("", "## 실패 단계별", "", "| 단계 | 건수 | 재생성으로 해소 |", "|---|---|---|");
  for (const [stage, s] of byStage) lines.push(`| ${stage} | ${s.total} | ${s.resolved} |`);
  lines.push("", "## 반복되는 실패 사유(상위)", "", "| 사유(숫자·인용 일반화) | 건수 |", "|---|---|");
  for (const [reason, n] of Array.from(byReason.entries()).sort((a, b) => b[1] - a[1]).slice(0, 25)) lines.push(`| ${reason} | ${n} |`);
  lines.push("", "## 전체 실패 목록", "");
  for (const r of rows) for (const f of r.failures) lines.push(`- ${r.code} · [${f.stage}] ${f.resolved ? "해소" : "미해소"} — ${f.reason}`);
  writeFileSync(out, lines.join("\n") + "\n");
  process.stderr.write(`\n보고서: ${out}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
