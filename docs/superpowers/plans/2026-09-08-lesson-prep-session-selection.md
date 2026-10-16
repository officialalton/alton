# Lesson Preparation, Session Selection, and Homework Composition — Implementation Plan

> **STATUS (2026-09-08): APPROVED — 제품 오너 최종 승인 완료.** Task 1~4와 그 사이 발견된
> corrective 전부(GUC bypass 3건 제거, unit provenance 강제, 학생 답안 경로, format별 UI,
> 교사 읽기전용 뷰, 과제 재구성 원자성/최소노출) 반영 완료. 관련 커밋과 완료 범위 요약은
> `docs/CURRENT.md`의 "2026-09-08 — 콘텐츠·커리큘럼 파운데이션 + 레슨 준비 계획(v4) 전체
> 최종 승인, 범위 마감" 절 참고. 후속 항목(보안 정리 라운드, WhiteboardCanvas Preview UAT
> 등)도 같은 절에 명시.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **STATUS: DRAFT v2 — submitted for product-owner approval before any code work starts.** Built on
> the approved curriculum-content foundation (`docs/superpowers/plans/2026-09-07-curriculum-
> content-foundation.md`, APPROVED) and the confirmed policy decisions in
> `docs/superpowers/specs/2026-09-08-lesson-prep-session-selection-kickoff.md` §6. Do not start
> Task 1 until this plan itself is approved.
>
> **v2 revision (2026-09-08):** product-owner review found v1's Task 1–2 missing an immutable
> per-session content manifest — storing only unit/keyword selections and re-deriving candidates by
> dynamic keyword lookup at session-view time would let newly-published content silently join an
> already-pinned session, violating the session-content-snapshot invariant. Task 2 is rewritten
> around a `session_content_manifest` that `pinSessionSelection()` computes and freezes exactly once;
> Task 3's data source is corrected accordingly. Tasks 3–4's direction (used-in-lesson event,
> homework composition with two toggles) is unchanged from v1.
>
> **v3 revision (2026-09-08, same day):** product-owner review found two further gaps in v2. (1)
> Task 1 stored only unit/keyword selections — keywords narrow candidates, they are not themselves
> what gets pinned; a teacher must explicitly pick/exclude/order the actual material sections and
> problems during staging, and `pinSessionSelection()` must freeze exactly that staged content list
> (re-verified), never a keyword-derived query. Task 1 now adds a staged content-items table and
> teacher pick/exclude/reorder actions. (2) `session_content_manifest` must be impossible to write
> to directly under any role, staged or otherwise — only `pinSessionSelection()`'s own atomic,
> elevated-privilege DB function may INSERT into it, after validating the staged content list against
> unit/keyword scope and selectable status; ordinary teacher-role grants on the manifest table must
> not include INSERT/UPDATE/DELETE at all. Task 2 is revised accordingly, with new tests.
>
> **v4 revision (2026-09-08, same day):** since `pinSessionSelection()` is a `SECURITY DEFINER`
> function (it must be, to be the sole manifest writer despite ordinary roles having no table-level
> INSERT grant), it runs with the function owner's privileges regardless of caller — so it must do
> its OWN authorization/scope checks in the function body; RLS on other tables and app-layer
> `requireAssignedTeacherOrAdmin()`-style guards do not automatically apply inside it. Task 2 now
> specifies these checks as required function-body steps, a fixed `search_path`, restricted
> `EXECUTE` grants, and a full permission-matrix test.

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
- **A pinned session's content list is an immutable manifest, not a re-derivable keyword query.**
  `pinSessionSelection()` must freeze the exact list of material sections and problems that pass
  the selectable check at pin time into a session-scoped manifest table, recorded by content type +
  canonical id (+ version/display-position if applicable). After pin, this list never gains new rows
  because something new got published/tagged with the same keyword later — the session-view reads
  the manifest, not a live keyword join. The only thing allowed to change post-pin is *visibility*:
  a display-time safety gate re-joins each manifest row against the selectable view and hides (never
  deletes or mutates) any row that has since become unpublished/unconfirmed. This keeps two
  invariants distinct: the manifest's *membership* is frozen forever at pin time; the manifest's
  *current visibility* is re-checked every time it's read, as defense-in-depth, exactly like the
  homework-composition re-check in (b) above but for display rather than write.
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
| `supabase/migrations/20261232000000_r9_session_prepared_selection.sql` | Prepared-selection container + multi-unit/keyword-subset children **+ staged content-item picks** (the actual material sections/problems a teacher selected, excluded, and ordered — keywords are the filter used to find candidates, not the pinned payload), staging/attach/pin/detach state machine. (Pin here only means "ready to freeze" — the actual freeze is Task 2's manifest table.) |
| `supabase/migrations/20261233000000_r9_session_content_manifest.sql` | **New in v2.** Immutable per-session content manifest (content type, canonical id, display position, snapshot fields), populated exactly once by `pinSessionSelection()`, insert/update/delete blocked afterward by trigger. |
| `supabase/migrations/20261234000000_r9_session_content_use_events.sql` | Append-only "used in lesson" event table (material section + problem), RLS scoped to session participants (teacher/admin write+read; student excluded per decision 5). |
| `supabase/migrations/20261235000000_r9_homework_composition.sql` | Homework-composition write path with the two inclusion-toggle filters, gated by `problem_keywords_selectable` at write time. |
| `app/teacher/session-prep-data.ts` | Load: a subject_enrollment's held/staged prepared selections (the "임시보관함"), an upcoming session's currently-attached selection, keyword-filtered eligible content for pinning. |
| `app/teacher/session-prep-actions.ts` | Teacher-only: `createPreparedSelection`, `addUnitToSelection`, `removeUnitFromSelection`, `setSelectionActiveKeywords`, `pickContentItem`/`excludeContentItem`/`reorderContentItems` (staged content picks, v3), `attachSelectionToSession`, `detachSelectionFromSession` (→ back to holding area), `pinSessionSelection` (re-verify the staged content-item list → freeze manifest → mark selection pinned, one atomic DB function). |
| `app/teacher/SessionPrepPanel.tsx` | Teacher UI: holding-area list, attach-to-session picker, multi-unit/keyword composer, pin action with a clear "locked after this" warning. |
| `app/session/[id]/session-content-data.ts` | Session-view data loader: reads the session's frozen `session_content_manifest` rows (NOT a dynamic keyword query), joined against the selectable views purely as a display-time visibility gate — hides currently-unpublished/unconfirmed manifest rows without altering the manifest itself. |
| `app/session/[id]/session-content-use-actions.ts` | `markMaterialUsedInLesson`, `markProblemUsedInLesson` — the only writers of the use-event table; target ids must exist in the session's manifest. |
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
- `session_prepared_selection_unit_keywords(prepared_selection_unit_id, keyword_id)` — the active keyword subset chosen per unit within this selection, must be a subset of that unit's `curriculum_overlay_unit_keywords`. **This is a candidate-narrowing filter and composition context, not the pin payload** — see below.
- **`session_prepared_selection_content_items(id, prepared_selection_id, content_type enum('material_section','problem'), content_id, position, included boolean default true, added_at)` (new in v3)** — the actual material sections and problems a teacher has explicitly picked for this staged selection, after filtering candidates by the unit/keyword scope above. This is the real payload `pinSessionSelection()` freezes — keywords/units narrow what the teacher browses to choose from, but what gets pinned is exactly this explicit, ordered, teacher-curated list. `content_id` must resolve, at the time it's added, to something currently passing `curriculum_doc_section_keywords_selectable`/`problem_keywords_selectable` for one of the selection's unit/keyword scopes (checked by a trigger at INSERT time — a teacher cannot add unselectable or out-of-scope content to the staged list in the first place). `included=false` lets a teacher exclude a candidate without deleting the row (keeps it easy to re-include); `position` supports explicit reordering via one RPC (same atomic-multi-row-update pattern as `reorder_curriculum_overlay_units`).
- A unique partial index enforcing **at most one non-archived selection attached to a given `session_id`** (a session can have zero or one attached-and-not-yet-archived prepared selection at a time — mirrors the "one active overlay per enrollment" invariant already proven in the foundation round).
- **Pin invariant, modeled directly on `20261219000000_r8_material_version_lock.sql`**: once `status = 'pinned'`, no row in `session_prepared_selections`/`session_prepared_selection_units`/`session_prepared_selection_unit_keywords`/`session_prepared_selection_content_items` for that selection may be mutated (trigger rejects any UPDATE/DELETE once pinned, same predicate shape as the existing `material_version_id` lock: blocked once the owning session's `final_status <> 'scheduled'` or `= 'completed'`). Detach (`session_id` → NULL) is only possible while `status = 'staged'`, never while `'pinned'`.

- [ ] Write integration tests proving: a teacher may create/edit a staged selection with multiple units and per-unit keyword subsets while it is unattached (in the holding area) or attached-but-unpinned; a teacher can pick a keyword-eligible content item into the staged list, exclude it (soft, `included=false`) without losing the row, re-include it, and reorder the staged list atomically; attempting to pick content that is NOT currently selectable, or not within any of the selection's unit/keyword scopes, is rejected at INSERT time; attaching sets `session_id`; detaching (only allowed pre-pin) clears `session_id` back to NULL without deleting the row (including its staged content items), and the row then reappears in the holding-area query with its content list intact; pinning sets `status='pinned'` and `pinned_at`, and any further mutation attempt (unit/keyword/content-item add/remove/reorder, detach) is rejected by the trigger; a teacher without `is_active_teacher_for_enrollment()` for this subject_enrollment cannot create/edit/attach/pin/pick-content; two concurrent attach attempts for the same session cannot both succeed (unique partial index enforces this, prove with a concurrency test).
- [ ] Run the new tests against a reset local database and confirm they fail before the migration exists.
- [ ] Add the migration with the tables, unique constraints, RLS (write: `is_active_teacher_for_enrollment()`; read: same, plus admin), the content-item selectable/scope-check trigger, and the pin-lock trigger reusing R8's exact predicate shape.
- [ ] Implement `createPreparedSelection`, `addUnitToSelection`, `removeUnitFromSelection`, `setSelectionActiveKeywords`, `pickContentItem`, `excludeContentItem`, `reorderContentItems`, `attachSelectionToSession`, `detachSelectionFromSession` in `session-prep-actions.ts`; implement `loadHeldSelections` (holding area list for a subject_enrollment), `loadSessionSelection` (currently-attached selection for a session, including its staged content items), `loadEligibleContentForSelection` (keyword-filtered candidates a teacher can pick from — reuses `loadEligibleLibrary`'s predicate, narrowed by the selection's active keyword subset) in `session-prep-data.ts`.
- [ ] Re-run tests, `supabase db reset --local`, `tsc --noEmit`; commit only this task's files.

## Task 2: Immutable session content manifest — pin-time freeze, not a live keyword query

**Files:**
- Create: `supabase/migrations/20261233000000_r9_session_content_manifest.sql`
- Modify: `app/teacher/session-prep-actions.ts` (add `pinSessionSelection`)
- Modify: `app/session/[id]/session-content-data.ts` (create if it doesn't exist yet — this is the manifest reader)
- Test: extend Task 1's integration test file + a new one for the display-time visibility gate

**Consumes:** Task 1's schema; `curriculum_doc_section_keywords_selectable`/
`problem_keywords_selectable` views (corrective 2, foundation round).

**Produces:**
- `session_content_manifest(id, session_id, content_type enum('material_section','problem'), content_id, source_overlay_unit_id, display_position, published_doc_version_at_pin nullable, created_at)` — one row per piece of content the teacher had explicitly staged (`session_prepared_selection_content_items` with `included=true`) AND that still passes the selectable check at the moment of pin. `content_id` is the canonical `curriculum_doc_sections.id` or `problems.id`. `published_doc_version_at_pin` (or whatever the actual versioning column on the content's parent doc is called — verify against `curriculum_doc_versions` before naming this) records what was current at pin time, for audit/display purposes; it is NOT used to re-fetch different content later. **The manifest is a 1:1 copy of the teacher's staged, included content-item list at pin time — never a keyword-derived or unit-derived query.** A candidate that matched the session's keyword scope but was never explicitly picked (or was excluded, `included=false`) into the staged list must NOT appear in the manifest even though it would have passed the selectable check.
- **No direct writes to `session_content_manifest` under any ordinary role, staged or otherwise.** The table's RLS/grants give teachers and admins SELECT only (read access for display) — no role-level INSERT/UPDATE/DELETE grant exists at all, not even while the owning selection is `staged`. The only way a row is ever created is by calling `pinSessionSelection()`, implemented as a single `SECURITY DEFINER` Postgres function (owned by a role with the necessary table privileges) that performs the validation-then-insert atomically inside itself — the function is the sole privileged writer, not a relaxed-then-locked-down table grant. This is a stronger guarantee than "insert-once via a staged/pinned status trigger" (v2's design) — it removes the ordinary-role write path entirely rather than gating it by status.
- `pinSessionSelection(sessionId)` (the `SECURITY DEFINER` function above) does, in one transaction:
  **(0) authorize the call itself** — since `SECURITY DEFINER` runs with the function owner's
  privileges regardless of caller, RLS and app-layer guards do NOT automatically protect this
  function; it must perform its own checks as its literal first steps: (0a) resolve `auth.uid()`
  and reject if null (no anonymous/service-role-only bypass); (0b) load the target
  `session_prepared_selections` row and reject unless `auth.uid()` matches its `teacher_id` **and**
  that same user is currently the active assigned teacher for its `subject_enrollment_id` (reuse
  `is_active_teacher_for_enrollment()`'s exact predicate — call it explicitly inside this function
  body, don't assume it applies automatically) — **or** the caller is an admin (reuse the existing
  `is_admin()` check as a separate allowed path, not a bypass of the teacher check); (0c) verify the
  passed `sessionId` is actually the `session_id` currently attached to this staged selection (reject
  if the selection is unattached or attached to a different session — prevents a caller from pinning
  selection A's staged content against unrelated session B); (0d) verify that session's
  `subject_enrollment_id` equals the selection's `subject_enrollment_id` (defense-in-depth against a
  data-integrity mismatch, even though normal attach/detach flows should never produce one). Any
  failure in (0a)–(0d) aborts with no manifest writes and no status change.
  (1) load the session's currently-staged, currently-attached selection's `session_prepared_selection_content_items` where `included = true`; (2) for each item, re-verify it is still within the selection's unit/keyword scope (defense-in-depth — this was already checked at pick-time in Task 1, but pick-time and pin-time can be far apart) AND still passes `curriculum_doc_section_keywords_selectable`/`problem_keywords_selectable`, aborting the whole call with a clear error naming the first item that fails either check if anything fails; (3) if every staged+included item passes, INSERT exactly that list (and nothing else — no candidate the teacher didn't pick, no matter how well it fits the keyword scope) into `session_content_manifest` with display positions taken from the staged item order; (4) only then flip `session_prepared_selections.status → 'pinned'` and set `pinned_at`. All steps are one transaction — there is no window where a manifest could be partially written and then rejected.
- **Function hardening (required, not optional style guidance)**: `pinSessionSelection` is declared with a fixed `SET search_path = public, pg_temp` (or the equivalent explicit-schema form already used elsewhere in this codebase's `SECURITY DEFINER` functions, if any precedent exists — check and follow it) to prevent search-path hijacking. `EXECUTE` on the function is granted only to `authenticated`; it is explicitly `REVOKE`d from `PUBLIC` (Postgres grants `EXECUTE` to `PUBLIC` by default on function creation — this must be undone in the same migration).
- `session-content-data.ts`'s session-view reader queries `session_content_manifest` for the session (never a keyword/tag join against canonical content, never the staged content-items table), then LEFT JOINs each row against `curriculum_doc_section_keywords_selectable`/`problem_keywords_selectable` purely to decide **current visibility** — a manifest row whose target no longer passes is filtered out of what's returned to the caller, but the manifest row itself is untouched. This same gated reader is used for both the teacher's and the student's view of session content (neither role ever sees a manifest row that has since become unpublished/unconfirmed).

- [ ] Write integration tests: (a) pinning freezes exactly the staged+included content-item list into the manifest, verified against the selectable check at that moment; (b) **after pin, publishing new content tagged with the same keywords the session used does NOT appear in that session's manifest** (prove explicitly: publish new matching content post-pin, re-read the manifest, assert it's absent); (c) **after pin, changing a canonical unit's keyword relationships does not change the manifest**; (d) **after pin, unpublishing/unconfirming a manifest item hides it from the session-view read** without removing or mutating the manifest row itself (query the manifest table directly, confirm the row still exists with its original data); (e) direct DB-level attempts to INSERT/UPDATE/DELETE `session_content_manifest` rows are rejected for an ordinary teacher-role connection **regardless of the owning selection's status (staged or pinned)** — prove this specifically while the selection is still `staged`, not only after pinning, since v3's fix is "no role grant exists," not "grant exists but is locked post-pin"; (f) content staged+included but unpublished/unconfirmed before pin causes `pinSessionSelection` to fail with a clear identification of the offending item, and the manifest ends up with **zero rows** for that session (no partial freeze, no rows from other still-valid items either); (g) pinning is blocked once the session's `final_status` has already moved off `scheduled`; **(h, new in v3) a candidate that matches the session's keyword scope and would pass the selectable check, but was never picked into the staged content-item list (or was explicitly excluded, `included=false`), is absent from the manifest after pin** — prove this is a real exclusion, not an oversight, by seeding such a candidate alongside genuinely-picked items and asserting it specifically is missing; **(i, new in v3) `pinSessionSelection()` cannot be tricked into writing a manifest row for content outside the staged+included list** — attempt to call the function against a selection, then separately verify no row exists in the manifest referencing content that was in the selection's keyword/unit scope but not in `session_prepared_selection_content_items`; **(j, new in v4) permission matrix** — call `pinSessionSelection(sessionId)` as: the selection's own assigned teacher (succeeds, manifest populated); admin (succeeds via the separate admin-allowed path); a *different* teacher who is also assigned to the same student/subject_enrollment at a different time or for a different subject (fails, manifest stays at 0 rows for this session); a teacher with no assignment relationship to this student at all (fails, 0 rows); a student (fails, 0 rows); the correct teacher but passing a `sessionId` that is not actually attached to their staged selection (fails — proves check 0c); a constructed scenario where a session's `subject_enrollment_id` has been made to mismatch its attached selection's (fails — proves check 0d, may require direct test-fixture manipulation to construct since normal flows shouldn't produce this state); **(k, new in v4)** confirm via `information_schema`/`pg_proc` (or equivalent introspection) that `EXECUTE` on the function is granted to `authenticated` and NOT to `PUBLIC`, and that the function's `search_path` is fixed (not inherited from the caller's session).
- [ ] Implement the migration (including the `SECURITY DEFINER` function with its authorization steps (0a)–(0d), fixed `search_path`, `PUBLIC` execute revoked/`authenticated` execute granted, and the RLS/grant setup that gives ordinary roles SELECT-only on the manifest table) + `session-content-data.ts`'s manifest reader, run tests, `supabase db reset --local`, `tsc --noEmit`; commit separately from Task 1.

