/* Shared lyrics sheet: presentation only; never edits stored or sung lyrics. */
(() => {
  'use strict';
  window.printLyriBopLyrics = async function(title, lyrics) {
    const win = window.open('', '_blank');
    if (!win) { alert('Please allow pop-ups to print your lyrics.'); return; }
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>LyriBop Lyrics</title><style>
      @page{size:auto;margin:0.5in}*{box-sizing:border-box}body{margin:0;background:#eee;color:#252238;font-family:Georgia,serif}.sheet{width:7.2in;min-height:9.3in;margin:24px auto;background:white;padding:0.12in 0.15in}.brand{text-align:center;font:700 12pt Arial,sans-serif;color:#6046a5;letter-spacing:1px}h1{text-align:center;font-size:23pt;line-height:1.15;margin:12px 0 10px}.rule{width:65px;border-top:2px solid #b6a1d8;margin:14px auto 18px}.lyrics{display:grid;align-items:start;gap:0 28px;line-height:1.18}.stanza{white-space:pre-wrap;overflow-wrap:anywhere;margin:0 0 .65em;break-inside:avoid}.section{display:block;font:700 .85em Arial,sans-serif;color:#65577d;margin-bottom:.25em}.footer{text-align:center;font:9pt Arial,sans-serif;color:#777;margin-top:14px}.controls{margin:15px auto;text-align:center;font:14px Arial,sans-serif}.controls button{padding:10px 18px;margin:5px;cursor:pointer}#notice{max-width:650px;margin:8px auto}@media print{body{background:white}.sheet{margin:0;padding:0;width:7.2in;min-height:0}.controls{display:none}.brand,.section{color:#353040}h1{break-after:avoid}}
      </style></head><body><div class="controls"><button id="print">Print / Save PDF</button><div id="notice"></div></div><article class="sheet"><header><div class="brand">LyriBop ♪</div><h1></h1><div class="rule"></div></header><div class="lyrics"></div><footer class="footer">Made from your memories · LyriBop</footer></article></body></html>`);
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
    function arrange(columns,size){
      container.replaceChildren();container.style.gridTemplateColumns=`repeat(${columns},minmax(0,1fr))`;container.style.fontSize=size+'pt';
      if(columns===1){column().append(...stanzas);return;}
      const left=column(),right=column();
      // Keep stanza order top-to-bottom, then left-to-right; balance at stanza boundaries.
      let best=1,diff=Infinity;
      for(let split=1;split<stanzas.length;split++){
        left.replaceChildren(...stanzas.slice(0,split));right.replaceChildren(...stanzas.slice(split));
        const d=Math.abs(left.scrollHeight-right.scrollHeight);if(d<diff){diff=d;best=split;}
      }
      left.replaceChildren(...stanzas.slice(0,best));right.replaceChildren(...stanzas.slice(best));
    }
    if(doc.fonts?.ready) await doc.fonts.ready;
    let fits=false;
    for(const columns of [1,2]){
      for(let size=12;size>=9;size-=.5){arrange(columns,size);const sheet=doc.querySelector('.sheet');const used=doc.querySelector('header').offsetHeight+container.offsetHeight+doc.querySelector('.footer').offsetHeight+20;if(used<=870){fits=true;break;}}
      if(fits)break;
    }
    if(!fits){arrange(2,10);doc.getElementById('notice').textContent='These lyrics are unusually long. They will continue onto another page to keep the text readable.';}
    else doc.getElementById('notice').textContent='Formatted to fit one page. Choose Letter or A4, 100% scale, and turn browser headers and footers off.';
    doc.getElementById('print').onclick=()=>{win.focus();win.print();};
    win.focus();
    if(fits)win.print();
  };
})();
