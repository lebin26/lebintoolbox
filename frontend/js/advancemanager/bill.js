/**
 * Advance Manager - Bill Share & WhatsApp Copy Module
 */

window.AMBill = (function () {
  const { formatMYR } = window.AMFormatters;

  function generateBillText({ person, expenses = [], settlements = [], meName = '我' }) {
    if (!person) return '';

    const dateStr = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    const lines = [
      `🧾 【OmniBox 垫付往来对账单】`,
      `致：${person.name}${person.nickname ? ` (${person.nickname})` : ''}`,
      `对账日期：${dateStr}`,
      `发件人：${meName}`,
      ``,
      `📋 往来账目明细：`
    ];

    const allTx = [
      ...expenses.map(e => ({
        date: e.transaction_date,
        text: `• ${new Date(e.transaction_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${e.description}: ${e.payer_person_id === person.id ? '你先付' : '为你垫付'} (${formatMYR(e.total_amount)})`
      })),
      ...settlements.map(s => ({
        date: s.settlement_date,
        text: `• ${new Date(s.settlement_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} 还款记录 (${formatMYR(s.amount)})`
      }))
    ];

    if (allTx.length === 0) {
      lines.push(`• 暂无未结往来明细`);
    } else {
      lines.push(...allTx.slice(0, 10).map(t => t.text));
    }

    lines.push(`---------------------------------`);
    if (person.theyOweMe > 0) {
      lines.push(`💰 当前结算：你还需转我 ${formatMYR(person.theyOweMe)}`);
      lines.push(`📱 DuitNow / 银行转账就绪，转账后请告知平账～`);
    } else if (person.iOweThem > 0) {
      lines.push(`💰 当前结算：我还需转你 ${formatMYR(person.iOweThem)}`);
      lines.push(`📱 请发我你的收款二维码 / DuitNow 账号，我来转账～`);
    } else {
      lines.push(`✨ 当前状态：已全部结清 (RM 0.00)`);
    }

    return lines.join('\n');
  }

  async function copyBillToClipboard(person, expenses, settlements, meName) {
    const text = generateBillText({ person, expenses, settlements, meName });
    try {
      await navigator.clipboard.writeText(text);
      if (typeof window.showToast === 'function') {
        window.showToast('📋 对账催款单已复制到剪贴板！');
      }
      return true;
    } catch (e) {
      // Fallback for non-secure context
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      if (typeof window.showToast === 'function') {
        window.showToast('📋 对账催款单已复制到剪贴板！');
      }
      return true;
    }
  }

  return {
    generateBillText,
    copyBillToClipboard
  };
})();
