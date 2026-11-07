import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateArticleMarkdown,stampArticleDate,handleEditorRequest,pullBranch,githubRequest
} from '../src/editor.js';
import {ADMIN_HTML,ADMIN_CSS,ADMIN_CLIENT} from '../src/ui.js';
import worker from '../src/index.js';

const original=[
  '---',
  'title: 怎麼核銷',
  'summary: 從補助核銷、憑證整理到成果報告，認識如何整理政府計畫的文件。',
  'category: finance',
  'level: 實務',
  'updated: 2026-11-05',
  'status: 編輯稿',
  '---',
  '',
  '這是一篇介紹補助核銷如何蒐集發票與經費憑證的文章。',
  '',
  '## 一、準備文件',
  '蒐集資料，確認核定函與成果報告。',
  ''
].join('\n');
const edited=original.replace('蒐集資料，確認核定函與成果報告。','蒐集資料，確認核定函與成果報告，並備妥簽到表。');
const SOURCE_SHA='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const PR_HEAD='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const FINAL_COMMIT='cccccccccccccccccccccccccccccccccccccccc';
const AUD='test-access-audience';

function fakeDB(){
  const drafts=new Map(),audits=[],ddl=[];
  const db={
    prepare(sql) {
      const stmt={
        args:[],
        bind(...args){this.args=args;return this;},
        async first(){
          const a=this.args;
          if(sql.startsWith('SELECT email, display_name, role, active FROM admin_users')){
            const role=a[0]==='owner@example.org'?'owner':a[0]==='editor@example.org'?'editor':
              a[0]==='other@example.org'?'editor':a[0]==='mod@example.org'?'moderator':'';
            return role?{email:a[0],role,active:1,display_name:role}:null;
          }
          if(sql.includes('SELECT * FROM admin_article_drafts WHERE id='))return drafts.get(a[0])||null;
          if(sql.includes('SELECT id,author_email FROM admin_article_drafts WHERE slug=')){
            return [...drafts.values()].find(d=>d.slug===a[0]&&!['cancelled','published'].includes(d.status))||null;
          }
          return null;
        },
        async all(){
          if(sql.includes('FROM admin_article_drafts')){
            const all=[...drafts.values()];
            return{results:all.filter(d=>sql.includes('WHERE author_email')?d.author_email===this.args[0]:true)
              .map(({original_text,content,source_sha,...d})=>({...d}))};
          }
          return {results:[]};
        },
        async run(){
          const a=this.args;
          if(sql.startsWith('CREATE TABLE')||sql.startsWith('CREATE INDEX')||sql.startsWith('CREATE UNIQUE INDEX')){
            ddl.push(sql);return{meta:{changes:0}};
          }
          if(sql.startsWith('INSERT INTO admin_article_drafts')){
            const [id,slug,source_sha,original_text,content,author_email,updated_by,created_at,updated_at]=a;
            drafts.set(id,{id,slug,source_sha,original_text,content,status:'draft',author_email,
              updated_by,created_at,updated_at,reviewed_by:'',review_note:'',revision:1,
              pr_number:0,pr_head_sha:'',pr_url:'',published_commit:'',submitted_at:'',published_at:''});
            return {meta:{changes:1}};
          }
          if(sql.startsWith('INSERT INTO admin_audit')){audits.push(a);return{meta:{changes:1}};}
          if(sql.startsWith('UPDATE admin_article_drafts')){
            let id,expected,update;
            if(sql.includes('SET content=')){
              [id,expected]=a.slice(3);
              update=d=>{d.content=a[0];d.updated_by=a[1];d.updated_at=a[2];};
            }else if(sql.includes("SET status='review'")){
              [id,expected]=a.slice(3);
              update=d=>{d.status='review';d.submitted_at=a[0];d.updated_by=a[1];d.updated_at=a[2];d.review_note='';};
            }else if(sql.includes("SET status='changes_requested'")){
              [id,expected]=a.slice(3);
              update=d=>{d.status='changes_requested';d.review_note=a[0];d.reviewed_by=a[1];d.updated_at=a[2];};
            }else if(sql.includes("SET status='staged'")){
              [id,expected]=a.slice(5);
              update=d=>{d.status='staged';d.reviewed_by=a[0];d.pr_number=a[1];d.pr_head_sha=a[2];d.pr_url=a[3];d.updated_at=a[4];};
            }else if(sql.includes("SET status='published'")){
              [id,expected]=a.slice(3);
              update=d=>{d.status='published';d.published_commit=a[0];d.published_at=a[1];d.updated_at=a[2];};
            }else if(sql.includes("SET status='cancelled'")){
              [id,expected]=a.slice(2);
              update=d=>{d.status='cancelled';d.updated_by=a[0];d.updated_at=a[1];};
            }
            const d=drafts.get(id);
            if(!d||d.revision!==expected)return {meta:{changes:0}};
            update(d);d.revision++;
            return {meta:{changes:1}};
          }
          throw Error('Unexpected query: '+sql);
        }
      };
      return stmt;
    }
  };
  return {db,drafts,audits,ddl};
}
function fakeGithub(){
  const log=[];
  let allowedChecks=true,changedSource=false,allowCreatePR=true;
  const fetcher=async (url,options)=>{
    const uri=new URL(url),method=options.method||'GET';
    const data=options.body?JSON.parse(options.body):null;
    log.push({uri:uri.pathname+uri.search,method,data,headers:options.headers});
    const payload=(status,body)=>({ok:status>=200&&status<300,status,json:async()=>body});
    if(uri.pathname.includes('/contents/src/content/entries/reimbursement.md')){
      if(method==='GET'){
        return payload(200,{sha:changedSource?'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee':SOURCE_SHA,
          size:Buffer.byteLength(original),encoding:'base64',
          content:Buffer.from(original).toString('base64')});
      }
      if(method==='PUT'){
        assert.equal(data.branch.startsWith('guide-article-reimbursement-'),true);
        assert.equal(data.sha,SOURCE_SHA);
        assert.match(Buffer.from(data.content,'base64').toString('utf8'),/updated:\s*\d{4}-\d{2}-\d{2}/);
        return payload(200,{commit:{sha:PR_HEAD}});
      }
    }
    if(uri.pathname.endsWith('/git/ref/heads/main'))return payload(200,{object:{sha:SOURCE_SHA}});
    if(uri.pathname.endsWith('/git/refs')&&method==='POST')return payload(201,{ref:data.ref});
    if(uri.pathname.endsWith('/pulls')&&method==='POST'){
      if(!allowCreatePR)return payload(403,{message:'insufficient token'});
      return payload(201,{number:41,html_url:'https://github.com/minrhome-nlica/local-practice-guide/pull/41',
        head:{ref:data.head,sha:PR_HEAD},base:{ref:'main'}});
    }
    if(uri.pathname.endsWith('/pulls/41')&&method==='GET'){
      return payload(200,{state:'open',head:{ref:'guide-article-reimbursement-'+log.find(x=>x.data?.ref?.startsWith('refs/heads/guide-article'))?.data.ref.split('-').at(-1),
        sha:PR_HEAD},base:{ref:'main'}});
    }
    if(uri.pathname.endsWith('/commits/'+PR_HEAD+'/check-runs')){
      assert.equal(uri.searchParams.get('check_name'),'check-seo');
      return payload(200,{check_runs:allowedChecks?[{name:'check-seo',status:'completed',conclusion:'success'}]:
        [{name:'check-seo',status:'in_progress',conclusion:null}]});
    }
    if(uri.pathname.endsWith('/pulls/41/merge')&&method==='PUT'){
      assert.equal(data.sha,PR_HEAD);
      return payload(200,{merged:true,sha:FINAL_COMMIT});
    }
    return payload(404,{message:'not found'});
  };
  return {fetcher,log,setChanged:v=>changedSource=v,setChecks:v=>allowedChecks=v};
}
const owner={role:'owner',email:'owner@example.org'};
const editor={role:'editor',email:'editor@example.org'};
const other={role:'editor',email:'other@example.org'};
const moderator={role:'moderator',email:'mod@example.org'};
function request(path,method='GET',data) {
  return new Request('https://admin.example.org'+path,{
    method,
    ...(method==='POST'?{headers:{'Content-Type':'application/json',Origin:'https://admin.example.org'},
      body:JSON.stringify(data||{})}:{})
  });
}
async function call(env,user,path,method='GET',data,fetcher=fetch){
  return handleEditorRequest(env,user,request(path,method,data),
    new URL('https://admin.example.org'+path),fetcher);
}

