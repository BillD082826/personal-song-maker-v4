import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('Admin and customer HTML script boundaries stay valid; promo script occurs once at document end',async()=>{
 for(const [file,script] of [['admin.html','promo-admin.js'],['order.html','promo-checkout.js']]){
  const html=await readFile(new URL('../public/'+file,import.meta.url),'utf8');
  assert.equal(html.split('src="/'+script+'"').length-1,1);
  assert.ok(html.lastIndexOf('src="/'+script+'"')>html.lastIndexOf('</script>',html.lastIndexOf('src="/'+script+'"')-1));
  for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){if(!/\bsrc=/.test(m[1])&&m[2].trim())assert.doesNotThrow(()=>new vm.Script(m[2]),file+' inline script must parse as the browser sees it');}
 }
});
