// Cloudflare Web Analytics for the Access-protected guide administration Worker.
// Account and site tags are identifiers. API token must be a Worker SECRET.
const GRAPHQL_ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';
const PERIODS = new Set([7, 30]);
const CACHE_MS = 5 * 60 * 1000;
const cache = new Map();

// RUM browser beacons, NOT HTTP edge traffic. 'visits' is not unique visitors.
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

// Used ONLY when this site's GraphQL result is empty. We return a boolean,
// never traffic volumes or page paths from any other site in the account.
const RUM_ACCOUNT_PROBE = [
  'query GuideRUMProbe($accountTag: string!, $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject) {',
  '  viewer { accounts(filter: { accountTag: $accountTag }) {',
  '    sample: rumPageloadEventsAdaptiveGroups(filter: $filter, limit: 1) { count }',
  '  } }',
  '}'
].join('\n');

async function probeAccountHasRum(fetcher, token, accountTag, start, end) {
  try {
    const response = await fetcher(GRAPHQL_ENDPOINT, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + token },
      body:JSON.stringify({
        query:RUM_ACCOUNT_PROBE,
        variables:{accountTag,filter:{datetime_geq:start,datetime_leq:end}}
      }),
      signal:AbortSignal.timeout(12000)
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (Array.isArray(data?.errors) && data.errors.length) return null;
    const rows = data?.data?.viewer?.accounts?.[0]?.sample;
    if (!Array.isArray(rows)) return null;
    return rows.some(row => positive(row?.count) > 0);
  } catch { return null; }
}

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
function reportStatus(status, code, message) {
  return { status, body: { ok: status === 200, configured: false, code, message } };
}
function parseReport(data, period, start, end) {
  const account = data?.data?.viewer?.accounts?.[0];
  if (!account || !Array.isArray(account.total) || !Array.isArray(account.daily) ||
    !Array.isArray(account.topPaths)) {
    return reportStatus(502, 'invalid_response', 'Cloudflare 未傳回預期的網站分析資料，請檢查帳戶與站點設定。');
  }
  const daily = account.daily
    .filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r?.dimensions?.date || ''))
    .map(r => ({ date:r.dimensions.date, pageviews:positive(r.count), visits:positive(r.sum?.visits) }))
    .sort((a,b) => a.date.localeCompare(b.date));
  const pages = account.topPaths
    .map(r => ({ path:safePath(r?.dimensions?.requestPath), pageviews:positive(r.count) }))
    .filter(r => r.path)
    .slice(0, 12);
  const total = account.total[0];
  const hasEvents = positive(total?.count) > 0 ||
    daily.some(row => row.pageviews > 0) ||
    pages.some(row => row.pageviews > 0);
  return {
    status:200,
    body:{
      ok:true,
      configured:true,
      available:hasEvents,
      data_state:hasEvents ? 'events_found' : 'no_events',
      message:hasEvents ? '' : 'Cloudflare 已回應，但目前找不到這個網站在查詢期間的瀏覽紀錄。這不代表網站真的沒人閱讀，請核對 Cloudflare Web Analytics 的站點與追蹤設定。',
      source:'Cloudflare Web Analytics',
      period_days:period,
      since:start,
      until:end,
      updated_at:new Date().toISOString(),
      pageviews:positive(total?.count),
      visits:positive(total?.sum?.visits),
      daily,
      top_pages:pages,
      note:'瀏覽量來自 Cloudflare 的瀏覽器追蹤資料；訪問次數不等於不重複訪客。'
    }
  };
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
  const siteTag = validTag(env.WEB_ANALYTICS_SITE_TAG);
  if (!accountTag || !siteTag) {
    return reportStatus(503, 'missing_site', '請檢查 Cloudflare 帳戶及 Web Analytics 站點識別碼。');
  }
  const now = Date.now();
  const cached = cache.get(period);
  if (cached && cached.expiry > now) return { status:200, body:cached.body };
  const end = new Date(now).toISOString();
  const start = new Date(now - period * 86400000).toISOString();

  let response, data;
  try {
    response = await fetcher(GRAPHQL_ENDPOINT, {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':'Bearer ' + token
      },
      body:JSON.stringify({
        query:WEB_ANALYTICS_QUERY,
        variables:{
          accountTag,
          filter:{siteTag,datetime_geq:start,datetime_leq:end}
        }
      }),
      signal:AbortSignal.timeout(12000)
    });
    if (!response.ok) {
      return reportStatus(response.status === 401 || response.status === 403 ? 503 : 502,
        'analytics_api', 'Cloudflare 分析 API 驗證或連線失敗，請檢查唯讀權杖權限。');
    }
    data = await response.json();
  } catch {
    return reportStatus(502, 'network', '暫時無法讀取 Cloudflare 網站分析，請稍後再試。');
  }
  if (Array.isArray(data?.errors) && data.errors.length) {
    return reportStatus(502, 'graphql', 'Cloudflare 分析查詢失敗，請檢查站點權限與可用的資料期間。');
  }
  const result = parseReport(data, period, start, end);
  if (result.status === 200 && result.body.available === false && period === 30) {
    const accountHasRum = await probeAccountHasRum(fetcher,token,accountTag,start,end);
    result.body.account_rum_detected = accountHasRum;
    if (accountHasRum === true) {
      result.body.diagnostic = 'Cloudflare 帳戶內有 Web Analytics 紀錄，但以目前指南站點標籤查不到。請核對 Cloudflare Web Analytics「管理站點」中的追蹤 Token 是否與網站安裝的標籤一致。';
    } else if (accountHasRum === false) {
      result.body.diagnostic = 'Cloudflare 帳戶目前也沒有可用的 Web Analytics 追蹤紀錄。請確認正式網站已開始傳送瀏覽器追蹤資料，並在 Cloudflare Web Analytics 原始儀表板確認。';
    } else {
      result.body.diagnostic = '目前無法完成站點來源的交叉檢查，請以 Cloudflare Web Analytics 原始儀表板確認。';
    }
  }
  if (result.status === 200) cache.set(period, { expiry: now + CACHE_MS, body:result.body });
  return result;
}
