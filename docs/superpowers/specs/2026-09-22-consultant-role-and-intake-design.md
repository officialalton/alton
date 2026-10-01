# Consultant Role and Intake Design

## Decision

ALTON adds a consultant role for admissions planning. The first release uses one operational role, `consultant`, so one person can receive a consultation request, contact the family, hold the first meeting, complete onboarding, and manage the student's ongoing admissions plan.

The implementation must nevertheless separate intake/onboarding responsibilities from ongoing admissions-consulting responsibilities. This allows a future onboarding coordinator role to be introduced without moving records, changing student ownership, or rebuilding screens.

For the initial setup, assign the consultant role and both consultant capabilities to the existing account `jiman@alton.education`.

## Future Role Model

| Current implementation | Future operational role | Responsibility |
| --- | --- | --- |
| Consultant with both capabilities | Onboarding coordinator | New consultation intake, assignment, contract and account setup, consent and profile completion. |
| Consultant with both capabilities | Admissions consultant | First and follow-up meetings, admissions plan, student planner tasks, and long-term student strategy. |
| Administrator | Administrator | Account setup, capability management, assignment override, and exception handling. |

Do not create separate coordinator and admissions-consultant login roles in the MVP. Use one `consultant` role with independently grantable capabilities.

## Capabilities

Add or formalize these capabilities. If the existing `manage_consultations` capability is retained for backwards compatibility, it must not grant more access than the two explicit capabilities below without an intentional compatibility decision.

| Capability | Allows |
| --- | --- |
| `manage_consultation_intake` | View unassigned consultation requests; claim or assign requests; update intake and onboarding status; complete account, contract, consent, and profile checklists. |
| `manage_admissions_students` | View assigned students; contact assigned families; manage consultant availability and meetings; create admissions-related planner tasks; view allowed planning, score, and review summaries. |
| `assign_admissions_consultant` | Assign or reassign a consultant to a consultation request or active student. Administrator-only in the MVP unless explicitly delegated. |

`jiman@alton.education` receives `manage_consultation_intake` and `manage_admissions_students` for the MVP. Administrators retain all three capabilities.

## Ownership Fields

Keep intake ownership and ongoing student ownership independent even when both point to the same consultant initially.

| Field | Record | Meaning |
| --- | --- | --- |
| `intake_owner_id` | Consultation request | Person responsible for receiving and progressing the new request through onboarding. |
| `admissions_consultant_id` | Consultation request and/or active student relationship | Person responsible for the student's ongoing admissions plan after assignment. |
| `assigned_at` | Assignment record or request | When the admissions consultant was assigned. |
| `assigned_by` | Assignment record or request | Actor who made the assignment. |
| `reassigned_at` and history | Assignment history | Audit trail for responsibility changes. |

In the MVP, both owner fields normally reference `jiman@alton.education`. They must still be separate fields. Do not overload teacher assignment, admin ownership, or generic meeting creator fields as the admissions-consultant relationship.

## Consultation Lifecycle

The public homepage consultation form remains the entry point. The applicant does not directly self-book a first meeting in the MVP.

```text
Homepage consultation request
  → new request queue
  → intake owner confirms and assigns admissions consultant
  → consultant contacts family
  → consultant schedules first meeting from own availability
  → first meeting and review completed
  → contract, account, consent, and profile onboarding
  → active admissions student
```

Use the following operational states. Role-specific screens should show only relevant states rather than presenting every state to every user.

| State | Meaning | Primary actor |
| --- | --- | --- |
| New request | Public request submitted; no intake work has started. | Intake owner |
| Assignment pending | Request is being reviewed; admissions consultant not assigned. | Intake owner |
| Consultant assigned | Consultant is selected and notified. | Intake owner |
| Contact required | Consultant must contact the family. | Admissions consultant |
| Meeting coordination | Consultant and family are choosing a time. | Admissions consultant |
| Meeting confirmed | Calendar event and Meet link are created. | Admissions consultant |
| Initial consultation complete | First meeting and consultant review are complete. | Admissions consultant |
| Onboarding in progress | Contract, account, consent, and profile work is incomplete. | Intake owner |
| Active student | Admissions-planning service has begun. | Admissions consultant |
| On hold or closed | Cancelled, not converted, paused, or requires later follow-up. | Intake owner |

Map or migrate existing consultation-request statuses deliberately. Do not silently reinterpret an existing `scheduled` or `completed` record without preserving its existing meaning and audit history.

## Screen Scope

