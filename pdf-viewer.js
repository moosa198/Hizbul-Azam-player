(function(){
  const viewer=document.getElementById('pdf-viewer');
  const pdfUrl=viewer && viewer.dataset.pdf;
  const status=document.getElementById('pdf-status');
  const fallback=document.getElementById('pdf-fallback');
  if(!viewer || !pdfUrl) return;

  function showError(){
    if(status) status.textContent='The PDF could not be displayed here. Please use the link below.';
    if(fallback) fallback.style.display='block';
  }

  const script=document.createElement('script');
  script.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  script.onload=async function(){
    try{
      pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const pdf=await pdfjsLib.getDocument(pdfUrl).promise;
      if(status) status.remove();
      for(let n=1;n<=pdf.numPages;n++){
        const page=await pdf.getPage(n);
        const wrap=document.createElement('div');
        wrap.className='pdf-page-wrap';
        const canvas=document.createElement('canvas');
        canvas.className='pdf-page';
        wrap.appendChild(canvas);
        viewer.appendChild(wrap);
        const base=page.getViewport({scale:1});
        const maxWidth=Math.min(viewer.clientWidth-12,900);
        const scale=maxWidth/base.width;
        const viewport=page.getViewport({scale});
        const dpr=window.devicePixelRatio||1;
        canvas.width=Math.floor(viewport.width*dpr);
        canvas.height=Math.floor(viewport.height*dpr);
        canvas.style.width=Math.floor(viewport.width)+'px';
        canvas.style.height=Math.floor(viewport.height)+'px';
        await page.render({canvasContext:canvas.getContext('2d'),viewport,transform:dpr!==1?[dpr,0,0,dpr,0,0]:null}).promise;
      }
    }catch(e){console.error(e);showError();}
  };
  script.onerror=showError;
  document.head.appendChild(script);
})();
