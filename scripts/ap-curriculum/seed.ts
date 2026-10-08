// AP 커리큘럼 시드 로더(2026-10-08). 기본 dry-run, --execute 때만 쓴다. 멱등(재실행 안전).
//   npx tsx scripts/ap-curriculum/seed.ts                       # 전체 과목 계획만 출력(DB 읽기 필요 없음: --offline)
//   npx tsx scripts/ap-curriculum/seed.ts --offline             # 파일 검증 + 건수만
//   npx tsx scripts/ap-curriculum/seed.ts --only ap_biology     # 한 과목
//   npx tsx scripts/ap-curriculum/seed.ts --execute             # 실제 반영(대상 DB 환경변수 필요; 비프로덕션만)
// 순서: 과목 → 판/스킬/비중 → 단원(템플릿 단원+폴더) → 토픽 → 세부 키워드 → 단원-토픽 연결. 관리자가 바꾼 키워드 이름은 덮어쓰지 않는다.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { connect, selectAll } from "../keywords/db";
import { buildPlan, diffKeywords, unitDisplayName } from "../../lib/ap-curriculum/plan";
import { validateCurriculum } from "../../lib/ap-curriculum/validate";
import type { ApCurriculumFile } from "../../lib/ap-curriculum/types";

const execute = process.argv.includes("--execute");
const offline = process.argv.includes("--offline");
const onlyIdx = process.argv.indexOf("--only");
const only = onlyIdx > 0 ? process.argv[onlyIdx + 1] : undefined;
const DIR = path.resolve(process.cwd(), "data/ap/curriculum-2027");

