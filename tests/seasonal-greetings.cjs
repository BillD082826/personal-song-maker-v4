const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const p=path.join(__dirname,'../marketing/advertising-dashboard');
const all=JSON.parse(fs.readFileSync(path.join(p,'all-ads.json')));
const ads=JSON.parse(fs.readFileSync(path.join(p,'ads.json')));
const captions=JSON.parse(fs.readFileSync(path.join(p,'captions.json')));
const greetings=all.filter(a=>a.category==='seasonal-greeting');
assert(greetings.some(g=>g.id===46));
assert(greetings.some(g=>g.id===65));
for(const g of greetings) {
assert.equal(g.platform,'all');
assert(fs.statSync(path.join(p,g.image)).size>0);
assert(!ads.some(a=>a.id===g.id));assert.equal(g.download,g.image);
for(const platform of ['facebook','instagram','pinterest']) assert(captions[platform][g.id]);
assert(!/preview|buy|purchase|create your/i.test(captions.facebook[g.id]));
const overrides={};const c=vm.createContext({document:{addEventListener(){}},localStorage:{getItem:k=>overrides[k]||null}});
vm.runInContext(fs.readFileSync(path.join(p,'all-ads.js'),'utf8'),c);c.g=g;c.all=all;c.defaults=JSON.parse(fs.readFileSync(path.join(p,'ad-status.json')));
assert.equal(vm.runInContext('adFolderGroup(g)',c),'greetings');
assert(vm.runInContext("catalogVisibleAds(all,defaults,'ready')",c).some(a=>a.id===g.id&&a.type==='static'));
overrides['lyribop-status-static-'+g.id]='Archive';
assert(!vm.runInContext("catalogVisibleAds(all,defaults,'ready')",c).some(a=>a.id===g.id&&a.type==='static'));
assert(vm.runInContext("catalogVisibleAds(all,defaults,'archive')",c).some(a=>a.id===g.id&&a.type==='static'));
}
console.log('PASS: all shared greetings, separate static-ad catalog, assets/captions, friendly wording and status/Archive behavior.');
