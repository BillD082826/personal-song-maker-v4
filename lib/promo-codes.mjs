import crypto from 'node:crypto';
export const promoSchema=`
CREATE TABLE IF NOT EXISTS promo_codes (
 id UUID PRIMARY KEY, code_hash TEXT UNIQUE NOT NULL, suffix TEXT NOT NULL,
 batch_id UUID NOT NULL, label TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL CHECK(kind IN ('free','percent')),
 percent INTEGER NOT NULL CHECK(percent BETWEEN 1 AND 100), expires_at TIMESTAMPTZ,
 state TEXT NOT NULL DEFAULT 'available' CHECK(state IN ('available','reserved','redeemed','disabled')),
 reserved_order_id TEXT UNIQUE REFERENCES orders(id), redeemed_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_id UUID REFERENCES promo_codes(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_base_amount NUMERIC(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_completed_at TIMESTAMPTZ;
`;
const fail=message=>{throw Object.assign(new Error(message),{promo:true});};
export function normalizeCode(value){const code=String(value||'').trim().toUpperCase();if(!/^LB-[A-F0-9]{24}$/.test(code))fail('This code is invalid or unavailable.');return code;}
const hash=code=>crypto.createHash('sha256').update(normalizeCode(code)).digest('hex');
export function discountedCents(amount,percent){const cents=Math.round(Number(amount)*100);if(!Number.isSafeInteger(cents)||cents<=0||!Number.isInteger(percent)||percent<1||percent>100)fail('This offer cannot be applied to this price.');return Math.round(cents*(100-percent)/100);}
export class PromoCodes {
 constructor(pool){this.pool=pool;}
 async transaction(fn){const c=await this.pool.connect();try{await c.query('BEGIN');const r=await fn(c);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 async create({quantity,kind,percent,expiresAt,label}){
  quantity=Number(quantity);percent=kind==='free'?100:Number(percent);
  if(!Number.isInteger(quantity)||quantity<1||quantity>100||!['free','percent'].includes(kind)||!Number.isInteger(percent)||percent<1||percent>99&&kind!=='free')fail('Choose 1–100 codes and a free song or 1–99% discount.');
  if(typeof label!=='string'||label.length>120)fail('Keep the batch label within 120 characters.');
  const expiry=expiresAt?new Date(expiresAt):null;if(expiry&&(!Number.isFinite(+expiry)||+expiry<=Date.now()))fail('Choose a future expiration date.');
  const batch=crypto.randomUUID(),codes=[];
  await this.transaction(async c=>{for(let i=0;i<quantity;i++){const code='LB-'+crypto.randomBytes(12).toString('hex').toUpperCase();await c.query('INSERT INTO promo_codes(id,code_hash,suffix,batch_id,label,kind,percent,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[crypto.randomUUID(),hash(code),code.slice(-4),batch,label,kind,percent,expiry]);codes.push(code);}});
  return {batchId:batch,codes,kind,percent,expiresAt:expiry};
 }
 async list(){return (await this.pool.query("SELECT id,suffix,batch_id,label,kind,percent,expires_at,CASE WHEN state='available' AND expires_at<=NOW() THEN 'expired' ELSE state END AS state,reserved_order_id,redeemed_at,created_at FROM promo_codes ORDER BY created_at DESC,id LIMIT 1000")).rows;}
 async disable(id){const r=await this.pool.query("UPDATE promo_codes SET state='disabled' WHERE id=$1 AND state='available' RETURNING id",[id]);if(!r.rowCount)fail('Only an available code can be disabled. Held or redeemed codes cannot be reused.');return {ok:true};}
 async checkout({orderId,previewToken,code,mode='quote'}){
  const digest=hash(code);
  return this.transaction(async c=>{
   const o=(await c.query('SELECT * FROM orders WHERE id=$1 AND preview_token=$2 FOR UPDATE',[orderId,previewToken])).rows[0];
   if(!o||o.is_test)fail('Open your saved song preview before using a code.');
   const p=(await c.query('SELECT * FROM promo_codes WHERE code_hash=$1 FOR UPDATE',[digest])).rows[0];
   if(!p)fail('This code is invalid or unavailable.');
   if(mode==='free'&&o.promo_completed_at&&o.promo_id===p.id&&p.state==='redeemed')return {ok:true,completed:true,total:'0.00'};
   if(o.status!=='New'||o.paid_at||o.promo_completed_at)fail('This order has already completed checkout or cannot use a code.');
   const held=p.state==='reserved'&&p.reserved_order_id===o.id&&o.promo_id===p.id;
   if(!held&&(p.state!=='available'||p.expires_at&&+new Date(p.expires_at)<=Date.now()))fail('This code is invalid or unavailable.');
   if(o.promo_id&&o.promo_id!==p.id||o.paypal_order_id&&!held)fail('Checkout has already started. Continue with its original offer.');
   if(o.includes_extra_version)fail('Codes cover one complete song. Remove the extra-version option first.');
   const base=held?o.promo_base_amount:o.price_amount;
   const cents=discountedCents(base,p.percent),total=(cents/100).toFixed(2);
   if(p.kind==='percent'&&cents<1)fail('The discounted total is too small for payment.');
   const result={ok:true,kind:p.kind,percent:p.percent,original:Number(base).toFixed(2),discount:((Math.round(Number(base)*100)-cents)/100).toFixed(2),total,held};
   if(mode==='quote')return result;
   if(mode==='reserve'&&p.kind!=='percent'||mode==='free'&&p.kind!=='free')fail('Choose the matching checkout option.');
   const open=await c.query("SELECT setting_value FROM store_settings WHERE setting_key='ordering_open'");if(open.rows[0]?.setting_value==='false')fail('Ordering is temporarily paused.');
   if(mode==='free'&&!o.music_data)fail('Create and choose your song preview first.');
   if(!held){await c.query("UPDATE promo_codes SET state='reserved',reserved_order_id=$2 WHERE id=$1",[p.id,o.id]);await c.query("UPDATE orders SET promo_id=$2,promo_base_amount=price_amount,price_amount=$3,paypal_order_id=$4 WHERE id=$1",[o.id,p.id,total,'promo:'+p.id]);}
   if(mode==='free'){
    await c.query("UPDATE orders SET price_amount=0,paid_at=NOW(),promo_completed_at=NOW(),paypal_order_id=NULL,status=CASE WHEN music_data IS NOT NULL THEN 'Ready' ELSE 'Paid' END WHERE id=$1",[o.id]);
    await c.query("UPDATE promo_codes SET state='redeemed',redeemed_at=NOW() WHERE id=$1",[p.id]);
    await c.query('INSERT INTO order_confirmation_emails(order_id) VALUES($1) ON CONFLICT DO NOTHING',[o.id]);
    return {...result,completed:true};
   }
   return result;
  });
 }
}
export function registerPromoRoutes(app,{pool,requireAdmin,limiter,origin,notifyConfirmation}){
 const store=new PromoCodes(pool);
 const exactOrigin=(req,res,next)=>req.headers.origin===origin?next():res.status(403).json({error:'Open this page on the LyriBop website.'});
 const wrap=fn=>async(req,res)=>{try{if(!pool)return res.status(503).json({error:'Order storage unavailable.'});res.set('Cache-Control','no-store');res.json(await fn(req));}catch(e){res.status(e.promo?409:500).json({error:e.promo?e.message:'Could not complete this code request. Refresh and review before trying again.'});}};
 app.get('/api/admin/promo-codes',requireAdmin,wrap(()=>store.list()));
 app.post('/api/admin/promo-codes',requireAdmin,exactOrigin,wrap(req=>store.create(req.body)));
 app.post('/api/admin/promo-codes/:id/disable',requireAdmin,exactOrigin,wrap(req=>store.disable(req.params.id)));
 app.post('/api/promo/quote',limiter,exactOrigin,wrap(req=>store.checkout({...req.body,mode:'quote'})));
 app.post('/api/promo/complete-free',limiter,exactOrigin,wrap(async req=>{const result=await store.checkout({...req.body,mode:'free'});await notifyConfirmation(req.body.orderId);return result;}));
 return store;
}
