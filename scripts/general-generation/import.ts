// 일반용(usage_scope=general) 문항 임포트 (2026-09-30) — mock-exam-generation/import.ts 를 일반용으로 파생(원본은 다른 에이전트가 수정 중이라 복사).
// 기존 경로: create_bank_problem(usage_scope=general) → save_problem_draft_version → set_problem_render_check → set_problem_quality →
// (--publish) confirm_and_publish_problem_version → problem_keywords 연결(키워드가 있어야 과제 발급·수업 문제 고르기 후보가 된다).
// 실행: npx tsx scripts/general-generation/import.ts --file data/general-generation/<run>/<stage>/final/passed.json --publish [--keyword-map scripts/general-generation/keyword-map.json] [--tag <t>] [--dry-run]
//       npx tsx scripts/general-generation/import.ts --list-keywords        (대상 DB 과목별 활성 키워드 + 문제 수 출력, 읽기 전용)
//       npx tsx scripts/general-generation/import.ts --cleanup-tag <t>       (로컬 전용 시험 데이터 삭제)
//   재실행 안전: 같은 skill 에 지문·질문이 같은 버전이 있거나 기존 문제은행 본문과 유사도 0.6 이상이면 건너뛴다. 키워드 연결은 이미 있으면 건너뜀(멱등).
//   키워드 지도(keyword-map.json): { "<skill>": ["<subject_keywords.label>", ...] } — 과목(SAT Math / SAT Reading & Writing) 안의 활성 키워드 라벨과 정확히 일치해야 한다.
//   지도에 없거나 라벨이 대상 DB 에 없으면 그 skill 문항은 키워드 없이 공개되고(후보 아님) 요약에 미연결로 보고한다.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { findResidue } from "../../lib/problem-generation/residue";
import { dedupeStem, answerKeyError, draftBankGateError } from "../../lib/problem-text-guards";
import { judgeMaterialNeed, materialBlocker } from "../../lib/problem-material-need";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const flag = (n: string) => process.argv.includes(n);

type Rec = {
  gid: string; runId: string; skill: string; domain: string; examSystem: string; difficulty: string; format: "mc" | "spr";
  problem: { passage?: string | null; stimulus?: string | null; question?: string | null; options?: string[] | null; correctIndex?: number | null; answers?: string[] | null; explanation: string; figure?: unknown; statements?: string[] | null; evidenceTarget?: string | null; evidenceSpan?: string | null; answerRationale?: string | null; distractorErrorTypes?: string[] | null };
  quality: Record<string, unknown>;
  review?: unknown;
  hardTier?: string | null;
  createdVia?: string;
  subpattern?: string | null;
};

