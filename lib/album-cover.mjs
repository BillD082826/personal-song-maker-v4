const limits = { title: 40, names: 60, message: 90 };

export function validateAlbumCover(input) {
  if (input?.template !== 'anniversary') throw new Error('Select an available occasion template.');
  const cover = { template: 'anniversary' };
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
  const text = (value, width, y, size, color, italic = false) => lines(value, width).map((line, index) =>
    `<text x="600" y="${y + index * (size + 12)}" text-anchor="middle" font-family="Georgia, serif" font-size="${Math.min(size, Math.floor(1000 / (Array.from(line).length * 1.1)))}" font-style="${italic ? 'italic' : 'normal'}" fill="${color}">${escapeXml(line)}</text>`
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200" role="img" aria-label="Personalized song cover">
    <image width="1200" height="1200" href="data:image/png;base64,${backgroundBase64}"/>
    <rect x="0" y="0" width="1200" height="620" fill="#221025" opacity="0.16"/>
    ${text(cover.title, 22, 100, 56, '#fff4da')}
    ${text(cover.names, 30, 320, 44, '#fff4da', true)}
    ${text(cover.message, 45, 500, 26, '#fff4da')}
    <text x="600" y="1140" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" fill="#fff4da">LyriBop ♪</text>
  </svg>`;
}
