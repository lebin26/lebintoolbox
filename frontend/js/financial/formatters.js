/**
 * Financial Overview - Formatters & Helper Utilities
 */

(function () {
  const CURRENCY_SYMBOLS = {
    MYR: 'RM',
    USD: '$',
    SGD: 'S$',
    HKD: 'HK$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CNY: '¥',
    AUD: 'A$'
  };

  const TYPE_ICONS = {
    Cash: '💵',
    Savings: '🏦',
    'Fixed Deposit': '🔒',
    Investment: '📈',
    Brokerage: '📊',
    'E-Wallet': '📱',
    Other: '📦'
  };

  const FinancialFormatters = {
    getCurrencySymbol(currency = 'MYR') {
      return CURRENCY_SYMBOLS[currency.toUpperCase()] || currency;
    },

    formatCurrency(amount, currency = 'MYR', showSymbol = true) {
      if (amount === null || amount === undefined || isNaN(amount)) {
        return 'Not Reported';
      }
      const num = Number(amount);
      const symbol = showSymbol ? (CURRENCY_SYMBOLS[currency.toUpperCase()] || currency) + ' ' : '';
      return symbol + num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    },

    formatCurrencyHTML(amount, currency = 'MYR') {
      if (amount === null || amount === undefined || isNaN(amount)) {
        return `<span class="val">未录入</span>`;
      }
      const sym = CURRENCY_SYMBOLS[currency.toUpperCase()] || currency;
      const num = Number(amount);
      const formatted = num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      return `<span class="unit">${sym}</span><span class="val">${formatted}</span>`;
    },

    formatPct(pct) {
      if (pct === null || pct === undefined || isNaN(pct)) return '0.0%';
      return Number(pct).toFixed(1) + '%';
    },

    formatMoM(diffAmount, pct, baseCurrency = 'MYR') {
      if (diffAmount === null || diffAmount === undefined) {
        return { text: '首月记录', className: 'tag-neutral', icon: '✨' };
      }
      const symbol = CURRENCY_SYMBOLS[baseCurrency.toUpperCase()] || baseCurrency;
      const num = Number(diffAmount);
      const absFormatted = Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const pctStr = pct !== null && !isNaN(pct) ? ` (${pct > 0 ? '+' : ''}${Number(pct).toFixed(2)}%)` : '';

      if (num > 0) {
        return {
          text: `+${symbol} ${absFormatted}${pctStr}`,
          className: 'tag-bullish',
          icon: '↑'
        };
      } else if (num < 0) {
        return {
          text: `-${symbol} ${absFormatted}${pctStr}`,
          className: 'tag-bearish',
          icon: '↓'
        };
      }
      return {
        text: `${symbol} 0.00 (0.00%)`,
        className: 'tag-neutral',
        icon: '→'
      };
    },

    formatDrift(actualPct, targetPct) {
      if (targetPct === null || targetPct === undefined || targetPct === 0) {
        return null;
      }
      const actual = Number(actualPct) || 0;
      const target = Number(targetPct) || 0;
      const drift = actual - target;
      const absDrift = Math.abs(drift).toFixed(1);

      if (drift >= 5.0) {
        return {
          text: `超配 +${absDrift}%`,
          className: 'fin-drift-over',
          drift
        };
      } else if (drift <= -5.0) {
        return {
          text: `低配 -${absDrift}%`,
          className: 'fin-drift-under',
          drift
        };
      }
      return {
        text: `均衡 (${drift >= 0 ? '+' : ''}${drift.toFixed(1)}%)`,
        className: 'fin-drift-balanced',
        drift
      };
    },

    getTypeIcon(type) {
      return TYPE_ICONS[type] || '💰';
    }
  };

  window.FinancialFormatters = FinancialFormatters;
})();
