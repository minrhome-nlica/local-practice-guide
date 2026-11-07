// Secure editorial workflow for the Access-protected admin Worker.
// GitHub main remains the single published source. D1 holds only working drafts.
// Only OWNER can create a PR and merge after the required SEO checks pass.
const REPO='minrhome-nlica/local-practice-guide';
const API='https://api.github.com/repos/'+REPO;
const PATH='src/content/entries/';
const GH_REPO='https://github.com/'+REPO;
const SIZES={body:120000,note:900};
const VALID_STATUSES=new Set(['draft','submitted','changes_requested','pr_open','published','cancelled']);
const LIMIT=120;
const encoder=new TextEncoder();
const decoder=new TextDecoder('utf-8',{fatal:true});
const validSlug=x=>typeof x==='string'&&/^[a-z0-9][a-z0-9-]{1,83}$/.test(x);
const validId=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const validSha=x=>typeof x==='string'&&/^[0-9a-f]{40}$/i.test(x);
const now=()=>new Date().toISOString();
const result=(status,error,code)=>({status,body:{ok:false,error,code}});
const success=(data={},status=200)=>({status,body:{ok:true,...data}});
const inputError=msg=>result(400,msg,'invalid_input');
const missingDb=()=>result(503,'文章草稿資料表尚未初始化。請先由管理員備份 D1，執行第二階段 SQL。','migration_required');
function validateBody(body){
  if(typeof body!=='string'||!body.trim()||encoder.encode(body).length>SIZES.body){
    return '文章內容不能為空，也不能超過 120 KB。';
  }
  // Published Markdown may contain HTML for tables and formatting; block code
  // execution and iframe/embed primitives rather than stripping legitimate tables.
  if(/<\s*\/?\s*(script|iframe|object|embed|form|input|button|meta|link|base)\b/i.test(body)||
    /<[^>]+\bon[a-z]+\s*=/i.test(body)||
    /\b(?:javascript|data)\s*:/i.test(body)||
    /<\s*\/?\s*style\b/i.test(body)){
    return '草稿包含不允許的可執行 HTML。請移除 script、iframe、事件屬性或其他不安全內容。';
  }
  if(/^\uFEFF?---\s*$/m.test(body.slice(0,50)) && body.trimStart().startsWith('---')){
    return '只能編輯 Markdown 文章正文，不可貼入檔頭的 --- 設定。';
  }
  return '';
}
function splitMarkdown(markdown){
  const match=/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
  if(!match)throw Error('missing_frontmatter');
  const header=match[0];
  const body=markdown.slice(match[0].length);
  const name=/^title:\s*(.+)$/m.exec(match[1])?.[1]?.trim()||'';
  return {header,body,title:name.slice(0,140)};
}
function updateArticleDate(header){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',
    year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const dateParts=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  const today=dateParts.year+'-'+dateParts.month+'-'+dateParts.day;
  const match=/(^|\n)(updated:\s*)(\d{4}-\d{2}-\d{2})(?=\r?\n|$)/;
  if(!match.test(header))throw Error('missing_updated_date');
  return header.replace(match,(_whole,prefix,key)=>prefix+key+today);
}
function utf8FromB64(value){
  if(typeof value!=='string'||value.length>250000)throw Error('invalid_base64');
  const raw=atob(value.replace(/\s/g,''));
  const bytes=Uint8Array.from(raw,x=>x.charCodeAt(0));
  return decoder.decode(bytes);
}
function utf8ToB64(value){
  const bytes=encoder.encode(value);
  let binary='';
  for(let i=0;i<bytes.length;i+=8192){
    binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  }
  return btoa(binary);
}
function githubToken(env){return String(env.GITHUB_EDITOR_TOKEN||'').trim();}
async function gh(fetcher,env,method,path,payload=null){
  const token=githubToken(env);
  const headers={
    'Accept':'application/vnd.github+json',
    'User-Agent':'local-practice-guide-editor',
    'X-GitHub-Api-Version':'2022-11-28'
  };
  if(token)headers.Authorization='Bearer '+token;
  if(payload!==null)headers['Content-Type']='application/json';
  let res;
  try{
    res=await fetcher(API+path,{
      method,headers,...(payload!==null?{body:JSON.stringify(payload)}:{}),
      signal:AbortSignal.timeout(15000)
    });
  }catch{return {error:'connection',status:502};}
  if(!res.ok)return {error:'http',status:res.status};
  try{return{data:await res.json(),status:res.status};}
  catch{return {error:'decode',status:502};}
}
function apiFailure(r,action='讀取 GitHub'){
  if(r.status===401||r.status===403)return result(503,action+'失敗：請管理員檢查 GitHub 權杖的範圍與權限。','github_auth');
  if(r.status===404)return result(404,action+'失敗：找不到對應的資料。','github_not_found');
  if(r.status===409||r.status===422)return result(409,action+'遇到版本或分支衝突，請重新整理後再處理。','github_conflict');
  return result(502,action+'暫時失敗，請稍後再試。','github_error');
}
async function fetchArticle(env,slug,fetcher,ref='main'){
  if(!validSlug(slug))return {error:inputError('文章識別碼不正確。')};
  const request='/contents/'+PATH+slug+'.md?ref='+encodeURIComponent(ref);
  const out=await gh(fetcher,env,'GET',request);
  if(out.error)return {error:apiFailure(out,'讀取文章原始檔')};
  const d=out.data;
  if(!validSha(d?.sha)||d?.type!=='file'||d?.encoding!=='base64'){
    return {error:result(502,'GitHub 文章原始檔格式不符合預期。','invalid_source')};
  }
  let full;
  try{full=utf8FromB64(d.content);}catch{
    return {error:result(502,'文章原始檔無法以 UTF-8 解析。','invalid_source')};
  }
  let source;
  try{source=splitMarkdown(full);}catch{
    return {error:result(502,'文章未包含可辨識的 Markdown 檔頭。','invalid_source')};
  }
  return {sha:d.sha,full,slug,source};
}
async function isReady(env){
  try{
    await env.DB.prepare('SELECT id FROM article_drafts LIMIT 1').first();
    return true;
  }catch{return false;}
}
async function readDraft(env,id){
  return env.DB.prepare('SELECT * FROM article_drafts WHERE id=?').bind(id).first();
}
function owned(user,row){return user.role==='owner'||row?.author_email===user.email;}
function normalizeDraft(row,includeBody=false){
  const output={
    id:row.id,slug:row.slug,title:row.title,status:row.status,
    author_email:row.author_email,reviewer_email:row.reviewer_email,
    review_note:row.review_note||'',revision:Number(row.revision),
    created_at:row.created_at,updated_at:row.updated_at,
    submitted_at:row.submitted_at,reviewed_at:row.reviewed_at,
    published_at:row.published_at,pr_number:row.pr_number,
    pr_url:row.pr_url,pr_head_sha:row.pr_head_sha,
    publish_sha:row.publish_sha,base_sha:row.base_sha
  };
  if(includeBody){
    output.original_body=row.original_body;
    output.draft_body=row.draft_body;
  }
  return output;
}
async function record(env,user,action,id,summary=''){
  await env.DB.prepare(
    'INSERT INTO admin_audit (id,actor_email,action,entity,entity_id,details,created_at) VALUES (?,?,?,?,?,?,?)'
  ).bind(crypto.randomUUID(),user.email,action,'article_draft',id,String(summary).slice(0,480),now()).run();
}
function checkRevision(input,row){
  return Number.isSafeInteger(input?.revision)&&input.revision===Number(row.revision);
}
function listAllowedStatuses(status){
  return status==='all'||VALID_STATUSES.has(status);
}
export async function editorRoute(env,user,request,url,fetcher=fetch){
  const method=request.method,path=url.pathname;
  if(user.role!=='owner'&&user.role!=='editor'){
    return result(403,'沒有文章編輯與送審權限。','forbidden');
  }
  if(path==='/api/editor/config'&&method==='GET'){
    return success({drafts_ready:await isReady(env),github_ready:!!githubToken(env),
      warning:'發布由最高管理員核准。草稿儲存在 D1，正式文章只會透過 GitHub Pull Request 及通過檢查後合併到 main。'});
  }
  if(path==='/api/editor/source'&&method==='GET'){
    const slug=url.searchParams.get('slug');
    const article=await fetchArticle(env,slug,fetcher);
    if(article.error)return article.error;
    return success({slug,title:article.source.title,
      body:article.source.body,base_sha:article.sha,
      source_url:GH_REPO+'/blob/main/'+PATH+slug+'.md'});
  }
  if(!(await isReady(env)))return missingDb();
  if(path==='/api/editor/drafts'&&method==='GET'){
    const status=url.searchParams.get('status')||'all';
    if(!listAllowedStatuses(status))return inputError('草稿狀態不正確。');
    const filters=[],args=[];
    if(user.role!=='owner'){filters.push('author_email=?');args.push(user.email);}
    if(status!=='all'){filters.push('status=?');args.push(status);}
    const where=filters.length?' WHERE '+filters.join(' AND '):'';
    const rows=await env.DB.prepare(
      'SELECT id,slug,title,status,author_email,reviewer_email,review_note,revision,'+
      'created_at,updated_at,submitted_at,reviewed_at,published_at,pr_number,pr_url,'+
      'pr_head_sha,publish_sha,base_sha FROM article_drafts'+where+
      ' ORDER BY updated_at DESC LIMIT '+LIMIT
    ).bind(...args).all();
    return success({items:(rows.results||[]).map(r=>normalizeDraft(r)),total:(rows.results||[]).length});
  }
  const idMatch=/^\/api\/editor\/drafts\/([0-9a-f-]{36})(?:\/([a-z-]+))?$/.exec(path);
  if(method==='GET'&&idMatch&&!idMatch[2]){
    const id=idMatch[1];if(!validId(id))return inputError('草稿 ID 不正確。');
    const row=await readDraft(env,id);
    if(!row)return result(404,'找不到此草稿。','not_found');
    if(!owned(user,row))return result(403,'只能查看自己的草稿。','forbidden');
    return success({draft:normalizeDraft(row,true)});
  }
  if(method!=='POST')return result(404,'沒有這個文章編輯操作。','not_found');
  let input;
  try{
    const raw=await request.text();
    if(encoder.encode(raw).length>160000){
      return result(413,'文章編輯請求超過 160 KB 上限。','too_large');
    }
    input=JSON.parse(raw);
  }catch{return inputError('文章草稿資料格式不正確。');}
  if(!input||typeof input!=='object'||Array.isArray(input))return inputError('文章草稿資料格式不正確。');
  if(path==='/api/editor/drafts'){
    const slug=input.slug;
    if(!validSlug(slug)||!validSha(input.base_sha))return inputError('文章或原始版本資訊不正確。');
    const bodyError=validateBody(input.body);
    if(bodyError)return inputError(bodyError);
    const active=await env.DB.prepare(
      "SELECT id FROM article_drafts WHERE slug=? AND author_email=? AND status NOT IN ('published','cancelled') LIMIT 1"
    ).bind(slug,user.email).first();
    if(active)return result(409,'你已經有這篇文章的草稿，請從草稿清單繼續編輯。','active_draft');
    const article=await fetchArticle(env,slug,fetcher);
    if(article.error)return article.error;
    if(article.sha!==input.base_sha){
      return result(409,'文章在你開啟後已有更新，請重新載入最新版。','stale_source');
    }
    if(article.source.body===input.body){
      return inputError('內容尚未修改，無須建立草稿。');
    }
    const id=crypto.randomUUID(),stamp=now();
    await env.DB.prepare(
      'INSERT INTO article_drafts (id,slug,title,base_sha,original_body,draft_body,status,author_email,revision,'+
      'created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,1,?,?)'
    ).bind(id,slug,article.source.title,article.sha,article.source.body,input.body,
      'draft',user.email,stamp,stamp).run();
    await record(env,user,'draft_created',id,slug);
    return success({draft_id:id,revision:1},201);
  }
  if(!idMatch||!idMatch[2]||!validId(idMatch[1])){
    return result(404,'找不到這項草稿操作。','not_found');
  }
  const [_,id,action]=idMatch;
  const row=await readDraft(env,id);
  if(!row)return result(404,'找不到此草稿。','not_found');
  if(!owned(user,row))return result(403,'只能修改自己建立的草稿。','forbidden');
  if(!checkRevision(input,row))return result(409,'草稿已被更新，請重新開啟，避免覆蓋新版本。','stale_revision');

  if(action==='save'){
    if(row.author_email!==user.email||!['draft','changes_requested'].includes(row.status)){
      return result(409,'只有原作者能繼續編輯草稿或被退回的文章。','invalid_status');
    }
    const err=validateBody(input.body);
    if(err)return inputError(err);
    const stamp=now(),next=Number(row.revision)+1;
    const done=await env.DB.prepare(
      "UPDATE article_drafts SET draft_body=?,updated_at=?,revision=? WHERE id=? AND revision=? AND status IN ('draft','changes_requested')"
    ).bind(input.body,stamp,next,id,row.revision).run();
    if(!done.meta?.changes)return result(409,'草稿已被其他操作更新。','stale_revision');
    await record(env,user,'draft_saved',id,row.slug);
    return success({revision:next,updated_at:stamp});
  }

  if(action==='submit'){
    if(row.author_email!==user.email||!['draft','changes_requested'].includes(row.status)){
      return result(409,'只有原作者可以送出可編輯的草稿。','invalid_status');
    }
    if(row.original_body===row.draft_body)return inputError('草稿沒有任何修改。');
    const article=await fetchArticle(env,row.slug,fetcher);
    if(article.error)return article.error;
    if(article.sha!==row.base_sha){
      return result(409,'正式文章已更新，這份草稿的原始版本過期。請重新比對後另建草稿。','stale_source');
    }
    const stamp=now(),next=Number(row.revision)+1;
    const done=await env.DB.prepare(
      "UPDATE article_drafts SET status='submitted',review_note='',reviewer_email=NULL,reviewed_at=NULL,submitted_at=?,updated_at=?,revision=? "+
      "WHERE id=? AND revision=? AND status IN ('draft','changes_requested')"
    ).bind(stamp,stamp,next,id,row.revision).run();
    if(!done.meta?.changes)return result(409,'草稿已更新，請重新載入。','stale_revision');
    await record(env,user,'draft_submitted',id,row.slug);
    return success({revision:next,status:'submitted'});
  }

  if(action==='cancel'){
    if(!['draft','changes_requested','submitted'].includes(row.status)){
      return result(409,'只有尚未建立 GitHub PR 的草稿可以取消。','invalid_status');
    }
    if(row.author_email!==user.email&&user.role!=='owner'){
      return result(403,'不能取消他人的草稿。','forbidden');
    }
    const stamp=now(),next=Number(row.revision)+1;
    const done=await env.DB.prepare(
      "UPDATE article_drafts SET status='cancelled',updated_at=?,revision=? "+
      "WHERE id=? AND revision=? AND status IN ('draft','changes_requested','submitted')"
    ).bind(stamp,next,id,row.revision).run();
    if(!done.meta?.changes)return result(409,'草稿已由其他人更新，請重新載入。','stale_revision');
    await record(env,user,'draft_cancelled',id,row.slug);
    return success({status:'cancelled',revision:next});
  }

  if(action==='request-changes'){
    if(user.role!=='owner')return result(403,'只有最高管理員可以退回修改。','forbidden');
    if(row.status!=='submitted')return result(409,'只有待審核草稿可以退回。','invalid_status');
    const note=typeof input.note==='string'?input.note.trim():'';
    if(!note||note.length>SIZES.note)return inputError('請填寫 900 字以內的退回原因。');
    const stamp=now(),next=Number(row.revision)+1;
    const done=await env.DB.prepare(
      "UPDATE article_drafts SET status='changes_requested',review_note=?,reviewer_email=?,reviewed_at=?,updated_at=?,revision=? "+
      "WHERE id=? AND revision=? AND status='submitted'"
    ).bind(note,user.email,stamp,stamp,next,id,row.revision).run();
    if(!done.meta?.changes)return result(409,'草稿已由其他人處理。','stale_revision');
    await record(env,user,'changes_requested',id,row.slug+' / '+note);
    return success({status:'changes_requested',revision:next});
  }

  if(action==='approve'){
    if(user.role!=='owner')return result(403,'只有最高管理員可核准並建立 GitHub PR。','forbidden');
    if(row.status!=='submitted')return result(409,'只有待審核文章可以核准。','invalid_status');
    if(!githubToken(env))return result(503,'尚未設定 GITHUB_EDITOR_TOKEN，無法建立 GitHub Pull Request。','github_setup_required');
    // Pin the exact main commit before obtaining the file SHA. Never edit main directly.
    const mainRef=await gh(fetcher,env,'GET','/git/ref/heads/main');
    if(mainRef.error)return apiFailure(mainRef,'確認 GitHub main 版本');
    const baseCommit=mainRef.data?.object?.sha;
    if(!validSha(baseCommit))return result(502,'無法確認 GitHub 正式版本。','github_error');
    const article=await fetchArticle(env,row.slug,fetcher,baseCommit);
    if(article.error)return article.error;
    if(article.sha!==row.base_sha){
      return result(409,'GitHub 正式文章已變更，無法核准過期草稿。請重新整理與比對。','stale_source');
    }
    let updatedContent;
    try{updatedContent=updateArticleDate(article.source.header)+row.draft_body;}
    catch{return result(409,'文章檔頭缺少合法 updated 日期，請先由維護人員處理。','invalid_source');}
    const branch='guide-editor/'+row.id;
    const refCreate=await gh(fetcher,env,'POST','/git/refs',{ref:'refs/heads/'+branch,sha:baseCommit});
    if(refCreate.error)return apiFailure(refCreate,'建立文章審核分支');
    const fileSave=await gh(fetcher,env,'PUT','/contents/'+PATH+row.slug+'.md',{
      message:'content: update '+row.slug+' via reviewed editorial draft',
      branch,sha:row.base_sha,content:utf8ToB64(updatedContent)
    });
    if(fileSave.error)return apiFailure(fileSave,'將草稿提交到審核分支');
    const headSha=fileSave.data?.commit?.sha;
    if(!validSha(headSha))return result(502,'無法取得 GitHub 草稿提交版本，請人工檢查分支。','github_error');
    const pr=await gh(fetcher,env,'POST','/pulls',{
      title:'詞條修訂：'+row.title,
      head:branch,base:'main',draft:false,
      body:'由地方實踐指南管理後台建立。\n\n編輯人員：'+row.author_email+
        '\n核准管理員：'+user.email+'\n草稿 ID：'+row.id+
        '\n\n正式發布前請確認 GitHub 的 SEO 檢查與文章差異。'
    });
    if(pr.error)return apiFailure(pr,'建立 GitHub Pull Request');
    const number=pr.data?.number,prUrl=pr.data?.html_url;
    if(!Number.isInteger(number)||number<1||typeof prUrl!=='string'||
      !prUrl.startsWith(GH_REPO+'/pull/')){
      return result(502,'Pull Request 已送出但資料格式不完整，請人工檢查 GitHub。','github_error');
    }
    const stamp=now(),next=Number(row.revision)+1;
    const updated=await env.DB.prepare(
      "UPDATE article_drafts SET status='pr_open',reviewer_email=?,reviewed_at=?,pr_number=?,pr_url=?,pr_head_sha=?,updated_at=?,revision=? "+
      "WHERE id=? AND revision=? AND status='submitted'"
    ).bind(user.email,stamp,number,prUrl,headSha,stamp,next,id,row.revision).run();
    if(!updated.meta?.changes)return result(409,'PR 已建立，但草稿版本在過程中改變。請在 GitHub 手動檢查。','stale_revision');
    await record(env,user,'pr_created',id,row.slug+' / PR #'+number);
    return success({status:'pr_open',revision:next,pr_url:prUrl,pr_number:number});
  }

  if(action==='publish'){
    if(user.role!=='owner')return result(403,'只有最高管理員可以正式發布。','forbidden');
    if(row.status!=='pr_open'||!Number.isInteger(row.pr_number)||!validSha(row.pr_head_sha)){
      return result(409,'草稿尚未建立待合併 PR。','invalid_status');
    }
    if(!githubToken(env))return result(503,'尚未設定 GitHub 發布權杖。','github_setup_required');
    const pr=await gh(fetcher,env,'GET','/pulls/'+row.pr_number);
    if(pr.error)return apiFailure(pr,'查詢審核 PR');
    const item=pr.data;
    if(item?.state!=='open'||item?.head?.ref!=='guide-editor/'+id||
      item?.head?.sha!==row.pr_head_sha||item?.base?.ref!=='main'){
      return result(409,'PR 已關閉或版本變動，請先在 GitHub 核對。','pr_changed');
    }
    const latest=await fetchArticle(env,row.slug,fetcher);
    if(latest.error)return latest.error;
    if(latest.sha!==row.base_sha){
      return result(409,'正式文章在審核期間被其他人修改，已停止發布以避免覆蓋。','stale_source');
    }
    const checks=await gh(fetcher,env,'GET','/commits/'+row.pr_head_sha+'/check-runs?per_page=100');
    if(checks.error)return apiFailure(checks,'確認 GitHub 安全檢查');
    const runs=checks.data?.check_runs;
    if(!Array.isArray(runs)||!runs.some(x=>x.name==='check-seo'&&x.conclusion==='success')||
      runs.some(x=>x.status!=='completed'||!['success','neutral','skipped'].includes(x.conclusion))){
      return result(409,'GitHub SEO 或其他自動檢查尚未全部通過，暫不可發布。','checks_pending');
    }
    const merged=await gh(fetcher,env,'PUT','/pulls/'+row.pr_number+'/merge',{
      sha:row.pr_head_sha,merge_method:'squash',
      commit_title:'content: publish '+row.slug+' (admin approved)'
    });
    if(merged.error)return apiFailure(merged,'正式合併發布');
    if(!merged.data?.merged||!validSha(merged.data?.sha)){
      return result(502,'GitHub 尚未確認合併成功，請查看 PR 狀態。','github_error');
    }
    const stamp=now(),next=Number(row.revision)+1;
    const done=await env.DB.prepare(
      "UPDATE article_drafts SET status='published',publish_sha=?,published_at=?,updated_at=?,revision=? "+
      "WHERE id=? AND revision=? AND status='pr_open'"
    ).bind(merged.data.sha,stamp,stamp,next,id,row.revision).run();
    if(!done.meta?.changes)return result(409,'GitHub 已合併，但資料庫紀錄未更新。請聯繫管理員核對。','db_sync_required');
    await record(env,user,'draft_published',id,row.slug+' / PR #'+row.pr_number);
    return success({status:'published',revision:next,publish_sha:merged.data.sha,
      commit_url:GH_REPO+'/commit/'+merged.data.sha});
  }

  return result(404,'沒有這項草稿操作。','not_found');
}

export const editorInternals={
  validateBody,splitMarkdown,updateArticleDate,utf8FromB64,utf8ToB64,
  validSlug,validSha,normalizeDraft
};
