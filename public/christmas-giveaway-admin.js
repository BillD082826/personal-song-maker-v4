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

let editingDraftId = null;
const previewPanel = document.getElementById('giveaway-preview-panel');
const draftForm = document.getElementById('giveaway-draft');
const draftStatus = document.getElementById('giveaway-draft-status');

function occasionSuggestions(occasion) {
  if (occasion === 'Other') return { title: '', question: '' };
  return {
    title: 'LyriBop ' + occasion + ' Song Giveaway',
    question: 'Who would you surprise with a personalized song for ' + occasion + ', and what memory would you put in it?'
  };
}

const occasionField = draftForm.elements.namedItem('occasion');
let previousOccasion = occasionField.value;
occasionField.addEventListener('change', () => {
  const previous = occasionSuggestions(previousOccasion);
  const next = occasionSuggestions(occasionField.value);
  for (const name of ['title', 'question']) {
    const field = draftForm.elements.namedItem(name);
    if (!field.value.trim() || field.value === previous[name]) field.value = next[name];
  }
  previousOccasion = occasionField.value;
  previewPanel.hidden = true;
});
document.getElementById('giveaway-new').addEventListener('click', () => {
  editingDraftId = null;
  draftForm.reset();
  previousOccasion = occasionField.value;
  previewPanel.hidden = true;
  draftForm.hidden = false;
  draftForm.elements.title.focus();
});

draftForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = draftForm.querySelector('button');
  const fields = Object.fromEntries(new FormData(draftForm));
  fields.winners = Number(fields.winners);
  button.disabled = true;
  try {
    const response = await fetch(editingDraftId ? '/api/admin/giveaway-drafts/' + encodeURIComponent(editingDraftId) : '/api/admin/giveaway-drafts', {
      method: editingDraftId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    draftForm.reset();
    draftForm.hidden = true;
    previewPanel.hidden = true;
    document.getElementById('giveaway-drafts-load').click();
    draftStatus.textContent = 'Draft saved.';
  } catch (error) {
    draftStatus.textContent = error.message || 'Could not save the draft.';
  } finally {
    button.disabled = false;
  }
});

document.getElementById('giveaway-drafts-load').addEventListener('click', async () => {
  const list = document.getElementById('giveaway-drafts');
  try {
    const response = await fetch('/api/admin/giveaway-drafts', { cache: 'no-store' });
    if (!response.ok) throw new Error();
    const { drafts } = await response.json();
    list.replaceChildren();
    for (const { id, settings } of drafts) {
      const item = document.createElement('details');
      const title = document.createElement('summary');
      title.textContent = settings.title;
      item.append(title);
      for (const value of [settings.prize, settings.winners + ' winners', settings.opens + ' to ' + settings.closes, settings.question, settings.rules]) {
        const paragraph = document.createElement('p');
        paragraph.textContent = value;
        item.append(paragraph);
      }
      if (settings.publishedAt) {
        const link = document.createElement('a');
        link.href = '/giveaway.html?id=' + encodeURIComponent(id);
        link.textContent = 'Open shareable entry form';
        const entries = document.createElement('button');
        entries.type = 'button';
        entries.textContent = 'Load entries';
        const results = document.createElement('ul');
        const count = document.createElement('p');
        count.setAttribute('role', 'status');
        entries.addEventListener('click', async () => {
          entries.disabled = true;
          try {
            const response = await fetch('/api/admin/giveaways/' + encodeURIComponent(id) + '/entries', { cache: 'no-store' });
            if (!response.ok) throw new Error();
            const data = await response.json();
            results.replaceChildren();
            for (const entry of data.entries) {
              const row = document.createElement('li');
              const time = new Date(entry.submitted_at).toLocaleString('en-US', { timeZone: 'America/New_York' });
              row.textContent = [entry.first_name, entry.email, time + ' Eastern', entry.story].join(' · ');
              results.append(row);
            }
            count.textContent = data.entries.length + ' entries';
          } catch {
            count.textContent = 'Could not load entries.';
          } finally {
            entries.disabled = false;
          }
        });
        item.append(link, entries, count, results);
      } else {
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.textContent = 'Edit draft';
        edit.addEventListener('click', () => {
          editingDraftId = id;
          draftForm.reset();
          for (const [name, value] of Object.entries(settings)) {
            const field = draftForm.elements.namedItem(name);
            if (field) field.value = value;
          }
          previousOccasion = occasionField.value;
          previewPanel.hidden = true;
          draftForm.hidden = false;
          draftForm.elements.title.focus();
        });
        item.append(edit);
        const publish = document.createElement('button');
        publish.type = 'button';
        publish.textContent = 'Publish giveaway';
        publish.addEventListener('click', async () => {
          if (!confirm('Publish “' + settings.title + '”? Its entry form will be public and accept entries during the dates shown.')) return;
          publish.disabled = true;
          try {
            const response = await fetch('/api/admin/giveaway-drafts/' + encodeURIComponent(id) + '/publish', { method: 'POST' });
            if (!response.ok) throw new Error();
            draftStatus.textContent = 'Giveaway published.';
            document.getElementById('giveaway-drafts-load').click();
          } catch {
            draftStatus.textContent = 'Could not publish. Check the dates and reload saved drafts.';
            publish.disabled = false;
          }
        });
        item.append(publish);
      }
      list.append(item);
    }
    if (!drafts.length) draftStatus.textContent = 'No drafts yet.';
  } catch {
    draftStatus.textContent = 'Could not load giveaway drafts.';
  }
});

document.getElementById('giveaway-preview').addEventListener('click', () => {
  if (!draftForm.reportValidity()) return;
  const fields = Object.fromEntries(new FormData(draftForm));
  const frame = document.createElement('iframe');
  frame.title = 'Public giveaway form preview';
  frame.addEventListener('load', () => frame.contentWindow.renderGiveaway(fields, true), { once: true });
  frame.src = '/giveaway.html?preview=1';
  previewPanel.replaceChildren(frame);
  previewPanel.hidden = false;
});
