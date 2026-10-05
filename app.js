(function () {
  const STORAGE_PREFIX = 'hizbulAzam:';
  const completionKey = STORAGE_PREFIX + 'completed';
  const speedKey = STORAGE_PREFIX + 'playbackSpeed';
  const lastKey = STORAGE_PREFIX + 'lastPosition';
  const installKey = STORAGE_PREFIX + 'installDismissed';

  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (_) { return fallback; }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }



  function setupTheme() {
    const root = document.documentElement;
    const key = STORAGE_PREFIX + 'theme';
    let saved = null;
    try { saved = localStorage.getItem(key); } catch (_) {}
    const initial = saved === 'dark' || saved === 'light'
      ? saved
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

    root.dataset.theme = initial;

    const meta = document.querySelector('meta[name="theme-color"]');
    const updateMeta = () => {
      if (meta) meta.setAttribute('content', root.dataset.theme === 'dark' ? '#17191c' : '#f6f3eb');
    };

    const host = document.querySelector('.home-header') || document.querySelector('.topbar');
    if (!host) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-toggle';
    button.setAttribute('aria-label', 'Switch to dark mode');
    button.title = 'Switch to dark mode';

    function updateButton() {
      const dark = root.dataset.theme === 'dark';
      button.textContent = dark ? '☀' : '◐';
      button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      button.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
    }

    button.addEventListener('click', function () {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem(key, next); } catch (_) {}
      updateButton();
      updateMeta();
      window.dispatchEvent(new CustomEvent('hizbulAzam:themechange', { detail: { theme: next } }));
    });

    host.appendChild(button);
    updateButton();
    updateMeta();
  }

  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  function getSpeed() {
    const speed = Number(localStorage.getItem(speedKey));
    return SPEEDS.includes(speed) ? speed : 1;
  }

  function setSpeed(speed) {
    try { localStorage.setItem(speedKey, String(speed)); } catch (_) {}
  }


  function setupAudio() {
    const audio = document.querySelector('audio[data-day]');
    if (!audio) return;

    const day = audio.dataset.day;
    const positionKey = STORAGE_PREFIX + 'audio:' + day;
    const saved = Number(localStorage.getItem(positionKey));
    const speedButton = document.getElementById('speed-control');
    const playButton = document.getElementById('play-control');
    const progress = document.getElementById('audio-progress');
    const currentTime = document.getElementById('current-time');
    const duration = document.getElementById('duration');
    const progressFill = document.getElementById('audio-progress-fill');
    const progressThumb = document.getElementById('audio-progress-thumb');

    function formatTime(value) {
      if (!Number.isFinite(value) || value < 0) return '0:00';
      const totalSeconds = Math.floor(value);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      if (hours) return hours + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
      return minutes + ':' + String(seconds).padStart(2, '0');
    }

    function updateProgress() {
      if (!progress) return;
      const value = Number.isFinite(audio.duration) && audio.duration > 0
        ? (audio.currentTime / audio.duration) * 100
        : 0;
      const clamped = Math.max(0, Math.min(100, value));
      progress.value = String(clamped);
      progress.style.setProperty('--progress', clamped + '%');
      if (progressFill) progressFill.style.width = clamped + '%';
      if (progressThumb) progressThumb.style.left = clamped + '%';
      if (currentTime) currentTime.textContent = formatTime(audio.currentTime);
      if (duration) duration.textContent = formatTime(audio.duration);
    }

    function updatePlayButton() {
      if (!playButton) return;
      const playing = !audio.paused && !audio.ended;
      playButton.textContent = playing ? '❚❚' : '▶';
      playButton.setAttribute('aria-label', playing ? 'Pause audio' : 'Play audio');
    }

    let lastSaved = 0;

    audio.playbackRate = getSpeed();
    if (speedButton) speedButton.textContent = audio.playbackRate + '×';

    audio.addEventListener('loadedmetadata', function () {
      if (Number.isFinite(saved) && saved > 0 && saved < audio.duration - 2) {
        audio.currentTime = saved;
      }
      updateProgress();
    }, { once: true });

    audio.addEventListener('timeupdate', function () {
      updateProgress();
      if (audio.currentTime - lastSaved < 4) return;
      lastSaved = audio.currentTime;
      try { localStorage.setItem(positionKey, String(audio.currentTime)); } catch (_) {}
    });

    audio.addEventListener('durationchange', updateProgress);
    audio.addEventListener('play', updatePlayButton);
    audio.addEventListener('pause', updatePlayButton);
    audio.addEventListener('ended', function () {
      updatePlayButton();
      updateProgress();
      try { localStorage.removeItem(positionKey); } catch (_) {}
    });

    audio.addEventListener('pause', function () {
      try { localStorage.setItem(positionKey, String(audio.currentTime)); } catch (_) {}
    });

    if (playButton) {
      playButton.addEventListener('click', function () {
        if (audio.paused) audio.play().catch(function () {});
        else audio.pause();
      });
    }

    if (progress) {
      progress.addEventListener('input', function () {
        if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
        audio.currentTime = (Number(progress.value) / 100) * audio.duration;
        updateProgress();
      });
    }

    // A dedicated restart control is easier to discover and use than relying
    // on dragging the progress thumb all the way back to zero.
    if (playButton) {
      const restartButton = document.createElement('button');
      restartButton.type = 'button';
      restartButton.className = 'restart-control';
      restartButton.textContent = '↺';
      restartButton.setAttribute('aria-label', 'Restart audio from the beginning');
      restartButton.title = 'Restart audio';
      playButton.insertAdjacentElement('afterend', restartButton);

      restartButton.addEventListener('click', function () {
        audio.currentTime = 0;
        try { localStorage.removeItem(positionKey); } catch (_) {}
        updateProgress();
        if (audio.paused) audio.play().catch(function () {});
      });
    }

    if (speedButton) {
      const menu = document.createElement('div');
      menu.className = 'speed-menu';
      menu.hidden = true;
      menu.setAttribute('role', 'menu');
      menu.setAttribute('aria-label', 'Playback speed');

      SPEEDS.forEach(function (speed) {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'speed-option';
        option.textContent = speed + '×';
        option.setAttribute('role', 'menuitemradio');
        option.setAttribute('aria-checked', String(audio.playbackRate === speed));
        option.addEventListener('click', function () {
          audio.playbackRate = speed;
          setSpeed(speed);
          updateSpeedMenu();
          menu.hidden = true;
          speedButton.focus();
        });
        menu.appendChild(option);
      });

      speedButton.parentElement.appendChild(menu);

      function updateSpeedMenu() {
        speedButton.textContent = audio.playbackRate + '×';
        speedButton.setAttribute('aria-label', 'Playback speed ' + audio.playbackRate + ' times. Open speed options.');
        Array.from(menu.children).forEach(function (option) {
          option.setAttribute('aria-checked', String(Number(option.textContent.replace('×', '')) === audio.playbackRate));
        });
      }

      speedButton.addEventListener('click', function () {
        menu.hidden = !menu.hidden;
        updateSpeedMenu();
      });

      document.addEventListener('click', function (event) {
        if (!speedButton.parentElement.contains(event.target)) menu.hidden = true;
      });

      updateSpeedMenu();
    }

    updatePlayButton();
    updateProgress();
    document.body.classList.add('js-audio-ready');
  }

  window.HizbulAzam = window.HizbulAzam || {};
  window.HizbulAzam.saveLastPosition = function (day, page) {
    const data = readJSON(lastKey, {});
    data.day = day;
    data.page = page;
    data.updated = Date.now();
    writeJSON(lastKey, data);
  };

  function getCompletions() {
    return readJSON(completionKey, {});
  }

  function isDayComplete(day) {
    return Boolean(getCompletions()[day]);
  }

  function getDayProgress(day) {
    const data = readJSON(STORAGE_PREFIX + 'progress:' + day, {});
    return Math.round(Math.max(0, Math.min(100, Number(data && data.percent) || 0), Number(data && data.page) || 0, Number(data && data.audio) || 0));
  }

  function updateHomeCompletion() {
    document.querySelectorAll('.day-tile[data-day]').forEach(function (tile) {
      const day = tile.dataset.day;
      const target = tile.querySelector('[data-day-progress]');
      if (!target) return;
      const done = isDayComplete(day);
      target.textContent = done ? '✓ Shukr · completed' : getDayProgress(day) + '%';
      target.classList.toggle('is-complete', done);
    });
  }

  function updateCompletionUI(day) {
    const box = document.getElementById('completion-status');
    if (!box || box.dataset.day !== day) return;
    const done = isDayComplete(day);
    const pct = getDayProgress(day);
    box.classList.toggle('is-complete', done);
    box.innerHTML = done
      ? '<span class="completion-mark" aria-hidden="true">✓</span><span><strong>Shukr · completed</strong><small>This portion is complete.</small></span><button type="button" class="completion-undo" id="completion-undo">Undo</button>'
      : '<span class="completion-percent" aria-hidden="true">' + pct + '%</span><span><strong>' + pct + '% complete</strong><small>Keep going at your own pace.</small></span>';
    const undo = box.querySelector('#completion-undo');
    if (undo) {
      undo.addEventListener('click', function () {
        const all = getCompletions();
        delete all[day];
        writeJSON(completionKey, all);
        updateCompletionUI(day);
        updateHomeCompletion();
      });
    }
  }

  function setDayComplete(day, source) {
    if (isDayComplete(day)) return;
    const all = getCompletions();
    all[day] = { at: Date.now(), source: source || 'portion' };
    writeJSON(completionKey, all);
    const progress = readJSON(STORAGE_PREFIX + 'progress:' + day, {});
    progress.percent = 100;
    progress.updated = Date.now();
    writeJSON(STORAGE_PREFIX + 'progress:' + day, progress);
    updateCompletionUI(day);
    updateHomeCompletion();
  }

  function updateDayProgress(day, percent, source) {
    const next = Math.round(Math.max(0, Math.min(100, Number(percent) || 0)));
    const key = STORAGE_PREFIX + 'progress:' + day;
    const data = readJSON(key, {});
    if (source) data[source] = Math.max(Number(data[source]) || 0, next);
    const furthest = Math.max(Number(data.page) || 0, Number(data.audio) || 0, Number(data.percent) || 0);
    if (data.percent === furthest && (!source || data[source] === next)) return;
    data.percent = Math.round(furthest);
    data.updated = Date.now();
    writeJSON(key, data);
    updateCompletionUI(day);
    updateHomeCompletion();
  }

  function setupCompletion() {
    const audio = document.querySelector('audio[data-day]');
    const viewer = document.getElementById('pdf-viewer');
    const day = audio ? audio.dataset.day : viewer ? viewer.dataset.day : '';
    if (!day) return;

    const box = document.getElementById('completion-status');
    if (box) {
      box.dataset.day = day;
      updateCompletionUI(day);
    }

    if (audio) {
      const syncAudio = function () {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          updateDayProgress(day, audio.currentTime / audio.duration * 100, 'audio');
        }
      };
      audio.addEventListener('loadedmetadata', syncAudio);
      audio.addEventListener('timeupdate', syncAudio);
      audio.addEventListener('ended', function () {
        updateDayProgress(day, 100, 'audio');
        setDayComplete(day, 'audio');
      });
    }

    window.addEventListener('hizbulAzam:pagechange', function (event) {
      if (!event.detail || event.detail.day !== day) return;
      const pct = Number(event.detail.total) > 0
        ? Number(event.detail.page) / Number(event.detail.total) * 100
        : 0;
      updateDayProgress(day, pct, 'page');
    });

    // Page completion is an endpoint action, not a page-selection event.
    // A restored/saved final page must never count as newly completed.
    let pageScrollTimer = 0;
    window.addEventListener('scroll', function () {
      if (pageScrollTimer) return;
      pageScrollTimer = window.setTimeout(function () {
        pageScrollTimer = 0;
        const total = Number(document.getElementById('total-pages')?.textContent);
        const current = Number(document.getElementById('current-page')?.textContent);
        if (total > 0 && current >= total &&
            window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 28) {
          updateDayProgress(day, 100, 'page');
          setDayComplete(day, 'pages');
        }
      }, 80);
    }, { passive: true });
  }

  function setupHomeDurations() {
    const tiles = document.querySelectorAll('.day-tile[data-audio]');
    if (!tiles.length) return;

    tiles.forEach(function (tile) {
      const target = tile.querySelector('[data-duration]');
      const src = tile.dataset.audio;
      if (!target || !src) return;

      const audio = new Audio();
      audio.preload = 'metadata';

      function formatEstimate(seconds) {
        if (!Number.isFinite(seconds) || seconds <= 0) return '';
        const minutes = Math.max(1, Math.round(seconds / 60));
        return '≈ ' + minutes + ' min';
      }

      audio.addEventListener('loadedmetadata', function () {
        const estimate = formatEstimate(audio.duration);
        if (estimate) target.textContent = estimate;
      }, { once: true });

      audio.addEventListener('error', function () {
        target.textContent = 'Audio available';
      }, { once: true });

      audio.src = src;
      audio.load();
    });
  }

  function setupContinueCard() {
    const card = document.getElementById('continue-card');
    if (!card) return;
    const data = readJSON(lastKey, null);
    if (!data || !data.day) return;

    const link = card.querySelector('[data-continue-link]');
    const label = card.querySelector('[data-continue-label]');
    if (!link || !label) return;

    const name = data.day.charAt(0).toUpperCase() + data.day.slice(1);
    link.href = data.day + '.html';
    label.textContent = 'Continue ' + name + (data.page ? ' · page ' + data.page : '');
    card.hidden = false;
  }

  function setupInstall() {
    let deferredPrompt = null;
    const card = document.getElementById('install-card');
    const button = document.getElementById('install-button');
    if (!card || !button) return;

    const isStandalone = () => {
      return window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.navigator.standalone === true;
    };

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isMacSafari = /macintosh/i.test(navigator.userAgent) && /safari/i.test(navigator.userAgent) && !/chrome|crios|android/i.test(navigator.userAgent);

    function showFallback() {
      if (isStandalone()) return;
      const copy = card.querySelector('span');
      if (copy) {
        copy.textContent = isIOS
          ? 'Use Share → Add to Home Screen.'
          : isMacSafari
            ? 'Use File → Add to Dock to install it as an app.'
            : 'Use your browser menu to Install or Add to Home screen.';
      }
      button.textContent = deferredPrompt ? 'Install' : 'How to install';
      card.hidden = false;
    }

    function hideCard() {
      card.hidden = true;
    }

    if (isStandalone()) {
      hideCard();
      return;
    }

    window.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault();
      deferredPrompt = event;
      showFallback();
    });

    button.addEventListener('click', async function () {
      if (deferredPrompt) {
        const promptEvent = deferredPrompt;
        deferredPrompt = null;
        try {
          await promptEvent.prompt();
          await promptEvent.userChoice;
        } catch (_) {}
        hideCard();
        return;
      }

      const message = isIOS
        ? 'To install Hizbul-Azam: tap Share, then choose “Add to Home Screen”.'
        : isMacSafari
          ? 'To install Hizbul-Azam: choose File → Add to Dock in Safari.'
          : 'To install Hizbul-Azam: open your browser menu and choose “Install app” or “Add to Home screen”. If you see an install icon in the address bar, you can use that instead.';
      window.alert(message);
    });

    window.addEventListener('appinstalled', hideCard);

    // Some browsers do not expose beforeinstallprompt even when manual
    // installation is available. Keep the in-page route discoverable.
    window.setTimeout(showFallback, 1400);
  }

  async function setupTranslation() {
    const viewer = document.getElementById('pdf-viewer');
    const button = document.getElementById('translation-control');
    if (!viewer || !button) return;

    const day = viewer.dataset.day;
    if (!day) return;

    const overlay = document.createElement('div');
    overlay.className = 'translation-overlay';
    overlay.hidden = true;

    const panel = document.createElement('aside');
    panel.className = 'translation-panel';
    panel.id = 'translation-panel';
    panel.setAttribute('aria-label', 'English translation');
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = `
      <div class="translation-panel-header">
        <div>
          <p class="translation-kicker">Translation</p>
          <h2>English</h2>
          <p class="translation-page" id="translation-page">Current Arabic page · 1</p>
        </div>
        <button type="button" class="translation-close" aria-label="Close translation">×</button>
      </div>
      <p class="translation-source">English translation from the supplied bilingual edition. Translation follows the portion in reading order.</p>
      <div class="translation-content" id="translation-content" tabindex="0">
        <p class="translation-loading">Loading translation…</p>
      </div>`;

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    const content = panel.querySelector('#translation-content');
    const pageLabel = panel.querySelector('#translation-page');
    const close = panel.querySelector('.translation-close');
    const storageKey = 'hizbulAzam:translationScroll:' + day;
    let loaded = false;
    let loading = false;
    let open = false;
    let currentPage = 1;
    let totalPages = 1;

    function saveTranslationScroll() {
      try { localStorage.setItem(storageKey, String(content.scrollTop)); } catch (_) {}
    }

    function restoreTranslationScroll() {
      let saved = 0;
      try { saved = Number(localStorage.getItem(storageKey) || 0); } catch (_) {}
      if (Number.isFinite(saved) && saved > 0) content.scrollTop = saved;
    }

    function updatePage(page, total) {
      currentPage = Math.max(1, Number(page) || 1);
      totalPages = Math.max(1, Number(total) || 1);
      if (pageLabel) pageLabel.textContent = 'Current Arabic page · ' + currentPage + ' of ' + totalPages;
      button.setAttribute('aria-label', 'Open English translation · Arabic page ' + currentPage + ' of ' + totalPages);
    }

    function closePanel() {
      saveTranslationScroll();
      open = false;
      panel.classList.remove('is-open');
      overlay.classList.remove('is-open');
      panel.setAttribute('aria-hidden', 'true');
      button.setAttribute('aria-expanded', 'false');
      button.classList.remove('is-active');
      setTimeout(function () { if (!open) overlay.hidden = true; }, 220);
      document.body.classList.remove('translation-open');
    }

    function openPanel() {
      open = true;
      overlay.hidden = false;
      requestAnimationFrame(function () {
        panel.classList.add('is-open');
        overlay.classList.add('is-open');
        if (loaded) restoreTranslationScroll();
      });
      panel.setAttribute('aria-hidden', 'false');
      button.setAttribute('aria-expanded', 'true');
      button.classList.add('is-active');
      document.body.classList.add('translation-open');
      if (!loaded && !loading) loadTranslation();
    }

    async function loadTranslation() {
      loading = true;
      try {
        const response = await fetch('translations/' + day + '.json', { cache: 'default' });
        if (!response.ok) throw new Error('Translation unavailable');
        const data = await response.json();
        const items = Array.isArray(data.items) ? data.items : [];
        content.innerHTML = '';
        if (!items.length) {
          content.innerHTML = '<p class="translation-empty">Translation is not available for this portion yet.</p>';
          return;
        }
        const fragment = document.createDocumentFragment();
        items.forEach(function (item) {
          const article = document.createElement('article');
          article.className = 'translation-entry';
          const text = document.createElement('p');
          text.textContent = item.text || '';
          article.appendChild(text);
          if (Array.isArray(item.references) && item.references.length) {
            const refs = document.createElement('p');
            refs.className = 'translation-reference';
            refs.textContent = 'References · ' + item.references.join(' · ');
            article.appendChild(refs);
          }
          fragment.appendChild(article);
        });
        content.appendChild(fragment);
        loaded = true;
        requestAnimationFrame(restoreTranslationScroll);
      } catch (_) {
        content.innerHTML = '<p class="translation-empty">The translation could not be loaded. Please reconnect to the internet and try again.</p>';
      } finally {
        loading = false;
      }
    }

    button.addEventListener('click', function () { open ? closePanel() : openPanel(); });
    close.addEventListener('click', closePanel);
    overlay.addEventListener('click', closePanel);
    content.addEventListener('scroll', function () {
      if (open) window.clearTimeout(content._saveTimer);
      content._saveTimer = window.setTimeout(saveTranslationScroll, 180);
    }, { passive: true });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && open) closePanel();
    });
    window.addEventListener('hizbulAzam:pagechange', function (event) {
      if (!event.detail || event.detail.day !== day) return;
      updatePage(event.detail.page, event.detail.total);
    });
    updatePage(1, Number(document.getElementById('total-pages')?.textContent) || 1);
  }

  function setupFullscreen() {
    const button = document.getElementById('focus-control');
    if (!button) return;

    button.addEventListener('click', async function () {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          await document.documentElement.requestFullscreen();
        }
      } catch (_) {
        document.body.classList.toggle('focus-mode');
      }
    });

    document.addEventListener('fullscreenchange', function () {
      document.body.classList.toggle('focus-mode', Boolean(document.fullscreenElement));
      button.textContent = document.fullscreenElement ? 'Exit focus' : 'Focus';
      button.setAttribute('aria-label', document.fullscreenElement ? 'Exit focus mode' : 'Enter focus mode');
    });
  }

  async function setupOffline() {
    const button = document.getElementById('offline-control');
    const status = document.getElementById('offline-status');
    const audio = document.querySelector('audio[data-day]');
    const viewer = document.getElementById('pdf-viewer');
    if (!button || !audio || !viewer || !('serviceWorker' in navigator)) return;

    const day = audio.dataset.day;
    const pdfUrl = viewer.dataset.pdf;
    const audioUrl = audio.querySelector('source')?.getAttribute('src');
    if (!audioUrl || !pdfUrl) return;

    function setState(text, done) {
      if (status) status.textContent = text;
      if (done) {
        button.hidden = true;
        button.disabled = true;
        button.classList.add('saved');
      }
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = function (event) {
        if (event.data && event.data.ok) setState('Available without internet', true);
        else setState('Could not save offline. Try again.');
      };

      button.addEventListener('click', function () {
        button.disabled = true;
        button.textContent = 'Saving…';
        registration.active.postMessage({
          type: 'CACHE_DAY',
          day,
          urls: [
            pdfUrl,
            audioUrl,
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
            'translations/' + day + '.json'
          ]
        }, [messageChannel.port2]);
      });

      const cache = await caches.open('hizbul-azam-content-v11');
      const pdfCached = await cache.match(new URL(pdfUrl, location.href).href);
      const audioCached = await cache.match(new URL(audioUrl, location.href).href);
      const translationCached = await cache.match(new URL('translations/' + day + '.json', location.href).href);
      if (pdfCached && audioCached && translationCached) setState('Available without internet', true);
    } catch (_) {}
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js?v=19', { updateViaCache: 'none' }).catch(function () {});
    });
  }

  setupTheme();
  setupAudio();
  setupCompletion();
  setupHomeDurations();
  updateHomeCompletion();
  setupContinueCard();
  setupInstall();
  setupTranslation();
  setupFullscreen();
  setupOffline();
  registerServiceWorker();
})();
