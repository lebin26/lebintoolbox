/**
 * Cloudflare Worker Handler for Advance Manager (垫付管理)
 * Strictly isolated multi-tenant data access, balance calculation, and D1 transaction integrity.
 */

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token'
    }
  });
}

function successResponse(data, status = 200) {
  return jsonResponse({ success: true, data }, status);
}

function failureResponse(code, message, status = 400) {
  return jsonResponse({
    success: false,
    error: { code, message }
  }, status);
}

function generateUUID() {
  return crypto.randomUUID();
}

/**
 * Pure Balance Computation for a given user's dataset
 */
function computeBalances(persons, expenses, settlements) {
  const activeExpenses = expenses.filter(e => e.status !== 'cancelled');

  // Pairwise debt matrix: debtMap[creditorId][debtorId] = cents that debtor owes creditor
  const debtMap = {};
  const initDebt = (p1, p2) => {
    if (!debtMap[p1]) debtMap[p1] = {};
    if (!debtMap[p1][p2]) debtMap[p1][p2] = 0;
  };

  for (const exp of activeExpenses) {
    const payerId = exp.payer_person_id;
    const parts = exp.participants || [];
    for (const part of parts) {
      const debtorId = part.person_id;
      if (debtorId !== payerId) {
        initDebt(payerId, debtorId);
        debtMap[payerId][debtorId] += (part.share_amount || 0);
      }
    }
  }

  for (const set of settlements) {
    const fromId = set.from_person_id; // Debtor paying back
    const toId = set.to_person_id;     // Creditor receiving
    initDebt(toId, fromId);
    debtMap[toId][fromId] -= (set.amount || 0);
  }

  const personBalances = {};
  for (const p of persons) {
    personBalances[p.id] = {
      id: p.id,
      name: p.name,
      nickname: p.nickname,
      avatar_url: p.avatar_url,
      owesMe: 0,
      iOwe: 0,
      netBalance: 0,
      pairwise: {}
    };
  }

  const personIds = persons.map(p => p.id);
  for (let i = 0; i < personIds.length; i++) {
    for (let j = i + 1; j < personIds.length; j++) {
      const p1 = personIds[i];
      const p2 = personIds[j];

      const p2OwesP1 = (debtMap[p1] && debtMap[p1][p2]) || 0;
      const p1OwesP2 = (debtMap[p2] && debtMap[p2][p1]) || 0;

      const netP1vsP2 = p2OwesP1 - p1OwesP2;

      if (personBalances[p1]) {
        personBalances[p1].pairwise[p2] = {
          net: netP1vsP2,
          theyOweMe: Math.max(0, netP1vsP2),
          iOweThem: Math.max(0, -netP1vsP2)
        };
      }
      if (personBalances[p2]) {
        personBalances[p2].pairwise[p1] = {
          net: -netP1vsP2,
          theyOweMe: Math.max(0, -netP1vsP2),
          iOweThem: Math.max(0, netP1vsP2)
        };
      }
    }
  }

  for (const pId of personIds) {
    const pb = personBalances[pId];
    for (const otherId of Object.keys(pb.pairwise)) {
      const pw = pb.pairwise[otherId];
      pb.owesMe += pw.theyOweMe;
      pb.iOwe += pw.iOweThem;
    }
    pb.netBalance = pb.owesMe - pb.iOwe;
  }

  return personBalances;
}

/**
 * Ensure default self Person avatar exists for the user
 */
async function ensureSelfPerson(env, currentUser) {
  const userIdStr = String(currentUser.id);
  const existing = await env.DB.prepare(
    'SELECT * FROM am_persons WHERE owner_user_id = ? AND (name = ? OR name = ?) LIMIT 1'
  ).bind(userIdStr, currentUser.name, '我 (Me)').first();

  if (existing) return existing;

  // Create self person avatar
  const personId = 'p_me_' + userIdStr;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO am_persons (id, owner_user_id, name, nickname, email, is_archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
  ).bind(personId, userIdStr, currentUser.name || '我 (Me)', '我', currentUser.email || null, now, now).run();

  return { id: personId, name: currentUser.name, nickname: '我' };
}

/**
 * Retention Policy: Retain only the latest 5 settled expenses & 5 settlements.
 * Purges old resolved data to keep database lightweight and zero clutter.
 */
