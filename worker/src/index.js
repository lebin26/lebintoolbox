/**
 * Cloudflare Worker API for HostCalculator
 * Connects to Cloudflare D1 database (env.DB) for court/venue management.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight OPTIONS request
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (!env.DB) {
      return errorResponse('D1 database binding "DB" is missing in wrangler.jsonc', 500);
    }

    try {
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

      // 404 Fallback
      return errorResponse('API endpoint not found', 404);
    } catch (err) {
      return errorResponse('Internal Worker Error: ' + err.message, 500);
    }
  }
};
