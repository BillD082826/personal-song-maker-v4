import pg from 'pg';import {MetaPublishingConnections,META_DESTINATIONS} from '../lib/meta-publishing-connections.mjs';
const [action,...extra]=process.argv.slice(2);
if(!extra.length&&action==='--check')console.log(JSON.stringify({mode:'connections_offline_check',destinations:META_DESTINATIONS,publishing_enabled:false,worker_enabled:false}));
else if(!extra.length&&['--install-connection-registry','--activate-approved-meta-destinations','--deactivate-approved-meta-destinations'].includes(action)){
 const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});try{
 const store=new MetaPublishingConnections(pool);let result;
 if(action==='--install-connection-registry'){await store.install();result={mode:'connection_registry_installed',publishing_enabled:false,worker_enabled:false};}
 else if(action==='--activate-approved-meta-destinations')result=await store.activate({approved:true});
 else result=await store.deactivate({approved:true});
 console.log(JSON.stringify(result));
 }catch{console.error('Publishing connection setup could not complete. No publication attempted.');process.exitCode=1;}finally{await pool.end();}
}else{console.error('Use --check. Installation, registration and deactivation each require separate approval.');process.exitCode=1;}
