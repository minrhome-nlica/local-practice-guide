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
  '/about/', '/downloads/', '/tools/', '/tools/nhi-calculator/', '/tools/insurance-2026/', '/admin/feedback/',
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
        if(width===390 && route==='/about/') {
          const heads=await page.locator('.guide-about-article h2').allTextContents();
          if(heads.join('|')!=='這個網站誕生的原因|這是一份仍在編輯中的指南|關於我們')
            failures.push('About guide missing required three sections');
          if(!await page.locator('.guide-about-support').getByText('地方創生青年培力工作站').count())
            failures.push('About guide missing funding acknowledgment');
        }
        if(route==='/tools/insurance-2026/' && [390,1440].includes(width)) {
          const rangeCell=page.locator('.wage-combined-table tbody tr:first-child td:nth-child(2)');
          const note=rangeCell.locator('.wage-range-first-note');
          if(!await note.count()) failures.push('First insurance grade explanatory line is missing');
          else {
            const geometry=await rangeCell.evaluate(node=>{
              const main=node.querySelector('.wage-range-value span:first-child').getBoundingClientRect();
              const note=node.querySelector('.wage-range-first-note').getBoundingClientRect();
              return {lineBreak:note.top>=main.bottom-1,width:node.getBoundingClientRect().width};
            });
            if(!geometry.lineBreak) failures.push(width+'px salary first-grade note should occupy second line');
            if(width===1440 && geometry.width>145)
              failures.push('Salary range column is wider than neighboring grade ranges: '+geometry.width+'px');
          }
        }
        if(width===390 && route==='/tools/insurance-2026/') {
          const fullTable = page.locator('.wage-combined-table');
          const rows = fullTable.locator('tbody tr');
          if((await fullTable.count())!==1 || (await rows.count())!==58)
            failures.push('Insurance levels must appear in ONE table containing all 58 grades');
          if(await page.locator('.wage-grade-details').count())
            failures.push('Split/collapsible insurance grade tables still exist');
          const salaryRow = page.locator('.wage-combined-table tr[data-insurance-grade="34800"]');
          if(await salaryRow.count()) {
            const totals = await salaryRow.locator('.wage-total-cell').allTextContents();
            if(totals.join('|') !== '6,817|1,410')
              failures.push('Unified insurance grade 34,800 totals mismatch: '+totals.join(' / '));
          }
          if(await page.locator('.wage-combined-table tr.wage-current-row').count()!==1)
            failures.push('One current salary row should be highlighted');

          const displayed=await page.locator('#out-employee-total').innerText();
          const employer=await page.locator('#out-employer-total').innerText();
          if(displayed!=='1,410 元'||employer!=='6,817 元')
            failures.push('2026 salary calculator 34k default mismatch: '+displayed+' / '+employer);
          await page.locator('#wage-monthly').fill('45801');
          const cap=await page.locator('#out-labor-grade').innerText();
          if(cap!=='45,800 元') failures.push('Labor insurance 45,800 upper bound failed: '+cap);
          const activeAfterChange = page.locator('.wage-combined-table tbody tr.wage-current-row');
          if((await activeAfterChange.count())!==1 ||
            await activeAfterChange.first().getAttribute('data-insurance-grade')!=='48200')
            failures.push('Changing salary must highlight only the new 48,200 grade');
          const oldGrade=page.locator('.wage-combined-table tr[data-insurance-grade="34800"]');
          if(await oldGrade.evaluate(row=>row.classList.contains('wage-current-row') ||
            row.classList.contains('wage-example-row')))
            failures.push('34,800 grade retains obsolete highlight after salary change');
          if(await page.locator('.wage-combined-table .wage-example-row').count()!==0)
            failures.push('Static original 34,800 highlight must not exist');
          await page.locator('#wage-monthly').fill('34000');
          const activeAfterReset=page.locator('.wage-combined-table tbody tr.wage-current-row');
          if((await activeAfterReset.count())!==1 ||
            await activeAfterReset.first().getAttribute('data-insurance-grade')!=='34800')
            failures.push('Returning salary to 34,000 must restore only the 34,800 highlight');
          await page.locator('#wage-dependents').selectOption('1');
          const dep=await page.locator('#out-employee-health').innerText();
          if(dep!=='1,080 元')failures.push('Health dependent multiplier failed: '+dep);
          await page.locator('#wage-dependents').selectOption('0');
          await page.locator('#wage-accident-choice').selectOption('0.12');
          const occ=await page.locator('#out-employer-accident').innerText();
          if(occ!=='42 元')failures.push('Accident insurance calculation failed: '+occ);
        }
        if(width===390 && route==='/knowledge/tools/') {
          if(!await page.locator('a[href$="/tools/insurance-2026/"]').count())
            failures.push('2026 insurance calculator not listed in Tools & Skills');
          const pdf=page.locator('a[download][href$="/downloads/youth-workstation-proposal-114.pdf"]');
          const xlsx=page.locator('a[download][href$="/經費案例.xlsx"]');
          if(!(await pdf.count()) || !(await xlsx.count())) failures.push('Practical downloads missing from tools category');
          const nav=page.locator('.desktop-nav');
          if(!(await nav.getByText('關於指南',{exact:true}).count())) failures.push('About link missing from navigation');
          if(await nav.getByText('文件與範本',{exact:true}).count()) failures.push('Removed downloads navigation still present');
        }
        if(route==='/' && width===390) {
          const support = page.locator('.desktop-nav .nav-support');
          if((await support.getAttribute('href'))!=='https://mountcounty.com/shop/')
            failures.push('Support shop link missing from header');
          const bubble = page.locator('.guide-question-card-bubble').first();
          if(await bubble.count()){
            const bg=await bubble.evaluate(node=>getComputedStyle(node).backgroundColor);
            if(bg!=='rgba(0, 0, 0, 0)')failures.push('Question card still has bubble background '+bg);
          }
        }
        if(route==='/knowledge/tools/' && width===390) {
          if(await page.locator('a[href$="/tools/nhi-calculator/"]').count()===0)
            failures.push('Calculator missing from knowledge tools');
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
          const innerScrollers=[...document.querySelectorAll('.article.guide-article *')]
            .filter(node=>{
              const style=getComputedStyle(node);
              const box=node.getBoundingClientRect();
              return /auto|scroll/.test(style.overflowX) &&
                node.clientWidth>=90 && box.height>0 && node.scrollWidth>node.clientWidth+8;
            }).map(node=>({tag:node.tagName.toLowerCase(),
              className:String(node.className||'').replace(/\s+/g,'.').slice(0,90),
              width:node.clientWidth,scrollWidth:node.scrollWidth})).slice(0,12);
          const form=document.querySelector('.hero .search-form'),art=document.querySelector('.hero .hero-art');
          const a=form?.getBoundingClientRect(),b=art?.getBoundingClientRect();
          return {viewport,docWidth,bodyWidth,offenders,innerScrollers,heroFormBottom:a?.bottom,heroArtTop:b?.top};
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
        if(width<=430&&data.innerScrollers.length) {
          failures.push(width+'px '+route+': inner horizontal scrollers '+
            data.innerScrollers.map(x=>x.tag+'.'+x.className+' ('+x.width+'/'+x.scrollWidth+')').join(', '));
        }
        // Every responsive table card must preserve an explicit source-column label.
        if(width<=430) {
          const tables = await page.locator('.guide-mobile-stack > table').count();
          if(tables>0) {
            const labelled = await page.evaluate(() =>
              [...document.querySelectorAll('.guide-mobile-stack > table')].every(table =>
                [...table.querySelectorAll('tbody tr')].every(row =>
                  [...row.children].every(cell => cell.matches('td,th')
                    ? Boolean(cell.getAttribute('data-guide-label')) &&
                    Boolean(cell.querySelector(':scope > .guide-mobile-cell-value')) : true))));
            if(!labelled) failures.push(width+'px '+route+': stacked table has unlabeled data cells');
          }
        }
        if(width===390&&route.startsWith('/entries/')) {
          const stacks=page.locator('.guide-mobile-stack');
          if(await stacks.count()) {
            const closed=page.locator('.insurance-grade-details');
            if(await closed.count()) await closed.evaluate(node=>{node.open=true;});
            await stacks.first().scrollIntoViewIfNeeded({timeout:5000});
            await page.screenshot({
              path:'qa-screenshots/table-'+route.split('/')[2]+'.png',fullPage:false
            });
          }
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
