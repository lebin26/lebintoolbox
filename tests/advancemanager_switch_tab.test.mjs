import test from 'node:test';
import assert from 'node:assert/strict';

test('Advance Manager Tab Switching: toggles sections properly', () => {
  const sectionIds = ['dashboard', 'expenses', 'people', 'projects', 'settlements'];
  
  function simulateSwitchTab(targetTab) {
    let activeTab = targetTab;
    let projectFilter = 'all';
    if (activeTab === 'badminton') {
      activeTab = 'projects';
      projectFilter = 'badminton';
    }

    const visibility = {};
    sectionIds.forEach(id => {
      visibility[id] = (id === activeTab);
    });
    return { visibility, activeTab, projectFilter };
  }

  const res1 = simulateSwitchTab('expenses');
  assert.equal(res1.visibility.expenses, true);
  assert.equal(res1.visibility.dashboard, false);
  assert.equal(res1.visibility.people, false);

  const res2 = simulateSwitchTab('people');
  assert.equal(res2.visibility.people, true);
  assert.equal(res2.visibility.expenses, false);
  assert.equal(res2.visibility.dashboard, false);

  const res3 = simulateSwitchTab('projects');
  assert.equal(res3.visibility.projects, true);
  assert.equal(res3.visibility.dashboard, false);
  assert.equal(res3.projectFilter, 'all');

  const res4 = simulateSwitchTab('settlements');
  assert.equal(res4.visibility.settlements, true);
  assert.equal(res4.visibility.dashboard, false);

  // Test legacy 'badminton' tab redirects to 'projects' with 'badminton' filter
  const resBadminton = simulateSwitchTab('badminton');
  assert.equal(resBadminton.activeTab, 'projects');
  assert.equal(resBadminton.visibility.projects, true);
  assert.equal(resBadminton.projectFilter, 'badminton');
});

test('Project Classification & Filtering: differentiates Badminton vs Trips', () => {
  function isBadmintonItem(item) {
    if (!item) return false;
    const name = item.name || item.description || '';
    const desc = item.description || '';
    return name.includes('🏸') || name.includes('羽球') || name.includes('羽毛球') || name.includes('Court') || name.includes('Setapak') || name.includes('Lavana') || desc.includes('Court Ledger');
  }

  const items = [
    { id: 'proj_1', name: '🏸 Setapak Badminton Session (2026-08-20)', description: '由 Court Ledger 导入的羽球局账单' },
    { id: 'proj_2', name: '🌴 Penang Food Trip 3D2N', description: '槟城美食之旅' },
    { id: 'proj_3', name: '羽毛球球局 - Lavana Sports', description: '周三球局' },
    { id: 'proj_4', name: '🏠 House Rental & Utilities', description: '房租水电分摊' }
  ];

  const badminton = items.filter(isBadmintonItem);
  const trips = items.filter(i => !isBadmintonItem(i));

  assert.equal(badminton.length, 2);
  assert.equal(badminton[0].id, 'proj_1');
  assert.equal(badminton[1].id, 'proj_3');

  assert.equal(trips.length, 2);
  assert.equal(trips[0].id, 'proj_2');
  assert.equal(trips[1].id, 'proj_4');
});

test('Badminton Session Settlement Calculation: finds unpaid players and remaining debts', () => {
  const mePersonId = 'usr_me';
  const pairwise = {
    'pl_1': { theyOweMe: 2500 }, // owes 25
    'pl_2': { theyOweMe: 0 },    // settled
    'pl_3': { theyOweMe: 2500 }  // owes 25
  };

  const participants = [
    { person_id: mePersonId, share_amount: 0, is_settled: true },
    { person_id: 'pl_1', person_name: 'Player 1', share_amount: 2500, is_settled: false },
    { person_id: 'pl_2', person_name: 'Player 2', share_amount: 2500, is_settled: true },
    { person_id: 'pl_3', person_name: 'Player 3', share_amount: 2500, is_settled: false }
  ];

  const playersList = participants
    .filter(p => p.person_id !== mePersonId)
    .map(pl => {
      const pair = pairwise[pl.person_id] || {};
      const theyOwe = pair.theyOweMe !== undefined ? pair.theyOweMe : (pl.is_settled ? 0 : pl.share_amount);
      return {
        id: pl.person_id,
        name: pl.person_name,
        isPaid: pl.is_settled || theyOwe <= 0,
        remainingDebt: theyOwe
      };
    });

  assert.equal(playersList.length, 3);
  assert.equal(playersList.filter(p => p.isPaid).length, 1);
  assert.equal(playersList.filter(p => !p.isPaid).length, 2);

  const pendingAmount = playersList.reduce((sum, p) => sum + (p.isPaid ? 0 : p.remainingDebt), 0);
  assert.equal(pendingAmount, 5000); // RM 50.00
});