async function autoPruneResolvedHistory(env, userId) {
  let prunedCount = 0;

  // 1. Purge old settled expenses (Retain only latest 5 settled)
  const settledRes = await env.DB.prepare(
    `SELECT id FROM am_expenses 
     WHERE owner_user_id = ? AND status = 'settled'
     ORDER BY transaction_date DESC, created_at DESC`
  ).bind(userId).all();

  const settledExpenses = settledRes.results || [];
  if (settledExpenses.length > 5) {
    const toDelete = settledExpenses.slice(5).map(e => e.id);
    for (const expId of toDelete) {
      await env.DB.prepare('DELETE FROM am_expense_participants WHERE expense_id = ?').bind(expId).run();
      await env.DB.prepare('DELETE FROM am_expenses WHERE id = ? AND owner_user_id = ?').bind(expId, userId).run();
      prunedCount++;
    }
  }

  // 2. Purge old settlements (Retain only latest 5 settlements)
  const setRes = await env.DB.prepare(
    `SELECT id FROM am_settlements 
     WHERE owner_user_id = ?
     ORDER BY settlement_date DESC, created_at DESC`
  ).bind(userId).all();

  const allSets = setRes.results || [];
  if (allSets.length > 5) {
    const toDeleteSets = allSets.slice(5).map(s => s.id);
    for (const setId of toDeleteSets) {
      await env.DB.prepare('DELETE FROM am_settlements WHERE id = ? AND owner_user_id = ?').bind(setId, userId).run();
      prunedCount++;
    }
  }

  return prunedCount;
}

