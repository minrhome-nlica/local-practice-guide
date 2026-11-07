import test from 'node:test';
import assert from 'node:assert/strict';
import { recentUpdates, toUpdateCandidates } from '../src/updates.js';
import { listArticles } from '../src/articles.js';
import { ADMIN_HTML, ADMIN_CSS, ADMIN_CLIENT } from '../src/ui.js';
import worker from '../src/index.js';

function sampleCommit(sha,msg,date='2026-11-07T01:00:00Z'){
  return {sha,commit:{message:msg,committer:{date}}};
}
const goodSha='abcdef0123456789abcdef0123456789abcdef01';
test('mobile admin menu is collapsible, accessible and touch-friendly',()=>{
  assert.match(ADMIN_HTML,/id="mobile-menu-toggle"[^>]*aria-expanded="false"/);
  assert.match(ADMIN_HTML,/id="navigation"/);
  assert.match(ADMIN_CSS,/max-width:1000px/);
  assert.match(ADMIN_CSS,/\.sidebar\.menu-open nav\{display:grid\}/);
  assert.match(ADMIN_CSS,/max-width:600px/);
  assert.match(ADMIN_CSS,/font-size:16px/);
  assert.match(ADMIN_CSS,/\.analytics-chart\{overflow-x:auto/);
  assert.match(ADMIN_CLIENT,/setMobileMenu\(false\)/);
  assert.doesNotThrow(()=>new Function(ADMIN_CLIENT));
});
test('GitHub commits are classified but never claimed as published notes',()=>{
  const rows=toUpdateCandidates([
    sampleCommit(goodSha,'feat(admin): 新增後台選單'),
    sampleCommit('1111111111111111111111111111111111111111','fix: 修正回饋按鈕'),
    sampleCommit('2222222222222222222222222222222222222222','docs(content): 更新核銷文章'),
    sampleCommit('3333333333333333333333333333333333333333','chore: 更新依賴'),
    sampleCommit('not-sha','feat: 不能包含沒有正式 SHA 的紀錄')
  ]);
  assert.equal(rows.length,4);
  assert.deepEqual(rows.map(x=>x.category),['feature','fix','articles','maintenance']);
  assert.equal(rows[0].important,true);
  assert.equal(rows[3].important,false);
  assert.equal(rows[0].url,'https://github.com/minrhome-nlica/local-practice-guide/commit/'+goodSha);
});
test('internal update list accepts category filters and caps items',async()=>{
  const calls=[];
  const commits=[
    sampleCommit(goodSha,'feat: 新增工具'),
    sampleCommit('1111111111111111111111111111111111111111','docs(content): 更新文章'),
    sampleCommit('2222222222222222222222222222222222222222','fix: 修正錯誤')
  ];
  const fetcher=async(url,opts)=>{
    calls.push({url,opts});return {ok:true,json:async()=>commits};
  };
  const r=await recentUpdates(new URL('https://admin.example/api/updates?type=articles'),fetcher);
  assert.equal(r.status,200);
  assert.equal(r.body.total,1);
  assert.match(r.body.warning,/尚未由管理員核定/);
  assert.equal(r.body.items[0].category,'articles');
  assert.equal(calls.length,1);
  assert.match(calls[0].url,/sha=main/);
});
test('bad update filter is rejected without network',async()=>{
  const r=await recentUpdates(new URL('https://admin.example/api/updates?type=secret'),()=>{
    throw Error('must not fetch');
  });
  assert.equal(r.status,400);
});
test('GitHub failure is generic and never leaks credentials or internal details',async()=>{
  const r=await recentUpdates(new URL('https://admin.example/api/updates'),async()=>({ok:false,status:403}));
  assert.equal(r.status,502);
  assert.doesNotMatch(r.body.error,/403|token/i);
});
test('article catalog parses frontmatter safely and links only to known repository',async()=>{
  const calls=[];
  const files=[
    {name:'budget-planning.md',type:'file'},
    {name:'proposal-writing.md',type:'file'},
    {name:'../evil.md',type:'file'},
    {name:'private.json',type:'file'}
  ];
  const fetcher=async url=>{
    calls.push(url);
    if(url.includes('/contents/src/content/entries')){
      return {ok:true,json:async()=>files};
    }
    const text=url.includes('budget-planning')?
      '---\ntitle: 經費編列\nsummary: 預算與資本門\ncategory: finance\nupdated: 2026-11-07\nstatus: 編輯稿\n---\n內文':
      '---\ntitle: 計畫撰寫\ncategory: plans\nupdated: 2026-11-04\n---\n內文';
    return {ok:true,text:async()=>text};
  };
  const r=await listArticles(fetcher);
  assert.equal(r.status,200);
  assert.equal(r.body.total,2);
  assert.equal(r.body.items[0].title,'經費編列');
  assert.equal(r.body.items[0].editorial_status,'編輯稿');
  assert.match(r.body.note,/不代表尚未公開/);
  assert.equal(calls.length,3);
  assert.equal(r.body.items[0].source_url,'https://github.com/minrhome-nlica/local-practice-guide/blob/main/src/content/entries/budget-planning.md');
  assert.ok(calls.every(x=>!x.includes('evil')));
});
test('catalog can show a partial list if an individual file fails',async()=>{
  const fetcher=async url=>{
    if(url.includes('/contents/'))return {ok:true,json:async()=>[{name:'reimbursement.md',type:'file'}]};
    return {ok:false,status:404};
  };
  const r=await listArticles(fetcher);
  assert.equal(r.status,200);
  assert.equal(r.body.items[0].slug,'reimbursement');
});
test('article management endpoint denies unapproved users before any GitHub call',async()=>{
  const response=await worker.fetch(new Request('https://test.example/api/articles'),{DB:{},ACCESS_AUD:'test-aud'}, {});
  assert.equal(response.status,403);
});
