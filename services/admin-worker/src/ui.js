// Static assets served by the Access-protected Worker (no public storage, no embedded secrets).
export const ADMIN_HTML = String.raw`<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>地方實踐指南｜管理後台</title>
  <link rel="stylesheet" href="/app.css">
  <script src="/app.js" defer></script>
</head>
<body>
  <a class="skip" href="#main">跳到主要內容</a>
  <div class="shell">
    <aside class="sidebar" aria-label="管理選單">
      <a class="brand" href="/"><small>MOUNT COUNTY / ADMIN</small><strong>地方實踐指南</strong><span>網站管理中心</span></a>
      <p class="nav-title">管理功能</p>
      <nav id="navigation" aria-label="後台功能">
        <button type="button" class="nav-item current" data-tab="overview">總覽儀表板</button>
        <button type="button" class="nav-item" data-tab="comments" data-role="owner moderator">讀者留言管理</button>
        <button type="button" class="nav-item" data-tab="ratings">文章回饋分析</button>
        <button type="button" class="nav-item" data-tab="articles" data-role="owner editor">文章與草稿 <span class="future">下一階段</span></button>
        <button type="button" class="nav-item" data-tab="analytics">Web Analytics <span class="future">待串接</span></button>
        <button type="button" class="nav-item" data-tab="updates">更新紀錄 <span class="future">下一階段</span></button>
        <button type="button" class="nav-item" data-tab="team" data-role="owner">工作人員與權限</button>
        <button type="button" class="nav-item" data-tab="audit" data-role="owner">操作紀錄</button>
      </nav>
      <div class="sidebar-foot"><a id="open-site" href="https://guide.mountcounty.com/" target="_blank" rel="noopener noreferrer">開啟公開網站 ↗</a><a href="/cdn-cgi/access/logout">登出管理後台</a></div>
    </aside>
    <main id="main" tabindex="-1">
      <header class="topbar"><div><span class="eyebrow">STAFF DASHBOARD</span><h1 id="page-title">總覽儀表板</h1><p id="page-subtitle">管理讀者互動與維護網站內容。</p></div><div class="profile"><span id="role-label">身分驗證中</span><strong id="signed-in-user">—</strong></div></header>
      <p id="notice" class="notice" role="status" aria-live="polite" hidden></p>
      <section class="panel" data-panel="overview">
        <p class="section-title">目前的網站狀況</p>
        <div class="stats" id="summary"><div class="stat"><small>讀取中</small><b>—</b></div></div>
        <div class="card"><h2>工作待辦</h2><div id="dashboard-tasks">正在整理待辦事項…</div></div>
        <p class="hint">目前的統計來自現有 Cloudflare D1 留言與文章回饋資料；不是網站訪客數。Web Analytics 將另行串接。</p>
      </section>
      <section class="panel" data-panel="comments" hidden>
        <div class="section-head"><div><h2>讀者留言</h2><p>審核、回覆及搜尋各篇文章的讀者留言。</p></div><button id="refresh-comments" type="button">重新整理</button></div>
        <div class="filters"><label>狀態<select id="comment-status"><option value="pending">待審核</option><option value="approved">已公開</option><option value="resolved">已處理</option><option value="rejected">已拒絕</option></select></label><label>搜尋文章、姓名、留言<input id="comment-search" type="search" maxlength="70" placeholder="輸入關鍵字"></label><button id="search-comments" class="primary" type="button">搜尋</button></div>
        <p id="comment-count" class="hint"></p><div id="comment-list" class="stack"></div>
        <div class="pagination"><button id="prev-comments" type="button">上一頁</button><span id="page-label">第 1 頁</span><button id="next-comments" type="button">下一頁</button></div>
      </section>
      <section class="panel" data-panel="ratings" hidden>
        <div class="section-head"><div><h2>文章回饋分析</h2><p>各篇文章的「有幫助／還沒解決」與未解決原因。</p></div><label>統計期間<select id="rating-period"><option value="30">最近30天有更新的回饋</option><option value="all">全部時間</option></select></label></div>
        <p class="hint">同一瀏覽器在同一文章保留最新評分。「近30天」依最後更新日期篩選，並非每日訪客趨勢；小樣本請謹慎判讀。</p>
        <div class="stats" id="rating-summary"></div><div id="rating-list" class="stack"></div>
      </section>
      <section class="panel" data-panel="articles" hidden>
        <div class="card"><span class="eyebrow">CONTENT WORKFLOW</span><h2>文章草稿與審核</h2><p>下一階段將與 GitHub 中的 Markdown 詞條連接。編輯人員只能儲存草稿；最高管理員核對預覽與版本差異後才能發布。</p><p class="hint">此階段尚未開放文章寫入、審核與發布，避免未完成的編輯器改動既有文章。現階段請繼續使用既有 Pages CMS／GitHub 工作流程。</p></div>
      </section>
      <section class="panel" data-panel="analytics" hidden>
        <div class="card"><span class="eyebrow">ANALYTICS</span><h2>Cloudflare Web Analytics</h2><p>網站已有 Cloudflare Web Analytics 追蹤。後續在此呈現瀏覽量、熱門文章與流量趨勢，所需的唯讀 API 權杖只會放在後端。</p><p class="hint">目前尚未接入 Web Analytics API，因此這裡不顯示估算或假數據。</p><a href="https://dash.cloudflare.com/" rel="noopener noreferrer" target="_blank">前往 Cloudflare 控制台查看目前統計 ↗</a></div>
      </section>
      <section class="panel" data-panel="updates" hidden>
        <div class="card"><span class="eyebrow">CHANGELOG</span><h2>大型更新紀錄</h2><p>下一階段將整理 GitHub 變更，區分文章新增、功能新增、重要修正與一般編修。自動生成草稿後，仍需由管理員確認公開。</p><p class="hint">目前不會將程式碼提交紀錄直接當成讀者可見的更新公告。</p></div>
      </section>
      <section class="panel" data-panel="team" hidden>
        <div class="section-head"><div><h2>管理工作人員</h2><p>只有最高管理員能邀請、停用與調整權限。</p></div></div>
        <div class="card"><h3>新增工作人員</h3><div class="filters"><label>Email<input id="new-email" type="email" maxlength="254" placeholder="colleague@example.com"></label><label>顯示名稱<input id="new-name" type="text" maxlength="80" placeholder="工作人員"></label><label>權限<select id="new-role"><option value="editor">編輯人員</option><option value="moderator">留言管理員</option><option value="owner">最高管理員</option></select></label><button type="button" class="primary" id="create-user">新增至白名單</button></div><p class="hint">新增名單不會寄送邀請信。請同時將此 Email 加入 Cloudflare Access 允許登入名單。</p></div>
        <div id="user-list" class="stack"></div>
      </section>
      <section class="panel" data-panel="audit" hidden>
        <div class="section-head"><div><h2>管理操作紀錄</h2><p>最近60筆審核與人員權限異動。</p></div><button id="refresh-audit" type="button">重新整理</button></div><div id="audit-list" class="stack"></div>
      </section>
    </main>
  </div>
</body>
</html>`;

