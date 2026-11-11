import test from 'node:test';
import assert from 'node:assert/strict';
import { GUIDE_CATEGORIES, categorizeArticle, getArticleCategoryIndex } from '../src/catalog.js';
import { ratingHistory } from '../src/index.js';
import { ADMIN_HTML, ADMIN_CLIENT } from '../src/ui.js';

test('six filter categories match actual public catalog names and cross-listings',()=>{
  assert.deepEqual(GUIDE_CATEGORIES.map(x=>x.slug),
    ['basics','organizations','plans','finance','people','tools']);
  assert.deepEqual(GUIDE_CATEGORIES.map(x=>x.name),
    ['認識地方實踐','組織成立與經營','計畫與資源','經費與財務','人事與法律','工作工具與技能']);
  assert.deepEqual(categorizeArticle({
    slug:'income-withholding',title:'預扣所得稅',category:'organizations'
  }).categories,['organizations','finance']);
  assert.deepEqual(categorizeArticle({
    slug:'comprehensive-income-tax',title:'綜合所得稅',category:'people'
  }).categories,['people']);
  // The site cross-lists comprehensive-income-tax in people if not its primary category.
  assert.deepEqual(categorizeArticle({
    slug:'comprehensive-income-tax',title:'綜合所得稅',category:'finance'
  }).categories,['finance','people']);
});
test('article index uses GitHub main frontmatter rather than rating names',async()=>{
  const calls=[];
  const fetcher=async(url,opts)=>{
    calls.push(url);
    if(url.includes('/contents/src/content/entries?ref=main')){
      return {ok:true,json:async()=>[
        {type:'file',name:'reimbursement.md'},
        {type:'file',name:'income-withholding.md'}
      ]};
    }
    const finance=url.includes('reimbursement');
    const body=[
      '---','title: '+(finance?'怎麼核銷':'預扣所得稅'),
      'summary: 社區工作者常見問題','category: '+(finance?'finance':'organizations'),
      'updated: 2026-11-07','---','正文'
    ].join('\n');
    return {ok:true,text:async()=>body};
  };
  const result=await getArticleCategoryIndex({},fetcher);
  assert.equal(result.status,200);
  assert.equal(result.body.items.length,2);
  const reimb=result.body.items.find(x=>x.slug==='reimbursement');
  assert.deepEqual(reimb.categories,['finance']);
  const withheld=result.body.items.find(x=>x.slug==='income-withholding');
  assert.deepEqual(withheld.categories,['organizations','finance']);
  assert.equal(calls.filter(x=>x.startsWith('https://raw.githubusercontent.com')).length,2);
});
test('history filters by category in SQL BEFORE pagination and rejects mismatched article',async()=>{
  const queries=[];
  const DB={prepare(sql){
    const statement={bind(...values){this.params=values;return this;},async all(){
      queries.push({sql,params:this.params});
      return {results:[{entry_id:'reimbursement',entry_title:'怎麼核銷',vote:'helpful',
        reason:'',created_at:'2026-11-08T04:12:00Z',updated_at:'2026-11-08T04:12:00Z'}]};
    }};return statement;
  }};
  const index=async()=>({status:200,body:{items:[
    {slug:'reimbursement',categories:['finance']},
    {slug:'income-withholding',categories:['organizations','finance']},
    {slug:'local-practice',categories:['basics']}
  ]}});
  const result=await ratingHistory({DB},
    new URL('https://admin.local/api/ratings/history?category=finance&period=all&limit=25'),
    index);
  assert.equal(result.status,200);
  assert.equal(result.body.items.length,1);
  assert.match(queries[0].sql,/entry_id IN \(\?,\?\)/);
  assert.deepEqual(queries[0].params.slice(0,2),['reimbursement','income-withholding']);
  const mismatch=await ratingHistory({DB},
    new URL('https://admin.local/api/ratings/history?category=finance&entry=local-practice'),
    index);
  assert.equal(mismatch.status,400);
  assert.equal(queries.length,1);
});
test('history category values cannot inject arbitrary SQL; no source fetch for all categories',async()=>{
  const env={DB:{prepare(){throw Error('not called on bad category');}}};
  const bad=await ratingHistory(env,
    new URL('https://admin.local/api/ratings/history?category=finance%20OR%201%3D1'));
  assert.equal(bad.status,400);
});
test('category/article selects exist for both history and insights; code parses',()=>{
  assert.match(ADMIN_HTML,/id="rating-history-category"/);
  assert.match(ADMIN_HTML,/id="rating-history-entry"/);
  assert.match(ADMIN_HTML,/id="insights-category"/);
  assert.match(ADMIN_CLIENT,/params\.set\('category',category\)/);
  assert.match(ADMIN_CLIENT,/populateRatingArticleOptions/);
  assert.doesNotThrow(()=>new Function(ADMIN_CLIENT));
});
