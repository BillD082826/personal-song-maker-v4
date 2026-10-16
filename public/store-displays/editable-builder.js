'use strict';
(() => {
  const ids = ['birthday','anniversary','wedding','retirement','graduation','mothers-day','fathers-day','christmas','valentines-day','congratulations','thank-you','memorial-tribute','just-for-fun','other'];
  const $ = id => document.getElementById(id);
  const key = 'lyribop-store-display-wording-v1';
  let request = 0;
  window.getEditableStoreDisplayDesign = id => {
    if (!ids.includes(id)) throw new Error('Choose an available display template.');
    const design = { collectionId: 'custom', designId: id, fileLabel: 'Editable-' + id };
    for (const [field, element, limit] of [['headline','editableStoreHeadline',80],['message','editableStoreMessage',160],['cta','editableStoreCta',42]]) {
      const value = $(element).value.trim();
      if ((!value && field !== 'message') || value.length > limit) throw new Error('Enter valid display wording.');
      design[field] = value;
    }
    return design;
  };
  function drawBlock(ctx, text, y, height, size, width, center = 600) {
    if (!text) return;
    let lines;
    while (size >= 24) {
      ctx.font = `bold ${size}px Arial`;
      lines = []; let line = '';
      for (const word of text.split(/\s+/)) {
        const candidate = line ? line + ' ' + word : word;
        if (ctx.measureText(candidate).width > width && line) { lines.push(line); line = ''; }
        if (ctx.measureText(word).width > width) {
          for (const char of word) {
            if (ctx.measureText(line + char).width > width && line) { lines.push(line); line = ''; }
            line += char;
          }
        } else line = line ? line + ' ' + word : word;
      }
      if (line) lines.push(line.trim());
      if (lines.length * size * 1.2 <= height) break;
      size -= 2;
    }
    if (size < 24) throw new Error('Shorten the wording to fit the display.');
    ctx.fillStyle = '#fff4da'; ctx.textAlign = 'center';
    ctx.shadowColor = '#111'; ctx.shadowBlur = 5;
    lines.forEach((line, index) => ctx.fillText(line,center,y + size + index * size * 1.2));
    ctx.shadowBlur = 0;
  }
  window.renderEditableStoreDisplay = async (design, price, qr, code) => {
    if (!ids.includes(design.designId) || !Number.isFinite(Number(price)) || Number(price) <= 0) throw new Error('Display template or current price is unavailable.');
    const background = new Image();
    background.src = '/store-displays/builder/' + design.designId + '-background.png';
    await background.decode();
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 1800;
    window.LyriBopStoreDisplay.validateCanvas(canvas);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#15162c'; ctx.fillRect(0,0,1200,1800);
    ctx.drawImage(background,0,0,1200,1200);
    const shade = ctx.createLinearGradient(0,0,0,1100); shade.addColorStop(0,'rgba(10,15,30,.55)'); shade.addColorStop(1,'rgba(10,15,30,0)');
    ctx.fillStyle = shade; ctx.fillRect(0,0,1200,1100);
    drawBlock(ctx,'LyriBop ♪',50,100,76,1080);
    drawBlock(ctx,design.headline,180,230,86,1040);
    drawBlock(ctx,design.message,440,170,42,1000);
    // Opaque information band gives the price and scan instructions consistent contrast.
    ctx.fillStyle = '#15162c'; ctx.fillRect(0,950,1200,550);
    drawBlock(ctx,'PERSONALIZED SONG  ·  $' + Number(price).toFixed(2),970,85,48,1080);
    drawBlock(ctx,design.cta,1075,70,44,1080);
    ctx.fillStyle = '#fff'; ctx.fillRect(70,1170,310,310);
    ctx.drawImage(qr,85,1185,280,280);
    // Keep supporting wording to the right of the QR, with its own bounded wrap.
    drawBlock(ctx,'Hear your free preview first.',1190,100,34,650,790);
    drawBlock(ctx,'Scan to create your song',1310,100,36,650,790);
    if (code) { ctx.font='bold 23px Arial'; ctx.fillStyle='#fff';ctx.textAlign='right';ctx.fillText('Seller Code: '+code,1130,1460,700); }
    // Bottom 300px (one inch) deliberately contains no wording or QR code.
    return canvas;
  };
  window.refreshEditableStoreDisplay = async () => {
    const own = ++request, preview = $('editableStorePreview'), status = $('editableStoreStatus');
    if ($('storeDisplayCollection')?.value !== 'custom') return;
    preview.removeAttribute('src'); status.textContent = 'Updating preview…';
    try {
      const design = window.getEditableStoreDisplayDesign($('storeDisplayDesign').value);
      const code = $('storeDisplaySeller').value.trim();
      const qr = new Image();
      qr.src = code ? '/api/admin/sellers/'+encodeURIComponent(code)+'/qr' : '/api/admin/store-display/qr';
      await qr.decode();
      const canvas = await window.renderEditableStoreDisplay(design,$('storeDisplayPrice').textContent.trim(),qr,code);
      if (own !== request || $('storeDisplayCollection').value !== 'custom') return;
      preview.src = canvas.toDataURL('image/png'); status.textContent='Preview ready. Use Print or Save 4 × 6 Image below.';
    } catch(error) { if (own === request) status.textContent=error.message; }
  };
  window.saveEditableStoreDraft = () => {
    try { const design=window.getEditableStoreDisplayDesign($('storeDisplayDesign').value); localStorage.setItem(key,JSON.stringify(design)); $('editableStoreStatus').textContent='Wording saved in this browser. Seller and current price are not saved.'; }
    catch(error) { $('editableStoreStatus').textContent=error.message; }
  };
  window.loadEditableStoreDraft = () => {
    try {
      const saved=JSON.parse(localStorage.getItem(key)||'null'); if(!saved || !ids.includes(saved.designId)) throw new Error('No saved wording found in this browser.');
      for(const [field,id,limit] of [['headline','editableStoreHeadline',80],['message','editableStoreMessage',160],['cta','editableStoreCta',42]]) { if(typeof saved[field] !== 'string' || saved[field].length>limit) throw new Error('Saved wording is invalid.'); $(id).value=saved[field]; }
      $('storeDisplayDesign').value=saved.designId; window.refreshEditableStoreDisplay();
    } catch(error) { $('editableStoreStatus').textContent=error.message; }
  };
  document.addEventListener('DOMContentLoaded',()=>{
    for(const id of ['editableStoreHeadline','editableStoreMessage','editableStoreCta']) $(id).addEventListener('input',window.refreshEditableStoreDisplay);
    new MutationObserver(()=>{ if($('storeDisplayCollection')?.value==='custom') window.refreshEditableStoreDisplay(); }).observe($('storeDisplayPrice'),{childList:true,characterData:true,subtree:true});
  });
})();