async function main() {
  const files = readdirSync(DIR).filter((n) => n.endsWith(".json")).filter((n) => !only || n === `${only}.json`).sort();
  if (!files.length) throw new Error("시드 파일이 없습니다.");
  const data = files.map((n) => JSON.parse(readFileSync(path.join(DIR, n), "utf-8")) as ApCurriculumFile);
  let bad = 0;
  for (const f of data) {
    const errs = validateCurriculum(f);
    const { units, keywords } = buildPlan(f);
    console.log(`${f.subject.apCode}: units=${units.length} topics=${keywords.filter((k) => k.level === 1).length} sub=${keywords.filter((k) => k.level === 2).length} skills=${f.skills.length} weights=${f.weights.length} 오류=${errs.length}`);
    errs.forEach((e) => console.log("  - " + e));
    bad += errs.length;
  }
  if (bad) throw new Error(`시드 데이터 오류 ${bad}건 — 중단`);
  if (offline) return;

  const conn = await connect();
  if (!conn) throw new Error("SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다(파일만 보려면 --offline).");
  const { db, target } = conn;
  console.log(`대상: ${target} / ${execute ? "EXECUTE" : "dry-run"}`);
  if (execute && !/^(local|worpsqwqgnspddnrtnvq\.supabase\.co)$/.test(target)) throw new Error(`허용되지 않은 대상 ${target} (로컬/공유 비프로덕션만)`);

  for (const f of data) {
    const s = f.subject;
    const plan = buildPlan(f);
    const { data: subj } = await db.from("subjects").select("id, ap_subject_code").eq("name", s.name).maybeSingle();
    if (subj && subj.ap_subject_code && subj.ap_subject_code !== s.apCode) throw new Error(`과목 ${s.name} 의 ap_subject_code 충돌`);
    let subjectId: string = subj?.id ?? `new:${s.apCode}`;
    if (!subj) console.log(`  [${s.apCode}] 과목 생성 예정: ${s.name}`);
    if (execute) {
      if (!subj) {
        const { data: ins, error } = await db.from("subjects").insert({ name: s.name, ap_subject_code: s.apCode }).select("id").single();
        if (error) throw new Error(error.message);
        subjectId = ins.id;
      } else if (!subj.ap_subject_code) {
        const { error } = await db.from("subjects").update({ ap_subject_code: s.apCode }).eq("id", subj.id);
        if (error) throw new Error(error.message);
      }
    }
    const existing = subjectId.startsWith("new:")
      ? []
      : await selectAll<{ id: string; content_code: string | null }>((a, b) => db.from("subject_keywords").select("id, content_code").eq("subject_id", subjectId).not("content_code", "is", null).range(a, b));
    const existingCodes = new Set(existing.map((k) => k.content_code as string));
    const d = diffKeywords(plan.keywords, existingCodes);
    console.log(`  [${s.apCode}] 키워드 생성 ${d.create.length} · 기존 유지/메타 갱신 ${d.update.length}`);
    if (!execute) continue;

    const ok = async (p: PromiseLike<{ error: { message: string } | null }>, what: string) => { const { error } = await p; if (error) throw new Error(`${what}: ${error.message}`); };
    await ok(db.from("ap_curriculum_editions").upsert({ subject_id: subjectId, edition: s.edition, ced_version: s.cedVersion, source_url: s.sourceUrl, exam_year: s.examYear, family: s.family, official_topic_codes: s.officialTopicCodes, design_notes: s.designNotes, is_current: true }, { onConflict: "subject_id,edition" }), "edition");
    await ok(db.from("ap_skills").upsert(f.skills.map((k, i) => ({ subject_id: subjectId, edition: s.edition, code: k.code, category: k.category, label: k.label, sort_order: i })), { onConflict: "subject_id,edition,code" }), "skills");
    await ok(db.from("ap_exam_weights").upsert(f.weights.map((w) => ({ subject_id: subjectId, edition: s.edition, axis: w.axis, code: w.code, section: w.section, min_pct: w.min, max_pct: w.max, source: w.source })), { onConflict: "subject_id,edition,axis,code,section" }), "weights");

    // 단원: 템플릿 단원 + 폴더
    const { data: tu } = await db.from("subject_template_units").select("id, official_code, position").eq("subject_id", subjectId);
    const { data: fo } = await db.from("subject_keyword_folders").select("id, official_code").eq("subject_id", subjectId);
    const unitId = new Map<string, string>();
    const folderId = new Map<string, string>();
    for (const u of plan.units) {
      const name = unitDisplayName(u.code, u.title);
      let t = (tu ?? []).find((x) => x.official_code === u.code);
      if (!t) {
        const taken = new Set((tu ?? []).map((x) => x.position));
        let position = u.position;
        while (taken.has(position)) position += 1000; // 기존 관리자 단원과 순서 충돌 시 뒤로
        const { data: ins, error } = await db.from("subject_template_units").insert({ subject_id: subjectId, position, unit_title: name, official_code: u.code, source: "ced", suggested_lessons: u.suggestedLessons, official_class_periods: u.officialClassPeriods }).select("id, official_code, position").single();
        if (error) throw new Error(`단원 ${u.code}: ${error.message}`);
        t = ins;
      } else {
        await ok(db.from("subject_template_units").update({ suggested_lessons: u.suggestedLessons, official_class_periods: u.officialClassPeriods }).eq("id", t.id), "단원 갱신");
      }
      unitId.set(u.code, t.id);
      let fld = (fo ?? []).find((x) => x.official_code === u.code);
      if (!fld) {
        const { data: ins, error } = await db.from("subject_keyword_folders").insert({ subject_id: subjectId, name, position: u.position, official_code: u.code, source: "ced" }).select("id, official_code").single();
        if (error) throw new Error(`폴더 ${u.code}: ${error.message}`);
        fld = ins;
      }
      folderId.set(u.code, fld.id);
    }

    // 키워드: 토픽 먼저, 세부는 부모 id 가 필요하므로 그다음
    const idByCode = new Map(existing.map((k) => [k.content_code as string, k.id]));
    for (const level of [1, 2] as const) {
      const rows = d.create.filter((k) => k.level === level).map((k) => ({
        subject_id: subjectId, label: k.label, status: "active", content_code: k.contentCode, content_key: k.contentKey, level: k.level,
        parent_keyword_id: k.parentCode ? idByCode.get(k.parentCode) : null, source: "ced", edition: s.edition, kind: k.kind,
        skill_codes: k.skillCodes, requires_codes: k.requiresCodes, est_lessons: k.estLessons, scope: k.scope, folder_id: folderId.get(k.unitCode), sort_order: k.sortOrder,
      }));
      for (let i = 0; i < rows.length; i += 100) {
        const { data: ins, error } = await db.from("subject_keywords").insert(rows.slice(i, i + 100)).select("id, content_code");
        if (error) throw new Error(`키워드 생성(${level}): ${error.message}`);
        (ins ?? []).forEach((r) => idByCode.set(r.content_code as string, r.id));
      }
    }
    // 기존 ced 키워드는 이름·폴더는 두고 메타만 갱신
    for (const k of d.update) {
      await ok(db.from("subject_keywords").update({ skill_codes: k.skillCodes, requires_codes: k.requiresCodes, est_lessons: k.estLessons, kind: k.kind, scope: k.scope, content_key: k.contentKey, sort_order: k.sortOrder }).eq("subject_id", subjectId).eq("content_code", k.contentCode), `키워드 갱신 ${k.contentCode}`);
    }
    // 단원-토픽 연결(멱등)
    const links = plan.keywords.filter((k) => k.level === 1).map((k) => ({ unit_id: unitId.get(k.unitCode), keyword_id: idByCode.get(k.contentCode) }));
    for (let i = 0; i < links.length; i += 200) await ok(db.from("subject_template_unit_keywords").upsert(links.slice(i, i + 200), { onConflict: "unit_id,keyword_id", ignoreDuplicates: true }), "단원-키워드 연결");
    console.log(`  [${s.apCode}] 반영 완료`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
