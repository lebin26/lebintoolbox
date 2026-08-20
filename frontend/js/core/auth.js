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
    const isManager = isLoggedIn && currentUser.role === 'manager';
    const hasAdminAccess = isAdmin || isManager;

    // 1. Sync User Info in settings dropdowns
    const userInfoHtml = (isLoggedIn && currentUser) ? `
      <div style="font-weight:600; color:var(--text-primary); margin-bottom:2px;">${currentUser.name || '未设名'}</div>
      <div style="font-size:0.78rem; color:var(--text-secondary); word-break:break-all;">${currentUser.email}</div>
      <div style="font-size:0.72rem; margin-top:2px; font-weight:600; color:${isAdmin ? 'var(--accent)' : isManager ? '#8b5cf6' : 'var(--text-muted)'};">
        ${isAdmin ? '👑 超级管理员 (Admin)' : isManager ? '🛡️ 二级管理员 (Manager)' : '👤 普通用户'}
      </div>
    ` : '';

    if (hubUserInfo) hubUserInfo.innerHTML = userInfoHtml;
    if (courtledgerUserInfo) courtledgerUserInfo.innerHTML = userInfoHtml;
    if (advancemanagerUserInfo) advancemanagerUserInfo.innerHTML = userInfoHtml;

    // Helper functions for card locked overlay
    function setLockedOverlay(cardEl, label = '暂未开通访问') {
      if (!cardEl) return;
      let overlay = cardEl.querySelector('.locked-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'locked-overlay';
        cardEl.appendChild(overlay);
      }
      overlay.innerHTML = `
        <div class="locked-icon-badge">🔒</div>
        <span class="locked-text">${label}</span>
      `;
    }

    function removeLockedOverlay(cardEl) {
      if (!cardEl) return;
      const overlay = cardEl.querySelector('.locked-overlay');
      if (overlay) overlay.remove();
    }

    // 2. Hub Admin Console App Card (Visible on Hub for Admin / Manager only)
    // Regular users NEVER see the Admin Console card at all
    const hubAdminCard = document.getElementById('hub-admin-card');
    if (hubAdminCard) {
      if (!isAdmin && !isManager) {
        // Completely hide for standard users
        hubAdminCard.classList.add('hidden');
        hubAdminCard.classList.remove('is-locked');
        removeLockedOverlay(hubAdminCard);
      } else {
        hubAdminCard.classList.remove('hidden');
        const hasAdminAccess = hasAppAccess('admin');
        if (hasAdminAccess) {
          hubAdminCard.classList.remove('is-locked');
          removeLockedOverlay(hubAdminCard);
        } else {
          // Admin / Manager who was explicitly disabled from accessing admin console
          hubAdminCard.classList.add('is-locked');
          setLockedOverlay(hubAdminCard, 'Admin Console 未授权');
        }
      }
    }

    // 3. Court Ledger App Card Lock / Active State
    const clCard = document.getElementById('hub-card-courtledger');
    const clBadge = document.getElementById('hub-badge-courtledger');
    const hasCLAccess = hasAppAccess('courtledger');
    if (clCard) {
      if (hasCLAccess) {
        clCard.classList.remove('is-locked');
        removeLockedOverlay(clCard);
        if (clBadge) {
          clBadge.textContent = 'ACTIVE';
          clBadge.className = 'shortcut-pill-badge';
          clBadge.style.background = '';
          clBadge.style.color = '';
          clBadge.style.borderColor = '';
        }
      } else {
        clCard.classList.add('is-locked');
        setLockedOverlay(clCard, '暂无访问权限 (点击查看)');
        if (clBadge) {
          clBadge.textContent = '🔒 未授权';
          clBadge.className = 'shortcut-pill-badge';
          clBadge.style.background = 'rgba(255, 69, 58, 0.15)';
          clBadge.style.color = 'var(--danger, #ff453a)';
          clBadge.style.borderColor = 'rgba(255, 69, 58, 0.3)';
        }
      }
    }

    // 4. Advance Manager App Card Lock / Active State
    const amCard = document.getElementById('hub-card-advancemanager');
    const amBadge = document.getElementById('hub-badge-advancemanager');
    const hasAMAccess = hasAppAccess('advancemanager');
    if (amCard) {
      if (hasAMAccess) {
        amCard.classList.remove('is-locked');
        removeLockedOverlay(amCard);
        if (amBadge) {
          amBadge.textContent = 'ACTIVE';
          amBadge.className = 'shortcut-pill-badge';
          amBadge.style.background = 'rgba(16, 185, 129, 0.15)';
          amBadge.style.color = '#10b981';
          amBadge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        }
      } else {
        amCard.classList.add('is-locked');
        setLockedOverlay(amCard, '暂无访问权限 (点击查看)');
        if (amBadge) {
          amBadge.textContent = '🔒 未授权';
          amBadge.className = 'shortcut-pill-badge';
          amBadge.style.background = 'rgba(255, 69, 58, 0.15)';
          amBadge.style.color = 'var(--danger, #ff453a)';
          amBadge.style.borderColor = 'rgba(255, 69, 58, 0.3)';
        }
      }
    }

    // 5. Court Ledger Admin settings menu item (visible in Court Ledger when admin or manager)
    if (courtledgerAdminSection) {
      if (isAdmin || isManager) {
        courtledgerAdminSection.classList.remove('hidden');
      } else {
        courtledgerAdminSection.classList.add('hidden');
      }
    }
  }

  function hasAppAccess(appId) {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (appId === 'admin') {
      if (currentUser.role !== 'admin' && currentUser.role !== 'manager') return false;
      const apps = Array.isArray(currentUser.allowedApps) ? currentUser.allowedApps : ['courtledger', 'advancemanager', 'admin'];
      return apps.includes('admin');
    }
    const apps = Array.isArray(currentUser.allowedApps) ? currentUser.allowedApps : ['courtledger', 'advancemanager'];
    return apps.includes(appId);
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

  function hasActionPermission(permKey) {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    const perms = Array.isArray(currentUser.appPermissions) ? currentUser.appPermissions : [];
    return perms.includes(permKey);
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
    get isManager() { return !!currentUser && currentUser.role === 'manager'; },
    get hasAdminAccess() { return !!currentUser && (currentUser.role === 'admin' || currentUser.role === 'manager'); },
    hasAppAccess,
    hasActionPermission,
    updateGlobalAuthUI
  };
})();
