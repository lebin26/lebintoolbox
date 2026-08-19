import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMYR } from './advancemanager_api.test.mjs';

/**
 * WhatsApp & Social Shareable Bill Formatter
 */
export function generateShareableBillText({ person, expenses = [], settlements = [], meName = '我' }) {
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

test('generateShareableBillText formats debtor correctly', () => {
  const text = generateShareableBillText({
    person: { name: 'John', theyOweMe: 4000, iOweThem: 0 },
    expenses: [
      { transaction_date: '2026-08-19T12:00:00Z', description: '周末聚餐', total_amount: 4000, payer_person_id: 'me' }
    ],
    settlements: [],
    meName: 'Lebin'
  });

  assert.ok(text.includes('致：John'));
  assert.ok(text.includes('周末聚餐: 为你垫付 (RM 40.00)'));
  assert.ok(text.includes('你还需转我 RM 40.00'));
});

test('generateShareableBillText formats settled state correctly', () => {
  const text = generateShareableBillText({
    person: { name: 'Mary', theyOweMe: 0, iOweThem: 0 },
    expenses: [],
    settlements: [],
    meName: 'Lebin'
  });

  assert.ok(text.includes('致：Mary'));
  assert.ok(text.includes('已全部结清 (RM 0.00)'));
});
