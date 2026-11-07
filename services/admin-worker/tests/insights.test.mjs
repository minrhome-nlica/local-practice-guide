import test from 'node:test';
import assert from 'node:assert/strict';
import { combineInsights, getContentInsights } from '../src/insights.js';
import { ratingHistory } from '../src/index.js';
import { ADMIN_HTML, ADMIN_CLIENT } from '../src/ui.js';

test('rating timeline shows first and most recent update, never identity or token',async()=>{
  const calls=[];
  const db={prepare(sql){
    return {bind(...a){this.args=a;return this;},async all(){
      calls.push({sql,args:this.args});
      return {results:[
        {entry_id:'reimbursement',entry_title:'怎麼核銷',vote:'unresolved',
          reason:'needs_examples',created_at:'2026-11-07T02:01:00Z',
          updated_at:'2026-11-07T03:12:00Z',
          voter_hash:'NOT_FOR_ADMIN',secret:'NOT_FOR_ADMIN'},
        {entry_id:'reimbursement',entry_title:'怎麼核銷',vote:'helpful',
          reason:'',created_at:'2026-11-07T02:03:00Z',
          updated_at:'2026-11-07T02:03:00Z'}
      ]};
    }};
  }};
  const result=await ratingHistory({DB:db},new URL('https://admin.test/api/ratings/history?period=30&entry=reimbursement'));
  assert.equal(result.status,200);
  assert.equal(result.body.items.length,2);
  assert.equal(result.body.items[0].modified,true);
  assert.equal(result.body.items[1].modified,false);
  assert.equal(result.body.items[0].created_at,'2026-11-07T02:01:00Z');
  assert.equal(result.body.items[0].updated_at,'2026-11-07T03:12:00Z');
  assert.doesNotMatch(JSON.stringify(result),/NOT_FOR_ADMIN|voter_hash|secret/);
  assert.match(calls[0].sql,/ORDER BY updated_at DESC,id DESC LIMIT/);
  assert.match(calls[0].sql,/SELECT entry_id,entry_title,vote,reason,created_at,updated_at/);
  assert.equal(calls[0].args[1],'reimbursement');
});
test('invalid rating article and period are rejected before DB access',async()=>{
  const db={prepare(){throw Error('no DB call expected');}};
  for(const query of ['?period=unknown','?entry=../other','?entry=a%20b']){
    const result=await ratingHistory({DB:db},new URL('https://admin.test/api/ratings/history'+query));
    assert.equal(result.status,400);
  }
});
test('content insights rank raw unresolved+pending counts, not low-sample percentages',()=>{
  const summary=combineInsights(
    [
      {entry_id:'budget-planning',entry_title:'經費編列',total:1,helpful:0,unresolved:1},
      {entry_id:'reimbursement',entry_title:'怎麼核銷',total:12,helpful:7,unresolved:5}
    ],[
      {entry_id:'budget-planning',entry_title:'經費編列',pending:0,published:1},
      {entry_id:'reimbursement',entry_title:'怎麼核銷',pending:4,published:7}
    ],{configured:true,available:true,pageviews:301,visits:101,
      top_pages:[
        {path:'/entries/reimbursement/',pageviews:73},
        {path:'/entries/unlisted-test/',pageviews:3}
      ],rating_reasons:[
        {entry_id:'reimbursement',reason:'needs_examples',n:3}
      ]},30);
  assert.equal(summary.articles[0].slug,'reimbursement');
  assert.equal(summary.articles[0].attention_count,9);
  assert.equal(summary.articles[0].pageviews,73);
  assert.equal(summary.articles[1].pageviews,null);
  assert.equal(summary.articles[1].sample_small,true);
  assert.equal(summary.articles[0].reason_counts.needs_examples,3);
  assert.equal(summary.summary.pending_comments,4);
  assert.equal(summary.analytics.top_pages_only,true);
});
test('content insights queries are aggregated and use recent rating updated dates',async()=>{
  const calls=[];
  const mockDb={prepare(sql){return {bind(...args){this.args=args;return this;},async all(){
    calls.push({sql,args:this.args||[]});
    return {results:[]};
  }};}};
  const source=async(env,url)=>({status:200,body:{
    available:false,configured:false,message:'Cloudflare not configured',top_pages:[]
  }});
  const res=await getContentInsights({DB:mockDb},
    new URL('https://admin.test/api/insights?days=7'),source);
  assert.equal(res.status,200);
  assert.equal(res.body.summary.total_ratings,0);
  assert.equal(res.body.articles.length,0);
  assert.equal(calls.length,3);
  assert.equal(calls.filter(x=>x.sql.includes('updated_at >= ?')).length,2);
  assert.ok(calls.every(x=>!x.sql.includes('SELECT *')));
  assert.equal((await getContentInsights({DB:mockDb},
    new URL('https://admin.test/api/insights?days=365'),source)).status,400);
});
test('mobile admin exposes both new article and feedback timestamp controls safely',()=>{
  assert.match(ADMIN_HTML,/id="new-article-fields"/);
  assert.match(ADMIN_HTML,/id="new-article-seo-description"/);
  assert.match(ADMIN_HTML,/id="rating-history-list"/);
  assert.match(ADMIN_HTML,/id="rating-history-entry"/);
  assert.match(ADMIN_HTML,/data-tab="insights"/);
  assert.doesNotThrow(()=>new Function(ADMIN_CLIENT));
  assert.match(ADMIN_CLIENT,/timeZone:'Asia\/Taipei'/);
});
