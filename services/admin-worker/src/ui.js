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
      <div class="mobile-bar">
        <a class="brand" href="/"><small>MOUNT COUNTY / ADMIN</small><strong>地方實踐指南</strong><span>網站管理中心</span></a>
        <button id="mobile-menu-toggle" class="mobile-menu-toggle" type="button" aria-controls="navigation" aria-expanded="false" aria-label="開啟後台功能選單">
          <span class="menu-icon" aria-hidden="true">☰</span><span class="menu-label">功能選單</span>
        </button>
      </div>
      <p class="nav-title">管理功能</p>
      <nav id="navigation" aria-label="後台功能">
        <button type="button" class="nav-item current" data-tab="overview">總覽儀表板</button>
        <button type="button" class="nav-item" data-tab="comments" data-role="owner moderator">讀者留言管理</button>
        <button type="button" class="nav-item" data-tab="ratings">文章回饋分析</button>
        <button type="button" class="nav-item" data-tab="articles" data-role="owner editor">文章目錄與編修</button>
        <button type="button" class="nav-item" data-tab="analytics">網站分析 Web Analytics</button>
        <button type="button" class="nav-item" data-tab="updates">重要更新紀錄</button>
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
        <p class="hint">上方數字為留言與文章回饋統計；網站瀏覽量請至左側「網站分析 Web Analytics」查看。</p>
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
        <div class="section-head">
          <div><h2>文章目錄與編修</h2><p>從 GitHub 正式分支整理文章清單、更新日期和內容狀態。</p></div>
          <button id="refresh-articles" type="button">重新整理</button>
        </div>
        <div class="card">
          <h3>編輯與發布原則</h3>
          <p>這裡目前提供已存在於正式分支的文章清單，供工作人員查閱與定位檔案。<strong>內建草稿編輯、送審及管理員核准發布尚未啟用。</strong></p>
          <p class="hint">文章裡標記的「編輯稿」是內容編輯註記，不等於尚未公開。請繼續依既有 GitHub／Pages CMS 工作流程處理，正式發布前由管理員確認。</p>
        </div>
        <div class="filters">
          <label>搜尋文章名稱<input id="article-search" type="search" maxlength="80" placeholder="輸入名稱或關鍵字"></label>
          <label>文章分類<select id="article-category"><option value="all">所有分類</option></select></label>
        </div>
        <p id="article-count" class="hint" role="status" aria-live="polite">正在準備文章目錄…</p>
        <div id="article-list" class="stack"></div>
      </section>

      <section class="panel" data-panel="analytics" hidden>
        <div class="section-head">
          <div><h2>網站分析 Web Analytics</h2><p>掌握網站瀏覽量、訪問次數、每日趨勢與熱門文章。</p></div>
          <div class="analytics-controls">
            <label>統計期間<select id="analytics-period"><option value="7">最近 7 天</option><option value="30">最近 30 天</option></select></label>
            <button type="button" id="analytics-refresh">重新整理</button>
          </div>
        </div>
        <p id="analytics-status" class="hint" role="status" aria-live="polite">準備讀取 Cloudflare 統計資料…</p>
        <div class="stats" id="analytics-summary"></div>
        <div class="card"><h3>每日瀏覽趨勢</h3><p class="hint analytics-mobile-hint">手機可在圖表範圍內左右滑動，查看完整每日數據。</p><div id="analytics-chart" class="analytics-chart" role="img" aria-label="每日網站瀏覽量直條圖"><p class="hint">載入中…</p></div></div>
        <div class="card"><h3>熱門頁面</h3><div id="analytics-top-pages" class="analytics-pages"><p class="hint">載入中…</p></div></div>
        <p class="hint" id="analytics-note">資料來源：Cloudflare Web Analytics。訪問次數不是不重複訪客人數；資料可能有延遲及抽樣估算。</p>
        <a href="https://dash.cloudflare.com/" rel="noopener noreferrer" target="_blank">前往 Cloudflare 控制台查看原始統計 ↗</a>
      </section>
      <section class="panel" data-panel="updates" hidden>
        <div class="section-head">
          <div><h2>重要更新紀錄</h2><p>從 GitHub 正式網站的更新，自動整理內容新增、功能與修正紀錄。</p></div>
          <button id="refresh-updates" type="button">重新整理</button>
        </div>
        <p class="hint">以下是從正式分支整理的<strong>內部候選清單</strong>，不是公開公告。分類依提交訊息推估；重要變更仍需由管理員核對，才可用於正式發布紀錄。</p>
        <div class="filters">
          <label>紀錄分類<select id="updates-type">
            <option value="all">全部更新</option>
            <option value="articles">文章與內容</option>
            <option value="feature">新增功能</option>
            <option value="fix">功能修正</option>
            <option value="maintenance">一般維護</option>
          </select></label>
        </div>
        <p id="updates-count" class="hint" role="status" aria-live="polite">正在讀取最近的更新…</p>
        <div id="updates-list" class="stack"></div>
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

