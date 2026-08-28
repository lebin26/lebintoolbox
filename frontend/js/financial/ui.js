/**
 * Financial Overview - Complete Frontend UI Controller Module
 * Handles Dashboard, Monthly Data Entry, Platforms & Products CRUD, Matrix Analytics, and Dialogs.
 */

(function () {
  // ── Utility Helpers ──
  function showToast(msg) {
    if (typeof window.showToast === 'function') {
      window.showToast(msg);
    } else {
      alert(msg);
    }
  }

  function getActiveMonth() {
    return window.FinancialState.currentMonth || new Date().toISOString().slice(0, 7);
  }

  // Debounce utility for resize and input events
  function debounce(fn, ms) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  // Track unsaved changes in monthly entry
  let _hasUnsavedChanges = false;
  function markDirty() { _hasUnsavedChanges = true; }
  function markClean() { _hasUnsavedChanges = false; }

  // Loading state helper (unobtrusive & fast)
  function setLoading(containerId, loading = true) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (loading) {
      el.setAttribute('data-loading', 'true');
    } else {
      el.removeAttribute('data-loading');
    }
  }

  // -------------------------------------------------------------
  // 1. MAIN INITIALIZATION & VIEW ROUTING
  // -------------------------------------------------------------
  async function initFinancialUI() {
    bindGlobalEvents();
    bindModals();
    window.addEventListener('auth:change', async () => {
      await refreshCurrentTab();
    });
    await switchSubTab(window.FinancialState.activeTab || 'dashboard');
  }

  function bindGlobalEvents() {
    // Sub-tab switcher buttons
    const tabBtns = document.querySelectorAll('.fin-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab) switchSubTab(tab);
      });
    });

    // Month Selector Buttons
    const monthInput = document.getElementById('fin-month-picker');
    const prevMonthBtn = document.getElementById('fin-prev-month-btn');
    const nextMonthBtn = document.getElementById('fin-next-month-btn');

    if (monthInput) {
      monthInput.value = getActiveMonth();
      monthInput.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val) {
          window.FinancialState.setMonth(val);
          refreshCurrentTab();
        }
      });
    }

    if (prevMonthBtn) {
      prevMonthBtn.addEventListener('click', () => {
        adjustMonth(-1);
      });
    }
    if (nextMonthBtn) {
      nextMonthBtn.addEventListener('click', () => {
        adjustMonth(1);
      });
    }

    // Responsive Canvas Re-render on Window Resize (debounced to prevent jank)
    window.addEventListener('resize', debounce(() => {
      if (window.FinancialState.activeTab === 'dashboard' && window.FinancialState.dashboardData) {
        const canvas = document.getElementById('fin-asset-curve-canvas');
        if (canvas && window.FinancialCharts) {
          window.FinancialCharts.renderAssetCurve(canvas, window.FinancialState.dashboardData.assetTrend || []);
        }
      }
    }, 200));

    // Global keyboard shortcut: Ctrl+S to save month snapshot when in monthly tab
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        if (window.FinancialState.activeTab === 'monthly') {
          e.preventDefault();
          const saveBtn = document.getElementById('fin-btn-save-month');
          if (saveBtn && !saveBtn.disabled) saveBtn.click();
        }
      }
    });

    // Warn before leaving if unsaved changes exist
    window.addEventListener('beforeunload', (e) => {
      if (_hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  function adjustMonth(delta) {
    const cur = getActiveMonth();
    const [yStr, mStr] = cur.split('-');
    let year = parseInt(yStr, 10);
    let month = parseInt(mStr, 10) + delta;

    if (month < 1) {
      month = 12;
      year -= 1;
    } else if (month > 12) {
      month = 1;
      year += 1;
    }
    const newMonth = `${year}-${String(month).padStart(2, '0')}`;
    window.FinancialState.setMonth(newMonth);

    const monthInput = document.getElementById('fin-month-picker');
    if (monthInput) monthInput.value = newMonth;

    refreshCurrentTab();
  }

  async function switchSubTab(tabName) {
    window.FinancialState.setActiveTab(tabName);

    // Update active tab buttons
    document.querySelectorAll('.fin-tab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tabName);
    });

    // Hide all sub-tab contents
    const tabContents = {
      dashboard: document.getElementById('fin-tab-dashboard'),
      monthly: document.getElementById('fin-tab-monthly'),
      platforms: document.getElementById('fin-tab-platforms'),
      products: document.getElementById('fin-tab-products'),
      analytics: document.getElementById('fin-tab-analytics')
    };

    Object.keys(tabContents).forEach(k => {
      const el = tabContents[k];
      if (el) el.classList.toggle('hidden', k !== tabName);
    });

    await refreshCurrentTab();
  }

  async function refreshCurrentTab() {
    const tab = window.FinancialState.activeTab;
    const curMonth = getActiveMonth();

    try {
      if (tab === 'dashboard') {
        await loadDashboard(curMonth);
      } else if (tab === 'monthly') {
        await loadMonthlyDataEntry(curMonth);
      } else if (tab === 'platforms') {
        await loadPlatforms();
      } else if (tab === 'products') {
        await loadProducts();
      } else if (tab === 'analytics') {
        await loadAnalytics();
      }
    } catch (err) {
      console.error('Error loading tab:', tab, err);
      showToast(`加载失败: ${err.message}`);
    }
  }

  async function loadDashboard(monthKey) {
    setLoading('fin-dashboard-content-area', true);
    let data = null;
    try {
      data = await window.FinancialAPI.getDashboard(monthKey);
    } catch (e) {
      console.warn('[FinancialUI] Dashboard load error:', e);
    }
    if (!data) {
      data = {
        monthKey,
        totalAssets: 0,
        reportedCount: 0,
        platformAllocation: [],
        productTypeAllocation: [],
        currencyExposure: [],
        assetTrend: [],
        topMovers: []
      };
    }
    window.FinancialState.dashboardData = data;
    setLoading('fin-dashboard-content-area', false);

    const contentArea = document.getElementById('fin-dashboard-content-area');
    if (!contentArea) return;

    // Check if current month has zero recorded assets and zero reported products
    if ((!data.totalAssets || data.totalAssets === 0) && (!data.reportedCount || data.reportedCount === 0)) {
      const platRes = await window.FinancialAPI.getPlatforms();
      const platList = (platRes && Array.isArray(platRes.platforms)) ? platRes.platforms : [];
      const prodRes = await window.FinancialAPI.getProducts();
      const prodList = (prodRes && Array.isArray(prodRes.products)) ? prodRes.products : [];

      let descHtml = `您尚未录入 ${monthKey} 各金融机构账户的月末余额。立即录入或一键沿用上月余额，开启可视化资产大盘与走势分析。`;
      let actionsHtml = `
        <button type="button" class="fin-btn-save" onclick="FinancialUI.switchTab('monthly')">
          <span>✍️</span> <span>去【月度录入】填写余额</span>
        </button>
        <button type="button" class="fin-btn-copy" onclick="FinancialUI.copyPreviousAndOpen('${monthKey}')">
          <span>📋</span> <span>沿用上月数据</span>
        </button>
      `;

      if (data.latestRecordedMonth && data.latestRecordedMonth !== monthKey) {
        descHtml = `您在 <strong>${data.latestRecordedMonth}</strong> 录入过历史资产数据！您可以直接切换至该月份查看，或一键将数据沿用至 ${monthKey}。`;
        actionsHtml = `
          <button type="button" class="fin-btn-save" onclick="FinancialUI.jumpToMonth('${data.latestRecordedMonth}')">
            <span>📅</span> <span>查看 ${data.latestRecordedMonth} 资产大盘</span>
          </button>
          <button type="button" class="fin-btn-copy" onclick="FinancialUI.copyPreviousAndOpen('${monthKey}')">
            <span>📋</span> <span>沿用历史数据至 ${monthKey}</span>
          </button>
          <button type="button" class="fin-btn-outline" onclick="FinancialUI.switchTab('monthly')">
            <span>✍️</span> <span>去【月度录入】</span>
          </button>
        `;
      } else if (platList.length > 0) {
        descHtml = `您当前已配置 <strong>${platList.length}</strong> 个平台机构与 <strong>${prodList.length}</strong> 个产品账户，数据完整保留。<br>请前往【月度录入】填写 ${monthKey} 的月末余额即可生成大盘！`;
        actionsHtml = `
          <button type="button" class="fin-btn-save" onclick="FinancialUI.switchTab('monthly')">
            <span>✍️</span> <span>去【月度录入】填写余额</span>
          </button>
          <button type="button" class="fin-btn-copy" onclick="FinancialUI.switchTab('platforms')">
            <span>🏛️</span> <span>平台管理 (${platList.length})</span>
          </button>
          <button type="button" class="fin-btn-outline" onclick="FinancialUI.switchTab('products')">
            <span>🏷️</span> <span>产品管理 (${prodList.length})</span>
          </button>
        `;
      }

      contentArea.innerHTML = `
        <div class="fin-empty-state">
          <div class="fin-empty-icon">📊</div>
          <h3 class="fin-empty-title">${monthKey} 暂无资产快照数据</h3>
          <p class="fin-empty-desc">${descHtml}</p>
          <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:14px;">
            ${actionsHtml}
          </div>
        </div>
      `;
      return;
    }

    // Reset default dashboard markup structure if it was replaced by empty state
    contentArea.innerHTML = `
      <section class="fin-kpi-grid">
        <div class="fin-kpi-card">
          <span class="fin-kpi-label">💰 当月净总资产 (Total Net Worth)</span>
          <div class="fin-kpi-val" id="fin-kpi-total-assets">
            ${window.FinancialFormatters.formatCurrencyHTML(data.totalAssets, 'MYR')}
          </div>
          <div class="fin-kpi-sub" id="fin-kpi-mom-badge"></div>
        </div>

        <div class="fin-kpi-card">
          <span class="fin-kpi-label">📊 录入状态 & 覆盖率</span>
          <div class="fin-kpi-val" id="fin-kpi-reported-count">${data.reportedCount || 0} 个产品已录入</div>
          <div class="fin-kpi-sub" style="color: #10b981;">
            <span>⚡</span> <span>Cloudflare D1 实时云端同步</span>
          </div>
        </div>
      </section>

      <div class="fin-dashboard-grid" style="margin-top: 20px;">
        <div class="fin-card">
          <div class="fin-card-header">
            <h3 class="fin-card-title">📈 资产历史走势 (Asset Trend)</h3>
          </div>
          <div class="fin-card-body">
            <div class="fin-chart-container">
              <canvas id="fin-asset-curve-canvas" class="fin-chart-canvas"></canvas>
            </div>
          </div>
        </div>

        <div class="fin-card">
          <div class="fin-card-header">
            <h3 class="fin-card-title">🏛️ 各机构资金分布 (By Platform)</h3>
          </div>
          <div class="fin-card-body">
            <div class="fin-alloc-list" id="fin-platform-alloc-list"></div>
          </div>
        </div>

        <div class="fin-card">
          <div class="fin-card-header">
            <h3 class="fin-card-title">🏷️ 资产大类分布与偏离度 (By Category)</h3>
          </div>
          <div class="fin-card-body">
            <div class="fin-alloc-list" id="fin-prodtype-alloc-list"></div>
          </div>
        </div>

        <div class="fin-card">
          <div class="fin-card-header">
            <h3 class="fin-card-title">💱 币种敞口分布 (Currency Exposure)</h3>
          </div>
          <div class="fin-card-body">
            <div class="fin-alloc-list" id="fin-currency-alloc-list"></div>
          </div>
        </div>

        <div class="fin-card" style="grid-column: 1 / -1;">
          <div class="fin-card-header">
            <h3 class="fin-card-title">🚀 环比波动 Top 5 (MoM Changes)</h3>
          </div>
          <div class="fin-card-body">
            <div class="fin-movers-list" id="fin-top-movers-list"></div>
          </div>
        </div>
      </div>
    `;

    // 1. MoM Badge
    const momBadgeEl = document.getElementById('fin-kpi-mom-badge');
    if (momBadgeEl) {
      const mom = window.FinancialFormatters.formatMoM(data.momChange, data.momPct, 'MYR');
      momBadgeEl.className = `fin-kpi-sub ${mom.className}`;
      momBadgeEl.innerHTML = `<span>${mom.icon}</span> <span>${mom.text} 较上月</span>`;
    }

    // 2. Asset Curve Chart
    const canvas = document.getElementById('fin-asset-curve-canvas');
    if (canvas && window.FinancialCharts) {
      window.FinancialCharts.renderAssetCurve(canvas, data.assetTrend || []);
    }

    // 3. Platform Allocation Breakdown
    const platAllocList = document.getElementById('fin-platform-alloc-list');
    if (platAllocList) {
      if (!data.platformAllocation || data.platformAllocation.length === 0) {
        platAllocList.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted);">暂无平台资金数据</div>`;
      } else {
        const colors = ['#10b981', '#38bdf8', '#8b5cf6', '#f59e0b', '#ec4899', '#6366f1'];
        platAllocList.innerHTML = data.platformAllocation.map((p, idx) => {
          const color = colors[idx % colors.length];
          const logoHtml = p.platformLogoUrl ? `<img src="${p.platformLogoUrl}" class="fin-plat-logo" alt="">` : `<span>🏛️</span>`;
          return `
            <div class="fin-alloc-item">
              <div class="fin-alloc-row">
                <div class="fin-alloc-name">
                  ${logoHtml}
                  <span>${p.platformName}</span>
                </div>
                <div class="fin-alloc-amount">
                  ${window.FinancialFormatters.formatCurrency(p.amount, 'MYR')}
                  <span class="fin-alloc-pct">(${window.FinancialFormatters.formatPct(p.pct)})</span>
                </div>
              </div>
              <div class="fin-progress-bar">
                <div class="fin-progress-fill" style="width: ${Math.min(100, Math.max(0, p.pct))}%; background: ${color};"></div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // 4. Product Type Breakdown with Rebalancing Drift
    const prodTypeAllocList = document.getElementById('fin-prodtype-alloc-list');
    if (prodTypeAllocList) {
      if (!data.productTypeAllocation || data.productTypeAllocation.length === 0) {
        prodTypeAllocList.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted);">暂无产品分类数据</div>`;
      } else {
        const colors = ['#38bdf8', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
        prodTypeAllocList.innerHTML = data.productTypeAllocation.map((pt, idx) => {
          const color = colors[idx % colors.length];
          const icon = window.FinancialFormatters.getTypeIcon(pt.productType);

          return `
            <div class="fin-alloc-item">
              <div class="fin-alloc-row">
                <div class="fin-alloc-name">
                  <span>${icon}</span>
                  <span>${pt.productType}</span>
                </div>
                <div class="fin-alloc-amount">
                  ${window.FinancialFormatters.formatCurrency(pt.amount, 'MYR')}
                  <span class="fin-alloc-pct">(${window.FinancialFormatters.formatPct(pt.pct)})</span>
                </div>
              </div>
              <div class="fin-progress-bar">
                <div class="fin-progress-fill" style="width: ${Math.min(100, Math.max(0, pt.pct))}%; background: ${color};"></div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // 5. Currency Exposure Breakdown
    const currAllocList = document.getElementById('fin-currency-alloc-list');
    if (currAllocList) {
      const exposureList = data.currencyExposure || [];
      if (exposureList.length === 0) {
        currAllocList.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted);">暂无币种敞口数据</div>`;
      } else {
        const currColors = { MYR: '#10b981', USD: '#38bdf8', SGD: '#8b5cf6', HKD: '#f59e0b', EUR: '#ec4899', GBP: '#6366f1' };
        currAllocList.innerHTML = exposureList.map(c => {
          const sym = window.FinancialFormatters.getCurrencySymbol(c.currency);
          const color = currColors[c.currency] || '#38bdf8';
          const nativeStr = c.currency !== 'MYR' ? `<span style="font-size:0.75rem; color:var(--text-muted); margin-right:6px;">(原币: ${sym} ${Number(c.nativeAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })})</span>` : '';

          return `
            <div class="fin-alloc-item">
              <div class="fin-alloc-row">
                <div class="fin-alloc-name">
                  <span style="font-family:var(--font-mono); font-weight:800; color:${color};">${c.currency}</span>
                  <span style="font-size:0.8rem; color:var(--text-muted);">${c.currency === 'MYR' ? '本位币' : '外币折算'}</span>
                </div>
                <div class="fin-alloc-amount">
                  ${nativeStr}
                  ${window.FinancialFormatters.formatCurrency(c.baseAmount, 'MYR')}
                  <span class="fin-alloc-pct">(${window.FinancialFormatters.formatPct(c.pct)})</span>
                </div>
              </div>
              <div class="fin-progress-bar">
                <div class="fin-progress-fill" style="width: ${Math.min(100, Math.max(0, c.pct))}%; background: ${color};"></div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // 6. Top Movers
    const moversListEl = document.getElementById('fin-top-movers-list');
    if (moversListEl) {
      if (!data.topMovers || data.topMovers.length === 0) {
        moversListEl.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted);">本月暂无产品变动对比</div>`;
      } else {
        moversListEl.innerHTML = data.topMovers.map(m => {
          const diffNum = Number(m.diff);
          const isPos = diffNum > 0;
          const isNeg = diffNum < 0;
          const diffStr = (isPos ? '+' : '') + window.FinancialFormatters.formatCurrency(diffNum, 'MYR');
          const tagClass = isPos ? 'tag-bullish' : isNeg ? 'tag-bearish' : 'tag-neutral';

          return `
            <div class="fin-mover-item">
              <div class="fin-mover-info">
                <span class="fin-mover-name">${m.productName}</span>
                <span class="fin-mover-plat">🏛️ ${m.platformName} (${m.currency})</span>
              </div>
              <span class="fin-mover-diff ${tagClass}">${diffStr}</span>
            </div>
          `;
        }).join('');
      }
    }
  }

  async function copyPreviousAndOpen(monthKey) {
    try {
      await window.FinancialAPI.copyPreviousMonth(monthKey);
      showToast(`✅ 成功沿用上月余额到 ${monthKey}！`);
      await switchSubTab('monthly');
    } catch (err) {
      showToast(`沿用失败: ${err.message}`);
      await switchSubTab('monthly');
    }
  }

  async function loadMonthlyDataEntry(monthKey) {
    markClean();
    setLoading('fin-entry-groups-container', true);
    let data = null;
    try {
      data = await window.FinancialAPI.getMonthSnapshots(monthKey);
    } catch (e) {
      console.warn('[FinancialUI] Monthly load error:', e);
    }
    if (!data || !Array.isArray(data.items)) {
      data = { items: [], notes: '', status: 'draft' };
    }
    window.FinancialState.monthSnapshotData = data;
    setLoading('fin-entry-groups-container', false);

    const container = document.getElementById('fin-entry-groups-container');
    if (!container) return;

    if (!data.items || data.items.length === 0) {
      container.innerHTML = `
        <div class="fin-empty-state">
          <div class="fin-empty-icon">🏛️</div>
          <h3 class="fin-empty-title">暂未创建平台与金融产品</h3>
          <p class="fin-empty-desc">请先前往【平台管理】与【产品管理】建立您的银行账户与投资产品组合。</p>
          <button type="button" class="fin-btn-save" onclick="FinancialUI.switchTab('platforms')">
            <span>➕</span> <span>创建第一个平台</span>
          </button>
        </div>
      `;
      return;
    }

    // Group items by platform safely using platformId
    const platformMap = new Map();
    data.items.forEach(item => {
      const pId = Number(item.platformId);
      if (!platformMap.has(pId)) {
        platformMap.set(pId, {
          platformId: pId,
          platformName: item.platformName || '未知平台',
          platformLogoUrl: item.platformLogoUrl || null,
          products: []
        });
      }
      platformMap.get(pId).products.push(item);
    });

    let html = '';
    let globalInputIndex = 1;

    for (const plat of platformMap.values()) {
      const logoHtml = plat.platformLogoUrl ? `<img src="${plat.platformLogoUrl}" class="fin-plat-logo" alt="">` : `<span>🏛️</span>`;

      // Calculate platform subtotal from current snapshots
      let platSubtotal = 0;
      let platReportedCount = 0;
      plat.products.forEach(p => {
        if (p.nativeAmount !== null && p.nativeAmount !== undefined) {
          const fx = p.fxRateToBase || 1.0;
          platSubtotal += (p.currency === 'MYR') ? Number(p.nativeAmount) : (Number(p.nativeAmount) * fx);
          platReportedCount++;
        }
      });
      const subtotalStr = platSubtotal > 0 ? window.FinancialFormatters.formatCurrency(platSubtotal, 'MYR') : '';

      html += `
        <div class="fin-plat-group-card" data-platform-id="${plat.platformId}">
          <div class="fin-plat-group-title" style="cursor:pointer;" onclick="FinancialUI.togglePlatformGroup(${plat.platformId})">
            <div class="fin-plat-header-left">
              ${logoHtml}
              <span>${plat.platformName}</span>
              <span class="fin-plat-collapse-icon" id="fin-collapse-icon-${plat.platformId}" style="font-size:0.7rem; color:var(--text-muted); transition:transform 0.2s;">▼</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              ${subtotalStr ? `<span class="fin-plat-subtotal" id="fin-plat-subtotal-${plat.platformId}" style="font-size:0.82rem; font-weight:700; color:var(--fin-primary); font-variant-numeric:tabular-nums;">${subtotalStr}</span>` : ''}
              <span style="font-size:0.8rem; color:var(--text-muted); font-weight:600;">${platReportedCount}/${plat.products.length} 已录</span>
            </div>
          </div>

          <div class="fin-plat-products-table" id="fin-plat-body-${plat.platformId}">
      `;

      plat.products.forEach(p => {
        const typeIcon = window.FinancialFormatters.getTypeIcon(p.productType);
        const prevValStr = p.previousNativeAmount !== null ? `${p.currency} ${Number(p.previousNativeAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '未录入';
        const curVal = p.nativeAmount !== null && p.nativeAmount !== undefined ? p.nativeAmount : '';
        const prevRaw = p.previousNativeAmount !== null ? p.previousNativeAmount : '';
        const prevFx = p.previousFxRate !== null ? p.previousFxRate : 1.0;

        // Delta badge between current and previous
        let deltaBadge = '';
        if (p.nativeAmount !== null && p.previousNativeAmount !== null) {
          const diff = Number(p.nativeAmount) - Number(p.previousNativeAmount);
          if (Math.abs(diff) > 0.01) {
            const diffSign = diff > 0 ? '+' : '';
            const diffColor = diff > 0 ? '#10b981' : '#ef4444';
            deltaBadge = `<span style="font-size:0.72rem; font-weight:700; color:${diffColor}; font-variant-numeric:tabular-nums; margin-left:4px;">${diffSign}${diff.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>`;
          }
        }

        // Real-time base amount preview for foreign currency
        const curBasePreview = (p.currency !== 'MYR' && curVal !== '') ?
          `<span class="fin-base-preview" id="fin-base-preview-${p.productId}" style="font-size:0.72rem; color:var(--text-muted); font-variant-numeric:tabular-nums;">≈ RM ${(Number(curVal) * (p.fxRateToBase || 1.0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>` : 
          (p.currency !== 'MYR' ? `<span class="fin-base-preview" id="fin-base-preview-${p.productId}" style="font-size:0.72rem; color:var(--text-muted);"></span>` : '');

        html += `
          <div class="fin-product-entry-row" data-product-id="${p.productId}" data-currency="${p.currency}" data-prev-val="${prevRaw}" data-prev-fx="${prevFx}" data-platform-id="${plat.platformId}">
            <div class="fin-prod-name-box">
              <span class="fin-prod-name">${typeIcon} ${p.productName}</span>
              <span class="fin-prod-badge">${p.productType} · ${p.currency} ${deltaBadge}</span>
            </div>

            <div class="fin-prev-amount">
              <span style="font-size:0.75rem; color:var(--text-muted);">上月:</span>
              <strong title="点击一键填入此数值" onclick="FinancialUI.copyRowPrevious(${p.productId})">${prevValStr}</strong>
            </div>

            <div style="display:flex; flex-direction:column; gap:3px;">
              <div style="display:flex; align-items:center; gap:6px;">
                <div class="fin-input-wrapper" style="flex:1;">
                  <span class="fin-currency-label">${p.currency}</span>
                  <input type="number" step="0.01" min="0" class="fin-amount-input fin-input-native"
                         data-product-id="${p.productId}"
                         data-platform-id="${plat.platformId}"
                         tabindex="${globalInputIndex++}"
                         placeholder="本月余额 (留空为未报)"
                         value="${curVal}">
                </div>
                ${p.previousNativeAmount !== null ? `
                  <button type="button" class="fin-btn-row-copy" title="沿用上月余额" onclick="FinancialUI.copyRowPrevious(${p.productId})">
                    ⚡ 沿用
                  </button>
                ` : ''}
              </div>
              ${curBasePreview}
            </div>

            <div class="fin-fx-box">
              ${p.currency !== 'MYR' ? `
                <div style="font-size:0.75rem; color:var(--text-muted); display:flex; align-items:center; gap:4px;">
                  <span>汇率:</span>
                  <input type="number" step="0.0001" min="0.0001" class="fin-fx-input" data-product-id="${p.productId}" data-platform-id="${plat.platformId}" style="width:68px; background:var(--surface-elevated); border:1px solid var(--border-strong); color:var(--text-primary); border-radius:6px; padding:3px 6px; font-variant-numeric:tabular-nums;" value="${p.fxRateToBase || 1.0}">
                </div>
              ` : `<span style="font-size:0.8rem; color:var(--text-muted); font-family:var(--font-mono);">本位币 (MYR)</span>`}
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    }

    container.innerHTML = html;

    // Bind Enter key to focus next input & real-time base amount preview
    const inputs = container.querySelectorAll('.fin-amount-input');
    inputs.forEach((input, idx) => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (idx + 1 < inputs.length) {
            inputs[idx + 1].focus();
            inputs[idx + 1].select();
          } else {
            // Last input -> save
            const saveBtn = document.getElementById('fin-btn-save-month');
            if (saveBtn) saveBtn.click();
          }
        }
      });

      // Mark as dirty & update real-time base amount preview on input
      input.addEventListener('input', debounce(() => {
        markDirty();
        updateRowBasePreview(input);
        updatePlatformSubtotal(input.getAttribute('data-platform-id'));
      }, 120));
    });

    // Also bind FX rate inputs for real-time preview update
    const fxInputs = container.querySelectorAll('.fin-fx-input');
    fxInputs.forEach(fxInput => {
      fxInput.addEventListener('input', debounce(() => {
        markDirty();
        const productId = fxInput.getAttribute('data-product-id');
        const amountInput = container.querySelector(`.fin-amount-input[data-product-id="${productId}"]`);
        if (amountInput) {
          updateRowBasePreview(amountInput);
          updatePlatformSubtotal(fxInput.getAttribute('data-platform-id'));
        }
      }, 120));
    });

    // Bind Copy Previous Month Button (Whole Month)
    const copyBtn = document.getElementById('fin-btn-copy-prev');
    if (copyBtn) {
      copyBtn.onclick = async () => {
        if (confirm(`确认要将 ${data.previousMonthKey} 的所有产品余额复制到 ${monthKey} 作为草稿吗？现有同月数据将被覆盖。`)) {
          try {
            await window.FinancialAPI.copyPreviousMonth(monthKey);
            showToast(`✅ 成功复制上月数据到 ${monthKey}！`);
            await loadMonthlyDataEntry(monthKey);
          } catch (err) {
            showToast(`复制失败: ${err.message}`);
          }
        }
      };
    }

    // Bind Batch Save Button
    const saveBtn = document.getElementById('fin-btn-save-month');
    if (saveBtn) {
      saveBtn.onclick = async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = '保存中...';

        try {
          const rows = container.querySelectorAll('.fin-product-entry-row');
          const itemsToSave = [];

          rows.forEach(row => {
            const productId = parseInt(row.getAttribute('data-product-id'), 10);
            const currency = row.getAttribute('data-currency');
            const inputEl = row.querySelector('.fin-input-native');
            const fxEl = row.querySelector('.fin-fx-input');

            const valStr = inputEl ? inputEl.value.trim() : '';
            const fxRate = fxEl ? (parseFloat(fxEl.value) || 1.0) : 1.0;

            if (valStr === '') {
              // Not reported
              itemsToSave.push({ productId, nativeAmount: null });
            } else {
              const nativeAmount = parseFloat(valStr) || 0.0;
              const baseAmount = currency === 'MYR' ? nativeAmount : (nativeAmount * fxRate);
              itemsToSave.push({
                productId,
                currency,
                nativeAmount,
                fxRateToBase: fxRate,
                baseAmount
              });
            }
          });

          await window.FinancialAPI.saveBatchSnapshots({
            monthKey,
            items: itemsToSave,
            status: 'draft'
          });

          markClean();
          showToast(`🎉 ${monthKey} 余额快照保存成功！`);
          await loadMonthlyDataEntry(monthKey);
        } catch (err) {
          showToast(`保存失败: ${err.message}`);
        } finally {
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<span>💾</span> <span>保存当月快照</span>';
        }
      };
    }
  }

  // Real-time base amount preview for foreign currency rows
  function updateRowBasePreview(amountInput) {
    const row = amountInput.closest('.fin-product-entry-row');
    if (!row) return;
    const currency = row.getAttribute('data-currency');
    if (currency === 'MYR') return;

    const productId = amountInput.getAttribute('data-product-id');
    const previewEl = document.getElementById(`fin-base-preview-${productId}`);
    if (!previewEl) return;

    const val = parseFloat(amountInput.value) || 0;
    const fxInput = row.querySelector('.fin-fx-input');
    const fx = fxInput ? (parseFloat(fxInput.value) || 1.0) : 1.0;

    if (val > 0) {
      const base = val * fx;
      previewEl.textContent = `≈ RM ${base.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      previewEl.textContent = '';
    }
  }

  // Update platform group subtotal in real-time
  function updatePlatformSubtotal(platformId) {
    if (!platformId) return;
    const subtotalEl = document.getElementById(`fin-plat-subtotal-${platformId}`);
    const rows = document.querySelectorAll(`.fin-product-entry-row[data-platform-id="${platformId}"]`);
    let total = 0;
    rows.forEach(row => {
      const currency = row.getAttribute('data-currency');
      const inputEl = row.querySelector('.fin-input-native');
      const fxEl = row.querySelector('.fin-fx-input');
      const val = inputEl ? (parseFloat(inputEl.value) || 0) : 0;
      const fx = fxEl ? (parseFloat(fxEl.value) || 1.0) : 1.0;
      total += (currency === 'MYR') ? val : (val * fx);
    });
    if (subtotalEl) {
      subtotalEl.textContent = total > 0 ? window.FinancialFormatters.formatCurrency(total, 'MYR') : '';
    }
  }

  // Toggle collapse/expand platform group in monthly entry
  function togglePlatformGroup(platformId) {
    const body = document.getElementById(`fin-plat-body-${platformId}`);
    const icon = document.getElementById(`fin-collapse-icon-${platformId}`);
    if (!body) return;
    const isHidden = body.style.display === 'none';
    body.style.display = isHidden ? '' : 'none';
    if (icon) icon.style.transform = isHidden ? '' : 'rotate(-90deg)';
  }

  function copyRowPrevious(productId) {
    const row = document.querySelector(`.fin-product-entry-row[data-product-id="${productId}"]`);
    if (!row) return;

    const prevVal = row.getAttribute('data-prev-val');
    const prevFx = row.getAttribute('data-prev-fx');
    const inputEl = row.querySelector('.fin-input-native');
    const fxEl = row.querySelector('.fin-fx-input');

    if (prevVal !== null && prevVal !== '' && inputEl) {
      inputEl.value = prevVal;
      if (fxEl && prevFx) {
        fxEl.value = prevFx;
      }
      // Visual feedback flash
      inputEl.parentElement.style.borderColor = '#10b981';
      inputEl.parentElement.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.3)';
      setTimeout(() => {
        inputEl.parentElement.style.borderColor = '';
        inputEl.parentElement.style.boxShadow = '';
      }, 600);
      inputEl.focus();
    } else {
      showToast('上月未录入该产品数据');
    }
  }

  async function loadPlatforms() {
    let data = null;
    try {
      data = await window.FinancialAPI.getPlatforms();
    } catch (e) {
      console.warn('[FinancialUI] Platforms load error:', e);
    }
    window.FinancialState.platforms = (data && Array.isArray(data.platforms)) ? data.platforms : [];

    const container = document.getElementById('fin-platforms-grid');
    if (!container) return;

    if (window.FinancialState.platforms.length === 0) {
      container.innerHTML = `
        <div class="fin-empty-state" style="grid-column: 1 / -1;">
          <div class="fin-empty-icon">🏛️</div>
          <h3 class="fin-empty-title">暂未添加任何金融平台机构</h3>
          <p class="fin-empty-desc">您可以直接从预设模板库一键选用主流银行、券商与电子钱包，或手动创建新平台。</p>
          <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:12px;">
            <button type="button" class="fin-btn-copy" onclick="FinancialUI.openTemplateMarketModal()">
              <span>✨</span> <span>从预设模板库快速导入</span>
            </button>
            <button type="button" class="fin-btn-save" onclick="FinancialUI.openPlatformModal()">
              <span>➕</span> <span>添加自建平台</span>
            </button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = window.FinancialState.platforms.map(p => {
      const logoHtml = p.logoUrl ? `<img src="${p.logoUrl}" class="fin-plat-logo" style="width:36px; height:36px;" alt="">` : `<div class="shortcut-icon-circle" style="width:36px; height:36px; font-size:1.1rem;">🏛️</div>`;
      const statusBadge = p.isActive ? `<span class="shortcut-pill-badge">正常</span>` : `<span class="shortcut-pill-badge" style="background:rgba(239,68,68,0.1); color:#ef4444; border-color:rgba(239,68,68,0.2);">已停用</span>`;

      return `
        <div class="fin-master-card">
          <div class="fin-master-header">
            <div class="fin-master-info">
              ${logoHtml}
              <div>
                <h4 style="margin:0; font-size:1rem; color:var(--text-primary);">${p.name}</h4>
                <span style="font-size:0.75rem; color:var(--text-muted);">${p.description || '无描述'}</span>
              </div>
            </div>
            ${statusBadge}
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-subtle); padding-top:10px; flex-wrap:wrap; gap:8px;">
            <span style="font-size:0.8rem; color:var(--text-muted); font-weight:600;">${p.productCount || 0} 个关联产品</span>
            <div class="fin-master-actions">
              <button type="button" class="fin-btn-sm" onclick="FinancialUI.openPublishTemplateModal(${p.id})" title="将此平台分享到模板市场">📤 分享模板</button>
              <button type="button" class="fin-btn-sm" onclick="FinancialUI.openPlatformModal(${p.id})">✏️ 编辑</button>
              <button type="button" class="fin-btn-sm danger" onclick="FinancialUI.deletePlatform(${p.id})">🗑️ 删除</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function openPlatformModal(editId = null) {
    const modal = document.getElementById('fin-platform-modal');
    if (!modal) return;

    const titleEl = document.getElementById('fin-plat-modal-title');
    const idInput = document.getElementById('fin-plat-id');
    const nameInput = document.getElementById('fin-plat-name');
    const logoInput = document.getElementById('fin-plat-logo');
    const descInput = document.getElementById('fin-plat-desc');
    const orderInput = document.getElementById('fin-plat-order');

    if (editId) {
      const p = window.FinancialState.platforms.find(x => Number(x.id) === Number(editId));
      if (p) {
        if (titleEl) titleEl.textContent = '✏️ 编辑金融平台';
        if (idInput) idInput.value = p.id;
        if (nameInput) nameInput.value = p.name || '';
        if (logoInput) logoInput.value = p.logoUrl || '';
        if (descInput) descInput.value = p.description || '';
        if (orderInput) orderInput.value = p.sortOrder || 0;
      }
    } else {
      if (titleEl) titleEl.textContent = '➕ 添加金融平台机构';
      if (idInput) idInput.value = '';
      if (nameInput) nameInput.value = '';
      if (logoInput) logoInput.value = '';
      if (descInput) descInput.value = '';
      if (orderInput) orderInput.value = 0;
    }

    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  async function deletePlatform(id) {
    if (confirm('确认删除或停用此平台机构？如果存在历史数据将自动转为安全停用。')) {
      try {
        await window.FinancialAPI.deletePlatform(id);
        showToast('平台已处理');
        await loadPlatforms();
      } catch (err) {
        showToast(`删除失败: ${err.message}`);
      }
    }
  }

  // -------------------------------------------------------------
  // 5. PRODUCTS VIEW (CRUD)
  // -------------------------------------------------------------
  async function loadProducts() {
    let data = null;
    try {
      data = await window.FinancialAPI.getProducts();
    } catch (e) {
      console.warn('[FinancialUI] Products load error:', e);
    }
    window.FinancialState.products = (data && Array.isArray(data.products)) ? data.products : [];

    const container = document.getElementById('fin-products-grid');
    if (!container) return;

    if (window.FinancialState.products.length === 0) {
      container.innerHTML = `
        <div class="fin-empty-state" style="grid-column: 1 / -1;">
          <div class="fin-empty-icon">🏷️</div>
          <h3 class="fin-empty-title">暂未添加任何金融产品/账户</h3>
          <p class="fin-empty-desc">例如：Savings, Fixed Deposit, USD Cash, E-Wallet</p>
          <button type="button" class="fin-btn-save" onclick="FinancialUI.openProductModal()">
            <span>➕</span> <span>添加新产品</span>
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = window.FinancialState.products.map(pr => {
      const typeIcon = window.FinancialFormatters.getTypeIcon(pr.productType);
      const logoHtml = pr.logoUrl ? `<img src="${pr.logoUrl}" class="fin-plat-logo" style="width:36px; height:36px;" alt="">` : `<div class="shortcut-icon-circle" style="width:36px; height:36px; font-size:1.1rem;">${typeIcon}</div>`;
      const targetStr = pr.targetAllocationPct ? `${pr.targetAllocationPct}%` : '未设';

      return `
        <div class="fin-master-card">
          <div class="fin-master-header">
            <div class="fin-master-info">
              ${logoHtml}
              <div>
                <h4 style="margin:0; font-size:1rem; color:var(--text-primary);">${pr.name}</h4>
                <span style="font-size:0.75rem; color:var(--text-muted);">🏛️ ${pr.platformName} · ${pr.productType}</span>
              </div>
            </div>
            <span class="shortcut-pill-badge" style="background:rgba(56,189,248,0.1); color:#38bdf8; border-color:rgba(56,189,248,0.2); font-weight:700;">${pr.currency}</span>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-subtle); padding-top:10px;">
            <span style="font-size:0.8rem; color:var(--text-muted);">目标配置: <strong style="color:var(--text-primary);">${targetStr}</strong></span>
            <div class="fin-master-actions">
              <button type="button" class="fin-btn-sm" onclick="FinancialUI.openProductModal(${pr.id})">✏️ 编辑</button>
              <button type="button" class="fin-btn-sm danger" onclick="FinancialUI.deleteProduct(${pr.id})">🗑️ 删除</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  async function openProductModal(editId = null) {
    const modal = document.getElementById('fin-product-modal');
    if (!modal) return;

    // Ensure platforms list is loaded for dropdown
    if (window.FinancialState.platforms.length === 0) {
      const pData = await window.FinancialAPI.getPlatforms();
      window.FinancialState.platforms = pData.platforms || [];
    }

    const platSelect = document.getElementById('fin-prod-platform-select');
    if (platSelect) {
      platSelect.innerHTML = window.FinancialState.platforms.map(p => `
        <option value="${p.id}">${p.name}</option>
      `).join('');
    }

    const titleEl = document.getElementById('fin-prod-modal-title');
    const idInput = document.getElementById('fin-prod-id');
    const nameInput = document.getElementById('fin-prod-name');
    const typeSelect = document.getElementById('fin-prod-type');
    const currSelect = document.getElementById('fin-prod-currency');
    const logoInput = document.getElementById('fin-prod-logo');
    const targetInput = document.getElementById('fin-prod-target');
    const notesInput = document.getElementById('fin-prod-notes');
    const orderInput = document.getElementById('fin-prod-order');

    if (editId) {
      const pr = window.FinancialState.products.find(x => Number(x.id) === Number(editId));
      if (pr) {
        if (titleEl) titleEl.textContent = '✏️ 编辑金融产品';
        if (idInput) idInput.value = pr.id;
        if (platSelect) platSelect.value = pr.platformId;
        if (nameInput) nameInput.value = pr.name || '';
        if (typeSelect) typeSelect.value = pr.productType || 'Savings';
        if (currSelect) currSelect.value = pr.currency || 'MYR';
        if (logoInput) logoInput.value = pr.logoUrl || '';
        if (targetInput) targetInput.value = pr.targetAllocationPct || 0;
        if (notesInput) notesInput.value = pr.notes || '';
        if (orderInput) orderInput.value = pr.sortOrder || 0;
      }
    } else {
      if (titleEl) titleEl.textContent = '➕ 添加金融产品/账户';
      if (idInput) idInput.value = '';
      if (nameInput) nameInput.value = '';
      if (typeSelect) typeSelect.value = 'Savings';
      if (currSelect) currSelect.value = 'MYR';
      if (logoInput) logoInput.value = '';
      if (targetInput) targetInput.value = 0;
      if (notesInput) notesInput.value = '';
      if (orderInput) orderInput.value = 0;
    }

    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  async function deleteProduct(id) {
    if (confirm('确认删除或停用此产品？如果已存在历史月度快照将自动转为安全停用。')) {
      try {
        await window.FinancialAPI.deleteProduct(id);
        showToast('产品已处理');
        await loadProducts();
      } catch (err) {
        showToast(`删除失败: ${err.message}`);
      }
    }
  }

  // -------------------------------------------------------------
  // 6. ANALYTICS & MATRIX COMPARISON VIEW (Multi-Mode)
  // -------------------------------------------------------------
  function setMatrixMode(mode) {
    window.FinancialState.matrixMode = mode;
    document.querySelectorAll('.fin-mode-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-mode') === mode);
    });
    renderMatrixTable();
  }

  async function loadAnalytics() {
    let data = null;
    try {
      data = await window.FinancialAPI.getAnalytics();
    } catch (e) {
      console.warn('[FinancialUI] Analytics load error:', e);
    }
    if (!data) data = { months: [], matrix: [], monthlyTotals: {} };
    window.FinancialState.analyticsData = data;
    renderMatrixTable();
  }

  function renderMatrixTable() {
    const data = window.FinancialState.analyticsData;
    const container = document.getElementById('fin-matrix-table-container');
    if (!container || !data) return;

    if (!data.months || data.months.length === 0) {
      container.innerHTML = `
        <div class="fin-empty-state">
          <div class="fin-empty-icon">📈</div>
          <h3 class="fin-empty-title">暂无跨月度历史快照数据</h3>
          <p class="fin-empty-desc">
            在【月度录入】中录入 2 个月或以上的资产数据后，将自动生成多期资产演进矩阵与环比增减差异高亮分析。
          </p>
          <button type="button" class="fin-btn-save" onclick="FinancialUI.switchTab('monthly')">
            <span>✍️</span> <span>去录入当月余额</span>
          </button>
        </div>
      `;
      return;
    }

    const months = data.months;
    const mode = window.FinancialState.matrixMode || 'amount';
    const totalMap = data.monthlyTotals || {};

    let html = `
      <table class="fin-matrix-table">
        <thead>
          <tr>
            <th>机构平台 / 金融产品</th>
            ${months.map(m => `<th class="month-header" title="点击直达该月份录入" onclick="FinancialUI.jumpToMonth('${m}')">📅 ${m} ↗</th>`).join('')}
          </tr>
        </thead>
        <tbody>
    `;

    (data.matrix || []).forEach(plat => {
      const logoHtml = plat.logoUrl ? `<img src="${plat.logoUrl}" class="fin-plat-logo" style="width:18px; height:18px; margin-right:6px;" alt="">` : '🏛️ ';

      // Platform Header Row
      html += `
        <tr class="fin-matrix-plat-row">
          <td>${logoHtml}<strong>${plat.name}</strong></td>
          ${months.map((m, mIdx) => {
            const curVal = (plat.monthlyTotals || {})[m];
            const prevMonth = mIdx > 0 ? months[mIdx - 1] : null;
            const prevVal = prevMonth ? (plat.monthlyTotals || {})[prevMonth] : null;
            const cellHtml = formatMatrixCell(curVal, prevVal, totalMap[m], mode);
            return `<td><strong>${cellHtml}</strong></td>`;
          }).join('')}
        </tr>
      `;

      // Product Child Rows
      (plat.products || []).forEach(pr => {
        const typeIcon = window.FinancialFormatters.getTypeIcon(pr.productType);
        html += `
          <tr class="fin-matrix-prod-row">
            <td style="padding-left: 32px;">${typeIcon} ${pr.name} <span style="font-size:0.75rem; color:var(--text-muted);">(${pr.currency})</span></td>
            ${months.map((m, mIdx) => {
              const curVal = (pr.monthlyValues || {})[m];
              const prevMonth = mIdx > 0 ? months[mIdx - 1] : null;
              const prevVal = prevMonth ? (pr.monthlyValues || {})[prevMonth] : null;
              const cellHtml = formatMatrixCell(curVal, prevVal, totalMap[m], mode);
              return `<td>${cellHtml}</td>`;
            }).join('')}
          </tr>
        `;
      });
    });

    // Total Summary Row
    html += `
        <tr class="fin-matrix-total-row">
          <td>💰 全部总资产合计</td>
          ${months.map((m, mIdx) => {
            const curVal = totalMap[m];
            const prevMonth = mIdx > 0 ? months[mIdx - 1] : null;
            const prevVal = prevMonth ? totalMap[prevMonth] : null;
            const cellHtml = formatMatrixCell(curVal, prevVal, curVal, mode, true);
            return `<td><strong>${cellHtml}</strong></td>`;
          }).join('')}
        </tr>
      </tbody>
    </table>
    `;

    container.innerHTML = html;
  }

  function formatMatrixCell(curVal, prevVal, monthTotal, mode, isTotalRow = false) {
    if (curVal === null || curVal === undefined) {
      return `<span style="color:var(--text-muted);">-</span>`;
    }

    if (mode === 'amount') {
      return window.FinancialFormatters.formatCurrency(curVal, 'MYR');
    }

    if (mode === 'diff') {
      if (prevVal === null || prevVal === undefined) {
        return `<span style="color:var(--text-muted); font-size:0.8rem;">首期</span>`;
      }
      const diff = curVal - prevVal;
      if (diff > 0.01) {
        return `<span class="fin-diff-badge-pos">+${window.FinancialFormatters.formatCurrency(diff, 'MYR')}</span>`;
      } else if (diff < -0.01) {
        return `<span class="fin-diff-badge-neg">-${window.FinancialFormatters.formatCurrency(Math.abs(diff), 'MYR')}</span>`;
      }
      return `<span style="color:var(--text-muted);">0.00</span>`;
    }

    if (mode === 'pct') {
      if (isTotalRow) return '100.0%';
      const pct = (monthTotal && monthTotal > 0) ? (curVal / monthTotal * 100) : 0;
      return window.FinancialFormatters.formatPct(pct);
    }

    return window.FinancialFormatters.formatCurrency(curVal, 'MYR');
  }

  function jumpToMonth(monthKey) {
    window.FinancialState.setMonth(monthKey);
    const picker = document.getElementById('fin-month-picker');
    if (picker) picker.value = monthKey;
    switchSubTab('monthly');
  }

  // -------------------------------------------------------------
  // 7. BACKUP & RESTORE MODAL
  // -------------------------------------------------------------
  function openBackupModal() {
    const modal = document.getElementById('fin-backup-modal');
    if (modal) {
      modal.classList.remove('hidden');
      document.body.classList.add('modal-open');
    }
  }

  async function handleBackupFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const res = await window.FinancialAPI.importBackupJSON(file);
      showToast(`🎉 成功恢复数据: ${res.platformCount} 个平台, ${res.productCount} 个产品！`);
      const modal = document.getElementById('fin-backup-modal');
      if (modal) modal.classList.add('hidden');
      document.body.classList.remove('modal-open');
      await refreshCurrentTab();
    } catch (err) {
      showToast(`导入失败: ${err.message}`);
    } finally {
      event.target.value = '';
    }
  }

  async function handleSyncToCloud() {
    try {
      showToast('⏳ 正在将本地全部数据同步至云端 D1 数据库...');
      const res = await window.FinancialAPI.syncLocalToCloud();
      showToast('🎉 ' + (res.message || '本地全部数据已成功同步至云端！'));
      const modal = document.getElementById('fin-backup-modal');
      if (modal) modal.classList.add('hidden');
      document.body.classList.remove('modal-open');
      await refreshCurrentTab();
    } catch (err) {
      showToast(`❌ 同步失败: ${err.message}`);
    }
  }

  // -------------------------------------------------------------
  // 8. MODAL EVENT BINDINGS
  // -------------------------------------------------------------
  function bindModals() {
    // 1. Platform Modal Form Submit
    const platForm = document.getElementById('fin-platform-form');
    const platModal = document.getElementById('fin-platform-modal');
    const platCloseBtn = document.getElementById('fin-plat-modal-close');

    if (platCloseBtn && platModal) {
      platCloseBtn.onclick = () => {
        platModal.classList.add('hidden');
        document.body.classList.remove('modal-open');
      };
    }

    if (platForm) {
      platForm.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('fin-plat-id')?.value;
        const name = document.getElementById('fin-plat-name')?.value.trim();
        const logoUrl = document.getElementById('fin-plat-logo')?.value.trim();
        const description = document.getElementById('fin-plat-desc')?.value.trim();
        const sortOrder = parseInt(document.getElementById('fin-plat-order')?.value, 10) || 0;

        if (!name) {
          showToast('平台名称不能为空');
          return;
        }

        try {
          if (id) {
            await window.FinancialAPI.updatePlatform(id, { name, logoUrl, description, sortOrder });
            showToast('平台已更新');
          } else {
            await window.FinancialAPI.createPlatform({ name, logoUrl, description, sortOrder });
            showToast('平台已创建');
          }
          if (platModal) platModal.classList.add('hidden');
          document.body.classList.remove('modal-open');
          await loadPlatforms();
        } catch (err) {
          showToast(`保存失败: ${err.message}`);
        }
      };
    }

    // 2. Product Modal Form Submit
    const prodForm = document.getElementById('fin-product-form');
    const prodModal = document.getElementById('fin-product-modal');
    const prodCloseBtn = document.getElementById('fin-prod-modal-close');

    if (prodCloseBtn && prodModal) {
      prodCloseBtn.onclick = () => {
        prodModal.classList.add('hidden');
        document.body.classList.remove('modal-open');
      };
    }

    if (prodForm) {
      prodForm.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('fin-prod-id')?.value;
        const platformId = document.getElementById('fin-prod-platform-select')?.value;
        const name = document.getElementById('fin-prod-name')?.value.trim();
        const productType = document.getElementById('fin-prod-type')?.value;
        const currency = document.getElementById('fin-prod-currency')?.value;
        const logoUrl = document.getElementById('fin-prod-logo')?.value.trim();
        const targetAllocationPct = parseFloat(document.getElementById('fin-prod-target')?.value) || 0.0;
        const notes = document.getElementById('fin-prod-notes')?.value.trim();
        const sortOrder = parseInt(document.getElementById('fin-prod-order')?.value, 10) || 0;

        if (!name) {
          showToast('产品名称不能为空');
          return;
        }

        try {
          if (id) {
            await window.FinancialAPI.updateProduct(id, {
              platformId, name, productType, currency, logoUrl, targetAllocationPct, notes, sortOrder
            });
            showToast('产品已更新');
          } else {
            await window.FinancialAPI.createProduct({
              platformId, name, productType, currency, logoUrl, targetAllocationPct, notes, sortOrder
            });
            showToast('产品已创建');
          }
          if (prodModal) prodModal.classList.add('hidden');
          document.body.classList.remove('modal-open');
          await loadProducts();
        } catch (err) {
          showToast(`保存失败: ${err.message}`);
        }
      };
    }

    // 3. Backup Modal Close
    const backupModal = document.getElementById('fin-backup-modal');
    const backupCloseBtn = document.getElementById('fin-backup-modal-close');
    if (backupCloseBtn && backupModal) {
      backupCloseBtn.onclick = () => {
        backupModal.classList.add('hidden');
        document.body.classList.remove('modal-open');
      };
    }

    // 4. Publish Template Form Submission
    const pubForm = document.getElementById('fin-publish-template-form');
    if (pubForm) {
      pubForm.onsubmit = async (e) => {
        e.preventDefault();
        const platId = document.getElementById('publish-template-plat-id').value;
        const category = document.getElementById('publish-template-cat-select').value;
        const description = document.getElementById('publish-template-desc-input').value;

        try {
          const res = await window.FinancialAPI.publishPlatformAsTemplate(platId, category, description);
          showToast(res.message || '🎉 平台已成功发布到模板市场！');
          closePublishTemplateModal();
        } catch (err) {
          showToast(`发布失败: ${err.message}`);
        }
      };
    }
  }

  // -------------------------------------------------------------
  // 9. TEMPLATE MARKETPLACE CONTROLLER
  // -------------------------------------------------------------
  let _activeTemplateCategory = 'all';
  let _templateSearchQuery = '';

  async function openTemplateMarketModal() {
    const modal = document.getElementById('fin-template-market-modal');
    if (!modal) return;

    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    _activeTemplateCategory = 'all';
    _templateSearchQuery = '';

    const searchInp = document.getElementById('template-search-input');
    if (searchInp) searchInp.value = '';

    const catBtns = document.querySelectorAll('.fin-template-cat-btn');
    catBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-cat') === 'all'));

    await loadAndRenderTemplates();
  }

  function closeTemplateMarketModal() {
    const modal = document.getElementById('fin-template-market-modal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.classList.remove('modal-open');
    }
  }

  async function filterTemplateCategory(cat) {
    _activeTemplateCategory = cat;
    const catBtns = document.querySelectorAll('.fin-template-cat-btn');
    catBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-cat') === cat));
    await loadAndRenderTemplates();
  }

  const handleTemplateSearch = debounce(async (e) => {
    _templateSearchQuery = e.target.value;
    await loadAndRenderTemplates();
  }, 200);

  async function loadAndRenderTemplates() {
    const grid = document.getElementById('fin-template-grid');
    if (!grid) return;

    grid.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; padding:30px; color:var(--text-muted);">正在加载预设模板...</div>`;

    try {
      const templates = await window.FinancialAPI.getTemplates(_activeTemplateCategory, _templateSearchQuery);
      if (!templates || templates.length === 0) {
        grid.innerHTML = `
          <div class="fin-empty-state" style="grid-column: 1 / -1; padding:30px;">
            <div class="fin-empty-icon">🔍</div>
            <h3 class="fin-empty-title">未找到匹配的预设模板</h3>
            <p class="fin-empty-desc">您可以尝试更换搜索关键词或选择其他分类。</p>
          </div>
        `;
        return;
      }

      grid.innerHTML = templates.map(t => {
        const logoHtml = t.logoUrl ? `<img src="${t.logoUrl}" alt="${t.name}">` : `<span>🏛️</span>`;
        const officialBadge = t.isOfficial ? `<span class="shortcut-pill-badge" style="font-size:0.65rem; padding:2px 6px;">官方推荐</span>` : `<span class="shortcut-pill-badge" style="font-size:0.65rem; padding:2px 6px; background:rgba(56,189,248,0.1); color:#38bdf8; border-color:rgba(56,189,248,0.2);">社区共享</span>`;
        const productsList = (t.presetProducts || []).map(p => `<span class="fin-template-pill">${p.name}</span>`).join('');

        return `
          <div class="fin-template-card">
            <div>
              <div class="fin-template-top">
                <div class="fin-template-logo-box">${logoHtml}</div>
                <div class="fin-template-info">
                  <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
                    <span class="fin-template-name">${t.name}</span>
                    ${officialBadge}
                  </div>
                  <span class="fin-template-desc">${t.description || '无详细说明'}</span>
                </div>
              </div>

              <div style="margin-top:12px;">
                <div style="font-size:0.75rem; color:var(--text-muted); font-weight:600; margin-bottom:4px;">预设包含子产品 (${(t.presetProducts || []).length}个):</div>
                <div class="fin-template-pills">${productsList || '<span style="font-size:0.75rem; color:var(--text-muted);">基础活期账户</span>'}</div>
              </div>
            </div>

            <div style="border-top:1px solid var(--border-subtle); padding-top:10px; display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:0.75rem; color:var(--text-muted);">${t.usageCount || 0} 次使用</span>
              <button type="button" class="fin-btn-copy" onclick="FinancialUI.applyTemplate(${t.id})" style="padding:6px 12px; font-size:0.8rem;">
                <span>⚡ 一键导入此平台</span>
              </button>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      grid.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; padding:30px; color:#ef4444;">加载模板失败: ${err.message}</div>`;
    }
  }

  async function applyTemplate(templateId) {
    try {
      const res = await window.FinancialAPI.applyTemplate(templateId);
      showToast(res.message || '🎉 模板采用成功！');
      closeTemplateMarketModal();
      await loadPlatforms();
      await switchSubTab('platforms');
    } catch (err) {
      showToast(`导入失败: ${err.message}`);
    }
  }

  function openPublishTemplateModal(platformId) {
    const modal = document.getElementById('fin-publish-template-modal');
    if (!modal) return;

    const plat = window.FinancialState.platforms.find(p => Number(p.id) === Number(platformId));
    if (!plat) {
      showToast('未找到指定平台');
      return;
    }

    const platIdInput = document.getElementById('publish-template-plat-id');
    const platNameDisplay = document.getElementById('publish-template-plat-name');
    const descInput = document.getElementById('publish-template-desc-input');

    if (platIdInput) platIdInput.value = plat.id;
    if (platNameDisplay) platNameDisplay.textContent = `${plat.name} (${plat.productCount || 0} 个产品)`;
    if (descInput) descInput.value = plat.description || '';

    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function closePublishTemplateModal() {
    const modal = document.getElementById('fin-publish-template-modal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.classList.remove('modal-open');
    }
  }

  window.FinancialUI = {
    initFinancialUI,
    switchTab: switchSubTab,
    openPlatformModal,
    deletePlatform,
    openProductModal,
    deleteProduct,
    copyRowPrevious,
    copyPreviousAndOpen,
    setMatrixMode,
    jumpToMonth,
    openBackupModal,
    handleBackupFileUpload,
    handleSyncToCloud,
    togglePlatformGroup,
    bindModals,
    openTemplateMarketModal,
    closeTemplateMarketModal,
    filterTemplateCategory,
    handleTemplateSearch,
    applyTemplate,
    openPublishTemplateModal,
    closePublishTemplateModal
  };
})();
