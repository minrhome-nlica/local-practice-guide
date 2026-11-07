// Protected management console for the local practice guide.
// Deploy as a SEPARATE Cloudflare Worker. Never serve these endpoints from the public feedback Worker.
// A Worker-level Cloudflare Access policy, matching ACCESS_AUD, and D1 allowlist are all mandatory.
import { ADMIN_HTML, ADMIN_CSS, ADMIN_CLIENT } from './ui.js';
import { queryWebAnalytics } from './analytics.js';
import { recentUpdates } from './updates.js';
import { listArticles } from './articles.js';
import { editorRoute } from './editor.js';

const ROLES = ['owner', 'editor', 'moderator'];
const STATUSES = ['pending', 'approved', 'resolved', 'rejected'];
const POLICY = "default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; " +
  "script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'none'";

function response(body, type = 'application/json; charset=utf-8', status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': type,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': POLICY
    }
  });
}
function json(data, status = 200) {
  return response(JSON.stringify(data), 'application/json; charset=utf-8', status);
}
function error(message, status = 400) {
  return json({ ok: false, error: message }, status);
}
function clean(value, limit = 140) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}
function validEmail(value) {
  const email = clean(value, 254).toLowerCase();
  return /^[^\s@]{1,80}@[a-z0-9.-]+\.[a-z]{2,24}$/.test(email) ? email : '';
}
function validId(value) {
  return /^[a-f0-9-]{36}$/i.test(String(value || ''));
}
function hasRole(user, ...allowed) {
  return allowed.includes(user.role);
}
function requireRole(user, ...allowed) {
  return hasRole(user, ...allowed) ? null : error('你沒有使用這項功能的權限。', 403);
}
async function authenticatedUser(env, ctx) {
  if (!env.DB || typeof env.ACCESS_AUD !== 'string' || !env.ACCESS_AUD.trim()) {
    return { failure: error('管理後台尚未完成安全設定。', 503) };
  }
  // ctx.access is set only when Cloudflare Access authenticated this direct Worker invocation.
  // Reject bare workers.dev requests, missing Access, or an unexpected Access application.
  if (!ctx?.access || ctx.access.aud !== env.ACCESS_AUD.trim()) {
    return { failure: error('請使用已受 Cloudflare Access 保護的管理入口登入。', 403) };
  }
  let identity;
  try { identity = await ctx.access.getIdentity(); }
  catch { return { failure: error('無法確認登入身分。', 403) }; }
  const email = validEmail(identity?.email);
  if (!email) return { failure: error('無法取得已驗證的電子郵件。', 403) };
  const user = await env.DB.prepare(
    'SELECT email, display_name, role, active FROM admin_users WHERE email = ? COLLATE NOCASE'
  ).bind(email).first();
  if (!user || Number(user.active) !== 1 || !ROLES.includes(user.role)) {
    return { failure: error('此電子郵件尚未獲得後台使用權限。', 403) };
  }
  return { user: { email: String(user.email).toLowerCase(), display_name: user.display_name || '',
    role: user.role } };
}
async function bodyJson(request) {
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
    return { error: error('僅接受 JSON 資料。', 415) };
  }
  if (Number(request.headers.get('content-length') || 0) > 7000) {
    return { error: error('資料超過限制。', 413) };
  }
  const raw = await request.text();
  if (raw.length > 7000) return { error: error('資料超過限制。', 413) };
  try {
    const input = JSON.parse(raw);
    if (input && typeof input === 'object' && !Array.isArray(input)) return { input };
  } catch {}
  return { error: error('JSON 資料格式不正確。') };
}
function sameOriginPost(request, url) {
  // Same-origin + application/json prevents cross-site cookie-authenticated mutations.
  if (request.headers.get('origin') !== url.origin) return false;
  const site = request.headers.get('sec-fetch-site');
  return !site || site === 'same-origin';
}
async function audit(env, user, action, entity, entityId, details = '') {
  await env.DB.prepare(
    'INSERT INTO admin_audit (id, actor_email, action, entity, entity_id, details, created_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), user.email, action, entity, entityId, clean(details, 500),
    new Date().toISOString()).run();
}
async function overview(env) {
  const [comments, ratings] = await Promise.all([
    env.DB.prepare('SELECT status, COUNT(*) AS n FROM feedback GROUP BY status').all(),
    env.DB.prepare(
      "SELECT COUNT(*) AS total, " +
      "SUM(CASE WHEN vote='helpful' THEN 1 ELSE 0 END) AS helpful, " +
      "SUM(CASE WHEN vote='unresolved' THEN 1 ELSE 0 END) AS unresolved " +
      'FROM article_ratings'
    ).first()
  ]);
  const byStatus = Object.fromEntries(STATUSES.map(s => [s, 0]));
  for (const row of comments.results || []) {
    if (Object.hasOwn(byStatus, row.status)) byStatus[row.status] = Number(row.n) || 0;
  }
  return json({ ok: true, comments: byStatus, ratings: {
    total: Number(ratings?.total) || 0,
    helpful: Number(ratings?.helpful) || 0,
    unresolved: Number(ratings?.unresolved) || 0
  } });
}
async function commentsList(env, url) {
  const status = url.searchParams.get('status') || 'pending';
  if (!STATUSES.includes(status)) return error('留言狀態不正確。');
  const search = clean(url.searchParams.get('search'), 70);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 25));
  const offset = Math.min(10000, Math.max(0, Number(url.searchParams.get('offset')) || 0));
  const filter = search
    ? 'status = ? AND (instr(lower(entry_title),lower(?))>0 OR instr(lower(body),lower(?))>0 OR instr(lower(author),lower(?))>0)'
    : 'status = ?';
  const order = status === 'pending' ? 'ASC' : 'DESC';
  const query = env.DB.prepare(
    'SELECT id, entry_id, entry_title, section_id, quote, author, kind, body, admin_reply, ' +
    'status, created_at, updated_at FROM feedback WHERE ' + filter +
    ' ORDER BY created_at ' + order + ', id ' + order + ' LIMIT ? OFFSET ?'
  );
  const binds = search ? [status, search, search, search] : [status];
  const result = await query.bind(...binds, limit + 1, offset).all();
  const rows = result.results || [];
  return json({ ok: true, items: rows.slice(0, limit), has_more: rows.length > limit,
    offset, limit, status });
}
async function moderate(env, user, request, id) {
  if (!validId(id)) return error('留言識別碼不正確。');
  const parsed = await bodyJson(request);
  if (parsed.error) return parsed.error;
  const input = parsed.input;
  if (!STATUSES.includes(input.status)) return error('留言狀態不正確。');
  const reply = clean(input.admin_reply, 1801);
  if (reply.length > 1800) return error('回覆不能超過 1800 個字。');
  if (typeof input.expected_updated_at !== 'string' || !input.expected_updated_at) {
    return error('請先重新整理留言。', 409);
  }
  const previous = await env.DB.prepare(
    'SELECT status, admin_reply, updated_at FROM feedback WHERE id = ?'
  ).bind(id).first();
  if (!previous) return error('找不到這則留言。', 404);
  if (previous.updated_at !== input.expected_updated_at) {
    return error('這則留言已被其他工作人員修改，請重新載入。', 409);
  }
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    'UPDATE feedback SET status = ?, admin_reply = ?, updated_at = ? ' +
    'WHERE id = ? AND updated_at = ?'
  ).bind(input.status, reply, now, id, input.expected_updated_at).run();
  if (!result.meta?.changes) return error('留言已更新，請重新載入。', 409);
  await audit(env, user, 'moderate', 'feedback', id,
    previous.status + ' -> ' + input.status + (previous.admin_reply !== reply ? ' / 已更新回覆' : ''));
  return json({ ok: true, updated_at: now });
}
async function ratingStats(env, url) {
  const period = url.searchParams.get('period') || '30';
  if (!['30', 'all'].includes(period)) return error('統計期間不正確。');
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
  const where = period === '30' ? ' WHERE updated_at >= ?' : '';
  const votes = env.DB.prepare(
    'SELECT entry_id, MAX(entry_title) AS entry_title, COUNT(*) AS total, ' +
    "SUM(CASE WHEN vote='helpful' THEN 1 ELSE 0 END) AS helpful, " +
    "SUM(CASE WHEN vote='unresolved' THEN 1 ELSE 0 END) AS unresolved " +
    'FROM article_ratings' + where + ' GROUP BY entry_id ORDER BY unresolved DESC, total DESC LIMIT 500'
  );
  const reasons = env.DB.prepare(
    "SELECT entry_id, reason, COUNT(*) AS n FROM article_ratings WHERE vote='unresolved' AND reason<>''" +
    (period === '30' ? ' AND updated_at >= ?' : '') + ' GROUP BY entry_id, reason'
  );
  const [r1, r2] = await Promise.all([
    (period === '30' ? votes.bind(cutoff) : votes).all(),
    (period === '30' ? reasons.bind(cutoff) : reasons).all()
  ]);
  const map = new Map();
  for (const row of r2.results || []) {
    const entry = map.get(row.entry_id) || {};
    entry[row.reason] = Number(row.n) || 0;
    map.set(row.entry_id, entry);
  }
  return json({ ok: true, period, items: (r1.results || []).map(r => ({
    entry_id: r.entry_id, entry_title: r.entry_title,
    total: Number(r.total) || 0, helpful: Number(r.helpful) || 0,
    unresolved: Number(r.unresolved) || 0, reasons: map.get(r.entry_id) || {}
  })) });
}
async function usersList(env) {
  const r = await env.DB.prepare(
    'SELECT email, display_name, role, active, created_at, updated_at ' +
    'FROM admin_users ORDER BY active DESC, role ASC, email ASC LIMIT 100'
  ).all();
  return json({ ok: true, users: r.results || [] });
}
async function addUser(env, user, request) {
  const parsed = await bodyJson(request);
  if (parsed.error) return parsed.error;
  const email = validEmail(parsed.input.email);
  const role = clean(parsed.input.role, 30);
  const name = clean(parsed.input.display_name, 80);
  if (!email || !ROLES.includes(role)) return error('請填寫正確 Email 和權限。');
  const exists = await env.DB.prepare('SELECT email FROM admin_users WHERE email=?').bind(email).first();
  if (exists) return error('此 Email 已在名單中，請直接修改權限。', 409);
  const now = new Date().toISOString();
  await env.DB.prepare(
    'INSERT INTO admin_users (email, display_name, role, active, created_at, updated_at) ' +
    'VALUES (?, ?, ?, 1, ?, ?)'
  ).bind(email, name, role, now, now).run();
  await audit(env, user, 'create', 'admin_user', email, role);
  return json({ ok: true }, 201);
}
async function updateUser(env, user, request, encodedEmail) {
  let decoded;
  try { decoded = decodeURIComponent(encodedEmail); } catch { return error('Email 格式不正確。'); }
  const email = validEmail(decoded);
  if (!email) return error('Email 格式不正確。');
  if (email === user.email) return error('不能從此頁修改自己的管理權限。', 409);
  const parsed = await bodyJson(request);
  if (parsed.error) return parsed.error;
  const role = clean(parsed.input.role, 30);
  if (!ROLES.includes(role) || typeof parsed.input.active !== 'boolean') {
    return error('權限或啟用狀態不正確。');
  }
  const previous = await env.DB.prepare(
    'SELECT role, active FROM admin_users WHERE email=?'
  ).bind(email).first();
  if (!previous) return error('找不到此工作人員。', 404);
  if (previous.role === 'owner' && (!parsed.input.active || role !== 'owner')) {
    const count = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM admin_users WHERE role='owner' AND active=1"
    ).first();
    if (Number(count?.n) <= 1) return error('至少需保留一名啟用中的最高管理員。', 409);
  }
  await env.DB.prepare(
    'UPDATE admin_users SET role=?, active=?, updated_at=? WHERE email=?'
  ).bind(role, parsed.input.active ? 1 : 0, new Date().toISOString(), email).run();
  await audit(env, user, 'update', 'admin_user', email, role + '/' +
    (parsed.input.active ? 'active' : 'disabled'));
  return json({ ok: true });
}
async function auditList(env) {
  const r = await env.DB.prepare(
    'SELECT actor_email, action, entity, entity_id, details, created_at ' +
    'FROM admin_audit ORDER BY created_at DESC, id DESC LIMIT 60'
  ).all();
  return json({ ok: true, items: r.results || [] });
}

