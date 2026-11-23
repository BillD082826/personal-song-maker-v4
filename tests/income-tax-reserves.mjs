import test from 'node:test';import assert from 'node:assert/strict';
import {INCOME_TAX_SCHEMA,reserveInput,reserveSummary,saveReserveSettings,installIncomeTaxRoutes} from '../lib/income-tax-reserves.mjs';
test('unset rates are not misrepresented as zero taxes; deliberate zero is supported',()=>{const unset=reserveSummary(100);assert.equal(unset.stateReserve,null);assert.equal(unset.salesAfterReserves,null);const zero=reserveSummary(100,{state_percent:0,federal_percent:0});assert.equal(zero.stateRemaining,0);assert.equal(zero.salesAfterReserves,100);});
test('reserves are allocations of gross price, not added checkout tax or reduced gross sales',()=>{const s=reserveSummary(100,{state_percent:5,federal_percent:20,state_paid:2,federal_paid:25});assert.equal(s.sales,100);assert.equal(s.stateReserve,5);assert.equal(s.federalReserve,20);assert.equal(s.stateRemaining,3);assert.equal(s.federalRemaining,0);assert.equal(s.salesAfterReserves,75);assert.equal(reserveSummary(10.10,{state_percent:5}).stateReserve,.51);});
test('invalid financial inputs are rejected before database access',async()=>{const valid={year:2026,version:0,statePercent:5,federalPercent:20,statePaid:0,federalPaid:0};for(const bad of [{statePercent:-1},{federalPercent:101},{statePercent:70,federalPercent:40},{statePaid:-1},{statePaid:'0.001'},{statePaid:'1e5'},{year:1999},{version:-1}])await assert.rejects(saveReserveSettings({connect:()=>assert.fail()}, {...valid,...bad}),{status:400});assert.equal(reserveInput({...valid,statePercent:null}).statePercent,null);});
test('routes require Admin, and a customer-origin write never reaches the database',async()=>{const routes=[],auth=()=>{};installIncomeTaxRoutes({get:(...args)=>routes.push(args),patch:(...args)=>routes.push(args)},{pool:{connect:()=>assert.fail()},requireAdmin:auth,adminOrigin:'https://admin.example'});for(const route of routes)assert.equal(route[1],auth);let status;await routes[1][2]({headers:{origin:'https://lyribop.com'}},{status(v){status=v;return this;},json(){}});assert.equal(status,403);});
test('isolated PostgreSQL settings persist by year, audit every change, prevent stale edits and leave orders intact',{skip:!process.env.TAX_RESERVE_PGLITE_MODULE},async()=>{
 const {PGlite}=await import(process.env.TAX_RESERVE_PGLITE_MODULE);const db=new PGlite();const pool={connect:async()=>({query:(...a)=>db.query(...a),release(){}})};
 try{
 await db.exec(INCOME_TAX_SCHEMA);await db.exec("CREATE TABLE orders(id TEXT PRIMARY KEY,price_amount NUMERIC);INSERT INTO orders VALUES('paid-1',10.00)");
 const before=(await db.query('SELECT * FROM orders')).rows;
 const input={year:2026,version:0,statePercent:5,federalPercent:20,statePaid:1,federalPaid:2};
 const saved=await saveReserveSettings(pool,input);assert.equal(saved.version,1);assert.equal(saved.state_percent,'5.000');
 await assert.rejects(saveReserveSettings(pool,{...input,statePaid:3}),{status:409});
 const changed=await saveReserveSettings(pool,{...input,version:1,statePaid:3});assert.equal(changed.version,2);
 assert.equal((await db.query('SELECT COUNT(*) AS count FROM income_tax_reserve_changes')).rows[0].count,2);
 await saveReserveSettings(pool,{...input,year:2027,statePercent:null,federalPercent:null});assert.equal((await db.query('SELECT state_paid FROM income_tax_reserve_settings WHERE tax_year=2026')).rows[0].state_paid,'3.00');
 assert.deepEqual((await db.query('SELECT * FROM orders')).rows,before);
 }finally{await db.close();}
});