const shingles = (t: string) => {
  const w = t.toLowerCase().replace(/[0-9]+([.,][0-9]+)*/g, "#").replace(/[^a-z#\s]+/g, " ").split(/\s+/).filter(Boolean);
  const s = new Set<string>(); for (let i = 0; i + 3 <= w.length; i++) s.add(w.slice(i, i + 3).join(" ")); return s;
};
const jaccard = (a: Set<string>, b: Set<string>) => { if (!a.size || !b.size) return 0; let x = 0; for (const v of a) if (b.has(v)) x++; return x / (a.size + b.size - x); };

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)/.test(url);

  if (flag("--list-keywords")) {
    const { data: subs } = await admin.from("subjects").select("id, name").is("archived_at", null);
    for (const sub of subs ?? []) {
      const { data: kws } = await admin.from("subject_keywords").select("id, label, status").eq("subject_id", sub.id as string).eq("status", "active").order("label");
      console.log(`## ${sub.name} (활성 키워드 ${kws?.length ?? 0})`);
      for (const k of kws ?? []) {
        const { count } = await admin.from("problem_keywords").select("problem_id", { count: "exact", head: true }).eq("keyword_id", k.id as string);
        console.log(`- ${k.label}\t문제 ${count ?? 0}`);
      }
    }
    return;
  }
  const cleanup = arg("--cleanup-tag");
  if (cleanup) {
    if (!isLocal) throw new Error("--cleanup-tag 은 로컬 DB 에서만 동작합니다.");
    const topic = `gentest:${cleanup}`;
    const { data: ps } = await admin.from("problems").select("id").eq("topic", topic);
    const ids = (ps ?? []).map((p) => p.id as string);
    console.log(`삭제 대상 ${ids.length}건 (${topic})`);
    if (ids.length) {
      // 로컬 테스트 DB 정리 — 공개 버전 불변 트리거를 피하려고 psql 대신 RPC 없이 직접 지운다(실패하면 그대로 보고).
      const { execFileSync } = await import("node:child_process");
      const idList = ids.map((i) => `'${i}'`).join(",");
      const sql = `begin; set local session_replication_role = replica; delete from problem_keywords where problem_id in (${idList}); delete from problem_usage_scope_changes where problem_id in (${idList}); delete from problem_versions where problem_id in (${idList}); delete from problems where id in (${idList}); commit;`;
      execFileSync("docker", ["exec", "-i", "supabase_db_ALTON", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql], { stdio: "inherit" });
    }
    return;
  }

  const file = arg("--file");
  if (!file) throw new Error("--file 필요");
  const tag = arg("--tag");
  const publish = flag("--publish");
  const dry = flag("--dry-run");
  const dupCheck = !flag("--no-dup-check");
  const recs = JSON.parse(readFileSync(path.resolve(file), "utf-8")) as Rec[];
  const kwMapFile = arg("--keyword-map");
  const kwMap: Record<string, string[]> = kwMapFile ? JSON.parse(readFileSync(path.resolve(kwMapFile), "utf-8")) : {};
  const kwBySubjectLabel = new Map<string, string>(); // `${subjectId}\u0000${label}` -> keyword id
  const unlinkedSkills = new Map<string, number>();

  const { checkFigure } = await import("../../lib/problem-figures/check");
  const { validateFigureSpec } = await import("../../lib/problem-figures/spec");
  const { checkContent } = await import("../../lib/problem-content-check");
  const { composeProblemText } = await import("../../lib/problem-question");
  const { SKILL_BY_CODE } = await import("../../lib/problem-taxonomy");
  const { findProblemSkill } = await import("../../lib/problem-skills");

  const { data: adminProfile } = await admin.from("profiles").select("id").eq("role", "admin").limit(1).maybeSingle();
  if (!adminProfile) throw new Error("관리자 계정을 찾지 못했습니다.");
  const actorId = adminProfile.id as string;
  const { data: subjects } = await admin.from("subjects").select("id, name").is("archived_at", null);
  const subjectId = (sys: string) => {
    const row = (subjects ?? []).find((s) => (s.name as string) === (sys === "sat_rw" ? "SAT Reading & Writing" : "SAT Math"));
    if (!row) throw new Error(`과목 없음: ${sys}`);
    return row.id as string;
  };

  // 기존 문제은행 본문(같은 skill) — 유사도 비교용. 페이지 단위로 읽는다.
  const existing = new Map<string, { problemId: string; key: string; sh: Set<string> }[]>();
  const skills = [...new Set(recs.map((r) => r.skill))];
  if (!dry || dupCheck) {
    for (const skill of skills) {
      const list: { problemId: string; key: string; sh: Set<string> }[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await admin.from("problem_versions").select("problem_id, passage, question, options, problems!problem_versions_problem_id_fkey!inner(skill_code, archived_at)").eq("problems.skill_code", skill).is("problems.archived_at", null).range(from, from + 999);
        if (error) throw new Error(`기존 문항 조회 실패: ${error.message}`);
        for (const v of (data ?? []) as unknown as { problem_id: string; passage: string | null; question: string | null; options: string[] | null }[]) {
          list.push({ problemId: v.problem_id, key: `${v.passage ?? ""}\u0000${v.question ?? ""}`, sh: shingles(`${v.passage ?? ""} ${v.question ?? ""} ${(v.options ?? []).join(" ")}`) });
        }
        if (!data || data.length < 1000) break;
      }
      existing.set(skill, list);
    }
  }

  {
    const { data: kws } = await admin.from("subject_keywords").select("id, label, subject_id").eq("status", "active");
    for (const k of kws ?? []) kwBySubjectLabel.set(`${k.subject_id}\u0000${k.label}`, k.id as string);
  }
  const stats = { keywordLinks: 0, created: 0, published: 0, skippedExisting: 0, skippedDuplicate: 0, failed: 0 };
  const failures: string[] = [];
  const linkKeywords = async (problemId: string, r: Rec, countUnlinked: boolean) => {
    // 키워드 연결 — 확정(공개)된 문제만 가능(트리거). 지도에 없거나 라벨이 DB 에 없으면 미연결로 센다. 이미 있으면 건너뜀(멱등).
    const ids = (kwMap[r.skill] ?? []).map((l) => kwBySubjectLabel.get(`${subjectId(r.examSystem)}\u0000${l}`)).filter((x): x is string => Boolean(x));
    if (!ids.length) { if (countUnlinked) unlinkedSkills.set(r.skill, (unlinkedSkills.get(r.skill) ?? 0) + 1); return; }
    for (const kid of ids) {
      const { error: kErr } = await admin.from("problem_keywords").upsert({ problem_id: problemId, keyword_id: kid }, { onConflict: "problem_id,keyword_id", ignoreDuplicates: true });
      if (kErr) failures.push(`${r.gid}: 키워드 연결 실패 ${kErr.message}`); else stats.keywordLinks += 1;
    }
  };
  for (const r of recs) {
    const g = r.problem;
    const question = g.question ?? null;
    // 2026-10-02 UAT C2 — 생성 스키마가 passage를 필수로 요구해, 자극이 없는 수학 문항은 지문 자리에 질문 문장을 그대로 채운다. 새 레코드는 중복을 빼고 저장한다.
    const rawStimulus = g.stimulus ?? g.passage ?? "";
    const stimulus = dedupeStem(rawStimulus, question);
    const rawKey = `${rawStimulus}\u0000${question ?? ""}`; // 예전에 중복 그대로 저장된 레코드와도 같은 문항으로 본다.
    const residue = findResidue({ passage: g.passage as string | undefined, stimulus: g.stimulus as string | undefined, question: g.question as string | undefined, options: g.options as string[] | undefined, explanation: g.explanation as string | undefined, explanationEn: (g as { explanationEn?: string }).explanationEn, statements: g.statements as string[] | undefined });
    if (residue.length) { stats.failed += 1; failures.push(`${r.gid}: 생성 잔재 거절 — ${residue.map((x) => `${x.field}[${x.kind}]:${x.match}`).join(", ")}`); continue; }
    // 2026-10-06 은행 게이트 — 임포트도 관리자 저장 경로와 같은 검사를 거친다(한글·영어 해설·자료 필수·정답 키).
    {
      const keyErr = r.format === "mc" ? answerKeyError(g.options ?? null, g.correctIndex ?? null) : null;
      const gateErr = draftBankGateError({ examSystem: r.examSystem, usageScope: null, passage: stimulus, question, options: g.options ?? null, statements: g.statements ?? null, explanationEn: (g as { explanationEn?: string | null }).explanationEn ?? null });
      const matErr = materialBlocker(judgeMaterialNeed({ examSystem: r.examSystem, skillCode: r.skill, text: composeProblemText(stimulus, question) }), g.figure ?? null);
      const why = keyErr ?? gateErr ?? matErr;
      if (why) { stats.failed += 1; failures.push(`${r.gid}: 은행 게이트 거절 — ${why}`); continue; }
    }
    const key = `${stimulus}\u0000${question ?? ""}`;
    const pool = existing.get(r.skill) ?? [];
    const same = pool.find((e) => e.key === key || e.key === rawKey);
    if (same) { stats.skippedExisting += 1; if (publish && !dry) await linkKeywords(same.problemId, r, false); continue; }
    const sh = shingles(`${stimulus} ${question ?? ""} ${(g.options ?? []).join(" ")}`);
    if (dupCheck) {
      const hit = pool.find((e) => jaccard(sh, e.sh) >= 0.6);
      if (hit) { stats.skippedDuplicate += 1; failures.push(`${r.gid}: 기존 문항과 유사 (${hit.problemId})`); continue; }
    }
    if (dry) { stats.created += 1; continue; }

    const skill = SKILL_BY_CODE.get(r.skill)!;
    const legacy = findProblemSkill(skill.legacySkill);
    const { data: problemId, error: pErr } = await admin.rpc("create_bank_problem", {
      p_subject_id: subjectId(r.examSystem), p_format: r.format, p_skill_type: legacy?.label ?? skill.label, p_topic: tag ? `gentest:${tag}` : "",
      p_difficulty: r.difficulty, p_actor_id: actorId, p_skill_code: r.skill, p_exam_system: r.examSystem, p_ap_subject: null, p_usage_scope: "general",
    });
    if (pErr || !problemId) { stats.failed += 1; failures.push(`${r.gid}: 문제 생성 실패 ${pErr?.message}`); continue; }
    await admin.from("problems").update({ created_via: r.createdVia === "compiler" ? "compiler" : "ai_generated", ...(r.subpattern ? { subpattern: r.subpattern } : {}) }).eq("id", problemId as string);

    const fullText = composeProblemText(stimulus, question);
    const contentIssues = checkContent({ format: r.format, passage: fullText, options: g.options ?? null, correctIndex: g.correctIndex ?? null, explanation: g.explanation, answers: g.answers ?? null, statements: g.statements ?? null, skillCode: r.skill, figure: g.figure ?? null });
    const figureCheck = checkFigure(g.figure ?? null, fullText, g.options ?? null, g.correctIndex ?? null);
    const figureToSave = g.figure == null ? null : (() => { const fv = validateFigureSpec(g.figure); return fv.ok ? fv.spec : g.figure; })();
    const check = { ...figureCheck, issues: [...figureCheck.issues, ...contentIssues], ok: figureCheck.ok && contentIssues.length === 0 };
    const cleanup1 = async (why: string) => { await admin.from("problems").update({ archived_at: new Date().toISOString() }).eq("id", problemId as string); stats.failed += 1; failures.push(`${r.gid}: ${why}`); };
    const { data: versionId, error: vErr } = await admin.rpc("save_problem_draft_version", {
      p_problem_id: problemId, p_passage: stimulus, p_options: g.options ?? null, p_correct_index: g.correctIndex ?? null, p_explanation: g.explanation,
      p_difficulty: r.difficulty, p_actor_id: actorId, p_answers: g.answers ?? null, p_figure: figureToSave, p_figure_checked: false,
      p_statements: g.statements?.length ? g.statements : null, p_question: question?.trim() || null, p_repair_status: null, p_explanation_en: ((g as { explanationEn?: string | null }).explanationEn ?? null) || null,
      p_evidence_target: g.evidenceTarget ?? null, p_evidence_span: g.evidenceSpan ?? null, p_answer_rationale: g.answerRationale ?? null, p_distractor_error_types: g.distractorErrorTypes ?? null,
    });
    if (vErr || !versionId) { await cleanup1(`초안 저장 실패 ${vErr?.message}`); continue; }
    const { error: cErr } = await admin.rpc("set_problem_render_check", { p_version_id: versionId, p_check: check });
    if (cErr) { await cleanup1(`렌더 검사 기록 실패 ${cErr.message}`); continue; }
    const { error: qErr } = await admin.rpc("set_problem_quality", { p_version_id: versionId, p_quality: { ...r.quality, generalGeneration: { runId: r.runId, gid: r.gid, hardTier: r.hardTier ?? null, review: r.review ?? null } } });
    if (qErr) { await cleanup1(`품질 기록 실패 ${qErr.message}`); continue; }
    stats.created += 1;
    pool.push({ problemId: problemId as string, key, sh });
    existing.set(r.skill, pool);
    if (publish) {
      if (!check.ok) { failures.push(`${r.gid}: 렌더 검사 미통과 — 공개하지 않음 (${check.issues.map((i) => i.code).join(",")})`); continue; }
      const { error: pubErr } = await admin.rpc("confirm_and_publish_problem_version", { p_version_id: versionId, p_actor_id: actorId });
      if (pubErr) { failures.push(`${r.gid}: 공개 실패 ${pubErr.message}`); continue; }
      stats.published += 1;
      await linkKeywords(problemId as string, r, true);
    }
  }
  console.log(JSON.stringify({ target: isLocal ? "local" : url, dry, publish, total: recs.length, ...stats, keywordUnlinkedBySkill: Object.fromEntries(unlinkedSkills) }, null, 1));
  if (failures.length) console.log("실패·건너뜀 사유:\n" + failures.slice(0, 50).join("\n"));
}
main().catch((e) => { console.error(e); process.exit(1); });
