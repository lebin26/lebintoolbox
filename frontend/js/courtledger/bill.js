/**
 * Court Ledger - Bill & Copy Module
 * Handles loading bill templates, formatting summary text, and copying to clipboard.
 */

(function () {
  let billTemplate = '🏸 *Court Ledger 羽毛球费用结算*\n' +
    '📅 *时间*：{TIME_RANGE} ({DURATION} 小时)\n' +
    '🏟️ *场地*：{VENUE_NAME} ({COURT_COUNT} 片 × {DURATION} 小时，RM {COURT_FEE})\n' +
    '🏸 *用球*：{SHUTTLES_USED} 个 (RM {SHUTTLE_COST}，单价 RM {SHUTTLE_PRICE}/桶)\n' +
    '👥 *人数*：{TOTAL_PLAYERS} 人 (含 {HOST_COUNT} Host，{PAYING_PLAYERS} 人付费)\n' +
    '💰 *每人收费*：*{PLAYER_FEE}*\n' +
    '{ADDITIONAL_FEE_LINE}-------------------------\n' +
    '🧾 *总成本*：RM {TOTAL_COST}\n' +
    '💵 *总收款*：{TOTAL_REVENUE}\n' +
    '📈 *净利润*：{NET_PROFIT}\n\n' +
    '📌 *付款请划到第二页扫 QR 码，谢谢！*';

  function showToast(message) {
    if (typeof window.showToast === 'function') {
      window.showToast(message);
    }
  }

  function fallbackCopyText(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
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
    
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, 99999);
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        showToast("账单已成功复制到剪贴板！");
      } else {
        showToast("复制失败，请手动选择复制。");
      }
    } catch (err) {
      console.error('Fallback copy failed: ', err);
      showToast("复制失败，请手动选择复制。");
    }
    document.body.removeChild(textArea);
  }

  function initBillSystem() {
    const copyBillBtn = document.getElementById('copy-bill-btn');
    const startTimeSelect = document.getElementById('start-time-select');
    const durationSlider = document.getElementById('duration-slider');
    const shuttlesUsedInput = document.getElementById('shuttles-used');
    const shuttlePriceInput = document.getElementById('shuttle-price');
    const totalPlayersInput = document.getElementById('total-players');
    const hostCountInput = document.getElementById('host-count');
    const additionalShuttlesInput = document.getElementById('additional-shuttles');
    const courtRadios = document.querySelectorAll('input[name="court-count"]');

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

    function copyCalculatedBillText() {
      if (!startTimeSelect || !durationSlider || !window.CourtLedgerCalc) return '';

      const startHour = parseInt(startTimeSelect.value);
      const duration = parseInt(durationSlider.value);
      const shuttlesUsed = parseInt(shuttlesUsedInput.value) || 0;
      const shuttlePrice = parseFloat(shuttlePriceInput.value) || 0;
      const totalPlayers = parseInt(totalPlayersInput.value) || 0;
      const hostCount = parseInt(hostCountInput.value) || 0;
      const payingPlayers = totalPlayers - hostCount;
      const additionalShuttles = parseInt(additionalShuttlesInput ? additionalShuttlesInput.value : 0) || 0;
      const startStr = window.CourtLedgerCalc.format12Hour(startHour);
      const endStr = window.CourtLedgerCalc.format12Hour(startHour + duration);

      let courtCount = 0;
      for (let i = 0; i < courtRadios.length; i++) {
        if (courtRadios[i].checked) {
          courtCount = parseInt(courtRadios[i].value);
          break;
        }
      }
      if (courtCount === 0) courtCount = 1;

      const rates = window.CourtLedgerState ? window.CourtLedgerState.getActiveRates() : { venueName: '标准场地', rateMorning: 14.84, rateEvening: 29.68 };
      const courtRes = window.CourtLedgerCalc.calculateCourtFee(startHour, duration, rates.rateMorning, rates.rateEvening, courtCount);
      const courtFee = courtRes.fee;

      const calcRes = window.CourtLedgerCalc.computeFeeAndBreakdown(
        courtFee, shuttlesUsed, shuttlePrice, totalPlayers, hostCount, additionalShuttles
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
        playerFeeStr = `RM ${window.CourtLedgerCalc.formatCurrency(calcRes.playerFee)}`;
        revenueStr = `RM ${window.CourtLedgerCalc.formatCurrency(calcRes.totalRevenue)}`;

        if (calcRes.netProfit < 0) {
          profitStr = `-RM ${window.CourtLedgerCalc.formatCurrency(Math.abs(calcRes.netProfit))}`;
        } else {
          profitStr = `RM ${window.CourtLedgerCalc.formatCurrency(calcRes.netProfit)}`;
        }
      }

      const timeRangeStr = `${startStr} - ${endStr}`;
      const singleShuttlePrice = shuttlePrice > 0 ? (shuttlePrice / 12) : 0;
      const additionalFeeLine = additionalShuttles > 0
        ? `➕ *附加用球*：+${additionalShuttles} 个 (RM ${(additionalShuttles * singleShuttlePrice).toFixed(2)})\n`
        : '';

      const billText = billTemplate
        .replace(/{VENUE_NAME}/g, rates.venueName)
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
        .replace(/{ROUNDING_DESC}/g, '')
        .replace(/{ADDITIONAL_FEE_LINE}/g, additionalFeeLine)
        .replace(/{ADDITIONAL_FEE}/g, (additionalShuttles * singleShuttlePrice).toFixed(2))
        .replace(/{TOTAL_COST}/g, calcRes.actualTotalCost.toFixed(2))
        .replace(/{TOTAL_REVENUE}/g, revenueStr)
        .replace(/{NET_PROFIT}/g, profitStr);

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(billText).then(() => {
            showToast("📋 账单文案已成功复制到剪贴板！");
          }).catch(err => {
            fallbackCopyText(billText);
          });
        } else {
          fallbackCopyText(billText);
        }
      } catch (err) {
        fallbackCopyText(billText);
      }

      return billText;
    }

    if (copyBillBtn) {
      copyBillBtn.addEventListener('click', copyCalculatedBillText);
    }
  }

  window.CourtLedgerBill = {
    showToast,
    fallbackCopyText,
    initBillSystem,
    copyCalculatedBillText: function () {
      const copyBtn = document.getElementById('copy-bill-btn');
      if (copyBtn) copyBtn.click();
    }
  };
})();
