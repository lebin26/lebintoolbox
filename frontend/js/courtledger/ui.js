/**
 * Court Ledger - UI Binding & Controls Module
 * Binds input controls, segmented controls, steppers, database venue modal, and handles main calculation loop rendering.
 */

(function () {
  function triggerSpark(el, newVal) {
    if (el && el.textContent !== newVal) {
      el.textContent = newVal;
      el.classList.remove('price-spark-anim');
      void el.offsetWidth;
      el.classList.add('price-spark-anim');
    }
  }

  function initCourtLedgerUI() {
    const startTimeSelect = document.getElementById('start-time-select');
    const durationSlider = document.getElementById('duration-slider');
    const shuttlesUsedInput = document.getElementById('shuttles-used');
    const shuttlePriceInput = document.getElementById('shuttle-price');
    const totalPlayersInput = document.getElementById('total-players');
    const hostCountInput = document.getElementById('host-count');

    const addShuttlesMinusBtn = document.getElementById('add-shuttles-minus');
    const addShuttlesPlusBtn = document.getElementById('add-shuttles-plus');
    const addShuttlesDisplay = document.getElementById('add-shuttles-display');
    const additionalShuttlesInput = document.getElementById('additional-shuttles');

    const sumActualShuttles = document.getElementById('sum-actual-shuttles');
    const sumCoverShuttles = document.getElementById('sum-cover-shuttles');
    const sumProfitShuttles = document.getElementById('sum-profit-shuttles');
    const sumBilledShuttles = document.getElementById('sum-billed-shuttles');

    const durationTrigger = document.getElementById('duration-trigger');
    const durationDisplay = document.getElementById('duration-display');
    const durationSliderPanel = document.getElementById('duration-slider-panel');
    const sliderValBubble = document.getElementById('slider-val-bubble');
    const timeRangeDisplay = document.getElementById('time-range-display');

    const shuttlesPickerTrigger = document.getElementById('shuttles-picker');
    const shuttlesDisplayVal = document.getElementById('shuttles-display');

    const playersPickerTrigger = document.getElementById('players-picker');
    const playersDisplayVal = document.getElementById('players-display');

    const courtFeeInput = document.getElementById('court-fee');
    const courtFeeBreakdown = document.getElementById('court-fee-breakdown');
    const playerFeeDisplays = document.querySelectorAll('.player-fee-val');
    const totalCostDisplay = document.getElementById('total-cost-display');
    const totalRevenueDisplay = document.getElementById('total-revenue-display');
    const netProfitDisplay = document.getElementById('net-profit-display');

    const profitRow = document.getElementById('profit-row');
    const errorBanner = document.getElementById('error-banner');

    const courtSegmented = document.getElementById('court-segmented-control');
    const courtRadios = document.querySelectorAll('input[name="court-count"]');
    const courtRadiosMap = {
      1: document.getElementById('court-1'),
      2: document.getElementById('court-2'),
      3: document.getElementById('court-3'),
      4: document.getElementById('court-4')
    };

    const hostOptBtns = document.querySelectorAll('.host-opt-btn');
    const shuttleInfoTag = document.getElementById('shuttle-info-tag');
    const profitShuttlesTag = document.getElementById('profit-shuttles-tag');

    function calculate() {
      if (!startTimeSelect || !durationSlider || !window.CourtLedgerCalc) return;

      const startHour = parseInt(startTimeSelect.value);
      const duration = parseInt(durationSlider.value);
      const shuttlesUsed = parseInt(shuttlesUsedInput.value) || 0;
      const shuttlePrice = parseFloat(shuttlePriceInput.value) || 0;
      const totalPlayers = parseInt(totalPlayersInput.value) || 0;
      const hostCount = parseInt(hostCountInput.value) || 0;
      const additionalShuttles = parseInt(additionalShuttlesInput ? additionalShuttlesInput.value : 0) || 0;

      const rates = window.CourtLedgerState ? window.CourtLedgerState.getActiveRates() : { rateMorning: 14.84, rateEvening: 29.68 };

      const endHour = startHour + duration;
      const startStr = window.CourtLedgerCalc.format12Hour(startHour);
      const endStr = window.CourtLedgerCalc.format12Hour(endHour);
      if (timeRangeDisplay) timeRangeDisplay.textContent = `${startStr} - ${endStr}`;
      if (durationDisplay) durationDisplay.textContent = `${duration} 小时`;
      if (sliderValBubble) sliderValBubble.textContent = `${duration} 小时`;

      let courtCount = 0;
      for (let i = 0; i < courtRadios.length; i++) {
        if (courtRadios[i].checked) {
          courtCount = parseInt(courtRadios[i].value);
          break;
        }
      }
      if (courtCount === 0) courtCount = 1;

      const courtFeeResult = window.CourtLedgerCalc.computeCourtFee(
        startHour, duration, rates.rateMorning, rates.rateEvening, courtCount
      );
      const courtFee = courtFeeResult.fee;

      if (courtFeeInput) courtFeeInput.value = window.CourtLedgerCalc.formatCurrency(courtFee);
      if (courtFeeBreakdown) {
        if (courtFeeResult.morningHours > 0 && courtFeeResult.eveningHours > 0) {
          courtFeeBreakdown.textContent = `早场 ${courtFeeResult.morningHours}h + 晚场 ${courtFeeResult.eveningHours}h × ${courtCount}片`;
        } else if (courtFeeResult.morningHours > 0) {
          courtFeeBreakdown.textContent = `早场 ${courtFeeResult.morningHours}h × ${courtCount}片`;
        } else if (courtFeeResult.eveningHours > 0) {
          courtFeeBreakdown.textContent = `晚场 ${courtFeeResult.eveningHours}h × ${courtCount}片`;
        } else {
          courtFeeBreakdown.textContent = '未选择场地';
        }
      }

      hostOptBtns.forEach(btn => {
        const hVal = parseInt(btn.getAttribute('data-host'));
        btn.classList.toggle('active', hostCount === hVal);
      });

      const calcResult = window.CourtLedgerCalc.computeFeeAndBreakdown(
        courtFee, shuttlesUsed, shuttlePrice, totalPlayers, hostCount, additionalShuttles
      );

      if (shuttleInfoTag) {
        if (calcResult.requiredHostShuttles > 0) {
          if (additionalShuttles >= calcResult.requiredHostShuttles) {
            shuttleInfoTag.textContent = '✅ 已涵盖 Host 成本';
            shuttleInfoTag.className = 'info-pill-tag success-tag';
          } else {
            const remain = calcResult.requiredHostShuttles - additionalShuttles;
            shuttleInfoTag.textContent = `💡 建议再加 ${remain} 个球覆盖 Host`;
            shuttleInfoTag.className = 'info-pill-tag warning-tag';
          }
        } else {
          shuttleInfoTag.textContent = '✅ 无需加球覆盖 Host';
          shuttleInfoTag.className = 'info-pill-tag success-tag';
        }
      }

      if (profitShuttlesTag) {
        const pVal = calcResult.profitShuttles;
        profitShuttlesTag.textContent = `额外盈利: ${pVal > 0 ? '+' : ''}${pVal} 个`;
      }

      if (sumActualShuttles) sumActualShuttles.textContent = `${calcResult.shuttlesUsed} 个`;
      if (sumCoverShuttles) {
        const coverVal = calcResult.appliedCoverShuttles;
        sumCoverShuttles.textContent = `${coverVal > 0 ? '+' : ''}${coverVal} 个`;
      }
      if (sumProfitShuttles) {
        const pVal = calcResult.profitShuttles;
        sumProfitShuttles.textContent = `${pVal > 0 ? '+' : ''}${pVal} 个`;
      }
      if (sumBilledShuttles) sumBilledShuttles.textContent = `${calcResult.billedShuttles} 个`;

      if (!calcResult.isValid) {
        if (errorBanner) errorBanner.classList.remove('hidden');
        playerFeeDisplays.forEach(el => {
          triggerSpark(el, '--');
          el.className = 'ticker-price player-fee-val error-state';
        });

        triggerSpark(totalCostDisplay, window.CourtLedgerCalc.formatCurrency(calcResult.actualTotalCost));
        triggerSpark(totalRevenueDisplay, '--');
        triggerSpark(netProfitDisplay, '--');

        if (profitRow) profitRow.className = 'summary-row profit-highlight';
        return;
      }

      if (errorBanner) errorBanner.classList.add('hidden');

      playerFeeDisplays.forEach(el => {
        triggerSpark(el, window.CourtLedgerCalc.formatCurrency(calcResult.playerFee));
        el.className = 'ticker-price player-fee-val has-value';
      });

      triggerSpark(totalCostDisplay, window.CourtLedgerCalc.formatCurrency(calcResult.actualTotalCost));
      triggerSpark(totalRevenueDisplay, window.CourtLedgerCalc.formatCurrency(calcResult.totalRevenue));
      triggerSpark(netProfitDisplay, window.CourtLedgerCalc.formatCurrency(calcResult.netProfit));

      if (profitRow) {
        if (calcResult.netProfit > 0.005) {
          profitRow.className = 'summary-row profit-highlight profit-state';
        } else if (calcResult.netProfit < -0.005) {
          profitRow.className = 'summary-row profit-highlight loss-state';
        } else {
          profitRow.className = 'summary-row profit-highlight';
        }
      }
    }

    if (durationTrigger && durationSliderPanel) {
      durationTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        durationTrigger.classList.toggle('active');
        durationSliderPanel.classList.toggle('expanded');
      });

      durationSliderPanel.addEventListener('click', (e) => {
        e.stopPropagation();
      });

      document.addEventListener('click', () => {
        durationTrigger.classList.remove('active');
        durationSliderPanel.classList.remove('expanded');
      });
    }

    if (playersPickerTrigger && window.AppDrawer) {
      playersPickerTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const current = parseInt(totalPlayersInput.value) || 6;
        window.AppDrawer.openDrawer("选择参与人数 (含Host)", 1, 40, current, totalPlayersInput, playersDisplayVal, calculate);
      });
    }

    if (shuttlesPickerTrigger && window.AppDrawer) {
      shuttlesPickerTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const current = parseInt(shuttlesUsedInput.value) || 3;
        window.AppDrawer.openDrawer("选择用球数量 (个)", 1, 24, current, shuttlesUsedInput, shuttlesDisplayVal, calculate);
      });
    }

    hostOptBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const hostVal = parseInt(btn.getAttribute('data-host'));
        if (!isNaN(hostVal)) {
          hostCountInput.value = hostVal;
          calculate();
        }
      });
    });

    let isDraggingCourt = false;
    let courtRect = null;
    let dragClientX = 0;
    let updateScheduled = false;

    function updateCourtFromCoords(clientX) {
      if (!courtRect || courtRect.width === 0) return;
      const x = clientX - courtRect.left;
      const percentage = x / courtRect.width;
      let value = 1;
      if (percentage < 0.25) value = 1;
      else if (percentage < 0.5) value = 2;
      else if (percentage < 0.75) value = 3;
      else value = 4;

      const targetRadio = courtRadiosMap[value];
      if (targetRadio && !targetRadio.checked) {
        targetRadio.checked = true;
        targetRadio.dispatchEvent(new Event('change'));
      }
    }

    function onDragUpdate() {
      updateScheduled = false;
      updateCourtFromCoords(dragClientX);
    }

    function handleMouseMove(e) {
      dragClientX = e.clientX;
      if (!updateScheduled) {
        updateScheduled = true;
        requestAnimationFrame(onDragUpdate);
      }
    }

    function handleMouseUp() {
      isDraggingCourt = false;
      if (courtSegmented) courtSegmented.classList.remove('dragging');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }

    function handleTouchMove(e) {
      dragClientX = e.touches[0].clientX;
      if (!updateScheduled) {
        updateScheduled = true;
        requestAnimationFrame(onDragUpdate);
      }
    }

    function handleTouchEnd() {
      isDraggingCourt = false;
      if (courtSegmented) courtSegmented.classList.remove('dragging');
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    }

    if (courtSegmented) {
      courtSegmented.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDraggingCourt = true;
        courtSegmented.classList.add('dragging');
        courtRect = courtSegmented.getBoundingClientRect();
        dragClientX = e.clientX;
        updateCourtFromCoords(dragClientX);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      });

      courtSegmented.addEventListener('touchstart', (e) => {
        isDraggingCourt = true;
        courtSegmented.classList.add('dragging');
        courtRect = courtSegmented.getBoundingClientRect();
        dragClientX = e.touches[0].clientX;
        updateCourtFromCoords(dragClientX);
        document.addEventListener('touchmove', handleTouchMove, { passive: true });
        document.addEventListener('touchend', handleTouchEnd);
      }, { passive: true });
    }

    courtRadios.forEach(radio => {
      radio.addEventListener('change', calculate);
    });

    if (startTimeSelect) startTimeSelect.addEventListener('change', calculate);
    if (durationSlider) {
      durationSlider.addEventListener('input', calculate);
      durationSlider.addEventListener('change', calculate);
    }
    if (shuttlePriceInput) {
      shuttlePriceInput.addEventListener('input', calculate);
      shuttlePriceInput.addEventListener('blur', (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) e.target.value = val.toFixed(2);
      });
      shuttlePriceInput.addEventListener('focus', (e) => e.target.select());
    }

    if (addShuttlesMinusBtn && addShuttlesPlusBtn && additionalShuttlesInput && addShuttlesDisplay) {
      addShuttlesMinusBtn.addEventListener('click', () => {
        let current = parseInt(additionalShuttlesInput.value) || 0;
        if (current > 0) {
          current--;
          additionalShuttlesInput.value = current;
          addShuttlesDisplay.textContent = `${current} 个`;
          calculate();
        }
      });

      addShuttlesPlusBtn.addEventListener('click', () => {
        let current = parseInt(additionalShuttlesInput.value) || 0;
        current++;
        additionalShuttlesInput.value = current;
        addShuttlesDisplay.textContent = `${current} 个`;
        calculate();
      });
    }

    // Initialize Court Management Modal bindings
    const billsUI = initCourtManagementModal(calculate);

    calculate();

    return {
      calculate,
      openBillsModal: billsUI ? billsUI.openBillsModal : null,
      renderBillsList: billsUI ? billsUI.renderModalBillsList : null
    };
  }

  // Bindings for Court Database Management Modal
  function initCourtManagementModal(calculateCallback) {
    const clSettingsBtn = document.getElementById('courtledger-settings-btn');
    const clSettingsDropdown = document.getElementById('courtledger-settings-dropdown');
    const menuManage = document.getElementById('menu-manage-venues');

    const btnManage = document.getElementById('btn-manage-venues');
    const modal = document.getElementById('court-manage-modal');
    const btnClose = document.getElementById('court-modal-close');
    const formTitle = document.getElementById('manage-form-title');
    const editIdInput = document.getElementById('venue-edit-id');
    const nameInput = document.getElementById('venue-name-input');
    const morningInput = document.getElementById('venue-morning-input');
    const eveningInput = document.getElementById('venue-evening-input');
    const btnSave = document.getElementById('btn-save-venue');
    const btnCancel = document.getElementById('btn-cancel-edit-venue');
    const listContainer = document.getElementById('modal-venues-list');

    if (clSettingsBtn && clSettingsDropdown) {
      clSettingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = clSettingsDropdown.classList.toggle('hidden');
        clSettingsBtn.classList.toggle('active', !isHidden);
      });

      clSettingsDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
      });

      document.addEventListener('click', () => {
        clSettingsDropdown.classList.add('hidden');
        clSettingsBtn.classList.remove('active');
      });
    }

    if (menuManage) {
      menuManage.addEventListener('click', () => {
        if (clSettingsDropdown) clSettingsDropdown.classList.add('hidden');
        if (clSettingsBtn) clSettingsBtn.classList.remove('active');
        openModal();
      });
    }

    if (!modal) return;

    function resetForm() {
      editIdInput.value = '';
      nameInput.value = '';
      morningInput.value = '';
      eveningInput.value = '';
      formTitle.textContent = '➕ 添加新球场';
      btnCancel.classList.add('hidden');
      btnSave.textContent = '保存球场';
    }

    function openModal() {
      resetForm();
      renderModalVenuesList();
      modal.classList.remove('hidden');
      document.body.classList.add('modal-open');
    }

    function closeModal() {
      modal.classList.add('hidden');
      document.body.classList.remove('modal-open');
      resetForm();
    }

    function renderModalVenuesList() {
      if (!listContainer || !window.CourtLedgerState) return;
      const venues = window.CourtLedgerState.venues || [];
      listContainer.innerHTML = '';

      if (venues.length === 0) {
        listContainer.innerHTML = '<div style="text-align:center; color:var(--color-text-muted); font-size:0.85rem; padding:12px;">暂无存库球场数据</div>';
        return;
      }

      venues.forEach(v => {
        const item = document.createElement('div');
        item.className = 'venue-item-card';

        const rMorning = typeof v.rateMorning === 'number' ? v.rateMorning : parseFloat(v.rateMorning);
        const rEvening = typeof v.rateEvening === 'number' ? v.rateEvening : parseFloat(v.rateEvening);

        item.innerHTML = `
          <div class="venue-item-info">
            <span class="venue-item-name">${v.name}</span>
            <span class="venue-item-rates">🌞 RM ${rMorning.toFixed(2)} / 🌙 RM ${rEvening.toFixed(2)}</span>
          </div>
          <div class="venue-item-actions">
            <button type="button" class="btn-icon-sm btn-edit" data-id="${v.id}">✏️ 编辑</button>
            <button type="button" class="btn-icon-sm btn-danger btn-delete" data-id="${v.id}">🗑️ 删除</button>
          </div>
        `;

        // Bind Edit button
        item.querySelector('.btn-edit').addEventListener('click', () => {
          editIdInput.value = v.id;
          nameInput.value = v.name;
          morningInput.value = rMorning.toFixed(2);
          eveningInput.value = rEvening.toFixed(2);
          formTitle.textContent = '✏️ 编辑球场信息';
          btnSave.textContent = '更新球场';
          btnCancel.classList.remove('hidden');
        });

        // Bind Delete button
        item.querySelector('.btn-delete').addEventListener('click', async () => {
          await window.CourtLedgerState.deleteVenue(v.id);
          renderModalVenuesList();
          if (typeof calculateCallback === 'function') calculateCallback();
          if (typeof window.showToast === 'function') {
            window.showToast(`球场 "${v.name}" 已删除`);
          }
        });

        listContainer.appendChild(item);
      });
    }

    if (btnManage) {
      btnManage.addEventListener('click', openModal);
    }
    if (btnClose) {
      btnClose.addEventListener('click', closeModal);
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    if (btnCancel) {
      btnCancel.addEventListener('click', resetForm);
    }

    if (btnSave) {
      btnSave.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        const mVal = parseFloat(morningInput.value);
        const eVal = parseFloat(eveningInput.value);
        const editId = editIdInput.value;

        if (!name) {
          if (typeof window.showToast === 'function') window.showToast('请输入球场名称');
          return;
        }
        if (isNaN(mVal) || mVal < 0 || isNaN(eVal) || eVal < 0) {
          if (typeof window.showToast === 'function') window.showToast('请输入正确的早场和晚场单价');
          return;
        }

        btnSave.disabled = true;
        btnSave.textContent = '保存中...';

        try {
          if (editId) {
            await window.CourtLedgerState.updateVenue(parseInt(editId), name, mVal, eVal);
          } else {
            await window.CourtLedgerState.addVenue(name, mVal, eVal);
          }
          resetForm();
          renderModalVenuesList();
          if (typeof calculateCallback === 'function') calculateCallback();
          if (typeof window.showToast === 'function') {
            window.showToast(editId ? '球场信息已更新' : '新球场已添加');
          }
        } catch (err) {
          if (typeof window.showToast === 'function') {
            window.showToast('保存失败: ' + err.message);
          }
        } finally {
          btnSave.disabled = false;
        }
      });
    }

    // Initialize Save Bill & History Bills UI
    return initBillsHistoryUI(calculateCallback);
  }

  function initBillsHistoryUI(calculateCallback) {
    const btnSaveBill = document.getElementById('save-bill-btn');
    const btnHistoryBill = document.getElementById('history-bill-btn');
    const billsModal = document.getElementById('bills-history-modal');
    const btnCloseBillsModal = document.getElementById('bills-modal-close');
    const billsListContainer = document.getElementById('modal-bills-list');
    const billsSearchInput = document.getElementById('bills-search-input');
    const billsDateFilter = document.getElementById('bills-date-filter');

    // KPI Elements
    const kpiTotalBills = document.getElementById('kpi-total-bills');
    const kpiTotalRevenue = document.getElementById('kpi-total-revenue');
    const kpiTotalProfit = document.getElementById('kpi-total-profit');
    const kpiAvgPlayerFee = document.getElementById('kpi-avg-player-fee');

    function openBillsModal() {
      if (window.AppRouter && typeof window.AppRouter.switchView === 'function') {
        window.AppRouter.switchView('historybills');
      } else {
        window.location.hash = 'historybills';
      }
      renderModalBillsList();
    }

    function updateKpiDashboard(bills) {
      if (!bills || bills.length === 0) {
        if (kpiTotalBills) kpiTotalBills.textContent = '0 笔';
        if (kpiTotalRevenue) kpiTotalRevenue.textContent = 'RM 0.00';
        if (kpiTotalProfit) kpiTotalProfit.textContent = 'RM 0.00';
        if (kpiAvgPlayerFee) kpiAvgPlayerFee.textContent = 'RM 0.00';
        return;
      }

      let totalRev = 0;
      let totalProfit = 0;
      let totalPlayerFeeSum = 0;

      bills.forEach(b => {
        totalRev += parseFloat(b.totalRevenue || 0);
        totalProfit += parseFloat(b.netProfit || 0);
        totalPlayerFeeSum += parseFloat(b.playerFee || 0);
      });

      const avgPlayerFee = totalPlayerFeeSum / bills.length;

      if (kpiTotalBills) kpiTotalBills.textContent = `${bills.length} 笔`;
      if (kpiTotalRevenue) kpiTotalRevenue.textContent = `RM ${totalRev.toFixed(2)}`;
      if (kpiTotalProfit) {
        kpiTotalProfit.textContent = `RM ${totalProfit.toFixed(2)}`;
        kpiTotalProfit.className = totalProfit >= 0 ? 'kpi-value tag-bullish' : 'kpi-value tag-bearish';
      }
      if (kpiAvgPlayerFee) kpiAvgPlayerFee.textContent = `RM ${avgPlayerFee.toFixed(2)}`;
    }

    async function renderModalBillsList() {
      const container = document.getElementById('modal-bills-list') || billsListContainer;
      if (!container) return;
      container.innerHTML = '<div style="text-align:center; padding:24px; color:var(--color-text-muted);">加载账单历史记录与计算统计...</div>';
      
      const bills = await window.CourtLedgerState.fetchBills();

      const query = billsSearchInput ? billsSearchInput.value.toLowerCase().trim() : '';
      const dateVal = billsDateFilter ? billsDateFilter.value : 'all';

      let cutoffTime = 0;
      if (dateVal !== 'all') {
        const days = parseInt(dateVal);
        if (!isNaN(days)) {
          cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
        }
      }

      const filtered = bills.filter(b => {
        // Text search match
        if (query) {
          const matchTitle = b.title && b.title.toLowerCase().includes(query);
          const matchVenue = b.venueName && b.venueName.toLowerCase().includes(query);
          if (!matchTitle && !matchVenue) return false;
        }
        // Date cutoff match
        if (cutoffTime > 0) {
          const rawStr = b.createdAt ? String(b.createdAt).replace(' ', 'T') : '';
          const bTime = rawStr ? new Date(rawStr).getTime() : 0;
          if (bTime > 0 && bTime < cutoffTime) return false;
        }
        return true;
      });

      updateKpiDashboard(filtered);
      billsListContainer.innerHTML = '';

      if (filtered.length === 0) {
        billsListContainer.innerHTML = '<div style="text-align:center; padding:30px; color:var(--color-text-muted); font-size:0.9rem;">暂无指定日期范围内检索到的历史账单记录</div>';
        return;
      }

      filtered.forEach(bill => {
        const item = document.createElement('div');
        item.className = 'bill-item-card';

        const pFee = typeof bill.playerFee === 'number' ? bill.playerFee : parseFloat(bill.playerFee || 0);
        const tCost = typeof bill.totalCost === 'number' ? bill.totalCost : parseFloat(bill.totalCost || 0);
        const tRev = typeof bill.totalRevenue === 'number' ? bill.totalRevenue : parseFloat(bill.totalRevenue || 0);
        const profit = typeof bill.netProfit === 'number' ? bill.netProfit : parseFloat(bill.netProfit || 0);
        
        const rawDateStr = bill.createdAt ? String(bill.createdAt).replace(' ', 'T') : '';
        const parsedTime = rawDateStr ? new Date(rawDateStr).getTime() : 0;
        const dateStr = !isNaN(parsedTime) && parsedTime > 0 ? new Date(parsedTime).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '历史记录';

        item.innerHTML = `
          <div class="bill-card-header">
            <div class="bill-card-title-group">
              <span class="bill-card-title">📌 ${bill.title || 'AA 账单'}</span>
              <span class="bill-card-venue-tag">🏸 ${bill.venueName || '默认'}</span>
            </div>
            <div class="bill-card-header-right">
              <span class="bill-profit-pill ${profit >= 0 ? 'profit-positive' : 'profit-negative'}">
                ${profit >= 0 ? '📈 盈利 RM ' + profit.toFixed(2) : '📉 亏损 RM ' + Math.abs(profit).toFixed(2)}
              </span>
              <span class="bill-card-date">${dateStr}</span>
            </div>
          </div>
          <div class="bill-card-details">
            <div class="bill-detail-item">
              <span class="bill-detail-label">每人收费</span>
              <span class="bill-detail-val tag-accent">RM ${pFee.toFixed(2)}</span>
            </div>
            <div class="bill-detail-item">
              <span class="bill-detail-label">人数 / Host</span>
              <span class="bill-detail-val">${bill.totalPlayers || 6}人 (${bill.hostCount || 0} Host)</span>
            </div>
            <div class="bill-detail-item">
              <span class="bill-detail-label">场地 / 时长</span>
              <span class="bill-detail-val">${bill.courtCount || 1}片 / ${bill.duration || 2}h</span>
            </div>
            <div class="bill-detail-item">
              <span class="bill-detail-label">用球数量 (加球)</span>
              <span class="bill-detail-val">${bill.shuttlesUsed || 3}个 (+${bill.additionalShuttles || 0})</span>
            </div>
            <div class="bill-detail-item">
              <span class="bill-detail-label">真实总成本</span>
              <span class="bill-detail-val">RM ${tCost.toFixed(2)}</span>
            </div>
            <div class="bill-detail-item">
              <span class="bill-detail-label">总收款 (应收)</span>
              <span class="bill-detail-val tag-bullish">RM ${tRev.toFixed(2)}</span>
            </div>
          </div>
          <div class="bill-card-actions">
            <button type="button" class="btn-icon-sm btn-edit-bill" data-id="${bill.id}">✏️ 编辑账单</button>
            <button type="button" class="btn-icon-sm btn-danger btn-delete-bill" data-id="${bill.id}">🗑️ 删除记录</button>
          </div>
        `;

        // Edit all bill parameters
        item.querySelector('.btn-edit-bill').addEventListener('click', () => {
          openEditBillModal(bill);
        });

        // Delete bill
        item.querySelector('.btn-delete-bill').addEventListener('click', async () => {
          await window.CourtLedgerState.deleteBill(bill.id);
          renderModalBillsList(billsSearchInput ? billsSearchInput.value : '');
          if (typeof window.showToast === 'function') {
            window.showToast('账单记录已删除');
          }
        });

        billsListContainer.appendChild(item);
      });
    }

    // Full-Field Bill Edit Modal Elements
    const editModal = document.getElementById('edit-bill-modal');
    const btnCloseEditModal = document.getElementById('edit-bill-modal-close');
    const btnCancelEditModal = document.getElementById('btn-cancel-edit-bill');
    const btnSaveEditModal = document.getElementById('btn-save-edit-bill');

    function openEditBillModal(bill) {
      if (!editModal) return;
      document.getElementById('edit-bill-id').value = bill.id;
      document.getElementById('edit-bill-title').value = bill.title || '';
      document.getElementById('edit-bill-venue').value = bill.venueName || '';
      document.getElementById('edit-bill-players').value = bill.totalPlayers || 6;
      document.getElementById('edit-bill-hosts').value = bill.hostCount || 0;
      document.getElementById('edit-bill-courts').value = bill.courtCount || 1;
      document.getElementById('edit-bill-duration').value = bill.duration || 2;
      document.getElementById('edit-bill-shuttles').value = bill.shuttlesUsed || 3;
      document.getElementById('edit-bill-shuttle-price').value = (typeof bill.shuttlePrice === 'number' ? bill.shuttlePrice : parseFloat(bill.shuttlePrice || 123.0)).toFixed(2);
      document.getElementById('edit-bill-add-shuttles').value = bill.additionalShuttles || 0;
      document.getElementById('edit-bill-player-fee').value = (typeof bill.playerFee === 'number' ? bill.playerFee : parseFloat(bill.playerFee || 0)).toFixed(2);

      editModal.classList.remove('hidden');
      document.body.classList.add('modal-open');
    }

    function closeEditBillModal() {
      if (editModal) {
        editModal.classList.add('hidden');
        document.body.classList.remove('modal-open');
      }
    }

    if (btnCloseEditModal) btnCloseEditModal.addEventListener('click', closeEditBillModal);
    if (btnCancelEditModal) btnCancelEditModal.addEventListener('click', closeEditBillModal);
    if (editModal) {
      editModal.addEventListener('click', (e) => {
        if (e.target === editModal) closeEditBillModal();
      });
    }

    if (btnSaveEditModal) {
      btnSaveEditModal.addEventListener('click', async () => {
        const billId = parseInt(document.getElementById('edit-bill-id').value);
        const title = document.getElementById('edit-bill-title').value.trim();
        const venueName = document.getElementById('edit-bill-venue').value.trim();
        const totalPlayers = parseInt(document.getElementById('edit-bill-players').value || 1);
        const hostCount = parseInt(document.getElementById('edit-bill-hosts').value || 0);
        const courtCount = parseInt(document.getElementById('edit-bill-courts').value || 1);
        const duration = parseInt(document.getElementById('edit-bill-duration').value || 2);
        const shuttlesUsed = parseInt(document.getElementById('edit-bill-shuttles').value || 0);
        const shuttlePrice = parseFloat(document.getElementById('edit-bill-shuttle-price').value || 0);
        const additionalShuttles = parseInt(document.getElementById('edit-bill-add-shuttles').value || 0);
        const playerFee = parseFloat(document.getElementById('edit-bill-player-fee').value || 0);

        if (!title) { if (typeof window.showToast === 'function') window.showToast('请输入账单标题'); return; }
        if (!venueName) { if (typeof window.showToast === 'function') window.showToast('请输入球场名称'); return; }
        if (totalPlayers <= hostCount) { if (typeof window.showToast === 'function') window.showToast('参与总人数必须大于 Host 免单人数'); return; }

        // Recalculate financial breakdown
        const shuttleCost = shuttlesUsed * (shuttlePrice / 12.0);
        
        // Find court rate for venue if available
        let courtFee = 0;
        if (window.CourtLedgerState && window.CourtLedgerState.venues) {
          const matchedVenue = window.CourtLedgerState.venues.find(v => v.name === venueName);
          if (matchedVenue && window.CourtLedgerCalc) {
            const mRate = typeof matchedVenue.rateMorning === 'number' ? matchedVenue.rateMorning : parseFloat(matchedVenue.rateMorning);
            const eRate = typeof matchedVenue.rateEvening === 'number' ? matchedVenue.rateEvening : parseFloat(matchedVenue.rateEvening);
            courtFee = window.CourtLedgerCalc.calculateCourtFee(16, duration, mRate, eRate) * courtCount;
          }
        }
        
        // Fallback to estimated court fee if no venue matched
        if (!courtFee || courtFee === 0) {
          const currentTotalCost = parseFloat(document.getElementById('total-cost-display')?.textContent || 0);
          courtFee = currentTotalCost > shuttleCost ? (currentTotalCost - shuttleCost) : 59.36 * duration * courtCount;
        }

        const totalCost = courtFee + shuttleCost;
        const payingPlayers = Math.max(1, totalPlayers - hostCount);
        const totalRevenue = playerFee * payingPlayers;
        const netProfit = totalRevenue - totalCost;

        const updatedBillData = {
          title,
          venueName,
          totalPlayers,
          hostCount,
          courtCount,
          duration,
          shuttlesUsed,
          shuttlePrice,
          additionalShuttles,
          playerFee,
          courtFee,
          totalCost,
          totalRevenue,
          netProfit
        };

        btnSaveEditModal.disabled = true;
        try {
          await window.CourtLedgerState.updateBill(billId, updatedBillData);
          closeEditBillModal();
          renderModalBillsList(billsSearchInput ? billsSearchInput.value : '');
          if (typeof window.showToast === 'function') {
            window.showToast(`✅ 账单【${title}】已更新并同步`);
          }
        } catch (err) {
          if (typeof window.showToast === 'function') {
            window.showToast(`更新账单失败: ${err.message}`);
          }
        } finally {
          btnSaveEditModal.disabled = false;
        }
      });
    }

    if (btnSaveBill) {
      btnSaveBill.addEventListener('click', async () => {
        const rates = window.CourtLedgerState.getActiveRates();
        const vName = rates ? rates.venueName : '默认球场';
        const nowStr = new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        const autoTitle = `${vName} (${nowStr})`;

        const startTime = parseInt(document.getElementById('start-time-select')?.value || 16);
        const duration = parseInt(document.getElementById('duration-slider')?.value || 2);
        const courtCount = parseInt(document.querySelector('input[name="court-count"]:checked')?.value || 1);
        const courtFee = parseFloat(document.getElementById('court-fee')?.value || 0.0);
        const totalPlayers = parseInt(document.getElementById('total-players')?.value || 6);
        const hostCount = parseInt(document.getElementById('host-count')?.value || 0);
        const shuttlesUsed = parseInt(document.getElementById('shuttles-used')?.value || 3);
        const shuttlePrice = parseFloat(document.getElementById('shuttle-price')?.value || 0.0);
        const additionalShuttles = parseInt(document.getElementById('additional-shuttles')?.value || 0);

        const playerFeeText = document.getElementById('player-fee-display')?.textContent || '0.00';
        const totalCostText = document.getElementById('total-cost-display')?.textContent || '0.00';
        const totalRevenueText = document.getElementById('total-revenue-display')?.textContent || '0.00';
        const netProfitText = document.getElementById('net-profit-display')?.textContent || '0.00';

        const billData = {
          title: autoTitle,
          venueName: vName,
          startTime,
          duration,
          courtCount,
          courtFee,
          totalPlayers,
          hostCount,
          shuttlesUsed,
          shuttlePrice,
          additionalShuttles,
          playerFee: parseFloat(playerFeeText),
          totalCost: parseFloat(totalCostText),
          totalRevenue: parseFloat(totalRevenueText),
          netProfit: parseFloat(netProfitText)
        };

        btnSaveBill.disabled = true;
        try {
          await window.CourtLedgerState.saveBill(billData);
          if (typeof window.showToast === 'function') {
            window.showToast(`✅ 账单已自动保存至数据库`);
          }
        } catch (e) {
          if (typeof window.showToast === 'function') {
            window.showToast(`保存账单失败: ${e.message}`);
          }
        } finally {
          btnSaveBill.disabled = false;
        }
      });
    }

    if (btnHistoryBill) {
      btnHistoryBill.addEventListener('click', openBillsModal);
    }
    const menuHistoryBills = document.getElementById('menu-history-bills');
    if (menuHistoryBills) {
      menuHistoryBills.addEventListener('click', () => {
        const dropdown = document.getElementById('courtledger-settings-dropdown');
        if (dropdown) dropdown.classList.add('hidden');
        openBillsModal();
      });
    }
    if (btnCloseBillsModal) {
      btnCloseBillsModal.addEventListener('click', closeBillsModal);
    }
    if (billsModal) {
      billsModal.addEventListener('click', (e) => {
        if (e.target === billsModal) closeBillsModal();
      });
    }
    if (billsSearchInput) {
      billsSearchInput.addEventListener('input', () => {
        renderModalBillsList();
      });
    }
    if (billsDateFilter) {
      billsDateFilter.addEventListener('change', () => {
        renderModalBillsList();
      });
    }

    return { openBillsModal, renderModalBillsList };
  }

  window.CourtLedgerUI = { triggerSpark, initCourtLedgerUI };
})();
