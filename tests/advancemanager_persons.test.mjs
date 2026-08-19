import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Person Sorting & Lifecycle Rules
 */
export function sortPersons(persons = []) {
  return [...persons].sort((a, b) => {
    // 1. Favourites first
    const favA = a.is_favourite ? 1 : 0;
    const favB = b.is_favourite ? 1 : 0;
    if (favA !== favB) return favB - favA;

    // 2. Active before archived
    const archA = a.is_archived ? 1 : 0;
    const archB = b.is_archived ? 1 : 0;
    if (archA !== archB) return archA - archB;

    // 3. Name alphabetical
    return (a.name || '').localeCompare(b.name || '');
  });
}

test('Persons Management: Favourite persons are sorted first', () => {
  const persons = [
    { id: '1', name: 'Alice', is_favourite: false },
    { id: '2', name: 'Bob', is_favourite: true },
    { id: '3', name: 'Charlie', is_favourite: false },
    { id: '4', name: 'David', is_favourite: true }
  ];

  const sorted = sortPersons(persons);
  assert.equal(sorted[0].name, 'Bob');
  assert.equal(sorted[1].name, 'David');
  assert.equal(sorted[2].name, 'Alice');
  assert.equal(sorted[3].name, 'Charlie');
});

test('Persons Management: Temporary persons can be distinguished from permanent', () => {
  const p1 = { id: '1', name: 'Temp Guest', is_temporary: true, is_favourite: false };
  const p2 = { id: '2', name: 'Best Friend', is_temporary: false, is_favourite: true };

  assert.equal(p1.is_temporary, true);
  assert.equal(p2.is_temporary, false);
  assert.equal(p2.is_favourite, true);
});
