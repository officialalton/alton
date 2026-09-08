# Lesson Preparation, Session Selection, and Homework Composition — Kickoff Package

> Planning/documentation only. No code, no migrations, no external calls. Written after R9 Tasks
> 1–4 (`44125f0`, `505d05b`, `63f5f57`, `5bea813`, `b2bb6d7`) and the 2026-09-07/08 acceptance-gate
> verification round (see `docs/CURRENT.md` for that round's dated entry). This document maps the
> plan's "Separate follow-on plan" section
> (`docs/superpowers/plans/2026-09-07-curriculum-content-foundation.md` line 112–114) onto the
> tables and code paths that actually exist today, and flags what a future planning pass still
> needs to decide.
>
> **STATUS (2026-09-07): 파운데이션 1차 최종 승인 완료(corrective 3건 포함) — 이 문서의 정책
> 질문 6건은 여전히 기획 확정 대기 상태이며, 그 확정 전에는 구현에 착수하지 않는다.** 실제
> 구현 시 반드시 지킬 것(제품 오너 지시, 2026-09-07): 선택 가능 콘텐츠는 항상
> `curriculum_doc_section_keywords_selectable`/`problem_keywords_selectable` 같은 읽기 전용
> selectable view 기준으로 불러오고, **세션 콘텐츠 고정(pin) 시점과 과제 출제 시점 각각에서
> published/confirmed 상태를 다시 검증**한다(선택 시점 검사 1회로 끝내지 않는다). 외부 호출·
> Preview 배포·non-prod 반영은 사전 승인 없이 하지 않는다.

## 1. What exists today (verified this round)

| Concern | Source of truth | Notes |
| --- | --- | --- |
| Canonical subject keywords | `subject_keywords` (`subject_id`, `label`, `normalized_label`, `status`) | Admin-write only (RLS `is_admin()`); unique per `(subject_id, normalized_label)`. |
| Unit ↔ keyword | `subject_template_unit_keywords` | Same-subject enforced by trigger `check_unit_keyword_same_subject`. |
| Section ↔ keyword ("teaching-selectable") | `curriculum_doc_section_keywords` | Trigger `check_section_keyword_published` rejects unless parent `curriculum_docs.status = 'published'`; cleaned up automatically if the doc leaves `published` (`cleanup_section_keywords_on_unpublish`). |
| Problem ↔ keyword ("teaching-selectable") | `problem_keywords` | Trigger `check_problem_keyword_confirmed` rejects unless `problems.status = 'confirmed'`; cleaned up if unconfirmed (`cleanup_problem_keywords_on_unconfirm`). |
| Student operating curriculum | `student_curriculum_overlays` (one active per `subject_enrollment_id`) + `curriculum_overlay_units` (ordered, `source_unit_id` nullable for supplement units, `status` enum `not_started/in_progress/completed/reinforcement_needed/skipped`, `status_changed_by/at` audit) | Teacher-write gated by `is_active_teacher_for_enrollment()`; student read-only via `is_owning_student_for_enrollment()`; reorder is one RPC (`reorder_curriculum_overlay_units`), one transaction. |
| Overlay unit ↔ active keywords | `curriculum_overlay_unit_keywords` | Same-subject trigger, same RLS shape as overlay units. |
| Overlay unit ↔ reference material | `curriculum_overlay_unit_materials` | Trigger `check_overlay_unit_material_published` — only `published` docs, even for supplement units. |
| Teacher server actions | `app/teacher/student-curriculum-actions.ts`: `ensureActiveOverlay`, `addCanonicalUnit`, `createSupplementUnit`, `excludeUnit`, `moveUnit`, `setUnitStatus` | All gated by `requireAssignedTeacherOrAdmin()`; none write to any canonical table (verified by checksum tests, see §4 of the verification round). |
| Teacher data loaders | `app/teacher/student-curriculum-data.ts`: `loadStudentCurriculum`, `loadEligibleLibrary` | `loadEligibleLibrary` is the "published/confirmed catalog for this subject" read path — this is the natural base for the follow-on plan's keyword-filtered material/problem tabs. |
| Teacher UI | `app/teacher/StudentCurriculumPanel.tsx`, wired into `TeacherShell` → `CurriculumTab` → `StudentCurriculumOperatingView` via the "배정" tab's "운영 커리큘럼 관리" button (2026-09-07 UI-wiring round, commit `b2bb6d7`) | Entry point already exists; no raw problem creation is offered here (plan constraint). |
| Session-time AI problem generation | Removed (R9 Task 4, commit `5bea813`) | `AigenTab`/`aigen-actions.ts`/`aigen-data.ts` deleted; `SessionShell.tsx` tabs are now `교재`, `과제`, `단어장`, `연습장` only. AI drafting stays admin-only in `app/admin/curriculum-doc-actions.ts`. |
| Student answer history | `session_problem_attempts` (`session_id`, `student_id`, `problem_id`, `response`, `correct`, `saved`, `attempted_at`) | Pre-existing table from initial schema; **not** touched by any R9 migration (verified — zero triggers added, zero FK added). This is the reuse target named in the plan. |
| Session pinning invariant | `sessions.material_version_id` (R8, `20261219000000_r8_material_version_lock.sql`) | Trigger blocks any change once `final_status <> 'scheduled'` or the session is `completed`. This is the existing "never change after session starts" pattern the follow-on plan must reuse, not reinvent. |
| Session annotation stream | `session_annotation_events` (R8/R9 cutover, `20261223000000_r8_session_annotation_events.sql` + realtime/atomic-append follow-ups) | Append-only (no update/delete triggers), RLS scoped to session participants + admin. |

## 2. Current state → what needs to connect

The plan's follow-on section names five capabilities. Mapped onto the table above:

1. **"Prepared active-keyword selection for an upcoming v3 session."**
   `curriculum_overlay_unit_keywords` already stores, per overlay unit, which canonical keywords
   are "active" for that unit. What's missing: a place to say *which overlay unit / which active
   keyword subset applies to a specific upcoming `sessions` row*. Today nothing links
   `curriculum_overlay_units` or `curriculum_overlay_unit_keywords` to a `sessions.id`. A new table
   (working name: `session_prepared_selections` or similar — genuinely open, see §4) would need to
   record, per session, the chosen overlay unit(s) and the active keyword subset chosen at prep
   time.

2. **"Pin selected content at session start."**
   The existing `material_version_id` trigger on `sessions` (R8) is the model: block mutation once
   `final_status <> 'scheduled'` / once `completed`. Whatever new column(s) or table row represents
   "prepared selection for this session" must get an equivalent before/after-update trigger, or
   (simpler, and consistent with `reorder_curriculum_overlay_units`'s one-RPC pattern) a
   single "pin selection" RPC called once at session start that is itself blocked from re-running
   once the session is no longer `scheduled`. This is the concrete connection point with R8's
   material-version-lock migration — the follow-on plan should literally reuse that trigger
   pattern (same predicate: `old.final_status <> 'scheduled'` or `new.final_status = 'completed'`)
   rather than inventing a new invariant shape.

3. **"Keyword-filtered material/problem tabs."**
   `loadEligibleLibrary(supabase, subjectId)` in `app/teacher/student-curriculum-data.ts` already
   loads the published/confirmed catalog for a subject. The follow-on plan's tab would filter that
   same catalog by the active keyword set pinned in (2) — i.e. join through
   `curriculum_doc_section_keywords` / `problem_keywords` on the pinned `keyword_id`s. No new
   catalog-loading path should be needed; this is a filter added to the existing eligible-library
   query, not a new source of truth.

4. **"Teacher 'used in lesson' event distinct from viewing."**
   Nothing today records "the teacher actually used this material/problem in the lesson" as
   opposed to merely having it selectable or having the student view it. `session_annotation_events`
   is the closest existing append-only event stream (R8/R9), but it is annotation-specific
   (strokes/clears) — reusing it directly would conflate whiteboard annotation semantics with
   lesson-content-usage semantics. The follow-on plan likely needs a **new** append-only event
   table (e.g. `session_material_use_events` / `session_problem_use_events` — open question, see
   §4) following the same append-only + RLS-scoped-to-participants pattern as
   `session_annotation_events`, not a repurposing of that table.

5. **"Homework composed from confirmed canonical problems with two inclusion toggles."**
   `problem_keywords` + `problems.status = 'confirmed'` is the selectable pool (identical predicate
   to Task 1's teaching-selectable invariant — reuse, don't re-derive). `homework_items` (pre-existing,
   `20260827120000_initial_schema.sql`) is the existing homework container. The follow-on plan needs
   to decide the two toggle semantics (open question, §4) and how a toggle choice writes into (or
   alongside) `homework_items` without ever selecting a non-`confirmed` problem — the same trigger
   pattern as `check_problem_keyword_confirmed` (reject at insert time, not just at read time)
   should gate whatever new homework-composition write path is added.

6. **"Reuse `session_problem_attempts` for student answer history."**
   Already reusable as-is — verified untouched by R9 (§4 of the verification round). No new answer
   table needed; the follow-on plan's homework/session-selection UI reads existing
   `session_problem_attempts` rows keyed by `problem_id`/`student_id`/`session_id`.

## 3. Permission boundaries carried forward

- **Admin** remains the only writer of canonical content (`curriculum_docs`, `curriculum_doc_sections`,
  `problems`, `subject_template_units`, all `*_keywords` catalog tables). The follow-on plan adds no
  new canonical-write path — every new table it needs (prepared-selection, used-in-lesson events,
  homework composition) is either session-scoped or overlay-scoped, never canonical.
- **Teacher** writes are scoped by the existing `is_active_teacher_for_enrollment()` /
  `teacher_assignments` pattern (Task 3) for overlay-adjacent state, and by whatever the existing
  session-participant check is for `sessions`/`session_annotation_events`-adjacent state. Any new
  "used in lesson" event table should reuse the session-participant RLS shape already established
  for `session_annotation_events`, not invent a new authorization primitive (this repeats the plan's
  own stated principle for Task 3: reuse existing mechanisms rather than adding new ones).
- **Student** read access stays read-only and scoped to their own enrollment/session, matching the
  `is_owning_student_for_enrollment()` pattern verified this round. No new capability should let a
  student see another student's prepared selection, used-in-lesson events, or homework composition
  toggles — this is a direct extension of acceptance-gate claim 3.
- **Vocabulary** (`vocab_words`) stays entirely outside this follow-on plan's scope, exactly as it
  was outside Tasks 1–4's scope. No new code path should reference it.

## 4. Migrations likely needed (naming and shape are open, not decided here)

- A session-scoped "prepared selection" table linking `sessions.id` → one or more
  `curriculum_overlay_units.id` (and/or a keyword subset), with a pin-at-start invariant modeled on
  `20261219000000_r8_material_version_lock.sql`.
- A new append-only "used in lesson" event table (material and/or problem), RLS-scoped to session
  participants + admin, modeled on `20261223000000_r8_session_annotation_events.sql`'s
  append-only/no-update/no-delete trigger pair.
- A homework-composition write path that selects only `problems.status = 'confirmed'` rows already
  reachable via `problem_keywords` for the session's pinned keyword set, writing into
  `homework_items` (or a new join table if `homework_items`'s existing shape can't carry the two
  inclusion toggles — needs the current `homework_items` schema reviewed at planning time, not
  assumed here).
- Possibly: an index/materialized view for "eligible content for this session's pinned keywords" if
  `loadEligibleLibrary`'s per-request join proves too slow once keyword-filtering is added — a
  performance question to validate with real data volume, not to pre-build now.

## 5. UAT scenario list (for the next planning review to refine, not execute)

1. Teacher opens an upcoming v3 session's prep view, selects an overlay unit and a subset of its
   active keywords, and confirms the pinned selection before the session starts.
2. Teacher attempts to change the pinned selection after the session's `final_status` moves off
   `scheduled` — rejected, mirroring the existing `material_version_id` UAT pattern.
3. Teacher opens the material tab during a live session and sees only content matching the pinned
   keyword subset; teacher opens the problem tab and sees only `confirmed` problems tagged with
   that subset.
4. Teacher marks a material section "used in lesson" — a new event is recorded distinct from the
   student's earlier "viewed" event (if such a distinction already exists elsewhere) and distinct
   from any `session_problem_attempts` row.
5. Teacher composes homework from the session's confirmed problem pool, exercising both inclusion
   toggles independently and in combination; unconfirmed/draft problems never appear as selectable.
6. Student views their own homework and answer history via existing `session_problem_attempts`
   rows; a second, unrelated student cannot see this session's prepared selection, used-in-lesson
   events, or homework composition (RLS parity with the acceptance-gate claim 3 pattern already
   proven for the overlay tables).
7. Two teachers assigned to the same student at different times cannot each pin conflicting
   selections for the same session (single active pin, analogous to the overlay's "one active
   overlay per enrollment" invariant).

## 6. Decisions (제품 오너 확정, 2026-09-08)

정책 검토 문서 `docs/superpowers/specs/2026-09-08-lesson-prep-policy-review.md`의 권장안을
기준으로 아래와 같이 확정됐다. 이 절 아래 §7이 상세 구현 계획이다.

1. **"레슨에서 사용함" 이벤트**: 단일 순간의 명시적 기록. 대상은 교재 섹션과 문제 둘 다.
   단순 열람(탭 오픈, 스크롤 등)은 절대 기록하지 않는다 — 교사의 명시적 조작(버튼/탭 1회)만.
2. **과제 포함 토글**: "수업 사용 문제 포함" / "학생이 이미 푼 문제 포함" 2개로 확정, 각각
   독립적으로 on/off. 서로 배타적이지 않다(둘 다 켜기/끄기/한쪽만 가능).
3. **준비 선택(prepared selection) 단위**: 세션당 여러 단원·키워드 조합을 처음부터 허용한다
   (복습+새 진도를 한 수업에서 함께 다루는 것이 기본 사용 사례). 단원별 진도 상태(`not_started`
   등)는 세션 완료만으로 자동 전이되지 않는다 — 여전히 교사의 명시적 `setUnitStatus` 행동으로만
   바뀐다(Task 3 원칙 그대로 유지, 이 follow-on plan이 자동 상태 전이를 추가하지 않는다).
4. **취소·재예약 시 이월**: 자동 이월하지 않는다. 대신 취소된 세션의 준비 구성은 **임시보관함
   (staged/held prepared selection)**에 남아 삭제되지 않고, 교사가 새 세션에 수동으로 다시
   붙일 수 있다. 세션별 콘텐츠 스냅샷(고정된 뒤)의 불변성은 그대로 유지 — 임시보관함은 "아직
   고정 안 된" 준비 상태에만 적용되고, 이미 pin된 세션의 스냅샷을 소급 변경하지 않는다.
5. **학생 노출**: "레슨에서 사용함" 기록은 교사·관리자 전용으로 시작. 학생 노출·복습 화면은
   후속 범위(이 라운드에 포함하지 않음).
6. **성능/인덱스**: 정책 결정 대상이 아님 — 구현 시 실제 데이터 규모와 쿼리 실측 근거로 판단.

## 7. See detailed implementation plan

상세 구현 계획은 `docs/superpowers/plans/2026-09-08-lesson-prep-session-selection.md` 참고
(임시보관함, 다단원 선택, 세션 고정·과제 출제 시점 selectable view 재검증, 실제 사용 이벤트,
과제 후보 제외 규칙 포함). 코드 작업은 그 계획이 승인된 뒤에만 시작한다.
