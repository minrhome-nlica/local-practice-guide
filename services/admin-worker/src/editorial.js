// Draft -> submit -> owner review -> GitHub PR -> verified merge.
// D1 holds UNPUBLISHED work only. GitHub main remains the sole published source.
// All routes MUST be protected by Cloudflare Access and admin_users in index.js.
// Never expose GITHUB_EDITOR_TOKEN in returned payloads or log entries.

const REPO = 'minrhome-nlica/local-practice-guide';
const API = 'https://api.github.com/repos/' + REPO + '/';
const ARTICLE_DIR = 'src/content/entries/';
const SEO_FILE = 'src/data/seo.ts';
const MAX_MARKDOWN = 240000;
const ACTIVE = ['draft','submitted','changes_requested','approved','pr_ready'];
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,85}$/;
const SHA_RE = /^[a-f0-9]{40}$/;
const ID_RE = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

class EditorialError extends Error {
  constructor(status,code,message){
    super(message);
    this.status=status;
    this.code=code;
  }
}
const failure=(status,code,message)=>({status,body:{ok:false,code,error:message}});
const success=(body,status=200)=>({status,body:{ok:true,...body}});
function assert(condition,status,code,message){
  if(!condition)throw new EditorialError(status,code,message);
}
function requiredString(value,min,max,label){
  assert(typeof value==='string',400,'invalid_input',label+'內容不正確。');
  const text=value.trim();
  assert(text.length>=min&&text.length<=max,400,'invalid_input',label+'長度應為 '+min+'～'+max+' 個字。');
  assert(!/[\u0000-\u001f\u007f]/.test(text),400,'invalid_input',label+'不可包含控制字元。');
  return text;
}
function revisionMatch(row,input){
  assert(Number.isSafeInteger(input?.expected_revision)&&Number(input.expected_revision)>0,
    409,'stale','請重新整理，確認最新的草稿版本。');
  assert(Number(input.expected_revision)===Number(row.revision),
    409,'stale','文章草稿已被更新，請重新載入再操作。');
}
function ownDraft(user,row){
  assert(user.role==='owner'||row.created_by.toLowerCase()===user.email.toLowerCase(),
    403,'forbidden','只能修改自己建立的草稿。');
}
function nowIso(){return new Date().toISOString();}
function dateToday(){return nowIso().slice(0,10);}
function markdownParts(raw){
  const match=/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(String(raw||''));
  assert(!!match,422,'invalid_markdown','文章必須保留原有 YAML 文件資訊。');
  const header=match[1],body=match[2];
  for(const field of ['title','summary','category','updated']){
    assert(new RegExp('^'+field+':\\s*.+$','m').test(header),
      422,'invalid_markdown','文章缺少 '+field+' 欄位。');
  }
  return {header,body};
}
function yamlField(header,field){
  const match=new RegExp('^'+field+':\\s*(.+)$','m').exec(header);
  const raw=match?.[1]?.trim()||'';
  if(raw.startsWith('"')&&raw.endsWith('"')){
    try{return JSON.parse(raw);}catch{/* fall through */ }
  }
  if(raw.startsWith("'")&&raw.endsWith("'"))return raw.slice(1,-1).replace(/''/g,"'");
  return raw;
}
function replaceYaml(header,field,value){
  const quoted=JSON.stringify(value);
  assert(new RegExp('^'+field+':','m').test(header),422,'invalid_markdown','找不到 '+field+'。');
  return header.replace(new RegExp('^'+field+':.*$','m'),()=>field+': '+quoted);
}
function forbidActiveContent(body){
  // Existing article HTML/tables are preserved; new scripts or event handlers
  // are blocked to avoid shipping executable HTML through Markdown edits.
  assert(!/<\s*\/?\s*(script|iframe|object|embed|form|base|meta|link)\b/i.test(body),
    400,'unsafe_content','文章不可加入腳本、嵌入網頁或表單標籤。');
  assert(!/\bon[a-z]{3,}\s*=/i.test(body)&&!/javascript\s*:/i.test(body)&&!/data\s*:\s*text\/html/i.test(body),
    400,'unsafe_content','文章不可加入可執行的事件或網址。');
}
function prepareMarkdown(source,title,summary,body,changeDate=false){
  const parts=markdownParts(source);
  const front=replaceYaml(replaceYaml(parts.header,'title',title),'summary',summary);
  const next=changeDate ? front.replace(/^updated:.*$/m,()=> 'updated: '+dateToday()) : front;
  assert(typeof body==='string'&&body.trim().length>20&&body.length<=MAX_MARKDOWN,
    400,'invalid_input','文章內容長度不正確。');
  forbidActiveContent(body);
  const markdown='---\n'+next+'\n---\n'+body;
  assert(markdown.length<=MAX_MARKDOWN,413,'too_large','文章內容超過字數限制。');
  return markdown;
}
function decodeGitHubText(data){
  assert(data&&typeof data.content==='string'&&data.encoding==='base64'&&SHA_RE.test(data.sha||''),
    502,'github_format','GitHub 未傳回可用的文章版本。');
  const binary=atob(data.content.replace(/\s/g,''));
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return {sha:data.sha,content:new TextDecoder('utf-8',{fatal:true}).decode(bytes)};
}
function encodeGitHubText(value){
  const bytes=new TextEncoder().encode(value);
  const parts=[];
  for(let i=0;i<bytes.length;i+=8192){
    parts.push(String.fromCharCode(...bytes.subarray(i,i+8192)));
  }
  return btoa(parts.join(''));
}
async function gh(env,path,opts={},fetcher=fetch){
  const method=opts.method||'GET';
  const headers={
    'Accept':'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28',
    'User-Agent':'local-practice-guide-editorial'
  };
  const token=String(env.GITHUB_EDITOR_TOKEN||'').trim();
  if(token)headers.Authorization='Bearer '+token;
  if(opts.body!==undefined)headers['Content-Type']='application/json';
  let response;
  try{
    response=await fetcher(API+path,{
      method,headers,
      ...(opts.body===undefined?{}:{body:JSON.stringify(opts.body)}),
      signal:AbortSignal.timeout(15000)
    });
  }catch{
    throw new EditorialError(503,'github_unavailable','目前無法連接 GitHub，請稍後重試。');
  }
  if(!response.ok){
    if(response.status===401||response.status===403){
      throw new EditorialError(503,'github_permission','GitHub 授權不足或受到請求限制，請檢查後台 Token 權限。');
    }
    if(response.status===404)throw new EditorialError(404,'github_missing','GitHub 找不到此文章或資源。');
    if(response.status===409||response.status===422)throw new EditorialError(409,'github_conflict',
      'GitHub 版本衝突或既有編輯分支尚未清理，請管理員檢查後重新操作。');
    throw new EditorialError(502,'github_error','GitHub 暫時無法完成此操作。');
  }
  try{return await response.json();}
  catch{throw new EditorialError(502,'github_format','GitHub 回應格式不正確。');}
}
async function sourceFile(env,file,ref='main',fetcher=fetch){
  const json=await gh(env,'contents/'+file+'?ref='+encodeURIComponent(ref),{},fetcher);
  const source=decodeGitHubText(json);
  assert(source.content.length<=MAX_MARKDOWN*2,413,'too_large','來源檔案超過安全限制。');
  return source;
}
function seoBlock(source,slug){
  const prefix="  '"+slug+"': {";
  const start=source.indexOf(prefix);
  assert(start>=0&&source.indexOf(prefix,start+prefix.length)<0,
    422,'seo_missing','找不到文章對應的 SEO 搜尋資訊。');
  const end=source.indexOf('\n  }',start+prefix.length);
  assert(end>start,422,'seo_missing','SEO 文件格式不符合預期。');
  const text=source.slice(start,end+4);
  function field(key){
    const rx=new RegExp('\\b'+key+':\\s*(?:\\x27((?:\\\\.|[^\\x27])*)\\x27|"((?:\\\\.|[^"])*)")','m');
    const match=rx.exec(text);
    assert(!!match,422,'seo_missing','SEO 文件缺少 '+key+'。');
    if(match[2]!==undefined){
      try{return JSON.parse('"'+match[2]+'"');}catch{return match[2];}
    }
    return match[1].replace(/\\'/g,"'").replace(/\\\\/g,'\\');
  }
  return {start,end:end+4,title:field('title'),description:field('description')};
}
function updateSeo(source,slug,title,description){
  const block=seoBlock(source,slug);
  const next="  '"+slug+"': {\n"+
    '    title: '+JSON.stringify(title)+',\n'+
    '    description: '+JSON.stringify(description)+'\n'+
    '  }';
  return source.slice(0,block.start)+next+source.slice(block.end);
}
async function getRow(env,id){
  assert(ID_RE.test(id),400,'invalid_id','草稿識別碼不正確。');
  const row=await env.DB.prepare('SELECT * FROM admin_article_drafts WHERE id = ?').bind(id).first();
  assert(!!row,404,'not_found','找不到此文章草稿。');
  return row;
}
function publicRow(row,full=false){
  const out={
    id:row.id,slug:row.slug,status:row.status,revision:Number(row.revision),
    created_by:row.created_by,updated_by:row.updated_by,
    created_at:row.created_at,updated_at:row.updated_at,
    submitted_at:row.submitted_at,reviewed_by:row.reviewed_by,
    reviewed_at:row.reviewed_at,review_note:row.review_note||'',
    seo_title:row.seo_title,seo_description:row.seo_description,
    original_seo_title:row.original_seo_title,
    original_seo_description:row.original_seo_description,
    github_pr_number:row.github_pr_number,github_pr_url:row.github_pr_url,
    github_merge_sha:row.github_merge_sha,published_at:row.published_at
  };
  if(full){
    out.original_content=row.original_content;
    out.draft_content=row.draft_content;
    out.original_blob_sha=row.original_blob_sha;
  }
  return out;
}
async function readInput(request){
  const type=(request.headers.get('content-type')||'').toLowerCase();
  assert(type.startsWith('application/json'),415,'content_type','僅接受 JSON 表單資料。');
  const len=Number(request.headers.get('content-length')||0);
  assert(len<=MAX_MARKDOWN*4,413,'too_large','表單資料超過限制。');
  const text=await request.text();
  assert(text.length<=MAX_MARKDOWN+15000,413,'too_large','表單資料超過限制。');
  let body;
  try{body=JSON.parse(text);}catch{throw new EditorialError(400,'invalid_json','表單格式不正確。');}
  assert(body&&typeof body==='object'&&!Array.isArray(body),
    400,'invalid_json','表單格式不正確。');
  return body;
}
async function audit(logAudit,env,user,action,id,details){
  await logAudit(env,user,action,'article_draft',id,details);
}
async function createDraft(env,user,input,fetcher,logAudit){
  const slug=String(input.slug||'').trim();
  assert(SLUG_RE.test(slug),400,'invalid_slug','請從正式文章目錄選擇一篇文章。');
  const existing=await env.DB.prepare(
    "SELECT id,created_by,status FROM admin_article_drafts WHERE slug = ? AND "+
    "status IN ('draft','submitted','changes_requested','approved','pr_ready') LIMIT 1"
  ).bind(slug).first();
  if(existing){
    if(user.role==='owner'||existing.created_by.toLowerCase()===user.email.toLowerCase()){
      return success({existing:true,draft_id:existing.id,status:existing.status});
    }
    throw new EditorialError(409,'already_editing','此文章已有其他編輯人員建立草稿。');
  }
  const [article,seo]=await Promise.all([
    sourceFile(env,ARTICLE_DIR+slug+'.md','main',fetcher),
    sourceFile(env,SEO_FILE,'main',fetcher)
  ]);
  const doc=markdownParts(article.content);
  const fields=seoBlock(seo.content,slug);
  const title=yamlField(doc.header,'title');
  const id=crypto.randomUUID(),time=nowIso();
  try{
    await env.DB.prepare(
      'INSERT INTO admin_article_drafts '+
      '(id,slug,title,status,original_blob_sha,original_content,draft_content,'+
      'original_seo_sha,original_seo_title,original_seo_description,seo_title,seo_description,'+
      'revision,created_by,updated_by,created_at,updated_at) '+
      "VALUES (?,?,?,'draft',?,?,?,?,?,?,?, ?,1,?,?,?,?)"
    ).bind(id,slug,title,article.sha,article.content,article.content,
      seo.sha,fields.title,fields.description,fields.title,fields.description,
      user.email,user.email,time,time).run();
  }catch{
    throw new EditorialError(409,'already_editing','此文章已有草稿，請重新整理列表。');
  }
  await audit(logAudit,env,user,'create',id,slug);
  return success({draft_id:id,revision:1,status:'draft'},201);
}
async function saveDraft(env,user,row,input,logAudit){
  ownDraft(user,row);
  assert(row.status==='draft'||row.status==='changes_requested',
    409,'invalid_state','此草稿已送審，請先由管理員退回才能修改。');
  revisionMatch(row,input);
  const title=requiredString(input.title,2,125,'文章標題');
  const summary=requiredString(input.summary,12,380,'文章摘要');
  const seoTitle=requiredString(input.seo_title,8,135,'搜尋標題');
  const seoDescription=requiredString(input.seo_description,20,340,'搜尋摘要');
  const content=prepareMarkdown(row.draft_content,title,summary,input.body);
  const now=nowIso();
  const changed=await env.DB.prepare(
    "UPDATE admin_article_drafts SET title=?,draft_content=?,seo_title=?,seo_description=?,"+
    "status='draft',review_note='',reviewed_by=NULL,reviewed_at=NULL,"+
    'updated_by=?,updated_at=?,revision=revision+1 '+
    "WHERE id=? AND revision=? AND status IN ('draft','changes_requested')"
  ).bind(title,content,seoTitle,seoDescription,user.email,now,row.id,row.revision).run();
  assert(Number(changed.meta?.changes)===1,409,'stale','草稿已被其他人更新，請重新載入。');
  await audit(logAudit,env,user,'save',row.id,'版本 '+(Number(row.revision)+1));
  return success({draft_id:row.id,revision:Number(row.revision)+1,status:'draft'});
}
async function submitDraft(env,user,row,input,logAudit){
  ownDraft(user,row);
  revisionMatch(row,input);
  assert(row.status==='draft'||row.status==='changes_requested',
    409,'invalid_state','只有尚未送審或退回的草稿可以送審。');
  assert(row.original_content!==row.draft_content||
    row.seo_title!==row.original_seo_title||
    row.seo_description!==row.original_seo_description,
    400,'no_changes','草稿沒有修改內容，無法送審。');
  const now=nowIso();
  const changed=await env.DB.prepare(
    "UPDATE admin_article_drafts SET status='submitted',submitted_at=?,updated_at=?,"+
    "revision=revision+1 WHERE id=? AND revision=? AND status IN ('draft','changes_requested')"
  ).bind(now,now,row.id,row.revision).run();
  assert(Number(changed.meta?.changes)===1,409,'stale','草稿已更新，請重新載入。');
  await audit(logAudit,env,user,'submit',row.id,row.slug);
  return success({status:'submitted',revision:Number(row.revision)+1});
}
async function reviewDraft(env,user,row,input,logAudit){
  assert(user.role==='owner',403,'forbidden','只有最高管理員可以審核文章。');
  revisionMatch(row,input);
  assert(row.status==='submitted',409,'invalid_state','這篇文章目前不是待審核狀態。');
  const action=input.action;
  assert(action==='approve'||action==='request_changes',400,'invalid_action','審核動作不正確。');
  const note=typeof input.note==='string'?input.note.trim():'';
  assert(note.length<=1000&&!/[\u0000-\u0008\u000b-\u001f]/.test(note),
    400,'invalid_note','審核備註不可超過 1000 個字。');
  assert(action==='approve'||note.length>=2,400,'note_required','請填寫退回修改的原因。');
  const next=action==='approve'?'approved':'changes_requested';
  const now=nowIso();
  const changed=await env.DB.prepare(
    'UPDATE admin_article_drafts SET status=?,reviewed_by=?,review_note=?,'+
    "reviewed_at=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=? AND status='submitted'"
  ).bind(next,user.email,note,now,now,row.id,row.revision).run();
  assert(Number(changed.meta?.changes)===1,409,'stale','審核狀態已變更，請重新載入。');
  await audit(logAudit,env,user,action==='approve'?'approve':'request_changes',row.id,note||row.slug);
  return success({status:next,revision:Number(row.revision)+1});
}
function requireGitHubToken(env){
  assert(typeof env.GITHUB_EDITOR_TOKEN==='string'&&env.GITHUB_EDITOR_TOKEN.trim().length>20,
    503,'github_token_missing','請先在後台 Worker Secret 設定 GITHUB_EDITOR_TOKEN，才能建立或合併 GitHub 審核請求。');
}
async function preparePR(env,user,row,input,fetcher,logAudit){
  assert(user.role==='owner',403,'forbidden','只有最高管理員能建立發布請求。');
  revisionMatch(row,input);
  assert(row.status==='approved',409,'invalid_state','請先核准草稿，再建立 GitHub 發布請求。');
  requireGitHubToken(env);
  const markdownPath=ARTICLE_DIR+row.slug+'.md';
  const seoChanged=row.seo_title!==row.original_seo_title||
    row.seo_description!==row.original_seo_description;
  const [current,seo,mainRef]=await Promise.all([
    sourceFile(env,markdownPath,'main',fetcher),
    sourceFile(env,SEO_FILE,'main',fetcher),
    gh(env,'git/ref/heads/main',{},fetcher)
  ]);
  assert(current.sha===row.original_blob_sha,409,'source_changed',
    '文章正式版本已被其他人更新，這份草稿需要重新比對，暫時不能發布。');
  if(seoChanged){
    assert(seo.sha===row.original_seo_sha,409,'seo_changed',
      '搜尋資料已被其他人更新，這份草稿需要重新比對。');
  }
  const markdown=prepareMarkdown(row.draft_content,
    yamlField(markdownParts(row.draft_content).header,'title'),
    yamlField(markdownParts(row.draft_content).header,'summary'),
    markdownParts(row.draft_content).body,true);
  const branch='guide-editorial/draft-'+row.id.replaceAll('-','');
  assert(SHA_RE.test(mainRef?.object?.sha||''),502,'github_format','GitHub 正式分支資訊不完整。');
  await gh(env,'git/refs',{method:'POST',body:{
    ref:'refs/heads/'+branch,sha:mainRef.object.sha
  }},fetcher);
  const fileChange=await gh(env,'contents/'+markdownPath,{
    method:'PUT',body:{
      message:'content: update '+row.slug+' (reviewed draft '+row.id.slice(0,8)+')',
      content:encodeGitHubText(markdown),
      sha:row.original_blob_sha,branch
    }
  },fetcher);
  assert(SHA_RE.test(fileChange?.content?.sha||''),502,'github_format','GitHub 未確認文章版本。');
  let seoBlob='';
  if(seoChanged){
    const updated=updateSeo(seo.content,row.slug,row.seo_title,row.seo_description);
    const seoChange=await gh(env,'contents/'+SEO_FILE,{
      method:'PUT',body:{
        message:'seo: update search snippet for '+row.slug,
        content:encodeGitHubText(updated),sha:seo.sha,branch
      }
    },fetcher);
    assert(SHA_RE.test(seoChange?.content?.sha||''),502,'github_format','GitHub 未確認搜尋資訊版本。');
    seoBlob=seoChange.content.sha;
  }
  const pr=await gh(env,'pulls',{method:'POST',body:{
    title:'文章審核：'+row.title,
    head:branch,base:'main',draft:false,
    body:'由地方實踐指南管理後台建立的已核准草稿。\n\n'+
      '- 詞條：'+row.slug+'\n'+
      '- 編輯：'+row.created_by+'\n'+
      '- 審核：'+row.reviewed_by+'\n'+
      '- 草稿識別碼：'+row.id+'\n'+
      '- 需通過 SEO / 網站自動檢查，才由管理員合併發布。\n'
  }},fetcher);
  assert(Number.isSafeInteger(pr?.number)&&pr.number>0&&
    pr.html_url==='https://github.com/'+REPO+'/pull/'+pr.number,
    502,'github_format','GitHub 已處理請求，但沒有回傳正確的審查連結，請管理員檢查 GitHub。');
  const now=nowIso();
  const changed=await env.DB.prepare(
    "UPDATE admin_article_drafts SET status='pr_ready',github_branch=?,github_pr_number=?,"+
    'github_pr_url=?,prepared_md_blob_sha=?,prepared_seo_blob_sha=?,'+
    "revision=revision+1,updated_at=? WHERE id=? AND revision=? AND status='approved'"
  ).bind(branch,pr.number,pr.html_url,fileChange.content.sha,seoBlob,
    now,row.id,row.revision).run();
  assert(Number(changed.meta?.changes)===1,409,'stale',
    'GitHub 已建立 PR，但草稿狀態已改變。請管理員由 GitHub 查看此 PR。');
  await audit(logAudit,env,user,'prepare_pr',row.id,'GitHub PR #'+pr.number);
  return success({status:'pr_ready',revision:Number(row.revision)+1,
    github_pr_url:pr.html_url,github_pr_number:pr.number,
    message:'GitHub 發布請求已建立，請等待自動檢查通過，再按「正式發布」。'});
}
async function mergePR(env,user,row,input,fetcher,logAudit){
  assert(user.role==='owner',403,'forbidden','只有最高管理員可以正式發布。');
  revisionMatch(row,input);
  assert(row.status==='pr_ready',409,'invalid_state','這份草稿目前沒有待合併的 GitHub 發布請求。');
  requireGitHubToken(env);
  const number=Number(row.github_pr_number);
  assert(Number.isSafeInteger(number)&&number>0,409,'pr_missing','找不到 GitHub 審核請求。');
  const pr=await gh(env,'pulls/'+number,{},fetcher);
  assert(pr?.base?.ref==='main'&&pr?.head?.ref===row.github_branch&&
    pr?.head?.repo?.full_name===REPO,
    409,'pr_mismatch','GitHub 審核請求與原始草稿不一致，已停止發布。');
  if(pr.state!=='open'){
    throw new EditorialError(409,'pr_closed','GitHub 審核請求已關閉，請管理員檢查合併情形。');
  }
  assert(pr.mergeable===true,409,'not_mergeable',
    'GitHub 審核請求尚未準備好合併，可能有衝突或檢查尚未完成。');
  assert(SHA_RE.test(pr.head.sha||''),502,'github_format','GitHub 審核版本資訊不完整。');
  const files=await gh(env,'pulls/'+number+'/files?per_page=100',{},fetcher);
  const allowed=ARTICLE_DIR+row.slug+'.md';
  const expected=[allowed,...(row.prepared_seo_blob_sha?[SEO_FILE]:[])].sort();
  assert(Array.isArray(files)&&files.length===expected.length&&
    files.every(x=>x.status==='modified')&&
    JSON.stringify(files.map(x=>x.filename).sort())===JSON.stringify(expected),
    409,'pr_modified','GitHub PR 含有未核准的檔案變更，已停止發布。');
  for(const file of files){
    const sha=file.filename===allowed?row.prepared_md_blob_sha:row.prepared_seo_blob_sha;
    assert(file.sha===sha,409,'pr_modified',
      'GitHub PR 內容已在後台核准後被更改，已停止發布。');
  }
  const checks=await gh(env,'commits/'+pr.head.sha+'/check-runs?per_page=100',{},fetcher);
  const seoCheck=(checks.check_runs||[]).filter(x=>x.name==='check-seo');
  assert(seoCheck.length>0&&seoCheck.some(x=>x.status==='completed'&&x.conclusion==='success')&&
    seoCheck.every(x=>x.status==='completed'&&x.conclusion==='success'),
    409,'checks_pending','GitHub SEO／網站自動檢查尚未通過。請先開啟 PR 查看檢查結果。');
  const current=await sourceFile(env,allowed,'main',fetcher);
  assert(current.sha===row.original_blob_sha,409,'source_changed',
    '網站正式文章已更新，為避免覆蓋他人內容，這次發布已停止。');
  if(row.prepared_seo_blob_sha){
    const seo=await sourceFile(env,SEO_FILE,'main',fetcher);
    assert(seo.sha===row.original_seo_sha,409,'seo_changed',
      '網站搜尋資料已更新，請重新檢查版本。');
  }
  const merged=await gh(env,'pulls/'+number+'/merge',{
    method:'PUT',body:{merge_method:'squash',sha:pr.head.sha,
      commit_title:'文章更新：'+row.title}
  },fetcher);
  assert(merged.merged===true&&SHA_RE.test(merged.sha||''),
    502,'merge_unconfirmed','GitHub 尚未確認合併，請先查看 PR 狀態。');
  const now=nowIso();
  const changed=await env.DB.prepare(
    "UPDATE admin_article_drafts SET status='published',github_merge_sha=?,published_at=?,"+
    "revision=revision+1,updated_at=? WHERE id=? AND revision=? AND status='pr_ready'"
  ).bind(merged.sha,now,now,row.id,row.revision).run();
  assert(Number(changed.meta?.changes)===1,409,'stale',
    'GitHub 已合併文章，但後台狀態更新未完成。請管理員檢查該 PR。');
  await audit(logAudit,env,user,'publish',row.id,
    'PR #'+number+' merged '+merged.sha.slice(0,12));
  return success({status:'published',revision:Number(row.revision)+1,
    github_merge_sha:merged.sha,
    message:'GitHub main 已合併更新。公開網站仍需等 GitHub Pages 建置完成才會顯示新版。'});
}
export async function handleEditorial(env,user,request,url,logAudit,fetcher=fetch){
  try{
    if(user.role!=='owner'&&user.role!=='editor')return failure(403,'forbidden','你沒有文章編輯權限。');
    const pathname=url.pathname.replace(/\/+$/,'');
    if(pathname==='/api/editorial/status'&&request.method==='GET'){
      return success({drafts_enabled:String(env.DRAFTS_ENABLED)==='true',
        github_enabled:typeof env.GITHUB_EDITOR_TOKEN==='string'&&
          env.GITHUB_EDITOR_TOKEN.trim().length>20,
        requires_admin_review:true});
    }
    if(String(env.DRAFTS_ENABLED)!=='true'){
      return failure(503,'setup_required',
        '文章草稿功能尚未啟用。請由管理員備份 D1、執行文章草稿遷移 SQL，再設定 DRAFTS_ENABLED=true。');
    }
    if(pathname==='/api/editorial/drafts'){
      if(request.method==='GET'){
        const stmt=user.role==='owner'?
          env.DB.prepare('SELECT id,slug,title,status,revision,created_by,updated_by,created_at,updated_at,submitted_at,reviewed_by,reviewed_at,review_note,seo_title,seo_description,original_seo_title,original_seo_description,github_pr_number,github_pr_url,github_merge_sha,published_at FROM admin_article_drafts ORDER BY updated_at DESC LIMIT 100'):
          env.DB.prepare('SELECT id,slug,title,status,revision,created_by,updated_by,created_at,updated_at,submitted_at,reviewed_by,reviewed_at,review_note,seo_title,seo_description,original_seo_title,original_seo_description,github_pr_number,github_pr_url,github_merge_sha,published_at FROM admin_article_drafts WHERE created_by = ? COLLATE NOCASE ORDER BY updated_at DESC LIMIT 100').bind(user.email);
        const result=await stmt.all();
        return success({items:(result.results||[]).map(x=>publicRow(x)),total:(result.results||[]).length});
      }
      if(request.method==='POST'){
        return await createDraft(env,user,await readInput(request),fetcher,logAudit);
      }
    }
    const match=/^\/api\/editorial\/drafts\/([a-f0-9-]{36})(?:\/(save|submit|review|prepare|merge))?$/i.exec(pathname);
    if(match){
      const row=await getRow(env,match[1]);
      ownDraft(user,row);
      if(!match[2]&&request.method==='GET')return success({draft:publicRow(row,true)});
      if(request.method==='POST'){
        const input=await readInput(request);
        if(match[2]==='save')return await saveDraft(env,user,row,input,logAudit);
        if(match[2]==='submit')return await submitDraft(env,user,row,input,logAudit);
        if(match[2]==='review')return await reviewDraft(env,user,row,input,logAudit);
        if(match[2]==='prepare')return await preparePR(env,user,row,input,fetcher,logAudit);
        if(match[2]==='merge')return await mergePR(env,user,row,input,fetcher,logAudit);
      }
    }
    return failure(404,'not_found','找不到指定的文章管理操作。');
  }catch(error){
    if(error instanceof EditorialError)return failure(error.status,error.code,error.message);
    // Neither GitHub response text nor credentials are included in this error.
    console.error('editorial operation failed',error?.name||'Error');
    return failure(503,'server_error','文章管理服務暫時無法使用，請聯絡管理員。');
  }
}
export const _test={markdownParts,yamlField,prepareMarkdown,seoBlock,updateSeo,encodeGitHubText,decodeGitHubText};
