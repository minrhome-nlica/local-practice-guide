// Secure editorial workflow for guide articles: D1 drafts -> owner-reviewed PR -> CI -> merge.
// Runs only behind Cloudflare Access AND the admin_users role allowlist (see index.js).
// A GitHub write token is NEVER sent to the browser or stored in D1.
const REPO = 'minrhome-nlica/local-practice-guide';
const API = 'https://api.github.com/repos/' + REPO;
const READABLE = 'https://github.com/' + REPO;
const MAX_MARKDOWN = 190000;
const ID = /^[a-f0-9-]{36}$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{1,85}$/;
const ACTIVE = ['draft','review','changes_requested','staged'];
const ROLES = ['owner','editor'];

const definitions = [
  "CREATE TABLE IF NOT EXISTS admin_article_drafts (" +
  "id TEXT PRIMARY KEY,slug TEXT NOT NULL,source_sha TEXT NOT NULL," +
  "original_text TEXT NOT NULL,content TEXT NOT NULL," +
  "status TEXT NOT NULL CHECK(status IN ('draft','review','changes_requested','staged','published','cancelled'))," +
  "author_email TEXT NOT NULL,updated_by TEXT NOT NULL," +
  "reviewed_by TEXT NOT NULL DEFAULT '',review_note TEXT NOT NULL DEFAULT ''," +
  "revision INTEGER NOT NULL DEFAULT 1,pr_number INTEGER NOT NULL DEFAULT 0," +
  "pr_head_sha TEXT NOT NULL DEFAULT '',pr_url TEXT NOT NULL DEFAULT ''," +
  "published_commit TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL," +
  "submitted_at TEXT NOT NULL DEFAULT '',published_at TEXT NOT NULL DEFAULT '')",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_article_drafts_one_active " +
    "ON admin_article_drafts(slug) WHERE status NOT IN ('published','cancelled')",
  "CREATE INDEX IF NOT EXISTS idx_admin_article_drafts_status " +
    "ON admin_article_drafts(status,updated_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_admin_article_drafts_author " +
    "ON admin_article_drafts(author_email,updated_at DESC)"
];

const ok = (payload={},status=200)=>({status,body:{ok:true,...payload}});
const fail = (status,error,code='invalid')=>({status,body:{ok:false,error,code}});
const clean = (v,max=160)=>typeof v==='string'?v.trim().slice(0,max):'';
const pathFor = slug => 'src/content/entries/' + slug + '.md';
const now = ()=>new Date().toISOString();
const bytes = s=>new TextEncoder().encode(s).byteLength;

export function validateArticleMarkdown(content,original='') {
  if (typeof content!=='string' || bytes(content)>MAX_MARKDOWN || bytes(content)<80) {
    return '文章須為有效 Markdown，大小不能超過 190 KB。';
  }
  const header=/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content)?.[1]||'';
  if(!header || header.length>9000) return '文章開頭必須保留原有的 YAML 資料欄位。';
  const required=['title','summary','category','updated'];
  for(const key of required) {
    if(!new RegExp('^'+key+':\\s*\\S.+$','m').test(header)) {
      return '缺少文章必要欄位：'+key+'。';
    }
  }
  if(!/^updated:\s*\d{4}-\d{2}-\d{2}\s*$/m.test(header)) {
    return '更新日期須為 YYYY-MM-DD；正式發布時系統會自動改成當日。';
  }
  const category=/^category:\s*(\S+)\s*$/m.exec(header)?.[1];
  if(!/^(basics|organizations|plans|finance|people|tools)$/.test(category||'')) {
    return '文章分類不符合現有六個分類。';
  }
  if(original) {
    const oldHeader=/^---\r?\n([\s\S]*?)\r?\n---/.exec(original)?.[1]||'';
    const oldCategory=/^category:\s*(\S+)\s*$/m.exec(oldHeader)?.[1];
    if(category!==oldCategory) return '目前編輯器不開放改動文章分類，避免破壞相關導覽連結。';
  }
  if(/<script\b|<iframe\b|<object\b|<embed\b|javascript\s*:|onerror\s*=|onload\s*=/i.test(content)) {
    return '文章中包含可能不安全的網頁程式碼，請交由網站維護人員處理。';
  }
  return '';
}

