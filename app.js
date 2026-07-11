document.addEventListener('DOMContentLoaded', () => {
  // Input elements (Dropdowns, Hidden, and Standard inputs)
  const startTimeSelect = document.getElementById('start-time-select');
  const durationSlider = document.getElementById('duration-slider');
  const shuttlesUsedInput = document.getElementById('shuttles-used');
  const shuttlePriceInput = document.getElementById('shuttle-price');
  const totalPlayersInput = document.getElementById('total-players');
  const hostCountInput = document.getElementById('host-count');
  const additionalFeeInput = document.getElementById('additional-fee');

  // Trigger elements (that toggle panels or drawers)
  const durationTrigger = document.getElementById('duration-trigger');
  const durationDisplay = document.getElementById('duration-display');
  const durationSliderPanel = document.getElementById('duration-slider-panel');
  const sliderValBubble = document.getElementById('slider-val-bubble');
  const timeRangeDisplay = document.getElementById('time-range-display');

  const shuttlesPickerTrigger = document.getElementById('shuttles-picker');
  const shuttlesDisplayVal = document.getElementById('shuttles-display');

  const playersPickerTrigger = document.getElementById('players-picker');
  const playersDisplayVal = document.getElementById('players-display');

  const hostPickerTrigger = document.getElementById('host-picker');
  const hostDisplayVal = document.getElementById('host-display');

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

  // Pricing constants
  const RATE_MORNING = 14.84; // 12am - 6pm
  const RATE_EVENING = 29.68; // 6pm - 12am

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
    let sequence = [];

    for (let h = 0; h < duration; h++) {
      const hourOfDay = (startHour + h) % 24;
      // Morning is 12am (0) to 6pm (18:00) -> [0, 17]
      if (hourOfDay >= 0 && hourOfDay < 18) {
        totalFee += RATE_MORNING;
        sequence.push("早");
      } else {
        totalFee += RATE_EVENING;
        sequence.push("晚");
      }
    }
    
    return {
      fee: totalFee,
      breakdown: sequence.join("+")
    };
  }

  // Main Calculation Loop
  function calculate() {
    // 1. Gather input parameters
    const startHour = parseInt(startTimeSelect.value);
    const duration = parseInt(durationSlider.value);
    const shuttlesUsed = parseInt(shuttlesUsedInput.value) || 0;
    const shuttlePrice = parseFloat(shuttlePriceInput.value) || 0;
    const totalPlayers = parseInt(totalPlayersInput.value) || 0;
    const hostCount = parseInt(hostCountInput.value) || 0;
    const additionalFee = parseFloat(additionalFeeInput.value) || 0;

    // 2. Compute dynamic time range text
    const endHour = startHour + duration;
    const startStr = format12Hour(startHour);
    const endStr = format12Hour(endHour);
    timeRangeDisplay.textContent = `${startStr} - ${endStr}`;
    durationDisplay.textContent = `${duration} 小时`;
    sliderValBubble.textContent = `${duration} 小时`;

    // 3. Compute dynamic court fee
    const { fee: baseCourtFee, breakdown } = calculateCourtFee(startHour, duration);
    const courtCountRadio = document.querySelector('input[name="court-count"]:checked');
    const courtCount = courtCountRadio ? parseInt(courtCountRadio.value) : 1;
    const courtFee = baseCourtFee * courtCount;
    
    courtFeeInput.value = formatCurrency(courtFee);
    courtFeeBreakdown.textContent = breakdown + (courtCount > 1 ? ` × ${courtCount}` : '');

    // 4. Determine paying players
    const payingPlayers = totalPlayers - hostCount;

    // 5. Validation: Avoid division by zero
    if (payingPlayers <= 0) {
      errorBanner.classList.remove('hidden');
      playerFeeDisplay.textContent = '--';
      playerFeeDisplay.className = 'ticker-price error-state';
      
      const totalCost = courtFee + (shuttlesUsed * shuttlePrice / 12);
      totalCostDisplay.textContent = formatCurrency(totalCost);
      totalRevenueDisplay.textContent = '--';
      netProfitDisplay.textContent = '--';
      
      profitRow.className = 'summary-row profit-highlight';
      return;
    }

    errorBanner.classList.add('hidden');

    // 6. Run badminton calculations (Method A: exact float math internally)
    const shuttleCost = (shuttlesUsed * shuttlePrice) / 12;
    const totalCost = courtFee + shuttleCost;
    
    // 每人收费 = (场地费 + 球费) / 缴费人数 + 附加收费
    const playerFee = (totalCost / payingPlayers) + additionalFee;
    
    // 总收款 = 每人收费 * 缴费人数
    const totalRevenue = playerFee * payingPlayers;
    
    // 净利润 = 总收款 - 总成本
    const netProfit = totalRevenue - totalCost;

    // 7. Update UI with formatted values
    playerFeeDisplay.textContent = formatCurrency(playerFee);
    playerFeeDisplay.className = 'ticker-price has-value';
    
    totalCostDisplay.textContent = formatCurrency(totalCost);
    totalRevenueDisplay.textContent = formatCurrency(totalRevenue);
    netProfitDisplay.textContent = formatCurrency(netProfit);

    // 8. Style profit highlighting row
    if (netProfit > 0.005) {
      profitRow.className = 'summary-row profit-highlight profit-state';
    } else if (netProfit < -0.005) {
      profitRow.className = 'summary-row profit-highlight loss-state';
    } else {
      profitRow.className = 'summary-row profit-highlight';
    }
  }

  // --- Dynamic Option Picker Drawer System ---
  let activeHiddenInput = null;
  let activeDisplayEl = null;

  function openDrawer(title, min, max, currentVal, hiddenInput, displayEl, isHost = false) {
    activeHiddenInput = hiddenInput;
    activeDisplayEl = displayEl;

    drawerTitle.textContent = title;
    drawerBody.innerHTML = ''; // Clear previous content

    const container = document.createElement('div');
    if (isHost) {
      container.className = 'drawer-options-row';
    } else {
      container.className = 'drawer-options-grid';
    }

    for (let i = min; i <= max; i++) {
      const cell = document.createElement('div');
      cell.className = 'drawer-option-cell';
      cell.textContent = i;
      if (i === currentVal) {
        cell.classList.add('selected');
      }

      cell.addEventListener('click', () => {
        // Update value
        activeHiddenInput.value = i;
        activeDisplayEl.textContent = i;
        
        // Recalculate and Close
        calculate();
        closeDrawer();
      });

      container.appendChild(cell);
    }

    drawerBody.appendChild(container);
    drawerOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  }

  function closeDrawer() {
    drawerOverlay.classList.add('hidden');
    document.body.style.overflow = '';
  }

  // Bind trigger clicks
  playersPickerTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const current = parseInt(totalPlayersInput.value) || 12;
    openDrawer("选择参与人数 (含Host)", 1, 40, current, totalPlayersInput, playersDisplayVal, false);
  });

  shuttlesPickerTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const current = parseInt(shuttlesUsedInput.value) || 8;
    openDrawer("选择用球数量 (个)", 1, 24, current, shuttlesUsedInput, shuttlesDisplayVal, false);
  });

  hostPickerTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const current = parseInt(hostCountInput.value) || 2;
    openDrawer("选择 Host 人数", 1, 2, current, hostCountInput, hostDisplayVal, true);
  });

  // Drawer Close events
  drawerCloseBtn.addEventListener('click', closeDrawer);
  drawerOverlay.addEventListener('click', (e) => {
    // Only close if user clicked directly on the overlay backdrop
    if (e.target === drawerOverlay) {
      closeDrawer();
    }
  });

  // Set event listeners for live calculations
  startTimeSelect.addEventListener('change', calculate);
  durationSlider.addEventListener('input', calculate);
  durationSlider.addEventListener('change', calculate);
  shuttlePriceInput.addEventListener('input', calculate);
  additionalFeeInput.addEventListener('input', calculate);

  // Add listener for court count radio group change
  document.querySelectorAll('input[name="court-count"]').forEach(radio => {
    radio.addEventListener('change', calculate);
  });

  // Auto-format currency inputs on blur
  [shuttlePriceInput, additionalFeeInput].forEach(input => {
    input.addEventListener('blur', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) {
        e.target.value = val.toFixed(2);
      }
    });
  });

  // --- Swipe Navigation Page System (Calc vs QR Code) ---
  const toggleViewBtn = document.getElementById('toggle-view-btn');
  const swipeViewport = document.querySelector('.swipe-viewport');
  const swipeTrack = document.getElementById('swipe-track');
  const indicatorDots = document.querySelectorAll('.indicator-dot');
  let currentPage = 0;

  function setPage(pageIndex) {
    currentPage = pageIndex;
    if (pageIndex === 0) {
      swipeTrack.style.transform = 'translateX(0%)';
      toggleViewBtn.innerHTML = '<span class="btn-icon">📱</span><span class="btn-text">收款码</span>';
      toggleViewBtn.classList.remove('active');
    } else {
      swipeTrack.style.transform = 'translateX(-50%)';
      toggleViewBtn.innerHTML = '<span class="btn-icon">📊</span><span class="btn-text">计算器</span>';
      toggleViewBtn.classList.add('active');
    }

    // Update indicators
    indicatorDots.forEach((dot, idx) => {
      if (idx === pageIndex) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }

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

  // Touch swiping gestures
  let startX = 0;
  let currentX = 0;
  let isSwiping = false;

  swipeViewport.addEventListener('touchstart', (e) => {
    // Avoid swiping if touching inputs, range sliders, or picker drawers
    if (
      e.target.closest('#duration-slider') || 
      e.target.closest('.drawer-sheet') || 
      e.target.closest('.picker-trigger') ||
      e.target.closest('select') ||
      e.target.closest('input')
    ) {
      isSwiping = false;
      return;
    }
    startX = e.touches[0].clientX;
    currentX = startX;
    isSwiping = true;
  }, { passive: true });

  swipeViewport.addEventListener('touchmove', (e) => {
    if (!isSwiping) return;
    currentX = e.touches[0].clientX;
  }, { passive: true });

  swipeViewport.addEventListener('touchend', () => {
    if (!isSwiping) return;
    isSwiping = false;
    const diffX = startX - currentX;
    const swipeThreshold = 60; // minimum distance in px
    
    if (Math.abs(diffX) > swipeThreshold) {
      if (diffX > 0 && currentPage === 0) {
        setPage(1); // Swipe left -> QR Code page
      } else if (diffX < 0 && currentPage === 1) {
        setPage(0); // Swipe right -> Calculator page
      }
    }
  });

  // --- Fullscreen QR Zoom System ---
  const qrImage = document.querySelector('.qr-image');
  const qrFullscreen = document.getElementById('qr-fullscreen');

  if (qrImage && qrFullscreen) {
    qrImage.addEventListener('click', () => {
      qrFullscreen.classList.remove('hidden');
      // Let the browser paint the display: flex layout before animating opacity/scale
      setTimeout(() => {
        qrFullscreen.classList.add('active');
      }, 10);
    });

    qrFullscreen.addEventListener('click', () => {
      qrFullscreen.classList.remove('active');
      // Wait for opacity transition to complete before setting display: none
      setTimeout(() => {
        qrFullscreen.classList.add('hidden');
      }, 220); // 220ms matches the CSS transition length
    });
  }

  // Run initial calculation
  calculate();
});
