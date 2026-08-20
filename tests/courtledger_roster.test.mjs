import test from 'node:test';
import assert from 'node:assert/strict';

// Helper function implementing roster parsing logic with metadata extraction and default host rules
export function parseRosterText(rawText, expectedHostCount = 1) {
  if (!rawText || typeof rawText !== 'string') {
    return { players: [], hostCount: 0, totalCount: 0, venue: '', date: '', timeRange: '', duration: 2, startHour: 18 };
  }

  const lines = rawText.split('\n');
  const players = [];
  let hostCount = 0;
  let venue = '';
  let date = '';
  let timeRange = '';
  let duration = 2;
  let startHour = 18;
  let isWaitingListSection = false;

  for (let line of lines) {
    let trimmed = line.trim();
    if (!trimmed) continue;

    // Check for "waiting list" section -> ignore subsequent slots
    if (/waiting\s*list|候补|替补/i.test(trimmed)) {
      isWaitingListSection = true;
      continue;
    }
    if (isWaitingListSection) {
      continue;
    }

    // Extract Venue (e.g. 📍Lavana Setapak, 场地: ...)
    const venueMatch = trimmed.match(/(?:📍|场地|地点|Venue|球馆)[\s:：]*([^\n\r]+)/i);
    if (venueMatch && !venue) {
      venue = venueMatch[1].trim();
      continue;
    }

    // Extract Date (e.g. 🗓️15/8/2026 (Saturday))
    const dateMatch = trimmed.match(/(?:🗓️|📅|日期|Date)[\s:：]*([^\n\r]+)/i);
    if (dateMatch && !date) {
      date = dateMatch[1].trim();
      continue;
    }

    // Extract Time (e.g. 🕓4pm-6pm, 8:00pm - 10:00pm)
    const timeMatch = trimmed.match(/(?:🕓|⏰|时间|Time)[\s:：]*([^\n\r]+)/i) || trimmed.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?\s*[-~至到]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?)/);
    if (timeMatch && !timeRange) {
      timeRange = (timeMatch[1] || timeMatch[0]).trim();
      // Try parsing startHour & duration
      const rangeParts = timeRange.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?\s*[-~至到]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?/);
      if (rangeParts) {
        let h1 = parseInt(rangeParts[1], 10);
        const ampm1 = rangeParts[3] ? rangeParts[3].toLowerCase() : '';
        let h2 = parseInt(rangeParts[4], 10);
        const ampm2 = rangeParts[6] ? rangeParts[6].toLowerCase() : (ampm1 || (h2 <= 12 && h2 >= 1 ? 'pm' : ''));

        if (ampm1 === 'pm' && h1 < 12) h1 += 12;
        if (ampm2 === 'pm' && h2 < 12) h2 += 12;
        if (h2 > h1) {
          startHour = h1;
          duration = h2 - h1;
        }
      }
      continue;
    }

    // Skip non-player lines like 💰AA, (upper beginner), headers, dividers
    if (/^(?:💰|💵|🏸|AA|level|beginner|intermediate|advanced|\(.*\)|\[.*\])/i.test(trimmed) && !/^\d+[\.、\s\-]/.test(trimmed)) {
      continue;
    }
    if (trimmed.startsWith('==') || trimmed.startsWith('--')) continue;

    // Check if it's a numbered line e.g. "1. Siow", "3.tongen", "19.Tey chin liang", "7."
    const numMatch = trimmed.match(/^(\d+|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]|\[\d+\]|\(\d+\))[\.、\s\-:：]*(.*)$/u);
    if (numMatch) {
      const namePart = numMatch[2].trim();
      // Empty slot like "7." or "7. " -> ignore
      if (!namePart || namePart === '-' || namePart === '—') continue;
      trimmed = namePart;
    } else {
      // If not starting with a number and not matching recognized header, skip if it doesn't look like a name
      if (!trimmed || trimmed.length > 30) continue;
    }

    // Check if player is marked as Host / 组织者 / 群主
    const hostRegex = /[\(\（]?(?:host|Host|HOST|组织者|群主|组织人|发起人)[\)\）]?/i;
    let isHost = false;
    if (hostRegex.test(trimmed)) {
      isHost = true;
      trimmed = trimmed.replace(hostRegex, '').trim();
    }

    // Check for +1, +2, +N
    const plusRegex = /[\+\＋加]\s*(\d+)/;
    const plusMatch = trimmed.match(plusRegex);

    let plusCount = 0;
    if (plusMatch) {
      plusCount = parseInt(plusMatch[1], 10) || 0;
      trimmed = trimmed.replace(plusRegex, '').trim();
    }

    const baseName = trimmed.replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, '').trim();
    if (!baseName) continue;

    // Add main player
    players.push({
      id: 'p_' + Math.random().toString(36).substr(2, 9),
      name: baseName,
      isHost: isHost,
      isPaid: isHost // Host is free
    });
    if (isHost) hostCount++;

    for (let i = 1; i <= plusCount; i++) {
      players.push({
        id: 'p_' + Math.random().toString(36).substr(2, 9),
        name: `${baseName} (朋友${i})`,
        isHost: false,
        isPaid: false
      });
    }
  }

  // If no explicit (Host) found in text, apply default host rule (1 host = 1st person, 2 hosts = 1st & 2nd persons)
  if (hostCount === 0 && expectedHostCount > 0) {
    const limit = Math.min(expectedHostCount, players.length);
    for (let i = 0; i < limit; i++) {
      players[i].isHost = true;
      players[i].isPaid = true;
      hostCount++;
    }
  }

  return {
    players,
    hostCount,
    totalCount: players.length,
    venue,
    date,
    timeRange,
    duration,
    startHour
  };
}

