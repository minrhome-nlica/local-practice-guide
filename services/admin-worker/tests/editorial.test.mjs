import test from 'node:test';
import assert from 'node:assert/strict';
import { handleEditorial, _test } from '../src/editorial.js';
import { ADMIN_HTML, ADMIN_CSS, ADMIN_CLIENT } from '../src/ui.js';
import worker from '../src/index.js';

const origin='https://guide-admin-console.e7968.workers.dev';
const ARTICLE='src/content/entries/reimbursement.md';
const SEO='src/data/seo.ts';
const oldSha='a'.repeat(40);
const seoSha='b'.repeat(40);
const headSha='c'.repeat(40);
const mdBlob='d'.repeat(40);
const seoBlob='e'.repeat(40);
const prHead='f'.repeat(40);
const mergeSha='1'.repeat(40);
const original='---\n'+
  'title: 怎麼核銷\n'+
  'summary: 從經費編列到原始憑證與核銷文件整理的完整說明\n'+
  'category: finance\n'+
  'level: 實務\n'+
  'updated: 2026-11-05\n'+
  'status: 編輯稿\n'+
  'related:\n  - budget-planning\n'+
  '---\n\n'+
  '這裡是尚未修改的文章。請保存表格和 HTML。\n\n'+
  '<table><tr><td>原始表格</td></tr></table>\n';
const seo='export const metadata = {\n'+
  "  'reimbursement': {\n"+
  "    title: '政府補助怎麼核銷？憑證、領據與成果報告整理',\n"+
  "    description: '政府補助案核銷怎麼做？從核定函、原始憑證到黏貼憑證及成果佐證。'\n"+
  '  },\n'+
  "  'budget-planning': {\n"+
  "    title: '經費編列說明',\n"+
  "    description: '說明經費編列。'\n"+
  '  }\n};\n';
