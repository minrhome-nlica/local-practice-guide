/* Reader highlights and public feedback. Loaded only when API + sitekey configured. */
(() => {
  const entry = document.getElementById('guide-feedback');
  const feed = document.getElementById('guide-feedback-feed');
  if (!entry && !feed) return;
  const formatDate = date => {
    const value = new Date(date);
    return isNaN(value.getTime()) ? '' : value.toLocaleDateString('zh-TW', { year:'numeric', month:'short', day:'numeric' });
  };
  const kindLabels = { question:'提問諮詢', correction:'內容更正', supplement:'補充留言' };
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
    const diagnosis = feed.querySelector('#guide-feedback-diagnostic');
    const runButton = diagnosis?.querySelector('[data-diagnostic-run]');
    const report = diagnosis?.querySelector('[data-diagnostic-result]');
    const runDiagnosis = async () => {
      runButton.disabled = true;
      const rows = [
        '頁面來源：' + window.location.origin,
        '留言服務：' + apiRoot,
        '安全連線：' + (window.location.protocol === 'https:' ? 'HTTPS' : '非 HTTPS，需要修正'),
        ''
      ];
      const flush = () => { report.textContent = rows.join('\n'); };
      const check = async (label, url, options, predicate) => {
        try {
          const response = await fetch(url, { mode:'cors', cache:'no-store', ...options });
          const data = await response.json().catch(() => null);
          const result = predicate(response, data);
          rows.push(label + '：' + (result ? '通過' : '異常') + '（HTTP ' + response.status + '）');
          flush();
          return result;
        } catch (error) {
          rows.push(label + '：連線失敗（瀏覽器阻擋或無法連線）');
          flush();
          return false;
        }
      };
      flush();
      const originOK = await check('① 連接 Worker', apiRoot + '/health', { method:'GET' },
        (response, data) => response.ok && data?.ok === true);
      if (originOK) {
        await check('② 讀取 D1 留言', apiRoot + '/api/comments?entry=income-withholding', { method:'GET' },
          (response, data) => response.ok && data?.ok === true && Array.isArray(data?.items));
        // Intentionally invalid request: should return HTTP 400 without writing any data.
        await check('③ 送出前置驗證（不存留言）', apiRoot + '/api/comments', {
          method:'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
        }, (response, data) => response.status === 400 && data?.ok === false);
      }
      rows.push('');
      rows.push(originOK
        ? '如果 ③ 失敗而 ① 成功，常見原因是跨網域 POST 預檢（OPTIONS）未通過。'
        : '若 Worker 網址直接打開正常，但此處失敗，請檢查 HTTPS 和 Worker ALLOWED_ORIGINS。');
      rows.push('以上資訊不包含驗證金鑰或留言內容，可提供截圖協助排查。');
      flush();
      runButton.disabled = false;
    };
    runButton?.addEventListener('click', runDiagnosis);
    if (diagnosis && new URLSearchParams(location.search).get('diagnose') === '1') {
      diagnosis.hidden = false;
      diagnosis.open = true;
      runDiagnosis();
    }
    const cards = ['supplement', 'question', 'correction'].map(kind => {
      const section = feed.querySelector('[data-feedback-kind="' + kind + '"]');
      return { kind, section, list: section.querySelector('[data-kind-items]'),
        count: section.querySelector('[data-kind-count]'), more: section.querySelector('[data-kind-more]') };
    });
    const status = feed.querySelector('[data-feed-status]');
    const groups = { supplement:[], question:[], correction:[] };
    const visible = { supplement:5, question:5, correction:5 };
    let offset = 0, hasMore = true, loading = false, failed = false;

    async function fetchNext() {
      if (!hasMore || loading) return false;
      loading = true;
      status.textContent = '正在整理各類留言……';
      try {
        const result = await requestList(null, offset, 30);
        result.items.forEach(note => {
          if (groups[note.kind]) groups[note.kind].push(note);
        });
        offset += result.items.length;
        hasMore = result.has_more && result.items.length > 0;
        failed = false;
        return true;
      } catch {
        failed = true;
        status.textContent = '留言暫時無法讀取，請稍後再試。';
        return false;
      } finally {
        loading = false;
      }
    }
    function renderCategories() {
      cards.forEach(({kind, list, count, more}) => {
        const matching = groups[kind];
        const show = matching.slice(0, visible[kind]);
        list.replaceChildren();
        if (!show.length) {
          list.append(create('p','guide-feedback-category-empty',
            hasMore ? '目前載入的留言尚無此類，可繼續載入查找。' : '目前沒有已公開的相關留言。'));
        } else {
          show.forEach(note => list.append(renderNote(note, true)));
        }
        count.textContent = '已載入 ' + matching.length + ' 則';
        more.hidden = !hasMore && matching.length <= visible[kind];
        more.textContent = matching.length > visible[kind] ? '顯示更多留言 ＋' : '繼續載入留言 ＋';
        more.disabled = loading;
      });
      if (!failed) {
        status.textContent = '目前已整理 ' + offset + ' 則公開留言，依留言類型分類顯示。' +
          (hasMore ? '可點各欄下方載入更多。' : '');
      }
    }
    cards.forEach(({kind, more}) => {
      more.addEventListener('click', async () => {
        if (loading) return;
        visible[kind] += 5;
        more.disabled = true;
        while (hasMore && groups[kind].length < visible[kind]) {
          if (!(await fetchNext())) break;
        }
        renderCategories();
      });
    });
    fetchNext().then(renderCategories);
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
  const notesDialog = entry.querySelector('#guide-feedback-notes-dialog');
  const notesText = entry.querySelector('[data-feedback-paragraph-text]');
  const notesList = entry.querySelector('[data-feedback-paragraph-notes]');
  entry.querySelectorAll('[data-feedback-notes-close]').forEach(button =>
    button.addEventListener('click', () => notesDialog.close()));
  notesDialog.addEventListener('click', event => {
    if (event.target === notesDialog) notesDialog.close();
  });

  // A single annotated paragraph is the grouping unit. Each reader's
  // original selected quote remains visible inside the grouped notes dialog.
  const normal = text => String(text || '').replace(/\s+/g, ' ').trim();
  const headings = article ? [...article.querySelectorAll('h2[id],h3[id],h4[id]')] : [];
  const blocks = article ? [...article.querySelectorAll('p,li,td,th,h2,h3,h4,blockquote')]
    .filter(node => !node.closest('.chapter-jump,pre,code,script,style') &&
      !node.closest('.guide-feedback') &&
      !node.querySelector('p,li,td,th') &&
      normal(node.textContent).length > 3)
    .map(node => {
      let section = '';
      for (const heading of headings) {
        const relation = heading.compareDocumentPosition(node);
        if (heading === node || heading.contains(node) ||
            (relation & Node.DOCUMENT_POSITION_FOLLOWING)) section = heading.id;
        else break;
      }
      return {node, text:normal(node.textContent), section};
    }) : [];

  function locateParagraph(note) {
    const quote = normal(note.quote);
    if (!quote || !blocks.length) return null;
    const fragments = [quote, quote.slice(0, Math.min(75, quote.length))]
      .filter((fragment, index, all) => fragment.length >= 3 && all.indexOf(fragment) === index);
    let matched = [];
    for (const fragment of fragments) {
      matched = blocks.filter(block => block.text.includes(fragment));
      if (matched.length) break;
    }
    if (!matched.length) return null;
    // Prefer the recorded chapter and the tightest matching text block.
    matched.sort((a, b) =>
      Number(b.section === note.section_id) - Number(a.section === note.section_id) ||
      a.text.length - b.text.length);
    return matched[0].node;
  }
  function placeParagraphMarkers(notes) {
    const grouped = new Map();
    notes.forEach(note => {
      const node = locateParagraph(note);
      if (!node) return;
      if (!grouped.has(node)) grouped.set(node, []);
      grouped.get(node).push(note);
    });
    grouped.forEach((items, node) => {
      node.classList.add('guide-annotated-paragraph');
      const mark = create('button', 'guide-annotation-marker',
        '💬 ' + items.length + ' 則留言');
      mark.type = 'button';
      mark.setAttribute('aria-haspopup', 'dialog');
      mark.setAttribute('aria-label','查看這一段的 ' + items.length + ' 則讀者留言');
      mark.addEventListener('click', event => {
        event.stopPropagation();
        notesText.textContent = normal(node.textContent.replace(mark.textContent, '')).slice(0, 450);
        notesList.replaceChildren(...items.map(item => renderNote(item)));
        notesDialog.showModal();
      });
      node.append(mark);
    });
  }
  async function loadComments() {
    try {
      const notes = [];
      let offset = 0, hasMore = true, pages = 0;
      while (hasMore && pages < 20) {
        const result = await requestList(entry.dataset.entryId, offset, 30);
        notes.push(...result.items);
        offset += result.items.length;
        hasMore = result.has_more && result.items.length > 0;
        pages++;
      }
      list.replaceChildren();
      if (!notes.length) {
        list.append(create('p', 'guide-feedback-empty', '還沒有公開的留言，歡迎提出第一個問題或補充。'));
      } else {
        notes.slice(0, 20).forEach(note => list.append(renderNote(note)));
        placeParagraphMarkers(notes);
      }
      if (notes.length > 20 || hasMore) {
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

  // Selecting text is a normal reading behavior. Never display the note
  // control on selectionchange, mouseup, scroll, or while the mouse is dragging.
  // Desktop: hover the already selected characters.
  // Touch: select first, then tap the same highlighted characters again.
  let hideDelay = null;
  let touchCandidate = null;
  function cancelHide() {
    if (hideDelay !== null) clearTimeout(hideDelay);
    hideDelay = null;
  }
  function hideAction() {
    cancelHide();
    action.hidden = true;
  }
  function scheduleHide() {
    if (action.hidden || hideDelay !== null) return;
    // Permit moving across the small gap between highlighted text and button.
    hideDelay = setTimeout(() => {
      hideDelay = null;
      action.hidden = true;
    }, 380);
  }
  function readSelection() {
    if (!article || dialog.open || notesDialog.open) return null;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) return null;
    const range = selection.getRangeAt(0);
    const startNode = range.startContainer;
    const endNode = range.endContainer;
    const parent = startNode.nodeType === Node.ELEMENT_NODE ? startNode : startNode.parentElement;
    const endParent = endNode.nodeType === Node.ELEMENT_NODE ? endNode : endNode.parentElement;
    // Select headings, paragraphs, tables and emphasis, but not controls,
    // links or chapter navigation.
    const blocked = 'button, input, textarea, select, a, pre, code, script, style, [contenteditable], .chapter-jump, .guide-annotation-marker';
    if (!article.contains(parent) || !article.contains(endParent) ||
        parent?.closest(blocked) || endParent?.closest(blocked)) return null;
    const quote = selection.toString().replace(/\s+/g, ' ').trim();
    if (quote.length < 2) return null;
    const excerpt = quote.slice(0, 300);
    let section = '';
    for (const heading of article.querySelectorAll('h2[id],h3[id],h4[id]')) {
      const relation = heading.compareDocumentPosition(startNode);
      if (heading === startNode || heading.contains(startNode) ||
          (relation & Node.DOCUMENT_POSITION_FOLLOWING)) section = heading.id;
      else break;
    }
    const context = parent?.textContent || '';
    const at = Math.max(0, Math.min(context.length,
      startNode.nodeType === Node.TEXT_NODE ? range.startOffset : 0));
    const rects = [...range.getClientRects()].filter(r =>
      Number.isFinite(r.left) && r.width > 1 && r.height > 1);
    if (!rects.length) return null;
    return {
      data: {
        quote: excerpt, section_id: section,
        context_before: context.slice(Math.max(0, at - 60), at),
        context_after: context.slice(at, at + 60)
      },
      rects
    };
  }
  function withinSelection(info, x, y) {
    return info.rects.some(rect =>
      x >= rect.left - 1 && x <= rect.right + 1 &&
      y >= rect.top - 1 && y <= rect.bottom + 1);
  }
  function revealAction(info, x, y) {
    cancelHide();
    current = { ...info.data };
    if (!action.hidden) return;
    // Anchor close to the character being hovered/tapped, not to the end
    // of an arbitrarily long selection.
    action.style.top = Math.max(10, Math.min(window.innerHeight - 65, y + 13)) + 'px';
    action.style.left = Math.max(10, Math.min(window.innerWidth - 245, x + 12)) + 'px';
    action.hidden = false;
  }
  document.addEventListener('selectionchange', hideAction);
  document.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    if (event.buttons !== 0) return hideAction();
    if (action.contains(event.target)) return cancelHide();
    if (!article?.contains(event.target)) return scheduleHide();
    const info = readSelection();
    if (info && withinSelection(info, event.clientX, event.clientY)) {
      revealAction(info, event.clientX, event.clientY);
    } else {
      scheduleHide();
    }
  }, { passive:true });
  document.addEventListener('pointerdown', event => {
    if (!action.contains(event.target)) hideAction();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' || event.key.startsWith('Arrow') || event.key === 'Shift') {
      hideAction();
    }
  });
  document.addEventListener('scroll', hideAction, { capture:true, passive:true });
  // No hover on phones: the first long-press/drag only selects text. A later
  // short tap inside an existing selection explicitly requests the action.
  article?.addEventListener('touchstart', event => {
    touchCandidate = null;
    if (event.touches.length !== 1) return;
    const point = event.touches[0];
    const info = readSelection();
    if (info && withinSelection(info, point.clientX, point.clientY)) {
      touchCandidate = { x: point.clientX, y: point.clientY, info };
    }
  }, { passive:true });
  article?.addEventListener('touchmove', () => {
    touchCandidate = null;
  }, { passive:true });
  article?.addEventListener('touchend', event => {
    const candidate = touchCandidate;
    touchCandidate = null;
    const point = event.changedTouches[0];
    if (!candidate || !point ||
        Math.hypot(point.clientX - candidate.x, point.clientY - candidate.y) > 12) return;
    // Let the browser finish its native selection interaction before showing
    // the action. The captured quote remains available even if a tap collapses it.
    setTimeout(() => revealAction(candidate.info, candidate.x, candidate.y), 50);
  }, { passive:true });
  action.addEventListener('pointerdown', event => event.preventDefault());
  action.addEventListener('pointerenter', cancelHide);
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
      const isNetworkError = error instanceof TypeError ||
        /failed to fetch|networkerror|load failed|network request failed/i.test(String(error?.message || ''));
      if (isNetworkError) {
        const insecure = location.protocol !== 'https:';
        showMessage(insecure
          ? '目前網站使用非 HTTPS 連線，留言服務僅允許安全網址。請改用 https://guide.mountcounty.com/ 再試。'
          : '留言 API 連線失敗，可能是跨網域權限（CORS）或暫時的網路問題。可點選「檢查留言連線」找出是哪一步失敗。',
          true);
        const debug = entry.querySelector('[data-feedback-debug]');
        if (debug) debug.hidden = false;
      } else {
        showMessage(error.message || '留言暫時無法送出，請稍後重試。', true);
      }
    } finally {
      if (widgetId !== null && window.turnstile) window.turnstile.reset(widgetId);
      submitButton.disabled = false;
    }
  });
  loadComments();
})();
