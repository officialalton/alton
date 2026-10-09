# Korean RAISE messages in DB functions: customer reach audit (2026-10-07)

Scope: 290 public functions/trigger functions that still raised Korean messages after migration 20262100000250 (80 customer functions already translated).
Method: (1) `pg_get_functiondef` on local DB 54422 (read-only) for RAISE statements containing Hangul (comments ignored); (2) grants (`has_function_privilege`) and `rpc("name")` grep over app/ lib/ components/; (3) call graph: customer-listed functions (guard test list) calling remaining functions; (4) trigger tables vs RLS write policies and customer RPC write sets (regex insert/update/delete over customer function bodies).

## Findings

- Directly callable by student/guardian/anonymous from UI: none of the staff RPCs. All student/parent surfaces call only the already-translated 80 functions, except `assign_library_words_to_student` (student self-call, Vocabulary save).
- Nearly all functions are executable by PUBLIC/authenticated (grants), but their bodies gate on admin/teacher/consultant and no customer UI calls them; Korean text is only visible to someone crafting raw RPC calls. Verdict staff-only (message not surfaced in customer UI).
- Indirect reach found for 17 functions (nested call from a customer RPC, trigger on a table customer RPCs/RLS write, or student action). These were translated in **20262100000260** (create or replace from latest local definition; logic, ERRCODE, signatures unchanged) and added to the DB guard test.
- How the app shows errors: customer server actions generally return `error.message` (or a fixed English string); several (vocab, booking) mask DB text with their own English message. Treat any message from a customer-reachable function as potentially visible.
- Tables with RLS but no write policy (entitlement_ledger, guardian_students, account_invites, makeup_*, payout_*, *_events, problem_error_reports, ...) cannot fire their guard triggers from a customer client (RLS blocks first), and customer RPCs only INSERT into append-only ones. Those INSERT-only/immutability guards are internal-guard, staff-only.
- Out of RAISE scope but customer-visible Korean found: in-app notification title `'정규수업이 예약되었습니다.'` inside schedule_reservation_notifications (now in 20262100000260 body, text unchanged). Follow-up recommended.

## Customer-reachable (translated in 20262100000260)

| function | kind | who / path | message surfaces when | verdict |
|---|---|---|---|---|
| enforce_and_snapshot_teacher_rate | trigger sessions BEFORE INSERT | guardian/student booking (confirm_lesson_booking, create_weekly_lesson_series insert sessions) | teacher without current rate history; booking action surfaces error message | customer-reachable |
| prevent_direct_final_status_update | trigger sessions | cancel_lesson_booking (guardian/student) updates sessions | guard on completed sessions | customer-reachable |
| check_annotation_problem_work_consistency | trigger session_annotation_events | student/teacher stroke RPCs append_*_stroke_events + RLS insert by student (author_id=auth.uid()) | board/session/student/problem mismatch | customer-reachable |
| protect_account_status | trigger students/parents/teachers | student/parent self UPDATE via RLS (id=auth.uid()); finalize_* / complete_student_profile RPCs update these rows | only when status changed outside transition_account_status | customer-reachable |
| protect_hire_date | trigger profiles | any user self UPDATE via RLS; finalize_*/complete_student_profile update profiles | only when hire_date changed | customer-reachable |
| enforce_subject_enrollment_activation_preconditions | trigger subject_enrollments | activate_subject_enrollment_if_ready (customer RPC) | base contract not active | customer-reachable |
| reject_archived_subject_reference | trigger subject_enrollments/enrollments/... | activate_subject_enrollment_if_ready and onboarding paths write subject_enrollments | archived subject | customer-reachable |
| consultations_require_assigned_consultant | trigger consultations | guest/guardian: submit_homepage_consult_request, redeem_consultation_scheduling_link, confirm_consult_consent_by_token, record_trial_smart_notes_consent | no consultant assigned | customer-reachable |
| consultations_block_inactive_consultant | trigger consultations | same customer RPCs as above (auto-assign/redeem) | deactivated consultant | customer-reachable |
| schedule_reservation_notifications | function | called by confirm_lesson_booking (guardian booking) | reservation not found (internal race) | customer-reachable |
| extend_entitlement | function | called inside cancel_lesson_booking (guardian/student cancel path) | grant missing / expiry not later (internal, practically unreachable) | customer-reachable |
| upsert_session_payout_item | function | called inside cancel_lesson_booking | session not found (internal) | customer-reachable |
| grant_trial_entitlement_for_consultation | function | called by record_trial_smart_notes_consent (guardian) | no student linked / product missing | customer-reachable |
| grant_trial_entitlement_for_student | function | called by finalize_trial_onboarding_students and record_trial_smart_notes_consent (guardian) | student not found / product missing | customer-reachable |
| convert_free_member_to_tutoring | function | called by finalize_trial_onboarding_students (guardian onboarding) | consult/student mismatch | customer-reachable |
| mock_exam_validate_mst_set | function | called by mock_exam_start_mst (student) | set not found | customer-reachable |
| assign_library_words_to_student | function | student self-call from app/student/vocab-library-actions.ts toggleLibraryWordInMyVocabAction (p_student_id = self) | only when p_student_id is not self/own student; app masks with its own English text | customer-reachable |

## Staff-only / internal (Korean kept)

Category key: ADM = admin UI/server action only; TCH = teacher surface; CON = consultant; PAY = payout/settlement; LEG = legal hold/retention; INT = internal guard (immutability/INSERT-only triggers on tables without customer write policy, cron, service-role only).

