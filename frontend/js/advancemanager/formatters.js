/**
 * Advance Manager - Formatters & Parsing Utilities
 */

window.AMFormatters = (function () {
  function formatMYR(cents) {
    if (cents === null || cents === undefined || isNaN(cents)) return 'RM 0.00';
    const val = Number(cents) / 100;
    return 'RM ' + val.toLocaleString('en-MY', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function parseCents(val) {
    if (typeof val === 'number') return Math.round(val * 100);
    if (!val || typeof val !== 'string') return 0;
    const clean = val.replace(/[^0-9.-]/g, '');
    const num = parseFloat(clean);
    if (isNaN(num) || num <= 0) return 0;
    return Math.round(num * 100);
  }

  function formatDate(isoStr, includeTime = false) {
    if (!isoStr) return '--';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      const opts = {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kuala_Lumpur'
      };
      if (includeTime) {
        opts.hour = '2-digit';
        opts.minute = '2-digit';
        opts.hour12 = false;
      }
      return d.toLocaleDateString('en-GB', opts);
    } catch (e) {
      return isoStr;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  return {
    formatMYR,
    parseCents,
    formatDate,
    escapeHtml
  };
})();
