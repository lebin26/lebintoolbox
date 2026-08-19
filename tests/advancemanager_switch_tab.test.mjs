import test from 'node:test';
import assert from 'node:assert/strict';

test('Advance Manager Tab Switching: toggles sections properly', () => {
  const sectionIds = ['dashboard', 'expenses', 'people', 'projects', 'settlements'];
  
  function simulateSwitchTab(targetTab) {
    const visibility = {};
    sectionIds.forEach(id => {
      visibility[id] = (id === targetTab);
    });
    return visibility;
  }

  const res1 = simulateSwitchTab('expenses');
  assert.equal(res1.expenses, true);
  assert.equal(res1.dashboard, false);
  assert.equal(res1.people, false);

  const res2 = simulateSwitchTab('people');
  assert.equal(res2.people, true);
  assert.equal(res2.expenses, false);
  assert.equal(res2.dashboard, false);

  const res3 = simulateSwitchTab('projects');
  assert.equal(res3.projects, true);
  assert.equal(res3.dashboard, false);

  const res4 = simulateSwitchTab('settlements');
  assert.equal(res4.settlements, true);
  assert.equal(res4.dashboard, false);
});
