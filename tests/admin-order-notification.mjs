import assert from 'node:assert/strict';
import {createAdminOrderNotifier} from '../lib/admin-order-notification.mjs';
let state, sends, rejectStatus, throws, configured=true, paid=true;
const pool={async query(sql,args){
 if(sql.startsWith('SELECT state'))return {rowCount:state?1:0,rows:state?[{state}]:[]};
 if(sql.startsWith('SELECT id'))return {rows:paid?[{id:'test-paid',customer_name:'Alex',person:'Jamie',occasion:'Anniversary',song_title:'Our Song',price_amount:10}]:[]};
 if(sql.startsWith("UPDATE order_admin_notifications SET state='sending'")){if(state!=='pending')return {rowCount:0};state='sending';return {rowCount:1};}
 if(sql.includes("state='sent'")){state='sent';return {};}
 if(sql.includes('state=$2')){if(state==='sending')state=args[1];return {};}
 throw Error(sql);
}};
function notifier(){return createAdminOrderNotifier({getPool:()=>pool,env:configured?{RESEND_API_KEY:'fake'}:{},report(){},fetchEmail:async(_url,options)=>{
 sends++;assert.equal(state,'sending');const data=JSON.parse(options.body);assert.deepEqual(data.to,['lyribop@gmail.com']);assert.match(data.subject,/New paid/);assert.match(options.headers['Idempotency-Key'],/^admin-paid-/);if(throws)throw Error('timeout');return {ok:!rejectStatus,status:rejectStatus||200,json:async()=>({id:'provider-test'})};
}});}
function reset(){state='pending';sends=0;rejectStatus=0;throws=false;configured=true;paid=true;}
reset();await Promise.all([notifier()('test'),notifier()('test')]);assert.equal(sends,1);assert.equal(state,'sent');await notifier()('test');assert.equal(sends,1);
for(const protectedState of ['sent','sending','uncertain','failed',null]){reset();state=protectedState;await notifier()('test');assert.equal(sends,0);}
reset();configured=false;assert.equal(await notifier()('test'),'pending');assert.equal(sends,0);
reset();paid=false;assert.equal(await notifier()('test'),'not_paid');assert.equal(sends,0);
for(const status of [400,409,500]){reset();rejectStatus=status;await notifier()('test');assert.equal(state,status===400?'failed':'uncertain');await notifier()('test');assert.equal(sends,1);}
reset();throws=true;await notifier()('test');assert.equal(state,'uncertain');
console.log('PASS: paid-order alerts, recipient, concurrent/repeated claims, no historical backfill, missing configuration and uncertain/rejected provider outcomes (mocked).');
