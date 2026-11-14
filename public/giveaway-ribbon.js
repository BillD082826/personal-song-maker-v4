const giveawayRibbonThemes = new Map([
  ['Christmas', { color: '#8c253d', trim: '#ffd591', ornament: '❄' }],
  ['Valentine’s Day', { color: '#92244f', trim: '#ffc0d4', ornament: '♥' }],
  ['Mother’s Day', { color: '#713879', trim: '#f9c7e9', ornament: '✿' }],
  ['Father’s Day', { color: '#244868', trim: '#f6cf88', ornament: '★' }],
  ['Thanksgiving', { color: '#813d21', trim: '#ffd292', ornament: '🍂' }],
  ['Birthday', { color: '#563291', trim: '#ffe095', ornament: '🎉' }],
  ['Anniversary', { color: '#733753', trim: '#ffd7ad', ornament: '❦' }]
]);
const defaultGiveawayRibbon = { color: '#235441', trim: '#f8d998', ornament: '♪' };

function createGiveawayRibbon(occasion) {
  const theme = giveawayRibbonThemes.get(occasion);
  const { color, trim, ornament } = theme || defaultGiveawayRibbon;
  const ribbon = document.createElement('span');
  ribbon.style.cssText = 'display:inline-flex;align-items:center;gap:.55rem;max-width:100%;padding:.42rem .8rem;border-radius:.35rem;color:white;font-weight:700;font-size:.875rem;box-shadow:0 2px 6px #0002';
  ribbon.style.backgroundColor = color;
  ribbon.style.backgroundImage = 'repeating-linear-gradient(135deg, transparent 0 12px, #ffffff12 12px 16px)';
  ribbon.style.border = '1px solid ' + trim;

  const decoration = document.createElement('span');
  decoration.setAttribute('aria-hidden', 'true');
  decoration.style.color = trim;
  decoration.textContent = ornament;
  ribbon.append(decoration, theme ? occasion + ' Giveaway' : 'LyriBop Giveaway', decoration.cloneNode(true));
  return ribbon;
}