export function stampArticleDate(content,date=new Date().toISOString().slice(0,10)) {
  const m=/^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if(!m)throw Error('Missing frontmatter');
  const newHeader=m[1].replace(/^updated:\s*\d{4}-\d{2}-\d{2}\s*$/m,'updated: '+date);
  if(newHeader===m[1]&&!m[1].includes('updated: '+date))throw Error('Missing updated date');
  return content.slice(0,m.index)+m[0].replace(m[1],()=>newHeader)+content.slice(m.index+m[0].length);
}

function encodeContent(text) {
  const byteArray=new TextEncoder().encode(text);
  let binary='';
  for(let i=0;i<byteArray.length;i+=12000) {
    binary+=String.fromCharCode(...byteArray.subarray(i,i+12000));
  }
  return btoa(binary);
}
function decodeContent(base64) {
  const raw=atob(String(base64||'').replace(/\s+/g,''));
  const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
export async function githubRequest(env,fetcher,method,path,body=null) {
  const token=clean(env.GITHUB_EDITOR_TOKEN,300);
  const headers={
    Accept:'application/vnd.github+json',
    'User-Agent':'local-practice-guide-admin',
    'X-GitHub-Api-Version':'2022-11-28'
  };
  if(token)headers.Authorization='Bearer '+token;
  if(body!==null)headers['Content-Type']='application/json';
  try {
    const response=await fetcher(API+path,{
      method,headers,
      ...(body!==null?{body:JSON.stringify(body)}:{}),
      signal:AbortSignal.timeout(15000)
    });
    const data=await response.json().catch(()=>null);
    return {status:response.status,ok:response.ok,data};
  } catch {
    return {status:502,ok:false,data:null};
  }
}
async function getMainSource(env,fetcher,slug) {
  const r=await githubRequest(env,fetcher,'GET','/contents/'+pathFor(slug)+'?ref=main');
  if(r.status===404)return fail(404,'GitHub 正式分支找不到這篇文章。','not_found');
  if(!r.ok)return fail(503,'暫時無法讀取 GitHub 的正式文章版本。','github_unavailable');
  if(r.data?.encoding!=='base64'||!r.data?.sha||Number(r.data?.size)>MAX_MARKDOWN) {
    return fail(502,'GitHub 文章資料不符合預期格式。','source_invalid');
  }
  try {
    const content=decodeContent(r.data.content);
    if(bytes(content)>MAX_MARKDOWN)throw Error('Size');
    return ok({source:{sha:r.data.sha,content}});
  }catch{
    return fail(502,'GitHub 文章文字無法解碼。','source_invalid');
  }
}
async function ensureTables(db) {
  for(const sql of definitions)await db.prepare(sql).run();
}
async function audit(env,user,action,id,details='') {
  await env.DB.prepare(
    'INSERT INTO admin_audit (id,actor_email,action,entity,entity_id,details,created_at) VALUES (?,?,?,?,?,?,?)'
  ).bind(crypto.randomUUID(),user.email,action,'article_draft',id,clean(details,350),now()).run();
}
function canRead(row,user) {
  return user.role==='owner'||row.author_email.toLowerCase()===user.email.toLowerCase();
}
function brief(row) {
  const {original_text,content,...safe}=row;
  return safe;
}
async function getDraft(db,id) {
  return db.prepare('SELECT * FROM admin_article_drafts WHERE id=?').bind(id).first();
}
async function inputJson(request) {
  if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json')){
    return fail(415,'只接受 JSON 內容。','content_type');
  }
  if(Number(request.headers.get('content-length')||0)>MAX_MARKDOWN+12000){
    return fail(413,'文章資料超過限制。','size');
  }
  const raw=await request.text();
  if(bytes(raw)>MAX_MARKDOWN+12000)return fail(413,'文章資料超過限制。','size');
  try {
    const value=JSON.parse(raw);
    if(!value||Array.isArray(value)||typeof value!=='object')throw Error('Invalid');
    return ok({value});
  }catch{return fail(400,'無法解析文章操作資料。','invalid_json');}
}
function expectedRevision(value) {
  return Number.isSafeInteger(value)&&value>0&&value<1000000?value:0;
}
function statusError(row,user) {
  return !row?fail(404,'找不到這份文章草稿。','not_found'):
    !canRead(row,user)?fail(403,'無權檢視其他人的草稿。','forbidden'):null;
}
async function listDrafts(env,user) {
  const r=user.role==='owner'?
    await env.DB.prepare(
      'SELECT id,slug,status,author_email,updated_by,reviewed_by,review_note,revision,'+
      'pr_number,pr_url,published_commit,created_at,updated_at,submitted_at,published_at '+
      'FROM admin_article_drafts ORDER BY updated_at DESC LIMIT 150'
    ).all():
    await env.DB.prepare(
      'SELECT id,slug,status,author_email,updated_by,reviewed_by,review_note,revision,'+
      'pr_number,pr_url,published_commit,created_at,updated_at,submitted_at,published_at '+
      'FROM admin_article_drafts WHERE author_email=? ORDER BY updated_at DESC LIMIT 100'
    ).bind(user.email).all();
  return ok({items:r.results||[],can_publish:user.role==='owner',
    github_configured:!!clean(env.GITHUB_EDITOR_TOKEN,300)});
}
async function createDraft(env,user,request,fetcher) {
  const parsed=await inputJson(request);if(!parsed.body.ok)return parsed;
  const slug=clean(parsed.body.value.slug,90);
  if(!SLUG.test(slug))return fail(400,'請從文章目錄選擇有效詞條。');
  const existing=await env.DB.prepare(
    "SELECT id,author_email FROM admin_article_drafts WHERE slug=? AND status NOT IN ('published','cancelled')"
  ).bind(slug).first();
  if(existing) return fail(409,'這篇文章已有尚未發布的草稿，請先處理該草稿。','active_exists');
  const source=await getMainSource(env,fetcher,slug);
  if(!source.body.ok)return source;
  const {sha,content}=source.body.source;
  const error=validateArticleMarkdown(content);
  if(error)return fail(422,'正式文章格式不符合編輯器限制：'+error,'source_invalid');
  const id=crypto.randomUUID(),ts=now();
  try {
    await env.DB.prepare(
      'INSERT INTO admin_article_drafts '+
      '(id,slug,source_sha,original_text,content,status,author_email,updated_by,created_at,updated_at) '+
      "VALUES (?,?,?,?,?,'draft',?,?,?,?)"
    ).bind(id,slug,sha,content,content,user.email,user.email,ts,ts).run();
  }catch{
    return fail(409,'這篇文章可能已有其他同事正在編輯，請重新整理。','active_exists');
  }
  await audit(env,user,'draft_create',id,slug);
  return ok({draft:await getDraft(env.DB,id)},201);
}
async function saveDraft(env,user,row,request) {
  if(!['draft','changes_requested'].includes(row.status)){
    return fail(409,'送審後不可直接修改，請先由管理員退回。','locked');
  }
  const parsed=await inputJson(request);if(!parsed.body.ok)return parsed;
  const {content,expected_revision}=parsed.body.value;
  if(!expectedRevision(expected_revision))return fail(400,'請重新載入草稿再儲存。','invalid_revision');
  const err=validateArticleMarkdown(content,row.original_text);
  if(err)return fail(422,err,'invalid_markdown');
  const ts=now();
  const r=await env.DB.prepare(
    "UPDATE admin_article_drafts SET content=?,updated_by=?,updated_at=?,revision=revision+1 " +
    "WHERE id=? AND revision=? AND status IN ('draft','changes_requested')"
  ).bind(content,user.email,ts,row.id,expected_revision).run();
  if(!r.meta?.changes)return fail(409,'其他同事已更新這份草稿，請重新載入。','conflict');
  await audit(env,user,'draft_save',row.id,row.slug+' / r'+(expected_revision+1));
  return ok({draft:await getDraft(env.DB,row.id)});
}
async function submitDraft(env,user,row,request) {
  if(!['draft','changes_requested'].includes(row.status))return fail(409,'這份草稿不能再提交審核。');
  const parsed=await inputJson(request);if(!parsed.body.ok)return parsed;
  const expected=expectedRevision(parsed.body.value.expected_revision);
  if(!expected)return fail(400,'缺少草稿版本資訊。');
  if(row.content===row.original_text)return fail(422,'請先編修並儲存內容，再提交審核。');
  const err=validateArticleMarkdown(row.content,row.original_text);
  if(err)return fail(422,err);
  const ts=now();
  const r=await env.DB.prepare(
    "UPDATE admin_article_drafts SET status='review',submitted_at=?,updated_by=?,updated_at=?,"+
    "review_note='',revision=revision+1 WHERE id=? AND revision=? "+
    "AND status IN ('draft','changes_requested')"
  ).bind(ts,user.email,ts,row.id,expected).run();
  if(!r.meta?.changes)return fail(409,'草稿已被更新，請重新載入。','conflict');
  await audit(env,user,'draft_submit',row.id,row.slug);
  return ok({draft:await getDraft(env.DB,row.id)});
}
async function returnDraft(env,user,row,request) {
  if(user.role!=='owner')return fail(403,'僅最高管理員可退回修改。');
  if(row.status!=='review')return fail(409,'只有待審稿件能退回修改。');
  const parsed=await inputJson(request);if(!parsed.body.ok)return parsed;
  const expected=expectedRevision(parsed.body.value.expected_revision);
  const note=clean(parsed.body.value.note,600);
  if(!expected||note.length<4)return fail(400,'請填寫明確退回原因並使用最新草稿版本。');
  const r=await env.DB.prepare(
    "UPDATE admin_article_drafts SET status='changes_requested',review_note=?,reviewed_by=?,"+
    "updated_at=?,revision=revision+1 WHERE id=? AND revision=? AND status='review'"
  ).bind(note,user.email,now(),row.id,expected).run();
  if(!r.meta?.changes)return fail(409,'草稿狀態已更新，請重新載入。','conflict');
  await audit(env,user,'draft_return',row.id,row.slug+' / '+note);
  return ok({draft:await getDraft(env.DB,row.id)});
}
function requireToken(env) {
  return clean(env.GITHUB_EDITOR_TOKEN,300)?
    null:fail(503,'草稿與審核已啟用，正式 GitHub 發布尚需管理員設定 GITHUB_EDITOR_TOKEN Secret。','github_token_required');
}
export function pullBranch(row) {
  return 'guide-article-'+row.slug.slice(0,45)+'-'+row.id.slice(0,8);
}
async function stageDraft(env,user,row,request,fetcher) {
  if(user.role!=='owner')return fail(403,'只有最高管理員能核准 GitHub 審核版本。');
  if(row.status!=='review')return fail(409,'只有待審稿件可以建立發布審核版本。');
  const tokenErr=requireToken(env);if(tokenErr)return tokenErr;
  const parsed=await inputJson(request);if(!parsed.body.ok)return parsed;
  const expected=expectedRevision(parsed.body.value.expected_revision);
  if(!expected||parsed.body.value.confirm!=='APPROVE'){
    return fail(400,'請重新載入並確認核准審稿。');
  }
  const invalid=validateArticleMarkdown(row.content,row.original_text);
  if(invalid)return fail(422,invalid,'invalid_markdown');
  if(row.content===row.original_text)return fail(422,'沒有可送審的修改內容。');
  const current=await getMainSource(env,fetcher,row.slug);
  if(!current.body.ok)return current;
  if(current.body.source.sha!==row.source_sha){
    return fail(409,'正式網站的文章已有較新版本，禁止覆蓋；請建立新草稿比對更新。','source_changed');
  }
  const ref=await githubRequest(env,fetcher,'GET','/git/ref/heads/main');
  if(!ref.ok||!ref.data?.object?.sha)return fail(503,'目前無法確認 GitHub 正式分支。','github_error');
  const branch=pullBranch(row);
  const create=await githubRequest(env,fetcher,'POST','/git/refs',{
    ref:'refs/heads/'+branch,sha:ref.data.object.sha
  });
  if(!create.ok)return fail(503,'無法建立 GitHub 審核分支，請檢查權杖權限。','github_error');
  const date=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
  const finalContent=stampArticleDate(row.content,date);
  const put=await githubRequest(env,fetcher,'PUT','/contents/'+pathFor(row.slug),{
    message:'content: submit reviewed guide article '+row.slug,
    content:encodeContent(finalContent),
    sha:row.source_sha,
    branch
  });
  if(!put.ok||!put.data?.commit?.sha){
    return fail(503,'審核分支已建立，但無法提交文章；正式網站沒有受到影響。請檢查 GitHub 權限。','github_error');
  }
  const pr=await githubRequest(env,fetcher,'POST','/pulls',{
    title:'文章審核：'+row.slug,
    head:branch,base:'main',
    body:'地方實踐指南管理後台送審\n\n詞條：'+row.slug+
      '\n草稿作者：'+row.author_email+'\n核准管理員：'+user.email+
      '\n\n建置測試通過後才可由管理員正式發布。'
  });
  if(!pr.ok||!Number.isInteger(pr.data?.number)||!pr.data?.head?.sha){
    return fail(503,'審核分支已更新，但 PR 建立失敗；請至 GitHub 檢查分支，正式網站沒有受到影響。','github_error');
  }
  const ts=now();
  const r=await env.DB.prepare(
    "UPDATE admin_article_drafts SET status='staged',reviewed_by=?,pr_number=?,pr_head_sha=?,"+
    "pr_url=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=? AND status='review'"
  ).bind(user.email,pr.data.number,pr.data.head.sha,clean(pr.data.html_url,600),ts,row.id,expected).run();
  if(!r.meta?.changes)return fail(409,'GitHub 審核 PR 已建立，但草稿版本變更，請通知管理員檢查 PR。','conflict');
  await audit(env,user,'draft_stage',row.id,row.slug+' / PR #'+pr.data.number);
  return ok({draft:await getDraft(env.DB,row.id),message:'GitHub 審核 PR 已建立；請確認建置檢查通過後正式發布。'});
}
function checkSucceeded(items) {
  if(!Array.isArray(items))return false;
  return items.some(x=>x.name==='check-seo'&&x.status==='completed'&&x.conclusion==='success');
}
async function publishDraft(env,user,row,request,fetcher) {
  if(user.role!=='owner')return fail(403,'只有最高管理員可正式發布。');
  if(row.status!=='staged'||!row.pr_number||!row.pr_head_sha) {
    return fail(409,'請先核准文章並建立 GitHub 審核 PR。');
  }
  const tokenErr=requireToken(env);if(tokenErr)return tokenErr;
  const parsed=await inputJson(request);if(!parsed.body.ok)return parsed;
  const expected=expectedRevision(parsed.body.value.expected_revision);
  if(!expected||parsed.body.value.confirm!=='PUBLISH'){
    return fail(400,'請確認正式發布，並使用最新草稿版本。');
  }
  const pr=await githubRequest(env,fetcher,'GET','/pulls/'+row.pr_number);
  if(!pr.ok||pr.data?.state!=='open'||pr.data?.base?.ref!=='main'||
      pr.data?.head?.ref!==pullBranch(row)||pr.data?.head?.sha!==row.pr_head_sha) {
    return fail(409,'GitHub 審核 PR 已更新或關閉，請先到 GitHub 核對。','pr_changed');
  }
  const current=await getMainSource(env,fetcher,row.slug);
  if(!current.body.ok)return current;
  if(current.body.source.sha!==row.source_sha) {
    return fail(409,'正式文章已有其他更新，請先比較差異，不可覆蓋。','source_changed');
  }
  const checks=await githubRequest(env,fetcher,'GET','/commits/'+row.pr_head_sha+'/check-runs?per_page=100');
  if(!checks.ok)return fail(503,'無法驗證 GitHub 的網站建置測試。請檢查權杖的 Checks Read 權限。','checks_unavailable');
  if(!checkSucceeded(checks.data?.check_runs)){
    return fail(409,'網站 SEO 建置測試尚未成功，禁止正式發布。請稍後在 GitHub PR 檢查結果。','checks_not_ready');
  }
  const merge=await githubRequest(env,fetcher,'PUT','/pulls/'+row.pr_number+'/merge',{
    commit_title:'文章更新：'+row.slug,
    commit_message:'Approved by '+user.email+' through guide admin editorial workflow.',
    sha:row.pr_head_sha,
    merge_method:'squash'
  });
  if(!merge.ok||merge.data?.merged!==true||!merge.data?.sha) {
    return fail(409,'GitHub 拒絕合併；請檢查 PR 是否有衝突或分支保護規則。','merge_failed');
  }
  const ts=now();
  const r=await env.DB.prepare(
    "UPDATE admin_article_drafts SET status='published',published_commit=?,published_at=?,"+
    "updated_at=?,revision=revision+1 WHERE id=? AND revision=? AND status='staged'"
  ).bind(merge.data.sha,ts,ts,row.id,expected).run();
  if(!r.meta?.changes) {
    return fail(409,'GitHub 已完成發布，但管理紀錄更新失敗；請先到 GitHub 查看合併紀錄。','db_after_merge');
  }
  await audit(env,user,'draft_publish',row.id,row.slug+' / '+merge.data.sha.slice(0,12));
  return ok({draft:await getDraft(env.DB,row.id),message:'GitHub 已合併文章更新，正式網站將依 GitHub Pages 部署流程更新。'});
}
async function cancelDraft(env,user,row,request) {
  if(row.status==='published'||row.status==='staged'||row.status==='cancelled'){
    return fail(409,'已進入 GitHub 發布流程或已發布的草稿不能取消。');
  }
  const parsed=await inputJson(request);if(!parsed.body.ok)return parsed;
  const expected=expectedRevision(parsed.body.value.expected_revision);
  if(!expected||parsed.body.value.confirm!=='CANCEL')return fail(400,'請確認取消草稿。');
  const r=await env.DB.prepare(
    "UPDATE admin_article_drafts SET status='cancelled',updated_by=?,updated_at=?,revision=revision+1 "+
    "WHERE id=? AND revision=? AND status IN ('draft','review','changes_requested')"
  ).bind(user.email,now(),row.id,expected).run();
  if(!r.meta?.changes)return fail(409,'草稿狀態已更新，請重新整理。','conflict');
  await audit(env,user,'draft_cancel',row.id,row.slug);
  return ok({draft:await getDraft(env.DB,row.id)});
}

