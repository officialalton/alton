# Lesson Preparation, Session Selection, and Homework Composition — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **STATUS: DRAFT — submitted for product-owner approval before any code work starts.** Built on
> the approved curriculum-content foundation (`docs/superpowers/plans/2026-09-07-curriculum-
> content-foundation.md`, APPROVED) and the confirmed policy decisions in
> `docs/superpowers/specs/2026-09-08-lesson-prep-session-selection-kickoff.md` §6. Do not start
> Task 1 until this plan itself is approved.

**Goal:** Let a teacher prepare an upcoming v3 session's content ahead of time (possibly across
multiple curriculum-overlay units at once), pin that preparation immutably once the session starts,
browse keyword-filtered material/problem tabs during the live session, record explicit "used in
lesson" moments distinct from mere viewing, and compose homework from confirmed problems with two
independently-controlled inclusion toggles — all while never letting a non-`published`/non-
`confirmed` piece of content reach a student.

**Architecture:** No canonical-content changes. Everything here is session-scoped or overlay-scoped
state layered on top of the already-approved 3-tier structure (admin canonical content → subject
template/base curriculum → student operating-curriculum overlay). Reuses, rather than reinvents:
R8's `material_version_id` pin-and-lock trigger pattern, R8/R9's `session_annotation_events`
append-only+RLS-scoped-to-participants pattern, Task 3's `reorder_curriculum_overlay_units` one-RPC
atomic-multi-row pattern, and Task 1/corrective-2's `curriculum_doc_section_keywords_selectable`/
`problem_keywords_selectable` published/confirmed gate views.

**Tech Stack:** Next.js App Router, TypeScript, Supabase Postgres/RLS/RPC, Vitest, existing
teacher session-view (`app/session/[id]/`) and `StudentCurriculumPanel`.

## Global Constraints

- Work only inside `ALTON`; do not modify the parent Claude repository.
- No canonical-content write path is added anywhere in this plan — every new table is session-
  scoped, overlay-scoped, or a staging/holding-area concept for teacher preparation. Admin remains
  the only writer of `curriculum_docs`/`curriculum_doc_sections`/`problems`/`subject_template_units`/
  all `*_keywords` catalog tables.
- **Selectable-view re-verification is required at TWO separate points, not one**: (a) when a
  teacher pins a prepared selection for a session, and (b) when homework is actually composed/
  issued. A problem or section that was selectable when first added to a prepared selection or
  overlay may have been unpublished/unconfirmed by the time of either of these two moments — both
  moments must re-check `curriculum_doc_section_keywords_selectable`/`problem_keywords_selectable`
  (or the equivalent predicate) and reject/exclude anything that no longer passes.
- "Used in lesson" is recorded ONLY by an explicit teacher action (single instant, not a
  start/end range) for a material section or a problem — never inferred from a tab being opened or
  any other passive viewing signal.
- Unit progress status (`curriculum_overlay_units.status`) is changed ONLY by explicit teacher
  action (`setUnitStatus`, already built in Task 3) — this plan adds no automatic status transition
  triggered by session completion or anything else.
- No session-time AI generation (already retired, R9 Task 4) — this plan does not reintroduce it.
- `vocab_words` stays completely out of scope, exactly as in the foundation round.
- No external calls, deployment, non-prod migration push, Preview deploy, UAT account creation, or
  Production changes without explicit product-owner pre-approval (restored policy, 2026-09-07).

## File map

