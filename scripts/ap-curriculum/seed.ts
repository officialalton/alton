// AP 커리큘럼 시드 로더(2026-10-08). 기본 dry-run, --execute 때만 쓴다. 멱등(재실행 안전).
//   npx tsx scripts/ap-curriculum/seed.ts                       # 전체 과목 계획만 출력(DB 읽기 필요 없음: --offline)
//   npx tsx scripts/ap-curriculum/seed.ts --offline             # 파일 검증 + 건수만
//   npx tsx scripts/ap-curriculum/seed.ts --only ap_biology     # 한 과목
//   npx tsx scripts/ap-curriculum/seed.ts --track compact|full  # 회차 과정(기본 compact=100분 압축, full=50분 전체)
//   npx tsx scripts/ap-curriculum/seed.ts --execute             # 실제 반영(대상 DB 환경변수 필요; 비프로덕션만)
// 순서: 과목 → 판/스킬/비중 → 단원(키워드 폴더) → 토픽 → 세부 키워드 → 회차(템플릿 행) + 회차-키워드 연결(토픽·세부 전부). 관리자가 바꾼 키워드 이름은 덮어쓰지 않는다.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { connect, selectAll } from "../keywords/db";
import { buildPlan, diffKeywords, unitDisplayName } from "../../lib/ap-curriculum/plan";
import { buildLessonPlan, checkLessonPlan, lessonTotals } from "../../lib/ap-curriculum/lessons";
import { validateCurriculum } from "../../lib/ap-curriculum/validate";
import type { ApCurriculumFile } from "../../lib/ap-curriculum/types";

