/* Reader highlights and public feedback. Loaded only when API + sitekey configured. */
(() => {
  const entry = document.getElementById('guide-feedback');
  const feed = document.getElementById('guide-feedback-feed');
  if (!entry && !feed) return;
  const formatDate = date => {
    const value = new Date(date);
    return isNaN(value.getTime()) ? '' : value.toLocaleDateString('zh-TW', { year:'numeric', month:'short', day:'numeric' });
  };
  const kindLabels = { question:'提問', correction:'內容更正', supplement:'補充資訊' };
  const create = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const apiRoot = (entry || feed).dataset.api;
  const root = (entry || feed).dataset.root || '';
  const requestList = async (entryId, offset, limit) => {
    const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (entryId) query.set('entry', entryId);
    const result = await fetch(apiRoot + '/api/comments?' + query.toString(), { method:'GET' });
    const data = await result.json();
    if (!result.ok || !data.ok || !Array.isArray(data.items)) throw new Error('目前無法載入留言');
    return data;
  };
  const renderNote = (note, isGlobal = false) => {
    const item = create('article', 'guide-feedback-note');
    const header = create('div', 'guide-feedback-note-header');
    header.append(create('span', 'guide-feedback-note-kind', kindLabels[note.kind] || '讀者留言'));
    header.append(create('span', 'guide-feedback-note-meta', (note.author || '讀者') + ' · ' + formatDate(note.created_at)));
    if (note.status === 'resolved') header.append(create('span', 'guide-feedback-note-resolved', '已處理'));
    item.append(header);
    if (isGlobal) {
      const link = create('a', 'guide-feedback-note-entry', note.entry_title || note.entry_id);
      link.href = root + '/entries/' + encodeURIComponent(note.entry_id) + '/' +
        (note.section_id ? '#' + encodeURIComponent(note.section_id) : '');
      item.append(link);
    }
    if (note.quote) {
      const quotation = create('blockquote', 'guide-feedback-note-quote', note.quote);
      item.append(quotation);
    }
    item.append(create('p', 'guide-feedback-note-body', note.body || ''));
    if (note.admin_reply) {
      const answer = create('div', 'guide-feedback-editor-response');
      answer.append(create('strong', '', '編輯回覆'));
      answer.append(create('p', '', note.admin_reply));
      item.append(answer);
    }
    return item;
  };
  if (feed) {
    const list = feed.querySelector('[data-feed-items]');
    const status = feed.querySelector('[data-feed-status]');
    const more = feed.querySelector('[data-feed-more]');
    let offset = 0;
    let loading = false;
    async function loadMore() {
      if (loading) return;
      loading = true;
      more.hidden = true;
      status.textContent = '正在載入留言……';
      try {
        const result = await requestList(null, offset, 12);
        result.items.forEach(note => list.append(renderNote(note, true)));
        offset += result.items.length;
        status.textContent = offset ? '目前顯示 ' + offset + ' 則已審核留言' : '目前還沒有已公開的留言。';
        more.hidden = !result.has_more;
      } catch (error) {
        status.textContent = '留言暫時無法讀取，請稍後重新整理。';
      } finally {
        loading = false;
      }
    }
    more.addEventListener('click', loadMore);
    loadMore();
    return;
  }
  const article = document.querySelector('.article.guide-article');
  const action = entry.querySelector('#guide-feedback-select');
  const dialog = entry.querySelector('#guide-feedback-dialog');
  const form = entry.querySelector('#guide-feedback-form');
  const quotePreview = entry.querySelector('[data-feedback-quote]');
  const message = entry.querySelector('#guide-feedback-message');
  const success = entry.querySelector('[data-feedback-status]');
  const list = entry.querySelector('[data-feedback-items]');
  const submitButton = entry.querySelector('[data-feedback-submit]');
  let current = { quote:'', section_id:'', context_before:'', context_after:'' };
  let widgetId = null;
  let challengeReady = null;
  const showMessage = (text, isError = false) => {
    message.textContent = text;
    message.classList.toggle('is-error', isError);
  };
  async function loadComments() {
    try {
      const result = await requestList(entry.dataset.entryId, 0, 20);
      list.replaceChildren();
      if (!result.items.length) {
        list.append(create('p', 'guide-feedback-empty', '還沒有公開的留言，歡迎提出第一個問題或補充。'));
      } else {
        result.items.forEach(note => list.append(renderNote(note)));
      }
      if (result.has_more) {
        const link = create('a', 'text-link', '查看更多留言 ↗');
        link.href = root + '/feedback/';
        list.append(link);
      }
    } catch {
      list.replaceChildren(create('p', 'guide-feedback-empty', '目前無法讀取留言，請稍後再試。'));
    }
  }
  async function ensureChallenge() {
    if (widgetId !== null) return;
    if (!challengeReady) {
      challengeReady = new Promise((resolve, reject) => {
        if (window.turnstile) { resolve(); return; }
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error('安全驗證載入失敗'));
        document.head.append(script);
      });
    }
    await challengeReady;
    if (!window.turnstile) throw new Error('安全驗證未載入');
    widgetId = window.turnstile.render('#guide-feedback-turnstile', {
      sitekey: entry.dataset.sitekey,
      action: 'guide_feedback',
      theme: 'light'
    });
  }
  async function openForm(selected) {
    current = selected || { quote:'', section_id:'', context_before:'', context_after:'' };
    action.hidden = true;
    quotePreview.textContent = current.quote ? '選取原文：「' + current.quote + '」' : '';
    quotePreview.hidden = !current.quote;
    form.reset();
    showMessage('');
    dialog.showModal();
    form.querySelector('textarea[name="body"]').focus();
    try { await ensureChallenge(); } catch { showMessage('無法載入安全驗證，請重新整理網頁再試。', true); }
  }
  entry.querySelector('[data-feedback-open]').addEventListener('click', () => openForm(null));
  entry.querySelectorAll('[data-feedback-close]').forEach(button =>
    button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });

  function hideAction() { action.hidden = true; }
  function captureSelection() {
    if (!article || dialog.open) return hideAction();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) return hideAction();
    const range = selection.getRangeAt(0);
    const parent = range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer : range.startContainer.parentElement;
    const endParent = range.endContainer.nodeType === Node.ELEMENT_NODE
      ? range.endContainer : range.endContainer.parentElement;
    if (!article.contains(parent) || !article.contains(endParent) ||
      parent?.closest('a, button, input, textarea, table, pre, code, .chapter-jump, h2, h3') ||
      endParent?.closest('a, button, input, textarea, table, pre, code, .chapter-jump, h2, h3')) {
      return hideAction();
    }
    const quote = selection.toString().replace(/\s+/g, ' ').trim();
    if (quote.length < 3 || quote.length > 300) return hideAction();
    const headings = [...article.querySelectorAll('h2[id],h3[id],h4[id]')];
    let section = '';
    for (const heading of headings) {
      if (heading === parent || (heading.compareDocumentPosition(parent) & Node.DOCUMENT_POSITION_FOLLOWING)) {
        section = heading.id;
      } else {
        break;
      }
    }
    const text = parent?.textContent || '';
    const offset = Math.max(0, Math.min(text.length, range.startOffset || 0));
    current = { quote, section_id: section,
      context_before: text.slice(Math.max(0, offset - 60), offset),
      context_after: text.slice(offset, offset + 60) };
    const rect = range.getBoundingClientRect();
    action.style.top = Math.max(65, Math.min(window.innerHeight - 62, rect.bottom + 9)) + 'px';
    action.style.left = Math.max(8, Math.min(window.innerWidth - 240, rect.left)) + 'px';
    action.hidden = false;
  }
  document.addEventListener('mouseup', () => setTimeout(captureSelection, 30));
  document.addEventListener('touchend', () => setTimeout(captureSelection, 170), { passive:true });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') hideAction();
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') setTimeout(captureSelection, 30);
  });
  document.addEventListener('scroll', hideAction, { passive:true });
  action.addEventListener('mousedown', event => event.preventDefault());
  action.addEventListener('click', () => openForm({ ...current }));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitButton.disabled) return;
    const data = new FormData(form);
    const body = String(data.get('body') || '').trim();
    if (body.length < 10 || body.length > 2000) return showMessage('請填寫至少 10 字、最多 2000 字的留言。', true);
    const token = widgetId !== null && window.turnstile ? window.turnstile.getResponse(widgetId) : '';
    if (!token) return showMessage('請完成安全驗證後再送出。', true);
    submitButton.disabled = true;
    showMessage('正在送出留言……');
    try {
      const response = await fetch(apiRoot + '/api/comments', {
        method:'POST', headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          entry_id: entry.dataset.entryId, entry_title: entry.dataset.entryTitle,
          section_id: current.section_id, quote: current.quote,
          context_before: current.context_before, context_after: current.context_after,
          author: data.get('author'), kind: data.get('kind'), body,
          website: data.get('website'), turnstile_token: token
        })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || '留言傳送失敗');
      dialog.close();
      success.textContent = '已收到留言，待管理員審核後公開。感謝協助讓知識更加清楚。';
      window.getSelection()?.removeAllRanges();
    } catch (error) {
      showMessage(error.message || '留言暫時無法送出，請稍後重試。', true);
    } finally {
      if (widgetId !== null && window.turnstile) window.turnstile.reset(widgetId);
      submitButton.disabled = false;
    }
  });
  loadComments();
})();
