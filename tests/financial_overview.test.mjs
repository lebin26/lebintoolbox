import test from 'node:test';
import assert from 'node:assert/strict';

// -------------------------------------------------------------
// 1. UNIT TESTS: Formatters & Calculations
// -------------------------------------------------------------

function formatCurrency(amount, currency = 'MYR') {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 'Not Reported';
  }
  const symbols = { MYR: 'RM', USD: '$', SGD: 'S$' };
  const sym = symbols[currency.toUpperCase()] || currency;
  const num = Number(amount);
  return `${sym} ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPct(pct) {
  if (pct === null || pct === undefined || isNaN(pct)) return '0.0%';
  return Number(pct).toFixed(1) + '%';
}

function formatMoM(diffAmount, pct, baseCurrency = 'MYR') {
  if (diffAmount === null || diffAmount === undefined) {
    return { text: '首月记录', className: 'tag-neutral', icon: '✨' };
  }
  const symbol = baseCurrency === 'MYR' ? 'RM' : baseCurrency;
  const num = Number(diffAmount);
  const absFormatted = Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pctStr = pct !== null && !isNaN(pct) ? ` (${pct > 0 ? '+' : ''}${Number(pct).toFixed(2)}%)` : '';

  if (num > 0) {
    return { text: `+${symbol} ${absFormatted}${pctStr}`, className: 'tag-bullish', icon: '↑' };
  } else if (num < 0) {
    return { text: `-${symbol} ${absFormatted}${pctStr}`, className: 'tag-bearish', icon: '↓' };
  }
  return { text: `${symbol} 0.00 (0.00%)`, className: 'tag-neutral', icon: '→' };
}

function formatDrift(actualPct, targetPct) {
  if (targetPct === null || targetPct === undefined || targetPct === 0) {
    return null;
  }
  const actual = Number(actualPct) || 0;
  const target = Number(targetPct) || 0;
  const drift = actual - target;
  const absDrift = Math.abs(drift).toFixed(1);

  if (drift >= 5.0) {
    return { text: `超配 +${absDrift}%`, className: 'fin-drift-over', drift };
  } else if (drift <= -5.0) {
    return { text: `低配 -${absDrift}%`, className: 'fin-drift-under', drift };
  }
  return { text: `均衡 (${drift >= 0 ? '+' : ''}${drift.toFixed(1)}%)`, className: 'fin-drift-balanced', drift };
}

test('FinancialFormatters - Currency formatting', () => {
  assert.equal(formatCurrency(1234.56, 'MYR'), 'RM 1,234.56');
  assert.equal(formatCurrency(500000, 'USD'), '$ 500,000.00');
  assert.equal(formatCurrency(null, 'MYR'), 'Not Reported');
  assert.equal(formatCurrency(undefined, 'MYR'), 'Not Reported');
  assert.equal(formatCurrency(0, 'MYR'), 'RM 0.00');
});

test('FinancialFormatters - Percentage formatting', () => {
  assert.equal(formatPct(15.234), '15.2%');
  assert.equal(formatPct(100), '100.0%');
  assert.equal(formatPct(null), '0.0%');
  assert.equal(formatPct(0), '0.0%');
});

test('FinancialFormatters - MoM Change calculation', () => {
  // First month
  const firstMonth = formatMoM(null, null);
  assert.equal(firstMonth.className, 'tag-neutral');
  assert.equal(firstMonth.text, '首月记录');

  // Bullish increase
  const bullish = formatMoM(1500.5, 5.25);
  assert.equal(bullish.className, 'tag-bullish');
  assert.ok(bullish.text.includes('+RM 1,500.50 (+5.25%)'));

  // Bearish decrease
  const bearish = formatMoM(-320.0, -1.15);
  assert.equal(bearish.className, 'tag-bearish');
  assert.ok(bearish.text.includes('-RM 320.00 (-1.15%)'));

  // Zero change
  const flat = formatMoM(0, 0);
  assert.equal(flat.className, 'tag-neutral');
  assert.ok(flat.text.includes('RM 0.00 (0.00%)'));
});

test('FinancialFormatters - Asset Allocation Drift calculation', () => {
  // Target not set
  assert.equal(formatDrift(20, null), null);
  assert.equal(formatDrift(20, 0), null);

  // Overweight by >= 5%
  const over = formatDrift(32.5, 25.0);
  assert.equal(over.className, 'fin-drift-over');
  assert.equal(over.text, '超配 +7.5%');

  // Underweight by <= -5%
  const under = formatDrift(14.0, 20.0);
  assert.equal(under.className, 'fin-drift-under');
  assert.equal(under.text, '低配 -6.0%');

  // Balanced
  const balanced = formatDrift(21.2, 20.0);
  assert.equal(balanced.className, 'fin-drift-balanced');
  assert.equal(balanced.text, '均衡 (+1.2%)');
});

// -------------------------------------------------------------
// 2. INTEGRATION TESTS: Live Worker API Endpoints (If online)
// -------------------------------------------------------------

const WORKER_URL = 'http://127.0.0.1:8787';

let workerAvailable = false;
try {
  const check = await fetch(`${WORKER_URL}/health`, { signal: AbortSignal.timeout(500) });
  if (check.ok) workerAvailable = true;
} catch {
  workerAvailable = false;
}

const skipReason = workerAvailable ? false : 'Local Cloudflare Worker is offline (start via "npm run dev:worker" to test live API)';

test('Financial API - Platforms and Products CRUD', { skip: skipReason }, async () => {
  const testPlatName = `Test Bank ${Date.now()}`;

  // 1. Create Platform
  const platRes = await fetch(`${WORKER_URL}/api/financial/platforms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: testPlatName,
      logoUrl: 'https://example.com/logo.png',
      description: 'Automated test platform',
      sortOrder: 1
    })
  });
  assert.equal(platRes.status, 201);
  const platData = await platRes.json();
  assert.equal(platData.platform.name, testPlatName);
  const platformId = platData.platform.id;

  // 2. Create Product under Platform
  const prodRes = await fetch(`${WORKER_URL}/api/financial/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      platformId,
      name: 'High Yield Savings',
      productType: 'Savings',
      currency: 'MYR',
      targetAllocationPct: 25.0,
      sortOrder: 1
    })
  });
  assert.equal(prodRes.status, 201);
  const prodData = await prodRes.json();
  assert.equal(prodData.product.name, 'High Yield Savings');
  const productId = prodData.product.id;

  // 3. Save Month Snapshot
  const snapRes = await fetch(`${WORKER_URL}/api/financial/snapshots/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      monthKey: '2026-08',
      items: [
        {
          productId,
          currency: 'MYR',
          nativeAmount: 25000.0,
          fxRateToBase: 1.0,
          baseAmount: 25000.0
        }
      ]
    })
  });
  assert.equal(snapRes.status, 200);

  // 4. Fetch Dashboard
  const dashRes = await fetch(`${WORKER_URL}/api/financial/dashboard?month=2026-08`);
  assert.equal(dashRes.status, 200);
  const dashData = await dashRes.json();
  assert.ok(dashData.totalAssets >= 25000.0);
  assert.ok(Array.isArray(dashData.currencyExposure));

  // 5. Cleanup
  await fetch(`${WORKER_URL}/api/financial/products/${productId}`, { method: 'DELETE' });
  await fetch(`${WORKER_URL}/api/financial/platforms/${platformId}`, { method: 'DELETE' });
});