## Task 3: "Used in lesson" event — teacher-only, session-scoped, append-only

**Files:**
- Create: `supabase/migrations/20261234000000_r9_session_content_use_events.sql`
- Create: `app/session/[id]/session-content-use-actions.ts`
- Modify: session-view material/problem tab components (verify actual current file names first — do not assume, check `app/session/[id]/` directly) to add an explicit "사용 처리" button
- Test: matching `*.test.ts`/`*.integration.test.ts`

**Consumes:** `sessions`, `session_content_manifest` (Task 2 — a use-event's `target_id` must
reference a row that exists in this session's manifest; marking something not in the manifest as
used is rejected), session-participant authorization (whatever check already gates
`session_annotation_events` writes — reuse it, don't invent a new authorization primitive).

**Produces:**
- `session_content_use_events(id, session_id, target_type enum('material_section','problem'), target_id, recorded_by, recorded_at)` — append-only (no update/delete trigger, same shape as `session_annotation_events`), one row per explicit teacher action (never a range/duration).
- RLS: write = teacher/admin who are session participants; read = teacher/admin only (decision 5 — student excluded in this round, revisit as a later, separate extension).
- `markMaterialUsedInLesson(sessionId, sectionId)` / `markProblemUsedInLesson(sessionId, problemId)` — the only writers.

- [ ] Write integration tests: a teacher marking a material/problem as used creates exactly one event with the correct `target_type`/`target_id`/`recorded_by`; no update/delete is possible on an existing event (trigger rejects); a student cannot write or read this table; opening the material/problem tab alone (no explicit mark action) creates zero events (regression-proves "viewing ≠ used").
- [ ] Add the migration + actions, wire the explicit UI button into the session-view tabs, run tests, `supabase db reset --local`, `tsc --noEmit`, `next build`; commit separately.

## Task 4: Homework composition — two independent inclusion toggles, issue-time re-verification

**Files:**
- Create: `supabase/migrations/20261235000000_r9_homework_composition.sql`
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

Before this plan is considered complete, demonstrate with database integration tests that:
(0) `pinSessionSelection()`'s own internal authorization (caller is the selection's assigned
teacher or an admin, the passed session is actually attached to that selection, the session's and
selection's `subject_enrollment_id` match) cannot be bypassed by any caller — proven by the full
permission matrix (assigned teacher, admin, other teacher, unrelated teacher, student, mismatched
session, mismatched enrollment), and the function's `EXECUTE` grant/`search_path` are confirmed
locked down as specified; (1) a session's `session_content_manifest` is an exact copy of the teacher's explicitly staged and
included content-item list at pin time — never a keyword- or unit-derived query, and a
keyword-matching candidate the teacher didn't pick (or excluded) never appears in it; membership is
permanently frozen after pin — publishing new matching content afterward does not add to it, editing
canonical keyword relations afterward does not change it, and no ordinary-role DB connection can
insert/update/delete a manifest row under any status (staged or pinned) since manifest writes exist
only inside `pinSessionSelection()`'s own `SECURITY DEFINER` function, not as a relaxed-then-locked
table grant; (2) content that becomes
unpublished/unconfirmed between "added to selection" and "pin time" blocks the pin with a clear
error naming the offending item, and no manifest row or partial freeze is left behind; (3) a
manifest row whose target becomes unpublished/unconfirmed AFTER pin is hidden from the session-view
read (both teacher and student) by the display-time gate, while the manifest row itself remains
unchanged in the table; (4) content that becomes unpublished/unconfirmed between "tagged" and
"homework issue time" is silently excluded from the homework candidate pool (the second, separate
re-verification point, distinct from (2)/(3)'s pin-time and display-time checks); (5) an explicit
"used in lesson" mark is the only way a `session_content_use_events` row is created — no
passive-viewing code path ever writes one, and marking something not present in the session's
manifest is rejected; (6) a student cannot read another student's prepared selection, held/staged
selections, manifest, use events, or homework composition (RLS parity with the foundation round's
acceptance-gate claim 3); (7) `vocab_words` remains completely untouched by every table/action in
this plan.

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
