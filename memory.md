# SMCC Live — Working Memory

Last updated: 23 September 2026

## Project identity

- Workspace: `C:\Users\agniv\OneDrive\Documents\Python Files\Projects\Zoom-Clone`
- Product name in the existing UI: **SMCC Live**.
- Purpose: a private portal for one faculty/tutorial to run batches, live classes, materials, recordings, assignments, and calendars.
- Collaboration preference: learning-first engineering, not blind implementation. Explain architecture and help with plans/errors; avoid taking over design decisions that need the owner’s input.

## User’s non-negotiable requirements

- No public sign-up—for students or administrators.
- Student credentials are issued after admission.
- Administrator/teacher accounts are pre-provisioned; ownership transfer is an explicit future action.
- Maximum expected live room: 25–30 students plus the teacher.
- Teacher starts live video conferences; eligible students join.
- Live sessions are recorded and become accessible afterwards.
- Admin actions include add/remove/revoke/ban learners, merge/move batches, and time-limited access to another batch.
- Both roles need a calendar for assignments and planned topics/reading.
- Keep `plans.md` and `memory.md` updated after every user prompt/task based on current status.

## Files actually present

```text
Frontend/Login/index.html
Frontend/Login/style.css
Frontend/Login/script.js
Backend/                 (currently empty)
```

There is no Git repository in this workspace at the time of this note.

## Current login implementation notes

- `Frontend/Login/` now contains a functioning Supabase email/password login, password reset, loading/error feedback, tab-session versus persistent-session handling, and no untrusted-role authorization.
- `Frontend/portal.html` is a deliberately small, protected hand-off page until the proper FastAPI/frontend workspace is built. It checks the authenticated user's RLS-protected profile and provides sign-out.
- `Frontend/supabase-config.js` contains only the project anon/publishable key. It is suitable for browser delivery; it must never be replaced with a service-role key.
- `supabase/migrations/20260918_auth_profiles.sql` creates profiles, RLS, and an Auth-user trigger. It has not been applied automatically; the project owner must run it through the Supabase CLI or SQL Editor, disable public sign-ups, and assign the initial teacher/admin profile.
- `supabase/scripts/seed_test_users.mjs` is a guarded, server-only development seed script for the requested teacher/student accounts. It requires a project secret/service-role key and test passwords as local environment variables; neither belongs in browser code or version control.

- The selected role is only an HTML hidden field and UI label. It is untrusted client input and must not determine permissions or routing.

## Responsive Academic Dashboards & Calendar (23 September 2026)

- Rebuilt and styled both `Frontend/Teacher/` and `Frontend/Student/` dashboards to adhere strictly to the Login page design system: warm ivory canvas (`--cream: #f5f3ee`), deep forest green accents (`--accent: #1e3c39`), Playfair Display headings, DM Sans UI, glassmorphic cards, and restrained academic geometry.
- **Dynamic Academic Calendar**:
  - Implemented interactive month navigation (previous, next, today) and clickable day selection for both dashboards.
  - Clear color-coded event markers: Sage green for Classes & Topics (`.lesson`), Terracotta for Assignments Due (`.assignment`), Slate blue for Pre-Class Readings (`.reading`).
  - Teachers can add new events, edit existing events, specify "Topics to be discussed in class", due dates, and reading instructions, or delete events.
  - Students see upcoming topics, reading notes, assignment deadlines, and can toggle their reading/assignment progress status.
- **Batch & Student Cohort Management (Teacher)**:
  - Teachers can create new batches (name, subject, schedule rhythm, color theme, description).
  - Teachers can open any batch roster and add students (name, email, roll number), view enrolled students, or remove students.
- **Shared Local Academic Store (`Frontend/shared-store.js`)**:
  - Provides a centralized `localStorage` store with realistic SMCC Live seed data and reactive cross-tab events.
  - When the teacher adds or updates an event or batch, the student dashboard synchronizes in real time.
- **Enhanced Mobile Responsiveness**:
  - Implemented responsive off-canvas drawer navigation for mobile devices (< 768px) with backdrop overlays and accessible touch targets.
  - Responsive calendar grid that smoothly scales down to 44px touch targets on mobile viewports.
  - Stacked responsive cards and scrollable modal dialogs on small screens (< 480px) preventing horizontal overflow.
- `Frontend/portal.js` maintains authoritative profile-role routing to these dashboards. Full FastAPI/LiveKit integration remains in Milestone 4.

## Chosen direction (subject to owner approval)

- React + Vite + TypeScript frontend.
- FastAPI application API.
- Supabase Auth + Postgres + RLS + Storage.
- LiveKit SFU for WebRTC conferencing; FastAPI mints short-lived room tokens after checking class state and membership.
- LiveKit Egress records separately to private storage.

