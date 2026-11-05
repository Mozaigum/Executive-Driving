(() => {
  const select = document.getElementById('serviceType');
  if (!select) return;
  const wrap = document.createElement('div');
  wrap.className = 'service-select';
  select.before(wrap);
  wrap.append(select);
  select.classList.add('service-select-native');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'service-select-trigger';
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-label', 'Service');
  trigger.setAttribute('aria-labelledby', 'serviceTypeLabel');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', 'service-options');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-required', 'true');
  const list = document.createElement('div');
  list.id = 'service-options';
  list.className = 'service-options';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Service');
  list.hidden = true;
  wrap.append(trigger, list);
  const options = Array.from(select.options).filter(option => option.value);
  let cursor = 0;
  const rows = options.map((option, index) => {
    const row = document.createElement('div');
    row.id = `service-option-${index}`;
    row.setAttribute('role', 'option');
    row.textContent = option.text;
    row.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); choose(index); });
    list.append(row);
    return row;
  });
  function sync() {
    trigger.textContent = select.selectedOptions[0]?.text || 'Choose a service';
    rows.forEach((row, i) => row.setAttribute('aria-selected', String(options[i].value === select.value)));
    if (select.value) trigger.removeAttribute('aria-invalid');
  }
  function highlight(index) {
    cursor = (index + rows.length) % rows.length;
    rows.forEach((row, i) => row.classList.toggle('is-highlighted', i === cursor));
    trigger.setAttribute('aria-activedescendant', rows[cursor].id);
    rows[cursor].scrollIntoView({ block: 'nearest' });
  }
  function close() { list.hidden = true; trigger.setAttribute('aria-expanded', 'false'); trigger.removeAttribute('aria-activedescendant'); }
  function open() { list.hidden = false; trigger.setAttribute('aria-expanded', 'true'); highlight(Math.max(0, options.findIndex(option => option.value === select.value))); }
  function choose(index) { select.value = options[index].value; select.dispatchEvent(new Event('input', { bubbles: true })); select.dispatchEvent(new Event('change', { bubbles: true })); close(); trigger.focus(); }
  trigger.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); list.hidden ? open() : close(); });
  trigger.addEventListener('keydown', event => {
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (list.hidden) open();
      else highlight(event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : cursor + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); list.hidden ? open() : choose(cursor); }
    else if (event.key === 'Escape' || event.key === 'Tab') close();
    else if (event.key.length === 1) { const index = options.findIndex(option => option.text.toLowerCase().startsWith(event.key.toLowerCase())); if (index >= 0) { if (list.hidden) open(); highlight(index); } }
  });
  document.addEventListener('click', event => { if (!wrap.contains(event.target)) close(); });
  select.addEventListener('change', sync);
  window.addEventListener('pageshow', sync);
  select.addEventListener('invalid', event => { event.preventDefault(); trigger.setAttribute('aria-invalid', 'true'); trigger.focus(); });
  select.form?.addEventListener('reset', () => setTimeout(sync, 0));
  // The select retains submission and validation, without a native touch target.
  select.hidden = true;
  select.inert = true;
  sync();
})();
