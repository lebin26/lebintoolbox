/**
 * OmniBox Frontend Authentication & User State Controller
 * Handles Login/Register Modal, JWT Token persistence, Automatic Fetch Interception, and User Profile Dropdown.
 * Supports Cloudflare Worker backend with graceful Local Offline Fallback.
 */

(function () {
  const TOKEN_KEY = 'omnibox_auth_token';
  const LOCAL_USERS_KEY = 'omnibox_local_users';

  // Resolve API Base URL consistently
  function resolveApiBaseUrl() {
    if (window.WORKER_API_URL) return window.WORKER_API_URL.replace(/\/$/, '');
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      if (window.location.port === '8787') return '';
      return 'http://127.0.0.1:8787';
    }
    if (window.location.hostname.endsWith('workers.dev') || window.location.hostname.endsWith('pages.dev')) {
      return '';
    }
    return 'https://hostcalculator-worker.lebin2626.workers.dev';
  }
  window.getApiBaseUrl = resolveApiBaseUrl;

  // Local Offline User Store Helper
  function getLocalUsers() {
    try {
      const raw = localStorage.getItem(LOCAL_USERS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    // Seed default admin user lebin2626@gmail.com
    const defaultList = [
      {
        id: 1,
        username: 'lebin2626@gmail.com',
        password: '12141214@Aa',
        role: 'admin',
        status: 'active',
        nickname: 'Lebin',
        avatarUrl: null,
        allowedApps: ['courtledger', 'financial'],
        appPermissions: ['courtledger:create_bill', 'courtledger:delete_bill', 'financial:manage', 'admin:manage']
      }
    ];
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(defaultList));
    return defaultList;
  }

  function saveLocalUsers(list) {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(list));
  }

  const Auth = {
    currentUser: null,
    token: localStorage.getItem(TOKEN_KEY) || null,

    // Check login state
    isLoggedIn() {
      return !!this.currentUser;
    },

    isAdmin() {
      return this.isLoggedIn() && this.currentUser.role === 'admin';
    },

    // Initialize Auth state
    async init() {
      this.setupFetchInterceptor();
      this.bindEvents();

      // Check stored user cache
      const cachedUser = localStorage.getItem('omnibox_current_user');
      if (cachedUser) {
        try {
          this.currentUser = JSON.parse(cachedUser);
        } catch (e) {}
      }

      if (this.token) {
        try {
          const baseUrl = getApiBaseUrl();
          const res = await fetch(`${baseUrl}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.authenticated && data.user) {
              this.currentUser = data.user;
              localStorage.setItem('omnibox_current_user', JSON.stringify(data.user));
            }
          }
        } catch (e) {
          console.warn('[Auth] Remote server offline, continuing with local session:', e.message);
        }
      }

      this.updateHeaderUI();
      this.notifyAuthChange();
    },

    // Setup global fetch interceptor to automatically attach JWT Bearer token
    setupFetchInterceptor() {
      const originalFetch = window.fetch;
      const self = this;

      window.fetch = async function (resource, init = {}) {
        const urlStr = typeof resource === 'string' ? resource : (resource && resource.url ? resource.url : '');

        if (urlStr.includes('/api/')) {
          init.headers = init.headers || {};
          if (self.token) {
            if (init.headers instanceof Headers) {
              if (!init.headers.has('Authorization')) {
                init.headers.set('Authorization', `Bearer ${self.token}`);
              }
            } else if (Array.isArray(init.headers)) {
              init.headers.push(['Authorization', `Bearer ${self.token}`]);
            } else {
              if (!init.headers['Authorization']) {
                init.headers['Authorization'] = `Bearer ${self.token}`;
              }
            }
          }
        }

        try {
          const response = await originalFetch(resource, init);
          return response;
        } catch (err) {
          // Pass error along
          throw err;
        }
      };
    },

    // Store Session
    setSession(user, token) {
      this.currentUser = user;
      this.token = token;
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
      if (user) {
        localStorage.setItem('omnibox_current_user', JSON.stringify(user));
      } else {
        localStorage.removeItem('omnibox_current_user');
      }
      this.updateHeaderUI();
      this.notifyAuthChange();
    },

    clearSession() {
      this.currentUser = null;
      this.token = null;
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('omnibox_current_user');
      this.updateHeaderUI();
      this.notifyAuthChange();
    },

    notifyAuthChange() {
      window.dispatchEvent(new CustomEvent('auth:change', {
        detail: { user: this.currentUser, isLoggedIn: this.isLoggedIn(), isAdmin: this.isAdmin() }
      }));
    },

    // Helper to normalize user payload from API
    normalizeUser(rawUser) {
      if (!rawUser) return null;
      return {
        id: rawUser.id,
        username: rawUser.username || rawUser.email || rawUser.name || 'User',
        nickname: rawUser.nickname || rawUser.name || rawUser.username || rawUser.email || 'User',
        avatarUrl: rawUser.avatarUrl || rawUser.avatar || null,
        role: rawUser.role || 'user',
        status: rawUser.status || 'active',
        allowedApps: rawUser.allowedApps ? (typeof rawUser.allowedApps === 'string' ? JSON.parse(rawUser.allowedApps) : rawUser.allowedApps) : ['courtledger', 'financial'],
        appPermissions: rawUser.appPermissions ? (typeof rawUser.appPermissions === 'string' ? JSON.parse(rawUser.appPermissions) : rawUser.appPermissions) : []
      };
    },

    // Login API Call with Local Fallback
    async login(username, password) {
      const baseUrl = resolveApiBaseUrl();
      const uName = username ? username.trim() : '';

      try {
        const res = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: uName,
            account: uName,
            email: uName,
            password: password
          })
        });

        const data = await res.json();
        if (res.ok) {
          const userObj = this.normalizeUser(data.user);
          this.setSession(userObj, data.token);
          return { ...data, user: userObj };
        } else {
          throw new Error(data.error || '用户名或密码错误');
        }
      } catch (err) {
        // If network failed (e.g. Failed to fetch), try Local Offline Authentication
        if (err.message.includes('fetch') || err.name === 'TypeError' || err.message.includes('NetworkError')) {
          console.warn('[Auth Login] Backend offline, falling back to local user verify');
          const localUsers = getLocalUsers();
          const found = localUsers.find(u => u.username.toLowerCase() === uName.toLowerCase());

          if (found) {
            if (found.password === password || (found.username === 'lebin2626@gmail.com' && password === '12141214@Aa')) {
              const mockToken = `local_jwt_${found.id}_${Date.now()}`;
              const userObj = this.normalizeUser(found);
              this.setSession(userObj, mockToken);
              return { user: userObj, token: mockToken, isOffline: true };
            }
          }
          throw new Error('用户名或密码错误（离线模式）');
        }
        throw err;
      }
    },

    // Register API Call with Local Fallback
    async register(username, password, nickname) {
      const baseUrl = resolveApiBaseUrl();
      const uName = username ? username.trim() : '';
      const nick = nickname && nickname.trim() ? nickname.trim() : uName;

      try {
        const res = await fetch(`${baseUrl}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: uName,
            account: uName,
            email: uName,
            nickname: nick,
            name: nick,
            password: password
          })
        });

        const data = await res.json();
        if (res.ok) {
          const userObj = this.normalizeUser(data.user);
          this.setSession(userObj, data.token);
          return { ...data, user: userObj };
        } else {
          throw new Error(data.error || '注册失败');
        }
      } catch (err) {
        if (err.message.includes('fetch') || err.name === 'TypeError' || err.message.includes('NetworkError')) {
          console.warn('[Auth Register] Backend offline, registering in local store');
          const localUsers = getLocalUsers();
          if (localUsers.some(u => u.username.toLowerCase() === uName.toLowerCase())) {
            throw new Error('该用户名已被注册');
          }
          const isFirst = localUsers.length === 0;
          const newUser = {
            id: Date.now(),
            username: uName,
            password,
            role: isFirst ? 'admin' : 'user',
            status: 'active',
            nickname: nick,
            avatarUrl: null,
            allowedApps: ['courtledger', 'financial'],
            appPermissions: ['courtledger:create_bill', 'courtledger:delete_bill', 'financial:manage']
          };
          localUsers.push(newUser);
          saveLocalUsers(localUsers);

          const mockToken = `local_jwt_${newUser.id}_${Date.now()}`;
          const userObj = this.normalizeUser(newUser);
          this.setSession(userObj, mockToken);
          return { user: userObj, token: mockToken, isOffline: true };
        }
        throw err;
      }
    },

    // Logout API Call
    async logout() {
      try {
        const baseUrl = resolveApiBaseUrl();
        await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' });
      } catch (e) {}
      this.clearSession();
      if (typeof window.showToast === 'function') {
        window.showToast('已安全登出');
      }
    },

    // Update Profile
    async updateProfile(payload) {
      const baseUrl = getApiBaseUrl();
      try {
        const res = await fetch(`${baseUrl}/api/auth/profile`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const data = await res.json();
          if (data.user && data.token) {
            this.setSession(data.user, data.token);
          }
          return data;
        }
      } catch (err) {}

      // Local fallback profile update
      if (this.currentUser) {
        this.currentUser.nickname = payload.nickname || this.currentUser.nickname;
        this.currentUser.avatarUrl = payload.avatarUrl !== undefined ? payload.avatarUrl : this.currentUser.avatarUrl;
        this.setSession(this.currentUser, this.token);
        return { user: this.currentUser, token: this.token };
      }
      throw new Error('更新失败');
    },

    // Page View Controls (#view-auth)
    switchPageTab(tab = 'login') {
      const isLogin = tab === 'login';
      const loginTabBtn = document.getElementById('auth-page-tab-login');
      const regTabBtn = document.getElementById('auth-page-tab-register');
      const submitBtn = document.getElementById('auth-page-submit-btn');
      const nickGroup = document.getElementById('auth-page-nick-group');
      const form = document.getElementById('auth-page-form');

      if (loginTabBtn) loginTabBtn.classList.toggle('active', isLogin);
      if (regTabBtn) regTabBtn.classList.toggle('active', !isLogin);
      if (nickGroup) nickGroup.classList.toggle('hidden', isLogin);

      if (submitBtn) {
        submitBtn.innerHTML = isLogin ? '<span>🚀</span> <span>立即登录进入系统</span>' : '<span>✨</span> <span>立即创建并登录账号</span>';
      }
      if (form) {
        form.setAttribute('data-mode', tab);
      }
    },

    togglePasswordVisibility(inputId) {
      const input = document.getElementById(inputId);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
    },

    quickFillAdmin() {
      const userInp = document.getElementById('auth-page-user-input');
      const passInp = document.getElementById('auth-page-pass-input');
      if (userInp) userInp.value = 'lebin2626@gmail.com';
      if (passInp) passInp.value = '12141214@Aa';
      if (typeof window.showToast === 'function') {
        window.showToast('⚡ 已填入管理员账号与密码');
      }
    },

    // Modal Controls
    openLoginModal(mode = 'login') {
      if (window.AppRouter && typeof window.AppRouter.switchView === 'function') {
        window.AppRouter.switchView('auth');
        this.switchPageTab(mode);
        return;
      }
      const modal = document.getElementById('auth-modal');
      if (!modal) return;

      this.switchModalTab(mode);
      modal.classList.remove('hidden');
      document.body.classList.add('modal-open');

      const userInp = document.getElementById('auth-username-input');
      if (userInp) setTimeout(() => userInp.focus(), 100);
    },

    closeLoginModal() {
      const modal = document.getElementById('auth-modal');
      if (modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('modal-open');
      }
    },

    switchModalTab(tab = 'login') {
      const isLogin = tab === 'login';
      const loginTabBtn = document.getElementById('auth-tab-login');
      const regTabBtn = document.getElementById('auth-tab-register');
      const submitBtn = document.getElementById('auth-submit-btn');
      const titleEl = document.getElementById('auth-modal-title');
      const nicknameGroup = document.getElementById('auth-nickname-group');
      const form = document.getElementById('auth-form');

      if (loginTabBtn) loginTabBtn.classList.toggle('active', isLogin);
      if (regTabBtn) regTabBtn.classList.toggle('active', !isLogin);
      if (nicknameGroup) nicknameGroup.classList.toggle('hidden', isLogin);

      if (submitBtn) {
        submitBtn.innerHTML = isLogin ? '<span>🚀</span> <span>立即登录</span>' : '<span>✨</span> <span>创建并登录账号</span>';
      }
      if (titleEl) {
        titleEl.textContent = isLogin ? '用户登录' : '新用户注册';
      }
      if (form) {
        form.setAttribute('data-mode', tab);
      }
    },

    // Update Top Header Navigation User Bar
    updateHeaderUI() {
      const authArea = document.getElementById('header-auth-area');
      if (!authArea) return;

      if (this.isLoggedIn()) {
        const u = this.currentUser;
        const roleBadge = u.role === 'admin' 
          ? `<span class="auth-role-badge badge-admin" title="系统管理员">ADMIN</span>`
          : `<span class="auth-role-badge badge-user">USER</span>`;
        const avatar = u.avatarUrl 
          ? `<img src="${u.avatarUrl}" class="auth-header-avatar" alt="">`
          : `<span class="auth-header-avatar-placeholder">${(u.nickname || u.username).charAt(0).toUpperCase()}</span>`;

        authArea.innerHTML = `
          <div class="auth-user-dropdown-container">
            <button type="button" class="auth-user-btn" id="auth-user-menu-btn" title="点击展开用户中心">
              ${avatar}
              <span class="auth-user-name">${u.nickname || u.username}</span>
              ${roleBadge}
              <span class="auth-caret">▾</span>
            </button>
            <div class="auth-dropdown-menu hidden" id="auth-dropdown-menu">
              <div class="auth-dropdown-header">
                <div style="font-weight:700; color:var(--text-primary); font-size:0.92rem;">${u.nickname || u.username}</div>
                <div style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono); word-break:break-all;">@${u.username}</div>
              </div>
              <div class="auth-dropdown-divider"></div>
              <button type="button" class="auth-dropdown-item" onclick="Auth.openProfileModal()">
                <span>👤</span> <span>个人资料与安全</span>
              </button>
              <button type="button" class="auth-dropdown-item" onclick="FinancialUI.openTemplateMarketModal()">
                <span>🏛️</span> <span>平台/Logo 预设模板库</span>
              </button>
              ${u.role === 'admin' ? `
                <button type="button" class="auth-dropdown-item" onclick="Auth.openAdminUsersModal()">
                  <span>👑</span> <span>用户与权限管理</span>
                </button>
              ` : ''}
              <div class="auth-dropdown-divider"></div>
              <button type="button" class="auth-dropdown-item auth-item-danger" onclick="Auth.logout()">
                <span>🚪</span> <span>退出登录</span>
              </button>
            </div>
          </div>
        `;

        const menuBtn = document.getElementById('auth-user-menu-btn');
        const menu = document.getElementById('auth-dropdown-menu');
        if (menuBtn && menu) {
          menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('hidden');
          });
        }
      } else {
        authArea.innerHTML = `
          <button type="button" class="auth-btn-login-trigger" onclick="Auth.openLoginModal('login')">
            <span>👤</span>
            <span>登录 / 注册</span>
          </button>
        `;
      }
    },

    bindEvents() {
      // Close dropdowns on outside click
      document.addEventListener('click', () => {
        const menu = document.getElementById('auth-dropdown-menu');
        if (menu) menu.classList.add('hidden');
      });

      // Bind Page Auth Form Submission (#auth-page-form)
      const pageForm = document.getElementById('auth-page-form');
      if (pageForm) {
        pageForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const mode = pageForm.getAttribute('data-mode') || 'login';
          const username = document.getElementById('auth-page-user-input').value;
          const password = document.getElementById('auth-page-pass-input').value;
          const nickname = document.getElementById('auth-page-nick-input')?.value;

          const submitBtn = document.getElementById('auth-page-submit-btn');
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.6';
          }

          try {
            if (mode === 'login') {
              const res = await this.login(username, password);
              if (typeof window.showToast === 'function') {
                window.showToast(`🎉 欢迎回来，${this.currentUser.nickname || this.currentUser.username}！`);
              }
            } else {
              const res = await this.register(username, password, nickname);
              if (typeof window.showToast === 'function') {
                window.showToast(`🎉 注册成功！欢迎加入 OmniBox`);
              }
            }
            pageForm.reset();
          } catch (err) {
            if (typeof window.showToast === 'function') {
              window.showToast(`❌ ${err.message}`);
            } else {
              alert(err.message);
            }
          } finally {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.style.opacity = '';
            }
          }
        });
      }

      // Bind Modal Auth Form Submission (#auth-form)
      const form = document.getElementById('auth-form');
      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const mode = form.getAttribute('data-mode') || 'login';
          const username = document.getElementById('auth-username-input').value;
          const password = document.getElementById('auth-password-input').value;
          const nickname = document.getElementById('auth-nickname-input')?.value;

          const submitBtn = document.getElementById('auth-submit-btn');
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.6';
          }

          try {
            if (mode === 'login') {
              const res = await this.login(username, password);
              if (typeof window.showToast === 'function') {
                window.showToast(`🎉 欢迎回来，${this.currentUser.nickname || this.currentUser.username}！`);
              }
            } else {
              const res = await this.register(username, password, nickname);
              if (typeof window.showToast === 'function') {
                window.showToast(`🎉 注册成功！欢迎加入 OmniBox`);
              }
            }
            this.closeLoginModal();
            form.reset();
          } catch (err) {
            if (typeof window.showToast === 'function') {
              window.showToast(`❌ ${err.message}`);
            } else {
              alert(err.message);
            }
          } finally {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.style.opacity = '';
            }
          }
        });
      }

      // Bind Profile Form Submission
      const profileForm = document.getElementById('auth-profile-form');
      if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const nickname = document.getElementById('profile-nickname-input').value;
          const avatarUrl = document.getElementById('profile-avatar-input').value;
          const oldPassword = document.getElementById('profile-old-pass-input').value;
          const newPassword = document.getElementById('profile-new-pass-input').value;

          try {
            const payload = { nickname, avatarUrl };
            if (newPassword) {
              payload.oldPassword = oldPassword;
              payload.newPassword = newPassword;
            }
            await this.updateProfile(payload);
            if (typeof window.showToast === 'function') window.showToast('✅ 资料已保存更新');
            this.closeProfileModal();
          } catch (err) {
            if (typeof window.showToast === 'function') window.showToast(`❌ ${err.message}`);
          }
        });
      }
    },

    openProfileModal() {
      const modal = document.getElementById('auth-profile-modal');
      if (!modal || !this.currentUser) return;

      const u = this.currentUser;
      const nickInp = document.getElementById('profile-nickname-input');
      const userInp = document.getElementById('profile-username-display');
      const avatarInp = document.getElementById('profile-avatar-input');
      const roleDisplay = document.getElementById('profile-role-display');

      if (nickInp) nickInp.value = u.nickname || '';
      if (userInp) userInp.textContent = u.username;
      if (avatarInp) avatarInp.value = u.avatarUrl || '';
      if (roleDisplay) roleDisplay.textContent = u.role === 'admin' ? '系统管理员 (Admin)' : '标准用户 (User)';

      modal.classList.remove('hidden');
      document.body.classList.add('modal-open');
    },

    closeProfileModal() {
      const modal = document.getElementById('auth-profile-modal');
      if (modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('modal-open');
      }
    },

    // Admin Users Management Modal
    async openAdminUsersModal() {
      const modal = document.getElementById('admin-users-modal');
      if (!modal || !this.isAdmin()) return;

      modal.classList.remove('hidden');
      document.body.classList.add('modal-open');
      await this.loadAdminUsersList();
    },

    closeAdminUsersModal() {
      const modal = document.getElementById('admin-users-modal');
      if (modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('modal-open');
      }
    },

    async loadAdminUsersList() {
      const listContainer = document.getElementById('admin-users-list-tbody');
      if (!listContainer) return;

      listContainer.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">正在加载用户列表...</td></tr>`;

      try {
        const baseUrl = resolveApiBaseUrl();
        const res = await fetch(`${baseUrl}/api/admin/users`);
        if (res.ok) {
          const data = await res.json();
          if (data.users && data.users.length > 0) {
            this.renderUsersTable(data.users, listContainer);
            return;
          }
        }
      } catch (err) {}

      // Local fallback
      const localUsers = getLocalUsers();
      this.renderUsersTable(localUsers, listContainer);
    },

    renderUsersTable(users, listContainer) {
      if (!users || users.length === 0) {
        listContainer.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">暂无其他注册用户</td></tr>`;
        return;
      }

      let html = '';
      users.forEach(u => {
        const roleBadge = u.role === 'admin' ? '<span class="auth-role-badge badge-admin">ADMIN</span>' : '<span class="auth-role-badge badge-user">USER</span>';
        const statusBadge = u.status === 'active' ? '<span style="color:#10b981; font-weight:700;">正常</span>' : '<span style="color:#ef4444; font-weight:700;">冻结</span>';
        const created = (u.createdAt || u.created_at || new Date().toISOString()).slice(0, 10);

        html += `
          <tr style="border-bottom:1px solid var(--border-subtle);">
            <td style="padding:10px 8px; font-weight:600; color:var(--text-primary);">${u.id}</td>
            <td style="padding:10px 8px;">
              <div style="font-weight:700; color:var(--text-primary);">${u.nickname || u.username}</div>
              <div style="font-size:0.75rem; color:var(--text-muted);">@${u.username}</div>
            </td>
            <td style="padding:10px 8px;">${roleBadge}</td>
            <td style="padding:10px 8px;">${statusBadge}</td>
            <td style="padding:10px 8px; font-size:0.8rem; color:var(--text-muted);">${created}</td>
            <td style="padding:10px 8px;">
              <div style="display:flex; gap:6px;">
                <button type="button" class="fin-btn-sm" onclick="Auth.toggleUserRole(${u.id}, '${u.role}')" title="切换角色">
                  ${u.role === 'admin' ? '降为User' : '升为Admin'}
                </button>
                <button type="button" class="fin-btn-sm ${u.status === 'active' ? 'danger' : ''}" onclick="Auth.toggleUserStatus(${u.id}, '${u.status}')">
                  ${u.status === 'active' ? '冻结' : '解冻'}
                </button>
              </div>
            </td>
          </tr>
        `;
      });
      listContainer.innerHTML = html;
    },

    async toggleUserRole(userId, currentRole) {
      const newRole = currentRole === 'admin' ? 'user' : 'admin';
      if (!confirm(`确认将用户 ID:${userId} 的角色切换为 ${newRole} 吗？`)) return;

      try {
        const baseUrl = resolveApiBaseUrl();
        const res = await fetch(`${baseUrl}/api/admin/users/${userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: newRole })
        });
        if (res.ok) {
          if (typeof window.showToast === 'function') window.showToast('✅ 角色已更新');
          await this.loadAdminUsersList();
          return;
        }
      } catch (err) {}

      // Local fallback
      const localUsers = getLocalUsers();
      const user = localUsers.find(u => Number(u.id) === Number(userId));
      if (user) {
        user.role = newRole;
        saveLocalUsers(localUsers);
        if (typeof window.showToast === 'function') window.showToast('✅ 角色已更新 (本地模式)');
        await this.loadAdminUsersList();
      }
    },

    async toggleUserStatus(userId, currentStatus) {
      const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
      if (!confirm(`确认将用户 ID:${userId} 的状态修改为 ${newStatus} 吗？`)) return;

      try {
        const baseUrl = resolveApiBaseUrl();
        const res = await fetch(`${baseUrl}/api/admin/users/${userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
        if (res.ok) {
          if (typeof window.showToast === 'function') window.showToast('✅ 用户状态已更新');
          await this.loadAdminUsersList();
          return;
        }
      } catch (err) {}

      // Local fallback
      const localUsers = getLocalUsers();
      const user = localUsers.find(u => Number(u.id) === Number(userId));
      if (user) {
        user.status = newStatus;
        saveLocalUsers(localUsers);
        if (typeof window.showToast === 'function') window.showToast('✅ 用户状态已更新 (本地模式)');
        await this.loadAdminUsersList();
      }
    }
  };

  window.Auth = Auth;

  // Auto initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Auth.init());
  } else {
    Auth.init();
  }
})();
