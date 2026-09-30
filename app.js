(function () {
  const STORAGE_PREFIX = 'hizbulAzam:';
  const speedKey = STORAGE_PREFIX + 'playbackSpeed';
  const lastKey = STORAGE_PREFIX + 'lastPosition';
  const installKey = STORAGE_PREFIX + 'installDismissed';

  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (_) { return fallback; }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  function getSpeed() {
    const speed = Number(localStorage.getItem(speedKey));
    return [1, 1.5, 2].includes(speed) ? speed : 1;
  }

  function setSpeed(speed) {
    localStorage.setItem(speedKey, String(speed));
  }

  function setupAudio() {
    const audio = document.querySelector('audio[data-day]');
    if (!audio) return;

    const day = audio.dataset.day;
    const positionKey = STORAGE_PREFIX + 'audio:' + day;
    const saved = Number(localStorage.getItem(positionKey));
    const speedButton = document.getElementById('speed-control');

    audio.playbackRate = getSpeed();
    if (speedButton) speedButton.textContent = audio.playbackRate + '×';

    audio.addEventListener('loadedmetadata', function () {
      if (Number.isFinite(saved) && saved > 0 && saved < audio.duration - 2) {
        audio.currentTime = saved;
      }
    }, { once: true });

    let lastSaved = 0;
    audio.addEventListener('timeupdate', function () {
      if (audio.currentTime - lastSaved < 4) return;
      lastSaved = audio.currentTime;
      try { localStorage.setItem(positionKey, String(audio.currentTime)); } catch (_) {}
    });

    audio.addEventListener('pause', function () {
      try { localStorage.setItem(positionKey, String(audio.currentTime)); } catch (_) {}
    });

    audio.addEventListener('ended', function () {
      try { localStorage.removeItem(positionKey); } catch (_) {}
    });

    if (speedButton) {
      speedButton.addEventListener('click', function () {
        const current = audio.playbackRate;
        const next = current === 1 ? 1.5 : current === 1.5 ? 2 : 1;
        audio.playbackRate = next;
        setSpeed(next);
        speedButton.textContent = next + '×';
        speedButton.setAttribute('aria-label', 'Playback speed ' + next + ' times. Tap to change.');
      });
    }
  }

  window.HizbulAzam = window.HizbulAzam || {};
  window.HizbulAzam.saveLastPosition = function (day, page) {
    const data = readJSON(lastKey, {});
    data.day = day;
    data.page = page;
    data.updated = Date.now();
    writeJSON(lastKey, data);
  };

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

    window.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault();
      deferredPrompt = event;
      card.hidden = false;
    });

    button.addEventListener('click', async function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch (_) {}
      deferredPrompt = null;
      card.hidden = true;
    });

    window.addEventListener('appinstalled', function () {
      card.hidden = true;
    });
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
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
          ]
        }, [messageChannel.port2]);
      });

      const cache = await caches.open('hizbul-azam-content-v1');
      const pdfCached = await cache.match(new URL(pdfUrl, location.href).href);
      const audioCached = await cache.match(new URL(audioUrl, location.href).href);
      if (pdfCached && audioCached) setState('Available without internet', true);
    } catch (_) {}
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }

  setupAudio();
  setupContinueCard();
  setupInstall();
  setupFullscreen();
  setupOffline();
  registerServiceWorker();
})();
