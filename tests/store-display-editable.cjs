const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const calls=[];
const ctx={font:'',fillStyle:'',textAlign:'',shadowBlur:0,fillRect:(...a)=>calls.push(['rect',...a]),drawImage:(...a)=>calls.push(['image',...a]),fillText:(...a)=>calls.push(['text',...a]),measureText(text){return {width:text.length*parseInt(this.font.match(/\d+/)?.[0]||'40')*.55}},createLinearGradient:()=>({addColorStop(){}}),save(){},restore(){},translate(){},scale(){}};
const canvas={width:0,height:0,getContext:()=>ctx};
const elements={editableStoreHeadline:{value:'Their story. Their song.'},editableStoreMessage:{value:'A personalized gift made from your memories.'},editableStoreCta:{value:'Scan for Your Free Preview'}};
const window={LyriBopStoreDisplay:{validateCanvas(c){assert.equal(c.width,1200);assert.equal(c.height,1800)}}};
const sandbox={window,document:{getElementById:id=>elements[id],addEventListener(){},createElement:()=>canvas},Image:class {async decode(){assert(fs.existsSync('public'+this.src))}},MutationObserver:class{},localStorage:{},console};
vm.runInNewContext(fs.readFileSync('public/store-displays/editable-builder.js','utf8'),sandbox);
(async()=>{
for(const id of ['birthday','anniversary','wedding','retirement','graduation','mothers-day','fathers-day','christmas','valentines-day','congratulations','thank-you','memorial-tribute','just-for-fun','other']){
 calls.length=0; const d=window.getEditableStoreDisplayDesign(id);await window.renderEditableStoreDisplay(d,'10.00',{},'TEST');
 assert(calls.some(c=>c[0]==='text' && c[1].includes('$10.00')));
 assert(calls.some(c=>c[0]==='text' && c[1]==='Seller Code: TEST'));
 const qr=calls.filter(c=>c[0]==='image')[1];assert.equal(qr[2],85);assert.equal(qr[3],1185);assert(qr[3]+qr[5]<=1500);
 assert(calls.filter(c=>c[0]==='text').every(c=>c[3]<1500));
}
assert.throws(()=>window.getEditableStoreDisplayDesign('../bad'));
await assert.rejects(()=>window.renderEditableStoreDisplay(window.getEditableStoreDisplayDesign('other'),'0',{},''));
console.log('PASS: 14 editable 1200×1800 templates, price, seller code, QR bounds and pocket text clearance; invalid template/price rejection. Mock canvas.');
})();
