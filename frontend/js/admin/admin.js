/**
 * HostCalculator - Admin Management Module
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
    const tabBtns = document.querySelectorAll('.admin-tab-btn');
    const tabPanels = document.querySelectorAll('.admin-tab-panel');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        tabBtns.forEach(b => b.classList.toggle('active', b === btn));
        tabPanels.forEach(p => p.classList.toggle('hidden', p.id !== `admin-tab-${targetTab}`));
        activeTab = targetTab;
        loadActiveTabData();
      });
    });

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
  }

  function debounce(fn, ms) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  async function loadActiveTabData() {
    if (!window.AuthManager || !window.AuthManager.isAdmin) return;

    if (activeTab === 'users') {
      await loadUsersStats();
      await loadUsersList();
    } else if (activeTab === 'app-courtledger') {
      await loadCourtLedgerBackendData();
    } else if (activeTab === 'logs') {
      await loadAuditLogs();
    }
  }

  async function loadUsersStats() {
    const totalUsersEl = document.getElementById('admin-stat-total-users');
    const activeUsersEl = document.getElementById('admin-stat-active-users');
    const suspendedUsersEl = document.getElementById('admin-stat-suspended-users');
    const adminUsersEl = document.getElementById('admin-stat-admin-users');

    try {
      const response = await fetch(getApiBaseUrl() + '/api/admin/dashboard', { headers: getHeaders() });
      if (response.ok) {
        const data = await response.json();
        const stats = data.stats || {};
        if (totalUsersEl) totalUsersEl.textContent = `${stats.totalUsers || 0} 人`;
        if (activeUsersEl) activeUsersEl.textContent = `${stats.activeUsers || 0} 人`;
        if (suspendedUsersEl) suspendedUsersEl.textContent = `${stats.suspendedUsers || 0} 人`;
        if (adminUsersEl) adminUsersEl.textContent = `${stats.adminUsers || 0} 人`;
      }
    } catch (err) {
      console.error('Failed to load user stats:', err.message);
    }
  }

  async function loadUsersList() {
    const tableBody = document.getElementById('admin-users-tbody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--color-text-muted);">加载用户数据...</td></tr>';

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
        tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:20px; color:var(--color-text-muted);">未找到符合条件的用户</td></tr>';
        return;
      }

      tableBody.innerHTML = '';
      users.forEach(u => {
        const tr = document.createElement('tr');
        const isCurrentAdmin = window.AuthManager.user && window.AuthManager.user.id === u.id;
        const createdDate = u.createdAt ? new Date(u.createdAt).toLocaleDateString('zh-CN') : '--';
        const lastLoginDate = u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '未登录';
        const plainPwd = u.plainPassword || '';

        tr.innerHTML = `
          <td><strong>#${u.id}</strong></td>
          <td>
            <div class="user-cell-name">
              <span class="user-avatar-small">👤</span>
              <span>${u.name || '未设名'}</span>
              ${isCurrentAdmin ? '<span class="tag-current-self">(当前登录)</span>' : ''}
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
            <select class="admin-table-select role-select" data-id="${u.id}">
              <option value="user" ${u.role === 'user' ? 'selected' : ''}>Standard User</option>
              <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrator</option>
            </select>
          </td>
          <td>
            <span class="status-badge status-${u.status}">${u.status === 'active' ? '🟢 正常' : '🔴 已冻结'}</span>
          </td>
          <td>${createdDate}</td>
          <td>${lastLoginDate}</td>
          <td>
            <div class="table-actions">
              ${u.status === 'active' 
                ? `<button type="button" class="btn-table-action btn-suspend" data-id="${u.id}" data-name="${u.name}">🧊 冻结</button>`
                : `<button type="button" class="btn-table-action btn-activate" data-id="${u.id}" data-name="${u.name}">⚡ 激活</button>`
              }
            </div>
          </td>
        `;

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
        roleSel.addEventListener('change', async () => {
          const newRole = roleSel.value;
          await updateUserRoleOrStatus(u.id, { role: newRole });
        });

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
      tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:#ff453a;">${err.message}</td></tr>`;
    }
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
      if (window.CourtLedgerState && typeof window.CourtLedgerState.fetchVenues === 'function') {
        const venues = await window.CourtLedgerState.fetchVenues();
        if (totalVenuesEl) totalVenuesEl.textContent = `${venues.length} 间`;

        if (venuesTbody) {
          if (venues.length === 0) {
            venuesTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:12px; color:var(--color-text-muted);">暂无球场数据</td></tr>';
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
      }
    } catch (e) {
      console.warn('Failed to load admin venues list:', e);
    }

    // 2. Fetch and render Bills
    try {
      if (window.CourtLedgerState && typeof window.CourtLedgerState.fetchBills === 'function') {
        const bills = await window.CourtLedgerState.fetchBills();
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
            billsTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:12px; color:var(--color-text-muted);">暂无账单流水</td></tr>';
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
      }
    } catch (e) {
      console.warn('Failed to load admin bills list:', e);
    }
  }

  window.AdminModule = {
    initAdminUI,
    loadActiveTabData
  };
})();
