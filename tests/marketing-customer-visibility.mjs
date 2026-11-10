import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
const html=await readFile(new URL('../public/admin.html',import.meta.url),'utf8');
test('Customer Marketing lists unpaid contacts without counting them as paid or changing opt-outs',async()=>{
 const start=source.indexOf('app.get("/api/admin/marketing/customers"');const route=source.slice(start,source.indexOf('\napp.get("/api/admin/marketing/history"',start));let handler,body,query;
 const rows=[{email:'new@example.com',customer_name:'New customer',total_order_count:1,paid_order_count:0,total_spent:0,unsubscribe_token:'saved-new',marketing_opt_out:false},{email:'paid@example.com',customer_name:'Paid customer',total_order_count:3,paid_order_count:2,total_spent:20,unsubscribe_token:'saved-paid',marketing_opt_out:false},{email:'out@example.com',total_order_count:1,paid_order_count:1,total_spent:10,unsubscribe_token:'saved-out',marketing_opt_out:true}];
 vm.runInNewContext(route,{app:{get(_path,_auth,fn){handler=fn;}},requireAdmin(){},pool:{async query(sql){query=sql;return {rows};}},logError(){assert.fail('Unexpected route error');}});
 await handler({}, {json(d){body=d;return this;},status(){return this;}});
 assert.equal(body.customerCount,3);assert.equal(body.eligibleCount,1);assert.equal(body.optedOutCount,1);assert.equal(body.customers[0].marketingEligible,false);assert.equal(body.customers[1].returning,true);assert.equal(body.customers[2].marketingEligible,false);
 assert.match(query,/COUNT\(o.id\) FILTER \(WHERE o.paid_at IS NOT NULL\)/);assert.match(query,/SUM\(o.price_amount\) FILTER \(WHERE o.paid_at IS NOT NULL\)/);assert.match(query,/WHERE o.is_test = FALSE/);assert.doesNotMatch(query,/WHERE o.paid_at IS NOT NULL\s+AND o.is_test/);
});
test('unpaid contacts can be viewed but cannot become individual or bulk marketing recipients',async()=>{
 const nodes=new Map();const by=id=>{if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',textContent:'',disabled:false});return nodes.get(id);};
 const ctx={document:{getElementById:by},marketingCustomers:[{email:'new@example.com',customer_name:'New',total_order_count:2,paid_order_count:0,total_spent:0,marketingEligible:false},{email:'paid@example.com',marketingEligible:true}],escapeHtml:s=>s,fetch(){assert.fail('No send may occur');},window:{confirm(){assert.fail('Must refuse before confirmation');}}};
 const start=html.indexOf('function showMarketingCustomerDetails()');const end=html.indexOf('document.getElementById("marketingCustomerSelect")?.addEventListener',start);vm.runInNewContext(html.slice(start,end),ctx);
 by('marketingCustomerSelect').value='new@example.com';ctx.showMarketingCustomerDetails();assert.equal(by('marketingSendButton').disabled,true);assert.match(by('marketingCustomerDetails').innerHTML,/Submitted orders: 2/);assert.match(by('marketingCustomerDetails').innerHTML,/Paid orders: 0/);
 by('marketingSubject').value='Hello';by('marketingMessage').value='Example';await ctx.sendMarketingEmailFromAdmin();assert.match(by('marketingSendMessage').textContent,/not eligible/);
 by('marketingCustomerSelect').value='__ALL__';ctx.showMarketingCustomerDetails();assert.match(by('marketingCustomerDetails').innerHTML,/Recipients: 1/);
});