| File | Responsibility |
| --- | --- |
| `supabase/migrations/20261232000000_r9_session_prepared_selection.sql` | Prepared-selection container + multi-unit/keyword-subset children, staging/attach/pin/detach state machine, pin invariant. |
| `supabase/migrations/20261233000000_r9_session_content_use_events.sql` | Append-only "used in lesson" event table (material section + problem), RLS scoped to session participants (teacher/admin write+read; student excluded per decision 5). |
| `supabase/migrations/20261234000000_r9_homework_composition.sql` | Homework-composition write path with the two inclusion-toggle filters, gated by `problem_keywords_selectable` at write time. |
| `app/teacher/session-prep-data.ts` | Load: a subject_enrollment's held/staged prepared selections (the "임시보관함"), an upcoming session's currently-attached selection, keyword-filtered eligible content for pinning. |
| `app/teacher/session-prep-actions.ts` | Teacher-only: `createPreparedSelection`, `addUnitToSelection`, `removeUnitFromSelection`, `setSelectionActiveKeywords`, `attachSelectionToSession`, `detachSelectionFromSession` (→ back to holding area), `pinSessionSelection`. |
| `app/teacher/SessionPrepPanel.tsx` | Teacher UI: holding-area list, attach-to-session picker, multi-unit/keyword composer, pin action with a clear "locked after this" warning. |
| `app/session/[id]/session-content-data.ts` | Session-view data loader: pinned selection's keyword-filtered material/problem candidates (re-checked against selectable views at read time too, defense-in-depth alongside the pin-time check). |
| `app/session/[id]/session-content-use-actions.ts` | `markMaterialUsedInLesson`, `markProblemUsedInLesson` — the only writers of the use-event table. |
| `app/session/[id]/MaterialTab.tsx`, `app/session/[id]/HomeworkTab.tsx` (or existing equivalents — verify actual current file names before editing) | Filter candidates by the session's pinned active-keyword set; add the explicit "사용 처리" action; homework composer UI with the two toggles. |
| `app/teacher/homework-composition-actions.ts` | `composeHomeworkFromSession(sessionId, keywordIds, count, { includeUsedInLesson, includeAlreadyAttempted })` — re-verifies `confirmed` status per problem at write time, writes into `homework_items` (schema reviewed first — see Task 4). |

## Task 1: Prepared-selection schema — staging area, multi-unit, pin invariant

**Files:**
- Create: `supabase/migrations/20261232000000_r9_session_prepared_selection.sql`
- Create: `app/teacher/session-prep-data.ts`, `app/teacher/session-prep-actions.ts`
- Test: `app/teacher/session-prep-actions.test.ts`, one DB integration test for state-machine/RLS/concurrency

**Consumes:** `curriculum_overlay_units`, `curriculum_overlay_unit_keywords` (Task 3, foundation
round), `sessions` (`final_status`), `teacher_assignments`/`is_active_teacher_for_enrollment()`.

