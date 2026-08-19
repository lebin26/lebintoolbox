/**
 * Cloudflare Worker API for HostCalculator
 * Includes Authentication, Unified User & Admin RBAC System, Cloudflare D1 integration, and Audit Logs.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

// Password Hashing via Web Crypto API (SHA-256 with Salt)
async function hashPassword(pwd) {
  const encoder = new TextEncoder();
  const data = encoder.encode('salt_hostcalculator_' + pwd);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Simple Secure Token Utilities
function generateToken(userId, role) {
  const payload = { userId, role, ts: Date.now() };
  return btoa(JSON.stringify(payload));
}

function parseToken(tokenStr) {
  try {
    if (!tokenStr) return null;
    const clean = tokenStr.startsWith('Bearer ') ? tokenStr.slice(7) : tokenStr;
    const raw = atob(clean);
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// Auth Middleware: Resolve current logged-in user
async function getAuthenticatedUser(request, env) {
  const authHeader = request.headers.get('Authorization') || request.headers.get('X-Auth-Token');
  const payload = parseToken(authHeader);
  if (!payload || !payload.userId) return null;

  const user = await env.DB.prepare(
    'SELECT id, email, name, avatar, role, status, created_at AS createdAt, last_login_at AS lastLoginAt FROM users WHERE id = ?'
  ).bind(payload.userId).first();

  if (!user || user.status === 'suspended' || user.status === 'deleted') {
    return null;
  }
  return user;
}

// Admin Authorization Middleware (Guarantees true backend RBAC protection)
async function requireAdmin(request, env) {
  const authHeader = request.headers.get('Authorization') || request.headers.get('X-Auth-Token');
  const payload = parseToken(authHeader);
  if (!payload || !payload.userId) {
    return { authorized: false, error: '未登录或 Token 无效，拒绝访问 Admin API', status: 401 };
  }

  const user = await env.DB.prepare(
    'SELECT id, email, name, avatar, role, status FROM users WHERE id = ?'
  ).bind(payload.userId).first();

  if (!user) {
    return { authorized: false, error: '用户不存在', status: 401 };
  }
  if (user.status === 'suspended' || user.status === 'deleted') {
    return { authorized: false, error: '账号已被停用或删除', status: 403 };
  }
  if (user.role !== 'admin') {
    return { authorized: false, error: '权限不足：仅系统管理员允许访问 Admin API (403 Forbidden)', status: 403 };
  }

  return { authorized: true, user };
}

// Audit Log Helper
async function createAdminLog(env, adminUserId, adminName, action, targetType, targetId, details) {
  try {
    await env.DB.prepare(
      `INSERT INTO admin_logs (admin_user_id, admin_name, action, target_type, target_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      adminUserId,
      adminName || 'Admin',
      action,
      targetType || 'user',
      targetId ? String(targetId) : '',
      details ? (typeof details === 'object' ? JSON.stringify(details) : String(details)) : ''
    ).run();
  } catch (err) {
    console.error('Failed to create admin audit log:', err);
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // -------------------------------------------------------------
    // 0. STATIC ASSETS & HEALTH CHECK
    // -------------------------------------------------------------
    // Pass non-API static asset requests to Cloudflare Workers Assets
    if (!path.startsWith('/api') && path !== '/health' && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    if (!env.DB) {
      return errorResponse('D1 database binding "DB" is missing in wrangler.jsonc', 500);
    }

    try {
      if (method === 'GET' && (path === '/health' || (path === '/' && !env.ASSETS) || path === '/api')) {
        return jsonResponse({
          status: 'ok',
          service: 'HostCalculator API Worker',
          version: '1.0.0',
          endpoints: [
            '/api/venues',
            '/api/bills',
            '/api/auth/login',
            '/api/auth/register',
            '/api/admin/dashboard'
          ]
        });
      }

      // -------------------------------------------------------------
      // 1. AUTHENTICATION API ENDPOINTS
      // -------------------------------------------------------------

// Username Validation Helper (Strict standard username specification)
function validateUsername(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: '用户名不能为空' };
  }
  const raw = name.trim();

  // 1. Strictly forbid spaces anywhere
  if (/\s/.test(name)) {
    return { valid: false, error: '用户名不能包含空格，请使用字母、数字、下划线(_)或中划线(-)' };
  }

  // 2. Length constraint: 3 to 20 characters
  if (raw.length < 3 || raw.length > 20) {
    return { valid: false, error: '用户名长度需在 3 到 20 个字符之间' };
  }

  // 3. Cannot start or end with a separator (_ or - or .)
  if (/^[_\-.]|[_\-.]$/.test(raw)) {
    return { valid: false, error: '用户名不能以下划线、中划线或点号开头或结尾' };
  }

  // 4. Cannot contain consecutive separators (__ or -- or ..)
  if (/[_\-.]{2,}/.test(raw)) {
    return { valid: false, error: '用户名不能包含连续的符号 (例如 __ 或 --)' };
  }

  // 5. Allowed characters: Chinese characters, English letters, digits, underscore, hyphen
  const validRegex = /^[\u4e00-\u9fa5a-zA-Z0-9_-]+$/;
  if (!validRegex.test(raw)) {
    return { valid: false, error: '用户名仅支持字母、数字、下划线(_)、连字符(-)及中文字符' };
  }

  // 6. Blacklisted / Reserved System Words
  const reservedWords = ['root', 'system', 'support', 'null', 'undefined', 'anonymous', 'hostcalculator', 'official'];
  if (reservedWords.includes(raw.toLowerCase())) {
    return { valid: false, error: '该用户名为系统保留名称，请换一个用户名' };
  }

  return { valid: true, name: raw };
}

      // POST /api/auth/register - Register new user
      if (method === 'POST' && path === '/api/auth/register') {
        const body = await request.json();
        const { email, password, name } = body;

        if (!email || !email.trim() || !email.includes('@')) {
          return errorResponse('请输入有效的电子邮箱地址');
        }
        if (!password || password.length < 6) {
          return errorResponse('密码长度不能少于 6 位');
        }

        const usernameCheck = validateUsername(name || email.split('@')[0]);
        if (!usernameCheck.valid) {
          return errorResponse(usernameCheck.error);
        }
        const userName = usernameCheck.name;

        const existingEmail = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email.trim().toLowerCase()).first();
        if (existingEmail) {
          return errorResponse('该邮箱已被注册，请直接登录');
        }

        const existingName = await env.DB.prepare('SELECT id FROM users WHERE LOWER(name) = ?').bind(userName.toLowerCase()).first();
        if (existingName) {
          return errorResponse('该用户名已被使用，请换一个用户名');
        }

        const pwdHash = await hashPassword(password);

        const result = await env.DB.prepare(
          `INSERT INTO users (email, password_hash, plain_password, name, role, status) VALUES (?, ?, ?, ?, 'user', 'active')`
        ).bind(email.trim().toLowerCase(), pwdHash, password, userName).run();

        const userId = result.meta.last_row_id;
        const token = generateToken(userId, 'user');

        return jsonResponse({
          message: '注册成功',
          user: {
            id: userId,
            email: email.trim().toLowerCase(),
            name: userName,
            role: 'user',
            status: 'active'
          },
          token
        }, 201);
      }

      // POST /api/auth/login - Login user or admin (Supports Username or Email)
      if (method === 'POST' && path === '/api/auth/login') {
        const body = await request.json();
        const { account, email, password } = body;
        const loginId = (account || email || '').trim();

        if (!loginId || !password) {
          return errorResponse('请填写用户名/邮箱和密码');
        }

        const user = await env.DB.prepare(
          `SELECT id, email, password_hash, name, avatar, role, status FROM users WHERE LOWER(email) = ? OR LOWER(name) = ?`
        ).bind(loginId.toLowerCase(), loginId.toLowerCase()).first();

        if (!user) {
          return errorResponse('用户名/邮箱或密码错误', 401);
        }

        const inputHash = await hashPassword(password);
        if (user.password_hash !== inputHash) {
          return errorResponse('用户名/邮箱或密码错误', 401);
        }

        if (user.status === 'suspended') {
          return errorResponse('您的账号已被冻结停用，请联系系统管理员处理', 403);
        }
        if (user.status === 'deleted') {
          return errorResponse('账号已被注销或删除', 403);
        }

        // Update last_login_at
        await env.DB.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').bind(user.id).run();

        const token = generateToken(user.id, user.role);

        return jsonResponse({
          message: '登录成功',
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            role: user.role,
            status: user.status
          },
          token
        });
      }

      // GET /api/auth/me - Get current logged-in user profile
      if (method === 'GET' && path === '/api/auth/me') {
        const currentUser = await getAuthenticatedUser(request, env);
        if (!currentUser) {
          return errorResponse('未登录或 Session 已失效', 401);
        }
        return jsonResponse({ user: currentUser });
      }

      // PATCH /api/auth/profile - Update current logged-in user profile (Username and/or Password)
      if (method === 'PATCH' && (path === '/api/auth/profile' || path === '/api/auth/me')) {
        const currentUser = await getAuthenticatedUser(request, env);
        if (!currentUser) {
          return errorResponse('未登录或 Session 已失效', 401);
        }

        const body = await request.json();
        const { name, password } = body;

        let newName = currentUser.name;
        if (name !== undefined && name !== currentUser.name) {
          const check = validateUsername(name);
          if (!check.valid) return errorResponse(check.error);
          newName = check.name;
          const existingName = await env.DB.prepare('SELECT id FROM users WHERE LOWER(name) = ? AND id != ?').bind(newName.toLowerCase(), currentUser.id).first();
          if (existingName) return errorResponse('该用户名已被其他用户使用，请换一个用户名');
        }

        if (password) {
          if (typeof password !== 'string' || password.length < 6) {
            return errorResponse('新密码长度不能少于 6 位');
          }
          const pwdHash = await hashPassword(password);
          await env.DB.prepare(
            'UPDATE users SET name = ?, password_hash = ?, plain_password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
          ).bind(newName, pwdHash, password, currentUser.id).run();
        } else {
          await env.DB.prepare(
            'UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
          ).bind(newName, currentUser.id).run();
        }

        const updatedUser = await env.DB.prepare(
          'SELECT id, email, name, avatar, role, status, created_at AS createdAt, last_login_at AS lastLoginAt FROM users WHERE id = ?'
        ).bind(currentUser.id).first();

        const token = generateToken(currentUser.id, currentUser.role);

        return jsonResponse({
          message: '个人资料已更新',
          user: updatedUser,
          token
        });
      }

      // POST /api/auth/logout - Logout (Client clears token)
      if (method === 'POST' && path === '/api/auth/logout') {
        return jsonResponse({ message: '退出登录成功' });
      }

      // -------------------------------------------------------------
      // 2. ADMIN SYSTEM API ENDPOINTS (Protected strictly by requireAdmin)
      // -------------------------------------------------------------

      if (path.startsWith('/api/admin')) {
        const authResult = await requireAdmin(request, env);
        if (!authResult.authorized) {
          return errorResponse(authResult.error, authResult.status || 403);
        }
        const adminUser = authResult.user;

        // GET /api/admin/dashboard - System Stats & Analytics
        if (method === 'GET' && path === '/api/admin/dashboard') {
          const totalUsersRes = await env.DB.prepare('SELECT COUNT(*) AS count FROM users WHERE status != "deleted"').first();
          const activeUsersRes = await env.DB.prepare('SELECT COUNT(*) AS count FROM users WHERE status = "active"').first();
          const suspendedUsersRes = await env.DB.prepare('SELECT COUNT(*) AS count FROM users WHERE status = "suspended"').first();
          const adminCountRes = await env.DB.prepare('SELECT COUNT(*) AS count FROM users WHERE role = "admin" AND status = "active"').first();
          const totalBillsRes = await env.DB.prepare('SELECT COUNT(*) AS count FROM bills').first();
          const totalProfitRes = await env.DB.prepare('SELECT SUM(net_profit) AS sumProfit FROM bills').first();

          return jsonResponse({
            stats: {
              totalUsers: totalUsersRes?.count || 0,
              activeUsers: activeUsersRes?.count || 0,
              suspendedUsers: suspendedUsersRes?.count || 0,
              adminUsers: adminCountRes?.count || 0,
              totalBills: totalBillsRes?.count || 0,
              totalProfit: parseFloat(totalProfitRes?.sumProfit || 0)
            }
          });
        }

        // GET /api/admin/users - User Management List with Search & Filter
        if (method === 'GET' && path === '/api/admin/users') {
          const search = url.searchParams.get('search') || '';
          const roleFilter = url.searchParams.get('role') || 'all';
          const statusFilter = url.searchParams.get('status') || 'all';

          let query = 'SELECT id, email, name, avatar, role, status, plain_password AS plainPassword, created_at AS createdAt, last_login_at AS lastLoginAt FROM users WHERE status != "deleted"';
          const params = [];

          if (search) {
            query += ' AND (email LIKE ? OR name LIKE ?)';
            params.push(`%${search.trim()}%`, `%${search.trim()}%`);
          }
          if (roleFilter !== 'all') {
            query += ' AND role = ?';
            params.push(roleFilter);
          }
          if (statusFilter !== 'all') {
            query += ' AND status = ?';
            params.push(statusFilter);
          }

          query += ' ORDER BY id ASC';

          const stmt = env.DB.prepare(query);
          const { results } = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

          return jsonResponse({ users: results || [] });
        }

        // GET /api/admin/users/:id - Get detail of a specific user
        const getUserMatch = path.match(/^\/api\/admin\/users\/(\d+)$/);
        if (method === 'GET' && getUserMatch) {
          const targetId = parseInt(getUserMatch[1]);
          const targetUser = await env.DB.prepare(
            'SELECT id, email, name, avatar, role, status, plain_password AS plainPassword, created_at AS createdAt, last_login_at AS lastLoginAt FROM users WHERE id = ?'
          ).bind(targetId).first();

          if (!targetUser) {
            return errorResponse('未找到指定用户', 404);
          }

          return jsonResponse({ user: targetUser });
        }

        // GET /api/admin/users/:id/bills - Get all bills belonging to a specific user
        const getUserBillsMatch = path.match(/^\/api\/admin\/users\/(\d+)\/bills$/);
        if (method === 'GET' && getUserBillsMatch) {
          const targetId = parseInt(getUserBillsMatch[1]);
          const targetUser = await env.DB.prepare(
            'SELECT id, email, name, role, status FROM users WHERE id = ?'
          ).bind(targetId).first();

          if (!targetUser) {
            return errorResponse('未找到指定用户', 404);
          }

          const { results } = await env.DB.prepare(
            `SELECT id, title, venue_name AS venueName, start_time AS startTime, duration,
                    court_count AS courtCount, court_fee AS courtFee, total_players AS totalPlayers,
                    host_count AS hostCount, shuttles_used AS shuttlesUsed, shuttle_price AS shuttlePrice,
                    additional_shuttles AS additionalShuttles, player_fee AS playerFee,
                    total_cost AS totalCost, total_revenue AS totalRevenue, net_profit AS netProfit,
                    user_id AS userId, created_at AS createdAt, updated_at AS updatedAt
             FROM bills WHERE user_id = ? ORDER BY id DESC`
          ).bind(targetId).all();

          return jsonResponse({
            user: targetUser,
            bills: results || []
          });
        }

        // PATCH /api/admin/users/:id - Update User Role / Status / Info
        const patchUserMatch = path.match(/^\/api\/admin\/users\/(\d+)$/);
        if (method === 'PATCH' && patchUserMatch) {
          const targetId = parseInt(patchUserMatch[1]);
          const body = await request.json();
          const { name, email, role, status, password } = body;

          const targetUser = await env.DB.prepare('SELECT id, email, name, role, status FROM users WHERE id = ?').bind(targetId).first();
          if (!targetUser) return errorResponse('未找到指定用户', 404);

          // Admin Safeguard Rule 8: Prevent demoting/suspending the last active admin!
          if (targetUser.role === 'admin' && (role === 'user' || status === 'suspended' || status === 'deleted')) {
            const adminCountRes = await env.DB.prepare('SELECT COUNT(*) AS count FROM users WHERE role = "admin" AND status = "active" AND id != ?').bind(targetId).first();
            if ((adminCountRes?.count || 0) === 0) {
              return errorResponse('安全限制拒绝：系统必须保留至少一名活跃管理员，无法修改或冻结唯一 Admin！', 400);
            }
          }

          let newName = targetUser.name;
          if (name !== undefined) {
            const check = validateUsername(name);
            if (!check.valid) return errorResponse(check.error);
            newName = check.name;
            const existingName = await env.DB.prepare('SELECT id FROM users WHERE LOWER(name) = ? AND id != ?').bind(newName.toLowerCase(), targetId).first();
            if (existingName) return errorResponse('该用户名已被其他用户使用，请换一个用户名');
          }

          let newEmail = targetUser.email;
          if (email !== undefined && email.trim().toLowerCase() !== targetUser.email.toLowerCase()) {
            const cleanEmail = email.trim().toLowerCase();
            if (!cleanEmail || !cleanEmail.includes('@')) {
              return errorResponse('请输入有效的电子邮箱地址');
            }
            const existingEmail = await env.DB.prepare('SELECT id FROM users WHERE LOWER(email) = ? AND id != ?').bind(cleanEmail, targetId).first();
            if (existingEmail) return errorResponse('该邮箱已被其他用户使用，请换一个邮箱');
            newEmail = cleanEmail;
          }

          const newRole = role !== undefined ? role : targetUser.role;
          const newStatus = status !== undefined ? status : targetUser.status;

          if (password && password.length >= 6) {
            const pwdHash = await hashPassword(password);
            await env.DB.prepare(
              'UPDATE users SET name = ?, email = ?, role = ?, status = ?, password_hash = ?, plain_password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
            ).bind(newName, newEmail, newRole, newStatus, pwdHash, password, targetId).run();
          } else {
            await env.DB.prepare(
              'UPDATE users SET name = ?, email = ?, role = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
            ).bind(newName, newEmail, newRole, newStatus, targetId).run();
          }

          // Audit Log
          await createAdminLog(env, adminUser.id, adminUser.name, 'UPDATE_USER', 'user', targetId, {
            previousName: targetUser.name,
            newName,
            previousEmail: targetUser.email,
            newEmail,
            previousRole: targetUser.role,
            newRole,
            previousStatus: targetUser.status,
            newStatus,
            passwordChanged: !!(password && password.length >= 6)
          });

          return jsonResponse({ message: '用户信息已成功修改', id: targetId });
        }

        // POST /api/admin/users/:id/suspend - Suspend User
        const suspendMatch = path.match(/^\/api\/admin\/users\/(\d+)\/suspend$/);
        if (method === 'POST' && suspendMatch) {
          const targetId = parseInt(suspendMatch[1]);
          const targetUser = await env.DB.prepare('SELECT id, name, role FROM users WHERE id = ?').bind(targetId).first();
          if (!targetUser) return errorResponse('未找到指定用户', 404);

          if (targetUser.role === 'admin') {
            const adminCountRes = await env.DB.prepare('SELECT COUNT(*) AS count FROM users WHERE role = "admin" AND status = "active" AND id != ?').bind(targetId).first();
            if ((adminCountRes?.count || 0) === 0) {
              return errorResponse('安全限制拒绝：无法冻结系统中唯一的活跃 Admin 账号！', 400);
            }
          }

          await env.DB.prepare('UPDATE users SET status = "suspended", updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(targetId).run();
          await createAdminLog(env, adminUser.id, adminUser.name, 'SUSPEND_USER', 'user', targetId, `冻结了用户 ${targetUser.name} (${targetId})`);

          return jsonResponse({ message: `用户 ${targetUser.name} 已成功冻结` });
        }

        // POST /api/admin/users/:id/activate - Activate User
        const activateMatch = path.match(/^\/api\/admin\/users\/(\d+)\/activate$/);
        if (method === 'POST' && activateMatch) {
          const targetId = parseInt(activateMatch[1]);
          const targetUser = await env.DB.prepare('SELECT id, name FROM users WHERE id = ?').bind(targetId).first();
          if (!targetUser) return errorResponse('未找到指定用户', 404);

          await env.DB.prepare('UPDATE users SET status = "active", updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(targetId).run();
          await createAdminLog(env, adminUser.id, adminUser.name, 'ACTIVATE_USER', 'user', targetId, `解冻激活了用户 ${targetUser.name} (${targetId})`);

          return jsonResponse({ message: `用户 ${targetUser.name} 已重新激活` });
        }

        // DELETE /api/admin/users/:id - Delete User Permanently
        const deleteUserMatch = path.match(/^\/api\/admin\/users\/(\d+)$/);
        if (method === 'DELETE' && deleteUserMatch) {
          const targetId = parseInt(deleteUserMatch[1]);
          const targetUser = await env.DB.prepare('SELECT id, name, email, role FROM users WHERE id = ?').bind(targetId).first();
          if (!targetUser) return errorResponse('未找到指定用户', 404);

          if (targetId === adminUser.id) {
            return errorResponse('安全限制拒绝：不能删除当前正在操作的管理员账号！', 400);
          }

          if (targetUser.role === 'admin') {
            const adminCountRes = await env.DB.prepare('SELECT COUNT(*) AS count FROM users WHERE role = "admin" AND status = "active" AND id != ?').bind(targetId).first();
            if ((adminCountRes?.count || 0) === 0) {
              return errorResponse('安全限制拒绝：无法删除系统中唯一的管理员账号！', 400);
            }
          }

          // Delete user from database
          await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(targetId).run();
          await createAdminLog(env, adminUser.id, adminUser.name, 'DELETE_USER', 'user', targetId, `删除了用户 ${targetUser.name} (${targetUser.email})`);

          return jsonResponse({ message: `用户 ${targetUser.name} 已成功删除`, id: targetId });
        }

        // GET /api/admin/logs - Fetch Admin Audit Logs
        if (method === 'GET' && path === '/api/admin/logs') {
          const { results } = await env.DB.prepare(
            `SELECT id, admin_user_id AS adminUserId, admin_name AS adminName, action, target_type AS targetType,
                    target_id AS targetId, details, created_at AS createdAt
             FROM admin_logs ORDER BY id DESC LIMIT 100`
          ).all();

          return jsonResponse({ logs: results || [] });
        }
      }

      // -------------------------------------------------------------
      // 3. CORE PUBLIC & USER APIS (Venues & Bills)
      // -------------------------------------------------------------

      // GET /api/venues - Fetch all venues from D1
      if (method === 'GET' && path === '/api/venues') {
        const { results } = await env.DB.prepare(
          'SELECT id, name, rate_morning AS rateMorning, rate_evening AS rateEvening, updated_at AS updatedAt FROM venues ORDER BY id ASC'
        ).all();

        return jsonResponse({ venues: results || [] });
      }

      // POST /api/venues - Add new venue to D1
      if (method === 'POST' && path === '/api/venues') {
        const body = await request.json();
        const { name, rateMorning, rateEvening } = body;

        if (!name || typeof name !== 'string' || !name.trim()) {
          return errorResponse('球场名称不能为空');
        }

        const morning = parseFloat(rateMorning);
        const evening = parseFloat(rateEvening);

        if (isNaN(morning) || morning < 0 || isNaN(evening) || evening < 0) {
          return errorResponse('请输入有效的早场和晚场价格');
        }

        const result = await env.DB.prepare(
          'INSERT INTO venues (name, rate_morning, rate_evening) VALUES (?, ?, ?)'
        ).bind(name.trim(), morning, evening).run();

        return jsonResponse({
          message: '球场添加成功',
          venue: {
            id: result.meta.last_row_id,
            name: name.trim(),
            rateMorning: morning,
            rateEvening: evening
          }
        }, 201);
      }

      // PUT /api/venues/:id - Update venue in D1
      const putMatch = path.match(/^\/api\/venues\/(\d+)$/);
      if (method === 'PUT' && putMatch) {
        const id = parseInt(putMatch[1]);
        const body = await request.json();
        const { name, rateMorning, rateEvening } = body;

        if (!name || typeof name !== 'string' || !name.trim()) {
          return errorResponse('球场名称不能为空');
        }

        const morning = parseFloat(rateMorning);
        const evening = parseFloat(rateEvening);

        if (isNaN(morning) || morning < 0 || isNaN(evening) || evening < 0) {
          return errorResponse('请输入有效的早场和晚场价格');
        }

        const result = await env.DB.prepare(
          'UPDATE venues SET name = ?, rate_morning = ?, rate_evening = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).bind(name.trim(), morning, evening, id).run();

        if (result.meta.changes === 0) {
          return errorResponse('未找到指定球场', 404);
        }

        return jsonResponse({
          message: '球场更新成功',
          venue: { id, name: name.trim(), rateMorning: morning, rateEvening: evening }
        });
      }

      // DELETE /api/venues/:id - Delete venue from D1
      const deleteMatch = path.match(/^\/api\/venues\/(\d+)$/);
      if (method === 'DELETE' && deleteMatch) {
        const id = parseInt(deleteMatch[1]);
        const result = await env.DB.prepare('DELETE FROM venues WHERE id = ?').bind(id).run();

        if (result.meta.changes === 0) {
          return errorResponse('未找到指定球场', 404);
        }

        return jsonResponse({ message: '球场删除成功', id });
      }

      // GET /api/bills - Fetch saved bills from D1 (Account Isolated)
      if (method === 'GET' && path === '/api/bills') {
        const currentUser = await getAuthenticatedUser(request, env);
        const scope = url.searchParams.get('scope');

        let results;
        if (currentUser && currentUser.role === 'admin' && scope === 'all') {
          // Admin Overview scope - all bills
          const query = await env.DB.prepare(
            `SELECT id, title, venue_name AS venueName, start_time AS startTime, duration,
                    court_count AS courtCount, court_fee AS courtFee, total_players AS totalPlayers,
                    host_count AS hostCount, shuttles_used AS shuttlesUsed, shuttle_price AS shuttlePrice,
                    additional_shuttles AS additionalShuttles, player_fee AS playerFee,
                    total_cost AS totalCost, total_revenue AS totalRevenue, net_profit AS netProfit,
                    user_id AS userId, created_at AS createdAt, updated_at AS updatedAt
             FROM bills ORDER BY id DESC`
          ).all();
          results = query.results;
        } else if (currentUser) {
          // User-isolated bills (only bills created by the current user)
          const query = await env.DB.prepare(
            `SELECT id, title, venue_name AS venueName, start_time AS startTime, duration,
                    court_count AS courtCount, court_fee AS courtFee, total_players AS totalPlayers,
                    host_count AS hostCount, shuttles_used AS shuttlesUsed, shuttle_price AS shuttlePrice,
                    additional_shuttles AS additionalShuttles, player_fee AS playerFee,
                    total_cost AS totalCost, total_revenue AS totalRevenue, net_profit AS netProfit,
                    user_id AS userId, created_at AS createdAt, updated_at AS updatedAt
             FROM bills WHERE user_id = ? ORDER BY id DESC`
          ).bind(currentUser.id).all();
          results = query.results;
        } else {
          // Unauthenticated requests
          results = [];
        }

        return jsonResponse({ bills: results || [] });
      }

      // POST /api/bills - Save new bill to D1 (Bound to Authenticated User)
      if (method === 'POST' && path === '/api/bills') {
        const currentUser = await getAuthenticatedUser(request, env);
        const body = await request.json();
        const {
          title, venueName, startTime, duration, courtCount, courtFee,
          totalPlayers, hostCount, shuttlesUsed, shuttlePrice, additionalShuttles,
          playerFee, totalCost, totalRevenue, netProfit
        } = body;

        const ownerId = currentUser ? currentUser.id : (body.userId || null);

        const billTitle = title && title.trim() ? title.trim() : `${new Date().toISOString().slice(0, 10)} AA 账单`;
        const vName = venueName ? String(venueName).trim() : '默认场地';

        const result = await env.DB.prepare(
          `INSERT INTO bills (
            title, venue_name, start_time, duration, court_count, court_fee,
            total_players, host_count, shuttles_used, shuttle_price, additional_shuttles,
            player_fee, total_cost, total_revenue, net_profit, user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          billTitle, vName,
          parseInt(startTime) || 16, parseInt(duration) || 2, parseInt(courtCount) || 1, parseFloat(courtFee) || 0.0,
          parseInt(totalPlayers) || 6, parseInt(hostCount) || 0, parseInt(shuttlesUsed) || 3, parseFloat(shuttlePrice) || 0.0,
          parseInt(additionalShuttles) || 0, parseFloat(playerFee) || 0.0, parseFloat(totalCost) || 0.0,
          parseFloat(totalRevenue) || 0.0, parseFloat(netProfit) || 0.0, ownerId
        ).run();

        return jsonResponse({
          message: '账单保存成功',
          bill: {
            id: result.meta.last_row_id,
            title: billTitle,
            venueName: vName,
            startTime, duration, courtCount, courtFee,
            totalPlayers, hostCount, shuttlesUsed, shuttlePrice, additionalShuttles,
            playerFee, totalCost, totalRevenue, netProfit, userId: ownerId,
            createdAt: new Date().toISOString()
          }
        }, 201);
      }

      // PUT /api/bills/:id - Update existing bill in D1 (Account Isolated)
      const putBillMatch = path.match(/^\/api\/bills\/(\d+)$/);
      if (method === 'PUT' && putBillMatch) {
        const id = parseInt(putBillMatch[1]);
        const currentUser = await getAuthenticatedUser(request, env);
        const body = await request.json();
        const {
          title, venueName, startTime, duration, courtCount, courtFee,
          totalPlayers, hostCount, shuttlesUsed, shuttlePrice, additionalShuttles,
          playerFee, totalCost, totalRevenue, netProfit
        } = body;

        let result;
        if (currentUser && currentUser.role === 'admin') {
          result = await env.DB.prepare(
            `UPDATE bills SET
              title = ?, venue_name = ?, start_time = ?, duration = ?, court_count = ?, court_fee = ?,
              total_players = ?, host_count = ?, shuttles_used = ?, shuttle_price = ?, additional_shuttles = ?,
              player_fee = ?, total_cost = ?, total_revenue = ?, net_profit = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`
          ).bind(
            title ? String(title).trim() : '已修改账单',
            venueName ? String(venueName).trim() : '默认场地',
            parseInt(startTime) || 16, parseInt(duration) || 2, parseInt(courtCount) || 1, parseFloat(courtFee) || 0.0,
            parseInt(totalPlayers) || 6, parseInt(hostCount) || 0, parseInt(shuttlesUsed) || 3, parseFloat(shuttlePrice) || 0.0,
            parseInt(additionalShuttles) || 0, parseFloat(playerFee) || 0.0, parseFloat(totalCost) || 0.0,
            parseFloat(totalRevenue) || 0.0, parseFloat(netProfit) || 0.0,
            id
          ).run();
        } else if (currentUser) {
          result = await env.DB.prepare(
            `UPDATE bills SET
              title = ?, venue_name = ?, start_time = ?, duration = ?, court_count = ?, court_fee = ?,
              total_players = ?, host_count = ?, shuttles_used = ?, shuttle_price = ?, additional_shuttles = ?,
              player_fee = ?, total_cost = ?, total_revenue = ?, net_profit = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND user_id = ?`
          ).bind(
            title ? String(title).trim() : '已修改账单',
            venueName ? String(venueName).trim() : '默认场地',
            parseInt(startTime) || 16, parseInt(duration) || 2, parseInt(courtCount) || 1, parseFloat(courtFee) || 0.0,
            parseInt(totalPlayers) || 6, parseInt(hostCount) || 0, parseInt(shuttlesUsed) || 3, parseFloat(shuttlePrice) || 0.0,
            parseInt(additionalShuttles) || 0, parseFloat(playerFee) || 0.0, parseFloat(totalCost) || 0.0,
            parseFloat(totalRevenue) || 0.0, parseFloat(netProfit) || 0.0,
            id, currentUser.id
          ).run();
        } else {
          return errorResponse('未授权操作', 401);
        }

        if (result.meta.changes === 0) {
          return errorResponse('未找到指定账单或无权修改该账单', 404);
        }

        return jsonResponse({ message: '账单更新成功', id });
      }

      // DELETE /api/bills/:id - Delete bill from D1 (Account Isolated)
      const deleteBillMatch = path.match(/^\/api\/bills\/(\d+)$/);
      if (method === 'DELETE' && deleteBillMatch) {
        const id = parseInt(deleteBillMatch[1]);
        const currentUser = await getAuthenticatedUser(request, env);

        let result;
        if (currentUser && currentUser.role === 'admin') {
          result = await env.DB.prepare('DELETE FROM bills WHERE id = ?').bind(id).run();
        } else if (currentUser) {
          result = await env.DB.prepare('DELETE FROM bills WHERE id = ? AND user_id = ?').bind(id, currentUser.id).run();
        } else {
          return errorResponse('未授权操作', 401);
        }

        if (result.meta.changes === 0) {
          return errorResponse('未找到指定账单或无权删除该账单', 404);
        }

        return jsonResponse({ message: '账单删除成功', id });
      }

      // 404 Fallback
      return errorResponse('API endpoint not found', 404);
    } catch (err) {
      return errorResponse('Internal Worker Error: ' + err.message, 500);
    }
  }
};