test('Markdown checks catch malformed or dangerous content, retain dates, and limit size',()=>{
  assert.equal(validateArticleMarkdown(original),'');
  assert.equal(validateArticleMarkdown(edited,original),'');
  assert.match(validateArticleMarkdown(edited.replace('category: finance','category: plans'),original),/分類/);
  assert.match(validateArticleMarkdown(edited.replace('updated: 2026-11-05','updated: yesterday')),/updated|更新日期/);
  assert.match(validateArticleMarkdown(edited+'<script>alert(1)</script>',original),/不安全/);
  assert.match(validateArticleMarkdown('x'.repeat(200000)),/190 KB/);
  const stamped=stampArticleDate(edited,'2026-11-07');
  assert.ok(stamped.includes('updated: 2026-11-07'));
  assert.ok(stamped.includes('簽到表'));
});

test('authorized staff can create and edit a D1 draft but cannot overwrite a stale version',async()=>{
  const {db,drafts,audits,ddl}=fakeDB(),git=fakeGithub(),env={DB:db};
  const created=await call(env,editor,'/api/editor/drafts','POST',{slug:'reimbursement'},git.fetcher);
  assert.equal(created.status,201);
  const id=created.body.draft.id;
  assert.ok(id);
  assert.equal(created.body.draft.source_sha,SOURCE_SHA);
  assert.equal(ddl.length>=4,true);
  const duplicate=await call(env,editor,'/api/editor/drafts','POST',{slug:'reimbursement'},git.fetcher);
  assert.equal(duplicate.status,409);
  const blocked=await call(env,other,'/api/editor/drafts/'+id,'GET',undefined,git.fetcher);
  assert.equal(blocked.status,403);
  const saved=await call(env,editor,'/api/editor/drafts/'+id+'/save','POST',{content:edited,expected_revision:1},git.fetcher);
  assert.equal(saved.status,200);
  assert.equal(saved.body.draft.revision,2);
  const stale=await call(env,editor,'/api/editor/drafts/'+id+'/save','POST',{content:original,expected_revision:1},git.fetcher);
  assert.equal(stale.status,409);
  assert.equal(drafts.get(id).content,edited);
  assert.equal(audits.length,2);
});
test('review approval requires owner and GitHub secret; staged changes never publish automatically',async()=>{
  const {db,drafts}=fakeDB(),git=fakeGithub(),env={DB:db};
  const created=(await call(env,editor,'/api/editor/drafts','POST',{slug:'reimbursement'},git.fetcher)).body.draft;
  const id=created.id,path='/api/editor/drafts/'+id;
  await call(env,editor,path+'/save','POST',{content:edited,expected_revision:1},git.fetcher);
  let out=await call(env,editor,path+'/submit','POST',{expected_revision:2},git.fetcher);
  assert.equal(out.status,200);assert.equal(out.body.draft.status,'review');
  out=await call(env,editor,path+'/stage','POST',{expected_revision:3,confirm:'APPROVE'},git.fetcher);
  assert.equal(out.status,403);
  out=await call(env,owner,path+'/stage','POST',{expected_revision:3,confirm:'APPROVE'},git.fetcher);
  assert.equal(out.status,503);assert.equal(out.body.code,'github_token_required');
  assert.equal(git.log.filter(x=>x.method!=='GET').length,0);
  assert.equal(drafts.get(id).status,'review');
});
test('reviewer return notes, editor resubmits, and owner stages a separate GitHub pull request',async()=>{
  const {db}=fakeDB(),git=fakeGithub(),env={DB:db,GITHUB_EDITOR_TOKEN:'test-token-only-not-real'};
  const created=(await call(env,editor,'/api/editor/drafts','POST',{slug:'reimbursement'},git.fetcher)).body.draft;
  const id=created.id,path='/api/editor/drafts/'+id;
  await call(env,editor,path+'/save','POST',{content:edited,expected_revision:1},git.fetcher);
  await call(env,editor,path+'/submit','POST',{expected_revision:2},git.fetcher);
  let out=await call(env,owner,path+'/return','POST',{expected_revision:3,note:'補充實際核銷憑證的說明。'},git.fetcher);
  assert.equal(out.body.draft.status,'changes_requested');
  const newer=edited.replace('實際','完整');
  await call(env,editor,path+'/save','POST',{content:newer,expected_revision:4},git.fetcher);
  await call(env,editor,path+'/submit','POST',{expected_revision:5},git.fetcher);
  out=await call(env,owner,path+'/stage','POST',{expected_revision:6,confirm:'APPROVE'},git.fetcher);
  assert.equal(out.status,200);
  assert.equal(out.body.draft.status,'staged');
  assert.equal(out.body.draft.pr_number,41);
  assert.equal(git.log.some(x=>x.method==='PUT'&&x.uri.includes('/contents/')),true);
  assert.equal(git.log.some(x=>x.method==='POST'&&x.uri.endsWith('/pulls')),true);
  assert.equal(git.log.some(x=>x.uri.endsWith('/merge')),false);
  assert.equal(JSON.stringify(out.body).includes('test-token-only-not-real'),false);
});
test('GitHub PR publish is blocked until SEO checks pass and only owner merges',async()=>{
  const {db}=fakeDB(),git=fakeGithub(),env={DB:db,GITHUB_EDITOR_TOKEN:'test-token-only-not-real'};
  const row=(await call(env,editor,'/api/editor/drafts','POST',{slug:'reimbursement'},git.fetcher)).body.draft;
  const p='/api/editor/drafts/'+row.id;
  await call(env,editor,p+'/save','POST',{content:edited,expected_revision:1},git.fetcher);
  await call(env,editor,p+'/submit','POST',{expected_revision:2},git.fetcher);
  let res=await call(env,owner,p+'/stage','POST',{expected_revision:3,confirm:'APPROVE'},git.fetcher);
  assert.equal(res.status,200);
  const staged=res.body.draft;
  res=await call(env,editor,p+'/publish','POST',{expected_revision:staged.revision,confirm:'PUBLISH'},git.fetcher);
  assert.equal(res.status,403);
  git.setChecks(false);
  res=await call(env,owner,p+'/publish','POST',{expected_revision:staged.revision,confirm:'PUBLISH'},git.fetcher);
  assert.equal(res.status,409);assert.equal(res.body.code,'checks_not_ready');
  assert.equal(git.log.some(x=>x.uri.endsWith('/merge')),false);
  git.setChecks(true);
  res=await call(env,owner,p+'/publish','POST',{expected_revision:staged.revision,confirm:'PUBLISH'},git.fetcher);
  assert.equal(res.status,200);
  assert.equal(res.body.draft.status,'published');
  assert.equal(res.body.draft.published_commit,FINAL_COMMIT);
  assert.equal(git.log.filter(x=>x.uri.endsWith('/merge')).length,1);
});
test('changed original GitHub file SHA prevents staging and merging stale content',async()=>{
  const {db}=fakeDB(),git=fakeGithub(),env={DB:db,GITHUB_EDITOR_TOKEN:'test-token-only-not-real'};
  const row=(await call(env,editor,'/api/editor/drafts','POST',{slug:'reimbursement'},git.fetcher)).body.draft;
  const p='/api/editor/drafts/'+row.id;
  await call(env,editor,p+'/save','POST',{content:edited,expected_revision:1},git.fetcher);
  await call(env,editor,p+'/submit','POST',{expected_revision:2},git.fetcher);
  git.setChanged(true);
  const res=await call(env,owner,p+'/stage','POST',{expected_revision:3,confirm:'APPROVE'},git.fetcher);
  assert.equal(res.status,409);
  assert.equal(res.body.code,'source_changed');
  assert.equal(git.log.some(x=>x.method==='PUT'),false);
});
test('moderator is denied and cross-site write request is stopped in worker',async()=>{
  const {db}=fakeDB(),env={DB:db,ACCESS_AUD:AUD};
  const r=await call(env,moderator,'/api/editor/drafts');
  assert.equal(r.status,403);
  const request=new Request('https://admin.example.org/api/editor/drafts',{
    method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.example.org'},
    body:JSON.stringify({slug:'reimbursement'})
  });
  const response=await worker.fetch(request,env,{access:{aud:AUD,getIdentity:async()=>({email:owner.email})}});
  assert.equal(response.status,403);
});
test('mobile editor controls and script parse without exposing the GitHub token',()=>{
  assert.doesNotThrow(()=>new Function(ADMIN_CLIENT));
  assert.match(ADMIN_HTML,/id="draft-content"/);
  assert.match(ADMIN_HTML,/id="draft-stage"/);
  assert.match(ADMIN_HTML,/id="draft-publish"/);
  assert.match(ADMIN_CSS,/draft-action-bar/);
  assert.doesNotMatch(ADMIN_HTML,/test-token-only-not-real/);
  assert.match(ADMIN_CLIENT,/function bindDraftActions/);
  assert.match(ADMIN_CLIENT,/expected_revision/);
});

