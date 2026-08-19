import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Pure Balance Engine Functions for Advance Manager
 */

export function calculateEqualSplit(totalAmountCents, participantIds) {
  if (!participantIds || participantIds.length === 0) {
    throw new Error('至少需要一个参与人');
  }
  const count = participantIds.length;
  const baseShare = Math.floor(totalAmountCents / count);
  let remainder = totalAmountCents % count;

  return participantIds.map((pid, idx) => {
    // Distribute remainder 1 cent at a time to early participants
    const share = baseShare + (idx < remainder ? 1 : 0);
    return {
      person_id: pid,
      split_type: 'equal',
      share_amount: share,
      percentage: Number(((share / totalAmountCents) * 100).toFixed(2))
    };
  });
}

export function validateFixedSplit(totalAmountCents, participants) {
  const sum = participants.reduce((acc, p) => acc + (parseInt(p.share_amount, 10) || 0), 0);
  if (sum !== totalAmountCents) {
    const diff = totalAmountCents - sum;
    return {
      valid: false,
      error: diff > 0 ? `分摊总和不足，还差 ${(diff / 100).toFixed(2)}` : `分摊总和超出 ${((-diff) / 100).toFixed(2)}`
    };
  }
  return { valid: true };
}

export function validatePercentageSplit(totalAmountCents, participants) {
  const sumPercent = participants.reduce((acc, p) => acc + (parseFloat(p.percentage) || 0), 0);
  if (Math.abs(sumPercent - 100) > 0.01) {
    return {
      valid: false,
      error: `百分比总和必须为 100%，当前为 ${sumPercent.toFixed(1)}%`
    };
  }
  return { valid: true };
}

/**
 * Computes pairwise debt and net balances for all persons
 *
 * @param {Array} persons - list of person objects { id, name }
 * @param {Array} expenses - list of expense objects { id, payer_person_id, total_amount, status, participants: [...] }
 * @param {Array} settlements - list of settlement objects { id, from_person_id, to_person_id, amount }
 * @param {string} mePersonId - ID of the current user's person avatar
 */
export function calculateAdvanceBalances({ persons = [], expenses = [], settlements = [], mePersonId = null }) {
  // 1. Filter out cancelled expenses
  const activeExpenses = expenses.filter(e => e.status !== 'cancelled');

  // Pairwise debt map: debtMap[creditorId][debtorId] = cents that debtor owes creditor
  const debtMap = {};
  const initDebt = (p1, p2) => {
    if (!debtMap[p1]) debtMap[p1] = {};
    if (!debtMap[p1][p2]) debtMap[p1][p2] = 0;
  };

  // Populate from expenses
  for (const exp of activeExpenses) {
    const payerId = exp.payer_person_id;
    const parts = exp.participants || [];
    for (const part of parts) {
      const debtorId = part.person_id;
      if (debtorId !== payerId) {
        initDebt(payerId, debtorId);
        debtMap[payerId][debtorId] += (part.share_amount || 0);
      }
    }
  }

  // Deduct settlements
  for (const set of settlements) {
    const fromId = set.from_person_id; // Debtor paying back
    const toId = set.to_person_id;     // Creditor receiving
    initDebt(toId, fromId);
    debtMap[toId][fromId] -= (set.amount || 0);
  }

  // 2. Compute Net Balances between all pairs
  // netMatrix[A][B] > 0 means B owes A. netMatrix[A][B] < 0 means A owes B.
  const personBalances = {};

  for (const person of persons) {
    const pId = person.id;
    personBalances[pId] = {
      id: pId,
      name: person.name,
      totalAdvanced: 0,  // How much I paid for others
      totalReceived: 0,  // How much I received in settlements
      totalSettled: 0,   // How much I paid in settlements
      owesMe: 0,         // Others owe me (before net or total)
      iOwe: 0,           // I owe others (before net)
      netBalance: 0,     // > 0 others owe me, < 0 I owe others
      pairwise: {}       // Breakdown with each person
    };
  }

  // Calculate pairwise net
  const personIds = persons.map(p => p.id);
  for (let i = 0; i < personIds.length; i++) {
    for (let j = i + 1; j < personIds.length; j++) {
      const p1 = personIds[i];
      const p2 = personIds[j];

      const p2OwesP1 = (debtMap[p1] && debtMap[p1][p2]) || 0;
      const p1OwesP2 = (debtMap[p2] && debtMap[p2][p1]) || 0;

      const netP1vsP2 = p2OwesP1 - p1OwesP2; // > 0: p2 owes p1, < 0: p1 owes p2

      if (personBalances[p1]) {
        personBalances[p1].pairwise[p2] = {
          net: netP1vsP2,
          theyOweMe: Math.max(0, netP1vsP2),
          iOweThem: Math.max(0, -netP1vsP2)
        };
      }
      if (personBalances[p2]) {
        personBalances[p2].pairwise[p1] = {
          net: -netP1vsP2,
          theyOweMe: Math.max(0, -netP1vsP2),
          iOweThem: Math.max(0, netP1vsP2)
        };
      }
    }
  }

  // Aggregate user total stats
  for (const pId of personIds) {
    const pb = personBalances[pId];
    for (const otherId of Object.keys(pb.pairwise)) {
      const pw = pb.pairwise[otherId];
      pb.owesMe += pw.theyOweMe;
      pb.iOwe += pw.iOweThem;
    }
    pb.netBalance = pb.owesMe - pb.iOwe;
  }

  // Dashboard summary relative to current user (mePersonId)
  let dashboard = {
    totalAdvanced: 0,
    totalSettled: 0,
    totalOutstanding: 0,
    iOweTotal: 0,
    netBalance: 0,
    peopleWhoOwe: [],
    peopleIOwe: []
  };

  if (mePersonId && personBalances[mePersonId]) {
    const me = personBalances[mePersonId];
    dashboard.totalOutstanding = me.owesMe;
    dashboard.iOweTotal = me.iOwe;
    dashboard.netBalance = me.netBalance;

    for (const pId of personIds) {
      if (pId === mePersonId) continue;
      const pw = me.pairwise[pId];
      if (pw && pw.theyOweMe > 0) {
        dashboard.peopleWhoOwe.push({
          personId: pId,
          name: personBalances[pId]?.name || 'Unknown',
          amount: pw.theyOweMe
        });
      } else if (pw && pw.iOweThem > 0) {
        dashboard.peopleIOwe.push({
          personId: pId,
          name: personBalances[pId]?.name || 'Unknown',
          amount: pw.iOweThem
        });
      }
    }
  }

  return {
    personBalances,
    dashboard
  };
}

