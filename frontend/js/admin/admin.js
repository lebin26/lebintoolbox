/**
 * OmniBox - Admin Management Module
 * Connects to Cloudflare Worker /api/admin/* endpoints for Overview, Users Management, and Audit Trail.
 */

(function () {
  function getApiBaseUrl() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://127.0.0.1:8787';
    }
    return window.location.origin;
  }

  function getHeaders() {
    return window.AuthManager ? window.AuthManager.getAuthHeaders() : { 'Content-Type': 'application/json' };
  }

  // Active Admin Sub-Tab
  let activeTab = 'users';

  function initAdminUI() {
    const tabBtns = document.querySelectorAll('#admin-sidebar .admin-tab-btn');
    const tabPanels = document.querySelectorAll('#view-admin .admin-tab-panel');
    const adminSidebar = document.getElementById('admin-sidebar');
    const adminMobileBackdrop = document.getElementById('admin-mobile-backdrop');
    const headerMenuToggleBtn = document.getElementById('admin-menu-toggle-btn');
    const sidebarToggleBtn = document.getElementById('admin-sidebar-toggle-btn');
    const sidebarCloseBtn = document.getElementById('admin-sidebar-close-btn');
    const adminLayoutWrapper = document.querySelector('#view-admin .admin-layout-wrapper');

    function isMobileView() {
      return window.innerWidth <= 820;
    }

    function openMobileDrawer() {
      if (adminSidebar) adminSidebar.classList.add('mobile-open');
      if (adminMobileBackdrop) adminMobileBackdrop.classList.remove('hidden');
      document.body.classList.add('modal-open');
    }

    function closeMobileDrawer() {
      if (adminSidebar) adminSidebar.classList.remove('mobile-open');
      if (adminMobileBackdrop) adminMobileBackdrop.classList.add('hidden');
      document.body.classList.remove('modal-open');
    }

    function toggleDesktopSidebar() {
      if (!adminSidebar) return;
      const willCollapse = !adminSidebar.classList.contains('collapsed');
      adminSidebar.classList.toggle('collapsed', willCollapse);
      if (adminLayoutWrapper) adminLayoutWrapper.classList.toggle('sidebar-collapsed', willCollapse);
      localStorage.setItem('omnibox_admin_sidebar_collapsed', willCollapse ? 'true' : 'false');
    }

    // Tab button selection
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        tabBtns.forEach(b => b.classList.toggle('active', b === btn));
        tabPanels.forEach(p => p.classList.toggle('hidden', p.id !== `admin-tab-${targetTab}`));
        activeTab = targetTab;
        loadActiveTabData();

        // On mobile, automatically close the drawer after picking a destination
        if (isMobileView()) {
          closeMobileDrawer();
        }
      });
    });

    if (adminSidebar) {
      // Restore persisted desktop state
      if (!isMobileView()) {
        const isCollapsed = localStorage.getItem('omnibox_admin_sidebar_collapsed') === 'true';
        if (isCollapsed) {
          adminSidebar.classList.add('collapsed');
          if (adminLayoutWrapper) adminLayoutWrapper.classList.add('sidebar-collapsed');
        }
      }

      // Top Header Hamburger Button (Open drawer on mobile / Toggle sidebar on desktop)
      if (headerMenuToggleBtn) {
        headerMenuToggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (isMobileView()) {
            if (adminSidebar.classList.contains('mobile-open')) {
              closeMobileDrawer();
            } else {
              openMobileDrawer();
            }
          } else {
            toggleDesktopSidebar();
          }
        });
      }

      // Sidebar Internal Toggle Button (Desktop)
      if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleDesktopSidebar();
        });
      }

      // Sidebar Close Button (Mobile)
      if (sidebarCloseBtn) {
        sidebarCloseBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          closeMobileDrawer();
        });
      }

      // Backdrop tap to dismiss
      if (adminMobileBackdrop) {
        adminMobileBackdrop.addEventListener('click', () => {
          closeMobileDrawer();
        });
      }
    }

    // User Search & Filter bindings
    const searchInput = document.getElementById('admin-user-search');
    const roleFilter = document.getElementById('admin-role-filter');
    const statusFilter = document.getElementById('admin-status-filter');

    if (searchInput) searchInput.addEventListener('input', debounce(loadUsersList, 300));
    if (roleFilter) roleFilter.addEventListener('change', loadUsersList);
    if (statusFilter) statusFilter.addEventListener('change', loadUsersList);

    // Court Ledger App Backend Buttons
    const btnOpenCourtledger = document.getElementById('admin-btn-open-courtledger');
    if (btnOpenCourtledger) {
      btnOpenCourtledger.addEventListener('click', () => {
        if (window.AppRouter) window.AppRouter.switchView('courtledger');
      });
    }

    const btnManageVenuesModal = document.getElementById('admin-btn-manage-venues-modal');
    if (btnManageVenuesModal) {
      btnManageVenuesModal.addEventListener('click', () => {
        if (!window.AuthManager.hasActionPermission('admin:manage_venues')) {
          if (typeof window.showToast === 'function') {
            window.showToast('⛔ 权限不足：您当前暂无【管理球场数据】的权限，请联系 Admin 开通！');
          }
          return;
        }

        const modal = document.getElementById('court-manage-modal');
        if (modal) {
          modal.classList.remove('hidden');
          document.body.classList.add('modal-open');
          if (window.CourtLedgerUI && typeof window.CourtLedgerUI.renderModalVenuesList === 'function') {
            window.CourtLedgerUI.renderModalVenuesList();
          }
        }
      });
    }

    const btnViewAllBills = document.getElementById('admin-btn-view-all-bills');
    if (btnViewAllBills) {
      btnViewAllBills.addEventListener('click', () => {
        if (window.AppRouter) window.AppRouter.switchView('historybills');
      });
    }

    // Admin Create User Modal Event Bindings
    const btnOpenCreateModal = document.getElementById('btn-open-create-user-modal');
    const createModal = document.getElementById('admin-create-user-modal');
    const btnCloseCreateModal = document.getElementById('btn-close-admin-create-user-modal');
    const btnCancelCreateModal = document.getElementById('btn-cancel-admin-create-user');
    const createUserForm = document.getElementById('admin-create-user-form');

    if (btnOpenCreateModal) {
      btnOpenCreateModal.addEventListener('click', () => {
        openAdminCreateUserModal();
      });
    }

    if (btnCloseCreateModal) btnCloseCreateModal.addEventListener('click', closeAdminCreateUserModal);
    if (btnCancelCreateModal) btnCancelCreateModal.addEventListener('click', closeAdminCreateUserModal);
    if (createModal) {
      createModal.addEventListener('click', (e) => {
        if (e.target === createModal) closeAdminCreateUserModal();
      });
    }

    if (createUserForm) {
      createUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('admin-create-user-email').value.trim();
        const name = document.getElementById('admin-create-user-name').value.trim();
        const password = document.getElementById('admin-create-user-password').value;
        const role = document.getElementById('admin-create-user-role').value;
        const status = document.getElementById('admin-create-user-status').value;

        const allowedApps = [];
        if (document.getElementById('admin-create-app-courtledger')?.checked) allowedApps.push('courtledger');
        if (document.getElementById('admin-create-app-advancemanager')?.checked) allowedApps.push('advancemanager');
        if (document.getElementById('admin-create-app-admin')?.checked) allowedApps.push('admin');

        const appPermissions = [];
        document.querySelectorAll('input[name="admin-create-perm"]:checked').forEach(cb => {
          appPermissions.push(cb.value);
        });

        if (!email || !name || !password) {
          if (typeof window.showToast === 'function') window.showToast('⚠️ 请填写完整的用户名、邮箱和密码');
          return;
        }

        if (password.length < 6) {
          if (typeof window.showToast === 'function') window.showToast('⚠️ 密码长度不能少于 6 位');
          return;
        }

        try {
          if (typeof window.showToast === 'function') window.showToast('⏳ 正在创建用户...');
          const response = await fetch(getApiBaseUrl() + '/api/admin/users', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ email, name, password, role, status, allowedApps, appPermissions })
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || '创建用户失败');

          if (typeof window.showToast === 'function') {
            window.showToast(`✅ ${data.message || '用户创建成功'}`);
          }
          closeAdminCreateUserModal();
          loadUsersList();
          loadUsersStats();
          if (activeTab === 'app-access') loadAppAccessStats();
        } catch (err) {
          if (typeof window.showToast === 'function') {
            window.showToast(`❌ 创建失败: ${err.message}`);
          }
        }
      });
    }

    // Admin Edit User Modal Event Bindings
    const editModal = document.getElementById('admin-edit-user-modal');
    const btnCloseEditModal = document.getElementById('btn-close-admin-edit-user-modal');
    const btnCancelEditModal = document.getElementById('btn-cancel-admin-edit-user');
    const editUserForm = document.getElementById('admin-edit-user-form');

    if (btnCloseEditModal) btnCloseEditModal.addEventListener('click', closeAdminEditUserModal);
    if (btnCancelEditModal) btnCancelEditModal.addEventListener('click', closeAdminEditUserModal);
    if (editModal) {
      editModal.addEventListener('click', (e) => {
        if (e.target === editModal) closeAdminEditUserModal();
      });
    }

    if (editUserForm) {
      editUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userId = document.getElementById('admin-edit-user-id').value;
        const email = document.getElementById('admin-edit-user-email').value.trim();
        const name = document.getElementById('admin-edit-user-name').value.trim();
        const password = document.getElementById('admin-edit-user-password').value;
        const role = document.getElementById('admin-edit-user-role').value;
        const status = document.getElementById('admin-edit-user-status').value;

        const allowedApps = [];
        if (document.getElementById('admin-edit-app-courtledger')?.checked) allowedApps.push('courtledger');
        if (document.getElementById('admin-edit-app-advancemanager')?.checked) allowedApps.push('advancemanager');
        if (document.getElementById('admin-edit-app-admin')?.checked) allowedApps.push('admin');

        const appPermissions = [];
        document.querySelectorAll('input[name="admin-edit-perm"]:checked').forEach(cb => {
          appPermissions.push(cb.value);
        });

        const updateData = { email, name, role, status, allowedApps, appPermissions };
        if (password && password.length > 0) {
          if (password.length < 6) {
            if (typeof window.showToast === 'function') window.showToast('❌ 密码长度不能少于 6 位');
            return;
          }
          updateData.password = password;
        }

        try {
          const response = await fetch(getApiBaseUrl() + `/api/admin/users/${userId}`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify(updateData)
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || '修改失败');

          if (typeof window.showToast === 'function') {
            window.showToast('✅ 用户信息修改成功');
          }
          closeAdminEditUserModal();
          loadUsersList();
          loadUsersStats();
          if (activeTab === 'app-access') loadAppAccessStats();
        } catch (err) {
          if (typeof window.showToast === 'function') {
            window.showToast(`❌ 修改失败: ${err.message}`);
          }
        }
      });
    }

    // Admin View User Bills Modal Event Bindings
    const userBillsModal = document.getElementById('admin-user-bills-modal');
    const btnCloseUserBillsModal = document.getElementById('btn-close-admin-user-bills-modal');
    const btnDoneUserBillsModal = document.getElementById('btn-done-admin-user-bills');

    if (btnCloseUserBillsModal) btnCloseUserBillsModal.addEventListener('click', closeAdminUserBillsModal);
    if (btnDoneUserBillsModal) btnDoneUserBillsModal.addEventListener('click', closeAdminUserBillsModal);
    if (userBillsModal) {
      userBillsModal.addEventListener('click', (e) => {
        if (e.target === userBillsModal) closeAdminUserBillsModal();
      });
    }
  }

  function debounce(fn, ms) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  async function loadActiveTabData() {
    if (!window.AuthManager || !window.AuthManager.hasAdminAccess) return;

    if (activeTab === 'users') {
      await loadUsersStats();
      await loadUsersList();
    } else if (activeTab === 'app-access') {
      await loadAppAccessStats();
    } else if (activeTab === 'app-courtledger') {
      await loadCourtLedgerBackendData();
    } else if (activeTab === 'logs') {
      await loadAuditLogs();
    }
  }

  async function loadUsersStats() {
    try {
      const response = await fetch(getApiBaseUrl() + '/api/admin/dashboard', { headers: getHeaders() });
      if (response.ok) {
        const data = await response.json();
        const totalUsersEl = document.getElementById('admin-stat-total-users');
        const activeUsersEl = document.getElementById('admin-stat-active-users');
        const suspendedUsersEl = document.getElementById('admin-stat-suspended-users');
        const adminUsersEl = document.getElementById('admin-stat-admin-users');

        const stats = data.stats || {};
        if (totalUsersEl) totalUsersEl.textContent = `${stats.totalUsers || 0} 人`;
        if (activeUsersEl) activeUsersEl.textContent = `${stats.activeUsers || 0} 人`;
        if (suspendedUsersEl) suspendedUsersEl.textContent = `${stats.suspendedUsers || 0} 人`;
        if (adminUsersEl) {
          const adm = stats.adminUsers || 0;
          const mgr = stats.managerUsers || 0;
          adminUsersEl.textContent = `${adm + mgr} 人 (主管 ${adm} / 协管 ${mgr})`;
        }
      }
    } catch (err) {
      console.error('Failed to load user stats:', err.message);
    }
  }

  async function loadUsersList() {
    const tableBody = document.getElementById('admin-users-tbody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:20px; color:var(--color-text-muted);">加载用户数据...</td></tr>';

    const search = document.getElementById('admin-user-search')?.value || '';
    const role = document.getElementById('admin-role-filter')?.value || 'all';
    const status = document.getElementById('admin-status-filter')?.value || 'all';

    try {
      const queryParams = new URLSearchParams({ search, role, status });
      const response = await fetch(getApiBaseUrl() + `/api/admin/users?${queryParams.toString()}`, { headers: getHeaders() });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || '获取用户列表失败');
      }
      const data = await response.json();
      const users = data.users || [];

      if (users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:20px; color:var(--color-text-muted);">未找到符合条件的用户</td></tr>';
        return;
      }

      const currentUser = window.AuthManager.user;
      const isSuperAdmin = currentUser && currentUser.role === 'admin';

      tableBody.innerHTML = '';
      users.forEach(u => {
        const tr = document.createElement('tr');
        const isCurrentSelf = currentUser && currentUser.id === u.id;
        const createdDate = u.createdAt ? new Date(u.createdAt).toLocaleDateString('zh-CN') : '--';
        const lastLoginDate = u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '未登录';
        const plainPwd = u.plainPassword || '';

        // Role Badge Styling
        let roleBadge = '';
        if (u.role === 'admin') {
          roleBadge = '<span class="status-badge" style="background:rgba(255,159,10,0.15); color:#ff9f0a; border:1px solid rgba(255,159,10,0.3); font-weight:600;">👑 Admin</span>';
        } else if (u.role === 'manager') {
          roleBadge = '<span class="status-badge" style="background:rgba(139,92,246,0.15); color:#8b5cf6; border:1px solid rgba(139,92,246,0.3); font-weight:600;">🛡️ Manager</span>';
        } else {
          roleBadge = '<span class="status-badge" style="background:rgba(255,255,255,0.06); color:var(--text-secondary); border:1px solid var(--border-subtle);">👤 User</span>';
        }

        // Allowed Apps Chips
        const allowedList = Array.isArray(u.allowedApps) ? u.allowedApps : ['courtledger', 'advancemanager'];
        let appsBadgesHtml = '<div style="display:flex; flex-wrap:wrap; gap:4px;">';
        if (allowedList.includes('courtledger')) {
          appsBadgesHtml += '<span class="status-badge" style="background:rgba(175,82,222,0.15); color:#af52de; border:1px solid rgba(175,82,222,0.3); font-size:0.7rem; padding:1px 5px;">🏸 羽球</span>';
        }
        if (allowedList.includes('advancemanager')) {
          appsBadgesHtml += '<span class="status-badge" style="background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3); font-size:0.7rem; padding:1px 5px;">🌴 垫付</span>';
        }
        if (allowedList.includes('admin')) {
          appsBadgesHtml += '<span class="status-badge" style="background:rgba(255,159,10,0.15); color:#ff9f0a; border:1px solid rgba(255,159,10,0.3); font-size:0.7rem; padding:1px 5px;">⚙️ 后台</span>';
        }
        if (allowedList.length === 0) {
          appsBadgesHtml += '<span class="status-badge" style="background:rgba(255,69,58,0.15); color:#ff453a; font-size:0.7rem; padding:1px 5px;">🔒 无权限</span>';
        }
        appsBadgesHtml += '</div>';

        // Action permissions based on hierarchy: Manager cannot touch Admin or other Managers
        const canManageThisUser = isSuperAdmin || (!isSuperAdmin && u.role === 'user');

        tr.innerHTML = `
          <td><strong>#${u.id}</strong></td>
          <td>
            <div class="user-cell-name">
              <span class="user-avatar-small">${u.role === 'admin' ? '👑' : u.role === 'manager' ? '🛡️' : '👤'}</span>
              <span>${u.name || '未设名'}</span>
              ${isCurrentSelf ? '<span class="tag-current-self">(当前登录)</span>' : ''}
            </div>
          </td>
          <td>${u.email}</td>
          <td>
            <div class="user-password-cell">
              <span class="user-pwd-text masked" data-pwd="${plainPwd}">••••••••</span>
              <button type="button" class="btn-toggle-pwd" title="查看/隐藏明文密码">👁️</button>
            </div>
          </td>
          <td>
            <select class="admin-table-select role-select" data-id="${u.id}" ${!isSuperAdmin ? 'disabled title="仅超级管理员可直接切换角色"' : ''}>
              <option value="user" ${u.role === 'user' ? 'selected' : ''}>👤 User (普通用户)</option>
              <option value="manager" ${u.role === 'manager' ? 'selected' : ''}>🛡️ Manager (二级管理员)</option>
              <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>👑 Admin (超级管理员)</option>
            </select>
          </td>
          <td>${appsBadgesHtml}</td>
          <td>
            <span class="status-badge status-${u.status}">${u.status === 'active' ? '🟢 正常' : '🔴 已冻结'}</span>
          </td>
          <td>${createdDate}</td>
          <td>${lastLoginDate}</td>
          <td>
            <div class="table-actions">
              <button type="button" class="btn-table-action btn-view-user-bills" data-id="${u.id}" data-name="${u.name || u.email}">📜 账单</button>
              ${canManageThisUser ? `
                <button type="button" class="btn-table-action btn-edit-user" data-id="${u.id}">✏️ 编辑</button>
                ${u.status === 'active' 
                  ? `<button type="button" class="btn-table-action btn-suspend" data-id="${u.id}" data-name="${u.name}">🧊 冻结</button>`
                  : `<button type="button" class="btn-table-action btn-activate" data-id="${u.id}" data-name="${u.name}">⚡ 激活</button>`
                }
                ${!isCurrentSelf ? `<button type="button" class="btn-table-action btn-delete-user" data-id="${u.id}" data-name="${u.name || u.email}" style="color:var(--danger,#ff453a); border-color:rgba(255,69,58,0.3);">🗑️ 删除</button>` : ''}
              ` : `
                <span style="font-size:0.75rem; color:var(--text-muted); padding:2px 6px;">🔒 超管保护</span>
              `}
            </div>
          </td>
        `;

        // View User Bills Modal Event
        const viewBillsBtn = tr.querySelector('.btn-view-user-bills');
        if (viewBillsBtn) {
          viewBillsBtn.addEventListener('click', () => {
            openAdminUserBillsModal(u.id, u.name || u.email);
          });
        }

        // Edit User Modal Event
        const editBtn = tr.querySelector('.btn-edit-user');
        if (editBtn) {
          editBtn.addEventListener('click', () => {
            openAdminEditUserModal(u);
          });
        }

        // Delete User Event
        const deleteBtn = tr.querySelector('.btn-delete-user');
        if (deleteBtn) {
          deleteBtn.addEventListener('click', async () => {
            await deleteUser(u.id, u.name || u.email);
          });
        }

        // Password Reveal Toggle Event
        const togglePwdBtn = tr.querySelector('.btn-toggle-pwd');
        const pwdTextSpan = tr.querySelector('.user-pwd-text');
        if (togglePwdBtn && pwdTextSpan) {
          togglePwdBtn.addEventListener('click', () => {
            const isMasked = pwdTextSpan.classList.contains('masked');
            if (isMasked) {
              pwdTextSpan.textContent = plainPwd || '（无记录）';
              pwdTextSpan.classList.remove('masked');
              pwdTextSpan.classList.add('revealed');
              togglePwdBtn.textContent = '🔒';
            } else {
              pwdTextSpan.textContent = '••••••••';
              pwdTextSpan.classList.remove('revealed');
              pwdTextSpan.classList.add('masked');
              togglePwdBtn.textContent = '👁️';
            }
          });
        }

        // Role Change Event
        const roleSel = tr.querySelector('.role-select');
        if (roleSel && !roleSel.disabled) {
          roleSel.addEventListener('change', async () => {
            const newRole = roleSel.value;
            await updateUserRoleOrStatus(u.id, { role: newRole });
          });
        }

        // Suspend / Activate Event
        const suspendBtn = tr.querySelector('.btn-suspend');
        const activateBtn = tr.querySelector('.btn-activate');

        if (suspendBtn) {
          suspendBtn.addEventListener('click', async () => {
            await suspendUser(u.id);
          });
        }

        if (activateBtn) {
          activateBtn.addEventListener('click', async () => {
            await activateUser(u.id);
          });
        }

        tableBody.appendChild(tr);
      });
    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:20px; color:#ff453a;">${err.message}</td></tr>`;
    }
  }

  async function deleteUser(userId, userName) {
    if (!window.AuthManager.hasActionPermission('admin:delete_user')) {
      if (typeof window.showToast === 'function') {
        window.showToast('⛔ 权限不足：您当前暂无【删除用户】的权限，请联系 Admin 开通！');
      }
      return;
    }

    if (!confirm(`⚠️ 危险操作确认：\n\n确定要永久删除用户 "${userName}" (#${userId}) 吗？\n该操作不可撤销！`)) {
      return;
    }

    try {
      const response = await fetch(getApiBaseUrl() + `/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '删除失败');

      if (typeof window.showToast === 'function') {
        window.showToast(`🗑️ 用户 ${userName} 已永久删除`);
      }
      loadUsersList();
      loadUsersStats();
    } catch (err) {
      if (typeof window.showToast === 'function') {
        window.showToast(`❌ 删除失败: ${err.message}`);
      }
    }
  }

  async function openAdminUserBillsModal(userId, userName) {
    const modal = document.getElementById('admin-user-bills-modal');
    if (!modal) return;

    const headerName = document.getElementById('admin-user-bills-header-name');
    const tbody = document.getElementById('admin-user-bills-tbody');
    const kpiCount = document.getElementById('admin-user-kpi-count');
    const kpiRevenue = document.getElementById('admin-user-kpi-revenue');
    const kpiProfit = document.getElementById('admin-user-kpi-profit');

    if (headerName) headerName.textContent = `${userName} (#${userId})`;
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--text-muted);">正在加载该用户的账单数据...</td></tr>';
    if (kpiCount) kpiCount.textContent = '0 笔';
    if (kpiRevenue) kpiRevenue.textContent = 'RM 0.00';
    if (kpiProfit) kpiProfit.textContent = 'RM 0.00';

    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');

    try {
      const response = await fetch(getApiBaseUrl() + `/api/admin/users/${userId}/bills`, {
        headers: getHeaders()
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || '获取用户账单失败');
      }
      const data = await response.json();
      const bills = data.bills || [];

      let totalRev = 0;
      let totalProf = 0;
      bills.forEach(b => {
        totalRev += parseFloat(b.totalRevenue || 0);
        totalProf += parseFloat(b.netProfit || 0);
      });

      if (kpiCount) kpiCount.textContent = `${bills.length} 笔`;
      if (kpiRevenue) kpiRevenue.textContent = `RM ${totalRev.toFixed(2)}`;
      if (kpiProfit) {
        kpiProfit.textContent = `RM ${totalProf.toFixed(2)}`;
        kpiProfit.className = 'kpi-value ' + (totalProf >= 0 ? 'tag-bullish' : 'tag-bearish');
      }

      if (tbody) {
        if (bills.length === 0) {
          tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--text-muted);">该用户暂无账单记录</td></tr>';
        } else {
          tbody.innerHTML = bills.map(b => {
            const dt = b.createdAt ? new Date(b.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '--';
            const profit = typeof b.netProfit === 'number' ? b.netProfit : parseFloat(b.netProfit || 0);
            const playerFee = typeof b.playerFee === 'number' ? b.playerFee : parseFloat(b.playerFee || 0);
            const duration = b.duration ? `${b.duration}h` : '2h';
            const courtCount = b.courtCount ? `${b.courtCount}片` : '1片';
            return `
              <tr>
                <td>#${b.id}</td>
                <td style="font-weight:500;">${b.title}</td>
                <td>${b.venueName || '--'}</td>
                <td>${courtCount} (${duration})</td>
                <td>${b.totalPlayers || 0}人 (Host ${b.hostCount || 0})</td>
                <td>RM ${playerFee.toFixed(2)}</td>
                <td style="color:${profit >= 0 ? 'var(--success)' : 'var(--danger)'}; font-weight:600;">RM ${profit.toFixed(2)}</td>
                <td>${dt}</td>
              </tr>
            `;
          }).join('');
        }
      }
    } catch (err) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:#ff453a;">${err.message}</td></tr>`;
      }
    }
  }

  function closeAdminUserBillsModal() {
    const modal = document.getElementById('admin-user-bills-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }

  function openAdminCreateUserModal() {
    if (!window.AuthManager.hasActionPermission('admin:create_user')) {
      if (typeof window.showToast === 'function') {
        window.showToast('⛔ 权限不足：您当前暂无【创建用户】的权限，请联系 Admin 开通！');
      }
      return;
    }

    const modal = document.getElementById('admin-create-user-modal');
    if (!modal) return;

    const emailInput = document.getElementById('admin-create-user-email');
    const nameInput = document.getElementById('admin-create-user-name');
    const pwdInput = document.getElementById('admin-create-user-password');
    const roleSelect = document.getElementById('admin-create-user-role');
    const statusSelect = document.getElementById('admin-create-user-status');

    if (emailInput) emailInput.value = '';
    if (nameInput) nameInput.value = '';
    if (pwdInput) pwdInput.value = '';
    if (statusSelect) statusSelect.value = 'active';

    const currentUser = window.AuthManager.user;
    const isSuperAdmin = currentUser && currentUser.role === 'admin';

    if (roleSelect) {
      roleSelect.value = 'user';
      // Disable Admin/Manager role options for Manager caller
      const optAdmin = roleSelect.querySelector('option[value="admin"]');
      const optManager = roleSelect.querySelector('option[value="manager"]');
      if (optAdmin) optAdmin.disabled = !isSuperAdmin;
      if (optManager) optManager.disabled = !isSuperAdmin;
    }

    // Default App Permissions Checkboxes
    const cbCL = document.getElementById('admin-create-app-courtledger');
    const cbAM = document.getElementById('admin-create-app-advancemanager');
    const cbAdmin = document.getElementById('admin-create-app-admin');
    const cbAdminLabel = document.getElementById('admin-create-app-admin-label');

    if (cbCL) cbCL.checked = true;
    if (cbAM) cbAM.checked = true;
    if (cbAdmin) {
      cbAdmin.checked = false;
      cbAdmin.disabled = !isSuperAdmin;
      if (cbAdminLabel) cbAdminLabel.style.opacity = isSuperAdmin ? '1' : '0.5';
    }

    // Default Action Permissions Checkboxes
    document.querySelectorAll('input[name="admin-create-perm"]').forEach(cb => {
      if (cb.value === 'admin:delete_user') {
        cb.checked = false;
      } else {
        cb.checked = true;
      }
      if (!isSuperAdmin && cb.value.startsWith('admin:')) {
        cb.disabled = true;
        cb.checked = false;
      } else {
        cb.disabled = false;
      }
    });

    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function closeAdminCreateUserModal() {
    const modal = document.getElementById('admin-create-user-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }

  function openAdminEditUserModal(user) {
    if (!window.AuthManager.hasActionPermission('admin:edit_user')) {
      if (typeof window.showToast === 'function') {
        window.showToast('⛔ 权限不足：您当前暂无【编辑用户】的权限，请联系 Admin 开通！');
      }
      return;
    }

    const modal = document.getElementById('admin-edit-user-modal');
    if (!modal) return;

    document.getElementById('admin-edit-user-id').value = user.id;
    document.getElementById('admin-edit-user-email').value = user.email || '';
    document.getElementById('admin-edit-user-name').value = user.name || '';
    document.getElementById('admin-edit-user-password').value = '';
    
    const roleSelect = document.getElementById('admin-edit-user-role');
    const currentUser = window.AuthManager.user;
    const isSuperAdmin = currentUser && currentUser.role === 'admin';

    if (roleSelect) {
      roleSelect.value = user.role || 'user';
      const optAdmin = roleSelect.querySelector('option[value="admin"]');
      const optManager = roleSelect.querySelector('option[value="manager"]');
      if (optAdmin) optAdmin.disabled = !isSuperAdmin;
      if (optManager) optManager.disabled = !isSuperAdmin;
    }

    document.getElementById('admin-edit-user-status').value = user.status || 'active';

    // Set Sub-Apps Access checkboxes for target user
    const allowed = Array.isArray(user.allowedApps) ? user.allowedApps : ['courtledger', 'advancemanager'];
    const cbCL = document.getElementById('admin-edit-app-courtledger');
    const cbAM = document.getElementById('admin-edit-app-advancemanager');
    const cbAdmin = document.getElementById('admin-edit-app-admin');
    const cbAdminLabel = document.getElementById('admin-edit-app-admin-label');

    if (cbCL) cbCL.checked = allowed.includes('courtledger');
    if (cbAM) cbAM.checked = allowed.includes('advancemanager');
    if (cbAdmin) {
      cbAdmin.checked = allowed.includes('admin') || user.role === 'admin' || user.role === 'manager';
      cbAdmin.disabled = !isSuperAdmin;
      if (cbAdminLabel) cbAdminLabel.style.opacity = isSuperAdmin ? '1' : '0.5';
    }

    // Set Action Permissions Checkboxes for target user
    const perms = Array.isArray(user.appPermissions) ? user.appPermissions : [];
    document.querySelectorAll('input[name="admin-edit-perm"]').forEach(cb => {
      cb.checked = perms.includes(cb.value);
      if (!isSuperAdmin && cb.value.startsWith('admin:')) {
        cb.disabled = true;
      } else {
        cb.disabled = false;
      }
    });

    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function closeAdminEditUserModal() {
    const modal = document.getElementById('admin-edit-user-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }

  async function updateUserRoleOrStatus(userId, updateData) {
    try {
      const response = await fetch(getApiBaseUrl() + `/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(updateData)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '更新失败');

      if (typeof window.showToast === 'function') {
        window.showToast('✅ 用户权限已更新');
      }
      loadUsersList();
    } catch (err) {
      if (typeof window.showToast === 'function') {
        window.showToast(`❌ 操作失败: ${err.message}`);
      }
      loadUsersList();
    }
  }

  async function suspendUser(userId) {
    try {
      const response = await fetch(getApiBaseUrl() + `/api/admin/users/${userId}/suspend`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '冻结用户失败');

      if (typeof window.showToast === 'function') {
        window.showToast(`✅ ${data.message}`);
      }
      loadUsersList();
    } catch (err) {
      if (typeof window.showToast === 'function') {
        window.showToast(`❌ 冻结失败: ${err.message}`);
      }
    }
  }

  async function activateUser(userId) {
    try {
      const response = await fetch(getApiBaseUrl() + `/api/admin/users/${userId}/activate`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '激活用户失败');

      if (typeof window.showToast === 'function') {
        window.showToast(`✅ ${data.message}`);
      }
      loadUsersList();
    } catch (err) {
      if (typeof window.showToast === 'function') {
        window.showToast(`❌ 激活失败: ${err.message}`);
      }
    }
  }

  async function loadAuditLogs() {
    const tableBody = document.getElementById('admin-logs-tbody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--color-text-muted);">加载审计日志...</td></tr>';

    try {
      const response = await fetch(getApiBaseUrl() + '/api/admin/logs', { headers: getHeaders() });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || '获取审计日志失败');
      }
      const data = await response.json();
      const logs = data.logs || [];

      if (logs.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--color-text-muted);">暂无 Admin 操作审计记录</td></tr>';
        return;
      }

      tableBody.innerHTML = '';
      logs.forEach(l => {
        const tr = document.createElement('tr');
        const dateStr = l.createdAt ? new Date(l.createdAt).toLocaleString('zh-CN') : '--';
        tr.innerHTML = `
          <td><strong>#${l.id}</strong></td>
          <td>👑 ${l.adminName || 'Admin'} (#${l.adminUserId})</td>
          <td><span class="action-tag action-${l.action}">${l.action}</span></td>
          <td>${l.targetType || 'user'} #${l.targetId || '-'}</td>
          <td><code>${l.details || '-'}</code></td>
          <td>${dateStr}</td>
        `;
        tableBody.appendChild(tr);
      });
    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#ff453a;">${err.message}</td></tr>`;
    }
  }

  async function loadCourtLedgerBackendData() {
    const venuesTbody = document.getElementById('admin-cl-venues-tbody');
    const billsTbody = document.getElementById('admin-cl-bills-tbody');
    const totalVenuesEl = document.getElementById('admin-cl-total-venues');
    const totalBillsEl = document.getElementById('admin-cl-total-bills');
    const totalRevenueEl = document.getElementById('admin-cl-total-revenue');
    const totalProfitEl = document.getElementById('admin-cl-total-profit');

    // 1. Fetch and render Venues
    try {
      let venues = [];
      if (window.CourtLedgerState) {
        if (typeof window.CourtLedgerState.fetchVenues === 'function') {
          venues = await window.CourtLedgerState.fetchVenues();
        } else if (typeof window.CourtLedgerState.fetchVenuesFromDatabase === 'function') {
          await window.CourtLedgerState.fetchVenuesFromDatabase();
          venues = window.CourtLedgerState.venues || [];
        } else if (Array.isArray(window.CourtLedgerState.venues)) {
          venues = window.CourtLedgerState.venues;
        }
      }

      if (totalVenuesEl) totalVenuesEl.textContent = `${venues.length} 间`;

      if (venuesTbody) {
        if (venues.length === 0) {
          venuesTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:12px; color:var(--text-muted);">暂无球场数据</td></tr>';
        } else {
          venuesTbody.innerHTML = venues.map(v => `
            <tr>
              <td>#${v.id}</td>
              <td><strong>${v.name}</strong></td>
              <td>RM ${(typeof v.rateMorning === 'number' ? v.rateMorning : parseFloat(v.rateMorning || 0)).toFixed(2)}</td>
              <td>RM ${(typeof v.rateEvening === 'number' ? v.rateEvening : parseFloat(v.rateEvening || 0)).toFixed(2)}</td>
            </tr>
          `).join('');
        }
      }
    } catch (e) {
      console.warn('Failed to load admin venues list:', e);
    }

    // 2. Fetch and render Bills
    try {
      let bills = [];
      if (window.CourtLedgerState) {
        if (typeof window.CourtLedgerState.fetchBills === 'function') {
          bills = await window.CourtLedgerState.fetchBills();
        } else if (Array.isArray(window.CourtLedgerState.savedBills)) {
          bills = window.CourtLedgerState.savedBills;
        }
      }

      if (totalBillsEl) totalBillsEl.textContent = `${bills.length} 笔`;

      let totalRev = 0;
      let totalProf = 0;
      bills.forEach(b => {
        totalRev += parseFloat(b.totalRevenue || 0);
        totalProf += parseFloat(b.netProfit || 0);
      });

      if (totalRevenueEl) totalRevenueEl.textContent = `RM ${totalRev.toFixed(2)}`;
      if (totalProfitEl) totalProfitEl.textContent = `RM ${totalProf.toFixed(2)}`;

      if (billsTbody) {
        if (bills.length === 0) {
          billsTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:12px; color:var(--text-muted);">暂无账单流水</td></tr>';
        } else {
          billsTbody.innerHTML = bills.slice(0, 10).map(b => {
            const dt = b.createdAt ? new Date(b.createdAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) : '--';
            return `
              <tr>
                <td>#${b.id}</td>
                <td style="max-width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${b.title}">${b.title}</td>
                <td>${b.venueName || '--'}</td>
                <td>RM ${(typeof b.playerFee === 'number' ? b.playerFee : parseFloat(b.playerFee || 0)).toFixed(2)}</td>
                <td style="color:${(b.netProfit >= 0 ? 'var(--success)' : 'var(--danger)')}; font-weight:600;">RM ${(typeof b.netProfit === 'number' ? b.netProfit : parseFloat(b.netProfit || 0)).toFixed(2)}</td>
                <td>${dt}</td>
              </tr>
            `;
          }).join('');
        }
      }
    } catch (e) {
      console.warn('Failed to load admin bills list:', e);
    }
  }

  // 3. Sub-App Access & Coverage Analytics
  async function loadAppAccessStats() {
    const container = document.getElementById('admin-app-access-cards-container');
    const totalUsersEl = document.getElementById('admin-stat-access-total-users');
    const activeUsersEl = document.getElementById('admin-stat-access-active-users');
    const fullUsersEl = document.getElementById('admin-stat-access-full-users');
    const restrictedUsersEl = document.getElementById('admin-stat-access-restricted-users');

    if (container) {
      container.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">⏳ 正在加载应用授权与覆盖率统计...</div>';
    }

    try {
      const response = await fetch(getApiBaseUrl() + '/api/admin/app-access-stats', { headers: getHeaders() });
      if (!response.ok) {
        throw new Error('获取应用授权统计失败');
      }
      const data = await response.json();
      const summary = data.summary || {};
      const apps = data.apps || [];

      if (totalUsersEl) totalUsersEl.textContent = `${summary.totalUsers || 0} 人`;
      if (activeUsersEl) activeUsersEl.textContent = `${summary.activeUsers || 0} 人`;
      if (fullUsersEl) fullUsersEl.textContent = `${summary.fullAccessUsers || 0} 人`;
      if (restrictedUsersEl) restrictedUsersEl.textContent = `${summary.restrictedUsers || 0} 人`;

      if (!container) return;

      if (apps.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">暂无应用数据</div>';
        return;
      }

      container.innerHTML = apps.map(app => {
        const usersListHtml = app.users.length === 0
          ? '<div style="padding:10px 14px; font-size:0.85rem; color:var(--text-muted);">暂无可访问用户</div>'
          : `
            <div class="admin-table-wrapper" style="margin-top: 10px; max-height: 220px; overflow-y: auto;">
              <table class="admin-data-table" style="font-size:0.85rem;">
                <thead>
                  <tr>
                    <th>用户</th>
                    <th>邮箱</th>
                    <th>角色</th>
                    <th>账号状态</th>
                  </tr>
                </thead>
                <tbody>
                  ${app.users.map(u => `
                    <tr>
                      <td>
                        <div class="user-cell-name">
                          <span class="user-avatar-small">${u.role === 'admin' ? '👑' : u.role === 'manager' ? '🛡️' : '👤'}</span>
                          <span>${u.name || '未设名'}</span>
                        </div>
                      </td>
                      <td>${u.email}</td>
                      <td>
                        <span class="status-badge" style="font-size:0.75rem;">
                          ${u.role === 'admin' ? '👑 Admin' : u.role === 'manager' ? '🛡️ Manager' : '👤 User'}
                        </span>
                      </td>
                      <td>
                        <span class="status-badge status-${u.status}" style="font-size:0.75rem;">
                          ${u.status === 'active' ? '🟢 正常' : '🔴 冻结'}
                        </span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `;

        return `
          <div class="admin-app-section-card" style="padding: 16px 20px; border-radius: var(--radius-lg); background: var(--surface, rgba(255,255,255,0.03)); border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
              <div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <h3 style="margin:0; font-size:1.15rem; font-weight:700; color:var(--text-primary);">${app.name}</h3>
                  <span class="admin-tag-pro" style="font-size:0.7rem; padding:2px 6px;">APP ID: ${app.id}</span>
                </div>
                <div style="font-size:0.85rem; color:var(--text-secondary); margin-top:2px;">${app.subtitle}</div>
                <p style="font-size:0.78rem; color:var(--text-muted); margin:4px 0 0 0;">${app.desc}</p>
              </div>
              <div style="text-align:right; min-width:140px;">
                <div style="font-size:0.8rem; color:var(--text-muted);">可访问用户 / 活跃覆盖率</div>
                <div style="font-size:1.4rem; font-weight:800; font-family:var(--font-mono); color:var(--accent, #6366f1); margin-top:2px;">
                  ${app.activeAccessibleCount} <span style="font-size:0.85rem; color:var(--text-muted);">/ ${summary.activeUsers} 人 (${app.coveragePercent}%)</span>
                </div>
              </div>
            </div>

            <!-- Progress Bar -->
            <div style="margin-top: 12px; background:rgba(255,255,255,0.08); height:6px; border-radius:999px; overflow:hidden;">
              <div style="width:${app.coveragePercent}%; height:100%; background: linear-gradient(90deg, #6366f1, #8b5cf6); border-radius:999px;"></div>
            </div>

            <!-- Expandable Users List Header -->
            <div style="margin-top: 14px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.85rem; font-weight:600; color:var(--text-secondary);">👥 拥有本应用权限的用户清单 (${app.users.length}人)</span>
                <button type="button" class="btn-table-action" onclick="AdminModule.jumpToUserManagementWithAppFilter('${app.id}')" style="font-size:0.75rem; padding:2px 8px;">
                  ✏️ 前往授权管理
                </button>
              </div>
              ${usersListHtml}
            </div>
          </div>
        `;
      }).join('');

    } catch (err) {
      if (container) {
        container.innerHTML = `<div style="text-align:center; padding:30px; color:#ff453a;">❌ 加载失败: ${err.message}</div>`;
      }
    }
  }

  function jumpToUserManagementWithAppFilter(appId) {
    const tabBtns = document.querySelectorAll('#admin-sidebar .admin-tab-btn');
    const tabPanels = document.querySelectorAll('#view-admin .admin-tab-panel');
    tabBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === 'users'));
    tabPanels.forEach(p => p.classList.toggle('hidden', p.id !== 'admin-tab-users'));
    activeTab = 'users';
    loadUsersList();
  }

  window.AdminModule = {
    initAdminUI,
    loadActiveTabData,
    loadAppAccessStats,
    jumpToUserManagementWithAppFilter
  };
})();
