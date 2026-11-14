const fields = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
const storageKey = 'lyribop.campaign';

export function normalizeCampaign(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const campaign = {};
  for (const field of fields) {
    const tag = value[field];
    if (tag === null || tag === undefined || tag === '') continue;
    if (typeof tag !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(tag)) return null;
    campaign[field] = tag.toLowerCase();
  }
  return campaign.utm_source ? campaign : null;
}

export function captureCampaign(search, storage) {
  const parameters = new URLSearchParams(search);
  const current = normalizeCampaign(Object.fromEntries(fields.map(field => [field, parameters.get(field)])));
  try {
    if (current) storage.setItem(storageKey, JSON.stringify(current));
    else return normalizeCampaign(JSON.parse(storage.getItem(storageKey)));
  } catch {
    // The current URL still works when browser storage is unavailable.
  }
  return current;
}

export function browserCampaign() {
  let storage;
  try { storage = window.sessionStorage; } catch {}
  return captureCampaign(window.location.search, storage);
}