// ----------------------------------------------------
// UNIT TESTS FOR ALL SPEC-REQUIRED SCENARIOS
// ----------------------------------------------------

test('TEST 1: Lebin pays RM120, John / Mary / Peter split equally', () => {
  const persons = [
    { id: 'lebin', name: 'Lebin' },
    { id: 'john', name: 'John' },
    { id: 'mary', name: 'Mary' },
    { id: 'peter', name: 'Peter' }
  ];

  const splits = calculateEqualSplit(12000, ['john', 'mary', 'peter']);
  assert.equal(splits.length, 3);
  assert.equal(splits[0].share_amount, 4000);
  assert.equal(splits[1].share_amount, 4000);
  assert.equal(splits[2].share_amount, 4000);

  const expenses = [
    {
      id: 'e1',
      payer_person_id: 'lebin',
      total_amount: 12000,
      status: 'unsettled',
      participants: splits
    }
  ];

  const { dashboard, personBalances } = calculateAdvanceBalances({
    persons,
    expenses,
    settlements: [],
    mePersonId: 'lebin'
  });

  assert.equal(dashboard.totalOutstanding, 12000); // 120.00
  assert.equal(personBalances.john.pairwise.lebin.iOweThem, 4000); // John owes Lebin 40
  assert.equal(personBalances.mary.pairwise.lebin.iOweThem, 4000); // Mary owes Lebin 40
  assert.equal(personBalances.peter.pairwise.lebin.iOweThem, 4000); // Peter owes Lebin 40
});

test('TEST 2: John pays RM100, Lebin / John / Mary split equally', () => {
  const persons = [
    { id: 'lebin', name: 'Lebin' },
    { id: 'john', name: 'John' },
    { id: 'mary', name: 'Mary' }
  ];

  const splits = calculateEqualSplit(10000, ['lebin', 'john', 'mary']);
  // 10000 / 3 = 3334, 3333, 3333 = 10000
  assert.equal(splits.reduce((sum, s) => sum + s.share_amount, 0), 10000);

  const expenses = [
    {
      id: 'e2',
      payer_person_id: 'john',
      total_amount: 10000,
      status: 'unsettled',
      participants: splits
    }
  ];

  const { dashboard, personBalances } = calculateAdvanceBalances({
    persons,
    expenses,
    settlements: [],
    mePersonId: 'lebin'
  });

  // Lebin owes John 3334 cents
  assert.equal(personBalances.lebin.pairwise.john.iOweThem, splits[0].share_amount);
  // Mary owes John 3333 cents
  assert.equal(personBalances.mary.pairwise.john.iOweThem, splits[2].share_amount);
  // John owes no one
  assert.equal(dashboard.totalOutstanding, 0);
  assert.equal(dashboard.iOweTotal, splits[0].share_amount);
});

