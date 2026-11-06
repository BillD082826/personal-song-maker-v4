import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {loadSchedulerCatalog} from '../lib/ad-scheduler.mjs';
import {preparedInstagramMedia,validatePreparedInstagramMedia} from '../lib/instagram-scheduler-media.mjs';
test('all Ready to Post Instagram ads have matching bounded JPEG copies without changing originals',async()=>{
 const ads=(await loadSchedulerCatalog()).filter(x=>x.platform==='instagram'&&x.ready);assert(ads.length>0);
 for(const ad of ads){const source=await readFile('marketing/advertising-dashboard/'+ad.image);const result=await preparedInstagramMedia('public',source);assert.equal(result.format,'jpeg');assert.equal(result.source_sha256,createHash('sha256').update(source).digest('hex'));assert(result.width>=320&&result.width<=1440);assert(result.width/result.height>=0.8&&result.width/result.height<=1.91);}
});
test('changed original, changed JPEG and unsafe paths cannot become publishing artwork',async()=>{
 const manifest=JSON.parse(await readFile('public/social-scheduler/manifest.json'));const e=manifest.images[0];const ad=(await loadSchedulerCatalog()).find(a=>a.id===e.ad_id);const source=await readFile('marketing/advertising-dashboard/'+ad.image),jpeg=await readFile('public'+e.path);
 for(const [entry,png,jpg] of [[e,Buffer.from('changed'),jpeg],[e,source,Buffer.from('changed')],[{...e,path:'/private/file.jpg'},source,jpeg],[{...e,width:1},source,jpeg]])assert.throws(()=>validatePreparedInstagramMedia(entry,png,jpg));
});
