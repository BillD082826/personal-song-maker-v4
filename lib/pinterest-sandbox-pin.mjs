// One Sandbox-only Pin. Production Trial record is never queried or changed.
import {readFile} from 'node:fs/promises';
import {digest} from './instagram-test-post.mjs';
import {validateTrialPin,TrialPinError,safeTrialDiagnostic} from './pinterest-test-pin.mjs';
import {SandboxBoardGraph,SANDBOX_BOARD} from './pinterest-sandbox-board.mjs';
const original=JSON.parse(await readFile(new URL('../scripts/pinterest-test-pin.json',import.meta.url),'utf8'));
export const SANDBOX_PIN=Object.freeze({...original,test_id:'lyribop-sandbox-pin-v1',environment:'sandbox',board_id:'1138144205771385111',board_name:SANDBOX_BOARD.name,create_authorized:false,content_sha256:digest(JSON.stringify([original.title,original.description,original.link,'1138144205771385111']))});
const fail=()=>{throw new TrialPinError('Sandbox Pin needs review. Do not retry creation.');};
export function validateSandboxPin(image){validateTrialPin(original,image);}
export class SandboxPinGraph extends SandboxBoardGraph {
 async preflight(){await super.preflight();const b=await super.verify(SANDBOX_PIN.board_id);if(b.id!==SANDBOX_PIN.board_id||b.name!==SANDBOX_BOARD.name||b.description!==SANDBOX_BOARD.description||b.privacy!=='PUBLIC'||b.owner?.username?.toLowerCase()!=='lyribop')fail();}
 create(image){const s=SANDBOX_PIN;return this.call('/pins',{board_id:s.board_id,title:s.title,description:s.description,link:s.link,media_source:{source_type:'image_base64',content_type:'image/png',data:image.toString('base64')}});}
 verify(id){if(typeof id!=='string'||!/^\d+$/.test(id))fail();return this.call('/pins/'+id);}
}
export class SandboxPinStore {
 constructor(pool){this.pool=pool;}
 async reserve(){await this.pool.query("CREATE TABLE IF NOT EXISTS ad_scheduler_pinterest_sandbox_pins(test_id TEXT PRIMARY KEY,environment TEXT NOT NULL CHECK(environment='sandbox'),board_id TEXT NOT NULL,image_sha256 TEXT NOT NULL,content_sha256 TEXT NOT NULL,state TEXT NOT NULL,pin_id TEXT,diagnostic JSONB,updated_at TIMESTAMPTZ NOT NULL DEFAULT now())");const s=SANDBOX_PIN;return(await this.pool.query("INSERT INTO ad_scheduler_pinterest_sandbox_pins(test_id,environment,board_id,image_sha256,content_sha256,state) VALUES($1,'sandbox',$2,$3,$4,'reserved') ON CONFLICT DO NOTHING RETURNING test_id",[s.test_id,s.board_id,s.image_sha256,s.content_sha256])).rowCount===1;}
 async mark(state,id=null,diagnostic=null){await this.pool.query('UPDATE ad_scheduler_pinterest_sandbox_pins SET state=$2,pin_id=COALESCE($3,pin_id),diagnostic=$4,updated_at=now() WHERE test_id=$1',[SANDBOX_PIN.test_id,state,id,diagnostic?JSON.stringify(safeTrialDiagnostic(diagnostic)):null]);}
}
export async function runSandboxPin({config,image,store,graph,approved=false}){
 validateSandboxPin(image);if(approved!==true||config?.environment!=='sandbox'||config?.appId!=='1628874'||config?.origin!=='https://personal-song-maker-v5-test.onrender.com')fail();await graph.preflight();if(!await store.reserve())throw new TrialPinError('Sandbox Pin already has a record. No second creation.');
 let stage='creating';try{await store.mark(stage);const p=await graph.create(image);if(typeof p?.id!=='string'||!/^\d+$/.test(p.id))fail();stage='verifying';await store.mark(stage,p.id);const v=await graph.verify(p.id),s=SANDBOX_PIN;if(v.id!==p.id||v.board_id!==s.board_id||v.title!==s.title||v.description!==s.description||v.link!==s.link||v.is_owner!==true)fail();await store.mark('verified_sandbox',p.id);return{status:'verified_sandbox',environment:'sandbox',pin_id:p.id,board_id:s.board_id,publishing_enabled:false};}catch(e){const d=safeTrialDiagnostic(e?.diagnostic);try{await store.mark('needs_review_'+stage,null,d);}catch{}throw new TrialPinError('Sandbox Pin stopped at '+stage+'. Do not retry creation; review saved record.',d);}
}