## Important design rules

- Do not send live media through FastAPI.
- Do not use mesh peer-to-peer conferencing for a 31-person class.
- Do not put Supabase service-role or LiveKit secret in the frontend.
- Do not allow direct/public storage access to learning materials or recordings.
- Model temporary attendance as dated access/membership; don’t mutate a user’s global role.
- Keep an audit trail for staff actions.
- Authorization needs current database checks, especially for bans/revocations/membership expiry; JWT claims alone can become stale.

## Immediate next task

Apply the supplied Supabase migration and bootstrap a teacher/admin profile, then plan the proper FastAPI application and component-based frontend after agreeing on the open product choices in `plans.md`.

Start Milestone 1: initialize a reproducible frontend/backend structure and Supabase migration workflow, then create the smallest schema and RLS policy set. Do this only after agreeing on the open product choices in `plans.md` that materially affect scope.

## FastAPI integration guidance (18 September 2026)

- FastAPI should be the trusted business/policy API, not a proxy for every Supabase query and not the media server.
- The browser authenticates with Supabase Auth and sends its access token as `Authorization: Bearer <token>` to FastAPI.
- FastAPI verifies the token, reads the up-to-date profile/account status, and then authorizes each action. Add an explicit `require_admin` dependency for staff routes.
- Use server-only service-role access only for actions that require it (Auth user provisioning, privileged workflows, webhooks). A request-scoped client carrying the user JWT can preserve RLS for normal user reads.
- First endpoints to make: `/health`, `/v1/me`, student/batch/calendar reads, class join-token, then admin provisioning/membership/class endpoints.
- FastAPI mints short-lived LiveKit room tokens after verifying live-class state and valid membership. It never forwards WebRTC media.

## FastAPI start point (21 September 2026)

- Begin FastAPI now, alongside the existing plain-JavaScript frontend; a React migration is neither required nor a prerequisite.
- Keep browser login on Supabase Auth for now. The first backend lesson should be `GET /health`, configuration, local CORS, then a Supabase-JWT-protected `GET /v1/me` endpoint.
- After it works, have `Frontend/portal.js` call `/v1/me` with `fetch` and `Authorization: Bearer <session.access_token>`. Do not change the login form merely to route sign-in through FastAPI.
- Defer domain endpoints until their tables/migrations exist. Avoid turning FastAPI into a proxy for simple RLS-protected browser reads.

## Login/profile investigation (18 September 2026)

- Browser console evidence: password authentication proceeds, then `GET /rest/v1/profiles?select=id,role,status,display_name&id=eq.<auth-user-id>` returns HTTP 400.
- The application intentionally queries `public.profiles`; it cannot query `auth.users` through the browser REST API. An Auth user therefore must have a matching profile row.
- Most likely deployment cause: the profile migration was not applied, or a pre-existing `public.profiles` table has a different schema and `CREATE TABLE IF NOT EXISTS` did not add `role`, `status`, or `display_name`. The original migration must be checked in the SQL Editor and then repaired with a separate migration, not by changing Auth rows manually.
- The `Multiple GoTrueClient instances` warning comes from deliberately creating multiple Supabase clients for persistent versus tab-only sessions. It is a separate frontend quality issue and does not explain the profile request's 400 response.
- When debugging, inspect the Network response body or log the full Supabase error object (`message`, `code`, `details`, `hint`). The current UI replaces this useful database error with a generic access message.
- The SQL diagnostic is one-time troubleshooting only. Once the `on_auth_user_created` trigger is installed, every future insert into `auth.users` automatically receives a default `public.profiles` row. The administrator/provisioning service then assigns its authoritative role and batch memberships; it must not require a manual query per student.
- Screenshot confirms the deployed `public.profiles` table currently has `id`, `email`, and `role`, but not `status` or `display_name`. This exact mismatch produces the login query's 400 response. Do not add app columns to managed `auth.users`; add them to `public.profiles`.
- Added `supabase/migrations/20260918_repair_profiles_schema.sql`. The owner must apply it once through Supabase SQL Editor. It adds `status` and `display_name`, protects profiles with self-read RLS, installs/reinstalls the automatic Auth-user trigger, and backfills missing profile rows.
- Login requirement update: the selected Teacher/Student tab is now an explicit portal-selection check. A `student` profile cannot proceed from the Teacher tab and a `teacher`/`admin` profile cannot proceed from the Student tab. The existing-session redirect now observes this same rule. This is a user-experience gate only; RLS/FastAPI must remain the authorization boundary.
