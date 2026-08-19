/**
 * Advance Manager - Balance & Split Calculator
 */

window.AMBalance = (function () {
  function calculateEqualSplit(totalAmountCents, participantIds) {
    if (!participantIds || participantIds.length === 0) return [];
    const count = participantIds.length;
    const baseShare = Math.floor(totalAmountCents / count);
    const remainder = totalAmountCents % count;

    return participantIds.map((pid, idx) => {
      const share = baseShare + (idx < remainder ? 1 : 0);
      return {
        person_id: pid,
        split_type: 'equal',
        share_amount: share,
        percentage: totalAmountCents > 0 ? Number(((share / totalAmountCents) * 100).toFixed(2)) : 0
      };
    });
  }

  function validateFixedSplit(totalAmountCents, participants) {
    const sum = (participants || []).reduce((acc, p) => acc + (parseInt(p.share_amount, 10) || 0), 0);
    const diff = totalAmountCents - sum;
    return {
      valid: diff === 0,
      diff,
      sum
    };
  }

  function validatePercentageSplit(participants) {
    const sum = (participants || []).reduce((acc, p) => acc + (parseFloat(p.percentage) || 0), 0);
    return {
      valid: Math.abs(sum - 100) < 0.01,
      sum
    };
  }

  function simplifyDebts(personBalances) {
    const debtors = [];
    const creditors = [];

    const pList = Array.isArray(personBalances) ? personBalances : Object.values(personBalances || {});
    for (const p of pList) {
      const net = p.netBalance || 0;
      if (net < 0) {
        debtors.push({ id: p.id, name: p.name, balance: -net });
      } else if (net > 0) {
        creditors.push({ id: p.id, name: p.name, balance: net });
      }
    }

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

  return {
    calculateEqualSplit,
    validateFixedSplit,
    validatePercentageSplit,
    simplifyDebts
  };
})();
