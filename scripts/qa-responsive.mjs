// Browser-based layout smoke test for the public guide.
import { chromium } from 'playwright';
import { mkdir, writeFile, readdir } from 'node:fs/promises';
const origin = process.env.QA_BASE || 'http://127.0.0.1:4173';
const widths = [320,360,390,430,768,1024,1440];
const entryNames = (await readdir('src/content/entries'))
  .filter(name => name.endsWith('.md'))
  .map(name => name.slice(0,-3));
const routes = [
  '/', '/questions/', '/knowledge/', '/search/', '/learn/', '/feedback/',
  '/about/', '/downloads/', '/tools/', '/tools/nhi-calculator/', '/admin/feedback/',
  '/knowledge/basics/', '/knowledge/organizations/', '/knowledge/plans/',
  '/knowledge/finance/', '/knowledge/people/', '/knowledge/tools/',
  ...entryNames.map(name => '/entries/'+name+'/')
];
const browser = await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
const failures=[], warnings=[],records=[];
await mkdir('qa-screenshots',{recursive:true});
try {
  for(const width of widths) {
    const context = await browser.newContext({
      viewport:{width,height:900}, deviceScaleFactor:width<500?2:1,
      isMobile:width<500,hasTouch:width<500,reducedMotion:'reduce'
    });
    for(const route of routes) {
      const page = await context.newPage();
      try {
        const response = await page.goto(origin+route,{waitUntil:'domcontentloaded',timeout:25000});
        if(!response?.ok()) {
          failures.push(width+'px '+route+': HTTP '+response?.status());
          continue;
        }
        const data = await page.evaluate(() => {
          const viewport=window.innerWidth;
          const docWidth=document.documentElement.scrollWidth,bodyWidth=document.body.scrollWidth;
          const offenders=[...document.querySelectorAll('main *')].filter(node => {
            const rect=node.getBoundingClientRect(),style=getComputedStyle(node);
            if(style.display==='none'||style.visibility==='hidden'||rect.width<1||rect.height<1) return false;
            if(rect.right<=viewport+3&&rect.left>=-3) return false;
            for(let p=node.parentElement;p&&p!==document.body;p=p.parentElement){
              if(/auto|scroll|hidden|clip/.test(getComputedStyle(p).overflowX)) return false;
            }
            return true;
          }).slice(0,12).map(node => node.tagName.toLowerCase()+'.'+
            String(node.className||'').replace(/\s+/g,'.').slice(0,75));
          const form=document.querySelector('.hero .search-form'),art=document.querySelector('.hero .hero-art');
          const a=form?.getBoundingClientRect(),b=art?.getBoundingClientRect();
          return {viewport,docWidth,bodyWidth,offenders,heroFormBottom:a?.bottom,heroArtTop:b?.top};
        });
        records.push({route,width,...data});
        if(data.docWidth>data.viewport+3||data.bodyWidth>data.viewport+3) {
          failures.push(width+'px '+route+': horizontal overflow '+data.docWidth+'/'+data.bodyWidth+
            ' (viewport '+data.viewport+'); candidates '+data.offenders.join(', '));
        }
        if(route==='/'&&width<=430&&data.heroArtTop<data.heroFormBottom+4) {
          failures.push(width+'px homepage: artwork overlaps search controls');
        }
        if(data.offenders.length&&width<500) {
          warnings.push(width+'px '+route+': outside-box '+data.offenders.join(', '));
        }
        const shots={'/':'home','/entries/why-establish-legal-person/':'entry',
          '/feedback/':'feedback','/tools/nhi-calculator/':'calculator'};
        if(shots[route]&&[390,768,1440].includes(width)) {
          await page.screenshot({path:'qa-screenshots/'+shots[route]+'-'+width+'.png',
            fullPage:route==='/'&&width===390});
        }
      } catch(e){failures.push(width+'px '+route+': '+e.message);}
      finally {await page.close();}
    }
    await context.close();
    console.log('Checked '+width+'px on '+routes.length+' routes');
  }
} finally {await browser.close();}
await writeFile('qa-screenshots/layout-results.json',JSON.stringify({failures,warnings,records},null,2));
console.log('Total browser viewport cases: '+records.length);
console.log('Warnings: '+warnings.length);
warnings.slice(0,20).forEach(x=>console.log('WARN '+x));
if(failures.length){
  console.error('Responsive audit failed ('+failures.length+')');
  failures.forEach(x=>console.error('FAIL '+x));
  process.exitCode=1;
} else console.log('PASS: no horizontal page overflow or search/art overlap at tested sizes.');
