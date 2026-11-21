export const OLD_AD_ORIGIN='https://personal-song-maker-v5-test.onrender.com';
export const AD_ORIGIN='https://lyribop.onrender.com';
export function cleanAdText(text){return typeof text==='string'?text.replace(/https:\/\/personal-song-maker-v5-test\.onrender\.com(?=\/|\s|$|[?#])/g,AD_ORIGIN):text;}
// Only public destinations and artwork references change. Metadata, board and schedule stay fixed.
export function cleanAdSnapshot(snapshot,assets){
 const next=structuredClone(snapshot);for(const key of ['caption','destination'])if(typeof next[key]==='string')next[key]=cleanAdText(next[key]);
 const replace=item=>{const asset=assets.find(a=>a.original_sha256===item.image_sha256);if(asset){item.image=asset.path;item.image_sha256=asset.sha256;delete item.publishing_media;}return item;};
 replace(next);if(Array.isArray(next.panels)){next.panels=next.panels.map(replace);next.image=next.panels[0].image;next.image_sha256=next.panels[0].image_sha256;}
 return next;
}
