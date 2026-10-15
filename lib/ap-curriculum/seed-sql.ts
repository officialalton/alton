// AP 커리큘럼 시드 → 멱등 SQL 생성기(순수 함수; IO 없음). 2026-10-14.
// scripts/ap-curriculum/seed.ts --execute 와 같은 행·의미를 service key 없이 `supabase db query --linked -f` 로 적용하기 위한 것이다.
// 계획은 seed.ts 와 같은 buildPlan/buildLessonPlan 을 그대로 쓴다. 관리자가 바꾼 키워드 이름·회차 제목은 덮어쓰지 않는다.
import { buildPlan, unitDisplayName } from "./plan";
import { buildLessonPlan, checkLessonPlan, SCHEDULED_MINUTES_COMPACT, type LessonTrackSet } from "./lessons";
import { validateCurriculum } from "./validate";
import type { ApCurriculumFile } from "./types";

export function buildSeedPayload(f: ApCurriculumFile, track: LessonTrackSet = "compact") {
  const errs = [...validateCurriculum(f)];
  const lessons = buildLessonPlan(f, { track });
  errs.push(...checkLessonPlan(f, lessons, { track }));
  if (errs.length) throw new Error(`시드 데이터 오류 ${errs.length}건: ${errs.slice(0, 5).join("; ")}`);
  const s = f.subject;
  const plan = buildPlan(f);
  return {
    subject: { name: s.name, apCode: s.apCode },
    edition: { edition: s.edition, cedVersion: s.cedVersion, sourceUrl: s.sourceUrl, examYear: s.examYear, family: s.family, officialTopicCodes: s.officialTopicCodes, designNotes: s.designNotes },
    skills: f.skills.map((k, i) => ({ code: k.code, category: k.category, label: k.label, sort: i })),
    weights: f.weights.map((w) => ({ axis: w.axis, code: w.code, section: w.section, min: w.min, max: w.max, source: w.source })),
    units: plan.units.map((u) => ({ code: u.code, position: u.position, name: unitDisplayName(u.code, u.title) })),
    keywords: plan.keywords,
    track,
    lessons: lessons.map((l) => ({
      code: l.code, position: l.position, title: l.title, note: l.note, kind: l.kind, unitCode: l.unitCode, estMinutes: l.estMinutes, lessonTrack: l.track,
      scheduledMinutes: track === "compact" ? SCHEDULED_MINUTES_COMPACT : l.estMinutes, links: l.links,
    })),
  };
}
export type SeedPayload = ReturnType<typeof buildSeedPayload>;

const TXT = (path: string) => `array(select jsonb_array_elements_text(${path}))`;

