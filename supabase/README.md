# Supabase setup for the login prototype

1. If `public.profiles` does not yet exist, apply [`migrations/20260918_auth_profiles.sql`](migrations/20260918_auth_profiles.sql) with the Supabase CLI or SQL Editor. If it already exists with only `id`, `email`, and `role` (the current project state), apply [`migrations/20260918_repair_profiles_schema.sql`](migrations/20260918_repair_profiles_schema.sql) instead.
2. Disable public sign-ups in the project's Auth configuration. Accounts must be created by an administrator or the future FastAPI provisioning flow.
3. Create the initial staff account in Supabase Auth, then use the SQL Editor once to give it access. Replace the email before executing:

   ```sql
   update public.profiles p
   set role = 'teacher', status = 'active'
   from auth.users u
   where p.id = u.id
     and u.email = 'teacher@example.com';
   ```

The browser uses only the project's anon/publishable key from `Frontend/supabase-config.js`. Never add a service-role key to browser files. The migration permits a signed-in user to read only their own profile; all profile writes, role changes, and status changes are intentionally reserved for trusted server-side code. `auth.users` is managed by Supabase and should not be extended with application fields; application fields belong in `public.profiles`.

The reset-password link returns to `Frontend/portal.html`. Add each deployed login/portal URL to Supabase Auth's allowed redirect URLs before testing password reset.

## Seed the two local test accounts

After applying the migration, run the server-only script below from `Projects/Zoom-Clone`. It creates or updates the requested teacher and student accounts, marks their email addresses confirmed, and assigns their roles in `profiles`. Passwords are read from temporary environment variables and are not stored in the repository.

```powershell
$env:SUPABASE_SERVICE_ROLE_KEY = 'paste the project secret/service-role key here'
$env:TEST_TEACHER_PASSWORD = 'enter the teacher test password here'
$env:TEST_STUDENT_PASSWORD = 'enter the student test password here'
$env:CONFIRM_TEST_SEED = 'YES'
node supabase/scripts/seed_test_users.mjs
```

Use the current project secret key from Supabase's Connect/API Keys screen. Keep it out of `Frontend/`, Git, and chat messages. The script defaults to `agniva.roy44@gmail.com` for the teacher and `teststudent01@gmail.com` for the student; override either with `TEST_TEACHER_EMAIL` or `TEST_STUDENT_EMAIL` if needed.
