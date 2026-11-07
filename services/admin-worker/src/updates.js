// GitHub-powered internal release-note candidates.
// Read-only: commits from the PUBLIC main branch; no GitHub credentials.
// Nothing here is published as an official release announcement.
const URL = 'https://api.github.com/repos/minrhome-nlica/local-practice-guide/commits?sha=main&per_page=80';
const REPO = 'https://github.com/minrhome-nlica/local-practice-guide/commit/';
const CACHE_MS = 10 * 60 * 1000;
const cached = {expires:0, items:null};
const TYPES = new Set(['all','articles','feature','fix','maintenance']);
function clean(value,max=220) {
  return String(value||'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
}
function classify(title){
  const raw=String(title||'').trim();
  const pref=/^([a-z]+)(?:\(([^)]{1,60})\))?!?:\s*(.*)$/i.exec(raw);
  const type=pref?.[1]?.toLowerCase()||'';
  const scope=pref?.[2]?.toLowerCase()||'';
  const label=clean(pref?.[3]||raw,170);
  // Distinguish article publication from edits to code/docs.
  if (/^(content|article|entry|writing)$/.test(type) ||
    /^(content|entries|article|knowledge)$/.test(scope) ||
    /新增.{0,12}(文章|詞條|篇章)|文章.{0,8}(新增|更新|修訂)/.test(label)) {
    return {category:'articles',label:'文章與內容',important:type==='feat'||/新增/.test(label),title:label};
  }
  if (type==='feat'||/^(新增|加入|上線).{0,24}(功能|工具|計算機|後台)/.test(label)) {
    return {category:'feature',label:'功能新增',important:true,title:label};
  }
  if(type==='fix'||/^(修正|修復|改善).{0,24}(錯誤|功能|計算)/.test(label)){
    return {category:'fix',label:'功能修正',important:true,title:label};
  }
  return {category:'maintenance',label:'一般維護',important:false,title:label};
}
export function toUpdateCandidates(commits){
  if(!Array.isArray(commits))return [];
  return commits.flatMap(commit=>{
    const sha=String(commit?.sha||'');
    if(!/^[0-9a-f]{40}$/i.test(sha))return [];
    const raw=String(commit?.commit?.message||'');
    const first=raw.split(/\r?\n/)[0]||'';
    if(!first.trim())return [];
    const authorDate=commit?.commit?.committer?.date||commit?.commit?.author?.date||'';
    const date=new Date(authorDate);
    if(!Number.isFinite(date.getTime()))return [];
    const item=classify(first);
    return [{
      sha:sha.slice(0,10),title:item.title,category:item.category,
      category_label:item.label,important:item.important,
      date:date.toISOString(),url:REPO+sha
    }];
  });
}

export async function recentUpdates(url,fetcher=fetch){
  const type=String(url.searchParams.get('type')||'all');
  if(!TYPES.has(type))return {status:400,body:{ok:false,error:'更新分類不正確。'}};
  const useCache=fetcher===fetch;
  let items=useCache&&cached.items&&cached.expires>Date.now()?cached.items:null;
  if(!items){
    let response;
    try{
      response=await fetcher(URL,{
        headers:{Accept:'application/vnd.github+json','User-Agent':'local-practice-guide-admin'},
        signal:AbortSignal.timeout(12000)
      });
      if(!response.ok)throw new Error('GitHub '+response.status);
      const data=await response.json();
      if(!Array.isArray(data))throw new Error('Invalid response');
      items=toUpdateCandidates(data);
      if(useCache){cached.items=items;cached.expires=Date.now()+CACHE_MS;}
    }catch{
      return {status:502,body:{ok:false,error:'暫時無法讀取 GitHub 更新紀錄，請稍後重試。'}};
    }
  }
  const filtered=items.filter(row=>type==='all'||row.category===type);
  return {status:200,body:{
    ok:true,items:filtered.slice(0,60),total:filtered.length,
    source:'GitHub main branch',
    warning:'以下是依 GitHub 提交紀錄整理的內部候選清單，尚未由管理員核定，不會自動發布到公開網站。'
  }};
}
