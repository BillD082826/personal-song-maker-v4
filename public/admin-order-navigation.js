/* Keep existing order views and actions intact inside one navigation section. */
(function (root) {
  'use strict';
  function setup(document, onOrderNavigate) {
    const views = [
      {panel: 'activePanel', tab: 'activeOrdersTab', count: 'activeNavCount', label: 'Active Orders'},
      {panel: 'closedPanel', tab: 'closedOrdersTab', count: 'closedNavCount', label: 'Closed Orders'},
      {panel: 'testOrdersPanel', tab: 'testOrdersTab', count: 'testOrdersNavCount', label: 'Test Orders'}
    ];
    let selected = 'activePanel';
    const panels = views.map(view => document.getElementById(view.panel));
    if (panels.some(panel => !panel)) throw new Error('The order views could not be loaded.');
    const section = document.createElement('div');
    section.id = 'ordersPanel';section.className = 'admin-panel';
    const tabs = document.createElement('nav');
    tabs.className = 'order-tabs';tabs.setAttribute('role', 'tablist');tabs.setAttribute('aria-label', 'Order status');
    section.append(tabs);panels[0].before(section);
    const buttons = views.map((view, index) => {
      const button = document.createElement('button');
      button.type = 'button';button.id = view.tab;button.className = 'order-tab';
      button.setAttribute('role', 'tab');button.setAttribute('aria-controls', view.panel);
      button.append(document.createTextNode(view.label));
      const count = document.createElement('span');count.id = view.count;count.className = 'nav-count';count.textContent = '—';button.append(count);
      button.addEventListener('click', () => onOrderNavigate(view.panel));
      button.addEventListener('keydown', event => {
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % views.length;
        if (event.key === 'ArrowLeft') next = (index + views.length - 1) % views.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = views.length - 1;
        if (next === undefined) return;
        event.preventDefault();onOrderNavigate(views[next].panel);buttons[next].focus();
      });
      tabs.append(button);
      const panel = panels[index];panel.classList.remove('admin-panel');panel.classList.add('order-panel');
      panel.setAttribute('role', 'tabpanel');panel.setAttribute('aria-labelledby', view.tab);section.append(panel);
      return button;
    });
    function selectOrder(panelId) {
      selected = panelId;
      views.forEach((view, index) => {
        const active = view.panel === selected;
        panels[index].hidden = !active;panels[index].classList.toggle('active', active);
        buttons[index].classList.toggle('active', active);buttons[index].setAttribute('aria-selected', String(active));buttons[index].tabIndex = active ? 0 : -1;
      });
    }
    selectOrder(selected);
    return {
      show(panelId) {
        let rootId = panelId;
        if (views.some(view => view.panel === panelId)) {selectOrder(panelId);rootId = 'ordersPanel';}
        if (!document.getElementById(rootId)?.classList.contains('admin-panel')) return false;
        document.querySelectorAll('.admin-panel').forEach(panel => panel.classList.toggle('active', panel.id === rootId));
        document.querySelectorAll('.admin-nav-button[data-panel]').forEach(button => {
          const active = button.dataset.panel === rootId;button.classList.toggle('active', active);
          if (active) button.setAttribute('aria-current', 'page');else button.removeAttribute('aria-current');
        });
        return true;
      }
    };
  }
  root.LyriBopAdminOrders = { setup };
})(globalThis);
