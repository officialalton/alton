# Curriculum Content Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reviewed content, curriculum, and student pacing foundation that lets later lesson preparation, session problem selection, and homework composition use the same source of truth.

**Architecture:** Retain `curriculum_docs`, `curriculum_doc_sections`, `problems`, `subject_template_units`, `curriculum_doc_versions`, and `session_problem_attempts` as the existing content and history foundations. Add a controlled subject keyword catalog and explicit relations from units, document sections, and problems to keywords. Add a student-specific curriculum overlay instead of cloning content; a later plan will attach prepared content to v3 sessions and build homework composition.

**Tech Stack:** Next.js App Router, TypeScript, Supabase Postgres/RLS/RPC, Vitest, existing admin curriculum editor.

## Global Constraints

- Work only inside `ALTON`; do not modify the parent Claude repository.
- Admin is the only role that creates, edits, reviews, or publishes canonical content.
- AI generation stays in the admin content editor and produces drafts only; no session-time AI problem generation or unreviewed student exposure.
- Teachers may compose a student-specific curriculum only from published canonical content.
- Student vocabulary remains the existing personal `vocab_words` flow; do not add automatic keyword-to-vocabulary creation.
- Never change material assignments for a started or completed v3 session.
- No external calls, deployment, push, main merge, or production changes.

---

## File map

| File | Responsibility |
| --- | --- |
| `supabase/migrations/20261228000000_r9_curriculum_content_foundation.sql` | Keyword catalog and canonical-content relations, RLS and invariant functions. |
| `supabase/migrations/20261229000000_r9_student_curriculum_overlay.sql` | Student operating-curriculum overlay, teacher authorization, ordering, and status transitions. |
| `app/admin/curriculum-doc-data.ts` | Load documents, sections, problems, keywords, and review status for the admin editor. |
| `app/admin/curriculum-doc-actions.ts` | Admin-only keyword assignment and draft/review/publish actions. |
| `app/admin/subject-data.ts`, `app/admin/subject-actions.ts` | Unit keyword and recommended published-content composition. |
| `app/teacher/student-curriculum-data.ts` | Read the assigned student's effective curriculum and eligible published catalog. |
| `app/teacher/student-curriculum-actions.ts` | Teacher-only overlay operations: add, exclude, reorder, set status, compose supplement unit. |
| `app/teacher/StudentCurriculumPanel.tsx` | Teacher UI for the student operating curriculum. |
| `app/session/[id]/AigenTab.tsx` | Remove session-time problem generation entry point after its replacement is available. |
| `app/session/[id]/SessionShell.tsx` | Remove the `문제 생성` tab; preserve `교재`, `과제`, `단어장`, and whiteboard behavior. |

## Task 1: Canonical keyword and content-review schema

**Files:**
- Create: `supabase/migrations/20261228000000_r9_curriculum_content_foundation.sql`
- Test: `app/admin/curriculum-content-foundation.integration.test.ts`

**Consumes:** Existing `subjects`, `subject_template_units`, `curriculum_docs`, `curriculum_doc_sections`, `problems`, `profiles`.

**Produces:**
- `subject_keywords(id, subject_id, label, normalized_label, status, created_by, unique(subject_id, normalized_label))`
- relation tables for unit↔keyword, section↔keyword, problem↔keyword
- canonical review state where only published documents and confirmed problems are selectable for teaching.

- [ ] Write integration tests proving: duplicate normalized keywords in one subject fail; another subject may use the same label; unpublished docs and non-confirmed problems cannot enter a selectable relation; admin can manage the catalog; teacher/student writes are denied by RLS.
- [ ] Run the new integration test against a reset local database and confirm its failure before the migration exists.
- [ ] Add the migration with foreign keys, unique constraints, indexes for `(subject_id, normalized_label)` and relation lookups, explicit RLS policies, and comments describing canonical ownership.
- [ ] Ensure all admin mutations use authenticated admin identity, not a client-provided owner id.
- [ ] Re-run the test and `supabase db reset --local`; commit only migration and test.

## Task 2: Admin content editor and basic curriculum composition

**Files:**
- Modify: `app/admin/curriculum-doc-data.ts`
- Modify: `app/admin/curriculum-doc-actions.ts`
- Modify: `app/admin/subject-data.ts`
- Modify: `app/admin/subject-actions.ts`
- Modify: `app/admin/CurriculumDocEditor.tsx`
- Test: matching `*.test.ts` files beside those modules

**Consumes:** Task 1 keyword/relation schema; existing draft/confirmed document and problem flow.

