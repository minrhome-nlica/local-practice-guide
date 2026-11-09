// Private draft assets. Files remain in Cloudflare R2 until a reviewed GitHub PR
// publishes them under public/assets/guide/<slug>/... alongside the article.
// Access + admin_users role checks MUST be enforced by index.js as well.
const DRAFT_ID=/^[a-f0-9-]{36}$/i;
const ASSET_ID=/^[a-f0-9-]{36}$/i;
const EXTENSIONS={
  png:{type:'image/png',max:5000000,image:true},
  jpg:{type:'image/jpeg',max:5000000,image:true},
  jpeg:{type:'image/jpeg',max:5000000,image:true},
  webp:{type:'image/webp',max:5000000,image:true},
  pdf:{type:'application/pdf',max:5000000,image:false},
  docx:{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',max:5000000,image:false},
  xlsx:{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',max:5000000,image:false}
};
const MAX_TOTAL=24000000,MAX_FILES=12;
const ok=(body={},status=200)=>({status,body:{ok:true,...body}});
const fail=(status,error,code='invalid')=>({status,body:{ok:false,error,code}});
const iso=()=>new Date().toISOString();
const fileName=value=>String(value||'').replace(/[\u0000-\u001f\u007f\\/:*?"<>|]/g,'_').trim().slice(0,125)||'attachment';
const ready=env=>!!env?.GUIDE_MEDIA&&typeof env.GUIDE_MEDIA.put==='function'&&
  typeof env.GUIDE_MEDIA.get==='function'&&typeof env.GUIDE_MEDIA.delete==='function';
const assetPath=row=>'/assets/guide/'+row.slug+'/'+row.id+'.'+row.ext;
const repoPath=row=>'public'+assetPath(row);
const keyFor=(draftId,assetId,ext)=>'drafts/'+draftId+'/'+assetId+'.'+ext;
async function ensureTable(env){
  await env.DB.prepare(
    'CREATE TABLE IF NOT EXISTS admin_draft_assets ('+
    'id TEXT PRIMARY KEY,draft_id TEXT NOT NULL,slug TEXT NOT NULL,'+
    'original_name TEXT NOT NULL,ext TEXT NOT NULL,content_type TEXT NOT NULL,'+
    'byte_size INTEGER NOT NULL,sha256_hex TEXT NOT NULL,object_key TEXT NOT NULL,'+
    'created_by TEXT NOT NULL,created_at TEXT NOT NULL)'
  ).run();
  await env.DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_admin_draft_assets_draft ON admin_draft_assets(draft_id,created_at)'
  ).run();
}
async function getDraft(env,id,user){
  if(!DRAFT_ID.test(id))return {error:fail(400,'草稿識別碼不正確。')};
  const row=await env.DB.prepare(
    'SELECT id,slug,status,author_email,content FROM admin_article_drafts WHERE id=?'
  ).bind(id).first();
  if(!row)return {error:fail(404,'找不到這份文章草稿。')};
  if(user.role!=='owner'&&row.author_email.toLowerCase()!==user.email.toLowerCase()){
    return {error:fail(403,'無權存取其他編輯人員的草稿。','forbidden')};
  }
  return {row};
}
async function audit(env,user,action,assetId,description){
  await env.DB.prepare(
    'INSERT INTO admin_audit (id,actor_email,action,entity,entity_id,details,created_at)'+
    ' VALUES (?,?,?,?,?,?,?)'
  ).bind(crypto.randomUUID(),user.email,action,'article_asset',assetId,
    String(description||'').slice(0,350),iso()).run();
}
function matchesSignature(bytes,ext){
  if(ext==='png')return [137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n);
  if(ext==='jpg'||ext==='jpeg')return bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(ext==='webp')return [82,73,70,70].every((n,i)=>bytes[i]===n)&&
    [87,69,66,80].every((n,i)=>bytes[8+i]===n);
  if(ext==='pdf')return [37,80,68,70,45].every((n,i)=>bytes[i]===n);
  // DOCX/XLSX are ZIP containers and always served as downloadable attachments.
  if(ext==='docx'||ext==='xlsx')return [80,75,3,4].every((n,i)=>bytes[i]===n);
  return false;
}
async function sha256(bytes){
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function publicAsset(row){
  return {id:row.id,draft_id:row.draft_id,slug:row.slug,
    name:row.original_name,ext:row.ext,size:Number(row.byte_size),
    content_type:row.content_type,created_at:row.created_at,
    image:!!EXTENSIONS[row.ext]?.image,path:assetPath(row)};
}
export async function listedDraftAssets(env,draftId){
  await ensureTable(env);
  const results=await env.DB.prepare(
    'SELECT id,draft_id,slug,original_name,ext,content_type,byte_size,sha256_hex,'+
    'object_key,created_by,created_at FROM admin_draft_assets WHERE draft_id=? ORDER BY created_at,id'
  ).bind(draftId).all();
  return results.results||[];
}
export async function referencedDraftAssets(env,row){
  const rows=await listedDraftAssets(env,row.id);
  return rows.filter(asset=>String(row.content||'').includes(assetPath(asset)));
}
export async function stageDraftAssets(env,row,branch,githubRequest,fetcher){
  const assets=await referencedDraftAssets(env,row);
  if(!assets.length)return ok({paths:[]});
  if(!ready(env))return fail(503,'草稿有附件，但 Cloudflare R2 尚未正確綁定，已停止發布。','storage_required');
  for(const asset of assets){
    const object=await env.GUIDE_MEDIA.get(asset.object_key);
    if(!object)return fail(409,'某筆附件不在私人暫存空間，已停止建立發布請求。','asset_missing');
    const bytes=new Uint8Array(await object.arrayBuffer());
    if(bytes.byteLength!==Number(asset.byte_size)||
      (await sha256(bytes))!==asset.sha256_hex){
      return fail(409,'附件大小或雜湊值不一致，已停止發布。','asset_changed');
    }
    let binary='';
    for(let i=0;i<bytes.length;i+=12000){
      binary+=String.fromCharCode(...bytes.subarray(i,i+12000));
    }
    const res=await githubRequest(env,fetcher,'PUT','/contents/'+repoPath(asset),{
      message:'assets: add reviewed guide attachment '+asset.id.slice(0,8),
      content:btoa(binary),branch
    });
    if(!res.ok||!res.data?.commit?.sha){
      return fail(503,'附件未能加入 GitHub 審核分支，正式網站沒有受到影響。','github_error');
    }
  }
  return ok({paths:assets.map(repoPath)});
}
export async function handleDraftMedia(env,user,request,url){
  if(!['owner','editor'].includes(user.role))return fail(403,'沒有文章附件管理權限。','forbidden');
  const path=url.pathname.replace(/\/+$/,'');
  const match=/^\/api\/media\/drafts\/([a-f0-9-]{36})(?:\/(upload|delete|assets\/[a-f0-9-]{36}))?$/i.exec(path);
  if(!match)return fail(404,'找不到草稿附件操作。');
  const {row,error}=await getDraft(env,match[1],user);
  if(error)return error;
  if(!ready(env)){
    if(request.method!=='GET'||match[2])return fail(503,
      '私人圖片與附件空間尚未完成設定，請先連接 Cloudflare R2。','storage_required');
    return ok({configured:false,items:[],
      message:'圖片與附件上傳尚未啟用。請由管理員在 guide-admin-console Worker 綁定名為 GUIDE_MEDIA 的私人 R2 Bucket。'});
  }
  await ensureTable(env);
  const action=match[2]||'';
  if(!action&&request.method==='GET'){
    const rows=await listedDraftAssets(env,row.id);
    return ok({configured:true,items:rows.map(publicAsset),limit:MAX_FILES});
  }
  const matchFile=/^assets\/([a-f0-9-]{36})$/i.exec(action);
  if(matchFile&&request.method==='GET'){
    if(!ASSET_ID.test(matchFile[1]))return fail(400,'附件識別碼不正確。');
    const asset=await env.DB.prepare(
      'SELECT * FROM admin_draft_assets WHERE id=? AND draft_id=?'
    ).bind(matchFile[1],row.id).first();
    if(!asset)return fail(404,'找不到此附件。');
    const object=await env.GUIDE_MEDIA.get(asset.object_key);
    if(!object)return fail(404,'附件已無法讀取，請聯絡管理員。');
    const headers=new Headers({
      'Content-Type':asset.content_type,
      'Cache-Control':'private, no-store',
      'X-Content-Type-Options':'nosniff',
      'Content-Security-Policy':"default-src 'none'; sandbox"
    });
    if(!EXTENSIONS[asset.ext]?.image){
      headers.set('Content-Disposition',
        "attachment; filename*=UTF-8''"+encodeURIComponent(fileName(asset.original_name)));
    }
    return new Response(object.body,{status:200,headers});
  }
  if(!['draft','changes_requested'].includes(row.status)){
    return fail(409,'文章已送審，附件只能在編輯中的草稿上傳或刪除。','locked');
  }
  if(action==='upload'&&request.method==='POST'){
    if(!/^multipart\/form-data\b/i.test(request.headers.get('Content-Type')||'')){
      return fail(415,'請使用檔案選擇器上傳圖片或附件。');
    }
    if(Number(request.headers.get('Content-Length')||0)>6200000){
      return fail(413,'附件單次上傳限 5 MB。','too_large');
    }
    let form;
    try{form=await request.formData();}catch{return fail(400,'無法讀取上傳檔案。');}
    const file=form.get('file');
    if(!file||typeof file.arrayBuffer!=='function'||typeof file.name!=='string'){
      return fail(400,'請先選擇圖片或附件。');
    }
    const ext=String(file.name).split('.').pop().toLowerCase();
    const spec=EXTENSIONS[ext];
    if(!spec)return fail(415,'檔案僅支援 PNG、JPG、WebP、PDF、DOCX、XLSX。','unsupported');
    if(file.size<1||file.size>spec.max)return fail(413,'每個檔案不得超過 5 MB。','too_large');
    const stats=await env.DB.prepare(
      'SELECT COUNT(*) AS n,COALESCE(SUM(byte_size),0) AS bytes FROM admin_draft_assets WHERE draft_id=?'
    ).bind(row.id).first();
    if(Number(stats.n)>=MAX_FILES||Number(stats.bytes)+file.size>MAX_TOTAL){
      return fail(409,'每份草稿最多 12 個附件、合計不超過 24 MB。','storage_limit');
    }
    const bytes=new Uint8Array(await file.arrayBuffer());
    if(bytes.byteLength!==file.size||!matchesSignature(bytes,ext)){
      return fail(415,'檔案內容與副檔名不符，已拒絕上傳。','invalid_file');
    }
    const id=crypto.randomUUID(),key=keyFor(row.id,id,ext);
    const hash=await sha256(bytes);
    try{
      await env.GUIDE_MEDIA.put(key,bytes,{
        httpMetadata:{contentType:spec.type},
        customMetadata:{draft:row.id,sha256:hash}
      });
    }catch{return fail(503,'私人附件空間暫時無法寫入。','storage_unavailable');}
    const name=fileName(file.name),created=iso();
    try{
      await env.DB.prepare(
        'INSERT INTO admin_draft_assets (id,draft_id,slug,original_name,ext,'+
        'content_type,byte_size,sha256_hex,object_key,created_by,created_at) '+
        'VALUES (?,?,?,?,?,?,?,?,?,?,?)'
      ).bind(id,row.id,row.slug,name,ext,spec.type,bytes.byteLength,hash,key,user.email,created).run();
    }catch{
      await env.GUIDE_MEDIA.delete(key).catch(()=>{});
      return fail(503,'附件資料未能儲存，請稍後重試。','storage_unavailable');
    }
    await audit(env,user,'draft_asset_upload',id,row.slug+' / '+ext);
    return ok({asset:publicAsset({
      id,draft_id:row.id,slug:row.slug,original_name:name,ext,
      content_type:spec.type,byte_size:bytes.byteLength,created_at:created
    })},201);
  }
  if(action==='delete'&&request.method==='POST'){
    if(!(request.headers.get('Content-Type')||'').toLowerCase().startsWith('application/json')){
      return fail(415,'資料格式不正確。');
    }
    let body;
    try{body=await request.json();}catch{return fail(400,'資料格式不正確。');}
    if(!ASSET_ID.test(body?.id||''))return fail(400,'附件識別碼不正確。');
    const asset=await env.DB.prepare(
      'SELECT * FROM admin_draft_assets WHERE id=? AND draft_id=?'
    ).bind(body.id,row.id).first();
    if(!asset)return fail(404,'找不到此附件。');
    if(String(row.content||'').includes(assetPath(asset))){
      return fail(409,'文章仍引用這個附件。請先從文章正文移除圖片或檔案連結並儲存草稿。','still_referenced');
    }
    await env.DB.prepare('DELETE FROM admin_draft_assets WHERE id=? AND draft_id=?')
      .bind(body.id,row.id).run();
    await env.GUIDE_MEDIA.delete(asset.object_key).catch(()=>{});
    await audit(env,user,'draft_asset_delete',body.id,row.slug);
    return ok({deleted:true});
  }
  return fail(405,'不支援的附件操作方式。');
}
export const _mediaTest={matchesSignature,assetPath,repoPath};
