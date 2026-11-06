/* Anonymous, per-article usefulness feedback. Only becomes visible after Worker + D1 are ready. */
(() => {
  'use strict';
  const panel = document.querySelector('[data-article-rating]');
  if (!panel) return;
  const api = (panel.dataset.api || '').replace(/\/$/, '');
  const entryId = panel.dataset.entryId || '';
  const entryTitle = panel.dataset.entryTitle || '';
  const buttons = [...panel.querySelectorAll('[data-rating-vote]')];
  const form = panel.querySelector('[data-rating-form]');
  const radios = [...panel.querySelectorAll('input[name="reason"]')];
  const submit = panel.querySelector('.guide-rating-submit');
  const status = panel.querySelector('[data-rating-status]');
  const correction = panel.querySelector('[data-rating-correction]');
  const savedKey = 'guide-article-rating:' + entryId;
  const visitorKey = 'guide-article-rating-browser-v1';
  let busy = false;
  let currentVote = '';
  let selectedVote = '';
  let token = '';
  const message = (value, error = false) => {
    status.textContent = value;
    status.classList.toggle('is-error', error);
  };
  function readSaved() {
    try {
      const value = JSON.parse(localStorage.getItem(savedKey) || 'null');
      return value && ['helpful', 'unresolved'].includes(value.vote) ? value : null;
    } catch { return null; }
  }
  function visitorToken() {
    try {
      const saved = localStorage.getItem(visitorKey);
      if (/^[a-f0-9]{64}$/.test(saved || '')) return saved;
    } catch {}
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const value = Array.from(raw, x => x.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem(visitorKey, value); } catch {}
    return value;
  }
  function mark(vote) {
    buttons.forEach(button =>
      button.setAttribute('aria-pressed', String(button.dataset.ratingVote === vote)));
  }
  function setBusy(value) {
    busy = value;
    buttons.forEach(button => { button.disabled = value; });
    updateSubmit();
  }
  function updateSubmit() {
    submit.disabled = busy || !radios.some(radio => radio.checked);
  }
  function showReasonForm() {
    form.hidden = selectedVote !== 'unresolved';
    if (form.hidden) correction.hidden = true;
    else correction.hidden = !radios.some(radio =>
      radio.checked && radio.value === 'possibly_outdated');
    updateSubmit();
  }
  async function save(vote, reason) {
    if (busy) return;
    setBusy(true);
    message('正在送出回饋……');
    try {
      const response = await fetch(api + '/api/ratings', {
        method:'POST', mode:'cors', cache:'no-store', credentials:'omit',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          entry_id:entryId, entry_title:entryTitle,
          vote, reason, visitor_token:token
        })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok !== true) {
        throw new Error(data?.error || '回饋暫時無法送出，請稍後重試。');
      }
      currentVote = vote;
      selectedVote = vote;
      mark(vote);
      try { localStorage.setItem(savedKey, JSON.stringify({vote,reason})); } catch {}
      form.hidden = true;
      correction.hidden = !(vote === 'unresolved' && reason === 'possibly_outdated');
      message('謝謝你的回饋！如需修改，可以重新選擇。');
    } catch (error) {
      message(error?.message || '回饋暫時無法送出，請稍後重試。', true);
    } finally {
      setBusy(false);
    }
  }
  buttons.forEach(button => button.addEventListener('click', () => {
    if (busy) return;
    selectedVote = button.dataset.ratingVote;
    mark(selectedVote);
    if (selectedVote === 'helpful') {
      form.hidden = true;
      correction.hidden = true;
      save('helpful', '');
    } else {
      message('');
      showReasonForm();
      if (currentVote === 'unresolved') {
        const previous = readSaved();
        radios.forEach(radio => { radio.checked = radio.value === previous?.reason; });
        showReasonForm();
      }
    }
  }));
  radios.forEach(radio => radio.addEventListener('change', showReasonForm));
  form.addEventListener('submit', event => {
    event.preventDefault();
    const reason = radios.find(radio => radio.checked)?.value;
    if (selectedVote !== 'unresolved' || !reason) {
      message('請先選擇一個原因。', true);
      return;
    }
    save('unresolved', reason);
  });
  async function initialize() {
    try {
      // Hide the widget completely until both the deployed Worker and D1 migration respond.
      const response = await fetch(api + '/api/ratings/availability', {
        method:'GET', mode:'cors', credentials:'omit', cache:'no-store'
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true || result.enabled !== true) return;
      token = visitorToken();
      const previous = readSaved();
      if (previous) {
        currentVote = previous.vote;
        selectedVote = previous.vote;
        mark(currentVote);
        radios.forEach(radio => { radio.checked = radio.value === previous.reason; });
        message('你已提供過回饋，如需修改可以重新選擇。');
      }
      panel.hidden = false;
    } catch {
      // Older Worker deployments must not display an unusable form.
    }
  }
  initialize();
})();
