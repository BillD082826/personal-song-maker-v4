'use strict';
const $ = id => document.getElementById(id);
const hosted = location.pathname.startsWith('/admin/ad-scheduler');
const apiBase = hosted ? '/api/admin/ad-scheduler' : '/api/scheduler';
const savedLocation = hosted ? 'in LyriBop’s hosted database' : 'on this Mac';
let state = {plans: [], catalog: [], paused: false}, busy = false, activeView = 'schedule';
function tell(text) { $('message').textContent = text; }
function dates() {
  return Array.from({length:7}, (_,i) => {
    const d = new Date(state.today+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+i);
    return d.toISOString().slice(0,10);
  });
}
function chosen() { return state.catalog.find(a=>String(a.id)===$('ad').value && a.platform===$('platform').value); }
async function request(path, data) {
  const options = {cache:'no-store'};
  if (data !== undefined) Object.assign(options, {method:'POST',headers:{'Content-Type':'application/json','X-LyriBop-Scheduler':'1'},body:JSON.stringify(data)});
  const response = await fetch(apiBase+path, options);
  if (!(response.headers.get('content-type')||'').includes('application/json')) throw new Error('The dashboard server needs its scheduler update. Restart it, then reload this page.');
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Could not save this change.');
  return result;
}
async function refresh() { state = await request(''); render(); }
async function action(task) {
  if (busy) return;
  busy=true; document.querySelectorAll('button').forEach(b=>b.disabled=true);
  try { await task(); } catch(error) { tell(error.message); }
  finally {busy=false; document.querySelectorAll('button').forEach(b=>b.disabled=b.dataset.controlUnavailable==='true');}
}
function view(v) {
  activeView=v;
  for (const id of ['schedule','planner','report','performance','connections','controls']) $(id).hidden=id!==v;
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed', String(b.dataset.view===v)));
  render();
  if(v==='controls')action(loadSchedulerControls);
  if(v==='connections'){loadMetaConnections();loadPinterestConnections();loadPinterestSandbox();}
}
function preview() {
  const a=chosen(); if(!a) return;
  $('art').src=a.image; $('adname').textContent=a.name;
  $('caption').value=a.caption;
  $('pin-fields').hidden=a.platform!=='pinterest';
  $('pin-title').value=a.pin_title; $('destination').value=a.destination;
}
function populate() {
  const list=state.catalog.filter(a=>a.platform===$('platform').value && a.ready);
  $('ad').replaceChildren(...list.map(a=>new Option(a.name,a.id)));
  preview();
}
function payload(slots) {
  const a=chosen(); if(!a) throw new Error('Choose an approved advertisement.');
  // Browser-local Archive/Draft overrides must not be silently scheduled either.
  const override=localStorage.getItem('lyribop-status-static-'+a.id);
  if(override && override!=='Ready to Post') throw new Error('This ad is marked '+override+' in this browser. Review its status in All Ads first.');
  return {ad_id:a.id,platform:a.platform,caption:$('caption').value,pin_title:$('pin-title').value,destination:$('destination').value,slots,...(a.platform==='pinterest'&&hosted&&$('pin-board').value?{board_id:$('pin-board').value}:{})};
}
function text(tag, value, className) { const e=document.createElement(tag); e.textContent=value; if(className)e.className=className; return e; }
function render() {
  const facebookEnabled=state.facebook_worker?.enabled===true,instagramEnabled=state.instagram_worker?.enabled===true;
  const enabledPlatforms=[facebookEnabled?"Facebook":null,instagramEnabled?"Instagram":null].filter(Boolean).join(" & ");
  $('scheduler-mode').textContent=enabledPlatforms?enabledPlatforms+' scheduling enabled — explicitly approved posts only.':'Saved planner — automatic posting is off.';
  $('publishing-badge').textContent=enabledPlatforms?enabledPlatforms+' approval required':'Automatic posting off';
  $('verified-count').textContent=(state.verified_posts||[]).length+state.plans.filter(p=>p.delivery?.state==='verified').length;
  $('facebook-checkpoint').textContent=facebookEnabled?'Facebook scheduling enabled · approved posts only':(state.verified_posts||[]).some(p=>p.platform==='facebook')?'Test post verified · automatic posting off':'Publishing test incomplete · setup required';
  $('instagram-checkpoint').textContent=instagramEnabled?'Instagram scheduling enabled · approved posts only':(state.verified_posts||[]).some(p=>p.platform==='instagram')?'Test post verified · automatic posting off':'Login configuration saved · account review pending';
  $('count').textContent=state.plans.filter(p=>p.status==='planned').length;
  $('pause').textContent=state.paused?'Resume Plan':'Pause Plan';
  const days=$('days'); days.replaceChildren();
  for(const d of dates()) {
    const col=text('div','', 'day');
    col.append(text('strong',new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'})));
    const rows=state.plans.filter(p=>p.local_day===d && p.status==='planned' && ($('plan-platform').value==='all'||p.platform===$('plan-platform').value));
    for(const p of rows) {
      const card=text('div','', 'post');
      card.append(text('p',p.local_time+' ET · '+p.platform+' · '+p.snapshot.name),text('small',p.display_status));
      const details=text('button','View saved ad','secondary'); details.onclick=()=>showSnapshot(p);
      const cancel=text('button','Cancel plan','secondary'); cancel.onclick=()=>action(async()=>{
        await request('/cancel',{id:p.id}); await refresh(); tell('Plan canceled. Its record remains in the report.');
      });
      card.append(details);if(!p.delivery)card.append(cancel);col.append(card);
    }
    if(!rows.length) col.append(text('p','No plans'));
    days.append(col);
  }
  const tbody=$('report').querySelector('tbody'); tbody.replaceChildren();
  for(const p of state.plans) {
    const tr=document.createElement('tr');
    for(const value of [p.snapshot.name,p.platform,p.local_day+' '+p.local_time+' ET',p.delivery?.verified_at?new Date(p.delivery.verified_at).toLocaleString('en-US',{timeZone:'America/New_York'}):'—'])tr.append(text('td',value));
    const result=text('td',p.display_status);if(p.delivery?.state==='verified'){const link=safePostLink(p.delivery.permalink,p.platform);if(link){result.append(document.createTextNode(' · '),link);}}tr.append(result);
    tbody.append(tr);
  }
  for(const post of state.verified_posts||[]){
    const tr=document.createElement('tr');
    for(const value of [post.name,post.platform,'Manual test',new Date(post.verified_at).toLocaleString('en-US',{timeZone:'America/New_York'})])tr.append(text('td',value));
    const td=text('td',post.status+' · '),link=safePostLink(post.permalink,post.platform);if(link)td.append(link);tr.append(td);tbody.append(tr);
  }
  if(!state.plans.length&&!(state.verified_posts||[]).length) {const tr=document.createElement('tr'),td=text('td','No saved plans or verified publication records.','muted');td.colSpan=5;tr.append(td);tbody.append(tr);}
}
function safePostLink(value,platform){
  let url;try{url=new URL(value);}catch{return null;}
  const valid=platform==='instagram'?['www.instagram.com','instagram.com'].includes(url.hostname)&&/^\/p\/[^/]+\/?$/.test(url.pathname):platform==='facebook'?['www.facebook.com','facebook.com'].includes(url.hostname)&&/^\/\d+\/posts\/\d+\/?$/.test(url.pathname):false;
  if(!valid||url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash)return null;
  const link=text('a',platform==='facebook'?'View Facebook post':'View Instagram post');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';return link;
}
function showSnapshot(p) {
  const dialog=document.createElement('dialog');dialog.style.maxWidth='650px';
  dialog.append(text('h2',p.snapshot.name),text('p',p.local_day+' '+p.local_time+' ET · '+p.display_status));
  const img=document.createElement('img');img.src=apiBase+'/artwork/'+p.snapshot.image_sha256;img.className='art';img.alt=p.snapshot.name;
  const caption=text('p',p.snapshot.caption);caption.style.whiteSpace='pre-wrap';dialog.append(img,caption);
  if(p.snapshot.pinterest_board)dialog.append(text('p','Pinterest board: '+p.snapshot.pinterest_board.name+' · @'+p.snapshot.pinterest_board.account));
  if(p.snapshot.pin_title)dialog.append(text('p',p.snapshot.pin_title),text('p',p.snapshot.destination));
  const close=text('button','Close');close.onclick=()=>dialog.close();dialog.append(close);
  dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();close.focus();
}
function download(body,type,name) {const u=URL.createObjectURL(new Blob([body],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function csvCell(v){return '"'+String(v).replace(/"/g,'""').replace(/^[=+@\-\t\r]/,"'$&")+'"';}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));
$('platform').onchange=populate; $('ad').onchange=preview; $('plan-platform').onchange=render;
$('form').onsubmit=e=>{e.preventDefault();action(async()=>{
  await request('/plans',payload([{day:$('day').value,time:$('time').value}]));
  await refresh();tell('Plan saved '+savedLocation+'. Facebook and Instagram need separate approval. Pinterest remains a draft.');
});};
$('week').onclick=()=>action(async()=>{
  // Fixed daytime slots avoid the repeated/nonexistent early-morning DST hour.
  const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
  const slots=dates().flatMap(day=>['09:00','13:00','18:00'].filter(t=>day>state.today||t>clock).map(time=>({day,time})));
  if(!slots.length)throw new Error('No future slots available. Reload the planner.');
  if(!confirm('Save '+slots.length+' plans for '+$('platform').selectedOptions[0].text+' using this same ad at 9 AM, 1 PM and 6 PM? Nothing will publish.'))return;
  const result=await request('/plans',payload(slots));await refresh();view('planner');tell(result.saved+' plans saved. Facebook and Instagram need separate approval. Pinterest remains a draft.');
});
$('pause').onclick=()=>action(async()=>{await request('/pause',{paused:!state.paused});await refresh();tell(state.paused?'Plan paused. No new scheduled sends will start.':'Plan resumed. Only approved posts are eligible when the scheduler is enabled.');});
$('export').onclick=()=>download(JSON.stringify({publishing_enabled:state.facebook_worker?.enabled===true||state.instagram_worker?.enabled===true,time_zone:'America/New_York',plans:state.plans},null,2),'application/json','LyriBop-saved-plans.json');
$('csv').onclick=()=>{const rows=[['Advertisement','Platform','Planned Eastern time','Planned UTC time','Verification time UTC','Status','Post link'],...state.plans.map(p=>[p.snapshot.name,p.platform,p.local_day+' '+p.local_time,p.scheduled_at,p.delivery?.verified_at||'',p.display_status,p.delivery?.state==='verified'?p.delivery.permalink:'']),...(state.verified_posts||[]).map(p=>[p.name,p.platform,'Manual test','',p.verified_at,p.status,p.permalink])];download(rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8','LyriBop-posting-report.csv');};
if(hosted){if($('hosted-planner'))$('hosted-planner').hidden=true;$('storage-note').textContent='Plans are saved in LyriBop’s hosted database. Saving a plan does not publish it.';$('dashboard-return').textContent='← Back to Main Dashboard (this Mac)';}
action(async()=>{await refresh();populate();$('day').min=state.today;$('day').max=dates()[6];$('day').value=state.today;view(activeView);});

// Account login stays separate from publishing and is available only on the hosted Admin page.
async function loadMetaConnections(){
  $('meta-connect').hidden=true;
  $('meta-refresh').hidden=!hosted;
  $('meta-pending').replaceChildren();
  if(!hosted)return;
  try{
    const status=await request('/meta/status');
    if(status.configured!==true||status.publishing_enabled!==false)throw new Error('Connection settings need review.');
    const pending=await request('/meta/pending');
    const last=await request('/meta/last-attempt');
    if(last.attempt && last.attempt.outcome!=='pending_review')$('meta-pending').append(text('p','Last login: '+last.attempt.message));
    $('meta-status').textContent='Secure login available. Connecting an account does not enable scheduling.';
    $('meta-connect').hidden=false;
    for(const auth of pending.authorizations){
      const card=text('div','','post');card.append(text('strong','Login received — account review pending'));
      for(const account of auth.accounts)card.append(text('p','Instagram @'+account.username+' · Account '+account.id));
      card.append(text('p',(state.verified_posts||[]).length?'Verified posts appear in the Posting Report. Facebook scheduler status is available there; Pinterest setup is separate.':'Account review is pending. No automatic publishing connection has been activated.'));
      if(auth.token_expires_at)card.append(text('small','Login expires: '+new Date(auth.token_expires_at).toLocaleString()));
      $('meta-pending').append(card);
    }
  }catch(error){$('meta-status').textContent=error.message;}
}
$('meta-refresh').onclick=()=>action(loadMetaConnections);
$('meta-connect').onclick=()=>action(async()=>{
  const result=await request('/meta/start',{});
  const url=new URL(result.login_url);
  if(url.origin!=='https://www.facebook.com'||url.pathname!=='/v26.0/dialog/oauth'||url.username||url.password)throw new Error('Unexpected login destination. Connection stopped.');
  location.assign(url.href);
});
if(location.hash==='#connections')activeView='connections';

async function loadPinterestConnections(){
 $('pinterest-connect').hidden=true;$('pinterest-refresh').hidden=!hosted;$('pinterest-pending').replaceChildren();
 if(!hosted)return;
 try{
  const status=await request('/pinterest/status');if(status.configured!==true||status.publishing_enabled!==false)throw Error('Pinterest settings need review.');
  const pending=await request('/pinterest/pending');$('pinterest-status').textContent=status.board_review_enabled?'Board review permission setup available. No Pin publishing action is enabled.':'Secure account-read login available. Pin publishing remains off.';$('pinterest-connect').hidden=false;
  for(const auth of pending.authorizations){const card=text('div','','post');card.append(text('strong','Pinterest account review pending'),text('p','@'+auth.account.username+' · Account '+auth.account.id),text('p',pinterestPermissionText(auth.permission_level)));$('pinterest-pending').append(card);}
  if(status.board_review_enabled){
   const button=text('button','Review Available Boards','secondary');button.onclick=()=>action(async()=>{const data=await request('/pinterest/boards');const panel=text('div','','post');panel.append(text('strong','LyriBop public boards · review only'));for(const board of data.boards)panel.append(text('p',board.name+' · Board '+board.id));if(!data.boards.length)panel.append(text('p','No owned public boards returned.'));button.replaceWith(panel);});$('pinterest-pending').append(button);
  }
 }catch(e){$('pinterest-status').textContent=e.message;}
}
$('pinterest-refresh').onclick=()=>action(loadPinterestConnections);
$('pinterest-connect').onclick=()=>action(async()=>{const result=await request('/pinterest/start',{});const url=new URL(result.login_url);if(url.origin!=='https://www.pinterest.com'||url.pathname!=='/oauth/'||url.username||url.password||url.hash)throw Error('Unexpected Pinterest destination. Connection stopped.');location.assign(url.href);});

function pinterestPermissionText(level){
 if(level==='public_board_pin_review')return 'Public board and Pin read/write permissions granted. No Pin publishing action is enabled. Trial access does not verify public publishing.';
 if(level==='account_read')return 'Account read only. Trial access does not verify public Pin publishing.';
 return 'Permission details need review. Publishing remains off.';
}

async function loadPinterestSandbox(){
 $('pinterest-sandbox-controls').hidden=true;if(!hosted)return;
 try{const status=await request('/pinterest-sandbox/status');if(status.environment!=='sandbox'||status.publishing_enabled!==false)return;
 $('pinterest-sandbox-controls').hidden=false;const result=await request('/pinterest-sandbox/pending');$('pinterest-sandbox-pending').replaceChildren();
 for(const auth of result.authorizations)$('pinterest-sandbox-pending').append(text('p','Sandbox @'+auth.account.username+' · account review pending'));
 }catch{/* Disabled Sandbox is hidden; production login remains available. */}
}
$('pinterest-sandbox-refresh').onclick=()=>action(loadPinterestSandbox);
$('pinterest-sandbox-connect').onclick=()=>action(async()=>{const r=await request('/pinterest-sandbox/start',{});const u=new URL(r.login_url);if(u.origin!=='https://www.pinterest.com'||u.pathname!=='/oauth/'||u.username||u.password||u.hash)throw Error('Unexpected Sandbox login destination.');location.assign(u.href);});

$('pinterest-sandbox-review').onclick=()=>action(async()=>{
 const panel=$('pinterest-sandbox-review-result');panel.replaceChildren(text('p','Checking the existing Sandbox Pin…'));
 try{const r=await request('/pinterest-sandbox/verified-test');if(r.environment!=='sandbox'||r.status!=='verified_sandbox_readback'||r.publishing_enabled!==false)throw Error('Sandbox verification needs review.');
 panel.replaceChildren(text('strong','Sandbox Pin verified · read only'),text('p','@'+r.account.username+' · '+r.board.name),text('h4',r.pin.title),text('p',r.pin.description),text('p','Destination: '+r.pin.link),text('p','Pin '+r.pin.id+' · Board '+r.board.id),text('p','Checked '+new Date(r.verified_at).toLocaleString('en-US',{timeZone:'America/New_York'})+' Eastern'),text('p','This reads the existing test Pin. It does not create or publish anything. Public Pinterest posting and automatic scheduling remain off.'));
 const img=document.createElement('img');img.src='assets/images/platform-variants/LyriBop-Turn-Your-Story-into-a-Song-Pinterest-Complete-Offer-v1.png';img.alt='Original LyriBop artwork used for the verified Sandbox test Pin';img.style.maxWidth='280px';img.style.width='100%';panel.append(img,text('p','Original test artwork shown from LyriBop’s library; the API check verifies saved Pin metadata.'));
 }catch(e){panel.replaceChildren(text('p','Could not verify the existing Sandbox Pin. No content was created or published.'));throw e;}
});

$('dry-run').hidden=!hosted;
$('dry-run').onclick=()=>action(async()=>{
 const panel=$('dry-run-result');panel.replaceChildren(text('p','Checking saved plans without posting…'));
 try{const r=await request('/dry-run');if(r.mode!=='dry_run'||r.publishing_enabled!==false||r.provider_requests!==0||r.plans_changed!==0||!Array.isArray(r.items))throw Error('Dry-run result needs review.');
 panel.replaceChildren(text('h3','Dry-Run Report · no publishing'),text('p',r.total+' hosted plans checked · 0 platform requests · 0 plans changed'),text('p','Checked '+new Date(r.checked_at).toLocaleString('en-US',{timeZone:'America/New_York'})+' Eastern'),text('p',r.paused?'Planner is paused.':'Planner is not paused. This report does not start publishing.'));
 if(r.setup_required)panel.append(text('p','Hosted planner setup needs review.'));
 else if(!r.items.length)panel.append(text('p','No hosted plans to inspect. Plans saved on this Mac are separate.'));
 for(const item of r.items){const row=text('div','','post');row.append(text('strong',item.name||'Advertisement needs review'),text('p',(item.platform||'Unknown platform')+' · '+(item.scheduled_at?new Date(item.scheduled_at).toLocaleString('en-US',{timeZone:'America/New_York'})+' Eastern':'Invalid scheduled time')),text('p','Blocked: '+item.reasons.join('; ')));panel.append(row);}
 }catch(e){panel.replaceChildren(text('p','Dry-run inspection could not complete. Nothing was posted or changed.'));throw e;}
});

$('performance-refresh').hidden=!hosted;
if(!hosted)$('performance-result').replaceChildren(text('p','Use the Open Hosted Planner button for current performance figures.'));
$('performance-refresh').onclick=()=>action(async()=>{
 const panel=$('performance-result');panel.replaceChildren(text('p','Reading Instagram performance…'));
 try{
  const r=await request('/performance');
  const names=['views','reach','likes','comments','saved','shares'];
  if(r.mode!=='instagram_metrics_review'||r.account!=='lyribop'||r.media_id!=='18057389519584911'||r.permalink!=='https://www.instagram.com/p/DfQJHDtARad/'||r.metric_scope!=='organic_lifetime'||r.is_test_post!==true||r.weekly_activity_verified!==false||r.publishing_enabled!==false||r.posts_changed!==0||!Number.isFinite(Date.parse(r.collected_at))||!Number.isFinite(Date.parse(r.published_at)))throw Error('Performance response needs review.');
  for(const n of names){const m=r.metrics?.[n];if(!m||m.period!=='lifetime'||!['available','not_available','collection_failed','invalid_response'].includes(m.status)||(m.status==='available'?(!Number.isSafeInteger(m.value)||m.value<0):m.value!==null))throw Error('Performance response needs review.');}
  panel.replaceChildren(text('h3','Instagram · @lyribop'),text('strong','Lifetime organic totals · test post'),text('p','Turn Your Story into a Song — Instagram'),text('p','Published '+new Date(r.published_at).toLocaleString('en-US',{timeZone:'America/New_York'})+' Eastern'),text('p','Checked '+new Date(r.collected_at).toLocaleString('en-US',{timeZone:'America/New_York'})+' Eastern'));
  const cards=text('div','','stats');const labels={views:'Views',reach:'Accounts reached',likes:'Likes',comments:'Comments',saved:'Saves',shares:'Shares'};
  for(const n of names){const m=r.metrics[n],card=text('div','','card');card.append(text('strong',m.status==='available'?String(m.value):'—'),text('span',labels[n]));if(m.status!=='available')card.append(text('p',m.status==='not_available'?'Not available yet':'Could not read this figure'));cards.append(card);}panel.append(cards);
  const a=text('a','View Instagram Post ↗','link');a.href=r.permalink;a.target='_blank';a.rel='noopener noreferrer';panel.append(a,text('p','These totals cover the post’s lifetime, not activity during a selected week. Instagram figures may be delayed by up to 48 hours. Repeat checks within one minute reuse the last result.'));
 }catch(e){panel.replaceChildren(text('p','Performance figures could not be read. Please try again later. No posts changed.'));throw e;}
});

$('facebook-pilot-review').hidden=!hosted;
async function loadFacebookPilotReview(){
 const panel=$('facebook-pilot-result');panel.replaceChildren(text('p','Reading saved Facebook posts…'));
 try{
  const r=await request('/facebook-pilot-review');
  if(r.mode!=='facebook_pilot_review'||r.publishing_enabled!==false||r.provider_requests!==0||r.plans_changed!==0||!Array.isArray(r.items))throw Error('Review response needs attention.');
  panel.replaceChildren(text('h3','Facebook Post Review'),text('p','Review the exact saved post before approving. When Facebook scheduling is enabled, approval authorizes publishing at the saved time.'));
  if(!r.items.length)panel.append(text('p','No hosted Facebook plans yet. Use Schedule a Post to save a plan, then review it here. Saving does not publish.'));
  const selected=new Map();
  if(r.weekly_approval_available){const batch=text("button","Approve Selected Facebook Posts");batch.onclick=()=>action(async()=>{const posts=[...selected.values()];if(!posts.length||posts.length>21)throw Error("Select between one and 21 posts after reviewing their artwork, caption and time.");if(!confirm("Approve these "+posts.length+" reviewed posts for the LyriBop Facebook Page at their displayed Eastern times? "+(r.worker_enabled?"The enabled scheduler may publish them at those times.":"Automatic posting remains off.")))return;await request("/facebook-weekly-approve",{confirm:true,posts});await loadFacebookPilotReview();tell("Selected Facebook approvals saved.");});panel.append(batch);}
  for(const item of r.items){
   if(item.platform!=='facebook'||item.destination!=='1271936012676830'||!Array.isArray(item.reasons))throw Error('Review destination needs attention.');
   const card=document.createElement('article');card.className='card';card.append(text('h3',item.name),text('p','Destination: LyriBop Facebook Page'),text('p',item.scheduled_at?new Date(item.scheduled_at).toLocaleString('en-US',{timeZone:'America/New_York',timeZoneName:'short'}):'Time needs review'));
   if(/^[a-f0-9]{64}$/.test(item.image_sha256||'')){const img=document.createElement('img');img.src=apiBase+'/artwork/'+item.image_sha256;img.alt='Saved artwork for '+item.name;img.style.cssText='max-width:320px;width:100%;height:auto';card.append(img);}
   if(typeof item.caption==='string'){const caption=text('p',item.caption);caption.style.whiteSpace='pre-wrap';card.append(caption);}
   for(const reason of item.reasons)card.append(text('p',reason));
   card.append(text('p','Plan reference: '+item.plan_id));
   if(item.can_approve===true&&r.weekly_approval_available){const label=document.createElement('label');const check=document.createElement('input');check.type='checkbox';check.onchange=()=>{if(check.checked)selected.set(item.plan_id,{plan_id:item.plan_id,snapshot_sha256:item.snapshot_sha256,scheduled_at:item.scheduled_at});else selected.delete(item.plan_id);};label.append(check,document.createTextNode(' Include this reviewed post in batch approval'));card.append(label);}
   if(item.can_approve===true&&r.approval_storage_available===true&&!r.weekly_approval_available){const approve=text('button','Approve This Facebook Pilot');approve.onclick=()=>action(async()=>{if(!confirm('Approve this exact Facebook post for '+new Date(item.scheduled_at).toLocaleString('en-US',{timeZone:'America/New_York',timeZoneName:'short'})+(r.worker_enabled?'? This authorizes the enabled Facebook scheduler to publish this exact post at that time.':'? This saves approval only; automatic posting is off.')))return;await request('/facebook-pilot-approve',{confirm:true,plan_id:item.plan_id,snapshot_sha256:item.snapshot_sha256,scheduled_at:item.scheduled_at});await loadFacebookPilotReview();tell(r.worker_enabled?'Approval saved for the scheduled Facebook post.':'Pilot approval saved. Automatic posting is off.');});card.append(approve);}
   if(item.approval_status==='approved'){const revoke=text('button','Revoke Pilot Approval','secondary');revoke.onclick=()=>action(async()=>{if(!confirm('Revoke approval for this Facebook pilot?'))return;await request('/facebook-pilot-revoke',{confirm:true,plan_id:item.plan_id});await loadFacebookPilotReview();tell('Pilot approval revoked.');});card.append(revoke);}
   if(item.approval_status==='revoked')card.append(text('p','Approval revoked. Create a new plan to request another approval.'));
   panel.append(card);
  }
 }catch(e){panel.replaceChildren(text('p','Facebook review could not complete. No posts were approved or sent.'));throw e;}
}
$('facebook-pilot-review').onclick=()=>action(loadFacebookPilotReview);

$('report-refresh').onclick=()=>action(async()=>{await refresh();tell('Posting report refreshed. No posts were sent by this check.');});

$('facebook-worker-status').hidden=!hosted;
$('facebook-worker-status').onclick=()=>action(async()=>{
 const panel=$('facebook-worker-result');panel.replaceChildren(text('p','Checking the hosted Facebook scheduler…'));
 try{const r=await request('/facebook-worker-status');if(r.mode!=='facebook_hosted_worker_status'||typeof r.enabled!=='boolean'||typeof r.needs_attention!=='boolean')throw Error('Worker status needs review.');
  panel.replaceChildren(text('h3','Hosted Facebook Scheduler'),text('p',r.enabled?'Enabled — only explicitly approved Facebook posts are eligible.':'Off — unattended Facebook posting is not enabled.'));
  if(r.setup_required)panel.append(text('p','Worker setup is not installed yet.'));
  if(r.last_tick)panel.append(text('p','Last check: '+new Date(r.last_tick).toLocaleString('en-US',{timeZone:'America/New_York'})+' Eastern'));
  const labels={idle:'No eligible approved post',waiting:'Waiting for an approved time',paused:'Planner paused',verified:'Last delivery verified',needs_review:'Stopped — delivery needs review; do not resend'};
  if(labels[r.last_outcome])panel.append(text('p',labels[r.last_outcome]));
  if(r.needs_attention)panel.append(text('p','Attention required: no recent worker check or an unresolved delivery. Review before enabling or resending.'));
 }catch(e){panel.replaceChildren(text('p','Scheduler status could not be checked. Nothing was sent by this check.'));throw e;}
});

async function loadInstagramReview(){
 const panel=$('instagram-review-result');panel.replaceChildren(text('p','Reading saved Instagram posts…'));
 try{
  const r=await request('/instagram-review');
  if(r.mode!=='instagram_pilot_review'||r.publishing_enabled!==false||r.provider_requests!==0||r.plans_changed!==0||!Array.isArray(r.items))throw Error('Review response needs attention.');
  panel.replaceChildren(text('h3','Instagram Post Review'),text('p','Review the exact saved post before approving. When Instagram scheduling is enabled, approval authorizes publishing at the saved time.'));
  if(!r.items.length)panel.append(text('p','No hosted Instagram plans yet. Use Schedule a Post to save a plan, then review it here. Saving does not publish.'));
  const selected=new Map();
  if(r.weekly_approval_available){const batch=text("button","Approve Selected Instagram Posts");batch.onclick=()=>action(async()=>{const posts=[...selected.values()];if(!posts.length||posts.length>21)throw Error("Select between one and 21 posts after reviewing their artwork, caption and time.");if(!confirm("Approve these "+posts.length+" reviewed posts for the Instagram @lyribop at their displayed Eastern times? "+(r.worker_enabled?"The enabled scheduler may publish them at those times.":"Automatic posting remains off.")))return;await request("/instagram-weekly-approve",{confirm:true,posts});await loadInstagramReview();tell("Selected Instagram approvals saved.");});panel.append(batch);}
  for(const item of r.items){
   if(item.platform!=='instagram'||item.destination!=='17841431950776323'||!Array.isArray(item.reasons))throw Error('Review destination needs attention.');
   const card=document.createElement('article');card.className='card';card.append(text('h3',item.name),text('p','Destination: Instagram @lyribop'),text('p',item.scheduled_at?new Date(item.scheduled_at).toLocaleString('en-US',{timeZone:'America/New_York',timeZoneName:'short'}):'Time needs review'));
   if(/^[a-f0-9]{64}$/.test(item.image_sha256||'')){const img=document.createElement('img');img.src=/^\/social-scheduler\/[a-f0-9]{64}\.jpg$/.test(item.publishing_image_path||'')?item.publishing_image_path:apiBase+'/artwork/'+item.image_sha256;img.alt='Saved artwork for '+item.name;img.style.cssText='max-width:320px;width:100%;height:auto';card.append(img);}
   if(typeof item.caption==='string'){const caption=text('p',item.caption);caption.style.whiteSpace='pre-wrap';card.append(caption);}
   for(const reason of item.reasons)card.append(text('p',reason));
   card.append(text('p','Plan reference: '+item.plan_id));
   if(item.can_approve===true&&r.weekly_approval_available){const label=document.createElement('label');const check=document.createElement('input');check.type='checkbox';check.onchange=()=>{if(check.checked)selected.set(item.plan_id,{plan_id:item.plan_id,snapshot_sha256:item.snapshot_sha256,scheduled_at:item.scheduled_at});else selected.delete(item.plan_id);};label.append(check,document.createTextNode(' Include this reviewed post in batch approval'));card.append(label);}
   if(item.can_approve===true&&r.approval_storage_available===true&&!r.weekly_approval_available){const approve=text('button','Approve This Instagram Pilot');approve.onclick=()=>action(async()=>{if(!confirm('Approve this exact Instagram post for '+new Date(item.scheduled_at).toLocaleString('en-US',{timeZone:'America/New_York',timeZoneName:'short'})+(r.worker_enabled?'? This authorizes the enabled Instagram scheduler to publish this exact post at that time.':'? This saves approval only; automatic posting is off.')))return;await request('/instagram-weekly-approve',{confirm:true,plan_id:item.plan_id,snapshot_sha256:item.snapshot_sha256,scheduled_at:item.scheduled_at});await loadInstagramReview();tell(r.worker_enabled?'Approval saved for the scheduled Instagram post.':'Pilot approval saved. Automatic posting is off.');});card.append(approve);}
   if(item.approval_status==='approved'){const revoke=text('button','Revoke Pilot Approval','secondary');revoke.onclick=()=>action(async()=>{if(!confirm('Revoke approval for this Instagram pilot?'))return;await request('/instagram-approval-revoke',{confirm:true,plan_id:item.plan_id});await loadInstagramReview();tell('Pilot approval revoked.');});card.append(revoke);}
   if(item.approval_status==='revoked')card.append(text('p','Approval revoked. Create a new plan to request another approval.'));
   panel.append(card);
  }
 }catch(e){panel.replaceChildren(text('p','Instagram review could not complete. No posts were approved or sent.'));throw e;}
}

$('instagram-review').hidden=!hosted;$('instagram-review').onclick=()=>action(loadInstagramReview);
$('instagram-worker-status').hidden=!hosted;$('instagram-worker-status').onclick=()=>action(async()=>{const r=await request('/instagram-worker-status');if(r.mode!=='instagram_hosted_worker_status')throw Error('Instagram status unavailable.');$('instagram-worker-result').replaceChildren(text('strong',r.enabled?'Instagram scheduler enabled':'Instagram scheduler off'),text('p',r.needs_attention?'Needs review before scheduling can continue.':'Only explicitly approved Instagram posts can be sent.'));});

$('pin-boards-load').hidden=!hosted;
$('pin-boards-load').onclick=()=>action(async()=>{
 $('pin-board').replaceChildren(new Option('Choose later · save draft',''));$('pin-board-status').textContent='Reading your public Pinterest boards…';
 try{const r=await request('/pinterest-board-choices');if(r.publishing_enabled!==false||r.account!=='lyribop'||!Array.isArray(r.boards)||r.boards.some(b=>!/^\d+$/.test(b.id)||typeof b.name!=='string'))throw Error('Pinterest boards could not be verified.');for(const b of r.boards)$('pin-board').append(new Option(b.name,b.id));$('pin-board-status').textContent=r.boards.length+' public boards available. Saving a board does not publish a Pin.';}catch(e){$('pin-board-status').textContent='Boards unavailable. You can save a draft and choose a board later.';throw e;}
});

async function loadSchedulerControls(){
 const panel=$('controls-result');if(!hosted){panel.replaceChildren(text('p','Use Open Hosted Planner for scheduler controls.'));return;}
 panel.replaceChildren(text('p','Reading scheduler status…'));
 let r;try{r=await request('/controls');}catch(e){panel.replaceChildren(text('p','Status unavailable. This screen cannot confirm whether scheduling is ON or OFF. Refresh Scheduler Status before making another change. Check the Posting Report before resending any ad.'));throw e;}if(!Array.isArray(r.platforms)||r.platforms.length!==2)throw Error('Scheduler controls unavailable.');
 panel.replaceChildren();
 for(const item of r.platforms){
  if(!['facebook','instagram'].includes(item.platform)||typeof item.enabled!=='boolean'||!Array.isArray(item.queue)||!Array.isArray(item.reasons))throw Error('Scheduler status needs review.');
  const name=item.platform==='facebook'?'Facebook':'Instagram',card=text('article','','card');card.append(text('h3',name),text('strong',item.enabled?'ON · approved posts only':'OFF'),text('p',item.queue.length+' approved posts waiting'));
  if(item.last_tick)card.append(text('p','Last check: '+new Date(item.last_tick).toLocaleString('en-US',{timeZone:'America/New_York',timeZoneName:'short'})));
  const outcomes={idle:'No approved post is due yet.',waiting:'Waiting for the next approved time.',paused:'The planner is paused.',verified:'The last delivery was verified.',needs_review:'Delivery stopped for review. A post may already exist; do not resend it.'};
  if(outcomes[item.last_outcome])card.append(text('p',outcomes[item.last_outcome]));
  if(item.needs_attention)card.append(text('p','Attention needed: open the Posting Report and check the platform for the existing post. Do not create a replacement until the result is resolved.'));
  for(const reason of item.reasons)card.append(text('p',reason));
  for(const post of item.queue)card.append(text('p',post.name+' · '+(post.scheduled_at?new Date(post.scheduled_at).toLocaleString('en-US',{timeZone:'America/New_York',timeZoneName:'short'}):'Time needs review')));
  const buttons=text('div','','actions');
  const start=text('button','Start '+name),stop=text('button','Stop '+name,'secondary');start.dataset.controlUnavailable=String(!item.can_start);start.disabled=!item.can_start;stop.dataset.controlUnavailable=String(!item.can_stop);stop.disabled=!item.can_stop;
  start.onclick=()=>action(async()=>{if(!confirm('Start '+name+' scheduling? '+item.queue.length+' reviewed posts are waiting. Only explicitly approved posts will publish at their saved Eastern times; posts you approve later will also be eligible.'))return;await request('/controls',{platform:item.platform,enabled:true,confirm:true,queue_sha256:item.queue_sha256});await refresh();await loadSchedulerControls();tell(name+' scheduling started. Only approved posts are eligible.');});
  stop.onclick=()=>action(async()=>{if(!confirm('Stop '+name+' scheduling? New sends will stop; a post already being sent may finish.'))return;await request('/controls',{platform:item.platform,enabled:false,confirm:true});await refresh();await loadSchedulerControls();tell(name+' scheduling stopped. Saved plans and posting history are retained.');});
  buttons.append(start,stop);card.append(buttons);panel.append(card);
 }
}
$('controls-refresh').hidden=!hosted;$('controls-refresh').onclick=()=>action(loadSchedulerControls);
