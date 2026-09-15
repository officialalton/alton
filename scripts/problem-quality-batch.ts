// 유형별 표본 생성·품질 계약 검증 배치(2026-09-15, 2차 개정).
//   지정한 유형 × count 문항을 실제 파이프라인(생성 → 자료 → 계약 → 독립 검사 → 자리별 오답 보정 → 보강 대기 판정)으로
//   돌리고, 첫 생성 통과율/최종 통과율/보강 대기 전환율/사유별 비율/평균 호출 수를 분리해 마크다운 보고서로 쓴다.
//   DB 에 저장하지 않는다(보고서만). 실행마다 주제·자료·유형 조건을 기록해 우연한 성공을 가려낸다.
// 실행: npx tsx scripts/problem-quality-batch.ts --only=code1,code2 --difficulty=hard --count=10 [--out=docs/…md]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

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
  const count = Math.max(1, Math.min(10, Number(args.count) || (difficulty === "hard" ? 10 : 5)));
  const out = String(args.out || `docs/2026-09-15-problem-quality-batch-${difficulty}.md`);
  const skills = SKILL_CODES.filter((k) => !only || only.includes(k.code));

  type Row = {
    code: string; label: string; system: string; format: string; requested: number; accepted: number; candidatesEvaluated: number;
    firstPassCount: number; held: number; heldOverflowDiscarded: number; regenerated: number; resolved: number; repairs: number; repairsResolved: number;
    fieldRepairs: number; fieldRepairsResolved: number; modelCalls: number[]; failures: { stage: string; reason: string; resolved: boolean }[];
    emptyResponses: { cause: string; retried: boolean; resolved: boolean }[]; underReturned: { requested: number; returned: number; reason: string }[];
    difficulties: string[]; needsReview: number; seconds: number; runConditions: string[];
  };
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
    process.stderr.write(`▶ ${k.code} (${system}, ${format}, ${figurePolicy}) count=${count} …\n`);
    const row: Row = {
      code: k.code, label: k.label, system, format, requested: count, accepted: 0, candidatesEvaluated: 0, firstPassCount: 0, held: 0, heldOverflowDiscarded: 0,
      regenerated: 0, resolved: 0, repairs: 0, repairsResolved: 0, fieldRepairs: 0, fieldRepairsResolved: 0, modelCalls: [], failures: [], emptyResponses: [],
      underReturned: [], difficulties: [], needsReview: 0, seconds: 0, runConditions: [],
    };
    try {
      const r = await runGenerationPipeline({ ...base, count });
      row.accepted = r.accepted.length;
      row.candidatesEvaluated = r.stats.candidatesEvaluated;
      row.firstPassCount = r.stats.firstPassCount;
      row.held = r.stats.held;
      row.heldOverflowDiscarded = r.stats.heldOverflowDiscarded;
      row.regenerated = r.stats.regenerated;
      row.resolved = r.stats.regenerationResolved;
      row.repairs = r.stats.distractorRepairs;
      row.repairsResolved = r.stats.distractorRepairsResolved;
      row.fieldRepairs = r.stats.fieldRepairs;
      row.fieldRepairsResolved = r.stats.fieldRepairsResolved;
      row.modelCalls.push(r.stats.modelCalls);
      row.failures.push(...r.failures.map((f) => ({ stage: f.stage, reason: f.reason.slice(0, 160), resolved: f.resolved })));
      row.emptyResponses.push(...r.stats.emptyResponses);
      row.underReturned.push(...r.stats.underReturned.map((u) => ({ ...u, reason: `${k.code}: ${u.reason}` })));
      row.difficulties.push(...r.accepted.map((a) => a.quality.estimatedDifficulty));
      row.needsReview += r.accepted.filter((a) => a.quality.needsReview).length;
      row.runConditions.push(...r.accepted.map((a) => `${(a.problem.question ?? a.problem.passage ?? "").slice(0, 60)}…`));
    } catch (e) {
      row.failures.push({ stage: "generate", reason: `예외: ${e instanceof Error ? e.message : String(e)}`.slice(0, 160), resolved: false });
    }
    row.seconds = Math.round((Date.now() - t0) / 1000);
    rows.push(row);
    process.stderr.write(`   후보 ${row.candidatesEvaluated} · 첫통과 ${row.firstPassCount} · 최종통과 ${row.accepted}/${row.requested} · 대기 ${row.held}(초과폐기 ${row.heldOverflowDiscarded}) · 오답보정 ${row.repairs}(해소 ${row.repairsResolved}) · 빈응답 ${row.emptyResponses.length} · ${row.seconds}s\n`);
  }

  const byStage = new Map<string, { total: number; resolved: number }>();
  const byReason = new Map<string, number>();
  for (const r of rows) for (const f of r.failures) {
    const s = byStage.get(f.stage) ?? { total: 0, resolved: 0 }; s.total += 1; if (f.resolved) s.resolved += 1; byStage.set(f.stage, s);
    const key = f.reason.replace(/[“"][^”"]*[”"]/g, "“…”").replace(/\d+/g, "N").slice(0, 90);
    byReason.set(key, (byReason.get(key) ?? 0) + 1);
  }
  const totalReq = rows.reduce((n, r) => n + r.requested, 0);
  const totalCandidates = rows.reduce((n, r) => n + r.candidatesEvaluated, 0);
  const totalFirstPass = rows.reduce((n, r) => n + r.firstPassCount, 0);
  const totalAccepted = rows.reduce((n, r) => n + r.accepted, 0);
  const totalHeld = rows.reduce((n, r) => n + r.held, 0);
  const totalEmpty = rows.reduce((n, r) => n + r.emptyResponses.length, 0);
  const firstPassRate = totalCandidates ? Math.round((100 * totalFirstPass) / totalCandidates) : 0;
  const finalPassRate = totalReq ? Math.round((100 * totalAccepted) / totalReq) : 0;
  const heldRate = totalReq ? Math.round((100 * totalHeld) / totalReq) : 0;
  const avgModelCalls = (() => { const all = rows.flatMap((r) => r.modelCalls).filter((x) => Number.isFinite(x) && x > 0); return all.length ? Math.round((all.reduce((a, b) => a + b, 0) / all.length) * 100) / 100 : 0; })();

  const lines: string[] = [];
  lines.push(`# 유형별 표본 생성·품질 계약 검증 — 난이도 ${difficulty}, 유형당 ${count}문항 (${new Date().toISOString().slice(0, 16).replace("T", " ")})`, "");
  lines.push(`파이프라인: 생성 → 자료 → 유형별 품질 계약 → 독립 검사 → (오답만 걸리면) 자리별 구조화 계획·생성·결정적 검사(자리당 최대 2회) → 통과 시 채택, 지문·질문·정답·계약·독립검사 통과 + 잔여 오답 실패 1~2건이면 보강 대기, 그 외 폐기. 대기 상한은 요청 수. 총 소요 ${Math.round((Date.now() - startedAll) / 60000)}분.`, "");
  lines.push(`**요청 ${totalReq}개(유형당 ${count}) → 후보 ${totalCandidates}개 평가**`, "");
  lines.push("| 지표 | 값 |", "|---|---|");
  lines.push(`| 첫 생성 통과율(보정 0회) | ${totalFirstPass}/${totalCandidates} = ${firstPassRate}% |`);
  lines.push(`| 자동 보정 뒤 최종 통과율 | ${totalAccepted}/${totalReq} = ${finalPassRate}% |`);
  lines.push(`| 보강 대기 전환율 | ${totalHeld}/${totalReq} = ${heldRate}% (목표 ≤10%) |`);
  lines.push(`| 대기 한도 초과 폐기 | ${rows.reduce((n, r) => n + r.heldOverflowDiscarded, 0)} |`);
  lines.push(`| 오답 자리별 보정 시도(해소) | ${rows.reduce((n, r) => n + r.repairs, 0)}(${rows.reduce((n, r) => n + r.repairsResolved, 0)}) |`);
  lines.push(`| 필드 부분 수정 시도(해소) | ${rows.reduce((n, r) => n + r.fieldRepairs, 0)}(${rows.reduce((n, r) => n + r.fieldRepairsResolved, 0)}) |`);
  lines.push(`| 문항 전체 재생성(해소) | ${rows.reduce((n, r) => n + r.regenerated, 0)}(${rows.reduce((n, r) => n + r.resolved, 0)}) |`);
  lines.push(`| 빈 응답 이벤트 | ${totalEmpty} |`);
  lines.push(`| 문항당 평균 모델 호출 | ${avgModelCalls} |`);
  lines.push("");

  lines.push("## 유형별", "", "| 세부 기술 | 체계·형식 | 요청 | 후보 | 첫통과 | 최종통과 | 통과율 | 대기(초과폐기) | 빈응답 | 부족반환 | 미해소 실패 사유 | 초 |", "|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const r of rows) {
    const rate = r.requested ? Math.round((100 * r.accepted) / r.requested) : 0;
    const unresolved = r.failures.filter((f) => !f.resolved).map((f) => `[${f.stage}] ${f.reason.slice(0, 60)}`).slice(0, 3).join("<br>");
    lines.push(`| ${r.label} (\`${r.code}\`) | ${r.system} · ${r.format} | ${r.requested} | ${r.candidatesEvaluated} | ${r.firstPassCount} | ${r.accepted} | ${rate}% | ${r.held}(${r.heldOverflowDiscarded}) | ${r.emptyResponses.length} | ${r.underReturned.length} | ${unresolved || "—"} | ${r.seconds} |`);
  }

  lines.push("", "## 70% 미달 유형", "");
  const under70 = rows.filter((r) => r.requested > 0 && Math.round((100 * r.accepted) / r.requested) < 70);
  if (!under70.length) lines.push("없음 — 전 유형 70% 이상.");
  else for (const r of under70) lines.push(`- ${r.label} (\`${r.code}\`): ${r.accepted}/${r.requested} — 이 유형만 오답 설계 예시·오류 분류 보강 후 재검증 필요.`);

  lines.push("", "## 빈 응답 이벤트(원인·재시도 결과)", "");
  const emptyRows = rows.flatMap((r) => r.emptyResponses.map((e) => ({ code: r.code, ...e })));
  if (!emptyRows.length) lines.push("없음.");
  else { lines.push("| 유형 | 원인 | 재시도 | 해소 |", "|---|---|---|---|"); for (const e of emptyRows) lines.push(`| ${e.code} | ${e.cause} | ${e.retried ? "예" : "아니오"} | ${e.resolved ? "예" : "아니오"} |`); }

  lines.push("", "## 요청보다 적게 반환된 경우(유형·사유)", "");
  const underRows = rows.flatMap((r) => r.underReturned);
  if (!underRows.length) lines.push("없음.");
  else { lines.push("| 요청 | 반환 | 사유 |", "|---|---|---|"); for (const u of underRows) lines.push(`| ${u.requested} | ${u.returned} | ${u.reason} |`); }

  lines.push("", "## 실행 조건 표본(주제·문항 첫머리 — 같은 프롬프트 반복 여부 확인용)", "");
  for (const r of rows) if (r.runConditions.length) lines.push(`- ${r.code}: ${r.runConditions.join(" | ")}`);

  lines.push("", "## 실패 단계별", "", "| 단계 | 건수 | 해소 |", "|---|---|---|");
  for (const [stage, s] of byStage) lines.push(`| ${stage} | ${s.total} | ${s.resolved} |`);
  lines.push("", "## 반복되는 실패 사유(상위)", "", "| 사유(숫자·인용 일반화) | 건수 |", "|---|---|");
  for (const [reason, n] of Array.from(byReason.entries()).sort((a, b) => b[1] - a[1]).slice(0, 25)) lines.push(`| ${reason} | ${n} |`);
  lines.push("", "## 전체 실패 목록", "");
  for (const r of rows) for (const f of r.failures) lines.push(`- ${r.code} · [${f.stage}] ${f.resolved ? "해소" : "미해소"} — ${f.reason}`);
  writeFileSync(out, lines.join("\n") + "\n");
  process.stderr.write(`\n보고서: ${out}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
