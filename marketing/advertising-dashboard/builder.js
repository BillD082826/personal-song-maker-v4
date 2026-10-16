'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const form = $('fields'), canvas = $('preview'), ctx = canvas.getContext('2d');
  const key = 'lyribop-ad-designs-v1';
  let templates = [], selected = '', artwork = null, generation = 0;
  const status = message => { $('status').textContent = message; };
  const values = () => Object.fromEntries(new FormData(form));
  function records() {
    const result = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(result)) throw new Error('Saved designs are unavailable.');
    return result;
  }
  function refreshSaved() {
    const select = $('saved');
    select.replaceChildren(new Option('Choose a saved design', ''));
    for (const record of records()) select.add(new Option(record.name, record.id));
  }
  function wrap(text, size, maxWidth) {
    ctx.font = `${size}px Georgia`;
    const rows = []; let line = '';
    for (const word of text.trim().split(/\s+/)) {
      // Split unusually long words so text stays inside the image.
      let chunk = '';
      for (const character of word) {
        if (ctx.measureText(chunk + character).width > maxWidth && chunk) {
          if (line) { rows.push(line); line = ''; }
          rows.push(chunk); chunk = '';
        }
        chunk += character;
      }
      const next = line ? `${line} ${chunk}` : chunk;
      if (ctx.measureText(next).width > maxWidth && line) { rows.push(line); line = chunk; }
      else line = next;
    }
    if (line) rows.push(line);
    return rows;
  }
  function block(text, top, maxHeight, initialSize, minSize, maxWidth) {
    if (!text.trim()) return;
    let size = initialSize, rows;
    do { rows = wrap(text, size, maxWidth); if (rows.length * size * 1.22 <= maxHeight) break; size -= 2; } while (size >= minSize);
    if (size < minSize) throw new Error('Please shorten the wording so it fits clearly.');
    ctx.font = `${size}px Georgia`; ctx.fillStyle = '#fff5df';
    ctx.shadowColor = 'rgba(0,0,0,.85)'; ctx.shadowBlur = 7;
    rows.forEach((row, index) => ctx.fillText(row, 540, top + size + index * size * 1.22));
    ctx.shadowBlur = 0;
  }
  function render() {
    $('download').disabled = true;
    if (!artwork) return false;
    const v = values(), h = v.format === 'story' ? 1920 : 1080;
    canvas.width = 1080; canvas.height = h;
    ctx.textAlign = 'center';
    // Story retains the full square artwork; a blurred crop fills its surroundings.
    ctx.fillStyle = '#15162c'; ctx.fillRect(0, 0, 1080, h);
    if (h > 1080) {
      ctx.save(); ctx.filter = 'blur(28px)'; ctx.drawImage(artwork, -420, 0, 1920, h); ctx.restore();
      ctx.drawImage(artwork, 0, 570, 1080, 1080);
    } else ctx.drawImage(artwork, 0, 0, 1080, 1080);
    const shade = ctx.createLinearGradient(0, 0, 0, h * .65);
    shade.addColorStop(0, 'rgba(10,10,30,.60)'); shade.addColorStop(1, 'rgba(10,10,30,0)');
    ctx.fillStyle = shade; ctx.fillRect(0, 0, 1080, h * .65);
    const foot = h === 1080 ? 810 : 1580;
    const bottomShade = ctx.createLinearGradient(0, foot - 80, 0, h);
    bottomShade.addColorStop(0, 'rgba(10,10,30,0)'); bottomShade.addColorStop(1, 'rgba(10,10,30,.88)');
    ctx.fillStyle = bottomShade; ctx.fillRect(0, foot - 80, 1080, h - foot + 80);
    try {
      block(v.headline, h === 1080 ? 55 : 175, 215, 82, 32, 900);
      block(v.message, h === 1080 ? 285 : 435, 180, 40, 24, 850);
      ctx.fillStyle = '#fff5df'; ctx.font = 'bold 56px Arial'; ctx.fillText('LyriBop ♪', 540, foot + 28);
      ctx.fillStyle = '#7048dc'; ctx.beginPath(); ctx.roundRect(95, foot + 55, 890, 90, 45); ctx.fill();
      block(v.cta, foot + 67, 60, 36, 22, 800);
      block(v.website, foot + 160, 65, 28, 20, 900);
      if (!form.checkValidity()) throw new Error('Enter a headline, call to action and website.');
      $('download').disabled = false; return true;
    } catch (error) { status(error.message); return false; }
  }
  async function choose(id) {
    const template = templates.find(item => item.id === id);
    if (!template) return;
    selected = id; artwork = null; $('download').disabled = true;
    document.querySelectorAll('#templates button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.id === id)));
    const attempt = ++generation;
    status('Loading artwork…');
    const image = new Image();
    image.onload = () => { if (attempt !== generation) return; artwork = image; if (render()) status('Preview ready. Edit the wording or download your ad.'); };
    image.onerror = () => { if (attempt === generation) status('Artwork could not load. Select the design again to retry.'); };
    image.src = template.image;
  }
  form.addEventListener('input', () => { if (render()) status('Preview updated.'); });
  $('save').onclick = () => {
    if (!form.reportValidity() || !render()) return;
    const name = $('design-name').value.trim();
    if (!name) { status('Enter a design name before saving.'); return; }
    try {
      const list = records();
      if (list.length >= 100) throw new Error('You have 100 saved designs. Delete one before saving another.');
      list.push({ id: crypto.randomUUID(), name, template: selected, fields: values() });
      localStorage.setItem(key, JSON.stringify(list)); refreshSaved(); status('Design saved in this browser.');
    } catch (error) { status(`Could not save: ${error.message}`); }
  };
  $('load').onclick = () => {
    try {
      const record = records().find(item => item.id === $('saved').value);
      if (!record) { status('Choose a saved design first.'); return; }
      if (!templates.some(item => item.id === record.template)) throw new Error('This template is unavailable.');
      for (const name of ['headline', 'message', 'cta', 'website', 'format']) {
        const input = form.elements.namedItem(name), value = record.fields?.[name];
        if (typeof value !== 'string' || (input.maxLength > 0 && value.length > input.maxLength)) throw new Error('Saved wording is invalid.');
        if (name === 'format' && !['square', 'story'].includes(value)) throw new Error('Saved format is invalid.');
      }
      for (const [name, value] of Object.entries(record.fields)) { const input = form.elements.namedItem(name); if (input) input.value = value; }
      $('design-name').value = record.name; choose(record.template);
    } catch (error) { status(`Could not load: ${error.message}`); }
  };
  $('remove').onclick = () => {
    try {
      const id = $('saved').value;
      if (!id) { status('Choose a saved design first.'); return; }
      if (!confirm('Delete this saved design?')) return;
      localStorage.setItem(key, JSON.stringify(records().filter(item => item.id !== id))); refreshSaved(); status('Saved design deleted.');
    } catch (error) { status(`Could not delete: ${error.message}`); }
  };
  $('download').onclick = () => {
    if (!form.reportValidity() || !render()) return;
    canvas.toBlob(blob => {
      if (!blob) { status('Could not create the image. Please try again.'); return; }
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = `LyriBop-${selected}-${values().format}.png`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000); status('PNG downloaded. Ready to share.');
    }, 'image/png');
  };
  (async () => {
    try {
      const response = await fetch('builder-templates.json'); if (!response.ok) throw new Error('Template list unavailable.');
      templates = await response.json();
      for (const template of templates) {
        const button = document.createElement('button'); button.type = 'button'; button.dataset.id = template.id;
        const image = document.createElement('img'); image.src = template.image; image.alt = ''; image.loading = 'lazy';
        const label = document.createElement('span'); label.textContent = template.label;
        button.append(image, label); button.onclick = () => choose(template.id); $('templates').append(button);
      }
      try { refreshSaved(); } catch { status('Browser storage is unavailable. PNG downloads still work.'); }
      await choose('anniversary');
    } catch (error) { status(error.message); }
  })();
})();
