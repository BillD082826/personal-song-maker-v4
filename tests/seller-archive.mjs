import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {setSellerArchived,installSellerArchiveRoutes} from '../lib/seller-archive.mjs';
test('invalid seller ids cannot reach the database',async()=>{
 for(const id of ['',0,-1,'1;DELETE FROM orders','not-a-seller'])await assert.rejects(setSellerArchived({query:()=>assert.fail()},id,true),{status:400});
});
test('archive and restore are admin-only and never delete accounting rows',async()=>{
 const routes=[],auth=()=>{};const pool={query:async(sql,args)=>{assert.doesNotMatch(sql,/DELETE\s+FROM|UPDATE\s+orders|UPDATE\s+seller_payouts/i);assert.match(sql,/active = FALSE/);assert.match(sql,/automatic_reports_enabled = FALSE/);assert.deepEqual(args,['7']);return {rows:[{id:7}]};}};
 installSellerArchiveRoutes({delete:(...args)=>routes.push(args),post:(...args)=>routes.push(args)},pool,auth);
 assert.equal(routes.length,2);for(const route of routes){assert.equal(route[1],auth);let response;await route[2]({params:{id:'7'}},{json:v=>{response=v;}});assert.equal(response.accountingPreserved,true);}
});
test('archived sellers cannot be reactivated by the normal edit endpoint; reports still include history',()=>{
 const source=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 const edit=source.slice(source.indexOf('app.patch("/api/admin/sellers/:id"'),source.indexOf('app.get("/api/admin/reports/sales"'));
 assert.match(edit,/WHERE id = \$7 AND archived_at IS NULL/);
 const list=source.slice(source.indexOf('app.get("/api/admin/sellers",'),source.indexOf('app.post("/api/admin/sellers",'));
 assert.match(list,/s.archived_at/);assert.doesNotMatch(list,/WHERE .*archived_at/);
});
test('real isolated PostgreSQL preserves orders, payouts, commissions and owed balance across archive/restore',{skip:!process.env.SELLER_ARCHIVE_TEST_DATABASE_URL && !process.env.SELLER_ARCHIVE_PGLITE_MODULE},async()=>{
 let pool;
 if(process.env.SELLER_ARCHIVE_PGLITE_MODULE){
   const {PGlite}=await import(process.env.SELLER_ARCHIVE_PGLITE_MODULE);const db=new PGlite();
   pool={query:(sql,args)=>sql.includes('CREATE TABLE')?db.exec(sql):db.query(sql,args),end:()=>db.close()};
 }else{const {default:pg}=await import('pg');pool=new pg.Pool({connectionString:process.env.SELLER_ARCHIVE_TEST_DATABASE_URL});}
 try{
 await pool.query(`CREATE TABLE sellers(id BIGINT PRIMARY KEY,name TEXT,referral_code TEXT UNIQUE,active BOOLEAN,automatic_reports_enabled BOOLEAN,archived_at TIMESTAMPTZ);
 CREATE TABLE seller_payouts(id BIGINT PRIMARY KEY,seller_id BIGINT REFERENCES sellers(id) ON DELETE RESTRICT,amount NUMERIC);
 CREATE TABLE orders(id TEXT PRIMARY KEY,seller_id BIGINT REFERENCES sellers(id) ON DELETE SET NULL,seller_commission_amount NUMERIC,seller_payout_id BIGINT REFERENCES seller_payouts(id));
 INSERT INTO sellers VALUES(7,'Example','EXAMPLE7',true,true,null);
 INSERT INTO seller_payouts VALUES(1,7,12.50);
 INSERT INTO orders VALUES('paid-history',7,12.50,1),('owed-history',7,7.25,null);`);
 const snapshot=async()=>({orders:(await pool.query('SELECT * FROM orders ORDER BY id')).rows,payouts:(await pool.query('SELECT * FROM seller_payouts ORDER BY id')).rows,owed:(await pool.query('SELECT SUM(seller_commission_amount) AS owed FROM orders WHERE seller_id=7 AND seller_payout_id IS NULL')).rows[0].owed});
 const before=await snapshot();const archived=await setSellerArchived(pool,'7',true);assert.ok(archived.archived_at);assert.equal(archived.active,false);assert.equal(archived.automatic_reports_enabled,false);assert.deepEqual(await snapshot(),before);
 const repeated=await setSellerArchived(pool,'7',true);assert.equal(+repeated.archived_at,+archived.archived_at);
 const restored=await setSellerArchived(pool,'7',false);assert.equal(restored.archived_at,null);assert.equal(restored.active,false);assert.equal(restored.automatic_reports_enabled,false);assert.deepEqual(await snapshot(),before);
 await pool.query('UPDATE sellers SET active=true WHERE id=7');await assert.rejects(setSellerArchived(pool,'7',false),{status:404});assert.equal((await pool.query('SELECT active FROM sellers WHERE id=7')).rows[0].active,true);
 }finally{await pool.end();}
});
