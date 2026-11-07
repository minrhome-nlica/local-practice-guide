#!/usr/bin/env node
/**
 * SEO guardrails for the built public guide.
 * Run after GUIDE_CUSTOM_DOMAIN=true npm run build.
 */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, dirname } from 'node:path';

const DIST='dist';
const ORIGIN='https://guide.mountcounty.com';
const allHtml=[];
async function walk(dir) {
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const file=join(dir,entry.name);
    if(entry.isDirectory()) await walk(file);
    else if(entry.name==='index.html') allHtml.push(file);
  }
}
await walk(DIST);

function routeFor(file) {
  const d=relative(DIST,dirname(file)).replaceAll('\\','/');
  return d ? '/'+d+'/' : '/';
}
function getMeta(html,name,attr='name') {
  const tags=[...html.matchAll(/<meta\b[^>]+>/gi)].map(x=>x[0]);
  const tag=tags.find(x=>new RegExp('\\b'+attr+'="'+name+'"','i').test(x));
  return tag?.match(/\bcontent="([^"]*)"/i)?.[1]||'';
}
function readJsonLD(html) {
  const script=/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i.exec(html);
  assert.ok(script,'indexable page lacks server-rendered JSON-LD');
  const parsed=JSON.parse(script[1]);
  assert.equal(parsed['@context'],'https://schema.org');
  assert.ok(Array.isArray(parsed['@graph']));
  return parsed['@graph'];
}
const indexable=[];
const titles=new Map();
for(const file of allHtml) {
  const route=routeFor(file);
  const html=await readFile(file,'utf8');
  const noindex=/\bnoindex\b/i.test(getMeta(html,'robots'));
  const canonical=html.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/i)?.[1];
  assert.ok(canonical,route+' is missing canonical');
  assert.equal(canonical,ORIGIN+route,'noncanonical hostname or path at '+route);
  const title=html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  assert.ok(title,route+' is missing document title');
  const description=getMeta(html,'description');
  assert.ok(description && description.length>=18,route+' has a missing or overly short description');
  if(noindex)continue;
  assert.ok(!titles.has(title),'duplicate title "'+title+'" on '+titles.get(title)+' and '+route);
  titles.set(title,route);
  indexable.push(route);
  assert.equal(getMeta(html,'og:url','property'),canonical,route+' og:url mismatch');
  assert.equal(getMeta(html,'og:description','property'),description,route+' og:description mismatch');
  const graph=readJsonLD(html);
  const webpage=graph.find(x=>x['@type']==='WebPage');
  assert.ok(webpage,route+' missing WebPage schema');
  assert.equal(webpage.url,canonical,route+' structured WebPage URL mismatch');
  if(route==='/'){
    const website=graph.find(x=>x['@type']==='WebSite');
    const org=graph.find(x=>x['@type']==='Organization');
    assert.ok(website && org,'homepage must identify website and publisher');
    assert.equal(website.url,ORIGIN+'/');
    assert.equal(website.name,'地方實踐指南');
  }
  if(/^\/entries\/[a-z0-9-]+\/$/.test(route)){
    const article=graph.find(x=>x['@type']==='Article');
    const crumbs=graph.find(x=>x['@type']==='BreadcrumbList');
    assert.ok(article,route+' missing Article schema');
    assert.ok(crumbs && crumbs.itemListElement?.length===4,route+' missing article breadcrumbs');
    assert.equal(crumbs.itemListElement[3].item,canonical);
    assert.equal(article.mainEntityOfPage?.['@id'],canonical+'#webpage');
    assert.match(article.dateModified||'',/^\d{4}-\d{2}-\d{2}$/);
    const id=route.split('/')[2];
    const src=await readFile('src/content/entries/'+id+'.md','utf8');
    const front=/^---\r?\n([\s\S]*?)\r?\n---/.exec(src)?.[1]||'';
    const actual=/^updated:\s*(\d{4}-\d{2}-\d{2})/m.exec(front)?.[1]||'';
    assert.equal(article.dateModified,actual,route+' dateModified should match editorial frontmatter');
    const onpageHeadline=html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]*>/g,'').trim();
    assert.equal(article.headline,onpageHeadline,route+' Article headline should match visible H1');
  }
  if(/^\/knowledge\/[^/]+\/$/.test(route)){
    const crumbs=graph.find(x=>x['@type']==='BreadcrumbList');
    assert.ok(crumbs && crumbs.itemListElement?.length===3,route+' category breadcrumbs missing');
  }
}

assert.ok(indexable.length>=32,'unexpectedly few indexable pages: '+indexable.length);
const xml=await readFile(join(DIST,'sitemap.xml'),'utf8');
const urlElements=[...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(x=>x[1]);
const listed=new Set();
let dated=0;
for(const part of urlElements) {
  const loc=part.match(/<loc>([^<]+)<\/loc>/)?.[1];
  assert.ok(loc && loc.startsWith(ORIGIN+'/'),'sitemap includes URL outside canonical site');
  const path=new URL(loc).pathname;
  assert.ok(!listed.has(path),'sitemap has duplicate '+path);
  listed.add(path);
  assert.ok(indexable.includes(path),'sitemap lists a noindex/unknown route: '+path);
  const lastmod=part.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1];
  if(/^\/entries\//.test(path)){
    assert.match(lastmod||'',/^\d{4}-\d{2}-\d{2}$/,path+' lacks editorial lastmod');
    const md=await readFile('src/content/entries/'+path.split('/')[2]+'.md','utf8');
    const front=/^---\r?\n([\s\S]*?)\r?\n---/.exec(md)?.[1]||'';
    const date=/^updated:\s*(\d{4}-\d{2}-\d{2})/m.exec(front)?.[1];
    assert.equal(lastmod,date,'sitemap lastmod must match article editorial date');
    dated++;
  }
}
assert.deepEqual([...listed].sort(),[...indexable].sort(),'sitemap does not exactly match indexable pages');
assert.ok(dated>=20,'article lastmod coverage unexpectedly low');
for(const redirect of ['/admin/feedback/','/search/','/downloads/','/tools/']){
  assert.ok(!listed.has(redirect),redirect+' must not be submitted for indexing');
}
const searchHtml=await readFile(join(DIST,'search/index.html'),'utf8');
assert.match(getMeta(searchHtml,'robots'),/noindex,follow/i,'search results should be noindex but link-followable');
const robots=await readFile(join(DIST,'robots.txt'),'utf8');
assert.match(robots,/Disallow: \/admin\//);
assert.doesNotMatch(robots,/Disallow: \/search\//);
assert.ok(robots.includes('Sitemap: '+ORIGIN+'/sitemap.xml'));
const verification=join(DIST,'google57e0f55c88e17390.html');
assert.equal((await readFile(verification,'utf8')).trim(),
  'google-site-verification: google57e0f55c88e17390.html');
console.log('SEO PASS:',indexable.length,'indexable pages,',listed.size,
  'canonical sitemap URLs,',dated,'true article update dates, unique titles and JSON-LD.');
