(function () {
  'use strict';

  const PREFIX = 'hizbulAzam:';
  const COMPLETED_KEY = PREFIX + 'completed';

  function read(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value == null ? fallback : JSON.parse(value);
    } catch (_) {
      return fallback;
    }
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  function progressKey(day) { return PREFIX + 'progress:' + day; }
  function completions() { return read(COMPLETED_KEY, {}) || {}; }
  function isComplete(day) { return Boolean(completions()[day]); }

  function getProgress(day) {
    const data = read(progressKey(day), {}) || {};
    return Math.round(Math.max(
      0,
      Math.min(100, Number(data.percent) || 0),
      Math.min(100, Number(data.page) || 0),
      Math.min(100, Number(data.audio) || 0)
    ));
  }

  function saveProgress(day, source, value) {
    const next = Math.round(Math.max(0, Math.min(100, Number(value) || 0)));
    const key = progressKey(day);
    const data = read(key, {}) || {};
    const previous = Number(data[source]) || 0;
    if (next <= previous && Number(data.percent) >= getProgress(day)) return;

    data[source] = Math.max(previous, next);
    data.percent = Math.max(
      Number(data.percent) || 0,
      Number(data.page) || 0,
      Number(data.audio) || 0
    );
    data.updated = Date.now();
    write(key, data);
    renderDay(day);
    renderHome();
  }

  function complete(day, source) {
    if (isComplete(day)) return;
    const all = completions();
    all[day] = { at: Date.now(), source: source || 'portion' };
    write(COMPLETED_KEY, all);
    saveProgress(day, source === 'audio' ? 'audio' : 'page', 100);
    renderDay(day);
    renderHome();
  }

  function undo(day) {
    const all = completions();
    if (!all[day]) return;
    delete all[day];
    write(COMPLETED_KEY, all);
    renderDay(day);
    renderHome();
  }

  function renderHome() {
    document.querySelectorAll('.day-tile[data-day]').forEach(function (tile) {
      const day = tile.dataset.day;
      const target = tile.querySelector('[data-day-progress]');
      if (!target) return;
      const done = isComplete(day);
      const pct = getProgress(day);
      target.textContent = done ? '✓ Shukr · completed' : pct + '%';
      target.classList.toggle('is-complete', done);
      tile.classList.toggle('is-complete', done);
      const name = tile.querySelector('.day-name')?.textContent || day;
      tile.setAttribute('aria-label', name + (done ? ' — completed' : ' — ' + pct + '% complete'));
    });
  }

  function renderDay(day) {
    const box = document.getElementById('completion-status');
    if (!box || box.dataset.day !== day) return;

    const done = isComplete(day);
    const pct = getProgress(day);
    box.classList.toggle('is-complete', done);

    if (done) {
      box.innerHTML = '<span class="completion-mark" aria-hidden="true">✓</span>' +
        '<span><strong>Shukr · completed</strong><small>This portion is complete.</small></span>' +
        '<button type="button" class="completion-undo">Undo</button>';
      box.querySelector('.completion-undo').addEventListener('click', function () {
        undo(day);
      });
    } else {
      box.innerHTML = '<span class="completion-percent" aria-hidden="true">' + pct + '%</span>' +
        '<span><strong>' + pct + '% complete</strong><small>Keep going at your own pace.</small></span>';
    }
  }

  function initReader() {
    const audio = document.querySelector('audio[data-day]');
    const viewer = document.getElementById('pdf-viewer');
    if (!audio || !viewer) return;

    const day = audio.dataset.day;
    const box = document.getElementById('completion-status');
    if (box) box.dataset.day = day;
    renderDay(day);

    function audioProgress() {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
      saveProgress(day, 'audio', audio.currentTime / audio.duration * 100);
    }

    audio.addEventListener('loadedmetadata', audioProgress);
    audio.addEventListener('durationchange', audioProgress);
    audio.addEventListener('timeupdate', audioProgress);
    audio.addEventListener('ended', function () {
      saveProgress(day, 'audio', 100);
      complete(day, 'audio');
    });

    window.addEventListener('hizbulAzam:pagechange', function (event) {
      const detail = event.detail || {};
      if (detail.day !== day || !Number(detail.total)) return;
      const pct = Number(detail.page) / Number(detail.total) * 100;
      saveProgress(day, 'page', pct);
      if (Number(detail.page) >= Number(detail.total)) complete(day, 'pages');
    });

    let scrollTimer = 0;
    window.addEventListener('scroll', function () {
      if (scrollTimer) return;
      scrollTimer = window.setTimeout(function () {
        scrollTimer = 0;
        const total = Number(document.getElementById('total-pages')?.textContent);
        const current = Number(document.getElementById('current-page')?.textContent);
        if (total > 0 && current >= total && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 24) {
          saveProgress(day, 'page', 100);
          complete(day, 'pages');
        }
      }, 100);
    }, { passive: true });
  }

  function init() {
    renderHome();
    initReader();
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('./sw.js?v=17', { updateViaCache: 'none' }).catch(function () {});
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.addEventListener('storage', function (event) {
    if (event.key === COMPLETED_KEY || (event.key && event.key.indexOf(PREFIX + 'progress:') === 0)) {
      renderHome();
      const audio = document.querySelector('audio[data-day]');
      if (audio) renderDay(audio.dataset.day);
    }
  });
})();