**Produces:** Admin-only UI and server actions to create controlled keywords, tag a unit/section/problem, connect published document sections and confirmed problems to units, and retain AI-generated items as drafts until an admin confirms them.

- [ ] Write failing UI/action tests for keyword assignment, duplicate prevention presentation, and the rule that draft content cannot be added to a unit's teaching set.
- [ ] Add keyword data to `DocEditorData` and load relation data in batched queries, avoiding section-by-section or problem-by-problem queries.
- [ ] Add admin server actions that validate subject ownership before inserting relations and reject cross-subject tagging.
- [ ] Update the editor so AI-generated problems remain draft until an explicit admin confirm action; do not expose the existing generator from a teacher session.
- [ ] Run focused tests, typecheck, and build; commit the admin slice separately.

## Task 3: Student operating-curriculum overlay

**Files:**
- Create: `supabase/migrations/20261229000000_r9_student_curriculum_overlay.sql`
- Create: `app/teacher/student-curriculum-data.ts`
- Create: `app/teacher/student-curriculum-actions.ts`
- Create: `app/teacher/StudentCurriculumPanel.tsx`
- Test: `app/teacher/student-curriculum-data.test.ts`, `app/teacher/student-curriculum-actions.test.ts`, and one database integration test for RLS/concurrency

**Consumes:** `subject_enrollments`, `teacher_assignments`, canonical units/content from Tasks 1–2.

**Produces:** An overlay with a stable ordered list of unit instances, source unit nullable for teacher-composed supplement units, effective status `not_started | in_progress | completed | reinforcement_needed | skipped`, and selected canonical keyword/content references.

- [ ] Write integration tests for: a teacher may alter only an assigned student's curriculum; source content remains unchanged; two teachers cannot alter the same student's overlay without authorization; reordering is atomic; a supplement unit accepts only published canonical content; completion state is set by teacher action rather than automatic attempts.
- [ ] Create the overlay tables with a unique active overlay per subject enrollment, stable positions, audit timestamps, and FKs that prevent deleted canonical content from silently changing historical selections.
- [ ] Implement actions `addCanonicalUnit`, `createSupplementUnit`, `excludeUnit`, `moveUnit`, `setUnitStatus`, and `setActiveKeywords`; every action checks the active teacher assignment and uses one transaction/RPC when position changes touch multiple rows.
- [ ] Build a small teacher panel that shows current unit, upcoming units, status controls, and an "add from library" path. It must not offer raw problem creation.
- [ ] Run focused tests, database reset, typecheck, and build; commit this independently reviewable slice.

## Task 4: Retire session-time problem creation safely

**Files:**
- Modify: `app/session/[id]/SessionShell.tsx`
- Modify or delete: `app/session/[id]/AigenTab.tsx`, `app/session/[id]/aigen-actions.ts`, `app/session/[id]/aigen-data.ts`
- Modify: affected session tests

**Consumes:** Tasks 1–3 establish the replacement canonical content path, though session filtering itself belongs to the next plan.

**Produces:** No teacher-facing session tab can generate and finalize a new problem into homework. Existing personal vocabulary, homework viewing, problem history, and annotation behavior remain intact.

- [ ] Write regression tests that assert the teacher session navigation no longer shows `문제 생성`, while `교재`, `과제`, `단어장`, and `연습장` retain role behavior.
- [ ] Remove only the session-time generation route and its reachable actions. Preserve administrator-only AI drafting in `app/admin/curriculum-doc-actions.ts`.
- [ ] Search for reachable imports of the removed session generator and either remove them or document a non-reachable compatibility shim; do not leave a hidden teacher action that can create a student-facing draft.
- [ ] Run affected session tests, full typecheck, build, and complete a teacher/student preview smoke test after deployment is explicitly authorized; commit this separately.

## Separate follow-on plan: Lesson preparation, session selection, and homework composition

Start only after Tasks 1–4 are accepted. It will add the prepared active-keyword selection for an upcoming v3 session, pin selected content at session start, present keyword-filtered material/problem tabs, record teacher "used in lesson" events separately from viewing, and compose a homework exam from confirmed canonical problems with the two inclusion toggles. It must reuse `session_problem_attempts` for student answer history and add a dedicated teacher-use record rather than treating a page view as a solved problem.

## Acceptance gate

Before the follow-on plan begins, demonstrate with database integration tests that: unpublished or unconfirmed content never reaches teacher selection; a teacher can add a published canonical unit or compose a supplement unit without changing any canonical row; students cannot see teacher preparation data; and the existing personal vocabulary table is untouched by keyword operations.
