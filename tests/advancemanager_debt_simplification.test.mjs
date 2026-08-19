import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Greedy Debt Simplification Algorithm
 * Reduces N-party pairwise debts to minimum number of transfers (at most N-1)
 *
 * @param {Object} personNetBalances - map of { personId: { id, name, netBalance (cents) } }
 * @returns {Array} - simplified transfers [{ from_id, from_name, to_id, to_name, amount }]
 */
export function simplifyDebts(personNetBalances) {
  const debtors = [];   // netBalance < 0 (owes money)
  const creditors = []; // netBalance > 0 (is owed money)

  for (const p of Object.values(personNetBalances)) {
    const net = p.netBalance || 0;
    if (net < 0) {
      debtors.push({ id: p.id, name: p.name, balance: -net }); // positive debt amount
    } else if (net > 0) {
      creditors.push({ id: p.id, name: p.name, balance: net });
    }
  }

  // Sort descending
  debtors.sort((a, b) => b.balance - a.balance);
  creditors.sort((a, b) => b.balance - a.balance);

  const transactions = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const amount = Math.min(debtor.balance, creditor.balance);
    if (amount > 0) {
      transactions.push({
        from_id: debtor.id,
        from_name: debtor.name,
        to_id: creditor.id,
        to_name: creditor.name,
        amount
      });
    }

    debtor.balance -= amount;
    creditor.balance -= amount;

    if (debtor.balance === 0) dIdx++;
    if (creditor.balance === 0) cIdx++;
  }

  return transactions;
}

// ----------------------------------------------------
// TESTS
// ----------------------------------------------------

test('Debt Simplification: 3-party chain (A owes B 30, B owes C 30 -> A pays C 30)', () => {
  // A net: -30, B net: 0, C net: +30
  const balances = {
    A: { id: 'A', name: 'Alice', netBalance: -3000 },
    B: { id: 'B', name: 'Bob', netBalance: 0 },
    C: { id: 'C', name: 'Charlie', netBalance: 3000 }
  };

  const transfers = simplifyDebts(balances);
  assert.equal(transfers.length, 1);
  assert.equal(transfers[0].from_id, 'A');
  assert.equal(transfers[0].to_id, 'C');
  assert.equal(transfers[0].amount, 3000);
});

test('Debt Simplification: 4-party cyclic debt (A->B 100, B->C 100, C->D 100, D->A 100 -> All Net 0)', () => {
  const balances = {
    A: { id: 'A', name: 'Alice', netBalance: 0 },
    B: { id: 'B', name: 'Bob', netBalance: 0 },
    C: { id: 'C', name: 'Charlie', netBalance: 0 },
    D: { id: 'D', name: 'David', netBalance: 0 }
  };

  const transfers = simplifyDebts(balances);
  assert.equal(transfers.length, 0, 'Cyclic debts completely cancel out');
});

test('Debt Simplification: Multi-party group trip settlement', () => {
  // Alice paid 300 for 4 people (Alice, Bob, Charlie, David each 75)
  // Alice net: +225, Bob net: -75, Charlie net: -75, David net: -75
  const balances = {
    A: { id: 'A', name: 'Alice', netBalance: 22500 },
    B: { id: 'B', name: 'Bob', netBalance: -7500 },
    C: { id: 'C', name: 'Charlie', netBalance: -7500 },
    D: { id: 'D', name: 'David', netBalance: -7500 }
  };

  const transfers = simplifyDebts(balances);
  assert.equal(transfers.length, 3);
  // Bob -> Alice 75, Charlie -> Alice 75, David -> Alice 75
  for (const t of transfers) {
    assert.equal(t.to_id, 'A');
    assert.equal(t.amount, 7500);
  }
});
