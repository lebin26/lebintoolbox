document.addEventListener('DOMContentLoaded', () => {
  // ==========================================================================
  // 1. DOM Element Cache
  // ==========================================================================
  
  // Input elements
  const startTimeSelect = document.getElementById('start-time-select');
  const durationSlider = document.getElementById('duration-slider');
  const shuttlesUsedInput = document.getElementById('shuttles-used');
  const shuttlePriceInput = document.getElementById('shuttle-price');
  const totalPlayersInput = document.getElementById('total-players');
  const hostCountInput = document.getElementById('host-count');
  
  // Stepper elements for Additional Shuttles (+球数)
  const addShuttlesMinusBtn = document.getElementById('add-shuttles-minus');
  const addShuttlesPlusBtn = document.getElementById('add-shuttles-plus');
  const addShuttlesDisplay = document.getElementById('add-shuttles-display');
  const additionalShuttlesInput = document.getElementById('additional-shuttles');

  // Shuttle Summary Statistics elements (最下方的用球统计)
  const sumActualShuttles = document.getElementById('sum-actual-shuttles');
  const sumCoverShuttles = document.getElementById('sum-cover-shuttles');
  const sumProfitShuttles = document.getElementById('sum-profit-shuttles');
  const sumBilledShuttles = document.getElementById('sum-billed-shuttles');

  // Settings & Customization elements
  const roundingSelect = document.getElementById('rounding-select');
  const rateMorningInput = document.getElementById('rate-morning-input');
  const rateEveningInput = document.getElementById('rate-evening-input');
  const copyBillBtn = document.getElementById('copy-bill-btn');

  // QR elements cached globally
  const qrImage = document.querySelector('.qr-image');
  const qrFullscreen = document.getElementById('qr-fullscreen');
  const qrFullscreenImage = document.querySelector('.qr-fullscreen-image');

  // Trigger elements
  const durationTrigger = document.getElementById('duration-trigger');
  const durationDisplay = document.getElementById('duration-display');
  const durationSliderPanel = document.getElementById('duration-slider-panel');
  const sliderValBubble = document.getElementById('slider-val-bubble');
  const timeRangeDisplay = document.getElementById('time-range-display');

  const shuttlesPickerTrigger = document.getElementById('shuttles-picker');
  const shuttlesDisplayVal = document.getElementById('shuttles-display');

  const playersPickerTrigger = document.getElementById('players-picker');
  const playersDisplayVal = document.getElementById('players-display');

  // Output elements
  const courtFeeInput = document.getElementById('court-fee');
  const courtFeeBreakdown = document.getElementById('court-fee-breakdown');
  const playerFeeDisplay = document.getElementById('player-fee-display');
  const totalCostDisplay = document.getElementById('total-cost-display');
  const totalRevenueDisplay = document.getElementById('total-revenue-display');
  const netProfitDisplay = document.getElementById('net-profit-display');

  // Containers & Overlays
  const profitRow = document.getElementById('profit-row');
  const errorBanner = document.getElementById('error-banner');
  const drawerOverlay = document.getElementById('drawer-overlay');
  const drawerTitle = document.getElementById('drawer-title');
  const drawerBody = document.getElementById('drawer-body');
  const drawerCloseBtn = document.getElementById('drawer-close');

  // Court segmented elements
  const courtSegmented = document.getElementById('court-segmented-control');
  const courtRadios = document.querySelectorAll('input[name="court-count"]');
  const courtRadiosMap = {
    1: document.getElementById('court-1'),
    2: document.getElementById('court-2'),
    3: document.getElementById('court-3')
  };

  // Host Segmented buttons
  const hostOptBtns = document.querySelectorAll('.host-opt-btn');

  // Shuttle status tags
  const shuttleInfoTag = document.getElementById('shuttle-info-tag');
  const profitShuttlesTag = document.getElementById('profit-shuttles-tag');

  // Pricing constants (Loaded dynamically from localStorage, with defaults)
  let rateMorning = parseFloat(localStorage.getItem('rate-morning')) || 14.84;
  let rateEvening = parseFloat(localStorage.getItem('rate-evening')) || 29.68;
  let roundingMode = localStorage.getItem('rounding-mode') || 'none';

  // Default hardcoded bill copy template fallback
  let billTemplate = '🏸 *Malend 羽毛球费用结算*\n' +
    '📅 *时间*：{TIME_RANGE} ({DURATION} 小时)\n' +
    '🏟️ *场地*：{COURT_COUNT} 片 × {DURATION} 小时 (RM {COURT_FEE})\n' +
    '🏸 *用球*：{SHUTTLES_USED} 个 (RM {SHUTTLE_COST}，单价 RM {SHUTTLE_PRICE}/桶)\n' +
    '👥 *人数*：{TOTAL_PLAYERS} 人 (含 {HOST_COUNT} Host，{PAYING_PLAYERS} 人付费)\n' +
    '💰 *每人收费*：*{PLAYER_FEE}*{ROUNDING_DESC}\n' +
    '{ADDITIONAL_FEE_LINE}-------------------------\n' +
    '🧾 *总成本*：RM {TOTAL_COST}\n' +
    '💵 *总收款*：{TOTAL_REVENUE}\n' +
    '📈 *净利润*：{NET_PROFIT}\n\n' +
    '📌 *付款请划到第二页扫 DuitNow QR 码，谢谢！*';

  // Fetch custom template from text file on page load
  fetch('bill_template.txt')
    .then(response => {
      if (response.ok) return response.text();
      throw new Error('Template file not found or failed to load');
    })
    .then(text => {
      if (text && text.trim()) {
        billTemplate = text;
        console.log('Successfully loaded custom bill template from bill_template.txt');
      }
    })
    .catch(err => {
      console.warn('Using default fallback template. Reason:', err.message);
    });

  // Initialize input fields in DOM
  if (rateMorningInput) rateMorningInput.value = rateMorning.toFixed(2);
  if (rateEveningInput) rateEveningInput.value = rateEvening.toFixed(2);
  if (roundingSelect) roundingSelect.value = roundingMode;

  // Utility to format currency
  function formatCurrency(val) {
    return val.toFixed(2);
  }

  // Utility to format hour index to 12-hour format string
  function format12Hour(hour) {
    const h = hour % 24;
    if (h === 0) return "12:00 AM";
    if (h < 12) return `${h}:00 AM`;
    if (h === 12) return "12:00 PM";
    return `${h - 12}:00 PM`;
  }

  // Helper to apply selected rounding mode
  function applyRounding(val, mode) {
    if (mode === 'nearest-0.5') {
      return Math.round(val * 2) / 2;
    } else if (mode === 'ceil') {
      return Math.ceil(val);
    } else if (mode === 'floor') {
      return Math.floor(val);
    }
    return val; // 'none'
  }

  // Toggle Duration Slider Panel
  durationTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    durationTrigger.classList.toggle('active');
    durationSliderPanel.classList.toggle('expanded');
  });

  // Prevent closing when clicking inside the slider panel
  durationSliderPanel.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Close the slider panel if clicking anywhere else on page
  document.addEventListener('click', () => {
    durationTrigger.classList.remove('active');
    durationSliderPanel.classList.remove('expanded');
  });

  // Calculate dynamic court fee based on starting hour and duration
  function calculateCourtFee(startHour, duration) {
    let totalFee = 0;
    let hasMorning = false;
    let hasEvening = false;

    for (let h = 0; h < duration; h++) {
      const hourOfDay = (startHour + h) % 24;
      if (hourOfDay >= 0 && hourOfDay < 18) {
        totalFee += rateMorning;
        hasMorning = true;
      } else {
        totalFee += rateEvening;
        hasEvening = true;
      }
    }

    return {
      fee: totalFee,
      hasMorning,
      hasEvening
    };
  }

  // Perceived performance: micro-animation text updater
  function triggerSpark(el, newVal) {
    if (el && el.textContent !== newVal) {
      el.textContent = newVal;
      // Restart CSS animation
      el.classList.remove('price-spark-anim');
      void el.offsetWidth; // Force layout reflow
      el.classList.add('price-spark-anim');
    }
  }

  // Helper to calculate required host shuttles (for statistics display only)
  function calculateRequiredHostShuttles(courtFee, shuttlesUsed, shuttlePrice, totalPlayers, hostCount, roundingMode) {
    if (hostCount <= 0 || totalPlayers <= hostCount || shuttlePrice <= 0) {
      return 0;
    }
    const singleShuttlePrice = shuttlePrice / 12;
    const actualShuttleCost = shuttlesUsed * singleShuttlePrice;
    const actualTotalCost = courtFee + actualShuttleCost;
    const payingPlayers = totalPlayers - hostCount;

    let k = 0;
    while (k <= 100) {
      const billedShuttles = shuttlesUsed + k;
      const billedTotalCost = courtFee + (billedShuttles * singleShuttlePrice);
      const unroundedFee = billedTotalCost / totalPlayers;
      const playerFee = applyRounding(unroundedFee, roundingMode);
      const totalRevenue = playerFee * payingPlayers;

      if (totalRevenue >= actualTotalCost - 0.0001) {
        return k;
      }
      k++;
    }
    return 0;
  }

  // Helper to compute fee and cost breakdown based on the 3-item shuttle concept:
  // Item 1: shuttlesUsed (真实用球)
  // Item 2: requiredHostShuttles (覆盖Host需补球数，仅作统计参考)
  // Item 3: profitShuttles (额外盈利球数，超过requiredHostShuttles的部分才计数)
  function computeFeeAndBreakdown(courtFee, shuttlesUsed, shuttlePrice, totalPlayers, hostCount, additionalShuttles, roundingMode) {
    const singleShuttlePrice = shuttlePrice > 0 ? (shuttlePrice / 12) : 0;
    const actualShuttleCost = shuttlesUsed * singleShuttlePrice;
    const actualTotalCost = courtFee + actualShuttleCost;
    const billedShuttles = shuttlesUsed + additionalShuttles;
    const billedShuttleCost = billedShuttles * singleShuttlePrice;
    const billedTotalCost = courtFee + billedShuttleCost;
    const payingPlayers = totalPlayers - hostCount;

    const requiredHostShuttles = calculateRequiredHostShuttles(
      courtFee, shuttlesUsed, shuttlePrice, totalPlayers, hostCount, roundingMode
    );
    const appliedCoverShuttles = Math.min(additionalShuttles, requiredHostShuttles);
    const profitShuttles = Math.max(0, additionalShuttles - requiredHostShuttles);

    if (payingPlayers <= 0 || totalPlayers <= 0) {
      return {
        isValid: false,
        actualTotalCost,
        payingPlayers,
        playerFee: 0,
        shuttlesUsed,
        requiredHostShuttles,
        appliedCoverShuttles,
        additionalShuttles,
        profitShuttles,
        billedShuttles,
        billedShuttleCost,
        billedTotalCost,
        totalRevenue: 0,
        netProfit: 0
      };
    }

    let playerFee = 0;
    let totalRevenue = 0;

    if (singleShuttlePrice > 0) {
      const unroundedFee = billedTotalCost / totalPlayers;
      playerFee = applyRounding(unroundedFee, roundingMode);
      totalRevenue = playerFee * payingPlayers;
    } else {
      const unroundedFee = actualTotalCost / payingPlayers;
      playerFee = applyRounding(unroundedFee, roundingMode);
      totalRevenue = playerFee * payingPlayers;
    }

    let netProfit = totalRevenue - actualTotalCost;
    if (Math.abs(netProfit) < 0.005) {
      netProfit = 0;
    }

    return {
      isValid: true,
      actualTotalCost,
      payingPlayers,
      playerFee,
      shuttlesUsed,
      requiredHostShuttles,
      appliedCoverShuttles,
      additionalShuttles,
      profitShuttles,
      billedShuttles,
      billedShuttleCost,
      billedTotalCost,
      totalRevenue,
      netProfit
    };
  }

  // ==========================================================================
  // 2. Main Calculation Loop
  // ==========================================================================
  function calculate() {
    // 1. Gather input parameters
    const startHour = parseInt(startTimeSelect.value);
    const duration = parseInt(durationSlider.value);
    const shuttlesUsed = parseInt(shuttlesUsedInput.value) || 0;
    const shuttlePrice = parseFloat(shuttlePriceInput.value) || 0;
    const totalPlayers = parseInt(totalPlayersInput.value) || 0;
    const hostCount = parseInt(hostCountInput.value) || 0;
    const additionalShuttles = parseInt(additionalShuttlesInput ? additionalShuttlesInput.value : 0) || 0;

    // 2. Compute dynamic time range text
    const endHour = startHour + duration;
    const startStr = format12Hour(startHour);
    const endStr = format12Hour(endHour);
    timeRangeDisplay.textContent = `${startStr} - ${endStr}`;
    durationDisplay.textContent = `${duration} 小时`;
    sliderValBubble.textContent = `${duration} 小时`;

    // 3. Compute dynamic court fee
    let courtCount = 0;
    for (let i = 0; i < courtRadios.length; i++) {
      if (courtRadios[i].checked) {
        courtCount = parseInt(courtRadios[i].value);
        break;
      }
    }
    const { fee: baseCourtFee, hasMorning, hasEvening } = calculateCourtFee(startHour, duration);
    const courtFee = baseCourtFee * courtCount;

    courtFeeInput.value = formatCurrency(courtFee);

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

    // Highlight active host option button (0, 1, 2 Hosts)
    hostOptBtns.forEach(btn => {
      const hVal = parseInt(btn.getAttribute('data-host'));
      btn.classList.toggle('active', hostCount === hVal);
    });

    // Determine current active host calculation
    const calcResult = computeFeeAndBreakdown(
      courtFee, shuttlesUsed, shuttlePrice, totalPlayers, hostCount, additionalShuttles, roundingMode
    );

    // Update Shuttle Status & Recommendation Tags
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

    // Update Bottom Shuttle Summary Statistics Card
    if (sumActualShuttles) {
      sumActualShuttles.textContent = `${calcResult.shuttlesUsed} 个`;
    }
    if (sumCoverShuttles) {
      const coverVal = calcResult.appliedCoverShuttles;
      sumCoverShuttles.textContent = `${coverVal > 0 ? '+' : ''}${coverVal} 个`;
    }
    if (sumProfitShuttles) {
      const pVal = calcResult.profitShuttles;
      sumProfitShuttles.textContent = `${pVal > 0 ? '+' : ''}${pVal} 个`;
    }
    if (sumBilledShuttles) {
      sumBilledShuttles.textContent = `${calcResult.billedShuttles} 个`;
    }

    if (!calcResult.isValid) {
      errorBanner.classList.remove('hidden');
      triggerSpark(playerFeeDisplay, '--');
      playerFeeDisplay.className = 'ticker-price error-state';

      triggerSpark(totalCostDisplay, formatCurrency(calcResult.actualTotalCost));
      triggerSpark(totalRevenueDisplay, '--');
      triggerSpark(netProfitDisplay, '--');

      profitRow.className = 'summary-row profit-highlight';
      return;
    }

    errorBanner.classList.add('hidden');

    // Update UI with spark animation
    triggerSpark(playerFeeDisplay, formatCurrency(calcResult.playerFee));
    playerFeeDisplay.className = 'ticker-price has-value';

    triggerSpark(totalCostDisplay, formatCurrency(calcResult.actualTotalCost));
    triggerSpark(totalRevenueDisplay, formatCurrency(calcResult.totalRevenue));
    triggerSpark(netProfitDisplay, formatCurrency(calcResult.netProfit));

    // Style profit highlighting row
    if (calcResult.netProfit > 0.005) {
      profitRow.className = 'summary-row profit-highlight profit-state';
    } else if (calcResult.netProfit < -0.005) {
      profitRow.className = 'summary-row profit-highlight loss-state';
    } else {
      profitRow.className = 'summary-row profit-highlight';
    }
  }

  // ==========================================================================
  // 3. Picker Drawer System (with CSS Stagger entry indexes)
  // ==========================================================================
  let activeHiddenInput = null;
  let activeDisplayEl = null;

  function openDrawer(title, min, max, currentVal, hiddenInput, displayEl) {
    activeHiddenInput = hiddenInput;
    activeDisplayEl = displayEl;

    drawerTitle.textContent = title;
    drawerBody.innerHTML = ''; // Clear previous content

    const container = document.createElement('div');
    container.className = 'drawer-options-grid';

    // Populate elements (inject stagger delays)
    for (let i = min; i <= max; i++) {
      const cell = document.createElement('div');
      cell.className = 'drawer-option-cell';
      cell.textContent = i;
      cell.setAttribute('data-value', i);
      
      // Cap the index delay to keep overall opening time under 300ms
      const delayIndex = Math.min(i - min, 12);
      cell.style.setProperty('--stagger-index', delayIndex);
      
      if (i === currentVal) {
        cell.classList.add('selected');
      }
      container.appendChild(cell);
    }

    // Event Delegation
    container.addEventListener('click', (e) => {
      const cell = e.target.closest('.drawer-option-cell');
      if (cell) {
        const val = parseInt(cell.getAttribute('data-value'));
        if (!isNaN(val)) {
          activeHiddenInput.value = val;
          activeDisplayEl.textContent = val;
          calculate();
          closeDrawer();
        }
      }
    });

    drawerBody.appendChild(container);
    drawerOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling

    // Trigger staggered entry animation (replaces @starting-style for WebKit compat)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const cells = container.querySelectorAll('.drawer-option-cell');
        cells.forEach(cell => cell.classList.add('animate-in'));
      });
    });
  }

  function closeDrawer() {
    drawerOverlay.classList.add('hidden');
    document.body.style.overflow = '';
  }

  // Bind trigger clicks
  playersPickerTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const current = parseInt(totalPlayersInput.value) || 6;
    openDrawer("选择参与人数 (含Host)", 1, 40, current, totalPlayersInput, playersDisplayVal);
  });

  shuttlesPickerTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const current = parseInt(shuttlesUsedInput.value) || 3;
    openDrawer("选择用球数量 (个)", 1, 24, current, shuttlesUsedInput, shuttlesDisplayVal);
  });

  // Host option button clicks
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

  // ==========================================================================
  // 4. Sliding Segmented Control (Optimized dragging & layouts)
  // ==========================================================================
  let isDraggingCourt = false;
  let courtRect = null;
  let dragClientX = 0;
  let updateScheduled = false;

  function updateCourtFromCoords(clientX) {
    if (!courtRect || courtRect.width === 0) return;
    const x = clientX - courtRect.left;
    const percentage = x / courtRect.width;
    let value = 1;
    if (percentage < 0.33) {
      value = 1;
    } else if (percentage < 0.66) {
      value = 2;
    } else {
      value = 3;
    }

    const targetRadio = courtRadiosMap[value];
    if (targetRadio && !targetRadio.checked) {
      targetRadio.checked = true;
      targetRadio.dispatchEvent(new Event('change'));
    }
  }

  // requestAnimationFrame batch callback
  function onDragUpdate() {
    updateScheduled = false;
    updateCourtFromCoords(dragClientX);
  }

  // Global move handlers
  function handleMouseMove(e) {
    dragClientX = e.clientX;
    if (!updateScheduled) {
      updateScheduled = true;
      requestAnimationFrame(onDragUpdate);
    }
  }

  function handleMouseUp() {
    isDraggingCourt = false;
    courtSegmented.classList.remove('dragging');
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
    courtSegmented.classList.remove('dragging');
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
  }

  // Mouse drag initializer
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

  // Touch drag initializer
  courtSegmented.addEventListener('touchstart', (e) => {
    isDraggingCourt = true;
    courtSegmented.classList.add('dragging');
    courtRect = courtSegmented.getBoundingClientRect();
    dragClientX = e.touches[0].clientX;
    updateCourtFromCoords(dragClientX);
    
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
  }, { passive: true });

  // Track selected court count radio changes
  courtRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      calculate();
    });
  });

  // Drawer Close events
  drawerCloseBtn.addEventListener('click', closeDrawer);
  drawerOverlay.addEventListener('click', (e) => {
    if (e.target === drawerOverlay) {
      closeDrawer();
    }
  });

  // Event listeners for calculations
  startTimeSelect.addEventListener('change', calculate);
  durationSlider.addEventListener('input', calculate);
  durationSlider.addEventListener('change', calculate);
  shuttlePriceInput.addEventListener('input', calculate);

  // Stepper buttons for Additional Shuttles (- / +)
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

  // Auto-format currency inputs on blur
  [shuttlePriceInput, rateMorningInput, rateEveningInput].forEach(input => {
    input.addEventListener('blur', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) {
        e.target.value = val.toFixed(2);
      }
    });
  });

  // ==========================================================================
  // 5. Swipe Navigation Page System (Pointer Events 1:1, Rubberband & Velocity Handoff)
  // ==========================================================================
  const toggleViewBtn = document.getElementById('toggle-view-btn');
  const swipeViewport = document.querySelector('.swipe-viewport');
  const swipeTrack = document.getElementById('swipe-track');
  const indicatorDots = document.querySelectorAll('.indicator-dot');
  
  let currentPage = 0;
  let isDraggingSwipe = false;
  let startDragX = 0;
  let startOffsetPct = 0;
  let viewportWidth = 0;
  let velocityHistory = [];

  // Helper: Get matrix translateX percent
  function getTranslateXPercent(el) {
    const style = window.getComputedStyle(el);
    const transform = style.transform;
    if (!transform || transform === 'none') return 0;
    
    const matrix = new DOMMatrixReadOnly(transform);
    const tx = matrix.m41; // translate X in pixels
    const w = el.getBoundingClientRect().width;
    if (w === 0) return 0;
    return (tx / w) * 100;
  }

  // Physical Rubber-banding formula
  function rubberband(overshoot, dimension, constant = 0.55) {
    const sign = Math.sign(overshoot);
    const absOvershoot = Math.abs(overshoot);
    return sign * ((absOvershoot * dimension * constant) / (dimension + constant * absOvershoot));
  }

  // Snap track to page index with dynamic spring duration
  function setPage(pageIndex, velocity = 0) {
    currentPage = pageIndex;
    
    // System level reduction check
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      const slides = document.querySelectorAll('.swipe-slide');
      slides.forEach((slide, idx) => {
        slide.classList.toggle('active-slide', idx === pageIndex);
      });
      indicatorDots.forEach((dot, idx) => {
        dot.classList.toggle('active', idx === pageIndex);
      });
      return;
    }
    
    let duration = 400; // ms default
    viewportWidth = swipeViewport.getBoundingClientRect().width;
    
    if (Math.abs(velocity) > 0.1 && viewportWidth > 0) {
      const targetPct = pageIndex === 0 ? 0 : -50;
      const currentPct = getTranslateXPercent(swipeTrack);
      
      const distancePx = Math.abs(targetPct - currentPct) / 50 * viewportWidth;
      duration = Math.max(180, Math.min(480, distancePx / Math.abs(velocity)));
    }
    
    // Apply dynamic duration using spring curve
    swipeTrack.style.transition = `transform ${duration}ms var(--ease-spring-approx)`;
    
    if (pageIndex === 0) {
      swipeTrack.style.transform = 'translate3d(0%, 0, 0)';
      toggleViewBtn.innerHTML = '<span class="btn-icon">📱</span><span class="btn-text">DuitNow-QR</span>';
      toggleViewBtn.classList.remove('active');
    } else {
      swipeTrack.style.transform = 'translate3d(-50%, 0, 0)';
      toggleViewBtn.innerHTML = '<span class="btn-icon">📊</span><span class="btn-text">CourtLedger</span>';
      toggleViewBtn.classList.add('active');
    }

    // Update indicator dots
    indicatorDots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === pageIndex);
    });
  }

  // pointer down gesture initialization
  swipeViewport.addEventListener('pointerdown', (e) => {
    // Escape gesture if target matches any sliders, selection cards, inputs, buttons, etc.
    if (
      e.target.closest('#duration-slider') ||
      e.target.closest('.drawer-sheet') ||
      e.target.closest('.picker-trigger') ||
      e.target.closest('select') ||
      e.target.closest('input') ||
      e.target.closest('.segmented-control') ||
      e.target.closest('.host-selector-segmented') ||
      e.target.closest('.host-opt-btn') ||
      e.target.closest('.qr-image-wrapper') ||
      e.target.closest('.qr-image') ||
      e.target.closest('.stepper-wrapper') ||
      e.target.closest('.stepper-btn') ||
      e.target.closest('button') ||
      e.button !== 0 // Left click/Touch only
    ) {
      return;
    }
    
    isDraggingSwipe = true;
    swipeTrack.classList.add('dragging');
    startDragX = e.clientX;
    viewportWidth = swipeViewport.getBoundingClientRect().width;
    
    startOffsetPct = getTranslateXPercent(swipeTrack);
    velocityHistory = [{ x: e.clientX, time: performance.now() }];
    
    swipeViewport.setPointerCapture(e.pointerId);
  });

  // pointer tracking
  swipeViewport.addEventListener('pointermove', (e) => {
    if (!isDraggingSwipe) return;
    
    const deltaX = e.clientX - startDragX;
    
    // Map pixels to track percentage (track is 200% width, so 1 viewportWidth px = 50%)
    let deltaPct = (deltaX / viewportWidth) * 50;
    let targetPct = startOffsetPct + deltaPct;
    
    // Apply rubber-banding out of page boundaries
    if (targetPct > 0) {
      // Dragging past slide 0
      const rubberPx = rubberband(deltaX, viewportWidth);
      targetPct = (rubberPx / viewportWidth) * 50;
    } else if (targetPct < -50) {
      // Dragging past slide 1
      const rubberPx = rubberband(deltaX, viewportWidth);
      targetPct = -50 + (rubberPx / viewportWidth) * 50;
    }
    
    swipeTrack.style.transform = `translate3d(${targetPct}%, 0, 0)`;
    
    velocityHistory.push({ x: e.clientX, time: performance.now() });
    if (velocityHistory.length > 5) {
      velocityHistory.shift();
    }
  });

  // pointer release momentum handoff
  swipeViewport.addEventListener('pointerup', (e) => {
    if (!isDraggingSwipe) return;
    isDraggingSwipe = false;
    swipeTrack.classList.remove('dragging');
    
    let velocity = 0; // pixels per millisecond
    if (velocityHistory.length >= 2) {
      const first = velocityHistory[0];
      const last = velocityHistory[velocityHistory.length - 1];
      const dt = last.time - first.time;
      if (dt > 0) {
        velocity = (last.x - first.x) / dt;
      }
    }
    
    // Projected landing coordinate: current px location + velocity * 160ms momentum
    const currentOffsetPct = getTranslateXPercent(swipeTrack);
    const currentOffsetPx = (currentOffsetPct / 50) * viewportWidth;
    const projectedPx = currentOffsetPx + velocity * 160;
    
    let targetPage = currentPage;
    if (projectedPx > -viewportWidth / 2) {
      targetPage = 0;
    } else {
      targetPage = 1;
    }
    
    // Override snap page target if flick gesture has a high velocity
    if (Math.abs(velocity) > 0.28) {
      targetPage = velocity > 0 ? 0 : 1;
    }
    
    setPage(targetPage, velocity);
  });

  swipeViewport.addEventListener('pointercancel', (e) => {
    if (!isDraggingSwipe) return;
    isDraggingSwipe = false;
    swipeTrack.classList.remove('dragging');
    setPage(currentPage);
  });

  toggleViewBtn.addEventListener('click', () => {
    const nextPage = currentPage === 0 ? 1 : 0;
    setPage(nextPage);
  });

  indicatorDots.forEach(dot => {
    dot.addEventListener('click', () => {
      const pageIndex = parseInt(dot.getAttribute('data-page'));
      setPage(pageIndex);
    });
  });

  // ==========================================================================
  // 6. Fullscreen QR Zoom System (Origin-Aware Morph transition)
  // ==========================================================================

  if (qrImage && qrFullscreen) {
    const fsImage = qrFullscreen.querySelector('.qr-fullscreen-image');

    qrImage.addEventListener('click', () => {
      // Bounding parameters of origin trigger
      const triggerRect = qrImage.getBoundingClientRect();
      
      const tx = triggerRect.left + triggerRect.width / 2;
      const ty = triggerRect.top + triggerRect.height / 2;
      
      // Center of the centered fullscreen image
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      
      // Set dynamic transform-origin relative to centered element coordinate space
      fsImage.style.transformOrigin = `calc(50% + ${tx - cx}px) calc(50% + ${ty - cy}px)`;
      
      // Ensure starting scale is applied before showing
      fsImage.classList.remove('qr-animate-in');
      
      // Force layout reflow to register starting scale state & origin before animation runs
      void fsImage.offsetWidth;
      
      qrFullscreen.classList.remove('hidden');
      
      // Trigger entry animation (replaces @starting-style for WebKit compat)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          fsImage.classList.add('qr-animate-in');
        });
      });
    });

    qrFullscreen.addEventListener('click', () => {
      fsImage.classList.remove('qr-animate-in');
      qrFullscreen.classList.add('hidden');
    });
  }

  // Initialize page display classes for reduced motion fallback
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    const slides = document.querySelectorAll('.swipe-slide');
    slides.forEach((slide, idx) => {
      slide.classList.toggle('active-slide', idx === currentPage);
    });
  }

  // ==========================================================================
  // 7. Settings Popover & Theme Switching System
  // ==========================================================================
  const settingsBtn = document.getElementById('settings-btn');
  const settingsDropdown = document.getElementById('settings-dropdown');
  const themeOptBtns = document.querySelectorAll('.theme-opt-btn');

  if (settingsBtn && settingsDropdown) {
    // Toggle settings dropdown popover
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = settingsDropdown.classList.toggle('hidden');
      settingsBtn.classList.toggle('active', !isHidden);
    });

    // Prevent popover close on clicking dropdown contents
    settingsDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Close settings dropdown on clicking anywhere else on page
    document.addEventListener('click', () => {
      settingsDropdown.classList.add('hidden');
      settingsBtn.classList.remove('active');
    });

    // Theme application function
    function applyTheme(mode) {
      if (mode === 'system') {
        const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (isSystemDark) {
          document.documentElement.removeAttribute('data-theme');
        } else {
          document.documentElement.setAttribute('data-theme', 'light');
        }
      } else if (mode === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
      } else {
        document.documentElement.removeAttribute('data-theme'); // default is dark
      }
    }

    // Toggle active state in popover buttons
    function updateDropdownUI(mode) {
      themeOptBtns.forEach(btn => {
        const btnMode = btn.getAttribute('data-theme');
        btn.classList.toggle('active', btnMode === mode);
      });
    }

    // Select theme mode click bindings
    themeOptBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-theme');
        localStorage.setItem('theme-mode', mode);
        applyTheme(mode);
        updateDropdownUI(mode);
        settingsDropdown.classList.add('hidden');
        settingsBtn.classList.remove('active');
      });
    });

    // Watch system color scheme changes
    const systemMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    systemMediaQuery.addEventListener('change', () => {
      const currentMode = localStorage.getItem('theme-mode') || 'system';
      if (currentMode === 'system') {
        applyTheme('system');
      }
    });

    // Initialize theme mode
    const initialMode = localStorage.getItem('theme-mode') || 'system';
    updateDropdownUI(initialMode);
    applyTheme(initialMode);
  }

  // ==========================================================================
  // 8. QR Code Image Persistence (LocalStorage)
  // ==========================================================================

  function updateQRImages(src) {
    if (qrImage) qrImage.src = src;
    if (qrFullscreenImage) qrFullscreenImage.src = src;
  }

  // Load custom QR on start
  const customQr = localStorage.getItem('custom-qr');
  if (customQr) {
    updateQRImages(customQr);
  } else {
    updateQRImages('assets/duitnow-qr.png');
  }

  // ==========================================================================
  // 9. Config Event Listeners (Rounding & Custom Rates)
  // ==========================================================================
  if (roundingSelect) {
    roundingSelect.addEventListener('change', () => {
      roundingMode = roundingSelect.value;
      localStorage.setItem('rounding-mode', roundingMode);
      calculate();
    });
  }

  if (rateMorningInput) {
    rateMorningInput.addEventListener('change', () => {
      const val = parseFloat(rateMorningInput.value);
      if (!isNaN(val) && val >= 0) {
        rateMorning = val;
        localStorage.setItem('rate-morning', val);
        calculate();
      }
    });
  }

  if (rateEveningInput) {
    rateEveningInput.addEventListener('change', () => {
      const val = parseFloat(rateEveningInput.value);
      if (!isNaN(val) && val >= 0) {
        rateEvening = val;
        localStorage.setItem('rate-evening', val);
        calculate();
      }
    });
  }

  // ==========================================================================
  // 10. Copy Bill Summary Functionality
  // ==========================================================================
  function showToast(message) {
    let toast = document.getElementById('copy-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'copy-toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<span class="toast-icon">✨</span><span class="toast-msg">${message}</span>`;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  }

  function fallbackCopyText(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    // Position off-screen to avoid visual jump, keep it in DOM and displayable so Safari allows focus
    textArea.style.position = "absolute";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";
    document.body.appendChild(textArea);
    
    // Select text (handles both PC and iOS Safari selection ranges)
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, 99999);
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        showToast("账单已成功复制到剪贴板！");
      } else {
        alert("复制失败，请手动选择复制。");
      }
    } catch (err) {
      console.error('Fallback copy failed: ', err);
      alert("复制失败，请手动选择复制。");
    }
    document.body.removeChild(textArea);
  }

  if (copyBillBtn) {
    copyBillBtn.addEventListener('click', () => {
      const startHour = parseInt(startTimeSelect.value);
      const duration = parseInt(durationSlider.value);
      const shuttlesUsed = parseInt(shuttlesUsedInput.value) || 0;
      const shuttlePrice = parseFloat(shuttlePriceInput.value) || 0;
      const totalPlayers = parseInt(totalPlayersInput.value) || 0;
      const hostCount = parseInt(hostCountInput.value) || 0;
      const payingPlayers = totalPlayers - hostCount;
      const additionalShuttles = parseInt(additionalShuttlesInput ? additionalShuttlesInput.value : 0) || 0;
      const startStr = format12Hour(startHour);
      const endStr = format12Hour(startHour + duration);

      let courtCount = 0;
      for (let i = 0; i < courtRadios.length; i++) {
        if (courtRadios[i].checked) {
          courtCount = parseInt(courtRadios[i].value);
          break;
        }
      }

      const { fee: baseCourtFee } = calculateCourtFee(startHour, duration);
      const courtFee = baseCourtFee * courtCount;

      const calcRes = computeFeeAndBreakdown(
        courtFee, shuttlesUsed, shuttlePrice, totalPlayers, hostCount, additionalShuttles, roundingMode
      );

      let playerFeeStr = '--';
      let revenueStr = '--';
      let profitStr = '--';
      let shuttlesUsedStr = shuttlesUsed.toString();

      if (calcRes.isValid) {
        if (calcRes.billedShuttles > shuttlesUsed) {
          let parts = [`实际 ${shuttlesUsed} 个`];
          if (calcRes.requiredHostShuttles > 0) {
            parts.push(`覆盖Host需 ${calcRes.requiredHostShuttles} 个`);
          }
          if (calcRes.profitShuttles > 0) {
            parts.push(`额外盈利 +${calcRes.profitShuttles} 个`);
          }
          shuttlesUsedStr = `${calcRes.billedShuttles} (${parts.join('，')})`;
        }
        playerFeeStr = `RM ${formatCurrency(calcRes.playerFee)}`;
        revenueStr = `RM ${formatCurrency(calcRes.totalRevenue)}`;

        if (calcRes.netProfit < 0) {
          profitStr = `-RM ${formatCurrency(Math.abs(calcRes.netProfit))}`;
        } else {
          profitStr = `RM ${formatCurrency(calcRes.netProfit)}`;
        }
      }

      let roundingDesc = "";
      if (roundingMode === 'nearest-0.5') roundingDesc = " (舍入至0.5)";
      else if (roundingMode === 'ceil') roundingDesc = " (向上取整)";
      else if (roundingMode === 'floor') roundingDesc = " (向下取整)";

      const timeRangeStr = `${startStr} - ${endStr}`;
      const singleShuttlePrice = shuttlePrice > 0 ? (shuttlePrice / 12) : 0;
      const additionalFeeLine = additionalShuttles > 0
        ? `➕ *附加用球*：+${additionalShuttles} 个 (RM ${(additionalShuttles * singleShuttlePrice).toFixed(2)})\n`
        : '';

      // Replace placeholders in template dynamically
      const billText = billTemplate
        .replace(/{TIME_RANGE}/g, timeRangeStr)
        .replace(/{DURATION}/g, duration.toString())
        .replace(/{COURT_COUNT}/g, courtCount.toString())
        .replace(/{COURT_FEE}/g, courtFee.toFixed(2))
        .replace(/{SHUTTLES_USED}/g, shuttlesUsedStr)
        .replace(/{SHUTTLE_COST}/g, calcRes.billedShuttleCost.toFixed(2))
        .replace(/{SHUTTLE_PRICE}/g, shuttlePrice.toFixed(2))
        .replace(/{TOTAL_PLAYERS}/g, totalPlayers.toString())
        .replace(/{HOST_COUNT}/g, hostCount.toString())
        .replace(/{PAYING_PLAYERS}/g, payingPlayers.toString())
        .replace(/{PLAYER_FEE}/g, playerFeeStr)
        .replace(/{ROUNDING_DESC}/g, roundingDesc)
        .replace(/{ADDITIONAL_FEE_LINE}/g, additionalFeeLine)
        .replace(/{ADDITIONAL_FEE}/g, (additionalShuttles * singleShuttlePrice).toFixed(2))
        .replace(/{TOTAL_COST}/g, calcRes.actualTotalCost.toFixed(2))
        .replace(/{TOTAL_REVENUE}/g, revenueStr)
        .replace(/{NET_PROFIT}/g, profitStr);

      // Robust copy to clipboard (handles security constraints in Safari/HTTP/sandboxes)
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(billText).then(() => {
            showToast("账单已成功复制到剪贴板！");
          }).catch(err => {
            console.error('Failed to copy with navigator.clipboard: ', err);
            fallbackCopyText(billText);
          });
        } else {
          fallbackCopyText(billText);
        }
      } catch (err) {
        console.error('Synchronous copy error: ', err);
        fallbackCopyText(billText);
      }
    });
  }

  // ==========================================================================
  // 11. Focus Selection UX Enhancements
  // ==========================================================================
  [shuttlePriceInput, rateMorningInput, rateEveningInput].forEach(input => {
    if (input) {
      input.addEventListener('focus', (e) => {
        e.target.select();
      });
    }
  });

  // Run initial calculation
  calculate();
});