export function generateSeedSql(f: ApCurriculumFile, track: LessonTrackSet = "compact"): string {
  const p = buildSeedPayload(f, track);
  const json = JSON.stringify(p);
  if (json.includes("$seed$")) throw new Error("payload 에 $seed$ 포함");
  return `-- AP 커리큘럼 시드 SQL: ${p.subject.apCode} (${p.edition.edition}, track=${track}). 자동 생성 — 직접 수정하지 말 것.
-- seed.ts --execute 와 같은 행. 멱등(재실행 안전)·additive(관리자가 바꾼 키워드 이름/회차 제목은 보존). 전체가 한 트랜잭션.
-- 적용: npx supabase db query --linked -f data/ap/seed-sql/${p.subject.apCode}.sql
begin;
do $do$
declare
  p jsonb := $seed$${json}$seed$::jsonb;
  v_ed text := p #>> '{edition,edition}';
  v_sid uuid; v_cur text; v_name text := p #>> '{subject,name}'; v_code text := p #>> '{subject,apCode}';
  v_track text := p ->> 'track';
  v_max int; v_tail int; v_pos int; v_id uuid; v_title text; r record; l jsonb; u jsonb; lvl int;
  v_taken int[]; v_plan_ids uuid[] := '{}'; v_drop uuid[]; v_keep uuid[];
  v_plan_codes text[] := array(select x->>'code' from jsonb_array_elements(p->'lessons') x);
  v_unit_codes text[] := array(select x->>'code' from jsonb_array_elements(p->'units') x);
begin
  -- 과목
  select id, ap_subject_code into v_sid, v_cur from subjects where name = v_name;
  if found then
    if v_cur is not null and v_cur <> v_code then raise exception '과목 % 의 ap_subject_code 충돌', v_name; end if;
    if v_cur is null then update subjects set ap_subject_code = v_code where id = v_sid; end if;
  else
    insert into subjects (name, ap_subject_code) values (v_name, v_code) returning id into v_sid;
  end if;

  -- 판 / 스킬 / 비중
  insert into ap_curriculum_editions (subject_id, edition, ced_version, source_url, exam_year, family, official_topic_codes, design_notes, is_current)
  values (v_sid, v_ed, p #>> '{edition,cedVersion}', p #>> '{edition,sourceUrl}', (p #>> '{edition,examYear}')::int, p #>> '{edition,family}', (p #>> '{edition,officialTopicCodes}')::boolean, p #>> '{edition,designNotes}', true)
  on conflict (subject_id, edition) do update set ced_version = excluded.ced_version, source_url = excluded.source_url, exam_year = excluded.exam_year, family = excluded.family,
    official_topic_codes = excluded.official_topic_codes, design_notes = excluded.design_notes, is_current = excluded.is_current;
  insert into ap_skills (subject_id, edition, code, category, label, sort_order)
  select v_sid, v_ed, k->>'code', k->>'category', k->>'label', (k->>'sort')::int from jsonb_array_elements(p->'skills') k
  on conflict (subject_id, edition, code) do update set category = excluded.category, label = excluded.label, sort_order = excluded.sort_order;
  insert into ap_exam_weights (subject_id, edition, axis, code, section, min_pct, max_pct, source)
  select v_sid, v_ed, k->>'axis', k->>'code', k->>'section', (k->>'min')::numeric, (k->>'max')::numeric, k->>'source' from jsonb_array_elements(p->'weights') k
  on conflict (subject_id, edition, axis, code, section) do update set min_pct = excluded.min_pct, max_pct = excluded.max_pct, source = excluded.source;

  -- 단원 = 키워드 폴더(이미 있으면 그대로)
  insert into subject_keyword_folders (subject_id, name, position, official_code, source)
  select v_sid, k->>'name', (k->>'position')::int, k->>'code', 'ced' from jsonb_array_elements(p->'units') k
  where not exists (select 1 from subject_keyword_folders f where f.subject_id = v_sid and f.official_code = k->>'code');

  -- 키워드: 기존 코드는 메타만 갱신(이름·폴더 불변), 새 코드는 토픽 → 세부 순으로 생성
  update subject_keywords sk set skill_codes = ${TXT("k->'skillCodes'")}, requires_codes = ${TXT("k->'requiresCodes'")}, est_lessons = (k->>'estLessons')::numeric,
    kind = k->>'kind', scope = k->>'scope', content_key = k->>'contentKey', sort_order = (k->>'sortOrder')::int
  from jsonb_array_elements(p->'keywords') k where sk.subject_id = v_sid and sk.content_code = k->>'contentCode';
  for lvl in 1..2 loop
    insert into subject_keywords (subject_id, label, status, content_code, content_key, level, parent_keyword_id, source, edition, kind, skill_codes, requires_codes, est_lessons, scope, folder_id, sort_order)
    select v_sid, k->>'label', 'active'::keyword_status, k->>'contentCode', k->>'contentKey', lvl,
      (select x.id from subject_keywords x where x.subject_id = v_sid and x.content_code = k->>'parentCode'), 'ced', v_ed, k->>'kind',
      ${TXT("k->'skillCodes'")}, ${TXT("k->'requiresCodes'")}, (k->>'estLessons')::numeric, k->>'scope',
      (select f.id from subject_keyword_folders f where f.subject_id = v_sid and f.official_code = k->>'unitCode'), (k->>'sortOrder')::int
    from jsonb_array_elements(p->'keywords') k
    where (k->>'level')::int = lvl and not exists (select 1 from subject_keywords x where x.subject_id = v_sid and x.content_code = k->>'contentCode')
    order by (k->>'sortOrder')::int;
  end loop;

  -- 회차(템플릿 행)
  select coalesce(max(position), 0) into v_max from subject_template_units where subject_id = v_sid;
  -- 이전 시드의 단원 단위 행 정리(source='ced', lesson_kind null, 단원 번호 코드)
  delete from subject_template_units where subject_id = v_sid and lesson_kind is null and official_code = any (v_unit_codes) and source = 'ced';
  -- 다른 과정 회차: 참조 없으면 삭제, 참조되면 보존하고 primary → review 강등 + 순서 뒤로
  select coalesce(array_agg(id), '{}') into v_drop from subject_template_units t
   where t.subject_id = v_sid and t.lesson_kind is not null and t.official_code is not null and t.official_code <> all (v_plan_codes)
     and not exists (select 1 from curriculum_overlay_units o where o.source_unit_id = t.id)
     and not exists (select 1 from teacher_curriculum_template_units o where o.source_unit_id = t.id);
  select coalesce(array_agg(id order by position), '{}') into v_keep from subject_template_units t
   where t.subject_id = v_sid and t.lesson_kind is not null and t.official_code is not null and t.official_code <> all (v_plan_codes) and t.id <> all (v_drop);
  delete from subject_template_units where id = any (v_drop) and source = 'ced';
  if cardinality(v_keep) > 0 then
    update subject_template_unit_keywords set role = 'review' where unit_id = any (v_keep) and role = 'primary';
    v_tail := v_max + 10000;
    foreach v_id in array v_keep loop v_tail := v_tail + 1; update subject_template_units set position = v_tail where id = v_id; end loop;
    raise notice '참조 중이라 보존한 다른 과정 회차 % 개', cardinality(v_keep);
  end if;
  -- 위치 충돌 계산: 남은 행(보존분은 +10000 이상으로 이동됨, 삭제분 제외)
  select coalesce(array_agg(position), '{}') into v_taken from subject_template_units where subject_id = v_sid;
  for l in select x from jsonb_array_elements(p->'lessons') x loop
    select id, unit_title into v_id, v_title from subject_template_units where subject_id = v_sid and official_code = l->>'code';
    if found then
      update subject_template_units set lesson_kind = l->>'kind', ced_unit_code = l->>'unitCode', est_minutes = (l->>'estMinutes')::int, track = l->>'lessonTrack', track_set = v_track,
        scheduled_minutes = (l->>'scheduledMinutes')::int, suggested_lessons = 1, note = l->>'note',
        unit_title = case when v_title is null or v_title = '' or v_title ~ '^Unit [0-9]+ · Lesson |^Exam Prep ' then l->>'title' else unit_title end
      where id = v_id;
    else
      v_pos := (l->>'position')::int;
      while v_pos = any (v_taken) loop v_pos := v_pos + 1000; end loop;
      v_taken := v_taken || v_pos;
      insert into subject_template_units (subject_id, position, unit_title, note, official_code, source, lesson_kind, ced_unit_code, est_minutes, track, track_set, scheduled_minutes, suggested_lessons)
      values (v_sid, v_pos, l->>'title', l->>'note', l->>'code', 'ced', l->>'kind', l->>'unitCode', (l->>'estMinutes')::int, l->>'lessonTrack', v_track, (l->>'scheduledMinutes')::int, 1);
    end if;
  end loop;
  -- 재시드: 계획 회차의 기존 연결을 비우고 새 계획으로 다시 만든다
  delete from subject_template_unit_keywords where unit_id in (select id from subject_template_units where subject_id = v_sid and official_code = any (v_plan_codes));
  insert into subject_template_unit_keywords (unit_id, keyword_id, role, depth)
  select t.id, kw.id, lk->>'role', lk->>'depth'
  from jsonb_array_elements(p->'lessons') l2
  cross join lateral jsonb_array_elements(l2->'links') lk
  join subject_template_units t on t.subject_id = v_sid and t.official_code = l2->>'code'
  join subject_keywords kw on kw.subject_id = v_sid and kw.content_code = lk->>'contentCode'
  on conflict (unit_id, keyword_id) do update set role = excluded.role, depth = excluded.depth;
  if (select count(*) from subject_template_unit_keywords k join subject_template_units t on t.id = k.unit_id where t.subject_id = v_sid and t.official_code = any (v_plan_codes))
     < (select count(*) from jsonb_array_elements(p->'lessons') l3, jsonb_array_elements(l3->'links') lk3) then
    raise exception '회차 연결 대상 id 누락';
  end if;
end
$do$;
commit;
`;
}

