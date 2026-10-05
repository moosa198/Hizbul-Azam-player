(function () {
  const viewer = document.getElementById('pdf-viewer');
  if (!viewer) return;

  const pdfUrl = viewer.dataset.pdf;
  const day = viewer.dataset.day || '';
  const status = document.getElementById('pdf-status');
  const fallback = document.getElementById('pdf-fallback');
  const currentPage = document.getElementById('current-page');
  const totalPages = document.getElementById('total-pages');
  const progressBar = document.getElementById('reading-progress');
  const zoomLevel = document.getElementById('zoom-level');

  let pdf;
  let pages = [];
  let firstPage;
  let resizeTimer;
  let zoom = 1;
  let restoring = true;

  function showError() {
    if (status) {
      status.textContent = 'The PDF could not be displayed here.';
      status.hidden = false;
    }
    if (fallback) fallback.hidden = false;
  }

  function savePage(pageNumber) {
    if (window.HizbulAzam && window.HizbulAzam.saveLastPosition) {
      window.HizbulAzam.saveLastPosition(day, pageNumber);
    }
  }

  function updateProgress(pageNumber, total) {
    if (currentPage) currentPage.textContent = pageNumber;
    if (totalPages) totalPages.textContent = total;
    if (progressBar) progressBar.style.width = ((pageNumber / total) * 100) + '%';
    window.dispatchEvent(new CustomEvent('hizbulAzam:pagechange', { detail: { day: day, page: pageNumber, total: total } }));
    if (!restoring) savePage(pageNumber);
  }

  function updateZoomLabel() {
    if (zoomLevel) zoomLevel.textContent = Math.round(zoom * 100) + '%';
  }


  function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) return [l, l, l];
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < .5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
    return [r, g, b];
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    const d = max - min;
    if (d) {
      s = l > .5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4;
      }
      h /= 6;
    }
    return [h, s, l];
  }

  function applyDarkPdfPalette(canvas) {
    if (document.documentElement.dataset.theme !== 'dark') return;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;

    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = image.data;
    const paper = [0x24, 0x27, 0x2b];
    const ink = [0xee, 0xec, 0xe7];

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const chroma = max - min;
      const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

      if (chroma < 22) {
        // Map white paper to neutral charcoal and black text to warm ivory.
        const t = 1 - luminance;
        data[i]     = Math.round(paper[0] + (ink[0] - paper[0]) * t);
        data[i + 1] = Math.round(paper[1] + (ink[1] - paper[1]) * t);
        data[i + 2] = Math.round(paper[2] + (ink[2] - paper[2]) * t);
      } else {
        // Preserve coloured accents while lifting them for dark backgrounds.
        let [h, s, l] = rgbToHsl(r, g, b);
        if (h > .08 && h < .18 && s > .18) {
          // Warm gold remains warm and readable.
          l = Math.min(.72, .48 + l * .35);
          s = Math.max(.38, Math.min(.72, s));
        } else if (h > .25 && h < .55 && s > .12) {
          // Cool/green artwork becomes a restrained neutral accent.
          h = .58;
          l = Math.min(.62, .34 + l * .45);
          s = Math.max(.28, Math.min(.58, s));
        } else {
          // Any other coloured artwork gets a restrained luminance lift.
          l = Math.min(.78, .30 + l * .48);
          s = Math.min(.65, s * .9);
        }
        const rgb = hslToRgb(h, s, l);
        data[i] = Math.round(rgb[0] * 255);
        data[i + 1] = Math.round(rgb[1] * 255);
        data[i + 2] = Math.round(rgb[2] * 255);
      }
    }
    context.putImageData(image, 0, 0);
  }

  function rerenderForTheme() {
    pages.forEach((wrap) => {
      if (wrap.dataset.rendered !== 'true') return;
      wrap.replaceChildren();
      delete wrap.dataset.rendered;
      renderPage(wrap);
    });
  }

  async function renderPage(wrap) {
    if (!pdf || wrap.dataset.loading === 'true') return;

    const number = Number(wrap.dataset.page);
    wrap.dataset.loading = 'true';

    try {
      const page = number === 1 ? firstPage : await pdf.getPage(number);
      const base = page.getViewport({ scale: 1 });
      const width = Math.max(240, wrap.clientWidth * zoom);
      const scale = width / base.width;
      const viewport = page.getViewport({ scale });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      const canvas = document.createElement('canvas');
      canvas.className = 'pdf-page';
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = Math.floor(viewport.width) + 'px';
      canvas.style.height = Math.floor(viewport.height) + 'px';

      const context = canvas.getContext('2d', { alpha: false });
      await page.render({
        canvasContext: context,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null
      }).promise;

      applyDarkPdfPalette(canvas);
      wrap.replaceChildren(canvas);
      wrap.dataset.rendered = 'true';
    } catch (error) {
      console.error(error);
      showError();
    } finally {
      delete wrap.dataset.loading;
    }
  }

  function rerenderRenderedPages() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      pages.forEach((wrap) => {
        if (wrap.dataset.rendered !== 'true') return;
        wrap.replaceChildren();
        delete wrap.dataset.rendered;
        renderPage(wrap);
      });
    }, 160);
  }

  function setZoom(next) {
    zoom = Math.max(0.75, Math.min(2, Number(next.toFixed(2))));
    updateZoomLabel();
    rerenderRenderedPages();
  }

  window.addEventListener('hizbulAzam:themechange', rerenderForTheme);

  function setupPdfControls() {
    const controls = document.getElementById('pdf-controls');
    if (!controls) return;
    controls.addEventListener('click', (event) => {
      const button = event.target.closest('[data-pdf-action]');
      if (!button) return;
      const action = button.dataset.pdfAction;
      if (action === 'zoom-out') setZoom(zoom - 0.1);
      if (action === 'zoom-in') setZoom(zoom + 0.1);
      if (action === 'fit') setZoom(1);
    });
    updateZoomLabel();
  }

  function getSavedPage() {
    try {
      const data = JSON.parse(localStorage.getItem('hizbulAzam:page:' + day) || 'null');
      return Math.max(1, Number(data && data.page) || 1);
    } catch (_) { return 1; }
  }

  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';

  script.onload = async function () {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      pdf = await pdfjsLib.getDocument(pdfUrl).promise;
      const total = pdf.numPages;

      if (status) status.remove();
      updateProgress(1, total);

      firstPage = await pdf.getPage(1);
      const firstViewport = firstPage.getViewport({ scale: 1 });
      const fragment = document.createDocumentFragment();

      for (let number = 1; number <= total; number++) {
        const wrap = document.createElement('div');
        wrap.className = 'pdf-page-wrap';
        wrap.dataset.page = number;
        wrap.style.aspectRatio = `${firstViewport.width} / ${firstViewport.height}`;
        wrap.setAttribute('aria-label', 'Page ' + number + ' of ' + total);

        const loading = document.createElement('div');
        loading.className = 'page-loading';
        loading.textContent = 'Page ' + number;
        wrap.appendChild(loading);

        fragment.appendChild(wrap);
        pages.push(wrap);
      }

      viewer.appendChild(fragment);

      const renderObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) renderPage(entry.target);
        });
      }, {
        root: null,
        rootMargin: '1200px 0px',
        threshold: 0.01
      });

      pages.forEach((page) => renderObserver.observe(page));

      const progressObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            updateProgress(Number(entry.target.dataset.page), total);
            restoring = false;
          }
        });
      }, {
        root: null,
        rootMargin: '-30% 0px -55% 0px',
        threshold: 0
      });

      pages.forEach((page) => progressObserver.observe(page));

      setupPdfControls();
      await renderPage(pages[0]);

      const savedPage = getSavedPage();
      if (savedPage > 1 && savedPage <= total) {
        requestAnimationFrame(() => {
          pages[savedPage - 1].scrollIntoView({ block: 'start', behavior: 'auto' });
          updateProgress(savedPage, total);
          restoring = false;
        });
      } else {
        restoring = false;
        savePage(1);
      }

      if ('ResizeObserver' in window) {
        const resizeObserver = new ResizeObserver(rerenderRenderedPages);
        resizeObserver.observe(viewer);
      } else {
        window.addEventListener('resize', rerenderRenderedPages, { passive: true });
      }
    } catch (error) {
      console.error(error);
      showError();
    }
  };

  script.onerror = showError;
  document.head.appendChild(script);
})();
