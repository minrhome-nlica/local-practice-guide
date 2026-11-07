import test from 'node:test';
import assert from 'node:assert/strict';
import { editorRoute, editorInternals as util } from '../src/editor.js';
import worker from '../src/index.js';

const slug='reimbursement';
const fileSha='1111111111111111111111111111111111111111';
const mainSha='2222222222222222222222222222222222222222';
const prHead='3333333333333333333333333333333333333333';
const mergeSha='4444444444444444444444444444444444444444';
const body='原本段落。\n\n## 一、憑證附件\n補助核銷文件應按規定整理。\n';
const full='---\ntitle: 怎麼核銷\nsummary: 核銷文件介紹\ncategory: finance\nupdated: 2026-11-05\nstatus: 編輯稿\n---\n'+body;
const revised='修改後的段落。\n\n## 一、憑證附件\n補助核銷文件應按規定整理。\n';
const editor={role:'editor',email:'edit@nlica.org'};
const owner={role:'owner',email:'owner@nlica.org'};
const moderator={role:'moderator',email:'mod@nlica.org'};
const validId='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
function dbMock(){
  const drafts=new Map(),logs=[],changes=[];
  function bindSql(query,args){
    const first=async()=>{
      if(query.startsWith('SELECT id FROM article_drafts LIMIT 1'))return drafts.size?[{id:[...drafts.keys()][0]}][0]:null;
      if(query.includes('FROM article_drafts WHERE id='))return drafts.get(args[0])||null;
      if(query.startsWith('SELECT id FROM article_drafts WHERE slug=')){
        const row=[...drafts.values()].find(x=>x.slug===args[0]&&x.author_email===args[1]&&
          !['published','cancelled'].includes(x.status));
        return row?{id:row.id}:null;
      }
      throw Error('Unexpected first query '+query);
    };
    const all=async()=>{
      if(query.includes('FROM article_drafts')){
        let data=[...drafts.values()];
        if(query.includes('author_email=?'))data=data.filter(x=>x.author_email===args[0]);
        if(query.includes('status=?'))data=data.filter(x=>x.status===args[args.length-1]);
        return {results:data.slice(0,120)};
      }
      throw Error('Unexpected all query '+query);
    };
    const run=async()=>{
      if(query.startsWith('INSERT INTO article_drafts')){
        const [id,slug,title,base_sha,original_body,draft_body,status,author_email,created_at,updated_at]=args;
        if(drafts.has(id))throw Error('duplicate id');
        drafts.set(id,{id,slug,title,base_sha,original_body,draft_body,status,author_email,revision:1,
          created_at,updated_at,review_note:'',reviewer_email:null,reviewed_at:null,submitted_at:null,
          published_at:null,pr_number:null,pr_url:null,pr_head_sha:null,publish_sha:null});
        return {meta:{changes:1}};
      }
      if(query.startsWith('INSERT INTO admin_audit')){logs.push(args);return{meta:{changes:1}};}
      if(query.startsWith('UPDATE article_drafts')){
        let id,expected,updates;
        if(query.includes('draft_body=?')){
          const [draft_body,updated_at,revision,_id,oldRev]=args;
          id=_id;expected=oldRev;updates={draft_body,updated_at,revision};
        }else if(query.includes("SET status='submitted'")){
          const [submitted_at,updated_at,revision,_id,oldRev]=args;
          id=_id;expected=oldRev;updates={status:'submitted',submitted_at,updated_at,revision};
        }else if(query.includes("SET status='cancelled'")){
          const [updated_at,revision,_id,oldRev]=args;
          id=_id;expected=oldRev;updates={status:'cancelled',updated_at,revision};
        }else if(query.includes("SET status='changes_requested'")){
          const [review_note,reviewer_email,reviewed_at,updated_at,revision,_id,oldRev]=args;
          id=_id;expected=oldRev;updates={status:'changes_requested',review_note,reviewer_email,reviewed_at,updated_at,revision};
        }else if(query.includes("SET status='pr_open'")){
          const [reviewer_email,reviewed_at,pr_number,pr_url,pr_head_sha,updated_at,revision,_id,oldRev]=args;
          id=_id;expected=oldRev;updates={status:'pr_open',reviewer_email,reviewed_at,pr_number,pr_url,pr_head_sha,updated_at,revision};
        }else if(query.includes("SET status='published'")){
          const [publish_sha,published_at,updated_at,revision,_id,oldRev]=args;
          id=_id;expected=oldRev;updates={status:'published',publish_sha,published_at,updated_at,revision};
        }else throw Error('Unexpected UPDATE '+query);
        const row=drafts.get(id);
        if(!row||row.revision!==expected)return {meta:{changes:0}};
        Object.assign(row,updates);changes.push({id,updates});
        return {meta:{changes:1}};
      }
      throw Error('Unexpected run query '+query);
    };
    return {first,all,run};
  }
  return {drafts,logs,changes,prepare(query){return{
    bind(...args){return bindSql(query,args);},
    ...bindSql(query,[])
  }}};
}
function githubMock({stale=false,pending=false}={}){
  const calls=[];
  const func=async (address,options={})=>{
    const path=new URL(address).pathname;
    const method=options.method||'GET';
    const payload=options.body?JSON.parse(options.body):null;
    calls.push({path,method,payload});
    let data;
    if(method==='GET'&&path.includes('/contents/src/content/entries/reimbursement.md')){
      data={type:'file',sha:stale?'5555555555555555555555555555555555555555':fileSha,
        content:Buffer.from(full).toString('base64'),encoding:'base64'};
    }else if(method==='GET'&&path.endsWith('/git/ref/heads/main')){
      data={object:{sha:mainSha}};
    }else if(method==='POST'&&path.endsWith('/git/refs')){
      assert.equal(payload.ref,'refs/heads/guide-editor/'+validId);
      assert.equal(payload.sha,mainSha);
      data={ref:payload.ref};
    }else if(method==='PUT'&&path.includes('/contents/src/content/entries/reimbursement.md')){
      assert.equal(payload.branch,'guide-editor/'+validId);
      assert.equal(payload.sha,fileSha);
      const updated=Buffer.from(payload.content,'base64').toString('utf8');
      assert.ok(updated.includes(revised));
      assert.match(updated,/updated: \d{4}-\d\d-\d\d/);
      data={commit:{sha:prHead}};
    }else if(method==='POST'&&path.endsWith('/pulls')){
      assert.equal(payload.head,'guide-editor/'+validId);
      assert.equal(payload.base,'main');
      data={number:17,html_url:'https://github.com/minrhome-nlica/local-practice-guide/pull/17'};
    }else if(method==='GET'&&path.endsWith('/pulls/17')){
      data={state:'open',head:{ref:'guide-editor/'+validId,sha:prHead},base:{ref:'main'}};
    }else if(method==='GET'&&path.endsWith('/commits/'+prHead+'/check-runs')){
      data={check_runs:[{name:'check-seo',status:pending?'in_progress':'completed',conclusion:pending?null:'success'}]};
    }else if(method==='PUT'&&path.endsWith('/pulls/17/merge')){
      assert.equal(payload.sha,prHead);data={merged:true,sha:mergeSha};
    }else{throw Error('Unexpected github route '+method+' '+path);}
    return {ok:true,status:200,json:async()=>data};
  };
  return {calls,fetcher:func};
}
const env=()=>({DB:dbMock(),GITHUB_EDITOR_TOKEN:'test-secret-never-real'});
const req=(path,input=null,method='GET')=>{
  const url=new URL('https://admin.example'+path);
  return{url,request:new Request(url,{
    method, ...(input!==null?{headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}:{})
  })};
};
async function route(env,user,path,input=null,fetcher=()=>{throw Error('No GitHub expected');}){
  const {url,request}=req(path,input,input===null?'GET':'POST');
  return editorRoute(env,user,request,url,fetcher);
}
function draftSnapshot(row){return{id:row.id,revision:row.revision,status:row.status};}
test('UTF-8 Markdown preserves Chinese, angle brackets and line breaks through GitHub base64',()=>{
  const text='核銷\n\n## 表格\n<strong>可用</strong> 😃\n';
  assert.equal(util.utf8FromB64(util.utf8ToB64(text)),text);
  const parts=util.splitMarkdown(full);
  assert.equal(parts.title,'怎麼核銷');
  assert.equal(parts.body,body);
  const header=util.updateArticleDate(parts.header);
  assert.match(header,/^updated:\s*\d{4}-\d{2}-\d{2}$/m);
  assert.equal(parts.header.includes('title: 怎麼核銷'),true);
});
test('editor rejects dangerous HTML and preserves legal Markdown tables',()=>{
  assert.match(util.validateBody('<script>alert(1)</script>'),/不允許/);
  assert.match(util.validateBody('<div onclick="steal()">x</div>'),/不允許/);
  assert.match(util.validateBody('<a href="javascript:alert(1)">x</a>'),/不允許/);
  assert.match(util.validateBody('<iframe src="x"></iframe>'),/不允許/);
  assert.match(util.validateBody('---\ntitle: 偽造設定\n---'),/正文/);
  assert.equal(util.validateBody('## 第三節\n\n<table><tr><td>核銷</td></tr></table>'),'');
});
test('only editors and owners may open editorial endpoints; blank DB migration does not block old worker',async()=>{
  const e=env();
  const bad=await route(e,moderator,'/api/editor/config');
  assert.equal(bad.status,403);
  const good=await route(e,editor,'/api/editor/config');
  assert.equal(good.status,200);
  assert.equal(good.body.drafts_ready,true);
  assert.equal(good.body.github_ready,true);
  const unauthed=await worker.fetch(new Request('https://admin.example/api/editor/drafts'),
    {DB:{},ACCESS_AUD:'test-aud'}, {});
  assert.equal(unauthed.status,403);
});
test('create/save/submit/review/approve/publish is owner-gated and never edits main directly',async()=>{
  const e=env(),gh=githubMock();
  const source=await route(e,editor,'/api/editor/source?slug='+slug,null,gh.fetcher);
  assert.equal(source.status,200);
  assert.equal(source.body.base_sha,fileSha);
  const create=await route(e,editor,'/api/editor/drafts',{
    slug,base_sha:fileSha,body:'尚未完成\n'
  },gh.fetcher);
  assert.equal(create.status,201);
  const id=create.body.draft_id;
  assert.ok(util.validSha(fileSha));
  const own=await route(e,editor,'/api/editor/drafts/'+id);
  assert.equal(own.status,200);
  assert.equal(own.body.draft.draft_body,'尚未完成\n');
  const stranger=await route(e,{role:'editor',email:'other@nlica.org'},'/api/editor/drafts/'+id);
  assert.equal(stranger.status,403);
  const save=await route(e,editor,'/api/editor/drafts/'+id+'/save',{revision:1,body:revised});
  assert.equal(save.status,200);
  assert.equal(save.body.revision,2);
  const duplicate=await route(e,editor,'/api/editor/drafts',{slug,base_sha:fileSha,body:revised},gh.fetcher);
  assert.equal(duplicate.status,409);
  const stale=await route(e,editor,'/api/editor/drafts/'+id+'/save',{revision:1,body:revised});
  assert.equal(stale.status,409);
  const submit=await route(e,editor,'/api/editor/drafts/'+id+'/submit',{revision:2},gh.fetcher);
  assert.equal(submit.body.status,'submitted');
  const editorApprove=await route(e,editor,'/api/editor/drafts/'+id+'/approve',{revision:3},gh.fetcher);
  assert.equal(editorApprove.status,403);
  const changes=await route(e,owner,'/api/editor/drafts/'+id+'/request-changes',{revision:3,note:'請補充來源'});
  assert.equal(changes.body.status,'changes_requested');
  const editAgain=await route(e,editor,'/api/editor/drafts/'+id+'/save',{revision:4,body:revised+'補充來源。\n'});
  assert.equal(editAgain.status,200);
  const submitAgain=await route(e,editor,'/api/editor/drafts/'+id+'/submit',{revision:5},gh.fetcher);
  assert.equal(submitAgain.body.status,'submitted');
  // The PR publisher checks the latest revision and prevents an earlier owner action.
  const staleOwner=await route(e,owner,'/api/editor/drafts/'+id+'/approve',{revision:3},gh.fetcher);
  assert.equal(staleOwner.status,409);
  // Restore expected reviewed content for deterministic fake GitHub assertion.
  e.DB.drafts.get(id).draft_body=revised;
  const fixedId=e.DB.drafts.get(id);e.DB.drafts.delete(id);fixedId.id=validId;e.DB.drafts.set(validId,fixedId);
  const approved=await route(e,owner,'/api/editor/drafts/'+validId+'/approve',{revision:6},gh.fetcher);
  assert.equal(approved.status,200);
  assert.equal(approved.body.status,'pr_open');
  const published=await route(e,owner,'/api/editor/drafts/'+validId+'/publish',{revision:7},gh.fetcher);
  assert.equal(published.status,200);
  assert.equal(published.body.status,'published');
  assert.equal(e.DB.drafts.get(validId).publish_sha,mergeSha);
  assert.ok(e.DB.logs.some(a=>a.includes('draft_published')));
  assert.ok(!gh.calls.some(c=>c.method==='PUT'&&c.payload?.branch==='main'));
  assert.ok(!gh.calls.some(c=>c.payload&&JSON.stringify(c.payload).includes('test-secret-never-real')));
});
test('author can cancel an unpublished draft but cannot cancel an open PR',async()=>{
  const e=env();
  const row={id:validId,slug,title:'怎麼核銷',base_sha:fileSha,original_body:body,
    draft_body:revised,status:'draft',author_email:editor.email,revision:2};
  e.DB.drafts.set(validId,row);
  const other=await route(e,{role:'editor',email:'other@nlica.org'},
    '/api/editor/drafts/'+validId+'/cancel',{revision:2});
  assert.equal(other.status,403);
  const cancelled=await route(e,editor,'/api/editor/drafts/'+validId+'/cancel',{revision:2});
  assert.equal(cancelled.status,200);
  assert.equal(cancelled.body.status,'cancelled');
  assert.equal(row.revision,3);
  const again=await route(e,editor,'/api/editor/drafts/'+validId+'/cancel',{revision:3});
  assert.equal(again.status,409);
  row.status='pr_open';row.revision=4;
  const pr=await route(e,owner,'/api/editor/drafts/'+validId+'/cancel',{revision:4});
  assert.equal(pr.status,409);
  assert.ok(e.DB.logs.some(a=>a.includes('draft_cancelled')));
});
test('pending SEO checks prevent merge and leave draft in PR state',async()=>{
  const e=env(),gh=githubMock({pending:true});
  e.DB.drafts.set(validId,{
    id:validId,slug,title:'怎麼核銷',base_sha:fileSha,original_body:body,draft_body:revised,
    status:'pr_open',author_email:editor.email,revision:8,
    pr_number:17,pr_head_sha:prHead,pr_url:'https://github.com/minrhome-nlica/local-practice-guide/pull/17'
  });
  const pending=await route(e,owner,'/api/editor/drafts/'+validId+'/publish',{revision:8},gh.fetcher);
  assert.equal(pending.status,409);
  assert.equal(pending.body.code,'checks_pending');
  assert.ok(!gh.calls.some(x=>x.method==='PUT'&&x.path.endsWith('/merge')));
  assert.equal(e.DB.drafts.get(validId).status,'pr_open');
});
test('GitHub secret missing blocks PR creation without exposing token',async()=>{
  const e=env(),gh=githubMock();
  e.GITHUB_EDITOR_TOKEN='';
  e.DB.drafts.set(validId,{
    id:validId,slug,title:'怎麼核銷',base_sha:fileSha,original_body:body,
    draft_body:revised,status:'submitted',author_email:editor.email,revision:2
  });
  const denied=await route(e,owner,'/api/editor/drafts/'+validId+'/approve',{revision:2},gh.fetcher);
  assert.equal(denied.status,503);
  assert.equal(denied.body.code,'github_setup_required');
  assert.equal(gh.calls.length,0);
  assert.doesNotMatch(JSON.stringify(denied.body),/test-secret-never-real/);
});
test('outdated original article SHA prevents submission and approval',async()=>{
  const e=env(),gh=githubMock({stale:true});
  e.DB.drafts.set(validId,{
    id:validId,slug,title:'怎麼核銷',base_sha:fileSha,original_body:body,
    draft_body:revised,status:'submitted',author_email:editor.email,revision:2
  });
  const stale=await route(e,owner,'/api/editor/drafts/'+validId+'/approve',{revision:2},gh.fetcher);
  assert.equal(stale.status,409);
  assert.equal(stale.body.code,'stale_source');
  assert.ok(!gh.calls.some(c=>c.method==='POST'&&c.path.endsWith('/git/refs')));
});
