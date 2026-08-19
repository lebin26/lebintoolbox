/**
 * OmniBox - Auth & User Manager Module
 * Handles Login, Registration, Token management, Session validation, and Admin Role checks.
 */

(function () {
  let toastTimer = null;
  window.showToast = function (message, duration = 2200) {
    if (!message) return;
    let toast = document.getElementById('global-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'global-toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<span class="toast-msg">${message}</span>`;
    toast.classList.add('show');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  };

  const TOKEN_KEY = 'omnibox_auth_token';
  const USER_KEY = 'omnibox_user_info';
  const LEGACY_TOKEN_KEY = 'hostcalculator_auth_token';
  const LEGACY_USER_KEY = 'hostcalculator_user_info';

  let currentToken = localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY) || null;
  let currentUser = null;

  try {
    const rawUser = localStorage.getItem(USER_KEY) || localStorage.getItem(LEGACY_USER_KEY);
    if (rawUser) currentUser = JSON.parse(rawUser);
  } catch (e) {
    currentUser = null;
  }

  function getApiBaseUrl() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://127.0.0.1:8787';
    }
    return window.location.origin;
  }

  function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }
    return headers;
  }

  function setSession(user, token) {
    currentUser = user;
    currentToken = token;
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);

    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);

    updateGlobalAuthUI();
  }

  function updateGlobalAuthUI() {
    const hubUserInfo = document.getElementById('hub-user-info');
    const courtledgerUserInfo = document.getElementById('courtledger-user-info');
    const advancemanagerUserInfo = document.getElementById('advancemanager-user-info');
    const courtledgerAdminSection = document.getElementById('courtledger-admin-settings-section');

    const isLoggedIn = !!currentUser && !!currentToken;
    const isAdmin = isLoggedIn && currentUser.role === 'admin';

    // 1. Sync User Info in settings dropdowns
    const userInfoHtml = (isLoggedIn && currentUser) ? `
      <div style="font-weight:600; color:var(--text-primary); margin-bottom:2px;">${currentUser.name || '未设名'}</div>
      <div style="font-size:0.78rem; color:var(--text-secondary); word-break:break-all;">${currentUser.email}</div>
    ` : '';

    if (hubUserInfo) hubUserInfo.innerHTML = userInfoHtml;
    if (courtledgerUserInfo) courtledgerUserInfo.innerHTML = userInfoHtml;
    if (advancemanagerUserInfo) advancemanagerUserInfo.innerHTML = userInfoHtml;

    // 2. Hub Admin Console App Card (Visible FIRST on Hub if isAdmin)
    const hubAdminCard = document.getElementById('hub-admin-card');
    if (hubAdminCard) {
      if (isAdmin) {
        hubAdminCard.classList.remove('hidden');
      } else {
        hubAdminCard.classList.add('hidden');
      }
    }

    // 3. Court Ledger Admin settings menu item (visible in Court Ledger when isAdmin)
    if (courtledgerAdminSection) {
      if (isAdmin) {
        courtledgerAdminSection.classList.remove('hidden');
      } else {
        courtledgerAdminSection.classList.add('hidden');
      }
    }
  }

  async function initAuth() {
    updateGlobalAuthUI();
    if (!currentToken) return null;

    try {
      const response = await fetch(getApiBaseUrl() + '/api/auth/me', {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.user) {
          currentUser = data.user;
          localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
          updateGlobalAuthUI();
          return currentUser;
        }
      }
    } catch (err) {
      console.warn('⚠️ Server auth validation failed, using cached session:', err.message);
    }
    return currentUser;
  }

  async function login(accountOrEmail, password) {
    const response = await fetch(getApiBaseUrl() + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: accountOrEmail, password })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || '登录失败');
    }

    setSession(data.user, data.token);
    return data.user;
  }

  async function register(email, password, name) {
    const response = await fetch(getApiBaseUrl() + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || '注册失败');
    }

    setSession(data.user, data.token);
    return data.user;
  }

  async function updateProfile(profileData) {
    const response = await fetch(getApiBaseUrl() + '/api/auth/profile', {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(profileData)
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || '更新个人资料失败');
    }

    setSession(data.user, data.token || currentToken);
    return data.user;
  }

  function logout() {
    setSession(null, null);
    if (window.AppRouter && typeof window.AppRouter.switchView === 'function') {
      window.AppRouter.switchView('login');
    } else {
      window.location.hash = 'login';
    }
  }

  window.AuthManager = {
    initAuth,
    login,
    register,
    updateProfile,
    logout,
    getAuthHeaders,
    get token() { return currentToken; },
    get user() { return currentUser; },
    get isLoggedIn() { return !!currentToken && !!currentUser; },
    get isAdmin() { return !!currentUser && currentUser.role === 'admin'; },
    updateGlobalAuthUI
  };
})();