export function generateVerifySql(f: ApCurriculumFile, track: LessonTrackSet = "compact"): string {
  const p = buildSeedPayload(f, track);
  const sid = `(select id from subjects where ap_subject_code = '${p.subject.apCode}')`;
  const linkCount = p.lessons.reduce((n, l) => n + l.links.length, 0);
  const codes = (a: string[]) => a.map((c) => `'${c.replace(/'/g, "''")}'`).join(",");
  const checks: [string, number, string][] = [
    ["subject", 1, `select count(*) from subjects where ap_subject_code = '${p.subject.apCode}'`],
    ["edition", 1, `select count(*) from ap_curriculum_editions where subject_id = ${sid} and edition = '${p.edition.edition}'`],
    ["skills", p.skills.length, `select count(*) from ap_skills where subject_id = ${sid} and edition = '${p.edition.edition}'`],
    ["weights", p.weights.length, `select count(*) from ap_exam_weights where subject_id = ${sid} and edition = '${p.edition.edition}'`],
    ["folders(units)", p.units.length, `select count(*) from subject_keyword_folders where subject_id = ${sid} and official_code in (${codes(p.units.map((u) => u.code))})`],
    ["keywords L1", p.keywords.filter((k) => k.level === 1).length, `select count(*) from subject_keywords where subject_id = ${sid} and level = 1 and source = 'ced'`],
    ["keywords L2", p.keywords.filter((k) => k.level === 2).length, `select count(*) from subject_keywords where subject_id = ${sid} and level = 2 and source = 'ced'`],
    ["L2 without parent", 0, `select count(*) from subject_keywords where subject_id = ${sid} and level = 2 and parent_keyword_id is null`],
    ["keywords without folder", 0, `select count(*) from subject_keywords where subject_id = ${sid} and source = 'ced' and folder_id is null`],
    ["lessons", p.lessons.length, `select count(*) from subject_template_units where subject_id = ${sid} and official_code in (${codes(p.lessons.map((l) => l.code))})`],
    ["lesson links", linkCount, `select count(*) from subject_template_unit_keywords k join subject_template_units t on t.id = k.unit_id where t.subject_id = ${sid} and t.official_code in (${codes(p.lessons.map((l) => l.code))})`],
    ["primary links", p.lessons.reduce((n, l) => n + l.links.filter((x) => x.role === "primary").length, 0), `select count(*) from subject_template_unit_keywords k join subject_template_units t on t.id = k.unit_id where t.subject_id = ${sid} and k.role = 'primary'`],
  ];
  return `-- 검증(읽기 전용): ${p.subject.apCode}. ok 가 모두 true 여야 한다.\n` + checks.map(([n, e, q]) => `select '${n}' as check, ${e} as expected, (${q}) as actual, ${e} = (${q}) as ok`).join("\nunion all\n") + ";\n";
}

export function generateRollbackSql(f: ApCurriculumFile): string {
  const s = f.subject;
  return `-- 롤백(주의: 이 시드가 만든 과목 행을 지워 FK cascade 로 키워드·폴더·회차·연결·판·스킬·비중을 모두 지운다. 시드 이후 관리자가 편집한 내용도 사라진다).
-- 키워드 개별 DELETE 는 ap_official_keyword_protected 트리거가 막으므로 과목 단위로만 가능. 학생·선생님 층이 참조 중이면 FK 오류로 전체 중단된다.
-- 과목이 시드 이전부터 있었다면(다른 데이터 보유) 이 파일을 쓰지 말 것.
begin;
delete from subjects where ap_subject_code = '${s.apCode}';
commit;
`;
}
