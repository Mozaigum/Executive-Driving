(() => {
  const form = document.getElementById('booking-form');
  const toggle = document.getElementById('returnTrip');
  const fields = document.getElementById('returnTripFields');
  if (!form || !toggle || !fields) return;
  const get = name => form.elements.namedItem(name);
  const edited = new Set();
  const links = [
    ['dropoff', 'returnPickup'],
    ['pickup', 'returnDropoff'],
    ['date', 'returnDate']
  ];
  const sync = () => links.forEach(([from, to]) => {
    if (!edited.has(to)) get(to).value = get(from).value;
  });
  const validate = () => {
    if (!toggle.checked) return;
    ['returnPickup', 'returnDropoff'].forEach(name => {
      get(name).setCustomValidity(get(name).value.trim() ? '' : 'Enter the return journey address.');
    });
    const date = get('returnDate'), time = get('returnTime');
    date.min = get('date').value || '';
    time.setCustomValidity('');
    if (date.value && time.value && get('date').value && get('time').value) {
      if (date.value + 'T' + time.value <= get('date').value + 'T' + get('time').value) {
        time.setCustomValidity('Choose a return pickup after your outbound pickup.');
      }
    }
  };
  const update = () => {
    fields.hidden = !toggle.checked;
    fields.disabled = !toggle.checked;
    toggle.setAttribute('aria-expanded', String(toggle.checked));
    if (toggle.checked) { sync(); validate(); }
  };
  links.forEach(([from, to]) => {
    ['input', 'change'].forEach(type => {
      get(from).addEventListener(type, () => { if (toggle.checked) { sync(); validate(); } });
      get(to).addEventListener(type, () => { edited.add(to); validate(); });
    });
  });
  ['input', 'change'].forEach(type => {
    get('returnTime').addEventListener(type, validate);
    get('time').addEventListener(type, validate);
  });
  toggle.addEventListener('change', update);
  form.addEventListener('submit', event => {
    if (!toggle.checked) return;
    validate();
    if (!form.reportValidity()) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  form.addEventListener('reset', () => {
    edited.clear();
    fields.querySelectorAll('input').forEach(input => input.setCustomValidity(''));
    setTimeout(update, 0);
  });
  // Query-string defaults are filled by the quote page on DOMContentLoaded.
  document.addEventListener('DOMContentLoaded', () => { sync(); update(); });
  update();
})();
