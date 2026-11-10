import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createAdminOrderNotifier} from '../lib/admin-order-notification.mjs';
let state, sends, rejectStatus, throws, configured=true, eligible=true, paid=false;
const pool={async query(sql,args){
 if(sql.startsWith('SELECT state'))return {rowCount:state?1:0,rows:state?[{state}]:[]};
 if(sql.startsWith('SELECT id'))return {rows:eligible?[{id:'test-paid',customer_name:'Alex',person:'Jamie',occasion:'Anniversary',song_title:'Our Song',price_amount:10,paid_at:paid?'now':null,paypal_capture_id:paid?'capture':null}]:[]};
 if(sql.startsWith("UPDATE order_admin_notifications SET state='sending'")){if(state!=='pending')return {rowCount:0};state='sending';return {rowCount:1};}
 if(sql.includes("state='sent'")){state='sent';return {};}
 if(sql.includes('state=$2')){if(state==='sending')state=args[1];return {};}
 throw Error(sql);
}};
function notifier(){return createAdminOrderNotifier({getPool:()=>pool,env:configured?{RESEND_API_KEY:'fake'}:{},report(){},fetchEmail:async(_url,options)=>{
 sends++;assert.equal(state,'sending');const data=JSON.parse(options.body);assert.deepEqual(data.to,['lyribop@gmail.com']);assert.match(data.subject,/New LyriBop order/);assert.match(data.text,paid?/Payment: Recorded as paid/:/Payment: Not recorded as paid/);assert.match(options.headers['Idempotency-Key'],/^admin-paid-/);if(throws)throw Error('timeout');return {ok:!rejectStatus,status:rejectStatus||200,json:async()=>({id:'provider-test'})};
}});}
function reset(){state='pending';sends=0;rejectStatus=0;throws=false;configured=true;eligible=true;paid=false;}
reset();await Promise.all([notifier()('test'),notifier()('test')]);assert.equal(sends,1);assert.equal(state,'sent');await notifier()('test');assert.equal(sends,1);
for(const protectedState of ['sent','sending','uncertain','failed',null]){reset();state=protectedState;await notifier()('test');assert.equal(sends,0);}
reset();configured=false;assert.equal(await notifier()('test'),'pending');assert.equal(sends,0);
reset();eligible=false;assert.equal(await notifier()('test'),'not_eligible');assert.equal(sends,0);
for(const status of [400,409,500]){reset();rejectStatus=status;await notifier()('test');assert.equal(state,status===400?'failed':'uncertain');await notifier()('test');assert.equal(sends,1);}
reset();throws=true;await notifier()('test');assert.equal(state,'uncertain');
console.log('PASS: arrival and paid-order alerts, recipient, concurrent/repeated claims, no historical backfill, missing configuration and uncertain/rejected provider outcomes (mocked).');

reset();paid=true;assert.equal(await notifier()('test'),'sent');assert.equal(sends,1);

// Execute the real submission handler: order and notification queue share one SQL
// statement, notification is attempted after persistence, and errors don't lose orders.
const {readFile}=await import('node:fs/promises');
const vm=await import('node:vm');
const source=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
const route=source.slice(source.indexOf('app.post("/api/order",'),source.indexOf('\nfunction escapeHtml',source.indexOf('app.post("/api/order",')));
let handler, saved=false, notices=0, body, status=200;
const context={app:{post(_path,_limit,fn){handler=fn;}},orderLimiter(){},crypto,validateCoverPhoto(){return null;},console:{log(){}},logError(...args){console.error(...args);},
 pool:{async query(sql){if(sql.includes("'ordering_open'"))return {rows:[{setting_value:'true'}]};if(sql.includes("'song_price'"))return {rows:[{setting_value:'10'}]};assert.match(sql,/WITH submitted AS/);assert.match(sql,/RETURNING id[\s\S]*INSERT INTO order_admin_notifications/);saved=true;return {rows:[]};}},
 async trySendAdminOrderNotification(){assert.ok(saved);notices++;return 'requires_review';}};
vm.runInNewContext(route,context);
await handler({body:{customerName:'Alex',email:'alex@example.com',person:'Jamie',occasion:'Birthday',style:'Country',songLength:90,mood:'Celebratory',story:'A happy birthday'}},{status(n){status=n;return this;},json(v){body=v;return this;}});
assert.equal(status,200);assert.equal(body.ok,true);assert.equal(notices,1);
console.log('PASS: real customer submission queues and attempts arrival alert; failed notification preserves successful order response.');
