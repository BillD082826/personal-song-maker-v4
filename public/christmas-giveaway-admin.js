const giveawayLoad = document.getElementById('giveaway-load');
giveawayLoad.addEventListener('click', async () => {
  const status = document.getElementById('giveaway-status');
  const list = document.getElementById('giveaway-entries');
  giveawayLoad.disabled = true;
  list.replaceChildren();
  status.textContent = 'Loading entries…';
  try {
    const response = await fetch('/api/admin/christmas-giveaway', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load giveaway entries.');
    const { entries } = await response.json();
    for (const entry of entries) {
      const item = document.createElement('li');
      const date = new Date(entry.submitted_at).toLocaleString('en-US', { timeZone: 'America/New_York' });
      item.textContent = [entry.first_name, entry.email, date + ' Eastern', entry.story].join(' · ');
      list.append(item);
    }
    status.textContent = entries.length === 1 ? '1 entry' : entries.length + ' entries';
  } catch {
    status.textContent = 'Could not load giveaway entries. Try again.';
  } finally {
    giveawayLoad.disabled = false;
  }
});

const marketingTabs = [...document.querySelectorAll('#marketingPanel [role="tab"]')];

function selectMarketingTab(selected) {
  for (const tab of marketingTabs) {
    const active = tab === selected;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
  }
}

for (const [index, tab] of marketingTabs.entries()) {
  tab.addEventListener('click', () => selectMarketingTab(tab));
  tab.addEventListener('keydown', event => {
    const keys = { Home: 0, End: marketingTabs.length - 1, ArrowLeft: 1 - index, ArrowRight: 1 - index };
    if (!Object.hasOwn(keys, event.key)) return;
    event.preventDefault();
    const selected = marketingTabs[keys[event.key]];
    selectMarketingTab(selected);
    selected.focus();
  });
}
