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

  // Functional + visual regression: two different quotes inside ONE paragraph
  // must produce ONE badge, and no paragraph-wide highlighting.
  const twoNotes = [
    {id:'11111111-1111-4111-8111-111111111111',
      entry_id:'why-establish-legal-person',entry_title:'為什麼要成立法人？',
      section_id:'',quote:'假設你和朋友一起經營工作室',
      author:'示例 A',kind:'question',body:'請問這一段可以再補充工作室的案例嗎？',
      status:'approved',created_at:'2026-11-06T00:00:00.000Z',admin_reply:''},
    {id:'22222222-2222-4222-8222-222222222222',
      entry_id:'why-establish-legal-person',entry_title:'為什麼要成立法人？',
      section_id:'',quote:'最後欠下一筆付不出來的錢',
      author:'示例 B',kind:'supplement',body:'這一段如果加上財產清算的說明會更清楚。',
      status:'approved',created_at:'2026-11-06T01:00:00.000Z',admin_reply:''}
  ];
  for(const width of [390,1440]) {
    const context=await browser.newContext({viewport:{width,height:900},
      deviceScaleFactor:width===390?2:1,isMobile:width===390,hasTouch:width===390});
    const page=await context.newPage();
    try{
      await page.route('**/api/comments?*', async route => {
        const req=new URL(route.request().url());
        const isArticle=req.searchParams.get('entry')==='why-establish-legal-person';
        await route.fulfill({status:200,
          headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'},
          body:JSON.stringify({ok:true,items:isArticle?twoNotes:[],has_more:false})});
      });
      await page.goto(origin+'/entries/why-establish-legal-person/',{waitUntil:'domcontentloaded'});
      await page.locator('.guide-annotation-marker').first().waitFor({timeout:12000});
      const marks=page.locator('.guide-annotation-marker');
      const markCount=await marks.count();
      const label=await marks.first().innerText();
      if(markCount!==1||!label.includes('2 則留言')){
        failures.push(width+'px annotation grouping: got '+markCount+' markers, label '+label);
      }
      await marks.first().click();
      const dialog=page.locator('#guide-feedback-notes-dialog');
      const opened=await dialog.evaluate(node=>node.open);
      const shown=await dialog.locator('[data-feedback-paragraph-notes] .guide-feedback-note').count();
      if(!opened||shown!==2)failures.push(width+'px annotation dialog: open='+opened+', notes='+shown);
      await page.screenshot({path:'qa-screenshots/annotation-'+width+'.png',fullPage:false});
      console.log('Annotation grouping '+width+'px: '+markCount+' paragraph marker, '+shown+' notes.');
    } catch(error){
      failures.push(width+'px annotation functional test: '+error.message);
    } finally {await page.close();await context.close();}
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
