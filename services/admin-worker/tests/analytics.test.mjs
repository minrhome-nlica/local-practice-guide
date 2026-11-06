import test from 'node:test';
import assert from 'node:assert/strict';
import { queryWebAnalytics, WEB_ANALYTICS_QUERY } from '../src/analytics.js';
import worker from '../src/index.js';

const account='38bda38ac85e2040c2bd4da34fefd29b';
const site='b4d574a93baa4b5f9d7dc7fc504e19db';
const env={CLOUDFLARE_ACCOUNT_ID:account,WEB_ANALYTICS_SITE_TAG:site,
  CLOUDFLARE_ANALYTICS_TOKEN:'test-token-never-real'};
const endpoint='https://admin.guide.mountcounty.com/api/analytics';

test('analytics query scopes account + site tag and uses grouped Web Analytics RUM data',()=>{
  assert.match(WEB_ANALYTICS_QUERY,/rumPageloadEventsAdaptiveGroups/);
  assert.match(WEB_ANALYTICS_QUERY,/siteTag/); // siteTag from filter variable
  assert.match(WEB_ANALYTICS_QUERY,/requestPath/);
  assert.match(WEB_ANALYTICS_QUERY,/date_ASC/);
});
test('missing secret yields useful setup state without making any network request',async()=>{
  let called=false;
  const result=await queryWebAnalytics({...env,CLOUDFLARE_ANALYTICS_TOKEN:''},new URL(endpoint),()=>{
    called=true;throw Error('Should not send request');
  });
  assert.equal(result.status,200);
  assert.equal(result.body.configured,false);
  assert.equal(result.body.code,'setup_required');
  assert.equal(called,false);
  assert.doesNotMatch(JSON.stringify(result.body),/test-token/);
});
test('invalid period fails before any token use',async()=>{
  const result=await queryWebAnalytics(env,new URL(endpoint+'?days=365'),()=>{
    throw Error('Should not send request');
  });
  assert.equal(result.status,400);
});
test('GraphQL request includes only the selected site tag and is authenticated by secret header',async()=>{
  const captures=[];
  const responseBody={data:{viewer:{accounts:[{
    total:[{count:85,sum:{visits:34}}],
    daily:[{count:40,sum:{visits:18},dimensions:{date:'2026-11-05'}},
      {count:45,sum:{visits:16},dimensions:{date:'2026-11-06'}}],
    topPaths:[{count:60,dimensions:{requestPath:'/entries/how-to-write/'}},
      {count:25,dimensions:{requestPath:'/knowledge/'}}]
  }]}}};
  const fetcher=async (uri,options)=>{
    captures.push({uri,options});
    return {ok:true,status:200,json:async()=>responseBody};
  };
  const result=await queryWebAnalytics(env,new URL(endpoint+'?days=30'),fetcher);
  assert.equal(result.status,200);
  assert.equal(result.body.configured,true);
  assert.equal(result.body.pageviews,85);
  assert.equal(result.body.visits,34);
  assert.equal(result.body.daily.length,2);
  assert.equal(result.body.top_pages[0].path,'/entries/how-to-write/');
  assert.equal(captures.length,1);
  assert.equal(captures[0].uri,'https://api.cloudflare.com/client/v4/graphql');
  assert.equal(captures[0].options.headers.Authorization,'Bearer test-token-never-real');
  const vars=JSON.parse(captures[0].options.body).variables;
  assert.equal(vars.accountTag,account);
  assert.equal(vars.filter.siteTag,site);
  assert.ok(vars.filter.datetime_geq && vars.filter.datetime_leq);
  assert.doesNotMatch(JSON.stringify(result.body),/test-token-never-real/);
});
test('Cloudflare HTTP 200 GraphQL errors do not produce fake traffic',async()=>{
  const newEnv={...env,CLOUDFLARE_ACCOUNT_ID:'0123456789abcdef0123456789abcdef'};
  const r=await queryWebAnalytics(newEnv,new URL(endpoint+'?days=7'),async()=>({
    ok:true,status:200,json:async()=>({errors:[{message:'unauthorized'}]})
  }));
  assert.equal(r.status,502);
  assert.equal(r.body.code,'graphql');
  assert.equal(r.body.configured,false);
});
test('missing account/site IDs fail closed when token is present',async()=>{
  const r=await queryWebAnalytics({...env,CLOUDFLARE_ACCOUNT_ID:''},new URL(endpoint),async()=>{
    throw Error('Should not send request');
  });
  assert.equal(r.status,503);
  assert.equal(r.body.code,'missing_site');
});
test('analytics endpoint cannot bypass Cloudflare Access even with token configured',async()=>{
  const request=new Request(endpoint);
  const response=await worker.fetch(request,{
    DB:{},ACCESS_AUD:'test-aud',...env
  },{});
  assert.equal(response.status,403);
});
