import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';
import {adminOriginPolicy} from '../lib/admin-origin.mjs';import {schedulerRouter} from '../lib/ad-scheduler.mjs';import {registerPromoRoutes} from '../lib/promo-codes.mjs';import {installIncomeTaxRoutes} from '../lib/income-tax-reserves.mjs';
const old='https://personal-song-maker-v5-test.onrender.com',admin='https://admin.lyribop.com',policy=adminOriginPolicy(old,admin);
test('only exact legacy and branded Admin origins are trusted',()=>{for(const origin of [old,admin])assert(policy.allows(origin));for(const value of [null,undefined,'null','https://lyribop.com','https://lyribop.onrender.com',admin+'/',admin+'.evil.test','http://admin.lyribop.com',admin+':444'])assert(!policy.allows(value));for(const bad of ['http://admin.lyribop.com',admin+'/path',admin+'?q=1','https://u:p@admin.lyribop.com'])assert.throws(()=>adminOriginPolicy(old,bad));});
test('scheduler allows authenticated alias writes while retaining origin/header/content-type requirements',async()=>{
 const app=express();app.use(express.json());let writes=0;app.use(schedulerRouter({enabled:true,store:{pause:async()=>{writes++;}},requireAdmin:(req,res,next)=>req.get('Authorization')==='Basic test'?next():res.sendStatus(401),publicOrigin:old,adminOriginAllowed:policy.allows}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{const url=`http://127.0.0.1:${server.address().port}/pause`;
 for(const origin of [old,admin]){const r=await fetch(url,{method:'POST',headers:{Authorization:'Basic test',Origin:origin,'Content-Type':'application/json','X-LyriBop-Scheduler':'1'},body:'{}'});assert.equal(r.status,200);}
 for(const change of [{Origin:'https://lyribop.com'},{Origin:admin+'.evil.test'},{Authorization:''},{'X-LyriBop-Scheduler':''}]){const r=await fetch(url,{method:'POST',headers:{Authorization:'Basic test',Origin:admin,'Content-Type':'application/json','X-LyriBop-Scheduler':'1',...change},body:'{}'});assert.ok([401,403].includes(r.status));}assert.equal(writes,2);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('promo and tax write guards accept the alias, never the customer storefront',async()=>{
 const routes=new Map();const app={get(){},post(path,...h){routes.set(path,h);},patch(path,...h){routes.set(path,h);}};registerPromoRoutes(app,{pool:{},requireAdmin:()=>{},limiter:()=>{},origin:old,adminOriginAllowed:policy.allows});
 for(const origin of [old,admin,'https://lyribop.com']){let allowed=false,status;routes.get('/api/admin/promo-codes')[1]({headers:{origin}},{status(n){status=n;return this;},json(){}},()=>allowed=true);assert.equal(allowed,origin!== 'https://lyribop.com');if(!allowed)assert.equal(status,403);}
 let touched=0;installIncomeTaxRoutes(app,{pool:{connect:async()=>{touched++;throw Error('Fixture stops before mutation');}},requireAdmin:()=>{},adminOrigin:old,adminOriginAllowed:policy.allows});
 for(const origin of [admin,'https://lyribop.com']){let status;await routes.get('/api/admin/income-tax-reserves')[1]({headers:{origin},body:{year:2026,version:0}},{status(n){status=n;return this;},json(){}});assert.equal(status,origin===admin?500:403);}assert.equal(touched,1);
});