**Produces:**
- `session_prepared_selections(id, subject_enrollment_id, teacher_id, status enum('staged','pinned','archived'), session_id nullable, pinned_at nullable, created_at, updated_at)` — `session_id` is NULL while the selection lives only in the holding area (임시보관함); it is set when a teacher attaches the selection to a specific upcoming session; it reverts to NULL (detach) if that session is cancelled before pin, and the row is **not deleted** — it simply becomes visible again in the holding-area list.
- `session_prepared_selection_units(id, prepared_selection_id, overlay_unit_id, position)` — one prepared selection can reference **multiple** `curriculum_overlay_units` rows (review + new material in one lesson, per decision 3), ordered.
- `session_prepared_selection_unit_keywords(prepared_selection_unit_id, keyword_id)` — the active keyword subset chosen per unit within this selection, must be a subset of that unit's `curriculum_overlay_unit_keywords`.
- A unique partial index enforcing **at most one non-archived selection attached to a given `session_id`** (a session can have zero or one attached-and-not-yet-archived prepared selection at a time — mirrors the "one active overlay per enrollment" invariant already proven in the foundation round).
- **Pin invariant, modeled directly on `20261219000000_r8_material_version_lock.sql`**: once `status = 'pinned'`, no row in `session_prepared_selections`/`session_prepared_selection_units`/`session_prepared_selection_unit_keywords` for that selection may be mutated (trigger rejects any UPDATE/DELETE once pinned, same predicate shape as the existing `material_version_id` lock: blocked once the owning session's `final_status <> 'scheduled'` or `= 'completed'`). Detach (`session_id` → NULL) is only possible while `status = 'staged'`, never while `'pinned'`.

- [ ] Write integration tests proving: a teacher may create/edit a staged selection with multiple units and per-unit keyword subsets while it is unattached (in the holding area) or attached-but-unpinned; attaching sets `session_id`; detaching (only allowed pre-pin) clears `session_id` back to NULL without deleting the row, and the row then reappears in the holding-area query; pinning sets `status='pinned'` and `pinned_at`, and any further mutation attempt (unit add/remove, keyword change, detach) is rejected by the trigger; a teacher without `is_active_teacher_for_enrollment()` for this subject_enrollment cannot create/edit/attach/pin; two concurrent attach attempts for the same session cannot both succeed (unique partial index enforces this, prove with a concurrency test).
- [ ] Run the new tests against a reset local database and confirm they fail before the migration exists.
- [ ] Add the migration with the tables, unique constraints, RLS (write: `is_active_teacher_for_enrollment()`; read: same, plus admin), and the pin-lock trigger reusing R8's exact predicate shape.
- [ ] Implement `createPreparedSelection`, `addUnitToSelection`, `removeUnitFromSelection`, `setSelectionActiveKeywords`, `attachSelectionToSession`, `detachSelectionFromSession` in `session-prep-actions.ts`; implement `loadHeldSelections` (holding area list for a subject_enrollment), `loadSessionSelection` (currently-attached selection for a session) in `session-prep-data.ts`.
- [ ] Re-run tests, `supabase db reset --local`, `tsc --noEmit`; commit only this task's files.

## Task 2: Pin-time selectable-view re-verification + `pinSessionSelection`

**Files:**
- Modify: `app/teacher/session-prep-actions.ts` (add `pinSessionSelection`)
- Test: extend Task 1's integration test file

**Consumes:** Task 1's schema; `curriculum_doc_section_keywords_selectable`/
`problem_keywords_selectable` views (corrective 2, foundation round).

**Produces:** A `pinSessionSelection(sessionId)` action/RPC that, in one transaction: (a) re-checks
that every unit/keyword-subset combination in the attached-but-unpinned selection still resolves to
at least the content that was selectable when added — specifically, it must re-run the selectable-
view predicate for every section/problem the pin will make reachable, and (b) only then flips
`status → 'pinned'`, refusing (with a clear error identifying which piece became unselectable) if
anything referenced has been unpublished/unconfirmed since it was added to the selection. This is
the first of the two required re-verification points (decision: pin time).

- [ ] Write integration tests: content that was selectable when added to the selection but gets unpublished/unconfirmed before pin causes `pinSessionSelection` to fail with a clear identification of the offending item, and the selection stays `staged` (not partially pinned); content that remains selectable pins successfully; pinning is blocked once the session's `final_status` has already moved off `scheduled` (mirrors `material_version_id`'s existing UAT pattern, reuse the same check, don't reinvent it).
- [ ] Implement `pinSessionSelection`, run tests, `supabase db reset --local`, `tsc --noEmit`; commit separately from Task 1.

## Task 3: "Used in lesson" event — teacher-only, session-scoped, append-only

**Files:**
- Create: `supabase/migrations/20261233000000_r9_session_content_use_events.sql`
- Create: `app/session/[id]/session-content-use-actions.ts`
- Modify: session-view material/problem tab components (verify actual current file names first — do not assume, check `app/session/[id]/` directly) to add an explicit "사용 처리" button
- Test: matching `*.test.ts`/`*.integration.test.ts`

**Consumes:** `sessions`, session-participant authorization (whatever check already gates
`session_annotation_events` writes — reuse it, don't invent a new authorization primitive).

**Produces:**
- `session_content_use_events(id, session_id, target_type enum('material_section','problem'), target_id, recorded_by, recorded_at)` — append-only (no update/delete trigger, same shape as `session_annotation_events`), one row per explicit teacher action (never a range/duration).
- RLS: write = teacher/admin who are session participants; read = teacher/admin only (decision 5 — student excluded in this round, revisit as a later, separate extension).
- `markMaterialUsedInLesson(sessionId, sectionId)` / `markProblemUsedInLesson(sessionId, problemId)` — the only writers.

- [ ] Write integration tests: a teacher marking a material/problem as used creates exactly one event with the correct `target_type`/`target_id`/`recorded_by`; no update/delete is possible on an existing event (trigger rejects); a student cannot write or read this table; opening the material/problem tab alone (no explicit mark action) creates zero events (regression-proves "viewing ≠ used").
- [ ] Add the migration + actions, wire the explicit UI button into the session-view tabs, run tests, `supabase db reset --local`, `tsc --noEmit`, `next build`; commit separately.

## Task 4: Homework composition — two independent inclusion toggles, issue-time re-verification

**Files:**
- Create: `supabase/migrations/20261234000000_r9_homework_composition.sql`
- Create: `app/teacher/homework-composition-actions.ts`
- Modify: homework UI (verify actual current homework-tab file name/shape first — review `homework_items`'s existing schema before assuming it can carry both toggles, per the kickoff doc's own §4 caveat)
- Test: matching `*.test.ts` + one DB integration test

**Consumes:** `problem_keywords_selectable` (issue-time re-verification, the second required
re-verification point), `session_content_use_events` (Task 3, "include used-in-lesson problems"
toggle), `session_problem_attempts` (pre-existing, "include already-attempted problems" toggle).

**Produces:** `composeHomeworkFromSession(sessionId, keywordIds, count, { includeUsedInLesson,
includeAlreadyAttempted })`:
1. Builds the candidate pool: problems tagged with the given keywords AND currently passing
   `problem_keywords_selectable` (re-verified at this exact moment — a problem that was `confirmed`
   when tagged or when marked used-in-lesson may have been unconfirmed since; it must be excluded
   here regardless of its use-event or attempt history).
2. Applies the two toggles independently: `includeUsedInLesson` filters candidates by presence/
   absence in `session_content_use_events` for this session; `includeAlreadyAttempted` filters by
   presence/absence in `session_problem_attempts` for this student. Both default states, and all
   four combinations (both on, both off, either alone), must be explicit test cases.
3. Selects up to `count` problems from the resulting pool and writes into `homework_items` (or a
   new join table if the existing schema can't carry both toggle flags per item — this must be
   decided by actually reading `homework_items`'s current columns before writing the migration, not
   assumed from this plan).
4. Never writes a non-`confirmed` problem into `homework_items`, enforced at the DB level (a
   trigger on the write path, same rigor as `check_problem_keyword_confirmed`), not just in app code.

- [ ] Write integration tests: composing homework with a keyword set that includes an unconfirmed problem excludes it even though it has a `problem_keywords` relation (issue-time re-verification proof); each of the four toggle combinations produces the expected candidate pool on a fixture with known used/attempted/neither problems; a DB-level attempt to insert a non-`confirmed` problem into the homework write path directly (bypassing the action) is rejected by the trigger.
- [ ] Review `homework_items`'s actual current schema; decide additive-column vs. new-join-table approach and document the decision in a short comment in the migration file itself before writing it.
- [ ] Implement, run tests, `supabase db reset --local`, `tsc --noEmit`, `next build`; commit separately.

## Acceptance gate

Before this plan is considered complete, demonstrate with database integration tests that: (1) a
pinned selection's content can never change after pin, verified the same way `material_version_id`'s
immutability is verified; (2) content that becomes unpublished/unconfirmed between "added to
selection" and "pin time" blocks the pin with a clear error, and separately, content that becomes
unpublished/unconfirmed between "tagged" and "homework issue time" is silently excluded from the
homework candidate pool (two distinct re-verification points, both proven); (3) an explicit "used in
lesson" mark is the only way a `session_content_use_events` row is created — no passive-viewing code
path ever writes one; (4) a student cannot read another student's prepared selection, held/staged
selections, use events, or homework composition (RLS parity with the foundation round's acceptance-
gate claim 3); (5) `vocab_words` remains completely untouched by every table/action in this plan.

## Verification discipline (every task)

Per-task focused tests first, then `supabase db reset --local` + `tsc --noEmit` before each commit.
After Task 4 (last task), run the FULL suite (`vitest run --no-file-parallelism` right after a fresh
`db reset --local`, `next build`) to confirm no regressions, especially in session-view/whiteboard
code this plan is adjacent to but must not modify. Update `docs/CURRENT.md` with a dated section per
task (or one covering all four if cleaner) recording only what was actually implemented and tested.

## Explicitly out of scope for this plan

- Student-facing "used in lesson" / "what we covered today" UI (decision 5 — later extension).
- Automatic backfill/migration of legacy annotation or homework data.
- Any real Stripe/Mercury/Wise/Google/email call, Vercel deploy, non-prod migration push, or UAT
  test-account creation — all require separate explicit product-owner pre-approval per the restored
  external-change policy (2026-09-07).
