import crypto from 'node:crypto';

// A persistent claim prevents duplicate alerts, including beyond provider deduplication windows.
export function createAdminOrderNotifier({getPool, fetchEmail = fetch, env = process.env, report = console.error}) {
  return async function notifyPaidOrder(orderId) {
    const pool=getPool(); if(!pool)return 'unavailable';
    try {
      const queued=await pool.query('SELECT state FROM order_admin_notifications WHERE order_id=$1',[orderId]);
      if(!queued.rowCount)return 'not_queued';
      if(queued.rows[0].state!=='pending')return queued.rows[0].state;
      if(!env.RESEND_API_KEY) return 'pending';
      const result=await pool.query('SELECT id, customer_name, person, occasion, song_title, price_amount FROM orders WHERE id=$1 AND paid_at IS NOT NULL AND paypal_capture_id IS NOT NULL',[orderId]);
      const order=result.rows[0]; if(!order)return 'not_paid';
      const claim=await pool.query("UPDATE order_admin_notifications SET state='sending', attempted_at=NOW() WHERE order_id=$1 AND state='pending' RETURNING order_id",[orderId]);
      if(!claim.rowCount)return 'already_claimed';
      let state='uncertain';
      try {
        const text=`New paid LyriBop order: ${order.id}\nCustomer: ${order.customer_name}\nFor: ${order.person}\nOccasion: ${order.occasion}\nSong: ${order.song_title || 'In preparation'}\nAmount: $${Number(order.price_amount).toFixed(2)}\n\nOpen your LyriBop Admin Orders to review. Customer photos and private delivery links are not included in this alert.`;
        const response=await fetchEmail('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':'admin-paid-'+crypto.createHash('sha256').update(orderId).digest('hex')},body:JSON.stringify({from:env.RESEND_FROM_EMAIL || 'LyriBop <onboarding@resend.dev>',to:['lyribop@gmail.com'],subject:('New paid LyriBop order — '+order.id).replace(/[\r\n]/g,' '),text})});
        if(!response.ok){state=response.status>=500 || response.status===409?'uncertain':'failed';throw new Error('Order alert provider response: '+response.status);}
        const data=await response.json();if(!data.id)throw new Error('Order alert missing message ID.');
        await pool.query("UPDATE order_admin_notifications SET state='sent', provider_message_id=$2, sent_at=NOW() WHERE order_id=$1",[orderId,data.id]);return 'sent';
      }catch(error){await pool.query("UPDATE order_admin_notifications SET state=$2 WHERE order_id=$1 AND state='sending'",[orderId,state]);throw error;}
    }catch(error){report('Admin order alert needs review:',error.message);return 'requires_review';}
  };
}
