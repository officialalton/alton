import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// 2026-10-07 POLICY: customer-facing site is English. These DB functions can raise errors that reach students/parents/guardians
// (booking, scheduling links, consent, onboarding, mock exams, homework, strokes, profile). Their RAISE messages must stay English
// (migration 20262100000250). Admin/teacher/staff-only functions are intentionally not listed.
const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const CUSTOMER_FACING_FUNCTIONS = [
  "create_weekly_lesson_series",
  "cancel_lesson_booking",
  "hold_entitlement",
  "consume_entitlement",
  "release_entitlement",
  "request_reservation_reschedule",
  "respond_to_reservation_reschedule",
  "reservations_student_overlap_guard",
  "consultations_no_meeting_overlap",
  "meeting_requests_enforce_consultant",
  "cancel_meeting_request_core",
  "redeem_consultation_scheduling_link",
  "list_consultant_open_slots",
  "list_open_consultant_meeting_slots",
  "confirm_consult_consent_by_token",
  "submit_homepage_consult_request",
  "consent_as_guardian",
  "revoke_guardian_consent",
  "protect_guardian_consent",
  "protect_date_of_birth",
  "set_student_date_of_birth",
  "assert_guardian_consent_ok",
  "record_trial_smart_notes_consent",
  "confirm_regular_progress_intent",
  "update_household_default_timezone",
  "request_child_deletion",
  "get_or_create_draft_contract_for_child",
  "complete_student_profile",
  "provision_free_member",
  "protect_student_member_type",
  "activate_subject_enrollment_if_ready",
  "finalize_account_invite",
  "redeem_trial_onboarding_link",
  "finalize_trial_onboarding_new_guardian",
  "finalize_trial_onboarding_existing_guardian",
  "finalize_trial_onboarding_students",
  "link_existing_guardian_to_trial_onboarding",
  "request_trial_login_email_change",
  "confirm_trial_login_email_change",
  "peek_trial_login_email_change",
  "mock_exam_save_answer",
  "mock_exam_toggle_flag",
  "mock_exam_toggle_guessed",
  "mock_exam_save_section_time",
  "mock_exam_submit",
  "mock_exam_submit_module",
  "mock_exam_start_mst",
  "mock_exam_record_entry",
  "mock_exam_toggle_saved_to_practice",
  "mock_exam_open_start",
  "mock_exam_open_catalog",
  "mock_exam_weakness_summary",
  "mock_exam_attempt_summaries",
  "_mock_exam_attempt_detail_v1",
  "_mock_exam_mst_state_v2",
  "_mock_exam_attempts_route_guard",
  "_mock_exam_attempts_assign_gate",
  "mock_exam_attempts_fill_set_group",
  "save_mock_exam_annotations",
  "load_mock_exam_annotations",
  "save_problem_note_strokes",
  "load_problem_note_strokes",
  "homework_submit_answer",
  "homework_batches_for_viewer",
  "check_homework_attempt_assigned_to_student",
  "prevent_homework_attempt_update_after_submit",
  "freeze_problem_attempt_on_submit",
  "submit_problem_attempt",
  "start_problem_work",
  "toggle_problem_work_saved_to_practice",
  "toggle_homework_item_saved_to_practice",
  "append_stroke_events",
  "append_scoped_stroke_events",
  "append_page_stroke_events",
  "append_problem_page_stroke_events",
  "save_material_reading_position",
  "create_named_vocab_folder",
  "ensure_default_vocab_folder",
  "roadmap_save_grades",
  "problem_error_report_submit",
];

describe("customer-facing DB functions raise English messages only", () => {
  it("no Hangul inside RAISE statements (comments ignored)", () => {
    const names = CUSTOMER_FACING_FUNCTIONS.map((n) => `'${n}'`).join(",");
    const sql = `select p.proname || E'\\t' || replace(pg_get_functiondef(p.oid), E'\\n', E'\\x01')
      from pg_proc p join pg_namespace s on s.oid = p.pronamespace
      where s.nspname = 'public' and p.proname in (${names})`;
    const out = execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
    const rows = out.split("\n").filter(Boolean);
    expect(rows.length).toBeGreaterThanOrEqual(CUSTOMER_FACING_FUNCTIONS.length);
    const offenders: string[] = [];
    for (const row of rows) {
      const [name, flat] = row.split("\t");
      const def = flat.split("\x01").map((l) => l.replace(/--.*$/, "")).join("\n");
      for (const m of def.matchAll(/\braise\b[^;]*;/gi)) {
        if (/[가-힣]/.test(m[0])) offenders.push(`${name}: ${m[0].replace(/\s+/g, " ").slice(0, 100)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