const execute = process.argv.includes("--execute");
const offline = process.argv.includes("--offline");
const onlyIdx = process.argv.indexOf("--only");
const trackIdx = process.argv.indexOf("--track");
const track = (trackIdx > 0 ? process.argv[trackIdx + 1] : "compact") as "compact" | "full";
if (track !== "compact" && track !== "full") throw new Error("--track 은 compact|full");
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
    const lp = buildLessonPlan(f, { track });
    const le = checkLessonPlan(f, lp, { track });
    const lt = lessonTotals(lp);
    console.log(`  회차(${track}, ${lt.minutes}분): 내용 ${lt.content} + 단원복습 ${lt.unitReview} + 시험준비 ${lt.examPrep} = ${lt.total} 오류=${le.length}`);
    errs.push(...le);
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

    // 단원 = 키워드 폴더(공식 CED 단원). 템플릿 행(회차)은 아래에서 별도로 만든다.
    const { data: fo } = await db.from("subject_keyword_folders").select("id, official_code").eq("subject_id", subjectId);
    const folderId = new Map<string, string>();
    for (const u of plan.units) {
      const name = unitDisplayName(u.code, u.title);
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
    // 회차(템플릿 행) + 회차-키워드 연결(멱등). 2026-10-08: 회차 = 50분 수업(단원 아님). 설계 문서 14절.
    const lessons = buildLessonPlan(f, { track });
    const lerrs = checkLessonPlan(f, lessons, { track });
    if (lerrs.length) throw new Error(`회차 계획 오류: ${lerrs.slice(0, 5).join("; ")}`);
    const { data: tu } = await db.from("subject_template_units").select("id, official_code, position, lesson_kind, track_set").eq("subject_id", subjectId);
    const unitCodes = new Set(plan.units.map((u) => u.code));
    // 이전(380) 시드가 만든 CED 단원 단위 행(회차가 아니었던 것)은 정리한다 — 시드 소유 행(source='ced', lesson_kind null, 단원 번호 코드)만.
    const legacy = (tu ?? []).filter((x) => x.lesson_kind === null && x.official_code && unitCodes.has(x.official_code));
    if (legacy.length) {
      const { error } = await db.from("subject_template_units").delete().in("id", legacy.map((x) => x.id)).eq("source", "ced");
      if (error) throw new Error(`레거시 단원 행 정리: ${error.message}`);
    }
    // 다른 과정(compact↔full)의 시드 회차: 학생·선생님 층이 참조하지 않으면 삭제, 참조되면 보존하되 primary 를 review 로 내려 단일-primary 규칙과 충돌하지 않게 한다.
    const planCodes = new Set(lessons.map((l) => l.code));
    const other = (tu ?? []).filter((x) => x.lesson_kind !== null && x.official_code && !planCodes.has(x.official_code));
    if (other.length) {
      const ids = other.map((x) => x.id);
      const [{ data: r1 }, { data: r2 }] = await Promise.all([
        db.from("curriculum_overlay_units").select("source_unit_id").in("source_unit_id", ids),
        db.from("teacher_curriculum_template_units").select("source_unit_id").in("source_unit_id", ids),
      ]);
      const used = new Set([...(r1 ?? []), ...(r2 ?? [])].map((r) => r.source_unit_id as string));
      const drop = ids.filter((id) => !used.has(id));
      const keep = ids.filter((id) => used.has(id));
      for (let i = 0; i < drop.length; i += 100) await ok(db.from("subject_template_units").delete().in("id", drop.slice(i, i + 100)).eq("source", "ced"), "다른 과정 회차 정리");
      if (keep.length) {
        await ok(db.from("subject_template_unit_keywords").update({ role: "review" }).in("unit_id", keep).eq("role", "primary"), "보존 회차 primary 강등");
        console.log(`  [${s.apCode}] 참조 중이라 보존한 다른 과정 회차 ${keep.length}개(primary → review 강등, 순서는 뒤로)`);
        let tail = Math.max(0, ...(tu ?? []).map((x) => x.position)) + 10000;
        for (const id of keep) await ok(db.from("subject_template_units").update({ position: ++tail }).eq("id", id), "보존 회차 순서");
      }
    }
    const removed = new Set(other.map((x) => x.id)); // 삭제됐거나 보존(뒤로 이동)된 다른 과정 행 — 위치 충돌 계산에서 제외(보존분은 +10000 이상)
    const remaining = (tu ?? []).filter((x) => !legacy.some((l) => l.id === x.id) && !removed.has(x.id));
    const taken = new Set(remaining.map((x) => x.position));
    const lessonId = new Map<string, string>(remaining.filter((x) => x.official_code && planCodes.has(x.official_code)).map((x) => [x.official_code as string, x.id]));
    for (const l of lessons) {
      const meta = { lesson_kind: l.kind, ced_unit_code: l.unitCode, est_minutes: l.estMinutes, track: l.track, track_set: track, suggested_lessons: 1 };
      const id = lessonId.get(l.code);
      if (id) { await ok(db.from("subject_template_units").update(meta).eq("id", id), `회차 갱신 ${l.code}`); continue; }
      let position = l.position;
      while (taken.has(position)) position += 1000;
      taken.add(position);
      const { data: ins, error } = await db.from("subject_template_units").insert({ subject_id: subjectId, position, unit_title: l.title, note: l.note, official_code: l.code, source: "ced", ...meta }).select("id").single();
      if (error) throw new Error(`회차 ${l.code}: ${error.message}`);
      lessonId.set(l.code, ins.id);
    }
    const links = lessons.flatMap((l) => l.links.map((k) => ({ unit_id: lessonId.get(l.code), keyword_id: idByCode.get(k.contentCode), role: k.role, depth: k.depth })));
    if (links.some((x) => !x.unit_id || !x.keyword_id)) throw new Error("회차 연결 대상 id 누락");
    for (let i = 0; i < links.length; i += 200) await ok(db.from("subject_template_unit_keywords").upsert(links.slice(i, i + 200), { onConflict: "unit_id,keyword_id" }), "회차-키워드 연결");
    console.log(`  [${s.apCode}] 반영 완료`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
