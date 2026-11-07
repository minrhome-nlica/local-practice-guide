// Cloudflare Web Analytics for the Access-protected guide administration Worker.
// Cloudflare's beacon SITE TOKEN and GraphQL SITE TAG are different resource IDs.
// Account/site identifiers are not credentials. API token must be a Worker SECRET.
const GRAPHQL_ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';
const PERIODS = new Set([7, 30]);
const CACHE_MS = 5 * 60 * 1000;
const DISCOVERY_CACHE_MS = 15 * 60 * 1000;
const cache = new Map();
const siteCache = new Map();

// RUM browser beacon stats, NOT HTTP edge traffic; visits != unique visitors.
export const WEB_ANALYTICS_QUERY = [
  'query GuideWebAnalytics($accountTag: string!, $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject) {',
  '  viewer {',
  '    accounts(filter: { accountTag: $accountTag }) {',
  '      total: rumPageloadEventsAdaptiveGroups(filter: $filter, limit: 1) { count sum { visits } }',
  '      daily: rumPageloadEventsAdaptiveGroups(filter: $filter, limit: 35, orderBy: [date_ASC]) {',
  '        count sum { visits } dimensions { date }',
  '      }',
  '      topPaths: rumPageloadEventsAdaptiveGroups(filter: $filter, limit: 12, orderBy: [count_DESC]) {',
  '        count dimensions { requestPath }',
  '      }',
  '    }',
  '  }',
  '}'
].join('\n');

// Discover the actual GraphQL siteTag using siteTag + requestHost, restricted
// to known public-guide hostnames; NEVER return other account properties' data.
export const WEB_ANALYTICS_DISCOVERY_QUERY = [
  'query GuideRUMSiteDiscovery($accountTag: string!, $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject) {',
  '  viewer { accounts(filter: { accountTag: $accountTag }) {',
  '    matches: rumPageloadEventsAdaptiveGroups(',
  '      filter: $filter, limit: 500, orderBy: [count_DESC]',
  '    ) { count dimensions { siteTag requestHost } }',
  '  } }',
  '}'
].join('\n');

function positive(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}
function validTag(value) {
  const tag = String(value || '').trim();
  return /^[0-9a-f]{32}$/i.test(tag) ? tag : '';
}
function safePath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '';
  if (/[\x00-\x1f\\]/.test(value)) return '';
  return value.split('?')[0].split('#')[0].slice(0, 300);
}
function siteHostnames(env) {
  let primary = '';
  try {
    const url = new URL(String(env.SITE_URL || ''));
    if (url.protocol === 'https:') primary = url.hostname.toLowerCase();
  } catch { /* No externally supplied hostname may be used as a fallback. */ }
  // Legacy GitHub Pages address is used for the same guide until the custom
  // domain is fully migrated. No other account hostname is eligible.
  const candidates = [primary, 'minrhome-nlica.github.io'];
  return [...new Set(candidates.filter(Boolean))];
}
function reportStatus(status, code, message) {
  return { status, body: { ok: status === 200, configured: false, code, message } };
}
async function cloudflareQuery(fetcher, token, query, variables) {
  try {
    const response = await fetcher(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) {
      return {
        data: null,
        code: response.status === 401 || response.status === 403 ? 'auth' : 'http'
      };
    }
    const json = await response.json();
    if (Array.isArray(json?.errors) && json.errors.length) return { data: null, code: 'graphql' };
    return { data: json?.data || null, code: null };
  } catch {
    return { data: null, code: 'network' };
  }
}

function parseReport(data, period, start, end, matchedHost) {
  const account = data?.viewer?.accounts?.[0];
  if (!account || !Array.isArray(account.total) || !Array.isArray(account.daily) ||
    !Array.isArray(account.topPaths)) {
    return reportStatus(502, 'invalid_response', 'Cloudflare 未傳回預期的網站分析資料，請檢查帳戶與站點設定。');
  }
  const daily = account.daily
    .filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r?.dimensions?.date || ''))
    .map(r => ({
      date: r.dimensions.date,
      pageviews: positive(r.count),
      visits: positive(r.sum?.visits)
    }))
    .sort((a,b) => a.date.localeCompare(b.date));
  const pages = account.topPaths
    .map(r => ({ path: safePath(r?.dimensions?.requestPath), pageviews: positive(r.count) }))
    .filter(r => r.path)
    .slice(0, 12);
  const total = account.total[0];
  const hasEvents = positive(total?.count) > 0 ||
    daily.some(row => row.pageviews > 0) ||
    pages.some(row => row.pageviews > 0);
  return {
    status: 200,
    body: {
      ok: true,
      configured: true,
      available: hasEvents,
      data_state: hasEvents ? 'events_found' : 'no_events',
      message: hasEvents ? '' :
        'Cloudflare 已回應，但目前找不到指南網站在查詢期間的瀏覽紀錄。請比對同一統計期間。',
      source: 'Cloudflare Web Analytics',
      matched_host: matchedHost || '',
      period_days: period,
      since: start,
      until: end,
      updated_at: new Date().toISOString(),
      pageviews: positive(total?.count),
      visits: positive(total?.sum?.visits),
      daily,
      top_pages: pages,
      note: '瀏覽量來自 Cloudflare 的瀏覽器追蹤資料；訪問次數不等於不重複訪客。'
    }
  };
}

