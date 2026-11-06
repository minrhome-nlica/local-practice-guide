// Validates article-to-article relationships and referenced tools before publication.
// Uses no external dependencies. Run with: node scripts/check-entry-links.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const directory='src/content/entries';
const ids = readdirSync(directory).filter(name=>name.endsWith('.md')).map(name=>name.slice(0,-3));
const existing=new Set(ids);
const tools=new Set(readdirSync('src/pages/tools').filter(name=>name.endsWith('.astro')).map(name=>name.slice(0,-6)));
const routes=new Set(readdirSync('src/pages/knowledge').filter(name=>name.endsWith('.astro')).map(name=>name.slice(0,-6)));
const failures=[], report=[];
let totalRelated=0, totalInText=0;
for(const id of ids) {
  const contents=readFileSync(join(directory,id+'.md'),'utf8');
  const front=contents.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if(!front){failures.push(id+': missing YAML front matter');continue;}
  const rel=front[1].match(/^related:\s*\n((?:[ \t]*-[ \t]*[a-z0-9-]+[ \t]*\n)*)/m);
  const related=rel ? rel[1].split('\n').map(s=>s.replace(/^\s*-[ \t]*/,'').trim()).filter(Boolean):[];
  const seen=new Set();
  for(const target of related){
    totalRelated++;
    if(!existing.has(target))failures.push(id+': related article not found: '+target);
    if(target===id)failures.push(id+': related article points to itself');
    if(seen.has(target))failures.push(id+': duplicate related article: '+target);
    seen.add(target);
  }
  const links=[...contents.matchAll(/(?:\]\(|href=["'])(?:\/local-practice-guide\/|\/)(entries|tools)\/([a-z0-9-]+)\/(?:[#?][^\s"')]+)?/g)];
  for(const match of links){
    totalInText++;
    const [,kind,target]=match;
    if(kind==='entries'&&!existing.has(target))failures.push(id+': broken in-text entry link: '+target);
    if(kind==='tools'&&!tools.has(target))failures.push(id+': broken in-text tool link: '+target);
  }
  report.push({id,related:related.length,links:links.length});
}
for(const id of ['insurance-2026','nhi-calculator']) {
  if(!tools.has(id))failures.push('Required calculator missing: '+id);
}
const category=readFileSync('src/pages/knowledge/[category].astro','utf8');
const index=readFileSync('src/pages/knowledge/index.astro','utf8');
const entry=readFileSync('src/pages/entries/[slug].astro','utf8');
for(const page of [category,index]){
  for(const target of ['insurance-2026','nhi-calculator']){
    if(!page.includes('/tools/'+target+'/'))failures.push('Knowledge page missing tool card: '+target);
  }
}
for(const id of ['labor-health-insurance','supplemental-premium','budget-planning']){
  if(!entry.includes("'"+id+"'"))failures.push('Related tool routing missing '+id);
}
console.log('Checked '+ids.length+' entries; '+totalRelated+' related links; '+totalInText+' in-text links.');
if(failures.length){
  for(const failure of failures)console.error('ERROR '+failure);
  process.exitCode=1;
}else{
  console.log('PASS: all related articles, tool destinations, and in-text links exist.');
}
