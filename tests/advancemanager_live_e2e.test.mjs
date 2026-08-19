import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = 'http://127.0.0.1:8787';

async function req(endpoint, options = {}, token = null) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

test('Live E2E: Full Lifecycle Test for Advance Manager', async () => {
  // Check if live server is up
  const health = await fetch(`${BASE_URL}/health`).catch(() => null);
  if (!health || !health.ok) {
    console.log('Skipping live test: worker not running');
    return;
  }

  // 1. Register a test user
  const uniqueSuffix = Date.now() % 100000;
  const username = `test_am_${uniqueSuffix}`;
  const email = `am_${uniqueSuffix}@example.com`;
  const password = 'Password123!';

  const regRes = await req('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name: username })
  });
  assert.ok(regRes.status === 200 || regRes.status === 201, `Register failed: ${JSON.stringify(regRes.data)}`);
  const token = regRes.data.token;
  assert.ok(token, 'Should receive auth token');

  // 2. Initial Dashboard Check
  const dash1 = await req('/api/advancemanager/dashboard', { method: 'GET' }, token);
  assert.equal(dash1.status, 200, `Dashboard failed: ${JSON.stringify(dash1.data)}`);
  assert.equal(dash1.data.success, true);
  assert.equal(dash1.data.data.totalOutstanding, 0);
  assert.equal(dash1.data.data.iOweTotal, 0);
  assert.equal(dash1.data.data.netBalance, 0);
  const mePersonId = dash1.data.data.mePersonId;
  assert.ok(mePersonId, 'Self person avatar must be auto-created');

  // 3. Add Person "John" & "Mary"
  const p1Res = await req('/api/advancemanager/persons', {
    method: 'POST',
    body: JSON.stringify({ name: 'John Doe', nickname: 'John', phone: '012-3456789' })
  }, token);
  assert.equal(p1Res.status, 200);
  const johnId = p1Res.data.data.id;

  const p2Res = await req('/api/advancemanager/persons', {
    method: 'POST',
    body: JSON.stringify({ name: 'Mary Smith', nickname: 'Mary' })
  }, token);
  assert.equal(p2Res.status, 200);
  const maryId = p2Res.data.data.id;

  // Verify Persons List
  const personsList = await req('/api/advancemanager/persons', { method: 'GET' }, token);
  assert.equal(personsList.status, 200);
  assert.equal(personsList.data.data.length, 3); // Me + John + Mary

  // 4. Create Advance: Lebin pays RM120 for Me, John, Mary (Equal split: 40 each)
  const exp1Res = await req('/api/advancemanager/expenses', {
    method: 'POST',
    body: JSON.stringify({
      description: '周末聚餐 (Dinner)',
      total_amount: 12000,
      payer_person_id: mePersonId,
      participants: [
        { person_id: mePersonId, split_type: 'equal', share_amount: 4000 },
        { person_id: johnId, split_type: 'equal', share_amount: 4000 },
        { person_id: maryId, split_type: 'equal', share_amount: 4000 }
      ]
    })
  }, token);
  assert.equal(exp1Res.status, 200);
  const exp1Id = exp1Res.data.data.id;
  assert.ok(exp1Id, 'Should return created expense id');

  // 5. Dashboard after Expense 1
  const dash2 = await req('/api/advancemanager/dashboard', { method: 'GET' }, token);
  assert.equal(dash2.status, 200);
  assert.equal(dash2.data.data.totalOutstanding, 8000, 'Total outstanding should be RM 80.00 (John 40 + Mary 40)');
  assert.equal(dash2.data.data.iOweTotal, 0);
  assert.equal(dash2.data.data.netBalance, 8000);
  assert.equal(dash2.data.data.peopleWhoOwe.length, 2);

  // 6. Settle John's debt of RM40.00
  const set1Res = await req('/api/advancemanager/settlements', {
    method: 'POST',
    body: JSON.stringify({
      from_person_id: johnId,
      to_person_id: mePersonId,
      amount: 4000,
      payment_method: 'DuitNow',
      note: 'Dinner transfer'
    })
  }, token);
  assert.equal(set1Res.status, 200);

  // 7. Dashboard after John Settle
  const dash3 = await req('/api/advancemanager/dashboard', { method: 'GET' }, token);
  assert.equal(dash3.status, 200);
  assert.equal(dash3.data.data.totalOutstanding, 4000, 'Total outstanding should now be RM 40.00 (Only Mary)');
  assert.equal(dash3.data.data.peopleWhoOwe.length, 1);
  assert.equal(dash3.data.data.peopleWhoOwe[0].personId, maryId);

  // 8. Reverse Advance: Mary pays RM100 for Mary & Me (50 each)
  const exp2Res = await req('/api/advancemanager/expenses', {
    method: 'POST',
    body: JSON.stringify({
      description: '下午茶 (Hi-Tea)',
      total_amount: 10000,
      payer_person_id: maryId,
      participants: [
        { person_id: maryId, split_type: 'equal', share_amount: 5000 },
        { person_id: mePersonId, split_type: 'equal', share_amount: 5000 }
      ]
    })
  }, token);
  assert.equal(exp2Res.status, 200);

  // 9. Dashboard after Reverse Advance:
  // Mary owed me 40, I now owe Mary 50 -> Net: I owe Mary 10 (Net Balance = -1000)
  const dash4 = await req('/api/advancemanager/dashboard', { method: 'GET' }, token);
  assert.equal(dash4.status, 200);
  assert.equal(dash4.data.data.totalOutstanding, 0); // No one net owes me
  assert.equal(dash4.data.data.iOweTotal, 1000, 'I net owe Mary RM 10.00');
  assert.equal(dash4.data.data.netBalance, -1000);
  assert.equal(dash4.data.data.peopleIOwe.length, 1);
  assert.equal(dash4.data.data.peopleIOwe[0].personId, maryId);
  assert.equal(dash4.data.data.peopleIOwe[0].amount, 1000);

  // 10. Test Cancel Expense (Soft Delete)
  const cancelRes = await req(`/api/advancemanager/expenses/${exp1Id}`, { method: 'DELETE' }, token);
  assert.equal(cancelRes.status, 200);

  // 11. Multi-Tenant Isolation Check: Register User B and verify empty
  const userBName = `user_b_${uniqueSuffix}`;
  const userBEmail = `user_b_${uniqueSuffix}@example.com`;
  const regB = await req('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: userBEmail, password, name: userBName })
  });
  const tokenB = regB.data.token;

  const dashB = await req('/api/advancemanager/dashboard', { method: 'GET' }, tokenB);
  assert.equal(dashB.status, 200);
  assert.equal(dashB.data.data.totalOutstanding, 0);
  assert.equal(dashB.data.data.peopleWhoOwe.length, 0);

  const expB = await req('/api/advancemanager/expenses', { method: 'GET' }, tokenB);
  assert.equal(expB.status, 200);
  assert.equal(expB.data.data.expenses.length, 0, 'User B must not see User A expenses');
});
