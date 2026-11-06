// Cloudflare Worker for the local practice guide's moderated reader feedback.
// Private values belong in Cloudflare Worker Secrets, NEVER this repository.
const KINDS = ['question', 'correction', 'supplement'];
const STATUSES = ['pending', 'approved', 'rejected', 'resolved'];

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
}
function cors(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin || !allowedOrigins(env).includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin'
  };
}
function json(request, env, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', ...cors(request, env) }
  });
}
function bad(request, env, message, status = 400) {
  return json(request, env, { ok: false, error: message }, status);
}
function validId(value) {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{1,90}$/.test(value);
}
function clean(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function safeToken(expected, supplied) {
  if (!expected || !supplied || expected.length !== supplied.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  return diff === 0;
}
async function digest(text) {
  const bytes = new TextEncoder().encode(text);
  const raw = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(raw)].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function turnstileValid(request, env, token, origin) {
  if (!env.TURNSTILE_SECRET || !token) return false;
  const body = new FormData();
  body.append('secret', env.TURNSTILE_SECRET);
  body.append('response', token);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) body.append('remoteip', ip);
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { method: 'POST', body });
    if (!response.ok) return false;
    const result = await response.json();
    return result.success === true &&
      result.action === 'guide_feedback' &&
      result.hostname === new URL(origin).hostname;
  } catch {
    return false;
  }
}
function isAuthorized(request, env) {
  const token = request.headers.get('Authorization') || '';
  return safeToken('Bearer ' + String(env.ADMIN_TOKEN || ''), token) &&
    Boolean(env.ADMIN_TOKEN && env.ADMIN_TOKEN.length >= 32);
}
async function publicComments(request, env, url) {
  const entry = url.searchParams.get('entry');
  if (entry && !validId(entry)) return bad(request, env, '無效的詞條識別碼');
  const limit = Math.min(30, Math.max(1, Number(url.searchParams.get('limit')) || 12));
  const offset = Math.min(5000, Math.max(0, Number(url.searchParams.get('offset')) || 0));
  const where = entry ? "status IN ('approved', 'resolved') AND entry_id = ?" : "status IN ('approved', 'resolved')";
  const sql = 'SELECT id, entry_id, entry_title, section_id, quote, author, kind, body, admin_reply, status, created_at, updated_at ' +
    'FROM feedback WHERE ' + where + ' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?';
  const statement = env.DB.prepare(sql);
  const result = entry
    ? await statement.bind(entry, limit + 1, offset).all()
    : await statement.bind(limit + 1, offset).all();
  const rows = result.results || [];
  return json(request, env, { ok: true, items: rows.slice(0, limit), has_more: rows.length > limit });
}
async function submitComment(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!allowedOrigins(env).includes(origin)) return bad(request, env, '來源網站未授權', 403);
  if (!env.DB || !env.TURNSTILE_SECRET || !env.RATE_SALT) {
    return bad(request, env, '留言服務尚未完成設定', 503);
  }
  if (!(request.headers.get('Content-Type') || '').includes('application/json')) {
    return bad(request, env, '資料格式不正確', 415);
  }
  const raw = await request.text();
  if (raw.length > 12000) return bad(request, env, '資料超過限制', 413);
  let input;
  try { input = JSON.parse(raw); } catch { return bad(request, env, '資料格式錯誤'); }
  if (!input || typeof input !== 'object') return bad(request, env, '資料格式錯誤');
  // Honeypot: never expose anti-bot secrets in user-facing HTML.
  if (input.website) return bad(request, env, '無法處理這筆留言', 400);
  const entryId = clean(input.entry_id, 100);
  const title = clean(input.entry_title, 140);
  const section = clean(input.section_id, 120);
  const quote = clean(input.quote, 320);
  const contextBefore = clean(input.context_before, 100);
  const contextAfter = clean(input.context_after, 100);
  const author = clean(input.author, 40) || '讀者';
  const kind = clean(input.kind, 30);
  const body = clean(input.body, 2001);
  if (!validId(entryId) || !title || !KINDS.includes(kind) || body.length < 10 || body.length > 2000
      || (section && !/^[\w\u00c0-\uffff-]{1,120}$/.test(section))) {
    return bad(request, env, '請確認詞條、留言類型及內容（至少 10 字）');
  }
  if (quote.length > 300) return bad(request, env, '選取文字太長');
  const valid = await turnstileValid(request, env, clean(input.turnstile_token, 2500), origin);
  if (!valid) return bad(request, env, '安全驗證未通過，請重試', 403);
  // Rate limit stores no plaintext IP. Its salted fingerprint changes hourly.
  const bucket = Math.floor(Date.now() / 3600000);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = await digest(String(env.RATE_SALT) + ':' + ip + ':' + bucket);
  const rate = await env.DB.prepare(
    'INSERT INTO feedback_rate (bucket, count, expires_at) VALUES (?, 1, ?) ' +
    'ON CONFLICT(bucket) DO UPDATE SET count = count + 1 WHERE count < 5 RETURNING count'
  ).bind(key, Math.floor(Date.now() / 1000) + 7200).first();
  if (!rate) return bad(request, env, '留言次數較多，請稍後再試', 429);
  await env.DB.prepare(
    'INSERT INTO feedback (id, entry_id, entry_title, section_id, quote, context_before, context_after, author, kind, body, status, created_at, updated_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), entryId, title, section, quote, contextBefore, contextAfter, author,
    kind, body, 'pending', new Date().toISOString(), new Date().toISOString()).run();
  return json(request, env, { ok: true, status: 'pending', message: '已收到留言，審核通過後會公開。' }, 201);
}
async function adminPending(request, env, url) {
  if (!isAuthorized(request, env)) return bad(request, env, '未授權', 401);
  const status = url.searchParams.get('status') || 'pending';
  if (!STATUSES.includes(status)) return bad(request, env, '狀態不正確');
  const results = await env.DB.prepare(
    'SELECT * FROM feedback WHERE status = ? ORDER BY created_at ASC LIMIT 100'
  ).bind(status).all();
  return json(request, env, { ok: true, items: results.results || [] });
}
async function adminModerate(request, env, url) {
  if (!isAuthorized(request, env)) return bad(request, env, '未授權', 401);
  const id = url.pathname.split('/').pop();
  if (!/^[0-9a-f-]{36}$/.test(id)) return bad(request, env, '留言識別碼不正確');
  const raw = await request.text();
  if (raw.length > 5000) return bad(request, env, '資料超過限制');
  let input;
  try { input = JSON.parse(raw); } catch { return bad(request, env, '資料格式錯誤'); }
  if (!input || !STATUSES.includes(input.status)) return bad(request, env, '狀態不正確');
  const reply = clean(input.admin_reply, 1800);
  const result = await env.DB.prepare(
    'UPDATE feedback SET status = ?, admin_reply = ?, updated_at = ? WHERE id = ?'
  ).bind(input.status, reply, new Date().toISOString(), id).run();
  if (!result.meta?.changes) return bad(request, env, '找不到留言', 404);
  return json(request, env, { ok: true });
}
// Article usefulness feedback is separate from moderated reader comments.
// One salted pseudonymous browser token per article, with no raw IP or email stored.
const RATING_REASONS = [
  'missing_answer', 'unclear', 'needs_examples', 'possibly_outdated', 'layout_issue', 'other'
];
async function ratingsAvailable(request, env) {
  if (!env.DB || !env.RATE_SALT) return bad(request, env, '文章回饋功能尚未啟用', 503);
  try {
    // Also confirms the D1 migration was applied before exposing any buttons.
    await env.DB.prepare('SELECT id FROM article_ratings LIMIT 1').first();
    return json(request, env, { ok: true, enabled: true });
  } catch {
    return bad(request, env, '文章回饋功能尚未啟用', 503);
  }
}
async function submitRating(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!allowedOrigins(env).includes(origin)) return bad(request, env, '來源網站未授權', 403);
  if (!env.DB || !env.RATE_SALT) return bad(request, env, '文章回饋功能尚未啟用', 503);
  if (!(request.headers.get('Content-Type') || '').includes('application/json')) {
    return bad(request, env, '資料格式不正確', 415);
  }
  const raw = await request.text();
  if (raw.length > 3000) return bad(request, env, '資料超過限制', 413);
  let input;
  try { input = JSON.parse(raw); } catch { return bad(request, env, '資料格式錯誤'); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return bad(request, env, '資料格式錯誤');
  }
  const entryId = clean(input.entry_id, 100);
  const entryTitle = clean(input.entry_title, 140);
  const vote = clean(input.vote, 30);
  const reason = clean(input.reason, 40);
  const visitorToken = clean(input.visitor_token, 80);
  if (!validId(entryId) || !entryTitle ||
      !['helpful', 'unresolved'].includes(vote) ||
      !/^[a-f0-9]{64}$/.test(visitorToken) ||
      (vote === 'helpful' && reason !== '') ||
      (vote === 'unresolved' && !RATING_REASONS.includes(reason))) {
    return bad(request, env, '請重新確認文章與回饋內容');
  }
  // The per-article hash does not let administrators link a browser across entries.
  const voterHash = await digest(String(env.RATE_SALT) + ':article:' + entryId + ':' + visitorToken);
  const hour = Math.floor(Date.now() / 3600000);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const bucket = await digest(String(env.RATE_SALT) + ':rating-rate:' + ip + ':' + hour);
  const now = new Date().toISOString();
  // A separate 80/hour/IP limit reduces abuse without blocking large workshops.
  // It is not a guarantee of one person one vote.
  const rate = await env.DB.prepare(
    'INSERT INTO article_rating_rate (bucket, count, expires_at) VALUES (?, 1, ?) ' +
    'ON CONFLICT(bucket) DO UPDATE SET count = count + 1 WHERE count < 80 RETURNING count'
  ).bind(bucket, Math.floor(Date.now() / 1000) + 7200).first();
  if (!rate) return bad(request, env, '回饋次數較多，請稍後再試', 429);
  await env.DB.prepare(
    'INSERT INTO article_ratings ' +
    '(id, entry_id, entry_title, voter_hash, vote, reason, created_at, updated_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(entry_id, voter_hash) DO UPDATE SET ' +
    'entry_title = excluded.entry_title, vote = excluded.vote, ' +
    'reason = excluded.reason, updated_at = excluded.updated_at'
  ).bind(crypto.randomUUID(), entryId, entryTitle, voterHash, vote, reason, now, now).run();
  return json(request, env, { ok: true, message: '已收到回饋', vote });
}
async function adminRatings(request, env, url) {
  if (!isAuthorized(request, env)) return bad(request, env, '未授權', 401);
  if (!env.DB) return bad(request, env, '資料庫尚未設定', 503);
  const period = url.searchParams.get('period') || '30';
  if (!['30', 'all'].includes(period)) return bad(request, env, '統計期間不正確');
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
  const filter = period === '30' ? ' WHERE updated_at >= ?' : '';
  const sql = 'SELECT entry_id, MAX(entry_title) AS entry_title, COUNT(*) AS total, ' +
    "SUM(CASE WHEN vote = 'helpful' THEN 1 ELSE 0 END) AS helpful, " +
    "SUM(CASE WHEN vote = 'unresolved' THEN 1 ELSE 0 END) AS unresolved " +
    'FROM article_ratings' + filter + ' GROUP BY entry_id ' +
    'ORDER BY unresolved DESC, total DESC, entry_id ASC LIMIT 500';
  const sqlReasons = 'SELECT entry_id, reason, COUNT(*) AS total FROM article_ratings ' +
    "WHERE vote = 'unresolved' AND reason <> ''" +
    (period === '30' ? ' AND updated_at >= ?' : '') +
    ' GROUP BY entry_id, reason';
  const query = env.DB.prepare(sql);
  const queryReasons = env.DB.prepare(sqlReasons);
  const [ratingRows, reasonRows] = await Promise.all([
    (period === '30' ? query.bind(cutoff) : query).all(),
    (period === '30' ? queryReasons.bind(cutoff) : queryReasons).all()
  ]);
  const byEntry = new Map();
  for (const row of reasonRows.results || []) {
    const group = byEntry.get(row.entry_id) || {};
    group[row.reason] = Number(row.total) || 0;
    byEntry.set(row.entry_id, group);
  }
  const items = (ratingRows.results || []).map(row => ({
    entry_id: row.entry_id,
    entry_title: row.entry_title,
    total: Number(row.total) || 0,
    helpful: Number(row.helpful) || 0,
    unresolved: Number(row.unresolved) || 0,
    reasons: byEntry.get(row.entry_id) || {}
  }));
  return json(request, env, { ok: true, period, items });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      if (!allowedOrigins(env).includes(request.headers.get('Origin') || '')) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, { status: 204, headers: cors(request, env) });
    }
    if (url.pathname === '/health' && request.method === 'GET') {
      return json(request, env, { ok: true, service: 'guide-feedback' });
    }
    try {
      if (url.pathname === '/api/ratings/availability' && request.method === 'GET') {
        return await ratingsAvailable(request, env);
      }
      if (url.pathname === '/api/ratings' && request.method === 'POST') {
        return await submitRating(request, env);
      }
      if (url.pathname === '/api/admin/ratings' && request.method === 'GET') {
        return await adminRatings(request, env, url);
      }
      if (url.pathname === '/api/comments' && request.method === 'GET') {
        if (!env.DB) return bad(request, env, '資料庫尚未設定', 503);
        return await publicComments(request, env, url);
      }
      if (url.pathname === '/api/comments' && request.method === 'POST') {
        return await submitComment(request, env);
      }
      if (url.pathname === '/api/admin/comments' && request.method === 'GET') {
        if (!env.DB) return bad(request, env, '資料庫尚未設定', 503);
        return await adminPending(request, env, url);
      }
      if (url.pathname.startsWith('/api/admin/comments/') && request.method === 'POST') {
        if (!env.DB) return bad(request, env, '資料庫尚未設定', 503);
        return await adminModerate(request, env, url);
      }
      return bad(request, env, '找不到這個服務', 404);
    } catch (error) {
      console.error('Guide feedback Worker error:', error?.message || String(error));
      return bad(request, env, '留言服務暫時無法使用，請稍後再試', 500);
    }
  }
};
