import test from 'node:test';
import assert from 'node:assert/strict';

// Pure calculation logic extracted for Node test runner
function calculateCourtFee(startHour, duration, rateMorning, rateEvening, courtCount = 1) {
  let totalFee = 0;
  let morningHours = 0;
  let eveningHours = 0;

  for (let h = 0; h < duration; h++) {
    const hourOfDay = (startHour + h) % 24;
    if (hourOfDay >= 0 && hourOfDay < 18) {
      totalFee += rateMorning;
      morningHours++;
    } else {
      totalFee += rateEvening;
      eveningHours++;
    }
  }

  const courts = Math.max(1, parseInt(courtCount) || 1);
  const totalFeeAllCourts = totalFee * courts;

  return {
    fee: totalFeeAllCourts,
    singleCourtFee: totalFee,
    morningHours,
    eveningHours,
    hasMorning: morningHours > 0,
    hasEvening: eveningHours > 0
  };
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

test('calculateCourtFee - cross morning and evening rate with 2 courts', () => {
  const res = calculateCourtFee(17, 2, 14.0, 28.0, 2);
  assert.equal(res.singleCourtFee, 42.0);
  assert.equal(res.fee, 84.0);
  assert.equal(res.morningHours, 1);
  assert.equal(res.eveningHours, 1);
  assert.equal(res.hasMorning, true);
  assert.equal(res.hasEvening, true);
});

test('calculateRequiredHostShuttles - calculates correct host cover shuttles', () => {
  // Court fee 56, 4 shuttles used, tube price 84 (7/shuttle), 8 total players, 1 host
  const hostShuttles = calculateRequiredHostShuttles(56.0, 4, 84.0, 8, 1);
  assert.equal(hostShuttles > 0, true);
});