| function | kind | grants anon/auth/secdef | app callers | verdict |
|---|---|---|---|---|
| prevent_paid_item_mutation | trigger | f/f/f | - | staff-only (INT trigger on payout_items) |
| reopen_session | fn | f/t/t | app/admin/booking-actions.ts | staff-only (ADM) |
| reject_ledger_mutation | trigger | f/f/f | - | staff-only (INT trigger on entitlement_ledger) |
| reject_makeup_event_mutation | trigger | f/f/f | - | staff-only (INT trigger on makeup_events) |
| apply_makeup_time | fn | f/f/t | - | staff-only (no app caller; admin/internal body gate) |
| check_payout_batch_currency | trigger | f/f/f | - | staff-only (INT trigger on payout_items) |
| protect_teacher_rate_history | trigger | f/f/f | - | staff-only (INT trigger on teacher_rate_history) |
| enforce_teacher_active_requires_rate | trigger | f/f/t | - | staff-only (INT trigger on teachers) |
| enforce_teacher_assignment_requires_rate | trigger | f/f/t | - | staff-only (INT trigger on teacher_assignments) |
| check_section_keyword_published | trigger | f/f/f | - | staff-only (INT trigger on curriculum_doc_section_keywords) |
| reject_guardian_students_mutation | trigger | t/t/f | - | staff-only (INT trigger on guardian_students) |
| reject_direct_trial_session_completion | trigger | t/t/f | - | staff-only (INT trigger on trial_sessions) |
| protect_account_invite_status | trigger | f/f/t | - | staff-only (INT trigger on account_invites) |
| reject_account_status_event_mutation | trigger | f/f/f | - | staff-only (INT trigger on account_status_events) |
| check_problem_keyword_confirmed | trigger | f/f/f | - | staff-only (INT trigger on problem_keywords) |
| check_overlay_unit_keyword_same_subject | trigger | f/f/f | - | staff-only (INT trigger on curriculum_overlay_unit_keywords) |
| create_account_invite | fn | f/t/t | app/admin/users-actions.ts | staff-only (ADM) |
| _problem_error_reports_guard | trigger | t/t/f | - | staff-only (INT trigger on problem_error_reports) |
| problem_replacement_retry_open | fn | f/t/t | app/admin/problem-error-report-actions.ts | staff-only (ADM) |
| _problem_error_append_only | trigger | t/t/f | - | staff-only (INT trigger on mock_exam_answer_adjustments) |
| _mock_exam_answer_adjustments_guard | trigger | t/t/f | - | staff-only (INT trigger on mock_exam_answer_adjustments) |
| merge_accounts | fn | t/t/t | app/admin/merge-actions.ts | staff-only (ADM) |
| teacher_rate_history_with_merged | fn | t/t/t | app/admin/merge-actions.ts | staff-only (ADM) |
| pdf_tip_page_count | fn | f/f/t | - | staff-only (no app caller; admin/internal body gate) |
| pdf_tip_review_state | fn | f/t/t | app/session/[id]/pdf-tip-actions.ts | staff-only (service/system: app/session/[id]/pdf-tip-actions.ts) |
| mark_pdf_tip_version_reviewed | fn | f/t/t | app/session/[id]/pdf-tip-actions.ts | staff-only (service/system: app/session/[id]/pdf-tip-actions.ts) |
| problem_difficulty_changes_immutable | trigger | t/t/f | - | staff-only (INT trigger on problem_difficulty_changes) |
| problems_difficulty_guard | trigger | t/t/f | - | staff-only (INT trigger on problems) |
| record_workspace_created | fn | t/t/t | app/admin/workspace-actions.ts | staff-only (ADM) |
| mark_workspace_invite_sent | fn | f/t/t | app/admin/workspace-actions.ts | staff-only (ADM) |
| record_workspace_creation_failed | fn | t/t/t | app/admin/workspace-actions.ts | staff-only (ADM) |
| suspend_teacher_workspace | fn | t/t/t | app/admin/workspace-actions.ts | staff-only (ADM) |
| reactivate_teacher_workspace | fn | t/t/t | app/admin/workspace-actions.ts | staff-only (ADM) |
| record_reservation_restored_to_alton_time | fn | f/f/t | lib/booking/external-change-resolution.ts | staff-only (service/system: lib/booking/external-change-resolution.ts) |
| link_teacher_workspace_identity | fn | t/t/t | app/auth/admin-google-callback/route.ts | staff-only (service/system: app/auth/admin-google-callback/route.ts) |
| transition_account_status | fn | f/t/t | app/admin/subject-enrollment-actions.ts app/admin/workspace-actions.ts app/admin/users-actions.ts | staff-only (ADM) |
| begin_workspace_preflight_run | fn | f/t/t | app/api/admin/workspace-preflight/route.ts | staff-only (ADM) |
| record_manual_guardian_consent | fn | t/t/t | app/admin/consent-actions.ts | staff-only (ADM) |
| begin_teacher_workspace_provisioning | fn | t/t/t | app/admin/workspace-actions.ts | staff-only (ADM) |
| finish_workspace_preflight_run | fn | f/t/t | app/api/admin/workspace-preflight/route.ts | staff-only (ADM) |
| set_primary_guardian | fn | t/t/t | - | staff-only (no app caller; admin/internal body gate) |
| check_overlay_unit_material_published | trigger | f/f/f | - | staff-only (INT trigger on curriculum_overlay_unit_materials) |
| link_admin_google_identity | fn | t/t/t | app/auth/admin-google-link-callback/route.ts | staff-only (service/system: app/auth/admin-google-link-callback/route.ts) |
| transfer_entitlement | fn | f/f/t | app/admin/entitlement-actions.ts | staff-only (ADM) |
| adjust_entitlement | fn | f/f/t | - | staff-only (no app caller; admin/internal body gate) |
| change_teacher_assignment | fn | f/f/t | app/admin/subject-enrollment-actions.ts lib/enrollment/teacher-assignment-termination.ts | staff-only (ADM) |
| reschedule_reservation_to_google_time | fn | f/f/t | lib/booking/external-change-resolution.ts | staff-only (service/system: lib/booking/external-change-resolution.ts) |
| resolve_external_calendar_change | fn | f/f/t | app/admin/booking-actions.ts | staff-only (ADM) |
| record_reservation_recreated_after_deletion | fn | f/f/t | lib/booking/external-change-resolution.ts | staff-only (service/system: lib/booking/external-change-resolution.ts) |
| reject_consultation_status_event_mutation | trigger | f/f/f | - | staff-only (INT trigger on consultation_status_events) |
| admin_reschedule_consultation | fn | t/t/t | app/admin/consultation-scheduling-actions.ts | staff-only (ADM) |
| admin_accept_consultation | fn | t/t/t | app/admin/consultation-scheduling-actions.ts | staff-only (ADM) |
| admin_cancel_consultation | fn | t/t/t | app/admin/consultation-scheduling-actions.ts | staff-only (ADM) |
| confirm_trial_intent | fn | f/f/t | app/admin/trial-onboarding-actions.ts | staff-only (ADM) |
| admin_retry_trial_entitlement_grant | fn | t/t/t | app/admin/consultation-scheduling-actions.ts | staff-only (ADM) |
| refund_entitlement | fn | f/f/t | app/admin/entitlement-actions.ts | staff-only (ADM) |
| reject_termination_reservation_action_mutation | trigger | f/f/f | - | staff-only (INT trigger on teacher_assignment_termination_reservation_actions) |
| admin_edit_trial_lesson_review | fn | f/f/t | - | staff-only (no app caller; admin/internal body gate) |
| list_subject_teaching_history_for_current_teacher | fn | f/t/t | app/admin/teacher-assignment-termination-actions.ts app/teacher/teacher-assignment-termination-actions.ts | staff-only (TCH/ADM) |
| assert_teacher_assignment_ready_for_closure | fn | f/t/t | lib/enrollment/teacher-assignment-termination.ts | staff-only (service/system: lib/enrollment/teacher-assignment-termination.ts) |
| create_trial_onboarding_link | fn | f/f/t | app/admin/trial-onboarding-actions.ts | staff-only (ADM) |
| reject_contract_company_approvals_mutation | trigger | t/t/f | - | staff-only (INT trigger on contract_company_approvals) |
| admin_upsert_review_category | fn | f/t/t | - | staff-only (no app caller; admin/internal body gate) |
| save_lesson_review_draft | fn | f/t/t | app/teacher/trial-review-actions.ts | staff-only (TCH/ADM) |
| finalize_lesson_review | fn | f/t/t | app/teacher/trial-review-actions.ts | staff-only (TCH/ADM) |
| admin_edit_lesson_review | fn | f/t/t | app/admin/lesson-review-actions.ts | staff-only (ADM) |
| admin_close_consultation | fn | f/t/t | app/admin/consultation-kanban-actions.ts lib/enrollment/auto-close-consultation.ts | staff-only (ADM) |
| mark_lesson_session_started | fn | f/f/t | app/teacher/lesson-schedule-actions.ts | staff-only (TCH/ADM) |
| finalize_session_as_infra_incident | fn | f/f/t | app/admin/booking-actions.ts | staff-only (ADM) |
| reject_session_late_extension_mutation | trigger | f/f/f | - | staff-only (INT trigger on session_late_extensions) |
| reject_makeup_obligation_expiry_extension | trigger | t/t/f | - | staff-only (INT trigger on makeup_obligations) |
| verify_student_date_of_birth | fn | t/t/t | app/admin/users-actions.ts | staff-only (ADM) |
| apply_makeup_time_to_booking | fn | f/f/t | app/admin/booking-actions.ts | staff-only (ADM) |
| reject_reconciliation_task_direct_mutation | trigger | f/f/f | - | staff-only (INT trigger on session_judgment_reconciliation_tasks) |
| reconciliation_task_update_guard | trigger | f/f/t | - | staff-only (INT trigger on session_judgment_reconciliation_tasks) |
| resolve_teacher_partial_interruption | fn | f/f/t | app/admin/booking-actions.ts | staff-only (ADM) |
| recomplete_session | fn | f/t/t | app/admin/booking-actions.ts | staff-only (ADM) |
| recompose_unit | fn | t/t/f | - | staff-only (no app caller; admin/internal body gate) |
| refresh_staged_selection_from_unit_prep | fn | f/f/t | - | staff-only (no app caller; admin/internal body gate) |
| set_admin_tier | fn | t/t/t | app/admin/admin-accounts-actions.ts | staff-only (ADM) |
| set_profile_role_to_consultant | fn | t/t/t | app/admin/consultant-assignment-actions.ts | staff-only (ADM) |
| find_profile_id_by_email | fn | t/t/t | app/admin/merge-actions.ts app/admin/parent-detail-actions.ts app/admin/consultant-assignment-actions.ts | staff-only (ADM) |
| release_legal_hold | fn | f/t/t | app/admin/retention-actions.ts | staff-only (ADM) |
| resolve_teacher_lateness | fn | f/f/t | app/teacher/lesson-schedule-actions.ts | staff-only (TCH/ADM) |
| finalize_lesson_session | fn | f/f/t | app/admin/booking-actions.ts app/teacher/lesson-schedule-actions.ts | staff-only (TCH/ADM) |
| check_prepared_unit_keyword_subset | trigger | f/f/f | - | staff-only (INT trigger on session_prepared_selection_unit_keywords) |
| check_prepared_content_item_selectable | trigger | f/f/f | - | staff-only (INT trigger on session_prepared_selection_content_items) |
| mark_payout_batch_provider_pending | fn | f/f/f | - | staff-only (PAY) |
| mark_payout_batch_paid | fn | f/f/f | - | staff-only (PAY) |
| prevent_content_use_event_mutation | trigger | f/f/f | - | staff-only (INT trigger on session_content_use_events) |
| check_homework_item_problem_confirmed | trigger | t/t/t | - | staff-only (INT trigger on session_homework_items) |
| check_prepared_selection_not_pinned_self | trigger | f/f/f | - | staff-only (INT trigger on session_prepared_selections) |
| check_prepared_selection_not_pinned | fn | f/t/f | - | staff-only (no app caller; admin/internal body gate) |
| compose_homework_from_session | fn | f/t/t | app/teacher/homework-composition-actions.ts | staff-only (TCH/ADM) |
| retry_direct_onboarding_student_entitlement | fn | f/t/t | - | staff-only (no app caller; admin/internal body gate) |
| cancel_trial_onboarding_link_student | fn | f/f/t | app/admin/direct-account-actions.ts app/admin/trial-onboarding-actions.ts | staff-only (ADM) |
| guard_payout_item_paid_transition | trigger | f/f/f | - | staff-only (INT trigger on payout_items) |
| apply_unit_composition_update | fn | t/t/f | app/lesson-prep/actions.ts | staff-only (service/system: app/lesson-prep/actions.ts) |
| submit_payout_batch_for_review | fn | f/f/f | app/admin/payout-batches-actions.ts | staff-only (ADM) |
| mark_payout_batch_processing | fn | f/f/f | - | staff-only (PAY) |
| mark_payout_batch_failed | fn | f/f/f | app/admin/payout-batches-actions.ts | staff-only (ADM) |
| cancel_teacher_assignment_request | fn | f/t/t | app/consultant/teacher-assignment-request-actions.ts app/admin/teacher-assignment-requests-actions.ts | staff-only (CON/ADM) |
| prevent_annotation_event_mutation | trigger | f/f/f | - | staff-only (INT trigger on session_annotation_events) |
| reject_account_closure_access_event_mutation | trigger | f/f/f | - | staff-only (INT trigger on account_closure_access_events) |
| record_closed_account_access | fn | f/t/t | app/admin/users-actions.ts | staff-only (ADM) |
| dispatch_payout_batch | fn | f/f/f | app/admin/payout-batches-actions.ts lib/payout/auto-dispatch.ts | staff-only (ADM) |
| mark_payout_batch_provider_confirmed | fn | f/f/f | - | staff-only (PAY) |
| guard_payout_batch_paid_transition | trigger | f/f/f | - | staff-only (INT trigger on payout_batches) |
| close_teacher_admin_inquiry | fn | t/t/t | app/admin/teacher-staff-messenger-actions.ts | staff-only (ADM) |
| finalize_meeting_request_review | fn | f/t/t | app/consultant/meeting-request-review-actions.ts app/admin/meeting-request-review-actions.ts | staff-only (CON/ADM) |
| subject_keywords_normalize | trigger | f/f/f | - | staff-only (INT trigger on subject_keywords) |
| check_unit_keyword_same_subject | trigger | f/f/f | - | staff-only (INT trigger on subject_template_unit_keywords) |
| reorder_curriculum_overlay_units | fn | f/t/f | app/teacher/student-curriculum-actions.ts | staff-only (TCH/ADM) |
| check_prepared_selection_attach_session | trigger | f/f/f | - | staff-only (INT trigger on session_prepared_selections) |
| ensure_active_curriculum_overlay | fn | f/t/f | app/teacher/student-curriculum-actions.ts | staff-only (TCH/ADM) |
| reorder_prepared_selection_content_items | fn | f/t/f | app/teacher/session-prep-actions.ts | staff-only (TCH/ADM) |
| pin_session_selection | fn | f/t/t | - | staff-only (no app caller; admin/internal body gate) |
| set_contract_auto_dispatch_enabled | fn | f/t/t | app/admin/contract-dispatch-actions.ts | staff-only (ADM) |
| close_payout_period | fn | f/f/t | lib/payout/close-payout-month.ts | staff-only (PAY) |
| payout_lock_batch_for_date_change | fn | f/f/f | - | staff-only (PAY) |
| revoke_account_invite | fn | f/t/t | - | staff-only (no app caller; admin/internal body gate) |
| resolve_manual_review_invite | fn | f/t/t | - | staff-only (no app caller; admin/internal body gate) |
| resolve_session_reconciliation_task | fn | f/t/t | app/admin/booking-actions.ts | staff-only (ADM) |
| set_reconciliation_task_student_cancelled_disposition | fn | f/t/t | app/admin/booking-actions.ts | staff-only (ADM) |
| prevent_material_version_reassignment | trigger | f/f/t | - | staff-only (INT trigger on sessions) |
| reverse_payout_item | fn | f/f/f | - | staff-only (PAY) |
| repin_live_session_content | fn | f/f/t | app/teacher/lesson-schedule-actions.ts | staff-only (TCH/ADM) |
| mark_problem_figure_checked | fn | f/f/t | app/admin/problem-bank-actions.ts | staff-only (ADM) |
| attempt_delete_or_archive_subject | fn | t/t/t | app/admin/subject-actions.ts | staff-only (ADM) |
| assign_vocab_quiz | fn | f/t/t | app/student/vocab-library-actions.ts | staff-only (service/system: app/student/vocab-library-actions.ts) |
| retry_trial_onboarding_student | fn | f/f/t | app/admin/student-invite-actions.ts app/admin/trial-onboarding-actions.ts | staff-only (ADM) |
| reject_household_archive_event_mutation | trigger | f/f/f | - | staff-only (INT trigger on household_archive_events) |
| reject_teacher_payout_account_event_mutation | trigger | f/f/f | - | staff-only (INT trigger on teacher_payout_account_events) |
| reject_payout_batch_adjustment_mutation | trigger | f/f/f | - | staff-only (INT trigger on payout_batch_adjustments) |
| set_payout_batch_auto_dispatch | fn | f/f/t | app/admin/payout-batches-actions.ts | staff-only (ADM) |
| add_payout_batch_adjustment | fn | f/f/t | app/admin/payout-batches-actions.ts | staff-only (ADM) |
| delete_payout_batch | fn | f/f/t | app/admin/payout-batches-actions.ts | staff-only (ADM) |
| reject_payout_scheduled_date_event_mutation | trigger | f/f/f | - | staff-only (INT trigger on payout_scheduled_date_events) |
| reject_payout_external_transfer_mutation | trigger | f/f/f | - | staff-only (INT trigger on payout_external_transfers) |
| record_external_payout_transfer | fn | f/f/t | app/admin/payout-batches-actions.ts | staff-only (ADM) |
| ensure_payout_batch_scheduled_date | fn | f/f/t | app/admin/payout-batches-actions.ts | staff-only (ADM) |
| submit_problem_version_for_review | fn | f/f/t | app/admin/problem-bank-actions.ts | staff-only (ADM) |
| publish_problem_version | fn | f/f/t | app/admin/problem-bank-actions.ts | staff-only (ADM) |
| publish_teacher_draft_to_session | fn | f/f/t | - | staff-only (no app caller; admin/internal body gate) |
| reject_document_access_event_mutation | trigger | f/f/f | - | staff-only (INT trigger on document_access_events) |
| check_doc_primary_keyword_same_subject | trigger | t/t/f | - | staff-only (INT trigger on curriculum_docs) |
| check_teacher_unit_keyword_same_subject | trigger | t/t/f | - | staff-only (INT trigger on teacher_curriculum_template_unit_keywords) |
| check_unit_material_version_belongs | trigger | t/t/t | - | staff-only (INT trigger on curriculum_overlay_unit_materials) |
| check_unit_problem_version_belongs | trigger | t/t/t | - | staff-only (INT trigger on subject_template_unit_problems) |
| check_unit_material_usable | trigger | t/t/f | - | staff-only (INT trigger on subject_template_unit_materials) |
| check_prep_item_usable | trigger | t/t/f | - | staff-only (INT trigger on curriculum_unit_prep_items) |
| recompose_unit | fn | t/t/f | - | staff-only (no app caller; admin/internal body gate) |
| publish_curriculum_asset_doc | fn | f/t/f | app/admin/curriculum-asset-actions.ts | staff-only (ADM) |
| publish_curriculum_doc | fn | f/t/f | app/admin/curriculum-doc-actions.ts | staff-only (ADM) |
| grade_problem_attempt | fn | f/t/t | app/session/[id]/problem-work-actions.ts | staff-only (service/system: app/session/[id]/problem-work-actions.ts) |
| issue_homework_items | fn | f/t/t | - | staff-only (no app caller; admin/internal body gate) |
| withdraw_homework_item | fn | f/t/t | app/session/[id]/homework-v3-actions.ts | staff-only (service/system: app/session/[id]/homework-v3-actions.ts) |
| issue_homework_by_keywords | fn | f/t/t | - | staff-only (no app caller; admin/internal body gate) |
| set_problem_render_check | fn | f/f/t | app/admin/problem-bank-actions.ts | staff-only (ADM) |
| confirm_and_publish_problem_version | fn | f/f/t | app/admin/problem-bank-actions.ts | staff-only (ADM) |
| set_problem_quality | fn | f/f/t | app/admin/problem-bank-actions.ts | staff-only (ADM) |
| admin_edit_meeting_request_review | fn | f/t/t | app/consultant/meeting-request-review-actions.ts app/admin/meeting-request-review-actions.ts | staff-only (CON/ADM) |
| issue_homework_batch | fn | f/t/t | - | staff-only (no app caller; admin/internal body gate) |
| issue_homework_batch_v2 | fn | f/t/t | lib/homework-batch-actions.ts | staff-only (service/system: lib/homework-batch-actions.ts) |
| link_unit_prep_to_session | fn | f/f/t | app/teacher/unit-prep-actions.ts | staff-only (TCH/ADM) |
| apply_base_update_to_overlay_unit | fn | f/t/t | app/teacher/student-curriculum-actions.ts | staff-only (TCH/ADM) |
| reassign_problem_subject | fn | f/t/t | app/admin/problem-bank-actions.ts | staff-only (ADM) |
| create_problem_draft_version | fn | f/f/t | - | staff-only (no app caller; admin/internal body gate) |
| save_problem_draft_version | fn | f/f/t | app/admin/problem-bank-actions.ts | staff-only (ADM) |
| mock_exam_finalize_grading | fn | t/t/t | lib/mock-exam/attempt-actions.ts | staff-only (service/system: lib/mock-exam/attempt-actions.ts) |
| save_meeting_request_review_draft | fn | f/t/t | app/consultant/meeting-request-review-actions.ts app/admin/meeting-request-review-actions.ts | staff-only (CON/ADM) |
| teacher_edit_finalized_lesson_review | fn | f/t/t | app/teacher/trial-review-actions.ts | staff-only (TCH/ADM) |
| create_entitlement_grant_for_purchase | fn | f/f/t | lib/entitlements.ts | staff-only (service/system: lib/entitlements.ts) |
| mock_exam_set_content_for_staff | fn | f/t/t | lib/mock-exam/set-content.ts | staff-only (service/system: lib/mock-exam/set-content.ts) |
| close_household_inquiry | fn | t/t/t | app/admin/inquiry-and-meeting-actions.ts | staff-only (ADM) |
| update_homework_batch_due_at | fn | t/t/t | - | staff-only (no app caller; admin/internal body gate) |
| mark_consultation_contacted | fn | t/t/t | app/consultant/intake-actions.ts | staff-only (CON/ADM) |
| link_consultant_workspace_identity | fn | t/t/t | app/auth/admin-google-callback/route.ts | staff-only (service/system: app/auth/admin-google-callback/route.ts) |
| set_consultant_accepting_new_work | fn | t/t/t | app/consultant/availability-actions.ts | staff-only (CON/ADM) |
| set_consultant_auto_assign_enabled | fn | t/t/t | app/admin/consultant-assignment-actions.ts | staff-only (ADM) |
| admin_set_link_student_consultant | fn | f/f/t | app/admin/trial-onboarding-actions.ts | staff-only (ADM) |
| admin_set_student_consultant | fn | f/f/t | app/admin/consultant-assignment-actions.ts | staff-only (ADM) |
| create_direct_onboarding_link_multi | fn | f/f/t | app/admin/direct-account-actions.ts | staff-only (ADM) |
| request_teacher_assignment | fn | f/t/t | app/consultant/teacher-assignment-request-actions.ts | staff-only (CON/ADM) |
| respond_teacher_assignment_request | fn | f/t/t | app/teacher/teacher-assignment-request-actions.ts | staff-only (TCH/ADM) |
| reprocess_teacher_assignment_request | fn | f/t/t | app/consultant/teacher-assignment-request-actions.ts app/admin/teacher-assignment-requests-actions.ts | staff-only (CON/ADM) |
| confirm_student_teacher_subject_match | fn | f/t/t | app/admin/matching-common-actions.ts | staff-only (ADM) |
| reject_consultant_payout_account_event_mutation | trigger | f/f/f | - | staff-only (INT trigger on consultant_payout_account_events) |
| reject_consultant_payout_period_event_mutation | trigger | f/f/f | - | staff-only (INT trigger on consultant_payout_period_events) |
| close_consultant_admin_inquiry | fn | t/t/t | app/admin/staff-messenger-actions.ts | staff-only (ADM) |
| resend_account_invite | fn | f/t/t | - | staff-only (no app caller; admin/internal body gate) |
| mark_expired_invites | fn | f/t/t | app/api/cron/mark-expired-invites/route.ts | staff-only (service/system: app/api/cron/mark-expired-invites/route.ts) |
| close_expired_pending_accounts | fn | f/t/t | app/api/cron/close-pending-accounts/route.ts | staff-only (service/system: app/api/cron/close-pending-accounts/route.ts) |
| reject_retention_batch_runs_mutation | trigger | f/f/f | - | staff-only (INT trigger on retention_batch_runs) |
| assert_admin_or_service_role | fn | f/t/t | - | staff-only (no app caller; admin/internal body gate) |
| insert_additional_study_unit | fn | f/f/t | app/teacher/student-curriculum-actions.ts | staff-only (TCH/ADM) |
| preview_additional_study_unit_insert | fn | f/t/t | app/teacher/student-curriculum-actions.ts | staff-only (TCH/ADM) |
| _mock_exam_sets_publish_gate | trigger | t/t/t | - | staff-only (INT trigger on mock_exam_sets) |
| _mock_exam_set_items_snapshot | trigger | t/t/t | - | staff-only (INT trigger on mock_exam_set_items) |
| retag_problem_usage_scope | fn | f/f/t | app/admin/problem-bank-actions.ts | staff-only (ADM) |
| mock_exam_set_items_usage_scope | trigger | t/t/t | - | staff-only (INT trigger on mock_exam_set_items) |
| check_unit_problem_usable | trigger | t/t/f | - | staff-only (INT trigger on subject_template_unit_problems) |
| problem_usage_scope_changes_immutable | trigger | t/t/f | - | staff-only (INT trigger on problem_usage_scope_changes) |
| mock_exam_sets_guard_access_tier | trigger | t/t/t | - | staff-only (INT trigger on mock_exam_sets) |
| problems_usage_scope_guard | trigger | t/t/t | - | staff-only (INT trigger on problems) |
| create_bank_problem | fn | f/f/t | app/admin/problem-bank-actions.ts | staff-only (ADM) |
| admin_assign_meeting_consultant | fn | f/t/t | app/admin/inquiry-and-meeting-actions.ts | staff-only (ADM) |
| _mock_exam_routing_policy_immutable | trigger | t/t/f | - | staff-only (INT trigger on mock_exam_routing_policies) |
| create_trial_onboarding_link_multi | fn | f/f/t | app/admin/trial-onboarding-actions.ts | staff-only (ADM) |
| protect_signed_teacher_contract | trigger | t/t/f | - | staff-only (INT trigger on teacher_contracts) |
| admin_record_consultation_outcome | fn | f/t/t | app/admin/consultation-scheduling-actions.ts | staff-only (ADM) |
| admin_reject_consultation | fn | t/t/t | app/admin/consultation-scheduling-actions.ts | staff-only (ADM) |
| consultant_settings_guard_deactivation | trigger | t/t/f | - | staff-only (INT trigger on consultant_settings) |
| scheduling_links_block_inactive_consultant | trigger | t/t/f | - | staff-only (INT trigger on consultation_scheduling_links) |
| admin_onboarding_attention_queue | fn | f/t/t | app/admin/onboarding-attention-actions.ts | staff-only (ADM) |
| guard_legal_holds_mutation | trigger | f/f/f | - | staff-only (INT trigger on legal_holds) |
| admin_set_consultant_active | fn | f/t/t | app/admin/consultant-assignment-actions.ts | staff-only (ADM) |
| assign_consultation_owner | fn | t/t/t | app/admin/consultant-assignment-actions.ts | staff-only (ADM) |
| reject_trial_regrant_mutation | trigger | t/t/f | - | staff-only (INT trigger on trial_entitlement_regrants) |
| _problems_error_confirmed_archive_guard | trigger | t/t/t | - | staff-only (INT trigger on problems) |
| staff_student_view_log_immutable | trigger | t/t/f | - | staff-only (INT trigger on staff_student_view_log) |
| admin_regrant_trial_entitlement | fn | f/t/t | app/admin/onboarding-attention-actions.ts | staff-only (ADM) |
| problem_replacement_need_summary | fn | f/t/t | app/admin/problem-error-report-actions.ts | staff-only (ADM) |
| problem_error_apply_verdict | fn | f/t/t | app/admin/problem-error-report-actions.ts | staff-only (ADM) |
| problem_error_report_detail | fn | f/t/t | app/admin/problem-error-report-actions.ts | staff-only (ADM) |
| student_stats_aggregate | fn | f/f/t | app/student/stats-data.ts | staff-only (service/system: app/student/stats-data.ts) |
| problem_error_report_stats | fn | f/t/t | app/admin/problem-error-report-actions.ts | staff-only (ADM) |
| homework_regrade_item | fn | f/t/t | lib/homework-batch-actions.ts | staff-only (service/system: lib/homework-batch-actions.ts) |
| problem_error_report_groups | fn | f/t/t | app/admin/problem-error-report-actions.ts | staff-only (ADM) |
| append_pdf_tip_events | fn | f/t/t | app/session/[id]/pdf-tip-actions.ts | staff-only (service/system: app/session/[id]/pdf-tip-actions.ts) |
| copy_pdf_tips_mapped | fn | f/t/t | app/session/[id]/pdf-tip-actions.ts | staff-only (service/system: app/session/[id]/pdf-tip-actions.ts) |
| copy_pdf_tips_from_version | fn | f/t/t | app/session/[id]/pdf-tip-actions.ts | staff-only (service/system: app/session/[id]/pdf-tip-actions.ts) |
| copy_pdf_tip_page | fn | f/t/t | app/session/[id]/pdf-tip-actions.ts | staff-only (service/system: app/session/[id]/pdf-tip-actions.ts) |
| mark_pdf_tip_page_reviewed | fn | f/t/t | app/session/[id]/pdf-tip-actions.ts | staff-only (service/system: app/session/[id]/pdf-tip-actions.ts) |
| review_problem_difficulty | fn | f/f/t | app/admin/difficulty-review-actions.ts | staff-only (ADM) |
| problem_difficulty_review_list | fn | f/f/t | app/admin/difficulty-review-actions.ts | staff-only (ADM) |
| problem_option_reorders_immutable | trigger | t/t/f | - | staff-only (INT trigger on problem_option_reorders) |
| apply_problem_option_reorders | fn | f/f/t | - | staff-only (no app caller; admin/internal body gate) |
| revert_problem_option_reorder | fn | f/f/t | - | staff-only (no app caller; admin/internal body gate) |
| curriculum_docs_guard_access_tier | trigger | t/t/t | - | staff-only (INT trigger on curriculum_docs) |
| record_staff_student_view | fn | f/t/t | app/admin/free-accounts-actions.ts app/components/staff-student-view-actions.ts | staff-only (ADM) |
| set_payout_batch_scheduled_date | fn | f/f/t | app/admin/payout-batches-actions.ts | staff-only (ADM) |
| set_payout_batch_delayed_date | fn | f/f/t | app/admin/payout-batches-actions.ts | staff-only (ADM) |
| reject_legal_hold_events_mutation | trigger | f/f/f | - | staff-only (INT trigger on legal_hold_events) |
| anonymize_merged_account_core | fn | f/f/t | - | staff-only (no app caller; admin/internal body gate) |
| anonymize_merged_account | fn | t/t/t | app/admin/merge-actions.ts | staff-only (ADM) |
| place_legal_hold | fn | f/t/t | app/admin/retention-actions.ts | staff-only (ADM) |
| extend_legal_hold | fn | f/t/t | app/admin/retention-actions.ts | staff-only (ADM) |
| request_legal_hold | fn | f/t/t | app/admin/retention-actions.ts | staff-only (ADM) |
| decide_legal_hold_request | fn | f/t/t | app/admin/retention-actions.ts | staff-only (ADM) |
| approve_payout_batch | fn | f/f/f | app/admin/payout-batches-actions.ts | staff-only (ADM) |
| set_payout_batch_pay_immediately | fn | f/f/t | app/admin/payout-batches-actions.ts | staff-only (ADM) |
| payout_account_key | fn | f/f/t | - | staff-only (PAY) |
| save_teacher_payout_account | fn | f/f/t | app/admin/teacher-payout-accounts-actions.ts app/teacher/settlement-actions.ts | staff-only (TCH/ADM) |
| save_consultant_payout_account | fn | f/f/t | app/consultant/settlement-actions.ts app/admin/consultant-settlement-actions.ts | staff-only (CON/ADM) |
| reveal_teacher_payout_account | fn | f/f/t | app/admin/teacher-payout-accounts-actions.ts | staff-only (ADM) |
| review_child_deletion_request | fn | f/t/t | - | staff-only (LEG) |
| reveal_consultant_payout_account | fn | f/f/t | app/admin/consultant-settlement-actions.ts | staff-only (ADM) |
| set_teacher_rate | fn | f/f/t | app/admin/workspace-actions.ts app/admin/users-actions.ts lib/teacher-agreements/rate.ts | staff-only (ADM) |
| problem_versions_published_immutable | trigger | t/t/f | - | staff-only (INT trigger on problem_versions) |
| apply_teacher_rate_addendum | fn | f/f/t | lib/teacher-agreements/webhook.ts | staff-only (service/system: lib/teacher-agreements/webhook.ts) |
| reject_retention_deletion_events_mutation | trigger | f/f/f | - | staff-only (INT trigger on retention_deletion_events) |
| retention_retry_deletion_target | fn | f/t/t | app/admin/retention-actions.ts | staff-only (ADM) |
| record_child_deletion_exception | fn | f/t/t | - | staff-only (LEG) |
| reject_payout_attempt_event_mutation | trigger | f/f/f | - | staff-only (INT trigger on payout_attempt_events) |
| record_payout_attempt_request | fn | f/f/f | lib/payout/supabase-attempt-store.ts | staff-only (PAY) |
| link_payout_attempt_transaction | fn | f/f/f | app/admin/mercury-payout-actions.ts lib/payout/supabase-attempt-store.ts | staff-only (ADM) |
| record_payout_attempt_actuals | fn | f/f/f | app/admin/mercury-payout-actions.ts lib/payout/supabase-attempt-store.ts | staff-only (ADM) |
| set_payout_dual_control | fn | f/f/f | app/admin/mercury-payout-actions.ts | staff-only (ADM) |
| approve_payout_attempt | fn | f/f/f | app/admin/mercury-payout-actions.ts | staff-only (ADM) |
| payout_attempt_transition | fn | f/f/f | app/admin/mercury-payout-actions.ts lib/payout/supabase-attempt-store.ts | staff-only (ADM) |
| create_payout_attempt | fn | f/f/f | app/admin/mercury-payout-actions.ts | staff-only (ADM) |
| record_payout_attempt_return | fn | f/f/f | app/admin/mercury-payout-actions.ts lib/payout/supabase-attempt-store.ts | staff-only (ADM) |