### Consultant Portal

Create a consultant portal or role-specific shell with these MVP destinations:

| Destination | Purpose |
| --- | --- |
| Home | Contact-required requests, today's and this week's meetings, and overdue admissions-planner work for assigned students. |
| New assignments | Newly assigned prospects and the action to record first contact or schedule the first meeting. |
| My students | Active admissions students; entry to each student's planner, roadmap, permitted score summary, reviews, and meeting history. |
| Schedule | Consultant availability and confirmed meetings. |

For an assigned prospect, show the student and guardian basic details, request text, assignment information, contact state, first-meeting action, and onboarding state. Do not expose unrelated household or student records.

### Administrator and Intake Views

Administrators and users with `manage_consultation_intake` need a new-request queue with owner and consultant assignment controls, onboarding checklist status, and exception handling. This replaces the assumption that an administrator personally schedules every incoming meeting.

## Responsibility Split

The consultant becomes the responsible customer-facing owner after assignment. The administrator remains the cross-account operating and control owner. The same person may initially hold both sets of capabilities, but the product must keep the boundaries explicit.

### Transfer to the Assigned Consultant

| Area | Consultant responsibility after assignment |
| --- | --- |
| Consultation request | Progress the assigned request, record first contact, coordinate the meeting, and update customer-facing status. |
| Messenger | Receive new messages for the assigned household, reply, and track unread conversation work. |
| Availability and meetings | Publish personal availability; create, change, and cancel first and follow-up meetings for assigned households. |
| Calendar and Meet | Create Calendar events and Meet links using the assigned consultant's calendar and availability. |
| Reviews | Write consultation notes, prepare customer-facing reviews, and record agreed next actions. |
| Student Success Planner | Create and manage admissions-related manual tasks for assigned students. |
| Admissions roadmap | Manage future admissions milestones and next actions for assigned students when this feature is released. |
| Student context | Read the permitted score goal, completed mock-exam summary, teacher reviews, learning-task status, and onboarding completeness needed for advising. |
| Customer communication | Trigger or send booking, meeting confirmation, rescheduling, and post-meeting next-step communications to assigned households. |

Consultant access to a household's messenger, meetings, and planning work must derive from the same `admissions_consultant_id`. Do not maintain separate, drifting ownership values for these customer-facing surfaces.

### Retain with Administrator

| Area | Administrator responsibility |
| --- | --- |
| Global operations | View all requests, households, conversations, meetings, students, consultant workloads, and overall pipeline state. |
| Assignment control | Assign or reassign consultants; control automatic-assignment mode and the eligible assignment pool. |
| Account and permissions | Create, deactivate, and configure staff accounts; manage roles, capabilities, absence, and assignment eligibility. |
| Commercial and legal operations | Control pricing, payments, refunds, entitlements, settlement, contract approval, consent policy, and compliance handling. |
| Household lifecycle | Create or close accounts, process deletion requests, and resolve household-level identity or access issues. |
| Exceptions and escalation | Intervene for consultant absence, customer complaints, failed handoffs, high-risk cases, and policy exceptions. |
| Audit | Read assignment history, operational notes, access history, and system-wide reporting. |

An administrator may act on behalf of a consultant for an exception, but such action must preserve the assigned consultant relationship and leave an audit record. Administrative visibility must not require impersonating a student, guardian, or consultant.

### Access Rules by Surface

| Surface | Assigned consultant | Other consultant | Administrator |
| --- | --- | --- |
| Assigned consultation request | Read and update | No access | Full access |
| Household messenger | Read and reply | No access | Full access and exception reply |
| Availability and booked meetings | Manage own assigned meetings | Manage own only | Full operational access |
| Student planner and admissions roadmap | Read and edit admissions items | No access | Full access |
| Learning answers and raw grading data | No access by default | No access | Existing role policy only |
| Payments, contracts, entitlements, account closure | Read status only when required for onboarding | No access | Full access |

## Assignment and Handoff Rules

### Assignment Modes

The administrator controls one global assignment setting:

| Mode | Behavior |
| --- | --- |
| Manual assignment | An administrator or authorized intake user chooses the intake owner and admissions consultant. |
| Automatic assignment | The system selects one eligible intake-capable consultant. In the MVP, use a transaction-safe random selection from active, accepting-new-work consultants. Assign that person as both `intake_owner_id` and `admissions_consultant_id`. |

