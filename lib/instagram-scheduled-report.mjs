import {deliverySnapshotHash} from './ad-delivery-records.mjs';
export function projectInstagramDelivery(row){
 if(row.platform!=='instagram'||! /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(row.plan_id||''))return null;
 const labels={reserved:'Delivery reserved — awaiting result',creating:'Preparing Instagram image',container_ready:'Instagram image ready',publishing:'Sending — confirmation pending',verifying:'Post returned — verification pending',closed_unverified:'Closed without verified publication',verified:'Verified scheduled post',needs_review:'Needs review — do not resend'};
 const result={plan_id:row.plan_id,platform:'instagram',state:'needs_review',display_status:labels.needs_review,verified_at:null,permalink:null};
 if(row.destination_id!=='17841431950776323'||row.snapshot?.platform!=='instagram'||row.snapshot_sha256!==deliverySnapshotHash(row.snapshot)||!row.scheduled_at||!row.plan_time||!Number.isFinite(+new Date(row.scheduled_at))||+new Date(row.scheduled_at)!==+new Date(row.plan_time)||!Object.hasOwn(labels,row.state))return result;
 result.state=row.state;result.display_status=labels[row.state];if(row.state!=='verified')return result;
 let u;try{u=new URL(row.permalink);}catch{}
 if(!/^\d+$/.test(row.remote_id||'')||!u||u.protocol!=='https:'||!['instagram.com','www.instagram.com'].includes(u.hostname)||!/^\/p\/[^/]+\/$/.test(u.pathname)||u.search||u.hash||u.port||u.username||u.password||!row.updated_at||!Number.isFinite(+new Date(row.updated_at)))return {...result,state:'needs_review',display_status:labels.needs_review};
 return {...result,permalink:u.href,verified_at:new Date(row.updated_at).toISOString()};
}
