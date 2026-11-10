import test from 'node:test';
import assert from 'node:assert/strict';
import {PromoCodes,promoSchema,discountedCents,normalizeCode,registerPromoRoutes} from '../lib/promo-codes.mjs';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('integer price calculation and strict unpredictable code format',()=>{
 assert.equal(discountedCents('19.99',20),1599);assert.equal(discountedCents('10',100),0);
 for(const x of [-1,0,'no',1e20])assert.throws(()=>discountedCents(x,20));
 for(const x of ['test','LB-'+ 'Z'.repeat(24),'LB-'+ 'A'.repeat(25)])assert.throws(()=>normalizeCode(x));
 assert.equal(normalizeCode(' lb-'+ 'a'.repeat(24)+' '),'LB-'+ 'A'.repeat(24));
});
test('Admin routes protect writes with authentication and exact Origin; public requests are limited',()=>{
 const routes=[];const auth=()=>{},limit=()=>{};registerPromoRoutes({get:(...a)=>routes.push(a),post:(...a)=>routes.push(a)},{pool:{},requireAdmin:auth,limiter:limit,origin:'https://lyribop.example',notifyConfirmation:async()=>{}});
 for(const r of routes){assert.equal(r[1],r[0].startsWith('/api/admin')?auth:limit);if(r[0].includes('/api/promo/')||r[0].includes('disable')||r[0]==='/api/admin/promo-codes'&&r.length===4){let denied=0,next=0;const res={status(n){denied=n;return this;},json(){}};r[2]({headers:{origin:'https://wrong.example'}},res,()=>next++);assert.equal(denied,403);assert.equal(next,0);r[2]({headers:{origin:'https://lyribop.example'}},res,()=>next++);assert.equal(next,1);}}
});
test('real isolated PostgreSQL: atomic free redemption, concurrent codes, payment capture, rollback, expiry and restart',{skip:!process.env.PROMO_TEST_DATABASE_URL},async()=>{
 const {default:pg}=await import('pg');const url=process.env.PROMO_TEST_DATABASE_URL;assert.match(url,/host=.*(?:private|tmp)/);
 const options={connectionString:url,options:'-c search_path=lyribop_promos'};let pool=new pg.Pool(options);
 try{
 await pool.query('CREATE SCHEMA lyribop_promos');
 await pool.query("CREATE TABLE orders(id TEXT PRIMARY KEY,preview_token TEXT,status TEXT DEFAULT 'New',is_test BOOLEAN DEFAULT FALSE,paid_at TIMESTAMPTZ,paypal_order_id TEXT,paypal_capture_id TEXT,price_amount NUMERIC(10,2) DEFAULT 10,includes_extra_version BOOLEAN DEFAULT FALSE,music_data BYTEA,customer_name TEXT,email TEXT,song_title TEXT);CREATE TABLE store_settings(setting_key TEXT,setting_value TEXT);CREATE TABLE order_confirmation_emails(order_id TEXT PRIMARY KEY);CREATE TABLE order_admin_notifications(order_id TEXT PRIMARY KEY)");
 await pool.query(promoSchema);let store=new PromoCodes(pool);
 const order=async(id)=>{await pool.query("INSERT INTO orders(id,preview_token,music_data) VALUES($1,$2,'x')",[id,'private-'+id]);return {orderId:id,previewToken:'private-'+id};};
 const make=async(kind='free',percent=20)=>await store.create({quantity:1,kind,percent,label:'isolated test'});
 for(const body of [{quantity:101,kind:'free',label:''},{quantity:1,kind:'percent',percent:100,label:''},{quantity:1,kind:'free',label:'',expiresAt:'yesterday'}])await assert.rejects(()=>store.create(body));
 const batch=await store.create({quantity:3,kind:'percent',percent:20,label:'batch'});assert.equal(new Set(batch.codes).size,3);assert.equal((await store.list()).length,3);assert.ok(!(JSON.stringify(await store.list())).includes(batch.codes[0]));
 const a=await order('a'),b=await order('b'),free=await make();
 assert.equal((await store.checkout({...a,code:free.codes[0]})).total,'0.00');
 assert.equal((await pool.query('SELECT state FROM promo_codes WHERE batch_id=$1',[free.batchId])).rows[0].state,'available');
 await assert.rejects(()=>store.checkout({...a,previewToken:'wrong',code:free.codes[0],mode:'free'}));
 const results=await Promise.allSettled([store.checkout({...a,code:free.codes[0],mode:'free'}),store.checkout({...b,code:free.codes[0],mode:'free'})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const winning=results[0].status==='fulfilled'?a:b,losing=winning===a?b:a;
 assert.equal((await store.checkout({...winning,code:free.codes[0],mode:'free'})).completed,true);
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM order_confirmation_emails')).rows[0].n,1);
 assert.equal((await pool.query('SELECT paid_at FROM orders WHERE id=$1',[losing.orderId])).rows[0].paid_at,null);
 const c=await order('c'),discount=await make('percent',20);
 const reserved=await store.checkout({...c,code:discount.codes[0],mode:'reserve'});assert.equal(reserved.total,'8.00');
 await assert.rejects(()=>store.checkout({...losing,code:discount.codes[0],mode:'reserve'}));
 const row=(await store.list()).find(r=>r.batch_id===discount.batchId);await assert.rejects(()=>store.disable(row.id));
 await pool.query("UPDATE promo_codes SET expires_at=NOW()-INTERVAL '1 day' WHERE id=$1",[row.id]);assert.equal((await store.checkout({...c,code:discount.codes[0],mode:'reserve'})).total,'8.00');
 const source=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
 const route=source.slice(source.indexOf('app.post("/api/paypal/capture-order/'),source.indexOf('\napp.post("/api/song",'));
 let handler,captures=0,amount='8.00',response,status=200;
 await pool.query("UPDATE orders SET paypal_order_id='provider-c' WHERE id='c'");
 vm.runInNewContext(route,{pool,paymentLimiter(){},app:{post(_path,_limit,fn){handler=fn;}},console:{log(){},error(){}},logError(){},getPayPalAccessToken:async()=> 'mock',PAYPAL_BASE_URL:'https://mock.invalid',trySendOrderConfirmation:async()=> 'mock',fetch:async()=>{captures++;return {ok:true,json:async()=>({status:'COMPLETED',purchase_units:[{payments:{captures:[{id:'capture-c',status:'COMPLETED',amount:{value:amount,currency_code:'USD'}}]}}]})};}});
 const capture=async()=>{status=200;await handler({params:{paypalOrderId:'provider-c'},body:{localOrderId:'c'}},{status(n){status=n;return this;},json(v){response=v;return this;}});};
 amount='10.00';await capture();assert.equal(status,400);assert.equal((await store.list()).find(r=>r.id===row.id).state,'reserved');
 amount='8.00';await capture();assert.equal(response.ok,true);assert.equal((await store.list()).find(r=>r.id===row.id).state,'redeemed');const sent=captures;await capture();assert.equal(captures,sent);
 const exp=await make();await pool.query("UPDATE promo_codes SET expires_at=NOW()-INTERVAL '1 day' WHERE batch_id=$1",[exp.batchId]);await assert.rejects(()=>store.checkout({...losing,code:exp.codes[0],mode:'free'}));
 const disabled=await make();const disrow=(await store.list()).find(r=>r.batch_id===disabled.batchId);await store.disable(disrow.id);await assert.rejects(()=>store.checkout({...losing,code:disabled.codes[0],mode:'free'}));
 const extra=await make();await pool.query('UPDATE orders SET includes_extra_version=TRUE WHERE id=$1',[losing.orderId]);await assert.rejects(()=>store.checkout({...losing,code:extra.codes[0],mode:'free'}));await pool.query('UPDATE orders SET includes_extra_version=FALSE,is_test=TRUE WHERE id=$1',[losing.orderId]);await assert.rejects(()=>store.checkout({...losing,code:extra.codes[0],mode:'free'}));
 await pool.end();pool=new pg.Pool(options);store=new PromoCodes(pool);assert.equal((await store.list()).find(r=>r.id===row.id).state,'redeemed');
 }finally{await pool.query('DROP SCHEMA IF EXISTS lyribop_promos CASCADE');await pool.end();}
});


test('actual PayPal creation keeps normal pricing and sends only server-validated discounted total',async()=>{
 const source=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
 const route=source.slice(source.indexOf('app.post("/api/paypal/create-order",'),source.indexOf('app.post("/api/paypal/capture-order/'));
 let handler,status,output,creates=0,amount,promo=false;
 const context={paymentLimiter(){},app:{post(_path,_limit,fn){handler=fn;}},PUBLIC_BASE_URL:'https://lyribop.example',URL,console:{error(){}},logError(){},getPayPalAccessToken:async()=> 'mock',PAYPAL_BASE_URL:'https://mock.invalid',
 pool:{async query(sql){if(sql.startsWith('SELECT id'))return {rowCount:1,rows:[{status:'New',price_amount:'10.00',promo_id:promo?'promo':null}]};if(sql.includes('ordering_open'))return {rows:[{setting_value:'true'}]};if(sql.startsWith('UPDATE orders SET paypal_order_id=COALESCE'))return {rowCount:1,rows:[{price_amount:'10.00'}]};return {rows:[]};}},
 promoCodes:{async checkout(input){assert.equal(input.mode,'reserve');if(input.previewToken!=='private'||!input.code)throw Object.assign(Error('Invalid code'),{promo:true});return {total:'8.00'};}},
 fetch:async(_url,options)=>{creates++;amount=JSON.parse(options.body).purchase_units[0].amount.value;return {ok:true,json:async()=>({id:'provider'})};}};
 vm.runInNewContext(route,context);
 const call=async(body,origin='https://lyribop.example')=>{status=200;await handler({headers:{origin},body},{status(n){status=n;return this;},json(v){output=v;return this;}});};
 await call({localOrderId:'normal'});assert.equal(status,200);assert.equal(amount,'10.00');
 promo=true;const before=creates;await call({localOrderId:'promo',previewToken:'wrong',promoCode:'code'});assert.equal(status,409);assert.equal(creates,before);
 await call({localOrderId:'promo',previewToken:'private',promoCode:'code'},'https://wrong.example');assert.equal(status,403);assert.equal(creates,before);
 await call({localOrderId:'promo',previewToken:'private',promoCode:'code',price_amount:'0.01'});assert.equal(status,200);assert.equal(amount,'8.00');assert.equal(output.id,'provider');
});
