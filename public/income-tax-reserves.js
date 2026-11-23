(function(){
 'use strict';
 window.addEventListener('DOMContentLoaded',()=>{
  const byId=id=>document.getElementById(id),form=byId('taxReserveForm');if(!form)return;
  let version=0,loadedYear=null;
  const year=byId('taxReserveYear'),save=byId('taxReserveSave'),message=byId('taxReserveMessage');
  year.value=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric'}).format(new Date());
  const dollars=value=>value===null?'Not configured':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);
  async function load(){
   save.disabled=true;message.textContent='Loading tax reserve settings…';
   try{
    const r=await fetch('/api/admin/income-tax-reserves?year='+encodeURIComponent(year.value),{cache:'no-store'}),data=await r.json();if(!r.ok)throw Error(data.error||'Could not load reserves.');
    version=data.settings.version;loadedYear=data.year;
    for(const [id,key]of [['taxStatePercent','state_percent'],['taxFederalPercent','federal_percent'],['taxStatePaid','state_paid'],['taxFederalPaid','federal_paid']])byId(id).value=data.settings[key]??'';
    byId('taxStateRemaining').textContent=dollars(data.summary.stateRemaining);byId('taxFederalRemaining').textContent=dollars(data.summary.federalRemaining);
    byId('taxReserveSales').textContent=dollars(data.summary.sales);byId('taxSalesAfterReserves').textContent=dollars(data.summary.salesAfterReserves);
    for(const [prefix,label]of [['state','State'],['federal','Federal']]){const configured=data.summary[prefix+'Reserve']!==null;byId('tax'+label+'Detail').textContent=configured?`Allocated: ${dollars(data.summary[prefix+'Reserve'])} · Payments recorded: ${dollars(data.summary[prefix+'Paid'])}`:'No reserve percentage saved. This is not a zero-tax determination.';}
    message.textContent='Separate reserve estimates; total sales, existing expenses, and net-income reports remain unchanged.';save.disabled=false;
   }catch(error){loadedYear=null;message.textContent=error.message;}
  }
  byId('taxReserveRefresh').addEventListener('click',load);year.addEventListener('input',()=>{save.disabled=true;message.textContent='Load the selected year before saving.';});
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(Number(year.value)!==loadedYear)return;save.disabled=true;
   try{
    const r=await fetch('/api/admin/income-tax-reserves',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({year:loadedYear,version,statePercent:byId('taxStatePercent').value||null,federalPercent:byId('taxFederalPercent').value||null,statePaid:byId('taxStatePaid').value||'0',federalPaid:byId('taxFederalPaid').value||'0'})}),data=await r.json();if(!r.ok)throw Error(data.error||'Could not save reserves.');await load();message.textContent='Reserve settings saved. No payment was sent.';
   }catch(error){message.textContent=error.message;save.disabled=false;}
  });load();
 });
})();
