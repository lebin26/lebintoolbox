import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Retention Policy Simulator for Settled Expenses & Settlements
 */
export function pruneHistory(expenses = [], settlements = [], keepCount = 5) {
  // Filter settled expenses
  const settled = expenses.filter(e => e.status === 'settled');
  const unsettled = expenses.filter(e => e.status !== 'settled');

  // Sort descending by date
  settled.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Retain only latest keepCount
  const retainedSettled = settled.slice(0, keepCount);
  const purgedExpenses = settled.slice(keepCount);

  // Settlements
  const sortedSets = [...settlements].sort((a, b) => new Date(b.date) - new Date(a.date));
  const retainedSettlements = sortedSets.slice(0, keepCount);
  const purgedSettlements = sortedSets.slice(keepCount);

  return {
    retainedExpenses: [...unsettled, ...retainedSettled],
    purgedExpensesCount: purgedExpenses.length,
    retainedSettlements,
    purgedSettlementsCount: purgedSettlements.length
  };
}

test('Retention Policy: Retains exactly latest 5 settled expenses and keeps all unsettled expenses', () => {
  const expenses = [];
  // 3 unsettled expenses
  for (let i = 1; i <= 3; i++) {
    expenses.push({ id: `unsettled_${i}`, status: 'unsettled', date: `2026-08-1${i}` });
  }
  // 10 settled expenses
  for (let i = 1; i <= 10; i++) {
    expenses.push({ id: `settled_${i}`, status: 'settled', date: `2026-08-${i < 10 ? '0' + i : i}` });
  }

  const result = pruneHistory(expenses, [], 5);

  assert.equal(result.purgedExpensesCount, 5, 'Should purge 5 oldest settled expenses');
  assert.equal(result.retainedExpenses.length, 8, '3 unsettled + 5 settled = 8 total');

  // Verify all 3 unsettled are preserved
  const retainedUnsettled = result.retainedExpenses.filter(e => e.status === 'unsettled');
  assert.equal(retainedUnsettled.length, 3);
});

test('Retention Policy: Retains exactly latest 5 settlements', () => {
  const settlements = [];
  for (let i = 1; i <= 12; i++) {
    settlements.push({ id: `set_${i}`, date: `2026-08-${i < 10 ? '0' + i : i}` });
  }

  const result = pruneHistory([], settlements, 5);

  assert.equal(result.purgedSettlementsCount, 7, 'Should purge 7 oldest settlements');
  assert.equal(result.retainedSettlements.length, 5, 'Should retain only latest 5 settlements');
  assert.equal(result.retainedSettlements[0].id, 'set_12', 'Latest settlement must be retained first');
});
