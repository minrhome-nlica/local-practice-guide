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
    loginInput.value = '';
    loginPanel.hidden = false;
    dashboard.hidden = true;
    list.replaceChildren();
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
    // Backend must send stable entry slugs. Keep generated link within the guide.
    if (!/^[a-z0-9][a-z0-9-]{1,90}$/.test(String(comment.entry_id || ''))) return root + '/knowledge/';
    return root + '/entries/' + encodeURIComponent(comment.entry_id) + '/' +
      (comment.section_id ? '#' + encodeURIComponent(comment.section_id) : '');
  }
  function render(comment) {
    const card = el('article', 'staff-item');
    const header = el('div', 'staff-item-head');
    const tags = el('div', 'staff-item-tags');
    tags.append(el('span','staff-pill staff-pill-type', labels[comment.kind] || '讀者留言'));
    tags.append(el('span','staff-pill', labels[comment.status] || '留言'));
    header.append(tags);
    header.append(el('div', 'staff-item-meta', (comment.author || '讀者') + ' · ' + date(comment.created_at)));
    card.append(header);

    const link = el('a', 'staff-entry-link', '查看詞條：' + (comment.entry_title || comment.entry_id));
    link.href = entryUrl(comment);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    card.append(link);
    if (comment.quote) card.append(el('blockquote', 'staff-quote', '讀者選取原文：' + comment.quote));
    card.append(el('p', 'staff-comment', comment.body || ''));
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
      loginInput.value = '';
      loginPanel.hidden = true;
      dashboard.hidden = false;
      setCurrentStatus('pending');
      list.replaceChildren();
      if (result.items.length === 0) list.append(el('p','staff-empty','目前沒有待審核的留言。'));
      else result.items.forEach(item => list.append(render(item)));
      msg(statusText, '登入成功。本次載入 ' + result.items.length + ' 則待審核留言。');
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
  logoutButton.addEventListener('click', () => logout('已登出。'));
  document.addEventListener('visibilitychange', () => {
    // Do not keep an admin token across a long idle session.
    if (document.visibilityState === 'hidden') return;
  });
  window.addEventListener('pagehide', () => { token = null; });
})();
