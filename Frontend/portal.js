/* global supabase, SMCC_SUPABASE_CONFIG */

(() => {
  'use strict';

  const config = window.SMCC_SUPABASE_CONFIG;
  const status = document.querySelector('#status');
  const greeting = document.querySelector('#greeting');
  const detail = document.querySelector('#detail');
  const signOutButton = document.querySelector('#sign-out');

  if (!config?.url || !config?.anonKey || !window.supabase) {
    status.textContent = 'The portal configuration is unavailable.';
    return;
  }

  const { createClient } = window.supabase;
  const getClient = (storage) => createClient(config.url, config.anonKey, {
    auth: { autoRefreshToken: true, persistSession: true, storage },
  });
  const localClient = getClient(window.localStorage);
  const sessionClient = getClient(window.sessionStorage);
  const goToLogin = () => window.location.assign(new URL('./Login/', window.location.href));

  const getSession = async () => {
    const local = await localClient.auth.getSession();
    if (local.data.session) return { client: localClient, session: local.data.session };
    const tab = await sessionClient.auth.getSession();
    return { client: sessionClient, session: tab.data.session };
  };

  const initialise = async () => {
    const { client, session } = await getSession();
    if (!session) {
      goToLogin();
      return;
    }

    const { data: profile, error } = await client
      .from('profiles')
      .select('role, status, display_name')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error || !profile || profile.status !== 'active') {
      await client.auth.signOut({ scope: 'local' });
      status.textContent = 'Your account is not authorised to use SMCC Live.';
      setTimeout(goToLogin, 1500);
      return;
    }
    const roleName = profile.role === 'student' ? 'Student' : 'Teacher';
    status.hidden = true;
    greeting.textContent = `Welcome${profile.display_name ? `, ${profile.display_name}` : ''}`;
    detail.textContent = `${roleName} access verified.`;
    setTimeout(() => {
      if (profile.role === 'student') {
        window.location.assign(new URL('./Student/', window.location.href));
      } else {
        window.location.assign(new URL('./Teacher/', window.location.href));
      }
    }, 1500);
    greeting.hidden = false;
    detail.hidden = false;
    signOutButton.hidden = false;
    signOutButton.addEventListener('click', async () => {
      await client.auth.signOut({ scope: 'local' });
      goToLogin();
    });
  };

  initialise().catch(() => {
    status.textContent = 'Unable to verify your access. Please try again.';
  });
})();
