/**
 * Advance Manager - UI Orchestration & Controller Module
 * Enhanced with:
 * 1. WhatsApp Bill Formatter & Clipboard Copy
 * 2. Debt Simplification Engine
 * 3. Projects & Trips Management
 * 5. Search & Multi-dimensional Filter Toolbar
 * 7. Receipt Photo Attachments
 */

window.AdvanceManagerUI = (function () {
  const { formatMYR, parseCents, formatDate } = window.AMFormatters;
  const state = window.AMState.get();

  // Split builder internal state
  let currentSplitType = 'equal';
  let selectedParticipantIds = new Set();
  let customShares = {};
  let currentReceiptBase64 = null;
  let searchDebounceTimer = null;
  let currentPersonSort = 'name_asc';
  let editingPersonId = null;

  function toast(msg) {
    if (typeof window.showToast === 'function') window.showToast(msg);
  }

  // -------------------------------------------------------------
  // INITIALIZATION, SIDEBAR & TAB ROUTING
  // -------------------------------------------------------------
  const sectionTitles = {
    dashboard: '📊 垫付总览看板',
    expenses: '🧾 垫付记录清单',
    people: '👥 涉及人物档案与往来账',
    projects: '🌴 活动与旅行归集项目',
    settlements: '🤝 还款与平账结算流水'
  };

  function isMobileView() {
    return window.innerWidth <= 820;
  }

  function openMobileDrawer() {
    const sidebar = document.getElementById('am-sidebar');
    const backdrop = document.getElementById('am-mobile-backdrop');
    if (sidebar) sidebar.classList.add('mobile-open');
    if (backdrop) backdrop.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function closeMobileDrawer() {
    const sidebar = document.getElementById('am-sidebar');
    const backdrop = document.getElementById('am-mobile-backdrop');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }

  function toggleDesktopSidebar() {
    const sidebar = document.getElementById('am-sidebar');
    const layout = document.querySelector('.am-layout-wrapper');
    if (!sidebar) return;
    const willCollapse = !sidebar.classList.contains('collapsed');
    sidebar.classList.toggle('collapsed', willCollapse);
    if (layout) layout.classList.toggle('sidebar-collapsed', willCollapse);
    localStorage.setItem('omnibox_am_sidebar_collapsed', willCollapse ? 'true' : 'false');
  }

  function initAdvanceManagerUI() {
    const tabBtns = document.querySelectorAll('#am-sidebar .am-tab-btn');
    const sidebar = document.getElementById('am-sidebar');
    const backdrop = document.getElementById('am-mobile-backdrop');
    const headerMenuToggleBtn = document.getElementById('am-menu-toggle-btn');
    const sidebarToggleBtn = document.getElementById('am-sidebar-toggle-btn');
    const sidebarCloseBtn = document.getElementById('am-sidebar-close-btn');
    const layout = document.querySelector('.am-layout-wrapper');

    // Tab buttons have explicit onclick handlers in markup

    if (sidebar) {
      // Restore persisted desktop state
      if (!isMobileView()) {
        const isCollapsed = localStorage.getItem('omnibox_am_sidebar_collapsed') === 'true';
        if (isCollapsed) {
          sidebar.classList.add('collapsed');
          if (layout) layout.classList.add('sidebar-collapsed');
        }
      }

      // Top Header Hamburger Button
      if (headerMenuToggleBtn) {
        headerMenuToggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (isMobileView()) {
            if (sidebar.classList.contains('mobile-open')) {
              closeMobileDrawer();
            } else {
              openMobileDrawer();
            }
          } else {
            toggleDesktopSidebar();
          }
        });
      }

      // Sidebar Internal Toggle (Desktop)
      if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (isMobileView()) {
            closeMobileDrawer();
          } else {
            toggleDesktopSidebar();
          }
        });
      }

      // Mobile Close Button
      if (sidebarCloseBtn) {
        sidebarCloseBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          closeMobileDrawer();
        });
      }

      // Backdrop Click
      if (backdrop) {
        backdrop.addEventListener('click', () => {
          closeMobileDrawer();
        });
      }
    }
  }

  async function loadInitialData() {
    try {
      window.AMState.setLoading(true);
      await Promise.all([
        refreshDashboard(),
        refreshPersons(),
        refreshExpenses(),
        refreshSettlements(),
        refreshProjects()
      ]);
    } catch (err) {
      console.error('Failed to load initial Advance Manager data:', err);
      toast('⚠️ 数据加载失败: ' + err.message);
    } finally {
      window.AMState.setLoading(false);
    }
  }

  function switchTab(tabKey) {
    console.log('[AM] switchTab called with:', tabKey);
    if (!tabKey) return;
    try {
      if (window.AMState && typeof window.AMState.setTab === 'function') {
        window.AMState.setTab(tabKey);
      }
      const tabs = document.querySelectorAll('#am-sidebar .am-tab-btn');
      console.log('[AM] Found sidebar tab buttons:', tabs.length);
      tabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-tab') === tabKey));

      const titleEl = document.getElementById('am-section-title');
      if (titleEl && sectionTitles[tabKey]) {
        titleEl.textContent = sectionTitles[tabKey];
      }

      const sectionIds = ['dashboard', 'expenses', 'people', 'settlements', 'projects'];
      sectionIds.forEach(k => {
        const el = document.getElementById('am-tab-' + k);
        if (el) {
          const shouldHide = (k !== tabKey);
          el.classList.toggle('hidden', shouldHide);
          console.log('[AM] Section am-tab-' + k, shouldHide ? 'HIDDEN' : 'VISIBLE');
        } else {
          console.warn('[AM] Section element NOT FOUND: am-tab-' + k);
        }
      });

      if (isMobileView()) {
        closeMobileDrawer();
      }

      if (tabKey === 'dashboard') refreshDashboard();
      else if (tabKey === 'expenses') refreshExpenses();
      else if (tabKey === 'people') refreshPersons();
      else if (tabKey === 'settlements') refreshSettlements();
      else if (tabKey === 'projects') refreshProjects();
    } catch (err) {
      console.error('[AM] switchTab ERROR:', err);
    }
  }

  // -------------------------------------------------------------
  // 1. DASHBOARD & SIMPLIFIED DEBTS
  // -------------------------------------------------------------
  async function refreshDashboard() {
    try {
      const data = await window.AMApi.getDashboard();
      window.AMState.setDashboardData(data);
      renderDashboard(data);
    } catch (e) {
      console.error('Dashboard load error:', e);
    }
  }

  function renderDashboard(data) {
    if (!data) return;

    const elTotalOutstanding = document.getElementById('am-kpi-total-outstanding');
    const elIOweTotal = document.getElementById('am-kpi-i-owe');
    const elNetBalance = document.getElementById('am-kpi-net-balance');
    const elTotalAdvanced = document.getElementById('am-kpi-total-advanced');

    if (elTotalOutstanding) elTotalOutstanding.textContent = formatMYR(data.totalOutstanding);
    if (elIOweTotal) elIOweTotal.textContent = formatMYR(data.iOweTotal);
    if (elTotalAdvanced) elTotalAdvanced.textContent = formatMYR(data.totalAdvanced);

    if (elNetBalance) {
      elNetBalance.textContent = formatMYR(data.netBalance);
      elNetBalance.className = 'am-kpi-value ' + (data.netBalance > 0 ? 'positive' : data.netBalance < 0 ? 'negative' : '');
    }

    // Render People Who Owe You
    const oweListEl = document.getElementById('am-dash-people-who-owe');
    if (oweListEl) {
      if (!data.peopleWhoOwe || data.peopleWhoOwe.length === 0) {
        oweListEl.innerHTML = `
          <div class="am-empty-state" style="padding: var(--space-4);">
            <span style="font-size:1.5rem;">🎉</span>
            <div style="font-size:0.85rem; color:var(--color-text-muted); margin-top:4px;">目前没有任何人欠你垫付款项</div>
          </div>
        `;
      } else {
        oweListEl.innerHTML = data.peopleWhoOwe.map(p => `
          <div class="am-list-item" onclick="AdvanceManagerUI.openPersonDetail('${p.personId}')">
            <div class="am-item-left">
              <div class="am-avatar-circle">${(p.name || 'P')[0]}</div>
              <div class="am-item-meta">
                <span class="am-item-title">${p.name}</span>
                <span class="am-item-desc">欠你垫付款</span>
              </div>
            </div>
            <div class="am-item-right">
              <span class="am-item-amount positive">+${formatMYR(p.amount)}</span>
              <button class="am-btn-secondary" style="padding:2px 8px; font-size:0.75rem;" onclick="event.stopPropagation(); AdvanceManagerUI.openSettleModal('${p.personId}', '${data.mePersonId}', ${p.amount})">结算</button>
            </div>
          </div>
        `).join('');
      }
    }

    // Render People You Owe
    const iOweListEl = document.getElementById('am-dash-people-i-owe');
    if (iOweListEl) {
      if (!data.peopleIOwe || data.peopleIOwe.length === 0) {
        iOweListEl.innerHTML = `
          <div class="am-empty-state" style="padding: var(--space-4);">
            <span style="font-size:1.5rem;">✨</span>
            <div style="font-size:0.85rem; color:var(--color-text-muted); margin-top:4px;">你没有欠任何人款项，账目清爽</div>
          </div>
        `;
      } else {
        iOweListEl.innerHTML = data.peopleIOwe.map(p => `
          <div class="am-list-item" onclick="AdvanceManagerUI.openPersonDetail('${p.personId}')">
            <div class="am-item-left">
              <div class="am-avatar-circle">${(p.name || 'P')[0]}</div>
              <div class="am-item-meta">
                <span class="am-item-title">${p.name}</span>
                <span class="am-item-desc">你应付欠款</span>
              </div>
            </div>
            <div class="am-item-right">
              <span class="am-item-amount negative">-${formatMYR(p.amount)}</span>
              <button class="am-btn-secondary" style="padding:2px 8px; font-size:0.75rem;" onclick="event.stopPropagation(); AdvanceManagerUI.openSettleModal('${data.mePersonId}', '${p.personId}', ${p.amount})">还款</button>
            </div>
          </div>
        `).join('');
      }
    }

    // Render Global Simplified Debt Transfers
    const simplifyBox = document.getElementById('am-dash-simplify-box');
    if (simplifyBox && state.persons && state.persons.length > 0) {
      const transfers = window.AMBalance.simplifyDebts(state.persons);
      if (transfers.length > 0) {
        simplifyBox.classList.remove('hidden');
        simplifyBox.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-size:0.9rem; color:#10b981;">⚡ 全局债务简化推荐 (最少转账路径)</strong>
            <span style="font-size:0.75rem; color:var(--color-text-muted);">自动对冲连环欠款</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px; margin-top:4px;">
            ${transfers.map(t => `
              <div class="am-transfer-item">
                <span><strong>${t.from_name}</strong> <span class="am-transfer-arrow">➔ 转给</span> <strong>${t.to_name}</strong></span>
                <span style="font-family:var(--font-mono); font-weight:700; color:#10b981;">${formatMYR(t.amount)}</span>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        simplifyBox.classList.add('hidden');
      }
    }
  }

  // -------------------------------------------------------------
  // 2. EXPENSES & SEARCH / FILTER
  // -------------------------------------------------------------
  async function refreshExpenses() {
    try {
      const res = await window.AMApi.getExpenses(state.filters);
      window.AMState.setExpenses(res.expenses || []);
      renderExpenses(res.expenses || []);
      populateFilterPersons();
    } catch (e) {
      console.error('Expenses load error:', e);
    }
  }

  function populateFilterPersons() {
    const pSelect = document.getElementById('am-filter-person');
    if (!pSelect) return;
    const currentVal = state.filters.personId || '';
    pSelect.innerHTML = `<option value="">全部人物</option>` + state.persons.map(p => `
      <option value="${p.id}" ${p.id === currentVal ? 'selected' : ''}>${p.name}</option>
    `).join('');
  }

  function handleSearchInput(query) {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      state.filters.search = query.trim();
      refreshExpenses();
    }, 250);
  }

  function handleStatusFilter(status) {
    state.filters.status = status;
    refreshExpenses();
  }

  function handlePersonFilter(personId) {
    state.filters.personId = personId;
    refreshExpenses();
  }

  function renderExpenses(expenses) {
    const listEl = document.getElementById('am-expenses-list');
    if (!listEl) return;

    if (!expenses || expenses.length === 0) {
      listEl.innerHTML = `
        <div class="am-empty-state">
          <div class="am-empty-icon">🧾</div>
          <div class="am-empty-title">未找到匹配的垫付记录</div>
          <div style="font-size:0.85rem; color:var(--color-text-muted); margin-bottom:var(--space-4);">尝试更改搜索或筛选条件</div>
          <button class="am-btn-primary" onclick="AdvanceManagerUI.openNewExpenseModal()">+ 新增垫付</button>
        </div>
      `;
      return;
    }

    listEl.innerHTML = expenses.map(e => {
      const isCancelled = e.status === 'cancelled';
      const payerName = e.payer_name || '付款人';
      const partsCount = (e.participants && e.participants.length) || 0;
      const projTag = e.project_name ? ` · 🏷️ ${e.project_name}` : '';
      const receiptIcon = e.attachment_data ? ' 📸' : '';

      return `
        <div class="am-list-item" onclick="AdvanceManagerUI.openExpenseDetail('${e.id}')">
          <div class="am-item-left">
            <div class="am-avatar-circle" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">💸</div>
            <div class="am-item-meta">
              <span class="am-item-title">${e.description}${receiptIcon}</span>
              <span class="am-item-desc">${formatDate(e.transaction_date)} · ${payerName} 付款 · ${partsCount}人分摊${projTag}</span>
            </div>
          </div>
          <div class="am-item-right">
            <span class="am-item-amount ${isCancelled ? 'settled' : ''}">${formatMYR(e.total_amount)}</span>
            <span class="am-pill-badge ${e.status}">${e.status.toUpperCase()}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // -------------------------------------------------------------
  // 3. PEOPLE & NET BALANCES
  // -------------------------------------------------------------
  async function refreshPersons() {
    try {
      const persons = await window.AMApi.getPersons();
      window.AMState.setPersons(persons);
      renderPersons(persons);
    } catch (e) {
      console.error('Persons load error:', e);
    }
  }

  function handlePersonSortChange(sortKey) {
    currentPersonSort = sortKey;
    renderPersons(state.persons || []);
  }

  function sortPersonsList(persons, sortBy = 'name_asc') {
    return [...persons].sort((a, b) => {
      // 0. "我 (Me)" / isSelf always strictly at #1
      if (a.isSelf && !b.isSelf) return -1;
      if (!a.isSelf && b.isSelf) return 1;

      // 1. Favourites pinned starting from #2
      const favA = a.is_favourite ? 1 : 0;
      const favB = b.is_favourite ? 1 : 0;
      if (favA !== favB) return favB - favA;

      // 2. Active before archived
      const archA = a.is_archived ? 1 : 0;
      const archB = b.is_archived ? 1 : 0;
      if (archA !== archB) return archA - archB;

      // 3. User chosen criteria within each tier
      if (sortBy === 'they_owe_desc') {
        const diff = (b.theyOweMe || 0) - (a.theyOweMe || 0);
        if (diff !== 0) return diff;
      } else if (sortBy === 'i_owe_desc') {
        const diff = (b.iOweThem || 0) - (a.iOweThem || 0);
        if (diff !== 0) return diff;
      } else if (sortBy === 'net_desc') {
        const diff = (b.netBalance || 0) - (a.netBalance || 0);
        if (diff !== 0) return diff;
      }

      // Default: Alphabetical
      return (a.name || '').localeCompare(b.name || '');
    });
  }

  function renderPersons(persons) {
    const listEl = document.getElementById('am-persons-list');
    if (!listEl) return;

    if (!persons || persons.length === 0) {
      listEl.innerHTML = `
        <div class="am-empty-state">
          <div class="am-empty-icon">👥</div>
          <div class="am-empty-title">暂无人物档案</div>
          <div style="font-size:0.85rem; color:var(--color-text-muted); margin-bottom:var(--space-4);">添加常用朋友/同事，快速发起垫付平摊</div>
          <button class="am-btn-primary" onclick="AdvanceManagerUI.openNewPersonModal()">+ 添加人物</button>
        </div>
      `;
      return;
    }

    const sortedList = sortPersonsList(persons, currentPersonSort);

    listEl.innerHTML = sortedList.map(p => {
      let balanceTag = '';
      if (p.isSelf) {
        balanceTag = `<span class="am-pill-badge settled">我 (当前账户)</span>`;
      } else if (p.theyOweMe > 0) {
        balanceTag = `<span class="am-item-amount positive">+${formatMYR(p.theyOweMe)} (欠你)</span>`;
      } else if (p.iOweThem > 0) {
        balanceTag = `<span class="am-item-amount negative">-${formatMYR(p.iOweThem)} (你欠)</span>`;
      } else {
        balanceTag = `<span class="am-item-amount settled">已结清</span>`;
      }

      const tempBadge = p.is_temporary ? `<span class="am-pill-badge temp" style="margin-left:4px;">临时</span>` : '';
      const favBtn = !p.isSelf ? `
        <button type="button" class="am-fav-btn ${p.is_favourite ? 'active' : ''}" title="${p.is_favourite ? '取消收藏' : '标为常用/收藏'}" onclick="event.stopPropagation(); AdvanceManagerUI.toggleFavourite('${p.id}')">
          ${p.is_favourite ? '❤️' : '🤍'}
        </button>
      ` : '';

      return `
        <div class="am-list-item" onclick="AdvanceManagerUI.openPersonDetail('${p.id}')">
          <div class="am-item-left">
            <div class="am-avatar-circle">${(p.name || 'P')[0]}</div>
            <div class="am-item-meta">
              <div style="display:flex; align-items:center;">
                <span class="am-item-title">${p.name} ${p.nickname ? `(${p.nickname})` : ''}</span>
                ${tempBadge}
              </div>
              <span class="am-item-desc">${p.phone || p.email || (p.isSelf ? '系统主账号' : (p.is_temporary ? '单次临时人物' : '常驻通讯录人物'))}</span>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="am-item-right">
              ${balanceTag}
            </div>
            ${favBtn}
          </div>
        </div>
      `;
    }).join('');
  }

  async function toggleFavourite(personId) {
    try {
      const res = await window.AMApi.togglePersonFavourite(personId);
      toast(res.is_favourite ? '❤️ 已添加为常用人物 (置顶显示)' : '🤍 已取消常用收藏');
      await refreshPersons();
    } catch (e) {
      toast('⚠️ 收藏操作失败: ' + e.message);
    }
  }

  // -------------------------------------------------------------
  // 4. PROJECTS & TRIPS
  // -------------------------------------------------------------
  async function refreshProjects() {
    try {
      const projs = await window.AMApi.getProjects();
      window.AMState.setProjects(projs);
      renderProjects(projs);
    } catch (e) {
      console.error('Projects load error:', e);
    }
  }

  function renderProjects(projs) {
    const listEl = document.getElementById('am-projects-list');
    if (!listEl) return;

    if (!projs || projs.length === 0) {
      listEl.innerHTML = `
        <div class="am-empty-state">
          <div class="am-empty-icon">🌴</div>
          <div class="am-empty-title">暂无活动或旅行项目</div>
          <div style="font-size:0.85rem; color:var(--color-text-muted); margin-bottom:var(--space-4);">为出游聚会创建专属项目，一键生成活动独立清账报告</div>
          <button class="am-btn-primary" onclick="AdvanceManagerUI.openNewProjectModal()">+ 创建新项目</button>
        </div>
      `;
      return;
    }

    listEl.innerHTML = `
      <div class="am-project-grid">
        ${projs.map(p => `
          <div class="am-project-card" onclick="AdvanceManagerUI.openProjectDetail('${p.id}')">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="font-size:1.05rem; color:var(--color-text-primary);">${p.name}</strong>
              <span class="am-pill-badge settled">${p.status.toUpperCase()}</span>
            </div>
            <div style="font-size:0.82rem; color:var(--color-text-muted);">
              ${p.description || '无项目描述'}
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--color-text-muted); border-top:1px solid var(--color-border-subtle); padding-top:6px; margin-top:4px;">
              <span>📅 ${formatDate(p.created_at)}</span>
              <span style="color:var(--color-primary); font-weight:600;">查看详情 ➔</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function openNewProjectModal() {
    const modal = document.getElementById('modal-am-project');
    if (!modal) return;
    document.getElementById('am-proj-name').value = '';
    document.getElementById('am-proj-desc').value = '';
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  async function submitNewProject() {
    const name = document.getElementById('am-proj-name').value.trim();
    const desc = document.getElementById('am-proj-desc').value.trim();
    if (!name) return toast('⚠️ 请输入项目名称');

    try {
      toast('⏳ 正在创建活动项目...');
      await window.AMApi.createProject({ name, description: desc });
      toast('✅ 项目创建成功！');
      closeModal('modal-am-project');
      await refreshProjects();
    } catch (e) {
      toast('❌ 创建失败: ' + e.message);
    }
  }

  async function openProjectDetail(projId) {
    const modal = document.getElementById('modal-am-project-detail');
    if (!modal) return;

    try {
      const res = await window.AMApi.getProjectDetail(projId);
      const { project, totalProjectCost, expenses } = res;

      document.getElementById('am-pdetail-proj-name').textContent = project.name;
      document.getElementById('am-pdetail-proj-total').textContent = formatMYR(totalProjectCost);
      document.getElementById('am-pdetail-proj-count').textContent = `${expenses.length} 笔垫付`;

      // Render Project Expenses
      const expListEl = document.getElementById('am-pdetail-proj-expenses');
      if (expListEl) {
        if (expenses.length === 0) {
          expListEl.innerHTML = '<div style="padding:var(--space-4); text-align:center; color:var(--color-text-muted);">本项目暂无关联垫付</div>';
        } else {
          expListEl.innerHTML = expenses.map(e => `
            <div class="am-list-item" onclick="AdvanceManagerUI.openExpenseDetail('${e.id}')">
              <div class="am-item-left">
                <span style="font-size:1.1rem;">💸</span>
                <div class="am-item-meta">
                  <span class="am-item-title">${e.description}</span>
                  <span class="am-item-desc">${formatDate(e.transaction_date)} · ${e.payer_name || '付款人'} 付款</span>
                </div>
              </div>
              <div class="am-item-right">
                <span class="am-item-amount">${formatMYR(e.total_amount)}</span>
              </div>
            </div>
          `).join('');
        }
      }

      modal.classList.remove('hidden');
      document.body.classList.add('modal-open');
    } catch (e) {
      toast('⚠️ 无法加载项目详情: ' + e.message);
    }
  }

  // -------------------------------------------------------------
  // 5. SETTLEMENTS
  // -------------------------------------------------------------
  async function refreshSettlements() {
    try {
      const settlements = await window.AMApi.getSettlements();
      window.AMState.setSettlements(settlements);
      renderSettlements(settlements);
    } catch (e) {
      console.error('Settlements load error:', e);
    }
  }

  function renderSettlements(settlements) {
    const listEl = document.getElementById('am-settlements-list');
    if (!listEl) return;

    if (!settlements || settlements.length === 0) {
      listEl.innerHTML = `
        <div class="am-empty-state">
          <div class="am-empty-icon">🤝</div>
          <div class="am-empty-title">暂无还款结算记录</div>
          <div style="font-size:0.85rem; color:var(--color-text-muted);">当收到或完成还款时，在这里登记平账</div>
        </div>
      `;
      return;
    }

    listEl.innerHTML = settlements.map(s => `
      <div class="am-list-item">
        <div class="am-item-left">
          <div class="am-avatar-circle" style="background: rgba(59, 130, 246, 0.15); color: #3b82f6;">🤝</div>
          <div class="am-item-meta">
            <span class="am-item-title">${s.from_name || '还款人'} ➔ ${s.to_name || '收款人'}</span>
            <span class="am-item-desc">${formatDate(s.settlement_date, true)} · ${s.payment_method} ${s.note ? '· ' + s.note : ''}</span>
          </div>
        </div>
        <div class="am-item-right">
          <span class="am-item-amount positive">${formatMYR(s.amount)}</span>
          <span class="am-pill-badge settled">SETTLED</span>
        </div>
      </div>
    `).join('');
  }

  // -------------------------------------------------------------
  // 6. MODAL: NEW EXPENSE & SPLIT BUILDER
  // -------------------------------------------------------------
  function openNewExpenseModal() {
    const modal = document.getElementById('modal-am-expense');
    if (!modal) return;

    // Reset Form
    document.getElementById('am-exp-desc').value = '';
    document.getElementById('am-exp-amount').value = '';
    document.getElementById('am-exp-date').value = new Date().toISOString().slice(0, 16);
    document.getElementById('am-exp-note').value = '';
    currentReceiptBase64 = null;
    updateReceiptPreviewUI();

    // Populate Payer Select
    const payerSelect = document.getElementById('am-exp-payer');
    if (payerSelect) {
      payerSelect.innerHTML = state.persons.map(p => `
        <option value="${p.id}" ${p.isSelf ? 'selected' : ''}>${p.name} ${p.isSelf ? '(我)' : ''}</option>
      `).join('');
    }

    // Populate Project Select
    const projSelect = document.getElementById('am-exp-project');
    if (projSelect) {
      projSelect.innerHTML = `<option value="">无关联项目 (独立支出)</option>` + state.projects.map(p => `
        <option value="${p.id}">${p.name}</option>
      `).join('');
    }

    // Default: Only 'Me' is added by default (user adds others on demand)
    currentSplitType = 'equal';
    selectedParticipantIds = new Set(state.mePersonId ? [state.mePersonId] : (state.persons[0] ? [state.persons[0].id] : []));
    customShares = {};

    updateSplitModeUI();
    renderParticipantsPicker();

    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function handleReceiptFileSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    // Limit to 2MB for safety
    if (file.size > 2 * 1024 * 1024) {
      return toast('⚠️ 图片过大，请选择 2MB 以内的收据小票');
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      currentReceiptBase64 = event.target.result;
      updateReceiptPreviewUI();
    };
    reader.readAsDataURL(file);
  }

  function removeReceipt() {
    currentReceiptBase64 = null;
    const fileInput = document.getElementById('am-exp-receipt-file');
    if (fileInput) fileInput.value = '';
    updateReceiptPreviewUI();
  }

  function updateReceiptPreviewUI() {
    const previewContainer = document.getElementById('am-exp-receipt-preview');
    if (!previewContainer) return;
    if (currentReceiptBase64) {
      previewContainer.classList.remove('hidden');
      previewContainer.innerHTML = `
        <img src="${currentReceiptBase64}" class="am-receipt-thumb" onclick="AdvanceManagerUI.viewFullReceipt('${currentReceiptBase64}')">
        <button type="button" class="btn-secondary-action danger-text" style="padding:2px 8px; font-size:0.75rem;" onclick="AdvanceManagerUI.removeReceipt()">移除小票</button>
      `;
    } else {
      previewContainer.classList.add('hidden');
      previewContainer.innerHTML = '';
    }
  }

  function viewFullReceipt(src) {
    const modal = document.getElementById('modal-am-receipt-viewer');
    const img = document.getElementById('am-receipt-viewer-img');
    if (modal && img) {
      img.src = src;
      modal.classList.remove('hidden');
      document.body.classList.add('modal-open');
    }
  }

  function updateSplitModeUI() {
    const btns = document.querySelectorAll('.am-split-opt-btn');
    btns.forEach(b => b.classList.toggle('active', b.dataset.mode === currentSplitType));
  }

  function setSplitMode(mode) {
    currentSplitType = mode;
    updateSplitModeUI();
    renderParticipantsPicker();
  }

  function addParticipantFromSelect(val) {
    if (!val) return;
    if (val === '__all__') {
      state.persons.forEach(p => selectedParticipantIds.add(p.id));
    } else {
      selectedParticipantIds.add(val);
    }
    const selEl = document.getElementById('am-add-participant-select');
    if (selEl) selEl.value = '';
    renderParticipantsPicker();
  }

  function removeParticipant(personId) {
    selectedParticipantIds.delete(personId);
    delete customShares[personId];
    renderParticipantsPicker();
  }

  function renderParticipantsPicker() {
    const container = document.getElementById('am-participants-container');
    const addSelect = document.getElementById('am-add-participant-select');
    const countLabel = document.getElementById('am-part-count-label');
    if (!container) return;

    if (countLabel) {
      countLabel.textContent = `${selectedParticipantIds.size} 人`;
    }

    // Populate Add-Participant dropdown with unselected persons
    if (addSelect) {
      const unselectedPersons = sortPersonsList(state.persons.filter(p => !selectedParticipantIds.has(p.id)), 'name_asc');
      let optionsHtml = `<option value="">➕ 添加分摊人员...</option>`;
      if (unselectedPersons.length > 1) {
        optionsHtml += `<option value="__all__">👥 一键添加全部 (${unselectedPersons.length} 人)</option>`;
      }
      unselectedPersons.forEach(p => {
        optionsHtml += `<option value="${p.id}">${p.is_favourite ? '❤️ ' : ''}${p.name} ${p.isSelf ? '(我)' : ''}</option>`;
      });
      addSelect.innerHTML = optionsHtml;
      addSelect.value = '';
    }

    const totalCents = parseCents(document.getElementById('am-exp-amount')?.value || '0');

    let equalShares = [];
    if (currentSplitType === 'equal') {
      equalShares = window.AMBalance.calculateEqualSplit(totalCents, Array.from(selectedParticipantIds));
    }

    const shareMap = {};
    equalShares.forEach(s => { shareMap[s.person_id] = s.share_amount; });

    const selectedPersonsList = sortPersonsList(state.persons.filter(p => selectedParticipantIds.has(p.id)), 'name_asc');

    if (selectedPersonsList.length === 0) {
      container.innerHTML = `
        <div style="padding:14px; text-align:center; color:var(--color-text-muted); font-size:0.85rem;">
          暂无分摊人员，请在右上角下拉选单中选择添加
        </div>
      `;
    } else {
      container.innerHTML = selectedPersonsList.map(p => {
        let inputHtml = '';

        if (currentSplitType === 'equal') {
          const share = shareMap[p.id] || 0;
          inputHtml = `<span class="am-equal-val" data-person="${p.id}" style="font-family:var(--font-mono); font-size:0.92rem; color:var(--color-primary); font-weight:600;">${formatMYR(share)}</span>`;
        } else if (currentSplitType === 'fixed') {
          const val = customShares[p.id] !== undefined ? (customShares[p.id] / 100).toFixed(2) : (totalCents / 100 / Math.max(1, selectedParticipantIds.size)).toFixed(2);
          inputHtml = `<input type="number" step="0.01" class="am-part-input" data-person="${p.id}" value="${val}" oninput="AdvanceManagerUI.handleShareInput('${p.id}', this.value)">`;
        } else if (currentSplitType === 'percentage') {
          const val = customShares[p.id] !== undefined ? customShares[p.id] : (100 / Math.max(1, selectedParticipantIds.size)).toFixed(1);
          inputHtml = `<input type="number" step="1" class="am-part-input" data-person="${p.id}" style="width:65px;" value="${val}" oninput="AdvanceManagerUI.handlePercentInput('${p.id}', this.value)"> %`;
        }

        const favIcon = p.is_favourite ? '❤️ ' : '';
        return `
          <div class="am-participant-row">
            <div class="am-part-label">
              <div class="am-avatar-circle" style="width:28px; height:28px; font-size:0.8rem;">${(p.name || 'P')[0]}</div>
              <span>${favIcon}${p.name} ${p.isSelf ? '<span style="color:var(--color-primary); font-size:0.8rem;">(我)</span>' : ''}</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              ${inputHtml}
              <button type="button" class="am-part-remove-btn" title="从分摊中移除" onclick="AdvanceManagerUI.removeParticipant('${p.id}')">✕</button>
            </div>
          </div>
        `;
      }).join('');
    }

    updateSplitCalculations();
  }

  function handleTotalAmountChange() {
    updateSplitCalculations();
  }

  function updateSplitCalculations() {
    const summaryBar = document.getElementById('am-split-summary-bar');
    if (!summaryBar) return;

    const totalCents = parseCents(document.getElementById('am-exp-amount')?.value || '0');

    if (currentSplitType === 'equal') {
      const equalShares = window.AMBalance.calculateEqualSplit(totalCents, Array.from(selectedParticipantIds));
      equalShares.forEach(s => {
        const span = document.querySelector(`.am-equal-val[data-person="${s.person_id}"]`);
        if (span) span.textContent = formatMYR(s.share_amount);
      });

      summaryBar.className = 'am-split-summary-bar valid';
      summaryBar.innerHTML = `<span>👥 平摊人数: ${selectedParticipantIds.size} 人</span><span>每人: ${formatMYR(equalShares[0]?.share_amount || 0)}</span>`;
    } else if (currentSplitType === 'fixed') {
      const parts = Array.from(selectedParticipantIds).map(pid => {
        const inp = document.querySelector(`.am-part-input[data-person="${pid}"]`);
        const val = inp ? parseCents(inp.value) : (customShares[pid] || 0);
        return { person_id: pid, share_amount: val };
      });
      const val = window.AMBalance.validateFixedSplit(totalCents, parts);
      summaryBar.className = 'am-split-summary-bar ' + (val.valid ? 'valid' : 'invalid');
      summaryBar.innerHTML = val.valid
        ? `<span>✓ 分摊金额吻合</span><span>合计: ${formatMYR(val.sum)}</span>`
        : `<span>⚠️ ${val.diff > 0 ? '还差 ' + formatMYR(val.diff) : '超出 ' + formatMYR(-val.diff)}</span><span>合计: ${formatMYR(val.sum)}</span>`;
    } else if (currentSplitType === 'percentage') {
      const parts = Array.from(selectedParticipantIds).map(pid => {
        const inp = document.querySelector(`.am-part-input[data-person="${pid}"]`);
        const val = inp ? (parseFloat(inp.value) || 0) : (customShares[pid] || 0);
        return { person_id: pid, percentage: val };
      });
      const val = window.AMBalance.validatePercentageSplit(parts);
      summaryBar.className = 'am-split-summary-bar ' + (val.valid ? 'valid' : 'invalid');
      summaryBar.innerHTML = val.valid
        ? `<span>✓ 百分比正确 (100%)</span>`
        : `<span>⚠️ 百分比总和必须为 100% (当前 ${val.sum.toFixed(1)}%)</span>`;
    }
  }

  function handleShareInput(personId, rawVal) {
    customShares[personId] = parseCents(rawVal);
    updateSplitCalculations();
  }

  function handlePercentInput(personId, rawVal) {
    customShares[personId] = parseFloat(rawVal) || 0;
    updateSplitCalculations();
  }

  async function submitNewExpense() {
    const desc = document.getElementById('am-exp-desc').value.trim();
    const amountCents = parseCents(document.getElementById('am-exp-amount').value);
    const payerId = document.getElementById('am-exp-payer').value;
    const projId = document.getElementById('am-exp-project')?.value || null;
    const txDate = document.getElementById('am-exp-date').value;
    const note = document.getElementById('am-exp-note').value.trim();

    if (!desc) return toast('⚠️ 请输入垫付说明');
    if (amountCents <= 0) return toast('⚠️ 请输入有效的垫付金额');
    if (!payerId) return toast('⚠️ 请选择付款人');
    if (selectedParticipantIds.size === 0) return toast('⚠️ 请至少选择 1 位分摊参与人');

    let participants = [];
    if (currentSplitType === 'equal') {
      participants = window.AMBalance.calculateEqualSplit(amountCents, Array.from(selectedParticipantIds));
    } else if (currentSplitType === 'fixed') {
      participants = Array.from(selectedParticipantIds).map(pid => ({
        person_id: pid,
        split_type: 'fixed',
        share_amount: customShares[pid] !== undefined ? customShares[pid] : parseCents(amountCents / 100 / selectedParticipantIds.size)
      }));
      const val = window.AMBalance.validateFixedSplit(amountCents, participants);
      if (!val.valid) return toast('⚠️ ' + (val.diff > 0 ? '分摊不足' : '分摊超出') + '，请核对金额');
    } else if (currentSplitType === 'percentage') {
      participants = Array.from(selectedParticipantIds).map(pid => {
        const pct = customShares[pid] !== undefined ? customShares[pid] : (100 / selectedParticipantIds.size);
        const share = Math.round(amountCents * (pct / 100));
        return {
          person_id: pid,
          split_type: 'percentage',
          percentage: pct,
          share_amount: share
        };
      });
      const val = window.AMBalance.validatePercentageSplit(participants);
      if (!val.valid) return toast('⚠️ 百分比总和必须为 100%');
    }

    try {
      toast('⏳ 正在保存垫付记录...');
      await window.AMApi.createExpense({
        description: desc,
        total_amount: amountCents,
        payer_person_id: payerId,
        project_id: projId,
        participants,
        transaction_date: txDate,
        note,
        attachment_data: currentReceiptBase64
      });

      toast('✅ 垫付记录已保存！');
      closeModal('modal-am-expense');
      await Promise.all([refreshDashboard(), refreshExpenses(), refreshPersons(), refreshProjects()]);
    } catch (e) {
      toast('❌ 保存失败: ' + e.message);
    }
  }

  // -------------------------------------------------------------
  // 7. MODAL: NEW PERSON
  // -------------------------------------------------------------
  function openNewPersonModal() {
    const modal = document.getElementById('modal-am-person');
    if (!modal) return;

    const nameEl = document.getElementById('am-person-name');
    const nickEl = document.getElementById('am-person-nickname');
    const phoneEl = document.getElementById('am-person-phone');
    const noteEl = document.getElementById('am-person-note');

    if (nameEl) nameEl.value = '';
    if (nickEl) nickEl.value = '';
    if (phoneEl) phoneEl.value = '';
    if (noteEl) noteEl.value = '';

    const tempRadio = document.getElementById('am-person-type-temp');
    if (tempRadio) tempRadio.checked = false;
    const permRadio = document.getElementById('am-person-type-perm');
    if (permRadio) permRadio.checked = true;

    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  async function submitNewPerson() {
    const name = document.getElementById('am-person-name')?.value?.trim() || '';
    const nickname = document.getElementById('am-person-nickname')?.value?.trim() || '';
    const phone = document.getElementById('am-person-phone')?.value?.trim() || '';
    const note = document.getElementById('am-person-note')?.value?.trim() || '';
    const isTemp = document.getElementById('am-person-type-temp')?.checked || false;

    if (!name) return toast('⚠️ 姓名不能为空');

    try {
      toast('⏳ 正在保存人物...');
      await window.AMApi.createPerson({ name, nickname, phone, note, is_temporary: isTemp });
      toast('✅ 人物创建成功！');
      closeModal('modal-am-person');
      await Promise.all([refreshPersons(), refreshDashboard()]);
    } catch (e) {
      toast('❌ 创建失败: ' + e.message);
    }
  }

  // -------------------------------------------------------------
  // 8. MODAL: FAST SETTLEMENT (极速平账与逐笔结清)
  // -------------------------------------------------------------
  let settleContext = null;

  async function openSettleModal(personIdOrFrom, toPersonId = null, suggestedAmountCents = 0) {
    const modal = document.getElementById('modal-am-settle');
    if (!modal) return;

    // Find the target non-self person
    let targetPersonId = personIdOrUrl(personIdOrFrom);
    if (!targetPersonId || targetPersonId === state.mePersonId) {
      targetPersonId = toPersonId || (state.persons.find(p => !p.isSelf)?.id);
    }

    if (!targetPersonId) {
      return toast('⚠️ 请先添加人物以进行平账结算');
    }

    try {
      toast('⏳ 正在加载往来待结明细...');
      const res = await window.AMApi.getPersonDetail(targetPersonId);
      const { person, expenses } = res;
      const currentPersonData = state.persons.find(p => p.id === person.id) || person;

      const theyOweMe = currentPersonData.theyOweMe || 0;
      const iOweThem = currentPersonData.iOweThem || 0;
      const net = theyOweMe - iOweThem;

      let fromId = person.id;
      let toId = state.mePersonId;
      let fullAmount = theyOweMe;

      if (net < 0) {
        fromId = state.mePersonId;
        toId = person.id;
        fullAmount = iOweThem;
      }

      // Filter unsettled expenses related to this person
      const unsettledList = (expenses || []).filter(e => e.status === 'unsettled');

      settleContext = {
        targetPerson: person,
        fromPersonId: fromId,
        toPersonId: toId,
        fullAmountCents: fullAmount,
        unsettledExpenses: unsettledList,
        selectedExpenseIds: new Set(),
        selectedSumCents: 0
      };

      // Populate UI
      document.getElementById('am-settle-target-name').textContent = person.name;

      const labelEl = document.getElementById('am-settle-balance-label');
      const amtEl = document.getElementById('am-settle-balance-amount');
      const allBtn = document.getElementById('btn-am-settle-all');

      if (fullAmount > 0) {
        labelEl.textContent = net > 0 ? `💰 ${person.name} 当前总共欠你` : `💰 你当前总共欠 ${person.name}`;
        amtEl.textContent = formatMYR(fullAmount);
        amtEl.className = 'am-kpi-value ' + (net > 0 ? 'positive' : 'negative');
        allBtn.textContent = `⚡ 一键全额平账 (${formatMYR(fullAmount)})`;
        allBtn.disabled = false;
      } else {
        labelEl.textContent = `✨ 双方往来账目已结清`;
        amtEl.textContent = 'RM 0.00';
        amtEl.className = 'am-kpi-value settled';
        allBtn.textContent = `✓ 双方无未结款项`;
        allBtn.disabled = true;
      }

      // Render Checklist
      const checklistEl = document.getElementById('am-settle-checklist');
      const countEl = document.getElementById('am-settle-items-count');
      const selBtn = document.getElementById('btn-am-settle-selected');

      countEl.textContent = `${unsettledList.length} 笔未结项目`;
      selBtn.disabled = true;
      selBtn.textContent = '✓ 结清选中项目 (RM 0.00)';

      if (unsettledList.length === 0) {
        checklistEl.innerHTML = '<div style="padding:var(--space-3); text-align:center; color:var(--color-text-muted); font-size:0.85rem;">暂无独立未结垫付单据</div>';
      } else {
        checklistEl.innerHTML = unsettledList.map(e => `
          <div class="am-participant-row" style="cursor:pointer;" onclick="AdvanceManagerUI.toggleSettleItem('${e.id}')">
            <label class="am-part-label" style="cursor:pointer;">
              <input type="checkbox" id="chk-settle-${e.id}" onchange="event.stopPropagation(); AdvanceManagerUI.toggleSettleItem('${e.id}')">
              <span><strong>${e.description}</strong> <span style="font-size:0.75rem; color:var(--color-text-muted);">(${formatDate(e.transaction_date)})</span></span>
            </label>
            <span class="am-item-amount" style="font-size:0.9rem;">${formatMYR(e.total_amount)}</span>
          </div>
        `).join('');
      }

      modal.classList.remove('hidden');
      document.body.classList.add('modal-open');
    } catch (e) {
      toast('⚠️ 加载平账明细失败: ' + e.message);
    }
  }

  function personIdOrUrl(val) {
    if (!val) return null;
    return typeof val === 'string' ? val : null;
  }

  function toggleSettleItem(expId) {
    if (!settleContext) return;

    const chk = document.getElementById(`chk-settle-${expId}`);
    if (chk) chk.checked = !chk.checked;

    const isChecked = chk ? chk.checked : false;
    if (isChecked) {
      settleContext.selectedExpenseIds.add(expId);
    } else {
      settleContext.selectedExpenseIds.delete(expId);
    }

    // Calculate sum of selected
    let sum = 0;
    for (const exp of settleContext.unsettledExpenses) {
      if (settleContext.selectedExpenseIds.has(exp.id)) {
        sum += exp.total_amount;
      }
    }
    settleContext.selectedSumCents = sum;

    const selBtn = document.getElementById('btn-am-settle-selected');
    if (selBtn) {
      selBtn.disabled = settleContext.selectedExpenseIds.size === 0;
      selBtn.textContent = `✓ 结清选中的 ${settleContext.selectedExpenseIds.size} 项 (${formatMYR(sum)})`;
    }
  }

  async function executeSettleAll() {
    if (!settleContext || settleContext.fullAmountCents <= 0) return;

    try {
      toast('⏳ 正在执行一键全额平账...');
      const expIds = (settleContext.unsettledExpenses || []).map(e => e.id);
      await window.AMApi.createSettlement({
        from_person_id: settleContext.fromPersonId,
        to_person_id: settleContext.toPersonId,
        amount: settleContext.fullAmountCents,
        expense_ids: expIds,
        payment_method: '全额对冲结清'
      });

      toast(`✅ 已成功全额平账结清！`);
      closeModal('modal-am-settle');
      await Promise.all([refreshDashboard(), refreshPersons(), refreshExpenses(), refreshSettlements()]);
    } catch (e) {
      toast('❌ 平账失败: ' + e.message);
    }
  }

  async function executeSettleSelected() {
    if (!settleContext || settleContext.selectedSumCents <= 0) return;

    const expIds = Array.from(settleContext.selectedExpenseIds);

    try {
      toast(`⏳ 正在结清选中的 ${expIds.length} 笔项目...`);
      await window.AMApi.createSettlement({
        from_person_id: settleContext.fromPersonId,
        to_person_id: settleContext.toPersonId,
        amount: settleContext.selectedSumCents,
        expense_ids: expIds,
        payment_method: '按项选择结清'
      });

      toast(`✅ 选中的 ${expIds.length} 笔项目已成功平账结清！`);
      closeModal('modal-am-settle');
      await Promise.all([refreshDashboard(), refreshPersons(), refreshExpenses(), refreshSettlements()]);
    } catch (e) {
      toast('❌ 结清失败: ' + e.message);
    }
  }

  // -------------------------------------------------------------
  // 9. MODAL: EXPENSE DETAIL
  // -------------------------------------------------------------
  async function openExpenseDetail(expenseId) {
    const modal = document.getElementById('modal-am-detail');
    if (!modal) return;

    try {
      const res = await window.AMApi.getExpenseDetail(expenseId);
      const { expense, participants } = res;

      document.getElementById('am-detail-title').textContent = expense.description;
      document.getElementById('am-detail-amount').textContent = formatMYR(expense.total_amount);
      document.getElementById('am-detail-date').textContent = formatDate(expense.transaction_date, true);
      document.getElementById('am-detail-payer').textContent = expense.payer_name || '付款人';
      document.getElementById('am-detail-status').innerHTML = `<span class="am-pill-badge ${expense.status}">${expense.status.toUpperCase()}</span>`;
      document.getElementById('am-detail-note').textContent = expense.note || '无备注';

      const partsEl = document.getElementById('am-detail-participants');
      if (partsEl) {
        partsEl.innerHTML = (participants || []).map(p => `
          <div class="am-participant-row">
            <span class="am-item-title">${p.person_name || '参与人'}</span>
            <span class="am-item-amount">${formatMYR(p.share_amount)} (${p.split_type})</span>
          </div>
        `).join('');
      }

      // Receipt Display
      const receiptArea = document.getElementById('am-detail-receipt-area');
      if (receiptArea) {
        if (expense.attachment_data) {
          receiptArea.classList.remove('hidden');
          receiptArea.innerHTML = `
            <label style="font-size:0.85rem; color:var(--color-text-muted);">📸 发票/小票截图 (点击放大查看)</label>
            <div style="margin-top:4px;">
              <img src="${expense.attachment_data}" class="am-receipt-thumb" style="width:80px; height:80px;" onclick="AdvanceManagerUI.viewFullReceipt('${expense.attachment_data}')">
            </div>
          `;
        } else {
          receiptArea.classList.add('hidden');
          receiptArea.innerHTML = '';
        }
      }

      // Wire cancel button
      const cancelBtn = document.getElementById('btn-am-cancel-expense');
      if (cancelBtn) {
        cancelBtn.onclick = () => confirmCancelExpense(expense.id);
        cancelBtn.classList.toggle('hidden', expense.status === 'cancelled');
      }

      modal.classList.remove('hidden');
      document.body.classList.add('modal-open');
    } catch (e) {
      toast('⚠️ 无法加载详情: ' + e.message);
    }
  }

  async function confirmCancelExpense(expenseId) {
    if (!confirm('确定要取消此笔垫付吗？取消后该记录将不再计入债务余额，但会保留在历史记录中。')) return;

    try {
      toast('⏳ 正在取消垫付...');
      await window.AMApi.deleteExpense(expenseId);
      toast('✅ 垫付记录已取消');
      closeModal('modal-am-detail');
      await Promise.all([refreshDashboard(), refreshExpenses(), refreshPersons(), refreshProjects()]);
    } catch (e) {
      toast('❌ 取消失败: ' + e.message);
    }
  }

  // -------------------------------------------------------------
  // 10. MODAL: PERSON DETAIL & SHARE BILL
  // -------------------------------------------------------------
  async function openPersonDetail(personId) {
    const modal = document.getElementById('modal-am-person-detail');
    if (!modal) return;

    try {
      const res = await window.AMApi.getPersonDetail(personId);
      const { person, expenses, settlements } = res;

      // Find calculated balance
      const currentPersonData = state.persons.find(p => p.id === person.id) || person;

      document.getElementById('am-pdetail-name').textContent = person.name + (person.nickname ? ` (${person.nickname})` : '');
      document.getElementById('am-pdetail-contact').textContent = person.phone || person.email || '未填联系方式';

      // Edit person button
      const pEditBtn = document.getElementById('btn-am-pdetail-edit');
      if (pEditBtn) {
        pEditBtn.onclick = () => {
          closeModal('modal-am-person-detail');
          openEditPersonModal(person.id);
        };
        pEditBtn.classList.toggle('hidden', Boolean(person.isSelf || currentPersonData.isSelf));
      }

      // Settle action button
      const pSettleBtn = document.getElementById('btn-am-pdetail-settle');
      if (pSettleBtn) {
        pSettleBtn.onclick = () => {
          closeModal('modal-am-person-detail');
          openSettleModal(person.id, state.mePersonId, currentPersonData.theyOweMe || 0);
        };
      }

      // Copy WhatsApp Bill button
      const shareBtn = document.getElementById('btn-am-pdetail-share');
      if (shareBtn) {
        shareBtn.onclick = () => {
          const meName = (state.persons.find(p => p.isSelf)?.name) || '我';
          window.AMBill.copyBillToClipboard(currentPersonData, expenses, settlements, meName);
        };
      }

      // Ledger list
      const ledgerEl = document.getElementById('am-pdetail-ledger');
      if (ledgerEl) {
        const allTx = [
          ...expenses.map(e => ({ type: 'expense', date: e.transaction_date, title: e.description, amount: e.total_amount, raw: e })),
          ...settlements.map(s => ({ type: 'settle', date: s.settlement_date, title: `${s.from_name} ➔ ${s.to_name} 还款`, amount: s.amount, raw: s }))
        ];
        allTx.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (allTx.length === 0) {
          ledgerEl.innerHTML = '<div style="padding:var(--space-4); color:var(--color-text-muted); text-align:center;">暂无往来对账流水</div>';
        } else {
          ledgerEl.innerHTML = allTx.map(tx => `
            <div class="am-list-item">
              <div class="am-item-left">
                <span style="font-size:1.2rem;">${tx.type === 'expense' ? '💸' : '🤝'}</span>
                <div class="am-item-meta">
                  <span class="am-item-title">${tx.title}</span>
                  <span class="am-item-desc">${formatDate(tx.date, true)}</span>
                </div>
              </div>
              <div class="am-item-right">
                <span class="am-item-amount">${formatMYR(tx.amount)}</span>
              </div>
            </div>
          `).join('');
        }
      }

      modal.classList.remove('hidden');
      document.body.classList.add('modal-open');
    } catch (e) {
      toast('⚠️ 无法加载人物详情: ' + e.message);
    }
  }

  async function cleanupHistory() {
    if (!confirm('确定要清理过往已结清的账单吗？\n系统将自动删除多余的已结清历史，仅保留最新 5 条记录作为回溯参考。未结清的账目不受任何影响。')) return;

    try {
      toast('⏳ 正在执行历史冗余数据清理...');
      const res = await window.AMApi.cleanupSettledHistory();
      toast(res.message || '✅ 已清理历史已结账单！');
      await Promise.all([refreshDashboard(), refreshExpenses(), refreshSettlements()]);
    } catch (e) {
      toast('❌ 清理失败: ' + e.message);
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }

  // -------------------------------------------------------------
  // 11. EDIT PERSON MODAL
  // -------------------------------------------------------------
  function openEditPersonModal(personId) {
    const modal = document.getElementById('modal-am-edit-person');
    if (!modal) return;

    const person = state.persons.find(p => p.id === personId);
    if (!person) return toast('⚠️ 未找到该人物资料');

    editingPersonId = personId;
    document.getElementById('am-edit-person-id').value = person.id;
    document.getElementById('am-edit-person-name').value = person.name || '';
    document.getElementById('am-edit-person-nickname').value = person.nickname || '';
    document.getElementById('am-edit-person-phone').value = person.phone || '';
    document.getElementById('am-edit-person-note').value = person.note || '';

    const tempRadio = document.getElementById('am-edit-person-type-temp');
    const permRadio = document.getElementById('am-edit-person-type-perm');
    if (tempRadio && permRadio) {
      tempRadio.checked = Boolean(person.is_temporary);
      permRadio.checked = !person.is_temporary;
    }

    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  async function submitEditPerson() {
    if (!editingPersonId) return;

    const name = document.getElementById('am-edit-person-name').value.trim();
    const nickname = document.getElementById('am-edit-person-nickname').value.trim();
    const phone = document.getElementById('am-edit-person-phone').value.trim();
    const note = document.getElementById('am-edit-person-note').value.trim();
    const isTemp = document.getElementById('am-edit-person-type-temp')?.checked || false;

    if (!name) return toast('⚠️ 姓名不能为空');

    try {
      toast('⏳ 正在更新人物资料...');
      await window.AMApi.updatePerson(editingPersonId, {
        name,
        nickname,
        phone,
        note,
        is_temporary: isTemp ? 1 : 0
      });

      toast('✅ 人物资料更新成功！');
      closeModal('modal-am-edit-person');
      await Promise.all([refreshPersons(), refreshDashboard(), refreshExpenses()]);
    } catch (e) {
      toast('❌ 更新失败: ' + e.message);
    }
  }

  async function confirmArchivePerson() {
    if (!editingPersonId) return;
    if (!confirm('确定要归档/移除该人物吗？归档后该人物将从常用列表隐藏。')) return;

    try {
      toast('⏳ 正在归档人物...');
      await window.AMApi.updatePerson(editingPersonId, { is_archived: 1 });
      toast('✅ 人物已成功归档！');
      closeModal('modal-am-edit-person');
      await refreshPersons();
    } catch (e) {
      toast('❌ 归档失败: ' + e.message);
    }
  }

  return {
    initAdvanceManagerUI,
    loadInitialData,
    switchTab,
    openNewExpenseModal,
    openNewPersonModal,
    openEditPersonModal,
    openNewProjectModal,
    openProjectDetail,
    openSettleModal,
    openExpenseDetail,
    openPersonDetail,
    setSplitMode,
    addParticipantFromSelect,
    removeParticipant,
    handleTotalAmountChange,
    handleShareInput,
    handlePercentInput,
    handleReceiptFileSelect,
    removeReceipt,
    viewFullReceipt,
    handleSearchInput,
    handleStatusFilter,
    handlePersonFilter,
    handlePersonSortChange,
    submitNewExpense,
    submitNewPerson,
    submitEditPerson,
    confirmArchivePerson,
    submitNewProject,
    executeSettleAll,
    executeSettleSelected,
    toggleSettleItem,
    confirmCancelExpense,
    cleanupHistory,
    toggleFavourite,
    closeModal
  };
})();
