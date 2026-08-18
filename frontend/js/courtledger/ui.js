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
    const playerFeeDisplay = document.getElementById('player-fee-display');
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
      const { fee: baseCourtFee, hasMorning, hasEvening } = window.CourtLedgerCalc.calculateCourtFee(
        startHour, duration, rates.rateMorning, rates.rateEvening
      );
      const courtFee = baseCourtFee * courtCount;

      if (courtFeeInput) courtFeeInput.value = window.CourtLedgerCalc.formatCurrency(courtFee);

      if (courtFeeBreakdown) {
        if (courtCount === 0) {
          courtFeeBreakdown.innerHTML = '<span class="breakdown-text">未选择场地</span>';
        } else {
          const multText = courtCount > 1 ? ` × ${courtCount}` : '';
          if (hasMorning && hasEvening) {
            courtFeeBreakdown.innerHTML = `
              <div class="breakdown-double-container">
                <div class="breakdown-double">
                  <span class="breakdown-row" title="早场">🌞</span>
                  <span class="breakdown-row" title="晚场">🌙</span>
                </div>
                ${multText ? `<span class="breakdown-multiplier">${multText}</span>` : ''}
              </div>
            `;
          } else if (hasMorning) {
            courtFeeBreakdown.innerHTML = `<span class="breakdown-single" title="早场">🌞${multText}</span>`;
          } else if (hasEvening) {
            courtFeeBreakdown.innerHTML = `<span class="breakdown-single" title="晚场">🌙${multText}</span>`;
          } else {
            courtFeeBreakdown.innerHTML = '<span class="breakdown-text">未选择时间</span>';
          }
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
        triggerSpark(playerFeeDisplay, '--');
        if (playerFeeDisplay) playerFeeDisplay.className = 'ticker-price error-state';

        triggerSpark(totalCostDisplay, window.CourtLedgerCalc.formatCurrency(calcResult.actualTotalCost));
        triggerSpark(totalRevenueDisplay, '--');
        triggerSpark(netProfitDisplay, '--');

        if (profitRow) profitRow.className = 'summary-row profit-highlight';
        return;
      }

      if (errorBanner) errorBanner.classList.add('hidden');

      triggerSpark(playerFeeDisplay, window.CourtLedgerCalc.formatCurrency(calcResult.playerFee));
      if (playerFeeDisplay) playerFeeDisplay.className = 'ticker-price has-value';

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
    initCourtManagementModal(calculate);

    calculate();

    return { calculate };
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
    }

    function closeModal() {
      modal.classList.add('hidden');
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
          if (confirm(`确定要从数据库中删除球场 "${v.name}" 吗？`)) {
            await window.CourtLedgerState.deleteVenue(v.id);
            renderModalVenuesList();
            if (typeof calculateCallback === 'function') calculateCallback();
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
          alert('请输入球场名称');
          return;
        }
        if (isNaN(mVal) || mVal < 0 || isNaN(eVal) || eVal < 0) {
          alert('请输入正确的早场和晚场单价');
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
        } catch (err) {
          alert('保存失败: ' + err.message);
        } finally {
          btnSave.disabled = false;
        }
      });
    }
  }

  window.CourtLedgerUI = { triggerSpark, initCourtLedgerUI };
})();
