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

test('Worker API - Bills CRUD', { skip: skipReason }, async () => {
  const testTitle = `Test Bill ${Date.now()}`;

  // 1. Create Bill
  const postRes = await fetch(`${WORKER_URL}/api/bills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: testTitle,
      venueName: 'Lavana Setapak',
      startTime: 16,
      duration: 2,
      courtCount: 2,
      courtFee: 118.72,
      totalPlayers: 8,
      hostCount: 1,
      shuttlesUsed: 4,
      shuttlePrice: 120.0,
      additionalShuttles: 1,
      playerFee: 24.1,
      totalCost: 158.72,
      totalRevenue: 168.7,
      netProfit: 9.98
    })
  });
  assert.equal(postRes.status, 201);
  const postData = await postRes.json();
  assert.equal(postData.bill.title, testTitle);
  const billId = postData.bill.id;

  // 2. Fetch Bills
  const getRes = await fetch(`${WORKER_URL}/api/bills`);
  assert.equal(getRes.status, 200);
  const getData = await getRes.json();
  assert.equal(Array.isArray(getData.bills), true);
  const found = getData.bills.find(b => b.id === billId);
  assert.ok(found);

  // 3. Update Bill
  const putRes = await fetch(`${WORKER_URL}/api/bills/${billId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `${testTitle} Updated`,
      venueName: 'Lavana Setapak',
      startTime: 16,
      duration: 2,
      courtCount: 2,
      courtFee: 118.72,
      totalPlayers: 8,
      hostCount: 1,
      shuttlesUsed: 4,
      shuttlePrice: 120.0,
      additionalShuttles: 1,
      playerFee: 25.0,
      totalCost: 158.72,
      totalRevenue: 175.0,
      netProfit: 16.28
    })
  });
  assert.equal(putRes.status, 200);

  // 4. Delete Bill
  const delRes = await fetch(`${WORKER_URL}/api/bills/${billId}`, {
    method: 'DELETE'
  });
  assert.equal(delRes.status, 200);
});
