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
    if (!restoring) savePage(pageNumber);
  }

  function updateZoomLabel() {
    if (zoomLevel) zoomLevel.textContent = Math.round(zoom * 100) + '%';
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
      const data = JSON.parse(localStorage.getItem('hizbulAzam:lastPosition') || 'null');
      if (!data || data.day !== day) return 1;
      return Math.max(1, Number(data.page) || 1);
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
