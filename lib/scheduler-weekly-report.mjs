// Summarizes existing verified receipts; never contacts providers or changes plans.
export function weeklySchedulerReport(state,start,now=new Date()){
 if(typeof start!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(start))throw Error('Choose a valid report start date.');
 const first=new Date(start+'T12:00:00Z');if(!Number.isFinite(+first)||first.toISOString().slice(0,10)!==start||!Number.isFinite(+now))throw Error('Choose a valid report start date.');
 const last=new Date(first);last.setUTCDate(last.getUTCDate()+6);const end=last.toISOString().slice(0,10);
 const totals=()=>({verified:0,upcoming:0,overdue:0,in_progress:0,needs_review:0,canceled:0});
 const platforms={facebook:totals(),instagram:totals(),pinterest:totals()},seen=new Set(),items=[];
 for(const p of state.plans||[]){
  if(!Object.hasOwn(platforms,p.platform)||p.local_day<start||p.local_day>end)continue;
  if(typeof p.id!=='string'||seen.has(p.id)||!/^\d{4}-\d{2}-\d{2}$/.test(p.local_day)||!/^\d{2}:\d{2}$/.test(p.local_time)||!Number.isFinite(Date.parse(p.scheduled_at)))throw Error('Saved report data needs review.');seen.add(p.id);
  const d=p.delivery;let outcome;
  if(d?.state==='verified')outcome='verified';else if(d?.state==='needs_review')outcome='needs_review';else if(d)outcome='in_progress';else if(p.status==='canceled')outcome='canceled';else outcome=Date.parse(p.scheduled_at)<=+now?'overdue':'upcoming';
  platforms[p.platform][outcome]++;
  items.push({plan_id:p.id,platform:p.platform,name:typeof p.snapshot?.name==='string'?p.snapshot.name.slice(0,200):'Advertisement',day:p.local_day,time:p.local_time,outcome,verified_at:outcome==='verified'?d.verified_at:null,audience_metrics:{status:'not_connected',reach:null,views:null,engagement:null,clicks:null}});
 }
 items.sort((a,b)=>(a.day+a.time+a.platform).localeCompare(b.day+b.time+b.platform));
 return {mode:'scheduler_weekly_report',start,end,time_zone:'America/New_York',collected_at:now.toISOString(),platforms,items,scope:'Plans scheduled in this seven-day window; audience metrics are not connected for these ads.',posts_changed:0,provider_requests:0};
}
