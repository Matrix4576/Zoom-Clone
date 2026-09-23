# SMCC Live — Development Plan

Last updated: 23 September 2026

## Current stage

**Update, 23 September 2026.** The static prototype now authenticates with Supabase, handles password resets, checks the RLS-protected `profiles` row after sign-in, and routes into initial Teacher and Student dashboard prototypes. `supabase/migrations/20260918_auth_profiles.sql` supplies the minimum profile schema and RLS policy; it must be applied to the Supabase project before login testing. The Teacher/Student toggle is presentation only, never an authorization decision.

**Stage 0 — discovery and foundation.** The repository currently contains only a static login interface at `Frontend/Login/` (`index.html`, `style.css`, and `script.js`). There is no FastAPI application, database migration, schema, test suite, environment configuration, dashboard, or video implementation yet.

## Product scope

SMCC Live is a private learning portal for one tutorial/faculty.

- Only an existing administrator can create users; there is no public sign-up.
- Students sign in with credentials issued after admission.
- Students see only their allowed batches, materials, recordings, calendar items, and assignments.
- Administrators manage people and batches, including removal, bans, permanent moves/merges, and a time-limited cross-batch access exception.
- An administrator starts a live class; eligible students can join while it is live.
- A class can be recorded and made available afterwards.

## Architecture decisions

| Concern | Decision | Why |
| --- | --- | --- |
| Browser UI | Move the current static prototype into a component-based frontend (recommended: React + Vite + TypeScript) | Routing, protected layouts, calendars, forms, and a video room will otherwise become hard to maintain. |
| Identity | Supabase Auth, email/password only, with invite/provisioning performed by an admin service | It supports pre-created accounts without exposing a registration path. |
| Authorization and app data | Supabase Postgres with Row Level Security (RLS); FastAPI repeats authorization checks for privileged commands | RLS protects data even if a browser client calls Supabase directly; backend checks protect business actions. |
| Backend | FastAPI as the application API and policy boundary | Owns admin actions, scheduling, audit history, invite/password-reset workflows, and video-token creation. |
| Media | A WebRTC **SFU**, preferably LiveKit for the first implementation | A 31-person room is unsuitable for peer-to-peer mesh. Each person publishes once to the SFU; it forwards selected streams. |
| Recording | LiveKit Egress/recording worker, writing final artifacts to private object storage | Recording/transcoding is separate from the latency-sensitive SFU path. |
| Files | Supabase Storage private buckets, accessed through RLS or short-lived signed URLs | Materials and recordings must not have public URLs. |

### Trust boundaries

```text
Browser ── Supabase Auth ──> session JWT
   │                           │
   ├── RLS-scoped reads ─────> Supabase Postgres / Storage
   │
   └── Bearer JWT ───────────> FastAPI
                                  │ validates identity + checks current membership/status
                                  ├── privileged Postgres writes
                                  └── short-lived, room-specific LiveKit token

Browser ── WebRTC media ─────> LiveKit SFU ──> other participants
                                  │
                                  └── Egress worker ──> private recordings storage
```

Never place a Supabase service-role key, LiveKit API secret, or storage credentials in browser code. The Supabase publishable/anon key is intended for the browser, but RLS must be enabled and correct for every exposed table.

## Core data model (first draft)

- `profiles`: one row per `auth.users` user; display name, role (`admin` or `student`), account status (`active`, `suspended`, `banned`), timestamps.
- `batches`: name, subject, active state, primary teacher profile, schedule metadata.
- `batch_memberships`: student, batch, membership state, valid-from/to, origin, notes. A time-limited alternative-batch attendance right is a separate dated membership/access grant—not a role change.
- `classes`: batch, planned start/end, topic, state (`scheduled`, `live`, `ended`, `cancelled`), room id.
- `class_attendance`: class, student, join/leave times, attendance status.
- `materials`: batch or class scope, uploader, private storage object path, title/type.
- `recordings`: class, recording state, storage object path, duration, visibility/published time.
- `assignments`: batch or class scope, due time, description, attachment metadata, publication state.
- `calendar_events`: batch/class scope, event type, start/end, title, description.
- `audit_log`: actor, action, target type/id, timestamp, structured detail. Required for bans, removals, batch changes, and access exceptions.


