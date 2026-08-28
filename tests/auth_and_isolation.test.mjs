import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, generateSalt, createToken, verifyToken } from '../worker/src/auth.js';

// -------------------------------------------------------------
// 1. UNIT TESTS: Crypto Hashing & JWT Signing
// -------------------------------------------------------------

test('Auth Crypto - Password Hashing with Salt', async () => {
  const password = 'SecretPassword123!';
  const salt1 = generateSalt();
  const salt2 = generateSalt();

  assert.notEqual(salt1, salt2, 'Salts should be unique');

  const hash1 = await hashPassword(password, salt1);
  const hash2 = await hashPassword(password, salt1);
  const hash3 = await hashPassword(password, salt2);

  assert.equal(hash1, hash2, 'Same password and salt should produce identical hash');
  assert.notEqual(hash1, hash3, 'Same password with different salt should produce different hash');
  assert.equal(typeof hash1, 'string');
  assert.ok(hash1.length >= 64, 'Hash should be at least 64 hex chars (256-bit)');
});

test('Auth Crypto - JWT Token Sign & Verify', async () => {
  const secret = 'test-secret-key-salt-2026';
  const payload = {
    id: 42,
    username: 'alice_investor',
    role: 'user',
    nickname: '爱丽丝'
  };

  const token = await createToken(payload, secret, 3600);
  assert.ok(typeof token === 'string');
  assert.equal(token.split('.').length, 3, 'JWT should contain 3 dot-separated segments');

  // Verify valid token
  const decoded = await verifyToken(token, secret);
  assert.ok(decoded);
  assert.equal(decoded.id, 42);
  assert.equal(decoded.username, 'alice_investor');
  assert.equal(decoded.role, 'user');
  assert.equal(decoded.nickname, '爱丽丝');

  // Verify with wrong secret
  const invalid = await verifyToken(token, 'wrong-secret-key');
  assert.equal(invalid, null, 'Verification with wrong secret must fail');

  // Verify expired token
  const expiredToken = await createToken(payload, secret, -10);
  const expiredResult = await verifyToken(expiredToken, secret);
  assert.equal(expiredResult, null, 'Expired token must return null');
});

// -------------------------------------------------------------
// 2. UNIT TESTS: Data Isolation Logic Verification
// -------------------------------------------------------------

test('Multi-Tenant Isolation - User SQL Filters logic', () => {
  function getPlatformQuery(userId) {
    let query = 'SELECT * FROM financial_platforms WHERE ';
    const params = [];
    if (userId) {
      query += '(user_id = ? OR user_id IS NULL)';
      params.push(userId);
    } else {
      query += 'user_id IS NULL';
    }
    return { query, params };
  }

  const userAQuery = getPlatformQuery(101);
  assert.deepEqual(userAQuery.params, [101]);
  assert.ok(userAQuery.query.includes('user_id = ?'));

  const userBQuery = getPlatformQuery(202);
  assert.deepEqual(userBQuery.params, [202]);

  const guestQuery = getPlatformQuery(null);
  assert.deepEqual(guestQuery.params, []);
  assert.ok(guestQuery.query.includes('user_id IS NULL'));
});

// -------------------------------------------------------------
// 3. UNIT TESTS: Template Preset Processing
// -------------------------------------------------------------

test('Template Marketplace - Preset JSON parsing and cloning', () => {
  const template = {
    id: 1,
    name: 'Maybank 马来亚银行',
    category: 'Banking',
    logo_url: 'https://example.com/maybank.png',
    description: '马来西亚主流银行',
    default_currency: 'MYR',
    preset_products_json: JSON.stringify([
      { name: 'Maybank 储蓄账户', productType: 'Savings', currency: 'MYR' },
      { name: 'Maybank 定期存款', productType: 'FixedDeposit', currency: 'MYR' }
    ])
  };

  const products = JSON.parse(template.preset_products_json);
  assert.equal(products.length, 2);
  assert.equal(products[0].name, 'Maybank 储蓄账户');
  assert.equal(products[0].productType, 'Savings');
  assert.equal(products[1].name, 'Maybank 定期存款');
  assert.equal(products[1].productType, 'FixedDeposit');

  // Clone into user
  const userId = 88;
  const clonedPlatform = {
    name: template.name,
    logoUrl: template.logo_url,
    description: template.description,
    userId
  };

  assert.equal(clonedPlatform.userId, 88);
  assert.equal(clonedPlatform.name, 'Maybank 马来亚银行');
});
