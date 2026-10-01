// SAT 공용 키워드 → College Board 스킬 30개 재설정(2026-10-01). 기본 dry-run, --execute 때만 쓴다.
//   npx tsx scripts/keywords/sat-keyword-setup.ts              # 계획만 출력
//   npx tsx scripts/keywords/sat-keyword-setup.ts --execute    # 실제 반영
//   [--include-drafts]  confirmed 외 draft 문항도 연결(트리거는 허용; 기본은 confirmed 만)
// 순서: (a) 키워드 upsert → (b) 문항 연결 → (c) 구 키워드 연결 백업(JSON)·삭제, 사용처 없는 구 키워드 archived.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { connect, selectAll } from "./db";
import { planKeywords, planProblemLinks, planLegacy, chunk, skillDisplay, type KeywordRow, type ProblemRow, type LegacyUsage, type SubjectIds } from "../../lib/sat-keywords/plan";
import { SAT_SUBJECT_NAME } from "../../lib/sat-keywords/taxonomy";

const execute = process.argv.includes("--execute");
const includeDrafts = process.argv.includes("--include-drafts");

async function main() {
  const conn = await connect();
  if (!conn) throw new Error("SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.");
  const { db, target } = conn;
  console.log(`대상: ${target} / ${execute ? "EXECUTE" : "dry-run"}`);

  const { data: subs, error: sErr } = await db.from("subjects").select("id, name").in("name", Object.values(SAT_SUBJECT_NAME)).is("archived_at", null);
  if (sErr) throw new Error(sErr.message);
  const sid = (n: string) => { const r = (subs ?? []).filter((s) => s.name === n); if (r.length !== 1) throw new Error(`과목 '${n}' 이 ${r.length}건`); return r[0].id as string; };
  const subjects: SubjectIds = { sat_math: sid(SAT_SUBJECT_NAME.sat_math), sat_rw: sid(SAT_SUBJECT_NAME.sat_rw) };
  const subjectIds = Object.values(subjects);

  const loadKeywords = () => selectAll<KeywordRow>((a, b) => db.from("subject_keywords").select("id, subject_id, label, status, skill_code, domain_code").in("subject_id", subjectIds).order("id").range(a, b));

  // (a) 키워드
  let keywords = await loadKeywords();
  const kp = planKeywords(keywords, subjects);
  console.log(`(a) 키워드: 생성 ${kp.create.length} · 구 키워드 재사용 ${kp.reuse.length} · 이미 설정 ${kp.alreadySet.length}`);
  if (execute) {
    for (const r of kp.reuse) {
      const { error } = await db.from("subject_keywords").update({ skill_code: r.skill_code, domain_code: r.domain_code, label: r.label, status: "active" }).eq("id", r.id);
      if (error) throw new Error(`재사용 실패 ${r.label}: ${error.message}`);
    }
    if (kp.create.length) {
      const { error } = await db.from("subject_keywords").insert(kp.create);
      if (error) throw new Error(`생성 실패: ${error.message}`);
    }
    keywords = await loadKeywords();
  } else {
    // dry-run: 생성 예정 키워드에 가짜 id 를 붙여 이후 계산을 이어간다.
    keywords = keywords.map((k) => { const r = kp.reuse.find((x) => x.id === k.id); return r ? { ...k, skill_code: r.skill_code, domain_code: r.domain_code } : k; })
      .concat(kp.create.map((c) => ({ id: `new:${c.subject_id}:${c.skill_code}`, subject_id: c.subject_id, label: c.label, status: "active", skill_code: c.skill_code, domain_code: c.domain_code })));
  }
  const kwMap = new Map(keywords.filter((k) => k.skill_code).map((k) => [`${k.subject_id}/${k.skill_code}`, k.id]));
  const legacy = keywords.filter((k) => !k.skill_code);
  const allIds = keywords.filter((k) => !k.id.startsWith("new:")).map((k) => k.id);

  // 현재 연결
  const links: { problem_id: string; keyword_id: string }[] = [];
  for (const ids of chunk(allIds, 100)) links.push(...await selectAll<{ problem_id: string; keyword_id: string }>((a, b) => db.from("problem_keywords").select("problem_id, keyword_id").in("keyword_id", ids).order("problem_id").range(a, b)));
  const linkSet = new Set(links.map((l) => `${l.problem_id}:${l.keyword_id}`));

  // (b) 문항 연결
  const problems = await selectAll<ProblemRow>((a, b) => {
    let q = db.from("problems").select("id, subject_id, exam_system, skill_code").in("exam_system", ["sat_math", "sat_rw"]).is("archived_at", null);
    q = includeDrafts ? q.in("status", ["confirmed", "draft"]) : q.eq("status", "confirmed");
    return q.order("id").range(a, b);
  });
  const skillKeywordIds = new Set(keywords.filter((k) => k.skill_code).map((k) => k.id));
  const hasSkillKeyword = new Set(links.filter((l) => skillKeywordIds.has(l.keyword_id)).map((l) => l.problem_id));
  const lp = planProblemLinks(problems, subjects, (s, k) => kwMap.get(`${s}/${k}`), linkSet, hasSkillKeyword);
  console.log(`(b) 문항 ${problems.length}건: 연결 추가 ${lp.inserts.length} · 이미 연결 ${lp.alreadyLinked} · skill_code null ${lp.nullSkill.length} · 타 과목 ${lp.otherSubject.length} · 알 수 없는 skill ${lp.unknownSkill.length}`);
  if (execute) {
    for (const rows of chunk(lp.inserts, 200)) {
      const { error } = await db.from("problem_keywords").upsert(rows, { onConflict: "problem_id,keyword_id", ignoreDuplicates: true });
      if (error) throw new Error(`연결 삽입 실패: ${error.message}`);
    }
  }

  // (c) 구 키워드
  const legacyIds = legacy.map((k) => k.id);
  const usage = new Map<string, LegacyUsage>();
  const bump = (id: string, f: keyof LegacyUsage) => { const u = usage.get(id) ?? { docs: 0, subjectUnits: 0, teacherUnits: 0, sections: 0 }; u[f] += 1; usage.set(id, u); };
  for (const ids of chunk(legacyIds, 100)) {
    const [docs, su, tu, sec] = await Promise.all([
      selectAll<{ primary_keyword_id: string }>((a, b) => db.from("curriculum_docs").select("primary_keyword_id").in("primary_keyword_id", ids).range(a, b)),
      selectAll<{ keyword_id: string }>((a, b) => db.from("subject_template_unit_keywords").select("keyword_id").in("keyword_id", ids).range(a, b)),
      selectAll<{ keyword_id: string }>((a, b) => db.from("teacher_curriculum_template_unit_keywords").select("keyword_id").in("keyword_id", ids).range(a, b)),
      selectAll<{ keyword_id: string }>((a, b) => db.from("curriculum_doc_section_keywords").select("keyword_id").in("keyword_id", ids).range(a, b)),
    ]);
    docs.forEach((r) => bump(r.primary_keyword_id, "docs"));
    su.forEach((r) => bump(r.keyword_id, "subjectUnits"));
    tu.forEach((r) => bump(r.keyword_id, "teacherUnits"));
    sec.forEach((r) => bump(r.keyword_id, "sections"));
  }
  const gp = planLegacy(legacy, links, usage, subjects);
  console.log(`(c) 구 키워드 ${legacy.length}개: 문제 연결 삭제 ${gp.linksToDelete.length} · active 유지 ${gp.keepActive.length} · archived ${gp.archive.length}`);
  if (execute && gp.linksToDelete.length) {
    const dir = path.resolve("data/keywords");
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `legacy-links-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeFileSync(file, JSON.stringify({ target, savedAt: new Date().toISOString(), keywords: legacy.map((k) => ({ id: k.id, subject_id: k.subject_id, label: k.label })), links: gp.linksToDelete }, null, 1));
    console.log(`    백업: ${path.relative(process.cwd(), file)}`);
    const byKw = new Map<string, string[]>();
    for (const l of gp.linksToDelete) byKw.set(l.keyword_id, [...(byKw.get(l.keyword_id) ?? []), l.problem_id]);
    for (const [k, pids] of byKw) for (const ids of chunk(pids, 200)) {
      const { error } = await db.from("problem_keywords").delete().eq("keyword_id", k).in("problem_id", ids);
      if (error) throw new Error(`연결 삭제 실패: ${error.message}`);
    }
  }
  if (execute) for (const ids of chunk(gp.archive.map((a) => a.id), 200)) {
    const { error } = await db.from("subject_keywords").update({ status: "archived" }).in("id", ids);
    if (error) throw new Error(`archive 실패: ${error.message}`);
  }

  // (d) 요약
  console.log("\n스킬별 문항 수:");
  for (const [k, n] of Object.entries(lp.countBySkill).sort()) console.log(`  ${k.padEnd(32)} ${n}`);
  if (lp.nullSkill.length) console.log(`skill_code null 문항(건너뜀): ${lp.nullSkill.join(", ")}`);
  if (lp.otherSubject.length) console.log(`과목 불일치 문항(건너뜀): ${lp.otherSubject.join(", ")}`);
  if (lp.unknownSkill.length) console.log(`알 수 없는 skill(건너뜀): ${lp.unknownSkill.map((u) => `${u.id}:${u.skill_code}`).join(", ")}`);
  if (gp.keepActive.length) {
    console.log("\n교재·단원에 쓰여 active 로 남긴 구 키워드:");
    console.log("  | 키워드 | 과목 | 교재 | 과목단원 | 선생님단원 | 섹션 | 후보 스킬 |");
    for (const k of gp.keepActive) console.log(`  | ${k.label} | ${k.subject_id === subjects.sat_rw ? "R&W" : "Math"} | ${k.usage.docs} | ${k.usage.subjectUnits} | ${k.usage.teacherUnits} | ${k.usage.sections} | ${skillDisplay(k.candidate)} |`);
  }
  if (gp.archive.length) console.log(`\narchived 대상: ${gp.archive.map((a) => a.label).join(", ")}`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