export function generateRosterProgressText({ venueName, timeRange, playerFee, players }) {
  const total = players.length;
  const paidCount = players.filter(p => p.isPaid || p.isHost).length;
  const feeStr = typeof playerFee === 'number' ? `RM ${playerFee.toFixed(2)}` : `${playerFee}`;

  let out = `🏸 *羽球局费用收款进度 (${paidCount}/${total})*\n`;
  if (venueName) out += `🏟️ *场地*：${venueName}\n`;
  if (timeRange) out += `⏰ *时段*：${timeRange}\n`;
  out += `💰 *人均*：${feeStr}\n`;
  out += `-------------------------\n`;

  players.forEach((p, idx) => {
    const num = idx + 1;
    if (p.isHost) {
      out += `${num}. ${p.name} (👑 Host · 免单)\n`;
    } else if (p.isPaid) {
      out += `${num}. ${p.name} [✅ 已付]\n`;
    } else {
      out += `${num}. ${p.name} [⏳ 待付 ${feeStr}]\n`;
    }
  });

  out += `-------------------------\n`;
  out += `📌 请待付球友尽快完成支付，谢谢！`;
  return out;
}

test('User Real-World Sample: parses Lavana Setapak 21-list with empty slot 7, 1 host default (Siow is host)', () => {
  const userSample = `📍Lavana Setapak 
🗓️15/8/2026 (Saturday) 
🕓4pm-6pm 
💰AA 
(upper beginner)

1. Siow
2. Toh
3.tongen
4.nick
5.weichen
6.Vincent
7.
8. Dickson
9. cham
10. Liang
11. L1
12. L2
13. L3
14. L4
15. Lien
16. Vincent
17. yh
18. tianle
19.Tey chin liang
20.Lim pin chen
21.Tianle2

waiting list
1.`;

  // Parse with 1 host expected (default)
  const parsed1 = parseRosterText(userSample, 1);
  assert.equal(parsed1.hostCount, 1);
  assert.equal(parsed1.totalCount, 20);
  assert.equal(parsed1.players[0].name, 'Siow');
  assert.equal(parsed1.players[0].isHost, true, '1st player Siow should be marked as Host');
  assert.equal(parsed1.players[0].isPaid, true);
  assert.equal(parsed1.players[1].name, 'Toh');
  assert.equal(parsed1.players[1].isHost, false);

  // Parse with 2 hosts expected (1st and 2nd persons are hosts)
  const parsed2 = parseRosterText(userSample, 2);
  assert.equal(parsed2.hostCount, 2);
  assert.equal(parsed2.players[0].name, 'Siow');
  assert.equal(parsed2.players[0].isHost, true);
  assert.equal(parsed2.players[1].name, 'Toh');
  assert.equal(parsed2.players[1].isHost, true, '2nd player Toh should also be marked as Host');
  assert.equal(parsed2.players[2].name, 'tongen');
  assert.equal(parsed2.players[2].isHost, false);
});
