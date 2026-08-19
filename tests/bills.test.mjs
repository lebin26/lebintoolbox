import test from 'node:test';
import assert from 'node:assert/strict';

function validateBillPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, message: 'Payload must be an object' };
  }
  if (!payload.venueName || typeof payload.venueName !== 'string') {
    return { valid: false, message: 'Venue name is required' };
  }
  const totalPlayers = parseInt(payload.totalPlayers);
  const hostCount = parseInt(payload.hostCount);
  if (isNaN(totalPlayers) || totalPlayers <= 0) {
    return { valid: false, message: 'Total players must be greater than 0' };
  }
  if (isNaN(hostCount) || hostCount < 0 || totalPlayers <= hostCount) {
    return { valid: false, message: 'Total players must be greater than host count' };
  }
  return { valid: true };
}

test('validateBillPayload - valid bill payload', () => {
  const result = validateBillPayload({
    title: '2026-08-19 AA Bill',
    venueName: 'Sentul Sports Arena',
    totalPlayers: 8,
    hostCount: 1,
    playerFee: 15.5
  });
  assert.equal(result.valid, true);
});

test('validateBillPayload - invalid total players vs host count', () => {
  const result = validateBillPayload({
    title: 'Invalid Bill',
    venueName: 'Sentul Sports Arena',
    totalPlayers: 1,
    hostCount: 1,
    playerFee: 20.0
  });
  assert.equal(result.valid, false);
  assert.equal(result.message, 'Total players must be greater than host count');
});
