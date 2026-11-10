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

test('actual Admin creation requests one labeled download and leaves manual download available',async()=>{
 const nodes=new Map(),events=new Map(),downloads=[];let posted=0,downloadBlob;
 function node(id){if(!nodes.has(id))nodes.set(id,{value:'',disabled:false,textContent:'',addEventListener(name,fn){events.set(id+':'+name,fn);},replaceChildren(){},append(){},select(){}});return nodes.get(id);}
 Object.assign(node('promoQuantity'),{value:'2'});node('promoKind').value='free';node('promoPercent').value='20';node('promoLabel').value='Holiday gifts';
 const context={Intl,Date,Blob,setTimeout(fn){fn();},confirm:()=>true,navigator:{clipboard:{writeText:async()=>{}}},
 URL:{createObjectURL(blob){downloadBlob=blob;return 'blob:test';},revokeObjectURL(){}},
 document:{getElementById:node,querySelector:()=>node('nav'),body:{append(){}},createElement(tag){assert.equal(tag,'a');return {click(){downloads.push(this.download);},remove(){}};}},
 fetch:async(_url,options)=>{if(options.method==='POST'){posted++;return {ok:true,json:async()=>({batchId:'12345678-1111-1111-1111-111111111111',kind:'free',percent:100,expiresAt:null,codes:['LB-AAAAAAAAAAAAAAAAAAAAAAAA','LB-BBBBBBBBBBBBBBBBBBBBBBBB']})};}return {ok:true,json:async()=>[]};}};
 vm.runInNewContext(await readFile(new URL('../public/promo-download.js',import.meta.url),'utf8'),context);
 vm.runInNewContext(await readFile(new URL('../public/promo-admin.js',import.meta.url),'utf8'),context);
 await events.get('promoCreateForm:submit')({preventDefault(){}});
 assert.equal(posted,1);assert.equal(downloads.length,1);assert.match(downloads[0],/LyriBop-Codes_Free-Song_Holiday-gifts_/);assert.match(await downloadBlob.text(),/Quantity: 2/);assert.equal(node('promoDownload').disabled,false);assert.match(node('promoAdminStatus').textContent,/Download requested/);
 node('promoDownload').onclick();assert.equal(downloads.length,2);assert.equal(posted,1);
});


test('plain-text expiry accepts complete local date and rejects blank segments and impossible dates',async()=>{
 const ctx={Intl,Date};vm.runInNewContext(await readFile(new URL('../public/promo-download.js',import.meta.url),'utf8'),ctx);const parse=ctx.LyriBopPromoDownload.parseExpiry;
 assert.equal(parse(''),null);const parsed=new Date(parse('2026-12-10 23:59'));assert.equal(parsed.getFullYear(),2026);assert.equal(parsed.getMonth(),11);assert.equal(parsed.getDate(),10);assert.equal(parsed.getHours(),23);assert.equal(parsed.getMinutes(),59);
 for(const text of ['12/10/2026 11:59PM','2026-02-30 23:59','2026-12-10 24:00','2026-12-10','2026-00-10 11:59'])assert.throws(()=>parse(text));
});