export const ADMIN_CSS = String.raw`
:root{font-family:system-ui,-apple-system,"Noto Sans TC","Microsoft JhengHei",sans-serif;color:#27332e;background:#f8f9f5;font-synthesis:none}
*{box-sizing:border-box}body{margin:0;font-size:15px;line-height:1.7}button,input,select,textarea{font:inherit}button{cursor:pointer}
a{color:#285a48}a:hover{text-decoration:none}:focus-visible{outline:3px solid #ad8e52;outline-offset:3px}.skip{position:absolute;left:-1000px;top:0;z-index:100;background:white;padding:12px}.skip:focus{left:10px}
.shell{min-height:100vh;display:grid;grid-template-columns:248px minmax(0,1fr)}.sidebar{position:sticky;top:0;height:100vh;background:#183c33;color:#e8f2eb;padding:28px 18px;display:flex;flex-direction:column}
.brand{padding:8px 12px 26px;color:inherit;text-decoration:none;display:flex;flex-direction:column}.brand small{letter-spacing:.16em;font-size:10px;color:#b9d1c3}.brand strong{font-size:22px;letter-spacing:.02em}.brand span{font-size:12px;color:#c3d6ca}
.nav-title{font-size:11px;color:#b9d1c3;letter-spacing:.15em;margin:0 12px 13px}.nav-item{border:0;text-align:left;display:block;width:100%;background:transparent;color:#dfebe2;border-radius:10px;padding:12px;margin-bottom:3px;line-height:1.4}.nav-item:hover,.nav-item.current{background:#2f5a48;color:white}.nav-item.current{font-weight:700}.future{display:block;font-size:10px;font-weight:400;opacity:.7}
.sidebar-foot{margin-top:auto;border-top:1px solid #49685b;padding:20px 12px 0;display:flex;flex-direction:column;gap:9px}.sidebar-foot a{color:#f3f6f1;font-size:13px}
main{width:100%;max-width:1260px;margin:0 auto;padding:42px clamp(16px,4vw,58px)}.topbar{display:flex;justify-content:space-between;gap:20px;align-items:start;margin-bottom:36px}.eyebrow{font-size:11px;font-weight:700;letter-spacing:.18em;color:#739083}.topbar h1{font-size:clamp(26px,3vw,36px);line-height:1.3;margin:7px 0}.topbar p{margin:0;color:#68796f}.profile{text-align:right;display:flex;flex-direction:column;font-size:12px;color:#76847a;overflow-wrap:anywhere}.profile strong{font-size:13px;color:#344b3e}
.section-title{font-weight:700;margin:0 0 15px}.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:20px}.stat,.card,.item{background:#fff;border:1px solid #e5e9e0;border-radius:14px;padding:20px;box-shadow:0 2px 10px #183c3307}.stat small{font-size:12px;color:#697c70;display:block}.stat b{display:block;font-size:28px;line-height:1.5;color:#214b3a;font-variant-numeric:tabular-nums}.stat span{font-size:12px;color:#6b7a71}.card{margin:14px 0 22px}.card h2,.section-head h2{font-size:20px;margin:0 0 8px}.card h3{margin:0 0 14px}.card p{margin:8px 0}.hint{font-size:12px;color:#6c7c73}.notice{padding:12px 15px;background:#e7eee9;border:1px solid #a7bdad;border-radius:9px;margin-bottom:20px}.notice.error{background:#fff0ea;border-color:#e8b5a9;color:#843d28}
.section-head{display:flex;justify-content:space-between;align-items:start;gap:18px;margin-bottom:20px}.section-head p{margin:0;color:#6c7c73;font-size:14px}.filters{display:flex;flex-wrap:wrap;gap:12px;align-items:end;margin:12px 0 24px}.filters label,.section-head label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#556b5c;min-width:160px;flex:1}
.filters input,.filters select,.section-head select,textarea,.user-select{border:1px solid #ced8ce;border-radius:9px;min-height:40px;background:white;color:#21382d;padding:8px 10px;width:100%;max-width:100%;font-size:14px}
textarea{min-height:95px;resize:vertical;line-height:1.6}.filters input[type=search]{min-width:170px}
button:not(.nav-item){border:1px solid #c3d2c5;border-radius:9px;min-height:40px;background:#fff;color:#234c38;padding:8px 16px;font-weight:600}button:hover:not(:disabled):not(.nav-item){background:#eff5ef}button:disabled{opacity:.5;cursor:not-allowed}button.primary{background:#285744;color:white;border-color:#285744}button.primary:hover:not(:disabled){background:#1d3d30;color:#fff}button.danger{border-color:#d8acac;color:#9b3434}
.stack{display:flex;flex-direction:column;gap:12px;margin-top:16px}.item h3{font-size:17px;margin:0 0 5px;overflow-wrap:anywhere}.item h3 a{color:#234b38}.item .meta{font-size:12px;color:#6b7d70}.item p{white-space:pre-wrap;overflow-wrap:anywhere;margin:10px 0}.quote{background:#f5f7f2;border-left:3px solid #b1c5b8;padding:8px 12px;color:#5c705f}.item label{font-size:13px;display:block;font-weight:700;margin:14px 0 5px}.item .actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.item .tag{display:inline-block;border-radius:20px;background:#e9f0e9;padding:1px 9px;font-size:11px;margin-right:5px}.item .tags{margin:8px 0}
.pagination{display:flex;align-items:center;justify-content:center;gap:14px;margin:23px 0}.pagination span{font-size:13px;color:#6c7c73}.empty{padding:28px;background:white;border:1px dashed #ced8ce;border-radius:10px;color:#6d7d70}.user-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.user-main{flex:2;min-width:170px;overflow-wrap:anywhere}.user-row .user-select{width:auto;flex:1;min-width:130px}.rating-bar{height:8px;background:#eef1e8;border-radius:12px;overflow:hidden;margin-top:12px}.rating-bar>span{display:block;height:100%;background:#4f8667}.rating-reasons{font-size:12px;color:#6b7d70}.audit-row{font-size:13px;overflow-wrap:anywhere}
[hidden]{display:none!important}@media(max-width:940px){.shell{grid-template-columns:1fr}.sidebar{position:static;height:auto;padding:14px 14px 8px}.brand{padding:6px}.brand strong{font-size:18px}.nav-title{display:none}.sidebar nav{display:flex;gap:6px;overflow-x:auto;padding:6px 0}.nav-item{width:auto;white-space:nowrap;flex:none;font-size:13px;padding:8px 12px}.future{display:none}.sidebar-foot{flex-direction:row;flex-wrap:wrap;justify-content:space-between;padding:9px 6px 0}main{padding:20px 14px 48px}.topbar{margin:8px 0 24px}.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.stat,.card,.item{padding:16px}}@media(max-width:480px){.stats{gap:8px}.stat b{font-size:22px}.topbar{flex-direction:column;gap:10px}.profile{text-align:left}.filters>*{flex:1 1 100%;width:100%}.section-head{flex-direction:column}.section-head button{width:100%}.user-row .user-select{flex:1}.pagination{gap:8px}}
`;

