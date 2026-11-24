/* Group existing Admin views without replacing their forms, lists, or actions. */
(function (root) {
  'use strict';
  function setup(document, onNavigate) {
    const definitions = [
      {id:'ordersPanel',label:'Order status',views:[
        {panel:'activePanel',tab:'activeOrdersTab',count:'activeNavCount',label:'Active Orders'},
        {panel:'closedPanel',tab:'closedOrdersTab',count:'closedNavCount',label:'Closed Orders'},
        {panel:'testOrdersPanel',tab:'testOrdersTab',count:'testOrdersNavCount',label:'Test Orders'}]},
      {id:'marketingGroupPanel',label:'Marketing',views:[
        {panel:'marketingPanel',label:'Customer Marketing'},
        {panel:'promoPanel',label:'Offer Codes'},
        {panel:'reviewsPanel',count:'reviewsNavCount',label:'Customer Reviews'},
        {panel:'storeDisplayPanel',label:'Store Display'}],external:{label:'Advertising Dashboard ↗',href:'http://127.0.0.1:8765/'}},
      {id:'financesPanel',label:'Finances',views:[
        {panel:'accountingPanel',label:'Accounting'},
        {panel:'costHistoryPanel',label:'Cost History'},
        {panel:'reportsPanel',label:'Reports'},
        {panel:'vendorsPanel',label:'Vendors'}]},
      {id:'settingsHelpPanel',label:'Settings and help',views:[
        {panel:'storePanel',label:'Store Settings'},
        {panel:'userManualPanel',label:'User Manual'},
        {panel:'formsChecklistsPanel',label:'Forms & Checklists'}]}
    ];
    const groups = definitions.map(group => {
      const panels = group.views.map(view => document.getElementById(view.panel));
      if (panels.some(panel => !panel)) throw new Error('An Admin view could not be loaded.');
      const section = document.createElement('div');section.id=group.id;section.className='admin-panel';
      const bar=document.createElement('div');bar.className='order-tabs';
      const tabs=document.createElement('nav');tabs.className='admin-tab-list';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label',group.label);
      bar.append(tabs);section.append(bar);panels[0].before(section);
      const buttons=group.views.map((view,index)=>{
        const button=document.createElement('button');button.type='button';button.id=view.tab||view.panel+'Tab';button.className='order-tab';button.dataset.panel=view.panel;
        button.setAttribute('role','tab');button.setAttribute('aria-controls',view.panel);button.append(document.createTextNode(view.label));
        if(view.count){const count=document.createElement('span');count.id=view.count;count.className='nav-count';count.textContent='—';button.append(count);}
        button.addEventListener('click',()=>onNavigate(view.panel));
        button.addEventListener('keydown',event=>{
          let next;
          if(event.key==='ArrowRight')next=(index+1)%group.views.length;
          if(event.key==='ArrowLeft')next=(index+group.views.length-1)%group.views.length;
          if(event.key==='Home')next=0;
          if(event.key==='End')next=group.views.length-1;
          if(next===undefined)return;
          event.preventDefault();onNavigate(group.views[next].panel);buttons[next].focus();
        });
        tabs.append(button);const panel=panels[index];panel.classList.remove('admin-panel');panel.classList.add('order-panel');panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);section.append(panel);return button;
      });
      if(group.external){const link=document.createElement('a');link.className='order-tab admin-external-tab';link.href=group.external.href;link.target='_blank';link.rel='noopener';link.textContent=group.external.label;bar.append(link);}
      function select(panelId){
        group.selected=panelId;
        group.views.forEach((view,index)=>{const active=view.panel===panelId;panels[index].hidden=!active;panels[index].classList.toggle('active',active);buttons[index].classList.toggle('active',active);buttons[index].setAttribute('aria-selected',String(active));buttons[index].tabIndex=active?0:-1;});
      }
      select(group.views[0].panel);return {...group,select,getSelected:()=>group.selected};
    });
    return {show(panelId){
      const group=groups.find(group=>group.id===panelId||group.views.some(view=>view.panel===panelId));
      const rootId=group?group.id:panelId;
      if(!document.getElementById(rootId)?.classList.contains('admin-panel'))return false;
      if(group&&panelId!==group.id)group.select(panelId);
      document.querySelectorAll('.admin-panel').forEach(panel=>panel.classList.toggle('active',panel.id===rootId));
      document.querySelectorAll('.admin-nav-button[data-panel]').forEach(button=>{const active=button.dataset.panel===rootId;button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
      return group?group.getSelected():rootId;
    }};
  }
  root.LyriBopAdminOrders={setup};
})(globalThis);