test('TEST 3: Fixed split validation RM100 -> John 50, Mary 30, Peter 20', () => {
  const validParts = [
    { person_id: 'john', share_amount: 5000 },
    { person_id: 'mary', share_amount: 3000 },
    { person_id: 'peter', share_amount: 2000 }
  ];
  assert.equal(validateFixedSplit(10000, validParts).valid, true);

  const invalidParts = [
    { person_id: 'john', share_amount: 5000 },
    { person_id: 'mary', share_amount: 3000 },
    { person_id: 'peter', share_amount: 1000 }
  ];
  assert.equal(validateFixedSplit(10000, invalidParts).valid, false);
});

test('TEST 4 & 5: John owes RM100, Partial settlement RM30 (rem 70) and Full settlement RM100 (rem 0)', () => {
  const persons = [
    { id: 'lebin', name: 'Lebin' },
    { id: 'john', name: 'John' }
  ];
  const expenses = [
    {
      id: 'e3',
      payer_person_id: 'lebin',
      total_amount: 10000,
      status: 'unsettled',
      participants: [{ person_id: 'john', share_amount: 10000 }]
    }
  ];

  // Case 4: Partial 3000
  const set1 = [{ from_person_id: 'john', to_person_id: 'lebin', amount: 3000 }];
  const res1 = calculateAdvanceBalances({ persons, expenses, settlements: set1, mePersonId: 'lebin' });
  assert.equal(res1.dashboard.totalOutstanding, 7000);
  assert.equal(res1.personBalances.lebin.pairwise.john.theyOweMe, 7000);

  // Case 5: Full 10000
  const set2 = [{ from_person_id: 'john', to_person_id: 'lebin', amount: 10000 }];
  const res2 = calculateAdvanceBalances({ persons, expenses, settlements: set2, mePersonId: 'lebin' });
  assert.equal(res2.dashboard.totalOutstanding, 0);
  assert.equal(res2.personBalances.lebin.pairwise.john.theyOweMe, 0);
});

test('TEST 7: Net Balance Offset (You owe John RM50, John owes you RM80 -> Net: John owes you RM30)', () => {
  const persons = [
    { id: 'lebin', name: 'Lebin' },
    { id: 'john', name: 'John' }
  ];
  const expenses = [
    {
      id: 'e_lebin_paid',
      payer_person_id: 'lebin',
      total_amount: 8000,
      status: 'unsettled',
      participants: [{ person_id: 'john', share_amount: 8000 }]
    },
    {
      id: 'e_john_paid',
      payer_person_id: 'john',
      total_amount: 5000,
      status: 'unsettled',
      participants: [{ person_id: 'lebin', share_amount: 5000 }]
    }
  ];

  const { dashboard, personBalances } = calculateAdvanceBalances({
    persons,
    expenses,
    settlements: [],
    mePersonId: 'lebin'
  });

  assert.equal(personBalances.lebin.pairwise.john.theyOweMe, 3000); // 80 - 50 = 30
  assert.equal(personBalances.lebin.pairwise.john.iOweThem, 0);
  assert.equal(dashboard.totalOutstanding, 3000);
  assert.equal(dashboard.iOweTotal, 0);
});

test('TEST 9: Cancelled expense is excluded from balance', () => {
  const persons = [
    { id: 'lebin', name: 'Lebin' },
    { id: 'john', name: 'John' }
  ];
  const expenses = [
    {
      id: 'e_cancelled',
      payer_person_id: 'lebin',
      total_amount: 5000,
      status: 'cancelled',
      participants: [{ person_id: 'john', share_amount: 5000 }]
    }
  ];

  const { dashboard } = calculateAdvanceBalances({
    persons,
    expenses,
    settlements: [],
    mePersonId: 'lebin'
  });

  assert.equal(dashboard.totalOutstanding, 0);
});