.analytics-controls{display:flex;align-items:end;gap:10px;flex-wrap:wrap}.analytics-controls label{min-width:155px}
.analytics-chart{overflow-x:auto;padding:8px 0}.analytics-bars{height:225px;display:flex;gap:5px;align-items:end;min-width:max-content;padding-top:20px}
.analytics-day{display:flex;flex-direction:column;align-items:center;justify-content:end;min-width:37px;flex:1;height:100%;gap:4px}
.analytics-day small{font-size:10px;color:#718078;white-space:nowrap}
.analytics-bar-value{font-size:11px;color:#516f5c;font-variant-numeric:tabular-nums}
.analytics-bar-track{width:min(100%,32px);height:150px;display:flex;align-items:end;border-radius:5px;background:#edf3eb;overflow:hidden}
.analytics-bar-fill{width:100%;background:#4d8467;border-radius:5px 5px 0 0}
.analytics-pages{display:flex;flex-direction:column;gap:0}
.analytics-page-row{padding:10px 0;display:flex;align-items:center;gap:14px;border-bottom:1px solid #e9eee8}
.analytics-page-row:last-child{border-bottom:none}
.analytics-rank{color:#74887d;min-width:22px;text-align:right}
.analytics-page-link{flex:1;min-width:0;overflow-wrap:anywhere;font-size:13px}
.analytics-page-row strong{font-size:13px;color:#294f3e;white-space:nowrap}
.update-tag{display:inline-block;padding:2px 9px;border-radius:999px;background:#eaf0e7;color:#365747;font-size:12px}
.article-row-head{display:flex;align-items:start;justify-content:space-between;gap:12px;flex-wrap:wrap}
.article-meta{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
.article-links{display:flex;gap:14px;flex-wrap:wrap;margin-top:12px}
.article-links a{min-height:36px;display:inline-flex;align-items:center}
[hidden]{display:none!important}
.mobile-bar{display:contents}.mobile-menu-toggle{display:none!important}
.analytics-mobile-hint{display:none}
@media(max-width:1000px){
  html,body{max-width:100%;overflow-x:clip}
  .shell{display:block;min-width:0}
  .sidebar{height:auto;position:sticky;top:0;z-index:50;padding:8px 14px;background:#183c33;box-shadow:0 3px 12px #102b211c}
  .mobile-bar{display:flex;align-items:center;gap:12px;justify-content:space-between}
  .brand{padding:4px 0;min-width:0;flex:1}
  .brand strong{font-size:18px;line-height:1.4}
  .brand small{font-size:9px}
  .brand span{font-size:11px}
  .sidebar .mobile-menu-toggle{display:inline-flex!important;min-height:44px;align-items:center;justify-content:center;gap:7px;flex:none;background:transparent;color:#fff;border-color:#809c89;padding:8px 12px;font-size:14px}
  .sidebar .mobile-menu-toggle:hover{background:#315947;color:#fff}
  .menu-icon{font-size:20px;line-height:1}
  .nav-title{display:none}
  .sidebar nav{display:none;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;max-height:min(64dvh,520px);overflow-y:auto;overscroll-behavior:contain;padding:13px 0 10px;border-top:1px solid #426457;margin-top:8px}
  .sidebar.menu-open nav{display:grid}
  .nav-item{min-width:0;width:100%;white-space:normal;font-size:14px;min-height:49px;padding:10px 12px;text-align:left;display:flex;flex-direction:column;justify-content:center;margin:0}
  .future{display:block;font-size:11px;line-height:1.5}
  .sidebar-foot{display:none;flex-direction:row;flex-wrap:wrap;justify-content:space-between;gap:12px;padding:10px 0 4px}
  .sidebar.menu-open .sidebar-foot{display:flex}
  main{width:100%;max-width:100%;min-width:0;padding:24px 16px 58px}
  .topbar{gap:12px;margin:0 0 25px;flex-wrap:wrap}
  .topbar h1{font-size:clamp(24px,5vw,30px)}
  .stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}
  .stat,.card,.item{padding:16px}
  .filters label,.section-head label{min-width:0}
  .analytics-chart{max-width:100%}
  .analytics-mobile-hint{display:block}
}
@media(max-width:600px){
  body{font-size:14px}
  main{padding:22px 14px 70px}
  .sidebar{padding:8px 12px}
  .mobile-bar{gap:8px}
  .sidebar .mobile-menu-toggle{padding:8px 11px}
  .sidebar nav{grid-template-columns:repeat(2,minmax(0,1fr))}
  .topbar{flex-direction:column;gap:10px;margin-bottom:22px}
  .profile{text-align:left}
  .profile strong{font-size:12px}
  .topbar h1{font-size:26px}
  .section-head{flex-direction:column;align-items:stretch;gap:12px}
  .section-head>button{width:100%}
  .section-head label{width:100%}
  .filters{display:grid;grid-template-columns:minmax(0,1fr);gap:11px;margin:12px 0 18px}
  .filters>*{min-width:0;width:100%}
  .filters label{width:100%}
  .filters input[type=search]{min-width:0}
  input,select,textarea,.user-select,.filters input,.filters select,.section-head select{font-size:16px;min-height:44px}
  button:not(.nav-item){min-height:44px}
  .stat{padding:13px 14px}
  .stat b{font-size:24px}
  .stat small,.stat span{font-size:12px}
  .card,.item{padding:15px}
  .item .actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
  .item .actions button{min-width:0;width:100%;padding:9px 6px;line-height:1.4;white-space:normal}
  .pagination{gap:9px;flex-wrap:wrap}
  .user-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);width:100%;gap:10px}
  .user-main{grid-column:1 / -1;min-width:0}
  .user-row .user-select{min-width:0;width:100%}
  .user-row>button{grid-column:1 / -1;width:100%}
  .analytics-controls{display:grid;grid-template-columns:minmax(0,1fr);width:100%;gap:10px}
  .analytics-controls label{min-width:0}
  .analytics-controls button{width:100%}
  .analytics-bars{height:190px}
  .analytics-day{min-width:34px}
  .analytics-bar-track{height:120px}
  .analytics-page-row{gap:9px}
  .analytics-page-link{font-size:13px}
  .analytics-page-row strong{font-size:12px}
}
@media(max-width:360px){
  .stats{grid-template-columns:1fr}
  .sidebar nav{grid-template-columns:1fr}
  .menu-label{display:none}
  .item .actions{grid-template-columns:1fr}
}
@media(prefers-reduced-motion:no-preference){
  .sidebar nav{scroll-behavior:smooth}
}
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
    commentOffset:0,commentMore:false,loading:false,articles:[],replyDrafts:new Map() };
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
  function setMobileMenu(open){
    const sidebar=$('.sidebar'),toggle=$('#mobile-menu-toggle');
    if(!sidebar||!toggle)return;
    const expanded=!!open;
    sidebar.classList.toggle('menu-open',expanded);
    toggle.setAttribute('aria-expanded',String(expanded));
    toggle.setAttribute('aria-label',expanded?'關閉後台功能選單':'開啟後台功能選單');
    const icon=toggle.querySelector('.menu-icon');
    if(icon)icon.textContent=expanded?'×':'☰';
  }
  const tabTitles={overview:'總覽儀表板',comments:'讀者留言管理',ratings:'文章回饋分析',
    articles:'文章與草稿',analytics:'Web Analytics',updates:'更新紀錄',team:'工作人員與權限',audit:'操作紀錄'};
  async function show(tab){
    if(!state.user||!permitted(tab))return;
    if(state.loading)return;
    state.tab=tab;
    setMobileMenu(false);
    $('[data-panel]').forEach(el=>{el.hidden=el.dataset.panel!==tab;});
    $$('.nav-item').forEach(el=>el.classList.toggle('current',el.dataset.tab===tab));
    $('#page-title').textContent=tabTitles[tab]||'管理後台';
    $('#page-subtitle').textContent=tab==='overview'?'掌握重要待辦與網站內容管理情形。':'地方實踐指南內部管理介面';
    message('');
    if(tab==='overview')await guarded(loadOverview);
    if(tab==='comments')await guarded(loadComments);
    if(tab==='ratings')await guarded(loadRatings);
    if(tab==='analytics')await guarded(loadAnalytics);
    if(tab==='articles')await guarded(loadArticles);
    if(tab==='updates')await guarded(loadUpdates);
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
    const hint=n('p','hint','下一階段將加入文章草稿審核與內容查核日期；網站分析已另設專區。');
    tasks.append(hint);
    const analyticsBtn=n('button','','查看網站流量');
    analyticsBtn.type='button';analyticsBtn.addEventListener('click',()=>show('analytics'));
    tasks.append(analyticsBtn);
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
    const reply=n('textarea');
    reply.value=state.replyDrafts.has(row.id)?state.replyDrafts.get(row.id):(row.admin_reply||'');
    reply.maxLength=1800;
    reply.addEventListener('input',()=>state.replyDrafts.set(row.id,reply.value));
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
        state.replyDrafts.delete(row.id);
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
  function renderArticleList(){
    const list=$('#article-list'),search=$('#article-search').value.trim().toLocaleLowerCase('zh-Hant');
    const category=$('#article-category').value;
    list.replaceChildren();
    const rows=(state.articles||[]).filter(row=>
      (category==='all'||row.category===category)&&
      (!search||[row.title,row.summary,row.slug,row.editorial_status].join(' ').toLocaleLowerCase('zh-Hant').includes(search)));
    $('#article-count').textContent='共 '+fmt(rows.length)+' 篇（完整目錄 '+fmt((state.articles||[]).length)+' 篇）';
    if(!rows.length){list.append(n('p','empty','找不到符合條件的文章。'));return;}
    for(const row of rows){
      const card=n('article','item'),head=n('div','article-row-head'),h=n('h3','',row.title);
      head.append(h,n('span','update-tag',row.editorial_status||'未註記'));card.append(head);
      if(row.summary)card.append(n('p','',row.summary));
      const meta=n('p','meta','分類：'+row.category+' · 更新日期：'+(row.updated||'未標示'));
      card.append(meta);
      const links=n('div','article-links');
      const preview=n('a','','查看公開文章 ↗');
      preview.href=state.site+'/entries/'+encodeURIComponent(row.slug)+'/';preview.target='_blank';preview.rel='noopener noreferrer';
      const source=n('a','','查看 GitHub 原始檔 ↗');
      source.href=row.source_url;source.target='_blank';source.rel='noopener noreferrer';
      links.append(preview,source);card.append(links);
      list.append(card);
    }
  }
  async function loadArticles(){
    $('#article-count').textContent='正在讀取文章目錄…';
    const data=await api('/api/articles');
    state.articles=data.items||[];
    const select=$('#article-category'),selected=select.value;
    select.replaceChildren();
    const all=n('option','','所有分類');all.value='all';select.append(all);
    const categories=[...new Set(state.articles.map(row=>row.category))].sort((a,b)=>a.localeCompare(b,'zh-Hant'));
    for(const cat of categories){
      const opt=n('option','',cat);opt.value=cat;select.append(opt);
    }
    select.value=categories.includes(selected)?selected:'all';
    renderArticleList();
  }
  async function loadUpdates(){
    const type=$('#updates-type').value;
    const list=$('#updates-list');
    list.replaceChildren();$('#updates-count').textContent='正在整理 GitHub 更新紀錄…';
    const data=await api('/api/updates?type='+encodeURIComponent(type));
    $('#updates-count').textContent='共 '+fmt(data.total||0)+' 筆候選更新（來自網站正式分支）';
    if(!data.items?.length){list.append(n('div','empty','目前沒有符合這個分類的更新紀錄。'));return;}
    for(const row of data.items){
      const card=n('article','item');
      const head=n('div','article-row-head');
      head.append(n('span','update-tag',row.category_label||'維護更新'));
      head.append(n('span','meta',time(row.date)));
      card.append(head,n('h3','',row.title));
      if(row.important)card.append(n('p','hint','可能屬於重要更新，請管理員核對實際變更。'));
      const link=n('a','','查看 GitHub 變更內容 ↗');
      link.href=row.url;link.target='_blank';link.rel='noopener noreferrer';
      card.append(link);list.append(card);
    }
  }
  function analyticsDate(value){
    return typeof value==='string'&&value.length>=10 ? value.slice(5,7)+'/'+value.slice(8,10) : '—';
  }
  async function loadAnalytics(){
    const status=$('#analytics-status'),summary=$('#analytics-summary');
    const chart=$('#analytics-chart'),pages=$('#analytics-top-pages');
    summary.replaceChildren();chart.replaceChildren();pages.replaceChildren();
    status.textContent='正在讀取 Cloudflare Web Analytics…';
    const days=$('#analytics-period').value==='30'?30:7;
    let data;
    try{
      data=await api('/api/analytics?days='+days);
    }catch(e){
      status.textContent='目前無法讀取網站分析：'+(e.message||'請稍後再試');
      chart.append(n('p','empty','目前無法載入瀏覽趨勢。'));
      pages.append(n('p','empty','目前無法載入熱門頁面。'));
      return;
    }
    if(!data.configured){
      status.textContent=data.message||'尚未完成網站分析資料存取設定。';
      chart.append(n('p','empty','等管理員設定 Cloudflare 分析唯讀權杖後，這裡會自動顯示瀏覽趨勢。'));
      pages.append(n('p','empty','目前無法載入熱門頁面，沒有產生估算數據。'));
      $('#analytics-note').textContent='網站分析讀取權限尚未完成，因此不顯示任何虛構流量。';
      return;
    }
    if(data.available===false){
      summary.append(
        stat('頁面瀏覽量','—','尚未收到此站資料'),
        stat('訪問次數','—','無法確認'),
        stat('資料範圍',days+' 天','目前查詢區間'),
        stat('熱門頁面','—','尚無可用資料')
      );
      status.textContent=data.message||'Cloudflare 沒有傳回這個站點的瀏覽紀錄。';
      const hints=n('div','');
      hints.append(n('p','','這不是登入或權杖錯誤；也不能據此認定網站沒有訪客。'));
      hints.append(n('p','hint','請在 Cloudflare 控制台的 Web Analytics 比對同一個站點是否有流量，並確認公開網站追蹤程式已開始傳送資料。新安裝的追蹤程式不能補算安裝前的瀏覽紀錄。'));
      if(days===7){
        try{
          const month=await api('/api/analytics?days=30');
          hints.append(n('p','hint',month.configured&&month.available?
            '自動檢查：最近 30 天有資料，7 天沒有記錄。請切換成「最近 30 天」查看。':
            '自動檢查：最近 30 天也沒有可用的此站流量紀錄。'));
          if(month.diagnostic)hints.append(n('p','hint',month.diagnostic));
        }catch{
          hints.append(n('p','hint','最近 30 天的延伸檢查暫時無法完成。'));
        }
      }else if(data.diagnostic){
        hints.append(n('p','hint',data.diagnostic));
      }
      chart.append(hints);
      pages.append(n('p','empty','尚無可用的熱門頁面數據；此處不會顯示虛構排名。'));
      $('#analytics-note').textContent='Cloudflare API 已回應，但此網站在查詢區間沒有符合條件的事件紀錄。';
      return;
    }
    summary.append(
      stat('頁面瀏覽量',fmt(data.pageviews),'Cloudflare Web Analytics'),
      stat('訪問次數',fmt(data.visits),'不等於不重複訪客'),
      stat('資料範圍',days+' 天','最近統計'),
      stat('熱門頁面榜單',fmt((data.top_pages||[]).length),'最多顯示12頁')
    );
    status.textContent='資料來源：'+(data.source||'Cloudflare Web Analytics')+(data.matched_host?' · 網站：'+data.matched_host:'')+' · 更新時間 '+time(data.updated_at);
    $('#analytics-note').textContent=data.note||'資料可能有延遲。';
    const daily=(data.daily||[]).filter(x=>Number.isFinite(Number(x.pageviews)));
    if(!daily.length){
      chart.append(n('p','empty','目前查詢期間沒有可顯示的每日資料。'));
    }else{
      const max=Math.max(1,...daily.map(x=>Number(x.pageviews)||0));
      const bars=n('div','analytics-bars');
      for(const item of daily){
        const col=n('div','analytics-day');
        const value=Number(item.pageviews)||0;
        const track=n('div','analytics-bar-track');
        track.title=item.date+' · 瀏覽 '+fmt(value)+' 次';
        const fill=n('div','analytics-bar-fill');
        fill.style.height=(value?Math.max(3,100*value/max):0)+'%';
        track.append(fill);
        col.append(n('span','analytics-bar-value',fmt(value)),track,n('small','',analyticsDate(item.date)));
        bars.append(col);
      }
      chart.append(bars);
    }
    const top=data.top_pages||[];
    if(!top.length){
      pages.append(n('p','empty','這段期間沒有可顯示的熱門頁面。'));
    }else{
      for(const [index,item] of top.entries()){
        const row=n('div','analytics-page-row');
        const rank=n('span','analytics-rank',String(index+1));
        const link=n('a','analytics-page-link',item.path);
        // All links are restricted to the current configured public site.
        if(typeof item.path==='string'&&item.path.startsWith('/')&&!item.path.startsWith('//')){
          link.href=state.site+item.path;
          link.target='_blank';link.rel='noopener noreferrer';
        }
        row.append(rank,link,n('strong','',fmt(item.pageviews)+' 次'));
        pages.append(row);
      }
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
      const menuToggle=$('#mobile-menu-toggle');
      menuToggle.addEventListener('click',()=>setMobileMenu(!$('.sidebar').classList.contains('menu-open')));
      document.addEventListener('keydown',e=>{if(e.key==='Escape')setMobileMenu(false);});
      document.addEventListener('click',e=>{
        if(window.matchMedia('(max-width:1000px)').matches&&
          $('.sidebar').classList.contains('menu-open')&&!e.target.closest('.sidebar')){
          setMobileMenu(false);
        }
      });
      window.matchMedia('(min-width:1001px)').addEventListener('change',e=>{
        if(e.matches)setMobileMenu(false);
      });
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
      $('#article-search').addEventListener('input',()=>renderArticleList());
      $('#article-category').addEventListener('change',()=>renderArticleList());
      $('#refresh-articles').addEventListener('click',()=>show('articles'));
      $('#updates-type').addEventListener('change',()=>show('updates'));
      $('#refresh-updates').addEventListener('click',()=>show('updates'));
      $('#analytics-period').addEventListener('change',()=>show('analytics'));
      $('#analytics-refresh').addEventListener('click',()=>show('analytics'));
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
