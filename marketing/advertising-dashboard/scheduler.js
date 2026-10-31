'use strict';
const $ = id => document.getElementById(id);
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
  const response = await fetch('/api/scheduler'+path, options);
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
  finally {busy=false; document.querySelectorAll('button').forEach(b=>b.disabled=false);}
}
function view(v) {
  activeView=v;
  for (const id of ['schedule','planner','report','connections']) $(id).hidden=id!==v;
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed', String(b.dataset.view===v)));
  render();
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
  return {ad_id:a.id,platform:a.platform,caption:$('caption').value,pin_title:$('pin-title').value,destination:$('destination').value,slots};
}
function text(tag, value, className) { const e=document.createElement(tag); e.textContent=value; if(className)e.className=className; return e; }
function render() {
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
      card.append(details,cancel); col.append(card);
    }
    if(!rows.length) col.append(text('p','No plans'));
    days.append(col);
  }
  const tbody=$('report').querySelector('tbody'); tbody.replaceChildren();
  for(const p of state.plans) {
    const tr=document.createElement('tr');
    for(const value of [p.snapshot.name,p.platform,p.local_day+' '+p.local_time+' ET','—',p.display_status])tr.append(text('td',value));
    tbody.append(tr);
  }
  if(!state.plans.length) {const tr=document.createElement('tr'),td=text('td','No saved plans or verified publication records.','muted');td.colSpan=5;tr.append(td);tbody.append(tr);}
}
function showSnapshot(p) {
  const dialog=document.createElement('dialog');dialog.style.maxWidth='650px';
  dialog.append(text('h2',p.snapshot.name),text('p',p.local_day+' '+p.local_time+' ET · '+p.display_status));
  const img=document.createElement('img');img.src='/api/scheduler/artwork/'+p.snapshot.image_sha256;img.className='art';img.alt=p.snapshot.name;
  const caption=text('p',p.snapshot.caption);caption.style.whiteSpace='pre-wrap';dialog.append(img,caption);
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
  await refresh();tell('Plan saved on this Mac. Publishing is not connected.');
});};
$('week').onclick=()=>action(async()=>{
  // Fixed daytime slots avoid the repeated/nonexistent early-morning DST hour.
  const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
  const slots=dates().flatMap(day=>['09:00','13:00','18:00'].filter(t=>day>state.today||t>clock).map(time=>({day,time})));
  if(!slots.length)throw new Error('No future slots available. Reload the planner.');
  if(!confirm('Save '+slots.length+' plans for '+$('platform').selectedOptions[0].text+' using this same ad at 9 AM, 1 PM and 6 PM? Nothing will publish.'))return;
  const result=await request('/plans',payload(slots));await refresh();view('planner');tell(result.saved+' plans saved. Publishing is not connected.');
});
$('pause').onclick=()=>action(async()=>{await request('/pause',{paused:!state.paused});await refresh();tell(state.paused?'Plan paused. Publishing remains disconnected.':'Plan resumed. Publishing remains disconnected.');});
$('export').onclick=()=>download(JSON.stringify({publishing_enabled:false,time_zone:'America/New_York',plans:state.plans},null,2),'application/json','LyriBop-saved-plans.json');
$('csv').onclick=()=>{const rows=[['Advertisement','Platform','Planned Eastern time','Planned UTC time','Confirmed publication time','Status'],...state.plans.map(p=>[p.snapshot.name,p.platform,p.local_day+' '+p.local_time,p.scheduled_at,'',p.display_status])];download(rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8','LyriBop-posting-report.csv');};
action(async()=>{await refresh();populate();$('day').min=state.today;$('day').max=dates()[6];$('day').value=state.today;view(activeView);});
