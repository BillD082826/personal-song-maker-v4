// Exercise the actual admin routes with isolated database and mail stubs.
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
function route(method,path,rows){
 let handler;const calls=[],sent=[];
 const start=server.indexOf(`app.${method}("${path}",`);assert.ok(start>=0);
 const source=server.slice(start,server.indexOf('\n});',start)+4);
 const pool={query:async(sql,args)=>{calls.push({sql,args});return {rows:sql.includes('SELECT')?rows:[]};}};
 vm.runInNewContext(source,{app:{[method]:(_path,...fns)=>handler=fns.at(-1)},requireAdmin:()=>{},pool,createMarketingUnsubscribeToken:()=> 'test-token',sanitizeEmailSubject:x=>String(x||'').trim(),sendMarketingEmail:async recipient=>{sent.push(recipient);return {id:'stub-message'};},logError:()=>{}});
 return {handler,calls,sent};
}
function response(){return {code:200,body:null,status(n){this.code=n;return this;},json(x){this.body=x;return this;}};}
const free={email:'preview@example.com',customer_name:'Preview Customer',paid_order_count:0,total_order_count:1,unsubscribe_token:'saved-token',marketing_opt_out:false};
const opted={...free,email:'opted-out@example.com',marketing_opt_out:true};
let r=route('get','/api/admin/marketing/customers',[free,opted]),res=response();await r.handler({},res);assert.equal(res.body.eligibleCount,1);assert.equal(res.body.customers[0].marketingEligible,true);assert.equal(res.body.customers[1].marketingEligible,false);
r=route('post','/api/admin/marketing/send',[free]);res=response();await r.handler({body:{email:free.email,subject:'Hello',message:'Your preview is ready.'}},res);assert.equal(res.code,200);assert.equal(r.sent.length,1);assert.ok(r.calls[0].sql.includes('o.is_test = FALSE'));assert.ok(!r.calls[0].sql.includes('AND o.paid_at IS NOT NULL'));
r=route('post','/api/admin/marketing/send',[opted]);res=response();await r.handler({body:{email:opted.email,subject:'Hello',message:'Message'}},res);assert.equal(res.code,403);assert.equal(r.sent.length,0);
r=route('post','/api/admin/marketing/send-all',[free]);res=response();await r.handler({body:{subject:'Hello',message:'Message'}},res);assert.equal(res.body.sentCount,1);assert.ok(r.calls[0].sql.includes('o.is_test = FALSE'));assert.ok(r.calls[0].sql.includes('COALESCE(mp.marketing_opt_out, FALSE) = FALSE'));assert.ok(!r.calls[0].sql.includes('WHERE o.paid_at IS NOT NULL'));
const html=await readFile(new URL('../public/admin.html',import.meta.url),'utf8');const start=html.indexOf('function showMarketingCustomerDetails()');const fn=html.slice(start,html.indexOf('\nasync function sendMarketingEmailFromAdmin',start));
for(const [customer,disabled] of [[{...free,marketingEligible:true},false],[{...opted,marketingEligible:false},true]]){
 const elements={marketingCustomerSelect:{value:customer.email},marketingCustomerDetails:{},marketingSendButton:{disabled:true}};
 vm.runInNewContext(fn+';showMarketingCustomerDetails();',{document:{getElementById:id=>elements[id]},marketingCustomers:[customer],escapeHtml:x=>String(x)});assert.equal(elements.marketingSendButton.disabled,disabled);
}
console.log('PASS free-preview eligibility, individual and bulk routes, opt-out/test exclusions, and Send-button states. No external emails sent.');
