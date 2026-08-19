import test from 'node:test';
import assert from 'node:assert/strict';

// Pure calculation logic extracted for Node test runner
function calculateCourtFee(startHour, duration, rateMorning, rateEvening) {
  let totalFee = 0;
  let hasMorning = false;
  let hasEvening = false;

  for (let h = 0; h < duration; h++) {
    const hourOfDay = (startHour + h) % 24;
    if (hourOfDay >= 0 && hourOfDay < 18) {
      totalFee += rateMorning;
      hasMorning = true;
    } else {
      totalFee += rateEvening;
      hasEvening = true;
    }
  }

  return { fee: totalFee, hasMorning, hasEvening };
}

function calculateRequiredHostShuttles(courtFee, shuttlesUsed, shuttlePrice, totalPlayers, hostCount) {
  if (hostCount <= 0 || totalPlayers <= hostCount || shuttlePrice <= 0) {
    return 0;
  }
  const singleShuttlePrice = shuttlePrice / 12;
  const actualShuttleCost = shuttlesUsed * singleShuttlePrice;
  const actualTotalCost = courtFee + actualShuttleCost;
  const payingPlayers = totalPlayers - hostCount;

  let k = 0;
  while (k <= 100) {
    const billedShuttles = shuttlesUsed + k;
    const billedTotalCost = courtFee + (billedShuttles * singleShuttlePrice);
    const playerFee = billedTotalCost / totalPlayers;
    const totalRevenue = playerFee * payingPlayers;

    if (totalRevenue >= actualTotalCost - 0.0001) {
      return k;
    }
    k++;
  }
  return 0;
}

test('calculateCourtFee - morning rate only', () => {
  const res = calculateCourtFee(10, 2, 14.0, 28.0);
  assert.equal(res.fee, 28.0);
  assert.equal(res.hasMorning, true);
  assert.equal(res.hasEvening, false);
});

test('calculateCourtFee - evening rate only', () => {
  const res = calculateCourtFee(19, 2, 14.0, 28.0);
  assert.equal(res.fee, 56.0);
  assert.equal(res.hasMorning, false);
  assert.equal(res.hasEvening, true);
});

test('calculateCourtFee - cross morning and evening rate', () => {
  const res = calculateCourtFee(17, 2, 14.0, 28.0);
  assert.equal(res.fee, 42.0); // 14 (17:00-18:00) + 28 (18:00-19:00)
  assert.equal(res.hasMorning, true);
  assert.equal(res.hasEvening, true);
});

test('calculateRequiredHostShuttles - calculates correct host cover shuttles', () => {
  // Court fee 56, 4 shuttles used, tube price 84 (7/shuttle), 8 total players, 1 host
  const hostShuttles = calculateRequiredHostShuttles(56.0, 4, 84.0, 8, 1);
  assert.equal(hostShuttles > 0, true);
});
