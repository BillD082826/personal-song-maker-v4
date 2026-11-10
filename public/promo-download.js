(function(root){
 function clean(value){return String(value||'').replace(/[\r\n\t]/g,' ').trim();}
 function stamp(date){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date));}
 function display(date){return new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'short'}).format(new Date(date))+' Eastern';}
 function file(batch){
  const offer=batch.kind==='free'?'Free-Song':batch.percent+'-Percent-Off';
  const label=clean(batch.label)||'Unlabeled batch';
  const slug=label.normalize('NFKD').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'Batch';
  const filename='LyriBop-Codes_'+offer+'_'+slug+'_'+stamp(batch.createdAt)+'_'+String(batch.batchId).slice(0,8)+'.txt';
  const text=['LyriBop Single-Use Offer Codes','Offer: '+(batch.kind==='free'?'One free complete song':batch.percent+'% off one complete song'),'Batch label: '+label,'Created: '+display(batch.createdAt),'Expires: '+(batch.expiresAt?display(batch.expiresAt):'No expiration'),'Quantity: '+batch.codes.length,'Batch ID: '+batch.batchId,'','Each code can be used once. Album cover and printable lyrics included.','Keep this batch private; share only the individual code you intend to give away.','','CODES',...batch.codes,''].join('\n');
  return {filename,text};
 }
 function parseExpiry(value){
  const input=String(value||'').trim();if(!input)return null;
  const m=input.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if(!m)throw Error('Enter expiration as YYYY-MM-DD HH:MM, for example 2026-12-10 23:59, or leave it blank.');
  const [y,month,day,hour,minute]=m.slice(1).map(Number);const date=new Date(y,month-1,day,hour,minute);
  if(date.getFullYear()!==y||date.getMonth()!==month-1||date.getDate()!==day||date.getHours()!==hour||date.getMinutes()!==minute)throw Error('Enter a valid expiration date and time.');
  return date.toISOString();
 }
 root.LyriBopPromoDownload={file,parseExpiry};
})(globalThis);