// Routes: /api/editor/drafts [GET / POST], /api/editor/drafts/:id [GET],
// /api/editor/drafts/:id/{save,submit,return,stage,publish,cancel} [POST].
// Call only AFTER index.js verified Access identity and same-origin POST.
export async function handleEditorRequest(env,user,request,url,fetcher=fetch) {
  if(!ROLES.includes(user?.role))return fail(403,'此帳號沒有文章編輯權限。','forbidden');
  await ensureTables(env.DB);
  const path=url.pathname.replace(/\/+$/,'');
  if(path==='/api/editor/drafts'){
    if(request.method==='GET')return listDrafts(env,user);
    if(request.method==='POST')return createDraft(env,user,request,fetcher);
    return fail(405,'不支援的操作方式。');
  }
  const match=/^\/api\/editor\/drafts\/([a-f0-9-]{36})(?:\/(save|submit|return|stage|publish|cancel))?$/.exec(path);
  if(!match||!ID.test(match[1]))return fail(404,'找不到文章草稿。','not_found');
  const row=await getDraft(env.DB,match[1]);
  const denied=statusError(row,user);
  if(denied)return denied;
  if(request.method==='GET'&&!match[2])return ok({draft:row});
  if(request.method!=='POST'||!match[2])return fail(405,'不支援的操作方式。');
  if(match[2]==='save')return saveDraft(env,user,row,request);
  if(match[2]==='submit')return submitDraft(env,user,row,request);
  if(match[2]==='return')return returnDraft(env,user,row,request);
  if(match[2]==='stage')return stageDraft(env,user,row,request,fetcher);
  if(match[2]==='publish')return publishDraft(env,user,row,request,fetcher);
  if(match[2]==='cancel')return cancelDraft(env,user,row,request);
  return fail(404,'找不到文章操作。');
}
