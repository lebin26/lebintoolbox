import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Multi-criteria Person Sorter with:
 * 1. Self ("我 / isSelf") strictly pinned at Position #1
 * 2. Favourites starting from Position #2
 * 3. General contacts following afterwards
 */
export function sortPersonsByCriteria(persons = [], sortBy = 'name_asc') {
  return [...persons].sort((a, b) => {
    // 0. "我 (Me)" / isSelf always strictly at #1
    if (a.isSelf && !b.isSelf) return -1;
    if (!a.isSelf && b.isSelf) return 1;

    // 1. Favourites pinned starting from #2
    const favA = a.is_favourite ? 1 : 0;
    const favB = b.is_favourite ? 1 : 0;
    if (favA !== favB) return favB - favA;

    // 2. Active before archived
    const archA = a.is_archived ? 1 : 0;
    const archB = b.is_archived ? 1 : 0;
    if (archA !== archB) return archA - archB;

    // 3. User selected criteria within each group
    if (sortBy === 'they_owe_desc') {
      const diff = (b.theyOweMe || 0) - (a.theyOweMe || 0);
      if (diff !== 0) return diff;
    } else if (sortBy === 'i_owe_desc') {
      const diff = (b.iOweThem || 0) - (a.iOweThem || 0);
      if (diff !== 0) return diff;
    } else if (sortBy === 'net_desc') {
      const diff = (b.netBalance || 0) - (a.netBalance || 0);
      if (diff !== 0) return diff;
    }

    // Default: Alphabetical
    return (a.name || '').localeCompare(b.name || '');
  });
}

test('Sort Rule: Self is always #1, Favourites start from #2, then remaining contacts', () => {
  const persons = [
    { id: '1', name: 'Zach', is_favourite: true, isSelf: false },
    { id: '2', name: 'Amy', is_favourite: true, isSelf: false },
    { id: '3', name: 'Brian', is_favourite: false, isSelf: false },
    { id: '4', name: 'Lebin (Me)', is_favourite: false, isSelf: true }
  ];

  const sorted = sortPersonsByCriteria(persons, 'name_asc');

  // 1. Self must be #1
  assert.equal(sorted[0].name, 'Lebin (Me)');
  assert.equal(sorted[0].isSelf, true);

  // 2. Favourites starting from #2
  assert.equal(sorted[1].name, 'Amy');
  assert.equal(sorted[2].name, 'Zach');

  // 3. General contacts
  assert.equal(sorted[3].name, 'Brian');
});

test('Sort By "they_owe_desc": Self is #1, Favourites sorted by debt from #2, then general contacts', () => {
  const persons = [
    { id: '1', name: 'Alice', theyOweMe: 1000, is_favourite: false, isSelf: false },
    { id: '2', name: 'Bob', theyOweMe: 5000, is_favourite: false, isSelf: false },
    { id: '3', name: 'Charlie', theyOweMe: 2000, is_favourite: true, isSelf: false },
    { id: '4', name: 'David', theyOweMe: 8000, is_favourite: true, isSelf: false },
    { id: '5', name: 'Me', theyOweMe: 0, is_favourite: false, isSelf: true }
  ];

  const sorted = sortPersonsByCriteria(persons, 'they_owe_desc');

  // Position #1: Self
  assert.equal(sorted[0].name, 'Me');

  // Position #2 & #3: Favourites tier (David 8000, Charlie 2000)
  assert.equal(sorted[1].name, 'David');
  assert.equal(sorted[2].name, 'Charlie');

  // Position #4 & #5: Non-favourites tier (Bob 5000, Alice 1000)
  assert.equal(sorted[3].name, 'Bob');
  assert.equal(sorted[4].name, 'Alice');
});