const owner={role:'owner',email:'owner@example.org'};
const editor={role:'editor',email:'editor@example.org'};
const moderator={role:'moderator',email:'mod@example.org'};
const send=(path,body)=>new Request(origin+path,{
  method:'POST',headers:{'Content-Type':'application/json','Origin':origin},
  body:JSON.stringify(body)
});
const get=path=>new Request(origin+path);
function fixtures(){
  const rows=new Map(),audits=[];
  const db={
    prepare(sql){
      const stmt={args:[],
        bind(...args){this.args=args;return this;},
        async first(){
          const a=this.args;
          if(sql.startsWith('SELECT id,created_by,status FROM admin_article_drafts')){
            return [...rows.values()].find(x=>x.slug===a[0]&&
              ['draft','submitted','changes_requested','approved','pr_ready'].includes(x.status))||null;
          }
          if(sql.startsWith('SELECT * FROM admin_article_drafts')){
            return rows.get(a[0])||null;
          }
          return null;
        },
        async all(){
          return {results:[...rows.values()].filter(x=>
            !sql.includes('created_by = ?')||x.created_by.toLowerCase()===this.args[0].toLowerCase())};
        },
        async run(){
          const a=this.args;
          if(sql.startsWith('INSERT INTO admin_article_drafts')){
            const [id,slug,title,baseSha,baseText,draftText,originalSeoSha,oldTitle,
              oldDesc,newTitle,newDesc,createdBy,updatedBy,createdAt,updatedAt]=a;
            rows.set(id,{
              id,slug,title,status:'draft',original_blob_sha:baseSha,
              original_content:baseText,draft_content:draftText,
              original_seo_sha:originalSeoSha,original_seo_title:oldTitle,
              original_seo_description:oldDesc,seo_title:newTitle,seo_description:newDesc,
              created_by:createdBy,updated_by:updatedBy,created_at:createdAt,updated_at:updatedAt,
              revision:1,review_note:'',reviewed_by:null,reviewed_at:null,
              github_pr_number:null,github_pr_url:null
            });
            return {meta:{changes:1}};
          }
          if(sql.startsWith('UPDATE admin_article_drafts SET')){
            let id,rev,statusNeeded;
            if(sql.includes("status='draft'")){
              [id,rev]=a.slice(-2);statusNeeded=['draft','changes_requested'];
            }else if(sql.includes("status='submitted'")){
              [id,rev]=a.slice(-2);statusNeeded=['draft','changes_requested'];
            }else if(sql.includes('SET status=?,reviewed_by')){
              [id,rev]=a.slice(-2);statusNeeded=['submitted'];
            }else if(sql.includes("status='pr_ready'")){
              [id,rev]=a.slice(-2);statusNeeded=['approved'];
            }else if(sql.includes("status='published'")){
              [id,rev]=a.slice(-2);statusNeeded=['pr_ready'];
            }else throw Error('Unexpected SQL update '+sql);
            const row=rows.get(id);
            if(!row||row.revision!==rev||!statusNeeded.includes(row.status)){
              return {meta:{changes:0}};
            }
            if(sql.includes("status='draft'")){
              const [title,body,seoTitle,seoDesc,email,time]=a;
              Object.assign(row,{title,draft_content:body,seo_title:seoTitle,
                seo_description:seoDesc,updated_by:email,updated_at:time,status:'draft',
                reviewed_by:null,reviewed_at:null,review_note:''});
            }
            if(sql.includes("status='submitted'")){
              row.status='submitted';row.submitted_at=a[0];row.updated_at=a[1];
            }
            if(sql.includes('SET status=?,reviewed_by')){
              const [status,reviewer,note,time,updated]=a;
              Object.assign(row,{status,reviewed_by:reviewer,review_note:note,
                reviewed_at:time,updated_at:updated});
            }
            if(sql.includes("status='pr_ready'")){
              const [branch,number,url,mdSha,sSha,time]=a;
              Object.assign(row,{status:'pr_ready',github_branch:branch,
                github_pr_number:number,github_pr_url:url,
                prepared_md_blob_sha:mdSha,prepared_seo_blob_sha:sSha,
                updated_at:time});
            }
            if(sql.includes("status='published'")){
              const [sha,time,updated]=a;
              Object.assign(row,{status:'published',github_merge_sha:sha,
                published_at:time,updated_at:updated});
            }
            row.revision+=1;
            return {meta:{changes:1}};
          }
          throw Error('Unexpected SQL run '+sql);
        }
      };
      return stmt;
    }
  };
  const env={DB:db,DRAFTS_ENABLED:'true',GITHUB_EDITOR_TOKEN:''};
  const logAudit=async(_env,user,action,entity,id,details)=>{
    audits.push({actor:user.email,action,entity,id,details});
  };
  return {env,rows,audits,logAudit};
}
function response(data,status=200){
  return {ok:status>=200&&status<300,status,json:async()=>data};
}
function rawFile(content,sha){
  return {content:Buffer.from(content,'utf8').toString('base64'),sha,encoding:'base64'};
}
function mockGitHub({modified=false,checksSuccess=true,currentChanged=false}={}){
  const calls=[];
  const fetcher=async(url,opts)=>{
    const path=url.split('/repos/minrhome-nlica/local-practice-guide/')[1];
    const payload=opts.body?JSON.parse(opts.body):null;
    calls.push({path,method:opts.method,body:payload,headers:opts.headers});
    if(path.startsWith('contents/'+ARTICLE+'?')){
      return response(rawFile(original,currentChanged?'9'.repeat(40):oldSha));
    }
    if(path.startsWith('contents/'+SEO+'?'))return response(rawFile(seo,seoSha));
    if(path==='git/ref/heads/main')return response({object:{sha:headSha}});
    if(path==='git/refs')return response({ref:payload.ref});
    if(path==='contents/'+ARTICLE&&opts.method==='PUT'){
      return response({content:{sha:mdBlob}});
    }
    if(path==='contents/'+SEO&&opts.method==='PUT'){
      return response({content:{sha:seoBlob}});
    }
    if(path==='pulls'&&opts.method==='POST'){
      return response({number:17,
        html_url:'https://github.com/minrhome-nlica/local-practice-guide/pull/17'});
    }
    if(path==='pulls/17'){
      return response({
        state:'open',mergeable:true,base:{ref:'main'},
        head:{ref:payload?.head||('guide-editorial/draft-'+calls.find(x=>x.path==='git/refs')?.body?.ref?.split('draft-')[1]),
          sha:prHead,repo:{full_name:'minrhome-nlica/local-practice-guide'}}
      });
    }
    if(path==='pulls/17/files?per_page=100'){
      return response([
        {filename:ARTICLE,status:'modified',sha:modified?'6'.repeat(40):mdBlob},
        {filename:SEO,status:'modified',sha:seoBlob}
      ]);
    }
    if(path==='commits/'+prHead+'/check-runs?per_page=100'){
      return response({check_runs:[{name:'check-seo',
        status:'completed',conclusion:checksSuccess?'success':'failure'}]});
    }
    if(path==='pulls/17/merge'&&opts.method==='PUT'){
      return response({merged:true,sha:mergeSha});
    }
    throw Error('Unexpected GitHub call: '+path+' '+opts.method);
  };
  return {fetcher,calls};
}
async function request(f,user,path,data,fetcher){
  const r=await handleEditorial(f.env,user,
    data===undefined?get(path):send(path,data),
    new URL(origin+path),f.logAudit,fetcher||(()=>{throw Error('Unexpected network');}));
  return r;
}
test('Markdown metadata and existing HTML are preserved, active script content is blocked',()=>{
  const before=_test.markdownParts(original);
  assert.equal(_test.yamlField(before.header,'title'),'怎麼核銷');
  const changed=_test.prepareMarkdown(original,'新標題','更新摘要需要保留原有資訊',
    '這是修改過的內容和表格。\n<table><tr><td>仍存在</td></tr></table>');
  assert.match(changed,/category: finance/);
  assert.match(changed,/related:\n  - budget-planning/);
  assert.match(changed,/title: "新標題"/);
  assert.match(changed,/updated: 2026-11-05/);
  assert.match(changed,/<table>/);
  assert.throws(()=>_test.prepareMarkdown(original,'新標題','更新摘要需要保留原有資訊',
    '太短<script>alert(1)</script>多一點可編輯文字'),/不可加入腳本/);
  assert.throws(()=>_test.prepareMarkdown(original,'新標題','更新摘要需要保留原有資訊',
    '<div onclick="bad()">這段內容具有不安全的事件</div>'),/不可加入可執行/);
});
test('SEO edit only changes the approved article key',()=>{
  const before=_test.seoBlock(seo,'reimbursement');
  assert.match(before.title,/政府補助/);
  const next=_test.updateSeo(seo,'reimbursement','新的標題', '新的摘要');
  assert.match(next,/"新的標題"/);
  assert.match(next,/budget-planning/);
  assert.match(next,/經費編列說明/);
  assert.equal(_test.seoBlock(next,'reimbursement').description,'新的摘要');
});
test('D1 setup is fail-closed and moderator has no editorial access',async()=>{
  const f=fixtures();
  assert.equal((await request(f,moderator,'/api/editorial/status')).status,403);
  const stat=await request(f,owner,'/api/editorial/status');
  assert.equal(stat.body.drafts_enabled,true);
  f.env.DRAFTS_ENABLED='false';
  assert.equal((await request(f,editor,'/api/editorial/drafts')).status,503);
  assert.equal(f.rows.size,0);
});
test('draft -> edited -> submitted -> returned -> approved; editor cannot approve',async()=>{
  const f=fixtures(),gh=mockGitHub();
  const created=await request(f,editor,'/api/editorial/drafts',
    {slug:'reimbursement'},gh.fetcher);
  assert.equal(created.status,201);
  const id=created.body.draft_id;
  assert.ok(/^[a-f0-9-]{36}$/.test(id));
  assert.equal(f.rows.get(id).original_blob_sha,oldSha);
  assert.equal(f.rows.get(id).seo_title,_test.seoBlock(seo,'reimbursement').title);
  assert.equal((await request(f,owner,'/api/editorial/drafts',{slug:'reimbursement'},gh.fetcher)).body.existing,true);
  const saveData={expected_revision:1,title:'怎麼核銷',
    summary:'核銷憑證及成果報告，新增社區實例與檢查清單',
    seo_title:'社區補助核銷完整指南：流程與憑證整理',
    seo_description:'完整說明如何進行政府補助的憑證核銷，包括簽到表、領據及成果報告整理。',
    body:'新增一段說明，用真實工作坊的支出表格示範。\n\n'+
      '<table><tr><td>補助款核銷範例</td></tr></table>'
  };
  const saved=await request(f,editor,'/api/editorial/drafts/'+id+'/save',saveData);
  assert.equal(saved.body.revision,2);
  assert.equal((await request(f,editor,'/api/editorial/drafts/'+id+'/save',saveData)).status,409);
  assert.equal((await request(f,moderator,'/api/editorial/drafts/'+id)).status,403);
  const bad=await request(f,editor,'/api/editorial/drafts/'+id+'/save',{
    ...saveData,expected_revision:2,body:'<iframe src="https://evil.invalid"></iframe> long body text'
  });
  assert.equal(bad.status,400);
  const submitted=await request(f,editor,'/api/editorial/drafts/'+id+'/submit',{expected_revision:2});
  assert.equal(submitted.body.status,'submitted');
  assert.equal((await request(f,editor,'/api/editorial/drafts/'+id+'/review',
    {expected_revision:3,action:'approve'})).status,403);
  const returned=await request(f,owner,'/api/editorial/drafts/'+id+'/review',
    {expected_revision:3,action:'request_changes',note:'請補充核銷佐證'});
  assert.equal(returned.body.status,'changes_requested');
  const resaved=await request(f,editor,'/api/editorial/drafts/'+id+'/save',{
    ...saveData,expected_revision:4});
  assert.equal(resaved.body.status,'draft');
  const resubmitted=await request(f,editor,'/api/editorial/drafts/'+id+'/submit',{expected_revision:5});
  assert.equal(resubmitted.body.status,'submitted');
  const approved=await request(f,owner,'/api/editorial/drafts/'+id+'/review',
    {expected_revision:6,action:'approve',note:'已確認'});
  assert.equal(approved.body.status,'approved');
  const noToken=await request(f,owner,'/api/editorial/drafts/'+id+'/prepare',
    {expected_revision:7},gh.fetcher);
  assert.equal(noToken.status,503);
  assert.equal(noToken.body.code,'github_token_missing');
  assert.equal(f.rows.get(id).status,'approved');
  assert.ok(f.audits.some(x=>x.action==='request_changes'));
  assert.ok(f.audits.some(x=>x.action==='approve'));
});
async function prepareWorkflow(f,gh){
  const newDraft=await request(f,editor,'/api/editorial/drafts',{slug:'reimbursement'},gh.fetcher);
  const id=newDraft.body.draft_id;
  const saved=await request(f,editor,'/api/editorial/drafts/'+id+'/save',{
    expected_revision:1,title:'怎麼核銷',
    summary:'這是一篇新的核銷流程與實作說明，適合社區工作者閱讀',
    body:'新版本的核銷說明，補充各種憑證與簽到表的處理方式。\n\n'+
      '<table><tr><td>保存原始 HTML 表格</td></tr></table>',
    seo_title:'政府補助案核銷：憑證與成果報告',
    seo_description:'整理政府補助案核銷需要的領據、簽到表與成果報告，並說明核銷步驟。'
  });
  assert.equal(saved.status,200);
  assert.equal((await request(f,editor,'/api/editorial/drafts/'+id+'/submit',
    {expected_revision:2})).body.status,'submitted');
  assert.equal((await request(f,owner,'/api/editorial/drafts/'+id+'/review',
    {expected_revision:3,action:'approve'})).body.status,'approved');
  return id;
}
test('owner creates PR without writing main, then merges only after successful checks',async()=>{
  const f=fixtures();const gh=mockGitHub();
  const id=await prepareWorkflow(f,gh);
  f.env.GITHUB_EDITOR_TOKEN='fine-grained-token-test-only-123456';
  const prepared=await request(f,owner,'/api/editorial/drafts/'+id+'/prepare',
    {expected_revision:4},gh.fetcher);
  assert.equal(prepared.status,200,JSON.stringify(prepared.body));
  assert.equal(prepared.body.status,'pr_ready');
  assert.equal(f.rows.get(id).github_pr_number,17);
  const articleWrite=gh.calls.find(x=>x.path==='contents/'+ARTICLE&&x.method==='PUT');
  const seoWrite=gh.calls.find(x=>x.path==='contents/'+SEO&&x.method==='PUT');
  assert.ok(articleWrite&&seoWrite);
  assert.ok(articleWrite.body.branch.startsWith('guide-editorial/draft-'));
  assert.equal(articleWrite.body.sha,oldSha);
  assert.match(Buffer.from(articleWrite.body.content,'base64').toString('utf8'),
    new RegExp('updated: '+new Date().toISOString().slice(0,10)));
  assert.doesNotMatch(JSON.stringify(prepared.body),/fine-grained-token-test-only/);
  const merged=await request(f,owner,'/api/editorial/drafts/'+id+'/merge',
    {expected_revision:5},gh.fetcher);
  assert.equal(merged.status,200,JSON.stringify(merged.body));
  assert.equal(merged.body.status,'published');
  assert.equal(f.rows.get(id).status,'published');
  assert.equal(f.rows.get(id).github_merge_sha,mergeSha);
  assert.ok(gh.calls.some(x=>x.path==='commits/'+prHead+'/check-runs?per_page=100'));
  assert.ok(gh.calls.some(x=>x.path==='pulls/17/merge'));
  assert.ok(f.audits.some(x=>x.action==='publish'));
});
test('failed CI or changed PR file blocks publication and leaves workflow at pr_ready',async()=>{
  for(const conditions of [{checksSuccess:false},{modified:true}]){
    const f=fixtures();const gh=mockGitHub(conditions);
    const id=await prepareWorkflow(f,gh);
    f.env.GITHUB_EDITOR_TOKEN='fine-grained-token-test-only-123456';
    const ready=await request(f,owner,'/api/editorial/drafts/'+id+'/prepare',
      {expected_revision:4},gh.fetcher);
    assert.equal(ready.body.status,'pr_ready');
    const attempted=await request(f,owner,'/api/editorial/drafts/'+id+'/merge',
      {expected_revision:5},gh.fetcher);
    assert.equal(attempted.status,409);
    assert.equal(f.rows.get(id).status,'pr_ready');
    assert.ok(!gh.calls.some(x=>x.path==='pulls/17/merge'));
  }
});
test('changed live GitHub source blocks PR creation to prevent overwrites',async()=>{
  const f=fixtures();const initial=mockGitHub();const id=await prepareWorkflow(f,initial);
  f.env.GITHUB_EDITOR_TOKEN='fine-grained-token-test-only-123456';
  const gh=mockGitHub({currentChanged:true});
  const blocked=await request(f,owner,'/api/editorial/drafts/'+id+'/prepare',
    {expected_revision:4},gh.fetcher);
  assert.equal(blocked.status,409);
  assert.equal(blocked.body.code,'source_changed');
  assert.ok(!gh.calls.some(x=>x.method==='PUT'||x.path==='git/refs'));
});
test('admin UI includes editor controls and still parses',()=>{
  assert.match(ADMIN_HTML,/data-tab="editorial"/);
  assert.match(ADMIN_HTML,/id="editorial-submit"/);
  assert.match(ADMIN_HTML,/id="editorial-request-changes"/);
  assert.match(ADMIN_HTML,/id="editorial-merge-pr"/);
  assert.match(ADMIN_CSS,/\.editorial-compare-grid/);
  assert.doesNotThrow(()=>new Function(ADMIN_CLIENT));
});
test('without Cloudflare Access even owners cannot read editorial API',async()=>{
  const response=await worker.fetch(new Request(origin+'/api/editorial/drafts'),
    {DB:{},ACCESS_AUD:'correct-aud',DRAFTS_ENABLED:'true'}, {});
  assert.equal(response.status,403);
});
