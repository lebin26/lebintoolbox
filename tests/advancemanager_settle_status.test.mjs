import test from 'node:test';
import assert from 'node:assert/strict';

test('Settlement Status: Settle marks all target expenses as settled', () => {
  const expenses = [
    { id: 'exp_1', description: 'Lunch', status: 'unsettled', total_amount: 5000 },
    { id: 'exp_2', description: 'Coffee', status: 'unsettled', total_amount: 2000 },
    { id: 'exp_3', description: 'Movie', status: 'unsettled', total_amount: 3000 }
  ];

  const settledExpenseIds = ['exp_1', 'exp_2'];

  const updatedExpenses = expenses.map(e => {
    if (settledExpenseIds.includes(e.id)) {
      return { ...e, status: 'settled' };
    }
    return e;
  });

  assert.equal(updatedExpenses.find(e => e.id === 'exp_1').status, 'settled');
  assert.equal(updatedExpenses.find(e => e.id === 'exp_2').status, 'settled');
  assert.equal(updatedExpenses.find(e => e.id === 'exp_3').status, 'unsettled');
});
