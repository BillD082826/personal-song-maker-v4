export const OLD_AD_ORIGIN='https://personal-song-maker-v5-test.onrender.com';
export const AD_ORIGIN='https://lyribop.com';
export function cleanAdText(text){return typeof text==='string'?text.replace(/https:\/\/(?:personal-song-maker-v5-test\.onrender\.com|lyribop\.onrender\.com)(?=\/|\s|$|[?#])/g,AD_ORIGIN):text;}
export function formatAdCaption(text){
 if(typeof text!=='string')return text;
 let value=cleanAdText(text).trim();
 const tags=/(?:^|\n)[ \t]*(#\w[^\n]*(?:\n[^\n]*)*)\s*$/.exec(value);
 const tail=tags?tags[1].trim():'';
 if(tags)value=value.slice(0,tags.index).trimEnd();
 const lines=value.split('\n'),address=lines.filter(line=>line.includes(AD_ORIGIN));
 const body=lines.filter(line=>!line.includes(AD_ORIGIN)).join('\n').trim();
 return body+'\n\n'+(address.join('\n').trim()||AD_ORIGIN+'/')+(tail?'\n\n'+tail:'');
}
// Only public destinations and artwork references change. Metadata, board and schedule stay fixed.
export function cleanAdSnapshot(snapshot,assets){
 const next=structuredClone(snapshot);if(typeof next.caption==='string')next.caption=formatAdCaption(next.caption);if(typeof next.destination==='string')next.destination=cleanAdText(next.destination);
 const replace=item=>{const asset=assets.find(a=>a.original_sha256===item.image_sha256||a.legacy_sha256===item.image_sha256);if(asset){item.image=asset.path;item.image_sha256=asset.sha256;delete item.publishing_media;}return item;};
 replace(next);if(Array.isArray(next.panels)){next.panels=next.panels.map(replace);next.image=next.panels[0].image;next.image_sha256=next.panels[0].image_sha256;}
 return next;
}
