/* Shared lyrics sheet: presentation only; never edits stored or sung lyrics. */
(() => {
  'use strict';
  window.printLyriBopLyrics = async function(title, lyrics, artwork = {}) {
    const win = window.open('', '_blank');
    if (!win) { alert('Please allow pop-ups to print your lyrics.'); return; }
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>LyriBop Lyrics</title><style>
      @page{size:auto;margin:0.5in}*{box-sizing:border-box}body{margin:0;background:#eee;color:#252238;font-family:Georgia,serif}.sheet{width:7.2in;min-height:9.3in;margin:24px auto;background:white;padding:0.12in 0.15in}.brand{text-align:center;font:700 12pt Arial,sans-serif;color:#6046a5;letter-spacing:1px}h1{text-align:center;font-size:23pt;line-height:1.15;margin:12px 0 10px}.rule{width:65px;border-top:2px solid #b6a1d8;margin:14px auto 18px}.lyrics{display:grid;align-items:start;gap:0 28px;line-height:1.18}.stanza{white-space:pre-wrap;overflow-wrap:anywhere;margin:0 0 .65em;break-inside:avoid}.section{display:block;font:700 .85em Arial,sans-serif;color:#65577d;margin-bottom:.25em}.footer{text-align:center;font:9pt Arial,sans-serif;color:#777;margin-top:14px}.controls{margin:15px auto;text-align:center;font:14px Arial,sans-serif}.controls button{padding:10px 18px;margin:5px;cursor:pointer}#notice{max-width:650px;margin:8px auto}.content{display:block}.art{margin:0}.art[hidden]{display:none}.art img{display:block;width:100%;max-height:6.7in;object-fit:contain}.keepsake{background:linear-gradient(135deg,#fffdf6,#f2edf7);border:1px solid #e5d9c9;padding:.2in}.keepsake .content{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:22px;align-items:start}.keepsake h1{font-size:29pt;color:#49345b}.keepsake .lyrics{gap:12px}.keepsake .art{position:sticky;top:0}.controls select{padding:8px}.keepsake .brand{font-size:10pt}@media print{.keepsake{padding:.15in;print-color-adjust:exact;-webkit-print-color-adjust:exact}.keepsake .art{position:static}body{background:white}.sheet{margin:0;padding:0;width:7.2in;min-height:0}.controls{display:none}.brand,.section{color:#353040}h1{break-after:avoid}}
      </style></head><body><div class="controls"><label>Layout <select id="artChoice"><option value="none">Lyrics only</option><option value="cover">Album cover + lyrics</option><option value="photo">Photo + lyrics</option></select></label><button id="print">Print / Save PDF</button><div id="notice"></div></div><article class="sheet"><header><div class="brand">LyriBop ♪</div><h1></h1><div class="rule"></div></header><div class="content"><div class="lyrics"></div><figure class="art" hidden><img alt="Personal song keepsake artwork"></figure></div><footer class="footer">Made from your memories · LyriBop</footer></article></body></html>`);
    win.document.close();
    const doc=win.document, heading=String(title||'Your Personal Song').trim();
    doc.querySelector('h1').textContent=heading;
    let raw=String(lyrics||'').replace(/\r\n?/g,'\n').trim();
    const first=raw.split('\n')[0].trim().replace(/^#{1,6}\s*/, '');
    // The song title often appears again as the first lyric line.
    if(first.toLocaleLowerCase()===heading.toLocaleLowerCase()) raw=raw.slice(raw.indexOf('\n')+1).trim();
    const stanzas=raw.split(/\n\s*\n/).filter(Boolean).map(part=>{
      const node=doc.createElement('div');node.className='stanza';
      const rows=part.split('\n');
      if(/^\s*\[[^\]]+\]\s*$/.test(rows[0])){const label=doc.createElement('span');label.className='section';label.textContent=rows.shift().trim().replace(/^\[|\]$/g,'');node.append(label);}
      node.append(doc.createTextNode(rows.join('\n')));return node;
    });
    const container=doc.querySelector('.lyrics');
    const column=()=>{const c=doc.createElement('div');container.append(c);return c;};
    function arrange(columns,size,fillLeft=false){
      container.replaceChildren();container.style.gridTemplateColumns=`repeat(${columns},minmax(0,1fr))`;container.style.fontSize=size+'pt';
      if(columns===1){column().append(...stanzas);return;}
      const left=column(),right=column();
      // Preserve reading order; fit left column first at stanza boundaries.
      let best=1,diff=Infinity;
      const available=870-doc.querySelector('header').offsetHeight-doc.querySelector('.footer').offsetHeight-20;
      for(let split=1;split<stanzas.length;split++){
        left.replaceChildren(...stanzas.slice(0,split));right.replaceChildren(...stanzas.slice(split));
        const d=Math.abs(left.scrollHeight-right.scrollHeight);
        if(fillLeft){if(left.scrollHeight<=available && right.scrollHeight<=available)best=split;}
        else if(d<diff){diff=d;best=split;}
      }
      left.replaceChildren(...stanzas.slice(0,best));right.replaceChildren(...stanzas.slice(best));
    }
    if(doc.fonts?.ready) await doc.fonts.ready;
    const select=doc.getElementById('artChoice'), button=doc.getElementById('print'), image=doc.querySelector('.art img'), figure=doc.querySelector('.art'), sheet=doc.querySelector('.sheet');
    let revision=0;
    function fitLyrics(hasArt){
      let fits=false, chosenColumns=1, chosenSize=12;
      for(const columns of hasArt?[1]:[1,2]){
        for(let size=12;size>=9;size-=.5){arrange(columns,size);const used=doc.querySelector('header').offsetHeight+Math.max(container.offsetHeight,hasArt?figure.offsetHeight:0)+doc.querySelector('.footer').offsetHeight+20;if(used<=870){fits=true;chosenColumns=columns;chosenSize=size;break;}}
        if(fits)break;
      }
      if(fits && chosenColumns===2)arrange(2,chosenSize,true);
      if(!fits)arrange(hasArt?1:2,10);
      doc.getElementById('notice').textContent=fits?'Choose Letter or A4, 100% scale, and turn browser headers and footers off.':'These lyrics need more than one page at a readable size. Choose Lyrics only for a more compact layout.';
    }
    async function changeLayout(){
      const current=++revision, kind=select.value;
      button.disabled=true;figure.hidden=true;sheet.classList.remove('keepsake');
      if(kind!=='none' && artwork[kind]){
        try{
          // Only same-origin private artwork routes are accepted.
          const src=new URL(artwork[kind],window.location.href);
          if(src.origin!==window.location.origin)throw new Error('Invalid artwork address.');
          image.src=src.href;await image.decode();
          if(current!==revision)return;
          figure.hidden=false;sheet.classList.add('keepsake');
        }catch(error){
          if(current!==revision)return;
          fitLyrics(false);doc.getElementById('notice').textContent=kind==='photo'?'No saved photo is available for this order. Add one in Album Cover, or choose another layout.':'Artwork could not load. Choose Lyrics only or try again.';button.disabled=false;return;
        }
      }
      if(current!==revision)return;
      fitLyrics(!figure.hidden);button.disabled=false;
    }
    select.querySelector('[value="cover"]').disabled=!artwork.cover;
    select.querySelector('[value="photo"]').disabled=!artwork.photo;
    select.value=artwork.cover?'cover':'none';
    select.onchange=changeLayout;
    button.onclick=()=>{win.focus();win.print();};
    await changeLayout();
    win.focus();
    if(!artwork.cover && !artwork.photo)win.print();
  };
})();
