import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const scope={};vm.runInNewContext(fs.readFileSync(new URL('../public/seller-cards.js',import.meta.url),'utf8'),scope);
const cards=scope.LyriBopSellerCards;
const image='data:image/png;base64,iVBORw0KGgo=';
test('all designs and appearances bind the current seller only',()=>{
 for(const design of cards.designs)for(const monochrome of [false,true]){
  const a=cards.renderCard({design:design.id,monochrome,side:'back',code:'SELLER_A',qrDataUrl:image});
  const b=cards.renderCard({design:design.id,monochrome,side:'back',code:'SELLER_B',qrDataUrl:image});
  assert.match(a,/SELLER_A/);assert.doesNotMatch(a,/SELLER_B|BILL91226/);
  assert.match(b,/SELLER_B/);assert.doesNotMatch(b,/SELLER_A|BILL91226/);
  assert.ok(fs.existsSync(new URL(`../public/seller-cards/${design.id}-${monochrome?'black-and-white':'color'}-back.svg`,import.meta.url)));
 }
});
test('print selection makes exactly ten copies of each selected side',()=>{
 for(const [sides,pages] of [['front',1],['back',1],['both',2]]){
  const html=cards.buildPrintDocument({design:'on-repeat',code:'SELLER_A',qrDataUrl:image,sides});
  assert.equal((html.match(/class="sheet"/g)||[]).length,pages);
  assert.equal((html.match(/class="card"/g)||[]).length,10*pages);
  assert.match(html,/translateY\(-\.125in\)/);
 }
});
test('rejects injected seller codes, QR URLs and unknown templates',()=>{
 const valid={design:'on-repeat',code:'SELLER_A',side:'back',qrDataUrl:image};
 for(const change of [{code:'<script>'},{qrDataUrl:'https://tracking.invalid/qr'},{design:'../../private'},{side:'other'}])assert.throws(()=>cards.renderCard({...valid,...change}));
});
test('generic artwork contains no pre-baked QR image or seller identifier',()=>{
 for(const file of fs.readdirSync(new URL('../public/seller-cards/',import.meta.url))){
  const svg=fs.readFileSync(new URL('../public/seller-cards/'+file,import.meta.url),'utf8');
  assert.doesNotMatch(svg,/<image|BILL91226|5320433e/);
 }
});
