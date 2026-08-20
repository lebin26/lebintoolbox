/**
 * Court Ledger - Smart Roster & Player Payment Tracking Module
 * Supports bulk importing sign-up lists (接龙名单 6-25人), host rule auto-assignment,
 * individual payment checking, archiving, and seamless sync with Advance Manager (垫付管家).
 */

(function () {
  let currentRoster = {
    venue: '',
    date: '',
    timeRange: '',
    startHour: 18,
    duration: 2,
    hostCount: 1,
    players: [] // Array of { id, name, isHost, isPaid, amPersonId }
  };

  function showToast(message) {
    if (typeof window.showToast === 'function') {
      window.showToast(message);
    } else if (window.CourtLedgerBill && window.CourtLedgerBill.showToast) {
      window.CourtLedgerBill.showToast(message);
    } else {
      alert(message);
    }
  }

  function copyText(text, successMsg = '已成功复制到剪贴板！') {
    if (window.CourtLedgerBill && window.CourtLedgerBill.fallbackCopyText) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => showToast(successMsg)).catch(() => {
          window.CourtLedgerBill.fallbackCopyText(text);
        });
      } else {
        window.CourtLedgerBill.fallbackCopyText(text);
      }
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => showToast(successMsg));
    }
  }

  function getExpectedHostCount() {
    const hostInput = document.getElementById('host-count') || document.getElementById('host-slider');
    if (hostInput) {
      const val = parseInt(hostInput.value, 10);
      if (!isNaN(val) && val >= 0) return val;
    }
    return 1;
  }

  function parseRosterText(rawText, customExpectedHostCount = null) {
    if (!rawText || typeof rawText !== 'string') {
      return { players: [], hostCount: 0, totalCount: 0, venue: '', date: '', timeRange: '', duration: 2, startHour: 18 };
    }

    const expectedHosts = customExpectedHostCount !== null ? customExpectedHostCount : getExpectedHostCount();
    const lines = rawText.split('\n');
    const players = [];
    let hostCount = 0;
    let venue = '';
    let date = '';
    let timeRange = '';
    let duration = 2;
    let startHour = 18;
    let isWaitingListSection = false;

    for (let line of lines) {
      let trimmed = line.trim();
      if (!trimmed) continue;

      if (/waiting\s*list|候补|替补/i.test(trimmed)) {
        isWaitingListSection = true;
        continue;
      }
      if (isWaitingListSection) continue;

      // Extract Venue
      const venueMatch = trimmed.match(/(?:📍|场地|地点|Venue|球馆)[\s:：]*([^\n\r]+)/i);
      if (venueMatch && !venue) {
        venue = venueMatch[1].trim();
        continue;
      }

      // Extract Date
      const dateMatch = trimmed.match(/(?:🗓️|📅|日期|Date)[\s:：]*([^\n\r]+)/i);
      if (dateMatch && !date) {
        date = dateMatch[1].trim();
        continue;
      }

      // Extract Time
      const timeMatch = trimmed.match(/(?:🕓|⏰|时间|Time)[\s:：]*([^\n\r]+)/i) || trimmed.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?\s*[-~至到]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?)/);
      if (timeMatch && !timeRange) {
        timeRange = (timeMatch[1] || timeMatch[0]).trim();
        const rangeParts = timeRange.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?\s*[-~至到]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?/);
        if (rangeParts) {
          let h1 = parseInt(rangeParts[1], 10);
          const ampm1 = rangeParts[3] ? rangeParts[3].toLowerCase() : '';
          let h2 = parseInt(rangeParts[4], 10);
          const ampm2 = rangeParts[6] ? rangeParts[6].toLowerCase() : (ampm1 || (h2 <= 12 && h2 >= 1 ? 'pm' : ''));

          if (ampm1 === 'pm' && h1 < 12) h1 += 12;
          if (ampm2 === 'pm' && h2 < 12) h2 += 12;
          if (h2 > h1) {
            startHour = h1;
            duration = h2 - h1;
          }
        }
        continue;
      }

      // Skip noise
      if (/^(?:💰|💵|🏸|AA|level|beginner|intermediate|advanced|\(.*\)|\[.*\])/i.test(trimmed) && !/^\d+[\.、\s\-]/.test(trimmed)) {
        continue;
      }
      if (trimmed.startsWith('==') || trimmed.startsWith('--')) continue;

      // Check numbered line
      const numMatch = trimmed.match(/^(\d+|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]|\[\d+\]|\(\d+\))[\.、\s\-:：]*(.*)$/u);
      if (numMatch) {
        const namePart = numMatch[2].trim();
        if (!namePart || namePart === '-' || namePart === '—') continue;
        trimmed = namePart;
      } else {
        if (!trimmed || trimmed.length > 30) continue;
      }

      // Check Host
      const hostRegex = /[\(\（]?(?:host|Host|HOST|组织者|群主|组织人|发起人)[\)\）]?/i;
      let isHost = false;
      if (hostRegex.test(trimmed)) {
        isHost = true;
        trimmed = trimmed.replace(hostRegex, '').trim();
      }

      // Check +1, +2
      const plusRegex = /[\+\＋加]\s*(\d+)/;
      const plusMatch = trimmed.match(plusRegex);
      let plusCount = 0;
      if (plusMatch) {
        plusCount = parseInt(plusMatch[1], 10) || 0;
        trimmed = trimmed.replace(plusRegex, '').trim();
      }

      const baseName = trimmed.replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, '').trim();
      if (!baseName) continue;

      players.push({
        id: 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5),
        name: baseName,
        isHost: isHost,
        isPaid: isHost
      });
      if (isHost) hostCount++;

      for (let i = 1; i <= plusCount; i++) {
        players.push({
          id: 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5),
          name: `${baseName} (朋友${i})`,
          isHost: false,
          isPaid: false
        });
      }
    }

    // Default Host Rule: 1 host = 1st person, 2 hosts = 1st & 2nd persons
    if (hostCount === 0 && expectedHosts > 0) {
      const limit = Math.min(expectedHosts, players.length);
      for (let i = 0; i < limit; i++) {
        players[i].isHost = true;
        players[i].isPaid = true;
        hostCount++;
      }
    }

    return {
      players,
      hostCount,
      totalCount: players.length,
      venue,
      date,
      timeRange,
      duration,
      startHour
    };
  }

  function getCurrentPlayerFee() {
    const feeElem = document.getElementById('player-fee') || document.getElementById('player-fee-display');
    if (feeElem) {
      const txt = feeElem.innerText || feeElem.value || '0.00';
      const num = parseFloat(txt.replace(/[^\d.]/g, ''));
      return isNaN(num) ? 0 : num;
    }
    return 0;
  }

  function getCurrentTotalCost() {
    const costElem = document.getElementById('total-cost');
    if (costElem) {
      const txt = costElem.innerText || costElem.value || '0.00';
      const num = parseFloat(txt.replace(/[^\d.]/g, ''));
      return isNaN(num) ? 0 : num;
    }
    return 0;
  }

  function generateRosterProgressText() {
    const venueElem = document.getElementById('venue-select');
    const venueName = currentRoster.venue || (venueElem ? venueElem.options[venueElem.selectedIndex]?.text : '羽球场');
    const timeRange = currentRoster.timeRange || '活动时段';
    const playerFee = getCurrentPlayerFee();
    const players = currentRoster.players;
    const total = players.length;
    const paidCount = players.filter(p => p.isPaid || p.isHost).length;
    const feeStr = `RM ${playerFee.toFixed(2)}`;

    let out = `🏸 *羽球局费用收款进度 (${paidCount}/${total})*\n`;
    if (venueName) out += `🏟️ *场地*：${venueName}\n`;
    if (timeRange) out += `⏰ *时段*：${timeRange}\n`;
    out += `💰 *人均*：${feeStr}\n`;
    out += `-------------------------\n`;

    players.forEach((p, idx) => {
      const num = idx + 1;
      if (p.isHost) {
        out += `${num}. ${p.name} (👑 Host · 免单)\n`;
      } else if (p.isPaid) {
        out += `${num}. ${p.name} [✅ 已付]\n`;
      } else {
        out += `${num}. ${p.name} [⏳ 待付 ${feeStr}]\n`;
      }
    });

    out += `-------------------------\n`;
    out += `📌 请待付球友尽快完成支付，谢谢！`;
    return out;
  }

  function renderRosterList() {
    const listContainer = document.getElementById('roster-player-list');
    const countBadge = document.getElementById('roster-player-count-badge');
    const paidStats = document.getElementById('roster-paid-stats');
    const progressBar = document.getElementById('roster-progress-fill');
    const settleBtn = document.getElementById('btn-roster-settle-archive');

    if (!listContainer) return;

    const players = currentRoster.players;
    const total = players.length;
    const paidCount = players.filter(p => p.isPaid || p.isHost).length;
    const currentFee = getCurrentPlayerFee();
    const feeStr = `RM ${currentFee.toFixed(2)}`;

    if (countBadge) countBadge.innerText = `${total} 人`;
    if (paidStats) paidStats.innerHTML = `已收 <strong>${paidCount}</strong> / ${total} 人 · 实收 <strong>RM ${(paidCount * currentFee).toFixed(2)}</strong>`;
    
    if (progressBar) {
      const pct = total > 0 ? Math.round((paidCount / total) * 100) : 0;
      progressBar.style.width = `${pct}%`;
    }

    if (settleBtn) {
      if (total > 0 && paidCount === total) {
        settleBtn.classList.remove('btn-secondary');
        settleBtn.classList.add('btn-success-glow');
        settleBtn.innerHTML = `🎉 全员已付款 · 结算归档账单`;
      } else {
        settleBtn.classList.remove('btn-success-glow');
        settleBtn.classList.add('btn-secondary');
        settleBtn.innerHTML = `🏁 结算并归档账单 (${paidCount}/${total} 已付)`;
      }
    }

    if (players.length === 0) {
      listContainer.innerHTML = `
        <div class="roster-empty-state">
          <div class="empty-icon">🏸</div>
          <div class="empty-title">暂无人员名单</div>
          <div class="empty-desc">在上方粘贴微信/WhatsApp 群接龙名单，点击【智能解析】快速生成</div>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = players.map((p, idx) => {
      const num = idx + 1;
      return `
        <div class="roster-player-card ${p.isPaid ? 'is-paid' : 'is-unpaid'} ${p.isHost ? 'is-host' : ''}" data-player-id="${p.id}">
          <div class="player-left">
            <span class="player-num">${num}</span>
            <div class="player-info">
              <span class="player-name">${escapeHtml(p.name)}</span>
              <span class="player-tag">${p.isHost ? '👑 Host (免单)' : (p.isPaid ? '✅ 已付 ' + feeStr : '⏳ 待付 ' + feeStr)}</span>
            </div>
          </div>
          <div class="player-actions">
            <button type="button" class="btn-toggle-host" data-player-id="${p.id}" title="${p.isHost ? '取消 Host 身份' : '设为 Host 免单'}">
              ${p.isHost ? '👑 取消Host' : '设为Host'}
            </button>
            <button type="button" class="btn-copy-single" data-name="${escapeHtml(p.name)}" data-fee="${feeStr}" title="复制单人私聊催账文案">
              💬 催账
            </button>
            <label class="pay-checkbox-wrapper" title="点击切换付款状态">
              <input type="checkbox" class="roster-pay-check" data-player-id="${p.id}" ${p.isPaid ? 'checked' : ''}>
              <span class="pay-status-pill">${p.isPaid ? '已付款' : '未付款'}</span>
            </label>
          </div>
        </div>
      `;
    }).join('');

    // Attach checkbox events
    listContainer.querySelectorAll('.roster-pay-check').forEach(input => {
      input.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-player-id');
        const p = currentRoster.players.find(x => x.id === id);
        if (p) {
          p.isPaid = e.target.checked;
          renderRosterList();
        }
      });
    });

    // Attach toggle host events
    listContainer.querySelectorAll('.btn-toggle-host').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-player-id');
        const p = currentRoster.players.find(x => x.id === id);
        if (p) {
          p.isHost = !p.isHost;
          if (p.isHost) p.isPaid = true;
          currentRoster.hostCount = currentRoster.players.filter(x => x.isHost).length;
          applyRosterToCalculator();
          renderRosterList();
        }
      });
    });

    // Attach single player copy events
    listContainer.querySelectorAll('.btn-copy-single').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-name');
        const fee = btn.getAttribute('data-fee');
        const msg = `@${name} 🏸 今日羽球费用 ${fee}，已开通扫码支付，付款后请知会一声，谢谢！`;
        copyText(msg, `已复制 @${name} 的专属催账文案！`);
      });
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function applyRosterToCalculator() {
    if (currentRoster.players.length === 0) return;

    const totalInput = document.getElementById('total-players');
    const totalSlider = document.getElementById('players-slider') || document.getElementById('total-players');
    const hostInput = document.getElementById('host-count');
    const hostSlider = document.getElementById('host-slider') || document.getElementById('host-count');
    const startSelect = document.getElementById('start-time-select');
    const durationSlider = document.getElementById('duration-slider');

    if (totalInput) {
      totalInput.value = currentRoster.players.length;
      totalInput.dispatchEvent(new Event('input', { bubbles: true }));
      totalInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (totalSlider && totalSlider !== totalInput) {
      totalSlider.value = currentRoster.players.length;
      totalSlider.dispatchEvent(new Event('input', { bubbles: true }));
    }

    if (hostInput) {
      hostInput.value = currentRoster.hostCount;
      hostInput.dispatchEvent(new Event('input', { bubbles: true }));
      hostInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (hostSlider && hostSlider !== hostInput) {
      hostSlider.value = currentRoster.hostCount;
      hostSlider.dispatchEvent(new Event('input', { bubbles: true }));
    }

    if (startSelect && currentRoster.startHour) {
      startSelect.value = currentRoster.startHour;
      startSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (durationSlider && currentRoster.duration) {
      durationSlider.value = currentRoster.duration;
      durationSlider.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Trigger calculation recomputation
    if (window.CourtLedgerState && typeof window.CourtLedgerState.triggerRecalculation === 'function') {
      window.CourtLedgerState.triggerRecalculation();
    }
  }

  function updateFlowBadge() {
    const badge = document.getElementById('flow-roster-badge');
    const stepRoster = document.getElementById('flow-step-roster');
    const stepGen = document.getElementById('flow-step-generate');
    const actionText = document.getElementById('btn-roster-action-text');

    if (currentRoster.players && currentRoster.players.length > 0) {
      if (badge) {
        badge.textContent = `已导入 ${currentRoster.players.length} 人`;
        badge.className = 'flow-step-badge active';
      }
      if (stepRoster) stepRoster.classList.add('completed');
      if (stepGen) stepGen.classList.add('ready');
      if (actionText) actionText.textContent = `👥 涉及人员 (${currentRoster.players.length}人)`;
    } else {
      if (badge) {
        badge.textContent = '未导入';
        badge.className = 'flow-step-badge';
      }
      if (stepRoster) stepRoster.classList.remove('completed');
      if (stepGen) stepGen.classList.remove('ready');
      if (actionText) actionText.textContent = '👥 接龙与涉及人员';
    }
  }

  function openRosterModal() {
    const modal = document.getElementById('court-roster-modal');
    if (modal) {
      modal.classList.remove('hidden');
      document.body.classList.add('modal-open');
      renderRosterList();
    }
  }

  function closeRosterModal() {
    const modal = document.getElementById('court-roster-modal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.classList.remove('modal-open');
    }
  }

  /**
   * One-Click Standalone Bill Generator & Flow Exporter
   * Court Ledger acts purely as the upfront calculator & session generator.
   */
  async function generateAndExportBill() {
    if (window.AuthManager && !window.AuthManager.hasActionPermission('courtledger:create_bill')) {
      showToast('⛔ 权限不足：您当前暂无【创建羽球账单】的权限，请联系 Admin 开通！');
      return;
    }

    if (currentRoster.players.length === 0) {
      openRosterModal();
      showToast('💡 请先在此粘贴接龙名单，即可一键生成独立账单！');
      return;
    }
    await syncToAdvanceManager(true);
  }

  /**
   * Seamlessly Sync Roster and Court Bill into Advance Manager (球局临时垫付)
   */
  async function syncToAdvanceManager(andNavigate = true) {
    if (!window.AMApi) {
      showToast('垫付管家 API 模块未加载，请刷新页面重试');
      return;
    }
    if (currentRoster.players.length === 0) {
      showToast('请先导入接龙名单！');
      return;
    }

    try {
      showToast('🔄 正在生成独立球局并流转至垫付管家...');

      const payingPlayers = currentRoster.players.filter(p => !p.isHost);
      const currentFee = getCurrentPlayerFee() || 0;
      const venueElem = document.getElementById('venue-select');
      const venueName = currentRoster.venue || (venueElem ? venueElem.options[venueElem.selectedIndex]?.text : '羽球局');
      const dateStr = currentRoster.date || new Date().toLocaleDateString('zh-CN');
      const projTitle = `🏸 ${venueName} (${dateStr})`;
      const totalCostNum = getCurrentTotalCost() || (currentFee * payingPlayers.length);

      // Build pure isolated session players list (sandbox: does not pollute contacts or global ledger)
      const sessionPlayers = payingPlayers.map((p, idx) => ({
        id: `pl_${idx + 1}_` + Date.now().toString(36),
        name: p.name.trim(),
        fee: currentFee,
        isPaid: Boolean(p.isPaid)
      }));

      const sessionPayload = {
        type: 'badminton_session',
        venue: venueName,
        date: dateStr,
        totalCost: totalCostNum,
        perPlayerFee: currentFee,
        players: sessionPlayers
      };

      // Check if project exists with this title
      const projects = await window.AMApi.getProjects();
      const projsList = Array.isArray(projects) ? projects : (projects?.projects || projects?.results || []);
      let targetProject = projsList.find(pr => pr.name === projTitle);

      if (targetProject) {
        // Update existing project with fresh session payload
        await window.AMApi.updateProject(targetProject.id, {
          name: projTitle,
          description: JSON.stringify(sessionPayload),
          status: 'active'
        });
      } else {
        targetProject = await window.AMApi.createProject({
          name: projTitle,
          description: JSON.stringify(sessionPayload)
        });
      }

      // Auto copy formatted bill announcement text
      if (window.CourtLedgerBill && typeof window.CourtLedgerBill.copyCalculatedBillText === 'function') {
        window.CourtLedgerBill.copyCalculatedBillText();
      }

      // Refresh Advance Manager UI if open
      if (window.AdvanceManagerUI && typeof window.AdvanceManagerUI.init === 'function') {
        window.AdvanceManagerUI.init();
      }

      // Close modal and update flow badge
      closeRosterModal();
      updateFlowBadge();

      showToast('✅ 羽球局已成功保存至【活动与球局】！');

      if (andNavigate && window.AppRouter && typeof window.AppRouter.switchView === 'function') {
        window.AppRouter.switchView('advancemanager');
        if (window.AdvanceManagerUI && typeof window.AdvanceManagerUI.switchTab === 'function') {
          window.AdvanceManagerUI.switchTab('projects');
          if (typeof window.AdvanceManagerUI.filterProjectType === 'function') {
            window.AdvanceManagerUI.filterProjectType('badminton');
          }
        }
      }
    } catch (err) {
      console.error('syncToAdvanceManager error:', err);
      showToast('❌ 流转失败: ' + err.message);
    }
  }

  function initRosterModule() {
    const openBtn = document.getElementById('btn-open-roster-modal');
    const openActionBtn = document.getElementById('btn-open-roster-action');
    const modal = document.getElementById('court-roster-modal');
    const closeBtn = document.getElementById('roster-modal-close');
    const parseBtn = document.getElementById('btn-parse-roster');
    const clearBtn = document.getElementById('btn-clear-roster-text');
    const rawTextarea = document.getElementById('roster-raw-text');
    const copyProgressBtn = document.getElementById('btn-copy-roster-progress');
    const markAllPaidBtn = document.getElementById('btn-roster-mark-all-paid');
    const syncAmBtn = document.getElementById('btn-roster-sync-am');

    if (openBtn) openBtn.addEventListener('click', openRosterModal);
    if (openActionBtn) openActionBtn.addEventListener('click', openRosterModal);
    if (closeBtn) closeBtn.addEventListener('click', closeRosterModal);

    if (parseBtn && rawTextarea) {
      parseBtn.addEventListener('click', () => {
        const text = rawTextarea.value.trim();
        if (!text) {
          showToast('请先粘贴接龙名单文本！');
          return;
        }
        const expectedHosts = getExpectedHostCount();
        const res = parseRosterText(text, expectedHosts);
        if (res.totalCount === 0) {
          showToast('未能识别到有效人员，请检查文本格式');
          return;
        }
        currentRoster = res;
        applyRosterToCalculator();
        renderRosterList();
        updateFlowBadge();
        showToast(`🎉 成功解析 ${res.totalCount} 位球友 (默认前 ${res.hostCount} 位为免单 Host)，已填入计算器！`);
      });
    }

    if (clearBtn && rawTextarea) {
      clearBtn.addEventListener('click', () => {
        rawTextarea.value = '';
        rawTextarea.focus();
      });
    }

    if (copyProgressBtn) {
      copyProgressBtn.addEventListener('click', () => {
        if (currentRoster.players.length === 0) {
          showToast('暂无接龙人员数据');
          return;
        }
        const text = generateRosterProgressText();
        copyText(text, '已复制全场接龙收款进度，可直接发至微信/WhatsApp 群！');
      });
    }

    if (markAllPaidBtn) {
      markAllPaidBtn.addEventListener('click', () => {
        if (currentRoster.players.length === 0) return;
        currentRoster.players.forEach(p => p.isPaid = true);
        renderRosterList();
        showToast('已一键将所有球友标记为【已付款】！');
      });
    }

    if (syncAmBtn) {
      syncAmBtn.addEventListener('click', () => generateAndExportBill());
    }
  }

  window.CourtLedgerRoster = {
    parseRosterText,
    generateRosterProgressText,
    initRosterModule,
    openRosterModal,
    closeRosterModal,
    generateAndExportBill,
    syncToAdvanceManager,
    updateFlowBadge,
    getCurrentRoster: () => currentRoster
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRosterModule);
  } else {
    initRosterModule();
  }
})();
