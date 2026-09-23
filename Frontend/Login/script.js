/* global supabase, SMCC_SUPABASE_CONFIG */

(() => {
  'use strict';
  const config = window.SMCC_SUPABASE_CONFIG;
  if (!config?.url || !config?.anonKey || !window.supabase) {
    console.log('Supabase is not configured. Check Frontend/supabase-config.js.');
    return;
  }

  const { createClient } = window.supabase;
  const roleOptions = document.querySelectorAll('.role-option');
  const roleField = document.querySelector('#user-role');
  const emailLabel = document.querySelector('#email-label');
  const submitButton = document.querySelector('.sign-in');
  const submitLabel = document.querySelector('.sign-in span');
  const passwordToggle = document.querySelector('.password-toggle');
  const passwordInput = document.querySelector('#password');
  const emailInput = document.querySelector('#email');
  const form = document.querySelector('#login-form');
  const message = document.querySelector('#form-message');
  const forgotPassword = document.querySelector('#forgot-password');

  const titleCase = (value) => value.charAt(0).toUpperCase() + value.slice(1);
  const createSupabaseClient = (storage) => createClient(config.url, config.anonKey, {
    auth: { autoRefreshToken: true, detectSessionInUrl: true, persistSession: true, storage },
  });

  // A checked "Keep me signed in" uses localStorage; an unchecked one ends when
  // this browser tab is closed. Neither choice affects authorization.
  const persistentClient = createSupabaseClient(window.localStorage);
  const tabSessionClient = createSupabaseClient(window.sessionStorage);

  const setMessage = (text = '', type = '') => {
    message.textContent = text;
    message.className = `form-message${type ? ` ${type}` : ''}`;
  };

  const setSubmitting = (submitting) => {
    submitButton.disabled = submitting;
    submitButton.setAttribute('aria-busy', String(submitting));
    submitLabel.textContent = submitting ? 'Signing in…' : `Sign in as ${titleCase(roleField.value)}`;
  };

  const clearStoredSession = async (client) => {
    await client.auth.signOut({ scope: 'local' });
  };

  const getProfile = async (client, userId) => {
    const { data, error } = await client
      .from('profiles')
      .select('id, role, status, display_name')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw new Error('We could not verify your account access. Please contact support.');
    if (!data) throw new Error('Your account has not been provisioned for SMCC Live.');
    return data;
  };

  // This controls which portal the user asked to enter. It is an intentional
  // UX check, not the security boundary: the profile's role and server-side
  // authorization remain authoritative.
  const matchesSelectedPortal = (profileRole, selectedPortal) => {
    if (selectedPortal === 'teacher') {
      return profileRole === 'teacher' || profileRole === 'admin';
    }
    return profileRole === 'student';
  };

  const roleLabel = (role) => titleCase(role === 'admin' ? 'teacher' : role);

  const redirectToPortal = () => {
    window.location.assign(new URL('../portal.html', window.location.href));
  };

  const completeSignIn = async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const remember = form.elements.remember.checked;

    // The UI role picker is presentation only. The role below comes from the
    // protected profile row after Supabase has authenticated the user.
    const client = remember ? persistentClient : createSupabaseClient(window.sessionStorage);
    if (!remember) await clearStoredSession(persistentClient);

    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.user || !data.session) {
      throw new Error(error?.message || 'We could not sign you in. Please try again.');
    }

    try {
      const profile = await getProfile(client, data.user.id);
      if (profile.status !== 'active') {
        await clearStoredSession(client);
        throw new Error('This account is not active. Please contact support.');
      }
      if (!['teacher', 'admin', 'student'].includes(profile.role)) {
        await clearStoredSession(client);
        throw new Error('This account has an invalid access role. Please contact support.');
      }
      if (!matchesSelectedPortal(profile.role, roleField.value)) {
        await clearStoredSession(client);
        throw new Error(
          `This account has ${roleLabel(profile.role)} access. Select the ${roleLabel(profile.role)} portal to sign in.`
        );
      }

      setMessage('Signed in successfully. Taking you to your workspace…', 'success');
      redirectToPortal();
    } catch (profileError) {
      await clearStoredSession(client);
      throw profileError;
    }
  };

  roleOptions.forEach((option) => {
    option.addEventListener('click', () => {
      const role = option.dataset.role;
      roleOptions.forEach((item) => {
        const selected = item === option;
        item.classList.toggle('active', selected);
        item.setAttribute('aria-selected', String(selected));
      });
      roleField.value = role;
      emailLabel.textContent = `${titleCase(role)} email`;
      submitLabel.textContent = `Sign in as ${titleCase(role)}`;
      setMessage();
    });
  });

  passwordToggle.addEventListener('click', () => {
    const showing = passwordInput.type === 'text';
    passwordInput.type = showing ? 'password' : 'text';
    passwordToggle.classList.toggle('showing', !showing);
    passwordToggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    passwordToggle.setAttribute('aria-pressed', String(!showing));
  });

  forgotPassword.addEventListener('click', async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    if (!email || !emailInput.checkValidity()) {
      setMessage('Enter your email address first, then choose Forgot password.', 'error');
      emailInput.focus();
      return;
    }

    try {
      setMessage('Sending password-reset instructions…');
      const { error } = await persistentClient.auth.resetPasswordForEmail(email, {
        redirectTo: new URL('../portal.html', window.location.href).href,
      });
      if (error) throw error;
      setMessage('If that account exists, password-reset instructions have been sent.', 'success');
    } catch (error) {
      setMessage(error.message || 'Unable to start password reset. Please try again.', 'error');
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      setMessage('Please enter a valid email address and password.', 'error');
      form.reportValidity();
      return;
    }

    setMessage();
    setSubmitting(true);
    try {
      await completeSignIn();
    } catch (error) {
      setMessage(error.message || 'Unable to sign in. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  });

  // Existing sessions may be restored only into the portal that matches the
  // selected tab. This prevents a student session from bypassing Teacher.
  const restoreMatchingSession = async () => {
    const persistent = await persistentClient.auth.getSession();
    const tab = await tabSessionClient.auth.getSession();
    const sessionEntry = persistent.data.session
      ? { client: persistentClient, session: persistent.data.session }
      : tab.data.session
        ? { client: tabSessionClient, session: tab.data.session }
        : null;

    if (!sessionEntry) return;
    const profile = await getProfile(sessionEntry.client, sessionEntry.session.user.id);
    if (profile.status !== 'active') {
      await clearStoredSession(sessionEntry.client);
      return;
    }
    if (matchesSelectedPortal(profile.role, roleField.value)) {
      redirectToPortal();
    }
  };

  restoreMatchingSession().catch(() => {
    // A stale browser session is handled at the next sign-in attempt.
  });
})();