// Resolves siteTag from the account's actual RUM event dimensions. The
// browser beacon's token is intentionally NEVER passed as GraphQL siteTag.
async function resolveSiteTag(env, accountTag, token, fetcher, now, useCache) {
  const explicitTag = validTag(env.WEB_ANALYTICS_SITE_TAG);
  const beaconToken = validTag(env.WEB_ANALYTICS_SITE_TOKEN);
  // Old deployments incorrectly set the beacon token as SITE_TAG. Even if
  // Cloudflare retains that stale variable, never use it as the GraphQL tag.
  if (explicitTag && explicitTag !== beaconToken) {
    return { tag: explicitTag, host: '', state: 'configured' };
  }
  const hosts = siteHostnames(env);
  if (!hosts.length) return { tag: '', host: '', state: 'missing_host' };
  const key = accountTag + ':' + hosts.join(',');
  const cached = useCache ? siteCache.get(key) : null;
  if (cached && cached.expiry > now) return cached.selection;
  // Look back a full month even when the panel is viewing the last 7 days.
  const discoveryStart = new Date(now - 30 * 86400000).toISOString();
  const discoveryEnd = new Date(now).toISOString();
  const discovery = await cloudflareQuery(
    fetcher, token, WEB_ANALYTICS_DISCOVERY_QUERY, {
      accountTag,
      filter: { datetime_geq: discoveryStart, datetime_leq: discoveryEnd }
    }
  );
  if (discovery.code) return { tag: '', host: '', state: 'discovery_error' };
  const rows = discovery.data?.viewer?.accounts?.[0]?.matches;
  if (!Array.isArray(rows)) return { tag: '', host: '', state: 'discovery_error' };
  let selection = { tag: '', host: '', state: rows.length ? 'no_matching_host' : 'no_account_events' };
  // Each candidate must have BOTH a valid Cloudflare siteTag and a known
  // public-guide hostname. Never guess based on the account's biggest site.
  for (const host of hosts) {
    const match = rows.find(row =>
      validTag(row?.dimensions?.siteTag) &&
      String(row?.dimensions?.requestHost || '').toLowerCase() === host &&
      positive(row?.count) > 0);
    if (match) {
      selection = { tag: validTag(match.dimensions.siteTag), host, state: 'matched' };
      break;
    }
  }
  if (useCache) siteCache.set(key, { expiry: now + DISCOVERY_CACHE_MS, selection });
  return selection;
}

export async function queryWebAnalytics(env, url, fetcher = fetch) {
  const period = Number(url.searchParams.get('days') || '7');
  if (!PERIODS.has(period)) return reportStatus(400, 'invalid_period', '只能查詢最近 7 天或 30 天。');
  const token = String(env.CLOUDFLARE_ANALYTICS_TOKEN || '').trim();
  if (!token) {
    return reportStatus(200, 'setup_required',
      '網站分析介面已安裝，尚需在 Cloudflare Worker Secrets 設定唯讀分析 API 權杖。');
  }
  const accountTag = validTag(env.CLOUDFLARE_ACCOUNT_ID);
  if (!accountTag) return reportStatus(503, 'missing_account', '請檢查 Cloudflare 帳戶識別碼。');

  const now = Date.now();
  const useCache = fetcher === fetch;
  const resolved = await resolveSiteTag(env, accountTag, token, fetcher, now, useCache);
  if (!resolved.tag) {
    const message = {
      no_matching_host: 'Cloudflare 帳戶內有網站分析資料，但無法對應到指南網站的網址。請核對指南站點的主機名稱與網站分析站點設定。',
      no_account_events: '最近 30 天 Cloudflare 帳戶內沒有可查詢的 RUM 紀錄，請核對原始 Web Analytics 統計期間。',
      discovery_error: '目前無法自動辨識 Cloudflare Web Analytics 站點，請核對帳戶分析權限及站點設定。',
      missing_host: '尚未設定可信任的網站網址。'
    }[resolved.state] || '網站分析站點尚未完成設定。';
    return {
      status: 200,
      body: {
        ok: true, configured: true, available: false,
        code: resolved.state, data_state: 'unresolved_site',
        period_days: period, message, diagnostic: message,
        daily: [], top_pages: []
      }
    };
  }
  const cacheKey = accountTag + ':' + resolved.tag + ':' + period;
  const cached = useCache ? cache.get(cacheKey) : null;
  if (cached && cached.expiry > now) return { status: 200, body: cached.body };
  const end = new Date(now).toISOString();
  const start = new Date(now - period * 86400000).toISOString();
  const query = await cloudflareQuery(fetcher, token, WEB_ANALYTICS_QUERY, {
    accountTag,
    filter: { siteTag: resolved.tag, datetime_geq: start, datetime_leq: end }
  });
  if (query.code) {
    return reportStatus(query.code === 'auth' ? 503 : 502, query.code,
      query.code === 'auth' ?
        'Cloudflare 分析 API 驗證失敗，請檢查唯讀權杖。' :
        '暫時無法讀取 Cloudflare 分析資料，請稍後再試。');
  }
  const result = parseReport(query.data, period, start, end, resolved.host);
  if (result.status === 200 && !result.body.available) {
    result.body.diagnostic = '已比對 Cloudflare 的真實 siteTag 與指南主機名稱，這個統計期間未傳回瀏覽紀錄。請切換到最近 30 天比對。';
  }
  if (useCache && result.status === 200) {
    cache.set(cacheKey, { expiry: now + CACHE_MS, body: result.body });
  }
  return result;
}
