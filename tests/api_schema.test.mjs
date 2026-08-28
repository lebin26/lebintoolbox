import test from 'node:test';
import assert from 'node:assert/strict';

// Helper validator for Venue payload
function validateVenuePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, message: 'Payload must be an object' };
  }
  if (!payload.name || typeof payload.name !== 'string' || !payload.name.trim()) {
    return { valid: false, message: '球场名称不能为空' };
  }
  const morning = parseFloat(payload.rateMorning);
  const evening = parseFloat(payload.rateEvening);
  if (isNaN(morning) || morning < 0 || isNaN(evening) || evening < 0) {
    return { valid: false, message: '请输入有效的早场和晚场价格' };
  }
  return { valid: true };
}

test('validateVenuePayload - valid payload', () => {
  const result = validateVenuePayload({
    name: 'Sentul Sports Arena',
    rateMorning: 14.0,
    rateEvening: 28.0
  });
  assert.equal(result.valid, true);
});

test('validateVenuePayload - rejects empty name', () => {
  const result = validateVenuePayload({
    name: '   ',
    rateMorning: 14.0,
    rateEvening: 28.0
  });
  assert.equal(result.valid, false);
  assert.equal(result.message, '球场名称不能为空');
});

test('validateVenuePayload - rejects negative rate', () => {
  const result = validateVenuePayload({
    name: 'Arena B',
    rateMorning: -5.0,
    rateEvening: 20.0
  });
  assert.equal(result.valid, false);
  assert.equal(result.message, '请输入有效的早场和晚场价格');
});
