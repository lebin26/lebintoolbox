import test from 'node:test';
import assert from 'node:assert/strict';

// Helper validator for API responses
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

// Username Validation Function under test
function validateUsername(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: '用户名不能为空' };
  }
  const raw = name.trim();

  // 1. Strictly forbid spaces anywhere
  if (/\s/.test(name)) {
    return { valid: false, error: '用户名不能包含空格，请使用字母、数字、下划线(_)或中划线(-)' };
  }

  // 2. Length constraint: 3 to 20 characters
  if (raw.length < 3 || raw.length > 20) {
    return { valid: false, error: '用户名长度需在 3 到 20 个字符之间' };
  }

  // 3. Cannot start or end with a separator (_ or - or .)
  if (/^[_\-.]|[_\-.]$/.test(raw)) {
    return { valid: false, error: '用户名不能以下划线、中划线或点号开头或结尾' };
  }

  // 4. Cannot contain consecutive separators (__ or -- or ..)
  if (/[_\-.]{2,}/.test(raw)) {
    return { valid: false, error: '用户名不能包含连续的符号 (例如 __ 或 --)' };
  }

  // 5. Allowed characters: Chinese characters, English letters, digits, underscore, hyphen
  const validRegex = /^[\u4e00-\u9fa5a-zA-Z0-9_-]+$/;
  if (!validRegex.test(raw)) {
    return { valid: false, error: '用户名仅支持字母、数字、下划线(_)、连字符(-)及中文字符' };
  }

  // 6. Blacklisted / Reserved System Words
  const reservedWords = ['root', 'system', 'support', 'null', 'undefined', 'anonymous', 'hostcalculator', 'official'];
  if (reservedWords.includes(raw.toLowerCase())) {
    return { valid: false, error: '该用户名为系统保留名称，请换一个用户名' };
  }

  return { valid: true, name: raw };
}

test('validateUsername - accepts valid usernames without spaces', () => {
  assert.equal(validateUsername('admin_lebin').valid, true);
  assert.equal(validateUsername('test_user').valid, true);
  assert.equal(validateUsername('lebin26').valid, true);
  assert.equal(validateUsername('球场小王子_01').valid, true);
});

test('validateUsername - rejects usernames with spaces', () => {
  const res = validateUsername('Admin Lebin');
  assert.equal(res.valid, false);
  assert.equal(res.error.includes('不能包含空格'), true);
});

test('validateUsername - rejects too short or too long', () => {
  assert.equal(validateUsername('ab').valid, false);
  assert.equal(validateUsername('a'.repeat(25)).valid, false);
});

test('validateUsername - rejects starting or ending with separators', () => {
  assert.equal(validateUsername('_admin').valid, false);
  assert.equal(validateUsername('admin_').valid, false);
  assert.equal(validateUsername('-user-').valid, false);
});

test('validateUsername - rejects consecutive separators', () => {
  assert.equal(validateUsername('admin__lebin').valid, false);
});

test('validateUsername - rejects reserved words', () => {
  assert.equal(validateUsername('root').valid, false);
  assert.equal(validateUsername('system').valid, false);
});
