import test from 'node:test';
import assert from 'node:assert/strict';

const WORKER_URL = 'http://127.0.0.1:8787';

let workerAvailable = false;
try {
  const check = await fetch(`${WORKER_URL}/health`, { signal: AbortSignal.timeout(500) });
  if (check.ok) workerAvailable = true;
} catch {
  workerAvailable = false;
}

const skipReason = workerAvailable ? false : 'Local Cloudflare Worker is offline (start via "npm run dev:worker" to test live API)';

test('Worker API - Health check', { skip: skipReason }, async () => {
  const res = await fetch(`${WORKER_URL}/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'ok');
});

test('Worker API - Venues CRUD', { skip: skipReason }, async () => {
  // 1. Get Venues
  const getRes = await fetch(`${WORKER_URL}/api/venues`);
  assert.equal(getRes.status, 200);
  const getData = await getRes.json();
  assert.equal(Array.isArray(getData.venues), true);

  // 2. Create Venue
  const testVenueName = `Test Venue ${Date.now()}`;
  const postRes = await fetch(`${WORKER_URL}/api/venues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: testVenueName,
      rateMorning: 15.5,
      rateEvening: 30.0
    })
  });
  assert.equal(postRes.status, 201);
  const postData = await postRes.json();
  assert.equal(postData.venue.name, testVenueName);
  const newVenueId = postData.venue.id;

  // 3. Update Venue
  const putRes = await fetch(`${WORKER_URL}/api/venues/${newVenueId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `${testVenueName} Updated`,
      rateMorning: 16.0,
      rateEvening: 32.0
    })
  });
  assert.equal(putRes.status, 200);
  const putData = await putRes.json();
  assert.equal(putData.venue.name, `${testVenueName} Updated`);

  // 4. Delete Venue
  const delRes = await fetch(`${WORKER_URL}/api/venues/${newVenueId}`, {
    method: 'DELETE'
  });
  assert.equal(delRes.status, 200);
});

test('Worker API - Multi-Tenant Account-Isolated Bills CRUD', { skip: skipReason }, async () => {
  const shortA = String(Date.now()).slice(-5) + 'a';
  const shortB = String(Date.now()).slice(-5) + 'b';

  // 1. Register User A
  const regARes = await fetch(`${WORKER_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `user_${shortA}@example.com`,
      password: 'Password123!',
      name: `user_${shortA}`
    })
  });
  assert.equal(regARes.status, 201);
  const userA = await regARes.json();
  const tokenA = userA.token;

  // 2. Register User B
  const regBRes = await fetch(`${WORKER_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `user_${shortB}@example.com`,
      password: 'Password123!',
      name: `user_${shortB}`
    })
  });
  assert.equal(regBRes.status, 201);
  const userB = await regBRes.json();
  const tokenB = userB.token;

  // 3. User A creates Bill A
  const billTitleA = `Bill User A ${shortA}`;
  const postARes = await fetch(`${WORKER_URL}/api/bills`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`
    },
    body: JSON.stringify({
      title: billTitleA,
      venueName: 'Arena A',
      startTime: 18,
      duration: 2,
      courtCount: 1,
      courtFee: 40.0,
      totalPlayers: 6,
      hostCount: 1,
      shuttlesUsed: 3,
      shuttlePrice: 100.0,
      additionalShuttles: 0,
      playerFee: 13.0,
      totalCost: 65.0,
      totalRevenue: 65.0,
      netProfit: 0.0
    })
  });
  assert.equal(postARes.status, 201);
  const billA = (await postARes.json()).bill;

  // 4. User B creates Bill B
  const billTitleB = `Bill User B ${shortB}`;
  const postBRes = await fetch(`${WORKER_URL}/api/bills`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenB}`
    },
    body: JSON.stringify({
      title: billTitleB,
      venueName: 'Arena B',
      startTime: 20,
      duration: 2,
      courtCount: 2,
      courtFee: 80.0,
      totalPlayers: 8,
      hostCount: 0,
      shuttlesUsed: 5,
      shuttlePrice: 120.0,
      additionalShuttles: 1,
      playerFee: 16.0,
      totalCost: 130.0,
      totalRevenue: 128.0,
      netProfit: -2.0
    })
  });
  assert.equal(postBRes.status, 201);
  const billB = (await postBRes.json()).bill;

  // 5. User A fetches bills -> must contain Bill A, but MUST NOT contain Bill B!
  const getARes = await fetch(`${WORKER_URL}/api/bills`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  assert.equal(getARes.status, 200);
  const billsA = (await getARes.json()).bills;
  assert.ok(billsA.some(b => b.id === billA.id));
  assert.ok(!billsA.some(b => b.id === billB.id));

  // 6. User B fetches bills -> must contain Bill B, but MUST NOT contain Bill A!
  const getBRes = await fetch(`${WORKER_URL}/api/bills`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  assert.equal(getBRes.status, 200);
  const billsB = (await getBRes.json()).bills;
  assert.ok(billsB.some(b => b.id === billB.id));
  assert.ok(!billsB.some(b => b.id === billA.id));

  // 7. User A attempts to delete User B's bill -> rejected 404
  const illegalDelRes = await fetch(`${WORKER_URL}/api/bills/${billB.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  assert.equal(illegalDelRes.status, 404);

  // 8. User A deletes User A's bill -> 200 OK
  const delARes = await fetch(`${WORKER_URL}/api/bills/${billA.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  assert.equal(delARes.status, 200);

  // 9. User B deletes User B's bill -> 200 OK
  const delBRes = await fetch(`${WORKER_URL}/api/bills/${billB.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  assert.equal(delBRes.status, 200);
});

test('Worker API - User Profile & Admin Edit User', { skip: skipReason }, async () => {
  const shortId = String(Date.now()).slice(-6);
  const testEmail = `user${shortId}@example.com`;
  const initialName = `user_${shortId}`;
  const initialPassword = 'Password123!';

  // 1. Register User
  const regRes = await fetch(`${WORKER_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: initialPassword,
      name: initialName
    })
  });
  assert.equal(regRes.status, 201);
  const regData = await regRes.json();
  assert.equal(regData.user.name, initialName);
  const userToken = regData.token;
  const userId = regData.user.id;

  // 2. User edits own profile (Name and Password)
  const updatedName = `edit_${shortId}`;
  const newPassword = 'NewSecretPassword456!';
  const patchProfileRes = await fetch(`${WORKER_URL}/api/auth/profile`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      name: updatedName,
      password: newPassword
    })
  });
  assert.equal(patchProfileRes.status, 200);
  const patchProfileData = await patchProfileRes.json();
  assert.equal(patchProfileData.user.name, updatedName);

  // 3. User logs in with new password
  const loginRes = await fetch(`${WORKER_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: newPassword
    })
  });
  assert.equal(loginRes.status, 200);
  const loginData = await loginRes.json();
  assert.equal(loginData.user.name, updatedName);

  // 4. Admin edits user (Email, Name, Role, Password)
  const adminToken = Buffer.from(JSON.stringify({ userId: 1, role: 'admin', ts: Date.now() })).toString('base64');

  const adminEditRes = await fetch(`${WORKER_URL}/api/admin/users/${userId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      name: `adm_${shortId}`,
      email: `adm_${shortId}@example.com`,
      role: 'user',
      status: 'active',
      password: 'AdminSetPassword789!'
    })
  });
  assert.equal(adminEditRes.status, 200);

  // 5. Admin views user's bills
  const adminViewBillsRes = await fetch(`${WORKER_URL}/api/admin/users/${userId}/bills`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.equal(adminViewBillsRes.status, 200);
  const adminViewBillsData = await adminViewBillsRes.json();
  assert.equal(Array.isArray(adminViewBillsData.bills), true);
  assert.equal(adminViewBillsData.user.id, userId);

  // 6. Admin deletes user
  const adminDeleteUserRes = await fetch(`${WORKER_URL}/api/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.equal(adminDeleteUserRes.status, 200);

  // Verify user is gone
  const getDeletedUserRes = await fetch(`${WORKER_URL}/api/admin/users/${userId}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.equal(getDeletedUserRes.status, 404);
});
