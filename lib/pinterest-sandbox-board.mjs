// Isolated Sandbox board only. Never uses the production Trial Pin guard.
import {TrialPinError,safeTrialDiagnostic} from './pinterest-test-pin.mjs';
export const SANDBOX_BOARD=Object.freeze({test_id:'lyribop-sandbox-board-v1',environment:'sandbox',account_id:'1138144274488601260',username:'lyribop',name:'LyriBop Scheduler Sandbox Test',description:'Isolated LyriBop scheduler testing. No live advertising.',privacy:'PUBLIC'});
const fail=()=>{throw new TrialPinError('Sandbox board needs review. Do not retry creation.');};
export class SandboxBoardGraph {
 constructor(token,fetchImpl=fetch){this.token=token;this.fetch=fetchImpl;}
 async call(path,body){let r,d;try{r=await this.fetch('https://api-sandbox.pinterest.com/v5'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+this.token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(20000)});}catch{throw new TrialPinError('Sandbox request unconfirmed.',{kind:'network_error'});}try{d=await r.json();}catch{throw new TrialPinError('Sandbox response unreadable.',{kind:'invalid_json',http_status:r.status});}if(!r.ok)throw new TrialPinError('Sandbox request not confirmed.',{kind:'http_error',http_status:r.status,provider_code:d?.code});return d;}
 async preflight(){const a=await this.call('/user_account');if(a.id!==SANDBOX_BOARD.account_id||a.username?.toLowerCase()!==SANDBOX_BOARD.username||a.account_type!=='BUSINESS')fail();}
 create(){const {name,description,privacy}=SANDBOX_BOARD;return this.call('/boards',{name,description,privacy});}
 verify(id){if(typeof id!=='string'||!/^\d+$/.test(id))fail();return this.call('/boards/'+id);}
}
export class SandboxBoardStore {
 constructor(pool){this.pool=pool;}
 async reserve(){await this.pool.query('CREATE TABLE IF NOT EXISTS ad_scheduler_pinterest_sandbox_boards(test_id TEXT PRIMARY KEY,environment TEXT NOT NULL CHECK(environment=\'sandbox\'),state TEXT NOT NULL,board_id TEXT,diagnostic JSONB,updated_at TIMESTAMPTZ NOT NULL DEFAULT now())');return (await this.pool.query("INSERT INTO ad_scheduler_pinterest_sandbox_boards(test_id,environment,state) VALUES($1,'sandbox','reserved') ON CONFLICT DO NOTHING RETURNING test_id",[SANDBOX_BOARD.test_id])).rowCount===1;}
 async mark(state,id=null,diagnostic=null){await this.pool.query('UPDATE ad_scheduler_pinterest_sandbox_boards SET state=$2,board_id=COALESCE($3,board_id),diagnostic=$4,updated_at=now() WHERE test_id=$1',[SANDBOX_BOARD.test_id,state,id,diagnostic?JSON.stringify(safeTrialDiagnostic(diagnostic)):null]);}
}
export async function runSandboxBoard({config,store,graph,approved=false}){
 if(approved!==true||config?.environment!=='sandbox'||config?.appId!=='1628874'||config?.origin!=='https://personal-song-maker-v5-test.onrender.com')fail();
 await graph.preflight();if(!await store.reserve())throw new TrialPinError('Sandbox board already has a record. No second creation.');
 let stage='creating';try{await store.mark(stage);const b=await graph.create();if(typeof b?.id!=='string'||!/^\d+$/.test(b.id))fail();stage='verifying';await store.mark(stage,b.id);const v=await graph.verify(b.id);if(v.id!==b.id||v.name!==SANDBOX_BOARD.name||v.description!==SANDBOX_BOARD.description||v.privacy!=='PUBLIC'||v.owner?.username?.toLowerCase()!=='lyribop')fail();await store.mark('verified_sandbox',b.id);return {status:'verified_sandbox',environment:'sandbox',board_id:b.id,name:v.name,publishing_enabled:false};}catch(e){const d=safeTrialDiagnostic(e?.diagnostic);try{await store.mark('needs_review_'+stage,null,d);}catch{}throw new TrialPinError('Sandbox board stopped at '+stage+'. Do not retry creation; review saved record.',d);}
}
