(function () {
  'use strict';

  const form = document.getElementById('login-form');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const submitButton = document.getElementById('login-submit');
  const submitText = submitButton.querySelector('.submit-text');
  const status = document.getElementById('auth-status');
  const statusMessage = status.querySelector('.status-message');
  const togglePassword = document.getElementById('toggle-password');
  const nextPath = getSafeNextPath();

  function getSafeNextPath() {
    const raw = new URLSearchParams(window.location.search).get('next');
    if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
    return raw === '/login' || raw.startsWith('/login?') ? '/' : raw;
  }

  function setStatus(message, state = '') {
    status.dataset.state = state;
    statusMessage.textContent = message;
  }

  function setLoading(loading) {
    submitButton.disabled = loading;
    submitButton.classList.toggle('is-loading', loading);
    submitText.textContent = loading ? '正在验证...' : '进入运营中枢';
  }

  async function readJson(response) {
    try { return await response.json(); } catch { return {}; }
  }

  async function checkExistingSession() {
    try {
      const response = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
      if (response.ok) {
        setStatus('认证已通过，正在进入运营中枢', 'success');
        window.location.replace(nextPath);
        return;
      }
      if (response.status !== 401 && response.status !== 404) {
        setStatus('认证服务暂时不可用，请联系管理员', 'error');
      }
    } catch {
      setStatus('认证服务暂时不可用，请联系管理员', 'error');
    }
  }

  togglePassword.addEventListener('click', function () {
    const visible = passwordInput.type === 'text';
    passwordInput.type = visible ? 'password' : 'text';
    togglePassword.setAttribute('aria-label', visible ? '显示密码' : '隐藏密码');
    togglePassword.setAttribute('aria-pressed', String(!visible));
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (submitButton.disabled) return;

    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if (!username || !password) {
      setStatus('请输入账号和密码', 'error');
      (!username ? usernameInput : passwordInput).focus();
      return;
    }

    setLoading(true);
    setStatus('正在验证访问权限...', 'loading');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const payload = await readJson(response);
      if (!response.ok) {
        setStatus(response.status === 401 ? '账号或密码错误，请重新输入' : (payload.error || '认证服务暂时不可用，请联系管理员'), 'error');
        passwordInput.select();
        return;
      }

      setStatus('认证通过，正在进入运营中枢', 'success');
      window.setTimeout(() => window.location.replace(nextPath), 260);
    } catch {
      setStatus('认证服务暂时不可用，请联系管理员', 'error');
    } finally {
      setLoading(false);
    }
  });

  checkExistingSession();
})();
