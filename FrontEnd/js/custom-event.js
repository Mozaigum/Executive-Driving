(() => {
  const toggle = document.getElementById('customEventToggle');
  const panel = document.getElementById('customEventPanel');
  const close = document.getElementById('closeCustomEvent');
  if (!toggle || !panel || !close) return;
  const form = panel.querySelector('form');
  const textFields = [
    [form.elements.event, 'Enter the event name.'],
    [form.elements.venue, 'Enter the venue or address.']
  ];
  const validateText = () => textFields.forEach(([field, message]) => {
    field.setCustomValidity(field.value.trim() ? '' : message);
  });
  textFields.forEach(([field]) => {
    field.addEventListener('input', validateText);
    field.addEventListener('change', validateText);
  });
  form.addEventListener('submit', event => {
    textFields.forEach(([field]) => { field.value = field.value.trim(); });
    validateText();
    if (!form.reportValidity()) event.preventDefault();
  });
  const setOpen = (open, restoreFocus = false) => {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('span').textContent = open ? '\u2212' : '+';
    if (open) panel.querySelector('input[name="event"]').focus({ preventScroll: true });
    else if (restoreFocus) toggle.focus({ preventScroll: true });
  };
  toggle.addEventListener('click', () => {
    const open = panel.hidden;
    if (open && document.getElementById('openFilters')?.getAttribute('aria-expanded') === 'true') {
      document.getElementById('closeFilters')?.click();
    }
    setOpen(open);
  });
  close.addEventListener('click', () => setOpen(false, true));
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') setOpen(false, true);
  });
  document.getElementById('openFilters')?.addEventListener('click', () => setOpen(false));
})();