Notes on borderline staff-only items:
- student_stats_aggregate: raised message only for non-service callers; authenticated has no EXECUTE, called by app/student/stats-data.ts with service role. Not reachable.
- create_entitlement_grant_for_purchase: service-role from Stripe webhook; message goes to webhook logs, not UI.
- assign_vocab_quiz: only teachers/admin (teaches_student); app masks with English text. Staff-only.
- reject_guardian_students_mutation, reject_ledger_mutation, protect_account_invite_status, prevent_material_version_reassignment, reject_direct_trial_session_completion, _problem_error_reports_guard: no customer path updates/deletes these rows (customer RPCs only INSERT or use internal guard flags); treated as internal guards.
- set_primary_guardian, record_manual_guardian_consent, verify_student_date_of_birth: PUBLIC execute but explicit admin-only body gate; no customer UI caller.

## Follow-up: customer-visible non-RAISE strings (migration 20262100000261)

Scanned all public functions for Hangul string literals outside RAISE. Customer-visible (translated, new rows only): schedule_reservation_notifications ('A regular lesson has been scheduled.'), cancel_reservation_notifications ('Your scheduled regular lesson has been cancelled.'), _mock_exam_attempt_detail_v1 fallback exam name ('Mock exam'). Left Korean (staff/audit only): status-event and ledger reasons (admin_*, submit_homepage_consult_request, accept_guardian_link_invite, redeem_consultation_scheduling_link, payout_*, retention markers, capability keys), calendar cleanup flags. Existing notification rows untouched. Not in DB scope: Korean in app-code notification inserts.
