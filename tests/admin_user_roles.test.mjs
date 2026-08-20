import test from 'node:test';
import assert from 'node:assert/strict';

test('RBAC Hierarchy: Role rankings & permission enforcement rules', () => {
  const roleRanks = { admin: 100, manager: 50, user: 10 };

  // 1. Admin rank exceeds Manager rank
  assert.strictEqual(roleRanks['admin'] > roleRanks['manager'], true);
  assert.strictEqual(roleRanks['manager'] > roleRanks['user'], true);

  // 2. Manager cannot manage Admin
  function canManage(actorRole, targetRole) {
    if (actorRole === 'admin') return true;
    if (actorRole === 'manager') {
      return targetRole === 'user'; // Manager can ONLY manage normal users
    }
    return false;
  }

  assert.strictEqual(canManage('admin', 'admin'), true);
  assert.strictEqual(canManage('admin', 'manager'), true);
  assert.strictEqual(canManage('admin', 'user'), true);

  assert.strictEqual(canManage('manager', 'admin'), false); // Manager CANNOT manage Admin
  assert.strictEqual(canManage('manager', 'manager'), false); // Manager CANNOT manage another Manager
  assert.strictEqual(canManage('manager', 'user'), true); // Manager CAN manage normal users

  assert.strictEqual(canManage('user', 'user'), false);
});

test('RBAC Sub-App Access: Granular access control & defaults', () => {
  function parseAllowedApps(allowedAppsRaw, role) {
    let apps = [];
    try {
      if (typeof allowedAppsRaw === 'string') {
        apps = JSON.parse(allowedAppsRaw);
      } else if (Array.isArray(allowedAppsRaw)) {
        apps = allowedAppsRaw;
      }
    } catch (e) {
      apps = [];
    }
    if (!Array.isArray(apps) || apps.length === 0) {
      apps = ['courtledger', 'advancemanager'];
    }
    if (role === 'admin' || role === 'manager') {
      if (!apps.includes('admin')) apps.push('admin');
    }
    return apps;
  }

  // 1. User defaults to standard apps without admin
  const userApps = parseAllowedApps(null, 'user');
  assert.deepStrictEqual(userApps, ['courtledger', 'advancemanager']);
  assert.strictEqual(userApps.includes('admin'), false);

  // 2. Admin & Manager always have admin access
  const adminApps = parseAllowedApps('["courtledger"]', 'admin');
  assert.strictEqual(adminApps.includes('admin'), true);
  assert.strictEqual(adminApps.includes('courtledger'), true);

  // 3. User can be restricted to only Court Ledger
  const restrictedUserApps = parseAllowedApps('["courtledger"]', 'user');
  assert.deepStrictEqual(restrictedUserApps, ['courtledger']);
  assert.strictEqual(restrictedUserApps.includes('advancemanager'), false);

  // 4. User can be restricted to only Advance Manager
  const amOnlyApps = parseAllowedApps('["advancemanager"]', 'user');
  assert.deepStrictEqual(amOnlyApps, ['advancemanager']);
  assert.strictEqual(amOnlyApps.includes('courtledger'), false);
});

test('RBAC Action Permissions: Granular in-app feature permissions and hierarchy', () => {
  const ALL_ACTION_PERMISSIONS = [
    'admin:create_user',
    'admin:delete_user',
    'admin:edit_user',
    'admin:manage_venues',
    'courtledger:create_bill',
    'courtledger:delete_bill',
    'advancemanager:create_expense',
    'advancemanager:delete_expense',
    'advancemanager:settle',
    'advancemanager:manage_people'
  ];

  const DEFAULT_USER_PERMISSIONS = [
    'courtledger:create_bill',
    'courtledger:delete_bill',
    'advancemanager:create_expense',
    'advancemanager:delete_expense',
    'advancemanager:settle',
    'advancemanager:manage_people'
  ];

  function parseAppPermissions(raw, role) {
    if (role === 'admin') return [...ALL_ACTION_PERMISSIONS];
    let perms = [];
    try {
      if (typeof raw === 'string') {
        perms = JSON.parse(raw);
      } else if (Array.isArray(raw)) {
        perms = raw;
      }
    } catch (e) {
      perms = [];
    }
    if (!Array.isArray(perms) || perms.length === 0) {
      perms = role === 'manager' 
        ? ['admin:create_user', 'admin:edit_user', 'admin:manage_venues', ...DEFAULT_USER_PERMISSIONS]
        : [...DEFAULT_USER_PERMISSIONS];
    }
    return perms;
  }

  // 1. Admin gets all action permissions
  const adminPerms = parseAppPermissions('["courtledger:create_bill"]', 'admin');
  assert.strictEqual(adminPerms.length, ALL_ACTION_PERMISSIONS.length);
  assert.strictEqual(adminPerms.includes('admin:delete_user'), true);

  // 2. Standard user defaults
  const userPerms = parseAppPermissions(null, 'user');
  assert.strictEqual(userPerms.includes('admin:create_user'), false);
  assert.strictEqual(userPerms.includes('courtledger:create_bill'), true);
  assert.strictEqual(userPerms.includes('advancemanager:settle'), true);

  // 3. User with custom restricted permissions
  const readOnlyUserPerms = parseAppPermissions('["courtledger:create_bill"]', 'user');
  assert.deepStrictEqual(readOnlyUserPerms, ['courtledger:create_bill']);
  assert.strictEqual(readOnlyUserPerms.includes('courtledger:delete_bill'), false);
  assert.strictEqual(readOnlyUserPerms.includes('advancemanager:create_expense'), false);
});