export async function handleAdvanceManagerRequest(request, env, currentUser, path, method) {
  if (!currentUser) {
    return failureResponse('AUTH_REQUIRED', '请先登录以使用垫付管理', 401);
  }

  const userId = String(currentUser.id);
  const selfPerson = await ensureSelfPerson(env, currentUser);

  // -------------------------------------------------------------------
  // 1. DASHBOARD OVERVIEW: GET /api/advancemanager/dashboard
  // -------------------------------------------------------------------
  if (method === 'GET' && path === '/api/advancemanager/dashboard') {
    const personsRes = await env.DB.prepare(
      'SELECT id, name, nickname, avatar_url FROM am_persons WHERE owner_user_id = ? AND is_archived = 0'
    ).bind(userId).all();
    const persons = personsRes.results || [];

    const expensesRes = await env.DB.prepare(
      `SELECT e.id, e.payer_person_id, e.total_amount, e.status, e.description, e.transaction_date
       FROM am_expenses e WHERE e.owner_user_id = ? AND e.status != 'cancelled'
       ORDER BY e.transaction_date DESC`
    ).bind(userId).all();
    const rawExpenses = expensesRes.results || [];

    // Fetch participants for all active expenses
    const expIds = rawExpenses.map(e => e.id);
    let participants = [];
    if (expIds.length > 0) {
      // Chunk or fetch all for this user
      const partRes = await env.DB.prepare(
        `SELECT ep.expense_id, ep.person_id, ep.share_amount, ep.split_type
         FROM am_expense_participants ep
         INNER JOIN am_expenses e ON ep.expense_id = e.id
         WHERE e.owner_user_id = ? AND e.status != 'cancelled'`
      ).bind(userId).all();
      participants = partRes.results || [];
    }

    const partMap = {};
    for (const p of participants) {
      if (!partMap[p.expense_id]) partMap[p.expense_id] = [];
      partMap[p.expense_id].push(p);
    }
    const expenses = rawExpenses.map(e => ({
      ...e,
      participants: partMap[e.id] || []
    }));

    const settlementsRes = await env.DB.prepare(
      `SELECT s.id, s.from_person_id, s.to_person_id, s.amount, s.settlement_date, s.payment_method, s.note,
              p_from.name AS from_name, p_to.name AS to_name
       FROM am_settlements s
       LEFT JOIN am_persons p_from ON s.from_person_id = p_from.id
       LEFT JOIN am_persons p_to ON s.to_person_id = p_to.id
       WHERE s.owner_user_id = ?
       ORDER BY s.settlement_date DESC LIMIT 5`
    ).bind(userId).all();
    const settlements = settlementsRes.results || [];

    const allSettlementsRes = await env.DB.prepare(
      'SELECT id, from_person_id, to_person_id, amount FROM am_settlements WHERE owner_user_id = ?'
    ).bind(userId).all();

    const personBalances = computeBalances(persons, expenses, allSettlementsRes.results || []);
    const meBalance = personBalances[selfPerson.id] || { owesMe: 0, iOwe: 0, netBalance: 0, pairwise: {} };

    // Breakdown lists
    const peopleWhoOwe = [];
    const peopleIOwe = [];
    for (const p of persons) {
      if (p.id === selfPerson.id) continue;
      const pw = meBalance.pairwise[p.id];
      if (pw && pw.theyOweMe > 0) {
        peopleWhoOwe.push({ personId: p.id, name: p.name, nickname: p.nickname, amount: pw.theyOweMe });
      } else if (pw && pw.iOweThem > 0) {
        peopleIOwe.push({ personId: p.id, name: p.name, nickname: p.nickname, amount: pw.iOweThem });
      }
    }
    peopleWhoOwe.sort((a, b) => b.amount - a.amount);
    peopleIOwe.sort((a, b) => b.amount - a.amount);

    // Total Advanced (expenses where self was payer)
    const totalAdvanced = expenses
      .filter(e => e.payer_person_id === selfPerson.id)
      .reduce((sum, e) => sum + e.total_amount, 0);

    // Total Settled (settlements where self received)
    const totalSettled = (allSettlementsRes.results || [])
      .filter(s => s.to_person_id === selfPerson.id)
      .reduce((sum, s) => sum + s.amount, 0);

    return successResponse({
      mePersonId: selfPerson.id,
      totalAdvanced,
      totalSettled,
      totalOutstanding: meBalance.owesMe, // Others owe me
      iOweTotal: meBalance.iOwe,          // I owe others
      netBalance: meBalance.netBalance,   // Overall net
      peopleWhoOwe,
      peopleIOwe,
      recentExpenses: rawExpenses.slice(0, 5),
      recentSettlements: settlements
    });
  }

  // -------------------------------------------------------------------
  // 2. PERSONS: GET /api/advancemanager/persons
  // -------------------------------------------------------------------
  if (method === 'GET' && path === '/api/advancemanager/persons') {
    const personsRes = await env.DB.prepare(
      'SELECT * FROM am_persons WHERE owner_user_id = ? ORDER BY is_favourite DESC, is_archived ASC, name ASC'
    ).bind(userId).all();
    const persons = personsRes.results || [];

    // Calculate balances for each person
    const expensesRes = await env.DB.prepare(
      `SELECT e.id, e.payer_person_id, e.total_amount, e.status
       FROM am_expenses e WHERE e.owner_user_id = ? AND e.status != 'cancelled'`
    ).bind(userId).all();
    const rawExpenses = expensesRes.results || [];

    const partRes = await env.DB.prepare(
      `SELECT ep.expense_id, ep.person_id, ep.share_amount
       FROM am_expense_participants ep
       INNER JOIN am_expenses e ON ep.expense_id = e.id
       WHERE e.owner_user_id = ? AND e.status != 'cancelled'`
    ).bind(userId).all();

    const partMap = {};
    for (const p of (partRes.results || [])) {
      if (!partMap[p.expense_id]) partMap[p.expense_id] = [];
      partMap[p.expense_id].push(p);
    }
    const expenses = rawExpenses.map(e => ({ ...e, participants: partMap[e.id] || [] }));

    const settlementsRes = await env.DB.prepare(
      'SELECT id, from_person_id, to_person_id, amount FROM am_settlements WHERE owner_user_id = ?'
    ).bind(userId).all();

    const balances = computeBalances(persons, expenses, settlementsRes.results || []);
    const meBalance = balances[selfPerson.id] || { pairwise: {} };

    const data = persons.map(p => {
      const isSelf = p.id === selfPerson.id;
      const pw = meBalance.pairwise[p.id] || { net: 0, theyOweMe: 0, iOweThem: 0 };
      return {
        ...p,
        isSelf,
        is_temporary: Boolean(p.is_temporary),
        is_favourite: Boolean(p.is_favourite),
        netBalance: isSelf ? (balances[p.id]?.netBalance || 0) : pw.net,
        theyOweMe: isSelf ? 0 : pw.theyOweMe,
        iOweThem: isSelf ? 0 : pw.iOweThem
      };
    });

    return successResponse(data);
  }

  // POST /api/advancemanager/persons - Create Person
  if (method === 'POST' && path === '/api/advancemanager/persons') {
    const body = await request.json().catch(() => null);
    if (!body || !body.name || !body.name.trim()) {
      return failureResponse('VALIDATION_ERROR', '人物姓名不能为空');
    }

    const id = 'p_' + generateUUID().slice(0, 12);
    const now = new Date().toISOString();
    const isTemp = body.is_temporary ? 1 : 0;
    const isFav = (!isTemp && body.is_favourite) ? 1 : 0;

    await env.DB.prepare(
      `INSERT INTO am_persons (id, owner_user_id, name, nickname, phone, email, avatar_url, note, is_temporary, is_favourite, is_archived, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    ).bind(
      id,
      userId,
      body.name.trim(),
      body.nickname ? body.nickname.trim() : null,
      body.phone ? body.phone.trim() : null,
      body.email ? body.email.trim() : null,
      body.avatar_url ? body.avatar_url.trim() : null,
      body.note ? body.note.trim() : null,
      isTemp,
      isFav,
      now,
      now
    ).run();

    return successResponse({ id, name: body.name.trim(), is_temporary: isTemp, is_favourite: isFav });
  }

  // POST /api/advancemanager/persons/:id/toggle-favourite - Toggle favourite
  const toggleFavMatch = path.match(/^\/api\/advancemanager\/persons\/([a-zA-Z0-9_-]+)\/toggle-favourite$/);
  if (method === 'POST' && toggleFavMatch) {
    const pId = toggleFavMatch[1];
    const person = await env.DB.prepare('SELECT id, is_favourite, is_temporary FROM am_persons WHERE id = ? AND owner_user_id = ?').bind(pId, userId).first();
    if (!person) return failureResponse('NOT_FOUND', '未找到指定人物');

    const newFav = person.is_favourite ? 0 : 1;
    // When favourited, ensure it's permanently kept (not temporary)
    const newTemp = newFav ? 0 : person.is_temporary;
    const now = new Date().toISOString();

    await env.DB.prepare(
      'UPDATE am_persons SET is_favourite = ?, is_temporary = ?, updated_at = ? WHERE id = ? AND owner_user_id = ?'
    ).bind(newFav, newTemp, now, pId, userId).run();

    return successResponse({ id: pId, is_favourite: Boolean(newFav), is_temporary: Boolean(newTemp) });
  }

  // PUT /api/advancemanager/persons/:id - Update/Archive Person
  const personIdMatch = path.match(/^\/api\/advancemanager\/persons\/([a-zA-Z0-9_-]+)$/);
  if (method === 'PUT' && personIdMatch) {
    const pId = personIdMatch[1];
    const body = await request.json().catch(() => null);
    if (!body) return failureResponse('VALIDATION_ERROR', '无效请求体');

    const existing = await env.DB.prepare(
      'SELECT id FROM am_persons WHERE id = ? AND owner_user_id = ?'
    ).bind(pId, userId).first();
    if (!existing) return failureResponse('NOT_FOUND', '未找到指定人物');

    const now = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE am_persons SET
        name = COALESCE(?, name),
        nickname = COALESCE(?, nickname),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        avatar_url = COALESCE(?, avatar_url),
        note = COALESCE(?, note),
        is_temporary = COALESCE(?, is_temporary),
        is_favourite = COALESCE(?, is_favourite),
        is_archived = COALESCE(?, is_archived),
        updated_at = ?
       WHERE id = ? AND owner_user_id = ?`
    ).bind(
      body.name !== undefined ? body.name.trim() : null,
      body.nickname !== undefined ? body.nickname.trim() : null,
      body.phone !== undefined ? body.phone.trim() : null,
      body.email !== undefined ? body.email.trim() : null,
      body.avatar_url !== undefined ? body.avatar_url.trim() : null,
      body.note !== undefined ? body.note.trim() : null,
      body.is_temporary !== undefined ? (body.is_temporary ? 1 : 0) : null,
      body.is_favourite !== undefined ? (body.is_favourite ? 1 : 0) : null,
      body.is_archived !== undefined ? (body.is_archived ? 1 : 0) : null,
      now,
      pId,
      userId
    ).run();

    return successResponse({ id: pId, updated: true });
  }

  // GET /api/advancemanager/persons/:id - Person Detail & Ledger History
  if (method === 'GET' && personIdMatch) {
    const pId = personIdMatch[1];
    const person = await env.DB.prepare(
      'SELECT * FROM am_persons WHERE id = ? AND owner_user_id = ?'
    ).bind(pId, userId).first();
    if (!person) return failureResponse('NOT_FOUND', '未找到指定人物');

    // Fetch related expenses (where this person is payer OR participant)
    const expRes = await env.DB.prepare(
      `SELECT DISTINCT e.id, e.transaction_date, e.description, e.total_amount, e.status, e.payer_person_id,
              p_payer.name AS payer_name
       FROM am_expenses e
       LEFT JOIN am_expense_participants ep ON e.id = ep.expense_id
       LEFT JOIN am_persons p_payer ON e.payer_person_id = p_payer.id
       WHERE e.owner_user_id = ? AND (e.payer_person_id = ? OR ep.person_id = ?)
       ORDER BY e.transaction_date DESC`
    ).bind(userId, pId, pId).all();
    const relatedExpenses = expRes.results || [];

    // Fetch related settlements
    const setRes = await env.DB.prepare(
      `SELECT s.*, p_from.name AS from_name, p_to.name AS to_name
       FROM am_settlements s
       LEFT JOIN am_persons p_from ON s.from_person_id = p_from.id
       LEFT JOIN am_persons p_to ON s.to_person_id = p_to.id
       WHERE s.owner_user_id = ? AND (s.from_person_id = ? OR s.to_person_id = ?)
       ORDER BY s.settlement_date DESC`
    ).bind(userId, pId, pId).all();
    const relatedSettlements = setRes.results || [];

    return successResponse({
      person,
      expenses: relatedExpenses,
      settlements: relatedSettlements
    });
  }

  // -------------------------------------------------------------------
  // 3. EXPENSES: GET /api/advancemanager/expenses
  // -------------------------------------------------------------------
  if (method === 'GET' && path === '/api/advancemanager/expenses') {
    const url = new URL(request.url);
    const search = (url.searchParams.get('search') || '').trim().toLowerCase();
    const status = (url.searchParams.get('status') || '').trim();
    const personId = (url.searchParams.get('person_id') || '').trim();
    const categoryId = (url.searchParams.get('category_id') || '').trim();
    const projectId = (url.searchParams.get('project_id') || '').trim();
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit')) || 20));
    const offset = Math.max(0, parseInt(url.searchParams.get('offset')) || 0);

    let query = `
      SELECT e.id, e.transaction_date, e.description, e.total_amount, e.currency,
             e.payer_person_id, e.category_id, e.project_id, e.payment_method,
             e.status, e.note, e.created_at,
             p.name AS payer_name,
             c.name AS category_name, c.icon AS category_icon,
             proj.name AS project_name
      FROM am_expenses e
      LEFT JOIN am_persons p ON e.payer_person_id = p.id
      LEFT JOIN am_categories c ON e.category_id = c.id
      LEFT JOIN am_projects proj ON e.project_id = proj.id
      WHERE e.owner_user_id = ?
    `;
    const params = [userId];

    if (status) {
      query += ' AND e.status = ?';
      params.push(status);
    }
    if (personId) {
      query += ' AND (e.payer_person_id = ? OR e.id IN (SELECT expense_id FROM am_expense_participants WHERE person_id = ?))';
      params.push(personId, personId);
    }
    if (categoryId) {
      query += ' AND e.category_id = ?';
      params.push(categoryId);
    }
    if (projectId) {
      query += ' AND e.project_id = ?';
      params.push(projectId);
    }
    if (search) {
      query += ' AND (LOWER(e.description) LIKE ? OR LOWER(p.name) LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY e.transaction_date DESC, e.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const expensesRes = await env.DB.prepare(query).bind(...params).all();
    const expenses = expensesRes.results || [];

    // Fetch participants for these expenses
    if (expenses.length > 0) {
      const expIds = expenses.map(e => e.id);
      const placeholders = expIds.map(() => '?').join(',');
      const partsRes = await env.DB.prepare(
        `SELECT ep.expense_id, ep.person_id, ep.split_type, ep.share_amount, ep.percentage,
                p.name AS person_name
         FROM am_expense_participants ep
         LEFT JOIN am_persons p ON ep.person_id = p.id
         WHERE ep.expense_id IN (${placeholders})`
      ).bind(...expIds).all();

      const partMap = {};
      for (const p of (partsRes.results || [])) {
        if (!partMap[p.expense_id]) partMap[p.expense_id] = [];
        partMap[p.expense_id].push(p);
      }

      for (const exp of expenses) {
        exp.participants = partMap[exp.id] || [];
      }
    }

    return successResponse({ expenses, limit, offset });
  }

  // POST /api/advancemanager/expenses - Create Expense with Participants
  if (method === 'POST' && path === '/api/advancemanager/expenses') {
    const body = await request.json().catch(() => null);
    if (!body) return failureResponse('VALIDATION_ERROR', '无效请求体');

    const {
      description,
      total_amount,
      payer_person_id,
      participants,
      transaction_date,
      category_id,
      project_id,
      payment_method,
      note,
      attachment_data
    } = body;

    const amountCents = parseInt(total_amount, 10);
    if (isNaN(amountCents) || amountCents <= 0) {
      return failureResponse('INVALID_AMOUNT', '垫付金额必须大于 0');
    }
    if (!description || !description.trim()) {
      return failureResponse('VALIDATION_ERROR', '垫付事由 (Description) 不能为空');
    }
    if (!payer_person_id) {
      return failureResponse('VALIDATION_ERROR', '请选择付款人 (Payer)');
    }
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return failureResponse('INVALID_SPLIT', '至少需要指定 1 名分摊参与人');
    }

    // Validate split sum
    const totalShare = participants.reduce((sum, p) => sum + (parseInt(p.share_amount, 10) || 0), 0);
    if (totalShare !== amountCents) {
      return failureResponse('INVALID_SPLIT', `分摊总额 (${(totalShare / 100).toFixed(2)}) 必须等于垫付总金额 (${(amountCents / 100).toFixed(2)})`);
    }

    const expenseId = 'exp_' + generateUUID().slice(0, 16);
    const now = new Date().toISOString();
    const txDate = transaction_date ? new Date(transaction_date).toISOString() : now;

    // D1 Batch Execution for Transaction Integrity
    const statements = [
      env.DB.prepare(
        `INSERT INTO am_expenses (
          id, owner_user_id, transaction_date, description, total_amount, currency,
          payer_person_id, category_id, project_id, payment_method, status, note, attachment_data, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'MYR', ?, ?, ?, ?, 'unsettled', ?, ?, ?, ?)`
      ).bind(
        expenseId,
        userId,
        txDate,
        description.trim(),
        amountCents,
        payer_person_id,
        category_id || null,
        project_id || null,
        payment_method || 'other',
        note ? note.trim() : null,
        attachment_data || null,
        now,
        now
      )
    ];

    for (const p of participants) {
      const partId = 'ep_' + generateUUID().slice(0, 16);
      statements.push(
        env.DB.prepare(
          `INSERT INTO am_expense_participants (id, expense_id, person_id, split_type, share_amount, percentage, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          partId,
          expenseId,
          p.person_id,
          p.split_type || 'equal',
          parseInt(p.share_amount, 10) || 0,
          p.percentage ? parseFloat(p.percentage) : null,
          now,
          now
        )
      );
    }

    // Audit Log
    statements.push(
      env.DB.prepare(
        `INSERT INTO am_audit_logs (id, owner_user_id, entity_type, entity_id, action, new_data, created_at)
         VALUES (?, ?, 'expense', ?, 'create', ?, ?)`
      ).bind(
        'log_' + generateUUID().slice(0, 16),
        userId,
        expenseId,
        JSON.stringify({ description, total_amount: amountCents, payer_person_id, participants_count: participants.length }),
        now
      )
    );

    await env.DB.batch(statements);

    return successResponse({ id: expenseId, message: '垫付记录创建成功' });
  }

  // GET /api/advancemanager/expenses/:id - Single Expense Detail
  const expenseIdMatch = path.match(/^\/api\/advancemanager\/expenses\/([a-zA-Z0-9_-]+)$/);
  if (method === 'GET' && expenseIdMatch) {
    const expId = expenseIdMatch[1];
    const expense = await env.DB.prepare(
      `SELECT e.*, p.name AS payer_name, c.name AS category_name, proj.name AS project_name
       FROM am_expenses e
       LEFT JOIN am_persons p ON e.payer_person_id = p.id
       LEFT JOIN am_categories c ON e.category_id = c.id
       LEFT JOIN am_projects proj ON e.project_id = proj.id
       WHERE e.id = ? AND e.owner_user_id = ?`
    ).bind(expId, userId).first();

    if (!expense) return failureResponse('NOT_FOUND', '未找到指定垫付记录');

    const partsRes = await env.DB.prepare(
      `SELECT ep.*, p.name AS person_name
       FROM am_expense_participants ep
       LEFT JOIN am_persons p ON ep.person_id = p.id
       WHERE ep.expense_id = ?`
    ).bind(expId).all();

    return successResponse({
      expense,
      participants: partsRes.results || []
    });
  }

  // DELETE /api/advancemanager/expenses/:id - Soft Delete (Cancel)
  if (method === 'DELETE' && expenseIdMatch) {
    const expId = expenseIdMatch[1];
    const existing = await env.DB.prepare(
      'SELECT id, status, total_amount, description FROM am_expenses WHERE id = ? AND owner_user_id = ?'
    ).bind(expId, userId).first();

    if (!existing) return failureResponse('NOT_FOUND', '未找到指定垫付记录');

    const now = new Date().toISOString();
    const statements = [
      env.DB.prepare(
        "UPDATE am_expenses SET status = 'cancelled', updated_at = ? WHERE id = ? AND owner_user_id = ?"
      ).bind(now, expId, userId),
      env.DB.prepare(
        `INSERT INTO am_audit_logs (id, owner_user_id, entity_type, entity_id, action, old_data, created_at)
         VALUES (?, ?, 'expense', ?, 'cancel', ?, ?)`
      ).bind(
        'log_' + generateUUID().slice(0, 16),
        userId,
        expId,
        JSON.stringify(existing),
        now
      )
    ];

    await env.DB.batch(statements);

    return successResponse({ id: expId, message: '垫付记录已标记取消' });
  }

  // -------------------------------------------------------------------
  // 4. SETTLEMENTS: GET & POST /api/advancemanager/settlements
  // -------------------------------------------------------------------
  if (method === 'GET' && path === '/api/advancemanager/settlements') {
    const settlementsRes = await env.DB.prepare(
      `SELECT s.*, p_from.name AS from_name, p_to.name AS to_name
       FROM am_settlements s
       LEFT JOIN am_persons p_from ON s.from_person_id = p_from.id
       LEFT JOIN am_persons p_to ON s.to_person_id = p_to.id
       WHERE s.owner_user_id = ?
       ORDER BY s.settlement_date DESC, s.created_at DESC`
    ).bind(userId).all();

    return successResponse(settlementsRes.results || []);
  }

  if (method === 'POST' && path === '/api/advancemanager/settlements') {
    const body = await request.json().catch(() => null);
    if (!body) return failureResponse('VALIDATION_ERROR', '无效请求体');

    const { from_person_id, to_person_id, amount, settlement_date, payment_method, note, expense_ids } = body;
    const amountCents = parseInt(amount, 10);

    if (isNaN(amountCents) || amountCents <= 0) {
      return failureResponse('INVALID_AMOUNT', '结算金额必须大于 0');
    }
    if (!from_person_id || !to_person_id || from_person_id === to_person_id) {
      return failureResponse('VALIDATION_ERROR', '还款人与收款人不能相同');
    }

    const id = 'set_' + generateUUID().slice(0, 16);
    const now = new Date().toISOString();
    const sDate = settlement_date ? new Date(settlement_date).toISOString() : now;

    const statements = [
      env.DB.prepare(
        `INSERT INTO am_settlements (id, owner_user_id, from_person_id, to_person_id, amount, currency, settlement_date, payment_method, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'MYR', ?, ?, ?, ?, ?)`
      ).bind(
        id,
        userId,
        from_person_id,
        to_person_id,
        amountCents,
        sDate,
        payment_method || 'direct_settlement',
        note ? note.trim() : null,
        now,
        now
      ),
      env.DB.prepare(
        `INSERT INTO am_audit_logs (id, owner_user_id, entity_type, entity_id, action, new_data, created_at)
         VALUES (?, ?, 'settlement', ?, 'create', ?, ?)`
      ).bind(
        'log_' + generateUUID().slice(0, 16),
        userId,
        id,
        JSON.stringify({ from_person_id, to_person_id, amount: amountCents, expense_ids: expense_ids || [] }),
        now
      )
    ];

    if (expense_ids && Array.isArray(expense_ids) && expense_ids.length > 0) {
      for (const expId of expense_ids) {
        statements.push(
          env.DB.prepare(
            "UPDATE am_expenses SET status = 'settled', updated_at = ? WHERE id = ? AND owner_user_id = ?"
          ).bind(now, expId, userId)
        );
      }
    } else {
      // Auto mark unsettled expenses involving these two parties as settled
      statements.push(
        env.DB.prepare(
          `UPDATE am_expenses SET status = 'settled', updated_at = ?
           WHERE owner_user_id = ? AND status = 'unsettled'
           AND (
             (payer_person_id = ? AND id IN (SELECT expense_id FROM am_expense_participants WHERE person_id = ?))
             OR
             (payer_person_id = ? AND id IN (SELECT expense_id FROM am_expense_participants WHERE person_id = ?))
           )`
        ).bind(now, userId, from_person_id, to_person_id, to_person_id, from_person_id)
      );
    }

    await env.DB.batch(statements);

    // Auto-prune settled history (Retain only latest 5 settled records & settlements)
    await autoPruneResolvedHistory(env, userId);

    return successResponse({ id, message: '结算还款记录已保存' });
  }

  // POST /api/advancemanager/cleanup - Explicit Clean Up of Settled Records (Retain latest 5)
  if (method === 'POST' && path === '/api/advancemanager/cleanup') {
    const prunedCount = await autoPruneResolvedHistory(env, userId);
    return successResponse({ message: '已清理历史已结账单，仅保留最新 5 条作为回溯记录', pruned: prunedCount });
  }

  // -------------------------------------------------------------------
  // 5. CATEGORIES & PROJECTS
  // -------------------------------------------------------------------
  if (method === 'GET' && path === '/api/advancemanager/categories') {
    const catsRes = await env.DB.prepare(
      'SELECT * FROM am_categories WHERE owner_user_id = ? OR owner_user_id = "system" ORDER BY sort_order ASC, name ASC'
    ).bind(userId).all();
    return successResponse(catsRes.results || []);
  }

  if (method === 'GET' && path === '/api/advancemanager/projects') {
    const projRes = await env.DB.prepare(
      'SELECT * FROM am_projects WHERE owner_user_id = ? ORDER BY created_at DESC'
    ).bind(userId).all();
    return successResponse(projRes.results || []);
  }

  if (method === 'POST' && path === '/api/advancemanager/projects') {
    const body = await request.json().catch(() => null);
    if (!body || !body.name || !body.name.trim()) {
      return failureResponse('VALIDATION_ERROR', '项目名称不能为空');
    }
    const id = 'proj_' + generateUUID().slice(0, 12);
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO am_projects (id, owner_user_id, name, description, start_date, end_date, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`
    ).bind(
      id,
      userId,
      body.name.trim(),
      body.description ? body.description.trim() : null,
      body.start_date || null,
      body.end_date || null,
      now,
      now
    ).run();

    return successResponse({ id, name: body.name.trim() });
  }

  // GET /api/advancemanager/projects/:id - Project Detail & Activity Settlement Report
  const projectIdMatch = path.match(/^\/api\/advancemanager\/projects\/([a-zA-Z0-9_-]+)$/);
  if (method === 'GET' && projectIdMatch) {
    const projId = projectIdMatch[1];
    const project = await env.DB.prepare(
      'SELECT * FROM am_projects WHERE id = ? AND owner_user_id = ?'
    ).bind(projId, userId).first();

    if (!project) return failureResponse('NOT_FOUND', '未找到指定活动项目');

    const expensesRes = await env.DB.prepare(
      `SELECT e.*, p.name AS payer_name
       FROM am_expenses e
       LEFT JOIN am_persons p ON e.payer_person_id = p.id
       WHERE e.project_id = ? AND e.owner_user_id = ? AND e.status != 'cancelled'
       ORDER BY e.transaction_date DESC`
    ).bind(projId, userId).all();
    const rawExpenses = expensesRes.results || [];

    const expIds = rawExpenses.map(e => e.id);
    let participants = [];
    if (expIds.length > 0) {
      const placeholders = expIds.map(() => '?').join(',');
      const partsRes = await env.DB.prepare(
        `SELECT ep.*, p.name AS person_name
         FROM am_expense_participants ep
         LEFT JOIN am_persons p ON ep.person_id = p.id
         WHERE ep.expense_id IN (${placeholders})`
      ).bind(...expIds).all();
      participants = partsRes.results || [];
    }

    const partMap = {};
    for (const p of participants) {
      if (!partMap[p.expense_id]) partMap[p.expense_id] = [];
      partMap[p.expense_id].push(p);
    }
    const expenses = rawExpenses.map(e => ({ ...e, participants: partMap[e.id] || [] }));

    const totalProjectCost = expenses.reduce((sum, e) => sum + e.total_amount, 0);

    return successResponse({
      project,
      totalProjectCost,
      expenses
    });
  }

  return failureResponse('NOT_FOUND', '未找到 Advance Manager API 路由', 404);
}
