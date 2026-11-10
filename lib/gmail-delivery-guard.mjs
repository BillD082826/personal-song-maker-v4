import {createHash} from 'node:crypto';
export const GMAIL_DELIVERY_SCHEMA=`CREATE TABLE IF NOT EXISTS gmail_delivery_emails (
 order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
 payload_hash TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('sending','sent','failed','uncertain')),
 provider_message_id TEXT,attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),sent_at TIMESTAMPTZ
);`;
export async function guardedGmailDelivery(pool,orderId,email,send){
 const hash=createHash('sha256').update(JSON.stringify(email)).digest('hex');
 let claim=await pool.query("INSERT INTO gmail_delivery_emails(order_id,payload_hash,state) VALUES($1,$2,'sending') ON CONFLICT DO NOTHING RETURNING order_id",[orderId,hash]);
 if(!claim.rowCount){
  const previous=(await pool.query('SELECT payload_hash,state,provider_message_id FROM gmail_delivery_emails WHERE order_id=$1',[orderId])).rows[0];
  if(previous?.payload_hash!==hash)throw Error('Delivery details changed. Review the previous email before sending again.');
  if(previous.state==='sent')return {id:previous.provider_message_id,already_sent:true};
  if(previous.state!=='failed')throw Error('A delivery email is pending or uncertain. Check Gmail Sent before trying again.');
  claim=await pool.query("UPDATE gmail_delivery_emails SET state='sending',attempted_at=now() WHERE order_id=$1 AND payload_hash=$2 AND state='failed' RETURNING order_id",[orderId,hash]);
  if(!claim.rowCount)throw Error('Delivery email is already being handled.');
 }
 let state='uncertain';
 try{
  const r=await send();if(!r.ok){state=r.status===409||r.status>=500?'uncertain':'failed';const data=await r.json().catch(()=>({}));throw Error(data.message||'Delivery email could not be sent.');}
  const data=await r.json();if(typeof data.id!=='string'||!data.id)throw Error('Email acceptance needs review.');
  await pool.query("UPDATE gmail_delivery_emails SET state='sent',provider_message_id=$2,sent_at=now() WHERE order_id=$1 AND state='sending'",[orderId,data.id]);return data;
 }catch(e){await pool.query("UPDATE gmail_delivery_emails SET state=$2 WHERE order_id=$1 AND state='sending'",[orderId,state]);throw e;}
}