## Build sequence

### Milestone 1 — project foundation

1. Initialize frontend and backend tooling, dependency manifests, `.gitignore`, `.env.example`, linting, and a Git repository.
2. Create a FastAPI health endpoint, settings module, CORS policy for local frontend only, and test setup.
3. Configure Supabase development project, authentication email template/settings, and database migration workflow.
4. Add the initial schema, RLS policies, private storage buckets, and seed only a bootstrap admin through a secure server-side procedure.

**Done when:** a clean clone can be configured from documented environment variables; schema is reproducible; no privileged secret reaches the browser.

### When to begin FastAPI

**Begin now, in parallel with the plain-JavaScript frontend.** Do not wait to migrate to React and do not make the current login call FastAPI just to prove it exists. Supabase Auth should continue to handle the browser sign-in for this prototype.

The right first FastAPI increment is deliberately small:

1. Create `Backend/app/main.py` with `GET /health` returning `{"status": "ok"}`.
2. Add typed environment settings and `.env.example`; keep all secrets out of frontend files.
3. Add CORS limited to the local frontend development address.
4. Add one protected `GET /v1/me` endpoint. The browser sends its Supabase access token; FastAPI validates it and returns the current user/profile summary.
5. Point the portal placeholder—not the login form—at `/v1/me` once it works.

Do **not** build the user-provisioning, batch, calendar, or video endpoints until the database schema/migrations for those features exist. Do not proxy every Supabase query through FastAPI; direct RLS-safe reads remain appropriate from plain JavaScript.

This is the teaching sequence: learn one authenticated FastAPI route end-to-end, then add one small domain feature at a time. Plain JavaScript is fully compatible with FastAPI: use `fetch()` with the signed-in Supabase session's `access_token` in the `Authorization` header.

### FastAPI’s role in this project

FastAPI is not a replacement for Supabase. Use it as the **trusted application layer** for business actions that a browser must not be able to perform on its own.

| Let Supabase handle | Let FastAPI handle |
| --- | --- |
| Email/password sign-in and session refresh | Validate the browser’s Supabase JWT on protected API requests |
| Postgres, migrations, RLS, and basic RLS-scoped reads | Admin-only workflows: provision users, ban/reinstate, move students, create temporary access, merge batches |
| Private object storage | Authorize sensitive uploads/downloads and issue narrowly scoped signed URLs when needed |
| Realtime database events where appropriate | Start/end classes, check current access, mint short-lived LiveKit room tokens, receive recording webhooks |
| Browser-side reads that have simple, well-tested RLS policies | Cross-table business rules, audit logging, scheduled/background work, and integration secrets |

Suggested API surface for the first useful backend:

```text
GET  /health
GET  /v1/me
GET  /v1/my/batches
GET  /v1/my/calendar?from=&to=
GET  /v1/classes/{class_id}
POST /v1/classes/{class_id}/join-token

POST /v1/admin/students
PATCH /v1/admin/students/{student_id}/status
POST /v1/admin/batches
POST /v1/admin/batches/{batch_id}/members
POST /v1/admin/batches/{batch_id}/access-grants
POST /v1/admin/classes
POST /v1/admin/classes/{class_id}/start
POST /v1/admin/classes/{class_id}/end

POST /v1/webhooks/livekit/egress
```

Every endpoint other than `/health` must use a dependency such as `get_current_user`. It extracts the `Authorization: Bearer <Supabase access token>` header, cryptographically verifies it against Supabase's signing keys/JWKS, then loads the current profile/status from the database. Admin endpoints add a `require_admin` dependency. Never trust role, batch id, or user id supplied by the frontend without checking them.

Use two server-side Supabase clients deliberately:

- A **request-scoped user client** that
Use UUID primary keys, UTC timestamps, foreign keys, check constraints/enums, and migrations from the beginning. Do not store authorization only in JWT metadata: batch membership changes need to take effect immediately. forwards the caller’s JWT, so RLS still applies to ordinary user requests.
- A **service-role client** only inside tightly guarded FastAPI code for provisioning Auth users, administrative writes, and webhook processing. It bypasses RLS, so it must never be returned to or used by the browser.

