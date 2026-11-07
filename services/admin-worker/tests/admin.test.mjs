import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { ADMIN_HTML, ADMIN_CSS, ADMIN_CLIENT } from '../src/ui.js';

const ORIGIN = 'https://admin.guide.mountcounty.com';
const ID = '11111111-1111-1111-1111-111111111111';
const stamp = '2026-11-06T09:00:00.000Z';
function fixture() {
  const store = {
    users: [
      { email:'owner@example.org',display_name:'Admin',role:'owner',active:1 },
      { email:'editor@example.org',display_name:'Editor',role:'editor',active:1 },
      { email:'mod@example.org',display_name:'Moderator',role:'moderator',active:1 },
      { email:'disabled@example.org',display_name:'Disabled',role:'owner',active:0 }
    ],
    comments: [{
      id:ID,entry_id:'reimbursement',entry_title:'怎麼核銷',author:'讀者',
      status:'pending',body:'核銷是否需要簽到表？',admin_reply:'',
      created_at:stamp,updated_at:stamp,kind:'question',quote:''
    }],
    audits:[]
  };
  const db = {
    prepare(sql) {
      const stmt = {
        args:[],
        bind(...args){this.args=args;return this;},
        async first(){
          const a=this.args;
          if(sql.startsWith('SELECT email, display_name'))return store.users.find(u=>u.email===a[0])||null;
          if(sql.startsWith('SELECT status, admin_reply'))return store.comments.find(x=>x.id===a[0])||null;
          if(sql.startsWith('SELECT COUNT(*) AS n FROM admin_users'))return {n:1};
          if(sql.startsWith('SELECT email FROM admin_users'))return store.users.find(x=>x.email===a[0])||null;
          if(sql.includes('FROM article_ratings'))return {total:0,helpful:0,unresolved:0};
          return null;
        },
        async all(){
          if(sql.includes('FROM feedback WHERE status'))return {results:store.comments.filter(x=>x.status===this.args[0])};
          if(sql.includes('FROM feedback GROUP BY status'))return {results:[{status:'pending',n:store.comments.length}]};
          if(sql.includes('FROM admin_users ORDER BY'))return {results:store.users};
          if(sql.includes('FROM admin_audit ORDER BY'))return {results:store.audits};
          return {results:[]};
        },
        async run(){
          const a=this.args;
          if(sql.startsWith('UPDATE feedback SET')){
            const row=store.comments.find(x=>x.id===a[3]&&x.updated_at===a[4]);
            if(!row)return {meta:{changes:0}};
            row.status=a[0];row.admin_reply=a[1];row.updated_at=a[2];
            return {meta:{changes:1}};
          }
          if(sql.startsWith('INSERT INTO admin_audit')){
            store.audits.push({actor_email:a[1],action:a[2],entity:a[3],entity_id:a[4],details:a[5]});
          }
          return {meta:{changes:1}};
        }
      };
      return stmt;
    }
  };
  return {env:{DB:db,ACCESS_AUD:'valid-audience',SITE_URL:'https://guide.mountcounty.com'},store};
}
function identity(email='owner@example.org',aud='valid-audience'){
  return {access:{aud,getIdentity:async()=>({email})}};
}
async function call(path, env, ctx, init={}){
  return worker.fetch(new Request(ORIGIN+path,init),env,ctx);
}
test('client code parses and render has no embedded password',()=>{
  assert.doesNotThrow(()=>new Function(ADMIN_CLIENT));
  assert.match(ADMIN_HTML,/管理後台/);
  assert.match(ADMIN_HTML,/\/app\.js/);
  assert.match(ADMIN_CSS,/max-width:1000px/);
  assert.doesNotMatch(ADMIN_HTML,/ADMIN_TOKEN|Bearer\s+[a-z0-9]/i);
});
test('dashboard navigation selects every panel instead of calling array methods on a single element',()=>{
  assert.match(ADMIN_CLIENT,/const \$ = selector => document\.querySelector\(selector\)/);
  assert.match(ADMIN_CLIENT,/const \$\$ = selector => \[\.\.\.document\.querySelectorAll\(selector\)\]/);
  assert.ok(ADMIN_CLIENT.includes("$('[data-panel]').forEach("));
  assert.ok(!ADMIN_CLIENT.includes("$('[data-panel]').forEach("));
});
test('no Access identity is denied and no data leaks',async()=>{
  const {env}=fixture();
  const response=await call('/api/me',env,{});
  assert.equal(response.status,403);
  assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');
  assert.equal(response.headers.get('x-frame-options'),'DENY');
});
test('Access audience mismatch is denied',async()=>{
  const {env}=fixture();
  assert.equal((await call('/api/me',env,identity('owner@example.org','wrong'))).status,403);
});
test('no configured Access audience fails closed',async()=>{
  const {env}=fixture();
  delete env.ACCESS_AUD;
  assert.equal((await call('/',env,identity())).status,503);
});
test('invalid, disabled, or unlisted staff are denied',async()=>{
  const {env}=fixture();
  for(const email of ['someone@example.org','disabled@example.org']){
    assert.equal((await call('/api/me',env,identity(email))).status,403);
  }
});
test('authorized owner can read session and homepage',async()=>{
  const {env}=fixture();
  const response=await call('/api/me',env,identity());
  assert.equal(response.status,200);
  assert.deepEqual((await response.json()).user,{email:'owner@example.org',display_name:'Admin',role:'owner'});
  assert.equal((await call('/',env,identity())).headers.get('content-type'),'text/html; charset=utf-8');
});
test('editor cannot view or modify moderated comments',async()=>{
  const {env}=fixture(),ctx=identity('editor@example.org');
  assert.equal((await call('/api/comments',env,ctx)).status,403);
  assert.equal((await call('/api/comments/'+ID,env,ctx,{
    method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json'},
    body:JSON.stringify({status:'approved',admin_reply:'',expected_updated_at:stamp})
  })).status,403);
});
test('moderator can read comments but not team or audit',async()=>{
  const {env}=fixture(),ctx=identity('mod@example.org');
  const comments=await call('/api/comments?status=pending',env,ctx);
  assert.equal(comments.status,200);
  assert.equal((await comments.json()).items.length,1);
  assert.equal((await call('/api/users',env,ctx)).status,403);
  assert.equal((await call('/api/audit',env,ctx)).status,403);
});
test('cross-site POST cannot perform mutation',async()=>{
  const {env,store}=fixture();
  const r=await call('/api/comments/'+ID,env,identity(),{
    method:'POST',headers:{Origin:'https://evil.example.org','Content-Type':'application/json'},
    body:JSON.stringify({status:'approved',expected_updated_at:stamp,admin_reply:''})
  });
  assert.equal(r.status,403);
  assert.equal(store.comments[0].status,'pending');
});
test('moderator can approve and audit changes',async()=>{
  const {env,store}=fixture();
  const r=await call('/api/comments/'+ID,env,identity('mod@example.org'),{
    method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json'},
    body:JSON.stringify({status:'approved',expected_updated_at:stamp,admin_reply:'已檢查資料。'})
  });
  assert.equal(r.status,200);
  assert.equal(store.comments[0].status,'approved');
  assert.equal(store.audits.length,1);
  assert.equal(store.audits[0].actor_email,'mod@example.org');
});
test('stale comment edit is rejected instead of overwriting',async()=>{
  const {env,store}=fixture();
  const r=await call('/api/comments/'+ID,env,identity(),{
    method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json'},
    body:JSON.stringify({status:'approved',expected_updated_at:'2024-01-01',admin_reply:''})
  });
  assert.equal(r.status,409);
  assert.equal(store.comments[0].status,'pending');
});
