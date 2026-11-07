// Read-only article inventory from the published public GitHub main branch.
// An optional server-side GitHub token can authenticate read calls when shared Cloudflare
// IPs hit GitHub's anonymous API rate limit; the token is never returned to browsers.
const DIR='https://api.github.com/repos/minrhome-nlica/local-practice-guide/contents/src/content/entries?ref=main';
const RAW='https://raw.githubusercontent.com/minrhome-nlica/local-practice-guide/main/src/content/entries/';
const FILE='https://github.com/minrhome-nlica/local-practice-guide/blob/main/src/content/entries/';
const TTL=15*60*1000;
const PUBLIC_SITEMAP='https://guide.mountcounty.com/sitemap.xml';
const GH_API_ROOT='https://api.github.com/repos/minrhome-nlica/local-practice-guide/contents/src/content/entries/';
const githubHeaders=env=>{
  const headers={Accept:'application/vnd.github+json','User-Agent':'local-practice-guide-admin'};
  const token=typeof env?.GITHUB_EDITOR_TOKEN==='string'?env.GITHUB_EDITOR_TOKEN.trim():'';
  // Never put tokens in browser-side JavaScript, logs, or requests to non-GitHub hosts.
  if(token)headers.Authorization='Bearer '+token;
  return headers;
};
function sitemapNames(xml){
  const names=new Set();
  for(const [,slug] of String(xml||'').matchAll(
    /<loc>https:\/\/guide\.mountcounty\.com\/entries\/([a-z0-9-]+)\/<\/loc>/g
  )){
    if(nameOk(slug+'.md'))names.add(slug+'.md');
  }
  return [...names].slice(0,45);
}
async function publicListing(fetcher){
  try{
    const response=await fetcher(PUBLIC_SITEMAP,{
      headers:{Accept:'application/xml'},signal:AbortSignal.timeout(11000)
    });
    if(!response.ok)return null;
    const names=sitemapNames(await response.text());
    return names.length?names:null;
  }catch{return null;}
}
let cache={until:0,items:null};
const clean=(s,n=180)=>String(s||'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,n);
const nameOk=name=>/^[a-z0-9][a-z0-9-]{1,85}\.md$/.test(name);
function parseFrontmatter(text,slug) {
  const prefix=String(text||'').slice(0,6000);
  const m=/^---\r?\n([\s\S]*?)\r?\n---/.exec(prefix);
  const fields={};
  if(m)for(const line of m[1].split(/\r?\n/)){
    const field=/^([a-z]+):\s*(.*?)\s*$/.exec(line);
    if(field)fields[field[1]]=field[2].replace(/^["']|["']$/g,'');
  }
  return {
    slug,
    title:clean(fields.title||slug,110),
    category:clean(fields.category||'未分類',38),
    summary:clean(fields.summary||'',170),
    updated:/^\d{4}-\d\d-\d\d$/.test(fields.updated||'')?fields.updated:'',
    editorial_status:clean(fields.status||'未標示',40),
    source_url:FILE+encodeURIComponent(slug)+'.md',
    // The underlying GitHub Pages site remains the source of published files.
    is_published_in_main:true
  };
}
function failure(msg,status=502){return {status,body:{ok:false,error:msg}};}
export async function listArticles(fetcher=fetch,env={}) {
  const useCache=fetcher===fetch;
  if(useCache && cache.items && cache.until>Date.now()){
    return {status:200,body:{ok:true,items:cache.items,total:cache.items.length,source:'GitHub main'}};
  }
  let names=null, listingSource='GitHub main';
  try{
    let response=await fetcher(DIR,{
      headers:githubHeaders(env),
      signal:AbortSignal.timeout(12000)
    });
    // A newly provisioned token might be scoped to the wrong owner/repository.
    // Public read is still safe and can recover without requiring extra permissions.
    if(!response.ok && githubHeaders(env).Authorization){
      response=await fetcher(DIR,{
        headers:githubHeaders({}),signal:AbortSignal.timeout(12000)
      });
    }
    if(response.ok){
      const files=await response.json();
      if(Array.isArray(files)){
        names=files.filter(x=>x?.type==='file'&&nameOk(x.name)).map(x=>x.name).slice(0,60);
      }
    }
  }catch{
    // GitHub's shared-IP rate limiting or a transient network failure should not
    // make an otherwise healthy public site appear to have no article catalog.
  }
  if(!names){
    names=await publicListing(fetcher);
    listingSource='Public sitemap / GitHub main';
  }
  if(!names)return failure('文章清單暫時無法取得：GitHub API 與公開網站地圖均未能讀取。請稍後重新整理。');
  const items=[];
  // Cloudflare Worker free-plan subrequest ceiling: at most 1 + 60, but current
  // site has 21 entries. Limit to 45 for predictable cost and latency.
  const safeNames=names.slice(0,45);
  for(let start=0;start<safeNames.length;start+=6){
    const batch=safeNames.slice(start,start+6);
    const results=await Promise.all(batch.map(async name=>{
      const slug=name.slice(0,-3);
      try{
        const response=await fetcher(RAW+encodeURIComponent(name),{
          headers:{Accept:'text/plain'},
          signal:AbortSignal.timeout(10000)
        });
        if(response.ok){
          const text=await response.text();
          return parseFrontmatter(text,slug);
        }
      }catch{
        // Try the authenticated Contents API only when the raw endpoint failed.
      }
      try{
        const response=await fetcher(GH_API_ROOT+encodeURIComponent(name)+'?ref=main',{
          headers:githubHeaders(env),signal:AbortSignal.timeout(10000)
        });
        if(response.ok){
          const file=await response.json();
          if(file?.encoding==='base64'&&typeof file.content==='string'){
            const raw=atob(file.content.replace(/\s/g,''));
            const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
            return parseFrontmatter(new TextDecoder('utf-8').decode(bytes),slug);
          }
        }
      }catch{}
      return parseFrontmatter('',slug);
    }));
    items.push(...results);
  }
  items.sort((a,b)=>b.updated.localeCompare(a.updated)||a.title.localeCompare(b.title,'zh-Hant'));
  if(useCache){cache={until:Date.now()+TTL,items};}
  return {status:200,body:{
    ok:true,items,total:items.length,source:listingSource,
    note:'這是已存在於網站程式 main 分支的文章清單。檔案中的「編輯稿」等狀態是內容註記，不代表尚未公開。編輯／發布審核功能仍需下一階段啟用。'
  }};
}
