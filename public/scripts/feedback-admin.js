/* Site-hosted moderation interface. No admin credential is saved to storage or the URL. */
(() => {
  'use strict';
  const page = document.getElementById('guide-feedback-admin');
  if (!page) return;
  const api = (page.dataset.api || '').replace(/\/$/, '');
  const root = page.dataset.root || '';
  const loginPanel = document.getElementById('staff-login');
  const loginForm = document.getElementById('staff-login-form');
  const loginInput = document.getElementById('staff-admin-token');
  const loginMessage = document.getElementById('staff-login-message');
  const loginButton = document.getElementById('staff-login-button');
  const dashboard = document.getElementById('staff-dashboard');
  const list = document.getElementById('staff-items');
  const statusText = document.getElementById('staff-list-status');
  const refreshButton = document.getElementById('staff-refresh');
  const logoutButton = document.getElementById('staff-logout');
  const tabs = [...page.querySelectorAll('[data-status]')];
  const pendingCounter = document.getElementById('staff-pending-count');
  const ratingPanel = document.getElementById('staff-rating-insights');
  const ratingList = document.getElementById('staff-rating-list');
  const ratingOverview = document.getElementById('staff-rating-overview');
  const ratingStatus = document.getElementById('staff-rating-status');
  const ratingPeriod = document.getElementById('staff-rating-period');
  const ratingRefresh = document.getElementById('staff-rating-refresh');
  const ratingReasons = {
    missing_answer:'沒有找到需要的答案', unclear:'部分內容看不懂',
    needs_examples:'希望增加實際案例', possibly_outdated:'資訊可能有誤或過時',
    layout_issue:'排版或操作有問題', other:'其他建議'
  };

  function setPendingCount(rows) {
    if (!pendingCounter) return;
    const n = Array.isArray(rows) ? rows.length : 0;
    pendingCounter.textContent = n >= 100 ? '100+' : String(n);
    pendingCounter.hidden = false;
  }
  async function refreshPendingCount() {
    if (!token) return;
    try {
      const result = await apiCall('/api/admin/comments?status=pending');
      setPendingCount(result.items);
    } catch(error) {
      if (error.code === 'AUTH') logout(error.message);
      else if (pendingCounter) pendingCounter.hidden = true;
    }
  }

  let token = null;
  let status = 'pending';
  let pending = false;

  const labels = {
    pending: '待審核', approved: '已公開', rejected: '已拒絕', resolved: '已處理',
    question: '提問諮詢', correction: '內容更正', supplement: '補充留言'
  };
  function el(tag, className, content) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content !== undefined) element.textContent = String(content);
    return element;
  }
  function msg(element, message, bad = false) {
    element.textContent = message;
    element.classList.toggle('is-error', bad);
  }
  function date(value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('zh-TW', {
      year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'
    });
  }
  function setBusy(flag) {
    pending = flag;
    loginButton.disabled = flag;
    refreshButton.disabled = flag;
    tabs.forEach(tab => { tab.disabled = flag; });
  }
  function logout(message = '') {
    token = null;
    if (pendingCounter) pendingCounter.hidden = true;
    loginInput.value = '';
    loginPanel.hidden = false;
    dashboard.hidden = true;
    list.replaceChildren();
    if (ratingPanel) ratingPanel.hidden = true;
    msg(loginMessage, message);
    loginInput.focus();
  }
  async function apiCall(path, method = 'GET', payload, candidate = token) {
    if (!candidate) throw new Error('請先驗證管理金鑰');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response;
    try {
      response = await fetch(api + path, {
        method,
        headers: {
          'Authorization': 'Bearer ' + candidate,
          ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {})
        },
        ...(method !== 'GET' ? { body: JSON.stringify(payload) } : {}),
        signal: controller.signal,
        cache: 'no-store',
        mode: 'cors',
        credentials: 'omit',
        redirect: 'error'
      });
    } catch (error) {
      throw new Error(error.name === 'AbortError'
        ? '連線逾時，請重試。'
        : '無法連接留言管理 API，請確認 HTTPS 與網路連線。');
    } finally {
      clearTimeout(timeout);
    }
    let body = null;
    try { body = await response.json(); } catch {}
    if (response.status === 401 || response.status === 403) {
      const e = new Error('管理金鑰錯誤或已失效，請重新驗證。');
      e.code = 'AUTH';
      throw e;
    }
    if (!response.ok || body?.ok !== true) throw new Error(body?.error || '伺服器回應失敗（HTTP ' + response.status + '）');
    return body;
  }
  function setCurrentStatus(name) {
    status = name;
    tabs.forEach(tab => tab.setAttribute('aria-pressed', String(tab.dataset.status === name)));
  }
  function makeAction(text, choice, className, onClick) {
    const button = el('button', className, text);
    button.type = 'button';
    button.dataset.action = choice;
    button.addEventListener('click', onClick);
    return button;
  }
  function entryUrl(comment) {
    // A site-wide suggestion belongs to /feedback/, not a nonexistent entry slug.
    if(comment.entry_id === 'site-feedback') return root + '/feedback/#guide-feedback-direct';
    // Backend must send stable entry slugs. Keep generated link within the guide.
    if (!/^[a-z0-9][a-z0-9-]{1,90}$/.test(String(comment.entry_id || ''))) return root + '/knowledge/';
    return root + '/entries/' + encodeURIComponent(comment.entry_id) + '/' +
      (comment.section_id ? '#' + encodeURIComponent(comment.section_id) : '');
  }
  function render(comment) {
    const card = el('article', 'staff-item');
    const header = el('div', 'staff-item-head');
    const tags = el('div', 'staff-item-tags');
    let noteLabel = labels[comment.kind] || '讀者留言';
    let visibleBody = String(comment.body || '');
    if(comment.entry_id === 'site-feedback') {
      for(const [prefix,label] of [
        ['【希望新增的主題】','新主題建議'],
        ['【網站使用建議】','網站使用建議']
      ]) {
        if(visibleBody.startsWith(prefix+'\n')){
          noteLabel = label;
          visibleBody = visibleBody.slice(prefix.length+1);
          break;
        }
      }
    }
    tags.append(el('span','staff-pill staff-pill-type',noteLabel));
    tags.append(el('span','staff-pill', labels[comment.status] || '留言'));
    header.append(tags);
    header.append(el('div', 'staff-item-meta', (comment.author || '讀者') + ' · ' + date(comment.created_at)));
    card.append(header);

    const link = el('a', 'staff-entry-link',
      (comment.entry_id === 'site-feedback' ? '查看網站留言：' : '查看詞條：') +
      (comment.entry_title || comment.entry_id));
    link.href = entryUrl(comment);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    card.append(link);
    if (comment.quote) card.append(el('blockquote', 'staff-quote', '讀者選取原文：' + comment.quote));
    card.append(el('p', 'staff-comment', visibleBody));
    const label = el('label', 'staff-reply-label', '編輯回覆（選填）');
    const textarea = el('textarea', 'staff-reply');
    textarea.rows = 3;
    textarea.maxLength = 1800;
    textarea.value = comment.admin_reply || '';
    textarea.id = 'staff-reply-' + comment.id;
    label.htmlFor = textarea.id;
    card.append(label, textarea, el('p', 'staff-reply-help', '若同時按「通過審核」，這段回覆會與留言一起公開。'));

    const actions = el('div','staff-actions');
    const update = async nextStatus => {
      if (pending) return;
      if (nextStatus === 'rejected' &&
          !confirm('確定將這則留言標記為「已拒絕」？它不會在公開留言區顯示。')) return;
      setBusy(true);
      [...actions.querySelectorAll('button')].forEach(b => b.disabled = true);
      msg(statusText, '正在儲存……');
      try {
        await apiCall('/api/admin/comments/' + encodeURIComponent(comment.id), 'POST',
          {status: nextStatus, admin_reply: textarea.value.trim()});
        msg(statusText, '已儲存處理結果。');
        await load(status);
      } catch (error) {
        if (error.code === 'AUTH') return logout(error.message);
        msg(statusText, error.message, true);
        [...actions.querySelectorAll('button')].forEach(b => b.disabled = false);
      } finally {
        setBusy(false);
      }
    };
    if (comment.status === 'pending' || comment.status === 'rejected') {
      actions.append(makeAction('通過並公開', 'approve', 'staff-primary', () => update('approved')));
    }
    if (comment.status === 'approved') {
      actions.append(makeAction('標記已處理', 'resolve', 'staff-secondary', () => update('resolved')));
    }
    if (comment.status === 'resolved') {
      actions.append(makeAction('恢復已公開', 'approve', 'staff-secondary', () => update('approved')));
    }
    if (comment.status !== 'pending') {
      actions.append(makeAction('退回待審', 'pending', 'staff-secondary', () => update('pending')));
    }
    if (comment.status !== 'rejected') {
      actions.append(makeAction('拒絕留言', 'reject', 'staff-secondary staff-danger', () => update('rejected')));
    }
    actions.append(makeAction('只儲存回覆', 'save', 'staff-secondary', () => update(comment.status)));
    card.append(actions);
    return card;
  }
  async function load(nextStatus = status, candidate = token) {
    if (!candidate) return;
    setBusy(true);
    msg(statusText, '正在取得' + (labels[nextStatus] || '讀者') + '留言……');
    try {
      const result = await apiCall('/api/admin/comments?status=' + encodeURIComponent(nextStatus), 'GET', undefined, candidate);
      setCurrentStatus(nextStatus);
      list.replaceChildren();
      const notes = Array.isArray(result.items) ? result.items : [];
      if (nextStatus === 'pending') setPendingCount(notes);
      else await refreshPendingCount();
      if (notes.length === 0) list.append(el('p','staff-empty', '目前沒有' + labels[nextStatus] + '的留言。'));
      else notes.forEach(item => list.append(render(item)));
      msg(statusText, '本次載入 ' + notes.length + ' 則' + labels[nextStatus] + '留言' +
        (notes.length >= 100 ? '（僅顯示前 100 則）' : ''));
    } catch (error) {
      if (error.code === 'AUTH') return logout(error.message);
      msg(statusText, error.message, true);
      if (!dashboard.hidden && list.childElementCount === 0) list.append(el('p','staff-empty','暫時無法載入留言，請稍後再試。'));
    } finally {
      setBusy(false);
    }
  }
  // Private aggregate data, using the same in-memory authentication token as moderation.
  async function loadRatings(candidate = token) {
    if (!ratingPanel || !candidate) return;
    ratingRefresh.disabled = true;
    if (!ratingPanel.hidden) msg(ratingStatus, '正在讀取文章回饋……');
    try {
      const period = ratingPeriod.value === 'all' ? 'all' : '30';
      const data = await apiCall('/api/admin/ratings?period=' + period, 'GET', undefined, candidate);
      if (!Array.isArray(data.items)) throw new Error('文章統計資料格式不正確');
      const items = data.items.filter(x => /^[a-z0-9][a-z0-9-]{1,90}$/.test(x.entry_id || ''));
      const sum = key => items.reduce((n, x) => n + (Number(x[key]) || 0), 0);
      ratingOverview.replaceChildren();
      for (const [name, value] of [
        ['回饋筆數',sum('total')],['有幫助',sum('helpful')],
        ['還沒解決',sum('unresolved')],['有回饋的文章',items.length]
      ]) {
        const box = el('div','staff-rating-summary');
        box.append(el('span','',name),el('strong','',Number(value).toLocaleString('zh-TW')));
        ratingOverview.append(box);
      }
      ratingList.replaceChildren();
      if (!items.length) ratingList.append(el('p','staff-empty','這個期間尚無文章回饋。'));
      for (const item of items) {
        const count = Math.max(0, Number(item.total) || 0);
        const good = Math.max(0, Number(item.helpful) || 0);
        const bad = Math.max(0, Number(item.unresolved) || 0);
        const percent = count ? Math.round(100 * good / count) : 0;
        const card = el('article','staff-rating-card');
        const head = el('div','staff-rating-card-head');
        const link = el('a','staff-rating-link',item.entry_title || item.entry_id);
        link.href = root + '/entries/' + encodeURIComponent(item.entry_id) + '/';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        head.append(link,el('span','staff-rating-percent',percent+'% 有幫助'));
        const stats = el('div','staff-rating-stats');
        stats.append(el('span','','總回饋 '+count),el('span','','有幫助 '+good),el('span','','還沒解決 '+bad));
        const track = el('div','staff-rating-bar');
        const fill = el('div','staff-rating-bar-fill');
        fill.style.width = Math.max(0,Math.min(100,percent))+'%';
        track.append(fill);
        card.append(head,stats,track);
        const reasons = Object.entries(item.reasons || {}).filter(([k,v]) => ratingReasons[k] && Number(v)>0)
          .sort((a,b)=>Number(b[1])-Number(a[1]));
        if(reasons.length) {
          const section = el('div','staff-rating-reasons');
          section.append(el('strong','','還沒解決的原因'));
          const chips = el('div','staff-rating-reason-chips');
          reasons.forEach(([key,n]) => chips.append(el('span','',ratingReasons[key]+' '+Number(n))));
          section.append(chips);
          card.append(section);
        }
        if(count<10) card.append(el('p','staff-rating-caution','回饋少於 10 筆，比例僅供參考，不宜直接排名。'));
        ratingList.append(card);
      }
      ratingPanel.hidden = false;
      msg(ratingStatus,'已更新 '+items.length+' 篇文章的回饋統計。');
    } catch(error) {
      if(error.code === 'AUTH') return logout(error.message);
      // Older Worker versions / missing migration should not show a broken panel.
      if(!ratingPanel.hidden) msg(ratingStatus,'統計更新失敗：'+error.message,true);
    } finally {
      ratingRefresh.disabled = false;
    }
  }

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending) return;
    if (location.protocol !== 'https:') {
      msg(loginMessage, '請使用 HTTPS 安全網址登入。', true);
      return;
    }
    const candidate = loginInput.value.trim();
    if (candidate.length < 32) {
      msg(loginMessage, '管理金鑰至少需要 32 個字元。', true);
      return;
    }
    setBusy(true);
    msg(loginMessage, '正在驗證管理權限……');
    try {
      const result = await apiCall('/api/admin/comments?status=pending', 'GET', undefined, candidate);
      if (!Array.isArray(result.items)) throw new Error('留言 API 回應資料格式不正確');
      token = candidate;
      setPendingCount(result.items);
      loginInput.value = '';
      loginPanel.hidden = true;
      dashboard.hidden = false;
      setCurrentStatus('pending');
      list.replaceChildren();
      if (result.items.length === 0) list.append(el('p','staff-empty','目前沒有待審核的留言。'));
      else result.items.forEach(item => list.append(render(item)));
      msg(statusText, '登入成功。本次載入 ' + result.items.length + ' 則待審核留言。');
      void loadRatings(candidate);
    } catch (error) {
      token = null;
      msg(loginMessage, error.message, true);
    } finally {
      setBusy(false);
    }
  });
  tabs.forEach(tab => tab.addEventListener('click', () => {
    if (!pending && token && tab.dataset.status !== status) load(tab.dataset.status);
  }));
  refreshButton.addEventListener('click', () => { if (!pending && token) load(status); });
  ratingRefresh?.addEventListener('click', () => { if(token) void loadRatings(); });
  ratingPeriod?.addEventListener('change', () => { if(token) void loadRatings(); });
  logoutButton.addEventListener('click', () => logout('已登出。'));
  document.addEventListener('visibilitychange', () => {
    // Do not keep an admin token across a long idle session.
    if (document.visibilityState === 'hidden') return;
  });
  window.addEventListener('pagehide', () => { token = null; });
})();
