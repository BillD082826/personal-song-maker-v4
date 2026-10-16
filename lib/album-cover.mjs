export const albumCoverTemplates = Object.freeze([
  Object.freeze({ id: 'birthday', label: 'Birthday — Golden Celebration', defaultTitle: 'Happy Birthday', background: 'birthday-background.png' }),
  Object.freeze({ id: 'anniversary', label: 'Anniversary — Sunset Lake', defaultTitle: 'Happy Anniversary', background: 'anniversary-background.png' }),
  Object.freeze({ id: 'wedding', label: 'Wedding — Ivory & Gold', defaultTitle: 'Our Wedding Song', background: 'wedding-background.png' }),
  Object.freeze({ id: 'other', label: 'Other — Music & Vinyl', defaultTitle: 'Your Personal Song', background: 'other-background.png' })
]);

export function getAlbumCoverTemplate(id) {
  const template = albumCoverTemplates.find(item => item.id === id);
  if (!template) throw new Error('Select an available occasion template.');
  return template;
}

const limits = { title: 40, names: 60, message: 90 };

export function validateAlbumCover(input) {
  const template = getAlbumCoverTemplate(input?.template);
  const cover = { template: template.id };
  for (const [field, limit] of Object.entries(limits)) {
    if (typeof input[field] !== 'string') throw new Error(`Enter valid ${field} text.`);
    const value = input[field].replace(/\s+/g, ' ').trim();
    if ((field !== 'message' && !value) || value.length > limit || /[\u0000-\u001f\u007f]/.test(value)) {
      throw new Error(`${field} must contain ${field === 'message' ? '0' : '1'}–${limit} characters.`);
    }
    cover[field] = value;
  }
  return cover;
}

function escapeXml(value) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
}

// Bounded lines and conservative font sizes keep editable text within the sky.
function lines(value, width) {
  const result = [];
  let line = '';
  for (const word of value.split(' ')) {
    for (const chunk of word.match(new RegExp(`.{1,${width}}`, 'gu')) || []) {
      if (line && line.length + chunk.length + 1 > width) { result.push(line); line = ''; }
      line += (line ? ' ' : '') + chunk;
    }
  }
  if (line) result.push(line);
  return result;
}

export function renderAlbumCover(input, backgroundBase64) {
  const cover = validateAlbumCover(input);
  if (!/^[A-Za-z0-9+/=]+$/.test(backgroundBase64)) throw new Error('Invalid cover background.');
  const titleLines = cover.template === 'anniversary' && cover.title.toLowerCase() === 'happy anniversary'
    ? ['Happy', 'Anniversary'] : cover.template === 'other' && cover.title.toLowerCase() === 'your personal song'
      ? ['Your Personal', 'Song'] : lines(cover.title, 22);
  const nameLines = lines(cover.names, 30);
  const text = (rows, y, size, step, color, script = false) => rows.map((line, index) => {
    const fontSize = Math.min(size, Math.floor(1000 / (Array.from(line).length * 0.78)));
    // A bounded textLength constrains unusually wide glyphs without shrinking short names.
    const fit = line.length > 20 ? ' textLength="1000" lengthAdjust="spacingAndGlyphs"' : '';
    return `<text x="600" y="${y + index * step}" text-anchor="middle" font-family="${script ? "'Snell Roundhand', 'Brush Script MT', cursive" : 'Georgia, serif'}" font-size="${fontSize}" fill="${color}" stroke="#291524" stroke-width="0.65" paint-order="stroke fill"${fit}>${escapeXml(line)}</text>`;
  }).join('');
  const titleSize = titleLines.length > 2 ? 72 : 104;
  const nameSize = nameLines.length > 2 ? 52 : nameLines.length > 1 ? 66 : 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200" role="img" aria-label="Personalized song cover">
    <defs><linearGradient id="skyShade" x2="0" y2="1"><stop stop-color="#221025" stop-opacity="0.18"/><stop offset="1" stop-color="#221025" stop-opacity="0"/></linearGradient></defs>
    <image width="1200" height="1200" href="data:image/png;base64,${backgroundBase64}"/>
    <rect width="1200" height="650" fill="url(#skyShade)"/>
    ${text(titleLines, titleLines.length > 2 ? 110 : 145, titleSize, titleLines.length > 2 ? 84 : 114, '#fff4da')}
    <path d="M390 302 H540 M660 302 H810" stroke="#fff4da" stroke-width="2" opacity="0.8"/>
    ${text(nameLines, nameLines.length > 2 ? 365 : nameLines.length > 1 ? 380 : 425, nameSize, nameSize + 12, '#fff4da', true)}
    ${text(lines(cover.message, 45), 550, 28, 38, '#fff4da')}
    <text x="600" y="1140" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" fill="#fff4da">LyriBop ♪</text>
  </svg>`;
}
