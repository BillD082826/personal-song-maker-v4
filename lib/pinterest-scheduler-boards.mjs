// Read-only board selection for saved plans; never activates or publishes Pins.
import {PinterestStore,PinterestGraph,pinterestConfiguration} from './pinterest-connection.mjs';
export function pinterestSchedulerBoards({pool,env=process.env,publicBase,store=new PinterestStore(pool),graph=new PinterestGraph(),clock=()=>Date.now()}){
 let last=null,at=0,pending=null;
 return async()=>{
  if(env.AD_SCHEDULER_ENABLED!=='true'||env.AD_SCHEDULER_PINTEREST_CONNECTIONS_ENABLED!=='true'||env.AD_SCHEDULER_PINTEREST_PIN_REVIEW_ENABLED!=='true')throw Error('Pinterest board access is unavailable. Save a draft without a board.');
  if(last&&clock()-at>=0&&clock()-at<60000)return last;if(pending)return pending;
  pending=(async()=>{const c=pinterestConfiguration(env,publicBase,'production');if(c.origin!=='https://personal-song-maker-v5-test.onrender.com')throw Error('Pinterest scheduler origin needs review.');
   const token=await store.boardAuthorization(c,{readOnly:true});const account=await graph.identity(token,c);if(account.id!=='1138144274488601260'||account.username.toLowerCase()!=='lyribop'||account.account_type!=='BUSINESS')throw Error('Pinterest account needs review.');
   const boards=await graph.boards(token,c);if(!Array.isArray(boards)||boards.length>1000||new Set(boards.map(b=>b.id)).size!==boards.length||boards.some(b=>!/^\d+$/.test(b.id)||typeof b.name!=='string'||!b.name.trim()||b.name.length>200))throw Error('Pinterest boards need review.');
   last={boards:boards.map(b=>({id:b.id,name:b.name})),publishing_enabled:false,account:'lyribop'};at=clock();return last;
  })().finally(()=>{pending=null;});return pending;
 };
}
