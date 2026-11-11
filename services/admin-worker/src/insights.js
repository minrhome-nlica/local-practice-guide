// Evidence-based editorial insights. Counts, not individual reader identities.
// Cloudflare's top_pages is TOP-12 only; missing a page is NOT zero views.
import { queryWebAnalytics } from './analytics.js';

const VALID_DAYS = new Set([7,30]);
const VALID_ENTRY = /^[a-z0-9][a-z0-9-]{1,85}$/;
const positive = value => Number.isFinite(Number(value)) ? Math.max(0,Math.trunc(Number(value))) : 0;

export function combineInsights(ratings,feedback,analytics,days) {
  const articles=new Map();
  function ensure(id,title=''){
    if(!VALID_ENTRY.test(String(id||'')))return null;
    if(!articles.has(id)){
      articles.set(id,{
        slug:id,title:String(title||id).slice(0,120),helpful:0,unresolved:0,
        total_feedback:0,pending_comments:0,published_comments:0,
        pageviews:null,reason_counts:{}
      });
    }
    const row=articles.get(id);
    if(title&&row.title===id)row.title=String(title).slice(0,120);
    return row;
  }
  for(const item of ratings){
    const row=ensure(item.entry_id,item.entry_title);
    if(!row)continue;
    row.helpful=positive(item.helpful);
    row.unresolved=positive(item.unresolved);
    row.total_feedback=positive(item.total);
  }
  for(const item of feedback){
    const row=ensure(item.entry_id,item.entry_title);
    if(!row)continue;
    row.pending_comments=positive(item.pending);
    row.published_comments=positive(item.published);
  }
  const reasonsByArticle=new Map();
  for(const r of (analytics?.rating_reasons||[])){
    const id=String(r.entry_id||'');
    if(!VALID_ENTRY.test(id)||!/^([a-z_]{1,50})$/.test(String(r.reason||'')))continue;
    const map=reasonsByArticle.get(id)||{};
    map[r.reason]=positive(r.n);
    reasonsByArticle.set(id,map);
  }
  for(const [id,reasons] of reasonsByArticle){
    const row=ensure(id);
    if(row)row.reason_counts=reasons;
  }
  if(analytics?.available){
    for(const item of analytics.top_pages||[]){
      const match=/^\/entries\/([a-z0-9-]{2,86})\/?$/.exec(String(item.path||''));
      if(!match)continue;
      const row=ensure(match[1]);
      if(row)row.pageviews=positive(item.pageviews);
    }
  }
  const rows=[...articles.values()].map(row=>({
    ...row,
    helpful_percent:row.total_feedback
      ?Math.round(100*row.helpful/row.total_feedback):null,
    sample_small:row.total_feedback<10,
    // Raw counts only. A page with 1 negative vote is not treated as 100% certain.
    attention_count:row.unresolved+row.pending_comments
  }));
  rows.sort((a,b)=>b.attention_count-a.attention_count||
    b.unresolved-a.unresolved||b.total_feedback-a.total_feedback||
    a.slug.localeCompare(b.slug));
  return {
    period_days:days,
    articles:rows,
    summary:{
      rated_articles:rows.filter(x=>x.total_feedback>0).length,
      total_ratings:rows.reduce((s,r)=>s+r.total_feedback,0),
      unresolved:rows.reduce((s,r)=>s+r.unresolved,0),
      pending_comments:rows.reduce((s,r)=>s+r.pending_comments,0)
    },
    analytics:{
      available:!!analytics?.available,
      configured:!!analytics?.configured,
      pageviews:analytics?.available?positive(analytics.pageviews):null,
      visits:analytics?.available?positive(analytics.visits):null,
      top_pages_only:true,
      note:'單篇瀏覽量只涵蓋 Cloudflare 回傳的熱門頁面；未列入熱門頁面不等於零次瀏覽。',
      message:String(analytics?.message||'').slice(0,350)
    }
  };
}

export async function getContentInsights(env,url,cloudflare=queryWebAnalytics){
  const days=Number(url.searchParams.get('days')||'30');
  if(!VALID_DAYS.has(days)){
    return {status:400,body:{ok:false,error:'分析期間限最近 7 天或 30 天。'}};
  }
  const cutoff=new Date(Date.now()-days*86400000).toISOString();
  const [ratingRows,commentRows,reasonRows,visits]=await Promise.all([
    env.DB.prepare(
      'SELECT entry_id, MAX(entry_title) AS entry_title, COUNT(*) AS total,'+
      " SUM(CASE WHEN vote='helpful' THEN 1 ELSE 0 END) AS helpful,"+
      " SUM(CASE WHEN vote='unresolved' THEN 1 ELSE 0 END) AS unresolved"+
      ' FROM article_ratings WHERE updated_at >= ? GROUP BY entry_id LIMIT 250'
    ).bind(cutoff).all(),
    env.DB.prepare(
      'SELECT entry_id, MAX(entry_title) AS entry_title,'+
      " SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,"+
      " SUM(CASE WHEN status IN ('approved','resolved') THEN 1 ELSE 0 END) AS published"+
      ' FROM feedback GROUP BY entry_id LIMIT 250'
    ).all(),
    env.DB.prepare(
      "SELECT entry_id,reason,COUNT(*) AS n FROM article_ratings "+
      "WHERE vote='unresolved' AND reason<>'' AND updated_at >= ? "+
      "GROUP BY entry_id,reason LIMIT 1000"
    ).bind(cutoff).all(),
    cloudflare(env,new URL('https://admin.local/api/analytics?days='+days))
  ]);
  const merged=combineInsights(ratingRows.results||[],commentRows.results||[],
    {...(visits.body||{}),rating_reasons:reasonRows.results||[]},days);
  return {status:200,body:{ok:true,...merged,updated_at:new Date().toISOString(),
    disclaimer:'文章回饋依最後更新時間統計；留言待審為目前存量，不是期間新增量。Cloudflare 流量是追蹤資料，與 Google Search Console 的搜尋點擊不同。'}};
}
