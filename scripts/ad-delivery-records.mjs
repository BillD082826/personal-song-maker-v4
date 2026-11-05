import pg from 'pg';
import {DeliveryRecords,validateDeliveryInstallation} from '../lib/ad-delivery-records.mjs';
const args=process.argv.slice(2);
if(args.length===1&&args[0]==='--check'){
 console.log(JSON.stringify({mode:'delivery_records_offline_check',publishing_enabled:false,provider_requests:0,plans_changed:0}));
}else if(args.length===1&&args[0]==='--install-delivery-records'){
 validateDeliveryInstallation(process.env);
 const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
 try{
  await new DeliveryRecords(pool).install();
  const result=await pool.query('SELECT count(*)::int AS records FROM ad_scheduler_deliveries');
  console.log(JSON.stringify({mode:'delivery_records_installed',delivery_records:result.rows[0].records,publishing_enabled:false,provider_requests:0,plans_changed:0,connections_activated:0}));
 }catch{console.error('Delivery storage setup could not complete. No publication attempted.');process.exitCode=1;}finally{await pool.end();}
}else{console.error('Use --check or the separately approved --install-delivery-records command.');process.exitCode=1;}
