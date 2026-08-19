import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Currency & Input Validation Helpers under test
 */

export function formatMYR(cents) {
  if (cents === null || cents === undefined || isNaN(cents)) return 'RM 0.00';
  const val = Number(cents) / 100;
  return 'RM ' + val.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function parseCents(amountStr) {
  if (typeof amountStr === 'number') return Math.round(amountStr * 100);
  if (!amountStr || typeof amountStr !== 'string') return 0;
  const clean = amountStr.replace(/[^0-9.-]/g, '');
  const val = parseFloat(clean);
  if (isNaN(val) || val <= 0) return 0;
  return Math.round(val * 100);
}

export function validateExpensePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, code: 'VALIDATION_ERROR', message: '无效请求体' };
  }
  const amountCents = parseInt(payload.total_amount, 10);
  if (isNaN(amountCents) || amountCents <= 0) {
    return { valid: false, code: 'INVALID_AMOUNT', message: '垫付金额必须大于 0' };
  }
  if (!payload.description || typeof payload.description !== 'string' || !payload.description.trim()) {
    return { valid: false, code: 'VALIDATION_ERROR', message: '垫付事由不能为空' };
  }
  if (!payload.payer_person_id) {
    return { valid: false, code: 'VALIDATION_ERROR', message: '请选择付款人' };
  }
  if (!Array.isArray(payload.participants) || payload.participants.length === 0) {
    return { valid: false, code: 'INVALID_SPLIT', message: '至少需要指定 1 名分摊参与人' };
  }
  const totalShare = payload.participants.reduce((sum, p) => sum + (parseInt(p.share_amount, 10) || 0), 0);
  if (totalShare !== amountCents) {
    return {
      valid: false,
      code: 'INVALID_SPLIT',
      message: `分摊总额 (${formatMYR(totalShare)}) 必须等于垫付总金额 (${formatMYR(amountCents)})`
    };
  }
  return { valid: true, amountCents };
}

export function validateSettlementPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, code: 'VALIDATION_ERROR', message: '无效请求体' };
  }
  const amountCents = parseInt(payload.amount, 10);
  if (isNaN(amountCents) || amountCents <= 0) {
    return { valid: false, code: 'INVALID_AMOUNT', message: '结算金额必须大于 0' };
  }
  if (!payload.from_person_id || !payload.to_person_id) {
    return { valid: false, code: 'VALIDATION_ERROR', message: '必须指定还款人和收款人' };
  }
  if (payload.from_person_id === payload.to_person_id) {
    return { valid: false, code: 'VALIDATION_ERROR', message: '还款人与收款人不能相同' };
  }
  return { valid: true, amountCents };
}

// ----------------------------------------------------
// TESTS
// ----------------------------------------------------

test('formatMYR & parseCents format accuracy (no float drift)', () => {
  assert.equal(formatMYR(1250), 'RM 12.50');
  assert.equal(formatMYR(0), 'RM 0.00');
  assert.equal(formatMYR(100000), 'RM 1,000.00');

  assert.equal(parseCents('12.50'), 1250);
  assert.equal(parseCents('RM 12.50'), 1250);
  assert.equal(parseCents('0.33'), 33);
  assert.equal(parseCents('100'), 10000);
});

test('validateExpensePayload - valid payload', () => {
  const payload = {
    description: 'Badminton Court Booking',
    total_amount: 6000,
    payer_person_id: 'p_me',
    participants: [
      { person_id: 'p_john', share_amount: 3000 },
      { person_id: 'p_mary', share_amount: 3000 }
    ]
  };
  const res = validateExpensePayload(payload);
  assert.equal(res.valid, true);
  assert.equal(res.amountCents, 6000);
});

test('validateExpensePayload - rejects mismatch split total', () => {
  const payload = {
    description: 'Dinner',
    total_amount: 6000,
    payer_person_id: 'p_me',
    participants: [
      { person_id: 'p_john', share_amount: 3000 },
      { person_id: 'p_mary', share_amount: 2000 } // Total 5000 != 6000
    ]
  };
  const res = validateExpensePayload(payload);
  assert.equal(res.valid, false);
  assert.equal(res.code, 'INVALID_SPLIT');
});

test('validateExpensePayload - rejects empty description or invalid amount', () => {
  assert.equal(validateExpensePayload({ total_amount: -100 }).valid, false);
  assert.equal(validateExpensePayload({ total_amount: 1000, description: '   ' }).valid, false);
});

test('validateSettlementPayload - rejects self-settlement or 0 amount', () => {
  assert.equal(validateSettlementPayload({ from_person_id: 'p1', to_person_id: 'p1', amount: 500 }).valid, false);
  assert.equal(validateSettlementPayload({ from_person_id: 'p1', to_person_id: 'p2', amount: 0 }).valid, false);
  assert.equal(validateSettlementPayload({ from_person_id: 'p1', to_person_id: 'p2', amount: 5000 }).valid, true);
});
