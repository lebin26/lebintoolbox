/**
 * Cloudflare Worker Module for Monthly Financial Overview (Sub-App #2)
 * Handles Platforms, Products, Monthly Periods, Snapshots, Analytics Aggregations, User Isolation, and Template Presets.
 */

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token',
    }
  });
}

function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

// Month utility helpers
function getPreviousMonthKey(monthKey) {
  const parts = monthKey.split('-');
  let year = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10);

  month -= 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

export async function handleFinancialRequest(request, env, path, method, currentUser = null) {
  const url = new URL(request.url);
  const userId = currentUser ? currentUser.id : null;

  try {
    // Auto-migrate legacy rows where user_id IS NULL to Admin (user_id = 1 or admin role)
    if (currentUser && (currentUser.role === 'admin' || currentUser.id === 1)) {
      try {
        await env.DB.prepare('UPDATE financial_platforms SET user_id = ? WHERE user_id IS NULL').bind(currentUser.id).run();
        await env.DB.prepare('UPDATE financial_products SET user_id = ? WHERE user_id IS NULL').bind(currentUser.id).run();
        await env.DB.prepare('UPDATE financial_periods SET user_id = ? WHERE user_id IS NULL').bind(currentUser.id).run();
      } catch (e) {}
    }

    // -------------------------------------------------------------
    // 0. TEMPLATE LIBRARY API (Public / Preset Marketplace)
    // -------------------------------------------------------------

    // GET /api/financial/templates - Browse platform templates
    if (method === 'GET' && path === '/api/financial/templates') {
      const category = url.searchParams.get('category');
      const search = url.searchParams.get('search');

      let query = 'SELECT id, name, category, logo_url AS logoUrl, description, default_currency AS defaultCurrency, preset_products_json AS presetProductsJson, is_official AS isOfficial, usage_count AS usageCount, created_at AS createdAt FROM financial_platform_templates WHERE 1=1';
      const params = [];

      if (category && category !== 'all') {
        query += ' AND category = ?';
        params.push(category);
      }

      if (search && search.trim()) {
        query += ' AND (name LIKE ? OR description LIKE ?)';
        params.push(`%${search.trim()}%`, `%${search.trim()}%`);
      }

      query += ' ORDER BY is_official DESC, usage_count DESC, id ASC';

      const { results } = await env.DB.prepare(query).bind(...params).all();

      const templates = (results || []).map(t => {
        let products = [];
        try {
          products = typeof t.presetProductsJson === 'string' ? JSON.parse(t.presetProductsJson) : (t.presetProductsJson || []);
        } catch (e) {
          products = [];
        }
        return {
          ...t,
          presetProducts: products
        };
      });

      return jsonResponse({ templates });
    }

    // POST /api/financial/templates/apply - 1-Click Apply Template into Current User's Account
    if (method === 'POST' && path === '/api/financial/templates/apply') {
      const body = await request.json();
      const { templateId } = body;

      if (!templateId) return errorResponse('请指定要采用的模板 ID');

      const template = await env.DB.prepare(
        'SELECT * FROM financial_platform_templates WHERE id = ?'
      ).bind(templateId).first();

      if (!template) return errorResponse('未找到指定模板', 404);

      // Create platform for current user
      const platRes = await env.DB.prepare(
        `INSERT INTO financial_platforms (name, logo_url, description, sort_order, user_id)
         VALUES (?, ?, ?, 0, ?)`
      ).bind(
        template.name,
        template.logo_url || null,
        template.description || null,
        userId
      ).run();

      const newPlatformId = platRes.meta.last_row_id;

      // Parse and insert preset products
      let presetProducts = [];
      try {
        presetProducts = typeof template.preset_products_json === 'string'
          ? JSON.parse(template.preset_products_json)
          : (template.preset_products_json || []);
      } catch (e) {
        presetProducts = [];
      }

      let createdProductsCount = 0;
      for (const prod of presetProducts) {
        if (prod.name) {
          await env.DB.prepare(
            `INSERT INTO financial_products (platform_id, name, product_type, currency, logo_url, sort_order, user_id)
             VALUES (?, ?, ?, ?, ?, 0, ?)`
          ).bind(
            newPlatformId,
            prod.name.trim(),
            prod.productType || 'Savings',
            prod.currency || template.default_currency || 'MYR',
            prod.logoUrl || null,
            userId
          ).run();
          createdProductsCount++;
        }
      }

      // Increment usage count
      await env.DB.prepare(
        'UPDATE financial_platform_templates SET usage_count = usage_count + 1 WHERE id = ?'
      ).bind(templateId).run();

      return jsonResponse({
        message: `🎉 成功采用【${template.name}】模板！已创建 1 个平台及 ${createdProductsCount} 个默认产品`,
        platformId: newPlatformId,
        productCount: createdProductsCount
      }, 201);
    }

    // POST /api/financial/templates/publish - Publish Current User's Platform as Public Template
    if (method === 'POST' && path === '/api/financial/templates/publish') {
      const body = await request.json();
      const { platformId, category, description } = body;

      if (!platformId) return errorResponse('请选择要发布的平台');

      let platform;
      if (userId) {
        platform = await env.DB.prepare(
          'SELECT * FROM financial_platforms WHERE id = ? AND (user_id = ? OR user_id IS NULL)'
        ).bind(platformId, userId).first();
      } else {
        platform = await env.DB.prepare(
          'SELECT * FROM financial_platforms WHERE id = ?'
        ).bind(platformId).first();
      }

      if (!platform) return errorResponse('未找到指定平台或无权操作', 404);

      // Fetch products under platform
      const { results: prods } = await env.DB.prepare(
        'SELECT name, product_type AS productType, currency, logo_url AS logoUrl FROM financial_products WHERE platform_id = ? AND is_active = 1'
      ).bind(platformId).all();

      const presetJson = JSON.stringify((prods || []).map(p => ({
        name: p.name,
        productType: p.productType,
        currency: p.currency,
        logoUrl: p.logoUrl || null
      })));

      const tplCategory = category || 'Banking';
      const tplDesc = description || platform.description || `由用户分享的 ${platform.name} 预设配置`;
      const isOfficial = currentUser && currentUser.role === 'admin' ? 1 : 0;

      const tplRes = await env.DB.prepare(
        `INSERT INTO financial_platform_templates (name, category, logo_url, description, default_currency, preset_products_json, is_official, usage_count, created_by)
         VALUES (?, ?, ?, ?, 'MYR', ?, ?, 1, ?)`
      ).bind(
        platform.name,
        tplCategory,
        platform.logo_url || null,
        tplDesc,
        presetJson,
        isOfficial,
        userId
      ).run();

      return jsonResponse({
        message: '🎉 平台已成功发布至模板市场！',
        templateId: tplRes.meta.last_row_id
      }, 201);
    }

    // -------------------------------------------------------------
    // 1. PLATFORMS API (User Isolated)
    // -------------------------------------------------------------

    // GET /api/financial/platforms
    if (method === 'GET' && path === '/api/financial/platforms') {
      let query;
      if (userId) {
        query = await env.DB.prepare(`
          SELECT p.id, p.name, p.logo_url AS logoUrl, p.description, p.is_active AS isActive,
                 p.sort_order AS sortOrder, p.created_at AS createdAt, p.updated_at AS updatedAt,
                 COUNT(pr.id) AS productCount
          FROM financial_platforms p
          LEFT JOIN financial_products pr ON p.id = pr.platform_id AND pr.is_active = 1
          WHERE p.user_id = ? OR (p.user_id IS NULL AND ? IS NULL)
          GROUP BY p.id
          ORDER BY p.sort_order ASC, p.id ASC
        `).bind(userId, userId).all();
      } else {
        query = await env.DB.prepare(`
          SELECT p.id, p.name, p.logo_url AS logoUrl, p.description, p.is_active AS isActive,
                 p.sort_order AS sortOrder, p.created_at AS createdAt, p.updated_at AS updatedAt,
                 COUNT(pr.id) AS productCount
          FROM financial_platforms p
          LEFT JOIN financial_products pr ON p.id = pr.platform_id AND pr.is_active = 1
          WHERE p.user_id IS NULL
          GROUP BY p.id
          ORDER BY p.sort_order ASC, p.id ASC
        `).all();
      }

      return jsonResponse({ platforms: query.results || [] });
    }

    // POST /api/financial/platforms
    if (method === 'POST' && path === '/api/financial/platforms') {
      const body = await request.json();
      const { name, logoUrl, description, sortOrder } = body;

      if (!name || !name.trim()) {
        return errorResponse('平台机构名称不能为空');
      }

      const res = await env.DB.prepare(`
        INSERT INTO financial_platforms (name, logo_url, description, sort_order, user_id)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        name.trim(),
        logoUrl ? logoUrl.trim() : null,
        description ? description.trim() : null,
        parseInt(sortOrder, 10) || 0,
        userId
      ).run();

      return jsonResponse({
        message: '平台创建成功',
        platform: {
          id: res.meta.last_row_id,
          name: name.trim(),
          logoUrl: logoUrl || null,
          description: description || null,
          isActive: 1,
          sortOrder: parseInt(sortOrder, 10) || 0,
          userId
        }
      }, 201);
    }

    // PUT /api/financial/platforms/:id
    const putPlatformMatch = path.match(/^\/api\/financial\/platforms\/(\d+)$/);
    if (method === 'PUT' && putPlatformMatch) {
      const id = parseInt(putPlatformMatch[1], 10);
      const body = await request.json();
      const { name, logoUrl, description, sortOrder, isActive } = body;

      if (!name || !name.trim()) {
        return errorResponse('平台机构名称不能为空');
      }

      let res;
      if (userId) {
        res = await env.DB.prepare(`
          UPDATE financial_platforms
          SET name = ?, logo_url = ?, description = ?, sort_order = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND (user_id = ? OR user_id IS NULL)
        `).bind(
          name.trim(),
          logoUrl !== undefined ? (logoUrl ? logoUrl.trim() : null) : null,
          description !== undefined ? (description ? description.trim() : null) : null,
          parseInt(sortOrder, 10) || 0,
          isActive !== undefined ? (isActive ? 1 : 0) : 1,
          id,
          userId
        ).run();
      } else {
        res = await env.DB.prepare(`
          UPDATE financial_platforms
          SET name = ?, logo_url = ?, description = ?, sort_order = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND user_id IS NULL
        `).bind(
          name.trim(),
          logoUrl !== undefined ? (logoUrl ? logoUrl.trim() : null) : null,
          description !== undefined ? (description ? description.trim() : null) : null,
          parseInt(sortOrder, 10) || 0,
          isActive !== undefined ? (isActive ? 1 : 0) : 1,
          id
        ).run();
      }

      if (res.meta.changes === 0) return errorResponse('未找到指定平台或无权修改', 404);
      return jsonResponse({ message: '平台信息更新成功', id });
    }

    // DELETE /api/financial/platforms/:id
    const deletePlatformMatch = path.match(/^\/api\/financial\/platforms\/(\d+)$/);
    if (method === 'DELETE' && deletePlatformMatch) {
      const id = parseInt(deletePlatformMatch[1], 10);

      // Check if products exist under platform
      const countRes = await env.DB.prepare(
        'SELECT COUNT(*) as count FROM financial_products WHERE platform_id = ?'
      ).bind(id).first();

      if (countRes && countRes.count > 0) {
        // Safe deactivation
        let updateRes;
        if (userId) {
          updateRes = await env.DB.prepare('UPDATE financial_platforms SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND (user_id = ? OR user_id IS NULL)').bind(id, userId).run();
        } else {
          updateRes = await env.DB.prepare('UPDATE financial_platforms SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id IS NULL').bind(id).run();
        }
        if (updateRes.meta.changes === 0) return errorResponse('未找到指定平台', 404);
        return jsonResponse({ message: '平台包含下属产品，已安全停用', id, deactivated: true });
      }

      let res;
      if (userId) {
        res = await env.DB.prepare('DELETE FROM financial_platforms WHERE id = ? AND (user_id = ? OR user_id IS NULL)').bind(id, userId).run();
      } else {
        res = await env.DB.prepare('DELETE FROM financial_platforms WHERE id = ? AND user_id IS NULL').bind(id).run();
      }

      if (res.meta.changes === 0) return errorResponse('未找到指定平台', 404);
      return jsonResponse({ message: '平台已成功删除', id, deleted: true });
    }

    // -------------------------------------------------------------
    // 2. PRODUCTS API (User Isolated)
    // -------------------------------------------------------------

    // GET /api/financial/products
    if (method === 'GET' && path === '/api/financial/products') {
      const platformId = url.searchParams.get('platformId');
      let queryStr = `
        SELECT pr.id, pr.platform_id AS platformId, pr.name, pr.product_type AS productType,
               pr.currency, pr.logo_url AS logoUrl, pr.target_allocation_pct AS targetAllocationPct,
               pr.is_active AS isActive, pr.sort_order AS sortOrder, pr.notes,
               pr.created_at AS createdAt, pr.updated_at AS updatedAt,
               pl.name AS platformName, pl.logo_url AS platformLogoUrl
        FROM financial_products pr
        LEFT JOIN financial_platforms pl ON pr.platform_id = pl.id
        WHERE 1=1
      `;
      const params = [];

      if (userId) {
        queryStr += ' AND (pr.user_id = ? OR pr.user_id IS NULL)';
        params.push(userId);
      } else {
        queryStr += ' AND pr.user_id IS NULL';
      }

      if (platformId) {
        queryStr += ' AND pr.platform_id = ?';
        params.push(parseInt(platformId, 10));
      }

      queryStr += ' ORDER BY pl.sort_order ASC, pr.sort_order ASC, pr.id ASC';

      const { results } = await env.DB.prepare(queryStr).bind(...params).all();
      return jsonResponse({ products: results || [] });
    }

    // POST /api/financial/products
    if (method === 'POST' && path === '/api/financial/products') {
      const body = await request.json();
      const { platformId, name, productType, currency, logoUrl, targetAllocationPct, sortOrder, notes } = body;

      if (!platformId) return errorResponse('必须选择所属平台机构');
      if (!name || !name.trim()) return errorResponse('产品名称不能为空');

      const pType = productType || 'Savings';
      const curr = currency ? currency.trim().toUpperCase() : 'MYR';
      const targetPct = parseFloat(targetAllocationPct) || 0.0;

      const res = await env.DB.prepare(`
        INSERT INTO financial_products (platform_id, name, product_type, currency, logo_url, target_allocation_pct, sort_order, notes, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        parseInt(platformId, 10),
        name.trim(),
        pType,
        curr,
        logoUrl ? logoUrl.trim() : null,
        targetPct,
        parseInt(sortOrder, 10) || 0,
        notes ? notes.trim() : null,
        userId
      ).run();

      return jsonResponse({
        message: '产品创建成功',
        product: {
          id: res.meta.last_row_id,
          platformId: parseInt(platformId, 10),
          name: name.trim(),
          productType: pType,
          currency: curr,
          logoUrl: logoUrl || null,
          targetAllocationPct: targetPct,
          isActive: 1,
          sortOrder: parseInt(sortOrder, 10) || 0,
          notes: notes || null,
          userId
        }
      }, 201);
    }

    // PUT /api/financial/products/:id
    const putProductMatch = path.match(/^\/api\/financial\/products\/(\d+)$/);
    if (method === 'PUT' && putProductMatch) {
      const id = parseInt(putProductMatch[1], 10);
      const body = await request.json();
      const { platformId, name, productType, currency, logoUrl, targetAllocationPct, sortOrder, notes, isActive } = body;

      if (!name || !name.trim()) return errorResponse('产品名称不能为空');

      let res;
      if (userId) {
        res = await env.DB.prepare(`
          UPDATE financial_products
          SET platform_id = ?, name = ?, product_type = ?, currency = ?, logo_url = ?,
              target_allocation_pct = ?, sort_order = ?, notes = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND (user_id = ? OR user_id IS NULL)
        `).bind(
          parseInt(platformId, 10),
          name.trim(),
          productType || 'Savings',
          currency ? currency.trim().toUpperCase() : 'MYR',
          logoUrl !== undefined ? (logoUrl ? logoUrl.trim() : null) : null,
          parseFloat(targetAllocationPct) || 0.0,
          parseInt(sortOrder, 10) || 0,
          notes !== undefined ? (notes ? notes.trim() : null) : null,
          isActive !== undefined ? (isActive ? 1 : 0) : 1,
          id,
          userId
        ).run();
      } else {
        res = await env.DB.prepare(`
          UPDATE financial_products
          SET platform_id = ?, name = ?, product_type = ?, currency = ?, logo_url = ?,
              target_allocation_pct = ?, sort_order = ?, notes = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND user_id IS NULL
        `).bind(
          parseInt(platformId, 10),
          name.trim(),
          productType || 'Savings',
          currency ? currency.trim().toUpperCase() : 'MYR',
          logoUrl !== undefined ? (logoUrl ? logoUrl.trim() : null) : null,
          parseFloat(targetAllocationPct) || 0.0,
          parseInt(sortOrder, 10) || 0,
          notes !== undefined ? (notes ? notes.trim() : null) : null,
          isActive !== undefined ? (isActive ? 1 : 0) : 1,
          id
        ).run();
      }

      if (res.meta.changes === 0) return errorResponse('未找到指定产品或无权修改', 404);
      return jsonResponse({ message: '产品信息更新成功', id });
    }

    // DELETE /api/financial/products/:id
    const deleteProductMatch = path.match(/^\/api\/financial\/products\/(\d+)$/);
    if (method === 'DELETE' && deleteProductMatch) {
      const id = parseInt(deleteProductMatch[1], 10);

      // Check if snapshots exist
      const countRes = await env.DB.prepare(
        'SELECT COUNT(*) as count FROM financial_snapshots WHERE product_id = ?'
      ).bind(id).first();

      if (countRes && countRes.count > 0) {
        let updateRes;
        if (userId) {
          updateRes = await env.DB.prepare('UPDATE financial_products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND (user_id = ? OR user_id IS NULL)').bind(id, userId).run();
        } else {
          updateRes = await env.DB.prepare('UPDATE financial_products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id IS NULL').bind(id).run();
        }
        if (updateRes.meta.changes === 0) return errorResponse('未找到指定产品', 404);
        return jsonResponse({ message: '产品包含历史快照记录，已安全停用', id, deactivated: true });
      }

      let res;
      if (userId) {
        res = await env.DB.prepare('DELETE FROM financial_products WHERE id = ? AND (user_id = ? OR user_id IS NULL)').bind(id, userId).run();
      } else {
        res = await env.DB.prepare('DELETE FROM financial_products WHERE id = ? AND user_id IS NULL').bind(id).run();
      }

      if (res.meta.changes === 0) return errorResponse('未找到指定产品', 404);
      return jsonResponse({ message: '产品已成功删除', id, deleted: true });
    }

    // -------------------------------------------------------------
    // 3. MONTHLY PERIODS & SNAPSHOTS API (User Isolated)
    // -------------------------------------------------------------

    // GET /api/financial/months/:month
    const getMonthMatch = path.match(/^\/api\/financial\/months\/(\d{4}-\d{2})$/);
    if (method === 'GET' && getMonthMatch) {
      const monthKey = getMonthMatch[1];
      const prevMonthKey = getPreviousMonthKey(monthKey);

      // Find or create current period for this user
      let period;
      if (userId) {
        period = await env.DB.prepare(
          'SELECT id, month_key AS monthKey, status, notes FROM financial_periods WHERE month_key = ? AND (user_id = ? OR user_id IS NULL)'
        ).bind(monthKey, userId).first();
      } else {
        period = await env.DB.prepare(
          'SELECT id, month_key AS monthKey, status, notes FROM financial_periods WHERE month_key = ? AND user_id IS NULL'
        ).bind(monthKey).first();
      }

      let periodId = period ? period.id : null;

      // Find previous period for reference
      let prevPeriod;
      if (userId) {
        prevPeriod = await env.DB.prepare(
          'SELECT id FROM financial_periods WHERE month_key = ? AND (user_id = ? OR user_id IS NULL)'
        ).bind(prevMonthKey, userId).first();
      } else {
        prevPeriod = await env.DB.prepare(
          'SELECT id FROM financial_periods WHERE month_key = ? AND user_id IS NULL'
        ).bind(prevMonthKey).first();
      }

      const prevPeriodId = prevPeriod ? prevPeriod.id : null;

      // Query active products for this user
      let productsQuery = `
        SELECT pr.id AS productId, pr.name AS productName, pr.product_type AS productType,
               pr.currency, pr.logo_url AS logoUrl, pr.target_allocation_pct AS targetAllocationPct,
               pl.id AS platformId, pl.name AS platformName, pl.logo_url AS platformLogoUrl,
               cur_snap.native_amount AS nativeAmount, cur_snap.fx_rate_to_base AS fxRateToBase,
               cur_snap.base_amount AS baseAmount, cur_snap.notes AS snapshotNotes,
               prev_snap.native_amount AS previousNativeAmount, prev_snap.fx_rate_to_base AS previousFxRate,
               prev_snap.base_amount AS previousBaseAmount
        FROM financial_products pr
        JOIN financial_platforms pl ON pr.platform_id = pl.id
        LEFT JOIN financial_snapshots cur_snap ON cur_snap.product_id = pr.id AND cur_snap.period_id = ?
        LEFT JOIN financial_snapshots prev_snap ON prev_snap.product_id = pr.id AND prev_snap.period_id = ?
        WHERE pr.is_active = 1 AND pl.is_active = 1
      `;
      const queryParams = [periodId || 0, prevPeriodId || 0];

      if (userId) {
        productsQuery += ' AND (pr.user_id = ? OR pr.user_id IS NULL) AND (pl.user_id = ? OR pl.user_id IS NULL)';
        queryParams.push(userId, userId);
      } else {
        productsQuery += ' AND pr.user_id IS NULL AND pl.user_id IS NULL';
      }

      productsQuery += ' ORDER BY pl.sort_order ASC, pr.sort_order ASC, pr.id ASC';

      const { results: items } = await env.DB.prepare(productsQuery).bind(...queryParams).all();

      return jsonResponse({
        monthKey,
        periodId,
        status: period ? period.status : 'draft',
        notes: period ? period.notes : '',
        previousMonthKey,
        items: items || []
      });
    }

    // POST /api/financial/months/:month - Save monthly snapshots
    if (method === 'POST' && getMonthMatch) {
      const monthKey = getMonthMatch[1];
      const body = await request.json();
      const { snapshots, notes, status } = body;

      if (!Array.isArray(snapshots)) {
        return errorResponse('快照数据列表格式不正确');
      }

      // Ensure period exists for this user
      let period;
      if (userId) {
        period = await env.DB.prepare(
          'SELECT id FROM financial_periods WHERE month_key = ? AND (user_id = ? OR user_id IS NULL)'
        ).bind(monthKey, userId).first();
      } else {
        period = await env.DB.prepare(
          'SELECT id FROM financial_periods WHERE month_key = ? AND user_id IS NULL'
        ).bind(monthKey).first();
      }

      let periodId;
      if (!period) {
        const createPeriod = await env.DB.prepare(
          'INSERT INTO financial_periods (month_key, status, notes, user_id) VALUES (?, ?, ?, ?)'
        ).bind(monthKey, status || 'saved', notes || '', userId).run();
        periodId = createPeriod.meta.last_row_id;
      } else {
        periodId = period.id;
        await env.DB.prepare(
          'UPDATE financial_periods SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).bind(status || 'saved', notes !== undefined ? notes : '', periodId).run();
      }

      // Batch upsert snapshots
      let savedCount = 0;
      for (const item of snapshots) {
        const prodId = parseInt(item.productId, 10);
        if (!prodId) continue;

        const nativeAmount = parseFloat(item.nativeAmount);
        if (isNaN(nativeAmount)) {
          // If empty/null, delete existing snapshot for product in this period
          await env.DB.prepare(
            'DELETE FROM financial_snapshots WHERE period_id = ? AND product_id = ?'
          ).bind(periodId, prodId).run();
          continue;
        }

        const curr = item.currency ? item.currency.trim().toUpperCase() : 'MYR';
        const fxRate = curr === 'MYR' ? 1.0 : (parseFloat(item.fxRateToBase) || 1.0);
        const baseAmount = curr === 'MYR' ? nativeAmount : (nativeAmount * fxRate);
        const snNotes = item.notes ? item.notes.trim() : null;

        const existingSnap = await env.DB.prepare(
          'SELECT id FROM financial_snapshots WHERE period_id = ? AND product_id = ?'
        ).bind(periodId, prodId).first();

        if (existingSnap) {
          await env.DB.prepare(`
            UPDATE financial_snapshots
            SET native_amount = ?, currency = ?, fx_rate_to_base = ?, base_amount = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(nativeAmount, curr, fxRate, baseAmount, snNotes, existingSnap.id).run();
        } else {
          await env.DB.prepare(`
            INSERT INTO financial_snapshots (period_id, product_id, native_amount, currency, fx_rate_to_base, base_amount, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(periodId, prodId, nativeAmount, curr, fxRate, baseAmount, snNotes).run();
        }
        savedCount++;
      }

      return jsonResponse({
        message: `已成功保存 ${monthKey} 月份资产快照 (${savedCount} 条数据)`,
        periodId,
        monthKey,
        savedCount
      });
    }

    // POST /api/financial/months/:month/copy-previous
    const copyPrevMatch = path.match(/^\/api\/financial\/months\/(\d{4}-\d{2})\/copy-previous$/);
    if (method === 'POST' && copyPrevMatch) {
      const monthKey = copyPrevMatch[1];
      const prevMonthKey = getPreviousMonthKey(monthKey);

      let prevPeriod;
      if (userId) {
        prevPeriod = await env.DB.prepare('SELECT id FROM financial_periods WHERE month_key = ? AND (user_id = ? OR user_id IS NULL)').bind(prevMonthKey, userId).first();
      } else {
        prevPeriod = await env.DB.prepare('SELECT id FROM financial_periods WHERE month_key = ? AND user_id IS NULL').bind(prevMonthKey).first();
      }

      if (!prevPeriod) {
        return errorResponse(`未找到上一个月 (${prevMonthKey}) 的历史记录`);
      }

      const { results: prevSnapshots } = await env.DB.prepare(
        'SELECT product_id, native_amount, currency, fx_rate_to_base, base_amount, notes FROM financial_snapshots WHERE period_id = ?'
      ).bind(prevPeriod.id).all();

      if (!prevSnapshots || prevSnapshots.length === 0) {
        return errorResponse(`上月 (${prevMonthKey}) 暂无已录入的资产快照`);
      }

      // Ensure current period exists
      let curPeriod;
      if (userId) {
        curPeriod = await env.DB.prepare('SELECT id FROM financial_periods WHERE month_key = ? AND (user_id = ? OR user_id IS NULL)').bind(monthKey, userId).first();
      } else {
        curPeriod = await env.DB.prepare('SELECT id FROM financial_periods WHERE month_key = ? AND user_id IS NULL').bind(monthKey).first();
      }

      let curPeriodId;
      if (!curPeriod) {
        const newPeriod = await env.DB.prepare(
          'INSERT INTO financial_periods (month_key, status, user_id) VALUES (?, "draft", ?)'
        ).bind(monthKey, userId).run();
        curPeriodId = newPeriod.meta.last_row_id;
      } else {
        curPeriodId = curPeriod.id;
      }

      let copiedCount = 0;
      for (const s of prevSnapshots) {
        await env.DB.prepare(`
          INSERT INTO financial_snapshots (period_id, product_id, native_amount, currency, fx_rate_to_base, base_amount, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(period_id, product_id) DO UPDATE SET
            native_amount = excluded.native_amount,
            currency = excluded.currency,
            fx_rate_to_base = excluded.fx_rate_to_base,
            base_amount = excluded.base_amount,
            updated_at = CURRENT_TIMESTAMP
        `).bind(curPeriodId, s.product_id, s.native_amount, s.currency, s.fx_rate_to_base, s.base_amount, s.notes).run();
        copiedCount++;
      }

      return jsonResponse({
        message: `成功从 ${prevMonthKey} 复制 ${copiedCount} 条余额到 ${monthKey}`,
        copiedCount,
        monthKey
      });
    }

    // -------------------------------------------------------------
    // 4. DASHBOARD & ANALYTICS API (User Isolated)
    // -------------------------------------------------------------

    // GET /api/financial/dashboard
    if (method === 'GET' && path === '/api/financial/dashboard') {
      const monthKey = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);
      const prevMonthKey = getPreviousMonthKey(monthKey);

      // Period IDs
      let curPeriod, prevPeriod;
      if (userId) {
        curPeriod = await env.DB.prepare('SELECT id FROM financial_periods WHERE month_key = ? AND (user_id = ? OR user_id IS NULL)').bind(monthKey, userId).first();
        prevPeriod = await env.DB.prepare('SELECT id FROM financial_periods WHERE month_key = ? AND (user_id = ? OR user_id IS NULL)').bind(prevMonthKey, userId).first();
      } else {
        curPeriod = await env.DB.prepare('SELECT id FROM financial_periods WHERE month_key = ? AND user_id IS NULL').bind(monthKey).first();
        prevPeriod = await env.DB.prepare('SELECT id FROM financial_periods WHERE month_key = ? AND user_id IS NULL').bind(prevMonthKey).first();
      }

      const curPeriodId = curPeriod ? curPeriod.id : null;
      const prevPeriodId = prevPeriod ? prevPeriod.id : null;

      // Current Net Worth Aggregation
      let totalNetWorth = 0.0;
      let prevTotalNetWorth = 0.0;
      let platformAllocations = [];
      let productTypeAllocations = [];
      let topMovers = [];
      let currencyExposures = [];

      if (curPeriodId) {
        const netWorthRes = await env.DB.prepare(`
          SELECT SUM(s.base_amount) as total
          FROM financial_snapshots s
          JOIN financial_products pr ON s.product_id = pr.id
          JOIN financial_platforms pl ON pr.platform_id = pl.id
          WHERE s.period_id = ? AND pr.is_active = 1 AND pl.is_active = 1
        `).bind(curPeriodId).first();
        totalNetWorth = netWorthRes && netWorthRes.total ? parseFloat(netWorthRes.total) : 0.0;

        // Platform Allocation
        const { results: platAlloc } = await env.DB.prepare(`
          SELECT pl.id, pl.name, pl.logo_url as logoUrl, SUM(s.base_amount) as totalBaseAmount
          FROM financial_snapshots s
          JOIN financial_products pr ON s.product_id = pr.id
          JOIN financial_platforms pl ON pr.platform_id = pl.id
          WHERE s.period_id = ? AND pr.is_active = 1 AND pl.is_active = 1
          GROUP BY pl.id
          ORDER BY totalBaseAmount DESC
        `).bind(curPeriodId).all();

        platformAllocations = (platAlloc || []).map(p => ({
          id: p.id,
          name: p.name,
          logoUrl: p.logoUrl,
          amount: parseFloat(p.totalBaseAmount) || 0.0,
          pct: totalNetWorth > 0 ? ((parseFloat(p.totalBaseAmount) || 0.0) / totalNetWorth * 100) : 0.0
        }));

        // Product Type Allocation
        const { results: typeAlloc } = await env.DB.prepare(`
          SELECT pr.product_type as productType, SUM(s.base_amount) as totalBaseAmount
          FROM financial_snapshots s
          JOIN financial_products pr ON s.product_id = pr.id
          JOIN financial_platforms pl ON pr.platform_id = pl.id
          WHERE s.period_id = ? AND pr.is_active = 1 AND pl.is_active = 1
          GROUP BY pr.product_type
          ORDER BY totalBaseAmount DESC
        `).bind(curPeriodId).all();

        productTypeAllocations = (typeAlloc || []).map(t => ({
          type: t.productType,
          amount: parseFloat(t.totalBaseAmount) || 0.0,
          pct: totalNetWorth > 0 ? ((parseFloat(t.totalBaseAmount) || 0.0) / totalNetWorth * 100) : 0.0
        }));

        // Currency Exposure
        const { results: currExp } = await env.DB.prepare(`
          SELECT s.currency, SUM(s.native_amount) as nativeTotal, SUM(s.base_amount) as baseTotal
          FROM financial_snapshots s
          JOIN financial_products pr ON s.product_id = pr.id
          JOIN financial_platforms pl ON pr.platform_id = pl.id
          WHERE s.period_id = ? AND pr.is_active = 1 AND pl.is_active = 1
          GROUP BY s.currency
          ORDER BY baseTotal DESC
        `).bind(curPeriodId).all();

        currencyExposures = (currExp || []).map(c => ({
          currency: c.currency,
          nativeTotal: parseFloat(c.nativeTotal) || 0.0,
          baseTotal: parseFloat(c.baseTotal) || 0.0,
          pct: totalNetWorth > 0 ? ((parseFloat(c.baseTotal) || 0.0) / totalNetWorth * 100) : 0.0
        }));
      }

      if (prevPeriodId) {
        const prevNetWorthRes = await env.DB.prepare(`
          SELECT SUM(s.base_amount) as total
          FROM financial_snapshots s
          JOIN financial_products pr ON s.product_id = pr.id
          JOIN financial_platforms pl ON pr.platform_id = pl.id
          WHERE s.period_id = ? AND pr.is_active = 1 AND pl.is_active = 1
        `).bind(prevPeriodId).first();
        prevTotalNetWorth = prevNetWorthRes && prevNetWorthRes.total ? parseFloat(prevNetWorthRes.total) : 0.0;
      }

      // Top Movers between cur and prev month
      if (curPeriodId) {
        const { results: movers } = await env.DB.prepare(`
          SELECT pr.id, pr.name, pr.currency, pl.name as platformName,
                 cur.base_amount as curBase, prev.base_amount as prevBase,
                 (COALESCE(cur.base_amount, 0) - COALESCE(prev.base_amount, 0)) as diff
          FROM financial_products pr
          JOIN financial_platforms pl ON pr.platform_id = pl.id
          LEFT JOIN financial_snapshots cur ON cur.product_id = pr.id AND cur.period_id = ?
          LEFT JOIN financial_snapshots prev ON prev.product_id = pr.id AND prev.period_id = ?
          WHERE (cur.base_amount IS NOT NULL OR prev.base_amount IS NOT NULL)
            AND pr.is_active = 1 AND pl.is_active = 1
          ORDER BY ABS(COALESCE(cur.base_amount, 0) - COALESCE(prev.base_amount, 0)) DESC
          LIMIT 5
        `).bind(curPeriodId, prevPeriodId || 0).all();

        topMovers = (movers || []).map(m => ({
          id: m.id,
          name: m.name,
          platformName: m.platformName,
          currency: m.currency,
          curBase: parseFloat(m.curBase) || 0.0,
          prevBase: parseFloat(m.prevBase) || 0.0,
          diff: parseFloat(m.diff) || 0.0
        }));
      }

      // Historical Asset Trend (Last 12 Periods for this user)
      let trendQuery = `
        SELECT p.month_key AS monthKey, SUM(s.base_amount) AS totalNetWorth
        FROM financial_periods p
        JOIN financial_snapshots s ON s.period_id = p.id
        JOIN financial_products pr ON s.product_id = pr.id
        JOIN financial_platforms pl ON pr.platform_id = pl.id
        WHERE pr.is_active = 1 AND pl.is_active = 1
      `;
      const trendParams = [];

      if (userId) {
        trendQuery += ' AND (p.user_id = ? OR p.user_id IS NULL)';
        trendParams.push(userId);
      } else {
        trendQuery += ' AND p.user_id IS NULL';
      }

      trendQuery += ' GROUP BY p.id ORDER BY p.month_key ASC LIMIT 12';

      const { results: trend } = await env.DB.prepare(trendQuery).bind(...trendParams).all();

      const momDiff = totalNetWorth - prevTotalNetWorth;
      const momPct = prevTotalNetWorth > 0 ? ((momDiff / prevTotalNetWorth) * 100) : 0.0;

      return jsonResponse({
        monthKey,
        previousMonthKey,
        totalNetWorth,
        previousTotalNetWorth: prevTotalNetWorth,
        momDiff,
        momPct,
        platformAllocations,
        productTypeAllocations,
        currencyExposures,
        topMovers,
        assetTrend: (trend || []).map(t => ({
          monthKey: t.monthKey,
          totalNetWorth: parseFloat(t.totalNetWorth) || 0.0
        }))
      });
    }

    // GET /api/financial/analytics - Multi-month Matrix Breakdown
    if (method === 'GET' && path === '/api/financial/analytics') {
      const limit = parseInt(url.searchParams.get('limit'), 10) || 6;

      let periodsQuery = 'SELECT id, month_key AS monthKey FROM financial_periods WHERE 1=1';
      const pParams = [];

      if (userId) {
        periodsQuery += ' AND (user_id = ? OR user_id IS NULL)';
        pParams.push(userId);
      } else {
        periodsQuery += ' AND user_id IS NULL';
      }

      periodsQuery += ' ORDER BY month_key DESC LIMIT ?';
      pParams.push(limit);

      const { results: periods } = await env.DB.prepare(periodsQuery).bind(...pParams).all();

      const sortedPeriods = (periods || []).reverse();
      const periodIds = sortedPeriods.map(p => p.id);

      if (periodIds.length === 0) {
        return jsonResponse({ months: [], rows: [] });
      }

      let matrixQuery = `
        SELECT pr.id AS productId, pr.name AS productName, pr.product_type AS productType, pr.currency,
               pl.id AS platformId, pl.name AS platformName, pl.logo_url AS platformLogoUrl,
               s.period_id AS periodId, s.native_amount AS nativeAmount, s.base_amount AS baseAmount
        FROM financial_products pr
        JOIN financial_platforms pl ON pr.platform_id = pl.id
        LEFT JOIN financial_snapshots s ON s.product_id = pr.id AND s.period_id IN (${periodIds.map(() => '?').join(',')})
        WHERE pr.is_active = 1 AND pl.is_active = 1
      `;
      const mParams = [...periodIds];

      if (userId) {
        matrixQuery += ' AND (pr.user_id = ? OR pr.user_id IS NULL) AND (pl.user_id = ? OR pl.user_id IS NULL)';
        mParams.push(userId, userId);
      } else {
        matrixQuery += ' AND pr.user_id IS NULL AND pl.user_id IS NULL';
      }

      matrixQuery += ' ORDER BY pl.sort_order ASC, pr.sort_order ASC, pr.id ASC';

      const { results: rawRows } = await env.DB.prepare(matrixQuery).bind(...mParams).all();

      // Aggregate into row map
      const rowMap = new Map();
      (rawRows || []).forEach(r => {
        if (!rowMap.has(r.productId)) {
          rowMap.set(r.productId, {
            productId: r.productId,
            productName: r.productName,
            productType: r.productType,
            currency: r.currency,
            platformId: r.platformId,
            platformName: r.platformName,
            platformLogoUrl: r.platformLogoUrl,
            values: {}
          });
        }
        if (r.periodId) {
          rowMap.get(r.productId).values[r.periodId] = {
            nativeAmount: r.nativeAmount !== null ? parseFloat(r.nativeAmount) : null,
            baseAmount: r.baseAmount !== null ? parseFloat(r.baseAmount) : null
          };
        }
      });

      return jsonResponse({
        months: sortedPeriods,
        rows: Array.from(rowMap.values())
      });
    }

    // -------------------------------------------------------------
    // 5. BACKUP & RESTORE API (User Isolated)
    // -------------------------------------------------------------

    // GET /api/financial/backup/export
    if (method === 'GET' && path === '/api/financial/backup/export') {
      let platQ = 'SELECT * FROM financial_platforms WHERE 1=1';
      let prodQ = 'SELECT * FROM financial_products WHERE 1=1';
      let perQ = 'SELECT * FROM financial_periods WHERE 1=1';
      let snapQ = `
        SELECT s.* FROM financial_snapshots s
        JOIN financial_periods p ON s.period_id = p.id
        WHERE 1=1
      `;
      const uParams = [];

      if (userId) {
        platQ += ' AND (user_id = ? OR user_id IS NULL)';
        prodQ += ' AND (user_id = ? OR user_id IS NULL)';
        perQ += ' AND (user_id = ? OR user_id IS NULL)';
        snapQ += ' AND (p.user_id = ? OR p.user_id IS NULL)';
        uParams.push(userId);
      } else {
        platQ += ' AND user_id IS NULL';
        prodQ += ' AND user_id IS NULL';
        perQ += ' AND user_id IS NULL';
        snapQ += ' AND p.user_id IS NULL';
      }

      const { results: platforms } = await env.DB.prepare(platQ).bind(...uParams).all();
      const { results: products } = await env.DB.prepare(prodQ).bind(...uParams).all();
      const { results: periods } = await env.DB.prepare(perQ).bind(...uParams).all();
      const { results: snapshots } = await env.DB.prepare(snapQ).bind(...uParams).all();

      return jsonResponse({
        exportDate: new Date().toISOString(),
        version: '2.0.0',
        userId,
        platforms: platforms || [],
        products: products || [],
        periods: periods || [],
        snapshots: snapshots || []
      });
    }

    // POST /api/financial/backup/import
    if (method === 'POST' && path === '/api/financial/backup/import') {
      const body = await request.json();
      const { platforms, products, periods, snapshots } = body;

      if (!Array.isArray(platforms) || !Array.isArray(products)) {
        return errorResponse('备份数据格式不正确');
      }

      const platformIdMap = new Map();
      for (const p of platforms) {
        const res = await env.DB.prepare(
          'INSERT INTO financial_platforms (name, logo_url, description, is_active, sort_order, user_id) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(p.name, p.logo_url || null, p.description || null, p.is_active !== undefined ? p.is_active : 1, p.sort_order || 0, userId).run();
        platformIdMap.set(p.id, res.meta.last_row_id);
      }

      const productIdMap = new Map();
      for (const pr of products) {
        const newPlatId = platformIdMap.get(pr.platform_id) || pr.platform_id;
        const res = await env.DB.prepare(
          'INSERT INTO financial_products (platform_id, name, product_type, currency, logo_url, target_allocation_pct, is_active, sort_order, notes, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          newPlatId, pr.name, pr.product_type || 'Savings', pr.currency || 'MYR', pr.logo_url || null,
          pr.target_allocation_pct || 0.0, pr.is_active !== undefined ? pr.is_active : 1, pr.sort_order || 0, pr.notes || null, userId
        ).run();
        productIdMap.set(pr.id, res.meta.last_row_id);
      }

      const periodIdMap = new Map();
      if (Array.isArray(periods)) {
        for (const per of periods) {
          const res = await env.DB.prepare(
            'INSERT INTO financial_periods (month_key, status, notes, user_id) VALUES (?, ?, ?, ?)'
          ).bind(per.month_key, per.status || 'saved', per.notes || null, userId).run();
          periodIdMap.set(per.id, res.meta.last_row_id);
        }
      }

      let snapCount = 0;
      if (Array.isArray(snapshots)) {
        for (const sn of snapshots) {
          const newPerId = periodIdMap.get(sn.period_id);
          const newProdId = productIdMap.get(sn.product_id);
          if (newPerId && newProdId) {
            await env.DB.prepare(
              'INSERT INTO financial_snapshots (period_id, product_id, native_amount, currency, fx_rate_to_base, base_amount, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
            ).bind(newPerId, newProdId, sn.native_amount || 0, sn.currency || 'MYR', sn.fx_rate_to_base || 1.0, sn.base_amount || 0, sn.notes || null).run();
            snapCount++;
          }
        }
      }

      return jsonResponse({
        message: '数据恢复成功',
        platformCount: platforms.length,
        productCount: products.length,
        snapshotCount: snapCount
      });
    }

    return errorResponse('Financial sub-endpoint not found', 404);
  } catch (err) {
    console.error('handleFinancialRequest Error:', err);
    return errorResponse('Financial Module Error: ' + err.message, 500);
  }
}