Recommended module layout once FastAPI is initialized:

```text
Backend/app/
  main.py                  # app factory, routes, middleware
  core/config.py           # typed environment settings
  core/security.py         # JWT verification and role dependencies
  api/routes/              # thin HTTP controllers
  schemas/                 # Pydantic request/response models
  services/                # membership, classes, provisioning, LiveKit logic
  repositories/            # optional database query boundary
  tests/
```

Keep route handlers thin: validate input with Pydantic, call one service, and return a response model. Put transaction rules and audit logging in services. Start with synchronous request work only; use a proper worker/queue later for recording processing, email retries, and scheduled reminders. FastAPI `BackgroundTasks` is fine for tiny non-critical jobs, but is not a durable job queue.

### Milestone 2 — private access and login

1. **Complete for the static prototype:** repair the login submit flow; add loading, error, and password-reset states; do not route until authentication succeeds.
2. **Complete for the static prototype:** fetch the authenticated profile and gate the portal by server-authoritative role/status, not the selected UI tab.
3. Add protected routes and session restoration/logout.
4. Build an admin-only user-provisioning endpoint that creates the Auth user, profile, and initial membership, then sends a password-set/recovery email.

**Done when:** a provisioned active student can sign in and cannot read another student’s batch data; banned/suspended accounts are denied.

### Milestone 3 — batches, content, calendar

1. **Dashboards & Academic Calendar complete:** Interactive Teacher and Student dashboards implemented in `Frontend/Teacher/` and `Frontend/Student/`, faithfully reflecting the Login page's warm academic design style.
2. **Dynamic Calendar & Event Management:** Fully interactive month navigation and day inspection. Teachers can create, edit, and delete events with topic outlines, assignment deadlines, and reading notes. Students can inspect discussion topics, toggle assignment completion, and mark readings done.
3. **Batch & Student Cohort Management:** Teachers can create batches (name, schedule, subject, color, description) and manage student rosters (adding/removing students with admission roll numbers).
4. **Shared Reactive Store:** `Frontend/shared-store.js` manages state with `localStorage` and cross-tab sync for rapid prototyping and validation prior to backend migration.
5. **Full Mobile Responsiveness:** Drawer navigation, responsive calendar cells, adaptive modals, and stacked mobile layouts across all device sizes.
6. Admin batch/member management with server-side audit trail and time-bounded cross-batch grants backed by Supabase/FastAPI remains the backend integration step.
7. File validation, upload limits, private storage delivery, and material/assignment authorization tests.

### Milestone 4 — live classroom

1. Run a local LiveKit SFU and connect a minimal classroom page (camera, microphone, screen share, participant grid).
2. Add FastAPI endpoints to start/end a class and mint tokens only for an active, eligible membership.
3. Implement teacher controls (mute policy, admission/removal, screen share) and attendance events.
4. Add recording Egress and an asynchronous completion/webhook flow that creates a `recordings` record only after upload succeeds.
5. Pilot with 5 people, then 31 people on realistic networks before relying on it for a real class.

## Latency and reliability plan

- Use WebRTC over an SFU; do not relay audio/video through FastAPI and do not use peer-to-peer mesh for this room size.
- Start with one LiveKit region physically near the teacher and most students. Measure round-trip time, packet loss, jitter, reconnect rate, and end-to-end audio delay during a pilot.
- Deploy TURN with TLS and UDP support. TURN is essential for restrictive school/mobile networks, although relay use can add latency.
- Enable adaptive stream/simulcast; display only high quality for the active speaker/pinned teacher and lower quality thumbnails for others.
- Record out-of-band with Egress. Do not transcode or upload recordings in the teacher’s browser, and do not make recording completion block the live room.
- Cap initial room behavior: teacher camera high quality, students adaptive/lower quality, and clear mute/camera defaults. Bandwidth and CPU—not just participant count—determine practical quality.
- Keep FastAPI and Supabase out of the media forwarding path. Their requests are control-plane operations only.

