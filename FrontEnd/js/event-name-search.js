/* Suggest real Ticketmaster listings while preserving free-text event requests. */
(() => {
  const input = document.getElementById('customEventName');
  const list = document.getElementById('customEventResults');
  if (!input || !list) return;
  let matches = [], active = -1;
  const fold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const close = () => {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  };
  const choose = event => {
    input.value = event.name || input.value;
    const form = input.form;
    if (form) {
      form.elements.venue.value = [event.venue, event.address, event.city].filter(Boolean).join(', ');
      form.elements.date.value = /^\d{4}-\d{2}-\d{2}$/.test(event.date || '') ? event.date : '';
      if (form.elements.eventTime) form.elements.eventTime.value = /^\d{2}:\d{2}(:\d{2})?$/.test(event.time || '') ? event.time.slice(0,5) : '';
      ['event', 'venue', 'date', 'eventTime'].forEach(name => form.elements[name]?.dispatchEvent(new Event('change', { bubbles: true })));
    }
    close();
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const render = () => {
    const term = fold(input.value).trim();
    list.replaceChildren();
    active = -1;
    if (term.length < 2) { close(); return; }
    const words = term.split(/\s+/).filter(word => !['in','at','the','show','concert'].includes(word));
    const events = window.__xdTicketmasterEvents || [];
    matches = words.length ? events.filter(event => {
      const content = fold([event.name, event.venue, event.city].join(' '));
      return words.every(word => content.includes(word));
    }).slice(0, 5) : [];
    matches.forEach((event, index) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'event-suggestion';
      option.id = 'event-suggestion-' + index;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      const title = document.createElement('strong');
      title.textContent = event.name;
      const detail = document.createElement('small');
      detail.textContent = [event.venue, event.city, event.date].filter(Boolean).join(' · ');
      option.append(title, detail);
      option.addEventListener('mousedown', event => event.preventDefault());
      option.addEventListener('click', () => choose(event));
      list.append(option);
    });
    const status = document.createElement('span');
    status.className = 'event-search-status';
    status.textContent = matches.length ? 'Events from Ticketmaster' : 'No matching listing. You can still request a quote for this event.';
    list.append(status);
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };
  input.addEventListener('input', render);
  input.addEventListener('focus', render);
  input.addEventListener('blur', () => setTimeout(close, 150));
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') { close(); return; }
    if (list.hidden || !matches.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      active = (active + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
      list.querySelectorAll('[role="option"]').forEach((node, index) => node.setAttribute('aria-selected', String(index === active)));
      input.setAttribute('aria-activedescendant', 'event-suggestion-' + active);
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      choose(matches[active]);
    }
  });
  document.addEventListener('ticketmaster-events-loaded', () => { if (document.activeElement === input) render(); });
  document.getElementById('customEventToggle')?.addEventListener('click', () => {
    if (document.getElementById('customEventPanel').hidden) close();
  });
})();
