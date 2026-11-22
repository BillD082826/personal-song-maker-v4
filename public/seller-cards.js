/* Shared Admin/Seller Portal card gallery. Each print job resolves its own seller QR. */
(function (root) {
  'use strict';
  const designs = [
    { id: 'on-repeat', name: 'On Repeat', description: 'A record with heart.' },
    { id: 'backstage-pass', name: 'Backstage Pass', description: 'Your story gets star treatment.' },
    { id: 'wrapped-song', name: 'Wrapped in a Song', description: 'A gift full of memories.' }
  ];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function renderCard({design, monochrome = false, side, code, qrDataUrl = ''}) {
    if (!designs.some(d => d.id === design) || !['front', 'back'].includes(side)) throw new Error('Choose a card design and side.');
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) throw new Error('A valid seller referral code is required.');
    if (qrDataUrl && !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(qrDataUrl)) throw new Error('Could not load the seller QR.');
    const file = `/seller-cards/${design}-${monochrome ? 'black-and-white' : 'color'}-${side}.svg`;
    let overlay = '';
    if (side === 'back') {
      const q = design === 'on-repeat' ? [12,51,68] : design === 'backstage-pass' ? [18,48,68] : [12,49,70];
      overlay = `<image href="${qrDataUrl}" x="${q[0]}" y="${q[1]}" width="${q[2]}" height="${q[2]}"/>`;
      const label = `Seller: ${esc(code)}`;
      overlay += design === 'backstage-pass'
        ? `<text transform="translate(219 110) rotate(-90)" font-size="8" textLength="86" lengthAdjust="spacingAndGlyphs">${label}</text>`
        : `<text x="${design === 'on-repeat' ? 151 : 155}" y="129" font-size="7" textLength="${code.length > 14 ? 81 : 73}" lengthAdjust="spacingAndGlyphs">${label}</text>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 252 144" role="img" aria-label="${esc(design)} ${side} for seller ${esc(code)}" style="display:block;width:100%;height:auto;font-family:Arial,sans-serif;fill:${monochrome ? '#000' : '#201334'}"><image href="${file}" width="252" height="144"/>${overlay}</svg>`;
  }
  function buildPrintDocument(options) {
    const sides = options.sides === 'both' ? ['front','back'] : [options.sides];
    if (sides.some(s => !['front','back'].includes(s))) throw new Error('Choose fronts, backs, or both.');
    return `<!doctype html><html><head><meta charset="utf-8"><title>LyriBop seller cards - ${esc(options.code)}</title><style>
      @page{size:Letter;margin:0}*{box-sizing:border-box}body{margin:0;background:#eee;font-family:Arial,sans-serif}.toolbar{padding:16px;background:white;position:sticky;top:0;z-index:1}.toolbar button{padding:10px 18px;font-size:16px}.sheet{width:8.5in;height:11in;padding:.5in .75in;display:grid;grid-template-columns:3.5in 3.5in;grid-template-rows:repeat(5,2in);gap:0;background:white;break-after:page}.sheet:last-child{break-after:auto}.card{width:3.5in;height:2in;transform:translateY(-.125in);overflow:hidden}.card svg{width:3.5in;height:2in} @media print{body{background:white}.toolbar{display:none}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
      </style></head><body><div class="toolbar"><button id="print-cards" disabled>Loading artwork…</button><span> Avery 5876 · Actual Size / 100% · Test on plain paper first. Both sides: long-edge flip.</span></div>${sides.map(side=>`<section class="sheet">${Array.from({length:10},()=>`<div class="card">${renderCard({...options,side})}</div>`).join('')}</section>`).join('')}<script src="/seller-cards-print.js"></script></body></html>`;
  }
  function openChooser({seller, loadQr}) {
    const code = String(seller.referral_code || seller.referralCode || '').trim().toUpperCase();
    const dialog = document.createElement('dialog');
    dialog.style.cssText = 'width:min(1050px,94vw);max-height:90vh;padding:24px;border:1px solid #ddd;border-radius:18px;color:#211a33;background:white;overflow:auto';
    dialog.innerHTML = `<form method="dialog" style="float:right"><button aria-label="Close business cards">Close</button></form><h2>Seller business cards</h2><p>${esc(seller.name || '')} · <strong>${esc(code)}</strong></p><p>All three styles include this seller’s QR and referral code on the back.</p><label>Appearance <select id="card-appearance"><option value="color">Color</option><option value="mono">Black and white</option></select></label><label style="margin-left:16px">Print <select id="card-sides"><option value="both">Front and back (2 sheets)</option><option value="front">Fronts only</option><option value="back">Backs only</option></select></label><p id="card-status" role="status">Loading this seller’s QR…</p><div id="card-designs" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px"></div><p>Avery 5876 · 3½ × 2 inches · 10 cards per sheet. Print at 100% / Actual Size; test alignment on plain paper first.</p>`;
    document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
    let qrDataUrl = '';
    const status = dialog.querySelector('#card-status');
    function render() {
      const monochrome = dialog.querySelector('#card-appearance').value === 'mono';
      const holder = dialog.querySelector('#card-designs');holder.replaceChildren();
      for (const design of designs) {
        const article = document.createElement('article');article.style.cssText='border:1px solid #ddd;border-radius:12px;padding:12px';
        article.innerHTML = `<h3>${design.name}</h3><p>${design.description}</p>${renderCard({design:design.id,monochrome,side:'front',code,qrDataUrl})}<div style="height:8px"></div>${renderCard({design:design.id,monochrome,side:'back',code,qrDataUrl})}`;
        const button = document.createElement('button');button.type='button';button.textContent=`Print ${design.name}`;button.disabled=!qrDataUrl;button.style.marginTop='12px';
        button.addEventListener('click',()=>{
          const printWindow=window.open('','_blank');
          if(!printWindow){status.textContent='Please allow the print window to open, then try again.';return;}
          printWindow.document.write(buildPrintDocument({design:design.id,monochrome,code,qrDataUrl,sides:dialog.querySelector('#card-sides').value}));printWindow.document.close();
        });article.append(button);holder.append(article);
      }
    }
    dialog.querySelector('#card-appearance').addEventListener('change',render);
    Promise.resolve().then(loadQr).then(value=>{
      if(!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value))throw new Error('Could not load the seller QR.');
      qrDataUrl=value;status.textContent='Choose a design below. Each preview shows the front and back.';render();
    }).catch(error=>{status.textContent=error.message || 'Could not load seller cards. Close and try again.';});
  }
  async function adminQr(code) {
    const response=await fetch(`/api/admin/sellers/${encodeURIComponent(code)}/qr`,{cache:'no-store'});
    if(!response.ok)throw new Error('Could not load this seller’s QR.');
    const blob=await response.blob();
    return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
  }
  root.LyriBopSellerCards = { designs, renderCard, buildPrintDocument, openChooser, adminQr };
})(globalThis);