test('public GitHub CI checks are read without fine-grained PAT; PR operations retain token',async()=>{
  const env={GITHUB_EDITOR_TOKEN:'secret-token-that-must-stay-private'};
  const seen=[];
  const fetcher=async (_url,opts)=>{
    seen.push({method:opts.method,headers:opts.headers});
    return {ok:true,status:200,json:async()=>({check_runs:[]})};
  };
  await githubRequest(env,fetcher,'GET','/commits/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/check-runs?check_name=check-seo&filter=latest');
  assert.equal(seen[0].headers.Authorization,undefined,'public CI read must omit fine-grained PAT');
  await githubRequest(env,fetcher,'GET','/contents/src/content/entries/reimbursement.md?ref=main');
  assert.equal(seen[1].headers.Authorization,'Bearer secret-token-that-must-stay-private');
  await githubRequest(env,fetcher,'PUT','/pulls/42/merge',{merge_method:'squash'});
  assert.equal(seen[2].headers.Authorization,'Bearer secret-token-that-must-stay-private');
});

test('create new article draft requires unique slug, valid category, metadata and private D1 storage',async()=>{
  const {db,drafts}=fakeDB(),calls=[];
  const env={DB:db,GITHUB_EDITOR_TOKEN:'new-article-test-token'};
  const git=async(url,opts)=>{
    calls.push({url,opts});
    return {ok:false,status:404,json:async()=>({message:'not found'})};
  };
  const data={
    slug:'community-learning-guide',
    title:'社區共學活動怎麼辦',
    category:'plans',
    summary:'整理社區共學活動的準備、經費編列和成果檢查方式，供地方工作者參考。',
    seo_title:'社區共學活動籌備指南：計畫、經費與成果',
    seo_description:'了解如何籌備社區共學活動、準備相關文件、編列經費與整理成果，以實務案例說明。',
    tags:['社區','共學']
  };
  let result=await call(env,editor,'/api/editor/new','POST',data,git);
  assert.equal(result.status,201,JSON.stringify(result.body));
  const row=result.body.draft;
  assert.equal(row.slug,data.slug);
  assert.equal(row.source_sha,'NEW_ARTICLE');
  assert.equal(row.original_text,'');
  assert.match(row.content,/seo_title: "社區共學活動籌備指南/);
  assert.match(row.content,/tags:\n  - "社區"\n  - "共學"/);
  assert.equal(drafts.size,1);
  assert.equal(calls.length,1);
  assert.ok(calls[0].url.endsWith('/contents/src/content/entries/community-learning-guide.md?ref=main'));
  const duplicate=await call(env,editor,'/api/editor/new','POST',data,git);
  assert.equal(duplicate.status,409);
  const blocked=await call(env,editor,'/api/editor/new','POST',{...data,category:'invalid'},git);
  assert.equal(blocked.status,400);
  const invalidSlug=await call(env,editor,'/api/editor/new','POST',{...data,slug:'../etc'},git);
  assert.equal(invalidSlug.status,400);
  const oneWithoutBody=await call(env,editor,'/api/editor/drafts/'+row.id+'/submit','POST',{expected_revision:1},git);
  assert.equal(oneWithoutBody.status,422);
  assert.equal(drafts.get(row.id).status,'draft');
});

test('new article stages Markdown and SEO in a dedicated PR; no automatic site publishing',async()=>{
  const {db,drafts}=fakeDB();
  const env={DB:db,GITHUB_EDITOR_TOKEN:'new-article-test-token'};
  const slug='community-learning-guide',sha='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    head='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    mergeSha='cccccccccccccccccccccccccccccccccccccccc';
  const seoSource=[
    'export const articleSearchMetadata: Record<string, {title: string; description: string}> = {',
    "  'existing': {",
    "    title: '舊版標題',",
    "    description: '舊版摘要'",
    '  }',
    '};',
    '',
    'export const homepageSearch = {',
    "  title: '首頁',",
    "  description: '首頁搜尋描述'",
    '};',
    ''
  ].join('\n');
  const calls=[];
  const git=async(url,opts)=>{
    const uri=new URL(url),method=opts.method||'GET';
    const data=opts.body?JSON.parse(opts.body):null;
    calls.push({path:uri.pathname+uri.search,method,data});
    const payload=(status,body)=>({ok:status>=200&&status<300,status,json:async()=>body});
    if(uri.pathname.endsWith('/contents/src/content/entries/'+slug+'.md')&&method==='GET')
      return payload(404,{message:'not found'});
    if(uri.pathname.endsWith('/git/ref/heads/main'))return payload(200,{object:{sha}});
    if(uri.pathname.endsWith('/git/refs')&&method==='POST')return payload(201,{ref:data.ref});
    if(uri.pathname.endsWith('/contents/src/content/entries/'+slug+'.md')&&method==='PUT'){
      assert.ok(!Object.hasOwn(data,'sha'),'new file must not specify old blob SHA');
      assert.equal(data.branch.startsWith('guide-article-'+slug+'-'),true);
      assert.match(Buffer.from(data.content,'base64').toString('utf8'),/社區共學活動怎麼辦/);
      return payload(200,{commit:{sha:head}});
    }
    if(uri.pathname.endsWith('/contents/src/data/seo.ts')&&method==='GET'){
      return payload(200,{sha,encoding:'base64',
        content:Buffer.from(seoSource,'utf8').toString('base64')});
    }
    if(uri.pathname.endsWith('/contents/src/data/seo.ts')&&method==='PUT'){
      assert.equal(data.sha,sha);
      assert.equal(data.branch.startsWith('guide-article-'+slug+'-'),true);
      const actual=Buffer.from(data.content,'base64').toString('utf8');
      assert.match(actual,/community-learning-guide/);
      assert.match(actual,/export const homepageSearch/);
      assert.match(actual,/existing/);
      return payload(200,{commit:{sha:head}});
    }
    if(uri.pathname.endsWith('/pulls')&&method==='POST'){
      assert.equal(data.base,'main');
      return payload(201,{number:42,
        html_url:'https://github.com/minrhome-nlica/local-practice-guide/pull/42',
        head:{ref:data.head,sha:head}});
    }
    if(uri.pathname.endsWith('/pulls/42')&&method==='GET'){
      const branch=calls.find(x=>x.path.endsWith('/git/refs')).data.ref.replace('refs/heads/','');
      return payload(200,{state:'open',base:{ref:'main'},head:{ref:branch,sha:head}});
    }
    if(uri.pathname.endsWith('/pulls/42/files')){
      return payload(200,[
        {filename:'src/content/entries/'+slug+'.md',status:'added'},
        {filename:'src/data/seo.ts',status:'modified'}
      ]);
    }
    if(uri.pathname.endsWith('/commits/'+head+'/check-runs')){
      return payload(200,{check_runs:[{name:'check-seo',status:'completed',conclusion:'success'}]});
    }
    if(uri.pathname.endsWith('/pulls/42/merge')&&method==='PUT')
      return payload(200,{merged:true,sha:mergeSha});
    return payload(404,{message:'not found'});
  };
  const details={
    slug,title:'社區共學活動怎麼辦',category:'plans',
    summary:'整理社區共學活動的準備、經費編列和成果檢查方式，供地方工作者參考。',
    seo_title:'社區共學活動籌備指南：計畫、經費與成果',
    seo_description:'了解如何籌備社區共學活動、準備相關文件、編列經費與整理成果，以實務案例說明。'
  };
  const created=await call(env,editor,'/api/editor/new','POST',details,git);
  assert.equal(created.status,201,JSON.stringify(created.body));
  const id=created.body.draft.id;
  const updated=created.body.draft.content.replace(
    '請在這裡填寫文章內容，儲存後再提交審核。',
    '這是一篇完整的社區共學文章。從人員邀請、場地準備、活動安排，到經費編列、執行紀錄和成果資料整理，逐步說明如何準備。'.repeat(2)
  );
  const path='/api/editor/drafts/'+id;
  assert.equal((await call(env,editor,path+'/save','POST',
    {expected_revision:1,content:updated},git)).status,200);
  assert.equal((await call(env,editor,path+'/submit','POST',
    {expected_revision:2},git)).status,200);
  const staged=await call(env,owner,path+'/stage','POST',
    {expected_revision:3,confirm:'APPROVE'},git);
  assert.equal(staged.status,200,JSON.stringify(staged.body));
  assert.equal(staged.body.draft.status,'staged');
  assert.equal(drafts.get(id).pr_number,42);
  assert.ok(!calls.some(x=>x.path.endsWith('/pulls/42/merge')));
  const published=await call(env,owner,path+'/publish','POST',
    {expected_revision:4,confirm:'PUBLISH'},git);
  assert.equal(published.status,200,JSON.stringify(published.body));
  assert.equal(published.body.draft.status,'published');
  assert.equal(published.body.draft.published_commit,mergeSha);
  assert.ok(calls.some(x=>x.path.endsWith('/commits/'+head+'/check-runs?check_name=check-seo&filter=latest&per_page=20')));
});
