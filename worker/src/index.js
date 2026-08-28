/**
 * Cloudflare Worker API for OmniBox (Court Ledger & Financial Overview)
 * Provides standalone REST API for venues, bills, monthly financial overview, and user authentication on Cloudflare D1.
 */

import { handleFinancialRequest } from './financial.js';
import {
  hashPassword,
  generateSalt,
  createToken,
  getAuthenticatedUser,
  logAdminAction,
  ensureUserTableSchema
} from './auth.js';

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

function validateUsername(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  // Alphanumeric, chinese characters, underscores, hyphens, dots, emails (2-50 chars)
  return /^[\w\u4e00-\u9fa5\-.@+]{2,50}$/.test(trimmed);
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // 0. STATIC ASSETS & HEALTH CHECK
    if (!path.startsWith('/api') && path !== '/health' && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    if (!env.DB) {
      return errorResponse('D1 database binding "DB" is missing in wrangler.jsonc', 500);
    }

    // Auto-heal database schema on the fly
    await ensureUserTableSchema(env);

    try {
      if (method === 'GET' && (path === '/health' || (path === '/' && !env.ASSETS) || path === '/api')) {
        return jsonResponse({
          status: 'ok',
          service: 'OmniBox API Worker',
          version: '2.0.0',
          endpoints: [
            '/api/auth/register',
            '/api/auth/login',
            '/api/auth/me',
            '/api/venues',
            '/api/bills',
            '/api/financial/dashboard',
            '/api/financial/platforms',
            '/api/financial/products',
            '/api/financial/months',
            '/api/financial/analytics',
            '/api/financial/templates'
          ]
        });
      }

      // Resolve current authenticated user if token present
      const currentUser = await getAuthenticatedUser(request, env);

      // -------------------------------------------------------------
      // 1. AUTHENTICATION & USER MANAGEMENT API
      // -------------------------------------------------------------

      // POST /api/auth/register
      if (method === 'POST' && path === '/api/auth/register') {
        const body = await request.json();
        const { username, password, nickname } = body;

        if (!validateUsername(username)) {
          return errorResponse('用户名必须为 2-30 位字符（可包含字母、数字、中文、下划线）');
        }

        if (!password || typeof password !== 'string' || password.length < 6) {
          return errorResponse('密码长度至少为 6 位');
        }

        const trimmedUser = username.trim();
        const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(trimmedUser).first();
        if (existing) {
          return errorResponse('该用户名已被注册，请尝试直接登录');
        }

        // Check total users count: first user is automatically 'admin'
        const countResult = await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first();
        const isFirstUser = !countResult || countResult.count === 0;
        const role = isFirstUser ? 'admin' : 'user';

        const salt = generateSalt();
        const passwordHash = await hashPassword(password, salt);
        const userNickname = nickname && nickname.trim() ? nickname.trim() : trimmedUser;

        const defaultApps = JSON.stringify(['courtledger', 'financial']);
        const defaultPerms = JSON.stringify(role === 'admin' 
          ? ['courtledger:create_bill', 'courtledger:delete_bill', 'financial:manage', 'admin:manage']
          : ['courtledger:create_bill', 'courtledger:delete_bill', 'financial:manage']);

        const insertRes = await env.DB.prepare(
          `INSERT INTO users (username, password_hash, salt, role, status, nickname, allowed_apps, app_permissions)
           VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`
        ).bind(trimmedUser, passwordHash, salt, role, userNickname, defaultApps, defaultPerms).run();

        const userId = insertRes.meta.last_row_id;
        const userObj = {
          id: userId,
          username: trimmedUser,
          role,
          status: 'active',
          nickname: userNickname,
          avatarUrl: null,
          allowedApps: ['courtledger', 'financial'],
          appPermissions: JSON.parse(defaultPerms)
        };

        const token = await createToken(userObj, env.JWT_SECRET);

        return jsonResponse({
          message: isFirstUser ? '🎉 欢迎！您已注册为系统首位管理员(Admin)' : '注册成功！',
          user: userObj,
          token
        }, 201);
      }

      // POST /api/auth/login
      if (method === 'POST' && path === '/api/auth/login') {
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
          return errorResponse('请输入用户名和密码');
        }

        const user = await env.DB.prepare(
          'SELECT id, username, password_hash, salt, role, status, nickname, avatar_url AS avatarUrl, allowed_apps AS allowedApps, app_permissions AS appPermissions FROM users WHERE username = ?'
        ).bind(username.trim()).first();

        if (!user) {
          return errorResponse('用户名或密码错误', 401);
        }

        if (user.status !== 'active') {
          return errorResponse('该账号已被冻结或禁用，请联系管理员', 403);
        }

        const computedHash = await hashPassword(password, user.salt);
        if (computedHash !== user.password_hash) {
          return errorResponse('用户名或密码错误', 401);
        }

        const userObj = {
          id: user.id,
          username: user.username,
          role: user.role,
          status: user.status,
          nickname: user.nickname || user.username,
          avatarUrl: user.avatarUrl || null,
          allowedApps: user.allowedApps ? (typeof user.allowedApps === 'string' ? JSON.parse(user.allowedApps) : user.allowedApps) : ['courtledger', 'financial'],
          appPermissions: user.appPermissions ? (typeof user.appPermissions === 'string' ? JSON.parse(user.appPermissions) : user.appPermissions) : []
        };

        const token = await createToken(userObj, env.JWT_SECRET);

        return jsonResponse({
          message: '登录成功',
          user: userObj,
          token
        });
      }

      // GET /api/auth/me
      if (method === 'GET' && path === '/api/auth/me') {
        if (!currentUser) {
          return jsonResponse({ user: null, authenticated: false });
        }
        return jsonResponse({ user: currentUser, authenticated: true });
      }

      // POST /api/auth/logout
      if (method === 'POST' && path === '/api/auth/logout') {
        return jsonResponse({ message: '已安全登出' });
      }

      // PUT /api/auth/profile
      if (method === 'PUT' && path === '/api/auth/profile') {
        if (!currentUser) return errorResponse('请先登录', 401);
        const body = await request.json();
        const { nickname, avatarUrl, oldPassword, newPassword } = body;

        let passUpdateSql = '';
        const params = [];

        if (nickname !== undefined) {
          params.push(nickname ? nickname.trim() : currentUser.username);
        } else {
          params.push(currentUser.nickname);
        }

        if (avatarUrl !== undefined) {
          params.push(avatarUrl ? avatarUrl.trim() : null);
        } else {
          params.push(currentUser.avatarUrl);
        }

        if (newPassword) {
          if (!oldPassword) return errorResponse('修改密码时必须输入当前旧密码');
          if (newPassword.length < 6) return errorResponse('新密码长度不能少于 6 位');

          const userRecord = await env.DB.prepare('SELECT password_hash, salt FROM users WHERE id = ?').bind(currentUser.id).first();
          const oldHash = await hashPassword(oldPassword, userRecord.salt);
          if (oldHash !== userRecord.password_hash) {
            return errorResponse('当前旧密码验证不正确', 400);
          }

          const newSalt = generateSalt();
          const newHash = await hashPassword(newPassword, newSalt);
          params.push(newHash, newSalt);
          passUpdateSql = ', password_hash = ?, salt = ?';
        }

        params.push(currentUser.id);

        await env.DB.prepare(
          `UPDATE users SET nickname = ?, avatar_url = ? ${passUpdateSql}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).bind(...params).run();

        const updatedUser = await env.DB.prepare(
          'SELECT id, username, role, status, nickname, avatar_url AS avatarUrl, allowed_apps AS allowedApps, app_permissions AS appPermissions FROM users WHERE id = ?'
        ).bind(currentUser.id).first();

        const userObj = {
          id: updatedUser.id,
          username: updatedUser.username,
          role: updatedUser.role,
          status: updatedUser.status,
          nickname: updatedUser.nickname || updatedUser.username,
          avatarUrl: updatedUser.avatarUrl || null,
          allowedApps: updatedUser.allowedApps ? (typeof updatedUser.allowedApps === 'string' ? JSON.parse(updatedUser.allowedApps) : updatedUser.allowedApps) : ['courtledger', 'financial'],
          appPermissions: updatedUser.appPermissions ? (typeof updatedUser.appPermissions === 'string' ? JSON.parse(updatedUser.appPermissions) : updatedUser.appPermissions) : []
        };

        const token = await createToken(userObj, env.JWT_SECRET);
        return jsonResponse({ message: '个人资料已更新', user: userObj, token });
      }

      // -------------------------------------------------------------
      // 2. ADMIN USER & AUDIT LOGS API (Admin Role Only)
      // -------------------------------------------------------------

      // GET /api/admin/users
      if (method === 'GET' && path === '/api/admin/users') {
        if (!currentUser || currentUser.role !== 'admin') {
          return errorResponse('⛔ 权限不足：仅管理员可访问用户管理', 403);
        }

        const { results } = await env.DB.prepare(
          'SELECT id, username, role, status, nickname, avatar_url AS avatarUrl, allowed_apps AS allowedApps, app_permissions AS appPermissions, created_at AS createdAt, updated_at AS updatedAt FROM users ORDER BY id ASC'
        ).all();

        const users = (results || []).map(u => ({
          ...u,
          allowedApps: u.allowedApps ? (typeof u.allowedApps === 'string' ? JSON.parse(u.allowedApps) : u.allowedApps) : ['courtledger', 'financial'],
          appPermissions: u.appPermissions ? (typeof u.appPermissions === 'string' ? JSON.parse(u.appPermissions) : u.appPermissions) : []
        }));

        return jsonResponse({ users });
      }

      // PUT /api/admin/users/:id
      const putAdminUserMatch = path.match(/^\/api\/admin\/users\/(\d+)$/);
      if (method === 'PUT' && putAdminUserMatch) {
        if (!currentUser || currentUser.role !== 'admin') {
          return errorResponse('⛔ 权限不足：仅管理员可修改用户权限', 403);
        }

        const targetId = parseInt(putAdminUserMatch[1], 10);
        const body = await request.json();
        const { role, status, allowedApps, appPermissions, resetPassword } = body;

        const targetUser = await env.DB.prepare('SELECT id, username, role, status FROM users WHERE id = ?').bind(targetId).first();
        if (!targetUser) return errorResponse('未找到指定用户', 404);

        // Vibe Rule 12: Never allow the system to have zero active Admins
        if (targetUser.role === 'admin' && (role === 'user' || status === 'disabled')) {
          const adminCountRes = await env.DB.prepare('SELECT COUNT(*) AS count FROM users WHERE role = "admin" AND status = "active"').first();
          if (adminCountRes && adminCountRes.count <= 1) {
            return errorResponse('操作失败：系统必须保留至少一名活跃管理员，无法降级或禁用最后一名管理员！', 400);
          }
        }

        let passSql = '';
        const params = [];

        const newRole = role || targetUser.role;
        const newStatus = status || targetUser.status;
        params.push(newRole, newStatus);

        if (allowedApps !== undefined) {
          params.push(JSON.stringify(allowedApps));
        } else {
          params.push(JSON.stringify(['courtledger', 'financial']));
        }

        if (appPermissions !== undefined) {
          params.push(JSON.stringify(appPermissions));
        } else {
          params.push(JSON.stringify([]));
        }

        if (resetPassword) {
          const newSalt = generateSalt();
          const newHash = await hashPassword(resetPassword, newSalt);
          passSql = ', password_hash = ?, salt = ?';
          params.push(newHash, newSalt);
        }

        params.push(targetId);

        await env.DB.prepare(
          `UPDATE users SET role = ?, status = ?, allowed_apps = ?, app_permissions = ? ${passSql}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).bind(...params).run();

        // Audit Log
        await logAdminAction(env, currentUser.id, 'UPDATE_USER', targetId, {
          targetUsername: targetUser.username,
          changes: { role: newRole, status: newStatus, allowedApps, appPermissions, passwordReset: !!resetPassword }
        });

        return jsonResponse({ message: `用户 ${targetUser.username} 信息已成功更新`, userId: targetId });
      }

      // GET /api/admin/logs
      if (method === 'GET' && path === '/api/admin/logs') {
        if (!currentUser || currentUser.role !== 'admin') {
          return errorResponse('⛔ 权限不足：仅管理员可查看审计日志', 403);
        }

        const { results } = await env.DB.prepare(`
          SELECT l.id, l.action, l.details, l.created_at AS createdAt,
                 u.username AS adminUsername, tu.username AS targetUsername
          FROM admin_logs l
          LEFT JOIN users u ON l.admin_id = u.id
          LEFT JOIN users tu ON l.target_user_id = tu.id
          ORDER BY l.id DESC LIMIT 100
        `).all();

        return jsonResponse({ logs: results || [] });
      }

      // -------------------------------------------------------------
      // 3. MONTHLY FINANCIAL OVERVIEW SUB-APP (Sub-App #2)
      // -------------------------------------------------------------
      if (path.startsWith('/api/financial')) {
        return await handleFinancialRequest(request, env, path, method, currentUser);
      }

      // -------------------------------------------------------------
      // 4. VENUES API ENDPOINTS (Public / Shared)
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
      const putVenueMatch = path.match(/^\/api\/venues\/(\d+)$/);
      if (method === 'PUT' && putVenueMatch) {
        const id = parseInt(putVenueMatch[1], 10);
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
      const deleteVenueMatch = path.match(/^\/api\/venues\/(\d+)$/);
      if (method === 'DELETE' && deleteVenueMatch) {
        const id = parseInt(deleteVenueMatch[1], 10);
        const result = await env.DB.prepare('DELETE FROM venues WHERE id = ?').bind(id).run();

        if (result.meta.changes === 0) {
          return errorResponse('未找到指定球场', 404);
        }

        return jsonResponse({ message: '球场删除成功', id });
      }

      // -------------------------------------------------------------
      // 5. BILLS API ENDPOINTS (User Isolated)
      // -------------------------------------------------------------

      // GET /api/bills - Fetch bills from D1
      if (method === 'GET' && path === '/api/bills') {
        let query;
        if (currentUser) {
          if (currentUser.role === 'admin' && url.searchParams.get('all') === 'true') {
            query = await env.DB.prepare(
              `SELECT id, title, venue_name AS venueName, start_time AS startTime, duration,
                      court_count AS courtCount, court_fee AS courtFee, total_players AS totalPlayers,
                      host_count AS hostCount, shuttles_used AS shuttlesUsed, shuttle_price AS shuttlePrice,
                      additional_shuttles AS additionalShuttles, player_fee AS playerFee,
                      total_cost AS totalCost, total_revenue AS totalRevenue, net_profit AS netProfit,
                      user_id AS userId, created_at AS createdAt, updated_at AS updatedAt
               FROM bills ORDER BY id DESC`
            ).all();
          } else {
            query = await env.DB.prepare(
              `SELECT id, title, venue_name AS venueName, start_time AS startTime, duration,
                      court_count AS courtCount, court_fee AS courtFee, total_players AS totalPlayers,
                      host_count AS hostCount, shuttles_used AS shuttlesUsed, shuttle_price AS shuttlePrice,
                      additional_shuttles AS additionalShuttles, player_fee AS playerFee,
                      total_cost AS totalCost, total_revenue AS totalRevenue, net_profit AS netProfit,
                      user_id AS userId, created_at AS createdAt, updated_at AS updatedAt
               FROM bills WHERE user_id = ? OR user_id IS NULL ORDER BY id DESC`
            ).bind(currentUser.id).all();
          }
        } else {
          // Anonymous: view public or legacy unassigned bills
          query = await env.DB.prepare(
            `SELECT id, title, venue_name AS venueName, start_time AS startTime, duration,
                    court_count AS courtCount, court_fee AS courtFee, total_players AS totalPlayers,
                    host_count AS hostCount, shuttles_used AS shuttlesUsed, shuttle_price AS shuttlePrice,
                    additional_shuttles AS additionalShuttles, player_fee AS playerFee,
                    total_cost AS totalCost, total_revenue AS totalRevenue, net_profit AS netProfit,
                    user_id AS userId, created_at AS createdAt, updated_at AS updatedAt
             FROM bills WHERE user_id IS NULL ORDER BY id DESC`
          ).all();
        }

        return jsonResponse({ bills: query.results || [] });
      }

      // POST /api/bills - Save new bill to D1 (Account Bound)
      if (method === 'POST' && path === '/api/bills') {
        const body = await request.json();
        const {
          title, venueName, startTime, duration, courtCount, courtFee,
          totalPlayers, hostCount, shuttlesUsed, shuttlePrice, additionalShuttles,
          playerFee, totalCost, totalRevenue, netProfit
        } = body;

        const billTitle = title && title.trim() ? title.trim() : `${new Date().toISOString().slice(0, 10)} AA 账单`;
        const vName = venueName ? String(venueName).trim() : '默认场地';
        const ownerId = currentUser ? currentUser.id : null;

        const result = await env.DB.prepare(
          `INSERT INTO bills (
            title, venue_name, start_time, duration, court_count, court_fee,
            total_players, host_count, shuttles_used, shuttle_price, additional_shuttles,
            player_fee, total_cost, total_revenue, net_profit, user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          billTitle, vName,
          parseInt(startTime, 10) || 16, parseInt(duration, 10) || 2, parseInt(courtCount, 10) || 1, parseFloat(courtFee) || 0.0,
          parseInt(totalPlayers, 10) || 6, parseInt(hostCount, 10) || 0, parseInt(shuttlesUsed, 10) || 3, parseFloat(shuttlePrice) || 0.0,
          parseInt(additionalShuttles, 10) || 0, parseFloat(playerFee) || 0.0, parseFloat(totalCost) || 0.0,
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
            playerFee, totalCost, totalRevenue, netProfit,
            userId: ownerId,
            createdAt: new Date().toISOString()
          }
        }, 201);
      }

      // PUT /api/bills/:id - Update existing bill in D1
      const putBillMatch = path.match(/^\/api\/bills\/(\d+)$/);
      if (method === 'PUT' && putBillMatch) {
        const id = parseInt(putBillMatch[1], 10);
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
            title ? String(title).trim() : '未命名账单',
            venueName ? String(venueName).trim() : '默认场地',
            parseInt(startTime, 10) || 16, parseInt(duration, 10) || 2, parseInt(courtCount, 10) || 1, parseFloat(courtFee) || 0.0,
            parseInt(totalPlayers, 10) || 6, parseInt(hostCount, 10) || 0, parseInt(shuttlesUsed, 10) || 3, parseFloat(shuttlePrice) || 0.0,
            parseInt(additionalShuttles, 10) || 0, parseFloat(playerFee) || 0.0, parseFloat(totalCost) || 0.0,
            parseFloat(totalRevenue) || 0.0, parseFloat(netProfit) || 0.0,
            id
          ).run();
        } else if (currentUser) {
          result = await env.DB.prepare(
            `UPDATE bills SET
              title = ?, venue_name = ?, start_time = ?, duration = ?, court_count = ?, court_fee = ?,
              total_players = ?, host_count = ?, shuttles_used = ?, shuttle_price = ?, additional_shuttles = ?,
              player_fee = ?, total_cost = ?, total_revenue = ?, net_profit = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND (user_id = ? OR user_id IS NULL)`
          ).bind(
            title ? String(title).trim() : '未命名账单',
            venueName ? String(venueName).trim() : '默认场地',
            parseInt(startTime, 10) || 16, parseInt(duration, 10) || 2, parseInt(courtCount, 10) || 1, parseFloat(courtFee) || 0.0,
            parseInt(totalPlayers, 10) || 6, parseInt(hostCount, 10) || 0, parseInt(shuttlesUsed, 10) || 3, parseFloat(shuttlePrice) || 0.0,
            parseInt(additionalShuttles, 10) || 0, parseFloat(playerFee) || 0.0, parseFloat(totalCost) || 0.0,
            parseFloat(totalRevenue) || 0.0, parseFloat(netProfit) || 0.0,
            id, currentUser.id
          ).run();
        } else {
          result = await env.DB.prepare(
            `UPDATE bills SET
              title = ?, venue_name = ?, start_time = ?, duration = ?, court_count = ?, court_fee = ?,
              total_players = ?, host_count = ?, shuttles_used = ?, shuttle_price = ?, additional_shuttles = ?,
              player_fee = ?, total_cost = ?, total_revenue = ?, net_profit = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND user_id IS NULL`
          ).bind(
            title ? String(title).trim() : '未命名账单',
            venueName ? String(venueName).trim() : '默认场地',
            parseInt(startTime, 10) || 16, parseInt(duration, 10) || 2, parseInt(courtCount, 10) || 1, parseFloat(courtFee) || 0.0,
            parseInt(totalPlayers, 10) || 6, parseInt(hostCount, 10) || 0, parseInt(shuttlesUsed, 10) || 3, parseFloat(shuttlePrice) || 0.0,
            parseInt(additionalShuttles, 10) || 0, parseFloat(playerFee) || 0.0, parseFloat(totalCost) || 0.0,
            parseFloat(totalRevenue) || 0.0, parseFloat(netProfit) || 0.0,
            id
          ).run();
        }

        if (result.meta.changes === 0) {
          return errorResponse('未找到指定账单或无权修改', 404);
        }

        return jsonResponse({ message: '账单更新成功', id });
      }

      // DELETE /api/bills/:id - Delete bill from D1
      const deleteBillMatch = path.match(/^\/api\/bills\/(\d+)$/);
      if (method === 'DELETE' && deleteBillMatch) {
        const id = parseInt(deleteBillMatch[1], 10);
        let result;

        if (currentUser && currentUser.role === 'admin') {
          result = await env.DB.prepare('DELETE FROM bills WHERE id = ?').bind(id).run();
        } else if (currentUser) {
          result = await env.DB.prepare('DELETE FROM bills WHERE id = ? AND (user_id = ? OR user_id IS NULL)').bind(id, currentUser.id).run();
        } else {
          result = await env.DB.prepare('DELETE FROM bills WHERE id = ? AND user_id IS NULL').bind(id).run();
        }

        if (result.meta.changes === 0) {
          return errorResponse('未找到指定账单或无权删除', 404);
        }

        return jsonResponse({ message: '账单删除成功', id });
      }

      // 404 Fallback
      return errorResponse('API endpoint not found', 404);
    } catch (err) {
      console.error('Worker API Top-level error:', err);
      return errorResponse('Internal Worker Error: ' + err.message, 500);
    }
  }
};