export const ADMIN_CLIENT = String.raw`
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const labels = { owner:'最高管理員',editor:'文章編輯',moderator:'留言管理員',
    pending:'待審核',approved:'已公開',resolved:'已處理',rejected:'已拒絕',
    question:'提問',correction:'勘誤',supplement:'補充',
    missing_answer:'找不到答案',unclear:'說明不清楚',needs_examples:'希望增加案例',
    possibly_outdated:'資訊可能過時',layout_issue:'排版與操作',other:'其他' };
  const state = { user:null,site:'https://guide.mountcounty.com', tab:'overview',
    commentOffset:0,commentMore:false,loading:false };
  const n = (tag, cls='', value) => {
    const node=document.createElement(tag);
    if(cls) node.className=cls;
    if(value!==undefined && value!==null) node.textContent=String(value);
    return node;
  };
  const fmt = v => (Number(v)||0).toLocaleString('zh-TW');
  const time = v => {
    const d=new Date(v);
    return Number.isNaN(d.getTime()) ? String(v||'') : d.toLocaleString('zh-TW',{timeZone:'Asia/Taipei'});
  };
  const message = (text, isError=false) => {
    const box=$('#notice');
    box.textContent=text;box.classList.toggle('error',isError);box.hidden=!text;
  };
  async function api(path, options={}) {
    const response=await fetch(path,{
      ...options,
      headers:{'X-Requested-With':'XMLHttpRequest',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})},
      credentials:'same-origin',cache:'no-store',redirect:'follow'
    });
    if(response.redirected && response.url.includes('/cdn-cgi/access/login')) {
      throw new Error('登入已過期，請重新整理網頁登入。');
    }
    const type=response.headers.get('content-type')||'';
    if(!type.includes('application/json')) throw new Error('登入可能已過期，請重新整理並登入。');
    const body=await response.json();
    if(!response.ok || !body.ok) throw new Error(body.error||('HTTP '+response.status));
    return body;
  }
  async function guarded(task){
    if(state.loading) return;
    state.loading=true;
    try{await task();message('');}catch(e){message(e.message||'操作失敗，請重試。',true);}
    finally{state.loading=false;}
  }
  function permitted(tab){
    if(['team','audit'].includes(tab)) return state.user.role==='owner';
    if(tab==='comments')return ['owner','moderator'].includes(state.user.role);
    if(tab==='articles')return ['owner','editor'].includes(state.user.role);
    return true;
  }
  const tabTitles={overview:'總覽儀表板',comments:'讀者留言管理',ratings:'文章回饋分析',
    articles:'文章與草稿',analytics:'Web Analytics',updates:'更新紀錄',team:'工作人員與權限',audit:'操作紀錄'};
  async function show(tab){
    if(!state.user||!permitted(tab))return;
    state.tab=tab;
    $$('[data-panel]').forEach(el=>{el.hidden=el.dataset.panel!==tab;});
    $$('.nav-item').forEach(el=>el.classList.toggle('current',el.dataset.tab===tab));
    $('#page-title').textContent=tabTitles[tab]||'管理後台';
    $('#page-subtitle').textContent=tab==='overview'?'掌握重要待辦與網站內容管理情形。':'地方實踐指南內部管理介面';
    message('');
    if(tab==='overview')await guarded(loadOverview);
    if(tab==='comments')await guarded(loadComments);
    if(tab==='ratings')await guarded(loadRatings);
    if(tab==='team')await guarded(loadUsers);
    if(tab==='audit')await guarded(loadAudit);
  }
  function stat(label,value,subtitle=''){
    const el=n('div','stat');
    el.append(n('small','',label),n('b','',value));
    if(subtitle) el.append(n('span','',subtitle));
    return el;
  }
  async function loadOverview(){
    const data=await api('/api/overview');
    const c=data.comments||{}, r=data.ratings||{};
    $('#summary').replaceChildren(
      stat('待審核留言',fmt(c.pending),'待處理'),
      stat('已公開留言',fmt(c.approved),'公開中'),
      stat('文章回饋數',fmt(r.total),'全部時間'),
      stat('還沒解決',fmt(r.unresolved),'需要檢視文章')
    );
    const tasks=$('#dashboard-tasks');tasks.replaceChildren();
    const intro=n('p','',Number(c.pending)?'有 '+fmt(c.pending)+' 則讀者留言待審核。':'目前沒有待審核留言。');
    tasks.append(intro);
    const hint=n('p','hint','下一階段將加入文章草稿審核、內容查核日期與 Web Analytics。');
    tasks.append(hint);
    if(Number(c.pending)>0 && permitted('comments')){
      const btn=n('button','primary','查看待審核留言');
      btn.type='button';btn.addEventListener('click',()=>show('comments'));
      tasks.append(btn);
    }
  }
  function entryHref(row){
    const slug=String(row.entry_id||'');
    if(slug==='site-feedback')return state.site+'/feedback/';
    if(!/^[a-z0-9][a-z0-9-]{1,90}$/.test(slug))return state.site+'/knowledge/';
    return state.site+'/entries/'+encodeURIComponent(slug)+'/';
  }
  function makeButton(label,fn,cls=''){
    const btn=n('button',cls,label);btn.type='button';btn.addEventListener('click',fn);return btn;
  }
  async function loadComments(){
    const status=$('#comment-status').value;
    const query=new URLSearchParams({status,search:$('#comment-search').value.trim(),
      offset:String(state.commentOffset),limit:'25'});
    const data=await api('/api/comments?'+query.toString());
    const list=$('#comment-list');list.replaceChildren();
    $('#comment-count').textContent='這頁有 '+fmt(data.items.length)+' 則（每頁最多25則）';
    state.commentMore=!!data.has_more;
    $('#prev-comments').disabled=state.commentOffset===0;
    $('#next-comments').disabled=!state.commentMore;
    $('#page-label').textContent='第 '+(1+Math.floor(state.commentOffset/25))+' 頁';
    if(!data.items.length){list.append(n('div','empty','此條件下沒有留言。'));return;}
    for(const row of data.items)list.append(commentCard(row));
  }
  function commentCard(row){
    const card=n('article','item');
    const head=n('h3');
    const link=n('a','',row.entry_title||row.entry_id);
    link.href=entryHref(row);link.target='_blank';link.rel='noopener noreferrer';
    head.append(link);card.append(head);
    card.append(n('div','meta',(row.author||'讀者')+' · '+time(row.created_at)));
    const tags=n('div','tags');tags.append(n('span','tag',labels[row.kind]||row.kind),n('span','tag',labels[row.status]||row.status));card.append(tags);
    if(row.quote)card.append(n('p','quote','選取原文：'+row.quote));
    card.append(n('p','',row.body));
    const label=n('label','','回覆內容（公開留言可見）');
    const reply=n('textarea');reply.value=row.admin_reply||'';reply.maxLength=1800;
    reply.id='reply-'+row.id;label.htmlFor=reply.id;card.append(label,reply);
    const actions=n('div','actions');
    async function save(status){
      if(state.loading)return;
      if(status==='rejected'&&!confirm('要拒絕這則留言嗎？'))return;
      if((status==='approved'||status==='resolved')&&row.status==='pending'&&!confirm('審核通過後這則留言將公開，確定嗎？'))return;
      await guarded(async()=>{
        await api('/api/comments/'+encodeURIComponent(row.id),{
          method:'POST',body:JSON.stringify({
            status,admin_reply:reply.value.trim(),expected_updated_at:row.updated_at
          })
        });
        await loadComments();
      });
    }
    if(row.status==='pending'||row.status==='rejected')actions.append(makeButton('通過並公開',()=>save('approved'),'primary'));
    if(row.status==='approved')actions.append(makeButton('標記已處理',()=>save('resolved')));
    if(row.status==='resolved')actions.append(makeButton('恢復已公開',()=>save('approved')));
    if(row.status!=='pending')actions.append(makeButton('退回待審',()=>save('pending')));
    if(row.status!=='rejected')actions.append(makeButton('拒絕留言',()=>save('rejected'),'danger'));
    actions.append(makeButton('只儲存回覆',()=>save(row.status)));
    card.append(actions);
    return card;
  }
  async function loadRatings(){
    const period=$('#rating-period').value;
    const data=await api('/api/ratings?period='+period);
    const list=$('#rating-list'),summary=$('#rating-summary');list.replaceChildren();summary.replaceChildren();
    const total=(data.items||[]).reduce((s,r)=>s+Number(r.total||0),0);
    const helpful=(data.items||[]).reduce((s,r)=>s+Number(r.helpful||0),0);
    const unresolved=total-helpful;
    summary.append(stat('文章回饋',fmt(total)),stat('有幫助',fmt(helpful)),
      stat('還沒解決',fmt(unresolved)),stat('收到回饋的文章',fmt(data.items.length)));
    if(!data.items.length){list.append(n('div','empty','這個期間尚無文章回饋。'));return;}
    for(const row of data.items){
      const card=n('article','item');
      const head=n('h3'),link=n('a','',row.entry_title||row.entry_id);link.href=entryHref(row);
      link.target='_blank';link.rel='noopener noreferrer';head.append(link);card.append(head);
      const total=Number(row.total)||0, good=Number(row.helpful)||0;
      const percent=total?Math.round(100*good/total):0;
      card.append(n('p','meta','有幫助 '+fmt(good)+' · 還沒解決 '+fmt(row.unresolved)+' · 合計 '+fmt(total)+' · '+percent+'% 有幫助'));
      const bar=n('div','rating-bar'),fill=n('span');fill.style.width=percent+'%';bar.append(fill);card.append(bar);
      const reasons=Object.entries(row.reasons||{}).filter(([,v])=>Number(v)>0)
        .sort((a,b)=>Number(b[1])-Number(a[1])).map(([k,v])=>(labels[k]||k)+' '+fmt(v));
      if(reasons.length)card.append(n('p','rating-reasons','主要原因：'+reasons.join('、')));
      if(total<10)card.append(n('p','hint','回饋不足10筆，比例僅供參考。'));
      list.append(card);
    }
  }
  async function loadUsers(){
    const data=await api('/api/users');
    const list=$('#user-list');list.replaceChildren();
    for(const row of data.users){
      const card=n('article','item'),content=n('div','user-row');
      const main=n('div','user-main');
      main.append(n('strong','',row.display_name||row.email),
        n('div','meta',row.email+(row.active?' · 已啟用':' · 已停用')));
      content.append(main);
      const role=n('select','user-select');
      for(const key of ['owner','editor','moderator']){
        const option=n('option','',labels[key]);option.value=key;option.selected=key===row.role;role.append(option);
      }
      const active=n('select','user-select');
      for(const [val,label] of [['1','啟用'],['0','停用']]){
        const option=n('option','',label);option.value=val;option.selected=String(Number(row.active))===val;active.append(option);
      }
      if(state.user.email.toLowerCase()===String(row.email).toLowerCase()){
        role.disabled=true;active.disabled=true;
      }
      content.append(role,active,makeButton('儲存權限',()=>guarded(async()=>{
        if(!confirm('確定更新 '+row.email+' 的管理權限？'))return;
        await api('/api/users/'+encodeURIComponent(row.email),{
          method:'POST',body:JSON.stringify({role:role.value,active:active.value==='1'})
        });
        await loadUsers();
      }),'primary'));
      if(state.user.email.toLowerCase()===String(row.email).toLowerCase())content.lastChild.disabled=true;
      card.append(content);list.append(card);
    }
  }
  async function loadAudit(){
    const data=await api('/api/audit'),list=$('#audit-list');list.replaceChildren();
    if(!data.items.length){list.append(n('div','empty','尚無操作紀錄。'));return;}
    for(const row of data.items){
      const card=n('article','item audit-row');
      card.append(n('strong','',row.actor_email+' · '+row.action+' · '+row.entity));
      card.append(n('div','meta',time(row.created_at)));
      card.append(n('p','',row.details||row.entity_id));list.append(card);
    }
  }
  async function init(){
    try{
      const data=await api('/api/me');
      state.user=data.user;
      if(typeof data.site_url==='string'&&/^https:\/\/[a-z0-9.-]+\/?$/i.test(data.site_url)){
        state.site=data.site_url.replace(/\/$/,'');
        $('#open-site').href=state.site+'/';
      }
      $('#signed-in-user').textContent=state.user.display_name||state.user.email;
      $('#role-label').textContent=labels[state.user.role]||'管理員';
      $$('.nav-item').forEach(btn=>{
        if(!permitted(btn.dataset.tab))btn.hidden=true;
        btn.addEventListener('click',()=>show(btn.dataset.tab));
      });
      $('#comment-status').addEventListener('change',()=>{state.commentOffset=0;show('comments');});
      $('#comment-search').addEventListener('keydown',e=>{
        if(e.key==='Enter'){e.preventDefault();state.commentOffset=0;show('comments');}
      });
      $('#search-comments').addEventListener('click',()=>{state.commentOffset=0;show('comments');});
      $('#refresh-comments').addEventListener('click',()=>show('comments'));
      $('#prev-comments').addEventListener('click',()=>{
        state.commentOffset=Math.max(0,state.commentOffset-25);show('comments');
      });
      $('#next-comments').addEventListener('click',()=>{
        if(state.commentMore){state.commentOffset+=25;show('comments');}
      });
      $('#rating-period').addEventListener('change',()=>show('ratings'));
      $('#refresh-audit').addEventListener('click',()=>show('audit'));
      $('#create-user').addEventListener('click',()=>guarded(async()=>{
        const email=$('#new-email').value.trim(),name=$('#new-name').value.trim();
        const role=$('#new-role').value;
        if(!email||!confirm('確定新增 '+email+' 至管理員白名單？'))return;
        await api('/api/users',{method:'POST',body:JSON.stringify({
          email,display_name:name,role
        })});
        $('#new-email').value='';$('#new-name').value='';
        await loadUsers();
      }));
      await show('overview');
    }catch(e){
      message('無法進入管理後台：'+(e.message||'驗證失敗'),true);
      $$('.nav-item').forEach(el=>el.disabled=true);
    }
  }
  init();
})();
`;
