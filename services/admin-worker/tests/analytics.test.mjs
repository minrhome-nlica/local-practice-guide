import test from 'node:test';
import assert from 'node:assert/strict';
import {
  queryWebAnalytics, WEB_ANALYTICS_QUERY, WEB_ANALYTICS_DISCOVERY_QUERY
} from '../src/analytics.js';
import worker from '../src/index.js';

const account = '38bda38ac85e2040c2bd4da34fefd29b';
const beaconToken = 'b4d574a93baa4b5f9d7dc7fc504e19db';
const actualSiteTag = '11112222333344445555666677778888';
const env = {
  SITE_URL: 'https://guide.mountcounty.com',
  CLOUDFLARE_ACCOUNT_ID: account,
  WEB_ANALYTICS_SITE_TOKEN: beaconToken,
  CLOUDFLARE_ANALYTICS_TOKEN: 'test-token-never-real'
};
const endpoint = 'https://guide-admin-console.e7968.workers.dev/api/analytics';
function ok(data) { return { ok: true, status: 200, json: async () => ({data}) }; }
function discoveryRows(rows) {
  return {viewer: {accounts: [{matches: rows.map(x => ({
    count: x.count ?? 10, dimensions: {siteTag: x.tag, requestHost: x.host}
  }))}]}};
}
function metricRows({views=22,visits=11}={}) {
  return {viewer: {accounts: [{
    total: views ? [{count:views,sum:{visits}}] : [],
    daily: views ? [{count:views,sum:{visits},dimensions:{date:'2026-11-07'}}] : [],
    topPaths: views ? [{count:views,dimensions:{requestPath:'/entries/hello/'}}] : []
  }]}};
}
function makeFetcher({rows=[
  {tag:actualSiteTag,host:'guide.mountcounty.com'}
], metrics=metricRows(), status=200}={}) {
  const calls=[];
  const fetcher=async (url,opts)=>{
    calls.push({url, opts, body:JSON.parse(opts.body)});
    if(status!==200)return {ok:false,status};
    return ok(opts.body.includes('GuideRUMSiteDiscovery')?discoveryRows(rows):metrics);
  };
  return {calls,fetcher};
}
test('RUM GraphQL discovery selects siteTag from events rather than public beacon token',()=>{
  assert.match(WEB_ANALYTICS_DISCOVERY_QUERY,/dimensions \{ siteTag requestHost \}/);
  assert.match(WEB_ANALYTICS_QUERY,/rumPageloadEventsAdaptiveGroups/);
  assert.match(WEB_ANALYTICS_QUERY,/requestPath/);
  assert.match(WEB_ANALYTICS_QUERY,/date_ASC/);
});
test('without the secret, never make a network request',async()=>{
  let calls=0;
  const r=await queryWebAnalytics({...env,CLOUDFLARE_ANALYTICS_TOKEN:''},new URL(endpoint),()=>{
    calls++;throw Error('network must not be called');
  });
  assert.equal(r.status,200);
  assert.equal(r.body.configured,false);
  assert.equal(r.body.code,'setup_required');
  assert.equal(calls,0);
});
test('bad period or missing account fails closed',async()=>{
  const {fetcher,calls}=makeFetcher();
  const r=await queryWebAnalytics(env,new URL(endpoint+'?days=365'),fetcher);
  assert.equal(r.status,400);
  const noAccount=await queryWebAnalytics({...env,CLOUDFLARE_ACCOUNT_ID:''},new URL(endpoint),fetcher);
  assert.equal(noAccount.status,503);
  assert.equal(calls.length,0);
});
test('auto resolves a different GraphQL siteTag then reads matching public guide RUM',async()=>{
  const {calls,fetcher}=makeFetcher({metrics:metricRows({views:979,visits:390})});
  const r=await queryWebAnalytics(env,new URL(endpoint+'?days=30'),fetcher);
  assert.equal(r.status,200);
  assert.equal(r.body.configured,true);
  assert.equal(r.body.available,true);
  assert.equal(r.body.pageviews,979);
  assert.equal(r.body.visits,390);
  assert.equal(r.body.matched_host,'guide.mountcounty.com');
  assert.equal(calls.length,2);
  const discovery=calls[0].body;
  const metrics=calls[1].body;
  assert.match(discovery.query,/GuideRUMSiteDiscovery/);
  assert.equal(discovery.variables.filter.siteTag,undefined);
  assert.equal(metrics.variables.accountTag,account);
  assert.equal(metrics.variables.filter.siteTag,actualSiteTag);
  assert.notEqual(metrics.variables.filter.siteTag,beaconToken);
  assert.equal(calls[1].opts.headers.Authorization,'Bearer test-token-never-real');
  assert.doesNotMatch(JSON.stringify(r.body),/test-token-never-real|11112222333344445555666677778888/);
});
test('site discovery can match the legacy GitHub Pages address without requesting unrelated site stats',async()=>{
  const {calls,fetcher}=makeFetcher({
    rows:[{tag:'aaaaaaaabbbbbbbbccccccccdddddddd',host:'unrelated.org',count:500},
      {tag:actualSiteTag,host:'minrhome-nlica.github.io',count:9}]
  });
  const r=await queryWebAnalytics(env,new URL(endpoint+'?days=7'),fetcher);
  assert.equal(r.body.matched_host,'minrhome-nlica.github.io');
  assert.equal(calls[1].body.variables.filter.siteTag,actualSiteTag);
});
test('when no approved guide hostname matches, never guess another account site tag',async()=>{
  const unrelatedTag='aaaaaaaabbbbbbbbccccccccdddddddd';
  const {calls,fetcher}=makeFetcher({
    rows:[{tag:unrelatedTag,host:'unrelated.org',count:1000}]
  });
  const r=await queryWebAnalytics(env,new URL(endpoint),fetcher);
  assert.equal(r.status,200);
  assert.equal(r.body.available,false);
  assert.equal(r.body.data_state,'unresolved_site');
  assert.equal(r.body.code,'no_matching_host');
  assert.equal(calls.length,1);
  assert.doesNotMatch(JSON.stringify(r.body),/1000|unrelated.org|aaaaaaaabbbbbbbbccccccccdddddddd/);
});
test('zero RUM events do not falsely imply no people visited',async()=>{
  const {fetcher,calls}=makeFetcher({rows:[],metrics:metricRows({views:0})});
  const r=await queryWebAnalytics(env,new URL(endpoint+'?days=30'),fetcher);
  assert.equal(r.status,200);
  assert.equal(r.body.available,false);
  assert.equal(r.body.code,'no_account_events');
  assert.equal(calls.length,1);
});
test('selected site has no 7-day events: display unavailable and compare a 30-day range',async()=>{
  const {fetcher}=makeFetcher({metrics:metricRows({views:0})});
  const r=await queryWebAnalytics(env,new URL(endpoint+'?days=7'),fetcher);
  assert.equal(r.body.available,false);
  assert.equal(r.body.data_state,'no_events');
  assert.match(r.body.diagnostic,/最近 30 天/);
});
test('GraphQL 200 with errors is rejected without exposing raw details',async()=>{
  let attempts=0;
  const r=await queryWebAnalytics({...env,WEB_ANALYTICS_SITE_TAG:actualSiteTag},new URL(endpoint),async()=>{
    attempts++;
    return {ok:true,status:200,json:async()=>({errors:[{message:'secret should not appear'}]})};
  });
  assert.equal(r.status,502);
  assert.equal(r.body.code,'graphql');
  assert.equal(attempts,1);
  assert.doesNotMatch(JSON.stringify(r.body),/secret should not appear/);
});
test('manual correctly configured siteTag bypasses auto discovery',async()=>{
  const {calls,fetcher}=makeFetcher();
  const r=await queryWebAnalytics({...env,WEB_ANALYTICS_SITE_TAG:actualSiteTag},new URL(endpoint),fetcher);
  assert.equal(r.status,200);
  assert.equal(calls.length,1);
  assert.match(calls[0].body.query,/GuideWebAnalytics/);
  assert.equal(calls[0].body.variables.filter.siteTag,actualSiteTag);
});
test('analytics API is never reachable without Cloudflare Access identity',async()=>{
  const response=await worker.fetch(new Request(endpoint), {
    DB:{},ACCESS_AUD:'test-aud',...env
  }, {});
  assert.equal(response.status,403);
});