An eligible automatic-assignment candidate must have `manage_consultation_intake`, an active account, and an explicit accepting-new-work flag. The system must not assign a request to a user who has no active availability. Future versions may replace random selection with capacity, expertise, language, or region-aware routing.

### Scheduling after Assignment

Remove public exposure of a generic administrator calendar from the landing flow. The public homepage collects a consultation request only.

After consultant assignment:

1. Create a customer-specific, signed scheduling link scoped to the request and assigned consultant.
2. Send an automated consultation guidance email to the request contact with a `Choose a meeting time` action.
3. The scheduling page shows only the assigned consultant's open availability.
4. The customer selects one slot without requiring an ALTON login.
5. The server atomically reserves the slot, creates the Calendar event and Meet link, updates the request to Meeting confirmed, and sends confirmations.

Use a booking page linked from email rather than an interactive calendar embedded inside email. The page can reliably handle time zones, expiration, rescheduling, cancellation, availability changes, and race-safe reservation.

Scheduling links must be single-request scoped, expire, support authorized reissue, and be invalidated when the consultant changes or the request closes. If the assigned consultant has no open availability, do not send the link; place the request in an `availability required` exception state and notify the responsible user.

### Reassignment

When the assigned consultant changes, perform one auditable handoff transaction:

```text
Change admissions consultant
  → update request and active-student ownership
  → reroute future household messenger notifications
  → transfer meeting-management and planner write access
  → invalidate outstanding old-consultant scheduling links
  → create or reissue a new scheduling link if a meeting is not confirmed
  → notify the affected internal users and, when appropriate, the customer
  → retain the complete assignment history
```

Do not rewrite historical message authors, existing consultation reviews, or prior calendar-event ownership. Preserve historical records and use the current assignment only to route future work and enforce current access.

## Meeting and Calendar Rules

- Only the assigned admissions consultant, or an authorized intake user acting on their behalf, may create or modify the first meeting after assignment.
- The first meeting is scheduled after direct contact with the family; self-service public booking is out of scope.
- Calendar and Meet creation reuse the existing integration where possible, but the event owner and availability must be the assigned consultant rather than a generic administrator.
- Rescheduling, cancellation, and meeting creation must preserve the request, consultant, and calendar-event linkage.

## Student Planner Relationship

After a request becomes an active student, the assigned admissions consultant may create and edit admissions-related manual tasks in the Student Success Planner. Examples: activity list preparation, test registration, essay preparation, or application-fee confirmation.

The consultant must not gain unrestricted access to learning answer keys, raw grading data, or unrelated student data. The consultant view should use permitted summary data such as score goals, completed mock exams, teacher reviews, and planner status.

## Access Control and Auditing

- Consultant reads are limited to prospects or students where that consultant is the assigned admissions consultant, with explicitly permitted intake access for unassigned requests.
- Assignment changes must be recorded with prior owner, new owner, actor, timestamp, and reason when provided.
- When reassigned, the former consultant immediately loses write access and sees no new detail beyond any retained audit policy.
- Guardians and students cannot view internal assignment notes or internal coordination notes.
- All server actions and row-level policies must enforce these relationships; hiding navigation alone is not sufficient.

## MVP Exclusions

- Separate onboarding-coordinator and admissions-consultant login roles
- Automatic consultant matching or workload balancing
- Public self-service calendar booking
- Consultant compensation, commissions, or settlement
- Full admissions CRM pipelines
- Application document collaboration, essay editing, or recommendation workflows
- Admissions timeline UI beyond planner tasks

## Acceptance Criteria

- `jiman@alton.education` can access the consultant portal with both intake and admissions-student capabilities.
- A public consultation request can be assigned to a consultant before first-meeting scheduling.
- The assigned consultant can see only assigned prospects and students, record contact progress, and schedule the first meeting using their availability.
- Existing Calendar and Meet event creation remains linked to the consultation request and assigned consultant.
- Intake owner and admissions consultant are stored independently and have auditable assignment history.
- An active admissions consultant can create admissions-related manual planner tasks only for assigned students.
- Existing teacher, guardian, student, and administrator access rules do not broaden accidentally.
- A future coordinator can receive only `manage_consultation_intake`, while a future admissions consultant can receive only `manage_admissions_students`, without data migration.
- Once assigned, household messenger routing, scheduling, meetings, and admissions-planner access all follow the same assigned consultant.
- Administrators retain global read access, reassignment controls, commercial/legal operations, account management, and exception handling.
- The public landing page has no generic administrator-availability calendar; the customer receives an assigned-consultant scheduling link only after assignment.