export default {
  async fetch(request, env, ctx) {
    try {
      const auth = await authenticatedUser(env, ctx);
      if (auth.failure) return auth.failure;
      const user = auth.user;
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, '') || '/';
      if (request.method === 'POST' && !sameOriginPost(request, url)) {
        return error('跨網站請求已拒絕。', 403);
      }
      // Restrict request size before decoding editorial Markdown JSON.
      if (request.method === 'POST' && path.startsWith('/api/editor/')) {
        const size = Number(request.headers.get('content-length') || 0);
        if (size > 160000) return error('文章草稿內容超過 160 KB 請求上限。', 413);
        if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
          return error('文章編輯僅接受 JSON 請求。', 415);
        }
      }
      if (path.startsWith('/api/editor/')) {
        return await editorRoute(env, user, request, url);
      }
      if (request.method === 'GET') {
        if (path === '/') return response(ADMIN_HTML, 'text/html; charset=utf-8');
        if (path === '/app.css') return response(ADMIN_CSS, 'text/css; charset=utf-8');
        if (path === '/app.js') return response(ADMIN_CLIENT, 'text/javascript; charset=utf-8');
        if (path === '/api/me') return json({ ok: true, user,
          site_url: clean(env.SITE_URL || 'https://guide.mountcounty.com', 200) });
        if (path === '/api/overview') return overview(env);
        if (path === '/api/comments') return requireRole(user, 'owner', 'moderator') || commentsList(env, url);
        if (path === '/api/ratings') return ratingStats(env, url);
        if (path === '/api/articles') {
          return requireRole(user, 'owner', 'editor') || (async () => {
            const result = await listArticles();
            return json(result.body, result.status);
          })();
        }
        if (path === '/api/updates') {
          const result = await recentUpdates(url);
          return json(result.body, result.status);
        }
        if (path === '/api/analytics') {
          const analytics = await queryWebAnalytics(env, url);
          return json(analytics.body, analytics.status);
        }
        if (path === '/api/users') return requireRole(user, 'owner') || usersList(env);
        if (path === '/api/audit') return requireRole(user, 'owner') || auditList(env);
      }
      if (request.method === 'POST') {
        if (path.startsWith('/api/comments/')) {
          return requireRole(user, 'owner', 'moderator') || moderate(env, user, request, path.slice('/api/comments/'.length));
        }
        if (path === '/api/users') {
          return requireRole(user, 'owner') || addUser(env, user, request);
        }
        if (path.startsWith('/api/users/')) {
          return requireRole(user, 'owner') || updateUser(env, user, request,
            path.slice('/api/users/'.length));
        }
      }
      return error('找不到此頁面或操作方式不正確。', 404);
    } catch (e) {
      // Do not expose Cloudflare configuration, database errors, tokens or identity claims.
      console.error('admin worker failed', e?.name || 'Error');
      return error('管理服務暫時無法使用，請通知管理員。', 503);
    }
  }
};
