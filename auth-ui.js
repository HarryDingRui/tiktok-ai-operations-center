(function () {
  'use strict';

  const panel = document.getElementById('auth-session-panel');
  const user = document.getElementById('auth-session-user');
  const logoutButton = document.getElementById('auth-logout-button');
  if (!panel || !user || !logoutButton) return;

  const isLoginPage = window.location.pathname.endsWith('/login') || window.location.pathname.endsWith('/login.html');

  function getSafeCurrentPath() {
    const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    return path.startsWith('/') && !path.startsWith('//') ? path : '/';
  }

  function redirectToLogin() {
    if (isLoginPage) return;
    const next = encodeURIComponent(getSafeCurrentPath());
    window.location.replace(`/login?next=${next}`);
  }

  async function loadSession() {
    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (response.status === 404) return;
      if (response.status === 401) {
        panel.hidden = true;
        redirectToLogin();
        return;
      }
      if (!response.ok) return;

      const payload = await response.json();
      if (!payload.authenticated || typeof payload.user !== 'string') return;
      user.textContent = payload.user;
      panel.hidden = false;
      document.body.dataset.authenticated = 'true';
    } catch {
      // A static GitHub Pages preview has no auth endpoint; Nginx remains the authority in production.
    }
  }

  logoutButton.addEventListener('click', async function () {
    logoutButton.disabled = true;
    logoutButton.textContent = '正在退出...';
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('logout failed');
      window.location.replace('/login');
    } catch {
      logoutButton.disabled = false;
      logoutButton.textContent = '退出失败，请重试';
    }
  });

  loadSession();
  window.setInterval(loadSession, 5 * 60 * 1000);
})();