For early development, managed LiveKit Cloud reduces operational risk. A self-hosted deployment is appropriate later if data location, cost, or learning goals justify running the SFU, TURN, Redis, and recording workers. Self-hosted recording is a separately deployed Egress service; account for this in capacity planning.

## Security baseline

- Enable RLS on every application table and create policies before exposing browser reads.
- Validate Supabase access tokens in FastAPI; verify signatures via the project JWKS/signing-key approach rather than decoding unverified tokens.
- Make admin APIs server-only and record every sensitive action in `audit_log`.
- Rate-limit login-related endpoints, use strong generated initial passwords or password-set links, and require the user to set their own password.
- Store all media/materials privately; authorize downloads based on current batch/class access, including expiry dates.
- Treat banned/suspended state and membership expiry as a check at token issuance and sensitive API calls. Token lifetimes should be short for rooms.
- Back up the database and establish a recording retention/deletion policy before using real student data.

## Known login diagnostic (18 September 2026)

If login succeeds but the screen says it cannot verify access, distinguish `auth.users` from `public.profiles`:

- The browser correctly signs the user into Supabase Auth, then queries `public.profiles` for `id`, `role`, `status`, and `display_name`.
- The Auth schema is intentionally not exposed through the browser REST API. A user appearing under **Authentication → Users** does not, by itself, prove that a matching `public.profiles` row exists.
- A 400 response on that exact query is usually a missing table/column or schema-cache error, not an RLS denial. RLS normally returns a successful empty result for a hidden row.

Run this read-only diagnostic in the Supabase SQL Editor before changing application code:

```sql
select
  u.id,
  u.email,
  p.id as profile_id,
  p.role,
  p.status,
  p.display_name
from auth.users u
left join public.profiles p on p.id = u.id
where u.email in ('agniva.roy44@gmail.com', 'teststudent1@gmail.com');
```

If this fails because `role`, `status`, or `display_name` does not exist, the deployed `profiles` table predates the migration. Create a new, reviewed repair migration using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`; do not assume that the existing `CREATE TABLE IF NOT EXISTS` statement modifies an already-created table. If `profile_id` is null, apply the existing profile migration/backfill, then set the intended teacher/admin role server-side.

This diagnostic is not part of normal user creation. The migration's `on_auth_user_created` trigger runs automatically for every future Auth user—whether the account is created from the Supabase Dashboard or later by FastAPI—and inserts a default profile row. The server-side provisioning workflow then sets the intended account role and creates batch memberships in the same controlled operation.

### Resolved schema mismatch (18 September 2026)

The deployed `public.profiles` table was created with `id`, `email`, and `role` only, while the frontend rightly queries `role`, `status`, and `display_name`. `status` and `display_name` belong in `public.profiles`, not in Supabase-managed `auth.users`. A repair migration now exists at `supabase/migrations/20260918_repair_profiles_schema.sql`; apply it once through the SQL Editor before retesting login. `status` is retained because it is the authorization control for active, suspended, and banned accounts.

### Portal-selection rule (18 September 2026)

The login UI must reject a role mismatch: Student tab accepts only `student`; Teacher tab accepts `teacher` and `admin`. This check is performed after reading the authoritative `public.profiles.role`, and the user is signed out on mismatch. It is deliberately not relied upon as security—client-side tab state is modifiable, so RLS and the upcoming FastAPI authorization checks continue to protect teacher-only data/actions.

## Open decisions for the project owner

1. Is this a single-subject/single-teacher application indefinitely, or should data structures support several teachers now?
2. What is the expected hosting budget and preferred data region (important for LiveKit and Supabase latency)?
3. Will students submit assignment files, or are assignments view-only/due-date tracking in version one?
4. How long should recordings and student data be retained?
5. Is a mobile-responsive web app sufficient for the first release?

## Useful references

- [Supabase Auth](https://supabase.com/docs/guides/auth) and [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase JWT verification](https://supabase.com/docs/guides/auth/jwts)
- [LiveKit SFU overview](https://docs.livekit.io/reference/internals/livekit-sfu/), [self-hosting options](https://docs.livekit.io/transport/self-hosting/), and [recording/Egress](https://docs.livekit.io/transport/self-hosting/egress/)
