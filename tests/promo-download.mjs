import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
test('code downloads identify offer, sanitized batch label, Eastern date, expiry and exact codes',async()=>{
 const context={Intl,Date};vm.runInNewContext(await readFile(new URL('../public/promo-download.js',import.meta.url),'utf8'),context);
 const batch={kind:'free',percent:100,label:'Thanksgiving / gifts\n2026',createdAt:'2026-11-11T01:00:00Z',expiresAt:null,batchId:'12345678-1234-1234-1234-123456789012',codes:['LB-AAAAAAAAAAAAAAAAAAAAAAAA','LB-BBBBBBBBBBBBBBBBBBBBBBBB']};
 const free=context.LyriBopPromoDownload.file(batch);assert.match(free.filename,/^LyriBop-Codes_Free-Song_Thanksgiving-gifts-2026_2026-11-10_12345678\.txt$/);assert.match(free.text,/Expires: No expiration/);assert.match(free.text,/Quantity: 2/);assert.match(free.text,/Eastern/);assert.ok(free.text.endsWith(batch.codes.join('\n')+'\n'));
 const percent=context.LyriBopPromoDownload.file({...batch,kind:'percent',percent:20,expiresAt:'2026-12-01T05:00:00Z'});assert.match(percent.filename,/20-Percent-Off/);assert.match(percent.text,/Offer: 20% off/);assert.match(percent.text,/Expires: Dec 1, 2026/);assert.ok(!percent.filename.includes('/'));
});
