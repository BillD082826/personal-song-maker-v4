const giveawayRibbonColors = new Map([
  ['Christmas', '#8c253d'],
  ['Valentine’s Day', '#9e255c'],
  ['Mother’s Day', '#764285'],
  ['Father’s Day', '#284d79'],
  ['Thanksgiving', '#87421e'],
  ['Birthday', '#6842a2'],
  ['Anniversary', '#79415a']
]);

function createGiveawayRibbon(occasion) {
  const color = giveawayRibbonColors.get(occasion);
  const ribbon = document.createElement('span');
  ribbon.textContent = color ? occasion + ' Giveaway' : 'LyriBop Giveaway';
  ribbon.style.cssText = 'display:inline-block;padding:.3rem .8rem;border-radius:.25rem;color:white;font-weight:700;font-size:.875rem';
  if (occasion === 'Christmas') {
    ribbon.textContent = '✦  Christmas Giveaway  ✦';
    ribbon.style.backgroundImage = 'repeating-linear-gradient(135deg, transparent 0 12px, #ffffff12 12px 16px)';
    ribbon.style.border = '1px solid #d8ad62';
  }
  ribbon.style.backgroundColor = color || '#235441';
  return ribbon;
}
